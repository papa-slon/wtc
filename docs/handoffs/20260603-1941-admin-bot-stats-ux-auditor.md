# admin-bot-stats-ux-auditor handoff
## Scope
Read-only Phase 3.75 UX audit for the admin selected-user bot statistics drilldown.

Objective checked: an admin opens a selected user from `/admin/users` and inspects that user's Legacy/Tortila bot positions, trades, and equity evidence in a premium, dense, terminal-first admin page. The page must remain read-only, must not imply live control, must not call live bot probes during render, and must not expose exchange secrets or raw provider credentials.

This was the assigned `ecosystem-ux-ui-designer` foreground audit lane. No product code, tests, migrations, live services, worker state, provider databases, SSH, bot controls, exchange probes, or secrets were changed or probed. No N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- `docs/handoffs/20260603-1918-admin-bot-drilldown-ux-auditor.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SITEMAP.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Files changed
None - read-only audit. Required handoff artifact only:
- `docs/handoffs/20260603-1941-admin-bot-stats-ux-auditor.md`

No product code, tests, migrations, runtime config, live services, or secrets were edited.

## Findings
1. Severity: HIGH. Evidence: Phase 3.74 explicitly left positions/trades/equity unimplemented and named Phase 3.75 as the next slice at `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md:55` to `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md:80`; current `/admin/users/[userId]/bots` renders only latest metric cards or an empty metric state at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:197` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:213`. Recommendation: add a read-only "Bot statistics drilldown" section for the selected user/bot with three dense panels: open positions, closed trades, and equity/drawdown. Keep the existing latest metric cards as the top snapshot row, not the whole statistics experience. Target part: admin selected-user bot detail page.

2. Severity: HIGH. Evidence: the current admin loader only fetches config rows and metric snapshots for instances at `apps/web/src/features/admin/user-bot-detail-loader.ts:323` to `apps/web/src/features/admin/user-bot-detail-loader.ts:353`, then assigns `latestMetric` at `apps/web/src/features/admin/user-bot-detail-loader.ts:385` to `apps/web/src/features/admin/user-bot-detail-loader.ts:419`. The existing user-facing read model already performs the safer complete shape: target user bot instance lookup at `apps/web/src/features/bots/data.tsx:296` to `apps/web/src/features/bots/data.tsx:302`, Legacy active provider mapping gate at `apps/web/src/features/bots/data.tsx:314` to `apps/web/src/features/bots/data.tsx:346`, provider-scoped metric/position/trade WHERE clauses at `apps/web/src/features/bots/data.tsx:347` to `apps/web/src/features/bots/data.tsx:355`, and positions/trades/equity projection at `apps/web/src/features/bots/data.tsx:411` to `apps/web/src/features/bots/data.tsx:530`. Recommendation: extend the dedicated admin DTO with the same persisted DB snapshot semantics instead of calling live adapters or using global fleet rows. Target part: admin loader and DTO.

3. Severity: HIGH. Evidence: DB schema confirms the desired data already exists as worker-written snapshots/imports, not live-control state: metric snapshots at `packages/db/src/schema.ts:451` to `packages/db/src/schema.ts:478`, point-in-time position snapshots at `packages/db/src/schema.ts:480` to `packages/db/src/schema.ts:506`, and immutable closed trade imports at `packages/db/src/schema.ts:508` to `packages/db/src/schema.ts:535`. Repository comments reinforce worker-only append behavior at `packages/db/src/repositories.ts:1866` to `packages/db/src/repositories.ts:1909`. Recommendation: page copy should say "worker snapshot" / "imported trade" / "last persisted WTC row"; never "live account" unless explicitly marked stale/read-only. Target part: source labels, state copy, empty states.

4. Severity: MEDIUM. Evidence: the admin detail currently renders one large full card per bot in a single map at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:87` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:215`. The user statistics page uses a bot selector row and active-bot focus at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:265` to `apps/web/src/app/(app)/app/bots/statistics/page.tsx:302`, which will scale better once positions/trades/equity are added. Recommendation: for Phase 3.75, keep compact summary cards for both bots, then show one active bot's drilldown at a time using a segmented bot selector or master/detail pattern. Target part: page composition and navigation density.

5. Severity: MEDIUM. Evidence: the admin page already states `LIVE CONTROL: DISABLED` and read-only scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:46` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:61`, and its empty metric state says render does not perform live probes at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:209` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:212`. The design system requires explicit, honest state and hidden-never warnings at `docs/DESIGN_SYSTEM.md:26` to `docs/DESIGN_SYSTEM.md:37`, plus canonical admin live-control pills at `docs/DESIGN_SYSTEM.md:1419` to `docs/DESIGN_SYSTEM.md:1431`. Recommendation: every new positions/trades/equity panel needs a visible state strip: storage, source adapter, snapshot/import timestamp, stale/missing state, provider mapping state, and `LIVE CONTROL: DISABLED`. Target part: panel headers and empty/error states.

