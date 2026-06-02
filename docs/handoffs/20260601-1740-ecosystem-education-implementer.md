# ecosystem-education-implementer handoff
## Scope
Workstream C read-only audit of teacher course CRUD, lesson detail/progress, material safe-link boundaries, no raw embed HTML, student mobile coherence, admin LMS inspection/moderation, and test/e2e gaps.

## Files inspected
- `AGENTS.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`
- `docs/handoffs/20260531-1600-lms-tv-preview-auditor.md`
- `packages/lms/src/types.ts`
- `packages/lms/src/urls.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/completion.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `packages/ui/src/theme.css`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. Target part: teacher course CRUD. Evidence: the plan still requires course delete, lesson delete, and lesson reorder (`docs/EDUCATION_LMS_PLAN.md:94`, `docs/EDUCATION_LMS_PLAN.md:99`, `docs/EDUCATION_LMS_PLAN.md:1273`, `docs/EDUCATION_LMS_PLAN.md:1290`, `docs/EDUCATION_LMS_PLAN.md:1294`), while the current LMS action surface covers create/update/publish course and create/update/publish lesson/material (`apps/web/src/features/lms/actions.ts:101`, `apps/web/src/features/lms/actions.ts:211`, `apps/web/src/features/lms/actions.ts:229`, `apps/web/src/features/lms/actions.ts:245`, `apps/web/src/features/lms/actions.ts:263`, `apps/web/src/features/lms/actions.ts:286`, `apps/web/src/features/lms/actions.ts:308`, `apps/web/src/features/lms/actions.ts:330`) and the DB repo only exposes delete for materials and pinned links (`packages/db/src/repositories.ts:599`, `packages/db/src/repositories.ts:955`). Recommendation: add scoped `deleteCourse`, `deleteLesson`, and `reorderLessons` repos/actions with ownership checks, conflict guards for enrollments/progress, in-transaction audit rows, and integration/static tests.

2. Severity: Medium. Target part: material safe links only. Evidence: the URL helper explicitly says unsafe DB values must never be emitted as live href/src at render time (`packages/lms/src/urls.ts:20`, `packages/lms/src/urls.ts:22`), and student pages use `safeHttpsUrl` (`apps/web/src/app/(app)/app/education/[courseId]/page.tsx:71`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:123`), but teacher render paths emit DB-backed links directly (`apps/web/src/app/teacher/community/page.tsx:87`, `apps/web/src/app/teacher/courses/[id]/page.tsx:118`, `apps/web/src/app/teacher/courses/[id]/page.tsx:183`, `apps/web/src/app/teacher/materials/page.tsx:44`). Recommendation: wrap teacher profile/course/material hrefs with `safeHttpsUrl`, show an unavailable state on null, and extend static tests to cover teacher render boundaries, not only student boundaries.

3. Severity: Medium. Target part: admin LMS inspection/moderation. Evidence: the admin page imports only `adminEnrollAction` (`apps/web/src/app/admin/education/page.tsx:7`), lists courses (`apps/web/src/app/admin/education/page.tsx:33`), lists teacher profiles (`apps/web/src/app/admin/education/page.tsx:57`), and provides manual enrolment (`apps/web/src/app/admin/education/page.tsx:72`), while the product plan calls for admin full CRUD/audit over education (`docs/EDUCATION_LMS_PLAN.md:77`), teacher activate/deactivate (`docs/EDUCATION_LMS_PLAN.md:720`, `docs/EDUCATION_LMS_PLAN.md:851`), and dedicated admin education course/teacher/audit pages (`docs/EDUCATION_LMS_PLAN.md:1456`, `docs/EDUCATION_LMS_PLAN.md:1458`, `docs/EDUCATION_LMS_PLAN.md:1461`). Recommendation: either narrow the Workstream C acceptance language to "inspection + manual enrolment" or add admin publish/unpublish, teacher active-state moderation, and education audit filtering with RBAC/audit tests.

4. Severity: Low. Target part: lesson detail/progress. Evidence: the current lesson detail page has a completion status and `Mark complete` form (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:59`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:64`), and the action upserts enrolment/progress then marks the course complete when all published lessons are done (`apps/web/src/features/lms/actions.ts:377`, `apps/web/src/features/lms/actions.ts:379`, `apps/web/src/features/lms/actions.ts:380`, `apps/web/src/features/lms/actions.ts:385`). The richer plan still calls for prev/next navigation, progress bar, and a video progress tracker/client island (`docs/EDUCATION_LMS_PLAN.md:865`, `docs/EDUCATION_LMS_PLAN.md:1420`, `docs/EDUCATION_LMS_PLAN.md:1421`). Recommendation: treat current progress as MVP complete-only; add prev/next, visible progress bar, and optional video-progress endpoint only if Workstream C requires richer lesson tracking.

