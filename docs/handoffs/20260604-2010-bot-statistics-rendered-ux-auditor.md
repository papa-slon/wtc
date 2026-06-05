# bot-statistics-rendered-ux-auditor handoff
## Scope
Phase 4.35 read-only rendered UX audit for the user bot statistics surface in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope was limited to `apps/web` bot statistics routes/components, existing Playwright e2e specs, and nearby handoffs that define Legacy closed-trade truth. This audit did not run services, read env/secrets, query DBs, probe providers/exchanges, or perform bot control. The only write is this required handoff artifact.

## Files inspected
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/lib/demo.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `playwright.config.ts`
- `package.json`
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md`
- `docs/handoffs/20260604-2000-phase-4-34-data-model-provider-trade-scope.md`
- `tests/e2e/screenshots` directory listing for statistics screenshot names

## Files changed
None - read-only audit.

## Findings
1. Severity P1 - A dedicated bot statistics Playwright spec now exists, but this audit did not run it and the retained dedicated screenshots are not present yet. Evidence: `tests/e2e/bot-statistics.spec.ts:44` and `tests/e2e/bot-statistics.spec.ts:63` define Tortila and Legacy statistics tests; `tests/e2e/bot-statistics.spec.ts:60` and `tests/e2e/bot-statistics.spec.ts:81` define screenshot capture names; `playwright.config.ts:23` through `playwright.config.ts:25` defines desktop and mobile projects. Directory inspection found existing `bot-statistics-journal-*` and warning-summary statistics screenshots, but no `bot-statistics-tortila-dedicated-*` or `bot-statistics-legacy-dedicated-*` images. Recommendation: run the dedicated spec on both projects and retain these four exact screenshots: `tests/e2e/screenshots/bot-statistics-tortila-dedicated-desktop.png`, `tests/e2e/screenshots/bot-statistics-tortila-dedicated-mobile.png`, `tests/e2e/screenshots/bot-statistics-legacy-dedicated-desktop.png`, and `tests/e2e/screenshots/bot-statistics-legacy-dedicated-mobile.png`. Target part: rendered statistics acceptance.

2. Severity P1 - Shared shell markers are already identifiable and should be asserted for both `/app/bots/statistics?bot=tortila` and `/app/bots/statistics?bot=legacy` on desktop and mobile. Evidence: route header copy is rendered at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:329` through `apps/web/src/app/(app)/app/bots/statistics/page.tsx:331`; portfolio anti-blending copy is at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:359`; the command center shell is rendered from `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:104` through `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:124`; the existing shared spec helper asserts many of these markers at `tests/e2e/bot-statistics.spec.ts:29` through `tests/e2e/bot-statistics.spec.ts:40`. Recommendation: the dedicated spec should assert these exact visible markers for both bots: `Trading bot performance`, `Portfolio snapshot`, `Statistics continuity monitor`, `Statistics operation map`, `Statistics evidence ladder`, `Statistics command center`, `Admin mirror`, `Live boundary`, `Mutation absent`, `live control disabled`, and `Different strategies are not blended into one fake win rate`; it should also assert no horizontal scroll for each route. Target part: shared statistics shell.

3. Severity P1 - Tortila should prove real rendered performance analytics in mock/no-live-control mode, not just the generic shell. Evidence: Tortila metrics cards are rendered at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:488` through `apps/web/src/app/(app)/app/bots/statistics/page.tsx:491`; Tortila equity/journal panels are gated to non-Legacy at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:514` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:522`; journal analytics sections are rendered at `apps/web/src/features/bots/statistics-panels.tsx:776` through `apps/web/src/features/bots/statistics-panels.tsx:793`; current Tortila test assertions are at `tests/e2e/bot-statistics.spec.ts:49` through `tests/e2e/bot-statistics.spec.ts:59`. Recommendation: for Tortila desktop/mobile assert exact positive markers `Tortila Turtle Bot`, `Net PnL after fees`, `Win rate`, `Profit factor`, `Equity curve`, `Performance diagnostics`, `Monthly returns`, `Symbol contribution`, `Open risk exposure`, `Trade quality`, `Daily PnL heatmap`, and `PnL distribution`; assert exact negative markers `closed trade imports pending` count 0 and `Legacy closed-trade history pending` count 0. Target part: Tortila rendered statistics.

