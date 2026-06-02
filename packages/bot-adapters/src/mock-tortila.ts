/**
 * Mock Tortila adapter. Data is journal-shaped (see Tortila journal :8080 endpoints) but synthetic
 * and clearly labelled as mock. CRITICALLY: it surfaces the KNOWN risk warnings from discovery —
 * these are never hidden behind a green "healthy" card.
 */
import { computeMetrics, type CanonicalMetrics, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import type { BotAdapter, BotConfigView, BotHealth, RiskWarning, ValidationResult } from './types.ts';
import { assertBotControlAllowed } from './control.ts';
import { TORTILA_WARNINGS } from './warnings.ts';

const HOUR = 3_600_000;

function buildTrades(base: number): CanonicalTrade[] {
  const mk = (i: number, pnl: number, sym: string, openO: number, closeO: number | null, exitReason?: string): CanonicalTrade => {
    const closedAt = closeO === null ? null : base - closeO * HOUR;
    return {
      id: `tortila-${i}`,
      symbol: sym,
      side: pnl >= 0 ? 'long' : 'short',
      qty: 1,
      entryPrice: sym === 'BTC-USDT' ? 62000 : sym === 'ETH-USDT' ? 3200 : sym === 'SOL-USDT' ? 145 : sym === 'LINK-USDT' ? 17 : 5.42,
      exitPrice: sym === 'BTC-USDT' ? 63800 : sym === 'ETH-USDT' ? 3320 : sym === 'SOL-USDT' ? 151 : sym === 'LINK-USDT' ? 16.4 : 5.55,
      realizedPnl: pnl,
      fee: 0.8,
      funding: 0.1,
      openedAt: base - openO * HOUR,
      closedAt,
      ...(closedAt ? { holdHours: openO - closeO! } : {}),
      ...(exitReason ? { exitReason } : {}),
      retPct: pnl / 10,
    };
  };
  return [
    mk(1, 142.5, 'BTC-USDT', 50, 44, 'take_profit'),
    mk(2, -38.2, 'ETH-USDT', 42, 39, 'stop'),
    mk(3, 88.0, 'SOL-USDT', 30, 22, 'exit_signal'),
    mk(4, -21.4, 'LINK-USDT', 20, 16, 'stop'),
    mk(5, 64.9, 'BTC-USDT', 12, 6, 'take_profit'),
    mk(6, 0, 'NEAR-USDT', 3, null), // still open
  ];
}

function buildPositions(now: number): CanonicalPosition[] {
  return [
    {
      symbol: 'NEAR-USDT', side: 'long', qty: 120, entryPrice: 5.42, markPrice: 5.55, unrealizedPnl: 15.6,
      marginUsed: 65, stopPrice: 5.10, stopDistPct: 5.9, hasTp: true, tpPrice: 6.20, openedAt: now - 8 * HOUR, units: 2,
    },
  ];
}

function buildEquity(base: number): EquityPoint[] {
  const vals = [1000, 1042, 1090, 1075, 1180, 1120, 1244, 1210, 1298, 1281];
  return vals.map((equity, i) => ({ t: base - (vals.length - i) * HOUR, equity }));
}

export function createMockTortilaAdapter(now: number = Date.now()): BotAdapter {
  const trades = buildTrades(now);
  const positions = buildPositions(now);
  const equityCurve = buildEquity(now);
  const safetyEventCount = TORTILA_WARNINGS.filter((w) => w.severity !== 'info').length;

  return {
    productCode: 'tortila_bot',
    mode: 'mock',
    async getWarnings(): Promise<RiskWarning[]> {
      // Mock surfaces the full known set (persistent P0/P1 + observed signal warnings).
      return TORTILA_WARNINGS;
    },
    async getHealth(): Promise<BotHealth> {
      return {
        productCode: 'tortila_bot',
        processAlive: true,
        status: 'degraded', // error-severity warnings present → not "healthy"
        // Synthetic demo data is always available — mock is never "not_configured/unreachable".
        readState: 'ok',
        lastSyncAt: now - 28_000,
        staleDataSeconds: 28,
        uptimeSeconds: 36 * HOUR / 1000,
        warnings: await this.getWarnings(),
      };
    },
    async getConfig(instanceId): Promise<BotConfigView> {
      return {
        productCode: 'tortila_bot',
        instanceId,
        symbols: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'LINK-USDT', 'NEAR-USDT'],
        riskPercent: 1.0,
        leverage: 3,
        maxUnits: 4,
        takeProfitPercent: 2.5,
        mode: 'live',
        raw: { system: 'turtle', timeframe: '1h', winnerFilter: true, atrGerchik: true, trailing: 'tflab' },
      };
    },
    async getMetrics(): Promise<CanonicalMetrics> {
      return computeMetrics({
        trades, positions, equityCurve,
        walletEquity: equityCurve[equityCurve.length - 1]!.equity,
        firstEquity: equityCurve[0]?.equity ?? null,
        safetyEventCount,
      });
    },
    async getPositions(): Promise<CanonicalPosition[]> {
      return positions;
    },
    async getTrades(): Promise<CanonicalTrade[]> {
      return trades;
    },
    async getEquityCurve(): Promise<EquityPoint[]> {
      return equityCurve;
    },
    async validateConfig(input: unknown): Promise<ValidationResult> {
      const errors: string[] = [];
      const c = input as Record<string, unknown>;
      if (!c || !Array.isArray(c.symbols) || c.symbols.length === 0) errors.push('symbols must be a non-empty array');
      if (typeof c?.riskPercent !== 'number' || (c.riskPercent as number) <= 0) errors.push('riskPercent must be > 0');
      return { ok: errors.length === 0, errors };
    },
    async startBot(): Promise<never> {
      assertBotControlAllowed('startBot', false, false);
      throw new Error('unreachable');
    },
    async stopBot(): Promise<never> {
      assertBotControlAllowed('stopBot', false, false);
      throw new Error('unreachable');
    },
    async applyConfig(): Promise<never> {
      assertBotControlAllowed('applyConfig', false, false);
      throw new Error('unreachable');
    },
  };
}
