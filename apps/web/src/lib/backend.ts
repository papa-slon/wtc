import 'server-only';
/**
 * Backend selector. PRODUCTION uses @wtc/db (Postgres) repositories; dev/demo uses the in-memory
 * store. FAIL CLOSED: in production a missing DATABASE_URL throws — the app will never silently run
 * the in-memory store in production.
 *
 * Persists the security/access-critical core to Postgres: users, sessions, entitlements, audit logs,
 * exchange-key sealed secrets. As of Phase 1.7 the TradingView web UI is ALSO DB-backed (async
 * TvService — DB adapter in db-store.ts, in-memory adapter in demo.ts, selected here and fail-closed
 * like the core). The LMS web UI is DB-wired the same way (thin Part-E model — the full
 * enrollments/lesson-progress contract is Phase 1.8).
 */
import * as memory from './demo';
import * as dbStore from './db-store';
import type { AuditWriter } from '@wtc/audit';
import type { Db } from '@wtc/db';
import type { TvService } from './tv-types';
import type { LmsService } from './lms-types';

const useDb = !!process.env.DATABASE_URL;
// FAIL CLOSED in production WITHOUT DATABASE_URL — but lazily (at first call), so `next build`
// (which runs as production but has no runtime DATABASE_URL) is not broken at module load.
const denied = process.env.NODE_ENV === 'production' && !useDb;
const core = useDb ? dbStore : memory;

const DENIED_MSG = '[backend] DATABASE_URL is required in production — refusing to use the in-memory store';

function guard<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  if (!denied) return fn;
  return () => {
    throw new Error(DENIED_MSG);
  };
}

export const backendMode: 'postgres' | 'memory' = useDb ? 'postgres' : 'memory';

/**
 * Server-side Db accessor for Phase-2.1 feature surfaces (bot-config, TradingView grants, terminal,
 * support/notifications) that call the @wtc/db repositories directly. Returns the real Db when
 * DATABASE_URL is set; null in dev (the surface then renders an honest, labelled demo state); and
 * throws fail-closed in production without a DATABASE_URL (parity with the core guard()). These
 * surfaces persist when a DB is connected and never fabricate data in the memory fallback.
 */
export function getServerDb(): Db | null {
  if (denied) throw new Error(DENIED_MSG);
  return useDb ? dbStore.getDb() : null;
}

// Core (DB in production, in-memory in dev). Each is fail-closed in production without DATABASE_URL.
export const findUserByEmail = guard(core.findUserByEmail);
export const getUserById = guard(core.getUserById);
export const listUsers = guard(core.listUsers);
export const createUser = guard(core.createUser);
export const attemptLogin = guard(core.attemptLogin);
export const verifyLogin = guard(core.verifyLogin);
export const createSession = guard(core.createSession);
export const userForToken = guard(core.userForToken);
export const destroySession = guard(core.destroySession);
export const entitlementsOf = guard(core.entitlementsOf);
export const grantProduct = guard(core.grantProduct);
export const revokeProduct = guard(core.revokeProduct);
export const addExchangeKey = guard(core.addExchangeKey);
export const listExchangeKeys = guard(core.listExchangeKeys);
export const audit: AuditWriter = denied ? { async write() { throw new Error('[backend] DATABASE_URL required in production'); } } : core.audit;

// TradingView web UI: DB-backed when DATABASE_URL is set, in-memory otherwise; FAIL CLOSED in
// production without DATABASE_URL (a denied stub throws the same message as the core guard()).
const deniedTvService: TvService = {
  async submitRequest() { throw new Error(DENIED_MSG); },
  async listByUser() { throw new Error(DENIED_MSG); },
  async listAll() { throw new Error(DENIED_MSG); },
  async grant() { throw new Error(DENIED_MSG); },
  async revoke() { throw new Error(DENIED_MSG); },
};
export const tvService: TvService = denied ? deniedTvService : useDb ? dbStore.tvService : memory.tvService;
export type { TvRequestView } from './tv-types';

// LMS web UI (thin Part-E model): DB-backed when DATABASE_URL is set, in-memory otherwise; FAIL CLOSED
// in production without DATABASE_URL. Full LMS contract (enrollments/progress) is Phase 1.8.
const deniedLmsService: LmsService = {
  async createCourse() { throw new Error(DENIED_MSG); },
  async listCoursesForTeacher() { throw new Error(DENIED_MSG); },
  async listPublishedCourses() { throw new Error(DENIED_MSG); },
  async listLessonsForStudent() { throw new Error(DENIED_MSG); },
};
export const lmsService: LmsService = denied ? deniedLmsService : useDb ? dbStore.lmsService : memory.lmsService;
export type { CourseView, LessonView } from './lms-types';
export const DEMO_PASSWORD = memory.DEMO_PASSWORD;

export type { DemoUser, ExchangeAccountView } from './demo';

export interface AuditView {
  id: string;
  ts: number;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: string;
}

/** Recent audit events, newest first, normalized for the admin audit-log view. */
export async function recentAuditEvents(): Promise<AuditView[]> {
  if (useDb) {
    const rows = await dbStore.recentAuditRows();
    return rows
      .map((r) => ({ id: r.id, ts: r.ts.getTime(), actorRole: r.actorRole, action: r.action, targetType: r.targetType, targetId: r.targetId, result: r.result }))
      .reverse();
  }
  return [...memory.auditEvents]
    .reverse()
    .map((e) => ({ id: e.id, ts: e.ts, actorRole: e.actorRole, action: e.action, targetType: e.targetType, targetId: e.targetId, result: e.result }));
}
