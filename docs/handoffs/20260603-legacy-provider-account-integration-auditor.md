# ecosystem-bot-integration-auditor handoff
## Scope
Read-only Legacy averaging bot audit for normalized provider-account/user scoping. The operator goal is to let WTC truthfully show a user's Legacy bot facts without implying fleet/global `pub_id` rows are user-owned, while keeping Legacy and Tortila settings/statistics/admin UX safe before any live control.

This lane wrote only this handoff file as requested. It did not edit product code, did not run migrations, did not start/stop live services, did not call Legacy HTTP management endpoints, and did not query live provider databases.

## Files inspected
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260603-legacy-bot-integration-auditor.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-bot-settings-platform-db.md`
- `docs/handoffs/20260603-legacy-provider-account-db-auditor.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_legacy_provider_accounts.sql`
- `packages/audit/src/audit.ts`
- `packages/analytics/src/metrics.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`

## Files changed = None - read-only audit

## Findings
1. **Critical - Legacy data currently reaches WTC through a read-only-style provider DB snapshot path, not through live control.** Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:24` says WTC is a read-only consumer; `docs/CONTRACTS/legacy-bot-adapter.md:34` requires explicit safe columns and no `api_key`/`secret_key`; `docs/CONTRACTS/legacy-bot-adapter.md:56` documents `LEGACY_LIVE_READS_ENABLED=true` plus `LEGACY_DATABASE_URL`; `apps/worker/src/legacy-live.ts:303` opens the Legacy Postgres read path; `apps/worker/src/legacy-live.ts:414` reads rows for `env.LEGACY_API_ID`; `apps/worker/src/legacy-live.ts:425` writes one `bot_metric_snapshots` row with `rawJson.liveConfig`; `apps/worker/src/legacy-live.ts:457` writes approximate positions; `apps/worker/src/legacy-live.ts:474` records health with `liveControlDisabled: true`; `packages/bot-adapters/src/factory.ts:32` and `packages/bot-adapters/src/legacy/legacy-blocked.ts:54` keep direct Legacy HTTP/data/control blocked. Recommendation: preserve this as the only accepted Legacy canary path until per-provider-account scoping is implemented; do not introduce HTTP `/api_management/` calls or live start/stop/apply. Target part: Legacy adapter boundary and worker snapshot flow.

