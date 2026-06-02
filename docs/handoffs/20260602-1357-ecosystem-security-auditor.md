# ecosystem-security-auditor handoff
## Scope
Phase 3.54 read-only audit of child-process stdout/stderr redaction, focused on scripts that inherit or retain child output. Live acceptance, deploy, SSH/server checks, DB mutation, provider calls, and screenshot OCR stayed out of scope.

## Files inspected
`scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/safe-worker-tick.mjs`, `scripts/safe-preview.mjs`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/prepare-lms-db-e2e.ts`, `scripts/preflight-log-root.mjs`, preflight scripts, related integration tests, `.secretlintignore`, `.gitignore`, `package.json`, and `logs/gates/test.log`.

## Files changed
None - read-only audit

## Findings
1. High. LMS DB browser runner can stream DB credentials before artifact scanning. Evidence: `scripts/run-lms-db-e2e.mjs` passes `LMS_E2E_DATABASE_URL`, `DATABASE_URL`, session secret, KEK, and prep token into children and used inherited stdio before the scanner ran. Recommendation: replace inherited stdio with a shared redacted pipe runner and test with fixture child output. Target part: LMS DB e2e runner.
2. High. Managed LMS and real-PG wrappers redact parent errors but not delegated child output. Evidence: `scripts/run-lms-db-e2e-managed.mjs` and `scripts/run-real-pg-harness-managed.mjs` delegated child processes with sensitive DB URLs and inherited stdio. Recommendation: use the same shared redacted child runner and add retained-output coverage. Target part: managed DB proof runners.
3. Medium. `scripts/gates.mjs` writes raw child output to retained `logs/gates/*.log`. Recommendation: redact while writing gate logs and run post-gate retained-log scanning. Target part: local gate runner.
4. Medium. `scripts/safe-preview.mjs` and `scripts/safe-worker-tick.mjs` inherit child output with full parent env. Recommendation: cover short evidence-like wrappers now and keep long-running preview as a separate interactive-dev slice. Target part: dev preview and worker smoke wrappers.

## Decisions
The preflight summary scripts are not the main leak source in this slice because Phase 3.53 already gave them redacted summaries and log-root confinement. The remaining gap is streaming and retained child-process output.

## Risks
Actual credentialed LMS DB, managed real-PG, and audit-role runs were not executed. Source/static proof does not observe behavior under a real failing DB child process.

## Verification/tests
Read-only inspection only. No tests, preflights, DB mutation, live server, child acceptance commands, or gates were run by this auditor.

## Next actions
1. Add a shared script-local child-output redactor.
2. Wire it into LMS DB, managed real-PG, gate logs, and short evidence-like worker smoke output.
3. Add fixture-child tests proving stdout/stderr redaction before console or retained-log writes.
