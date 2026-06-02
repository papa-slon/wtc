# ecosystem-education-implementer handoff

_Epoch 20260530-0925. Phase 2.1 — Full LMS contract specification (read-only audit wave).
No code edited. Per `docs/SESSION_PROTOCOL.md`: this wave specifies the exact TypeScript interface,
Zod schemas, view types, ownership guards, route trees, persistence rules, and test list for
implementation. The implementer session that follows reads this file as the canonical spec._

---

## Scope

Specify the full additive `LmsService` contract for Phase 2.1, building on the Phase 1.7 thin model
(4-method interface in `apps/web/src/lib/lms-types.ts`). Deliverables of this handoff:

1. Full `LmsService` TypeScript interface (additive, backward-compatible).
2. Zod schemas for all LMS domain objects (`packages/lms/src/schemas.ts`).
3. View types: `CourseAdminView`, `LessonStudentView`, `EnrollmentView`, `ProgressView`,
   `TeacherProfileView`, `MaterialView`, `PinnedLinkView`, `StudentProgressSummary`.
4. Ownership and entitlement guard specifications.
5. Route trees with landable/stub/target classification.
6. Progress and completion persistence rules.
7. LMS test matrix (5 mandatory cases).

---

## Files inspected

- `AGENTS.md` — agent roster, non-negotiable gates, conventions.
- `docs/handoffs/0000-orchestrator-seed.md` — stack, roles, product codes, hard rules.
- `docs/SESSION_PROTOCOL.md` — process governance.
- `docs/handoffs/20260530-0126-ecosystem-education-implementer.md` — Phase 2 Wave-1 design handoff
  (table DDL, repo signatures, route scope matrix — canonical source; this handoff extends it with
  the precise TypeScript + Zod code the implementer copies directly).
