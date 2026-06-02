# Handoff: ecosystem-tortila-journal-auditor
Epoch: 20260530-1355
Agent: ecosystem-tortila-journal-auditor
Role: Workstream B — Tortila journal CONTRACT auditor

---

## Scope

Code-exact audit of the Tortila journal source and the WTC canonical analytics model to produce
a verified, implementation-ready field mapping for the read-only Tortila adapter. Covers:

- Every JSON endpoint consumed by the adapter: `/api/health`, `/api/summary` (metrics + positions),
  `/api/equity` (equity curve), `/api/trades` and `/api/trades/list` (closed trades).
- Source field names, Python types, null/missing rules, and unit semantics drawn directly from
  `journal/app.py`, `journal/metrics.py`, `state/models.py`, and `state/store.py`.
- Mapping each source field to the exact canonical TypeScript type in `packages/analytics/src/metrics.ts`.
- Zod schema shapes for runtime validation of external JSON.
- Fixture set specification (valid + malformed/missing-field variants) and exact test assertions.
- P0/P1 warning persistence confirmation.
- Safety boundary re-confirmation: no live HTTP, no SSH, fixtures only; control stays disabled.

---

## Files inspected

- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py` (lines 283–623)
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\metrics.py` (entire file)
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py` (entire file)
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py` (lines 1–155, schema + migrations)
- `packages/analytics/src/metrics.ts` (canonical types + computeMetrics)
- `packages/analytics/src/index.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260530-1145-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/0000-orchestrator-seed.md`

---

## Files changed

None — read-only audit

---

## Findings

### F-01 HIGH: `getMetrics` source field `net_pnl` vs `net_pnl_with_fees` — wrong field would overstate bottom line

**Evidence:** `bot_tortila/src/turtle_bot/journal/app.py:601-609`

The `/api/summary` endpoint emits two distinct PnL fields:

```python
"net_pnl": sum(t.realized_pnl + t.funding_pnl for t in trades),          # line 602 — GROSS+funding, NO fees
"net_pnl_with_fees": sum(_trade_net(t) for t in trades),                   # line 609 — realized+funding+fees
```

`_trade_net` is defined at `app.py:250-252`:

```python
def _trade_net(t) -> float:
    return float(t.realized_pnl) + float(t.funding_pnl) + float(t.fees_pnl)
```

`TradeRow.fees_pnl` is documented at `models.py:73`: "stored as a negative number (it's a cost)".
So `net_pnl_with_fees` = realized + funding + fees_pnl (negative) = the true net bottom line.

The canonical type at `metrics.ts:92-94` defines `netPnlWithFees` as:
"closed PnL net of fees and funding = closedPnl - feesTotal + fundingTotal".

The `computeMetrics` function at `metrics.ts:183` computes:
`netPnlWithFees = round2(closedPnl - feesTotal + fundingTotal)`

where `fee` in `CanonicalTrade` is stored as a **positive cost** (per the comment at `metrics.ts:17`:
"trading fee, stored as a POSITIVE cost"). This means the adapter must negate `fees_pnl` when
populating `CanonicalTrade.fee`.

**Mapping rule (critical):**
- `CanonicalTrade.fee` = `Math.abs(t.fees_pnl)` — negate the stored negative cost to positive
- If `computeMetrics` is used: `netPnlWithFees` will be correct automatically
- If mapping directly from summary: use `net_pnl_with_fees`, NOT `net_pnl`

**Recommendation:** Document this sign inversion in the schema file. Add a test assertion that
the adapter mapping never uses `net_pnl` for `CanonicalMetrics.netPnlWithFees`. Target: Workstream B.

---

### F-02 HIGH: Zod schema files and fixture files do not exist — confirmed gap from Phase 2.3

**Evidence:** `packages/bot-adapters/src/` — no `tortila/tortila.schemas.ts`, no `__fixtures__/tortila.ts`.
Confirmed by Phase 2.3 handoff F-05: "Neither file exists." The real HTTP adapter at `http.ts:61`
casts `({ ok?: boolean })` via TypeScript assertion — no Zod parse occurs.

This audit provides the complete code-exact schema shapes below (Findings F-03 through F-07) so
they can be implemented without live HTTP. The schemas are derived from verified local source, not
from assumptions.

**Recommendation:** Create `packages/bot-adapters/src/tortila/tortila.schemas.ts` with the schemas
specified in F-03 through F-07. Create `packages/bot-adapters/src/__fixtures__/tortila/` with the
fixture set specified in F-08. This is the primary deliverable of Workstream B. Target: Workstream B.

---

### F-03 HIGH: Complete Zod schema for `GET /api/health`

**Evidence:** `app.py:572-574`

```python
@app.get("/api/health")
async def health():
    return {"ok": True, "ts": datetime.now(tz=UTC).isoformat()}
```

**Exact Zod schema (ready to implement):**

```typescript
// packages/bot-adapters/src/tortila/tortila.schemas.ts

export const TortilaHealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string(), // ISO 8601 with timezone offset, e.g. "2026-05-30T13:55:00+00:00"
});
export type TortilaHealth = z.infer<typeof TortilaHealthSchema>;
```

**Adapter mapping to `BotHealth`:**

| Source field | Source type | Canonical field | Rule |
|---|---|---|---|
| `ok` | `bool` | `processAlive` | direct boolean |
| _(derived)_ | — | `status` | always `'degraded'`: P0/P1 unresolved; see F-11 |
| _(derived)_ | — | `lastSyncAt` | `ok === true ? Date.now() : null` |
| _(constant)_ | — | `warnings` | always `TORTILA_PERSISTENT_WARNINGS` |

