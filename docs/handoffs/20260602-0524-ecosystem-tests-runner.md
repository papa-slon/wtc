# ecosystem-tests-runner handoff
## Scope
Read-only test/gate audit for Phase 3.34 LMS cleanup dead-letter operational review/alerting. Inspected current integration, e2e, static scanner tests, and gate scripts. No product code, tests, or docs were edited.
## Files inspected
- `apps/worker/src/index.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `package.json`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
## Files changed
None - read-only audit.
## Findings
1. High - Dead-letter mechanics are locally tested, but operational review/alerting is still not implemented or test-covered. Evidence: failed pending cleanup tasks become `dead_letter` in `packages/db/src/repositories.ts:889`, `packages/db/src/repositories.ts:903`, and `packages/db/src/repositories.ts:904`; the worker increments `deadLettered` in `apps/worker/src/lms-object-cleanup.ts:202` and `apps/worker/src/lms-object-cleanup.ts:205`; the worker test asserts `workerHealthStatus` is `error` and one cleanup task is `dead_letter` in `tests/integration/worker-tortila-snapshot.test.ts:303` and `tests/integration/worker-tortila-snapshot.test.ts:315`; docs still list dead-letter operational review/alerting as open in `docs/STATUS.md:21` and `docs/DEPLOYMENT.md:80`. Recommendation: Phase 3.34 should add a count-only review/alert signal for dead-lettered LMS cleanup tasks and prove it in focused integration tests. Target part: worker ops, admin ops, and DB/repository boundary.
2. High - Persisted worker health records include count-only LMS pending cleanup fields, but the admin projection currently drops them. Evidence: worker writes `lmsPendingObjectCleanupScanned`, `lmsPendingObjectCleanupFailed`, and `lmsPendingObjectCleanupDeadLettered` into health detail in `apps/worker/src/index.ts:139`, `apps/worker/src/index.ts:143`, and `apps/worker/src/index.ts:144`; `projectHealthDetail()` only allows keys listed in `apps/web/src/features/admin/health-detail.ts:3` through `apps/web/src/features/admin/health-detail.ts:24`, and its loop skips non-allowlisted keys at `apps/web/src/features/admin/health-detail.ts:55` through `apps/web/src/features/admin/health-detail.ts:59`. Recommendation: add count-only LMS cleanup keys to the health-detail allowlist, with tests that forbidden object keys, cleanup IDs, auth headers, and provider text are still removed. Target part: `apps/web/src/features/admin/health-detail.ts` and `tests/integration/admin-health-detail.test.ts`.
3. Medium - `/admin/system-health` currently displays generic integration-health JSON, not an explicit LMS cleanup review/alert surface. Evidence: `loadSystemHealth()` reads the latest worker row from `integration_health_checks` in `apps/web/src/features/admin/queries.ts:159` through `apps/web/src/features/admin/queries.ts:164`; the page's worker heartbeat card only shows latest tick and safety state in `apps/web/src/app/admin/system-health/page.tsx:40` through `apps/web/src/app/admin/system-health/page.tsx:67`; the integration health table truncates raw projected detail to 120 chars in `apps/web/src/app/admin/system-health/page.tsx:209` and `apps/web/src/app/admin/system-health/page.tsx:210`. Recommendation: add an explicit admin ops summary/card for LMS cleanup failures/dead letters and test that it is visible without exposing task IDs, storage keys, signed tokens, filenames, hashes, scanner details, or provider bodies. Target part: admin system-health query/view and admin responsive/e2e tests.
4. Medium - Existing e2e coverage reaches `/admin/system-health`, but it does not seed or assert LMS cleanup dead-letter visibility. Evidence: `tests/e2e/smoke.spec.ts:178` through `tests/e2e/smoke.spec.ts:186` only asserts the page heading, safety-disabled labels, and screenshot; `tests/e2e/admin-mobile-pg8.spec.ts:24` through `tests/e2e/admin-mobile-pg8.spec.ts:32` only includes `/admin/system-health` in the mobile route list. Recommendation: after the ops surface exists, add default e2e/static coverage for the label/empty state and use the DB-backed LMS browser gate only for real Postgres evidence when credentials are supplied. Target part: e2e and DB-browser acceptance.
5. Medium - Artifact scanner coverage already rejects raw cleanup object evidence, but Phase 3.34 should add alert/review-specific no-leak fixtures once that artifact shape exists. Evidence: scanner denies storage keys, signed URL tokens, database URL assignments, scanner token assignments, cookies, and auth headers in `scripts/scan-lms-db-e2e-artifacts.mjs:12` through `scripts/scan-lms-db-e2e-artifacts.mjs:54`; tests reject object cleanup and pending upload cleanup artifacts with raw keys/auth/tokens in `tests/integration/lms-db-e2e-artifact-scan.test.ts:78` through `tests/integration/lms-db-e2e-artifact-scan.test.ts:96`. Recommendation: add fixtures for dead-letter alert/review text that fail on raw task IDs, object keys, signed query tokens, auth headers, scanner details, filenames/hashes, or provider response bodies, and pass on count-only summaries. Target part: artifact scanner tests.
6. Medium - Final gate wording must keep DB-browser and live gates separate from local full/e2e gates. Evidence: `scripts/gates.mjs` defines `full` as governance/check/lint/typecheck/secret/test/db-generate/build and keeps Playwright `e2e` as a separate plan in `scripts/gates.mjs:43` through `scripts/gates.mjs:52`; `package.json:27` through `package.json:29` defines default e2e separately from `e2e:lms:db` and `e2e:lms:db:managed`; `docs/ACCEPTANCE_MATRIX_MASTER.md:68` through `docs/ACCEPTANCE_MATRIX_MASTER.md:76` says the LMS DB browser gate is NOT RUN without a fresh throwaway/admin DB URL. Recommendation: final report must list local gates RUN and DB-browser/live gates NOT RUN unless observed this session. Target part: phase handoff and final report.
## Decisions
- Phase 3.34 acceptance should be test-first around operator visibility, not another retry-mechanics-only slice.
- Count-only `integration_health_checks` worker detail is the narrowest existing signal to expose first, but it must pass through `projectHealthDetail()` and render as an explicit admin ops warning.
- If a durable review queue is added instead of health-only alerting, it needs its own DB/repository tests for count-only payloads, idempotency, resolution/acknowledgement, and audit redaction.
- DB-browser, live S3/R2, live external scanner, and public rollout remain separate observed gates.
## Risks
- Dead-lettered cleanup tasks can remain invisible to operators even though worker health is `error`.
- Adding LMS cleanup counters to admin detail without a strict allowlist test can leak raw object metadata.
- A generic integration-health JSON cell is easy to miss and may truncate the exact dead-letter signal.
- Reusing billing manual-review surfaces without a distinct LMS cleanup type could mix unrelated operational queues.
## Verification/tests
Read-only audit only; no tests or gates were run.

Recommended focused tests for the Phase 3.34 implementation:
- `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-responsive.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts`
- If a new ops/review repository is added, include its new focused file in the same command, for example `tests/integration/lms-cleanup-dead-letter-ops.test.ts`.
- If the admin page renders a new visible dead-letter card, add a default e2e assertion to `tests/e2e/smoke.spec.ts` or `tests/e2e/admin-mobile-pg8.spec.ts` for the count-only label/empty state.

Exact final local gates for Phase 3.34 after implementation:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run worker:smoke`
- `npm run db:generate -w @wtc/db`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e` with LMS DB env vars cleared unless intentionally running DB-browser acceptance
- `node scripts/scan-lms-db-e2e-artifacts.mjs`
- final `npm run secret:scan`
- final `npm run governance:check`

Gates that remain NOT RUN unless the required external state is supplied and observed:
- `npm run e2e:lms:db` - requires `LMS_E2E_DATABASE_URL` pointing at a fresh empty throwaway `wtc_test_lms_*` or accepted test DB.
- `npm run e2e:lms:db:managed` - requires `LMS_E2E_ADMIN_DATABASE_URL` that can create/drop a fresh `wtc_test_lms_*` database.
- Live S3/R2 upload/download/delete/reconcile acceptance - requires operator-approved object-store credentials and retained scanned evidence.
- Live external scanner acceptance - requires operator-approved scanner endpoint/token and safe clean/quarantine/failure/timeout corpus.
- Public upload rollout - requires DB browser, live object-store, live scanner, dead-letter ops review/alerting, shared object-store primitives, and artifact scanner evidence.
## Next actions
- Implement the Phase 3.34 ops surface with count-only dead-letter visibility.
- Add projection/admin/static/e2e/scanner tests before claiming the operational review/alerting gate.
- Keep DB-browser and live gates explicitly NOT RUN until their credentials and observed evidence exist.
