# Billing Provider Plan

**Owner:** `packages/billing`
**Status:** Phase 0 canonical reference — binding for all implementers.

This document specifies the provider abstraction layer for billing, the three concrete
provider implementations, plan/billing-type matrix, the mock dev provider, and the
exact sync path from billing state into entitlements.

---

## 1. Provider Abstraction Interface

All billing logic flows through a single `BillingProvider` interface located at
`packages/billing/src/provider.ts`. No route handler or entitlement code imports
a Stripe SDK, crypto SDK, or manual billing utility directly.

```typescript
// packages/billing/src/provider.ts

export type BillingInterval = 'one_time' | 'monthly' | 'yearly' | 'quarterly';

export interface CheckoutParams {
  userId: string;          // WTC user UUID
  planCode: string;        // PlanCode enum value
  productCode: string;     // ProductCode enum value (or comma-joined for bundles)
  priceId: string;         // provider-specific price/product ID
  successUrl: string;      // redirect after success
  cancelUrl: string;       // redirect on cancel
  customerEmail: string;   // prefill; not stored as plaintext after redirect
  metadata: Record<string, string>; // must include userId, planCode, productCode
  trialDays?: number;      // 0 for no trial
}

export interface CheckoutResult {
  checkoutUrl: string;     // redirect the user here
  sessionId: string;       // provider session ID for idempotency
  externalCustomerId?: string; // provider customer ID if pre-created
}

export interface SyncSubscriptionParams {
  externalSubscriptionId: string; // provider subscription/agreement ID
  userId: string;
  planCode: string;
  productCode: string;
}

export interface SubscriptionState {
  externalSubscriptionId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'paused' | 'unknown';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  rawProviderData: unknown; // full provider object for debugging
}

export interface WebhookHandleResult {
  eventType: string;       // provider-specific event type
  idempotencyKey: string;  // used to deduplicate
  entitlementTransitions: EntitlementTransition[]; // zero or more
  acknowledged: boolean;   // true if handled or idempotent-duplicate
}

export interface EntitlementTransition {
  userId: string;
  productCode: string;
  fromState: string;
  toState: string;
  validFrom: Date;
  validUntil: Date | null;
  planCode: string;
  billingEventId: string;
  metadata: Record<string, unknown>;
}

export interface BillingProvider {
  providerName: 'stripe' | 'crypto' | 'manual' | 'mock';

  /**
   * Create a checkout session/link.
   * Must NOT commit any DB state — only creates a provider-side session.
   * Entitlement moves to pending_payment only after createCheckout returns.
   */
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;

  /**
   * Fetch current subscription state from the provider.
   * Used for reconciliation and admin diagnostics.
   * Must NOT modify entitlements directly — caller passes result to syncBillingState.
   */
  syncSubscription(params: SyncSubscriptionParams): Promise<SubscriptionState>;

  /**
   * Handle an inbound webhook payload.
   * MUST verify the provider signature before processing.
   * MUST be idempotent (same event ID → same result, no duplicate transitions).
   * Returns the list of entitlement transitions to apply.
   * Caller (webhook route handler) applies the transitions via packages/entitlements.
   */
  handleWebhook(
    rawBody: Buffer,         // raw bytes for signature verification
    headers: Record<string, string>,
    idempotencyStore: IdempotencyStore,
  ): Promise<WebhookHandleResult>;
}

export interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  set(key: string, ttlSeconds: number): Promise<void>;
}
```

### Interface invariants

1. `createCheckout` never mutates entitlements. Entitlement row is created (as `pending_payment`) by the caller after a successful checkout session creation.
2. `handleWebhook` verifies signatures before returning. If verification fails, it throws `WebhookSignatureError` and never returns a transition list.
3. `handleWebhook` never persists state directly. It returns transition descriptors; `packages/entitlements` applies them in a transaction.
4. `syncSubscription` is read-only and idempotent. It is used by the worker for reconciliation and by the admin panel for diagnostics.
5. All monetary amounts in webhook events are in the provider's native format (e.g., Stripe cents). Providers must not emit amounts in processed form — the audit log captures the raw provider event.

