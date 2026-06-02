# ecosystem-education-implementer handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS reconciliation (read-only audit wave).
No code edited. Per `docs/SESSION_PROTOCOL.md`: this wave re-reconciles the Phase 2.1 rich
spec against the ACTUAL landed db-architect schema and produces the definitive, code-exact
landable spec. The implementer session that follows reads this file as the binding canonical
spec and ignores the column names in `docs/handoffs/20260530-0925-ecosystem-education-implementer.md`
wherever they conflict with findings below._

---

## Scope

The Phase 2.1 spec (`20260530-0925-ecosystem-education-implementer.md`) assumed a rich schema with
columns that were NOT built. The db-architect landed the LEANER schema now in `packages/db/src/schema.ts`.
This handoff:

1. Documents every column-name divergence between the 2.1 spec and the actual landed schema.
2. Produces the LANDABLE `LmsService` interface mapped ONLY to real columns and real repos.
3. Produces corrected view types that do not reference non-existent columns.
4. States the migration 0003 decision (recommendation: NO — route by id, not slug).
5. Specifies ownership guards reconciled to the actual dual-FK state of `courses`.
6. Specifies the route tree achievable on the lean schema.
7. Specifies the test matrix keyed to landed repos.

---

## Files inspected

- `AGENTS.md` — agent roster, non-negotiable gates, conventions.
- `docs/SESSION_PROTOCOL.md` — process governance.
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md` — Phase 2.1 spec (rich schema assumed).
- `docs/EDUCATION_LMS_PLAN.md` lines 1-1455 — full plan: §4, §5, §6, §8, §12, §17, §21.
- `packages/db/src/schema.ts` — ACTUAL landed Drizzle schema (authoritative).
- `packages/db/src/repositories.ts` — ACTUAL landed repos with exact signatures.
- `apps/web/src/lib/lms-types.ts` — current thin 4-method `LmsService` interface.
- `packages/lms/src/index.ts` — current thin synchronous `LmsService` class over Maps.
- `apps/web/src/lib/db-store.ts` — DB-backed adapter (wraps 4 thin LMS repos).
- `apps/web/src/lib/demo.ts` — in-memory adapter (wraps thin `LmsClass`).
- `apps/web/src/lib/backend.ts` — fail-closed selector; `deniedLmsService` stub (4 methods only).
- `apps/web/src/app/(app)/app/education/page.tsx` — student catalogue (thin, REAL).
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard (thin, REAL).
- `apps/web/src/app/teacher/courses/page.tsx` — pure `Placeholder`.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — pure `Placeholder`.
- `apps/web/src/app/teacher/materials/page.tsx` — pure `Placeholder`.
- `apps/web/src/app/teacher/students/page.tsx` — pure `Placeholder`.
- `apps/web/src/app/admin/education/page.tsx` — pure `Placeholder`.
- `apps/web/src/features/` — no `lms/` subdirectory exists yet.

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. [CRITICAL] lesson_progress uses percent_complete/completed/last_accessed_at — NOT state/progress_pct/last_seen_at

The Phase 2.1 spec (`20260530-0925`) specified `lesson_progress` with:
- `state` text ('started' | 'completed')
- `progress_pct` integer
- `started_at`, `completed_at`, `last_seen_at`

The ACTUAL landed schema (`schema.ts` lines 418-434) has:
- `percentComplete` numeric(5,2) (column: `percent_complete`)
- `completed` boolean (column: `completed`) — NOT a `state` text enum
- `lastAccessedAt` timestamp (column: `last_accessed_at`) — NOT `last_seen_at`
- `createdAt` timestamp (column: `created_at`)
- `updatedAt` timestamp (column: `updated_at`)

There is NO `state` column. There is NO `progress_pct` integer column. There is NO `started_at`.
There is NO `completed_at` on `lesson_progress`. There is NO `last_seen_at`.
There is NO `course_id` denormalization on `lesson_progress`.

The landed repo `upsertLessonProgress` (repositories.ts line 596) takes:
`{ userId, lessonId, percentComplete: string, completed: boolean }` and timestamps
`lastAccessedAt` and `updatedAt` only.

The landed repo `listCourseProgress` (line 606) joins via a lessons subquery to get lesson IDs
for the course — it does NOT use a `course_id` column on `lesson_progress`.

The Phase 2.1 spec's `ProgressView` and `checkCourseCompletion` logic are WRONG for the real schema.
The implementer must NOT use `state`, `progress_pct`, `started_at`, `last_seen_at`, or `course_id`
on `lesson_progress`. See Decisions section for the corrected model.

Evidence: `packages/db/src/schema.ts` lines 418-434; `repositories.ts` lines 596-612.

### 2. [CRITICAL] enrollments has no `source` column in the landed schema

The Phase 2.1 spec and `EDUCATION_LMS_PLAN.md §4.5` specified `enrollments.source` text
('entitlement' | 'manual_admin'). The ACTUAL landed schema (`schema.ts` lines 400-415) has:
- `userId`, `courseId`, `entitlementId` (nullable FK to entitlements), `enrolledAt`, `completedAt`

There is NO `source` column on the landed `enrollments` table.

The implementer must NOT reference `enrollments.source`. Instead: `entitlementId IS NULL` implies
`manual_admin`; `entitlementId IS NOT NULL` implies `entitlement`. The `EnrollmentView` DTO must not
expose a `source` field unless a migration adds it (see Decision D3).

Evidence: `schema.ts` lines 400-415; `repositories.ts` lines 571-593.

### 3. [CRITICAL] pinned_links.owner_id is NOT NULL and has no 'global' ownerType support

The Phase 2.1 spec allowed `owner_type = 'global'` with `owner_id = NULL`. The ACTUAL landed schema
(`schema.ts` line 442) has `ownerId: uuid('owner_id').notNull()` — NOT NULL. The comment at line 441
says `// teacher_profile | course (CHECK added in migration SQL)` — there is NO 'global' owner_type
in the landed schema.

The landed `createPinnedLink` repo (repositories.ts line 614) accepts only
`ownerType: 'teacher_profile' | 'course'` — no 'global' parameter. The landed `listPinnedLinks`
(line 622) requires BOTH `ownerType` and `ownerId` — there is no null-owner path.

The community sidebar in `education/page.tsx` (lines 51-57) renders static placeholder spans.
This CANNOT be wired to `listPinnedLinks({ownerType:'global'})` on the current schema because
'global' is not a supported owner_type and `ownerId` is NOT NULL.

