import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { schema, seedDatabase, createUser, createCourse, getCourseById, updateCourse, createLesson, updateLesson, listLessonsForCourse, createMaterial, listMaterials, deleteMaterial, purgeExpiredLmsMaterialFiles, listExpiredLmsObjectMaterialFiles, finalizeLmsObjectMaterialCleanup, getMaterialFileForPublishedLesson, type Db } from '@wtc/db';
import { prepareLmsFileMaterial, sanitizeLmsEmbedHtml } from '@wtc/lms';

/**
 * Phase 3.1 — LMS rich columns (migration 0005) on PGlite (real Postgres engine, no Docker).
 *  - courses.level / courses.tags / lessons.content_type / lessons.external_url round-trip via the real repos
 *    (applies the ACTUAL generated migrations 0000–0005, so this also proves 0005 itself runs on Postgres SQL).
 *  - the content_type backfill is verified against the 0005 SQL applied to a pre-0005 lessons table.
 *
 * NO array operators (= ANY / @> / &&): PGlite does not implement them reliably, and tags are display/write
 * only this session. CHECK enforcement is NOT asserted here — the Zod enum in the action layer is the binding
 * boundary (see lms-ph3-1-static.test.ts); the DB CHECK is defence-in-depth on real Postgres.
 */
let pg: PGlite;
let db: Db;
let teacher: string;

beforeAll(async () => {
  pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db); // seeds the roles table so createUser's user_roles FK (role_code) resolves
  teacher = (await createUser(db, { email: 'ph31-teacher@wtc.local', passwordHash: 'h', displayName: 'PH31 Teacher', roles: ['teacher'] })).id;
}, 30_000); // PGlite migration-apply hook can exceed the 10s default when the host is under load (e.g. right after e2e) — match db-pg5
afterAll(async () => {
  await pg.close();
});

describe('Phase 3.1 — courses.level + courses.tags (PGlite round-trip)', () => {
  it('createCourse defaults level=beginner and tags=[]', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Defaults' });
    expect(c.level).toBe('beginner');
    expect(c.tags).toEqual([]);
  });
  it('createCourse round-trips level + tags (text[] literal, no array operators)', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Rich', level: 'advanced', tags: ['rsi', 'risk'] });
    expect(c.level).toBe('advanced');
    expect(c.tags).toEqual(['rsi', 'risk']);
    const reload = await getCourseById(db, c.id);
    expect(reload?.level).toBe('advanced');
    expect(reload?.tags).toEqual(['rsi', 'risk']);
  });
  it('updateCourse can change level + tags', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'ToEdit' });
    await updateCourse(db, c.id, { level: 'intermediate', tags: ['edited'] }, teacher);
    const reload = await getCourseById(db, c.id);
    expect(reload?.level).toBe('intermediate');
    expect(reload?.tags).toEqual(['edited']);
  });
});

