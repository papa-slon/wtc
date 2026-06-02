# ecosystem-db-architect handoff
## Scope
Phase 3.34 read-only DB architecture audit for LMS object cleanup dead-letter operational review/alerting after Phase 3.33. Scope was limited to current schema, repositories, migrations, worker/test evidence, and the DB/repository shape needed to list/count/review dead-lettered `lms_object_cleanup_tasks` without exposing storage keys or user/file metadata.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/db/migrations/meta/0014_snapshot.json`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md`
## Files changed
None - read-only audit.
## Findings
1. Severity: High. Evidence: `lms_object_cleanup_tasks` already has the durable dead-letter state needed for read-only operational review: `status` allows `dead_letter`, retry fields are present, and the table has no lesson/course/user/file metadata columns in schema/migration at `packages/db/src/schema.ts:302-323` and `packages/db/migrations/0014_lazy_puff_adder.sql:1-20`; the data model also documents that it never stores filename, MIME, hash, bytes, label, lesson/course/user id, signed URL, auth header, scanner secrets, or raw provider response at `docs/DATA_MODEL.md:876-900`. Recommendation: do not add a new table or metadata columns for Phase 3.34 read-only listing/counting/reviewing; add repository readers over the existing table. Target part: DB schema/migration boundary.
2. Severity: High. Evidence: the only current cleanup-task reader is worker-oriented and returns `storageKey` by contract at `packages/db/src/repositories.ts:784-791`, selects it at `packages/db/src/repositories.ts:917-924`, validates it at `packages/db/src/repositories.ts:935-950`, and the worker needs it for signed DELETE at `apps/worker/src/lms-object-cleanup.ts:199-205`. Recommendation: add a separate sanitized dead-letter review API instead of reusing `listPendingLmsObjectCleanupTasks()`. Suggested shape: `countDeadLetteredLmsObjectCleanupTasks(db)` plus `listDeadLetteredLmsObjectCleanupTasksForReview(db, { limit, beforeUpdatedAt? })`, selecting only `id` as an internal review handle, `storageProvider`, `reason`, literal `status: 'dead_letter'`, `attempts`, `maxAttempts`, `lastErrorCode`, `createdAt`, and `updatedAt` as `deadLetteredAt`; do not select or return `storageKey`, material ids, filenames, hashes, user/course/lesson ids, signed URLs, headers, or provider bodies. Target part: repository API boundary.
3. Severity: Medium. Evidence: Phase 3.33 already turns dead-letter creation into count-only worker health and an error status: `runDbWorkerTick()` sets worker health to `error` when pending cleanup has failures or dead letters at `apps/worker/src/index.ts:124`, records only numeric pending-cleanup fields at `apps/worker/src/index.ts:139-144`, and logs only counts at `apps/worker/src/index.ts:149`. Worker tests prove the health payload omits cleanup task ids, storage-key suffixes, and object-storage secrets at `tests/integration/worker-tortila-snapshot.test.ts:303-337`, and cleanup audit remains count-only at `tests/integration/worker-tortila-snapshot.test.ts:339-353`. Recommendation: the DB review/count functions should feed alerting/admin review, but logs, health checks, audit logs, and generated artifacts must remain count-only unless a separate security review approves a narrower admin-only surface. Target part: alerting/health integration.
4. Severity: Medium. Evidence: `recordLmsObjectCleanupTaskFailure()` sanitizes provider errors to `[a-z0-9_:-]{1,80}` or `delete_failed` at `packages/db/src/repositories.ts:889-911`, and the integration test proves a raw `Authorization: secret response body` error is persisted only as `delete_failed` when the task reaches `dead_letter` at `tests/integration/lms-object-cleanup-tasks.test.ts:104-122`. Recommendation: the review DTO may expose `lastErrorCode` because it is bounded and sanitized, but must not expose raw provider response text or derive display fields from storage keys. Target part: dead-letter review DTO.
5. Severity: Medium. Evidence: current tests pin the no-payload column contract for `lms_object_cleanup_tasks` at `tests/integration/lms-object-cleanup-tasks.test.ts:42-64`, atomic completion/non-leaking upload audit at `tests/integration/lms-object-cleanup-tasks.test.ts:67-102`, summary-only cleanup audit at `tests/integration/lms-object-cleanup-tasks.test.ts:125-150`, static durable-hook wiring at `tests/integration/lms-ph3-1-static.test.ts:146-157`, and artifact denylist coverage for cleanup task ids, raw object paths, Authorization, and X-Amz markers at `tests/integration/lms-db-e2e-artifact-scan.test.ts:91-94`. Recommendation: implement Phase 3.34 tests next to `lms-object-cleanup-tasks.test.ts` that create pending/completed/dead-letter rows, assert the new count/list functions return only sanitized fields, assert no returned JSON contains `storageKey` or known key suffixes, and assert pending/completed rows are excluded. Target part: test coverage.
6. Severity: Low. Evidence: migration `0014` already adds an index on `(status, run_after)` and a storage-key index at `packages/db/migrations/0014_lazy_puff_adder.sql:19-20`; the schema mirrors those indexes at `packages/db/src/schema.ts:318-320`. Recommendation: no migration is required for a bounded Phase 3.34 read-only count/list using `status = 'dead_letter'` and a small limit. If a future persistent admin queue needs high-volume pagination, SLA dashboards ordered by dead-letter time, acknowledgement fields, assignee/review timestamps, or retry-from-dead-letter mutations, then add a separate migration for an index such as `(status, updated_at)` or explicit review columns after that workflow is specified. Target part: migration/performance planning.
## Decisions
- Phase 3.34 DB work should be repository-only for the minimum dead-letter operational review/count boundary; no schema migration is needed for read-only list/count/review.
- Keep the existing key-bearing `listPendingLmsObjectCleanupTasks()` worker-only. Dead-letter review needs separate sanitized repository functions that do not select `storageKey`.
- Treat `updatedAt` on a `dead_letter` row as the current `deadLetteredAt` value because `recordLmsObjectCleanupTaskFailure()` sets it at the same write that changes status to `dead_letter`.
- Keep health/audit/log/artifact surfaces count-only. A private admin/backend reviewer may use the cleanup task id as an internal handle, but it must not be written to audit/health/log/generated evidence payloads.
## Risks
- Copying the pending-task reader for the review path would leak `storageKey` because that reader intentionally returns it for worker DELETE.
- `updatedAt` is sufficient while dead-letter rows are immutable after failure; if Phase 3.34 adds acknowledgement, retry-from-dead-letter, assignment, or comments, `updatedAt` will stop being a stable dead-letter timestamp and a migration for `dead_lettered_at`/review fields should be reconsidered.
- Count-only worker health can alert that dead letters exist, but it cannot provide operator review context until the sanitized repository readers and any admin/alert adapter are added.
- Live S3/R2 and provider error shapes remain unobserved; current DB recommendations assume the existing sanitized `delete_failed` code remains the only persisted provider failure detail.
## Verification/tests
- READ-ONLY audit only. No code, migrations, tests, servers, DB commands, browser runs, live S3/R2, scanner, or alerting services were executed.
- Inspected current schema, migration, repository helper code, worker count-only health path, and integration/static tests using `rg` and line-numbered file reads.
- `git status --short` was attempted and returned `fatal: not a git repository (or any of the parent directories): .git`, so no git diff was available from this directory.
## Next actions
1. Add sanitized repository types/functions for dead-letter count and review list without selecting `storageKey`.
2. Add integration tests proving the new functions include dead-letter rows, exclude pending/completed rows, and return no storage key, key suffix, file/user/course/lesson metadata, signed URL, auth header, X-Amz marker, or raw provider body.
3. Wire alerting/admin review to the sanitized functions only; keep health/audit/log output count-only.
4. Reconsider a migration only if the implementation scope expands beyond read-only review into acknowledgement, assignment, comments, retry-from-dead-letter, stable dead-letter timestamps, or high-volume paginated dashboards.
