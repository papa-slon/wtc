# ecosystem-security-auditor handoff
## Scope
Phase 3.40 read-only security audit for a Stripe checkout config/request dry-run preflight. Inspected checkout secret handling, price-map and env risks, retained artifact/log risks, and whether a dry-run can avoid Stripe network calls and live keys. No live Stripe call, live server mutation, DB mutation, product-code edit, or documentation edit was performed outside this handoff.
## Files inspected
- `AGENTS.md`
- `.env.example`
- `package.json`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/features/billing/plans.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe-replay.ts`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `packages/config/src/env.ts`
- `packages/db/src/repositories.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`
## Files changed
None - read-only audit except this handoff (`docs/handoffs/20260602-0751-ecosystem-security-auditor.md`).
## Findings
1. Severity: High. There is no dedicated checkout config/request dry-run command, and the only current `accept:billing:*` command is webhook replay. Evidence: `package.json:30`-`package.json:32` exposes LMS preflights plus `accept:billing:stripe-webhook`, but no checkout preflight; `scripts/billing-stripe-webhook-replay-preflight.mjs:33`-`scripts/billing-stripe-webhook-replay-preflight.mjs:39` documents webhook replay only; `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:59`-`docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:61` explicitly kept checkout creation out of Phase 3.39. Recommendation: add a separate opt-in checkout dry-run that validates env/price map, constructs the exact request fields, records redacted counts/status only, and never calls `createCheckout` or Stripe. Target part: checkout preflight entry point.
2. Severity: High. The provider checkout method is a real network mutation boundary, so a dry-run must not call it with an unmocked fetch or a real key. Evidence: `packages/billing/src/stripe.ts:76`-`packages/billing/src/stripe.ts:88` posts to `https://api.stripe.com/v1/checkout/sessions` with `Authorization: Bearer ${opts.secretKey}`; `apps/web/src/features/billing/checkout.ts:123`-`apps/web/src/features/billing/checkout.ts:133` creates the provider and awaits `provider.createCheckout`; `apps/web/src/app/(app)/app/billing/page.tsx:34`-`apps/web/src/app/(app)/app/billing/page.tsx:44` then records pending payment and redirects. Recommendation: implement dry-run at a pure request-body/config layer or with mandatory injected/mocked fetch and a process-level network tripwire; do not reuse the server action. Target part: no-network/no-provider-mutation boundary.
3. Severity: Medium. App-level checkout rejects live secret keys, but the lower-level Stripe provider does not enforce test-mode keys by itself. Evidence: `apps/web/src/features/billing/checkout.ts:111`-`apps/web/src/features/billing/checkout.ts:118` rejects missing keys and non-`sk_test_` keys before app checkout; `packages/billing/src/provider.ts:115`-`packages/billing/src/provider.ts:116` makes `checkoutAvailability` unavailable for non-test keys; `packages/billing/src/stripe.ts:70`-`packages/billing/src/stripe.ts:88` accepts any non-empty `secretKey` passed to `createStripeProvider` and sends it to Stripe. Recommendation: either move the test-mode/live-key fence into `@wtc/billing` provider creation or make the checkout dry-run assert it never instantiates the provider with any `STRIPE_SECRET_KEY`; live Stripe acceptance should require a separate explicit operator gate. Target part: secret handling defense-in-depth.
4. Severity: Medium. Price-map parsing is permissive and not part of the typed config spine, so a dry-run should fail fast on malformed JSON, unknown plan keys, missing purchasable plans, duplicate/conflicting entries, non-`price_` values, and accidental live/prod price maps before any server or Stripe action. Evidence: `apps/web/src/features/billing/checkout.ts:21`-`apps/web/src/features/billing/checkout.ts:44` parses JSON or comma pairs directly from `process.env.STRIPE_PRICE_MAP`; `apps/web/src/features/billing/checkout.ts:57`-`apps/web/src/features/billing/checkout.ts:63` only checks the selected plan has a price id and products; `packages/config/src/env.ts:58`-`packages/config/src/env.ts:60` includes Stripe provider/key fields but no `STRIPE_PRICE_MAP`; `.env.example:106`-`.env.example:108` uses placeholders. Recommendation: preflight should use generated fake `price_...` IDs or redacted operator-supplied test IDs, validate the full selected map, and avoid retaining raw map values. Target part: price-map/env validation.
5. Severity: Medium. Checkout request metadata has contract drift that a request dry-run should surface before live/test Stripe acceptance. Evidence: `packages/billing/src/stripe.ts:55`-`packages/billing/src/stripe.ts:66` sends `client_reference_id`, `metadata[userId]`, `metadata[planCode]`, and mode-specific metadata; `packages/billing/src/stripe.ts:111`-`packages/billing/src/stripe.ts:112` parses `userId`/`user_id` and `planCode`/`plan_code`; `docs/CONTRACTS/billing-webhooks.md:104`-`docs/CONTRACTS/billing-webhooks.md:112` still specifies `wtc_user_id`, `wtc_plan_code`, and `wtc_product_code`. Recommendation: make the dry-run assert the canonical metadata keys expected by both checkout creation and webhook parsing, then reconcile the contract in an implementation/docs lane. Target part: checkout/webhook contract consistency.
6. Severity: Low. Retained artifact scanning now has Stripe leak rules, but the scanner is still LMS-named and default roots do not include checkout preflight evidence. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`scripts/scan-lms-db-e2e-artifacts.mjs:52` rejects Stripe key assignments, key tokens, webhook secrets, signatures, raw event bodies, and checkout session IDs; `scripts/scan-lms-db-e2e-artifacts.mjs:5` defaults to LMS/e2e roots only; `tests/integration/billing-stripe-webhook-replay-preflight.test.ts:78`-`tests/integration/billing-stripe-webhook-replay-preflight.test.ts:83` explicitly scans the webhook preflight temp log root. Recommendation: checkout dry-run should write to its own temp/evidence root and invoke the scanner explicitly, or add a billing-named wrapper with Stripe checkout URL/session/key/body/header deny rules. Target part: artifact/log retention.
## Decisions
- Treat Phase 3.40 as checkout dry-run preflight planning/audit only: no Stripe CLI, no Dashboard action, no checkout session creation, no live server, no DB write, and no production key provisioning.
- A safe checkout dry-run can avoid Stripe network calls and live keys only if it does not call `provider.createCheckout` unmocked; it should validate config and construct/summarize the request locally.
- Existing webhook replay preflight evidence is useful but not sufficient for checkout request acceptance because it deliberately excludes checkout creation.
## Risks
- A future operator script that uses `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and the billing page/server action can create real Stripe test Checkout Sessions and pending-payment rows.
- A direct package-level call to `createStripeProvider({ secretKey: 'sk_live_...' })` is not blocked inside `@wtc/billing`.
- Raw Stripe errors, checkout URLs, `cs_test_` IDs, Authorization headers, copied `.env` values, or full price maps could be retained unless the checkout dry-run uses redacted summaries plus artifact scanning.
- The metadata-key drift can make external runbooks or manually created Stripe sessions incompatible with the current webhook parser.
## Verification/tests
- Read-only inspection only; no test suite was run in this lane.
- Existing relevant evidence inspected: `packages/billing/src/stripe.test.ts:78`-`packages/billing/src/stripe.test.ts:127` mocks checkout fetch and asserts request body fields; `packages/billing/src/provider.test.ts:55`-`packages/billing/src/provider.test.ts:69` covers live-key rejection in availability; `tests/integration/billing-checkout-phase34.test.ts:31`-`tests/integration/billing-checkout-phase34.test.ts:66` proves pending payment does not grant access.
- Existing Phase 3.39 aggregate reports focused billing/replay tests and webhook dry-run artifact scan passing at `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:82`-`docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:87`; not rerun here.
## Next actions
1. Add an opt-in `accept:billing:stripe-checkout-config` dry-run that refuses `APP_ENV=production`, refuses `sk_live_`, performs no network I/O, validates `STRIPE_PRICE_MAP`, constructs the checkout request locally, and writes redacted evidence only.
2. Move or duplicate the `sk_test_` enforcement into the `@wtc/billing` Stripe provider layer, or expose a pure checkout request builder that cannot perform network I/O.
3. Reconcile checkout metadata keys between code and `docs/CONTRACTS/billing-webhooks.md`.
4. Add tests that prove the checkout dry-run stays out of default gates, does not read or retain `STRIPE_SECRET_KEY`, rejects live keys, rejects malformed price maps, and passes retained-artifact scanning.
