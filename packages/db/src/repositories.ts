/**
 * @wtc/db repositories — the production data layer that replaces apps/web/src/lib/demo.ts in-memory
 * usage. Async functions over a Drizzle `Db` (Postgres). Reuses the verified domain packages for all
 * business rules (@wtc/entitlements, @wtc/audit). Secrets are stored sealed (no plaintext column);
 * listExchangeKeys never joins the secret row.
 *
 * Driver note: the production driver is postgres-js (client.ts). The PGlite integration test passes a
 * pglite-backed Drizzle instance cast to `Db` — the query API is identical, so the repos are exercised
 * against a real Postgres engine without Docker.
 */
import { and, eq, lt, lte, gt, desc, isNull, isNotNull, inArray, like, or, sql } from 'drizzle-orm';
import type { Role } from '@wtc/shared';
import {
  isLoginLocked,
  nextLoginFailureState,
  nextAdminUnlockState,
  nextLoginSuccessState,
  type LoginLockoutState,
} from '@wtc/auth';
import {
  grantManual,
  applyBillingEvent,
  reconcileExpiry,
  type Entitlement,
  type EntitlementStatus,
  type EntitlementSource,
  type ProductCode,
  type BillingEvent,
} from '@wtc/entitlements';
import { buildEvent, type AuditInput, type AuditWriter } from '@wtc/audit';
import type { SealedSecret } from '@wtc/crypto';
import {
  LMS_DEFAULT_FILE_RETENTION_DAYS,
  LMS_FILESYSTEM_STORAGE_PROVIDER,
  LMS_OBJECT_STORAGE_PROVIDER,
  LMS_STORAGE_KEY_PREFIX,
  LMS_LOCAL_STORAGE_PROVIDER,
  buildLmsStorageKey,
  isOpaqueLmsMaterialStorageKey,
  isSupportedLmsFileStorageProvider,
  isSanitizedLmsEmbedHtml,
  sha256HexForBytes,
  type LmsFileScanStatus,
} from '@wtc/lms';
import type { Db } from './client.ts';
import * as s from './schema.ts';

// ---------------- Identity ----------------
export interface DbUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: Role[];
}

export type AuthLoginAttemptResult =
  | { ok: true; user: DbUser }
  | { ok: false; reason: 'invalid'; lockoutApplied: boolean; reviewRequired: boolean; lockedUntil: number | null }
  | { ok: false; reason: 'locked'; lockedUntil: number };

export type VerifyPasswordFn = (passwordHash: string, plaintext: string) => Promise<boolean>;

export interface UnlockUserLoginLockoutResult {
  userId: string;
  wasLocked: boolean;
  reviewRequired: boolean;
}

async function rolesOf(db: Db, userId: string): Promise<Role[]> {
  const rows = await db.select({ roleCode: s.userRoles.roleCode }).from(s.userRoles).where(eq(s.userRoles.userId, userId));
  return rows.map((r) => r.roleCode as Role);
}

async function toDbUser(db: Db, u: typeof s.users.$inferSelect): Promise<DbUser> {
  return { id: u.id, email: u.email, displayName: u.displayName ?? u.email, passwordHash: u.passwordHash, roles: await rolesOf(db, u.id) };
}

export async function findUserByEmail(db: Db, email: string): Promise<DbUser | null> {
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  return u ? toDbUser(db, u) : null;
}

function ms(value: Date | null): number | null {
  return value ? value.getTime() : null;
}

function dt(value: number | null): Date | null {
  return value === null ? null : new Date(value);
}

function lockoutStateFromUser(u: typeof s.users.$inferSelect): LoginLockoutState {
  return {
    failedLogin15mCount: u.failedLogin15mCount,
    failedLogin15mResetAt: ms(u.failedLogin15mResetAt),
    failedLogin60mCount: u.failedLogin60mCount,
    failedLogin60mResetAt: ms(u.failedLogin60mResetAt),
    failedLoginTotalCount: u.failedLoginTotalCount,
    lastFailedLoginAt: ms(u.lastFailedLoginAt),
    accountLockedUntil: ms(u.accountLockedUntil),
    accountLockoutReviewRequiredAt: ms(u.accountLockoutReviewRequiredAt),
  };
}

function lockoutPatch(state: LoginLockoutState) {
  return {
    failedLogin15mCount: state.failedLogin15mCount,
    failedLogin15mResetAt: dt(state.failedLogin15mResetAt),
    failedLogin60mCount: state.failedLogin60mCount,
    failedLogin60mResetAt: dt(state.failedLogin60mResetAt),
    failedLoginTotalCount: state.failedLoginTotalCount,
    lastFailedLoginAt: dt(state.lastFailedLoginAt),
    accountLockedUntil: dt(state.accountLockedUntil),
    accountLockoutReviewRequiredAt: dt(state.accountLockoutReviewRequiredAt),
  };
}

function lockoutAuditState(state: LoginLockoutState) {
  return {
    failedLogin15mCount: state.failedLogin15mCount,
    failedLogin60mCount: state.failedLogin60mCount,
    failedLoginTotalCount: state.failedLoginTotalCount,
    lastFailedLoginAt: state.lastFailedLoginAt,
    accountLockedUntil: state.accountLockedUntil,
    accountLockoutReviewRequiredAt: state.accountLockoutReviewRequiredAt,
  };
}

export async function attemptUserLogin(
  db: Db,
  input: { email: string; password: string; verifyPassword: VerifyPasswordFn; now?: Date | number },
): Promise<AuthLoginAttemptResult> {
  const nowMs = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();
  const txResult = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT "id" FROM "users" WHERE "email" = ${input.email} FOR UPDATE`);
    const [u] = await tx.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
    if (!u) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorRole: null,
        action: 'auth.login_failed',
        targetType: 'auth_login_identifier',
        targetId: null,
        after: { outcome: 'invalid', accountResolved: false },
        result: 'failure',
      }, nowMs));
      return { ok: false as const, reason: 'invalid' as const, lockoutApplied: false, reviewRequired: false, lockedUntil: null };
    }

    const state = lockoutStateFromUser(u);
    if (isLoginLocked(state, nowMs)) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: u.id,
        actorRole: 'user',
        action: 'auth.login_failed',
        targetType: 'user',
        targetId: u.id,
        after: { outcome: 'locked', accountResolved: true },
        result: 'failure',
      }, nowMs));
      return { ok: false as const, reason: 'locked' as const, lockedUntil: state.accountLockedUntil! };
    }

    if (await input.verifyPassword(u.passwordHash, input.password)) {
      await tx.update(s.users).set(lockoutPatch(nextLoginSuccessState())).where(eq(s.users.id, u.id));
      return { ok: true as const, userId: u.id };
    }

    const failure = nextLoginFailureState(state, nowMs);
    await tx.update(s.users).set(lockoutPatch(failure.state)).where(eq(s.users.id, u.id));
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: u.id,
      actorRole: 'user',
      action: 'auth.login_failed',
      targetType: 'user',
      targetId: u.id,
      after: {
        outcome: 'invalid',
        accountResolved: true,
        lockoutApplied: failure.lockoutApplied,
        lockoutReason: failure.lockoutReason,
        reviewRequired: failure.reviewRequired,
      },
      result: 'failure',
    }, nowMs));
    return {
      ok: false as const,
      reason: 'invalid' as const,
      lockoutApplied: failure.lockoutApplied,
      reviewRequired: failure.reviewRequired,
      lockedUntil: failure.state.accountLockedUntil,
    };
  });

  if (!txResult.ok) return txResult;
  const user = await getUserById(db, txResult.userId);
  if (!user) throw new Error('login user disappeared after successful attempt');
  return { ok: true, user };
}

export async function unlockUserLoginLockout(
  db: Db,
  input: { targetUserId: string; actorUserId: string; reason: string; now?: Date | number },
): Promise<UnlockUserLoginLockoutResult> {
  const nowMs = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT "id" FROM "users" WHERE "id" = ${input.targetUserId} FOR UPDATE`);
    const [u] = await tx.select().from(s.users).where(eq(s.users.id, input.targetUserId)).limit(1);
    if (!u) throw new Error('user_not_found');

    const beforeState = lockoutStateFromUser(u);
    const nextState = nextAdminUnlockState();
    await tx.update(s.users).set(lockoutPatch(nextState)).where(eq(s.users.id, u.id));
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.actorUserId,
      actorRole: 'admin',
      action: 'auth.account_unlock',
      targetType: 'user',
      targetId: u.id,
      before: lockoutAuditState(beforeState),
      after: { ...lockoutAuditState(nextState), unlocked: true, reason: input.reason },
      result: 'success',
    }, nowMs));

    return {
      userId: u.id,
      wasLocked: beforeState.accountLockedUntil !== null && beforeState.accountLockedUntil > nowMs,
      reviewRequired: beforeState.accountLockoutReviewRequiredAt !== null,
    };
  });
}

export async function getUserById(db: Db, id: string): Promise<DbUser | null> {
  const [u] = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return u ? toDbUser(db, u) : null;
}

export async function listUsers(db: Db): Promise<DbUser[]> {
  const rows = await db.select().from(s.users);
  return Promise.all(rows.map((u) => toDbUser(db, u)));
}

/** Postgres unique-violation (SQLSTATE 23505). Both postgres-js and PGlite surface `.code`. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

export async function createUser(
  db: Db,
  input: { email: string; passwordHash: string; displayName: string; roles?: Role[]; auditRegistration?: boolean; now?: Date | number },
): Promise<DbUser> {
  const roles = input.roles ?? (['user'] as Role[]);
  const nowMs = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();
  // Atomic: the duplicate-email check, the user insert, and the role inserts are one transaction.
  // The in-txn SELECT gives a friendly error in the common (sequential) case; the users.email unique
  // index is the real guard. Concurrent signups can both pass the SELECT and collide on INSERT — we
  // catch that 23505 and map it to the SAME friendly error so callers get one stable contract.
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
      if (existing) throw new Error('email already registered');
      const [u] = await tx.insert(s.users).values({ email: input.email, passwordHash: input.passwordHash, displayName: input.displayName }).returning();
      if (!u) throw new Error('failed to insert user');
      for (const r of roles) await tx.insert(s.userRoles).values({ userId: u.id, roleCode: r }).onConflictDoNothing();
      if (input.auditRegistration) {
        await tx.insert(s.auditLogs).values(auditRowValues({
          actorUserId: u.id,
          actorRole: roles[0] ?? 'user',
          action: 'auth.register',
          targetType: 'user',
          targetId: u.id,
          after: { roles, hasDisplayName: input.displayName.trim().length > 0 },
          result: 'success',
        }, nowMs));
      }
      return { id: u.id, email: u.email, displayName: input.displayName, passwordHash: u.passwordHash, roles };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('email already registered');
    throw err;
  }
}

// ---------------- Sessions ----------------
export async function createSession(db: Db, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await db.insert(s.sessions).values({ userId, tokenHash, expiresAt });
}

export async function userForTokenHash(db: Db, tokenHash: string, now: Date): Promise<DbUser | null> {
  const [sess] = await db.select().from(s.sessions).where(eq(s.sessions.tokenHash, tokenHash)).limit(1);
  if (!sess || sess.revoked || sess.expiresAt.getTime() < now.getTime()) return null;
  return getUserById(db, sess.userId);
}

export async function destroySession(db: Db, tokenHash: string): Promise<void> {
  await db.update(s.sessions).set({ revoked: true }).where(eq(s.sessions.tokenHash, tokenHash));
}

// ---------------- Entitlements ----------------
function rowToEntitlement(r: typeof s.entitlements.$inferSelect): Entitlement {
  const ent: Entitlement = {
    userId: r.userId,
    productCode: r.productCode,
    status: r.status as EntitlementStatus,
    source: r.source as EntitlementSource,
    manualOverride: r.manualOverride,
    updatedAt: r.updatedAt.getTime(),
  };
  if (r.planCode) ent.planCode = r.planCode;
  if (r.startsAt) ent.startsAt = r.startsAt.getTime();
  if (r.currentPeriodEnd) ent.currentPeriodEnd = r.currentPeriodEnd.getTime();
  if (r.graceUntil) ent.graceUntil = r.graceUntil.getTime();
  if (r.expiresAt) ent.expiresAt = r.expiresAt.getTime();
  return ent;
}

export async function entitlementsOf(db: Db, userId: string): Promise<Entitlement[]> {
  const rows = await db.select().from(s.entitlements).where(eq(s.entitlements.userId, userId));
  return rows.map(rowToEntitlement);
}

// grant/revoke are atomic: the entitlement mutation AND the audit row are written in ONE transaction
// (audit goes through the same tx connection, so an entitlement change can never be left un-audited or
// vice-versa). The unique index on (user_id, product_code) prevents duplicate grant rows.
export async function grantProduct(db: Db, userId: string, productCode: ProductCode, now = Date.now(), actorUserId?: string, reason?: string, validUntil?: number): Promise<void> {
  const e = grantManual(userId, productCode, now);
  await db.transaction(async (tx) => {
    // Read prior state (for the product_access_events.from_state) — this is informational only; the
    // WRITE below is still an upsert, so it does NOT reintroduce the SELECT-then-INSERT 23505 race.
    const [prior] = await tx.select({ status: s.entitlements.status }).from(s.entitlements).where(and(eq(s.entitlements.userId, userId), eq(s.entitlements.productCode, productCode))).limit(1);
    const fromState = prior?.status ?? 'none';
    // Idempotent under concurrent grants: a DB-level upsert on the unique (user_id, product_code)
    // index instead of SELECT-then-INSERT. A manual grant always resolves to 'active'
    // (nextStatus(_, 'manual_grant') === 'active'), so the conflict path can set status without
    // re-reading the row — two concurrent duplicate grants can never both INSERT and raise a 23505.
    // source/planCode/startsAt stay insert-only (preserved on re-grant, matching the old update branch).
    // When validUntil (epoch-ms) is provided, set entitlement expiresAt so the grant has a hard expiry.
    const conflictSet: Record<string, unknown> = { status: e.status, manualOverride: true, updatedAt: new Date(now) };
    if (validUntil !== undefined) conflictSet.expiresAt = new Date(validUntil);
    const [row] = await tx
      .insert(s.entitlements)
      .values({
        userId, productCode, status: e.status, source: e.source, planCode: e.planCode,
        manualOverride: true, startsAt: new Date(now), updatedAt: new Date(now),
        ...(validUntil !== undefined ? { expiresAt: new Date(validUntil) } : {}),
      })
      .onConflictDoUpdate({
        target: [s.entitlements.userId, s.entitlements.productCode],
        set: conflictSet,
      })
      .returning({ id: s.entitlements.id });
    // Audit row + product-access event in the SAME transaction (an entitlement change is never left
    // un-audited, and the immutable transition log stays in lock-step with the entitlement state).
    // reason and validUntil are surfaced in the audit after-payload for traceability.
    const eventReason = reason ?? 'manual_grant';
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: actorUserId ?? null, actorRole: 'admin', action: 'product.grant', targetType: 'entitlement', targetId: `${userId}:${productCode}`, after: { status: e.status, reason: eventReason, ...(validUntil !== undefined ? { validUntil } : {}) } }));
    if (row) await tx.insert(s.productAccessEvents).values({ entitlementId: row.id, userId, productCode, fromState, toState: e.status, reason: eventReason, actorId: actorUserId ?? null, actorType: actorUserId ? 'admin' : 'system' });
  });
}

export async function revokeProduct(db: Db, userId: string, productCode: ProductCode, now = Date.now(), actorUserId?: string, reason?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.entitlements).where(and(eq(s.entitlements.userId, userId), eq(s.entitlements.productCode, productCode))).limit(1);
    if (!existing) return;
    const fromState = existing.status;
    const next = applyBillingEvent(rowToEntitlement(existing), 'manual_revoke', now);
    await tx.update(s.entitlements).set({ status: next.status, manualOverride: true, updatedAt: new Date(now) }).where(eq(s.entitlements.id, existing.id));
    // reason is threaded into both the product_access_events row and the audit payload.
    const eventReason = reason ?? 'manual_revoke';
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: actorUserId ?? null, actorRole: 'admin', action: 'product.revoke', targetType: 'entitlement', targetId: `${userId}:${productCode}`, after: { status: next.status, reason: eventReason } }));
    await tx.insert(s.productAccessEvents).values({ entitlementId: existing.id, userId, productCode, fromState, toState: next.status, reason: eventReason, actorId: actorUserId ?? null, actorType: actorUserId ? 'admin' : 'system' });
  });
}

// ---------------- Exchange keys (sealed) ----------------
export interface ExchangeAccountView {
  id: string;
  userId: string;
  exchange: string;
  label: string;
  mode: 'demo' | 'live';
  keyMask: string;
}

export async function addExchangeKey(
  db: Db,
  input: { userId: string; exchange: string; label: string; mode: 'demo' | 'live'; keyMask: string; sealed: SealedSecret; keyId: string },
): Promise<ExchangeAccountView> {
  // Atomic: the account row and its sealed-secret row are one transaction — a secrets-insert failure
  // rolls back the account so there is never a dangling exchange account with no vault material.
  return db.transaction(async (tx) => {
    const [acct] = await tx
      .insert(s.exchangeAccounts)
      .values({ userId: input.userId, exchange: input.exchange, label: input.label, mode: input.mode, keyMask: input.keyMask })
      .returning();
    if (!acct) throw new Error('failed to insert exchange account');
    await tx.insert(s.exchangeApiKeySecrets).values({ exchangeAccountId: acct.id, sealed: input.sealed as unknown as Record<string, unknown>, keyId: input.keyId });
    // In-txn audit (was missing — security F1). NEVER the sealed blob or plaintext key; only the
    // non-secret mask/label/keyId. `keyMask` is a display hint (e.g. ••••1234), not a secret.
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'user', action: 'exchange_key.create', targetType: 'exchange_account', targetId: acct.id, after: { label: input.label, exchange: input.exchange, mode: input.mode, keyMask: input.keyMask, keyId: input.keyId } }));
    return { id: acct.id, userId: input.userId, exchange: input.exchange, label: input.label, mode: input.mode, keyMask: input.keyMask };
  });
}

export async function listExchangeKeys(db: Db, userId: string): Promise<ExchangeAccountView[]> {
  const rows = await db.select().from(s.exchangeAccounts).where(eq(s.exchangeAccounts.userId, userId));
  // NOTE: never joins exchange_api_key_secrets — sealed material is never returned to callers.
  return rows.map((a) => ({ id: a.id, userId: a.userId, exchange: a.exchange, label: a.label, mode: a.mode as 'demo' | 'live', keyMask: a.keyMask }));
}

// ---------------- Audit (DB writer) ----------------
/** Map an audit input to an audit_logs row (redacts before/after via buildEvent). Shared by the
 *  standalone writer and by the in-transaction audit inserts in grant/revoke. */
function auditRowValues(input: AuditInput, now?: number) {
  const e = buildEvent(input, now); // redacts before/after; `now` stamps ts to the mutation time when provided
  return {
    id: e.id,
    ts: new Date(e.ts),
    actorUserId: e.actorUserId,
    actorRole: e.actorRole,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    ip: e.ip,
    userAgent: e.userAgent,
    requestId: e.requestId,
    before: e.before ?? null,
    after: e.after ?? null,
    result: e.result,
  };
}

