/**
 * @wtc/db — Drizzle (Postgres) schema. Implements the core bounded contexts from docs/DATA_MODEL.md
 * (identity, products/entitlements, secrets, bots, axioma, tradingview, education, ops). This file
 * covers the tables exercised by the MVP app; DATA_MODEL.md is the full 26-table reference.
 *
 * SECURITY: exchange_api_key_secrets has NO plaintext column — only the sealed vault record.
 */
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, uniqueIndex, index, numeric, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const id = () => uuid('id').defaultRandom().primaryKey();
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

// --- Identity ---
export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(), // Argon2id PHC string
    displayName: text('display_name'),
    failedLogin15mCount: integer('failed_login_15m_count').default(0).notNull(),
    failedLogin15mResetAt: timestamp('failed_login_15m_reset_at', { withTimezone: true }),
    failedLogin60mCount: integer('failed_login_60m_count').default(0).notNull(),
    failedLogin60mResetAt: timestamp('failed_login_60m_reset_at', { withTimezone: true }),
    failedLoginTotalCount: integer('failed_login_total_count').default(0).notNull(),
    lastFailedLoginAt: timestamp('last_failed_login_at', { withTimezone: true }),
    accountLockedUntil: timestamp('account_locked_until', { withTimezone: true }),
    accountLockoutReviewRequiredAt: timestamp('account_lockout_review_required_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({ emailIdx: uniqueIndex('users_email_idx').on(t.email) }),
);

export const roles = pgTable('roles', {
  code: text('code').primaryKey(), // 'user' | 'teacher' | 'admin' | 'support'
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleCode: text('role_code').notNull().references(() => roles.code),
  },
  (t) => ({ pk: uniqueIndex('user_roles_pk').on(t.userId, t.roleCode) }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(), // SHA-256(token); raw token only in the cookie
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revoked: boolean('revoked').default(false).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({ tokenIdx: uniqueIndex('sessions_token_idx').on(t.tokenHash), userIdx: index('sessions_user_idx').on(t.userId) }),
);

// --- Products / entitlements ---
export const products = pgTable('products', {
  code: text('code').primaryKey(), // ProductCode
  slug: text('slug').notNull(),
  name: text('name').notNull(),
});

export const plans = pgTable('plans', {
  code: text('code').primaryKey(), // PlanCode
  name: text('name').notNull(),
  billing: text('billing').notNull(), // one_time | monthly | yearly | manual
  kind: text('kind').notNull(), // single | bundle
  products: jsonb('products').$type<string[]>().notNull(),
});

export const entitlements = pgTable(
  'entitlements',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(),
    status: text('status').notNull(), // EntitlementStatus
    source: text('source').notNull(), // subscription | one_time | manual_grant | bundle
    planCode: text('plan_code'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    graceUntil: timestamp('grace_until', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    manualOverride: boolean('manual_override').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  // UNIQUE: at most one entitlement row per (user, product). Prevents duplicate grants accumulating
  // and lets grantProduct/seed rely on conflict detection. Enforced in Postgres, not just app logic.
  (t) => ({ userProductIdx: uniqueIndex('entitlements_user_product_idx').on(t.userId, t.productCode) }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    planCode: text('plan_code').notNull(),
    provider: text('provider').notNull(), // mock | stripe | crypto
    providerRef: text('provider_ref'),
    status: text('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: createdAt(),
  },
  // Migration 0003: UNIQUE(user_id, provider, provider_ref) index for safe upsert.
  // provider_ref is nullable; Postgres treats NULLs as distinct in a plain uniqueIndex
  // (no partial WHERE clause needed — multiple NULL provider_ref rows are permitted).
  (t) => ({
    uniqUserProviderRef: uniqueIndex('subscriptions_user_provider_ref_idx').on(t.userId, t.provider, t.providerRef),
  }),
);

// --- Secrets (ciphertext only) ---
export const exchangeAccounts = pgTable('exchange_accounts', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exchange: text('exchange').notNull(),
  label: text('label').notNull(),
  mode: text('mode').notNull(), // demo | live
  keyMask: text('key_mask').notNull(), // e.g. ••••1234 (non-secret hint)
  createdAt: createdAt(),
});

export const exchangeApiKeySecrets = pgTable('exchange_api_key_secrets', {
  id: id(),
  exchangeAccountId: uuid('exchange_account_id').notNull().references(() => exchangeAccounts.id, { onDelete: 'cascade' }),
  // sealed vault record { v, keyId, wrappedDek, payload, aad } — NEVER plaintext
  sealed: jsonb('sealed').$type<Record<string, unknown>>().notNull(),
  keyId: text('key_id').notNull(), // KEK id used (for rotation)
  createdAt: createdAt(),
});

// --- Bots ---
export const botInstances = pgTable(
  'bot_instances',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(), // tortila_bot | legacy_bot
    exchangeAccountId: uuid('exchange_account_id').references(() => exchangeAccounts.id),
    accountId: text('account_id'), // NULL = legacy aggregate bucket; else api_keys.pub_id
    createdAt: createdAt(),
  },
  (t) => ({
    // Postgres treats NULLs as distinct in a plain unique index → two partial indexes.
    uniqUserProductAccount: uniqueIndex('bi_user_product_account_idx')
      .on(t.userId, t.productCode, t.accountId)
      .where(sql`"account_id" IS NOT NULL`),
    uniqUserProductDefault: uniqueIndex('bi_user_product_default_idx')
      .on(t.userId, t.productCode)
      .where(sql`"account_id" IS NULL`),
  }),
);

export const botProviderAccounts = pgTable(
  'bot_provider_accounts',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(), // legacy_bot today; future bots can reuse the primitive.
    provider: text('provider').notNull(), // legacy-db | tortila-journal | other audited providers
    providerAccountId: text('provider_account_id').notNull(), // Legacy Api_Key.pub_id
    label: text('label'),
    status: text('status').notNull().default('active'), // active | disabled | needs_review
    createdBy: uuid('created_by').references(() => users.id),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userProductIdx: index('bpa_user_product_idx').on(t.userId, t.productCode),
    instanceProviderIdx: index('bpa_instance_provider_idx').on(t.botInstanceId, t.provider),
    uniqInstanceProviderAccount: uniqueIndex('bpa_instance_provider_account_idx').on(t.botInstanceId, t.provider, t.providerAccountId),
    uniqActiveInstanceProvider: uniqueIndex('bpa_active_instance_provider_idx')
      .on(t.botInstanceId, t.provider)
      .where(sql`"status" = 'active'`),
    uniqActiveProviderAccount: uniqueIndex('bpa_active_provider_account_idx')
      .on(t.productCode, t.provider, t.providerAccountId)
      .where(sql`"status" = 'active'`),
    statusCheck: check('bot_provider_accounts_status_check', sql`${t.status} IN ('active', 'disabled', 'needs_review')`),
    providerAccountIdCheck: check('bot_provider_accounts_provider_account_id_check', sql`length(trim(${t.providerAccountId})) > 0`),
  }),
);

