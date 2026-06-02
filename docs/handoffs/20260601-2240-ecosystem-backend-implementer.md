# ecosystem-backend-implementer handoff
## Scope
Read-only backend audit for Phase 3.16 covering the worker/runtime/backend boundary for Tortila DB-first journal imports and health/heartbeat behavior. The audit inspected current worker APIs, DB repository support, bot adapter boundaries, admin/system read paths, docs blockers, and safe local smoke-test opportunities. No live Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, production endpoint, or local dev server was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `.env.example`
- `package.json`
- `tsconfig.json`
- `tsconfig.base.json`
- `vitest.config.ts`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/config/src/env.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - Tortila DB-first import primitives already exist and are the right local implementation foundation: `apps/worker/src/jobs.ts:97` defines `snapshotTortilaJournal()`, it writes metric snapshots at `apps/worker/src/jobs.ts:155`, position snapshots at `apps/worker/src/jobs.ts:181`, idempotent closed-trade imports at `apps/worker/src/jobs.ts:198`, and a `tortila-journal` health row at `apps/worker/src/jobs.ts:224`; the DB schema makes `bot_trade_imports` immutable/idempotent with a unique `(bot_instance_id, external_trade_id, source_adapter)` key at `packages/db/src/schema.ts:410` and `packages/db/src/schema.ts:432`. Recommendation: build Phase 3.16 on these existing APIs; do not add a new worker package or bypass `@wtc/db`. Target part: Tortila DB-first worker import path.
2. High - Automatic DB-first refresh is not production/preview-complete because the code is only a worker process/one-shot command until a separately managed worker is deployed and monitored: `docs/PRODUCTION_BLOCKERS_CURRENT.md:17` states the worker service still needs deployment/monitoring, while `apps/worker/src/index.ts:152` starts a long-running interval only when the worker process is launched and `apps/worker/src/tick-once.ts:5` requires `DATABASE_URL` for one-shot DB acceptance. Recommendation: keep the next backend implementation local-only unless devops explicitly owns preview-worker deployment/monitoring; accepted local work can add tests and admin read fixes without live credentials. Target part: worker runtime boundary.
3. Medium - Admin heartbeat recency has a stale/ordering gap. The worker intentionally maps adapter `readState='stale'` to health-check status `ok` at `apps/worker/src/jobs.ts:66`, and that behavior is asserted at `tests/integration/worker-health-mapping.test.ts:19`; however `/admin/bots` only treats `tortilaJournalReadState === 'not_configured'` specially at `apps/web/src/app/admin/bots/page.tsx:17` and then returns `journal: last check ok` when `tortilaLastOkAt` exists at `apps/web/src/app/admin/bots/page.tsx:25`. Separately, `/admin/system-health` selects `integration_health_checks` in ascending `checkedAt` order and limits to 50 at `apps/web/src/features/admin/queries.ts:160`, so old rows can hide current heartbeat rows. Recommendation: in a local slice, make the admin bot pill warn on `tortilaJournalReadState === 'stale'` and order system health checks by descending `checkedAt`. Target part: admin/system heartbeat display.
4. Medium - The admin bot health table filters only `bot.%` targets, but the current worker writes `worker` and `tortila-journal` targets: `apps/worker/src/index.ts:54` records the worker heartbeat, `apps/worker/src/jobs.ts:227` records `tortila-journal`, the integration test asserts those exact targets at `tests/integration/worker-tortila-snapshot.test.ts:78`, and `/admin/bots` filters `like('bot.%')` at `apps/web/src/features/admin/queries.ts:331`. Recommendation: either write an additional `bot.tortila.journal` compatibility health row or widen/rename the admin bot health table so the current worker targets are visible there. Target part: admin bot ops read path.
5. Medium - Safe local smoke coverage exists, but the strongest no-live-credential gap is a full `runDbWorkerTick()` read-only adapter path with stubbed fetch and a fake bearer token. Current PGlite tests prove mock imports and no-token read-only short-circuit at `tests/integration/worker-tortila-snapshot.test.ts:39` and `tests/integration/worker-tortila-snapshot.test.ts:83`; adapter health states are fetch-stubbed separately at `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:25`; the real adapter attaches bearer auth only when configured at `packages/bot-adapters/src/http.ts:45` and refuses unauthenticated data reads at `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:109`. Recommendation: add a PGlite/Vitest test that runs `runDbWorkerTick(db, now, { BOT_ADAPTER_MODE:'read-only', SYSTEM_BOT_OWNER_ID, TORTILA_JOURNAL_BASE_URL:'http://journal.local', JOURNAL_READ_TOKEN:'fixture' })` with `global.fetch` stubbed for `/api/health`, `/api/summary`, `/api/trades/list`, and `/api/equity`, then asserts imports and health rows. Target part: local worker smoke tests.
6. Low - Worker typecheck coverage is indirect for the process entrypoint. Root `tsconfig.json` includes `packages/*/src/**/*.ts`, `tests/**/*.ts`, and `vitest.config.ts` at `tsconfig.json:8`, but it does not explicitly include `apps/worker/src/**/*.ts`; tests import `apps/worker/src/index.ts` and `apps/worker/src/jobs.ts` at `tests/integration/worker-tortila-snapshot.test.ts:18`, while `apps/worker/src/tick-once.ts` is only referenced by the package script at `apps/worker/package.json:9`. Recommendation: add an explicit worker TS include or worker tsconfig in a future local-only quality slice so CLI entrypoint drift cannot hide outside test imports. Target part: worker package quality gate.
7. Low - There is minor adapter-mode comment drift that can mislead implementation planning. The contract says Tortila health/summary/equity/trades mappings are current at `docs/CONTRACTS/tortila-adapter.md:6` and the HTTP adapter implements those GET paths at `packages/bot-adapters/src/http.ts:75`, but `.env.example` still says read-only data methods are stubbed at `.env.example:34` and the factory comment repeats that at `packages/bot-adapters/src/factory.ts:10`. Recommendation: clean the comments/docs in the same local slice, without changing runtime behavior. Target part: docs/config truth.

