# ecosystem-tests-runner handoff
## Scope
Phase 3.24 read-only test review for LMS material retention/quarantine cleanup and worker invocation. Inspected current LMS DB tests, LMS material download handler tests, worker tests, gate runner, package scripts, and directly related LMS material/worker implementation surfaces. No gates, servers, Playwright, DB commands, migrations/seeds, live endpoints, or external services were run.

## Files inspected
- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `packages/db/package.json`
- `packages/lms/package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`

## Files changed
None - read-only audit. Administrative handoff written at `docs/handoffs/20260602-0144-ecosystem-tests-runner.md` only.

## Findings
1. Medium - LMS file lifecycle has storage/scan/retention/deleted columns and checks, but no focused retention cleanup test exists yet. Evidence: `packages/db/src/schema.ts:260` defines `file_bytes_base64`, `packages/db/src/schema.ts:263` defines `scan_status`, `packages/db/src/schema.ts:266` defines `retained_until`, `packages/db/src/schema.ts:267` defines `deleted_at`, and `packages/db/src/schema.ts:277`-`packages/db/src/schema.ts:283` requires file rows to carry storage metadata and retention while non-file rows must not. Existing DB coverage creates clean/quarantined files and validates download lookup only (`tests/integration/db-lms-ph3-1.test.ts:112`-`tests/integration/db-lms-ph3-1.test.ts:129`). Recommendation: add a PGlite repository test for the retention cleanup repository once implemented: seed expired clean, unexpired clean, expired quarantined, already deleted, link, and embed materials; invoke the cleanup at a fixed `now`; assert only eligible file rows are soft-deleted or purged per product decision and that `listMaterials`/`getMaterialFileForPublishedLesson` cannot return cleaned rows. Target part: `packages/db/src/repositories.ts` with coverage in a new `tests/integration/db-lms-material-retention.test.ts` or a focused block in `tests/integration/db-lms-ph3-1.test.ts`.

2. Medium - Quarantine behavior is covered for creation and download denial, not cleanup semantics. Evidence: `packages/lms/src/materials.ts:117`-`packages/lms/src/materials.ts:129` classifies EICAR/executable-looking text as `quarantined`; `packages/lms/src/materials.test.ts:49`-`packages/lms/src/materials.test.ts:54` unit-tests that scanner result; `tests/integration/lms-material-download-handler.test.ts:168`-`tests/integration/lms-material-download-handler.test.ts:182` proves a quarantined file returns 404 and does not audit a download. Recommendation: add cleanup tests that verify quarantined expired rows are removed from teacher/student material lists, never become downloadable during cleanup, and do not leak `quarantineReason`, `storageKey`, `fileBytesBase64`, or raw body through failure/audit surfaces. Target part: LMS material cleanup repository plus `lms-material-download-handler` no-leak assertions.

3. Medium - Worker DB tick currently invokes entitlements, TradingView expiry/repair, handoff JTI purge, and Tortila snapshot, but there is no LMS material cleanup invocation or count in the worker result/log. Evidence: `apps/worker/src/index.ts:68`-`apps/worker/src/index.ts:77` imports worker repository jobs; `apps/worker/src/index.ts:87`-`apps/worker/src/index.ts:92` runs entitlement/TV/JTI jobs; `apps/worker/src/index.ts:103`-`apps/worker/src/index.ts:114` records only those counts in worker health; `apps/worker/src/tick-once.ts:22`-`apps/worker/src/tick-once.ts:25` logs only worker, entitlement, TV, JTI, and Tortila fields. Existing worker tests assert health mapping and Tortila snapshot paths (`tests/integration/worker-health-mapping.test.ts:32`-`tests/integration/worker-health-mapping.test.ts:66`, `tests/integration/worker-tortila-snapshot.test.ts:60`-`tests/integration/worker-tortila-snapshot.test.ts:88`). Recommendation: after adding the LMS cleanup repository, wire it into `runDbWorkerTick`, add a result field such as `lmsMaterialsCleaned`, include it in worker health detail and `tick-once` output, and add a PGlite worker test that seeds expired/active/quarantined materials then asserts one tick invokes cleanup exactly once and reports the count. Target part: `apps/worker/src/index.ts`, `apps/worker/src/tick-once.ts`, and a new `tests/integration/worker-lms-material-cleanup.test.ts` or a focused block in `worker-tortila-snapshot.test.ts`.

4. Low - The safe one-shot worker wrapper is only indirectly covered. Evidence: root scripts expose `worker:smoke` as `node scripts/safe-worker-tick.mjs` (`package.json:21`-`package.json:22`), the wrapper forces `APP_ENV=development`, mock adapter mode, and live-control flags off (`scripts/safe-worker-tick.mjs:9`-`scripts/safe-worker-tick.mjs:14`), and it auto-adds `--memory-demo` when `DATABASE_URL` is absent unless `--require-db` is passed (`scripts/safe-worker-tick.mjs:21`-`scripts/safe-worker-tick.mjs:23`). Recommendation: add a static integration test that reads `scripts/safe-worker-tick.mjs` and asserts the forced safe env, `shell: false`, `windowsHide: true`, `--memory-demo` fallback, and `--require-db` escape hatch remain in place. Target part: worker invocation safety tests.

