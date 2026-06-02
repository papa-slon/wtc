# Handoff: ecosystem-education-implementer — Phase 2.3 Part 0 LMS Correctness Fixes

## Scope

Part 0 LMS correctness fixes. Four confirmed bugs patched in the two owned files:
`apps/web/src/features/lms/queries.ts` and `apps/web/src/features/lms/actions.ts`.
No schema changes. No migration. No files outside the owned list were edited.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — governance rules, stack, product codes
- `apps/web/src/features/lms/queries.ts` — LMS server-only data layer (owned)
- `apps/web/src/features/lms/actions.ts` — LMS server actions (owned)
- `packages/db/src/repositories.ts` lines 340-720 — confirmed exact signatures for `createCourse` (line 368), `upsertEnrollment` (line 688), `markEnrollmentComplete` (line 705), `getTeacherProfile` (line 673)
- `packages/lms/src/guards.ts` — `assertTeacherOwns` signature and logic
- `packages/lms/src/index.ts` — exported types and functions

## Files changed

- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/actions.ts`

## Findings

**Bug F-READ-ISOLATION** (queries.ts `loadTeacherCourse` ~line 103):
A non-admin teacher calling `loadTeacherCourse` with any arbitrary `courseId` would receive that
course's full roster (`getCourseStudentList`), lessons, and counts with no ownership check. The
function called `getCourseById`, built the `CourseAdminView` via `courseAdmin`, fetched all lessons
and students — all before any ownership assertion. Admin bypass was also absent.

**Bug F-04** (actions.ts `createCourseAction` ~line 55):
`createCourse` was called without `teacherProfileId`, so newly created courses never linked to
the teacher's `teacher_profiles` row. Ownership by profile id (`assertTeacherOwns` via
`courseTeacherProfileId === actorTeacherProfileId`) would always fail for those courses.

**Bug F-02** (actions.ts `adminEnrollAction` ~line 204):
`upsertEnrollment` was called without the optional 4th param `actorUserId`. The repo defaulted to
`input.userId` (the enrolled student) as the audit actor, recording the student as the actor of
their own admin-triggered enrollment.

**Bug F-03 (markEnrollmentComplete)**: Verified already correct in `repositories.ts` lines 705-716.
The repo selects the enrollment id inside the same transaction and uses it as `targetId`. No code
change needed in `actions.ts` for this path; `markLessonCompleteAction` calls `markEnrollmentComplete`
correctly with `(db, user.id, courseId)`.

## Decisions

1. **Teacher read-isolation**: placed the ownership check immediately after `getCourseById` returns
   (non-null), before `courseAdmin`, `listLessonsForCourse`, or `getCourseStudentList`. Used
   `getTeacherProfile` + `assertTeacherOwns` from `@wtc/lms` — the same guard already used in
   `ownsCourse()` in actions.ts — consistent with the established pattern. `null` return triggers
   404/forbidden at the route. Admin bypasses via the `if (!isAdmin)` guard.

2. **F-04 teacherProfileId**: looked up the actor's profile with `getTeacherProfile(db, user.id)`
   before `createCourse`. Spread `{ teacherProfileId: profile.id }` only when `profile?.id` is
   truthy — a teacher without a profile yet still creates the course (falls back to `ownerTeacherId`
   ownership). No breaking change to existing callers.

3. **F-02 actorUserId**: passed `Date.now()` as the explicit `now` param (3rd) and `user.id` as
   `actorUserId` (4th). The repo's comment confirms the convention: "Optional `actorUserId` lets an
   admin manual-enroll record themselves as the audit actor." Both params are optional/trailing;
   existing `enrollAction` and `markLessonCompleteAction` callers are unchanged.

4. **Import consolidation in queries.ts**: `assertTeacherOwns` added to the existing `@wtc/lms`
   import block (no second import from the same module).

5. **Import addition in actions.ts**: `getTeacherProfile` added to the `@wtc/db` import block.

## Risks

- `loadTeacherCourse` now makes one extra DB call for non-admin teachers (`getTeacherProfile`).
  This is an O(1) indexed lookup (`WHERE user_id = $1 LIMIT 1`) — negligible.
- If a teacher has no `teacher_profiles` row, `actorTeacherProfileId` is `null`. `assertTeacherOwns`
  then falls back to `ownsByUser` (`courseOwnerTeacherId === actorUserId`), which is the legacy path
  and remains correct.
- The `createCourseAction` now also calls `getTeacherProfile` — same O(1) cost, same fallback logic.

## Verification/tests

Self-verify command run after all edits:

```
npm run typecheck -w @wtc/web
```

Result: exit 0, no output (no type errors).

## Next actions

- Phase 2.3 Part 1 (billing webhook surface) is handled by the billing-access-implementer agent.
- If a db-architect adds future params to `createCourse` or `upsertEnrollment`, the callers in
  `actions.ts` will need to be updated accordingly (signatures are stable/optional now).
- Consider adding a Vitest unit test for `loadTeacherCourse` that asserts a teacher cannot access
  another teacher's course roster (tests-runner agent scope).
