import assert from 'node:assert/strict';
import { computeMetrics, computeDrawdown, type CanonicalTrade, type CanonicalPosition, type EquityPoint } from './metrics.ts';

const t = (over: Partial<CanonicalTrade>): CanonicalTrade => ({
  id: 'x', symbol: 'BTC', side: 'long', qty: 1, realizedPnl: 0, fee: 0, funding: 0, openedAt: 0, closedAt: 1, ...over,
});

const trades: CanonicalTrade[] = [
  t({ realizedPnl: 100, fee: 1, funding: 0.5 }),
  t({ realizedPnl: -40, fee: 1, funding: -0.2 }),
  t({ realizedPnl: 60, fee: 1, funding: 0 }),
  t({ realizedPnl: 0, closedAt: null, fee: 0.5, funding: 0 }), // open trade, not counted as closed
];
const positions: CanonicalPosition[] = [
  { symbol: 'ETH', side: 'long', qty: 2, entryPrice: 100, markPrice: 110, unrealizedPnl: 20, marginUsed: 50 },
];
const equity: EquityPoint[] = [
  { t: 1, equity: 1000 }, { t: 2, equity: 1200 }, { t: 3, equity: 900 }, { t: 4, equity: 1100 },
];

const m = computeMetrics({ trades, positions, equityCurve: equity, walletEquity: 1100 });

assert.equal(m.closedPnl, 120, 'closedPnl = 100 - 40 + 60');
assert.equal(m.unrealizedPnl, 20, 'unrealized from open position only');
assert.equal(m.tradeCount, 3, 'only closed trades counted');
assert.equal(m.winCount, 2);
assert.equal(m.lossCount, 1);
assert.equal(m.winRatePct, 66.67, 'win rate rounds to 2dp');
assert.equal(m.grossProfit, 160);
assert.equal(m.grossLoss, 40);
assert.equal(m.profitFactor, 4, '160/40');
assert.equal(m.roiOnMarginPct, 240, 'closedPnl 120 / margin 50 * 100');
assert.equal(m.openRisk, 50);
assert.equal(m.maxDrawdownPct, 25, 'peak 1200 -> 900 = 25%');
assert.equal(m.currentDrawdownPct, 8.33, 'peak 1200 -> last 1100');

// profitFactor edge: no losses but profit => Infinity; no closed trades => null
assert.equal(computeMetrics({ trades: [t({ realizedPnl: 10 })], positions: [], equityCurve: [], walletEquity: 0 }).profitFactor, Infinity);
assert.equal(computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 0 }).winRatePct, null, 'no closed trades => null, not 0');
assert.deepEqual(computeDrawdown([]), { peak: null, maxDrawdownPct: null, maxDrawdownAbs: null, currentDrawdownPct: null });

console.log('OK  @wtc/analytics: 14 checks passed (closed vs unrealized, win rate, profit factor, ROI, drawdown, null-not-zero)');
