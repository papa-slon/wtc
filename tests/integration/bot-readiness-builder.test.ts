import { describe, expect, it } from 'vitest';
import {
  buildBotReadinessItems,
  providerPubIdSummary,
  runtimeReadinessStatus,
  statisticsReadinessStatus,
  type BuildBotReadinessInput,
} from '../../apps/web/src/features/bots/readiness';

const base = (overrides: Partial<BuildBotReadinessInput> = {}): BuildBotReadinessInput => ({
  productCode: 'tortila_bot',
  botSlug: 'tortila',
  surface: 'dashboard',
  accessAllowed: true,
  accessReason: 'allowed',
  exchangeKeyState: 'missing',
  exchangeKeyCount: 0,
  configSource: 'built_in',
  configSourceLabel: 'Built-in Tortila defaults',
  runtime: {
    adapterMode: 'real',
    readState: 'ok',
    label: 'Healthy',
    processAlive: true,
    lastSyncAt: Date.now() - 30_000,
    staleDataSeconds: 30,
    workerCheckedAt: Date.now() - 30_000,
    workerAgeSeconds: 30,
    workerStatus: 'ok',
    workerCoreStatus: 'ok',
    workerBotContinuityStatus: 'ok',
    workerProductSnapshot: 'ok',
    workerProductReadState: 'ok',
  },
  statistics: { metricsAvailable: true, issueKind: null },
  ...overrides,
});

function row(rows: ReturnType<typeof buildBotReadinessItems>, label: string) {
  const found = rows.find((item) => item.label === label);
  expect(found, `missing row ${label}`).toBeTruthy();
  return found!;
}

