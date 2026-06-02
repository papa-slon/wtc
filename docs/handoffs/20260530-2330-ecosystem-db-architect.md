# ecosystem-db-architect handoff

## Scope

PG7 — DB-architect lane: schema/migration boundedness audit for the rich LMS migration candidate (0005).
Read-only inspection of `packages/db/src/schema.ts`, `packages/db/migrations/` (0000–0004),
`packages/db/src/repositories.ts`, `docs/DATA_MODEL.md`, `docs/DOMAIN_MODEL.md`,
`docs/EDUCATION_LMS_PLAN.md`, and `apps/web/src/features/lms/actions.ts` (consumer side).

## Files inspected

- `packages/db/src/schema.ts` (full — 700+ lines)
- `packages/db/migrations/0000_broken_jack_murdock.sql` (21 CREATE TABLE statements)
- `packages/db/migrations/0001_early_toad_men.sql` (0 CREATE TABLE; DROP+CREATE UNIQUE INDEX on entitlements)
- `packages/db/migrations/0002_sour_paibok.sql` (17 CREATE TABLE + 1 ALTER + backfill + CHECK)
- `packages/db/migrations/0003_fresh_blockbuster.sql` (2 CREATE TABLE + indexes + 1 unique index on subscriptions)
- `packages/db/migrations/0004_overconfident_frightful_four.sql` (1 CREATE TABLE + 2 indexes)
- `packages/db/src/repositories.ts` (full — LMS repos at lines 382–808)
- `apps/web/src/features/lms/actions.ts` (full — consumer side)
- `apps/web/src/features/lms/queries.ts` (full — view-model layer)
- `packages/lms/src/completion.ts` (deriveContentType / deriveLessonState implementations)
- `packages/audit/src/audit.ts` (AUDIT_ACTIONS list)
- `docs/DATA_MODEL.md` (first 280 lines)
- `docs/DOMAIN_MODEL.md` (LMS sections)
- `docs/EDUCATION_LMS_PLAN.md` (sections 1–6, tables 4.1–4.7)
- `docs/STATUS.md`, `docs/EXECUTION_PLAN_MASTER.md`, `docs/ROADMAP_MASTER.md` (§7)
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md` (aggregate)

## Files changed

None — read-only audit.

## Findings

### F-01 — info — Table baseline confirmed at 41

Migration math: 0000 = 21 tables, 0001 = 0 tables (index-only ALTER), 0002 = 17 new tables,
0003 = 2 new tables (billing_webhook_events, billing_manual_review_items), 0004 = 1 new table
(axioma_handoff_jti_revocations). Total = 21 + 17 + 2 + 1 = **41 tables**. Confirmed correct.
Evidence: `packages/db/migrations/` — grep counts 21/0/17/2/1 CREATE TABLE per file respectively.

**Recommendation:** No action. Baseline confirmed.

**Target area:** Schema baseline verification.

---

### F-02 — info — Migrations 0000–0004 untouched and sequentially correct

0000 contains the original 21 tables (audit_logs, axioma_account_links, bot_configs, bot_instances,
courses, entitlements, exchange_accounts, exchange_api_key_secrets, integration_health_checks,
job_queue, lessons, materials, plans, products, roles, sessions, subscriptions,
tradingview_access_requests, tradingview_access_tasks, user_roles, users).
0001 drops + recreates entitlements_user_product_idx as UNIQUE (correct Phase 1.5 migration).
0002 adds 17 tables + 1 ALTER (courses.teacher_profile_id) + teacher_profiles backfill + pinned_links CHECK.
0003 adds billing_webhook_events + billing_manual_review_items + subscriptions unique index + audit composite index.
0004 adds axioma_handoff_jti_revocations (uuid PK caller-supplied, no FK on sub, 2 indexes).
None of the five files was modified post-generation.

**Recommendation:** No action. All five migrations are pristine.

**Target area:** Migration integrity.

---

### F-03 — info — audit_logs.result column confirmed present (throw+audit fix needs NO schema change)

`packages/db/migrations/0000_broken_jack_murdock.sql` line 14: `"result" text DEFAULT 'success' NOT NULL`.
`packages/db/src/schema.ts` lines 228–229: `result: text('result').notNull().default('success')`.
The PG7 RBAC-failure → throw+audit workstream (owner: education-implementer) can write a DENIED audit
row immediately using the existing `result` field set to `'failure'` and an existing `education.*` audit code.
No schema change is required for that workstream.

**Recommendation:** Confirm to education-implementer and security-auditor: zero schema change needed for
the throw+audit fix. Use `result: 'failure'` on the existing `audit_logs.result` column with an existing
audit code (e.g. `'education.course_update'` or a new denial code). If a new denial-specific audit code
is desired (e.g. `'education.access_denied'`), it goes into `packages/audit/src/audit.ts` AUDIT_ACTIONS
only — no DB migration required.

**Target area:** Throw+audit workstream schema dependency.

---

### F-04 — critical — pinned_links CHECK constraint blocks 'global' owner_type — NOT purely additive

`packages/db/migrations/0002_sour_paibok.sql` line 303:
`ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_owner_type_check" CHECK ("owner_type" IN ('teacher_profile', 'course'));`