Decision: see D4. The community sidebar remains static placeholder in Phase 2.2. A future migration
that adds `owner_type='global'` and makes `owner_id` nullable is needed before community links
can be DB-driven. Do NOT attempt to wire the community sidebar in Phase 2.2.

Evidence: `schema.ts` lines 437-452; `repositories.ts` lines 614-631.

### 4. [CRITICAL] courses has NO slug, NO level, NO tags, NO is_featured, NO sort_order, NO updated_at, NO thumbnail_url

The Phase 2.1 spec specified additive columns on `courses` that migration 0002 would add. The ACTUAL
landed schema (`schema.ts` lines 172-183) has EXACTLY:
- `id`, `ownerTeacherId`, `teacherProfileId` (nullable FK — landed), `title`, `description`,
  `productCode` (defaulted 'education'), `published`, `createdAt`

There is NO `slug`, NO `level`, NO `tags`, NO `is_featured`, NO `sort_order`, NO `updated_at`,
NO `thumbnail_url` on the actual courses table.

The Phase 2.1 `CourseAdminView` referenced `slug`, `level`, `tags`, `isFeatured`, `sortOrder`,
`thumbnailUrl`, `updatedAt`, `lessonCount`, `enrolledCount`. NONE of these columns exist.

Evidence: `schema.ts` lines 172-183; `rowToCourseDto` (repositories.ts line 343) maps only
`id`, `ownerTeacherId`, `title`, `description`, `productCode`, `published`, `createdAt`.

### 5. [CRITICAL] lessons has NO slug, NO content_type, NO embed_html, NO article_body, NO external_url, NO duration_sec, NO is_preview, NO sort_order, NO description, NO updated_at

The ACTUAL landed schema (`schema.ts` lines 185-193) has EXACTLY:
- `id`, `courseId`, `title`, `body`, `videoUrl`, `order`, `published`

The Phase 2.1 spec referenced `slug`, `contentType`, `embedHtml`, `articleBody`, `externalUrl`,
`durationSec`, `isPreview`, `sortOrder`, `description`, `updatedAt` on lessons. NONE exist.

Evidence: `schema.ts` lines 185-193; `rowToLessonDto` (repositories.ts line 348) maps only
`id`, `courseId`, `title`, `body`, `videoUrl`, `order`, `published`.

### 6. [CRITICAL] materials has NO title, NO material_type, NO file_key, NO file_name, NO file_size_bytes, NO mime_type, NO external_url, NO sort_order, NO created_at

The ACTUAL landed schema (`schema.ts` lines 195-201) has EXACTLY:
- `id`, `lessonId`, `label`, `url`, `kind` (default 'link')

The Phase 2.1 spec referenced `title`, `materialType`, `fileKey`, `fileName`, `fileSizeBytes`,
`mimeType`, `externalUrl`, `sortOrder` on materials. NONE exist — there is only `label`, `url`, `kind`.

Evidence: `schema.ts` lines 195-201.

### 7. [INFO] courses.teacherProfileId IS landed (nullable FK) — ownership reconciliation needed

`courses.teacherProfileId` (column `teacher_profile_id`) IS present as a nullable FK to
`teacherProfiles.id` (schema.ts line 177). However `courses.ownerTeacherId` (column `owner_teacher_id`)
is still present and NOT NULL (line 174). The thin repo `listCoursesForTeacher` uses `ownerTeacherId`
(repositories.ts line 370). No new repos use `teacherProfileId` yet.

For ownership guards: the implementer must check `teacherProfileId` when it is non-null; fall back to
`ownerTeacherId` when `teacherProfileId IS NULL`. Both columns exist simultaneously. See D5.

### 8. [INFO] Landed repos for teacher profiles, enrollments, progress, pinned links ARE present

The following repos ARE landed in `repositories.ts`:
- `createTeacherProfile` (line 552): takes `{ userId, displayName, bio?, avatarUrl?, socialLinks? }`,
  returns `TeacherProfileRow`, audits in-txn.
- `getTeacherProfile(db, userId)` (line 560): lookup by `userId` (not by `teacherProfileId`).
- `updateTeacherProfile(db, teacherProfileId, input, actorId)` (line 564): updates and audits.
- `upsertEnrollment(db, { userId, courseId, entitlementId? })` (line 573): idempotent, audits on insert.
- `listEnrollments(db, userId)` (line 585): by userId only.
- `markEnrollmentComplete(db, userId, courseId)` (line 588): updates completedAt, audits.
- `upsertLessonProgress(db, { userId, lessonId, percentComplete, completed })` (line 596): no audit.
- `getLessonProgress(db, userId, lessonId)` (line 602): returns row or null.
- `listCourseProgress(db, userId, courseId)` (line 606): joins lessons subquery.
- `createPinnedLink(db, { ownerType, ownerId, label, url, iconType?, sortOrder?, createdBy? })` (line 614).
- `listPinnedLinks(db, ownerType, ownerId)` (line 622): both args required.
- `deletePinnedLink(db, linkId, actorId)` (line 626): soft-delete, audits.

### 9. [INFO] No features/lms directory exists yet

`apps/web/src/features/` contains only `bots/` and `support/`. There is no `lms/` subdirectory.
The implementer creates `apps/web/src/features/lms/` from scratch.

### 10. [INFO] deniedLmsService in backend.ts covers only 4 methods

`apps/web/src/lib/backend.ts` lines 79-84: `deniedLmsService` implements only the 4 thin methods.
Every new method added to the `LmsService` interface must also appear in `deniedLmsService` or the
TypeScript compile will fail. This is a mechanical requirement.

---

## Decisions

### D1. No migration 0003 for Phase 2.2 — route by id, not slug

The Phase 2.1 spec assumed `slug` columns on courses and lessons enabling
`/app/education/[courseSlug]/[lessonSlug]` routes. These columns do NOT exist and adding them
requires a migration with backfill and unique constraints across live data.

Decision: Phase 2.2 routes by `id` throughout.
- Student route: `/app/education/[courseId]/page.tsx` and `/app/education/[courseId]/[lessonId]/page.tsx`
- Teacher route: `/teacher/courses/[id]/page.tsx` (already exists as Placeholder with `[id]`)
- Admin route: `/admin/education/courses/[id]/page.tsx`

This avoids migration 0003 entirely and is the correct choice for the lean schema. If slugs are
desired in a future phase, they are added in a dedicated additive migration with uniqueness backfill.
The implementer must NOT introduce slug fields in any schema, Zod schema, or route parameter.

