/**
 * Tortila journal → WTC canonical type mappings.
 *
 * Source audit: docs/handoffs/20260530-1355-ecosystem-tortila-journal-auditor.md (F-01 through F-07)
 * Canonical types: packages/analytics/src/metrics.ts
 *
 * KEY SIGN RULES (never deviate):
 *  1. fees_pnl (trade row) is stored NEGATIVE in the journal. Map to CanonicalTrade.fee as Math.abs(fees_pnl).
 *  2. fees_total (summary) is stored NEGATIVE (sum of negatives). Map to canonical feesTotal as Math.abs(fees_total).
 *  3. DO NOT use net_pnl for netPnlWithFees — use net_pnl_with_fees. (F-01/R-04)
 *  4. qty is ALWAYS null for closed trades (TradeRow has no total_qty field). Map as row.qty ?? 0.
 *  5. markPrice and unrealizedPnl are UNAVAILABLE from the journal without /api/marks.
 *     markPrice = avg_entry (safest available approximation).
 *     unrealizedPnl = 0 (flag in UI as "N/A — mark price unavailable; do not display as a real value").
 *
 * SAFETY: /api/marks must NEVER be called from WTC. The bot owns the exchange connection.
 */

import {
  filterZeroEquity,
  type CanonicalTrade,
  type CanonicalPosition,
  type EquityPoint,
} from '@wtc/analytics';
import type { BotHealth } from '../types.ts';
import { TORTILA_PERSISTENT_WARNINGS } from '../warnings.ts';
import type { TortilaHealth, TortilaSummary, TortilaTradeRow, TortilaPositionSummary, TortilaEquityCurve } from './tortila.schemas.ts';

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Map TortilaHealth → BotHealth.
 *
 * status is ALWAYS 'degraded' — P0/P1 unresolved issues (tp_reconcile_p0, margin_preflight_p1)
 * prevent reporting 'healthy' regardless of whether the process is alive.
 * TORTILA_PERSISTENT_WARNINGS is injected unconditionally.
 */
export function healthToCanonical(raw: TortilaHealth): BotHealth {
  return {
    productCode: 'tortila_bot',
    processAlive: raw.ok,
    // status is always 'degraded': P0/P1 remain unresolved until journal reports resolution.
    status: 'degraded',
    // A successfully parsed health body is a reachable, well-formed read. The caller (getHealth)
    // overrides this to 'stale' when the journal ts is older than ADAPTER_STALE_THRESHOLD_MS.
    readState: 'ok',
    lastSyncAt: raw.ok ? Date.now() : null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: TORTILA_PERSISTENT_WARNINGS,
  };
}

// ---------------------------------------------------------------------------
// Summary → partial metrics input (aggregate fallback; prefer computeMetrics with trades)
// ---------------------------------------------------------------------------

/**
 * Map TortilaSummary aggregate fields to a partial canonical metrics-input shape.
 *
 * SIGN RULES:
 *  - feesTotal = Math.abs(fees_total)  — fees_total is stored NEGATIVE (sum of costs).
 *  - winRatePct = null when trades_total === 0  — journal returns 0.0 for empty; canonical is null.
 *  - net_pnl is never used here; use net_pnl_with_fees for the true bottom line.
 */
export function summaryToMetricsInput(raw: TortilaSummary): {
  walletEquity: number;
  firstEquity: number;
  /** feesTotal in canonical positive-cost convention = Math.abs(fees_total) */
  feesTotal: number;
  fundingTotal: number;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  winCount: number;
  lossCount: number;
  /** null when trades_total === 0; do not return 0 (misleading) */
  winRatePct: number | null;
  openPositions: number;
  /** The real bottom line: net_pnl_with_fees (NOT net_pnl). */
  netPnlWithFees: number;
} {
  // DO NOT use net_pnl for netPnlWithFees — use net_pnl_with_fees (F-01/R-04).
  const netPnlWithFees = raw.net_pnl_with_fees;

  // fees_total is stored NEGATIVE in the journal (sum of fees_pnl, each a cost).
  // Canonical feesTotal is a positive cost magnitude (F-10).
  const feesTotal = Math.abs(raw.fees_total);

  // win_rate_pct is 0.0 when no trades; canonical must be null for zero-trade state (F-09).
  const winRatePct = raw.trades_total === 0 ? null : raw.win_rate_pct;

  return {
    walletEquity: raw.last_equity,
    firstEquity: raw.first_equity,
    feesTotal,
    fundingTotal: raw.funding_total,
    maxDrawdownPct: raw.max_dd_pct,
    currentDrawdownPct: raw.current_dd_pct,
    winCount: raw.wins,
    lossCount: raw.losses,
    winRatePct,
    openPositions: raw.open_positions,
    netPnlWithFees,
  };
}

