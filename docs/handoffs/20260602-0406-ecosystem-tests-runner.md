# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.31 tests-runner audit for LMS storage/download/cleanup tests, worker smoke, generated-artifact scanner, and gate scripts. Target: object-store delete/reconciliation cleanup for `s3-r2` readiness after Phase 3.30.
## Files inspected
`tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `tests/integration/worker-tortila-snapshot.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `scripts/gates.mjs`; `package.json`; `apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/actions.ts`; `apps/worker/src/index.ts`; `packages/db/src/repositories.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `docs/ACCEPTANCE_MATRIX_MASTER.md`.
## Files changed
None - read-only audit
## Findings
1. High - No runtime path or focused test deleted `s3-r2` objects. Evidence: existing tests covered PUT/signed GET and DB-local cleanup only. Recommendation: add object cleanup tests with mocked DELETE. Target part: cleanup tests.
2. High - Teacher delete is DB-only soft delete, not object cleanup proof. Recommendation: keep request-time delete transactional and route remote object cleanup through worker/reconcile. Target part: delete orchestration.
3. Medium - Worker smoke lacked object cleanup metrics. Recommendation: extend worker result/health tests with count-only object cleanup fields. Target part: worker tests.
4. Medium - Public-upload config can pass with storage/scanner settings while cleanup remains a blocker. Recommendation: document cleanup as a separate readiness gate. Target part: deployment gate.
5. Medium - Artifact scanner needed explicit cleanup/reconcile evidence fixtures. Recommendation: add a fixture proving raw object keys, request headers, and signed query tokens fail scanning. Target part: artifact scanner.
6. Low - Quarantined `s3-r2` lifecycle needed a test decision. Recommendation: test metadata-only unsafe rows are purged without an object DELETE, while clean rows exercise DELETE/404/failure. Target part: quarantine cleanup semantics.
## Decisions
- Current DB-local cleanup coverage is not transferable to `s3-r2`.
- Current `s3-r2` upload/download coverage is not delete/reconciliation acceptance.
- Default gates prove local mocked behavior only; credentialed gates remain opt-in.
## Risks
- A broad cleanup claim would be false without object DELETE/reconcile coverage.
- Cleanup logs can leak storage keys, `Authorization`, `X-Amz-*`, or provider bodies.
- Public uploads remain unsafe until cleanup is locally verified and live accepted.
## Verification/tests
Read-only inspection only. Recommended focused command: `npm test -- tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts packages/config/src/env.test.ts`.
## Next actions
1. Add object cleanup/reconciliation implementation and focused tests.
2. Extend worker health/audit/log no-leak assertions.
3. Extend artifact scanner fixtures for cleanup evidence.
4. Run focused tests, typechecks, worker smoke, full/e2e gates, artifact scanner, secret scan, and governance.
