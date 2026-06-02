# ecosystem-tests-runner handoff

## Scope

Phase 3.1 — LMS rich (first bounded slice). Read-only audit of the candidate scope: migration 0005
(courses.level + courses.tags + lessons.content_type + lessons.external_url), the deriveContentType
retirement, teacher form additions, student/teacher/admin display, and all deferred items. Lane: test
plan, gate baseline, PGlite limitations, and on-disk gate-sweep approach. No code changes.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md` (Phase 2.13 summary; real-vs-mock tally)
- `docs/handoffs/20260530-2330-ecosystem-db-architect.md` (F-03..F-13; D-2 migration-0005 DDL spec)
- `docs/EDUCATION_LMS_PLAN.md` (§4.2–4.7; PG7 update block)
- `packages/lms/src/completion.ts` (deriveContentType at line 35)
- `packages/lms/src/types.ts` (ContentType, LessonView)
- `packages/lms/src/index.ts`
- `packages/lms/src/lms.test.ts` (enrollmentSource + deriveContentType test at line 49–55)
- `apps/web/src/features/lms/queries.ts` (toLessonView:54, loadStudentCourse:186, loadStudentLesson:214)
- `apps/web/src/features/lms/actions.ts` (createCourseAction, createLessonAction schemas)
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `packages/db/src/schema.ts` (courses:181, lessons:194, materials:204)
- `packages/db/migrations/0000_broken_jack_murdock.sql` (lessons:104, courses:43, materials:114)
- `tests/integration/lms-service.test.ts` (PGlite LMS round-trip tests)
- `tests/integration/lms-fixes.test.ts` (PGlite F-02/F-03/F-04 tests)
- `tests/integration/lms-rbac-pipeline.test.ts` (static pipeline guards, PG7)
- `tests/integration/db-0002.test.ts` (migration harness pattern)
- `tests/integration/db-pg5.test.ts` (PGlite beforeAll pattern; 30s timeout)
- `tests/integration/cabinet-pg9.test.ts` (static source-guard pattern)
- `tests/integration/backtester-pg10.test.ts` (static source-guard pattern — canonical Phase 3.x template)
- `tests/integration/db-axioma-jti.test.ts` (skipIf real-PG cross-connection pattern)
- `tests/e2e/smoke.spec.ts` (education e2e coverage at lines 67–103)
- `vitest.config.ts` (include: packages/**/*.test.ts + tests/integration/**/*.test.ts; exclude: apps/web/**)
- `playwright.config.ts` (retries:2, desktop 1440x900 + mobile 390x844, baseURL 3100)
- `package.json` (scripts: test, coverage, db:generate, e2e, governance:check, etc.)

## Files changed

None — read-only audit.

## Findings

### F-01 — info — deriveContentType callers confirmed: exactly 3 sites, all in queries.ts

Evidence confirms the db-architect handoff's finding. All three callers are in a single file:

- `apps/web/src/features/lms/queries.ts:54` — `toLessonView` helper: `contentType: deriveContentType(l.videoUrl)`
- `apps/web/src/features/lms/queries.ts:186` — inline in `loadStudentCourse` map lambda: `contentType: l.videoUrl ? ('video' as const) : ('article' as const)`
- `apps/web/src/features/lms/queries.ts:214` — inline in `loadStudentLesson`: `contentType: dto.videoUrl ? 'video' : 'article'`

Line 186 and 214 are NOT calling `deriveContentType()` by name — they inline the same logic directly.
Line 37–38 imports `deriveContentType` from `@wtc/lms` and uses it only at line 54.
`packages/lms/src/lms.test.ts:11,49–54` tests the function.

Retirement plan for Phase 3.1: all three sites must switch to `row.contentType` (the new column) in
the same wave as migration 0005. The test at `lms.test.ts:49–54` must be updated to verify that
`deriveContentType` is either removed or explicitly deprecated. A static source-guard in the new
integration test should assert `deriveContentType` has zero remaining call-sites.

**Recommendation:** Include a static guard asserting `queries.ts` does NOT contain `deriveContentType`
after the migration wave. The `lms.test.ts` test for `deriveContentType` itself should be removed or
repurposed once the function is retired.

**Severity:** info (confirmed scope)

---

### F-02 — high — PGlite CHECK enforcement is UNRELIABLE; Zod enum is the safety net

PGlite does not enforce Postgres CHECK constraints reliably for all column types. The db-architect
handoff (F-11) notes PGlite array operator limitations. More broadly, the PGlite version in use
(`@electric-sql/pglite ^0.2.17`) may silently accept values that violate CHECK constraints in a
non-production engine. The Phase 2.9 cross-connection jti test used `describe.skipIf` for real-PG-only
semantics.

For the bounded scope, `courses_level_check` (`beginner|intermediate|advanced`) and
`lessons_content_type_check` (`video|embed|article|link`) are CHECK constraints. PGlite integration
tests should NOT rely on CHECK enforcement as the primary validator. Instead:

- Unit tests for CHECK-equivalent validation must use the Zod enum (e.g., `z.enum(['beginner','intermediate','advanced'])`)
  in `apps/web/src/features/lms/actions.ts` — the action schema is the actual enforcement boundary in
  the non-real-PG path.
- Integration tests that do apply the raw migration SQL via PGlite should test a valid round-trip only
  (do not assume CHECK rejects an invalid value — assert the Zod boundary instead).
- If a PGlite-enforced CHECK test is written (insert an invalid level, expect rejection), it must carry
  a comment: "PGlite may or may not enforce this CHECK — this test is aspirational; the binding
  enforcement is the Zod enum in the action layer."

**Recommendation:** Primary enforcement validation through Zod unit tests. PGlite round-trips confirm
column presence and storage, not constraint enforcement. Do not block the gate on PGlite CHECK behaviour.

**Severity:** high (test design safety)

---

### F-03 — high — text[] round-trip in PGlite: basic insert/select works; array operators do NOT

The `courses.tags text[] NOT NULL DEFAULT '{}'` column must be added. PGlite can store and retrieve
`text[]` values inserted as a literal array (e.g., `['trading', 'basics']`). What it cannot do is
process array operators: `= ANY($1::text[])`, `@>`, `&&`, `@>`, overlap, etc.

The operator proposal says tags are DISPLAY/WRITE only (no tag-filter). This is the correct decision.
All integration tests for tags must only:
1. Assert the column exists and round-trips a `text[]` literal (insert `['a','b']`, select back `['a','b']`).
2. Assert the default is `'{}'` (an empty array).
3. NOT use array operators in any test.

If a future test author adds `= ANY(...)`, it must be guarded with `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`
matching the `db-axioma-jti.test.ts` cross-connection pattern.

**Recommendation:** The integration test file (`db-lms-ph3-1.test.ts` suggested name) must include an
inline comment: "No array operators — PGlite does not implement ANY/containment/overlap. Tag filtering
must remain in application code (JS array includes) until real-PG is available."

**Severity:** high (test authoring guard)

---

### F-04 — medium — vitest excludes apps/web/**; all LMS page/action guards must be static source tests

`vitest.config.ts:9` confirms: `exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**']`. The
server actions (`features/lms/actions.ts`), pages (`app/(app)/app/education/...`, `app/teacher/...`),
and guard (`features/lms/guard.ts`) cannot be executed by Vitest.