**Null/missing handling:**
- If `ok` field is absent or non-boolean: treat as `false` (degraded).
- If `ts` field is absent: acceptable — not used in the mapping; log a schema warning.

**Recommendation:** Implement with `safeParse`; if parse fails treat as `processAlive: false`.
Target: Workstream B.

---

### F-04 HIGH: Complete Zod schema for `GET /api/summary` with full field mapping

**Evidence:** `app.py:577-622`

The `api_summary()` function returns the following JSON. Every field is verified from its
computation in the function body.

```typescript
// packages/bot-adapters/src/tortila/tortila.schemas.ts

export const TortilaPositionSummarySchema = z.object({
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  units: z.number().int(),               // pyramid unit count (int in PositionRow.units)
  total_qty: z.number(),                 // actual position size in base currency
  avg_entry: z.number(),                 // avg_entry_price from PositionRow
  last_entry: z.number(),                // last_entry_price from PositionRow
  stop: z.number().nullable(),           // current_stop_price — nullable in PositionRow
  stop_dist_pct: z.number().nullable(),  // computed at app.py:297; null when stop or avg_entry absent
  has_tp: z.boolean(),                   // bool(current_tp_order_id) — false when null
  system: z.number().int(),              // PositionRow.system (int)
  opened_at: z.string(),                 // isoformat() of PositionRow.opened_at
});

export const TortilaSummarySchema = z.object({
  now: z.string(),
  trades_total: z.number().int().nonnegative(),
  open_positions: z.number().int().nonnegative(),
  net_pnl: z.number(),                   // realized+funding ONLY — do NOT use for netPnlWithFees
  net_pnl_with_fees: z.number(),         // realized+funding+fees_pnl — USE for netPnlWithFees
  max_dd_pct: z.number().nonnegative(),
  current_dd_pct: z.number().nonnegative(),
  last_equity: z.number().nonnegative(),
  first_equity: z.number().nonnegative(),
  pnl_pct_since_start: z.number(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  win_rate_pct: z.number().nonnegative(),
  best_trade: z.number(),                // net (realized+funding+fees) of best closed trade
  worst_trade: z.number(),               // net of worst closed trade
  return_dd_ratio: z.number().nullable(), // null when max_dd <= 1e-9
  at_ath: z.boolean(),
  fees_total: z.number(),                // sum of fees_pnl — stored NEGATIVE (cost)
  funding_total: z.number(),             // sum of FundingRow.amount — signed
  start_date: z.string().nullable(),     // isoformat of first equity or first trade; null when no data
  mode: z.enum(["demo", "live"]),
  open_position_summaries: z.array(TortilaPositionSummarySchema),
});
export type TortilaSummary = z.infer<typeof TortilaSummarySchema>;
```

**`getMetrics` mapping: `TortilaSummary` → `CanonicalMetricsInput` → `computeMetrics`**

Because `/api/summary` provides aggregate numbers and not individual `CanonicalTrade[]` objects,
the adapter has two choices: (A) build partial `CanonicalMetricsInput` from summary aggregates,
or (B) call `/api/trades/list` for individual trades and build real `CanonicalTrade[]`. Option B
is preferred for correctness and must be used.

When using Option A (summary-only fallback), the mapping is:

| Source field | Canonical field | Rule / sign |
|---|---|---|
| `last_equity` | `walletEquity` | direct; 0 when no equity data |
| `first_equity` | `firstEquity` | direct; use for `roiPctSinceStart` |
| `net_pnl` | _(not used)_ | never map to `closedPnl` — missing fees |
| `net_pnl_with_fees` | `netPnlWithFees` | direct; this IS the real bottom line |
| `fees_total` | `feesTotal` | `Math.abs(fees_total)` — stored negative, canonical is positive |
| `funding_total` | `fundingTotal` | direct (already signed) |
| `max_dd_pct` | `maxDrawdownPct` | direct |
| `current_dd_pct` | `currentDrawdownPct` | direct |
| `wins` | `winCount` | direct |
| `losses` | `lossCount` | direct |
| `win_rate_pct` | `winRatePct` | direct |
| `open_positions` | `openPositions` | direct |
| `return_dd_ratio` | _(no canonical field)_ | surface as supplementary metric only |

**Null/missing handling:**
- `return_dd_ratio`: nullable in source; do not map to a canonical field; expose in raw supplementary only.
- `start_date`: nullable; when null, `firstEquity` is still populated from `first_equity`.
- `win_rate_pct` is 0 when `trades_total` is 0 (no division by zero in source); canonical `winRatePct` should be `null` when `trades_total === 0` per the canonical model — adapter must apply: `trades_total === 0 ? null : win_rate_pct`.

**Recommendation:** Implement getMetrics using Option B (individual trades via /api/trades/list)
with summary as a fallback for aggregate fields not in trades. Target: Workstream B.

---

### F-05 HIGH: Complete Zod schema and mapping for `GET /api/trades/list` (preferred) and `GET /api/trades`

**Evidence:** `app.py:775-806` (trades/list), `app.py:635-655` (trades), `metrics.py:578-602` (serialize_trade)

The paginated `/api/trades/list` endpoint uses `metrics.serialize_trade()` for each row. The
simpler `/api/trades` uses inline serialisation. The adapter must prefer `/api/trades/list`
(richer: includes `fees_pnl`, `net_pnl`, `hold_hours`, `ret_pct`) but must also handle the
simpler shape for fallback.

