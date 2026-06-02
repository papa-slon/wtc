# ecosystem-billing-access-auditor handoff
## Scope
Read-only billing audit for Phase 3.40: likely Stripe checkout configuration/request dry-run preflight after Phase 3.39. Inspected current checkout code, price-map parsing, env/docs, B2 blockers, and acceptance gates. Recommended the smallest no-credential slice that can move Stripe checkout readiness without calling Stripe APIs.

## Files inspected
- `AGENTS.md`
- `package.json`
- `.env.example`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/index.ts`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/entitlements/src/registry.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/features/billing/plans.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/(public)/pricing/page.tsx`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-0725-ecosystem-billing-access-auditor.md`
- `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`

## Files changed
`docs/handoffs/20260602-0751-ecosystem-billing-access-auditor.md` only. Product code, tests, scripts, and canonical docs were not edited.

## Findings
1. Severity: High. Checkout creation is already a real Stripe REST path, so any Phase 3.40 preflight must not exercise `createCheckout` directly unless the goal is a live/test Stripe run. Evidence: `packages/billing/src/stripe.ts:76`-`packages/billing/src/stripe.ts:88` posts to `https://api.stripe.com/v1/checkout/sessions` with `Authorization: Bearer ...`; `apps/web/src/features/billing/checkout.ts:123`-`apps/web/src/features/billing/checkout.ts:133` constructs the provider and calls `provider.createCheckout`; Phase 3.39 explicitly left checkout creation out of scope at `docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:59`-`docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md:61`. Recommendation: smallest no-credential slice should expose/package a pure checkout request builder or dry-run summarizer that returns redacted method/path/body keys/mode/metadata assertions without `fetch`, `STRIPE_SECRET_KEY`, or session URLs. Target part: Stripe checkout request dry-run preflight.
2. Severity: High. The current price-map parser can throw during page rendering when `STRIPE_PRICE_MAP` is malformed JSON, converting a configuration problem into a billing/pricing render failure instead of an unavailable CTA. Evidence: `apps/web/src/features/billing/checkout.ts:21`-`apps/web/src/features/billing/checkout.ts:31` calls `JSON.parse(trimmed)` with no catch; `checkoutCta` calls `parseStripePriceMap()` before availability handling at `apps/web/src/features/billing/checkout.ts:66`-`apps/web/src/features/billing/checkout.ts:73`; logged-in billing renders `checkoutCta(card.code)` for every card at `apps/web/src/app/(app)/app/billing/page.tsx:93`-`apps/web/src/app/(app)/app/billing/page.tsx:123`. Recommendation: add a no-credential parser/validator preflight and tests for malformed JSON, empty JSON, comma format, duplicate/unknown plan codes, and missing selected-plan prices; product code follow-up should fail closed with a specific "price map invalid" reason. Target part: price-map parsing and checkout CTA safety.
3. Severity: Medium. Existing checkout request-shape coverage uses a mocked global `fetch`, which proves body fields but still exercises the provider's network method boundary and embeds a fake `sk_test` Authorization expectation. Evidence: `packages/billing/src/stripe.test.ts:78`-`packages/billing/src/stripe.test.ts:107` stubs `globalThis.fetch` and expects the Authorization header; payment-mode coverage does the same at `packages/billing/src/stripe.test.ts:110`-`packages/billing/src/stripe.test.ts:126`. Recommendation: Phase 3.40 should add a pure no-secret checkout request dry-run proof that never constructs an Authorization header and never imports/uses a real secret-key env value. Target part: no-credential acceptance evidence.
4. Severity: Medium. The local webhook replay preflight is now present and opt-in, but it intentionally does not validate checkout request configuration. Evidence: `package.json:30`-`package.json:35` has `accept:billing:stripe-webhook` and keeps it out of `ci:local`; `scripts/billing-stripe-webhook-replay-preflight.mjs:33`-`scripts/billing-stripe-webhook-replay-preflight.mjs:39` describes signed fake webhook fixtures; `scripts/billing-stripe-webhook-replay-preflight.mjs:78`-`scripts/billing-stripe-webhook-replay-preflight.mjs:88` records `network: not-run`; `docs/DEPLOYMENT.md:60`-`docs/DEPLOYMENT.md:65` says the command does not read `STRIPE_SECRET_KEY`, create Checkout Sessions, or call Stripe APIs. Recommendation: add a separate `accept:billing:stripe-checkout-config -- --dry-run` instead of expanding the webhook replay command into checkout responsibilities. Target part: acceptance command separation.
5. Severity: Medium. B2 remains blocked specifically on real Stripe test checkout acceptance and Stripe CLI/Dashboard replay, but a no-credential slice can still reduce risk by proving local request shape and configuration failure modes. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:11`-`docs/PRODUCTION_BLOCKERS_CURRENT.md:14` says real Stripe test checkout acceptance with operator `sk_test`/`whsec`/`price_`, production keys, endpoint registration, and live/staging replay are NOT RUN; `docs/PRODUCTION_BLOCKERS.md:24`-`docs/PRODUCTION_BLOCKERS.md:33` requires test-mode checkout to pending_payment to active; `docs/ACCEPTANCE_MATRIX_MASTER.md:55`-`docs/ACCEPTANCE_MATRIX_MASTER.md:57` keeps live/test Stripe checkout and CLI/Dashboard replay as observed credentialed gates. Recommendation: report Phase 3.40 dry-run as "checkout request/config preflight implemented", not as live/test Stripe acceptance. Target part: B2 status honesty.
6. Severity: Medium. The checked-in env example demonstrates only two price mappings while the registry exposes ten sellable plan codes, so readiness cannot be inferred from the example map alone. Evidence: `.env.example:106`-`.env.example:108` maps only `tortila_monthly` and `bundle_starter`; `packages/entitlements/src/registry.ts:44`-`packages/entitlements/src/registry.ts:62` defines all plans and excludes only `admin_grant` from commercial cards via `apps/web/src/features/billing/plans.ts:14`-`apps/web/src/features/billing/plans.ts:25`. Recommendation: dry-run should summarize configured, missing, and unknown plan mappings and allow an explicit selected-plan subset; it should not require all catalog plans unless the operator opts into full-catalog readiness. Target part: price-map readiness reporting.
7. Severity: Medium. Public pricing copy is stale relative to current conditional self-serve checkout capability and could remain misleading after a checkout dry-run passes. Evidence: `apps/web/src/app/(public)/pricing/page.tsx:46`-`apps/web/src/app/(public)/pricing/page.tsx:48` calls `checkoutCta()` but comments that self-serve checkout is not enabled; visible copy at `apps/web/src/app/(public)/pricing/page.tsx:68`-`apps/web/src/app/(public)/pricing/page.tsx:78` says "No instant checkout" and "Self-serve checkout is not enabled in this build." Recommendation: keep public-page copy update out of this read-only lane, but include it in the smallest implementation slice after dry-run status is wired so public copy derives from the same availability result as app billing. Target part: public pricing truthfulness.
8. Severity: Low. Retained-artifact scanning already blocks Stripe webhook replay leakage patterns and should be reused for checkout dry-run evidence, with one additional focus on request-body/session-url leakage. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`scripts/scan-lms-db-e2e-artifacts.mjs:52` rejects Stripe secret assignments/tokens, signature values, raw event markers, and Checkout Session IDs; `tests/integration/lms-db-e2e-artifact-scan.test.ts:86`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:96` covers those deny rules; Phase 3.39 preflight tests assert summaries omit `sk_test_` and `cs_test_` at `tests/integration/billing-stripe-webhook-replay-preflight.test.ts:66`-`tests/integration/billing-stripe-webhook-replay-preflight.test.ts:75`. Recommendation: require the dry-run summary to store counts/statuses only and scan evidence before acceptance; extend scanner if the dry-run could emit `success_url`, `cancel_url`, customer emails, or URL-encoded request bodies. Target part: evidence redaction.

