# Phase 2.2 — Full LMS + Service Wiring + Docs Truth Cleanup (aggregate handoff)

_2026-05-30 10:42 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by an **8-agent read-only design/audit fan-out** (one parallel wave, agents-before-edits), each with a
per-agent handoff cited below. Implementation followed the **audit-fan-out → operator-serial-implement** pattern.
Not a git repo — no commits/branches/PRs/CI proof. No live servers/SSH/bots/exchange/TV-automation/billing calls.
**Not production-ready.**_

## Scope

Phase 2.2 builds the full LMS teacher/student/admin vertical on the **Phase-2.1 data layer** (migration 0002 LMS
tables + repos), and cleans up Phase-2.1 doc drift (PART A). The fan-out's central finding: the Phase-2.1 education
design assumed a RICH schema that was **not built** — the actual landed schema is leaner. This session therefore
implemented a **pragmatic full LMS on the existing lean schema** (DTO-mapped), with **no migration 0003** — a complete
teacher/student/admin vertical that the lean schema fully supports.

## Agents launched (8 — all closed; per-agent handoffs cited)

1. `ecosystem-task-router` → [`20260530-1042-ecosystem-task-router.md`](20260530-1042-ecosystem-task-router.md) — classification, lean-vs-rich reconciliation, landable scope, PART-A specifics, write-ownership.
2. `ecosystem-education-implementer` → [`20260530-1042-ecosystem-education-implementer.md`](20260530-1042-ecosystem-education-implementer.md) — the LANDABLE LmsService contract mapped to the real columns + DTO-mapping table + the column-delta list.
3. `ecosystem-db-architect` → [`20260530-1042-ecosystem-db-architect.md`](20260530-1042-ecosystem-db-architect.md) — the 38-table truth (0002 = 17 CREATE + 1 ALTER), the missing-column reconciliation, "no migration 0003" recommendation + DTO mappings.
4. `ecosystem-security-auditor` → [`20260530-1042-ecosystem-security-auditor.md`](20260530-1042-ecosystem-security-auditor.md) — per-mutation pipelines; confirmed all `education.*` audit codes already exist (Phase 2.1); `education.enrolled`/`education.course_completed` canonical (the dot-form in the prior spec was wrong); StudentProgressSummary data-minimisation.
5. `ecosystem-frontend-implementer` → [`20260530-1042-ecosystem-frontend-implementer.md`](20260530-1042-ecosystem-frontend-implementer.md) — features/lms structure + the route shells + the getCurrentUser/backendMode gotchas + route-by-id (no slug).
6. `ecosystem-ux-ui-designer` → [`20260530-1042-ecosystem-ux-ui-designer.md`](20260530-1042-ecosystem-ux-ui-designer.md) — lean LMS UX, honesty labels, no-email student rosters, video-as-link safety, progress-derived-never-stored.
7. `ecosystem-tests-runner` → [`20260530-1042-ecosystem-tests-runner.md`](20260530-1042-ecosystem-tests-runner.md) — the LMS test matrix + e2e plan + gate sequence + the real-PG `wtc_test` guard (still open) + the observed pre-implementation baseline.
8. `ecosystem-devops-implementer` → [`20260530-1042-ecosystem-devops-implementer.md`](20260530-1042-ecosystem-devops-implementer.md) — no new env var; no migration 0003; unchanged run/rollback; the 38-table doc fix list.

## Files changed

