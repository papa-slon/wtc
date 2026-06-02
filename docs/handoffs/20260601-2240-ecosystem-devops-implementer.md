# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.16 DevOps audit for worker service deployment and monitoring readiness, focused on the Tortila snapshot/import preview worker, package scripts, environment examples, docker/deploy documentation, and local operational checks. No live services, servers, Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoints were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `package.json`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/jobs.ts`
- `scripts/gates.mjs`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - Worker code exists, but there is no managed preview-worker deployment or monitoring slice yet. Evidence: the current blocker list explicitly says the Tortila snapshot/import code exists but a separately managed preview worker still needs deployment/monitoring (`docs/PRODUCTION_BLOCKERS_CURRENT.md:17`); the deploy docs only show `npm run dev:worker` as a local separate-terminal command (`docs/DEPLOYMENT.md:25`); production deployment is still NOT RUN (`docs/DEPLOYMENT.md:180`); and `docker-compose.yml` is marked local-only and defines only Postgres (`docker-compose.yml:1`, `docker-compose.yml:2`, `docker-compose.yml:3`). Recommendation: add a local-only preview-worker deployment slice with a repeatable worker start/tick command, restart/health policy documentation, and a stale-health check before any live adapter enablement. Target part: worker deployment/monitoring.

2. High - The long-running worker can silently fall back to the in-memory demo loop when `DATABASE_URL` is missing, which is acceptable for local dev but unsafe for staging/production service operation. Evidence: `tick()` returns `memoryTick()` when no `DATABASE_URL` is set (`apps/worker/src/index.ts:147`, `apps/worker/src/index.ts:148`, `apps/worker/src/index.ts:149`); `main()` starts an "in-memory demo loop" without DB (`apps/worker/src/index.ts:153`, `apps/worker/src/index.ts:154`, `apps/worker/src/index.ts:156`, `apps/worker/src/index.ts:158`); the one-shot acceptance path already treats missing `DATABASE_URL` as an error unless `--memory-demo` is explicit (`apps/worker/src/tick-once.ts:5`, `apps/worker/src/tick-once.ts:12`, `apps/worker/src/tick-once.ts:13`). Recommendation: make `start` fail closed when `NODE_ENV=production` or `APP_ENV=staging|production` and `DATABASE_URL` is absent, while keeping `--memory-demo` explicit for local smoke checks. Target part: worker runtime config.

3. High - Tortila imports are skipped unless `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` is configured, but those worker env vars are not represented in `.env.example` or the central config schema. Evidence: the worker reads `SYSTEM_BOT_INSTANCE_ID` and `SYSTEM_BOT_OWNER_ID` (`apps/worker/src/index.ts:65`, `apps/worker/src/index.ts:66`, `apps/worker/src/index.ts:67`), records `not_configured`, and skips snapshots when both are missing (`apps/worker/src/index.ts:73`, `apps/worker/src/index.ts:75`, `apps/worker/src/index.ts:79`); `.env.example` documents Tortila endpoint/token vars but not the system bot owner/instance inputs (`.env.example:39`, `.env.example:41`, `.env.example:46`); `packages/config` validates `BOT_ADAPTER_MODE` and `JOURNAL_READ_TOKEN` but has no `SYSTEM_BOT_*` entries in the inspected env schema (`packages/config/src/env.ts:31`, `packages/config/src/env.ts:37`, `packages/config/src/env.ts:78`). Recommendation: add documented worker env placeholders and validation, or derive the system-owned Tortila instance through a deterministic seed/repository path. Target part: worker env contract and Tortila import bootstrap.

4. Medium - Worker acceptance is not wired into the standard local gate scripts or staged CI workflow. Evidence: the worker package has a one-shot `tick` script (`apps/worker/package.json:7`, `apps/worker/package.json:8`, `apps/worker/package.json:9`), but root `ci:local` only runs check/core/lint/typecheck/secret/test/build-web (`package.json:28`); `scripts/gates.mjs full` runs governance through build but no worker tick (`scripts/gates.mjs:49`, `scripts/gates.mjs:50`); staged CI runs DB migration/seed, tests, coverage, build, and e2e but no worker tick (`.github/workflows/ci.yml:75`, `.github/workflows/ci.yml:76`, `.github/workflows/ci.yml:78`, `.github/workflows/ci.yml:79`, `.github/workflows/ci.yml:85`, `.github/workflows/ci.yml:96`, `.github/workflows/ci.yml:115`, `.github/workflows/ci.yml:116`). Recommendation: add an explicit local operational check, such as a mock-mode DB worker tick against the throwaway/local DB and a stale-health assertion, but keep it separate from live adapter checks. Target part: package scripts and gates.

