# ecosystem-security-auditor handoff

## Scope

Phase 3.1 — LMS rich (first bounded slice). Security audit of the candidate schema changes (migration 0005
additive columns: courses.level, courses.tags, lessons.content_type, lessons.external_url) and their consumer
retirement (deriveContentType), plus hard verdicts on every deferred field. Read-only lane; no files changed.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SECURITY_MODEL.md` (full)
- `docs/EDUCATION_LMS_PLAN.md` (§4.3, §9, §17, §21)
- `docs/handoffs/20260530-2330-ecosystem-db-architect.md` (full — D-2 DDL spec)
- `packages/lms/src/completion.ts` — deriveContentType / deriveLessonState implementations
- `packages/lms/src/guards.ts` — assertTeacherOwns, assertEducationAccess (pure)
- `packages/lms/src/types.ts` — LessonView, MaterialView, ContentType type defs
- `packages/lms/src/errors.ts` — error hierarchy
- `packages/lms/src/index.ts` — package barrel
- `apps/web/src/features/lms/actions.ts` — full mutation pipeline (CSRF, RBAC, Zod, repo)
- `apps/web/src/features/lms/guard.ts` — requireTeacher, requireAdmin, requireCourseOwnership, requireEducationAccess
- `apps/web/src/features/lms/queries.ts` — toLessonView (lines 54, 186, 214 — all three deriveContentType call sites)
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx` — student lesson render page
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — teacher course/lesson/material editor
- `apps/web/src/lib/csrf.tsx` — assertCsrf implementation
- `packages/audit/src/redact.ts` — full redact / isSecretKey / isSecretValue
- `packages/db/src/schema.ts` (lines 1–300) — courses/lessons/materials table shape, no level/tags/content_type/external_url present
- `packages/db/src/repositories.ts` (lines 480–553) — updateCourse, createLesson, updateLesson, createMaterial, deleteMaterial

## Files changed

None — read-only audit.

## Findings

### F-01 — critical — embed_html / 'embed' content_type: HARD BLOCK; deferred status CONFIRMED

**Evidence:** `packages/lms/src/types.ts:8` — `ContentType = 'video' | 'article'`. No embed HTML column
exists in the DB (`packages/db/src/schema.ts` lessons table, lines 194–202). Grep across `packages/` and
`apps/web/src/` for `sanitize|DOMPurify|sanitizer|purify|htmlSanitize` returns zero matches. The only
reference is `packages/lms/src/types.ts:3` — a comment stating rich fields are intentionally absent.
The EDUCATION_LMS_PLAN.md §4.3 and §9.2 describe the required sanitizer policy but the implementation
does not exist.

**Verdict: CONFIRMED BLOCKED. Do NOT land embed_html this session.**

