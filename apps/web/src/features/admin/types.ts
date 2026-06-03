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
  /** Filtered integration_health_checks for bot.* targets (last 20 rows). */
  botHealthChecks: HealthCheckView[];
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
