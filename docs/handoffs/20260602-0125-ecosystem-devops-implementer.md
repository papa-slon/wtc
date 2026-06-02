# ecosystem-devops-implementer handoff
## Scope
Phase 3.23 read-only devops inspection for whether this repo already defines a safe local throwaway Postgres creation path for `npm run e2e:lms:db`, and what must remain NOT RUN when no safe `LMS_E2E_DATABASE_URL` exists. No servers, Playwright, DB create/drop, migrations, seeds, psql, Docker mutations, live endpoints, external services, or production paths were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/gates.mjs`
- `playwright.lms-db.config.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `.env.example`
- `docker-compose.yml`
- `.github/workflows/ci.yml`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Evidence: `docs/DEPLOYMENT.md:52` says LMS DB-backed browser acceptance is an opt-in throwaway DB flow; `docs/DEPLOYMENT.md:58`-`66` documents manual `psql` database creation, `LMS_E2E_DATABASE_URL`, and then `npm run e2e:lms:db`; `docs/DEPLOYMENT.md:68`-`71` documents manual evidence archival and DB drop. The repo therefore defines a safe documented operator flow, but not an executable repo-local creation script. `package.json:28` only maps `e2e:lms:db` to `node scripts/run-lms-db-e2e.mjs`; `scripts/run-lms-db-e2e.mjs:7`-`14` exits when `LMS_E2E_DATABASE_URL` is absent; `scripts/prepare-lms-db-e2e.ts:27`-`30` requires an already-existing URL and opens it. Recommendation: do not treat `npm run e2e:lms:db` as a database provisioner; run it only after the operator creates and supplies a fresh local throwaway URL, or add a separate approved devops phase for a guarded creation helper. Target part: LMS DB acceptance setup.

2. Severity: High. Evidence: the guarded runner accepts only `LMS_E2E_DATABASE_URL` and explicitly rejects using `REAL_POSTGRES_DATABASE_URL` for this path at `scripts/run-lms-db-e2e.mjs:7`-`14`; it maps `DATABASE_URL` internally to that same URL for the browser app at `scripts/run-lms-db-e2e.mjs:19`-`33`; it invokes the prep script, Playwright config, and artifact scanner in sequence at `scripts/run-lms-db-e2e.mjs:55`-`75`. The prep script validates throwaway database naming at `scripts/prepare-lms-db-e2e.ts:10`-`23`, refuses non-empty public schemas at `scripts/prepare-lms-db-e2e.ts:32`-`42`, then applies committed migrations and seeds at `scripts/prepare-lms-db-e2e.ts:44`-`50`. Recommendation: keep the single supported entry point as `npm run e2e:lms:db`; do not run the Playwright config directly and do not substitute `REAL_POSTGRES_DATABASE_URL`. Target part: harness guardrails.

3. Severity: High. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:21` says LMS DB browser acceptance is only with `LMS_E2E_DATABASE_URL` pointing at a fresh empty `wtc_test_lms_*`; `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`73` says the DB upload/download gate is RUN only after fresh DB creation, URL set, Playwright exit 0, scanner exit 0, redacted evidence archive, and DB drop, and otherwise remains NOT RUN. `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` says the actual `npm run e2e:lms:db` throwaway-Postgres browser run is still NOT RUN because no fresh `LMS_E2E_DATABASE_URL` was supplied. Recommendation: if no fresh safe URL exists in this main-thread session, keep `npm run e2e:lms:db` NOT RUN and do not claim default e2e, PGlite, scanner-only, or source-level checks as DB-backed browser acceptance. Target part: phase gate reporting.

4. Severity: Medium. Evidence: `.env.example:11`-`17` defines `DATABASE_URL` and the separate `REAL_POSTGRES_DATABASE_URL` placeholder, but has no `LMS_E2E_DATABASE_URL` placeholder; `docker-compose.yml:8`-`14` creates a persistent local `wtc` database volume, not a fresh LMS throwaway DB; `.github/workflows/ci.yml:81`-`90` creates/recreates `wtc_test` only for the real-Postgres Vitest harness; `.github/workflows/ci.yml:115`-`118` runs default `npm run e2e`, not `npm run e2e:lms:db`. Recommendation: do not infer a safe LMS throwaway creation path from Docker, CI, or `.env.example`; they do not provide the required `wtc_test_lms_*` browser-acceptance URL. Target part: devops environment paths.