- `docs/EDUCATION_LMS_PLAN.md` (lines 1-1455) — full LMS spec: role matrix §2, entitlement
  integration §3, data shapes §4, service surface §5, route structure §6, progress §8, embed
  safety §9, audit events §12, security §17, Phase-2 design §21.
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md` — migration 0002 table specs, repo
  function signatures, backfill notes for `teacher_profiles`.
- `packages/lms/src/index.ts` — current thin `LmsService` class + `LmsStore` + `Actor`.
- `apps/web/src/lib/lms-types.ts` — thin 4-method async `LmsService` interface + `CourseView`,
  `LessonView`.
- `apps/web/src/lib/db-store.ts` — DB-backed adapter (imports 4 thin LMS repos from `@wtc/db`).
- `apps/web/src/lib/demo.ts` — in-memory adapter (wraps `LmsService` class from `@wtc/lms`).
- `apps/web/src/lib/backend.ts` — fail-closed selector; `deniedLmsService` stub; `backendMode`.
- `packages/db/src/repositories.ts` (lines 299-367) — 4 thin Education repos: `createCourse`,
  `listCoursesForTeacher`, `listPublishedCourses`, `listLessonsForStudent`; `CourseDTO`/`LessonDTO`.
- `apps/web/src/app/(app)/app/education/page.tsx` — student catalogue (thin; entitlement wall
  correctly shown; community links static placeholder).
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard (thin; `createCourse` + list).
- `apps/web/src/app/teacher/courses/page.tsx` — pure `Placeholder`, safe to fill.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — pure `Placeholder`, safe to fill.
- `apps/web/src/app/teacher/materials/page.tsx` — pure `Placeholder`, safe to fill.
- `apps/web/src/app/teacher/students/page.tsx` — pure `Placeholder`, safe to fill.
- `apps/web/src/app/admin/education/page.tsx` — pure `Placeholder`, safe to fill.

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. [INFO] Thin model ground truth confirmed exact

The Phase 1.7 thin contract is exactly as the previous handoff documented. `lms-types.ts` has 4
methods: `createCourse`, `listCoursesForTeacher`, `listPublishedCourses`, `listLessonsForStudent`.
`packages/lms/src/index.ts` is a synchronous in-memory class over `Map`s. The `db-store.ts`
adapter wraps the 4 thin repos from `@wtc/db`. The `demo.ts` adapter wraps the `LmsService` class.
`backend.ts` selects between them and has a `deniedLmsService` stub for production without
`DATABASE_URL`. All 4 teacher skeleton pages (`courses/`, `courses/[id]`, `materials/`, `students/`)
are pure `Placeholder` components with no imports — safe to replace in full.

### 2. [WARN] Column name mismatch between plan (§4) and thin DB schema must be tracked

`docs/EDUCATION_LMS_PLAN.md` §4.2 uses `is_published` and `teacher_profile_id` as column names
for the TARGET `courses` table. The thin migration 0000 uses `published` (not `is_published`) and
`owner_teacher_id` (not `teacher_profile_id`). Migration 0002 adds `teacher_profile_id` as a
nullable FK while keeping `published` and `owner_teacher_id` untouched.

The implementer must NOT rename these columns in 0002. Repos that read the thin rows must use
`published` (not `is_published`). New repos that join through `teacher_profile_id` use the new
column and may alias it as `isPublished` only in DTOs. Evidence: `packages/db/src/repositories.ts`
line 358 uses `eq(s.courses.published, true)`; `rowToCourseDto` line 326 maps `r.published`.

Recommendation: the DTO adapter layer (`rowToCourseDto` extensions) normalises column names.
The Zod schemas and view types in this handoff use the canonical plan names as DTO field names
(camelCase); the Drizzle column names stay snake_case exactly as in migration 0000.

### 3. [WARN] DB architect lesson_progress schema diverges from plan §4.6 — implementer must reconcile

The db-architect handoff (20260530-0126-ecosystem-db-architect.md) specifies `lesson_progress` with
columns: `percent_complete NUMERIC(5,2)`, `completed BOOLEAN`, `last_accessed_at`. The education
plan §4.6 specifies: `progress_pct INTEGER`, `state TEXT ('started'|'completed')`, `started_at`,
`completed_at`, `last_seen_at`. The two specs describe the same semantics but with different column
names and types.

Decision for the implementer: use the education plan §4.6 column names — `progress_pct`, `state`,
`started_at`, `completed_at`, `last_seen_at` — as these carry more information (explicit state
machine, completion timestamp) and are what the route layer and view types in this handoff target.
The db-architect spec's `percent_complete`/`completed`/`last_accessed_at` are compatible aliases;
the Drizzle schema.ts column definitions in `packages/db/src/schema.ts` must use the plan §4.6
names. This handoff uses those names in all Zod schemas and view types below.

Evidence: `docs/EDUCATION_LMS_PLAN.md` lines 285-298 (§4.6); db-architect handoff lines 367-383.

### 4. [WARN] enrollments schema: db-architect adds entitlement_id; plan does not — add it

The db-architect handoff adds `entitlement_id UUID REFERENCES entitlements.id` (nullable) to
`enrollments`. The education plan §4.5 does not include this column but does not prohibit it.
The implementer MUST include `entitlement_id` (nullable) as designed by the db-architect — it
enables linking enrollments to their triggering entitlement without adding new logic to the
entitlement package. The `EnrollmentView` DTO below omits it (never returned to teacher UI).

### 5. [INFO] pinned_links: db-architect owner_id is NOT NULL; plan has it as nullable for 'global'

`docs/EDUCATION_LMS_PLAN.md` §4.7 specifies `owner_id uuid` as nullable (NULL for `owner_type='global'`).
The db-architect handoff line 395 marks it NOT NULL. The education plan wins: `owner_id` must be
NULLABLE for global links. The implementer writes the Drizzle column as nullable and adds a CHECK
constraint: if `owner_type='global'` then `owner_id IS NULL`.

### 6. [INFO] community links static placeholder — confirmed unfilled

`apps/web/src/app/(app)/app/education/page.tsx` lines 51-57 has a static "Community" card with
dim placeholder spans. This is the correct location for the Wave-2 `listPinnedLinks({ownerType:'global'})`
server call. The implementer fills this once migration 0002 + `pinned_links` repo lands.

### 7. [INFO] backend.ts deniedLmsService stub covers only 4 thin methods — must be extended

`apps/web/src/lib/backend.ts` lines 66-71: `deniedLmsService` implements only the 4 thin methods.
When the `LmsService` interface grows to ~22 methods, `deniedLmsService` must grow in parallel or
the TypeScript compile will fail. The implementer extends `deniedLmsService` with every new method
throwing `DENIED_MSG`. This is a required mechanical change; a missing method is a typecheck error.

### 8. [INFO] demo.ts in-memory adapter: LmsService class wraps only the 4 thin methods

`apps/web/src/lib/demo.ts` lines 112-138: the `lmsService` adapter wraps `LmsClass` (the thin
synchronous class from `packages/lms`). The full refactor moves `packages/lms` to a `service/` +
`guards/` structure (async, DB-injectable). The `demo.ts` in-memory adapter must match every new
method with an in-memory implementation. The label "storage: in-memory (demo)" at `education/page.tsx`
line 31 is the correct visible label and must be preserved.

---

## Decisions

### D1. LmsService interface strategy: additive extension in lms-types.ts

The existing 4 thin methods in `apps/web/src/lib/lms-types.ts` are kept verbatim. The interface
gains ~18 new methods. Both the DB adapter (`db-store.ts`) and the in-memory adapter (`demo.ts`)
implement every method. TypeScript enforces completeness at compile time.

### D2. packages/lms refactor: service/ + guards/ + schemas.ts + errors.ts

The current single-file `packages/lms/src/index.ts` (synchronous `LmsService` class over Maps) is
replaced with the modular structure from the plan §5.1. The barrel `index.ts` re-exports everything.
The existing `Course`, `Lesson`, `Material`, `LessonProgress`, `Actor`, `LmsStore`,
`createMemoryLmsStore`, `LmsService` class exports must remain available from the barrel for
backward compat with `demo.ts` during the transition, or `demo.ts` is updated simultaneously.

### D3. Ownership guard: assertTeacherOwns is server-side, inside every service method

Every teacher-facing mutation calls `assertTeacherOwns(teacherProfileId, courseOrLessonId, db)`
from `packages/lms/src/guards/ownership.ts` BEFORE any write. Admin bypass: the guard function
receives `isAdmin: boolean`; if true, the ownership check is skipped but the audit row is still
written with `actorRole: 'admin'`. There is no "skip audit" flag.

### D4. Entitlement guard: assertEducationAccess is fail-closed, no redirect

`assertEducationAccess(userId, productCode, entitlements)` in `packages/lms/src/guards/entitlement.ts`
calls `entitlements.hasAccess(userId, productCode)`. On failure it throws `EntitlementDenied`.
The route handler catches `EntitlementDenied` and returns an empty result or 403 — never a redirect
to `/app/billing` (redirect loops are prohibited). The entitlement wall is rendered server-side
by the route checking the error type and returning appropriate JSX.

### D5. upsertProgress: no audit per call; markEnrollmentComplete is audited

`upsertLessonProgress` is called on every video timeupdate (debounced 10s client, 8s server guard).
Per-call auditing would produce thousands of rows and is explicitly prohibited by the plan §4.6.
`markEnrollmentComplete` (triggered when all published lessons have `state='completed'`) writes ONE
`education.course.completed` audit row in the same transaction as the `enrollments.completed_at`
update. `markLessonComplete` (explicit student action) writes no audit row — only the course
completion does.

### D6. courses.teacher_profile_id stays nullable in migration 0002

Migration 0002 adds `teacher_profile_id uuid REFERENCES teacher_profiles(id)` as NULLABLE on
`courses`. Existing rows are backfilled via the migration's PL/pgSQL block. New repos in Wave-2
use `teacher_profile_id`; the thin repos continue to use `owner_teacher_id`. A future migration
(0003) adds NOT NULL + drops `owner_teacher_id`. The implementer must NEVER reference
`owner_teacher_id` in new repo functions.

### D7. Material file upload: metadata stub only in Phase 2.1

`createMaterial` with `materialType='file'` writes the metadata columns (`file_key`, `file_name`,
`file_size_bytes`, `mime_type`) to the DB. The `file_key` is a stub string provided by the route
handler (`'dev-stub/' + crypto.randomUUID()`). No bytes are stored. `getMaterialDownloadUrl`
returns `{ signedUrl: 'https://placeholder.wtc.local/download-unavailable', expiresAt: new Date(Date.now() + 60_000) }`.
This stub is never exposed as production-ready; the route handler response includes
`x-wtc-stub: material-download-unavailable` header.

---

## Full LmsService contract

### Zod schemas (packages/lms/src/schemas.ts)

```typescript
// packages/lms/src/schemas.ts
import { z } from 'zod';

// ---- Shared primitives ----
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'URL must start with https://',
});

const productCodeEnum = z.enum([
  'tortila_bot',
  'legacy_bot',
  'axioma_terminal',
  'tradingview_indicators',
  'education',
  'club',
]);

// ---- Teacher profiles ----
export const SocialLinksSchema = z.object({
  telegram:  httpsUrl.optional(),
  instagram: httpsUrl.optional(),
  youtube:   httpsUrl.optional(),
  twitter:   httpsUrl.optional(),
  website:   httpsUrl.optional(),
}).strict();

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

// ---- Courses ----
const slugRegex = /^[a-z0-9-]+$/;

