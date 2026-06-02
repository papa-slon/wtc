# ecosystem-platform-architect handoff
## Scope
Read-only platform audit for Phase 3.40 Stripe checkout dry-run preflight. Scope covered package boundaries, billing checkout request construction, config validation, scripts, deployment/acceptance docs, current tests, and default gate exposure. No product code or canonical docs were edited.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe-replay.ts`
- `packages/billing/src/index.ts`
- `packages/billing/package.json`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/provider.test.ts`
- `packages/config/src/env.ts`
- `.env.example`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`
- `docs/handoffs/20260602-0725-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-0725-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0725-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0725-ecosystem-tests-runner.md`

## Files changed
Only this handoff: `docs/handoffs/20260602-0751-ecosystem-platform-architect.md`. Read-only audit otherwise.

## Findings
1. HIGH - Checkout dry-run request-building should move into `@wtc/billing`, not stay private to the runtime Stripe provider or a route/page action. Evidence: `packages/billing/src/stripe.ts:35`-`68` already builds the exact Stripe Checkout `URLSearchParams`, but `buildCheckoutBody` is private; the public billing export surface currently exposes provider/replay helpers only (`packages/billing/src/index.ts:9`-`18`); tests assert the constructed request body only by mocking `fetch` inside `createCheckout` (`packages/billing/src/stripe.test.ts:78`-`107`). Recommendation: extract/export pure helpers such as `buildStripeCheckoutRequest`, `validateStripeCheckoutConfig`, and sanitized summary builders from `@wtc/billing`, then have both `createStripeProvider().createCheckout()` and any dry-run script consume those helpers. Target part: billing package boundary.

2. HIGH - Checkout dry-run must not invoke `startStripeCheckout` or `createStripeCheckout` unless the phase explicitly permits real Stripe test-mode network calls. Evidence: the page action creates a provider session, writes pending-payment rows, and redirects (`apps/web/src/app/(app)/app/billing/page.tsx:27`-`45`); `createStripeCheckout` gates `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `sk_test_`, then creates a real provider and calls checkout (`apps/web/src/features/billing/checkout.ts:108`-`134`); the provider posts to `https://api.stripe.com/v1/checkout/sessions` (`packages/billing/src/stripe.ts:80`-`88`). Recommendation: dry-run should construct and validate the would-be request and summarize it without calling `fetch`, redirecting, writing pending entitlements, or starting a browser/server flow. Target part: checkout preflight safety.

3. HIGH - Runtime config validation is duplicated and incomplete at the platform config spine. Evidence: UI/server helper parses `STRIPE_PRICE_MAP` directly from `process.env` (`apps/web/src/features/billing/checkout.ts:21`-`44`) and repeats Stripe readiness checks (`apps/web/src/features/billing/checkout.ts:108`-`121`); `checkoutAvailability` separately validates provider/key/webhook/price-map presence (`packages/billing/src/provider.ts:97`-`121`); `@wtc/config` declares `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` but has no `STRIPE_PRICE_MAP` field or Stripe-specific `superRefine` (`packages/config/src/env.ts:58`-`60`). Recommendation: add typed Stripe checkout config parsing to `@wtc/config` for app boot/runtime and reusable pure validation to `@wtc/billing` for scripts/tests, including `sk_test_` only, `whsec_` shape, every selected plan mapped, every price id `price_...`, valid absolute success/cancel URLs, and no `sk_live_` in local acceptance. Target part: config guardrails.

4. MEDIUM - The checkout dry-run should be an opt-in root script and stay out of default gates, following the Phase 3.39 preflight precedent. Evidence: `accept:billing:stripe-webhook` is a dedicated script (`package.json:32`); default `ci:local` does not include it (`package.json:35`); `scripts/gates.mjs` plans include only governance/core/build/e2e gates and not billing preflight (`scripts/gates.mjs:47`-`53`); the webhook preflight test asserts the command is absent from default gates (`tests/integration/billing-stripe-webhook-replay-preflight.test.ts:15`-`24`). Recommendation: add any checkout dry-run as a separate `accept:billing:stripe-checkout` command, not as `npm test`, `ci:local`, `node scripts/gates.mjs full`, or default Playwright. Target part: scripts/gates.

5. MEDIUM - Existing retained-artifact scanning is being reused for billing, but checkout-specific evidence needs stricter deny rules before any dry-run log is accepted. Evidence: `.env.example` includes placeholder Stripe assignments and a price map (`.env.example:99`-`108`); deployment docs require no webhook secrets, secret keys, signatures, raw Stripe bodies, Checkout Session IDs, customer IDs, headers, or provider responses in retained summaries (`docs/DEPLOYMENT.md:58`-`66`); the webhook replay preflight keeps summary evidence count/status-only and scans it (`tests/integration/billing-stripe-webhook-replay-preflight.test.ts:26`-`87`). Recommendation: checkout dry-run evidence should retain only normalized fields such as plan count, mode, price-id presence/shape, URL host/path class, and `network=not-run`; scanner rules should reject `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `sk_test_`, `sk_live_`, `whsec_`, `stripe-signature`, `https://checkout.stripe`, `cs_test_`, raw Authorization headers, and raw request bodies. Target part: evidence hygiene.