6. Severity: MEDIUM. Evidence: existing user pages already define useful dense table columns: positions show symbol, side, qty, entry, mark, uPnL, margin, stop, and take-profit at `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:39` to `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:70`; trades separate gross, fee, funding, and net at `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:42` to `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:86`; equity separates wallet equity, peak equity, max drawdown, ROI, and recent curve points at `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:43` to `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:70`. Recommendation: reuse these semantics for admin, but replace user CTAs with admin read-only context and include provider/source evidence where relevant. Target part: positions/trades/equity panel column model.

7. Severity: MEDIUM. Evidence: the current user identity card shows email, roles, registered date, and exchange-key count at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:75` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:84`; provider identity is split between inline prose at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:110` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:120` and a separate provider mapping table at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:218` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:249`. Recommendation: add a compact top "Identity / scope" strip with display name, email, visible WTC user id, selected product, masked provider pub_id, mapping status, entitlement status, and last snapshot/import time. This gives admins a terminal-grade anchor before reading financial rows. Target part: selected-user header and bot drilldown context.

8. Severity: LOW. Evidence: user statistics includes user action CTAs such as "Open bot room", "Configure", and "Download backtester" at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:406` to `apps/web/src/app/(app)/app/bots/statistics/page.tsx:410`; admin detail currently links only to fleet health and entitlements at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:276` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:279`. Recommendation: do not copy user CTAs into the admin drilldown. Admin links should remain read-only destinations: fleet health, entitlement record, audit log filtered to user/bot, and possibly source documentation. Target part: action row.

## Decisions
1. Phase 3.75 should extend `/admin/users/[userId]/bots` as a read-only selected-user diagnostics page, not create a live bot console.
2. Use persisted WTC DB snapshots/imports as the UX truth source for positions, trades, and equity. No render-time live adapter calls, exchange pings, worker ticks, provider DB probes, or bot controls.
3. Show one active bot drilldown at a time after a compact two-bot summary; this keeps the admin page dense and readable when tables are added.
4. Reuse existing user-facing metric/table semantics where they are honest, but strip user action CTAs and add admin identity/source/mapping context.
5. Provider mapping ambiguity, disabled mappings, missing snapshots, and stale worker data must fail visibly, not collapse into a green or generic empty state.
6. No background agents were launched by this assigned single-auditor task; no background agents are running from this lane.

## Risks
1. If the admin loader reuses live adapter fallback behavior from user pages without a guard, the admin page could violate the no-live-probe/no-live-control boundary.
2. Positions/trades/equity rows are sensitive financial/trading evidence. UX should assume admin-only RBAC is necessary but not sufficient; keep masking/source copy aligned with security review.
3. Legacy provider labels may contain account identifiers even when `providerAccountId` is masked. UI should not rely on label text as a safe identifier.
4. Adding all panels for both bots inline will likely create an overlong, scan-hostile page. One active drilldown plus compact summaries is lower risk.
5. Mobile admin tables can overflow unless every new table uses `wtc-table-wrap` and `data-label` attributes.

## Verification/tests
RUN in this audit:
1. Read binding docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`.
2. Checked worktree status and observed substantial pre-existing modified/untracked files from adjacent WTC phases; no reverts performed.
3. Read-only source inspection with `rg`, `Get-Content`, and file listing over scoped admin pages, admin loader/types/queries, user bot statistics/positions/trades/equity pages, user bot read model, DB schema/repositories, and design docs.
4. Wrote exactly this required handoff artifact.

NOT RUN in this audit:
1. Product code/test edits - forbidden by user scope.
2. Vitest, typecheck, lint, build, Playwright, secret scan, governance, and full/e2e gates - not run because this was an audit-only handoff with no product/test implementation change.
3. Dev server/browser visual QA - not run because no live probes or app server work were requested.
4. Live Legacy/Tortila bot start/stop/restart/apply-config/retest, worker ticks, exchange ping, provider DB reads/mutations, SSH/tmux/systemd, `.env` reads/mutations, migrations, seeds, or managed real-DB gates - forbidden by scope and not run.

## Next actions
1. Extend `AdminUserBotSummary` or add `AdminUserBotStatsDetail` with `positions`, `trades`, `equityCurve`, `statsIssue`, `sourceAdapter`, `latestSnapshotAt`, `latestTradeImportedAt`, and provider-mapping state.
2. Extend `loadAdminUserBotDetailFromDb()` to read `bot_position_snapshots`, `bot_trade_imports`, and metric-derived equity rows using the same target-user, bot-instance, and Legacy provider-account scoping as the existing user read model.
3. Update `/admin/users/[userId]/bots` to render compact user identity/source strip, two-bot summary selector, and one active read-only drilldown: KPI snapshot, equity/drawdown, positions table, trades table, and source/missing-state warnings.
4. Keep all new admin tables wrapped in `wtc-table-wrap` with `data-label` cells and concise terminal labels.
5. Add focused static/loader tests that forbid live-control/action imports, verify target-user scoping, verify missing/stale/provider-mapping states, and assert no raw exchange secrets or unmasked unintended provider ids render.
6. After implementation, run focused integration tests, web typecheck/lint/build, secret scan, and scoped admin Playwright desktop/mobile if UI changed.
