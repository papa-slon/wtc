# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.50 tests audit for managed real-PG runner unknown-argument refusal and `scripts/gates.mjs` invalid-mode help truth. No live DB mutation.

## Files inspected
`scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`, `package.json`, `tests/integration/real-pg-managed-runner-safety.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/db-real-postgres.test.ts`, `scripts/run-lms-db-e2e-managed.mjs`, comparable preflight tests under `tests/integration`.

## Files changed
None - read-only audit.

## Findings
1. High. The real-PG managed-runner safety test helper could inherit a real `REAL_POSTGRES_ADMIN_DATABASE_URL` from the parent shell. Evidence: the helper merged `process.env` into child env. Recommendation: clear `REAL_POSTGRES_ADMIN_DATABASE_URL` by default and only set it explicitly in tests that need it. Target part: focused runner safety tests.
2. Low. `gates.mjs` invalid-mode path should not create/touch `logs/gates` before refusing. Recommendation: move `mkdirSync(LOG_DIR)` after plan validation. Target part: typo refusal side effects.
3. Low. Invalid-mode help should stay aligned with `PLANS`. Recommendation: generate supported mode text from `Object.keys(PLANS)`. Target part: gate help truth.

## Decisions
No active real-PG harness or managed DB run should be performed in this phase. The safety test should prove refusal-before-DB-mutation without requiring credentials.

## Risks
Default real-PG tests can pass while DB-mutating tests are skipped. The workspace is not git-backed, so no CI/branch claim should be made.

## Verification/tests
RUN by auditor: no-DB spawn checks for unknown-arg and help. NOT RUN by auditor: focused Vitest, full gates, managed real-PG active proof, e2e.

## Next actions
1. Clear DB admin env in the test helper by default.
2. Move `gates.mjs` log directory creation after valid-mode selection.
3. Run focused safety Vitest and syntax checks.
