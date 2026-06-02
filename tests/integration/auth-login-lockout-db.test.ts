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
  attemptUserLogin,
  recentAuditEvents,
  type Db,
} from '@wtc/db';

const minute = 60_000;

let db: Db;
let seq = 0;

async function makeUser() {
  seq += 1;
  return createUser(db, {
    email: `lockout-${seq}@wtc.local`,
    passwordHash: 'stored-hash',
    displayName: `Lockout ${seq}`,
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
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
});

describe('DB-backed account login lockout', () => {
  it('sets a 15-minute lockout on the fifth failed password attempt', async () => {
    const user = await makeUser();
    const now = 1_800_000_000_000;

    for (let i = 0; i < 4; i += 1) {
      const result = await attempt(user.email, 'wrong-password', now + i * 1_000);
      expect(result).toMatchObject({ ok: false, reason: 'invalid', lockoutApplied: false });
    }

    const fifth = await attempt(user.email, 'wrong-password', now + 4_000);
    expect(fifth).toMatchObject({ ok: false, reason: 'invalid', lockoutApplied: true, reviewRequired: false });
    if (fifth.ok || fifth.reason !== 'invalid') throw new Error('expected invalid login result');
    expect(fifth.lockedUntil).toBe(now + 4_000 + 15 * minute);

    const row = await userRow(user.id);
    expect(row.failedLogin15mCount).toBe(5);
    expect(row.failedLogin60mCount).toBe(5);
    expect(row.failedLoginTotalCount).toBe(5);
    expect(row.accountLockedUntil?.getTime()).toBe(fifth.lockedUntil);
  });

  it('denies a locked account without running password verification', async () => {
    const user = await makeUser();
    const now = 1_800_000_100_000;
    for (let i = 0; i < 5; i += 1) await attempt(user.email, 'wrong-password', now + i);

    let verifierCalls = 0;
    const locked = await attemptUserLogin(db, {
      email: user.email,
      password: 'correct-password',
      now: now + 1_000,
      verifyPassword: async () => {
        verifierCalls += 1;
        return true;
      },
    });

    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    expect(verifierCalls).toBe(0);
  });

  it('clears failed counters when a successful login happens after the lock window expires', async () => {
    const user = await makeUser();
    const now = 1_800_000_200_000;
    for (let i = 0; i < 5; i += 1) await attempt(user.email, 'wrong-password', now + i);

    const success = await attempt(user.email, 'correct-password', now + 15 * minute + 1_000);
    expect(success.ok).toBe(true);

    const row = await userRow(user.id);
    expect(row.failedLogin15mCount).toBe(0);
    expect(row.failedLogin60mCount).toBe(0);
    expect(row.failedLoginTotalCount).toBe(0);
    expect(row.lastFailedLoginAt).toBeNull();
    expect(row.accountLockedUntil).toBeNull();
    expect(row.accountLockoutReviewRequiredAt).toBeNull();
  });

  it('keeps unknown-account failures generic and does not persist the raw identifier in audit target fields', async () => {
    const email = `missing-${Date.now()}@wtc.local`;
    const result = await attempt(email, 'wrong-password', 1_800_000_300_000);
    expect(result).toEqual({ ok: false, reason: 'invalid', lockoutApplied: false, reviewRequired: false, lockedUntil: null });

    const events = await recentAuditEvents(db, 500);
    const found = events.find((event) => event.action === 'auth.login_failed' && event.targetType === 'auth_login_identifier');
    expect(found).toBeTruthy();
    expect(found!.targetId).toBeNull();
    expect(JSON.stringify(found)).not.toContain(email);
    expect(found!.after).toMatchObject({ outcome: 'invalid', accountResolved: false });
  });

  it('marks review-required after twenty total failures without disclosing it to the web action contract', async () => {
    const user = await makeUser();
    const now = 1_800_000_400_000;
    let latest: Awaited<ReturnType<typeof attempt>> | null = null;

    for (let i = 0; i < 20; i += 1) {
      latest = await attempt(user.email, 'wrong-password', now + i * 16 * minute);
      expect(latest.ok).toBe(false);
      if (latest.ok) throw new Error('expected invalid login result');
      expect(latest.reason).toBe('invalid');
    }

    expect(latest).toMatchObject({ ok: false, reason: 'invalid', reviewRequired: true });
    const row = await userRow(user.id);
    expect(row.failedLoginTotalCount).toBe(20);
    expect(row.accountLockoutReviewRequiredAt?.getTime()).toBe(now + 19 * 16 * minute);
    expect(row.accountLockedUntil).toBeNull();
  });
});
