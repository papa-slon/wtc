# ecosystem-billing-access-auditor handoff

## Scope

Phase 2.1 — Epoch 20260530-0925. Verification audit for the @wtc/billing StripeAdapter
contract, product_access_events transactional logging, webhook route safety model,
ProductAccessView display model, and the billing test matrix. Read-only; no code was
changed this wave.

This handoff supersedes any informal notes in the Phase 2 design wave
(20260530-0126-ecosystem-billing-access-auditor.md) for the specific Phase 2.1 scope items.
The Phase 2 design decisions remain in force; this wave audits current code against them.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-billing-access-auditor.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `packages/billing/src/provider.ts`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/index.ts`
- `packages/billing/src/__smoke__.ts`
- `packages/billing/src/provider.test.ts`
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/entitlements/src/registry.ts`
- `packages/entitlements/src/engine.test.ts`
- `packages/entitlements/src/__smoke__.ts`
- `packages/db/src/repositories.ts`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/api/billing/webhook/route.ts` (confirmed absent)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### F1 — StripeAdapter contract: HMAC scheme is correct but Stripe SDK path is still a stub (Severity: P1)

**Evidence:** `packages/billing/src/webhook.ts:1-65` implements HMAC-SHA256 signature
verification with the Stripe-style `t=<ts>,v1=<sig>` header format, 300-second clock
tolerance (`toleranceSec ?? 300`), and constant-time comparison via `timingSafeEqual`.
`packages/billing/src/provider.ts:68-71` — `createBillingProvider('stripe', ...)` throws
`Error: billing provider "stripe" is not implemented yet`.

The HMAC scheme implemented in `webhook.ts` is structurally correct (same signed-payload
format as `stripe.webhooks.constructEvent` uses internally: `${ts}.${rawBody}`). However
the Stripe SDK itself (`stripe.webhooks.constructEvent`) is not wired. The mock provider
uses this hand-rolled HMAC, which is correct for testing, but the production StripeAdapter
that wraps the real SDK does not exist.

**Recommendation:** The operator must create
`packages/billing/src/providers/stripe.ts` implementing `BillingProvider`. Its
`handleWebhook` must call `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
as specified in `BILLING_PROVIDER_PLAN.md §2` and `PAYMENT_WEBHOOK_STATE_MACHINE.md §2`.
The hand-rolled HMAC in `webhook.ts` is retained as the mock/test utility; it must not
substitute for the SDK call in the Stripe adapter. The guard `if (!STRIPE_SECRET_KEY)
throw new Error('STRIPE_SECRET_KEY not configured')` must be the first statement in
`stripe.ts` constructor, so no live network call is possible without explicit configuration.

### F2 — BillingEvent type gap: `checkout_completed` vs `checkout.session.completed` mapping (Severity: P1)

**Evidence:** `packages/billing/src/webhook.ts:48-55` — `EVENT_MAP` maps Stripe event type
strings to `BillingEvent` values from `@wtc/entitlements`. The mapping is:

```
'checkout.session.completed' → 'payment_succeeded'
'invoice.paid'               → 'payment_succeeded'
'invoice.payment_failed'     → 'payment_failed'
'customer.subscription.deleted' → 'subscription_canceled'
'charge.refunded'            → 'refunded'
'charge.dispute.created'     → 'chargeback'
```

`packages/entitlements/src/state-machine.ts:29-40` defines `BillingEvent` as a union
that includes `checkout_completed` as a distinct value. However `EVENT_MAP` routes
`checkout.session.completed` to `payment_succeeded`, not `checkout_completed`. This is
intentionally collapsing two different Stripe triggers to a single semantic event, which
is pragmatically correct (both result in `active` entitlement from `pending_payment`).
However the state machine explicitly has a `none → pending_payment` transition for
`checkout_completed` (checkout started, not yet paid), and `state-machine.ts:65-68`
shows `none + checkout_completed → pending_payment`. The collapse means `checkout.session.completed`
activates directly from `pending_payment → active` via `payment_succeeded`, which is
correct — but the `checkout_completed` event type is never triggered by the Stripe adapter
path, making the `none → pending_payment` path only reachable via internal app code
(when the user initiates checkout, before the webhook arrives). This is correct design,
but must be documented explicitly so implementers do not mistakenly route the Stripe
`checkout.session.completed` webhook through `checkout_completed` instead.

