# Phase 3.31 LMS object-store cleanup/reconciliation handoff
## Scope
Implement the next local LMS public-upload safety slice after Phase 3.30: add a retry-safe object-store cleanup/reconciliation path for expired `s3-r2` material rows, with SigV4 `DELETE`, clean-row delete-before-hard-delete ordering, 404/already-absent reconciliation, metadata-only purge for unsafe rows that Phase 3.30 never writes to the standard object bucket, count-only worker health/audit payloads, cleanup artifact scanner coverage, and current docs. No live object-store credentials, live scanner credentials, or production services were used.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0406-ecosystem-education-implementer.md](20260602-0406-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0406-ecosystem-security-auditor.md](20260602-0406-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0406-ecosystem-devops-implementer.md](20260602-0406-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0406-ecosystem-tests-runner.md](20260602-0406-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `apps/worker/src/index.ts`; `apps/worker/src/tick-once.ts`; `packages/db/src/repositories.ts`; `packages/db/src/schema.ts`; `packages/lms/src/materials.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `tests/integration/worker-tortila-snapshot.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `packages/config/src/env.test.ts`; `.env.example`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/IMPLEMENTED_FILES.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/EDUCATION_LMS_PLAN.md`; `docs/AUDIT_LOG_SCHEMA.md`.
## Files changed
- `packages/db/src/repositories.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/package.json`
- `package-lock.json`
- `apps/web/src/features/lms/material-storage.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260602-0406-ecosystem-education-implementer.md`
- `docs/handoffs/20260602-0406-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0406-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0406-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md`
## Findings
1. High - `s3-r2` cleanup needed a separate lifecycle boundary. Implemented: DB candidate selection and finalization APIs for expired `s3-r2` file rows, separate from DB-local cleanup. Target part: LMS repository cleanup.
2. High - Remote object delete must happen before hard-deleting retry state. Implemented: worker cleanup deletes clean object rows through SigV4 `DELETE` before finalizing DB rows; failed delete leaves the row retryable and surfaces count-only failure health. Target part: worker object cleanup.
3. High - Quarantined `s3-r2` rows are metadata-only after Phase 3.30. Implemented: unsafe non-clean object rows are purged as metadata-only without remote DELETE; clean rows exercise DELETE, and 404 is treated as already reconciled. Target part: quarantine cleanup policy.
4. Medium - Worker health and one-shot output needed separate object cleanup counts. Implemented: scanned, delete-attempted, delete-confirmed, metadata-only-purged, purged, and failed counts. Target part: worker observability.
5. Medium - Cleanup evidence needed scanner coverage. Implemented: artifact scanner tests now reject cleanup logs containing raw object keys, auth headers, or signed query tokens. Target part: retained artifact no-leak policy.
6. Medium - Runtime upload guard drifted from typed config for staging. Implemented: local storage providers are rejected when `APP_ENV=staging` as well as production. Target part: runtime public-upload fence.
## Decisions
- Keep DB-local cleanup unchanged and separate from object-store cleanup.
- Do not import web feature code into the worker; worker owns scheduled external object-store I/O.
- Treat `DELETE` 2xx and 404 as confirmed cleanup for clean object rows.
- Treat non-clean expired `s3-r2` rows as metadata-only cleanup under the Phase 3.30 no-standard-object-write invariant.
- Do not implement upload compensating delete-on-DB-insert-failure in this slice.
- Do not claim live S3/R2, live scanner, DB browser, or public-upload acceptance.
## Risks
- Clean object uploads can still be orphaned if object PUT succeeds and later DB material creation fails; this needs a future compensating delete or pending/outbox design.
- Live S3/R2 delete behavior may differ from mocked fetch behavior and still needs credentialed acceptance.
- Worker object cleanup failures surface as count-only health errors, but no retry backoff/outbox table exists yet.
- This directory is still not git-backed in this session.
## Verification/tests
RUN:
- `npm test -- tests/integration/db-lms-ph3-1.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS, 3 files / 32 tests.
- `npm test -- tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts packages/config/src/env.test.ts` - PASS, 7 files / 91 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run worker:smoke` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- `node scripts/gates.mjs e2e` with LMS DB env vars cleared - PASS, 44 passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 images, 0 blocked containers, 2 missing roots, 70 total artifact files, 0 dynamic markers.
- Final `npm run secret:scan` after docs/handoffs - PASS.
- Final `npm run governance:check` after aggregate handoff - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- `npm run e2e:lms:db` - no fresh `LMS_E2E_DATABASE_URL`.
- `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
- Live S3/R2 upload/download/delete/reconcile acceptance - no object-store credentials.
- Live external scanner acceptance - no operator-approved scanner endpoint/token.
- Production public upload rollout - blocked by live acceptance and remaining lifecycle gaps.
## Next actions
1. Add compensating delete-on-create-failure or pending-row/outbox/staging-key semantics for object PUT success followed by DB insert failure.
2. With operator-approved throwaway object-store credentials, add live S3/R2 upload/download/delete/reconcile acceptance.
3. With operator-approved scanner credentials, add live scanner acceptance.
4. Run `npm run e2e:lms:db` or managed equivalent when a fresh throwaway/admin DB URL is available.
5. Keep public uploads disabled until live scanner, live S3/R2, cleanup/reconciliation, DB browser, artifact evidence, and rollback/lifecycle gates are green.
