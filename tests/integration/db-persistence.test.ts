/**
 * DB persistence integration test against a REAL Postgres engine via PGlite (in-process WASM Postgres).
 * No Docker required. Applies the generated Drizzle migration, then exercises every @wtc/db repository
 * and the seed. The production driver is postgres-js (DATABASE_URL); the query API is identical, so
 * this verifies the repository SQL end-to-end.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  addExchangeKey,
  listExchangeKeys,
  summarizeExchangeKeyMetadata,
  recordExchangeKeyMetadataCheck,
  createDbAuditWriter,
  recentAuditEvents,
  submitTvRequest,
  listTvByUser,
  listAllTv,
  grantTv,
  revokeTv,
  sweepTvExpiry,
  rowToTvDto,
  createCourse,
  listCoursesForTeacher,
  listPublishedCourses,
  listLessonsForStudent,
  type Db,
} from '@wtc/db';
import { hashToken } from '@wtc/auth';
import { hasAccess } from '@wtc/entitlements';
import type { SealedSecret } from '@wtc/crypto';

let db: Db;

beforeAll(async () => {
  const pg = new PGlite(); // in-memory, ephemeral
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
});

describe('@wtc/db persistence (PGlite — real Postgres engine)', () => {
  it('seeds from an empty database', async () => {
    await seedDatabase(db);
    const user = await findUserByEmail(db, 'user@wtc.local');
    expect(user).not.toBeNull();
    expect(user!.roles).toContain('user');
    const ents = await entitlementsOf(db, user!.id);
    expect(ents.some((e) => e.productCode === 'tortila_bot')).toBe(true);
    expect(hasAccess(ents, 'tortila_bot', Date.now())).toBe(true);
  });

  it('creates a user, round-trips a session, and destroys it', async () => {
    const before = await recentAuditEvents(db, 1000);
    const u = await createUser(db, { email: 'new@wtc.local', passwordHash: 'phc-hash', displayName: 'New', auditRegistration: true });
    expect(u.roles).toEqual(['user']);
    const after = await recentAuditEvents(db, 1000);
    const registration = after.slice(before.length).find((e) => e.action === 'auth.register' && e.targetId === u.id);
    expect(registration).toMatchObject({
      actorUserId: u.id,
      actorRole: 'user',
      targetType: 'user',
      targetId: u.id,
      result: 'success',
    });
    expect(registration?.after).toEqual({ roles: ['user'], hasDisplayName: true });
    expect(JSON.stringify(registration)).not.toContain('phc-hash');
    expect(JSON.stringify(registration)).not.toContain('new@wtc.local');
    const token = 'raw-token-abc';
    await createSession(db, u.id, hashToken(token), new Date(Date.now() + 60_000));
    expect((await userForTokenHash(db, hashToken(token), new Date()))?.id).toBe(u.id);
    await destroySession(db, hashToken(token));
    expect(await userForTokenHash(db, hashToken(token), new Date())).toBeNull();
  });

  it('rejects duplicate email', async () => {
    const before = (await recentAuditEvents(db, 1000)).filter((e) => e.action === 'auth.register').length;
    await expect(createUser(db, { email: 'user@wtc.local', passwordHash: 'x', displayName: 'Dup' })).rejects.toThrow(/already registered/);
    const after = (await recentAuditEvents(db, 1000)).filter((e) => e.action === 'auth.register').length;
    expect(after).toBe(before);
  });

  it('grants and revokes entitlements (audited atomically, no duplicate rows, fail-closed)', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    await grantProduct(db, admin!.id, 'club');
    await grantProduct(db, admin!.id, 'club'); // idempotent — unique (user_id, product_code) prevents a 2nd row
    expect((await entitlementsOf(db, admin!.id)).filter((e) => e.productCode === 'club').length).toBe(1);
    expect(hasAccess(await entitlementsOf(db, admin!.id), 'club', Date.now())).toBe(true);
    await revokeProduct(db, admin!.id, 'club');
    expect(hasAccess(await entitlementsOf(db, admin!.id), 'club', Date.now())).toBe(false);
    // grant/revoke write their audit row inside the same transaction
    const events = await recentAuditEvents(db, 500);
    expect(events.some((e) => e.action === 'product.grant')).toBe(true);
    expect(events.some((e) => e.action === 'product.revoke')).toBe(true);
  });

  it('stores exchange keys sealed and never returns the secret material', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const sealed: SealedSecret = { v: 1, keyId: 'kek-dev', wrappedDek: 'd2VkAAA', payload: 'cGF5AAA' };
    const view = await addExchangeKey(db, { userId: u!.id, exchange: 'bingx', label: 'Main', mode: 'demo', keyMask: '••••1234', sealed, keyId: 'kek-dev' });
    const keys = await listExchangeKeys(db, u!.id);
    expect(keys.find((k) => k.id === view.id)?.keyMask).toBe('••••1234');
    const summary = await summarizeExchangeKeyMetadata(db, u!.id);
    expect(summary.accountCount).toBe(keys.length);
    expect(summary.vaultMetadataCount).toBeGreaterThanOrEqual(1);
    const serialized = JSON.stringify(keys);
    expect(serialized).not.toContain('wrappedDek');
    expect(serialized).not.toContain('cGF5AAA');
    const check = await recordExchangeKeyMetadataCheck(db, { userId: u!.id, exchangeAccountId: view.id, now: 1_700_000_000_000 });
    expect(check).toMatchObject({
      exchangeAccountId: view.id,
      exchange: 'bingx',
      mode: 'demo',
      keyMask: view.keyMask,
      checkKind: 'sealed_metadata_only',
      livePing: false,
      outcome: 'vault_present',
      reason: 'vault_metadata_present_live_ping_not_run',
    });
    expect(JSON.stringify(check)).not.toContain('wrappedDek');
    expect(JSON.stringify(check)).not.toContain('cGF5AAA');

    const other = await createUser(db, { email: 'other-key-check@wtc.local', passwordHash: 'h', displayName: 'Other Key Check' });
    await expect(summarizeExchangeKeyMetadata(db, other.id)).resolves.toEqual({ accountCount: 0, vaultMetadataCount: 0 });
    const missing = await recordExchangeKeyMetadataCheck(db, { userId: other.id, exchangeAccountId: view.id });
    expect(missing).toMatchObject({
      exchangeAccountId: view.id,
      exchange: null,
      mode: null,
      keyMask: null,
      checkKind: 'sealed_metadata_only',
      livePing: false,
      outcome: 'missing',
      reason: 'owned_key_not_found_or_incomplete',
    });

    const events = await recentAuditEvents(db, 1000);
    const metadataCheck = events.find((e) => e.action === 'exchange_key.metadata_check' && e.targetId === view.id);
    expect(metadataCheck).toBeTruthy();
    expect(events.find((e) => e.action === 'exchange_key.test' && e.targetId === view.id)).toBeUndefined();
    expect(JSON.stringify(metadataCheck)).toContain('sealed_metadata_only');
    expect(JSON.stringify(metadataCheck)).toContain('"livePing":false');
    expect(JSON.stringify(metadataCheck)).not.toContain('wrappedDek');
    expect(JSON.stringify(metadataCheck)).not.toContain('cGF5AAA');
    expect(JSON.stringify(metadataCheck)).not.toContain('apiKey');
    expect(JSON.stringify(metadataCheck)).not.toContain('apiSecret');
  });

  it('writes redacted audit events to the DB', async () => {
    const audit = createDbAuditWriter(db);
    await audit.write({ actorRole: 'user', action: 'exchange_key.create', targetType: 'exchange_account', after: { apiKey: 'LEAKVAL', apiSecret: 'LEAKVAL2' } });
    const events = await recentAuditEvents(db, 200);
    const found = events.find((e) => e.action === 'exchange_key.create');
    expect(found).toBeTruthy();
    expect(JSON.stringify(found)).not.toContain('LEAKVAL');
  });

  it('TradingView: submit → grant (already expired) → sweep auto-revokes + queues task', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const req = await submitTvRequest(db, u!.id, 'tv_user_1');
    expect((await listTvByUser(db, u!.id)).some((r) => r.id === req.id)).toBe(true);
    await grantTv(db, req.id, admin!.id, Date.now(), -1000); // expiresAt in the past
    const swept = await sweepTvExpiry(db, Date.now());
    expect(swept.expired).toBeGreaterThanOrEqual(1);
    expect(swept.tasksQueued).toBeGreaterThanOrEqual(1);
    // PG5: the sweep now delegates to atomicRevokeTv (system actor), so the terminal status is
    // 'revoked' (reason 'expired_by_worker'), not just 'expired'.
    expect((await listTvByUser(db, u!.id)).find((r) => r.id === req.id)?.status).toBe('revoked');
  });

  // ---- Phase 1.6: concurrent race safety ----
  it('grantProduct is idempotent under concurrent duplicate grants (no throw, no duplicate row)', async () => {
    const u = await createUser(db, { email: 'race-grant@wtc.local', passwordHash: 'h', displayName: 'RG' });
    await expect(
      Promise.all([grantProduct(db, u.id, 'club'), grantProduct(db, u.id, 'club')]),
    ).resolves.toBeDefined();
    const ents = (await entitlementsOf(db, u.id)).filter((e) => e.productCode === 'club');
    expect(ents.length).toBe(1); // unique (user_id, product_code) + onConflictDoUpdate ⇒ exactly one row
    expect(ents[0]!.status).toBe('active');
  });

  it('audits every grant call — one product.grant row per call, even for an idempotent re-grant', async () => {
    const u = await createUser(db, { email: 'race-audit@wtc.local', passwordHash: 'h', displayName: 'RA' });
    await Promise.all([grantProduct(db, u.id, 'club'), grantProduct(db, u.id, 'club')]);
    const grants = (await recentAuditEvents(db, 1000)).filter(
      (e) => e.action === 'product.grant' && e.targetId === `${u.id}:club`,
    );
    // Defined contract: the entitlement upsert is idempotent (1 row) but each grant CALL is audited.
    expect(grants.length).toBe(2);
    expect((await entitlementsOf(db, u.id)).filter((e) => e.productCode === 'club').length).toBe(1);
  });

  it('createUser maps a concurrent duplicate email to the friendly error (one row persisted)', async () => {
    const email = 'race-email@wtc.local';
    const results = await Promise.allSettled([
      createUser(db, { email, passwordHash: 'h1', displayName: 'A' }),
      createUser(db, { email, passwordHash: 'h2', displayName: 'B' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected.length).toBe(1);
    expect(String(rejected[0]!.reason?.message ?? rejected[0]!.reason)).toMatch(/already registered/i);
    expect(await findUserByEmail(db, email)).not.toBeNull();
  });
});

describe('TradingView access (DB): audit + DTO + admin list + revoke + sweep idempotency', () => {
  it('submitTvRequest persists, returns a row, and writes a tradingview.submit audit row', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const before = (await recentAuditEvents(db, 1000)).length;
    const req = await submitTvRequest(db, u!.id, 'tv_audit_user');
    expect(req.id).toBeTruthy();
    const events = await recentAuditEvents(db, 1000);
    const submit = events.find((e) => e.action === 'tradingview.submit' && e.targetId === req.id);
    expect(submit).toBeTruthy();
    expect(submit!.actorUserId).toBe(u!.id);
    expect(events.length).toBeGreaterThan(before);
  });

  it('rowToTvDto normalizes Date timestamps to epoch-ms numbers (no raw Date leaks to the UI)', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const list = await listTvByUser(db, u!.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.requestedAt instanceof Date).toBe(true); // raw row exposes a Date
    const dto = rowToTvDto(list[0]!);
    expect(typeof dto.requestedAt).toBe('number'); // the DTO must be epoch-ms
    expect(Number.isFinite(dto.requestedAt)).toBe(true);
  });

  it('listAllTv returns every user’s requests (admin queue)', async () => {
    const other = await createUser(db, { email: 'tv-other@wtc.local', passwordHash: 'h', displayName: 'O' });
    await submitTvRequest(db, other.id, 'tv_other_user');
    const all = await listAllTv(db);
    expect(all.some((r) => r.userId === other.id)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('grantTv then revokeTv flips status and writes grant + revoke audit rows with the admin actor', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const req = await submitTvRequest(db, u!.id, 'tv_grant_revoke');
    await grantTv(db, req.id, admin!.id, Date.now(), 90 * 86_400_000);
    expect((await listTvByUser(db, u!.id)).find((r) => r.id === req.id)?.status).toBe('granted');
    await revokeTv(db, req.id, admin!.id, Date.now());
    expect((await listTvByUser(db, u!.id)).find((r) => r.id === req.id)?.status).toBe('revoked');
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'tradingview.grant' && e.targetId === req.id && e.actorUserId === admin!.id)).toBe(true);
    expect(events.some((e) => e.action === 'tradingview.revoke' && e.targetId === req.id && e.actorUserId === admin!.id)).toBe(true);
  });

  it('sweepTvExpiry is idempotent — a second sweep finds nothing left to expire', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const req = await submitTvRequest(db, u!.id, 'tv_sweep_idem');
    await grantTv(db, req.id, admin!.id, Date.now(), -1000); // expiresAt in the past
    const first = await sweepTvExpiry(db, Date.now());
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect(first.tasksQueued).toBeGreaterThanOrEqual(1);
    const second = await sweepTvExpiry(db, Date.now());
    expect(second.expired).toBe(0);
    expect(second.tasksQueued).toBe(0);
  });
});

describe('Education / LMS (DB, thin Part-E): create + list + student visibility + audit', () => {
  it('createCourse persists, returns an epoch-ms DTO, and writes an education.course_create audit row', async () => {
    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    const c = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'DB Course A', description: 'desc', published: true });
    expect(c.id).toBeTruthy();
    expect(typeof c.createdAt).toBe('number');
    expect(c.published).toBe(true);
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.course_create' && e.targetId === c.id && e.actorUserId === teacher!.id)).toBe(true);
  });

  it('listCoursesForTeacher returns a teacher’s own courses (all for admin), never another teacher’s', async () => {
    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    const other = await createUser(db, { email: 'teacher2@wtc.local', passwordHash: 'h', displayName: 'T2' });
    const mine = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'Mine', published: false });
    const theirs = await createCourse(db, { ownerTeacherId: other.id, title: 'Theirs', published: false });
    const teacherList = await listCoursesForTeacher(db, teacher!.id, false);
    expect(teacherList.some((c) => c.id === mine.id)).toBe(true);
    expect(teacherList.some((c) => c.id === theirs.id)).toBe(false); // ownership enforced — not another teacher's
    const adminList = await listCoursesForTeacher(db, teacher!.id, true); // isAdmin → sees all
    expect(adminList.some((c) => c.id === theirs.id)).toBe(true);
  });

  it('listPublishedCourses excludes unpublished courses', async () => {
    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    const pub = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'Pub', published: true });
    const draft = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'Draft', published: false });
    const published = await listPublishedCourses(db);
    expect(published.some((c) => c.id === pub.id)).toBe(true);
    expect(published.some((c) => c.id === draft.id)).toBe(false);
    expect(published.every((c) => c.published)).toBe(true);
  });

  it('listLessonsForStudent is fail-closed (no access / unpublished course → []) and returns ordered published lessons', async () => {
    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    const course = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'With lessons', published: true });
    const draft = await createCourse(db, { ownerTeacherId: teacher!.id, title: 'Draft lessons', published: false });
    await db.insert(schema.lessons).values([
      { courseId: course.id, title: 'L2', order: 2, published: true },
      { courseId: course.id, title: 'L1', order: 1, published: true },
      { courseId: course.id, title: 'Hidden', order: 3, published: false },
    ]);
    await db.insert(schema.lessons).values({ courseId: draft.id, title: 'D1', order: 1, published: true });

    expect(await listLessonsForStudent(db, course.id, false)).toEqual([]); // no education access → []
    expect(await listLessonsForStudent(db, draft.id, true)).toEqual([]); // unpublished course → []
    const lessons = await listLessonsForStudent(db, course.id, true);
    expect(lessons.map((l) => l.title)).toEqual(['L1', 'L2']); // only published, ordered by `order`
  });
});
