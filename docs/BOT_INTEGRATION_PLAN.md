# Bot Integration Plan

Owner: ecosystem-bot-integration-auditor
Status: Phase 0 — documentation only. No live control. No live writes.
Last updated: 2026-05-29

## Overview

WTC integrates two bots as **read-only product services** through a typed adapter layer.
Neither bot is controlled from WTC until a separate security + exchange audit is completed
and explicitly approved (see [BOT_CONTROL_SAFETY_MODEL.md](./BOT_CONTROL_SAFETY_MODEL.md)).

All data flows from bot runtime → adapter → WTC DB snapshots → WTC UI.
WTC never becomes a control plane for orders, positions, or exchange accounts.

Related: [CANONICAL_ANALYTICS_MODEL.md](./CANONICAL_ANALYTICS_MODEL.md),
[CONTRACTS/tortila-adapter.md](./CONTRACTS/tortila-adapter.md),
[CONTRACTS/legacy-bot-adapter.md](./CONTRACTS/legacy-bot-adapter.md)

---

## BotAdapter Interface

Located at: `packages/bot-adapters/src/adapter.ts`

```typescript
// packages/bot-adapters/src/adapter.ts

import { z } from "zod";

/** Canonical product codes for both bots. */
export type BotProductCode = "tortila_bot" | "legacy_bot";

/** Severity of a known risk signal. */
export type WarningSeverity = "info" | "warning" | "error";

/** Structured warning surfaced to the WTC UI. */
export interface BotWarning {
  code: string;             // machine-readable, e.g. "101211", "tp_reconcile_p0"
  severity: WarningSeverity;
  title: string;            // short human label
  detail: string;           // full description including remediation if known
  surfacedAt: string;       // ISO-8601 timestamp when first observed
}

/** Coarse liveness state of the bot process. */
export type BotProcessState =
  | "healthy"    // process alive, no unresolved P0/P1 issues (currently unreachable for Tortila)
  | "degraded"   // process alive but reporting errors or unresolved P0/P1 warnings
  | "stale"      // adapter cannot reach the journal / health check too old
  | "down";      // confirmed not running or unreachable

// NOTE: The Tortila adapter always returns 'degraded' while P0 (tp_reconcile_p0) and P1
// (margin_preflight_p1) remain unresolved. It can never report 'healthy' until both are cleared.

/** Adapter health bundle. */
export interface BotHealth {
  productCode: BotProductCode;
  processAlive: boolean;           // true if /api/health returned ok:true; false on error/timeout
  status: BotProcessState;         // 'healthy' | 'degraded' | 'stale' | 'down'
  // NOTE: Tortila adapter always returns status:'degraded' while P0/P1 unresolved
  journalReachable: boolean;       // true if /api/health or equivalent returned ok
  mode: "demo" | "live" | "unknown";
  uptime: string | null;           // ISO-8601 duration or null
  lastSeen: string | null;         // ISO-8601 timestamp of last successful contact
  lastSyncAt: number | null;       // epoch-ms of last successful health check
  warnings: BotWarning[];          // active risk signals; never empty array on degraded state
  meta: Record<string, unknown>;   // adapter-specific extra fields
}

/** Config view returned to the WTC dashboard (no secrets). */
export interface BotConfigView {
  productCode: BotProductCode;
  exchange: string;               // e.g. "bingx"
  mode: "demo" | "live";
  symbols: string[];              // list of configured symbols
  perSymbolConfig: PerSymbolConfigEntry[];
  globalSettings: Record<string, string | number | boolean>;
  // Tortila: last_reconcile_ts, halt_dd_pct, daily_max_loss_pct, etc.
  // Legacy: global leverage, balance percent, stage layout
}

export interface PerSymbolConfigEntry {
  symbol: string;
  timeframe?: string;
  system?: number;
  riskPct?: number;
  stopN?: number;
  addStep?: number;
  maxUnits?: number;
  atrPeriod?: number;
  tpRr?: number;
  // Legacy fields
  rsiLength?: number;
  cciLength?: number;
  rsiThreshold?: number;
  cciThreshold?: number;
  takeProfitPercent?: number;
  averagingLevels?: number;
  leverage?: number;
  useBalancePercent?: number;
}

/** Normalized metrics for cross-bot analytics. Full definitions in CANONICAL_ANALYTICS_MODEL.md. */
export interface BotMetrics {
  productCode: BotProductCode;
  snapshotAt: string;              // ISO-8601 when the snapshot was taken
  walletEquity: number | null;     // current wallet balance (USDT)
  firstEquity: number | null;      // first non-zero equity snapshot (baseline)
  closedPnl: number | null;        // sum of realized_pnl for closed trades
  unrealizedPnl: number | null;    // sum of unrealized PnL for open positions (mark - entry)
  netPnlWithFees: number | null;   // closedPnl + funding + fees
  roiPct: number | null;           // (walletEquity / firstEquity - 1) * 100
  maxDrawdownPct: number | null;   // peak-to-trough, percent of peak
  currentDrawdownPct: number | null; // peak-to-current, percent of peak
  winRate: number | null;          // wins / total_closed_trades * 100
  profitFactor: number | null;     // gross_profit / gross_loss (null if no losses)
  totalTrades: number;
  wins: number;
  losses: number;
  openPositionCount: number;
  feesTotal: number | null;
  fundingTotal: number | null;
  openRiskUsdt: number | null;     // sum of (stop distance * qty) for all open positions
  uptimeSec: number | null;
  mode: "demo" | "live" | "unknown";
}

/** Open position (normalized from both bots). */
export interface BotPosition {
  productCode: BotProductCode;
  symbol: string;
  side: "long" | "short" | "LONG" | "SHORT";
  units?: number;                  // Tortila: pyramid units; Legacy: averaging_count
  totalQty: number;
  avgEntryPrice: number;
  currentStopPrice: number | null;
  stopDistPct: number | null;      // abs((stop - entry) / entry) * 100
  hasTp: boolean;
  tpPrice: number | null;
  unrealizedPnl: number | null;    // mark-based; null if no mark price available
  openedAt: string;                // ISO-8601
  system?: number;                 // Tortila system 1/2
  stage?: number;                  // Legacy: current stage slot
}

/** Normalized closed trade. */
export interface BotTrade {
  productCode: BotProductCode;
  id: string | number;
  symbol: string;
  side: "long" | "short" | "LONG" | "SHORT";
  avgEntry: number;
  exitPrice: number;
  qty: number;
  grossPnl: number;              // realized_pnl (before fees/funding)
  feesPnl: number;               // negative cost
  fundingPnl: number;            // can be positive or negative
  netPnl: number;                // grossPnl + feesPnl + fundingPnl
  openedAt: string;
  closedAt: string;
  holdHours: number;
  exitReason: string;            // "stop" | "take_profit" | "exit_signal" | etc.
}

/** Config validation result. */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

// ---------------------------------------------------------------------------
// CORE READ-ONLY ADAPTER INTERFACE (always allowed)
// ---------------------------------------------------------------------------

export interface BotAdapter {
  readonly productCode: BotProductCode;

  /** Liveness check. Must not throw — return degraded/unknown on error. */
  getHealth(): Promise<BotHealth>;

  /** Config view for a user's bot instance. No secrets ever returned. */
  getConfig(botInstanceId: string): Promise<BotConfigView>;

  /** Snapshot of normalized metrics for a bot instance. */
  getMetrics(botInstanceId: string): Promise<BotMetrics>;

  /** Currently open positions. */
  getPositions(botInstanceId: string): Promise<BotPosition[]>;

  /** Closed trade history. */
  getTrades(botInstanceId: string, opts?: {
    symbol?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{ total: number; rows: BotTrade[] }>;

  /** Validate a proposed config before user submits it. No writes. */
  validateConfig(input: unknown): Promise<ValidationResult>;
}

// ---------------------------------------------------------------------------
// FEATURE-FLAGGED CONTROL METHODS — DISABLED UNTIL AUDIT COMPLETE
// ---------------------------------------------------------------------------
// These are declared here so the interface is complete, but they are
// HARD-DISABLED in all real adapters (throw ControlDisabledError).
// The safety gates required before enabling them are documented in
// BOT_CONTROL_SAFETY_MODEL.md.

export class ControlDisabledError extends Error {
  constructor(method: string) {
    super(
      `${method} is disabled until security + exchange audit is complete. ` +
      "See docs/BOT_CONTROL_SAFETY_MODEL.md for required gates."
    );
    this.name = "ControlDisabledError";
  }
}

export interface BotControlAdapter extends BotAdapter {
  /**
   * Request the bot to start. DISABLED.
   * Gate: CONTROL_ENABLED feature flag + completed audit + exchange audit + tests.
   */
  startBot(botInstanceId: string, userId: string): Promise<{ accepted: boolean; reason: string }>;

  /**
   * Request the bot to stop. DISABLED.
   * IMPORTANT: Stopping the bot does NOT close any open positions.
   * Positions remain open on the exchange. Operator must close manually.
   * See BOT_CONTROL_SAFETY_MODEL.md §"stop bot ≠ close positions".
   */
  stopBot(botInstanceId: string, userId: string): Promise<{ accepted: boolean; reason: string }>;

  /**
   * Apply a new config to the bot. DISABLED.
   * Must always call validateConfig first and require explicit user confirmation.
   */
  applyConfig(botInstanceId: string, userId: string, config: unknown): Promise<{ accepted: boolean; configVersionId: string }>;
}

// Feature flag check — used by adapters to guard control methods.
export function assertControlEnabled(method: string): void {
  const enabled = process.env.BOT_CONTROL_ENABLED === "true";
  if (!enabled) {
    throw new ControlDisabledError(method);
  }
}
```

