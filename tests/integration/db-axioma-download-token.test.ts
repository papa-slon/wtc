import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  consumeTerminalDownloadTokenWithAudit,
  createUser,
  issueTerminalDownloadTokenWithAudit,
  seedDatabase,
  schema,
  upsertTerminalRelease,
  type Db,
  type DbUser,
  type TerminalReleaseRow,
} from '@wtc/db';

const NOW = 1_900_000_000_000;

let db: Db;
let user: DbUser;
let release: TerminalReleaseRow;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  user = await createUser(db, {
    email: `axioma-download-db-${randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Axioma Download DB',
  });
  release = await upsertTerminalRelease(db, {
    version: '1.2.3',
    channel: 'stable',
    platform: 'windows-x64',
    publishedAt: new Date(NOW - 60_000),
    downloadUrlTemplate: 'https://axioma-fixture.local/releases/{version}/{platform}/installer.exe',
    checksumSha256: 'a'.repeat(64),
    isCurrent: true,
    actorUserId: user.id,
  });
});

describe('Axioma terminal download token repository', () => {
  it('issues hash-only one-time download tokens with audit and no raw-token persistence', async () => {
    const rawToken = 'raw-download-token-secret';
    const row = await issueTerminalDownloadTokenWithAudit(db, {
      userId: user.id,
      releaseId: release.id,
      version: release.version,
      platform: release.platform,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    }, NOW);

    expect(row.tokenHash).toBe(hashToken(rawToken));
    expect(row.tokenHash).not.toContain(rawToken);
    expect(row.expiresAt?.getTime()).toBe(NOW + 300_000);
    expect(row.consumedAt).toBeNull();

    const allRows = await db.select().from(schema.terminalDownloadEvents);
    expect(JSON.stringify(allRows)).not.toContain(rawToken);

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.download_request'));
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(rawToken);
    expect(JSON.stringify(audits)).not.toContain(hashToken(rawToken));
  });

  it('consumes a token once and records replay as a failed terminal.download audit', async () => {
    const tokenHash = hashToken('consume-me');
    await issueTerminalDownloadTokenWithAudit(db, {
      userId: user.id,
      releaseId: release.id,
      version: release.version,
      platform: release.platform,
      tokenHash,
      expiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);

    const first = await consumeTerminalDownloadTokenWithAudit(db, { userId: user.id, tokenHash }, NOW + 1_000);
    expect(first.consumed).toBe(true);
    if (!first.consumed) throw new Error(first.reason);
    expect(first.row.consumedAt?.getTime()).toBe(NOW + 1_000);

    const second = await consumeTerminalDownloadTokenWithAudit(db, { userId: user.id, tokenHash }, NOW + 2_000);
    expect(second).toMatchObject({ consumed: false, reason: 'already_consumed' });

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'terminal.download'));
    expect(audits).toHaveLength(2);
    expect(audits.some((row) => row.result === 'success')).toBe(true);
    expect(audits.some((row) => row.result === 'failure' && JSON.stringify(row.after).includes('already_consumed'))).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(tokenHash);
  });

  it('rejects expired and wrong-user tokens without consuming them', async () => {
    const expiredHash = hashToken('expired-token');
    await issueTerminalDownloadTokenWithAudit(db, {
      userId: user.id,
      releaseId: release.id,
      version: release.version,
      platform: release.platform,
      tokenHash: expiredHash,
      expiresAt: new Date(NOW - 1_000),
      entitlementVerified: true,
    }, NOW);
    const expired = await consumeTerminalDownloadTokenWithAudit(db, { userId: user.id, tokenHash: expiredHash }, NOW);
    expect(expired).toMatchObject({ consumed: false, reason: 'expired' });

    const other = await createUser(db, {
      email: `axioma-download-other-${randomUUID()}@wtc.local`,
      passwordHash: 'h',
      displayName: 'Other',
    });
    const wrongUserHash = hashToken('wrong-user-token');
    await issueTerminalDownloadTokenWithAudit(db, {
      userId: user.id,
      releaseId: release.id,
      version: release.version,
      platform: release.platform,
      tokenHash: wrongUserHash,
      expiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    const wrongUser = await consumeTerminalDownloadTokenWithAudit(db, { userId: other.id, tokenHash: wrongUserHash }, NOW + 1_000);
    expect(wrongUser).toMatchObject({ consumed: false, reason: 'wrong_user' });

    const [row] = await db
      .select()
      .from(schema.terminalDownloadEvents)
      .where(eq(schema.terminalDownloadEvents.tokenHash, wrongUserHash));
    expect(row?.consumedAt).toBeNull();
  });
});