4. Severity P1 - Legacy must preserve operational statistics while keeping closed-trade performance pending; no PF/win/realized PnL should appear as computed values. Evidence: user statistics forces Legacy command-center PnL to `closed trade imports pending` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:458`; Legacy command-center detail says win rate and PF remain unavailable until closed-trade imports exist at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:64`; Legacy cockpit renders `pending import`, `PF, win rate, realized PnL pending`, and `closed trades pending` at `apps/web/src/features/bots/statistics-panels.tsx:587` through `apps/web/src/features/bots/statistics-panels.tsx:595`; the pending warning is rendered at `apps/web/src/features/bots/statistics-panels.tsx:605` through `apps/web/src/features/bots/statistics-panels.tsx:609`; Phase 4.31 explicitly says not to derive Legacy performance statistics from inactive orders or slots at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:5` and `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:61`. Recommendation: for Legacy desktop/mobile assert exact positive markers `Legacy Averaging Bot`, `Legacy operations`, `Legacy statistics cockpit`, `Averaging bot configuration coverage`, `Provider pub_id`, `closed trade imports pending`, `pending import`, `closed trades pending`, `PF, win rate, realized PnL pending`, `Legacy closed-trade history pending`, `Win rate, profit factor, realized PnL, and attribution stay hidden`, `Stage utilization by trigger`, `Active slots`, and `Active order coverage`; assert exact negative markers `Equity curve` count 0, `Performance diagnostics` count 0, `Net PnL after fees` count 0, `Closed PnL` count 0, `Win rate` exact count 0, `Profit factor` exact count 0, and `Realized PnL` exact count 0. Target part: Legacy honest pending analytics.

5. Severity P1 - The current dedicated spec blocks only two live-claim strings; it should harden the no-live-control/no-exchange-ping negative marker set. Evidence: current helper checks `Connection verified` and `Start bot` only at `tests/e2e/bot-statistics.spec.ts:39` through `tests/e2e/bot-statistics.spec.ts:40`; the rendered command center intentionally states that the statistics surface does not run exchange pings, provider probes, live config apply, position actions, or start/stop at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:91` through `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:93`; Playwright e2e config runs with auth bypass, mock adapter, live bot control disabled, and TV automation disabled at `playwright.config.ts:33` through `playwright.config.ts:38`. Recommendation: for both bots assert no visible text or role/button/link matches `Connection verified`, `Exchange ping verified`, `live exchange verified`, `exchange connected`, `Run read-only exchange ping`, `Start bot`, `Stop bot`, `Apply config`, `Apply live config`, `startBot`, `stopBot`, or `applyConfig`; keep the positive safe markers `Mutation absent` and `live control disabled`. Target part: safety copy and no-control guarantee.

6. Severity P2 - Mobile fit should assert more than document-level horizontal scroll. Evidence: the dedicated spec has `expectNoHScroll()` at `tests/e2e/bot-statistics.spec.ts:6` through `tests/e2e/bot-statistics.spec.ts:27`; the warning visual spec additionally checks warning/pill/table containment and forces the mobile viewport at `tests/e2e/warning-summary-visual.spec.ts:29` through `tests/e2e/warning-summary-visual.spec.ts:47` and `tests/e2e/warning-summary-visual.spec.ts:59`. Recommendation: copy the containment pattern into the dedicated statistics spec for `.wtc-warning`, `.wtc-pill`, `.wtc-table-wrap`, and `.wtc-metric`, then capture full-page screenshots after those assertions on both projects. Target part: desktop/mobile rendered UX quality.