---

## 2. Stripe Provider

**Location:** `packages/billing/src/providers/stripe.ts`
**SDK:** `stripe` npm package (server-side only; never imported in browser bundles).

### Configuration

```typescript
// Required env vars
STRIPE_SECRET_KEY        // sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET    // whsec_...  (from Stripe Dashboard → Webhooks)
STRIPE_API_VERSION       // e.g. "2024-06-20" — pin to a specific version
```

### createCheckout (Stripe)

- Creates a `stripe.checkout.sessions.create` with `mode: 'subscription'` or `'payment'`
  depending on billing interval.
- One-time plans use `mode: 'payment'`.
- Recurring plans use `mode: 'subscription'`.
- Metadata on the Checkout Session MUST include: `wtc_user_id`, `wtc_plan_code`, `wtc_product_code`.
  These are echoed back in all webhook events from this session.
- Returns `{ checkoutUrl: session.url, sessionId: session.id }`.
- Customer lookup: if `billing_customers` row exists for userId+provider='stripe', pass
  `customer: externalCustomerId` to avoid duplicate Stripe customers.
- If no customer exists, use `customer_email` and let Stripe create one; store the resulting
  `customer.id` after webhook confirmation.

### syncSubscription (Stripe)

- Calls `stripe.subscriptions.retrieve(externalSubscriptionId, { expand: ['latest_invoice'] })`.
- Maps Stripe `status` to internal `SubscriptionState.status`:
  - `active` → `active`
  - `trialing` → `trialing`
  - `past_due` → `past_due`
  - `canceled` → `canceled`
  - `unpaid` → `unpaid`
  - `paused` → `paused`
  - all others → `unknown`
- Returns raw Stripe subscription object in `rawProviderData` for admin diagnostics.

### handleWebhook (Stripe)

