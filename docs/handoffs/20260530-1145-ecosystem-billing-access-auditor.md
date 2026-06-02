# Handoff: ecosystem-billing-access-auditor
**Epoch:** 20260530-1145
**Agent:** ecosystem-billing-access-auditor
**Parts covered:** 0 (doc truth), 1 (billing webhook + pricing/billing pages), 4 (admin ops — entitlements gaps)

---

## Scope

Read-only audit of billing + product-access layer for Phase 2.3. Covers:
- `packages/billing/src/{stripe.ts,webhook.ts,provider.ts,index.ts}`
- `packages/db/src/repositories.ts` — `applyStripeEvent`, `upsertSubscription`, `listSubscriptionsForUser`, `listProductAccessEvents`, `grantProduct`, `revokeProduct`
- `packages/entitlements/src/{state-machine.ts,engine.ts,registry.ts,index.ts}`
- `apps/web/src/lib/{backend.ts,access.ts}`
- `apps/web/src/app/(public)/pricing/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/BILLING_PROVIDER_PLAN.md`

**Deliverable:** implementation-ready spec for Part 1 (POST /api/billing/webhook route, pricing/billing pages, product-access timeline) and Part 4 (admin grant/revoke gaps), plus doc-truth findings for Part 0.

---

## Files inspected

- `packages/billing/src/webhook.ts` (69 lines)
- `packages/billing/src/stripe.ts` (68 lines)
- `packages/billing/src/provider.ts` (75 lines)
- `packages/billing/src/index.ts` (12 lines)
- `packages/billing/src/stripe.test.ts` (69 lines)
- `packages/billing/src/provider.test.ts` (28 lines)
- `packages/db/src/repositories.ts` (932 lines, full read)
- `packages/entitlements/src/state-machine.ts` (91 lines)
- `packages/entitlements/src/engine.ts` (219 lines)
- `packages/entitlements/src/registry.ts` (73 lines)
- `packages/entitlements/src/index.ts` (22 lines)
- `apps/web/src/lib/backend.ts` (113 lines)
- `apps/web/src/lib/access.ts` (34 lines)
- `apps/web/src/app/(public)/pricing/page.tsx` (27 lines)
- `apps/web/src/app/(app)/app/billing/page.tsx` (75 lines)
- `apps/web/src/app/admin/entitlements/page.tsx` (66 lines)
- `docs/CONTRACTS/billing-webhooks.md` (476 lines)
- `docs/ENTITLEMENT_STATE_MACHINE.md` (543 lines)
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` (first 175 lines)
- `docs/BILLING_PROVIDER_PLAN.md` (first 80 lines)

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — HIGH — Missing POST /api/billing/webhook route (Part 1)
**Evidence:** `apps/web/src/app/api/` directory does not exist. Confirmed by glob returning no results. The contract at `docs/CONTRACTS/billing-webhooks.md:64` states: "Implementation target: `apps/web/src/app/api/billing/webhook/route.ts` (does not yet exist)."
The JWKS route at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` is the only API route present.
**Recommendation:** Create `apps/web/src/app/api/billing/webhook/route.ts` following the exact algorithm in the Decisions section below. This is the central Part 1 deliverable.

### Finding 2 — HIGH — Contract deviation: idempotency ledger vs. dedicated table (Part 0, doc truth)
**Evidence:** `docs/CONTRACTS/billing-webhooks.md:207` and `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:95–106` both specify a dedicated `webhook_idempotency_keys` table. Phase 2.1 deliberately chose the `audit_logs` ledger instead. The implemented path is at `packages/db/src/repositories.ts:909–910`:
```
const [seen] = await tx.select({ id: s.auditLogs.id }).from(s.auditLogs)
  .where(and(eq(s.auditLogs.action, 'billing.webhook_received'), eq(s.auditLogs.targetId, input.stripeEventId)))
```
The `webhook_idempotency_keys` table does NOT exist in migration 0002. The deviation is intentional and documented in the repository comment at line 876–879 but the contract docs still specify the dedicated table.
**Recommendation (Part 0):** Update `docs/CONTRACTS/billing-webhooks.md §7` and `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md §3` to reflect the as-built audit_logs ledger approach. Add a note: "As of Phase 2.1 the idempotency check uses the `audit_logs` table (action=`billing.webhook_received`, targetId=`stripeEventId`) instead of a dedicated `webhook_idempotency_keys` table. The dedicated table remains a documented TARGET for higher-throughput scenarios." Do NOT create `webhook_idempotency_keys` in any migration.

