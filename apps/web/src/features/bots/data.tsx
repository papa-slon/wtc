import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeMetrics, filterZeroEquity, type CanonicalMetrics, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import type { AccessDecision } from '@wtc/entitlements';
import {
  AdapterNotReadyError,
  getBotAdapter,
  legacyClosedTradeSourceProofSummaryFromRaw,
  LegacyAdapterBlockedError,
  warningSummaryFromWarnings,
  warningsFromDetail,
  type BotConfigView,
  type BotHealth,
  type BotProductCode,
  type LegacyClosedTradeSourceProofSafeSummary,
  type RiskWarning,
} from '@wtc/bot-adapters';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { botAdapterOptions } from '@/lib/server-config';
import { getServerDb } from '@/lib/backend';
import { SectionHeader, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { BotSubNav } from '@/components/BotSubNav';
import { botMeta, type BotMeta } from '@/features/bots/meta';
import { buildSafeRuntimeConfigView } from '@/features/bots/runtime-config-sanitizer';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { schema } from '@wtc/db';

/** Resolve a bot slug → meta + the current user's access. 404s on an unknown slug. */
export async function loadBot(slug: string): Promise<{ meta: BotMeta; access: AccessDecision; user: { id: string; roles: readonly string[] } }> {
  const meta = botMeta(slug);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, meta.code);
  return { meta, access, user };
}

/** Shared entitlement gate for a bot sub-page. Keeps the sub-nav visible so the user can orient. */
export function BotAccessRequired({ meta, section }: { meta: BotMeta; section: string }) {
  return (
    <div className="wtc-stack">
      <SectionHeader kicker={`${meta.name} · ${section}`} title="Access required" />
      <BotSubNav bot={meta.slug} active={sectionToSeg(section)} />
      <RiskWarningBanner
        severity="warning"
        title="Entitlement required"
        detail={`Your ${meta.name} entitlement does not currently grant access. Activate or renew in billing to view this section.`}
      />
      <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
    </div>
  );
}

function sectionToSeg(section: string): string {
  const s = section.toLowerCase();
  return s === 'overview' ? '' : s;
}

export type BotReadIssueKind = 'blocked' | 'not_ready' | 'error';

export interface BotReadIssue {
  code?: string;
  kind: BotReadIssueKind;
  title: string;
  detail: string;
}

export interface SafeBotRead<T> {
  data: T | null;
  issue: BotReadIssue | null;
}

export type BotWarningStatus = 'warnings_present' | 'none_reported' | 'unavailable' | 'not_evaluated';
export type BotWarningScope =
  | 'adapter_warning_read'
  | 'product_health'
  | 'provider_account_health'
  | 'runtime_not_scoped'
  | 'not_requested';

export interface BotWarningSummary {
  status: BotWarningStatus;
  scope: BotWarningScope;
  count: number;
  activeCount: number;
  maxSeverity: 'info' | 'warning' | 'error' | null;
  warnings: RiskWarning[];
  evaluatedAt: number | null;
  source: 'warnings_read' | 'health' | 'not_requested';
  issue: BotReadIssue | null;
  title: string;
  detail: string;
}

export type BotClosedTradeSourceProofSummary = LegacyClosedTradeSourceProofSafeSummary;

export interface BotReadModel {
  adapterMode: 'mock' | 'real';
  markUnavailable: boolean;
  health: BotHealth;
  metrics: SafeBotRead<CanonicalMetrics>;
  positions: SafeBotRead<CanonicalPosition[]>;
  trades: SafeBotRead<CanonicalTrade[]>;
  equityCurve: SafeBotRead<EquityPoint[]>;
  config: SafeBotRead<BotConfigView>;
  warnings: SafeBotRead<RiskWarning[]>;
  warningSummary: BotWarningSummary;
  closedTradeSourceProof?: BotClosedTradeSourceProofSummary | null;
}

type BotReadPart = 'metrics' | 'positions' | 'trades' | 'equityCurve' | 'config' | 'warnings';

const FALLBACK_HEALTH: Record<BotProductCode, BotHealth> = {
  tortila_bot: {
    productCode: 'tortila_bot',
    processAlive: false,
    status: 'down',
    readState: 'unreachable',
    readStateDetail: 'WTC could not read adapter health.',
    lastSyncAt: null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: [],
  },
  legacy_bot: {
    productCode: 'legacy_bot',
    processAlive: false,
    status: 'down',
    readState: 'not_configured',
    readStateDetail: 'Legacy DB live-read is not configured; the direct HTTP/control adapter remains blocked.',
    lastSyncAt: null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: [],
  },
};