export const CreateCourseSchema = z.object({
  title:        z.string().min(3).max(200),
  slug:         z.string().regex(slugRegex, 'slug must be lowercase alphanumeric with hyphens').min(3).max(120),
  description:  z.string().max(2000).optional(),
  thumbnailUrl: httpsUrl.optional(),
  productCode:  productCodeEnum.optional(),
  level:        z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  tags:         z.array(z.string().max(40)).max(10).default([]),
});

export const UpdateCourseSchema = z.object({
  title:        z.string().min(3).max(200).optional(),
  slug:         z.string().regex(slugRegex).min(3).max(120).optional(),
  description:  z.string().max(2000).optional(),
  thumbnailUrl: httpsUrl.optional(),
  productCode:  productCodeEnum.optional(),
  level:        z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tags:         z.array(z.string().max(40)).max(10).optional(),
  sortOrder:    z.number().int().min(0).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'patch must have at least one field' });

// ---- Lessons ----
export const CreateLessonSchema = z.object({
  title:       z.string().min(3).max(300),
  slug:        z.string().regex(slugRegex).min(3).max(120),
  description: z.string().max(1000).optional(),
  contentType: z.enum(['video', 'embed', 'article', 'link']),
  videoUrl:    httpsUrl.optional(),
  // embedHtml is sanitized by service before write; raw input accepted here
  embedHtml:   z.string().max(5000).optional(),
  articleBody: z.string().max(100000).optional(),
  externalUrl: httpsUrl.optional(),
  durationSec: z.number().int().positive().optional(),
  isPreview:   z.boolean().default(false),
  sortOrder:   z.number().int().min(0).default(0),
});

export const UpdateLessonSchema = CreateLessonSchema
  .omit({ contentType: true, slug: true })
  .extend({
    slug:        z.string().regex(slugRegex).min(3).max(120).optional(),
    contentType: z.enum(['video', 'embed', 'article', 'link']).optional(),
    isPublished: z.boolean().optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'patch must have at least one field' });

export const ReorderLessonsSchema = z.object({
  courseId:         z.string().uuid(),
  orderedLessonIds: z.array(z.string().uuid()).min(1),
});

// ---- Materials ----
export const CreateMaterialSchema = z.discriminatedUnion('materialType', [
  z.object({
    materialType:  z.literal('file'),
    title:         z.string().min(1).max(200),
    fileKey:       z.string().min(1),        // stub string in dev; S3/R2 key in prod
    fileName:      z.string().min(1).max(500),
    fileSizeBytes: z.number().int().positive(),
    mimeType:      z.string().min(1).max(200),
    sortOrder:     z.number().int().min(0).default(0),
  }),
  z.object({
    materialType: z.literal('link'),
    title:        z.string().min(1).max(200),
    externalUrl:  httpsUrl,
    sortOrder:    z.number().int().min(0).default(0),
  }),
]);

// ---- Enrollments ----
export const AdminCreateEnrollmentSchema = z.object({
  userId:   z.string().uuid(),
  courseId: z.string().uuid(),
});

// ---- Progress ----
export const UpsertProgressSchema = z.object({
  lessonId:    z.string().uuid(),
  courseId:    z.string().uuid(),
  progressPct: z.number().int().min(0).max(100),
});

export const MarkCompleteSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
});

// ---- Pinned links ----
export const CreatePinnedLinkSchema = z.object({
  ownerType: z.enum(['teacher_profile', 'course', 'global']),
  ownerId:   z.string().uuid().optional(),   // required unless ownerType='global'
  label:     z.string().min(1).max(100),
  url:       httpsUrl,
  iconType:  z.enum(['telegram', 'instagram', 'youtube', 'discord', 'link']).default('link'),
  sortOrder: z.number().int().min(0).default(0),
}).refine(
  (v) => v.ownerType === 'global' ? !v.ownerId : !!v.ownerId,
  { message: 'ownerId required for non-global links; omit for global' },
);

// ---- Actor ----
export const LmsActorSchema = z.object({
  userId:  z.string().uuid(),
  isAdmin: z.boolean(),
});
```

### View types (apps/web/src/features/lms/types.ts and packages/lms/src/types.ts)

The types below are derived from the domain; they are what routes return to the UI.
`packages/lms/src/types.ts` holds the DTO types (no UI dependencies). Routes in
`apps/web/src/features/lms/` import from there; no types defined in React files.

```typescript
// packages/lms/src/types.ts

export type ContentType = 'video' | 'embed' | 'article' | 'link';
export type LessonState = 'started' | 'completed';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type PinnedLinkOwnerType = 'teacher_profile' | 'course' | 'global';
export type IconType = 'telegram' | 'instagram' | 'youtube' | 'discord' | 'link';

// ---- Teacher profile ----
export interface TeacherProfileView {
  id:          string;
  userId:      string;
  displayName: string;
  bio?:        string;
  avatarUrl?:  string;
  socialLinks: {
    telegram?:  string;
    instagram?: string;
    youtube?:   string;
    twitter?:   string;
    website?:   string;
  };
  isActive:  boolean;
  createdAt: number;  // epoch-ms
  updatedAt: number;
}

// ---- Courses ----

/** Admin/teacher view: all fields including draft state. */
export interface CourseAdminView {
  id:               string;
  teacherProfileId: string;
  // ownerTeacherId retained for backward compat during 0002 transition; nullable after backfill
  ownerTeacherId:   string;
  title:            string;
  slug:             string;
  description?:     string;
  thumbnailUrl?:    string;
  productCode?:     string;
  level:            CourseLevel;
  tags:             string[];
  isPublished:      boolean;  // mapped from courses.published column
  isFeatured:       boolean;
  sortOrder:        number;
  lessonCount:      number;   // COUNT(lessons WHERE is_published=true) — computed at query
  enrolledCount:    number;   // COUNT(DISTINCT enrollments.user_id) — computed at query
  createdAt:        number;
  updatedAt:        number;
}

/** Public preview: visible to unenttled students (no lesson data). */
export interface CourseCardView {
  id:           string;
  title:        string;
  slug:         string;
  description?: string;
  thumbnailUrl?: string;
  level:        CourseLevel;
  tags:         string[];
  isFeatured:   boolean;
  teacherName:  string;   // teacher_profiles.display_name
  lessonCount:  number;   // published lesson count
}

// ---- Lessons ----

/** Student-facing lesson view: never leaks draft content or file_key. */
export interface LessonStudentView {
  id:          string;
  courseId:    string;
  title:       string;
  slug:        string;
  description?: string;
  contentType: ContentType;
  videoUrl?:   string;
  // embed_html is the already-sanitized value stored in DB; safe to render
  embedHtml?:  string;
  articleBody?: string;
  externalUrl?: string;
  durationSec?: number;
  isPreview:   boolean;
  sortOrder:   number;
  materials:   MaterialView[];
  // Student's progress for this lesson (null if not started)
  progress?:   ProgressView;
}