## Decisions
- Treat `apps/worker`, not `packages/worker`, as the current worker package. `packages/worker` does not exist in this tree.
- Treat `job_queue` as reserved/unconsumed, not a worker implementation surface: `packages/db/src/schema.ts:305` says it is reserved and the worker uses direct cron-style calls.
- Do not run servers, preview workers, live adapters, or live credentialed endpoints in this phase.
- The bounded implementation slice should be local and credential-free: add/adjust Vitest coverage around `runDbWorkerTick()` with stubbed fetch, fix admin heartbeat display/order/target visibility, and optionally make worker typecheck inclusion explicit.
- Defer managed preview-worker deployment, monitoring, real journal reachability, token provisioning, and firewall acceptance to a separate devops/integration phase.

## Risks
- If the preview worker is not actually deployed and monitored, DB-first journal imports will not refresh automatically even though the code path and one-shot command exist.
- If stale adapter reads remain persisted as `status='ok'` without admin UI handling `detail.readState='stale'`, operators can see an apparently green journal state while the journal data is old.
- If `/admin/bots` continues to filter only `bot.%` health targets, current `tortila-journal` heartbeats may be invisible on the bot fleet page even though `/admin/system-health` can show them.
- The safe read-only adapter can call the Tortila journal only when `BOT_ADAPTER_MODE` is non-mock, a base URL is set, and `JOURNAL_READ_TOKEN` is present; missing token correctly records `not_configured` and makes no fetch.

## Verification/tests
RUN:
- Read-only file inspection with PowerShell `Get-Content`, `Test-Path`, `Get-ChildItem`, and `rg`.
- No live service calls, server starts, preview-worker starts, SSH/tmux/systemd commands, Stripe/Axioma/TradingView/bot/exchange calls, or production endpoint calls.

NOT RUN:
- `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, Playwright, build, typecheck, db migrate/seed, and worker `start`/`dev`/`tick`. Reason: this was a read-only audit with only the required handoff file write; several gates write logs/build artifacts or start servers.
- Real Tortila journal reachability, `BOT_ADAPTER_MODE=read-only` against a real URL, `JOURNAL_READ_TOKEN` validation against a live service, and preview-worker deployment/monitoring. Reason: live credentials/endpoints and preview-worker/prod interactions are explicitly out of scope.

Safe local smoke opportunities for the next implementation session:
- `npm test -- tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts packages/bot-adapters/src/__tests__/getHealth-states.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts`
- Add the missing stubbed-fetch read-only worker tick test described in Finding 5, then include it in the same focused Vitest command.
- After local fixes only, run `npm run typecheck`, `npm run typecheck -w @wtc/web`, and `node scripts/gates.mjs full`; run `node scripts/gates.mjs e2e` separately if the operator wants browser coverage.

## Next actions
1. Implement the local-only Phase 3.16 slice: fix admin stale/read-order/target visibility and add the stubbed-fetch read-only `runDbWorkerTick()` PGlite test. Keep all bot/exchange control disabled.
2. Add explicit worker TS coverage (`apps/worker/src/**/*.ts` include or package tsconfig) if accepted as part of the same backend quality slice.
3. Update stale `.env.example`/factory comments that still describe read-only data methods as stubbed.
4. Hand off preview-worker deployment/monitoring, real journal token provisioning, and firewall/reachability acceptance to devops/integration agents; do not fold those into this local backend slice.