**Gate to clear before embed_html can land (mandatory, in order):**
1. A `sanitizeEmbedHtml(raw: string): string` function must exist in `packages/lms/src/` (server-side,
   zero-dep, allowlist-only: `iframe` tag with `src` (https:// only), `width`, `height`, `frameborder`,
   `allow`, `allowfullscreen`, `loading`, `title` — no `script`, no `on*`, no `data:` URIs, no `srcdoc`
   with unescaped content).
2. That function must have at minimum 10 unit tests covering: raw script injection, javascript: src, data: src,
   onerror attribute, onload attribute, srcdoc attack, nested iframe, style exfil, XSS polyglot, clean iframe.
3. A security-auditor sign-off (separate handoff) on the sanitizer implementation before any migration adds
   the column.
4. No UI may write or render the `embed_html` column until all three gates above are cleared.

**CHECK constraint note:** The D-2 DDL in the db-architect handoff correctly leaves `embed_html` commented
out (`-- ALTER TABLE "lessons" ADD COLUMN "embed_html" text;`). The CHECK constraint on `content_type` MAY
include `'embed'` as a future-valid value (`CHECK ("content_type" IN ('video', 'embed', 'article', 'link')`)
because the constraint gates DB-level writes — and since NO UI writes `content_type = 'embed'` this session,
the constraint value is inert. This is safe: the constraint documents the intended future state without
enabling any rendering path. CONFIRMED the CHECK may include 'embed' as long as no write path or render
path for 'embed' is opened this session.

---

### F-02 — high — external_url for content_type='link': HTTPS enforcement GAP in current lessonSchema

**Evidence:** `apps/web/src/features/lms/actions.ts:37`:
```ts
const lessonSchema = z.object({ ..., videoUrl: z.string().trim().url().optional() });
```
This schema does not exist yet for `external_url` (the new field this Phase 3.1 adds). However, the
comparable `materialSchema` at line 38 uses only `z.string().trim().url()` — NOT `.startsWith('https://')`.
The material URL also reaches the render page as a direct `href` at
`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:85`:
```tsx
<a className={buttonClasses('ghost')} href={m.externalUrl} target="_blank" rel="noopener noreferrer">Open ↗</a>
```
A `javascript:` or `data:` scheme URL passes `z.url()` validation and would execute in the browser on
click. The `EDUCATION_LMS_PLAN.md §5.3` specifies `.startsWith('https://')` for the `CreateMaterialSchema`
link type (`externalUrl: z.string().url().startsWith('https://')`), but the CURRENT materialSchema in
actions.ts does not enforce this. This is an existing gap for materials, and the new `external_url` lesson
field must not repeat it.

**Verdict: MANDATORY REQUIREMENT for this session's scope.**

Write path (createLesson / updateLesson actions): the new `externalUrl` field in the extended `lessonSchema`
MUST be `z.string().trim().url().startsWith('https://').optional()`. Not `z.url()` alone.

Render path (lesson page): the Phase 3.1 lesson renderer for content_type='link' must add a server-side
guard before rendering the `href`. Recommended pattern (at the server component before rendering):
```ts
const safeExtUrl = lesson.externalUrl?.startsWith('https://') ? lesson.externalUrl : null;
```
Then render `safeExtUrl` only when non-null. This is defense-in-depth: Zod at write time is the primary
control; the render guard catches any value that may have been written before the Zod rule was in place.

Additionally, the **existing materialSchema gap** (material URL not enforcing `startsWith('https://')`)
must be fixed in the same wave — the teacher can currently submit a `javascript:` material URL. The fix
is to change `apps/web/src/features/lms/actions.ts:38` materialSchema url field from `.url()` to
`.url().startsWith('https://')`. This is a security fix, not a new feature, and must land this session
alongside the content_type consumer.

**Existing videoUrl field note:** The current `lessonSchema` validates `videoUrl` as `z.string().url()` only
(no https guard). The video URL is rendered as:
```tsx
<a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">Open video ↗</a>
```
This has the same `javascript:` risk. Fix: add `.startsWith('https://')` to videoUrl Zod validation in
the extended lessonSchema. All three URL fields (videoUrl, externalUrl, material url) must enforce https.

---

### F-03 — medium — tags rendered as text: CONFIRMED SAFE (React escapes by default; no dangerouslySetInnerHTML path found)

**Evidence:** Grep for `dangerouslySetInnerHTML|innerHTML|__html` across all `.tsx` files in `apps/web/src/`
returns zero matches. The lesson body is rendered at page.tsx:73 as:
```tsx
<p style={{ whiteSpace: 'pre-wrap' }}>{lesson.body}</p>
```
React's JSX escapes all interpolated string values. Tags chips (Phase 3.1 addition) rendered as
`{tag}` inside JSX elements will also be escaped by default.

**Tags requirement:** Rendering as React text nodes is safe. No additional escaping is needed beyond
standard JSX interpolation. The implementation MUST NOT use `dangerouslySetInnerHTML` for tags or
level rendering — this is a hard rule, not a suggestion.

**Level requirement:** The `courses.level` column must be CHECK-constrained server-side
(`CHECK ("level" IN ('beginner', 'intermediate', 'advanced'))`) per the D-2 DDL spec. On the write
path, the extended `createCourseSchema` / `updateCourseSchema` in actions.ts MUST use
`z.enum(['beginner','intermediate','advanced']).default('beginner')` — not a plain `z.string()`. This
ensures the client cannot inject an arbitrary level value that bypasses the CHECK (defense-in-depth:
Zod at action boundary + DB constraint). The CHECK constraint in the migration is the server-side source
of truth; Zod is the API-layer enforcement. Both are required.

**Tags requirement on write path:** The extended schema must limit tag content:
`z.array(z.string().trim().min(1).max(40)).max(10).default([])`. This caps individual tag length and
count, preventing oversized or blank tag values from reaching the DB. Tags are text-only (no URLs, no
HTML); the trim() ensures whitespace cannot create invisible tags.

---

### F-04 — high — Mutation pipeline audit for extended write paths

**Evidence:** Current pipeline confirmed at `apps/web/src/features/lms/actions.ts`:

| Step | Implementation | Status |
|------|---------------|--------|
| assertCsrf (first) | `await assertCsrf(formData)` — line 42, 57, 72, 88, 103, 119, 135 | CONFIRMED first call in every action |
| requireUser | `await requireUser()` — immediately after assertCsrf in all actions | CONFIRMED |
| RBAC/ownership check | `requireTeacher` / `requireAdmin` / `requireCourseOwnership` | CONFIRMED; audit-on-denial + throw per guard.ts |
| Zod validation | `lessonSchema.safeParse(...)` / `createCourseSchema.safeParse(...)` | CONFIRMED; returns early on failure (no-op, no 500) |
| Demo guard | `if (!db) return` | CONFIRMED after Zod, before repo |
| Repo (in-txn audit) | `createLesson/updateLesson/updateCourse` in repositories.ts | CONFIRMED; all use db.transaction with auditLogs insert |

**Extended path gaps for Phase 3.1 new fields:**

a) `createCourseAction` / `updateCourseAction`: The existing `createCourseSchema` is `z.object({ title, description })`.
   Phase 3.1 will extend this to include `level` and `tags`. The extension must stay in the same
   `safeParse` call — not a second parse after the first succeeds. Adding `level` and `tags` to the
   existing Zod object (with the enum/array constraints from F-03) is the safe pattern.