### Finding 3 — HIGH — `checkout.session.completed` maps to `payment_succeeded` not `checkout_completed` (Part 1)
**Evidence:** `packages/billing/src/webhook.ts:49`:
```
'checkout.session.completed': 'payment_succeeded',
```
But the state machine at `packages/entitlements/src/state-machine.ts:65` has a specific `checkout_completed` event that transitions `none → pending_payment`. The `payment_succeeded` event maps `none → active` directly (line 67). The `checkout_completed` BillingEvent exists in the type union (line 32) and in the transition table (line 65) but is never emitted by the EVENT_MAP.
**Effect:** A user with no prior entitlement who completes checkout transitions directly to `active`, skipping `pending_payment`. For one-time and synchronous Stripe checkout this is correct behavior. However, if an asynchronous flow is ever needed (checkout completed but payment not yet captured), `checkout_completed → pending_payment` would be the correct path and would require a separate `invoice.paid` event to activate.
**Recommendation (Part 1):** The current mapping (`checkout.session.completed` → `payment_succeeded` → `none → active`) is acceptable for synchronous Stripe Checkout. Document explicitly in the route handler and the contract that this is a deliberate choice: Stripe's `checkout.session.completed` only fires after payment is confirmed, so `pending_payment` is skipped. If asynchronous checkout is needed in future, introduce a `checkout_initiated` event type and a separate webhook for payment confirmation.

### Finding 4 — HIGH — Missing events in EVENT_MAP: invoice.payment_action_required, charge.dispute.closed, customer.subscription.updated (Part 1)
**Evidence:** `packages/billing/src/webhook.ts:48–55` EVENT_MAP covers only 5 Stripe event types:
- `checkout.session.completed` → `payment_succeeded`
- `invoice.paid` → `payment_succeeded`
- `invoice.payment_failed` → `payment_failed`
- `customer.subscription.deleted` → `subscription_canceled`
- `charge.refunded` → `refunded`
- `charge.dispute.created` → `chargeback`

The contract at `docs/CONTRACTS/billing-webhooks.md:229–235` specifies additional events that must be handled:
- `invoice.payment_action_required` → `active → grace` (user notified to complete auth)
- `charge.dispute.closed` → `chargeback → expired` (won) or `chargeback → refunded` (lost)
- `customer.subscription.updated` → log change; no state transition

The state machine also requires `invoice.payment_action_required` to be handled as `payment_failed` (same as `invoice.payment_failed`). `charge.dispute.closed` requires two paths based on outcome in `data.object.status` (`won` vs `lost`).
**Recommendation (Part 1):** For the Part 1 route handler:
1. Map `invoice.payment_action_required` → `payment_failed` in EVENT_MAP or handle in the route handler before calling `applyStripeEvent`.
2. For `charge.dispute.closed`: parse `data.object.status`. If `won` → transition to `expired` via `subscription_canceled` event. If `lost` → transition to `refunded`. This logic belongs in the route handler (not the EVENT_MAP) because it requires reading the event object.
3. `customer.subscription.updated` → return HTTP 200 without calling `applyStripeEvent`; write a `billing.webhook_received_noop` audit entry.
4. Tests BW-011 and BW-012 from the contract are currently impossible to implement because the EVENT_MAP does not support `charge.dispute.closed`.

