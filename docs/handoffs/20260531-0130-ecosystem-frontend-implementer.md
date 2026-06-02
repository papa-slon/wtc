# ecosystem-frontend-implementer handoff

## Scope

Phase 3.1 — LMS rich (first bounded slice): read-only pre-implementation audit for the frontend lane.
Inspect all `apps/web` LMS-facing pages, the `features/lms/` server layer, the `packages/lms` public
API, and `packages/ui` primitives. Answer five operator questions precisely before any edit is made.

## Files inspected

- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/features/lms/queries.ts` (full — 234 lines)
- `apps/web/src/features/lms/actions.ts` (full — 203 lines)
- `apps/web/src/features/lms/guard.ts` (full — 99 lines)
- `packages/lms/src/completion.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `packages/db/src/schema.ts` (education section, lines 180–211)
- `docs/DESIGN_SYSTEM.md` (sections 2, 7, 10)
- `docs/EDUCATION_LMS_PLAN.md` (all sections)
- `docs/handoffs/20260530-2330-ecosystem-db-architect.md` (findings F-06, F-07, D-2)
- `docs/handoffs/0000-orchestrator-seed.md`

## Files changed

None — read-only audit.

## Findings

### F-01 — info — CREATE COURSE FORM: no level/tags inputs today

**Evidence:** `apps/web/src/app/teacher/courses/page.tsx:37–41`

The "Create a course" form (`createCourseAction` in `features/lms/actions.ts:41`) currently collects
only `title` and `description`. The `createCourseSchema` at `actions.ts:36` is
`z.object({ title, description })` — no `level`, no `tags` field. The `createCourse` repo call at
`actions.ts:52` passes `{ ownerTeacherId, title, description, published: false }` — no level or tags.

**Write surface for level/tags:** The "Course details" edit form in
`apps/web/src/app/teacher/courses/[id]/page.tsx:59–65` calls `updateCourseAction`. That action's
`createCourseSchema.partial()` at `actions.ts:62` also has no `level` or `tags` field. Both the
create and edit forms must be extended.

**Recommendation:** When migration 0005 lands, add a `<select>` for `level` (options:
beginner/intermediate/advanced) and a `<input type="text">` for comma-separated tags (parsed
server-side into `string[]`) to both the create form (`/teacher/courses/page.tsx`) and the edit
form (`/teacher/courses/[id]/page.tsx`). The Zod schemas in `actions.ts` must be extended with
`level: z.enum(['beginner','intermediate','advanced']).default('beginner')` and
`tags: z.array(z.string().max(40)).max(10).default([])`. Business logic stays in `actions.ts`
(the `features/` layer), never in the React page component.

### F-02 — info — COURSE DISPLAY: no level badge or tag chips rendered anywhere

**Evidence:** `apps/web/src/app/teacher/courses/page.tsx:51–57` (course list rows),
`apps/web/src/app/teacher/courses/[id]/page.tsx:42–44` (SectionHeader copy),
`apps/web/src/app/(app)/app/education/page.tsx:40–49` (student catalogue cards),
`apps/web/src/app/(app)/app/education/[courseId]/page.tsx:48–50` (course detail header),
`apps/web/src/app/admin/education/page.tsx:38–49` (admin table rows)

No page renders a level badge or tag chips. The `CourseView` type in
`packages/lms/src/types.ts:22–29` has no `level` or `tags` fields (they are absent by design —
the type matches the current 41-table schema that has no such columns). The `toCourseView` mapper
at `queries.ts:48–51` and `courseAdmin` at `queries.ts:69–73` do not map these fields.

**Recommendation:** After migration 0005 adds the columns, the mapper chain must be extended in
this order (single-writer spine rule): (1) `packages/db/src/schema.ts` gets the columns
(db-architect), (2) `packages/lms/src/types.ts` gains `level?: string; tags?: string[]` on
`CourseView`, (3) `queries.ts` mappers (`toCourseView` and `courseAdmin`) forward the new fields,
(4) pages render the level badge and tag chips using the existing `StatusPill` from `@wtc/ui`.

Display locations needed: teacher course list row, course editor header, student catalogue card,
student course detail header, admin courses table row.

### F-03 — info — LESSON EDITOR: no content_type selector, no external_url field

