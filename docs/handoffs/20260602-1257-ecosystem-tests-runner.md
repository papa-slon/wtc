# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.51 tests audit for LMS managed DB e2e runner URL-redaction and no-DB safety tests.

## Files inspected
`scripts/run-lms-db-e2e-managed.mjs`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, `package.json`, `scripts/gates.mjs`.

## Files changed
None - read-only audit.

## Findings
1. P2. Redaction helper needed direct no-DB coverage with synthetic raw `postgres://...` and `password=...` input. Recommendation: expose/import the sanitizer without running the DB wrapper and test it directly. Target part: runner URL-redaction safety.
2. P3. LMS managed-runner safety cases were bundled in one broad test. Recommendation: split into focused help, unknown-arg, missing URL, invalid URL, throwaway URL, and sanitizer tests. Target part: no-DB safety tests.
3. P3. There is no dedicated LMS managed-runner safety npm script. Recommendation: use targeted Vitest for phase acceptance and keep it in default `npm test`. Target part: gates to run.

## Decisions
No managed DB e2e run should occur in this phase. The test helper should clear inherited DB URL envs by default.

## Risks
Workspace is not git-backed. Redaction can regress if `safeMessage` changes unless runtime canaries remain in the default test suite.

## Verification/tests
RUN by auditor: focused Vitest snapshot passed during read-only audit. NOT RUN by auditor: full `npm test`, full gates, managed DB e2e, Playwright, DB create/drop.

## Next actions
1. Split LMS safety tests.
2. Add direct sanitizer test.
3. Rerun focused Vitest plus artifact scanner tests.
