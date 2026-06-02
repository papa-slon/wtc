import { describe, it, expect } from 'vitest';
import { getBotAdapter } from './factory.ts';
import { createHttpTortilaAdapter, AdapterNotReadyError } from './http.ts';
import { BotControlDisabledError } from './control.ts';
import { CANONICAL_WARNING_CODES, TORTILA_WARNINGS, LEGACY_WARNINGS } from './warnings.ts';

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
    for (const w of [...TORTILA_WARNINGS, ...LEGACY_WARNINGS]) {
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
