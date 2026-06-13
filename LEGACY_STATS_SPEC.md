# LEGACY_STATS_SPEC.md — Legacy (DCA/averaging) Bot premium statistics page

**Owner doc for the build agent.** Target route: `/app/bots/statistics?bot=legacy`
Goal: replicate the **quality** of the just-shipped Tortila premium page for the legacy RSI/CCI mean-reversion + DCA bot, **reshaped around DCA risk** (averaging depth, signal mix, reconstructed equity) and **honest about reconstructed vs measured vs unavailable** data. Match the Bloomberg-dense dark terminal feel; never fabricate a number.

This is **Reading A**: `legacy_bot` already exists end-to-end (slug `legacy`, code `legacy_bot`, in `BOT_LIST`/`BOT_CAPS`/entitlements). We UPGRADE the placeholder `LegacyPanel` (statistics/page.tsx:103-117); we do NOT add a product or change enums.

---

## 0. Generalization decision (READ FIRST)

**Do NOT overload `TortilaOverview` with a `variant` prop.** Reuse the premium LEAF components verbatim; compose them in a NEW thin sibling `LegacyOverview` wrapper driven by a typed `capabilities` object. Reasons:
- The legacy path has **no `CanonicalMetrics`/`positions`/`trades`/`equityCurve` adapter feed** — the legacy control adapter is hard-blocked (`createLegacyBlockedAdapter`, factory.ts:39). The page is driven SOLELY by the new shim payload slices, so `TortilaOverviewProps` is structurally wrong for it.
- Legacy hides 9 of 11 Tortila sections and adds 3 DCA-only ones. A single 540-line component switching on `variant` is mostly mutually-exclusive branches = fork-by-if-statement and a magnet for leaking a vanity metric onto the DCA page.
- `TortilaOverview` stays **byte-stable** (zero risk to the just-shipped page at commit d0e205f).
- The premium FEEL lives in the leaf components + `tov-*` CSS + mono typography — that is reused 100%. That is where "replicate, don't fork" has teeth.

**Reused VERBATIM (no change):** `tortila-overview/sparkline.tsx` (Sparkline), `equity-panel.tsx` (EquityPanel), `activity-feed.tsx` (ActivityFeed), `symbol-bars.tsx` (SymbolContribution — gains an additive `columns` prop, default unchanged), `auto-refresh.tsx` (AutoRefresh), `format.ts` (all `fmt*`/`signClass`/`CHART_COLORS`), all `tov-*` globals.css classes, `@wtc/ui` `Card`/`RiskWarningBanner`/`EmptyState`/`StatusPill`/`SectionHeader`/`buttonClasses`.
**New small DCA leaves (under `legacy-overview/`):** `depth-gauge.tsx`, `signal-mix.tsx`, `stuck-bag-card.tsx`. SymbolContribution and ActivityFeed are reused via loader-side field/kind mappers — no new files for those.

---

## 1. The capabilities prop shape

```ts
// apps/web/src/features/bots/legacy-overview/index.tsx (exported for the page + future bot #3)
export interface BotOverviewCapabilities {
  reconstructed: boolean;        // legacy: true  → persistent 'reconstructed' tags + standing banner + relative-PnL captions
  hasLiveMark: boolean;          // legacy: false → hide Mark/Unrealised rows, show markNote
  hasStopLoss: boolean;          // legacy: false → OMIT stop row entirely (NOT 'Stop: none'), hide price ladder
  hasWinLossStats: boolean;      // legacy: false → hide win-rate / avg-win / streaks / PF
  hasRiskRatios: boolean;        // legacy: false → hide RiskPanel + Sharpe/Sortino/etc KPI cells
  hasPnlDistribution: boolean;   // legacy: false → hide histogram (uniform +0.45% = single spike)
  hasCalendarHeatmap: boolean;   // legacy: false → hide daily heatmap
  hasMonthlyPnl: boolean;        // legacy: false → hide monthly signed-PnL bars
  hasTradeHistory: boolean;      // legacy: false → hide paged trade table (shim has only activity)
  hasFunding: boolean;           // legacy: false → costs band drops the Funding cell
  equityIsWallet: boolean;       // legacy: false → EquityPanel initialEquity=0, hero 'reconstructed net PnL' (not wallet), no since-start %
  showDcaSnapshot: boolean;      // legacy: true
  showDepthGauge: boolean;       // legacy: true
  showSignalMix: boolean;        // legacy: true
}

export const LEGACY_DCA_CAPS: BotOverviewCapabilities = {
  reconstructed: true, hasLiveMark: false, hasStopLoss: false, hasWinLossStats: false,
  hasRiskRatios: false, hasPnlDistribution: false, hasCalendarHeatmap: false, hasMonthlyPnl: false,
  hasTradeHistory: false, hasFunding: false, equityIsWallet: false,
  showDcaSnapshot: true, showDepthGauge: true, showSignalMix: true,
};
```