The EDUCATION_LMS_PLAN.md §4.7 describes `owner_type = 'global'` (admin-created links visible to all
students). The current CHECK constraint explicitly excludes `'global'`. Adding `'global'` support in
migration 0005 would require:

```sql
ALTER TABLE "pinned_links" DROP CONSTRAINT "pinned_links_owner_type_check";
ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_owner_type_check" CHECK ("owner_type" IN ('teacher_profile', 'course', 'global'));
```

This is **NOT purely additive**: it is a DROP+ADD CONSTRAINT sequence. While Postgres allows this
atomically in a single transaction, drizzle-kit's migration generator does not emit a DROP CONSTRAINT
statement for an existing check — drizzle-kit treats CHECK constraints as additive-only and will emit
a second `ADD CONSTRAINT` with a different name, leaving the old constraint in place. The result is
TWO conflicting CHECK constraints on the same column. This requires a hand-edited migration.

Additionally, the `pinned_links` repo `createPinnedLink` in `repositories.ts` line 791 has the type
`'teacher_profile' | 'course'` hardcoded in the function signature — it would also require a TS change.
There is no UI consumer for `global` owner_type today; the ROADMAP_MASTER §7 marks it "NEXT / needs
Q-6 bundling decision". The consumer is NOT present this phase.

**Recommendation:** Do NOT include `pinned_links.owner_type = 'global'` in migration 0005. The CHECK
change is non-additive and requires a hand-edited migration + drizzle-kit constraint name management.
The consumer is absent (Phase-3). Document as a Phase-3 item: DROP + ADD CHECK in a hand-edited step,
then add the repo + UI consumer in the same wave.

**Target area:** Migration 0005 safety boundary / pinned_links.

---

### F-05 — high — course slug: bounded verdict = Phase-3 (no consumer present)

EDUCATION_LMS_PLAN.md §4.2 specifies `slug text NOT NULL UNIQUE` on courses. Current schema has no
`slug` column. A slug-based URL routing consumer (e.g. `/app/education/[slug]`) does NOT exist in
`apps/web` — the existing routes use `courseId` (UUID) as the path parameter (`/app/education/[courseId]`).

Schema addition is straightforward:
```sql
ALTER TABLE "courses" ADD COLUMN "slug" text;
-- backfill: UPDATE "courses" SET "slug" = 'course-' || REPLACE(CAST("id" AS text), '-', '') WHERE "slug" IS NULL;
CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
-- then ALTER TABLE "courses" ALTER COLUMN "slug" SET NOT NULL; (after backfill confirms no NULLs)
```

BUT: the backfill-then-NOT-NULL step is a two-phase migration (or requires GENERATED ALWAYS AS / DEFAULT
expression in a single migration). Collision risk: if courses.title is non-unique, a title-derived slug
collides. The safe single-migration approach is `slug = id::text` (guaranteed unique, ugly URLs) or
`slug = lower(regexp_replace(title, '[^a-z0-9]+', '-', 'g')) || '-' || id` (slug + UUID suffix).
Neither approach has a confirmed consumer in the current UI.

Dead-code-avoidance discipline (PG4 checkout, PG6 signer resolver precedent): adding a schema column
with no reader or writer in the current phase introduces dead schema.

