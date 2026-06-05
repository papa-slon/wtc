import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, like, ne, or } from 'drizzle-orm';
import { schema, type Db } from '@wtc/db';
import {
  warningSummaryFromWarnings,
  warningsFromDetail,
  type BotProductCode,
  type RiskWarning,
} from '@wtc/bot-adapters';
import { projectHealthDetail } from './health-detail';
import type {
  AdminBotHealthResult,
  AdminBotWarningSummary,
  HealthCheckView,
  LegacyActiveOrderAdminView,
  LegacyActiveSlotAdminView,
  LegacyMappedUserAdminView,
  LegacyProviderAccountAdminView,
  TortilaFleetSnapshotAdminView,
} from './types';

const BOT_HEALTH_TARGETS = ['tortila-journal', 'legacy-bot'] as const;
const BOT_HEALTH_TARGET_VALUES = [...BOT_HEALTH_TARGETS];
const ADMIN_WORKER_CONTINUITY_STALE_AFTER_SECONDS = 3 * 60;

export interface AdminBotHealthBase {
  adapterMode: string;
  liveControlDisabled: true;
  legacyAdapterBlocked: boolean;
  legacyDbLiveReadEnabled: boolean;
  legacyDatabaseConfigured: boolean;
  tortilaBaseUrlConfigured: boolean;
}

export function emptyAdminBotHealth(base: AdminBotHealthBase, mode: AdminBotHealthResult['mode']): AdminBotHealthResult {
  return {
    ...base,
    mode,
    tortilaLastOkAt: null,
    tortilaLastError: null,
    tortilaJournalStatus: null,
    tortilaJournalReadState: null,
    tortilaJournalReadStateDetail: null,
    workerBotContinuity: null,
    latestSnapshot: null,
    tortilaFleetSnapshots: [],
    legacyProviderAccounts: [],
    legacyActiveSlots: [],
    legacyActiveOrders: [],
    botHealthChecks: [],
    botWarningSummaries: [],
  };
}

function productForHealthTarget(target: string): BotProductCode | null {
  if (target === 'tortila-journal' || target.startsWith('bot.tortila')) return 'tortila_bot';
  if (target === 'legacy-bot' || target.startsWith('legacy-bot') || target.startsWith('bot.legacy')) return 'legacy_bot';
  return null;
}

