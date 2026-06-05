# admin-user-bot-db-matrix-auditor handoff
## Scope
Read-only Phase 4.27 audit of the admin selected-user DB browser matrix after Phase 4.26. Determine whether the managed DB matrix can prove selected-user aggregate worker heartbeat/readiness for both Tortila and Legacy, which scenarios it covers or misses, and the safest next patch if coverage is missing. No code, config, tests, snapshots, or app files were edited.

## Files inspected
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md`
- `package.json`
- `packages/db/src/repositories.ts`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - The current DB matrix cannot prove selected-user aggregate worker heartbeat/readiness for Tortila or Legacy because the fixture never writes an `integration_health_checks.target='worker'` row. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:61` defines the runtime seeder, `scripts/prepare-admin-user-bot-detail-e2e.ts:65` and `scripts/prepare-admin-user-bot-detail-e2e.ts:72` seed only `tortila-journal` and `legacy-bot` in fresh mode, `scripts/prepare-admin-user-bot-detail-e2e.ts:84`-`100` seed only those two product targets in stale mode, and `scripts/prepare-admin-user-bot-detail-e2e.ts:104`-`122` seed only those two product targets in degraded mode. The loader separately reads the latest `target='worker'` row at `apps/web/src/features/admin/user-bot-detail-loader.ts:1039`-`1049`, and passes that aggregate row into every selected-user bot at `apps/web/src/features/admin/user-bot-detail-loader.ts:1230`. Recommendation: do not treat the current DB matrix as Phase 4.26 worker-continuity acceptance until the fixture seeds and the spec asserts aggregate worker rows. Target part: DB fixture and selected-user worker continuity.
2. Severity P1 - The page is fail-closed for missing worker continuity, but the DB spec mostly asserts labels, not the worker gate result. Evidence: missing aggregate worker data returns `state: 'missing'` and the note "No aggregate target='worker' heartbeat row exists yet..." at `apps/web/src/features/admin/user-bot-detail-loader.ts:372`-`384`; the page converts non-ok worker continuity into worker attention at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:144`-`145`, top command-row evidence at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190`-`194`, and readiness status/value at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:294`-`358`. The DB spec only counts `Worker heartbeat` text at `tests/e2e/admin-user-bot-detail-db.spec.ts:207`-`210` and does not assert `No aggregate worker row`, `fresh aggregate`, `0/2 bots need attention`, or the aggregate worker notes. Recommendation: add explicit worker continuity expectations to the DB spec before claiming readiness proof. Target part: Playwright DB acceptance assertions.
3. Severity P2 - The matrix does cover selected-user product-runtime and data-scope scenarios, but those are not worker-continuity proof. Evidence: the managed runner defines four scenarios at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:7` and runs them sequentially in matrix mode at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:150`-`161`; the spec maps those same four scenarios to runtime-health expectations at `tests/e2e/admin-user-bot-detail-db.spec.ts:22`-`74`; the fixture creates User A and User B at `scripts/prepare-admin-user-bot-detail-e2e.ts:153`-`162`, User A Tortila and Legacy instances at `scripts/prepare-admin-user-bot-detail-e2e.ts:211`-`219`, and a User A Legacy provider mapping at `scripts/prepare-admin-user-bot-detail-e2e.ts:226`-`234`; the spec checks User B and secret markers are hidden at `tests/e2e/admin-user-bot-detail-db.spec.ts:117`-`160` and no mutation controls exist at `tests/e2e/admin-user-bot-detail-db.spec.ts:233`-`235`. Recommendation: keep these ownership/leak checks, but label them product-runtime/scope acceptance, not worker-heartbeat acceptance. Target part: acceptance wording and gate reporting.
4. Severity P2 - Phase 4.26 explicitly left this DB matrix unrun and named the missing worker evidence. Evidence: the Phase 4.26 handoff says selected-user admin now depends on `target='worker'` at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:3`, lists the selected-user loader/page worker changes at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:37`-`39`, records the DB matrix as NOT RUN at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:67` and `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:87`, and requires explicit `worker_status`, `bot_continuity`, `tortila`, and `legacy` evidence at `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md:84`. Recommendation: the next green report must include those values from the DB matrix or from an explicitly authorized worker continuity gate, not only Playwright pass/fail. Target part: Phase 4.27 gate evidence.
5. Severity P2 - Matrix artifacts are not scenario-specific today, so a sequential matrix run can overwrite screenshots and leave only the last scenario per project. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:8` builds screenshot paths from only test name and project, `tests/e2e/admin-user-bot-detail-db.spec.ts:237` writes that screenshot, and matrix mode runs scenarios sequentially at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:160`-`161`. Recommendation: include runtime scenario and any worker scenario in screenshot filenames before using screenshots as per-scenario proof. Target part: visual artifact retention.
6. Severity P2 - A real stale aggregate worker scenario needs explicit `checkedAt` control, not only a product `readState: 'stale'` detail. Evidence: worker freshness is computed from row age at `apps/web/src/features/admin/user-bot-detail-loader.ts:392`-`393`, while `recordHealthCheck` only inserts target/status/detail and relies on default checked time at `packages/db/src/repositories.ts:1789`-`1790`. Recommendation: seed stale worker rows by direct insert/update of `integration_health_checks.checked_at` in the throwaway DB fixture, or add a test-only helper that can set `checkedAt` safely. Target part: stale worker fixture coverage.

