# Contract: Tortila Bot Adapter

**Document type:** Integration contract
**Owner:** ecosystem-bot-integration-auditor (WTC side), Tortila bot team (provider side)
**Consumer:** `packages/bot-adapters/TortilaAdapter`, `apps/worker` snapshot job
**Status:** Phase 2.4 — read-only adapter mappings CURRENT for health/summary/equity/trades.
  Mock default (`BOT_ADAPTER_MODE=mock`). Real adapter activated when `BOT_ADAPTER_MODE=read-only`
  AND `TORTILA_JOURNAL_URL` is set; production-like environments also require `JOURNAL_READ_TOKEN`.
  Legacy direct HTTP/control adapter remains blocked; Legacy
  visibility now uses a separate worker DB snapshot path by provider `pub_id`.
**Last updated:** 2026-06-06

Related: [BOT_INTEGRATION_PLAN.md](../BOT_INTEGRATION_PLAN.md),
[BOT_CONTROL_SAFETY_MODEL.md](../BOT_CONTROL_SAFETY_MODEL.md),
[CANONICAL_ANALYTICS_MODEL.md](../CANONICAL_ANALYTICS_MODEL.md)

---

## Parties

| Role | Component | Location |
|---|---|---|
| Provider (read-only) | Tortila Journal FastAPI | `0.0.0.0:8080` on the bot server |
| Consumer | WTC `apps/worker` (snapshot job) | WTC platform server |
| Interface | `TortilaAdapter` in `packages/bot-adapters` | Compiled TypeScript |

WTC is a **read-only consumer**. No write operations are permitted against the journal.
The journal itself is read-only (reads from the same SQLite DB the bot writes — WAL mode).

---

## Auth Method

**Current local proof (Phase 4.59):** the inspected adjacent `../bot_tortila` source has a
`JOURNAL_READ_TOKEN` gate for `/api/*` when that env var is configured. It accepts
`Authorization: Bearer <token>` and `x-journal-read-token`, returns JSON 401 for missing/wrong tokens,
and has native pytest coverage. The WTC managed runner proves missing/wrong/correct-token behavior
before worker ingestion.

**Current canonical source proof (Phase 4.70):** WTC now has a clean private git-backed source packet at
`C:\Users\maxib\GTE BOT\tortila_canonical_source`, remote `https://github.com/papa-slon/tortila-canonical-source`,
branch `main`, commit `f53a774c3bc4c14653906bd2f778a515c565cf12`. It includes the journal token middleware/tests and
passes bot `pytest`, bot `ruff`, WTC secret scan against the export, and
`TORTILA_CANONICAL_SOURCE_ROOT=<canonical checkout> npm run verify:tortila:canonical-source`.

**Required before production WTC deployment:**
- Rerun WTC managed proof with `TORTILA_CANONICAL_SOURCE_REQUIRED=1` and
  `TORTILA_REAL_READ_SOURCE_ROOT=<canonical git checkout>` so the runner cannot silently fall back to adjacent
  `../bot_tortila`.
- Provision `JOURNAL_READ_TOKEN` as a deployment secret; never commit or print the real value.
- WTC worker sends `Authorization: Bearer <token>` on every request.
- Token is stored in WTC encrypted secret vault (see [SECRET_VAULT_DESIGN.md](../SECRET_VAULT_DESIGN.md)).
- Token rotation: 90-day cycle, overlapping 24h grace period.

**Current verifier (Phase 4.69):** WTC now ships `scripts/tortila-canonical-source-verifier.mjs`, exposed as
`npm run verify:tortila:canonical-source`. It is local/read-only and fail-closed: a source root must be a clean git repo
root with full HEAD, named branch, at least one remote name, `pyproject.toml`, `src/turtle_bot/journal/app.py`,
`tests/test_journal.py`, `JOURNAL_READ_TOKEN` middleware, bearer/header token parsing, `/api/*` 401 guard, and tests for
missing/wrong/correct token behavior including `/api/marks` rejection when configured. The adjacent non-git
`../bot_tortila` fixture is intentionally not canonical.

