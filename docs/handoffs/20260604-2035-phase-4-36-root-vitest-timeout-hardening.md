# Phase 4.36 root Vitest timeout hardening
## Scope
Stabilize the root Vitest acceptance gate after Phase 4.35 rendered bot statistics proof left `npm test` failing two 5s timeouts in isolated PGlite integration tests.

This was a test-harness hardening phase only. No production loader, repository, UI, worker, adapter, RBAC, entitlement, audit, or live-control behavior was changed.

## Background lanes
- [ecosystem-tests-runner](20260604-2035-root-vitest-timeout-auditor.md)

All background work was collected. Agent `019e92d9-11b6-7722-a744-00d5f7dd0bec` was closed before this aggregate report.

## Files inspected
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `docs/handoffs/20260604-2035-root-vitest-timeout-auditor.md`
- `package.json`
- `vitest.config.ts`

## Files changed
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `docs/handoffs/20260604-2035-root-vitest-timeout-auditor.md`
- `docs/handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md`

## Findings
1. Severity: High. Root `npm test` was failing Vitest's default 5s per-test timeout, not a product assertion. Evidence: both failing tests call `createIsolatedDb()` inside the test body, and that helper creates PGlite, replays migrations, and seeds the DB before reaching loader assertions. Recommendation: keep per-test timeout hardening local to isolated-PGlite body tests.
2. Severity: Medium. Root concurrency made the affected tests exceed or approach 5s: the green post-patch root run reported several isolated-PGlite body tests around 4.5s to 5.9s. Recommendation: avoid treating these as fast unit tests; use the same `30_000` convention already used by adjacent PGlite-heavy hooks and tests.
3. Severity: Low. A global `testTimeout` would hide unrelated future hangs. Recommendation: do not change `vitest.config.ts` for this slice.

## Decisions
- Added `30_000` per-test timeouts to isolated-PGlite body tests in `admin-bot-health-loader.test.ts`.
- Added `30_000` timeout coverage to the PGlite-heavy `beforeAll` and isolated-PGlite body tests in `admin-user-bot-detail-loader.test.ts`, aligning the file with existing local PGlite conventions.
- Did not modify production code.
- Did not add root/global Vitest timeout.
- Did not add helper cleanup in this phase because the failure occurred before cleanup could run; cleanup can be a later test-hygiene slice if root pressure returns.

## Risks
- Root Vitest still prints stderr from negative/security harnesses that intentionally prove fail-closed behavior. The acceptance signal is the process exit code and final summary, both green in this session.
- This phase does not prove managed DB browser acceptance or managed worker continuity with real database URLs; those remain environment-gated.
- Legacy closed-trade import remains blocked by source evidence from Phase 4.31; this phase does not change that product limitation.

## Verification/tests
RUN in this phase:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 2 files, 15 tests.
- `npm test` - PASS, 126 files, 1090 passed, 10 skipped.
- `npm run typecheck` - PASS.
- `npm run lint` - PASS.
- `npm run secret:scan` - PASS.
- `git diff --check` - PASS.
- `npm run governance:check` - PASS after this aggregate was written; 1 known historical warning remains for `20260529-1921-integration-risk-auditor.md`.

NOT RUN in this phase:
- `npm run build -w @wtc/web` - not repeated in this phase; web build was green in Phase 4.35 and this phase only changed integration test timeouts and docs.
- Managed worker continuity with `WORKER_CONTINUITY_ADMIN_DATABASE_URL` - not run because the required managed database URL is not configured in this environment.
- Managed admin user bot DB browser matrix with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` - not run because the required managed database URL is not configured in this environment.
- Live Legacy source import - not run because Phase 4.31 found no durable local closed-trade/fill source and live mutation remains blocked.

## Next actions
1. Re-run `npm run governance:check` after this aggregate file is present.
2. If root Vitest later flakes in other isolated-PGlite body tests, add local `30_000` per-test timeout only to tests that replay migrations inside `it(...)`.
3. Keep the next completion lane on real environment gates: managed DB browser matrix, managed worker continuity, and deployment/runtime smoke proof.
