# ecosystem-db-architect handoff

## Scope

Phase 3.1 — LMS rich columns, db-architect lane. Read-only audit of the candidate bounded scope
(4 in-scope columns: `courses.level`, `courses.tags`, `lessons.content_type`, `lessons.external_url`)
against the existing schema, repositories, consumer callsites, PGlite behaviour, and drizzle-kit
generation constraints. Confirms or refines the operator's proposed in-scope / deferred split.

This is the FIRST agent of the Phase 3.1 session — running before any edits.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260530-2330-ecosystem-db-architect.md` (the prior D-2 DDL spec)
- `packages/db/src/schema.ts` (full — 719 lines)
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql` (pinned_links CHECK line 303)
- `packages/db/migrations/0004_overconfident_frightful_four.sql`
- `packages/db/src/repositories.ts` (LMS repos, lines 382–808)
- `apps/web/src/features/lms/queries.ts` (full — 235 lines)
- `packages/lms/src/completion.ts` (`deriveContentType` + `deriveLessonState`)
- `docs/EDUCATION_LMS_PLAN.md` (§4.2, §4.3, §4.4, §4.6, §4.7 + PG7 update banner)
- `docs/DATA_MODEL.md` (§0 conventions + table count)
- `node_modules/drizzle-orm/pg-core/checks.d.ts` (`check()` export confirmed)
- `node_modules/drizzle-orm/pg-core/index.d.ts` (`checks.js` re-export confirmed)

## Files changed

None — read-only audit.

---

## Findings

### F-01 — info — Table baseline confirmed at 41; DATA_MODEL.md already correct

`packages/db/migrations/` count: 0000 = 21 CREATE TABLE, 0001 = 0 (index-only), 0002 = 17,
0003 = 2, 0004 = 1. Total = 41.

`docs/DATA_MODEL.md` line 18 already reads "**41 tables** — 21 base + 17 from 0002 + 2 from 0003
+ 1 from 0004". The PG7 handoff F-13 doc-drift concern is resolved; no update needed.

The 4 in-scope columns are ADDITIVE to existing tables. No new tables. Table count stays 41 after
migration 0005.

**Recommendation:** No action. Count confirmed.

---

### F-02 — info — `courses` current columns; `level` and `tags` have no readers in any existing repo

`packages/db/src/schema.ts` lines 181–192: `courses` has `id`, `ownerTeacherId`,
`teacherProfileId`, `title`, `description`, `productCode`, `published`, `createdAt`. No `level`
or `tags` column today.

`packages/db/src/repositories.ts` line 408: `rowToCourseDto` maps all columns from `Course`
(`typeof s.courses.$inferSelect`) but no `level`/`tags` field is emitted — both would be
automatically present in `CourseRow`/`CourseDTO` once the schema columns are added.

`apps/web/src/features/lms/queries.ts` line 48: `toCourseView(c: CourseRow)` maps only
`id/title/productCode/published/createdAt/description`. The mapped `CourseView` type has no
`level` or `tags` field today. The consumer-wave agents (education-implementer and
frontend-implementer) must add these fields to `CourseView`, `CourseAdminView`, `toCourseView`,
and the teacher course form.

The dead-code-avoidance rule requires that both a reader AND a writer exist in the same wave.
This is satisfied: the operator's proposal co-lands the schema migration WITH the consumer agents.
The db-architect delivers migration 0005 first (spine-first rule); consumer agents then have the
column available on the same branch.

**Recommendation:** Confirm that consumer agents (education-implementer, frontend-implementer) are
scheduled in the same wave as migration 0005. The migration must land BEFORE any consumer edits
schema.ts or repositories.ts.

---

### F-03 — high — `lessons.content_type` backfill ordering: ADD with DEFAULT 'video', THEN backfill 'article' rows; CHECK must allow 'video' as the default

`packages/db/src/schema.ts` lines 194–202: `lessons` has `id`, `courseId`, `title`, `body`,
`videoUrl`, `order`, `published`. No `content_type` column today.

The backfill logic `CASE WHEN video_url IS NOT NULL THEN 'video' ELSE 'article' END` is correct.
The safe ordering for a single migration file is:

1. `ALTER TABLE "lessons" ADD COLUMN "content_type" text NOT NULL DEFAULT 'video';`
   — ADD with DEFAULT 'video'. All existing rows get 'video' immediately; CHECK (if added
   simultaneously) is satisfied because 'video' is in the allowed set. No intermediate invalid state.