**Network boundary:** the local token proof is not a firewall/deploy proof. Before production
`BOT_ADAPTER_MODE=read-only`, restrict the journal port to the WTC worker host or private network
via security group, firewall, VPN, or reverse-proxy policy, then capture authorized positive/negative
probe evidence without printing secrets.

---

## Endpoint / Function Boundary

All endpoints are `GET`. No POST/PUT/DELETE. Read-only.

### Required WTC Worker Endpoints

| Endpoint | Method | Purpose | Adapter Method |
|---|---|---|---|
| `/api/health` | GET | Liveness check | `getHealth()` |
| `/api/summary` | GET | Summary metrics only | Fallback if overview fails |
| `/api/equity` | GET | Equity time series | Snapshot import |
| `/api/trades/list` | GET | Paginated closed trade list | `getTrades()` |

### Provider Reference / Future Endpoints

The journal may expose additional JSON routes such as `/api/overview`, `/api/metrics/advanced`,
`/api/activity`, `/api/monthly`, `/api/calendar`, and `/api/distribution`. They are not part of the
current WTC worker proof. `/api/overview` remains excluded from the WTC runtime proof because the
inspected source can bundle mark-price data; WTC must continue using the four-endpoint allowlist above
until a separate source audit proves a safe overview shape.

### Optional Endpoints (used if available)

| Endpoint | Method | Purpose |
|---|---|---|
| `/config` | GET (HTML) | Config page — adapter may parse for symbol list |
| `/safety` | GET (HTML) | Safety events — adapter falls back to `/api/activity` |

---

## Request / Response Schemas (Zod, for validation on WTC side)

All schemas live in `packages/bot-adapters/src/tortila/tortila.schemas.ts`.

### `GET /api/health`

**Request:** No parameters.

**Response (success, HTTP 200):**
```typescript
const TortilaHealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string(), // ISO 8601, e.g. "2026-05-29T08:04:00+00:00"
});
// Example: { "ok": true, "ts": "2026-05-29T08:04:00+00:00" }
```

**Adapter mapping to `BotHealth` (CURRENT field names — Phase 2.4):**

| Source field | Canonical field | Rule |
|---|---|---|
| `ok` | `processAlive` | direct boolean |
| _(derived)_ | `status` | always `'degraded'` — P0/P1 unresolved (see Warnings below) |
| _(derived)_ | `lastSyncAt` | `ok === true ? Date.now() : null` |
| _(constant)_ | `warnings` | always `TORTILA_PERSISTENT_WARNINGS` (P0+P1 injected unconditionally) |

**`status` field values:** `'healthy' | 'degraded' | 'stale' | 'down'`
The Tortila adapter returns `status: 'degraded'` unconditionally while P0 (TP reconciliation) and P1
(margin pre-flight) remain unresolved. It can never return `status: 'healthy'` until both are cleared.

**Adapter behavior on failure:**
- HTTP 4xx/5xx or network error → `processAlive: false`, `status: 'down'`.
- Timeout (5s) → `processAlive: false`, `status: 'stale'`.

---

### `GET /api/summary`

**Request:** No parameters.

**Response (success, HTTP 200):**
```typescript
const TortilaSummarySchema = z.object({
  now: z.string(),
  trades_total: z.number().int().nonnegative(),
  open_positions: z.number().int().nonnegative(),
  net_pnl: z.number(),                  // gross + funding, WITHOUT fees
  net_pnl_with_fees: z.number(),        // gross + funding + fees — USE THIS for netPnlWithFees
  max_dd_pct: z.number().nonnegative(),
  current_dd_pct: z.number().nonnegative(),
  last_equity: z.number().nonnegative(),
  first_equity: z.number().nonnegative(),
  pnl_pct_since_start: z.number(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  win_rate_pct: z.number().nonnegative(),
  best_trade: z.number(),
  worst_trade: z.number(),
  return_dd_ratio: z.number().nullable(),
  at_ath: z.boolean(),
  fees_total: z.number(),               // stored as negative cost — adapter takes abs()
  funding_total: z.number(),
  start_date: z.string().nullable(),
  mode: z.enum(["demo", "live"]),
  open_position_summaries: z.array(TortilaPositionSummarySchema),
});

const TortilaPositionSummarySchema = z.object({
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  units: z.number().int(),
  total_qty: z.number(),
  avg_entry: z.number(),
  last_entry: z.number(),
  stop: z.number().nullable(),
  stop_dist_pct: z.number().nullable(),
  has_tp: z.boolean(),
  system: z.number().int(),
  opened_at: z.string(),
});
```