export const botConfigs = pgTable('bot_configs', {
  id: id(),
  botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const botGlobalConfigs = pgTable(
  'bot_global_configs',
  {
    id: id(),
    productCode: text('product_code').notNull(),
    profileCode: text('profile_code').notNull().default('system_default'),
    label: text('label').notNull(),
    status: text('status').notNull().default('draft'), // draft | published | archived
    appliesToNewUsers: boolean('applies_to_new_users').default(true).notNull(),
    allowUserOverride: boolean('allow_user_override').default(true).notNull(),
    version: integer('version').notNull().default(1),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id), // nullable = system seed/import; no cascade
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqProductProfile: uniqueIndex('bgc_product_profile_idx').on(t.productCode, t.profileCode),
    productStatusIdx: index('bgc_product_status_idx').on(t.productCode, t.status),
    activeDefaultIdx: uniqueIndex('bgc_active_default_idx')
      .on(t.productCode)
      .where(sql`"status" = 'published' AND "applies_to_new_users" = true`),
    productCheck: check('bot_global_configs_product_check', sql`${t.productCode} IN ('tortila_bot', 'legacy_bot')`),
    statusCheck: check('bot_global_configs_status_check', sql`${t.status} IN ('draft', 'published', 'archived')`),
    profileCodeCheck: check('bot_global_configs_profile_code_check', sql`length(trim(${t.profileCode})) > 0`),
    labelCheck: check('bot_global_configs_label_check', sql`length(trim(${t.label})) > 0`),
  }),
);

// --- Axioma ---
export const axiomaAccountLinks = pgTable(
  'axioma_account_links',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    state: text('state').notNull(), // pending | linked | revoked | expired | error | not_linked
    axiomaUserId: text('axioma_user_id'),
    oneTimeCode: text('one_time_code'), // legacy nullable column; current code must never write raw OTC
    linkNonceHash: text('link_nonce_hash'),
    codeExpiresAt: timestamp('code_expires_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    linkNonceHashIdx: uniqueIndex('aal_link_nonce_hash_idx').on(t.linkNonceHash).where(sql`"link_nonce_hash" IS NOT NULL`),
    activeUserIdx: uniqueIndex('aal_active_user_idx').on(t.userId).where(sql`"state" = 'linked' AND "revoked_at" IS NULL`),
    activeAxiomaUserIdx: uniqueIndex('aal_active_axioma_user_idx').on(t.axiomaUserId).where(sql`"state" = 'linked' AND "revoked_at" IS NULL AND "axioma_user_id" IS NOT NULL`),
    userStateIdx: index('aal_user_state_idx').on(t.userId, t.state),
    expiresAtIdx: index('aal_code_expires_at_idx').on(t.codeExpiresAt),
  }),
);