/** Teacher/admin lesson view: all fields. */
export interface LessonAdminView extends LessonStudentView {
  isPublished: boolean;
  createdAt:   number;
  updatedAt:   number;
}

// ---- Materials ----

/** Never includes file_key. Download goes through /api/education/materials/[id]/download. */
export interface MaterialView {
  id:            string;
  lessonId:      string;
  title:         string;
  materialType:  'file' | 'link';
  fileName?:     string;
  fileSizeBytes?: number;
  mimeType?:     string;
  externalUrl?:  string;
  sortOrder:     number;
}

// ---- Enrollments ----

export interface EnrollmentView {
  id:          string;
  userId:      string;
  courseId:    string;
  enrolledAt:  number;
  completedAt?: number;
  source:      'entitlement' | 'manual_admin';
}

// ---- Progress ----

export interface ProgressView {
  id:          string;
  userId:      string;
  lessonId:    string;
  courseId:    string;
  state:       LessonState;
  progressPct: number;
  startedAt:   number;
  completedAt?: number;
  lastSeenAt:  number;
}

export interface CourseProgressSummary {
  courseId:        string;
  totalLessons:    number;
  completedLessons: number;
  progressPct:     number;   // 0-100 overall
  completedAt?:    number;   // from enrollments.completed_at
}

// ---- Student list (teacher view) ----

/** Never includes email, raw user_id, or session data. */
export interface StudentProgressSummary {
  displayName:      string;
  enrolledAt:       number;
  completedLessons: number;
  totalLessons:     number;
  progressPct:      number;
  lastSeenAt?:      number;
}

// ---- Pinned links ----

export interface PinnedLinkView {
  id:        string;
  ownerType: PinnedLinkOwnerType;
  ownerId?:  string;
  label:     string;
  url:       string;
  iconType?: IconType;
  sortOrder: number;
  isActive:  boolean;
}
```

### Full LmsService interface (apps/web/src/lib/lms-types.ts — replacement)

```typescript
// apps/web/src/lib/lms-types.ts
/**
 * Async LMS service — the app-layer interface the teacher/education/admin pages call.
 * Both the DB-backed adapter (lib/db-store.ts) and the in-memory dev adapter (lib/demo.ts)
 * implement it; lib/backend.ts selects between them (fail-closed in production without
 * DATABASE_URL).
 *
 * ADDITIVE on the Phase 1.7 thin model (the first 4 methods below are unchanged).
 * Every new method must also appear in:
 *   - db-store.ts (DB adapter)
 *   - demo.ts (in-memory adapter, labeled "storage: in-memory (demo)")
 *   - backend.ts deniedLmsService stub (throws DENIED_MSG)
 *
 * Ownership rules (enforced in packages/lms service methods, NOT here):
 *   - Teacher mutations: assertTeacherOwns(teacherProfileId, targetId, isAdmin)
 *   - Student access: assertEducationAccess(userId, productCode, entitlements)
 */
import type {
  CourseAdminView,
  CourseCardView,
  LessonStudentView,
  LessonAdminView,
  MaterialView,
  EnrollmentView,
  ProgressView,
  CourseProgressSummary,
  StudentProgressSummary,
  TeacherProfileView,
  PinnedLinkView,
} from '@wtc/lms';
// The thin DTOs remain for backward compat at existing call sites
import type { CourseDTO as CourseView, LessonDTO as LessonView } from '@wtc/db';

export type { CourseView, LessonView };

export interface LmsActor {
  userId:  string;
  isAdmin: boolean;
}

export interface LmsService {
  // ---- THIN model (Phase 1.7 — unchanged signatures) ----
  createCourse(actor: LmsActor, input: { title: string; description?: string; published?: boolean }, now: number): Promise<CourseView>;
  listCoursesForTeacher(actor: LmsActor): Promise<CourseView[]>;
  listPublishedCourses(): Promise<CourseView[]>;
  /** Fail-closed: returns [] without education access or for an unpublished course. */
  listLessonsForStudent(courseId: string, hasEducationAccess: boolean): Promise<LessonView[]>;

  // ---- Teacher profiles ----
  /** Admin only: create a teacher profile for a user. */
  createTeacherProfile(
    adminUserId: string,
    input: { userId: string; displayName: string; bio?: string; avatarUrl?: string; socialLinks?: Record<string, string> },
  ): Promise<TeacherProfileView>;
  getTeacherProfileByUserId(userId: string): Promise<TeacherProfileView | null>;
  /** Admin or self (profile.userId === actorUserId). */
  updateTeacherProfile(
    actorUserId: string,
    isAdmin: boolean,
    teacherProfileId: string,
    patch: Partial<{ displayName: string; bio: string; avatarUrl: string; socialLinks: Record<string, string> }>,
  ): Promise<TeacherProfileView>;
  /** Admin only: activate or deactivate a teacher profile. */
  setTeacherProfileActive(adminUserId: string, teacherProfileId: string, isActive: boolean): Promise<void>;

  // ---- Course CRUD (full) ----
  /** Returns the full admin view including computed lessonCount and enrolledCount. */
  listCoursesForTeacherFull(actor: LmsActor): Promise<CourseAdminView[]>;
  getCourseForAdmin(actor: LmsActor, courseId: string): Promise<CourseAdminView>;
  updateCourse(
    actorUserId: string,
    isAdmin: boolean,
    courseId: string,
    patch: Partial<{ title: string; slug: string; description: string; thumbnailUrl: string; productCode: string; level: string; tags: string[]; sortOrder: number }>,
  ): Promise<CourseAdminView>;
  publishCourse(actorUserId: string, isAdmin: boolean, courseId: string): Promise<void>;
  unpublishCourse(actorUserId: string, isAdmin: boolean, courseId: string): Promise<void>;
  /** Admin only: set is_featured flag. */
  setCourseFeatured(adminUserId: string, courseId: string, isFeatured: boolean): Promise<void>;
  /**
   * Blocks if enrollments.count > 0 (throws LmsConflict with enrolled count).
   * Admin can override with isAdmin=true — still audited.
   */
  deleteCourse(actorUserId: string, isAdmin: boolean, courseId: string): Promise<void>;