5. Severity: Medium. Evidence: `docs/DEPLOYMENT.md:58` allows the DB name to be `wtc_test` or start with `wtc_test_`, while the LMS acceptance matrix is stricter and names `wtc_test_lms_*` at `docs/ACCEPTANCE_MATRIX_MASTER.md:21` and `docs/ACCEPTANCE_MATRIX_MASTER.md:68`; the implementation also accepts `wtc_test` or any `wtc_test_<suffix>` at `scripts/prepare-lms-db-e2e.ts:17`-`20` and `playwright.lms-db.config.ts:17`-`18`. Recommendation: for the LMS browser gate, the main thread should use the stricter `wtc_test_lms_<timestamp>` naming convention even though the guard accepts the broader `wtc_test_*` family; a future docs/devops cleanup can narrow wording if desired. Target part: throwaway DB naming clarity.

## Decisions
- The repo already documents a safe manual local throwaway Postgres flow for the LMS DB browser gate, but it does not provide an npm/local script that creates and drops the LMS throwaway database automatically.
- The safest current acceptance posture is: `npm run e2e:lms:db` is available but remains NOT RUN unless an operator supplies a fresh empty local `LMS_E2E_DATABASE_URL` for a `wtc_test_lms_*` database.
- `REAL_POSTGRES_DATABASE_URL` remains reserved for `tests/integration/db-real-postgres.test.ts`; it is not a fallback for LMS browser acceptance.

## Risks
- Running the LMS DB browser gate with any non-throwaway or populated URL would apply migrations/seeds and browser writes to the wrong database; the script guards naming and emptiness, but the operator must still create and point at the correct local DB.
- Docker Compose creates a persistent `wtc` database, not an isolated LMS acceptance database; using it as the LMS URL would be refused by the name guard and would be unsafe if bypassed.
- Default `npm run e2e`, `node scripts/gates.mjs e2e`, PGlite tests, CI real-PG harness, and scanner-only checks can all pass while the actual LMS DB browser gate remains unobserved.
- Artifact handling must stay redacted: the scanner checks generated text artifacts for Postgres URLs, `LMS_E2E_DATABASE_URL`, `DATABASE_URL`, session/auth markers, and secret-shaped values at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`45`, but screenshots still need human visual review after a real run.

## Verification/tests
- RUN: read-only line-numbered inspection of the files listed above; no product code, tests, docs, runtime services, databases, Docker state, live endpoints, or external services were mutated.
- NOT RUN: `npm run e2e:lms:db` because no fresh safe `LMS_E2E_DATABASE_URL` was supplied and the command would apply migrations/seeds to a throwaway database, start the LMS DB Playwright web server, run browser tests, and run the generated-artifact scanner.
- NOT RUN: `psql` create/drop, Docker Compose up/down, `npm run db:migrate`, `npm run db:seed`, direct `scripts/prepare-lms-db-e2e.ts`, direct `npx playwright test -c playwright.lms-db.config.ts`, Next dev/e2e servers, live endpoints, external services, preview/production DB migrations/seeds, nginx/systemd/deploy actions, and any bot/exchange controls; all were forbidden by scope and/or unsafe without an operator-provided throwaway URL.
- NOT RUN: production object storage, external malware scanning, signed-object redirects, quarantine cleanup, public upload rollout, and production deployment gates; these are outside the local LMS DB browser harness and remain open per `docs/DEPLOYMENT.md:84` and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`.

## Next actions
1. Safest main-thread action: do not run `npm run e2e:lms:db` yet. In the aggregate handoff/final report, list it as NOT RUN unless the operator provides a fresh empty local `postgres://.../wtc_test_lms_<timestamp>` URL.
2. If the operator provides a safe local URL in a separate allowed step, verify the database name is `wtc_test_lms_*`, verify it is local throwaway Postgres, set only `LMS_E2E_DATABASE_URL`, run only `npm run e2e:lms:db`, archive redacted stdout plus generated reports/screenshots only after the scanner passes, then drop the throwaway DB from an operator/admin connection.
3. Do not use `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, Docker's persistent `wtc` database, CI's `wtc_test`, or default Playwright e2e as substitutes for the LMS DB browser acceptance gate.
