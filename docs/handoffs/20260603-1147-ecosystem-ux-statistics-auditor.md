# ecosystem-ux-statistics-auditor handoff
## Scope
Read-only archaeology of the old Tortila journal/statistics UX, the current WTC statistics UI, and the legacy averaging bot's analytics availability.

## Files inspected
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\metrics.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\templates\overview.html`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\templates\symbol.html`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/analytics/src/metrics.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Old Tortila had a substantially richer statistics product: hero KPIs, performance overview, equity and drawdown charts, risk panel, open position ladder, symbol contribution, monthly/calendar views, filterable trades, and activity feed. Recommendation: WTC statistics should be expanded beyond the current top cards. Target part: statistics UI.
2. Severity: High. Tortila exposes advanced analytics endpoints that WTC does not currently consume directly, including advanced metrics, symbol breakdown, calendar, monthly, distribution, drawdown, trade list, and activity. Recommendation: either consume those through an audited adapter path or compute equivalent metrics from WTC DB imports where possible. Target part: Tortila analytics.
3. Severity: Medium. WTC monthly analytics currently derive from equity start/end by month, while old Tortila monthly PnL was trade-net based. Recommendation: show trade-net monthly where closed trades exist and label equity-derived data distinctly. Target part: analytics correctness.
4. Severity: Medium. WTC activity feed currently loses old decision/safety context. Recommendation: show trade/position activity now and keep decision/safety import as a later adapter gap. Target part: activity tape.
5. Severity: Medium. Legacy should not be presented as a performance-statistics bot yet because it has no safe closed-trade history or equity curve exposed to WTC. Recommendation: show a legacy operations view: stage slots, symbol coverage, ladder settings, active intent, and blockers. Target part: legacy UX.

## Decisions
- Build a Bloomberg-style WTC stats surface from safe canonical trades, positions, and equity points.
- Add explicit empty states where data is unavailable.
- Add legacy operational panels rather than fake Sharpe/PF/DD.

## Risks
- Real old-Tortila richness depends on populated journal data; the local old journal sample had little trade data.
- Directly fetching extra Tortila live endpoints from user page renders would weaken the current DB-backed canary boundary.

## Verification/tests
RUN: read-only code/template inspection and local old-journal schema/count checks.

NOT RUN: live endpoint calls, page edits, tests, server startup, or bot mutation.

## Next actions
1. Extend `@wtc/analytics` with advanced metrics computed from canonical WTC data.
2. Upgrade WTC statistics panels with risk, returns, trade quality, symbol contribution, calendar, distribution, and activity sections.
3. Add a legacy operations panel that is honest about blocked live data.