export function botReadIssueFromError(err: unknown): BotReadIssue {
  if (err instanceof LegacyAdapterBlockedError) {
    return {
      kind: 'blocked',
      title: 'Legacy HTTP adapter blocked',
      detail: 'The direct Legacy HTTP/control adapter is disabled. In production, Legacy live data is read from worker DB snapshots by provider pub_id.',
    };
  }
  if (err instanceof AdapterNotReadyError) {
    return {
      kind: 'not_ready',
      title: 'Adapter data unavailable',
      detail: err.message,
    };
  }
  return {
    kind: 'error',
    title: 'Adapter read failed',
    detail: err instanceof Error ? err.message : 'Unknown adapter read failure.',
  };
}

async function safeBotCall<T>(fn: () => Promise<T>): Promise<SafeBotRead<T>> {
  try {
    return { data: await fn(), issue: null };
  } catch (err) {
    return { data: null, issue: botReadIssueFromError(err) };
  }
}

const skipped = <T,>(): SafeBotRead<T> => ({ data: null, issue: null });

function sourceAdapterIsReal(value: string | null | undefined): boolean {
  return typeof value === 'string' && !value.endsWith('-mock');
}

function botWarningSummary(
  health: BotHealth,
  warningsRead: SafeBotRead<RiskWarning[]>,
  warningsRequested: boolean,
  scope: BotWarningScope,
): BotWarningSummary {
  const source: BotWarningSummary['source'] = warningsRequested
    ? warningsRead.data
      ? 'warnings_read'
      : 'health'
    : 'not_requested';
  const warnings = warningsRead.data ?? health.warnings;
  const summary = warningSummaryFromWarnings(warnings);
  const activeCount = warnings.filter((warning) => warning.severity !== 'info').length;
  const evaluatedAt = health.lastSyncAt;

  if (warnings.length > 0) {
    return {
      status: 'warnings_present',
      scope,
      count: summary.count,
      activeCount,
      maxSeverity: summary.maxSeverity,
      warnings,
      evaluatedAt,
      source,
      issue: warningsRead.issue,
      title: `${summary.count} canonical warning${summary.count === 1 ? '' : 's'}`,
      detail: warningsRead.issue
        ? 'The dedicated warning read is unavailable; showing registry-owned warnings attached to the latest health snapshot.'
        : 'Registry-owned warning codes were reported by the latest evaluated bot source.',
    };
  }

  if (warningsRead.issue) {
    return {
      status: 'unavailable',
      scope,
      count: 0,
      activeCount: 0,
      maxSeverity: null,
      warnings: [],
      evaluatedAt,
      source,
      issue: warningsRead.issue,
      title: 'Warning snapshot unavailable',
      detail: warningsRead.issue.detail,
    };
  }

  if (!warningsRequested || scope === 'not_requested') {
    return {
      status: 'not_evaluated',
      scope,
      count: 0,
      activeCount: 0,
      maxSeverity: null,
      warnings: [],
      evaluatedAt,
      source,
      issue: null,
      title: 'Warnings not requested',
      detail: 'This view did not request the warning snapshot, so an empty list is not a warning all-clear.',
    };
  }

  if (scope === 'runtime_not_scoped') {
    return {
      status: 'not_evaluated',
      scope,
      count: 0,
      activeCount: 0,
      maxSeverity: null,
      warnings: [],
      evaluatedAt,
      source,
      issue: null,
      title: 'Warnings not scoped to this account',
      detail: 'The latest runtime health row is not uniquely scoped to this user bot or provider account, so WTC does not attribute an empty warning list as user safety evidence.',
    };
  }

  if (health.readState && health.readState !== 'ok') {
    return {
      status: 'not_evaluated',
      scope,
      count: 0,
      activeCount: 0,
      maxSeverity: null,
      warnings: [],
      evaluatedAt,
      source,
      issue: null,
      title: 'Warnings not fully evaluated',
      detail: health.readStateDetail ?? `The latest bot read state is ${health.readState}; an empty warning list is not a live-runtime all-clear.`,
    };
  }

  return {
    status: 'none_reported',
    scope,
    count: 0,
    activeCount: 0,
    maxSeverity: null,
    warnings: [],
    evaluatedAt,
    source,
    issue: null,
    title: 'No canonical warning codes reported',
    detail: 'The latest evaluated warning source reported no canonical warning codes. This does not enable live control or prove exchange safety.',
  };
}

