# tortila-final-parity-tests-auditor handoff
## Scope
Read-only Phase 4.51 tests/gates audit for a credible Tortila final-parity acceptance slice after Phase 4.50. Scope covered root package scripts, Playwright specs/configs, DB selected-user harnesses, Tortila settings/statistics/admin coverage, visual evidence policy, and existing `accept:bots:*` runners.

No code, tests, app docs, env, live services, databases, browser sessions, bot runtime, provider state, exchange state, or live-control path was changed. The only filesystem write is this required handoff. Thread-style background agent tools were not exposed in this Codex session; this is therefore one foreground `ecosystem-tests-runner` auditor handoff, with no N-agent claim.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`
- `docs/handoffs/20260605-0500-admin-source-proof-rendered-tests-auditor.md`
- `docs/handoffs/20260605-0215-bot-final-gap-tests-gates-auditor.md`
- `docs/handoffs/20260605-0305-two-bot-finish-board-tests-auditor.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-runner-auditor.md`
- `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md`
- `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`

## Files changed
None - read-only audit. Required handoff written at `docs/handoffs/20260605-0510-tortila-final-parity-tests-auditor.md`.

## Findings
1. Severity P1 - Tortila selected-user DB evidence is seeded and loader-tested, but the browser spec does not yet pin it row-by-row as a final-parity contract. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:332` through `scripts/prepare-admin-user-bot-detail-e2e.ts:351` seed Tortila metric snapshots; `scripts/prepare-admin-user-bot-detail-e2e.ts:398` through `scripts/prepare-admin-user-bot-detail-e2e.ts:416` seed a Tortila position; `scripts/prepare-admin-user-bot-detail-e2e.ts:462` through `scripts/prepare-admin-user-bot-detail-e2e.ts:478` seed a Tortila closed trade; `tests/integration/admin-user-bot-detail-loader.test.ts:469` through `tests/integration/admin-user-bot-detail-loader.test.ts:488` prove the loader projects those scoped Tortila facts; `tests/e2e/admin-user-bot-detail-db.spec.ts:286` through `tests/e2e/admin-user-bot-detail-db.spec.ts:296` only row-scopes the Legacy `Source-proof gate` and absence on Tortila. Recommendation: extend `tests/e2e/admin-user-bot-detail-db.spec.ts` with Tortila row-scoped assertions inside `Tortila Bot statistics coverage matrix`: `Provider scope` = `user instance scoped`, `Operational coverage` = `1 open positions / wallet snapshot`, `Closed-trade history` = `1 imported trades` plus `analytics available`, `Analytics status` follows the runtime scenario, and `Source-proof gate` remains absent. Also assert Tortila metric/source, position, trade, and equity evidence from the seeded fixture. Target part: selected-user DB Tortila final-parity rendered proof.

2. Severity P1 - The static harness should pin the new Tortila browser contract so future fixture/spec drift fails cheaply before Playwright. Evidence: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:60` through `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:99` currently pins fixture safety, runtime scenarios, live-control-off env, and source-proof markers; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:101` through `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:174` pins broad selected-user browser assertions and Legacy source-proof checks, but not Tortila-specific row text such as `A_ONLY_POSITION_SYMBOL`, `A_ONLY_TRADE_SYMBOL`, `USER_A_LATEST_SOURCE`, or the Tortila coverage-matrix row states. Recommendation: add harness expectations for the new Tortila coverage rows and visible seeded markers, plus negative raw/secret markers already used by the DB spec. Target part: cheap static preflight for Tortila final parity.

3. Severity P1 - `accept:bots:local` and `accept:bots:rendered` are necessary regression gates, but they cannot by themselves prove Tortila final parity because the DB selected-user browser matrix is intentionally excluded. Evidence: `playwright.config.ts:7` through `playwright.config.ts:10` ignore `admin-user-bot-detail-db.spec.ts`; `scripts/gates.mjs:145` through `scripts/gates.mjs:154` run the six-file local bot/admin rendered pack; `scripts/gates.mjs:173` through `scripts/gates.mjs:175` map `accept:bots:rendered`, `accept:bots:local`, and continuity contract without the DB matrix; `package.json:36` through `package.json:38` expose the selected-user DB matrix as separate opt-in commands. Recommendation: final Tortila parity acceptance should report `accept:bots:rendered` or `accept:bots:local` as local regression proof only, and require `npm run e2e:admin-user-bots:db:managed:matrix` for DB selected-user acceptance when the maintenance DB env is supplied. Target part: gate reporting discipline.

4. Severity P2 - Tortila settings and user statistics already have strong no-env rendered coverage, so the minimal next additions should avoid duplicating those workflows. Evidence: `tests/e2e/bot-settings.spec.ts:83` through `tests/e2e/bot-settings.spec.ts:162` assert Tortila configuration, strategy map, portfolio caps, export headers/body, no unsafe export markers, no `Connection verified`, and screenshot capture; `tests/e2e/bot-settings.spec.ts:260` through `tests/e2e/bot-settings.spec.ts:308` assert metadata-only key readiness with no live exchange ping or secret echo; `tests/e2e/bot-statistics.spec.ts:44` through `tests/e2e/bot-statistics.spec.ts:60` assert complete Tortila read-only performance evidence and screenshot capture. Recommendation: do not add another broad Tortila user-flow spec for final parity unless copy changes; use the existing files in `accept:bots:rendered` and concentrate new work on the DB selected-user Tortila admin contract. Target part: minimal test scope.

