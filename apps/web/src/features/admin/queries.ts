import 'server-only';
/**
 * Admin data loaders (server-only). Uses getServerDb() + @wtc/db repos and direct
 * schema-table SELECTs for tables without dedicated repo functions. Each function
 * returns an honest labelled demo state when DATABASE_URL is unset (null db);
 * in production getServerDb() throws fail-closed before the null branch is reached.
 *
 * SECURITY: these functions are called from admin-only server components that already
 * assert requireUser() + assertAdmin(). They do not repeat the RBAC check — callers own it.
 * adminUsersLoader strips passwordHash via mapToAdminUserView — never returned to any caller.
 */

import { eq, and, like, ne, desc } from 'drizzle-orm';
import { getServerDb } from '@/lib/backend';
import { listUsersWithCreatedAt, listAllTv, recentAuditEvents, listManualReviewItems, summarizeLmsObjectCleanupOperations } from '@wtc/db';
import { schema } from '@wtc/db';
import { botAdapterMode } from '@/lib/server-config';
import { productAvailability } from '@/lib/product-status';
import { ENTITLEMENT_STATUSES, PLANS, PRODUCT_CODES, PRODUCTS } from '@wtc/entitlements';
import { projectHealthDetail } from './health-detail';
import type {
  AdminProductOverviewRow,
  AdminProductsResult,
  AdminUserView,
  SystemHealthSnapshot,
  HealthCheckView,
  TvQueueCounts,
  WebhookHealthSummary,
  AdminSupportState,
  AdminTicketView,
  ManualReviewItemView,
  AdminManualReviewState,
  AdminBotHealthResult,
  LmsObjectCleanupOpsSummary,
} from './types';

/**
 * Render-time allowlist for the manual-review eventSnapshot (defence-in-depth, PG8 / §F-08).
 * The billing webhook only ever writes { id, type, planCode } (api/billing/webhook/route.ts:151),
 * but this projection guarantees that no future code path can surface an unexpected
 * (PII / raw-payload) field in the admin UI. Unknown keys are dropped; the known-safe scalar
 * fields pass through unchanged. Lossless for every current call site.
 */
const SAFE_SNAPSHOT_KEYS = ['id', 'type', 'planCode'] as const;
function pickSafeSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const k of SAFE_SNAPSHOT_KEYS) {
    if (k in snapshot) safe[k] = snapshot[k];
  }
  return safe;
}

const EMPTY_LMS_OBJECT_CLEANUP: LmsObjectCleanupOpsSummary = {
  storageProvider: 's3-r2',
  reason: 'material_create_pending',
  totalPending: 0,
  pendingDue: 0,
  pendingScheduled: 0,
  deadLettered: 0,
  maxAttemptsReached: 0,
  deadLetteredUnacknowledged: 0,
  deadLetteredAcknowledged: 0,
  oldestDeadLetteredAt: null,
  latestDeadLetteredAt: null,
  latestUnacknowledgedDeadLetteredAt: null,
  latestAcknowledgedAt: null,
  latestDeadLetterErrorCode: null,
};

// ---- Admin overview (landing page metrics) ----

export interface AdminOverviewResult {
  mode: 'postgres' | 'demo';
  userCount: number;
  pendingTvCount: number;
  auditCount: number;
}

/**
 * Counts for the /admin landing page. DB-backed via getServerDb(); honest demo state (all zero)
 * when DATABASE_URL is unset — consistent with every other admin loader (the prior page read the
 * stale in-memory tvService, which disagreed with the DB-backed TV queue elsewhere).
 */
export async function loadAdminOverview(): Promise<AdminOverviewResult> {
  const db = getServerDb();
  if (!db) {
    return { mode: 'demo', userCount: 0, pendingTvCount: 0, auditCount: 0 };
  }
  const [users, tvRows, auditRows] = await Promise.all([
    listUsersWithCreatedAt(db),
    listAllTv(db),
    recentAuditEvents(db, 200),
  ]);
  return {
    mode: 'postgres',
    userCount: users.length,
    pendingTvCount: tvRows.filter((r) => r.status === 'pending').length,
    auditCount: auditRows.length,
  };
}

// ---- User list ----

/**
 * Map a DB user row (which includes passwordHash) to a safe AdminUserView.
 * The passwordHash field is intentionally excluded — F-12/F-13 security requirement.
 */