// --- TradingView ---
export const tradingviewAccessRequests = pgTable('tradingview_access_requests', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tradingViewUsername: text('tradingview_username').notNull(),
  status: text('status').notNull(), // pending | granted | expiring_soon | expired | revoked
  requestedAt: createdAt(), // DB column is created_at; TS name stays requestedAt
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  grantedBy: uuid('granted_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  // 0002 (additive, nullable): real revoke actor/time on the request row (was audit-only before)
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),
});

export const tradingviewAccessTasks = pgTable(
  'tradingview_access_tasks',
  {
    id: id(),
    requestId: uuid('request_id').notNull().references(() => tradingviewAccessRequests.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'revoke'
    createdAt: createdAt(),
    done: boolean('done').default(false).notNull(),
  },
  (t) => ({ uniqRequestKind: uniqueIndex('tvat_request_kind_idx').on(t.requestId, t.kind) }),
);

// --- Education ---
export const courses = pgTable(
  'courses',
  {
    id: id(),
    ownerTeacherId: uuid('owner_teacher_id').notNull().references(() => users.id),
    // 0002 (additive): nullable FK; backfilled from owner_teacher_id in the migration SQL.
    // owner_teacher_id is intentionally NOT dropped here (additive-only) — drop is a Phase-3 cleanup.
    teacherProfileId: uuid('teacher_profile_id').references(() => teacherProfiles.id),
    title: text('title').notNull(),
    description: text('description'),
    productCode: text('product_code').notNull().default('education'),
    published: boolean('published').default(false).notNull(),
    createdAt: createdAt(),
    // 0005 (Phase 3.1, additive): rich course metadata. DISPLAY/WRITE only — no tag-filter query
    // (PGlite does not implement array operators; tag filtering stays in app code until real-PG).
    level: text('level').notNull().default('beginner'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
  },
  // CHECK is defence-in-depth; the Zod enum in the action layer is the primary boundary.
  (t) => ({ levelCheck: check('courses_level_check', sql`${t.level} IN ('beginner', 'intermediate', 'advanced')`) }),
);

export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    videoUrl: text('video_url'),
    order: integer('order').notNull().default(0),
    published: boolean('published').default(false).notNull(),
    // 0005 (Phase 3.1, additive): content_type backfilled in the migration SQL from video_url
    // (video_url present → 'video', else 'article'). external_url is the companion for 'link' lessons.
    // 'embed' is a future-valid CHECK value but NO write/render path exists this session (needs a
    // server-side HTML sanitizer first — stored-XSS gate; see EDUCATION_LMS_PLAN.md §9.2).
    contentType: text('content_type').notNull().default('video'),
    externalUrl: text('external_url'),
    embedHtml: text('embed_html'),
  },
  (t) => ({
    contentTypeCheck: check('lessons_content_type_check', sql`${t.contentType} IN ('video', 'embed', 'article', 'link')`),
    embedHtmlPayloadCheck: check('lessons_embed_html_payload_check', sql`((${t.contentType} = 'embed' AND ${t.embedHtml} IS NOT NULL) OR (${t.contentType} <> 'embed' AND ${t.embedHtml} IS NULL))`),
  }),
);

