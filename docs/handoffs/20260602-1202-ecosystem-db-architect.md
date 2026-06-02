# ecosystem-db-architect handoff

## Scope
Read-only Phase 3.48 DB audit for reconciling `docs/DATA_MODEL.md` `users` section with migration
`0016_colorful_lyja` auth lockout columns.

## Files inspected
`docs/DATA_MODEL.md`; `packages/db/src/schema.ts`; `packages/db/migrations/0016_colorful_lyja.sql`;
`docs/SECURITY_MODEL.md`.

## Files changed
None - read-only audit.

## Findings
1. MEDIUM - `DATA_MODEL.md` acknowledged migration `0016_colorful_lyja`, but initially listed the eight lockout columns only
   in a current implementation note while the active `users` table omitted them. Recommendation: integrate the eight lockout
   rows into the active `users` column table. Target part: `docs/DATA_MODEL.md` section `1.1 users`.
2. LOW - The active `users` index notes still used target-era `idx_users_email` on `lower(email)`, while current schema
   defines `users_email_idx` on plain `email`. Recommendation: align active notes with `schema.ts`.

## Decisions
No schema change is recommended. `packages/db/src/schema.ts`, migration `0016_colorful_lyja.sql`, and `SECURITY_MODEL.md`
agree on the eight auth lockout columns.

## Risks
Leaving the lockout columns outside the active `users` table keeps the physical data model ambiguous. The existing
target-vs-current mix around identity fields can also cause future migration or review confusion.

## Verification/tests
RUN: read-only line scans across the scoped files.

NOT RUN: migrations, tests, schema generation, active real-PG proof, live DB/server mutation, CI in this lane.

## Next actions
1. Update `docs/DATA_MODEL.md` only for the user-table truth.
2. Run governance/secret scan after docs and handoffs.