`LegacyOverview` props: `{ overview: LegacyLiveOverview; caps: BotOverviewCapabilities }` — it does NOT take CanonicalMetrics/positions/trades/equityCurve. Everything comes from `overview.payload` slices + a few derived scalars computed in the loader.

---

## 2. Section list (in order) — reuse vs new, source, availability

**availability legend:** `available` (directly measured from the order/slot ladder), `reconstructed` (modelled from the closed-cycle ladder at fixed +0.45% TP — MUST carry a 'reconstructed' tag), `unavailable` (genuinely absent — hidden or labelled, never faked).

### Kicker + auto-refresh + reconstruction banner
- **Reuse:** `AutoRefresh` (verbatim, `enabled={payload.configured}`, 30s, points at new `/api/bots/legacy/overview`) + `@wtc/ui RiskWarningBanner severity="info"`.
- **Kicker:** `Legacy Bot — Reconstructed overview` (NOT 'Live overview' — money is reconstructed).
- **Standing honesty banner (NEW one-liner, rendered WHENEVER status==='live', not only on error):** title `Reconstructed analytics`, detail surfaces `summary.method` verbatim: "PnL, equity and fees below are RECONSTRUCTED from the closed-cycle order ladder — every cycle exits at +`{tp_pct}`% take-profit on the volume-weighted average entry; both fee legs at `{fee_rate}`. This is not a wallet balance. Live unrealized PnL and current marks are not available. Win-rate is ~100% by construction (fixed TP, no stop-loss) and is not shown as a skill metric. Method: `{summary.method}`." — **This is the single honesty anchor the auditors will check for.**
- **Source:** `/api/health` (reconstructed flag), `/api/summary.method`. **Availability:** available.

### 1. Hero band — reconstructed DCA headline
- **New leaf `DcaHero`** (or inline in index.tsx) composed from the `tov-hero` shell + reused `Sparkline`. NOT the Tortila `Hero` — KPI set and headline semantics differ.
- **Left:** chip row `RECONSTRUCTED` (gold) + `LIVE` (neutral — `summary.mode==='LIVE'`, NO demo/VST branch) + `Legacy · BingX` + `2 accts`. Big mono number = `summary.realized_pnl_net` labelled **"Reconstructed net PnL"** with unit `USDT` and a small `relative · baseline 0` caption (since `equity_baseline=0`, `absolute=false`). **NO `% since start`** — no capital denominator; faking one is forbidden. Sub-line: `gross {fmtSigned(realized_pnl_gross)} · fees {fmtSigned(-fees_total)} · {closed_cycles} closed · {open_cycles} open · since {equity.ts[0] slice(0,10)}`. Sparkline = `equity.equity`.
- **Right — the honest DCA six KPI cells** (reuse `tov-kpi` markup + `data-tip`), from `/api/summary` + derived:
  1. **Closed cycles** = `closed_cycles`.
  2. **Open bags** = `open_positions` — tip "positions still averaging, not yet at TP".
  3. **Avg depth** = derived weighted mean from `/api/depth_distribution` (`sum(depth*count)/sum(count)`), amber if >1.
  4. **Worst open depth** = `max(averaging_depth)` from `/api/positions` (e.g. `3/3`), red when ==max.
  5. **Fees (recon)** = `-fees_total`, `recon` tag.
  6. **Net / cycle (recon)** = `realized_pnl_net / closed_cycles`, `recon` tag.