export const materials = pgTable(
  'materials',
  {
    id: id(),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    url: text('url'),
    kind: text('kind').notNull().default('link'),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    contentSha256: text('content_sha256'),
    fileBytesBase64: text('file_bytes_base64'),
    storageProvider: text('storage_provider'),
    storageKey: text('storage_key'),
    scanStatus: text('scan_status').notNull().default('not_required'),
    scanCheckedAt: timestamp('scan_checked_at', { withTimezone: true }),
    quarantineReason: text('quarantine_reason'),
    retainedUntil: timestamp('retained_until', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    embedHtml: text('embed_html'),
  },
  (t) => ({
    lessonKindIdx: index('materials_lesson_kind_idx').on(t.lessonId, t.kind),
    scanStatusIdx: index('materials_scan_status_idx').on(t.scanStatus),
    retainedUntilIdx: index('materials_retained_until_idx').on(t.retainedUntil),
    deletedAtIdx: index('materials_deleted_at_idx').on(t.deletedAt),
    kindCheck: check('materials_kind_check', sql`${t.kind} IN ('link', 'file', 'embed')`),
    scanStatusCheck: check('materials_scan_status_check', sql`${t.scanStatus} IN ('pending', 'clean', 'quarantined', 'failed', 'not_required')`),
    fileLifecycleCheck: check(
      'materials_file_lifecycle_check',
      sql`(
        (${t.kind} = 'file' AND ${t.storageProvider} IS NOT NULL AND ${t.storageKey} IS NOT NULL AND ${t.scanStatus} IN ('pending', 'clean', 'quarantined', 'failed') AND ${t.retainedUntil} IS NOT NULL)
        OR
        (${t.kind} <> 'file' AND ${t.storageProvider} IS NULL AND ${t.storageKey} IS NULL AND ${t.scanStatus} = 'not_required' AND ${t.scanCheckedAt} IS NULL AND ${t.quarantineReason} IS NULL AND ${t.retainedUntil} IS NULL)
      )`,
    ),
    payloadCheck: check(
      'materials_payload_check',
      sql`(
        (${t.kind} = 'link' AND ${t.url} IS NOT NULL AND ${t.fileName} IS NULL AND ${t.mimeType} IS NULL AND ${t.sizeBytes} IS NULL AND ${t.contentSha256} IS NULL AND ${t.fileBytesBase64} IS NULL AND ${t.embedHtml} IS NULL)
        OR
        (${t.kind} = 'file' AND ${t.url} IS NULL AND ${t.fileName} IS NOT NULL AND ${t.mimeType} IS NOT NULL AND ${t.sizeBytes} IS NOT NULL AND ${t.sizeBytes} > 0 AND ${t.contentSha256} IS NOT NULL AND ${t.embedHtml} IS NULL AND (
          (${t.storageProvider} = 'db-local' AND ${t.fileBytesBase64} IS NOT NULL)
          OR
          (${t.storageProvider} <> 'db-local' AND ${t.fileBytesBase64} IS NULL)
        ))
        OR
        (${t.kind} = 'embed' AND ${t.url} IS NULL AND ${t.fileName} IS NULL AND ${t.mimeType} IS NULL AND ${t.sizeBytes} IS NULL AND ${t.contentSha256} IS NULL AND ${t.fileBytesBase64} IS NULL AND ${t.embedHtml} IS NOT NULL)
      )`,
    ),
  }),
);

export const lmsObjectCleanupTasks = pgTable(
  'lms_object_cleanup_tasks',
  {
    id: id(),
    storageProvider: text('storage_provider').notNull(),
    storageKey: text('storage_key').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(10).notNull(),
    runAfter: timestamp('run_after', { withTimezone: true }).defaultNow().notNull(),
    lastErrorCode: text('last_error_code'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    pendingRunIdx: index('lms_object_cleanup_tasks_pending_run_idx').on(t.status, t.runAfter),
    deadLetterAckIdx: index('lms_object_cleanup_tasks_dead_letter_ack_idx').on(t.status, t.acknowledgedAt),
    storageKeyIdx: index('lms_object_cleanup_tasks_storage_key_idx').on(t.storageKey),
    providerCheck: check('lms_object_cleanup_tasks_provider_check', sql`${t.storageProvider} IN ('s3-r2')`),
    reasonCheck: check('lms_object_cleanup_tasks_reason_check', sql`${t.reason} IN ('material_create_pending')`),
    statusCheck: check('lms_object_cleanup_tasks_status_check', sql`${t.status} IN ('pending', 'completed', 'dead_letter')`),
  }),
);

// --- Ops ---
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
    actorUserId: uuid('actor_user_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    result: text('result').notNull().default('success'),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actorUserId),
    actionIdx: index('audit_action_idx').on(t.action),
    // Migration 0003 (F-06): composite index improves the webhook idempotency SELECT on (action, target_id).
    actionTargetIdx: index('audit_action_target_idx').on(t.action, t.targetId),
  }),
);

