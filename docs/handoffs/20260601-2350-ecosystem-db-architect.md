# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.18 DB architecture audit for the safest DB-backed LMS browser acceptance strategy. Scope covered DB migrations, `seedDatabase`, real-Postgres harness docs/tests, the DB client/backend selector, LMS material schema/repositories, and the current DB-backed Playwright harness. No servers were started, no Playwright run was executed, no database was mutated, no `psql` command was called, and no live endpoint was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/handoffs/20260601-2303-ecosystem-db-architect.md`
- `docs/handoffs/20260601-2303-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `package.json`
- `apps/web/package.json`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `docker-compose.yml`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/package.json`
- `packages/db/src/client.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-cli.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/teacher/materials/page.tsx`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - The safest current browser strategy is the dedicated DB-backed LMS harness, not the default e2e gate. Evidence: root `package.json` exposes `e2e:lms:db` (`package.json:28`), the runner maps the throwaway URL into both `LMS_E2E_DATABASE_URL` and app `DATABASE_URL` while forcing `LMS_DB_E2E=1` and mock/off safety flags (`scripts/run-lms-db-e2e.mjs:13`, `scripts/run-lms-db-e2e.mjs:14`, `scripts/run-lms-db-e2e.mjs:15`), and it invokes `playwright.lms-db.config.ts` (`scripts/run-lms-db-e2e.mjs:33`). The DB config uses isolated port 3101, a dedicated `.next-e2e-db`, one worker, no server reuse, and passes only that URL to the app server (`playwright.lms-db.config.ts:14`, `playwright.lms-db.config.ts:22`, `playwright.lms-db.config.ts:26`, `playwright.lms-db.config.ts:31`). Recommendation: make `npm run e2e:lms:db` the only accepted browser gate for DB-backed LMS upload/download acceptance; keep `npm run e2e` as the in-memory navigation/mobile smoke. Target part: DB-backed browser acceptance runbook and gate matrix.

2. High - The setup guard is strong enough to avoid accidentally using a populated app database, but teardown must be operator-explicit. Evidence: `prepare-lms-db-e2e.ts` rejects missing URLs, validates the DB name as `wtc_test` or `wtc_test_<suffix>`, checks that `public` has zero base tables before applying migrations, and closes the postgres-js pool (`scripts/prepare-lms-db-e2e.ts:24`, `scripts/prepare-lms-db-e2e.ts:25`, `scripts/prepare-lms-db-e2e.ts:35`, `scripts/prepare-lms-db-e2e.ts:49`). It then applies committed SQL migrations and `seedDatabase()` (`scripts/prepare-lms-db-e2e.ts:40`, `scripts/prepare-lms-db-e2e.ts:46`). The deployment docs already warn raw migrations are not re-run idempotent and require drop/recreate for a second run (`docs/DEPLOYMENT.md:97`, `docs/DEPLOYMENT.md:103`, `docs/DEPLOYMENT.md:104`). Recommendation: use a unique disposable DB name per run, preferably `wtc_test_lms_<YYYYMMDDHHMMSS>`, create it empty before the run, and drop that database after the run from an operator/admin connection. Do not reuse a generic `wtc_test` unless it has just been recreated. Target part: setup/teardown procedure.

3. High - Never point browser acceptance at the default local `wtc` database, raw-IP preview DB, or production DB. Evidence: Docker Compose provisions persistent `POSTGRES_DB=wtc` with `./pgdata` (`docker-compose.yml:10`, `docker-compose.yml:14`), `db:seed` targets whatever `DATABASE_URL` is set to (`packages/db/src/seed-cli.ts:5`, `packages/db/src/seed-cli.ts:8`), and deployment docs say the raw-IP preview already uses persistent `wtc_platform_preview` while production migration/seed remain NOT RUN (`docs/DEPLOYMENT.md:171`, `docs/DEPLOYMENT.md:185`, `docs/DEPLOYMENT.md:186`). Recommendation: the browser acceptance URL must be supplied only through `LMS_E2E_DATABASE_URL`, must name a disposable `wtc_test_lms_*` database, and must never be copied from preview/production `.env` files. Target part: DB URL guardrails.

4. Medium - The real-Postgres Vitest harness and the browser harness are complementary but should stay separate. Evidence: `db-real-postgres.test.ts` is opt-in through `REAL_POSTGRES_DATABASE_URL`, has its own DB-name guard, applies migrations, self-seeds, and covers cross-connection races (`tests/integration/db-real-postgres.test.ts:38`, `tests/integration/db-real-postgres.test.ts:47`, `tests/integration/db-real-postgres.test.ts:71`, `tests/integration/db-real-postgres.test.ts:77`, `tests/integration/db-real-postgres.test.ts:87`). Deployment docs explicitly separate `db:seed`/`db:migrate` from that harness and state PGlite is not a substitute (`docs/DEPLOYMENT.md:58`, `docs/DEPLOYMENT.md:106`, `docs/DEPLOYMENT.md:112`). Recommendation: run real-PG race acceptance and LMS DB browser acceptance as two separately reported gates, each against its own fresh throwaway DB. Do not stack both onto one reused database. Target part: gate reporting and database lifecycle.