5. Low - Existing command topology supports focused Vitest first, with gates intentionally separate. Evidence: root `test` is `vitest run` (`package.json:14`), LMS DB browser acceptance is opt-in (`package.json:28`-`package.json:29`), the gate runner plans are serialized and write per-gate logs (`scripts/gates.mjs:30`-`scripts/gates.mjs:40`, `scripts/gates.mjs:61`-`scripts/gates.mjs:99`), and `full` intentionally excludes Playwright while `e2e` is a separate plan (`scripts/gates.mjs:43`-`scripts/gates.mjs:52`). Recommendation: do not put the new cleanup worker acceptance behind Playwright or the LMS DB browser runner unless UI/browser behavior changes; keep core cleanup/worker invocation coverage in Vitest/PGlite. Target part: test command plan.

## Decisions
- Recommend repository-level PGlite tests for retention/quarantine cleanup first because current LMS DB tests already use real migrations and repository APIs (`tests/integration/db-lms-ph3-1.test.ts:23`-`tests/integration/db-lms-ph3-1.test.ts:30`) without requiring Docker or live services.
- Recommend worker-level PGlite coverage through `runDbWorkerTick` rather than `npm run worker:smoke`, because `runDbWorkerTick` is exported specifically for one-shot verification without starting the interval (`apps/worker/src/index.ts:5`-`apps/worker/src/index.ts:7`, `apps/worker/src/index.ts:68`).
- Keep LMS DB browser acceptance out of this focused cleanup recommendation unless cleanup changes student/teacher visible behavior; the existing harness is opt-in and dedicated (`tests/integration/lms-db-e2e-harness.test.ts:118`-`tests/integration/lms-db-e2e-harness.test.ts:127`).

## Risks
- If cleanup physically deletes file rows instead of soft-deleting with `deleted_at`, tests must assert the chosen invariant explicitly. Current delete behavior is soft-delete (`packages/db/src/repositories.ts:762`-`packages/db/src/repositories.ts:765`) and current read paths filter `deleted_at` (`packages/db/src/repositories.ts:580`-`packages/db/src/repositories.ts:582`, `packages/db/src/repositories.ts:648`-`packages/db/src/repositories.ts:650`, `packages/db/src/repositories.ts:809`).
- `recordMaterialDownloadAudit` currently includes internal file metadata in audit `after` (`packages/db/src/repositories.ts:833`-`packages/db/src/repositories.ts:850`), while admin projection/static tests expect audit views to stay payload-free (`tests/integration/lms-ph3-1-static.test.ts:186`-`tests/integration/lms-ph3-1-static.test.ts:198`). Cleanup audit tests should verify admin/API projections, not only raw audit rows.
- This pass did not validate git state because `git status --short` from this cwd returned "fatal: not a git repository".

## Verification/tests
Gates run: none.

Gates not run:
- `npm test` - skipped by scope; this was a read-only inspection without gates.
- `node scripts/gates.mjs quick` - skipped by scope; gate runner read only.
- `node scripts/gates.mjs core` - skipped by scope; gate runner read only.
- `node scripts/gates.mjs full` - skipped by scope; gate runner read only.
- `node scripts/gates.mjs e2e` - skipped by scope; Playwright/server runs forbidden.
- `npm run e2e:lms:db` - skipped by scope; DB/Playwright run forbidden.
- `npm run e2e:lms:db:managed` - skipped by scope; DB create/drop and Playwright forbidden.
- `npm run worker:smoke` / `npm run worker:tick` - skipped by scope; worker invocation commands forbidden.

Exact recommended focused commands after implementation:
- `npm test -- packages/lms/src/materials.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts`
- If new focused files are added: `npm test -- tests/integration/db-lms-material-retention.test.ts tests/integration/worker-lms-material-cleanup.test.ts`
- If the worker result type/log output changes: `npm run typecheck`
- For operator-level phase gates after focused tests pass: `node scripts/gates.mjs core`
- For browser acceptance only if UI/browser behavior changes and a throwaway DB is available: `npm run e2e:lms:db:managed`

## Next actions
1. Implement an LMS material cleanup repository function with a fixed `now` parameter and explicit soft-delete vs physical-delete semantics.
2. Add focused PGlite tests for retention cleanup and quarantined-file cleanup using the current `db-lms-ph3-1` migration/apply pattern.
3. Wire the cleanup function into `runDbWorkerTick`, expose a count in the worker result/health detail, and update `tick-once` output.
4. Add a focused worker tick test that proves cleanup is invoked during one DB worker tick without starting the long-running worker.
5. Add a static safety test for `scripts/safe-worker-tick.mjs` so future changes do not drop forced safe env flags or accidentally switch to shell execution.
