# ecosystem-tests-runner handoff
## Scope
Read-only test-runner audit for Phase 3.59: exact LMS DB browser managed acceptance command, required env shape, expected artifacts, and post-run scanner/visual-review gates.

## Files inspected
- `package.json`
- `apps/web/package.json`
- `playwright.lms-db.config.ts`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/redacted-child-process.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `package.json:28`, `scripts/run-lms-db-e2e-managed.mjs:9`, `scripts/run-lms-db-e2e-managed.mjs:103`. Recommendation: prefer `npm run e2e:lms:db:managed`; it creates `wtc_test_lms_*`, delegates to `npm run e2e:lms:db`, then drops it. Target part: LMS DB acceptance command.
2. Severity: High. Evidence: `scripts/run-lms-db-e2e.mjs:9`, `scripts/prepare-lms-db-e2e.ts:17`, `playwright.lms-db.config.ts:13`. Recommendation: do not run direct Playwright; direct mode requires `LMS_E2E_DATABASE_URL` plus prep/HMAC marker checks from the runner. Target part: direct harness safety.
3. Severity: High. Evidence: `scripts/run-lms-db-e2e.mjs:77`, `scripts/scan-lms-db-e2e-artifacts.mjs:303`. Recommendation: acceptance is not green unless the artifact scanner exits 0 after Playwright. Target part: retained text evidence.
4. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts:253`, `scripts/check-retained-visual-artifacts.mjs:322`. Recommendation: retained screenshot evidence requires `npm run evidence:visual -- --manifest ... <image-root-or-file>`, not inventory mode. Target part: retained visual evidence.

## Decisions
- Treat `npm run e2e:lms:db:managed` as the single matching gate for the available adjacent Postgres credential.
- Keep default `npm run e2e`, PGlite tests, and visual inventory out of the acceptance proof.
- If Playwright fails, remove or quarantine generated `trace.zip`/error artifacts before rerun; scanner must pass on final retained artifacts.

## Risks
- Failure traces and error context can contain raw UI/source payload and are explicitly not archive-safe.
- Old artifacts in shared roots can fail the scanner even after the code issue is fixed.
- A passing browser gate can still retain a wrong screenshot unless the image is manually reviewed.

## Verification/tests
RUN by this auditor: read-only file inspection and command/artifact review.

NOT RUN by this auditor: `npm run e2e:lms:db:managed`, `npm run e2e:lms:db`, Playwright, DB mutation, live providers, deploy, CI.

## Next actions
After the main operator run, record exact PASS/FAIL for the managed runner, scanner, visual review, throwaway DB drop, and focused regression tests.