function mapToAdminUserView(u: {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  createdAt?: Date | null;
  failedLoginTotalCount: number;
  lastFailedLoginAt: number | null;
  accountLockedUntil: number | null;
  accountLockoutReviewRequiredAt: number | null;
}): AdminUserView {
  const now = Date.now();
  const isLocked = u.accountLockedUntil !== null && u.accountLockedUntil > now;
  const requiresReview = u.accountLockoutReviewRequiredAt !== null;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    roles: u.roles,
    createdAt: u.createdAt instanceof Date ? u.createdAt.getTime() : null,
    lockout: {
      failedLoginTotalCount: u.failedLoginTotalCount,
      lastFailedLoginAt: u.lastFailedLoginAt,
      accountLockedUntil: u.accountLockedUntil,
      accountLockoutReviewRequiredAt: u.accountLockoutReviewRequiredAt,
      isLocked,
      requiresReview,
      unlockable: isLocked || requiresReview,
    },
  };
}

export interface AdminUsersResult {
  mode: 'postgres' | 'demo';
  users: AdminUserView[];
}

export async function loadAdminUsers(): Promise<AdminUsersResult> {
  const db = getServerDb();
  if (!db) {
    return { mode: 'demo', users: [] };
  }
  // N+1 FIX (F-05): listUsersWithCreatedAt resolves users + roles in 2 flat queries, not N+1.
  // Returns DbUserWithCreatedAt which includes passwordHash — we strip it via mapToAdminUserView.
  const rows = await listUsersWithCreatedAt(db);
  const users = rows.map((u) =>
    mapToAdminUserView({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      roles: u.roles,
      createdAt: new Date(u.createdAt),
      failedLoginTotalCount: u.failedLoginTotalCount,
      lastFailedLoginAt: u.lastFailedLoginAt,
      accountLockedUntil: u.accountLockedUntil,
      accountLockoutReviewRequiredAt: u.accountLockoutReviewRequiredAt,
    }),
  );
  return { mode: 'postgres', users };
}

// ---- System health ----

