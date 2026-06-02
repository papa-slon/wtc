# Phase 3.18 LMS DB browser acceptance harness handoff
## Scope
Phase 3.18 implemented a local-only, opt-in DB-backed LMS browser acceptance harness and closed adjacent low-risk LMS safety gaps. No live Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview-worker, production service, object storage, malware scanner, or live endpoint was touched. No database was mutated in this session; the new DB-backed browser command was not run because no fresh throwaway Postgres URL was supplied.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `package.json`
- `apps/web/package.json`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/security-headers.test.ts`
- `packages/lms/src/materials.ts`

## Files changed
- `package.json`
- `apps/web/package.json`
- `playwright.lms-db.config.ts`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/security-headers.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`

## Agent handoffs
1. `ecosystem-tests-runner` - [`docs/handoffs/20260601-2350-ecosystem-tests-runner.md`](20260601-2350-ecosystem-tests-runner.md)
2. `ecosystem-education-implementer` - [`docs/handoffs/20260601-2350-ecosystem-education-implementer.md`](20260601-2350-ecosystem-education-implementer.md)
3. `ecosystem-backend-implementer` - [`docs/handoffs/20260601-2350-ecosystem-backend-implementer.md`](20260601-2350-ecosystem-backend-implementer.md)
4. `ecosystem-db-architect` - [`docs/handoffs/20260601-2350-ecosystem-db-architect.md`](20260601-2350-ecosystem-db-architect.md)
5. `ecosystem-security-auditor` - [`docs/handoffs/20260601-2350-ecosystem-security-auditor.md`](20260601-2350-ecosystem-security-auditor.md)
6. `ecosystem-devops-implementer` - [`docs/handoffs/20260601-2350-ecosystem-devops-implementer.md`](20260601-2350-ecosystem-devops-implementer.md)

## Findings
1. Severity: High. The DB-backed LMS browser acceptance path is now implemented as an opt-in guarded harness, but it remains an unobserved gate until run with a fresh throwaway Postgres URL. Recommendation: run `npm run e2e:lms:db` only with `LMS_E2E_DATABASE_URL=postgres://.../wtc_test_lms_<timestamp>`, archive artifacts, and drop the DB afterward. Target part: LMS DB browser acceptance.
2. Severity: High. Direct Playwright config invocation could previously bypass the prep guard. This phase added a prep-token/HMAC marker written after migrations and seed complete; `playwright.lms-db.config.ts` now fails closed unless the marker matches `LMS_E2E_DATABASE_URL`. Recommendation: keep `npm run e2e:lms:db` as the only accepted entry point. Target part: DB e2e harness.
3. Severity: Medium. Upload size was enforced after `arrayBuffer()`. This phase added `file.size > LMS_MAX_FILE_BYTES` preflight in the server action before reading bytes, while keeping package-level byte validation. Target part: LMS teacher upload action.
4. Severity: Medium. Malformed material IDs could reach the DB layer. This phase added UUID validation in the download handler and no-store `400` response coverage. Target part: LMS material download route boundary.
5. Severity: Medium. Sanitized LMS embeds needed an explicit CSP frame policy. This phase added `frame-src` for YouTube/Vimeo embed hosts while preserving `frame-ancestors 'none'`. Target part: security headers.
6. Severity: Medium. The browser spec needed stronger no-leak and header assertions. This phase added `x-content-type-options`, `x-lms-sha256`, invalid-ID, and rendered HTML no-leak assertions for bytes/base64/storage keys. Target part: DB-backed browser spec.

## Decisions
- Keep default `npm run e2e` as demo/in-memory browser smoke on port 3100.
- Keep DB-backed LMS browser acceptance separate as `npm run e2e:lms:db` on port 3101, because it mutates a disposable database and starts an isolated dev server.
- Require fresh empty `wtc_test` / `wtc_test_*` database names and refuse non-empty schemas before applying migrations.
- Do not treat local `db-local` byte storage as production object storage or production malware scanning.

## Risks
- `npm run e2e:lms:db` has not been observed green in this session because no safe throwaway DB URL was provided.
- Browser negatives for unauthenticated/non-entitled download, quarantined file no-download, and sanitized embed rendering are still recommended follow-ups.
- Real object storage, production malware scanning, signed-object redirects, and quarantine cleanup are still production blockers.
- The workspace is not git-backed, so commit/branch/PR readiness cannot be claimed.

## Verification/tests
RUN:
1. `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-material-download-handler.test.ts packages/auth/src/security-headers.test.ts` - PASS, 52 tests.
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
5. `node scripts/gates.mjs e2e` with `DATABASE_URL`, `LMS_E2E_DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL` cleared - PASS, 44 passed.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied; running it would mutate a database.
2. `psql`, `npm run db:migrate`, `npm run db:seed`, and direct DB setup/drop commands - no operator-provided throwaway DB URL/credentials in this session.
3. Live Stripe webhook replay or live billing calls - out of scope and no credentials.
4. Live Axioma endpoint-shape/account-link/download acceptance - out of scope and no endpoint/key approval.
5. Live TradingView automation/private invite mutation - out of scope.
6. Live bot/exchange control or adapter mutation - forbidden by phase guardrails.
7. Preview/production server, SSH, tmux, systemd, nginx, object storage, malware scanner, or worker deployment changes - forbidden by phase guardrails.

## Next actions
1. Create a fresh empty throwaway Postgres database named `wtc_test_lms_<timestamp>`, set `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db`, archive artifacts, then drop the DB.
2. Extend DB browser acceptance with unauthenticated/non-entitled download denial, quarantined file no-download, and sanitized embed render checks.
3. Implement production object storage and signed-object redirects behind explicit deployment approval.
4. Replace local deterministic scan with production malware-scanner integration and quarantine cleanup policy.
5. Continue live Stripe and Axioma acceptance only when credentials, endpoint contracts, and operator approval are provided.
