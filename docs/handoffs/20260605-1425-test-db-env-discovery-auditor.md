# test-db-env-discovery-auditor handoff
## Scope
Read-only Phase 4.57 test DB/env discovery audit for the managed admin/user-bot and worker-continuity gates:

- `npm run e2e:admin-user-bots:db:managed:user-routes`
- `npm run e2e:admin-user-bots:db:managed:matrix`
- `npm run accept:worker:continuity:managed`

Operator authorization allowed inspecting/copying local demo/test data and stated local demo/test secrets are non-real and will change. This audit still followed WTC safety: no secret, password, token, DSN, cookie, or exchange key values are printed here; only paths, variable names, SET/NOT_SET status, safety classification, and redacted command plans are recorded. No code edits, live server mutations, bot start/stop/apply-config, deploy, production-looking URL command, or create/drop DB harness was run.

Agent note: this was one narrow foreground auditor lane requested as exactly one handoff. No background agents were launched, so there were no background agents to close.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`
- `docs/handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md`
- `.env.example`
- `docker-compose.yml`
- `package.json`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/safe-worker-tick.mjs`

## Files changed
None - read-only audit. This handoff file was written as the required audit artifact.

## Findings
1. Severity P0 - The exact managed env inputs are currently absent in the process shell. `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `DATABASE_URL`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, and `TORTILA_JOURNAL_TOKEN` all classified as `NOT_SET` in the current process. Recommendation: do not run create/drop managed harnesses until the target admin DB env var is `SET` and validated as local/isolated. Target part: managed DB acceptance gates.

2. Severity P0 - The repo scripts require admin maintenance URLs, not the ordinary app `DATABASE_URL`. `package.json:25` maps `accept:worker:continuity:managed` to `scripts/run-worker-continuity-managed.mjs`; `package.json:38` maps the admin DB matrix lane; `package.json:40` maps the user-routes lane. The admin/user-bot runner reads `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:11`; the worker runner reads `WORKER_CONTINUITY_ADMIN_DATABASE_URL` at `scripts/run-worker-continuity-managed.mjs:11`. Recommendation: set only the lane-specific admin env var for the command being run; do not rely on `DATABASE_URL` fallback. Target part: command preflight.

3. Severity P1 - `.env.example` and `docker-compose.yml` contain a local Postgres candidate, but it is config-only in this shell, not a confirmed runnable/admin input. `.env.example:11-12` documents the local docker-compose Postgres `DATABASE_URL`; `docker-compose.yml:3-15` defines a local Postgres service with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, local port mapping, volume, and healthcheck. Classification: `SAFE_TEST_CANDIDATE_CONFIG_ONLY`. Redacted `SELECT 1` against the example `DATABASE_URL` failed, `docker` is not available as a shell command, and no actual `.env` file was found by the repo env-file scan. Recommendation: treat this as enough to derive a local test plan, but not enough to claim a confirmed admin URL. Target part: local Docker/PG discovery.

4. Severity P1 - Local TCP on `127.0.0.1:5432` is open, but without a successful redacted Postgres connection it is not sufficient proof of the correct isolated DB/user. Classification: `INSUFFICIENT` for immediate managed-harness execution. Recommendation: validate the actual local maintenance URL with a redacted `SELECT 1`, loopback-host check, non-throwaway maintenance DB-name check, and role capability check before any create/drop runner. Target part: DB runtime preflight.

5. Severity P0 - The managed runners have the correct safety rails once a valid admin URL is supplied. The admin/user-bot runner documents that it creates `wtc_test_admin_user_bots_*`, delegates to the DB e2e harness, and drops it at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:23`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:113`, and `scripts/run-admin-user-bot-detail-e2e-managed.mjs:123`. It refuses non-Postgres URLs and throwaway admin DB names at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:44-51`, redacts error output at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:56-58`, and passes the target URL only as `ADMIN_USER_BOTS_E2E_DATABASE_URL` to the child at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:89-93`. Recommendation: run only after preflight; scan retained artifacts afterward. Target part: admin/user-bot managed gate.

6. Severity P0 - The worker managed runner also has correct safety rails after a valid admin URL is supplied. It documents that it creates `wtc_test_worker_continuity_*`, applies migrations/seeds, runs the safe worker tick, verifies continuity, and drops the DB at `scripts/run-worker-continuity-managed.mjs:23-29`, `scripts/run-worker-continuity-managed.mjs:356-364`, `scripts/run-worker-continuity-managed.mjs:374`, and `scripts/run-worker-continuity-managed.mjs:398-399`. It forces the child DB URL through `DATABASE_URL` and fixture-only `LEGACY_DATABASE_URL`, blanks Tortila journal URL vars, and uses redacted child output at `scripts/run-worker-continuity-managed.mjs:282-288`. Recommendation: run only against local/isolated maintenance DB; verify the final continuity tuple. Target part: worker managed gate.

7. Severity P1 - The downstream admin/user-bot DB harness separately refuses non-throwaway target databases and checks a prep marker. `playwright.admin-user-bots-db.config.ts:17-20` requires `ADMIN_USER_BOTS_E2E_DATABASE_URL` and a `wtc_test*` DB name; `playwright.admin-user-bots-db.config.ts:29-31` checks the prep marker HMAC. `scripts/prepare-admin-user-bot-detail-e2e.ts:39-49` also refuses a non-`wtc_test*` target DB. Recommendation: keep the managed runner as the entrypoint instead of manually invoking the child harness with an arbitrary DB. Target part: browser DB proof harness.