### D2. lesson_progress model: use percentComplete (numeric string) and completed (boolean)

The service layer maps to the ACTUAL columns:
- `percentComplete`: stored as `numeric(5,2)` string in Drizzle; service receives and sends JS `number`
  (0-100); the adapter converts: `String(progressPct.toFixed(2))` on write, `parseFloat(row.percentComplete)` on read.
- `completed`: boolean. Auto-set to `true` when `progressPct >= 95` (video) or on explicit mark-complete.
- `lastAccessedAt`: the debounce column (replaces `last_seen_at` from the 2.1 spec).
- NO `state` enum. Service layer computes state as: `completed ? 'completed' : 'started'` in the DTO
  for UI convenience — it is a derived field, not a DB column.
- NO `started_at`. The `createdAt` column on `lesson_progress` serves as started_at.
- NO `course_id` on `lesson_progress`. The `listCourseProgress` repo joins via lessons subquery.

`checkCourseCompletion` logic: count published lessons WHERE `courseId=X`; count
`lesson_progress` rows WHERE `completed=true` AND `lessonId IN (published lesson ids of course)`.
The join via `listCourseProgress` (or an inline subquery) handles this without a `course_id` column.

### D3. enrollments: derive source from entitlementId presence; no source column

Since `enrollments` has no `source` column, the service derives it:
- `entitlementId IS NOT NULL` → source = 'entitlement'
- `entitlementId IS NULL` → source = 'manual_admin'

`upsertEnrollment` (the landed repo) does NOT set source explicitly; `entitlementId` nullable
captures the same information. The `EnrollmentView` DTO omits `source` for now or computes it:

```typescript
export interface EnrollmentView {
  id:           string;
  userId:       string;
  courseId:     string;
  enrolledAt:   number;   // epoch-ms
  completedAt?: number;
  source:       'entitlement' | 'manual_admin';  // derived: entitlementId null = manual
}
```

### D4. Community sidebar stays static in Phase 2.2; no 'global' pinned links

`pinnedLinks.ownerId` is NOT NULL and the schema comment restricts `ownerType` to
`'teacher_profile' | 'course'`. Wiring global community links requires a migration that adds
`owner_type='global'` support and makes `owner_id` nullable. This is deferred to a future phase.

The community card in `education/page.tsx` remains as-is (static placeholder spans).
The teacher community page creates only `ownerType='teacher_profile'` pinned links.
Course-level pinned links use `ownerType='course'`.

### D5. Ownership guard: check teacherProfileId first, fall back to ownerTeacherId

Since `courses.teacherProfileId` is nullable (not all existing rows have it populated), the guard:

```typescript
// packages/lms/src/guards/ownership.ts
export async function assertTeacherOwns(
  actorUserId: string,
  courseId: string,
  isAdmin: boolean,
  fetchCourse: (courseId: string) => Promise<{ ownerTeacherId: string; teacherProfileId: string | null } | null>,
  getTeacherProfileId?: (userId: string) => Promise<string | null>,
): Promise<void> {
  if (isAdmin) return;
  const course = await fetchCourse(courseId);
  if (!course) throw new LmsNotFound(`course ${courseId} not found`);
  // Primary check: teacherProfileId (if backfilled)
  if (course.teacherProfileId && getTeacherProfileId) {
    const tpId = await getTeacherProfileId(actorUserId);
    if (tpId && course.teacherProfileId === tpId) return;
  }
  // Fallback: ownerTeacherId (thin model / not yet backfilled)
  if (course.ownerTeacherId === actorUserId) return;
  throw new OwnershipDenied(`User ${actorUserId} does not own course ${courseId}`);
}
```

For lesson-level checks: load `lesson.courseId`, then call `assertTeacherOwns` for that course.
For material-level checks: load `material.lessonId` → `lesson.courseId` → assert.

### D6. LmsService interface: additive on the 4 thin methods, mapped to real columns only

The Phase 2.1 interface included methods that reference non-existent columns (slug, level, tags,
isFeatured, contentType, embedHtml, etc.). The Phase 2.2 interface is strictly mapped to real columns.
Methods that would require missing columns are either simplified or deferred. See full interface below.

### D7. packages/lms/src/index.ts: extend rather than replace in this wave

The thin synchronous `LmsService` class remains. The new async service functions live in
`packages/lms/src/service/` and `packages/lms/src/guards/`. The barrel `index.ts` re-exports both
the old thin class (for `demo.ts` backward compat) and the new service modules. The `demo.ts` adapter
is extended to implement every new method, labeled "storage: in-memory (demo)".

---

## Repo-mapping table (landed repos → LmsService methods)

| LmsService method | Backed by repo | Repo signature (actual) |
|---|---|---|
| `createCourse` (thin, keep) | `createCourse` | `(db, {ownerTeacherId, title, description?, published?}, now)` |
| `listCoursesForTeacher` (thin) | `listCoursesForTeacher` | `(db, ownerTeacherId, isAdmin)` |
| `listPublishedCourses` (thin) | `listPublishedCourses` | `(db)` |
| `listLessonsForStudent` (thin) | `listLessonsForStudent` | `(db, courseId, hasEducationAccess)` |
| `createTeacherProfile` | `createTeacherProfile` | `(db, {userId, displayName, bio?, avatarUrl?, socialLinks?}, now)` |
| `getTeacherProfileByUserId` | `getTeacherProfile` | `(db, userId)` |
| `updateTeacherProfile` | `updateTeacherProfile` | `(db, teacherProfileId, input, actorId, now)` |
| `setTeacherProfileActive` | `updateTeacherProfile` | patch `{isActive}` with adminId |
| `ensureEnrolled` | `upsertEnrollment` | `(db, {userId, courseId, entitlementId?}, now)` |
| `adminCreateEnrollment` | `upsertEnrollment` | `(db, {userId, courseId}, now)` + manual audit row |
| `getCourseStudentList` | `listEnrollments` + users join | manual query: no dedicated repo yet |
| `upsertProgress` | `upsertLessonProgress` | `(db, {userId, lessonId, percentComplete, completed}, now)` |
| `getLessonProgress` | `getLessonProgress` | `(db, userId, lessonId)` |
| `getCourseProgress` | `listCourseProgress` | `(db, userId, courseId)` |
| `markLessonComplete` | `upsertLessonProgress` | same repo, `completed:true, percentComplete:'100.00'` |
| `markEnrollmentComplete` | `markEnrollmentComplete` | `(db, userId, courseId, now)` |
| `listPinnedLinks` | `listPinnedLinks` | `(db, ownerType, ownerId)` — ownerId required |
| `createPinnedLink` | `createPinnedLink` | `(db, {ownerType, ownerId, label, url, iconType?, sortOrder?, createdBy?}, now)` |
| `deletePinnedLink` | `deletePinnedLink` | `(db, linkId, actorId, now)` |

