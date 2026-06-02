# ecosystem-devops-implementer handoff
## Scope
Phase 3.18 read-only devops audit for adding a safe, opt-in DB-backed LMS browser acceptance command. Scope covered Playwright configuration, gate runner behavior, package scripts, deployment and env documentation, the real-Postgres harness, LMS DB/browser boundaries, e2e login behavior, and the current LMS upload/download runtime path. No servers, Playwright runs, migrations, seeds, psql commands, database connections, live endpoints, live services, SSH, tmux, or systemd commands were run.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/IMPLEMENTED_FILES.md
- docs/ACCEPTANCE_MATRIX_MASTER.md
- docs/DEPLOYMENT.md
- .env.example
- package.json
- apps/web/package.json
- packages/db/package.json
- playwright.config.ts
- scripts/gates.mjs
- tests/integration/db-real-postgres.test.ts
- packages/config/src/env.ts
- apps/web/instrumentation.ts
- apps/web/src/lib/backend.ts
- packages/db/src/seed.ts
- apps/web/src/app/api/e2e/login/route.ts
- tests/e2e/helpers/auth.ts
- tests/e2e/education-ph3-1-mobile.spec.ts
- apps/web/src/features/lms/actions.ts
- apps/web/src/features/lms/queries.ts
- apps/web/src/features/lms/material-download.ts
- apps/web/src/app/teacher/courses/[id]/page.tsx
- apps/web/src/app/teacher/materials/page.tsx
- apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- tests/integration/db-lms-ph3-1.test.ts
- tests/integration/lms-material-download-handler.test.ts
- docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md
- docs/handoffs/20260601-2303-ecosystem-devops-implementer.md
- docs/handoffs/20260601-2303-ecosystem-tests-runner.md

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: default Playwright uses a dedicated dev server but does not set `DATABASE_URL` (`playwright.config.ts:23`, `playwright.config.ts:24`, `playwright.config.ts:29`, `playwright.config.ts:30`, `playwright.config.ts:31`, `playwright.config.ts:32`, `playwright.config.ts:33`, `playwright.config.ts:34`), root `npm run e2e` is plain `playwright test` (`package.json:27`), and Phase 3.17 states default Playwright remains demo/in-memory unless a separate DB-backed browser project is added (`docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:55`). Recommendation: add a separate opt-in command, not a change to default `npm run e2e`: root `e2e:lms:db` -> `node scripts/run-lms-db-e2e.mjs`, a dedicated `playwright.lms-db.config.ts`, a distinct web server port such as 3101, and `NEXT_DIST_DIR=.next-e2e-lms-db`. Target part: package scripts, Playwright config, devops wrapper script.

2. Severity: High. Evidence: the real-PG harness already refuses non-throwaway DB names before connecting (`tests/integration/db-real-postgres.test.ts:47`, `tests/integration/db-real-postgres.test.ts:54`, `tests/integration/db-real-postgres.test.ts:56`, `tests/integration/db-real-postgres.test.ts:57`, `tests/integration/db-real-postgres.test.ts:71`), and deployment docs require `REAL_POSTGRES_DATABASE_URL` to target `wtc_test` or `wtc_test_*` (`docs/DEPLOYMENT.md:67`, `docs/DEPLOYMENT.md:80`, `docs/DEPLOYMENT.md:85`, `docs/DEPLOYMENT.md:115`, `docs/DEPLOYMENT.md:116`, `docs/DEPLOYMENT.md:119`). Recommendation: the browser wrapper must validate a dedicated `LMS_DB_E2E_DATABASE_URL` before exporting it to child `DATABASE_URL`, require an explicit opt-in such as `LMS_DB_E2E=1`, refuse existing `DATABASE_URL` unless it exactly equals the validated URL, redact credentials in logs, and refuse obvious persistent DB names like `wtc`, `wtc_platform_preview`, `postgres`, or `production`. Target part: `scripts/run-lms-db-e2e.mjs` and `.env.example`/deployment notes in a later implementation phase.

