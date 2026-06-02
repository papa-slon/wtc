# ecosystem-tests-runner handoff
## Scope
Phase 3.54 read-only audit for tests covering child-process stdout/stderr redaction.

## Files inspected
`scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/prepare-lms-db-e2e.ts`, `scripts/safe-worker-tick.mjs`, `scripts/safe-preview.mjs`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, relevant preflight redaction tests, `package.json`, `.secretlintignore`, and `.gitignore`.

## Files changed
None - read-only audit

## Findings
1. High. LMS DB child runner had artifact and catch-path redaction tests, but no child stdout/stderr redaction test. Recommendation: add a synthetic child-output test that emits Postgres URLs, `password=`, DB assignments, auth headers, cookies, Stripe/Axioma/LMS provider values, and command-arg echoes to stdout and stderr. Target part: LMS DB e2e runner stream handling.
2. High. Managed LMS and real-PG wrappers inject sensitive DB URLs into delegated children while inheriting raw output. Recommendation: pipe child output through a shared redactor and test stdout/stderr separately. Target part: managed wrapper delegate streams.
3. High. `scripts/gates.mjs` stores full child stdout/stderr in retained `logs/gates/*.log` without redaction. Recommendation: add gate-runner wiring coverage and post-gate retained-output scanning. Target part: gate runner logs.
4. Medium. Artifact scanner coverage is broad but cannot prove live stream safety. Recommendation: use a reusable leak corpus for both artifact and process-output redaction tests. Target part: redaction test architecture.
5. Medium. Adjacent developer wrappers also inherit raw output and parent env. Recommendation: explicitly exclude or cover them in the phase scope. Target part: developer-only child-process wrappers.

## Decisions
Existing standalone preflight suites already assert redacted retained summaries for object-store, scanner, Stripe, and Axioma dry runs. The missing coverage is delegated/inherited child output and gate log output.

## Risks
Raw child output can land in terminal transcripts, operator-copied evidence, `logs/gates`, or Playwright/npm output before artifact scanning.

## Verification/tests
Read-only static inspection only. No tests, gates, Playwright, LMS DB managed, real-PG managed, or live preflights were run by this auditor.

## Next actions
1. Add `tests/integration/child-output-redaction.test.ts`.
2. Expand LMS/real-PG static wiring tests.
3. Keep live acceptance tests out of this local safety slice unless operator credentials are supplied.
