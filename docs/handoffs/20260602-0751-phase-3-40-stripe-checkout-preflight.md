# Phase 3.40 Stripe checkout preflight handoff
## Scope
Implement a local, no-Stripe-network checkout readiness preflight after Phase 3.39. This phase moves Stripe checkout request
construction and price-map parsing into `@wtc/billing`, adds a dry-run-first `accept:billing:stripe-checkout` command, and
hardens retained-artifact scanning for checkout request evidence. It does not create a Stripe Checkout Session, call Stripe
APIs, write pending-payment entitlements, run Stripe CLI/Dashboard replay, provision production keys, or start a live server.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0751-ecosystem-billing-access-auditor.md](20260602-0751-ecosystem-billing-access-auditor.md)
- [docs/handoffs/20260602-0751-ecosystem-security-auditor.md](20260602-0751-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0751-ecosystem-backend-implementer.md](20260602-0751-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0751-ecosystem-platform-architect.md](20260602-0751-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0751-ecosystem-tests-runner.md](20260602-0751-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0751-ecosystem-devops-implementer.md](20260602-0751-ecosystem-devops-implementer.md)

All six background agents completed and were closed after their handoffs were collected.
## Files inspected
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/provider.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/gates.mjs`
- `package.json`
- `.env.example`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
## Files changed
- `packages/billing/src/stripe-checkout.ts`
- `packages/billing/src/stripe-checkout.test.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/index.ts`
- `apps/web/src/features/billing/checkout.ts`
- `scripts/billing-stripe-checkout-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/billing-stripe-checkout-preflight.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `package.json`
- `.env.example`
- current docs and this aggregate handoff.
## Findings
1. High - Checkout request construction lived inside the provider, while app price-map parsing lived in the web feature file,
   increasing drift risk for an operator dry-run. Implemented: `packages/billing/src/stripe-checkout.ts` owns price-map parsing,
   test-mode config validation, checkout body/request construction, and redacted summaries. Target part: shared checkout
   request boundary.
2. High - A checkout readiness preflight must never call Stripe or write pending-payment entitlements. Implemented:
   `scripts/billing-stripe-checkout-preflight.mjs` builds generated fake test-mode checkout requests in memory only, refuses
   `APP_ENV=production` or a live `sk_live_` key in the environment, and writes redacted summaries. Target part: no-provider-
   mutation boundary.
3. High - Retained checkout evidence could leak Stripe keys, price IDs, request fields, endpoints, or checkout session IDs.
   Implemented: artifact deny rules for Stripe price IDs, checkout endpoint paths, raw request field names, secret keys, and
   checkout session IDs. Target part: evidence no-leak guard.
4. Medium - The provider and web app need to consume the same request/config helpers as the preflight. Implemented:
   `createStripeProvider().createCheckout()` now uses shared request construction, and `apps/web` checkout config uses the
   shared `parseStripePriceMap`. Target part: package/app consistency.
5. Medium - The checkout preflight must remain opt-in. Implemented: tests assert `accept:billing:stripe-checkout` is absent
   from default `e2e`, `ci:local`, and `scripts/gates.mjs`. Target part: gate safety.
## Decisions
- Keep Phase 3.40 local-only: no real Stripe key use, no Checkout Session creation, no route/browser flow, no DB mutation, and
  no Stripe CLI/Dashboard replay.
- Use generated fake `sk_test_`, `whsec_`, and `price_` values only inside process memory; retained summaries replace them
  with redacted/count fields.
- Keep checkout request helpers in `@wtc/billing`; app code remains responsible for selecting plans and writing
  pending-payment rows only after a real provider session is created.
## Risks
- The dry-run proves request shape, test-mode config gates, and evidence hygiene, but not Stripe API acceptance, price IDs,
  Dashboard products, Checkout redirect behavior, or `pending_payment -> active` with real provider events.
- Production Stripe readiness still needs scoped test credentials, real Checkout Session creation, webhook replay, endpoint
  registration, deployment evidence, and production secret handling.
## Verification/tests
- Focused billing/checkout tests: `npm test -- packages/billing/src/stripe-checkout.test.ts packages/billing/src/stripe.test.ts packages/billing/src/provider.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/billing-stripe-checkout-preflight.test.ts tests/integration/billing-stripe-webhook-replay-preflight.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`48` passed).
- `node --check scripts/billing-stripe-checkout-preflight.mjs` - PASS.
- Dry-run checkout preflight with temp evidence root: `npm run accept:billing:stripe-checkout -- --dry-run` plus
  `node scripts/scan-lms-db-e2e-artifacts.mjs <temp-root>` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- `node scripts/gates.mjs full` - PASS (9/9 gates).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS.
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning; 6 cited per-agent handoffs all present).
- NOT RUN: real Stripe Checkout Session creation, Stripe CLI/Dashboard webhook replay, Stripe test price verification,
  pending-payment to active with provider events, production key provisioning, production webhook endpoint registration,
  live/staging server route replay, real-Postgres Stripe route acceptance, CI via GitHub Actions.
## Next actions
- Run real Stripe test checkout acceptance only when scoped operator test `sk_test`, `whsec`, and `price_` values are supplied.
- Pair the real checkout session with Stripe CLI/Dashboard webhook replay and scan retained evidence before archiving.
- Keep production Stripe activation blocked until production secrets, endpoint registration, lifecycle events, and deployment
  evidence are observed.