  // ---- Lesson CRUD ----
  createLesson(
    actorUserId: string,
    isAdmin: boolean,
    courseId: string,
    input: {
      title: string; slug: string; description?: string; contentType: 'video' | 'embed' | 'article' | 'link';
      videoUrl?: string; embedHtml?: string; articleBody?: string; externalUrl?: string;
      durationSec?: number; isPreview?: boolean; sortOrder?: number;
    },
  ): Promise<LessonAdminView>;
  updateLesson(
    actorUserId: string,
    isAdmin: boolean,
    lessonId: string,
    patch: Partial<{ title: string; slug: string; description: string; contentType: string; videoUrl: string; embedHtml: string; articleBody: string; externalUrl: string; durationSec: number; isPreview: boolean; isPublished: boolean; sortOrder: number }>,
  ): Promise<LessonAdminView>;
  deleteLesson(actorUserId: string, isAdmin: boolean, lessonId: string): Promise<void>;
  reorderLessons(actorUserId: string, isAdmin: boolean, courseId: string, orderedLessonIds: string[]): Promise<void>;
  /**
   * Student-facing lesson fetch.
   * Caller (route) must check entitlement BEFORE calling this.
   * Returns null (never 403) if lesson/course not found or not published.
   * Writes education.lesson.view audit row.
   */
  getLessonForStudent(userId: string, lessonId: string): Promise<LessonStudentView | null>;
  getLessonForTeacher(actorUserId: string, isAdmin: boolean, lessonId: string): Promise<LessonAdminView | null>;

  // ---- Materials ----
  createMaterial(
    actorUserId: string,
    isAdmin: boolean,
    lessonId: string,
    input: (
      | { materialType: 'file'; title: string; fileKey: string; fileName: string; fileSizeBytes: number; mimeType: string; sortOrder?: number }
      | { materialType: 'link'; title: string; externalUrl: string; sortOrder?: number }
    ),
  ): Promise<MaterialView>;
  deleteMaterial(actorUserId: string, isAdmin: boolean, materialId: string): Promise<void>;
  /**
   * DEV-STUB: returns placeholder URL until Phase 4 real storage.
   * Never returns file_key. Writes education.material.downloaded audit row.
   */
  getMaterialDownloadUrl(userId: string, materialId: string): Promise<{ signedUrl: string; expiresAt: Date }>;

  // ---- Enrollments ----
  /**
   * Idempotent upsert ON CONFLICT DO NOTHING. source='entitlement'.
   * Called when student opens a published course page; no audit row.
   */
  ensureEnrolled(userId: string, courseId: string): Promise<EnrollmentView>;
  /** source='manual_admin'; writes education.enrollment.created audit row. */
  adminCreateEnrollment(adminUserId: string, userId: string, courseId: string): Promise<EnrollmentView>;
  /**
   * Teacher or admin. Returns displayName + progress metrics only.
   * Never returns email, raw userId, or session data.
   */
  getCourseStudentList(actorUserId: string, isAdmin: boolean, courseId: string): Promise<StudentProgressSummary[]>;

  // ---- Progress ----
  /**
   * Debounced UPSERT.
   * Server-side guard: no-op if existing.last_seen_at > NOW() - 8 seconds.
   * Auto-transitions state to 'completed' when progressPct >= 95.
   * On state → 'completed': calls checkCourseCompletion in same txn.
   * No per-call audit row.
   */
  upsertProgress(userId: string, lessonId: string, courseId: string, progressPct: number): Promise<ProgressView>;
  /**
   * Explicit "Mark complete" action (article/link lessons).
   * Sets state='completed', progress_pct=100.
   * Calls checkCourseCompletion in same txn.
   */
  markLessonComplete(userId: string, lessonId: string, courseId: string): Promise<ProgressView>;
  getCourseProgress(userId: string, courseId: string): Promise<CourseProgressSummary>;

  // ---- Pinned links ----
  listPinnedLinks(ownerType: 'teacher_profile' | 'course' | 'global', ownerId?: string): Promise<PinnedLinkView[]>;
  createPinnedLink(
    actorUserId: string,
    isAdmin: boolean,
    input: { ownerType: 'teacher_profile' | 'course' | 'global'; ownerId?: string; label: string; url: string; iconType?: string; sortOrder?: number },
  ): Promise<PinnedLinkView>;
  /** Soft-delete: sets is_active=false. Writes education.pinned_link.deleted audit row. */
  deletePinnedLink(actorUserId: string, isAdmin: boolean, linkId: string): Promise<void>;
}
```

---

## Ownership and entitlement guards

### Guard: assertTeacherOwns (packages/lms/src/guards/ownership.ts)

```typescript
// packages/lms/src/guards/ownership.ts
import { OwnershipDenied } from '../errors.ts';

/**
 * Verifies that the actor (by teacherProfileId) owns the given course.
 * Admin bypass: isAdmin=true skips the check but does NOT skip audit.
 *
 * Implementation note (DB adapter):
 *   SELECT teacher_profile_id FROM courses WHERE id = $courseId LIMIT 1
 *   if row.teacher_profile_id !== teacherProfileId → throw OwnershipDenied
 *
 * For lesson-level checks, load the lesson's course_id first, then call this.
 */
export async function assertTeacherOwns(
  teacherProfileId: string,
  courseId: string,
  isAdmin: boolean,
  fetchCourseOwner: (courseId: string) => Promise<string | null>,
): Promise<void> {
  if (isAdmin) return;
  const owner = await fetchCourseOwner(courseId);
  if (owner !== teacherProfileId) {
    throw new OwnershipDenied(`Teacher ${teacherProfileId} does not own course ${courseId}`);
  }
}
```

Guard call sites:
- `updateCourse`, `publishCourse`, `unpublishCourse`, `deleteCourse` — pass `course.teacher_profile_id`
- `createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons` — load `lesson.course_id`, then assert
- `createMaterial`, `deleteMaterial` — load `material.lesson.course_id`, then assert
- `getCourseStudentList` — assert before returning student data
- `createPinnedLink` with `ownerType='teacher_profile'` — assert `teacherProfile.user_id === actorUserId`
- `createPinnedLink` with `ownerType='course'` — assert teacher owns course
- `createPinnedLink` with `ownerType='global'` — admin only (isAdmin required, not teacher)

### Guard: assertEducationAccess (packages/lms/src/guards/entitlement.ts)

```typescript
// packages/lms/src/guards/entitlement.ts
import { EntitlementDenied } from '../errors.ts';
import type { HasAccessFn } from '@wtc/entitlements';

/**
 * Fail-closed entitlement check for education content.
 * productCode: the course's product_code, or 'education' if null.
 *
 * On failure: throws EntitlementDenied (route catches → 403 JSON, never redirect).
 * On unknown state: throws EntitlementDenied (fail-closed — unknown = denied).
 */