5. Medium - Directly invoking `playwright.lms-db.config.ts` can bypass the setup guard. Evidence: the runner calls `prepare-lms-db-e2e.ts` before Playwright (`scripts/run-lms-db-e2e.mjs:26`, `scripts/run-lms-db-e2e.mjs:33`), but the Playwright config itself only reads `LMS_E2E_DATABASE_URL` and passes it to `DATABASE_URL`; it does not validate the DB name or emptiness (`playwright.lms-db.config.ts:3`, `playwright.lms-db.config.ts:31`). Recommendation: document "do not run `npx playwright test -c playwright.lms-db.config.ts` directly", and add a future guard/static test so `LMS_DB_E2E=1` fails fast unless the prep script has run or the URL passes the same throwaway validation. Target part: harness hardening.

6. Medium - Current browser coverage proves the clean happy path, but not the safety-denial paths needed before calling the browser gate complete. Evidence: `lms-db-materials.spec.ts` has one test for teacher clean-file upload, student download headers/body, mobile screenshot, and audit-log visibility (`tests/e2e/lms-db-materials.spec.ts:13`, `tests/e2e/lms-db-materials.spec.ts:73`, `tests/e2e/lms-db-materials.spec.ts:76`, `tests/e2e/lms-db-materials.spec.ts:78`, `tests/e2e/lms-db-materials.spec.ts:89`). Repository and handler tests already cover clean/quarantined behavior under PGlite (`tests/integration/db-lms-ph3-1.test.ts:121`, `tests/integration/db-lms-ph3-1.test.ts:124`, `tests/integration/db-lms-ph3-1.test.ts:127`, `tests/integration/db-lms-ph3-1.test.ts:128`; `tests/integration/lms-material-download-handler.test.ts:97`, `tests/integration/lms-material-download-handler.test.ts:98`). Recommendation: extend DB browser acceptance with at least entitlement-denied/revoked download returning 403, quarantined file hidden or not downloadable, and deleted material no longer listed/downloadable. Target part: `tests/e2e/lms-db-materials.spec.ts`.

7. Low - The seed path is appropriate for login/catalog bootstrap, but browser acceptance should continue creating its LMS course/lesson/material through the UI. Evidence: `seedDatabase()` creates demo admin/teacher/user accounts, gives the demo user an education entitlement, and inserts only a published teacher course (`packages/db/src/seed.ts:29`, `packages/db/src/seed.ts:31`, `packages/db/src/seed.ts:46`, `packages/db/src/seed.ts:51`, `packages/db/src/seed.ts:60`). The e2e login route delegates to backend `verifyLogin`/`createSession`, so seeded users are enough for browser auth (`apps/web/src/app/api/e2e/login/route.ts:2`, `apps/web/src/app/api/e2e/login/route.ts:13`, `apps/web/src/app/api/e2e/login/route.ts:16`). Recommendation: keep setup limited to migrations + `seedDatabase`; let the spec create acceptance-specific LMS content with unique names so the browser proves the real action/repository/render path. Target part: fixture discipline.

## Decisions
- Recommended strategy: `LMS_E2E_DATABASE_URL=postgres://.../wtc_test_lms_<timestamp>` -> create fresh empty DB outside the app -> run `npm run e2e:lms:db` -> archive artifacts -> drop the throwaway DB.
- Prefer `LMS_E2E_DATABASE_URL` over falling back to `REAL_POSTGRES_DATABASE_URL` for browser runs, because the browser gate mutates through the app and should not share the race-harness database.
- Do not run `npm run db:migrate` or `npm run db:seed` manually for this browser gate unless explicitly testing those commands against the same verified throwaway DB. The existing prep script already applies committed migrations and seeds.
- Keep the app server in `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` for this gate.
- Report DB-backed LMS browser acceptance as RUN only when the throwaway DB name, empty preflight, Playwright exit code, and teardown/drop action are all observed in the same session. If any of those are missing, report it as NOT RUN or PARTIAL, not green.

## Risks
- A human can still bypass the runner and start the DB Playwright config directly with an unsafe `LMS_E2E_DATABASE_URL`.
- Leaving a generic `wtc_test` database after a run invites accidental reuse, and the prep script will correctly refuse it once tables exist.
- Reusing the raw-IP preview database would mutate persistent preview data through teacher/student browser flows and would not be a valid acceptance run.
- The current happy-path browser spec could pass while entitlement-denial, quarantine, or deletion behavior regresses at the composed browser level.

## Verification/tests
RUN:
- Read-only file inspection with `Get-Content` and targeted `rg -n` across DB migrations, seed scripts, DB client/backend selector, LMS material repositories, real-Postgres harness docs/tests, DB-backed Playwright harness files, and LMS e2e/integration tests.

NOT RUN:
- `npm run e2e:lms:db`, `npm run e2e`, `npx playwright test`, `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run db:migrate`, `npm run db:seed`, `psql`, any database connection, any server start, any live endpoint, and any preview/production service. Reason: the prompt explicitly limited this phase to read-only discovery and forbade servers, Playwright, database mutation, `psql`, and live endpoints.

## Next actions
1. Update the operator runbook to require a unique `wtc_test_lms_<timestamp>` database, `LMS_E2E_DATABASE_URL`, `npm run e2e:lms:db`, and post-run database drop.
2. Harden `playwright.lms-db.config.ts` or add a static guard so direct config invocation cannot bypass the throwaway URL guard.
3. Extend `tests/e2e/lms-db-materials.spec.ts` with entitlement-denied, quarantined, and deleted-material browser checks.
4. Keep `node scripts/gates.mjs e2e` and `npm run e2e:lms:db` separate; default e2e remains demo-mode smoke, DB-backed LMS browser acceptance remains opt-in and separately reported.
