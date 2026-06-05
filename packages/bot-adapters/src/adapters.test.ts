import { describe, it, expect } from 'vitest';
import { getBotAdapter } from './factory.ts';
import { createHttpTortilaAdapter, AdapterNotReadyError } from './http.ts';
import { BotControlDisabledError } from './control.ts';
import {
  CANONICAL_WARNING_CODES,
  LEGACY_RUNTIME_WARNINGS,
  TORTILA_WARNINGS,
  knownWarningsForProduct,
  warningCodesFromDetail,
  warningSummaryFromWarnings,
  warningsFromDetail,
} from './warnings.ts';

describe('adapter flag governance (BOT_ADAPTER_MODE)', () => {
  it('defaults to mock adapters', () => {
    expect(getBotAdapter('tortila_bot', { mode: 'mock' }).mode).toBe('mock');
    expect(getBotAdapter('legacy_bot', { mode: 'mock' }).mode).toBe('mock');
  });

  it('cannot accidentally connect: read-only without a base url stays mock', () => {
    expect(getBotAdapter('tortila_bot', { mode: 'read-only' }).mode).toBe('mock');
    expect(getBotAdapter('tortila_bot', { mode: 'read-only', tortilaBaseUrl: 'http://127.0.0.1:65535' }).mode).toBe('real');
  });

  it('real adapter data methods are stubbed (no fabricated data) and control is disabled', async () => {
    const real = createHttpTortilaAdapter('http://127.0.0.1:65535');
    await expect(real.getConfig('x')).rejects.toThrow(AdapterNotReadyError);
    await expect(real.getMetrics('x')).rejects.toThrow(AdapterNotReadyError);
    await expect(real.getTrades('x')).rejects.toThrow(AdapterNotReadyError);
    await expect(real.startBot('x')).rejects.toThrow(BotControlDisabledError);
    await expect(real.stopBot('x')).rejects.toThrow(BotControlDisabledError);
  });

  it('mock control methods are also disabled', async () => {
    const mock = getBotAdapter('tortila_bot', { mode: 'mock' });
    await expect(mock.startBot('x')).rejects.toThrow(BotControlDisabledError);
    await expect(mock.applyConfig('x', {})).rejects.toThrow(BotControlDisabledError);
  });
});

describe('Tortila unresolved warnings persist across adapter modes', () => {
  it('mock surfaces tp_reconcile_p0 + margin_preflight_p1', async () => {
    const h = await getBotAdapter('tortila_bot', { mode: 'mock' }).getHealth();
    const codes = h.warnings.map((w) => w.code);
    expect(codes).toContain('tp_reconcile_p0');
    expect(codes).toContain('margin_preflight_p1');
  });

  it('real adapter getHealth still includes the P0/P1 warnings (not dropped on mode switch)', async () => {
    const h = await createHttpTortilaAdapter('http://127.0.0.1:65535').getHealth();
    const codes = h.warnings.map((w) => w.code);
    expect(codes).toContain('tp_reconcile_p0');
    expect(codes).toContain('margin_preflight_p1');
    expect(h.status).not.toBe('healthy');
  });
});

describe('warning codes match the documented canonical set', () => {
  it('every mock/http warning code is canonical', () => {
    for (const w of [...TORTILA_WARNINGS, ...LEGACY_RUNTIME_WARNINGS]) {
      expect(CANONICAL_WARNING_CODES).toContain(w.code as (typeof CANONICAL_WARNING_CODES)[number]);
    }
  });

  it('every adapter getWarnings() returns only canonical codes (mock + real, both bots)', async () => {
    const adapters = [
      getBotAdapter('tortila_bot', { mode: 'mock' }),
      getBotAdapter('legacy_bot', { mode: 'mock' }),
      createHttpTortilaAdapter('http://127.0.0.1:65535', 'unit-test-token'),
    ];
    for (const a of adapters) {
      const warnings = await a.getWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      for (const w of warnings) {
        expect(CANONICAL_WARNING_CODES).toContain(w.code as (typeof CANONICAL_WARNING_CODES)[number]);
      }
    }
  });

  it('getHealth().warnings delegates to getWarnings() (no drift between the two surfaces)', async () => {
    const mock = getBotAdapter('tortila_bot', { mode: 'mock' });
    const [health, warnings] = await Promise.all([mock.getHealth(), mock.getWarnings()]);
    expect(health.warnings.map((w) => w.code)).toEqual(warnings.map((w) => w.code));
  });
});

describe('shared warning normalizer', () => {
  it('extracts only canonical warning codes from mixed health detail shapes', () => {
    expect(warningCodesFromDetail({
      warnings: ['tp_reconcile_p0', { code: 'margin_preflight_p1' }, 'apiKey=SECRET_SHOULD_DROP'],
      warningCodes: ['tp_reconcile_p0', 'legacy_quarantined', 'not_real'],
    })).toEqual(['tp_reconcile_p0', 'margin_preflight_p1', 'legacy_quarantined']);
  });

  it('maps warning codes through the product registry without cross-product leakage', () => {
    const legacyWarnings = warningsFromDetail('legacy_bot', {
      warnings: [{ code: 'no_trade_history' }],
      warningCodes: ['legacy_quarantined', 'tp_reconcile_p0', 'apiSecret=SECRET_SHOULD_DROP'],
    });
    expect(legacyWarnings.map((w) => w.code)).toEqual(['no_trade_history', 'legacy_quarantined']);
    expect(JSON.stringify(legacyWarnings)).not.toContain('SECRET_SHOULD_DROP');

    const tortilaWarnings = warningsFromDetail('tortila_bot', {
      warningCodes: ['fill_lookup_109421', 'legacy_quarantined'],
    });
    expect(tortilaWarnings.map((w) => w.code)).toEqual(['tp_reconcile_p0', 'margin_preflight_p1', 'fill_lookup_109421']);
  });

  it('summarizes known product warnings for compact UI DTOs', () => {
    expect(knownWarningsForProduct('legacy_bot').map((w) => w.code)).toEqual([
      'ws_fallback',
      'legacy_plaintext_keys',
      'no_trade_history',
    ]);
    expect(warningSummaryFromWarnings(knownWarningsForProduct('legacy_bot'))).toEqual({
      count: 3,
      maxSeverity: 'warning',
    });
  });
});