export async function loadSystemHealth(): Promise<SystemHealthSnapshot> {
  const db = getServerDb();

  const liveControlDisabled = true; // policy: live bot start/stop is always DISABLED
  const tvAutomationDisabled = true; // policy: TV automation is always DISABLED (manual-first)
  const workerStaleAfterMs = 3 * 60 * 1000;

  if (!db) {
    return {
      mode: 'demo',
      dbStatus: 'not_configured',
      liveControlDisabled,
      tvAutomationDisabled,
      workerHealth: { status: null, latestAt: null, stale: false, detail: null },
      webhookHealth: { totalReceived: 0, latestAt: null },
      tvQueueCounts: { pending: 0, granted: 0, expired: 0, revoked: 0 },
      lmsObjectCleanup: EMPTY_LMS_OBJECT_CLEANUP,
      healthChecks: [],
    };
  }

  // Webhook health: filter recentAuditEvents to billing.webhook_received
  // recentAuditEvents returns the DB rows from @wtc/db; we use getServerDb().
  const auditRows = await recentAuditEvents(db, 200);
  const webhookRows = auditRows.filter((r) => r.action === 'billing.webhook_received');
  const webhookHealth: WebhookHealthSummary = {
    totalReceived: webhookRows.length,
    latestAt: webhookRows.length > 0 ? Math.max(...webhookRows.map((r) => r.ts.getTime())) : null,
  };

  // TV queue counts from tradingview_access_requests (via listAllTv)
  const tvRows = await listAllTv(db);
  const tvQueueCounts: TvQueueCounts = {
    pending: tvRows.filter((r) => r.status === 'pending').length,
    granted: tvRows.filter((r) => r.status === 'granted' || r.status === 'expiring_soon').length,
    expired: tvRows.filter((r) => r.status === 'expired').length,
    revoked: tvRows.filter((r) => r.status === 'revoked').length,
  };

  const [workerHealthRow] = await db
    .select()
    .from(schema.integrationHealthChecks)
    .where(eq(schema.integrationHealthChecks.target, 'worker'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  // Integration health checks — read-only SELECT on integration_health_checks schema table.
  // No dedicated repo function exists; this is a direct Drizzle read inside a features/ loader
  // (per the task spec: "read integration_health_checks via a read-only SELECT in features/admin
  // using getServerDb() + the exported schema table — do NOT edit repositories.ts").
  const healthCheckRows = await db
    .select()
    .from(schema.integrationHealthChecks)
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(50);

  const healthChecks: HealthCheckView[] = healthCheckRows.map((r) => ({
    id: r.id,
    target: r.target,
    status: r.status,
    detail: projectHealthDetail(r.detail),
    checkedAt: r.checkedAt.getTime(),
  }));

  const lmsCleanup = await summarizeLmsObjectCleanupOperations(db);
  const lmsObjectCleanup: LmsObjectCleanupOpsSummary = {
    storageProvider: lmsCleanup.storageProvider,
    reason: lmsCleanup.reason,
    totalPending: lmsCleanup.totalPending,
    pendingDue: lmsCleanup.pendingDue,
    pendingScheduled: lmsCleanup.pendingScheduled,
    deadLettered: lmsCleanup.deadLettered,
    maxAttemptsReached: lmsCleanup.maxAttemptsReached,
    deadLetteredUnacknowledged: lmsCleanup.deadLetteredUnacknowledged,
    deadLetteredAcknowledged: lmsCleanup.deadLetteredAcknowledged,
    oldestDeadLetteredAt: lmsCleanup.oldestDeadLetteredAt?.getTime() ?? null,
    latestDeadLetteredAt: lmsCleanup.latestDeadLetteredAt?.getTime() ?? null,
    latestUnacknowledgedDeadLetteredAt: lmsCleanup.latestUnacknowledgedDeadLetteredAt?.getTime() ?? null,
    latestAcknowledgedAt: lmsCleanup.latestAcknowledgedAt?.getTime() ?? null,
    latestDeadLetterErrorCode: lmsCleanup.latestDeadLetterErrorCode,
  };

  return {
    mode: 'postgres',
    dbStatus: 'postgres',
    liveControlDisabled,
    tvAutomationDisabled,
    workerHealth: workerHealthRow
      ? {
          status: workerHealthRow.status,
          latestAt: workerHealthRow.checkedAt.getTime(),
          stale: Date.now() - workerHealthRow.checkedAt.getTime() > workerStaleAfterMs,
          detail: projectHealthDetail(workerHealthRow.detail),
        }
      : { status: null, latestAt: null, stale: false, detail: null },
    webhookHealth,
    tvQueueCounts,
    lmsObjectCleanup,
    healthChecks,
  };
}

// ---- Support tickets (admin triage view) ----

export async function loadAdminSupport(opts?: { status?: string }): Promise<AdminSupportState> {
  const db = getServerDb();
  if (!db) {
    return { mode: 'demo', tickets: [] };
  }

  // Direct read via schema table — listSupportTickets supports status filter already in @wtc/db.
  // We import from @wtc/db to call the existing repo function which handles the WHERE clause.
  const { listSupportTickets } = await import('@wtc/db');
  const rows = await listSupportTickets(db, { status: opts?.status });

  const tickets: AdminTicketView[] = rows.map((t) => ({
    id: t.id,
    subject: t.subject,
    body: t.body,
    status: t.status,
    priority: t.priority,
    productCode: t.productCode,
    userId: t.userId,
    assignedTo: t.assignedTo ?? null,
    createdAt: t.createdAt.getTime(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.getTime() : null,
  }));

  return { mode: 'postgres', tickets };
}

// ---- Billing manual review queue ----

/**
 * Load pending (or all) billing_manual_review_items for the admin review queue.
 * eventSnapshot is returned as-is from the DB — callers must not render raw/PII fields.
 * SECURITY: Only non-secret event fields are written to eventSnapshot at creation time.
 */
export async function loadManualReviewItems(
  opts?: { status?: 'pending' | 'approved' | 'rejected' | 'dismissed' },
): Promise<AdminManualReviewState> {
  const db = getServerDb();
  if (!db) {
    return { mode: 'demo', items: [] };
  }
  const rows = await listManualReviewItems(db, { status: opts?.status ?? 'pending', limit: 100 });
  const items: ManualReviewItemView[] = rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    eventId: r.eventId,
    eventType: r.eventType,
    status: r.status,
    userId: r.userId ?? null,
    reason: r.reason,
    eventSnapshot: pickSafeSnapshot(r.eventSnapshot as Record<string, unknown>),
    createdAt: r.createdAt.getTime(),
    resolvedBy: r.resolvedBy ?? null,
    resolvedAt: r.resolvedAt ? r.resolvedAt.getTime() : null,
    resolutionNote: r.resolutionNote ?? null,
  }));
  return { mode: 'postgres', items };
}

// ---- Admin bot health ----

/**
 * Load cross-user bot health data for the /admin/bots page.
 * Reads integration_health_checks for bot.* targets + bot_metric_snapshots latest row.
 * Never exposes exchange keys, URLs (only boolean presence), stack traces.
 * liveControlDisabled and legacyAdapterBlocked are always hardcoded true (safety policy).
 */
