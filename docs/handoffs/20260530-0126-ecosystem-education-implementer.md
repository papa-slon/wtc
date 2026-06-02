# ecosystem-education-implementer handoff

_2026-05-30 01:26 epoch. Phase 2 Wave-1 — DESIGN ONLY (no code edited, no shared files modified).
LMS Design agent. Per `docs/SESSION_PROTOCOL.md`: design-only wave; edits restricted to
`docs/EDUCATION_LMS_PLAN.md` and this handoff file. No test gates run (design wave, not implementation wave)._

## Scope

Phase 2 Wave-2 design for the full LMS on top of the Phase 1.7 thin model. Deliverables:

- (a) Additive table proposals for migration 0002 (exact columns, constraints, indexes).
- (b) Repo function signatures + in-txn audit actions for all Wave-2 mutations.
- (c) Route trees: existing pages vs new pages; landable scope vs DEV-STUB vs TARGET.
- Updated `docs/EDUCATION_LMS_PLAN.md` status banner + new §21.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — stack, roles, product codes, hard rules.
- `docs/SESSION_PROTOCOL.md` — process governance; design-only wave rules.
- `docs/EDUCATION_LMS_PLAN.md` (full read, 1-1057) — complete LMS contract, §4 table shapes, §5 service surface,
  §6 route structure, §12 audit events, §18 status, §20 Phase-1.8 prompt.
- `packages/lms/src/index.ts` (1-107) — thin in-memory `LmsService` + `LmsStore`; `Course`/`Lesson`/`Material`/`LessonProgress` interfaces; `Actor`.
- `packages/db/src/repositories.ts` (1-388) — production repo layer; Education section at 299-367 (4 thin repos: `createCourse`, `listCoursesForTeacher`, `listPublishedCourses`, `listLessonsForStudent`); audit pattern at 192-218.
- `packages/db/src/schema.ts` (1-243) — Drizzle schema; education block at 167-194: `courses`, `lessons`, `materials` (thin columns only).
- `packages/db/migrations/0000_broken_jack_murdock.sql` (40-120) — existing DDL for `courses`/`lessons`/`materials`.
- `packages/db/migrations/0001_early_toad_men.sql` — entitlements index only; no education touch.
- `apps/web/src/lib/lms-types.ts` — async `LmsService` interface (4 thin methods) + `CourseView`/`LessonView`.
- `apps/web/src/lib/db-store.ts` — DB-backed `lmsService` (4 thin methods wrapping DB repos).
- `apps/web/src/lib/demo.ts` — in-memory `lmsService` + seed (1 demo course, 1 lesson).
- `apps/web/src/lib/backend.ts` — fail-closed `lmsService` selector; `backendMode`.
- `apps/web/src/app/(app)/app/education/page.tsx` — student catalogue (thin: list published courses + lessons).
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard (thin: create + list own courses).
- `apps/web/src/app/teacher/courses/page.tsx` — Placeholder skeleton.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — Placeholder skeleton.
- `apps/web/src/app/teacher/materials/page.tsx` — Placeholder skeleton.
- `apps/web/src/app/teacher/students/page.tsx` — Placeholder skeleton.
- `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md` — last aggregate handoff; gates 93/5 green.
- `docs/handoffs/20260529-2352-lms-schema-gap-auditor.md` — column-drift catalogue + Option-2 blast radius.

## Files changed

- `docs/EDUCATION_LMS_PLAN.md` — status banner updated (reflects Phase-2 design complete); §21 added (full
  Wave-2 design: additive columns, 4 new table DDLs, complete repo signatures, audit event table, route trees,
  landable-scope matrix).
- `docs/handoffs/20260530-0126-ecosystem-education-implementer.md` — this file.

No code files modified. No shared packages touched. No migration files created (design only).

## Findings

### 1. [INFO] Thin model ground truth verified against live files

The Phase-1.7 thin model is exactly as documented. Four repos in `packages/db/src/repositories.ts:299-367`;
four-method `LmsService` in `apps/web/src/lib/lms-types.ts`; DB and memory adapters wired through
`backend.ts` fail-closed selector. Teacher skeletons at `/teacher/courses/page.tsx`,
`/teacher/courses/[id]/page.tsx`, `/teacher/materials/page.tsx`, `/teacher/students/page.tsx` are pure
`Placeholder` components — no data calls, no service imports, safe to replace in full.

