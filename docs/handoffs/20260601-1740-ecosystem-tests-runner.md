# ecosystem-tests-runner handoff

## Scope

Initial read-only discovery for current package scripts, `scripts/gates.mjs`, Playwright/E2E coverage, likely targeted test commands for Workstreams A-F, and risks in running `node scripts/gates.mjs full` / `npm run e2e`.

No full gates were run. No source code was edited.

## Files inspected

- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `packages/*/package.json`
- `scripts/gates.mjs`
- `scripts/safe-preview.mjs`
- `playwright.config.ts`
- `vitest.config.ts`
- `docs/SESSION_PROTOCOL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PROJECT_CHAT_HANDOFF_20260601.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/*.spec.ts`
- `tests/integration/*.test.ts`

## Files changed

None - read-only audit

## Findings

1. MEDIUM - `node scripts/gates.mjs full` does not run E2E, despite the header still saying `full = core + build + e2e`.
   Evidence: `scripts/gates.mjs:16` says full includes e2e, but the implemented note says e2e is its own plan at `scripts/gates.mjs:43`-`scripts/gates.mjs:46`, the `full` plan excludes `e2e` at `scripts/gates.mjs:50`, and the separate `e2e` plan is at `scripts/gates.mjs:52`. The next-session required gate block correctly calls both commands at `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:193`-`docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:198`.
   Recommendation: report `node scripts/gates.mjs full` as core+build only, then run/report `npm run e2e` or `node scripts/gates.mjs e2e` separately. Do not claim "full gates" includes Playwright unless both commands were observed green.
   Target part: gate reporting and aggregate handoff verification.

2. HIGH - `node scripts/gates.mjs full` is not a pure read-only inspection command.
   Evidence: the runner creates `logs/gates` at `scripts/gates.mjs:24`, opens per-gate log files for write at `scripts/gates.mjs:64`-`scripts/gates.mjs:69`, writes `logs/gates/summary.txt` at `scripts/gates.mjs:96`-`scripts/gates.mjs:98`, and includes `db:generate` plus `build` in the `full` plan at `scripts/gates.mjs:38`-`scripts/gates.mjs:40` and `scripts/gates.mjs:50`. The DB package maps `db:generate` to `drizzle-kit generate` at `packages/db/package.json:9`-`packages/db/package.json:12`.
   Recommendation: do not run `node scripts/gates.mjs full` during read-only discovery. Run it only after implementation review allows generated logs/build artifacts, and treat any new migration/output as a changed artifact to inspect before claiming green.
   Target part: gate execution safety.

3. HIGH - `npm run e2e` is configured safely for bot/TV flags, but it can still use a real `DATABASE_URL` inherited from the invoking shell.
   Evidence: Playwright starts its own server on port 3100 and sets `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` at `playwright.config.ts:23`-`playwright.config.ts:35`. That env block does not set or clear `DATABASE_URL`; the web backend selects Postgres when `process.env.DATABASE_URL` is present at `apps/web/src/lib/backend.ts:20`, and `getServerDb()` returns the DB when configured at `apps/web/src/lib/backend.ts:44`-`apps/web/src/lib/backend.ts:47`. The e2e login endpoint creates a session at `apps/web/src/app/api/e2e/login/route.ts:13`-`apps/web/src/app/api/e2e/login/route.ts:18`, and the shared helper posts to that endpoint at `tests/e2e/helpers/auth.ts:5`-`tests/e2e/helpers/auth.ts:12`.
   Recommendation: before E2E, assert the shell DB target. For demo-only E2E, run with `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue` and `Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue`; for DB-backed acceptance, use only a named throwaway DB and document mutation approval.
   Target part: E2E safety and DB mutation boundary.