## Decisions
1. Do not run the three target gates in this session. They remain `NOT RUN` because no confirmed safe local/admin maintenance Postgres URL is set or proven.
2. Classify discovered DB inputs as:
   - `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`: `INSUFFICIENT` / `NOT_SET`.
   - `WORKER_CONTINUITY_ADMIN_DATABASE_URL`: `INSUFFICIENT` / `NOT_SET`.
   - `.env.example` `DATABASE_URL`: `SAFE_TEST_CANDIDATE_CONFIG_ONLY`; local/non-throwaway-shaped but connection failed in a redacted `SELECT 1` probe and it is not the required managed admin env var.
   - `docker-compose.yml` Postgres service: `SAFE_TEST_CANDIDATE_CONFIG_ONLY`; local Postgres shape exists, but Docker CLI is unavailable in this shell and no confirmed running container/admin role was proven.
   - Any remote/non-loopback Postgres URL: `UNSAFE_PRODUCTION_SHAPED` unless explicitly proven disposable and approved before create/drop.
3. The next non-looping path is not more local UI/static code. It is to validate a local isolated maintenance Postgres URL and then run the three already-built managed gates.

## Risks
1. A valid-looking Postgres URL can still point at the wrong cluster. Host, DB name, and role capability must be checked before any create/drop harness.
2. The compose/example local credentials may be stale or may not match the service listening on `127.0.0.1:5432`; TCP-open alone is not DB/auth proof.
3. The ordinary app `DATABASE_URL` is not sufficient for the managed create/drop runners unless it is deliberately copied into the lane-specific admin env var after safety validation.
4. Playwright traces, reports, screenshots, and logs can retain raw markers or unexpected payloads. After managed browser gates, scan redacted stdout/stderr plus `test-results`, `playwright-report`, and `tests/e2e/screenshots` before retaining artifacts.

## Verification/tests
Gates run:

1. Protocol/doc read - PASS: inspected `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/next-actions/implemented-files, and latest blocker handoffs.
2. Env file discovery - PASS: repo scan found `.env.example` only; no actual `.env` file in the repo root scan.
3. Current process env presence check - PASS by name/status only: target managed/source vars are `NOT_SET`.
4. Package script mapping check - PASS: all three requested npm scripts are present.
5. Redacted runner help checks - PASS: both managed runners printed placeholder-only usage and create/drop safety warnings.
6. Runner missing-env preflight checks - PASS: both managed runners refused before DB work when their admin env vars were absent.
7. Local TCP check - PASS as network observation only: `127.0.0.1:5432` accepted TCP.
8. Redacted example-URL connection check - FAIL/INSUFFICIENT: `.env.example` `DATABASE_URL` classified as local/non-throwaway-shaped, but `SELECT 1` failed without printing values.
9. Tooling check - INSUFFICIENT: `docker` command not found; `psql` command not found.

Gates not run:

1. `npm run e2e:admin-user-bots:db:managed:user-routes` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is `NOT_SET` and no confirmed local/admin URL was proven.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is `NOT_SET` and no confirmed local/admin URL was proven.
3. `npm run accept:worker:continuity:managed` - NOT RUN; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is `NOT_SET` and no confirmed local/admin URL was proven.
4. Any create/drop DB probe - NOT RUN; discovery scope only and admin URL not confirmed.
5. Any live bot/provider/deploy command - NOT RUN; explicitly out of scope and forbidden by WTC safety.

## Next actions
1. Preflight a candidate local maintenance URL before any create/drop harness:
   - Confirm the env var is `SET` by name only.
   - Confirm scheme is `postgres://` or `postgresql://`.
   - Confirm host is loopback/local or an explicitly approved disposable test host.
   - Confirm DB name is a maintenance DB and not `wtc_test*`.
   - Run a redacted `SELECT 1` connection check.
   - Run a read-only role capability check such as `current_user` plus `rolcreatedb`/admin equivalent without printing role names or values.
   - Refuse if any value looks remote, production-shaped, populated, live, shared, or not disposable.

2. Redacted command plan for admin/user-bot user routes after preflight passes:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = 'postgres://<user>:<password>@<local-host>:<port>/<maintenance_db>'
npm run e2e:admin-user-bots:db:managed:user-routes
Remove-Item Env:\ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL
```

3. Redacted command plan for admin/user-bot matrix after preflight passes:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = 'postgres://<user>:<password>@<local-host>:<port>/<maintenance_db>'
npm run e2e:admin-user-bots:db:managed:matrix
Remove-Item Env:\ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL
```

4. Redacted command plan for worker continuity after preflight passes:

```powershell
$env:WORKER_CONTINUITY_ADMIN_DATABASE_URL = 'postgres://<user>:<password>@<local-host>:<port>/<maintenance_db>'
npm run accept:worker:continuity:managed
Remove-Item Env:\WORKER_CONTINUITY_ADMIN_DATABASE_URL
```

5. If the same local maintenance DB is approved for both harness families, use the same redacted value sequentially, not in parallel. Let each runner create/drop its own `wtc_test_*` database and finish cleanup before starting the next gate.

6. After managed browser gates, scan redacted stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for hidden raw/source/secret markers before retaining artifacts or claiming acceptance.
