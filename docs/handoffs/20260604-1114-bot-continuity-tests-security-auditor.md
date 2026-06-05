# ecosystem-tests-runner handoff
## Scope
Read-only Phase 4.12 tests/security audit for bot runtime continuity guardrails. Inspected current tests and scripts around worker heartbeat, Tortila and Legacy read-only snapshots, no live control, no secrets, and user/admin scope. No product code, tests, env, services, DB, browser, or runtime state were changed or executed. This audit is against the current dirty checkout on branch `codex/bot-analytics-settings-canary-20260603`.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/20260604-1111-phase-4-11-admin-runtime-evidence-ladder.md
- package.json
- apps/worker/package.json
- scripts/safe-worker-tick.mjs
- apps/worker/src/tick-once.ts
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/bot-readiness-builder.test.ts
- tests/integration/bot-readiness-server-dto-static.test.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/db-seed-preview-hardening.test.ts
- tests/integration/child-output-redaction.test.ts
- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
- tests/e2e/smoke.spec.ts
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/bot-settings.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- playwright.admin-user-bots-db.config.ts
- scripts/run-admin-user-bot-detail-e2e.mjs
- scripts/prepare-admin-user-bot-detail-e2e.ts

## Files changed
- None - read-only audit
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md

## Findings
1. Severity P1 - evidence tests/integration/worker-tortila-snapshot.test.ts:79 - recommendation: keep the real `runDbWorkerTick` PGlite path in the Phase 4.12 focused gate and require assertions for worker health detail, Tortila snapshot status, persisted metrics/positions/trades, and safe flags - target part: worker heartbeat and Tortila continuity. The test calls `runDbWorkerTick` with `BOT_ADAPTER_MODE: 'mock'` and a configured `SYSTEM_BOT_OWNER_ID`, then asserts worker status, Tortila snapshot, persisted rows, and `liveControlDisabled`/`tvAutomationDisabled` in health detail at tests/integration/worker-tortila-snapshot.test.ts:92 and tests/integration/worker-tortila-snapshot.test.ts:111.
2. Severity P1 - evidence tests/integration/worker-health-mapping.test.ts:45 - recommendation: make `workerSafetyState` and production-like DB requirement part of the minimum Phase 4.12 gate - target part: worker safety heartbeat. The current unit test locks safe default flags and misconfigured heartbeat status when `FEATURE_LIVE_BOT_CONTROL` or `FEATURE_TV_AUTOMATION` is enabled at tests/integration/worker-health-mapping.test.ts:47 and tests/integration/worker-health-mapping.test.ts:54; it also locks staging/production DB requirement at tests/integration/worker-health-mapping.test.ts:38.
3. Severity P1 - evidence tests/integration/legacy-provider-worker.test.ts:18 - recommendation: add focused coverage for the full `snapshotLegacyBotPostgres` decision path before Phase 4.12 claims Legacy continuity - target part: Legacy provider worker. The current Legacy worker test imports only `snapshotLegacyRowsToWtc` and exercises supplied row snapshots and mapping ownership at tests/integration/legacy-provider-worker.test.ts:156 and tests/integration/legacy-provider-worker.test.ts:208. The full runtime branch that gates `LEGACY_LIVE_READS_ENABLED`, `LEGACY_DATABASE_URL`, provider-account scoped health, and redacted error health lives in apps/worker/src/legacy-live.ts:488, apps/worker/src/legacy-live.ts:497, apps/worker/src/legacy-live.ts:522, apps/worker/src/legacy-live.ts:563, and apps/worker/src/legacy-live.ts:644, but is not directly invoked by the named Legacy worker test.
4. Severity P1 - evidence scripts/safe-worker-tick.mjs:21 - recommendation: do not treat `npm run worker:smoke` alone as runtime continuity proof; require an explicit DB-backed one-shot worker gate when a throwaway DB is available - target part: package scripts and worker acceptance. Root `worker:smoke` points to the wrapper at package.json:22, and the wrapper adds `--memory-demo` whenever `DATABASE_URL` is absent at scripts/safe-worker-tick.mjs:21. The underlying tick refuses a real one-shot worker acceptance without `DATABASE_URL` at apps/worker/src/tick-once.ts:17 and runs `dbTick(url)` only when it is set at apps/worker/src/tick-once.ts:22.
5. Severity P1 - evidence tests/integration/bot-read-safety-static.test.ts:227 - recommendation: run the static no-live-control/no-secret guard in Phase 4.12 after any bot UI or loader change - target part: no live control and no secrets. The current static suite denies adapter calls, fetches, vault opens, live-control verbs, secret fields, sealed values, and "Connection verified" copy across readiness/evidence surfaces at tests/integration/bot-read-safety-static.test.ts:227. It separately locks metadata-only exchange key checks, no live ping, no sealed secret selection, and no bot/provider env access at tests/integration/bot-read-safety-static.test.ts:470.
6. Severity P1 - evidence tests/integration/admin-user-bot-detail-static.test.ts:17 - recommendation: keep selected-user admin drilldown static coverage in the focused gate and pair it with the DB browser gate when credentials are available - target part: user/admin scope. The static test requires safe tables, no `exchangeApiKeySecrets`, no password hash, no raw JSON, read-only copy, RBAC gating, no forms, no submit controls, and no start/stop/apply controls at tests/integration/admin-user-bot-detail-static.test.ts:17 and tests/integration/admin-user-bot-detail-static.test.ts:64.
7. Severity P2 - evidence tests/e2e/admin-user-bot-detail-db.spec.ts:45 - recommendation: run `npm run e2e:admin-user-bots:db:managed` only with a throwaway/admin Postgres URL and record it as NOT RUN otherwise - target part: DB-backed admin user scope proof. The DB e2e has visible and hidden marker allow/deny lists including other-user data, raw config/trade markers, sealed secret markers, secret-shaped strings, and live-control labels at tests/e2e/admin-user-bot-detail-db.spec.ts:13 and tests/e2e/admin-user-bot-detail-db.spec.ts:45. The test asserts no form, no CSRF hidden input, and no start/stop/apply/test connection button at tests/e2e/admin-user-bot-detail-db.spec.ts:136. The runner and config force mock/no-live flags at scripts/run-admin-user-bot-detail-e2e.mjs:33 and playwright.admin-user-bots-db.config.ts:64.
8. Severity P2 - evidence tests/integration/bot-readiness-builder.test.ts:32 - recommendation: keep readiness builder/server DTO tests with the UI smoke, but do not count demo Playwright readiness as DB continuity proof - target part: readiness map honesty. The builder locks no false green for stale, not_configured, unreachable, malformed, mock, and denied access at tests/integration/bot-readiness-builder.test.ts:32 and tests/integration/bot-readiness-builder.test.ts:60. The server DTO static test locks server-only, entitlement-gated scalar summaries and excludes record/write/live/secret/provider payload APIs at tests/integration/bot-readiness-server-dto-static.test.ts:23. The Playwright readiness map confirms visible rows and no "Connection verified" copy in demo UI at tests/e2e/bot-readiness-map.spec.ts:13.
9. Severity P2 - evidence tests/e2e/bot-settings.spec.ts:189 - recommendation: keep bot settings/browser acceptance after settings or setup changes because it exercises real rendered no-live-control copy and invalid-save paths - target part: user-facing settings safety. The suite asserts no `Connection verified`, `applyConfig`, `startBot`, or `stopBot` text on invalid Tortila/Legacy settings paths at tests/e2e/bot-settings.spec.ts:189, tests/e2e/bot-settings.spec.ts:204, tests/e2e/bot-settings.spec.ts:241, and tests/e2e/bot-settings.spec.ts:263, while locking visible live-control-disabled setup rows at tests/e2e/bot-settings.spec.ts:61.
10. Severity P3 - evidence apps/worker/src/tick-once.ts:23 - recommendation: normalize one-shot worker output before making retained-log parsing strict - target part: worker CLI observability. The DB tick success log currently passes two long status strings to one `console.log`, one without Legacy fields and one with Legacy fields, at apps/worker/src/tick-once.ts:23. This is not a security issue, but it can make future retained-log assertions noisy or ambiguous.

