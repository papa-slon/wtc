/**
 * @wtc/audit — append-only audit log. See docs/AUDIT_LOG_SCHEMA.md.
 * Every mutation writes an event; before/after payloads are redacted on the way in.
 * Zero dependencies (smoke-testable with `node`).
 */
import { redact } from './redact.ts';

export const AUDIT_ACTIONS = [
  // --- Phase 1 (existing — do not remove) ---
  'auth.login',
  'auth.register',
  'auth.login_failed',
  'auth.logout',
  'exchange_key.create',
  'exchange_key.update',
  'exchange_key.delete',
  'bot.config_change',
  'bot.control_attempt',
  'product.grant',
  'product.revoke',
  'tradingview.submit',
  'tradingview.grant',
  'tradingview.revoke',
  'education.material_change',
  'education.course_create',
  'admin.action',
  // --- Phase 2.1 additions (docs/handoffs/20260530-0925-ecosystem-security-auditor.md;
  //     repo codes asserted by docs/handoffs/20260530-0925-ecosystem-db-architect.md tests) ---
  // Bots
  'bot.config.save',
  'bot.config_version_created',
  'bot.enable',
  'bot.disable',
  'bot.trade_imported',
  'bot.trade_review.save',
  'bot.safety_event',
  'bot.safety_event_ack',
  // Exchange keys
  'exchange_key.rewrap',
  'exchange_key.test',
  // Auth (hardening — codes reserved; routes land later)
  'auth.logout_all',
  'auth.password_change',
  'auth.password_reset_request',
  'auth.password_reset_success',
  'auth.account_unlock',
  'auth.session_revoke',
  // Billing / products
  'product.grace_start',
  'product.expire',
  'product.refund',
  'product.chargeback',
  'product.flag_review',
  'billing.webhook_received',
  'billing.webhook_rejected',
  'billing.webhook_missing_user',
  'billing.checkout_created',
  'billing.subscription_update',
  'billing.manual_review_created',
  'billing.manual_review_approved',
  'billing.manual_review_rejected',
  'billing.manual_review_dismissed',
  // TradingView — new grant/profile repos write tv_access.*; legacy request flow keeps tradingview.*
  'tradingview.expire',
  'tv_access.profile_update',
  'tv_access.grant',
  'tv_access.revoke',
  'tv_access.task_done',
  // Axioma / terminal
  'axioma.account_link_init',
  'axioma.account_link_complete',
  'axioma.account_link_revoke',
  'axioma.download_request',
  'axioma.release_publish',
  // Axioma handoff-token jti replay store (migration 0004 / PG6). Underscore convention to match the
  // existing axioma.* codes (the AXIOMA_HANDOFF_TOKEN_SPEC.md dot-form is aspirational — see
  // docs/handoffs/20260530-2230-ecosystem-db-architect.md D-6). Emitted by the future B4 consume/issue/
  // revoke routes; the jti store repos themselves are pure primitives (no inline audit).
  'axioma.handoff_jti_consume',
  'axioma.handoff_jti_replay',
  'axioma.handoff_jti_revoke',
  'terminal.account_link',
  'terminal.download',
  'terminal.license_event',
  // Education (full LMS)
  'education.course_update',
  'education.course_publish',
  'education.course_delete',
  'education.lesson_create',
  'education.lesson_update',
  'education.lesson_delete',
  'education.material_upload',
  'education.material_download',
  'education.material_delete',
  'education.material_cleanup',
  'education.material_cleanup_ack',
  'education.material_cleanup_retry',
  'education.teacher_profile_create',
  'education.teacher_profile_update',
  'education.enroll',
  'education.enrolled',
  'education.progress',
  'education.course_completed',
  'education.pinned_link_create',
  'education.pinned_link_delete',
  // Education — denial audit codes (PG7 / 20260530-2330). The LMS server-action pipeline
  // (apps/web/src/features/lms/{actions,guard}.ts) writes one of these with result:'failure'
  // BEFORE throwing AppError on an authorization denial — replacing the prior silent `return`.
  // Two codes (not one) so security monitoring can separate routine entitlement gating
  // (education.entitlement_denied — a user without an active education sub) from anomalous
  // authorization violations (education.rbac_denied — wrong role / not-your-course / admin-only).
  // The finer reason (role | ownership | admin_required | <access reason>) rides in after.reason.
  'education.rbac_denied',
  'education.entitlement_denied',
  // Support
  'support.ticket_create',
  'support.ticket_reply',
  'support.ticket_update',
  'support.ticket_status_change',
  // Admin
  'admin.user_role_assign',
  'admin.user_role_revoke',
  'admin.user_delete',
  'admin.user_view',
  'admin.entitlement_grant',
  'admin.entitlement_revoke',
  // System
  'system.vault_rewrap_batch',
  'system.worker_expiry_run',
  'system.health_check',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditResult = 'success' | 'failure';

export interface AuditEvent {
  id: string;
  ts: number;
  actorUserId: string | null;
  actorRole: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  before?: unknown;
  after?: unknown;
  result: AuditResult;
}

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  before?: unknown;
  after?: unknown;
  result?: AuditResult;
}

/** Build a fully-formed, redacted audit event. */
export function buildEvent(input: AuditInput, now: number = Date.now()): AuditEvent {
  const event: AuditEvent = {
    id: globalThis.crypto.randomUUID(),
    ts: now,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    result: input.result ?? 'success',
  };
  if (input.ip) event.ip = input.ip;
  if (input.userAgent) event.userAgent = input.userAgent;
  if (input.requestId) event.requestId = input.requestId;
  if (input.before !== undefined) event.before = redact(input.before);
  if (input.after !== undefined) event.after = redact(input.after);
  return event;
}

export interface AuditWriter {
  write(input: AuditInput): Promise<void>;
}

/** In-memory writer for tests; exposes captured events. */
export function createMemoryAuditWriter(): { writer: AuditWriter; events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    events,
    writer: {
      async write(input) {
        events.push(buildEvent(input));
      },
    },
  };
}

/** Dev writer that logs redacted events (a real writer persists to the audit_logs table). */
export function createConsoleAuditWriter(): AuditWriter {
  // Dev/diagnostic only — stdout is neither durable nor the append-only audit_logs table. Fail closed
  // if this is ever wired up as the production audit sink by mistake.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[audit] console audit writer is disabled in production — use the DB audit writer');
  }
  return {
    async write(input) {
      const e = buildEvent(input);
       
      console.log('[audit]', JSON.stringify(e));
    },
  };
}