## Decisions
- The smallest no-credential slice is a dedicated Stripe checkout config/request dry-run, not a real Checkout Session creation and not a Stripe CLI replay.
- The dry-run should validate `BILLING_PROVIDER=stripe`, `STRIPE_WEBHOOK_SECRET` presence or fake-shape policy as needed for paired webhook readiness, `STRIPE_PRICE_MAP` parseability, selected plan coverage, plan mode (`payment` vs `subscription`), product expansion, `APP_BASE_URL` URL construction, and request-body metadata keys.
- The dry-run must not read or require `STRIPE_SECRET_KEY`, must reject/ignore live keys if present, must not create `pending_payment`, must not call `fetch`, and must write only redacted count/status evidence.
- Keep entitlements as the only access source of truth. A checkout dry-run can prove request shape; only a real test checkout plus verified webhook can prove pending_payment to active.
- Treat the existing local webhook replay preflight as supportive evidence for signed webhook handling, not checkout creation readiness.

## Risks
- A malformed `STRIPE_PRICE_MAP` can currently break billing/pricing render paths before a safe CTA fallback is returned.
- A mocked-fetch checkout test can be mistaken for no-network acceptance unless the new dry-run has a distinct no-credential command and summary.
- If the implementation tries to validate by calling `createStripeCheckout`, it can create real Stripe test sessions and pending-payment rows when env is configured.
- Passing a no-credential dry-run does not prove Stripe Dashboard products/prices, Stripe CLI forwarding, endpoint registration, provider API version behavior, or production secret-vault wiring.
- Public pricing text may continue to claim self-serve checkout is unavailable even when app billing becomes conditionally configured.