function detailText(detail: Record<string, unknown> | null, key: string): string | null {
  const value = detail?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function workerBotContinuityView(row: {
  status: string;
  detail: unknown;
  checkedAt: Date;
}, now = Date.now()): AdminBotHealthResult['workerBotContinuity'] {
  const detail = projectHealthDetail(row.detail);
  const ageSeconds = Math.max(0, Math.round((now - row.checkedAt.getTime()) / 1000));
  return {
    status: row.status,
    checkedAt: row.checkedAt.getTime(),
    freshness: ageSeconds > ADMIN_WORKER_CONTINUITY_STALE_AFTER_SECONDS ? 'stale' : 'fresh',
    ageSeconds,
    staleAfterSeconds: ADMIN_WORKER_CONTINUITY_STALE_AFTER_SECONDS,
    coreWorkerStatus: detailText(detail, 'coreWorkerStatus'),
    botContinuityStatus: detailText(detail, 'botContinuityStatus'),
    tortilaSnapshot: detailText(detail, 'tortilaSnapshot'),
    tortilaHealthStatus: detailText(detail, 'tortilaHealthStatus'),
    tortilaReadState: detailText(detail, 'tortilaReadState'),
    legacySnapshot: detailText(detail, 'legacySnapshot'),
    legacyHealthStatus: detailText(detail, 'legacyHealthStatus'),
    legacyReadState: detailText(detail, 'legacyReadState'),
  };
}

function warningView(warning: RiskWarning) {
  return {
    code: warning.code,
    severity: warning.severity,
    title: warning.title,
    detail: warning.detail,
  };
}

function botWarningSummaryFromHealthRow(row: {
  target: string;
  detail: Record<string, unknown> | null;
  checkedAt: Date;
}): AdminBotWarningSummary | null {
  const productCode = productForHealthTarget(row.target);
  if (!productCode) return null;
  const warnings = warningsFromDetail(productCode, row.detail ?? {});
  const summary = warningSummaryFromWarnings(warnings);
  return {
    target: row.target,
    productCode,
    status: warnings.length > 0 ? 'warnings_present' : 'none_reported',
    count: summary.count,
    maxSeverity: summary.maxSeverity,
    warnings: warnings.map(warningView),
    evaluatedAt: row.checkedAt.getTime(),
    source: 'integration_health_checks',
  };
}

function legacyRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

interface LegacyMetricSnapshotSource {
  snapshotAt: Date;
  rawJson: Record<string, unknown> | null;
}

interface LegacyRuntimeRowSource {
  row: Record<string, unknown>;
  snapshotAt: Date;
}

function legacyNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function legacyText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedProviderId(value: string): string {
  return value.trim();
}

function maskLegacyPubId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 10) {
    const fingerprint = createHash('sha256').update(trimmed).digest('hex').slice(0, 8);
    return `id#${fingerprint}`;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function mappedUserView(row: {
  id: string;
  userId: string;
  botInstanceId: string;
  providerAccountId: string;
  label: string | null;
  updatedAt: Date;
  email: string;
  displayName: string | null;
}): LegacyMappedUserAdminView {
  return {
    providerMappingId: row.id,
    userId: row.userId,
    botInstanceId: row.botInstanceId,
    displayName: row.displayName ?? row.email,
    email: row.email,
    providerLabel: row.label,
    mappedAt: row.updatedAt.getTime(),
  };
}

async function legacyProviderMappings(db: Db): Promise<Map<string, LegacyMappedUserAdminView>> {
  const rows = await db
    .select({
      id: schema.botProviderAccounts.id,
      userId: schema.botProviderAccounts.userId,
      botInstanceId: schema.botProviderAccounts.botInstanceId,
      providerAccountId: schema.botProviderAccounts.providerAccountId,
      label: schema.botProviderAccounts.label,
      updatedAt: schema.botProviderAccounts.updatedAt,
      email: schema.users.email,
      displayName: schema.users.displayName,
    })
    .from(schema.botProviderAccounts)
    .innerJoin(schema.users, eq(schema.botProviderAccounts.userId, schema.users.id))
    .where(and(
      eq(schema.botProviderAccounts.productCode, 'legacy_bot'),
      eq(schema.botProviderAccounts.provider, 'legacy-db'),
      eq(schema.botProviderAccounts.status, 'active'),
    ))
    .orderBy(desc(schema.botProviderAccounts.updatedAt))
    .limit(500);

  const byProviderId = new Map<string, LegacyMappedUserAdminView>();
  for (const row of rows) {
    const key = normalizedProviderId(row.providerAccountId);
    if (key && !byProviderId.has(key)) byProviderId.set(key, mappedUserView(row));
  }
  return byProviderId;
}

async function tortilaFleetSnapshots(db: Db): Promise<TortilaFleetSnapshotAdminView[]> {
  const rows = await db
    .select({
      botInstanceId: schema.botMetricSnapshots.botInstanceId,
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
      tradeCount: schema.botMetricSnapshots.tradeCount,
      sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
      userId: schema.botInstances.userId,
      email: schema.users.email,
      displayName: schema.users.displayName,
    })
    .from(schema.botMetricSnapshots)
    .innerJoin(schema.botInstances, eq(schema.botMetricSnapshots.botInstanceId, schema.botInstances.id))
    .innerJoin(schema.users, eq(schema.botInstances.userId, schema.users.id))
    .where(eq(schema.botInstances.productCode, 'tortila_bot'))
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(100);

  const latestByInstance = new Map<string, TortilaFleetSnapshotAdminView>();
  for (const row of rows) {
    if (latestByInstance.has(row.botInstanceId)) continue;
    latestByInstance.set(row.botInstanceId, {
      botInstanceId: row.botInstanceId,
      ownerUser: {
        userId: row.userId,
        displayName: row.displayName ?? row.email,
        email: row.email,
      },
      snapshotAt: row.snapshotAt.getTime(),
      walletEquityUsd: row.walletEquityUsd ?? null,
      tradeCount: row.tradeCount,
      sourceAdapter: row.sourceAdapter,
      scope: 'bot_instance_owner',
    });
  }
  return Array.from(latestByInstance.values()).slice(0, 25);
}

function legacyLiveConfigFromSnapshot(snapshot: LegacyMetricSnapshotSource): Record<string, unknown> {
  const raw = snapshot.rawJson ?? {};
  return raw.liveConfig && typeof raw.liveConfig === 'object'
    ? raw.liveConfig as Record<string, unknown>
    : {};
}

function legacyRuntimeSources(
  snapshots: readonly LegacyMetricSnapshotSource[],
  key: 'providerAccounts' | 'activeSlots' | 'activeOrderSummary',
): LegacyRuntimeRowSource[] {
  const out: LegacyRuntimeRowSource[] = [];
  for (const snapshot of snapshots) {
    const liveConfig = legacyLiveConfigFromSnapshot(snapshot);
    for (const row of legacyRows(liveConfig[key])) out.push({ row, snapshotAt: snapshot.snapshotAt });
  }
  return out;
}

function latestLegacyProviderAccounts(
  snapshots: readonly LegacyMetricSnapshotSource[],
  mappedUserFor: (pubId: string) => LegacyMappedUserAdminView | null,
): LegacyProviderAccountAdminView[] {
  const byPubId = new Map<string, LegacyRuntimeRowSource>();
  for (const source of legacyRuntimeSources(snapshots, 'providerAccounts')) {
    const rawPubId = legacyText(source.row.pubId);
    if (!rawPubId) continue;
    const existing = byPubId.get(rawPubId);
    if (!existing || source.snapshotAt.getTime() > existing.snapshotAt.getTime()) byPubId.set(rawPubId, source);
  }

  return [...byPubId.entries()].map(([rawPubId, source]) => ({
    pubId: maskLegacyPubId(rawPubId),
    mappedUser: mappedUserFor(rawPubId),
    market: legacyText(source.row.market) || 'BINGX',
    running: source.row.running === true,
    balance: legacyNum(source.row.balance),
    quarantined: source.row.quarantined === true,
    quarantineReason: typeof source.row.quarantineReason === 'string' ? source.row.quarantineReason : null,
    symbols: legacyNum(source.row.symbols) ?? 0,
    activeSlots: legacyNum(source.row.activeSlots) ?? 0,
    activeOrders: legacyNum(source.row.activeOrders) ?? 0,
    latestSnapshotAt: source.snapshotAt.getTime(),
  }));
}

function latestLegacyActiveSlots(
  snapshots: readonly LegacyMetricSnapshotSource[],
  mappedUserFor: (pubId: string) => LegacyMappedUserAdminView | null,
): LegacyActiveSlotAdminView[] {
  const byKey = new Map<string, LegacyRuntimeRowSource>();
  for (const source of legacyRuntimeSources(snapshots, 'activeSlots')) {
    const rawPubId = legacyText(source.row.providerPubId);
    const symbol = legacyText(source.row.symbol);
    if (!rawPubId || !symbol) continue;
    const key = `${rawPubId}\u0000${symbol}\u0000${legacyNum(source.row.stage) ?? ''}\u0000${legacyText(source.row.signal)}`;
    const existing = byKey.get(key);
    if (!existing || source.snapshotAt.getTime() > existing.snapshotAt.getTime()) byKey.set(key, source);
  }

  return [...byKey.values()].map((source) => {
    const rawPubId = legacyText(source.row.providerPubId);
    return {
      pubId: maskLegacyPubId(rawPubId),
      mappedUser: mappedUserFor(rawPubId),
      symbol: legacyText(source.row.symbol),
      signal: legacyText(source.row.signal),
      stage: legacyNum(source.row.stage),
      averagingCount: legacyNum(source.row.averagingCount),
      openedAt: legacyNum(source.row.openedAt),
    };
  });
}

function latestLegacyActiveOrders(
  snapshots: readonly LegacyMetricSnapshotSource[],
  mappedUserFor: (pubId: string) => LegacyMappedUserAdminView | null,
): LegacyActiveOrderAdminView[] {
  const byKey = new Map<string, LegacyRuntimeRowSource>();
  for (const source of legacyRuntimeSources(snapshots, 'activeOrderSummary')) {
    const rawPubId = legacyText(source.row.providerPubId);
    const symbol = legacyText(source.row.symbol);
    if (!rawPubId || !symbol) continue;
    const key = `${rawPubId}\u0000${symbol}\u0000${legacyText(source.row.note)}\u0000${legacyNum(source.row.price) ?? ''}`;
    const existing = byKey.get(key);
    if (!existing || source.snapshotAt.getTime() > existing.snapshotAt.getTime()) byKey.set(key, source);
  }

  return [...byKey.values()].map((source) => {
    const rawPubId = legacyText(source.row.providerPubId);
    return {
      pubId: maskLegacyPubId(rawPubId),
      mappedUser: mappedUserFor(rawPubId),
      symbol: legacyText(source.row.symbol),
      note: legacyText(source.row.note),
      qty: legacyNum(source.row.qty),
      price: legacyNum(source.row.price),
    };
  });
}

export async function loadAdminBotHealthFromDb(
  db: Db,
  base: AdminBotHealthBase,
  options: { now?: number } = {},
): Promise<AdminBotHealthResult> {
  const now = options.now ?? Date.now();
  const [workerHealthRow] = await db
    .select({
      status: schema.integrationHealthChecks.status,
      detail: schema.integrationHealthChecks.detail,
      checkedAt: schema.integrationHealthChecks.checkedAt,
    })
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, 'worker'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const [lastOk] = await db
    .select({ id: schema.integrationHealthChecks.id, checkedAt: schema.integrationHealthChecks.checkedAt })
    .from(schema.integrationHealthChecks)
    .where(and(eq(schema.integrationHealthChecks.target, 'tortila-journal'), eq(schema.integrationHealthChecks.status, 'ok')))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const [lastErr] = await db
    .select({ status: schema.integrationHealthChecks.status, detail: schema.integrationHealthChecks.detail, checkedAt: schema.integrationHealthChecks.checkedAt })
    .from(schema.integrationHealthChecks)
    .where(and(eq(schema.integrationHealthChecks.target, 'tortila-journal'), ne(schema.integrationHealthChecks.status, 'ok')))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const [latestJournal] = await db
    .select({ status: schema.integrationHealthChecks.status, detail: schema.integrationHealthChecks.detail, checkedAt: schema.integrationHealthChecks.checkedAt })
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, 'tortila-journal'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const latestJournalDetail = projectHealthDetail(latestJournal?.detail);
  const latestReadState =
    typeof latestJournalDetail?.readState === 'string' ? latestJournalDetail.readState : null;
  const latestReadStateDetail =
    typeof latestJournalDetail?.readStateDetail === 'string'
      ? latestJournalDetail.readStateDetail.slice(0, 200)
      : null;

  const tortilaLastError = lastErr
    ? (() => {
        if (lastErr.status === 'not_configured' || lastErr.status === 'stale') return null;
        const d = projectHealthDetail(lastErr.detail);
        const msg = d?.error ?? d?.message ?? null;
        return msg ? String(msg).slice(0, 200) : 'error (no detail)';
      })()
    : null;

  const [snap] = await db
    .select({
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
      sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
    })
    .from(schema.botMetricSnapshots)
    .innerJoin(schema.botInstances, eq(schema.botMetricSnapshots.botInstanceId, schema.botInstances.id))
    .where(eq(schema.botInstances.productCode, 'tortila_bot'))
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(1);

  const legacySnapshotRows = await db
    .select({
      botProviderAccountId: schema.botMetricSnapshots.botProviderAccountId,
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      rawJson: schema.botMetricSnapshots.rawJson,
    })
    .from(schema.botMetricSnapshots)
    .innerJoin(schema.botInstances, eq(schema.botMetricSnapshots.botInstanceId, schema.botInstances.id))
    .where(eq(schema.botInstances.productCode, 'legacy_bot'))
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(100);

  const [mappingByPubId, tortilaSnapshots] = await Promise.all([
    legacyProviderMappings(db),
    tortilaFleetSnapshots(db),
  ]);
  const mappedUserFor = (pubId: string): LegacyMappedUserAdminView | null =>
    mappingByPubId.get(normalizedProviderId(pubId)) ?? null;

  const latestLegacySnapshotByProvider = new Map<string, LegacyMetricSnapshotSource>();
  for (const row of legacySnapshotRows) {
    const key = row.botProviderAccountId ?? `unscoped:${row.snapshotAt.getTime()}`;
    if (!latestLegacySnapshotByProvider.has(key)) {
      latestLegacySnapshotByProvider.set(key, {
        snapshotAt: row.snapshotAt,
        rawJson: (row.rawJson ?? {}) as Record<string, unknown>,
      });
    }
  }
  const legacySnapshots = [...latestLegacySnapshotByProvider.values()];
  const legacyProviderAccounts = latestLegacyProviderAccounts(legacySnapshots, mappedUserFor);
  const legacyActiveSlots = latestLegacyActiveSlots(legacySnapshots, mappedUserFor);
  const legacyActiveOrders = latestLegacyActiveOrders(legacySnapshots, mappedUserFor);

  const recentBotHealthRows = await db
    .select()
    .from(schema.integrationHealthChecks)
    .where(or(
      inArray(schema.integrationHealthChecks.target, BOT_HEALTH_TARGET_VALUES),
      like(schema.integrationHealthChecks.target, 'bot.%'),
    ))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(100);

  const latestExpectedRows = await Promise.all(BOT_HEALTH_TARGETS.map(async (target) => {
    const [row] = await db
      .select()
      .from(schema.integrationHealthChecks)
      .where(eq(schema.integrationHealthChecks.target, target))
      .orderBy(desc(schema.integrationHealthChecks.checkedAt))
      .limit(1);
    return row ?? null;
  }));

  const botHealthRowsById = new Map<string, (typeof recentBotHealthRows)[number]>();
  for (const row of latestExpectedRows) {
    if (!row || botHealthRowsById.has(row.id)) continue;
    botHealthRowsById.set(row.id, row);
  }
  for (const row of recentBotHealthRows) {
    if (!botHealthRowsById.has(row.id)) botHealthRowsById.set(row.id, row);
  }
  const botHealthCheckRows = Array.from(botHealthRowsById.values())
    .sort((a, b) => b.checkedAt.getTime() - a.checkedAt.getTime());

  const botHealthChecks: HealthCheckView[] = botHealthCheckRows
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      target: r.target,
      status: r.status,
      detail: projectHealthDetail(r.detail),
      checkedAt: r.checkedAt.getTime(),
    }));

  const latestWarningRows = new Map<string, { target: string; detail: Record<string, unknown> | null; checkedAt: Date }>();
  for (const row of botHealthCheckRows) {
    if (!productForHealthTarget(row.target) || latestWarningRows.has(row.target)) continue;
    latestWarningRows.set(row.target, {
      target: row.target,
      detail: projectHealthDetail(row.detail),
      checkedAt: row.checkedAt,
    });
  }
  const botWarningSummaries = Array.from(latestWarningRows.values())
    .map(botWarningSummaryFromHealthRow)
    .filter((summary): summary is AdminBotWarningSummary => summary !== null);

  return {
    ...base,
    mode: 'postgres',
    workerBotContinuity: workerHealthRow ? workerBotContinuityView(workerHealthRow, now) : null,
    tortilaLastOkAt: lastOk ? lastOk.checkedAt.getTime() : null,
    tortilaLastError,
    tortilaJournalStatus: latestJournal?.status ?? null,
    tortilaJournalReadState: latestReadState,
    tortilaJournalReadStateDetail: latestReadStateDetail,
    latestSnapshot: snap
      ? {
          snapshotAt: snap.snapshotAt.getTime(),
          walletEquityUsd: snap.walletEquityUsd ?? null,
          sourceAdapter: snap.sourceAdapter,
        }
      : null,
    tortilaFleetSnapshots: tortilaSnapshots,
    legacyProviderAccounts,
    legacyActiveSlots,
    legacyActiveOrders,
    botHealthChecks,
    botWarningSummaries,
  };
}
