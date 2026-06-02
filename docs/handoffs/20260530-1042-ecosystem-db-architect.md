# ecosystem-db-architect handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS schema audit (read-only). No schema.ts / migrations /
repositories.ts edited this wave. This handoff is the canonical truth source for the Phase 2.2
LMS implementer._

---

## Scope

1. Confirm the exact table count after migration 0002 (38, not 39).
2. Confirm migration count = 3 (0000 / 0001 / 0002).
3. Flag every document that records the wrong count.
4. Reconcile the rich LMS contract (education-implementer handoff 20260530-0925) against ACTUAL lean
   columns in schema.ts for: courses, lessons, materials, lesson_progress, enrollments, pinned_links.
5. Decide: migration 0003 (additive column subset) or map full LMS onto existing columns.
6. Specify the DTO column-name mapping (snake_case DB → camelCase DTO) the service layer uses so the
   UI never sees raw Dates or snake_case.
7. Confirm 0000 / 0001 / 0002 are never edited destructively.

---

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0925-ecosystem-db-architect.md`
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md`
- `packages/db/src/schema.ts` (full — 605 lines, 38 tables confirmed)
- `packages/db/migrations/0002_sour_paibok.sql` (full)
- `packages/db/migrations/meta/_journal.json`
- `packages/db/src/repositories.ts` (lines 1-400; Education repos at 317-385)
- `tests/integration/db-0002.test.ts` (full — 245 lines)
- `docs/STATUS.md` (lines 1-47)
- `docs/NEXT_ACTIONS.md` (line 44)
- `docs/IMPLEMENTED_FILES.md` (lines 46-51)
- `docs/DATA_MODEL.md` (line 18)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. [CRITICAL] Table count is 38, not 39 — two docs are wrong

**Evidence:** `packages/db/src/schema.ts` exports exactly 38 `pgTable(...)` declarations:

| # | Table name (DB snake_case) |
|---|---|
| 1 | users |
| 2 | roles |
| 3 | user_roles |
| 4 | sessions |
| 5 | products |
| 6 | plans |
| 7 | entitlements |
| 8 | subscriptions |
| 9 | exchange_accounts |
| 10 | exchange_api_key_secrets |
| 11 | bot_instances |
| 12 | bot_configs |
| 13 | axioma_account_links |
| 14 | tradingview_access_requests |
| 15 | tradingview_access_tasks |
| 16 | courses |
| 17 | lessons |
| 18 | materials |
| 19 | audit_logs |
| 20 | job_queue |
| 21 | integration_health_checks |
| 22 | bot_config_versions |
| 23 | bot_metric_snapshots |
| 24 | bot_position_snapshots |
| 25 | bot_trade_imports |
| 26 | bot_safety_events |
| 27 | teacher_profiles |
| 28 | enrollments |
| 29 | lesson_progress |
| 30 | pinned_links |
| 31 | tradingview_access_grants |
| 32 | tradingview_profiles |
| 33 | product_access_events |
| 34 | terminal_release_cache |
| 35 | terminal_download_events |
| 36 | terminal_license_events |
| 37 | notifications |
| 38 | support_tickets |

The 0002 migration adds 17 new tables (not 18 — see Finding 2) plus 1 ALTER on the existing
`tradingview_access_requests` table. The ALTER is counted in `docs/STATUS.md` correctly as "1 ALTER"
but the total was computed as 21 + 18 = 39, which is wrong because `tradingview_access_requests`
already existed and is NOT a new table.

**Docs to correct:**

| File | Wrong claim | Correct value |
|---|---|---|
| `docs/NEXT_ACTIONS.md` line 44 | "39 tables as of 0002" | **38 tables** |
| `docs/IMPLEMENTED_FILES.md` line 48 | "39 tables" | **38 tables** |
| `docs/IMPLEMENTED_FILES.md` line 49 | "39 tables" | **38 tables** |

`docs/DATA_MODEL.md` line 18 says "21 tables" — this was the pre-0002 count and is now stale (38
post-0002). It requires a separate doc update noting 38 tables as of 0002.