**Recommendation:** Add a comment in `webhook.ts` EVENT_MAP clarifying that
`checkout.session.completed` is intentionally mapped to `payment_succeeded` (not
`checkout_completed`), because by the time this webhook arrives, the entitlement is
already in `pending_payment` state (set when the user was redirected to Stripe), so the
correct transition is `pending_payment → active`. The `checkout_completed` BillingEvent
is reserved for the moment the user is redirected to the provider — used internally
by `createCheckout` callers, not by the webhook handler. Without this comment, a future
implementer may introduce a bug by adding `'checkout.session.completed' → 'checkout_completed'`.

### F3 — Missing event mappings: `charge.dispute.closed`, `charge.refunded` partial, `invoice.payment_action_required` (Severity: P1)

**Evidence:** `packages/billing/src/webhook.ts:48-55` — `EVENT_MAP` covers 6 Stripe event
types. `BILLING_PROVIDER_PLAN.md §2` and `CONTRACTS/billing-webhooks.md §8` require handlers
for:

- `charge.dispute.closed` (BW-011, BW-012) → `chargeback → expired` (won) or
  `chargeback → refunded` (lost). The `dispute.closed` outcome requires reading the
  `event.data.object.status` field (`won` / `lost`) to pick the correct transition; there
  is no single `BillingEvent` that covers both. Currently absent from `EVENT_MAP`.
- `charge.refunded` partial vs full: the current mapping sends ALL `charge.refunded`
  events to `'refunded'` BillingEvent, but partial refunds must transition to
  `manual_review` not `refunded`. The distinction requires reading the event object
  (compare `amount_refunded` vs `amount`). Currently there is no partial-refund branch.
- `invoice.payment_action_required` (BW-006 equivalent) → `active → grace`, same as
  `invoice.payment_failed`. Currently absent.
- `invoice.paid` for renewal: currently correctly mapped to `payment_succeeded`. The
  `grace → active` late-renewal case is handled by `state-machine.ts:75` (grace +
  payment_succeeded → active). Correct.

**Recommendation:** The StripeAdapter's `handleWebhook` must not use `EVENT_MAP` as-is
for production. It must branch on event content in addition to type:

1. For `charge.refunded`: read `event.data.object.amount_refunded` vs
   `event.data.object.amount`. Full refund (equal amounts) → `refunded` BillingEvent.
   Partial refund → `flag_review` BillingEvent. Both paths exist in `state-machine.ts`.

2. For `charge.dispute.closed`: read `event.data.object.status`. `'won'` → transition
   `chargeback → expired`. `'lost'` → transition `chargeback → refunded`. The StripeAdapter
   must emit the correct `BillingEvent` for each branch, not rely on a single
   `EVENT_MAP` lookup.

3. Add `'invoice.payment_action_required'` to `EVENT_MAP` mapped to `'payment_failed'`
   (same effect: start grace countdown).

The `EVENT_MAP` in `webhook.ts` is adequate for the mock provider and unit tests but must
be augmented with event-object inspection in the real StripeAdapter.

### F4 — `product_access_events` row: NOT written by current `grantProduct`/`revokeProduct` (Severity: P1)

**Evidence:** `packages/db/src/repositories.ts:127-155` — `grantProduct` (line 127) and
`revokeProduct` (line 147) each open a DB transaction and write an `audit_logs` row inside
it (lines 143, 153). Neither function calls `recordProductAccessEvent` or inserts into
`product_access_events`. The table does not yet exist in the schema (it is designed in
`docs/handoffs/20260530-0126-ecosystem-db-architect.md` as REAL-in-0002 but not yet
migrated). The db-architect handoff (§Decisions 7) states: "`product_access_events` is
written inside the same transaction as `grantProduct`/`revokeProduct` alongside the
existing `audit_logs` insert."

This is a known gap carried from the Phase 2 design wave (F5 in the prior handoff). It is
elevated here because it affects the StripeAdapter's `applyStripeEvent` path as well:
any billing-webhook-driven transition must also write a `product_access_events` row.

**Recommendation:** When migration 0002 lands `product_access_events`, the Wave-2
implementer must update `grantProduct`, `revokeProduct`, and the new `applyStripeEvent`
function to insert a `product_access_events` row in the same transaction. The row must
capture `entitlement_id`, `user_id`, `product_code`, `from_state`, `to_state`,
`reason` (free text or null), `actor_id` (admin UUID or null for system), and
`actor_type` (`'admin'`, `'system'`, or `'billing_webhook'`).

### F5 — Webhook route `apps/web/src/app/api/billing/webhook/route.ts` does not exist (Severity: P1 — expected)

**Evidence:** `apps/web/src/app/api/**` glob returned no files. The directory
`apps/web/src/app/api/` does not exist. This was also Finding F6 in the prior audit
(20260530-0126) and is documented as expected for a design wave.

