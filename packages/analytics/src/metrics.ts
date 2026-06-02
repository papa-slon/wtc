/**
 * @wtc/analytics — canonical, bot-agnostic metric model. See docs/CANONICAL_ANALYTICS_MODEL.md.
 *
 * Strictly distinguishes: closed (realized) PnL, unrealized PnL, wallet equity, ROI on margin,
 * current drawdown, and max drawdown from peak. Metrics that have no data return `null` (the UI
 * shows "—", never a misleading 0). Zero dependencies (smoke-testable with `node`).
 */

export type Side = 'long' | 'short';

export interface CanonicalTrade {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  entryPrice?: number;
  exitPrice?: number;
  realizedPnl: number; // GROSS realized PnL for a CLOSED trade (quote currency; before fee/funding)
  fee: number; // trading fee, stored as a POSITIVE cost
  funding: number; // funding payment, signed (positive = received, negative = paid)
  openedAt: number; // epoch ms
  closedAt: number | null; // null => still open
  // --- additive (optional; GAP-H) — trade-quality fields for the trades sub-page ---
  holdHours?: number;
  exitReason?: string; // 'stop' | 'take_profit' | 'exit_signal' | 'manual' | ...
  retPct?: number; // percentage return on the trade
}

export interface CanonicalPosition {
  symbol: string;
  side: Side;
  qty: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  marginUsed?: number;
  // --- additive (optional; GAP-G) — stop/TP/open-time for the positions sub-page and the
  // "stop bot ≠ close positions" confirmation. Tortila-specific; absent on Legacy. ---
  stopPrice?: number | null;
  stopDistPct?: number | null;
  hasTp?: boolean;
  tpPrice?: number | null;
  openedAt?: number | null; // epoch ms
  units?: number; // Tortila pyramid unit count
  stage?: number; // Legacy slot stage
}

export interface EquityPoint {
  t: number; // epoch ms
  equity: number; // wallet equity at t
}

export interface CanonicalMetricsInput {
  trades: CanonicalTrade[];
  positions: CanonicalPosition[];
  equityCurve: EquityPoint[];
  /** current wallet equity (authoritative; not inferred) */
  walletEquity: number;
  /** optional margin base for ROI; defaults to summed open marginUsed */
  marginBase?: number;
  /** first non-zero equity snapshot, for ROI-since-start; null/undefined => not available (GAP-B) */
  firstEquity?: number | null;
  /** count of active warning/error safety events; surfaced as a named metric (GAP-D) */
  safetyEventCount?: number;
}

export interface CanonicalMetrics {
  closedPnl: number;
  unrealizedPnl: number;
  walletEquity: number;
  /** closedPnl / marginBase * 100, or null when no margin base */
  roiOnMarginPct: number | null;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  /** wins / closed trades, or null when no closed trades */
  winRatePct: number | null;
  grossProfit: number;
  grossLoss: number; // positive magnitude of losing trades
  /** grossProfit / grossLoss; Infinity when no losses but profit exists; null when no closed trades */
  profitFactor: number | null;
  feesTotal: number;
  fundingTotal: number;
  /** capital at risk = sum of open position margin (when known) */
  openRisk: number;
  openPositions: number;
  peakEquity: number | null;
  maxDrawdownPct: number | null;
  maxDrawdownAbs: number | null;
  currentDrawdownPct: number | null;
  // --- additive (always computed) ---
  /** closed PnL net of fees and funding = closedPnl - feesTotal + fundingTotal (GAP-A).
   *  fee is a positive cost (subtracted); funding is signed (added). Never overstate the bottom line. */
  netPnlWithFees: number;
  /** first non-zero equity snapshot echoed back, or null when unknown (GAP-B) */
  firstEquity: number | null;
  /** (walletEquity / firstEquity - 1) * 100, or null when no firstEquity (GAP-B) */
  roiPctSinceStart: number | null;
  /** mean realizedPnl of winning closed trades, or null when none (GAP-C) */
  avgWin: number | null;
  /** mean realizedPnl of losing closed trades (negative), or null when none (GAP-C) */
  avgLoss: number | null;
  /** (winRate * avgWin) + ((1 - winRate) * avgLoss), or null when no closed trades (GAP-C) */
  expectancy: number | null;
  /** count of active warning/error safety events; 0 is valid (GAP-D) */
  safetyEventCount: number;
}

