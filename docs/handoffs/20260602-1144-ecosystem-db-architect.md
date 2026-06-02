# ecosystem-db-architect handoff

## Scope
Read-only Phase 3.47 DB audit for active real-Postgres auth/account race proof readiness after Phase 3.46. No files edited,
no migrations/seeds run, no database mutation by this auditor.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`; `packages/db/src/schema.ts`;
`packages/db/src/repositories.ts`; `packages/db/migrations/0016_colorful_lyja.sql`;
`packages/db/migrations/meta/_journal.json`; `packages/db/migrations/meta/0016_snapshot.json`;
`tests/integration/db-real-postgres.test.ts`; `docs/DATA_MODEL.md`; `docs/PRODUCTION_BLOCKERS.md`;
`docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/NEXT_ACTIONS.md`;
`docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/RISK_REGISTER_MASTER.md`; `package.json`; `packages/db/package.json`;
`packages/db/drizzle.config.ts`.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Current migration/table truth is coherent: 43 schema tables, latest migration `0016_colorful_lyja`, and `0016`
   adds auth lockout columns to `users` without adding a table. Recommendation: no schema change before active proof.
2. HIGH - The real-PG harness is structurally ready: it guards `wtc_test*`, applies committed migrations, self-seeds, compares
   migrated `information_schema` tables to Drizzle schema, and exercises failed-login/admin-unlock repository functions.
3. HIGH - Active proof remains NOT RUN. Phase 3.46 fixed harness truth, but skipped DB-mutating tests are not acceptance.
4. MEDIUM - Freshness requirement is strict: use a fresh empty `wtc_test` / `wtc_test_*`; drop/recreate before a second run;
   do not use preview, production, or persistent developer DBs.
5. LOW - `DATA_MODEL.md` top-level current-truth notes are updated for `0016`, but the detailed `users` table still omits the
   new lockout columns. Recommendation: docs cleanup after active proof; not a schema blocker.

## Decisions
Schema change needed before active proof: No. Authoritative table truth: 43 tables through `0016_colorful_lyja`. Active proof
command: `npm test -- tests/integration/db-real-postgres.test.ts`. Do not run `db:migrate` or `db:seed` for the throwaway
harness procedure.

## Risks
A default no-credential Vitest pass can be misreported as real-PG acceptance. A reused/non-empty throwaway DB can fail or
produce misleading evidence because migrations are raw SQL and not safe to rerun in place.

## Verification/tests
RUN: read-only file inspection; static schema table count check (`43`); latest snapshot table count check (`43`); migration
journal inspection.

NOT RUN: `npm test`; active `REAL_POSTGRES_DATABASE_URL` harness; `npm run db:generate -w @wtc/db`; `db:migrate`; `db:seed`;
preview/prod DB rollout; live server mutation; CI in this lane.

## Next actions
1. Use a fresh `wtc_test_<suffix>` real-Postgres DB.
2. Run focused harness only.
3. Accept active proof only if DB-mutating tests run active and pass without skips.