---

### `GET /api/overview`

**Request:** No parameters.

**Response (success, HTTP 200):** Large bundle. Includes all summary fields plus:
```typescript
const TortilaOverviewSchema = z.object({
  ts: z.string(),
  mode: z.enum(["demo", "live"]),
  equity_curve: z.object({
    ts: z.array(z.string()),
    equity: z.array(z.number()),
  }),
  peak_curve: z.array(z.number()),
  dd_series: z.object({
    ts: z.array(z.string()),
    dd_pct: z.array(z.number()),
    peak: z.array(z.number()),
  }),
  summary: TortilaSummarySchema,
  performance: TortilaAdvancedPerfSchema,
  trade_agg: TortilaTradeAggSchema,
  drawdown: TortilaDrawdownStatsSchema,
  positions: z.array(TortilaPositionSummarySchema),
  marks: z.record(z.string(), TortilaMarkSchema.nullable()),
  symbol_breakdown: z.array(TortilaSymbolBreakdownSchema),
  monthly: z.array(TortilaMonthlySchema),
  distribution: TortilaDistributionSchema,
});
```

---

### `GET /api/trades/list`

**Request parameters:**
```typescript
// Query params (all optional)
symbol?: string      // filter by symbol
side?: "long" | "short"
exit_reason?: string // "stop" | "take_profit" | "exit_signal" | etc.
page?: number        // default 1, min 1
page_size?: number   // default 50, min 10, max 500
```

**Response (success, HTTP 200):**
```typescript
const TortilaTradeListSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  pages: z.number().int(),
  rows: z.array(TortilaTradeRowSchema),
});

const TortilaTradeRowSchema = z.object({
  id: z.number().int(),
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  units: z.number().int(),
  qty: z.number().nullable(),     // ALWAYS NULL for closed trades — TradeRow has no total_qty field;
                                  // serialize_trade uses getattr(t, 'total_qty', None) which always
                                  // returns None. Map to canonical qty: row.qty ?? 0.
  entry: z.number(),
  exit: z.number(),
  gross_pnl: z.number(),          // realized_pnl — before fees/funding
  fees_pnl: z.number(),           // STORED AS NEGATIVE COST — adapter must negate: Math.abs(fees_pnl)
                                  // CanonicalTrade.fee expects a POSITIVE cost (models.py:73)
  funding_pnl: z.number(),        // signed — positive=received, negative=paid (maps directly)
  net_pnl: z.number(),            // gross + fees + funding (net_pnl_with_fees equivalent at trade level)
  opened_at: z.string(),
  closed_at: z.string(),
  hold_hours: z.number(),
  exit_reason: z.string(),
  ret_pct: z.number(),            // (exit/entry - 1) * 100 * direction
});

// FEES SIGN-INVERSION WARNING (applies at both trade and summary level):
// journal fees_pnl and fees_total are NEGATIVE costs (costs stored as negative values).
// CanonicalTrade.fee and CanonicalMetrics.feesTotal are POSITIVE costs.
// ALWAYS apply Math.abs() when mapping fees from Tortila → canonical types.
// If the sign inversion is missed, netPnlWithFees will be inflated (double-negative = looks more positive).
```

---

### `GET /api/marks`

**NEVER CONSUME FROM WTC — THIS ENDPOINT IS EXCLUDED.**

The `/api/marks` endpoint calls BingX directly (bot owns the exchange connection — `app.py:31-32`:
"We deliberately do NOT keep a long-lived BingX client"). WTC must NEVER call this endpoint under
any mode. The bot owns the exchange connection; WTC is a read-only consumer of journal data only.

