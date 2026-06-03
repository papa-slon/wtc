/**
 * @wtc/cabinet — pure per-product cabinet-card derivation. The ONLY place the user cabinet decides
 * what a product card says: entitlement copy/tone, setup state, the single most-actionable next action,
 * and honest blockers. Pure & deterministic (epoch-ms times in, view-model out) so it is unit-testable
 * without the app or a DB. FAIL CLOSED: access is decided upstream by @wtc/entitlements (explainAccess);
 * this module only renders that decision — it NEVER grants or implies access on its own, and per-user
 * setup/activity signals must only be passed in when the upstream decision is `allowed` (the loader
 * enforces that; see apps/web/src/features/cabinet/loader.ts).
 *
 * Zero runtime dependencies (type-only cross-package imports, like @wtc/entitlements) so its test runs
 * under Vitest before any workspace symlink wiring — the repo convention for pure packages.
 */
import type { AccessReason, ProductCode } from '@wtc/entitlements';
import type { Tone } from '@wtc/ui';

// ── Local domain types (kept structurally identical to apps/web/src/lib/product-status.ts so the
//    app-layer loader can pass its values straight through). ──────────────────────────────────────
export type Availability = 'available' | 'demo' | 'planned' | 'disabled';
export type WarnSeverity = 'error' | 'warning' | 'info';
/** In-repo production blockers (docs/PRODUCTION_BLOCKERS.md). 'demo' is a per-card persistence note. */
export type BlockerRef = 'B2' | 'B3' | 'B4';

export type SetupState = 'ready' | 'incomplete' | 'not_started' | 'not_applicable' | 'unavailable';
export type CtaVariant = 'primary' | 'secondary' | 'ghost';

export interface CabinetSetupItem {
  label: string;
  done: boolean;
}

export interface CabinetWarnings {
  count: number;
  maxSeverity: WarnSeverity | null;
}

/** Per-user signals — present ONLY when the access decision is `allowed` (fail-closed data minimisation). */
export interface CabinetSignals {
  /** setup checklist already computed by the loader from per-product repos (exchange keys, config, …). */
  setupItems?: CabinetSetupItem[];
  /** one-line recent activity, or null when there is none. Never a secret value. */
  activityLine?: string | null;
  activityAt?: number | null;
  /** persistent product-level warnings summary (e.g. Tortila P0/P1). */
  warnings?: CabinetWarnings;
}

export interface CabinetCardInput {
  productCode: ProductCode;
  name: string;
  description: string;
  /** product route (e.g. /app/bots/tortila). */
  href: string;
  reason: AccessReason;
  allowed: boolean;
  /** effective entitlement end (epoch ms), if any — drives the "expires in N days" hint. */
  periodEnd?: number | null;
  availability: Availability;
  /** running the in-memory demo backend (changes are not persisted). */
  isDemo: boolean;
  /** static product blocker, if the product is hard-blocked (legacy HTTP/control adapter, B4 Axioma CTAs). */
  blockerRef?: BlockerRef | null;
  /** self-serve checkout live? (B2). false today — drives "Get access" vs "Contact support". */
  checkoutEnabled: boolean;
  /** per-user setup/activity — pass ONLY when `allowed`. */
  signals?: CabinetSignals;
  /** reference time (epoch ms). */
  now: number;
}

export interface CabinetBlocker {
  /** a production-blocker ref or the per-card demo-persistence note. */
  ref: BlockerRef | 'demo';
  text: string;
}

export interface CabinetNextAction {
  label: string;
  /** null => non-navigating (disabled "coming soon"). */
  href: string | null;
  variant: CtaVariant;
  disabled: boolean;
}

export interface CabinetCardView {
  productCode: ProductCode;
  name: string;
  description: string;
  href: string;
  /** mirrors the upstream access decision — convenience for summary counts. */
  allowed: boolean;
  reason: AccessReason;
  entitlement: { label: string; tone: Tone; detail: string; expiresInDays: number | null };
  setup: { state: SetupState; label: string; items: CabinetSetupItem[] };
  activity: { line: string | null; at: number | null };
  nextAction: CabinetNextAction;
  blockers: CabinetBlocker[];
  warnings: CabinetWarnings;
  availability: Availability;
  isDemo: boolean;
}

// ── App routes (centralised so the fail-closed CTA routing is one tested place). ──────────────────
const BILLING_HREF = '/app/billing';
const SUPPORT_HREF = '/app/support';
const DAY_MS = 86_400_000;

/** Canonical AccessReason → label/tone/detail. Single source so the cabinet never re-derives tone
 *  ad-hoc in JSX (apps/web/src/lib/access.ts re-exports reasonTone/reasonLabel from here). */
export const ACCESS_REASON_COPY: Record<AccessReason, { label: string; tone: Tone; detail: string }> = {
  allowed: { label: 'Active', tone: 'ok', detail: 'Your entitlement is active.' },
  grace: { label: 'Grace period', tone: 'warn', detail: 'Payment lapsed — access continues briefly. Renew to avoid interruption.' },
  pending_payment: { label: 'Pending payment', tone: 'warn', detail: 'Awaiting payment confirmation before access opens.' },
  blocked_no_entitlement: { label: 'Not owned', tone: 'neutral', detail: 'You do not currently have access to this product.' },
  expired: { label: 'Expired', tone: 'bad', detail: 'Your access has expired. Renew to restore it.' },
  revoked: { label: 'Revoked', tone: 'bad', detail: 'Access was revoked. Contact support if unexpected.' },
  refunded: { label: 'Refunded', tone: 'bad', detail: 'Access ended after a refund.' },
  chargeback: { label: 'Chargeback', tone: 'bad', detail: 'Access is blocked pending a payment dispute. Contact support.' },
  manual_review: { label: 'Manual review', tone: 'warn', detail: 'Access is on hold pending a manual review.' },
  blocked_unknown_state: { label: 'Unknown', tone: 'bad', detail: 'Entitlement state could not be determined. Contact support.' },
};