The correct pattern, established by `lms-rbac-pipeline.test.ts`, `cabinet-pg9.test.ts`, and
`backtester-pg10.test.ts`, is: read the source file as a string, then assert structural properties
(presence/absence of imports, function shapes, guard calls, no raw HTML renders).

For Phase 3.1, a new `tests/integration/lms-ph3-1-static.test.ts` should assert:
- `deriveContentType` has zero remaining call-sites in `queries.ts` after retirement.
- Mappers read `row.contentType` (not a derived expression) after migration.
- Teacher course form includes `level` select and `tags` input.
- Teacher lesson editor includes `content_type` select and `external_url` input (https-guarded in Zod).
- No raw `embed_html` render anywhere (static search for `dangerouslySetInnerHTML` + `embed_html`).
- `'embed'` is NOT exposed as a selectable option in the lesson editor content_type selector.
- `external_url` render uses `rel="noopener noreferrer"` + `target="_blank"` (safe outbound link pattern,
  matching the current `lesson.videoUrl` render at `[lessonId]/page.tsx:66`).
- Student catalogue shows `level` badge and `tags` chips.
- Lesson renders by content_type (video = safe link, article = body text, link = external_url, embed = BLOCKED).

**Recommendation:** Model the static guard test on `backtester-pg10.test.ts` (reads file as string;
checks presence/absence of patterns). Mark it `tests/integration/lms-ph3-1-static.test.ts`.

**Severity:** medium (test design completeness)

---

