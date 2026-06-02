## Scope
Read-only regression audit after partial education/LMS edits.

## Files inspected
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`

## Files changed
None by this read-only auditor.

## Findings
- `lms-rbac-pipeline.test.ts` was stale: it expected 11 LMS server actions while the current tree had 14.
- Student education still used the thin `lmsService` top-level page and ignored `loadStudentCatalogue`.
- Student community links were still hardcoded placeholders.
- Course-level pinned links were loaded but not rendered/managed.
- The course editor had a duplicate narrow ownership check that ignored `teacherProfileId` ownership.

## Decisions
- Update the stale test to track 14 actions.
- Route top-level student education through `loadStudentCatalogue`.
- Render/manage course pinned links and per-lesson materials.
- Rely on `loadTeacherCourse` for the server-side ownership check.

## Risks
- Any future LMS action must stay CSRF-first and must not silently return on authorization denial.

## Verification/tests
- Targeted LMS static tests passed after fixes; final full gates are recorded in the aggregate handoff.

## Next actions
- Keep the static community test as a guard against regression.
