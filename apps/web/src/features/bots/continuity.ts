import type { BotHealth, BotProductCode } from '@wtc/bot-adapters';

export type BotContinuityStatus = 'proven' | 'watch' | 'interrupted' | 'pending';
export type BotContinuityTone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface BotContinuityInput {
  productCode: BotProductCode;
  adapterMode: 'mock' | 'real';
  health: BotHealth;
  activeWarningCount?: number;
  dataRows?: number;
  dataRowsLabel?: string;
  dataRowsDetail?: string;
  configSourceLabel?: string;
  connectionLabel?: string;
  expectedCadenceSeconds?: number;
  staleAfterSeconds?: number;
}

export interface BotContinuityRow {
  layer: string;
  status: BotContinuityTone;
  statusLabel: string;
  proof: string;
  detail: string;
}

export interface BotContinuitySummary {
  status: BotContinuityStatus;
  tone: BotContinuityTone;
  label: string;
  headline: string;
  detail: string;
  expectedCadenceSeconds: number;
  staleAfterSeconds: number;
  rows: BotContinuityRow[];
}

function freshnessLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'no age recorded';
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

function runtimeSourceLabel(productCode: BotProductCode): string {
  return productCode === 'legacy_bot' ? 'Legacy provider pub_id snapshot' : 'Tortila journal snapshot';
}

function runtimeSourceDetail(productCode: BotProductCode): string {
  return productCode === 'legacy_bot'
    ? 'Continuity is inferred from the read-only worker snapshot for the mapped provider pub_id; WTC does not call Legacy live-control paths.'
    : 'Continuity is inferred from the read-only worker check of the Tortila journal; WTC does not start, stop, or apply runtime config here.';
}

function continuityStatus(input: Required<Pick<BotContinuityInput, 'adapterMode' | 'activeWarningCount' | 'staleAfterSeconds'>> & {
  health: BotHealth;
}): BotContinuityStatus {
  const readState = input.health.readState;
  if (readState === 'unreachable' || readState === 'malformed') return 'interrupted';
  if (readState === 'not_configured') return 'pending';
  if (!input.health.processAlive) return 'interrupted';
  if (input.adapterMode === 'mock') return 'watch';
  if (!input.health.lastSyncAt) return 'pending';
  if (readState === 'stale') return 'watch';
  if ((input.health.staleDataSeconds ?? 0) > input.staleAfterSeconds) return 'watch';
  if (input.activeWarningCount > 0) return 'watch';
  return readState === 'ok' ? 'proven' : 'watch';
}

function statusTone(status: BotContinuityStatus): BotContinuityTone {
  if (status === 'proven') return 'ok';
  if (status === 'interrupted') return 'bad';
  if (status === 'watch') return 'warn';
  return 'neutral';
}

function statusLabel(status: BotContinuityStatus): string {
  if (status === 'proven') return 'continuity proven';
  if (status === 'interrupted') return 'continuity interrupted';
  if (status === 'watch') return 'watch continuity';
  return 'proof pending';
}

function rowStatusLabel(tone: BotContinuityTone): string {
  if (tone === 'ok') return 'fresh proof';
  if (tone === 'warn') return 'needs review';
  if (tone === 'bad') return 'blocked';
  return 'pending';
}

function headline(status: BotContinuityStatus): string {
  if (status === 'proven') return 'Worker continuity is currently proven';
  if (status === 'interrupted') return 'Runtime continuity is interrupted';
  if (status === 'watch') return 'Runtime continuity needs attention';
  return 'Runtime continuity proof is pending';
}

function summaryDetail(input: BotContinuityInput, status: BotContinuityStatus): string {
  if (status === 'proven') {
    return 'Latest worker evidence is fresh, scoped to this bot surface, and has no active runtime warning count in this view.';
  }
  if (input.adapterMode === 'mock') {
    return 'Mock/demo data keeps the page usable, but it is never green continuity proof for a real bot.';
  }
  if (input.health.readStateDetail) return input.health.readStateDetail;
  if (!input.health.lastSyncAt) return 'No worker heartbeat or runtime snapshot timestamp is available for this scoped bot view yet.';
  return 'Continuity is not green until the worker heartbeat and runtime snapshot are both fresh.';
}

