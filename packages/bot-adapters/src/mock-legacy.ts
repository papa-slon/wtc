/**
 * Mock Legacy bot adapter. Config shape mirrors the old bot (RSI/CCI, averaging levels, TP%,
 * leverage, balance %, stages/slots). Surfaces the discovery findings: websocket reconnect/
 * fallback (stale data even when process is alive), a plaintext-keys integration risk flagged by
 * the bot-integration audit, and the missing closed-trade history (an analytics gap, shown honestly).
 */
import { computeMetrics, type CanonicalMetrics, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import type { BotAdapter, BotConfigView, BotHealth, RiskWarning, ValidationResult } from './types.ts';
import { assertBotControlAllowed } from './control.ts';
import { LEGACY_WARNINGS } from './warnings.ts';

export function createMockLegacyAdapter(now: number = Date.now()): BotAdapter {
  const positions: CanonicalPosition[] = [
    { symbol: 'BTCUSDT', side: 'long', qty: 0.05, entryPrice: 61000, markPrice: 61750, unrealizedPnl: 37.5, marginUsed: 102 },
    { symbol: 'XRPUSDT', side: 'long', qty: 800, entryPrice: 0.61, markPrice: 0.6, unrealizedPnl: -8.0, marginUsed: 49 },
  ];
  const trades: CanonicalTrade[] = []; // no closed history available — honest empty

  return {
    productCode: 'legacy_bot',
    mode: 'mock',
    async getWarnings(): Promise<RiskWarning[]> {
      return LEGACY_WARNINGS;
    },
    async getHealth(): Promise<BotHealth> {
      return {
        productCode: 'legacy_bot',
        processAlive: true,
        status: 'stale',
        readState: 'ok', // mock demo data is always available
        lastSyncAt: now - 240_000,
        staleDataSeconds: 240,
        uptimeSeconds: 96 * 3600,
        warnings: await this.getWarnings(),
      };
    },
    async getConfig(instanceId): Promise<BotConfigView> {
      return {
        productCode: 'legacy_bot',
        instanceId,
        symbols: ['BTCUSDT', 'XRPUSDT', 'ADAUSDT'],
        leverage: 5,
        takeProfitPercent: 1.2,
        mode: 'live',
        raw: {
          rsi: { period: 14, oversold: 30, overbought: 70 },
          cci: { period: 20, threshold: 100 },
          averagingLevels: [0, -1.5, -3.0, -5.0],
          balancePercent: 8,
          stages: [
            { slot: 1, sizePercent: 25 },
            { slot: 2, sizePercent: 25 },
            { slot: 3, sizePercent: 50 },
          ],
        },
      };
    },
    async getMetrics(): Promise<CanonicalMetrics> {
      return computeMetrics({ trades, positions, equityCurve: [], walletEquity: 1543.2 });
    },
    async getPositions(): Promise<CanonicalPosition[]> {
      return positions;
    },
    async getTrades(): Promise<CanonicalTrade[]> {
      return trades;
    },
    async getEquityCurve(): Promise<EquityPoint[]> {
      return []; // legacy bot exposes no equity history — honest empty, never fabricated
    },
    async validateConfig(input: unknown): Promise<ValidationResult> {
      const errors: string[] = [];
      const c = input as Record<string, unknown>;
      if (!c || !Array.isArray(c.symbols) || c.symbols.length === 0) errors.push('symbols must be a non-empty array');
      if (typeof c?.leverage !== 'number' || (c.leverage as number) < 1) errors.push('leverage must be >= 1');
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
