# STATS_SPEC.md — Tortila premium statistics page

**Owner doc for the build agent.** Target route: `/app/bots/statistics?bot=tortila`
Goal: the deployed statistics page must look and feel **exactly** like the standalone FastAPI journal dashboard the user loves — clean, dense, premium, zero "Codex constructor" junk.

The good news: **most of this is already built** on branch `feat/tortila-premium-statistics` (commit `11c5879`, PR #17). This spec defines the gold standard, confirms what is done, and lists the remaining gaps to close before deploy.

---

## 1. The GOLD STANDARD — the v2 journal section list (replicate exactly)

Source of truth (study these, do not copy literally — they are Jinja/vanilla-JS, the WTC port is React):
- `bot_tortila/src/turtle_bot/journal/templates/overview.html`
- `bot_tortila/src/turtle_bot/journal/static/dashboard.js`
- `bot_tortila/src/turtle_bot/journal/static/app.css`

The dashboard is **11 sections, in this exact order** (journal group letters A–K). This is the section contract the WTC stats page MUST honor:

| # | Journal group | Section title | Content |
|---|---|---|---|
| 1 | A | **Hero band** | Mode chip + `Tortila . BingX [. VST]` chip + `+ ATH` chip; big mono equity value + `USDT`; sub-line `±%.2f% since start . init <n> . today ±n`; equity **sparkline** (inline SVG); right side = 6 KPI cells: **Sharpe, Sortino, Profit factor, Max DD, Time in mkt, Expect/trade** |
| 2 | B | **Performance overview** (3 cards) | Card 1 **Returns**: Today / 7-day / 30-day / 90-day / YTD / All time / CAGR. Card 2 **Trade stats**: Trades, Wins/Losses, Win rate, Avg win, Avg loss, Avg hold, Trades/wk, Max streak W/L. Card 3 **Extremes**: Best trade, Worst trade, Best day (+date), Worst day (+date), Vol (daily), Gross P/L |
| 3 | C | **Equity curve & drawdown** | Two-panel chart: equity line+area on top, underwater drawdown below. (Journal has 1D/7D/30D/ALL period tabs — see Gap G3.) |
| 4 | D | **Risk panel** (8 mini cards) | Sharpe (annualised), Sortino (downside-only), Calmar (CAGR/MaxDD), Recovery (return/DD), Max DD % (+USDT), Current DD (+at ATH/underwater), DD duration (+longest UW), Vol (daily) |
| 5 | E | **Open positions** | Auto-fill card grid; each position card: symbol link + side chip + `S{system} . {units}U` chip; price rows (Mark, Avg entry, Last entry, Qty, Stop, TP, Unrealised, Held); inline SVG **price ladder** (stop/entry/mark) |
| 6 | F | **Symbol contribution** | Horizontal bar chart of net P&L per symbol + table (Symbol, Trades, WR, Net, PF, Avg hold, Contrib%) |
| 7 | G | **Monthly returns + Daily P&L heatmap** | Two cards side by side: monthly net-P&L bars; 26-week calendar heatmap with red/green intensity + less/more legend |
| 8 | H | **P&L distribution** | Histogram of trade net P&L (red bins < 0, green bins ≥ 0) |
| 9 | I | **Trade history** | Table: Closed, Symbol, Side, U, Entry, Exit, Ret%, Hold, Gross, Fees, Fund, Net, Reason. (Journal is filterable + paginated — see Gap G1.) |
| 10 | J | **Activity feed** | Mixed stream (trades + safety + decisions), newest first, color-coded left border per kind |
| 11 | K | **Costs footer** | 4 cells: Fees paid, Funding (net), Tracked since, Net combined |

**What makes it premium (the user's "clean, readable, no junk"):**
- Dark Bloomberg-terminal density; **Inter** for UI, **JetBrains Mono** (tabular-nums) for every number.
- Uppercase 10–11px letter-spaced section headers; values large and mono; muted labels.
- Green `#22c55e` up / red `#ef4444` down / blue `#3b82f6` info — applied consistently to every signed number.
- Cards with subtle 1px borders + soft shadow; generous but not wasteful spacing.
- **No status theater**: at most ONE mode chip + ONE health chip. No "evidence ladders", no "continuity monitors", no "operation maps".

> The WTC port intentionally swaps the journal's blue accent for the WTC house palette (`--gold2` gold section headers, `--green`/`--red`). This is correct and on-brand — keep it. Charts are inline SVG (no Chart.js dependency in WTC), which is fine and even cleaner.

---

## 2. What to DELETE — every noise panel (by filename)

The **deployed `main`** version of `apps/web/src/app/(app)/app/bots/statistics/page.tsx` renders these. They are the "cluttered Codex garbage" the user is furious about. **None may appear on the statistics page.** PR #17 already removed them from the page — this section is the acceptance checklist + the explicit "do not re-add" list.

DELETE from the statistics render (already done in PR #17 — verify they are absent):
- `BotContinuityPanel` — the **"Statistics continuity monitor"** with FRESH-PROOF / WATCH-CONTINUITY / MUTATION-ABSENT chips and "scoped data rows".
- `BotOperationMapPanel` — the **"operation map"** ("how this bot will operate", runtime/statistics/settings columns).
- `BotRuntimeEvidencePanel` — the **"evidence ladder"** ("runtime source / tortila journal snapshot / worker cadence / scoped data rows" tables).
- `BotStatisticsCommandCenter` / `BotSetupControlCenter` — the **"command center / constructor"**.
- `BotReadinessMap`, `BotLaunchReadinessPanel`, `BotReadinessMap` readiness ladders — not on stats.
- `WarningSummaryPanel`, `BotConfigReviewPanel` — config-review noise, not on stats.

These component files may continue to exist in `apps/web/src/features/bots/` (other pages/tests may import them) — **do not delete the files**, just ensure the statistics page never imports or renders them. The current page (lines 1–7 imports) imports **only** `TortilaOverview` + `loadTortilaLiveOverview` + plain `@wtc/ui` primitives. Keep it that way.

**Forbidden vocabulary on this page** (reject in review if present): "evidence ladder", "operation map", "command center", "continuity monitor", "FRESH-PROOF", "WATCH-CONTINUITY", "MUTATION-ABSENT", "runtime source", "worker cadence", "scoped data rows", "tortila journal snapshot".

---

## 3. Data source — live journal, NOT stale WTC snapshots

**Authoritative rule:** the page reads **directly from the live Tortila journal**, never from WTC DB snapshot tables (those go stale the instant the worker stops and render a fake `$0` account).

- Entry point: `loadTortilaLiveOverview()` in `apps/web/src/features/bots/tortila-overview-data.ts`.
  - Core canonical reads (`metrics`, `positions`, `trades`, `equityCurve`) come from `createHttpTortilaAdapter(baseUrl, token).getMetrics/getPositions/getTrades/getEquityCurve` → journal `/api/summary`, `/api/trades/list`, `/api/equity`.
  - Extended slices (`advanced`, `symbolBreakdown`, `monthly`, `calendar`, `distribution`, `drawdownSeries`, `marks`, `activity`) come from `loadTortilaOverviewPayload()` → `createTortilaJournalReader(...)`.
  - **The read token never leaves the module** — the page is a server component that passes already-dereferenced data to `<TortilaOverview>`.
- Env wiring (confirmed in `apps/web/src/lib/server-config.ts`): `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL` (canary: `http://127.0.0.1:8080`), `JOURNAL_READ_TOKEN`. The canary has all three set (verified on server).
- **Honest-empty guard (keep, do not weaken):** a journal pointed at a cold DB returns a schema-valid all-zero payload. `loadTortilaLiveOverview` reports `status:'empty'` and the page renders a warning banner + `EmptyState` **instead of fabricating zeros**. The four statuses `live | empty | not-configured | error` each map to one chip via `liveHealthChip()` — keep this single-chip treatment.
- **Do NOT** reintroduce `loadBotReadModelForUser` (the WTC snapshot reader) on this page. It is the PART-1 bug that showed stale positions and $0 equity. The statistics page must not import it.

---

## 4. Premium visual rules (tokens, typography, spacing)

The port already ships a dedicated stylesheet block in `apps/web/src/app/globals.css` under the `.tov-*` namespace. **Reuse it; do not invent new ad-hoc inline styles for the dashboard body.** Key tokens (all already defined in WTC globals):

- **Color tokens:** `--text`, `--muted`, `--dim`, `--panel`, `--stroke`, `--gold2` (section headers + decision accents), `--green` (up), `--red` (down). Up/down applied via `.tov-up`/`.tov-down`/`signClass()` from `tortila-overview/format.ts` (`CHART_COLORS` mirrors the palette for SVG).
- **Typography:** UI = Inter; **all numbers = mono with `font-variant-numeric: tabular-nums`** (`.tov-mono`). Hero equity `clamp(34px,5vw,56px)/700`. KPI value 22px/600. Section headers 13px/700 uppercase `--gold2` letter-spacing 0.06em. Trade table 12px, header 10px uppercase letter-spacing 0.14em.
- **Layout primitives:** `.tov-hero` (1.4fr/1fr → 1fr under 1100px), `.tov-grid-3`, `.tov-grid-2`, `.tov-mini-grid` (4→2 cols), `.tov-pos-grid` (`auto-fill minmax(280px,1fr)`), `.tov-trade-table`. Outer page uses `wtc-stack` spacing.
- **Cards:** use the `@wtc/ui` `<Card>` for each section (`<Card title="…">`) — matches journal card chrome with the WTC house border/shadow.
- **Charts:** inline SVG components already built — `EquityChart` + `DrawdownChart` (equity-chart.tsx), `Sparkline`, `SymbolContribution` (symbol-bars.tsx), `MonthlyBars`, `DistributionChart`, `CalendarHeatmap`, `PositionCard` price ladder. Grid lines `CHART_COLORS.grid`, right-aligned tabular tick labels — keep.
- **Live refresh:** `<AutoRefresh enabled intervalMs={30_000}>` triggers a soft re-fetch, mirroring the journal's 30s cadence. Keep at 30s.

---

## 5. Gap list vs the gold standard (what PR #17 still needs)

PR #17 (`apps/web/src/features/bots/tortila-overview/index.tsx`) is a **faithful, near-complete** port. It already nails sections 1, 2, 3 (chart), 4, 5, 6, 7, 8, 10, 11 and the data wiring. Remaining gaps to reach 1:1 parity with the journal:

- **G1 — Trade history is truncated to 30 rows, not filterable/paginated.** Journal group I has symbol/side/exit-reason filters + prev/next pagination via `/api/trades/list?page=…`. The WTC port renders `trades.filter(closed).slice(0,30)` with no controls. **Action:** add the 3 filter `<select>`s + pager. The journal already does client filtering against the paged endpoint; the WTC adapter pulls all trades server-side, so filtering can be done client-side over the in-memory set or by paging the adapter. Minimum bar: the filter bar + a "showing N of M" line + show more/pager so users aren't capped at 30. Header label currently `Trade history . last 30 closed` — change once paginated.
- **G2 — Trade row `U` (units) column is hard-coded `—`.** Canonical trade has no units field; either drop the column or backfill from the journal trade payload if available. Decide and make it honest (no fake values).
- **G3 — Equity chart has no period tabs (1D/7D/30D/ALL).** Journal group C has them. The WTC `EquityChart` renders the full series only. **Action:** add the 4 period tabs that re-slice the equity/dd series (client-side window, same logic as journal `filterEquityByPeriod`). Nice-to-have, not a blocker, but it's a visible feature of the gold standard.
- **G4 — Symbol-contribution / monthly / distribution are static SVG (no hover tooltips).** Journal uses Chart.js tooltips (net, trades, wr, contrib on hover). WTC SVG has none. **Action (polish):** add lightweight `<title>`/hover affordances so a user can read exact values. Acceptable to ship without, but it's a density/readability win the user will notice.
- **G5 — Marks live-poll.** Journal polls `/api/marks` every 30s and updates each position card's Mark / Unrealised / ladder in place. The WTC port reads marks once server-side per render and relies on `AutoRefresh` to re-render. Confirm the 30s `AutoRefresh` actually re-pulls marks (it re-runs the server component, so it should). Verify the "marks (fresh/stale)" line updates.
- **G6 — `mode` is hard-coded `'unknown'`/`'demo'`.** `loadTortilaLiveOverview` sets `mode:'unknown'` and the hero shows `DEMO`. The journal derives demo/live from `/api/summary`. **Action:** thread the real `summary.mode` (demo|live) through so the hero chip + `. VST` suffix are truthful. The canary is VST/demo, so this likely should read `demo` — but it must come from data, not a constant.

**None of G1–G6 are "garbage" — they are missing journal features.** The page is already clean. Priority order for the build agent: **G6 (truthful mode) and G1 (trade controls) first** (most user-visible), then G3, then G2/G4/G5 polish.

**Acceptance test:** open `/app/bots/statistics?bot=tortila` against the live journal and diff section-by-section against `overview.html`. Every group A–K present, same order, same numbers, mono everywhere, exactly one mode chip + one health chip, none of the Section-2 forbidden panels/words.
