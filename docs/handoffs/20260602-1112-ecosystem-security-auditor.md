# ecosystem-security-auditor handoff

## Scope
Read-only Phase 3.46 security audit for the stale real-Postgres harness table-count proof before using it as auth/account
race acceptance evidence. No live services, live databases, secrets, or production state were touched.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`;
`tests/integration/db-real-postgres.test.ts`; `docs/DEPLOYMENT.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`;
`docs/IMPLEMENTED_FILES.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS.md`;
`docs/PRODUCTION_BLOCKERS_CURRENT.md`.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Active real-Postgres auth/account race proof remains NOT RUN without `REAL_POSTGRES_DATABASE_URL`. Recommendation:
   report skipped Vitest output as NOT RUN, not green. Target part: acceptance reporting.
2. HIGH - The throwaway DB-name guard must remain before any connection is opened. Recommendation: keep the `wtc_test` /
   `wtc_test_*` guard and do not run against preview, production, or persistent developer DBs. Target part: real-PG harness.
3. MEDIUM - Current docs must distinguish old raw-IP preview proof from the current Phase 3.46 auth/account harness.
   Recommendation: reconcile current docs before the next real-PG acceptance phase. Target part: production blockers.
4. MEDIUM - No secret-bearing DB URL should be printed, committed, or captured in retained evidence. Recommendation: use only
   redacted command descriptions in handoffs and final reports. Target part: evidence handling.

## Decisions
- Keep the real-PG proof opt-in only.
- Do not claim active auth/account race acceptance unless the DB-mutating block runs and passes against a fresh `wtc_test*`.
- Treat Phase 3.46 as a test/docs truth fix, not a production DB rollout.

## Risks
- A default run with `5 passed / 9 skipped` can be misread as real-PG acceptance.
- Old preview evidence can be misapplied to the current auth/account race harness if docs are not explicit.

## Verification/tests
RUN: read-only inspection.

NOT RUN: active `REAL_POSTGRES_DATABASE_URL` harness, preview/prod DB mutation, live server mutation, CI.

## Next actions
1. Keep active real-PG proof NOT RUN until operator supplies a fresh throwaway DB URL.
2. Run the focused harness only; do not include deploy `db:migrate`/`db:seed` in the throwaway harness command.
3. Preserve redacted evidence only.