export async function assertEducationAccess(
  userId: string,
  productCode: string,
  hasAccess: HasAccessFn,
): Promise<void> {
  const result = await hasAccess(userId, productCode);
  if (!result.allowed) {
    throw new EntitlementDenied(`User ${userId} denied: ${result.reason}`);
  }
}
```

Guard call sites:
- Route handler for `GET /app/education/[courseSlug]` — checks BEFORE rendering course page
- Route handler for `GET /app/education/[courseSlug]/[lessonSlug]` — checks BEFORE rendering lesson
- `getMaterialDownloadUrl` — checks inside service method before generating URL
- API route `POST /api/education/progress` — checks before calling `upsertProgress`
- API route `POST /api/education/progress/complete` — checks before calling `markLessonComplete`

Student catalogue `listPublishedCourses` does NOT require entitlement — returns public previews.
The route layer applies entitlement to decide which cards get the "Continue" CTA vs "Upgrade" wall.

### Error mapping (packages/lms/src/errors.ts)

```typescript
// packages/lms/src/errors.ts
export class LmsError extends Error {
  constructor(msg: string) { super(msg); this.name = 'LmsError'; }
}
export class EntitlementDenied extends LmsError {
  readonly code = 'ENTITLEMENT_DENIED' as const;
}
export class OwnershipDenied extends LmsError {
  readonly code = 'OWNERSHIP_DENIED' as const;
}
export class LmsNotFound extends LmsError {
  readonly code = 'NOT_FOUND' as const;
}
export class LmsConflict extends LmsError {
  readonly code = 'CONFLICT' as const;
  readonly detail?: unknown;
  constructor(msg: string, detail?: unknown) { super(msg); this.detail = detail; }
}
```

Route handler HTTP mapping:
- `EntitlementDenied` → 403 JSON `{ error: 'ENTITLEMENT_DENIED', reason: e.message }`
- `OwnershipDenied` → 403 JSON `{ error: 'OWNERSHIP_DENIED' }`
- `LmsNotFound` → 404 JSON `{ error: 'NOT_FOUND' }`
- `LmsConflict` → 409 JSON `{ error: 'CONFLICT', detail: e.detail }`

---

## Route trees

### Student routes (apps/web/src/app/(app)/app/education/)

| Route | Status | Data calls | Notes |
|---|---|---|---|
| `page.tsx` | REAL (thin) — extend | `listPublishedCourses`, `listPinnedLinks({ownerType:'global'})` | Add pinned links sidebar, progress rings per course, slug-based CTA links |
| `[courseSlug]/page.tsx` | NEW | `getCourseForAdmin` or course query by slug, `ensureEnrolled`, `getCourseProgress` | Shows lesson list with checkmarks; asserts entitlement in route; server component |
| `[courseSlug]/[lessonSlug]/page.tsx` | NEW | `getLessonForStudent`, `getCourseProgress` | Asserts entitlement; renders by contentType; materials list; progress island |

Client islands (inside `apps/web/src/features/lms/`):
- `ProgressTracker.tsx` — video timeupdate → `POST /api/education/progress` (debounced 10s)
- `MarkCompleteButton.tsx` — click → `POST /api/education/progress/complete`
- Both islands read `backendMode` label from a server-provided prop; never show backend mode in DOM

### API routes (apps/web/src/app/api/education/)

| Route | Method | Handler calls | Guard |
|---|---|---|---|
| `progress/route.ts` | POST | `lmsService.upsertProgress` | `assertEducationAccess`; rate limit 6/min/user/lesson |
| `progress/complete/route.ts` | POST | `lmsService.markLessonComplete` | `assertEducationAccess` |
| `materials/[materialId]/download/route.ts` | GET | `lmsService.getMaterialDownloadUrl` | `assertEducationAccess`; 302 to signedUrl |

### Teacher routes (apps/web/src/app/teacher/)

| Route | Status | Data calls | Notes |
|---|---|---|---|
| `page.tsx` | REAL (thin) — extend | keep thin + `getTeacherProfileByUserId` | Add profile summary, aggregate stat cards |
| `courses/page.tsx` | Placeholder — FILL | `listCoursesForTeacherFull` | lesson count, enrolled count, publish toggle |
| `courses/new/page.tsx` | NEW | `createCourse` (full input) | slug, level, tags, thumbnail, productCode |
| `courses/[id]/page.tsx` | Placeholder — FILL | `getCourseForAdmin`, `updateCourse`, `publishCourse`, `unpublishCourse` | lesson list + reorder |
| `courses/[id]/lessons/new/page.tsx` | NEW | `createLesson` | contentType selector, all fields |
| `courses/[id]/lessons/[lessonId]/page.tsx` | NEW | `getLessonForTeacher`, `updateLesson` | embed preview, is_preview toggle |
| `courses/[id]/lessons/[lessonId]/materials/page.tsx` | NEW | `createMaterial`, `deleteMaterial` | link add; file = metadata stub only |
| `students/page.tsx` | Placeholder — FILL | `getCourseStudentList` (all own courses) | displayName + progress metrics only |
| `community/page.tsx` | NEW | `updateTeacherProfile` (social_links), `listPinnedLinks`, `createPinnedLink`, `deletePinnedLink` | social profile form + pinned links manager |

All teacher routes: RBAC gate `user.roles.includes('teacher') || user.roles.includes('admin')` as
first check in the server component. Ownership is then enforced inside service method calls.

### Admin education routes (apps/web/src/app/admin/education/)

| Route | Status | Data calls | Notes |
|---|---|---|---|
| `page.tsx` | Placeholder — FILL | `listPublishedCourses`, `listCoursesForTeacherFull({isAdmin:true})` | Overview stats |
| `courses/page.tsx` | NEW | `listCoursesForTeacherFull({isAdmin:true})` | All courses, all states |
| `courses/[id]/page.tsx` | NEW | `getCourseForAdmin`, `updateCourse(isAdmin:true)`, `setCourseFeatured` | No owner filter |
| `teachers/page.tsx` | NEW | `listTeacherProfiles` (admin query — add to interface) | activate/deactivate |
| `teachers/[id]/page.tsx` | NEW | `updateTeacherProfile(isAdmin:true)`, `setTeacherProfileActive` | profile edit |
| `enrollments/page.tsx` | NEW | `adminCreateEnrollment` | manual enrollment form |
| `audit/page.tsx` | NEW | `recentAuditEvents` filtered by `action LIKE 'education.%'` | read from `backend.ts` |

All admin routes: RBAC gate `user.roles.includes('admin')`.

### In-memory demo labeling

Every page that uses `lmsService` from `backend.ts` must show the storage mode pill when NOT
Postgres, using the existing pattern from `education/page.tsx`:
- `backendMode === 'postgres'` → `<StatusPill tone="ok">storage: Postgres</StatusPill>`
- else → `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` + explanatory span

This is not optional — the hard rule "mock/demo data labeled" applies to every education page.

---

## Progress and completion persistence

### upsertLessonProgress: no audit, debounced, high-frequency safe

```
Route: POST /api/education/progress
Body validated with UpsertProgressSchema (lessonId, courseId, progressPct)
Entitlement check: assertEducationAccess(userId, course.product_code ?? 'education')
Rate limit: 6 requests / minute / user / lesson (packages/auth middleware)

