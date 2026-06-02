# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.49 DB audit of append-only `audit_logs` role enforcement, production permission preflight, role naming, and local testability without credentials.

## Files inspected
`packages/db/src/schema.ts`, `packages/db/migrations/*.sql`, `packages/db/migrations/meta/0016_snapshot.json`, `packages/db/src/repositories.ts`, `docs/DATA_MODEL.md`, `docs/AUDIT_LOG_SCHEMA.md`, `docs/DEPLOYMENT.md`, `scripts/run-real-pg-harness-managed.mjs`, `tests/integration/db-real-postgres.test.ts`, `package.json`, `packages/db/package.json`, `docs/NEXT_ACTIONS.md`, `docs/ROADMAP_MASTER.md`.

## Files changed
None - read-only audit.

## Findings
1. High. `audit_logs` append-only is documented but not enforced by committed schema/migrations. Evidence: schema and migrations create/index `audit_logs` but do not create/grant/revoke the app role. Recommendation: add an operator DB-role preflight rather than relying on app code. Target part: production DB role enforcement.
2. High. Production proof must include `TRUNCATE` denial, non-owner status, and non-elevated role attributes, not only `UPDATE`/`DELETE` denial. Recommendation: check `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, table owner, and superuser/createdb/createrole/replication/bypassrls flags. Target part: permission preflight.
3. Medium. Role naming was inconsistent (`wtc_app` vs `wtc_app_role`). Recommendation: standardize on `wtc_app_role` across docs and examples. Target part: docs truth.
4. Medium. Current real-Postgres harness proves migrations/runtime behavior, not app-role permissions. Recommendation: keep append-only role acceptance as a separate gate. Target part: local acceptance.
5. Low. Repository code is insert/select-only for audit rows, but DB enforcement is still required. Target part: repository boundary.

## Decisions
Permission enforcement should be an operator runbook/preflight step, not a normal Drizzle migration, because role names and privileges are environment-specific and would break generic throwaway migrations if forced into schema SQL.

## Risks
Production can still start with an over-privileged app role unless the restricted-role preflight is run against the intended target. Table-level revokes do not protect append-only semantics if the runtime role owns the table or is elevated.

## Verification/tests
RUN by auditor: read-only inspection and static searches for role/grant/revoke/audit patterns. NOT RUN: migrations, managed real-PG harness, production/preview DB checks.

## Next actions
1. Add a role-permission preflight command.
2. Update docs to show exact `wtc_app_role` grants/revokes.
3. Keep production proof NOT RUN until a real restricted-role pass is observed.