// RESERVED — NOT YET CONSUMED. This table is scaffolding for a future durable job queue
// (SELECT ... FOR UPDATE SKIP LOCKED). The worker today uses direct cron-style calls
// (reconcileAllEntitlements / sweepTvExpiry / recordHealthCheck) and the tradingview_access_tasks
// table; no code enqueues or dequeues job_queue rows yet. See docs/IMPLEMENTED_FILES.md. Do not
// present this as a working queue until a consumer + tests land (Phase 1.5+).
export const jobQueue = pgTable(
  'job_queue',
  {
    id: id(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    doneAt: timestamp('done_at', { withTimezone: true }),
    attempts: integer('attempts').default(0).notNull(),
  },
  (t) => ({ runIdx: index('job_queue_run_idx').on(t.runAt) }),
);

export const integrationHealthChecks = pgTable('integration_health_checks', {
  id: id(),
  target: text('target').notNull(),
  status: text('status').notNull(),
  detail: jsonb('detail'),
  checkedAt: createdAt(),
});

// ============================================================================
// Migration 0002 — additive ecosystem expansion (Phase 2.1). 18 new tables.
// Source of truth: docs/handoffs/20260530-0925-ecosystem-db-architect.md.
// Conventions match 0000/0001: uuid PK gen_random_uuid(), timestamptz UTC,
// numeric for money/price, FK onDelete cascade where child is meaningless
// without parent, no cascade where an audit/history row must survive.
// ============================================================================

// --- Bots (5): config history + worker-written metric/position/trade snapshots + safety log ---

// Append-only history of every saved bot config. NB: existing bot_configs columns are
// `version`/`config`; this history table uses `config_json` (different table — never renamed).
export const botConfigVersions = pgTable(
  'bot_config_versions',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    configJson: jsonb('config_json').$type<Record<string, unknown>>().notNull(),
    changedBy: uuid('changed_by').references(() => users.id), // nullable = system; no cascade (keep history)
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => ({
    uniqInstanceVersion: uniqueIndex('bcv_instance_version_idx').on(t.botInstanceId, t.version),
    instanceVersionIdx: index('bcv_instance_id_idx').on(t.botInstanceId, t.version),
  }),
);

export const botGlobalConfigVersions = pgTable(
  'bot_global_config_versions',
  {
    id: id(),
    globalConfigId: uuid('global_config_id').notNull().references(() => botGlobalConfigs.id),
    productCode: text('product_code').notNull(),
    profileCode: text('profile_code').notNull(),
    version: integer('version').notNull(),
    label: text('label').notNull(),
    status: text('status').notNull(),
    appliesToNewUsers: boolean('applies_to_new_users').default(true).notNull(),
    allowUserOverride: boolean('allow_user_override').default(true).notNull(),
    configJson: jsonb('config_json').$type<Record<string, unknown>>().notNull(),
    changedBy: uuid('changed_by').references(() => users.id), // nullable = system seed/import; no cascade
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => ({
    uniqGlobalConfigVersion: uniqueIndex('bgcv_global_config_version_idx').on(t.globalConfigId, t.version),
    productProfileVersionIdx: index('bgcv_product_profile_version_idx').on(t.productCode, t.profileCode, t.version),
    productCheck: check('bot_global_config_versions_product_check', sql`${t.productCode} IN ('tortila_bot', 'legacy_bot')`),
    statusCheck: check('bot_global_config_versions_status_check', sql`${t.status} IN ('draft', 'published', 'archived')`),
    profileCodeCheck: check('bot_global_config_versions_profile_code_check', sql`length(trim(${t.profileCode})) > 0`),
    labelCheck: check('bot_global_config_versions_label_check', sql`length(trim(${t.label})) > 0`),
  }),
);

// Periodic normalised metrics snapshot per bot instance. Worker writes; never updated.
export const botMetricSnapshots = pgTable(
  'bot_metric_snapshots',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    botProviderAccountId: uuid('bot_provider_account_id').references(() => botProviderAccounts.id, { onDelete: 'set null' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    walletEquityUsd: numeric('wallet_equity_usd', { precision: 18, scale: 4 }),
    closedPnlUsd: numeric('closed_pnl_usd', { precision: 18, scale: 4 }),
    unrealizedPnlUsd: numeric('unrealized_pnl_usd', { precision: 18, scale: 4 }),
    winRate: numeric('win_rate', { precision: 6, scale: 4 }),
    profitFactor: numeric('profit_factor', { precision: 8, scale: 4 }),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 8, scale: 4 }),
    currentDrawdownPct: numeric('current_drawdown_pct', { precision: 8, scale: 4 }),
    totalFeesUsd: numeric('total_fees_usd', { precision: 18, scale: 4 }),
    totalFundingUsd: numeric('total_funding_usd', { precision: 18, scale: 4 }),
    openRiskUsd: numeric('open_risk_usd', { precision: 18, scale: 4 }),
    tradeCount: integer('trade_count'),
    sourceAdapter: text('source_adapter').notNull(), // tortila | legacy
    rawJson: jsonb('raw_json'),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceSnapshotIdx: index('bms_instance_snapshot_idx').on(t.botInstanceId, t.snapshotAt),
    providerSnapshotIdx: index('bms_provider_snapshot_idx').on(t.botProviderAccountId, t.snapshotAt),
  }),
);

// Point-in-time open position snapshot. Worker writes; never updated.
export const botPositionSnapshots = pgTable(
  'bot_position_snapshots',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    botProviderAccountId: uuid('bot_provider_account_id').references(() => botProviderAccounts.id, { onDelete: 'set null' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(), // long | short
    size: numeric('size', { precision: 20, scale: 8 }).notNull(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    markPrice: numeric('mark_price', { precision: 20, scale: 8 }),
    unrealizedPnlUsd: numeric('unrealized_pnl_usd', { precision: 18, scale: 4 }),
    leverage: integer('leverage'),
    tpPrice: numeric('tp_price', { precision: 20, scale: 8 }),
    slPrice: numeric('sl_price', { precision: 20, scale: 8 }),
    liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    sourceAdapter: text('source_adapter').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceSnapshotIdx: index('bps_instance_snapshot_idx').on(t.botInstanceId, t.snapshotAt),
    providerSnapshotIdx: index('bps_provider_snapshot_idx').on(t.botProviderAccountId, t.snapshotAt),
  }),
);

// Imported closed trades. Immutable. Unique set prevents duplicate imports (idempotency).
export const botTradeImports = pgTable(
  'bot_trade_imports',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    botProviderAccountId: uuid('bot_provider_account_id').references(() => botProviderAccounts.id, { onDelete: 'set null' }),
    externalTradeId: text('external_trade_id').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 20, scale: 8 }).notNull(),
    size: numeric('size', { precision: 20, scale: 8 }).notNull(),
    realizedPnlUsd: numeric('realized_pnl_usd', { precision: 18, scale: 4 }).notNull(),
    feesUsd: numeric('fees_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    fundingPaidUsd: numeric('funding_paid_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
    exitReason: text('exit_reason'), // tp | sl | manual | liquidation | unknown
    sourceAdapter: text('source_adapter').notNull(),
    rawJson: jsonb('raw_json'),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqExternalTradeUnscoped: uniqueIndex('bti_external_trade_unscoped_idx')
      .on(t.botInstanceId, t.externalTradeId, t.sourceAdapter)
      .where(sql`"bot_provider_account_id" IS NULL`),
    uniqExternalTradeProvider: uniqueIndex('bti_provider_external_trade_idx')
      .on(t.botInstanceId, t.botProviderAccountId, t.externalTradeId, t.sourceAdapter)
      .where(sql`"bot_provider_account_id" IS NOT NULL`),
    instanceClosedIdx: index('bti_instance_closed_idx').on(t.botInstanceId, t.closedAt),
    providerClosedIdx: index('bti_provider_closed_idx').on(t.botProviderAccountId, t.closedAt),
    externalIdIdx: index('bti_external_id_idx').on(t.sourceAdapter, t.externalTradeId),
  }),
);

