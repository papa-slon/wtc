# ecosystem-platform-architect handoff
## Scope
Read-only Phase 3.49 platform audit for append-only audit DB-role preflight, script/runbook versus migration boundary, no live DB mutation, package/app separation, and status claims.

## Files inspected
`docs/ARCHITECTURE.md`, `docs/AUDIT_LOG_SCHEMA.md`, `docs/DATA_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, `docs/SESSION_PROTOCOL.md`, `package.json`, `packages/db/package.json`, `scripts/*.mjs`, `packages/db/migrations/*.sql`.

## Files changed
None - read-only audit.

## Findings
1. High. Append-only audit DB role is documented as DB-enforced but was not implemented/provable in migrations or scripts. Recommendation: add an explicit acceptance command and keep production proof NOT RUN until observed. Target part: auth hardening / DB role security.
2. Medium. Role naming and grant model were inconsistent across docs. Recommendation: canonicalize `wtc_app_role` and keep environment-specific role SQL separate from ordinary schema migrations. Target part: docs/runbook.
3. Medium. Current gate surface cannot catch production audit permission drift. Recommendation: use an operator-safe acceptance command, not default gates. Target part: scripts/package deployment preflight.
4. Low. `STATUS` top entry should carry append-only audit role status explicitly after this phase. Recommendation: update `STATUS`/`NEXT_ACTIONS`. Target part: docs truth.
5. Info. Package/app separation is suitable if work stays in root scripts and docs; no React route changes are needed. Target part: architecture boundary.

## Decisions
Do not fold role creation/grants into a broad automatic migration. Do not claim append-only audit role as production green from `node scripts/gates.mjs full`.

## Risks
Production could run with an owner/superuser or over-privileged app role. A normal Drizzle migration may be the wrong vehicle for role grants because role names/passwords/DB names are environment-specific.

## Verification/tests
RUN by auditor: read-only inspection and static searches. NOT RUN: npm gates, migrations, real-PG harness, production DB privilege probe, live preview/server checks.

## Next actions
1. Add preflight script and package command.
2. Update docs/status truth.
3. Prove against throwaway real Postgres first, then production only after explicit approval.