- Verifies signature using `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
- On `StripeSignatureVerificationError` → throws `WebhookSignatureError` (caller returns HTTP 400).
- Idempotency: checks `event.id` in store before processing; if found, returns `acknowledged: true`
  with empty transitions.
- Event mapping (see also PAYMENT_WEBHOOK_STATE_MACHINE.md):

| Stripe Event | Entitlement Transition |
|---|---|
| `checkout.session.completed` | `pending_payment` → `active` |
| `invoice.paid` | `active/grace/expired` → `active` (extend) |
| `invoice.payment_failed` | `active` → `grace` |
| `customer.subscription.deleted` | `active/grace` → `expired` |
| `charge.refunded` (full) | `active/grace` → `refunded` |
| `charge.refunded` (partial) | any → `manual_review` |
| `charge.dispute.created` | any → `chargeback` |
| `charge.dispute.closed` | `chargeback` → `expired` (won) or `refunded` (lost) |

### Stripe Plan-to-Price ID mapping

Stored in `packages/billing/src/stripe-price-map.ts` (not hardcoded in provider logic):

```typescript
export const STRIPE_PRICE_MAP: Record<string, string> = {
  tortila_monthly:       'price_xxx',
  tortila_yearly:        'price_xxx',
  legacy_monthly:        'price_xxx',
  axioma_monthly:        'price_xxx',
  axioma_yearly:         'price_xxx',
  indicators_quarterly:  'price_xxx',
  indicators_yearly:     'price_xxx',
  education_lifetime:    'price_xxx',
  club_monthly:          'price_xxx',
  bundle_pro:            'price_xxx',
  bundle_starter:        'price_xxx',
};
```

Prices are configured in Stripe Dashboard. The map is updated per environment via env vars or
a DB config table managed by admins. Never hardcode live price IDs in code.

---

## 3. Crypto Provider

**Location:** `packages/billing/src/providers/crypto.ts`
**Model:** External crypto payment processor (e.g., NOWPayments, CoinGate, or direct wallet
with confirmation monitoring). The interface hides the specific processor behind the abstraction.

**Status:** Implementation is a documented stub in Phase 0. The interface is complete; the
processor-specific implementation requires operator selection and API keys.

### Configuration

```typescript
CRYPTO_PROVIDER_NAME     // 'nowpayments' | 'coingate' | 'manual_wallet'
CRYPTO_API_KEY           // processor API key (encrypted at rest in vault)
CRYPTO_WEBHOOK_SECRET    // HMAC secret for signature verification
CRYPTO_ACCEPTED_COINS    // comma-separated: 'BTC,ETH,USDT'
CRYPTO_OVERPAY_BUFFER    // 0.02 = allow 2% overpayment as rounding buffer
```

### createCheckout (Crypto)

- Calls processor API to create a payment invoice/session.
- Returns `{ checkoutUrl: invoice.payment_url, sessionId: invoice.id }`.
- Invoice metadata MUST include: `wtc_user_id`, `wtc_plan_code`, `wtc_product_code`.
- Crypto payments are one-time invoice events (no native recurring billing).
  Recurring plans are implemented by generating a new invoice at renewal time
  and tracking the mapping in `subscriptions.provider_subscription_id` as a series ID.

### syncSubscription (Crypto)

- Calls processor API to check invoice/payment status.
- Maps processor status to internal: `paid` → `active`, `waiting/pending` → `trialing` (as proxy),
  `expired` → `canceled`, `failed` → `unknown`.
- Returns current confirmation count and expected confirmations in `rawProviderData`.

### handleWebhook (Crypto)

- Verifies HMAC-SHA256 signature on raw body with `CRYPTO_WEBHOOK_SECRET`.
- Maps processor events to entitlement transitions using the same logic as Stripe above.
- Awaits required blockchain confirmations before emitting `pending_payment → active` transition.
  Minimum confirmations: BTC=3, ETH=12, USDT/TRC20=19 (configurable).
- Partial payments (underpayment) → `manual_review` (do not grant access for partial payment).

### Crypto-specific rules

- Crypto payments are never automatically refunded by the platform. Refund policy is manual.
- Chargebacks are not possible on-chain. Dispute resolution is handled via `manual_review`.
- Crypto plan codes map to the same product access as their fiat equivalents.

---

## 4. Manual Provider

**Location:** `packages/billing/src/providers/manual.ts`
**Model:** Admin creates an entitlement directly in the admin panel. No external payment processor.

### createCheckout (Manual)

- Not applicable. Manual grants bypass checkout.
- Calling `createCheckout` on the manual provider throws `UnsupportedOperationError`.
- Manual grants use `packages/entitlements.grantAccess(userId, productCode, planCode='admin_grant', validUntil)`.

### syncSubscription (Manual)

- Returns the current entitlement state from the WTC DB (not an external provider).
- Status mapping: `active` → `active`, others → `unknown`.
- Used by the admin panel to display manually-granted subscription details.

### handleWebhook (Manual)

- Not applicable. Manual provider has no webhooks.
- Calling `handleWebhook` on the manual provider throws `UnsupportedOperationError`.

### Manual grant flow (admin panel)

```
Admin → POST /api/admin/entitlements/grant
  body: { userId, productCode, planCode: 'admin_grant', validUntil | null, reason }
  → RBAC check: role = 'admin'
  → packages/entitlements.grantAccess(...)
  → audit_log entry written
  → notification sent to user (optional)