## Decisions
- No live DB, browser, worker tick, Playwright, provider call, exchange call, env mutation, service mutation, or runtime probe was run in this read-only auditor lane.
- No background agents were opened by this per-agent auditor; there are therefore no background agents to close from this lane.
- Phase 4.12 focused gates should distinguish static safety proof, in-process PGlite worker proof, explicit DB-backed one-shot worker proof, and browser rendering proof. These are not interchangeable.
- `npm run worker:smoke` is acceptable as a local smoke only; the DB-backed continuity gate must explicitly set `DATABASE_URL` and avoid the wrapper's implicit memory-demo path.

## Risks
- The checkout is already heavily dirty, including tests and app files. This audit records current file content only; it does not prove a clean commit, CI state, or deployed state.
- Static tests are useful for forbidden imports/strings and safety copy, but they can miss semantic regressions if equivalent behavior moves behind differently named helpers.
- The Legacy provider continuity branch is weaker than the Tortila branch because the named Legacy test does not invoke `snapshotLegacyBotPostgres` end to end.
- The DB-backed admin user bot detail browser gate is present but opt-in and was not run here; it remains the strongest proof for user/admin scope leaks when a throwaway DB is available.
- Running Playwright or a DB worker gate without explicit DB/browser scope would violate this auditor lane; Phase 4.12 should record any skipped gate with the exact reason.