`docs/STATUS.md` line 43 says "generated `0002_sour_paibok.sql`; re-run = No schema changes" — the
STATUS count is NOT listed explicitly there; no correction needed in STATUS.md for the table count.

**Note on the count discrepancy:** The 0002 handoff at epoch 20260530-0925 states "18 new tables"
in its Findings section. Counting from the migration SQL file and schema.ts, the count is 17 new
tables. The 18th was the ALTER on `tradingview_access_requests` which was already included in the
21 base tables. The schema.ts has 21 + 17 = 38 total. The 0002 SQL file `CREATE TABLE` blocks
confirm exactly 17 new tables: bot_config_versions, bot_metric_snapshots, bot_position_snapshots,
bot_safety_events, bot_trade_imports, enrollments, lesson_progress, notifications, pinned_links,
product_access_events, support_tickets, teacher_profiles, terminal_download_events,
terminal_license_events, terminal_release_cache, tradingview_access_grants, tradingview_profiles.

---

### 2. [INFO] Migration count = 3, journal confirmed

`packages/db/migrations/meta/_journal.json` has 3 entries at indices 0/1/2:
- `0000_broken_jack_murdock` (idx=0)
- `0001_early_toad_men` (idx=1)
- `0002_sour_paibok` (idx=2)

All three entries are present. `db:generate` re-run = "No schema changes" per STATUS.md line 43,
confirming schema.ts and the last meta snapshot are in sync. No pending 0003 exists.

---

### 3. [CRITICAL] Lean-vs-rich reconciliation: columns the full LMS contract wants that DO NOT exist

The education-implementer handoff (20260530-0925) specified a rich contract using column names from
`docs/EDUCATION_LMS_PLAN.md` §4. Several of those columns are NOT present in the actual schema.ts.
This is the definitive gap list.

#### 3a. courses table (schema.ts lines 172-183)

ACTUAL columns: `id`, `owner_teacher_id`, `teacher_profile_id`, `title`, `description`,
`product_code`, `published`, `created_at`.

MISSING (wanted by rich contract):

| Missing column | Contract use |
|---|---|
| `slug` | URL routing `/app/education/[courseSlug]`; `CourseAdminView.slug`; `CreateCourseSchema.slug` |
| `level` | `CourseAdminView.level` (beginner/intermediate/advanced) |
| `tags` | `CourseAdminView.tags`; `CourseCardView.tags`; jsonb or text[] |
| `is_featured` | `CourseAdminView.isFeatured`; `setCourseFeatured` service method |
| `sort_order` | `CourseAdminView.sortOrder`; integer DEFAULT 0 |
| `thumbnail_url` | `CourseAdminView.thumbnailUrl`; `CourseCardView.thumbnailUrl` |

#### 3b. lessons table (schema.ts lines 185-193)

ACTUAL columns: `id`, `course_id`, `title`, `body`, `video_url`, `order`, `published`.

MISSING (wanted by rich contract):

| Missing column | Contract use |
|---|---|
| `slug` | URL routing `/app/education/[courseSlug]/[lessonSlug]`; `LessonStudentView.slug` |
| `content_type` | `LessonStudentView.contentType` ('video'/'embed'/'article'/'link'); discriminates rendering |
| `embed_html` | `LessonStudentView.embedHtml`; already sanitized before storage |
| `article_body` | `LessonStudentView.articleBody`; markdown content for article-type lessons |
| `external_url` | `LessonStudentView.externalUrl`; for link-type lessons |
| `duration_sec` | `LessonStudentView.durationSec`; integer; drives progress bar display |
| `is_preview` | `LessonStudentView.isPreview`; boolean; free preview without entitlement |
| `is_published` | alias for `published` — actual column IS `published` (boolean), no rename needed |

Note: `body` column on lessons (text) exists and maps to `articleBody` in the thin DTO. The
rich contract needs `article_body` to co-exist with `embed_html` and `content_type` discriminator.
The `body` column can be reused as `article_body` under the mapping rule: when `content_type =
'article'`, the repo writes `body`; the DTO surfaces it as `articleBody`. This eliminates one new
column but requires `content_type` and `embed_html` and `external_url` to be added for the others.