Methods that require columns NOT in the landed schema (updateCourse, createLesson, updateLesson,
deleteCourse, createMaterial, deleteMaterial, getMaterialDownloadUrl, getLessonForStudent,
publishCourse, unpublishCourse) must be implemented against the THIN columns that DO exist.
See "Landable interface" section below.

---

## Landable LmsService interface (Phase 2.2 — real columns only)

This replaces the rich 22-method interface from the 2.1 spec. It is ADDITIVE on the 4 thin methods.
Every method maps only to columns that exist in the actual schema.

```typescript
// apps/web/src/lib/lms-types.ts — REPLACEMENT
import type { CourseDTO, LessonDTO } from '@wtc/db';

export type CourseView = CourseDTO;
export type LessonView = LessonDTO;

export interface LmsActor {
  userId:  string;
  isAdmin: boolean;
}

// ---- Lean view types (real columns only) ----

export interface TeacherProfileView {
  id:          string;
  userId:      string;
  displayName: string;
  bio?:        string;
  avatarUrl?:  string;
  socialLinks: Record<string, string>;  // { telegram?, instagram?, youtube?, twitter?, website? }
  isActive:    boolean;
  createdAt:   number;   // epoch-ms
  updatedAt:   number;
}

/** Admin/teacher course view: only columns that exist. */
export interface CourseAdminView {
  id:               string;
  ownerTeacherId:   string;
  teacherProfileId: string | null;   // nullable until backfill completes
  title:            string;
  description?:     string;
  productCode:      string;
  published:        boolean;         // the REAL column name is `published`, not `is_published`
  createdAt:        number;
}

/** Progress view mapped to landed columns. */
export interface LessonProgressView {
  id:              string;
  userId:          string;
  lessonId:        string;
  percentComplete: number;           // parsed from numeric string
  completed:       boolean;
  state:           'started' | 'completed';  // derived: completed ? 'completed' : 'started'
  lastAccessedAt:  number;           // epoch-ms from last_accessed_at
  createdAt:       number;           // epoch-ms — serves as started_at
  updatedAt:       number;
}

export interface CourseProgressSummary {
  courseId:          string;
  totalLessons:      number;
  completedLessons:  number;
  progressPct:       number;   // 0-100, floor((completedLessons/totalLessons)*100)
  completedAt?:      number;   // from enrollments.completed_at
}

export interface EnrollmentView {
  id:           string;
  userId:       string;
  courseId:     string;
  enrolledAt:   number;
  completedAt?: number;
  source:       'entitlement' | 'manual_admin';  // derived from entitlementId nullability
}

/** Never includes email or raw userId. Teacher sees display names + metrics. */
export interface StudentProgressSummary {
  displayName:      string;
  enrolledAt:       number;
  completedLessons: number;
  totalLessons:     number;
  progressPct:      number;
  lastAccessedAt?:  number;
}

export interface PinnedLinkView {
  id:        string;
  ownerType: 'teacher_profile' | 'course';  // NO 'global' — column is NOT NULL in schema
  ownerId:   string;                          // NOT NULL in schema
  label:     string;
  url:       string;
  iconType?: string;
  sortOrder: number;
  isActive:  boolean;
}

// ---- Material view (lean columns: label, url, kind) ----
export interface MaterialView {
  id:       string;
  lessonId: string;
  label:    string;   // the real column (not 'title')
  url:      string;   // the real column (for link kind; no signed URL yet)
  kind:     string;   // 'link' | 'file' | 'embed'
}

// ---- LmsService: additive on the 4 thin methods ----
export interface LmsService {
  // ---- THIN model (Phase 1.7 — unchanged signatures) ----
  createCourse(
    actor: LmsActor,
    input: { title: string; description?: string; published?: boolean },
    now: number,
  ): Promise<CourseView>;
  listCoursesForTeacher(actor: LmsActor): Promise<CourseView[]>;
  listPublishedCourses(): Promise<CourseView[]>;
  listLessonsForStudent(courseId: string, hasEducationAccess: boolean): Promise<LessonView[]>;

  // ---- Teacher profiles ----
  /** Admin only: create a teacher profile. Throws if user already has a profile (unique constraint). */
  createTeacherProfile(
    adminUserId: string,
    input: { userId: string; displayName: string; bio?: string; avatarUrl?: string; socialLinks?: Record<string, string> },
  ): Promise<TeacherProfileView>;

  /** Lookup by session userId. Returns null if no profile exists. */
  getTeacherProfileByUserId(userId: string): Promise<TeacherProfileView | null>;

  /**
   * Admin or self (profile.userId === actorUserId).
   * Throws OwnershipDenied if actorUserId != profile.userId and !isAdmin.
   */
  updateTeacherProfile(
    actorUserId: string,
    isAdmin: boolean,
    teacherProfileId: string,
    patch: Partial<{ displayName: string; bio: string; avatarUrl: string; socialLinks: Record<string, string> }>,
  ): Promise<TeacherProfileView>;

  /** Admin only: flip isActive. */
  setTeacherProfileActive(adminUserId: string, teacherProfileId: string, isActive: boolean): Promise<void>;

  // ---- Course mutations (lean: only real columns) ----
  /**
   * Teacher or admin. Patch covers only real columns: title, description, productCode, published.
   * Throws OwnershipDenied if teacher does not own course.
   * Writes education.course.updated audit row.
   */
  updateCourse(
    actorUserId: string,
    isAdmin: boolean,
    courseId: string,
    patch: Partial<{ title: string; description: string; productCode: string; published: boolean }>,
  ): Promise<CourseView>;

  /** Convenience: sets published=true. Audits education.course.published. */
  publishCourse(actorUserId: string, isAdmin: boolean, courseId: string): Promise<void>;

  /** Convenience: sets published=false. Audits education.course.unpublished. */
  unpublishCourse(actorUserId: string, isAdmin: boolean, courseId: string): Promise<void>;

  // ---- Lesson mutations (lean: real columns only) ----
  /**
   * Teacher or admin. Real columns: title, body, videoUrl, order, published.
   * Audits education.lesson.created.
   */
  createLesson(
    actorUserId: string,
    isAdmin: boolean,
    courseId: string,
    input: { title: string; body?: string; videoUrl?: string; order?: number; published?: boolean },
  ): Promise<LessonView>;

  /**
   * Teacher or admin. Patch covers real columns: title, body, videoUrl, order, published.
   * Audits education.lesson.updated.
   */
  updateLesson(
    actorUserId: string,
    isAdmin: boolean,
    lessonId: string,
    patch: Partial<{ title: string; body: string; videoUrl: string; order: number; published: boolean }>,
  ): Promise<LessonView>;

  /**
   * Reorder lessons: batch update `order` column for a set of lessonIds.
   * orderedLessonIds[0] gets order=1, [1] gets order=2, etc.
   * Audits education.lesson.reordered.
   */
  reorderLessons(actorUserId: string, isAdmin: boolean, courseId: string, orderedLessonIds: string[]): Promise<void>;

  /**
   * Student-facing lesson fetch. Caller must have already verified entitlement.
   * Returns null if lesson or course is not published (never leaks existence).
   * Audits education.lesson.view.
   */
  getLessonForStudent(userId: string, lessonId: string): Promise<LessonView | null>;

  // ---- Material mutations (lean: label, url, kind) ----
  /**
   * Teacher or admin. Only lean columns: label, url, kind.
   * Audits education.material.created.
   */
  createMaterial(
    actorUserId: string,
    isAdmin: boolean,
    lessonId: string,
    input: { label: string; url: string; kind?: string },
  ): Promise<MaterialView>;

  /**
   * Soft-delete not possible (no is_active on materials). Hard-delete with CASCADE is correct here.
   * Audits education.material.deleted.
   */
  deleteMaterial(actorUserId: string, isAdmin: boolean, materialId: string): Promise<void>;

  // ---- Enrollments ----
  /**
   * Idempotent upsert. ON CONFLICT (user_id, course_id) DO NOTHING.
   * Audits education.enrolled only on first enrollment (real insert, not conflict).
   * entitlementId: optional; pass when triggered by an entitlement check.
   */
  ensureEnrolled(userId: string, courseId: string, entitlementId?: string): Promise<EnrollmentView>;

  /**
   * Admin only. Explicitly creates enrollment. Audits education.enrollment.created.
   */
  adminCreateEnrollment(adminUserId: string, userId: string, courseId: string): Promise<EnrollmentView>;

  /**
   * Teacher or admin. Returns displayName + progress metrics. Never returns email/userId.
   */
  getCourseStudentList(actorUserId: string, isAdmin: boolean, courseId: string): Promise<StudentProgressSummary[]>;

  // ---- Progress ----
  /**
   * Debounced UPSERT on (user_id, lesson_id).
   * percentComplete: 0-100 (integer from client).
   * Server-side debounce guard: if existing.last_accessed_at > NOW()-8s → return existing row.
   * Auto-sets completed=true when percentComplete >= 95.
   * After completed flips true: calls checkCourseCompletion in same txn.
   * No per-call audit row.
   */
  upsertProgress(userId: string, lessonId: string, courseId: string, percentComplete: number): Promise<LessonProgressView>;

  /**
   * Explicit mark-complete (article/link lessons). Sets completed=true, percentComplete=100.
   * Calls checkCourseCompletion in same txn.
   */
  markLessonComplete(userId: string, lessonId: string, courseId: string): Promise<LessonProgressView>;

  /** Get a single lesson's progress for a user. Returns null if no row. */
  getLessonProgress(userId: string, lessonId: string): Promise<LessonProgressView | null>;

  /** Get course-level progress summary. Uses listCourseProgress + enrollment.completedAt. */
  getCourseProgress(userId: string, courseId: string): Promise<CourseProgressSummary>;

  // ---- Pinned links (no 'global' owner_type — ownerId is NOT NULL) ----
  /** ownerType: 'teacher_profile' | 'course'. ownerId required (NOT NULL in schema). */
  listPinnedLinks(ownerType: 'teacher_profile' | 'course', ownerId: string): Promise<PinnedLinkView[]>;

  /**
   * Teacher: ownerType='teacher_profile' with own profileId, or 'course' for own courses.
   * Admin: any ownerType and ownerId.
   * Audits education.pinned_link.created.
   */
  createPinnedLink(
    actorUserId: string,
    isAdmin: boolean,
    input: { ownerType: 'teacher_profile' | 'course'; ownerId: string; label: string; url: string; iconType?: string; sortOrder?: number },
  ): Promise<PinnedLinkView>;

  /**
   * Soft-delete (is_active=false). Teacher can delete own links; admin can delete any.
   * Audits education.pinned_link.deleted.
   */
  deletePinnedLink(actorUserId: string, isAdmin: boolean, linkId: string): Promise<void>;
}
```

