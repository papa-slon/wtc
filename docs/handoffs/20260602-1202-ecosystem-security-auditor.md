# ecosystem-security-auditor handoff

## Scope
Read-only Phase 3.48 security audit for auth lockout data model docs truth, public exposure boundary, and admin-safe
projection rules.

## Files inspected
`docs/SECURITY_MODEL.md`; `docs/DATA_MODEL.md`; `docs/AUDIT_LOG_SCHEMA.md`; `docs/RBAC_MATRIX.md`; `docs/DOMAIN_MODEL.md`;
`packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `packages/db/migrations/0016_colorful_lyja.sql`;
`packages/audit/src/audit.ts`; admin auth/user UI files; focused auth/admin tests.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Lockout state must not be exposed publicly. Public login collapses all failed/locked outcomes to generic
   `invalid_credentials`; docs must preserve that boundary.
2. HIGH - Docs should mention admin-safe projection only. Lockout state may leave repository code only through
   allowlisted admin DTOs/views, never full DB user rows.
3. MEDIUM - `AUDIT_LOG_SCHEMA.md` had implementation-status drift for `auth.account_unlock`: it was implemented but still
   listed under target additions.
4. MEDIUM - `AUDIT_LOG_SCHEMA.md` needed an explicit `auth.account_unlock` snapshot allowlist for safe before/after fields
   and forbidden secret/public-leak fields.

## Decisions
Lockout data model docs are broadly truthful: lockout fields live on `users`, added by migration `0016`, and are
internal/server-side. Public docs and UI should keep generic public auth copy; operational details belong only in admin-safe
projections and audit logs.

## Risks
The residual risk is docs drift, not an observed public leak. Future API routes that expose DB user rows directly could leak
`passwordHash` plus lockout internals.

## Verification/tests
RUN: read-only source inspection and targeted searches.

NOT RUN: `npm test`, build, Playwright, DB migration, active real-Postgres race proof, live server checks, production deploy,
CI in this lane.

## Next actions
1. Mark `auth.account_unlock` implemented in `AUDIT_LOG_SCHEMA.md`.
2. Add an explicit unlock before/after allowlist.
3. Keep public auth generic and admin views allowlisted.