### F-05 — medium — embed content_type must be deferred; the 'embed' option must be absent from the editor

The operator's candidate scope correctly excludes `lessons.embed_html`. However, the schema column
`lessons.content_type` will include `'embed'` in its Postgres CHECK (`video|embed|article|link` per the
D-2 DDL spec). There is a risk that the teacher lesson editor exposes `'embed'` as a selectable option
even though there is no safe render path.

Currently `apps/web/src/app/teacher/courses/[id]/page.tsx:123` already exposes
`<option value="embed">Embed</option>` in the materials `kind` selector. This is a materials field
(not content_type), but it shows the pattern is present in the codebase.

The new `content_type` selector in the lesson editor MUST NOT include `'embed'` as an option until a
server-side sanitizer is wired. The Zod schema in `actions.ts` for `createLesson`/`updateLesson` must
use `z.enum(['video', 'article', 'link'])` (three values, no 'embed') even though the DB CHECK allows
all four.

The static source guard must assert: the lesson editor page does NOT contain
`<option value="embed">` in the content_type selector context.

**Recommendation:** Zod enum in lesson actions = `['video', 'article', 'link']` (no embed). DB CHECK
retains all four (future-proofing for when sanitizer lands). Static guard asserts 'embed' absent from
the lesson content_type UI selector.

**Severity:** medium (XSS prevention at the editor boundary)

---

### F-06 — info — external_url must be https-guarded in Zod (matches existing videoUrl pattern)

`apps/web/src/features/lms/actions.ts:37` already uses `z.string().trim().url()` for `videoUrl`.
The new `external_url` field for `content_type = 'link'` must use the same Zod `.url()` validator.

At the render layer, `external_url` must be rendered as a safe outbound link with
`rel="noopener noreferrer"` and `target="_blank"`, NOT as an iframe or script src. The pattern is
already established at `[lessonId]/page.tsx:66` for `lesson.videoUrl`.

A unit test should assert the Zod schema rejects `javascript:` and `data:` URIs (both fail `.url()`
validation by default — this is confirmatory).

**Recommendation:** Add to the Zod lesson schema: `externalUrl: z.string().trim().url().optional()`,
conditional on `contentType === 'link'`. Static guard checks the render uses `<a>` not `<iframe>`.

**Severity:** info (pattern confirmation)

---

### F-07 — info — db:generate should report 41 tables after migration 0005 (columns added, no new table)

The four candidate columns are all ADDs to existing tables (`courses`, `lessons`). No new tables are
created. The db:generate gate should continue to report 41 tables. The post-migration gate run must
confirm: "No schema changes" on a second `db:generate` run (re-run idempotency check).

The db-architect D-2 spec adds no new table. The gate list for Phase 3.1 is:

1. `npm run governance:check` — must cite all per-agent handoffs for this phase
2. `npm run check:core` — 7 smokes unchanged
3. `npm run lint` — exit 0
4. `npm run typecheck` — exit 0 (packages)
5. `npm run typecheck -w @wtc/web` — exit 0
6. `npm run secret:scan` — exit 0
7. `npm test` — Vitest (unit + integration); expected delta: +N new tests (db-lms-ph3-1 + lms-ph3-1-static + lms.test.ts update)
8. `npm run coverage` — both stmts and branch >= Phase 2.13 baseline (26.8% / 75.56%)
9. `npm run db:generate -w @wtc/db` — PASS; "No schema changes" (re-run after first generate); 41 tables confirmed
10. `npm run build -w @wtc/web` — exit 0
11. `npx playwright test` (or `npm run e2e`) — desktop + mobile; expected: new LMS e2e specs pass

**Recommendation:** The operator's post-implementation gate run must include step 9 twice (generate once
to produce the file; verify it matches the D-2 spec; generate again to confirm idempotency).

**Severity:** info (gate baseline)

---

### F-08 — low — dev-only Server-Action e2e race (retries:2) applies to LMS actions

`playwright.config.ts:13` documents the known dev-only Server-Action recompilation race:
"Next.js dev mode compiles routes (and server actions) on demand and can transiently return an
'unexpected response'". `retries: 2` is already set. The new LMS e2e tests (teacher form submits,
student lesson mark-complete) will use the same server actions and are subject to this race.

The e2e spec must NOT assert action success in a way that breaks on first-retry; it should check the
final rendered state only (e.g., after form submit, assert the course list shows the new level badge,
not that the form returned 200 on the first attempt).