**Evidence:** `apps/web/src/app/teacher/courses/[id]/page.tsx:69–76`

The "Add a lesson" form has three fields: `title`, `body` (textarea), and `videoUrl` (optional).
No `content_type` selector or `external_url` input exists. The `lessonSchema` at `actions.ts:37`
is `z.object({ title, body?, videoUrl? })` — no `contentType` or `externalUrl`.

The `createLesson` repo call at `actions.ts:98` passes `{ courseId, title, body, videoUrl,
published: false }` — no content_type or external_url column exists in the DB today
(`packages/db/src/schema.ts:194–202` shows only `body` and `video_url` on lessons; no
`content_type` column).

There is no dedicated lesson edit page (only the lesson create inline form). The spec at
`docs/EDUCATION_LMS_PLAN.md §6.2` calls for a separate `/teacher/courses/[courseId]/lessons/[lessonId]`
page — this route does NOT exist. The existing course editor page consolidates lesson creation
inline.

**Recommendation:** When migration 0005 lands, the lesson create/edit surface needs:
- A `<select>` for `contentType` (video/article/link — embed is deferred pending sanitizer).
  Conditionally show `videoUrl` when `contentType === 'video'`, show `externalUrl` when
  `contentType === 'link'`, show `body` textarea when `contentType === 'article'`.
- This can be added inline on the course editor page (a minimal JS-free approach: use form POST
  with `contentType` hidden field and show/hide via conditional rendering on the next page load),
  or as a simple client component `<select>` with `onChange`.
- The `lessonSchema` must add `contentType: z.enum(['video','article','link'])` and
  `externalUrl: z.string().url().optional()`.
- `embed` content_type MUST NOT be offered in the UI this session (no sanitizer; stored-XSS risk).

### F-04 — info — STUDENT LESSON PAGE: content_type rendering is inline, hard-coded

**Evidence:** `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:63–74`

The lesson rendering branch is:
- `if (lesson.videoUrl)` — renders an anchor to the video URL (line 63–67)
- `if (lesson.body)` — renders plain-text body (line 70–74)
There is no rendering branch for `link` or `embed` content types. The `contentType` field on
`LessonView` is present in the type but is not used by this page to switch rendering modes.

The course page at `[courseId]/page.tsx:69` renders `{l.contentType}` as a dim label — it reads
the derived value but does not branch on it for rendering.

**Recommendation:** After migration 0005 + retirement of `deriveContentType`, add a rendering
branch for `link`: a styled CTA card with the `externalUrl`. No `embed` branch this session.
The existing `video` branch (anchor link) is acceptable for Phase 3.1. A true inline video player
is a later enhancement.

### F-05 — critical — deriveContentType: THREE inline call sites, all in queries.ts

**Evidence:**
1. `apps/web/src/features/lms/queries.ts:54` — `toLessonView()` mapper:
   `contentType: deriveContentType(l.videoUrl)`
   This is the named mapper used by `loadTeacherCourse` (line 127).
2. `apps/web/src/features/lms/queries.ts:186` — inline in `loadStudentCourse`:
   `contentType: l.videoUrl ? ('video' as const) : ('article' as const)`
   This duplicates the derivation logic without calling `deriveContentType` (a second source of truth).
3. `apps/web/src/features/lms/queries.ts:214` — inline in `loadStudentLesson`:
   `contentType: dto.videoUrl ? 'video' : 'article'`
   Third duplication.

The db-architect handoff (F-07) cited line numbers 54, 186, 214 from an earlier inspection; the
current file confirms these exact locations. Lines 186 and 214 do NOT call `deriveContentType` —
they inline the conditional expression directly. This means there are effectively three derivation
implementations, not one.

The `deriveContentType` function in `packages/lms/src/completion.ts:35` currently returns only
`'video' | 'article'`. Its type signature must be broadened to `'video' | 'article' | 'link'` when
migration 0005 lands and the `content_type` column is added, or — per the Phase-3 plan — all
three sites are migrated to read `l.contentType` directly from the DB column and
`deriveContentType` is retired.

**Recommendation:** When migration 0005 lands, retire all three sites atomically:
- `queries.ts:54`: replace `deriveContentType(l.videoUrl)` with `l.contentType` (after the
  Drizzle repo returns the new column).