export function createDbAuditWriter(db: Db): AuditWriter {
  return {
    async write(input: AuditInput) {
      await db.insert(s.auditLogs).values(auditRowValues(input));
    },
  };
}

export async function recentAuditEvents(db: Db, limit = 50): Promise<(typeof s.auditLogs.$inferSelect)[]> {
  return db.select().from(s.auditLogs).limit(limit);
}

// ---------------- TradingView access (async repo) ----------------
// submit/grant/revoke each write their audit row INSIDE the same transaction as the mutation
// (mirrors grantProduct/revokeProduct) — a TV access change can never be left un-audited. The
// TradingView username is a PUBLIC handle (not a secret), so it is safe to record in the audit row.
export type TvStatus = 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked';
export type TvRequest = typeof s.tradingviewAccessRequests.$inferSelect;

/** UI-facing DTO: epoch-ms timestamps (never a raw Date), nulls dropped. As of migration 0002 the
 *  request row carries the revoke actor/time (revokedAt/revokedBy); they are surfaced here too. */
export interface TvRequestDTO {
  id: string;
  userId: string;
  tradingViewUsername: string;
  status: TvStatus;
  requestedAt: number;
  grantedAt?: number;
  grantedBy?: string;
  expiresAt?: number;
  revokedAt?: number;
  revokedBy?: string;
}
export function rowToTvDto(r: TvRequest): TvRequestDTO {
  const dto: TvRequestDTO = {
    id: r.id,
    userId: r.userId,
    tradingViewUsername: r.tradingViewUsername,
    status: r.status as TvStatus,
    requestedAt: r.requestedAt.getTime(),
  };
  if (r.grantedAt) dto.grantedAt = r.grantedAt.getTime();
  if (r.grantedBy) dto.grantedBy = r.grantedBy;
  if (r.expiresAt) dto.expiresAt = r.expiresAt.getTime();
  if (r.revokedAt) dto.revokedAt = r.revokedAt.getTime();
  if (r.revokedBy) dto.revokedBy = r.revokedBy;
  return dto;
}

export async function submitTvRequest(db: Db, userId: string, username: string, now = Date.now()): Promise<TvRequest> {
  return db.transaction(async (tx) => {
    const [r] = await tx.insert(s.tradingviewAccessRequests).values({ userId, tradingViewUsername: username, status: 'pending', requestedAt: new Date(now) }).returning();
    if (!r) throw new Error('failed to insert tv request');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: userId, actorRole: 'user', action: 'tradingview.submit', targetType: 'tradingview_access_request', targetId: r.id, after: { status: 'pending', tradingViewUsername: username } }, now));
    return r;
  });
}
export async function listTvByUser(db: Db, userId: string): Promise<TvRequest[]> {
  return db.select().from(s.tradingviewAccessRequests).where(eq(s.tradingviewAccessRequests.userId, userId));
}
export async function listAllTv(db: Db): Promise<TvRequest[]> {
  return db.select().from(s.tradingviewAccessRequests);
}
export async function grantTv(db: Db, requestId: string, adminId: string, now: number, durationMs: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests).set({ status: 'granted', grantedAt: new Date(now), grantedBy: adminId, expiresAt: new Date(now + durationMs) }).where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.grant', targetType: 'tradingview_access_request', targetId: requestId, after: { status: 'granted' } }, now));
  });
}
/** Revoke a request. As of 0002 the actor/time are persisted on the request row (revoked_at/revoked_by)
 *  AND recorded in the in-txn audit row — clearing the Phase-1.7 tradingview-persistence debt.
 *  Phase 2.4: optional reason param added (trailing, so all existing callers still compile). */
export async function revokeTv(db: Db, requestId: string, adminId: string, now = Date.now(), reason?: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests).set({ status: 'revoked', revokedAt: new Date(now), revokedBy: adminId }).where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.revoke', targetType: 'tradingview_access_request', targetId: requestId, after: { status: 'revoked', reason: reason ?? null } }, now));
  });
}
/** Reason recorded on the grant row + revoke audit when the worker sweep auto-revokes an expired grant. */
export const TV_EXPIRED_BY_WORKER_REASON = 'expired_by_worker';

/** 7-day window: GRANTED requests whose expiresAt falls within this horizon are marked 'expiring_soon'
 *  by markExpiringSoon (the warn step before the worker eventually revokes them at expiry). */
export const TV_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Worker sweep: atomically REVOKE every grant whose request is past expiry, then queue an
 * (informational) revoke task. Delegates to atomicRevokeTv with the SYSTEM actor so the grant row
 * (revokedAt/revokeReason) and the profile pointer are stamped — not just the request status — and a
 * tv_access.revoke audit row is written. Terminal status becomes 'revoked' (reason 'expired_by_worker').
 * The tradingview_access_tasks row is still queued: WTC marks revoked, but a human/automation must
 * still remove the user from the TradingView indicator (manual-first). atomicRevokeTv opens its own
 * transaction per row (no outer transaction ⇒ no nested-transaction concern under PGlite/Postgres).
 *
 * Sweeps BOTH 'granted' AND 'expiring_soon' rows past expiry: markExpiringSoon flips near-expiry grants
 * to 'expiring_soon', so this filter MUST include that status or those rows would never be revoked.
 */
export async function sweepTvExpiry(db: Db, now = Date.now()): Promise<{ expired: number; tasksQueued: number }> {
  const due = await db
    .select()
    .from(s.tradingviewAccessRequests)
    .where(and(inArray(s.tradingviewAccessRequests.status, ['granted', 'expiring_soon']), lte(s.tradingviewAccessRequests.expiresAt, new Date(now))));
  let tasksQueued = 0;
  for (const r of due) {
    const revoked = await atomicRevokeTv(db, r.id, { id: null, role: 'system' }, TV_EXPIRED_BY_WORKER_REASON, now, {
      queueExternalRevokeTask: true,
    });
    if (revoked.taskQueued) tasksQueued += 1;
  }
  return { expired: due.length, tasksQueued };
}

/**
 * Repair historical worker-expiry revokes that predate atomic external-task queueing.
 *
 * This intentionally recreates only missing tasks for requests already revoked by the expiry worker
 * (`revokeReason = expired_by_worker`). Manual admin revokes are not repaired because they may not
 * imply an external TradingView removal task.
 */
export async function repairMissingTvRevokeTasks(db: Db, now = Date.now()): Promise<{ repaired: number }> {
  const candidates = await db
    .select({ requestId: s.tradingviewAccessRequests.id })
    .from(s.tradingviewAccessRequests)
    .innerJoin(
      s.tradingviewAccessGrants,
      eq(s.tradingviewAccessGrants.requestId, s.tradingviewAccessRequests.id),
    )
    .where(
      and(
        eq(s.tradingviewAccessRequests.status, 'revoked'),
        eq(s.tradingviewAccessGrants.revokeReason, TV_EXPIRED_BY_WORKER_REASON),
        isNotNull(s.tradingviewAccessGrants.revokedAt),
        lte(s.tradingviewAccessGrants.expiresAt, new Date(now)),
      ),
    );

  let repaired = 0;
  for (const requestId of [...new Set(candidates.map((row) => row.requestId))]) {
    const [existing] = await db
      .select({ id: s.tradingviewAccessTasks.id })
      .from(s.tradingviewAccessTasks)
      .where(and(eq(s.tradingviewAccessTasks.requestId, requestId), eq(s.tradingviewAccessTasks.kind, 'revoke')))
      .limit(1);
    if (existing) continue;
    const inserted = await db
      .insert(s.tradingviewAccessTasks)
      .values({ requestId, kind: 'revoke', done: false })
      .onConflictDoNothing({ target: [s.tradingviewAccessTasks.requestId, s.tradingviewAccessTasks.kind] })
      .returning({ id: s.tradingviewAccessTasks.id });
    if (inserted.length === 0) continue;
    repaired += 1;
  }
  return { repaired };
}

export type TvAccessTaskRow = typeof s.tradingviewAccessTasks.$inferSelect;

/** Admin ops view for manual TradingView-side tasks. These rows are informational by design: WTC
 * updates its own entitlement/request state, then a human marks the external TV action done. */
export async function listTvAccessTasks(db: Db, opts?: { includeDone?: boolean; limit?: number }): Promise<TvAccessTaskRow[]> {
  const base = db.select().from(s.tradingviewAccessTasks);
  const rows = opts?.includeDone
    ? await base.orderBy(desc(s.tradingviewAccessTasks.createdAt)).limit(opts?.limit ?? 100)
    : await base.where(eq(s.tradingviewAccessTasks.done, false)).orderBy(desc(s.tradingviewAccessTasks.createdAt)).limit(opts?.limit ?? 100);
  return rows;
}

/** Mark an external TradingView task complete. Audit-only metadata records the operator; the task
 * table intentionally remains minimal until a real automation adapter exists. */
export async function markTvAccessTaskDone(db: Db, taskId: string, actorUserId: string, now = Date.now()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(s.tradingviewAccessTasks)
      .set({ done: true })
      .where(and(eq(s.tradingviewAccessTasks.id, taskId), eq(s.tradingviewAccessTasks.done, false)))
      .returning();
    if (!row) return false;
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId,
      actorRole: 'admin',
      action: 'tv_access.task_done',
      targetType: 'tradingview_access_task',
      targetId: taskId,
      after: { requestId: row.requestId, kind: row.kind },
    }, now));
    return true;
  });
}

/**
 * Pre-pass (runs BEFORE sweepTvExpiry in the worker tick): mark GRANTED requests whose expiresAt is
 * within the next `windowMs` (default 7 days) as 'expiring_soon', so the 7-day server status is actually
 * written. State progression across ticks: granted → expiring_soon (here) → revoked (sweepTvExpiry).
 *
 * Predicate: status='granted' AND expiresAt IS NOT NULL AND expiresAt > now AND expiresAt <= now+window.
 *   - `expiresAt > now` leaves ALREADY-expired grants for sweepTvExpiry (never marks them expiring_soon).
 *   - `IS NOT NULL` leaves never-expiring admin grants untouched.
 *   - the `status='granted'` predicate makes it idempotent (a second run finds 0 rows) and never touches
 *     pending/revoked/expired/already-expiring_soon rows.
 * No per-row audit: this is an internal informational status bump, not an access change (the user keeps
 * access until the grant actually expires). The durable audit record is the later tv_access.revoke
 * written by atomicRevokeTv. Returns { marked }.
 */
export async function markExpiringSoon(
  db: Db,
  now = Date.now(),
  windowMs = TV_EXPIRING_SOON_WINDOW_MS,
): Promise<{ marked: number }> {
  const windowEnd = new Date(now + windowMs);
  const updated = await db
    .update(s.tradingviewAccessRequests)
    .set({ status: 'expiring_soon' })
    .where(
      and(
        eq(s.tradingviewAccessRequests.status, 'granted'),
        isNotNull(s.tradingviewAccessRequests.expiresAt),
        gt(s.tradingviewAccessRequests.expiresAt, new Date(now)),
        lte(s.tradingviewAccessRequests.expiresAt, windowEnd),
      ),
    )
    .returning({ id: s.tradingviewAccessRequests.id });
  return { marked: updated.length };
}

// ---------------- Education (LMS) ----------------
// Thin Part-E surface: the courses/lessons/materials tables already exist (migration 0000); this adds
// only the repos the current teacher/education UI needs. createCourse audits in-txn. This is NOT the
// full docs/EDUCATION_LMS_PLAN.md contract (no enrollments/lesson_progress/teacher_profiles) — that is
// the Phase 1.8 prompt in docs/EDUCATION_LMS_PLAN.md. Entitlement/ownership gating stays at the route.
export type Course = typeof s.courses.$inferSelect;
export type Lesson = typeof s.lessons.$inferSelect;

export interface CourseDTO {
  id: string;
  ownerTeacherId: string;
  title: string;
  description?: string;
  productCode: string;
  published: boolean;
  createdAt: number;
  // 0005 (Phase 3.1): rich course metadata (NOT NULL DEFAULT in DB → always present).
  level: string; // 'beginner' | 'intermediate' | 'advanced'
  tags: string[];
}
export interface LessonDTO {
  id: string;
  courseId: string;
  title: string;
  body?: string;
  videoUrl?: string;
  order: number;
  published: boolean;
  // 0005 (Phase 3.1): authoritative content type (replaces the deriveContentType videoUrl heuristic).
  contentType: 'video' | 'embed' | 'article' | 'link';
  externalUrl?: string; // companion to contentType === 'link'
  embedHtml?: string; // canonical sanitized iframe HTML only
}
export function rowToCourseDto(r: Course): CourseDTO {
  const dto: CourseDTO = { id: r.id, ownerTeacherId: r.ownerTeacherId, title: r.title, productCode: r.productCode, published: r.published, createdAt: r.createdAt.getTime(), level: r.level, tags: r.tags };
  if (r.description) dto.description = r.description;
  return dto;
}
export function rowToLessonDto(r: Lesson): LessonDTO {
  const dto: LessonDTO = { id: r.id, courseId: r.courseId, title: r.title, order: r.order, published: r.published, contentType: r.contentType as LessonDTO['contentType'] };
  if (r.body) dto.body = r.body;
  if (r.videoUrl) dto.videoUrl = r.videoUrl;
  if (r.externalUrl) dto.externalUrl = r.externalUrl;
  if (r.embedHtml) dto.embedHtml = r.embedHtml;
  return dto;
}

/** Teacher/admin creates a course they own; audited in the same transaction.
 *  Optional `teacherProfileId` links the course to a teacher_profiles row (additive — F-04). */
export async function createCourse(db: Db, input: { ownerTeacherId: string; title: string; description?: string; published?: boolean; teacherProfileId?: string; level?: string; tags?: string[] }, now = Date.now()): Promise<CourseDTO> {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(s.courses)
      .values({
        ownerTeacherId: input.ownerTeacherId,
        title: input.title,
        description: input.description ?? null,
        published: input.published ?? false,
        createdAt: new Date(now),
        ...(input.teacherProfileId ? { teacherProfileId: input.teacherProfileId } : {}),
        ...(input.level ? { level: input.level } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      })
      .returning();
    if (!c) throw new Error('failed to insert course');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.ownerTeacherId, actorRole: 'teacher', action: 'education.course_create', targetType: 'course', targetId: c.id, after: { title: c.title, published: c.published, level: c.level, tags: c.tags } }, now));
    return rowToCourseDto(c);
  });
}
/** Courses a teacher may edit: their own (admins see all). Ownership/visibility mirrors @wtc/lms. */
export async function listCoursesForTeacher(db: Db, ownerTeacherId: string, isAdmin: boolean): Promise<CourseDTO[]> {
  const rows = isAdmin
    ? await db.select().from(s.courses)
    : await db.select().from(s.courses).where(eq(s.courses.ownerTeacherId, ownerTeacherId));
  return rows.map(rowToCourseDto);
}
/** All published courses (student catalogue). Entitlement gating stays at the route. */
export async function listPublishedCourses(db: Db): Promise<CourseDTO[]> {
  return (await db.select().from(s.courses).where(eq(s.courses.published, true))).map(rowToCourseDto);
}
/** Student view: published lessons of a published course, ordered. Fail-closed: no access / unpublished → []. */
export async function listLessonsForStudent(db: Db, courseId: string, hasEducationAccess: boolean): Promise<LessonDTO[]> {
  if (!hasEducationAccess) return [];
  const [c] = await db.select().from(s.courses).where(eq(s.courses.id, courseId)).limit(1);
  if (!c || !c.published) return [];
  const rows = await db.select().from(s.lessons).where(and(eq(s.lessons.courseId, courseId), eq(s.lessons.published, true)));
  return rows.map(rowToLessonDto).sort((a, b) => a.order - b.order);
}

// ---------------- Education (full LMS — Phase 2.2 UI repos on the lean schema) ----------------
// Ownership/entitlement/RBAC are enforced at the route/action (via @wtc/lms guards + @wtc/auth) BEFORE
// these run; the mutations here add the in-txn audit row. Reads enforce per-course/-user scoping.
export type CourseRow = typeof s.courses.$inferSelect;
export type MaterialRow = typeof s.materials.$inferSelect;

export async function getCourseById(db: Db, courseId: string): Promise<CourseRow | null> {
  const [c] = await db.select().from(s.courses).where(eq(s.courses.id, courseId)).limit(1);
  return c ?? null;
}
/** All courses (admin view, any state). */
export async function listAllCourses(db: Db): Promise<CourseRow[]> {
  return db.select().from(s.courses).orderBy(desc(s.courses.createdAt));
}
/** All lessons of a course (teacher/admin editor — includes unpublished), ordered. */
export async function listLessonsForCourse(db: Db, courseId: string): Promise<Lesson[]> {
  const rows = await db.select().from(s.lessons).where(eq(s.lessons.courseId, courseId));
  return rows.sort((a, b) => a.order - b.order);
}
export async function getLessonById(db: Db, lessonId: string): Promise<Lesson | null> {
  const [row] = await db.select().from(s.lessons).where(eq(s.lessons.id, lessonId)).limit(1);
  return row ?? null;
}
export async function getMaterialById(db: Db, materialId: string): Promise<MaterialRow | null> {
  const [row] = await db.select().from(s.materials).where(and(eq(s.materials.id, materialId), isNull(s.materials.deletedAt))).limit(1);
  return row ?? null;
}
/** Counts for the teacher/admin course card. */
export async function getCourseCounts(db: Db, courseId: string): Promise<{ lessonCount: number; publishedLessonCount: number; enrolledCount: number }> {
  const lessons = await db.select({ published: s.lessons.published }).from(s.lessons).where(eq(s.lessons.courseId, courseId));
  const enr = await db.select({ id: s.enrollments.id }).from(s.enrollments).where(eq(s.enrollments.courseId, courseId));
  return { lessonCount: lessons.length, publishedLessonCount: lessons.filter((l) => l.published).length, enrolledCount: enr.length };
}
/** Edit course metadata (title/description). Audits education.course_update. */
export async function updateCourse(db: Db, courseId: string, patch: { title?: string; description?: string | null; level?: string; tags?: string[] }, actorUserId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.courses).set(patch).where(eq(s.courses.id, courseId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.course_update', targetType: 'course', targetId: courseId, after: { ...patch } }, now));
  });
}
/** Publish/unpublish a course. Audits education.course_publish. */
export async function setCoursePublished(db: Db, courseId: string, published: boolean, actorUserId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.courses).set({ published }).where(eq(s.courses.id, courseId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.course_publish', targetType: 'course', targetId: courseId, after: { published } }, now));
  });
}
function assertSafeLessonPayload(input: { contentType?: string; embedHtml?: string | null }): void {
  if (input.contentType === 'embed') {
    if (!isSanitizedLmsEmbedHtml(input.embedHtml)) throw new Error('sanitized embedHtml is required for embed lessons');
    return;
  }
  if (input.embedHtml) throw new Error('embedHtml is only valid for embed lessons');
}