**Recommendation:** Document `retries: 2` rationale in the new e2e spec comment (matching the existing
`backtester-pg10-mobile.spec.ts` approach). No additional retry configuration needed.

**Severity:** low (known dev race, documented)

---

### F-09 — info — Real-vs-mock tally update for Phase 3.1

Baseline from Phase 2.13 STATUS.md:
- NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1); Stripe checkout (B2); Axioma activation (B4); `npm ci`.
- PGlite-verified: all migration 0000–0004 repos exercised in `tests/integration/` suite.

Phase 3.1 adds to the PGlite-verified column:
- `courses.level` round-trip: insert + select confirms column persists via PGlite.
- `courses.tags` round-trip: insert `text[]` literal + select back (no array operators).
- `lessons.content_type` round-trip: insert valid enum values + select back; backfill query applied.
- `lessons.external_url` round-trip: insert nullable text + select back.
- Content-type backfill correctness: apply raw 0005 SQL in a test; assert `video_url NOT NULL` rows
  get `content_type = 'video'`; null `video_url` rows get `content_type = 'article'`.

Still NOT RUN after Phase 3.1: all B1/B2/B4 blockers unchanged.

**Recommendation:** Update `docs/STATUS.md` real-vs-mock tally after implementation with the four new
PGlite-verified items above.

**Severity:** info (tally accuracy)

---

## Decisions

### D-1 — Candidate scope verdict: CONFIRMED with one refinement

The operator's proposed bounded scope is correct and safe to land in a single wave. The deferred items
are each confirmed blocked by a specific hard blocker:

| Item | Verdict | Blocker |
|---|---|---|
| `courses.level` text NOT NULL DEFAULT 'beginner' + CHECK | CONFIRMED IN-SCOPE | Has a reader (teacher form, student badge) + writer (createCourse/updateCourse) in this session |
| `courses.tags` text[] NOT NULL DEFAULT '{}' | CONFIRMED IN-SCOPE | Has a reader (student catalogue chips) + writer (createCourse/updateCourse); no array operators per dead-code rule |
| `lessons.content_type` text NOT NULL DEFAULT 'video' + backfill | CONFIRMED IN-SCOPE | Retires deriveContentType; all 3 call sites migrated in same wave |
| `lessons.external_url` text (nullable) | CONFIRMED IN-SCOPE | companion to 'link' type; Zod-URL-validated; safe-link render only |
| `lessons.embed_html` | DEFERRED | No server-side sanitizer (stored-XSS); zero-dependency posture; EDUCATION_LMS_PLAN §4.3 |
| materials file-meta | DEFERRED | Upload security review BLOCKED (ROADMAP §7) |
| `pinned_links.owner_type='global'` | DEFERRED | Non-additive DROP+ADD CHECK; drizzle-kit emits duplicate constraint; Q-6 undecided |
| `courses.slug` | DEFERRED | No slug-URL routing consumer; routes use [courseId] UUID |
| `lesson_progress.state` | DEFERRED | dual-truth with deriveLessonState; no video-scrub consumer |

Refinement: the 'embed' content_type option MUST NOT appear in the lesson editor UI selector even
though the DB CHECK includes it. The Zod schema for createLesson/updateLesson must use
`z.enum(['video', 'article', 'link'])` (three values). The DB CHECK retains 'embed' as a valid future
value, but no editor path reaches it this session.

### D-2 — Test file naming convention for Phase 3.1

Two new integration test files, following the established naming pattern:

1. `tests/integration/db-lms-ph3-1.test.ts` — PGlite integration: column round-trips, backfill
   correctness, Zod-enum validation (not PGlite CHECK). Mirrors `db-0002.test.ts` / `db-pg5.test.ts`.
2. `tests/integration/lms-ph3-1-static.test.ts` — static source guards: deriveContentType retired,
   mappers read column, 'embed' absent from editor, external_url safe link render. Mirrors
   `backtester-pg10.test.ts` / `cabinet-pg9.test.ts`.

One new e2e spec:
3. `tests/e2e/education-ph3-1-mobile.spec.ts` — 375px + desktop: teacher sets level/content_type,
   student catalogue shows level badge, lesson renders by type. Mirrors `cabinet-pg9-mobile.spec.ts`.

### D-3 — On-disk gate sweep approach for Windows buffered output

The Windows PowerShell host buffers tool output and may interleave or truncate multi-line npm output.
The recommended approach (matching prior sessions) is to run each gate as a background process writing
to a log file, then read the log:

```powershell
npm run governance:check > logs/governance.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/governance.log
npm run lint > logs/lint.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/lint.log
npm run typecheck > logs/typecheck.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/typecheck.log
npm run typecheck -w @wtc/web > logs/typecheck-web.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/typecheck-web.log
npm test > logs/test.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/test.log
npm run db:generate -w @wtc/db > logs/db-generate.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/db-generate.log
npm run build -w @wtc/web > logs/build.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/build.log
npx playwright test > logs/e2e.log 2>&1; echo "EXIT:$LASTEXITCODE" >> logs/e2e.log
```

Then `Select-String "EXIT:" logs/*.log` gives a one-line summary per gate. The tests-runner agent reads
the log file (not the live stream) to capture exact file:line failure evidence.

## Risks

### R-01 — deriveContentType retirement creates a narrow dual-truth window if only partial

If the implementation migrates `toLessonView` (line 54) but not the inline expressions at lines 186
and 214, or vice versa, the system will have dual-source-of-truth during the session. The static guard
at `lms-ph3-1-static.test.ts` is the binding check: it must assert zero occurrences of both the
`deriveContentType` import and the inline `videoUrl ? 'video' : 'article'` pattern in `queries.ts`.

Failure mode: PGlite tests pass (they test the DB column), but the app still reads from the derived
expression, so the new column is dead schema. The static guard catches this before it ships.

### R-02 — PGlite CHECK is not the enforcement boundary; Zod schema drift would leave a gap

If the Zod schema in `actions.ts` is updated for `level` and `content_type` but the Zod types diverge
from the DB CHECK values, the app will silently accept values the DB would reject (on real Postgres).
The unit test for Zod enum validation must be explicit about which values are valid and which are
rejected, and the acceptance set must match the CHECK exactly (modulo the 'embed' exclusion for
content_type, which is intentional).

### R-03 — tags input format: FormData comma-separated string vs JSON array

The teacher form submits tags as a text input. FormData does not natively serialize arrays. The action
must parse the tags input (likely a comma-separated string) into `string[]` before inserting. The Zod
schema should handle this: `z.string().transform(s => s.split(',').map(t => t.trim()).filter(Boolean))`.
The PGlite round-trip test should insert via the repo (not raw SQL) to exercise this transform.

### R-04 — content_type backfill in migration 0005 must precede the NOT NULL constraint

The D-2 DDL spec correctly stages this: ADD COLUMN nullable → UPDATE (backfill) → ALTER COLUMN SET
NOT NULL. If the implementation applies the Drizzle schema change as NOT NULL from the start and runs
`db:generate`, the generated migration may omit the two-phase backfill (Drizzle generates the final
state, not the intermediate steps). The db-architect must hand-verify the generated SQL matches D-2
and add the backfill UPDATE if Drizzle omits it.

## Verification/tests

### Expected gate deltas (Phase 3.1, post-implementation)

Baseline: Phase 2.13 — 504 tests / 8 suites / 512 total; coverage 26.8% stmts / 75.56% branch;
db:generate 41 tables "No schema changes"; e2e 40 passed / 5 skipped / 1 flaky-green.

Expected Phase 3.1 deltas:
- `npm test`: +N tests from `db-lms-ph3-1.test.ts` (estimated 12–15: 4 column round-trips + 2 backfill
  + 2 Zod enum + 2 tags transform + 2 content_type awareness + 1 external_url https + 1 deriveContentType-retired)
  + `lms-ph3-1-static.test.ts` (estimated 8–10 static source guards) = approx +20–25 net.
  Updated `lms.test.ts` (remove/replace the `deriveContentType` test).
- `npm run coverage`: stmts likely slight dip (new app-layer code in excluded `apps/web` denominator);
  branch should hold or rise (new pure logic in `packages/lms` is unit-covered).
- `npm run db:generate -w @wtc/db`: "No schema changes" after the first generate run; 41 tables
  confirmed (no new table created).
- `npx playwright test`: +2 specs (desktop + mobile project instances of `education-ph3-1-mobile.spec.ts`).
  Total expected: ~42 passed / 5 skipped / 1 flaky-green.

### PGlite integration test outline (`db-lms-ph3-1.test.ts`)