Service method: lmsService.upsertProgress(userId, lessonId, courseId, progressPct)
  DB repo: INSERT INTO lesson_progress ... ON CONFLICT (user_id, lesson_id) DO UPDATE
           SET progress_pct = EXCLUDED.progress_pct, last_seen_at = NOW()
  Server debounce: SELECT last_seen_at; if NOW() - last_seen_at < 8s → return existing row unchanged
  Auto-complete: if progressPct >= 95 AND existing.state != 'completed'
    → UPDATE state='completed', completed_at=NOW() in same statement
    → call checkCourseCompletion(tx, userId, courseId) in same txn
  No audit_logs insert per call (too frequent).
```

### markEnrollmentComplete: audited, called inside checkCourseCompletion

```
checkCourseCompletion(tx, userId, courseId):  [called WITHIN an existing txn — never starts its own]
  1. SELECT COUNT(*) FROM lessons WHERE course_id=$courseId AND published=true
  2. SELECT COUNT(*) FROM lesson_progress WHERE user_id=$userId AND course_id=$courseId AND state='completed'
  3. If completedCount == publishedCount AND completedCount > 0:
       a. UPDATE enrollments SET completed_at=NOW() WHERE user_id=$userId AND course_id=$courseId
          ON CONFLICT DO NOTHING (in case already set)
       b. SELECT id FROM enrollments WHERE user_id=$userId AND course_id=$courseId LIMIT 1
       c. INSERT INTO audit_logs: { action:'education.course.completed', actorUserId:userId,
            actorRole:'user', targetType:'enrollment', targetId:enrollment.id,
            after:{ courseId, context:'education' } }
  4. Return (no throw; idempotent if already completed)
```

### markLessonComplete: explicit student action

```
Route: POST /api/education/progress/complete
Body validated with MarkCompleteSchema (lessonId, courseId)
Entitlement check: assertEducationAccess
Service method: lmsService.markLessonComplete(userId, lessonId, courseId)
  DB repo: INSERT INTO lesson_progress (user_id, lesson_id, course_id, state, progress_pct, completed_at)
           VALUES (..., 'completed', 100, NOW())
           ON CONFLICT (user_id, lesson_id) DO UPDATE
           SET state='completed', progress_pct=100, completed_at=COALESCE(lesson_progress.completed_at, NOW()),
               last_seen_at=NOW()
  Then: call checkCourseCompletion(tx, userId, courseId)
  No per-call audit row for markLessonComplete itself.
```

### teacher_profiles backfill awareness

The implementer must NOT reference `courses.owner_teacher_id` in any new repo function written for
Wave-2. The migration 0002 SQL runs this backfill pattern before adding `teacher_profile_id`:

```sql
-- 1. Create teacher_profiles for existing course owners (before FK column exists)
INSERT INTO teacher_profiles (user_id, display_name, created_at, updated_at)
SELECT DISTINCT c.owner_teacher_id, COALESCE(u.display_name, u.email), NOW(), NOW()
FROM courses c
JOIN users u ON u.id = c.owner_teacher_id
ON CONFLICT (user_id) DO NOTHING;

-- 2. Add the nullable FK column
ALTER TABLE courses ADD COLUMN teacher_profile_id UUID REFERENCES teacher_profiles(id);

-- 3. Backfill the new column from the profile rows
UPDATE courses c
SET teacher_profile_id = tp.id
FROM teacher_profiles tp
WHERE tp.user_id = c.owner_teacher_id;

-- owner_teacher_id is NOT DROPPED in 0002 (additive only; drop in future migration 0003)
```

New repos read `teacher_profile_id`. If `teacher_profile_id IS NULL` for a row, the repo returns
a `LmsNotFound` — this is a data quality gap, not a code bug. It should not occur post-backfill.

---

## Verification/tests

The implementer must write these 5 tests (plus the broader PGlite suite from the prior handoff)
using the PGlite pattern established in `tests/integration/db-persistence.test.ts`.

### Test 1: Ownership — teacher A cannot edit teacher B's course

```
Setup:
  teacherA_profile = createTeacherProfile({ userId: userA.id, displayName: 'Teacher A' })
  teacherB_profile = createTeacherProfile({ userId: userB.id, displayName: 'Teacher B' })
  courseB = createCourse via thin repo with ownerTeacherId=userB.id; backfill teacher_profile_id=teacherB_profile.id

Test:
  result = updateCourse(actorUserId=userA.id, isAdmin=false, courseId=courseB.id, { title: 'Hacked' })
  expect(result).rejects.toThrow(OwnershipDenied)

Admin bypass:
  result = updateCourse(actorUserId=userA.id, isAdmin=true, courseId=courseB.id, { title: 'Admin edit' })
  expect(result).resolves.toMatchObject({ title: 'Admin edit' })
  // audit_logs must contain action='education.course.updated' with actorUserId=userA.id
```

### Test 2: Entitlement fail-closed — no 'education' entitlement returns empty

```
Setup:
  user = create user with NO entitlements
  course = published course (is_published=true via thin column)
  lesson = published lesson

Test (service layer, not route layer):
  // The route calls assertEducationAccess before getLessonForStudent
  access = await hasAccess(user.id, 'education')  // from packages/entitlements
  expect(access.allowed).toBe(false)

  // Service method: listLessonsForStudent (thin) with hasEducationAccess=false
  lessons = await lmsService.listLessonsForStudent(course.id, false)
  expect(lessons).toEqual([])

  // Full stack: getLessonForStudent should not be called without entitlement check;
  // test that the guard throws
  await expect(assertEducationAccess(user.id, 'education', hasAccess)).rejects.toThrow(EntitlementDenied)
```

### Test 3: Enrollment idempotency — ON CONFLICT DO NOTHING

```
Setup:
  user, course (both created)

Test:
  enroll1 = await lmsService.ensureEnrolled(user.id, course.id)
  enroll2 = await lmsService.ensureEnrolled(user.id, course.id)
  expect(enroll1.id).toBe(enroll2.id)

  // Verify only one row in enrollments table
  rows = await db.select().from(enrollments).where(and(eq(...user_id), eq(...course_id)))
  expect(rows).toHaveLength(1)
