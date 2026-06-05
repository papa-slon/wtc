# bot-worker-continuity-runtime-auditor handoff
## Scope
Read-only Phase 4.13 audit of worker/runtime continuity evidence for `apps/worker`, bot adapters, DB health/snapshot repositories/schema, and worker-related tests. Goal: identify the smallest safe backend slice so worker health cannot be green before Legacy and Tortila snapshot reads have completed or been honestly marked setup-needed/error. No live bot control, provider mutation, env dump, SSH, tmux, or systemd action was performed.

## Files inspected
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/worker/src/tick-once.ts
- apps/worker/package.json
- scripts/safe-worker-tick.mjs
- packages/bot-adapters/src/types.ts
- packages/bot-adapters/src/factory.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/mock-tortila.ts
- packages/bot-adapters/src/mock-legacy.ts
- packages/bot-adapters/src/control.ts
- packages/bot-adapters/src/index.ts
- packages/bot-adapters/src/legacy/legacy-blocked.ts
- packages/db/src/repositories.ts
- packages/db/src/schema.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/legacy-live-worker-static.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/db-seed-preview-hardening.test.ts
- apps/web/src/features/admin/bot-health-loader.ts
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence apps/worker/src/index.ts:127 and apps/worker/src/index.ts:157 - recommendation: move or supplement the worker health row after both Tortila and Legacy snapshot attempts and derive final status from core jobs plus bot outcomes - target part: apps/worker/src/index.ts.
2. Severity P1 - evidence apps/worker/src/legacy-live.ts:496 and apps/worker/src/legacy-live.ts:561 and apps/worker/src/legacy-live.ts:642 - recommendation: treat Legacy ok as required for green, skipped/not_configured as setup-needed, and configured error as worker error - target part: worker final heartbeat derivation.
3. Severity P1 - evidence apps/worker/src/jobs.ts:117 and tests/integration/worker-tortila-snapshot.test.ts:136 - recommendation: extend the Tortila snapshot result with readState, health status, and read counters so health-only/not_configured paths cannot masquerade as completed runtime snapshots - target part: apps/worker/src/jobs.ts and worker tests.
4. Severity P2 - evidence packages/db/src/repositories.ts:1789 and packages/db/src/schema.ts:443 - recommendation: use the existing append-only `integration_health_checks` table; no schema migration is required - target part: DB health-write boundary.
5. Severity P2 - evidence apps/worker/src/tick-once.ts:23 and apps/worker/package.json:9 and scripts/safe-worker-tick.mjs:21 - recommendation: emit one redacted summary line with both `tortila=` and `legacy=`, and do not use memory-demo smoke as bot-continuity proof - target part: worker one-shot acceptance output.
6. Severity P2 - evidence tests/integration/worker-tortila-snapshot.test.ts:92 and tests/integration/legacy-provider-worker.test.ts:156 - recommendation: add a pure final-status helper plus tests for both-bots-ok, skipped/not_configured, configured snapshot error, and unsafe flags - target part: worker continuity tests.

## Decisions
- Treat apps/worker/src/index.ts as the real DB worker runtime path; tick-once.ts is only a one-shot wrapper.
- Do not add or claim live start/stop/apply/retest; adapter control remains disabled.
- Keep not_configured/skipped distinct from outages, but do not let them produce a green continuity heartbeat.
- Use bot-specific health rows as detail evidence and the final worker row as the aggregate heartbeat.

## Risks
- Worktree is heavily dirty, including worker/db/test files; this audit uses current checkout state only.
- Moving the worker row after bot snapshots can delay heartbeat if reads hang; existing adapter/database timeouts and bounded redacted errors must stay in place.
- A green generic worker row is not bot-continuity proof until the backend slice lands and gates pass.

## Verification/tests
RUN:
- git status --short --branch - observed dirty branch `codex/bot-analytics-settings-canary-20260603`.
- npm test -- --run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts - PASSED in the read-only auditor lane, 4 files, 25 tests.
- Static/read-only rg and line-level inspections listed above.

NOT RUN:
- npm run worker:smoke, npm run worker:tick, node scripts/safe-worker-tick.mjs --require-db - not run as continuity proof because they execute worker ticks and/or can mutate DB health/snapshot rows.
- Managed worker service, real DATABASE_URL, Legacy provider DB, Tortila journal, env/secret reads, SSH/tmux/systemd, live bot control - not run by read-only scope.
- Full npm run ci:local, full Playwright, production build/deploy - not run due audit scope.

## Next actions
1. Add `finalWorkerHealthStatus(coreStatus, botOutcomes)` in apps/worker/src/index.ts; ok only when core worker and required Legacy/Tortila reads complete successfully.
2. Move/supplement recordHealthCheck(db, 'worker', ...) after both snapshot attempts; include `botContinuityStatus`, bot snapshots, readState, counts, and redacted last errors.
3. Extend snapshotTortilaJournal return shape so not_configured and health-only paths cannot masquerade as completed runtime snapshots.
4. Fix tick-once.ts to print one summary line containing both bot statuses.
5. Add focused tests before broader gates.
