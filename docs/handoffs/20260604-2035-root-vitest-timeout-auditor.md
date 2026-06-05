# ecosystem-tests-runner handoff
## Scope
Read-only diagnosis for Phase 4.36 root Vitest timeout hardening. Focus: two reported root `npm test` 5s timeouts:
- `tests/integration/admin-bot-health-loader.test.ts` > `projects worker bot continuity detail from the latest worker health row`
- `tests/integration/admin-user-bot-detail-loader.test.ts` > `keeps Legacy runtime warnings unscoped when selected provider has no persisted evidence`

No production code edits were made. This lane wrote only this handoff.

## Files inspected
- `package.json:11-49` - root `npm test` command and local gate scripts.
- `vitest.config.ts:6-17` - root Vitest include/exclude and global `hookTimeout`.
- `tests/integration/admin-bot-health-loader.test.ts:37-45` - per-test isolated PGlite helper.
- `tests/integration/admin-bot-health-loader.test.ts:57-68` - shared PGlite `beforeAll` already has 30s hook timeout.
- `tests/integration/admin-bot-health-loader.test.ts:397-493` - affected and adjacent isolated-PGlite tests.
- `tests/integration/admin-bot-health-loader.test.ts:495-537` - adjacent isolated-PGlite test already using 30s.
- `tests/integration/admin-user-bot-detail-loader.test.ts:61-72` - per-test isolated PGlite helper.
- `tests/integration/admin-user-bot-detail-loader.test.ts:74-85` - shared PGlite `beforeAll` already covered by root hook timeout.
- `tests/integration/admin-user-bot-detail-loader.test.ts:640-767` - affected and adjacent isolated-PGlite tests.
- `tests/integration/admin-user-bot-detail-loader.test.ts:769-1004` - adjacent isolated-PGlite tests already using 30s.
- `tests/integration/db-pg5.test.ts:40-51` - existing 30s PGlite-under-load precedent.
- `tests/integration/db-lms-ph3-1.test.ts:23-33` and `tests/integration/db-lms-ph3-1.test.ts:287-305` - 30s PGlite hook precedent plus `pg.close()` cleanup precedent.
- `tests/integration/bot-config-action-handler.test.ts:108-119` and `tests/integration/bot-config-action-handler.test.ts:388-412` - PGlite helper plus expensive test-body timeout precedent.
- `tests/integration/user-resolved-bot-config-db.test.ts:80-100` - `beforeEach` PGlite timeout precedent.
- `tests/integration/legacy-provider-worker.test.ts:98-109` - shared PGlite `beforeAll` timeout precedent.

## Files changed
`docs/handoffs/20260604-2035-root-vitest-timeout-auditor.md`

## Findings
1. Severity: High. The reported failure shape matches Vitest's per-test 5s timeout, not a loader logic defect. Evidence: root `npm test` is plain `vitest run` (`package.json:14`), root config raises only `hookTimeout` to 30s (`vitest.config.ts:13-16`), and both affected tests create a fresh PGlite database inside the `it(...)` body (`admin-bot-health-loader.test.ts:459-460`, `admin-user-bot-detail-loader.test.ts:719-720`). Recommendation: harden the affected test bodies with a 30s per-test timeout. Target part: test files only.

2. Severity: High. The PGlite cost is in the test body because `createIsolatedDb()` constructs `new PGlite()`, replays every migration, and seeds before the assertion path (`admin-bot-health-loader.test.ts:37-45`, `admin-user-bot-detail-loader.test.ts:61-72`). A global hook timeout cannot cover this helper when it is called from inside `it(...)`. Recommendation: use per-test timeout for tests that call `createIsolatedDb()` in the body. Do not add a root `testTimeout` unless unrelated suites begin failing the same way. Target part: local test timeout literals.

3. Severity: Medium. Current working tree already shows the minimal timeout hardening on the two reported tests: `admin-bot-health-loader.test.ts:493` and `admin-user-bot-detail-loader.test.ts:767` both end with `}, 30_000);`. If the failing snapshot lacked these, the exact edit is to replace each affected test's closing `});` with `}, 30_000);`. Recommendation: keep these two per-test timeouts; do not broaden to file-level/root-level timeout in this slice. Target part: current untracked test files.