```

### Test 4: Per-user progress isolation — user A's progress invisible to user B

```
Setup:
  userA, userB (different users)
  course, lesson (published)
  // userA makes progress
  await lmsService.upsertProgress(userA.id, lesson.id, course.id, 50)

Test:
  progressA = await lmsService.getCourseProgress(userA.id, course.id)
  expect(progressA.completedLessons).toBe(0)
  expect(progressA.progressPct).toBeGreaterThan(0)

  progressB = await lmsService.getCourseProgress(userB.id, course.id)
  expect(progressB.completedLessons).toBe(0)
  expect(progressB.progressPct).toBe(0)

  // DB-level: lesson_progress for userA not visible to userB query
  rowsB = await db.select().from(lesson_progress).where(eq(lesson_progress.user_id, userB.id))
  expect(rowsB).toHaveLength(0)
```

### Test 5: markLessonComplete sets completed_at and triggers markEnrollmentComplete

```
Setup:
  user, course (published), lesson (published)
  await lmsService.ensureEnrolled(user.id, course.id)

Test A: markLessonComplete sets completed_at on lesson_progress
  result = await lmsService.markLessonComplete(user.id, lesson.id, course.id)
  expect(result.state).toBe('completed')
  expect(result.completedAt).toBeDefined()
  expect(result.progressPct).toBe(100)

Test B: checkCourseCompletion runs — enrollments.completed_at is set
  // Since lesson is the only published lesson, course should be marked complete
  enrollment = await db.select().from(enrollments)
    .where(and(eq(enrollments.user_id, user.id), eq(enrollments.course_id, course.id)))
    .limit(1)
  expect(enrollment[0].completed_at).toBeDefined()

Test C: audit_logs contains education.course.completed
  logs = await db.select().from(audit_logs).where(eq(audit_logs.action, 'education.course.completed'))
  expect(logs).toHaveLength(1)
  expect(logs[0].actor_user_id).toBe(user.id)
```

### Additional mandatory test: upsertProgress auto-complete at 95%

```
Setup: user, course, lesson; ensureEnrolled

Test:
  result = await lmsService.upsertProgress(user.id, lesson.id, course.id, 95)
  expect(result.state).toBe('completed')
  expect(result.completedAt).toBeDefined()

  // idempotent at 100%
  result2 = await lmsService.upsertProgress(user.id, lesson.id, course.id, 100)
  expect(result2.completedAt).toEqual(result.completedAt)  // not reset
```

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `lesson_progress` column names: plan (state/progress_pct) vs db-architect (completed/percent_complete) | P1 | Use plan §4.6 names in Drizzle schema; db-architect spec treated as initial draft; document divergence in migration 0002 SQL comment |
| `pinned_links.owner_id` nullable for global vs db-architect NOT NULL | P1 | Implementer writes nullable column; adds CHECK constraint `owner_type != 'global' OR owner_id IS NULL` |
| `deniedLmsService` in backend.ts grows stale as interface adds methods | P1 | TypeScript compile error enforces completeness; run `typecheck` gate before any PR |
| `demo.ts` in-memory adapter missing new methods | P1 | TypeScript compile error at interface; implement all 22 methods in demo adapter |
| `packages/lms` refactor breaks `demo.ts` which imports `LmsService` class by name | P1 | Barrel `index.ts` must re-export the thin class until `demo.ts` is migrated in the same wave; or migrate both simultaneously |
| embed_html XSS if sanitizer is bypassed | P0 | `sanitizeEmbedHtml` called INSIDE `updateLesson` service method, before DB write; no flag to skip it; tested with a `<script>` input that must be stripped |
| checkCourseCompletion double-completion (two concurrent markLessonComplete calls) | P1 | `ON CONFLICT DO NOTHING` on the `completed_at` update or use `UPDATE ... WHERE completed_at IS NULL`; audit row idempotent via unique constraint or conditional insert |
| Teacher profile backfill fails for orphaned courses (owner_teacher_id not in users.id) | P2 | Migration uses INNER JOIN; orphaned courses get `teacher_profile_id = NULL`; that is safe (nullable column); admin must reassign |
| Material download stub not labeled → looks like prod | P1 | Route response includes `x-wtc-stub: material-download-unavailable` header; dev UI shows "DEV STUB" badge next to download button |

---

## Next actions

1. **Implementer session (this wave):** Read this handoff + `docs/EDUCATION_LMS_PLAN.md` (§4, §5,
   §6, §8, §12, §17, §21) + `docs/handoffs/20260530-0126-ecosystem-education-implementer.md`
   + `docs/handoffs/20260530-0126-ecosystem-db-architect.md` as the combined canonical spec.

2. **Implementer: resolve column name conflicts before writing any code.** The three divergences
   between the db-architect spec and the education plan (lesson_progress column names, pinned_links
   owner_id nullability, enrollment source field) are resolved in this handoff in favor of the
   education plan. Write Drizzle schema columns as specified in §4 of `EDUCATION_LMS_PLAN.md`.

3. **Implementer: packages/lms refactor.** Replace the thin synchronous class with the service/
   structure. The barrel `index.ts` must continue to export `createMemoryLmsStore` and the thin
   type aliases for backward compat with `demo.ts` during the transition, or update `demo.ts`
   atomically in the same diff.

4. **Implementer: extend deniedLmsService in backend.ts** to cover all 22 methods. This is a
   compile-enforced requirement; the typecheck gate will fail if any method is missing.

5. **Implementer: write migration 0002 SQL.** Follow the backfill sequence in §Decisions D6 above.
   Never edit 0000 or 0001. Run `npx drizzle-kit generate` if DATABASE_URL is available for a
   throwaway DB; otherwise hand-write from the column specs.

6. **Implementer: run gates sequentially.** Per SESSION_PROTOCOL §6:
   `governance:check` → `check:core` → `lint` → `typecheck` → `typecheck -w @wtc/web` → `test`
   → `secret:scan` → `coverage` → `build -w @wtc/web` → `e2e`.
   Real Postgres `db:migrate` / `db:seed` = NOT RUN unless a throwaway `DATABASE_URL` is provided.

7. **Implementer: stop condition.** If context exceeds limits or quality degrades mid-wave, write
   a per-agent handoff capturing exact state (which routes/repos complete, which remain), hand the
   operator a copy-pasteable new-session prompt per SESSION_PROTOCOL §8.

8. **Future (Phase 3):** Drop `courses.owner_teacher_id` once all repos use `teacher_profile_id`
   and the NOT NULL constraint is verified. This is a separate migration (0003) in a separate phase.

9. **Future (Phase 4):** Wire real S3/R2 storage adapter for `getMaterialDownloadUrl`. The
   adapter interface is defined in `packages/lms/src/service/materials.ts`; Phase 4 devops injects
   the real implementation. The stub remains until then.
