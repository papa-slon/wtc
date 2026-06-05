import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  PRODUCTS,
  explainAccess,
  type Entitlement,
  type EntitlementSource,
  type EntitlementStatus,
  type ProductCode,
} from '@wtc/entitlements';
import { getPublishedBotGlobalConfig, schema, type BotGlobalConfigRow, type Db } from '@wtc/db';
import {
  CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF,
  knownWarningsForProduct,
  legacyClosedTradeSourceProofSummaryFromRaw,
  summarizeLegacyClosedTradeSourceProof,
  warningSummaryFromWarnings,
  warningsFromDetail,
  type RiskWarning,
} from '@wtc/bot-adapters';
import { projectHealthDetail } from './health-detail';
import type {
  AdminMode,
  AdminUserBotClosedTradeSourceProofSummary,
  AdminUserBotEquityPoint,
  AdminUserBotConfigSummary,
  AdminUserBotDetailResult,
  AdminUserBotMetricSummary,
  AdminUserBotPositionSummary,
  AdminUserBotRuntimeHealthSummary,
  AdminUserBotSummary,
  AdminUserBotStatsSourceSummary,
  AdminUserBotTradeSummary,
  AdminUserBotWarningSummary,
  AdminUserBotWorkerContinuitySummary,
  AdminUserExchangeKeySummary,
  AdminUserProviderAccountSummary,
  AdminUserView,
} from './types';

const ADMIN_BOT_PRODUCT_CODES = ['tortila_bot', 'legacy_bot'] as const satisfies readonly ProductCode[];
type AdminBotProductCode = (typeof ADMIN_BOT_PRODUCT_CODES)[number];
const ADMIN_BOT_PRODUCT_CODE_VALUES = [...ADMIN_BOT_PRODUCT_CODES];
const ADMIN_BOT_RUNTIME_TARGETS = ['tortila-journal', 'legacy-bot'] as const;
const ADMIN_BOT_RUNTIME_STALE_AFTER_MS = 3 * 60 * 1000;
const ADMIN_WORKER_CONTINUITY_STALE_AFTER_MS = 3 * 60 * 1000;
const BOT_CONFIG_SOURCE_KEY = '__wtcBotConfigSource';
const SYSTEM_DEFAULT_PROFILE_CODE = 'system_default';
const LEGACY_PROVIDER_SCOPE_WARNING =
  'Legacy provider pub_id facts are shown as user-owned only when an active WTC provider-account mapping exists for this user and bot instance. Without that mapping, Legacy runtime rows stay fleet diagnostics on the bot fleet page.';

function legacyClosedTradeSourceProofSummary(): AdminUserBotClosedTradeSourceProofSummary {
  return summarizeLegacyClosedTradeSourceProof(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF, 'global_preflight');
}

export function emptyAdminUserBotDetail(mode: AdminMode): AdminUserBotDetailResult {
  return {
    mode,
    user: null,
    bots: [],
    exchangeKeys: [],
    providerAccounts: [],
    liveControlDisabled: true,
    legacyProviderScopeWarning: LEGACY_PROVIDER_SCOPE_WARNING,
  };
}

function dateMs(value: Date | null | undefined): number | null {
  return value instanceof Date ? value.getTime() : null;
}

function optionalDateMs(value: Date | null | undefined): number | undefined {
  return value instanceof Date ? value.getTime() : undefined;
}

function mapToAdminUserView(u: {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  createdAt?: Date | null;
  failedLoginTotalCount: number;
  lastFailedLoginAt: Date | null;
  accountLockedUntil: Date | null;
  accountLockoutReviewRequiredAt: Date | null;
}): AdminUserView {
  const now = Date.now();
  const accountLockedUntil = dateMs(u.accountLockedUntil);
  const accountLockoutReviewRequiredAt = dateMs(u.accountLockoutReviewRequiredAt);
  const isLocked = accountLockedUntil !== null && accountLockedUntil > now;
  const requiresReview = accountLockoutReviewRequiredAt !== null;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? u.email,
    roles: u.roles,
    createdAt: dateMs(u.createdAt),
    lockout: {
      failedLoginTotalCount: u.failedLoginTotalCount,
      lastFailedLoginAt: dateMs(u.lastFailedLoginAt),
      accountLockedUntil,
      accountLockoutReviewRequiredAt,
      isLocked,
      requiresReview,
      unlockable: isLocked || requiresReview,
    },
  };
}

function mapExchangeKeySummary(row: {
  id: string;
  exchange: string;
  label: string;
  mode: string;
  keyMask: string;
}): AdminUserExchangeKeySummary {
  return {
    id: row.id,
    exchange: row.exchange,
    label: row.label,
    mode: row.mode === 'live' ? 'live' : 'demo',
    keyMask: row.keyMask,
  };
}

function mapMetricSummary(row: {
  snapshotAt: Date;
  walletEquityUsd: string | null;
  closedPnlUsd: string | null;
  unrealizedPnlUsd: string | null;
  winRate: string | null;
  profitFactor: string | null;
  maxDrawdownPct: string | null;
  tradeCount: number | null;
  sourceAdapter: string;
}): AdminUserBotMetricSummary {
  return {
    snapshotAt: row.snapshotAt.getTime(),
    walletEquityUsd: row.walletEquityUsd,
    closedPnlUsd: row.closedPnlUsd,
    unrealizedPnlUsd: row.unrealizedPnlUsd,
    winRate: row.winRate,
    profitFactor: row.profitFactor,
    maxDrawdownPct: row.maxDrawdownPct,
    tradeCount: row.tradeCount,
    sourceAdapter: row.sourceAdapter,
  };
}

function mapPositionSummary(row: {
  snapshotAt: Date;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string | null;
  unrealizedPnlUsd: string | null;
  leverage: number | null;
  tpPrice: string | null;
  slPrice: string | null;
  liquidationPrice: string | null;
  openedAt: Date | null;
  sourceAdapter: string;
}): AdminUserBotPositionSummary {
  return {
    snapshotAt: row.snapshotAt.getTime(),
    symbol: row.symbol,
    side: row.side,
    size: row.size,
    entryPrice: row.entryPrice,
    markPrice: row.markPrice,
    unrealizedPnlUsd: row.unrealizedPnlUsd,
    leverage: row.leverage,
    tpPrice: row.tpPrice,
    slPrice: row.slPrice,
    liquidationPrice: row.liquidationPrice,
    openedAt: dateMs(row.openedAt),
    sourceAdapter: row.sourceAdapter,
  };
}