**Recommendation:** Phase-3. Spec is in EDUCATION_LMS_PLAN.md §4.2. Ready-to-run DDL (see §Decisions
below). Do NOT include in migration 0005.

**Target area:** Migration 0005 boundedness / courses.slug.

---

### F-06 — high — course level/tags: bounded verdict = Phase-3 (no consumer present)

EDUCATION_LMS_PLAN.md §4.2 specifies `level text NOT NULL default 'beginner'` with values
`beginner | intermediate | advanced` and `tags text[] NOT NULL default '{}'`.

Current `courses` table has neither column. Current repos and UI layer have no `level` or `tags`
consumer: `listPublishedCourses` at `repositories.ts:448` does a plain `SELECT * FROM courses WHERE
published = true` with no level/tag filter. `queries.ts:loadStudentCatalogue` at line 154 forwards that
with no level/tag field in `CourseView`. No filter UI exists for these fields.

Drizzle supports `text[]` via `text('tags').array()` but PGlite support for Postgres arrays is limited
(PGlite does not implement `ANY($1::text[])` array operators reliably). This means any PGlite-backed
integration test using array operators would need a skipIf guard, reducing test confidence.

**Recommendation:** Phase-3. Both columns are dead schema without a filter consumer. The safe DDL:
```sql
ALTER TABLE "courses" ADD COLUMN "level" text NOT NULL DEFAULT 'beginner';
ALTER TABLE "courses" ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}';
-- CHECK: ALTER TABLE "courses" ADD CONSTRAINT "courses_level_check" CHECK ("level" IN ('beginner', 'intermediate', 'advanced'));
CREATE INDEX "courses_level_idx" ON "courses" USING btree ("level");
-- tags: GIN index when a tag-filter consumer exists
```
Do NOT include in migration 0005.

**Target area:** Migration 0005 boundedness / courses.level + courses.tags.

---

### F-07 — high — lesson content_type: bounded verdict = Phase-3 (derivation already consumed)

EDUCATION_LMS_PLAN.md §4.3 specifies a `content_type text NOT NULL` column on `lessons` with values
`video | embed | article | link`.

Currently `deriveContentType(videoUrl)` in `packages/lms/src/completion.ts` line 35 derives the type
from the `videoUrl` column: `videoUrl ? 'video' : 'article'`. This function is consumed in:
- `queries.ts` line 54: `contentType: deriveContentType(l.videoUrl)`
- `queries.ts` line 186 (inline)
- `queries.ts` line 214 (inline)

Adding a `content_type` column would:
1. Need a backfill: `UPDATE lessons SET content_type = CASE WHEN video_url IS NOT NULL THEN 'video' ELSE 'article' END`
2. Create a dual-source-of-truth problem: `deriveContentType` still reads `videoUrl`, so the column
   and the derivation must stay in sync — unless all callers are migrated to read the column directly.
   The migration of all callers is a Phase-3 UI refactor (embed player, external link lesson type).
3. The `embed` and `link` content types have no UI consumer today.

Dead schema risk: adding the column without migrating callers away from `deriveContentType` creates
a column that is written at backfill time only, then ignored by all readers (they still call `deriveContentType`).

**Recommendation:** Phase-3. Keep `deriveContentType` as the single source of truth for now. Include
in 0005 spec (see §Decisions). Do NOT include in migration 0005.

**Target area:** Migration 0005 boundedness / lessons.content_type.

---

### F-08 — high — embed_html: bounded verdict = Phase-3 (no consumer + security note)

EDUCATION_LMS_PLAN.md §4.3 specifies `embed_html text` on `lessons` for iframe/embed content.

No `embed_html` consumer exists in the current UI. The spec notes: "Raw HTML from teacher input is
never rendered without sanitization." A server-side HTML sanitizer (DOMPurify-Node or a Rust WASM
cleaner) is NOT currently present in `packages/lms` or `apps/web`. Adding the column without the
sanitizer would produce a stored-XSS risk the moment any UI renders it.

The upload security review (BLOCKED per ROADMAP §7 and PRODUCTION_BLOCKERS) applies to the broader
embedded-content concern — the same review should cover embed HTML sanitization policy.

