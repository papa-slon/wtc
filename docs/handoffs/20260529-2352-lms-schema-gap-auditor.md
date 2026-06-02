# lms-schema-gap-auditor handoff

_2026-05-29 23:52. READ-ONLY audit. Phase 1.7 / Part E. No live servers, no billing, no code modified. Goal: decide the LMS persistence approach (Option 1 minimal vs Option 2 proper) and justify it with file:line evidence._

## Scope

Decide and justify the LMS DB-persistence approach for Phase 1.7 Part E. Specifically:
- Catalogue which education tables/columns EXIST today (`packages/db/src/schema.ts` + `packages/db/migrations/`) vs what `docs/EDUCATION_LMS_PLAN.md` specifies (the full 7-table contract).
- Confirm whether ANY education repositories exist in `packages/db/src/repositories.ts` (answer: none).
- Read the live in-memory domain (`packages/lms/src/index.ts`) and the two thin call sites (`apps/web/src/app/(app)/app/education/page.tsx`, `apps/web/src/app/teacher/page.tsx`) to establish what the UI actually does today.
- Recommend conservatively. If Option 2 is too large for one session, recommend Option 1 + give exact Option-1 repo signatures + a copy-pasteable Phase 1.8 full-LMS prompt + Option 2 blast radius.
- Cross-check the prior `20260529-1921-integration-risk-auditor` LMS claims against the live files.

Target Part for all findings: **C** (LMS schema/persistence decision).

## Files inspected

- `packages/lms/src/index.ts` (read fully, 1-107) — in-memory `LmsService`/`LmsStore`; `Course`/`Lesson`/`Material`/`LessonProgress` interfaces; `Actor`.
- `packages/db/src/schema.ts` (read fully, 1-243) — Drizzle schema; education block at lines 167-194.
- `packages/db/src/repositories.ts` (read fully, 1-279) — production repo layer; confirmed NO education repos.
- `docs/EDUCATION_LMS_PLAN.md` (read fully, 1-991) — full LMS contract: 7 tables, full service surface, audit events.
- `apps/web/src/app/(app)/app/education/page.tsx` (read fully, 1-56) — student call site.
- `apps/web/src/app/teacher/page.tsx` (read fully, 1-61) — teacher call site + `createCourseAction` server action.
- `apps/web/src/lib/backend.ts` (read fully, 1-77) — backend selector; LMS pinned to `memory.*` at lines 50-51.
- `apps/web/src/lib/db-store.ts` (read fully, 1-107) — DB-backed accessor surface; the pattern Option 1 must extend; NO LMS functions.
- `apps/web/src/lib/demo.ts` (lines 1-159 inspected; LMS lines via grep) — in-memory store + seed; `lmsStore`/`lmsService` at 74-75; LMS seed at 109-110.
- `apps/web/src/lib/access.ts` (read fully, 1-33) — `accessFor()` used by the education page (entitlement gate).
- `packages/db/src/index.ts` (read fully, 1-5) — barrel; `export * from './repositories.ts'`, so any new repo is auto-exported.
- `packages/db/migrations/0000_broken_jack_murdock.sql` (education DDL lines 43-120) — `courses`/`lessons`/`materials` already created.
- `packages/db/migrations/0001_early_toad_men.sql` (read fully, 1-2) — only converts entitlements index to UNIQUE; touches NO education table.
- `docs/handoffs/20260529-1921-integration-risk-auditor.md` (read fully) — prior cross-cutting audit; cross-checked its LMS claims.
- Repo-wide grep for `teacher_profiles|enrollments|lesson_progress|pinned_links|teacherProfile` under `packages/` — **zero matches** (no schema, no repo, no type anywhere).

## Files changed

None — read-only audit

## Findings

### 1. [INFO] (C) DECISION: Option 1 (minimal Part E). The DB tables for the THIN model already exist; the full-plan tables do not exist anywhere — Option 2 is a green-field multi-table build, too large for this session.

