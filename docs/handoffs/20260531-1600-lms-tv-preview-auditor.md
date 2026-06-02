# LMS And TradingView Preview Auditor

## Scope
Read-only audit of education, teacher, and TradingView access surfaces, focused on whether the current package gives visible product progress and what is still not production-real.

## Files inspected
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/actions.ts`

## Files changed
- None by this auditor; read-only findings informed the Phase 3.6 operator work.

## Findings
The LMS has a usable teacher/student/admin MVP, including courses, lessons, materials metadata, community/profile links, and mobile catalogue coverage. It still lacks object storage for file bytes, stored embed sanitization, and richer student progress/community flows. TradingView access has a manual user/admin queue and atomic DB grant/revoke logic, but no private-invite automation.

## Decisions
Do not claim TradingView automation. Do not render raw embed HTML until a sanitizer is built and tested. Keep LMS upload/object-storage work as a real production blocker rather than a fake form.

## Risks
The most dangerous UX risk is implying that course uploads or TradingView invites are automated when they are currently manual/admin-mediated or metadata-only.

## Verification/tests
Recommended final run: strict e2e over education, teacher, and admin-TV routes with zero flaky tests. Phase 3.6 kept these routes in the strict e2e sweep.

## Next actions
Build object-storage upload, embed sanitizer, and private-invite automation only after separate security and integration acceptance.
