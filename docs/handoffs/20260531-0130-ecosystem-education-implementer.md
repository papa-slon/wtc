# ecosystem-education-implementer handoff

## Scope

Phase 3.1 — LMS rich columns, read-only pre-implementation audit.
Lane: `packages/lms` + `apps/web/src/features/lms`.

Bounded scope under review (operator's proposal for migration 0005 + co-landed consumers):
- `courses.level` text NOT NULL DEFAULT 'beginner' + CHECK (beginner|intermediate|advanced)
- `courses.tags` text[] NOT NULL DEFAULT '{}'  (display/write only, no tag-filter)
- `lessons.content_type` text NOT NULL DEFAULT 'video' + backfill + CHECK (video|embed|article|link)
- `lessons.external_url` text (nullable, companion to content_type='link')
- Retire `deriveContentType` in `packages/lms/src/completion.ts` — replace all callers with `row.contentType`
- Teacher course form: add level + tags inputs
- Teacher lesson editor: add content_type selector + external_url field
- Student/teacher/admin display: level badge, tags chips, content_type-aware rendering

Deferred items under review (operator's proposal — confirmed or refined below).

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/EDUCATION_LMS_PLAN.md` (full, 1476 lines)
- `docs/handoffs/20260530-2330-ecosystem-db-architect.md` (full — PG7 DB-architect audit, D-2 migration spec)
- `packages/lms/src/completion.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/errors.ts`
- `packages/lms/src/lms.test.ts`
- `apps/web/src/features/lms/queries.ts` (full, 234 lines)
- `apps/web/src/features/lms/actions.ts` (full, 202 lines)
- `apps/web/src/features/lms/guard.ts` (full, 99 lines)
- `packages/db/src/schema.ts` (courses/lessons section, lines 180–210)
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`

## Files changed

None — read-only audit.

## Findings

### F-01 — high — deriveContentType callers: three sites confirmed (one named, two inline)

Evidence from grep and direct read of `apps/web/src/features/lms/queries.ts`:

1. **queries.ts:37** — import: `deriveContentType` imported from `@wtc/lms`.
2. **queries.ts:54** — `toLessonView` named mapper: `contentType: deriveContentType(l.videoUrl)`. This mapper is called from `loadTeacherCourse` (line 127) via `listLessonsForCourse`.
3. **queries.ts:186** — inline in `loadStudentCourse`: `contentType: l.videoUrl ? ('video' as const) : ('article' as const)`. This duplicates the derivation logic inline without calling `deriveContentType`, but is semantically identical.
4. **queries.ts:214** — inline in `loadStudentLesson`: `contentType: dto.videoUrl ? 'video' : 'article'`. Same pattern, second inline duplication.

There are therefore FOUR replacement points (one import, one named function call, two inlined equivalents). The operator's proposal cited `:54`, `:186`, `:214` — correct. The import at `:37` must also be removed when the function is retired.

`lms.test.ts` reference: `deriveContentType` is imported at `lms.test.ts:11` and tested at lines 49–54 in the `it('enrollmentSource + deriveContentType', ...)` block. The test exercises three cases: non-null videoUrl → 'video', null → 'article', undefined → 'article'.

**Recommendation on retirement:** Delete `deriveContentType` from `packages/lms/src/completion.ts` and its export from `packages/lms/src/index.ts`. Delete the three test assertions in `lms.test.ts:49–54` that cover `deriveContentType` (the `enrollmentSource` assertions in the same `it` block remain valid — the simplest approach is to split the `it` block into `enrollmentSource` and `deriveContentType` before deleting the latter). After migration 0005 backfills `content_type` as NOT NULL with a DB-enforced DEFAULT, the derivation is permanently dead. The backfill guarantee (`content_type` = 'video' where videoUrl IS NOT NULL, else 'article') means no legacy null rows will exist after migration. Keeping `deriveContentType` as a fallback would be wrong: it creates dual-truth that the migration spec (D-2 in the DB-architect handoff, line 189: "retire the derivation functions in the same wave") explicitly forbids.

**Replacement:** all four sites replace `deriveContentType(l.videoUrl)` / inline ternary with `l.contentType` (the column value from the DB row, post-migration). TypeScript types for the `Lesson` row returned by `@wtc/db` repos must also be updated by the db-architect to include `contentType: string` (added when `schema.ts` gets the new column). The education-implementer lane owns the `queries.ts` edits; the db-architect lane owns `schema.ts` and `repositories.ts`.

---

### F-02 — high — View-type changes required: CourseView and LessonView must grow new fields

**Current state (packages/lms/src/types.ts):**
- `CourseView` (line 22): has `id`, `title`, `description`, `productCode`, `isPublished`, `createdAt`. Does NOT have `level` or `tags`.
- `LessonView` (line 40): has `id`, `courseId`, `title`, `body`, `videoUrl`, `sortOrder`, `isPublished`, `contentType: ContentType`. Does NOT have `externalUrl`.
- `ContentType` (line 8): currently `'video' | 'article'`. Must expand to `'video' | 'embed' | 'article' | 'link'` — but see F-05 for the `embed` restriction.

**Required additions:**

`CourseView`:
```
level: string;   // 'beginner' | 'intermediate' | 'advanced'
tags: string[];  // display + write; no filter query
```

`LessonView`:
```
externalUrl?: string;  // present when contentType === 'link'
```

`ContentType` (union type):
```
'video' | 'embed' | 'article' | 'link'
```
Note: the type must include 'embed' to match the DB CHECK constraint (which the db-architect will add). The UI editor MUST NOT expose 'embed' as a selectable option this session (see F-05). The type widening is safe — TypeScript will force all switch/render paths to handle all four arms.

**Mapper edits required:**

`toCourseView` at queries.ts:48–52 — add `level: c.level` and `tags: c.tags` to the constructed view. These fields come directly from the DB row once `schema.ts` has the columns. The mapper is currently:
```ts
function toCourseView(c: CourseRow): CourseView {
  const v: CourseView = { id: c.id, title: c.title, productCode: c.productCode, isPublished: c.published, createdAt: c.createdAt.getTime() };
  if (c.description) v.description = c.description;
  return v;
}
```
New fields: `v.level = c.level; v.tags = c.tags;` — both non-optional after migration (NOT NULL DEFAULT ensures they are always present).

`toLessonView` at queries.ts:53–57 — reads `l.contentType` (replacing `deriveContentType(l.videoUrl)`) and adds `if (l.externalUrl) v.externalUrl = l.externalUrl;`.

Inline mapper at queries.ts:186 (`loadStudentCourse`) — replace the ternary with `contentType: l.contentType`. The `loadStudentCourse` return type is `LessonView & { completed: boolean }`, so `externalUrl` propagates automatically if set.

Inline mapper at queries.ts:214 (`loadStudentLesson`) — replace `contentType: dto.videoUrl ? 'video' : 'article'` with `contentType: dto.contentType` and add `if (dto.externalUrl) lesson.externalUrl = dto.externalUrl;`.

---

### F-03 — high — content_type rendering matrix for student lesson page: 'embed' must be excluded from editor this session

Current lesson page (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`) renders:
- `lesson.videoUrl` exists → open-in-new-tab link (line 63–68): safe, no raw HTML.
- `lesson.body` exists → `<p style={{ whiteSpace: 'pre-wrap' }}>` (line 70–74): escaped by React, safe.
- materials list (line 77–90): external URL links.

There is NO embed renderer. There is NO sanitizer in `packages/lms` or anywhere in the codebase. This is confirmed by the PG7 db-architect handoff (F-08: "A server-side HTML sanitizer is NOT currently present in `packages/lms` or `apps/web`").

**Content-type rendering matrix for Phase 3.1 (this session):**

| content_type | Render strategy | Safe this session? |
|---|---|---|
| `video` | Link to `lesson.videoUrl` (existing pattern) | Yes |
| `article` | `lesson.body` as pre-wrap plain text (existing pattern) | Yes |
| `link` | Styled CTA `<a href={lesson.externalUrl}>` — NEW, but trivial safe link | Yes |
| `embed` | Requires `embed_html` + sanitizer — NEITHER exists | No — must not render |

**Recommendation:** The teacher lesson editor MUST NOT expose 'embed' as a selectable content_type option this session. The content_type selector in the teacher form should be restricted to `['video', 'article', 'link']` in the Zod schema (see F-04) and the `<select>` element options. The DB CHECK constraint (video|embed|article|link) still allows 'embed' for future use — but no UI path will write it this session. The student lesson page should add a `link` rendering arm (`<a href={lesson.externalUrl}>`) and add a defensive fallback for 'embed' (e.g., an informational placeholder: "Embed content is not yet available") so that any future 'embed' rows stored via other means degrade gracefully without rendering raw HTML.

---

### F-04 — high — Zod schema updates: restricted content_type enum + conditional externalUrl

**Current state:** `actions.ts` has:
```ts
const createCourseSchema = z.object({ title: z.string().trim().min(3).max(200), description: z.string().trim().max(2000).optional() });
const lessonSchema = z.object({ title: z.string().trim().min(3).max(300), body: z.string().trim().max(20000).optional(), videoUrl: z.string().trim().url().optional() });
```

Neither schema has `level`, `tags`, `contentType`, or `externalUrl`.

**Required Zod additions:**

For course:
```ts
const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
});
```
Tags come from the form as a comma-separated string or repeated field; the action must parse them (e.g., `formData.getAll('tags')` or split a single `tags` string). The Zod `.max(10)` cap prevents unbounded tag arrays. Max 40 chars per tag prevents padding attacks.

For lesson:
```ts
const lessonSchema = z.object({
  title: z.string().trim().min(3).max(300),
  body: z.string().trim().max(20000).optional(),
  videoUrl: z.string().trim().url().optional(),
  contentType: z.enum(['video', 'article', 'link']).default('video'), // 'embed' intentionally excluded
  externalUrl: z.string().trim().url().startsWith('https://').optional(),
}).refine(
  (d) => d.contentType !== 'link' || (d.externalUrl != null && d.externalUrl.length > 0),
  { message: 'externalUrl is required when contentType is link', path: ['externalUrl'] }
);
```
The `refine` enforces that a 'link' lesson always has an `externalUrl`. The `startsWith('https://')` guard matches the existing `PinnedLinkSchema` pattern and prevents `http://` or `javascript:` links.

**Mutation pipeline order (confirmed from actions.ts and guard.ts):**
1. `assertCsrf(formData)` — CSRF first, before any session read.
2. `requireUser()` — session read.
3. `requireTeacher` / `requireCourseOwnership` / `requireEducationAccess` — RBAC + ownership, each audits failure + throws (never silent return).
4. Zod `safeParse` — input validation.
5. `if (!db) return` — demo guard.
6. DB repo call (in-txn audit via `repositories.ts`).
7. `revalidatePath`.

This order is confirmed correct and should not change. The new Zod fields are added at step 4; the repo calls at step 6 pass the new fields to `createCourse`/`updateCourse`/`createLesson`/`updateLesson` once the db-architect has added the columns and updated the repo signatures.

---

### F-05 — medium — 'embed' must be excluded from the teacher editor selector (stored-XSS gate)

This is a repeat of F-03's recommendation, stated as a standalone finding for clarity.

The DB CHECK constraint in migration 0005 (from D-2 of the db-architect handoff, line 370) will be:
```sql
CHECK ("content_type" IN ('video', 'embed', 'article', 'link'))
```
This is a future-safe constraint. The Zod schema for the teacher editor restricts the exposed enum to `['video', 'article', 'link']`. The `<select>` element in the teacher lesson form shows only those three options. No form path can write 'embed' this session. Future addition of 'embed' requires: (a) a server-side sanitizer built and security-reviewed, (b) a new Zod value added to the enum, (c) an `embed_html` column added to lessons (already spec'd in D-2 line 372 but commented out pending sanitizer). All three conditions must be met together — none independently.

---

### F-06 — medium — Dead-schema check: every in-scope column has a writer and a reader

| Column | Writer (teacher form/action) | Reader (display surface) | Dead schema? |
|---|---|---|---|
| `courses.level` | `createCourseSchema` + `createCourseAction` / `updateCourseAction` | `toCourseView` → `CourseView.level` → course cards, teacher course detail | No |
| `courses.tags` | `createCourseSchema` + `createCourseAction` / `updateCourseAction` | `toCourseView` → `CourseView.tags` → chips on course cards/detail | No |
| `lessons.content_type` | `lessonSchema` + `createLessonAction` / `updateLesson` action (to be added) | `toLessonView` (replaces `deriveContentType`) → lesson render switch | No |
| `lessons.external_url` | `lessonSchema` + lesson actions | `LessonView.externalUrl` → student lesson page 'link' arm | No |

No dead schema is introduced IF the implementation co-lands all four columns with the writers and readers above. The operator's proposal is bounded correctly on this dimension.

Note: `courses.tags` has no tag-filter query (no `WHERE tags @> $1` or `ANY()` operator). It is display+write only. This is explicitly noted in the operator's proposal and is the correct conservative choice — the db-architect handoff (F-11) documents that PGlite does not reliably implement array operators, and the real-Postgres harness (B1) is not yet unblocked. A write-only `text[]` column with a display reader is NOT dead schema: it holds data the teacher enters and shows it back. Dead schema would be a column with no writer or no reader.

---

### F-07 — info — updateLesson action is absent from actions.ts; must be added for content_type + externalUrl write path

Current `actions.ts` has `setLessonPublishedAction` (updates `published` only). There is no `updateLessonAction` for editing the full lesson payload (title, body, videoUrl, contentType, externalUrl). The teacher course editor (`/teacher/courses/[id]/page.tsx`) shows `createLessonAction` but no lesson-edit form — lessons can only be created and published/unpublished.

This means adding `contentType` and `externalUrl` to the lesson schema is not enough: an `updateLessonAction` (or an expanded `createLessonAction` that acts as upsert) is also required to provide a writer path. Without it, the teacher cannot set `contentType = 'link'` or `externalUrl` on an existing lesson, making the schema effectively write-only at creation time only.

**Recommendation:** Add `updateLessonAction` to `actions.ts` following the same pipeline (assertCsrf → requireUser → requireTeacher → Zod → db-null guard → requireCourseOwnership → updateLesson repo → revalidatePath). Add a lesson-edit form to the teacher course editor page, or a separate `/teacher/courses/[courseId]/lessons/[lessonId]/page.tsx`. This is a prerequisite for the `content_type` and `external_url` write path to be non-dead.

---

### F-08 — info — lms.test.ts deriveContentType test block: exact edit required

`lms.test.ts` line 49 `it('enrollmentSource + deriveContentType', ...)` mixes two independent assertions. When `deriveContentType` is deleted:
1. The import at line 11 must be removed.
2. The three `deriveContentType` assertions at lines 52–54 must be deleted.
3. The `enrollmentSource` assertions at lines 50–51 must be preserved.
4. The `it` description should be renamed to `'enrollmentSource'` or a separate `it` block.

The `deriveLessonState` test block (lines 43–47) is NOT affected — `deriveLessonState` is NOT in scope for retirement this session (the operator correctly deferred `lesson_progress.state` to a later slice).

---

### F-09 — info — ContentType in types.ts is too narrow; CourseAdminView does not inherit new CourseView fields

`types.ts` line 8: `export type ContentType = 'video' | 'article';` — needs to widen to `'video' | 'embed' | 'article' | 'link'`.
`CourseAdminView` (line 32) extends `CourseView` via `extends CourseView`. Once `level` and `tags` are added to `CourseView`, `CourseAdminView` inherits them automatically — no separate change needed there. The `courseAdmin()` function in `queries.ts` (line 69) constructs `CourseAdminView` via spread of `toCourseView(c)` plus additional fields — the new fields will propagate automatically through the spread.

---

## Decisions

### D-1 — Candidate scope confirmed with one mandatory addition

The operator's bounded scope is SAFE and correctly bounded, with one mandatory addition:

The in-scope items (courses.level, courses.tags, lessons.content_type with backfill, lessons.external_url) each have a confirmed writer + reader path. No item is dead schema provided `updateLessonAction` is added (F-07) as part of the same wave.

### D-2 — 'embed' excluded from teacher editor selector this session (confirmed, not just deferred)

The operator's proposal to defer 'embed' from the UI editor is confirmed as a hard requirement, not a soft deferral. No form, no Zod schema, no action may write `content_type = 'embed'` this session. The DB CHECK allows it for future use. The student page must have a defensive 'embed' fallback (informational placeholder, never raw HTML). This is a security gate, not a UX decision.

### D-3 — deriveContentType retirement: delete the function + delete its tests

After migration 0005 backfills `content_type` as NOT NULL, the derivation is permanently dead. The function must be deleted (not kept as fallback). The dual-truth problem documented in the PG7 db-architect handoff (R-03) requires this. The three test assertions covering `deriveContentType` in `lms.test.ts` are deleted; `enrollmentSource` assertions are preserved in a renamed `it` block.

### D-4 — Mutation pipeline order unchanged

The existing pipeline (assertCsrf → requireUser → requireTeacher/requireAdmin/requireCourseOwnership → Zod → db-null guard → repo → revalidatePath) is confirmed correct and must not be reordered for the new actions.

### D-5 — Deferred items confirmed with blockers

| Item | Operator's proposed blocker | Confirmed? |
|---|---|---|
| `lessons.embed_html` | No sanitizer; stored-XSS | Confirmed. No sanitizer anywhere in codebase. |
| materials file-meta | Upload security review BLOCKED (ROADMAP §7) | Confirmed. No storage adapter. |
| `pinned_links` global owner_type | Non-additive DROP+ADD CHECK; Q-6 undecided | Confirmed (db-architect handoff F-04, R-01). |
| `courses.slug` | No slug-URL consumer; routes use UUID | Confirmed (db-architect handoff F-05). |
| `lesson_progress.state` | `deriveLessonState` works; no new consumer | Confirmed (db-architect handoff F-10). |
| Teacher community/pinned-link/profile web surfaces | Own follow-up slice | Confirmed. `createPinnedLink`/`createTeacherProfile` repos exist but no web surface is wired. |

## Risks

### R-01 — TypeScript type gap: Lesson row from @wtc/db must expose contentType after schema.ts update

The `Lesson` type imported from `@wtc/db` at `queries.ts:23` comes from `repositories.ts`. Once the db-architect adds `contentType: text('content_type').notNull()` to `schema.ts`, the inferred Drizzle type for `Lesson` will include `contentType: string`. Until that happens, `l.contentType` will be a TypeScript compile error in `queries.ts`. The education-implementer lane changes to `queries.ts` and `types.ts` are gated on the db-architect lane completing its schema + repo changes first. This is a sequencing dependency: db-architect writes spine files (schema.ts, repositories.ts, migration 0005) FIRST, education-implementer consumes them.

### R-02 — tags form input parsing is not trivial

FormData does not natively serialize arrays. The teacher form must either use `<input name="tags" />` repeated (multiple inputs with same name, parsed via `formData.getAll('tags')`) or a single comma-separated input parsed server-side. The Zod schema expects `string[]`. A naive `formData.get('tags')` returns a string; the action must split and trim. This is a straightforward implementation concern but must be handled correctly — malformed input (e.g., empty strings after split) must be filtered out before Zod validation.

### R-03 — updateLessonAction is a prerequisite for the content_type write path being non-dead

If `updateLessonAction` is not added this session, `content_type` and `external_url` can only be set at lesson creation time (via `createLessonAction`). Teachers would have no way to change the content_type of an existing lesson. This would make the lesson editor incomplete and the column write path narrower than required. The implementer must add `updateLessonAction` in this session.

### R-04 — CourseRow and Lesson types from @wtc/db must be extended; the education-implementer cannot unilaterally add them

The `CourseRow` type (imported at queries.ts:24) is inferred from the Drizzle schema. Adding `level` and `tags` to the Drizzle schema in `packages/db/src/schema.ts` automatically extends `CourseRow`. The education-implementer lane does NOT touch `schema.ts` or `repositories.ts` — those are db-architect spine files. This means the education-implementer's changes to `queries.ts` and `types.ts` cannot typecheck until the db-architect wave is applied. The implementer must use the spine-serialization rule: db-architect PR lands first, then education-implementer PR applies against it.

## Verification / tests

For the education-implementer lane, the following tests must pass after the implementation:

1. `packages/lms/src/lms.test.ts` — `deriveContentType` import and assertions removed; all remaining tests pass. `enrollmentSource` tests unchanged.
2. New unit test for `deriveContentType` deletion: confirm the function is not exported from `@wtc/lms` (TypeScript compile error if any import remains).
3. `apps/web` typecheck (`npm run typecheck -w @wtc/web`): `CourseView` fields `level`/`tags` and `LessonView` field `externalUrl` resolve correctly; `contentType` reads from row not derivation; no `deriveContentType` import.
4. PGlite integration test for course creation with `level` and `tags` fields.
5. PGlite integration test for lesson creation with `contentType = 'link'` and `externalUrl`.
6. PGlite integration test: `contentType = 'embed'` rejected by Zod (not a selectable value from the editor) — confirm the action's `safeParse` returns `success: false` for `contentType = 'embed'`.
7. E2e: teacher creates a course with level + tags; course card shows level badge and tags chips.
8. E2e: teacher creates a 'link' lesson with externalUrl; student lesson page shows the CTA link, not a video player.
9. E2e: student lesson page with 'video' content type shows video link; 'article' shows body text.

## Next actions

1. **db-architect wave (spine files — MUST LAND FIRST, before any education-implementer edits):**
   - Add `courses.level`, `courses.tags`, `lessons.content_type` (with backfill), `lessons.external_url` to `packages/db/src/schema.ts`.
   - Update repo signatures in `packages/db/src/repositories.ts`: `createCourse`/`updateCourse` accept `level`/`tags`; `createLesson`/`updateLesson` accept `contentType`/`externalUrl`.
   - Write migration 0005 SQL per D-2 spec in the db-architect handoff (lines 358–378 of that doc).
   - Do NOT add `embed_html`, `file_key`, `file_name`, `file_size_bytes`, `mime_type`, `courses.slug`, `lesson_progress.state`, or the `pinned_links` CHECK change.

2. **education-implementer wave (after db-architect wave is applied):**
   - `packages/lms/src/types.ts`: add `level: string; tags: string[]` to `CourseView`; add `externalUrl?: string` to `LessonView`; widen `ContentType` to include `'link'` and `'embed'`.
   - `packages/lms/src/completion.ts`: delete `deriveContentType` function.
   - `packages/lms/src/index.ts`: remove `deriveContentType` from exports.
   - `packages/lms/src/lms.test.ts`: remove `deriveContentType` import and test assertions; rename `it` block.
   - `apps/web/src/features/lms/queries.ts`: update `toCourseView` to include `level`/`tags`; update `toLessonView` to read `l.contentType` + add `externalUrl`; fix inline mappers at lines 186 and 214; remove `deriveContentType` import.
   - `apps/web/src/features/lms/actions.ts`: expand `createCourseSchema` with `level` + `tags`; expand `lessonSchema` with `contentType` (restricted enum) + `externalUrl` + `.refine()`; add `updateLessonAction`; pass new fields to repo calls.
   - `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`: add 'link' rendering arm; add defensive 'embed' placeholder; show level badge; show tags chips.
   - `apps/web/src/app/teacher/courses/[id]/page.tsx`: add `level` select + `tags` input to course detail form; add `contentType` select (video|article|link only) + `externalUrl` field to lesson creation form; add lesson-edit form or link to new lesson-edit route.

3. **Tests-runner:** run full gate sequence — governance:check, check:core, lint, typecheck, typecheck -w @wtc/web, test (confirm deriveContentType tests deleted + new tests pass), coverage, build -w @wtc/web, e2e.

4. **Doc update:** update `docs/EDUCATION_LMS_PLAN.md` implementation status banner to reflect Phase 3.1 shipped items. Update `docs/STATUS.md` and `docs/IMPLEMENTED_FILES.md` for the new columns and retired function.