### 2. [INFO] Column drift: existing thin columns vs plan

The lms-schema-gap-auditor (`20260529-2352-lms-schema-gap-auditor.md`) catalogued all drift. Key points
for migration 0002 design:

- `courses` has `owner_teacher_id uuid NOT NULL REFERENCES users(id)` (not `teacher_profile_id`). Migration
  0002 adds `teacher_profile_id uuid REFERENCES teacher_profiles(id)` as NULLABLE, with a backfill. The thin
  `owner_teacher_id` column stays untouched. `published` stays `published` (not renamed to `is_published`).
- `lessons` has `body text`, `video_url text`, `order integer`, `published boolean` — no `content_type`,
  `slug`, `embed_html`, `article_body`, `external_url`, `duration_sec`, `is_preview`, `sort_order`,
  `created_at`, `updated_at`.
- `materials` has `label text`, `url text`, `kind text` — no `title`, `material_type`, `file_key`,
  `file_name`, `file_size_bytes`, `mime_type`, `external_url`, `sort_order`, `created_at`.

All additions are additive; no rename of any column that exists in migration 0000.

### 3. [DECISION] FK strategy: courses.teacher_profile_id is NULLABLE in migration 0002

The implementer MUST NOT add a NOT NULL constraint on `courses.teacher_profile_id` in migration 0002.
Existing course rows pre-date `teacher_profiles`. The safe sequence:
1. Migration 0002: CREATE `teacher_profiles`; ADD COLUMN `courses.teacher_profile_id uuid REFERENCES
   teacher_profiles(id)` (nullable); backfill `teacher_profile_id` for all courses whose owner is a
   teacher role user (create a `teacher_profiles` row first if one does not exist).
2. New repos join through `teacher_profile_id` when populated; fallback to `owner_teacher_id` for thin-model
   compat during the transition window.
3. A future migration 0003 (separate phase) adds the NOT NULL constraint and drops `owner_teacher_id` once
   all code uses the new column.

This avoids a data-migration hazard that would break existing course rows.

### 4. [INFO] Material upload stays DEV-STUB in Wave-2

`getMaterialDownloadUrl` returns a placeholder URL in dev/test. The repo function signature accepts an
injectable storage adapter (interface defined in `packages/lms`); production wires the real S3/R2 adapter
in Phase 4 devops. `file_key` is never returned in any API response.

### 5. [INFO] LmsService interface must grow in Wave-2

The thin `LmsService` in `apps/web/src/lib/lms-types.ts` has 4 methods. Wave-2 needs the full surface
(~20 methods). The clean approach: refactor `packages/lms/src/index.ts` into the `service/` directory
structure per §5.1 of the plan, export the full typed surface from `packages/lms/src/index.ts` barrel,
then update `lms-types.ts`, `db-store.ts`, `demo.ts`, and `backend.ts` to match. Existing 4 thin methods
must not break — they keep the same signatures.

### 6. [INFO] Embed HTML sanitiser is required before any lesson write

`embed_html` must pass through `sanitizeEmbedHtml()` in `packages/lms/src/service/lessons.ts` BEFORE any
DB write (see plan §9.2). The sanitiser is a server-side allowlist: `iframe` only, `src` must be `https://`,
strip all `script`/`on*`/`style`/`data:` content. This is a hard security requirement; there is no skip flag.

### 7. [INFO] Progress API rate limiting

The `POST /api/education/progress` route must be rate-limited (plan §17): 6 calls/minute per user per
lesson. Applied by `packages/auth` middleware at the route level. Server-side guard in `upsertProgress`:
ignore if `last_seen_at > NOW() - INTERVAL '8 seconds'` (return existing row, no error, no DB write).

## Decisions

- **Design-only wave**: no code written, no gates run. The design is canonical in `docs/EDUCATION_LMS_PLAN.md`
  §21 and this handoff. The implementer reads both.
- **Additive-only migration 0002**: never edit 0000 or 0001. All new columns go in 0002 as nullable or
  with safe defaults. The FK `courses.teacher_profile_id` stays nullable in 0002.
