# ecosystem-bot-integration-auditor handoff

## Scope

Phase 2 Epoch 20260530-0126. Read-only audit of the bot-adapter package, analytics package,
and bot dashboard pages. Deliver:
(a) Typed read-only dashboard adapter interface — the exact view objects each bot sub-page
    renders so a frontend implementer can build against a stable interface backed by the mock adapter.
(b) `@wtc/analytics` CanonicalMetrics coverage audit — gaps listed as additive function specs
    (logic in `packages/analytics`, not React).
(c) Tortila vs Legacy capability matrix — TP/SL support labels, backtester availability,
    config field sets, exchange-key requirement.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/analytics/src/metrics.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\config.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\__main__.py`

## Files changed

None — read-only audit.

---

## Read-only dashboard adapter interface

### Current state (ground truth)

The interface actually implemented in `packages/bot-adapters/src/types.ts` is:

```typescript
interface BotAdapter {
  productCode: BotProductCode;    // 'tortila_bot' | 'legacy_bot'
  mode: AdapterMode;              // 'mock' | 'real'
  getHealth(): Promise<BotHealth>;
  getConfig(instanceId: string): Promise<BotConfigView>;
  getMetrics(instanceId: string): Promise<CanonicalMetrics>;
  getPositions(instanceId: string): Promise<CanonicalPosition[]>;
  getTrades(instanceId: string): Promise<CanonicalTrade[]>;
  validateConfig(input: unknown): Promise<ValidationResult>;
  // DISABLED — always throws BotControlDisabledError:
  startBot(instanceId: string): Promise<never>;
  stopBot(instanceId: string): Promise<never>;
  applyConfig(instanceId: string, input: unknown): Promise<never>;
}
```

Real adapters (`http.ts`) throw `AdapterNotReadyError` for all data methods except
`getHealth`, which maps `/api/health` for Tortila and probes `/api_management/` for Legacy.
`BOT_ADAPTER_MODE=mock` is the only safe default; `read-only` / `audited` require explicit
opt-in and pre-production gates described in `BOT_CONTROL_SAFETY_MODEL.md`.

The factory (`factory.ts`) selects the adapter: mock by default; `read-only` or `audited`
mode requires both the mode string AND a base URL to be present.

### Per-page typed view objects

The five sub-pages under `/app/bots/[bot]/` are currently placeholder stubs
(`BotSubPagePlaceholder`). The overview (`page.tsx`) is the only fully-rendered page.
The following is the exact typed view each page must consume from the adapter interface —
usable today against the mock adapter.

#### Overview page (`[bot]/page.tsx`) — already rendered

Consumes all five adapter methods in parallel. View object is the union of their returns:

```typescript
interface BotOverviewView {
  health: BotHealth;         // from getHealth()
  metrics: CanonicalMetrics; // from getMetrics()
  positions: CanonicalPosition[]; // from getPositions()
  trades: CanonicalTrade[];  // from getTrades(), filtered .closedAt != null for "recent"
  config: BotConfigView;     // from getConfig()
}
```

`BotHealth` fields consumed on this page:
- `processAlive: boolean` — "process alive / down" label
- `status: 'healthy'|'degraded'|'stale'|'down'` — StatusPill tone
- `warnings: RiskWarning[]` — rendered as `RiskWarningBanner` list; never hidden
- `lastSyncAt: number | null` — for stale-data calculation
- `staleDataSeconds: number | null`

`CanonicalMetrics` fields consumed on this page (8 MetricCards):
- `walletEquity`, `closedPnl`, `unrealizedPnl`, `roiOnMarginPct`
- `winRatePct`, `winCount`, `tradeCount`
- `profitFactor`
- `maxDrawdownPct`
- `openRisk`

`CanonicalPosition` fields rendered in positions table:
- `symbol`, `side`, `qty`, `entryPrice`, `markPrice`, `unrealizedPnl`

`CanonicalTrade` fields rendered in trades table (closed only, limit 8):
- `id`, `symbol`, `side`, `realizedPnl`, `fee`, `closedAt`

#### Positions sub-page (`[bot]/positions/page.tsx`) — stub

Full dedicated positions view. Typed view:

```typescript
interface BotPositionsPageView {
  health: Pick<BotHealth, 'status' | 'warnings' | 'lastSyncAt' | 'staleDataSeconds'>;
  positions: CanonicalPosition[];
  // extended fields needed beyond overview table:
  // CanonicalPosition already has: symbol, side, qty, entryPrice, markPrice,
  //   unrealizedPnl, marginUsed?
  // Tortila-specific extras (in BotConfigView.raw or a future extended position type):
  //   stopPrice, stopDistPct, hasTp, tpPrice, units (pyramid count), system, openedAt
}
```

Note: `CanonicalPosition` (in `packages/analytics/src/metrics.ts`) does NOT include
`stopPrice`, `stopDistPct`, `hasTp`, `tpPrice`, `units`, or `openedAt`.
These are Tortila-specific and are present in the contract's `BotPosition` shape
(in `BOT_INTEGRATION_PLAN.md`) but not in the current `CanonicalPosition`.
This is GAP-1 — see Findings below.

#### Trades sub-page (`[bot]/trades/page.tsx`) — stub

Full closed-trade history with filters. Typed view:

```typescript
interface BotTradesPageView {
  health: Pick<BotHealth, 'status' | 'warnings' | 'lastSyncAt'>;
  trades: CanonicalTrade[];
  // Tortila-specific fields in CanonicalTrade.raw or extended type:
  //   grossPnl (before fees), feesPnl, fundingPnl, holdHours, exitReason, retPct
  // Legacy: empty array with no_trade_history warning already in health.warnings
  totalCount: number;          // for pagination
  filters: {
    symbol?: string;
    side?: 'long' | 'short';
    exitReason?: string;
    page: number;
    pageSize: number;
  };
}
```

Note: `CanonicalTrade` has `realizedPnl`, `fee`, `funding`, `openedAt`, `closedAt` but
does NOT separate `grossPnl` / `feesPnl` / `fundingPnl` explicitly, and lacks
`holdHours`, `exitReason`, or `retPct`. This is GAP-2 — see Findings.

#### Equity sub-page (`[bot]/equity/page.tsx`) — stub

Equity curve + drawdown chart. Typed view:

```typescript
interface BotEquityPageView {
  health: Pick<BotHealth, 'status' | 'warnings' | 'lastSyncAt'>;
  equityCurve: EquityPoint[];   // { t: number, equity: number }[]
  // Derived by computeDrawdown():
  drawdown: DrawdownResult;     // peak, maxDrawdownPct, maxDrawdownAbs, currentDrawdownPct
  // Advanced metrics (Tortila only, null for Legacy):
  advanced: {
    sharpe: number | null;
    sortino: number | null;
    calmar: number | null;
    cagrPct: number | null;
    periodReturns: {
      today_pct: number | null;
      d7_pct: number | null;
      d30_pct: number | null;
      d90_pct: number | null;
    } | null;
  } | null;
  // Chart rendering rules (from CANONICAL_ANALYTICS_MODEL.md):
  // - Filter equityCurve to equity > 0 before rendering
  // - Show DEMO badge when mode = 'demo'
  // - Show stale banner when lastSyncAt > 10 min ago
}
```

Note: `EquityPoint[]` is already exported from `packages/analytics/src/metrics.ts`.
Advanced metrics object is not currently returned by any adapter method — GAP-3.

#### Safety sub-page (`[bot]/safety/page.tsx`) — stub

Safety events log. Typed view:

```typescript
interface BotSafetyPageView {
  health: BotHealth;  // full health including all warnings
  safetyEvents: BotSafetyEvent[];
  // Not currently in any adapter method — GAP-4
}

