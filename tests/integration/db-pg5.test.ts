/**
 * Phase 2.7 / PG5 repository integration tests (PGlite — real Postgres engine, no Docker).
 * Isolated beforeAll (own PGlite) so the shared db-persistence state cannot interfere.
 *
 *   (1) sweepTvExpiry now DELEGATES to atomicRevokeTv (system actor): an expired GRANTED request is
 *       fully revoked — request status='revoked', grant.revokedAt + revokeReason='expired_by_worker',
 *       grant.revokedBy=null (system), profile.currentGrantId nulled, a tv_access.revoke audit row with
 *       actorUserId=null / actorRole='system', and an informational tradingview_access_tasks row queued.
 *   (2) listUsersWithEmailByIds: batched id→email Map, empty-ids short-circuit, dedupe, missing id absent.
 *
 * Source: docs/handoffs/20260530-1930-ecosystem-tradingview-access-implementer.md (D-01/D-02) and
 *         docs/handoffs/20260530-1930-ecosystem-security-auditor.md (F-02/F-03).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  findUserByEmail,
  recentAuditEvents,
  submitTvRequest,
  atomicGrantTv,
  sweepTvExpiry,
  listAllTv,
  listTvGrantsForUser,
  getTvProfile,
  listUsersWithEmailByIds,
  TV_EXPIRED_BY_WORKER_REASON,
  type Db,
} from '@wtc/db';

let db: Db;
let admin: string, userA: string, userB: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  admin = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  userA = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  userB = (await createUser(db, { email: 'pg5-userb@wtc.local', passwordHash: 'h', displayName: 'B-PG5' })).id;
}, 30_000); // 30s: initializing PGlite + replaying all migrations can exceed the 10s default under parallel suite load (PG8 / tests-runner F-07)

// ── PG5 (d): sweepTvExpiry auto-revokes via atomicRevokeTv (system actor) ──────────────────────────
describe('PG5 sweepTvExpiry → atomicRevokeTv (expired_by_worker, system actor)', () => {
  it('fully revokes an expired grant: request + grant row + profile pointer + system audit', async () => {
    const req = await submitTvRequest(db, userB, 'pg5_trader_b');
    // Grant with a duration already in the past → expiresAt < now (real grant row + profile pointer).
    const grant = await atomicGrantTv(db, {
      requestId: req.id,
      userId: userB,
      tvUsername: 'pg5_trader_b',
      adminId: admin,
      durationMs: -1000,
    });
    // Precondition: profile points at the new grant.
    expect((await getTvProfile(db, userB))!.currentGrantId).toBe(grant.id);

    const swept = await sweepTvExpiry(db, Date.now());
    expect(swept.expired).toBeGreaterThanOrEqual(1);
    expect(swept.tasksQueued).toBeGreaterThanOrEqual(1);

    // Request row is terminal 'revoked' (not merely 'expired').
    const reqRow = (await listAllTv(db)).find((r) => r.id === req.id)!;
    expect(reqRow.status).toBe('revoked');

    // Grant row stamped: revokedAt set, revokeReason='expired_by_worker', revokedBy=null (system).
    const g = (await listTvGrantsForUser(db, userB)).find((x) => x.id === grant.id)!;
    expect(g.revokedAt).not.toBeNull();
    expect(g.revokeReason).toBe(TV_EXPIRED_BY_WORKER_REASON);
    expect(g.revokeReason).toBe('expired_by_worker');
    expect(g.revokedBy).toBeNull();

    // Profile pointer cleared.
    expect((await getTvProfile(db, userB))!.currentGrantId).toBeNull();

    // Audit row: tv_access.revoke with the SYSTEM actor (null id, role 'system') + reason in payload.
    const events = await recentAuditEvents(db, 1000);
    const revoke = events.find((e) => e.action === 'tv_access.revoke' && e.targetId === req.id)!;
    expect(revoke).toBeDefined();
    expect(revoke.actorUserId).toBeNull();
    expect(revoke.actorRole).toBe('system');
    expect((revoke.after as Record<string, unknown>).reason).toBe('expired_by_worker');

    // Informational revoke task queued (WTC marks revoked; TV-side removal is still manual).
    const tasks = await db.select().from(schema.tradingviewAccessTasks).where(eq(schema.tradingviewAccessTasks.requestId, req.id));
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('a second sweep finds nothing left (idempotent — revoked rows are not re-swept)', async () => {
    const second = await sweepTvExpiry(db, Date.now());
    expect(second.expired).toBe(0);
    expect(second.tasksQueued).toBe(0);
  });
});

// ── PG5 (e/f): listUsersWithEmailByIds batched lookup ──────────────────────────────────────────────
describe('PG5 listUsersWithEmailByIds (kills the admin-queue N+1)', () => {
  it('returns an id→email Map for the requested ids', async () => {
    const map = await listUsersWithEmailByIds(db, [userA, userB]);
    expect(map.get(userA)).toBe('user@wtc.local');
    expect(map.get(userB)).toBe('pg5-userb@wtc.local');
    expect(map.size).toBe(2);
  });

  it('empty ids returns an empty Map (no query issued)', async () => {
    const map = await listUsersWithEmailByIds(db, []);
    expect(map.size).toBe(0);
  });

  it('dedupes duplicate ids and omits unknown ids (caller falls back to the id)', async () => {
    const unknownId = '00000000-0000-0000-0000-0000000000ff';
    const map = await listUsersWithEmailByIds(db, [userA, userA, unknownId]);
    expect(map.get(userA)).toBe('user@wtc.local');
    expect(map.has(unknownId)).toBe(false);
    expect(map.size).toBe(1);
  });
});
