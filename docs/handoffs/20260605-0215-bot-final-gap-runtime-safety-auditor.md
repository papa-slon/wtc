# bot-final-gap-runtime-safety-auditor handoff
## Scope
Read-only Phase 4.44 runtime/safety next-gap audit after Phase 4.43. Objective: identify the highest-value no-env gap that moves WTC toward "the bots do not stop silently and workability is clear" without requiring managed DB env, live provider URLs/tokens, deploy, SSH, systemd, or live bot control. Focus areas were worker continuity, read-only snapshots, no fake green states, admin/user safety boundaries, exchange-key metadata/readiness, and source/proof disclaimers.

## Files inspected
- `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`

## Files changed
- `docs/handoffs/20260605-0215-bot-final-gap-runtime-safety-auditor.md`

## Findings
1. Severity P1 - `/admin/bots` can present a stale aggregate worker row as green continuity. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:65`-`82` projects `target='worker'` status/detail/`checkedAt`, but no age or freshness state; `apps/web/src/app/admin/bots/page.tsx:67`-`79` returns `worker continuity: ok` whenever `botContinuityStatus` and row `status` are `ok`, without checking `checkedAt`; `apps/web/src/app/admin/bots/page.tsx:121`-`127` feeds that pill into the "Persisted worker tuple" gate and says "Keep monitoring cadence" when the pill is ok. By contrast, selected-user admin detail already treats aggregate worker continuity older than 3 minutes as stale/attention at `apps/web/src/features/admin/user-bot-detail-loader.ts:42`-`43` and `apps/web/src/features/admin/user-bot-detail-loader.ts:392`-`415`. Recommendation: make `/admin/bots` worker continuity freshness-aware using the same 3-minute admin window; stale or missing worker rows must be warn/attention, never ok, and gate evidence should show row age/freshness. Target part: admin fleet worker-continuity pill, Bot completion gate map, Worker bot continuity card, and Admin fleet evidence ladder.
2. Severity P2 - The DB worker scheduler has no in-flight guard, so a slow tick can overlap the next interval and muddy heartbeat meaning. Evidence: `apps/worker/src/index.ts:400`-`404` schedules `runDbWorkerTick(db)` every 60 seconds without checking whether the previous tick is still running; the worker status row at `apps/worker/src/index.ts:294`-`317` records completed tick outcome, but there is no "previous tick still running" state for the admin surfaces to distinguish slow continuity from normal cadence. Recommendation: after the P1 admin stale-row slice, add a tiny no-env serialized tick wrapper or in-flight guard that logs/skips overlapping DB ticks without provider calls, then cover it with a pure Vitest contract. Target part: worker continuity scheduler clarity.
3. Severity P2 - Setup/settings pages intentionally avoid aggregate worker readiness, but the distinction remains fragile and should be locked by the next safety test update. Evidence: setup uses `loadBotReadinessForUser(..., 'setup-review', { includeOperationalRows: false })` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:209`-`214` and renders an unchecked continuity fallback at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:253`-`256`; settings does the same at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:203`-`208` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:255`-`258`. Current static coverage asserts the monitors exist and avoid live-control semantics at `tests/integration/bot-read-safety-static.test.ts:92`-`113`, but it does not explicitly freeze the no-operational-row contract for setup/settings. Recommendation: include an assertion in the P1 slice that setup/settings continue to use `includeOperationalRows: false` and point users to dashboard/safety for worker-backed proof. Target part: setup/settings proof disclaimers and no fake green states.

## Decisions
- Highest-value no-env implementation slice: admin fleet worker-continuity freshness hardening on `/admin/bots`.
- Do not recommend managed worker continuity, selected-user DB matrix, live exchange ping, live provider probe, deploy, SSH/systemd, or live bot control for this next slice.
- Keep the slice local/static plus PGlite/loader tests only. It improves workability clarity without claiming live continuity.
- Keep exchange-key readiness as metadata-only. The current `ExchangeKeyReadinessPanel` correctly says no live ping is claimed and keeps the future ping button disabled.

## Risks
- Static audit only; no product code or tests were changed in this lane.
- The worktree was already heavily dirty before this handoff, including modified and untracked bot/admin/worker files. This audit did not revert or normalize that state.
- Line numbers are current as inspected in this dirty tree and may shift if another agent edits the same files.
- The P1 slice does not prove managed DB continuity; it only prevents stale persisted worker evidence from looking green in local/admin UI.

## Verification/tests
RUN:
1. `git branch --show-current` - observed `codex/bot-analytics-settings-canary-20260603`.
2. `git status --short` - observed a heavily dirty tree before writing this handoff.
3. Read-only `Get-Content`/`rg` inspections of the focused docs, bot UI, worker runtime, admin health, and integration tests listed above.
4. `Test-Path docs/handoffs/20260605-0215-bot-final-gap-runtime-safety-auditor.md` - confirmed the required handoff did not already exist before writing.

NOT RUN:
1. Vitest/Playwright/typecheck/secret scan - not run because this was a read-only audit with no product/test code changes.
2. `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied and the task forbids managed DB env work.
3. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied and the task forbids managed DB env work.
4. Live exchange/provider probes, live bot start/stop/apply-config, deploy/canary publish, SSH/systemd/tmux, and production monitoring - not run by scope.

## Next actions
1. Implement the bounded P1 slice:
   - `apps/web/src/features/admin/types.ts`: add `freshness: 'fresh' | 'stale' | 'missing'`, `ageSeconds`, and `staleAfterSeconds` to `AdminBotHealthResult.workerBotContinuity`.
   - `apps/web/src/features/admin/bot-health-loader.ts`: compute worker row age against a 3-minute window, using the same convention as `user-bot-detail-loader.ts`; mark missing/stale rows non-green.
   - `apps/web/src/app/admin/bots/page.tsx`: update `workerContinuityPill`, `adminAcceptanceGateRows`, `fleetEvidenceMetrics`, `fleetEvidenceRows`, and the "Worker bot continuity" card so stale aggregate rows render as attention with explicit age/freshness copy.
   - `tests/integration/admin-bot-health-loader.test.ts`: add fresh and stale worker-row assertions; stale `status=ok`/`botContinuityStatus=ok` must not become green.
   - `tests/integration/bot-read-safety-static.test.ts`: assert `/admin/bots` uses worker freshness/age before the ok pill, and assert setup/settings keep `includeOperationalRows: false`.
2. Verify that slice with:
   - `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts`
   - `npm run typecheck -- --pretty false`
   - `npm run secret:scan`
   - `git diff --check`
3. Defer worker in-flight guard to the following no-env runtime slice unless the stale-row implementation reveals scheduler ambiguity that must be fixed immediately.