**Zod schema for `/api/trades/list` row (from `serialize_trade` at `metrics.py:578-602`):**

```typescript
export const TortilaTradeRowSchema = z.object({
  id: z.number().int(),
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  units: z.number().int(),
  qty: z.number().nullable(),            // getattr(t, 'total_qty', None) — may be null
  entry: z.number(),                     // float(t.avg_entry)
  exit: z.number(),                      // float(t.exit_price) — ALWAYS populated (TradeRow.exit_price NOT nullable)
  gross_pnl: z.number(),                 // float(t.realized_pnl) — gross, before fees/funding
  fees_pnl: z.number(),                  // float(t.fees_pnl) — NEGATIVE cost (stored as cost)
  funding_pnl: z.number(),               // float(t.funding_pnl) — signed
  net_pnl: z.number(),                   // _trade_net(t) = realized+funding+fees
  opened_at: z.string(),
  closed_at: z.string(),
  hold_hours: z.number(),
  exit_reason: z.string(),               // "stop"|"exit_signal"|"manual"|"adopted_close"|"take_profit"
  ret_pct: z.number(),                   // (exit/entry - 1)*100*direction; 0 when avg_entry <= 0
});

export const TortilaTradeListSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  page_size: z.number().int(),
  pages: z.number().int().nonnegative(),
  rows: z.array(TortilaTradeRowSchema),
});
export type TortilaTradeList = z.infer<typeof TortilaTradeListSchema>;
```

**Mapping `TortilaTradeRowSchema` → `CanonicalTrade` (from `metrics.ts:11-25`):**

| Source field | Source type | Canonical field | Rule |
|---|---|---|---|
| `id` (number) | `int` | `id` (string) | `String(row.id)` |
| `symbol` | `str` | `symbol` | direct |
| `side` | `"long"\|"short"` | `side` | direct |
| `qty` (nullable) | `float\|null` | `qty` | `row.qty ?? 0` (null means old row; treat as 0; document this assumption) |
| `gross_pnl` | `float` | `realizedPnl` | direct (this is the GROSS realized; canonical comment: "GROSS realized PnL for a CLOSED trade ... before fee/funding") |
| `fees_pnl` | `float` (negative cost) | `fee` | `Math.abs(row.fees_pnl)` — canonical stores as POSITIVE cost |
| `funding_pnl` | `float` (signed) | `funding` | direct (positive=received, negative=paid — matches canonical) |
| `opened_at` | ISO string | `openedAt` | `new Date(row.opened_at).getTime()` → epoch ms |
| `closed_at` | ISO string | `closedAt` | `new Date(row.closed_at).getTime()` → epoch ms (always set for closed trades) |
| `hold_hours` | `float` | `holdHours` | direct (optional field) |
| `exit_reason` | `str` | `exitReason` | direct (optional field) |
| `ret_pct` | `float` | `retPct` | direct (optional field) |

**Critical note on `exit_price`:** `TradeRow.exit_price` is declared `float` (not `Optional[float]`)
at `models.py:64`. The SQLite schema at `store.py:82` has `exit_price REAL NOT NULL`. Therefore
`exit` (the serialised name) is always a non-null float in closed trades. The `/api/trades` simple
endpoint also always includes `exit_price` as a number. No null guard needed here.

**Null/missing handling for `qty`:**
- `serialize_trade` at `metrics.py:589`: `"qty": getattr(t, "total_qty", None)`. The `TradeRow` model
  at `models.py:58-74` does NOT have a `total_qty` field — only `PositionRow` has it (`models.py:18`).
  Therefore `getattr(t, "total_qty", None)` will ALWAYS return `None` for `TradeRow` objects.
  The `qty` field in the serialised output is always `null`. The adapter must handle this gracefully.
  Mapping: `qty: row.qty ?? 0` with a comment that this always comes as null from the current source.

**Recommendation:** When implementing getEquityCurve do NOT derive it from trades; use the dedicated
endpoint. Target: Workstream B.

---

### F-06 HIGH: Complete Zod schema and mapping for `GET /api/equity`

**Evidence:** `app.py:626-633`

```python
@app.get("/api/equity")
async def api_equity():
    s = _store()
    try:
        live_equity, live_equity_ts = _live_equity_state(s)
        return _equity_curve(s.list_equity(), live_equity, live_equity_ts)
    finally:
        _close(s)
```

`_equity_curve` at `app.py:187-197`:

```python
def _equity_curve(...) -> dict[str, list]:
    points = _equity_points(equity_rows, live_equity, live_ts)
    if not points:
        return {"ts": [], "equity": []}
    ts = [p[0].isoformat() for p in points]
    eq = [p[1] for p in points]
    return {"ts": ts, "equity": eq}
```

`_equity_points` filters out rows where `equity <= 0` (via `_valid_equity_rows` at `app.py:153-154`).
The live equity value is appended or replaces the last point when `live_equity > 0`.

**Zod schema:**

```typescript
export const TortilaEquityCurveSchema = z.object({
  ts: z.array(z.string()),       // ISO 8601 strings; parallel array with equity
  equity: z.array(z.number()),   // wallet equity values; same length as ts; all > 0 (zero-filtered)
});
export type TortilaEquityCurve = z.infer<typeof TortilaEquityCurveSchema>;
```

**Mapping `TortilaEquityCurve` → `EquityPoint[]` (from `metrics.ts:47-49`):**

```typescript
function toEquityPoints(curve: TortilaEquityCurve): EquityPoint[] {
  // ts and equity are parallel arrays of equal length
  return curve.ts.map((isoStr, i) => ({
    t: new Date(isoStr).getTime(),   // epoch ms
    equity: curve.equity[i]!,
  }));
}
```

