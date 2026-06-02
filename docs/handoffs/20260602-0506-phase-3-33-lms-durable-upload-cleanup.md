# Phase 3.33 LMS durable upload cleanup handoff
## Scope
Implement durable local retry state for clean `s3-r2` LMS object uploads when object PUT succeeds but material creation fails, compensation DELETE fails, or the web request dies before material creation. No live object-store, live scanner, DB browser, or public rollout was run.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0506-ecosystem-education-implementer.md](20260602-0506-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0506-ecosystem-db-architect.md](20260602-0506-ecosystem-db-architect.md)
- [docs/handoffs/20260602-0506-ecosystem-security-auditor.md](20260602-0506-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0506-ecosystem-devops-implementer.md](20260602-0506-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0506-ecosystem-tests-runner.md](20260602-0506-ecosystem-tests-runner.md)

Background agents were collected and closed before the final operator report.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0014_snapshot.json`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- current docs and this handoff set.
## Findings
1. High - Phase 3.32 could still orphan clean `s3-r2` objects on request death or failed compensation DELETE. Implemented: `lms_object_cleanup_tasks` with provider/key/reason/status/attempt/run-after/generic error fields. Target part: DB durable retry.
2. High - Pending cleanup must be created before PUT. Implemented: `storeLmsUploadedFile()` has a `beforeObjectPut` hook, and `createMaterialAction()` registers a pending task before clean object PUT. Target part: web upload orchestration.
3. High - Successful material creation must not leave a task that can delete a live material object. Implemented: `createMaterialAndCompleteLmsObjectCleanupTask()` inserts the material, writes upload audit, and completes the cleanup task in one DB transaction. Target part: repository transaction.
4. Medium - Failed compensation needs durable retry and bounded operational state. Implemented: failed delete records retry attempts, backoff run-after, generic `delete_failed`, and dead-letter after max attempts. Target part: retry lifecycle.
5. Medium - Worker must process objects without material rows. Implemented: `reconcilePendingLmsObjectCleanupTasks()` performs signed DELETE, treats 2xx/404 as confirmed, completes tasks, records retry failure/dead-letter, and emits count-only health. Target part: worker cleanup.
## Decisions
- Use a dedicated `lms_object_cleanup_tasks` table instead of `materials` or the reserved `job_queue`.
- Store opaque `storage_key` only in private DB state; never in audit/health/log/artifact payloads.
- Keep live S3/R2, live scanner, DB browser, and public rollout separate NOT RUN gates.
## Risks
- Web and worker still duplicate SigV4 signing/delete primitives.
- Live object-store/IAM/error-shape behavior remains unobserved.
- Dead-lettered cleanup tasks require future operational review UI/alerting before production upload rollout.
## Verification/tests
- Focused Phase 3.33 tests: `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/lms-material-storage.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts` - PASS (`68` passed).
- Broader focused LMS/config/worker/scanner tests: `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-ph3-1-static.test.ts packages/config/src/env.test.ts` - PASS (`134` passed).
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` after migration generation - PASS, 43 tables, no schema changes.
- Initial `npm run governance:check` - PASS, 0 errors / 1 known warning.
- `node scripts/gates.mjs full` - PASS, 9/9 gates.
- `node scripts/gates.mjs e2e` - PASS, `44` passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, `2` text files, `68` images, `0` blocked containers.
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS, 0 errors / 1 known warning.
- NOT RUN: DB-backed LMS browser acceptance, live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, dead-letter operational review/alerting, shared object-store primitive extraction, and public upload rollout.
## Next actions
- Extract shared object-store signing/delete primitives to reduce web/worker drift.
- Add dead-letter operational review/alerting before public uploads.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Run live S3/R2 upload/download/delete/reconcile and live external scanner acceptance with operator-approved credentials.
