# Handoff: ecosystem-backend-implementer-billing
**Epoch:** 20260530-1355
**Agent:** ecosystem-backend-implementer-billing (Workstream D)
**Scope:** Billing webhook hardening — Phase 2.4 implementation

---

## Read documents

- `docs/handoffs/20260530-1355-ecosystem-billing-access-auditor.md` — Decisions 1, 3, 4 (idempotency ledger, subscription upsert, manual_review path)
- `docs/handoffs/20260530-1355-ecosystem-security-auditor.md` — no-secrets rules, webhook path security

---

## Scope

Workstream D — billing webhook hardening: durable idempotency, subscription upsert, missing-userId `manual_review`, EVENT_MAP gaps. Implemented per `20260530-1355-ecosystem-billing-access-auditor.md` Decisions 1/3/4.

## Files inspected

`packages/billing/src/{provider,stripe,webhook,index}.ts`, `apps/web/src/app/api/billing/webhook/route.ts`, and the cited billing-access-auditor + security-auditor handoffs.

## Findings

No new findings — implemented the auditor's Decisions 1/3/4. See the aggregate "Findings → fixes".

## Decisions

Durable `billing_webhook_events` idempotency (INSERT-on-conflict) replaces the select-then-insert race; missing/ambiguous userId → fail-closed `manual_review` item + admin notify (never auto-grant); `upsertSubscription` wired when `providerRef` present; delete-ledger-row-on-error so Stripe retries re-process. Verify-first HMAC + no secret/raw-body logging retained.

## Verification/tests

typecheck (web + packages) PASS; build PASS (44+ routes); secret:scan PASS; npm test 185/5 (no regressions). Final phase gates in the aggregate table.

## Files changed

- `packages/billing/src/provider.ts` — extended `NormalizedEvent` with `providerRef?`, `currentPeriodEnd?`, `subscriptionStatus?`
- `packages/billing/src/stripe.ts` — extended `StripeEventLike.data.object` with `subscription?`, `current_period_end?`, `status?`; extracts those fields in `parseWebhook` into the `NormalizedEvent`
- `packages/billing/src/webhook.ts` — added `invoice.payment_action_required` → `payment_failed` to `EVENT_MAP`; added `charge.dispute.closed` → `chargeback` to `EVENT_MAP` (route overrides based on dispute status field)
- `apps/web/src/app/api/billing/webhook/route.ts` — full rewrite per Decision 1/3/4 spec

---

## Summary of changes

### packages/billing/src/provider.ts
Extended `NormalizedEvent` interface with three optional Phase 2.4 fields:
- `providerRef?: string` — Stripe subscription ID (sub_xxx)
- `currentPeriodEnd?: number` — Unix timestamp seconds from Stripe
- `subscriptionStatus?: string` — e.g. 'active' | 'past_due' | 'canceled'

### packages/billing/src/stripe.ts
- Extended `StripeEventLike` shape to include `subscription`, `current_period_end`, `status` on `data.object`
- In `parseWebhook`: after extracting userId/planCode, now also extracts `providerRef`, `currentPeriodEnd`, `subscriptionStatus` from `obj` using optional-chained guards

### packages/billing/src/webhook.ts
- Added `'invoice.payment_action_required': 'payment_failed'` to EVENT_MAP (3DS / payment action required flows)
- Added `'charge.dispute.closed': 'chargeback'` to EVENT_MAP; the route handler overrides the mapped event:
  - dispute.status === 'won' → `subscription_canceled` (merchant won, clean removal)
  - dispute.status === 'lost' → `refunded` (chargeback upheld, must revoke)
  - Unexpected status → `null` billingEvent → no-op (safe)

### apps/web/src/app/api/billing/webhook/route.ts
Full rewrite (kept verify-first HMAC intact, CSRF-exempt, no raw-body/secret logging):

1. **Durable idempotency (Decision 1):** Replaced the old `applyStripeEvent` audit_logs select-then-insert with `insertWebhookEventOnce(db, {...})`. The ledger row is committed atomically *before* any entitlement mutation. `isDuplicate=true` → immediate 200. On DB error in `applyStripeEvent`: the `billing_webhook_events` row is deleted (via `db.delete(schema.billingWebhookEvents).where(...)`) so Stripe's retry can re-insert.

