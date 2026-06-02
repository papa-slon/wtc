# ecosystem-backend-implementer handoff
## Scope
Phase 3.40 read-only backend audit for Stripe checkout configuration/request dry-run preflight. Inspected the app checkout server action, Stripe checkout provider request construction, price-map parsing, pending-payment creation path, webhook replay preflight boundary, and existing billing tests. No product code, package code, scripts, tests, env files, or docs were changed except this required handoff.

Recommended narrow implementation boundary: add a backend-only Stripe checkout preflight that validates env/config/price-map coverage and builds the exact checkout request body without performing a real Stripe network call or creating pending-payment rows. Keep it disjoint from the existing webhook replay preflight, which already covers signed webhook handling and entitlement activation.

## Files inspected
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/features/billing/plans.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe-replay.ts`
- `packages/billing/src/index.ts`
- `packages/entitlements/src/registry.ts`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/gates.mjs`
- `package.json`
- `.env.example`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/stripe-replay.test.ts`
- `docs/handoffs/20260602-0725-ecosystem-backend-implementer.md`

## Files changed
This handoff only: `docs/handoffs/20260602-0751-ecosystem-backend-implementer.md`

## Findings
1. Severity: High. Evidence: `packages/billing/src/stripe.ts:44`-`68` builds the Stripe Checkout form body, but the builder is private; `packages/billing/src/stripe.ts:76`-`88` immediately sends a real `fetch` to `https://api.stripe.com/v1/checkout/sessions`; `package.json:32` exposes only `accept:billing:stripe-webhook`, not a checkout request preflight. Recommendation: add a separate checkout preflight seam that either exports a sanitized request-builder from `@wtc/billing` or injects a no-network `fetch` into the provider, then validates the generated method, Stripe API version, mode, line item price, success/cancel URLs, client reference, metadata, and customer email handling without calling Stripe. Target part: `packages/billing` checkout request dry-run seam plus opt-in script.
2. Severity: High. Evidence: `apps/web/src/features/billing/checkout.ts:101`-`135` checks `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, test-key prefix, plan config, and then calls `provider.createCheckout`; `apps/web/src/app/(app)/app/billing/page.tsx:34`-`44` creates pending-payment rows only after the Stripe session returns. Recommendation: the dry-run must stop before `createPendingPaymentForPlan` and must not reuse `startStripeCheckout` directly unless the provider is replaced by a strict fake that returns a non-persisted synthetic session and proves no pending rows are written. Target part: app checkout action boundary.
3. Severity: High. Evidence: the current local acceptance command is webhook-only: `scripts/billing-stripe-webhook-replay-preflight.mjs:35`-`39` describes signed fake webhook fixtures and no Stripe network I/O; `scripts/billing-stripe-webhook-replay-preflight.mjs:95`-`184` covers valid checkout webhook, duplicate replay, bad signature, and missing-user manual review; `tests/integration/billing-stripe-webhook-replay-preflight.test.ts:19`-`23` asserts only the webhook script is opt-in and outside default gates. Recommendation: do not expand that script into checkout validation; add a sibling command such as `accept:billing:stripe-checkout` so checkout request/config preflight and webhook replay evidence remain independent and easy to reason about. Target part: acceptance command split.
4. Severity: Medium. Evidence: `apps/web/src/features/billing/checkout.ts:21`-`44` parses `STRIPE_PRICE_MAP` from JSON or comma-separated `plan=price` pairs but does not validate known plan codes, Stripe `price_` shape, duplicate keys, malformed JSON reporting, or full selected-plan coverage; `.env.example:106`-`108` shows placeholder test key/webhook secret and only two mapped prices while `packages/entitlements/src/registry.ts:44`-`62` defines eleven non-admin plans. Recommendation: checkout preflight should produce a redacted per-plan matrix: known plan, product expansion non-empty, mode, price-id present, price-id shape valid, and CTA availability result, while preserving the runtime fail-closed behavior for unmapped plans. Target part: price-map parser/preflight diagnostics.
5. Severity: Medium. Evidence: `packages/billing/src/provider.ts:103`-`121` marks checkout globally available if provider/secrets are present and the price map has at least one key; `apps/web/src/features/billing/checkout.ts:83`-`91` then disables an individual plan when its price ID is missing. Recommendation: dry-run acceptance should assert both layers: global Stripe checkout availability and per-plan availability for every product plan that will be shown by `buildPricingCards` at `apps/web/src/features/billing/plans.ts:14`-`25`. Target part: checkout availability coverage.
6. Severity: Medium. Evidence: `packages/billing/src/stripe.test.ts:78`-`108` and `packages/billing/src/stripe.test.ts:110`-`127` mock `fetch` and verify subscription/payment request bodies, but they do not exercise `parseStripePriceMap`, `stripeCheckoutConfig`, `createStripeCheckout`, app base URL composition, or the no-pending-payment dry-run boundary. Recommendation: add focused tests for parser formats/refusals, config selection, live-key refusal, malformed price maps, APP_BASE_URL normalization, request-body generation with no network, and "dry-run does not write pending_payment". Target part: unit/integration test coverage.
7. Severity: Low. Evidence: checkout UI copy states access activates only by signed webhook at `apps/web/src/app/(app)/app/billing/page.tsx:89`-`92`, and pending-payment tests prove checkout-created products do not grant access at `tests/integration/billing-checkout-phase34.test.ts:31`-`48` and do not downgrade manual grants at `tests/integration/billing-checkout-phase34.test.ts:50`-`66`. Recommendation: preserve this invariant in the preflight: checkout request dry-run may validate request shape and optional fake session parsing, but must never be counted as entitlement activation evidence. Target part: pending-payment/access boundary.

## Decisions
- Keep Phase 3.40 checkout preflight local and no-network by default. It should reject `sk_live_`, avoid Stripe Dashboard/CLI, avoid production URLs, and require explicit operator consent for any later test-mode network path.
- Do not fold checkout dry-run into `scripts/billing-stripe-webhook-replay-preflight.mjs`; that command now has a clean webhook replay responsibility.
- Prefer a `@wtc/billing` package seam for Stripe checkout request construction so tests and scripts do not duplicate form-field logic from `packages/billing/src/stripe.ts`.
- Retained evidence should be redacted counts/status/plan labels only: no `Authorization` header, no raw secret key, no webhook secret, no raw session URL, no customer email, no raw Stripe response body.

## Risks
- A dry-run built by mocking too high in the app layer can miss the exact Stripe body sent by `createStripeProvider`.
- A dry-run built by calling the real provider without fetch injection risks accidental Stripe network I/O if test keys are present.
- Price-map parser errors currently can surface at render/action time; a preflight should report them before operators expose checkout CTAs.
- Passing checkout request dry-run must not be reported as Stripe CLI/webhook replay, Stripe Dashboard endpoint registration, or production key readiness.

## Verification/tests
- RUN: read-only source inspection and targeted text searches only.
- NOT RUN: `npm test`; focused billing Vitest suites; `npm run accept:billing:stripe-webhook`; any new checkout preflight; `npm run check:core`; `npm run lint`; `npm run typecheck`; `npm run typecheck -w @wtc/web`; `npm run secret:scan`; `node scripts/gates.mjs full`; Playwright/e2e; local server; Stripe CLI; Stripe Dashboard replay; live/test Stripe network calls.
- Reason skipped: this was an audit-only lane; scope allowed only the required handoff file and no product-code/script/test edits.

## Next actions
1. Add a pure `@wtc/billing` checkout request builder or provider fetch-injection seam that can return a redacted dry-run summary without Stripe network I/O.
2. Add `scripts/billing-stripe-checkout-preflight.mjs` and `accept:billing:stripe-checkout`, defaulting to dry-run and staying out of `ci:local`, default `e2e`, and `scripts/gates.mjs`.
3. Validate config in dry-run: `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY` starts with `sk_test_`, `STRIPE_WEBHOOK_SECRET` present, `APP_BASE_URL` safe/local unless explicitly overridden, and `STRIPE_PRICE_MAP` parseable with known plan codes and `price_`-shaped IDs.
4. Emit a per-plan checkout matrix for every non-admin plan: mapped/unmapped, product expansion count, payment/subscription mode, would-create-request yes/no, and reason.
5. Add tests for parser formats/refusals, request body shape, no live-key acceptance, no network by default, no retained secrets, and no pending-payment writes during dry-run.
6. Keep webhook replay acceptance as a separate follow-up evidence lane; checkout dry-run only proves configuration and request construction.