5. Medium - The worker package has no production build artifact and its `start` path depends on `tsx`, currently a root dev dependency. Evidence: `@wtc/worker` defines `dev`, `start`, and `tick` through `tsx` (`apps/worker/package.json:7`, `apps/worker/package.json:8`, `apps/worker/package.json:9`); root build is only `npm run build --workspaces --if-present` and the worker package has no inspected build script (`package.json:12`, `apps/worker/package.json:6`); `tsx` is listed under root `devDependencies` (`package.json:30`, `package.json:40`). Recommendation: either promote a deliberate runtime strategy for TypeScript execution or add a compiled worker build/start path before documenting production service startup. Target part: package scripts and deployment packaging.

6. Medium - Monitoring storage and admin display exist, but there is no local stale-worker health gate. Evidence: the worker writes a `worker` health row on DB ticks (`apps/worker/src/index.ts:54`) and Tortila health rows in snapshot paths (`apps/worker/src/jobs.ts:110`, `apps/worker/src/jobs.ts:227`, `apps/worker/src/jobs.ts:246`); admin system health says worker rows appear when present (`apps/web/src/app/admin/system-health/page.tsx:20`, `apps/web/src/app/admin/system-health/page.tsx:143`, `apps/web/src/app/admin/system-health/page.tsx:150`); admin bots explicitly tells operators to run the worker to populate checks and snapshots (`apps/web/src/app/admin/bots/page.tsx:155`, `apps/web/src/app/admin/bots/page.tsx:160`, `apps/web/src/app/admin/bots/page.tsx:190`, `apps/web/src/app/admin/bots/page.tsx:225`). Recommendation: add a read-only health-check script that fails when `integration_health_checks` lacks a recent `worker` row or has a recent `tortila-journal` error/stale state beyond a documented threshold. Target part: monitoring and local ops checks.

7. Low - Documentation correctly preserves the queue honesty boundary, but future deployment docs must keep it explicit. Evidence: current docs state `job_queue` is reserved/unconsumed and the worker uses cron-style direct calls plus `tradingview_access_tasks` (`docs/IMPLEMENTED_FILES.md:712`, `docs/IMPLEMENTED_FILES.md:713`, `docs/IMPLEMENTED_FILES.md:714`, `docs/IMPLEMENTED_FILES.md:716`; `docs/STATUS.md:813`). Recommendation: do not describe the worker as a durable queue consumer until a real queue executor exists. Target part: deploy docs and status copy.

## Decisions
- Treated `apps/worker` as the active worker implementation; no `packages/worker` directory exists in the inspected tree.
- Did not run `npm`, Playwright, Docker, server, or worker commands because this phase is read-only and the only permitted write is this handoff. `scripts/gates.mjs` also writes `logs/gates/*`, so it was not executed.
- Kept the next implementation slice local-only: mock-mode worker deployment/ops checks, env documentation, and stale-health monitoring can be built without live credentials or network calls.

## Risks
- DB-first bot journal imports will remain stale unless an operator manually runs the worker or a managed preview worker process is added.
- A misconfigured staging/production worker could appear "running" while only executing the memory demo loop if the long-running start path is not fail-closed.
- Missing `SYSTEM_BOT_*` documentation can make worker health look green while Tortila snapshot/import remains skipped.
- A production install that omits dev dependencies may not be able to start the worker while `start` depends on `tsx`.
- Monitoring currently shows stored health rows, but it does not independently alert on missing or stale worker ticks.

## Verification/tests
RUN:
- Read-only file inspection with `Get-Content`, `rg`, `Select-String`, and `Test-Path`.
- Confirmed the required handoff path did not already exist before writing it.

NOT RUN:
- `node scripts/gates.mjs full` / `node scripts/gates.mjs e2e` - not run because they write logs and/or start Playwright's server.
- `npm run dev`, `npm run dev:worker`, `npm run start -w @wtc/worker`, `npm run tick -w @wtc/worker` - not run because no servers/workers/process loops should be started in this read-only audit.
- Docker Compose, SSH, tmux, systemd, preview-worker, production deployment, live Stripe, live Axioma, live TradingView, live bot/exchange endpoints - not run by scope and safety rules.

## Next actions
1. Implement a local-only worker ops slice: root scripts for `worker:tick`, `worker:tick:memory`, and `worker:health-check`, with the DB tick using `BOT_ADAPTER_MODE=mock` and a local/throwaway DB only.
2. Add worker config validation and docs: `SYSTEM_BOT_INSTANCE_ID` / `SYSTEM_BOT_OWNER_ID`, optional tick interval, `DATABASE_URL` fail-closed behavior for staging/production, and clear `JOURNAL_READ_TOKEN` behavior for non-mock modes.
3. Add a deployment artifact for the preview worker that does not touch live services: either a local Docker Compose profile/service or a documented service template with safe env defaults, restart policy, and no live adapter mode.
4. Add a stale-health monitor that reads `integration_health_checks` and fails if the latest `worker` tick is older than the accepted window or if `tortila-journal` is `down` / `error` unexpectedly.
5. Keep real `BOT_ADAPTER_MODE=read-only` activation out of this slice until endpoint-shape and token gates are separately approved.