---

## Per-Bot Endpoint Mapping

### Tortila Bot → TortilaAdapter

**Runtime location:** Tortila Journal at `:8080` (read-only HTTP).
The bot worker itself has no public HTTP — all data is read from the journal.

| Adapter Method | Journal Endpoint | Notes |
|---|---|---|
| `getHealth()` | `GET /api/health` | Returns `{"ok": true, "ts": "..."}` |
| `getConfig(instanceId)` | `GET /config` (HTML) or instance env | Config pulled from env/settings at startup; adapter reads known settings from config page or direct SQLite state table |
| `getMetrics(instanceId)` | `GET /api/summary` or `GET /api/overview` | Use `/api/overview` for the full bundle (equity, summary, perf, drawdown) |
| `getPositions(instanceId)` | `GET /api/summary` → `open_position_summaries` | Or `/api/marks` for live mark prices |
| `getTrades(instanceId, opts)` | `GET /api/trades/list` | Supports `symbol`, `side`, `exit_reason`, `page`, `page_size` |
| `validateConfig(input)` | Local Zod schema only | No round-trip to journal required; validate against PerSymbolConfig shape |

**Additional Tortila journal endpoints available to the adapter:**

| Endpoint | Purpose |
|---|---|
| `GET /api/equity` | Equity time series `{ts:[], equity:[]}` |
| `GET /api/decisions` | Strategy decision log |
| `GET /api/metrics/advanced` | Sharpe/Sortino/Calmar/perf/DD stats |
| `GET /api/symbol_breakdown` | Per-symbol P&L breakdown |
| `GET /api/monthly` | Monthly P&L bars |
| `GET /api/calendar` | Daily P&L heatmap |
| `GET /api/distribution` | Trade net-PnL histogram |
| `GET /api/drawdown` | Underwater curve |
| `GET /api/marks` | Mark prices — **EXCLUDED: NEVER CONSUME FROM WTC.** Bot owns the exchange connection. WTC must not call /api/marks under any mode. unrealizedPnl is N/A for Tortila positions. |
| `GET /api/activity` | Mixed event timeline (decisions + safety + trades) |
| `GET /api/overview` | All-in-one bundle for dashboard refresh |