### Finding 5 — HIGH — Admin grant: no `reason` field, no `validUntil` input (Part 4)
**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx:14`:
```
await grantProduct(String(formData.get('userId')), String(formData.get('product')) as ProductCode);
```
`packages/db/src/repositories.ts:128`:
```
export async function grantProduct(db, userId, productCode, now = Date.now(), actorUserId?)
```
No `reason` parameter exists in `grantProduct`. No `validUntil` parameter exists. The form at page.tsx:54–60 has no `reason` text input and no `validUntil` date input. The audit_log at repositories.ts:150 hardcodes no reason field — the `auditRowValues` call has no `reason` key.

`docs/ENTITLEMENT_STATE_MACHINE.md:183` requires: "All manual grant/revoke/flag actions write a record to `audit_logs` with `actor_id`, `action`, `before_state`, `after_state`, `reason` (free text, required)..."
`docs/CONTRACTS/billing-webhooks.md:409-413` (Gap 1 and Gap 2) confirms this is a known P1 gap.
**Recommendation (Part 4):** Minimal landable improvements:
1. Add `reason: string` (required, non-empty) and `validUntil?: number` (optional epoch ms) parameters to `grantProduct` in `packages/db/src/repositories.ts`. Audit row must include `reason` in the `after` field.
2. `grantAction` server action: add `reason` form field (textarea, required, min 1 char). Zod-validate server-side: `z.string().min(1).max(500)`. Add optional `validUntil` date input. Pass both to `grantProduct`.
3. `revokeProduct` similarly: add `reason` parameter. The `revokeAction` server action must require it.
4. `grantManual` in `packages/entitlements/src/engine.ts:159` accepts `expiresAt?` already — pass it through from `grantProduct`.
5. The `grantProduct` upsert at repositories.ts:142 sets no `expiresAt`. When `validUntil` is provided, include it: `.values({ ..., expiresAt: validUntil ? new Date(validUntil) : null })`.

### Finding 6 — MEDIUM — No `manual_review` flag/resolve/approve/reject actions in admin UI (Part 4)
**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx` exposes only `grantAction` and `revokeAction`. No `flagReviewAction`, `approveReviewAction`, or `rejectReviewAction`. The entitlement state machine at `docs/ENTITLEMENT_STATE_MACHINE.md:52–53` specifies: "Admin clears manual_review (approve) → `active`; Admin clears manual_review (reject) → `revoked`."
The `flag_review` BillingEvent exists in state-machine.ts:40 and produces `manual_review` from any state. `applyBillingEvent` in engine.ts:203 handles it. But no route/action exists to trigger it.
**Recommendation (Part 4):** Add three server actions to the admin entitlements page:
- `flagReviewAction`: calls `applyBillingEvent(current, 'flag_review', now)` then persists via a new `flagProductForReview` repo function. Reason required.
- `approveReviewAction`: calls `grantProduct` (which transitions any state to `active` via `manual_grant`). Reason required.
- `rejectReviewAction`: calls `revokeProduct`. Reason required.
All three must have RBAC (`assertAdmin`) + CSRF inside the action.

### Finding 7 — MEDIUM — `listProductAccessEvents` not exposed in backend.ts or any web surface (Part 1, Part 4)
**Evidence:** `packages/db/src/repositories.ts:781–785` defines `listProductAccessEvents`. It is NOT exported from `apps/web/src/lib/backend.ts` (confirmed: no reference found). It is not imported in any web page.
The product-access timeline (billing history / state-transition log) required for `/app/billing` and `/admin/entitlements` has no UI surface. Contract at `docs/CONTRACTS/billing-webhooks.md:445` (Gap 5) identifies this as P1.
**Recommendation (Part 1/4):** Expose `listProductAccessEvents` via `apps/web/src/lib/backend.ts` (using `getServerDb()`). Add a product-access timeline view to `/app/billing` (user sees their own events) and to `/admin/entitlements` (admin sees per-user events). Shape defined in Decisions section.

### Finding 8 — MEDIUM — Pricing page copy claims mock checkout; real Stripe path visually absent (Part 1)
**Evidence:** `apps/web/src/app/(public)/pricing/page.tsx:13`: copy reads "Activate after creating your WTC account. (Mock checkout in this build.)" This is accurate for now but will be stale when Stripe is wired. The page has no price data (no dollar amounts, no billing periods) — only plan names, billing cadence pill, and product list. Plans include `bundle_starter` and `bundle_pro` which lack prices.
**Recommendation (Part 1):** In the Part 1 implementation, pricing page must:
1. Continue to render plan cards from the PLANS registry (no hardcoded prices since Stripe price IDs are not yet configured).
2. Replace "(Mock checkout in this build.)" with a conditional: dev → show mock warning banner; production without `STRIPE_SECRET_KEY` → show "Contact us to subscribe" fallback. Never show mock copy in production.
3. Future: when `STRIPE_PRICE_MAP` is populated, add price amounts to PlanDef or source them from a server-side call to the pricing registry.