/** Create a lesson (auto next order). Audits education.lesson_create. */
export async function createLesson(db: Db, input: { courseId: string; title: string; body?: string; videoUrl?: string; published?: boolean; contentType?: string; externalUrl?: string; embedHtml?: string | null }, actorUserId: string, now = Date.now()): Promise<Lesson> {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ order: s.lessons.order }).from(s.lessons).where(eq(s.lessons.courseId, input.courseId));
    const nextOrder = existing.reduce((m, r) => Math.max(m, r.order), 0) + 1;
    // contentType defaults to the legacy videoUrl heuristic when a caller omits it (backward-compatible);
    // the new lesson editor passes it explicitly. The DB CHECK constrains it to the allowed set.
    const contentType = input.contentType ?? (input.videoUrl ? 'video' : 'article');
    assertSafeLessonPayload({ contentType, embedHtml: input.embedHtml ?? null });
    const [l] = await tx.insert(s.lessons).values({ courseId: input.courseId, title: input.title, body: input.body ?? null, videoUrl: input.videoUrl ?? null, order: nextOrder, published: input.published ?? false, contentType, externalUrl: input.externalUrl ?? null, embedHtml: contentType === 'embed' ? input.embedHtml ?? null : null }).returning();
    if (!l) throw new Error('failed to insert lesson');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.lesson_create', targetType: 'lesson', targetId: l.id, after: { courseId: input.courseId, title: input.title, contentType, hasEmbedHtml: contentType === 'embed' } }, now));
    return l;
  });
}
/** Edit a lesson (title/body/videoUrl/published/contentType/externalUrl). Audits education.lesson_update. */
function lessonAuditAfter(patch: { title?: string; body?: string | null; videoUrl?: string | null; published?: boolean; contentType?: string; externalUrl?: string | null; embedHtml?: string | null }): Record<string, unknown> {
  const after: Record<string, unknown> = {};
  if (patch.title !== undefined) after.title = patch.title;
  if (patch.published !== undefined) after.published = patch.published;
  if (patch.contentType !== undefined) after.contentType = patch.contentType;
  if (patch.body !== undefined) after.hasBody = Boolean(patch.body);
  if (patch.videoUrl !== undefined) after.hasVideoUrl = Boolean(patch.videoUrl);
  if (patch.externalUrl !== undefined) after.hasExternalUrl = Boolean(patch.externalUrl);
  if (patch.embedHtml !== undefined) after.hasEmbedHtml = Boolean(patch.embedHtml);
  return after;
}
export async function updateLesson(db: Db, lessonId: string, patch: { title?: string; body?: string | null; videoUrl?: string | null; published?: boolean; contentType?: string; externalUrl?: string | null; embedHtml?: string | null }, actorUserId: string, now = Date.now(), expectedCourseId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    assertSafeLessonPayload({ contentType: patch.contentType, embedHtml: patch.embedHtml });
    const where = expectedCourseId ? and(eq(s.lessons.id, lessonId), eq(s.lessons.courseId, expectedCourseId)) : eq(s.lessons.id, lessonId);
    const updated = await tx.update(s.lessons).set(patch).where(where).returning({ id: s.lessons.id });
    if (updated.length === 0) throw new Error('lesson not found for course');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.lesson_update', targetType: 'lesson', targetId: lessonId, after: lessonAuditAfter(patch) }, now));
  });
}
export async function listMaterials(db: Db, lessonId: string): Promise<MaterialRow[]> {
  return db.select().from(s.materials).where(and(eq(s.materials.lessonId, lessonId), isNull(s.materials.deletedAt)));
}

type FileMaterialScanStatus = Exclude<LmsFileScanStatus, 'not_required'>;
type CreateFileMaterialInput = {
  lessonId: string;
  label: string;
  kind: 'file';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
  fileBytesBase64?: string;
  storageProvider?: string;
  storageKey?: string;
  scanStatus?: FileMaterialScanStatus;
  scanCheckedAt?: Date;
  quarantineReason?: string | null;
  retainedUntil?: Date;
  deletedAt?: Date | null;
};

export type CreateMaterialInput =
  | { lessonId: string; label: string; kind: 'link'; url: string }
  | CreateFileMaterialInput
  | { lessonId: string; label: string; kind: 'embed'; embedHtml: string };

function defaultFileRetentionDate(now: number): Date {
  return new Date(now + LMS_DEFAULT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function materialInsertValues(input: CreateMaterialInput, now: number): typeof s.materials.$inferInsert {
  if (input.kind === 'link') {
    if (!input.url) throw new Error('material link url required');
    return { lessonId: input.lessonId, label: input.label, kind: 'link', url: input.url };
  }
  if (input.kind === 'file') {
    const storageProvider = input.storageProvider?.trim() || LMS_LOCAL_STORAGE_PROVIDER;
    const fileBytesBase64 = input.fileBytesBase64?.trim() || null;
    const storageKey = input.storageKey?.trim() || buildLmsStorageKey();
    if (!input.fileName || !input.mimeType || input.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(input.contentSha256)) {
      throw new Error('material file payload invalid');
    }
    if (!isSupportedLmsFileStorageProvider(storageProvider)) throw new Error('material file storage provider unsupported');
    if ((storageProvider === LMS_FILESYSTEM_STORAGE_PROVIDER || storageProvider === LMS_OBJECT_STORAGE_PROVIDER) && !isOpaqueLmsMaterialStorageKey(storageKey)) {
      throw new Error('material file storage key invalid');
    }
    if (storageProvider === LMS_LOCAL_STORAGE_PROVIDER && !fileBytesBase64) throw new Error('material file payload invalid');
    if (storageProvider !== LMS_LOCAL_STORAGE_PROVIDER && fileBytesBase64) throw new Error('material object storage payload must not include db bytes');
    return {
      lessonId: input.lessonId,
      label: input.label,
      kind: 'file',
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      contentSha256: input.contentSha256,
      fileBytesBase64,
      storageProvider,
      storageKey,
      scanStatus: input.scanStatus ?? 'clean',
      scanCheckedAt: input.scanCheckedAt ?? new Date(now),
      quarantineReason: input.quarantineReason ?? null,
      retainedUntil: input.retainedUntil ?? defaultFileRetentionDate(now),
      deletedAt: input.deletedAt ?? null,
    };
  }
  if (!isSanitizedLmsEmbedHtml(input.embedHtml)) throw new Error('sanitized embedHtml is required for embed materials');
  return { lessonId: input.lessonId, label: input.label, kind: 'embed', embedHtml: input.embedHtml };
}

function materialAuditAfter(input: MaterialRow): Record<string, unknown> {
  const base = { lessonId: input.lessonId, label: input.label, kind: input.kind };
  if (input.kind === 'file') {
    return {
      ...base,
      sizeBytes: input.sizeBytes,
      hasContentHash: Boolean(input.contentSha256),
      storageProvider: input.storageProvider,
      hasStorageKey: Boolean(input.storageKey),
      scanStatus: input.scanStatus,
      hasQuarantineReason: Boolean(input.quarantineReason),
      retainedUntil: input.retainedUntil?.getTime() ?? null,
    };
  }
  if (input.kind === 'embed') return { ...base, hasEmbedHtml: true };
  return base;
}

/** Add a link/file/embed material. File bytes are stored base64 in the local DB row; embed HTML must already be canonical sanitized output. */
export async function createMaterial(db: Db, input: CreateMaterialInput, actorUserId: string, now = Date.now(), expectedCourseId?: string): Promise<MaterialRow> {
  return db.transaction(async (tx) => {
    if (expectedCourseId) {
      const [lesson] = await tx.select({ id: s.lessons.id }).from(s.lessons).where(and(eq(s.lessons.id, input.lessonId), eq(s.lessons.courseId, expectedCourseId))).limit(1);
      if (!lesson) throw new Error('lesson not found for course');
    }
    const [m] = await tx.insert(s.materials).values(materialInsertValues(input, now)).returning();
    if (!m) throw new Error('failed to insert material');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.material_upload', targetType: 'material', targetId: m.id, after: materialAuditAfter(m) }, now));
    return m;
  });
}
export async function deleteMaterial(db: Db, materialId: string, actorUserId: string, now = Date.now(), expectedCourseId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    let target: { id: string } | undefined;
    if (expectedCourseId) {
      [target] = await tx
        .select({ id: s.materials.id })
        .from(s.materials)
        .innerJoin(s.lessons, eq(s.materials.lessonId, s.lessons.id))
        .where(and(eq(s.materials.id, materialId), eq(s.lessons.courseId, expectedCourseId), isNull(s.materials.deletedAt)))
        .limit(1);
    } else {
      [target] = await tx
        .select({ id: s.materials.id })
        .from(s.materials)
        .where(and(eq(s.materials.id, materialId), isNull(s.materials.deletedAt)))
        .limit(1);
    }
    if (!target) throw new Error(expectedCourseId ? 'material not found for course' : 'material not found');
    const deletedAt = new Date(now);
    const deleted = await tx.update(s.materials).set({ deletedAt }).where(and(eq(s.materials.id, materialId), isNull(s.materials.deletedAt))).returning({ id: s.materials.id });
    if (deleted.length === 0) throw new Error('material not found');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.material_delete', targetType: 'material', targetId: materialId, after: { deletedAt: deletedAt.getTime() } }, now));
  });
}

export type LmsObjectCleanupTaskReason = 'material_create_pending';
export type LmsObjectCleanupTaskStatus = 'pending' | 'completed' | 'dead_letter';

export interface LmsObjectCleanupTaskCandidate {
  cleanupTaskId: string;
  storageProvider: typeof LMS_OBJECT_STORAGE_PROVIDER;
  storageKey: string;
  reason: LmsObjectCleanupTaskReason;
  attempts: number;
  maxAttempts: number;
}

export interface LmsObjectCleanupOperationalSummary {
  storageProvider: typeof LMS_OBJECT_STORAGE_PROVIDER;
  reason: LmsObjectCleanupTaskReason;
  totalPending: number;
  pendingDue: number;
  pendingScheduled: number;
  deadLettered: number;
  maxAttemptsReached: number;
  deadLetteredUnacknowledged: number;
  deadLetteredAcknowledged: number;
  oldestDeadLetteredAt: Date | null;
  latestDeadLetteredAt: Date | null;
  latestUnacknowledgedDeadLetteredAt: Date | null;
  latestAcknowledgedAt: Date | null;
  latestDeadLetterErrorCode: string | null;
}

function assertLmsObjectCleanupTaskInput(input: { storageProvider: string; storageKey: string; reason: string }): void {
  if (input.storageProvider !== LMS_OBJECT_STORAGE_PROVIDER) throw new Error('lms_object_cleanup_task_invalid');
  if (!isOpaqueLmsMaterialStorageKey(input.storageKey)) throw new Error('lms_object_cleanup_task_invalid');
  if (input.reason !== 'material_create_pending') throw new Error('lms_object_cleanup_task_invalid');
}

function lmsObjectCleanupRetryDelayMs(attempts: number): number {
  const schedule = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];
  return schedule[Math.min(Math.max(attempts - 1, 0), schedule.length - 1)]!;
}

export async function createPendingLmsObjectCleanupTask(
  db: Db,
  input: { storageProvider: typeof LMS_OBJECT_STORAGE_PROVIDER; storageKey: string; reason: LmsObjectCleanupTaskReason; maxAttempts?: number },
  now = Date.now(),
): Promise<{ id: string }> {
  assertLmsObjectCleanupTaskInput(input);
  const maxAttempts = Math.min(Math.max(Math.trunc(input.maxAttempts ?? 10), 1), 50);
  const [task] = await db.insert(s.lmsObjectCleanupTasks).values({
    storageProvider: input.storageProvider,
    storageKey: input.storageKey,
    reason: input.reason,
    status: 'pending',
    attempts: 0,
    maxAttempts,
    runAfter: new Date(now),
    updatedAt: new Date(now),
  }).returning({ id: s.lmsObjectCleanupTasks.id });
  if (!task) throw new Error('lms_object_cleanup_task_create_failed');
  return task;
}

export async function createMaterialAndCompleteLmsObjectCleanupTask(
  db: Db,
  input: CreateMaterialInput,
  cleanupTaskId: string | null,
  actorUserId: string,
  now = Date.now(),
  expectedCourseId?: string,
): Promise<MaterialRow> {
  return db.transaction(async (tx) => {
    if (expectedCourseId) {
      const [lesson] = await tx.select({ id: s.lessons.id }).from(s.lessons).where(and(eq(s.lessons.id, input.lessonId), eq(s.lessons.courseId, expectedCourseId))).limit(1);
      if (!lesson) throw new Error('lesson not found for course');
    }
    const [m] = await tx.insert(s.materials).values(materialInsertValues(input, now)).returning();
    if (!m) throw new Error('failed to insert material');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId, actorRole: 'teacher', action: 'education.material_upload', targetType: 'material', targetId: m.id, after: materialAuditAfter(m) }, now));
    if (cleanupTaskId && input.kind === 'file' && typeof input.storageKey === 'string') {
      await tx
        .update(s.lmsObjectCleanupTasks)
        .set({ status: 'completed', completedAt: new Date(now), updatedAt: new Date(now), lastErrorCode: null })
        .where(and(
          eq(s.lmsObjectCleanupTasks.id, cleanupTaskId),
          eq(s.lmsObjectCleanupTasks.status, 'pending'),
          eq(s.lmsObjectCleanupTasks.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
          eq(s.lmsObjectCleanupTasks.storageKey, input.storageKey),
        ));
    }
    return m as MaterialRow;
  });
}

export async function completeLmsObjectCleanupTasks(db: Db, cleanupTaskIds: string[], now = Date.now()): Promise<{ completed: number }> {
  const ids = [...new Set(cleanupTaskIds)].filter(Boolean);
  if (ids.length === 0) return { completed: 0 };
  return db.transaction(async (tx) => {
    const completed = await tx
      .update(s.lmsObjectCleanupTasks)
      .set({ status: 'completed', completedAt: new Date(now), updatedAt: new Date(now), lastErrorCode: null })
      .where(and(inArray(s.lmsObjectCleanupTasks.id, ids), eq(s.lmsObjectCleanupTasks.status, 'pending')))
      .returning({ id: s.lmsObjectCleanupTasks.id });
    if (completed.length > 0) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: null,
        actorRole: 'system',
        action: 'education.material_cleanup',
        targetType: 'material',
        targetId: null,
        after: {
          cleanupTasksCompleted: completed.length,
          storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
          scope: 'pending_upload_object_cleanup',
          objectDeleteConfirmed: true,
        },
      }, now));
    }
    return { completed: completed.length };
  });
}

export async function completeLmsObjectCleanupTask(db: Db, cleanupTaskId: string, now = Date.now()): Promise<{ completed: boolean }> {
  const result = await completeLmsObjectCleanupTasks(db, [cleanupTaskId], now);
  return { completed: result.completed === 1 };
}

export async function recordLmsObjectCleanupTaskFailure(
  db: Db,
  cleanupTaskId: string,
  now = Date.now(),
  errorCode = 'delete_failed',
): Promise<{ status: LmsObjectCleanupTaskStatus; attempts: number }> {
  const safeErrorCode = /^[a-z0-9_:-]{1,80}$/.test(errorCode) ? errorCode : 'delete_failed';
  return db.transaction(async (tx) => {
    const [task] = await tx
      .select({ attempts: s.lmsObjectCleanupTasks.attempts, maxAttempts: s.lmsObjectCleanupTasks.maxAttempts })
      .from(s.lmsObjectCleanupTasks)
      .where(and(eq(s.lmsObjectCleanupTasks.id, cleanupTaskId), eq(s.lmsObjectCleanupTasks.status, 'pending')))
      .limit(1);
    if (!task) return { status: 'completed' as const, attempts: 0 };
    const attempts = task.attempts + 1;
    const status: LmsObjectCleanupTaskStatus = attempts >= task.maxAttempts ? 'dead_letter' : 'pending';
    const updated = await tx.update(s.lmsObjectCleanupTasks).set({
      attempts,
      status,
      lastErrorCode: safeErrorCode,
      runAfter: new Date(now + lmsObjectCleanupRetryDelayMs(attempts)),
      updatedAt: new Date(now),
    }).where(and(eq(s.lmsObjectCleanupTasks.id, cleanupTaskId), eq(s.lmsObjectCleanupTasks.status, 'pending')))
      .returning({ id: s.lmsObjectCleanupTasks.id });
    if (updated.length === 0) return { status: 'completed' as const, attempts: 0 };
    if (status === 'dead_letter') {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: null,
        actorRole: 'system',
        action: 'education.material_cleanup',
        targetType: 'material',
        targetId: null,
        after: {
          cleanupTasksDeadLettered: 1,
          storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
          scope: 'pending_upload_object_cleanup',
          lastErrorCode: safeErrorCode,
        },
      }, now));
    }
    return { status, attempts };
  });
}

export async function listPendingLmsObjectCleanupTasks(db: Db, now = Date.now(), limit = 50): Promise<LmsObjectCleanupTaskCandidate[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = await db
    .select({
      cleanupTaskId: s.lmsObjectCleanupTasks.id,
      storageProvider: s.lmsObjectCleanupTasks.storageProvider,
      storageKey: s.lmsObjectCleanupTasks.storageKey,
      reason: s.lmsObjectCleanupTasks.reason,
      attempts: s.lmsObjectCleanupTasks.attempts,
      maxAttempts: s.lmsObjectCleanupTasks.maxAttempts,
    })
    .from(s.lmsObjectCleanupTasks)
    .where(and(
      eq(s.lmsObjectCleanupTasks.status, 'pending'),
      eq(s.lmsObjectCleanupTasks.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
      eq(s.lmsObjectCleanupTasks.reason, 'material_create_pending'),
      lte(s.lmsObjectCleanupTasks.runAfter, new Date(now)),
    ))
    .orderBy(s.lmsObjectCleanupTasks.createdAt)
    .limit(boundedLimit);

  return rows.flatMap((row) => {
    if (
      row.storageProvider !== LMS_OBJECT_STORAGE_PROVIDER ||
      row.reason !== 'material_create_pending' ||
      !isOpaqueLmsMaterialStorageKey(row.storageKey)
    ) {
      return [];
    }
    return [{
      cleanupTaskId: row.cleanupTaskId,
      storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
      storageKey: row.storageKey,
      reason: 'material_create_pending',
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
    }];
  });
}

export async function summarizeLmsObjectCleanupOperations(db: Db, now = Date.now()): Promise<LmsObjectCleanupOperationalSummary> {
  const rows = await db
    .select({
      status: s.lmsObjectCleanupTasks.status,
      reason: s.lmsObjectCleanupTasks.reason,
      attempts: s.lmsObjectCleanupTasks.attempts,
      maxAttempts: s.lmsObjectCleanupTasks.maxAttempts,
      runAfter: s.lmsObjectCleanupTasks.runAfter,
      lastErrorCode: s.lmsObjectCleanupTasks.lastErrorCode,
      acknowledgedAt: s.lmsObjectCleanupTasks.acknowledgedAt,
      updatedAt: s.lmsObjectCleanupTasks.updatedAt,
    })
    .from(s.lmsObjectCleanupTasks)
    .where(and(
      eq(s.lmsObjectCleanupTasks.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
      eq(s.lmsObjectCleanupTasks.reason, 'material_create_pending'),
      or(eq(s.lmsObjectCleanupTasks.status, 'pending'), eq(s.lmsObjectCleanupTasks.status, 'dead_letter')),
    ));

  let pendingDue = 0;
  let pendingScheduled = 0;
  let deadLettered = 0;
  let maxAttemptsReached = 0;
  let deadLetteredUnacknowledged = 0;
  let deadLetteredAcknowledged = 0;
  let oldestDeadLetteredAt: Date | null = null;
  let latestDeadLetteredAt: Date | null = null;
  let latestUnacknowledgedDeadLetteredAt: Date | null = null;
  let latestAcknowledgedAt: Date | null = null;
  let latestDeadLetterErrorCode: string | null = null;

  for (const row of rows) {
    if (row.status === 'pending') {
      if (row.runAfter.getTime() <= now) pendingDue += 1;
      else pendingScheduled += 1;
      continue;
    }
    if (row.status !== 'dead_letter') continue;

    deadLettered += 1;
    if (row.attempts >= row.maxAttempts) maxAttemptsReached += 1;
    if (row.acknowledgedAt) {
      deadLetteredAcknowledged += 1;
      if (!latestAcknowledgedAt || row.acknowledgedAt.getTime() > latestAcknowledgedAt.getTime()) latestAcknowledgedAt = row.acknowledgedAt;
    } else {
      deadLetteredUnacknowledged += 1;
      if (!latestUnacknowledgedDeadLetteredAt || row.updatedAt.getTime() > latestUnacknowledgedDeadLetteredAt.getTime()) {
        latestUnacknowledgedDeadLetteredAt = row.updatedAt;
      }
    }
    if (!oldestDeadLetteredAt || row.updatedAt.getTime() < oldestDeadLetteredAt.getTime()) oldestDeadLetteredAt = row.updatedAt;
    if (!latestDeadLetteredAt || row.updatedAt.getTime() > latestDeadLetteredAt.getTime()) {
      latestDeadLetteredAt = row.updatedAt;
      latestDeadLetterErrorCode = row.lastErrorCode ?? null;
    }
  }

  return {
    storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
    reason: 'material_create_pending',
    totalPending: pendingDue + pendingScheduled,
    pendingDue,
    pendingScheduled,
    deadLettered,
    maxAttemptsReached,
    deadLetteredUnacknowledged,
    deadLetteredAcknowledged,
    oldestDeadLetteredAt,
    latestDeadLetteredAt,
    latestUnacknowledgedDeadLetteredAt,
    latestAcknowledgedAt,
    latestDeadLetterErrorCode,
  };
}

function boundedLmsCleanupOperationLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.trunc(limit ?? 25), 1), 100);
}