**Recommendation:** Phase-3. Do NOT add `embed_html` to any migration until a sanitizer is wired and
audited. The sanitizer must be in `packages/lms` (server-side, not client-side). Flag this as a
security gate, not just a feature gap.

**Target area:** Migration 0005 boundedness / lessons.embed_html.

---

### F-09 — high — material file-meta (size_bytes/mime_type/storage_key): bounded verdict = Phase-3 (upload BLOCKED)

EDUCATION_LMS_PLAN.md §4.4 specifies `file_key text`, `file_name text`, `file_size_bytes bigint`,
`mime_type text` on `materials`. Current schema has only `label text`, `url text`, `kind text`.

ROADMAP_MASTER.md §7: "Material file upload (object storage) — BLOCKED — needs upload security review."
PRODUCTION_BLOCKERS.md does not list an explicit blocker number for this (it is implied by B7 and the
upload security review), but the ROADMAP marks it BLOCKED. No object storage client exists in any
package. `createMaterial` at `repositories.ts:521` accepts only `{ lessonId, label, url, kind }`.

Adding `file_key`, `file_name`, `file_size_bytes`, `mime_type` to `materials` as nullable columns is
technically additive, but they are dead schema until:
1. An upload security review clears the policy.
2. An object storage adapter (S3/R2) is wired.
3. A `GET /api/education/materials/:id/download` signed-URL route is built.
None of those exist.

**Recommendation:** Phase-3. All four columns are dead schema. Do NOT include in migration 0005.
DDL spec documented below (§Decisions) for future reference.

**Target area:** Migration 0005 boundedness / materials file-meta.

---

### F-10 — medium — lesson_progress state column: bounded verdict = Phase-3 (derivation works; no state-machine consumer present)

EDUCATION_LMS_PLAN.md §4.6 specifies a `state text NOT NULL default 'started'` column with values
`started | completed`. Currently `deriveLessonState` in `packages/lms/src/completion.ts` line 20
derives the state from `{ completed: boolean; percentComplete: string }` — the existing `lesson_progress`
columns. `deriveLessonState` is tested in `packages/lms/src/lms.test.ts` lines 43–47.

Adding a `state` column would:
1. Need a backfill: `UPDATE lesson_progress SET state = CASE WHEN completed THEN 'completed' ELSE 'started' END`
2. Create dual-source-of-truth: callers currently use `deriveLessonState(progressRow)`. All callers
   would need to be migrated to read `state` directly.
3. The explicit state column is useful for Phase-3 auto-progress (video scrub events transitioning
   to `started` without a full completion), but no such scrub-position consumer exists today.

The `lesson_progress` plan also adds `state: 'started' | 'completed'` and `started_at` / `last_seen_at`
columns (replacing `last_accessed_at`). That rename is non-additive (would leave `last_accessed_at`
orphaned or require a DROP COLUMN in Phase-3).

**Recommendation:** Phase-3. `deriveLessonState` is the current working derivation; adding the column
without migrating callers is dead schema. The rename of `last_accessed_at` → `last_seen_at` is a
separate non-additive cleanup also deferred to Phase-3. Do NOT include in migration 0005.

**Target area:** Migration 0005 boundedness / lesson_progress.state.

---

### F-11 — info — Drizzle text[].array() support note (PGlite limitation)

`text().array()` is valid Drizzle ORM syntax and generates `text[]` in Postgres DDL. However, PGlite
(used in all integration tests today because real Postgres is not available — B1 is NOT RUN) does not
reliably implement Postgres array operators (`= ANY($1::text[])`, `@>`, `&&`). This means any future
Phase-3 migration adding `tags text[]` would need array-query integration tests to use `describe.skipIf`
guards identical to the cross-connection jti test pattern (Phase 2.9 / F-07 from tests-runner). This
is an implementation note for the Phase-3 wave, not a blocker.

**Recommendation:** No action now. Note for Phase-3 db-architect: PGlite array operator tests need
`skipIf(!REAL_POSTGRES_DATABASE_URL)` guards.

**Target area:** Future migration + test design.

---

### F-12 — info — Spine-file serialization rule confirmed active

