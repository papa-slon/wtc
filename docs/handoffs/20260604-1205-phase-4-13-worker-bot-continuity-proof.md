# phase-4-13-worker-bot-continuity-proof handoff
## Scope
Close the backend worker continuity gap found in Phase 4.12: the generic `worker` health row must not become green before Tortila and Legacy snapshot reads have completed or been honestly marked setup-needed/error. This phase is local/backend focused. It does not enable live bot control, apply config, exchange calls, provider mutation, SSH, tmux, systemd, or deploy.

Per-agent handoffs linked:
- [docs/handoffs/20260604-1205-bot-worker-continuity-runtime-auditor.md](20260604-1205-bot-worker-continuity-runtime-auditor.md)
- [docs/handoffs/20260604-1205-bot-worker-continuity-web-admin-auditor.md](20260604-1205-bot-worker-continuity-web-admin-auditor.md)
- [docs/handoffs/20260604-1205-bot-worker-continuity-tests-security-auditor.md](20260604-1205-bot-worker-continuity-tests-security-auditor.md)

All three background agents were closed before this aggregate handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/worker/src/tick-once.ts
- apps/worker/package.json
- scripts/safe-worker-tick.mjs
- packages/db/src/repositories.ts
- packages/db/src/schema.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/types.ts
- packages/bot-adapters/src/factory.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/db-seed-preview-hardening.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/legacy-live-worker-static.test.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/features/admin/user-bot-detail-loader.ts

## Files changed
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/worker/src/tick-once.ts
- package.json
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/db-seed-preview-hardening.test.ts
- docs/handoffs/20260604-1205-bot-worker-continuity-runtime-auditor.md
- docs/handoffs/20260604-1205-bot-worker-continuity-web-admin-auditor.md
- docs/handoffs/20260604-1205-bot-worker-continuity-tests-security-auditor.md
- docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md

## Findings
1. Severity P1 - evidence apps/worker/src/index.ts:97 and apps/worker/src/index.ts:291 - recommendation: derive final worker status after both bot snapshot attempts - target part: worker aggregate heartbeat. `finalWorkerHealthStatus()` now returns green only when core worker and both bot outcomes are ok; skipped/not_configured becomes `not_configured`, and malformed/unreachable/error becomes `error`.
2. Severity P1 - evidence apps/worker/src/index.ts:292 and apps/worker/src/index.ts:296 - recommendation: persist a bot-specific aggregate detail - target part: integration_health_checks worker row. The final `worker` row now includes `botContinuityStatus`, Tortila snapshot/readState/counts/error, Legacy snapshot/readState/counts/error, core worker status, and existing safety flags.
3. Severity P1 - evidence apps/worker/src/jobs.ts:24 and apps/worker/src/jobs.ts:148 and apps/worker/src/jobs.ts:277 - recommendation: return an explicit Tortila snapshot result contract - target part: Tortila journal snapshot job. `snapshotTortilaJournal()` now returns `snapshotStatus`, `healthStatus`, `readState`, read details, and row counts. `not_configured` is `skipped`, while unreachable/malformed is `error` and does not continue to data reads.
4. Severity P1 - evidence apps/worker/src/legacy-live.ts:8 and apps/worker/src/legacy-live.ts:490 - recommendation: return Legacy health/readState/counts to orchestration - target part: Legacy DB snapshot job. Legacy snapshot results now carry `healthStatus`, `readState`, and provider scoped counts so the worker aggregate can distinguish skipped/setup-needed from ok/error.
5. Severity P2 - evidence apps/worker/src/tick-once.ts:23 and tests/integration/db-seed-preview-hardening.test.ts:80 - recommendation: make retained one-shot logs parseable - target part: tick-once output. The DB one-shot prints exactly one success line containing both `tortila=` and `legacy=`.
6. Severity P2 - evidence package.json:23 and tests/integration/db-seed-preview-hardening.test.ts:49 - recommendation: separate local smoke from continuity acceptance - target part: package scripts. `accept:worker:continuity` now maps to `node scripts/safe-worker-tick.mjs --require-db`; `worker:smoke` remains local smoke and can still memory-demo.
7. Severity P1 - evidence tests/integration/worker-health-mapping.test.ts:80 and tests/integration/worker-tortila-snapshot.test.ts:148 and tests/integration/worker-tortila-snapshot.test.ts:195 - recommendation: lock backend truth with focused tests - target part: worker continuity verification. Tests now assert green only when both bot reads are ok, skipped/not_configured is attention/not_configured, Tortila health failure becomes worker error, and token-shaped values do not leak into result/detail.

## Decisions
- No DB migration was added; existing append-only `integration_health_checks` is enough for the final aggregate row.
- The old pre-bot `worker` health insert was replaced with a post-bot aggregate insert. Core job failures still write `worker=error` and throw before bot snapshots.
- `not_configured` and `skipped` are not outages, but they are no longer green continuity proof.
- No live bot start/stop/apply, exchange call, provider mutation, env/secret read, SSH, tmux, systemd, deploy, or browser e2e was performed.
- The web/admin auditor found remaining admin consumption issues; they are not fixed in this backend phase and are the next slice.

## Risks
- `accept:worker:continuity` was added but not run because no explicit throwaway `DATABASE_URL` was provided for a DB-mutating worker tick.
- The admin `/admin/bots` and selected-user drilldown can still over-green stale/missing readState in some rows until the next web/admin slice lands.
- The checkout remains heavily dirty from earlier phases; this handoff lists the files touched or added in this phase, but git diff also contains pre-existing changes in some of those files.

## Verification/tests
RUN:
- npm run typecheck -w @wtc/worker - PASSED.
- npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts - PASSED, 5 files, 33 tests.
- npm run typecheck - PASSED.
- npm run typecheck -w @wtc/web - PASSED.
- npx eslint apps/worker/src/index.ts apps/worker/src/jobs.ts apps/worker/src/legacy-live.ts apps/worker/src/tick-once.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/db-seed-preview-hardening.test.ts --max-warnings 0 - PASSED.

NOT RUN:
- npm run accept:worker:continuity - NOT RUN because it requires an explicit throwaway DATABASE_URL and writes worker health/snapshot rows.
- npm run worker:smoke - NOT RUN as continuity proof because it can run memory-demo when DATABASE_URL is absent.
- DB-managed admin bot e2e - NOT RUN because this phase did not patch admin UI/loader and no throwaway admin Postgres URL was provided.
- Full npm run ci:local, full npm test, full Playwright, production build, deploy/SSH/tmux/systemd - NOT RUN due phase scope.
- Live bot start/stop/apply-config, exchange/provider calls, env/secret value reads - NOT RUN by safety policy.

## Next actions
1. Patch admin bot health consumption: target-filtered/per-target latest health queries, stale/unreachable/malformed readState priority, and no latest-50 global sampling false negatives.
2. Add selected-user admin runtimeHealth DTOs and gate runtime/statistics tones through status/readState/freshness.
3. Run `accept:worker:continuity` only with an explicit throwaway WTC DATABASE_URL and record the DB mutation target in the handoff.
4. Consider adding the worker continuity acceptance gate into scripts/gates.mjs after the throwaway DB contract is agreed.