interface BotSafetyEvent {
  ts: number;           // epoch ms
  kind: 'decision' | 'safety' | 'trade';
  level: 'info' | 'warning' | 'error';
  symbol: string;
  label: string;
  detail: string;
  // for 'trade' kind:
  netPnl?: number;
}
```

Note: The adapter interface has no `getSafetyEvents()` or `getActivity()` method.
The Tortila journal exposes `GET /api/activity` but there is no adapter method for it.
This is GAP-4 — see Findings.

#### Settings sub-page (`[bot]/settings/page.tsx`) — stub

Config wizard. Typed view:

```typescript
interface BotSettingsPageView {
  config: BotConfigView;
  // BotConfigView has: productCode, instanceId, symbols, riskPercent?, leverage?,
  //   maxUnits?, takeProfitPercent?, mode, raw
  validation: ValidationResult | null; // from validateConfig on proposed changes
  // Control methods are DISABLED — UI shows disabled buttons with tooltip
  controlDisabled: true;
  controlDisabledReason: string;
}
```

`BotConfigView.raw` carries bot-specific fields:
- Tortila: `{ system, timeframe, winnerFilter, atrGerchik, trailing, tp_rr, ... }`
- Legacy: `{ rsi: {period, oversold, overbought}, cci: {period, threshold}, averagingLevels, balancePercent, stages }`

The settings page must render these from `raw` with per-bot field sets (see Capability Matrix).
Config writes remain disabled — `validateConfig` is read-only / pre-validation only.

---

## Unified analytics — coverage + gaps

### What CanonicalMetrics currently covers (packages/analytics/src/metrics.ts)

| Metric | Field | Status |
|---|---|---|
| Wallet equity | `walletEquity` | Covered |
| Closed PnL (gross) | `closedPnl` | Covered |
| Unrealized PnL | `unrealizedPnl` | Covered |
| ROI on margin | `roiOnMarginPct` | Covered |
| Trade count | `tradeCount` | Covered |
| Win count / loss count | `winCount`, `lossCount` | Covered |
| Win rate % | `winRatePct` | Covered |
| Gross profit / gross loss | `grossProfit`, `grossLoss` | Covered |
| Profit factor | `profitFactor` | Covered |
| Fees total | `feesTotal` | Covered |
| Funding total | `fundingTotal` | Covered |
| Open risk (margin) | `openRisk` | Covered |
| Open positions | `openPositions` | Covered |
| Peak equity | `peakEquity` | Covered |
| Max drawdown % | `maxDrawdownPct` | Covered |
| Max drawdown abs | `maxDrawdownAbs` | Covered |
| Current drawdown % | `currentDrawdownPct` | Covered |

### What CANONICAL_ANALYTICS_MODEL.md requires that is NOT in CanonicalMetrics

All of the following are additive — they do not change existing fields or break existing callers.
All logic must live in `packages/analytics/src/`, not in React components.

**GAP-A: `netPnlWithFees` (closed PnL net of fees and funding)**

Current: `closedPnl` is gross realized PnL; `feesTotal` and `fundingTotal` exist but
the net figure `closedPnl + feesTotal + fundingTotal` is not a named field.
Tortila's field `net_pnl_with_fees` maps to this. The doc requires it as a named metric
to prevent displaying gross PnL as the bottom line.

Additive spec:
```typescript
// Add to CanonicalMetrics:
netPnlWithFees: number;  // closedPnl + feesTotal + fundingTotal
// Add to computeMetrics():
netPnlWithFees: round2(closedPnl + feesTotal + fundingTotal),
```

**GAP-B: `firstEquity` and `roiPctSinceStart`**

Current: `roiOnMarginPct` is `closedPnl / marginBase * 100`, which uses current open
margin as the base. The canonical model also requires `roiPctSinceStart` =
`(walletEquity / firstEquity - 1) * 100` where `firstEquity` is the first non-zero
equity snapshot. This is the primary long-term return metric.

Additive spec:
```typescript
// Add to CanonicalMetricsInput:
firstEquity?: number | null;  // first non-zero equity snapshot; null = not available

