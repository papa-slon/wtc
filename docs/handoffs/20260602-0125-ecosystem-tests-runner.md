# ecosystem-tests-runner handoff
## Scope
Phase 3.23 read-only tests-runner audit of the current LMS DB browser e2e harness for `npm run e2e:lms:db`.

Goal: determine safe prerequisites, exact supported commands, expected artifacts, likely failure points, and whether the main thread can safely attempt the gate if it obtains a fresh empty throwaway `LMS_E2E_DATABASE_URL`.

No servers, Playwright runs, DB create/drop, migrations, seeds, psql, npm e2e commands, live endpoints, or external services were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/DEPLOYMENT.md`
- `package.json`
- `apps/web/package.json`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/lms/material-download.ts`
- `packages/db/src/seed.ts`
- `packages/config/src/env.ts`
- `apps/web/instrumentation.ts`
- Read-only directory listings for `packages/db/migrations`, `test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`.

## Files changed
None — read-only audit

## Findings
1. Severity: High. Evidence: `package.json:28` wires `npm run e2e:lms:db` to `node scripts/run-lms-db-e2e.mjs`; `scripts/run-lms-db-e2e.mjs:7-14` requires `LMS_E2E_DATABASE_URL` and explicitly rejects using `REAL_POSTGRES_DATABASE_URL`; `scripts/run-lms-db-e2e.mjs:19-33` maps that URL to child `DATABASE_URL`, sets `LMS_DB_E2E=1`, generates the prep token, enables localhost e2e auth bypass, uses `.next-e2e-db`, forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and generates ephemeral secrets if absent; `scripts/run-lms-db-e2e.mjs:54-75` runs prep, then Playwright config, then artifact scanner; `scripts/run-lms-db-e2e.mjs:90-95` cleans the prep marker and describes accepted evidence. Recommendation: the only direct supported command is `npm run e2e:lms:db` from repo root after setting a safe `LMS_E2E_DATABASE_URL`; do not call the prep script or `npx playwright test -c playwright.lms-db.config.ts` directly. Target part: direct gate entry point.

2. Severity: High. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:68-73` says the LMS DB upload/download gate is RUN only after a fresh empty `wtc_test_lms_*` database, `LMS_E2E_DATABASE_URL`, Playwright exit 0, artifact scanner exit 0, redacted evidence archive, and DB drop; `docs/NEXT_ACTIONS.md:11-13` states the actual `npm run e2e:lms:db` gate is still NOT RUN until a fresh throwaway DB is available; `docs/STATUS.md:11-15` repeats that observed DB-backed browser acceptance remains open. Recommendation: until this exact command exits 0 and the scanner exits 0 against a fresh throwaway DB, keep this gate reported as NOT RUN even if default e2e, PGlite tests, or scanner-on-old-artifacts are green. Target part: acceptance reporting.

3. Severity: High. Evidence: `scripts/prepare-lms-db-e2e.ts:10-23` accepts only database names matching `^wtc_test(_[a-z0-9]+)?$`; `docs/ACCEPTANCE_MATRIX_MASTER.md:21` and `docs/ACCEPTANCE_MATRIX_MASTER.md:68` describe the LMS browser DB as `wtc_test_lms_*`; `docs/DEPLOYMENT.md:57-63` shows `wtc_test_lms_YYYYMMDDHHMMSS`; `scripts/run-lms-db-e2e-managed.mjs:31-34` creates `wtc_test_lms_${stamp}_${hex}`. The docs/manual example and managed runner name contain additional underscores that the prep regex rejects. Recommendation: for a direct run right now, use a DB name accepted by current code, for example `wtc_test_lms202606020125` or plain `wtc_test`; do not use `wtc_test_lms_202606020125` unless the prep regex is fixed first. Treat `npm run e2e:lms:db:managed` as likely to fail at prep until the managed name and prep regex are reconciled. Target part: throwaway DB naming contract.

4. Severity: High. Evidence: `scripts/prepare-lms-db-e2e.ts:27-30` requires the URL and runner-generated prep token before connecting; `scripts/prepare-lms-db-e2e.ts:32-42` refuses to continue if the `public` schema has any existing base table; `scripts/prepare-lms-db-e2e.ts:44-50` applies sorted SQL migrations and then calls `seedDatabase(db)`; `scripts/prepare-lms-db-e2e.ts:51-58` writes a URL-HMAC prep marker only after migration and seed succeed. Recommendation: main thread must obtain a genuinely disposable, empty database before attempting the gate; any populated or non-empty `public` schema should be dropped/recreated outside the app before the command. Target part: DB preparation safety.

5. Severity: High. Evidence: `playwright.lms-db.config.ts:13-27` refuses direct config execution unless `LMS_DB_E2E=1`, `LMS_E2E_DATABASE_URL`, the prep token, and matching `.next-e2e-db/lms-db-e2e-prepared.json` HMAC are present; `playwright.lms-db.config.ts:31-47` limits the run to `tests/e2e/lms-db-materials.spec.ts`, one worker, no retries, desktop and mobile projects; `playwright.lms-db.config.ts:48-63` starts `npm run dev:e2e:db -w @wtc/web` on `http://localhost:3101` with `reuseExistingServer:false` and the guarded env. Recommendation: port 3101 must be free, and failures to boot Next within 150 seconds are expected gate failures; do not reuse an existing server as acceptance evidence. Target part: Playwright config and local server boot.