- **4 new tables confirmed landable**: `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`.
  All 4 are required for Wave-2 functionality (teacher ownership chain, student progress, community links).
- **packages/lms refactor is part of Wave-2**: the thin `LmsService` class over `Map`s must be replaced
  with the `service/` + `guards/` + `schemas.ts` + `errors.ts` structure. This is in-scope for the
  implementer session (no new dependencies required; all logic stays in the package).
- **Memory parity**: `demo.ts` in-memory adapter must match every new DB repo signature. A missing `await`
  at a call site is a typecheck error — maintain that property.
- **upload = metadata stub**: `materialType = 'file'` writes metadata columns only; `file_key` is provided
  by the caller (no-op stub string in dev). The route layer accepts the file upload field but does not
  process bytes. This is the hard boundary for this phase.

## Additive table proposals (for migration 0002)

See `docs/EDUCATION_LMS_PLAN.md` §21.2 for the full DDL. Summary:

| Table | Key columns | Notable constraints |
|---|---|---|
| `teacher_profiles` | `id, user_id FK→users, display_name, bio, avatar_url, social_links jsonb, is_active, created_at, updated_at` | UNIQUE(user_id) |
| `enrollments` | `id, user_id FK, course_id FK, enrolled_at, completed_at, source text` | UNIQUE(user_id, course_id) |
| `lesson_progress` | `id, user_id FK, lesson_id FK, course_id FK (denorm), state, progress_pct, started_at, completed_at, last_seen_at` | UNIQUE(user_id, lesson_id) |
| `pinned_links` | `id, owner_type text, owner_id uuid (nullable), label, url, icon_type, sort_order, is_active, created_by_user_id FK, created_at` | index on (owner_type, owner_id) |

Additive columns on existing tables: see §21.1 — `courses` gains `slug`, `thumbnail_url`, `level`, `tags`,
`is_featured`, `sort_order`, `updated_at`, `teacher_profile_id (nullable FK)`. `lessons` gains `slug`,
`description`, `content_type`, `embed_html`, `article_body`, `external_url`, `duration_sec`, `is_preview`,
`sort_order`, `created_at`, `updated_at`. `materials` gains `title`, `material_type`, `file_key`, `file_name`,
`file_size_bytes`, `mime_type`, `external_url`, `sort_order`, `created_at`.

## Repo + audit functions

See `docs/EDUCATION_LMS_PLAN.md` §21.3 for full signatures. Grouped by domain:

**Teacher profiles (admin-only create/deactivate, teacher self-edit):**
`createTeacherProfile`, `getTeacherProfileByUserId`, `updateTeacherProfile`, `setTeacherProfileActive`

**Courses (additive; thin repos stay):**
`updateCourse`, `publishCourse`, `unpublishCourse`, `deleteCourse`, `setCourseFeatured`

**Lessons:**
`createLesson`, `updateLesson` (calls `sanitizeEmbedHtml` in-repo), `deleteLesson`, `reorderLessons`,
`getLessonForStudent` (logs `education.lesson.view`)

**Materials:**
`createMaterial`, `deleteMaterial`, `getMaterialDownloadUrl` (DEV-STUB)

**Enrollments:**
`ensureEnrolled` (idempotent, no audit), `adminCreateEnrollment` (audited), `getCourseStudentList`

**Progress:**
`upsertProgress` (debounced, auto-complete at 95%), `markLessonComplete`, `getCourseProgress`,
`checkCourseCompletion` (in-txn helper, audits `education.course.completed`)

**Pinned links:**
`listPinnedLinks`, `createPinnedLink`, `deletePinnedLink`

Audit event list: 21 events total (see §21.4). All use `context='education'` in the `after` payload.
All mutations are atomic: mutation + audit in one Drizzle transaction (same pattern as `grantProduct`
and `submitTvRequest` in `packages/db/src/repositories.ts`).

## Route trees + landable scope vs TARGET

See `docs/EDUCATION_LMS_PLAN.md` §21.5 for the full table. Short form:

**Landable in Wave-2 (one implementer session):**
- Migration 0002 + schema.ts update.
- All ~20 repo functions + PGlite integration tests.
- packages/lms refactor (service/ + guards/ + schemas.ts + errors.ts).
- Student `/[courseSlug]/page.tsx`, `/[courseSlug]/[lessonSlug]/page.tsx` + progress client islands.
- Progress API routes (POST /api/education/progress, POST /api/education/progress/complete).
- Material download route (GET /api/education/materials/[id]/download) — DEV-STUB signed URL.
- Teacher skeleton pages filled: `/teacher/courses/page.tsx`, `/teacher/courses/[id]/page.tsx`,
  `/teacher/courses/new/page.tsx`, lesson editor pages, `/teacher/materials/`, `/teacher/students/`,
  `/teacher/community/page.tsx` (NEW).
- Admin education panel: `/admin/education/**` (NEW route group, 6 pages).

**DEV-STUB (metadata only, no bytes):**
- Material file upload: form accepts file field, writes metadata columns, `file_key` = stub string.
- Material download: `getMaterialDownloadUrl` returns a placeholder URL.

**TARGET (deferred, separate future phases):**
- Real object storage (Phase 4 devops — S3/R2 bucket + signed URLs).
- Email/Telegram notifications on course completion (Phase 5 worker jobs).
- Course certificates, discussion threads, cohort delivery (future).

## Risks

| Risk | Mitigation |
|---|---|
| `courses.teacher_profile_id` FK backfill fails for courses whose owner has no `teacher_profiles` row | Migration 0002 must CREATE `teacher_profiles` rows for all existing teacher-role users BEFORE adding the FK column; column stays nullable so pre-backfill rows do not fail |
| Embed HTML XSS | `sanitizeEmbedHtml` called inside `updateLesson` repo, not at the route layer; there is no path to write `embed_html` without sanitisation |
| Progress upsert stampede | Server-side `last_seen_at` guard (8-second window) + route-level rate limit (6/min/user/lesson) |
| Memory adapter drift from DB adapter | `packages/lms` Zod schemas define the canonical input; both adapters validate the same schema; typecheck catches signature drift |
| `lesson_progress` accumulates for lessons deleted later | `deleteLesson` is blocked if `lesson_progress` records exist — teacher must see a warning and cannot bypass without admin |

## Verification/tests

Design-only wave: no gates run. Proposed tests for the implementer session (not run here):

- PGlite integration: ownership isolation (teacher A cannot edit teacher B's course); student fail-closed
  visibility (unpublished course → empty lesson list, 404 on lesson fetch); enrollment idempotency;
  progress upsert + auto-complete at 95% + course completion; admin override (admin can edit any course);
  `getCourseStudentList` returns no email.
- Typecheck: must catch any call site missing `await` on a new async repo (the `Promise<...>` return type
  propagates the error).
- E2E: teacher creates lesson → student sees lesson → marks complete → progress bar advances.

Gates the implementer must run (sequential, per SESSION_PROTOCOL):
`governance:check, check:core, lint, typecheck, typecheck -w @wtc/web, test, secret:scan, coverage,
build -w @wtc/web, e2e`. Real Postgres = NOT RUN unless throwaway `DATABASE_URL` is provided.

## Next actions

1. **db-architect** — confirm migration 0002 plan (4 new tables + additive columns on 3 existing tables).
   Co-ordinate on the `courses.teacher_profile_id` nullable FK + backfill approach. Migration must be
   additive (no edits to 0000/0001). Implementer reads this handoff + §21 before writing the migration.
2. **implementer session** — read `docs/EDUCATION_LMS_PLAN.md` (esp. §4/§5/§6/§12/§21) + this handoff as
   the canonical spec. Launch minimum auditors before any edit (per SESSION_PROTOCOL §2):
   `lms-schema-migration-auditor`, `lms-repository-auditor`, `lms-frontend-auditor`,
   `security-auditor`, `qa-gates-auditor`. Each writes a per-agent handoff; operator writes the aggregate.
3. **Education page community sidebar** — `apps/web/src/app/(app)/app/education/page.tsx` has a static
   "Community" card with placeholder text. Wave-2 replaces this with `listPinnedLinks({ ownerType: 'global' })`
   server call once migration 0002 + `pinned_links` repo lands.