b) `createLessonAction` / `updateLessonAction` (the latter does not yet exist; `setLessonPublishedAction`
   only changes `published`): Phase 3.1 adds `content_type` and `external_url`. Any new `updateLessonAction`
   that writes content_type or external_url must follow the same pipeline: assertCsrf → requireUser →
   requireTeacher → requireCourseOwnership → Zod (including https guard on externalUrl) → repo.

c) `requireCourseOwnership` is correctly placed AFTER the db-null demo guard in all current actions
   (lines 66, 81, 97, 113, 129, 144). This ordering must be preserved in extended actions — ownership
   check requires a loaded course from DB and cannot run in demo mode.

d) **No secrets in audit logs:** The current `updateCourse` repo audit at repositories.ts:489 writes
   `after: { ...patch }` — for the extended patch including `level` (text) and `tags` (string array),
   these are metadata values not secrets. The `redact()` function in `packages/audit/src/redact.ts`
   would not trigger on `level` or `tags` (no match in SECRET_HINTS). This is correct — tags and level
   are non-secret metadata. The audit log entry for lesson updates MUST NOT include `externalUrl` values
   in `after` without redaction review, but since external URLs are not secret, logging them is acceptable.
   File content, signed URLs, and body/video content must never appear in audit metadata.

e) **Denial audit codes confirmed:** `guard.ts` uses `'education.rbac_denied'` and
   `'education.entitlement_denied'` (lines 33, 56, 63, 88, 96). These are the correct denial event codes
   per the PG7 handoff. No new codes are required for Phase 3.1.

---

### F-05 — medium — Existing materialSchema missing https guard (pre-existing gap, must fix this session)

**Evidence:** `apps/web/src/features/lms/actions.ts:38`:
```ts
const materialSchema = z.object({ ..., url: z.string().trim().url(), ... });
```
This allows `javascript:` or `data:` scheme URLs to pass validation. The rendered href at
`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:85` would execute on click.
The EDUCATION_LMS_PLAN.md §5.3 `CreateMaterialSchema` specifies `.startsWith('https://')` but this was
not implemented when actions.ts was written (PG2). This gap exists regardless of Phase 3.1 work.

