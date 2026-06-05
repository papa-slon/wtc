import type { LegacyClosedTradeSourceProofSafeSummary } from '@wtc/bot-adapters';

/**
 * Admin feature types. This module is used by both server-side loaders and
 * React pages (read-only views). No business logic — just DTO shapes.
 */

/**
 * AdminUserView: safe user record for the admin console.
 * passwordHash is stripped; only display-safe fields are exposed.
 */
export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  /** epoch-ms */
  createdAt: number | null;
  lockout: {
    failedLoginTotalCount: number;
    /** epoch-ms | null */
    lastFailedLoginAt: number | null;
    /** epoch-ms | null */
    accountLockedUntil: number | null;
    /** epoch-ms | null */
    accountLockoutReviewRequiredAt: number | null;
    isLocked: boolean;
    requiresReview: boolean;
    unlockable: boolean;
  };
}

export interface AdminUserExchangeKeySummary {
  id: string;
  exchange: string;
  label: string;
  mode: 'demo' | 'live';
  keyMask: string;
}

export interface AdminUserBotMetricSummary {
  snapshotAt: number;
  walletEquityUsd: string | null;
  closedPnlUsd: string | null;
  unrealizedPnlUsd: string | null;
  winRate: string | null;
  profitFactor: string | null;
  maxDrawdownPct: string | null;
  tradeCount: number | null;
  sourceAdapter: string;
}

export type AdminUserBotClosedTradeSourceProofSummary = LegacyClosedTradeSourceProofSafeSummary;

export interface AdminUserBotPositionSummary {
  snapshotAt: number;
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
  openedAt: number | null;
  sourceAdapter: string;
}

export interface AdminUserBotTradeSummary {
  externalTradeId: string;
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  exitPrice: string;
  realizedPnlUsd: string;
  feesUsd: string;
  fundingPaidUsd: string;
  openedAt: number;
  closedAt: number;
  exitReason: string | null;
  sourceAdapter: string;
}

export interface AdminUserBotEquityPoint {
  t: number;
  equityUsd: string;
  sourceAdapter: string;
}

export interface AdminUserBotStatsSourceSummary {
  latestPositionAt: number | null;
  latestTradeAt: number | null;
  equityPoints: number;
  providerScoped: boolean;
}

export interface AdminUserBotConfigSummary {
  source: 'user_override' | 'system_default' | 'built_in';
  version: number | null;
  updatedAt: number | null;
  sourceLabel: string;
  sourceDetail: string;
  userVersion: number | null;
  userUpdatedAt: number | null;
  resolvedFromUserSelection: boolean;
  userConfigIgnoredByLock: boolean;
  systemDefault: {
    id: string;
    profileCode: string;
    label: string;
    version: number;
    allowUserOverride: boolean;
    appliesToNewUsers: boolean;
    updatedAt: number | null;
  } | null;
  operationMode: string | null;
  symbolCount: number;
  symbols: string[];
  symbolPreview: string;
  stageCount: number | null;
  stageCapacity: number | null;
  riskSummary: string | null;
  notes: string[];
}

export interface AdminUserProviderAccountSummary {
  id: string;
  productCode: string;
  provider: string;
  providerAccountId: string;
  label: string | null;
  status: 'active' | 'disabled' | 'needs_review';
  updatedAt: number | null;
}

export interface AdminUserBotWarningSummary {
  status: 'warnings_present' | 'none_reported';
  count: number;
  maxSeverity: 'info' | 'warning' | 'error' | null;
  warnings: BotWarningView[];
  evaluatedAt: number | null;
  source: 'product_registry' | 'integration_health_checks';
  scope: 'product_level' | 'product_plus_runtime_health' | 'runtime_not_scoped';
  note: string;
}

export interface AdminUserBotRuntimeHealthSummary {
  target: 'tortila-journal' | 'legacy-bot';
  status: string | null;
  readState: string | null;
  readStateDetail: string | null;
  checkedAt: number | null;
  freshness: 'fresh' | 'stale' | 'missing';
  state: 'ok' | 'attention' | 'error' | 'missing';
  note: string;
}

export interface AdminUserBotWorkerContinuitySummary {
  target: 'worker';
  status: string | null;
  coreWorkerStatus: string | null;
  botContinuityStatus: string | null;
  checkedAt: number | null;
  freshness: 'fresh' | 'stale' | 'missing';
  state: 'ok' | 'attention' | 'error' | 'missing';
  productSnapshot: string | null;
  productReadState: string | null;
  note: string;
}