5. Severity P2 - Visual evidence for a future DB matrix run will need reviewed manifest acceptance, not inventory-only acceptance. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:302` writes DB selected-user screenshots per runtime scenario/project; `scripts/check-retained-visual-artifacts.mjs:306` through `scripts/check-retained-visual-artifacts.mjs:312` show inventory mode exits after counting files; `scripts/check-retained-visual-artifacts.mjs:322` through `scripts/check-retained-visual-artifacts.mjs:348` require a manifest to claim reviewed visual acceptance; `tests/integration/retained-visual-artifacts.test.ts:84` through `tests/integration/retained-visual-artifacts.test.ts:109` covers fail-closed/no-manifest and reviewed-manifest behavior. Recommendation: after `e2e:admin-user-bots:db:managed:matrix`, run visual inventory immediately, then create/review a manifest and run `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run>/visual-review.json tests/e2e/screenshots` before retaining screenshots as acceptance evidence. Target part: visual proof procedure.

6. Severity P2 - Managed worker continuity and Tortila live-journal env gates remain separate from this no-live final-parity harness. Evidence: `scripts/gates.mjs:67` through `scripts/gates.mjs:105` refuses or scrubs managed DB, real Postgres, Legacy live, Tortila journal, and journal token env from local bot/admin plans; `playwright.admin-user-bots-db.config.ts:61` through `playwright.admin-user-bots-db.config.ts:69` runs the DB browser harness with mock adapters and live control disabled; current env preflight observed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `TORTILA_JOURNAL_URL`, and `JOURNAL_READ_TOKEN` all `NOT_SET`. Recommendation: do not claim live Tortila journal, managed worker continuity, live provider, exchange ping, or live bot-control readiness in the Tortila final-parity acceptance slice unless a later phase supplies approved env and runs those gates. Target part: safety/gate boundary.

## Decisions
1. Recommend a test/harness-only Tortila final-parity slice first: extend `tests/e2e/admin-user-bot-detail-db.spec.ts` and `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`; avoid app code unless the new assertions expose a real render gap.
2. Do not add a new root script yet. The existing `accept:bots:*` runners are already canonical for local mock/no-live proof, and the DB matrix is correctly separated as an opt-in managed DB gate.
3. Treat the final credible gate set as layered: focused static Vitest pack, local rendered regression pack, managed selected-user DB matrix when env exists, visual inventory plus reviewed manifest for retained screenshots, then secret/governance/diff checks in the implementation phase.
4. Keep live services, SSH/systemd/tmux, live provider probes, live exchange ping, live bot start/stop/apply-config, raw env dumps, and secret values out of this slice.

## Risks
1. The worktree was heavily dirty before this audit; this handoff does not classify unrelated modified/untracked files.
2. Without the Tortila row-scoped DB assertions, a future aggregate could overclaim final parity from broad no-env rendered screens while selected-user admin DB evidence remains under-specified.
3. Running the managed DB matrix will create/drop throwaway Postgres databases and generate screenshots/traces; use only approved local/admin maintenance URLs and scan/review retained artifacts before acceptance.
4. `accept:bots:local` writes `logs/gates`, starts a Playwright dev server, runs worker smoke, and inventories screenshots; it is safe-local/product-read-only, but not filesystem-read-only.
5. Current env does not allow managed DB or managed worker continuity proof, and no live Tortila journal env is present.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty/untracked tree.
2. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`.
3. Read-only `rg -n` and numbered `Get-Content` inspections over package scripts, gate runners, Playwright configs/specs, integration harnesses, selected-user admin page/loader code, and recent Phase 4.35/4.37/4.50 handoffs.
4. Env presence preflight only, values not printed: `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=NOT_SET`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL=NOT_SET`, `DATABASE_URL=NOT_SET`, `REAL_POSTGRES_DATABASE_URL=NOT_SET`, `LEGACY_DATABASE_URL=NOT_SET`, `LEGACY_LIVE_READS_ENABLED=NOT_SET`, `TORTILA_JOURNAL_URL=NOT_SET`, `JOURNAL_READ_TOKEN=NOT_SET`.

NOT RUN:
1. `npx vitest run ...` - not run because this audit made no code/test implementation edits and was read-only except the handoff.
2. `npm run accept:bots:rendered` - not run because it starts a dev server and can overwrite screenshots/logs.
3. `npm run accept:bots:local` - not run because it is broader than this audit and writes `logs/gates`, worker-smoke output, and screenshot inventory evidence.
4. `npm run accept:bots:continuity:contract` - not run because no continuity implementation changed.
5. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set.
6. `npm run accept:worker:continuity:managed` - NOT RUN because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not set.
7. Visual manifest validation for new DB screenshots - NOT RUN because no new DB browser screenshots were generated.
8. Live Tortila journal read, live Legacy/provider probes, exchange ping, live bot start/stop/apply-config, SSH/systemd/tmux, production deploy, GitHub CI, and production monitoring - NOT RUN by safety protocol and scope.

Recommended minimal gates after the Tortila row-scoped DB spec/harness additions:
1. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/retained-visual-artifacts.test.ts tests/integration/bot-admin-acceptance-runner.test.ts`
2. `npm run accept:bots:rendered`
3. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied: `npm run e2e:admin-user-bots:db:managed:matrix`
4. After the DB matrix: `npm run evidence:visual -- --inventory tests/e2e/screenshots`, then reviewed-manifest validation if screenshots are retained.
5. Finish with `npm run typecheck -w @wtc/web`, `npm run typecheck`, `npm run secret:scan`, `npm run governance:check`, and `git diff --check` in the implementation phase.

## Next actions
1. Extend `tests/e2e/admin-user-bot-detail-db.spec.ts` with row-scoped Tortila final-parity assertions for the selected-user DB page.
2. Extend `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` to pin the Tortila fixture/spec contract and hidden marker set.
3. Keep `accept:bots:rendered` as the local rendered regression proof, not as a substitute for the managed DB matrix.
4. Run the managed DB matrix only when an approved admin maintenance DB URL is supplied, then inventory/review DB screenshots before retaining them.
