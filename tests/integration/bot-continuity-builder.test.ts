import { describe, expect, it } from 'vitest';
import { buildBotContinuitySummary, uncheckedBotContinuityHealth } from '../../apps/web/src/features/bots/continuity';
import type { BotHealth } from '@wtc/bot-adapters';

const health = (overrides: Partial<BotHealth> = {}): BotHealth => ({
  productCode: 'tortila_bot',
  processAlive: true,
  status: 'healthy',
  readState: 'ok',
  lastSyncAt: Date.now() - 30_000,
  staleDataSeconds: 30,
  uptimeSeconds: null,
  warnings: [],
  ...overrides,
});

describe('bot continuity summary', () => {
  it('requires real fresh worker proof before continuity is green', () => {
    const summary = buildBotContinuitySummary({
      productCode: 'tortila_bot',
      adapterMode: 'real',
      health: health(),
      activeWarningCount: 0,
      dataRows: 3,
    });
    expect(summary).toMatchObject({ status: 'proven', tone: 'ok', label: 'continuity proven' });
    expect(summary.rows.map((row) => row.layer)).toContain('Silent-stop guard');
    expect(summary.rows.find((row) => row.layer === 'Silent-stop guard')?.statusLabel).toBe('continuity proven');
  });

  it('keeps mock data in attention even when the mock process reports alive', () => {
    const summary = buildBotContinuitySummary({
      productCode: 'legacy_bot',
      adapterMode: 'mock',
      health: health({ productCode: 'legacy_bot' }),
      activeWarningCount: 0,
      dataRows: 4,
    });
    expect(summary.status).toBe('watch');
    expect(summary.detail).toContain('Mock/demo data');
    expect(summary.rows.find((row) => row.layer === 'Silent-stop guard')?.detail).toContain('Mock/demo data never becomes green continuity proof');
  });

  it('marks unreachable, malformed, or process-down runtime as interrupted', () => {
    for (const readState of ['unreachable', 'malformed'] as const) {
      const summary = buildBotContinuitySummary({
        productCode: 'tortila_bot',
        adapterMode: 'real',
        health: health({ readState, status: 'down', processAlive: false, lastSyncAt: null, staleDataSeconds: null }),
      });
      expect(summary).toMatchObject({ status: 'interrupted', tone: 'bad' });
    }
  });

  it('treats stale or warning-bearing runtime as attention rather than all-clear', () => {
    expect(buildBotContinuitySummary({
      productCode: 'tortila_bot',
      adapterMode: 'real',
      health: health({ readState: 'stale', status: 'stale', staleDataSeconds: 900 }),
      dataRows: 1,
    }).status).toBe('watch');

    expect(buildBotContinuitySummary({
      productCode: 'legacy_bot',
      adapterMode: 'real',
      health: health({ productCode: 'legacy_bot' }),
      activeWarningCount: 1,
      dataRows: 1,
    }).status).toBe('watch');
  });

  it('keeps not_configured runtime pending instead of pretending it is down proof', () => {
    const summary = buildBotContinuitySummary({
      productCode: 'legacy_bot',
      adapterMode: 'real',
      health: health({
        productCode: 'legacy_bot',
        processAlive: false,
        status: 'down',
        readState: 'not_configured',
        lastSyncAt: null,
        staleDataSeconds: null,
        readStateDetail: 'Legacy DB live-read is not configured.',
      }),
    });
    expect(summary).toMatchObject({ status: 'pending', tone: 'neutral' });
    expect(summary.detail).toContain('Legacy DB live-read is not configured');
  });

  it('supports settings/setup continuity without fetching runtime proof on that render', () => {
    const unchecked = uncheckedBotContinuityHealth('tortila_bot', 'Runtime proof is not checked on the setup wizard render.');
    const summary = buildBotContinuitySummary({
      productCode: 'tortila_bot',
      adapterMode: 'real',
      health: unchecked,
      dataRows: 6,
      dataRowsLabel: 'setup evidence rows',
      configSourceLabel: 'Built-in Tortila defaults',
      connectionLabel: '0 encrypted key rows',
    });
    expect(summary).toMatchObject({ status: 'pending', tone: 'neutral' });
    expect(summary.rows.find((row) => row.layer === 'Scoped data rows')?.proof).toBe('6 setup evidence rows');
    expect(summary.rows.find((row) => row.layer === 'Settings source')?.proof).toBe('Built-in Tortila defaults');
    expect(summary.rows.find((row) => row.layer === 'Connection state')?.proof).toBe('0 encrypted key rows');
  });
});