export function buildBotContinuitySummary(input: BotContinuityInput): BotContinuitySummary {
  const activeWarningCount = input.activeWarningCount ?? 0;
  const expectedCadenceSeconds = input.expectedCadenceSeconds ?? 60;
  const staleAfterSeconds = input.staleAfterSeconds ?? 10 * 60;
  const dataRows = input.dataRows ?? 0;
  const dataRowsLabel = input.dataRowsLabel ?? 'scoped rows';
  const status = continuityStatus({ adapterMode: input.adapterMode, activeWarningCount, staleAfterSeconds, health: input.health });
  const tone = statusTone(status);
  const freshEnough = input.health.lastSyncAt !== null && (input.health.staleDataSeconds ?? staleAfterSeconds + 1) <= staleAfterSeconds;
  const readState = input.health.readState ?? input.health.status;

  return {
    status,
    tone,
    label: statusLabel(status),
    headline: headline(status),
    detail: summaryDetail(input, status),
    expectedCadenceSeconds,
    staleAfterSeconds,
    rows: [
      {
        layer: 'Runtime source',
        status: input.adapterMode === 'mock' ? 'warn' : readState === 'ok' ? 'ok' : tone,
        statusLabel: rowStatusLabel(input.adapterMode === 'mock' ? 'warn' : readState === 'ok' ? 'ok' : tone),
        proof: input.adapterMode === 'mock' ? 'mock/demo source' : runtimeSourceLabel(input.productCode),
        detail: runtimeSourceDetail(input.productCode),
      },
      {
        layer: 'Worker cadence',
        status: input.health.lastSyncAt ? (freshEnough ? 'ok' : 'warn') : 'neutral',
        statusLabel: rowStatusLabel(input.health.lastSyncAt ? (freshEnough ? 'ok' : 'warn') : 'neutral'),
        proof: input.health.lastSyncAt ? freshnessLabel(input.health.staleDataSeconds) : 'no heartbeat',
        detail: `Expected worker cadence is about ${expectedCadenceSeconds}s; data older than ${staleAfterSeconds}s is shown as attention, not green.`,
      },
      {
        layer: 'Scoped data rows',
        status: dataRows > 0 ? 'ok' : status === 'interrupted' ? 'bad' : 'neutral',
        statusLabel: rowStatusLabel(dataRows > 0 ? 'ok' : status === 'interrupted' ? 'bad' : 'neutral'),
        proof: `${dataRows} ${dataRowsLabel}`,
        detail: input.dataRowsDetail ?? 'Metrics, positions, trades, equity, warnings, or runtime config count only after entitlement and bot ownership scope pass.',
      },
      ...(input.configSourceLabel ? [{
        layer: 'Settings source',
        status: 'neutral' as const,
        statusLabel: 'visible',
        proof: input.configSourceLabel,
        detail: 'This is the active WTC-side source for saved settings. It does not mean the running bot was changed.',
      }] : []),
      ...(input.connectionLabel ? [{
        layer: 'Connection state',
        status: 'neutral' as const,
        statusLabel: 'visible',
        proof: input.connectionLabel,
        detail: input.productCode === 'legacy_bot'
          ? 'Provider pub_id readiness is diagnostic and admin-scoped; users cannot edit provider mappings here.'
          : 'Exchange-key readiness is metadata-only unless a separately audited live exchange ping is implemented.',
      }] : []),
      {
        layer: 'Silent-stop guard',
        status: tone,
        statusLabel: statusLabel(status),
        proof: statusLabel(status),
        detail: 'Green requires a fresh worker check and non-stale runtime state. Mock/demo data never becomes green continuity proof.',
      },
      {
        layer: 'Control boundary',
        status: 'neutral',
        statusLabel: 'read-only',
        proof: 'no live action',
        detail: 'This monitor never starts, stops, runs connection checks, applies config, opens secrets, or calls a live exchange/provider during render.',
      },
    ],
  };
}

export function uncheckedBotContinuityHealth(productCode: BotProductCode, detail: string): BotHealth {
  return {
    productCode,
    processAlive: false,
    status: 'down',
    readState: 'not_configured',
    readStateDetail: detail,
    lastSyncAt: null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: [],
  };
}