Evidence:
- The thin tables already exist in the DB. `packages/db/src/schema.ts:168-194` defines `courses`, `lessons`, `materials`, and the migration `packages/db/migrations/0000_broken_jack_murdock.sql:43-51, 104-112, 114-120` already creates them. So Option 1 needs **NO new migration** — only repo functions + a DB-backed accessor + call-site awaits.
- The full-plan tables do NOT exist. Repo-wide grep for `teacher_profiles|enrollments|lesson_progress|pinned_links` under `packages/` returned zero matches. The plan requires all four (`docs/EDUCATION_LMS_PLAN.md:125-143` teacher_profiles, `:238-254` enrollments, `:258-275` lesson_progress, `:283-301` pinned_links). Option 2 would have to create four tables + a fifth set of altered columns on `courses`/`lessons`/`materials` (see Finding 3), plus FKs to `users`, plus repos, plus audit, plus page rewrites.
- `LessonProgress` exists as an in-memory type only (`packages/lms/src/index.ts:35-39`) and is appended via `markComplete` (`:102-105`) but has **no DB table** (no `lesson_progress` in schema). So even "progress" is green-field for the DB.

Recommendation: Adopt **Option 1**. DB-wire only the thin UI that exists today (teacher creates/lists own courses; student lists published lessons of published courses), reusing the already-migrated `courses`/`lessons`/`materials` tables. Explicitly document that this is NOT the full LMS contract (see Finding 6). Defer the full contract to a dedicated Phase 1.8 (prompt in Finding 7).

Target Part: C.

### 2. [INFO] (C) Exactly which education tables/columns EXIST today vs the plan

EXISTS today (schema.ts + migration 0000), shape is the THIN model and matches `packages/lms/src/index.ts` 1:1:

- `courses` — `packages/db/src/schema.ts:168-176` / DDL `0000_*.sql:43-51`. Columns: `id uuid PK`, `owner_teacher_id uuid NOT NULL → users(id)`, `title text NOT NULL`, `description text`, `product_code text NOT NULL default 'education'`, `published boolean NOT NULL default false`, `created_at timestamptz NOT NULL default now()`.
- `lessons` — `schema.ts:178-186` / DDL `0000_*.sql:104-112`. Columns: `id uuid PK`, `course_id uuid NOT NULL → courses(id) ON DELETE CASCADE`, `title text NOT NULL`, `body text`, `video_url text`, `order integer NOT NULL default 0`, `published boolean NOT NULL default false`.
- `materials` — `schema.ts:188-194` / DDL `0000_*.sql:114-120`. Columns: `id uuid PK`, `lesson_id uuid NOT NULL → lessons(id) ON DELETE CASCADE`, `label text NOT NULL`, `url text NOT NULL`, `kind text NOT NULL default 'link'`.

MISSING entirely (no schema, no migration, no repo, no type — grep-confirmed zero matches under `packages/`):

- `teacher_profiles` (plan `docs/EDUCATION_LMS_PLAN.md:125-143`): `id, user_id FK, display_name, bio, avatar_url, social_links jsonb, is_active, created_at, updated_at`, `UNIQUE(user_id)`.
- `enrollments` (plan `:238-254`): `id, user_id FK, course_id FK, enrolled_at, completed_at, source`, `UNIQUE(user_id, course_id)`.
- `lesson_progress` (plan `:258-275`): `id, user_id FK, lesson_id FK, course_id FK (denormalized), state, progress_pct, started_at, completed_at, last_seen_at`, `UNIQUE(user_id, lesson_id)`.
- `pinned_links` (plan `:283-301`): `id, owner_type, owner_id, label, url, icon_type, sort_order, is_active, created_by_user_id, created_at`.

Per-table column DRIFT on the tables that DO exist (existing thin column → plan column it does NOT have):