- `queries.ts:186`: replace the inline conditional with `l.contentType`.
- `queries.ts:214`: replace the inline conditional with `l.contentType`.
- Remove the `deriveContentType` import from `queries.ts:37`.
- Remove or deprecate `deriveContentType` from `packages/lms/src/completion.ts` (keep for the
  `lms.test.ts` unit test path until tests are updated, then delete).

This retirement is the primary correctness gate for the frontend lane — the migration and the
caller migration must be co-landed with no interim gap where the column exists but callers still
derive from `videoUrl`.

### F-06 — info — LessonView.contentType type is too narrow

**Evidence:** `packages/lms/src/types.ts:9` — `ContentType = 'video' | 'article'`
`packages/lms/src/types.ts:48` — `contentType: ContentType` on `LessonView`

The type system currently rejects `'link'` and `'embed'` as valid `contentType` values. When the
new column lands, `ContentType` must be widened to `'video' | 'embed' | 'article' | 'link'`. But
since `embed` is deferred (no sanitizer), the immediate Phase 3.1 safe widening is
`'video' | 'article' | 'link'`. The `embed` variant can be added when the sanitizer lands.

This is a `packages/lms` change — single-writer concern for the education-implementer (not a
spine file, but it is a package boundary change that every consumer inherits). Must land in the
same wave as the DB migration and the query-layer migration.

### F-07 — info — UI PRIMITIVES: existing primitives cover all new elements; no new CSS needed

**Evidence:** `packages/ui/src/components.tsx` and `packages/ui/src/theme.css`

Existing `@wtc/ui` exports:
- `StatusPill` (tone: 'ok' | 'warn' | 'bad' | 'gold' | 'neutral') — **reuse for level badge**.
  Map: `beginner` → `neutral`, `intermediate` → `warn` (gold), `advanced` → `gold`.
  The `.wtc-pill` CSS at `theme.css:77–86` already has these tones. No new CSS class needed.
- `StatusPill` again — **reuse for a content-type label** on lesson rows. Map: `video` → `neutral`,
  `article` → `neutral`, `link` → `cyan` (if a 'cyan' tone is added) or `neutral`. No dedicated
  content-type chip component is needed.
- For **tag chips**: the `.wtc-pill` class renders as a small pill. Tags can be rendered as a
  `<span className="wtc-pill neutral">` per tag, without a new component or CSS rule. This is
  a layout pattern (wrapping flex row of pills), not a new component.
- `Card`, `SectionHeader`, `EmptyState`, `buttonClasses`, `RiskWarningBanner`, `MetricCard` are
  all present and used across the LMS pages already.

**New CSS needed:** None for level badge and tag chips (existing `.wtc-pill` suffices).
The `<select>` for content_type uses the existing `.wtc-input` class (`theme.css:207`).
The `.wtc-field label` pattern (`theme.css:206`) handles the label for the new select.
Focus ring: `.wtc-input:focus { border-color: var(--stroke-gold); }` is already defined.

**Mobile / 375px:** The `wtc-grid-2` grid collapses to single-column at `max-width:640px`
(`theme.css:67`). The content-type select and tag input will be single-column on mobile by
inheritance — no additional responsive CSS required. The `.wtc-input` touch target already has
`min-height: 44px` applied via the table-wrap override at `theme.css:177`; the base `.wtc-input`
padding (`12px 13px`) provides adequate touch target outside of table context.

**a11y for new selects/inputs:** The existing `.wtc-field` pattern includes a `<label htmlFor>`
linked to the field `id`. This pattern is used consistently across all existing forms. The new
`content_type` select and `level` select must follow this same pattern. The tag input must have a
descriptive label. No ARIA additions are needed beyond what the HTML label association provides,
since these are native form elements.

### F-08 — info — SPINE vs DISJOINT file map for the consumer wave

The spine-file rule (EXECUTION_PLAN_MASTER.md §1) designates `packages/db/src/schema.ts`,
`packages/db/src/repositories.ts`, and `packages/db/migrations/*` as single-writer (db-architect
only). Everything in `apps/web/` and `packages/lms/` is disjoint (education-implementer /
frontend-implementer).

