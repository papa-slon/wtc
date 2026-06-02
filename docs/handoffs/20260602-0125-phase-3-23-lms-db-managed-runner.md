# phase-3-23-lms-db-managed-runner handoff
## Scope
Local LMS DB browser acceptance readiness hardening for Phase 3.23. This phase did not run the DB-backed browser gate because no usable `LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL` was available. It instead removes two local blockers:
- hosts without `psql` now have an optional managed runner that can create/drop a fresh LMS throwaway DB from an operator-provided admin URL;
- the prep/config database-name guard now accepts the documented `wtc_test_lms_*` naming scheme used by the runbook and managed runner.

No preview/prod server, live endpoint, bot/exchange control, production storage, database create/drop, migration/seed run, Playwright browser run, or external integration was touched.

Per-agent handoffs:
- [`docs/handoffs/20260602-0125-ecosystem-tests-runner.md`](20260602-0125-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-0125-ecosystem-security-auditor.md`](20260602-0125-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-0125-ecosystem-backend-implementer.md`](20260602-0125-ecosystem-backend-implementer.md)
- [`docs/handoffs/20260602-0125-ecosystem-devops-implementer.md`](20260602-0125-ecosystem-devops-implementer.md)

All four background agents were collected and closed before this aggregate was finalized.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `package.json`
- `apps/web/package.json`
- `.env.example`
- `docker-compose.yml`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/handoffs/20260602-0125-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0125-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0125-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0125-ecosystem-devops-implementer.md`

## Files changed
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `package.json`
- `.env.example`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md`

## Findings
1. Severity: High. Evidence: `docs/handoffs/20260602-0125-ecosystem-devops-implementer.md` and `docs/handoffs/20260602-0125-ecosystem-tests-runner.md`. Before this phase, the repo documented a manual `psql` throwaway-DB flow but had no npm-managed create/drop helper. Recommendation: keep the manual flow, and use `npm run e2e:lms:db:managed` only when an operator supplies a non-throwaway admin URL. Target part: LMS DB browser gate setup.
2. Severity: High. Evidence: `scripts/run-lms-db-e2e-managed.mjs:6`, `scripts/run-lms-db-e2e-managed.mjs:33`, `scripts/run-lms-db-e2e-managed.mjs:69`, `scripts/run-lms-db-e2e-managed.mjs:80`, and `package.json:29`. The managed runner now requires `LMS_E2E_ADMIN_DATABASE_URL`, creates a generated `wtc_test_lms_*` DB, delegates to the existing `npm run e2e:lms:db` harness, and drops only the generated DB in `finally`. Recommendation: do not treat this as production deployment or persistent DB provisioning; it is a disposable local/CI acceptance helper. Target part: managed runner.
3. Severity: High. Evidence: `docs/handoffs/20260602-0125-ecosystem-security-auditor.md` and `docs/handoffs/20260602-0125-ecosystem-tests-runner.md`. The agents found a real mismatch: docs and managed runner used `wtc_test_lms_*`, while the old prep/config regex rejected multi-segment names. This phase fixed the guard at `scripts/prepare-lms-db-e2e.ts:17` and `playwright.lms-db.config.ts:18`. Recommendation: keep the documented `wtc_test_lms_<timestamp>` convention and do not use ad hoc names. Target part: throwaway DB name guard.
4. Severity: Medium. Evidence: `.env.example:20`, `docs/DEPLOYMENT.md:75`, and `docs/ACCEPTANCE_MATRIX_MASTER.md:21`. Operator docs now show both supported paths: direct `LMS_E2E_DATABASE_URL` for an already-created throwaway DB, and managed `LMS_E2E_ADMIN_DATABASE_URL` for create/delegate/drop. Recommendation: never set either variable to preview/prod; never archive raw URLs. Target part: runbook and env hygiene.
5. Severity: Medium. Evidence: local inspection during this phase showed no `LMS_E2E_DATABASE_URL`, no `LMS_E2E_ADMIN_DATABASE_URL`, no `DATABASE_URL`, no `REAL_POSTGRES_DATABASE_URL`, no `psql`/Docker CLI, and failed common local Postgres credentials despite `127.0.0.1:5432` listening. Recommendation: keep the actual DB browser acceptance gate NOT RUN until the operator supplies a valid throwaway or admin URL. Target part: acceptance reporting.

## Decisions
- `npm run e2e:lms:db` remains the core acceptance runner. The managed wrapper is only a provisioning convenience around that runner.
- `LMS_E2E_DATABASE_URL` remains the authoritative target URL for direct runs; `REAL_POSTGRES_DATABASE_URL` remains reserved for the separate real-PG Vitest harness.
- `LMS_E2E_ADMIN_DATABASE_URL` must point at a non-throwaway maintenance DB and must not be archived or printed.
- The DB-name guard should accept `wtc_test` and multi-segment `wtc_test_*` names, with `wtc_test_lms_*` as the LMS browser convention.
- `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` are still NOT RUN in this phase because no valid throwaway/admin URL is available.

## Risks
- The managed runner was syntax/static verified but not runtime-verified because DB create/drop and Playwright were intentionally not run without credentials.
- `DROP DATABASE ... WITH (FORCE)` requires a supported Postgres version; the local docs target PostgreSQL 17 and Postgres 13+ supports the clause.
- Scanner pass on stale roots is not proof of a DB browser run; current-run evidence must be isolated, scanned, redacted, and visually reviewed where screenshots are retained.
- The production LMS upload blockers remain: object storage, production malware scanning, signed-object redirects, cleanup policy, observed DB-backed browser acceptance, and public rollout approval.

## Verification/tests
RUN:
1. Read-only local environment checks: `LMS_E2E_DATABASE_URL`, `LMS_E2E_ADMIN_DATABASE_URL`, `DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL` were not set; `127.0.0.1:5432` was listening; `psql`/Docker CLI were not available; common local Postgres credentials failed.
2. `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`15` passed).
3. `node --check scripts/run-lms-db-e2e-managed.mjs` - PASS.
4. `npm run governance:check` after this aggregate existed and linked all four per-agent handoffs - PASS (0 errors, 1 known historical warning).
5. `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
6. Env-cleared `node scripts/gates.mjs e2e` with `LMS_E2E_DATABASE_URL` and `LMS_E2E_ADMIN_DATABASE_URL` removed - PASS (`44 passed`).
7. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` image files, `0` blocked containers, `2` missing roots, `70` total artifact files).

NOT RUN:
1. `npm run e2e:lms:db` - NOT RUN because no fresh empty `LMS_E2E_DATABASE_URL` is available; running it would apply migrations/seeds, start a local server, run Playwright, and scan artifacts.
2. `npm run e2e:lms:db:managed` - NOT RUN because no `LMS_E2E_ADMIN_DATABASE_URL` is available and the command would create/drop a database and delegate to the DB browser gate.
3. DB create/drop, `psql`, Docker mutations, migrations/seeds outside tests, direct Playwright config, Next e2e servers, live endpoints, external services, production object storage, malware scanner, deploy actions, and bot/exchange controls - NOT RUN by scope and safety.

## Next actions
1. If the operator supplies `LMS_E2E_ADMIN_DATABASE_URL`, run `npm run e2e:lms:db:managed` and require Playwright exit 0 plus scanner exit 0 before marking the LMS DB browser gate RUN.
2. If the operator supplies a pre-created `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db` directly.
3. Archive only redacted current-run evidence after scanner pass and screenshot review/discard, then ensure the throwaway DB is dropped.