4. Severity: Medium. Adjacent tests in the same files show the intended local convention: isolated-PGlite test bodies use 30s where needed (`admin-bot-health-loader.test.ts:427`, `admin-bot-health-loader.test.ts:457`, `admin-bot-health-loader.test.ts:537`, `admin-user-bot-detail-loader.test.ts:691`, `admin-user-bot-detail-loader.test.ts:717`, `admin-user-bot-detail-loader.test.ts:829`, `admin-user-bot-detail-loader.test.ts:1004`). Recommendation: keep this pattern consistent if any other `createIsolatedDb()` body test flakes under root. Target part: test-only timeout literals.

5. Severity: Low. Helper-level cleanup is useful hygiene but is not the minimal fix for a 5s timeout because cleanup would occur after the body has already exceeded Vitest's cap. Evidence: cleanup precedent exists for long-lived PGlite handles (`db-lms-ph3-1.test.ts:31-33`, `db-lms-ph3-1.test.ts:303-305`), while the affected helpers return only Drizzle DB objects and hide the `PGlite` handle (`admin-bot-health-loader.test.ts:37-45`, `admin-user-bot-detail-loader.test.ts:61-72`). Recommendation: defer helper cleanup unless root `npm test` remains slow/flaky after per-test timeout hardening; if pursued, return/track the `PGlite` handle and close it in `finally`/`afterAll`. Target part: future test hygiene slice, not Phase 4.36 minimal fix.

6. Severity: Low. No production logic fix is indicated by this failure alone. Evidence: the focused command below passed both named tests in the current working tree, and the tests assert sanitization/scoping results after DB setup rather than exercising a hanging loop. Recommendation: patch timeout only, then use full root Vitest to prove concurrency resilience. Target part: verification gates.

## Decisions
- Minimal safe hardening: per-test timeout (`30_000`) on the two reported isolated-PGlite test bodies.
- Do not change `vitest.config.ts` to add global `testTimeout`; that would mask unrelated future hangs across all suites.
- Do not choose file-level timeout for the whole files; the local pattern is already more precise and keeps fast tests strict.
- Do not make production loader/repository changes for this symptom.
- Helper cleanup is a separate test-hygiene option only if full root Vitest still shows load pressure after the timeout literals are present.

Exact recommended edits if not already present in the patch being reviewed:
- `tests/integration/admin-bot-health-loader.test.ts:493`: change the affected test close from `});` to `}, 30_000);`.
- `tests/integration/admin-user-bot-detail-loader.test.ts:767`: change the affected test close from `});` to `}, 30_000);`.

## Risks
- The current checkout was already broadly dirty before this lane, and the two target test files are untracked in git status. Treat the line references as working-tree evidence, not committed baseline evidence.
- If root `npm test` still fails after these two timeout literals, the next likely cause is cumulative PGlite load from many isolated DB instances, not the two loader assertions. That should be handled as a separate test-hygiene phase with PGlite handle cleanup and/or shared fixture strategy.
- A global root `testTimeout` would make root green faster to configure but would reduce the signal of genuine infinite-loop or hanging-test regressions.

## Verification/tests
Run this session:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts -t "projects worker bot continuity detail from the latest worker health row|keeps Legacy runtime warnings unscoped when selected provider has no persisted evidence" --reporter=verbose`
- Result: PASS. 2 test files passed, 2 tests passed, 13 skipped. Reported individual test durations were about 2635ms and 2603ms; total run duration was 22.85s.

Not run this session:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - not run because the scope was diagnosis plus exact affected-test proof.
- `npm test` - not run because the task asked for read-only diagnosis and recommended gates after the patch; full root sweep remains the required acceptance gate.
- `npm run typecheck`, `npm run lint`, `npm run build` - not run because no production code was changed by this lane.

## Next actions
1. Confirm the patch under review contains the two timeout literals at `tests/integration/admin-bot-health-loader.test.ts:493` and `tests/integration/admin-user-bot-detail-loader.test.ts:767`.
2. Run the affected focused gate:
   `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts -t "projects worker bot continuity detail from the latest worker health row|keeps Legacy runtime warnings unscoped when selected provider has no persisted evidence" --reporter=verbose`
3. Run both full affected files:
   `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`
4. Run the acceptance gate:
   `npm test`
5. If `npm test` still reports 5s timeouts in other isolated-PGlite body tests, apply the same per-test `30_000` pattern only to tests that call a migration-replaying DB helper in the test body. If failures shift from timeout to resource pressure, open a separate helper-cleanup phase.
