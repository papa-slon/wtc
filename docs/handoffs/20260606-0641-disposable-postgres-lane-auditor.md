# phase-471-disposable-postgres-lane-auditor handoff
## Scope
Read-only safety audit for running WTC strict Tortila managed proof with a separate disposable local PostgreSQL lane. No files were edited by the agent, no DB was mutated by the agent, no service was started/stopped by the agent, and no secret values were printed.

## Files inspected
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/tortila-canonical-source-verifier.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `package.json`
- `docs/handoffs/20260606-0542-phase-470-tortila-canonical-source-landing.md`
- Local environment presence only, PG17 binary metadata, Windows PostgreSQL service status

## Files changed
None — read-only audit

## Findings
1. Severity: High. Strict managed proof was still the blocker entering this phase. Evidence: Phase 4.70 recorded strict proof as NOT RUN because disposable Postgres admin URL was absent. Recommendation: do not call the proof green until `accept:tortila:real-read:managed` exits 0 against a disposable local admin URL. Target part: strict WTC managed proof.
2. Severity: High. The runner creates/drops a generated throwaway DB, but the operator must prove the supplied admin URL is disposable/local. Recommendation: use temp PGDATA, loopback binding, isolated non-service port, and post-run cleanup checks. Target part: disposable Postgres lane boundary.
3. Severity: High. PG17 binaries are available under `C:\Program Files\PostgreSQL\17\bin`, while the Windows service is already running separately. Recommendation: use absolute PG17 binary paths and do not touch service data/lifecycle/port 5432. Target part: local PG startup safety.
4. Severity: P0. The managed runner is narrowly read-only once given a safe DB lane: canonical source root, local journal fixture, allowlisted endpoints, read-only worker env, no `/api/marks`, no `/api/overview`, no live controls. Recommendation: run with `TORTILA_CANONICAL_SOURCE_REQUIRED=1` and the Phase 4.70 canonical checkout. Target part: Tortila proof boundary.
5. Severity: Medium. Cleanup success must be checked outside the runner. Recommendation: require created/verified/dropped/cleaned output, query zero leftover `wtc_test_tortila_real_read_%` DBs, stop the temp cluster, remove PGDATA, and verify the temp port closed. Target part: cleanup proof.

## Decisions
- The auditor did not run the proof or mutate DBs.
- A disposable local PG17 cluster is acceptable only with temp PGDATA, loopback binding, and isolated port.

## Risks
- A failed interrupted run could leave a throwaway DB or temp PGDATA behind.
- Supplying a shared/server admin URL would still be dangerous without the runner locality hardening added in this phase.

## Verification/tests
RUN:
1. Static source inspection.
2. Package script inspection.
3. Env presence check without printing values.
4. PG17 binary/status inspection.

NOT RUN:
1. Managed Tortila proof, tests, DB queries, service actions, live/server probes.

## Next actions
1. Start a separate disposable PG17 cluster with temp PGDATA and loopback-only port.
2. Run strict managed proof.
3. Verify drop/cleanup/port closure.
