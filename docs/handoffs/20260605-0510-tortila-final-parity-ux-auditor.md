# tortila-final-parity-ux-auditor handoff
## Scope
Read-only Phase 4.51 product/UX audit for Tortila final parity beside Legacy after Phase 4.50. Scope was to inspect the current bot settings, setup, statistics, `/app/bots`, and admin selected-user read-only surfaces, plus the current docs/handoff chain through Phase 4.50, then identify the highest-value remaining UX/product gaps around settings simplicity, statistics clarity, admin read-only inspection, no-live-control copy, and the user mental model.

This audit did not read env/secret files, start live services, run a worker, run a browser/dev server, mutate a DB, call a provider/exchange, or perform bot control. This was one requested foreground read-only auditor lane; no background agent fan-out or N-agent claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`
- `docs/handoffs/20260605-0500-admin-source-proof-rendered-ux-auditor.md`
- `docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`
- `docs/handoffs/20260605-0215-bot-final-gap-product-ux-auditor.md`
- `docs/handoffs/20260605-0305-two-bot-finish-board-ux-auditor.md`
- `docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md`
- `docs/handoffs/20260604-1646-bot-next-completion-ux-auditor.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-ux-auditor.md`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`

## Files changed
None - read-only audit. Only this required handoff file was created.

## Findings
1. Severity P1 - Tortila settings still feel expert-first rather than finished-first. Evidence: settings renders `BotSetupControlCenter`, `BotSettingsQuickPath`, `Settings readiness map`, and `Settings continuity monitor` before the editable settings area at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:282`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:317`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:323`; the Tortila editor then renders the strategy map and editable portfolio caps at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:354` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:371` before the first coin card begins at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:479`. Recommendation: add a compact first-screen Tortila "Quick edit" path with coin, timeframe, Turtle system, risk %, save WTC version, and export state, then move portfolio caps/strategy-map diagnostics into a secondary advanced section. Target part: Tortila settings simplicity.
2. Severity P1 - Tortila has performance statistics, but not a named source-confidence row that matches the clarity Legacy now has. Evidence: the user statistics command center gives Tortila `Net`, `win`, and `PF` detail at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:61`, but Legacy has an explicit `Source-proof gate` with status/missing-proof copy at `apps/web/src/features/bots/statistics-panels.tsx:623` and blocked-source explanation at `apps/web/src/features/bots/statistics-panels.tsx:646`; the admin selected-user matrix adds `Source-proof gate` only for Legacy at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:217`, and the DB rendered spec now asserts that Tortila has no `Source-proof gate` at `tests/e2e/admin-user-bot-detail-db.spec.ts:286`. Recommendation: add a Tortila-specific `Journal source` or `Tortila journal proof` row, distinct from Legacy source-proof, on user statistics and selected-user admin coverage. It should say whether journal/worker snapshots, metric rows, trade rows, and equity samples are present/fresh, without implying live exchange connectivity. Target part: statistics clarity and Tortila-vs-Legacy parity.
3. Severity P1 - The selected-user admin drilldown is safe and read-only, but Tortila's admin mirror is generic compared with Legacy's provider/source narrative. Evidence: generic selected-user evidence rows cover entitlement, WTC settings source, runtime scope, aggregate worker precheck, user-scoped statistics, and admin boundary at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:359`; Tortila admin statistics cards show wallet/closed PnL/trades/win rate/source at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:853`, while the coverage matrix reserves the special source narrative for Legacy at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:217`. Recommendation: add a Tortila-only admin coverage row such as `Journal evidence` with evidence from latest metric/source adapter, positions/trades/equity counts, and worker freshness, plus next proof like `run managed continuity gate` or `wait for journal snapshot`; keep it view-only with no forms/buttons. Target part: admin selected-user Tortila read-only view.
4. Severity P2 - No-live-control copy is strong, but repeated negative phrasing can make the product feel blocked instead of read-only-complete. Evidence: `/app/bots` states disabled controls in the header and footer at `apps/web/src/app/(app)/app/bots/page.tsx:76` and `apps/web/src/app/(app)/app/bots/page.tsx:168`; settings repeats the boundary in quick path/status/continuity at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:206` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:317`; setup repeats it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:341` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:626`; statistics repeats it at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:91`; admin repeats read-only/no-mutation language at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:528` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:603`. Recommendation: keep one explicit no-live-control verdict per surface, but convert extra repeats into a consistent short pill/tool-tip pattern like `read-only evidence`, `no live probe`, `mutation absent`. Preserve existing negative tests for start/stop/apply/test controls. Target part: no-live-control copy and user mental model.
5. Severity P2 - The `/app/bots` finish board is solved, but the older generic bot cards below it still risk mixing Tortila and Legacy mental models. Evidence: the finish board gives product-specific paths and rows at `apps/web/src/app/(app)/app/bots/page.tsx:90`, while the lower generic cards still render wallet equity and win rate/PF-style metrics for any bot with metrics at `apps/web/src/app/(app)/app/bots/page.tsx:193` and `apps/web/src/app/(app)/app/bots/page.tsx:220`; Legacy capabilities explicitly say trade history/equity curve are unavailable and closed-trade analytics are not connected at `apps/web/src/features/bots/meta.ts:69`. Recommendation: either collapse the older cards under `Dashboard previews` or make their metrics product-specific: Tortila gets performance metrics; Legacy gets wallet/slots/orders/source-proof pending, with no generic win-rate card until imports exist. Target part: `/app/bots` user mental model after the finish board.
6. Severity P2 - Rendered tests prove presence and safety, but do not yet prove the first useful Tortila edit path is visually prioritized. Evidence: `tests/e2e/bot-settings.spec.ts:80` asserts the settings workbench renders, then asserts the Tortila strategy map, portfolio caps, and cap inputs at `tests/e2e/bot-settings.spec.ts:112`, `tests/e2e/bot-settings.spec.ts:115`, and `tests/e2e/bot-settings.spec.ts:117`; the older basic-path audit already noted that current coverage does not assert first-viewport hierarchy at `docs/handoffs/20260604-1525-bot-settings-basic-path-ux-auditor.md:43`. Recommendation: add desktop/mobile rendered acceptance that the Tortila quick edit path and save/export state appear before advanced caps/maps, with no horizontal scroll and no enabled live-control affordances. Target part: settings acceptance coverage.

