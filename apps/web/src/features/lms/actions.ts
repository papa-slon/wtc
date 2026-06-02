'use server';
/**
 * LMS server actions. Canonical per-mutation pipeline (PG7 / 20260530-2330):
 *   assertCsrf → requireUser → RBAC/ownership/entitlement (audit:'failure' + throw on denial)
 *   → Zod → repo (writes the in-txn success audit row) → revalidate.
 *
 * CSRF is verified FIRST (a forged cross-site POST is rejected before any session read or I/O —
 * assertCsrf reads the session cookie directly, independent of requireUser). Authorization denials
 * FAIL LOUD via the @/features/lms/guard helpers (one audit row + AppError throw) — never a silent
 * return. Only input errors (Zod), not-found/unpublished, and demo mode (getServerDb() null) return
 * gracefully; the page shows the honest "storage: in-memory (demo)" label and the action no-ops.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/session';
import { assertCsrf } from '@/lib/csrf';
import { getServerDb } from '@/lib/backend';
import {
  createCourse,
  updateCourse,
  setCoursePublished,
  createLesson,
  updateLesson,
  getLessonById,
  createMaterial,
  createMaterialAndCompleteLmsObjectCleanupTask,
  createPendingLmsObjectCleanupTask,
  completeLmsObjectCleanupTask,
  recordLmsObjectCleanupTaskFailure,
  deleteMaterial,
  getMaterialById,
  upsertEnrollment,
  upsertLessonProgress,
  markEnrollmentComplete,
  listLessonsForStudent,
  listCourseProgress,
  getCourseById,
  getTeacherProfile,
  createTeacherProfile,
  updateTeacherProfile,
  createPinnedLink,
  listPinnedLinks,
  deletePinnedLink,
} from '@wtc/db';
import { LMS_MAX_FILE_BYTES, sanitizeLmsEmbedHtml } from '@wtc/lms';
import { lmsRoles, requireTeacher, requireAdmin, requireCourseOwnership, requireEducationAccess, denyLmsMutation } from './guard';
import { compensateLmsUploadedFile, storeLmsUploadedFile } from './material-storage';
import { createMaterialWithUploadCompensation } from './material-create-compensation';

const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  // 0005: level is a closed enum (mirrors the DB CHECK — Zod is the primary boundary, CHECK is defence-in-depth).
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  // 0005: tags are display/write only (no filter); bounded count + length, text only.
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});
// SECURITY (M-1): every URL field enforces https:// — NOT just .url(). z.url() accepts javascript:/data:/http:
// schemes which would execute or downgrade when rendered as an href. .startsWith('https://') closes that gap.
// 'embed' is intentionally NOT a selectable contentType (no server-side sanitizer yet — stored-XSS gate).
const lessonSchema = z
  .object({
    title: z.string().trim().min(3).max(300),
    body: z.string().trim().max(20000).optional(),
    videoUrl: z.string().trim().url().startsWith('https://').optional(),
    contentType: z.enum(['video', 'embed', 'article', 'link']).default('video'),
    externalUrl: z.string().trim().url().startsWith('https://').optional(),
    embedHtml: z.string().trim().max(5000).optional(),
  })
  .refine((d) => d.contentType !== 'link' || !!d.externalUrl, { message: 'externalUrl is required for a link lesson', path: ['externalUrl'] })
  .refine((d) => d.contentType !== 'embed' || !!d.embedHtml, { message: 'embedHtml is required for an embed lesson', path: ['embedHtml'] });
// SECURITY (M-1): material url must be https:// too (was .url() only — pre-existing javascript: href gap).
const materialBaseSchema = z.object({ label: z.string().trim().min(1).max(200), kind: z.enum(['link', 'file', 'embed']).default('link') });
const linkMaterialSchema = materialBaseSchema.extend({ kind: z.literal('link'), url: z.string().trim().url().startsWith('https://') });
const embedMaterialSchema = materialBaseSchema.extend({ kind: z.literal('embed'), embedHtml: z.string().trim().min(1).max(5000) });
const teacherProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(1000).optional(),
  telegram: z.string().trim().url().startsWith('https://').optional(),
  instagram: z.string().trim().url().startsWith('https://').optional(),
  youtube: z.string().trim().url().startsWith('https://').optional(),
  website: z.string().trim().url().startsWith('https://').optional(),
});
const pinnedLinkSchema = z.object({
  ownerType: z.enum(['teacher_profile', 'course']),
  ownerId: z.string().uuid(),
  courseId: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().startsWith('https://'),
  iconType: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

/** Parse a comma-separated tags input (FormData has no native array) into a clean string[]. */
function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return [];
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}
/** Keep only the URL that matches the chosen content type — a 'link' lesson must not carry a stale videoUrl, etc. */
function lessonPayload(d: { contentType: 'video' | 'embed' | 'article' | 'link'; videoUrl?: string; externalUrl?: string; embedHtml?: string }): { videoUrl: string | null; externalUrl: string | null; embedHtml: string | null } | null {
  try {
    return {
      videoUrl: d.contentType === 'video' ? d.videoUrl ?? null : null,
      externalUrl: d.contentType === 'link' ? d.externalUrl ?? null : null,
      embedHtml: d.contentType === 'embed' ? sanitizeLmsEmbedHtml(d.embedHtml ?? '').html : null,
    };
  } catch {
    return null;
  }
}

