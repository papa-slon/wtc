# ecosystem-security-auditor handoff
## Scope
Phase 3.52 read-only audit for raw preview URL hygiene and retained-evidence leakage risk. No live server, SSH, systemd, tmux, database, preview mutation, or file edits were performed by this lane.

## Files inspected
`scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/prepare-lms-db-e2e.ts`, `scripts/safe-preview.mjs`, LMS/Axioma/billing/audit preflight scripts, related integration tests, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION_MAP.md`, `.env.example`, `package.json`, `playwright.lms-db.config.ts`.

## Files changed
None - read-only audit.

## Findings
1. Medium. Raw preview coordinates were retained in durable docs. Evidence: `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, and `docs/INTEGRATION_MAP.md` contained raw preview or direct service host coordinates. Recommendation: replace exact public IPs, SSH coordinates, and persistent preview DB names with placeholders and keep exact access data operator-only. Target part: docs/raw preview hygiene.
2. Medium. Artifact scanner passes image files without OCR/content inspection. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs` skips image extensions and the scanner test asserts PNG bytes are skipped. Recommendation: do not treat scanner pass as screenshot leak proof; require manual/OCR review or restrict retained screenshots. Target part: retained visual evidence.
3. Medium. DB/e2e runners inherit child stdout/stderr while passing sensitive env. Evidence: LMS and real-PG runners pass DB URLs/secrets to children and use inherited stdio. Recommendation: pipe child output through a redactor or state raw stdout/stderr must not be retained until manually redacted. Target part: runner console evidence.
4. Low. Preflight log roots are env-controlled and echoed as paths. Recommendation: constrain roots to repo-local `logs/*` and print normalized relative paths only. Target part: preflight artifact paths.

## Decisions
Treat preview coordinates as operator-only data in durable repo docs. Existing previous gate notes can remain historical but must not expose live coordinates in active runbooks.

## Risks
Screenshots and child-process stdout remain residual evidence boundaries. Scanner coverage is strongest for text artifacts, not visual or arbitrary inherited console streams.

## Verification/tests
No gates run by this auditor. Read-only inspection only.

## Next actions
1. Redact exact preview coordinates and preview DB names from durable docs.
2. Add scanner guardrails for raw preview/IP URL artifacts.
3. Add screenshot-retention and child-output redaction follow-ups as separate bounded phases if needed.