**After conversion, always apply `filterZeroEquity` before passing to `computeMetrics`:**
The source already filters zeros, but the canonical `filterZeroEquity` call at `metrics.ts:200`
and `metrics.ts:232-234` must still be applied as a defence-in-depth guard (documented at
`metrics.ts:198-200`: "GAP-F: drop zero/negative equity placeholder rows").

**Null/missing handling:**
- Empty arrays `{"ts": [], "equity": []}` are valid and must not crash — return `[]` from `getEquityCurve`.
- Length mismatch (`ts.length !== equity.length`): validation failure; reject with Zod schema error, log, return `[]`.
- Non-parseable ISO string: `new Date(isoStr).getTime()` returns `NaN`; the adapter must filter those points.

**Recommendation:** Add a Zod refinement `.refine(v => v.ts.length === v.equity.length)` to
`TortilaEquityCurveSchema`. Target: Workstream B.

---

### F-07 MEDIUM: Unrealized PnL is not available from the journal — mark price absent

**Evidence:** `app.py:283-311` (`_open_position_summaries`), `app.py:706-725` (`/api/marks`)

The `/api/summary` response's `open_position_summaries` does NOT include a mark price or unrealized
PnL value. The `_open_position_summaries` function only returns `avg_entry`, `stop`, and a
`has_tp` flag. The journal does not have a real-time price feed — it only reads the SQLite DB.

Mark prices are only available via `/api/marks`, which calls BingX directly (30s cache). The WTC
adapter MUST NOT call `/api/marks` because:
1. It uses BingX credentials belonging to the bot (bot owns the exchange connection — per
   `app.py:31-32`: "We deliberately do NOT keep a long-lived BingX client").
2. The discovery doc states: "/api/marks — DO NOT consume from WTC; bot owns the exchange connection."

**Consequence for `CanonicalPosition.markPrice` and `unrealizedPnl`:**
Both fields are required (non-optional) in `CanonicalPosition` at `metrics.ts:28-31`:

```typescript
export interface CanonicalPosition {
  symbol: string;
  side: Side;
  qty: number;
  entryPrice: number;
  markPrice: number;       // required — but not available from journal without /api/marks
  unrealizedPnl: number;   // required — not available without mark price
  marginUsed?: number;     // optional — not in journal; not available
```

The adapter must populate these with explicit placeholder values and document them as unavailable:
- `markPrice`: set to `entryPrice` (last known entry) as the safest available approximation
- `unrealizedPnl`: set to `0` with a prominent comment and a UI-level note

**Mapping `TortilaPositionSummarySchema` → `CanonicalPosition`:**

| Source field | Canonical field | Rule |
|---|---|---|
| `symbol` | `symbol` | direct |
| `side` | `side` | direct |
| `total_qty` | `qty` | direct |
| `avg_entry` | `entryPrice` | direct |
| _(unavailable)_ | `markPrice` | `avg_entry` (approximation; flag in UI) |
| _(unavailable)_ | `unrealizedPnl` | `0` (unavailable; must not be shown as a real value) |
| _(unavailable)_ | `marginUsed` | `undefined` (optional; omit) |
| `stop` | `stopPrice` | direct (nullable → `null`) |
| `stop_dist_pct` | `stopDistPct` | direct (nullable → `null`) |
| `has_tp` | `hasTp` | direct |
| _(unavailable)_ | `tpPrice` | `undefined` (journal does not expose TP price) |
| `opened_at` | `openedAt` | `new Date(opened_at).getTime()` → epoch ms |
| `units` | `units` | direct (int) |

**Recommendation:** The UI must never display an "unrealized PnL" figure for Tortila positions
derived from adapter data — it should show "N/A (mark price unavailable)" and link to the note
about /api/marks ownership. This is a product warning, not a technical blocker. Target: Workstream B.

---

### F-08 MEDIUM: Fixture set specification for Workstream B implementation

**Evidence:** Cross-referenced from all schemas above + `packages/bot-adapters/src/adapters.test.ts` (existing test patterns)

The fixture set must live at `packages/bot-adapters/src/__fixtures__/tortila/`.
Do NOT put exchange keys or real equity values in fixtures. Use synthetic rounded numbers.

**Required fixture files:**

**`health.valid.json`**
```json
{
  "ok": true,
  "ts": "2026-05-30T13:55:00.000000+00:00"
}
```

**`health.down.json`**
```json
{
  "ok": false,
  "ts": "2026-05-30T13:55:00.000000+00:00"
}
```

**`health.malformed.json`** (missing `ok` field — tests fail-closed)
```json
{
  "ts": "2026-05-30T13:55:00.000000+00:00"
}
```

**`summary.valid.json`** (synthetic values — no real equity/PnL)
```json
{
  "now": "2026-05-30T13:55:00+00:00",
  "trades_total": 42,
  "open_positions": 1,
  "net_pnl": 215.80,
  "net_pnl_with_fees": 198.40,
  "max_dd_pct": 8.2,
  "current_dd_pct": 2.1,
  "last_equity": 1298.00,
  "first_equity": 1000.00,
  "pnl_pct_since_start": 29.8,
  "wins": 28,
  "losses": 14,
  "win_rate_pct": 66.67,
  "best_trade": 142.50,
  "worst_trade": -38.20,
  "return_dd_ratio": 3.63,
  "at_ath": false,
  "fees_total": -17.40,
  "funding_total": 0.80,
  "start_date": "2026-01-15T00:00:00+00:00",
  "mode": "live",
  "open_position_summaries": [
    {
      "symbol": "NEAR-USDT",
      "side": "long",
      "units": 2,
      "total_qty": 120.0,
      "avg_entry": 5.42,
      "last_entry": 5.55,
      "stop": 5.10,
      "stop_dist_pct": 5.90,
      "has_tp": true,
      "system": 1,
      "opened_at": "2026-05-30T05:55:00+00:00"
    }
  ]
}
```