function cleanOptionalUrl(v: FormDataEntryValue | null): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function isUploadedFileLike(v: FormDataEntryValue | null): v is File {
  return typeof v === 'object'
    && v !== null
    && 'name' in v
    && 'type' in v
    && 'size' in v
    && 'arrayBuffer' in v
    && typeof (v as { arrayBuffer?: unknown }).arrayBuffer === 'function';
}

type FileMaterialActionInput = Extract<Parameters<typeof createMaterial>[1], { kind: 'file' }>;
type MaterialActionDb = Parameters<typeof createMaterial>[0];

async function fileMaterialFromForm(formData: FormData, label: string, now: number, db: MaterialActionDb): Promise<{ materialInput: FileMaterialActionInput; cleanupTaskId: string | null } | null> {
  const lessonId = String(formData.get('lessonId') ?? '');
  const file = formData.get('file');
  if (!lessonId || !isUploadedFileLike(file) || file.size <= 0) return null;
  if (file.size > LMS_MAX_FILE_BYTES) return null;
  let cleanupTaskId: string | null = null;
  try {
    const prepared = await storeLmsUploadedFile({
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      now,
      beforeObjectPut: async (object) => {
        const task = await createPendingLmsObjectCleanupTask(db, {
          storageProvider: object.storageProvider,
          storageKey: object.storageKey,
          reason: 'material_create_pending',
        }, now);
        cleanupTaskId = task.id;
      },
    });
    return { materialInput: { lessonId, label, kind: 'file', ...prepared }, cleanupTaskId };
  } catch {
    return null;
  }
}

// ---- Teacher: courses ----
export async function createCourseAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  await requireTeacher(user, { targetType: 'course', attempted: 'course_create' });
  const parsed = createCourseSchema.safeParse({ title: formData.get('title'), description: formData.get('description') || undefined, level: formData.get('level') || undefined, tags: parseTags(formData.get('tags')) });
  if (!parsed.success) return;
  const db = getServerDb();
  if (!db) return; // demo: no persistence
  // F-04: link new course to the actor's teacher_profiles row (by profile id) so ownership can be
  // checked by either profile id OR user id. Fall back gracefully if the actor has no profile yet.
  const profile = await getTeacherProfile(db, user.id);
  await createCourse(db, { ownerTeacherId: user.id, title: parsed.data.title, description: parsed.data.description, level: parsed.data.level, tags: parsed.data.tags, published: false, ...(profile?.id ? { teacherProfileId: profile.id } : {}) });
  revalidatePath('/teacher/courses');
}

