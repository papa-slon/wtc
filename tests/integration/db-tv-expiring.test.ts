/**
 * Phase 2.8 / PG5 follow-up — markExpiringSoon pre-pass integration tests (PGlite, real Postgres engine).
 *
 * Isolated beforeAll (own PGlite) so shared db-persistence / db-pg5 state cannot interfere. Uses
 * atomicGrantTv (the atomic grant path: request + grant row + profile pointer). Verifies:
 *   - a grant expiring in 6 days  → status 'expiring_soon' (within the 7-day window);
 *   - a grant expiring in 10 days → unchanged 'granted' (outside the window);
 *   - an already-expired grant    → NOT touched by markExpiringSoon (left for sweepTvExpiry);
 *   - idempotent: a second run marks 0 additional rows;
 *   - a revoked request           → untouched;
 *   - SEQUENCE: a grant marked expiring_soon and then past expiry is REVOKED by sweepTvExpiry
 *     (proves the widened sweep predicate includes 'expiring_soon' — the critical co-land).
 *
 * Source design: docs/handoffs/20260530-2100-ecosystem-tradingview-access-implementer.md (F-02..F-09),
 *                docs/handoffs/20260530-2100-ecosystem-security-auditor.md (F-07/F-08, Decision 4),
 *                docs/handoffs/20260530-2100-ecosystem-tests-runner.md (§3).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
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
  markExpiringSoon,
  sweepTvExpiry,
  listAllTv,
  TV_EXPIRING_SOON_WINDOW_MS,
  type Db,
} from '@wtc/db';

const DAY = 24 * 60 * 60 * 1000;
const BASE_NOW = 1_900_000_000_000; // fixed deterministic clock (future epoch-ms)

let db: Db;
let admin: string, userA: string, userB: string, userC: string, userD: string, userE: string, userF: string;

async function statusOf(reqId: string): Promise<string> {
  const row = (await listAllTv(db)).find((r) => r.id === reqId);
  if (!row) throw new Error(`request ${reqId} not found`);
  return row.status;
}

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  admin = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  userA = (await createUser(db, { email: 'tve-a@wtc.local', passwordHash: 'h', displayName: 'A' })).id;
  userB = (await createUser(db, { email: 'tve-b@wtc.local', passwordHash: 'h', displayName: 'B' })).id;
  userC = (await createUser(db, { email: 'tve-c@wtc.local', passwordHash: 'h', displayName: 'C' })).id;
  userD = (await createUser(db, { email: 'tve-d@wtc.local', passwordHash: 'h', displayName: 'D' })).id;
  userE = (await createUser(db, { email: 'tve-e@wtc.local', passwordHash: 'h', displayName: 'E' })).id;
  userF = (await createUser(db, { email: 'tve-f@wtc.local', passwordHash: 'h', displayName: 'F' })).id;
});

describe('PG5 markExpiringSoon: 7-day window pre-pass', () => {
  it('TV_EXPIRING_SOON_WINDOW_MS is exactly 7 days', () => {
    expect(TV_EXPIRING_SOON_WINDOW_MS).toBe(7 * DAY);
  });

  it('a grant expiring in 6 days transitions to expiring_soon', async () => {
    const req = await submitTvRequest(db, userA, 'tve_a');
    await atomicGrantTv(db, { requestId: req.id, userId: userA, tvUsername: 'tve_a', adminId: admin, durationMs: 6 * DAY }, BASE_NOW);
    const { marked } = await markExpiringSoon(db, BASE_NOW);
    expect(marked).toBeGreaterThanOrEqual(1);
    expect(await statusOf(req.id)).toBe('expiring_soon');
  });

  it('a grant expiring in 10 days stays granted (outside the 7-day window)', async () => {
    const req = await submitTvRequest(db, userB, 'tve_b');
    await atomicGrantTv(db, { requestId: req.id, userId: userB, tvUsername: 'tve_b', adminId: admin, durationMs: 10 * DAY }, BASE_NOW);
    await markExpiringSoon(db, BASE_NOW);
    expect(await statusOf(req.id)).toBe('granted');
  });

  it('an already-expired grant is NOT marked expiring_soon (left for sweepTvExpiry)', async () => {
    const req = await submitTvRequest(db, userC, 'tve_c');
    await atomicGrantTv(db, { requestId: req.id, userId: userC, tvUsername: 'tve_c', adminId: admin, durationMs: -1000 }, BASE_NOW);
    await markExpiringSoon(db, BASE_NOW);
    expect(await statusOf(req.id)).toBe('granted'); // expiresAt <= now is excluded by the `> now` guard
  });

  it('is idempotent: a second run on an already-expiring_soon row marks 0 rows', async () => {
    const req = await submitTvRequest(db, userD, 'tve_d');
    await atomicGrantTv(db, { requestId: req.id, userId: userD, tvUsername: 'tve_d', adminId: admin, durationMs: 5 * DAY }, BASE_NOW);
    const first = await markExpiringSoon(db, BASE_NOW);
    expect(first.marked).toBeGreaterThanOrEqual(1);
    expect(await statusOf(req.id)).toBe('expiring_soon');
    // Re-run at the same instant: this row is now 'expiring_soon', not 'granted', so it is not re-marked.
    const before = await statusOf(req.id);
    await markExpiringSoon(db, BASE_NOW);
    expect(await statusOf(req.id)).toBe(before); // unchanged
  });

  it('a revoked request is not touched by markExpiringSoon', async () => {
    const req = await submitTvRequest(db, userE, 'tve_e');
    await atomicGrantTv(db, { requestId: req.id, userId: userE, tvUsername: 'tve_e', adminId: admin, durationMs: 6 * DAY }, BASE_NOW);
    await atomicRevokeTv(db, req.id, { id: admin, role: 'admin' }, 'manual', BASE_NOW);
    await markExpiringSoon(db, BASE_NOW);
    expect(await statusOf(req.id)).toBe('revoked');
  });
});

describe('PG5 sequence: markExpiringSoon → sweepTvExpiry revokes the expiring_soon row once it expires', () => {
  it('granted(3d) → expiring_soon (markExpiringSoon@now) → revoked (sweepTvExpiry@now+4d)', async () => {
    const req = await submitTvRequest(db, userF, 'tve_f');
    await atomicGrantTv(db, { requestId: req.id, userId: userF, tvUsername: 'tve_f', adminId: admin, durationMs: 3 * DAY }, BASE_NOW);

    // Warn step: 3 days out is within the 7-day window → expiring_soon.
    await markExpiringSoon(db, BASE_NOW);
    expect(await statusOf(req.id)).toBe('expiring_soon');

    // 4 days later the grant is past expiry. The sweep predicate now includes 'expiring_soon', so this
    // row IS revoked (it would have been stranded forever under the old status='granted'-only filter).
    const swept = await sweepTvExpiry(db, BASE_NOW + 4 * DAY);
    expect(swept.expired).toBeGreaterThanOrEqual(1);
    expect(await statusOf(req.id)).toBe('revoked');
  });
});
