# ecosystem-education-implementer handoff

## Scope
Phase 3.34 read-only LMS durable upload cleanup dead-letter operational review/alerting audit after Phase 3.33. Focus: teacher/admin product expectations for dead-lettered pending upload cleanup tasks, with no leakage of object keys, filenames, hashes, signed URLs, scanner details, or provider responses.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `packages/lms/src/index.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/AUDIT_LOG_SCHEMA.md`

## Files changed
None - read-only audit

## Findings
1. High - Dead-letter count is recorded by the worker but stripped before admin rendering. Evidence: worker health writes `lmsPendingObjectCleanupDeadLettered` and related count-only fields at `apps/worker/src/index.ts:139`-`apps/worker/src/index.ts:144`, and makes worker status `error` when pending cleanup failed or dead-lettered at `apps/worker/src/index.ts:124`. Admin projection allowlist does not include any LMS cleanup keys at `apps/web/src/features/admin/health-detail.ts:3`-`apps/web/src/features/admin/health-detail.ts:24`, and drops non-allowlisted keys at `apps/web/src/features/admin/health-detail.ts:54`-`apps/web/src/features/admin/health-detail.ts:58`. `/admin/system-health` renders only projected details at `apps/web/src/features/admin/queries.ts:176`-`apps/web/src/features/admin/queries.ts:181` and `apps/web/src/app/admin/system-health/page.tsx:209`-`apps/web/src/app/admin/system-health/page.tsx:210`. Recommendation: add only count fields such as scanned/failed/dead-lettered/completed to the admin health projection and render a first-class LMS cleanup alert. Target part: admin system health product surface.

2. High - There is no dedicated admin operational review/alerting flow for dead-lettered pending upload cleanup tasks. Evidence: Phase 3.33 status explicitly leaves dead-letter operational review/alerting open at `docs/STATUS.md:21`-`docs/STATUS.md:23`, and production blockers repeat it at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. Admin education currently covers courses, teachers, enrolments, and manual enrolment only at `apps/web/src/app/admin/education/page.tsx:20`-`apps/web/src/app/admin/education/page.tsx:80`; system health provides generic integration health rows at `apps/web/src/app/admin/system-health/page.tsx:175`-`apps/web/src/app/admin/system-health/page.tsx:218`. Recommendation: add an admin-only ops signal for LMS cleanup dead letters, preferably count-only with runbook/acknowledgement, not a per-object browser. Target part: LMS admin operations.

3. Medium - Dead-letter transitions are not audit-logged as durable summary events. Evidence: `recordLmsObjectCleanupTaskFailure()` updates attempts/status/last error code at `packages/db/src/repositories.ts:889`-`packages/db/src/repositories.ts:911` but does not insert an audit row; summary `education.material_cleanup` audit is written only when tasks complete at `packages/db/src/repositories.ts:865`-`packages/db/src/repositories.ts:878`. The worker test verifies dead-letter state and health counts at `tests/integration/worker-tortila-snapshot.test.ts:314`-`tests/integration/worker-tortila-snapshot.test.ts:328`, while cleanup audit assertions cover completed tasks only at `tests/integration/worker-tortila-snapshot.test.ts:339`-`tests/integration/worker-tortila-snapshot.test.ts:347`. Recommendation: write a summary-only dead-letter audit or ops event with counts/scope/provider only, never task IDs or keys. Target part: audit accountability.

4. Medium - Teacher/student LMS surfaces correctly do not expose cleanup tasks; keep that boundary. Evidence: cleanup task rows store private `storage_key` and retry fields at `packages/db/src/schema.ts:302`-`packages/db/src/schema.ts:323`; worker candidate selection returns `storageKey` only for worker deletion at `packages/db/src/repositories.ts:914`-`packages/db/src/repositories.ts:950`. LMS DTO mapping exposes only material title/type/download URL/size/scan status, not cleanup IDs or storage keys, at `apps/web/src/features/lms/queries.ts:65`-`apps/web/src/features/lms/queries.ts:80` and `apps/web/src/features/lms/queries.ts:298`-`apps/web/src/features/lms/queries.ts:300`. Teacher UI renders file title, size, and scan status at `apps/web/src/app/teacher/courses/[id]/page.tsx:39`-`apps/web/src/app/teacher/courses/[id]/page.tsx:45`. Recommendation: do not show dead-lettered pending cleanup tasks to teachers/students; they are internal operational cleanup records. Target part: LMS DTO/UI boundary.

5. Medium - Existing no-leak tests are strong, but projector coverage is missing for LMS cleanup counts. Evidence: health payload tests prove no task IDs, storage-key suffixes, or object secret in worker detail at `tests/integration/worker-tortila-snapshot.test.ts:330`-`tests/integration/worker-tortila-snapshot.test.ts:338`; cleanup audit tests forbid task ID, storage key, `Authorization`, and `X-Amz` at `tests/integration/lms-object-cleanup-tasks.test.ts:145`-`tests/integration/lms-object-cleanup-tasks.test.ts:150`. Admin health projector tests currently cover bot/safety fields and secret redaction only at `tests/integration/admin-health-detail.test.ts:6`-`tests/integration/admin-health-detail.test.ts:27`. Recommendation: add projector/admin UI tests for LMS cleanup count-only fields and negative assertions for keys, filenames, hashes, signed URL tokens, scanner details, and provider bodies. Target part: admin health projection tests.

6. Low - Worker heartbeat visual severity may understate dead-letter incidents. Evidence: worker status becomes `error` for dead letters at `apps/worker/src/index.ts:124`, but the heartbeat pill uses `warn` for any non-ok/non-stale state at `apps/web/src/app/admin/system-health/page.tsx:43`-`apps/web/src/app/admin/system-health/page.tsx:45`; the integration table uses `bad` for non-ok statuses at `apps/web/src/app/admin/system-health/page.tsx:201`-`apps/web/src/app/admin/system-health/page.tsx:204`. Recommendation: render worker `error` as bad, especially when LMS pending cleanup dead-letter count is nonzero. Target part: admin system health UX.

## Decisions
- Dead-lettered pending upload cleanup tasks should remain invisible to teachers and students.
- Admins should see only operational summaries: counts, status, scope, and runbook state.
- Admin UI must not expose task IDs, object keys, filenames, hashes, signed URLs, scanner details, provider response bodies, request headers, or credentials.
- A count-only admin alert is preferable to a per-row cleanup task browser unless a later security review defines a safe, redacted, role-gated support workflow.

## Risks
- Dead-lettered orphaned objects can accumulate without an actionable admin alert because the current count fields are projected away.
- A future "review queue" implemented by listing raw `lms_object_cleanup_tasks` rows would leak private storage keys unless explicitly prevented.
- Generic worker `error` without LMS-specific count context is hard for admins to triage.
- Lack of dead-letter audit events weakens operational accountability if health rows age out or are overwritten.

## Verification/tests
- Read-only inspection only.
- Commands used: `rg` searches and line-numbered `Get-Content` reads against the current repo.
- No files edited.
- No test gates run by this audit agent.

## Next actions
1. Add count-only LMS cleanup keys to `projectHealthDetail()` and cover them in `tests/integration/admin-health-detail.test.ts`.
2. Add `/admin/system-health` LMS cleanup metrics/alert for pending cleanup failed/dead-lettered counts.
3. Add a summary-only dead-letter audit or ops event when new dead letters are observed.
4. Keep teacher/student LMS DTOs unchanged for cleanup tasks.
5. Add negative tests proving admin health/audit output does not include cleanup task IDs, storage keys, filenames, hashes, signed URL tokens, auth headers, scanner details, or provider bodies.