// Add to CanonicalMetrics:
firstEquity: number | null;
roiPctSinceStart: number | null;  // (walletEquity / firstEquity - 1) * 100, null if no firstEquity

// Add to computeMetrics():
const roiPctSinceStart =
  input.firstEquity && input.firstEquity > 0
    ? round2(((input.walletEquity / input.firstEquity) - 1) * 100)
    : null;
```

**GAP-C: `avgWin`, `avgLoss`, `expectancy`**

Current: `grossProfit` and `grossLoss` aggregates exist, but per-trade averages and
expectancy are not computed.

Additive spec:
```typescript
// Add to CanonicalMetrics:
avgWin: number | null;       // mean realizedPnl of winning closed trades; null if none
avgLoss: number | null;      // mean realizedPnl of losing closed trades; null if none
expectancy: number | null;   // (winRatePct/100 * avgWin) + ((1 - winRatePct/100) * avgLoss)
                             // null if winRatePct is null

// Add to computeMetrics():
const avgWin = winCount > 0 ? round2(grossProfit / winCount) : null;
const avgLoss = lossCount > 0 ? round2(-grossLoss / lossCount) : null;
const expectancy =
  winRatePct !== null && avgWin !== null && avgLoss !== null
    ? round2((winRatePct / 100) * avgWin + (1 - winRatePct / 100) * avgLoss)
    : null;
