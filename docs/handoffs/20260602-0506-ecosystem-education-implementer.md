# ecosystem-education-implementer handoff
## Scope
Read-only LMS/product audit for Phase 3.33 durable upload compensation retry after Phase 3.32 best-effort compensation.
## Files inspected
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
None - read-only audit.
## Findings
1. High - Clean `s3-r2` object PUT can still orphan an object if DB material creation, best-effort DELETE, or the web process fails. Evidence: object PUT precedes repository creation, and Phase 3.32 compensation is request-local. Recommendation: add internal durable cleanup intent before/around object PUT and clear it only after material creation succeeds or cleanup DELETE is confirmed. Target part: LMS upload lifecycle.
2. High - Worker reconciliation can only retry rows present in `materials`. Evidence: expired object cleanup selects material rows and finalizes by material ids. Recommendation: add a separate worker-consumed cleanup task table for objects with no material row. Target part: worker cleanup retry.
3. Medium - Pending cleanup must remain operational/internal. Evidence: LMS DTOs and teacher UI currently avoid object keys. Recommendation: never project cleanup IDs, object keys, bucket paths, signed URLs, retry status, or provider errors into teacher/student DTOs or rendered artifacts. Target part: LMS DTO/UI boundary.
## Decisions
- Current Phase 3.32 behavior is best-effort only.
- Correct product representation is not a user-visible pending material; it is an internal operational cleanup task.
- Health/audit/evidence should stay aggregate-only.
## Risks
- Without durable cleanup state, process interruption after clean PUT can orphan an object indefinitely.
- Exposing retry status or object keys in LMS DTOs would create a new leakage surface.
## Verification/tests
Read-only audit only; no tests or gates run by this agent.
## Next actions
- Add `lms_object_cleanup_tasks`.
- Register pending cleanup before clean object PUT, clear it atomically with material creation, and retry through worker if needed.
- Add focused integration and artifact scanner tests.