As a consequence, `unrealizedPnl` and `markPrice` are not available from the journal via the
WTC-safe path. The adapter must populate these with explicit placeholder values:
- `markPrice`: set to `entryPrice` (last known entry — safest approximation)
- `unrealizedPnl`: set to `0` with a UI-level note "N/A (mark price unavailable)"

The schema below is documented for reference only; the WTC adapter does NOT call this endpoint.

**Response shape (reference only — NOT consumed by WTC):**
```typescript
const TortilaMarksSchema = z.object({
  ts: z.string(),
  ttl_sec: z.number(),
  marks: z.record(z.string(), z.object({
    last: z.number().nullable(),
    mark: z.number().nullable(),
    bid: z.number().nullable(),
    ask: z.number().nullable(),
    ts: z.number().int().nullable(),
  })),
  stale: z.boolean(),
});
```

If BingX is unreachable, marks returns `{ "marks": {}, "stale": true }`. The adapter must
show "N/A" for unrealized PnL for all Tortila positions — it is never available.

---

### `GET /api/metrics/advanced`

**Response:**
```typescript
const TortilaAdvancedMetricsSchema = z.object({
  performance: z.object({
    sharpe: z.number().nullable(),
    sortino: z.number().nullable(),
    calmar: z.number().nullable(),
    recovery_factor: z.number().nullable(),
    cagr_pct: z.number().nullable(),
    vol_daily_pct: z.number().nullable(),
    mean_daily_pct: z.number().nullable(),
    total_return_pct: z.number().nullable(),
    best_day_pct: z.number(),
    worst_day_pct: z.number(),
    time_in_market_pct: z.number(),
    trades_per_week: z.number(),
    period_returns: z.object({
      today_pct: z.number().nullable(),
      d7_pct: z.number().nullable(),
      d30_pct: z.number().nullable(),
      d90_pct: z.number().nullable(),
      ytd_pct: z.number().nullable(),
      all_pct: z.number().nullable(),
    }),
  }),
  trades: TortilaTradeAggSchema,
  drawdown: TortilaDrawdownStatsSchema,
  best_day: z.object({ date: z.string().nullable(), pnl: z.number() }),
  worst_day: z.object({ date: z.string().nullable(), pnl: z.number() }),
});

const TortilaTradeAggSchema = z.object({
  count: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  scratches: z.number().int(),
  win_rate_pct: z.number(),
  loss_rate_pct: z.number(),
  avg_win: z.number(),
  avg_loss: z.number(),
  largest_win: z.number(),
  largest_loss: z.number(),
  profit_factor: z.number().nullable(),
  expectancy: z.number(),
  gross_profit: z.number(),
  gross_loss: z.number(),
  avg_hold_hours: z.number(),
  max_consec_wins: z.number().int(),
  max_consec_losses: z.number().int(),
});

const TortilaDrawdownStatsSchema = z.object({
  max_dd_pct: z.number(),
  max_dd_usd: z.number(),
  max_dd_start: z.string().nullable(),
  max_dd_trough: z.string().nullable(),
  max_dd_recovered: z.string().nullable(),
  max_dd_duration_days: z.number(),
  longest_underwater_days: z.number(),
  avg_dd_pct: z.number(),
  current_dd_pct: z.number(),
});
```

---

### `GET /api/activity`

**Request:** `limit?: number` (default 100, min 10, max 500)

**Response:**
```typescript
const TortilaActivitySchema = z.object({
  rows: z.array(z.discriminatedUnion("kind", [
    z.object({
      ts: z.string(),
      kind: z.literal("decision"),
      symbol: z.string(),
      label: z.string(),    // action: ENTER_LONG, HOLD, etc.
      detail: z.string(),   // reason string
    }),
    z.object({
      ts: z.string(),
      kind: z.literal("safety"),
      level: z.enum(["info", "warning", "error"]),
      symbol: z.string(),
      label: z.string(),    // safety event kind
      detail: z.string(),
    }),
    z.object({
      ts: z.string(),
      kind: z.literal("trade"),
      symbol: z.string(),
      side: z.string(),
      label: z.string(),    // exit_reason
      detail: z.string(),
      net_pnl: z.number(),
    }),
  ])),
});
```

