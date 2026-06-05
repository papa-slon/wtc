import 'server-only';
/**
 * DB-backed implementation of the app's core data accessors (same signatures as the in-memory
 * demo store). Used in production (selected by lib/backend.ts when DATABASE_URL is set). All
 * business rules come from the verified @wtc/db repositories + @wtc/auth + the crypto vault.
 */
import {
  createDb,
  type Db,
  findUserByEmail as rFindByEmail,
  getUserById as rGetById,
  listUsers as rListUsers,
  createUser as rCreateUser,
  attemptUserLogin as rAttemptUserLogin,
  createSession as rCreateSession,
  userForTokenHash as rUserForTokenHash,
  destroySession as rDestroySession,
  entitlementsOf as rEntitlementsOf,
  grantProduct as rGrantProduct,
  revokeProduct as rRevokeProduct,
  addExchangeKey as rAddExchangeKey,
  listExchangeKeys as rListExchangeKeys,
  recordExchangeKeyMetadataCheck as rRecordExchangeKeyMetadataCheck,
  type ExchangeKeyMetadataCheckResult,
  createDbAuditWriter,
  recentAuditEvents as rRecentAuditEvents,
  submitTvRequest as rSubmitTvRequest,
  listTvByUser as rListTvByUser,
  listAllTv as rListAllTv,
  grantTv as rGrantTv,
  revokeTv as rRevokeTv,
  rowToTvDto,
  createCourse as rCreateCourse,
  listCoursesForTeacher as rListCoursesForTeacher,
  listPublishedCourses as rListPublishedCourses,
  listLessonsForStudent as rListLessonsForStudent,
} from '@wtc/db';
import { hashPassword, verifyPassword, generateSessionToken, hashToken, SESSION_TTL_MS } from '@wtc/auth';
import { maskSecret } from '@wtc/crypto';
import type { Entitlement, ProductCode } from '@wtc/entitlements';
import type { AuditWriter } from '@wtc/audit';
import { getVault } from './vault';
import type { AuthLoginAttemptResult, DemoUser, ExchangeAccountView } from './demo';
import type { TvService } from './tv-types';
import type { LmsService } from './lms-types';

let cachedDb: Db | null = null;
function db(): Db {
  if (!cachedDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('[db-store] DATABASE_URL is required');
    cachedDb = createDb(url);
  }
  return cachedDb;
}

/** The cached Db (DATABASE_URL must be set). Exposed for Phase-2.1 feature queries that call the
 *  @wtc/db repositories directly; backend.ts wraps this in getServerDb() with the fail-closed guard. */
export function getDb(): Db {
  return db();
}

export const audit: AuditWriter = {
  async write(input) {
    await createDbAuditWriter(db()).write(input);
  },
};

export async function findUserByEmail(email: string): Promise<DemoUser | undefined> {
  return (await rFindByEmail(db(), email)) ?? undefined;
}
export async function getUserById(id: string): Promise<DemoUser | undefined> {
  return (await rGetById(db(), id)) ?? undefined;
}
export async function listUsers(): Promise<DemoUser[]> {
  return rListUsers(db());
}
export async function createUser(email: string, password: string, displayName: string): Promise<DemoUser> {
  return rCreateUser(db(), { email, passwordHash: await hashPassword(password), displayName, auditRegistration: true });
}
export async function verifyLogin(email: string, password: string): Promise<DemoUser | null> {
  const attempt = await attemptLogin(email, password);
  return attempt.ok ? attempt.user : null;
}
export async function attemptLogin(email: string, password: string, now?: Date | number): Promise<AuthLoginAttemptResult> {
  return rAttemptUserLogin(db(), { email, password, verifyPassword, now });
}
export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const { token, tokenHash } = generateSessionToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await rCreateSession(db(), userId, tokenHash, new Date(expiresAt));
  return { token, expiresAt };
}
export async function userForToken(token: string | undefined): Promise<DemoUser | null> {
  if (!token) return null;
  return (await rUserForTokenHash(db(), hashToken(token), new Date())) ?? null;
}
export async function destroySession(token: string | undefined): Promise<void> {
  if (token) await rDestroySession(db(), hashToken(token));
}
export async function entitlementsOf(userId: string): Promise<Entitlement[]> {
  return rEntitlementsOf(db(), userId);
}
export async function grantProduct(userId: string, productCode: ProductCode | string): Promise<void> {
  await rGrantProduct(db(), userId, productCode as ProductCode); // repo writes the audit row inside the same txn
}
export async function revokeProduct(userId: string, productCode: ProductCode | string): Promise<void> {
  await rRevokeProduct(db(), userId, productCode as ProductCode); // repo writes the audit row inside the same txn
}
export async function addExchangeKey(
  userId: string,
  input: { exchange: string; label: string; apiKey: string; apiSecret: string; mode: 'demo' | 'live' },
): Promise<ExchangeAccountView> {
  const sealed = getVault().seal(JSON.stringify({ apiKey: input.apiKey, apiSecret: input.apiSecret }), `user:${userId}|exchange:${input.exchange}`);
  return rAddExchangeKey(db(), {
    userId,
    exchange: input.exchange,
    label: input.label,
    mode: input.mode,
    keyMask: maskSecret(input.apiKey),
    sealed,
    keyId: process.env.SECRET_VAULT_KEY_ID || 'kek-dev',
  });
}
export async function listExchangeKeys(userId: string): Promise<ExchangeAccountView[]> {
  return rListExchangeKeys(db(), userId);
}
export async function recordExchangeKeyMetadataCheck(userId: string, exchangeAccountId: string): Promise<ExchangeKeyMetadataCheckResult> {
  return rRecordExchangeKeyMetadataCheck(db(), { userId, exchangeAccountId });
}
export async function recentAuditRows() {
  return rRecentAuditEvents(db(), 200);
}

// DB-backed TradingView service (async TvService shape; selected by lib/backend.ts when DATABASE_URL
// is set). Date→epoch-ms normalization happens in rowToTvDto (@wtc/db); audit rows are written inside
// the repo transaction (submit/grant/revoke), so this adapter never double-audits.
export const tvService: TvService = {
  async submitRequest(userId, username, hasEntitlement, now) {
    if (!hasEntitlement) throw new Error('No active tradingview_indicators entitlement'); // fail-closed parity with the memory service
    const row = await rSubmitTvRequest(db(), userId, username, now);
    return rowToTvDto(row);
  },
  async listByUser(userId) {
    return (await rListTvByUser(db(), userId)).map(rowToTvDto);
  },
  async listAll() {
    return (await rListAllTv(db())).map(rowToTvDto);
  },
  async grant(requestId, adminId, now, durationMs) {
    await rGrantTv(db(), requestId, adminId, now, durationMs);
  },
  async revoke(requestId, adminId, now) {
    await rRevokeTv(db(), requestId, adminId, now);
  },
};

// DB-backed LMS service (async LmsService shape; selected by lib/backend.ts when DATABASE_URL is set).
// Thin Part-E surface; createCourse audits inside the repo transaction.
export const lmsService: LmsService = {
  async createCourse(actor, input, now) {
    return rCreateCourse(db(), { ownerTeacherId: actor.userId, title: input.title, description: input.description, published: input.published }, now);
  },
  async listCoursesForTeacher(actor) {
    return rListCoursesForTeacher(db(), actor.userId, actor.isAdmin);
  },
  async listPublishedCourses() {
    return rListPublishedCourses(db());
  },
  async listLessonsForStudent(courseId, hasEducationAccess) {
    return rListLessonsForStudent(db(), courseId, hasEducationAccess);
  },
};
