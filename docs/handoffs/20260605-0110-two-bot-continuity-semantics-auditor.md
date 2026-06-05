# two-bot-continuity-semantics-auditor handoff
## Scope
Read-only Phase 4.42 semantics audit after Phase 4.41. Identify the precise pure helpers and fixture assertions needed for a local no-env two-bot continuity contract fixture, likely `tests/integration/two-bot-continuity-contract-static.test.ts`, without running long gates, mutating DB state, touching live bots, using provider/journal env, or editing product code.

## Files inspected
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`

## Files changed
- `docs/handoffs/20260605-0110-two-bot-continuity-semantics-auditor.md`

## Findings
1. Severity P1 - The worker already exposes the core pure two-bot aggregate helpers; the fixture should use them directly instead of parsing worker logs. Evidence: `apps/worker/src/index.ts:86-113` defines the two-bot outcome semantics, `apps/worker/src/index.ts:288-315` records the same Tortila/Legacy tuple into the worker health detail, `apps/worker/src/tick-once.ts:22-23` prints the managed tuple only after a real DB tick, and `tests/integration/worker-health-mapping.test.ts:73-109` already covers the basic aggregate matrix. Recommendation: in `tests/integration/two-bot-continuity-contract-static.test.ts`, import `finalWorkerHealthStatus` and `botContinuityStatus`; assert both bots `snapshot='ok'/readState='ok'/healthStatus='ok'` returns `workerHealthStatus='ok'` and `botContinuityStatus='ok'`; assert one bot `skipped/not_configured` returns `workerHealthStatus='not_configured'` and `botContinuityStatus='attention'`; assert either bot `snapshot='error'`, `healthStatus='error'`, `readState='unreachable'`, or `readState='malformed'` returns error; assert core `misconfigured` is preserved and cannot become green. Target part: worker aggregate continuity semantics.
2. Severity P1 - The no-env contract should pin health mapping and local safety guards, not run `tick()` or any env-backed worker. Evidence: `apps/worker/src/jobs.ts:75-95` maps adapter read states to persisted health status, `apps/worker/src/index.ts:68-84` exposes safety and DB-required pure helpers, `apps/worker/src/tick-once.ts:5-19` makes the memory demo local-only and rejects no-DB real acceptance, and `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md:69-70` states that worker-smoke is not the managed tuple proof. Recommendation: import `healthCheckStatusFor`, `workerSafetyState`, and `workerRequiresDatabase`; assert `not_configured` is not `down/error`, `stale` maps to persisted `ok` while web continuity remains attention when stale, empty env keeps live control and TV automation disabled, and production-like env requires `DATABASE_URL`; do not call `tick`, `memoryTick`, `dbTick`, `safe-worker-tick`, or stdout tuple parsing in the static fixture. Target part: no-env safety and health-status mapping.
3. Severity P1 - The web continuity builder already has the user-facing product semantics needed for a deterministic two-bot fixture. Evidence: `apps/web/src/features/bots/continuity.ts:57-69` defines green/watch/interrupted/pending rules, `apps/web/src/features/bots/continuity.ts:112-181` builds the rows that users see, `apps/web/src/features/bots/continuity.ts:187-199` provides unchecked health for setup renders, and `tests/integration/bot-continuity-builder.test.ts:18-105` covers isolated cases. Recommendation: define a deterministic `botHealth(productCode, overrides)` fixture with fixed `lastSyncAt`, `staleDataSeconds`, `processAlive`, and warnings; assert both `tortila_bot` and `legacy_bot` summaries are `{ status: 'proven', tone: 'ok', label: 'continuity proven' }` only with `adapterMode='real'`, `readState='ok'`, fresh age, zero active warnings, and positive scoped rows; assert product-specific Runtime source proofs are `Tortila journal snapshot` and `Legacy provider pub_id snapshot`; assert the Silent-stop guard says `continuity proven`; assert the Control boundary row stays `read-only` with proof `no live action`; assert mock, stale, warning-bearing, and not_configured variants never become green. Target part: user-facing continuity summary contract.
4. Severity P2 - The admin worker-row projection is already pure but private, so a no-env contract needs a small export or pure-module move before it can assert the same shape without PGlite/DB setup. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:65-83` projects the worker row detail, `apps/web/src/features/admin/bot-health-loader.ts:343-352` selects only the latest `target='worker'` row, `apps/web/src/features/admin/bot-health-loader.ts:492-495` returns the projection, `apps/web/src/app/admin/bots/page.tsx:67-79` derives the admin continuity pill from it, and `tests/integration/admin-bot-health-loader.test.ts:459-492` currently proves projection through an isolated DB. Recommendation: export `workerBotContinuityView` as `projectWorkerBotContinuityView` or move it to a pure helper without changing `loadAdminBotHealthFromDb`; the static fixture should feed a synthetic row with `status='ok'`, fixed `checkedAt`, `coreWorkerStatus='ok'`, `botContinuityStatus='ok'`, and all Tortila/Legacy snapshot/health/readState fields `ok`, then assert every field plus no secret passthrough; also assert a `tortilaSnapshot='skipped'/tortilaReadState='not_configured'` row remains attention and does not become green. Target part: admin persisted worker tuple projection.
5. Severity P2 - Legacy continuity in this fixture must remain runtime-snapshot scoped and must not imply closed-trade analytics. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:248-340` derives Legacy provider accounts, active slots, and active orders from snapshot `liveConfig`, `apps/worker/src/legacy-live.ts:405-447` writes Legacy runtime snapshot detail while leaving closed-trade metrics unset and `tradeCount` zero, `docs/STATUS.md:49-55` says Legacy closed-trade performance history remains source-blocked, and `docs/NEXT_ACTIONS.md:44-48` forbids substituting inactive orders/slots or Turtle/Tortila rows for Legacy closed trades. Recommendation: the static fixture should set Legacy `dataRowsLabel` to runtime-scoped rows, assert the `Scoped data rows` proof only represents provider/runtime evidence, and explicitly avoid assertions for win rate, realized PnL, profit factor, closed-trade count, or trade attribution. Target part: Legacy runtime-vs-closed-trade boundary.
6. Severity P2 - Phase 4.41 already names this as the next no-env gap, while managed continuity remains blocked by absent env. Evidence: `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md:50-52` recommends the Phase 4.42 fixture/static lane, `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md:104-121` lists managed/live gates not run, `docs/NEXT_ACTIONS.md:32-43` defines the no-env contract phase and managed DB blockers, and `docs/NEXT_ACTIONS.md:54-62` says local proof is not live DB/provider/exchange readiness. Recommendation: add the focused fixture as local static proof, run it with `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts`, and keep `npm run accept:worker:continuity:managed` separate until `WORKER_CONTINUITY_ADMIN_DATABASE_URL` exists. Target part: Phase 4.42 acceptance boundary.

## Decisions
- Recommended a no-env static Vitest fixture, not a DB, provider, journal, Playwright, or worker-runner gate.
- Recommended reusing existing pure helpers: `finalWorkerHealthStatus`, `botContinuityStatus`, `healthCheckStatusFor`, `workerSafetyState`, `workerRequiresDatabase`, and `buildBotContinuitySummary`.
- Identified one likely product-code helper exposure needed for the future implementation: export or move the pure admin worker projection currently named `workerBotContinuityView`.
- Kept this audit read-only except for this handoff file.
- Did not start, stop, apply config to, probe, or mutate any live bot, exchange, provider, journal, DB, server, container, or deployment.

## Risks
- This audit is based on the current dirty local tree after Phase 4.41; it does not certify a clean publishable commit.
- The proposed static fixture would prove continuity semantics only. It would not replace managed worker acceptance, real Postgres acceptance, provider/journal source proof, browser proof, deploy proof, or production monitoring.
- Exporting the admin projection should be a minimal helper exposure; changing loader DB behavior would exceed the fixture scope.
- If the fixture imports from `apps/worker/src/index.ts`, it relies on the existing guarded entrypoint at `apps/worker/src/index.ts:407-408` so importing helpers does not start the worker.

## Verification/tests
RUN:
- `git status --short --branch` - read-only state check; current branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty and untracked files, including focus files.
- `Get-Item -LiteralPath ...` for the requested focus files - read-only file presence/size check.
- `rg -n "continuity|health|bot|worker|snapshot|sequence|last|stale|missing|provider|journal|fixture|static|build" ...` across the focus files - read-only evidence search.
- Line-numbered `Get-Content` inspections for the focus files and small supporting context files listed in Files inspected.
- `rg -n "buildBotContinuitySummary|uncheckedBotContinuityHealth|workerBotContinuity|BotContinuity|continuity" apps/web/src tests/integration -g "*.ts" -g "*.tsx"` - read-only consumer/test search.
- `rg -n "accept:worker:continuity|run-worker-continuity|worker_continuity|bot_continuity|worker-smoke|worker:smoke" package.json apps/worker/package.json scripts tests docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md` - read-only gate boundary search.

NOT RUN:
- `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts` - not run; fixture does not exist yet and this lane is audit-only.
- `npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/bot-continuity-builder.test.ts` - not run; scope requested no long gates and current task was semantics audit/handoff only.
- `npm run worker:smoke` - not run; Phase 4.41 already recorded this as memory-demo proof, and this lane did not execute worker commands.
- `npm run accept:bots:local`, `npm run accept:bots:rendered`, `npm run ci:local`, `npm test`, typecheck, lint, build, Playwright, visual inventory, and GitHub CI - not run; out of scope for read-only auditor lane.
- `npm run accept:worker:continuity:managed` and `npm run e2e:admin-user-bots:db:managed:matrix` - not run; required managed DB env was not used and these gates create/drop throwaway DBs.
- Provider/journal env probes, live exchange ping, live bot start/stop/apply-config, close-position, live config mutation, DB mutation, deploy/canary publish, SSH/systemd/tmux, production monitoring, and production burn-in - not run by explicit safety scope.

## Next actions
1. Implement `tests/integration/two-bot-continuity-contract-static.test.ts` as a pure no-env Vitest fixture using the helpers and assertions named above.
2. Export or move the pure admin worker projection (`workerBotContinuityView`) only if the fixture needs to assert admin persisted-worker shape without DB setup.
3. Run only the focused fixture first: `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts`.
4. Keep managed worker continuity acceptance in a separate phase until `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is available.
5. Keep Legacy closed-trade analytics blocked until a separate source-proof artifact identifies a durable table/API and replay contract.