**`summary.no_trades.json`** (empty state — tests null guard for win_rate)
```json
{
  "now": "2026-05-30T13:55:00+00:00",
  "trades_total": 0,
  "open_positions": 0,
  "net_pnl": 0.0,
  "net_pnl_with_fees": 0.0,
  "max_dd_pct": 0.0,
  "current_dd_pct": 0.0,
  "last_equity": 0.0,
  "first_equity": 0.0,
  "pnl_pct_since_start": 0.0,
  "wins": 0,
  "losses": 0,
  "win_rate_pct": 0.0,
  "best_trade": 0.0,
  "worst_trade": 0.0,
  "return_dd_ratio": null,
  "at_ath": false,
  "fees_total": 0.0,
  "funding_total": 0.0,
  "start_date": null,
  "mode": "demo",
  "open_position_summaries": []
}
```

**`summary.missing_field.json`** (missing `net_pnl_with_fees` — tests schema validation)
```json
{
  "now": "2026-05-30T13:55:00+00:00",
  "trades_total": 5,
  "open_positions": 0,
  "net_pnl": 50.0,
  "max_dd_pct": 3.0,
  "current_dd_pct": 1.0,
  "last_equity": 1050.0,
  "first_equity": 1000.0,
  "pnl_pct_since_start": 5.0,
  "wins": 3, "losses": 2, "win_rate_pct": 60.0,
  "best_trade": 30.0, "worst_trade": -15.0,
  "return_dd_ratio": 1.67,
  "at_ath": false, "fees_total": -5.0, "funding_total": 0.2,
  "start_date": null, "mode": "live",
  "open_position_summaries": []
}
```

**`equity.valid.json`**
```json
{
  "ts": [
    "2026-01-15T12:00:00+00:00",
    "2026-01-16T12:00:00+00:00",
    "2026-01-17T12:00:00+00:00"
  ],
  "equity": [1000.0, 1042.0, 1090.0]
}
```

**`equity.empty.json`**
```json
{ "ts": [], "equity": [] }
```

**`equity.length_mismatch.json`** (tests schema refinement)
```json
{ "ts": ["2026-01-15T12:00:00+00:00"], "equity": [1000.0, 1042.0] }
```

**`trades_list.valid.json`**
```json
{
  "total": 2,
  "page": 1,
  "page_size": 50,
  "pages": 1,
  "rows": [
    {
      "id": 1,
      "symbol": "BTC-USDT",
      "side": "long",
      "units": 1,
      "qty": null,
      "entry": 62000.0,
      "exit": 63800.0,
      "gross_pnl": 142.50,
      "fees_pnl": -5.60,
      "funding_pnl": 0.80,
      "net_pnl": 137.70,
      "opened_at": "2026-05-28T10:00:00+00:00",
      "closed_at": "2026-05-28T16:00:00+00:00",
      "hold_hours": 6.0,
      "exit_reason": "take_profit",
      "ret_pct": 2.90
    },
    {
      "id": 2,
      "symbol": "ETH-USDT",
      "side": "short",
      "units": 1,
      "qty": null,
      "entry": 3200.0,
      "exit": 3320.0,
      "gross_pnl": -38.20,
      "fees_pnl": -2.80,
      "funding_pnl": -0.60,
      "net_pnl": -41.60,
      "opened_at": "2026-05-29T08:00:00+00:00",
      "closed_at": "2026-05-29T11:00:00+00:00",
      "hold_hours": 3.0,
      "exit_reason": "stop",
      "ret_pct": -3.75
    }
  ]
}
```

**`trades_list.missing_fees.json`** (old row missing `fees_pnl` — tests schema fallback)
```json
{
  "total": 1, "page": 1, "page_size": 50, "pages": 1,
  "rows": [{
    "id": 3, "symbol": "SOL-USDT", "side": "long", "units": 1,
    "qty": null, "entry": 150.0, "exit": 162.0,
    "gross_pnl": 88.0,
    "funding_pnl": 0.0, "net_pnl": 88.0,
    "opened_at": "2026-05-25T09:00:00+00:00",
    "closed_at": "2026-05-26T09:00:00+00:00",
    "hold_hours": 24.0, "exit_reason": "exit_signal", "ret_pct": 8.0
  }]
}
```

---

### F-09 MEDIUM: `win_rate_pct` is 0.0 when no trades — adapter must convert to null

**Evidence:** `app.py:592`: `"win_rate_pct": (wins / len(trades) * 100) if trades else 0.0`

The journal returns `0.0` for `win_rate_pct` when there are no closed trades. The canonical model
at `metrics.ts:175` states: `winRatePct = closed.length > 0 ? round2(...) : null`. Returning `0%`
win rate with zero trades would display as a misleading "0% win rate" in the UI.

**Mapping rule:** `adapted.winRatePct = summary.trades_total === 0 ? null : summary.win_rate_pct`

Same applies for `profitFactor`: when `trades_total === 0`, the adapter has no loss data; return
`null`, not `0` or `Infinity`.