describe('Phase 3.1 — lessons.content_type + lessons.external_url (PGlite round-trip)', () => {
  it('createLesson with contentType=article persists, external_url stays null', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'CT-article' });
    const l = await createLesson(db, { courseId: c.id, title: 'A', contentType: 'article' }, teacher);
    expect(l.contentType).toBe('article');
    expect(l.externalUrl).toBeNull();
  });
  it('createLesson with contentType=link persists external_url', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'CT-link' });
    const l = await createLesson(db, { courseId: c.id, title: 'L', contentType: 'link', externalUrl: 'https://example.com' }, teacher);
    expect(l.contentType).toBe('link');
    expect(l.externalUrl).toBe('https://example.com');
  });
  it('createLesson without contentType derives video when videoUrl present (backward-compat)', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'CT-default' });
    const l = await createLesson(db, { courseId: c.id, title: 'V', videoUrl: 'https://v.example' }, teacher);
    expect(l.contentType).toBe('video');
  });
  it('updateLesson can switch a lesson to a link with an external_url', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'CT-switch' });
    const l = await createLesson(db, { courseId: c.id, title: 'S', contentType: 'article' }, teacher);
    await updateLesson(db, l.id, { contentType: 'link', externalUrl: 'https://x.example' }, teacher);
    const rows = await listLessonsForCourse(db, c.id);
    const row = rows.find((x) => x.id === l.id);
    expect(row?.contentType).toBe('link');
    expect(row?.externalUrl).toBe('https://x.example');
  });
  it('createLesson with contentType=embed persists canonical sanitized embed_html only', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'CT-embed' });
    const embed = sanitizeLmsEmbedHtml('<iframe src="https://www.youtube.com/embed/lesson1" title="Lesson embed"></iframe>');
    const l = await createLesson(db, { courseId: c.id, title: 'E', contentType: 'embed', embedHtml: embed.html }, teacher);
    expect(l.contentType).toBe('embed');
    expect(l.embedHtml).toBe(embed.html);
    await expect(createLesson(db, { courseId: c.id, title: 'Raw E', contentType: 'embed', embedHtml: '<iframe src="https://www.youtube.com/embed/raw"></iframe>' }, teacher)).rejects.toThrow(/sanitized embedHtml/);
  });
  it('scoped lesson updates reject a lesson that is not in the expected course', async () => {
    const expected = await createCourse(db, { ownerTeacherId: teacher, title: 'Expected parent' });
    const actual = await createCourse(db, { ownerTeacherId: teacher, title: 'Actual parent' });
    const l = await createLesson(db, { courseId: actual.id, title: 'Scoped', contentType: 'article' }, teacher);
    await expect(updateLesson(db, l.id, { title: 'tampered' }, teacher, Date.now(), expected.id)).rejects.toThrow(/lesson not found for course/);
    const rows = await listLessonsForCourse(db, actual.id);
    expect(rows.find((x) => x.id === l.id)?.title).toBe('Scoped');
  });
  it('scoped material create/delete reject a lesson or material outside the expected course', async () => {
    const expected = await createCourse(db, { ownerTeacherId: teacher, title: 'Material expected parent' });
    const actual = await createCourse(db, { ownerTeacherId: teacher, title: 'Material actual parent' });
    const l = await createLesson(db, { courseId: actual.id, title: 'Material scoped', contentType: 'article' }, teacher);
    await expect(createMaterial(db, { lessonId: l.id, label: 'Bad', url: 'https://m.example/bad', kind: 'link' }, teacher, Date.now(), expected.id)).rejects.toThrow(/lesson not found for course/);
    const m = await createMaterial(db, { lessonId: l.id, label: 'Good', url: 'https://m.example/good', kind: 'link' }, teacher, Date.now(), actual.id);
    await expect(deleteMaterial(db, m.id, teacher, Date.now(), expected.id)).rejects.toThrow(/material not found for course/);
    expect((await listMaterials(db, l.id)).map((x) => x.id)).toContain(m.id);
    await deleteMaterial(db, m.id, teacher, Date.now(), actual.id);
    expect((await listMaterials(db, l.id)).map((x) => x.id)).not.toContain(m.id);
  });
  it('file and embed materials round-trip with local bytes, sanitized HTML, and download lookup', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Material payloads', published: true });
    const l = await createLesson(db, { courseId: c.id, title: 'Payload lesson', contentType: 'article', published: true }, teacher);
    const now = 1_900_000_000_000;
    const file = prepareLmsFileMaterial({ fileName: 'notes.txt', mimeType: 'text/plain', bytes: new Uint8Array([65, 66, 67]), now });
    const fileMaterial = await createMaterial(db, { lessonId: l.id, label: 'Notes', kind: 'file', ...file }, teacher, now, c.id);
    const embed = sanitizeLmsEmbedHtml('<iframe src="https://player.vimeo.com/video/123" title="Vimeo lesson"></iframe>');
    const embedMaterial = await createMaterial(db, { lessonId: l.id, label: 'Chart replay', kind: 'embed', embedHtml: embed.html }, teacher, Date.now(), c.id);
    const rows = await listMaterials(db, l.id);
    expect(rows.find((x) => x.id === fileMaterial.id)).toMatchObject({ kind: 'file', fileName: 'notes.txt', mimeType: 'text/plain', sizeBytes: 3, storageProvider: 'db-local', scanStatus: 'clean' });
    expect(rows.find((x) => x.id === embedMaterial.id)?.embedHtml).toBe(embed.html);
    const uploadAudit = (await db.select().from(schema.auditLogs)).find((row) => row.action === 'education.material_upload' && row.targetId === fileMaterial.id);
    const uploadAuditPayload = JSON.stringify(uploadAudit?.after);
    expect(uploadAuditPayload).not.toContain('notes.txt');
    expect(uploadAuditPayload).not.toContain('fileName');
    expect(uploadAuditPayload).not.toContain('mimeType');
    expect(uploadAuditPayload).not.toContain(file.contentSha256);
    const download = await getMaterialFileForPublishedLesson(db, fileMaterial.id);
    expect(download).toMatchObject({ materialId: fileMaterial.id, fileName: 'notes.txt', fileBytesBase64: 'QUJD', storageProvider: 'db-local', scanStatus: 'clean' });
    const { fileBytesBase64: _objectBytes, ...objectFile } = file;
    const objectMaterial = await createMaterial(db, { lessonId: l.id, label: 'Object notes', kind: 'file', ...objectFile, storageProvider: 'fs-local' }, teacher, now, c.id);
    const objectDownload = await getMaterialFileForPublishedLesson(db, objectMaterial.id);
    expect(objectDownload).toMatchObject({ materialId: objectMaterial.id, fileName: 'notes.txt', fileBytesBase64: null, storageProvider: 'fs-local', scanStatus: 'clean' });
    const eicar = prepareLmsFileMaterial({ fileName: 'eicar.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), now });
    const quarantined = await createMaterial(db, { lessonId: l.id, label: 'Blocked', kind: 'file', ...eicar }, teacher, now, c.id);
    expect(quarantined.scanStatus).toBe('quarantined');
    expect(await getMaterialFileForPublishedLesson(db, quarantined.id)).toBeNull();
    await expect(createMaterial(db, { lessonId: l.id, label: 'Raw embed', kind: 'embed', embedHtml: '<iframe src="https://player.vimeo.com/video/999"></iframe>' }, teacher, Date.now(), c.id)).rejects.toThrow(/sanitized embedHtml/);
  });
  it('purges expired local file payloads only when soft-deleted or unsafe', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Material cleanup', published: true });
    const l = await createLesson(db, { courseId: c.id, title: 'Cleanup lesson', contentType: 'article', published: true }, teacher);
    const cleanupAt = 1_900_000_300_000;
    const expiredAt = new Date(cleanupAt - 1);
    const futureRetention = new Date(cleanupAt + 60_000);
    const clean = prepareLmsFileMaterial({ fileName: 'cleanup.txt', mimeType: 'text/plain', bytes: new Uint8Array([67]), now: cleanupAt });
    const { fileBytesBase64: _nonLocalBytes, ...nonLocalClean } = clean;
    const quarantined = prepareLmsFileMaterial({ fileName: 'blocked.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'), now: cleanupAt });

    const activeExpired = await createMaterial(db, { lessonId: l.id, label: 'Active expired clean', kind: 'file', ...clean, retainedUntil: expiredAt }, teacher, cleanupAt, c.id);
    const softDeletedExpired = await createMaterial(db, { lessonId: l.id, label: 'Soft deleted expired clean', kind: 'file', ...clean, retainedUntil: expiredAt, deletedAt: new Date(cleanupAt - 10_000) }, teacher, cleanupAt, c.id);
    const unsafeExpired = await createMaterial(db, { lessonId: l.id, label: 'Expired quarantine', kind: 'file', ...quarantined, retainedUntil: expiredAt }, teacher, cleanupAt, c.id);
    const softDeletedFuture = await createMaterial(db, { lessonId: l.id, label: 'Soft deleted retained clean', kind: 'file', ...clean, retainedUntil: futureRetention, deletedAt: new Date(cleanupAt - 10_000) }, teacher, cleanupAt, c.id);
    const remoteSoftDeletedExpired = await createMaterial(db, {
      lessonId: l.id,
      label: 'Remote soft deleted expired clean',
      kind: 'file',
      ...nonLocalClean,
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/opaque-remote-cleanup-01',
      retainedUntil: expiredAt,
      deletedAt: new Date(cleanupAt - 10_000),
    }, teacher, cleanupAt, c.id);
    const nonLocalKeySoftDeletedExpired = await createMaterial(db, {
      lessonId: l.id,
      label: 'Unexpected key soft deleted expired clean',
      kind: 'file',
      ...clean,
      storageKey: 'unexpected/materials/cleanup.txt',
      retainedUntil: expiredAt,
      deletedAt: new Date(cleanupAt - 10_000),
    }, teacher, cleanupAt, c.id);

    const { purged } = await purgeExpiredLmsMaterialFiles(db, cleanupAt);
    expect(purged).toBe(2);

    const ids = new Set((await db.select().from(schema.materials)).map((row) => row.id));
    expect(ids.has(activeExpired.id)).toBe(true);
    expect(ids.has(softDeletedExpired.id)).toBe(false);
    expect(ids.has(unsafeExpired.id)).toBe(false);
    expect(ids.has(softDeletedFuture.id)).toBe(true);
    expect(ids.has(remoteSoftDeletedExpired.id)).toBe(true);
    expect(ids.has(nonLocalKeySoftDeletedExpired.id)).toBe(true);

    const cleanupAudit = (await db.select().from(schema.auditLogs))
      .reverse()
      .find((row) => row.action === 'education.material_cleanup');
    expect(cleanupAudit?.actorRole).toBe('system');
    expect(cleanupAudit?.targetId).toBeNull();
    expect(cleanupAudit?.after).toMatchObject({ purged: 2, storageProvider: 'db-local', cutoff: cleanupAt });
    const auditPayload = JSON.stringify(cleanupAudit?.after);
    expect(auditPayload).not.toContain(softDeletedExpired.id);
    expect(auditPayload).not.toContain(unsafeExpired.id);
    expect(auditPayload).not.toContain('cleanup.txt');
    expect(auditPayload).not.toContain('blocked.txt');
  });
  it('lists and finalizes expired object-store rows only after external delete confirmation', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Object cleanup', published: true });
    const l = await createLesson(db, { courseId: c.id, title: 'Object cleanup lesson', contentType: 'article', published: true }, teacher);
    const cleanupAt = 1_900_000_480_000;
    const expiredAt = new Date(cleanupAt - 1);
    const futureRetention = new Date(cleanupAt + 60_000);
    const clean = prepareLmsFileMaterial({ fileName: 'object-cleanup.txt', mimeType: 'text/plain', bytes: new Uint8Array([79]), now: cleanupAt });
    const { fileBytesBase64: _objectBytes, ...objectClean } = clean;
    const objectBase = { kind: 'file' as const, ...objectClean, storageProvider: 's3-r2' };
    const baselineCandidates = new Set((await listExpiredLmsObjectMaterialFiles(db, cleanupAt)).map((row) => row.materialId));
    const activeExpired = await createMaterial(db, {
      lessonId: l.id,
      label: 'Active object clean',
      ...objectBase,
      storageKey: 'lms/materials/objectcleanupactive01',
      retainedUntil: expiredAt,
    }, teacher, cleanupAt, c.id);
    const softDeletedExpired = await createMaterial(db, {
      lessonId: l.id,
      label: 'Deleted object clean',
      ...objectBase,
      storageKey: 'lms/materials/objectcleanupdeleted01',
      retainedUntil: expiredAt,
      deletedAt: new Date(cleanupAt - 10_000),
    }, teacher, cleanupAt, c.id);
    const unsafeExpired = await createMaterial(db, {
      lessonId: l.id,
      label: 'Unsafe object pending',
      ...objectBase,
      storageKey: 'lms/materials/objectcleanuppending01',
      scanStatus: 'pending',
      retainedUntil: expiredAt,
    }, teacher, cleanupAt, c.id);
    const softDeletedFuture = await createMaterial(db, {
      lessonId: l.id,
      label: 'Future object clean',
      ...objectBase,
      storageKey: 'lms/materials/objectcleanupfuture01',
      retainedUntil: futureRetention,
      deletedAt: new Date(cleanupAt - 10_000),
    }, teacher, cleanupAt, c.id);

    const candidates = await listExpiredLmsObjectMaterialFiles(db, cleanupAt);
    const newCandidates = candidates.filter((row) => !baselineCandidates.has(row.materialId));
    expect(newCandidates.map((row) => row.materialId).sort()).toEqual([softDeletedExpired.id, unsafeExpired.id].sort());
    expect(newCandidates.every((row) => row.storageProvider === 's3-r2')).toBe(true);

    const { purged } = await finalizeLmsObjectMaterialCleanup(db, newCandidates.map((row) => row.materialId), cleanupAt);
    expect(purged).toBe(2);

    const ids = new Set((await db.select().from(schema.materials)).map((row) => row.id));
    expect(ids.has(activeExpired.id)).toBe(true);
    expect(ids.has(softDeletedExpired.id)).toBe(false);
    expect(ids.has(unsafeExpired.id)).toBe(false);
    expect(ids.has(softDeletedFuture.id)).toBe(true);

    const cleanupAudit = (await db.select().from(schema.auditLogs))
      .reverse()
      .find((row) => row.action === 'education.material_cleanup' && (row.after as { storageProvider?: unknown } | null)?.storageProvider === 's3-r2');
    expect(cleanupAudit?.actorRole).toBe('system');
    expect(cleanupAudit?.targetId).toBeNull();
    expect(cleanupAudit?.after).toMatchObject({
      purged: 2,
      storageProvider: 's3-r2',
      cutoff: cleanupAt,
      scope: 'expired_soft_deleted_or_unsafe_object_materials',
      objectDeleteConfirmed: true,
    });
    const auditPayload = JSON.stringify(cleanupAudit?.after);
    expect(auditPayload).not.toContain(softDeletedExpired.id);
    expect(auditPayload).not.toContain(unsafeExpired.id);
    expect(auditPayload).not.toContain('object-cleanup.txt');
    expect(auditPayload).not.toContain('objectcleanupdeleted01');
    expect(auditPayload).not.toContain(clean.contentSha256);
  });
  it('lesson update audit stores safe metadata, not raw body or raw URLs', async () => {
    const c = await createCourse(db, { ownerTeacherId: teacher, title: 'Audit parent' });
    const l = await createLesson(db, { courseId: c.id, title: 'Audit lesson', contentType: 'article' }, teacher);
    await updateLesson(db, l.id, { body: 'raw private lesson body', contentType: 'link', videoUrl: 'https://video.example/private', externalUrl: 'https://external.example/private' }, teacher, Date.now(), c.id);
    const logs = await db.select().from(schema.auditLogs);
    const log = logs.reverse().find((x) => x.action === 'education.lesson_update' && x.targetId === l.id);
    expect(log?.after).toMatchObject({ contentType: 'link', hasBody: true, hasVideoUrl: true, hasExternalUrl: true });
    const payload = JSON.stringify(log?.after);
    expect(payload).not.toContain('raw private lesson body');
    expect(payload).not.toContain('https://video.example/private');
    expect(payload).not.toContain('https://external.example/private');
  });
});

