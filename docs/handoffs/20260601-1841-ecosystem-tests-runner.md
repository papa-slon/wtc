# ecosystem-tests-runner handoff
## Scope
Read-only verification plan for phase epoch 20260601-1841. Focus areas: billing webhook route-handler harness, TradingView missing-task repair, and Axioma config/readiness. No source code, migrations, fixtures, full gates, e2e, live services, Stripe, TradingView, Axioma, bot, exchange, SSH, tmux, systemd, or preview operations were run or modified.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`
- `package.json`
- `scripts/gates.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `tests/integration/db-pg5.test.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Evidence: `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md:66` says Stripe route behavior is not covered by a direct Next route-handler harness; `apps/web/src/app/api/billing/webhook/route.ts:110` exports the actual `POST` path, and `tests/integration/billing-webhook-hardening.test.ts:157` currently uses source inspection for route status rules. Recommendation: add a no-live route-handler harness or extracted handler test that executes signed HTTP requests through the real route logic for missing signature, bad signature, missing user, unknown plan, duplicate terminal event, stale processing event, and processing-not-terminal retry behavior. Target part: billing webhook handler acceptance.
2. HIGH - Evidence: `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md:56` and `:92` leave TradingView historical missing-task recovery deferred; current code queues new revoke tasks inside `atomicRevokeTv` at `packages/db/src/repositories.ts:1808`, while `tests/integration/tv-access-hardening.test.ts:106` only proves the sweep no longer inserts tasks outside the atomic revoke path. Recommendation: when repair code lands, add PGlite tests for a pre-fix state where the request/grant is already revoked but no `tradingview_access_tasks` row exists, then prove the repair creates exactly one open revoke task, is idempotent on a second run, and does not create tasks for active/pending/done-task rows. Target part: TV missing-task repair.
3. HIGH - Evidence: `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md:55` leaves Axioma B4 activation incomplete; current readiness gates require explicit env and DB signals at `apps/web/src/features/terminal/axioma-routes.ts:25` through `:34`, but CTAs remain hard-disabled via `bridgeActionsImplemented: false` at `apps/web/src/features/terminal/loader.ts:107`. Recommendation: before enabling actions, add tests that cover unconfigured 503 responses, configured-but-no-user 401/redirect behavior, no-entitlement denial, success payload shape, JTI record, JWKS publication with key id, and no token-in-query regression. Target part: Axioma config/readiness and terminal CTAs.
4. MEDIUM - Evidence: `scripts/gates.mjs:43` through `:52` explicitly separates `e2e` from `full`; `package.json:25` defines `npm run e2e`, and `playwright.config.ts:23` through `:34` starts its own isolated server with mock bot mode and feature flags disabled. Recommendation: final operator verification after implementation must run `node scripts/gates.mjs full` and `npm run e2e` as separate observed commands, with DB env vars cleared for demo e2e unless a scoped DB phase is intended. Target part: final gate reporting.
5. MEDIUM - Evidence: `vitest.config.ts:8` includes `packages/**/*.test.ts` and `tests/integration/**/*.test.ts`, while `vitest.config.ts:9` excludes `apps/web/**`; app-route verification therefore belongs in `tests/integration` with an extracted handler seam or explicit route import strategy, not in `apps/web`. Recommendation: keep route harnesses under `tests/integration` and avoid relying only on static source matching for HTTP semantics. Target part: test placement and coverage strength.

## Decisions
- Did not run `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run e2e`, targeted Vitest, typecheck, lint, migrations, seeds, preview, or live/external operations in this agent lane.
- Treat the phase 3.8 aggregate as authoritative for remaining risk selection because it records the newest verified local pass and explicit next actions.
- Keep the verification plan no-live by default; real Stripe replay, real Axioma endpoint confirmation, and real Postgres acceptance should be separate scoped operator phases with explicit credentials and rollback boundaries.
- Require any future "full green" claim to list both `node scripts/gates.mjs full` and e2e separately, because this repository's `full` plan intentionally excludes Playwright.

## Risks
- A route-handler harness may require a small dependency-injection seam because the current webhook route imports `getServerDb()` directly and `apps/web/src/lib/backend.ts:1` imports `server-only`.
- Static tests currently prevent some regressions but cannot prove runtime HTTP status, header, body, stale-processing, or duplicate retry behavior.
- A TV repair test must model historical partial state directly; only testing fresh `sweepTvExpiry` behavior will not prove repair of old split states.
- Axioma readiness can become dishonest if tests only assert env presence and not CTA enablement, no-store responses, entitlement gating, JWKS shape, and token placement.
- Real endpoint compatibility remains unverified without live scoped Axioma and Stripe credentials.

## Verification/tests
Tests RUN by this lane:
- NOT RUN - read-only verification-plan lane; user explicitly instructed not to run full gates or e2e from the agent.

Recommended targeted no-live commands after implementation:
- `npm test -- tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook.test.ts`
- Add and run `npm test -- tests/integration/billing-webhook-route-handler.test.ts` if the webhook handler harness is created.
- `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/db-pg5.test.ts`
- Add and run `npm test -- tests/integration/tv-missing-task-repair.test.ts` if the repair scanner is created.
- `npm test -- packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts`
- Add and run focused route/readiness tests for `apps/web/src/app/api/axioma/download/route.ts`, `apps/web/src/app/api/axioma/journal-handoff/route.ts`, and `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` if B4 activation changes those endpoints.
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run check:core`

Recommended final operator gates, separate from this agent:
- `node scripts/gates.mjs full`
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`
- If scoped real DB acceptance is intended, run a separate throwaway-Postgres phase instead of reusing demo e2e assumptions.

## Next actions
1. Implement or request the webhook route-handler harness before claiming Stripe webhook HTTP retry/duplicate behavior complete.
2. Implement or request TradingView missing-task historical repair and prove it with a direct repair fixture, not only fresh expiry sweep coverage.
3. Implement or request Axioma readiness route tests before enabling terminal CTAs or claiming B4 activation.
4. After implementation, run the targeted commands above first, then run `node scripts/gates.mjs full` and e2e separately from the operator lane.
