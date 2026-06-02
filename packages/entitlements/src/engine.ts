/**
 * Entitlement engine — the ONLY access source of truth. Fail-closed.
 * Pure functions over Entitlement records (epoch-ms times) so they are deterministic & testable.
 * See docs/ENTITLEMENT_STATE_MACHINE.md. Zero dependencies (smoke-testable with `node`).
 */
import type { ProductCode } from './registry.ts';
import { expandPlan } from './registry.ts';
import type { BillingEvent, EntitlementStatus } from './state-machine.ts';
import { isGranting, nextStatus } from './state-machine.ts';

export type EntitlementSource = 'subscription' | 'one_time' | 'manual_grant' | 'bundle';

export interface Entitlement {
  userId: string;
  productCode: ProductCode | string;
  status: EntitlementStatus;
  source: EntitlementSource;
  planCode?: string;
  startsAt?: number;
  /** subscription period end (epoch ms) */
  currentPeriodEnd?: number;
  /** end of grace window (epoch ms) */
  graceUntil?: number;
  /** hard expiry for one_time / manual grants (epoch ms) */
  expiresAt?: number;
  /** manual admin grant/revoke takes precedence over billing events */
  manualOverride?: boolean;
  updatedAt: number;
}

export type AccessReason =
  | 'allowed'
  | 'grace'
  | 'blocked_no_entitlement'
  | 'pending_payment'
  | 'expired'
  | 'revoked'
  | 'refunded'
  | 'chargeback'
  | 'manual_review'
  | 'blocked_unknown_state';

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
  status: EntitlementStatus | 'none';
  productCode: string;
  /** the entitlement that drove the decision, if any */
  entitlement?: Entitlement;
}

function effectiveEnd(ent: Entitlement): number | undefined {
  const ends: number[] = [];
  if (typeof ent.currentPeriodEnd === 'number') ends.push(ent.currentPeriodEnd);
  if (typeof ent.expiresAt === 'number') ends.push(ent.expiresAt);
  return ends.length ? Math.min(...ends) : undefined;
}

/**
 * Resolve the effective status of one entitlement at time `now`, applying time-based
 * transitions (active → grace → expired). Unknown statuses collapse to `manual_review`.
 */
export function evaluateStatus(ent: Entitlement, now: number): EntitlementStatus {
  switch (ent.status) {
    case 'none':
    case 'pending_payment':
    case 'revoked':
    case 'refunded':
    case 'chargeback':
    case 'manual_review':
      return ent.status;
    case 'expired':
      return 'expired';
    case 'active': {
      const end = effectiveEnd(ent);
      if (end === undefined || now <= end) return 'active';
      if (typeof ent.graceUntil === 'number' && now <= ent.graceUntil) return 'grace';
      return 'expired';
    }
    case 'grace': {
      if (typeof ent.graceUntil === 'number' && now <= ent.graceUntil) return 'grace';
      return 'expired';
    }
    default:
      return 'manual_review';
  }
}

const REASON_OF_STATUS: Record<EntitlementStatus, AccessReason> = {
  none: 'blocked_no_entitlement',
  pending_payment: 'pending_payment',
  active: 'allowed',
  grace: 'grace',
  expired: 'expired',
  revoked: 'revoked',
  refunded: 'refunded',
  chargeback: 'chargeback',
  manual_review: 'manual_review',
};

// Most-actionable blocking reason first (used when multiple entitlements all deny).
const BLOCK_PRIORITY: AccessReason[] = [
  'manual_review',
  'chargeback',
  'refunded',
  'revoked',
  'pending_payment',
  'expired',
  'blocked_unknown_state',
  'blocked_no_entitlement',
];

/**
 * Decide access for a product given ALL of a user's entitlements. Returns an explainable
 * decision. Access is granted iff at least one entitlement evaluates to `active`/`grace`.
 */
