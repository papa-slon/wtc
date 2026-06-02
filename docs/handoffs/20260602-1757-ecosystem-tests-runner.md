# ecosystem-tests-runner handoff
## Scope
Phase 3.60 read-only test audit for the next credentialed gate: active managed real-Postgres proof via `npm run accept:real-pg:managed`.

This audit followed the required session reads (`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, latest Phase 3.59 handoff, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md`) and inspected only scripts, tests, and docs needed to define the runbook and risks. No DB-mutating command was run. No product code was edited. No background agents were spawned in this per-agent audit, so none required cleanup.
## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, `docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `package.json`, `packages/db/package.json`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`, `tests/integration/db-real-postgres.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, and related `rg` hits for `accept:real-pg:managed`, `REAL_POSTGRES_ADMIN_DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL`.
## Files changed
None - read-only audit
## Findings
1. Severity: High. Evidence: `package.json:35`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:66`, `docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md:74`. Recommendation: treat `npm run accept:real-pg:managed` as the next unresolved credentialed DB gate; do not claim it green from Phase 3.59 or from default local gates. Target part: acceptance truth.
2. Severity: High. Evidence: `scripts/run-real-pg-harness-managed.mjs:23`, `scripts/run-real-pg-harness-managed.mjs:39`, `scripts/run-real-pg-harness-managed.mjs:40`, `scripts/run-real-pg-harness-managed.mjs:105`, `docs/DEPLOYMENT.md:375`, `docs/DEPLOYMENT.md:382`. Recommendation: prerequisite is an operator-approved `REAL_POSTGRES_ADMIN_DATABASE_URL` using `postgres://` or `postgresql://`, pointing at a non-`wtc_test*` maintenance DB such as `postgres`, with CREATE/DROP DATABASE privilege; never print or archive the URL. Target part: credential admission.
3. Severity: High. Evidence: `scripts/run-real-pg-harness-managed.mjs:46`, `scripts/run-real-pg-harness-managed.mjs:48`, `scripts/run-real-pg-harness-managed.mjs:110`, `scripts/run-real-pg-harness-managed.mjs:121`, `scripts/run-real-pg-harness-managed.mjs:122`. Recommendation: expected managed DB name is `wtc_test_realpg<YYYYMMDDHHMMSS><6hex>`; the runner creates it, runs the focused harness, then drops it with `DROP DATABASE IF EXISTS ... WITH (FORCE)` in `finally`. Target part: DB naming/drop behavior.
4. Severity: High. Evidence: `scripts/run-real-pg-harness-managed.mjs:61`, `scripts/run-real-pg-harness-managed.mjs:67`, `scripts/run-real-pg-harness-managed.mjs:68`, `scripts/run-real-pg-harness-managed.mjs:69`, `scripts/run-real-pg-harness-managed.mjs:70`, `docs/DEPLOYMENT.md:385`, `docs/DEPLOYMENT.md:388`. Recommendation: the managed runner sets child `REAL_POSTGRES_DATABASE_URL` and `DATABASE_URL` to the throwaway DB and generates ephemeral `SESSION_SECRET` and `SECRET_VAULT_KEK` if absent; operators should not add `db:migrate` or `db:seed` around this command. Target part: harness environment.
5. Severity: High. Evidence: `tests/integration/db-real-postgres.test.ts:81`, `tests/integration/db-real-postgres.test.ts:84`, `tests/integration/db-real-postgres.test.ts:87`, `tests/integration/db-real-postgres.test.ts:90`, `docs/DEPLOYMENT.md:419`, `docs/DEPLOYMENT.md:440`. Recommendation: use a fresh empty throwaway DB for every active run; the harness applies raw migrations and self-seeds, so a stale or reused DB is a likely migration/table-set failure and is not valid acceptance. Target part: active real-PG runbook.
6. Severity: High. Evidence: `tests/integration/db-real-postgres.test.ts:67`, `docs/ACCEPTANCE_MATRIX_MASTER.md:39`, `docs/DEPLOYMENT.md:431`, `docs/DEPLOYMENT.md:440`. Recommendation: direct fallback runs must set `REAL_POSTGRES_DATABASE_URL` to exactly `wtc_test` or one `wtc_test_<lowercase-alnum>` suffix; a skipped pass without that URL is NOT RUN, not acceptance. Target part: direct harness fallback.
7. Severity: Medium. Evidence: `tests/integration/db-real-postgres.test.ts:99`, `tests/integration/db-real-postgres.test.ts:115`, `tests/integration/db-real-postgres.test.ts:147`, `tests/integration/db-real-postgres.test.ts:155`, `tests/integration/db-real-postgres.test.ts:189`, `tests/integration/db-real-postgres.test.ts:225`. Recommendation: likely active failures are real migration incompatibility, seed idempotency, entitlement uniqueness/concurrency, schema table drift, billing webhook idempotency, failed-login lockout serialization, or duplicate unlock serialization. Target part: expected failure triage.
8. Severity: Medium. Evidence: `scripts/run-real-pg-harness-managed.mjs:90`, `scripts/run-real-pg-harness-managed.mjs:91`, `tests/integration/real-pg-managed-runner-safety.test.ts:62`, `tests/integration/real-pg-managed-runner-safety.test.ts:79`, `tests/integration/real-pg-managed-runner-safety.test.ts:90`, `tests/integration/real-pg-managed-runner-safety.test.ts:114`. Recommendation: do not pass ad-hoc flags such as `--dry-run`; unknown args are refused before credential use and should not echo URL-shaped inputs. Target part: command invocation safety.
9. Severity: Medium. Evidence: `scripts/run-real-pg-harness-managed.mjs:115`, `scripts/run-real-pg-harness-managed.mjs:121`, `scripts/run-real-pg-harness-managed.mjs:124`, `docs/DEPLOYMENT.md:333`, `docs/DEPLOYMENT.md:340`. Recommendation: after a failed or interrupted run, verify no `wtc_test_realpg*` DB remains and scan any retained redacted output before archiving; a drop failure should keep the gate failed. Target part: cleanup/evidence retention.
10. Severity: Medium. Evidence: `tests/integration/real-pg-managed-runner-safety.test.ts:41`, `tests/integration/real-pg-managed-runner-safety.test.ts:42`, `tests/integration/real-pg-managed-runner-safety.test.ts:43`, `tests/integration/real-pg-managed-runner-safety.test.ts:44`, `tests/integration/real-pg-managed-runner-safety.test.ts:48`. Recommendation: this gate is deliberately outside default `e2e`, `ci:local`, and `scripts/gates.mjs`; schedule it as a single-purpose credentialed phase, not as part of broad local gates. Target part: gate sequencing.
## Decisions
- Keep Phase 3.60 as a read-only tests-runner audit, not an execution phase.
- Do not run `npm run accept:real-pg:managed`, direct `REAL_POSTGRES_DATABASE_URL` harness, `db:migrate`, `db:seed`, `psql CREATE/DROP`, preview, Playwright, provider preflights, SSH, nginx, systemd, bot control, GitHub CI, deploy, or monitoring in this auditor pass.
- Prefer the managed command over the direct fallback when an admin maintenance URL is available, because it creates and drops a fresh throwaway database and injects the child env consistently.
- Treat any default no-credential Vitest pass as a safety/helper pass only; active real-PG acceptance requires the DB-mutating block to run and pass without skips.
## Risks
- A malformed or overbroad admin URL can point at the wrong database host; the runner refuses `wtc_test*` as the admin DB name, but the operator must still verify host, port, user, and maintenance DB before running.
- `DROP DATABASE ... WITH (FORCE)` is expected after the child harness, but a hard kill, network loss, permission issue, or active connection could leave an orphan `wtc_test_realpg*` database.
- The harness intentionally mutates the throwaway DB: migrations, seed rows, user/session/entitlement/audit/webhook/lockout rows, and a test `DELETE FROM users`. This is acceptable only in a disposable `wtc_test*` target.
- If the operator uses the direct fallback instead of managed mode, migrations are not idempotent re-run safe; drop/recreate the target before every run.
- Redacted child output reduces leak risk but does not make raw terminal buffers, screenshots of terminal output, full env dumps, or full connection URLs archive-safe.
## Verification/tests
Gates RUN in this auditor session:

| Gate | Command/evidence | Result |
|---|---|---|
| Required protocol/docs read | `Get-Content` over `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/latest docs | PASS |
| Real-PG runbook/static audit | `rg` and line-numbered inspection of package scripts, managed runner, real-PG tests, safety tests, and deployment/blocker docs | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |

Gates NOT RUN by design: `npm run accept:real-pg:managed`, direct `REAL_POSTGRES_DATABASE_URL` harness, `db:migrate`, `db:seed`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, `npm run accept:audit:append-only-role`, `npm run preview:safe`, default `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, root `npm test`, web build, live LMS object-store/scanner acceptance, Stripe, Axioma, preview/prod DB rollout, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and production monitoring.
## Next actions
1. When credentials are available, run the single credentialed gate from a fresh PowerShell session:
   ```powershell
   cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
   $env:REAL_POSTGRES_ADMIN_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/postgres"
   npm run accept:real-pg:managed
   Remove-Item Env:\REAL_POSTGRES_ADMIN_DATABASE_URL
   ```
2. Acceptance evidence to record: generated `wtc_test_realpg...` DB name, `Created ...` line, focused `tests/integration/db-real-postgres.test.ts` PASS with active real-PG tests not skipped, `Dropped ...` line, exit code 0, and no raw URL/password/env dump retained.
3. After the gate, verify cleanup with an admin/maintenance query that prints only database names:
   ```powershell
   psql -h 127.0.0.1 -U <user> -d postgres -c "SELECT datname FROM pg_database WHERE datname LIKE 'wtc_test_realpg%' ORDER BY datname;"
   ```
4. Recommended non-mutating follow-up checks after a successful credentialed run:
   ```powershell
   npm test -- tests/integration/real-pg-managed-runner-safety.test.ts
   npm run secret:scan
   npm run governance:check
   ```
5. If the run fails, do not rerun against the same throwaway DB. Confirm/drop any orphan `wtc_test_realpg*`, keep only redacted output, and triage first against migration order/table drift, seed idempotency, real-engine constraint behavior, or cross-connection race failures.