### Finding 9 — MEDIUM — Billing page renders raw `evaluateStatus` status string in pill, not `reasonLabel` (Part 1)
**Evidence:** `apps/web/src/app/(app)/app/billing/page.tsx:49`:
```
<StatusPill tone={statusTone(eff)}>{eff}</StatusPill>
```
This renders the raw `EntitlementStatus` string (e.g. `"manual_review"`) instead of the human-readable reason label from `apps/web/src/lib/access.ts:reasonLabel`. The `explainAccess` reason taxonomy from `ENTITLEMENT_STATE_MACHINE.md §11` is not applied.
**Recommendation (Part 1):** Replace the billing page entitlement table to use `explainAccess` (or `accessFor`) for each entitlement, then render `reasonLabel(decision.reason)` and `reasonTone(decision.reason)`. The current `evaluateStatus` call is not wrong (it returns the correct status) but bypasses the standardized `AccessReason` → label/tone mapping that all product surfaces must use per ENTITLEMENT_STATE_MACHINE.md §13.

### Finding 10 — MEDIUM — Doc stale: PAYMENT_WEBHOOK_STATE_MACHINE.md §1 references old endpoint path (Part 0)
**Evidence:** `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:9` specifies endpoint as `POST /api/webhooks/billing/:provider`. `docs/CONTRACTS/billing-webhooks.md:54` updated this to the canonical unified path `POST /api/billing/webhook`. The PAYMENT_WEBHOOK_STATE_MACHINE.md has not been updated to reflect the canonical endpoint change.
**Recommendation (Part 0):** Update `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md §1` to read `POST /api/billing/webhook` and reference the billing-webhooks.md §3 note about the superseded per-provider paths.

### Finding 11 — LOW — `grantProduct` actorUserId not passed from admin action (Part 4)
**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx:14`:
```
await grantProduct(String(formData.get('userId')), String(formData.get('product')) as ProductCode);
```
The `actorUserId` parameter (5th arg of `grantProduct`) is not passed. The audit row at `repositories.ts:150` will have `actorUserId: null`. The admin who performed the grant is not recorded.
**Recommendation (Part 4):** Pass `actor.id` as the `actorUserId` argument: `await grantProduct(targetUserId, product, Date.now(), actor.id)`. Same fix for `revokeAction`.

### Finding 12 — LOW — `listSubscriptionsForUser` result not surfaced in `/app/billing` (Part 1)
**Evidence:** `packages/db/src/repositories.ts:896` defines `listSubscriptionsForUser` but it is not exported from `backend.ts` and not used in `billing/page.tsx`. The billing page only shows `entitlementsOf` output, not the underlying subscription rows (which carry `providerRef`, `provider`, and `currentPeriodEnd` from the subscriptions table).
**Recommendation (Part 1):** For the billing page, show subscription metadata alongside entitlements (provider name, providerRef masked to last 8 chars, currentPeriodEnd). Expose `listSubscriptionsForUser` from `backend.ts` using `getServerDb()`.

### Finding 13 — LOW — `stripe.test.ts` maps `checkout.session.completed` to `payment_succeeded` in the test, not to `checkout_completed` (Part 1, confirms Finding 3)
**Evidence:** `packages/billing/src/stripe.test.ts:54`:
```
expect(mapProviderEvent('checkout.session.completed')).toBe('payment_succeeded');
```
The test confirms the current mapping but tests for `checkout_completed` would need the event type that currently does not map. This is consistent with Finding 3 — the skip of `pending_payment` is tested and intentional.

---

## Decisions

### POST /api/billing/webhook — Exact Route Algorithm

**File to create:** `apps/web/src/app/api/billing/webhook/route.ts`

**Prerequisite: exclude from CSRF middleware.** In the Next.js middleware matcher configuration, add `/api/billing/webhook` to the exclusion list. The existing CSRF middleware must not intercept this route.

**Algorithm (pseudocode → TypeScript):**

```typescript
// apps/web/src/app/api/billing/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createBillingProvider } from '@wtc/billing';
import { mapProviderEvent } from '@wtc/billing';
import { isProductCode, expandPlan } from '@wtc/entitlements';
import { applyStripeEvent } from '@wtc/db';  // via getServerDb()
import { getServerDb } from '@/lib/backend';