---

## Corrected Zod schemas (packages/lms/src/schemas.ts — real columns only)

```typescript
import { z } from 'zod';

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'URL must use https://',
});

export const SocialLinksSchema = z.object({
  telegram:  httpsUrl.optional(),
  instagram: httpsUrl.optional(),
  youtube:   httpsUrl.optional(),
  twitter:   httpsUrl.optional(),
  website:   httpsUrl.optional(),
}).passthrough();  // passthrough: new platforms do not break validation

export const CreateTeacherProfileSchema = z.object({
  userId:      z.string().uuid(),
  displayName: z.string().min(2).max(100),
  bio:         z.string().max(2000).optional(),
  avatarUrl:   httpsUrl.optional(),
  socialLinks: SocialLinksSchema.optional(),
});

export const UpdateTeacherProfileSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio:         z.string().max(2000).optional(),
  avatarUrl:   httpsUrl.optional(),
  socialLinks: SocialLinksSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'patch must have at least one field' });

// Course: only real columns
export const CreateCourseSchema = z.object({
  title:       z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  productCode: z.string().optional(),   // default 'education' applied by DB
  published:   z.boolean().default(false),
});

export const UpdateCourseSchema = z.object({
  title:       z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  productCode: z.string().optional(),
  published:   z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'patch must have at least one field' });

// Lesson: only real columns (body, videoUrl, order, published)
export const CreateLessonSchema = z.object({
  title:     z.string().min(3).max(300),
  body:      z.string().max(100000).optional(),
  videoUrl:  httpsUrl.optional(),
  order:     z.number().int().min(0).default(0),
  published: z.boolean().default(false),
});

export const UpdateLessonSchema = z.object({
  title:     z.string().min(3).max(300).optional(),
  body:      z.string().max(100000).optional(),
  videoUrl:  httpsUrl.optional(),
  order:     z.number().int().min(0).optional(),
  published: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'patch must have at least one field' });

export const ReorderLessonsSchema = z.object({
  courseId:         z.string().uuid(),
  orderedLessonIds: z.array(z.string().uuid()).min(1),
});

// Material: only real columns (label, url, kind)
export const CreateMaterialSchema = z.object({
  label: z.string().min(1).max(200),
  url:   httpsUrl,
  kind:  z.enum(['link', 'file', 'embed']).default('link'),
});

// Progress: percentComplete as integer (service converts to numeric string for DB)
export const UpsertProgressSchema = z.object({
  lessonId:       z.string().uuid(),
  courseId:       z.string().uuid(),
  percentComplete: z.number().int().min(0).max(100),
});

export const MarkCompleteSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
});

// Pinned links: no 'global' ownerType — ownerId always required
export const CreatePinnedLinkSchema = z.object({
  ownerType: z.enum(['teacher_profile', 'course']),
  ownerId:   z.string().uuid(),
  label:     z.string().min(1).max(100),
  url:       httpsUrl,
  iconType:  z.enum(['telegram', 'instagram', 'youtube', 'discord', 'link']).default('link'),
  sortOrder: z.number().int().min(0).default(0),
});
```