**Known Tortila risk signals surfaced as warnings by the adapter:**

| Warning Code | Severity | Title |
|---|---|---|
| `tp_reconcile_p0` | error | P0: TP reconciliation/restore not implemented |
| `margin_preflight_p1` | warning | P1: Margin pre-flight not implemented |
| `101211` | warning | NEAR TP rejection: price too close to mark |
| `100410` | warning | BingX rate-limit or funding API error |
| `109421` | warning | Fill-detail lookup: order not found on exchange |
| `exchange_flat_mismatch` | warning | Exchange-flat mismatch during reconciliation |

These warnings are never hidden behind a "healthy" badge. If the journal is reachable and
these conditions are known, the adapter injects them into `BotHealth.warnings[]`.

---

### Legacy Bot → LegacyBotAdapter

**Runtime location:** FastAPI at `:8000`.
The bot has its own auth (JWT-based). WTC uses a **service account** token stored in the
encrypted secret vault — never a user's own legacy bot credentials.

| Adapter Method | Legacy Endpoint | Notes |
|---|---|---|
| `getHealth()` | `GET /api_management/` (auth required) | If endpoint returns 200, process is alive. No dedicated health route was discovered — treat HTTP 200 as alive, timeout/5xx as degraded |
| `getConfig(instanceId)` | `GET /api_management/{api_id}` | Returns `Api_Key` row incl. settings; adapter strips secrets before returning `BotConfigView` |
| `getMetrics(instanceId)` | `GET /api_management/{api_id}` + derived | Legacy bot has no dedicated metrics endpoint; adapter synthesizes from balance, active slots, and order counts. Equity curve not available (no equity log) — `walletEquity` = `api_key.balance`, others null |
| `getPositions(instanceId)` | `GET /api_management/{api_id}` → orders/slots | Active slots + orders represent open positions; adapter normalizes to `BotPosition[]` |
| `getTrades(instanceId, opts)` | Not available | Legacy bot has no closed-trade history endpoint; `getTrades` returns empty with a warning note |
| `validateConfig(input)` | Local Zod schema only | Validate against LegacySymbolSettings shape |