**Status:** Remains a TARGET for the implementation agent. The contract is fully specified
in `PAYMENT_WEBHOOK_STATE_MACHINE.md §10` and `CONTRACTS/billing-webhooks.md §3`. No
production webhooks can be received until this file is created.

**Recommendation:** See the route handler contract in the Decisions section below. The
handler must be created before any Stripe Dashboard webhook endpoint is configured.
Until it exists, the platform cannot process any real payment events.

### F6 — `applyStripeEvent` idempotency is in-memory only (Severity: P1)

**Evidence:** `packages/billing/src/webhook.ts:67-69` — `isDuplicate(seen: Set<string>, key)`:
the idempotency store is a plain `Set<string>` passed by the caller. `__smoke__.ts:29-32`
demonstrates correct usage of `seen` as an in-memory set. `CONTRACTS/billing-webhooks.md §7`
and `PAYMENT_WEBHOOK_STATE_MACHINE.md §3` specify a PostgreSQL-backed
`webhook_idempotency_keys` table with 90-day TTL and a `result_status` column.

The current mock-provider path exercises the idempotency interface correctly in the
abstract: `dedupeKey` produces the right key format (`provider:eventId`), and
`isDuplicate` is a pure predicate. However the `IdempotencyStore` interface
(`BILLING_PROVIDER_PLAN.md §1`) — with async `has()` and `set()` — is not implemented
in `packages/billing`. The `BillingProvider.handleWebhook` interface (same doc) accepts
an `IdempotencyStore` as a parameter, but the concrete mock provider's `parseWebhook`
method does not accept or use an `IdempotencyStore` parameter at all.

**Recommendation:** The mock provider's `parseWebhook` and the forthcoming Stripe adapter's
`handleWebhook` must accept an `IdempotencyStore` parameter. The webhook route handler must
pass a DB-backed implementation that inserts to `webhook_idempotency_keys` on success and
does NOT insert on error (so retries are processed again). The in-process `Set<string>` may
be used in unit tests via a `MemoryIdempotencyStore` adapter.

### F7 — `grantProduct`/`revokeProduct` do not accept `reason` or `validUntil` (Severity: P1 — carried)

**Evidence:** `packages/db/src/repositories.ts:127` — `grantProduct(db, userId, productCode, now = Date.now())`:
no `reason` parameter. Line 143: `audit_logs` insert passes `after: { status: e.status }`
with no `reason` field. `ENTITLEMENT_STATE_MACHINE.md §9` requires `reason TEXT NOT NULL`
in all audit log entries for manual actions, and the audit schema specifies it is rejected
if empty. `apps/web/src/lib/db-store.ts:93-95` — `grantProduct(userId, productCode)` passes
through with no reason parameter.

**Recommendation:** `grantProduct` must accept `reason: string` (required for production)
and `validUntil: number | null` (optional). Both must be threaded into the `audit_logs`
insert and into the `entitlements` upsert respectively. Empty `reason` must be rejected
server-side before reaching the repository layer. This was F2 and F3 in the prior handoff
and remains unresolved.

### F8 — MockBillingAdapter production guard is correct (Severity: INFO — confirmed)

**Evidence:** `packages/billing/src/provider.ts:37-39` — `if (process.env.NODE_ENV === 'production') throw new Error('mock billing provider is disabled in production ...')`.
`provider.test.ts:15-18` — Vitest test confirms the throw in production mode.
`__smoke__.ts:36-43` — smoke test confirms forge → parse → map round-trip.

The mock provider is correctly labeled dev-only and cannot be activated in production.
The guard is at the provider-selection level (`createMockBillingProvider`), not just
at the route level, which is correct defense-in-depth. The mock checkout warning text
requirement (the button label must include "dev" or "mock") is documented in
`BILLING_PROVIDER_PLAN.md §10 Key display rules rule 6` and must be enforced at the
UI level during implementation.

**No action required** for this finding. Confirmed compliant.

### F9 — `reconcileAllEntitlements` does not write `product_access_events` or `audit_logs` (Severity: P2)

**Evidence:** `packages/db/src/repositories.ts:371-383` — `reconcileAllEntitlements` updates
`entitlements.status` when time-drift is detected (active → grace → expired), but writes
no `audit_logs` row and will not write a `product_access_events` row. The state machine
spec (§2) lists `valid_until timestamp passes (worker job) → grace` and `grace window passes → expired`
as explicit state transitions. The audit schema (§9) lists `action: 'expire'` for these
system-driven transitions with `actor_type: 'system'`.

