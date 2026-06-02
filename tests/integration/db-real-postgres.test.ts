/**
 * REAL Postgres integration harness — OPT-IN, skipped by default.
 *
 * Runs ONLY when `REAL_POSTGRES_DATABASE_URL` points at a throwaway Postgres (e.g. a local PG17
 * `wtc_test` DB). Without it, the whole suite is skipped — so `npm test` stays green with no DB.
 * This is the cross-connection / real-engine complement to `db-persistence.test.ts` (PGlite, single
 * connection): it exercises the postgres-js driver, real migrations, and a genuine concurrent
 * `grantProduct` race across separate pool connections.
 *
 * Operator (do NOT run against any non-throwaway DB):
 *   $env:REAL_POSTGRES_DATABASE_URL = "postgres://<credentials>@127.0.0.1:5432/wtc_test"  # fill in user:password
 *   npm test -- tests/integration/db-real-postgres.test.ts
 *
 * Safety: creates only the schema from the committed migrations + seed; never touches live servers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getTableName, isTable } from 'drizzle-orm';
import {
  schema,
  seedDatabase,
  findUserByEmail,
  createUser,
  createSession,
  userForTokenHash,
  destroySession,
  entitlementsOf,
  grantProduct,
  revokeProduct,
  insertWebhookEventOnce,
  attemptUserLogin,
  unlockUserLoginLockout,
  type Db,
} from '@wtc/db';
import { hashToken } from '@wtc/auth';
import { hasAccess } from '@wtc/entitlements';

const URL = process.env.REAL_POSTGRES_DATABASE_URL;
const run = !!URL;

function currentSchemaTableNames(): string[] {
  const names: string[] = [];
  for (const value of Object.values(schema)) {
    if (isTable(value)) {
      names.push(getTableName(value));
    }
  }
  return names.sort();
}

function expectDbTimestamp(value: unknown): void {
  if (value instanceof Date) {
    expect(Number.isNaN(value.getTime())).toBe(false);
    return;
  }
  expect(typeof value).toBe('string');
  expect(Number.isNaN(Date.parse(value as string))).toBe(false);
}

/**
 * Safety guard: refuse to run the (schema-mutating) real-PG harness against anything that is not an
 * obvious throwaway test database. Parses the DB name from the connection URL and requires it to match
 * `wtc_test` or `wtc_test_<suffix>`. Exported + pure so it is unit-tested below WITHOUT a database.
 * NOTE: uses `globalThis.URL` because the module-level `const URL` (above) shadows the global constructor.
 */
export function assertThrowawayDbName(databaseUrl: string): string {
  let name: string;
  try {
    name = new globalThis.URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('real-PG harness: REAL_POSTGRES_DATABASE_URL is not a valid URL.');
  }
  if (!/^wtc_test(_[a-z0-9]+)?$/.test(name)) {
    throw new Error(
      `real-PG harness REFUSED: database "${name || '(none)'}" is not a throwaway test DB. ` +
        'Point REAL_POSTGRES_DATABASE_URL at a database named wtc_test or wtc_test_<suffix> only.',
    );
  }
  return name;
}

// Own pool for the harness (so we can assert pool teardown explicitly). A second connection is used
// to prove the cross-connection concurrent-grant race the PGlite single-connection test cannot.
let sql: ReturnType<typeof postgres> | undefined;
let db: Db;