2. **Missing userId path (Decision 4 — replaces silent 200):** When `event.userId` is absent:
   - Calls `createManualReviewItem(db, { provider:'stripe', eventId, eventType, userId:null, reason:'missing_user_id', eventSnapshot:{id,type,planCode} })` — eventSnapshot contains ONLY non-secret parsed fields, never `NormalizedEvent.raw`.
   - Iterates `listUsers(db)` and for each user with role `'admin'` calls `createNotification(db, {...})` with link to `/admin/entitlements/review` (N+1 acceptable at MVP; future: `listAdminUserIds`).
   - Calls `updateWebhookEventStatus(db, 'stripe', event.id, 'no_op', 0)`.
   - Returns 200 (Stripe does not retry). NEVER auto-grants.

3. **Unknown planCode path:** When `expandPlan(planCode).filter(isProductCode)` returns `[]`:
   - Calls `updateWebhookEventStatus(db, 'stripe', event.id, 'no_op', 0)`.
   - Returns 200. No grant.

4. **upsertSubscription wiring (Decision 3):** After dedup check and before `applyStripeEvent`, when `event.userId && event.planCode && event.providerRef` are all present:
   - Derives `subStatus`: `'canceled'` for refunded/chargeback events, otherwise `event.subscriptionStatus ?? 'active'`.
   - Calls `upsertSubscription(db, { userId, planCode, provider:'stripe', providerRef, status:subStatus, currentPeriodEnd })`.
   - Best-effort: failure is logged but does not block entitlement processing.

5. **charge.dispute.closed handling:** The route checks `event.raw.data.object.status` and overrides `billingEvent` accordingly before the dedup insert.

---

## Security posture

- Signature verified FIRST before any body parsing or DB access (unchanged).
- Raw body, Stripe signature header, STRIPE_WEBHOOK_SECRET never logged, stored, or returned.
- `eventSnapshot` in manual_review item contains only `{ id, type, planCode }` — explicitly excludes `NormalizedEvent.raw`.
- `updateWebhookEventStatus` status values used: `'applied'` (success), `'no_op'` (missing user OR unknown plan), `'error'` (implicit — ledger row deleted on DB failure so status is never set to error in practice).
- All `console.error` calls are behind `NODE_ENV !== 'production'` guard and log only event.id + error message.

---

## Self-verify results

| Gate | Result |
|---|---|
| `npm run typecheck` (root) | PASS — no errors |
| `npm run typecheck -w @wtc/web` | PASS — no errors |
| `npm run build -w @wtc/web` | PASS — 44+ routes, no errors |
| `npm run secret:scan` | PASS — no secrets found |
| `npm test` | PASS — 185/5 (190 total, 5 skipped; 24 test files) |

---

## Risks / known limitations

1. **N+1 admin notification**: `listUsers(db)` fetches all users then filters for role 'admin'. Acceptable at MVP. Future: `listAdminUserIds(db)` (single JOIN query).

2. **`updateWebhookEventStatus` type**: The `BillingWebhookEventStatus` type is `'applied' | 'no_op' | 'manual_review' | 'error'`. The task spec mentioned `'no_user'` / `'no_product'` labels but these are not in the type definition in `packages/db`. We use `'no_op'` for both cases (semantically correct — event received, no operation on entitlements). The `billing_webhook_events.status` column is TEXT with no DB enum, so these values could be persisted without migration changes if the type is extended later.

3. **delete-on-error race**: A narrow window exists between the `billing_webhook_events` row deletion and Stripe's next retry delivery. In practice Stripe waits >30s between retries; the window is negligible and not a security concern (worst case: retry is also deduplicated, which is the correct idempotent behaviour).

4. **`drizzle-orm` direct import in route**: `apps/web` uses `import { and, eq } from 'drizzle-orm'` for the DELETE WHERE clause in the error path. This is consistent with `apps/web/src/features/admin/queries.ts` which already does the same. The package is hoisted to root `node_modules` and accessible.

---

## Next actions (follow-on agents)

- **tests-runner**: Add integration tests BWH-001–BWH-005 (concurrent dedup, missing-userId path, upsertSubscription uniqueness) from the billing-access-auditor Decision 2 test spec.
- **admin-implementer**: Add `adminFlagReviewAction`, `adminApproveReviewAction`, `adminRejectOrDismissReviewAction` to `features/admin/actions.ts` + schemas + review page per Decision 5 spec in the billing-access-auditor handoff.