- **HIDDEN here:** Sharpe, Sortino, Profit factor, Max DD, Time-in-mkt, Expect/trade. `tp_completion_rate_pct` is FETCHED but **DELIBERATELY NOT RENDERED** (the ~100% honesty landmine).
- **Availability:** summary fields `available`; `realized_pnl_net`/`fees_total`/sparkline `reconstructed`.

### 2. Reconstructed equity & drawdown
- **Reuse `EquityPanel` VERBATIM.** Feed `ts=equity.ts`, `equity=equity.equity`, **`initialEquity={0}`** (honest baseline — dashed 0 line separates reconstructed-profit-above from underwater-below), `ddTs=equity.dd_ts`, `ddPct=equity.dd_pct`.
- **Card title:** `Reconstructed cumulative PnL & drawdown`. **Caption:** "Relative to a 0 baseline. Reconstructed realized profit from closed cycles — NOT a wallet balance." 1D/7D/30D/ALL tabs + crosshair + underwater strip work unchanged. ~791 cycles over 85 days → dense premium curve.
- **Empty:** EquityPanel already renders "Not enough equity history in this window."
- **Source:** `/api/equity` (`ts`,`equity`,`dd_ts`,`dd_pct`,`baseline:0`,`absolute:false`). **Availability:** reconstructed. **Audit note:** early `dd_pct` is flat-at-0 by design (peak ≤ 0 before cumulative PnL turns positive) — honest, do not "fix".

### 3. How stuck — averaging-depth distribution (THE signature DCA section)
- **New leaf `DepthGauge`** — replaces Tortila's RiskPanel + win-rate. Two parts:
  - **(a)** `tov-mini-grid` of 4 stats from `depth_distribution.all` (data: depth0=680, depth1=101, depth2=4, depth3=6, total 791): "Clean fills (depth 0)" = depth0 + `(pct%)` (neutral/green), "Averaged once" = depth1, "Averaged 2x+" = depth2+depth3 (amber), "Open at max depth" = count of `open[]` rows at max depth (red).
  - **(b)** a horizontal segmented bar (one segment per depth 0/1/2/3, width ∝ count, color ramp green→amber→red as depth rises) on the `tov-sym-bar` fill/zero CSS idiom; **overlay** the `open[]` distribution as a distinct outlined sub-bar so the 2 currently-open bags (BCH, FARTCOIN @3/3) pop vs history.
  - **Legibility:** depth0 dominates (680 vs 4/6); use `Math.sqrt` scale or a min-segment-width so the rare deep bags — the risk story — stay visible. Render `depth_distribution.note` verbatim as a caption.
- **Label "measured from the order ladder"** (NO `recon` tag — directly available, distinct from reconstructed money).
- **Source:** `/api/depth_distribution`. **Availability:** available. **Audit note:** order-derived counts can slightly OVERSTATE stuck-ness vs the authoritative slots table (shim HIGH issue, logged for the shim track); the "measured from order ladder" label is the honest hedge until the shim sources from slots.

### 4. Signal mix — RED (CCI) vs YELLOW (RSI)
- **New leaf `SignalMix`.** Top: a proportional split bar (or 2-arc donut) RED=CCI/YELLOW=RSI with counts + % (data RED 574 / YELLOW 217), colored **by `signals.legend` verbatim** (RED→CCI, YELLOW→RSI, GREEN→other). **Render only buckets present in `mix`** — no fabricated GREEN bar. Bottom: per-month stacked bar of `signals.over_time` reusing the `MonthlyBars` SVG geometry (segment per reason, colored by legend), labelled **"cycle starts by trigger"** (counts, NOT PnL).
- **Source:** `/api/signals`. **Availability:** available (NO recon tag).