**Recommendation:** `reconcileAllEntitlements` must write an `audit_logs` row with
`actor_type = 'system'`, `action = 'expire'`, `before_state`, `after_state`, and a
`product_access_events` row for each changed row. The current loop already detects the
change (`next.status !== ent.status`); adding the two inserts inside the update call is
straightforward. The audit row for expiry transitions is low-friction (no admin actor,
no reason required) but must be present for dispute resolution.

### F10 — No `upsertSubscription` or `applyStripeEvent` function exists in `packages/db` (Severity: P1)

**Evidence:** `packages/db/src/repositories.ts` — full file read. No `upsertSubscription`
or `applyStripeEvent` function is present. The db-architect handoff (20260530-0126) specifies
`recordProductAccessEvent` as a Wave-2 repo function but does not specify a dedicated
`applyStripeEvent` function in `packages/db`. The Phase 2.1 task prompt names
`upsertSubscription` and `applyStripeEvent` as specific Billing repo functions. These do not
exist anywhere in `packages/billing` or `packages/db`.

The current flow for billing-webhook-driven entitlement updates is:
`BillingProvider.handleWebhook → EntitlementTransition[] → packages/entitlements.syncBillingState`.
The `syncBillingState` function is documented in `BILLING_PROVIDER_PLAN.md §7` but is also
not yet implemented in `packages/entitlements/src/` (no such export exists in `engine.ts`
or `index.ts`).

**Recommendation:** The implementation agent must add to `packages/entitlements`:
`syncBillingState(transitions: EntitlementTransition[]): Promise<void>` — this is the
function the webhook route handler calls. It must open a DB transaction, apply each
transition via `applyBillingEvent`, write a `product_access_events` row, write an
`audit_logs` row (actor_type = 'billing_webhook', billing_event_id from the transition),
and commit. The DB repository function `applyStripeEvent` (if used as an atomic wrapper)
belongs in `packages/db/src/repositories.ts` alongside `grantProduct`/`revokeProduct`.
The idempotency key write (`webhook_idempotency_keys` INSERT) must occur in the same
or a chained transaction that only commits if the entitlement write committed.

---

## Decisions

### D1 — StripeAdapter contract (canonical)

The operator must implement `packages/billing/src/providers/stripe.ts` satisfying:

**Signature verification (MUST be first, before any state touch):**

```
rawBody: Buffer  (never parse JSON before this step)
sig = headers['stripe-signature']
if (!sig) → throw WebhookSignatureError('Missing stripe-signature header')
event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  on StripeSignatureVerificationError → throw WebhookSignatureError
```

The Stripe SDK enforces a 300-second clock tolerance internally. Do not disable or extend
this tolerance. The raw body must reach `constructEvent` as the exact bytes from the HTTP
request. No intermediate JSON parse or re-serialize is permitted before signature
verification.

**Guard against unconfigured live keys:**

```
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('StripeAdapter: STRIPE_SECRET_KEY is not configured — live Stripe calls disabled');
}
```

This guard must execute in the constructor/factory, not lazily, so the application fails
loudly at startup rather than at first webhook. No network call to Stripe is ever made
unless `STRIPE_SECRET_KEY` is set.

**Idempotency (applyStripeEvent semantics):**

```
key = `stripe:${event.id}`
if (await idempotencyStore.has(key)) return { applied: false }
// ... apply transitions ...
await idempotencyStore.set(key, 90 * 24 * 3600)
return { applied: true, transitions }
```

On processing error, the idempotency key is NOT written, allowing provider retry. On DB
error, return HTTP 500 (provider retries). Only after the entitlement transaction commits
does the idempotency key write execute. Both writes (entitlement + idempotency key) should
be in the same DB transaction or a sequential pair where the key write is committed last.

**Event-type to entitlement-state mapping (complete):**

| Stripe Event Type | Condition | BillingEvent | From → To |
|---|---|---|---|
| `checkout.session.completed` | — | `payment_succeeded` | `pending_payment → active` |
| `invoice.paid` | — | `payment_succeeded` | `active/grace/expired → active` |
| `invoice.payment_failed` | — | `payment_failed` | `active → grace` |
| `invoice.payment_action_required` | — | `payment_failed` | `active → grace` |
| `customer.subscription.deleted` | `cancel_at_period_end=false` | `subscription_canceled` | `active/grace → expired` |
| `customer.subscription.deleted` | `cancel_at_period_end=true` | no-op (worker handles) | unchanged |
| `charge.refunded` | full (`amount_refunded === amount`) | `refunded` | `active/grace/expired → refunded` |
| `charge.refunded` | partial (`amount_refunded < amount`) | `flag_review` | any → `manual_review` |
| `charge.dispute.created` | — | `chargeback` | any non-terminal → `chargeback` |
| `charge.dispute.closed` | `status === 'won'` | (direct DB write) | `chargeback → expired` |
| `charge.dispute.closed` | `status === 'lost'` | `refunded` | `chargeback → refunded` |
| all other types | — | no-op | unchanged; HTTP 200, log |