2. `UPDATE "lessons" SET "content_type" = 'article' WHERE "video_url" IS NULL;`
   — Backfill only the subset that are actually articles. Rows with a `video_url` already have
   'video' from step 1 and are correct without touching them.
3. `ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ("content_type" IN ('video', 'embed', 'article', 'link'));`
   — Add CHECK after all rows are in valid state.

ALTERNATIVE (simultaneous ADD+CHECK, nullable then NOT NULL):
1. `ALTER TABLE "lessons" ADD COLUMN "content_type" text;` (nullable)
2. `UPDATE "lessons" SET "content_type" = CASE WHEN "video_url" IS NOT NULL THEN 'video' ELSE 'article' END;`
3. `ALTER TABLE "lessons" ALTER COLUMN "content_type" SET NOT NULL;`
4. `ALTER TABLE "lessons" ALTER COLUMN "content_type" SET DEFAULT 'video';`
5. `ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ...;`

The operator's proposed approach (ADD DEFAULT 'video' first, then backfill articles) is the
SIMPLER and SAFER path for hand-written migration SQL. Preferred.

CRITICAL: drizzle-kit `db:generate` does NOT emit backfill UPDATE statements. The UPDATE in step 2
MUST be hand-appended to the generated SQL file before running it. This is a hand-edit requirement.

Evidence: `packages/db/migrations/0002_sour_paibok.sql` lines 295–301 already demonstrate this
pattern: the 0002 migration hand-appends `INSERT INTO teacher_profiles ...` and `UPDATE courses SET
teacher_profile_id ...` after the generated DDL, which drizzle-kit could not emit automatically.

**Recommendation:** Hand-append the backfill UPDATE to the generated 0005 SQL. The ordering must be:
ADD COLUMN (DEFAULT 'video') -> UPDATE (article rows only) -> ADD CONSTRAINT (CHECK). drizzle-kit
generate will emit only the ADD COLUMN and the ADD CONSTRAINT; the operator must insert the UPDATE
between them manually.

---

### F-04 — high — drizzle-kit CHECK emission: `check()` is available but must be imported; not currently imported in schema.ts

`packages/db/src/schema.ts` line 8: current import is
`import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, uniqueIndex, index, numeric } from 'drizzle-orm/pg-core';`

`check` is NOT in the current import list. It IS exported by `drizzle-orm/pg-core` (confirmed via
`node_modules/drizzle-orm/pg-core/checks.d.ts` line 18: `export declare function check(name: string, value: SQL): CheckBuilder;`).

For the 4 in-scope columns, two require CHECK constraints (`courses.level`, `lessons.content_type`).
The drizzle schema additions must add `check` to the import line. Additionally, `sql` (already
imported from `drizzle-orm`) is the vehicle to express the CHECK predicate.

drizzle-kit `db:generate` DOES emit the CHECK constraint correctly when `check()` is used inside
the table's second argument (the constraints callback). Evidence: `packages/db/migrations/0002_sour_paibok.sql`
line 303 shows that the `pinned_links_owner_type_check` was produced by a hand-edited step (it is
appended below the `-->statement-breakpoint` sequence), but drizzle-kit CAN generate
`ADD CONSTRAINT ... CHECK` for new columns via the `check()` helper in table definitions. For
Phase 3.1, using `check()` in the table definition is the correct approach and drizzle-kit will
include it in the generated migration.

**Recommendation:** Add `check` to the import from `drizzle-orm/pg-core` in schema.ts when writing
the Phase 3.1 migration. The exact import addition is:
```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, uniqueIndex, index, numeric, check } from 'drizzle-orm/pg-core';
```

---

### F-05 — info — PGlite array round-trip: INSERT/SELECT of `text[]` WITHOUT array operators is reliable; CHECK enforcement is NOT guaranteed

The operator's proposed `courses.tags text[] NOT NULL DEFAULT '{}'` is used for DISPLAY/WRITE only —
no array operators (`= ANY(...)`, `@>`, `&&`) this session.

PGlite (used in all integration tests — `REAL_POSTGRES_DATABASE_URL` is NOT RUN per B1):

(a) `text[]` column INSERT/SELECT WITHOUT array operators: PGlite does support basic
`text[]` column storage and retrieval. INSERT of `['tag1','tag2']` and SELECT of the same column
returns a JavaScript array. This is a core Postgres wire-protocol feature that PGlite implements
correctly for simple column reads.