### 5. Open 'stuck bag' positions
- **New leaf `StuckBagCard`** (NOT a PositionCard variant — its ladder/stop/mark structurally invite fabrication). Reuses `tov-pos-card`/`tov-pos-row` shell. One card per open bag.
- **Header:** symbol + `LONG` chip + `depth N/3` chip (severity-colored). Body rows (honest subset, all available): **Averaged entry** = `averaged_entry` when `averaged_entry_available`, else dim "unavailable" (NEVER 0/blank — MARKET fills have price=0); **Stage** = `stage`; **Trigger** = `reason`; **Held** = `fmtHold(age_hours)`. Optional "depth pips" row of N filled dots out of 3.
- **HARD-HIDE:** Mark row (`mark_unavailable:true`), Unrealised row, Stop row (no stop-loss — OMIT entirely, NOT 'Stop: none'), Take-profit price ladder, the `PriceLadder` SVG.
- Render `positions.mark_note` once as a `tov-mute-xs` caption.
- **Empty:** "No open positions — all cycles closed at TP."
- **Source:** `/api/positions`. **Availability:** card fields `available`; mark/uPnL `unavailable`.

### 6. Per-symbol contribution
- **Reuse `SymbolContribution`** (symbol-bars.tsx) via an additive `columns: 'dca'` prop (default `'tortila'`, so the Tortila call site is byte-stable). The bars feed off `net_pnl` with ZERO geometry change. DCA columns: Symbol, Cycles (`cycles`), Net (`net_pnl`, `recon` tag), Avg depth (`avg_depth`, amber when >1.5), Contrib% (`contribution_pct`). DROP WR/PF/Avg-hold (no honest source). Loader adapts the shim row to the structural shape the component reads.
- **Card title:** `Symbol contribution · reconstructed net PnL per symbol`.
- **Source:** `/api/symbol_breakdown`. **Availability:** money cols `reconstructed`; cycles/avg_depth `available`.

### 7. Activity feed — cycle opens / TP closes
- **Reuse `ActivityFeed` VERBATIM** via a loader-side kind mapper. The component's `kind` union is `decision | safety | trade`. Map shim `kind`: **`open` → `decision`** (left-border accent, no amount), **`close` → `trade`** (carries `net_pnl`, signed-colored). `label` (e.g. "TP +0.45%", "avg #2"), `detail = `depth ${depth}/3${reason ? ' · '+reason : ''}``. `net_pnl` ONLY on close rows.
- **Card title:** `Activity · cycle opens + take-profits (newest first)`. Caption: "Close amounts are reconstructed cycle PnL."
- **Empty:** ActivityFeed already renders "No recent activity recorded."
- **Source:** `/api/activity?limit=80`. **Availability:** events `available`; `net_pnl` on close `reconstructed`. Also drives derived `todayPnl` (sum of close `net_pnl` within the UTC day; mirrors Tortila page.tsx) shown in the hero sub-line.

### 8. Costs & tracking footer
- **Reuse the `tov-costs` 4-cell band.** Cells (DCA-relabelled): **Fees paid** = `-fees_total` (`recon`); **Gross PnL** = `realized_pnl_gross` (`recon`); **Net PnL** = `realized_pnl_net` (`recon`); **Tracked since** = `equity.ts[0]` slice(0,10). **NO Funding cell** (`hasFunding:false` — a 0 would fabricate). Fifth caption line: `TP +{tp_pct}% · fee {fee_rate}/leg · 2 accounts aggregated`.
- **Footer hint (`tov-mute-xs`):** "Read-only reconstructed monitoring · legacy journal at {payload.baseUrl} · assembled {fmtShortTs(assembledAt)} UTC · reconstructed figures are not exchange-confirmed PnL."
- **Source:** `/api/summary` + `/api/equity.ts[0]`. **Availability:** reconstructed.

---

## 3. What is HIDDEN vs Tortila (and why) — the auditable contract