export async function saveTeacherProfileAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  await requireTeacher(user, { targetType: 'teacher_profile', attempted: 'teacher_profile_update' });
  const parsed = teacherProfileSchema.safeParse({
    displayName: formData.get('displayName'),
    bio: formData.get('bio') || undefined,
    telegram: cleanOptionalUrl(formData.get('telegram')),
    instagram: cleanOptionalUrl(formData.get('instagram')),
    youtube: cleanOptionalUrl(formData.get('youtube')),
    website: cleanOptionalUrl(formData.get('website')),
  });
  if (!parsed.success) return;
  const db = getServerDb();
  if (!db) return;
  const socialLinks = Object.fromEntries(
    (['telegram', 'instagram', 'youtube', 'website'] as const)
      .map((k) => [k, parsed.data[k]])
      .filter(([, v]) => typeof v === 'string' && v.length > 0),
  ) as Record<string, string>;
  const existing = await getTeacherProfile(db, user.id);
  if (existing) {
    await updateTeacherProfile(db, existing.id, { displayName: parsed.data.displayName, bio: parsed.data.bio ?? '', socialLinks }, user.id);
  } else {
    await createTeacherProfile(db, { userId: user.id, displayName: parsed.data.displayName, bio: parsed.data.bio, socialLinks });
  }
  revalidatePath('/teacher');
  revalidatePath('/teacher/community');
  revalidatePath('/app/education');
}

export async function createPinnedLinkAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  await requireTeacher(user, { targetType: 'pinned_link', attempted: 'pinned_link_create' });
  const parsed = pinnedLinkSchema.safeParse({
    ownerType: formData.get('ownerType'),
    ownerId: formData.get('ownerId'),
    courseId: formData.get('courseId') || undefined,
    label: formData.get('label'),
    url: formData.get('url'),
    iconType: formData.get('iconType') || undefined,
    sortOrder: formData.get('sortOrder') || undefined,
  });
  if (!parsed.success) return;
  const db = getServerDb();
  if (!db) return;
  const { isAdmin } = lmsRoles(user);
  if (parsed.data.ownerType === 'course') {
    await requireCourseOwnership(user, isAdmin, parsed.data.ownerId, { targetType: 'course', targetId: parsed.data.ownerId, attempted: 'pinned_link_create' });
  } else {
    const profile = await getTeacherProfile(db, user.id);
    if (!profile || profile.id !== parsed.data.ownerId) {
      await denyLmsMutation(user, { targetType: 'teacher_profile', targetId: parsed.data.ownerId, attempted: 'pinned_link_create' }, 'ownership_denied');
      return;
    }
  }
  await createPinnedLink(db, { ownerType: parsed.data.ownerType, ownerId: parsed.data.ownerId, label: parsed.data.label, url: parsed.data.url, iconType: parsed.data.iconType, sortOrder: parsed.data.sortOrder, createdBy: user.id });
  revalidatePath('/teacher/community');
  if (parsed.data.courseId) revalidatePath(`/teacher/courses/${parsed.data.courseId}`);
  revalidatePath('/app/education');
}

export async function deletePinnedLinkAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  await requireTeacher(user, { targetType: 'pinned_link', attempted: 'pinned_link_delete' });
  const linkId = String(formData.get('linkId') ?? '');
  const ownerType = String(formData.get('ownerType') ?? '');
  const ownerId = String(formData.get('ownerId') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  if (!linkId || (ownerType !== 'teacher_profile' && ownerType !== 'course') || !ownerId) return;
  const db = getServerDb();
  if (!db) return;
  const { isAdmin } = lmsRoles(user);
  if (ownerType === 'course') {
    await requireCourseOwnership(user, isAdmin, ownerId, { targetType: 'course', targetId: ownerId, attempted: 'pinned_link_delete' });
  } else {
    const profile = await getTeacherProfile(db, user.id);
    if (!profile || profile.id !== ownerId) {
      await denyLmsMutation(user, { targetType: 'teacher_profile', targetId: ownerId, attempted: 'pinned_link_delete' }, 'ownership_denied');
      return;
    }
  }
  const ownedLinks = await listPinnedLinks(db, ownerType, ownerId);
  if (!ownedLinks.some((l) => l.id === linkId)) {
    await denyLmsMutation(user, { targetType: 'pinned_link', targetId: linkId, attempted: 'pinned_link_delete' }, 'parent_mismatch');
    return;
  }
  await deletePinnedLink(db, linkId, user.id);
  revalidatePath('/teacher/community');
  if (courseId) revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath('/app/education');
}

