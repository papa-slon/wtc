# ecosystem-tests-runner handoff
## Scope
Read-only test/gate audit for Phase 3.40 Stripe checkout configuration/request dry-run preflight. Scope covered existing checkout tests, webhook tests, artifact scanner, `scripts/gates.mjs`, package scripts, and checkout request/config surfaces. No product code or docs were changed except this required handoff.

## Files inspected
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `packages/billing/package.json`
- `packages/billing/src/index.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/__smoke__.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
`docs/handoffs/20260602-0751-ecosystem-tests-runner.md` only. Product code/docs: None - read-only audit.

## Findings
1. Medium - checkout request preflight is not yet represented as an opt-in acceptance command. Evidence: `package.json:30-32` exposes LMS live preflights and Stripe webhook replay preflight only; `apps/web/src/features/billing/checkout.ts:101-134` is the app-level checkout creation path that combines env gating, price map, base URLs, provider creation, and request creation; `packages/billing/src/stripe.ts:80-87` performs the real Stripe Checkout Sessions POST. Recommendation: add a dedicated `accept:billing:stripe-checkout` dry-run that exercises the app checkout path with disposable DB and mocked/intercepted fetch, asserts `network=not-run`, and writes redacted summary evidence. Target part: checkout configuration/request dry-run preflight.
2. Medium - current tests cover provider request shape and pending-payment state separately, but not the full server-action sequence from configured checkout to pending_payment and redirect. Evidence: `packages/billing/src/stripe.test.ts:77-127` verifies mocked provider request fields; `tests/integration/billing-checkout-phase34.test.ts:30-67` verifies `createPendingPaymentForPlan`; `apps/web/src/app/(app)/app/billing/page.tsx:27-44` connects CSRF, user session, DB requirement, `createStripeCheckout`, pending payment creation, and redirect. Recommendation: add a focused integration test or dry-run harness that proves one configured plan creates the expected Stripe request body, writes pending_payment rows, never grants access before webhook, and returns only a redacted checkout URL/session summary. Target part: checkout server action boundary.
3. Medium - admin/cabinet checkout-enabled indicators can drift from actual checkout availability. Evidence: `apps/web/src/features/billing/checkout.ts:66-82` computes CTA availability from `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP`; `apps/web/src/features/cabinet/loader.ts:130-153` and `apps/web/src/features/admin/queries.ts:449-477` use only `BILLING_CHECKOUT_ENABLED === 'true'`. Recommendation: final tests should include one configuration matrix asserting visible/admin checkout state matches the same availability contract used by the billing CTA, or intentionally document `BILLING_CHECKOUT_ENABLED` as display-only. Target part: checkout configuration truth source.
4. Low - artifact leak scanning is ready for Stripe checkout evidence but should be explicitly part of the checkout preflight acceptance. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:45-52` blocks Stripe key assignments, key tokens, webhook signatures, raw event bodies, and checkout session IDs; `tests/integration/billing-stripe-webhook-replay-preflight.test.ts:78-83` already proves the webhook preflight summary can be scanned. Recommendation: the checkout preflight should invoke the same scanner against its log root and assert no `sk_`, `cs_`, checkout URL, bearer token, or raw request body is retained. Target part: retained evidence and leak gate.

## Decisions
- Treat Phase 3.40 checkout preflight as opt-in acceptance, not part of default `core`, `full`, `ci:local`, or Playwright gates until it is stable and explicitly approved.
- Keep live Stripe network calls out of tests and dry-runs. Use mocked/intercepted fetch for request-body assertions and report `network=not-run`.
- Reuse the existing artifact scanner for Stripe retained-evidence checks instead of adding a separate scanner.

## Risks
- A green provider test does not prove the deployed app wiring is configured coherently; env parsing, price-map selection, base URL construction, DB pending state, and redirect can still drift.
- If `BILLING_CHECKOUT_ENABLED` remains separate from `checkoutAvailability`, product/admin surfaces may report checkout enabled while the billing CTA is unavailable, or the reverse.
- Full gates were not run in this audit; only targeted checkout/webhook tests and the webhook preflight were observed green.

## Verification/tests
Run this session:
- `npx vitest run packages/billing/src/provider.test.ts packages/billing/src/stripe.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/billing-stripe-webhook-replay-preflight.test.ts tests/integration/billing-webhook-route-handler.test.ts` - PASS, 5 files, 32 tests.
- `npm run accept:billing:stripe-webhook -- --dry-run` - PASS, `network=not-run`, 4 cases, summary `logs/billing-stripe-webhook-preflight/summary-d2cccb2bdb78bb86.json`.
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/billing-stripe-webhook-preflight` - PASS, 1 text file scanned, 0 issues.

Not run this session:
- `node scripts/gates.mjs full` - skipped; outside read-only targeted audit budget.
- `node scripts/gates.mjs e2e` - skipped; checkout request preflight is backend/config focused and Playwright was not required for this audit.
- Live Stripe checkout call - intentionally not run; Phase 3.40 preflight should remain dry-run/no-network.

## Next actions
1. Add `scripts/billing-stripe-checkout-preflight.mjs --dry-run` and `accept:billing:stripe-checkout` as an opt-in script.
2. In that preflight, set test-mode env, use disposable DB, mock/intercept Stripe fetch, call the app checkout path for one subscription plan and one one-time plan, and assert request body fields: mode, price, quantity, success/cancel URLs, client reference ID, metadata, and customer email handling.
3. Assert post-request state: pending_payment rows created, product access remains denied until webhook, manual grants are not downgraded, no raw secrets/session IDs/checkout URLs retained.
4. Add artifact scan invocation for the checkout preflight log root.
5. Before phase acceptance, run targeted checkout tests, `npm run accept:billing:stripe-checkout -- --dry-run`, artifact scan for checkout logs, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e`.