// No `import 'server-only'` needed — route handlers are server-only by Next.js convention.
// CSRF: EXEMPT — signature is the auth. Do NOT call assertCsrf().
// Raw body: await req.text() — NEVER req.json() before verification.

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body as text (signature covers exact bytes).
  const rawBody = await req.text();

  // 2. Detect provider from signature header presence.
  const stripeHeader = req.headers.get('stripe-signature');
  // (crypto: x-nowpayments-sig / x-coingate-sig — not yet implemented, return 400 unknown_provider)

  if (!stripeHeader) {
    // No recognizable signature header → unknown provider.
    return NextResponse.json({ error: 'signature_invalid', message: 'Missing stripe-signature header' }, { status: 400 });
  }

  // 3. Verify signature FIRST — reject before reading any state from the body.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Misconfiguration — treat as 500 so provider retries (not a 400, not caller's fault).
    return NextResponse.json({ error: 'internal_error', message: 'Webhook processing failed.' }, { status: 500 });
  }

  const provider = createBillingProvider('stripe', webhookSecret);
  // parseWebhook calls verifyWebhookSignature internally (stripe.ts:49).
  // verifyWebhookSignature is at webhook.ts:17 — HMAC-SHA256, constant-time, 300s tolerance.
  const event = await provider.parseWebhook(rawBody, stripeHeader, Date.now());

  if (!event) {
    // Signature verification failed or body malformed after verification.
    return NextResponse.json({ error: 'signature_invalid', message: 'Webhook signature verification failed' }, { status: 400 });
  }

  // 4. Route by event type.
  const db = getServerDb();
  if (!db) {
    // Dev mode with no DB: acknowledge without processing (demo path).
    return NextResponse.json({ received: true });
  }

  // 4a. Map provider event type to BillingEvent.
  const billingEvent = mapProviderEvent(event.type);

  if (!billingEvent) {
    // Unknown event type: acknowledge (HTTP 200), no state change.
    // Do NOT call applyStripeEvent — no audit write for unhandled types.
    return NextResponse.json({ received: true });
  }

  // 4b. Resolve userId — MUST be present for state transitions.
  const userId = event.userId;
  if (!userId) {
    // Missing wtc_user_id: no auto-grant; transition to manual_review via admin notification.
    // For Part 1 minimum: write an audit row and return 200 (idempotent acknowledgement).
    // Full manual_review path is a follow-on task (see Risks).
    // TODO Part 1: insert audit row with action='billing.webhook_unresolvable_user', trigger admin notification.
    return NextResponse.json({ received: true });
  }

  // 4c. Resolve product codes from planCode.
  const planCode = event.planCode;
  let productCodes: string[] = [];
  if (planCode) {
    productCodes = expandPlan(planCode);  // registry.ts:70 — returns [] for unknown plan (fail closed)
  }
  if (productCodes.length === 0 && planCode) {
    // Unknown plan code: manual_review path (same as missing userId).
    // TODO Part 1: audit + admin notification.
    return NextResponse.json({ received: true });
  }

  // 4d. Apply event idempotently. applyStripeEvent handles:
  //   - Idempotency check: audit_logs ledger (repositories.ts:909)
  //   - Entitlement upsert + product_access_events write in one transaction (repositories.ts:908–931)
  //   - manual_override precedence: applyBillingEvent in engine.ts:204 skips billing events when manualOverride=true
  try {
    const result = await applyStripeEvent(db, {
      stripeEventId: event.id,
      billingEvent,
      userId,
      productCodes: productCodes.filter(isProductCode),
      planCode: planCode ?? undefined,
    });
    // result.applied === false → duplicate event, idempotent no-op.
    // result.productsChanged === 0 → manual_override preserved; state unchanged.
    return NextResponse.json({ received: true });
  } catch (err) {
    // Transient DB error: HTTP 500 so provider retries.
    // Idempotency key NOT stored (applyStripeEvent threw before commit).
    console.error('[billing/webhook] DB error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'internal_error', message: 'Webhook processing failed. Event will be retried.' }, { status: 500 });
  }
}
```

**Key verified references:**
- `verifyWebhookSignature` location: `packages/billing/src/webhook.ts:17` — HMAC-SHA256 via `node:crypto`, constant-time comparison, 300s clock tolerance, no network call.
- `parseWebhook` calls `verifyWebhookSignature` at `packages/billing/src/stripe.ts:49` — signature check is the first operation before JSON.parse.
- Idempotency mechanism: `packages/db/src/repositories.ts:909–910` — SELECT on `audit_logs` where `action='billing.webhook_received'` and `targetId=stripeEventId`. If row exists, returns `{applied:false}`. No separate table.
- `product_access_events` written in same transaction: `repositories.ts:926`.
- `createBillingProvider('mock', ...)` throws in production: `packages/billing/src/provider.ts:38–40`.

### Covered Stripe Events vs. Gaps

| Stripe Event | EVENT_MAP Entry | BillingEvent | State Transition | Handled? |
|---|---|---|---|---|
| `checkout.session.completed` | `payment_succeeded` | `payment_succeeded` | `none/expired/revoked/refunded/chargeback → active` | YES (via EVENT_MAP) |
| `invoice.paid` | `payment_succeeded` | `payment_succeeded` | `active/grace/expired → active` | YES (via EVENT_MAP) |
| `invoice.payment_failed` | `payment_failed` | `payment_failed` | `active → grace`, `pending_payment → expired` | YES (via EVENT_MAP) |
| `customer.subscription.deleted` | `subscription_canceled` | `subscription_canceled` | `active/grace → grace/expired` | YES (via EVENT_MAP) |
| `charge.refunded` | `refunded` | `refunded` | any → `refunded` | YES (via EVENT_MAP) |
| `charge.dispute.created` | `chargeback` | `chargeback` | any non-terminal → `chargeback` | YES (via EVENT_MAP) |
| `invoice.payment_action_required` | NOT IN MAP | would be `payment_failed` | `active → grace` | GAP — add to EVENT_MAP |
| `charge.dispute.closed` | NOT IN MAP | `subscription_canceled` (won) / `refunded` (lost) | `chargeback → expired` or `chargeback → refunded` | GAP — route-handler logic needed (depends on `data.object.status`) |
| `customer.subscription.updated` | NOT IN MAP | no-op | log only | NO-OP — acknowledged, no state change |

**Already-handled vs gaps:** 6 event types covered; 2 gaps (`invoice.payment_action_required`, `charge.dispute.closed`) require Part 1 implementation; 1 no-op (`customer.subscription.updated`).

**Note on `checkout.session.completed` → `payment_succeeded` skip of `pending_payment`:** intentional. Stripe only fires `checkout.session.completed` after payment is confirmed for standard checkout. The `checkout_completed` BillingEvent (which would create `pending_payment`) is not used by the Stripe provider. This is correct for synchronous checkout and is tested at `stripe.test.ts:36–44`.

### Required Tests — BW test list

The following tests (from billing-webhooks.md §13) directly map to code paths audited:

| Test | Mechanism | Where to write |
|---|---|---|
| BW-001 valid checkout.session.completed → HTTP 200 + active | `applyStripeEvent` path, `createMockBillingProvider.forgeWebhook` | `apps/web/src/app/api/billing/webhook/route.test.ts` (integration, uses mock provider) |
| BW-002 missing stripe-signature → HTTP 400 | Route returns 400 when `stripeHeader` is null | Same file, unit |
| BW-003 tampered body → HTTP 400 | `parseWebhook` returns null → route returns 400 | Same file, unit |
| BW-004 duplicate event.id → HTTP 200, no state change | `applyStripeEvent` returns `{applied:false}` | Same file, unit with spy on applyStripeEvent |
| BW-015 missing wtc_user_id → manual_review | Route detects `!userId` → acknowledged 200 + audit TODO | Same file, unit |

Additional tests already partially covered by `stripe.test.ts` (tampered body, wrong secret, out-of-tolerance timestamp). The route-level tests must use `createMockBillingProvider.forgeWebhook` to produce valid test payloads without hitting Stripe.

### /pricing Page Data Contract (Part 1)

Current state (`pricing/page.tsx`): static plan cards from PLANS registry, no prices, no user context, CTA links to `/register`. This is correct for an unauthed public page.

Required additions for Part 1:
1. **Plan prices:** the PLANS registry has no pricing data. Until `STRIPE_PRICE_MAP` is populated, render pricing as "Contact us" or omit prices. Do NOT hardcode placeholder prices.
2. **User entitlement overlay:** if user is authenticated (session optional), show whether they already own each product (`accessFor` per product → `reason`). Existing owners see "Active" badge instead of "Get started."
3. **Mock checkout warning:** dev banner (`assertNotProduction`-guarded) visible only in dev. In production: no mock copy visible.

Data sources:
- Plan + product data: `PLANS`, `PRODUCTS` from `@wtc/entitlements` (already used)
- User entitlements (optional): `entitlementsOf(userId)` + `explainAccess` per plan's products
- No DB call for anonymous visitors

### /app/billing Page Data Contract (Part 1)

Current state (`billing/page.tsx`): shows entitlements table (product, plan, raw evaluateStatus, expiresAt) + mock checkout buttons (assertNotProduction guarded).

Required additions for Part 1:
1. **Replace raw `evaluateStatus` with `explainAccess`:** render `reasonLabel(decision.reason)` in the status pill and use `reasonTone` for color. This aligns with ENTITLEMENT_STATE_MACHINE.md §13 and finding 9.
2. **Subscription metadata:** call `listSubscriptionsForUser` (expose in backend.ts) and show provider, providerRef (masked: last 8 chars), currentPeriodEnd alongside each entitlement.
3. **Product-access timeline:** call `listProductAccessEvents(db, user.id, { limit: 50 })` and render a chronological list below the entitlements table. Shape:

```typescript
// ProductAccessTimelineRow — derived from ProductAccessEventRow
interface ProductAccessTimelineRow {
  id: string;
  productCode: string;
  productName: string;    // from PRODUCTS registry
  fromState: string;
  toState: string;
  reason: string;         // 'manual_grant' | 'manual_revoke' | 'payment_succeeded' | etc.
  actorType: string;      // 'admin' | 'system' | 'billing_webhook'
  createdAt: number;      // epoch ms
}
```

Render as a compact table: Date | Product | From → To | Reason | Actor. Admins see all users' events on `/admin/entitlements`; users see only their own on `/app/billing`.

4. **Mock checkout section:** retain existing mock buttons but wrap in a `RiskWarningBanner` labelled "(DEV ONLY — disabled in production)" with `severity="warning"`. Already present at line 33–35, confirm assertNotProduction is in the server action (it is: line 12).

### Admin Grant/Revoke Minimal Landable Improvements (Part 4)

**Priority P1 changes (required before production):**

Change 1 — Add `reason` parameter to `grantProduct` and `revokeProduct` in `packages/db/src/repositories.ts`:
```typescript
// grantProduct signature change:
export async function grantProduct(
  db: Db, userId: string, productCode: ProductCode,
  now = Date.now(), actorUserId?: string, reason?: string, validUntil?: number
): Promise<void>
// Audit row: after: { status: e.status, reason: reason ?? 'no reason provided' }
// Entitlement values: expiresAt: validUntil ? new Date(validUntil) : undefined
```

Change 2 — Server action in admin entitlements page:
```typescript
async function grantAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);
  const reason = z.string().min(1).max(500).parse(formData.get('reason'));
  const validUntilRaw = formData.get('validUntil');
  const validUntil = validUntilRaw ? new Date(String(validUntilRaw)).getTime() : undefined;
  await grantProduct(String(formData.get('userId')), String(formData.get('product')) as ProductCode, Date.now(), actor.id, reason, validUntil);
  revalidatePath('/admin/entitlements');
}
```

Change 3 — Form additions to admin entitlements page:
```jsx
<form action={grantAction} className="wtc-stack">
  <CsrfField />
  <input type="hidden" name="userId" value={u.id} />
  <select className="wtc-input" name="product">{/* ... */}</select>
  <textarea className="wtc-input" name="reason" placeholder="Reason (required)" required minLength={1} maxLength={500} />
  <input type="date" className="wtc-input" name="validUntil" placeholder="Valid until (optional)" />
  <button className={buttonClasses('secondary')} type="submit">Grant</button>
