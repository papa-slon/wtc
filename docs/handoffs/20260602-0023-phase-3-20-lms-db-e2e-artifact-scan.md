# Phase 3.20 LMS DB e2e artifact scan handoff

## Scope
Phase 3.20 implemented the LMS DB-backed browser artifact no-leak scanner after Phase 3.19, without touching live services,
servers, Postgres, `psql`, migrations, seeds, Stripe, Axioma, TradingView, bots, exchanges, object storage, or malware
scanner endpoints.

Per-agent handoffs cited:
- `ecosystem-tests-runner` - [`docs/handoffs/20260602-0023-ecosystem-tests-runner.md`](20260602-0023-ecosystem-tests-runner.md)
- `ecosystem-security-auditor` - [`docs/handoffs/20260602-0023-ecosystem-security-auditor.md`](20260602-0023-ecosystem-security-auditor.md)
- `ecosystem-devops-implementer` - [`docs/handoffs/20260602-0023-ecosystem-devops-implementer.md`](20260602-0023-ecosystem-devops-implementer.md)
- `ecosystem-backend-implementer` - [`docs/handoffs/20260602-0023-ecosystem-backend-implementer.md`](20260602-0023-ecosystem-backend-implementer.md)

All four background agents were closed after their handoffs were collected.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`
- `docs/handoffs/20260602-0023-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0023-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0023-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0023-ecosystem-backend-implementer.md`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`

## Findings
1. Severity: High. Artifact leak scanning was manual before this phase. Evidence: Phase 3.19 left `npm run e2e:lms:db`
   NOT RUN and required a future artifact scan before acceptance. Resolution: added
   `scripts/scan-lms-db-e2e-artifacts.mjs` and wired it into `scripts/run-lms-db-e2e.mjs`.
2. Severity: High. Playwright failure artifacts can be the highest-risk output because traces/screenshots are retained on
   failure. Resolution: the runner now runs the scanner after any Playwright attempt, preserves the Playwright failure status,
   and also fails if the scanner finds a leak.
3. Severity: High. Generic `secret:scan` is not an LMS DB browser artifact oracle because generated artifact paths are
   ignored or binary. Resolution: the scanner targets generated artifact roots only and fails on LMS material bytes/base64,
   storage keys, raw iframe markers, DB URLs, auth headers, cookies, session/KEK/prep-token assignments, and password hashes.
4. Severity: Medium. Binary screenshots should not be treated as text proof, while compressed traces must not be accepted
   unscanned. Resolution: image artifacts are counted/skipped as images; `.zip`, `.gz`, `.br`, `.pdf`, and unknown binary
   artifacts fail closed.
5. Severity: Medium. Scanner output must not echo secret values. Resolution: failures print file path plus category only,
   never the matched value.

## Decisions
- Keep `npm run e2e:lms:db` opt-in and out of default `npm run e2e`, `npm run ci:local`, and `node scripts/gates.mjs full`.
- Scan generated artifact roots only: `test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`.
- Treat screenshots as visual artifacts that may need human visual review; the scanner proves text artifact cleanliness only.
- Keep the actual DB-backed browser acceptance gate honest: it remains NOT RUN until a fresh throwaway
  `LMS_E2E_DATABASE_URL` run exits 0, scanner exits 0, evidence is archived, and the DB is dropped.

## Risks
- The scanner has not been observed on real LMS DB Playwright artifacts because no fresh throwaway DB URL was supplied.
- The current scanner fails closed on compressed/container artifacts instead of expanding trace zips. This is safe for
  acceptance but may require a later decompression implementation if operators want to archive failed-run traces.
- Local DB-byte browser acceptance is still not production object storage, external malware scanning, signed-object delivery,
  or quarantine cleanup.

## Verification/tests
RUN:
1. Focused Vitest: `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-material-download-handler.test.ts packages/auth/src/security-headers.test.ts` -> PASS, 60 passed.
2. `npm run typecheck` -> PASS.
3. `npm run typecheck -w @wtc/web` -> PASS.
4. `node scripts/gates.mjs full` -> PASS, 9/9 gates.
5. Env-cleared `node scripts/gates.mjs e2e` -> PASS, 44 passed.
6. `node scripts/scan-lms-db-e2e-artifacts.mjs` against current generated roots -> PASS, 2 text files and 68 image files scanned/skipped by category, 0 blocked containers.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied, and this gate would start Playwright on a guarded local server and mutate a throwaway database.
2. Live Stripe, Axioma, TradingView, bot/exchange, preview/prod server, object storage, malware scanner, SSH, tmux, or systemd operations - out of scope and not touched.

## Next actions
1. When an operator provides a fresh empty `wtc_test_lms_*` database URL, run `npm run e2e:lms:db`, archive only redacted
   evidence, confirm the scanner passes, and drop the throwaway database.
2. In a later phase, consider expanding trace zips in a temp directory instead of failing closed if failed-run trace archive
   retention becomes operationally necessary.
