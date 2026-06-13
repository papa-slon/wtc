/**
 * DB integration tests for the per-account bot instance feature (migration 0022).
 *
 * Guards the three key invariants of the partial unique-index design:
 *  1. ensureBotInstance called twice with no accountId returns the SAME instance id
 *     (isNull predicate — proves the "eq(col, null)" footgun is not present).
 *  2. ensureBotInstance called with two distinct non-null pub_ids returns two DISTINCT ids
 *     (the named-account bucket is separate from the NULL bucket and from each other).
 *  3. A raw INSERT that duplicates a non-null (user_id, product_code, account_id) triple
 *     throws Postgres error 23505 (unique_violation on bi_user_product_account_idx).
 *
 * All tests use PGlite (in-process WASM Postgres) with the full migration stack,
 * matching the pattern used by db-0002.test.ts and db-0003.test.ts.
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
  ensureBotInstance,
  getBotInstanceForUserProductAccount,
  type Db,
} from '@wtc/db';

let db: Db;
let userId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
}, 60_000);

describe('bot_instances partial unique indexes (migration 0022)', () => {
  it('ensureBotInstance twice with no accountId returns the SAME instance id (isNull guard)', async () => {
    // This is the critical regression guard: if ensureBotInstance used eq(col, null) instead of
    // isNull(), the WHERE predicate would never match and every call would INSERT a new row,
    // eventually triggering a 23505 once the partial unique index is present.
    const first = await ensureBotInstance(db, { userId, productCode: 'legacy_bot' });
    const second = await ensureBotInstance(db, { userId, productCode: 'legacy_bot' });

    expect(first.id).toBe(second.id);
    expect(first.accountId).toBeNull();
    expect(second.accountId).toBeNull();
  });

  it('ensureBotInstance with two distinct pub_ids returns two DISTINCT instance ids', async () => {
    const pubIdA = 'test-pub-id-alpha';
    const pubIdB = 'test-pub-id-beta';

    const instA = await ensureBotInstance(db, { userId, productCode: 'legacy_bot', accountId: pubIdA });
    const instB = await ensureBotInstance(db, { userId, productCode: 'legacy_bot', accountId: pubIdB });

    expect(instA.id).not.toBe(instB.id);
    expect(instA.accountId).toBe(pubIdA);
    expect(instB.accountId).toBe(pubIdB);

    // Neither is the same as the NULL-bucket instance.
    const nullInst = await ensureBotInstance(db, { userId, productCode: 'legacy_bot' });
    expect(instA.id).not.toBe(nullInst.id);
    expect(instB.id).not.toBe(nullInst.id);
  });

  it('calling ensureBotInstance again with the same pub_id returns the same instance id (idempotent)', async () => {
    const pubId = 'test-pub-id-idempotent';

    const first = await ensureBotInstance(db, { userId, productCode: 'legacy_bot', accountId: pubId });
    const second = await ensureBotInstance(db, { userId, productCode: 'legacy_bot', accountId: pubId });

    expect(first.id).toBe(second.id);
    expect(first.accountId).toBe(pubId);
  });

  it('getBotInstanceForUserProductAccount returns null for an unknown account (no-insert read-only)', async () => {
    const result = await getBotInstanceForUserProductAccount(db, {
      userId,
      productCode: 'legacy_bot',
      accountId: 'unknown-pub-id-that-was-never-inserted',
    });
    expect(result).toBeNull();
  });

  it('getBotInstanceForUserProductAccount returns the NULL-bucket row when accountId is omitted', async () => {
    // The NULL bucket was created in the first test.
    const result = await getBotInstanceForUserProductAccount(db, {
      userId,
      productCode: 'legacy_bot',
    });
    expect(result).not.toBeNull();
    expect(result!.accountId).toBeNull();
  });

  it('a raw INSERT that duplicates a non-null (user_id, product_code, account_id) throws 23505 (bi_user_product_account_idx)', async () => {
    // This test proves the partial unique index is actually enforced by Postgres.
    // We use a different user to avoid interference with pub_ids from other tests.
    const dedupUser = await createUser(db, {
      email: 'bot-instance-dup-test@wtc.local',
      passwordHash: 'h',
      displayName: 'DupTest',
    });
    const pubId = 'dup-test-pub-id-unique';

    // First insert via ensureBotInstance (establishes the row).
    await ensureBotInstance(db, { userId: dedupUser.id, productCode: 'legacy_bot', accountId: pubId });

    // Second raw INSERT for the same (user_id, product_code, account_id) must throw 23505.
    // We bypass ensureBotInstance on purpose to hit the DB constraint directly.
    await expect(
      db.insert(schema.botInstances).values({
        userId: dedupUser.id,
        productCode: 'legacy_bot',
        accountId: pubId,
      }),
    ).rejects.toThrow(/23505|unique/i);
  });
});