**Verdict:** Fix is in scope this session — it is the same file/function that will be touched to add
`external_url` support. The fix is one character addition: change `z.string().trim().url()` to
`z.string().trim().url().startsWith('https://')` for the `url` field in materialSchema.

---

### F-06 — info — deriveContentType retirement: co-landing requirement CONFIRMED CORRECT

**Evidence:** `packages/lms/src/completion.ts:35-37` — `deriveContentType(videoUrl)` is the sole source
of truth for lesson content type. Call sites confirmed at `apps/web/src/features/lms/queries.ts`:
- Line 54: `contentType: deriveContentType(l.videoUrl)` — in `toLessonView`
- Line 186: `contentType: l.videoUrl ? ('video' as const) : ('article' as const)` — inline in `loadStudentCourse`
- Line 214: `contentType: dto.videoUrl ? 'video' : 'article'` — inline in `loadStudentLesson`

The operator's Phase 3.1 scope is correct: all three call sites must be retired in the same wave as
the `lessons.content_type` column lands. The db-architect's D-2 DDL correctly includes the backfill:
`UPDATE "lessons" SET "content_type" = CASE WHEN "video_url" IS NOT NULL THEN 'video' ELSE 'article' END`.

After migration, all three sites in queries.ts must read `l.contentType` (from the DB column via the
repo) instead of calling `deriveContentType`. The `deriveContentType` function in completion.ts should
be deleted (or deprecated with a TODO comment confirming it is replaced by the column) in the same
commit wave. Leaving the function alive after the column lands creates dual-source-of-truth.

**Types.ts update required:** `ContentType = 'video' | 'article'` at `packages/lms/src/types.ts:8`
must be extended to `'video' | 'article' | 'link'` (not `'embed'` this session — embed is blocked per F-01).
`LessonView.contentType` type must be updated accordingly.

---

### F-07 — info — Audit log redact coverage for new fields confirmed adequate

**Evidence:** `packages/audit/src/redact.ts` — SECRET_HINTS list does not include 'level', 'tags',
'contentType', 'externalUrl'. These are non-secret metadata. The redact function correctly passes them
through. The repo audit patterns (`after: { title, ... }`) in repositories.ts exclude body content
from the audit `after` field (line 506 — `after: { courseId, title }` only; body is excluded). This
pattern must be maintained: the Phase 3.1 extended `createLesson`/`updateLesson` repos must NOT include
lesson `body` or `videoUrl` raw content in the audit `after` payload — only metadata (title, courseId,
contentType, sortOrder). External URLs MAY be logged (they are not secrets) but the body text and
video embeds must not.

---

### F-08 — info — lesson_progress.state, courses.slug, pinned_links global, materials file-meta: deferred verdicts CONFIRMED

These four items are not part of Phase 3.1 scope per the operator's proposal. The db-architect handoff
provides comprehensive evidence for each deferral:
- `lesson_progress.state`: `deriveLessonState` works; adding column without retiring derivation = dual-truth.
  No video-scrub state-machine consumer exists. CONFIRMED deferred.
- `courses.slug`: Routes use UUID (`[courseId]`). No slug-URL routing consumer in `apps/web/src/app`.
  CONFIRMED deferred.
- `pinned_links.owner_type='global'`: Non-additive DROP+ADD CHECK; drizzle-kit emits second constraint
  leaving both live; Q-6 undecided. CONFIRMED deferred.
- `materials file-meta`: Upload security review BLOCKED (ROADMAP §7); no object-storage adapter.
  CONFIRMED deferred.

---

## Decisions

### D-1 — OVERALL VERDICT: Phase 3.1 bounded scope is SAFE TO PROCEED with the following mandatory conditions

The operator's proposed bounded scope (courses.level, courses.tags, lessons.content_type, lessons.external_url,
consumer retirement of deriveContentType, teacher form additions, student/teacher/admin display) is correctly
bounded. Security verdict: SAFE TO PROCEED, subject to the four mandatory conditions below. Any condition
not met BLOCKS the wave.