7. Severity P2 - Default Playwright proves mock/no-live-control rendering, not live DB/provider/exchange reachability or production worker continuity. Evidence: `playwright.config.ts:27` through `playwright.config.ts:38` starts local Next dev with mock adapter and no live-control flags; Phase 4.32 warned not to infer live provider/exchange reachability or production DB ownership from this browser pass at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:51`; Phase 4.32 also says formal visual acceptance requires a reviewed visual manifest beyond screenshots at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:56`. Recommendation: report a future green dedicated spec only as rendered mock/no-live-control proof, then run `npm run evidence:visual -- --manifest <manifest> tests/e2e/screenshots` before any formal visual acceptance claim. Target part: gate interpretation.

## Decisions
- This lane remains read-only for source/tests. `tests/e2e/bot-statistics.spec.ts` was inspected but not edited.
- The required dedicated statistics route matrix is two routes by two projects: `/app/bots/statistics?bot=tortila` and `/app/bots/statistics?bot=legacy` on `desktop` and `mobile`.
- The dedicated spec should be run with the existing safe Playwright config: `E2E_AUTH_BYPASS=1`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
- Legacy closed-trade UI must stay pending until a source-backed importer provides stable provider-scoped closed trades; inactive orders/slots are not a source for PF, win rate, or realized PnL.
- Screenshot capture is required evidence, but screenshots alone are not formal visual acceptance without a reviewed manifest.

## Risks
- The worktree is broadly dirty and `tests/e2e/bot-statistics.spec.ts` is currently untracked in this checkout; future runners must verify they are testing the intended local state.
- Existing local Playwright ports may be occupied based on prior handoffs, so a future run should choose a free `E2E_PORT` instead of assuming `3410`.
- Legacy text contains both positive pending words (`PF`, `win rate`, `realized PnL`) and negative absence requirements. Assertions must use exact labels or scoped card/row locators so the pending-warning text does not cause false failures.
- The command-center `Net PnL` card exists for Legacy with value `closed trade imports pending`; do not assert all `Net PnL` text absent on Legacy, only computed performance labels such as `Net PnL after fees`, `Closed PnL`, exact `Win rate`, exact `Profit factor`, and exact `Realized PnL`.
- Running Playwright starts a local Next dev server; this audit did not run it because the task forbade services.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a broad pre-existing dirty tree before this handoff write.
- Read-only `rg`, `Get-Content`, `Test-Path`, and screenshot-directory listing commands over the inspected files listed above.

NOT RUN:
- Playwright/e2e/browser screenshots - not run because this lane was read-only and explicitly forbade services.
- Vitest, lint, typecheck, build, `git diff --check`, and `npm run governance:check` - not run because no source/test implementation was changed by this auditor.
- `npm run evidence:visual -- --manifest ...` - not run because no new screenshot run or reviewed manifest was produced.
- DB migrations/queries, managed DB gates, worker continuity gates, provider/exchange probes, raw env/secret reads, SSH/tmux/systemd/deploy, live bot start/stop/apply-config - forbidden by scope and not run.

Suggested future gate command, PowerShell form:

```powershell
$env:E2E_PORT='3447'
npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop --project=mobile
```

## Next actions
1. Harden `tests/e2e/bot-statistics.spec.ts` with the exact marker matrix above, especially Legacy exact-negative PF/win/realized-PnL checks and the expanded no-live-control/no-exchange-ping regex/button/link checks.
2. Run the dedicated spec on both Playwright projects with a free `E2E_PORT`; retain the four dedicated screenshots named in Finding 1.
3. Add a reviewed visual manifest and run `npm run evidence:visual -- --manifest <manifest> tests/e2e/screenshots` before claiming formal visual acceptance.
4. Keep Legacy closed-trade analytics pending until source proof exists for stable provider-scoped closed trades with realized PnL, fees/funding policy, open/close timestamps, and replay semantics.