6. Severity: Medium. Evidence: `apps/web/src/app/api/e2e/login/route.ts:5-10` permits the e2e login route only for localhost hosts, non-production, and `E2E_AUTH_BYPASS=1`; `tests/e2e/helpers/auth.ts:3-17` logs in `teacher@wtc.local`, `user@wtc.local`, and `admin@wtc.local` with the demo password; `packages/db/src/seed.ts:27-51` creates those users, roles, and the `education` entitlement for `user@wtc.local`; `packages/db/src/seed.ts:53-61` creates the teacher sample course. Recommendation: login failures are likely if seed does not complete, host is not localhost, `E2E_AUTH_BYPASS` is missing, or the app is accidentally booted in production mode. Target part: e2e auth and seed preconditions.

7. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts:94-237` drives teacher course/lesson/material creation, clean and quarantined file uploads, sanitized Vimeo embed storage, publish, student lesson access, unauthenticated `401`, non-entitled teacher `403`, successful student download headers/body/hash, invalid material id `400`, mobile no-horizontal-scroll screenshot, and admin audit visibility; `tests/e2e/lms-db-materials.spec.ts:28-48` and `tests/e2e/lms-db-materials.spec.ts:58-73` assert no uploaded body/base64/internal metadata leaks on pages and failed responses. Recommendation: likely product/test failures are copy/selector drift, storage status text drift, entitlement drift, material DTO leakage, CSP/embed attribute drift, download header/body drift, mobile horizontal scroll, or missing admin audit event. Target part: LMS DB browser spec expectations.

8. Severity: Medium. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:5-8` scans `test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e` by default; `scripts/scan-lms-db-e2e-artifacts.mjs:12-45` forbids LMS internal fields, uploaded byte markers, raw iframe markers, demo password, Postgres URLs, URL/secret/token assignments, cookies, auth headers, bearer/basic tokens, and argon2 hashes; `scripts/scan-lms-db-e2e-artifacts.mjs:90-112` scans paths plus text file contents; `scripts/scan-lms-db-e2e-artifacts.mjs:95-108` fails closed on zip/gz/br/pdf or unrecognized binary artifacts while skipping image bytes; `scripts/scan-lms-db-e2e-artifacts.mjs:115-126` prints category-only failures or a pass summary. Recommendation: clean or quarantine stale generated artifact roots before the real run only under operator control, and archive evidence only after the scanner exits 0; a Playwright failure trace zip can make the scanner fail as an unscanned container, which is expected fail-closed behavior. Target part: artifact scanning and evidence hygiene.

9. Severity: Medium. Evidence: `packages/config/src/env.ts:26-29` requires `DATABASE_URL`, `SESSION_SECRET`, and `SECRET_VAULT_KEK`; `packages/config/src/env.ts:60-66` requires `SECRET_VAULT_KEK` to be base64 for 32 bytes in every environment; `apps/web/instrumentation.ts:10-13` calls `loadEnv()` at server boot; `scripts/run-lms-db-e2e.mjs:31-32` generates valid ephemeral `SESSION_SECRET` and `SECRET_VAULT_KEK` only when those env vars are absent. Recommendation: before running, clear any inherited invalid `SESSION_SECRET` or `SECRET_VAULT_KEK` placeholders, or replace them with valid values; otherwise Next may fail before the browser spec starts. Target part: child env boot safety.