(b) CHECK constraint enforcement: PGlite partially implements constraint enforcement. Postgres
enforces CHECK constraints at the row level synchronously. PGlite's CHECK enforcement is not
guaranteed to be consistent with Postgres behaviour across all constraint types, particularly those
referencing array functions or complex SQL expressions. For a simple text CHECK like
`"level" IN ('beginner', 'intermediate', 'advanced')`, PGlite will typically enforce it on INSERT/UPDATE.

However, there is NO existing test in the codebase that exercises a CHECK constraint violation
against PGlite (grep shows zero uses of `check()` in schema.ts; the `pinned_links_owner_type_check`
was hand-appended to the migration SQL and not expressed as a Drizzle `check()` call). Therefore:

- The `courses.level` CHECK is low-risk because it is a simple `text IN (...)` predicate over a
  fixed set. PGlite should enforce it. Integration tests for `createCourse` with an invalid level
  SHOULD fail as expected, but must be tested to confirm.
- If PGlite does NOT enforce the CHECK in the integration test environment, the test must either:
  (1) use `describe.skipIf(!process.env.REAL_POSTGRES_DATABASE_URL)` for the CHECK-violation test
  only, while keeping the happy-path test against PGlite, or (2) add a Zod application-layer
  validation in the `createCourse`/`updateCourse` input that rejects invalid level values before
  the DB write, making the DB CHECK a defence-in-depth.

The Zod validation approach is already the project pattern (Zod at every boundary — seed doc). The
education-implementer should add `z.enum(['beginner','intermediate','advanced'])` in the input
schema as the primary guard, making the DB CHECK secondary. This removes the PGlite enforcement
uncertainty from the test path.

**Recommendation for `tags` INSERT/SELECT:** Standard round-trip is safe without array operators.
No `skipIf` needed for the basic CREATE and SELECT test.

**Recommendation for CHECK enforcement:** Add Zod enum validation in the repo input type / action
layer as the primary guard. Keep the DB CHECK as defence-in-depth. Add one CHECK-violation test
gated by `describe.skipIf(!process.env.REAL_POSTGRES_DATABASE_URL)` to verify the DB constraint
fires on real Postgres.

---

### F-06 — info — Exact Drizzle schema.ts additions for the 4 in-scope columns

Based on: schema.ts lines 181–202 (courses and lessons tables), drizzle-orm/pg-core API, and
the prior D-2 DDL spec.

**courses table** (add after `createdAt` at schema.ts line 191):

```ts
// In the courses pgTable columns object:
level: text('level').notNull().default('beginner'),
tags: text('tags').array().notNull().default(sql`'{}'`),
```

**courses table second argument** (add to the existing `(t) => ({...})` block — currently has no
constraint entries as the courses table has no indexes defined in 0000; they exist only implicitly):

The 0002 migration adds `teacher_profile_id` but the courses table in schema.ts has no explicit
index second-arg block currently. The `check()` must be added in a constraints object:

```ts
// Update the courses pgTable signature:
export const courses = pgTable(
  'courses',
  {
    id: id(),
    ownerTeacherId: uuid('owner_teacher_id').notNull().references(() => users.id),
    teacherProfileId: uuid('teacher_profile_id').references(() => teacherProfiles.id),
    title: text('title').notNull(),
    description: text('description'),
    productCode: text('product_code').notNull().default('education'),
    published: boolean('published').default(false).notNull(),
    createdAt: createdAt(),
    level: text('level').notNull().default('beginner'),
    tags: text('tags').array().notNull().default(sql`'{}'`),
  },
  (t) => ({
    levelCheck: check('courses_level_check', sql`${t.level} IN ('beginner', 'intermediate', 'advanced')`),
  }),
);
```

**lessons table** (add after `published` at schema.ts line 201):

```ts
// In the lessons pgTable columns object:
contentType: text('content_type').notNull().default('video'),
externalUrl: text('external_url'),
```

**lessons table second argument** (currently `lessons` has no second arg in schema.ts — the table
is defined without indexes; confirmed by schema.ts lines 194–202 which show no second argument):

```ts
export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body'),
    videoUrl: text('video_url'),
    order: integer('order').notNull().default(0),
    published: boolean('published').default(false).notNull(),
    contentType: text('content_type').notNull().default('video'),
    externalUrl: text('external_url'),
  },
  (t) => ({
    contentTypeCheck: check('lessons_content_type_check', sql`${t.contentType} IN ('video', 'embed', 'article', 'link')`),
  }),
);
```