const notReadyIssue = (detail: string): BotReadIssue => ({
  kind: 'not_ready',
  title: 'Worker snapshots unavailable',
  detail,
});

const scopedSnapshotIssue = (detail: string): BotReadIssue => ({
  kind: 'not_ready',
  title: 'User-scoped bot snapshots unavailable',
  detail,
});

const providerMappingIssue = (detail: string): BotReadIssue => ({
  code: 'legacy_provider_mapping_required',
  kind: 'not_ready',
  title: 'Legacy provider mapping required',
  detail,
});

const DB_SNAPSHOT_STALE_MS = 10 * 60 * 1000;

function dbSnapshotMode(productCode: BotProductCode): boolean {
  return (productCode === 'tortila_bot' || productCode === 'legacy_bot') && process.env.NODE_ENV === 'production' && botAdapterOptions().mode !== 'mock';
}

function userScopedSnapshotRequired(productCode: BotProductCode): boolean {
  return (productCode === 'tortila_bot' || productCode === 'legacy_bot') && botAdapterOptions().mode !== 'mock';
}

function isReadState(value: unknown): value is NonNullable<BotHealth['readState']> {
  return value === 'ok' || value === 'not_configured' || value === 'unreachable' || value === 'malformed' || value === 'stale';
}

function isHealthStatus(value: unknown): value is BotHealth['status'] {
  return value === 'healthy' || value === 'degraded' || value === 'stale' || value === 'down';
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function side(value: string): 'long' | 'short' {
  return value === 'short' ? 'short' : 'long';
}

function dbWarningsFromDetail(productCode: BotProductCode, detail: Record<string, unknown>): RiskWarning[] {
  return warningsFromDetail(productCode, detail);
}

function singleMappedLegacyHealth(detail: Record<string, unknown>): boolean {
  return num(detail.providerAccountMappingsSeen) === 1 && num(detail.providerAccountMappingsSnapshotted) === 1;
}

function healthFromDb(
  productCode: BotProductCode,
  latestHealth: { status: string; detail: unknown; checkedAt: Date } | undefined,
  latestSnapshotAt: Date | null,
  now = Date.now(),
): BotHealth {
  const detail = (latestHealth?.detail ?? {}) as Record<string, unknown>;
  const checkedAt = latestHealth?.checkedAt ?? latestSnapshotAt;
  const ageMs = checkedAt ? now - checkedAt.getTime() : null;
  const tooOld = ageMs !== null && ageMs > DB_SNAPSHOT_STALE_MS;
  const readState = tooOld
    ? 'stale'
    : isReadState(detail.readState)
      ? detail.readState
      : latestHealth?.status === 'ok'
        ? 'ok'
        : latestHealth?.status === 'not_configured'
          ? 'not_configured'
          : latestHealth
            ? 'unreachable'
            : 'not_configured';
  const status = tooOld
    ? 'stale'
    : isHealthStatus(detail.status)
      ? detail.status
      : latestHealth?.status === 'ok'
        ? 'healthy'
        : latestHealth
          ? 'down'
          : 'down';
  const readStateDetail =
    readState === 'ok'
      ? undefined
      : tooOld
        ? `Latest ${productCode === 'legacy_bot' ? 'Legacy' : 'Tortila'} worker snapshot is stale; read-only data is shown only from the last persisted WTC DB snapshot.`
        : typeof detail.readStateDetail === 'string'
          ? detail.readStateDetail
          : latestHealth
            ? `Latest ${productCode === 'legacy_bot' ? 'Legacy' : 'Tortila'} worker health status: ${latestHealth.status}.`
            : `No ${productCode === 'legacy_bot' ? 'Legacy' : 'Tortila'} worker health snapshot has been recorded yet.`;

  return {
    productCode,
    processAlive: typeof detail.processAlive === 'boolean' ? detail.processAlive : status !== 'down',
    status,
    readState,
    readStateDetail,
    lastSyncAt: checkedAt ? checkedAt.getTime() : null,
    staleDataSeconds: ageMs !== null ? Math.max(0, Math.round(ageMs / 1000)) : null,
    uptimeSeconds: null,
    warnings: dbWarningsFromDetail(productCode, detail),
  };
}

function emptyDbReadModel(
  productCode: BotProductCode,
  parts: readonly BotReadPart[],
  health: BotHealth,
  issue: BotReadIssue,
  warnings: RiskWarning[],
  scope: BotWarningScope = 'runtime_not_scoped',
): BotReadModel {
  const want = new Set(parts);
  const warningRead: SafeBotRead<RiskWarning[]> = want.has('warnings') ? { data: warnings, issue } : skipped<RiskWarning[]>();
  return {
    adapterMode: 'real',
    markUnavailable: productCode === 'tortila_bot',
    health,
    metrics: want.has('metrics') ? { data: null, issue } : skipped<CanonicalMetrics>(),
    positions: want.has('positions') ? { data: null, issue } : skipped<CanonicalPosition[]>(),
    trades: want.has('trades') ? { data: null, issue } : skipped<CanonicalTrade[]>(),
    equityCurve: want.has('equityCurve') ? { data: null, issue } : skipped<EquityPoint[]>(),
    config: want.has('config') ? { data: null, issue } : skipped<BotConfigView>(),
    warnings: warningRead,
    warningSummary: botWarningSummary(health, warningRead, want.has('warnings'), scope),
  };
}

async function loadDbBotReadModelForUser(userId: string, productCode: BotProductCode, parts: readonly BotReadPart[]): Promise<BotReadModel | null> {
  const db = getServerDb();
  if (!db) return null;

  const want = new Set(parts);
  const healthTarget = productCode === 'legacy_bot' ? 'legacy-bot' : 'tortila-journal';
  const [latestHealth] = await db
    .select({
      status: schema.integrationHealthChecks.status,
      detail: schema.integrationHealthChecks.detail,
      checkedAt: schema.integrationHealthChecks.checkedAt,
    })
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, healthTarget))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const healthDetail = (latestHealth?.detail ?? {}) as Record<string, unknown>;
  let warnings: RiskWarning[] = productCode === 'legacy_bot' ? [] : dbWarningsFromDetail(productCode, healthDetail);
  let runtimeScope: BotWarningScope = productCode === 'legacy_bot' ? 'runtime_not_scoped' : 'product_health';
  const baseHealth = healthFromDb(productCode, latestHealth, null);

  const [instance] = await db
    .select({
      id: schema.botInstances.id,
    })
    .from(schema.botInstances)
    .where(and(eq(schema.botInstances.userId, userId), eq(schema.botInstances.productCode, productCode), isNull(schema.botInstances.accountId)))
    .limit(1);

  if (!instance) {
    return emptyDbReadModel(
      productCode,
      parts,
      baseHealth,
      scopedSnapshotIssue(`No WTC ${productCode === 'legacy_bot' ? 'Legacy' : 'Tortila'} bot instance exists for this account yet. Save settings first; live data is not read from global product snapshots.`),
      warnings,
    );
  }

  const providerAccounts = productCode === 'legacy_bot'
    ? await db
        .select({
          id: schema.botProviderAccounts.id,
          providerAccountId: schema.botProviderAccounts.providerAccountId,
        })
        .from(schema.botProviderAccounts)
        .where(and(
          eq(schema.botProviderAccounts.userId, userId),
          eq(schema.botProviderAccounts.botInstanceId, instance.id),
          eq(schema.botProviderAccounts.productCode, productCode),
          eq(schema.botProviderAccounts.provider, 'legacy-db'),
          eq(schema.botProviderAccounts.status, 'active'),
        ))
        .orderBy(desc(schema.botProviderAccounts.updatedAt))
        .limit(2)
    : [];

  if (productCode === 'legacy_bot' && providerAccounts.length !== 1) {
    return emptyDbReadModel(
      productCode,
      parts,
      baseHealth,
      providerMappingIssue(
        providerAccounts.length === 0
          ? 'No active Legacy provider pub_id is mapped to this WTC bot instance. Legacy runtime facts stay hidden until admin maps exactly one verified provider account.'
          : 'More than one active Legacy provider pub_id is mapped to this WTC bot instance. Runtime facts stay hidden until the mapping is unambiguous.',
      ),
      warnings,
    );
  }

  const providerAccountId = productCode === 'legacy_bot' ? providerAccounts[0]!.id : null;
  const metricWhere = providerAccountId
    ? and(eq(schema.botMetricSnapshots.botInstanceId, instance.id), eq(schema.botMetricSnapshots.botProviderAccountId, providerAccountId))
    : eq(schema.botMetricSnapshots.botInstanceId, instance.id);
  const positionWhere = providerAccountId
    ? and(eq(schema.botPositionSnapshots.botInstanceId, instance.id), eq(schema.botPositionSnapshots.botProviderAccountId, providerAccountId))
    : eq(schema.botPositionSnapshots.botInstanceId, instance.id);
  const tradeWhere = providerAccountId
    ? and(eq(schema.botTradeImports.botInstanceId, instance.id), eq(schema.botTradeImports.botProviderAccountId, providerAccountId))
    : eq(schema.botTradeImports.botInstanceId, instance.id);

  const [latestMetric] = await db
    .select({
      botInstanceId: schema.botMetricSnapshots.botInstanceId,
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
      walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
      rawJson: schema.botMetricSnapshots.rawJson,
    })
    .from(schema.botMetricSnapshots)
    .where(metricWhere)
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(1);

  const [latestPosition] = await db
    .select({
      botInstanceId: schema.botPositionSnapshots.botInstanceId,
      snapshotAt: schema.botPositionSnapshots.snapshotAt,
      sourceAdapter: schema.botPositionSnapshots.sourceAdapter,
    })
    .from(schema.botPositionSnapshots)
    .where(positionWhere)
    .orderBy(desc(schema.botPositionSnapshots.snapshotAt))
    .limit(1);

  const [latestTrade] = await db
    .select({
      botInstanceId: schema.botTradeImports.botInstanceId,
      sourceAdapter: schema.botTradeImports.sourceAdapter,
      closedAt: schema.botTradeImports.closedAt,
    })
    .from(schema.botTradeImports)
    .where(tradeWhere)
    .orderBy(desc(schema.botTradeImports.closedAt))
    .limit(1);

  const botInstanceId = latestMetric?.botInstanceId ?? latestPosition?.botInstanceId ?? latestTrade?.botInstanceId ?? null;
  const sourceAdapter = latestMetric?.sourceAdapter ?? latestPosition?.sourceAdapter ?? latestTrade?.sourceAdapter ?? (productCode === 'legacy_bot' ? 'legacy-db' : 'tortila');
  const adapterMode: 'mock' | 'real' = sourceAdapter.endsWith('-mock') ? 'mock' : 'real';
  const markUnavailable = productCode === 'tortila_bot' && (
    sourceAdapterIsReal(latestPosition?.sourceAdapter) ||
    sourceAdapterIsReal(latestMetric?.sourceAdapter) ||
    sourceAdapterIsReal(sourceAdapter)
  );
  const health = healthFromDb(productCode, latestHealth, latestMetric?.snapshotAt ?? latestPosition?.snapshotAt ?? null);

  if (!botInstanceId) {
    const issue = scopedSnapshotIssue(`No user-scoped ${productCode === 'legacy_bot' ? 'Legacy' : 'Tortila'} metric, position, or trade snapshots exist in WTC Postgres yet. Run the read-only worker tick after ownership mapping is configured.`);
    const warningRead: SafeBotRead<RiskWarning[]> = want.has('warnings') ? { data: warnings, issue } : skipped<RiskWarning[]>();
    return {
      adapterMode,
      markUnavailable,
      health,
      metrics: want.has('metrics') ? { data: null, issue } : skipped<CanonicalMetrics>(),
      positions: want.has('positions') ? { data: null, issue } : skipped<CanonicalPosition[]>(),
      trades: want.has('trades') ? { data: null, issue } : skipped<CanonicalTrade[]>(),
      equityCurve: want.has('equityCurve') ? { data: null, issue } : skipped<EquityPoint[]>(),
      config: skipped<BotConfigView>(),
      warnings: warningRead,
      warningSummary: botWarningSummary(health, warningRead, want.has('warnings'), 'runtime_not_scoped'),
    };
  }

  const scopedLegacyRuntimeHealth = productCode !== 'legacy_bot' || singleMappedLegacyHealth(healthDetail);
  warnings = scopedLegacyRuntimeHealth ? dbWarningsFromDetail(productCode, healthDetail) : [];
  runtimeScope = productCode === 'legacy_bot'
    ? scopedLegacyRuntimeHealth
      ? 'provider_account_health'
      : 'runtime_not_scoped'
    : 'product_health';

  const positionRows = want.has('positions') || want.has('metrics')
    ? latestPosition
      ? await db
          .select()
          .from(schema.botPositionSnapshots)
          .where(and(
            eq(schema.botPositionSnapshots.botInstanceId, latestPosition.botInstanceId),
            eq(schema.botPositionSnapshots.snapshotAt, latestPosition.snapshotAt),
            ...(providerAccountId ? [eq(schema.botPositionSnapshots.botProviderAccountId, providerAccountId)] : []),
          ))
      : []
    : [];

  const positions: CanonicalPosition[] = positionRows.map((p) => {
    const qty = num(p.size) ?? 0;
    const entryPrice = num(p.entryPrice) ?? 0;
    const markPrice = num(p.markPrice) ?? entryPrice;
    const stopPrice = num(p.slPrice);
    const tpPrice = num(p.tpPrice);
    return {
      symbol: p.symbol,
      side: side(p.side),
      qty,
      entryPrice,
      markPrice,
      unrealizedPnl: num(p.unrealizedPnlUsd) ?? 0,
      ...(stopPrice !== null ? { stopPrice } : {}),
      ...(tpPrice !== null ? { tpPrice, hasTp: true } : { hasTp: false }),
      openedAt: p.openedAt ? p.openedAt.getTime() : null,
    };
  });

  const tradeRows = want.has('trades') || want.has('metrics')
    ? await db
        .select()
        .from(schema.botTradeImports)
        .where(tradeWhere)
        .orderBy(desc(schema.botTradeImports.closedAt))
        .limit(500)
    : [];

  const trades: CanonicalTrade[] = tradeRows.map((t) => ({
    id: t.externalTradeId,
    symbol: t.symbol,
    side: side(t.side),
    qty: num(t.size) ?? 0,
    entryPrice: num(t.entryPrice) ?? undefined,
    exitPrice: num(t.exitPrice) ?? undefined,
    realizedPnl: num(t.realizedPnlUsd) ?? 0,
    fee: num(t.feesUsd) ?? 0,
    funding: num(t.fundingPaidUsd) ?? 0,
    openedAt: t.openedAt.getTime(),
    closedAt: t.closedAt.getTime(),
    exitReason: t.exitReason ?? undefined,
    holdHours: num((t.rawJson as Record<string, unknown> | null)?.holdHours) ?? undefined,
    retPct: num((t.rawJson as Record<string, unknown> | null)?.retPct) ?? undefined,
  }));

  const equityRows = want.has('equityCurve') || want.has('metrics')
    ? await db
        .select({
          t: schema.botMetricSnapshots.snapshotAt,
          equity: schema.botMetricSnapshots.walletEquityUsd,
        })
        .from(schema.botMetricSnapshots)
        .where(metricWhere)
        .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
        .limit(200)
    : [];
  const equityCurve: EquityPoint[] = equityRows
    .map((p) => {
      const equity = num(p.equity);
      return equity === null ? null : { t: p.t.getTime(), equity };
    })
    .filter((p): p is EquityPoint => p !== null)
    .reverse();
  const cleanEquity = filterZeroEquity(equityCurve);
  const firstEquity = cleanEquity[0]?.equity ?? null;
  const latestWallet = num(latestMetric?.walletEquityUsd) ?? cleanEquity.at(-1)?.equity ?? 0;
  const rawMetric = (latestMetric?.rawJson ?? {}) as Record<string, unknown>;
  const closedTradeSourceProof = productCode === 'legacy_bot'
    ? legacyClosedTradeSourceProofSummaryFromRaw(rawMetric.closedTradeSourceProof, 'scoped_worker_metric')
    : null;
  const liveConfig = rawMetric.liveConfig && typeof rawMetric.liveConfig === 'object'
    ? rawMetric.liveConfig as Record<string, unknown>
    : null;
  const configView = buildSafeRuntimeConfigView({ productCode, instanceId: botInstanceId, liveConfig });
  const metrics = want.has('metrics')
    ? computeMetrics({
        trades,
        positions,
        equityCurve,
        walletEquity: latestWallet,
        firstEquity,
        safetyEventCount: warnings.filter((w) => w.severity !== 'info').length,
      })
    : null;

  const missingSnapshotIssue = notReadyIssue('The WTC worker has not persisted this snapshot type yet.');
  const warningRead = want.has('warnings') ? { data: warnings, issue: null } : skipped<RiskWarning[]>();
  return {
    adapterMode,
    markUnavailable,
    health,
    metrics: want.has('metrics')
      ? metrics
        ? { data: metrics, issue: null }
        : { data: null, issue: missingSnapshotIssue }
      : skipped<CanonicalMetrics>(),
    positions: want.has('positions') ? { data: positions, issue: null } : skipped<CanonicalPosition[]>(),
    trades: want.has('trades') ? { data: trades, issue: null } : skipped<CanonicalTrade[]>(),
    equityCurve: want.has('equityCurve') ? { data: equityCurve, issue: equityCurve.length === 0 ? missingSnapshotIssue : null } : skipped<EquityPoint[]>(),
    config: want.has('config')
      ? configView
        ? { data: configView, issue: null }
        : skipped<BotConfigView>()
      : skipped<BotConfigView>(),
    warnings: warningRead,
    warningSummary: botWarningSummary(health, warningRead, want.has('warnings'), runtimeScope),
    closedTradeSourceProof,
  };
}