#### 3c. materials table (schema.ts lines 195-201)

ACTUAL columns: `id`, `lesson_id`, `label`, `url`, `kind`.

MISSING (wanted by rich contract):

| Missing column | Contract use |
|---|---|
| `material_type` | Discriminator: 'file' vs 'link'. `kind` column exists and is semantically equivalent (DEFAULT 'link'). Map `kind` → `materialType` in DTO. |
| `file_key` | S3/R2 object key; never returned to UI; required for file-type materials |
| `file_name` | `MaterialView.fileName`; user-visible original filename |
| `file_size_bytes` | `MaterialView.fileSizeBytes`; integer |
| `mime_type` | `MaterialView.mimeType`; text |
| `external_url` | `MaterialView.externalUrl`; for link-type materials |
| `sort_order` | `MaterialView.sortOrder`; integer DEFAULT 0 |

Note: `url` column exists and can serve as `external_url` for link-type under a DTO mapping rule.
`kind` maps directly to `materialType`. This eliminates two columns but `file_key`, `file_name`,
`file_size_bytes`, `mime_type`, and `sort_order` are genuinely absent.

#### 3d. lesson_progress table (schema.ts lines 418-434)

ACTUAL columns: `id`, `user_id`, `lesson_id`, `percent_complete` NUMERIC(5,2), `completed` BOOLEAN,
`last_accessed_at`, `created_at`, `updated_at`.

MISSING (wanted by rich contract — education-implementer plan §4.6 names):

| Missing column | Contract use |
|---|---|
| `state` | text: 'started' \| 'completed'; replaces `completed` boolean; drives `LessonState` |
| `progress_pct` | integer 0-100; replaces `percent_complete` NUMERIC; `ProgressView.progressPct` |
| `started_at` | timestamp; `ProgressView.startedAt`; set on first upsert |
| `completed_at` | timestamp; `ProgressView.completedAt`; set when state → 'completed' |
| `last_seen_at` | timestamp; `ProgressView.lastSeenAt`; server-debounce guard uses this |
| `course_id` | uuid FK → courses; `ProgressView.courseId`; required for `getCourseProgress` join |

EXISTING that map to contract fields:
- `percent_complete` → can be used for `progressPct` (divide/round in DTO)
- `completed` → can drive `state` derivation ('started' if !completed, 'completed' if completed)
- `last_accessed_at` → maps to `lastSeenAt`
- `created_at` → maps to `startedAt`
- `updated_at` → secondary to `last_accessed_at`

The critical gaps are: `completed_at` timestamp (needed for `ProgressView.completedAt` and
`checkCourseCompletion` audit timing), `course_id` FK (needed for `getCourseProgress` without a
join through lessons), and `state` text field (the plan §4.6 state machine is richer than a boolean).

#### 3e. enrollments table (schema.ts lines 400-415)

ACTUAL columns: `id`, `user_id`, `course_id`, `entitlement_id`, `enrolled_at`, `completed_at`.

MISSING (wanted by rich contract):

| Missing column | Contract use |
|---|---|
| `source` | `EnrollmentView.source` ('entitlement' \| 'manual_admin'); distinguishes auto vs admin-created |

This is a single text column with DEFAULT 'entitlement'.

#### 3f. pinned_links table (schema.ts lines 437-452)

ACTUAL columns: `id`, `owner_type`, `owner_id` (NOT NULL), `label`, `url`, `icon_type`,
`sort_order`, `is_active`, `created_by`, `created_at`.

CONFLICT (education-implementer finding 5): the education contract requires `owner_id` to be
NULLABLE for `owner_type = 'global'`. The actual schema.ts has `ownerId: uuid('owner_id').notNull()`.
The CHECK constraint in the migration SQL reads `"owner_type" IN ('teacher_profile', 'course')` —
it does NOT include 'global' as a valid owner_type. This means global pinned links cannot be stored
in the current schema without a schema change.

---

### 4. [INFO] db-0002.test.ts is passing with the lean schema — no regression