export async function updateCourseAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'course', targetId: courseId || undefined, attempted: 'course_update' });
  const rawTags = formData.get('tags');
  const parsed = createCourseSchema.partial().safeParse({ title: formData.get('title') || undefined, description: formData.get('description') || undefined, level: formData.get('level') || undefined, tags: rawTags != null ? parseTags(rawTags) : undefined });
  if (!parsed.success || !courseId) return;
  const db = getServerDb();
  if (!db) return;
  await requireCourseOwnership(user, isAdmin, courseId, { targetType: 'course', targetId: courseId, attempted: 'course_update' });
  // Conditional spread: only overwrite level/tags when the form actually submitted them (a title-only
  // edit must not silently wipe tags). An empty tags input ([] after parse) does clear them — intentional.
  await updateCourse(db, courseId, { title: parsed.data.title, description: parsed.data.description ?? null, ...(parsed.data.level ? { level: parsed.data.level } : {}), ...(parsed.data.tags ? { tags: parsed.data.tags } : {}) }, user.id);
  revalidatePath(`/teacher/courses/${courseId}`);
}

export async function setCoursePublishedAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const published = String(formData.get('published') ?? '') === 'true';
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'course', targetId: courseId || undefined, attempted: 'course_publish' });
  if (!courseId) return;
  const db = getServerDb();
  if (!db) return;
  await requireCourseOwnership(user, isAdmin, courseId, { targetType: 'course', targetId: courseId, attempted: 'course_publish' });
  await setCoursePublished(db, courseId, published, user.id);
  revalidatePath(`/teacher/courses/${courseId}`);
}

// ---- Teacher: lessons ----
export async function createLessonAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'lesson', targetId: courseId || undefined, attempted: 'lesson_create' });
  const parsed = lessonSchema.safeParse({ title: formData.get('title'), body: formData.get('body') || undefined, videoUrl: formData.get('videoUrl') || undefined, contentType: formData.get('contentType') || undefined, externalUrl: formData.get('externalUrl') || undefined, embedHtml: formData.get('embedHtml') || undefined });
  if (!parsed.success || !courseId) return;
  const db = getServerDb();
  if (!db) return;
  await requireCourseOwnership(user, isAdmin, courseId, { targetType: 'lesson', targetId: courseId, attempted: 'lesson_create' });
  const payload = lessonPayload(parsed.data);
  if (!payload) return;
  await createLesson(db, { courseId, title: parsed.data.title, body: parsed.data.body, contentType: parsed.data.contentType, videoUrl: payload.videoUrl ?? undefined, externalUrl: payload.externalUrl ?? undefined, embedHtml: payload.embedHtml, published: false }, user.id);
  revalidatePath(`/teacher/courses/${courseId}`);
}