async function loadAdapterBotReadModel(
  productCode: BotProductCode,
  parts: readonly BotReadPart[] = ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'],
): Promise<BotReadModel> {
  const adapter = getBotAdapter(productCode, botAdapterOptions());
  let health: BotHealth;
  try {
    health = await adapter.getHealth();
  } catch (err) {
    const issue = botReadIssueFromError(err);
    health = { ...FALLBACK_HEALTH[productCode], readStateDetail: issue.detail };
  }
  const want = new Set(parts);
  const canReadData = health.readState !== 'not_configured';
  const metrics = want.has('metrics') && canReadData ? await safeBotCall(() => adapter.getMetrics(productCode)) : skipped<CanonicalMetrics>();
  const positions = want.has('positions') && canReadData ? await safeBotCall(() => adapter.getPositions(productCode)) : skipped<CanonicalPosition[]>();
  const trades = want.has('trades') && canReadData ? await safeBotCall(() => adapter.getTrades(productCode)) : skipped<CanonicalTrade[]>();
  const equityCurve = want.has('equityCurve') && canReadData && adapter.getEquityCurve
    ? await safeBotCall(() => adapter.getEquityCurve!(productCode))
    : skipped<EquityPoint[]>();
  const config = want.has('config') && canReadData ? await safeBotCall(() => adapter.getConfig(productCode)) : skipped<BotConfigView>();
  const warnings = want.has('warnings') ? await safeBotCall(() => adapter.getWarnings()) : skipped<RiskWarning[]>();
  return {
    adapterMode: adapter.mode,
    markUnavailable: productCode === 'tortila_bot' && adapter.mode === 'real',
    health,
    metrics,
    positions,
    trades,
    equityCurve,
    config,
    warnings,
    warningSummary: botWarningSummary(health, warnings, want.has('warnings'), want.has('warnings') ? 'adapter_warning_read' : 'not_requested'),
  };
}