| Tortila section / datum | Hidden via cap | Why |
|---|---|---|
| Hero `wallet equity` big number + `% since start` + `init <n>` | `equityIsWallet:false` | shim equity is RELATIVE cumulative reconstructed PnL (baseline 0, absolute:false), not a balance; no capital denominator for a %. Replaced by "Reconstructed net PnL". |
| Hero 6 KPIs Sharpe/Sortino/PF/MaxDD/TimeInMkt/Expect | `hasRiskRatios:false` | no per-cycle PnL series of needed fidelity; reconstructed cycles ≈ +0.45% so ratios are meaningless. Replaced by DCA six. |
| PerformanceOverview "Trade stats" (Win rate / Wins-Losses / PF / streaks) | `hasWinLossStats:false` | `tp_completion_rate` ~100% by construction (fixed TP, no stop-loss) — the single most MISLEADING vanity number. Replaced by depth distribution. `tp_completion_rate_pct` fetched but never rendered. |
| RiskPanel (Sharpe/Sortino/Calmar/Recovery/MaxDD/CurrentDD/DDdur/Vol) | `hasRiskRatios:false` | same fidelity problem. Reconstructed drawdown lives inside the EquityPanel strip; the "how stuck" depth section is the meaningful risk shape. |
| Position-card Mark + Unrealised rows | `hasLiveMark:false` | `mark_unavailable:true`, no live mark pull in v1. Render `mark_note`. |
| Position-card Stop row + PriceLadder SVG | `hasStopLoss:false` | bot has NO stop-loss; 'Stop: none' (red) wrongly implies a missing safety control. OMIT entirely. |
| P&L distribution histogram (DistributionChart) | `hasPnlDistribution:false` | reconstructed per-cycle PnL ≈ uniform +0.45% → a single spike misleads about dispersion. Averaging-DEPTH distribution is the honest "spread of risk". |
| Daily P&L calendar heatmap (CalendarHeatmap) | `hasCalendarHeatmap:false` | reconstructed daily PnL dominated by cycle COUNT not edge → red/green intensity implies a per-day signal that isn't there. |
| Monthly returns bars (signed PnL) | `hasMonthlyPnl:false` | same uniformity. NOTE: the MonthlyBars SVG *primitive* IS reused for the signal-mix over_time stacked COUNT strip (meaningful). |
| Trade history table (TradeHistory island + `/api/trades/list`) | `hasTradeHistory:false` | shim has no paged closed-trade endpoint. The activity feed is the honest substitute. `BOT_CAPS.legacy_bot.hasTradeHistory` already false. |
| Costs "Funding (net)" cell | `hasFunding:false` | shim reports no funding; a 0 would fabricate. |

The loader **must NOT call** `/api/metrics/advanced`, `/api/monthly`, `/api/calendar`, `/api/distribution`, `/api/marks`, `/api/trades/list` (Tortila-only; absent on the shim) and the `LegacyOverviewPayload` **omits those slices entirely** (do not stub them with error envelopes for intentionally-absent sections).

---

## 4. Data layer + the `// PLUG DATA SOURCE HERE` seam

### New files
- `packages/bot-adapters/src/legacy/legacy.shim.schemas.ts` — Zod for the 8 shim endpoints, permissive on nullables (mirror `tortila.extended.schemas.ts`). EXPORTS legacy TS types (`LegacySummary`, `LegacyPositions`, `LegacySymbolBreakdown`, `LegacySignals`, `LegacyActivity`, `LegacyEquity`, `LegacyDepthDistribution`, `LegacyHealth`). Capture shape diffs: `reconstructed:true`, `side` literal `'LONG'`, `averaging_depth`, `averaged_entry` nullable + `averaged_entry_available`, `mark_unavailable`, `legend`/`mix`/`over_time`, `baseline:0`/`absolute:false`, `dd_ts`/`dd_pct` SEPARATE arrays. Metadata-only; does NOT touch factory.ts/legacy-blocked.ts.
- `packages/bot-adapters/src/legacy/legacy-journal-reader.ts` — `createLegacyJournalReader(baseUrl, token, timeoutMs=4000)` mirroring `createTortilaJournalReader`: 8 read-only GET methods, each `T | { error }` (NEVER throws/fabricates), `Authorization: Bearer`, 4s timeout. Export `isLegacyJournalError`. **Header comment: SAFE read-only shim path, explicitly NOT `createLegacyBlockedAdapter`; never touches `/api_management`, never unblocks control.**
- `apps/web/src/features/bots/legacy-overview-data.ts` — `loadLegacyOverviewPayload()` + `loadLegacyLiveOverview()` (status `live|empty|not-configured|error`), mirroring `tortila-overview-data.ts`. Holds the `// PLUG DATA SOURCE HERE` seam + ALL shim→shared-shape mapping + reconstructed labelling. Token never leaves the module.
- `apps/web/src/features/bots/legacy-overview/index.tsx` (+ `depth-gauge.tsx`, `signal-mix.tsx`, `stuck-bag-card.tsx`).
- `apps/web/src/app/api/bots/legacy/overview/route.ts` — session + `botAccessForUser(user,'legacy_bot')`-gated proxy mirroring the Tortila route; 401/403/200; `cache-control: no-store`.

