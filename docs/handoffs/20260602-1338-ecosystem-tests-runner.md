# ecosystem-tests-runner handoff
## Scope
Read-only audit for tests needed around preflight log-root confinement: absolute root refusal, path traversal refusal, URL-shaped root refusal, repo-local logs acceptance, and normalized/no-secret output paths.

## Files inspected
`scripts/preflight-log-root.mjs`, `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, `scripts/axioma-handoff-preflight.mjs`, `scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/gates.mjs`, `tests/integration/*preflight.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, `package.json`.

## Files changed
None - read-only audit.

## Findings
1. High. Helper coverage was needed for URL, absolute, UNC, traversal, non-`logs` roots, safe fallback, and normalized summary paths. Recommendation: add direct Vitest coverage. Target part: helper tests.
2. High. Each preflight needed wiring tests proving hostile roots refuse before summary writes and without raw path echo. Recommendation: add spawn-based matrix across five scripts. Target part: preflight wiring tests.
3. Medium. Success-path tests should use repo-local `logs/test-*` roots and remove them after assertions. Recommendation: convert all five preflight suites. Target part: dry-run retained evidence tests.
4. High. Scanner tests needed explicit unsafe-root, missing-root, and unsafe dynamic marker path cases. Recommendation: add root/path tests and keep value suppression checks. Target part: artifact scanner tests.
5. Low. Gates log-root is fixed and can stay as a separate static guard if future changes add env overrides. Target part: gates tests.

## Decisions
Use behavior tests over source-string-only assertions. Keep acceptance preflights opt-in and outside default gates.

## Risks
Secretlike test values must be built from pieces to avoid secretlint false positives while still testing runtime behavior.

## Verification/tests
No tests run by this auditor. Read-only inspection only.

## Next actions
1. Add helper-level and preflight-wiring tests.
2. Convert success tests to repo-local `logs/test-*` roots.
3. Add scanner unsafe-root tests.
4. Run focused Vitest, then local gates.