/** Read current-user bot data. Production DB snapshots require user-owned bot instances and mappings. */
export async function loadBotReadModelForUser(
  userId: string,
  productCode: BotProductCode,
  parts: readonly BotReadPart[] = ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'],
): Promise<BotReadModel> {
  if (dbSnapshotMode(productCode) || userScopedSnapshotRequired(productCode)) {
    const dbModel = await loadDbBotReadModelForUser(userId, productCode, parts);
    if (dbModel) return dbModel;
    const issue = scopedSnapshotIssue('User-scoped WTC DB snapshots are required in non-mock mode. Configure DATABASE_URL and run the worker snapshot cycle; this page will not fall back to a global adapter read.');
    const health: BotHealth = {
      ...FALLBACK_HEALTH[productCode],
      readState: 'not_configured',
      readStateDetail: issue.detail,
    };
    return emptyDbReadModel(productCode, parts, health, issue, [], 'runtime_not_scoped');
  }
  return loadAdapterBotReadModel(productCode, parts);
}

/** Adapter-only fallback for demo/internal surfaces without a current-user snapshot scope. */
export async function loadBotReadModel(
  productCode: BotProductCode,
  parts: readonly BotReadPart[] = ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'],
): Promise<BotReadModel> {
  return loadAdapterBotReadModel(productCode, parts);
}

export { reasonLabel };
