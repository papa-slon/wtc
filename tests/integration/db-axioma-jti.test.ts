/**
 * PG6 — Axioma handoff jti replay-prevention store (migration 0004). PGlite (real Postgres engine),
 * isolated beforeAll. Proves the durable replay store end-to-end: record → consume-once → replay /
 * expired / revoked / not_found rejection → per-user revoke sweep → buffered worker purge.
 *
 * `sub` is an OPAQUE WTC user id with NO foreign key (rows must survive user deletion as audit
 * evidence) — so these tests use bare UUIDs for `sub` (no users/seed needed), which also proves the
 * no-FK design. A cross-connection concurrent-consume race is included as an OPT-IN real-PG block
 * (PGlite is single-connection and cannot exercise two pools racing on the conditional UPDATE).
 *
 * Design: docs/handoffs/20260530-2230-ecosystem-db-architect.md (D-5..D-7),
 *         docs/handoffs/20260530-2230-ecosystem-tests-runner.md (F-02/F-07),
 *         docs/AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention + §Cleanup.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  schema,
  recordHandoffJti,
  consumeHandoffJti,
  revokeHandoffJtisByUser,
  purgeExpiredHandoffJtis,
  type Db,
} from '@wtc/db';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const BASE_NOW = 1_900_000_000_000; // fixed deterministic clock (future epoch-ms)
const TTL = 5 * MIN;

let db: Db;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
});

async function recordJti(sub: string, opts?: { issuedAt?: number; expiresAt?: number }): Promise<string> {
  const jti = randomUUID();
  await recordHandoffJti(db, {
    jti,
    sub,
    issuedAt: new Date(opts?.issuedAt ?? BASE_NOW),
    expiresAt: new Date(opts?.expiresAt ?? BASE_NOW + TTL),
  });
  return jti;
}

describe('PG6 consumeHandoffJti — atomic single-use', () => {
  it('migration 0004 created the jti table (recordHandoffJti inserts without error, no user FK)', async () => {
    const jti = await recordJti(randomUUID());
    expect(jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('consume of an unconsumed, unexpired jti → { consumed: true, sub }', async () => {
    const sub = randomUUID();
    const jti = await recordJti(sub);
    const res = await consumeHandoffJti(db, jti, BASE_NOW + 1000);
    expect(res.consumed).toBe(true);
    expect(res.sub).toBe(sub);
  });

  it('second consume of the same jti → { consumed: false, reason: already_used }', async () => {
    const jti = await recordJti(randomUUID());
    expect((await consumeHandoffJti(db, jti, BASE_NOW + 1000)).consumed).toBe(true);
    const replay = await consumeHandoffJti(db, jti, BASE_NOW + 2000);
    expect(replay.consumed).toBe(false);
    expect(replay.reason).toBe('already_used');
  });

  it('consume of an expired jti → { consumed: false, reason: expired }', async () => {
    const jti = await recordJti(randomUUID(), { expiresAt: BASE_NOW + TTL });
    const res = await consumeHandoffJti(db, jti, BASE_NOW + TTL + 1); // 1ms past expiry
    expect(res.consumed).toBe(false);
    expect(res.reason).toBe('expired');
  });

  it('consume of an unknown jti → { consumed: false, reason: not_found }', async () => {
    const res = await consumeHandoffJti(db, randomUUID(), BASE_NOW);
    expect(res.consumed).toBe(false);
    expect(res.reason).toBe('not_found');
  });

  it('consume of a revoked jti → { consumed: false, reason: revoked }', async () => {
    const sub = randomUUID();
    const jti = await recordJti(sub);
    const { revoked } = await revokeHandoffJtisByUser(db, sub, 'entitlement_revoked', BASE_NOW);
    expect(revoked).toBe(1);
    const res = await consumeHandoffJti(db, jti, BASE_NOW + 1000);
    expect(res.consumed).toBe(false);
    expect(res.reason).toBe('revoked');
  });
});

describe('PG6 revokeHandoffJtisByUser — only live rows', () => {
  it('revokes only unused+unrevoked rows for the user; leaves an already-used row untouched', async () => {
    const sub = randomUUID();
    const live1 = await recordJti(sub);
    const live2 = await recordJti(sub);
    const used = await recordJti(sub);
    await consumeHandoffJti(db, used, BASE_NOW + 1000); // now used → must NOT be revoked by the sweep
    const { revoked } = await revokeHandoffJtisByUser(db, sub, 'account_deleted', BASE_NOW + 2000);
    expect(revoked).toBe(2); // live1 + live2 only
    expect((await consumeHandoffJti(db, used, BASE_NOW + 3000)).reason).toBe('already_used');
    expect((await consumeHandoffJti(db, live1, BASE_NOW + 3000)).reason).toBe('revoked');
    expect((await consumeHandoffJti(db, live2, BASE_NOW + 3000)).reason).toBe('revoked');
  });
});

describe('PG6 purgeExpiredHandoffJtis — buffered cleanup', () => {
  it('purges rows past expiry+buffer; keeps within-buffer and live rows', async () => {
    const sub = randomUUID();
    const old = await recordJti(sub, { issuedAt: BASE_NOW - 3 * HOUR, expiresAt: BASE_NOW - 2 * HOUR }); // expired 2h ago
    const recentlyExpired = await recordJti(sub, { issuedAt: BASE_NOW - 10 * MIN, expiresAt: BASE_NOW - 5 * MIN }); // expired 5m ago
    const live = await recordJti(sub, { expiresAt: BASE_NOW + TTL });
    const { purged } = await purgeExpiredHandoffJtis(db, BASE_NOW, HOUR); // 1h buffer
    expect(purged).toBe(1); // only the 2h-ago row is older than expiry + 1h
    expect((await consumeHandoffJti(db, old, BASE_NOW)).reason).toBe('not_found'); // purged
    expect((await consumeHandoffJti(db, recentlyExpired, BASE_NOW)).reason).toBe('expired'); // kept (within buffer)
    expect((await consumeHandoffJti(db, live, BASE_NOW)).consumed).toBe(true); // kept (live)
  });
});

// Cross-connection concurrent-consume race — OPT-IN real Postgres only. PGlite runs all queries on a
// single connection, so it cannot exercise two pools racing on the conditional UPDATE. Requires the
// operator to have applied migrations (npm run db:migrate) against a throwaway wtc_test DB first.
const REAL_PG = process.env.REAL_POSTGRES_DATABASE_URL;
describe.skipIf(!REAL_PG)('PG6 consumeHandoffJti — cross-connection race (real Postgres)', () => {
  it('two concurrent consumes of the same jti → exactly one wins', async () => {
    const postgres = (await import('postgres')).default;
    const { drizzle: pgDrizzle } = await import('drizzle-orm/postgres-js');
    const sql1 = postgres(REAL_PG!, { max: 1 });
    const sql2 = postgres(REAL_PG!, { max: 1 });
    try {
      const db1 = pgDrizzle(sql1, { schema }) as unknown as Db;
      const db2 = pgDrizzle(sql2, { schema }) as unknown as Db;
      const sub = randomUUID(); // no FK — opaque sub is fine
      const jti = randomUUID();
      await recordHandoffJti(db1, { jti, sub, issuedAt: new Date(BASE_NOW), expiresAt: new Date(BASE_NOW + TTL) });
      const [r1, r2] = await Promise.all([
        consumeHandoffJti(db1, jti, BASE_NOW + 1000),
        consumeHandoffJti(db2, jti, BASE_NOW + 1000),
      ]);
      expect([r1.consumed, r2.consumed].filter(Boolean)).toHaveLength(1);
    } finally {
      await sql1.end();
      await sql2.end();
    }
  });
});