```
describe('Phase 3.1 — courses.level column', () => {
  it('createCourse round-trips level=beginner (default)')
  it('createCourse round-trips level=intermediate')
  it('createCourse round-trips level=advanced')
  // NOTE: PGlite CHECK not asserted — Zod is the enforcement boundary
})

describe('Phase 3.1 — courses.tags column', () => {
  it('createCourse round-trips tags=[] (default)')
  it('createCourse round-trips tags=[trading, basics] (text[] literal)')
  // NOTE: No array operators (= ANY / @> / &&) — PGlite does not support them reliably
})

describe('Phase 3.1 — lessons.content_type column + backfill', () => {
  it('apply 0005 SQL: existing video_url NOT NULL rows become content_type=video')
  it('apply 0005 SQL: existing video_url NULL rows become content_type=article')
  it('createLesson round-trips content_type=video')
  it('createLesson round-trips content_type=article')
  it('createLesson round-trips content_type=link with external_url')
})

describe('Phase 3.1 — Zod enum validation (unit, no DB)', () => {
  it('level Zod enum accepts beginner|intermediate|advanced; rejects others')
  it('content_type Zod enum accepts video|article|link; rejects embed and others')
  it('external_url Zod validator rejects javascript: and data: URIs')
})
```

### Static source-guard outline (`lms-ph3-1-static.test.ts`)

```
describe('Phase 3.1 — deriveContentType retired from queries.ts', () => {
  it('queries.ts does not import deriveContentType')
  it('queries.ts has no inline videoUrl ? "video" : "article" expression')
  it('mappers read row.contentType (the column), not a derived expression')
})

describe('Phase 3.1 — embed blocked at the editor and render layer', () => {
  it('lesson editor does not expose <option value="embed"> for content_type')
  it('no dangerouslySetInnerHTML in any LMS render file')
  it('no embed_html render in student lesson page')
})

describe('Phase 3.1 — external_url render is safe (outbound link only)', () => {
  it('external_url is rendered with rel="noopener noreferrer" + target="_blank"')
  it('external_url is rendered as <a>, not <iframe>')
})

describe('Phase 3.1 — teacher form has level + tags inputs', () => {
  it('teacher course form includes level select (beginner|intermediate|advanced)')
  it('teacher course form includes tags input')
})

describe('Phase 3.1 — student catalogue displays level badge and tags', () => {
  it('student education page renders level as a badge/pill')
  it('student education page renders tags as chips')
})
```

### e2e spec outline (`education-ph3-1-mobile.spec.ts`)

```
test('375px: teacher sets level + content_type on a course/lesson', async ({ page }) => {
  // login as teacher, go to /teacher/courses, create course with level=intermediate, tags
  // go to /teacher/courses/[id], add lesson with content_type=link + external_url
  // assert no h-scroll at 375px; assert level pill visible; assert content_type rendered
})

test('desktop: student catalogue shows level badge and tags', async ({ page }) => {
  // login as user, go to /app/education
  // assert level badge ('intermediate', 'beginner', etc.) is visible on course card
  // assert tags chips are visible
})

test('desktop: student lesson renders by content_type (link = external_url)', async ({ page }) => {
  // navigate to a 'link' lesson; assert external_url rendered as safe outbound link
  // assert no iframe, no raw HTML
})
```

## Next actions

1. **db-architect**: write migration 0005 matching D-2 spec exactly; hand-verify generated SQL includes
   the backfill UPDATE for lessons.content_type before the NOT NULL constraint; update `packages/db/src/schema.ts`
   (courses: level, tags; lessons: contentType, externalUrl). Single-writer spine rule enforced.

2. **education-implementer**: retire `deriveContentType` (all 3 call sites in queries.ts); add level/tags
   to `createCourse`/`updateCourse` repo signatures; add content_type/external_url to `createLesson`/
   `updateLesson` repo signatures; update `LessonView` ContentType to `'video'|'article'|'link'|'embed'`
   in `packages/lms/src/types.ts` (type widens for schema parity; 'embed' render path stays absent);
   update Zod schemas in `actions.ts`; update teacher form pages; update student display pages.

3. **tests-runner (this lane, post-implementation)**: run all gates on-disk using the log-file approach
   (D-3). Capture exact file:line evidence for any failure. Confirm 41 tables. Report final test count
   delta. Update `docs/STATUS.md` real-vs-mock tally.

4. **Operator gate sequence**: db:generate (first) → consumers → tests. Do NOT run `db:migrate` on
   production (B1 not run). Real-PG migration is a separate operator action with the real DATABASE_URL.
