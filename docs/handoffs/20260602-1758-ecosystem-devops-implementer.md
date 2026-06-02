# ecosystem-devops-implementer handoff
## Scope
Phase 3.60 read-only DB/devops audit for using the operator-approved local existing-bot Postgres settings from `C:\Users\maxib\GTE BOT\bot\.env` to run `npm run accept:real-pg:managed` without printing values.

In scope: verify the managed real-Postgres runner contract, package script wiring, docs/runbook truth, current credential-blocker state, generated database-name guards, child-process redaction, and cleanup behavior.

Out of scope: running `npm run accept:real-pg:managed`, creating or dropping databases, starting preview or worker services, SSH/nginx/systemd checks, bot service control, provider calls, deploy, CI, and product-code edits.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `package.json`
- `scripts/run-real-pg-harness-managed.mjs`
- `tests/integration/db-real-postgres.test.ts`
- `scripts/redacted-child-process.mjs`
- `docs/DEPLOYMENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `C:\Users\maxib\GTE BOT\bot\.env` key names/status only; no values printed
## Files changed
None — read-only audit.
## Findings
1. Severity: High. The managed real-PG runner expects `REAL_POSTGRES_ADMIN_DATABASE_URL` as the operator-supplied admin/maintenance URL, not the raw existing-bot key names directly. Evidence: `package.json:35` maps `accept:real-pg:managed` to `scripts/run-real-pg-harness-managed.mjs`; `scripts/run-real-pg-harness-managed.mjs:9` reads `REAL_POSTGRES_ADMIN_DATABASE_URL`; `scripts/run-real-pg-harness-managed.mjs:23-41` validates a present postgres/postgresql admin URL and refuses an admin DB named `wtc_test*`; `docs/DEPLOYMENT.md:375-383` documents the same env var and command. Recommendation: build `REAL_POSTGRES_ADMIN_DATABASE_URL` in-process from the approved existing-bot `.env` fields and clear it after the run; do not paste or persist the value. Target part: operator real-PG acceptance procedure.
2. Severity: High. The generated target database name is guarded for the child harness. Evidence: `scripts/run-real-pg-harness-managed.mjs:46-48` generates `wtc_test_realpg<timestamp><random>`; `scripts/run-real-pg-harness-managed.mjs:61-71` passes only that target as `REAL_POSTGRES_DATABASE_URL` and `DATABASE_URL` to the child test process; `tests/integration/db-real-postgres.test.ts:63-80` refuses any child database name that is not `wtc_test` or `wtc_test_<suffix>`. Recommendation: use the managed wrapper as-is; do not bypass it with a manually chosen non-throwaway `REAL_POSTGRES_DATABASE_URL`. Target part: DB safety guard.
3. Severity: High. Cleanup is implemented as a best-effort `finally` drop of only the generated database after creation. Evidence: `scripts/run-real-pg-harness-managed.mjs:109-114` creates the generated DB and marks it created; `scripts/run-real-pg-harness-managed.mjs:118-126` drops it with `DROP DATABASE IF EXISTS ... WITH (FORCE)` and marks the run failed if drop fails. Recommendation: after any interrupted or killed run, manually check for orphaned `wtc_test_realpg*` databases and drop only those generated throwaways. Target part: cleanup guarantees.
4. Severity: Medium. Child output is routed through the shared redactor before forwarding, but raw terminal buffers still must not be archived. Evidence: `scripts/run-real-pg-harness-managed.mjs:4` imports the redacted runner; `scripts/run-real-pg-harness-managed.mjs:63-72` runs the child harness through `runRedactedChildProcess`; `scripts/redacted-child-process.mjs:6-20` includes DB URL/env, secret, provider URL, credentialed URL, auth header, and signed-query redaction patterns; `scripts/redacted-child-process.mjs:65-92` captures stdout/stderr, redacts, and forwards redacted output. Recommendation: retain only redacted summaries and pass/fail observations, never full raw command buffers. Target part: evidence hygiene.
5. Severity: Medium. Current docs still mark active real-PG managed proof as NOT RUN, and this audit did not run the mutating gate. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:32-33` records `REAL_POSTGRES_ADMIN_DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL` as not set in the current blocker packet; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:66` marks active real-Postgres proof NOT RUN until the managed/admin or direct throwaway URL is supplied and active tests pass; `docs/DEPLOYMENT.md:431-439` defines the exact conditions required before the real-PG gate may be reported RUN. Recommendation: report Phase 3.60 as read-only static GO only, not active acceptance. Target part: status truth.
6. Severity: Medium. The existing-bot `.env` has enough key names to construct a candidate admin URL without printing values, but no DB permission probe was run in this read-only session. Evidence: key-name-only inspection found `HOST`, `DATABASE`, `USERNAME_PG`, and `PASSWORD` with all required values present, no explicit `PORT`, and a non-`wtc_test*` candidate maintenance DB; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:15-16` separately records Phase 3.59 evidence that the same local source had Postgres connection fields and `CREATE DATABASE` permission checked without printing values. Recommendation: default the port only if the operator confirms the existing bot uses the default Postgres port; otherwise include the approved port out of band. Target part: operator URL construction.
## Decisions
- Do not run `npm run accept:real-pg:managed` in this phase because it creates and drops a database.
- Do not run any DB-mutating probe, preview, worker, provider, SSH, nginx, systemd, bot, deploy, or CI command.
- Treat this as a read-only operational GO checklist, not as a completed real-PG acceptance gate.
- No background agents were launched in this single-agent scoped audit, and none were left running.
## Risks
- The admin URL will carry credentials with create/drop database power; any future run must remain single-purpose and values-hidden.
- Cleanup is robust for normal failures after creation, but cannot guarantee cleanup after process kill, machine crash, or admin connection failure during the `finally` drop.
- If the existing-bot `.env` omits an explicit port, assuming `5432` is an operator decision, not a repo-derived fact.
- A successful `--help`, syntax check, or skipped real-PG test is not active real-PG proof.
## Verification/tests
| Gate | Command/inspection | Result |
|---|---|---|
| Required protocol/docs read | Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, status, latest aggregate handoff, implemented files, and next actions | PASS |
| Managed runner syntax | `node --check scripts\run-real-pg-harness-managed.mjs` | PASS |
| Managed runner help only | `REAL_POSTGRES_ADMIN_DATABASE_URL` cleared in-process, then `node scripts\run-real-pg-harness-managed.mjs --help` | PASS; help printed placeholders only |
| Existing-bot env source check | key-name-only parse of `C:\Users\maxib\GTE BOT\bot\.env` | PASS; values not printed; required key names present |
| Current real-PG env presence | status-only check for `REAL_POSTGRES_ADMIN_DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL` | NOT_SET / NOT_SET |
| DB mutation | any create/drop/migrate/seed/real-PG harness command | NOT RUN; forbidden by this phase scope |
| Services/provider/live checks | preview, worker, SSH, nginx/systemd, bot control, provider calls, deploy, CI | NOT RUN; forbidden by this phase scope |
## Next actions
1. If the operator wants to clear active real-PG proof, start a new single-purpose acceptance session and set `REAL_POSTGRES_ADMIN_DATABASE_URL` in-process from the approved existing-bot `.env` source without printing it.
2. Run only `npm run accept:real-pg:managed`; confirm the output shows generated `wtc_test_realpg*` create/drop, focused real-PG tests pass without skips, and no raw URL/secret values appear.
3. If the command is interrupted or cleanup fails, manually inspect Postgres for orphaned `wtc_test_realpg*` databases and drop only those generated throwaways.
4. Report all other gates as NOT RUN unless they are explicitly executed in that same new session.
