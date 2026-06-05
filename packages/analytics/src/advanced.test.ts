import { describe, expect, it } from 'vitest';
import { computeAdvancedAnalytics, type CanonicalTrade, type EquityPoint } from './index.ts';

const trade = (over: Partial<CanonicalTrade>): CanonicalTrade => ({
  id: 'x',
  symbol: 'BTC',
  side: 'long',
  qty: 1,
  realizedPnl: 0,
  fee: 0,
  funding: 0,
  openedAt: Date.UTC(2026, 0, 1),
  closedAt: Date.UTC(2026, 0, 1, 1),
  ...over,
});

describe('advanced bot analytics', () => {
  it('computes trade quality, symbol contribution, daily PnL and distribution from closed trades', () => {
    const trades = [
      trade({ id: '1', symbol: 'BTC', realizedPnl: 120, fee: 2, funding: 1, closedAt: Date.UTC(2026, 0, 1, 1) }),
      trade({ id: '2', symbol: 'BTC', realizedPnl: -40, fee: 1, funding: 0, closedAt: Date.UTC(2026, 0, 2, 1) }),
      trade({ id: '3', symbol: 'ETH', realizedPnl: 15, fee: 0.5, funding: 0, closedAt: Date.UTC(2026, 0, 2, 2) }),
    ];
    const out = computeAdvancedAnalytics({ trades, positions: [], equityCurve: [], now: Date.UTC(2026, 0, 3) });
    expect(out.tradeQuality.closedTrades).toBe(3);
    expect(out.tradeQuality.bestTradeNet).toBe(119);
    expect(out.tradeQuality.worstTradeNet).toBe(-41);
    expect(out.tradeQuality.maxConsecutiveWins).toBe(1);
    expect(out.tradeQuality.maxConsecutiveLosses).toBe(1);
    expect(out.dailyPnl).toEqual([
      { day: '2026-01-01', net: 119, trades: 1 },
      { day: '2026-01-02', net: -26.5, trades: 2 },
    ]);
    expect(out.symbols[0]!.symbol).toBe('BTC');
    expect(out.symbols[0]!.profitFactor).toBeCloseTo(2.9, 1);
    expect(out.distribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
  });

  it('computes period returns and risk ratios from non-zero equity points', () => {
    const curve: EquityPoint[] = [
      { t: Date.UTC(2026, 0, 1), equity: 1000 },
      { t: Date.UTC(2026, 0, 2), equity: 1100 },
      { t: Date.UTC(2026, 0, 3), equity: 1050 },
      { t: Date.UTC(2026, 0, 4), equity: 1200 },
      { t: Date.UTC(2026, 0, 5), equity: 0 },
    ];
    const out = computeAdvancedAnalytics({ trades: [], positions: [], equityCurve: curve, now: Date.UTC(2026, 0, 5) });
    expect(out.returns.find((row) => row.label === 'All-time')!.returnPct).toBe(20);
    expect(out.risk.dailyVolatilityPct).not.toBeNull();
    expect(out.risk.longestUnderwaterDays).toBe(1);
  });

  it('summarizes open exposure without needing closed-trade history', () => {
    const out = computeAdvancedAnalytics({
      trades: [],
      equityCurve: [],
      positions: [
        { symbol: 'TAO-USDT', side: 'long', qty: 2, entryPrice: 100, markPrice: 120, unrealizedPnl: 40, marginUsed: 50 },
        { symbol: 'BCH-USDT', side: 'long', qty: 1, entryPrice: 80, markPrice: 90, unrealizedPnl: 10, marginUsed: 20 },
      ],
    });
    expect(out.exposure.totalNotional).toBe(330);
    expect(out.exposure.totalMargin).toBe(70);
    expect(out.exposure.largestSymbol).toBe('TAO-USDT');
  });
});
