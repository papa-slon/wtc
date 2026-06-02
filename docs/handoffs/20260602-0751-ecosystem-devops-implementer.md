# ecosystem-devops-implementer handoff
## Scope
Phase 3.40 read-only devops/env/runbook audit for Stripe checkout configuration and request dry-run preflight. Scope covered environment templates, deployment/runbook docs, package scripts, Stripe checkout provider/request code, price-map expectations, billing blocker docs, and the current acceptance matrix. No product code, product docs, servers, databases, Stripe APIs, Stripe CLI, live endpoints, SSH, tmux, systemd, preview/prod services, or bot/exchange services were touched.

## Files inspected
- `.env.example`
- `package.json`
- `apps/web/package.json`
- `packages/billing/package.json`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `packages/billing/src/provider.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/config/src/env.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `tests/integration/billing-checkout-phase34.test.ts`

## Files changed
- `docs/handoffs/20260602-0751-ecosystem-devops-implementer.md`

## Findings
1. Severity: High. Evidence: `packages/billing/src/stripe.ts:2` to `packages/billing/src/stripe.ts:3` states checkout creation is a real Stripe REST call and never faked; `packages/billing/src/stripe.ts:80` to `packages/billing/src/stripe.ts:88` posts to `https://api.stripe.com/v1/checkout/sessions`; `docs/DEPLOYMENT.md:44` to `docs/DEPLOYMENT.md:66` documents only the no-network webhook replay preflight; `package.json:32` exposes only `accept:billing:stripe-webhook`; `docs/PRODUCTION_BLOCKERS_CURRENT.md:11` to `docs/PRODUCTION_BLOCKERS_CURRENT.md:14` says real Stripe test checkout acceptance remains NOT RUN. Recommendation: before any operator runs real checkout, add or document a separate checkout request preflight with an explicit dry-run/non-network mode that builds and redacts the intended request parameters, plus a separate live test-mode mode gated on operator-provided throwaway `sk_test`, `whsec`, and `price_` values. Target part: Stripe checkout runbook and preflight boundary.
2. Severity: High. Evidence: `.env.example:106` to `.env.example:108` contains placeholder values that satisfy loose prefix expectations (`sk_test_replace...`, `whsec_replace...`, `price_replace...`); `apps/web/src/features/billing/checkout.ts:66` to `apps/web/src/features/billing/checkout.ts:98` makes the CTA available from env-derived availability; `packages/billing/src/provider.ts:115` to `packages/billing/src/provider.ts:121` only requires `sk_test_` and a non-empty price map for availability. Recommendation: operator guardrail should refuse known placeholder values before enabling `BILLING_PROVIDER=stripe`, and the planned checkout preflight should print redacted config status such as provider=stripe, key=test, webhook=present, price-map-plans=N, placeholders=0 rather than raw values. Target part: Stripe env activation guard.
3. Severity: Medium. Evidence: `apps/web/src/features/billing/checkout.ts:21` to `apps/web/src/features/billing/checkout.ts:43` parses `STRIPE_PRICE_MAP` from JSON or comma pairs without validating Stripe price-id shape; `apps/web/src/features/billing/checkout.ts:57` to `apps/web/src/features/billing/checkout.ts:63` silently returns null for a plan with no price id; `packages/billing/src/provider.ts:118` to `packages/billing/src/provider.ts:121` treats any non-empty map as checkout-available; `packages/billing/src/provider.test.ts:67` to `packages/billing/src/provider.test.ts:70` covers only one configured plan. Recommendation: the operator checklist should require a plan-by-plan price map audit against current `PLANS`, confirm every self-serve plan maps to a Stripe test `price_` id in the intended account, and mark per-plan gaps as NOT RUN instead of partial green. Target part: price-map readiness.
4. Severity: Medium. Evidence: `packages/config/src/env.ts:58` to `packages/config/src/env.ts:60` validates `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` but does not include `STRIPE_PRICE_MAP`; `apps/web/src/features/billing/checkout.ts:21` reads `STRIPE_PRICE_MAP` directly from `process.env`. Recommendation: keep runtime activation guarded by a preflight until config-level validation covers `STRIPE_PRICE_MAP` syntax, placeholder rejection, and test-vs-live key policy. Target part: config/env validation boundary.
5. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/billing/page.tsx:27` to `apps/web/src/app/(app)/app/billing/page.tsx:45` creates a Stripe session, writes pending payment rows, then redirects to the returned URL; `apps/web/src/app/(app)/app/billing/page.tsx:31` to `apps/web/src/app/(app)/app/billing/page.tsx:32` requires a real `DATABASE_URL`; `tests/integration/billing-checkout-phase34.test.ts:31` to `tests/integration/billing-checkout-phase34.test.ts:47` proves pending_payment behavior locally, not a full live Stripe request/webhook round trip. Recommendation: live test-mode acceptance must use a disposable user/account and a non-production database, then archive only redacted command summary, checkout outcome status, webhook outcome, and artifact scan result; do not archive Checkout Session IDs, customer IDs, raw provider bodies, signatures, or secrets. Target part: live test-mode acceptance evidence.
6. Severity: Low. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:46` to `docs/ACCEPTANCE_MATRIX_MASTER.md:57` correctly distinguishes local replay from live/test Stripe gates; `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:97` to `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:99` lists Stripe CLI/Dashboard replay, checkout creation, production key provisioning, endpoint registration, live/staging route replay, and real-Postgres route acceptance as NOT RUN. Recommendation: preserve this distinction in Phase 3.40 aggregate reporting; do not convert local replay or code inspection into Stripe acceptance. Target part: acceptance reporting.

