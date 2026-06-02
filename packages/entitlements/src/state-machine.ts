/**
 * Entitlement status state machine. FAIL-CLOSED: only `active` and `grace` grant access;
 * every other (and any unknown) status denies. See docs/ENTITLEMENT_STATE_MACHINE.md.
 * Zero dependencies (smoke-testable with `node`).
 */

export const ENTITLEMENT_STATUSES = [
  'none',
  'pending_payment',
  'active',
  'grace',
  'expired',
  'revoked',
  'refunded',
  'chargeback',
  'manual_review',
] as const;

export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

/** The ONLY access-granting statuses. */
const GRANTING: ReadonlySet<EntitlementStatus> = new Set(['active', 'grace']);

/** Fail-closed access predicate: anything not explicitly granting denies. */
export function isGranting(status: string): boolean {
  return GRANTING.has(status as EntitlementStatus);
}

export type BillingEvent =
  | 'checkout_completed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'period_elapsed'
  | 'grace_elapsed'
  | 'refunded'
  | 'chargeback'
  | 'manual_grant'
  | 'manual_revoke'
  | 'flag_review';

/**
 * Compute the next status for a (current, event) pair.
 * Safety-critical events (refunded/chargeback/manual_revoke/manual_grant/flag_review) apply
 * from ANY state. Unrecognized current states collapse to `manual_review` (non-granting).
 */
export function nextStatus(current: EntitlementStatus, event: BillingEvent): EntitlementStatus {
  switch (event) {
    case 'refunded':
      return 'refunded';
    case 'chargeback':
      return 'chargeback';
    case 'manual_revoke':
      return 'revoked';
    case 'manual_grant':
      return 'active';
    case 'flag_review':
      return 'manual_review';
    default:
      break;
  }

  switch (current) {
    case 'none':
      if (event === 'checkout_completed') return 'pending_payment';
      if (event === 'payment_succeeded') return 'active';
      return current;
    case 'pending_payment':
      if (event === 'payment_succeeded') return 'active';
      if (event === 'payment_failed') return 'expired';
      return current;
    case 'active':
      if (event === 'payment_failed' || event === 'subscription_canceled' || event === 'period_elapsed') return 'grace';
      return current;
    case 'grace':
      if (event === 'payment_succeeded') return 'active';
      if (event === 'grace_elapsed') return 'expired';
      return current;
    case 'expired':
      if (event === 'payment_succeeded') return 'active';
      return current;
    case 'revoked':
    case 'refunded':
    case 'chargeback':
    case 'manual_review':
      return current;
    default:
      return 'manual_review';
  }
}
