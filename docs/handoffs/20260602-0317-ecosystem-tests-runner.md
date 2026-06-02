# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.29 tests-runner audit for LMS S3/R2-compatible storage provider and signed download delivery. Covered focused tests, gate runner wiring, LMS DB artifact scanner/tests, LMS DB e2e harness tests, and material storage/download tests.
## Files inspected
`tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `tests/e2e/lms-db-materials.spec.ts`; `scripts/gates.mjs`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `scripts/run-lms-db-e2e.mjs`; `playwright.lms-db.config.ts`; `apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `package.json`; `.env.example`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
## Files changed
None - read-only audit
## Findings
1. High - Storage tests covered only `db-local`, `fs-local`, opaque local keys, and unsupported-provider failure. Recommendation: add S3/R2 tests with mocked HTTP boundary, no inline DB bytes, opaque keys, upload headers/body, and unsupported-provider fail-closed behavior. Target part: material storage tests.
2. High - Download handling resolved bytes only. Recommendation: add signed-delivery coverage for a delivery union, redirect headers, no premature audit, and no audit leakage. Target part: material download tests.
3. High - Config tests only covered local storage. Recommendation: test `s3-r2` required envs, HTTPS endpoint, production public-upload scanner fence, and redacted config errors. Target part: env tests.
4. Medium - Scanner can load dynamic markers but needs signed URL policy. Recommendation: reject signed URL tokens or register exact values before archiving evidence. Target part: scanner and evidence policy.
5. Medium - Do not retrofit DB-local browser spec to claim S3/R2 acceptance; add separate opt-in signed-delivery assertions only with credentials. Target part: LMS DB e2e harness.
6. Medium - `full` and `e2e` gates remain separate; DB LMS and live S3/R2 gates are credentialed opt-ins. Target part: gate plan.
## Decisions
Treat Phase 3.29 as local contract/test acceptance only unless real S3/R2 credentials and a fresh DB browser environment are supplied. Preserve DB-local and fs-local tests, add S3/R2 beside them, and test signed redirect delivery as handler behavior, not client DTO exposure.
## Risks
Signed object-store URLs can expose opaque keys in `Location`; tests must distinguish allowed short-lived redirect delivery from forbidden DTO/audit/artifact leakage. Signing failures must not audit as successful downloads. Credentials must never land in fixtures/logs/snapshots.
## Verification/tests
RUN: none by this read-only agent.
NOT RUN: focused Vitest, typechecks, full/e2e gates, scanner, DB browser gate, managed DB browser gate, live S3/R2 acceptance, external malware scanner acceptance, and production public upload rollout.
## Next actions
1. Add S3/R2 provider/env tests.
2. Add mocked storage adapter tests.
3. Add signed download handler tests.
4. Extend scanner/harness tests for signed URL tokens.
5. Run focused tests and full local gates; keep live/DB/object-store gates NOT RUN without credentials.