export function explainAccess(entitlements: Entitlement[], productCode: string, now: number): AccessDecision {
  const candidates = entitlements.filter((e) => e.productCode === productCode);
  if (candidates.length === 0) {
    return { allowed: false, reason: 'blocked_no_entitlement', status: 'none', productCode };
  }

  let granting: { ent: Entitlement; status: EntitlementStatus } | undefined;
  const blockingReasons: { reason: AccessReason; ent: Entitlement; status: EntitlementStatus }[] = [];

  for (const ent of candidates) {
    const status = evaluateStatus(ent, now);
    if (isGranting(status)) {
      // prefer an `active` grant over a `grace` one
      if (!granting || (granting.status === 'grace' && status === 'active')) granting = { ent, status };
    } else {
      blockingReasons.push({ reason: REASON_OF_STATUS[status] ?? 'blocked_unknown_state', ent, status });
    }
  }

  if (granting) {
    return {
      allowed: true,
      reason: granting.status === 'active' ? 'allowed' : 'grace',
      status: granting.status,
      productCode,
      entitlement: granting.ent,
    };
  }

  for (const reason of BLOCK_PRIORITY) {
    const hit = blockingReasons.find((b) => b.reason === reason);
    if (hit) return { allowed: false, reason: hit.reason, status: hit.status, productCode, entitlement: hit.ent };
  }
  return { allowed: false, reason: 'blocked_no_entitlement', status: 'none', productCode };
}

/** Fail-closed boolean access check. */
export function hasAccess(entitlements: Entitlement[], productCode: string, now: number): boolean {
  return explainAccess(entitlements, productCode, now).allowed;
}

/** Create a manual admin grant (precedence over billing). Optional hard expiry. */
export function grantManual(userId: string, productCode: ProductCode | string, now: number, expiresAt?: number): Entitlement {
  const ent: Entitlement = {
    userId,
    productCode,
    status: 'active',
    source: 'manual_grant',
    planCode: 'admin_grant',
    manualOverride: true,
    startsAt: now,
    updatedAt: now,
  };
  if (typeof expiresAt === 'number') ent.expiresAt = expiresAt;
  return ent;
}

/** Expand a purchased plan into one entitlement per granted product. */
export function entitlementsForPlan(
  userId: string,
  planCode: string,
  now: number,
  opts: { currentPeriodEnd?: number; graceUntil?: number; expiresAt?: number; source?: EntitlementSource } = {},
): Entitlement[] {
  const products = expandPlan(planCode);
  const source: EntitlementSource = opts.source ?? (products.length > 1 ? 'bundle' : 'subscription');
  return products.map((productCode) => {
    const ent: Entitlement = { userId, productCode, status: 'active', source, planCode, startsAt: now, updatedAt: now };
    if (typeof opts.currentPeriodEnd === 'number') ent.currentPeriodEnd = opts.currentPeriodEnd;
    if (typeof opts.graceUntil === 'number') ent.graceUntil = opts.graceUntil;
    if (typeof opts.expiresAt === 'number') ent.expiresAt = opts.expiresAt;
    return ent;
  });
}

/**
 * Apply a billing/admin event to an entitlement. Manual grants take precedence over billing:
 * if `manualOverride` is set, ordinary billing events are ignored (only refund/chargeback/
 * manual_revoke/flag_review/manual_grant can change it).
 */
export function applyBillingEvent(
  ent: Entitlement,
  event: BillingEvent,
  now: number,
  opts: { currentPeriodEnd?: number; graceUntil?: number } = {},
): Entitlement {
  const adminEvents: BillingEvent[] = ['manual_grant', 'manual_revoke', 'refunded', 'chargeback', 'flag_review'];
  if (ent.manualOverride && !adminEvents.includes(event)) return ent;

  const status = nextStatus(ent.status, event);
  const updated: Entitlement = { ...ent, status, updatedAt: now };
  if (event === 'manual_grant') updated.manualOverride = true;
  if (event === 'manual_revoke') updated.manualOverride = true;
  if (typeof opts.currentPeriodEnd === 'number') updated.currentPeriodEnd = opts.currentPeriodEnd;
  if (typeof opts.graceUntil === 'number') updated.graceUntil = opts.graceUntil;
  return updated;
}

/** Persist time drift: returns the entitlement with its stored status reconciled to `now`. */
export function reconcileExpiry(ent: Entitlement, now: number): Entitlement {
  const status = evaluateStatus(ent, now);
  return status === ent.status ? ent : { ...ent, status, updatedAt: now };
}