**Recommendation:** Add an explicit mapping rule in the schema adapter module:
`winRatePct: data.trades_total === 0 ? null : data.win_rate_pct`. Add test assertion. Target: Workstream B.

---

### F-10 MEDIUM: `fees_total` sign inversion — journal stores as negative, canonical expects positive

**Evidence:** `models.py:73`: "fees_pnl: Sum of trading fees for this trade... Stored as a negative number (it's a cost)."
`app.py:609-610`: `"fees_total": sum(t.fees_pnl for t in trades)` — sum of negatives = negative number.

The canonical field `CanonicalMetrics.feesTotal` at `metrics.ts:82` is defined as a cost (used in
`netPnlWithFees = closedPnl - feesTotal + fundingTotal`, `metrics.ts:183`), meaning `feesTotal`
should be a positive number representing the cost magnitude.

**Mapping rule:** `feesTotal = Math.abs(summary.fees_total)`

This is distinct from the `CanonicalTrade.fee` mapping (F-01): both must negate.

**Recommendation:** Both `fees_total` (summary level) and `fees_pnl` (trade row level) must be
negated. Document this in a code comment at both call sites. Target: Workstream B.

---

### F-11 LOW: P0/P1 warning persistence confirmed — `status: 'degraded'` hardcoded correctly

**Evidence:** `packages/bot-adapters/src/http.ts:68-73`; `packages/bot-adapters/src/warnings.ts:33-46`

The real HTTP Tortila adapter at `http.ts:68-70` returns `status: 'degraded'` unconditionally and
injects `TORTILA_PERSISTENT_WARNINGS` regardless of what the journal reports. This is correct
per the safety model because both P0 (`tp_reconcile_p0`) and P1 (`margin_preflight_p1`) warnings
are unresolved in the journal source. The mock adapter (confirmed at `adapters.test.ts:34-48`)
also always surfaces both.

The existing test at `adapters.test.ts:41`: `expect(h.status).not.toBe('healthy')` is verified.

No change required. This is a confirmed safety property. The adapter correctly cannot report
`'healthy'` while these items remain open. Target: confirm, no action.

---

### F-12 LOW: `/api/trades` simple endpoint omits `fees_pnl` — adapter must prefer `/api/trades/list`

**Evidence:** `app.py:635-655` (`/api/trades` handler):

```python
return JSONResponse([
    {
        "id": t.id, "symbol": t.symbol, "side": t.side, "units": t.units,
        "avg_entry": t.avg_entry, "exit_price": t.exit_price,
        "realized_pnl": t.realized_pnl, "funding_pnl": t.funding_pnl,
        "opened_at": t.opened_at.isoformat(),
        "closed_at": t.closed_at.isoformat(),
        "exit_reason": t.exit_reason,
    }
    for t in rows
])
```

This endpoint does NOT include `fees_pnl` in its output. Using it for `getTrades` would silently
produce incorrect `netPnlWithFees` (fees = 0 for all trades). The `/api/trades/list` endpoint via
`serialize_trade` at `metrics.py:578-602` DOES include `fees_pnl` and should be used instead.

**Simple trades Zod schema (for fallback only):**

```typescript
export const TortilaSimpleTradeSchema = z.object({
  id: z.number().int(),
  symbol: z.string(),
  side: z.enum(["long", "short"]),
  units: z.number().int(),
  avg_entry: z.number(),
  exit_price: z.number(),          // NOT nullable — TradeRow.exit_price is REAL NOT NULL
  realized_pnl: z.number(),        // gross only, no fees
  funding_pnl: z.number(),
  opened_at: z.string(),
  closed_at: z.string(),
  exit_reason: z.string(),
  // fees_pnl deliberately absent from this endpoint
});
```

If the adapter must fall back to `/api/trades`, map `fee: 0` for every trade and surface a warning
that fee data is unavailable for this data set.

**Recommendation:** The `getTrades` implementation must call `/api/trades/list` (paginated, all pages),
not `/api/trades`. Never use `/api/trades` for `getTrades` in the real adapter. Target: Workstream B.

---

### F-13 LOW: Control methods confirmed disabled in both mock and real adapter

**Evidence:** `packages/bot-adapters/src/control.ts:16-18`; `packages/bot-adapters/src/mock-tortila.ts:106-117`;
`packages/bot-adapters/src/http.ts:33-48`; `packages/bot-adapters/src/adapters.test.ts:27-31`

`assertBotControlAllowed(action, false, false)` is called unconditionally in `startBot`, `stopBot`,
and `applyConfig` across all three adapter implementations. Both arguments are hardcoded `false`,
so `BotControlDisabledError` is always thrown. A Vitest test confirms mock control methods throw.
The real HTTP adapter's `disabledControl` helper also throws before any HTTP call.

This is a confirmed safety property. No change needed for Phase 2.4. The fixture tests (F-08) must
also assert that control methods throw.

---

## Decisions

### D-01: Preferred endpoint strategy for the full `getTrades` implementation

Use `/api/trades/list` with pagination (`page_size=500`, iterate all pages). This gives `fees_pnl`
and the full `CanonicalTrade` shape. Only fall back to `/api/trades` if `/api/trades/list` returns
a 404 (old journal version), and in that case surface a `fee_data_unavailable` warning and set
`fee: 0` for all trades.

### D-02: `unrealizedPnl` must be surfaced as explicitly unavailable, not fabricated as 0

The journal does not provide mark prices via the WTC-safe path. The `CanonicalPosition.unrealizedPnl`
must be set to `0` with a companion UI flag or tooltip saying "unrealized PnL unavailable — journal
does not expose mark prices." The UI must not render a "0 USDT" unrealized PnL card for Tortila
positions as if it is a real value. Preference: render the cell as "N/A" when `markPrice === entryPrice`
(i.e. the adapter fell back to entry price as the approximation).

