# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.51 security audit of LMS managed DB e2e runner error-output redaction safety, focused on raw Postgres URL/password leakage, no live DB mutation, and retained evidence safety.

## Files inspected
`scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `tests/integration/lms-db-e2e-harness.test.ts`, `scripts/run-lms-db-e2e.mjs`, `scripts/prepare-lms-db-e2e.ts`, `playwright.lms-db.config.ts`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`.

## Files changed
None - read-only audit.

## Findings
1. High. Unknown CLI arguments could leak raw URL-shaped secrets before `safeMessage()` was used. Evidence: no-DB canary probe with a URL-shaped unknown arg printed the raw argument. Recommendation: do not echo unknown arg values in managed runners. Target part: managed runner CLI refusal path.
2. Medium. The LMS managed wrapper redacted its own parse/create/drop errors, but delegated child stderr is inherited and child/prep catch paths printed raw error messages. Recommendation: apply `safeMessage()` in `scripts/run-lms-db-e2e.mjs` and `scripts/prepare-lms-db-e2e.ts`. Target part: LMS DB e2e child runner/prep stderr.
3. Low. Tests needed runtime canaries for URL-shaped unknown args and synthetic raw error message redaction. Recommendation: add focused no-DB regressions. Target part: managed runner safety coverage.

## Decisions
No live database mutation should be performed. The actual LMS DB browser gate remains NOT RUN until an operator-approved throwaway/admin DB URL is supplied and the browser runner plus artifact scanner pass.

## Risks
Failed CLI invocations can leak secrets into terminal scrollback if operators pass DSNs as positional args. Screenshots are intentionally skipped by the scanner and still require human review.

## Verification/tests
RUN by auditor: syntax checks and focused no-DB probes. NOT RUN by auditor: active LMS DB browser acceptance, DB create/drop, full gates, live services.

## Next actions
1. Remove raw unknown-argument echo in managed runners.
2. Redact child/prep catch paths.
3. Add regression tests and rerun focused Vitest, scanner tests, and secret scan.