## Decisions
- Treated `accept:billing:stripe-webhook` as a local fake-webhook replay gate only, not checkout creation acceptance.
- Did not run `npm run dev`, `npm run start`, Playwright, Stripe CLI, Stripe API calls, DB migrations, seeds, or any live service command.
- Did not inspect or mutate any `.env` file; only `.env.example` was inspected.
- Kept this handoff as the sole write.

## Risks
- A copied `.env.example` with `BILLING_PROVIDER=stripe` plus placeholder-looking Stripe values can expose a checkout CTA and then fail only at Stripe request time.
- A partial `STRIPE_PRICE_MAP` can enable the global checkout CTA while individual plans quietly fall back to support/contact behavior.
- Without a checkout request dry-run, the first true validation of request payload, account, key, price IDs, redirect URLs, and database pending-payment side effects happens during a real Stripe test-mode session.
- Live test-mode evidence can leak secrets, signatures, raw provider bodies, checkout/customer IDs, or response payloads unless scanner/redaction rules are applied before archival.

## Verification/tests
- RUN: read-only source/document inspection with line-level evidence.
- RUN: `git status --short` attempted from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`; result: not a git repository from this directory, so no git-backed cleanliness claim is made.
- NOT RUN: `npm run accept:billing:stripe-webhook -- --dry-run`; reason: scope was audit of checkout configuration/request dry-run preflight, and Phase 3.39 already records this local replay gate.
- NOT RUN: Stripe Checkout Session creation; reason: no operator-provided real Stripe test `sk_test` and `price_` values, and the code path performs real provider network I/O.
- NOT RUN: Stripe CLI/Dashboard webhook replay; reason: no operator-provided webhook endpoint/`whsec` and no live/staging route acceptance in scope.
- NOT RUN: production key provisioning, production webhook endpoint registration, live/staging server route replay, real-Postgres Stripe route acceptance, preview/prod server checks, Playwright, SSH, tmux, systemd, bot/exchange services; reason: forbidden or outside this read-only audit scope.

## Next actions
1. Add or schedule a Stripe checkout request preflight/runbook slice with two explicit modes: no-network redacted request dry-run and operator-approved live test-mode acceptance.
2. Add placeholder rejection for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP` before any self-serve checkout activation.
3. Add a price-map audit that validates every self-serve plan expected by the operator has a non-placeholder Stripe test `price_` id; report per-plan gaps as NOT RUN.
4. When real test keys are supplied, run against a disposable non-production database and disposable test Stripe customer/session only, then scan retained evidence before archive.
5. Keep B2 production blocked until observed Stripe test checkout, Stripe CLI/Dashboard webhook replay, production key provisioning, production webhook endpoint registration, and deployment route replay are all separately green.