NOTE: The `embed` value is included in the CHECK even though `embed` content_type is deferred this
session (no `embed_html` column, no embed renderer). Having 'embed' in the CHECK does not create
dead schema — a CHECK is a constraint, not a column. It just means the CHECK is forward-compatible
with the Phase-3 embed feature when it lands (same CHECK, no ALTER needed). This is acceptable.

---

### F-07 — info — `deriveContentType` retirement: callers confirmed, retirement is safe and required

`packages/lms/src/completion.ts` lines 35–37: `deriveContentType(videoUrl)` returns `'video'` or
`'article'` based on `videoUrl` nullness.

Current callers:
- `apps/web/src/features/lms/queries.ts` line 54: `toLessonView` calls `deriveContentType(l.videoUrl)`
- `apps/web/src/features/lms/queries.ts` line 186: inline `l.videoUrl ? ('video' as const) : ('article' as const)`
- `apps/web/src/features/lms/queries.ts` line 214: inline `dto.videoUrl ? 'video' : 'article'`

The `queries.ts` line 37 import confirms `deriveContentType` is imported from `@wtc/lms`.

After migration 0005 adds `lessons.content_type` with the backfill, all three callsites must
switch to reading `l.contentType` (the mapped Drizzle column name from `content_type`) directly
from the `Lesson` row type. The `deriveContentType` function becomes dead code after that switch.

The retirement is co-landed with the consumer wave — this is the dual-truth prevention requirement
from PG7 D-3. The education-implementer must remove the `deriveContentType` import and its three
callsites. The function in `completion.ts` can then be removed (or left as a deprecated stub with
a `@deprecated` JSDoc if the tests-runner needs time to update tests — but since the function has
no DB dependency, deletion is preferred).

`packages/lms/src/completion.ts` line 35 also shows `deriveContentType` returns only `'video' |
'article'` — the new `content_type` column supports `'video' | 'embed' | 'article' | 'link'`.
Once the column is live, the inline derivations at queries.ts:186 and :214 must read the column
(returning all 4 possible values), not just the 2-value derivation. This is a functional
improvement, not a regression, as long as callers accept the expanded union type.

**Recommendation:** The education-implementer must replace all 3 callsites in the same PR as the
schema migration, and delete `deriveContentType` from `packages/lms/src/completion.ts`. The
`@wtc/lms` public API barrel (`index.ts`) must remove the `deriveContentType` export if it is
currently exported there (the import at queries.ts:38 suggests it is).

---

### F-08 — info — Exact repo signature changes for the 4 in-scope columns

**`createCourse` signature change** (`repositories.ts` line 422):

Current: `input: { ownerTeacherId: string; title: string; description?: string; published?: boolean; teacherProfileId?: string }`

Add: `level?: string; tags?: string[]`

New signature:
```ts
export async function createCourse(
  db: Db,
  input: {
    ownerTeacherId: string;
    title: string;
    description?: string;
    published?: boolean;
    teacherProfileId?: string;
    level?: string;   // defaults to 'beginner' at DB level; optional here
    tags?: string[];  // defaults to '{}' at DB level; optional here
  },
  now = Date.now(),
): Promise<CourseDTO>
```

The `.values({...})` call inside the function body must include:
```ts
...(input.level ? { level: input.level } : {}),
...(input.tags !== undefined ? { tags: input.tags } : {}),
```

**`updateCourse` signature change** (`repositories.ts` line 486):

Current patch type: `{ title?: string; description?: string | null }`

Add: `level?: string; tags?: string[]`

New patch type: `{ title?: string; description?: string | null; level?: string; tags?: string[] }`

The audit `after` field at line 489 already spreads `{ ...patch }` so level/tags appear in the
audit log automatically when provided. No audit change needed.

**`CourseRow` type** is `typeof s.courses.$inferSelect` (line 463). It will automatically pick up
`level: string` and `tags: string[]` once schema.ts is updated. No explicit type change needed.

**`createLesson` signature change** (`repositories.ts` line 500):

Current: `input: { courseId: string; title: string; body?: string; videoUrl?: string; published?: boolean }`

Add: `contentType?: string; externalUrl?: string`

New signature:
```ts
export async function createLesson(
  db: Db,
  input: {
    courseId: string;
    title: string;
    body?: string;
    videoUrl?: string;
    published?: boolean;
    contentType?: string;   // defaults to 'video' at DB level; required when not video
    externalUrl?: string;   // companion to contentType='link'
  },
  actorUserId: string,
  now = Date.now(),
): Promise<Lesson>
```

