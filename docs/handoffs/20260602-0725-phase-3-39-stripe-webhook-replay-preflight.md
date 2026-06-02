# Phase 3.39 Stripe webhook replay preflight handoff
## Scope
Implement a local, no-Stripe-network billing acceptance preflight after Phase 3.38. This phase adds shared Stripe replay
fixture helpers in `@wtc/billing`, a dry-run-first `accept:billing:stripe-webhook` command, redacted summary evidence, and
artifact scanner rules for Stripe webhook replay evidence. It does not run Stripe CLI/Dashboard replay, create a Stripe
Checkout Session, provision production keys, register a production webhook endpoint, start a live server, or mutate live DBs.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0725-ecosystem-billing-access-auditor.md](20260602-0725-ecosystem-billing-access-auditor.md)
- [docs/handoffs/20260602-0725-ecosystem-security-auditor.md](20260602-0725-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0725-ecosystem-backend-implementer.md](20260602-0725-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0725-ecosystem-platform-architect.md](20260602-0725-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0725-ecosystem-tests-runner.md](20260602-0725-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0725-ecosystem-devops-implementer.md](20260602-0725-ecosystem-devops-implementer.md)

All six background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/billing/src/webhook.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/index.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
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
- `docs/CONTRACTS/billing-webhooks.md`
## Files changed
- `packages/billing/src/stripe-replay.ts`
- `packages/billing/src/stripe-replay.test.ts`
- `packages/billing/src/index.ts`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `package.json`
- `.env.example`
- current docs and this aggregate handoff.
## Findings
1. High - B2 had route-handler and package tests but no operator-safe replay/preflight command. Implemented:
   `scripts/billing-stripe-webhook-replay-preflight.mjs` and `accept:billing:stripe-webhook`. The command uses disposable
   PGlite, generated fake `whsec_` fixtures, and the extracted `handleBillingWebhookRequest` path. Target part: Stripe replay
   preflight command boundary.
2. High - Retained billing replay evidence could leak webhook secrets, signatures, raw provider event bodies, checkout IDs,
   or secret-key values. Implemented: artifact scanner deny rules for Stripe secret assignments/tokens, `stripe-signature`,
   `t=...,v1=...`, raw `"object":"event"` bodies, and `cs_test_` / `cs_live_` identifiers. Target part: evidence no-leak guard.
3. High - Checkout creation is real and can call Stripe test-mode REST when configured, so it must stay out of this local
   replay phase. Implemented: preflight does not read `STRIPE_SECRET_KEY`, does not call checkout code, performs no Stripe
   network I/O, and refuses `APP_ENV=production`. Target part: no-provider-mutation boundary.
4. Medium - Replay fixtures and retained summaries need a package-owned contract instead of one-off script JSON. Implemented:
   `packages/billing/src/stripe-replay.ts` owns fixture construction, signed `Request` creation, webhook-secret shape checks,
   and sanitized case summaries. Target part: billing package boundary.
5. Medium - The preflight must stay opt-in. Implemented: tests assert `accept:billing:stripe-webhook` is absent from
   `ci:local`, default `e2e`, and `scripts/gates.mjs`. Target part: gate safety.
## Decisions
- Keep Phase 3.39 local-only: no Stripe CLI, no Dashboard replay, no checkout session creation, no live server, and no
  production key provisioning.
- Use `node --import tsx` for the command because the repo package graph contains TypeScript syntax that direct Node
  strip-only mode cannot execute through `@wtc/db`.
- Reuse the existing extracted webhook handler instead of adding a second webhook application path.
- Store only count/status summaries under `logs/billing-stripe-webhook-preflight`; raw bodies, signatures, webhook secrets,
  checkout sessions, and Stripe secret keys remain non-retained.
## Risks
- Local signed fixtures prove WTC HMAC verification, handler ordering, durable ledger behavior, entitlement transitions, and
  manual-review behavior, but they do not prove Stripe CLI forwarding, Dashboard endpoint config, Stripe event variants,
  proxy raw-body preservation, real-Postgres concurrency, or production secret storage.
- Checkout creation remains test-mode-only locally and still needs an operator-provided Stripe test-key/price acceptance run.
- Production Stripe readiness still needs key provisioning, endpoint registration, lifecycle/refund/chargeback observations,
  and deployment evidence.
## Verification/tests
- Focused billing/replay tests: `npm test -- packages/billing/src/stripe-replay.test.ts packages/billing/src/stripe.test.ts tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/billing-stripe-webhook-replay-preflight.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`55` passed).
- `node --check scripts/billing-stripe-webhook-replay-preflight.mjs` - PASS.
- Dry-run replay preflight with temp evidence root: `npm run accept:billing:stripe-webhook -- --dry-run` plus
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
- NOT RUN: Stripe CLI/Dashboard webhook replay, Stripe Checkout Session creation against Stripe, production key provisioning,
  production webhook endpoint registration, live/staging server route replay, real-Postgres Stripe route acceptance, CI via
  GitHub Actions.
## Next actions
- Run Stripe CLI/Dashboard replay only when operator-provided test-mode `sk_test`, `whsec`, and `price_` IDs are supplied,
  then scan retained evidence before archiving.
- Add a separate test-mode checkout acceptance phase that creates a real Stripe test Checkout Session and proves
  pending_payment to active via replayed webhook.
- Keep production Stripe activation blocked until production secrets, endpoint registration, lifecycle events, and deployment
  evidence are observed.