`checkout.session.completed` is intentionally mapped to `payment_succeeded` (not
`checkout_completed`). By the time this webhook arrives, the entitlement row is already in
`pending_payment` (written at redirect time). The correct transition is
`pending_payment + payment_succeeded → active`. The `checkout_completed` BillingEvent
is for internal use only (written by `createCheckout` callers when the user is redirected).

**Missing `wtc_user_id` in metadata:** if `event.data.object.metadata.wtc_user_id` is
absent on any payment/subscription event, the handler must NOT guess. It must transition
to `manual_review`, write an admin alert to `audit_logs`, and return HTTP 200 (not 500),
because the event was received and understood — it simply cannot be auto-applied.

**Bundle expansion:** when `wtc_product_code` is comma-joined (e.g., `tortila_bot,education`),
the handler must call `expandPlan(planCode)` from `@wtc/entitlements/registry` to get
the correct member product list, then apply the transition to each member entitlement
atomically in a single transaction.

**No live Stripe API call unless `STRIPE_SECRET_KEY` is set.** The mock provider remains
the only active billing path when `BILLING_PROVIDER=mock` or when `STRIPE_SECRET_KEY` is
absent.

### D2 — Transactional audit requirement (every grant/revoke/applyStripeEvent)

Every entitlement state transition must write BOTH a `product_access_events` row AND an
`audit_logs` row in the SAME database transaction. The transaction structure is:

```
BEGIN
  UPDATE entitlements SET status = <new>, updated_at = NOW() WHERE id = <eid>
  INSERT INTO product_access_events (entitlement_id, user_id, product_code,
    from_state, to_state, reason, actor_id, actor_type, created_at)
    VALUES (...)
  INSERT INTO audit_logs (actor_type, actor_id, action, before_state, after_state,
    reason, billing_event_id, product_code, plan_code, ...)
    VALUES (...)
COMMIT
```

If the transaction fails at any step, it rolls back entirely. The `product_access_events`
row and the `audit_logs` row must never exist without the corresponding `entitlements`
update (and vice versa). This is the existing pattern in `grantProduct`/`revokeProduct`
(`repositories.ts:129-144`) — audit row already in-txn. The missing piece is adding the
`product_access_events` insert alongside it.

For webhook-driven transitions, `actor_type = 'billing_webhook'` and `actor_id = NULL`.
The `billing_event_id` field in `audit_logs` must store the provider's event ID
(e.g., `evt_1OXxxx` for Stripe) for dispute resolution.

Entitlements remain the only source of truth for access decisions. The
`product_access_events` table is the immutable event log for dispute resolution and
analytics. No access decision is ever derived from `product_access_events` or
`subscriptions` directly — only from `packages/entitlements.hasAccess` /
`packages/entitlements.explainAccess`.

### D3 — Webhook route safety contract (canonical)

Target file: `apps/web/src/app/api/billing/webhook/route.ts` (does not yet exist).
This is the single entry point for all billing webhooks from all providers.

**Required handler sequence — no deviation permitted:**

```
Step 1: export const runtime = 'nodejs'  (required for Buffer/crypto)
Step 2: Read raw body — Buffer.from(await request.arrayBuffer())
        NEVER call request.json() before Step 3.
Step 3: Detect provider from signature headers:
          headers['stripe-signature'] present → 'stripe'
          headers['x-nowpayments-sig'] or headers['x-coingate-sig'] → 'crypto'
          neither → HTTP 400 { error: 'unknown_provider' }
Step 4: BillingProvider.handleWebhook(rawBody, headers, idempotencyStore)
          throws WebhookSignatureError → HTTP 400 { error: 'signature_invalid' }
Step 5: for each EntitlementTransition returned:
          packages/entitlements.syncBillingState(transition) — in-transaction
          on DB error → HTTP 500 { error: 'internal_error' } — do NOT set idempotency key
Step 6: HTTP 200 { received: true }
```

The handler must:
- Be excluded from CSRF middleware. The Next.js middleware config must match-exclude
  `/api/billing/webhook` explicitly.
- Be excluded from any general request-body logging middleware. Log only `event.type`
  and `event.id` — never log the raw body (may contain PII).
- Never be behind CDN caching.
- Not trust any client-provided state. The only trusted inputs are the raw body and the
  signature headers. No session, no cookie, no role label is consulted.
- Return HTTP 200 for idempotent duplicate events (key already in store) with no state
  change. This is not an error.