// describe.skipIf keeps the whole block inert unless REAL_POSTGRES_DATABASE_URL is set.
describe.skipIf(!run)('@wtc/db real Postgres (postgres-js, opt-in via REAL_POSTGRES_DATABASE_URL)', () => {
  beforeAll(async () => {
    assertThrowawayDbName(URL as string); // refuse non-throwaway DBs before opening any connection
    sql = postgres(URL as string, { max: 10 });
    // Apply the committed migrations in order (idempotent-enough for a fresh throwaway DB).
    const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
    const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) await sql.unsafe(readFileSync(join(migDir, f), 'utf8'));
    db = drizzle(sql, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    // Pool teardown — must resolve cleanly (no hanging handles).
    if (sql) await sql.end({ timeout: 5 });
  });

  it('migrate + seed from empty, idempotent on a second seed', async () => {
    await seedDatabase(db);
    await seedDatabase(db); // second seed must not throw (onConflictDoNothing)
    const user = await findUserByEmail(db, 'user@wtc.local');
    expect(user).not.toBeNull();
    expect(hasAccess(await entitlementsOf(db, user!.id), 'tortila_bot', Date.now())).toBe(true);
  });

  it('unique entitlement: sequential re-grant keeps exactly one row', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    await grantProduct(db, admin!.id, 'club');
    await grantProduct(db, admin!.id, 'club');
    expect((await entitlementsOf(db, admin!.id)).filter((e) => e.productCode === 'club').length).toBe(1);
    await revokeProduct(db, admin!.id, 'club');
  });

  it('TRUE cross-connection concurrent grantProduct → exactly one row, no unique-violation throw', async () => {
    const u = await createUser(db, { email: `race-${Date.now()}@wtc.local`, passwordHash: 'h', displayName: 'Race' });
    // A second independent pool/connection so the two grants race at the DB, not just in one session.
    const sql2 = postgres(URL as string, { max: 4 });
    const db2 = drizzle(sql2, { schema }) as unknown as Db;
    try {
      await expect(Promise.all([grantProduct(db, u.id, 'club'), grantProduct(db2, u.id, 'club')])).resolves.toBeDefined();
      const rows = (await entitlementsOf(db, u.id)).filter((e) => e.productCode === 'club');
      expect(rows.length).toBe(1);
      expect(rows[0]!.status).toBe('active');
    } finally {
      await sql2.end({ timeout: 5 });
    }
  });

  it('session create → resolve → destroy', async () => {
    const u = await createUser(db, { email: `sess-${Date.now()}@wtc.local`, passwordHash: 'h', displayName: 'Sess' });
    const token = `tok-${Date.now()}`;
    await createSession(db, u.id, hashToken(token), new Date(Date.now() + 60_000));
    expect((await userForTokenHash(db, hashToken(token), new Date()))?.id).toBe(u.id);
    await destroySession(db, hashToken(token));
    expect(await userForTokenHash(db, hashToken(token), new Date())).toBeNull();
  });

  it('FK cascade: deleting a user removes its entitlements', async () => {
    const u = await createUser(db, { email: `cascade-${Date.now()}@wtc.local`, passwordHash: 'h', displayName: 'Cascade' });
    await grantProduct(db, u.id, 'club');
    expect((await entitlementsOf(db, u.id)).length).toBeGreaterThan(0);
    await sql!.unsafe('DELETE FROM users WHERE id = $1', [u.id]);
    expect((await entitlementsOf(db, u.id)).length).toBe(0); // ON DELETE CASCADE
  });

  it('migration set produces the same base table set as the current Drizzle schema', async () => {
    const rows = await sql!.unsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    const actual = rows.map((row) => (row as unknown as { table_name: string }).table_name);
    expect(actual).toEqual(currentSchemaTableNames());
  });

  it('concurrent insertWebhookEventOnce on same (provider,event_id) → one winner, one duplicate, one row', async () => {
    const eventId = `evt_realpg_race_${Date.now()}`;
    const sql2 = postgres(URL as string, { max: 4 });
    const db2 = drizzle(sql2, { schema }) as unknown as Db;
    try {
      const input = {
        provider: 'stripe',
        eventId,
        eventType: 'checkout.session.completed',
        userId: null,
        planCode: null,
        billingEvent: null,
        status: 'no_op' as const,
      };
      // Two independent pools race the same event — the real cross-connection test PGlite cannot do.
      const [r1, r2] = await Promise.all([
        insertWebhookEventOnce(db, input),
        insertWebhookEventOnce(db2, input),
      ]);
      const results = [r1, r2];
      expect(results.filter((r) => !r.isDuplicate).length).toBe(1); // exactly one claimed the insert
      expect(results.filter((r) => r.isDuplicate).length).toBe(1); // exactly one saw the conflict
      expect(typeof results.find((r) => !r.isDuplicate)!.rowId).toBe('string');
      expect(results.find((r) => r.isDuplicate)!.rowId).toBeNull();
      const rows = await sql!.unsafe(
        `SELECT id FROM billing_webhook_events WHERE provider = 'stripe' AND event_id = $1`,
        [eventId],
      );
      expect(rows.length).toBe(1); // UNIQUE(provider,event_id) held under concurrent insert
    } finally {
      await sql2.end({ timeout: 5 });
    }
  });

  it('TRUE cross-connection failed-login attempts serialize into one locked account state', async () => {
    const email = `lockout-race-${Date.now()}@wtc.local`;
    const u = await createUser(db, { email, passwordHash: 'stored-hash', displayName: 'Lockout Race' });
    const pools = Array.from({ length: 5 }, () => postgres(URL as string, { max: 1 }));
    const dbs = pools.map((pool) => drizzle(pool, { schema }) as unknown as Db);
    try {
      const results = await Promise.all(
        dbs.map((raceDb) =>
          attemptUserLogin(raceDb, {
            email,
            password: 'wrong-password',
            now: 1_800_001_000_000,
            verifyPassword: async () => false,
          }),
        ),
      );

      expect(results.every((result) => !result.ok && result.reason === 'invalid')).toBe(true);
      expect(results.filter((result) => !result.ok && result.reason === 'invalid' && result.lockoutApplied).length).toBe(1);

      const rows = await sql!.unsafe(
        `SELECT failed_login_15m_count, failed_login_60m_count, failed_login_total_count, account_locked_until
           FROM users WHERE id = $1`,
        [u.id],
      );
      expect(rows[0]).toMatchObject({
        failed_login_15m_count: 5,
        failed_login_60m_count: 5,
        failed_login_total_count: 5,
      });
      expectDbTimestamp((rows[0] as unknown as { account_locked_until: unknown }).account_locked_until);
    } finally {
      await Promise.all(pools.map((pool) => pool.end({ timeout: 5 })));
    }
  });

  it('TRUE cross-connection duplicate account unlocks serialize and leave lockout state cleared', async () => {
    const email = `unlock-race-${Date.now()}@wtc.local`;
    const target = await createUser(db, { email, passwordHash: 'stored-hash', displayName: 'Unlock Race' });
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    for (let i = 0; i < 5; i += 1) {
      await attemptUserLogin(db, {
        email,
        password: 'wrong-password',
        now: 1_800_003_000_000 + i,
        verifyPassword: async () => false,
      });
    }

    const sql2 = postgres(URL as string, { max: 1 });
    const db2 = drizzle(sql2, { schema }) as unknown as Db;
    try {
      await expect(Promise.all([
        unlockUserLoginLockout(db, {
          targetUserId: target.id,
          actorUserId: admin!.id,
          reason: 'first unlock race attempt',
          now: 1_800_003_010_000,
        }),
        unlockUserLoginLockout(db2, {
          targetUserId: target.id,
          actorUserId: admin!.id,
          reason: 'second unlock race attempt',
          now: 1_800_003_010_001,
        }),
      ])).resolves.toHaveLength(2);

      const rows = await sql!.unsafe(
        `SELECT failed_login_15m_count, failed_login_60m_count, failed_login_total_count, account_locked_until, account_lockout_review_required_at
           FROM users WHERE id = $1`,
        [target.id],
      );
      expect(rows[0]).toMatchObject({
        failed_login_15m_count: 0,
        failed_login_60m_count: 0,
        failed_login_total_count: 0,
        account_locked_until: null,
        account_lockout_review_required_at: null,
      });
    } finally {
      await sql2.end({ timeout: 5 });
    }
  });
});

