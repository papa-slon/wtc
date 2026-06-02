# ecosystem-tests-runner handoff
## Scope
Phase 3.16 read-only tests-runner audit for worker service deployment and monitoring. Scope was limited to current verification surface discovery: worker runtime shape, existing worker tests, gate command expectations, deployment/monitoring docs, production blockers, and E2E/live-service boundaries. No live services were started, stopped, contacted, or mutated. No Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoint was called. No expensive full gates were run in this pre-implementation audit lane.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `packages/db/src/repositories.ts`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `scripts/gates.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `.env.example`
- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - The production blocker is not worker logic; it is the missing managed worker service deployment/monitoring acceptance. Evidence: current blockers say Tortila snapshot/import code exists but a separately managed preview worker process still needs deployment and monitoring (`docs/PRODUCTION_BLOCKERS_CURRENT.md:17`); architecture describes `apps/worker` as a separate production process with direct DB repository calls and reserved/unconsumed `job_queue` (`docs/ARCHITECTURE.md:109-111`, `docs/ARCHITECTURE.md:296`); deployment docs only list `npm run dev:worker` for a separate local terminal (`docs/DEPLOYMENT.md:25`) while production deployment remains NOT RUN (`docs/DEPLOYMENT.md:180-181`). Recommendation: after implementation, verify a managed preview worker service with `DATABASE_URL`, safe flags, and mock adapter defaults; prove recurring ticks by checking fresh `worker` and `tortila-journal` `integration_health_checks` rows and admin monitoring surfaces. Target part: worker service deployment/monitoring.
2. HIGH - Existing worker tests cover logic paths but not the service command, scheduler process, or monitoring freshness. Evidence: current worker tests import and exercise `snapshotTortilaJournal()` and `runDbWorkerTick()` through PGlite (`tests/integration/worker-tortila-snapshot.test.ts:39`, `tests/integration/worker-tortila-snapshot.test.ts:60`) and assert missing-token read-only mode makes no fetch (`tests/integration/worker-tortila-snapshot.test.ts:83-103`); read-state mapping is a pure unit test (`tests/integration/worker-health-mapping.test.ts:1-7`); one-shot service acceptance exists as `apps/worker/src/tick-once.ts`, but it only runs when `DATABASE_URL` is set and otherwise exits with code 2 (`apps/worker/src/tick-once.ts:5-14`). Recommendation: add a focused post-implementation acceptance test or scripted gate that runs the one-shot worker against a throwaway Postgres DB, asserts exit code/output, then verifies DB health rows/snapshots and admin loader outputs. Target part: worker service acceptance tests.
3. MEDIUM - Gate coverage has no explicit worker typecheck/build/start smoke. Evidence: root scripts have `dev:worker` but no `typecheck -w @wtc/worker` or worker build gate (`package.json:19-28`); `apps/worker/package.json` exposes `start` and `tick` through `tsx` only (`apps/worker/package.json:6-9`); root `tsx` is a devDependency (`package.json:39-40`); `scripts/gates.mjs` runs root typecheck, web typecheck, tests, db-generate, and web build, but has no worker-specific gate (`scripts/gates.mjs:30-40`, `scripts/gates.mjs:47-50`); root `tsconfig.json` includes `packages/*/src/**/*.ts`, `tests/**/*.ts`, and `vitest.config.ts`, not `apps/worker/src/**/*.ts` as a first-class include (`tsconfig.json:8-13`). Recommendation: add an `@wtc/worker` typecheck/build or strip-run smoke, and make the deployment command independent of devDependency assumptions or explicitly prove the deployed install includes `tsx`. Target part: worker gate runner and packaging.
4. MEDIUM - Worker runtime env validation is weaker than the central config contract, which can hide deployment mistakes as mock-mode success. Evidence: `@wtc/config` validates `DATABASE_URL`, restricts `BOT_ADAPTER_MODE` to `mock | read-only | audited`, and requires `JOURNAL_READ_TOKEN` in production when adapter mode is not mock (`packages/config/src/env.ts:22-37`, `packages/config/src/env.ts:76-80`); the worker reads raw `process.env`, maps unknown/missing `BOT_ADAPTER_MODE` to `mock`, and derives Tortila URL/token directly (`apps/worker/src/index.ts:30-35`, `apps/worker/src/index.ts:64-67`, `apps/worker/src/index.ts:94-98`); adapter factory falls back to mock unless a non-mock mode and base URL are both present (`packages/bot-adapters/src/factory.ts:26-31`). Recommendation: test invalid/missing env cases explicitly and consider a worker boot config wrapper so production service misconfiguration fails closed instead of silently producing mock snapshots. Target part: worker env/config gate.
5. MEDIUM - E2E is valuable for admin monitoring visibility, but it is not safe for this read-only lane and it does not currently prove DB-backed worker refresh by default. Evidence: Playwright starts a local Next server on port 3100 (`playwright.config.ts:23-27`) and forces `BOT_ADAPTER_MODE=mock`, live bot control off, and TV automation off (`playwright.config.ts:28-35`); the gate runner deliberately keeps `e2e` separate because it starts a server (`scripts/gates.mjs:43-52`); current E2E smoke covers bot pages and admin pages but operates in demo/memory mode for several surfaces (`tests/e2e/smoke.spec.ts:59-68`). Recommendation: run E2E only after focused worker tests pass and the no-server constraint is lifted; for worker monitoring acceptance, either run a DB-backed local e2e mode after a worker tick or add admin loader integration tests that assert health-row rendering without starting Playwright. Target part: E2E/live-service boundary.
6. LOW - Scope path drift exists: worker code is under `apps/worker`, not `packages/worker`. Evidence: architecture tree lists `apps/worker` as the background job runner (`docs/ARCHITECTURE.md:39-42`), and the package name is `@wtc/worker` in `apps/worker/package.json` (`apps/worker/package.json:1-3`). Recommendation: target `apps/worker/**` and `tests/integration/worker-*.test.ts` in implementation prompts and gates. Target part: task targeting.

## Decisions
- Treat Phase 3.16 as a service-deployment/monitoring verification slice, not as a rewrite of worker business logic.
- Keep post-implementation acceptance local and fail-closed: use mock adapter mode by default, a throwaway/preview Postgres database, and no live bot/exchange/Axioma/Stripe/TradingView calls.
- Use existing PGlite worker tests as the first focused regression lane, then add a service-level one-shot tick acceptance before broad gates.
- Keep Playwright as a late browser visibility gate only; it starts a local server and should not be used as the primary proof that the background worker is refreshing DB state.

## Risks
- A service can appear healthy in mock mode even if the intended read-only Tortila configuration is misspelled or missing, unless env validation and source-adapter assertions are part of acceptance.
- Existing PGlite tests prove worker logic but not process lifecycle, deployed command shape, interval recurrence, log/health freshness, or restart behavior.
- Admin monitoring pages reflect persisted health rows, not live probes; stale rows can look operational unless the acceptance checks row age/freshness.
- Running E2E without a DB-backed setup can miss the worker monitoring path because the default browser harness runs with a local dev server and mock/off safety flags.
- Production-style service manager checks are out of scope unless explicitly approved; do not fill that gap by touching systemd, tmux, SSH, preview-worker, or production endpoints in a test-runner lane.

## Verification/tests
Performed in this read-only lane:
- Inspected protocol, current docs, worker source, worker package scripts, current worker/TV tests, admin monitoring surfaces, gate runner, Playwright config, deployment docs, CI config, and production blockers.
- No npm, Vitest, Playwright, db-generate, build, migration, server, preview-worker, live-service, or external-network gate was run.

Exact gates RUN:
- Source/file inspection only.

Exact gates NOT RUN:
- `npm test -- tests/integration/worker-health-mapping.test.ts tests/integration/tv-access-hardening.test.ts tests/integration/worker-tortila-snapshot.test.ts` - not run because this was pre-implementation discovery and no code changed.
- `npm run tick -w @wtc/worker` - not run because it requires `DATABASE_URL` and is a post-implementation service acceptance command.
- `npm run typecheck` - not run because this was read-only discovery.
- `npm run typecheck -w @wtc/web` - not run because this was read-only discovery.
- `npm run db:generate -w @wtc/db` - not run because no schema edits were made.
- `node scripts/gates.mjs full` - not run because it is a broad post-implementation gate and writes gate logs/build artifacts.
- `node scripts/gates.mjs e2e` / `npm run e2e` - not run because Playwright starts a local Next server and this lane forbids starting services.
- Real Stripe/Axioma/TradingView/bot/exchange/SSH/tmux/systemd/preview-worker/prod checks - not run because they are explicitly out of scope.

Focused gate sequence after implementation:
1. Worker logic regression: `npm test -- tests/integration/worker-health-mapping.test.ts tests/integration/tv-access-hardening.test.ts tests/integration/worker-tortila-snapshot.test.ts`.
2. New service acceptance: run `npm run tick -w @wtc/worker` against a throwaway or approved preview `DATABASE_URL` with `BOT_ADAPTER_MODE=mock`; assert exit code 0, `worker` health row, `tortila-journal` row, snapshot/import behavior when system owner/instance is configured, and no live fetch.
3. Env/config acceptance: add/run tests for invalid `BOT_ADAPTER_MODE`, missing `DATABASE_URL`, missing `JOURNAL_READ_TOKEN` in non-mock production, and source-adapter truth (`tortila-mock` vs `tortila`).
4. Packaging/gate acceptance: add/run worker typecheck/build or strip-run smoke; then run `npm run typecheck`, `npm run typecheck -w @wtc/web`, and any new `@wtc/worker` gate.
5. Broad local gate: `node scripts/gates.mjs full`.
6. Browser visibility gate only after the no-server constraint is lifted: `node scripts/gates.mjs e2e`, ideally after seeding or injecting DB-backed health rows so `/admin/system-health` and `/admin/bots` prove monitoring state.
7. Final governance check: `npm run governance:check`.

## Next actions
1. Devops/backend owners: define the managed preview worker command and monitoring contract without using SSH/systemd/tmux in this test-runner lane.
2. Tests runner: add a focused worker service acceptance test/gate that exercises `apps/worker/src/tick-once.ts` against a throwaway/approved DB and asserts persisted health freshness.
3. Tests runner: add env/config tests so invalid adapter mode, missing DB, and missing read token cannot be mistaken for a green worker deployment.
4. Operator: keep the production blocker open until a managed worker process is deployed/monitored and the exact post-implementation gates above are observed green in a later session.
