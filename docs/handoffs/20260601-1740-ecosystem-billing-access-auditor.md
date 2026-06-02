# ecosystem-billing-access-auditor handoff
## Scope
Workstream D read-only audit: Stripe test-mode checkout acceptance, signed webhook replay/harness, pending-payment to active entitlement state, manual review queue, entitlement timeline UI/admin, TradingView grant/revoke/expiry history, external-task flow, and TV automation disabled.

No source code edits were made. No live server, live Stripe dashboard, live webhook forwarding, SSH, bot, exchange, or TradingView account automation was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/entitlements/src/engine.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/features/billing/timeline.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/admin/entitlements/review/page.tsx`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/worker/src/index.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/db-0003.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `tests/integration/phase23-visible-progress.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Stripe checkout is implemented but true Stripe test-mode acceptance is still not observed in this workspace. Evidence: `packages/billing/src/stripe.ts:80` makes the real REST call to `https://api.stripe.com/v1/checkout/sessions`; `packages/billing/src/stripe.test.ts:79` replaces `globalThis.fetch` with a mock and returns a fake `cs_test_123`; `tests/integration/billing-webhook-hardening.test.ts:4` says the webhook hardening suite uses signed fake bodies and no Stripe network calls; `.env.example:69` to `.env.example:71` contains placeholder Stripe key, webhook secret, and price IDs, not real test credentials. Recommendation: run a Stripe CLI/dashboard acceptance with real test `sk_test`, `whsec`, and `price_` IDs; capture checkout creation, valid `checkout.session.completed`, duplicate replay, missing-plan, and unknown-plan outcomes. Target part: Stripe acceptance gate.

2. HIGH - The webhook replay/harness coverage does not directly exercise the Next `POST /api/billing/webhook` route as an HTTP route. Evidence: `tests/integration/billing-webhook.test.ts:3` to `tests/integration/billing-webhook.test.ts:4` states the tests cover the package and repo wiring while route handlers are excluded from Vitest; `tests/integration/billing-webhook-hardening.test.ts:70` defines `simulateManualReviewRoutePath` instead of invoking the route handler; `tests/integration/billing-webhook-hardening.test.ts:155` to `tests/integration/billing-webhook-hardening.test.ts:163` uses static source assertions for route behavior. Recommendation: add a direct route-handler harness that constructs `Request` objects, injects test env/db, and asserts missing signature 400, bad signature 400, valid signed event 200 plus DB effects, duplicate replay 200/no second mutation, and retry behavior on injected DB failure. Target part: signed webhook replay/harness.

3. HIGH - TV expiry revocation and external task creation are not atomic, so a task insert failure after WTC revokes the request can leave no manual TradingView-side work item to remove external access. Evidence: `packages/db/src/repositories.ts:333` defines `sweepTvExpiry`; `packages/db/src/repositories.ts:340` calls `atomicRevokeTv` first; `packages/db/src/repositories.ts:341` inserts the `tradingview_access_tasks` row afterward in a separate statement; `packages/db/src/repositories.ts:1752` shows `atomicRevokeTv` opens and completes its own transaction before control returns. Recommendation: make expiry revoke plus task creation one atomic operation, or insert an idempotent pending task before revocation and finalize it after, with a recovery query for revoked requests missing tasks. Target part: TradingView external-task flow.

4. HIGH - The entitlement state machine still lets a later `payment_succeeded` billing event reactivate `revoked`, `refunded`, `chargeback`, and `manual_review` states, conflicting with the documented manual-resolution rule. Evidence: `packages/entitlements/src/state-machine.ts:82` to `packages/entitlements/src/state-machine.ts:86` returns `active` for `payment_succeeded` from terminal/review states; `docs/ENTITLEMENT_STATE_MACHINE.md:60` to `docs/ENTITLEMENT_STATE_MACHINE.md:61` says revoked/refunded/chargeback are terminal from a billing perspective and only admin manual grant can create a new active entitlement; `docs/ENTITLEMENT_STATE_MACHINE.md:181` to `docs/ENTITLEMENT_STATE_MACHINE.md:182` says billing events do not automatically clear revoked/manual_review. Recommendation: restrict `payment_succeeded` auto-activation to allowed states such as `pending_payment`, `grace`, and documented re-subscribe paths, then add regression tests for revoked/refunded/chargeback/manual_review. Target part: pending-payment to active entitlement state.