---

## Ownership guards (reconciled to dual-FK state)

### assertTeacherOwns (packages/lms/src/guards/ownership.ts)

See Decision D5 for the full signature. Key points:
- Admin bypass (isAdmin=true): skip ownership check, still audit.
- Primary check: `course.teacherProfileId === teacherProfile.id` where `teacherProfile.userId === actorUserId`.
- Fallback: `course.ownerTeacherId === actorUserId` (for rows not yet backfilled with teacherProfileId).
- Throws `OwnershipDenied` if both checks fail.
- For lessons: load `lesson.courseId` first, then assert on that course.
- For materials: load `material.lessonId` → lesson → `lesson.courseId` → assert.

### assertEducationAccess (packages/lms/src/guards/entitlement.ts)

Unchanged from 2.1 spec. Calls `hasAccess(userId, productCode ?? 'education')` from
`@wtc/entitlements`. On failure throws `EntitlementDenied`. Route catches → 403 JSON.
Never redirects. Unknown state → denied (fail-closed).

### Which methods are admin-only

- `createTeacherProfile`: admin only.
- `setTeacherProfileActive`: admin only.
- `adminCreateEnrollment`: admin only.
- `setCourseFeatured`: not in Phase 2.2 interface (no `is_featured` column exists).

---

## Route trees achievable on the lean schema

Routes use `[id]` throughout (no slugs exist).

### Student routes (apps/web/src/app/(app)/app/education/)

| Route | Status | Data calls | Guard |
|---|---|---|---|
| `page.tsx` | REAL — extend | `listPublishedCourses` | entitlement check (existing) |
| `[courseId]/page.tsx` | NEW | `listPublishedCourses` (find by id), `listLessonsForStudent`, `ensureEnrolled`, `getCourseProgress` | assertEducationAccess before render |
| `[courseId]/[lessonId]/page.tsx` | NEW | `getLessonForStudent`, `getLessonProgress`, `listCourseProgress` | assertEducationAccess before render |

### API routes (apps/web/src/app/api/education/)

| Route | Method | Handler calls | Guard |
|---|---|---|---|
| `progress/route.ts` | POST | `upsertProgress` | assertEducationAccess; rate limit 6/min/user/lesson |
| `progress/complete/route.ts` | POST | `markLessonComplete` | assertEducationAccess |
| `materials/[materialId]/download/route.ts` | GET | returns `material.url` directly (no signed URL in Phase 2.2 — lean schema has url column) | assertEducationAccess; 302 to material.url |

Note: the materials download is simpler in Phase 2.2 because the lean `materials` table has only
`url` (no `file_key`). The route returns the stored URL directly. No stub header needed because
this is the actual data, not a placeholder.

### Teacher routes (apps/web/src/app/teacher/)

| Route | Status | Data calls |
|---|---|---|
| `page.tsx` | REAL — extend | `listCoursesForTeacher`, `getTeacherProfileByUserId` |
| `courses/page.tsx` | Placeholder — FILL | `listCoursesForTeacher` |
| `courses/[id]/page.tsx` | Placeholder — FILL | `updateCourse`, `publishCourse`, `unpublishCourse`, `listLessonsForStudent` (own lessons via teacher path) |
| `courses/[id]/lessons/new/page.tsx` | NEW | `createLesson` |
| `courses/[id]/lessons/[lessonId]/page.tsx` | NEW | `updateLesson`, materials list |
| `courses/[id]/lessons/[lessonId]/materials/page.tsx` | NEW | `createMaterial`, `deleteMaterial` |
| `materials/page.tsx` | Placeholder — repurpose as redirect or remove |
| `students/page.tsx` | Placeholder — FILL | `getCourseStudentList` |
| `community/page.tsx` | NEW | `updateTeacherProfile` (socialLinks), `listPinnedLinks`, `createPinnedLink`, `deletePinnedLink` |

### Admin education routes (apps/web/src/app/admin/education/)

| Route | Status | Data calls |
|---|---|---|
| `page.tsx` | Placeholder — FILL | `listPublishedCourses`, `listCoursesForTeacher(isAdmin:true)` |
| `courses/page.tsx` | NEW | `listCoursesForTeacher({isAdmin:true})` |
| `courses/[id]/page.tsx` | NEW | `updateCourse(isAdmin:true)`, `publishCourse/unpublishCourse` |
| `teachers/page.tsx` | NEW | list all teacher profiles (repo: `db.select().from(teacherProfiles)`) |
| `teachers/[id]/page.tsx` | NEW | `updateTeacherProfile(isAdmin:true)`, `setTeacherProfileActive` |
| `enrollments/page.tsx` | NEW | `adminCreateEnrollment` |
| `audit/page.tsx` | NEW | `recentAuditEvents()` filtered by `action LIKE 'education.%'` |

### features/lms/ structure (to create)