## Verification/tests
RUN:
- Read-only inspection of AGENTS/session docs, latest Phase 4.11 handoff, package scripts, worker sources, and targeted integration/e2e tests.
- `git status --short --branch` to identify current branch and dirty state.
- `rg`/`Get-Content` evidence reads only.

NOT RUN:
- `npm test`, focused Vitest, `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run build`, and `npm run ci:local` - not run because this auditor was scoped to read-only file inspection and one handoff write.
- `npm run worker:smoke`, `npm run worker:tick`, `node scripts/safe-worker-tick.mjs --require-db`, and any `DATABASE_URL` worker tick - not run to avoid DB/runtime mutation in this read-only auditor lane.
- `npm run e2e`, `npx playwright ...`, and `npm run e2e:admin-user-bots:db:managed` - not run because live browser/DB execution was outside this auditor scope.
- Live bot start/stop/apply/retest, provider calls, exchange pings, SSH, deploy, tmux, systemd, env/secret reads - not run by safety policy.

## Next actions
1. Minimum Phase 4.12 static/PGlite focused gate:
   `npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/child-output-redaction.test.ts`
2. Before claiming DB-backed worker continuity, run an explicit one-shot DB worker acceptance against a throwaway WTC DB, not the implicit memory-demo smoke:
   `DATABASE_URL=postgres://<redacted>@<host>:<port>/wtc_test_<suffix> SYSTEM_BOT_OWNER_ID=<seeded-user-id> node scripts/safe-worker-tick.mjs --require-db`
3. If the Phase 4.12 slice touches selected-user admin scope or admin bot detail, run the guarded DB browser gate with a throwaway DB:
   `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<redacted-maintenance-db> npm run e2e:admin-user-bots:db:managed`
4. If browser scope is approved, run the focused rendered safety checks:
   `npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/smoke.spec.ts --project=desktop --project=mobile`
5. Add next-slice tests before or with implementation for the current gap: direct `snapshotLegacyBotPostgres` disabled/missing-URL/scoped-provider health behavior, Legacy SQL selected-column denylist coverage, redacted legacy error health payloads, and non-coercion of zero provider accounts to green continuity.
