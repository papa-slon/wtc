# Phase 3.36 LMS cleanup dead-letter acknowledgement/retry handoff
## Scope
Implement a local, count-only LMS pending-upload cleanup dead-letter acknowledgement/retry workflow after Phase 3.35 shared
object-storage primitives. This phase does not run live S3/R2, live external scanner, DB-backed LMS browser acceptance, or
public upload rollout.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0609-ecosystem-platform-architect.md](20260602-0609-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0609-ecosystem-db-architect.md](20260602-0609-ecosystem-db-architect.md)
- [docs/handoffs/20260602-0609-ecosystem-security-auditor.md](20260602-0609-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0609-ecosystem-backend-implementer.md](20260602-0609-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0609-ecosystem-frontend-implementer.md](20260602-0609-ecosystem-frontend-implementer.md)
- [docs/handoffs/20260602-0609-ecosystem-tests-runner.md](20260602-0609-ecosystem-tests-runner.md)

All six background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/audit/src/audit.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/DEPLOYMENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0015_wet_cobalt_man.sql`
- `packages/db/migrations/meta/0015_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `packages/audit/src/audit.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- current docs and this handoff set.
## Findings
1. High - Acknowledgement could not safely reuse `completed` without making unconfirmed cleanup look confirmed. Implemented:
   migration `0015_wet_cobalt_man.sql` adds nullable `acknowledged_at` and `acknowledged_by` plus a `(status,
   acknowledged_at)` index while preserving `status='dead_letter'`. Target part: DB lifecycle semantics.
2. High - Raw cleanup task IDs and object keys are not acceptable admin inputs. Implemented: admin ack/retry forms submit
   only operation intent plus expected count/latest timestamp snapshot guards; repository functions select private rows
   server-side. Target part: admin mutation boundary.
3. High - Unguarded aggregate actions could acknowledge or retry newly arrived rows that the operator did not review.
   Implemented: repository ack/retry APIs compare expected count/latest timestamp against the current selected cohort and
   abort stale snapshots with `lms_object_cleanup_cohort_stale`. Target part: DB/admin race safety.
4. High - Retry must not duplicate worker object-store deletion or hide repeated provider failures. Implemented: retry only
   requeues acknowledged dead letters with `status='pending'` and `run_after=now`, preserves attempts, clears acknowledgement
   state, and leaves DELETE to the worker. Target part: worker boundary.
5. Medium - Cleanup failure transition had a select/update race window. Implemented: failure recording now runs in a
   transaction with status-guarded update and summary-only dead-letter audit insert. Target part: DB transition safety.
6. Medium - New audit actions needed registration and no-leak documentation. Implemented:
   `education.material_cleanup_ack` and `education.material_cleanup_retry` are registered and documented as summary-only
   with `targetId = null`. Target part: audit contract.
7. Medium - Retained artifacts did not explicitly reject cleanup task identifier field names. Implemented: artifact scanner
   denies `cleanupTaskId` / `cleanup_task_id`, and tests cover the denial. Target part: artifact no-leak guard.
## Decisions
- Keep `lms_object_cleanup_tasks` private; no admin row browser, hidden task IDs, object keys, filenames, hashes, signed URL
  tokens, scanner details, provider bodies, or raw errors are exposed.
- Keep object DELETE in the worker. Admin retry schedules work only.
- Preserve attempts when retrying a dead letter; repeated manual retry does not erase the failure history.
- Use explicit acknowledgement metadata instead of a new status or overloading completion.
- Keep Phase 3.36 local-only; live S3/R2, live scanner, DB-browser acceptance, assignment workflow, and public rollout remain
  separate observed gates.
## Risks
- Ack/retry is still local DB/browser-admin semantics only; live S3/R2 behavior is unobserved.
- Operators can manually retry a failing object multiple times, but attempts are preserved and the row will dead-letter again
  on failure.
- No assignment/ownership workflow exists for dead letters; this phase only supports aggregate acknowledgement/retry.
## Verification/tests
- Focused Phase 3.36 tests: `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/admin-lms-cleanup-review.test.ts tests/integration/admin-health-detail.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`28` passed).
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes after migration.
- Initial `npm run governance:check` - PASS (0 errors / 1 known warning).
- Initial `npm run secret:scan` - PASS.
- `node scripts/gates.mjs full` - PASS (9/9).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning).
- NOT RUN: live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, DB-backed LMS browser acceptance, public upload rollout.
## Next actions
- Run live S3/R2 upload/download/delete/reconcile acceptance with operator-approved throwaway bucket credentials.
- Run live external scanner acceptance with operator-approved endpoint/token and safe corpus.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Define assignment/ownership workflow only if operational dead-letter triage needs named owners beyond aggregate ack/retry.