export interface AdminUserBotSummary {
  productCode: 'tortila_bot' | 'legacy_bot';
  productName: string;
  entitlementStatus: string | null;
  entitlementPlanCode: string | null;
  entitlementUpdatedAt: number | null;
  entitlementCurrentPeriodEnd: number | null;
  accessOpen: boolean;
  botInstanceId: string | null;
  configVersion: number | null;
  configUpdatedAt: number | null;
  configSummary: AdminUserBotConfigSummary | null;
  exchangeAccount: AdminUserExchangeKeySummary | null;
  providerAccount: AdminUserProviderAccountSummary | null;
  latestMetric: AdminUserBotMetricSummary | null;
  closedTradeSourceProof: AdminUserBotClosedTradeSourceProofSummary | null;
  positions: AdminUserBotPositionSummary[];
  trades: AdminUserBotTradeSummary[];
  equityCurve: AdminUserBotEquityPoint[];
  statsSource: AdminUserBotStatsSourceSummary;
  providerScope: 'user_scoped' | 'provider_account_mapped' | 'provider_account_pending';
  runtimeHealth: AdminUserBotRuntimeHealthSummary;
  workerContinuity: AdminUserBotWorkerContinuitySummary;
  warningSummary: AdminUserBotWarningSummary;
}

export interface AdminUserBotDetailResult {
  mode: AdminMode;
  user: AdminUserView | null;
  bots: AdminUserBotSummary[];
  exchangeKeys: AdminUserExchangeKeySummary[];
  providerAccounts: AdminUserProviderAccountSummary[];
  liveControlDisabled: true;
  legacyProviderScopeWarning: string;
}

/** Storage mode reported by every admin loader. */
export type AdminMode = 'postgres' | 'demo';

/** Integration health check row (read from integration_health_checks). */
export interface HealthCheckView {
  id: string;
  target: string;
  status: string;
  detail: Record<string, unknown> | null;
  /** epoch-ms */
  checkedAt: number;
}

export interface BotWarningView {
  code: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
}

export interface AdminBotWarningSummary {
  target: string;
  productCode: 'tortila_bot' | 'legacy_bot';
  status: 'warnings_present' | 'none_reported';
  count: number;
  maxSeverity: 'info' | 'warning' | 'error' | null;
  warnings: BotWarningView[];
  evaluatedAt: number | null;
  source: 'integration_health_checks';
}

/** TV queue status counts for system-health summary. */
export interface TvQueueCounts {
  pending: number;
  granted: number;
  expired: number;
  revoked: number;
}

/** Webhook health summary derived from audit_logs. */
export interface WebhookHealthSummary {
  totalReceived: number;
  latestAt: number | null;
}

/** Latest worker heartbeat derived from integration_health_checks target='worker'. */
export interface WorkerHealthSummary {
  status: string | null;
  latestAt: number | null;
  stale: boolean;
  detail: Record<string, unknown> | null;
}

/** Count-only LMS cleanup operations; never includes cleanup task ids or object keys. */
export interface LmsObjectCleanupOpsSummary {
  storageProvider: string;
  reason: string;
  totalPending: number;
  pendingDue: number;
  pendingScheduled: number;
  deadLettered: number;
  maxAttemptsReached: number;
  deadLetteredUnacknowledged: number;
  deadLetteredAcknowledged: number;
  oldestDeadLetteredAt: number | null;
  latestDeadLetteredAt: number | null;
  latestUnacknowledgedDeadLetteredAt: number | null;
  latestAcknowledgedAt: number | null;
  latestDeadLetterErrorCode: string | null;
}

/** Full system health snapshot. */
export interface SystemHealthSnapshot {
  mode: AdminMode;
  /** 'postgres' | 'not_configured' */
  dbStatus: 'postgres' | 'not_configured';
  liveControlDisabled: boolean;
  tvAutomationDisabled: boolean;
  workerHealth: WorkerHealthSummary;
  webhookHealth: WebhookHealthSummary;
  tvQueueCounts: TvQueueCounts;
  lmsObjectCleanup: LmsObjectCleanupOpsSummary;
  healthChecks: HealthCheckView[];
}

/** Admin support ticket view (includes internal fields visible to admin). */
export interface AdminTicketView {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  productCode: string | null;
  userId: string;
  assignedTo: string | null;
  /** epoch-ms */
  createdAt: number;
  /** epoch-ms | null */
  resolvedAt: number | null;
}

export interface AdminSupportState {
  mode: AdminMode;
  tickets: AdminTicketView[];
}

// ---- Billing manual review queue types (Decision 5, billing-access-auditor) ----

/**
 * Safe DTO for a billing_manual_review_items row shown in the admin queue.
 * eventSnapshot contains only non-secret, non-PII parsed event fields — never raw body/signature.
 */
export interface ManualReviewItemView {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: string;
  userId: string | null;
  reason: string;
  eventSnapshot: Record<string, unknown>;
  /** epoch-ms */
  createdAt: number;
  resolvedBy: string | null;
  /** epoch-ms | null */
  resolvedAt: number | null;
  resolutionNote: string | null;
}

export interface AdminManualReviewState {
  mode: AdminMode;
  items: ManualReviewItemView[];
}

// ---- Admin bot health page types (bot-runtime-auditor F-01) ----