| File | Lane | Single-writer? |
|------|------|----------------|
| `packages/db/migrations/0005_*.sql` | db-architect | YES — must land before consumers |
| `packages/db/src/schema.ts` | db-architect | YES |
| `packages/db/src/repositories.ts` | db-architect | YES |
| `packages/lms/src/types.ts` | education-implementer | disjoint (lms package) |
| `packages/lms/src/completion.ts` | education-implementer | disjoint |
| `apps/web/src/features/lms/queries.ts` | frontend-implementer | disjoint (features/) |
| `apps/web/src/features/lms/actions.ts` | frontend-implementer | disjoint (features/) |
| `apps/web/src/app/teacher/courses/page.tsx` | frontend-implementer | disjoint (pages) |
| `apps/web/src/app/teacher/courses/[id]/page.tsx` | frontend-implementer | disjoint (pages) |
| `apps/web/src/app/(app)/app/education/page.tsx` | frontend-implementer | disjoint (pages) |
| `apps/web/src/app/(app)/app/education/[courseId]/page.tsx` | frontend-implementer | disjoint |
| `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx` | frontend-implementer | disjoint |
| `apps/web/src/app/admin/education/page.tsx` | frontend-implementer | disjoint (pages) |

The correct execution order: db-architect writes 0005 first → education-implementer updates
`packages/lms` types + completion.ts → frontend-implementer updates queries.ts, actions.ts,
and all page components. No two agents write to spine files concurrently.

### F-09 — info — No business logic in React pages — currently clean

**Evidence:** All six inspected pages call either `loadTeacher*`, `loadStudent*`, or
`loadAdminEducation` from `features/lms/queries.ts` and server actions from
`features/lms/actions.ts`. The React component bodies contain no derivation logic, no entitlement
checks, no Zod validation, and no DB calls. Business logic (ownership, entitlement, audit) lives
in `features/lms/guard.ts`, `features/lms/queries.ts`, `features/lms/actions.ts`, and
`packages/lms`. This boundary is clean and must be maintained for Phase 3.1.

**Exception noted:** `queries.ts:186` and `queries.ts:214` inline the `videoUrl ? 'video' : 'article'`
conditional — this is derivation logic that belongs in `packages/lms/src/completion.ts` or, after
migration 0005, should simply read the `content_type` column. These are in the features/ layer
(not React), so they do not violate the "no business logic in React" rule, but they do create
a dual-derivation problem (F-05 above).

### F-10 — info — Admin education page: no level/tags/content_type columns in table

**Evidence:** `apps/web/src/app/admin/education/page.tsx:38–49`

The admin courses table shows: Course title, State pill, Lessons count (published/total), Enrolled
count. It does not show level or tags. After migration 0005, adding a `Level` column (using
`StatusPill` with the level tone mapping described in F-07) would give admins at-a-glance course
difficulty metadata. Tags are lower-priority in the admin table (potentially too wide at 375px).

The table already uses the `.wtc-table-wrap` pattern with `data-label` attributes, so mobile
card-stack behavior is already correct. A new `Level` column just needs a `data-label="Level"`
attribute on the `<td>`.

### F-11 — high — CURRENT SCHEMA CONFIRMED: no level, tags, content_type, external_url columns exist

**Evidence:** `packages/db/src/schema.ts:181–210`

The `courses` table has: `id, ownerTeacherId, teacherProfileId, title, description, productCode,
published, createdAt`. No `level`, no `tags`.

The `lessons` table has: `id, courseId, title, body, videoUrl, order, published`. No
`content_type`, no `external_url`.

This confirms migration 0005 must land before any frontend consumer can read these fields.
Attempting to add form inputs or display components for `level`/`tags`/`content_type` before
the DB columns exist would create forms that write to nowhere and mappers that read undefined.
The frontend-implementer must wait for the db-architect spine wave.

## Decisions

### D-1 — Candidate scope confirmation: CONFIRMED with one adjustment

The operator's proposed bounded scope is CONFIRMED correct for Phase 3.1:

| Field | Frontend verdict | Evidence |
|-------|-----------------|----------|
| `courses.level` | Confirmed: add Select to create+edit forms; display StatusPill in all course cards | F-01, F-02, F-07 |
| `courses.tags` | Confirmed: add text input (comma-sep) to create+edit forms; display pill row in course cards | F-01, F-02, F-07 |
| `lessons.content_type` | Confirmed: add Select to lesson create form; retire 3 inline derivation sites | F-03, F-05 |
| `lessons.external_url` | Confirmed: add URL input (conditional on content_type=link); render Link lesson type on student page | F-03, F-04 |

