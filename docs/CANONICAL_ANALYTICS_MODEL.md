# Canonical Analytics Model

Owner: ecosystem-bot-integration-auditor
Status: Phase 0 — normalization spec. Mock data shapes must match exactly.
Last updated: 2026-05-29

Related: [BOT_INTEGRATION_PLAN.md](./BOT_INTEGRATION_PLAN.md),
[DATA_MODEL.md](./DATA_MODEL.md),
[CONTRACTS/tortila-adapter.md](./CONTRACTS/tortila-adapter.md),
[CONTRACTS/legacy-bot-adapter.md](./CONTRACTS/legacy-bot-adapter.md)

---

## Purpose

This document defines the **single normalized metric set** shared across both bots
(Tortila and Legacy). Every metric has an exact definition, a data availability note
per bot, and a rendering rule. No metric may be displayed with a misleading label,
a zero-equity placeholder, or without its source being clear to the user.

Charts and metric cards must follow the anti-misleading rules in §"Display Rules".

---

## Normalized Metric Definitions

All monetary values are USDT unless stated otherwise.
All percentage values are in percent (e.g., `12.5` means 12.5%, not 0.125).

### Core Balance Metrics

| Metric | Field Name | Definition | Tortila Source | Legacy Source |
|---|---|---|---|---|
| **Wallet Equity** | `walletEquity` | The current total wallet balance on the exchange, as reported by the exchange or derived from the last equity snapshot. This is NOT the same as margin used or open PnL — it is the balance available to the account. | `/api/summary.last_equity` or `live_equity` state key from SQLite | `api_key.balance` field (updated by bot) |
| **First Equity** | `firstEquity` | The first non-zero equity snapshot recorded. Used as the baseline for ROI calculations. Zero-equity entries are dropped (see Display Rules). | `/api/summary.first_equity` | Not available — null |
| **Unrealized PnL** | `unrealizedPnl` | The sum of mark-price-based profit/loss for all currently open positions. Calculated as `sum((mark_price - avg_entry) * qty * direction)` for each open position. This is SEPARATE from wallet equity — it represents what would be realized if all positions were closed at current mark prices. | Derived from `/api/marks` + open position `avg_entry` | Not available (no mark price feed) — null |
| **Closed PnL (Gross)** | `closedPnl` | Sum of `realized_pnl` for all closed trades. This is the **gross** PnL before subtracting trading fees and before adding/subtracting funding payments. Exchange calculates this as `(exit_price - avg_entry) * qty * direction`. | `/api/summary.net_pnl` (note: Tortila's "net_pnl" field is gross+funding; see below) | Not available — null |
| **Fees Total** | `feesTotal` | Sum of all trading fees paid across closed trades. Stored as a **negative number** in the Tortila DB (it is a cost). The WTC UI displays the absolute value with a "paid" label. | `/api/summary.fees_total` | Not available — null |
| **Funding Total** | `fundingTotal` | Net sum of all perpetual futures funding payments. Positive = received, negative = paid. Funding is charged/received every 8 hours while a position is open on BingX. | `/api/summary.funding_total` | Not available — null |
| **Net PnL (with fees and funding)** | `netPnlWithFees` | `closedPnl + feesTotal + fundingTotal`. This is the true economic P&L after all costs. Tortila calls this `net_pnl_with_fees` in the summary API. | `/api/summary.net_pnl_with_fees` | Not available — null |

**Tortila naming note:** Tortila's `net_pnl` field in `/api/summary` = `sum(realized_pnl + funding_pnl)`.
Tortila's `net_pnl_with_fees` = `sum(realized_pnl + funding_pnl + fees_pnl)`.
WTC must use `net_pnl_with_fees` for the true net figure, NOT `net_pnl`.

---

### Return Metrics

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **ROI on Margin / Equity** | `roiPct` | `(walletEquity / firstEquity - 1) * 100`. Measures return relative to the initial funded capital. Only meaningful when `firstEquity > 0`. Requires explicit labeling: "Return since [start date]". | Derivable from summary | Not available |
| **PnL % Since Start** | `pnlPctSinceStart` | Same as roiPct. Explicit alias used by Tortila journal. | `/api/summary.pnl_pct_since_start` | Not available |
| **Period Returns** | `periodReturns.*` | Return over standard windows: today, 7D, 30D, 90D, YTD, all-time. Computed by comparing current equity to the equity at the start of each window. Missing data returns null — not zero. | `/api/metrics/advanced.performance.period_returns` | Not available |
| **CAGR** | `cagrPct` | Compound Annual Growth Rate: `(last_equity / first_equity)^(1/years) - 1`. Null if history < 7 days. | `/api/metrics/advanced.performance.cagr_pct` | Not available |

---

### Drawdown Metrics

Drawdown is always measured as **percent of peak equity**, not as an absolute dollar amount.
Both current and maximum drawdown must always be displayed together — showing only one
is misleading (max DD alone makes a recovering account look worse; current DD alone hides historical risk).

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **Max Drawdown from Peak** | `maxDrawdownPct` | The largest percentage decline from any historical peak to the subsequent trough. `max((peak - trough) / peak * 100)` across all time. This is the worst observed capital loss. | `/api/summary.max_dd_pct` | Not available |
| **Current Drawdown** | `currentDrawdownPct` | The percentage decline from the current running peak to the most recent equity point. `(running_peak - current_equity) / running_peak * 100`. Zero when at all-time high. | `/api/summary.current_dd_pct` | Not available |
| **Max DD Start / Trough / Recovery** | `ddStats.maxDdStart`, `.maxDdTrough`, `.maxDdRecovered` | Timestamps of the worst drawdown episode's peak, lowest point, and recovery (null if not yet recovered). | `/api/metrics/advanced.drawdown` | Not available |
| **Max DD Duration** | `ddStats.maxDdDurationDays` | Number of days from max DD peak to recovery. If not recovered, measured to latest data point. | `/api/metrics/advanced.drawdown.max_dd_duration_days` | Not available |
| **Longest Underwater** | `ddStats.longestUnderwaterDays` | Longest continuous period below any previous peak. | `/api/metrics/advanced.drawdown.longest_underwater_days` | Not available |
| **Average DD** | `ddStats.avgDdPct` | Average maximum depth across all distinct drawdown episodes. | `/api/metrics/advanced.drawdown.avg_dd_pct` | Not available |

---

### Trade Quality Metrics

Win rate and profit factor together define whether a system is profitable in expectation.
Both must be shown together — win rate alone is meaningless without average win/loss sizes.

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **Win Rate** | `winRate` | `wins / total_closed_trades * 100`. A "win" is a trade with `net_pnl > 0` (after fees and funding). Not gross PnL. | `/api/summary.win_rate_pct` | Not available |
| **Profit Factor** | `profitFactor` | `gross_profit / gross_loss` where gross_profit = sum of positive net PnLs, gross_loss = abs(sum of negative net PnLs). Values > 1.0 are profitable. Null if no losing trades (not infinity). | `/api/metrics/advanced.trades.profit_factor` | Not available |
| **Expectancy** | `expectancy` | `(winRate/100 * avgWin) + ((1 - winRate/100) * avgLoss)`. Average expected net PnL per trade in USDT. | `/api/metrics/advanced.trades.expectancy` | Not available |
| **Average Win** | `avgWin` | Mean net PnL of winning trades (USDT). | `/api/metrics/advanced.trades.avg_win` | Not available |
| **Average Loss** | `avgLoss` | Mean net PnL of losing trades (USDT, negative). | `/api/metrics/advanced.trades.avg_loss` | Not available |
| **Total Trades** | `totalTrades` | Count of all closed trades imported. | `/api/summary.trades_total` | Not available |
| **Best / Worst Trade** | `bestTrade`, `worstTrade` | Single best and worst trade by net PnL (USDT). | `/api/summary.best_trade`, `.worst_trade` | Not available |

---

### Risk-Adjusted Return Metrics

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **Sharpe Ratio** | `sharpe` | Annualized Sharpe: `mean(daily_returns) / stdev(daily_returns) * sqrt(365)`. Uses equity resampled to daily UTC closes. Risk-free rate = 0 (common for crypto). Null if < 2 days of equity history. | `/api/metrics/advanced.performance.sharpe` | Not available |
| **Sortino Ratio** | `sortino` | Annualized Sortino: same as Sharpe but denominator uses downside deviation only (negative returns). Less penalized for upside volatility. | `/api/metrics/advanced.performance.sortino` | Not available |
| **Calmar Ratio** | `calmar` | `CAGR% / max_drawdown%`. Reward-to-worst-drawdown ratio. Higher = better risk-adjusted return. | `/api/metrics/advanced.performance.calmar` | Not available |
| **Recovery Factor** | `recoveryFactor` | `total_return% / max_dd%`. How many times the system has recovered its worst drawdown. | `/api/metrics/advanced.performance.recovery_factor` | Not available |

---

### Open Risk Metric

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **Open Risk (USDT)** | `openRiskUsdt` | Estimated maximum loss from open positions if all stop-losses are hit at their current prices. `sum(abs(avg_entry - stop_price) * total_qty)` for each open position. Null if any position has no stop price. | Derived from position snapshots | Not available |

This is an approximation — real slippage may differ. Label accordingly: "Open risk (estimate, assuming stops fill at trigger)".

---

### Operational Metrics

| Metric | Field Name | Definition | Tortila | Legacy |
|---|---|---|---|---|
| **Uptime** | `uptimeSec` | Seconds the bot has been running. Null if not determinable from available data. | Not directly in journal API; derive from `integration_health_checks` first-seen timestamp | Not available |
| **Mode** | `mode` | `"demo"` or `"live"`. Mode affects display (live mode shows a prominent badge). | `/api/summary.mode` | Derive from api_key.market enum |
| **Open Positions** | `openPositionCount` | Number of currently open positions. | `/api/summary.open_positions` | Count of active slots |
| **Last Reconcile** | `lastReconcileAt` | Timestamp of last exchange reconciliation. Shows data freshness. | Derived from safety events or state KV | Not available |
| **Last Exchange Sync** | `lastHealthCheckAt` | Timestamp of last successful adapter health check. | `integration_health_checks.checked_at` | Same |

---

## Fees and Funding: Display Rules

- Display `feesTotal` as a **positive** value with label "Trading fees paid: USDT X.XX"
  (even though stored as negative in DB).
- Display `fundingTotal` with sign: "Funding received: +USDT X.XX" or "Funding paid: -USDT X.XX".
- Never combine fees and funding into one unlabeled number.
- Show the breakdown: gross PnL → fees → funding → net PnL as a waterfall or table.

---

## Display Rules: Anti-Misleading Chart Requirements

These rules are non-negotiable. Violations in the UI must be treated as bugs.

### 1. Drop Zero-Equity Placeholders

**Rule:** Never render a data point where equity = 0 on a chart.

**Reason:** The Tortila journal initializes equity snapshots at 0 before the first deposit.
These zeros make the equity chart show a catastrophic drop from zero at the start.
The `_valid_equity_rows()` function in the Tortila journal already filters these — WTC
must apply the same filter on any equity data it imports or displays.

**Implementation:** The `normalizer.ts` must filter equity series to `equity > 0` before
storing in `bot_metric_snapshots`. Chart components must treat any equity point where
`equity <= 0` as absent, not as a data point.

### 2. Label Every Metric

**Rule:** Every number shown to the user must have a label that includes:
- The metric name (e.g., "Max Drawdown")
- The unit (e.g., "%" or "USDT")
- The time window if applicable (e.g., "since [start date]" or "last 30 days")
- An asterisk and footnote if the value is estimated or approximated

**Reason:** PnL% without a reference period is meaningless. Drawdown% without specifying
peak-based or equity-based measurement is misleading.

### 3. Null vs. Zero

**Rule:** If a metric is unavailable (not supported by the bot, or no data yet), display
"N/A" or "—", not 0.00. Zero implies no profit/loss/risk. Null implies no data.

**Reason:** Legacy bot has no trade history — showing win rate as 0% would imply the bot
has never won. "N/A — trade history not available for Legacy Bot" is correct.

### 4. Distinguish Closed from Unrealized PnL

**Rule:** Closed PnL and unrealized PnL must never be shown as a single combined number
without clear labeling of what is included.

**Reason:** Combining closed (realized, certain) and unrealized (mark-price estimate,
can reverse) PnL in one chart or card is a common source of user confusion and can
overstate actual performance.

**Required display format:** Two separate cards or rows:
- "Closed PnL (realized, USDT): X.XX" — sourced from closed trades only.
- "Unrealized PnL (mark-price estimate, USDT): X.XX" — sourced from open positions.
- "Net PnL (with fees & funding): X.XX" — clearly the bottom-line number after all costs.

### 5. Show Win Rate and Profit Factor Together

**Rule:** Never display win rate without profit factor, or profit factor without win rate,
on the same screen. Show average win and average loss alongside.

**Reason:** A 70% win rate with a profit factor of 0.5 means the system loses money.
A 30% win rate with a profit factor of 3.0 means the system is highly profitable.
Either metric alone is misleading.

### 6. Mark "Demo" Mode Data Explicitly

**Rule:** All metric cards, charts, and trade tables must display a "DEMO" badge when
the underlying data comes from a demo account. Demo performance does not guarantee
or predict live performance — this disclaimer must appear near any demo chart.

### 7. Stale Data

**Rule:** If the most recent `integration_health_checks.checked_at` for a bot instance
is older than 10 minutes, all metric cards and charts for that bot must display
a "Data may be delayed — last updated N minutes ago" banner. Do not hide stale data
behind fresh-looking cards.

### 8. No Fabricated Backtest Results

**Rule:** Backtest results must come from the actual Tortila backtester engine.
No pre-filled "example" backtest results in production. Mock data is permitted only
in development with a prominent "MOCK DATA" overlay.

---

## Metric Availability Matrix

| Metric | Tortila | Legacy Bot | Notes |
|---|---|---|---|
| Wallet equity | Yes | Partial (balance field only) | Legacy balance may lag |
| First equity | Yes | No | Not tracked in legacy |
| Unrealized PnL | Partial (requires mark prices) | No | Mark prices cached 30s |
| Closed PnL (gross) | Yes | No | No trade history in legacy |
| Fees total | Yes | No | |
| Funding total | Yes | No | Legacy bot doesn't track funding |
| Net PnL with fees | Yes | No | |
| ROI % | Yes | No | |
| Max drawdown % | Yes | No | |
| Current drawdown % | Yes | No | |
| Win rate | Yes | No | |
| Profit factor | Yes | No | |
| Expectancy | Yes | No | |
| Sharpe | Yes | No | Requires equity history |
| Sortino | Yes | No | |
| Calmar | Yes | No | |
| Open positions | Yes | Partial (active slots) | Slot ≠ real exchange position |
| Open risk USDT | Partial (requires stops) | No | Not all positions have stops tracked |
| Uptime | Indirect | Indirect | |

Cells marked "No" must display "N/A" in the UI, never 0 or blank.

---

## Cross-Bot Unified View Rules

The `/app` overview page shows a **combined** summary across both bots.

Rules for combination:
- **Wallet equity (combined):** `sum(walletEquity)` where not null. Show per-bot breakdown.
  Do not add a legacy bot's balance to Tortila's equity without noting they are on
  separate exchange accounts.
- **Net PnL (combined):** `sum(netPnlWithFees)` for bots where this is available.
  Legacy bot contributes null — show combined as "Tortila only" if Legacy is null.
- **Open positions (combined):** Simple count sum across bots.
- **Win rate / profit factor (combined):** Do NOT aggregate win rate or PF across bots by
  averaging. If combining, recompute from the merged trade list. If that's not feasible,
  show per-bot metrics side by side, not a combined figure.

The combined view must make clear which bot is contributing which data.
A table showing "Tortila | Legacy | Combined" columns is acceptable.

---

## Tortila Product Warnings — First-Class Display

The following warnings are surfaced by the adapter from Tortila's operational data.
They must appear as visible, non-dismissable banners on the Tortila product page.
They are never hidden behind a "healthy" summary card.

### P0: TP Reconciliation / Restore (code: `tp_reconcile_p0`)

**Display:** Error-level amber/red banner at top of Tortila dashboard.

> **Warning — P0 Open Item:** Tortila does not currently restore TP orders after a bot
> restart. If the bot restarts while a TP order is active, the TP tracking state is lost.
> This can result in a duplicate TP placement or a missed TP fill. This issue is unresolved
> as of the last audit. Trade with caution on live accounts.

This warning is cleared only when the adapter detects an explicit `tp_reconcile_ok`
state signal from the Tortila journal. It is not auto-cleared on a green health check.

### P1: Margin Pre-Flight (code: `margin_preflight_p1`)

**Display:** Warning-level gold banner below P0 if P0 is also showing, or at top if only P1.

> **Warning — P1 Open Item:** Tortila does not perform a margin check before opening new
> positions. On underfunded accounts, entries may be silently rejected by the exchange.
> Monitor available margin manually.

### Error Code Warnings (codes: `101211`, `100410`, `109421`, `exchange_flat_mismatch`)

**Display:** Collapsible warning list below the main metric cards.
Show count of occurrences in the last 24 hours. Expand for detail.

| Code | Display Title | Detail |
|---|---|---|
| `101211` | TP price rejected by BingX | Order price must be higher than current mark. Position may be missing TP protection. Check open positions. |
| `100410` | BingX rate-limit or funding API error | The bot hit BingX's rate limit or the funding endpoint returned an error. Funding data may be incomplete. |
| `109421` | Order not found on exchange | BingX reports an order does not exist during fill-detail lookup. Reconciliation may have missed a fill. |
| `exchange_flat_mismatch` | Exchange-flat mismatch | Exchange reports no open position but bot state shows one open. A reconciliation was triggered. Check safety events for outcome. |

---

## Implementation Notes

### `packages/analytics/src/normalizer.ts`

This module owns the transformation from raw adapter output to WTC-canonical metrics.
It must:
- Apply all null-vs-zero rules (if a value is unavailable, output `null`, not `0`).
- Filter equity points where `equity <= 0`.
- Ensure `netPnlWithFees` is computed as `closedPnl + feesTotal + fundingTotal` (not
  Tortila's `net_pnl` which excludes fees).
- Mark all Legacy bot metrics as null where not available.
- Inject known warning codes from the `BotHealth.warnings[]` array into the metric output.

### `packages/analytics/src/metrics.ts`

Pure functions for cross-bot metric computations:
- `combineEquity(tortila, legacy)` — sum where available.
- `mergedProfitFactor(trades[])` — recompute from merged trade list.
- `isDataStale(checkedAt, thresholdMinutes)` — true if stale.

### Vitest Tests Required

- `normalizer.spec.ts`: Test that zero-equity entries are dropped, null vs zero is correct,
  all Tortila API fields map to the right canonical fields.
- `metrics.spec.ts`: Test combined equity sum, merged profit factor, stale detection.
- `display-rules.spec.ts`: Verify that `null` fields cause "N/A" rendering, not "0".