### D-03: `computeMetrics` should be called with individual `CanonicalTrade[]` from `/api/trades/list`

The summary endpoint is useful for fast health checks but its aggregate numbers cannot replace
`computeMetrics` applied to individual trades (e.g. canonical profit factor requires per-trade
`realizedPnl`, and the sign-handling for fees requires per-trade negation). The adapter should
build `CanonicalTrade[]` from `getTrades` and then call `computeMetrics`.

### D-04: Fixture-only testing — no live HTTP permitted

All tests must use fixtures from `packages/bot-adapters/src/__fixtures__/tortila/`. The real
adapter's data methods still throw `AdapterNotReadyError` until both the schema files and fixtures
are created and the mapping implementation is reviewed. Per the safety model, no live
HTTP/SSH/BingX calls are allowed in any WTC test. The journal's `/api/marks` endpoint must never
be called by WTC under any mode.

### D-05: `filterZeroEquity` must be applied in the adapter, not only in the analytics layer

The journal's `_equity_curve` already filters zeros server-side (`_valid_equity_rows`), but the
WTC adapter must apply `filterZeroEquity` again after converting to `EquityPoint[]` as a
defence-in-depth guard, consistent with `metrics.ts:200` and the GAP-F fix.

---

## Risks

### R-01 (HIGH) — `qty` is always `null` in `serialize_trade` for closed trades

`TradeRow` does not have a `total_qty` field; `getattr(t, "total_qty", None)` always returns `None`
(`metrics.py:589`). The adapter must map `qty: 0` for all closed trades from this endpoint.
This means `CanonicalPosition.qty` (which is populated from open positions, not from `serialize_trade`)
is fine, but `CanonicalTrade.qty` will always be 0 from the Tortila adapter. This is a data gap
in the journal source, not a WTC issue. Document it.

### R-02 (HIGH) — `feesTotal` sign inversion is a silent mis-mapping risk

The journal stores all fee values as negative costs. `computeMetrics` expects `fee` as a positive
cost in `CanonicalTrade`. If the sign inversion is missed, `netPnlWithFees` will be inflated
(double-adding a negative fee makes it look more positive), producing a misleading bottom line.
This is the single most dangerous mapping error. It must be covered by an explicit unit test.

### R-03 (MEDIUM) — `tpPrice` never available from the journal

The journal only exposes `has_tp: bool` (derived from `current_tp_order_id != null`) — it does not
expose the actual TP price. The `CanonicalPosition.tpPrice` optional field cannot be populated.
This means the bot dashboard cannot show "TP @ $X.XX" for Tortila positions. Surface as N/A.

### R-04 (MEDIUM) — `/api/summary` `net_pnl` field name is misleadingly close to `net_pnl_with_fees`

A future implementer reading the endpoint response might map `net_pnl` thinking it is the full
bottom line. The comment in `app.py:603` (pre-existing keys) and the absence of any inline
documentation makes this a latent trap. The Zod schema comment and the adapter code must include
an explicit "DO NOT USE net_pnl — use net_pnl_with_fees" comment at the field definition.

### R-05 (LOW) — ISO string timestamp parsing edge cases

The journal serialises timestamps using Python's `datetime.isoformat()`. For UTC-aware datetimes
this produces `"2026-05-30T13:55:00+00:00"` which is valid for `new Date(str)`. However the
bot may run in a non-UTC timezone config, in which case the offset would be different. The adapter
must use `new Date(isoStr).getTime()` (not `Date.parse` variants that may strip timezone) and
validate that the result is not `NaN`.

---

## Verification/tests

### Existing tests that must continue passing

`packages/bot-adapters/src/adapters.test.ts` (all 6 assertions — confirmed currently passing):
- `mode === 'mock'` default
- `read-only` without base URL stays mock
- Real adapter data methods throw `AdapterNotReadyError`
- Real adapter control methods throw `BotControlDisabledError`
- Mock control methods throw `BotControlDisabledError`
- Mock health includes `tp_reconcile_p0` + `margin_preflight_p1`
- Real health status is not `'healthy'`
- All warning codes are canonical

### New unit tests required (target: `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`)

These tests must run against fixtures only — no network calls.

