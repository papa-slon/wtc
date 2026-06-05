import 'server-only';
/**
 * In-memory demo backend. Wires the REAL verified packages (auth/argon2, crypto vault,
 * entitlements, tv-access, lms, audit) over in-memory storage so the app runs without Postgres.
 * Swap these accessors for @wtc/db repositories to go from demo → production (see DEPLOYMENT.md).
 * No secrets are stored in plaintext — exchange keys go through the envelope vault.
 *
 * All mutable state lives on globalThis so it survives Next dev HMR and any module-instance
 * duplication (otherwise a session written by a server action wouldn't be visible to a page render).
 */
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  SESSION_TTL_MS,
  isLoginLocked,
  nextLoginFailureState,
  nextLoginSuccessState,
  EMPTY_LOGIN_LOCKOUT_STATE,
  type LoginLockoutState,
} from '@wtc/auth';
import type { Role } from '@wtc/shared';
import { maskSecret, type SealedSecret } from '@wtc/crypto';
import { grantManual, applyBillingEvent, type Entitlement, type ProductCode } from '@wtc/entitlements';
import { TvAccessService, createMemoryTvStore, type TvAccessStore, type TvAccessRequest } from '@wtc/tradingview-access';
import { LmsService as LmsClass, createMemoryLmsStore, type LmsStore, type Course, type Lesson } from '@wtc/lms';
import { createMemoryAuditWriter, type AuditEvent, type AuditWriter } from '@wtc/audit';
import { getVault } from './vault.ts';
import type { TvService, TvRequestView } from './tv-types.ts';
import type { LmsService, CourseView, LessonView } from './lms-types.ts';

export const DEMO_PASSWORD = 'wtc-demo-pass-123';

export interface DemoUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: Role[];
}

export type AuthLoginAttemptResult =
  | { ok: true; user: DemoUser }
  | { ok: false; reason: 'invalid'; lockoutApplied: boolean; reviewRequired: boolean; lockedUntil: number | null }
  | { ok: false; reason: 'locked'; lockedUntil: number };

export interface ExchangeAccountView {
  id: string;
  userId: string;
  exchange: string;
  label: string;
  mode: 'demo' | 'live';
  keyMask: string;
}

export interface ExchangeKeyMetadataCheckResult {
  exchangeAccountId: string;
  exchange: string | null;
  mode: 'demo' | 'live' | null;
  keyMask: string | null;
  checkKind: 'sealed_metadata_only';
  livePing: false;
  outcome: 'vault_present' | 'missing';
  reason: 'vault_metadata_present_live_ping_not_run' | 'owned_key_not_found_or_incomplete';
  checkedAt: number;
}

interface DemoState {
  users: Map<string, DemoUser>;
  usersByEmail: Map<string, string>;
  loginLockouts: Map<string, LoginLockoutState>;
  sessions: Map<string, { userId: string; expiresAt: number }>;
  entitlements: Map<string, Entitlement[]>;
  exchangeAccounts: ExchangeAccountView[];
  sealedById: Map<string, SealedSecret>;
  tvStore: TvAccessStore;
  lmsStore: LmsStore;
  auditSink: { writer: AuditWriter; events: AuditEvent[] };
  seeded: Promise<void> | null;
}

const g = globalThis as unknown as { __WTC_DEMO__?: DemoState };
function S(): DemoState {
  if (!g.__WTC_DEMO__) {
    g.__WTC_DEMO__ = {
      users: new Map(),
      usersByEmail: new Map(),
      loginLockouts: new Map(),
      sessions: new Map(),
      entitlements: new Map(),
      exchangeAccounts: [],
      sealedById: new Map(),
      tvStore: createMemoryTvStore(),
      lmsStore: createMemoryLmsStore(),
      auditSink: createMemoryAuditWriter(),
      seeded: null,
    };
  }
  return g.__WTC_DEMO__;
}

// Stateless service wrappers over the shared stores (safe even if this module is duplicated).
export const audit: AuditWriter = S().auditSink.writer;
export const auditEvents: AuditEvent[] = S().auditSink.events;

