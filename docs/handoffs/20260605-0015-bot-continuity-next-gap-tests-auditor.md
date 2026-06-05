# ecosystem-tests-runner / platform auditor handoff
## Scope
Read-only Phase 4.41 tests/platform audit to identify the highest-impact next no-env/local gap after Phase 4.40, with focus on Legacy/Tortila bot settings, statistics, admin readiness, and bot-not-stopping confidence. This audit inspected the current docs, gate runner, worker continuity scripts, worker/admin/bot tests, and relevant app/package code. It did not run long gates, managed runners, live provider probes, deploy commands, DB mutation, or bot control.

Current checkout observed before the audit: git-backed branch `codex/bot-analytics-settings-canary-20260603` with a broad pre-existing dirty/untracked tree. This handoff is the only intended write from this auditor lane.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - Highest-impact next no-env/local gap: add a local worker-safety smoke bridge to the canonical bot/admin local acceptance path, without claiming full worker continuity. Evidence: `docs/STATUS.md:10`-`docs/STATUS.md:15` says Phase 4.40 greened `accept:bots:local`; `scripts/gates.mjs:167`-`scripts/gates.mjs:168` shows bot/admin plans currently run only browser/visual gates plus `ci:local`; `package.json:22` already exposes a quick no-env `worker:smoke`. Recommendation: add a `worker-smoke` gate that runs `npm run worker:smoke` under the same scrubbed local bot/admin env and include it in `bot-admin-local` after `ci:local` and before browser E2E. Target part: local bot/admin acceptance runner.
2. Severity P1 - Do not spend the next no-env phase on managed worker continuity or admin DB matrix; both are correctly env-blocked. Evidence: `docs/STATUS.md:40`-`docs/STATUS.md:42` marks both managed bot/admin DB gates not green because env is missing; `docs/NEXT_ACTIONS.md:29`-`docs/NEXT_ACTIONS.md:34` says to run them only when the admin DB envs are supplied. Recommendation: keep managed proof as a later credentialed phase; do not fake it locally. Target part: phase selection.
3. Severity P1 - The existing model already treats bot continuity honestly; the gap is acceptance coupling, not continuity business logic. Evidence: `apps/web/src/features/bots/continuity.ts:57`-`apps/web/src/features/bots/continuity.ts:69` requires real/fresh health before proven status and keeps mock in watch; `apps/web/src/features/bots/continuity.ts:169`-`apps/web/src/features/bots/continuity.ts:175` says green requires a fresh worker check and non-stale runtime state; `tests/integration/bot-continuity-builder.test.ts:18`-`tests/integration/bot-continuity-builder.test.ts:41` covers proven vs mock/watch behavior. Recommendation: do not redesign the panel; make the local runner exercise the worker heartbeat/safety path that the panel depends on. Target part: bot continuity UI/test boundary.
4. Severity P2 - The no-env worker smoke is safe but not a continuity tuple; name the next gate accordingly. Evidence: `scripts/safe-worker-tick.mjs:27`-`scripts/safe-worker-tick.mjs:33` documents tuple checks as DB-backed profiles; `apps/worker/src/tick-once.ts:6`-`apps/worker/src/tick-once.ts:18` runs a memory demo without `DATABASE_URL` and only real DB mode prints the tuple at `apps/worker/src/tick-once.ts:22`-`apps/worker/src/tick-once.ts:23`. Recommendation: call the new local acceptance step `worker-smoke` or `worker-safety-smoke`, assert memory-demo output plus forced no-live flags, and explicitly document that it is not `worker_status=ok/bot_continuity=ok` proof. Target part: gate naming and status honesty.
5. Severity P2 - Admin surfaces already consume worker continuity rows when DB proof exists, so a future credentialed run will be visible without UI churn. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:65`-`apps/web/src/features/admin/bot-health-loader.ts:76` projects worker continuity detail; `apps/web/src/features/admin/bot-health-loader.ts:342`-`apps/web/src/features/admin/bot-health-loader.ts:352` loads the latest `target='worker'` row; `tests/integration/admin-bot-health-loader.test.ts:459`-`tests/integration/admin-bot-health-loader.test.ts:492` verifies sanitized worker continuity projection. Recommendation: keep the next no-env phase in runner/test glue, then use the managed tuple later to populate the same admin path. Target part: admin readiness.
6. Severity P2 - Existing browser coverage proves visible readiness/no-control copy, but it does not execute a worker smoke as part of the same local bot/admin acceptance. Evidence: `tests/e2e/bot-readiness-map.spec.ts:21`-`tests/e2e/bot-readiness-map.spec.ts:60` checks Silent-stop guard and disabled live controls for Tortila and Legacy; `tests/e2e/admin-mobile-pg8.spec.ts:52`-`tests/e2e/admin-mobile-pg8.spec.ts:56` checks admin bot continuity visibility. Recommendation: keep the browser assertions, and add the worker smoke as a separate runner child rather than trying to make Playwright start worker code. Target part: test layering.

## Decisions
- The next no-env/local phase should be a narrow runner/test phase: add and prove a local `worker-smoke` child gate inside `bot-admin-local`.
- The new gate must run under the same scrubbed local bot/admin env from `scripts/gates.mjs`, including `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
- The new gate must not set or require `DATABASE_URL`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, journal tokens, managed admin DB URLs, provider credentials, deploy vars, or live-control flags.
- The new gate should assert no-env memory-demo safety output only. It must not call itself full continuity, managed continuity, provider continuity, or bot-not-stopping production proof.
- Managed worker continuity tuple proof and admin selected-user DB matrix stay blocked until their admin DB envs are supplied.

