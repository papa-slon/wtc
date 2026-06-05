# ecosystem-bot-integration-auditor handoff
## Scope
Read-only Phase 4.12 runtime/worker audit for WTC Ecosystem Platform bot continuity evidence. Scope was limited to current worker/runtime evidence for Legacy and Tortila, especially proof that bots do not stop silently. Inspected the worker DB tick path, one-shot worker tick helper, safe worker tick wrapper, admin system-health/admin-bots surfaces, user runtime evidence/readiness loaders, and relevant static/integration/e2e tests.

No live bot start/stop/apply/retest, no live probes, no env value dump, no worker tick, and no DB/runtime mutation were performed.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- apps/worker/src/index.ts
- apps/worker/src/tick-once.ts
- scripts/safe-worker-tick.mjs
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/web/src/app/admin/system-health/page.tsx
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/meta.ts
- apps/web/src/features/bots/journal.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/bot-adapters/src/index.ts
- packages/bot-adapters/src/adapters.test.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/legacy-live-worker-static.test.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/bot-readiness-builder.test.ts
- tests/integration/bot-readiness-server-dto-static.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- package.json
- apps/worker/package.json

## Files changed
None - read-only audit

Allowed handoff written: docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md

## Findings
1. Severity: P1 - The generic worker heartbeat is not yet authoritative continuity proof for bot snapshots. Evidence: apps/worker/src/index.ts:127 records `workerHealthStatus` from LMS/safety state and writes the `worker` integration-health row at apps/worker/src/index.ts:128 before Tortila and Legacy snapshot outcomes are initialized at apps/worker/src/index.ts:157 and executed at apps/worker/src/index.ts:191 and apps/worker/src/index.ts:207. Snapshot failures are caught and returned/logged at apps/worker/src/index.ts:200 and apps/worker/src/index.ts:220, but they do not update the already-written `worker` row. The admin system-health heartbeat reads only target `worker` at apps/web/src/features/admin/queries.ts:221 and renders it as the Worker heartbeat at apps/web/src/app/admin/system-health/page.tsx:51. Recommendation: in the next implementation slice, derive a final worker continuity status after Tortila and Legacy snapshot attempts, then write either a second/final `worker` health row or move the current `worker` row write after snapshots. Include sanitized fields such as `tortilaSnapshot`, `legacySnapshot`, `tortilaLastError`, `legacyLastError`, and a non-secret `botContinuityStatus`. Treat configured snapshot `error` as worker `error`; treat deliberate `not_configured/skipped` as warning/setup-needed rather than outage. Target part: apps/worker/src/index.ts plus worker-health tests and admin system-health rendering.

2. Severity: P1 - Admin Tortila fleet status can miss stale read-state because the worker intentionally stores stale as an `ok` health-check status. Evidence: apps/worker/src/jobs.ts:61 documents the readState-to-status mapping and apps/worker/src/jobs.ts:71 maps `stale` to `ok`; apps/web/src/features/admin/bot-health-loader.ts:221 extracts `tortilaJournalReadState` from the latest health detail and returns it at apps/web/src/features/admin/bot-health-loader.ts:358. However, apps/web/src/app/admin/bots/page.tsx:18 only treats `not_configured` specially, then checks coarse status values at apps/web/src/app/admin/bots/page.tsx:22 and apps/web/src/app/admin/bots/page.tsx:26 before falling through to `last check ok` at apps/web/src/app/admin/bots/page.tsx:28. Recommendation: update `journalReadStatePill` to honor `tortilaJournalReadState === 'stale' | 'unreachable' | 'malformed'` before `tortilaLastOkAt`, and add a static/admin loader test that a stale readState renders warning even when the DB status is `ok`. Target part: apps/web/src/app/admin/bots/page.tsx and tests/integration/admin-bot-health-loader.test.ts or a new admin-bots static test.

3. Severity: P2 - Admin bot health-check table paints `not_configured` bot rows as bad, which weakens setup-vs-outage honesty. Evidence: Legacy intentionally writes `legacy-bot` `not_configured` rows for disabled live reads or missing DB URL at apps/worker/src/legacy-live.ts:496 and apps/worker/src/legacy-live.ts:505; Tortila writes `tortila-journal` `not_configured` for missing read config at apps/worker/src/jobs.ts:117. The system-health table treats `not_configured` as warning at apps/web/src/app/admin/system-health/page.tsx:303, but the admin bots table treats anything other than `ok` or `healthy` as bad at apps/web/src/app/admin/bots/page.tsx:685. Recommendation: align admin bots table tone with system health: `ok/healthy` = ok, `not_configured/stale` = warn, `down/error/malformed` = bad. Target part: apps/web/src/app/admin/bots/page.tsx and rendered/static tests.