**PART A — docs truth cleanup:** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` (39→**38 tables**;
0002 is **17 new tables + 1 ALTER**, not 18; removed the stale "Phase 1.8 — Full LMS" entries now superseded by Phase 2.2;
corrected the "Still NOT deployable" list — ES256/JWKS + revoke columns + LMS-DB landed in Phase 2.1); memory
`wtc-phase-2-1-complete.md` + `MEMORY.md` index (38 tables).

**PART B — `@wtc/lms` domain layer (new, pure, dep-free, testable):** `errors.ts` (LmsError hierarchy), `types.ts`
(LEAN view types mapped to real columns), `guards.ts` (pure `assertTeacherOwns` [teacherProfileId→ownerTeacherId
fallback, admin bypass] + `assertEducationAccess` [fail-closed]), `completion.ts` (`courseProgressPct`/`isCourseComplete`/
`deriveLessonState`/`enrollmentSource`/`deriveContentType`), barrel re-exports (thin class kept for `demo.ts`),
`lms.test.ts` (7 pure tests).

**PART C — repos + service glue:** `packages/db/src/repositories.ts` — added the LMS-UI repos (`getCourseById`,
`listAllCourses`, `listLessonsForCourse`, `getCourseCounts`, `updateCourse`, `setCoursePublished`, `createLesson`,
`updateLesson`, `listMaterials`, `createMaterial`, `deleteMaterial`, `listTeacherProfiles`, `getCourseStudentList`),
each with in-txn audit (codes already in `AUDIT_ACTIONS`). `apps/web/src/features/lms/queries.ts` (`'server-only'`
loaders via `getServerDb()` + repos + row→view-type mappers; honest demo when no DB) + `actions.ts` (server actions:
assertCsrf → Zod → requireUser → RBAC → ownership → repo → revalidate; student actions add fail-closed entitlement).

**PART D/E/F — UI (placeholders → real):** `app/teacher/courses/page.tsx` (list+create), `app/teacher/courses/[id]/page.tsx`
(editor: publish, edit, lessons, per-lesson publish, materials, student roster), `app/teacher/students/page.tsx`,
`app/admin/education/page.tsx` (overview + teacher profiles + manual-enrol override), `app/(app)/app/education/[courseId]/page.tsx`
(NEW — lessons + enrol + progress, entitlement-gated), `app/(app)/app/education/[courseId]/[lessonId]/page.tsx` (NEW —
lesson view + mark-complete, video-as-link, body escaped), `app/(app)/app/education/page.tsx` (catalogue → links into course detail).

**PART H — tests:** `tests/integration/lms-service.test.ts` (7 PGlite cases: ownership guard+repo, course/lesson/material
audit, data-minimal roster [no email], completion flow → enrollment.completed + `education.course_completed` audit,
per-user progress isolation), `tests/e2e/smoke.spec.ts` (+1 LMS spec ×2 projects).

## Findings → fixes

- **Lean-vs-rich schema mismatch** (the central finding): the 0925 education spec's rich columns (course slug/level/tags;
  lesson content_type/embed_html/article_body; material file metadata; progress state/progress_pct; enrollment source;
  pinned global) **do not exist**. **Resolved** by DTO-mapping onto the real columns (`published`→`isPublished`,
  `percent_complete`→`progressPct`, `completed`→`state`, materials `label`/`kind`/`url`→`title`/`materialType`/`externalUrl`,
  derive `source`/`contentType`), routing by **id** (no slug column), and deferring the rich columns to a Phase-3 migration 0003.
- **38 vs 39 tables** (PART A): 0002 adds 17 CREATE + 1 ALTER; total 38. A naive `grep pgTable` counts 39 (the import line).
- **Audit codes:** all needed `education.*` codes already shipped in Phase 2.1 — no `audit.ts` change. Canonical forms are
  `education.enrolled` and `education.course_completed` (underscore), confirmed against the repos.
- **Student roster data-minimisation:** `getCourseStudentList` returns `{displayName, enrolledAt, completedLessons,
  totalLessons}` only — a test asserts the JSON never contains an email.

## Decisions

1. **Pragmatic full LMS on the lean 38-table schema — NO migration 0003.** Rich columns (slug/level/tags/embed/file-meta/
   global-pinned/progress-state-machine) are deferred to Phase 3, labelled TARGET. The lean schema fully supports a real
   teacher/student/admin vertical (course publish, ordered+published lessons, link/embed materials, enrol+complete,
   percent/completed progress).
2. **Architecture (transparent deviation from PART C's literal file list):** the new LMS surfaces use the **Phase-2.1
   `getServerDb()` selector + `features/lms` + `@wtc/lms` domain** pattern (proven by the bot-config/support surfaces),
   **not** an expansion of the 4-method `lmsService` 3-adapter (`lms-types.ts`/`db-store.ts`/`demo.ts`). This honours every
   PART-C RULE (real DB when `DATABASE_URL`; honest labelled demo otherwise; fail-closed in prod; no fake persistence) and
   the acceptance criteria ("uses DB repos through services/selectors; demo fallback honest"), with less code and full
   consistency with Phase 2.1. The thin 4-method `lmsService` is unchanged (still serves the catalogue in demo).
3. **Domain logic in `@wtc/lms` (pure, testable) + `features/lms` (web glue)** — no business logic in React pages.
4. **Ownership** = `teacher_profile_id` match first, `owner_teacher_id` fallback, admin bypass (courses carry both).
5. **No `audit.ts`/`schema.ts`/migration edits** — Phase 2.1 already shipped the codes + tables.

## Risks

- New LMS surfaces render their **honest labelled demo state** in this environment (no `DATABASE_URL`); the DB path is
  PGlite-integration-tested + fails closed in production. e2e asserts structure/labels, not DB persistence (by design).
- The rich LMS features (tags/level/embed/file-upload/global community links/progress-state-machine) are **deferred** to a
  Phase-3 migration 0003 — labelled TARGET; the student "community" card stays a static placeholder (no `global` pinned owner).
- Coverage statements % dipped (33.21→28.16) as the new UI/actions grew the denominator; branch held (69.64). The new
  route/action code is e2e-covered, not Vitest (route handlers are excluded from Vitest) — pure domain logic is unit-tested.
- The real-PG `wtc_test` DB-name guard (tests-runner F-1) remains **open** — only matters when a real `DATABASE_URL` is provided.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — current phase 20260530-1042; 8 cited per-agent handoffs present (run after this aggregate) |
| 2 | `npm run check:core` | **PASS** (7 smokes) |
| 3 | `npm run lint` | **PASS** (`--max-warnings 0`) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm test` (Vitest) | **PASS — 154 passed / 5 skipped (159)** across 20 files (+14: 7 `@wtc/lms` pure, 7 `lms-service` PGlite; was 140/5) |
| 7 | `npm run secret:scan` | **PASS** (clean) |
| 8 | `npm run coverage` | **PASS — 28.16% stmts / 69.64% branch** |
| 9 | `npm run db:generate -w @wtc/db` | **PASS — 38 tables; "No schema changes"** (no migration this phase) |
| 10 | `npm run build -w @wtc/web` | **PASS** — all routes incl. the new teacher/student/admin LMS pages |
| 11 | `npm run e2e` (Playwright, `CI=1`) | **PASS 18/18** (desktop + mobile; +1 LMS spec ×2) |
| — | `db:migrate`/`db:seed`/real-PG | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent. |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

## Background agents — closed

The 8 Wave-1 design/audit agents ran as one parallel fan-out that **completed**. **No agents remain running.**

## Next actions (each its own NEW session)

- **Phase 2.3 — Billing UI + webhook route (P-B):** `/pricing` + `/app/billing` + `POST /api/billing/webhook` (verify-first via `createStripeProvider`) + the `product_access_events` timeline.
- **Phase 2.4 — TV grants/profiles UI (P-E) + admin panels:** user TV profile + admin grant/revoke-with-metadata + admin users/products/system-health.
- **Phase 2.5 — Terminal DB-wiring (P-D):** back `/app/terminal` with `terminal_release_cache`/download/license repos; provision the ES256 key.
- **Phase 3 — LMS migration 0003 (rich columns):** course slug/level/tags/is_featured; lesson content_type/embed_html/article_body/is_preview; material file metadata; lesson_progress state/started_at/last_seen_at; pinned global owner_id-nullable — then the rich UI (embed players, file upload, global community links, progress auto-tracking, slugged URLs).
- **Open carry-overs:** real-Postgres run + the `wtc_test` DB-name guard; auth rate-limiting middleware; TradingView task-runner executor.