## Verification/tests
- RUN: read-only source, test, script, docs, and prior-handoff inspection with `rg` and `Get-Content` line-number review.
- RUN: workspace git status check attempted with `git status --short`; result was `fatal: not a git repository (or any of the parent directories): .git`.
- NOT RUN: `npm run accept:billing:stripe-webhook -- --dry-run`; `node scripts/scan-lms-db-e2e-artifacts.mjs`; focused billing Vitest suites; `npm test`; `npm run check:core`; `npm run lint`; `npm run typecheck`; `npm run typecheck -w @wtc/web`; `npm run secret:scan`; `npm run governance:check`; `node scripts/gates.mjs full`; `node scripts/gates.mjs e2e`; local dev server; Stripe CLI; Stripe Dashboard replay; Stripe Checkout Session creation; any Stripe API/network call; DB migrate/seed; live/staging route replay.

## Next actions
1. Add `accept:billing:stripe-checkout-config` as an opt-in dry-run command, separate from `accept:billing:stripe-webhook`, and keep it out of `ci:local`, default `scripts/gates.mjs`, and Playwright defaults.
2. Move or expose a pure checkout request-builder/dry-run helper in `@wtc/billing` or a billing-owned app helper that can summarize body fields without secrets, Authorization headers, `fetch`, or Checkout Session URLs.
3. Add parser/validator tests for `STRIPE_PRICE_MAP`: malformed JSON, empty input, JSON object, comma `plan=price` format, unknown plan code, missing selected plan, and one-time vs subscription plan mode.
4. Make the dry-run evidence redacted: configured-plan counts, missing/unknown plan lists, selected plan modes, required body-key presence, URL validity status, and `network=not-run`; no raw `price_`, no customer email, no URL-encoded body, no `sk_`, no `whsec_`, no `cs_`.
5. Run acceptance after implementation: focused checkout config tests, dry-run command, artifact scanner over the dry-run log root, `npm run secret:scan`, and then the existing relevant billing/webhook proof set. Keep real Stripe test checkout and Stripe CLI/Dashboard replay as NOT RUN until operator credentials are supplied.
6. In a follow-up docs/UI slice, reconcile public pricing copy and any operator docs so "self-serve unavailable" is conditional on checkout availability rather than hard-coded.