// Edit an existing lesson's content (title/body/videoUrl/contentType/externalUrl). Same pipeline as create;
// the content_type/external_url write path for existing lessons (was absent — only publish toggling existed).
export async function updateLessonAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'lesson', targetId: lessonId || undefined, attempted: 'lesson_update' });
  const parsed = lessonSchema.safeParse({ title: formData.get('title'), body: formData.get('body') || undefined, videoUrl: formData.get('videoUrl') || undefined, contentType: formData.get('contentType') || undefined, externalUrl: formData.get('externalUrl') || undefined, embedHtml: formData.get('embedHtml') || undefined });
  if (!parsed.success || !courseId || !lessonId) return;
  const db = getServerDb();
  if (!db) return;
  const lesson = await getLessonById(db, lessonId);
  const lessonCourseId = lesson?.courseId;
  if (!lessonCourseId || lessonCourseId !== courseId) {
    await denyLmsMutation(user, { targetType: 'lesson', targetId: lessonId, attempted: 'lesson_update' }, 'parent_mismatch');
    return;
  }
  await requireCourseOwnership(user, isAdmin, lessonCourseId, { targetType: 'lesson', targetId: lessonId, attempted: 'lesson_update' });
  const payload = lessonPayload(parsed.data);
  if (!payload) return;
  await updateLesson(db, lessonId, { title: parsed.data.title, body: parsed.data.body ?? null, contentType: parsed.data.contentType, videoUrl: payload.videoUrl, externalUrl: payload.externalUrl, embedHtml: payload.embedHtml }, user.id, Date.now(), courseId);
  revalidatePath(`/teacher/courses/${courseId}`);
}

export async function setLessonPublishedAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  const published = String(formData.get('published') ?? '') === 'true';
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'lesson', targetId: lessonId || undefined, attempted: 'lesson_update' });
  if (!courseId || !lessonId) return;
  const db = getServerDb();
  if (!db) return;
  const lesson = await getLessonById(db, lessonId);
  const lessonCourseId = lesson?.courseId;
  if (!lessonCourseId || lessonCourseId !== courseId) {
    await denyLmsMutation(user, { targetType: 'lesson', targetId: lessonId, attempted: 'lesson_update' }, 'parent_mismatch');
    return;
  }
  await requireCourseOwnership(user, isAdmin, lessonCourseId, { targetType: 'lesson', targetId: lessonId, attempted: 'lesson_update' });
  await updateLesson(db, lessonId, { published }, user.id, Date.now(), courseId);
  revalidatePath(`/teacher/courses/${courseId}`);
}

export async function createMaterialAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  const now = Date.now();
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'material', targetId: lessonId || undefined, attempted: 'material_upload' });
  const base = materialBaseSchema.safeParse({ label: formData.get('label'), kind: formData.get('kind') || undefined });
  if (!base.success || !courseId || !lessonId) return;
  const db = getServerDb();
  if (!db) return;
  const lesson = await getLessonById(db, lessonId);
  const lessonCourseId = lesson?.courseId;
  if (!lessonCourseId || lessonCourseId !== courseId) {
    await denyLmsMutation(user, { targetType: 'material', targetId: lessonId, attempted: 'material_upload' }, 'parent_mismatch');
    return;
  }
  await requireCourseOwnership(user, isAdmin, lessonCourseId, { targetType: 'material', targetId: lessonId, attempted: 'material_upload' });
  let materialInput: Parameters<typeof createMaterial>[1] | null = null;
  let cleanupTaskId: string | null = null;
  if (base.data.kind === 'link') {
    const parsed = linkMaterialSchema.safeParse({ label: base.data.label, kind: 'link', url: formData.get('url') });
    if (!parsed.success) return;
    materialInput = { lessonId, label: parsed.data.label, kind: 'link', url: parsed.data.url };
  } else if (base.data.kind === 'embed') {
    const parsed = embedMaterialSchema.safeParse({ label: base.data.label, kind: 'embed', embedHtml: formData.get('embedHtml') });
    if (!parsed.success) return;
    try {
      materialInput = { lessonId, label: parsed.data.label, kind: 'embed', embedHtml: sanitizeLmsEmbedHtml(parsed.data.embedHtml).html };
    } catch {
      return;
    }
  } else {
    const fileMaterial = await fileMaterialFromForm(formData, base.data.label, now, db);
    materialInput = fileMaterial?.materialInput ?? null;
    cleanupTaskId = fileMaterial?.cleanupTaskId ?? null;
  }
  if (!materialInput) return;
  await createMaterialWithUploadCompensation({
    db,
    materialInput,
    cleanupTaskId,
    actorUserId: user.id,
    now,
    courseId,
    createMaterialFn: createMaterial,
    createMaterialAndCompleteCleanupFn: createMaterialAndCompleteLmsObjectCleanupTask,
    compensateFn: compensateLmsUploadedFile,
    completeCleanupTaskFn: completeLmsObjectCleanupTask,
    recordCleanupTaskFailureFn: recordLmsObjectCleanupTaskFailure,
  });
  revalidatePath(`/teacher/courses/${courseId}`);
}