Deferred items confirmed with operator's stated reasons:
- `embed_html` — no sanitizer in codebase; stored-XSS surface. DEFER.
- `materials` file-meta — upload security review BLOCKED (ROADMAP §7). DEFER.
- `pinned_links 'global'` — non-additive DROP+ADD CHECK; no consumer. DEFER.
- `courses.slug` — no slug-URL routing; routes use UUID. DEFER.
- `lesson_progress.state` — `deriveLessonState` works; no scrub-position consumer. DEFER.
- Teacher community/profile web surfaces — separate follow-up slice. DEFER.

**One adjustment to the operator's scope:** The operator stated
"RETIRE packages/lms/src/completion.ts deriveContentType(videoUrl)". The frontend-implementer lane
confirms this retirement requires three sites to be updated atomically:
`queries.ts:54` (uses the function via import), `queries.ts:186` (inline conditional, does NOT
call `deriveContentType`), `queries.ts:214` (inline conditional, does NOT call `deriveContentType`).
Lines 186 and 214 were previously described as calling `deriveContentType` inline — they are
actually independent duplications of the same logic. All three must be migrated in the same pass.

### D-2 — No new packages/ui component needed

All required visual primitives exist: `StatusPill` for level badge, `.wtc-pill` CSS for tag chips,
`.wtc-input` + `.wtc-field` for the new select/input fields, existing `.wtc-grid-2` for responsive
layout. Zero new CSS variables or component files are needed from `packages/ui`.

### D-3 — embed content_type: UI must not offer it this session

The teacher lesson create form must NOT include `embed` as an option in the content_type selector.
The Select options must be limited to: `video`, `article`, `link`. Adding `embed` as a UI option
with no sanitizer is a stored-XSS vector even if the DB column schema allows it.

## Risks

### R-01 — Retirement of deriveContentType must be atomic with migration 0005

If the DB migration lands and the column is backfilled (video_url IS NOT NULL → 'video', else
'article'), but `queries.ts:54/186/214` still derive the value from `videoUrl`, there will be
a transient dual-truth period. The column value and the derived value will agree initially (because
the backfill logic matches the derivation logic), but any new lesson created with `content_type='link'`
via the new form will have `content_type` written to the DB while the reader still returns 'article'
(because videoUrl is null for link lessons). This is a data-correctness bug, not merely a code
smell. The three reader sites must be migrated in the same PR as the migration.

### R-02 — `ContentType` type widening must propagate cleanly

`packages/lms/src/types.ts:9` defines `ContentType = 'video' | 'article'`. The lesson create
action at `actions.ts:37` has `lessonSchema = z.object({ ..., videoUrl? })` — no contentType field.
When the schema is extended, the TypeScript type `LessonView.contentType: ContentType` must be
widened before any page tries to pass `'link'` through the type. If this is done out of order
(page sends 'link' before type is widened), TypeScript will catch it — but only if `typecheck` is
run. Gate: `typecheck -w @wtc/web` must pass before any page is deployed.

### R-03 — No lesson EDIT page exists (only inline create in course editor)

The EDUCATION_LMS_PLAN.md §6.2 specifies a separate `/teacher/courses/[courseId]/lessons/[lessonId]`
edit page. This route does not exist. For Phase 3.1, the content_type selector and external_url
field can be added to the inline create form on the course editor page. A separate lesson edit
page is a follow-up. This means teachers can set content_type at creation time but cannot change
it for existing lessons until the edit page is built. This is acceptable for Phase 3.1 but must
be documented as a follow-up item.

### R-04 — Tag input as comma-separated text requires server-side parse

The tags field on courses is `text[] NOT NULL DEFAULT '{}'`. A native HTML multi-select is
unwieldy; a comma-separated text input is simpler and requires server-side splitting and trimming.
The action layer (`features/lms/actions.ts`) must parse the comma-separated string into an array
and pass it to the Zod schema as `string[]`. This is the correct place for that logic (not in the
React page). Empty string after trim must be filtered out.

### R-05 — Admin table level column: data-label required for 375px mobile