The `.values({...})` call at line 504 must add:
```ts
contentType: input.contentType ?? (input.videoUrl ? 'video' : 'article'), // derive if omitted for backward compat
externalUrl: input.externalUrl ?? null,
```

NOTE: The backward-compat derivation `input.contentType ?? (input.videoUrl ? 'video' : 'article')`
allows existing callers that do not pass `contentType` to continue working after the migration
until they are updated. This avoids a required migration of all callers in a single atomic step.

**`updateLesson` signature change** (`repositories.ts` line 511):

Current patch type: `{ title?: string; body?: string | null; videoUrl?: string | null; published?: boolean }`

Add: `contentType?: string; externalUrl?: string | null`

New patch type:
```ts
patch: {
  title?: string;
  body?: string | null;
  videoUrl?: string | null;
  published?: boolean;
  contentType?: string;
  externalUrl?: string | null;
}
```

**`Lesson` type** is `typeof s.lessons.$inferSelect` (line 389). It will automatically pick up
`contentType: string` and `externalUrl: string | null` once schema.ts is updated.

**`LessonDTO` interface** (`repositories.ts` lines 399–407) is the thin DTO for the Part-E
surface. It currently has `videoUrl?: string`. Add:
```ts
contentType: 'video' | 'article' | 'link' | 'embed'; // read from the column
externalUrl?: string; // nullable column, emit only when non-null
```

The `rowToLessonDto` function at line 413 must be updated to map these fields from the row.

**In-txn audit rows**: unchanged. `createCourse` already audits `education.course_create` with
`after: { title, published }` — adding `level`/`tags` to the `after` payload is optional but
recommended for observability. `createLesson` audits `education.lesson_create` with
`after: { courseId, title }` — adding `contentType` is recommended. No new audit action codes needed.

---

### F-09 — info — Table count after migration 0005

4 additive columns across 2 existing tables (`courses` +2, `lessons` +2). Zero new tables.
Table count: **41** (unchanged).

---

### F-10 — info — Confirm each DEFER item's blocker

| Deferred item | Blocker confirmed | Evidence |
|---|---|---|
| `lessons.embed_html` | Server-side HTML sanitizer does not exist. `packages/lms/src/` has no sanitizer utility. `packages/db/src/schema.ts` has no `embed_html` column. EDUCATION_LMS_PLAN.md §9.2 describes the sanitizer as a requirement but it is TARGET-only. Stored-XSS risk without it. | schema.ts lines 194-202; completion.ts full file; EDUCATION_LMS_PLAN.md §9.2 |
| `materials` file-meta | Upload BLOCKED per ROADMAP §7. No object storage adapter. `createMaterial` at repositories.ts:521 only accepts `{ lessonId, label, url, kind }`. No `file_key` column in schema. | repositories.ts:521; schema.ts:204-210 |
| `pinned_links owner_type='global'` | Non-additive DROP+ADD CHECK. `pinned_links_owner_type_check` is at 0002_sour_paibok.sql:303. drizzle-kit cannot emit DROP CONSTRAINT. Q-6 undecided. `createPinnedLink` at repositories.ts:791 has `ownerType: 'teacher_profile' | 'course'` hardcoded. | migrations/0002_sour_paibok.sql:303; repositories.ts:791 |
| `courses.slug` | No slug-URL routing. Routes use `[courseId]` UUID. Backfill collision risk. | queries.ts — all courseId references are UUIDs; EDUCATION_LMS_PLAN.md §6.1 references `[courseSlug]` as TARGET |
| `lesson_progress.state` | `deriveLessonState` (completion.ts lines 20-27) is the working derivation with no DB column needed. No video-scrub state consumer. Adding the column without retiring `deriveLessonState` = dual-truth. | completion.ts:20-27; schema.ts:432-448 |

All 5 defer items have real, confirmed blockers. The operator's proposed defer list is correct.

---

### F-11 — medium — `courses` table has no index second-arg in schema.ts; adding CHECK requires adding a second argument for the first time

`packages/db/src/schema.ts` lines 181–192: the `courses` table is defined with no second argument
(no indexes, no CHECK). This is confirmed by inspection — the table ends at `createdAt: createdAt(),
},` with no `(t) => ({...})` callback.