// In-memory TradingView access, exposed through the SAME async TvService shape as the DB adapter
// (lib/db-store.ts) so lib/backend.ts can select either one and the call sites stay identical.
// Audit rows go to the in-memory audit sink (the DB adapter audits inside the repo txn instead).
const memTv = new TvAccessService(S().tvStore);
function tvMemToView(r: TvAccessRequest): TvRequestView {
  const v: TvRequestView = { id: r.id, userId: r.userId, tradingViewUsername: r.tradingViewUsername, status: r.status, requestedAt: r.requestedAt };
  if (r.grantedAt !== undefined) v.grantedAt = r.grantedAt;
  if (r.grantedBy !== undefined) v.grantedBy = r.grantedBy;
  if (r.expiresAt !== undefined) v.expiresAt = r.expiresAt;
  return v;
}
export const tvService: TvService = {
  async submitRequest(userId, username, hasEntitlement, now) {
    const r = memTv.submitRequest(userId, username, hasEntitlement, now); // throws (fail-closed) if no entitlement
    await audit.write({ actorUserId: userId, actorRole: 'user', action: 'tradingview.submit', targetType: 'tradingview_access_request', targetId: r.id, after: { status: r.status, tradingViewUsername: username } });
    return tvMemToView(r);
  },
  async listByUser(userId) {
    return S().tvStore.list().filter((r) => r.userId === userId).map(tvMemToView);
  },
  async listAll() {
    return S().tvStore.list().map(tvMemToView);
  },
  async grant(requestId, adminId, now, durationMs) {
    memTv.grant(requestId, adminId, now, durationMs);
    await audit.write({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.grant', targetType: 'tradingview_access_request', targetId: requestId, after: { status: 'granted' } });
  },
  async revoke(requestId, adminId, now) {
    memTv.revoke(requestId, adminId, now);
    await audit.write({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.revoke', targetType: 'tradingview_access_request', targetId: requestId, after: { status: 'revoked' } });
  },
};

// In-memory LMS, exposed through the SAME async LmsService shape as the DB adapter (lib/db-store.ts).
// Ownership/visibility come from @wtc/lms; createCourse audits to the in-memory sink.
const memLms = new LmsClass(S().lmsStore);
function courseMemToView(c: Course): CourseView {
  // The in-memory demo Course model has no level/tags columns → honest defaults for the DTO (0005).
  const v: CourseView = { id: c.id, ownerTeacherId: c.ownerTeacherId, title: c.title, productCode: c.productCode, published: c.published, createdAt: c.createdAt, level: 'beginner', tags: [] };
  if (c.description !== undefined) v.description = c.description;
  return v;
}
function lessonMemToView(l: Lesson): LessonView {
  // The in-memory demo Lesson model has no content_type column → mirror the migration backfill default.
  const v: LessonView = { id: l.id, courseId: l.courseId, title: l.title, order: l.order, published: l.published, contentType: l.videoUrl ? 'video' : 'article' };
  if (l.body !== undefined) v.body = l.body;
  if (l.videoUrl !== undefined) v.videoUrl = l.videoUrl;
  return v;
}
export const lmsService: LmsService = {
  async createCourse(actor, input, now) {
    const c = memLms.createCourse(actor, input, now);
    await audit.write({ actorUserId: actor.userId, actorRole: 'teacher', action: 'education.course_create', targetType: 'course', targetId: c.id, after: { title: c.title, published: c.published } });
    return courseMemToView(c);
  },
  async listCoursesForTeacher(actor) {
    return [...S().lmsStore.courses.values()].filter((c) => c.ownerTeacherId === actor.userId || actor.isAdmin).map(courseMemToView);
  },
  async listPublishedCourses() {
    return [...S().lmsStore.courses.values()].filter((c) => c.published).map(courseMemToView);
  },
  async listLessonsForStudent(courseId, hasEducationAccess) {
    return memLms.listLessonsForStudent(courseId, hasEducationAccess).map(lessonMemToView);
  },
};

async function doSeed(): Promise<void> {
  const s = S();
  const now = Date.now();
  const hash = await hashPassword(DEMO_PASSWORD);
  const year = 365 * 86_400_000;

  const mk = (email: string, displayName: string, roles: Role[]): DemoUser => {
    const u: DemoUser = { id: crypto.randomUUID(), email, displayName, passwordHash: hash, roles };
    s.users.set(u.id, u);
    s.usersByEmail.set(email, u.id);
    return u;
  };

  const admin = mk('admin@wtc.local', 'WTC Admin', ['admin', 'user']);
  const teacher = mk('teacher@wtc.local', 'WTC Teacher', ['teacher', 'user']);
  const user = mk('user@wtc.local', 'WTC User', ['user']);

  const ent = (productCode: ProductCode, over: Partial<Entitlement> = {}): Entitlement => ({
    userId: user.id, productCode, status: 'active', source: 'subscription', startsAt: now, currentPeriodEnd: now + year, updatedAt: now, ...over,
  });
  s.entitlements.set(user.id, [
    ent('tortila_bot', { planCode: 'tortila_yearly' }),
    ent('legacy_bot', { planCode: 'legacy_monthly' }),
    ent('axioma_terminal', { planCode: 'axioma_yearly' }),
    ent('education', { planCode: 'education_lifetime', source: 'one_time', currentPeriodEnd: undefined }),
    // indicators EXPIRED → demonstrates the explainAccess "expired" reason + fail-closed TV submit
    ent('tradingview_indicators', { planCode: 'indicators_quarterly', currentPeriodEnd: now - 86_400_000, graceUntil: now - 1 }),
  ]);
  s.entitlements.set(admin.id, []);
  s.entitlements.set(teacher.id, [{ userId: teacher.id, productCode: 'education', status: 'active', source: 'manual_grant', manualOverride: true, startsAt: now, updatedAt: now }]);

  const course = await lmsService.createCourse({ userId: teacher.id, isAdmin: false }, { title: 'Risk Management Fundamentals', description: 'Position sizing, drawdown control, journaling discipline.', published: true }, now);
  s.lmsStore.lessons.set('l1', { id: 'l1', courseId: course.id, title: 'Position sizing & the 1% rule', body: 'How to size positions against account risk.', videoUrl: 'https://example.com/lesson1', order: 1, published: true });

  await tvService.submitRequest(user.id, 'demo_trader_99', true, now);
}

export function ensureSeeded(): Promise<void> {
  const s = S();
  if (!s.seeded) s.seeded = doSeed();
  return s.seeded;
}

// --- accessors ---
export async function findUserByEmail(email: string): Promise<DemoUser | undefined> {
  await ensureSeeded();
  const id = S().usersByEmail.get(email);
  return id ? S().users.get(id) : undefined;
}

export async function createUser(email: string, password: string, displayName: string): Promise<DemoUser> {
  await ensureSeeded();
  const s = S();
  if (s.usersByEmail.has(email)) throw new Error('email already registered');
  const u: DemoUser = { id: crypto.randomUUID(), email, displayName, passwordHash: await hashPassword(password), roles: ['user'] };
  s.users.set(u.id, u);
  s.usersByEmail.set(email, u.id);
  s.entitlements.set(u.id, []);
  await audit.write({
    actorUserId: u.id,
    actorRole: 'user',
    action: 'auth.register',
    targetType: 'user',
    targetId: u.id,
    after: { roles: u.roles, hasDisplayName: displayName.trim().length > 0 },
  });
  return u;
}

export async function verifyLogin(email: string, password: string): Promise<DemoUser | null> {
  const attempt = await attemptLogin(email, password);
  return attempt.ok ? attempt.user : null;
}

export async function attemptLogin(email: string, password: string, now = Date.now()): Promise<AuthLoginAttemptResult> {
  const u = await findUserByEmail(email);
  if (!u) {
    await audit.write({
      actorRole: null,
      action: 'auth.login_failed',
      targetType: 'auth_login_identifier',
      targetId: null,
      after: { outcome: 'invalid', accountResolved: false },
      result: 'failure',
    });
    return { ok: false, reason: 'invalid', lockoutApplied: false, reviewRequired: false, lockedUntil: null };
  }

  const lockouts = S().loginLockouts;
  const state = lockouts.get(u.id) ?? { ...EMPTY_LOGIN_LOCKOUT_STATE };
  if (isLoginLocked(state, now)) {
    await audit.write({
      actorUserId: u.id,
      actorRole: 'user',
      action: 'auth.login_failed',
      targetType: 'user',
      targetId: u.id,
      after: { outcome: 'locked', accountResolved: true },
      result: 'failure',
    });
    return { ok: false, reason: 'locked', lockedUntil: state.accountLockedUntil! };
  }

  if (await verifyPassword(u.passwordHash, password)) {
    lockouts.set(u.id, nextLoginSuccessState());
    return { ok: true, user: u };
  }

  const failure = nextLoginFailureState(state, now);
  lockouts.set(u.id, failure.state);
  await audit.write({
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
  });
  return {
    ok: false,
    reason: 'invalid',
    lockoutApplied: failure.lockoutApplied,
    reviewRequired: failure.reviewRequired,
    lockedUntil: failure.state.accountLockedUntil,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  await ensureSeeded();
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  S().sessions.set(tokenHash, { userId, expiresAt });
  return { token, expiresAt };
}

export async function userForToken(token: string | undefined): Promise<DemoUser | null> {
  if (!token) return null;
  await ensureSeeded();
  const sess = S().sessions.get(hashToken(token));
  if (!sess || sess.expiresAt < Date.now()) return null;
  return S().users.get(sess.userId) ?? null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (token) S().sessions.delete(hashToken(token));
}

export async function getUserById(id: string): Promise<DemoUser | undefined> {
  await ensureSeeded();
  return S().users.get(id);
}

export async function listUsers(): Promise<DemoUser[]> {
  await ensureSeeded();
  return [...S().users.values()];
}

export async function entitlementsOf(userId: string): Promise<Entitlement[]> {
  await ensureSeeded();
  return S().entitlements.get(userId) ?? [];
}

export async function grantProduct(userId: string, productCode: ProductCode): Promise<void> {
  await ensureSeeded();
  const list = S().entitlements.get(userId) ?? [];
  const existing = list.find((e) => e.productCode === productCode);
  const now = Date.now();
  if (existing) Object.assign(existing, applyBillingEvent(existing, 'manual_grant', now));
  else list.push(grantManual(userId, productCode, now));
  S().entitlements.set(userId, list);
  await audit.write({ actorRole: 'admin', action: 'product.grant', targetType: 'entitlement', targetId: `${userId}:${productCode}`, after: { status: 'active' } });
}

export async function revokeProduct(userId: string, productCode: ProductCode): Promise<void> {
  await ensureSeeded();
  const list = S().entitlements.get(userId) ?? [];
  const existing = list.find((e) => e.productCode === productCode);
  if (existing) {
    Object.assign(existing, applyBillingEvent(existing, 'manual_revoke', Date.now()));
    await audit.write({ actorRole: 'admin', action: 'product.revoke', targetType: 'entitlement', targetId: `${userId}:${productCode}`, after: { status: 'revoked' } });
  }
}

export async function addExchangeKey(userId: string, input: { exchange: string; label: string; apiKey: string; apiSecret: string; mode: 'demo' | 'live' }): Promise<ExchangeAccountView> {
  await ensureSeeded();
  const id = crypto.randomUUID();
  const sealed = getVault().seal(JSON.stringify({ apiKey: input.apiKey, apiSecret: input.apiSecret }), `user:${userId}|exchange:${input.exchange}`);
  S().sealedById.set(id, sealed);
  const view: ExchangeAccountView = { id, userId, exchange: input.exchange, label: input.label, mode: input.mode, keyMask: maskSecret(input.apiKey) };
  S().exchangeAccounts.push(view);
  // Defence-in-depth: never put raw key material into the audit input (redaction is a backstop, not
  // the primary control). Only the non-secret exchange + key mask are recorded.
  await audit.write({ actorUserId: userId, actorRole: 'user', action: 'exchange_key.create', targetType: 'exchange_account', targetId: id, after: { exchange: input.exchange, keyMask: view.keyMask } });
  return view;
}

export async function listExchangeKeys(userId: string): Promise<ExchangeAccountView[]> {
  await ensureSeeded();
  return S().exchangeAccounts.filter((a) => a.userId === userId);
}

export async function recordExchangeKeyMetadataCheck(userId: string, exchangeAccountId: string): Promise<ExchangeKeyMetadataCheckResult> {
  await ensureSeeded();
  const checkedAt = Date.now();
  const account = S().exchangeAccounts.find((a) => a.id === exchangeAccountId && a.userId === userId) ?? null;
  const found = !!account && S().sealedById.has(account.id);
  const result: ExchangeKeyMetadataCheckResult = {
    exchangeAccountId: found ? account.id : exchangeAccountId,
    exchange: found ? account.exchange : null,
    mode: found ? account.mode : null,
    keyMask: found ? account.keyMask : null,
    checkKind: 'sealed_metadata_only',
    livePing: false,
    outcome: found ? 'vault_present' : 'missing',
    reason: found ? 'vault_metadata_present_live_ping_not_run' : 'owned_key_not_found_or_incomplete',
    checkedAt,
  };
  await audit.write({
    actorUserId: userId,
    actorRole: 'user',
    action: 'exchange_key.metadata_check',
    targetType: 'exchange_account',
    targetId: found ? account.id : null,
    result: found ? 'success' : 'failure',
    after: {
      checkKind: result.checkKind,
      livePing: result.livePing,
      outcome: result.outcome,
      reason: result.reason,
      exchange: result.exchange,
      mode: result.mode,
      keyMask: result.keyMask,
      checkedAt: result.checkedAt,
    },
  });
  return result;
}