- `courses`: existing has `owner_teacher_id` (→ `users.id`); plan wants `teacher_profile_id` (→ `teacher_profiles.id`, `:163`). Existing is MISSING plan columns `slug` (`:165`, plan makes it `UNIQUE`), `thumbnail_url`, `level`, `tags text[]`, `is_featured`, `sort_order`, `updated_at` (`:165-176`). Existing booleans are named `published`; plan names them `is_published` (`:172`).
- `lessons`: existing has `body` + `video_url` + `order` + `published`; plan wants `slug`, `description`, `content_type`, `embed_html`, `article_body`, `external_url`, `duration_sec`, `is_preview`, `sort_order`, `created_at`, `updated_at`, and renames `body`→`article_body`, `order`→`sort_order`, `published`→`is_published` (`:187-207`).
- `materials`: existing has `label` + `url` + `kind`; plan wants `title`, `material_type`, `file_key`, `file_name`, `file_size_bytes`, `mime_type`, `external_url`, `sort_order`, `created_at` (`:215-230`).

INFO (out of Part C, do not action here): the plan's section 18 (`docs/EDUCATION_LMS_PLAN.md:957-975`) and `packages/lms/src/index.ts:1-6` both narrate these features as "Implemented", but the code implements only the thin model. This is a doc-vs-reality overstatement to flag for whoever owns the plan doc (Part G/docs), not a Part C action.

Target Part: C.

### 3. [INFO] (C) NO education repositories exist; the DB selector has NO LMS path — Option 1 must add both. The existing repo conventions are clear and copyable.

Evidence:
- `packages/db/src/repositories.ts` (read fully 1-279) contains Identity, Sessions, Entitlements, Exchange keys, Audit, TradingView, Worker jobs — and **no** course/lesson/material function. `import * as s from './schema.ts'` (`:25`) means `s.courses`/`s.lessons`/`s.materials` are reachable but unused.
- `apps/web/src/lib/backend.ts:50-51` pins `lmsService = memory.lmsService; lmsStore = memory.lmsStore;` — the LMS UI is unconditionally in-memory, even in production. The header note at `:7-10` says exactly this ("TradingView + LMS web UI still use the in-memory store ... Wiring the TV/LMS web UI to Postgres is Phase 1.5").
- `apps/web/src/lib/db-store.ts` (1-107) has no LMS export.
- `packages/db/src/index.ts:5` is `export * from './repositories.ts'`, so any new repo function is automatically exported from `@wtc/db` (no barrel edit needed).

Recommendation — exact Option-1 repo signatures to ADD to `packages/db/src/repositories.ts` (snake_case columns already exist; mirror the existing `submitTvRequest`/`listTvByUser` async-over-Drizzle style at `:228-244`):

```ts
// ---------------- Education (thin Part-E model; NOT the full LMS contract) ----------------
export type DbCourse = typeof s.courses.$inferSelect;
export type DbLesson = typeof s.lessons.$inferSelect;

// Teacher: create a course they own. ownerTeacherId is the *user id* (current thin model uses
// users.id directly — there is no teacher_profiles table yet). Mirrors LmsService.createCourse.
export async function createCourse(
  db: Db,
  input: { ownerTeacherId: string; title: string; description?: string; productCode?: string; published?: boolean },
): Promise<DbCourse> { /* INSERT ... RETURNING; default product_code 'education', published false */ }

// Teacher/admin list: a teacher sees only their own; admin sees all. Caller decides isAdmin
// (the route already computes user.roles.includes('admin')). Keep ownership filter server-side here.
export async function listCoursesForOwner(db: Db, ownerTeacherId: string, isAdmin: boolean): Promise<DbCourse[]> {
  /* isAdmin ? select all : select where owner_teacher_id = ownerTeacherId */
}

// Student catalogue: only published courses (fail-closed; entitlement is checked by the caller via accessFor()).
export async function listPublishedCourses(db: Db): Promise<DbCourse[]> {
  /* select where published = true */
}

// Student lesson list for a course: only published lessons of a published course, ordered.
// Returns [] if the course is missing or unpublished (mirrors LmsService.listLessonsForStudent fail-closed).
export async function listPublishedLessons(db: Db, courseId: string): Promise<DbLesson[]> {
  /* if course not published -> []; else select published lessons where course_id = courseId order by "order" */
}
```

