import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeMetrics, filterZeroEquity, type CanonicalMetrics, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import type { AccessDecision } from '@wtc/entitlements';
import {
  AdapterNotReadyError,
  LEGACY_WARNINGS,
  TORTILA_PERSISTENT_WARNINGS,
  getBotAdapter,
  LegacyAdapterBlockedError,
  type BotConfigView,
  type BotHealth,
  type BotProductCode,
  type RiskWarning,
} from '@wtc/bot-adapters';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { botAdapterOptions } from '@/lib/server-config';
import { getServerDb } from '@/lib/backend';
import { SectionHeader, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { BotSubNav } from '@/components/BotSubNav';
import { botMeta, type BotMeta } from '@/features/bots/meta';
import { and, desc, eq } from 'drizzle-orm';
import { schema } from '@wtc/db';

/** Resolve a bot slug → meta + the current user's access. 404s on an unknown slug. */
export async function loadBot(slug: string): Promise<{ meta: BotMeta; access: AccessDecision }> {
  const meta = botMeta(slug);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, meta.code);
  return { meta, access };
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
  kind: BotReadIssueKind;
  title: string;
  detail: string;
}

export interface SafeBotRead<T> {
  data: T | null;
  issue: BotReadIssue | null;
}

export interface BotReadModel {
  adapterMode: 'mock' | 'real';
  health: BotHealth;
  metrics: SafeBotRead<CanonicalMetrics>;
  positions: SafeBotRead<CanonicalPosition[]>;
  trades: SafeBotRead<CanonicalTrade[]>;
  equityCurve: SafeBotRead<EquityPoint[]>;
  config: SafeBotRead<BotConfigView>;
  warnings: SafeBotRead<RiskWarning[]>;
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
    readStateDetail: 'Legacy live adapter is blocked pending B3.',
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
      title: 'Live adapter blocked (B3)',
      detail: err.message,
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

const notReadyIssue = (detail: string): BotReadIssue => ({
  kind: 'not_ready',
  title: 'Worker snapshots unavailable',
  detail,
});

const DB_SNAPSHOT_STALE_MS = 10 * 60 * 1000;

function dbSnapshotMode(productCode: BotProductCode): boolean {
  return productCode === 'tortila_bot' && process.env.NODE_ENV === 'production' && botAdapterOptions().mode !== 'mock';
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

function dbWarnings(productCode: BotProductCode): RiskWarning[] {
  return productCode === 'tortila_bot' ? TORTILA_PERSISTENT_WARNINGS : LEGACY_WARNINGS;
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
        ? 'Latest Tortila worker snapshot is stale; read-only data is shown only from the last persisted WTC DB snapshot.'
        : typeof detail.readStateDetail === 'string'
          ? detail.readStateDetail
          : latestHealth
            ? `Latest Tortila worker health status: ${latestHealth.status}.`
            : 'No Tortila worker health snapshot has been recorded yet.';

  return {
    productCode,
    processAlive: typeof detail.processAlive === 'boolean' ? detail.processAlive : status !== 'down',
    status,
    readState,
    readStateDetail,
    lastSyncAt: checkedAt ? checkedAt.getTime() : null,
    staleDataSeconds: ageMs !== null ? Math.max(0, Math.round(ageMs / 1000)) : null,
    uptimeSeconds: null,
    warnings: dbWarnings(productCode),
  };
}

async function loadDbBotReadModel(productCode: BotProductCode, parts: readonly BotReadPart[]): Promise<BotReadModel | null> {
  const db = getServerDb();
  if (!db) return null;

  const want = new Set(parts);
  const [latestHealth] = await db
    .select({
      status: schema.integrationHealthChecks.status,
      detail: schema.integrationHealthChecks.detail,
      checkedAt: schema.integrationHealthChecks.checkedAt,
    })
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, 'tortila-journal'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  const [latestMetric] = await db
    .select({
      botInstanceId: schema.botMetricSnapshots.botInstanceId,
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
      walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
      rawJson: schema.botMetricSnapshots.rawJson,
    })
    .from(schema.botMetricSnapshots)
    .innerJoin(schema.botInstances, eq(schema.botMetricSnapshots.botInstanceId, schema.botInstances.id))
    .where(eq(schema.botInstances.productCode, productCode))
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(1);

  const [latestPosition] = await db
    .select({
      botInstanceId: schema.botPositionSnapshots.botInstanceId,
      snapshotAt: schema.botPositionSnapshots.snapshotAt,
      sourceAdapter: schema.botPositionSnapshots.sourceAdapter,
    })
    .from(schema.botPositionSnapshots)
    .innerJoin(schema.botInstances, eq(schema.botPositionSnapshots.botInstanceId, schema.botInstances.id))
    .where(eq(schema.botInstances.productCode, productCode))
    .orderBy(desc(schema.botPositionSnapshots.snapshotAt))
    .limit(1);

  const [latestTrade] = await db
    .select({
      botInstanceId: schema.botTradeImports.botInstanceId,
      sourceAdapter: schema.botTradeImports.sourceAdapter,
      closedAt: schema.botTradeImports.closedAt,
    })
    .from(schema.botTradeImports)
    .innerJoin(schema.botInstances, eq(schema.botTradeImports.botInstanceId, schema.botInstances.id))
    .where(eq(schema.botInstances.productCode, productCode))
    .orderBy(desc(schema.botTradeImports.closedAt))
    .limit(1);

  const botInstanceId = latestMetric?.botInstanceId ?? latestPosition?.botInstanceId ?? latestTrade?.botInstanceId ?? null;
  const sourceAdapter = latestMetric?.sourceAdapter ?? latestPosition?.sourceAdapter ?? latestTrade?.sourceAdapter ?? 'tortila';
  const adapterMode: 'mock' | 'real' = sourceAdapter.endsWith('-mock') ? 'mock' : 'real';
  const health = healthFromDb(productCode, latestHealth, latestMetric?.snapshotAt ?? latestPosition?.snapshotAt ?? null);

  if (!botInstanceId) {
    const issue = notReadyIssue('No Tortila metric, position, or trade snapshots exist in WTC Postgres yet. Run the read-only worker tick first.');
    return {
      adapterMode,
      health,
      metrics: want.has('metrics') ? { data: null, issue } : skipped<CanonicalMetrics>(),
      positions: want.has('positions') ? { data: null, issue } : skipped<CanonicalPosition[]>(),
      trades: want.has('trades') ? { data: null, issue } : skipped<CanonicalTrade[]>(),
      equityCurve: want.has('equityCurve') ? { data: null, issue } : skipped<EquityPoint[]>(),
      config: skipped<BotConfigView>(),
      warnings: want.has('warnings') ? { data: dbWarnings(productCode), issue: null } : skipped<RiskWarning[]>(),
    };
  }

  const positionRows = want.has('positions') || want.has('metrics')
    ? latestPosition
      ? await db
          .select()
          .from(schema.botPositionSnapshots)
          .where(and(
            eq(schema.botPositionSnapshots.botInstanceId, latestPosition.botInstanceId),
            eq(schema.botPositionSnapshots.snapshotAt, latestPosition.snapshotAt),
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
        .where(eq(schema.botTradeImports.botInstanceId, botInstanceId))
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
        .where(eq(schema.botMetricSnapshots.botInstanceId, botInstanceId))
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
  const metrics = want.has('metrics')
    ? computeMetrics({
        trades,
        positions,
        equityCurve,
        walletEquity: latestWallet,
        firstEquity,
        safetyEventCount: dbWarnings(productCode).filter((w) => w.severity !== 'info').length,
      })
    : null;

  const missingSnapshotIssue = notReadyIssue('The WTC worker has not persisted this snapshot type yet.');
  return {
    adapterMode,
    health,
    metrics: want.has('metrics')
      ? metrics
        ? { data: metrics, issue: null }
        : { data: null, issue: missingSnapshotIssue }
      : skipped<CanonicalMetrics>(),
    positions: want.has('positions') ? { data: positions, issue: null } : skipped<CanonicalPosition[]>(),
    trades: want.has('trades') ? { data: trades, issue: null } : skipped<CanonicalTrade[]>(),
    equityCurve: want.has('equityCurve') ? { data: equityCurve, issue: equityCurve.length === 0 ? missingSnapshotIssue : null } : skipped<EquityPoint[]>(),
    config: skipped<BotConfigView>(),
    warnings: want.has('warnings') ? { data: dbWarnings(productCode), issue: null } : skipped<RiskWarning[]>(),
  };
}

/** Read adapter data for UI surfaces without letting blocked/not-ready adapters crash the page. */
export async function loadBotReadModel(
  productCode: BotProductCode,
  parts: readonly BotReadPart[] = ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'],
): Promise<BotReadModel> {
  if (dbSnapshotMode(productCode)) {
    const dbModel = await loadDbBotReadModel(productCode, parts);
    if (dbModel) return dbModel;
  }

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
  return { adapterMode: adapter.mode, health, metrics, positions, trades, equityCurve, config, warnings };
}

export { reasonLabel };