4. MEDIUM - Workstream A has snapshot and health-mapping tests, but the real DB worker acceptance path is not yet a direct one-shot gate.
   Evidence: Workstream A explicitly says not to use `apps/worker/src/tick-once.ts` as real acceptance and asks for a real one-shot DB worker command at `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:123`-`docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:128`. The worker DB path is `async function dbTick(url: string)` at `apps/worker/src/index.ts:30`, but the process entrypoint runs `setInterval` at `apps/worker/src/index.ts:112`-`apps/worker/src/index.ts:118`. Current tests exercise `snapshotTortilaJournal()` directly at `tests/integration/worker-tortila-snapshot.test.ts:34`-`tests/integration/worker-tortila-snapshot.test.ts:54`, and the health status mapper at `tests/integration/worker-health-mapping.test.ts:1`-`tests/integration/worker-health-mapping.test.ts:28`.
   Recommendation: accept Workstream A only after a bounded one-shot DB worker command or equivalent test harness proves `integration_health_checks`, `bot_metric_snapshots`, `bot_position_snapshots`, and `bot_trade_imports` through the real DB path. Until then, keep `apps/worker/src/tick-once.ts` out of acceptance.
   Target part: Workstream A runtime acceptance.

5. MEDIUM - Vitest intentionally excludes `apps/web/**`, so web UI/server-action regressions need static source guards plus E2E.
   Evidence: the root test config includes `packages/**/*.test.ts` and `tests/integration/**/*.test.ts` at `vitest.config.ts:8`, while excluding `apps/web/**` at `vitest.config.ts:9`. The global acceptance matrix requires both Vitest and E2E gates at `docs/ACCEPTANCE_MATRIX_MASTER.md:15` and `docs/ACCEPTANCE_MATRIX_MASTER.md:19`.
   Recommendation: for Workstreams B-F, pair each package/repository test with a source-guard integration test for app wiring and a Playwright spec for the visible route. Do not rely on `npm test` alone for app route behavior.
   Target part: Workstreams B-F coverage strategy.

6. MEDIUM - Current E2E coverage is broad but not complete enough for the new A-F package without targeted additions for changed flows.
   Evidence: bot surfaces are covered in `tests/e2e/smoke.spec.ts:97`-`tests/e2e/smoke.spec.ts:153`, setup/backtester mobile flows in `tests/e2e/cabinet-pg9-mobile.spec.ts:30`-`tests/e2e/cabinet-pg9-mobile.spec.ts:56` and `tests/e2e/backtester-pg10-mobile.spec.ts:11`-`tests/e2e/backtester-pg10-mobile.spec.ts:33`, education in `tests/e2e/smoke.spec.ts:59`-`tests/e2e/smoke.spec.ts:93` and `tests/e2e/education-ph3-1-mobile.spec.ts:18`-`tests/e2e/education-ph3-1-mobile.spec.ts:33`, billing/TV/admin in `tests/e2e/smoke.spec.ts:158`-`tests/e2e/smoke.spec.ts:343`, terminal in `tests/e2e/smoke.spec.ts:214`-`tests/e2e/smoke.spec.ts:230`, and admin mobile in `tests/e2e/admin-mobile-pg8.spec.ts:21`-`tests/e2e/admin-mobile-pg8.spec.ts:48`. The new work package asks for additional tests and mobile E2E for visible bot flows at `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:138`-`docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md:148`.
   Recommendation: run the existing targeted specs as a baseline, then add focused specs for any changed filters, status tags, config validation/version history, LMS progress states, billing pending-to-active path, terminal CTA state, and admin observability additions.
   Target part: Playwright/E2E coverage for Workstreams A-F.

## Decisions

1. Did not run `node scripts/gates.mjs full`, `npm run e2e`, `npm run db:generate`, `npm run build`, or any live/server mutation command in this discovery pass.
2. Treat `node scripts/gates.mjs full` and `npm run e2e` as two separate required final gates.
3. Treat E2E as safe only after the caller verifies the intended DB mode. In this shell, `DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL` were observed unset, but a preview server is already listening on port 3000; Playwright uses port 3100 and `reuseExistingServer=false`.
4. Do not use `apps/worker/src/tick-once.ts` as Workstream A acceptance; it is memory/demo-only by design.

## Risks