## Decisions
1. Treated Legacy source-proof visibility and admin source-proof rendered acceptance as substantially solved by Phases 4.48-4.50; this audit does not recommend another Legacy source-proof slice.
2. Treated `/app/bots` two-bot finish board as solved enough for navigation/discoverability; remaining overview work is to avoid generic lower-card copy undoing that clarity.
3. Prioritized Tortila first-screen simplification plus Tortila journal/source-confidence parity as the highest-value no-env product slice.
4. Did not recommend live exchange ping, live provider probe, live start/stop/apply-config, mapper/importer work, deployment, or managed DB execution in this audit.
5. No background agents were launched for this single auditor lane, so there were no background agents to close.

## Risks
1. Tortila can look "implemented but not finished" if the basic coin/system/risk path stays below status tables, caps, and diagnostics.
2. Adding a Tortila journal-proof row could overclaim freshness if it is not tied to existing worker heartbeat/runtime freshness semantics.
3. Reducing repeated no-live-control copy could weaken safety clarity unless existing no-button/no-form/no-start-stop-apply tests remain strict.
4. Generic bot cards can accidentally reintroduce fabricated Legacy performance expectations even after the finish board and Legacy source-proof work.
5. Managed DB/browser and managed worker gates remain NOT RUN due missing env, so this audit cannot validate true DB-backed browser parity.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`.
2. Inspected the Phase 4.50 aggregate and UX auditor handoff, plus related Phase 4.21, 4.24, 4.28, 4.45, and 4.44/4.50 chain context.
3. Checked git state before writing: branch `codex/bot-analytics-settings-canary-20260603` with a broad pre-existing dirty tree.
4. Static inspection only with `rg` and line-numbered `Get-Content` snippets for the files listed above.
5. Confirmed no env/secret files were read, no live services were touched, no DB command was run, no browser/dev server was started, and no bot-control action was invoked.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and is outside read-only audit scope.
2. `npm run accept:worker:continuity:managed` - not run; requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
3. Playwright/browser checks - not run; this audit did not start servers or browsers.
4. Vitest, typecheck, lint, build, secret scan, governance, `git diff --check` - not run; no code changed and this was a read-only UX audit with one handoff write.
5. Live Legacy/Tortila provider or exchange probes, live exchange ping, live bot start/stop/apply-config - not run and not permitted.
6. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside scope.

## Next actions
1. Implement a narrow no-env Tortila final-polish slice: a first-screen Tortila quick edit path on settings/setup, plus a Tortila `Journal evidence`/`Journal source` row on user statistics and selected-user admin coverage.
2. Keep Legacy source-proof/importer work separate; do not reuse Tortila journal evidence as a Legacy closed-trade source substitute.
3. Update rendered/static tests to prove hierarchy and parity: Tortila quick edit appears before advanced caps/maps on desktop/mobile, Tortila journal evidence appears in user/admin stats, admin remains form-free/read-only, and no start/stop/apply/test connection controls render.
4. When the missing managed envs are intentionally supplied, run the managed worker continuity tuple and selected-user DB matrix as separate gate phases, then scan retained artifacts before promoting.