These four cover 100% of what the two live pages do today (Finding 4). `materials` and `LessonProgress` are NOT exercised by the current UI, so Option 1 does not add repos for them (the education page renders Materials/Community as static "soon" placeholders — `apps/web/src/app/(app)/app/education/page.tsx:47-53`).

Then add the DB-backed accessor + wire the selector (mirror the entitlement accessors in `db-store.ts:78-86`):
- `apps/web/src/lib/db-store.ts`: add `createCourse`, `listCoursesForOwner`, `listPublishedCourses`, `listPublishedLessons` wrappers over `db()` (the cached Drizzle handle at `:32-40`).
- `apps/web/src/lib/demo.ts`: add memory equivalents with the SAME signatures (today the pages reach into `lmsStore.courses.values()` / `lmsService` directly — Option 1 should funnel both backends through one async function-shaped surface so the selector can switch them, the way core accessors already do).
- `apps/web/src/lib/backend.ts`: replace the unconditional `memory.lmsService`/`memory.lmsStore` pins (`:50-51`) with `guard(core.createCourse)` etc., exactly like `grantProduct` at `:41`.

Target Part: C.

### 4. [INFO] (C) What the two thin call sites actually do today — the complete Option-1 surface (verified line-by-line)

`apps/web/src/app/teacher/page.tsx`:
- `createCourseAction` (`:9-20`): RBAC gate `teacher||admin` (`:12`), `assertCsrf` (`:13`), then **synchronous** `lmsService.createCourse({ userId, isAdmin }, { title, description, published }, Date.now())` (`:14-18`), then `revalidatePath('/teacher')` (`:19`). → maps to `createCourse(db, {...})`.
- Page body (`:27`): `myCourses = [...lmsStore.courses.values()].filter(c => c.ownerTeacherId === user.id || user.roles.includes('admin'))`. → maps to `listCoursesForOwner(db, user.id, isAdmin)`.

`apps/web/src/app/(app)/app/education/page.tsx`:
- Entitlement gate via `accessFor(user.id, 'education')` (`:8`, helper at `apps/web/src/lib/access.ts:5-8`) — fail-closed render if `!access.allowed` (`:10-17`). Keep as-is; the LMS repos do NOT check entitlements (correct: entitlement is the route's job, matching `LmsService.listLessonsForStudent`'s `hasEducationAccess` param being passed `true` by the page at `:32`).
- `:19`: `courses = [...lmsStore.courses.values()].filter(c => c.published)`. → maps to `listPublishedCourses(db)`.
- `:32`: `lmsService.listLessonsForStudent(c.id, true)` per course. → maps to `listPublishedLessons(db, c.id)`.

Both pages are `async` already (`export default async function`), so adding `await` to the new repo calls is low-friction.

Target Part: C.

### 5. [HIGH] (C/A) The two LMS call sites are SYNCHRONOUS and will silently break when LMS goes async. Verified; one line number in the prior handoff has drifted.

Cross-check of `docs/handoffs/20260529-1921-integration-risk-auditor.md:56-59` against the live files:
- `teacher/page.tsx:14` `lmsService.createCourse(...)` — CONFIRMED at line 14 (inside `createCourseAction`). The server action does NOT `await`; with an async DB repo it would call `revalidatePath('/teacher')` (`:19`) before the INSERT commits → the new course is missing on the immediate re-render.
- `teacher/page.tsx:27` `lmsStore.courses.values()` — CONFIRMED at line 27. With a DB backend an in-memory map read returns empty.
- `education/page.tsx:19` `lmsStore.courses.values()` — CONFIRMED at line 19.
- `education/page.tsx` `listLessonsForStudent(...)` — prior handoff says **line 28**; the live file has it at **line 32** (line 28 is the `courses.length === 0` empty-state check). Minor drift — the prior handoff line number is stale; the call is real and at `:32`.

