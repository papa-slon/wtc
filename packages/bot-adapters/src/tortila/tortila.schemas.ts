/**
 * Zod runtime-validation schemas for the Tortila journal HTTP API.
 *
 * Derived from a read-only audit of the local journal source:
 *   bot_tortila/src/turtle_bot/journal/app.py (lines 250–622)
 *   bot_tortila/src/turtle_bot/journal/metrics.py (serialize_trade, lines 578–602)
 *   bot_tortila/src/turtle_bot/state/models.py (TradeRow, PositionRow)
 *   bot_tortila/src/turtle_bot/state/store.py (SQLite schema, lines 1–155)
 *
 * See: docs/handoffs/20260530-1355-ecosystem-tortila-journal-auditor.md (F-03 through F-07)
 * and: docs/CONTRACTS/tortila-adapter.md
 *
 * SAFETY: DO NOT call /api/marks from WTC — bot owns the exchange connection.
 *         NEVER import a live BingX client here.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// /api/health  (app.py:572–574)
// ---------------------------------------------------------------------------

export const TortilaHealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string(), // ISO 8601 with timezone offset, e.g. "2026-05-30T13:55:00+00:00"
});
export type TortilaHealth = z.infer<typeof TortilaHealthSchema>;

// ---------------------------------------------------------------------------
// /api/summary — open_position_summaries items  (app.py:283–311)
// ---------------------------------------------------------------------------

export const TortilaPositionSummarySchema = z.object({
  symbol: z.string(),
  side: z.enum(['long', 'short']),
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
export type TortilaPositionSummary = z.infer<typeof TortilaPositionSummarySchema>;

// ---------------------------------------------------------------------------
// /api/summary  (app.py:577–622)
//
// CRITICAL: DO NOT use net_pnl for netPnlWithFees — use net_pnl_with_fees.
//   net_pnl     = sum(realized_pnl + funding_pnl)           — GROSS+funding, NO fees (app.py:602)
//   net_pnl_with_fees = sum(realized+funding+fees_pnl)       — true net bottom line (app.py:609)
//   fees_total  = sum(fees_pnl) — stored NEGATIVE (cost); apply Math.abs() to get canonical feesTotal
// ---------------------------------------------------------------------------

export const TortilaSummarySchema = z.object({
  now: z.string(),
  trades_total: z.number().int().nonnegative(),
  open_positions: z.number().int().nonnegative(),
  /** realized+funding ONLY — DO NOT use for netPnlWithFees; use net_pnl_with_fees instead */
  net_pnl: z.number(),
  /** realized+funding+fees_pnl — USE this for netPnlWithFees (canonical bottom line) */
  net_pnl_with_fees: z.number(),
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
  /** Sum of fees_pnl — stored NEGATIVE (cost); apply Math.abs() when mapping to canonical feesTotal */
  fees_total: z.number(),
  funding_total: z.number(),             // sum of FundingRow.amount — signed
  start_date: z.string().nullable(),     // isoformat of first equity or first trade; null when no data
  mode: z.enum(['demo', 'live']),
  open_position_summaries: z.array(TortilaPositionSummarySchema),
});
export type TortilaSummary = z.infer<typeof TortilaSummarySchema>;

// ---------------------------------------------------------------------------
// /api/trades/list — preferred paginated endpoint (app.py:775–806)
// Each row serialised via metrics.serialize_trade (metrics.py:578–602)
//
// PREFER /api/trades/list (has fees_pnl) over /api/trades (omits fees_pnl).
// See: docs/handoffs/20260530-1355-ecosystem-tortila-journal-auditor.md (F-05, F-12)
// ---------------------------------------------------------------------------

export const TortilaTradeRowSchema = z.object({
  id: z.number().int(),
  symbol: z.string(),
  side: z.enum(['long', 'short']),
  units: z.number().int(),
  /**
   * qty is ALWAYS null for closed trades from this endpoint.
   * metrics.py:589 uses getattr(t, 'total_qty', None) but TradeRow has no total_qty field
   * (only PositionRow does). Map to CanonicalTrade.qty as: row.qty ?? 0
   */
  qty: z.number().nullable(),
  entry: z.number(),                     // float(t.avg_entry)
  exit: z.number(),                      // float(t.exit_price) — REAL NOT NULL in SQLite; never null
  gross_pnl: z.number(),                 // float(t.realized_pnl) — gross, before fees/funding
  /**
   * fees_pnl is NEGATIVE (stored as a cost per models.py:73).
   * Map to CanonicalTrade.fee as: Math.abs(row.fees_pnl)
   * DO NOT use net_pnl for netPnlWithFees — use net_pnl_with_fees instead.
   */
  fees_pnl: z.number(),
  funding_pnl: z.number(),               // float(t.funding_pnl) — signed
  net_pnl: z.number(),                   // _trade_net(t) = realized+funding+fees
  opened_at: z.string(),
  closed_at: z.string(),
  hold_hours: z.number(),
  exit_reason: z.string(),               // "stop"|"exit_signal"|"manual"|"adopted_close"|"take_profit"
  ret_pct: z.number(),                   // (exit/entry - 1)*100*direction; 0 when avg_entry <= 0
});
export type TortilaTradeRow = z.infer<typeof TortilaTradeRowSchema>;

export const TortilaTradeListSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  page_size: z.number().int(),
  pages: z.number().int().nonnegative(),
  rows: z.array(TortilaTradeRowSchema),
});
export type TortilaTradeList = z.infer<typeof TortilaTradeListSchema>;

// ---------------------------------------------------------------------------
// /api/equity  (app.py:626–633, _equity_curve:187–197)
//
// ts and equity are parallel arrays of equal length.
// Source already zero-filters (via _valid_equity_rows at app.py:153–154), but the adapter must
// also apply filterZeroEquity as a defence-in-depth guard (GAP-F).
//
// Refinement: reject when ts.length !== equity.length (length-mismatch = schema failure).
// ---------------------------------------------------------------------------

export const TortilaEquityCurveSchema = z
  .object({
    ts: z.array(z.string()),       // ISO 8601 strings; parallel array with equity
    equity: z.array(z.number()),   // wallet equity values; same length as ts; all > 0 (zero-filtered)
  })
  .refine((v) => v.ts.length === v.equity.length, {
    message: 'ts and equity arrays must have the same length',
    path: ['equity'],
  });
export type TortilaEquityCurve = z.infer<typeof TortilaEquityCurveSchema>;
