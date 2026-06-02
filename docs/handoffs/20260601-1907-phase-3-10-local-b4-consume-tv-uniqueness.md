# Phase 3.10 local B4 consume + TV uniqueness handoff
## Scope
Local-only readiness slice for epoch `20260601-1907`. The phase implemented WTC-side Axioma JTI consume/replay readiness without live Axioma calls and hardened TradingView manual revoke task identity against duplicate `(request_id, kind)` rows. No live Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service was touched.

Read-only phase lanes dispatched before edits:
- [`docs/handoffs/20260601-1907-ecosystem-security-auditor.md`](20260601-1907-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-1907-ecosystem-db-architect.md`](20260601-1907-ecosystem-db-architect.md)
- [`docs/handoffs/20260601-1907-ecosystem-axioma-bridge-auditor.md`](20260601-1907-ecosystem-axioma-bridge-auditor.md)
- [`docs/handoffs/20260601-1907-ecosystem-tests-runner.md`](20260601-1907-ecosystem-tests-runner.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `docs/handoffs/20260601-1907-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-1907-ecosystem-db-architect.md`
- `docs/handoffs/20260601-1907-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260601-1907-ecosystem-tests-runner.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0008_eminent_tattoo.sql`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `packages/axioma-bridge/src/es256.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/INTEGRATION_MAP.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/TERMINAL_PRODUCT_AREA.md`

## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0008_eminent_tattoo.sql`
- `packages/db/migrations/meta/0008_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `packages/axioma-bridge/src/es256.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/INTEGRATION_MAP.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/TERMINAL_PRODUCT_AREA.md`

## Findings
1. HIGH - TradingView manual revoke tasks previously relied on repository-level read-before-insert checks. Phase 3.10 adds `tvat_request_kind_idx` on `(request_id, kind)`, dedupes historical task rows before creating the index, and uses conflict-safe inserts in both `atomicRevokeTv(... queueExternalRevokeTask)` and `repairMissingTvRevokeTasks`. Target part: TradingView task identity.
2. HIGH - Axioma had durable JTI repository primitives but no WTC HTTP boundary for Option A replay checks. Phase 3.10 adds a local fail-closed `POST /api/axioma/jti/consume` handler with injected DB/audit/env/clock, bearer service-token auth, UUID validation, no-store responses, and consume/replay audit rows. Target part: Axioma WTC-side consume/replay readiness.
3. MEDIUM - Axioma route readiness counted whitespace bridge tokens as present. Phase 3.10 now requires a trimmed non-empty `AXIOMA_BRIDGE_API_TOKEN` in the route readiness helper and consume handler. Target part: route activation safety.
4. MEDIUM - Axioma docs still used old audit names, old env names, and stale JWKS empty-state behavior. Phase 3.10 reconciles the local docs to current underscore audit codes, `AXIOMA_HANDOFF_SIGNING_KEY` / `AXIOMA_HANDOFF_KEY_ID`, and JWKS `503` fail-closed behavior. Target part: operator handoff accuracy.

## Decisions
- Keep terminal CTAs disabled. This phase advances WTC-side local route readiness only; it does not activate real Open Journal or Download UX.
- Do not call live Axioma. Endpoint-shape confirmation, production key provisioning, and Axioma acceptance of Option A vs Option B remain external B4 blockers.
- Keep TradingView access manual-only. The unique task index prevents duplicate manual revoke tasks; it does not add a task executor or browser automation.
- Preserve an unfinished TradingView task first when deduping historical duplicates, then fall back to the oldest completed task.
- Keep the Axioma JTI repository pure; route handlers own audit writes.

## Risks
- Real concurrent TradingView duplicate-task behavior is still best proven against a throwaway real Postgres database. PGlite and DDL shape are covered locally; the opt-in real-PG race case was not run because no `REAL_POSTGRES_DATABASE_URL` was provided.
- The Axioma consume route is local evidence, not live Axioma acceptance. The external team still must confirm endpoint shape, auth envelope, and whether Option A is used.
- Journal-handoff issuance is still not extracted into a dynamic route-level harness that proves CSRF, entitlement, JTI insert, signed token claims, and audit behavior under injected failure conditions.
- Axioma download remains fail-closed; no installer proxy/streaming or single-use download-token model was implemented.
- Axioma account-link OTC storage remains plaintext-shaped and must be migrated to hash-first storage before account-link activation.

## Verification/tests
RUN:
- `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts` - PASS, 38 passed / 1 skipped.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes after migration `0008`.
- `npm run governance:check` - PASS before full gate, current phase `20260601-1907`, 4 cited per-agent handoffs all present, 0 errors / 1 known historical warning.
- `node scripts/gates.mjs full` - PASS, 9 gates / 0 failing: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- Env-cleared `npm run e2e` first run - FAIL, 43 passed / 6 skipped / 1 failed. The failing mobile TV admin test hit `apiRequestContext.post: read ECONNRESET` against `/api/e2e/login`; failure artifact showed the expected admin TV queue page snapshot and no assertion failure in changed code.
- Env-cleared `npm run e2e` rerun - PASS, 44 passed / 6 skipped.
- Final `npm run governance:check` - PASS, current phase `20260601-1907`, 4 cited per-agent handoffs all present, 0 errors / 1 known historical warning.

NOT RUN:
- Real Stripe CLI/dashboard replay - no credentials and out of phase scope.
- Throwaway real-Postgres race acceptance - no `REAL_POSTGRES_DATABASE_URL` provided this phase.
- Live Axioma endpoint-shape/JWKS/consume/download checks - external B4 scope, not run.
- Live TradingView automation - intentionally not implemented/run.
- Live bot/exchange control - prohibited and not run.
- SSH, tmux, systemd, preview-worker, production service mutation - not run.

## Next actions
1. If real Postgres credentials are provided, add/run a guarded TV duplicate-task cross-connection race case against a fresh `wtc_test_*` database.
2. Extract the journal-handoff route into a Request-level handler and prove CSRF, entitlement, signed claims, JTI insert, and audit behavior with PGlite and generated P-256 keys.
3. Implement the Axioma download route boundary with a local token/proxy model and mocked streaming before any live Axioma fetch.
4. Plan the account-link OTC hash migration before account-link CTAs are enabled.
5. Keep B4 blocked until Axioma endpoint shapes, OP key provisioning, replay model, download security, and browser CTA behavior are accepted in a separate session.
