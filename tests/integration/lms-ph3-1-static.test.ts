import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Phase 3.1 static source guards (vitest excludes apps/web/**, so server actions + pages are checked by
// reading their source — the repo's established apps/web test pattern, cf. backtester-pg10.test.ts).
// Verifies: deriveContentType is retired (the content_type column is the single source of truth), every
// URL write/render path enforces https, level/content_type are closed enums, embed render paths parse
// canonical sanitized iframe HTML without dangerouslySetInnerHTML, and the level/tags/content_type UI is wired
// (so no column is dead schema).

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const queries = read('apps/web/src/features/lms/queries.ts');
const actions = read('apps/web/src/features/lms/actions.ts');
const materialCreateCompensation = read('apps/web/src/features/lms/material-create-compensation.ts');
const completion = read('packages/lms/src/completion.ts');
const lmsTypes = read('packages/lms/src/types.ts');
const lmsIndex = read('packages/lms/src/index.ts');
const urls = read('packages/lms/src/urls.ts');
const lessonPage = read('apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx');
const teacherEditor = read('apps/web/src/app/teacher/courses/[id]/page.tsx');
const teacherCourses = read('apps/web/src/app/teacher/courses/page.tsx');
const teacherMaterials = read('apps/web/src/app/teacher/materials/page.tsx');
const teacherCommunity = read('apps/web/src/app/teacher/community/page.tsx');
const catalogue = read('apps/web/src/app/(app)/app/education/page.tsx');
const adminEdu = read('apps/web/src/app/admin/education/page.tsx');
const backend = read('apps/web/src/lib/backend.ts');
const adminAudit = read('apps/web/src/app/admin/audit-log/page.tsx');

describe('Phase 3.1 — deriveContentType retired (content_type column is the single source of truth)', () => {
  it('deriveContentType is removed from @wtc/lms (no definition, no export)', () => {
    expect(completion).not.toMatch(/export function deriveContentType/);
    expect(lmsIndex).not.toMatch(/deriveContentType/);
  });
  it('queries.ts no longer imports or calls deriveContentType', () => {
    expect(queries).not.toMatch(/deriveContentType/);
  });
  it('queries.ts reads the content_type column (no inline videoUrl→type derivation)', () => {
    expect(queries).not.toMatch(/videoUrl\s*\?\s*\(?'video'/);
    expect(queries).toMatch(/contentType: l\.contentType/);
    expect(queries).toMatch(/contentType: dto\.contentType/);
  });
});

describe('Phase 3.1 — URL write paths enforce https (security M-1)', () => {
  it('lesson videoUrl + externalUrl + material url all use .url().startsWith("https://")', () => {
    const count = (actions.match(/\.url\(\)\.startsWith\('https:\/\/'\)/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
  it('contentType write enum is exactly video|embed|article|link', () => {
    expect(actions).toMatch(/z\.enum\(\['video', 'embed', 'article', 'link'\]\)/);
  });
  it('level write enum is exactly beginner|intermediate|advanced', () => {
    expect(actions).toMatch(/z\.enum\(\['beginner', 'intermediate', 'advanced'\]\)/);
  });
});

describe('Phase 3.1 — render paths are XSS-safe (security M-2 / M-4)', () => {
  it('lesson page guards outbound hrefs with safeHttpsUrl', () => {
    expect(lessonPage).toMatch(/safeHttpsUrl/);
  });
  it('lesson page never renders raw HTML (no dangerouslySetInnerHTML, no snake-case embed_html)', () => {
    expect(lessonPage).not.toMatch(/dangerouslySetInnerHTML/);
    expect(lessonPage).not.toMatch(/embed_html/);
  });
  it('embed content type renders through parsed sanitized iframe props, not raw content', () => {
    expect(lessonPage).toMatch(/contentType === 'embed'/);
    expect(lessonPage).toMatch(/parseSanitizedLmsIframe/);
    expect(lessonPage).toMatch(/<SafeEmbedFrame/);
  });
  it('outbound links keep rel="noopener noreferrer"', () => {
    expect(lessonPage).toMatch(/rel="noopener noreferrer"/);
  });
  it('teacher render paths guard DB-backed hrefs with safeHttpsUrl', () => {
    for (const f of [teacherEditor, teacherMaterials, teacherCommunity]) {
      expect(f).toMatch(/safeHttpsUrl/);
      expect(f).not.toMatch(/href=\{(?:link\.url|material\.externalUrl)\}/);
    }
  });
  it('teacher course roster uses responsive table labels', () => {
    expect(teacherEditor).toMatch(/wtc-table-wrap/);
    expect(teacherEditor).toMatch(/data-label="Student"/);
    expect(teacherEditor).toMatch(/data-label="Progress"/);
  });
  it('the @wtc/lms guard rejects non-https via a URL protocol check', () => {
    expect(urls).toMatch(/protocol === 'https:'/);
  });
});

describe('Phase 3.1 — UI is wired (no dead schema: every column has a writer + reader)', () => {
  it('teacher course forms write level + tags (create + edit)', () => {
    expect(teacherCourses).toMatch(/name="level"/);
    expect(teacherCourses).toMatch(/name="tags"/);
    expect(teacherEditor).toMatch(/name="level"/);
    expect(teacherEditor).toMatch(/name="tags"/);
  });
  it('teacher lesson forms write content_type + external_url (create + edit via updateLessonAction)', () => {
    expect(teacherEditor).toMatch(/name="contentType"/);
    expect(teacherEditor).toMatch(/name="externalUrl"/);
    expect(teacherEditor).toMatch(/updateLessonAction/);
  });
  it('the lesson content_type selector offers video/embed/article/link', () => {
    expect(teacherEditor).toMatch(/value="video">Video/);
    expect(teacherEditor).toMatch(/value="embed">Embed/);
    expect(teacherEditor).toMatch(/value="article">Article/);
    expect(teacherEditor).toMatch(/value="link">External link/);
  });
  it('the material writer and teacher form support link/file/embed through discriminated schemas', () => {
    expect(actions).toMatch(/kind: z\.enum\(\['link', 'file', 'embed'\]\)\.default\('link'\)/);
    expect(actions).toMatch(/LMS_MAX_FILE_BYTES/);
    expect(actions).toMatch(/file\.size > LMS_MAX_FILE_BYTES/);
    expect(actions).toMatch(/storeLmsUploadedFile/);
    expect(actions).toMatch(/sanitizeLmsEmbedHtml/);
    const materialCardStart = teacherEditor.indexOf('Add a material');
    expect(materialCardStart).toBeGreaterThanOrEqual(0);
    const materialCard = teacherEditor.slice(materialCardStart);
    expect(materialCard).toMatch(/name="kind"/);
    expect(materialCard).toMatch(/value="link">Link/);
    expect(materialCard).toMatch(/value="file">File/);
    expect(materialCard).toMatch(/value="embed">Embed/);
    expect(materialCard).toMatch(/name="file"/);
    expect(materialCard).toMatch(/name="embedHtml"/);
  });
  it('level is rendered as a pill via levelTone on catalogue, teacher, and admin surfaces', () => {
    for (const f of [catalogue, teacherCourses, teacherEditor, adminEdu]) expect(f).toMatch(/levelTone/);
  });
});

describe('Phase 3.1 hotfix — lesson/material mutations bind the target to its parent course', () => {
  it('server actions load the actual lesson/material parent and deny parent mismatches', () => {
    expect(actions).toMatch(/getLessonById/);
    expect(actions).toMatch(/getMaterialById/);
    expect(actions).toMatch(/denyLmsMutation/);
    expect(actions).toMatch(/lessonCourseId !== courseId/);
  });
  it('lesson updates pass the expected course id into the repository defense-in-depth guard', () => {
    expect(actions).toMatch(/updateLesson\(db, lessonId,[\s\S]*courseId\)/);
    expect(actions).toMatch(/createMaterialWithUploadCompensation\(\{[\s\S]*courseId,[\s\S]*createMaterialFn: createMaterial/);
    expect(materialCreateCompensation).toMatch(/input\.createMaterialAndCompleteCleanupFn\(input\.db, input\.materialInput, input\.cleanupTaskId, input\.actorUserId, input\.now, input\.courseId\)/);
    expect(materialCreateCompensation).toMatch(/input\.createMaterialFn\(input\.db, input\.materialInput, input\.actorUserId, input\.now, input\.courseId\)/);
    expect(actions).toMatch(/deleteMaterial\(db,[\s\S]*courseId\)/);
  });

  it('file material creation compensates uploaded objects when the DB write fails', () => {
    const createMaterialAction = actions.slice(actions.indexOf('export async function createMaterialAction'), actions.indexOf('export async function deleteMaterialAction'));
    expect(actions).toContain('compensateLmsUploadedFile');
    expect(actions).toContain('createPendingLmsObjectCleanupTask');
    expect(actions).toContain('createMaterialAndCompleteLmsObjectCleanupTask');
    expect(actions).toContain('createMaterialWithUploadCompensation');
    expect(actions).toMatch(/beforeObjectPut: async \(object\) => \{[\s\S]*createPendingLmsObjectCleanupTask\(db,[\s\S]*storageKey: object\.storageKey,[\s\S]*reason: 'material_create_pending'/);
    expect(createMaterialAction).toMatch(/await createMaterialWithUploadCompensation\(\{[\s\S]*cleanupTaskId,[\s\S]*createMaterialAndCompleteCleanupFn: createMaterialAndCompleteLmsObjectCleanupTask,[\s\S]*completeCleanupTaskFn: completeLmsObjectCleanupTask,[\s\S]*recordCleanupTaskFailureFn: recordLmsObjectCleanupTaskFailure/);
    expect(materialCreateCompensation).toMatch(/try\s*\{[\s\S]*createMaterialAndCompleteCleanupFn[\s\S]*createMaterialFn[\s\S]*\}\s*catch/);
    expect(materialCreateCompensation).toMatch(/input\.materialInput\.kind === 'file'/);
    expect(materialCreateCompensation).toMatch(/input\.completeCleanupTaskFn\(input\.db, input\.cleanupTaskId, input\.now\)\.catch\(\(\) => undefined\)/);
    expect(materialCreateCompensation).toMatch(/input\.recordCleanupTaskFailureFn\(input\.db, input\.cleanupTaskId, input\.now, 'delete_failed'\)\.catch\(\(\) => undefined\)/);
    expect(materialCreateCompensation).toMatch(/throw err/);
  });
});

describe('Phase 3.22 - LMS material view DTO is display-only', () => {
  const materialView = lmsTypes.slice(lmsTypes.indexOf('export interface MaterialView'), lmsTypes.indexOf('export type TeacherMaterialView'));
  const teacherMaterialView = lmsTypes.slice(lmsTypes.indexOf('export type TeacherMaterialView'), lmsTypes.indexOf('/** Per-lesson progress'));

  it('student MaterialView does not carry internal file storage/audit metadata or filename fields', () => {
    for (const internal of ['contentSha256', 'storageProvider', 'quarantineReason', 'retainedUntil', 'deletedAt', 'storageKey', 'fileBytesBase64', 'fileName', 'mimeType']) {
      expect(materialView).not.toContain(internal);
    }
    for (const displayField of ['downloadUrl', 'sizeBytes', 'scanStatus', 'embedHtml']) {
      expect(materialView).toContain(displayField);
    }
  });

  it('TeacherMaterialView does not reintroduce filename or storage metadata', () => {
    expect(teacherMaterialView).toContain('MaterialView');
    for (const internal of ['fileName', 'mimeType', 'contentSha256', 'storageProvider', 'quarantineReason', 'retainedUntil', 'deletedAt', 'storageKey', 'fileBytesBase64']) {
      expect(teacherMaterialView).not.toContain(internal);
    }
  });

  it('the student web material mapper does not project internal material metadata or filename fields', () => {
    const mapper = queries.slice(queries.indexOf('function toMaterialView'), queries.indexOf('function toTeacherMaterialView'));
    for (const internal of ['contentSha256', 'storageProvider', 'quarantineReason', 'retainedUntil', 'deletedAt', 'storageKey', 'fileBytesBase64', 'fileName', 'mimeType']) {
      expect(mapper).not.toContain(`.${internal}`);
      expect(mapper).not.toContain(` ${internal}`);
    }
    expect(mapper).toContain('downloadUrl');
    expect(mapper).toContain('scanStatus');
  });

  it('teacher mapper stays filename-free and student lesson loading stays on the student mapper', () => {
    const teacherMapper = queries.slice(queries.indexOf('function toTeacherMaterialView'), queries.indexOf('function toTeacherProfileView'));
    for (const internal of ['fileName', 'mimeType', 'contentSha256', 'storageProvider', 'quarantineReason', 'retainedUntil', 'deletedAt', 'storageKey', 'fileBytesBase64']) {
      expect(teacherMapper).not.toContain(`.${internal}`);
    }
    expect(queries).toMatch(/const materials = \(await listMaterials\(db, lessonId\)\)\.map\(toMaterialView\)/);
    expect(queries).toMatch(/map\(toTeacherMaterialView\)/);
  });

  it('admin audit projection stays summary-only and payload-free', () => {
    const auditView = backend.slice(backend.indexOf('export interface AuditView'), backend.indexOf('/** Recent audit events'));
    const recentAudit = backend.slice(backend.indexOf('export async function recentAuditEvents'), backend.length);
    for (const key of ['id', 'ts', 'actorRole', 'action', 'targetType', 'targetId', 'result']) {
      expect(auditView).toContain(key);
      expect(recentAudit).toContain(key);
    }
    for (const forbidden of ['before', 'after', 'metadata', 'fileName', 'mimeType', 'sizeBytes', 'contentSha256', 'fileBytesBase64', 'storageProvider', 'storageKey', 'scanCheckedAt', 'quarantineReason', 'retainedUntil', 'deletedAt', 'hasStorageKey']) {
      expect(auditView).not.toContain(forbidden);
      expect(recentAudit).not.toContain(forbidden);
      expect(adminAudit).not.toContain(forbidden);
    }
  });
});