The admin table uses `.wtc-table-wrap` with `data-label` on every `<td>`. Any new `Level` column
must include `data-label="Level"` or it will be a blank card row on mobile. This is a pure markup
requirement — no CSS change needed.

## Verification / tests

For Phase 3.1 (after migration 0005 lands):

- `npm run typecheck -w @wtc/web` — must pass with `ContentType` widened to include `'link'` and
  the three `deriveContentType` call sites replaced.
- Vitest unit test: update `packages/lms/src/lms.test.ts:49–54` — the `deriveContentType` test
  must be updated or removed when the function is retired; `ContentType` union widening test added.
- PGlite integration test (education-implementer): `createCourse` with `level='advanced'` and
  `tags=['rsi','strategy']` round-trips correctly. `createLesson` with `contentType='link'` and
  `externalUrl` writes and reads correctly.
- e2e (Playwright): teacher creates a course with level=intermediate and two tags; student sees
  the level badge and tag chips on the catalogue page; teacher creates a link lesson; student sees
  the CTA card with the external URL (no video player rendered).
- Mobile screenshot at 375px: course catalogue page shows level badge and tag chips without
  overflow; admin courses table card-stacks correctly with new Level column.

## Next actions

1. **db-architect (spine-first):** Run migration 0005 (from D-2 of db-architect handoff):
   `courses.level` (text + CHECK), `courses.tags` (text[]), `lessons.content_type` (text + backfill
   from video_url + CHECK), `lessons.external_url` (text nullable). Update `schema.ts` and
   `repositories.ts` to expose the new columns. This must land before any consumer edit.

2. **education-implementer (packages/lms):**
   - Widen `ContentType` in `packages/lms/src/types.ts` from `'video' | 'article'` to
     `'video' | 'article' | 'link'`.
   - Add `level?: string; tags?: string[]` to `CourseView` in `types.ts`.
   - Update or deprecate `deriveContentType` in `completion.ts` (it becomes a backfill-aid only;
     the DB column is now authoritative).
   - Update `lms.test.ts` to reflect the widened types.

3. **frontend-implementer (apps/web — THIS LANE):**
   - `features/lms/queries.ts`: Extend `toCourseView` and `courseAdmin` to map `level` and `tags`
     from `CourseRow`. Migrate all three `deriveContentType` call sites (lines 54, 186, 214) to
     read `l.contentType` from the DB column. Extend `StudentCourse.lessons` type and `StudentLesson`
     to include `externalUrl`.
   - `features/lms/actions.ts`: Extend `createCourseSchema` and the `updateCourseAction` schema to
     include `level` and `tags`. Extend `lessonSchema` to include `contentType` and `externalUrl`.
     Parse comma-separated tags to `string[]` server-side.
   - `apps/web/src/app/teacher/courses/page.tsx`: Add level Select and tags text input to the
     create form.
   - `apps/web/src/app/teacher/courses/[id]/page.tsx`: Add level Select and tags text input to
     the course details edit form. Add contentType Select (video/article/link, NOT embed) and
     conditional externalUrl input to the "Add a lesson" form.
   - `apps/web/src/app/(app)/app/education/page.tsx`: Add level StatusPill and tag chips to each
     course card.
   - `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`: Add level StatusPill and tag chips
     to the course header; render `l.contentType` as a dim label on each lesson row (already done
     for the derived value; ensure it reads the DB column post-migration).
   - `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`: Add a rendering branch
     for `contentType === 'link'`: a styled `<a>` card pointing to `lesson.externalUrl`. Remove the
     implicit `if (lesson.videoUrl)` / `if (lesson.body)` branches; replace with an explicit switch
     on `lesson.contentType`.
   - `apps/web/src/app/admin/education/page.tsx`: Add a Level column to the courses table with
     `data-label="Level"` and a `StatusPill` for the level value.

4. **Gates (sequential, as per SESSION_PROTOCOL):**
   `governance:check` → `check:core` → `lint` → `typecheck` → `typecheck -w @wtc/web` → `test`
   → `secret:scan` → `coverage` → `build -w @wtc/web` → `e2e`.
   Real Postgres: NOT RUN (B1 still blocked). PGlite array-operator tests for `tags` must use
   `skipIf(!REAL_POSTGRES_DATABASE_URL)` guard (per db-architect F-11).