export async function acknowledgeLmsObjectCleanupDeadLetters(
  db: Db,
  input: { actorUserId: string; expectedCount: number; expectedLatestDeadLetteredAt: number | null; limit?: number },
  now = Date.now(),
): Promise<{ acknowledged: number }> {
  const limit = boundedLmsCleanupOperationLimit(input.limit);
  const candidates = await db
    .select({ id: s.lmsObjectCleanupTasks.id, updatedAt: s.lmsObjectCleanupTasks.updatedAt })
    .from(s.lmsObjectCleanupTasks)
    .where(and(
      eq(s.lmsObjectCleanupTasks.status, 'dead_letter'),
      eq(s.lmsObjectCleanupTasks.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
      eq(s.lmsObjectCleanupTasks.reason, 'material_create_pending'),
      isNull(s.lmsObjectCleanupTasks.acknowledgedAt),
    ))
    .orderBy(s.lmsObjectCleanupTasks.updatedAt)
    .limit(limit);
  const latest = candidates.reduce<Date | null>((acc, row) => {
    if (!acc || row.updatedAt.getTime() > acc.getTime()) return row.updatedAt;
    return acc;
  }, null);
  if (candidates.length !== input.expectedCount || (latest?.getTime() ?? null) !== input.expectedLatestDeadLetteredAt) {
    throw new Error('lms_object_cleanup_cohort_stale');
  }
  const ids = candidates.map((row) => row.id);
  if (ids.length === 0) return { acknowledged: 0 };

  return db.transaction(async (tx) => {
    const acknowledged = await tx
      .update(s.lmsObjectCleanupTasks)
      .set({ acknowledgedAt: new Date(now), acknowledgedBy: input.actorUserId })
      .where(and(
        inArray(s.lmsObjectCleanupTasks.id, ids),
        eq(s.lmsObjectCleanupTasks.status, 'dead_letter'),
        isNull(s.lmsObjectCleanupTasks.acknowledgedAt),
      ))
      .returning({ id: s.lmsObjectCleanupTasks.id });
    if (acknowledged.length > 0) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: input.actorUserId,
        actorRole: 'admin',
        action: 'education.material_cleanup_ack',
        targetType: 'material',
        targetId: null,
        after: {
          cleanupTasksAcknowledged: acknowledged.length,
          storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
          scope: 'pending_upload_object_cleanup',
        },
      }, now));
    }
    return { acknowledged: acknowledged.length };
  });
}

export async function retryAcknowledgedLmsObjectCleanupDeadLetters(
  db: Db,
  input: { actorUserId: string; expectedCount: number; expectedLatestAcknowledgedAt: number | null; limit?: number },
  now = Date.now(),
): Promise<{ retried: number }> {
  const limit = boundedLmsCleanupOperationLimit(input.limit);
  const candidates = await db
    .select({ id: s.lmsObjectCleanupTasks.id, acknowledgedAt: s.lmsObjectCleanupTasks.acknowledgedAt })
    .from(s.lmsObjectCleanupTasks)
    .where(and(
      eq(s.lmsObjectCleanupTasks.status, 'dead_letter'),
      eq(s.lmsObjectCleanupTasks.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
      eq(s.lmsObjectCleanupTasks.reason, 'material_create_pending'),
      isNotNull(s.lmsObjectCleanupTasks.acknowledgedAt),
    ))
    .orderBy(s.lmsObjectCleanupTasks.acknowledgedAt)
    .limit(limit);
  const latest = candidates.reduce<Date | null>((acc, row) => {
    if (!row.acknowledgedAt) return acc;
    if (!acc || row.acknowledgedAt.getTime() > acc.getTime()) return row.acknowledgedAt;
    return acc;
  }, null);
  if (candidates.length !== input.expectedCount || (latest?.getTime() ?? null) !== input.expectedLatestAcknowledgedAt) {
    throw new Error('lms_object_cleanup_cohort_stale');
  }
  const ids = candidates.map((row) => row.id);
  if (ids.length === 0) return { retried: 0 };

  return db.transaction(async (tx) => {
    const retried = await tx
      .update(s.lmsObjectCleanupTasks)
      .set({
        status: 'pending',
        runAfter: new Date(now),
        lastErrorCode: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        updatedAt: new Date(now),
      })
      .where(and(
        inArray(s.lmsObjectCleanupTasks.id, ids),
        eq(s.lmsObjectCleanupTasks.status, 'dead_letter'),
        isNotNull(s.lmsObjectCleanupTasks.acknowledgedAt),
      ))
      .returning({ id: s.lmsObjectCleanupTasks.id });
    if (retried.length > 0) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: input.actorUserId,
        actorRole: 'admin',
        action: 'education.material_cleanup_retry',
        targetType: 'material',
        targetId: null,
        after: {
          cleanupTasksRetried: retried.length,
          storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
          scope: 'pending_upload_object_cleanup',
        },
      }, now));
    }
    return { retried: retried.length };
  });
}

/** Worker cleanup for DB-local LMS file payloads.
 *  The current schema cannot keep a file material row without bytes/checksum metadata, so cleanup
 *  hard-deletes only rows that are already soft-deleted or not clean after their retention window.
 */
export async function purgeExpiredLmsMaterialFiles(db: Db, now = Date.now()): Promise<{ purged: number }> {
  return db.transaction(async (tx) => {
    const cutoff = new Date(now);
    const purged = await tx
      .delete(s.materials)
      .where(
        and(
          eq(s.materials.kind, 'file'),
          eq(s.materials.storageProvider, LMS_LOCAL_STORAGE_PROVIDER),
          like(s.materials.storageKey, `${LMS_STORAGE_KEY_PREFIX}%`),
          lte(s.materials.retainedUntil, cutoff),
          or(
            isNotNull(s.materials.deletedAt),
            inArray(s.materials.scanStatus, ['pending', 'quarantined', 'failed']),
          ),
        ),
      )
      .returning({ id: s.materials.id });
    if (purged.length > 0) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: null,
        actorRole: 'system',
        action: 'education.material_cleanup',
        targetType: 'material',
        targetId: null,
        after: {
          purged: purged.length,
          storageProvider: LMS_LOCAL_STORAGE_PROVIDER,
          cutoff: cutoff.getTime(),
          scope: 'expired_soft_deleted_or_unsafe_file_materials',
        },
      }, now));
    }
    return { purged: purged.length };
  });
}

export interface LmsObjectMaterialCleanupCandidate {
  materialId: string;
  storageProvider: typeof LMS_OBJECT_STORAGE_PROVIDER;
  storageKey: string;
  scanStatus: FileMaterialScanStatus;
  retainedUntil: Date;
  deletedAt: Date | null;
}

/** Select expired S3/R2-backed LMS file rows that are safe to remove after object deletion.
 *  The external object delete happens outside @wtc/db; this function only identifies candidates.
 */
export async function listExpiredLmsObjectMaterialFiles(db: Db, now = Date.now(), limit = 50): Promise<LmsObjectMaterialCleanupCandidate[]> {
  const cutoff = new Date(now);
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const rows = await db
    .select({
      materialId: s.materials.id,
      storageProvider: s.materials.storageProvider,
      storageKey: s.materials.storageKey,
      scanStatus: s.materials.scanStatus,
      retainedUntil: s.materials.retainedUntil,
      deletedAt: s.materials.deletedAt,
    })
    .from(s.materials)
    .where(
      and(
        eq(s.materials.kind, 'file'),
        eq(s.materials.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
        like(s.materials.storageKey, `${LMS_STORAGE_KEY_PREFIX}%`),
        lte(s.materials.retainedUntil, cutoff),
        or(
          isNotNull(s.materials.deletedAt),
          inArray(s.materials.scanStatus, ['pending', 'quarantined', 'failed']),
        ),
      ),
    )
    .limit(boundedLimit);

  return rows.flatMap((row) => {
    if (
      row.storageProvider !== LMS_OBJECT_STORAGE_PROVIDER ||
      !row.storageKey ||
      !isOpaqueLmsMaterialStorageKey(row.storageKey) ||
      !row.retainedUntil ||
      !['pending', 'clean', 'quarantined', 'failed'].includes(row.scanStatus)
    ) {
      return [];
    }
    return [{
      materialId: row.materialId,
      storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
      storageKey: row.storageKey,
      scanStatus: row.scanStatus as FileMaterialScanStatus,
      retainedUntil: row.retainedUntil,
      deletedAt: row.deletedAt,
    }];
  });
}

/** Finalize object cleanup after the worker confirms each external object was deleted or already absent.
 *  Audit payload is count-only and intentionally omits material ids, object keys, filenames, hashes, and reasons.
 */
export async function finalizeLmsObjectMaterialCleanup(db: Db, materialIds: string[], now = Date.now()): Promise<{ purged: number }> {
  const ids = [...new Set(materialIds)].filter(Boolean);
  if (ids.length === 0) return { purged: 0 };
  return db.transaction(async (tx) => {
    const cutoff = new Date(now);
    const purged = await tx
      .delete(s.materials)
      .where(
        and(
          inArray(s.materials.id, ids),
          eq(s.materials.kind, 'file'),
          eq(s.materials.storageProvider, LMS_OBJECT_STORAGE_PROVIDER),
          like(s.materials.storageKey, `${LMS_STORAGE_KEY_PREFIX}%`),
          lte(s.materials.retainedUntil, cutoff),
          or(
            isNotNull(s.materials.deletedAt),
            inArray(s.materials.scanStatus, ['pending', 'quarantined', 'failed']),
          ),
        ),
      )
      .returning({ id: s.materials.id });
    if (purged.length > 0) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: null,
        actorRole: 'system',
        action: 'education.material_cleanup',
        targetType: 'material',
        targetId: null,
        after: {
          purged: purged.length,
          storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
          cutoff: cutoff.getTime(),
          scope: 'expired_soft_deleted_or_unsafe_object_materials',
          objectDeleteConfirmed: true,
        },
      }, now));
    }
    return { purged: purged.length };
  });
}

export interface MaterialFileDownloadRow {
  materialId: string;
  lessonId: string;
  courseId: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
  fileBytesBase64: string | null;
  storageProvider: string;
  storageKey: string;
  scanStatus: FileMaterialScanStatus;
  scanCheckedAt: Date | null;
  quarantineReason: string | null;
  retainedUntil: Date;
}

export async function getMaterialFileForPublishedLesson(db: Db, materialId: string): Promise<MaterialFileDownloadRow | null> {
  const [row] = await db
    .select({
      materialId: s.materials.id,
      lessonId: s.materials.lessonId,
      courseId: s.lessons.courseId,
      label: s.materials.label,
      fileName: s.materials.fileName,
      mimeType: s.materials.mimeType,
      sizeBytes: s.materials.sizeBytes,
      contentSha256: s.materials.contentSha256,
      fileBytesBase64: s.materials.fileBytesBase64,
      storageProvider: s.materials.storageProvider,
      storageKey: s.materials.storageKey,
      scanStatus: s.materials.scanStatus,
      scanCheckedAt: s.materials.scanCheckedAt,
      quarantineReason: s.materials.quarantineReason,
      retainedUntil: s.materials.retainedUntil,
    })
    .from(s.materials)
    .innerJoin(s.lessons, eq(s.materials.lessonId, s.lessons.id))
    .innerJoin(s.courses, eq(s.lessons.courseId, s.courses.id))
    .where(and(eq(s.materials.id, materialId), eq(s.materials.kind, 'file'), eq(s.materials.scanStatus, 'clean'), isNull(s.materials.deletedAt), eq(s.lessons.published, true), eq(s.courses.published, true)))
    .limit(1);
  if (!row || !row.fileName || !row.mimeType || !row.sizeBytes || !row.contentSha256 || !row.storageProvider || !row.storageKey || row.scanStatus !== 'clean' || !row.retainedUntil) return null;
  if (row.storageProvider === LMS_LOCAL_STORAGE_PROVIDER) {
    if (!row.fileBytesBase64) return null;
    const bytes = Buffer.from(row.fileBytesBase64, 'base64');
    if (bytes.byteLength !== row.sizeBytes || sha256HexForBytes(bytes) !== row.contentSha256) return null;
  }
  return {
    materialId: row.materialId,
    lessonId: row.lessonId,
    courseId: row.courseId,
    label: row.label,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentSha256: row.contentSha256,
    fileBytesBase64: row.fileBytesBase64,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    scanStatus: 'clean',
    scanCheckedAt: row.scanCheckedAt,
    quarantineReason: row.quarantineReason,
    retainedUntil: row.retainedUntil,
  };
}

export async function recordMaterialDownloadAudit(db: Db, row: MaterialFileDownloadRow, actorUserId: string, now = Date.now()): Promise<void> {
  await db.insert(s.auditLogs).values(auditRowValues({
    actorUserId,
    actorRole: 'user',
    action: 'education.material_download',
    targetType: 'material',
    targetId: row.materialId,
    after: {
      lessonId: row.lessonId,
      courseId: row.courseId,
      sizeBytes: row.sizeBytes,
      hasContentHash: Boolean(row.contentSha256),
      storageProvider: row.storageProvider,
      scanStatus: row.scanStatus,
      retainedUntil: row.retainedUntil.getTime(),
    },
  }, now));
}

/** Admin: all teacher profiles. */
export async function listTeacherProfiles(db: Db): Promise<TeacherProfileRow[]> {
  return db.select().from(s.teacherProfiles).orderBy(desc(s.teacherProfiles.createdAt));
}
/** Teacher/admin student roster for a course. DATA-MINIMAL: displayName + progress only — NEVER email/userId. */
export async function getCourseStudentList(db: Db, courseId: string): Promise<{ displayName: string; enrolledAt: Date; completedLessons: number; totalLessons: number }[]> {
  const publishedLessons = await db.select({ id: s.lessons.id }).from(s.lessons).where(and(eq(s.lessons.courseId, courseId), eq(s.lessons.published, true)));
  const lessonIds = new Set(publishedLessons.map((l) => l.id));
  const enrollments = await db.select({ userId: s.enrollments.userId, enrolledAt: s.enrollments.enrolledAt }).from(s.enrollments).where(eq(s.enrollments.courseId, courseId));
  const out: { displayName: string; enrolledAt: Date; completedLessons: number; totalLessons: number }[] = [];
  for (const e of enrollments) {
    const [u] = await db.select({ displayName: s.users.displayName }).from(s.users).where(eq(s.users.id, e.userId)).limit(1);
    const prog = await db.select({ lessonId: s.lessonProgress.lessonId }).from(s.lessonProgress).where(and(eq(s.lessonProgress.userId, e.userId), eq(s.lessonProgress.completed, true)));
    const completedLessons = prog.filter((p) => lessonIds.has(p.lessonId)).length;
    out.push({ displayName: u?.displayName ?? 'Student', enrolledAt: e.enrolledAt, completedLessons, totalLessons: lessonIds.size });
  }
  return out;
}

// ---------------- Worker jobs ----------------
/** Persist entitlement time-drift (active → grace → expired) across all rows. */
export async function reconcileAllEntitlements(db: Db, now = Date.now()): Promise<{ changed: number }> {
  const rows = await db.select().from(s.entitlements);
  let changed = 0;
  for (const r of rows) {
    const ent = rowToEntitlement(r);
    const next = reconcileExpiry(ent, now);
    if (next.status !== ent.status) {
      await db.update(s.entitlements).set({ status: next.status, updatedAt: new Date(now) }).where(eq(s.entitlements.id, r.id));
      changed += 1;
    }
  }
  return { changed };
}

export async function recordHealthCheck(db: Db, target: string, status: string, detail?: Record<string, unknown>): Promise<void> {
  await db.insert(s.integrationHealthChecks).values({ target, status, detail: detail ?? null });
}

// ============================================================================
// Migration 0002 repositories (Phase 2.1). Every mutation that needs an audit writes its audit row
// INSIDE the same transaction (mirrors grantProduct). Read functions enforce per-user isolation
// (always WHERE user_id = $userId). Numeric columns are strings in Drizzle (postgres NUMERIC).
// Source of truth: docs/handoffs/20260530-0925-ecosystem-db-architect.md.
// ============================================================================

// ---------------- Bots: instances, config history, snapshots, trades, safety ----------------
export type BotInstanceRow = typeof s.botInstances.$inferSelect;
export type BotConfigVersionRow = typeof s.botConfigVersions.$inferSelect;
export type BotMetricSnapshotRow = typeof s.botMetricSnapshots.$inferSelect;
export type BotPositionSnapshotRow = typeof s.botPositionSnapshots.$inferSelect;
export type BotTradeImportRow = typeof s.botTradeImports.$inferSelect;
export type BotTradeReviewRow = typeof s.botTradeReviews.$inferSelect;
export type BotSafetyEventRow = typeof s.botSafetyEvents.$inferSelect;