```

**GAP-D: `safetyEventCount` in CanonicalMetrics**

The canonical model requires surfacing safety events as a named metric.
The adapter has no `getSafetyEvents()` method; safety is only in `BotHealth.warnings[]`.
Additive spec (two parts):

Part 1 — add to `CanonicalMetrics`:
```typescript
safetyEventCount: number;  // count of active warning-or-error level events; 0 is valid
```

Part 2 — add `getSafetyEvents()` to `BotAdapter` (adapter interface addition, not analytics):
```typescript
getSafetyEvents(instanceId: string, opts?: { limit?: number }): Promise<BotSafetyEvent[]>;
```
where `BotSafetyEvent` is as specified in the Safety sub-page view above.
The mock adapter returns the `TORTILA_WARNINGS` and `LEGACY_WARNINGS` as synthetic events.
The real Tortila adapter maps from `GET /api/activity` (already documented in the contract).
The real Legacy adapter returns an empty array (no activity API exists).

**GAP-E: Combined / cross-bot aggregation functions**

`CANONICAL_ANALYTICS_MODEL.md` §"Cross-Bot Unified View Rules" requires:
- `combineEquity(a: CanonicalMetrics, b: CanonicalMetrics): CombinedMetrics`
- `mergedProfitFactor(trades: CanonicalTrade[]): number | null`
- `isDataStale(lastSyncAt: number | null, thresholdMs: number): boolean`

None of these are currently in `packages/analytics/src/metrics.ts`.

Additive specs:
```typescript
export interface CombinedMetrics {
  totalWalletEquity: number | null;   // sum where not null
  tortila: CanonicalMetrics | null;
  legacy: CanonicalMetrics | null;
  totalOpenPositions: number;
  netPnlWithFeesTortila: number | null; // Legacy contributes null
  // win rate / PF NOT averaged — show per-bot side by side, never combined
  // (CANONICAL_ANALYTICS_MODEL.md §"Cross-Bot Unified View Rules")
}

export function combineMetrics(
  tortila: CanonicalMetrics | null,
  legacy: CanonicalMetrics | null,
): CombinedMetrics {
  const totalWalletEquity =
    tortila !== null || legacy !== null
      ? (tortila?.walletEquity ?? 0) + (legacy?.walletEquity ?? 0)
      : null;
  return {
    totalWalletEquity,
    tortila,
    legacy,
    totalOpenPositions: (tortila?.openPositions ?? 0) + (legacy?.openPositions ?? 0),
    netPnlWithFeesTortila: tortila?.netPnlWithFees ?? null,
  };
}

export function mergedProfitFactor(trades: CanonicalTrade[]): number | null {
  const closed = trades.filter(t => t.closedAt !== null);
  if (closed.length === 0) return null;
  const grossP = closed.filter(t => t.realizedPnl > 0).reduce((s, t) => s + t.realizedPnl, 0);
  const grossL = closed.filter(t => t.realizedPnl < 0).reduce((s, t) => s + Math.abs(t.realizedPnl), 0);
  if (grossL === 0) return grossP > 0 ? Number.POSITIVE_INFINITY : null;
  return Math.round((grossP / grossL) * 100) / 100;
}