---

## Error Envelope

The journal uses FastAPI defaults — no custom error envelope.

| Status | Meaning | Adapter behavior |
|---|---|---|
| 200 OK | Success | Parse with Zod schema; log validation errors |
| 404 Not Found | Endpoint not yet deployed | Mark as `degraded` with warning `journal_api_missing` |
| 500 Internal Server Error | SQLite or journal error | Mark as `degraded`, retry after 60s |
| Network timeout (>5s) | Journal unreachable or overloaded | Mark as `unknown`, inject stale banner |
| Zod parse failure | Response shape changed | Mark as `degraded`, log schema mismatch, use last cached value |

The adapter must **never crash the WTC worker** on journal errors. All errors are
caught and converted to `processState: "degraded"` with a descriptive warning.

---

## Idempotency

All requests are GET (read-only). Idempotent by definition.

The snapshot import job uses `(bot_instance_id, external_trade_id)` as a unique key
for `bot_trade_imports`. Equity snapshots are deduplicated by `(bot_instance_id, snapshot_at)`.
Re-running the import job is safe.

---

## Rate Limits

Tortila Journal has no explicit rate limiting. However:
- The journal opens a fresh SQLite read connection per request (lightweight, WAL mode).
- WTC worker must not poll `/api/overview`; the current proof lane excludes it.
- WTC worker must not poll `/api/trades/list` faster than every 5 minutes.
- WTC worker must never poll `/api/marks`; that endpoint is excluded because it calls BingX through the bot-owned exchange
  connection.

**Recommended polling intervals:**

| Endpoint | WTC polling interval |
|---|---|
| `/api/health` | 60 seconds |
| `/api/summary` | 60 seconds |
| `/api/equity` | 60 seconds |
| `/api/trades/list` | 5 minutes |

---

## Timeouts

| Operation | Timeout |
|---|---|
| Health check | 5 seconds |
| All data endpoints | 15 seconds |

`/api/marks` has no WTC timeout budget because WTC must never call it. Keep exclusion checks static; do not add a live
marks integration gate.

---

## Mock vs. Real Status (Phase 2.4)

| Component | Status | Notes |
|---|---|---|
| `getHealth()` mapping | CURRENT (Phase 2.4) | `/api/health` → `processAlive / status / warnings` wired |
| `getMetrics()` / summary mapping | CURRENT (Phase 2.4) | `/api/summary` → `CanonicalMetricsInput`; fees sign-inverted |
| `getEquityCurve()` mapping | CURRENT (Phase 2.4) | `/api/equity` → `EquityPoint[]`; zero-filtered |
| `getTrades()` mapping | CURRENT (Phase 2.4) | `/api/trades/list` (paginated); fees_pnl negated; qty always null |
| `getPositions()` mapping | CURRENT (Phase 2.4) | `/api/summary.open_position_summaries`; markPrice/unrealizedPnl unavailable |
| `/api/marks` | EXCLUDED — never consumed | Bot owns exchange connection; WTC must not call this |
| `startBot/stopBot/applyConfig` | HARD-DISABLED | `BotControlDisabledError` always thrown |
| Legacy DB snapshot | CURRENT (Phase 3.68 canary) | Worker reads provider Postgres safe columns by `pub_id`; direct HTTP/control adapter remains blocked |

| Environment | `BOT_ADAPTER_MODE` | Adapter used |
|---|---|---|
| Development | `mock` (default) | Mock adapter — static fixtures from `__fixtures__/tortila/` |
| Staging | `read-only` (must be explicit) | Real `TortilaAdapter` — calls `TORTILA_JOURNAL_URL` journal |
| Production | `read-only` | Real `TortilaAdapter` |

**Phase gate:** `BOT_ADAPTER_MODE=read-only` must not be set in any production-like environment until:
- Schema files, fixture files, and mapping functions are confirmed (Phase 2.4 deliverables)
- All T-01 through T-20 mapping unit tests pass
- `TORTILA_JOURNAL_URL` is explicitly configured for the target journal; production-like real mode must not rely on defaults
- API token auth is configured on the canonical journal source and WTC deployment (`JOURNAL_READ_TOKEN`)
- Journal port `:8080` is firewall-restricted to WTC server/private network only

