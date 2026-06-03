import type { CanonicalPosition, CanonicalTrade, EquityPoint } from './metrics.ts';
import { filterZeroEquity } from './metrics.ts';

export interface PeriodReturn {
  label: string;
  returnPct: number | null;
  pnl: number | null;
}

export interface TradeQualityMetrics {
  closedTrades: number;
  scratches: number;
  avgHoldHours: number | null;
  tradesPerWeek: number | null;
  bestTradeNet: number | null;
  worstTradeNet: number | null;
  bestDayNet: number | null;
  worstDayNet: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

export interface RiskAdjustedMetrics {
  dailyVolatilityPct: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  recoveryFactor: number | null;
  longestUnderwaterDays: number | null;
}

export interface SymbolContribution {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  net: number;
  gross: number;
  fees: number;
  funding: number;
  winRatePct: number | null;
  profitFactor: number | null;
  avgHoldHours: number | null;
  contributionPct: number | null;
}

export interface DailyPnl {
  day: string;
  net: number;
  trades: number;
}

export interface DistributionBucket {
  label: string;
  count: number;
  net: number;
}

export interface OpenExposure {
  totalNotional: number;
  totalMargin: number;
  largestSymbol: string | null;
  largestNotional: number | null;
}

export interface AdvancedAnalytics {
  returns: PeriodReturn[];
  tradeQuality: TradeQualityMetrics;
  risk: RiskAdjustedMetrics;
  symbols: SymbolContribution[];
  dailyPnl: DailyPnl[];
  distribution: DistributionBucket[];
  exposure: OpenExposure;
}

function round(n: number, decimals = 2): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

function closedTrades(trades: CanonicalTrade[]): CanonicalTrade[] {
  return trades.filter((t) => t.closedAt !== null).sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0));
}

function netTrade(t: CanonicalTrade): number {
  return t.realizedPnl - t.fee + t.funding;
}