describe('Phase 3.1 — migration 0005 content_type backfill (real generated SQL on a pre-0005 table)', () => {
  let bpg: PGlite;
  beforeAll(async () => {
    bpg = new PGlite();
    // Pre-0005 shape (no level/tags on courses; no content_type/external_url on lessons; no FKs — isolated).
    await bpg.exec(`
      CREATE TABLE courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_teacher_id uuid NOT NULL, teacher_profile_id uuid, title text NOT NULL, description text, product_code text NOT NULL DEFAULT 'education', published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE lessons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL, title text NOT NULL, body text, video_url text, "order" integer NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT false);
      INSERT INTO lessons (id, course_id, title, video_url) VALUES
        ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Has video', 'https://v.example'),
        ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'No video', NULL);
    `);
    // Apply the ACTUAL generated migration (drizzle '--> statement-breakpoint' markers are SQL comments).
    const sql0005 = readFileSync(join(process.cwd(), 'packages', 'db', 'migrations', '0005_noisy_supreme_intelligence.sql'), 'utf8');
    await bpg.exec(sql0005);
  }, 30_000); // see note on the top-level hook — raised for PGlite-under-load resilience
  afterAll(async () => {
    await bpg.close();
  });

  it('existing video_url rows backfill to content_type=video', async () => {
    const r = await bpg.query<{ content_type: string }>(`SELECT content_type FROM lessons WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'`);
    expect(r.rows[0]?.content_type).toBe('video');
  });
  it('existing NULL video_url rows backfill to content_type=article', async () => {
    const r = await bpg.query<{ content_type: string }>(`SELECT content_type FROM lessons WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'`);
    expect(r.rows[0]?.content_type).toBe('article');
  });
  it('0005 adds courses.level (default beginner) + courses.tags (default {}) and lessons.external_url', async () => {
    await bpg.exec(`INSERT INTO courses (id, owner_teacher_id, title) VALUES ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'C')`);
    const c = await bpg.query<{ level: string; tags: string[] }>(`SELECT level, tags FROM courses WHERE id = '00000000-0000-0000-0000-0000000000c1'`);
    expect(c.rows[0]?.level).toBe('beginner');
    expect(c.rows[0]?.tags).toEqual([]);
    const cols = await bpg.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'lessons' AND column_name = 'external_url'`);
    expect(cols.rows.length).toBe(1);
  });
});