2. **Critical - User bot pages still consume the latest product-level Legacy snapshot after entitlement, so a user can see fleet/global rows as if they belonged to their account.** Evidence: `apps/web/src/features/bots/data.tsx:241` loads latest metric snapshots by `botInstances.productCode` without a user or provider-account filter; `apps/web/src/features/bots/data.tsx:395` exposes `rawJson.liveConfig`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:93` checks entitlement, then calls `loadBotReadModel(meta.code, ...)`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:117` loads the same product-level Legacy config snapshot for user settings; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:136` renders `Legacy provider accounts`; `apps/web/src/app/(app)/app/bots/[bot]/statistics/page.tsx:206` calls `loadBotReadModel(bot.code, ...)` for accessible bots; `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12` exports Legacy live config after entitlement using the product-level read. Recommendation: add a user-scoped read model such as `loadBotReadModelForUser(user.id, productCode, parts)` that joins entitlement, the user's `bot_instances`, an active/verified provider-account mapping, and only snapshots for that mapped provider account; fail closed when no mapping or no scoped snapshot exists. Target part: `apps/web/src/features/bots/data.tsx`, user bot pages, config export route.

3. **High - `pub_id` should attach to the new provider-account mapping table, but snapshots and audit taxonomy are not yet fully normalized around it.** Evidence: `packages/db/src/schema.ts:146` defines `botProviderAccounts`; `packages/db/src/schema.ts:153` stores `providerAccountId` with a comment identifying Legacy `Api_Key.pub_id`; `packages/db/src/schema.ts:165` enforces unique active provider account ownership; `packages/db/migrations/0017_legacy_provider_accounts.sql:1` creates the same table; `packages/db/src/repositories.ts:1686` upserts mappings after checking `botInstances.id/userId/productCode`; however `packages/db/src/schema.ts:449` and `packages/db/src/schema.ts:474` keep metric and position snapshots keyed only by `botInstanceId`; `apps/worker/src/legacy-live.ts:425` and `apps/worker/src/legacy-live.ts:457` do not write a provider-account FK; `packages/db/src/repositories.ts:1737` writes audit actions such as `bot.provider_account.map`, while `packages/audit/src/audit.ts:29` and `docs/AUDIT_LOG_SCHEMA.md` do not register/document those provider-account action names. Recommendation: treat `bot_provider_accounts.providerAccountId` as the canonical `pub_id` attachment point; add `bot_provider_account_id` or an equivalent immutable provider-scope key to snapshots/read models; register provider-account audit actions in the audit package and audit schema. Target part: DB model, repositories, worker writes, audit contract.

4. **High - The current worker is still fleet/system-owner oriented and should not be treated as per-user ownership evidence.** Evidence: `apps/worker/src/legacy-live.ts:377` resolves a single configured/system Legacy bot instance; `apps/worker/src/legacy-live.ts:383` uses `SYSTEM_LEGACY_BOT_OWNER_ID ?? SYSTEM_BOT_OWNER_ID`; `apps/worker/src/legacy-live.ts:414` reads either the configured `LEGACY_API_ID` or a capped set of running accounts; `apps/worker/src/legacy-live.ts:420` aggregates wallet equity and running/quarantine counts; `apps/worker/src/legacy-live.ts:425` persists one aggregate metric row; `docs/handoffs/20260603-legacy-bot-integration-auditor.md:76` summarizes the current path as provider Postgres safe columns to WTC worker to WTC Postgres to UI, with `pub_id` provider identity still needing normalized ownership at `docs/handoffs/20260603-legacy-bot-integration-auditor.md:78`. Recommendation: change the worker to iterate active verified `bot_provider_accounts` and call `readLegacyRows(databaseUrl, providerAccount.providerAccountId)` per mapping, writing one scoped snapshot per mapped account; keep the env/system-owner aggregate path labeled canary/fleet diagnostics only. Target part: `apps/worker/src/legacy-live.ts`.

5. **High - Before live control, user-facing Legacy UX can show only mapped safe facts, not controls or unowned fleet facts.** Evidence: `apps/web/src/features/bots/meta.ts:69` says Legacy has no backtester, trade history, or equity curve and is read through worker snapshots; `apps/web/src/features/bots/config.ts:637` exports only an allowlisted safe Legacy config; `apps/web/src/features/bots/config.ts:686` warns that exports contain no exchange keys and no live apply token; `packages/db/src/repositories.ts:1806` persists WTC bot config only and does not forward to the live bot; `docs/CONTRACTS/legacy-bot-adapter.md:250` says wallet balance can lag; `docs/CONTRACTS/legacy-bot-adapter.md:271` says active slots are only an approximate position proxy; `docs/CONTRACTS/legacy-bot-adapter.md:312` says closed trade history is unavailable. Recommendation: before live control, show users entitlement state, WTC saved reference settings, safe export, masked/short mapped `pub_id`, snapshot staleness, market/running/quarantine, balance snapshot, symbol settings, stage capacities, active slots/orders as projections; hide or disable start, stop, retest, apply-config, key-test, closed-trade PnL, win rate, profit factor, drawdown, Sharpe/Sortino, and any fleet-only `pub_id`. Target part: user bot settings/statistics/export UX.

6. **High - Admins may inspect fleet diagnostics, but those diagnostics must stay clearly separate from target-user ownership claims.** Evidence: `apps/web/src/features/admin/queries.ts:347` loads integration and metric diagnostics; `apps/web/src/features/admin/queries.ts:447` parses Legacy `providerAccounts`, `activeSlots`, and `activeOrderSummary` from the latest product-level snapshot; `apps/web/src/app/admin/bots/page.tsx:53` labels admin bot health as cross-user diagnostics and says it does not start/stop/apply config; `apps/web/src/app/admin/bots/page.tsx:219` renders a global Legacy `pub_id` inspector; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:100` renders provider-account mappings for a target user; `apps/web/src/features/admin/user-bot-detail-loader.ts:190` selects provider mappings by target user/product and `apps/web/src/features/admin/user-bot-detail-loader.ts:217` selects metric snapshots only from target user's `botInstances`; `tests/integration/admin-user-bot-detail-loader.test.ts:255` asserts user A's Legacy mapping does not leak user B's `pub_id`. Recommendation: keep `/admin/bots` as fleet diagnostics with explicit cross-user labeling and no customer ownership wording; use `/admin/users/:userId/bots` for target-user ownership only when an active provider mapping exists; require audited reveal or masking for full `pub_id` outside that target-user context. Target part: admin bot health and admin user detail UX.

