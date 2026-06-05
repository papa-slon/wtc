import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildLegacyLiveConfig,
  buildLegacyLivePositions,
  buildLegacyLiveWarnings,
} from '../../apps/worker/src/legacy-live.ts';

const ROOT = process.cwd();
const source = readFileSync(resolve(ROOT, 'apps/worker/src/legacy-live.ts'), 'utf8');

const rows = {
  accounts: [
    {
      pub_id: 'legacy-pub-1',
      market: 'BINGX',
      running: true,
      balance: '1234.56',
      quarantined: false,
      quarantine_reason: null,
    },
  ],
  settings: [
    {
      api_id: 'legacy-pub-1',
      symbol: 'AAVE-USDT',
      active: true,
      timeframe: '3m',
      use_rsi: true,
      use_cci: false,
      rsi_length: 14,
      rsi_threshold: '20',
      cci_length: 20,
      cci_threshold: '-230',
      take_profit_percent: '0.5',
      initial_entry_percent: '100',
      averaging_levels: 3,
      averaging_percents: '3,12,35',
      averaging_volume_percents: '4,6,12',
      use_balance_percent: '1.5',
      leverage: 2,
      stage: 1,
      use_delay_filter: false,
      delay_bars: 1,
      use_delta_filter: false,
      delta_filter: '0',
    },
  ],
  stages: [
    { api_id: 'legacy-pub-1', stage: 1, rsi_slots: 3, cci_slots: 2 },
    { api_id: 'legacy-pub-1', stage: 2, rsi_slots: 2, cci_slots: 1 },
  ],
  slots: [
    {
      api_id: 'legacy-pub-1',
      position: 'AAVE-USDT',
      reason: 'YELLOW',
      stage: 1,
      averaging_count: 1,
      active: true,
      created_at: new Date('2026-06-03T00:00:00Z'),
    },
  ],
  orders: [
    {
      api_id: 'legacy-pub-1',
      position: 'AAVE-USDT',
      position_side: 'LONG',
      note: 'BUY',
      price: '100',
      quantity: '2',
      active: true,
    },
    {
      api_id: 'legacy-pub-1',
      position: 'AAVE-USDT',
      position_side: 'LONG',
      note: 'AVERAGING',
      price: '80',
      quantity: '1',
      active: true,
    },
    {
      api_id: 'legacy-pub-1',
      position: 'AAVE-USDT',
      position_side: 'LONG',
      note: 'TAKE_PROFIT',
      price: '105',
      quantity: '3',
      active: true,
    },
  ],
};

describe('Legacy live worker DB-backed snapshot helpers', () => {
  it('builds WTC legacy config from provider pub_id rows', () => {
    const config = buildLegacyLiveConfig(rows);
    expect(config).toMatchObject({
      operationMode: 'auto',
      apiProfile: 'legacy-live-bingx',
      symbols: 'AAVE-USDT',
      defaultTimeframe: '3m',
      defaultTakeProfitPercent: 0.5,
      defaultUseBalancePercent: 1.5,
      defaultLeverage: 2,
    });
    expect(config.symbolConfigs).toEqual([
      expect.objectContaining({
        providerPubId: 'legacy-pub-1',
        symbol: 'AAVE-USDT',
        signal: 'rsi',
        useRsi: true,
        useCci: false,
        rsiThreshold: 20,
        cciThreshold: -230,
        averagingPercents: '3,12,35',
      }),
    ]);
    expect(config.stageConfigs).toEqual([
      { providerPubId: 'legacy-pub-1', stage: 1, rsiSlots: 3, cciSlots: 2 },
      { providerPubId: 'legacy-pub-1', stage: 2, rsiSlots: 2, cciSlots: 1 },
    ]);
    expect(config.providerAccounts).toEqual([
      expect.objectContaining({
        pubId: 'legacy-pub-1',
        running: true,
        balance: 1234.56,
        symbols: 1,
        activeSlots: 1,
        activeOrders: 3,
      }),
    ]);
    expect(config.activeSlots).toEqual([
      expect.objectContaining({ providerPubId: 'legacy-pub-1', symbol: 'AAVE-USDT', signal: 'rsi', stage: 1 }),
    ]);
    expect(config.activeOrderSummary).toHaveLength(3);
  });

  it('maps active legacy slots and orders into approximate positions', () => {
    const positions = buildLegacyLivePositions(rows);
    expect(positions).toEqual([
      expect.objectContaining({
        symbol: 'AAVE-USDT',
        providerPubId: 'legacy-pub-1',
        signal: 'rsi',
        side: 'long',
        qty: 3,
        entryPrice: 93.33333333333333,
        markPrice: 93.33333333333333,
        tpPrice: 105,
        hasTp: true,
        units: 2,
        stage: 1,
      }),
    ]);
  });

  it('keeps warning truth limited to current legacy capabilities', () => {
    expect(buildLegacyLiveWarnings(rows)).toEqual(['no_trade_history']);
    expect(buildLegacyLiveWarnings({ ...rows, accounts: [{ ...rows.accounts[0]!, quarantined: true }] })).toContain('legacy_quarantined');
  });

  it('does not serialize exchange-key fields from the built config or positions', () => {
    const serialized = JSON.stringify({
      config: buildLegacyLiveConfig(rows),
      positions: buildLegacyLivePositions(rows),
    });
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('secret_key');
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('access_token');
  });

  it('queries only whitelisted legacy provider columns, never exchange credential columns', () => {
    expect(source).toMatch(/select pub_id, market::text as market, running, balance, quarantined, quarantine_reason/);
    expect(source).not.toMatch(/select\s+\*/i);
    expect(source).not.toMatch(/\bapi_key\b/);
    expect(source).not.toMatch(/\bsecret_key\b/);
  });

  it('keeps retained health warnings code-only instead of storing provider quarantine reason arrays', () => {
    expect(source).not.toMatch(/\bquarantineReasons\b/);
    expect(source).toMatch(/warningCodes: Array\.from\(warningCodes\)/);
    expect(source).toMatch(/warningCodes: snap\.warningCodes/);
  });
});