</form>
```

**Priority P2 changes (manual_review flag/resolve):**
Add `flagReviewAction`, `approveReviewAction`, `rejectReviewAction` server actions. Each requires `reason` (non-empty). Flagging calls `applyBillingEvent(ent, 'flag_review', now)` + persists. Approving calls `grantProduct`. Rejecting calls `revokeProduct`. All three must have RBAC + CSRF inside the action.

---

## Risks

1. **BW-015 (missing userId → manual_review) is not fully implemented in the route spec above** — the TODO comment acknowledges the audit write and admin notification are deferred. For Part 1, the route must at minimum: write an audit row with action `billing.webhook_unresolvable_user`, targetId = event.id, and create a notification for admin users. A full `manual_review` entitlement write is not possible without a userId to attach it to; the event must be flagged for manual admin inspection.

2. **`charge.dispute.closed` requires reading `data.object.status`** from the raw Stripe event to determine won vs lost. The current `NormalizedEvent` interface at `packages/billing/src/provider.ts:16` carries `raw: unknown` which can be inspected in the route handler. The implementer must cast and validate `(event.raw as StripeEvent).data.object.status` with Zod before routing.

3. **`webhook_idempotency_keys` table is referenced in two canonical docs** but does not exist. Any implementer reading the docs may create it in a new migration. The Part 0 doc fix (Finding 2) is essential to prevent this.

4. **No rate limiting in Next.js route handler** — the contract (billing-webhooks.md §10) places rate limiting at nginx. If nginx is not configured with Stripe IP allowlist and 300 req/min limit before Part 1 ships, the route is exposed to burst replay attacks. This is an infrastructure dependency, not a code dependency.

5. **`grantProduct` and `revokeProduct` in `backend.ts`** re-export from `core` (memory or db-store). The `actorUserId` parameter must be threaded through `db-store.ts` if the backend uses the DB path. Confirm that `apps/web/src/lib/db-store.ts` forwards `actorUserId` to the underlying `packages/db/src/repositories.ts:grantProduct`.

6. **Bundle plan webhook handling** — `expandPlan('bundle_pro')` returns 4 product codes. `applyStripeEvent` loops over `productCodes` and applies the same BillingEvent to each. For BW-018 (bundle paid → all members active atomically), this is already handled by the existing `applyStripeEvent` transaction loop at repositories.ts:913–928. No additional code needed for Part 1 bundle support.

---

## Verification/tests

No tests run (read-only audit wave). Gate status not checked.

Test list for Part 1 implementation (to be written by the implementer):

| Test ID | Description | File |
|---|---|---|
| BW-002 | `POST /api/billing/webhook` with no `stripe-signature` header → HTTP 400, `{error:'signature_invalid'}` | `route.test.ts` |
| BW-003 | Tampered body (valid sig for original body, body modified) → HTTP 400 | `route.test.ts` |
| BW-001 | Valid `checkout.session.completed` with mock-forged sig → HTTP 200, entitlement `active`, `product_access_events` row written | `route.test.ts` (integration, mock provider) |
| BW-004 | Duplicate `event.id` → second call: HTTP 200, `applyStripeEvent` returns `{applied:false}`, no second state write | `route.test.ts` |
| BW-015 | Valid sig, missing `userId` in metadata → HTTP 200, no entitlement written, audit log written | `route.test.ts` |
| BW-006 | `invoice.payment_failed` → active → grace | `applyStripeEvent.test.ts` (repo unit) |
| BW-007 | `customer.subscription.deleted` → active → expired | `applyStripeEvent.test.ts` |
| BW-008 | `charge.refunded` → active → refunded | `applyStripeEvent.test.ts` |
| BW-010 | `charge.dispute.created` → active → chargeback | `applyStripeEvent.test.ts` |

For admin grant/revoke (Part 4):
- Server action with empty `reason` → validation throws, no DB write.
- Server action with `validUntil` in past → entitlement created but immediately `expired` on first reconcile (document this behavior; optionally validate server-side that validUntil > now).
- Admin without `assertAdmin` role → throws before DB write.

---

## Next actions

1. **(Part 0 — immediate, doc-only):** Update `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md §1` endpoint path. Update `docs/CONTRACTS/billing-webhooks.md §7` idempotency store description to reflect audit_logs ledger. Both are doc-only changes (no code, no migration).

2. **(Part 1 — new file):** Create `apps/web/src/app/api/billing/webhook/route.ts` per the exact algorithm in Decisions. Ensure middleware matcher excludes this path from CSRF. Do NOT use `req.json()` — use `await req.text()`.

3. **(Part 1 — EVENT_MAP gap):** Add `invoice.payment_action_required` to `packages/billing/src/webhook.ts` EVENT_MAP mapping to `payment_failed`. Handle `charge.dispute.closed` in the route handler (not the EVENT_MAP) with won/lost branching.

4. **(Part 1 — backend.ts):** Export `listProductAccessEvents` and `listSubscriptionsForUser` from `apps/web/src/lib/backend.ts` via `getServerDb()`.

5. **(Part 1 — billing page):** Replace `evaluateStatus` + raw status pill with `explainAccess` + `reasonLabel`/`reasonTone`. Add subscription metadata section. Add product-access timeline table from `listProductAccessEvents`.

6. **(Part 4 — admin entitlements):** Add `reason` (required textarea) and `validUntil` (optional date) to both grant and revoke forms and server actions. Thread `actorUserId` through all calls. Add `flagReview`/`approveReview`/`rejectReview` actions (P2).

7. **(Part 6 — tests):** Write `route.test.ts` covering BW-001 through BW-004 and BW-015. Write `applyStripeEvent.test.ts` covering BW-006 through BW-008 and BW-010.