// WTC-owned trade journal/review layer. This is deliberately separate from immutable imported
// trades: adapter data stays append-only, while user annotations can be edited and audited.
export const botTradeReviews = pgTable(
  'bot_trade_reviews',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    externalTradeId: text('external_trade_id').notNull(),
    sourceAdapter: text('source_adapter').notNull(),
    reviewStatus: text('review_status').notNull().default('unreviewed'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    setup: text('setup'),
    mistake: text('mistake'),
    notes: text('notes'),
    rMultiple: numeric('r_multiple', { precision: 10, scale: 4 }),
    maePct: numeric('mae_pct', { precision: 8, scale: 4 }),
    mfePct: numeric('mfe_pct', { precision: 8, scale: 4 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqTradeReview: uniqueIndex('btr_trade_review_idx').on(t.botInstanceId, t.externalTradeId, t.sourceAdapter),
    instanceUpdatedIdx: index('btr_instance_updated_idx').on(t.botInstanceId, t.updatedAt),
    statusCheck: check('bot_trade_reviews_status_check', sql`${t.reviewStatus} IN ('unreviewed', 'reviewed', 'flagged', 'ignored')`),
  }),
);

// Risk signal log from adapter/worker (TP mismatch, margin, rate limits). Surfaced as UI warnings.
export const botSafetyEvents = pgTable(
  'bot_safety_events',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
    botProviderAccountId: uuid('bot_provider_account_id').references(() => botProviderAccounts.id, { onDelete: 'set null' }),
    eventCode: text('event_code').notNull(),
    severity: text('severity').notNull(), // info | warning | critical
    symbol: text('symbol'),
    description: text('description').notNull(),
    metadata: jsonb('metadata'), // no plaintext keys
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceObservedIdx: index('bse_instance_observed_idx').on(t.botInstanceId, t.observedAt),
    providerObservedIdx: index('bse_provider_observed_idx').on(t.botProviderAccountId, t.observedAt),
    severityIdx: index('bse_severity_idx').on(t.severity),
  }),
);

// --- Education (4): teacher profiles, enrollments, lesson progress, pinned links ---

// Teacher-specific extension of user. One-to-one. Backfilled from courses.owner_teacher_id in the migration.
export const teacherProfiles = pgTable(
  'teacher_profiles',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ uniqUserId: uniqueIndex('teacher_profiles_user_id_idx').on(t.userId) }),
);

// Student enrollment in a course. One per (user, course).
export const enrollments = pgTable(
  'enrollments',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    entitlementId: uuid('entitlement_id').references(() => entitlements.id), // null = manual/admin; no cascade
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    uniqUserCourse: uniqueIndex('enrollments_user_course_idx').on(t.userId, t.courseId),
    userIdx: index('enrollments_user_id_idx').on(t.userId),
    courseIdx: index('enrollments_course_id_idx').on(t.courseId),
  }),
);

// Per-user, per-lesson progress. UPSERTed on each progress POST. One per (user, lesson).
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    percentComplete: numeric('percent_complete', { precision: 5, scale: 2 }).notNull().default('0'),
    completed: boolean('completed').notNull().default(false),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserLesson: uniqueIndex('lesson_progress_user_lesson_idx').on(t.userId, t.lessonId),
    userIdx: index('lesson_progress_user_id_idx').on(t.userId),
  }),
);

// Community/social links pinned by a teacher (to profile) or admin (to course). Polymorphic owner.
export const pinnedLinks = pgTable(
  'pinned_links',
  {
    id: id(),
    ownerType: text('owner_type').notNull(), // teacher_profile | course (CHECK added in migration SQL)
    ownerId: uuid('owner_id').notNull(), // polymorphic; app validates by owner_type (no DB FK)
    label: text('label').notNull(),
    url: text('url').notNull(),
    iconType: text('icon_type'), // telegram | instagram | youtube | twitter | link
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id), // nullable; no cascade
    createdAt: createdAt(),
  },
  (t) => ({ ownerSortIdx: index('pinned_links_owner_idx').on(t.ownerType, t.ownerId, t.sortOrder) }),
);