describe('bot readiness builder', () => {
  it('maps runtime status without false green states', () => {
    expect(runtimeReadinessStatus(null)).toBe('readonly');
    expect(runtimeReadinessStatus(undefined)).toBe('readonly');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'ok', label: 'Healthy' })).toBe('attention');
    expect(runtimeReadinessStatus({
      adapterMode: 'real',
      readState: 'ok',
      label: 'Healthy',
      processAlive: true,
      lastSyncAt: Date.now(),
      staleDataSeconds: 5,
      workerCheckedAt: Date.now(),
      workerAgeSeconds: 5,
      workerStatus: 'ok',
      workerBotContinuityStatus: 'ok',
      workerProductSnapshot: 'ok',
      workerProductReadState: 'ok',
    })).toBe('ready');
    expect(runtimeReadinessStatus({ adapterMode: 'mock', readState: 'ok', label: 'Healthy' })).toBe('attention');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'stale', label: 'Stale' })).toBe('attention');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'ok', label: 'Old', processAlive: true, lastSyncAt: Date.now() - 900_000, staleDataSeconds: 900 })).toBe('attention');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'ok', label: 'Down', processAlive: false, lastSyncAt: Date.now(), staleDataSeconds: 1 })).toBe('blocked');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'not_configured', label: 'Setup needed' })).toBe('attention');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'unreachable', label: 'Down' })).toBe('blocked');
    expect(runtimeReadinessStatus({ adapterMode: 'real', readState: 'malformed', label: 'Malformed' })).toBe('blocked');
  });

  it('maps statistics availability honestly', () => {
    expect(statisticsReadinessStatus(null)).toBe('readonly');
    expect(statisticsReadinessStatus(undefined)).toBe('readonly');
    expect(statisticsReadinessStatus({ metricsAvailable: false, issueKind: 'blocked' })).toBe('blocked');
    expect(statisticsReadinessStatus({ metricsAvailable: false, issueKind: null })).toBe('attention');
    expect(statisticsReadinessStatus({ metricsAvailable: false, issueKind: 'not_ready' })).toBe('attention');
    expect(statisticsReadinessStatus({ metricsAvailable: false, issueKind: 'error' })).toBe('attention');
    expect(statisticsReadinessStatus({ metricsAvailable: true, issueKind: null })).toBe('ready');
    expect(statisticsReadinessStatus({ metricsAvailable: true, issueKind: 'error' })).toBe('attention');
  });

  it('summarizes provider pub_ids without coercing zero to one', () => {
    expect(providerPubIdSummary(0)).toBe('0 provider pub_ids mapped');
    expect(providerPubIdSummary(1)).toBe('1 provider pub_id mapped');
    expect(providerPubIdSummary(2)).toBe('2 provider pub_ids mapped');
  });

  it('fails closed when access is not allowed', () => {
    const rows = buildBotReadinessItems(base({ accessAllowed: false, accessReason: 'expired', exchangeKeyCount: 1 }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'Access', status: 'blocked', value: 'Expired' });
  });

  it('maps access and config source rows', () => {
    expect(row(buildBotReadinessItems(base({ accessReason: 'allowed' })), 'Access').status).toBe('ready');
    expect(row(buildBotReadinessItems(base({ accessReason: 'grace' })), 'Access').status).toBe('attention');
    expect(row(buildBotReadinessItems(base({ accessAllowed: false, accessReason: 'manual_review' })), 'Access').status).toBe('blocked');
    expect(row(buildBotReadinessItems(base({ configSource: 'built_in' })), 'Strategy source').status).toBe('attention');
    expect(row(buildBotReadinessItems(base({ configSource: 'system_default', configSourceLabel: 'System default v1' })), 'Strategy source').status).toBe('ready');
    expect(row(buildBotReadinessItems(base({ configSource: 'user_override', configSourceLabel: 'Custom v2' })), 'Strategy source').status).toBe('ready');
  });

  it('maps Tortila exchange metadata without claiming live connectivity', () => {
    const missing = row(buildBotReadinessItems(base({ exchangeKeyState: 'missing', exchangeKeyCount: 0 })), 'Exchange key');
    expect(missing).toMatchObject({ status: 'attention', value: 'No key saved', actionLabel: 'Add key' });
    expect(missing.href).toContain('/setup?step=key');

    const metadata = row(buildBotReadinessItems(base({ exchangeKeyState: 'metadata_saved', exchangeKeyCount: 1 })), 'Exchange key');
    expect(metadata).toMatchObject({ status: 'attention', value: 'Exchange metadata saved', actionLabel: 'View keys' });
    expect(`${metadata.value} ${metadata.detail}`).not.toMatch(/Connection verified|live exchange verified/i);

    const confirmed = row(buildBotReadinessItems(base({ exchangeKeyState: 'vault_metadata_confirmed', exchangeKeyCount: 1 })), 'Exchange key');
    expect(confirmed).toMatchObject({ status: 'ready', value: 'WTC vault metadata confirmed' });
  });

  it('maps Legacy pub_id evidence by provenance', () => {
    const missing = row(buildBotReadinessItems(base({
      productCode: 'legacy_bot',
      botSlug: 'legacy',
      providerPubIdState: 'missing',
      providerAccountCount: 0,
    })), 'Provider pub_id');
    expect(missing).toMatchObject({ status: 'attention', value: '0 provider pub_ids mapped' });

    const snapshot = row(buildBotReadinessItems(base({
      productCode: 'legacy_bot',
      botSlug: 'legacy',
      providerPubIdState: 'runtime_snapshot',
      providerAccountCount: 1,
    })), 'Provider pub_id');
    expect(snapshot).toMatchObject({ status: 'attention', value: '1 provider pub_id mapped' });

    const confirmed = row(buildBotReadinessItems(base({
      productCode: 'legacy_bot',
      botSlug: 'legacy',
      providerPubIdState: 'db_mapping_confirmed',
      providerAccountCount: 1,
    })), 'Provider pub_id');
    expect(confirmed).toMatchObject({ status: 'ready', value: '1 provider pub_id mapped' });

    const ambiguous = row(buildBotReadinessItems(base({
      productCode: 'legacy_bot',
      botSlug: 'legacy',
      providerPubIdState: 'ambiguous_mapping',
      providerAccountCount: 2,
    })), 'Provider pub_id');
    expect(ambiguous).toMatchObject({ status: 'blocked', value: '2 provider pub_ids mapped' });
  });

  it('adds an explicit worker heartbeat layer to launch readiness', () => {
    const fresh = row(buildBotReadinessItems(base()), 'Worker heartbeat');
    expect(fresh).toMatchObject({ status: 'ready' });
    expect(fresh.value).toContain('Fresh aggregate');
    expect(fresh.detail).toContain("Latest target='worker' heartbeat is fresh");

    const missing = row(buildBotReadinessItems(base({
      runtime: { adapterMode: 'real', readState: 'ok', label: 'Healthy', processAlive: true, lastSyncAt: Date.now(), staleDataSeconds: 1, workerCheckedAt: null, workerAgeSeconds: null },
    })), 'Worker heartbeat');
    expect(missing).toMatchObject({ status: 'attention', value: 'No aggregate worker row' });

    const interrupted = row(buildBotReadinessItems(base({
      runtime: {
        adapterMode: 'real',
        readState: 'ok',
        label: 'Healthy',
        processAlive: false,
        lastSyncAt: Date.now(),
        staleDataSeconds: 1,
        workerCheckedAt: Date.now(),
        workerAgeSeconds: 1,
        workerStatus: 'ok',
        workerBotContinuityStatus: 'ok',
        workerProductSnapshot: 'error',
        workerProductReadState: 'ok',
      },
    })), 'Worker heartbeat');
    expect(interrupted.status).toBe('blocked');
  });

  it('returns surface-specific row sets', () => {
    expect(buildBotReadinessItems(base({ surface: 'dashboard' })).map((item) => item.label)).toEqual([
      'Access',
      'Exchange key',
      'Strategy source',
      'Worker heartbeat',
      'Runtime snapshot',
      'Statistics',
      'Live control',
    ]);
    expect(buildBotReadinessItems(base({ surface: 'settings', includeOperationalRows: false })).map((item) => item.label)).toEqual([
      'Access',
      'Exchange key',
      'Settings source',
      'Live apply',
    ]);
    expect(buildBotReadinessItems(base({ surface: 'setup-review' })).map((item) => item.label)).toEqual([
      'Access',
      'Exchange key',
      'Strategy source',
      'Worker heartbeat',
      'Runtime snapshot',
      'Statistics',
      'Live control',
    ]);
    expect(buildBotReadinessItems(base({ surface: 'cabinet' })).map((item) => item.label)).toEqual([
      'Access',
      'Exchange key',
      'Strategy source',
      'Worker heartbeat',
      'Runtime snapshot',
      'Statistics',
      'Live control',
    ]);
  });
});
