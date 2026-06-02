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
  attemptUserLogin,
  unlockUserLoginLockout,
  recentAuditEvents,
  type Db,
} from '@wtc/db';

let db: Db;
let seq = 0;

async function makeUser() {
  seq += 1;
  return createUser(db, {
    email: `unlock-${seq}@wtc.local`,
    passwordHash: 'stored-hash',
    displayName: `Unlock ${seq}`,
  });
}

async function attempt(email: string, password: string, now: number) {
  return attemptUserLogin(db, {
    email,
    password,
    now,
    verifyPassword: async (_hash, plaintext) => plaintext === 'correct-password',
  });
}

async function userRow(id: string) {
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  expect(row).toBeTruthy();
  return row!;
}

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
});

describe('DB-backed admin account unlock', () => {
  it('clears lockout state and writes auth.account_unlock audit in one repository call', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const user = await makeUser();
    const now = 1_800_002_000_000;
    for (let i = 0; i < 5; i += 1) await attempt(user.email, 'wrong-password', now + i);

    const locked = await userRow(user.id);
    expect(locked.failedLoginTotalCount).toBe(5);
    expect(locked.accountLockedUntil).not.toBeNull();

    const reason = `security unlock ${user.id.slice(0, 8)}`;
    const result = await unlockUserLoginLockout(db, {
      targetUserId: user.id,
      actorUserId: admin!.id,
      reason,
      now: now + 1_000,
    });
    expect(result).toEqual({ userId: user.id, wasLocked: true, reviewRequired: false });

    const row = await userRow(user.id);
    expect(row.failedLogin15mCount).toBe(0);
    expect(row.failedLogin15mResetAt).toBeNull();
    expect(row.failedLogin60mCount).toBe(0);
    expect(row.failedLogin60mResetAt).toBeNull();
    expect(row.failedLoginTotalCount).toBe(0);
    expect(row.lastFailedLoginAt).toBeNull();
    expect(row.accountLockedUntil).toBeNull();
    expect(row.accountLockoutReviewRequiredAt).toBeNull();

    const events = await recentAuditEvents(db, 1000);
    const audit = events.find((event) => event.action === 'auth.account_unlock' && event.targetId === user.id);
    expect(audit).toBeTruthy();
    expect(audit).toMatchObject({
      actorUserId: admin!.id,
      actorRole: 'admin',
      targetType: 'user',
      targetId: user.id,
      result: 'success',
    });
    expect(audit!.before).toMatchObject({ failedLoginTotalCount: 5 });
    expect(audit!.after).toMatchObject({ failedLoginTotalCount: 0, unlocked: true, reason });
    expect(JSON.stringify(audit)).not.toContain('stored-hash');
    expect(JSON.stringify(audit)).not.toContain('correct-password');
  });

  it('allows login after unlock and starts the next failure from a cleared state', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const user = await makeUser();
    const now = 1_800_002_100_000;
    for (let i = 0; i < 5; i += 1) await attempt(user.email, 'wrong-password', now + i);

    await unlockUserLoginLockout(db, {
      targetUserId: user.id,
      actorUserId: admin!.id,
      reason: 'operator verified identity',
      now: now + 1_000,
    });

    const success = await attempt(user.email, 'correct-password', now + 2_000);
    expect(success.ok).toBe(true);

    const failure = await attempt(user.email, 'wrong-password', now + 3_000);
    expect(failure).toMatchObject({ ok: false, reason: 'invalid', lockoutApplied: false });
    const row = await userRow(user.id);
    expect(row.failedLogin15mCount).toBe(1);
    expect(row.failedLogin60mCount).toBe(1);
    expect(row.failedLoginTotalCount).toBe(1);
  });

  it('clears a review-required account even when no active lockout remains', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const user = await makeUser();
    const now = 1_800_002_200_000;
    for (let i = 0; i < 20; i += 1) await attempt(user.email, 'wrong-password', now + i * 16 * 60_000);

    const reviewed = await userRow(user.id);
    expect(reviewed.accountLockedUntil).toBeNull();
    expect(reviewed.accountLockoutReviewRequiredAt).not.toBeNull();

    const result = await unlockUserLoginLockout(db, {
      targetUserId: user.id,
      actorUserId: admin!.id,
      reason: 'admin reviewed repeated failures',
      now: now + 20 * 16 * 60_000,
    });
    expect(result).toEqual({ userId: user.id, wasLocked: false, reviewRequired: true });
    const row = await userRow(user.id);
    expect(row.failedLoginTotalCount).toBe(0);
    expect(row.accountLockoutReviewRequiredAt).toBeNull();
  });

  it('rejects a missing target user without writing a successful unlock audit row', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const missing = '00000000-0000-0000-0000-000000000000';
    await expect(
      unlockUserLoginLockout(db, {
        targetUserId: missing,
        actorUserId: admin!.id,
        reason: 'missing target check',
        now: 1_800_002_300_000,
      }),
    ).rejects.toThrow(/user_not_found/);

    const events = await recentAuditEvents(db, 1000);
    expect(events.some((event) => event.action === 'auth.account_unlock' && event.targetId === missing)).toBe(false);
  });
});