Recommendation: when Option 1 lands, convert these to `await`ed async repo calls atomically with the interface change (do not ship an async store with un-awaited call sites). This is the same risk the prior auditor flagged as Finding 1; it remains open for LMS. A typecheck-visible async signature (the repo functions return `Promise<...>`) will surface any missed `await`.

Target Part: C (with A overlap — same atomic-async-migration discipline).

### 6. [MEDIUM] (C) Stale/contradictory in-UI storage banner + plan "Implemented" claims must be corrected when Option 1 lands.

Evidence:
- `apps/web/src/app/(app)/app/education/page.tsx:25-26`: renders `storage: in-memory (demo)` and `LMS content is not yet DB-persisted — resets on restart (Phase 1.5).` Once Option 1 DB-wires the page, this banner becomes false in production and must be made backend-aware (e.g. driven by `backendMode` from `apps/web/src/lib/backend.ts:29`, the way other surfaces report `postgres`/`memory`). It also references "Phase 1.5" while we are in Phase 1.7.
- `teacher/page.tsx` has no storage banner — so after wiring, the two education pages would disagree about persistence unless the banner is centralised.

Recommendation: drive the storage pill from `backendMode` and update the copy to drop the hardcoded "Phase 1.5 / in-memory" claim. Keep wording honest about what Option 1 covers (thin model only).

Target Part: C (UI copy) — coordinate with whoever owns Part E page edits.

### 7. [INFO] (C) Option 2 blast radius (why it is deferred) + copy-pasteable Phase 1.8 full-LMS prompt.

Option 2 blast radius (all green-field except the 3 thin tables, which would need ALTERs):
- Migrations: new `0002_*.sql` creating `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links` (4 tables) + ALTER `courses` (add `slug UNIQUE`, `thumbnail_url`, `level`, `tags`, `is_featured`, `sort_order`, `updated_at`; rename `owner_teacher_id`→`teacher_profile_id` + repoint FK from `users` to `teacher_profiles`; rename `published`→`is_published`) + ALTER `lessons` (8 new columns + 3 renames) + ALTER `materials` (8 new columns + rename `label`→`title`, `kind`→`material_type`). The FK repoint on `courses.owner_teacher_id` is a data-migration hazard: every existing course row needs a `teacher_profiles` row first (backfill).
- Schema: rewrite the education block of `schema.ts:168-194` to the plan shapes (`docs/EDUCATION_LMS_PLAN.md:125-301`).
- `packages/lms/src/index.ts`: today exports thin interfaces + a sync `LmsService` over `Map`s. Plan §5.1 (`:315-335`) wants a `service/` directory (courses/lessons/materials/enrollments/progress/teacher-profiles/pinned-links), `guards/` (ownership + entitlement), `schemas.ts` (Zod), `errors.ts` (`LmsError`/`EntitlementDenied`/`OwnershipDenied`/`LmsNotFound`/`LmsConflict`). That is a package rewrite, not an extension.
- Repos: ~20+ functions per the plan service surface (`:339-481`) — course CRUD + publish/unpublish, lesson CRUD + reorder, material CRUD + signed-URL, enrollment upsert/admin-create/list, progress upsert/complete/course-summary, teacher-profile CRUD, pinned-link CRUD.
- Audit: 17 education events (`docs/EDUCATION_LMS_PLAN.md:813-831`) must be wired through `@wtc/audit` (the existing DB audit writer pattern is `repositories.ts:212-218`; grant/revoke show the in-txn audit pattern at `:143, :153`).
- Pages/routes: plan §6 (`:559-658`) defines student `[courseSlug]/[lessonSlug]` trees, a full `/teacher/courses/...` CRUD tree, and `/admin/education/...` — none of which exist (only the two flat pages do). Plus progress API routes (`:723-728`) and a material-download route (`:758-766`). Plus an `embed_html` server-side sanitizer (`:746-754`) and signed-URL object storage (`:232-236`, marked "stub / Phase 4 devops" at `:963-964`) — the latter is an external dependency Part E explicitly excludes.