function holdHours(t: CanonicalTrade): number | null {
  if (typeof t.holdHours === 'number' && Number.isFinite(t.holdHours)) return t.holdHours;
  if (t.closedAt === null) return null;
  return Math.max(0, (t.closedAt - t.openedAt) / 3_600_000);
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function pct(from: number, to: number): number | null {
  if (!Number.isFinite(from) || from <= 0) return null;
  return round((to / from - 1) * 100);
}

function periodReturn(curve: EquityPoint[], label: string, startMs: number): PeriodReturn {
  const last = curve.at(-1);
  if (!last) return { label, returnPct: null, pnl: null };
  const start = curve.find((p) => p.t >= startMs) ?? curve[0] ?? null;
  if (!start || start.t > last.t) return { label, returnPct: null, pnl: null };
  return { label, returnPct: pct(start.equity, last.equity), pnl: round(last.equity - start.equity) };
}

function returnsMatrix(curve: EquityPoint[], now: number): PeriodReturn[] {
  const clean = filterZeroEquity(curve).sort((a, b) => a.t - b.t);
  const last = clean.at(-1);
  const ytdStart = Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  const startOfDay = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const rows = [
    periodReturn(clean, 'Today', startOfDay),
    periodReturn(clean, '7D', now - 7 * 86_400_000),
    periodReturn(clean, '30D', now - 30 * 86_400_000),
    periodReturn(clean, '90D', now - 90 * 86_400_000),
    periodReturn(clean, 'YTD', ytdStart),
  ];
  if (!last || clean.length === 0) return [...rows, { label: 'All-time', returnPct: null, pnl: null }];
  const first = clean[0]!;
  return [...rows, { label: 'All-time', returnPct: pct(first.equity, last.equity), pnl: round(last.equity - first.equity) }];
}

function dailyPnlRows(trades: CanonicalTrade[]): DailyPnl[] {
  const rows = new Map<string, DailyPnl>();
  for (const t of closedTrades(trades)) {
    const day = dayKey(t.closedAt ?? t.openedAt);
    const row = rows.get(day) ?? { day, net: 0, trades: 0 };
    row.net += netTrade(t);
    row.trades += 1;
    rows.set(day, row);
  }
  return [...rows.values()].map((r) => ({ ...r, net: round(r.net) })).sort((a, b) => a.day.localeCompare(b.day));
}

function maxStreak(trades: CanonicalTrade[], direction: 'win' | 'loss'): number {
  let best = 0;
  let cur = 0;
  for (const t of closedTrades(trades)) {
    const net = netTrade(t);
    const hit = direction === 'win' ? net > 0 : net < 0;
    cur = hit ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

function tradeQuality(trades: CanonicalTrade[], daily: DailyPnl[]): TradeQualityMetrics {
  const closed = closedTrades(trades);
  const nets = closed.map(netTrade);
  const holds = closed.map(holdHours).filter((n): n is number => n !== null);
  const firstTs = closed[0]?.closedAt ?? closed[0]?.openedAt ?? null;
  const lastTs = closed.at(-1)?.closedAt ?? closed.at(-1)?.openedAt ?? null;
  const weeks = firstTs !== null && lastTs !== null ? Math.max((lastTs - firstTs) / (7 * 86_400_000), 1 / 7) : null;
  const bestDay = daily.reduce<DailyPnl | null>((acc, row) => (!acc || row.net > acc.net ? row : acc), null);
  const worstDay = daily.reduce<DailyPnl | null>((acc, row) => (!acc || row.net < acc.net ? row : acc), null);
  return {
    closedTrades: closed.length,
    scratches: nets.filter((n) => n === 0).length,
    avgHoldHours: holds.length > 0 ? round(holds.reduce((s, n) => s + n, 0) / holds.length) : null,
    tradesPerWeek: weeks && closed.length > 0 ? round(closed.length / weeks) : null,
    bestTradeNet: nets.length > 0 ? round(Math.max(...nets)) : null,
    worstTradeNet: nets.length > 0 ? round(Math.min(...nets)) : null,
    bestDayNet: bestDay ? bestDay.net : null,
    worstDayNet: worstDay ? worstDay.net : null,
    maxConsecutiveWins: maxStreak(trades, 'win'),
    maxConsecutiveLosses: maxStreak(trades, 'loss'),
  };
}

function riskAdjusted(curve: EquityPoint[], daily: DailyPnl[]): RiskAdjustedMetrics {
  const clean = filterZeroEquity(curve).sort((a, b) => a.t - b.t);
  const returns = clean.slice(1).map((point, index) => {
    const prev = clean[index]!;
    return prev.equity > 0 ? (point.equity / prev.equity - 1) * 100 : 0;
  });
  const mean = returns.length > 0 ? returns.reduce((s, n) => s + n, 0) / returns.length : null;
  const variance = mean !== null && returns.length > 1
    ? returns.reduce((s, n) => s + (n - mean) ** 2, 0) / (returns.length - 1)
    : null;
  const vol = variance !== null ? Math.sqrt(variance) : null;
  const downside = mean !== null ? returns.filter((n) => n < 0) : [];
  const downsideDev = mean !== null && downside.length > 1
    ? Math.sqrt(downside.reduce((s, n) => s + (n - 0) ** 2, 0) / (downside.length - 1))
    : null;

  let peak = clean[0]?.equity ?? 0;
  let maxDdAbs = 0;
  let maxDdPct = 0;
  let underwaterStart: number | null = null;
  let longestUnderwaterMs = 0;
  for (const p of clean) {
    if (p.equity >= peak) {
      peak = p.equity;
      if (underwaterStart !== null) {
        longestUnderwaterMs = Math.max(longestUnderwaterMs, p.t - underwaterStart);
        underwaterStart = null;
      }
    } else if (underwaterStart === null) {
      underwaterStart = p.t;
    }
    const ddAbs = peak - p.equity;
    maxDdAbs = Math.max(maxDdAbs, ddAbs);
    maxDdPct = peak > 0 ? Math.max(maxDdPct, (ddAbs / peak) * 100) : maxDdPct;
  }
  if (underwaterStart !== null && clean.at(-1)) longestUnderwaterMs = Math.max(longestUnderwaterMs, clean.at(-1)!.t - underwaterStart);

  const totalPnl = daily.reduce((s, row) => s + row.net, 0);
  const annualizedReturn = mean !== null ? mean * 252 : null;
  return {
    dailyVolatilityPct: vol !== null ? round(vol) : null,
    sharpe: mean !== null && vol && vol > 0 ? round((mean / vol) * Math.sqrt(252)) : null,
    sortino: mean !== null && downsideDev && downsideDev > 0 ? round((mean / downsideDev) * Math.sqrt(252)) : null,
    calmar: annualizedReturn !== null && maxDdPct > 0 ? round(annualizedReturn / maxDdPct) : null,
    recoveryFactor: maxDdAbs > 0 ? round(totalPnl / maxDdAbs) : null,
    longestUnderwaterDays: longestUnderwaterMs > 0 ? round(longestUnderwaterMs / 86_400_000) : null,
  };
}

function symbolContributions(trades: CanonicalTrade[]): SymbolContribution[] {
  const closed = closedTrades(trades);
  const rows = new Map<string, SymbolContribution & { holdSum: number; holdCount: number }>();
  for (const t of closed) {
    const net = netTrade(t);
    const row = rows.get(t.symbol) ?? {
      symbol: t.symbol,
      trades: 0,
      wins: 0,
      losses: 0,
      net: 0,
      gross: 0,
      fees: 0,
      funding: 0,
      winRatePct: null,
      profitFactor: null,
      avgHoldHours: null,
      contributionPct: null,
      holdSum: 0,
      holdCount: 0,
    };
    row.trades += 1;
    row.wins += net > 0 ? 1 : 0;
    row.losses += net < 0 ? 1 : 0;
    row.net += net;
    row.gross += t.realizedPnl;
    row.fees += t.fee;
    row.funding += t.funding;
    const hold = holdHours(t);
    if (hold !== null) {
      row.holdSum += hold;
      row.holdCount += 1;
    }
    rows.set(t.symbol, row);
  }
  const totalAbs = [...rows.values()].reduce((s, r) => s + Math.abs(r.net), 0);
  return [...rows.values()].map((r) => {
    const wins = closed.filter((t) => t.symbol === r.symbol && netTrade(t) > 0).reduce((s, t) => s + netTrade(t), 0);
    const losses = Math.abs(closed.filter((t) => t.symbol === r.symbol && netTrade(t) < 0).reduce((s, t) => s + netTrade(t), 0));
    return {
      symbol: r.symbol,
      trades: r.trades,
      wins: r.wins,
      losses: r.losses,
      net: round(r.net),
      gross: round(r.gross),
      fees: round(r.fees),
      funding: round(r.funding),
      winRatePct: r.trades > 0 ? round((r.wins / r.trades) * 100) : null,
      profitFactor: r.trades === 0 ? null : losses === 0 ? (wins > 0 ? Number.POSITIVE_INFINITY : null) : round(wins / losses),
      avgHoldHours: r.holdCount > 0 ? round(r.holdSum / r.holdCount) : null,
      contributionPct: totalAbs > 0 ? round((Math.abs(r.net) / totalAbs) * 100) : null,
    };
  }).sort((a, b) => b.net - a.net);
}

function distribution(trades: CanonicalTrade[]): DistributionBucket[] {
  const buckets: DistributionBucket[] = [
    { label: '< -100', count: 0, net: 0 },
    { label: '-100..-25', count: 0, net: 0 },
    { label: '-25..0', count: 0, net: 0 },
    { label: '0..25', count: 0, net: 0 },
    { label: '25..100', count: 0, net: 0 },
    { label: '> 100', count: 0, net: 0 },
  ];
  for (const t of closedTrades(trades)) {
    const net = netTrade(t);
    const bucket = net < -100 ? buckets[0]!
      : net < -25 ? buckets[1]!
        : net < 0 ? buckets[2]!
          : net <= 25 ? buckets[3]!
            : net <= 100 ? buckets[4]!
              : buckets[5]!;
    bucket.count += 1;
    bucket.net += net;
  }
  return buckets.map((b) => ({ ...b, net: round(b.net) }));
}

function openExposure(positions: CanonicalPosition[]): OpenExposure {
  let largestSymbol: string | null = null;
  let largestNotional: number | null = null;
  let totalNotional = 0;
  let totalMargin = 0;
  for (const p of positions) {
    const notional = p.qty * p.markPrice;
    totalNotional += notional;
    totalMargin += p.marginUsed ?? 0;
    if (largestNotional === null || notional > largestNotional) {
      largestNotional = notional;
      largestSymbol = p.symbol;
    }
  }
  return {
    totalNotional: round(totalNotional),
    totalMargin: round(totalMargin),
    largestSymbol,
    largestNotional: largestNotional !== null ? round(largestNotional) : null,
  };
}

export function computeAdvancedAnalytics(input: {
  trades: CanonicalTrade[];
  positions: CanonicalPosition[];
  equityCurve: EquityPoint[];
  now?: number;
}): AdvancedAnalytics {
  const now = input.now ?? input.equityCurve.at(-1)?.t ?? input.trades.find((t) => t.closedAt !== null)?.closedAt ?? Date.now();
  const daily = dailyPnlRows(input.trades);
  return {
    returns: returnsMatrix(input.equityCurve, now),
    tradeQuality: tradeQuality(input.trades, daily),
    risk: riskAdjusted(input.equityCurve, daily),
    symbols: symbolContributions(input.trades),
    dailyPnl: daily,
    distribution: distribution(input.trades),
    exposure: openExposure(input.positions),
  };
}