```
apps/web/src/features/lms/
  queries.ts       -- server-only DB query helpers (thin wrappers over @wtc/db repos)
  actions.ts       -- Next.js Server Actions for mutations (createCourse, updateLesson, etc.)
  components/
    ProgressBar.tsx        -- progress ring / bar (reads progressPct, completed)
    LessonList.tsx         -- course overview lesson list with checkmarks
    MarkCompleteButton.tsx -- client island → POST /api/education/progress/complete
    ProgressTracker.tsx    -- client island → POST /api/education/progress (video timeupdate)
    PinnedLinkCard.tsx     -- renders a single pinned link pill
    MaterialLink.tsx       -- renders a material row (label + url)
    StorageModePill.tsx    -- "storage: Postgres" / "storage: in-memory (demo)" pill
```

---

## Progress / completion persistence rules (corrected for lean schema)

### upsertProgress

```
Route: POST /api/education/progress
Body validated: UpsertProgressSchema { lessonId, courseId, percentComplete }
Guard: assertEducationAccess(userId, course.productCode ?? 'education')
Rate limit: 6/min/user/lesson

Service: upsertProgress(userId, lessonId, courseId, percentComplete)
  1. Load existing row: getLessonProgress(db, userId, lessonId)
  2. Server debounce: if existing.lastAccessedAt > NOW() - 8s → return existing row as-is
  3. Compute completed: percentComplete >= 95
  4. Call: upsertLessonProgress(db, {
       userId, lessonId,
       percentComplete: percentComplete.toFixed(2),
       completed,
       // lastAccessedAt and updatedAt set by repo
     }, now)
  5. If completed flips from false → true: checkCourseCompletion(tx, userId, courseId) in same txn
  6. Return LessonProgressView (derived state = completed ? 'completed' : 'started')
```

### markLessonComplete

```
Route: POST /api/education/progress/complete
Body validated: MarkCompleteSchema { lessonId, courseId }
Guard: assertEducationAccess

Service: markLessonComplete(userId, lessonId, courseId)
  1. Call upsertLessonProgress(db, { userId, lessonId, percentComplete:'100.00', completed:true }, now)
  2. checkCourseCompletion(tx, userId, courseId) in same txn
  3. Return LessonProgressView
```

### checkCourseCompletion (internal, within existing txn)

```
1. SELECT lessons WHERE course_id=courseId AND published=true → totalCount
2. listCourseProgress(tx, userId, courseId) → filter rows WHERE completed=true → completedCount
   (listCourseProgress joins via lessons subquery — no course_id on lesson_progress)
3. If completedCount == totalCount AND totalCount > 0:
   a. markEnrollmentComplete(tx, userId, courseId, now)
      → UPDATE enrollments SET completed_at=NOW()
      → INSERT audit_log: action='education.course_completed' (the actual audit action used by the repo)
4. Return (idempotent: markEnrollmentComplete is safe to call if already set)
```

Note: the landed `markEnrollmentComplete` repo (line 588) already writes the audit row with action
`'education.course_completed'` (not `'education.course.completed'` as in the 2.1 spec — use the
ACTUAL string from the repo).

---

## Verification / tests

These 8 tests are keyed to the ACTUAL landed repos. All use the PGlite pattern from
`tests/integration/db-persistence.test.ts`.

### Test 1: Ownership — teacher A cannot edit teacher B's course

```
Setup:
  userA, userB: createUser each
  courseB: createCourse(db, { ownerTeacherId: userB.id, title:'Course B' })

Test:
  // Service layer: assertTeacherOwns(userA.id, courseB.id, false, fetchCourse, getProfileId)
  // With both teacherProfileId=null and ownerTeacherId=userB.id, userA.id !== userB.id
  await expect(lmsService.updateCourse(userA.id, false, courseB.id, { title:'Hacked' }))
    .rejects.toThrow(OwnershipDenied)

Admin override:
  await expect(lmsService.updateCourse(userA.id, true, courseB.id, { title:'Admin edit' }))
    .resolves.toMatchObject({ title: 'Admin edit' })
  // audit_logs must contain action='education.course.updated' with actor=userA.id
```

### Test 2: Entitlement fail-closed

```
Setup: user with NO entitlements; course (published=true); lesson (published=true)

Test:
  // access check (packages/entitlements)
  const access = hasAccess(user.id, 'education')
  expect(access.allowed).toBe(false)

  // listLessonsForStudent fail-closed
  const lessons = await lmsService.listLessonsForStudent(course.id, false)
  expect(lessons).toEqual([])

  // assertEducationAccess throws
  await expect(assertEducationAccess(user.id, 'education', hasAccess))
    .rejects.toThrow(EntitlementDenied)
```

### Test 3: Enrollment idempotency

```
Setup: user, course

Test:
  const e1 = await upsertEnrollment(db, { userId: user.id, courseId: course.id })
  const e2 = await upsertEnrollment(db, { userId: user.id, courseId: course.id })
  expect(e1.id).toBe(e2.id)
  // Only one audit row for 'education.enrolled'
  const auditRows = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'education.enrolled'))
  expect(auditRows).toHaveLength(1)
```

### Test 4: Progress upsert — debounce guard

```
Setup: user, lesson

Test:
  const now = Date.now()
  await upsertLessonProgress(db, { userId, lessonId, percentComplete:'50.00', completed:false }, now)
  await upsertLessonProgress(db, { userId, lessonId, percentComplete:'70.00', completed:false }, now + 4000)
  // Second call is within 8s debounce → row should still show 50.00
  const row = await getLessonProgress(db, userId, lessonId)
  expect(parseFloat(row.percentComplete)).toBe(50)  // NOT updated
```

### Test 5: upsertProgress auto-complete at 95%

```
Setup: user, lesson; ensureEnrolled

Test:
  await upsertLessonProgress(db, { userId, lessonId, percentComplete:'95.00', completed:true }, now)
  const row = await getLessonProgress(db, userId, lessonId)
  expect(row.completed).toBe(true)
  expect(parseFloat(row.percentComplete)).toBe(95)
```

### Test 6: Course completion — markEnrollmentComplete + audit

```
Setup: user, course (published=true), lesson (published=true)
  await upsertEnrollment(db, { userId, courseId })

Test A: markLessonComplete → completed=true on lesson_progress
  await upsertLessonProgress(db, { userId, lessonId, percentComplete:'100.00', completed:true }, now)
  const row = await getLessonProgress(db, userId, lessonId)
  expect(row.completed).toBe(true)

Test B: checkCourseCompletion → enrollment.completed_at set
  await markEnrollmentComplete(db, userId, courseId, now)
  const enrollments = await db.select().from(s.enrollments)
    .where(and(eq(s.enrollments.userId, userId), eq(s.enrollments.courseId, courseId)))
  expect(enrollments[0].completedAt).toBeDefined()

Test C: audit row for education.course_completed
  const logs = await db.select().from(s.auditLogs)
    .where(eq(s.auditLogs.action, 'education.course_completed'))
  expect(logs).toHaveLength(1)
```