That is far beyond one Part-E session → defer.

Copy-pasteable Phase 1.8 prompt (drop into a fresh session):

```
=== Phase 1.8: full-LMS persistence (proper, per docs/EDUCATION_LMS_PLAN.md) ===
Build the FULL LMS contract on Postgres. READ docs/EDUCATION_LMS_PLAN.md as the spec.
DB (packages/db): add migration 0002 creating teacher_profiles, enrollments, lesson_progress,
pinned_links (shapes in plan §4.1/§4.5/§4.6/§4.7) AND alter courses/lessons/materials to the plan
column sets (plan §4.2/§4.3/§4.4) — including courses.owner_teacher_id → teacher_profile_id with a
backfill that creates a teacher_profiles row per existing course owner before repointing the FK.
Regenerate schema.ts + snapshot; add PGlite integration tests covering ownership isolation
(a teacher cannot read another teacher's drafts) and student fail-closed visibility.
packages/lms: refactor index.ts into service/ + guards/ + schemas.ts (Zod, plan §5.3) + errors.ts
(plan §5.4); ownership enforced in guards/ownership.ts; entitlement via guards/entitlement.ts calling
@wtc/entitlements (NEVER read entitlements table directly). Async throughout.
packages/db/src/repositories.ts: add the full service surface from plan §5.2 (course CRUD + publish,
lesson CRUD + reorder, material CRUD + signed-URL stub, enrollment upsert/admin-create/list,
progress upsert/complete/course-summary, teacher-profile CRUD, pinned-link CRUD).
Audit: wire all 17 education events (plan §12) through @wtc/audit, mutation + audit in one txn.
apps/web: build student [courseSlug]/[lessonSlug], teacher /courses CRUD tree, /admin/education tree,
progress API routes (plan §8.4), material-download route (plan §9.3), embed sanitizer (plan §9.2).
Wire backend.ts + db-store.ts + demo.ts (memory parity) the way core accessors are wired.
HARD RULES: no real object storage (signed-URL is a stub/interface only — plan §18), no live billing,
no live servers. Migration must be additive (new 0002; never edit 0000/0001). All gates green.
```

Target Part: C.

## Decisions

- **DECISION: Option 1 (minimal Part E).** Rationale: the thin DB tables (`courses`/`lessons`/`materials`) already exist and already match the in-memory model 1:1 (`schema.ts:168-194` vs `packages/lms/src/index.ts:7-33`; migration `0000_*.sql:43-51,104-120`), so Option 1 needs **no migration** — only ~4 repo functions, a DB-store accessor, and call-site awaits. Option 2's four required tables (`teacher_profiles`/`enrollments`/`lesson_progress`/`pinned_links`) exist NOWHERE (grep-confirmed zero matches), and Option 2 additionally requires altering/renaming/repointing all three existing tables (incl. a `courses` FK change from `users` to `teacher_profiles` with a data backfill), a `packages/lms` package rewrite, ~20 repos, 17 audit events, and entire new route trees — too large and too high-blast-radius for one Part-E session.
- Option 1 must NOT claim to be the full contract. The plan doc (§18) and the `packages/lms` header already overstate "Implemented"; the in-UI banner (`education/page.tsx:25-26`) must be corrected to be backend-aware, not left asserting "in-memory / Phase 1.5".
- The async migration for LMS must be atomic (interface + all call sites in one change), per the prior auditor's still-open Finding 1 — the two LMS sites are synchronous today (Finding 5).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Option 1 ships async repo but a call site keeps a sync `lmsStore.*.values()` read | Medium (2 sites, one line number already drifted) | High (empty/stale UI; lost course on create) | Convert all sites + remove direct `lmsStore`/`lmsService` use in one change; lean on `Promise<...>` return types for typecheck visibility |
| Storage banner stays "in-memory (demo)" after DB wiring | Certain if untouched | Medium (false claim in prod UI) | Drive pill from `backendMode` (backend.ts:29); drop hardcoded Phase-1.5 copy |
| Stakeholder reads Option 1 as "LMS is done" | Medium | High (full contract silently dropped) | Explicit NOT-the-full-contract note in handoff + banner + Phase 1.8 prompt carried forward |
| Memory backend drifts from DB backend (signatures diverge) | Medium | Medium (dev passes, prod breaks) | Define one async function surface; demo.ts + db-store.ts implement identical signatures (as core accessors already do) |
| Future Option-2 `courses` FK repoint (users→teacher_profiles) loses/duplicates rows | Medium (data migration) | High | Backfill teacher_profiles per existing owner BEFORE repoint; PGlite test for the migration (called out in the Phase 1.8 prompt) |

