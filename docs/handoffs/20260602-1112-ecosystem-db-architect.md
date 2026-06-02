# ecosystem-db-architect handoff

## Scope
Read-only Phase 3.46 DB audit for stale real-Postgres harness table-count assertion/proof text before using opt-in auth race
gates. No edits made by this auditor.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`; `packages/db/src/schema.ts`;
`packages/db/src/index.ts`; `packages/db/migrations/*.sql`; `packages/db/migrations/meta/_journal.json`;
`packages/db/migrations/meta/0016_snapshot.json`; `tests/integration/db-real-postgres.test.ts`; `docs/DATA_MODEL.md`;
`docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/IMPLEMENTED_FILES.md`;
`docs/DEPLOYMENT.md`.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Authoritative current table count is 43 base tables. Evidence: latest journal entry is `0016_colorful_lyja`, and
   the current Drizzle schema/snapshot table set is 43. Recommendation: proof text should say 43 or avoid a hardcoded count.
   Target part: DB proof text / real-PG acceptance.
2. HIGH - Current disk state already avoids future table-count drift in the real-PG harness by deriving table names from the
   exported Drizzle schema and comparing them to `information_schema`. Recommendation: keep this dynamic set comparison and
   do not reintroduce `toBe(43)`. Target part: `tests/integration/db-real-postgres.test.ts`.
3. MEDIUM - No DB migration is needed for this phase. Recommendation: treat remaining work as docs/proof-text reconciliation,
   not schema work. Target part: migration governance.
4. MEDIUM - Current status docs still marked stale table-count cleanup as open before Phase 3.46 docs reconciliation.
   Recommendation: update current docs while keeping active real-PG proof NOT RUN. Target part: status truth.
5. HIGH - Opt-in real-Postgres auth race proof is still NOT RUN unless a fresh throwaway DB URL is supplied and the harness
   exits green. Recommendation: do not use skipped default runs as auth race acceptance. Target part: opt-in real-PG gates.

## Decisions
- Current authoritative table count: 43.
- Migration needed: No.
- Preferred anti-drift test shape: current schema-derived table-name set comparison, not a hardcoded numeric assertion.
- Production/auth race gate remains NOT RUN until executed against a fresh `wtc_test*` real Postgres database.

## Risks
- Old raw-IP preview DB evidence only covered an older migration set and must not be treated as current local auth/account
  harness proof.
- Static counts do not replace `npm run db:generate -w @wtc/db`.

## Verification/tests
RUN: read-only file inspection plus static counts. Auditor-reported static results: `schema_pgTable_count=43`,
`latest_snapshot_tables=43`, `migration_create_table_total=43`.

NOT RUN: `npm test`, `npm run db:generate -w @wtc/db`, `db:migrate`, `db:seed`, active
`REAL_POSTGRES_DATABASE_URL` real-PG harness, preview/prod DB rollout, live server mutation, CI in this read-only lane.

## Next actions
1. Update current docs/proof text to remove stale real-Postgres table-count cleanup as an open blocker.
2. Keep the dynamic table-set assertion in `tests/integration/db-real-postgres.test.ts`.
3. After docs reconciliation, run `npm run db:generate -w @wtc/db`; then run the real-PG harness only with
   operator-provided fresh `wtc_test*` credentials before claiming auth race acceptance.