`docs/EXECUTION_PLAN_MASTER.md` §1 (Single-writer spine files): "`packages/db/src/schema.ts`,
`packages/db/src/repositories.ts`, `packages/db/migrations/*` — `ecosystem-db-architect` only, one
migration wave at a time." This means the PG7 session must execute any schema change as a single
db-architect wave BEFORE education-implementer and frontend-implementer consume it. Since migration
0005 is ruled Phase-3, no spine-file write is needed this phase.

**Recommendation:** No action this phase. Confirm to operator: spine rule is in force; no concurrent
writers on schema.ts/repositories.ts/migrations permitted.

**Target area:** Process governance.

---

### F-13 — medium — DATA_MODEL.md still documents 40 tables (not 41)

`docs/DATA_MODEL.md` line 18 reads: "the Drizzle schema is a single file `packages/db/src/schema.ts`
(40 tables — 21 base tables from migrations 0000/0001 + 17 new tables from migration 0002 + 2 new
tables from migration 0003)". This does not reflect migration 0004 (41 tables). This is a doc drift,
not a schema bug. The STATUS.md Phase 2.9 summary correctly states 41 tables.

**Recommendation:** Operator to update DATA_MODEL.md §0 to read "(41 tables — … + 1 new table from
migration 0004: `axioma_handoff_jti_revocations`)". This is a doc-only fix; no schema change.

**Target area:** Documentation truth / DATA_MODEL.md.

---

## Decisions

### D-1 — Rich LMS migration 0005: overall verdict = Phase-3

**None of the six candidate rich LMS columns/features are bounded this phase.** Detailed verdict:

| Candidate | Verdict | Reason |
|---|---|---|
| `courses.slug` text UNIQUE | Phase-3 | No slug-URL consumer; backfill collision risk; routes use UUID |
| `courses.level` text + CHECK | Phase-3 | No filter consumer; `listPublishedCourses` has no level filter |
| `courses.tags` text[] | Phase-3 | No tag-filter consumer; PGlite array-op limitation |
| `lessons.content_type` text + CHECK | Phase-3 | `deriveContentType` already works; no embed/link UI consumer |
| `lessons.embed_html` text | Phase-3 | No sanitizer wired; stored-XSS risk until sanitizer lands |
| `materials` file-meta (4 cols) | Phase-3 | Upload BLOCKED; no storage adapter; 4 cols are dead schema |
| `pinned_links.owner_type = 'global'` | Phase-3 | Non-additive DROP+ADD CHECK; Q-6 undecided; no consumer |
| `lesson_progress.state` text + CHECK | Phase-3 | `deriveLessonState` works; column rename non-additive |

**Migration 0005 does NOT run this phase.** The throw+audit fix (PG7 workstream 1) and CSRF-first
ordering (workstream 2) require ZERO schema changes.

### D-2 — Ready-to-run Phase-3 migration spec (for future wave, NOT run now)

The following is the complete DDL sketch for migration 0005 when it runs in Phase-3. All steps are
additive except the pinned_links CHECK replacement (which must be hand-edited).

