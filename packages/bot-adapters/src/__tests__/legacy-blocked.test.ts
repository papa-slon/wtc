/**
 * Phase 2.8 / PG3 — Legacy hard gate regression tests + Zod plaintext-key exclusion.
 *
 * Proves the legacy bot CANNOT activate a real HTTP adapter in any mode (B3):
 *   - the factory returns the blocked adapter in read-only/audited mode (never a live HTTP adapter);
 *   - every data/health-reading method throws LegacyAdapterBlockedError (blockerRef='B3');
 *   - getHealth() never issues a network call;
 *   - control methods throw BotControlDisabledError;
 *   - getWarnings() still surfaces the legacy_plaintext_keys risk (never hidden).
 * And proves the Zod exclusion strips any SECRET_HINTS field from a legacy /api_management/ body.
 *
 * Source design: docs/handoffs/20260530-2100-ecosystem-bot-integration-auditor.md (D-01..D-05),
 *                docs/handoffs/20260530-2100-ecosystem-tests-runner.md (§Verification/tests).
 */
import { describe, it, expect, vi } from 'vitest';
import { getBotAdapter } from '../factory.ts';
import { createLegacyBlockedAdapter, LegacyAdapterBlockedError } from '../legacy/legacy-blocked.ts';
import {
  LegacyApiSafeBodySchema,
  isLegacySecretField,
  LEGACY_SECRET_FIELD_NAMES,
} from '../legacy/legacy-plaintext-exclusion.ts';
import { BotControlDisabledError } from '../control.ts';
import { CANONICAL_WARNING_CODES } from '../warnings.ts';

// ── Factory gate: mock mode → mock; non-mock mode → blocked (never real HTTP) ───────────────────────
describe('PG3 factory gate: legacy bot cannot activate a real HTTP adapter', () => {
  it('mode=mock + legacyBaseUrl ⇒ mock adapter (demo path)', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'mock', legacyBaseUrl: 'http://legacy.internal:8000' });
    expect(a.mode).toBe('mock');
  });

  it('mode=read-only + legacyBaseUrl set ⇒ blocked adapter, NOT a live HTTP adapter', async () => {
    const a = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://legacy.internal:8000' });
    expect(a.mode).toBe('real'); // blocked adapter is mode='real' (a non-mock adapter was selected)
    const h = await a.getHealth(); // must resolve (no network), with a blocked state
    expect(h.readState).toBe('not_configured');
    expect(h.processAlive).toBe(false);
    expect(h.readStateDetail).toContain('B3');
  });

  it('mode=audited + legacyBaseUrl set ⇒ blocked adapter', async () => {
    const a = getBotAdapter('legacy_bot', { mode: 'audited', legacyBaseUrl: 'http://legacy.internal:8000' });
    const h = await a.getHealth();
    expect(h.readState).toBe('not_configured');
    expect(h.readStateDetail).toContain('B3');
  });

  it('mode=read-only + NO legacyBaseUrl ⇒ still blocked (not mock — the real adapter is gone)', async () => {
    const a = getBotAdapter('legacy_bot', { mode: 'read-only' });
    const h = await a.getHealth();
    expect(h.readState).toBe('not_configured');
  });

  it('data methods on the factory-selected blocked adapter throw LegacyAdapterBlockedError', async () => {
    const a = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(a.getMetrics('x')).rejects.toThrow(LegacyAdapterBlockedError);
    await expect(a.getTrades('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });
});

// ── Blocked adapter: data methods throw LegacyAdapterBlockedError (blockerRef B3) ────────────────────
describe('PG3 LegacyBlockedAdapter: data methods throw LegacyAdapterBlockedError', () => {
  const adapter = createLegacyBlockedAdapter();

  it('getConfig throws LegacyAdapterBlockedError with blockerRef "B3"', async () => {
    await expect(adapter.getConfig('x')).rejects.toThrow(LegacyAdapterBlockedError);
    await adapter.getConfig('x').catch((e: unknown) => {
      expect(e).toBeInstanceOf(LegacyAdapterBlockedError);
      expect((e as LegacyAdapterBlockedError).blockerRef).toBe('B3');
    });
  });
  it('getMetrics throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getMetrics('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });
  it('getPositions throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getPositions('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });
  it('getTrades throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getTrades('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });
  it('getEquityCurve throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getEquityCurve!('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });
  it('validateConfig throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.validateConfig({})).rejects.toThrow(LegacyAdapterBlockedError);
  });
});

