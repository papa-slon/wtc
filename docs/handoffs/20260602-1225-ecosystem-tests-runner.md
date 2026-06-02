# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.49 tests/gates audit for append-only audit DB-role preflight and production permission truth.

## Files inspected
`package.json`, `.secretlintrc.json`, `.secretlintignore`, `scripts/gates.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/audit-append-only-role-preflight.mjs`, `scripts/check-governance.mjs`, `tests/integration/db-real-postgres.test.ts`, `tests/integration/check-governance.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `docs/DEPLOYMENT.md`, `docs/AUDIT_LOG_SCHEMA.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/SECURITY_MODEL.md`, `docs/DATA_MODEL.md`.

## Files changed
None - read-only audit.

## Findings
1. High. Append-only audit DB-role proof remains NOT RUN without restricted-role credentials. Recommendation: report it RUN only after `AUDIT_APPEND_ONLY_DATABASE_URL`, `AUDIT_APPEND_ONLY_EXPECTED_ROLE`, and `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1` are supplied and pass. Target part: production permission preflight.
2. Medium. Audit app-role naming needed alignment across docs/preflight. Recommendation: standardize on `wtc_app_role`. Target part: docs truth.
3. Medium. Dedicated test coverage was missing for the new audit append-only preflight. Recommendation: add focused Vitest coverage for help, unknown args, missing env, invalid URL, admin role, non-throwaway refusal, and source-level privilege checks. Target part: script safety tests.
4. Medium. Managed real-PG runner lacks unknown-argument refusal. Recommendation: handle in a later small safety phase or include if scope allows. Target part: `scripts/run-real-pg-harness-managed.mjs`.
5. Low. `scripts/gates.mjs` invalid-mode help omits supported `build` and `e2e` modes. Recommendation: update in a later gate-truth cleanup. Target part: gate runner help.

## Decisions
Full gates should run in the operator/main lane, not the read-only test agent lane. The preflight itself must stay outside default local gates because it needs operator DB credentials and writes one audit row.

## Risks
Default real-PG tests can pass while DB-mutating tests are skipped. New acceptance commands need refusal tests so typo args or wrong target names cannot cause accidental DB mutation.

## Verification/tests
RUN by auditor: script syntax/help/refusal checks, governance, secret scan, and focused default real-PG harness were reported in the auditor lane. NOT RUN: live permission proof, managed real-PG proof, full gates in read-only lane, db:migrate/db:seed, CI, live server checks.

## Next actions
1. Add focused preflight tests.
2. Keep production proof NOT RUN without credentials.
3. Consider a later small safety cleanup for managed real-PG unknown-arg refusal and `gates.mjs` help text.
