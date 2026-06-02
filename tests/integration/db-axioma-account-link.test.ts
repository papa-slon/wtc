import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consumeAxiomaAccountLinkNonceWithAudit,
  createUser,
  getLinkedAxiomaAccountForUser,
  issueAxiomaAccountLinkNonceWithAudit,
  seedDatabase,
  schema,
  type Db,
  type DbUser,
} from '@wtc/db';

const NOW = 1_900_000_000_000;

let db: Db;
let user: DbUser;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function replayMigrations(pg: PGlite, opts: { through?: string } = {}): Promise<void> {
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => !opts.through || file <= opts.through);
  for (const f of files) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
}

beforeEach(async () => {
  const pg = new PGlite();
  await replayMigrations(pg);
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  user = await createUser(db, {
    email: `axioma-link-${randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Axioma Link',
  });
});

describe('Axioma account-link OTC repository', () => {
  it('replays migration 0010 with hash-only columns and active-link indexes', async () => {
    const rows = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'axioma_account_links'
      ORDER BY column_name
    `);
    const columns = (rows as unknown as { rows: Array<{ column_name: string }> }).rows.map((row) => row.column_name);
    expect(columns).toEqual(expect.arrayContaining([
      'one_time_code',
      'link_nonce_hash',
      'code_expires_at',
      'consumed_at',
      'revoked_at',
      'linked_at',
      'last_verified_at',
      'error_message',
      'updated_at',
    ]));

    const indexes = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'axioma_account_links'
      ORDER BY indexname
    `);
    expect((indexes as unknown as { rows: Array<{ indexname: string }> }).rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      'aal_active_axioma_user_idx',
      'aal_active_user_idx',
      'aal_code_expires_at_idx',
      'aal_link_nonce_hash_idx',
      'aal_user_state_idx',
    ]));
  });

  it('revokes and clears legacy plaintext OTC rows during migration 0010', async () => {
    const pg = new PGlite();
    await replayMigrations(pg, { through: '0009_wide_orphan.sql' });
    await pg.exec(`
      INSERT INTO users (id, email, password_hash, display_name, created_at)
      VALUES ('00000000-0000-0000-0000-000000000123', 'legacy-otc@wtc.local', 'h', 'Legacy OTC', now());
      INSERT INTO axioma_account_links (id, user_id, state, one_time_code, code_expires_at, created_at)
      VALUES ('00000000-0000-0000-0000-000000000456', '00000000-0000-0000-0000-000000000123', 'pending', 'raw-legacy-otc', now() + interval '5 minutes', now());
    `);
    await pg.exec(readFileSync(join(process.cwd(), 'packages', 'db', 'migrations', '0010_axioma_account_link_hash.sql'), 'utf8'));

    const legacyDb = drizzle(pg, { schema }) as unknown as Db;
    const rows = await legacyDb.select().from(schema.axiomaAccountLinks);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.oneTimeCode).toBeNull();
    expect(rows[0]!.state).toBe('revoked');
    expect(rows[0]!.revokedAt).toBeInstanceOf(Date);
  });

  it('issues hash-only OTC rows, revokes prior pending rows, and redacts audit payloads', async () => {
    const rawToken = 'raw-account-link-secret';
    const old = await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: hashToken('old-token'),
      codeExpiresAt: new Date(NOW + 60_000),
      entitlementVerified: true,
    }, NOW);

    const row = await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: hashToken(rawToken),
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    }, NOW + 1_000);

    expect(row.linkNonceHash).toBe(hashToken(rawToken));
    expect(row.oneTimeCode).toBeNull();
    expect(row.state).toBe('pending');
    expect(row.codeExpiresAt?.getTime()).toBe(NOW + 300_000);

    const [oldRow] = await db.select().from(schema.axiomaAccountLinks).where(eq(schema.axiomaAccountLinks.id, old.id));
    expect(oldRow?.state).toBe('revoked');
    expect(oldRow?.revokedAt?.getTime()).toBe(NOW + 1_000);

    const allRows = await db.select().from(schema.axiomaAccountLinks);
    expect(JSON.stringify(allRows)).not.toContain(rawToken);

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_init'));
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toContain(rawToken);
    expect(JSON.stringify(audits)).not.toContain(hashToken(rawToken));
  });

  it('rejects non-canonical hash input before persistence', async () => {
    await expect(issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: 'raw-account-link-secret',
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW)).rejects.toThrow(/SHA-256 hex/);

    const rows = await db.select().from(schema.axiomaAccountLinks);
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_init'));
    expect(rows).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('consumes an OTC once, sets linked metadata, and exposes deterministic linked-account reads', async () => {
    const tokenHash = hashToken('consume-link-token');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: tokenHash,
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);

    const first = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: tokenHash,
      axiomaUserId: 'axioma-user-123',
    }, NOW + 1_000);
    expect(first.consumed).toBe(true);
    if (!first.consumed) throw new Error(first.reason);
    expect(first.row.state).toBe('linked');
    expect(first.row.axiomaUserId).toBe('axioma-user-123');
    expect(first.row.consumedAt?.getTime()).toBe(NOW + 1_000);
    expect(first.row.linkedAt?.getTime()).toBe(NOW + 1_000);

    const linked = await getLinkedAxiomaAccountForUser(db, user.id);
    expect(linked).toMatchObject({ userId: user.id, axiomaUserId: 'axioma-user-123' });

    const replay = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: tokenHash,
      axiomaUserId: 'axioma-user-123',
    }, NOW + 2_000);
    expect(replay).toMatchObject({ consumed: false, reason: 'already_consumed' });

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_complete'));
    expect(audits).toHaveLength(2);
    expect(audits.some((row) => row.result === 'success')).toBe(true);
    expect(audits.some((row) => row.result === 'failure' && JSON.stringify(row.after).includes('already_consumed'))).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(tokenHash);
  });

  it('rejects unknown, expired, revoked, invalid-user, and duplicate-active consume attempts', async () => {
    const unknown = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: hashToken('unknown'),
      axiomaUserId: 'axioma-unknown',
    }, NOW);
    expect(unknown).toMatchObject({ consumed: false, reason: 'not_found' });

    const expiredHash = hashToken('expired');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: expiredHash,
      codeExpiresAt: new Date(NOW - 1_000),
      entitlementVerified: true,
    }, NOW);
    const expired = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: expiredHash,
      axiomaUserId: 'axioma-expired',
    }, NOW);
    expect(expired).toMatchObject({ consumed: false, reason: 'expired' });

    const invalidHash = hashToken('invalid-user');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: invalidHash,
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    const invalid = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: invalidHash,
      axiomaUserId: ' ',
    }, NOW + 1_000);
    expect(invalid).toMatchObject({ consumed: false, reason: 'invalid_axioma_user_id' });

    const firstActiveHash = hashToken('first-active');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: firstActiveHash,
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    expect((await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: firstActiveHash,
      axiomaUserId: 'axioma-active-user',
    }, NOW + 1_000)).consumed).toBe(true);

    const secondActiveHash = hashToken('second-active');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: secondActiveHash,
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW + 2_000);
    const duplicateForUser = await consumeAxiomaAccountLinkNonceWithAudit(db, {
      linkNonceHash: secondActiveHash,
      axiomaUserId: 'axioma-second-user',
    }, NOW + 3_000);
    expect(duplicateForUser).toMatchObject({ consumed: false, reason: 'already_linked' });
  });

  it('enforces active-link uniqueness while allowing revoked history and pending rows', async () => {
    const other = await createUser(db, {
      email: `axioma-link-other-${randomUUID()}@wtc.local`,
      passwordHash: 'h',
      displayName: 'Other Axioma Link',
    });

    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'linked',
      axiomaUserId: 'shared-axioma-user',
      linkedAt: new Date(NOW),
      lastVerifiedAt: new Date(NOW),
    });
    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'revoked',
      axiomaUserId: 'old-axioma-user',
      revokedAt: new Date(NOW - 1_000),
      linkedAt: new Date(NOW - 2_000),
    });
    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'pending',
      linkNonceHash: hashToken('pending-history'),
      codeExpiresAt: new Date(NOW + 300_000),
    });

    await expect(db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'linked',
      axiomaUserId: 'another-axioma-user',
      linkedAt: new Date(NOW + 1_000),
    })).rejects.toThrow();

    await expect(db.insert(schema.axiomaAccountLinks).values({
      userId: other.id,
      state: 'linked',
      axiomaUserId: 'shared-axioma-user',
      linkedAt: new Date(NOW + 1_000),
    })).rejects.toThrow();

    const linked = await getLinkedAxiomaAccountForUser(db, user.id);
    expect(linked?.axiomaUserId).toBe('shared-axioma-user');
  });
});