4. Severity: P2 - Admin bot health rows can disappear from the fleet page when recent non-bot health rows crowd the latest 50 rows. Evidence: apps/web/src/features/admin/bot-health-loader.ts:323 selects the latest 50 `integration_health_checks` across all targets, then apps/web/src/features/admin/bot-health-loader.ts:329 filters that in memory to `bot.*`, `tortila-journal`, and `legacy-bot`. The worker writes generic `worker` rows on every tick at apps/worker/src/index.ts:128 and bot rows separately at apps/worker/src/jobs.ts:235 and apps/worker/src/legacy-live.ts:563, so bot continuity evidence should not depend on a broad latest-50 window. Recommendation: query bot targets directly with a DB predicate or fetch latest-per-target for `tortila-journal`, `legacy-bot`, and `legacy-bot-provider-account`; keep the result count bounded after filtering at the DB layer. Target part: apps/web/src/features/admin/bot-health-loader.ts and admin loader tests.

5. Severity: P2 - The one-shot worker tick output is duplicated and the first emitted line omits Legacy status. Evidence: apps/worker/src/tick-once.ts:23 calls `console.log` with two long `DB tick OK` strings; apps/worker/src/tick-once.ts:24 includes Tortila only, while apps/worker/src/tick-once.ts:25 includes Tortila and Legacy. The root smoke command points to scripts/safe-worker-tick.mjs at package.json:22, and the safe wrapper invokes tick-once at scripts/safe-worker-tick.mjs:16 and scripts/safe-worker-tick.mjs:18. Recommendation: collapse the tick output to one redacted summary line containing both `tortila=` and `legacy=`, then add/adjust a static test that prevents duplicate `DB tick OK` strings and requires both bot statuses. Target part: apps/worker/src/tick-once.ts, scripts/safe-worker-tick.mjs guard tests.

6. Severity: P2 - Current tests cover useful safety pieces but do not lock the proposed continuity invariant. Evidence: tests/integration/worker-tortila-snapshot.test.ts:92 exercises `runDbWorkerTick` with mock Tortila and asserts `workerHealthStatus` and `tortilaSnapshot`, while tests/integration/worker-tortila-snapshot.test.ts:136 covers read-only Tortila without token as health-only. Legacy coverage focuses on helper/static/provider-account scoping at tests/integration/legacy-provider-worker.test.ts:156 and tests/integration/legacy-live-worker-static.test.ts:96. I did not find a test asserting that `legacySnapshot` or a bot snapshot `error` changes the worker heartbeat/continuity summary. Recommendation: add a pure helper such as `deriveWorkerContinuityHealth(coreStatus, { tortilaSnapshot, legacySnapshot, ... })` and unit-test `ok`, `not_configured/skipped`, and `error` cases without live adapters. Target part: apps/worker/src/index.ts and tests/integration/worker-health-mapping.test.ts or a new focused static/unit test.

## Decisions
- Treated apps/worker/src/index.ts as the real DB worker entrypoint; apps/worker/src/tick-once.ts is the one-shot acceptance path, and scripts/safe-worker-tick.mjs is the local safe wrapper.
- Did not execute worker ticks, worker smoke, live probes, browser probes, or tests because this background auditor was explicitly read-only and the prompt prohibited worker ticks/runtime state changes.
- Considered bot-specific `integration_health_checks` rows (`tortila-journal`, `legacy-bot`, `legacy-bot-provider-account`) the safest continuity evidence source for the next slice; live start/stop/apply/retest remains out of scope.
- Safest next implementation slice: "bot continuity heartbeat hardening" - no live control, no provider mutation, no worker execution required for implementation. It should (1) make the worker heartbeat include final bot snapshot outcomes, (2) make admin fleet surfaces honor stale/readState precisely, (3) make bot-health queries target bot rows directly, and (4) add static/unit tests around these invariants.