### Payload shape
```ts
export interface LegacyOverviewSlice<T> { data: T | null; error: string | null; }
export interface LegacyOverviewPayload {
  configured: boolean; baseUrl: string; assembledAt: string;
  adapterMode: 'mock' | 'read-only' | 'audited';
  reconstructed: boolean;            // from /api/health
  mode: 'live' | 'unknown';          // 'LIVE' → 'live'
  reconMethod: string | null;        // from /api/summary.method
  markNote: string | null;           // from /api/positions.mark_note
  summary:          LegacyOverviewSlice<LegacySummary>;
  positions:        LegacyOverviewSlice<LegacyPositions>;
  symbolBreakdown:  LegacyOverviewSlice<LegacySymbolBreakdown>;
  signals:          LegacyOverviewSlice<LegacySignals>;
  activity:         LegacyOverviewSlice<LegacyActivity>;
  equity:           LegacyOverviewSlice<LegacyEquity>;
  depthDistribution: LegacyOverviewSlice<LegacyDepthDistribution>;
  // DELIBERATELY NO advanced/monthly/calendar/distribution/marks slices.
}
export type LegacyLiveStatus = 'live' | 'empty' | 'not-configured' | 'error';
export interface LegacyLiveOverview {
  status: LegacyLiveStatus; statusDetail: string | null;
  mode: 'live' | 'unknown'; reconstructed: boolean;
  baseUrl: string; adapterMode: 'mock' | 'read-only' | 'audited';
  payload: LegacyOverviewPayload;
  avgDepth: number | null; netPerCycle: number | null; sinceIso: string | null;
  openBags: number; worstOpenDepth: number | null; todayPnl: number;
  // NO Canonical metrics/positions/trades/equityCurve — there is no canonical adapter read for legacy.
}
```

### Endpoint → component mapping
| Shim endpoint | Payload slice / derived | Component target | Availability |
|---|---|---|---|
| `GET /api/health` | top-level `reconstructed` + `mode` | reconstruction banner + hero chips + status probe | available |
| `GET /api/summary` | `summary` + derived `avgDepth`/`netPerCycle` | DcaHero KPIs + Costs + banner method. `tp_completion_rate_pct` read but NOT rendered | summary `available`; money `reconstructed` |
| `GET /api/equity` | `equity` | EquityPanel (`initialEquity=0`, 'cumulative PnL' title) + hero Sparkline + 'Tracked since' | reconstructed |
| `GET /api/depth_distribution` | `depthDistribution` | DepthGauge ('how stuck') + hero avg-depth | available (order-derived; see audit) |
| `GET /api/signals` | `signals` | SignalMix (RED/YELLOW split + over_time stacked) | available |
| `GET /api/positions` | `positions` + `markNote` | StuckBagCard grid | card fields `available`; mark/uPnL `unavailable` |
| `GET /api/symbol_breakdown` | `symbolBreakdown` | SymbolContribution (columns='dca') | money `reconstructed`; cycles/depth `available` |
| `GET /api/activity?limit=80` | `activity` + derived `todayPnl` | ActivityFeed (open→decision / close→trade mapper) | events `available`; `net_pnl` `reconstructed` |