6. MEDIUM - Acceptance wording currently separates local webhook replay from real Stripe test checkout, but there is no matrix entry for a no-network checkout dry-run. Evidence: PG4 requires test-mode checkout if provider selected (`docs/ACCEPTANCE_MATRIX_MASTER.md:47`-`49`), defines local webhook replay preflight (`docs/ACCEPTANCE_MATRIX_MASTER.md:50`-`54`), and says live/test Stripe is done only with operator-provided `sk_test`, `whsec`, and `price_` IDs (`docs/ACCEPTANCE_MATRIX_MASTER.md:55`-`57`). Recommendation: treat Phase 3.40 as a pre-acceptance gate only: it may prove config/request construction and no-network safety, but must report Stripe test Checkout Session creation, Stripe CLI/Dashboard replay, staging confirmation, production key provisioning, and endpoint registration as NOT RUN. Target part: acceptance matrix / final reporting.

7. LOW - Metadata naming is inconsistent between current code and an older contract section, so the dry-run should pin current handler-compatible metadata and flag docs drift separately. Evidence: current checkout body writes `metadata[userId]`, `metadata[planCode]`, and subscription/payment metadata with the same keys (`packages/billing/src/stripe.ts:55`-`65`); webhook parsing reads `userId`, `user_id`, `planCode`, and `plan_code` (`packages/billing/src/stripe.ts:110`-`115`); the contract's older required metadata block names `wtc_user_id`, `wtc_plan_code`, and `wtc_product_code` (`docs/CONTRACTS/billing-webhooks.md:104`-`113`). Recommendation: dry-run should validate the current code path's metadata keys for now and raise a docs reconciliation task before production activation. Target part: billing contract drift.

## Decisions
- Recommended owner for pure checkout request-building and config validation: `packages/billing`, exported through `packages/billing/src/index.ts`.
- Recommended owner for deployment/runtime environment loading: `packages/config`, with Stripe-specific validation added there instead of duplicating `process.env` parsing in app helpers.
- Recommended owner for operator dry-run orchestration: a root `scripts/*` command exposed as an explicit `accept:billing:stripe-checkout` npm script.
- Checkout dry-run should be no-network by default and should not create pending-payment rows; real test-mode checkout acceptance is a separate operator-approved phase.
- Default gates should continue to exclude billing preflights that may touch provider-shaped config, external services, retained evidence, or local servers.

## Risks
- If dry-run logic is implemented only in a script, it will drift from `createStripeProvider().createCheckout()` and recreate one-file prototype behavior.
- If dry-run calls `createStripeCheckout`, it can hit Stripe test-mode REST and mutate local DB pending-payment state when env is configured.
- If `STRIPE_PRICE_MAP` remains outside typed config, malformed JSON, missing plan mappings, or non-`price_` values will be detected late and inconsistently.
- If retained evidence includes raw request bodies or keys, `secret:scan` alone may not catch every Stripe-shaped leak.
- A green no-network checkout dry-run can be overstated as Stripe Checkout acceptance unless final reports explicitly list real provider gates as NOT RUN.

## Verification/tests
- RUN: read-only inspection of package boundaries, scripts, docs, acceptance matrix, and existing billing tests.
- NOT RUN: `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run accept:billing:stripe-webhook`, Playwright, dev server, Stripe CLI/Dashboard, or any real Checkout Session creation. Reason: platform-architect scope was read-only except this handoff, and checkout execution can perform provider/network or DB mutations when configured.
- NOT RUN: git diff/status verification beyond a failed local `git status --short`. Reason: `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform` is not a git repository from this working directory.

## Next actions
1. Backend/platform implementer: extract pure Stripe checkout request/config helpers into `@wtc/billing`, export them, and update `createStripeProvider().createCheckout()` to use the same helper.
2. Config/devops implementer: add typed `STRIPE_PRICE_MAP` and Stripe-specific `BILLING_PROVIDER=stripe` validation to `@wtc/config`; reject live keys for local/test-mode acceptance.
3. Tests-runner: add focused package tests for request body construction, URL validation, price-map shape, no-network dry-run, and default-gate exclusion.
4. Security auditor: define Stripe checkout retained-evidence deny rules before any logs are archived.
5. Operator/aggregate: keep real Stripe Checkout Session creation, Stripe CLI/Dashboard webhook replay, production key provisioning, endpoint registration, and staging confirmation marked NOT RUN until explicitly observed with operator-provided test credentials and redacted evidence.
