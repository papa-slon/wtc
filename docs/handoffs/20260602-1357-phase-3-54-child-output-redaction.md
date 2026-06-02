# Child-process output redaction handoff
## Scope
This handoff closes the local retained child stdout/stderr hygiene slice after preflight log-root confinement. The phase covered one-shot proof/evidence runners and retained gate logs only. It did not run live LMS DB browser acceptance, managed real-PG proof, audit append-only role proof, live preflights, deploy, SSH, nginx, systemd, preview/prod DB mutation, live bot controls, provider network calls, screenshot OCR, GitHub CI, or production monitoring.

## Files inspected
`scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`, `scripts/safe-worker-tick.mjs`, `scripts/safe-preview.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/prepare-lms-db-e2e.ts`, runner safety tests, worker smoke tests, deployment/status docs, and Phase 3.51-3.53 handoffs.

## Files changed
- `scripts/redacted-child-process.mjs`
- `scripts/redacted-child-process.d.mts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/real-pg-managed-runner-safety.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1357-*.md`

## Findings
1. High. DB/PG proof runners no longer inherit raw child output. `run-lms-db-e2e.mjs`, `run-lms-db-e2e-managed.mjs`, and `run-real-pg-harness-managed.mjs` now pipe child stdout/stderr through `runRedactedChildProcess()` before retained console output. Target part: managed DB proof runners.
2. High. Retained gate logs no longer receive raw child stdout/stderr directly. `scripts/gates.mjs` now captures gate command output, redacts it, extracts metrics, discards full output for passing gates, and retains full redacted output only for failing gates. Target part: retained gate evidence.
3. Medium. `scripts/safe-worker-tick.mjs` now uses the same helper because it is a short worker smoke/evidence command. `scripts/safe-preview.mjs` remains intentionally out of scope because it is a long-running interactive dev-server stream. Target part: local dev wrappers.
4. Medium. Redaction is now script-local and text-only, with no dependency on `@wtc/audit` structured payload redaction and no screenshot/binary OCR expansion. Target part: monorepo boundary.
5. Medium. New tests prove stdout/stderr redaction with a fixture leak corpus and add static wiring guards against reverting to inherited output or raw gate logs. Target part: regression coverage.

## Decisions
Use a zero-dependency script helper for free-form process text. Over-redaction is acceptable for retained console/log evidence; under-redaction is not. Keep live acceptance, OCR, package-level logging, and long-running preview streams out of this phase.

## Risks
`safe-preview.mjs` still inherits interactive dev-server output and should not be archived as retained evidence. Redacted stdout/stderr does not prove screenshots, traces, compressed artifacts, or binary files are leak-free. Actual credentialed DB/provider failure modes remain unobserved until operator credentials are supplied.

## Verification/tests
RUN:
- `node --check scripts/redacted-child-process.mjs` PASS
- `node --check scripts/run-lms-db-e2e.mjs` PASS
- `node --check scripts/run-lms-db-e2e-managed.mjs` PASS
- `node --check scripts/run-real-pg-harness-managed.mjs` PASS
- `node --check scripts/gates.mjs` PASS
- `node --check scripts/safe-worker-tick.mjs` PASS
- focused Vitest PASS: `tests/integration/child-output-redaction.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, `tests/integration/worker-tortila-snapshot.test.ts` (`56` passed)
- regression focused Vitest PASS after static-guard correction: `tests/integration/child-output-redaction.test.ts`, `tests/integration/db-seed-preview-hardening.test.ts` (`6` passed)
- `npm run secret:scan` PASS after removing the stale generated `logs/gates/secret_scan.log` from the previous failed gate attempt
- `node scripts/gates.mjs full` PASS (9/9): governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS after compacting passing gate logs (`15` text files scanned)
- post-cleanup `npm run governance:check` PASS (0 errors / 1 known historical warning; 4 cited per-agent handoffs all present)
- post-cleanup `npm run secret:scan` PASS

NOT RUN:
- live LMS DB browser acceptance (`npm run e2e:lms:db` / `npm run e2e:lms:db:managed`)
- active managed real-PG proof
- production/preview append-only audit DB-role proof
- live object-store/scanner preflights
- live Stripe/Axioma acceptance
- preview/prod DB migration or seed
- SSH, nginx, systemd, tmux, server process checks
- screenshot OCR/manual visual-review gate
- long-running safe-preview stream redaction
- production deploy, GitHub CI, production monitoring

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1357-ecosystem-security-auditor.md`](20260602-1357-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1357-ecosystem-tests-runner.md`](20260602-1357-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1357-ecosystem-devops-implementer.md`](20260602-1357-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1357-ecosystem-platform-architect.md`](20260602-1357-ecosystem-platform-architect.md)

All current-phase agents were collected and closed before reporting.

## Next actions
1. If credentials are available, run the blocked operator acceptance gates: LMS DB managed, real-PG managed, or audit append-only role preflight.
2. If credentials remain unavailable, the next local evidence-safety slices are screenshot retention/OCR guardrail, long-running safe-preview retained-output policy, or symlink-hard preflight root confinement if needed.
