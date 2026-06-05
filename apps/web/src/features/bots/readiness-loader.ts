import 'server-only';
import { desc, eq } from 'drizzle-orm';
import type { AccessDecision } from '@wtc/entitlements';
import {
  schema,
  summarizeExchangeKeyMetadata,
  summarizeUserBotProviderMapping,
} from '@wtc/db';
import { botAccessForUser } from '@/lib/access';
import { backendMode, getServerDb, listExchangeKeys } from '@/lib/backend';
import { botHealthPill, type BotProductCode, type BotSlug } from './meta';
import { loadBotConfig, type BotConfigSource } from './config';
import { loadBotReadModelForUser, type BotReadModel } from './data';
import {
  buildBotReadinessItems,
  type BotReadinessItem,
  type BotReadinessSurface,
  type BotRuntimeReadinessInput,
  type BotStatisticsReadinessInput,
} from './readiness';

type ExchangeKeyState = 'not_checked' | 'missing' | 'metadata_saved' | 'vault_metadata_confirmed';
type ProviderPubIdState = 'not_checked' | 'missing' | 'runtime_snapshot' | 'db_mapping_confirmed' | 'ambiguous_mapping';
const WORKER_CONTINUITY_STALE_AFTER_SECONDS = 3 * 60;

export interface BotReadinessConfigDto {
  source: BotConfigSource;
  sourceLabel: string;
  sourceDetail: string;
}

export interface BotReadinessDto {
  access: AccessDecision;
  botSlug: BotSlug;
  productCode: BotProductCode;
  config: BotReadinessConfigDto;
  exchangeKeyState: ExchangeKeyState;
  exchangeKeyCount: number;
  providerPubIdState: ProviderPubIdState;
  providerAccountCount: number;
  runtime: BotRuntimeReadinessInput | null;
  statistics: BotStatisticsReadinessInput | null;
  items: BotReadinessItem[];
}

interface LoadBotReadinessOptions {
  includeOperationalRows?: boolean;
  read?: BotReadModel | null;
  access?: AccessDecision;
}

interface WorkerContinuityReadiness {
  checkedAt: number | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  status: string | null;
  coreStatus: string | null;
  botContinuityStatus: string | null;
  productSnapshot: string | null;
  productReadState: string | null;
  detail: string;
}

function botSlugForProduct(productCode: BotProductCode): BotSlug {
  return productCode === 'tortila_bot' ? 'tortila' : 'legacy';
}

async function loadExchangeKeyReadiness(userId: string, productCode: BotProductCode): Promise<{ state: ExchangeKeyState; count: number }> {
  if (productCode !== 'tortila_bot') return { state: 'not_checked', count: 0 };

  const db = getServerDb();
  if (db) {
    const summary = await summarizeExchangeKeyMetadata(db, userId);
    return {
      state: summary.vaultMetadataCount > 0
        ? 'vault_metadata_confirmed'
        : summary.accountCount > 0
          ? 'metadata_saved'
          : 'missing',
      count: summary.accountCount,
    };
  }

  const keys = await listExchangeKeys(userId);
  return { state: keys.length > 0 ? 'metadata_saved' : 'missing', count: keys.length };
}

async function loadProviderPubIdReadiness(userId: string, productCode: BotProductCode): Promise<{ state: ProviderPubIdState; count: number }> {
  if (productCode !== 'legacy_bot') return { state: 'not_checked', count: 0 };

  const db = getServerDb();
  if (!db) return { state: 'not_checked', count: 0 };

  const summary = await summarizeUserBotProviderMapping(db, {
    userId,
    productCode,
    provider: 'legacy-db',
  });
  return {
    state: summary.status === 'active_mapping'
      ? 'db_mapping_confirmed'
      : summary.status === 'ambiguous_mapping'
        ? 'ambiguous_mapping'
        : 'missing',
    count: summary.activeCount,
  };
}

function detailText(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 80) : null;
}

function workerFieldPrefix(productCode: BotProductCode): 'tortila' | 'legacy' {
  return productCode === 'legacy_bot' ? 'legacy' : 'tortila';
}

