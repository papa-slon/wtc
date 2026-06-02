import { describe, expect, it, beforeAll } from 'vitest';
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
  submitTvRequest,
  atomicGrantTv,
  atomicRevokeTv,
  sweepTvExpiry,
  repairMissingTvRevokeTasks,
  listTvAccessTasks,
  markTvAccessTaskDone,
  listAllTv,
  listTvGrantsForUser,
  TV_EXPIRED_BY_WORKER_REASON,
  type Db,
} from '@wtc/db';

let db: Db;
let userA: string;
let userB: string;
let admin: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userA = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  userB = (await createUser(db, { email: 'tv-hardening-b@wtc.local', passwordHash: 'h', displayName: 'TV B' })).id;
  admin = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
}, 30_000);

describe('TradingView grant/revoke hardening', () => {
  it('atomicGrantTv derives userId and tvUsername from the request row, ignoring tampered caller hints', async () => {
    const req = await submitTvRequest(db, userA, 'real_tv_username');
    const grant = await atomicGrantTv(db, {
      requestId: req.id,
      userId: userB,
      tvUsername: 'tampered_hidden_username',
      adminId: admin,
      durationMs: 30 * 86_400_000,
      reason: 'paid subscription',
    });

    expect(grant.userId).toBe(userA);
    expect(grant.tvUsername).toBe('real_tv_username');

    const profileA = await db.select().from(schema.tradingviewProfiles).where(eq(schema.tradingviewProfiles.userId, userA));
    const profileB = await db.select().from(schema.tradingviewProfiles).where(eq(schema.tradingviewProfiles.userId, userB));
    expect(profileA[0]!.currentGrantId).toBe(grant.id);
    expect(profileA[0]!.tvUsername).toBe('real_tv_username');
    expect(profileB.length).toBe(0);
  });

  it('atomicGrantTv rejects stale re-grants and does not create extra grant rows', async () => {
    const req = await submitTvRequest(db, userA, 'grant_once_only');
    await atomicGrantTv(db, { requestId: req.id, adminId: admin, durationMs: 30 * 86_400_000 });

    await expect(
      atomicGrantTv(db, { requestId: req.id, adminId: admin, durationMs: 30 * 86_400_000 }),
    ).rejects.toThrow(/tv_request_not_grantable/);

    const grants = (await listTvGrantsForUser(db, userA)).filter((g) => g.requestId === req.id);
    expect(grants.length).toBe(1);
  });

  it('atomicRevokeTv rejects pending and already revoked requests', async () => {
    const pending = await submitTvRequest(db, userA, 'pending_revoke_rejected');
    await expect(atomicRevokeTv(db, pending.id, { id: admin, role: 'admin' }, 'not active')).rejects.toThrow(/tv_request_not_revokable/);
    expect((await listAllTv(db)).find((r) => r.id === pending.id)?.status).toBe('pending');

    const granted = await submitTvRequest(db, userA, 'revoke_once_only');
    await atomicGrantTv(db, { requestId: granted.id, adminId: admin, durationMs: 30 * 86_400_000 });
    await atomicRevokeTv(db, granted.id, { id: admin, role: 'admin' }, 'manual revoke');
    await expect(atomicRevokeTv(db, granted.id, { id: admin, role: 'admin' }, 'duplicate revoke')).rejects.toThrow(/tv_request_not_revokable/);
  });

  it('queues manual TV revoke tasks and lets admins mark them done once', async () => {
    const now = 1_900_100_000_000;
    const req = await submitTvRequest(db, userA, 'manual_task_revoke');
    await atomicGrantTv(db, { requestId: req.id, adminId: admin, durationMs: -1000 }, now);

    const swept = await sweepTvExpiry(db, now + 2000);
    expect(swept.tasksQueued).toBeGreaterThanOrEqual(1);

    const openTasks = await listTvAccessTasks(db);
    const task = openTasks.find((t) => t.requestId === req.id);
    expect(task).toBeTruthy();
    expect(task!.done).toBe(false);

    await expect(markTvAccessTaskDone(db, task!.id, admin, now + 3000)).resolves.toBe(true);
    await expect(markTvAccessTaskDone(db, task!.id, admin, now + 4000)).resolves.toBe(false);

    const allTasks = await listTvAccessTasks(db, { includeDone: true });
    expect(allTasks.find((t) => t.id === task!.id)?.done).toBe(true);
  });

  it('expiry sweep queues external revoke tasks through the atomic revoke transaction', () => {
    const repo = readFileSync(join(process.cwd(), 'packages', 'db', 'src', 'repositories.ts'), 'utf8');
    const sweepStart = repo.indexOf('export async function sweepTvExpiry');
    const sweepEnd = repo.indexOf('export async function repairMissingTvRevokeTasks');
    const sweepBody = repo.slice(sweepStart, sweepEnd);
    expect(sweepBody).toContain('queueExternalRevokeTask: true');
    expect(sweepBody).not.toContain('db.insert(s.tradingviewAccessTasks)');
    expect(repo).toContain('options?: { queueExternalRevokeTask?: boolean }');
  });

  it('repairs historical worker-expiry revokes that missed an external revoke task', async () => {
    const now = 1_900_200_000_000;
    const req = await submitTvRequest(db, userA, 'historical_missing_worker_task', now);
    await atomicGrantTv(db, { requestId: req.id, adminId: admin, durationMs: -1000 }, now);
    await atomicRevokeTv(db, req.id, { id: null, role: 'system' }, TV_EXPIRED_BY_WORKER_REASON, now + 1000, {
      queueExternalRevokeTask: false,
    });
    expect((await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === req.id)).toHaveLength(0);

    await expect(repairMissingTvRevokeTasks(db, now + 2000)).resolves.toEqual({ repaired: 1 });
    const repairedTasks = (await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === req.id);
    expect(repairedTasks).toHaveLength(1);
    expect(repairedTasks[0]!.kind).toBe('revoke');
    expect(repairedTasks[0]!.done).toBe(false);

    await expect(repairMissingTvRevokeTasks(db, now + 3000)).resolves.toEqual({ repaired: 0 });
    expect((await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === req.id)).toHaveLength(1);
  });

  it('does not repair manual revokes or requests that already have a done revoke task', async () => {
    const now = 1_900_300_000_000;
    const manual = await submitTvRequest(db, userA, 'manual_revoke_not_repaired', now);
    await atomicGrantTv(db, { requestId: manual.id, adminId: admin, durationMs: -1000 }, now);
    await atomicRevokeTv(db, manual.id, { id: admin, role: 'admin' }, 'manual', now + 1000, {
      queueExternalRevokeTask: false,
    });

    const alreadyTasked = await submitTvRequest(db, userA, 'already_done_task_not_duplicated', now);
    await atomicGrantTv(db, { requestId: alreadyTasked.id, adminId: admin, durationMs: -1000 }, now);
    await atomicRevokeTv(
      db,
      alreadyTasked.id,
      { id: null, role: 'system' },
      TV_EXPIRED_BY_WORKER_REASON,
      now + 1000,
      { queueExternalRevokeTask: false },
    );
    await db.insert(schema.tradingviewAccessTasks).values({
      requestId: alreadyTasked.id,
      kind: 'revoke',
      done: true,
    });

    await expect(repairMissingTvRevokeTasks(db, now + 2000)).resolves.toEqual({ repaired: 0 });
    expect((await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === manual.id)).toHaveLength(0);
    expect((await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === alreadyTasked.id)).toHaveLength(1);
  });

  it('does not duplicate an existing revoke task when atomicRevokeTv queues externally', async () => {
    const now = 1_900_400_000_000;
    const req = await submitTvRequest(db, userA, 'existing_task_before_revoke', now);
    await atomicGrantTv(db, { requestId: req.id, adminId: admin, durationMs: -1000 }, now);
    await db.insert(schema.tradingviewAccessTasks).values({ requestId: req.id, kind: 'revoke', done: false });

    const revoked = await atomicRevokeTv(
      db,
      req.id,
      { id: null, role: 'system' },
      TV_EXPIRED_BY_WORKER_REASON,
      now + 1000,
      { queueExternalRevokeTask: true },
    );

    expect(revoked.taskQueued).toBe(false);
    const tasks = (await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === req.id);
    expect(tasks).toHaveLength(1);
  });

  it('enforces one task per request and kind at the database layer', async () => {
    const now = 1_900_500_000_000;
    const req = await submitTvRequest(db, userA, 'unique_task_identity', now);
    await db.insert(schema.tradingviewAccessTasks).values({ requestId: req.id, kind: 'revoke', done: true });

    await expect(
      db.insert(schema.tradingviewAccessTasks).values({ requestId: req.id, kind: 'revoke', done: false }),
    ).rejects.toThrow();

    const tasks = (await listTvAccessTasks(db, { includeDone: true })).filter((t) => t.requestId === req.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.done).toBe(true);
  });

  it('dedupes historical task rows before creating the unique index', () => {
    const migration = readFileSync(join(process.cwd(), 'packages', 'db', 'migrations', '0008_eminent_tattoo.sql'), 'utf8');

    expect(migration).toContain('row_number() OVER');
    expect(migration).toContain('PARTITION BY request_id, kind');
    expect(migration).toContain('CASE WHEN done = false THEN 0 ELSE 1 END');
    expect(migration).toContain('CREATE UNIQUE INDEX "tvat_request_kind_idx"');
  });
});