`tests/integration/db-0002.test.ts` exercises the existing lean repos (createTeacherProfile,
upsertEnrollment, upsertLessonProgress, getLessonProgress, etc.) using the ACTUAL lean columns
(`percent_complete`, `completed`, `last_accessed_at`). These tests are green per STATUS.md line 41.
No test currently exercises the missing rich columns.

---

### 5. [INFO] The existing thin repos in repositories.ts use actual column names

`upsertLessonProgress` (not yet in repositories.ts header but in db-0002.test.ts line 121) uses
`{ userId, lessonId, percentComplete, completed }` matching the ACTUAL `percent_complete`/`completed`
columns. `rowToCourseDto` (line 343) uses `r.published` (actual column). The existing service layer
is consistent with the lean schema.

---

### 6. [INFO] 0000/0001/0002 are intact — zero destructive edits

`_journal.json` timestamps: 0000=1780054410660, 0001=1780058909446, 0002=1780109256527. The 0002
SQL ends with the hand-added DML backfill and CHECK constraint. None of the three files have been
edited since generation. Additive-only principle confirmed intact.

---

## Decisions

### D1. Table count truth: 38 tables (correction required in two docs)

The canonical count post-0002 is 38. `docs/NEXT_ACTIONS.md` line 44 and `docs/IMPLEMENTED_FILES.md`
lines 48-49 must be updated to say 38. The Phase 2.2 implementer corrects these as part of the
normal doc-update pass at session start.

### D2. Migration recommendation: option (b) — NO migration 0003 for the core LMS vertical

The landed lean schema supports a COMPLETE teacher/student/admin LMS covering:

- Course create/publish/list (courses: id, title, description, product_code, published, teacher_profile_id)
- Lessons ordered + published (lessons: id, course_id, title, body, video_url, order, published)
- Materials label/url/kind (materials: id, lesson_id, label, url, kind)
- Enrollment + completion (enrollments: enrolled_at, completed_at, entitlement_id)
- Progress with percent + boolean (lesson_progress: percent_complete, completed, last_accessed_at)
- Teacher profiles (teacher_profiles: display_name, bio, avatar_url, social_links, is_active)
- Pinned links for teacher_profile and course contexts (pinned_links: owner_type, owner_id, label, url)
- Full audit trail (audit_logs), notifications, support tickets

The rich contract's extra columns (slug, level, tags, is_featured, sort_order, thumbnail_url on
courses; slug, content_type, embed_html, external_url, duration_sec, is_preview on lessons; file_key,
file_name, file_size_bytes, mime_type, sort_order on materials; state, started_at, completed_at,
course_id on lesson_progress; source on enrollments) are genuinely absent but the LMS can be built
as a complete, useful product WITHOUT them by applying the column mappings in Decision D3.

One exception where a migration IS recommended: `pinned_links.owner_id` must be made nullable and
the CHECK constraint must be extended to include 'global' if global community links are required as
a Phase 2.2 deliverable. Without this, `listPinnedLinks({ ownerType: 'global' })` cannot store
null-owner rows. See D4.

### D3. Service-layer mapping: lean DB columns → rich DTO fields (no migration)

The implementer applies these mappings in the repo/service layer. No column rename at the DB level.

**courses table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `title` | `title` | `title` | direct |
| `description` | `description` | `description` | direct |
| `product_code` | `productCode` | `productCode` | direct |
| `published` | `published` | `isPublished` | rename in DTO; boolean |
| `owner_teacher_id` | `ownerTeacherId` | `ownerTeacherId` | kept for backward compat |
| `teacher_profile_id` | `teacherProfileId` | `teacherProfileId` | nullable uuid |
| `created_at` | `createdAt` | `createdAt` | `.getTime()` → epoch-ms |
| — | — | `slug` | COMPUTED at service layer: `slugify(title)` or stored in JSONB extra field in `description` |
| — | — | `level` | DEFAULT 'beginner' — hardcoded in DTO until 0003 adds the column |
| — | — | `tags` | DEFAULT [] — hardcoded in DTO |
| — | — | `isFeatured` | DEFAULT false — hardcoded in DTO |
| — | — | `sortOrder` | DEFAULT 0 — hardcoded in DTO |
| — | — | `thumbnailUrl` | DEFAULT undefined — hardcoded in DTO |

