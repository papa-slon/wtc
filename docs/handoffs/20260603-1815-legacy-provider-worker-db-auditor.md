# legacy-provider-worker-db-auditor handoff
## Scope
Read-only audit for Phase 3.72 - Legacy provider-account ingestion + admin mapping foundation.

Focus: current Legacy worker and DB ingestion path, especially whether `apps/worker/src/legacy-live.ts` now iterates active `bot_provider_accounts` for `legacy_bot`, queries one provider `pub_id` at a time through the existing safe-column/read-only provider DB path, and writes `bot_provider_account_id` on WTC metric/position/safety/trade rows.

No live services, SSH, tmux, systemd, provider DB, exchange APIs, `.env`, bot start/stop/retest/apply-config, live worker tick, migration, or deploy action was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/INTEGRATION_MAP.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/index.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/db-0002.test.ts`
- `package.json`
- `tsconfig.json`
- `tsconfig.base.json`

## Files changed
None - read-only audit.

Handoff written: `docs/handoffs/20260603-1815-legacy-provider-worker-db-auditor.md`.

## Findings
1. Severity: High. The main exported Legacy worker is still not provider-account iterative. Evidence: `apps/worker/src/legacy-live.ts:488` imports `listActiveBotProviderAccounts`, but `apps/worker/src/legacy-live.ts:524` to `apps/worker/src/legacy-live.ts:526` still resolves one system/configured `legacy_bot` instance and calls `readLegacyRows(databaseUrl, env.LEGACY_API_ID)`; `apps/worker/src/legacy-live.ts:536` to `apps/worker/src/legacy-live.ts:566` writes the metric snapshot without `botProviderAccountId`; `apps/worker/src/legacy-live.ts:568` to `apps/worker/src/legacy-live.ts:583` writes positions without `botProviderAccountId`. Recommendation: replace this branch with active mapping iteration: `listActiveBotProviderAccounts(db, { productCode: 'legacy_bot', provider: 'legacy-db' })`, then for each mapping call `readLegacyRows(databaseUrl, mapping.providerAccountId)` and `snapshotLegacyRowsToWtc(db, { botInstanceId: mapping.botInstanceId, botProviderAccountId: mapping.id, ... })`. Target part: `apps/worker/src/legacy-live.ts`.

2. Severity: High. The scoped write helper exists and is the right local primitive, but it is not used by the worker entrypoint. Evidence: `apps/worker/src/legacy-live.ts:391` to `apps/worker/src/legacy-live.ts:400` defines `snapshotLegacyRowsToWtc()` with optional `botProviderAccountId`; `apps/worker/src/legacy-live.ts:414` to `apps/worker/src/legacy-live.ts:446` passes it to `insertBotMetricSnapshot`; `apps/worker/src/legacy-live.ts:448` to `apps/worker/src/legacy-live.ts:464` passes it to `insertBotPositionSnapshot`; however `snapshotLegacyBotPostgres()` duplicates the old unscoped metric/position code instead of calling this helper. Recommendation: make `snapshotLegacyBotPostgres()` use this helper for all provider-account-scoped writes and delete the duplicate old insert block. Target part: `apps/worker/src/legacy-live.ts`.

3. Severity: High. DB schema and repositories can store provider scope on metric/position/trade/safety rows, but the Legacy worker currently only writes metric and position rows. Evidence: `packages/db/src/schema.ts:449` to `packages/db/src/schema.ts:584` adds nullable `bot_provider_account_id` and indexes on metric, position, trade, and safety tables; `packages/db/src/repositories.ts:1830` to `packages/db/src/repositories.ts:1961` accepts and writes `botProviderAccountId` for metric, position, trade, and safety repository calls. Current Legacy code writes only metrics/positions at `apps/worker/src/legacy-live.ts:414` and `apps/worker/src/legacy-live.ts:448`, and no Legacy trade import or safety-event insertion exists. Recommendation: do not fabricate Legacy closed trades because the contract says no closed-trade history is available; when adding Legacy safety rows for real signals such as quarantine, pass `botProviderAccountId: mapping.id`. Future trade imports must also pass the mapping id if a real provider trade source is introduced. Target part: `apps/worker/src/legacy-live.ts`, `packages/db/src/repositories.ts`.

4. Severity: High. User-facing Legacy reads already fail closed unless one active provider mapping exists and scoped snapshots exist, so unscoped worker writes will remain invisible to users. Evidence: `apps/web/src/features/bots/data.tsx:312` to `apps/web/src/features/bots/data.tsx:328` loads active `legacy-db` provider mappings for the current user and bot instance; `apps/web/src/features/bots/data.tsx:330` to `apps/web/src/features/bots/data.tsx:341` denies zero or multiple mappings; `apps/web/src/features/bots/data.tsx:344` to `apps/web/src/features/bots/data.tsx:353` filters metrics, positions, and trades by `botProviderAccountId`; `apps/web/src/features/bots/data.tsx:395` to `apps/web/src/features/bots/data.tsx:397` returns a no-snapshot issue when no scoped rows exist. Recommendation: complete the worker mapping loop before treating Phase 3.72 as user-runtime complete. Target part: worker ingestion and user read-model acceptance.

5. Severity: Medium. The active-mapping repository primitive exists and is sufficient for the worker's first safe iteration, but it only filters active rows and does not prove ownership verification. Evidence: `packages/db/src/repositories.ts:1686` to `packages/db/src/repositories.ts:1702` selects active provider-account rows by product/provider with a default limit of 100; `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:170` defines status and uniqueness but has no `verified_at`, `verified_by`, `claim_source`, `provider_user_ref_hash`, `disabled_reason`, or `last_seen_at`. Recommendation: use this primitive for Phase 3.72 iteration, but keep production onboarding blocked on either explicit proof fields or an equivalent audited proof model. Target part: DB mapping foundation and admin mapping UX.

6. Severity: Medium. Existing tests do not yet prove the exported worker iterates active mappings. Evidence: `tests/integration/legacy-live-worker-static.test.ts:175` to `tests/integration/legacy-live-worker-static.test.ts:180` checks safe-column SQL only; untracked `tests/integration/legacy-provider-worker.test.ts:137` to `tests/integration/legacy-provider-worker.test.ts:183` tests `snapshotLegacyRowsToWtc()` directly, not `snapshotLegacyBotPostgres()` or `runDbWorkerTick()`. Recommendation: add an injected row-reader seam or exported pure loop so PGlite tests can prove active-only iteration, one provider `pub_id` query per mapping, scoped metric/position/safety/trade writes, and partial-error behavior without connecting to the live provider DB. Target part: worker tests.

7. Severity: Medium. The new untracked provider-worker test is not green as written. Evidence: `npx vitest run tests/integration/legacy-provider-worker.test.ts` failed at `tests/integration/legacy-provider-worker.test.ts:156` because Drizzle/Postgres returns numeric `walletEquityUsd` as `3210.5500`, while the test expects `3210.55`. Recommendation: update that expectation to the database numeric scale, then extend the test to cover the exported mapping loop. Target part: `tests/integration/legacy-provider-worker.test.ts`.

8. Severity: Medium. The current root TypeScript gate does not cover `apps/worker`. Evidence: `tsconfig.json:8` to `tsconfig.json:13` includes packages and tests but excludes `apps/web` and does not include `apps/worker`; there is no `apps/worker/tsconfig.json`. Recommendation: either include `apps/worker/src/**/*.ts` in a repo typecheck project or add a worker project config so worker-only regressions are not caught only by Vitest transpilation. Target part: TypeScript gate coverage.

9. Severity: High. The safe-column/read-only integration boundary must remain unchanged while adding provider-account iteration. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:24` to `docs/CONTRACTS/legacy-bot-adapter.md:36` defines the accepted canary as provider Postgres safe-column reads by `pub_id`; `docs/CONTRACTS/legacy-bot-adapter.md:56` to `docs/CONTRACTS/legacy-bot-adapter.md:57` says the current canary uses `LEGACY_DATABASE_URL` and direct HTTP/control remains blocked; `packages/bot-adapters/src/factory.ts:32` to `packages/bot-adapters/src/factory.ts:39` routes non-mock Legacy to the blocked adapter; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1` to `packages/bot-adapters/src/legacy/legacy-blocked.ts:17` states no network call is made by the blocked adapter. Recommendation: extend only the DB snapshot path; do not introduce Legacy HTTP, start/stop, retest, apply-config, exchange calls, or credential reads. Target part: worker and adapter boundary.

## Decisions
1. Treat `bot_provider_accounts.providerAccountId` as the WTC copy of Legacy `Api_Key.pub_id`; it is provider runtime identity, not a WTC user id.
2. Treat the current `snapshotLegacyRowsToWtc()` helper as a useful partial implementation, not a complete Phase 3.72 worker implementation.
3. The production/user-scoped worker path should iterate active `legacy_bot` + `legacy-db` mappings and query exactly one `pub_id` per mapping.
4. If the legacy system-owner / `LEGACY_API_ID` path is retained, it should be explicitly labeled fleet/canary diagnostics and must not satisfy user-owned runtime acceptance.
5. Do not add Legacy closed-trade rows until a real safe provider source exists; "no closed-trade history" must remain unavailable rather than fabricated.

## Risks
1. Concurrent dirty/untracked work was present and changed during the audit. This handoff does not revert, normalize, or overwrite any existing worktree changes.
2. If Phase 3.72 ships with the current `snapshotLegacyBotPostgres()` branch, user pages will still show mapping/snapshot-required states because scoped snapshot rows are not written by the real worker entrypoint.
3. Mapping mistakes remain high impact because current `active` mappings lack explicit proof metadata. A wrong active `pub_id` assignment would route provider facts to the wrong WTC bot instance.
4. Naive safety-event insertion could spam duplicate warnings every tick; add a dedupe/window rule or accept append-only warning logs deliberately.
5. Root `npm run typecheck` passing does not currently prove worker source inclusion.

## Verification/tests
RUN:
1. `git status --short --branch` - observed dirty branch `codex/bot-analytics-settings-canary-20260603`; many pre-existing modified/untracked files, including provider-account phase files. No existing dirty work was reverted.
2. `npx tsc --noEmit --pretty false -p tsconfig.json` - PASS, but this gate does not include `apps/worker`.
3. `npx tsc --noEmit --pretty false --target ES2023 --module NodeNext --moduleResolution NodeNext --lib ES2023,DOM --types node --skipLibCheck --strict --allowImportingTsExtensions apps/worker/src/legacy-live.ts` - PASS for targeted worker file syntax/type check.
4. `npx vitest run tests/integration/legacy-live-worker-static.test.ts` - PASS, 5 tests.
5. `npx vitest run tests/integration/legacy-provider-worker.test.ts` - FAIL, 1 of 2 tests failed on numeric scale (`3210.5500` actual vs `3210.55` expected), not on provider scope fields.
6. `npx tsc --noEmit --pretty false -p apps/worker/tsconfig.json` - NOT A VALID GATE; the path does not exist.

NOT RUN:
1. Live provider DB query / `LEGACY_DATABASE_URL` worker tick - not run by read-only safety policy and scope.
2. DB migrations against managed/live Postgres - not run by policy and scope.
3. Live bot start/stop/restart/retest/apply-config, SSH, tmux, systemd, exchange API checks, `.env` edits - forbidden and not run.
4. `npm run worker:smoke`, `npm test`, `npm run lint`, `npm run secret:scan`, `npm run governance:check`, `npm run build -w @wtc/web` - not run; this was a focused read-only background audit after targeted worker checks.

## Next actions
1. Refactor `snapshotLegacyBotPostgres()` so after env/database enablement it lists active `legacy_bot`/`legacy-db` mappings, queries `readLegacyRows(databaseUrl, mapping.providerAccountId)` one mapping at a time, and calls `snapshotLegacyRowsToWtc()` with `botProviderAccountId: mapping.id`.
2. Return and log `providerAccountsScoped` from every `LegacyLiveSnapshotResult` branch, and include aggregate counts/errors without exposing provider DB secrets or full connection details.
3. Add a non-live test seam for the provider row reader and PGlite tests proving: disabled/needs_review mappings are skipped, each active mapping queries only its own `pub_id`, scoped metric/position rows are written, real safety/trade writers pass `botProviderAccountId`, one mapping failure does not stop the whole tick, and error detail stays redacted.
4. Fix `tests/integration/legacy-provider-worker.test.ts` numeric expectation to the DB scale (`3210.5500`) and extend it beyond the helper to the exported worker loop.
5. Add worker source to a TypeScript gate or create `apps/worker/tsconfig.json`.
6. Keep Legacy direct HTTP/control blocked; do not touch live services or provider `.env`; do not introduce any exchange-key read/write path.