export async function getBotInstance(db: Db, id: string): Promise<BotInstanceRow | null> {
  const [row] = await db.select().from(s.botInstances).where(eq(s.botInstances.id, id)).limit(1);
  return row ?? null;
}
export async function listBotInstancesForUser(db: Db, userId: string): Promise<BotInstanceRow[]> {
  return db.select().from(s.botInstances).where(eq(s.botInstances.userId, userId));
}
/** Get-or-create the single bot instance for (user, product). Used by the settings surface so a user
 *  can persist config before any live wiring exists. Never contacts a live bot. */
export async function ensureBotInstance(db: Db, input: { userId: string; productCode: string; exchangeAccountId?: string }): Promise<BotInstanceRow> {
  const [existing] = await db.select().from(s.botInstances).where(and(eq(s.botInstances.userId, input.userId), eq(s.botInstances.productCode, input.productCode))).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(s.botInstances).values({ userId: input.userId, productCode: input.productCode, exchangeAccountId: input.exchangeAccountId ?? null }).returning();
  if (!row) throw new Error('failed to insert bot instance');
  return row;
}

export async function getCurrentBotConfig(db: Db, botInstanceId: string): Promise<typeof s.botConfigs.$inferSelect | null> {
  const [row] = await db.select().from(s.botConfigs).where(eq(s.botConfigs.botInstanceId, botInstanceId)).limit(1);
  return row ?? null;
}
/** Save a bot config: bump version, update current bot_configs, append an immutable bot_config_versions
 *  row, and audit — all in one transaction. WTC DB only; NEVER forwarded to the live bot. */
export async function saveBotConfig(db: Db, input: { botInstanceId: string; config: Record<string, unknown>; changedBy: string; note?: string }, now = Date.now()): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(s.botConfigs).where(eq(s.botConfigs.botInstanceId, input.botInstanceId)).limit(1);
    const version = (cur?.version ?? 0) + 1;
    if (cur) {
      await tx.update(s.botConfigs).set({ version, config: input.config, updatedAt: new Date(now) }).where(eq(s.botConfigs.id, cur.id));
    } else {
      await tx.insert(s.botConfigs).values({ botInstanceId: input.botInstanceId, version, config: input.config, updatedAt: new Date(now) });
    }
    await tx.insert(s.botConfigVersions).values({ botInstanceId: input.botInstanceId, version, configJson: input.config, changedBy: input.changedBy, note: input.note ?? null });
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.changedBy, actorRole: 'user', action: 'bot.config.save', targetType: 'bot_instance', targetId: input.botInstanceId, after: { version } }, now));
    return { version };
  });
}
/** Low-level append (explicit version). Throws 23505 on a duplicate (botInstanceId, version). */
export async function insertBotConfigVersion(db: Db, input: { botInstanceId: string; version: number; configJson: Record<string, unknown>; changedBy?: string; note?: string }): Promise<void> {
  await db.insert(s.botConfigVersions).values({ botInstanceId: input.botInstanceId, version: input.version, configJson: input.configJson, changedBy: input.changedBy ?? null, note: input.note ?? null });
}
export async function listBotConfigVersions(db: Db, botInstanceId: string, limit = 50): Promise<BotConfigVersionRow[]> {
  return db.select().from(s.botConfigVersions).where(eq(s.botConfigVersions.botInstanceId, botInstanceId)).orderBy(desc(s.botConfigVersions.version)).limit(limit);
}

export interface BotMetricSnapshotInput {
  botInstanceId: string; snapshotAt: Date; sourceAdapter: string;
  walletEquityUsd?: string; closedPnlUsd?: string; unrealizedPnlUsd?: string; winRate?: string;
  profitFactor?: string; maxDrawdownPct?: string; currentDrawdownPct?: string; totalFeesUsd?: string;
  totalFundingUsd?: string; openRiskUsd?: string; tradeCount?: number; rawJson?: Record<string, unknown>;
}
export async function insertBotMetricSnapshot(db: Db, input: BotMetricSnapshotInput): Promise<void> {
  await db.insert(s.botMetricSnapshots).values({ ...input, rawJson: input.rawJson ?? null });
}
export async function listBotMetricSnapshots(db: Db, botInstanceId: string, limit = 50): Promise<BotMetricSnapshotRow[]> {
  return db.select().from(s.botMetricSnapshots).where(eq(s.botMetricSnapshots.botInstanceId, botInstanceId)).orderBy(desc(s.botMetricSnapshots.snapshotAt)).limit(limit);
}

export interface BotPositionInput {
  symbol: string; side: string; size: string; entryPrice: string; markPrice?: string;
  unrealizedPnlUsd?: string; leverage?: number; tpPrice?: string; slPrice?: string;
  liquidationPrice?: string; openedAt?: Date;
}
/** Batch insert one position-snapshot epoch. Worker only; never updated. */
export async function insertBotPositionSnapshot(db: Db, input: { botInstanceId: string; snapshotAt: Date; sourceAdapter: string; positions: BotPositionInput[] }): Promise<void> {
  if (input.positions.length === 0) return;
  await db.insert(s.botPositionSnapshots).values(
    input.positions.map((p) => ({ botInstanceId: input.botInstanceId, snapshotAt: input.snapshotAt, sourceAdapter: input.sourceAdapter, ...p, markPrice: p.markPrice ?? null, openedAt: p.openedAt ?? null })),
  );
}
export async function listBotPositionSnapshots(db: Db, botInstanceId: string, limit = 50): Promise<BotPositionSnapshotRow[]> {
  return db.select().from(s.botPositionSnapshots).where(eq(s.botPositionSnapshots.botInstanceId, botInstanceId)).orderBy(desc(s.botPositionSnapshots.snapshotAt)).limit(limit);
}

export interface BotTradeImportInput {
  botInstanceId: string; externalTradeId: string; symbol: string; side: string;
  entryPrice: string; exitPrice: string; size: string; realizedPnlUsd: string;
  feesUsd?: string; fundingPaidUsd?: string; openedAt: Date; closedAt: Date;
  exitReason?: string; sourceAdapter: string; rawJson?: Record<string, unknown>;
}
/** Idempotent import: ON CONFLICT (botInstanceId, externalTradeId, sourceAdapter) DO NOTHING.
 *  Returns {inserted:false} for a duplicate. Audits only on a real insert. */
export async function importBotTrade(db: Db, input: BotTradeImportInput): Promise<{ inserted: boolean }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.botTradeImports)
      .values({ ...input, feesUsd: input.feesUsd ?? '0', fundingPaidUsd: input.fundingPaidUsd ?? '0', exitReason: input.exitReason ?? null, rawJson: input.rawJson ?? null })
      .onConflictDoNothing()
      .returning({ id: s.botTradeImports.id });
    if (row) await tx.insert(s.auditLogs).values(auditRowValues({ actorRole: 'system', action: 'bot.trade_imported', targetType: 'bot_instance', targetId: input.botInstanceId, after: { externalTradeId: input.externalTradeId, sourceAdapter: input.sourceAdapter } }));
    return { inserted: !!row };
  });
}
export async function listBotTradeImports(db: Db, botInstanceId: string, opts?: { limit?: number }): Promise<BotTradeImportRow[]> {
  return db.select().from(s.botTradeImports).where(eq(s.botTradeImports.botInstanceId, botInstanceId)).orderBy(desc(s.botTradeImports.closedAt)).limit(opts?.limit ?? 100);
}

export type BotTradeReviewStatus = 'unreviewed' | 'reviewed' | 'flagged' | 'ignored';
export interface BotTradeReviewInput {
  botInstanceId: string;
  externalTradeId: string;
  sourceAdapter: string;
  reviewStatus: BotTradeReviewStatus;
  tags?: string[];
  setup?: string | null;
  mistake?: string | null;
  notes?: string | null;
  rMultiple?: string | null;
  maePct?: string | null;
  mfePct?: string | null;
  actorUserId: string;
}

export async function listBotTradeReviews(db: Db, botInstanceId: string): Promise<BotTradeReviewRow[]> {
  return db.select().from(s.botTradeReviews).where(eq(s.botTradeReviews.botInstanceId, botInstanceId)).orderBy(desc(s.botTradeReviews.updatedAt));
}

/** Upsert the editable WTC trade-review layer. Imported trades remain immutable; only this overlay
 *  changes. The review row and audit row are written in one transaction. */
export async function upsertBotTradeReview(db: Db, input: BotTradeReviewInput, now = Date.now()): Promise<BotTradeReviewRow> {
  return db.transaction(async (tx) => {
    const [prior] = await tx
      .select()
      .from(s.botTradeReviews)
      .where(and(
        eq(s.botTradeReviews.botInstanceId, input.botInstanceId),
        eq(s.botTradeReviews.externalTradeId, input.externalTradeId),
        eq(s.botTradeReviews.sourceAdapter, input.sourceAdapter),
      ))
      .limit(1);
    const values = {
      botInstanceId: input.botInstanceId,
      externalTradeId: input.externalTradeId,
      sourceAdapter: input.sourceAdapter,
      reviewStatus: input.reviewStatus,
      tags: input.tags ?? [],
      setup: input.setup ?? null,
      mistake: input.mistake ?? null,
      notes: input.notes ?? null,
      rMultiple: input.rMultiple ?? null,
      maePct: input.maePct ?? null,
      mfePct: input.mfePct ?? null,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
      updatedAt: new Date(now),
    };
    const [row] = await tx
      .insert(s.botTradeReviews)
      .values(values)
      .onConflictDoUpdate({
        target: [s.botTradeReviews.botInstanceId, s.botTradeReviews.externalTradeId, s.botTradeReviews.sourceAdapter],
        set: { ...values, createdBy: prior?.createdBy ?? input.actorUserId },
      })
      .returning();
    if (!row) throw new Error('failed to upsert bot trade review');
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.actorUserId,
      actorRole: 'user',
      action: 'bot.trade_review.save',
      targetType: 'bot_trade_review',
      targetId: `${input.botInstanceId}:${input.sourceAdapter}:${input.externalTradeId}`,
      before: prior ? { reviewStatus: prior.reviewStatus, tags: prior.tags } : null,
      after: { reviewStatus: row.reviewStatus, tags: row.tags, hasNotes: !!row.notes },
    }, now));
    return row;
  });
}

export interface BotSafetyEventInput {
  botInstanceId: string; eventCode: string; severity: 'info' | 'warning' | 'critical';
  symbol?: string; description: string; metadata?: Record<string, unknown>; observedAt?: Date;
}
/** Insert a risk-signal event. `critical` severity writes an in-txn audit row (it is an operational
 *  signal that must be traceable); info/warning are surfaced in the UI but not audited per-event. */
export async function insertBotSafetyEvent(db: Db, input: BotSafetyEventInput, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(s.botSafetyEvents).values({ botInstanceId: input.botInstanceId, eventCode: input.eventCode, severity: input.severity, symbol: input.symbol ?? null, description: input.description, metadata: input.metadata ?? null, observedAt: input.observedAt ?? new Date(now) });
    if (input.severity === 'critical') {
      await tx.insert(s.auditLogs).values(auditRowValues({ actorRole: 'system', action: 'bot.safety_event', targetType: 'bot_instance', targetId: input.botInstanceId, after: { eventCode: input.eventCode, severity: input.severity } }, now));
    }
  });
}
export async function listBotSafetyEvents(db: Db, botInstanceId: string, opts?: { unacknowledgedOnly?: boolean }): Promise<BotSafetyEventRow[]> {
  const where = opts?.unacknowledgedOnly
    ? and(eq(s.botSafetyEvents.botInstanceId, botInstanceId), isNull(s.botSafetyEvents.acknowledgedAt))
    : eq(s.botSafetyEvents.botInstanceId, botInstanceId);
  return db.select().from(s.botSafetyEvents).where(where).orderBy(desc(s.botSafetyEvents.observedAt));
}
export async function acknowledgeBotSafetyEvent(db: Db, eventId: string, adminId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.botSafetyEvents).set({ acknowledgedAt: new Date(now), acknowledgedBy: adminId }).where(eq(s.botSafetyEvents.id, eventId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'bot.safety_event_ack', targetType: 'bot_safety_event', targetId: eventId }, now));
  });
}

// ---------------- Education: teacher profiles, enrollments, progress, pinned links ----------------
export type TeacherProfileRow = typeof s.teacherProfiles.$inferSelect;
export type EnrollmentRow = typeof s.enrollments.$inferSelect;
export type LessonProgressRow = typeof s.lessonProgress.$inferSelect;
export type PinnedLinkRow = typeof s.pinnedLinks.$inferSelect;

export async function createTeacherProfile(db: Db, input: { userId: string; displayName: string; bio?: string; avatarUrl?: string; socialLinks?: Record<string, string> }, now = Date.now()): Promise<TeacherProfileRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(s.teacherProfiles).values({ userId: input.userId, displayName: input.displayName, bio: input.bio ?? null, avatarUrl: input.avatarUrl ?? null, socialLinks: input.socialLinks ?? {} }).returning();
    if (!row) throw new Error('failed to insert teacher profile');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'teacher', action: 'education.teacher_profile_create', targetType: 'teacher_profile', targetId: row.id, after: { displayName: input.displayName } }, now));
    return row;
  });
}
export async function getTeacherProfile(db: Db, userId: string): Promise<TeacherProfileRow | null> {
  const [row] = await db.select().from(s.teacherProfiles).where(eq(s.teacherProfiles.userId, userId)).limit(1);
  return row ?? null;
}
export async function updateTeacherProfile(db: Db, teacherProfileId: string, input: Partial<{ displayName: string; bio: string; avatarUrl: string; socialLinks: Record<string, string>; isActive: boolean }>, actorId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.teacherProfiles).set({ ...input, updatedAt: new Date(now) }).where(eq(s.teacherProfiles.id, teacherProfileId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: actorId, actorRole: 'teacher', action: 'education.teacher_profile_update', targetType: 'teacher_profile', targetId: teacherProfileId }, now));
  });
}

/** Idempotent enrollment: ON CONFLICT (user_id, course_id) DO NOTHING. Returns the existing row on a
 *  re-enroll. Audits `education.enrolled` only on a real insert (first enrollment).
 *  Optional `actorUserId` lets an admin manual-enroll record themselves as the audit actor while
 *  self-enroll continues to use input.userId as the actor (F-02). */
export async function upsertEnrollment(db: Db, input: { userId: string; courseId: string; entitlementId?: string }, now = Date.now(), actorUserId?: string): Promise<EnrollmentRow> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(s.enrollments).values({ userId: input.userId, courseId: input.courseId, entitlementId: input.entitlementId ?? null }).onConflictDoNothing().returning();
    if (inserted) {
      // Use actorUserId (admin actor) when provided; fall back to the enrolled user's own id.
      const auditActor = actorUserId ?? input.userId;
      await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: auditActor, actorRole: actorUserId ? 'admin' : 'user', action: 'education.enrolled', targetType: 'enrollment', targetId: inserted.id, after: { courseId: input.courseId } }, now));
      return inserted;
    }
    const [existing] = await tx.select().from(s.enrollments).where(and(eq(s.enrollments.userId, input.userId), eq(s.enrollments.courseId, input.courseId))).limit(1);
    if (!existing) throw new Error('enrollment upsert race: row missing after conflict');
    return existing;
  });
}
export async function listEnrollments(db: Db, userId: string): Promise<EnrollmentRow[]> {
  return db.select().from(s.enrollments).where(eq(s.enrollments.userId, userId));
}
export async function markEnrollmentComplete(db: Db, userId: string, courseId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.enrollments).set({ completedAt: new Date(now) }).where(and(eq(s.enrollments.userId, userId), eq(s.enrollments.courseId, courseId)));
    // F-03: SELECT the enrollment row inside the SAME transaction so the audit targetId is the
    // enrollment row's own id (semantically correct) rather than the courseId.
    // If the enrollment is not found (edge case: mark called before enroll), fall back to courseId
    // for graceful degradation — no row is silently dropped.
    const [enrollment] = await tx.select({ id: s.enrollments.id }).from(s.enrollments).where(and(eq(s.enrollments.userId, userId), eq(s.enrollments.courseId, courseId))).limit(1);
    const auditTargetId = enrollment?.id ?? courseId;
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: userId, actorRole: 'user', action: 'education.course_completed', targetType: 'enrollment', targetId: auditTargetId, after: { courseId } }, now));
  });
}

/** UPSERT per (user, lesson). High-frequency — no per-call audit. */
export async function upsertLessonProgress(db: Db, input: { userId: string; lessonId: string; percentComplete: string; completed: boolean }, now = Date.now()): Promise<void> {
  await db
    .insert(s.lessonProgress)
    .values({ userId: input.userId, lessonId: input.lessonId, percentComplete: input.percentComplete, completed: input.completed, lastAccessedAt: new Date(now), updatedAt: new Date(now) })
    .onConflictDoUpdate({ target: [s.lessonProgress.userId, s.lessonProgress.lessonId], set: { percentComplete: input.percentComplete, completed: input.completed, lastAccessedAt: new Date(now), updatedAt: new Date(now) } });
}
export async function getLessonProgress(db: Db, userId: string, lessonId: string): Promise<LessonProgressRow | null> {
  const [row] = await db.select().from(s.lessonProgress).where(and(eq(s.lessonProgress.userId, userId), eq(s.lessonProgress.lessonId, lessonId))).limit(1);
  return row ?? null;
}
export async function listCourseProgress(db: Db, userId: string, courseId: string): Promise<LessonProgressRow[]> {
  // Per-user isolation: only this user's progress rows, scoped to lessons of the given course.
  const lessonRows = await db.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.courseId, courseId));
  const ids = new Set(lessonRows.map((l) => l.id));
  const rows = await db.select().from(s.lessonProgress).where(eq(s.lessonProgress.userId, userId));
  return rows.filter((r) => ids.has(r.lessonId));
}

export async function createPinnedLink(db: Db, input: { ownerType: 'teacher_profile' | 'course'; ownerId: string; label: string; url: string; iconType?: string; sortOrder?: number; createdBy?: string }, now = Date.now()): Promise<PinnedLinkRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(s.pinnedLinks).values({ ownerType: input.ownerType, ownerId: input.ownerId, label: input.label, url: input.url, iconType: input.iconType ?? null, sortOrder: input.sortOrder ?? 0, createdBy: input.createdBy ?? null }).returning();
    if (!row) throw new Error('failed to insert pinned link');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.createdBy ?? null, actorRole: 'teacher', action: 'education.pinned_link_create', targetType: 'pinned_link', targetId: row.id, after: { label: input.label, ownerType: input.ownerType } }, now));
    return row;
  });
}
export async function listPinnedLinks(db: Db, ownerType: string, ownerId: string): Promise<PinnedLinkRow[]> {
  return db.select().from(s.pinnedLinks).where(and(eq(s.pinnedLinks.ownerType, ownerType), eq(s.pinnedLinks.ownerId, ownerId), eq(s.pinnedLinks.isActive, true))).orderBy(s.pinnedLinks.sortOrder);
}
/** Soft-delete (is_active=false) — never hard-delete, so history survives. */
export async function deletePinnedLink(db: Db, linkId: string, actorId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.pinnedLinks).set({ isActive: false }).where(eq(s.pinnedLinks.id, linkId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: actorId, actorRole: 'teacher', action: 'education.pinned_link_delete', targetType: 'pinned_link', targetId: linkId }, now));
  });
}