export function isDataStale(lastSyncAt: number | null, thresholdMs = 600_000): boolean {
  if (lastSyncAt === null) return true;
  return Date.now() - lastSyncAt > thresholdMs;
}
```

**GAP-F: Zero-equity filter not enforced in computeMetrics**

`CANONICAL_ANALYTICS_MODEL.md` §"Drop Zero-Equity Placeholders" requires that equity
points where `equity <= 0` are dropped before storage and before chart rendering.
`computeMetrics` currently passes the `equityCurve` directly to `computeDrawdown`
without filtering. This is a correctness gap — a zero-equity row at the start of the
curve produces a false max-drawdown near 100%.

Additive spec (fix, not addition):
```typescript
// In computeMetrics, before calling computeDrawdown:
const filteredCurve = input.equityCurve.filter(p => p.equity > 0);
const dd = computeDrawdown(filteredCurve);
// Also export the filter for use by the worker import pipeline:
export function filterZeroEquity(curve: EquityPoint[]): EquityPoint[] {
  return curve.filter(p => p.equity > 0);
}
```

**GAP-G: CanonicalPosition missing stop/TP/open-time fields**

`CanonicalPosition` in `metrics.ts` has: `symbol`, `side`, `qty`, `entryPrice`,
`markPrice`, `unrealizedPnl`, `marginUsed?`.
The Positions sub-page and the "stop bot = not close positions" warning both require
`stopPrice`, `stopDistPct`, `hasTp`, `tpPrice`, `openedAt`, and Tortila's `units` count.
These are Tortila-specific but the type should carry them as optionals so the positions
page has a single type to render against.

Additive spec:
```typescript
// Extend CanonicalPosition with optional fields:
export interface CanonicalPosition {
  // existing fields unchanged
  symbol: string;
  side: Side;
  qty: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  marginUsed?: number;
  // additive:
  stopPrice?: number | null;
  stopDistPct?: number | null;
  hasTp?: boolean;
  tpPrice?: number | null;
  openedAt?: number | null;    // epoch ms
  units?: number;              // Tortila pyramid unit count
  stage?: number;              // Legacy slot stage
}
```

**GAP-H: CanonicalTrade missing trade-quality fields**

`CanonicalTrade` has: `id`, `symbol`, `side`, `qty`, `realizedPnl`, `fee`, `funding`,
`openedAt`, `closedAt`. The Trades sub-page and the canonical model require
`holdHours`, `exitReason`, and separate `grossPnl` / `feesPnl` / `fundingPnl` for the
waterfall display (`CANONICAL_ANALYTICS_MODEL.md` §"Fees and Funding: Display Rules").

Additive spec:
```typescript
// Extend CanonicalTrade with optional fields:
export interface CanonicalTrade {
  // existing fields unchanged
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  realizedPnl: number;   // gross realized PnL (before fee/funding)
  fee: number;           // trading fee (positive cost)
  funding: number;       // funding payment (positive = received)
  openedAt: number;
  closedAt: number | null;
  // additive:
  holdHours?: number;
  exitReason?: string;   // 'stop' | 'take_profit' | 'exit_signal' | etc.
  retPct?: number;       // percentage return on the trade
}
```

### Analytics gaps summary

| Gap | Description | Location | Priority |
|---|---|---|---|
| GAP-A | `netPnlWithFees` not a named field | `computeMetrics` | P0 — required before any PnL display |
| GAP-B | `firstEquity` + `roiPctSinceStart` missing | `computeMetrics` | P1 — required for ROI chart |
| GAP-C | `avgWin`, `avgLoss`, `expectancy` missing | `computeMetrics` | P1 |
| GAP-D | `getSafetyEvents()` not on `BotAdapter`; `safetyEventCount` missing | `types.ts`, `computeMetrics` | P1 |
| GAP-E | `combineMetrics`, `mergedProfitFactor`, `isDataStale` missing | `metrics.ts` | P1 — required for unified view |
| GAP-F | Zero-equity filter not applied before `computeDrawdown` | `computeMetrics` | P0 — produces false drawdown |
| GAP-G | `CanonicalPosition` missing stop/TP/time fields | `metrics.ts` | P1 — required for positions page |
| GAP-H | `CanonicalTrade` missing hold/exit/waterfall fields | `metrics.ts` | P2 |

All gaps are ADDITIVE. No existing field name or semantic changes. All implementations
belong in `packages/analytics/src/metrics.ts` (types + pure functions) and
`packages/bot-adapters/src/types.ts` (interface addition for `getSafetyEvents`).

---

## Tortila vs Legacy capability matrix

### TP / Stop-Loss support

| Capability | Tortila | Legacy |
|---|---|---|
| Exchange-side stop-loss (stop-market) | Supported — placed per position, verified every N ticks | Supported — `STOP_LOSS` order in `orders` table |
| Take-profit (TP) limit order | Supported — per-symbol `tp_rr` in `PerSymbolConfig`; 0 disables | Supported — `TAKE_PROFIT` order in `orders` table |
| TP reconciliation after restart | NOT SUPPORTED (P0 open issue — `tp_reconcile_p0`) | Not applicable (no restart-state tracking) |
| Trailing stop | Supported — `trailing_tflab` strategy module | Supported — `TRAILING_STOP_MARKET` order type |
| Trailing TP/SL combined | Supported — `TRAILING_TP_SL` order type observed | Supported — `TRAILING_TP_SL` in `LegacyOrderSchema` |
| Margin pre-flight before entry | NOT SUPPORTED (P1 open issue — `margin_preflight_p1`) | Unknown — not documented |
| Stop verification interval | Configurable — `stop_verify_every_n_ticks` | Not verified periodically |
| Force-close on stop placement failure | Supported — `force_close_on_stop_fail` setting | Not documented |

### Backtester availability

| | Tortila | Legacy |
|---|---|---|
| Backtester exists | Yes — Python `backtest/` package in `bot_tortila` repo. Multiple sweep/engine files. | No backtester. |
| WTC backtester page | Available (entitlement-gated) — `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` shows a run-config form for Tortila | Locked — same page shows "Not available. Out of scope at MVP." |
| Fake results shown | Never — page shows `EmptyState` until a real artifact is uploaded | Not applicable |
| Local runner | Planned — "download local runner" button disabled; packaging not done | Not applicable |

Legacy backtester: NEVER synthesize results. The page is already gated to show
"Out of scope at MVP" for Legacy. This must never change to a fake equity curve.

### Config field sets

Fields the settings editor exposes, per bot:

**Tortila config fields** (from `PerSymbolConfig` in `config.py` and `BotConfigView.raw`):

| Field | Type | Constraints | Editor widget |
|---|---|---|---|
| `symbols` | `string[]` | Non-empty | Multi-select or comma list |
| `timeframe` | `string` | Regex `^\d+[mhdw]$` | Select (4h, 1h, 15m, 1d, etc.) |
| `system` | `1 | 2` | Turtle System 1 (20/10) or System 2 (55/20) | Toggle |
| `riskPct` | `number` | 0.001 – 0.05 (0.1% – 5%) | Number input |
| `stopN` | `number` | 0 < x <= 20 | Number input |
| `addStep` | `number` | 0 < x <= 5 | Number input |
| `maxUnits` | `integer` | 1 – 20 | Number input |
| `atrPeriod` | `integer` | 2 – 400 | Number input |
| `tpRr` | `number` | >= 0 (0 = TP disabled) | Number input |
| `useWinnerFilter` | `boolean` | | Checkbox |
| Global: `leverage` | `integer` | 1 – 125 | Number input |
| Global: `haltDdPct` | `number` | 0 – 1.0 | Number input (%) |
| Global: `dailyMaxLossPct` | `number` | 0 – 1.0 | Number input (%) |
| Global: `mode` | `'demo' | 'live'` | Display only — not editable via WTC | Read-only badge |

**Legacy config fields** (from `LegacySymbolSettingsSchema`):

| Field | Type | Constraints | Editor widget |
|---|---|---|---|
| `symbols` | `string[]` | Active settings only | Multi-select |
| `timeframe` | `string` | Known BingX/Binance values | Select |
| `rsiLength` | `integer` | 2 – 200 | Number input |
| `cciLength` | `integer` | 2 – 200 | Number input |
| `rsiThreshold` | `number` | | Number input |
| `cciThreshold` | `number` | | Number input |
| `useRsi` | `boolean` | | Checkbox |
| `useCci` | `boolean` | | Checkbox |
| `takeProfitPercent` | `number` | >= 0 | Number input (%) |
| `averagingLevels` | `integer` | 0 – 10 | Number input |
| `leverage` | `integer` | 1 – 125 | Number input |
| `useBalancePercent` | `number` | 1.0 – 100.0 | Number input (%) |
| Stages: `rsiSlots`, `cciSlots` | `integer` | | Stage config table |

Config writes from WTC are DISABLED until the audited adapter ships. Both bots'
settings pages show the current config as read-only with disabled form controls
and the standard "live control requires audited adapter" tooltip.

### Exchange-key requirement

Both bots connect to BingX (Tortila: ISOLATED margin perps; Legacy: BingX or Binance).
Keys are held on the bot servers themselves — never in WTC.

WTC's role for exchange keys is:
1. For users configuring a new bot instance through WTC in the future: keys are stored
   in the WTC encrypted vault (`exchange_api_key_secrets` table, AES-256-GCM envelope,
   KEK from env). WTC never logs or returns key material. Vault returns success/error only.
2. For existing bot instances (current Phase 0–2): WTC reads from the adapter, which
   reads from the bot's own API. The Tortila adapter needs no key. The Legacy adapter
   uses a WTC service account credential (also vault-stored) to call the legacy bot's
   auth endpoint. The legacy bot itself returns exchange keys in its API response
   (KNOWN SECURITY ISSUE — `legacy_plaintext_keys` warning). The adapter redacts these
   before they leave the adapter layer. This is a hard rule: the `BotConfigView` returned
   by `LegacyBotAdapter` must never include `api_key` or `secret_key`.

Per-bot exchange key flow:
- Tortila: No key needed by WTC. Tortila journal is read-only. Bot holds BingX keys.
- Legacy: WTC holds `legacy_bot_service_account` credential (username/password) in vault.
  Adapter uses this to get a JWT, then calls `/api_management/{api_id}`.
  Exchange keys (`api_key`, `secret_key`) from the legacy API response are redacted
  at the Zod parse step. Never propagated. Remediation (remove keys from legacy API
  response) is tracked as a P0 pre-production requirement in `CONTRACTS/legacy-bot-adapter.md`.

---

## Findings

| # | Severity | Evidence | Recommendation | Target part |
|---|---|---|---|---|
| F-1 | P0 | `computeMetrics` passes `equityCurve` directly to `computeDrawdown` with no zero-equity filter (`metrics.ts:147`). Tortila journal initializes equity at 0 before first deposit, producing false ~100% drawdown. | Add `filterZeroEquity` (GAP-F spec above) before `computeDrawdown` call. | `packages/analytics/src/metrics.ts` |
| F-2 | P0 | `CanonicalMetrics` has no `netPnlWithFees` field. The overview page shows `closedPnl` (gross) as the second MetricCard — this can overstate performance by omitting fees. Display rules in `CANONICAL_ANALYTICS_MODEL.md` require the net figure as a named field. | Add `netPnlWithFees` per GAP-A spec. | `packages/analytics/src/metrics.ts` |
| F-3 | P1 | `BotAdapter` interface has no `getSafetyEvents()` method. The safety sub-page is a placeholder with no path to data. Tortila's `GET /api/activity` exists in the contract but is unroutable through the current adapter interface. | Add `getSafetyEvents()` per GAP-D spec. Add to mock adapters first. | `packages/bot-adapters/src/types.ts`, mock adapters |
| F-4 | P1 | `CanonicalPosition` lacks `stopPrice`, `hasTp`, `openedAt`. The "stop bot ≠ close positions" confirmation dialog (`BOT_CONTROL_SAFETY_MODEL.md` §"Stop Bot is NOT Close Positions") requires showing all open positions with current stop before user confirms a future stop action. Without `stopPrice` in the type, the future confirmation dialog cannot render. | Add optional fields per GAP-G spec. Tortila mock adapter already has the data (in the contract's `BotPosition` shape) — wire to the extended type. | `packages/analytics/src/metrics.ts` |
| F-5 | P1 | `getConfig()` in `http.ts` (real Tortila adapter) throws `AdapterNotReadyError` with message "journal has no /api/config yet". The contract confirms this is a known gap — Tortila journal lacks a JSON config endpoint. The BOT_INTEGRATION_PLAN.md tracks this as a required future change. Until it ships, `getConfig` for the real adapter is unavailable, making the settings sub-page blank on `read-only` mode. | Confirm with Tortila team that `GET /api/config` JSON endpoint is on the roadmap (tracked in `CONTRACTS/tortila-adapter.md` as P1). Do NOT parse HTML `/config` page. Until the endpoint ships, settings page shows "Config not available — pending /api/config endpoint on journal." | `CONTRACTS/tortila-adapter.md` (already tracked), http adapter |
| F-6 | P1 | `combineMetrics`, `mergedProfitFactor`, `isDataStale` are missing from `packages/analytics` (GAP-E). The unified bots overview page (`/app/bots/page.tsx`) currently shows two separate health cards without any combined metric. The product plan requires a combined wallet-equity row. | Add the three functions per GAP-E spec. | `packages/analytics/src/metrics.ts` |
| F-7 | P2 | The `BotHealth.status` returned by the real Tortila `getHealth()` is hardcoded to `'degraded'` (`http.ts:69`) even when the journal returns `ok: true`. This is intentional (P0/P1 warnings force non-healthy status) but the comment documents it clearly. The status will remain `degraded` until `tp_reconcile_p0` is cleared. This is correct behaviour per the safety model — but the implementation must not be silently changed to `'healthy'` without the P0 warning being resolved. | Record as an invariant: `BotHealth.status !== 'healthy'` while `TORTILA_PERSISTENT_WARNINGS` are active. Document in `http.ts` comment and add a test assertion. | `packages/bot-adapters/src/http.ts` |
| F-8 | P2 | The equity sub-page view requires `advanced` metrics (Sharpe, Sortino, Calmar, period returns) but no adapter method returns these. They are in the Tortila journal at `GET /api/metrics/advanced` (documented in the contract) but there is no `getAdvancedMetrics()` on the adapter interface. | Add `getAdvancedMetrics(instanceId: string): Promise<BotAdvancedMetrics | null>` to `BotAdapter` interface. Returns null for Legacy. Mock adapter returns synthetic values. | `packages/bot-adapters/src/types.ts` |

---

## Decisions

- The adapter interface in `types.ts` is ground truth. The more verbose interface in
  `BOT_INTEGRATION_PLAN.md` (which uses `BotAdapter` / `BotMetrics` / `BotPosition` /
  `BotTrade` types separately from `CanonicalMetrics`) is a design document that predates
  the implemented `CanonicalMetrics` approach. The implemented approach (adapters return
  `CanonicalMetrics` / `CanonicalPosition[]` / `CanonicalTrade[]` from `@wtc/analytics`)
  is correct. The doc types serve as a reference for mapping details.

- All analytics gaps (GAP-A through GAP-H) are additive. No existing field semantics change.
  Existing tests and existing callers are unaffected.

- `isDataStale` belongs in `packages/analytics` (pure, no dependencies) not in a React
  component or server action. The 10-minute threshold is the canonical value from
  `CANONICAL_ANALYTICS_MODEL.md` §"Stale Data" and `BOT_CONTROL_SAFETY_MODEL.md`.

- Legacy bot's `walletEquity` = `api_key.balance` is displayed with a "balance may lag"
  annotation. It is NOT zero — it is a real field. But `firstEquity` for Legacy is null
  (not tracked), so `roiPctSinceStart` is null, displayed as "N/A" not "0%".

---

## Risks

- Tortila P0 (`tp_reconcile_p0`) and P1 (`margin_preflight_p1`) remain unresolved and
  MUST appear in every Tortila adapter instance (mock and real). These are surfaced by
  `TORTILA_PERSISTENT_WARNINGS` in `warnings.ts` and injected by both mock and http
  adapters. Any refactor that drops these from `getHealth()` is a regression.

- Legacy bot's plaintext exchange keys in API response (`legacy_plaintext_keys` warning):
  the `getConfig()` and `getMetrics()` real adapters both throw `AdapterNotReadyError`
  and will never inadvertently proxy keys. The plaintext-keys issue must be resolved on
  the legacy bot side before `BOT_ADAPTER_MODE=read-only` is used for Legacy.

- Zero-equity filter (GAP-F / F-1) is a correctness bug for any deployment using the
  Tortila adapter in read-only mode where the equity curve contains the 0-equity init rows.
  Must be fixed before `BOT_ADAPTER_MODE=read-only` is used.

- `getSafetyEvents()` gap (F-3): the safety sub-page is a placeholder. If Part-3
  implements the safety page without first adding this method to the interface, it will
  have to be added later and all three implementations (mock-tortila, mock-legacy,
  http) updated simultaneously. Add the stub now to avoid interface churn.

---

## Verification / tests

No tests were run (read-only audit session). The following tests are required before
any analytics gap patch lands:

- `packages/analytics/src/__tests__/metrics.spec.ts`: add cases for GAP-F (zero equity
  filtered from drawdown), GAP-A (`netPnlWithFees`), GAP-B (`roiPctSinceStart` null when
  no `firstEquity`), GAP-C (`expectancy` null when no closed trades).
- `packages/analytics/src/__tests__/combine.spec.ts`: test `combineMetrics` with both
  bots, one null, both null; test `mergedProfitFactor` with merged trade list;
  test `isDataStale` at exact threshold boundary.
- `packages/bot-adapters/src/__tests__/warnings.test.ts`: assert that no adapter
  (mock or real) emits a warning code not in `CANONICAL_WARNING_CODES` (already
  documented as required; not yet written).

---

## Next actions

These are the minimum-required code changes for Phase 2 / Part 2 bot dashboards.
They are listed in priority order. This auditor owns the docs only — implementation
is delegated to the appropriate implementer agent.

1. Fix GAP-F in `packages/analytics/src/metrics.ts`: add `filterZeroEquity`, apply
   it in `computeMetrics` before `computeDrawdown`. Write the test.

2. Add GAP-A (`netPnlWithFees`) to `CanonicalMetrics` and `computeMetrics`. Write the test.

3. Add `getSafetyEvents()` stub to `BotAdapter` interface and both mock adapters.
   The real adapters throw `AdapterNotReadyError` until endpoint shapes are confirmed.

4. Extend `CanonicalPosition` with optional stop/TP/time fields (GAP-G). Wire in mock
   adapters so the positions sub-page has real data to render.

5. Add `combineMetrics`, `mergedProfitFactor`, `isDataStale` to analytics (GAP-E).

6. Add `getAdvancedMetrics()` stub to interface and mock adapters (F-8 / equity sub-page).

7. Update `BOT_INTEGRATION_PLAN.md` to note that the implemented adapter returns
   `CanonicalMetrics` (not the `BotMetrics` shape described in the doc's code block),
   and add the `getSafetyEvents` + `getAdvancedMetrics` stubs to the interface spec.