// --- TradingView (2): grants (declared first — profile FKs into it), profiles ---

// Records that a TV username was granted access. Separate from the request lifecycle.
export const tradingviewAccessGrants = pgTable(
  'tradingview_access_grants',
  {
    id: id(),
    requestId: uuid('request_id').notNull().references(() => tradingviewAccessRequests.id), // no cascade: keep audit trail
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tvUsername: text('tv_username').notNull(), // denormalised public handle
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedBy: uuid('granted_by').references(() => users.id), // nullable; no cascade
    grantedByType: text('granted_by_type').notNull(), // admin | automation_adapter
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokeReason: text('revoke_reason'),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('tvag_user_id_idx').on(t.userId),
    expiresIdx: index('tvag_expires_at_idx').on(t.expiresAt),
  }),
);

// User's declared TV username + verification state. current_grant_id set via two-step UPSERT after grant insert.
export const tradingviewProfiles = pgTable(
  'tradingview_profiles',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tvUsername: text('tv_username').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    currentGrantId: uuid('current_grant_id').references(() => tradingviewAccessGrants.id), // no cascade
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ uniqUserId: uniqueIndex('tvp_user_id_idx').on(t.userId) }),
);

// --- Products (1): immutable entitlement transition log; written alongside grant/revoke audit ---
export const productAccessEvents = pgTable(
  'product_access_events',
  {
    id: id(),
    entitlementId: uuid('entitlement_id').notNull().references(() => entitlements.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), // hard user-delete removes that user's access log rows
    productCode: text('product_code').notNull(),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    reason: text('reason'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }), // null = system/webhook/deleted actor
    actorType: text('actor_type').notNull(), // user | admin | system | billing_webhook
    createdAt: createdAt(),
  },
  (t) => ({
    entitlementIdx: index('pae_entitlement_id_idx').on(t.entitlementId),
    userIdx: index('pae_user_id_idx').on(t.userId),
  }),
);

// --- Axioma / Terminal (3): release cache, download events, license events ---
export const terminalReleaseCache = pgTable(
  'terminal_release_cache',
  {
    id: id(),
    version: text('version').notNull(),
    channel: text('channel').notNull(), // stable | beta
    platform: text('platform').notNull(), // win32 | darwin | linux
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    releaseNotesMarkdown: text('release_notes_markdown'),
    downloadUrlTemplate: text('download_url_template'),
    checksumSha256: text('checksum_sha256'),
    minSupportedVersion: text('min_supported_version'),
    isCurrent: boolean('is_current').notNull().default(false),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqVersionChannelPlatform: uniqueIndex('trc_version_channel_platform_idx').on(t.version, t.channel, t.platform),
    channelPlatformCurrentIdx: index('trc_channel_platform_current_idx').on(t.channel, t.platform, t.isCurrent),
  }),
);

export const terminalDownloadEvents = pgTable(
  'terminal_download_events',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    releaseId: uuid('release_id').notNull().references(() => terminalReleaseCache.id),
    version: text('version').notNull(),
    platform: text('platform').notNull(),
    tokenHash: text('token_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    axiomaUserId: text('axioma_user_id'),
    ipAddress: text('ip_address'), // TEXT not INET (PGlite compatibility)
    userAgent: text('user_agent'),
    entitlementVerified: boolean('entitlement_verified').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('tde_user_id_idx').on(t.userId),
    tokenHashIdx: uniqueIndex('tde_token_hash_idx').on(t.tokenHash),
    expiresIdx: index('tde_expires_at_idx').on(t.expiresAt),
  }),
);

export const terminalLicenseEvents = pgTable(
  'terminal_license_events',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    eventType: text('event_type').notNull(), // link_initiated | link_confirmed | link_revoked | entitlement_synced
    axiomaUserId: text('axioma_user_id'),
    deviceFingerprint: text('device_fingerprint'), // opaque hashed device ID — NEVER plaintext
    metadata: jsonb('metadata'), // no plaintext keys
    createdAt: createdAt(),
  },
  (t) => ({ userIdx: index('tle_user_id_idx').on(t.userId) }),
);

// Axioma handoff-token jti replay-prevention store (migration 0004 / PG6).
// See docs/AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention. `jti` is the CALLER-SUPPLIED token id
// (UUID v4 from buildHandoffClaims) — NO defaultRandom(). `sub` is the WTC user id with NO FK: rows
// must survive user deletion as replay/audit evidence (same pattern as audit_logs.actor_user_id /
// billing_manual_review_items.user_id); the app sweeps a deleted user's pending jtis via
// revokeHandoffJtisByUser. Consume is a single atomic conditional UPDATE (used_at IS NULL AND
// revoked_at IS NULL AND expires_at > now); 0 rows updated = replay/expired/revoked. The worker purges
// rows past (expires_at + buffer). This table ONLY in 0004 — the axioma_account_links OTC→hash refactor
// stays TARGET/B4 (docs/handoffs/20260530-2230-ecosystem-db-architect.md D-4).
export const axiomaHandoffJtiRevocations = pgTable(
  'axioma_handoff_jti_revocations',
  {
    jti: uuid('jti').primaryKey(), // caller-supplied UUID v4 (no defaultRandom)
    sub: uuid('sub').notNull(), // WTC user id; no FK — row survives user deletion (audit evidence)
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }), // NULL = not yet consumed
    revokedAt: timestamp('revoked_at', { withTimezone: true }), // NULL = not revoked
    revokeReason: text('revoke_reason'),
  },
  (t) => ({
    expiresIdx: index('ahjr_expires_at_idx').on(t.expiresAt), // worker purge
    subIdx: index('ahjr_sub_idx').on(t.sub), // per-user revoke sweep
  }),
);

