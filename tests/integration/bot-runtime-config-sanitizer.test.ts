import { describe, expect, it } from 'vitest';
import { buildSafeRuntimeConfigView } from '../../apps/web/src/features/bots/runtime-config-sanitizer.ts';

function expectNoUnsafeMarkers(value: string): void {
  for (const marker of [
    'apiKey',
    'apiSecret',
    'api-secret-value',
    'provider-pub-id-secret-value',
    'providerAccountId',
    'provider-account-secret-value',
    'rawJson',
    'liveConfig',
    'authorization',
    'bearer-secret-value',
    'legacyDatabaseUrl',
    'https://legacy.internal',
    'exchangeUrl',
    'headers',
    'applyConfig',
    'startBot',
    'stopBot',
    'retest',
  ]) {
    expect(value).not.toContain(marker);
  }
}

describe('bot runtime config sanitizer', () => {
  it('strips secret, provider, raw runtime, URL/header, and live-control keys from read-model config raw', () => {
    const view = buildSafeRuntimeConfigView({
      productCode: 'legacy_bot',
      instanceId: 'bot-instance-1',
      liveConfig: {
        symbols: 'AAVE-USDT',
        defaultLeverage: '2',
        defaultTakeProfitPercent: '0.5',
        apiKey: 'api-secret-value',
        apiSecret: 'api-secret-value',
        providerAccountId: 'provider-account-secret-value',
        legacyDatabaseUrl: 'https://legacy.internal',
        exchangeUrl: 'https://exchange.internal',
        rawJson: { liveConfig: { apiSecret: 'api-secret-value' } },
        headers: { authorization: 'bearer-secret-value' },
        applyConfig: true,
        startBot: true,
        stopBot: true,
        retest: true,
        symbolConfigs: [
          {
            symbol: 'AAVE-USDT',
            providerPubId: 'provider-pub-id-secret-value',
            useRsi: true,
            nested: { authorization: 'bearer-secret-value', safeNote: 'keep-me' },
          },
        ],
        providerAccounts: [
          { pubId: 'provider-pub-id-secret-value', running: true, providerAccountId: 'provider-account-secret-value' },
        ],
        activeSlots: [
          { providerPubId: 'provider-pub-id-secret-value', symbol: 'AAVE-USDT', stage: 1 },
        ],
        activeOrderSummary: [
          { providerPubId: 'provider-pub-id-secret-value', symbol: 'AAVE-USDT', note: 'TAKE_PROFIT' },
        ],
      },
    });

    expect(view).toMatchObject({
      productCode: 'legacy_bot',
      instanceId: 'bot-instance-1',
      symbols: ['AAVE-USDT'],
      leverage: 2,
      takeProfitPercent: 0.5,
      mode: 'unknown',
    });
    expect(view?.raw).toMatchObject({
      symbols: 'AAVE-USDT',
      symbolConfigs: [{ symbol: 'AAVE-USDT', providerPubId: 'provider...alue', useRsi: true, nested: { safeNote: 'keep-me' } }],
      providerAccounts: [{ pubId: 'provider...alue', running: true }],
      activeSlots: [{ providerPubId: 'provider...alue', symbol: 'AAVE-USDT', stage: 1 }],
      activeOrderSummary: [{ providerPubId: 'provider...alue', symbol: 'AAVE-USDT', note: 'TAKE_PROFIT' }],
    });
    expectNoUnsafeMarkers(JSON.stringify(view));
  });
});