```sql
-- 0005: Rich LMS columns (Phase 3 — NOT run in Phase 2)
-- Precondition: 41-table baseline (migrations 0000–0004 applied)

-- 1. courses.slug (additive nullable, then backfill, then NOT NULL)
ALTER TABLE "courses" ADD COLUMN "slug" text;
UPDATE "courses" SET "slug" = 'course-' || REPLACE(CAST("id" AS text), '-', '') WHERE "slug" IS NULL;
ALTER TABLE "courses" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
CREATE INDEX "courses_teacher_profile_id_idx" ON "courses" USING btree ("teacher_profile_id");
CREATE INDEX "courses_product_code_idx" ON "courses" USING btree ("product_code");
CREATE INDEX "courses_is_published_idx" ON "courses" USING btree ("published");

-- 2. courses.level (additive with default — safe one-shot)
ALTER TABLE "courses" ADD COLUMN "level" text NOT NULL DEFAULT 'beginner';
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_check" CHECK ("level" IN ('beginner', 'intermediate', 'advanced'));

-- 3. courses.tags (additive with default — safe one-shot)
ALTER TABLE "courses" ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}';
-- GIN index deferred until a tag-filter consumer exists (index is expensive if never queried)

-- 4. lessons.content_type (additive with backfill from videoUrl)
ALTER TABLE "lessons" ADD COLUMN "content_type" text;
UPDATE "lessons" SET "content_type" = CASE WHEN "video_url" IS NOT NULL THEN 'video' ELSE 'article' END WHERE "content_type" IS NULL;
ALTER TABLE "lessons" ALTER COLUMN "content_type" SET NOT NULL;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ("content_type" IN ('video', 'embed', 'article', 'link'));

-- 5. lessons.embed_html (additive nullable — only safe AFTER sanitizer wired and audited)
-- NOTE: Do not add until a server-side sanitizer in packages/lms passes security review.
-- ALTER TABLE "lessons" ADD COLUMN "embed_html" text;

-- 6. lessons.external_url (additive nullable — companion to content_type='link')
ALTER TABLE "lessons" ADD COLUMN "external_url" text;

-- 7. materials file-meta (additive nullable — only safe AFTER upload security review clears)
-- NOTE: Do not add until object storage adapter + upload security review pass.
-- ALTER TABLE "materials" ADD COLUMN "file_key" text;
-- ALTER TABLE "materials" ADD COLUMN "file_name" text;
-- ALTER TABLE "materials" ADD COLUMN "file_size_bytes" bigint;
-- ALTER TABLE "materials" ADD COLUMN "mime_type" text;

-- 8. pinned_links owner_type 'global' (NON-ADDITIVE — requires hand-edit; run after Q-6 decided)
-- DANGER: drizzle-kit will NOT generate the DROP + ADD correctly — hand-edit required.
-- ALTER TABLE "pinned_links" DROP CONSTRAINT "pinned_links_owner_type_check";
-- ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_owner_type_check" CHECK ("owner_type" IN ('teacher_profile', 'course', 'global'));
-- Companion: make owner_id nullable for global links (global has no owning entity)
-- ALTER TABLE "pinned_links" ALTER COLUMN "owner_id" DROP NOT NULL;

-- 9. lesson_progress.state (additive with backfill)
ALTER TABLE "lesson_progress" ADD COLUMN "state" text;
UPDATE "lesson_progress" SET "state" = CASE WHEN "completed" THEN 'completed' ELSE 'started' END WHERE "state" IS NULL;
ALTER TABLE "lesson_progress" ALTER COLUMN "state" SET NOT NULL;
ALTER TABLE "lesson_progress" ALTER COLUMN "state" SET DEFAULT 'started';
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_state_check" CHECK ("state" IN ('started', 'completed'));
-- When adding state column: migrate all callers away from deriveLessonState() to read the column.
-- The last_accessed_at → last_seen_at rename is DEFERRED (requires DROP COLUMN — Phase 3+).
```

**Drizzle schema.ts additions (for the db-architect writer to add when this runs):**

```ts
// courses additions:
slug: text('slug').notNull(), // add after backfill confirms no NULLs
level: text('level').notNull().default('beginner'),
tags: text('tags').array().notNull().default(sql`'{}'`),

// lessons additions:
contentType: text('content_type').notNull(), // after backfill
externalUrl: text('external_url'),

// lesson_progress addition:
state: text('state').notNull().default('started'),
```

**Indexes to add in Drizzle table() second argument:**

```ts
// courses:
slugIdx: uniqueIndex('courses_slug_idx').on(t.slug),
teacherProfileIdx: index('courses_teacher_profile_id_idx').on(t.teacherProfileId),
productCodeIdx: index('courses_product_code_idx').on(t.productCode),
isPublishedIdx: index('courses_is_published_idx').on(t.published),

// lesson_progress:
// existing indexes sufficient; state is low-cardinality (no benefit from a B-tree index)
```

### D-3 — No denial audit code needed in AUDIT_ACTIONS for 0005

The throw+audit workstream (education-implementer lane) can use `result: 'failure'` on an existing
action code to record a DENIED attempt. However, to give maximum observability, a new
`'education.access_denied'` code is recommended for the audit code list in `packages/audit/src/audit.ts`.
This is a one-line addition to AUDIT_ACTIONS — zero schema change.

## Risks