function mapTradeSummary(row: {
  externalTradeId: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  exitPrice: string;
  realizedPnlUsd: string;
  feesUsd: string;
  fundingPaidUsd: string;
  openedAt: Date;
  closedAt: Date;
  exitReason: string | null;
  sourceAdapter: string;
}): AdminUserBotTradeSummary {
  return {
    externalTradeId: row.externalTradeId,
    symbol: row.symbol,
    side: row.side,
    size: row.size,
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    realizedPnlUsd: row.realizedPnlUsd,
    feesUsd: row.feesUsd,
    fundingPaidUsd: row.fundingPaidUsd,
    openedAt: row.openedAt.getTime(),
    closedAt: row.closedAt.getTime(),
    exitReason: row.exitReason,
    sourceAdapter: row.sourceAdapter,
  };
}

function mapEquityPoint(row: {
  snapshotAt: Date;
  walletEquityUsd: string | null;
  sourceAdapter: string;
}): AdminUserBotEquityPoint | null {
  if (row.walletEquityUsd === null) return null;
  return {
    t: row.snapshotAt.getTime(),
    equityUsd: row.walletEquityUsd,
    sourceAdapter: row.sourceAdapter,
  };
}

function maskProviderAccountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 10) {
    const fingerprint = createHash('sha256').update(trimmed).digest('hex').slice(0, 8);
    return `id#${fingerprint}`;
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function detailText(detail: Record<string, unknown> | null, key: string): string | null {
  const value = detail?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function warningView(warning: RiskWarning) {
  return {
    code: warning.code,
    severity: warning.severity,
    title: warning.title,
    detail: warning.detail,
  };
}

function uniqueWarnings(warnings: RiskWarning[]): RiskWarning[] {
  const seen = new Set<string>();
  const out: RiskWarning[] = [];
  for (const warning of warnings) {
    if (seen.has(warning.code)) continue;
    seen.add(warning.code);
    out.push(warning);
  }
  return out;
}

function healthProductForTarget(target: string): AdminBotProductCode | null {
  if (target === 'tortila-journal') return 'tortila_bot';
  if (target === 'legacy-bot') return 'legacy_bot';
  return null;
}

function runtimeTargetForProduct(productCode: AdminBotProductCode): AdminUserBotRuntimeHealthSummary['target'] {
  return productCode === 'legacy_bot' ? 'legacy-bot' : 'tortila-journal';
}

function runtimeHealthState(input: {
  status: string | null;
  readState: string | null;
  freshness: AdminUserBotRuntimeHealthSummary['freshness'];
}): AdminUserBotRuntimeHealthSummary['state'] {
  if (input.status === null) return 'missing';
  if (input.readState === 'unreachable' || input.readState === 'malformed') return 'error';
  if (input.status === 'error' || input.status === 'down' || input.status === 'malformed' || input.status === 'unreachable') {
    return 'error';
  }
  if (input.readState === 'stale' || input.readState === 'not_configured') return 'attention';
  if (input.status === 'stale' || input.status === 'not_configured' || input.status === 'degraded') return 'attention';
  if (input.freshness === 'stale') return 'attention';
  if (input.status === 'ok' || input.status === 'healthy') return 'ok';
  return 'attention';
}

function runtimeHealthNote(input: {
  target: AdminUserBotRuntimeHealthSummary['target'];
  status: string | null;
  readState: string | null;
  readStateDetail: string | null;
  freshness: AdminUserBotRuntimeHealthSummary['freshness'];
  state: AdminUserBotRuntimeHealthSummary['state'];
}): string {
  if (input.state === 'missing') return `No persisted ${input.target} health row exists yet. Run the worker snapshot cycle.`;
  if (input.readStateDetail) return input.readStateDetail;
  if (input.readState === 'not_configured') return `${input.target} is not configured in the latest worker health cycle.`;
  if (input.readState === 'stale') return `${input.target} returned stale data in the latest worker health cycle.`;
  if (input.readState === 'unreachable') return `${input.target} was unreachable in the latest worker health cycle.`;
  if (input.readState === 'malformed') return `${input.target} returned malformed data in the latest worker health cycle.`;
  if (input.freshness === 'stale') return `${input.target} health row is older than the admin freshness window.`;
  return `${input.target} latest persisted health status is ${input.status ?? 'unknown'}.`;
}

function runtimeHealthSummary(
  productCode: AdminBotProductCode,
  row: { status: string; detail: Record<string, unknown> | null; checkedAt: Date } | null,
  now: number,
): AdminUserBotRuntimeHealthSummary {
  const target = runtimeTargetForProduct(productCode);
  if (!row) {
    return {
      target,
      status: null,
      readState: null,
      readStateDetail: null,
      checkedAt: null,
      freshness: 'missing',
      state: 'missing',
      note: `No persisted ${target} health row exists yet. Run the worker snapshot cycle.`,
    };
  }
  const readState = detailText(row.detail, 'readState');
  const readStateDetail = detailText(row.detail, 'readStateDetail');
  const ageStale = now - row.checkedAt.getTime() > ADMIN_BOT_RUNTIME_STALE_AFTER_MS;
  const freshness: AdminUserBotRuntimeHealthSummary['freshness'] = readState === 'stale' || ageStale ? 'stale' : 'fresh';
  const state = runtimeHealthState({ status: row.status, readState, freshness });
  return {
    target,
    status: row.status,
    readState,
    readStateDetail,
    checkedAt: row.checkedAt.getTime(),
    freshness,
    state,
    note: runtimeHealthNote({ target, status: row.status, readState, readStateDetail, freshness, state }),
  };
}

function workerFieldPrefix(productCode: AdminBotProductCode): 'tortila' | 'legacy' {
  return productCode === 'legacy_bot' ? 'legacy' : 'tortila';
}

function workerContinuityState(input: {
  status: string | null;
  botContinuityStatus: string | null;
  productSnapshot: string | null;
  productReadState: string | null;
  freshness: AdminUserBotWorkerContinuitySummary['freshness'];
}): AdminUserBotWorkerContinuitySummary['state'] {
  if (input.status === null) return 'missing';
  if (input.status === 'error' || input.botContinuityStatus === 'error' || input.productSnapshot === 'error') return 'error';
  if (input.productReadState === 'unreachable' || input.productReadState === 'malformed') return 'error';
  if (input.freshness === 'stale') return 'attention';
  if (input.status === 'ok' && input.botContinuityStatus === 'ok' && input.productSnapshot === 'ok' && input.productReadState === 'ok') return 'ok';
  return 'attention';
}

function workerContinuitySummary(
  productCode: AdminBotProductCode,
  row: { status: string; detail: Record<string, unknown> | null; checkedAt: Date } | null,
  now: number,
): AdminUserBotWorkerContinuitySummary {
  const prefix = workerFieldPrefix(productCode);
  if (!row) {
    return {
      target: 'worker',
      status: null,
      coreWorkerStatus: null,
      botContinuityStatus: null,
      checkedAt: null,
      freshness: 'missing',
      state: 'missing',
      productSnapshot: null,
      productReadState: null,
      note: "No aggregate target='worker' heartbeat row exists yet. Run the worker snapshot cycle before selected-user launch readiness can be green.",
    };
  }

  const detail = row.detail ?? {};
  const botContinuityStatus = detailText(detail, 'botContinuityStatus');
  const coreWorkerStatus = detailText(detail, 'coreWorkerStatus');
  const productSnapshot = detailText(detail, `${prefix}Snapshot`);
  const productReadState = detailText(detail, `${prefix}ReadState`);
  const ageStale = now - row.checkedAt.getTime() > ADMIN_WORKER_CONTINUITY_STALE_AFTER_MS;
  const freshness: AdminUserBotWorkerContinuitySummary['freshness'] = ageStale ? 'stale' : 'fresh';
  const state = workerContinuityState({
    status: row.status,
    botContinuityStatus,
    productSnapshot,
    productReadState,
    freshness,
  });

  return {
    target: 'worker',
    status: row.status,
    coreWorkerStatus,
    botContinuityStatus,
    checkedAt: row.checkedAt.getTime(),
    freshness,
    state,
    productSnapshot,
    productReadState,
    note: state === 'ok'
      ? `Aggregate worker continuity is fresh and ${prefix} snapshot/readState are ok.`
      : freshness === 'stale'
        ? `Aggregate target='worker' heartbeat is older than the admin freshness window.`
        : `Aggregate target='worker' is not green for ${prefix}: worker=${row.status}, botContinuity=${botContinuityStatus ?? 'unknown'}, snapshot=${productSnapshot ?? 'unknown'}, readState=${productReadState ?? 'unknown'}.`,
  };
}

function singleMappedLegacyHealth(detail: Record<string, unknown> | null): boolean {
  if (!detail) return false;
  const mappingsSeen = numberValue(detail.providerAccountMappingsSeen);
  const mappingsSnapshotted = numberValue(detail.providerAccountMappingsSnapshotted);
  return mappingsSeen === 1 && mappingsSnapshotted === 1;
}

function adminUserWarningSummary(
  productCode: AdminBotProductCode,
  health: { detail: Record<string, unknown> | null; checkedAt: Date } | null,
  providerAccount: AdminUserProviderAccountSummary | null,
  hasScopedRuntimeEvidence: boolean,
): AdminUserBotWarningSummary {
  const warnings: RiskWarning[] = [...knownWarningsForProduct(productCode)];
  let source: AdminUserBotWarningSummary['source'] = 'product_registry';
  let scope: AdminUserBotWarningSummary['scope'] = 'product_level';
  let evaluatedAt: number | null = null;
  let note =
    productCode === 'legacy_bot'
      ? 'Product-level Legacy warnings only. Runtime warning codes are not attributed to this user unless one active provider-account mapping is scoped by the worker health cycle.'
      : 'Product-level Tortila warnings from the canonical registry. Live control remains disabled.';

  if (health && productCode === 'tortila_bot') {
    warnings.push(...warningsFromDetail(productCode, health.detail ?? {}));
    source = 'integration_health_checks';
    scope = 'product_plus_runtime_health';
    evaluatedAt = health.checkedAt.getTime();
    note = 'Tortila warning copy is registry-owned and may include the latest sanitized journal health codes.';
  }

  if (health && productCode === 'legacy_bot' && providerAccount && hasScopedRuntimeEvidence && singleMappedLegacyHealth(health.detail)) {
    warnings.push(...warningsFromDetail(productCode, health.detail));
    source = 'integration_health_checks';
    scope = 'product_plus_runtime_health';
    evaluatedAt = health.checkedAt.getTime();
    note = 'Legacy runtime warning codes are included because this selected user has scoped persisted provider evidence and the latest worker health cycle reported exactly one scoped provider-account mapping.';
  } else if (productCode === 'legacy_bot' && providerAccount) {
    scope = 'runtime_not_scoped';
    note = hasScopedRuntimeEvidence
      ? 'Legacy product warnings are shown, but runtime-specific health codes are not attributed to this user because the latest worker health row is not uniquely scoped to this provider mapping.'
      : 'Legacy product warnings are shown, but runtime-specific health codes are not attributed until this provider mapping has selected-user persisted runtime evidence.';
  } else if (productCode === 'legacy_bot') {
    scope = 'runtime_not_scoped';
    note = 'Legacy runtime warnings are not evaluated for this user until exactly one active provider pub_id is mapped to the WTC bot instance.';
  }

  const unique = uniqueWarnings(warnings);
  const summary = warningSummaryFromWarnings(unique);
  return {
    status: unique.length > 0 ? 'warnings_present' : 'none_reported',
    count: summary.count,
    maxSeverity: summary.maxSeverity,
    warnings: unique.map(warningView),
    evaluatedAt,
    source,
    scope,
    note,
  };
}

function symbolsFromConfig(config: Record<string, unknown>): string[] {
  const rowSymbols = objectArray(config.symbolConfigs)
    .map((row) => stringValue(row.symbol))
    .filter((symbol): symbol is string => !!symbol);
  if (rowSymbols.length > 0) return [...new Set(rowSymbols)].slice(0, 30);

  if (typeof config.symbols === 'string') {
    return [...new Set(config.symbols.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 30);
  }
  if (Array.isArray(config.symbols)) {
    return [...new Set(config.symbols.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))].slice(0, 30);
  }
  return [];
}

function legacyStageSummary(config: Record<string, unknown>): { stageCount: number | null; stageCapacity: number | null } {
  const stages = objectArray(config.stageConfigs);
  if (stages.length > 0) {
    const capacity = stages.reduce((sum, row) => sum + (numberValue(row.rsiSlots) ?? 0) + (numberValue(row.cciSlots) ?? 0), 0);
    return { stageCount: stages.length, stageCapacity: capacity };
  }
  const maxSlots = numberValue(config.maxSlots);
  if (maxSlots !== null && maxSlots > 0) return { stageCount: 1, stageCapacity: maxSlots };
  return { stageCount: null, stageCapacity: null };
}

function signalSummary(config: Record<string, unknown>): string | null {
  const rows = objectArray(config.symbolConfigs);
  if (rows.length === 0) return null;
  const rsi = rows.filter((row) => row.useRsi === true && row.useCci !== true).length;
  const cci = rows.filter((row) => row.useCci === true && row.useRsi !== true).length;
  const mixed = rows.filter((row) => row.useCci === true && row.useRsi === true).length;
  return `${rsi} RSI / ${cci} CCI${mixed > 0 ? ` / ${mixed} mixed` : ''}`;
}

type AdminConfigRow = { version: number; updatedAt: Date; config: Record<string, unknown> };
type AdminConfigSource = AdminUserBotConfigSummary['source'];
type AdminSystemDefaultWithConfig = NonNullable<AdminUserBotConfigSummary['systemDefault']> & {
  config: Record<string, unknown>;
};

const TORTILA_ADMIN_BUILT_IN_CONFIG: Record<string, unknown> = {
  operationMode: 'manual',
  symbols: 'XRP/USDT:USDT, TRX/USDT:USDT, NEAR/USDT:USDT, HBAR/USDT:USDT, LINK/USDT:USDT',
  symbolConfigs: [
    { symbol: 'XRP/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, maxOpenSymbols: 5 },
    { symbol: 'TRX/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.5, maxOpenSymbols: 5 },
    { symbol: 'NEAR/USDT:USDT', timeframe: '4h', system: 1, riskPercent: 0.3, maxOpenSymbols: 5 },
    { symbol: 'HBAR/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, maxOpenSymbols: 5 },
    { symbol: 'LINK/USDT:USDT', timeframe: '4h', system: 1, riskPercent: 0.3, maxOpenSymbols: 5 },
  ],
  timeframe: '4h',
  system: 2,
  riskPercent: 0.3,
  maxOpenSymbols: 5,
};

const LEGACY_ADMIN_BUILT_IN_CONFIG: Record<string, unknown> = {
  operationMode: 'manual',
  symbols: 'AAVE-USDT, ATOM-USDT, AVAX-USDT, BCH-USDT, FARTCOIN-USDT, KSM-USDT, LINK-USDT, SOL-USDT, SUI-USDT, TAO-USDT, UNI-USDT, XLM-USDT',
  defaultTimeframe: '3m',
  defaultTakeProfitPercent: 0.5,
  symbolConfigs: [
    { symbol: 'AAVE-USDT', useRsi: true, useCci: false },
    { symbol: 'ATOM-USDT', useRsi: true, useCci: false },
    { symbol: 'AVAX-USDT', useRsi: true, useCci: false },
    { symbol: 'BCH-USDT', useRsi: true, useCci: false },
    { symbol: 'FARTCOIN-USDT', useRsi: false, useCci: true },
    { symbol: 'KSM-USDT', useRsi: true, useCci: false },
    { symbol: 'LINK-USDT', useRsi: true, useCci: false },
    { symbol: 'SOL-USDT', useRsi: true, useCci: false },
    { symbol: 'SUI-USDT', useRsi: true, useCci: false },
    { symbol: 'TAO-USDT', useRsi: false, useCci: true },
    { symbol: 'UNI-USDT', useRsi: true, useCci: false },
    { symbol: 'XLM-USDT', useRsi: true, useCci: false },
  ],
  stageConfigs: [
    { stage: 1, rsiSlots: 3, cciSlots: 2 },
    { stage: 2, rsiSlots: 2, cciSlots: 1 },
  ],
};

const adminResolvedRecordSchema = z.record(z.unknown());
const tortilaAdminResolvedConfigSchema = adminResolvedRecordSchema.refine(
  (config) => symbolsFromConfig(config).length > 0,
  'Tortila config needs at least one symbol row.',
);
const legacyAdminResolvedConfigSchema = adminResolvedRecordSchema
  .refine((config) => symbolsFromConfig(config).length > 0, 'Legacy config needs at least one symbol row.')
  .refine((config) => legacyStageSummary(config).stageCount !== null, 'Legacy config needs stage capacity evidence.');

function adminResolvedConfigSchemaFor(productCode: AdminBotProductCode): typeof tortilaAdminResolvedConfigSchema | typeof legacyAdminResolvedConfigSchema {
  return productCode === 'legacy_bot' ? legacyAdminResolvedConfigSchema : tortilaAdminResolvedConfigSchema;
}

function safeAdminResolvedConfig(productCode: AdminBotProductCode, value: unknown): Record<string, unknown> | null {
  const parsed = adminResolvedConfigSchemaFor(productCode).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isSystemDefaultSelection(config: Record<string, unknown> | null | undefined): boolean {
  return config?.[BOT_CONFIG_SOURCE_KEY] === SYSTEM_DEFAULT_PROFILE_CODE;
}

function adminBuiltInConfigFor(productCode: AdminBotProductCode): Record<string, unknown> {
  return productCode === 'legacy_bot' ? LEGACY_ADMIN_BUILT_IN_CONFIG : TORTILA_ADMIN_BUILT_IN_CONFIG;
}

function productDefaultName(productCode: AdminBotProductCode): string {
  return productCode === 'legacy_bot' ? 'Legacy' : 'Tortila';
}

function projectSystemDefault(systemDefault: AdminSystemDefaultWithConfig): AdminUserBotConfigSummary['systemDefault'] {
  return {
    id: systemDefault.id,
    profileCode: systemDefault.profileCode,
    label: systemDefault.label,
    version: systemDefault.version,
    allowUserOverride: systemDefault.allowUserOverride,
    appliesToNewUsers: systemDefault.appliesToNewUsers,
    updatedAt: systemDefault.updatedAt,
  };
}

function publishedAdminSystemDefault(productCode: AdminBotProductCode, row: BotGlobalConfigRow | null): AdminSystemDefaultWithConfig | null {
  if (!row) return null;
  const config = safeAdminResolvedConfig(productCode, row.config);
  if (!config) return null;
  return {
    id: row.id,
    profileCode: row.profileCode,
    label: row.label,
    version: row.version,
    allowUserOverride: row.allowUserOverride,
    appliesToNewUsers: row.appliesToNewUsers,
    updatedAt: row.updatedAt.getTime(),
    config,
  };
}

function sourceLabelFor(
  productCode: AdminBotProductCode,
  source: AdminConfigSource,
  version: number | null,
  systemDefault: AdminSystemDefaultWithConfig | null,
): string {
  if (source === 'user_override') return version !== null ? `User custom profile v${version}` : 'User custom profile';
  if (source === 'system_default') return systemDefault ? `${systemDefault.label} v${systemDefault.version}` : 'System default';
  return `Built-in ${productDefaultName(productCode)} defaults`;
}

function sourceDetailFor(input: {
  productCode: AdminBotProductCode;
  source: AdminConfigSource;
  resolvedFromUserSelection: boolean;
  userConfigIgnoredByLock: boolean;
  systemDefault: AdminSystemDefaultWithConfig | null;
}): string {
  if (input.source === 'user_override') {
    return 'The user owns this WTC reference profile. Admins can inspect the safe summary here, but cannot edit user settings from this drilldown.';
  }
  if (input.source === 'system_default') {
    const selectionText = input.resolvedFromUserSelection
      ? 'The user explicitly selected the shared system default; the config body is resolved from the current published admin profile.'
      : 'No active user override is applied; the config body is resolved from the current published admin profile.';
    const lockText = input.userConfigIgnoredByLock
      ? ' A saved user profile exists, but personal overrides are locked by this published default.'
      : input.systemDefault?.allowUserOverride === false
        ? ' Personal overrides are locked by this published default.'
        : '';
    return `${selectionText}${lockText} This page remains read-only.`;
  }
  return `No user profile or valid published system default is active, so WTC resolves safe built-in ${productDefaultName(input.productCode)} defaults. Nothing is pushed to a live bot from this page.`;
}

function sourceNotes(input: {
  productCode: AdminBotProductCode;
  source: AdminConfigSource;
  resolvedFromUserSelection: boolean;
  userConfigIgnoredByLock: boolean;
}): string[] {
  const notes = ['Read-only admin projection'];
  if (input.source === 'user_override') notes.push('Resolved from user-owned WTC config');
  if (input.source === 'system_default') notes.push(input.resolvedFromUserSelection ? 'Resolved from user-selected system default' : 'Resolved from admin-published system default');
  if (input.source === 'built_in') notes.push('Resolved from built-in fallback defaults');
  if (input.userConfigIgnoredByLock) notes.push('Saved user profile ignored because overrides are locked');
  notes.push(input.productCode === 'legacy_bot'
    ? 'No provider pub_id, raw config, secrets, or live-apply credential included'
    : 'No exchange secret, raw config, or live-apply credential included');
  return notes;
}

function mapResolvedConfigSummary(input: {
  productCode: AdminBotProductCode;
  source: AdminConfigSource;
  config: Record<string, unknown>;
  version: number | null;
  updatedAt: number | null;
  userRow: AdminConfigRow | null;
  systemDefault: AdminSystemDefaultWithConfig | null;
  resolvedFromUserSelection: boolean;
  userConfigIgnoredByLock: boolean;
}): AdminUserBotConfigSummary {
  const symbols = symbolsFromConfig(input.config);
  const operationMode = stringValue(input.config.operationMode);
  const sourceLabel = sourceLabelFor(input.productCode, input.source, input.version, input.systemDefault);
  const sourceDetail = sourceDetailFor(input);
  const notes = sourceNotes(input);
  if (input.productCode === 'legacy_bot') {
    const stages = legacyStageSummary(input.config);
    const signal = signalSummary(input.config);
    const timeframe = stringValue(input.config.defaultTimeframe ?? input.config.timeframe);
    const tp = numberValue(input.config.defaultTakeProfitPercent ?? input.config.takeProfitPercent);
    return {
      source: input.source,
      version: input.version,
      updatedAt: input.updatedAt,
      sourceLabel,
      sourceDetail,
      userVersion: input.userRow?.version ?? null,
      userUpdatedAt: dateMs(input.userRow?.updatedAt),
      resolvedFromUserSelection: input.resolvedFromUserSelection,
      userConfigIgnoredByLock: input.userConfigIgnoredByLock,
      systemDefault: input.systemDefault ? projectSystemDefault(input.systemDefault) : null,
      operationMode,
      symbolCount: symbols.length,
      symbols,
      symbolPreview: symbols.length > 0 ? symbols.slice(0, 6).join(', ') : 'No symbol rows saved',
      stageCount: stages.stageCount,
      stageCapacity: stages.stageCapacity,
      riskSummary: [signal, timeframe ? `${timeframe} timeframe` : null, tp !== null ? `${tp}% TP` : null].filter(Boolean).join(' - ') || null,
      notes,
    };
  }

  const timeframe = stringValue(input.config.timeframe);
  const system = numberValue(input.config.system);
  const risk = numberValue(input.config.riskPercent);
  const maxOpenSymbols = numberValue(input.config.maxOpenSymbols);
  return {
    source: input.source,
    version: input.version,
    updatedAt: input.updatedAt,
    sourceLabel,
    sourceDetail,
    userVersion: input.userRow?.version ?? null,
    userUpdatedAt: dateMs(input.userRow?.updatedAt),
    resolvedFromUserSelection: input.resolvedFromUserSelection,
    userConfigIgnoredByLock: input.userConfigIgnoredByLock,
    systemDefault: input.systemDefault ? projectSystemDefault(input.systemDefault) : null,
    operationMode,
    symbolCount: symbols.length,
    symbols,
    symbolPreview: symbols.length > 0 ? symbols.slice(0, 6).join(', ') : 'No symbol rows saved',
    stageCount: null,
    stageCapacity: null,
    riskSummary: [
      system !== null ? `System ${system}` : null,
      timeframe ? `${timeframe} timeframe` : null,
      risk !== null ? `${risk}% risk` : null,
      maxOpenSymbols !== null ? `${maxOpenSymbols} max symbols` : null,
    ].filter(Boolean).join(' - ') || null,
    notes,
  };
}

function resolveAdminBotConfigSummary(
  productCode: AdminBotProductCode,
  userRow: AdminConfigRow | null,
  systemDefault: AdminSystemDefaultWithConfig | null,
): AdminUserBotConfigSummary {
  const selectedSystemDefault = isSystemDefaultSelection(userRow?.config);
  const userConfig = userRow && !selectedSystemDefault ? safeAdminResolvedConfig(productCode, userRow.config) : null;
  const userConfigIgnoredByLock = !!userConfig && systemDefault?.allowUserOverride === false;

  if (userRow && userConfig && !userConfigIgnoredByLock) {
    return mapResolvedConfigSummary({
      productCode,
      source: 'user_override',
      config: userConfig,
      version: userRow.version,
      updatedAt: userRow.updatedAt.getTime(),
      userRow,
      systemDefault,
      resolvedFromUserSelection: false,
      userConfigIgnoredByLock: false,
    });
  }

  if (systemDefault) {
    return mapResolvedConfigSummary({
      productCode,
      source: 'system_default',
      config: systemDefault.config,
      version: systemDefault.version,
      updatedAt: systemDefault.updatedAt,
      userRow,
      systemDefault,
      resolvedFromUserSelection: selectedSystemDefault,
      userConfigIgnoredByLock,
    });
  }

  return mapResolvedConfigSummary({
    productCode,
    source: 'built_in',
    config: adminBuiltInConfigFor(productCode),
    version: null,
    updatedAt: null,
    userRow,
    systemDefault: null,
    resolvedFromUserSelection: selectedSystemDefault,
    userConfigIgnoredByLock: false,
  });
}

function mapProviderAccountSummary(row: {
  id: string;
  productCode: string;
  provider: string;
  providerAccountId: string;
  label: string | null;
  status: string;
  updatedAt: Date;
}): AdminUserProviderAccountSummary {
  return {
    id: row.id,
    productCode: row.productCode,
    provider: row.provider,
    providerAccountId: maskProviderAccountId(row.providerAccountId),
    label: row.label,
    status: row.status === 'disabled' || row.status === 'needs_review' ? row.status : 'active',
    updatedAt: row.updatedAt.getTime(),
  };
}

type AdminMetricSnapshotRow = {
  botInstanceId: string;
  botProviderAccountId: string | null;
  snapshotAt: Date;
  walletEquityUsd: string | null;
  closedPnlUsd: string | null;
  unrealizedPnlUsd: string | null;
  winRate: string | null;
  profitFactor: string | null;
  maxDrawdownPct: string | null;
  tradeCount: number | null;
  sourceAdapter: string;
  rawJson: unknown;
};

type AdminPositionSnapshotRow = {
  botInstanceId: string;
  botProviderAccountId: string | null;
  snapshotAt: Date;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string | null;
  unrealizedPnlUsd: string | null;
  leverage: number | null;
  tpPrice: string | null;
  slPrice: string | null;
  liquidationPrice: string | null;
  openedAt: Date | null;
  sourceAdapter: string;
};

type AdminTradeImportRow = {
  botInstanceId: string;
  botProviderAccountId: string | null;
  externalTradeId: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  exitPrice: string;
  realizedPnlUsd: string;
  feesUsd: string;
  fundingPaidUsd: string;
  openedAt: Date;
  closedAt: Date;
  exitReason: string | null;
  sourceAdapter: string;
};

function rowMatchesProviderScope(
  productCode: ProductCode,
  rowProviderAccountId: string | null,
  activeProviderAccountId: string | null,
): boolean {
  if (productCode !== 'legacy_bot') return true;
  return activeProviderAccountId !== null && rowProviderAccountId === activeProviderAccountId;
}

function legacyClosedTradeSourceProofFromMetricRaw(row: AdminMetricSnapshotRow | null | undefined): AdminUserBotClosedTradeSourceProofSummary | null {
  if (!row || !row.rawJson || typeof row.rawJson !== 'object' || Array.isArray(row.rawJson)) return null;
  const rawMetric = row.rawJson as Record<string, unknown>;
  return legacyClosedTradeSourceProofSummaryFromRaw(rawMetric.closedTradeSourceProof, 'scoped_worker_metric');
}

function scopedRows<T extends { botInstanceId: string; botProviderAccountId: string | null }>(
  rows: T[],
  productCode: ProductCode,
  botInstanceId: string,
  activeProviderAccountId: string | null,
): T[] {
  return rows.filter((row) =>
    row.botInstanceId === botInstanceId && rowMatchesProviderScope(productCode, row.botProviderAccountId, activeProviderAccountId),
  );
}

function latestPositionBatch(rows: AdminPositionSnapshotRow[]): AdminUserBotPositionSummary[] {
  const latestAt = rows[0]?.snapshotAt.getTime();
  if (!latestAt) return [];
  return rows
    .filter((row) => row.snapshotAt.getTime() === latestAt)
    .slice(0, 20)
    .map(mapPositionSummary);
}

function buildAdminBotStats(
  productCode: ProductCode,
  botInstanceId: string,
  activeProviderAccountId: string | null,
  metricRows: AdminMetricSnapshotRow[],
  positionRows: AdminPositionSnapshotRow[],
  tradeRows: AdminTradeImportRow[],
): {
  positions: AdminUserBotPositionSummary[];
  trades: AdminUserBotTradeSummary[];
  equityCurve: AdminUserBotEquityPoint[];
  statsSource: AdminUserBotStatsSourceSummary;
} {
  const scopedMetrics = scopedRows(metricRows, productCode, botInstanceId, activeProviderAccountId);
  const scopedPositions = scopedRows(positionRows, productCode, botInstanceId, activeProviderAccountId);
  const scopedTrades = scopedRows(tradeRows, productCode, botInstanceId, activeProviderAccountId);
  const equityCurve = scopedMetrics
    .map(mapEquityPoint)
    .filter((point): point is AdminUserBotEquityPoint => point !== null)
    .sort((a, b) => a.t - b.t)
    .slice(-48);

  return {
    positions: latestPositionBatch(scopedPositions),
    trades: scopedTrades.slice(0, 20).map(mapTradeSummary),
    equityCurve,
    statsSource: {
      latestPositionAt: dateMs(scopedPositions[0]?.snapshotAt),
      latestTradeAt: dateMs(scopedTrades[0]?.closedAt),
      equityPoints: equityCurve.length,
      providerScoped: productCode === 'legacy_bot' && activeProviderAccountId !== null,
    },
  };
}

function emptyAdminBotStats(): {
  positions: AdminUserBotPositionSummary[];
  trades: AdminUserBotTradeSummary[];
  equityCurve: AdminUserBotEquityPoint[];
  statsSource: AdminUserBotStatsSourceSummary;
} {
  return {
    positions: [],
    trades: [],
    equityCurve: [],
    statsSource: {
      latestPositionAt: null,
      latestTradeAt: null,
      equityPoints: 0,
      providerScoped: false,
    },
  };
}

export async function loadAdminUserBotDetailFromDb(db: Db, userId: string, now = Date.now()): Promise<AdminUserBotDetailResult> {
  const [userRow] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      createdAt: schema.users.createdAt,
      failedLoginTotalCount: schema.users.failedLoginTotalCount,
      lastFailedLoginAt: schema.users.lastFailedLoginAt,
      accountLockedUntil: schema.users.accountLockedUntil,
      accountLockoutReviewRequiredAt: schema.users.accountLockoutReviewRequiredAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!userRow) {
    return emptyAdminUserBotDetail('postgres');
  }

  const [roleRows, entitlementRows, instanceRows, exchangeRows, providerRows, systemDefaultPairs, healthRows, workerHealthRow] = await Promise.all([
    db
      .select({
        roleCode: schema.userRoles.roleCode,
      })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, userId)),
    db
      .select({
        productCode: schema.entitlements.productCode,
        status: schema.entitlements.status,
        source: schema.entitlements.source,
        planCode: schema.entitlements.planCode,
        startsAt: schema.entitlements.startsAt,
        updatedAt: schema.entitlements.updatedAt,
        currentPeriodEnd: schema.entitlements.currentPeriodEnd,
        graceUntil: schema.entitlements.graceUntil,
        expiresAt: schema.entitlements.expiresAt,
        manualOverride: schema.entitlements.manualOverride,
      })
      .from(schema.entitlements)
      .where(and(eq(schema.entitlements.userId, userId), inArray(schema.entitlements.productCode, ADMIN_BOT_PRODUCT_CODE_VALUES))),
    db
      .select({
        id: schema.botInstances.id,
        productCode: schema.botInstances.productCode,
        exchangeAccountId: schema.botInstances.exchangeAccountId,
      })
      .from(schema.botInstances)
      .where(and(eq(schema.botInstances.userId, userId), inArray(schema.botInstances.productCode, ADMIN_BOT_PRODUCT_CODE_VALUES))),
    db
      .select({
        id: schema.exchangeAccounts.id,
        exchange: schema.exchangeAccounts.exchange,
        label: schema.exchangeAccounts.label,
        mode: schema.exchangeAccounts.mode,
        keyMask: schema.exchangeAccounts.keyMask,
      })
      .from(schema.exchangeAccounts)
      .where(eq(schema.exchangeAccounts.userId, userId)),
    db
      .select({
        id: schema.botProviderAccounts.id,
        userId: schema.botProviderAccounts.userId,
        botInstanceId: schema.botProviderAccounts.botInstanceId,
        productCode: schema.botProviderAccounts.productCode,
        provider: schema.botProviderAccounts.provider,
        providerAccountId: schema.botProviderAccounts.providerAccountId,
        label: schema.botProviderAccounts.label,
        status: schema.botProviderAccounts.status,
        updatedAt: schema.botProviderAccounts.updatedAt,
      })
      .from(schema.botProviderAccounts)
      .where(and(eq(schema.botProviderAccounts.userId, userId), inArray(schema.botProviderAccounts.productCode, ADMIN_BOT_PRODUCT_CODE_VALUES)))
      .orderBy(desc(schema.botProviderAccounts.updatedAt)),
    Promise.all(ADMIN_BOT_PRODUCT_CODES.map(async (productCode) => {
      const row = await getPublishedBotGlobalConfig(db, productCode);
      return [productCode, publishedAdminSystemDefault(productCode, row)] as const;
    })),
    Promise.all(ADMIN_BOT_RUNTIME_TARGETS.map(async (target) => {
      const [row] = await db
        .select({
          target: schema.integrationHealthChecks.target,
          status: schema.integrationHealthChecks.status,
          detail: schema.integrationHealthChecks.detail,
          checkedAt: schema.integrationHealthChecks.checkedAt,
        })
        .from(schema.integrationHealthChecks)
        .where(eq(schema.integrationHealthChecks.target, target))
        .orderBy(desc(schema.integrationHealthChecks.checkedAt))
        .limit(1);
      return row ?? null;
    })),
    (async () => {
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
      return row ?? null;
    })(),
  ]);

  const instanceIds = instanceRows.map((row) => row.id);
  const [configRows, metricRows, positionRows, tradeRows] = instanceIds.length > 0 ? await Promise.all([
    db
      .select({
        botInstanceId: schema.botConfigs.botInstanceId,
        version: schema.botConfigs.version,
        config: schema.botConfigs.config,
        updatedAt: schema.botConfigs.updatedAt,
      })
      .from(schema.botConfigs)
      .where(inArray(schema.botConfigs.botInstanceId, instanceIds))
      .orderBy(desc(schema.botConfigs.version), desc(schema.botConfigs.updatedAt)),
    db
      .select({
        botInstanceId: schema.botMetricSnapshots.botInstanceId,
        botProviderAccountId: schema.botMetricSnapshots.botProviderAccountId,
        snapshotAt: schema.botMetricSnapshots.snapshotAt,
        walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
        closedPnlUsd: schema.botMetricSnapshots.closedPnlUsd,
        unrealizedPnlUsd: schema.botMetricSnapshots.unrealizedPnlUsd,
        winRate: schema.botMetricSnapshots.winRate,
        profitFactor: schema.botMetricSnapshots.profitFactor,
        maxDrawdownPct: schema.botMetricSnapshots.maxDrawdownPct,
        tradeCount: schema.botMetricSnapshots.tradeCount,
        sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
        rawJson: schema.botMetricSnapshots.rawJson,
      })
      .from(schema.botMetricSnapshots)
      .where(inArray(schema.botMetricSnapshots.botInstanceId, instanceIds))
      .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
      .limit(200),
    db
      .select({
        botInstanceId: schema.botPositionSnapshots.botInstanceId,
        botProviderAccountId: schema.botPositionSnapshots.botProviderAccountId,
        snapshotAt: schema.botPositionSnapshots.snapshotAt,
        symbol: schema.botPositionSnapshots.symbol,
        side: schema.botPositionSnapshots.side,
        size: schema.botPositionSnapshots.size,
        entryPrice: schema.botPositionSnapshots.entryPrice,
        markPrice: schema.botPositionSnapshots.markPrice,
        unrealizedPnlUsd: schema.botPositionSnapshots.unrealizedPnlUsd,
        leverage: schema.botPositionSnapshots.leverage,
        tpPrice: schema.botPositionSnapshots.tpPrice,
        slPrice: schema.botPositionSnapshots.slPrice,
        liquidationPrice: schema.botPositionSnapshots.liquidationPrice,
        openedAt: schema.botPositionSnapshots.openedAt,
        sourceAdapter: schema.botPositionSnapshots.sourceAdapter,
      })
      .from(schema.botPositionSnapshots)
      .where(inArray(schema.botPositionSnapshots.botInstanceId, instanceIds))
      .orderBy(desc(schema.botPositionSnapshots.snapshotAt))
      .limit(300),
    db
      .select({
        botInstanceId: schema.botTradeImports.botInstanceId,
        botProviderAccountId: schema.botTradeImports.botProviderAccountId,
        externalTradeId: schema.botTradeImports.externalTradeId,
        symbol: schema.botTradeImports.symbol,
        side: schema.botTradeImports.side,
        size: schema.botTradeImports.size,
        entryPrice: schema.botTradeImports.entryPrice,
        exitPrice: schema.botTradeImports.exitPrice,
        realizedPnlUsd: schema.botTradeImports.realizedPnlUsd,
        feesUsd: schema.botTradeImports.feesUsd,
        fundingPaidUsd: schema.botTradeImports.fundingPaidUsd,
        openedAt: schema.botTradeImports.openedAt,
        closedAt: schema.botTradeImports.closedAt,
        exitReason: schema.botTradeImports.exitReason,
        sourceAdapter: schema.botTradeImports.sourceAdapter,
      })
      .from(schema.botTradeImports)
      .where(inArray(schema.botTradeImports.botInstanceId, instanceIds))
      .orderBy(desc(schema.botTradeImports.closedAt))
      .limit(300),
  ]) : [[], [], [], []];

  const user = mapToAdminUserView({
    ...userRow,
    roles: roleRows.map((row) => row.roleCode),
  });
  const entitlementModels: Entitlement[] = entitlementRows.map((row) => ({
    userId,
    productCode: row.productCode,
    status: row.status as EntitlementStatus,
    source: row.source as EntitlementSource,
    planCode: row.planCode ?? undefined,
    startsAt: optionalDateMs(row.startsAt),
    currentPeriodEnd: optionalDateMs(row.currentPeriodEnd),
    graceUntil: optionalDateMs(row.graceUntil),
    expiresAt: optionalDateMs(row.expiresAt),
    manualOverride: row.manualOverride,
    updatedAt: row.updatedAt.getTime(),
  }));
  const entitlementsByProduct = new Map(entitlementRows.map((row) => [row.productCode, row]));
  const instancesByProduct = new Map(instanceRows.map((row) => [row.productCode, row]));
  const configsByInstance = new Map(configRows.map((row) => [row.botInstanceId, row]));
  const systemDefaultsByProduct = new Map(systemDefaultPairs);
  const exchangeKeys = exchangeRows.map(mapExchangeKeySummary);
  const exchangeKeysById = new Map(exchangeKeys.map((row) => [row.id, row]));
  const providerAccounts = providerRows.map(mapProviderAccountSummary);
  const activeProvidersByInstance = new Map<string, AdminUserProviderAccountSummary[]>();
  for (const row of providerRows) {
    if (row.status !== 'active') continue;
    const current = activeProvidersByInstance.get(row.botInstanceId) ?? [];
    current.push(mapProviderAccountSummary(row));
    activeProvidersByInstance.set(row.botInstanceId, current);
  }
  const activeProviderByInstance = new Map(
    [...activeProvidersByInstance.entries()]
      .filter(([, rows]) => rows.length === 1)
      .map(([instanceId, rows]) => [instanceId, rows[0]!] as const),
  );
  const healthByProduct = new Map<AdminBotProductCode, { status: string; detail: Record<string, unknown> | null; checkedAt: Date }>();
  for (const row of healthRows) {
    if (!row) continue;
    const productCode = healthProductForTarget(row.target);
    if (!productCode || healthByProduct.has(productCode)) continue;
    healthByProduct.set(productCode, {
      status: row.status,
      detail: projectHealthDetail(row.detail),
      checkedAt: row.checkedAt,
    });
  }
  const productByInstance = new Map(instanceRows.map((row) => [row.id, row.productCode]));
  const latestMetricByInstance = new Map<string, AdminUserBotMetricSummary>();
  const latestClosedTradeSourceProofByInstance = new Map<string, AdminUserBotClosedTradeSourceProofSummary>();
  const workerHealth = workerHealthRow
    ? { status: workerHealthRow.status, detail: projectHealthDetail(workerHealthRow.detail), checkedAt: workerHealthRow.checkedAt }
    : null;

  for (const row of metricRows) {
    const productCode = productByInstance.get(row.botInstanceId);
    if (productCode === 'legacy_bot') {
      const activeProvider = activeProviderByInstance.get(row.botInstanceId);
      if (!activeProvider || row.botProviderAccountId !== activeProvider.id) continue;
    }
    if (!latestMetricByInstance.has(row.botInstanceId)) {
      latestMetricByInstance.set(row.botInstanceId, mapMetricSummary(row));
      const sourceProof = productCode === 'legacy_bot' ? legacyClosedTradeSourceProofFromMetricRaw(row) : null;
      if (sourceProof) latestClosedTradeSourceProofByInstance.set(row.botInstanceId, sourceProof);
    }
  }

  const bots: AdminUserBotSummary[] = ADMIN_BOT_PRODUCT_CODES.map((productCode) => {
    const entitlement = entitlementsByProduct.get(productCode) ?? null;
    const access = explainAccess(entitlementModels, productCode, now);
    const instance = instancesByProduct.get(productCode) ?? null;
    const config = instance ? configsByInstance.get(instance.id) ?? null : null;
    const exchangeAccount = instance?.exchangeAccountId ? exchangeKeysById.get(instance.exchangeAccountId) ?? null : null;
    const providerAccount = instance ? activeProviderByInstance.get(instance.id) ?? null : null;
    const runtimeHealth = runtimeHealthSummary(productCode, healthByProduct.get(productCode) ?? null, now);
    const stats = instance
      ? buildAdminBotStats(productCode, instance.id, providerAccount?.id ?? null, metricRows, positionRows, tradeRows)
      : emptyAdminBotStats();
    const latestMetric = instance ? latestMetricByInstance.get(instance.id) ?? null : null;
    const closedTradeSourceProof = productCode === 'legacy_bot'
      ? (instance ? latestClosedTradeSourceProofByInstance.get(instance.id) ?? null : null) ?? legacyClosedTradeSourceProofSummary()
      : null;
    const hasScopedRuntimeEvidence =
      productCode !== 'legacy_bot' ||
      (!!providerAccount && (!!latestMetric || stats.positions.length > 0 || stats.trades.length > 0 || stats.equityCurve.length > 0));
    return {
      productCode,
      productName: PRODUCTS[productCode].name,
      entitlementStatus: access.status === 'none' ? null : access.status,
      entitlementPlanCode: access.entitlement?.planCode ?? entitlement?.planCode ?? null,
      entitlementUpdatedAt: dateMs(entitlement?.updatedAt),
      entitlementCurrentPeriodEnd: dateMs(entitlement?.currentPeriodEnd),
      accessOpen: access.allowed,
      botInstanceId: instance?.id ?? null,
      configVersion: config?.version ?? null,
      configUpdatedAt: dateMs(config?.updatedAt),
      configSummary: resolveAdminBotConfigSummary(productCode, config ?? null, systemDefaultsByProduct.get(productCode) ?? null),
      exchangeAccount,
      providerAccount,
      latestMetric,
      closedTradeSourceProof,
      positions: stats.positions,
      trades: stats.trades,
      equityCurve: stats.equityCurve,
      statsSource: stats.statsSource,
      providerScope: productCode === 'legacy_bot'
        ? providerAccount
          ? 'provider_account_mapped'
          : 'provider_account_pending'
        : 'user_scoped',
      runtimeHealth,
      workerContinuity: workerContinuitySummary(productCode, workerHealth, now),
      warningSummary: adminUserWarningSummary(productCode, healthByProduct.get(productCode) ?? null, providerAccount, hasScopedRuntimeEvidence),
    };
  });

  return {
    mode: 'postgres',
    user,
    bots,
    exchangeKeys,
    providerAccounts,
    liveControlDisabled: true,
    legacyProviderScopeWarning: LEGACY_PROVIDER_SCOPE_WARNING,
  };
}