- Return HTTP 200 for unknown/unhandled Stripe event types with a log entry. Providers
  send many event types; unknown ones are safe no-ops.
- Return HTTP 400 only for: missing/invalid signature, unrecognized provider.
- Return HTTP 500 only for: DB failure during entitlement write. Provider will retry;
  idempotency prevents double-application once the transaction eventually commits.
- Never return HTTP 500 for business logic errors (wrong metadata, unknown plan code,
  etc.) — those become `manual_review` transitions, not hard failures.

**No plaintext secrets in responses, logs, or audit rows.** The `STRIPE_WEBHOOK_SECRET`
and `STRIPE_SECRET_KEY` must only appear in environment variables and the secret vault.
They must never be written to `audit_logs`, `product_access_events`, error responses,
or any server log line.

### D4 — ProductAccessView display model (canonical, confirmed from prior wave)

The typed object and factory `buildProductAccessView` are specified in
`ENTITLEMENT_STATE_MACHINE.md §13` (added in the prior audit wave). This audit confirms
the underlying engine (`explainAccess`, `evaluateStatus`, `hasAccess`) is implemented
correctly and is the correct source for the view object.

Every product page must explain WHY access is allowed or blocked — never just that it is
blocked. The `reason` field from `explainAccess` drives the `message` field in the view.
The complete mapping is:

| reason | UI message | tone | CTA |
|---|---|---|---|
| `allowed` | (no message; user is inside) | `ok` | null |
| `grace` | "Subscription ended — renew before [graceUntil] to keep access." | `warn` | Renew now → /app/billing |
| `blocked_no_entitlement` | "You do not have access to this product." | `neutral` | Get access → /pricing |
| `expired` | "Your access has expired." | `bad` | Renew to continue → /app/billing |
| `pending_payment` | "Payment pending. Check your email or retry checkout." | `warn` | Check payment status → /app/billing |
| `manual_review` | "Your account is under review. Contact support." | `warn` | Contact support → /support |
| `revoked` | "Access has been revoked. Contact support." | `bad` | Contact support → /support |
| `refunded` | "This purchase was refunded." | `bad` | Re-purchase → /pricing |
| `chargeback` | "Your account has been suspended. Contact support." | `bad` | Contact support → /support |
| `blocked_unknown_state` | "Unable to verify access. Please try again." | `bad` | Try again → /app |

The `access-event timeline` for the admin and user billing page is derived from
`listProductAccessEvents(userId, { productCode, limit: 50 })` (repo function specified
in db-architect handoff). The timeline shows, per entitlement row:
`created_at`, `from_state`, `to_state`, `actor_type`, `reason`, `billing_event_id`.
This is the only timeline surface. No billing provider API is polled at page render time.

For the admin entitlement view: the admin sees all entitlements for a selected user,
with `ProductAccessView` rendered per product, plus the event timeline for each product,
plus the `plan_code` column (currently missing from admin UI — see prior F2/F3/F4 gaps
carried from Phase 2 design wave, still outstanding).

Access must never come from:
- Client-side state or props passed from a client component
- Role labels (a user with role `admin` does not automatically have product access)
- Raw subscription table reads outside `packages/entitlements`
- Unchecked payment status from Stripe API

### D5 — Mock checkout dev-only constraint (confirmed)

`createMockBillingProvider` throws in production (`NODE_ENV === 'production'`).
The `assertNotProduction()` guard on the server action is the second layer of protection.
The mock checkout button in `/app/billing` must use a label visibly containing "dev" or
"mock" (e.g., "Mock purchase (dev only)") and must never appear when
`NODE_ENV === 'production'` (`showMockCheckout: false` in `BillingPageData`). These are
confirmed from the code and doc; no change required.

---

## Risks

| Risk | Severity | Status |
|---|---|---|
| StripeAdapter not implemented — no real webhooks processable | P1 | Open; expected for this wave |
| `product_access_events` table not yet migrated — event log absent for all transitions | P1 | Open; Wave-2 migration 0002 |
| `grantProduct`/`revokeProduct` missing `reason` parameter — audit_logs.reason will be empty | P1 | Open; carried from Phase 2 |
| `syncBillingState` not implemented in `packages/entitlements` — webhook route has no apply path | P1 | Open; must be created before webhook route |
| Webhook route file absent — platform cannot receive payment events | P1 | Open; expected TARGET |
| DB-backed `IdempotencyStore` not implemented — in-memory set only | P1 | Open; required before Stripe wiring |
| `reconcileAllEntitlements` worker does not write audit/event rows on time-drift transitions | P2 | Open |
| `charge.dispute.closed` and partial-refund branching not in current `EVENT_MAP` | P1 | Open; must be in StripeAdapter before production |
| `charge.refunded` full/partial distinction requires amount comparison — current code does not branch | P1 | Open |
| `validUntil` not accepted by `grantProduct` — all admin grants are indefinite | P1 | Open; carried from Phase 2 |
| No `manual_review` flag/approve/reject actions in admin UI | P2 | Open; carried from Phase 2 |
| `webhook_idempotency_keys` table not in current schema — must land in migration 0002 | P1 | Open |
| Stripe IP allowlist not configured in nginx — rate limiting only by IP count not source-verified | P2 | Open; pre-production checklist item |