**lessons table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `title` | `title` | `title` | direct |
| `body` | `body` | `articleBody` | reused for article content; also used for embed_html stub |
| `video_url` | `videoUrl` | `videoUrl` | direct |
| `order` | `order` | `sortOrder` | rename in DTO |
| `published` | `published` | `isPublished` | rename in DTO |
| `course_id` | `courseId` | `courseId` | direct |
| — | — | `slug` | COMPUTED: `slugify(title)` — no DB column |
| — | — | `contentType` | INFERRED: if videoUrl → 'video'; if body → 'article'; else 'link'; DEFAULT 'article' |
| — | — | `embedHtml` | DEFAULT undefined (no embed column; body reused for article only) |
| — | — | `externalUrl` | DEFAULT undefined |
| — | — | `durationSec` | DEFAULT undefined |
| — | — | `isPreview` | DEFAULT false — hardcoded |

**materials table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `label` | `label` | `title` | rename: label→title in DTO |
| `url` | `url` | `externalUrl` | for link-type; also serves as file download ref for file-type |
| `kind` | `kind` | `materialType` | 'link' \| 'file' — direct value mapping |
| — | — | `fileName` | DEFAULT undefined (no file_name column) |
| — | — | `fileSizeBytes` | DEFAULT undefined |
| — | — | `mimeType` | DEFAULT undefined |
| — | — | `sortOrder` | DEFAULT 0 — hardcoded |

**lesson_progress table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `user_id` | `userId` | `userId` | direct |
| `lesson_id` | `lessonId` | `lessonId` | direct |
| `percent_complete` | `percentComplete` | `progressPct` | rename; string from DB → `parseFloat()` → number in DTO |
| `completed` | `completed` | `state` | derive: `completed ? 'completed' : 'started'` |
| `last_accessed_at` | `lastAccessedAt` | `lastSeenAt` | rename; `.getTime()` |
| `created_at` | `createdAt` | `startedAt` | reuse: first insert timestamp = started |
| `updated_at` | `updatedAt` | (internal) | used for server-debounce: if `updatedAt > now-8s` → skip |
| — | — | `completedAt` | NOT AVAILABLE without a column: the service stores `updatedAt` on completion; implementer uses `updatedAt` as `completedAt` proxy when `completed=true` (acceptable for Phase 2.2; real `completed_at` requires 0003) |
| — | — | `courseId` | NOT AVAILABLE: `getCourseProgress` must JOIN lessons ON lesson_id to get course_id |

**enrollments table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `user_id` | `userId` | `userId` | direct |
| `course_id` | `courseId` | `courseId` | direct |
| `entitlement_id` | `entitlementId` | (internal only) | omit from EnrollmentView |
| `enrolled_at` | `enrolledAt` | `enrolledAt` | `.getTime()` |
| `completed_at` | `completedAt` | `completedAt` | `.getTime()` if not null |
| — | — | `source` | DEFAULT 'entitlement' — hardcoded. `adminCreateEnrollment` sets 'manual_admin' by convention in audit log only (not stored in DB without 0003 column) |

**pinned_links table mappings:**

| DB column | Drizzle TS field | DTO field | Notes |
|---|---|---|---|
| `owner_type` | `ownerType` | `ownerType` | direct: 'teacher_profile' \| 'course' |
| `owner_id` | `ownerId` | `ownerId` | NOT NULL in schema; global links need 0003 (see D4) |
| `label` | `label` | `label` | direct |
| `url` | `url` | `url` | direct |
| `icon_type` | `iconType` | `iconType` | direct |
| `sort_order` | `sortOrder` | `sortOrder` | direct |
| `is_active` | `isActive` | `isActive` | direct |

### D4. Recommended minimal 0003: additive columns for high-value missing fields

If the Phase 2.2 session scope includes global community links OR the ProgressView.completedAt
field is required (not just proxied via updatedAt), then migration 0003 is warranted for the
following columns ONLY. All are additive, nullable, and PGlite-testable.

**Recommended 0003 column set (ordered by priority):**