5. MEDIUM - Manual review approval is intentionally split into a review-item transaction followed by separate grants, which can leave an item approved without granting access if a later grant fails. Evidence: `packages/db/src/repositories.ts:1557` to `packages/db/src/repositories.ts:1563` documents the non-atomic split; `packages/db/src/repositories.ts:1604` to `packages/db/src/repositories.ts:1617` performs grants only after the review item transaction completes; `apps/web/src/features/admin/actions.ts:199` to `apps/web/src/features/admin/actions.ts:207` passes an approval target only when the form supplied a user ID and product codes. Recommendation: add a durable intermediate status such as `approved_pending_grant`, or implement a transaction-local grant helper so review resolution and entitlement grant succeed or fail together. Target part: manual review queue.

6. LOW - Billing activation docs/env text is stale relative to the now-implemented checkout path. Evidence: `.env.example:66` still says checkout session creation is TARGET and `createCheckout` is not implemented; `apps/web/src/features/billing/checkout.ts:101` to `apps/web/src/features/billing/checkout.ts:134` implements `createStripeCheckout`; `packages/billing/src/stripe.ts:76` to `packages/billing/src/stripe.ts:97` implements `createCheckout`. Recommendation: update `.env.example` and stale contract/status references so operators do not treat checkout as unimplemented when it is now implemented but unaccepted against real Stripe test mode. Target part: docs/operator activation.

## Decisions
- Treated this as a read-only auditor pass. The only write is this per-agent handoff file.
- Did not run real Stripe checkout, Stripe CLI forwarding, real Postgres, Playwright/e2e, or full local CI because this scope did not include provisioning external credentials or mutating live infrastructure.
- Treated PGlite/Vitest results as local implementation evidence only, not as live Stripe or production readiness proof.
- Did not launch secondary agents from this agent role; no background agents were left running.

## Risks
- Checkout can create Stripe test sessions when configured, but no observed real Stripe acceptance evidence exists in this session.
- Signed fake webhook tests validate HMAC and DB paths, but a route-level harness is still needed to prove HTTP behavior, middleware exclusion, and retry status codes end to end.
- A TV external task row is the human operator's signal to remove external TradingView access; losing that row after an internal revoke can create an external-access drift.
- Current entitlement transition logic can reactivate states that the doctrine describes as terminal or admin-only resolution states.
- Manual review approval can resolve a queue item separately from the entitlement grant.

## Verification/tests
RUN:
- `npx vitest run packages/billing/src/provider.test.ts packages/billing/src/stripe.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/db-0003.test.ts tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/phase23-visible-progress.test.ts`
- Result: PASS - 10 test files passed, 68 tests passed.

NOT RUN:
- Real Stripe dashboard checkout acceptance - no real `sk_test`, `whsec`, or Stripe test `price_` IDs were provided.
- Stripe CLI webhook replay against the Next route - no Stripe CLI session or route harness was started.
- Real Postgres harness - no throwaway `REAL_POSTGRES_DATABASE_URL` was provided.
- Playwright/e2e - out of scope for this read-only workstream audit; no browser server was started.
- Full `node scripts/gates.mjs full` - out of scope and heavier than required for this auditor pass.
- Git/CI - workspace is not git-backed from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no branch, commit, PR, or CI claim is made.

## Next actions
1. Add direct route-handler tests for `/api/billing/webhook` with signed requests and duplicate replay.
2. Run real Stripe test-mode acceptance with operator-provided test credentials and price IDs.
3. Fix entitlement terminal/manual-review reactivation semantics and add regression tests.
4. Make TV expiry revoke plus external task creation atomic or recoverable.
5. Harden manual review approval so review resolution and entitlement grant cannot drift.
6. Refresh stale `.env.example` and billing contract/status text around checkout implementation versus acceptance.
