# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.49 security audit for append-only `audit_logs` DB-role enforcement, production permission preflight, docs truth, and no overclaiming without operator DB credentials.

## Files inspected
`docs/AUDIT_LOG_SCHEMA.md`, `docs/SECURITY_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `.env.example`, `package.json`, `apps/web/next.config.ts`, `packages/audit/src/*`, `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/db/migrations/0000_broken_jack_murdock.sql`, `tests/integration/db-real-postgres.test.ts`, `scripts/audit-append-only-role-preflight.mjs`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`.

## Files changed
None - read-only audit.

## Findings
1. High. Production append-only audit role proof remains NOT RUN. Evidence: `docs/AUDIT_LOG_SCHEMA.md` and `docs/DEPLOYMENT.md` require the preflight to pass against the intended role/database; `scripts/audit-append-only-role-preflight.mjs` refuses without explicit acceptance. Recommendation: report RUN only after `npm run accept:audit:append-only-role` passes with an operator-supplied restricted app-role URL. Target part: production permission gate.
2. Medium. Audit docs must say `SELECT + INSERT only`, not `INSERT only`. Evidence: the role needs read access for admin audit surfaces and the new preflight checks both allowed privileges. Recommendation: align wording and SQL grants. Target part: audit docs truth.
3. Medium. Role-name drift between `wtc_app` and `wtc_app_role` risks proving the wrong role. Recommendation: standardize on `wtc_app_role` unless operator config overrides it explicitly. Target part: DB role provisioning docs.
4. Medium. Raw preview URL exposure remains present in docs/config and should be handled in a later URL-hygiene phase. Recommendation: either move it to operator-only notes/env or document the approval. Target part: operational URL hygiene.
5. Low. The new preflight needed regression coverage for invalid URL, admin role, non-throwaway target, and redaction/refusal behavior. Recommendation: add focused tests. Target part: preflight script coverage.

## Decisions
No live server, preview DB, production DB, or bot surface should be touched for this phase. The acceptance command may write one safe `system.health_check` row only after explicit operator approval.

## Risks
Append-only audit enforcement still depends on the actual restricted DB role. If production boots with an owner/superuser/admin role, `audit_logs` can still be mutable despite application code and docs.

## Verification/tests
RUN by auditor: read-only inspection; syntax/refusal checks observed for the current preflight; secret scan reported PASS in the auditor lane. NOT RUN: live restricted-role permission proof, production DB checks, live server checks, full build/e2e.

## Next actions
1. Align docs and preflight defaults to `wtc_app_role`.
2. Add regression tests for refusal/redaction paths.
3. Run append-only role preflight only after operator supplies the intended restricted DB URL.
4. Keep production proof NOT RUN until that observed pass exists.