## Decisions
- Current verdict: NOT proven. The DB matrix can prove selected-user rendering, product runtime health labels, selected-user data scoping, no User B leaks, no secret leaks, and no mutation controls; it cannot currently prove aggregate worker heartbeat/readiness for Tortila or Legacy.
- Treat `tortila-journal` and `legacy-bot` health rows as product runtime evidence only. Selected-user worker readiness is proven only by the aggregate `target='worker'` row plus per-product detail fields consumed by `workerContinuitySummary`.
- The safest next patch is harness-only: change `scripts/prepare-admin-user-bot-detail-e2e.ts`, `tests/e2e/admin-user-bot-detail-db.spec.ts`, and if needed `scripts/run-admin-user-bot-detail-e2e-managed.mjs`; do not touch the selected-user loader/page unless the new matrix catches an actual product bug.
- Keep the DB runner's throwaway database and HMAC guards. `playwright.admin-user-bots-db.config.ts:13`-`32` refuses unprepared/non-throwaway DB URLs, and `scripts/run-admin-user-bot-detail-e2e-managed.mjs:108`-`119` creates and drops a scenario database.

## Risks
- A current `npm run e2e:admin-user-bots:db:managed:matrix` pass could be misreported as worker-continuity proof even though every scenario still has no aggregate worker row.
- The missing-worker branch is incidentally exercised by the absent fixture row, but not explicitly asserted, so a regression in the missing note/value could slip through.
- Per-product aggregate failures are uncovered: Tortila worker ok with Legacy blocked, Legacy ok with Tortila blocked, `botContinuityStatus` non-ok, product snapshot non-ok, and product readState unreachable/malformed are not in the DB matrix.
- The repo was already heavily dirty before this audit. This handoff certifies only the files inspected above and makes no claim about unrelated modified or untracked files.
- No database, browser, worker, live bot, exchange, SSH, tmux, systemd, or deploy command was run by this auditor.

## Verification/tests
RUN:
- Static read-only inspection only: `rg` and PowerShell line reads over the files listed in this handoff. No acceptance gate is claimed green.

NOT RUN / NOT GREEN:
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN by this auditor. Current unpatched matrix would create/drop scenario DBs and exercise the page, but still would not prove aggregate worker continuity because no `target='worker'` fixture row or worker-state assertions exist.
- `npm run e2e:admin-user-bots:db:managed` - NOT RUN; same worker proof gap as matrix mode.
- `npm run accept:worker:continuity` - NOT RUN; writes DB health/snapshot rows and requires explicit throwaway DB authorization plus captured `worker_status`, `bot_continuity`, `tortila`, and `legacy` evidence.
- `npm run worker:smoke`, `npm run worker:tick`, `npm run dev:worker`, `npm run dev -w @wtc/worker` - NOT RUN.
- `node scripts/gates.mjs quick`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run evidence:visual -- --inventory tests/e2e/screenshots` - NOT RUN because this was a read-only audit with no code patch.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - NOT RUN by safety scope.

Output/artifact expectations for the next patched DB gate:
- Command: `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<admin>:<password>@<host>:<port>/<maintenance_db> npm run e2e:admin-user-bots:db:managed:matrix`.
- Console output must show one created `wtc_test_admin_user_bots_*` database per scenario, one `Prepared ... scenario ... selected-user bot fixture` line per scenario, Playwright pass output for `admin-user-bots-db-desktop` and `admin-user-bots-db-mobile`, and one dropped database line per created database.
- Worker proof output/assertions must include fresh-green aggregate evidence for both products (`worker_status=ok`, `bot_continuity=ok`, `tortilaSnapshot/readState=ok`, `legacySnapshot/readState=ok`), plus non-green evidence for missing/stale and at least one Tortila-specific and one Legacy-specific worker failure.
- Screenshots should be scenario-specific, for example `tests/e2e/screenshots/admin-user-bot-detail-db-<runtime-scenario>-<worker-scenario>-admin-user-bots-db-desktop.png` and the matching mobile file, so matrix artifacts are not overwritten.
- Artifact review with `npm run evidence:visual -- --inventory tests/e2e/screenshots` should report no missing roots, no blocked artifacts, and no dynamic markers. Logs, screenshots, traces, and retained artifacts must not include full DB URLs, passwords, raw env dumps, cookies, key ids, `apiKey`, `token=`, sealed secret blobs, or User B fixture markers.

## Next actions
1. Patch only the DB harness/spec: add a `seedWorkerContinuityScenario` helper in `scripts/prepare-admin-user-bot-detail-e2e.ts` that can create `target='worker'` rows with `coreWorkerStatus`, `botContinuityStatus`, `tortilaSnapshot`, `tortilaReadState`, `legacySnapshot`, and `legacyReadState`.
2. Add explicit worker expectations to `tests/e2e/admin-user-bot-detail-db.spec.ts`: `Worker attention` value, command-row worker evidence, per-bot readiness value, worker note text, and no secret leakage for worker detail fields.
3. Make screenshot names include runtime/worker scenario before running managed matrix, otherwise only the last scenario's desktop/mobile screenshots survive.
4. Run the patched managed matrix, then `npm run evidence:visual -- --inventory tests/e2e/screenshots`, and record exact RUN/NOT RUN gates plus scenario artifacts in the aggregate Phase 4.27 handoff.