```

---

## 5. Mock Dev Provider

**Location:** `packages/billing/src/providers/mock.ts`
**Use:** Local development and Vitest integration tests only. Never activated in production.
Controlled by `NODE_ENV !== 'production'` guard and `BILLING_PROVIDER=mock` env var.

### Behavior

- `createCheckout`: returns a fake `checkoutUrl` pointing to `/dev/billing/simulate?session=mock-xxx`.
  A dev-only route handler at that path immediately fires a simulated `checkout.session.completed`
  event, allowing the full checkout→entitlement flow to be tested locally without Stripe.
- `syncSubscription`: returns a hardcoded `active` state with `currentPeriodEnd = NOW() + 30 days`.
- `handleWebhook`: accepts any payload without signature verification. Accepts a
  `x-mock-event-type` header to simulate any event type.

### Mock simulation endpoint

`GET /dev/billing/simulate?session={sessionId}&event={eventType}`

Only available when `NODE_ENV !== 'production'`. Triggers the corresponding billing event
through the same `handleWebhook → entitlements.syncBillingState` path as production.
This ensures the dev path exercises the same code as production.

### Mock checkout — dev-only server action

The current `/app/billing` page uses a Next.js Server Action (`mockPurchase`) that calls
`assertNotProduction()` as the first statement. This is the **only sanctioned mock checkout
path**. It is a server action, not a route handler, and is hard-disabled in production. No
mock checkout URL, simulated session, or fake payment event may be triggered outside of this
guarded server action in development.

The mock checkout server action MUST NOT be adapted to accept arbitrary plan pricing or
currency amounts — it is a dev convenience, not a payment simulation for end-users.

### Mock plan scenarios

Pre-configured mock scenarios (loaded by `apps/web` seed scripts):

| Scenario | planCode | outcome |
|---|---|---|
| `mock_success` | `tortila_monthly` | full checkout → active |
| `mock_payment_failed` | `tortila_monthly` | invoice.payment_failed → grace |
| `mock_refund` | `axioma_monthly` | refund → refunded |
| `mock_chargeback` | `bundle_pro` | dispute → chargeback |
| `mock_cancel` | `tortila_yearly` | subscription.canceled → expired |

---

## 6. One-Time vs Monthly vs Yearly vs Bundle

| Billing Type | `mode` (Stripe) | `valid_until` | Grace Period | Renewal |
|---|---|---|---|---|
| `one_time` | `payment` | Fixed date OR `NULL` (lifetime) | NO (lifetime) / YES (fixed) | Manual re-purchase |
| `monthly` | `subscription` | `NOW() + 1 month` | YES (3 days default) | Auto via `invoice.paid` |
| `yearly` | `subscription` | `NOW() + 12 months` | YES (3 days default) | Auto via `invoice.paid` |
| `quarterly` | `subscription` | `NOW() + 3 months` | YES (3 days default) | Auto via `invoice.paid` |
| `bundle` | `subscription` | `NOW() + plan duration` | YES (shared grace across members) | Auto via `invoice.paid` extends all members |

### Lifetime plans (`education_lifetime`)

- `valid_until = NULL` stored in DB.
- Worker expiry job skips rows where `valid_until IS NULL`.
- Refund of a lifetime plan sets `valid_until = NOW()` and transitions to `refunded`.
- No grace period for `valid_until = NULL` plans (nothing to expire).

---

## 7. Billing State → Entitlement Sync

The sync path is the ONLY way billing state affects entitlements.
No direct DB writes from billing tables to entitlement tables without going through `packages/entitlements`.

```
Billing Event arrives at webhook endpoint
        │
        ▼
BillingProvider.handleWebhook(rawBody, headers, idempotencyStore)
        │ verifies signature
        │ checks idempotency
        │ maps event → EntitlementTransition[]
        ▼
packages/entitlements.syncBillingState(transitions[])
        │ opens DB transaction
        │ for each transition:
        │   validates fromState matches current DB state
        │   applies toState
        │   writes product_access_events row
        │   writes audit_log row
        │   handles bundle expansion if applicable
        │ commits transaction
        ▼