/** Tone for an access reason (canonical). */
export function reasonTone(reason: AccessReason): Tone {
  return ACCESS_REASON_COPY[reason].tone;
}

/** Human label for an access reason (canonical). */
export function reasonLabel(reason: AccessReason): string {
  return ACCESS_REASON_COPY[reason].label;
}

const BLOCKER_TEXT: Record<BlockerRef, string> = {
  B2: 'Self-serve checkout is not yet live — access is granted manually for now.',
  B3: 'The legacy direct HTTP/control path is blocked. Use the worker DB live-read path for safe pub_id snapshots; live control remains disabled (B3).',
  B4: 'Download / Open-Journal / account-link are disabled until the Axioma handoff is provisioned (B4).',
};

/** Setup state from a checklist: every item done → ready; some → incomplete; none → not_started. */
function setupStateFromItems(items: CabinetSetupItem[]): SetupState {
  if (items.length === 0) return 'not_applicable';
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return 'ready';
  if (done === 0) return 'not_started';
  return 'incomplete';
}

function setupLabel(state: SetupState, items: CabinetSetupItem[]): string {
  switch (state) {
    case 'ready': return 'Ready';
    case 'incomplete': return `Setup ${items.filter((i) => i.done).length}/${items.length}`;
    case 'not_started': return 'Setup needed';
    case 'unavailable': return 'Setup state unavailable';
    case 'not_applicable': return '—';
  }
}

/** The single most-actionable next step. FAIL CLOSED: a non-allowed product never routes to a config
 *  surface — only to billing/support/status. Owned-but-blocked products (B3/B4) never imply live data. */
function deriveNextAction(input: CabinetCardInput, setupState: SetupState): CabinetNextAction {
  const { productCode, href, reason, allowed, availability, blockerRef, checkoutEnabled } = input;

  if (!allowed) {
    if (availability === 'planned') {
      return { label: 'Coming soon', href: null, variant: 'ghost', disabled: true };
    }
    if (reason === 'blocked_no_entitlement') {
      return checkoutEnabled
        ? { label: 'Get access', href: BILLING_HREF, variant: 'primary', disabled: false }
        : { label: 'Contact support', href: SUPPORT_HREF, variant: 'secondary', disabled: false };
    }
    if (reason === 'expired') {
      return checkoutEnabled
        ? { label: 'Renew', href: BILLING_HREF, variant: 'primary', disabled: false }
        : { label: 'Contact support', href: SUPPORT_HREF, variant: 'secondary', disabled: false };
    }
    if (reason === 'pending_payment') {
      return { label: 'View status', href: BILLING_HREF, variant: 'secondary', disabled: false };
    }
    // revoked / refunded / chargeback / manual_review / unknown
    return { label: 'View status', href: SUPPORT_HREF, variant: 'secondary', disabled: false };
  }

  // allowed (active or grace) — owned-but-blocked products must not imply live data.
  if (blockerRef === 'B4') return { label: 'View details', href, variant: 'ghost', disabled: false };
  if (blockerRef === 'B3') return { label: 'View status', href, variant: 'ghost', disabled: false };

  if (setupState === 'not_started' || setupState === 'incomplete') {
    if (productCode === 'tortila_bot' || productCode === 'legacy_bot') {
      return { label: 'Finish setup', href: `${href}/setup`, variant: 'primary', disabled: false };
    }
    if (productCode === 'tradingview_indicators') {
      return { label: 'Submit username', href, variant: 'primary', disabled: false };
    }
  }
  return { label: 'Open', href, variant: 'primary', disabled: false };
}

/**
 * Derive a complete cabinet product card view-model from an upstream access decision + (when allowed)
 * the user's per-product signals. Pure.
 */
export function deriveProductCard(input: CabinetCardInput): CabinetCardView {
  const copy = ACCESS_REASON_COPY[input.reason];

  const expiresInDays =
    typeof input.periodEnd === 'number' ? Math.ceil((input.periodEnd - input.now) / DAY_MS) : null;

  // Setup/activity ONLY from signals that the loader supplies (and it supplies them only when allowed).
  const items = input.allowed ? (input.signals?.setupItems ?? []) : [];
  const setupState: SetupState = input.allowed ? setupStateFromItems(items) : 'not_applicable';

  const activityLine = input.allowed ? (input.signals?.activityLine ?? null) : null;
  const activityAt = input.allowed ? (input.signals?.activityAt ?? null) : null;

  const warnings: CabinetWarnings =
    input.allowed && input.signals?.warnings ? input.signals.warnings : { count: 0, maxSeverity: null };

  const blockers: CabinetBlocker[] = [];
  if (input.blockerRef) blockers.push({ ref: input.blockerRef, text: BLOCKER_TEXT[input.blockerRef] });
  if (input.isDemo) blockers.push({ ref: 'demo', text: 'Demo data — changes in this environment are not persisted.' });

  return {
    productCode: input.productCode,
    name: input.name,
    description: input.description,
    href: input.href,
    allowed: input.allowed,
    reason: input.reason,
    entitlement: { label: copy.label, tone: copy.tone, detail: copy.detail, expiresInDays },
    setup: { state: setupState, label: setupLabel(setupState, items), items },
    activity: { line: activityLine, at: activityAt },
    nextAction: deriveNextAction(input, setupState),
    blockers,
    warnings,
    availability: input.availability,
    isDemo: input.isDemo,
  };
}