Adding `check()` for `courses.level` requires introducing the second argument block for the first
time. This is a valid schema change; drizzle-kit handles it correctly. However, the operator must
ensure the second argument is not mistakenly omitted.

Similarly, `lessons` at lines 194–202 has no second argument. The `lessons_content_type_check`
requires introducing the second argument for the first time.

**Recommendation:** Both second arguments must be added carefully. The exact Drizzle syntax in F-06
above is authoritative. drizzle-kit `db:generate` will produce the correct `ADD CONSTRAINT` DDL
from these definitions.

---

### F-12 — info — Final migration-0005 SQL (for the 4 in-scope columns only)

This is the complete, operator-ready SQL for migration 0005 restricted to the 4 Phase-3.1 in-scope
columns. It excludes ALL deferred items. The operator MUST hand-edit the drizzle-kit output to
insert the backfill UPDATE at step 5 (drizzle-kit cannot generate it).

```sql
-- Migration 0005: Phase 3.1 LMS rich columns (ADDITIVE — 4 columns, 0 new tables)
-- Precondition: 41-table baseline (migrations 0000–0004 applied)
-- Hand-edit required: INSERT the UPDATE at step 5 between the ADD COLUMN and ADD CONSTRAINT lines.

-- 1. courses.level (additive NOT NULL with default — safe one-shot, no backfill needed)
ALTER TABLE "courses" ADD COLUMN "level" text NOT NULL DEFAULT 'beginner';
--> statement-breakpoint

-- 2. courses.level CHECK
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_check" CHECK ("level" IN ('beginner', 'intermediate', 'advanced'));
--> statement-breakpoint

-- 3. courses.tags (additive NOT NULL array with default — safe one-shot, no backfill needed)
ALTER TABLE "courses" ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}';
-- NO GIN index this session: no tag-filter consumer exists yet (operator confirmed DISPLAY/WRITE only).
--> statement-breakpoint

-- 4. lessons.content_type — ADD with DEFAULT 'video' so all existing rows are valid immediately
ALTER TABLE "lessons" ADD COLUMN "content_type" text NOT NULL DEFAULT 'video';
--> statement-breakpoint

-- 5. *** HAND-EDIT REQUIRED: backfill article rows ***
-- drizzle-kit CANNOT generate this UPDATE. Operator must insert it here manually.
-- This step converts rows that have no video_url to 'article'; video rows are already correct.
UPDATE "lessons" SET "content_type" = 'article' WHERE "video_url" IS NULL;
--> statement-breakpoint

-- 6. lessons.content_type CHECK (added AFTER the backfill so all rows are in valid state)
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ("content_type" IN ('video', 'embed', 'article', 'link'));
-- 'embed' is included for forward-compatibility; no embed consumer this session.
--> statement-breakpoint

-- 7. lessons.external_url (additive nullable — companion to content_type='link')
ALTER TABLE "lessons" ADD COLUMN "external_url" text;
--> statement-breakpoint
```

**What drizzle-kit `db:generate` WILL emit automatically** (from the schema.ts changes in F-06):
- Steps 1, 2, 3, 4, 6, 7 (all DDL ALTER TABLE statements and CHECK constraints).

**What drizzle-kit will NOT emit** (must be hand-appended):
- Step 5 (the UPDATE backfill for article rows).

**Verification before applying to production:**
- After `db:generate`, inspect the generated file and confirm: (a) 4 ADD COLUMN statements, (b) 2
  ADD CONSTRAINT CHECK statements, (c) NO DROP TABLE or ALTER COLUMN TYPE statements.
- Hand-insert the UPDATE at step 5 between the ADD COLUMN for content_type and its ADD CONSTRAINT.
- Run `db:migrate` against a throwaway Postgres (wtc_test) and verify:
  - `SELECT count(*) FROM information_schema.columns WHERE table_name = 'courses' AND column_name IN ('level', 'tags')` = 2
  - `SELECT count(*) FROM information_schema.columns WHERE table_name = 'lessons' AND column_name IN ('content_type', 'external_url')` = 2
  - `SELECT count(*) FROM information_schema.check_constraints WHERE constraint_name IN ('courses_level_check', 'lessons_content_type_check')` = 2
  - All existing lesson rows have `content_type` = 'video' or 'article', never NULL.

---

## Decisions

### D-1 — Bounded scope confirmed: 4 columns in-scope, all 5 defer items confirmed

