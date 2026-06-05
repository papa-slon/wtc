# Phase 4.46 worker in-flight guard handoff

## Scope
No-env runtime-clarity implementation for the WTC DB worker scheduler. The goal was to close the Phase 4.46 gap from
`docs/NEXT_ACTIONS.md`: a slow long-running DB worker tick must not overlap the next interval and confuse bot continuity
semantics. This phase is scheduler-only: no provider probes, no exchange pings, no live bot start/stop/apply-config, no
managed DB runner, no deployment, and no UI changes.

Read-only phase handoffs:
- [20260605-0318-worker-inflight-runtime-auditor.md](20260605-0318-worker-inflight-runtime-auditor.md)
- [20260605-0318-worker-inflight-safety-auditor.md](20260605-0318-worker-inflight-safety-auditor.md)
- [20260605-0318-worker-inflight-tests-auditor.md](20260605-0318-worker-inflight-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- [20260605-0318-worker-inflight-runtime-auditor.md](20260605-0318-worker-inflight-runtime-auditor.md)
- [20260605-0318-worker-inflight-safety-auditor.md](20260605-0318-worker-inflight-safety-auditor.md)
- [20260605-0318-worker-inflight-tests-auditor.md](20260605-0318-worker-inflight-tests-auditor.md)
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/gates.mjs`
- `package.json`
- `apps/worker/package.json`
- `tests/integration/worker-inflight-guard.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`

## Files changed
- `apps/worker/src/index.ts`
- `tests/integration/worker-inflight-guard.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0318-worker-inflight-runtime-auditor.md`
- `docs/handoffs/20260605-0318-worker-inflight-safety-auditor.md`
- `docs/handoffs/20260605-0318-worker-inflight-tests-auditor.md`
- `docs/handoffs/20260605-0318-phase-4-46-worker-inflight-guard.md`

## Findings
1. Severity P1 - Long-running DB interval ticks needed serialization. Evidence: `apps/worker/src/index.ts:93` now exports
   `createSerializedDbWorkerTickRunner`; `apps/worker/src/index.ts:119` returns `skipped_in_flight` before calling the
   injected tick when a previous tick is still pending; `apps/worker/src/index.ts:487` wires the interval through
   `dbTickRunner.run()`. Recommendation: keep interval overlap handling at the scheduler boundary. Target part:
   `apps/worker/src/index.ts`.
2. Severity P1 - Overlap skip must not become fake green continuity proof. Evidence: `apps/worker/src/index.ts:116` logs
   only constant/numeric skip telemetry; the skip branch does not call `recordHealthCheck`; runtime and safety auditors both
   recommended warning-only skip so completed ticks remain the only continuity proof. Recommendation: do not persist overlap
   skips as fresh `target='worker'` `ok` rows. Target part: worker health semantics and admin stale-row proof.
3. Severity P1 - One-shot worker acceptance needed to stay exact and direct. Evidence: `apps/worker/src/index.ts:436`
   still has `dbTick()` call `runDbWorkerTick(db, now, env)` directly; `apps/worker/src/tick-once.ts` remains unchanged;
   `tests/integration/worker-inflight-guard.test.ts:86` asserts this wiring. Recommendation: keep the guard out of
   `dbTick()` and one-shot managed acceptance. Target part: worker acceptance path.
4. Severity P2 - The guard needed deterministic no-env proof rather than timer sleeps. Evidence:
   `tests/integration/worker-inflight-guard.test.ts:15` proves a second call while the first deferred promise is unresolved
   is skipped without invoking the tick body; `tests/integration/worker-inflight-guard.test.ts:68` proves rejection releases
   the in-flight state. Recommendation: keep this direct promise-based contract instead of flaky real-time interval tests.
   Target part: focused worker tests.

## Decisions
1. Implemented a pure injected runner with `runTick`, `now`, and `logger`; it reads no env, opens no DB, and calls no
   provider or adapter itself.
2. Skipped overlap attempts resolve as `skipped_in_flight` and log a warning with `age_ms` and `skipped_while_in_flight`.
3. The long-running DB scheduler uses the runner; memory demo loop remains unchanged because it does not write DB continuity
   proof.
4. One-shot `dbTick()` and `tick-once.ts` remain direct so existing managed/strict acceptance still exercises the exact DB
   worker tick path once.

## Risks
1. This is an in-process guard. It does not prevent two separately deployed worker processes from ticking concurrently; that
   requires a future distributed/advisory-lock design if multi-worker deployment is introduced.
2. Managed worker continuity was not run because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied.
3. Admin-user DB matrix was not run because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
4. Legacy closed-trade import remains blocked by source proof.
5. Live provider/exchange probes, live bot control, deployment, CI, and production burn-in remain separate gated phases.

## Verification/tests
RUN:
1. Branch/status and current-doc inspection: `git status --short`; `git branch --show-current`; `docs/STATUS.md`;
   `docs/NEXT_ACTIONS.md`; `docs/SESSION_PROTOCOL.md`.
2. Read-only phase handoffs created before implementation:
   [20260605-0318-worker-inflight-runtime-auditor.md](20260605-0318-worker-inflight-runtime-auditor.md),
   [20260605-0318-worker-inflight-safety-auditor.md](20260605-0318-worker-inflight-safety-auditor.md), and
   [20260605-0318-worker-inflight-tests-auditor.md](20260605-0318-worker-inflight-tests-auditor.md).
3. `npx vitest run tests/integration/worker-inflight-guard.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts`
   -> PASS (`3` files, `14` tests).
4. `npm run typecheck -w @wtc/worker -- --pretty false` -> PASS.
5. `npx vitest run tests/integration/worker-inflight-guard.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/child-output-redaction.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts`
   -> PASS (`6` files, `38` tests).
6. `npm run typecheck -- --pretty false` -> PASS.
7. `npm run worker:smoke` -> PASS (`[worker:tick] memory demo tick OK`).
8. `npm run accept:bots:continuity:contract` -> PASS (`2` gates: `worker-continuity-fixture`, `worker-smoke`).
9. `npm run secret:scan` -> PASS.
10. `npm run governance:check` -> PASS (`0` errors, `1` known historical warning for
    `20260529-1921-integration-risk-auditor.md`).
11. `git diff --check` -> PASS.
12. Completed background agents were closed after collecting results:
    `019e9449-d852-7b62-a341-5addd40d1450`, `019e9449-ec58-7282-975d-c565fe3c1914`, and
    `019e944a-0215-73e1-80cc-728a1217d2d7`.

NOT RUN:
1. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`; this runner
   creates/drops throwaway databases and must not run against raw production URLs.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
3. `npm run accept:bots:local` and `npm run accept:bots:rendered` - not rerun because this phase changed only worker
   scheduler logic, not web UI; latest observed local/rendered bot-admin results remain documented in `STATUS.md`.
4. Browser/Playwright rendered gates - not run because no web surface changed.
5. Legacy closed-trade import/source acceptance - blocked by missing durable Legacy source proof.
6. Live provider/exchange ping and live bot start/stop/apply-config - intentionally blocked by safety protocol.
7. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this no-env runtime-clarity phase.

## Next actions
1. Next implementation phase should target the managed DB continuity proof if throwaway env is supplied, or Legacy
   closed-trade source proof/import if a durable source artifact is supplied.
