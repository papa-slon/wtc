# ecosystem-tests-runner handoff

## Scope
Read-only Phase 3.47 test audit for active real-Postgres auth/account race proof readiness after Phase 3.46. No test that
could mutate Postgres was run, and no live server, bot, or DB operation was performed by this auditor.

## Files inspected
`tests/integration/db-real-postgres.test.ts`; `package.json`; `packages/db/package.json`; `docs/DEPLOYMENT.md`;
`.env.example`; `docker-compose.yml`; `vitest.config.ts`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`;
`docs/handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md`;
`docs/handoffs/20260602-1112-ecosystem-tests-runner.md`.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Active real-PG auth/account race proof is ready but not claimable from default runs. The mutating block is gated by
   `REAL_POSTGRES_DATABASE_URL`, so default skipped output is not acceptance. Recommendation: report active proof RUN only
   after the guarded block runs against fresh `wtc_test*`.
2. HIGH - Exact command for the active proof is focused: `npm test -- tests/integration/db-real-postgres.test.ts`.
   Recommendation: do not use broad `npm test` with real-PG env as the acceptance command.
3. HIGH - Current shell cannot execute the active proof honestly: `REAL_POSTGRES_DATABASE_URL`, `DATABASE_URL`,
   `SESSION_SECRET`, and `SECRET_VAULT_KEK` are unset; `.env` and `.git` are absent; Node is `v24.15.0`, npm is `11.12.1`.
4. MEDIUM - Failed-login and duplicate account-unlock cross-connection race cases are present inside the guarded block.
   Recommendation: evidence must show those cases active, not skipped.
5. MEDIUM - The harness is DB-mutating but guarded. Recommendation: never point it at preview, production, or a persistent
   developer DB.

## Decisions
Use only the focused Vitest file for acceptance. Do not run `db:migrate` or `db:seed` as part of the harness; it self-applies
migrations and seed. Default no-credential output proves helper readiness only.

## Risks
A default green run can be misreported because helper tests pass while real-PG tests stay skipped. Workspace is not git-backed,
so GitHub CI remains not claimable.

## Verification/tests
RUN: read-only source/doc inspection; redacted env/tooling availability check; Phase 3.46 status/handoff reconciliation check.

NOT RUN: active `REAL_POSTGRES_DATABASE_URL` proof, `psql` drop/create, Docker compose, `db:migrate`, `db:seed`, full gates,
e2e, live server, live bot, production rollout, GitHub Actions CI in this lane.

## Next actions
1. Prefer a managed throwaway runner so the next proof starts from one operator admin URL and a fresh generated `wtc_test*`.
2. Required evidence: command exit 0, active real-PG cases pass without skips, target DB name class redacted, no secrets/full
   URLs retained.