async function loadWorkerContinuityReadiness(productCode: BotProductCode, now = Date.now()): Promise<WorkerContinuityReadiness> {
  const db = getServerDb();
  if (!db) {
    return {
      checkedAt: null,
      ageSeconds: null,
      staleAfterSeconds: WORKER_CONTINUITY_STALE_AFTER_SECONDS,
      status: null,
      coreStatus: null,
      botContinuityStatus: null,
      productSnapshot: null,
      productReadState: null,
      detail: "No Postgres aggregate target='worker' heartbeat is available in this environment. Launch readiness cannot treat demo or memory state as continuity proof.",
    };
  }

  const [row] = await db
    .select({
      status: schema.integrationHealthChecks.status,
      detail: schema.integrationHealthChecks.detail,
      checkedAt: schema.integrationHealthChecks.checkedAt,
    })
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, 'worker'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  if (!row) {
    return {
      checkedAt: null,
      ageSeconds: null,
      staleAfterSeconds: WORKER_CONTINUITY_STALE_AFTER_SECONDS,
      status: null,
      coreStatus: null,
      botContinuityStatus: null,
      productSnapshot: null,
      productReadState: null,
      detail: "No aggregate target='worker' row has been persisted yet. Run the read-only worker snapshot cycle against WTC Postgres before launch readiness can become green.",
    };
  }

  const detail = (row.detail ?? {}) as Record<string, unknown>;
  const prefix = workerFieldPrefix(productCode);
  const ageSeconds = Math.max(0, Math.round((now - row.checkedAt.getTime()) / 1000));
  const coreStatus = detailText(detail, 'coreWorkerStatus');
  const botContinuityStatus = detailText(detail, 'botContinuityStatus');
  const productSnapshot = detailText(detail, `${prefix}Snapshot`);
  const productReadState = detailText(detail, `${prefix}ReadState`);
  const stale = ageSeconds > WORKER_CONTINUITY_STALE_AFTER_SECONDS;
  const blocked =
    row.status === 'error' ||
    botContinuityStatus === 'error' ||
    productSnapshot === 'error' ||
    productReadState === 'unreachable' ||
    productReadState === 'malformed';
  const ready =
    !stale &&
    row.status === 'ok' &&
    botContinuityStatus === 'ok' &&
    productSnapshot === 'ok' &&
    productReadState === 'ok';

  return {
    checkedAt: row.checkedAt.getTime(),
    ageSeconds,
    staleAfterSeconds: WORKER_CONTINUITY_STALE_AFTER_SECONDS,
    status: row.status,
    coreStatus,
    botContinuityStatus,
    productSnapshot,
    productReadState,
    detail: ready
      ? "Aggregate target='worker' row is fresh and proves both bot continuity plus this product snapshot/readState are ok."
      : blocked
        ? `Aggregate target='worker' row blocks launch readiness: worker=${row.status}, botContinuity=${botContinuityStatus ?? 'unknown'}, ${prefix}Snapshot=${productSnapshot ?? 'unknown'}, ${prefix}ReadState=${productReadState ?? 'unknown'}.`
        : stale
          ? `Aggregate target='worker' row is ${ageSeconds}s old; launch readiness requires a row no older than ${WORKER_CONTINUITY_STALE_AFTER_SECONDS}s.`
          : `Aggregate target='worker' row is not green: worker=${row.status}, botContinuity=${botContinuityStatus ?? 'unknown'}, ${prefix}Snapshot=${productSnapshot ?? 'unknown'}, ${prefix}ReadState=${productReadState ?? 'unknown'}.`,
  };
}

