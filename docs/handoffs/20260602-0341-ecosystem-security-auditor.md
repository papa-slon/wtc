# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.30 security audit for LMS external malware scanner boundary: upload ordering, external HTTP scanner calls, secrets/tokens, audit/log/response leakage, fail-closed behavior, scan status semantics, and public-upload gating. No live scanner acceptance was claimed.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`; `apps/web/src/features/lms/queries.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `.env.example`; `packages/db/src/repositories.ts`; `packages/audit/src/redact.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-ph3-1-static.test.ts`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/IMPLEMENTED_FILES.md`; `docs/AUDIT_LOG_SCHEMA.md`.
## Files changed
None - read-only audit
## Findings
1. High - Quarantined bytes should not be written to the standard object bucket. Target part: external scanner upload pipeline and object lifecycle.
2. High - Scanner HTTP call needed a timeout. Target part: scanner HTTP client.
3. Medium - Scanner vendor reason should not enter upload audit payloads as raw detail. Target part: upload audit payload.
4. Medium - Scanner endpoint/token placeholders were missing from env docs. Target part: deployment/env documentation.
5. Medium - Artifact scanner needed scanner token/endpoint env leakage rules. Target part: generated artifact scanner.
6. Medium - Synchronous vs asynchronous scanner state machine remains a future production decision. Target part: scan status model.
7. Low - Preserve no-filename/no-hash scanner request contract. Target part: scanner request contract.
## Decisions
Do not claim live scanner acceptance. Treat current scanner path as local/mocked boundary only. Keep downloads clean-row gated and public uploads disabled until live object storage, live scanner, cleanup/reconciliation, and browser evidence are observed.
## Risks
Quarantined object accumulation, hung scanner uploads, scanner reason leaks, scanner env leaks, and unverified live scanner response shape/latency/auth behavior.
## Verification/tests
Read-only inspection only. No tests or gates were run by this agent.
## Next actions
1. Avoid standard object writes for quarantined external verdicts.
2. Add scanner request timeout/fail-closed tests.
3. Remove/reduce `quarantineReason` from upload audit.
4. Add scanner env docs.
5. Extend artifact scanner rules.