---

## Verification/tests

The following tests are required before any production Stripe wiring. Test IDs align with
`CONTRACTS/billing-webhooks.md §13`.

### Group 1 — Signature verification (must be Vitest unit, no network)

**BW-002** Tampered body: `verifyWebhookSignature(body + ' x', header, secret, { now })`
must return `{ valid: false }`. CONFIRMED passing via `__smoke__.ts:14` and
`provider.test.ts` (tampered body check).

**BW-003** Missing `stripe-signature` header: route handler must return HTTP 400 before
calling any state-modifying function. Test by passing empty headers object to the handler.

**BW-024** No recognized signature header (neither `stripe-signature` nor crypto
equivalent): route handler must return HTTP 400 `{ error: 'unknown_provider' }`. Specified
in `CONTRACTS/billing-webhooks.md BW-024`.

Tolerance boundary: `verifyWebhookSignature` with `now = signTime + 301_000` (301 seconds
after signing) must return `{ valid: false, reason: 'timestamp_out_of_tolerance' }`. This
is testable with the existing `signWebhook` + `verifyWebhookSignature` pair.

### Group 2 — Idempotency (must be Vitest unit with MemoryIdempotencyStore)

**BW-004** Duplicate event ID: processing the same event twice must return
`{ applied: false }` on the second call and must not write a second `entitlements` update,
`product_access_events` row, or `audit_logs` row.

Implementation note: the idempotency key must be set AFTER the transaction commits, not
before. Test must verify that a simulated transaction failure on the first attempt leaves
the key unset, allowing the second attempt to succeed.

### Group 3 — Event-type to state mapping (Vitest unit, mock repo)

All tests use a mock repository that captures DB writes without a live connection.

**BW-001** `checkout.session.completed` with metadata `{ wtc_user_id, wtc_plan_code, wtc_product_code }`:
entitlement in `pending_payment` → transitions to `active`. `product_access_events` row
written with `from_state='pending_payment', to_state='active', actor_type='billing_webhook'`.

**BW-005** `invoice.paid` with current DB state `grace` → `active`. `valid_until` updated
to `event.data.object.period_end`.

**BW-006** `invoice.payment_failed` with current DB state `active` → `grace`.

**BW-007** `customer.subscription.deleted` with `cancel_at_period_end=false` and current
state `active` → `expired`. `valid_until` set to NOW().

**BW-008** `charge.refunded` (full: `amount_refunded === amount`) with current state
`active` → `refunded`. Access cut immediately.

**BW-009** `charge.refunded` (partial: `amount_refunded < amount`) with current state
`active` → `manual_review`. Admin notification written to `notifications` table.

**BW-010** `charge.dispute.created` with current state `active` → `chargeback`. Admin
notification written. `valid_until` set to NOW().

**BW-011** `charge.dispute.closed` with `status='won'` from `chargeback` → `expired`.
No automatic re-grant.

**BW-012** `charge.dispute.closed` with `status='lost'` from `chargeback` → `refunded`.

**BW-013** Unknown event type (e.g., `customer.created`) → HTTP 200, no state change,
log entry written.

**BW-015** Missing `wtc_user_id` in session metadata on `checkout.session.completed` →
no entitlement granted, `manual_review` audit alert written, HTTP 200.

**BW-016** `invoice.paid` arrives for a user whose entitlement is `revoked` (manual
override): no state change, `manual_override_preserved` logged, HTTP 200.

### Group 4 — Product_access_events written in-txn (Vitest integration, PGlite)

Test: call `grantProduct(db, userId, 'tortila_bot')` → verify that both:
(a) `entitlements` row has `status='active'`, and
(b) `product_access_events` row exists with `from_state='none', to_state='active',
    actor_type='admin'`.

Both assertions in the same test. The absence of (b) while (a) exists would be a
transaction atomicity failure.

Test: call `revokeProduct(db, userId, 'tortila_bot')` → verify both entitlement
`status='revoked'` and `product_access_events` row with `to_state='revoked'`.