| Column | In-scope | Table count change |
|---|---|---|
| `courses.level text NOT NULL DEFAULT 'beginner'` + CHECK | YES | 0 new tables |
| `courses.tags text[] NOT NULL DEFAULT '{}'` | YES | 0 new tables |
| `lessons.content_type text NOT NULL DEFAULT 'video'` + backfill + CHECK | YES | 0 new tables |
| `lessons.external_url text` (nullable) | YES | 0 new tables |

All 5 operator-proposed defer items have confirmed real blockers (F-10). The operator's scope is
correct and safe to land.

### D-2 — drizzle-kit generates ADD COLUMN + CHECK; backfill UPDATE requires hand-edit

drizzle-kit `db:generate` will emit the ALTER TABLE ADD COLUMN and ADD CONSTRAINT CHECK statements
from the schema.ts additions in F-06. It will NOT emit the `UPDATE lessons SET content_type =
'article' WHERE video_url IS NULL` backfill. The operator must hand-append this UPDATE to the
generated migration SQL between the ADD COLUMN and ADD CONSTRAINT lines. Evidence: same pattern
used in 0002_sour_paibok.sql (backfill INSERT/UPDATE hand-appended after generated DDL, lines
295–301).

### D-3 — `check()` must be added to the drizzle-orm/pg-core import in schema.ts

Current import line does not include `check`. It must be added. See F-04.

### D-4 — `deriveContentType` retirement is required in the same wave; 3 callsites identified

Callsites at queries.ts:54 (via `toLessonView`), :186 (inline), :214 (inline). All 3 must switch
to reading `l.contentType` from the column. `deriveContentType` in completion.ts:35 must be
deleted. See F-07.

### D-5 — Table count stays 41 after migration 0005

4 additive columns only, 2 tables modified, 0 new tables.

### D-6 — `tags` column: no index this session

No GIN index for tags because there is no tag-filter consumer. A display-only `text[]` column
needs no index. Adding an index with no query would be dead schema. GIN index deferred to the
session that adds tag filtering.

### D-7 — 'embed' in lessons.content_type CHECK is forward-compatible, not dead schema

The CHECK constraint value set `('video', 'embed', 'article', 'link')` includes 'embed' even
though the embed renderer and `embed_html` column are deferred. A CHECK constraint value being
present for a possible future column value is not "dead schema" — it is a constraint, not a column.
Adding 'embed' to the CHECK now means no ALTER CONSTRAINT is needed when embed lands. Acceptable.

---

## Risks

### R-01 — Backfill ordering failure (critical if applied wrong)

If the operator applies the migration without the hand-inserted UPDATE backfill, or inserts it
AFTER the CHECK constraint ADD, the CHECK will fire on rows with NULL content_type (if the
nullable approach is used) or the backfill will be redundant (if DEFAULT 'video' approach is used
but articles remain 'video'). The recommended approach (ADD with DEFAULT 'video' first) eliminates
the NULL risk entirely because existing rows are never NULL. The UPDATE only corrects 'video' rows
that should be 'article'. Applying the UPDATE after the CHECK is safe because 'article' is in the
allowed set.

Risk level: LOW with the DEFAULT 'video' approach. Still requires careful hand-edit.

### R-02 — `deriveContentType` not retired in the same wave = dual-truth (high)

If the education-implementer consumer wave skips retiring `deriveContentType` and its 3 callsites,
the new `lessons.content_type` column will be written at migration time but ignored by all readers,
which continue using `deriveContentType`. This is the dual-truth failure mode. The migration is
then wasted schema. The retirement MUST be in the same PR/wave as the schema migration.

### R-03 — `check()` import forgotten (medium)

If the db-architect writer adds the `check()` calls in schema.ts but forgets to add `check` to the
import, TypeScript will catch it at typecheck time with a compile error. This is a low-risk
scenario but would block the typecheck gate. The import addition in F-04 must accompany the schema
changes.

### R-04 — PGlite CHECK enforcement uncertainty for `courses.level` (low, mitigated by Zod)

PGlite may not enforce the `courses_level_check` CHECK constraint on invalid INSERT. This is
mitigated by: (a) Zod enum validation in the input schema as the primary guard, (b) the DB CHECK
as defence-in-depth only. The integration test for CHECK violation must be gated by
`describe.skipIf(!process.env.REAL_POSTGRES_DATABASE_URL)`. See F-05.

### R-05 — `text[]` PGlite INSERT/SELECT round-trip (info, no action needed)