3. Severity: High. Evidence: a DB-backed Next server will hit typed env validation: `DATABASE_URL`, `SESSION_SECRET`, and `SECRET_VAULT_KEK` are required (`packages/config/src/env.ts:26`, `packages/config/src/env.ts:28`, `packages/config/src/env.ts:29`), `SECRET_VAULT_KEK` must be a base64 32-byte key in every environment (`packages/config/src/env.ts:61`, `packages/config/src/env.ts:64`, `packages/config/src/env.ts:65`), and Next instrumentation calls `loadEnv()` at server boot (`apps/web/instrumentation.ts:12`, `apps/web/instrumentation.ts:13`). Recommendation: the opt-in wrapper should generate ephemeral `SESSION_SECRET` and `SECRET_VAULT_KEK` for the child process when absent, never print them, set `APP_ENV=development`, keep `BOT_ADAPTER_MODE=mock`, and force `FEATURE_LIVE_BOT_CONTROL=false` plus `FEATURE_TV_AUTOMATION=false`. Target part: wrapper environment construction.

4. Severity: Medium. Evidence: root DB scripts mutate whatever child `DATABASE_URL` targets (`package.json:24`, `package.json:25`; `packages/db/package.json:11`, `packages/db/package.json:12`), while deployment docs say `db:seed` and `db:migrate` are separated and the real-PG harness self-seeds its throwaway DB (`docs/DEPLOYMENT.md:106`, `docs/DEPLOYMENT.md:107`, `docs/DEPLOYMENT.md:108`, `docs/DEPLOYMENT.md:111`, `docs/DEPLOYMENT.md:112`). Recommendation: if the command performs setup, run `db:migrate` and `db:seed` only after the throwaway URL guard passes, only against the guarded child env, and keep any drop/create/reset helper out of the default command. If reset is later automated, make it a separate command requiring a second opt-in such as `LMS_DB_E2E_DROP_OK=1`. Target part: DB setup flow for the opt-in command.

5. Severity: Medium. Evidence: DB seed creates demo users and the published teacher course but not browser-ready lesson/material rows (`packages/db/src/seed.ts:29`, `packages/db/src/seed.ts:30`, `packages/db/src/seed.ts:31`, `packages/db/src/seed.ts:57`, `packages/db/src/seed.ts:60`); the current LMS e2e spec is explicitly navigation-only and says teacher editor / DB-backed detail are out of e2e reach without `DATABASE_URL` (`tests/e2e/education-ph3-1-mobile.spec.ts:5`, `tests/e2e/education-ph3-1-mobile.spec.ts:7`, `tests/e2e/education-ph3-1-mobile.spec.ts:10`, `tests/e2e/education-ph3-1-mobile.spec.ts:11`). Recommendation: add a focused `tests/e2e/lms-db.acceptance.spec.ts` that logs in as `teacher@wtc.local`, creates/publishes a lesson, uploads a small clean file through the teacher UI, logs in as `user@wtc.local`, opens the student lesson, downloads the material, and asserts strict download headers. Use unique run-tagged names so repeated runs against the same throwaway DB do not collide. Target part: Playwright LMS DB acceptance spec.

6. Severity: Medium. Evidence: LMS download surfaces are genuinely DB-dependent and fail closed when DB is absent (`apps/web/src/features/lms/queries.ts:3`, `apps/web/src/features/lms/queries.ts:4`, `apps/web/src/features/lms/queries.ts:69`; `apps/web/src/features/lms/material-download.ts:43`, `apps/web/src/features/lms/material-download.ts:56`), and DB repositories only return downloadable files when the material is file, clean, not deleted, and attached to published lesson/course rows (`packages/db/src/repositories.ts:809`, `packages/db/src/repositories.ts:811`). Recommendation: acceptance should include both positive and negative browser checks: clean file downloads, quarantined/failed file shows no download, and non-education user denial once a no-entitlement fixture exists. Until a denied-user fixture exists, record denied-user browser coverage as NOT RUN rather than faking it. Target part: LMS e2e fixture strategy and acceptance matrix.

7. Severity: Low. Evidence: `scripts/gates.mjs` header still says `full = core + build + e2e` (`scripts/gates.mjs:16`), but the implementation deliberately keeps e2e as its own plan (`scripts/gates.mjs:43`, `scripts/gates.mjs:46`, `scripts/gates.mjs:50`, `scripts/gates.mjs:52`), and deployment says `ci:local` omits e2e (`docs/DEPLOYMENT.md:133`). Recommendation: when adding the DB-backed LMS command, keep it outside `full` and `ci:local`; optionally add a separate `lms-db-e2e` gates plan or wrapper entry, and correct the stale header comment in a later implementation phase. Target part: `scripts/gates.mjs` documentation and optional plan.