## Risks
- The worktree was already dirty before this audit (`git status --short --branch` showed many modified/untracked files). This handoff did not attempt to classify or revert those changes.
- No current live DB rows were inspected, no env values were read, and no worker tick was run; conclusions are from static code/test inspection only.
- `not_configured` is intentionally not an outage in this repo. The implementation slice must avoid converting setup-needed states into false red incidents while still making configured bot snapshot errors impossible to miss.
- If the worker process itself stops entirely, the existing system-health stale check can warn after 3 minutes for the generic `worker` row, but bot-specific fleet pages should also expose stale bot rows instead of depending only on generic heartbeat freshness.

## Verification/tests
Commands run from C:\Users\maxib\GTE BOT\wtc_ecosystem_platform:
- `rg -n "WTC|worker|runtime|continuity|Legacy|Tortila|bot" C:\Users\maxib\.codex\memories\MEMORY.md`
- `Get-ChildItem -Force`
- `git status --short --branch`
- `Test-Path docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md`
- `rg --files apps/worker apps/web/src tests scripts | rg "(worker/src/(index|tick-once)\.ts|safe-worker-tick\.mjs|admin/system-health/page\.tsx|features/admin/queries\.ts|admin/bots/page\.tsx|features/bots/BotRuntimeEvidencePanel\.tsx|features/bots/readiness.*\.ts|runtime|readiness|worker|bot.*health|system-health)"`
- `rg -n 'Phase 1\.5|background|handoff|N-agent|gates RUN|live|read-only|closed' docs/SESSION_PROTOCOL.md AGENTS.md`
- `rg -n "^" apps/worker/src/index.ts`
- `rg -n "^" apps/worker/src/tick-once.ts`
- `rg -n "^" scripts/safe-worker-tick.mjs`
- `rg -n "worker|health|runtime|evidence|tortila|legacy|bot|snapshot|last|stale|status|configured|lastError|readState|updated|timestamp|component|source" apps/web/src/app/admin/system-health/page.tsx`
- `rg -n "worker|health|runtime|evidence|tortila|legacy|bot|snapshot|last|stale|status|configured|lastError|readState|updated|timestamp|component|source|get.*Health|get.*Bot" apps/web/src/features/admin/queries.ts`
- `rg -n "worker|health|runtime|evidence|tortila|legacy|bot|snapshot|last|stale|status|readiness|owner|component|source|Panel|BotRuntime" apps/web/src/app/admin/bots/page.tsx apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `rg -n "worker|health|runtime|evidence|tortila|legacy|bot|snapshot|last|stale|status|readiness|configured|source|error|warning" apps/web/src/features/bots/readiness.ts apps/web/src/features/bots/readiness-loader.ts`
- `rg -n "snapshotTortilaJournal|recordHealthCheck|bot\.tortila|tortila-journal|readState|lastError|stale|sourceAdapter|bot_metric_snapshots|ensureBotInstance|processAlive|health" apps/worker/src/jobs.ts packages/db/src/repositories.ts packages/db/src/schema.ts packages/bot-adapters/src/index.ts packages/bot-adapters/src/adapters.test.ts`
- `rg -n "^" apps/worker/src/legacy-live.ts`
- `rg -n "^" apps/web/src/features/admin/bot-health-loader.ts`
- `rg -n "^" apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `rg -n "^" apps/web/src/features/admin/queries.ts | Select-Object -Skip 175 -First 260`
- `rg -n "^" apps/web/src/app/admin/system-health/page.tsx | Select-Object -First 340`
- `rg -n "^" apps/web/src/app/admin/bots/page.tsx | Select-Object -First 730`
- `rg -n "^" apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `rg -n "describe|it\(|test\(|expect|runDbWorkerTick|snapshotTortilaJournal|legacy|tortila|recordHealthCheck|not_configured|error|stale|worker|safe-worker|tick" tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/admin-bot-health-loader.test.ts`
- `rg -n "describe|it\(|test\(|expect|runtimeReadiness|buildBotReadiness|legacy|tortila|not_configured|stale|mock|Runtime snapshot|worker" tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/e2e/bot-readiness-map.spec.ts`
- `rg -n "describe|it\(|test\(|expect|AdminBotRuntimeEvidencePanel|admin/bots|botHealthChecks|legacyProviderAccounts|tortilaFleetSnapshots|worker|runtime evidence|not_configured" tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/e2e/admin-user-bot-detail-db.spec.ts`
- `rg -n "worker:smoke|safe-worker|tick-once|worker|vitest|admin-bot|bot-readiness|legacy-live|tortila" package.json apps/worker/package.json`
- `rg -n "legacySnapshot|legacyLastError|legacy-bot|legacyDbLiveRead|providerAccountMappings|tortilaLastError|workerHealthStatus|tortilaSnapshot|lastSyncAt|staleDataSeconds|processAlive" tests apps packages | Select-Object -First 300`
- `rg -n "recordHealthCheck\(db, 'worker'|runDbWorkerTick\(|snapshotLegacyBotPostgres|snapshotTortilaJournal|workerHealthStatus|legacySnapshot|tortilaSnapshot|legacyLastError|tortilaLastError" apps/worker/src/index.ts apps/worker/src/jobs.ts apps/worker/src/legacy-live.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts`
- `rg -n "target: text|status: text|detail: jsonb|checkedAt|integrationHealthChecks|recordHealthCheck" packages/db/src/schema.ts packages/db/src/repositories.ts | Select-Object -First 140`
- `rg -n "function loadBotReadModel|loadBotReadModelForUser|lastSyncAt|staleDataSeconds|processAlive|readState|botMetricSnapshots|integrationHealthChecks|legacy-bot|tortila-journal" apps/web/src/features/bots/data.tsx apps/web/src/features/bots/journal.ts apps/web/src/features/bots/meta.ts packages/bot-adapters/src/index.ts`
- `rg -n "^" apps/web/src/features/bots/data.tsx | Select-Object -Skip 90 -First 350`
- `rg -n "^" apps/web/src/features/bots/readiness.ts`
- `rg -n "^" apps/web/src/features/bots/readiness-loader.ts`
- `rg -n "^" apps/web/src/features/admin/health-detail.ts`
- `rg -n "^" apps/web/src/features/bots/data.tsx | Select-Object -Skip 430 -First 320`
- `rg -n "tortila-journal|legacy-bot|healthByProduct|warningSummary|sourceAdapter|providerAccountMappings|stale|latest health|integrationHealthChecks" apps/web/src/features/admin/user-bot-detail-loader.ts | Select-Object -First 220`
- `rg -n "safe-worker-tick|worker:smoke|tick-once|legacy=|tortila=|console\.log\(" tests scripts apps/worker package.json | Select-Object -First 220`

One protocol search command failed because PowerShell parsed the quote pattern incorrectly; it made no changes:
- `rg -n \"Phase 1\\.5|background|handoff|No \\\"N-agent audit\\\"|gates RUN|live\" docs/SESSION_PROTOCOL.md AGENTS.md`

