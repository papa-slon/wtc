import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  filterZeroEquity,
  combineMetrics,
  mergedProfitFactor,
  isDataStale,
  type CanonicalTrade,
  type CanonicalPosition,
  type EquityPoint,
} from './metrics.ts';

const trade = (over: Partial<CanonicalTrade>): CanonicalTrade => ({
  id: 'x', symbol: 'BTC', side: 'long', qty: 1, realizedPnl: 0, fee: 0, funding: 0, openedAt: 0, closedAt: 1, ...over,
});

describe('GAP-F — zero-equity placeholder rows never fabricate a drawdown', () => {
  it('drops equity<=0 points before computing drawdown', () => {
    // A trailing artifact 0-row would, unfiltered, produce a false ~100% drawdown.
    const curve: EquityPoint[] = [{ t: 1, equity: 1000 }, { t: 2, equity: 1100 }, { t: 3, equity: 0 }];
    const m = computeMetrics({ trades: [], positions: [], equityCurve: curve, walletEquity: 1100 });
    expect(m.maxDrawdownPct).toBe(0);
    expect(m.currentDrawdownPct).toBe(0);
    expect(m.peakEquity).toBe(1100);
  });

  it('filterZeroEquity removes only non-positive points', () => {
    expect(filterZeroEquity([{ t: 1, equity: 0 }, { t: 2, equity: 5 }, { t: 3, equity: -3 }])).toEqual([{ t: 2, equity: 5 }]);
  });

  it('still reports a real drawdown when equity genuinely falls', () => {
    const curve: EquityPoint[] = [{ t: 1, equity: 1000 }, { t: 2, equity: 1200 }, { t: 3, equity: 900 }];
    const m = computeMetrics({ trades: [], positions: [], equityCurve: curve, walletEquity: 900 });
    expect(m.maxDrawdownPct).toBe(25); // 1200 -> 900
  });
});

describe('GAP-A — netPnlWithFees never overstates the bottom line', () => {
  it('subtracts fees (positive cost) and adds signed funding', () => {
    const m = computeMetrics({
      trades: [trade({ realizedPnl: 100, fee: 2, funding: 0.5 })],
      positions: [], equityCurve: [], walletEquity: 0,
    });
    expect(m.closedPnl).toBe(100);
    expect(m.netPnlWithFees).toBe(98.5); // 100 - 2 + 0.5
    expect(m.netPnlWithFees).toBeLessThan(m.closedPnl);
  });
});

describe('GAP-B — ROI since start', () => {
  it('is null when firstEquity is unknown', () => {
    const m = computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 1100 });
    expect(m.firstEquity).toBeNull();
    expect(m.roiPctSinceStart).toBeNull();
  });
  it('computes (wallet/first - 1) * 100 when firstEquity is provided', () => {
    const m = computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 1100, firstEquity: 1000 });
    expect(m.roiPctSinceStart).toBe(10);
  });
});

describe('GAP-C — averages and expectancy', () => {
  it('computes avgWin, avgLoss and expectancy from closed trades', () => {
    const m = computeMetrics({
      trades: [trade({ realizedPnl: 100 }), trade({ realizedPnl: -40 }), trade({ realizedPnl: 60 })],
      positions: [], equityCurve: [], walletEquity: 0,
    });
    expect(m.avgWin).toBe(80); // (100+60)/2
    expect(m.avgLoss).toBe(-40);
    expect(m.expectancy).toBe(40); // 0.6667*80 + 0.3333*-40
  });
  it('returns null averages when there are no closed trades', () => {
    const m = computeMetrics({ trades: [trade({ closedAt: null })], positions: [], equityCurve: [], walletEquity: 0 });
    expect(m.avgWin).toBeNull();
    expect(m.avgLoss).toBeNull();
    expect(m.expectancy).toBeNull();
  });
});

describe('GAP-D — safety event count is a named metric', () => {
  it('echoes the provided count, defaulting to 0', () => {
    expect(computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 0 }).safetyEventCount).toBe(0);
    expect(computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 0, safetyEventCount: 3 }).safetyEventCount).toBe(3);
  });
});

describe('GAP-E — cross-bot aggregation', () => {
  const tortila = computeMetrics({
    trades: [trade({ realizedPnl: 100 })], positions: [], equityCurve: [], walletEquity: 1000,
  });
  const legacy = computeMetrics({
    trades: [], positions: [{ symbol: 'BTC', side: 'long', qty: 1, entryPrice: 1, markPrice: 1, unrealizedPnl: 0 } as CanonicalPosition],
    equityCurve: [], walletEquity: 500,
  });

  it('combines wallet equity and open positions, never averages win rate / PF', () => {
    const c = combineMetrics(tortila, legacy);
    expect(c.totalWalletEquity).toBe(1500);
    expect(c.totalOpenPositions).toBe(1);
    expect(c.netPnlWithFeesTortila).toBe(100);
    expect(c).not.toHaveProperty('winRatePct');
  });
  it('handles one or both bots being null', () => {
    expect(combineMetrics(tortila, null).totalWalletEquity).toBe(1000);
    expect(combineMetrics(null, null).totalWalletEquity).toBeNull();
    expect(combineMetrics(null, null).totalOpenPositions).toBe(0);
  });

  it('mergedProfitFactor over a combined trade list', () => {
    expect(mergedProfitFactor([trade({ realizedPnl: 100 }), trade({ realizedPnl: -40 }), trade({ realizedPnl: 60 })])).toBe(4);
    expect(mergedProfitFactor([])).toBeNull();
    expect(mergedProfitFactor([trade({ realizedPnl: 10 })])).toBe(Number.POSITIVE_INFINITY);
  });

  it('isDataStale respects the threshold and treats null as stale (deterministic now)', () => {
    const now = 1_000_000;
    expect(isDataStale(now - 700_000, 600_000, now)).toBe(true);
    expect(isDataStale(now - 100_000, 600_000, now)).toBe(false);
    expect(isDataStale(now - 600_000, 600_000, now)).toBe(false); // exactly at threshold is not stale
    expect(isDataStale(null, 600_000, now)).toBe(true);
  });
});
