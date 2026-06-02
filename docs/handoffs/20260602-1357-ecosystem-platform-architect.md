# ecosystem-platform-architect handoff
## Scope
Phase 3.54 read-only platform audit defining the minimal safe boundary for child-process stdout/stderr redaction. No file edits, live acceptance, screenshot OCR, SSH/server checks, DB mutation, or logging-framework rewrite.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `package.json`, runner scripts under `scripts/`, worker logging paths under `apps/worker`, redaction package files under `packages/audit`, recent Phase 3.51-3.53 handoffs, and relevant integration tests/docs.

## Files changed
None - read-only audit

## Findings
1. High. `scripts/gates.mjs` writes raw child stdout/stderr directly to retained `logs/gates/*.log`; scanner defaults do not include those logs. Recommendation: redact before writing gate logs. Target part: retained gate evidence.
2. High. LMS/real-PG wrappers delegate child output with inherited stdio, bypassing local `safeMessage()` guards. Recommendation: pipe/capture one-shot child output through a shared script helper before printing or logging. Target part: managed runner child boundary.
3. Medium. Redaction is duplicated and inconsistent across scripts. Recommendation: add a zero-dependency script-local helper for free-form process text. Target part: script utilities.
4. Medium. Do not import `@wtc/audit` for this slice; it is structured audit-payload redaction, while this is plain process text. Target part: monorepo layering.
5. Medium. This phase should stay text-only, not screenshot OCR or artifact-scanner expansion. Target part: phase scope.
6. Low. `safe-preview.mjs` and `safe-worker-tick.mjs` also inherit output, but only `safe-worker` is a short evidence-like command. Recommendation: leave `safe-preview` out of the minimal slice and include `safe-worker` if the helper can cover it without changing dev-server behavior.

## Decisions
Minimal implementation should wire the helper into `scripts/gates.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, and optionally `scripts/safe-worker-tick.mjs`. Do not touch `packages/*`, app logging, screenshot OCR, live acceptance, SSH/server probes, or full structured logging.

## Risks
Capturing output instead of inheriting it can affect stream ordering and buffering; keep the slice limited to one-shot runners and preserve compact summaries. Regex over-redaction is acceptable; under-redaction is the main risk.

## Verification/tests
Read-only inspection only. No tests or gates were run by this auditor.

## Next actions
1. Add a script-local redaction helper with optional `.d.mts`.
2. Replace raw child log/terminal output in the one-shot runner scripts.
3. Add fixture-child tests plus static wiring checks.
4. Update status, next-actions, implemented-files, and deployment runbook docs.