## Verification/tests

- Read-only audit: no commands run (no npm/test/build/git), per hard rules.
- Claims verified by direct reads: thin-table existence (`schema.ts:168-194`; DDL `0000_*.sql:43-51,104-120`); migration 0001 touches no education table (`0001_early_toad_men.sql:1-2`); zero education repos (`repositories.ts` full read, 1-279); selector pins LMS to memory (`backend.ts:50-51`); no LMS in db-store (`db-store.ts` full read); missing full-plan tables (grep `teacher_profiles|enrollments|lesson_progress|pinned_links` under `packages/` → no files); call-site behaviour (`teacher/page.tsx:14,27`; `education/page.tsx:8,19,32`); barrel auto-export (`packages/db/src/index.ts:5`).
- Suggested tests when Option 1 is implemented (NOT run here): (1) PGlite integration test in `packages/db` — `createCourse` then `listCoursesForOwner` returns it for the owner and for admin, but NOT for a different teacher; `listPublishedCourses` excludes unpublished; `listPublishedLessons` returns [] for an unpublished course and only published lessons (ordered) for a published one — mirroring `LmsService` fail-closed semantics (`packages/lms/src/index.ts:88-93`). (2) A server-action test asserting `createCourseAction` awaits the DB insert before `revalidatePath`. (3) After wiring, confirm the storage pill reads `postgres` when `DATABASE_URL` is set.

## Next actions

Ordered:

1. **[Part C / Part E, this phase]** Add the four Option-1 repos to `packages/db/src/repositories.ts` (`createCourse`, `listCoursesForOwner`, `listPublishedCourses`, `listPublishedLessons` — signatures in Finding 3). No migration needed (tables exist).
2. **[Part C / Part E]** Add identical-signature accessors to `apps/web/src/lib/db-store.ts` (DB) and `apps/web/src/lib/demo.ts` (memory parity), then switch `apps/web/src/lib/backend.ts:50-51` from the unconditional `memory.lms*` pins to `guard(core.*)` exports (mirror `grantProduct` at `:41`).
3. **[Part C / Part E, atomic with step 2]** Convert the two call sites to `await`ed repo calls: `teacher/page.tsx:14` (createCourse) + `:27` (listCoursesForOwner); `education/page.tsx:19` (listPublishedCourses) + `:32` (listPublishedLessons). Remove direct `lmsStore`/`lmsService` map access from the pages.
4. **[Part C / Part E]** Make the storage banner backend-aware (`education/page.tsx:25-26` → driven by `backendMode`); drop the hardcoded "in-memory / Phase 1.5" copy.
5. **[Part C]** Add the PGlite ownership/visibility integration test from Verification (1).
6. **[Part G / docs, non-blocking]** Add an explicit "Part E = THIN model only; full contract deferred to Phase 1.8" note to `docs/EDUCATION_LMS_PLAN.md` (its §18 currently marks the full feature set "Implemented") and soften the "ownership enforced / fail-closed" claims in `packages/lms/src/index.ts:1-6` to match the thin reality.
7. **[Phase 1.8, deferred]** Execute the full-LMS prompt in Finding 7 (teacher_profiles/enrollments/lesson_progress/pinned_links + repos + audit + routes), as its own session.