// ---------------- TradingView: profiles + grants (manual queue stays default) ----------------
export type TvProfileRow = typeof s.tradingviewProfiles.$inferSelect;
export type TvGrantRow = typeof s.tradingviewAccessGrants.$inferSelect;

export async function upsertTradingViewProfile(db: Db, input: { userId: string; tvUsername: string }, now = Date.now()): Promise<TvProfileRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.tradingviewProfiles)
      .values({ userId: input.userId, tvUsername: input.tvUsername })
      .onConflictDoUpdate({ target: s.tradingviewProfiles.userId, set: { tvUsername: input.tvUsername, updatedAt: new Date(now) } })
      .returning();
    if (!row) throw new Error('failed to upsert tradingview profile');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'user', action: 'tv_access.profile_update', targetType: 'tradingview_profile', targetId: row.id, after: { tvUsername: input.tvUsername } }, now));
    return row;
  });
}
export async function getTvProfile(db: Db, userId: string): Promise<TvProfileRow | null> {
  const [row] = await db.select().from(s.tradingviewProfiles).where(eq(s.tradingviewProfiles.userId, userId)).limit(1);
  return row ?? null;
}
/** Create a grant (two-step: insert grant → RETURNING id → upsert profile.current_grant_id). */
export async function createTvGrant(db: Db, input: { requestId: string; userId: string; tvUsername: string; grantedAt: Date; expiresAt?: Date; grantedBy?: string; grantedByType: string }, now = Date.now()): Promise<TvGrantRow> {
  return db.transaction(async (tx) => {
    const [grant] = await tx.insert(s.tradingviewAccessGrants).values({ requestId: input.requestId, userId: input.userId, tvUsername: input.tvUsername, grantedAt: input.grantedAt, expiresAt: input.expiresAt ?? null, grantedBy: input.grantedBy ?? null, grantedByType: input.grantedByType }).returning();
    if (!grant) throw new Error('failed to insert tv grant');
    await tx
      .insert(s.tradingviewProfiles)
      .values({ userId: input.userId, tvUsername: input.tvUsername, currentGrantId: grant.id })
      .onConflictDoUpdate({ target: s.tradingviewProfiles.userId, set: { tvUsername: input.tvUsername, currentGrantId: grant.id, updatedAt: new Date(now) } });
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.grantedBy ?? null, actorRole: 'admin', action: 'tv_access.grant', targetType: 'tradingview_access_grant', targetId: grant.id, after: { tvUsername: input.tvUsername } }, now));
    return grant;
  });
}
/** Revoke a grant: stamp grant + request revoke metadata, null the profile pointer, audit — one txn. */
export async function revokeTvGrant(db: Db, grantId: string, adminId: string, reason?: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    const [grant] = await tx.select().from(s.tradingviewAccessGrants).where(eq(s.tradingviewAccessGrants.id, grantId)).limit(1);
    if (!grant) return;
    await tx.update(s.tradingviewAccessGrants).set({ revokedAt: new Date(now), revokedBy: adminId, revokeReason: reason ?? null }).where(eq(s.tradingviewAccessGrants.id, grantId));
    await tx.update(s.tradingviewAccessRequests).set({ status: 'revoked', revokedAt: new Date(now), revokedBy: adminId }).where(eq(s.tradingviewAccessRequests.id, grant.requestId));
    await tx.update(s.tradingviewProfiles).set({ currentGrantId: null, updatedAt: new Date(now) }).where(and(eq(s.tradingviewProfiles.userId, grant.userId), eq(s.tradingviewProfiles.currentGrantId, grantId)));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'tv_access.revoke', targetType: 'tradingview_access_grant', targetId: grantId, after: { status: 'revoked', reason: reason ?? null } }, now));
  });
}
export async function listTvGrantsForUser(db: Db, userId: string): Promise<TvGrantRow[]> {
  return db.select().from(s.tradingviewAccessGrants).where(eq(s.tradingviewAccessGrants.userId, userId)).orderBy(desc(s.tradingviewAccessGrants.grantedAt));
}
export async function listAllTvGrants(db: Db, opts?: { activeOnly?: boolean }): Promise<TvGrantRow[]> {
  if (opts?.activeOnly) return db.select().from(s.tradingviewAccessGrants).where(isNull(s.tradingviewAccessGrants.revokedAt)).orderBy(desc(s.tradingviewAccessGrants.grantedAt));
  return db.select().from(s.tradingviewAccessGrants).orderBy(desc(s.tradingviewAccessGrants.grantedAt));
}

// ---------------- Products: access-event log (also written inside grant/revoke) ----------------
export type ProductAccessEventRow = typeof s.productAccessEvents.$inferSelect;
export async function listProductAccessEvents(db: Db, userId: string, opts?: { productCode?: string; limit?: number }): Promise<ProductAccessEventRow[]> {
  const where = opts?.productCode
    ? and(eq(s.productAccessEvents.userId, userId), eq(s.productAccessEvents.productCode, opts.productCode))
    : eq(s.productAccessEvents.userId, userId);
  return db.select().from(s.productAccessEvents).where(where).orderBy(desc(s.productAccessEvents.createdAt)).limit(opts?.limit ?? 100);
}

// ---------------- Axioma account-link OTC lifecycle ----------------
export type AxiomaAccountLinkRow = typeof s.axiomaAccountLinks.$inferSelect;

export interface IssueAxiomaAccountLinkNonceInput {
  userId: string;
  linkNonceHash: string;
  codeExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  entitlementVerified: boolean;
}

export type ConsumeAxiomaAccountLinkNonceReason =
  | 'not_found'
  | 'already_consumed'
  | 'revoked'
  | 'expired'
  | 'already_linked'
  | 'axioma_user_already_linked'
  | 'invalid_axioma_user_id';

export type ConsumeAxiomaAccountLinkNonceResult =
  | { consumed: true; row: AxiomaAccountLinkRow }
  | { consumed: false; reason: ConsumeAxiomaAccountLinkNonceReason; row: AxiomaAccountLinkRow | null };

export type AxiomaAccountLinkCompleteFailureReason =
  | ConsumeAxiomaAccountLinkNonceReason
  | 'entitlement_denied';

function accountLinkConsumeReason(
  row: AxiomaAccountLinkRow | null,
  now: number,
): ConsumeAxiomaAccountLinkNonceReason {
  if (!row) return 'not_found';
  if (row.consumedAt || row.state === 'linked') return 'already_consumed';
  if (row.revokedAt || row.state === 'revoked') return 'revoked';
  if (!row.codeExpiresAt || row.codeExpiresAt.getTime() <= now || row.state === 'expired') return 'expired';
  return 'not_found';
}

function assertSha256Hex(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
  }
}

export async function issueAxiomaAccountLinkNonceWithAudit(
  db: Db,
  input: IssueAxiomaAccountLinkNonceInput,
  now = Date.now(),
): Promise<AxiomaAccountLinkRow> {
  assertSha256Hex(input.linkNonceHash, 'linkNonceHash');
  const issuedAt = new Date(now);
  return db.transaction(async (tx) => {
    const revokedPending = await tx
      .update(s.axiomaAccountLinks)
      .set({ state: 'revoked', revokedAt: issuedAt, updatedAt: issuedAt })
      .where(and(
        eq(s.axiomaAccountLinks.userId, input.userId),
        eq(s.axiomaAccountLinks.state, 'pending'),
        isNull(s.axiomaAccountLinks.consumedAt),
        isNull(s.axiomaAccountLinks.revokedAt),
      ))
      .returning({ id: s.axiomaAccountLinks.id });

    const [row] = await tx
      .insert(s.axiomaAccountLinks)
      .values({
        userId: input.userId,
        state: 'pending',
        linkNonceHash: input.linkNonceHash,
        codeExpiresAt: input.codeExpiresAt,
        updatedAt: issuedAt,
      })
      .returning();
    if (!row) throw new Error('failed to issue axioma account-link nonce');

    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.userId,
      actorRole: 'user',
      action: 'axioma.account_link_init',
      targetType: 'axioma_account_link',
      targetId: row.id,
      ip: input.ipAddress,
      userAgent: input.userAgent,
      after: {
        state: 'pending',
        expiresAt: input.codeExpiresAt.toISOString(),
        revokedPendingCount: revokedPending.length,
        entitlementVerified: input.entitlementVerified,
      },
    }, now));
    return row;
  });
}

export async function consumeAxiomaAccountLinkNonceWithAudit(
  db: Db,
  input: { linkNonceHash: string; axiomaUserId: string; ipAddress?: string; userAgent?: string },
  now = Date.now(),
): Promise<ConsumeAxiomaAccountLinkNonceResult> {
  const consumedAt = new Date(now);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(s.axiomaAccountLinks)
      .where(eq(s.axiomaAccountLinks.linkNonceHash, input.linkNonceHash))
      .limit(1);

    async function fail(reason: ConsumeAxiomaAccountLinkNonceReason, row: AxiomaAccountLinkRow | null) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: row?.userId ?? null,
        actorRole: 'system',
        action: 'axioma.account_link_complete',
        targetType: 'axioma_account_link',
        targetId: row?.id ?? null,
        ip: input.ipAddress,
        userAgent: input.userAgent,
        result: 'failure',
        after: { reason },
      }, now));
      return { consumed: false as const, reason, row };
    }

    const initialReason = accountLinkConsumeReason(existing ?? null, now);
    if (initialReason !== 'not_found') return fail(initialReason, existing ?? null);
    if (!existing) return fail('not_found', null);

    const [activeForUser] = await tx
      .select({ id: s.axiomaAccountLinks.id })
      .from(s.axiomaAccountLinks)
      .where(and(
        eq(s.axiomaAccountLinks.userId, existing.userId),
        eq(s.axiomaAccountLinks.state, 'linked'),
        isNull(s.axiomaAccountLinks.revokedAt),
      ))
      .limit(1);
    if (activeForUser) return fail('already_linked', existing);

    const normalizedAxiomaUserId = input.axiomaUserId.trim();
    if (!normalizedAxiomaUserId) return fail('invalid_axioma_user_id', existing);

    const [activeForAxiomaUser] = await tx
      .select({ id: s.axiomaAccountLinks.id })
      .from(s.axiomaAccountLinks)
      .where(and(
        eq(s.axiomaAccountLinks.axiomaUserId, normalizedAxiomaUserId),
        eq(s.axiomaAccountLinks.state, 'linked'),
        isNull(s.axiomaAccountLinks.revokedAt),
      ))
      .limit(1);
    if (activeForAxiomaUser) return fail('axioma_user_already_linked', existing);

    const [row] = await tx
      .update(s.axiomaAccountLinks)
      .set({
        state: 'linked',
        axiomaUserId: normalizedAxiomaUserId,
        consumedAt,
        linkedAt: consumedAt,
        lastVerifiedAt: consumedAt,
        updatedAt: consumedAt,
      })
      .where(and(
        eq(s.axiomaAccountLinks.id, existing.id),
        eq(s.axiomaAccountLinks.linkNonceHash, input.linkNonceHash),
        eq(s.axiomaAccountLinks.state, 'pending'),
        isNull(s.axiomaAccountLinks.consumedAt),
        isNull(s.axiomaAccountLinks.revokedAt),
        gt(s.axiomaAccountLinks.codeExpiresAt, consumedAt),
      ))
      .returning();
    if (!row) return fail('expired', existing);

    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: row.userId,
      actorRole: 'system',
      action: 'axioma.account_link_complete',
      targetType: 'axioma_account_link',
      targetId: row.id,
      ip: input.ipAddress,
      userAgent: input.userAgent,
      after: {
        state: 'linked',
        axiomaUserId: row.axiomaUserId,
      },
    }, now));
    return { consumed: true, row };
  });
}

export async function getAxiomaAccountLinkByNonceHash(
  db: Db,
  linkNonceHash: string,
): Promise<AxiomaAccountLinkRow | null> {
  assertSha256Hex(linkNonceHash, 'linkNonceHash');
  const [row] = await db
    .select()
    .from(s.axiomaAccountLinks)
    .where(eq(s.axiomaAccountLinks.linkNonceHash, linkNonceHash))
    .limit(1);
  return row ?? null;
}

export async function recordAxiomaAccountLinkCompleteFailureWithAudit(
  db: Db,
  input: {
    row: AxiomaAccountLinkRow | null;
    reason: AxiomaAccountLinkCompleteFailureReason;
    ipAddress?: string;
    userAgent?: string;
  },
  now = Date.now(),
): Promise<void> {
  await db.insert(s.auditLogs).values(auditRowValues({
    actorUserId: input.row?.userId ?? null,
    actorRole: 'system',
    action: 'axioma.account_link_complete',
    targetType: 'axioma_account_link',
    targetId: input.row?.id ?? null,
    ip: input.ipAddress,
    userAgent: input.userAgent,
    result: 'failure',
    after: { reason: input.reason },
  }, now));
}

export async function getLinkedAxiomaAccountForUser(
  db: Db,
  userId: string,
): Promise<Pick<AxiomaAccountLinkRow, 'id' | 'userId' | 'axiomaUserId' | 'linkedAt' | 'lastVerifiedAt'> | null> {
  const [row] = await db
    .select({
      id: s.axiomaAccountLinks.id,
      userId: s.axiomaAccountLinks.userId,
      axiomaUserId: s.axiomaAccountLinks.axiomaUserId,
      linkedAt: s.axiomaAccountLinks.linkedAt,
      lastVerifiedAt: s.axiomaAccountLinks.lastVerifiedAt,
    })
    .from(s.axiomaAccountLinks)
    .where(and(
      eq(s.axiomaAccountLinks.userId, userId),
      eq(s.axiomaAccountLinks.state, 'linked'),
      isNull(s.axiomaAccountLinks.revokedAt),
      isNotNull(s.axiomaAccountLinks.axiomaUserId),
    ))
    .orderBy(desc(s.axiomaAccountLinks.linkedAt), desc(s.axiomaAccountLinks.createdAt))
    .limit(1);
  return row ?? null;
}

export async function revokeAxiomaAccountLinksForUserWithAudit(
  db: Db,
  input: { userId: string; actorRole?: string; reason?: string; ipAddress?: string; userAgent?: string },
  now = Date.now(),
): Promise<{ revokedCount: number; rows: AxiomaAccountLinkRow[] }> {
  const revokedAt = new Date(now);
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(s.axiomaAccountLinks)
      .set({ state: 'revoked', revokedAt, updatedAt: revokedAt })
      .where(and(
        eq(s.axiomaAccountLinks.userId, input.userId),
        inArray(s.axiomaAccountLinks.state, ['pending', 'linked']),
        isNull(s.axiomaAccountLinks.revokedAt),
      ))
      .returning();

    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.userId,
      actorRole: input.actorRole ?? 'user',
      action: 'axioma.account_link_revoke',
      targetType: 'axioma_account_link',
      targetId: rows[0]?.id ?? null,
      ip: input.ipAddress,
      userAgent: input.userAgent,
      result: rows.length > 0 ? 'success' : 'failure',
      after: {
        revokedCount: rows.length,
        reason: input.reason ?? 'user_request',
      },
    }, now));
    return { revokedCount: rows.length, rows };
  });
}

// ---------------- Axioma / Terminal: release cache, download + license events ----------------
export type TerminalReleaseRow = typeof s.terminalReleaseCache.$inferSelect;
export interface TerminalReleaseInput {
  version: string; channel: string; platform: string; publishedAt: Date;
  releaseNotesMarkdown?: string; downloadUrlTemplate?: string; checksumSha256?: string;
  minSupportedVersion?: string; isCurrent?: boolean;
  actorUserId?: string;
}
/** Upsert a release. If isCurrent, demote any prior current row in the same channel+platform first. */
export async function upsertTerminalRelease(db: Db, input: TerminalReleaseInput): Promise<TerminalReleaseRow> {
  return db.transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.update(s.terminalReleaseCache).set({ isCurrent: false }).where(and(eq(s.terminalReleaseCache.channel, input.channel), eq(s.terminalReleaseCache.platform, input.platform)));
    }
    const [row] = await tx
      .insert(s.terminalReleaseCache)
      .values({
        version: input.version,
        channel: input.channel,
        platform: input.platform,
        publishedAt: input.publishedAt,
        isCurrent: input.isCurrent ?? false,
        releaseNotesMarkdown: input.releaseNotesMarkdown ?? null,
        downloadUrlTemplate: input.downloadUrlTemplate ?? null,
        checksumSha256: input.checksumSha256 ?? null,
        minSupportedVersion: input.minSupportedVersion ?? null,
      })
      .onConflictDoUpdate({
        target: [s.terminalReleaseCache.version, s.terminalReleaseCache.channel, s.terminalReleaseCache.platform],
        set: {
          publishedAt: input.publishedAt,
          isCurrent: input.isCurrent ?? false,
          releaseNotesMarkdown: input.releaseNotesMarkdown ?? null,
          downloadUrlTemplate: input.downloadUrlTemplate ?? null,
          checksumSha256: input.checksumSha256 ?? null,
          minSupportedVersion: input.minSupportedVersion ?? null,
          fetchedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error('failed to upsert terminal release');
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.actorUserId ?? null,
      actorRole: 'admin',
      action: 'axioma.release_publish',
      targetType: 'terminal_release',
      targetId: row.id,
      after: {
        version: row.version,
        channel: row.channel,
        platform: row.platform,
        isCurrent: row.isCurrent,
      },
    }));
    return row;
  });
}
export async function getCurrentTerminalRelease(db: Db, channel: string, platform: string): Promise<TerminalReleaseRow | null> {
  const [row] = await db.select().from(s.terminalReleaseCache).where(and(eq(s.terminalReleaseCache.channel, channel), eq(s.terminalReleaseCache.platform, platform), eq(s.terminalReleaseCache.isCurrent, true))).limit(1);
  return row ?? null;
}
export async function getTerminalReleaseById(db: Db, id: string): Promise<TerminalReleaseRow | null> {
  const [row] = await db.select().from(s.terminalReleaseCache).where(eq(s.terminalReleaseCache.id, id)).limit(1);
  return row ?? null;
}
export async function listTerminalReleases(db: Db, limit = 50): Promise<TerminalReleaseRow[]> {
  return db.select().from(s.terminalReleaseCache).orderBy(desc(s.terminalReleaseCache.publishedAt), desc(s.terminalReleaseCache.fetchedAt)).limit(limit);
}
export async function recordDownloadEvent(db: Db, input: { userId: string; releaseId: string; version: string; platform: string; ipAddress?: string; userAgent?: string; entitlementVerified: boolean }, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(s.terminalDownloadEvents).values({ userId: input.userId, releaseId: input.releaseId, version: input.version, platform: input.platform, ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null, entitlementVerified: input.entitlementVerified });
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'user', action: 'terminal.download', targetType: 'terminal_release', targetId: input.releaseId, after: { version: input.version, platform: input.platform, entitlementVerified: input.entitlementVerified } }, now));
  });
}

export type TerminalDownloadEventRow = typeof s.terminalDownloadEvents.$inferSelect;

export interface TerminalDownloadTokenInput {
  userId: string;
  releaseId: string;
  version: string;
  platform: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  axiomaUserId?: string | null;
  entitlementVerified: boolean;
}