export async function deleteMaterialAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const materialId = String(formData.get('materialId') ?? '');
  const { isAdmin } = lmsRoles(user);
  await requireTeacher(user, { targetType: 'material', targetId: materialId || undefined, attempted: 'material_delete' });
  if (!courseId || !materialId) return;
  const db = getServerDb();
  if (!db) return;
  const material = await getMaterialById(db, materialId);
  const lesson = material ? await getLessonById(db, material.lessonId) : null;
  const lessonCourseId = lesson?.courseId;
  if (!material || !lessonCourseId || lessonCourseId !== courseId) {
    await denyLmsMutation(user, { targetType: 'material', targetId: materialId, attempted: 'material_delete' }, 'parent_mismatch');
    return;
  }
  await requireCourseOwnership(user, isAdmin, lessonCourseId, { targetType: 'material', targetId: materialId, attempted: 'material_delete' });
  await deleteMaterial(db, materialId, user.id, Date.now(), courseId);
  revalidatePath(`/teacher/courses/${courseId}`);
}

// ---- Student ----
export async function enrollAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  if (!courseId) return;
  await requireEducationAccess(user, { targetType: 'course', targetId: courseId, attempted: 'enroll' }); // fail-closed: audit + throw
  const db = getServerDb();
  if (!db) return;
  const course = await getCourseById(db, courseId);
  if (!course || !course.published) return; // unpublished/not-found → graceful (not an authz denial)
  await upsertEnrollment(db, { userId: user.id, courseId });
  revalidatePath(`/app/education/${courseId}`);
}

export async function markLessonCompleteAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  const courseId = String(formData.get('courseId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  if (!courseId || !lessonId) return;
  await requireEducationAccess(user, { targetType: 'lesson', targetId: lessonId, attempted: 'progress' }); // fail-closed: audit + throw
  const db = getServerDb();
  if (!db) return;
  // Confirm the lesson is a published lesson of a published course (not-found → graceful)
  const lessons = await listLessonsForStudent(db, courseId, true);
  if (!lessons.some((l) => l.id === lessonId)) return;
  await upsertEnrollment(db, { userId: user.id, courseId });
  await upsertLessonProgress(db, { userId: user.id, lessonId, percentComplete: '100', completed: true });
  // Course completion: if every published lesson is completed, mark the enrollment complete (audited).
  const prog = await listCourseProgress(db, user.id, courseId);
  const completed = new Set(prog.filter((p) => p.completed).map((p) => p.lessonId));
  if (lessons.length > 0 && lessons.every((l) => completed.has(l.id))) {
    await markEnrollmentComplete(db, user.id, courseId);
  }
  revalidatePath(`/app/education/${courseId}/${lessonId}`);
  revalidatePath(`/app/education/${courseId}`);
}

// ---- Admin ----
const adminEnrollSchema = z.object({ userId: z.string().uuid(), courseId: z.string().uuid() });
export async function adminEnrollAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireUser();
  await requireAdmin(user, { targetType: 'enrollment', targetId: String(formData.get('courseId') ?? '') || undefined, attempted: 'admin_enroll' });
  const parsed = adminEnrollSchema.safeParse({ userId: formData.get('userId'), courseId: formData.get('courseId') });
  if (!parsed.success) return;
  const db = getServerDb();
  if (!db) return;
  // F-02: pass actorUserId (the admin) so the audit row records the admin as the actor,
  // not the enrolled student. upsertEnrollment signature: (db, input, now?, actorUserId?).
  await upsertEnrollment(db, { userId: parsed.data.userId, courseId: parsed.data.courseId }, Date.now(), user.id);
  revalidatePath('/admin/education');
}