### Group 5 — Bundle expansion (Vitest integration, PGlite or mock repo)

**BW-018** `checkout.session.completed` for `bundle_pro` plan: all four member
entitlements (`tortila_bot`, `axioma_terminal`, `tradingview_indicators`, `education`)
are created in a single transaction. Verifying: `hasAccess(ents, 'axioma_terminal', NOW)`
is true; `hasAccess(ents, 'club', NOW)` is false. Four `product_access_events` rows
written, all with the same `billing_event_id`.

Rollback test: simulate a DB insert failure on the third member entitlement during bundle
expansion → all four entitlements must be absent (full rollback). No partial bundle grants.

### Group 6 — Fail-closed access gate (confirmed passing)

`engine.test.ts` and `__smoke__.ts` cover: no entitlements → deny; unknown status → deny;
grace grants with correct time boundary; lifetime never expires; manual grant survives
billing cancel; refund/chargeback from any state; most-actionable blocking reason priority.
All confirmed passing per smoke test output and Vitest structure. No additional tests
required for the core entitlement engine.

---

## Next actions

1. **implementation agent (billing):** Create `packages/billing/src/providers/stripe.ts`
   with `StripeAdapter` implementing `BillingProvider`. Guard: `STRIPE_SECRET_KEY` must be
   set or constructor throws. Use `stripe.webhooks.constructEvent` for signature
   verification. Implement the full event-type mapping table from D1 above, including
   content-based branching for `charge.refunded` (full vs partial) and
   `charge.dispute.closed` (won vs lost). No live network call unless `STRIPE_SECRET_KEY`
   is configured.

2. **implementation agent (billing):** Create `apps/web/src/app/api/billing/webhook/route.ts`
   per the step-by-step handler contract in D3. Add CSRF exclusion for
   `/api/billing/webhook` in `apps/web/src/middleware.ts`. Add the route to
   `apps/web/src/lib/server-config.ts` or equivalent constants file.

3. **implementation agent (entitlements):** Add `syncBillingState(transitions)` to
   `packages/entitlements` that opens a DB transaction, calls `applyBillingEvent` for each
   transition, writes `product_access_events` + `audit_logs` rows in the same transaction.
   Export from `packages/entitlements/src/index.ts`.

4. **Wave-2 DB implementer (migration 0002):** Land `product_access_events` and
   `webhook_idempotency_keys` tables as part of migration 0002 per the db-architect
   handoff column specs. Update `grantProduct` and `revokeProduct` in
   `packages/db/src/repositories.ts` to insert a `product_access_events` row in the same
   transaction (alongside the existing `audit_logs` insert). Add
   `recordProductAccessEvent` and `listProductAccessEvents` repo functions.

5. **Wave-2 DB implementer:** Add `reason: string` and `validUntil: number | null`
   parameters to `grantProduct` and `revokeProduct` in `packages/db/src/repositories.ts`
   and thread them through `apps/web/src/lib/db-store.ts` and the admin server actions.
   Server-side: reject empty `reason` before the repository call.

6. **implementation agent (billing):** Implement a DB-backed `IdempotencyStore` using the
   `webhook_idempotency_keys` table. The `set()` call must be committed only after the
   entitlement transaction succeeds. Pass this store to `handleWebhook` from the route
   handler.

7. **implementation agent (worker):** Update `reconcileAllEntitlements` in
   `packages/db/src/repositories.ts` to write `audit_logs` (actor_type='system',
   action='expire') and `product_access_events` rows for every time-drift transition.

8. **implementation agent (admin UI):** Fix the three P1 admin gaps from the prior wave:
   (a) add required `reason` text input to grant/revoke forms, (b) add optional `validUntil`
   date input to grant form, (c) add `flag_review` / `approve_review` / `reject_review`
   server actions. Add `plan_code` column to the admin entitlements table.

9. **Pre-production activation checklist** (blocking before Stripe Dashboard registration):
   - [ ] `STRIPE_SECRET_KEY` (live) stored in secret vault, not in `.env` file
   - [ ] `STRIPE_WEBHOOK_SECRET` (live) stored in secret vault
   - [ ] All Stripe price IDs populated in `STRIPE_PRICE_MAP` env config
   - [ ] Webhook route file exists and all BW-001 through BW-021 and BW-024 tests pass
   - [ ] Stripe IP allowlist configured in nginx before registering the endpoint
   - [ ] Admin confirms test checkout → active entitlement on staging with Stripe test keys
   - [ ] `product_access_events` table exists and is being written on every transition
   - [ ] `webhook_idempotency_keys` table exists with 90-day TTL enforcement