```sql
-- pinned_links: allow global ownerType with no ownerId
ALTER TABLE "pinned_links" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "pinned_links" DROP CONSTRAINT "pinned_links_owner_type_check";
ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_owner_type_check"
  CHECK ("owner_type" IN ('teacher_profile', 'course', 'global'));

-- lesson_progress: real completed_at (eliminates the updatedAt proxy)
ALTER TABLE "lesson_progress" ADD COLUMN "completed_at" timestamp with time zone;

-- lesson_progress: course_id for getCourseProgress without join (optional but fast)
ALTER TABLE "lesson_progress" ADD COLUMN "course_id" uuid REFERENCES "courses"("id");

-- enrollments: source field for adminCreateEnrollment distinction
ALTER TABLE "enrollments" ADD COLUMN "source" text NOT NULL DEFAULT 'entitlement';
```

**Drizzle additions for 0003 (exact, copy-pasteable):**

```typescript
// pinned_links — change ownerId from notNull() to nullable:
ownerId: uuid('owner_id'), // nullable for ownerType='global'

// lesson_progress — add two columns:
completedAt: timestamp('completed_at', { withTimezone: true }),
courseId: uuid('course_id').references(() => courses.id),

// enrollments — add source column:
source: text('source').notNull().default('entitlement'),
```

The 0003 migration does NOT add slug/level/tags/is_featured/sort_order/thumbnail_url to courses,
and does NOT add content_type/embed_html/external_url/duration_sec/is_preview to lessons. Those
fields are deferred to Phase 3+. The service-layer defaults in D3 cover them for Phase 2.2.

**Operator decision gate:** If Phase 2.2 requires global community links (pinned_links ownerType =
'global'), migration 0003 MUST run before the service layer writes global links. If global links
are deferred, 0003 is optional and the full LMS can land without it.

### D5. Additive-only and no-plaintext rules confirmed

The 0002 migration adds only CREATE TABLE and ALTER TABLE ADD COLUMN statements plus the hand-added
DML backfill and one CHECK. No DROP COLUMN, no DROP TABLE, no ALTER COLUMN TYPE. No plaintext secret
column anywhere in schema.ts — `exchange_api_key_secrets.sealed` is JSONB ciphertext. 0000/0001/0002
are never edited after generation.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `pinned_links.owner_id` is NOT NULL — global links cannot be inserted | P1 | If global community links are Phase 2.2 scope, 0003 must land first; otherwise defer |
| `ProgressView.completedAt` proxied via `updatedAt` — inaccurate if row updated again after completion | P2 | Add `completed_at` in 0003; note limitation in service comment until then |
| `getCourseProgress` requires JOIN through lessons to get course_id — N+1 risk at scale | P2 | Add `course_id` FK to lesson_progress in 0003; use JOIN for Phase 2.2 |
| Course slug computed from title — not unique-constrained at DB level | P2 | Slug uniqueness enforced at service layer (SELECT ... WHERE slug=... before insert); add unique index when slug column lands in future migration |
| Lesson contentType inferred from nullable column presence — fragile if a lesson has both videoUrl and body | P2 | Service layer writes only one of the three content columns; null out others on update |
| `source` not stored on enrollments — admin-created enrollments look like entitlement enrollments in DB | P2 | Add `source` column in 0003; until then, track source only in audit_logs action field |
| Course `level`/`tags`/`is_featured` hardcoded in DTO — admin UI cannot set them | P3 | Phase 2.2 UI hides those fields; document as Phase 3 additions |
| 39-table claim in docs — misleads db:generate output validation | P3 | Correct NEXT_ACTIONS.md and IMPLEMENTED_FILES.md before Phase 2.2 implementation starts |

---

## Verification/tests

The PGlite harness in `tests/integration/db-0002.test.ts` is the reference pattern. For Phase 2.2
the implementer must add tests covering the DTO mapping layer (not just raw repo calls):

1. `rowToCourseDto` returns `isPublished` (not `published`), `sortOrder=0`, `level='beginner'`,
   `tags=[]`, `isFeatured=false` as hardcoded defaults when those columns are absent.

2. `rowToLessonDto` returns `contentType` inferred from non-null columns (`videoUrl` → 'video',
   `body` → 'article') and `isPreview=false` as default.