**Mandatory condition M-1 (blocking):** The new `lessonSchema` for createLesson/updateLesson MUST enforce
`externalUrl: z.string().trim().url().startsWith('https://').optional()`. The existing `videoUrl` field
must also be strengthened to `.startsWith('https://')` in the same edit. The existing materialSchema `url`
field must be fixed to `.startsWith('https://')`. All three fixes are in the same file
(`apps/web/src/features/lms/actions.ts`) and must land together.

**Mandatory condition M-2 (blocking):** The lesson page renderer for `content_type='link'` must add a
server-side https guard before rendering the external_url as a href:
`const safeExtUrl = lesson.externalUrl?.startsWith('https://') ? lesson.externalUrl : null;`
and render only when `safeExtUrl` is non-null. This is defense-in-depth for the write guard above.

**Mandatory condition M-3 (blocking):** The `level` field MUST be `z.enum(['beginner','intermediate','advanced'])`
in the extended course schemas — never `z.string()`. The DB CHECK constraint and Zod enum must be co-present.

**Mandatory condition M-4 (blocking):** The `embed` value in the `content_type` CHECK constraint is
permitted (future-proofing), but NO write path may accept `content_type = 'embed'` from teacher input
this session, and NO render path may output `embed_html` content. If the content_type selector UI is
added for teachers, `embed` must be absent from the options until the sanitizer lands and is audited.

### D-2 — embed_html BLOCK is permanent for this session; CHECK may include 'embed' as inert value

The `embed_html` column must NOT be added to the migration or schema this session. The CHECK constraint
on `content_type` may include `'embed'` as a future-valid value because no write path will produce it.
The gate to clear before next session: sanitizer in packages/lms + 10 unit tests + security-auditor sign-off.

### D-3 — Existing material URL schema gap is a security fix, not a feature; it must be fixed this session

The materialSchema `url` field in `apps/web/src/features/lms/actions.ts:38` must be fixed to enforce
`startsWith('https://')`. This is a pre-existing vulnerability that the Phase 3.1 wave touches the same
file for, and must be resolved. It is not optional scope — it is a mandatory security repair.

## Risks

### R-01 — javascript:/data: URL execution via external_url or material URL if https guard is missing

If M-1 or M-2 is not implemented, a teacher can submit a `javascript:` URL as external_url or a material
URL. When a student clicks "Open ↗", the browser executes the javascript: payload. React does not sanitize
href attributes. This is a XSS vector. Severity: critical if not fixed.

### R-02 — Dual-source-of-truth if deriveContentType is not retired in the same wave

If the `lessons.content_type` column is added but `deriveContentType` callers in queries.ts are not
updated simultaneously, the DB column and the function derivation will diverge whenever a teacher
updates a lesson's content_type after backfill. The column reflects the new value; the derivation
still reads videoUrl. The student sees the wrong content type.

### R-03 — embed content_type written inadvertently if UI includes 'embed' option

If a teacher-facing content_type selector includes 'embed' as a selectable option, teachers will
submit `content_type = 'embed'` — the DB CHECK allows it — and then the embed_html column does not
exist, so the lesson is stored with an orphaned type and no renderable content. Guard: the content_type
selector UI must list only `['video', 'article', 'link']` this session.

### R-04 — tags array injection via client: bounded by Zod max(10) + max(40) per tag

Teacher input for tags must be validated server-side only. Even with Zod enforcement, a maximally
adversarial teacher (or compromised teacher session) can submit 10 tags of 40 chars each. This is
acceptable — the values are displayed as escaped text, and the volume is bounded. The array-max guards
in M-3 / the Zod schema are sufficient.

### R-05 — PGlite array operator limitation for tags (inherited from db-architect R-04)

`text[]` in Postgres supports array operators that PGlite does not reliably implement. If Phase 3.1
adds tag-filter queries using `ANY` or `@>`, those integration tests must use `skipIf(!REAL_POSTGRES_DATABASE_URL)`
guards. The current operator scope says NO array filter queries — tags are DISPLAY/WRITE only. This risk
is mitigated by the operator's constraint; it must be enforced in the implementer's scope.