// --- Ops (2): notifications (partial unread index), support tickets ---
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }), // NULL = unread
    createdAt: createdAt(),
  },
  (t) => ({
    userUnreadIdx: index('notifications_user_unread_idx').on(t.userId, t.readAt).where(sql`"read_at" IS NULL`),
  }),
);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    productCode: text('product_code'),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('open'), // open | in_progress | resolved | closed
    priority: text('priority').notNull().default('normal'), // low | normal | high | urgent
    assignedTo: uuid('assigned_to').references(() => users.id), // nullable; no cascade
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('support_tickets_user_id_idx').on(t.userId),
    statusIdx: index('support_tickets_status_idx').on(t.status),
  }),
);

// ============================================================================
// Migration 0003 — additive Phase-2.4 billing hardening + manual-review queue.
// Source of truth: docs/handoffs/20260530-1355-ecosystem-billing-access-auditor.md (Decisions 1, 4).
// Adds 2 new tables and 1 unique index on subscriptions.
// ============================================================================

// --- Billing: durable webhook event ledger (migration 0003) ---
// Replaces the audit_logs select-then-insert idempotency check in applyStripeEvent.
// UNIQUE (provider, event_id) is the single source of truth for "was this event processed?".
// Caller: INSERT … onConflictDoNothing().returning() → 0 rows = duplicate, skip processing.
// 90-day TTL column (expires_at) for future worker-driven cleanup.
// Bounded context: Ops/Billing. Owner: db-architect.
export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),       // 'stripe' | 'crypto' | 'manual'
    eventId: text('event_id').notNull(),         // provider event id (evt_xxx)
    eventType: text('event_type').notNull(),     // e.g. 'checkout.session.completed'
    userId: uuid('user_id').references(() => users.id), // NULL when userId was unresolvable
    planCode: text('plan_code'),                 // NULL when absent/unknown
    billingEvent: text('billing_event'),         // mapped BillingEvent or NULL for no-op types
    status: text('status').notNull(),            // 'processing' | 'applied' | 'no_op' | 'manual_review' | 'error'
    productsChanged: integer('products_changed').notNull().default(0),
    // 90-day TTL for eventual cleanup; worker job prunes rows where expires_at < NOW()
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // The enforcer: concurrent duplicate deliveries INSERT simultaneously;
    // exactly one wins, the rest get a unique-violation and return 0 rows (ON CONFLICT DO NOTHING).
    uniqProviderEvent: uniqueIndex('bwe_provider_event_idx').on(t.provider, t.eventId),
    expiresIdx: index('bwe_expires_at_idx').on(t.expiresAt),
    userIdx: index('bwe_user_id_idx').on(t.userId),
  }),
);

// --- Billing: admin manual review queue (migration 0003) ---
// Stores unresolvable or ambiguous webhook events requiring admin triage.
// Never auto-grant on ambiguous data — always creates a review item instead.
// Bounded context: Ops/Billing. Owner: db-architect.
export const billingManualReviewItems = pgTable(
  'billing_manual_review_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // The webhook event that triggered this review item.
    provider: text('provider').notNull(),          // 'stripe' | 'crypto'
    eventId: text('event_id').notNull(),           // provider event id
    eventType: text('event_type').notNull(),
    // Resolution state: 'pending' | 'approved' | 'rejected' | 'dismissed'
    status: text('status').notNull().default('pending'),
    // The user this event was for — NULL when userId was completely unresolvable.
    userId: uuid('user_id').references(() => users.id), // no cascade — keep after user deletion
    // What was ambiguous or missing.
    // 'missing_user_id' | 'unknown_plan_code' | 'partial_refund' | 'partial_payment' | 'ambiguous_dispute_outcome' | 'other'
    reason: text('reason').notNull(),
    // Admin-provided resolution fields.
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    // Raw parsed event snapshot for admin inspection (NEVER includes NormalizedEvent.raw or secrets).
    eventSnapshot: jsonb('event_snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // One review item per unresolvable event (not per delivery attempt).
    uniqProviderEvent: uniqueIndex('bmri_provider_event_idx').on(t.provider, t.eventId),
    statusIdx: index('bmri_status_idx').on(t.status),
    userIdx: index('bmri_user_id_idx').on(t.userId),
  }),
);