5. Severity: Medium. Target part: student mobile coherence and e2e gaps. Evidence: the dedicated mobile education e2e only checks the catalogue route at 375px (`tests/e2e/education-ph3-1-mobile.spec.ts:26`, `tests/e2e/education-ph3-1-mobile.spec.ts:30`, `tests/e2e/education-ph3-1-mobile.spec.ts:33`), while the smoke spec reaches course detail/admin education without a 375px no-horizontal-scroll assertion and does not open lesson detail (`tests/e2e/smoke.spec.ts:77`, `tests/e2e/smoke.spec.ts:88`, `tests/e2e/smoke.spec.ts:93`). The spec itself documents that teacher editor and DB-backed detail are out of e2e reach in the demo backend (`tests/e2e/education-ph3-1-mobile.spec.ts:5`, `tests/e2e/education-ph3-1-mobile.spec.ts:11`). Recommendation: add DB-seeded or role-aware e2e coverage for student course detail and lesson detail at 375px, plus teacher course editor/admin education flows, or explicitly mark those as static/PGlite-only acceptance.

6. Severity: Low. Target part: teacher course detail mobile/readability. Evidence: the UI theme documents that responsive tables must be wrapped in `.wtc-table-wrap` and use `data-label` (`packages/ui/src/theme.css:111`, `packages/ui/src/theme.css:112`, `packages/ui/src/theme.css:119`), but the teacher course detail student roster renders a bare `.wtc-table` (`apps/web/src/app/teacher/courses/[id]/page.tsx:227`) with unlabeled cells (`apps/web/src/app/teacher/courses/[id]/page.tsx:231`). Recommendation: wrap the roster table, add `data-label` cells, and add a static guard similar to `admin-responsive.test.ts`.

## Decisions
- No source code changes were made by this agent. Only this handoff file was created.
- No raw embed HTML issue was found on the student lesson route: embed content renders a placeholder, not raw HTML (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:82`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:85`), and the static test guards against `dangerouslySetInnerHTML`/`embed_html` on that route (`tests/integration/lms-ph3-1-static.test.ts:58`, `tests/integration/lms-ph3-1-static.test.ts:64`).
- Material writes are link-only and HTTPS-only at the action boundary (`apps/web/src/features/lms/actions.ts:63`, `apps/web/src/features/lms/actions.ts:64`); the remaining safe-link finding is a render-boundary defense-in-depth gap on teacher pages.
- Admin education is currently a useful inspection/manual-enrolment MVP, not full moderation as described in the broader plan.

## Risks
- Static inspection can miss runtime layout regressions; no Playwright or visual verification was run in this read-only audit.
- The teacher direct-href issue is lower risk if all data only enters through current server actions, but it remains a legacy/direct-DB-write defense-in-depth gap.
- Course/lesson delete and reorder are product gaps, not emergency blockers, unless Workstream C acceptance defines "CRUD" literally.

## Verification/tests
- RUN: static source inspection with `rg` over LMS pages, actions, repositories, docs, and test files.
- RUN: repository state check; `git status --short` reported this directory is not a git repository.
- NOT RUN: `node scripts/gates.mjs full` - skipped to avoid long-running/write-producing gates during a read-only agent audit.
- NOT RUN: `node scripts/gates.mjs e2e` / `npm run e2e` - skipped because Playwright writes screenshots/test-results and this task requested no source edits beyond the handoff.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run lint` - skipped because this was an evidence-gathering handoff, not an implementation/verification pass.

## Next actions
1. Patch teacher link render paths to use `safeHttpsUrl` and add static tests for teacher course/material/community pages.
2. Decide whether Workstream C requires literal CRUD; if yes, implement course delete, lesson delete, and lesson reorder with ownership/conflict/audit tests.
3. Split admin education moderation into explicit subroutes/actions: course publish/unpublish, teacher activate/deactivate, and education audit filter.
4. Add mobile e2e coverage for student course detail and lesson detail at 375px, plus a DB-backed or seeded teacher/admin path if acceptance needs runtime proof.
5. Wrap the teacher course student roster table in `.wtc-table-wrap` with `data-label` cells.
