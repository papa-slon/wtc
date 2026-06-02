# ecosystem-platform-architect handoff
## Scope
Read-only platform/architecture audit for Phase 3.39 local Stripe webhook replay/preflight slice. Scope was package boundaries, gate scripts, deployment docs, production blockers, and existing billing contracts. No product code or canonical docs were edited.

## Files inspected
- `AGENTS.md`
- `package.json`
- `.env.example`
- `scripts/gates.mjs`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/middleware.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/webhook.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/db-0003.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
None - read-only audit except this handoff:
- `docs/handoffs/20260602-0725-ecosystem-platform-architect.md`

## Findings
1. HIGH - Put replay/preflight orchestration outside the webhook route and outside React files. Evidence: the route is intentionally thin and delegates to `handleBillingWebhookRequest` (`apps/web/src/app/api/billing/webhook/route.ts:17`, `apps/web/src/app/api/billing/webhook/route.ts:20`); domain verification/mapping lives in `@wtc/billing` (`packages/billing/src/webhook.ts:17`, `packages/billing/src/webhook.ts:67`, `packages/billing/src/stripe.ts:99`); durable mutation/idempotency lives in DB repositories (`packages/db/src/repositories.ts:2698`, `packages/db/src/repositories.ts:2735`, `packages/db/src/repositories.ts:2781`). Recommendation: create any local replay/preflight as a root script entry point that calls package/app helpers, e.g. `scripts/stripe-webhook-replay-preflight.mjs` or `.ts`, with reusable pure parsing/building helpers in `packages/billing` if needed and mutation assertions through `apps/web/src/features/billing/webhook-handler.ts`. Target part: platform boundary / scripts / billing package.

2. HIGH - Do not implement replay by inserting entitlement, audit, or webhook rows directly. Evidence: the handler claims the durable ledger before mutation (`apps/web/src/features/billing/webhook-handler.ts:170`), routes unresolved events to manual review before any entitlement grant (`apps/web/src/features/billing/webhook-handler.ts:216`, `apps/web/src/features/billing/webhook-handler.ts:242`), applies entitlement changes through `applyStripeEvent` (`apps/web/src/features/billing/webhook-handler.ts:269`), and only then marks the ledger applied (`apps/web/src/features/billing/webhook-handler.ts:280`). The DB schema defines the ledger and review queue as owned tables with unique provider/event constraints (`packages/db/src/schema.ts:814`, `packages/db/src/schema.ts:845`). Recommendation: preflight should exercise the same signed-request path or the same handler function against a throwaway DB; any dry-run mode should stop before DB mutation and report "NOT RUN" for replay. Target part: mutation boundary / DB safety.

3. MEDIUM - Replay/preflight must explicitly separate local dry-run, local throwaway-DB replay, and live Stripe CLI replay. Evidence: `.env.example` says `STRIPE_WEBHOOK_SECRET` is required for webhook processing and `STRIPE_SECRET_KEY` is required for checkout creation (`.env.example:102`, `.env.example:103`, `.env.example:105`); production blockers state Stripe CLI/test webhook replay and production key provisioning are still NOT RUN (`docs/PRODUCTION_BLOCKERS_CURRENT.md:11`). Recommendation: model the new slice like the LMS preflight pattern: `--dry-run` validates env/fixture/headers with no network or DB mutation; `--replay-local` requires a fresh `wtc_test*` database; live Stripe CLI replay requires explicit operator consent and redacted artifacts. Target part: preflight UX / acceptance evidence.

4. MEDIUM - The current local middleware intentionally never rate-limits `/api/billing/webhook`; production rate limiting is a deployment/proxy concern. Evidence: middleware says the webhook is excluded and must never be rate-limited locally (`apps/web/src/middleware.ts:25`, `apps/web/src/middleware.ts:73`, `apps/web/src/middleware.ts:114`), while the contract requires endpoint rate limits and Stripe IP allowlisting at the edge (`docs/CONTRACTS/billing-webhooks.md:337`, `docs/CONTRACTS/billing-webhooks.md:384`). Recommendation: do not add in-app rate limiting inside preflight or the handler; the preflight should instead verify documentation/config readiness for the reverse-proxy gate and report it separately as NOT RUN unless a proxy config is actually inspected. Target part: deployment boundary.

