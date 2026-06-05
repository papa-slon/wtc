# bot-worker-continuity-tests-security-auditor handoff
## Scope
Read-only Phase 4.13 tests/security acceptance audit for backend worker continuity proof. Scope covered worker/health/bot integration tests, relevant bot/admin e2e tests, scripts/gates.mjs, package scripts, and session/protocol safety constraints. No live bot start/stop/apply-config, no exchange/provider calls, no env dump, no DB worker tick, and no code edits.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/ACCEPTANCE_MATRIX_MASTER.md
- docs/DEPLOYMENT.md
- docs/STATUS.md
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md
- docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md
- package.json
- apps/worker/package.json
- scripts/gates.mjs
- scripts/safe-worker-tick.mjs
- apps/worker/src/index.ts
- apps/worker/src/tick-once.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/legacy-live-worker-static.test.ts
- tests/integration/bot-continuity-builder.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/admin-health-detail.test.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/bot-settings.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence apps/worker/src/index.ts:127 and apps/worker/src/index.ts:191 and apps/worker/src/index.ts:207 - recommendation: add/update tests so final worker health is derived after Tortila and Legacy snapshot attempts, with bot statuses, redacted last errors, safety flags, and botContinuityStatus - target part: worker heartbeat continuity invariant.
2. Severity P1 - evidence package.json:22 and scripts/safe-worker-tick.mjs:21 and apps/worker/src/tick-once.ts:17 - recommendation: do not accept npm run worker:smoke as continuity proof; add an explicit DB-backed worker acceptance command requiring DATABASE_URL and --require-db - target part: package scripts and worker acceptance gate.
3. Severity P1 - evidence scripts/gates.mjs:31 and scripts/gates.mjs:48 and package.json:46 - recommendation: add worker typecheck and focused worker-continuity gate to scripts/gates.mjs or document them as mandatory separate gates - target part: gate runner coverage.
4. Severity P1 - evidence tests/integration/legacy-provider-worker.test.ts:18 and apps/worker/src/legacy-live.ts:488 and apps/worker/src/legacy-live.ts:497 and apps/worker/src/legacy-live.ts:563 and apps/worker/src/legacy-live.ts:644 - recommendation: add focused tests for snapshotLegacyBotPostgres disabled/missing-URL/error branches and provider-account scoped health, proving no plaintext secrets and no exchange/provider control - target part: Legacy worker continuity coverage.
5. Severity P1 - evidence apps/worker/src/index.ts:200 and apps/worker/src/jobs.ts:251 - recommendation: add a worker error-redaction test that injects token/password/secret-shaped errors and asserts result, health detail, and one-shot output never contain raw values - target part: worker secret safety.
6. Severity P2 - evidence apps/worker/src/tick-once.ts:23 - recommendation: add a static/CLI-output test requiring exactly one DB tick summary line containing both `tortila=` and `legacy=` - target part: retained worker log parsing.
7. Severity P2 - evidence tests/e2e/admin-user-bot-detail-db.spec.ts:5 and tests/e2e/bot-readiness-map.spec.ts:17 - recommendation: keep default Playwright as rendered safety proof only; run DB-managed admin e2e only with a throwaway admin Postgres URL and record NOT RUN otherwise - target part: DB-backed browser acceptance honesty.

## Decisions
- Treat apps/worker/src/index.ts and runDbWorkerTick as the real backend worker path.
- Treat apps/worker/src/tick-once.ts as the one-shot DB acceptance path only when DATABASE_URL is set.
- Treat scripts/safe-worker-tick.mjs and npm run worker:smoke as local smoke only because it can choose memory demo.
- No live server, bot, provider, exchange, Playwright, worker tick, or DB mutation was run in this audit.

## Risks
- Current checkout is heavily dirty; this audit proves current file content only, not clean CI or deployed state.
- Without a hard DB-backed worker gate, future reports can accidentally count memory-demo smoke as continuity.
- Worker-source redaction should be tested directly so retained logs/results do not depend on the UI sanitizer.

## Verification/tests
RUN:
- Read-only git status --short --branch.
- Read-only rg/file inspection of scoped source, tests, package scripts, gates, and protocol docs.

NOT RUN:
- npm test / focused Vitest - not run because this lane was read-only audit only.
- node scripts/gates.mjs full / node scripts/gates.mjs e2e - not run because gates execute tests/builds and may write logs/artifacts.
- npm run worker:smoke, npm run worker:tick, node scripts/safe-worker-tick.mjs --require-db - not run because they execute worker paths.
- Playwright/e2e and DB-managed browser gates - not run because they require browser/server/DB execution.
- Env inspection, provider calls, exchange calls, live bot control - not run by scope and protocol.

## Next actions
1. Add focused backend tests for final worker continuity derivation and source-level redaction.
2. Add Legacy snapshot branch coverage.
3. Add accept:worker:continuity or equivalent DB-required script; keep worker:smoke local-only.
4. Extend scripts/gates.mjs with worker typecheck and explicit worker continuity acceptance, or require them as separate named gates in handoffs.
5. After implementation, run focused Vitest first, then DB-backed worker acceptance only against a throwaway WTC DB, and report all skipped gates explicitly.