1. Running `node scripts/gates.mjs full` during a strict read-only phase writes logs and can generate migrations/build artifacts.
2. Running `npm run e2e` with `DATABASE_URL` set can create sessions and exercise DB-backed actions against that database.
3. Playwright starts a Next dev server on port 3100 with `reuseExistingServer=false`; if 3100 is occupied or the dev server fails teardown, the run can fail or leave a process to clean up.
4. The current repo checkout is not git-backed from this workspace, so there is no branch/commit safety net for generated artifacts.
5. Real-Postgres acceptance is opt-in only; the harness skips without `REAL_POSTGRES_DATABASE_URL`, and the acceptance matrix says PGlite is not a substitute at `docs/ACCEPTANCE_MATRIX_MASTER.md:20`.

## Verification/tests

Gates RUN:

- None. This was read-only discovery.

Read-only checks performed:

- Inspected package scripts, gate runner, Playwright config, Vitest config, worker runtime path, E2E helpers, current test coverage, and A-F workstream docs.
- Checked current shell safety without printing secrets: `DATABASE_URL=unset`, `REAL_POSTGRES_DATABASE_URL=unset`.
- Checked local listening ports: port 3000 is already listening; no listener was shown for port 3100.

Gates NOT RUN:

- `node scripts/gates.mjs full` - not run because it writes logs and includes `db:generate`/`build`; not appropriate for read-only discovery.
- `npm run e2e` - not run because it starts a dev server and can mutate DB-backed state if `DATABASE_URL` is set.
- `node scripts/gates.mjs e2e` - not run for the same Playwright/server reasons.
- `npm run db:generate -w @wtc/db` - not run because it can generate migration artifacts.
- `npm run db:migrate` / `npm run db:seed` / real-PG harness - not run because no throwaway DB was provided or approved for mutation.

Likely targeted commands for Workstreams A-F after edits are allowed:

```powershell
# A - runtime acceptance / worker
npm test -- tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts
# Add/run a real one-shot DB worker acceptance command once implemented; do not use tick-once as acceptance.

# B - Tortila / Legacy bot product
npm test -- tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-journal-review.test.ts tests/integration/backtester-pg10.test.ts
npm run e2e -- tests/e2e/smoke.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts tests/e2e/backtester-pg10-mobile.spec.ts

# C - Education / LMS
npm test -- tests/integration/lms-service.test.ts tests/integration/lms-rbac-pipeline.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-community-static.test.ts tests/integration/lms-fixes.test.ts tests/integration/db-lms-ph3-1.test.ts
npm run e2e -- tests/e2e/smoke.spec.ts tests/e2e/education-ph3-1-mobile.spec.ts

# D - Billing / entitlements / TradingView access
npm test -- tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/db-0003.test.ts tests/integration/db-pg5.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/tv-access-hardening.test.ts
npm run e2e -- tests/e2e/smoke.spec.ts

# E - Terminal / Axioma
npm test -- tests/integration/axioma-skeleton-static.test.ts tests/integration/phase23-visible-progress.test.ts
npm run e2e -- tests/e2e/smoke.spec.ts

# F - Admin ops / observability
npm test -- tests/integration/admin-responsive.test.ts tests/integration/admin-ops-rbac.test.ts tests/integration/phase23-visible-progress.test.ts tests/integration/product-directory-static.test.ts
npm run e2e -- tests/e2e/admin-mobile-pg8.spec.ts tests/e2e/smoke.spec.ts

# Final required gates after targeted tests
node scripts/gates.mjs full
npm run e2e
```

Before any E2E run intended to be demo-only:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue
npm run e2e
```

For real-Postgres acceptance only after explicit approval:

```powershell
$env:REAL_POSTGRES_DATABASE_URL = "postgres://<credentials>@127.0.0.1:5432/wtc_test_<suffix>"
$env:DATABASE_URL = $env:REAL_POSTGRES_DATABASE_URL
npm run db:migrate -w @wtc/db
npm run db:seed -w @wtc/db
npm test -- tests/integration/db-real-postgres.test.ts
```

## Next actions

1. Operator/implementers should decide whether the next execution is demo-only or throwaway-DB-backed before running E2E.
2. Workstream A should add or expose a bounded one-shot DB worker acceptance path before preview worker enablement.
3. Workstreams B-F should add targeted integration/source-guard and Playwright coverage for every changed visible flow, then run `node scripts/gates.mjs full` and `npm run e2e` separately.
4. Final aggregate handoff must list exact gates run and not run, with observed results only.