export type ConsumeTerminalDownloadTokenReason =
  | 'not_found'
  | 'wrong_user'
  | 'already_consumed'
  | 'revoked'
  | 'expired';

export type ConsumeTerminalDownloadTokenResult =
  | { consumed: true; row: TerminalDownloadEventRow }
  | { consumed: false; reason: ConsumeTerminalDownloadTokenReason; row: TerminalDownloadEventRow | null };

export async function issueTerminalDownloadTokenWithAudit(
  db: Db,
  input: TerminalDownloadTokenInput,
  now = Date.now(),
): Promise<TerminalDownloadEventRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.terminalDownloadEvents)
      .values({
        userId: input.userId,
        releaseId: input.releaseId,
        version: input.version,
        platform: input.platform,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        axiomaUserId: input.axiomaUserId ?? null,
        entitlementVerified: input.entitlementVerified,
      })
      .returning();
    if (!row) throw new Error('failed to issue terminal download token');
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.userId,
      actorRole: 'user',
      action: 'axioma.download_request',
      targetType: 'terminal_release',
      targetId: input.releaseId,
      after: {
        version: input.version,
        platform: input.platform,
        expiresAt: input.expiresAt.toISOString(),
        entitlementVerified: input.entitlementVerified,
      },
    }, now));
    return row;
  });
}

function terminalDownloadConsumeReason(row: TerminalDownloadEventRow | null, userId: string, now: number): ConsumeTerminalDownloadTokenReason {
  if (!row) return 'not_found';
  if (row.userId !== userId) return 'wrong_user';
  if (row.consumedAt) return 'already_consumed';
  if (row.revokedAt) return 'revoked';
  if (!row.expiresAt || row.expiresAt.getTime() <= now) return 'expired';
  return 'not_found';
}

export async function consumeTerminalDownloadTokenWithAudit(
  db: Db,
  input: { tokenHash: string; userId: string; ipAddress?: string; userAgent?: string },
  now = Date.now(),
): Promise<ConsumeTerminalDownloadTokenResult> {
  const consumedAt = new Date(now);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(s.terminalDownloadEvents)
      .set({
        consumedAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .where(and(
        eq(s.terminalDownloadEvents.tokenHash, input.tokenHash),
        eq(s.terminalDownloadEvents.userId, input.userId),
        isNull(s.terminalDownloadEvents.consumedAt),
        isNull(s.terminalDownloadEvents.revokedAt),
        gt(s.terminalDownloadEvents.expiresAt, consumedAt),
      ))
      .returning();
    if (row) {
      await tx.insert(s.auditLogs).values(auditRowValues({
        actorUserId: input.userId,
        actorRole: 'user',
        action: 'terminal.download',
        targetType: 'terminal_release',
        targetId: row.releaseId,
        after: {
          version: row.version,
          platform: row.platform,
          entitlementVerified: row.entitlementVerified,
        },
      }, now));
      return { consumed: true, row };
    }

    const [existing] = await tx
      .select()
      .from(s.terminalDownloadEvents)
      .where(eq(s.terminalDownloadEvents.tokenHash, input.tokenHash))
      .limit(1);
    const reason = terminalDownloadConsumeReason(existing ?? null, input.userId, now);
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.userId,
      actorRole: 'user',
      action: 'terminal.download',
      targetType: existing ? 'terminal_download_event' : 'terminal_release',
      targetId: existing?.id ?? null,
      result: 'failure',
      after: { reason },
    }, now));
    return { consumed: false, reason, row: existing ?? null };
  });
}
export async function recordLicenseEvent(db: Db, input: { userId: string; eventType: string; axiomaUserId?: string; deviceFingerprint?: string; metadata?: Record<string, unknown> }, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(s.terminalLicenseEvents).values({ userId: input.userId, eventType: input.eventType, axiomaUserId: input.axiomaUserId ?? null, deviceFingerprint: input.deviceFingerprint ?? null, metadata: input.metadata ?? null });
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'user', action: 'terminal.license_event', targetType: 'terminal_license', targetId: input.userId, after: { eventType: input.eventType } }, now));
  });
}

// ---------------- Axioma: handoff-token jti replay-prevention store (migration 0004 / PG6) ----------------
// Durable cross-process replay protection for Axioma handoff tokens, per
// docs/AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention. These are PURE primitives (no inline audit —
// the established consume-once pattern of insertWebhookEventOnce). The future B4 consume/issue/revoke
// API routes write the in-txn audit rows (axioma.handoff_jti_consume / _replay / _revoke) — those
// routes are still BLOCKED (need confirmed journal_server endpoint shapes + a provisioned P-256 key).
// Design: docs/handoffs/20260530-2230-ecosystem-db-architect.md (D-5..D-7),
//         docs/handoffs/20260530-2230-ecosystem-security-auditor.md (F-03/F-08).

export type HandoffJtiRow = typeof s.axiomaHandoffJtiRevocations.$inferSelect;

/** Why a consume attempt failed (the token was NOT consumed). */
export type ConsumeJtiReason = 'not_found' | 'already_used' | 'revoked' | 'expired';
export interface ConsumeJtiResult {
  consumed: boolean;
  /** present only when consumed=false */
  reason?: ConsumeJtiReason;
  /** WTC user id of the row (for the caller's audit actor), when known */
  sub?: string;
}

/** Record a freshly-issued handoff jti (used_at=null). Called at token issuance, BEFORE the token is
 *  returned to the browser, so a later consume can be checked against a durable row. Pure insert —
 *  the issuing route writes the issuance audit row. */
export async function recordHandoffJti(
  db: Db,
  input: { jti: string; sub: string; issuedAt: Date; expiresAt: Date },
): Promise<void> {
  await db.insert(s.axiomaHandoffJtiRevocations).values({
    jti: input.jti,
    sub: input.sub,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  });
}

export async function issueHandoffJtiWithAudit(
  db: Db,
  input: {
    jti: string;
    sub: string;
    issuedAt: Date;
    expiresAt: Date;
    actorUserId?: string | null;
    actorRole?: string | null;
    purpose: 'open_journal' | 'account_link';
    productCode: string;
    signerAlg: 'ES256' | 'HS256';
  },
  now = Date.now(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(s.axiomaHandoffJtiRevocations).values({
      jti: input.jti,
      sub: input.sub,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    });
    await tx.insert(s.auditLogs).values(
      auditRowValues(
        {
          actorUserId: input.actorUserId ?? input.sub,
          actorRole: input.actorRole ?? 'user',
          action: 'axioma.account_link_init',
          targetType: 'axioma_handoff_jti',
          targetId: input.jti,
          after: { purpose: input.purpose, productCode: input.productCode, signerAlg: input.signerAlg },
        },
        now,
      ),
    );
  });
}

/**
 * Atomically consume a handoff jti exactly once. The single conditional UPDATE is the authoritative,
 * TOCTOU-free decision: it succeeds only when the row is unused, unrevoked, and unexpired. Two
 * concurrent consumes of the same jti race on this UPDATE and exactly one wins (Postgres row locking).
 * On 0 rows updated, a follow-up SELECT categorizes WHY (for the caller's failure audit) — this read
 * does not affect the decision (the UPDATE already failed atomically).
 */
export async function consumeHandoffJti(db: Db, jti: string, now = Date.now()): Promise<ConsumeJtiResult> {
  const nowDate = new Date(now);
  const updated = await db
    .update(s.axiomaHandoffJtiRevocations)
    .set({ usedAt: nowDate })
    .where(
      and(
        eq(s.axiomaHandoffJtiRevocations.jti, jti),
        isNull(s.axiomaHandoffJtiRevocations.usedAt),
        isNull(s.axiomaHandoffJtiRevocations.revokedAt),
        gt(s.axiomaHandoffJtiRevocations.expiresAt, nowDate),
      ),
    )
    .returning({ sub: s.axiomaHandoffJtiRevocations.sub });
  if (updated.length > 0) {
    return { consumed: true, sub: updated[0]!.sub };
  }
  // Categorize the failure (does not change the outcome — the conditional UPDATE already declined).
  const [row] = await db
    .select()
    .from(s.axiomaHandoffJtiRevocations)
    .where(eq(s.axiomaHandoffJtiRevocations.jti, jti))
    .limit(1);
  if (!row) return { consumed: false, reason: 'not_found' };
  if (row.revokedAt) return { consumed: false, reason: 'revoked', sub: row.sub };
  if (row.usedAt) return { consumed: false, reason: 'already_used', sub: row.sub };
  return { consumed: false, reason: 'expired', sub: row.sub };
}

/** Revoke all of a user's still-live handoff jtis (e.g. on entitlement revoke / account deletion).
 *  Only touches rows that are neither used nor already revoked; already-expired rows are left for the
 *  purge worker. Pure primitive — the calling admin/worker route writes the audit row. */
export async function revokeHandoffJtisByUser(
  db: Db,
  sub: string,
  revokeReason: string,
  now = Date.now(),
): Promise<{ revoked: number }> {
  const revoked = await db
    .update(s.axiomaHandoffJtiRevocations)
    .set({ revokedAt: new Date(now), revokeReason })
    .where(
      and(
        eq(s.axiomaHandoffJtiRevocations.sub, sub),
        isNull(s.axiomaHandoffJtiRevocations.usedAt),
        isNull(s.axiomaHandoffJtiRevocations.revokedAt),
      ),
    )
    .returning({ jti: s.axiomaHandoffJtiRevocations.jti });
  return { revoked: revoked.length };
}

/** Worker cleanup: delete jti rows whose expiry is older than `now - bufferMs` (default 1h). The buffer
 *  keeps just-expired rows briefly for replay-audit queries. Runs in the worker tick after the TV sweep. */
export async function purgeExpiredHandoffJtis(
  db: Db,
  now = Date.now(),
  bufferMs = 60 * 60 * 1000,
): Promise<{ purged: number }> {
  const cutoff = new Date(now - bufferMs);
  const purged = await db
    .delete(s.axiomaHandoffJtiRevocations)
    .where(lt(s.axiomaHandoffJtiRevocations.expiresAt, cutoff))
    .returning({ jti: s.axiomaHandoffJtiRevocations.jti });
  return { purged: purged.length };
}

// ---------------- Ops: notifications, support tickets ----------------
export type NotificationRow = typeof s.notifications.$inferSelect;
export type SupportTicketRow = typeof s.supportTickets.$inferSelect;

export async function createNotification(db: Db, input: { userId: string; type: string; title: string; body: string; linkUrl?: string }): Promise<NotificationRow> {
  const [row] = await db.insert(s.notifications).values({ userId: input.userId, type: input.type, title: input.title, body: input.body, linkUrl: input.linkUrl ?? null }).returning();
  if (!row) throw new Error('failed to insert notification');
  return row;
}
export async function listNotifications(db: Db, userId: string, opts?: { unreadOnly?: boolean; limit?: number }): Promise<NotificationRow[]> {
  const where = opts?.unreadOnly ? and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)) : eq(s.notifications.userId, userId);
  return db.select().from(s.notifications).where(where).orderBy(desc(s.notifications.createdAt)).limit(opts?.limit ?? 50);
}
/** Per-user isolation: only marks the row read when it belongs to userId. */
export async function markNotificationRead(db: Db, notificationId: string, userId: string, now = Date.now()): Promise<void> {
  await db.update(s.notifications).set({ readAt: new Date(now) }).where(and(eq(s.notifications.id, notificationId), eq(s.notifications.userId, userId)));
}
export async function createSupportTicket(db: Db, input: { userId: string; productCode?: string; subject: string; body: string; priority?: string }, now = Date.now()): Promise<SupportTicketRow> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(s.supportTickets).values({ userId: input.userId, productCode: input.productCode ?? null, subject: input.subject, body: input.body, priority: input.priority ?? 'normal' }).returning();
    if (!row) throw new Error('failed to insert support ticket');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.userId, actorRole: 'user', action: 'support.ticket_create', targetType: 'support_ticket', targetId: row.id, after: { subject: input.subject, priority: row.priority } }, now));
    return row;
  });
}
export async function listSupportTickets(db: Db, opts: { userId?: string; status?: string; assignedTo?: string }): Promise<SupportTicketRow[]> {
  const conds = [
    opts.userId ? eq(s.supportTickets.userId, opts.userId) : undefined,
    opts.status ? eq(s.supportTickets.status, opts.status) : undefined,
    opts.assignedTo ? eq(s.supportTickets.assignedTo, opts.assignedTo) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  const q = db.select().from(s.supportTickets);
  const rows = conds.length ? await q.where(and(...conds)) : await q;
  return rows;
}
export async function updateSupportTicket(db: Db, ticketId: string, input: { status?: string; priority?: string; assignedTo?: string }, actorId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    const patch: Record<string, unknown> = { updatedAt: new Date(now) };
    if (input.status !== undefined) { patch.status = input.status; if (input.status === 'resolved' || input.status === 'closed') patch.resolvedAt = new Date(now); }
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;
    await tx.update(s.supportTickets).set(patch).where(eq(s.supportTickets.id, ticketId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: actorId, actorRole: 'support', action: 'support.ticket_update', targetType: 'support_ticket', targetId: ticketId, after: { ...input } }, now));
  });
}

// ---------------- Billing: subscriptions + idempotent Stripe-event application ----------------
// Entitlements remain the ONLY access source of truth. applyStripeEvent translates a verified+parsed
// provider event into entitlement transitions (via @wtc/entitlements applyBillingEvent, which already
// enforces manual-override precedence — a webhook never downgrades a manual admin grant). Idempotency
// uses the append-only audit_logs row (action 'billing.webhook_received', targetId = stripeEventId) as
// the dedupe ledger — no dedicated table needed (additive-0002 scope). A dedicated
// billing_webhook_events table is a documented TARGET if higher-throughput dedupe is needed.
export type SubscriptionRow = typeof s.subscriptions.$inferSelect;

/**
 * Upsert a subscription row.
 * Migration 0003: the subscriptions table now has UNIQUE(user_id, provider, provider_ref) so we
 * can use INSERT … ON CONFLICT DO UPDATE when providerRef is present — safe under concurrency.
 * When providerRef is absent (one-time payments, manual grants) we plain-insert a new row.
 */
export async function upsertSubscription(db: Db, input: { userId: string; planCode: string; provider: string; providerRef?: string; status: string; currentPeriodEnd?: Date }): Promise<SubscriptionRow> {
  if (input.providerRef) {
    // Safe upsert using the migration 0003 unique index on (user_id, provider, provider_ref).
    // ON CONFLICT target must match the unique index columns exactly.
    const [row] = await db
      .insert(s.subscriptions)
      .values({
        userId: input.userId,
        planCode: input.planCode,
        provider: input.provider,
        providerRef: input.providerRef,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      })
      .onConflictDoUpdate({
        target: [s.subscriptions.userId, s.subscriptions.provider, s.subscriptions.providerRef],
        set: { planCode: input.planCode, status: input.status, currentPeriodEnd: input.currentPeriodEnd ?? null },
      })
      .returning();
    if (!row) throw new Error('failed to upsert subscription');
    return row;
  }
  // No providerRef: plain INSERT (one-time payments, manual grants).
  const [row] = await db.insert(s.subscriptions).values({ userId: input.userId, planCode: input.planCode, provider: input.provider, providerRef: null, status: input.status, currentPeriodEnd: input.currentPeriodEnd ?? null }).returning();
  if (!row) throw new Error('failed to insert subscription');
  return row;
}
export async function listSubscriptionsForUser(db: Db, userId: string): Promise<SubscriptionRow[]> {
  return db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, userId)).orderBy(desc(s.subscriptions.createdAt));
}

export async function createPendingPaymentForPlan(
  db: Db,
  input: {
    userId: string;
    planCode: string;
    productCodes: ProductCode[];
    source: EntitlementSource;
    provider: string;
    checkoutSessionId: string;
  },
  now = Date.now(),
): Promise<{ productsChanged: number }> {
  return db.transaction(async (tx) => {
    let productsChanged = 0;
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.userId,
      actorRole: 'user',
      action: 'billing.checkout_created',
      targetType: 'billing_checkout_session',
      targetId: input.checkoutSessionId,
      after: { provider: input.provider, planCode: input.planCode },
    }, now));

    for (const productCode of input.productCodes) {
      const [existing] = await tx.select().from(s.entitlements)
        .where(and(eq(s.entitlements.userId, input.userId), eq(s.entitlements.productCode, productCode)))
        .limit(1);
      const fromState = existing?.status ?? 'none';
      if (existing?.manualOverride || fromState === 'active' || fromState === 'grace') {
        continue;
      }
      const [row] = await tx
        .insert(s.entitlements)
        .values({
          userId: input.userId,
          productCode,
          status: 'pending_payment',
          source: input.source,
          planCode: input.planCode,
          manualOverride: false,
          startsAt: new Date(now),
          updatedAt: new Date(now),
        })
        .onConflictDoUpdate({
          target: [s.entitlements.userId, s.entitlements.productCode],
          set: {
            status: 'pending_payment',
            source: input.source,
            planCode: input.planCode,
            manualOverride: false,
            updatedAt: new Date(now),
          },
        })
        .returning({ id: s.entitlements.id });
      if (row && fromState !== 'pending_payment') {
        await tx.insert(s.productAccessEvents).values({
          entitlementId: row.id,
          userId: input.userId,
          productCode,
          fromState,
          toState: 'pending_payment',
          reason: 'billing.checkout_created',
          actorId: input.userId,
          actorType: 'user',
        });
        productsChanged += 1;
      }
    }
    return { productsChanged };
  });
}

/** Apply a verified provider event idempotently to one-or-more product entitlements (a plan may be a
 *  bundle → multiple products). Replays are detected via the audit ledger and skipped. Each real
 *  transition writes a product_access_events row (actorType 'billing_webhook') in the same txn. */
export async function applyStripeEvent(
  db: Db,
  input: { stripeEventId: string; billingEvent: BillingEvent; userId: string; productCodes: ProductCode[]; planCode?: string },
  now = Date.now(),
): Promise<{ applied: boolean; productsChanged: number }> {
  return db.transaction(async (tx) => {
    const [seen] = await tx.select({ id: s.auditLogs.id }).from(s.auditLogs).where(and(eq(s.auditLogs.action, 'billing.webhook_received'), eq(s.auditLogs.targetId, input.stripeEventId))).limit(1);
    if (seen) return { applied: false, productsChanged: 0 };
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: null, actorRole: 'system', action: 'billing.webhook_received', targetType: 'billing_event', targetId: input.stripeEventId, after: { billingEvent: input.billingEvent, planCode: input.planCode ?? null, userId: input.userId } }, now));
    let productsChanged = 0;
    for (const productCode of input.productCodes) {
      const [existing] = await tx.select().from(s.entitlements).where(and(eq(s.entitlements.userId, input.userId), eq(s.entitlements.productCode, productCode))).limit(1);
      const current: Entitlement = existing
        ? rowToEntitlement(existing)
        : { userId: input.userId, productCode, status: 'none', source: 'subscription', manualOverride: false, updatedAt: now };
      const next = applyBillingEvent(current, input.billingEvent, now); // honours manual-override precedence
      if (next.status === current.status && existing) continue; // no-op (incl. manual-override ignore)
      const [row] = await tx
        .insert(s.entitlements)
        .values({ userId: input.userId, productCode, status: next.status, source: 'subscription', planCode: input.planCode ?? null, updatedAt: new Date(now) })
        .onConflictDoUpdate({ target: [s.entitlements.userId, s.entitlements.productCode], set: { status: next.status, planCode: input.planCode ?? existing?.planCode ?? null, updatedAt: new Date(now) } })
        .returning({ id: s.entitlements.id });
      if (row) {
        await tx.insert(s.productAccessEvents).values({ entitlementId: row.id, userId: input.userId, productCode, fromState: current.status, toState: next.status, reason: input.billingEvent, actorType: 'billing_webhook' });
        productsChanged += 1;
      }
    }
    return { applied: true, productsChanged };
  });
}