3. `rowToMaterialDto` maps `label` → `title`, `kind` → `materialType`, `url` → `externalUrl`
   for link-type materials, and returns `sortOrder=0` as default.

4. `rowToLessonProgressDto` maps `percentComplete` → `progressPct` (number, not string), derives
   `state` from `completed`, maps `lastAccessedAt` → `lastSeenAt`, maps `createdAt` → `startedAt`,
   and uses `updatedAt` as `completedAt` proxy when `completed=true`.

5. `upsertEnrollment` writes `source='entitlement'` into the audit log action (even though the DB
   column does not exist); `adminCreateEnrollment` writes `source='manual_admin'` into audit log.

6. `listPinnedLinks({ ownerType: 'teacher_profile', ownerId: profileId })` returns only active
   links; `deletePinnedLink` sets `is_active=false` (soft-delete). Both cases covered in
   `db-0002.test.ts` lines 133-141 — these tests already pass.

Gate expected after Phase 2.2 implementation:

| Gate | Expected |
|---|---|
| `npm run governance:check` | PASS (Phase 2.2 per-agent handoff counted) |
| `npm run typecheck` and `-w @wtc/web` | PASS |
| `npm test` (Vitest) | All existing 140 + new LMS cases green |
| `npm run lint` | PASS |
| `npm run db:generate -w @wtc/db` | "No schema changes" (if no 0003); OR generates 0003 (if D4 opted in) |
| `db:migrate` / `db:seed` | NOT RUN (no DATABASE_URL) |

---

## Next actions

1. **Operator: correct table count in two docs.** Edit `docs/NEXT_ACTIONS.md` line 44 to say "38
   tables" and `docs/IMPLEMENTED_FILES.md` lines 48-49 to say "38 tables". Update `docs/DATA_MODEL.md`
   line 18 to reflect 38 tables post-0002.

2. **Operator: decide on migration 0003 scope before Phase 2.2 implementation starts.** The binary
   decision: (a) global community links required in Phase 2.2 → run 0003 with the pinned_links
   ALTER + `completed_at` + optional `course_id` + optional `source`; (b) global links deferred →
   no 0003, full LMS maps to lean schema with D3 defaults.

3. **Phase 2.2 implementer: apply the D3 DTO mappings strictly.** Every repo function that returns a
   DTO must apply the column-name mapping table in D3. No raw Dates, no snake_case, no missing
   nullable defaults in returned objects.

4. **Phase 2.2 implementer: slug handling.** Course and lesson slugs are computed by the service
   layer (`slugify(title)`) and are NOT stored in the DB this phase. The route layer uses the
   computed slug for URL generation only; the DB lookup always uses `id`. This avoids a unique-index
   requirement. Document this clearly in the service method JSDoc.

5. **Phase 2.2 implementer: getCourseProgress implementation.** Without `lesson_progress.course_id`,
   the query must JOIN: `SELECT lp.* FROM lesson_progress lp JOIN lessons l ON lp.lesson_id = l.id
   WHERE l.course_id = $courseId AND lp.user_id = $userId`. This is correct and PGlite-testable. If
   0003 lands with `course_id`, switch to the direct filter after the migration.

6. **Phase 2.2 implementer: completedAt proxy.** Document in service code:
   `// completedAt is approximated by updatedAt when completed=true — real column pending 0003`.
   The DTO returns `completedAt: completed ? updatedAt.getTime() : undefined`.

7. **Phase 2.2 implementer: entitlements fail closed.** `assertEducationAccess` must throw
   `EntitlementDenied` on any non-'active' state including unknown/missing rows. Never redirect.

8. **Future Phase 3:** Add the full rich column set (slug, level, tags, is_featured, sort_order,
   thumbnail_url on courses; slug, content_type, embed_html, external_url, duration_sec, is_preview
   on lessons; file_key, file_name, file_size_bytes, mime_type, sort_order on materials) as migration
   0004 (or 0003 if the minimal 0003 above was skipped). That migration also drops
   `courses.owner_teacher_id` after verifying all repos use `teacher_profile_id`.
