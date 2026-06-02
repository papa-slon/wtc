# ecosystem-tests-runner handoff

## Scope
Read-only Phase 3.46 test audit for the real-Postgres harness table-count assertion/proof text before relying on opt-in auth
race gates. No files were edited and no live services/databases were touched by this auditor.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`;
`tests/integration/db-real-postgres.test.ts`; `packages/db/src/schema.ts`; `packages/db/migrations/meta/_journal.json`;
`packages/db/migrations/meta/0016_snapshot.json`; `packages/db/migrations/0014_lazy_puff_adder.sql`;
`packages/db/migrations/0015_wet_cobalt_man.sql`; `packages/db/migrations/0016_colorful_lyja.sql`; `package.json`;
`packages/db/package.json`; `scripts/gates.mjs`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`;
`docs/DATA_MODEL.md`; `docs/DEPLOYMENT.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/ROADMAP_MASTER.md`;
`docs/RISK_REGISTER_MASTER.md`; `docs/PRODUCTION_BLOCKERS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; Phase 3.45 handoffs.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Current `db-real-postgres.test.ts` no longer has the stale hard-coded `41` assertion; it derives Drizzle table names
   and compares the real migrated table set to them. Recommendation: keep this dynamic table-set proof and do not reintroduce
   a fixed count. Target part: real-PG harness.
2. HIGH - Phase 3.45 status docs still said stale real-Postgres table-count cleanup was open before Phase 3.46 reconciliation.
   Recommendation: update current status/next-action docs while keeping active real-PG auth race proof NOT RUN. Target part:
   docs status truth.
3. MEDIUM - Older master gate docs still described a `40-table proof`, conflicting with current schema truth and dynamic proof.
   Recommendation: change active proof wording to current schema table-set proof. Target part: proof text docs.
4. MEDIUM - Gate docs mixed deploy `db:migrate`/`db:seed` with the self-migrating/self-seeding harness. Recommendation:
   separate deploy DB gates from the opt-in harness gate. Target part: gate wording.
5. MEDIUM - Auth race gates exist but remain opt-in and were not activated here. Recommendation: after docs cleanup, run active
   real-PG proof only with a fresh `wtc_test*` DB and operator credentials. Target part: real-PG auth race acceptance.

## Decisions
- Treat the code-level table-count blocker as fixed in current on-disk state.
- Do not run or claim active real-Postgres auth race proof without `REAL_POSTGRES_DATABASE_URL`.
- No schema/migration change is indicated.

## Risks
- Workspace root is not git-backed: `git status --short` returns `fatal: not a git repository`.
- Leaving stale master docs unchanged can make the next auth race gate look blocked or incorrectly scoped.
- A skipped real-PG Vitest run can still exit 0; it must be reported as NOT RUN unless the opt-in block actually runs.

## Verification/tests
RUN:
- `node --check scripts/gates.mjs` - PASS.
- static count of `packages/db/migrations/meta/0016_snapshot.json` tables - 43.
- `REAL_POSTGRES_DATABASE_URL` environment check - unset.
- `npm test -- tests/integration/db-real-postgres.test.ts` - PASS default mode: `5 passed / 9 skipped`; real-PG block skipped.

NOT RUN:
- Active `REAL_POSTGRES_DATABASE_URL` real-PG auth race proof - no throwaway DB credentials supplied.
- `npm run db:generate -w @wtc/db` - not run in this read-only audit.
- `node scripts/gates.mjs full`, Playwright/e2e, live services, live DB migrate/seed, production rollout, GitHub Actions CI.

## Next actions
1. Reconcile docs: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
   `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/ROADMAP_MASTER.md`, `docs/RISK_REGISTER_MASTER.md`, and
   `docs/PRODUCTION_BLOCKERS.md`.
2. Keep the current dynamic table-set proof in `tests/integration/db-real-postgres.test.ts`.
3. Focused post-change gates: `npm test -- tests/integration/db-real-postgres.test.ts`,
   `npm run db:generate -w @wtc/db`, `npm run secret:scan`, `npm run governance:check`, and `node scripts/gates.mjs full`
   if this phase is accepted as a normal local phase.