export interface DrawdownResult {
  peak: number | null;
  maxDrawdownPct: number | null;
  maxDrawdownAbs: number | null;
  currentDrawdownPct: number | null;
}

/** Max drawdown from running peak over an equity curve. Returns nulls for an empty curve. */
export function computeDrawdown(curve: EquityPoint[]): DrawdownResult {
  if (curve.length === 0) return { peak: null, maxDrawdownPct: null, maxDrawdownAbs: null, currentDrawdownPct: null };
  let runningPeak = curve[0]!.equity;
  let maxDdAbs = 0;
  let maxDdPct = 0;
  for (const p of curve) {
    if (p.equity > runningPeak) runningPeak = p.equity;
    const ddAbs = runningPeak - p.equity;
    if (ddAbs > maxDdAbs) maxDdAbs = ddAbs;
    if (runningPeak > 0) {
      const ddPct = (ddAbs / runningPeak) * 100;
      if (ddPct > maxDdPct) maxDdPct = ddPct;
    }
  }
  const last = curve[curve.length - 1]!.equity;
  const overallPeak = curve.reduce((m, p) => Math.max(m, p.equity), curve[0]!.equity);
  const currentDdPct = overallPeak > 0 ? ((overallPeak - last) / overallPeak) * 100 : 0;
  return {
    peak: overallPeak,
    maxDrawdownPct: round2(maxDdPct),
    maxDrawdownAbs: round2(maxDdAbs),
    currentDrawdownPct: round2(currentDdPct),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compute the canonical metric set from canonical inputs. Pure & deterministic. */
export function computeMetrics(input: CanonicalMetricsInput): CanonicalMetrics {
  const closed = input.trades.filter((t) => t.closedAt !== null);

  let closedPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let feesTotal = 0;
  let fundingTotal = 0;

  for (const t of input.trades) {
    feesTotal += t.fee;
    fundingTotal += t.funding;
  }
  for (const t of closed) {
    closedPnl += t.realizedPnl;
    if (t.realizedPnl > 0) {
      grossProfit += t.realizedPnl;
      winCount += 1;
    } else if (t.realizedPnl < 0) {
      grossLoss += Math.abs(t.realizedPnl);
      lossCount += 1;
    }
  }

  const unrealizedPnl = input.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openMargin = input.positions.reduce((s, p) => s + (p.marginUsed ?? 0), 0);
  const marginBase = input.marginBase ?? (openMargin > 0 ? openMargin : undefined);

  const winRatePct = closed.length > 0 ? round2((winCount / closed.length) * 100) : null;
  const profitFactor =
    closed.length === 0 ? null : grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : null) : round2(grossProfit / grossLoss);
  const roiOnMarginPct = marginBase && marginBase > 0 ? round2((closedPnl / marginBase) * 100) : null;

  // GAP-A: closed PnL net of fees (positive cost) and funding (signed). Prevents showing gross PnL
  // as the bottom line. NOTE: this intentionally SUBTRACTS feesTotal (the bot-integration handoff's
  // literal `closedPnl + feesTotal` assumed fees stored negative; our convention stores fees positive).
  const netPnlWithFees = round2(closedPnl - feesTotal + fundingTotal);

  // GAP-C: per-trade averages and expectancy.
  const avgWin = winCount > 0 ? round2(grossProfit / winCount) : null;
  const avgLoss = lossCount > 0 ? round2(-grossLoss / lossCount) : null;
  const expectancy =
    winRatePct !== null && avgWin !== null && avgLoss !== null
      ? round2((winRatePct / 100) * avgWin + (1 - winRatePct / 100) * avgLoss)
      : null;

  // GAP-B: ROI since the first non-zero equity snapshot (long-term return).
  const firstEquity = input.firstEquity ?? null;
  const roiPctSinceStart =
    firstEquity && firstEquity > 0 ? round2((input.walletEquity / firstEquity - 1) * 100) : null;

  // GAP-F (P0): drop zero/negative equity placeholder rows BEFORE drawdown, so an artifact 0-row
  // cannot fabricate a ~100% drawdown.
  const dd = computeDrawdown(filterZeroEquity(input.equityCurve));

  return {
    closedPnl: round2(closedPnl),
    unrealizedPnl: round2(unrealizedPnl),
    walletEquity: round2(input.walletEquity),
    roiOnMarginPct,
    tradeCount: closed.length,
    winCount,
    lossCount,
    winRatePct,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    profitFactor,
    feesTotal: round2(feesTotal),
    fundingTotal: round2(fundingTotal),
    openRisk: round2(openMargin),
    openPositions: input.positions.length,
    peakEquity: dd.peak,
    maxDrawdownPct: dd.maxDrawdownPct,
    maxDrawdownAbs: dd.maxDrawdownAbs,
    currentDrawdownPct: dd.currentDrawdownPct,
    netPnlWithFees,
    firstEquity,
    roiPctSinceStart,
    avgWin,
    avgLoss,
    expectancy,
    safetyEventCount: input.safetyEventCount ?? 0,
  };
}

/** GAP-F: drop equity points at or below zero (artifact/placeholder rows). Pure. */
export function filterZeroEquity(curve: EquityPoint[]): EquityPoint[] {
  return curve.filter((p) => p.equity > 0);
}

export interface CombinedMetrics {
  /** sum of wallet equity where at least one bot has data; null when both are null */
  totalWalletEquity: number | null;
  tortila: CanonicalMetrics | null;
  legacy: CanonicalMetrics | null;
  totalOpenPositions: number;
  /** Tortila contributes net PnL; Legacy contributes null (no closed-trade history) */
  netPnlWithFeesTortila: number | null;
  // Win rate / profit factor are deliberately NOT averaged across bots — show per-bot, never combined.
}

/** GAP-E: combine two per-bot metric sets for the unified bots view. Never averages win rate / PF. */
export function combineMetrics(
  tortila: CanonicalMetrics | null,
  legacy: CanonicalMetrics | null,
): CombinedMetrics {
  const totalWalletEquity =
    tortila !== null || legacy !== null ? round2((tortila?.walletEquity ?? 0) + (legacy?.walletEquity ?? 0)) : null;
  return {
    totalWalletEquity,
    tortila,
    legacy,
    totalOpenPositions: (tortila?.openPositions ?? 0) + (legacy?.openPositions ?? 0),
    netPnlWithFeesTortila: tortila?.netPnlWithFees ?? null,
  };
}

/** GAP-E: profit factor over a merged trade list (e.g. combined bots). */
export function mergedProfitFactor(trades: CanonicalTrade[]): number | null {
  const closed = trades.filter((t) => t.closedAt !== null);
  if (closed.length === 0) return null;
  const grossP = closed.filter((t) => t.realizedPnl > 0).reduce((s, t) => s + t.realizedPnl, 0);
  const grossL = closed.filter((t) => t.realizedPnl < 0).reduce((s, t) => s + Math.abs(t.realizedPnl), 0);
  if (grossL === 0) return grossP > 0 ? Number.POSITIVE_INFINITY : null;
  return round2(grossP / grossL);
}

/** GAP-E: is the last sync older than the threshold? `now` is injectable for deterministic tests. */
export function isDataStale(lastSyncAt: number | null, thresholdMs = 600_000, now: number = Date.now()): boolean {
  if (lastSyncAt === null) return true;
  return now - lastSyncAt > thresholdMs;
}
