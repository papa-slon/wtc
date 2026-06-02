# Phase 3.19 LMS DB browser negative coverage handoff
## Scope
Phase 3.19 extended the local-only LMS DB-backed browser acceptance harness with negative/security browser assertions and hardened the harness environment split. No live Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview-worker, production service, object storage, malware scanner, or live endpoint was touched. No database was mutated in this session; `npm run e2e:lms:db` was not run because no fresh throwaway Postgres URL was supplied.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`
- `package.json`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `packages/db/src/seed.ts`

## Files changed
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`

## Agent handoffs
1. `ecosystem-tests-runner` - [`docs/handoffs/20260601-2355-ecosystem-tests-runner.md`](20260601-2355-ecosystem-tests-runner.md)
2. `ecosystem-education-implementer` - [`docs/handoffs/20260601-2355-ecosystem-education-implementer.md`](20260601-2355-ecosystem-education-implementer.md)
3. `ecosystem-backend-implementer` - [`docs/handoffs/20260601-2355-ecosystem-backend-implementer.md`](20260601-2355-ecosystem-backend-implementer.md)
4. `ecosystem-security-auditor` - [`docs/handoffs/20260601-2355-ecosystem-security-auditor.md`](20260601-2355-ecosystem-security-auditor.md)
5. `ecosystem-devops-implementer` - [`docs/handoffs/20260601-2355-ecosystem-devops-implementer.md`](20260601-2355-ecosystem-devops-implementer.md)

## Findings
1. Severity: High. DB browser negative coverage existed only as a recommended follow-up after Phase 3.18. This phase extended `tests/e2e/lms-db-materials.spec.ts` to assert unauthenticated `401`, non-entitled `403`, quarantined file no-download UI, sanitized Vimeo iframe rendering, clean-file strict headers/hash/body, invalid-ID no-store `400`, rendered no-leak checks, and admin audit visibility. Recommendation: run the command against a fresh throwaway DB before accepting the gate as observed. Target part: LMS DB browser acceptance.
2. Severity: High. The LMS DB browser runner accepted `REAL_POSTGRES_DATABASE_URL` as a fallback, which could mix it with the separate real-PG Vitest harness. This phase removed the fallback from both runner and prep script and documents `LMS_E2E_DATABASE_URL` as the only accepted browser URL variable. Recommendation: keep the two gates separately reported. Target part: harness env isolation.
3. Severity: Medium. The prep marker remained after a run. This phase cleans `.next-e2e-db/lms-db-e2e-prepared.json` in a runner `finally` block and prints artifact/drop-DB reminders. Recommendation: retain direct config invocation as unsupported. Target part: direct-run hardening.
4. Severity: Medium. Acceptance matrix did not list the LMS DB browser gate. This phase added it as a separate global gate and documented PG7 NOT RUN semantics until an observed fresh-DB run exists. Target part: docs/source of truth.

## Decisions
- Keep `npm run e2e` as default demo/in-memory Playwright smoke.
- Keep `npm run e2e:lms:db` separate from `full`, `ci:local`, and default `e2e`.
- Use only `LMS_E2E_DATABASE_URL` for the browser harness; reserve `REAL_POSTGRES_DATABASE_URL` for `tests/integration/db-real-postgres.test.ts`.
- Quarantined files are visible to entitled students with scan state and `download unavailable`; they are not downloadable and no file bytes are rendered.

## Risks
- The actual DB-backed browser acceptance command remains unobserved because no fresh throwaway DB URL was supplied.
- Generated artifacts from a future `npm run e2e:lms:db` run must be scanned for uploaded bytes/base64/storage keys/raw embed HTML before claiming acceptance.
- Production object storage, malware scanning, signed-object redirects, and quarantine cleanup remain separate production blockers.
- The workspace is not git-backed, so commit/branch/PR readiness cannot be claimed.

## Verification/tests
RUN:
1. `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-material-download-handler.test.ts packages/auth/src/security-headers.test.ts` - PASS, 54 tests.
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
5. `node scripts/gates.mjs e2e` with `DATABASE_URL`, `LMS_E2E_DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL` cleared - PASS, 44 passed.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied; running it would mutate a database and start a local server.
2. `psql`, `npm run db:migrate`, `npm run db:seed`, and direct DB setup/drop commands - no operator-provided throwaway DB URL/credentials in this session.
3. Live Stripe webhook replay or live billing calls - out of scope and no credentials.
4. Live Axioma endpoint-shape/account-link/download acceptance - out of scope and no endpoint/key approval.
5. Live TradingView automation/private invite mutation - out of scope.
6. Live bot/exchange control or adapter mutation - forbidden by phase guardrails.
7. Preview/production server, SSH, tmux, systemd, nginx, object storage, malware scanner, or worker deployment changes - forbidden by phase guardrails.

## Next actions
1. Rerun focused tests, full gate, and default env-cleared e2e after final docs/scripts changes.
2. Create a fresh empty throwaway Postgres database named `wtc_test_lms_<timestamp>`, set `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db`, archive/scan artifacts, then drop the DB.
3. Add artifact scanning automation for LMS DB e2e output before accepting the observed gate.
4. Implement production object storage and signed-object redirects behind explicit deployment approval.
5. Replace local deterministic scan with production malware-scanner integration and quarantine cleanup policy.
