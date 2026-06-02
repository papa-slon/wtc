## Scope
Read-only education/LMS audit for the broad Phase 3.3 pass. This handoff is operator-persisted from the first education-room subagent output before implementation.

## Files inspected
- `apps/web/src/app/teacher/layout.tsx`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/lib/nav.ts`

## Files changed
None by this read-only auditor.

## Findings
- `/teacher/materials` was still a placeholder.
- `/teacher/community` was missing while `TEACHER_NAV` expected the surface.
- Teacher layout did not consume the canonical teacher nav.
- Student education community links were hardcoded as "soon" placeholders.
- Pinned-link and teacher-profile repos/actions existed but had no user-facing UI.

## Decisions
- Land teacher profile, teacher pinned links, course pinned links, materials list/delete, and student community rendering in one bounded pass.
- Keep global pinned links, file uploads, embed HTML, slugs, and object storage deferred.

## Risks
- All URL writes must remain `https://`-only.
- Course and teacher profile ownership must be enforced server-side.

## Verification/tests
- Final verification is recorded in the aggregate handoff for this epoch.

## Next actions
- Add static tests for community/materials surfaces and action pipeline coverage.
