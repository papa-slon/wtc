# worker-inflight-runtime-auditor handoff
## Scope
Read-only Phase 4.46 runtime/scheduler audit for the WTC worker. Inspect the current worker scheduler/tick implementation and identify the smallest safe no-env in-flight guard so a slow DB worker tick cannot overlap the next interval and confuse bot continuity semantics.

Constraints followed: no product/source/test/docs edits except this handoff, no live provider probes, no DB mutation, no server or bot start/stop, and no external secrets. The current tree already contains modified worker/source/test files; this auditor inspected them but did not create or change them.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/package.json`
- `package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `tests/integration/worker-inflight-guard.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`

## Files changed
None — read-only audit, except this handoff file: `docs/handoffs/20260605-0318-worker-inflight-runtime-auditor.md`.

## Findings
1. Severity P1 - The smallest safe no-env guard is an in-process serialized runner around the long-running DB scheduler, and the current tree contains that shape. Evidence: `apps/worker/src/index.ts:93` exports `createSerializedDbWorkerTickRunner`; `apps/worker/src/index.ts:110` returns `skipped_in_flight` before calling `runTick`; `apps/worker/src/index.ts:127` starts the real tick only when no tick is in flight; `apps/worker/src/index.ts:139` clears state in `finally`. Recommendation: keep this helper as the Phase 4.46 guard; do not add advisory locks, env requirements, provider calls, or DB writes just to prevent local interval overlap. Target part: worker runtime scheduler.
2. Severity P1 - The guard is wired to the long-running DB interval, while one-shot worker acceptance still uses the direct DB tick. Evidence: `apps/worker/src/index.ts:478` creates `dbTickRunner`; `apps/worker/src/index.ts:482` runs the initial DB tick through the runner before the interval starts; `apps/worker/src/index.ts:486` runs interval ticks through `dbTickRunner.run()`; `apps/worker/src/tick-once.ts:22` still calls `dbTick(url)` directly for one-shot acceptance. Recommendation: keep the guard at the process scheduler boundary, not inside `runDbWorkerTick` or `dbTick`, so focused one-shot tests remain deterministic and exact. Target part: worker entrypoint.
3. Severity P1 - Skipped overlap attempts should not refresh bot continuity proof. Evidence: the skip branch logs and returns an outcome at `apps/worker/src/index.ts:110` through `apps/worker/src/index.ts:124`, and the first focused test proves a second call is not started while the first promise is pending at `tests/integration/worker-inflight-guard.test.ts:30` through `tests/integration/worker-inflight-guard.test.ts:44`. Recommendation: keep skipped-overlap handling as warning-only, with no `target='worker'` health row, so Phase 4.44 stale-row handling remains the honest continuity signal if ticks stop completing. Target part: bot continuity semantics.
4. Severity P2 - The focused no-env tests cover the new guard, but existing local continuity scripts still mostly prove one-shot/demo behavior. Evidence: `scripts/safe-worker-tick.mjs:116` runs `apps/worker/src/tick-once.ts`; `package.json:22` maps `worker:smoke` to `scripts/safe-worker-tick.mjs`; `scripts/gates.mjs:175` maps `bot-continuity-local` to `worker-continuity-fixture` plus `worker-smoke`. Recommendation: for Phase 4.46 closeout, include `npx vitest run tests/integration/worker-inflight-guard.test.ts tests/integration/worker-health-mapping.test.ts` or fold the guard test into an existing focused worker gate before claiming the scheduler gap closed. Target part: verification gates.
5. Severity P3 - Project docs still advertise the in-flight guard as the next open action. Evidence: `docs/NEXT_ACTIONS.md:53` says to add a serialized/in-flight guard around DB worker ticks. Recommendation: after the operator accepts the current implementation and gates, update the aggregate handoff/status docs in the implementation phase; this read-only auditor should not update them. Target part: phase documentation truth.

## Decisions
1. Treat `apps/worker/src/index.ts` as the real long-running DB worker entrypoint and `apps/worker/src/tick-once.ts` as the one-shot acceptance/smoke path.
2. Recommend the current no-env serialized runner as the smallest safe guard: pure injected `runTick`/`now`/`logger`, no database dependency in the guard itself, warning-only skip, and `finally` state release.
3. Do not recommend writing an overlap skip row into `integration_health_checks`; a skipped interval is not completed worker continuity proof.
4. Do not recommend live provider probes or managed DB acceptance as prerequisites for this no-env runtime clarity slice.

## Risks
1. The inspected guard/source/test changes are currently uncommitted/untracked in an already broad dirty worktree; this auditor did not author or normalize those changes.
2. The focused guard tests prove in-process serialization but do not prove behavior in a deployed worker process under real database latency.
3. Managed worker continuity was not run because it requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and creates/drops a throwaway Postgres database.
4. Live provider, exchange, and bot-control paths remain intentionally unprobed and unmodified.
5. The memory-demo interval remains unguarded; scope and recommendation are limited to slow DB worker ticks because memory demo does not write continuity rows.

## Verification/tests
RUN:
1. `git status --short --branch` - branch `codex/bot-analytics-settings-canary-20260603`; broad pre-existing dirty tree observed, including worker files and many phase handoffs.
2. Source/docs inspection with `rg` and line-numbered reads of the required files and relevant worker tests listed above.
3. `npx vitest run tests/integration/worker-inflight-guard.test.ts tests/integration/worker-health-mapping.test.ts` - PASS (`2` files, `17` tests).

NOT RUN:
1. `npm run worker:smoke` - not needed for this focused scheduler audit; it exercises one-shot memory/demo behavior, not interval overlap.
2. `npm run accept:bots:continuity:contract` - not run because the focused guard tests were narrower and no product/browser surface changed in this audit.
3. `npm run accept:worker:continuity:managed` - not run; blocked by missing/unsupplied `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and would create/drop a throwaway DB.
4. Root typecheck/lint/secret/governance/build/e2e - not run in this read-only auditor lane; leave them for the Phase 4.46 implementation/aggregate closeout.
5. Live provider probes, DB mutation outside tests, server starts, bot start/stop/apply-config, deploy, CI, and monitoring - intentionally not run by scope.

## Next actions
1. Operator/implementer should accept the current `createSerializedDbWorkerTickRunner` shape or land an equivalent minimal guard if the current dirty changes are not the intended source of truth.
2. Close Phase 4.46 with focused no-env guard tests plus the usual implementation closeout gates appropriate to the final touched tree.
3. Update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and the aggregate Phase 4.46 handoff only from the implementation/operator phase after gates are observed.