// ── Blocked adapter: getHealth resolves without a network call; warnings preserved ───────────────────
describe('PG3 LegacyBlockedAdapter: getHealth + getWarnings', () => {
  it('getHealth resolves (never throws) with readState not_configured + B3 detail', async () => {
    const h = await createLegacyBlockedAdapter().getHealth();
    expect(h.readState).toBe('not_configured');
    expect(h.processAlive).toBe(false);
    expect(h.status).toBe('down');
    expect(h.readStateDetail).toContain('B3');
    expect(h.warnings.length).toBeGreaterThan(0);
  });

  it('getWarnings surfaces legacy_plaintext_keys at warning severity; all codes canonical', async () => {
    const warnings = await createLegacyBlockedAdapter().getWarnings();
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('legacy_plaintext_keys');
    expect(warnings.find((w) => w.code === 'legacy_plaintext_keys')!.severity).toBe('warning');
    for (const w of warnings) {
      expect(CANONICAL_WARNING_CODES).toContain(w.code as (typeof CANONICAL_WARNING_CODES)[number]);
    }
  });

  it('getHealth issues NO fetch call (no /api_management/ probe)', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('fetch must not be called by the blocked adapter')));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const h = await getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' }).getHealth();
      expect(h).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── Blocked adapter: control methods throw BotControlDisabledError (not the blocked error) ───────────
describe('PG3 LegacyBlockedAdapter: control methods stay disabled', () => {
  const adapter = createLegacyBlockedAdapter();
  it('startBot throws BotControlDisabledError', async () => {
    await expect(adapter.startBot('x')).rejects.toThrow(BotControlDisabledError);
  });
  it('stopBot throws BotControlDisabledError', async () => {
    await expect(adapter.stopBot('x')).rejects.toThrow(BotControlDisabledError);
  });
  it('applyConfig throws BotControlDisabledError', async () => {
    await expect(adapter.applyConfig('x', {})).rejects.toThrow(BotControlDisabledError);
  });
});

// ── Zod plaintext-key exclusion: any SECRET_HINTS field is stripped from a legacy body ───────────────
describe('PG3 isLegacySecretField: detects exchange-secret field names', () => {
  it.each([
    'api_key',
    'secret_key',
    'apiKey',
    'API_KEY',
    'api_secret',
    'passphrase',
    'password',
    'private_key',
    'access_token',
    'refresh_token',
  ])('"%s" ⇒ secret (true)', (k) => {
    expect(isLegacySecretField(k)).toBe(true);
  });

  it.each(['pub_id', 'balance', 'market', 'quarantined', 'running', 'user_id', 'symbol', 'leverage'])(
    '"%s" ⇒ not a secret (false)',
    (k) => {
      expect(isLegacySecretField(k)).toBe(false);
    },
  );

  it('the list covers the known legacy fields', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('apikey');
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('secret');
  });
});

describe('PG3 LegacyApiSafeBodySchema: strips all secret-hint fields before the canonical layer', () => {
  const body = {
    pub_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    api_key: 'INERT-EXCHANGE-KEY-PLACEHOLDER',
    secret_key: 'INERT-EXCHANGE-SECRET-PLACEHOLDER',
    market: 'BINGX',
    user_id: 'user-1',
    running: true,
    balance: 1423.5,
    quarantined: false,
    quarantine_reason: null,
  };

  it('api_key and secret_key are absent from the parsed output', () => {
    const out = LegacyApiSafeBodySchema.parse(body) as Record<string, unknown>;
    expect(out).not.toHaveProperty('api_key');
    expect(out).not.toHaveProperty('secret_key');
  });

  it('non-secret fields survive intact', () => {
    const out = LegacyApiSafeBodySchema.parse(body) as Record<string, unknown>;
    expect(out['pub_id']).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(out['market']).toBe('BINGX');
    expect(out['balance']).toBe(1423.5);
    expect(out['quarantined']).toBe(false);
  });

  it('the serialized output contains none of the raw key VALUES', () => {
    const str = JSON.stringify(LegacyApiSafeBodySchema.parse(body));
    expect(str).not.toContain('INERT-EXCHANGE-KEY-PLACEHOLDER');
    expect(str).not.toContain('INERT-EXCHANGE-SECRET-PLACEHOLDER');
    expect(str).not.toContain('api_key');
    expect(str).not.toContain('secret_key');
  });

  it('strips nested secret fields (depth > 1)', () => {
    const nested = { pub_id: 'x', settings: { api_key: 'NESTED', valid_setting: 42 } };
    const out = LegacyApiSafeBodySchema.parse(nested) as Record<string, unknown>;
    const settings = out['settings'] as Record<string, unknown>;
    expect(settings).not.toHaveProperty('api_key');
    expect(settings['valid_setting']).toBe(42);
  });

  it('strips secret fields from array elements', () => {
    const arr = [
      { pub_id: 'a', api_key: 'K1', balance: 100 },
      { pub_id: 'b', secret_key: 'S2', balance: 200 },
    ];
    const out = LegacyApiSafeBodySchema.parse(arr) as Record<string, unknown>[];
    expect(out[0]).not.toHaveProperty('api_key');
    expect(out[1]).not.toHaveProperty('secret_key');
    expect(out[0]!['balance']).toBe(100);
  });

  it('a clean body (no secret fields) passes through unchanged', () => {
    const clean = { pub_id: 'x', market: 'BINGX', balance: 500, running: true };
    const out = LegacyApiSafeBodySchema.parse(clean) as Record<string, unknown>;
    expect(out).toEqual(clean);
  });
});