| Test ID | Fixture | Assertion |
|---|---|---|
| T-01 | `health.valid.json` | `safeParse` succeeds; `processAlive === true` |
| T-02 | `health.down.json` | `processAlive === false`; `status === 'degraded'`; P0+P1 warnings present |
| T-03 | `health.malformed.json` | `safeParse` fails; adapter maps to `processAlive: false` (fail-closed) |
| T-04 | `summary.valid.json` | `safeParse` succeeds; `winRatePct !== 0` (trades > 0) |
| T-05 | `summary.no_trades.json` | `winRatePct === null` (not 0); `profitFactor === null` |
| T-06 | `summary.missing_field.json` | `safeParse` fails (missing `net_pnl_with_fees`) |
| T-07 | `summary.valid.json` | `feesTotal = Math.abs(summary.fees_total)` = 17.40 (positive) |
| T-08 | `summary.valid.json` | `netPnlWithFees` uses `net_pnl_with_fees` field (198.40), NOT `net_pnl` (215.80) |
| T-09 | `trades_list.valid.json` | `safeParse` succeeds; row[0].fee = Math.abs(-5.60) = 5.60 |
| T-10 | `trades_list.valid.json` | row[0] `CanonicalTrade.realizedPnl = 142.50` (gross_pnl direct) |
| T-11 | `trades_list.valid.json` | row[0] `CanonicalTrade.qty = 0` (qty is null in source, maps to 0) |
| T-12 | `trades_list.valid.json` | row[0] `CanonicalTrade.closedAt` is not null (closed trade) |
| T-13 | `trades_list.missing_fees.json` | `fees_pnl` absent → `safeParse` fails OR adapter defaults to 0 with warning |
| T-14 | `equity.valid.json` | `toEquityPoints` returns 3 points; `t` values are epoch ms; all equity > 0 |
| T-15 | `equity.empty.json` | returns `[]`; does not crash |
| T-16 | `equity.length_mismatch.json` | schema refinement fails; adapter returns `[]` |
| T-17 | `equity.valid.json` | `filterZeroEquity` applied; no zero-equity points in output |
| T-18 | computed | `computeMetrics` with trades from T-09 fixture: `feesTotal = 8.40`; `netPnlWithFees = 142.50 - 8.40 + 0.80 - 38.20 - 2.80 + (-0.60) = 93.30` (both rows combined, approximate) |
| T-19 | (any) | `startBot` throws `BotControlDisabledError` |
| T-20 | (any) | `stopBot` throws `BotControlDisabledError` |

### Product warning assertions (separate test file or inline)

| Test ID | Assertion |
|---|---|
| W-01 | `TORTILA_PERSISTENT_WARNINGS` contains `code: 'tp_reconcile_p0'` at `severity: 'error'` |
| W-02 | `TORTILA_PERSISTENT_WARNINGS` contains `code: 'margin_preflight_p1'` at `severity: 'warning'` |
| W-03 | `TORTILA_SIGNAL_WARNINGS` contains `code: 'tp_rejection_101211'` |
| W-04 | `TORTILA_SIGNAL_WARNINGS` contains `code: 'rate_limit_100410'` |
| W-05 | No warning code appears in `TORTILA_WARNINGS` that is not in `CANONICAL_WARNING_CODES` |
| W-06 | `getHealth()` (real HTTP adapter, any URL) always returns `status !== 'healthy'` regardless of `ok` response |

---

## Next actions

**Phase 2.4 Workstream B — for the implementer:**

1. Create `packages/bot-adapters/src/tortila/tortila.schemas.ts` using the exact Zod schemas from
   F-03, F-04, F-05, F-06. Add the length-mismatch refinement to `TortilaEquityCurveSchema`.
   Include the explicit comment on `net_pnl` vs `net_pnl_with_fees` (F-04 / R-04).

2. Create `packages/bot-adapters/src/__fixtures__/tortila/` with the 8 fixture files specified in F-08.
   No real equity/PnL values; use synthetic rounded numbers only. No exchange keys.

3. Implement the mapping functions in `packages/bot-adapters/src/tortila/tortila.mapping.ts`:
   - `healthToCanonical(raw: TortilaHealth): BotHealth` — with `TORTILA_PERSISTENT_WARNINGS` injected
   - `summaryToMetricsInput(raw: TortilaSummary): Partial<CanonicalMetricsInput>` — aggregate fallback only
   - `tradeRowToCanonical(row: TortilaTradeRow): CanonicalTrade` — with `fee = Math.abs(row.fees_pnl)`
   - `positionSummaryToCanonical(pos: TortilaPositionSummary): CanonicalPosition` — with `markPrice = avg_entry`, `unrealizedPnl = 0`
   - `equityCurveToPoints(curve: TortilaEquityCurve): EquityPoint[]` — with `filterZeroEquity` applied

4. Wire the mapping functions into `packages/bot-adapters/src/http.ts` `createHttpTortilaAdapter`:
   - `getMetrics`: call `/api/summary` + `/api/trades/list` (all pages); build `CanonicalMetricsInput`; call `computeMetrics`
   - `getPositions`: call `/api/summary` and extract `open_position_summaries`; map via `positionSummaryToCanonical`
   - `getTrades`: call `/api/trades/list` (page through all pages, page_size=500); map via `tradeRowToCanonical`
   - `getEquityCurve`: call `/api/equity`; map via `equityCurveToPoints`; apply `filterZeroEquity`
   - All methods must use `TortilaXxxSchema.safeParse()`; on failure throw `AdapterNotReadyError` with schema mismatch detail

5. Write unit tests in `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` covering all
   20 test cases (T-01 through T-20) and 6 warning assertions (W-01 through W-06) from the
   Verification section. All tests use fixture JSON only — no network.

6. Update `docs/CONTRACTS/tortila-adapter.md`: correct the field vocabulary drift (F-04/F-11 from
   Phase 2.3 handoff) to use `processAlive / status / 'healthy' | 'degraded' | 'stale' | 'down'`.
   Add the `qty === null` note for closed trades (R-01). Add the fees sign-inversion warning (R-02).

**Blocked until separately gated:**
- Do NOT call `/api/marks` from WTC under any mode — bot owns the exchange connection.
- Do NOT enable `BOT_ADAPTER_MODE=read-only` in any environment until the schema files, fixture
  files, mapping functions, and all T-01 through T-20 tests are written and passing.
- Do NOT add any live HTTP call in adapter tests; all tests are fixture-only.
- Legacy real adapter remains BLOCKED (plaintext-key issue unresolved — confirmed Phase 2.3 F-07).
- Control methods (`startBot`, `stopBot`, `applyConfig`) remain disabled / throwing
  `BotControlDisabledError` — no Phase 2.4 work should change this.