**Legacy bot auth for adapter:**
The adapter authenticates using a WTC service account on the legacy bot (not a user account).
Credentials stored as encrypted vault secret — see [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md).
Auth header: `Authorization: Bearer <jwt>` obtained from `POST /auth/login`.
Token is refreshed automatically before expiry.

---

## Mock / Dev Adapter

**`MockTortilaAdapter` and `MockLegacyBotAdapter`** are the default in development.
Controlled by env var `BOT_ADAPTER_MODE`:

| Value | Behavior |
|---|---|
| `mock` (default dev) | Returns static fixture data shaped exactly like real adapter outputs |
| `audited` | Read-only **plus** the audited live-control gate (control still disabled until adapters pass audit) |

Fixture data lives at:
`packages/bot-adapters/src/__fixtures__/tortila.ts`
`packages/bot-adapters/src/__fixtures__/legacy.ts`

Fixtures include **all warning codes** pre-populated so UX for warnings is never untested.
Fixtures include at least one open position, one closed trade, and realistic equity curve data.

The `MockLegacyBotAdapter` marks `getTrades` as returning `[]` with
`warnings: [{ code: "no_trade_history", severity: "info", title: "Trade history not available",
detail: "Legacy bot has no closed-trade history API. Historical PnL is unavailable." }]`.

---

## Snapshot Import into WTC Database

The `apps/worker` background job polls each bot adapter on a configurable interval
(default: every 5 minutes for metrics, 1 minute for positions) and writes normalized
snapshots into the WTC PostgreSQL database. This decouples the WTC dashboard from
bot availability — the dashboard reads from WTC DB, not directly from bot APIs.

### Tables Written