Mock fixture data: `packages/bot-adapters/src/__fixtures__/tortila/` (directory with per-endpoint files).
Fixtures include all warning codes pre-populated and synthetic (not real) equity data.

---

## Required Tests Before Production Wiring

All tests must pass (Vitest) before setting `BOT_ADAPTER_MODE=read-only` in any production-like environment.

### Unit Tests (`packages/bot-adapters/src/__tests__/tortila.adapter.test.ts`)

| Test | Description |
|---|---|
| `getHealth — journal up` | Mock HTTP 200 from `/api/health`; verify `processState: "running"` |
| `getHealth — journal down` | Mock network error; verify `processState: "unknown"`, `journalReachable: false` |
| `getHealth — injects P0 warning` | Verify `tp_reconcile_p0` warning always present in warnings array |
| `getHealth — injects P1 warning` | Verify `margin_preflight_p1` warning always present |
| `getHealth — injects error code warnings` | If safety events include `101211`, verify warning in output |
| `getMetrics — zero equity filtered` | Equity points with `equity = 0` are dropped from curve |
| `getMetrics — null vs zero for legacy fields` | Any unavailable field returns null, not 0 |
| `getMetrics — net_pnl uses fees version` | `netPnlWithFees` = `net_pnl_with_fees`, not `net_pnl` |
| `getTrades — pagination` | `page=2 page_size=10` returns correct slice |
| `getTrades — trade fields correct` | `grossPnl`, `feesPnl`, `fundingPnl`, `netPnl` correct |
| `validateConfig — valid input` | Returns `{ valid: true, errors: [] }` |
| `validateConfig — bad timeframe` | Returns `{ valid: false, errors: [{ field: "timeframe" }] }` |
| `validateConfig — bad risk_pct` | Returns error when `> 0.05` |
| `schema parse — all endpoints` | Zod parse of fixture data succeeds for all endpoint schemas |
| `stale detection` | When `checkedAt` > 10 min ago, `isDataStale` returns true |

### Integration Tests (`tests/integration/tortila-adapter.test.ts`)

| Test | Description |
|---|---|
| `real endpoint shapes` | Against a local test journal instance, verify all Zod schemas pass for real responses |
| `snapshot import idempotent` | Run import twice; verify trade counts in DB unchanged |
`/api/marks` is excluded from WTC integration tests. Boundary tests should prove the adapter, worker, and web/admin
surfaces do not consume marks or present placeholder mark/uPnL values as live proof.

### Playwright E2E Tests (`tests/e2e/tortila-dashboard.spec.ts`)

| Test | Description |
|---|---|
| `P0 warning banner visible` | Screenshot shows TP reconciliation warning banner |
| `P1 warning banner visible` | Screenshot shows margin pre-flight warning banner |
| `demo mode badge` | DEMO badge shown on all metric cards |
| `stale data banner` | When health check > 10 min, stale banner appears |
| `null fields show N/A` | No metric card shows "0.00" when value is null |
| `equity chart no zero points` | Equity chart has no data points at y=0 |

---

## Dependency on Tortila Changes

The following changes to the Tortila journal are tracked as future requirements.
They are not blocking for Phase 0 (mock) but are required before read-only production use.

| Change | Priority | Description |
|---|---|---|
| `GET /api/config` JSON endpoint | P1 | Expose current bot config as JSON so WTC adapter doesn't need to parse HTML or read SQLite directly |
| Canonical API token auth on journal | P0 (before prod) | Phase 4.70 private canonical source packet passes bot pytest/ruff and WTC canonical verifier; runtime deploy/token/firewall proof still required |
| `tp_reconcile_ok` state key | P0 (clears warning) | Journal exposes a state key when TP reconciliation is implemented, allowing WTC to clear the P0 warning |
| Journal port firewall restriction | P0 (before prod) | Restrict `:8080` to WTC server IP only |