HTTP 200 returned to provider
```

### State mismatch handling in syncBillingState

If the DB state does not match the expected `fromState` in a transition:

- **Acceptable drift** (billing is behind DB): `invoice.paid` arrives but DB is already `active` → no-op, log `idempotent_no_change`.
- **Manual override preserved**: `invoice.paid` arrives but DB is `revoked` → no-op, log `manual_override_preserved`, return 200.
- **Unexpected state** (e.g., `invoice.paid` arrives but DB is `chargeback`): → `manual_review`, log `unexpected_billing_state_conflict`, alert admin.
- **Missing entitlement row**: `invoice.paid` arrives but no row exists → create new `active` row (handles missed `pending_payment` window).

### Worker reconciliation

The `apps/worker` runs `billing.syncSubscription` for all active subscriptions once per day (00:00 UTC)
to catch any drift between WTC entitlement state and provider subscription state.
Discrepancies are written to `integration_health_checks` and surfaced in the admin system health panel.

---

## 8. Billing Customer Table

Provider-customer associations are stored separately from entitlements to support
multiple payment methods per user.

```sql
-- Table: billing_customers
-- Group: Products (bounded context)
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL REFERENCES users(id)
provider            TEXT NOT NULL CHECK (provider IN ('stripe', 'crypto', 'manual'))
external_customer_id TEXT NOT NULL          -- e.g., cus_xxx for Stripe
created_at          TIMESTAMPTZ DEFAULT NOW()
UNIQUE (user_id, provider)
```

This table is managed exclusively by `packages/billing`. No other package reads it directly.

---

## 9. Required Tests Before Production Wiring

| Test | Package | Type |
|---|---|---|
| Stripe signature verification rejects tampered body | `packages/billing` | Vitest unit |
| Crypto signature verification rejects invalid HMAC | `packages/billing` | Vitest unit |
| Idempotent duplicate event returns 200 with no state change | `packages/billing` | Vitest unit |
| Each Stripe event type maps to correct entitlement transition | `packages/billing` | Vitest unit |
| Bundle expansion creates all member entitlements atomically | `packages/billing` + `packages/entitlements` | Vitest integration |
| Manual grant creates active entitlement without provider event | `packages/billing` | Vitest unit |
| Billing event ignored when entitlement is revoked (manual override preserved) | `packages/billing` | Vitest unit |
| syncSubscription reconciliation corrects drifted state | `apps/worker` | Vitest integration |
| Mock provider end-to-end checkout → active flow | `packages/billing` | Vitest integration |
| Partial refund transitions to manual_review | `packages/billing` | Vitest unit |

---

## 10. Pricing / Plans Display Model (Phase 2 — Part 9b)

This section defines the typed data objects that the public `/pricing` page and the
logged-in `/app/billing` page render. All data derives from `packages/entitlements/src/registry.ts`
(`PLANS`, `PRODUCTS`) — never from billing provider APIs directly.

### Public pricing page: `PricingPageData`

```typescript
// Consumed by: apps/web/src/app/(public)/pricing/page.tsx
// Source: PLANS registry — static, no user session needed.

export interface PricingPlanCard {
  /** Plan code — stable key for React list rendering. */
  planCode: string;

  /** Human-facing plan name (from PLANS registry). */
  name: string;

  /**
   * Billing cadence label shown in the status pill.
   * 'one_time' | 'monthly' | 'yearly' | 'quarterly' | 'manual'
   */
  billing: string;

  /** Whether this is a bundle (drives 'gold' pill vs 'neutral'). */
  isBundle: boolean;

  /**
   * Product names included in this plan. Shown as a tagline under the plan name.
   * Empty for admin_grant; admin_grant is filtered from public pricing.
   */
  products: string[];

  /**
   * Price display string. Currently placeholder ('—') until real Stripe prices
   * are populated in STRIPE_PRICE_MAP. Never expose raw Stripe price IDs here.
   */
  priceDisplay: string;