// Visibility when skipped: a single always-present test so the file isn't reported as empty.
describe('real Postgres harness availability', () => {
  it(run ? 'REAL_POSTGRES_DATABASE_URL set — real-PG suite active' : 'skipped (set REAL_POSTGRES_DATABASE_URL to enable)', () => {
    expect(typeof run).toBe('boolean');
  });
});

// The DB-name guard is pure and ALWAYS unit-tested (no database required) — it proves the harness
// refuses to run against a non-throwaway database even before any connection is opened.
describe('real-PG harness DB-name guard (assertThrowawayDbName)', () => {
  it('accepts wtc_test and wtc_test_<suffix>', () => {
    expect(assertThrowawayDbName('postgres://127.0.0.1:5432/wtc_test')).toBe('wtc_test');
    expect(assertThrowawayDbName('postgres://127.0.0.1:5432/wtc_test_ci')).toBe('wtc_test_ci');
    expect(assertThrowawayDbName('postgresql://host:5432/wtc_test_abc123')).toBe('wtc_test_abc123');
  });
  it('refuses any non-throwaway database name', () => {
    for (const bad of [
      'postgres://host:5432/postgres',
      'postgres://host:5432/wtc_main',
      'postgres://host:5432/production',
      'postgres://host:5432/wtc_testx',
      'postgres://host:5432/',
    ]) {
      expect(() => assertThrowawayDbName(bad)).toThrow(/throwaway/i);
    }
  });
  it('throws on a malformed URL', () => {
    expect(() => assertThrowawayDbName('not a url')).toThrow(/valid URL/i);
  });
});

describe('real Postgres schema table list', () => {
  it('can derive the current Drizzle schema table list for the real-PG table-set proof', () => {
    const names = currentSchemaTableNames();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('users');
    expect(names).toContain('audit_logs');
    expect(names).toContain('lms_object_cleanup_tasks');
  });
});