10. Severity: Medium. Evidence: `package.json:29` exposes `npm run e2e:lms:db:managed`; `scripts/run-lms-db-e2e-managed.mjs:6-27` requires an admin/maintenance URL and refuses admin DBs named `wtc_test*`; `scripts/run-lms-db-e2e-managed.mjs:68-88` creates a DB, runs `npm run e2e:lms:db`, then drops the created DB with `WITH (FORCE)` in `finally`. Recommendation: this read-only agent did not run or validate the managed path because DB create/drop was forbidden; given the naming mismatch in finding 3, use the direct `LMS_E2E_DATABASE_URL` path for this session unless a later phase fixes/verifies managed runner compatibility. Target part: managed runner safety.

## Decisions
1. Main-thread verdict: YES, the main thread can safely attempt `npm run e2e:lms:db` in this session if it obtains a fresh empty throwaway Postgres URL and the database name matches the current code guard (`wtc_test` or `wtc_test_<alnum>`). For LMS-specific naming under the current regex, prefer `wtc_test_lms202606020125`-style names, not `wtc_test_lms_202606020125`.
2. The main thread should not attempt the managed runner in this session unless the name/regex mismatch is fixed or explicitly accepted as a known failing diagnostic run.
3. The command must be treated as mutating only the throwaway database. It must not point at preview, production, a developer's persistent `wtc` database, or the separate `REAL_POSTGRES_DATABASE_URL` real-PG Vitest database.
4. The gate is RUN only if both Playwright and the artifact scanner exit 0. Any missing URL, refused DB name, non-empty DB, server boot failure, Playwright failure, or scanner failure means NOT RUN or FAIL as appropriate, not green.

## Risks
1. The most likely immediate false start is database naming: current docs and managed runner use `wtc_test_lms_<timestamp>` while prep rejects that shape.
2. The second likely failure is stale artifact roots. The scanner checks default roots, not just artifacts from the current run, and fails on compressed/container artifacts.
3. A parent shell with invalid placeholder `SESSION_SECRET` or `SECRET_VAULT_KEK` can override the runner's safe ephemeral generation and break Next boot.
4. Port 3101 conflicts or slow Next startup can fail the webServer gate because `reuseExistingServer:false` and timeout is 150 seconds.
5. The browser spec is intentionally broad and mutating: it covers role login, teacher mutations, student entitlement-gated downloads, failed-response no-leak behavior, mobile layout, and admin audit rendering. Any drift in those surfaces will fail the gate.

## Verification/tests
1. RUN: read-only file inspection of the required harness, config, spec, scanner, protocol, acceptance, and package-script files.
2. RUN: read-only directory listings for current generated artifact roots. Current inspected state: `test-results` has one `.json`; `playwright-report` is missing; `tests/e2e/screenshots` has `.gitkeep` plus 68 `.png` files; `logs/lms-db-e2e` is missing. This is not a scanner pass.
3. NOT RUN: `npm run e2e:lms:db` because the prompt forbade npm e2e, Playwright, server startup, DB mutation, migrations, and seeds.
4. NOT RUN: `npm run e2e:lms:db:managed` because it would create/drop a database and delegate to the mutating browser gate.
5. NOT RUN: `node scripts/prepare-lms-db-e2e.ts`, `npx playwright test -c playwright.lms-db.config.ts`, psql, migrations, seeds, live endpoints, or external services because they were explicitly out of scope.

## Next actions
1. If the operator supplies a direct fresh empty DB URL, use PowerShell from repo root:

```powershell
$env:LMS_E2E_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test_lms202606020125"
npm run e2e:lms:db
Remove-Item Env:\LMS_E2E_DATABASE_URL -ErrorAction SilentlyContinue
```

2. Do not echo or archive the real URL. Archive only redacted stdout/stderr, `test-results/`, `playwright-report/` if generated, and `tests/e2e/screenshots/lms-db-material-lesson-*.png` after the scanner passes.
3. Drop the throwaway database from an operator/admin connection after the run. This read-only agent did not run or derive psql commands.
4. Before using `npm run e2e:lms:db:managed`, reconcile `scripts/run-lms-db-e2e-managed.mjs:31-34` with `scripts/prepare-lms-db-e2e.ts:17`, or add a guard test that proves the managed runner's generated DB name passes `assertThrowawayDbName()`.