// ============================================================================
// Migration 0003 repositories (Phase 2.4). Durable webhook idempotency,
// manual review queue, atomic TV operations, and N+1-free user listing.
// Source of truth: docs/handoffs/20260530-1355-ecosystem-db-architect.md (D-01..D-07)
//   and docs/handoffs/20260530-1355-ecosystem-billing-access-auditor.md (Decisions 1, 3, 4, 5).
// ============================================================================

// ---------------- Billing: durable webhook event ledger ----------------
export type BillingWebhookEventRow = typeof s.billingWebhookEvents.$inferSelect;
export type BillingWebhookEventStatus = 'processing' | 'applied' | 'no_op' | 'manual_review' | 'error';
export type BillingWebhookTerminalStatus = 'applied' | 'no_op' | 'manual_review';

export function isBillingWebhookTerminalStatus(status: string): status is BillingWebhookTerminalStatus {
  return status === 'applied' || status === 'no_op' || status === 'manual_review';
}

export interface InsertWebhookEventResult {
  isDuplicate: boolean;
  rowId: string | null; // null only on duplicate (ON CONFLICT DO NOTHING returns no rows)
}

/**
 * Attempt to record a webhook event for the first time.
 * Uses INSERT … ON CONFLICT (provider, event_id) DO NOTHING.
 * Returns isDuplicate=true if the event was already recorded (concurrent or prior delivery).
 * MUST be called OUTSIDE the entitlement-mutation transaction so that the duplicate
 * check commits atomically before any state is mutated.
 */
export async function insertWebhookEventOnce(
  db: Db,
  input: {
    provider: string;
    eventId: string;
    eventType: string;
    userId: string | null;
    planCode: string | null;
    billingEvent: string | null;
    status: BillingWebhookEventStatus;
    productsChanged?: number;
  },
): Promise<InsertWebhookEventResult> {
  const rows = await db
    .insert(s.billingWebhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      userId: input.userId ?? null,
      planCode: input.planCode ?? null,
      billingEvent: input.billingEvent ?? null,
      status: input.status,
      productsChanged: input.productsChanged ?? 0,
    })
    .onConflictDoNothing()
    .returning({ id: s.billingWebhookEvents.id });
  if (rows.length === 0) {
    return { isDuplicate: true, rowId: null };
  }
  return { isDuplicate: false, rowId: rows[0]!.id };
}

/**
 * Update the status and productsChanged of a billing_webhook_events row after processing.
 * Called after the entitlement transaction completes to record the final outcome.
 */
export async function updateWebhookEventStatus(
  db: Db,
  provider: string,
  eventId: string,
  status: BillingWebhookEventStatus,
  productsChanged: number,
): Promise<void> {
  await db
    .update(s.billingWebhookEvents)
    .set({ status, productsChanged })
    .where(and(eq(s.billingWebhookEvents.provider, provider), eq(s.billingWebhookEvents.eventId, eventId)));
}

export async function getWebhookEventByProviderEvent(
  db: Db,
  provider: string,
  eventId: string,
): Promise<BillingWebhookEventRow | null> {
  const [row] = await db
    .select()
    .from(s.billingWebhookEvents)
    .where(and(eq(s.billingWebhookEvents.provider, provider), eq(s.billingWebhookEvents.eventId, eventId)))
    .limit(1);
  return row ?? null;
}

// ---------------- Billing: manual review queue ----------------
export type ManualReviewItemRow = typeof s.billingManualReviewItems.$inferSelect;

export type ManualReviewReason =
  | 'missing_user_id'
  | 'unknown_plan_code'
  | 'partial_refund'
  | 'partial_payment'
  | 'ambiguous_dispute_outcome'
  | 'other';

export type ManualReviewStatus = 'pending' | 'approved' | 'rejected' | 'dismissed';

/**
 * Create a manual review item for an unresolvable or ambiguous webhook event.
 * Uses INSERT … ON CONFLICT DO NOTHING to prevent duplicate items for the same event
 * (idempotent: multiple deliveries of the same unresolvable event do not create multiple items).
 * Also writes an audit row in the same transaction.
 * eventSnapshot MUST NOT include NormalizedEvent.raw or any secret/PII fields.
 */
export async function createManualReviewItem(
  db: Db,
  input: {
    provider: string;
    eventId: string;
    eventType: string;
    userId: string | null;
    reason: ManualReviewReason;
    eventSnapshot: Record<string, unknown>;
  },
  now = Date.now(),
): Promise<ManualReviewItemRow | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(s.billingManualReviewItems)
      .values({
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        userId: input.userId ?? null,
        reason: input.reason,
        eventSnapshot: input.eventSnapshot,
      })
      .onConflictDoNothing()
      .returning();
    if (rows.length === 0) return null; // already created for this event
    const item = rows[0]!;
    // Audit row in the same transaction.
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: null, actorRole: 'system',
      action: 'billing.manual_review_created',
      targetType: 'billing_manual_review_item', targetId: item.id,
      after: { provider: input.provider, eventId: input.eventId, reason: input.reason },
    }, now));
    return item;
  });
}

/**
 * List manual review items for the admin queue.
 * Optionally filter by status. Returns most recent first. Default limit 100.
 */
export async function listManualReviewItems(
  db: Db,
  opts?: { status?: ManualReviewStatus; limit?: number },
): Promise<ManualReviewItemRow[]> {
  const q = db.select().from(s.billingManualReviewItems).orderBy(desc(s.billingManualReviewItems.createdAt)).limit(opts?.limit ?? 100);
  if (opts?.status) {
    return q.where(eq(s.billingManualReviewItems.status, opts.status));
  }
  return q;
}

/**
 * Resolve a manual review item (approve, reject, or dismiss).
 *
 * IMPORTANT: To avoid PGlite nested-transaction/savepoint fragility (billing auditor R-01),
 * this function does NOT call grantProduct INSIDE the transaction. Instead:
 *   - The review item update + audit write happen in one transaction (this function).
 *   - For resolution==='approved' with an approvalTarget, the caller must call
 *     grantProduct(db, ...) SEPARATELY (its own transaction) before or after this call.
 * This design avoids the nested-savepoint issue in PGlite while keeping atomicity for the
 * review-item state transition itself.
 */
export async function resolveManualReviewItem(
  db: Db,
  input: {
    itemId: string;
    resolution: ManualReviewStatus; // 'approved' | 'rejected' | 'dismissed'
    resolvedByAdminId: string;
    resolutionNote: string;
    // For 'approved': if userId and productCodes are known, pass approvalTarget.
    // Caller must then call grantProduct(db, ...) SEPARATELY for each productCode.
    approvalTarget?: { userId: string; productCodes: ProductCode[]; planCode?: string };
  },
  now = Date.now(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const [item] = await tx.select().from(s.billingManualReviewItems)
      .where(eq(s.billingManualReviewItems.id, input.itemId)).limit(1);
    if (!item) throw new Error('manual_review_item_not_found');
    if (item.status !== 'pending') throw new Error('manual_review_item_already_resolved');

    await tx.update(s.billingManualReviewItems).set({
      status: input.resolution,
      resolvedBy: input.resolvedByAdminId,
      resolvedAt: new Date(now),
      resolutionNote: input.resolutionNote,
    }).where(eq(s.billingManualReviewItems.id, input.itemId));

    // Map resolution to an audit action. 'pending' is not a valid resolution (guarded above).
    const resolutionAction = {
      approved: 'billing.manual_review_approved' as const,
      rejected: 'billing.manual_review_rejected' as const,
      dismissed: 'billing.manual_review_dismissed' as const,
    }[input.resolution as 'approved' | 'rejected' | 'dismissed'];
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.resolvedByAdminId, actorRole: 'admin',
      action: resolutionAction,
      targetType: 'billing_manual_review_item', targetId: input.itemId,
      after: { resolution: input.resolution, note: input.resolutionNote },
    }, now));
  });
  // For 'approved' with a target: call grantProduct SEPARATELY (outside the above txn).
  // This avoids nested-transaction/savepoint issues and keeps the grant in its own atomic unit.
  if (input.resolution === 'approved' && input.approvalTarget) {
    for (const pc of input.approvalTarget.productCodes) {
      await grantProduct(
        db,
        input.approvalTarget.userId,
        pc,
        now,
        input.resolvedByAdminId,
        `manual_review_approved: ${input.resolutionNote}`,
        undefined,
      );
    }
  }
}

/**
 * Admin-triggered manual_review flag. Transitions any state to 'manual_review'.
 * Writes audit row + product_access_events row in the same transaction.
 */
export async function flagProductForReview(
  db: Db,
  userId: string,
  productCode: ProductCode,
  now = Date.now(),
  actorUserId?: string,
  reason?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.entitlements)
      .where(and(eq(s.entitlements.userId, userId), eq(s.entitlements.productCode, productCode)))
      .limit(1);
    if (!existing) return; // no entitlement to flag
    const fromState = existing.status;
    // Apply 'flag_review' billing event → 'manual_review'
    const next = applyBillingEvent(rowToEntitlement(existing), 'flag_review', now);
    if (next.status === fromState) return; // already in manual_review
    await tx.update(s.entitlements)
      .set({ status: next.status, manualOverride: true, updatedAt: new Date(now) })
      .where(eq(s.entitlements.id, existing.id));
    const eventReason = reason ?? 'manual_review_flagged';
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: actorUserId ?? null, actorRole: 'admin',
      action: 'product.flag_review',
      targetType: 'entitlement', targetId: `${userId}:${productCode}`,
      after: { status: next.status, reason: eventReason },
    }, now));
    await tx.insert(s.productAccessEvents).values({
      entitlementId: existing.id, userId, productCode,
      fromState, toState: next.status, reason: eventReason,
      actorId: actorUserId ?? null,
      actorType: actorUserId ? 'admin' : 'system',
    });
  });
}

// ---------------- TradingView: atomic grant + atomic revoke (Phase 2.4) ----------------

/**
 * Atomic TV grant: updates request status, inserts grant row, upserts profile pointer,
 * and writes the audit row — all in ONE transaction.
 * Replaces the sequential grantTv + createTvGrant calls in features/tv/actions.ts
 * which span two separate transactions (F-02: diverged state if the second call fails).
 *
 * Backward-compatible: grantTv and createTvGrant remain exported for sweepTvExpiry + tests.
 */
export async function atomicGrantTv(
  db: Db,
  input: {
    requestId: string;
    /** Deprecated caller hints kept for backward compatibility; the transaction derives both from the request row. */
    userId?: string;
    tvUsername?: string;
    adminId: string;
    durationMs: number;
    reason?: string;
  },
  now = Date.now(),
): Promise<TvGrantRow> {
  return db.transaction(async (tx) => {
    const expiresAt = new Date(now + input.durationMs);
    // 1. Update request status with an authoritative state guard.
    // The returned row is the only trusted source for userId + TV username; hidden form values and
    // stale caller hints are ignored so a tampered admin POST cannot grant access to a different user.
    const [request] = await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'granted', grantedAt: new Date(now), grantedBy: input.adminId, expiresAt })
      .where(and(
        eq(s.tradingviewAccessRequests.id, input.requestId),
        inArray(s.tradingviewAccessRequests.status, ['pending', 'expiring_soon']),
      ))
      .returning();
    if (!request) throw new Error('tv_request_not_grantable');
    // 2. Insert grant row
    const [grant] = await tx.insert(s.tradingviewAccessGrants).values({
      requestId: input.requestId,
      userId: request.userId,
      tvUsername: request.tradingViewUsername,
      grantedAt: new Date(now),
      expiresAt,
      grantedBy: input.adminId,
      grantedByType: 'admin',
    }).returning();
    if (!grant) throw new Error('failed to insert tv grant');
    // 3. Upsert profile pointer
    await tx.insert(s.tradingviewProfiles)
      .values({ userId: request.userId, tvUsername: request.tradingViewUsername, currentGrantId: grant.id })
      .onConflictDoUpdate({
        target: s.tradingviewProfiles.userId,
        set: { tvUsername: request.tradingViewUsername, currentGrantId: grant.id, updatedAt: new Date(now) },
      });
    // 4. Audit
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.adminId, actorRole: 'admin',
      action: 'tv_access.grant',
      targetType: 'tradingview_access_grant', targetId: grant.id,
      after: { tvUsername: request.tradingViewUsername, reason: input.reason ?? null },
    }, now));
    return grant;
  });
}

/**
 * Actor for a TV revoke. An admin revoke carries the admin's user id; a worker-driven expiry revoke
 * carries a SYSTEM actor (id=null, role='system') — audit_logs.actor_user_id is nullable with no FK,
 * so null is the correct, honest value (never a fabricated sentinel user id).
 */
export type TvRevokeActor = { id: string | null; role: 'admin' | 'system' };

/**
 * Atomic TV revoke: stamps the request row, finds and stamps the active grant row (via requestId),
 * nulls the profile pointer, and writes one audit row — all in ONE transaction.
 * reason is written to the grant's revoke_reason column and the audit payload.
 *
 * actor identifies who revoked: an admin ({ id, role: 'admin' }) or the worker sweep
 * ({ id: null, role: 'system' }). revokedBy on both the request and grant rows is actor.id (null for
 * the system actor — the column is a nullable FK).
 *
 * Only granted/expiring_soon requests are revokable. Pending/already-revoked requests are rejected
 * so a stale/direct caller cannot write misleading revoke audit rows.
 */
export async function atomicRevokeTv(
  db: Db,
  requestId: string,
  actor: TvRevokeActor,
  reason?: string,
  now = Date.now(),
  options?: { queueExternalRevokeTask?: boolean },
): Promise<{ taskQueued: boolean }> {
  return db.transaction(async (tx) => {
    // 1. Stamp the request row with an authoritative state guard
    const [request] = await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'revoked', revokedAt: new Date(now), revokedBy: actor.id })
      .where(and(
        eq(s.tradingviewAccessRequests.id, requestId),
        inArray(s.tradingviewAccessRequests.status, ['granted', 'expiring_soon']),
      ))
      .returning();
    if (!request) throw new Error('tv_request_not_revokable');
    // 2. Find the active grant for this requestId (may not exist)
    const [grant] = await tx.select()
      .from(s.tradingviewAccessGrants)
      .where(and(eq(s.tradingviewAccessGrants.requestId, requestId), isNull(s.tradingviewAccessGrants.revokedAt)))
      .limit(1);
    if (grant) {
      // 3. Stamp the grant row
      await tx.update(s.tradingviewAccessGrants)
        .set({ revokedAt: new Date(now), revokedBy: actor.id, revokeReason: reason ?? null })
        .where(eq(s.tradingviewAccessGrants.id, grant.id));
      // 4. Null the profile pointer
      await tx.update(s.tradingviewProfiles)
        .set({ currentGrantId: null, updatedAt: new Date(now) })
        .where(and(
          eq(s.tradingviewProfiles.userId, grant.userId),
          eq(s.tradingviewProfiles.currentGrantId, grant.id),
        ));
    }
    // 5. Audit
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: actor.id, actorRole: actor.role,
      action: 'tv_access.revoke',
      targetType: 'tradingview_access_request', targetId: requestId,
      after: { status: 'revoked', reason: reason ?? null, grantId: grant?.id ?? null },
    }, now));
    let taskQueued = false;
    if (options?.queueExternalRevokeTask) {
      const inserted = await tx
        .insert(s.tradingviewAccessTasks)
        .values({ requestId, kind: 'revoke', done: false })
        .onConflictDoNothing({ target: [s.tradingviewAccessTasks.requestId, s.tradingviewAccessTasks.kind] })
        .returning({ id: s.tradingviewAccessTasks.id });
      taskQueued = inserted.length > 0;
    }
    return { taskQueued };
  });
}

// ---------------- Admin: N+1-free user listing ----------------

export interface DbUserWithCreatedAt extends DbUser {
  createdAt: number; // epoch-ms
  failedLoginTotalCount: number;
  lastFailedLoginAt: number | null;
  accountLockedUntil: number | null;
  accountLockoutReviewRequiredAt: number | null;
}

/**
 * Admin-only: list all users with their createdAt timestamp, resolved roles, and passwordHash.
 * Uses 2 flat queries (users + user_roles) then joins in-process — NOT N+1.
 *
 * WARNING: The returned shape includes passwordHash so the type forces the caller to handle it
 * deliberately. Use mapToAdminUserView (or equivalent) to strip it before sending to clients.
 * NEVER return DbUserWithCreatedAt directly to API responses.
 */
export async function listUsersWithCreatedAt(db: Db): Promise<DbUserWithCreatedAt[]> {
  const [users, roleRows] = await Promise.all([
    db.select({
      id: s.users.id,
      email: s.users.email,
      displayName: s.users.displayName,
      passwordHash: s.users.passwordHash,
      createdAt: s.users.createdAt,
      failedLoginTotalCount: s.users.failedLoginTotalCount,
      lastFailedLoginAt: s.users.lastFailedLoginAt,
      accountLockedUntil: s.users.accountLockedUntil,
      accountLockoutReviewRequiredAt: s.users.accountLockoutReviewRequiredAt,
    }).from(s.users),
    db.select({ userId: s.userRoles.userId, roleCode: s.userRoles.roleCode }).from(s.userRoles),
  ]);
  // Build role map in-process (O(N) not O(N^2))
  const roleMap = new Map<string, string[]>();
  for (const r of roleRows) {
    const arr = roleMap.get(r.userId) ?? [];
    arr.push(r.roleCode);
    roleMap.set(r.userId, arr);
  }
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? u.email,
    passwordHash: u.passwordHash,
    roles: (roleMap.get(u.id) ?? []) as Role[],
    createdAt: u.createdAt.getTime(),
    failedLoginTotalCount: u.failedLoginTotalCount,
    lastFailedLoginAt: u.lastFailedLoginAt?.getTime() ?? null,
    accountLockedUntil: u.accountLockedUntil?.getTime() ?? null,
    accountLockoutReviewRequiredAt: u.accountLockoutReviewRequiredAt?.getTime() ?? null,
  }));
}

/**
 * Admin-only batched lookup: id → email for the given user ids, in ONE `WHERE id IN (...)` query.
 * Replaces a per-row getUserById N+1 (e.g. the TV admin queue). Returns a Map; an empty input list
 * short-circuits to an empty Map WITHOUT issuing a query (an empty `IN ()` is invalid in some engines).
 * Returns ONLY the email column — never passwordHash — so it is safe to use directly in admin views.
 */
export async function listUsersWithEmailByIds(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(inArray(s.users.id, unique));
  return new Map(rows.map((r) => [r.id, r.email]));
}