7. **Medium - Legacy analytics availability must stay null/N/A, because current math can accidentally turn unavailable facts into zeros.** Evidence: `docs/CANONICAL_ANALYTICS_MODEL.md:34` marks Legacy first equity, unrealized PnL, closed PnL, fees/funding, and net PnL unavailable; `docs/CANONICAL_ANALYTICS_MODEL.md:81` marks win rate, profit factor, expectancy, average win/loss, Sharpe, Sortino, and drawdown unavailable; `docs/CANONICAL_ANALYTICS_MODEL.md:166` requires unavailable metrics to render N/A rather than zero; `packages/analytics/src/metrics.ts:147` computes totals from arrays and can return zero when there are no trades/positions; `apps/web/src/features/bots/data.tsx:413` computes metrics from Legacy snapshots. Recommendation: carry an explicit Legacy capability mask through read models/admin DTOs so unavailable metrics are `null`/N/A and cannot be interpreted as realized zero PnL or zero risk. Target part: analytics read model and UI metric cards.

8. **Medium - Existing tests cover some admin target-user scoping, but they do not yet prove user bot pages and config export fail closed by provider account.** Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:143` seeds separate provider mappings for user A and user B; `tests/integration/admin-user-bot-detail-loader.test.ts:255` asserts only user A's `legacy-user-a-pub` appears in user A detail; `tests/integration/admin-user-bot-detail-static.test.ts:43` still asserts older static wording around pending Legacy fleet scoping, while current UI wording has moved to provider-account status. Recommendation: add non-live integration tests for user settings/statistics/config export requiring an active `bot_provider_accounts` row and rejecting unmapped or differently mapped `pub_id` snapshots; update stale static expectations after the UX wording is final. Target part: integration/static tests.

## Decisions
- Legacy `Api_Key.pub_id` is the provider runtime account identity and should be represented in WTC as `bot_provider_accounts.providerAccountId` for `productCode='legacy_bot'` and `provider='legacy'`.
- User-owned Legacy facts require both WTC bot entitlement and an active/verified provider-account mapping. Entitlement alone must not authorize display/export of product-level Legacy live snapshots.
- The current worker aggregate/system-owner snapshot path is useful as canary/fleet diagnostics only. It is not proof that a row belongs to any end user.
- Before live control, WTC settings are reference/draft UX only. Persisting WTC config must not imply the live Legacy bot has been applied, retested, started, stopped, or key-tested.
- Admin `/admin/bots` may show global Legacy health and fleet `pub_id` diagnostics if clearly labeled cross-user/fleet and separated from target-user pages.
- Admin `/admin/users/:userId/bots` is the right place to show target-user Legacy provider mappings and target-owned WTC snapshots, with full `pub_id` only in audited admin context.
- Unsupported Legacy analytics must display N/A/null, not zero, for closed-trade or performance metrics that Legacy snapshots cannot supply.

## Risks
- If `loadBotReadModel(productCode, ...)` remains the user-page source of truth, any entitled Legacy user can receive the latest product-level liveConfig and config export even without a mapped `pub_id`.
- If metric/position snapshots remain keyed only by `botInstanceId`, future code can still mix aggregate canary snapshots with per-user snapshots.
- If the worker continues to write aggregate rows under a system owner, admin/user loaders can accidentally treat fleet diagnostics as user facts.
- If provider-account audit actions are not registered in the audit contract, mapping/disable evidence may be incomplete or inconsistent with the platform audit vocabulary.
- If unavailable Legacy metrics are computed as zeros, users/admins can infer false PnL, risk, win rate, or strategy performance.
- If full `pub_id` appears in broad fleet tables without reveal/audit policy, it becomes an account identifier exposure risk even though it is not an exchange secret.
- If tests focus only on admin user detail, user settings/statistics/export can regress independently.

## Verification/tests
Read-only verification performed in this lane:
1. Confirmed the target handoff file did not already exist before writing it.
2. Reviewed current git status and observed a dirty worktree with many pre-existing modified/untracked files from other lanes; this lane did not revert or edit them.
3. Inspected Legacy contracts, handoffs, worker snapshot code, adapter-blocking code, DB schema/repositories/migration, user read models, admin read models, analytics docs, and tests using read-only file and text search commands.
4. Confirmed the non-mock Legacy adapter remains blocked in source: `packages/bot-adapters/src/factory.ts` returns `createLegacyBlockedAdapter`, and `packages/bot-adapters/src/legacy/legacy-blocked.ts` throws on data/control methods while `getHealth()` avoids network calls.
5. Confirmed worker source records `liveControlDisabled: true` and uses snapshot inserts rather than live start/stop/apply control calls.

Gates not run in this lane:
- No lint/typecheck/test suite was run, because the lane is read-only and focused on audit evidence rather than code changes.
- No migration was run.
- No worker tick was run.
- No browser/deploy probe was run.
- No live provider DB query was run.
- No SSH, Docker, systemd, tmux, process-control, HTTP POST/PATCH/DELETE, start, stop, retest, apply-config, or key-test command was run.

Exact non-live verification to prove the bot is not stopped/mutated:
1. Before and after the audit, run `git status --short --branch` and verify the only file intentionally introduced by this lane is `docs/handoffs/20260603-legacy-provider-account-integration-auditor.md`; product code must be unchanged by this lane.
2. Run `rg -n "createLegacyBlockedAdapter|LegacyAdapterBlockedError|startBot|stopBot|applyConfig" packages/bot-adapters/src/factory.ts packages/bot-adapters/src/legacy/legacy-blocked.ts` and verify non-mock Legacy paths still resolve to the blocked adapter and control methods throw.
3. Run `rg -n "snapshotLegacyBotPostgres|LEGACY_LIVE_READS_ENABLED|LEGACY_DATABASE_URL|LEGACY_API_ID|insertBotMetricSnapshot|insertBotPositionSnapshot|recordHealthCheck|liveControlDisabled" apps/worker/src/legacy-live.ts apps/worker/src/index.ts apps/worker/src/tick-once.ts` and verify worker code only reads safe snapshots and writes WTC snapshot/health rows, with `liveControlDisabled: true`.
4. Run `rg -n "api_management|retest|applyConfig|startBot|stopBot|POST|PATCH|DELETE" apps packages scripts` as a static source search, then inspect any hits to confirm they are UI-disabled, mock/test-only, or blocked-adapter code rather than live Legacy control.
5. Run `git diff -- docs/handoffs/20260603-legacy-provider-account-integration-auditor.md` and `git diff --stat` to document the handoff-only lane output.
6. Do not run worker ticks, migrations, `docker compose`, process managers, SSH commands, live provider DB commands, curl POST/PATCH/DELETE requests, or any Legacy API control endpoint as part of this proof. If service-state proof is required, collect operator-provided before/after liveness/status excerpts through an approved read-only process, and keep them separate from this audit.

## Next actions
1. Implement a user-scoped Legacy read path that requires an active/verified `bot_provider_accounts` mapping before returning Legacy liveConfig, stats, settings context, or config export.
2. Add provider-account snapshot linkage: `bot_provider_account_id` or equivalent immutable provider-scope key on metric/position/health/config snapshot rows that can carry Legacy `pub_id` ownership through the stack.
3. Refactor the Legacy worker to iterate active verified provider mappings and snapshot one `pub_id` at a time, while keeping aggregate env/system-owner snapshots labeled fleet diagnostics only.
4. Register and document provider-account audit actions such as map/update/disable/reveal in `packages/audit` and `docs/AUDIT_LOG_SCHEMA.md`.
5. Add tests proving unmapped users cannot see/export Legacy live facts, mapped users see only their mapped `pub_id`, and admin fleet diagnostics cannot be consumed as target-user facts.
6. Add a Legacy capability mask to read models so unavailable trade/PnL/performance metrics are null/N/A across user and admin views.
7. Decide the admin reveal/masking policy for full `pub_id` in fleet diagnostics and enforce it consistently.
8. Re-run only non-live gates after implementation: static source control search, targeted unit/integration tests with fixtures, lint/typecheck, and handoff diff review.