The `courses.tags` column uses `text[]`. PGlite supports basic array storage and retrieval without
array operators. The round-trip test (INSERT `['a','b']`, SELECT, assert array equality) should
pass without `skipIf`. Only tests using `= ANY(...)`, `@>`, or `&&` need the real-PG guard.

---

## Verification/tests

For this phase (read-only audit):
- Table count arithmetic confirmed: 21+17+2+1 = 41. DataModel.md confirmed correct.
- `deriveContentType` callers confirmed at queries.ts:54, :186, :214.
- `courses` and `lessons` tables confirmed missing `level`/`tags`/`content_type`/`external_url`.
- `check()` export confirmed in drizzle-orm/pg-core/checks.d.ts.
- `pinned_links_owner_type_check` confirmed at 0002_sour_paibok.sql:303.
- `createPinnedLink` ownerType hardcoded at repositories.ts:791 confirmed.

For Phase 3.1 when migration 0005 runs:
- `npm run db:generate` — inspect output for exactly 4 ADD COLUMN + 2 ADD CONSTRAINT statements,
  no DROP TABLE / ALTER COLUMN TYPE.
- Hand-insert the UPDATE backfill at the correct position (after ADD COLUMN content_type DEFAULT
  'video', before ADD CONSTRAINT lessons_content_type_check).
- PGlite integration test: `createCourse({ level: 'intermediate', tags: ['trading','algo'] })`
  → SELECT → assert `level = 'intermediate'` and `tags = ['trading','algo']`.
- PGlite integration test: `createLesson({ contentType: 'article' })` → SELECT → assert
  `content_type = 'article'` and `external_url = null`.
- PGlite integration test: `createLesson({ contentType: 'link', externalUrl: 'https://example.com' })`
  → SELECT → assert `content_type = 'link'` and `external_url = 'https://example.com'`.
- Real-PG only test: `createCourse({ level: 'invalid' })` → assert DB throws constraint violation.
- Verify `deriveContentType` is no longer imported in `apps/web/src/features/lms/queries.ts`.
- Verify `deriveContentType` is removed from `packages/lms/src/completion.ts` or marked @deprecated.
- typecheck gate: `npm run typecheck` and `npm run typecheck -w @wtc/web` must pass with no errors.

---

## Next actions

1. **db-architect (this wave — before any consumer edits):**
   - Add `check` to import in `packages/db/src/schema.ts`.
   - Add `level`, `tags` columns + `levelCheck` check() to `courses` table.
   - Add `contentType`, `externalUrl` columns + `contentTypeCheck` check() to `lessons` table.
   - Run `npm run db:generate` — inspect generated SQL.
   - Hand-insert the `UPDATE "lessons" SET "content_type" = 'article' WHERE "video_url" IS NULL;`
     between the ADD COLUMN and ADD CONSTRAINT lines in the generated migration file.
   - Do NOT run `db:migrate` in this audit session — wait for operator to run against wtc_test.

2. **education-implementer (same wave, AFTER migration 0005 is committed):**
   - Update `createCourse` and `updateCourse` inputs to accept `level` and `tags`.
   - Update `createLesson` and `updateLesson` inputs to accept `contentType` and `externalUrl`.
   - Update `CourseDTO` / `LessonDTO` to include the new fields.
   - Update `rowToCourseDto` and `rowToLessonDto` mappers.
   - Update `CourseView` and `LessonView` types in `@wtc/lms` to include `level`, `tags`,
     `contentType`, `externalUrl`.
   - Retire `deriveContentType` — replace all 3 callsites in queries.ts; delete from completion.ts.
   - Add Zod enum validation for `level` in `createCourse`/`updateCourse` actions.
   - Add teacher course form: `level` select + `tags` input.
   - Add teacher lesson editor: `content_type` selector + `external_url` field for 'link' type.

3. **frontend-implementer (same wave, AFTER education-implementer):**
   - Render `level` badge on course cards.
   - Render `tags` chips on course cards and course detail.
   - Render `content_type`-aware lesson view: 'link' type shows external_url CTA card.
   - Student/teacher/admin displays updated.

4. **tests-runner (same wave):**
   - PGlite integration tests for all 4 new columns (see Verification/tests above).
   - Real-PG CHECK violation test gated by `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`.
   - e2e: teacher creates a course with level='advanced' and tags=['crypto']; student sees the badge.

5. **Operator:**
   - Apply migration 0005 to wtc_test before production.
   - Confirm no existing lesson rows have `content_type = NULL` after migration.