// ---------------------------------------------------------------------------
// Trade row
// ---------------------------------------------------------------------------

/**
 * Map TortilaTradeRow → CanonicalTrade.
 *
 * SIGN RULE: fee = Math.abs(row.fees_pnl).
 *   fees_pnl is stored NEGATIVE (cost). CanonicalTrade.fee is a POSITIVE cost (metrics.ts:17).
 *   If sign inversion is missed, netPnlWithFees will be overstated (fees look like income).
 *
 * qty NOTE: qty is ALWAYS null from serialize_trade for TradeRow (no total_qty field on TradeRow).
 *   getattr(t, 'total_qty', None) always returns None. Map as row.qty ?? 0.
 *
 * realizedPnl: maps from gross_pnl (realized_pnl before fees/funding — correct canonical semantic).
 */
export function tradeRowToCanonical(row: TortilaTradeRow): CanonicalTrade {
  return {
    id: String(row.id),
    symbol: row.symbol,
    side: row.side,
    // qty is always null for closed trades from this endpoint (TradeRow has no total_qty field).
    qty: row.qty ?? 0,
    entryPrice: row.entry,
    exitPrice: row.exit,
    // gross_pnl = realized_pnl (before fees/funding). Canonical realizedPnl = GROSS (metrics.ts:16).
    realizedPnl: row.gross_pnl,
    // fees_pnl is NEGATIVE; canonical fee is a POSITIVE cost. Invert sign.
    fee: Math.abs(row.fees_pnl),
    funding: row.funding_pnl,
    openedAt: new Date(row.opened_at).getTime(),
    closedAt: new Date(row.closed_at).getTime(),
    holdHours: row.hold_hours,
    exitReason: row.exit_reason,
    retPct: row.ret_pct,
  };
}

// ---------------------------------------------------------------------------
// Position summary
// ---------------------------------------------------------------------------

/**
 * Map TortilaPositionSummary → CanonicalPosition.
 *
 * UNAVAILABILITY NOTES (F-07):
 *  - markPrice: set to avg_entry (best available approximation without /api/marks).
 *    UI must show "N/A" when markPrice === entryPrice (detect the approximation).
 *  - unrealizedPnl: set to 0. UI must NOT display this as "0 USDT" — show "N/A (mark price unavailable)".
 *  - marginUsed: not in journal; omitted (optional field).
 *  - tpPrice: journal only exposes has_tp (bool derived from current_tp_order_id); TP price unavailable.
 *
 * SAFETY: DO NOT add a call to /api/marks to obtain markPrice. The bot owns that connection.
 */
export function positionSummaryToCanonical(pos: TortilaPositionSummary): CanonicalPosition {
  return {
    symbol: pos.symbol,
    side: pos.side,
    qty: pos.total_qty,
    entryPrice: pos.avg_entry,
    // markPrice is NOT available without /api/marks (which WTC must not call).
    // Use avg_entry as the safest approximation. UI must show "N/A" for unrealized PnL.
    markPrice: pos.avg_entry,
    // unrealizedPnl is unavailable without a real-time mark price. Set to 0.
    // UI must display "N/A (mark price unavailable)" — NEVER show this as a real 0 USDT value.
    unrealizedPnl: 0,
    // marginUsed not available from journal; omit.
    stopPrice: pos.stop,
    stopDistPct: pos.stop_dist_pct,
    hasTp: pos.has_tp,
    // tpPrice not available from journal (journal only exposes has_tp flag).
    tpPrice: undefined,
    openedAt: new Date(pos.opened_at).getTime(),
    units: pos.units,
  };
}

// ---------------------------------------------------------------------------
// Equity curve
// ---------------------------------------------------------------------------

/**
 * Map TortilaEquityCurve → EquityPoint[].
 *
 * ts and equity are parallel arrays. Always apply filterZeroEquity (GAP-F / D-05):
 *  - The journal already zero-filters server-side, but we apply again as defence-in-depth.
 *  - An artifact zero-row would fabricate a ~100% drawdown in computeDrawdown.
 *
 * NaN guard: if new Date(isoStr).getTime() returns NaN (malformed ISO string), the point is dropped.
 */
export function equityCurveToPoints(curve: TortilaEquityCurve): EquityPoint[] {
  const raw: EquityPoint[] = curve.ts.map((isoStr, i) => ({
    t: new Date(isoStr).getTime(), // epoch ms
    equity: curve.equity[i]!,
  }));
  // Drop any NaN timestamps (malformed ISO strings).
  const validTs = raw.filter((p) => !isNaN(p.t));
  // GAP-F: drop zero/negative equity placeholder rows (defence-in-depth even though source already filters).
  return filterZeroEquity(validTs);
}