### R-01 — pinned_links CHECK is a trap for automated migration tools (critical awareness)

If a future Phase-3 db-architect runs `npm run db:generate` after adding `'global'` to the Drizzle
schema's `ownerType` union type without hand-editing the migration output, drizzle-kit will emit a
second `ADD CONSTRAINT "pinned_links_owner_type_check_1"` (or similar auto-named constraint) in
addition to the existing one. This leaves BOTH constraints on the column — the old one (`teacher_profile | course`)
will REJECT any `global` insert even though the new one allows it. The symptom is silent insert
failures for global links. The Phase-3 db-architect must: (1) hand-edit the generated SQL to DROP the
old constraint before ADD, (2) verify the migration output before applying.

### R-02 — embed_html stored-XSS risk if added without sanitizer

If a future db-architect or implementer adds `embed_html` to the schema and any teacher UI renders it
without a server-side sanitizer pass, it is a stored-XSS vector. This must be a hard gate: the
Phase-3 security-auditor must sign off on the sanitizer before the column is consumable.

### R-03 — Backfill migration for slug/content_type/state are irreversible on real Postgres

Once 0005 runs against production and backfills slug / content_type / state, the old derivation paths
(UUID-based URLs, `deriveContentType`, `deriveLessonState`) must be retired in the same wave. Leaving
the derivation functions alive post-backfill creates a dual-truth problem. The Phase-3 db-architect
must coordinate the schema wave with the education-implementer to retire the derivation functions in
the same PR/wave.

### R-04 — PGlite array operator limitation for tags

`text[]` in Postgres supports `@>`, `&&`, `= ANY(...)` operators that PGlite does not implement
reliably. The Phase-3 tests-runner must add `skipIf(!REAL_POSTGRES_DATABASE_URL)` for any array-query
test, and the real-PG harness (B1) must be unblocked before 0005 runs to provide meaningful test
coverage.

## Verification/tests

For this phase (read-only audit):
- Table count arithmetic confirmed manually: 21+17+2+1 = 41.
- Migration file hashes not re-run (no `db:generate` in read-only audit), but file contents are as
  described (PGlite-tested in Phase 2.9 gate).
- `audit_logs.result` column confirmed in both 0000 SQL and schema.ts.
- `pinned_links` CHECK confirmed in 0002 SQL (last line, hand-added non-DDL section).
- `deriveContentType` and `deriveLessonState` confirmed active consumers in queries.ts and completion.ts.

For Phase-3 0005 (when run):
- `npm run db:generate` → confirm exactly the additive columns in the diff, no unexpected drops.
- `npm run db:migrate` against `wtc_test` → confirm 41 → (41 + N added columns) tables.
- PGlite integration test for each new column: `createCourse` with `level` + `tags`; `createLesson`
  with `contentType` backfill value; `lesson_progress` upsert with `state`.
- Pinned_links 'global' test: `skipIf(PGLITE)` until PGlite supports the constraint change properly.
- Hand-edit verification: before applying 0005 to production, confirm only ONE `pinned_links_owner_type_check`
  constraint exists after applying.

## Next actions

1. **This phase (PG7 — no schema change):**
   - Education-implementer: implement throw+audit (result='failure') + CSRF-first ordering in
     `apps/web/src/features/lms/actions.ts` with NO schema change.
   - Security-auditor: confirm denial audit code approach (existing code + `result: 'failure'` vs new
     `education.access_denied` code in AUDIT_ACTIONS).
   - Operator: update `docs/DATA_MODEL.md` §0 — change "40 tables" to "41 tables" + mention 0004.

2. **Phase-3 (when 0005 runs):**
   - Operator decision: confirm Q-6 (club + education bundling) before adding `global` owner_type.
   - Upload security review must clear before `embed_html` or `file_key/mime_type/file_size_bytes`
     are added to any migration.
   - db-architect: hand-edit 0005 for the pinned_links CHECK DROP+ADD (do not trust drizzle-kit output).
   - db-architect: coordinate with education-implementer to retire `deriveContentType` and
     `deriveLessonState` in the same wave as 0005 (dual-truth prevention).
   - B1 (real Postgres) must be unblocked before 0005 can be integration-tested properly.