| Table | Source | Key fields |
|---|---|---|
| `bot_metric_snapshots` | `getMetrics()` result | `bot_instance_id`, `snapshot_at`, `wallet_equity`, `closed_pnl`, `unrealized_pnl`, `net_pnl_with_fees`, `roi_pct`, `max_dd_pct`, `current_dd_pct`, `win_rate`, `profit_factor`, `total_trades`, `open_positions`, `fees_total`, `funding_total`, `open_risk_usdt`, `mode` |
| `bot_position_snapshots` | `getPositions()` result | `bot_instance_id`, `snapshot_at`, `symbol`, `side`, `units`, `total_qty`, `avg_entry_price`, `stop_price`, `stop_dist_pct`, `has_tp`, `tp_price`, `unrealized_pnl`, `opened_at` |
| `bot_trade_imports` | `getTrades()` result | `bot_instance_id`, `external_id`, `symbol`, `side`, `avg_entry`, `exit_price`, `qty`, `gross_pnl`, `fees_pnl`, `funding_pnl`, `net_pnl`, `opened_at`, `closed_at`, `hold_hours`, `exit_reason` |
| `bot_safety_events` | Tortila `/api/activity` safety items | `bot_instance_id`, `ts`, `kind`, `symbol`, `level`, `message`, `payload_json` |
| `integration_health_checks` | `getHealth()` result | `bot_instance_id`, `checked_at`, `process_state`, `journal_reachable`, `warnings_json`, `latency_ms` |

### Import Rules

- `bot_trade_imports` uses `(bot_instance_id, external_id)` unique constraint — imports are idempotent.
- `bot_position_snapshots` is append-only; the worker marks the latest snapshot with a `is_current = true` flag and clears it on each new write.
- `bot_metric_snapshots` is append-only; time-series for equity charts stored here.
- Equity curve for Tortila is imported from `/api/equity` on each cycle into `bot_metric_snapshots` (one row per equity point, deduplicated by `(bot_instance_id, snapshot_at)`).
- The worker records a `bot_safety_events` row whenever a new safety/warning event appears in the adapter result that was not previously imported.
- All writes are server-side only; the WTC web app reads from the snapshots — it never calls bot adapter endpoints directly.

### Staleness Labelling

The WTC dashboard labels data as stale when the most recent `integration_health_checks`
row is older than the configured threshold (default 10 minutes). Stale data is shown
with a "data may be delayed" badge — it is never silently replaced by zeros or hidden.

---

## Package Structure

```
packages/bot-adapters/
  src/
    adapter.ts              # BotAdapter, BotControlAdapter interfaces + types
    errors.ts               # ControlDisabledError, AdapterError, StaleDataError
    tortila/
      TortilaAdapter.ts     # Real adapter — calls :8080 journal
      TortilaMockAdapter.ts # Mock adapter for dev/test
      tortila.schemas.ts    # Zod schemas for journal response shapes
      tortila.warnings.ts   # Warning code definitions + detection logic
    legacy/
      LegacyBotAdapter.ts   # Real adapter — calls :8000
      LegacyMockAdapter.ts  # Mock adapter for dev/test
      legacy.schemas.ts     # Zod schemas for /api_management/* response shapes
    normalizer.ts           # BotTrade/BotPosition/BotMetrics normalizer functions
    index.ts                # Barrel export
  __fixtures__/
    tortila.ts
    legacy.ts
  __tests__/
    tortila.adapter.test.ts
    legacy.adapter.test.ts
    normalizer.test.ts
```

---

## Validation Contract

`validateConfig` must be callable without network access.
It applies the same Zod schema used in the DB model.

**Tortila config rules enforced by Zod:**
- `timeframe`: matches `/^\d+[mhdw]$/`
- `system`: `1 | 2`
- `riskPct`: `0.001 – 0.05`
- `stopN`: `> 0`, `<= 20`
- `addStep`: `> 0`, `<= 5`
- `maxUnits`: `1 – 20`
- `tpRr`: `>= 0`

**Legacy config rules enforced by Zod:**
- `timeframe`: one of known BingX/Binance timeframes
- `rsiLength`: `2 – 200`
- `cciLength`: `2 – 200`
- `takeProfitPercent`: `>= 0`
- `averagingLevels`: `0 – 10`
- `leverage`: `1 – 125`
- `useBalancePercent`: `1.0 – 100.0`

---

## Open Questions

See [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) for tracking. Key items:
- Legacy bot has no closed-trade history API — confirm whether orders table can serve as proxy.
- Legacy bot metrics (equity curve) are not available; wallet balance only — document this gap prominently.
- Tortila config is read from env at startup; journal has no config API — adapter must read from SQLite state KV table directly or rely on the `/config` HTML page parse (fragile). Preferred: add a `GET /api/config` JSON endpoint to Tortila journal as a tracked future change.