  /**
   * Primary CTA for this plan card on the public pricing page.
   * Always points to /register (not checkout) — logged-out users must register first.
   */
  cta: { label: string; href: string };
}
```

Rule: `admin_grant` plan MUST be filtered from the public pricing page and from the
logged-in plan list. It is internal-only and must never appear in user-facing UI.

### Logged-in billing page: `BillingPageData`

```typescript
// Consumed by: apps/web/src/app/(app)/app/billing/page.tsx
// Source: entitlementsOf(userId) + PLANS registry. Session required.

export interface EntitlementRow {
  /** Product code for the entitlement. */
  productCode: string;

  /** Human-facing product name (from PRODUCTS registry). */
  productName: string;

  /** Plan code of the entitlement (e.g., 'tortila_monthly', 'admin_grant'). */
  planCode: string;

  /**
   * Effective status at page render time (from evaluateStatus(ent, now)).
   * Used to drive the StatusPill tone.
   */
  effectiveStatus: string;

  /**
   * Effective status tone: 'ok' | 'warn' | 'bad'.
   * 'ok' = active, 'warn' = grace, 'bad' = everything else.
   */
  tone: 'ok' | 'warn' | 'bad';

  /**
   * Renewal or expiry date string (ISO), or null if lifetime / no expiry.
   * Sourced from currentPeriodEnd ?? expiresAt.
   */
  renewsOrExpiresAt: string | null;

  /**
   * Human-readable label for the renewal/expiry cell.
   * 'Renews [date]' for active recurring, 'Expires [date]' for grace/expiring,
   * 'Lifetime' for null valid_until, 'Expired [date]' for expired.
   */
  renewsOrExpiresLabel: string;
}

export interface BillingPageData {
  /** The user's current entitlements, each with effective status. */
  entitlements: EntitlementRow[];

  /**
   * All non-admin plans available for mock purchase (dev-only).
   * Same as PricingPlanCard[] but rendered inside /app/billing.
   * In production this becomes the real upgrade flow.
   */
  plans: PricingPlanCard[];

  /**
   * Whether the mock checkout UI is shown.
   * True only when NODE_ENV !== 'production'.
   */
  showMockCheckout: boolean;

  /**
   * Banner message when showMockCheckout = true.
   * Always shown as a RiskWarningBanner so devs know it is dev-only.
   */
  mockCheckoutWarning: string;
}
```

### Key display rules

1. The `effectiveStatus` displayed in the billing table is ALWAYS computed from `evaluateStatus(ent, now)` at render time, not from the raw `ent.status` stored in DB. This ensures time-based transitions (active → grace → expired) are reflected without a DB write.
2. A `grace` row MUST show a prominent warning in addition to the status pill. The warning text is: "Your [ProductName] subscription ended [date]. Renew by [graceUntil] to keep access."
3. Plans with `kind === 'bundle'` are shown first and highlighted with the `gold` tone pill.
4. The `/app/billing` page MUST NOT show a checkout flow to logged-out users — the route is protected by `requireUser()`.
5. Price display is currently `'—'` (placeholder). When real Stripe prices are configured, the price is fetched from the STRIPE_PRICE_MAP environment configuration and formatted as a currency string by the server component. Price amounts are never fetched from Stripe APIs at page render time (cache/config only).
6. The mock checkout server action (`mockPurchase`) is the only way to activate a plan in dev. The button label MUST include "dev" or "mock" and must never appear in production (guarded by `assertNotProduction()`).

---

## Related Documents

- [ENTITLEMENT_STATE_MACHINE.md](./ENTITLEMENT_STATE_MACHINE.md)
- [PAYMENT_WEBHOOK_STATE_MACHINE.md](./PAYMENT_WEBHOOK_STATE_MACHINE.md)
- [CONTRACTS/billing-webhooks.md](./CONTRACTS/billing-webhooks.md)
- [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md)
- [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md)