export async function loadAdminBotHealth(): Promise<AdminBotHealthResult> {
  const adapterMode = botAdapterMode();
  const tortilaBaseUrlConfigured = !!(process.env.TORTILA_JOURNAL_URL || process.env.TORTILA_JOURNAL_BASE_URL);
  const db = getServerDb();

  const base = {
    adapterMode,
    liveControlDisabled: true as const,
    legacyAdapterBlocked: true as const,
    tortilaBaseUrlConfigured,
  };

  if (!db) {
    return {
      ...base,
      mode: 'demo',
      tortilaLastOkAt: null,
      tortilaLastError: null,
      tortilaJournalStatus: null,
      tortilaJournalReadState: null,
      tortilaJournalReadStateDetail: null,
      latestSnapshot: null,
      botHealthChecks: [],
    };
  }

  // Last successful health check for tortila-journal
  const [lastOk] = await db
    .select({ id: schema.integrationHealthChecks.id, checkedAt: schema.integrationHealthChecks.checkedAt })
    .from(schema.integrationHealthChecks)
    .where(and(eq(schema.integrationHealthChecks.target, 'tortila-journal'), eq(schema.integrationHealthChecks.status, 'ok')))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(1);

  // Latest non-ok health row for tortila-journal. not_configured is a setup state, not an error.
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

  const latestJournalDetail = latestJournal?.detail as Record<string, unknown> | null | undefined;
  const latestReadState =
    typeof latestJournalDetail?.readState === 'string' ? latestJournalDetail.readState : null;
  const latestReadStateDetail =
    typeof latestJournalDetail?.readStateDetail === 'string'
      ? latestJournalDetail.readStateDetail.slice(0, 200)
      : null;

  const tortilaLastError = lastErr
    ? (() => {
        if (lastErr.status === 'not_configured' || lastErr.status === 'stale') return null;
        const d = lastErr.detail as Record<string, unknown> | null;
        const msg = d?.error ?? d?.message ?? null;
        return msg ? String(msg).slice(0, 200) : 'error (no detail)';
      })()
    : null;

  // Latest bot metric snapshot
  const [snap] = await db
    .select({
      snapshotAt: schema.botMetricSnapshots.snapshotAt,
      walletEquityUsd: schema.botMetricSnapshots.walletEquityUsd,
      sourceAdapter: schema.botMetricSnapshots.sourceAdapter,
    })
    .from(schema.botMetricSnapshots)
    .orderBy(desc(schema.botMetricSnapshots.snapshotAt))
    .limit(1);

  // All bot.* health checks (last 20)
  const botHealthCheckRows = await db
    .select()
    .from(schema.integrationHealthChecks)
    .where(like(schema.integrationHealthChecks.target, 'bot.%'))
    .orderBy(desc(schema.integrationHealthChecks.checkedAt))
    .limit(20);

  const botHealthChecks: HealthCheckView[] = botHealthCheckRows.map((r) => ({
    id: r.id,
    target: r.target,
    status: r.status,
    detail: r.detail as Record<string, unknown> | null,
    checkedAt: r.checkedAt.getTime(),
  }));

  return {
    ...base,
    mode: 'postgres',
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
    botHealthChecks,
  };
}

// ---- Admin products overview ----

const nonGrantingStatuses = ENTITLEMENT_STATUSES.filter((s) => s !== 'active' && s !== 'grace');

function registryPlanCodesFor(productCode: string): string[] {
  return Object.values(PLANS)
    .filter((p) => p.products.some((code) => code === productCode))
    .map((p) => p.code);
}

function entitlementCounts(rows: { productCode: string; status: string }[], productCode: string): AdminProductOverviewRow['entitlementCounts'] {
  const mine = rows.filter((r) => r.productCode === productCode);
  const count = (status: string) => mine.filter((r) => r.status === status).length;
  return {
    total: mine.length,
    active: count('active'),
    grace: count('grace'),
    pendingPayment: count('pending_payment'),
    manualReview: count('manual_review'),
    blocked: mine.filter((r) => nonGrantingStatuses.some((status) => status === r.status)).length,
  };
}

/**
 * Product/admin overview. Registry is code-defined; DB rows are best-effort truth when Postgres is
 * configured. Demo mode never fabricates catalog/entitlement rows, but still renders the registry.
 */
export async function loadAdminProducts(): Promise<AdminProductsResult> {
  const db = getServerDb();
  const checkoutEnabled = process.env.BILLING_CHECKOUT_ENABLED === 'true';
  const dbProducts = db ? await db.select().from(schema.products) : [];
  const dbPlans = db ? await db.select().from(schema.plans) : [];
  const entRows = db
    ? await db.select({ productCode: schema.entitlements.productCode, status: schema.entitlements.status }).from(schema.entitlements)
    : [];
  const dbProductCodes = new Set(dbProducts.map((p) => p.code));

  const products: AdminProductOverviewRow[] = PRODUCT_CODES.map((code) => {
    const av = productAvailability(code);
    const product = PRODUCTS[code];
    return {
      code,
      slug: product.slug,
      name: product.name,
      registryPresent: true,
      dbCatalogPresent: dbProductCodes.has(code),
      availabilityStatus: av.status,
      availabilityNote: av.note,
      planCodes: registryPlanCodesFor(code),
      entitlementCounts: entitlementCounts(entRows, code),
    };
  });

  return {
    mode: db ? 'postgres' : 'demo',
    checkoutEnabled,
    totalPlans: Object.keys(PLANS).length,
    dbPlanCount: db ? dbPlans.length : null,
    products,
  };
}