export interface AdminBotHealthResult {
  mode: AdminMode;
  /** 'mock' | 'read-only' | 'audited' — from env BOT_ADAPTER_MODE */
  adapterMode: string;
  /** Always true — hardcoded safety policy. */
  liveControlDisabled: true;
  /** Direct Legacy HTTP/control adapter status. DB live-read is tracked separately. */
  legacyAdapterBlocked: boolean;
  /** Whether the worker is allowed to read Legacy provider DB snapshots. */
  legacyDbLiveReadEnabled: boolean;
  /** Whether a Legacy DB connection string exists server-side. Value only; URL is never exposed. */
  legacyDatabaseConfigured: boolean;
  /** Whether TORTILA_JOURNAL_BASE_URL is configured (bool; URL itself never exposed). */
  tortilaBaseUrlConfigured: boolean;
  /** Latest worker heartbeat projection for bot continuity, derived from target='worker'. */
  workerBotContinuity: {
    status: string | null;
    checkedAt: number | null;
    freshness: 'fresh' | 'stale' | 'missing';
    ageSeconds: number | null;
    staleAfterSeconds: number;
    coreWorkerStatus: string | null;
    botContinuityStatus: string | null;
    tortilaSnapshot: string | null;
    tortilaHealthStatus: string | null;
    tortilaReadState: string | null;
    legacySnapshot: string | null;
    legacyHealthStatus: string | null;
    legacyReadState: string | null;
  } | null;
  /** Last successful health check for 'tortila-journal' target (epoch-ms) or null. */
  tortilaLastOkAt: number | null;
  /** Last error detail for 'tortila-journal' (truncated, no secrets). */
  tortilaLastError: string | null;
  /** Latest persisted status for 'tortila-journal' (for example ok, not_configured, unreachable). */
  tortilaJournalStatus: string | null;
  /** Adapter read-state persisted in the health detail, when available. */
  tortilaJournalReadState: string | null;
  /** Human-safe adapter read-state detail, truncated and secret-free. */
  tortilaJournalReadStateDetail: string | null;
  /** Latest bot_metric_snapshot row (snapshotAt epoch-ms, walletEquityUsd, sourceAdapter). */
  latestSnapshot: {
    snapshotAt: number;
    walletEquityUsd: string | null;
    sourceAdapter: string;
  } | null;
  /** Latest Tortila snapshots joined to WTC bot instance owners; no provider id is inferred. */
  tortilaFleetSnapshots: TortilaFleetSnapshotAdminView[];
  /** Safe Legacy provider accounts discovered in the latest worker snapshot. Never includes exchange keys. */
  legacyProviderAccounts: LegacyProviderAccountAdminView[];
  /** Safe active Legacy slot rows from the latest worker snapshot. */
  legacyActiveSlots: LegacyActiveSlotAdminView[];
  /** Safe active Legacy order summary rows from the latest worker snapshot. */
  legacyActiveOrders: LegacyActiveOrderAdminView[];
  /** Filtered integration_health_checks for bot.* targets (last 20 rows). */
  botHealthChecks: HealthCheckView[];
  /** Canonical warning summaries derived from sanitized integration health details. */
  botWarningSummaries: AdminBotWarningSummary[];
}

export interface LegacyProviderAccountAdminView {
  pubId: string;
  mappedUser: LegacyMappedUserAdminView | null;
  market: string;
  running: boolean;
  balance: number | null;
  quarantined: boolean;
  quarantineReason: string | null;
  symbols: number;
  activeSlots: number;
  activeOrders: number;
  latestSnapshotAt: number | null;
}

export interface LegacyMappedUserAdminView {
  providerMappingId: string;
  userId: string;
  botInstanceId: string;
  displayName: string;
  email: string;
  providerLabel: string | null;
  mappedAt: number | null;
}

export interface TortilaFleetSnapshotAdminView {
  botInstanceId: string;
  ownerUser: {
    userId: string;
    displayName: string;
    email: string;
  };
  snapshotAt: number;
  walletEquityUsd: string | null;
  tradeCount: number | null;
  sourceAdapter: string;
  scope: 'bot_instance_owner';
}

export interface LegacyActiveSlotAdminView {
  pubId: string;
  mappedUser: LegacyMappedUserAdminView | null;
  symbol: string;
  signal: string;
  stage: number | null;
  averagingCount: number | null;
  openedAt: number | null;
}

export interface LegacyActiveOrderAdminView {
  pubId: string;
  mappedUser: LegacyMappedUserAdminView | null;
  symbol: string;
  note: string;
  qty: number | null;
  price: number | null;
}

// ---- Admin products overview ----

export interface AdminProductOverviewRow {
  code: string;
  slug: string;
  name: string;
  registryPresent: boolean;
  dbCatalogPresent: boolean;
  availabilityStatus: string;
  availabilityNote: string;
  planCodes: string[];
  entitlementCounts: {
    total: number;
    active: number;
    grace: number;
    pendingPayment: number;
    manualReview: number;
    blocked: number;
  };
}

export interface AdminProductsResult {
  mode: AdminMode;
  checkoutEnabled: boolean;
  totalPlans: number;
  dbPlanCount: number | null;
  products: AdminProductOverviewRow[];
}
