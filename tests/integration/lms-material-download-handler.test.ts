import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createCourse,
  createLesson,
  createMaterial,
  createUser,
  schema,
  seedDatabase,
  type Db,
  type DbUser,
  type MaterialFileDownloadRow,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { LMS_OBJECT_STORAGE_PROVIDER, prepareLmsFileMaterial } from '@wtc/lms';
import { handleLmsMaterialDownloadRequest } from '../../apps/web/src/features/lms/material-download.ts';

let db: Db;
let pg: PGlite;
let user: DbUser;
let materialId: string;
let quarantinedMaterialId: string;
const CLEAN_FILE_TEXT = 'PLAN';
const CLEAN_FILE_BASE64 = 'UExBTg==';
const CLEAN_FILE_SHA256 = '4b7dc7887b23e77f28b5cc16889d62bb8f33d4d92c60f1c824e88f4fce881a05';
const CLEAN_FILE_NAME = 'plan.txt';
const QUARANTINED_FILE_TEXT = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const REMOTE_STORAGE_KEY = 'lms/materials/opaque-remote-key-01';
const SIGNED_REDIRECT_URL = 'https://objects.test.local/wtc-lms-test/lms/materials/opaque-remote-key-01?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

beforeEach(async () => {
  pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  user = await createUser(db, { email: `lms-download-${globalThis.crypto.randomUUID()}@wtc.local`, passwordHash: 'h', displayName: 'Download User' });
  const teacher = (await createUser(db, { email: `lms-download-teacher-${globalThis.crypto.randomUUID()}@wtc.local`, passwordHash: 'h', displayName: 'Teacher', roles: ['teacher'] })).id;
  const course = await createCourse(db, { ownerTeacherId: teacher, title: 'Downloads', published: true });
  const lesson = await createLesson(db, { courseId: course.id, title: 'Published', contentType: 'article', published: true }, teacher);
  const file = prepareLmsFileMaterial({ fileName: CLEAN_FILE_NAME, mimeType: 'text/plain', bytes: new TextEncoder().encode(CLEAN_FILE_TEXT), now: 1_900_000_000_000 });
  materialId = (await createMaterial(db, { lessonId: lesson.id, label: 'Plan', kind: 'file', ...file }, teacher, Date.now(), course.id)).id;
  const quarantined = prepareLmsFileMaterial({ fileName: 'eicar.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode(QUARANTINED_FILE_TEXT), now: 1_900_000_000_000 });
  quarantinedMaterialId = (await createMaterial(db, { lessonId: lesson.id, label: 'Blocked', kind: 'file', ...quarantined }, teacher, Date.now(), course.id)).id;
});

afterEach(async () => {
  await pg.close();
});

function request(method = 'GET', id = materialId): Request {
  return new Request(`https://wtc.local/api/education/materials/${id}/download`, { method });
}

function allowed(): AccessDecision {
  return { allowed: true, reason: 'allowed', status: 'active', productCode: 'education' };
}

function denied(reason: AccessReason = 'blocked_no_entitlement'): AccessDecision {
  return { allowed: false, reason, status: 'none', productCode: 'education' };
}

async function handle(opts: { access?: AccessDecision; userValue?: DbUser | null; dbValue?: Db | null; id?: string } = {}): Promise<Response> {
  const id = opts.id ?? materialId;
  return handleLmsMaterialDownloadRequest(request('GET', id), id, {
    db: opts.dbValue === undefined ? db : opts.dbValue,
    now: 1_900_000_000_000,
    requireUser: async () => {
      if (opts.userValue === null) throw new Error('unauthenticated');
      return opts.userValue ?? user;
    },
    accessFor: async () => opts.access ?? allowed(),
    reasonLabel: (reason) => reason,
  });
}

const FORBIDDEN_FAILURE_MARKERS = [
  CLEAN_FILE_TEXT,
  CLEAN_FILE_BASE64,
  CLEAN_FILE_SHA256,
  CLEAN_FILE_NAME,
  QUARANTINED_FILE_TEXT,
  'fileBytesBase64',
  'storageKey',
  'storage_key',
  'lms/materials/',
  'fileName',
  'mimeType',
  'contentSha256',
  'storageProvider',
  'db-local',
  'retainedUntil',
  'quarantineReason',
  'deletedAt',
  'hasStorageKey',
] as const;

async function expectNoFailureLeak(res: Response): Promise<unknown> {
  const body = await res.text();
  const headers = Object.fromEntries(res.headers.entries());
  const combined = `${body}\n${JSON.stringify(headers)}`;
  for (const marker of FORBIDDEN_FAILURE_MARKERS) expect(combined).not.toContain(marker);
  expect(res.headers.get('x-lms-sha256')).toBeNull();
  expect(res.headers.get('content-disposition')).toBeNull();
  expect(res.headers.get('set-cookie')).toBeNull();
  expect(res.headers.get('content-length')).not.toBe(String(Buffer.byteLength(CLEAN_FILE_TEXT, 'utf8')));
  expect(res.headers.get('content-type')).toContain('application/json');
  return JSON.parse(body);
}

describe('LMS material download handler', () => {
  it('streams DB-backed file bytes with strict headers and redacted audit', async () => {
    const res = await handle();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="lesson-material.txt"');
    expect(res.headers.get('content-disposition')).not.toContain(CLEAN_FILE_NAME);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-lms-sha256')).toBeNull();
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([80, 76, 65, 78]);

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'education.material_download'));
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(CLEAN_FILE_NAME);
    expect(JSON.stringify(audits)).not.toContain('fileName');
    expect(JSON.stringify(audits)).not.toContain('mimeType');
    expect(JSON.stringify(audits)).not.toContain(CLEAN_FILE_SHA256);
    expect(JSON.stringify(audits)).not.toContain('UExBTg==');
    expect(JSON.stringify(audits)).not.toContain('PLAN');
  });

  it('fails closed before DB lookup for unauthenticated or denied users', async () => {
    let lookedUp = false;
    let audited = false;
    const guarded = (opts: { access?: AccessDecision; userValue?: DbUser | null; dbValue?: Db | null }) =>
      handleLmsMaterialDownloadRequest(request(), materialId, {
        db: opts.dbValue === undefined ? db : opts.dbValue,
        requireUser: async () => {
          if (opts.userValue === null) throw new Error('unauthenticated');
          return opts.userValue ?? user;
        },
        accessFor: async () => opts.access ?? allowed(),
        reasonLabel: (reason) => reason,
        getFile: async () => {
          lookedUp = true;
          return null;
        },
        recordAudit: async () => {
          audited = true;
        },
      });

    let res = await guarded({ userValue: null });
    expect(res.status).toBe(401);
    await expectNoFailureLeak(res);
    expect(lookedUp).toBe(false);
    expect(audited).toBe(false);

    res = await guarded({ access: denied('revoked') });
    expect(res.status).toBe(403);
    await expectNoFailureLeak(res);
    expect(lookedUp).toBe(false);
    expect(audited).toBe(false);

    res = await guarded({ dbValue: null });
    expect(res.status).toBe(503);
    await expectNoFailureLeak(res);
    expect(lookedUp).toBe(false);
    expect(audited).toBe(false);
  });

  it('does not stream quarantined files even when the lesson and course are published', async () => {
    let audited = false;
    const res = await handleLmsMaterialDownloadRequest(request('GET', quarantinedMaterialId), quarantinedMaterialId, {
      db,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
      recordAudit: async () => {
        audited = true;
      },
    });
    expect(res.status).toBe(404);
    expect(await expectNoFailureLeak(res)).toEqual({ error: 'material_file_not_found' });
    expect(audited).toBe(false);
  });

  it('fails closed without audit when storage resolution cannot provide bytes', async () => {
    let audited = false;
    const row: MaterialFileDownloadRow = {
      materialId,
      lessonId: '00000000-0000-4000-8000-000000000001',
      courseId: '00000000-0000-4000-8000-000000000002',
      label: 'Remote',
      fileName: CLEAN_FILE_NAME,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(CLEAN_FILE_TEXT, 'utf8'),
      contentSha256: CLEAN_FILE_SHA256,
      fileBytesBase64: null,
      storageProvider: 's3',
      storageKey: 'objects/private-plan.txt',
      scanStatus: 'clean',
      scanCheckedAt: new Date(1_900_000_000_000),
      quarantineReason: null,
      retainedUntil: new Date(1_900_000_000_000 + 365 * 24 * 60 * 60 * 1000),
    };
    const res = await handleLmsMaterialDownloadRequest(request(), materialId, {
      db,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
      getFile: async () => row,
      recordAudit: async () => {
        audited = true;
      },
    });
    expect(res.status).toBe(404);
    expect(await expectNoFailureLeak(res)).toEqual({ error: 'material_file_not_found' });
    expect(audited).toBe(false);
  });

  it('redirects to a signed object URL only after delivery resolution and records a redacted audit', async () => {
    const row: MaterialFileDownloadRow = {
      materialId,
      lessonId: '00000000-0000-4000-8000-000000000001',
      courseId: '00000000-0000-4000-8000-000000000002',
      label: 'Remote',
      fileName: CLEAN_FILE_NAME,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(CLEAN_FILE_TEXT, 'utf8'),
      contentSha256: CLEAN_FILE_SHA256,
      fileBytesBase64: null,
      storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
      storageKey: REMOTE_STORAGE_KEY,
      scanStatus: 'clean',
      scanCheckedAt: new Date(1_900_000_000_000),
      quarantineReason: null,
      retainedUntil: new Date(1_900_000_000_000 + 365 * 24 * 60 * 60 * 1000),
    };
    const res = await handleLmsMaterialDownloadRequest(request(), materialId, {
      db,
      now: 1_900_000_000_000,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
      getFile: async () => row,
      resolveFile: async () => ({ kind: 'redirect', url: SIGNED_REDIRECT_URL }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(SIGNED_REDIRECT_URL);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-disposition')).toBeNull();
    expect(res.headers.get('content-type')).toBeNull();
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.text()).toBe('');

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'education.material_download'));
    expect(audits).toHaveLength(1);
    const auditText = JSON.stringify(audits);
    expect(auditText).not.toContain(SIGNED_REDIRECT_URL);
    expect(auditText).not.toContain(REMOTE_STORAGE_KEY);
    expect(auditText).not.toContain('X-Amz-Signature');
    expect(auditText).not.toContain(CLEAN_FILE_NAME);
    expect(auditText).not.toContain('fileName');
    expect(auditText).not.toContain('mimeType');
    expect(auditText).not.toContain(CLEAN_FILE_SHA256);
    expect(auditText).not.toContain(CLEAN_FILE_TEXT);
  });

  it('fails closed without audit when signed object delivery cannot be created', async () => {
    let audited = false;
    const row: MaterialFileDownloadRow = {
      materialId,
      lessonId: '00000000-0000-4000-8000-000000000001',
      courseId: '00000000-0000-4000-8000-000000000002',
      label: 'Remote',
      fileName: CLEAN_FILE_NAME,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(CLEAN_FILE_TEXT, 'utf8'),
      contentSha256: CLEAN_FILE_SHA256,
      fileBytesBase64: null,
      storageProvider: LMS_OBJECT_STORAGE_PROVIDER,
      storageKey: REMOTE_STORAGE_KEY,
      scanStatus: 'clean',
      scanCheckedAt: new Date(1_900_000_000_000),
      quarantineReason: null,
      retainedUntil: new Date(1_900_000_000_000 + 365 * 24 * 60 * 60 * 1000),
    };
    const res = await handleLmsMaterialDownloadRequest(request(), materialId, {
      db,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
      getFile: async () => row,
      resolveFile: async () => {
        throw new Error('signing failed');
      },
      recordAudit: async () => {
        audited = true;
      },
    });
    expect(res.status).toBe(404);
    expect(await expectNoFailureLeak(res)).toEqual({ error: 'material_file_not_found' });
    expect(audited).toBe(false);
  });

  it('rejects non-GET methods', async () => {
    const res = await handleLmsMaterialDownloadRequest(request('POST'), materialId, {
      db,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
    });
    expect(res.status).toBe(405);
  });

  it('rejects malformed material IDs before database lookup', async () => {
    let lookedUp = false;
    const res = await handleLmsMaterialDownloadRequest(request('GET', 'not-a-uuid'), 'not-a-uuid', {
      db,
      requireUser: async () => user,
      accessFor: async () => allowed(),
      reasonLabel: (reason) => reason,
      getFile: async () => {
        lookedUp = true;
        return null;
      },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await expectNoFailureLeak(res)).toEqual({ error: 'invalid_material_id' });
    expect(lookedUp).toBe(false);
  });
});