5. MEDIUM - Existing tests cover local handler/repository replay paths, but the architecture still needs an acceptance wrapper for operator-grade evidence. Evidence: route-handler tests verify signed valid checkout duplicate replay and in-flight duplicate 500 behavior (`tests/integration/billing-webhook-route-handler.test.ts:123`, `tests/integration/billing-webhook-route-handler.test.ts:142`); hardening tests verify missing/unknown plan manual-review ledger paths (`tests/integration/billing-webhook-hardening.test.ts:117`, `tests/integration/billing-webhook-hardening.test.ts:137`); real-Postgres has cross-connection concurrent `insertWebhookEventOnce` proof (`tests/integration/db-real-postgres.test.ts:141`). Recommendation: add a script-level preflight that consumes committed fixtures, runs the existing handler against a fresh DB, writes redacted logs, and scans artifacts; do not duplicate the business assertions in a standalone prototype. Target part: tests-runner / acceptance gate.

6. LOW - Some architecture docs still contain stale TARGET text around API routes even though later sections and source show the webhook route exists. Evidence: `docs/ARCHITECTURE.md:135`, `docs/ARCHITECTURE.md:177`, and `docs/ARCHITECTURE.md:235` say the API route surface is target/planned, while `docs/ARCHITECTURE.md:528`, `docs/ARCHITECTURE.md:549`, and `docs/ARCHITECTURE.md:580` describe the current route/ledger. Recommendation: do not fix this in Phase 3.39 unless docs cleanup is explicitly in scope; use source + billing contracts as the binding basis for implementation planning. Target part: docs drift.

## Decisions
- Recommended owner for replay/preflight orchestration: `scripts/*` entry point, because this is an operator/local acceptance slice, not runtime product behavior.
- Recommended owner for reusable Stripe fixture/signature/parsing helpers: `packages/billing`, because verification and provider normalization already live there.
- Recommended owner for state-changing replay behavior: existing `apps/web/src/features/billing/webhook-handler.ts` plus `@wtc/db` repositories, not direct SQL and not React/server component code.
- Recommended evidence model: dry-run first, then throwaway-DB local replay, then live Stripe CLI/test replay only with explicit operator approval and secret-redacted artifacts.

## Risks
- A one-file replay script that parses JSON, inserts rows, or grants entitlements directly would bypass the verified ledger/manual-review/entitlement pipeline.
- A dry-run that signs/verifies a fixture but never hits `handleBillingWebhookRequest` should not be accepted as replay proof.
- PGlite tests are useful but not enough for cross-connection duplicate acceptance; the real-PG harness remains the stronger proof for concurrent ledger behavior.
- Live Stripe replay needs strict artifact redaction: no webhook secret, signature header, raw payment payload, customer email, or raw provider body in logs/screenshots.
- The repository is not git-backed in this workspace (`git status` failed with "not a git repository"), so no branch/commit safety signal is available here.

## Verification/tests
- Read-only audit only.
- No product gates were run.
- `git status --short` was attempted and failed because this workspace is not a git repository.
- Existing relevant gate entry points observed: `node scripts/gates.mjs core|full|e2e`, `npm test`, `npm run check:core`, and the existing billing integration tests.

## Next actions
1. Backend/platform implementer: add a local Stripe replay/preflight script that calls existing package/handler code, supports `--dry-run` and a guarded throwaway-DB replay mode, and writes redacted evidence under `logs/stripe-webhook-preflight`.
2. Billing/security auditor: define the exact fixture allowlist, redaction denylist, and live Stripe CLI consent flags before any live replay.
3. Tests-runner: wire focused acceptance around the script without replacing existing billing-webhook unit/integration coverage.
4. Devops: document the production edge requirements separately from app middleware: direct-origin webhook path, proxy rate limit, Stripe IP allowlist, and no raw body logging.
