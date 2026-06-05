# bot-product-ux-completion-auditor handoff
## Scope
Phase 4.27 read-only bot product/UX completion audit for Legacy/Tortila user bot pages, settings/setup/statistics/readiness components, admin bot and selected-user bot pages, bot operation map/statistics/readiness/continuity artifacts, and prior Phase 4.21-4.26 handoffs.

User objective compared against current implementation:
- Simple defaults/custom settings.
- Coin/stage RSI/CCI slots.
- Exchange key test readiness.
- Bloomberg/BlackRock-quality statistics.
- Admin read-only user drilldown.
- Bot continuity proof.

This is one per-agent audit handoff, not an aggregate phase handoff. I did not claim or launch additional background agents for this single auditor task, and I did not edit code outside this handoff.

## Files inspected
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1637-phase-4-23-admin-bot-owner-selector.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/handoffs/20260604-1724-phase-4-25-admin-launch-readiness-mirror.md`
- `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity P1 - The highest-value next product slice is a local "bot statistics completion cockpit" that upgrades Legacy operational analytics and promotes aggregate worker heartbeat into the statistics/admin surfaces without live provider or deploy access. Evidence: Tortila already has institutional-style metrics such as Sharpe, Sortino, Calmar, recovery, trades/week, and best/worst day at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:435`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:447`, and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:452`; Legacy currently stops at wallet, configured symbols, active slots, and active orders at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:425`-`430`, and explicitly labels PnL as `closed trade imports pending` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:407`. The worker already persists Legacy wallet equity plus liveConfig/rawJson while leaving closed PnL undefined and tradeCount 0 at `apps/worker/src/legacy-live.ts:405`-`432`; the DB schema already has metric snapshots/rawJson and immutable trade import tables at `packages/db/src/schema.ts:508`-`527` and `packages/db/src/schema.ts:564`-`590`. Recommendation: add a stats completion panel that derives stage utilization, active-slot/order exposure, provider-scope coverage, evidence freshness, and missing closed-trade-history states from existing safe snapshots; do not fabricate Legacy win rate, PF, drawdown, or PnL until imported closed trades exist. Target part: `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/features/bots/statistics-panels.tsx`, and the selected-user admin statistics section.
2. Severity P1 - Exchange key "test readiness" is honest but not yet a real exchange connectivity test; product copy must keep saying vault/metadata readiness, not imply live exchange proof. Evidence: `ExchangeKeyReadinessPanel` says no encrypted key means a future audited live adapter is required at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:53`-`62`; a passed check says only vault metadata was found and no live exchange ping was run at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:69`-`74`; rendered key cards show `Exchange ping` as `not run` at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:107`-`110`; the live ping button is disabled/future-only at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122`-`130`; readiness DTO detail also says live exchange ping is still not run at `apps/web/src/features/bots/readiness.ts:160`-`171`. Recommendation: in the next slice, rename any ambiguous operator label to `WTC vault readiness` or `metadata readiness`, keep `Run read-only exchange ping` disabled, and add negative tests for `Connection verified`, `fetch(`, adapter calls, and live ping language. Target part: exchange readiness copy in settings/setup/readiness/admin selected-user views.
3. Severity P1 - Bot continuity proof is now fail-closed at the DTO/UI level, but acceptance-level continuity is still not green because the worker acceptance gate was not run in Phase 4.26. Evidence: the worker records `botContinuityStatus` into `integration_health_checks.target='worker'` at `apps/worker/src/index.ts:287`-`314`; the user readiness loader reads latest aggregate `target='worker'`, applies a 3-minute stale window, and requires worker/bot/product/readState ok at `apps/web/src/features/bots/readiness-loader.ts:118`-`197`; readiness renders a distinct `Worker heartbeat` row at `apps/web/src/features/bots/readiness.ts:113`-`135`; Phase 4.26 explicitly marks `npm run accept:worker:continuity`, worker tick/dev-worker commands, and admin DB matrix as NOT RUN at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:83`-`89`. Recommendation: the local product slice should promote aggregate heartbeat into the top metric row of `BotLaunchReadinessPanel` and into stats/admin completion panels, while still marking real worker acceptance as a separate gate requiring explicit DB authorization. Target part: continuity proof UX and acceptance language.
4. Severity P2 - Simple defaults/custom settings and Legacy RSI/CCI slots are largely complete; the next slice should not be another broad settings rebuild. Evidence: settings mounts `BotSetupControlCenter`, `BotSettingsQuickPath`, readiness map, and continuity panel in first viewport order at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:282`-`329`; `BotSettingsQuickPath` exposes custom/system/built-in state at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:46`-`65`, Legacy coin trigger/stage slot rows at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:99`-`126`, Tortila coin/cap/key rows at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:128`-`155`, and live boundary at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:181`-`186`; the Legacy editor enforces one visible trigger selector and separate RSI/CCI input groups at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:458`-`540`, and shows stage capacity/usage at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:616`-`632` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:636`-`743`. Recommendation: limit settings work to small CTA polish from settings/setup continuity panels into dashboard, safety, and statistics rather than reworking the editor. Target part: settings/setup navigation polish only.
5. Severity P2 - Admin read-only drilldown is strong, but populated DB acceptance is still pending and should remain a named gate. Evidence: `/admin/users` has a server-rendered bot owner selector with selected-user/global-default/fleet links at `apps/web/src/app/admin/users/page.tsx:168`-`203`; selected-user bot details has a read-only command center at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:451`-`476`, a no-live-control launch mirror at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:546`-`558`, and read-only provider/exchange evidence at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:570`-`728`; the DB-backed Playwright spec is explicitly opt-in at `tests/e2e/admin-user-bot-detail-db.spec.ts:5` and asserts no forms, no CSRF hidden inputs, and no start/stop/apply/test buttons at `tests/e2e/admin-user-bot-detail-db.spec.ts:233`-`237`. Recommendation: the next local slice should add static and normal Playwright coverage for any new stats/heartbeat UI, then keep `npm run e2e:admin-user-bots:db:managed:matrix` as an authorized populated-DB proof gate. Target part: admin selected-user statistics/completion mirror.
6. Severity P2 - The Phase 4.21-4.26 chain supports a narrow next slice, not another broad discovery phase. Evidence: Phase 4.21 added the basic settings path and noted future inline presets/default chooser polish at `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md:43`-`46` and `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md:92`-`95`; Phase 4.22 explicitly left user-facing analytics depth and worker snapshot reliability as next work at `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md:80`-`83`; Phase 4.26 left aggregate heartbeat top-row promotion and settings/setup continuity CTAs as the remaining UX polish at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:95`-`99`. Recommendation: implement Phase 4.28 as "Bot statistics completion and heartbeat polish": upgrade stats/completion UX using existing safe DTOs, add tests, and do not touch live control, provider mutation, deploy, or exchange ping. Target part: next phase scope.

## Decisions
- Recommended next slice: Phase 4.28 "Bot statistics completion and heartbeat polish."
- Keep the slice local and read-only: existing WTC snapshot rows, readiness DTOs, config review metrics, and admin loader summaries only.
- Treat Legacy as operational analytics until closed trade imports exist: stage utilization, active slots/orders, provider scope, freshness, and coverage are allowed; fabricated PnL, win rate, PF, Sharpe, or all-clear states are not.
- Keep exchange key readiness as WTC vault/metadata readiness. A live exchange ping remains future-only until security plus bot-integration audit approves the adapter.
- Keep admin selected-user pages diagnostic-only. No forms, no provider mapping mutation, no user settings mutation, no live bot state actions.
- Keep aggregate worker heartbeat separate from product runtime health and from actual worker acceptance. UI can display the latest persisted row; it must not run a worker tick during render.

## Risks
- The worktree was heavily dirty before this audit on branch `codex/bot-analytics-settings-canary-20260603`; this handoff certifies only the inspected state and did not attempt cleanup.
- No tests were run in this read-only audit, so line evidence is inspection evidence rather than fresh green gate evidence.
- The phrase "Bloomberg/BlackRock-quality stats" can pressure the UI toward fake precision. Legacy should stay high-quality by being explicit about missing closed-trade history, not by inventing finance metrics from slot/order rows.
- `accept:worker:continuity` remains not green until an explicitly authorized Postgres worker tick records and verifies `worker_status`, `bot_continuity`, `tortila`, and `legacy`.
- Admin DB matrix remains not green until a disposable/admin Postgres harness is explicitly authorized and screenshots/artifacts are reviewed.
- Exchange readiness remains metadata-only. Any future live exchange ping is a separate security/bot-integration phase, not a UX copy tweak.

## Verification/tests
RUN in this audit:
- `git branch --show-current`
- `git status --short`
- `git log -1 --oneline`
- `rg`/PowerShell line inspection of the files listed above.

NOT RUN in this audit:
- `npm run typecheck`
- `npm run lint`
- `npx vitest ...`
- `npx playwright ...`
- `npm run accept:worker:continuity`
- `npm run e2e:admin-user-bots:db:managed:matrix`
- Live bot start/stop/apply-config.
- Live exchange ping, provider reachability probe, SSH, tmux, systemd, deploy, or production monitoring.

Acceptance tests to add/run for the recommended Phase 4.28 local slice:
- Add `tests/integration/bot-statistics-completion.test.ts` for pure Legacy operational analytics: stage utilization, RSI/CCI slot occupancy, active slot/order counts, provider-scope coverage, missing closed-trade-history state, and no fabricated PF/win-rate/PnL.
- Extend `tests/integration/bot-statistics-static.test.ts` to assert the new completion/heartbeat panel mounts on `/app/bots/statistics`, uses existing DTOs, and contains no live-control or exchange-ping wiring.
- Extend `tests/integration/admin-user-bot-detail-static.test.ts` to assert the selected-user admin mirror shows the same completion/heartbeat facts without forms, CSRF inputs, provider mapping controls, or user-settings edits.
- Extend `tests/integration/bot-read-safety-static.test.ts` to forbid `Connection verified`, live ping claims, `startBot`, `stopBot`, `applyConfig`, adapter calls, and `fetch(` in the new stats/completion components.
- Add or extend `tests/e2e/bot-statistics.spec.ts` to render Tortila and Legacy stats on desktop and mobile, verify no horizontal scroll, verify Legacy operational stats are visible, and verify closed-trade/PF/win-rate remain pending when data is absent.
- Run: `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/bot-readiness-builder.test.ts`
- Run: `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop`
- Run: `npx playwright test tests/e2e/bot-statistics.spec.ts --project=mobile`
- Optional authorized gate only after disposable DB setup: `npm run e2e:admin-user-bots:db:managed:matrix`
- Optional authorized worker proof only after throwaway Postgres setup: `npm run accept:worker:continuity`

## Next actions
1. Open Phase 4.28 as a new session with background read-only agents before edits, per `docs/SESSION_PROTOCOL.md`.
2. Implement the local stats completion/heartbeat polish slice only. Suggested write targets: `apps/web/src/features/bots/statistics-panels.tsx`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx`, and focused tests.
3. Do not touch live-control paths, provider mapping mutation, exchange ping adapters, deploy scripts, production services, secrets, or unrelated dirty files.
4. Finish Phase 4.28 with exact gates run/not run and a new aggregate handoff linking its per-agent handoffs.