### Test 7: Pinned link CRUD — ownerId required, soft-delete

```
Setup: teacherProfile row

Test:
  const link = await createPinnedLink(db, {
    ownerType: 'teacher_profile', ownerId: teacherProfile.id,
    label:'Telegram channel', url:'https://t.me/wtc_example', createdBy: teacher.id
  })
  expect(link.isActive).toBe(true)

  const links = await listPinnedLinks(db, 'teacher_profile', teacherProfile.id)
  expect(links).toHaveLength(1)

  await deletePinnedLink(db, link.id, teacher.id)
  const afterDelete = await listPinnedLinks(db, 'teacher_profile', teacherProfile.id)
  expect(afterDelete).toHaveLength(0)  // isActive=false filtered out
```

### Test 8: Per-user progress isolation

```
Setup: userA, userB, course, lesson
  await upsertLessonProgress(db, { userId:userA.id, lessonId, percentComplete:'60.00', completed:false }, now)

Test:
  const rowA = await getLessonProgress(db, userA.id, lessonId)
  expect(rowA).not.toBeNull()

  const rowB = await getLessonProgress(db, userB.id, lessonId)
  expect(rowB).toBeNull()

  const progressB = await listCourseProgress(db, userB.id, courseId)
  expect(progressB).toHaveLength(0)
```

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Phase 2.1 spec used wrong column names (state, progress_pct, last_seen_at) in all code examples | P0 | This handoff is the binding spec; implementer discards 2.1 code examples for lesson_progress |
| No slug on courses/lessons → all existing links must use id in URLs | P1 | Phase 2.2 uses id routing; document for future slug migration |
| `pinnedLinks.ownerId` NOT NULL → 'global' community sidebar cannot be wired | P1 | Community sidebar stays static; future migration needed |
| `enrollments` has no `source` column → source must be derived from `entitlementId` nullability | P1 | EnrollmentView.source is derived field; document in adapter comments |
| `lessonProgress` has no `course_id` → `checkCourseCompletion` must join via lessons subquery | P1 | Use `listCourseProgress` repo which already does the join |
| `deniedLmsService` in backend.ts covers only 4 methods → compile error on interface extension | P1 | Implementer extends deniedLmsService first; typecheck gate enforces completeness |
| `demo.ts` in-memory adapter: all new methods must be implemented | P1 | TypeScript compile error enforces; every method must have in-memory implementation labeled "demo" |
| `updateTeacherProfile` repo signature: takes `(db, teacherProfileId, input, actorId)` not `(db, userId, ...)` | P1 | Service layer loads teacherProfileId from `getTeacherProfile(db, userId)` first |
| `listCourseProgress` scans ALL lesson_progress for user then filters by lesson set — O(n) per user | P2 | Acceptable at MVP scale; document as a future index optimization |
| `materials.url` is always public (no signed URL mechanism in lean schema) | P2 | Material download route returns 302 to stored URL directly; label as "direct link" not "signed URL" |
| Concurrent `checkCourseCompletion` calls: two parallel markLessonComplete could double-complete | P1 | `markEnrollmentComplete` uses UPDATE (not INSERT); idempotent. The SET completed_at is idempotent |

---

## Next actions

1. **Implementer session (Phase 2.2 implementation):** Read THIS handoff as the binding spec. The
   Phase 2.1 handoff (`20260530-0925-ecosystem-education-implementer.md`) must NOT be used for column
   names, Zod schemas, or view types — it assumed a schema that was not built. Use only the
   interface and schemas from this handoff.

2. **First: extend `deniedLmsService` in `apps/web/src/lib/backend.ts`** to cover all methods in
   the new `LmsService` interface. Every new method must throw `DENIED_MSG`. TypeScript compile will
   fail if any method is missing. This is the first change to make.

3. **Second: extend `LmsService` interface in `apps/web/src/lib/lms-types.ts`** with the full
   interface from this handoff. Keep the 4 thin methods unchanged at the top.

4. **Third: create `packages/lms/src/schemas.ts`** with the corrected Zod schemas (real columns only).
   Create `packages/lms/src/errors.ts` with `LmsError`, `EntitlementDenied`, `OwnershipDenied`,
   `LmsNotFound`, `LmsConflict`. Create `packages/lms/src/guards/ownership.ts` (D5 signature) and
   `packages/lms/src/guards/entitlement.ts`.

5. **Fourth: create `packages/lms/src/service/` modules** for courses, lessons, materials, enrollments,
   progress, teacher-profiles, pinned-links. Each module is async, takes a `Db` instance, calls the
   landed repos, enforces ownership/entitlement guards, writes audit rows in-txn.

6. **Fifth: implement `apps/web/src/features/lms/`** (queries.ts, actions.ts, components/).

7. **Sixth: extend `apps/web/src/lib/db-store.ts`** — add all new methods to the `lmsService` object,
   importing the new `packages/lms/src/service/` modules.

8. **Seventh: extend `apps/web/src/lib/demo.ts`** — add all new methods to the in-memory `lmsService`
   object. Every method must work against the in-memory `LmsStore` Maps. Label "storage: in-memory (demo)".

9. **Eighth: fill/create routes** in the teacher, student, and admin trees as specified above.

10. **Run gates sequentially per SESSION_PROTOCOL §6:**
    `governance:check` → `check:core` → `lint` → `typecheck` → `typecheck -w @wtc/web` → `test`
    → `secret:scan` → `coverage` → `build -w @wtc/web` → `e2e`.
    Real Postgres `db:migrate`/`db:seed` = NOT RUN unless a throwaway `DATABASE_URL` is provided.

11. **Stop condition:** If context exceeds limits or quality degrades mid-wave, write a per-agent
    handoff capturing exact state (which modules complete, which remain) per SESSION_PROTOCOL §8.

12. **Future (separate phase, separate migration):** Add `slug` to courses and lessons; add
    `owner_type='global'` support and make `pinnedLinks.owner_id` nullable; add `source` to
    enrollments; promote `courses.teacher_profile_id` to NOT NULL and drop `owner_teacher_id`.
    None of these belong in Phase 2.2.
