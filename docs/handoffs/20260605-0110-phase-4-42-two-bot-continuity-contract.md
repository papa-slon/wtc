# Phase 4.42 two-bot continuity contract handoff
## Scope
Implement the next no-env/local continuity proof after Phase 4.41: a cheap two-bot contract fixture and gate that proves
Legacy/Tortila worker-continuity semantics without managed DB credentials, provider URLs, journal tokens, DB mutation,
browser automation, deploy, or live bot control.

This phase used three read-only agents before implementation:
- [two-bot-continuity-semantics-auditor](20260605-0110-two-bot-continuity-semantics-auditor.md)
- [two-bot-continuity-integration-safety-auditor](20260605-0110-two-bot-continuity-integration-safety-auditor.md)
- [two-bot-continuity-tests-gates-auditor](20260605-0110-two-bot-continuity-tests-gates-auditor.md)

All three agent results were collected and the background agents were closed before this aggregate handoff.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/warnings.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`
- `docs/handoffs/20260605-0110-two-bot-continuity-semantics-auditor.md`
- `docs/handoffs/20260605-0110-two-bot-continuity-integration-safety-auditor.md`
- `docs/handoffs/20260605-0110-two-bot-continuity-tests-gates-auditor.md`

## Files changed
- `package.json`
- `scripts/gates.mjs`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0110-phase-4-42-two-bot-continuity-contract.md`

## Findings
1. Severity P1 - The no-env continuity contract needed a first-class gate, not only incidental coverage inside root tests.
   Evidence: `package.json` now exposes `accept:bots:continuity:contract` and `accept:worker:continuity:fixture`;
   `scripts/gates.mjs` now exposes `bot-continuity-local` and `worker-continuity-fixture`. Recommendation: keep this gate as
   cheap local proof and do not substitute it for managed continuity. Target part: local acceptance gates.
2. Severity P1 - `bot-continuity-local` must use scrubbed local/no-live env because it runs `worker-smoke`. Evidence:
   `scripts/gates.mjs` includes `bot-continuity-local` in `LOCAL_BOT_ADMIN_MODES`, so `DATABASE_URL`, provider URLs,
   journal tokens, live-control flags, and managed DB env are scrubbed/refused before the child gates run. Recommendation:
   keep continuity contract runners inside the same no-live env boundary. Target part: gate env isolation.
3. Severity P1 - Green continuity requires both bot runtime outcomes to be ok; setup-needed is attention, and malformed or
   unreachable is error. Evidence: `tests/integration/two-bot-continuity-contract-static.test.ts` imports
   `finalWorkerHealthStatus`, `botContinuityStatus`, `healthCheckStatusFor`, and `buildBotContinuitySummary` and asserts the
   ok/setup-needed/error matrix. Recommendation: keep product-named two-bot semantics in a focused fixture. Target part:
   worker and web continuity semantics.
4. Severity P1 - Warning truth and Legacy performance boundaries must survive green-looking local continuity. Evidence:
   the fixture asserts Tortila persistent warnings, Legacy `no_trade_history`, canonical warning filtering, and the Legacy
   closed-trade pending copy/undefined metrics in `legacy-live.ts` and `statistics-panels.tsx`. Recommendation: do not show
   Legacy win rate, PF, realized PnL, fees, funding, or attribution until a real source/importer proof exists. Target part:
   bot analytics truth.
5. Severity P2 - Legacy direct HTTP and Tortila exchange/live-control paths remain negative boundaries in this fixture.
   Evidence: the fixture asserts no `createHttpLegacyAdapter` export, `legacyBaseUrl` cannot activate a real adapter,
   Tortila `/api/marks` remains forbidden, and HTTP control methods remain disabled. Recommendation: keep live controls,
   provider probes, and exchange calls out of local/static acceptance. Target part: bot adapter safety.

## Decisions
- Added `tests/integration/two-bot-continuity-contract-static.test.ts`.
- Added `accept:worker:continuity:fixture` for the focused Vitest fixture.
- Added `accept:bots:continuity:contract` and `bot-continuity-local` for the two-step local contract runner.
- Added `worker-continuity-fixture` to the canonical `bot-admin-local` plan after `worker-smoke`, so the local bot/admin
  summary now names this proof explicitly.
- Included `bot-continuity-local` in the scrubbed local/no-live mode set.
- Did not run managed DB, provider/journal source, live exchange, live bot-control, deploy, or production monitoring gates.

## Risks
- The new fixture proves local semantics and safety boundaries only; it does not prove the managed tuple
  `worker_status=ok/bot_continuity=ok/tortila=ok/legacy=ok`.
- Static/source assertions can drift with harmless refactors; keep them focused on durable contract boundaries.
- Legacy closed-trade analytics remain source-blocked.
- The worktree remains broad and dirty from earlier phases; this phase did not reconcile unrelated changes or certify a
  publishable commit.

## Verification/tests
RUN:
- `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/bot-admin-acceptance-runner.test.ts`
  - PASS, 3 files, 15 tests.
- `npm run accept:worker:continuity:fixture` - PASS, 1 file, 7 tests.
- `npm run accept:bots:continuity:contract` - PASS: `worker-continuity-fixture` PASS and `worker-smoke` PASS under the
  local mock/no-live env banner.
- `node --check scripts/gates.mjs` - PASS.
- `npm run typecheck -- --pretty false` - PASS after fixing the fixture's `readStateDetail` type.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS for current phase `20260605-0110`, 3 cited per-agent handoffs all present, 0 errors,
  1 known historical warning.
- `git diff --check` - PASS.
- `npm run accept:bots:local` - PASS, 5 gates:
  - `ci:local` PASS, metric `Generating static pages (36/36)`
  - `worker-smoke` PASS, metric `[worker:tick] memory demo tick OK`
  - `worker-continuity-fixture` PASS
  - `bot-admin-e2e` PASS, 65 passed on `E2E_PORT=3470`
  - `visual-inventory` PASS, 107 image files

NOT RUN:
- `npm run accept:bots:rendered` - not run in this phase; no rendered UI changed.
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` not supplied and the runner
  creates/drops a throwaway DB.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` not supplied and the
  runner creates/drops a throwaway DB.
- Legacy closed-trade source/importer proof - not run; source table/API still not proven.
- Provider/journal probes, live exchange ping, live bot start/stop/apply-config, close-position, live config mutation,
  deploy/canary publish, GitHub CI, SSH/systemd/tmux, production monitoring, and production burn-in - not run by safety
  scope.

## Next actions
1. If env remains absent, do the small UX-only read-only-label cleanup on admin entry points.
2. When `WORKER_CONTINUITY_ADMIN_DATABASE_URL` exists, run managed worker continuity in its own phase.
3. Keep Legacy closed-trade analytics blocked until a real source-proof artifact is supplied.
