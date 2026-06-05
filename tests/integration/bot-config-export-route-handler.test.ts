import { describe, expect, it, vi } from 'vitest';
import type { AccessDecision } from '@wtc/entitlements';
import {
  handleBotConfigExportRequest,
  type BotConfigExportOptions,
  type BotConfigExportUser,
} from '../../apps/web/src/features/bots/config-export-handler.ts';

const user: BotConfigExportUser = { id: 'user-route-export-1', roles: [] };

const tortilaConfig = {
  operationMode: 'manual',
  symbols: 'BTC/USDT:USDT',
  symbolConfigs: [
    { symbol: 'BTC/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 0.5, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
  ],
  maxOpenSymbols: 5,
  maxTotalUnits: 12,
  maxUnitsPerDirection: 8,
  haltDrawdownPercent: 35,
  dailyMaxLossPercent: 6,
  maxNewEntriesPerTick: 2,
};

const legacyConfig = {
  operationMode: 'manual',
  apiProfile: 'legacy-main',
  symbols: 'AAVE-USDT',
  maxSymbols: 3,
  defaultTimeframe: '3m',
  defaultTakeProfitPercent: 0.5,
  defaultInitialEntryPercent: 2,
  defaultUseBalancePercent: 1.5,
  defaultLeverage: 2,
  symbolConfigs: [
    {
      symbol: 'AAVE-USDT',
      providerPubId: 'provider-pub-id-secret-value',
      active: true,
      timeframe: '3m',
      useRsi: true,
      useCci: false,
      rsiLength: 14,
      rsiThreshold: 20,
      cciLength: 20,
      cciThreshold: -230,
      takeProfitPercent: 0.5,
      initialEntryPercent: 100,
      averagingLevels: 3,
      averagingPercents: '3,12,35',
      averagingVolumePercents: '4,6,12',
      useBalancePercent: 1.5,
      leverage: 2,
      stage: 1,
      useDelayFilter: false,
      delayBars: 1,
      useDeltaFilter: false,
      deltaFilter: 0,
    },
  ],
  stageConfigs: [{ stage: 1, rsiSlots: 3, cciSlots: 2 }],
};

const legacyMappedReadModel = {
  config: {
    data: { raw: { providerAccounts: [{ pubId: 'USER_A...B_ID' }] } },
    issue: null,
  },
};

function request(bot: string): Request {
  return new Request(`https://wtc.local/api/bots/${bot}/config-export`);
}

function allowed(productCode: string): AccessDecision {
  return { allowed: true, reason: 'allowed', status: 'active', productCode };
}

function denied(productCode: string): AccessDecision {
  return { allowed: false, reason: 'blocked_no_entitlement', status: 'none', productCode };
}

function options(
  bot: string,
  overrides: Partial<BotConfigExportOptions> = {},
): BotConfigExportOptions {
  return {
    bot,
    requireUser: vi.fn(async () => user),
    botAccessForUser: vi.fn(async (_u, productCode) => allowed(productCode)),
    loadBotConfig: vi.fn(async () => ({ current: tortilaConfig })),
    loadBotReadModelForUser: vi.fn(async () => legacyMappedReadModel),
    ...overrides,
  };
}

function expectNoStoreSecurityHeaders(res: Response): void {
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(res.headers.get('set-cookie')).toBeNull();
  expect(res.headers.get('location')).toBeNull();
}

function expectNoUnsafeMarkers(value: string): void {
  for (const marker of [
    'apiKey',
    'apiSecret',
    'api-secret-value',
    'providerPubId',
    'provider-pub-id-secret-value',
    'providerAccountId',
    'provider-account-secret-value',
    'sealed',
    'sealed-secret-value',
    'wrappedDek',
    'wrapped-dek-secret-value',
    'legacyDatabaseUrl',
    'postgres://legacy-secret-value',
    'tortilaJournalUrl',
    'https://journal-secret-value',
    'adminUserId',
    'admin-user-secret-value',
    'ownerEmail',
    'owner-secret@example.test',
    'controlRequest',
    'live-control-secret-value',
    'rawJson',
    'liveConfig',
    'authorization',
    'bearer-secret-value',
    'startBot',
    'stopBot',
    'applyConfig',
    'retest',
  ]) {
    expect(value).not.toContain(marker);
  }
}

describe('bot config export extracted route handler', () => {
  it('returns no-store 401 when the user is unauthenticated and does not load config', async () => {
    const opts = options('tortila', {
      requireUser: vi.fn(async () => { throw new Error('UNAUTHENTICATED'); }),
      exportConfig: vi.fn(),
    });

    const res = await handleBotConfigExportRequest(request('tortila'), opts);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'unauthenticated' });
    expectNoStoreSecurityHeaders(res);
    expect(opts.botAccessForUser).not.toHaveBeenCalled();
    expect(opts.loadBotConfig).not.toHaveBeenCalled();
    expect(opts.loadBotReadModelForUser).not.toHaveBeenCalled();
    expect(opts.exportConfig).not.toHaveBeenCalled();
    expect(res.headers.get('content-disposition')).toBeNull();
  });

  it('fails closed for denied entitlements before loading config or exporting', async () => {
    const opts = options('tortila', {
      botAccessForUser: vi.fn(async (_u, productCode) => denied(productCode)),
      exportConfig: vi.fn(),
    });

    const res = await handleBotConfigExportRequest(request('tortila'), opts);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'access_required', reason: 'blocked_no_entitlement' });
    expectNoStoreSecurityHeaders(res);
    expect(opts.loadBotConfig).not.toHaveBeenCalled();
    expect(opts.loadBotReadModelForUser).not.toHaveBeenCalled();
    expect(opts.exportConfig).not.toHaveBeenCalled();
  });

  it('blocks Legacy export when the user has no verified provider mapping', async () => {
    const opts = options('legacy', {
      loadBotConfig: vi.fn(async () => ({ current: legacyConfig })),
      loadBotReadModelForUser: vi.fn(async () => ({ config: { issue: { code: 'legacy_provider_mapping_required' } } })),
      exportConfig: vi.fn(),
    });

    const res = await handleBotConfigExportRequest(request('legacy'), opts);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'provider_mapping_required' });
    expectNoStoreSecurityHeaders(res);
    expect(opts.loadBotConfig).toHaveBeenCalledOnce();
    expect(opts.loadBotReadModelForUser).toHaveBeenCalledWith(user.id, 'legacy_bot', ['config']);
    expect(opts.exportConfig).not.toHaveBeenCalled();
  });

  it('blocks Legacy export when the config read has no safe mapped provider account', async () => {
    const opts = options('legacy', {
      loadBotConfig: vi.fn(async () => ({ current: legacyConfig })),
      loadBotReadModelForUser: vi.fn(async () => ({ config: { data: { raw: { providerAccounts: [] } }, issue: null } })),
      exportConfig: vi.fn(),
    });

    const res = await handleBotConfigExportRequest(request('legacy'), opts);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'provider_mapping_required' });
    expectNoStoreSecurityHeaders(res);
    expect(opts.exportConfig).not.toHaveBeenCalled();
  });

  it('blocks Legacy export when the config read has multiple safe mapped provider accounts', async () => {
    const opts = options('legacy', {
      loadBotConfig: vi.fn(async () => ({ current: legacyConfig })),
      loadBotReadModelForUser: vi.fn(async () => ({
        config: {
          data: { raw: { providerAccounts: [{ pubId: 'USER_A...B_ID' }, { pubId: 'USER_C...D_ID' }] } },
          issue: null,
        },
      })),
      exportConfig: vi.fn(),
    });

    const res = await handleBotConfigExportRequest(request('legacy'), opts);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'provider_mapping_required' });
    expectNoStoreSecurityHeaders(res);
    expect(opts.exportConfig).not.toHaveBeenCalled();
  });

  it('exports Tortila env config with exact attachment headers and no unsafe payload leakage', async () => {
    const unsafeConfig = {
      ...tortilaConfig,
      apiKey: 'api-secret-value',
      apiSecret: 'api-secret-value',
      providerAccountId: 'provider-account-secret-value',
      sealed: 'sealed-secret-value',
      wrappedDek: 'wrapped-dek-secret-value',
      legacyDatabaseUrl: 'postgres://legacy-secret-value',
      tortilaJournalUrl: 'https://journal-secret-value',
      adminUserId: 'admin-user-secret-value',
      ownerEmail: 'owner-secret@example.test',
      controlRequest: { liveControl: 'live-control-secret-value' },
      rawJson: { liveConfig: 'runtime-secret-value' },
      headers: { authorization: 'bearer-secret-value' },
      startBot: true,
      stopBot: true,
      applyConfig: true,
      retest: true,
    };
    const opts = options('tortila', {
      loadBotConfig: vi.fn(async () => ({ current: unsafeConfig })),
    });

    const res = await handleBotConfigExportRequest(request('tortila'), opts);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="wtc-tortila-config.env"');
    expectNoStoreSecurityHeaders(res);
    expect(body).toContain('SYMBOL_CONFIGS=BTC/USDT:USDT@4h@2@0.003@2@0.5@4@20@0');
    expect(body).toContain('MAX_OPEN_SYMBOLS=5');
    expectNoUnsafeMarkers(body);
    expectNoUnsafeMarkers([...res.headers.entries()].join('\n'));
    expect(opts.loadBotReadModelForUser).not.toHaveBeenCalled();
  });

  it('exports Legacy JSON/native config with provider ids stripped and no unsafe payload leakage', async () => {
    const unsafeConfig = {
      ...legacyConfig,
      apiKey: 'api-secret-value',
      apiSecret: 'api-secret-value',
      providerAccountId: 'provider-account-secret-value',
      sealed: 'sealed-secret-value',
      wrappedDek: 'wrapped-dek-secret-value',
      legacyDatabaseUrl: 'postgres://legacy-secret-value',
      tortilaJournalUrl: 'https://journal-secret-value',
      adminUserId: 'admin-user-secret-value',
      ownerEmail: 'owner-secret@example.test',
      controlRequest: { liveControl: 'live-control-secret-value' },
      rawJson: { liveConfig: 'runtime-secret-value' },
      headers: { authorization: 'bearer-secret-value' },
      startBot: true,
      stopBot: true,
      applyConfig: true,
      retest: true,
    };
    const opts = options('legacy', {
      loadBotConfig: vi.fn(async () => ({ current: unsafeConfig })),
    });

    const res = await handleBotConfigExportRequest(request('legacy'), opts);
    const body = await res.text();
    const parsed = JSON.parse(body) as {
      productCode: string;
      config: { symbolConfigs: Array<Record<string, unknown>>; stageConfigs: Array<Record<string, unknown>> };
      native: { settings: Array<Record<string, unknown>>; stage_config: Array<Record<string, unknown>> };
    };

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="wtc-legacy-config.json"');
    expectNoStoreSecurityHeaders(res);
    expect(parsed.productCode).toBe('legacy_bot');
    expect(parsed.config.symbolConfigs[0]).toMatchObject({ symbol: 'AAVE-USDT', useRsi: true, useCci: false });
    expect(parsed.config.symbolConfigs[0]).not.toHaveProperty('providerPubId');
    expect(parsed.native.settings[0]).toMatchObject({ symbol: 'AAVE-USDT', use_rsi: true, use_cci: false });
    expect(parsed.native.stage_config[0]).toEqual({ stage: 1, rsi_slots: 3, cci_slots: 2 });
    expectNoUnsafeMarkers(body);
    expectNoUnsafeMarkers([...res.headers.entries()].join('\n'));
  });
});