function runtimeReadiness(read: BotReadModel | null, worker: WorkerContinuityReadiness | null): BotRuntimeReadinessInput | null {
  if (!read) return null;
  const pill = botHealthPill(read.health);
  return {
    adapterMode: read.adapterMode,
    readState: read.health.readState,
    label: pill.label,
    detail: read.health.readStateDetail
      ?? (read.adapterMode === 'mock'
        ? 'Preview data only; no provider runtime is being read.'
        : 'Read-only runtime adapter evidence is available.'),
    processAlive: read.health.processAlive,
    lastSyncAt: read.health.lastSyncAt,
    staleDataSeconds: read.health.staleDataSeconds,
    workerCheckedAt: worker?.checkedAt ?? null,
    workerAgeSeconds: worker?.ageSeconds ?? null,
    workerStaleAfterSeconds: worker?.staleAfterSeconds ?? WORKER_CONTINUITY_STALE_AFTER_SECONDS,
    workerStatus: worker?.status ?? null,
    workerCoreStatus: worker?.coreStatus ?? null,
    workerBotContinuityStatus: worker?.botContinuityStatus ?? null,
    workerProductSnapshot: worker?.productSnapshot ?? null,
    workerProductReadState: worker?.productReadState ?? null,
    workerDetail: worker?.detail ?? null,
  };
}

function statisticsReadiness(read: BotReadModel | null): BotStatisticsReadinessInput | null {
  if (!read) return null;
  return {
    metricsAvailable: !!read.metrics.data,
    issueKind: read.metrics.issue?.kind ?? null,
  };
}

export async function loadBotReadinessForUser(
  user: { id: string; roles: readonly string[] },
  productCode: BotProductCode,
  surface: BotReadinessSurface,
  options: LoadBotReadinessOptions = {},
): Promise<BotReadinessDto> {
  const botSlug = botSlugForProduct(productCode);
  const access = options.access ?? await botAccessForUser(user, productCode);
  const includeOperationalRows = options.includeOperationalRows ?? surface === 'dashboard';

  if (!access.allowed) {
    const config = {
      source: 'built_in' as const,
      sourceLabel: 'Hidden until access is active',
      sourceDetail: 'Server-side entitlement check blocked bot readiness data for this product.',
    };
    const items = buildBotReadinessItems({
      productCode,
      botSlug,
      surface,
      accessAllowed: false,
      accessReason: access.reason,
      exchangeKeyState: 'not_checked',
      providerPubIdState: 'not_checked',
      configSource: config.source,
      configSourceLabel: config.sourceLabel,
      configSourceDetail: config.sourceDetail,
      includeOperationalRows: false,
    });
    return {
      access,
      botSlug,
      productCode,
      config,
      exchangeKeyState: 'not_checked',
      exchangeKeyCount: 0,
      providerPubIdState: 'not_checked',
      providerAccountCount: 0,
      runtime: null,
      statistics: null,
      items,
    };
  }

  const [configState, exchange, provider] = await Promise.all([
    loadBotConfig(user.id, productCode),
    loadExchangeKeyReadiness(user.id, productCode),
    loadProviderPubIdReadiness(user.id, productCode),
  ]);
  const read = includeOperationalRows
    ? options.read ?? await loadBotReadModelForUser(user.id, productCode, ['metrics'])
    : null;
  const worker = includeOperationalRows ? await loadWorkerContinuityReadiness(productCode) : null;
  const runtime = runtimeReadiness(read, worker);
  const statistics = statisticsReadiness(read);

  const config = {
    source: configState.source,
    sourceLabel: configState.sourceLabel,
    sourceDetail: configState.sourceDetail,
  };
  const items = buildBotReadinessItems({
    productCode,
    botSlug,
    surface,
    accessAllowed: true,
    accessReason: access.reason,
    exchangeKeyState: exchange.state,
    exchangeKeyCount: exchange.count,
    providerPubIdState: provider.state,
    providerAccountCount: provider.count,
    configSource: config.source,
    configSourceLabel: config.sourceLabel,
    configSourceDetail: config.sourceDetail,
    runtime,
    statistics,
    includeOperationalRows,
  });

  return {
    access,
    botSlug,
    productCode,
    config,
    exchangeKeyState: exchange.state,
    exchangeKeyCount: exchange.count,
    providerPubIdState: provider.state,
    providerAccountCount: provider.count,
    runtime,
    statistics,
    items,
  };
}

export function botReadinessBackendMode(): 'postgres' | 'memory' {
  return backendMode;
}