## Risks
- If the local bot/admin runner remains browser-only, future regressions in the no-env worker one-shot path could be missed by the canonical `npm run accept:bots:local` command even though the UI says continuity depends on worker heartbeat evidence.
- If the new local worker smoke is named or documented as continuity proof, it could weaken the current honesty boundary around managed/live readiness.
- The managed full tuple still needs throwaway Postgres credentials; no no-env local gate can prove `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, and `legacy=ok`.
- Legacy closed-trade history remains source-blocked; this recommended gap does not prove realized PnL, profit factor, win rate, fees/funding, or closed timestamps.
- The dirty worktree is broad and pre-existing; this auditor did not reconcile unrelated local changes or certify deploy/CI readiness.

## Verification/tests
RUN:
- Values-hidden env check for `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` - both `NOT_SET` in this process.
- `npm run worker:smoke` - PASS; output showed `[worker:memory] entitlements changed 0` and `[worker:tick] memory demo tick OK`.

NOT RUN:
- `npm run accept:bots:local` - not run; long gate and already green in Phase 4.40.
- `npm run accept:bots:rendered` - not run; long browser gate and already green in Phase 4.40.
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not supplied and it creates/drops a throwaway DB.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied and it is managed DB-backed.
- Root `npm test`, `npm run ci:local`, Playwright, web build, managed/live/provider/deploy commands, DB migrate/seed, SSH/systemd/tmux, GitHub CI, and bot start/stop/apply-config - not run; out of read-only/no-long-gates scope.

## Next actions
1. Start a narrow implementation phase to add `worker-smoke` to `scripts/gates.mjs` and include it in the `bot-admin-local` plan only.
2. Add focused static/runner tests proving the new gate exists, uses `npm run worker:smoke`, runs under `localBotAdminEnv`, excludes managed/live commands, and does not claim tuple continuity.
3. Verify with `node --check scripts/gates.mjs`, focused Vitest for runner contracts, `npm run worker:smoke`, and then one final `npm run accept:bots:local` if time budget allows.
4. Keep the next credentialed phase separate: when env exists, run either the managed worker continuity tuple or the admin selected-user DB matrix, not both in the same session.