Commands/gates not run:
- `npm run worker:smoke` - NOT RUN; it invokes scripts/safe-worker-tick.mjs and may run a worker tick.
- `node scripts/safe-worker-tick.mjs` - NOT RUN; worker tick prohibited by prompt.
- `npm run worker:tick` - NOT RUN; worker tick prohibited by prompt.
- `npm run tick -w @wtc/worker` - NOT RUN; worker tick prohibited by prompt.
- `npx tsx apps/worker/src/tick-once.ts` - NOT RUN; worker tick prohibited by prompt.
- `npm test` / `npx vitest ...` - NOT RUN; tests can create/write artifacts or DB state, and this lane was static read-only.
- Playwright/browser probes - NOT RUN; live/local page probing was out of scope for this background read-only audit.
- Env inspection commands such as `Get-ChildItem Env:` - NOT RUN; prompt prohibited env value reads.
- Live server/bot control commands - NOT RUN; start/stop/apply/retest are explicitly forbidden.

## Next actions
1. Implement a narrow bot-continuity heartbeat slice: move or supplement the `worker` health row so it records final Tortila/Legacy snapshot statuses after both snapshot attempts complete. Keep error text redacted and bounded; do not store provider payloads or secrets.
2. Add a pure status-derivation helper and unit/static tests for worker continuity: core ok + bot ok => ok; core ok + configured bot error => error; core ok + not_configured/skipped => setup-needed/warn detail, not outage; unsafe flags remain misconfigured.
3. Fix `tick-once.ts` to print exactly one one-shot summary line with both `tortila=` and `legacy=`, then test the output string statically.
4. Update `/admin/bots` read-state logic so stale/unreachable/malformed readState is honored even when coarse `integration_health_checks.status` is `ok`, and align `not_configured` table tone to warning.
5. Change `loadAdminBotHealthFromDb` to query bot health targets directly instead of selecting latest 50 global rows then filtering in memory.
6. Do not add live start/stop/apply/retest. After implementation, the safe gates should be focused static/unit tests first; a real worker smoke should only be recommended to the operator when the phase explicitly authorizes a worker tick.
