import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { healthCheckStatusFor } from '../../apps/worker/src/jobs.ts';
import {
  botContinuityStatus,
  finalWorkerHealthStatus,
  workerSafetyState,
} from '../../apps/worker/src/index.ts';
import { buildBotContinuitySummary } from '../../apps/web/src/features/bots/continuity';
import {
  warningCodesFromValue,
  warningsFromCodes,
  warningsFromDetail,
} from '../../packages/bot-adapters/src/warnings.ts';
import type { BotHealth } from '@wtc/bot-adapters';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const runtimeHealth = (overrides: Partial<BotHealth> = {}): BotHealth => ({
  productCode: 'legacy_bot',
  processAlive: true,
  status: 'healthy',
  readState: 'ok',
  readStateDetail: undefined,
  lastSyncAt: Date.now() - 20_000,
  staleDataSeconds: 20,
  uptimeSeconds: null,
  warnings: [],
  ...overrides,
});

describe('two-bot continuity contract fixture', () => {
  it('is green only when core worker, Tortila, and Legacy runtime reads are all ok', () => {
    const outcomes = [
      { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
    ];

    expect(healthCheckStatusFor('ok', true)).toBe('ok');
    expect(finalWorkerHealthStatus('ok', outcomes)).toBe('ok');
    expect(botContinuityStatus(outcomes)).toBe('ok');
  });

  it('keeps setup-needed Legacy or Tortila reads in attention, not outage or green', () => {
    const outcomes = [
      { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'skipped' as const, readState: 'not_configured', healthStatus: 'not_configured' },
    ];

    expect(healthCheckStatusFor('not_configured', false)).toBe('not_configured');
    expect(finalWorkerHealthStatus('ok', outcomes)).toBe('not_configured');
    expect(botContinuityStatus(outcomes)).toBe('attention');

    const summary = buildBotContinuitySummary({
      productCode: 'legacy_bot',
      adapterMode: 'real',
      health: runtimeHealth({
        processAlive: false,
        status: 'down',
        readState: 'not_configured',
        readStateDetail: 'Legacy DB live-read is not configured.',
        lastSyncAt: null,
        staleDataSeconds: null,
      }),
      dataRows: 0,
    });
    expect(summary).toMatchObject({ status: 'pending', tone: 'neutral' });
    expect(summary.detail).toContain('Legacy DB live-read is not configured');
  });

  it('escalates malformed or unreachable bot reads to worker continuity error', () => {
    expect(healthCheckStatusFor('unreachable', false)).toBe('down');
    expect(healthCheckStatusFor('malformed', false)).toBe('error');

    expect(finalWorkerHealthStatus('ok', [
      { snapshot: 'ok', readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'error', readState: 'malformed', healthStatus: 'error' },
    ])).toBe('error');
    expect(botContinuityStatus([
      { snapshot: 'ok', readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'error', readState: 'unreachable', healthStatus: 'down' },
    ])).toBe('error');
  });

  it('keeps live-control and TradingView automation disabled in local worker safety state', () => {
    expect(workerSafetyState({})).toEqual({
      liveControlDisabled: true,
      tvAutomationDisabled: true,
      status: 'ok',
    });
    expect(workerSafetyState({ FEATURE_LIVE_BOT_CONTROL: 'true' }).status).toBe('misconfigured');
    expect(workerSafetyState({ FEATURE_TV_AUTOMATION: '1' }).status).toBe('misconfigured');
  });

  it('preserves canonical warning truth and drops unknown or cross-product warning strings', () => {
    const tortila = warningsFromCodes('tortila_bot', ['rate_limit_100410', 'no_trade_history']);
    const tortilaCodes = tortila.map((warning) => warning.code);
    expect(tortilaCodes).toEqual(expect.arrayContaining([
      'tp_reconcile_p0',
      'margin_preflight_p1',
      'rate_limit_100410',
    ]));
    expect(tortilaCodes).not.toContain('no_trade_history');

    const legacy = warningsFromDetail('legacy_bot', {
      warnings: ['no_trade_history', 'apiSecret=abc123', 'tp_reconcile_p0'],
      warningCodes: [{ code: 'legacy_plaintext_keys' }, { code: 'exchange_flat_mismatch' }],
    });
    expect(legacy.map((warning) => warning.code)).toEqual(['no_trade_history', 'legacy_plaintext_keys']);
    expect(warningCodesFromValue(['apiSecret=abc123', 'postgres://user:password@example/db'])).toEqual([]);
  });

  it('locks the Legacy runtime-vs-performance boundary when runtime reads are ok', () => {
    const legacyLive = read('apps/worker/src/legacy-live.ts');
    const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');

    expect(legacyLive).toContain("const warnings = ['no_trade_history']");
    expect(legacyLive).toContain("sourceAdapter: 'legacy-db'");
    expect(legacyLive).toContain('closedPnlUsd: undefined');
    expect(legacyLive).toContain('winRate: undefined');
    expect(legacyLive).toContain('profitFactor: undefined');
    expect(legacyLive).toContain('totalFeesUsd: undefined');
    expect(legacyLive).toContain('totalFundingUsd: undefined');
    expect(legacyLive).toContain('tradeCount: 0');
    // The premium statistics page upgrades the Legacy tab to the reconstructed DCA terminal via the
    // SAFE read-only journal shim, and still refuses to fabricate Legacy performance numbers.
    expect(statsPage).toContain('loadLegacyLiveOverview');
    expect(statsPage).toContain('LegacyOverview');
    expect(statsPage).toContain('never fabricates a $0 account or placeholder positions');
    expect(statsPage).not.toMatch(/reconstructed PnL.*\$[0-9]/);
  });

  it('keeps the no-env fixture separate from provider probes, managed DB, and live adapters', () => {
    const pkg = read('package.json');
    const gates = read('scripts/gates.mjs');
    const factory = read('packages/bot-adapters/src/factory.ts');
    const adapterIndex = read('packages/bot-adapters/src/index.ts');
    const http = read('packages/bot-adapters/src/http.ts');
    const tortilaContract = read('docs/CONTRACTS/tortila-adapter.md');
    const workerJobs = read('apps/worker/src/jobs.ts');
    const adminUserBots = read('apps/web/src/app/admin/users/[userId]/bots/page.tsx');
    const legacyLive = read('apps/worker/src/legacy-live.ts');

    expect(pkg).toContain('"accept:bots:continuity:contract"');
    expect(pkg).toContain('"accept:worker:continuity:fixture"');
    expect(gates).toContain("'worker-continuity-fixture'");
    expect(gates).toContain("'bot-continuity-local'");
    expect(gates).toContain("const LOCAL_BOT_ADMIN_MODES = new Set(['bot-admin-e2e', 'bot-admin-local', 'bot-continuity-local'])");
    expect(gates).not.toContain('accept:worker:continuity:managed');
    expect(factory).toContain('legacyBaseUrl');
    expect(factory).toContain('cannot activate a real adapter');
    expect(adapterIndex).not.toMatch(/export\s+\{[^}]*createHttpLegacyAdapter/);
    expect(http).toContain('NEVER calls /api/marks');
    expect(http).toContain('Control methods are DISABLED unconditionally');
    expect(tortilaContract).toContain('**NEVER CONSUME FROM WTC');
    expect(tortilaContract).toContain('WTC worker must never poll `/api/marks`');
    expect(tortilaContract).not.toContain('| `/api/marks` | GET | Live mark prices for open positions | Open position display |');
    expect(tortilaContract).not.toContain('| `/api/marks` | 60 seconds');
    expect(tortilaContract).not.toContain('must not poll faster than every 30 seconds for marks');
    expect(tortilaContract).not.toContain('| Marks endpoint (calls BingX) | 20 seconds |');
    expect(tortilaContract).not.toContain('`marks — BingX down`');
    expect(tortilaContract).toContain('`/api/marks` has no WTC timeout budget because WTC must never call it');
    expect(tortilaContract).toContain('`/api/marks` is excluded from WTC integration tests');
    expect(workerJobs).toContain('shouldPersistTortilaMarkPlaceholders');
    expect(workerJobs).toContain("adapter.mode !== 'real'");
    expect(adminUserBots).toContain('positionMarkLabel');
    expect(adminUserBots).toContain("if (bot.productCode === 'tortila_bot') return 'N/A'");
    expect(legacyLive).toContain('assertNoSecretFields');
    const selectedColumnBlocks = Array.from(legacyLive.matchAll(/select\s+([\s\S]*?)\s+from\s+/gi))
      .map((match) => match[1])
      .join('\n');
    expect(selectedColumnBlocks).not.toMatch(/\b(api_key|api_secret|secret_key|apiSecret|apiKey)\b/i);
  });
});
