# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.30 tests-runner audit for LMS external malware scanner adapter boundary. Covered config/env validation, LMS upload storage/scanner flow, material download behavior, generated-artifact scanner coverage, LMS DB browser harness boundaries, gates, and docs.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `tests/integration/lms-ph3-1-static.test.ts`; `tests/e2e/lms-db-materials.spec.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `scripts/gates.mjs`; `package.json`; `.env.example`; `docs/DEPLOYMENT.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`.
## Files changed
None - read-only audit
## Findings
1. High - Current scanner coverage is local mocked adapter acceptance only; live scanner acceptance remains separate. Target part: scanner test plan and docs.
2. High - Quarantine object-write policy needed explicit tests. Target part: storage/quarantine lifecycle tests.
3. High - Scanner failure tests needed fetch throw/timeout, unsupported mode, and no-leak assertions. Target part: scanner failure tests.
4. Medium - Env template needed scanner endpoint/token placeholders and static docs coverage. Target part: env docs.
5. Medium - Artifact scanner needed explicit `LMS_FILE_SCANNER_TOKEN=` rule. Target part: artifact scanner.
6. Medium - DB-local browser proof must not be used as external scanner acceptance. Target part: e2e gate plan.
7. Medium - Public uploads remain invalid without `s3-r2`, external scanner endpoint, and token. Target part: config tests.
## Decisions
Accept Phase 3.30 locally only through mocked scanner tests unless operator-approved scanner credentials are supplied. Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` until live object storage, live scanner, cleanup/reconciliation, and browser evidence are observed.
## Risks
Mocked fetch can hide real protocol/latency behavior. Scanner tokens/endpoints can leak through logs or artifacts. DB-local browser acceptance can be misread as scanner acceptance.
## Verification/tests
Read-only source inspection only. No tests or gates were run by this agent.
## Next actions
1. Add scanner timeout/failure/no-leak tests.
2. Add scanner env artifact deny rules/tests.
3. Add env/docs placeholders.
4. Run focused and full local gates.
5. Keep live scanner, live S3/R2, DB browser, cleanup, and public rollout NOT RUN until credentials exist.