## Verification / tests

**Tests that must exist before this wave gates green (in addition to existing suite):**

1. Unit test: `createLesson` action rejects `externalUrl = 'javascript:alert(1)'` → Zod safeParse fails.
2. Unit test: `createLesson` action rejects `externalUrl = 'http://insecure.com'` (http, not https) → safeParse fails.
3. Unit test: `createLesson` action accepts `externalUrl = 'https://example.com'` → safeParse succeeds.
4. Unit test: `createMaterial` action rejects `url = 'javascript:alert(1)'` → safeParse fails.
5. Unit test: `createCourse` action rejects `level = 'expert'` (not in enum) → safeParse fails.
6. Unit test: `createCourse` action accepts `level = 'advanced'` → safeParse succeeds.
7. PGlite integration test: `createLesson` with `content_type = 'video'` persists and reads back correctly.
8. PGlite integration test: `createLesson` with `content_type = 'link'` and valid external_url persists.
9. PGlite integration test: `createLesson` with `content_type = 'embed'` must be blocked at the Zod/action layer (content_type selector excludes 'embed' from teacher input).
10. Pure unit test for `deriveContentType` deletion: confirm it is no longer exported after retirement.
11. Unit test for the render-time safe-URL guard: a lesson with `externalUrl = 'javascript:alert(1)'` (hypothetically in DB) renders null href (guard catches it at render).

**Existing tests that must remain green:** all 504 Vitest + 40 e2e from the PG13 baseline.

## Next actions

1. **db-architect (single-writer spine, first):** Run the additive migration 0005 columns from D-2:
   `courses.level` (NOT NULL DEFAULT 'beginner' + CHECK), `courses.tags` (text[] NOT NULL DEFAULT '{}'),
   `lessons.content_type` (additive nullable, backfill CASE WHEN video_url IS NOT NULL THEN 'video' ELSE 'article', then NOT NULL + CHECK including 'embed' as future value),
   `lessons.external_url` (nullable, no constraint — Zod + render guard enforce https).
   Update `packages/db/src/schema.ts` and `packages/db/src/repositories.ts` for these four columns.
   Update `updateCourse` signature to accept `level?` and `tags?`. Update `createLesson`/`updateLesson`
   to accept `contentType` and `externalUrl`. Do NOT add `embed_html` column.

2. **education-implementer (after db-architect wave):**
   a. Fix `materialSchema` url field: `.url().startsWith('https://')` (M-1 security fix, pre-existing gap).
   b. Extend `createCourseSchema` / `updateCourseSchema`: add `level: z.enum([...]).default('beginner')`,
      `tags: z.array(z.string().trim().min(1).max(40)).max(10).default([])`.
   c. Extend `lessonSchema` for createLesson/updateLesson: add
      `contentType: z.enum(['video','article','link']).default('video')` (NOT 'embed'),
      `externalUrl: z.string().trim().url().startsWith('https://').optional()`,
      strengthen `videoUrl` to `.url().startsWith('https://')`.
   d. Retire `deriveContentType` from `packages/lms/src/completion.ts`; update all three call sites in
      `apps/web/src/features/lms/queries.ts` (lines 54, 186, 214) to read `l.contentType` from DB row.
   e. Update `packages/lms/src/types.ts` ContentType to `'video' | 'article' | 'link'`.
   f. Add teacher form inputs: level selector (enum options only), tags input (comma-split, max 10),
      content_type selector (options: video, article, link — NOT embed).
   g. Add student/teacher/admin display: level badge, tags chips (React text nodes only, no innerHTML),
      content_type-aware lesson rendering: 'link' renders `safeExtUrl` guard (M-2).
   h. All 11 new tests from Verification section above.

3. **security-auditor (this session gate):** Block any attempt to add `embed_html` column or 'embed'
   option in the teacher UI. Block any `external_url` or material `url` write path that lacks the
   `startsWith('https://')` Zod rule. Gate sign-off comes after implementer lands the wave and tests pass.