### Seam rules (mirror `loadTortilaLiveOverview`)
- Widen `botAdapterOptions()` in `lib/server-config.ts`: `legacyJournalUrl = process.env.LEGACY_JOURNAL_URL`, `legacyReadToken = process.env.LEGACY_JOURNAL_TOKEN` (NEW keys; do NOT overload `LEGACY_BOT_BASE_URL` (old blocked-control var) nor `JOURNAL_READ_TOKEN`). Widen `AdapterOptions` in `factory.ts` with `legacyJournalUrl?`/`legacyReadToken?`.
- `configured = opts.mode !== 'mock' && Boolean(legacyJournalUrl) && Boolean(legacyReadToken)`. Else `status:'not-configured'` with a named-env reason.
- Inside `loadLegacyOverviewPayload()`: `createLegacyJournalReader(...)` + `Promise.all` the 8 GETs + a `wrap()` helper (one failing slice never blocks others).
- **Honest-empty guard:** shim responds but `closed_cycles===0 && positions.rows.length===0 && equity.ts.length===0` → `status:'empty'` (banner + EmptyState, NEVER zeros).
- **Reconstructed-vs-live enforced at the seam:** every money figure tagged reconstructed so components render labels without per-component logic.
- This read path is independent of `getBotAdapter()`/`createLegacyBlockedAdapter` — never calls the blocked control adapter.

---

## 5. Page wiring (statistics/page.tsx)
- Extend/reuse `liveHealthChip(status)` for the 4 legacy statuses (live→`{ok,'Live'}`, empty→`{warn,'No data'}`, not-configured→`{neutral,'Setup needed'}`, error→`{bad,'Unreachable'}`).
- Replace the placeholder `LegacyPanel` body (lines 103-117): `const live = await loadLegacyLiveOverview();` then ONE mode chip (`RECONSTRUCTED · LIVE` or `mode n/a`) + ONE health chip; on `status==='live'` render `<LegacyOverview overview={live} caps={LEGACY_DCA_CAPS}/>`; else the same `RiskWarningBanner + EmptyState` honest-unavailable treatment as TortilaPanel (no fabricated $0). The `active.code==='legacy_bot'` branch at line 164-165 already routes here. Keep `export const dynamic = 'force-dynamic'`.

---

## 6. Premium visual rules
Identical to STATS_SPEC §4: Inter UI, JetBrains Mono `tabular-nums` for every number, `--gold2` uppercase letter-spaced section headers, `--green`/`--red`/`--info` signed values, `<Card>` chrome, inline-SVG charts, 30s `AutoRefresh`. Reuse the `tov-*` namespace verbatim; only ADD a tiny `tov-recon-tag`/`tov-depth-seg`/`tov-pips` block in globals.css if needed (additive — never restyle existing `tov-*`; sequence LAST, after the Tortila redesign already merged at d0e205f so this is safe). **At most ONE mode chip + ONE health chip. "reconstructed" labels everywhere money appears. No live-control buttons. The legacy control block stays intact.**

---

## 7. Top risks (carry into the build)
1. **Mislabelling reconstructed relative-PnL equity as wallet equity.** `equityIsWallet:false`, `initialEquity=0`, hero "Reconstructed net PnL", standing banner. A reviewer 'fixing' the hero to an account balance or a fake since-start % is the #1 regression.
2. **Win-rate vanity trap.** `tp_completion_rate_pct` fetched, NEVER rendered; `hasWinLossStats:false`.
3. **Leaking a Tortila vanity section** by reusing TortilaOverview with a flag — avoided by the separate LegacyOverview wrapper + this explicit hidden-list as an auditable contract.
4. **Shim not yet deployed** → every slice `{error}`; page must show the honest not-configured/empty/error state. Verify the 4-status chip path before relying on live data.
5. **`averaged_entry` null (MARKET price=0)** → render "unavailable", not 0/blank.
6. **Open-position stop/mark** must be structurally omitted (StuckBagCard), not 'graceful unavailable' on PositionCard (the ladder still draws an empty spine and invites a future fake mark).
7. **Reconstruction accuracy unaudited / order-derived depth may overstate stuck-ness** (shim HIGH issues) — covered for v1 by the standing reconstruction banner + 'measured from order ladder' vs 'reconstructed' split labels; the shim fixes are a separate track (see open questions). Reconstructed PnL is biased LOW (conservative) so it never overstates.
8. **Multi-tenant aggregation:** the shim blends 2 users/2 BingX keys by default; the 'Accounts 2/2 (aggregated)' KPI + tip is the disclosure. Per-user isolation is a shim/proxy concern (open question), not a UI fix.