## Decisions
- Treated this as the requested foreground `ecosystem-devops-implementer` read-only audit, not a broad multi-agent implementation phase.
- Did not run Playwright, npm gates, Next dev servers, migrations, seeds, real-PG harness, psql, Docker, workers, preview commands, or live endpoint checks.
- Proposed a new opt-in command instead of modifying default `npm run e2e`, `node scripts/gates.mjs full`, or `npm run ci:local`.
- Chose a throwaway-DB guard before child `DATABASE_URL` export as the core safety boundary.
- No background agents were spawned; none are running or left to clean up.

## Risks
- Reusing a developer's existing `DATABASE_URL` would be the main foot-gun: the browser test creates LMS rows and can persist them if pointed at preview or production.
- Generating the DB-backed browser server with invalid placeholder secrets will fail at boot because typed env validation runs in the Next server process.
- Adding this command to `full` or `ci:local` would make normal local gates slower and DB-mutating by default.
- Browser tests cannot easily roll back server-action DB writes transactionally, so the safe model is a guarded throwaway DB, not a shared persistent database.
- Denied-user browser coverage needs a deliberate fixture because current seed gives the regular demo user an active `education` entitlement.

## Verification/tests
RUN:
- Memory quick pass for prior WTC gate/e2e conventions.
- Read protocol and process files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`.
- Read current truth docs: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`.
- Read requested devops files: `playwright.config.ts`, `scripts/gates.mjs`, root `package.json`, `apps/web/package.json`, `packages/db/package.json`, `docs/DEPLOYMENT.md`, `.env.example`, and `tests/integration/db-real-postgres.test.ts`.
- Read relevant runtime files for feasibility: `packages/config/src/env.ts`, `apps/web/instrumentation.ts`, `apps/web/src/lib/backend.ts`, LMS query/action/download code, e2e auth helper, e2e login route, DB seed, and LMS repository/schema snippets.
- `Test-Path docs/handoffs/20260601-2350-ecosystem-devops-implementer.md` returned `False` before writing this handoff.
- `git status --short` was attempted and returned `fatal: not a git repository`, matching existing repo docs that this workspace is not git-backed.

NOT RUN:
- `npm run e2e`, `node scripts/gates.mjs e2e`, and any Playwright command were NOT RUN because the prompt forbids starting servers and running Playwright.
- `npm run dev`, `npm run dev -w @wtc/web`, `npm run preview:safe`, worker commands, and any server start were NOT RUN because the prompt forbids starting servers.
- `npm run db:migrate`, `npm run db:seed`, the real-PG harness, psql, Docker, database connections, and database mutations were NOT RUN because the prompt forbids database mutation and psql.
- `npm test`, `npm run typecheck`, `npm run build`, `node scripts/gates.mjs full`, and `npm run db:generate` were NOT RUN because this was a read-only audit and those commands can write logs/artifacts or perform broad verification outside the single allowed handoff write.
- Live endpoints, raw-IP preview, production services, bot/exchange services, Axioma, TradingView, Stripe, SSH, tmux, and systemd were NOT RUN/TOUCHED because the prompt forbids live mutation and live endpoint access.

## Next actions
1. Add `scripts/run-lms-db-e2e.mjs` as the single entry point. It should require `LMS_DB_E2E=1`, require `LMS_DB_E2E_DATABASE_URL`, validate the DB name before setting child `DATABASE_URL`, generate ephemeral child-only secrets when missing, force mock/off safety flags, run guarded migrate/seed only against the throwaway URL, then run Playwright with the LMS DB config.
2. Add root script `e2e:lms:db` and, if useful, a separate `node scripts/gates.mjs lms-db-e2e` plan. Do not include it in `full` or `ci:local`.
3. Add `playwright.lms-db.config.ts` with port 3101, `reuseExistingServer: false`, `NEXT_DIST_DIR=.next-e2e-lms-db`, safe env flags, and a narrowed test match for `tests/e2e/lms-db.acceptance.spec.ts`.
4. Add `tests/e2e/lms-db.acceptance.spec.ts` for teacher lesson/material creation, clean file download as student, strict header/hash checks, and an honest skipped/TODO denied-user case until a no-entitlement fixture exists.
5. Update deployment/env docs in a later implementation phase to document the exact opt-in command, throwaway DB naming rule, what it mutates, what remains NOT RUN, and why default e2e remains demo-safe.
