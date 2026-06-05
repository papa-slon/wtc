# ecosystem-platform-architect handoff
## Scope
Phase 3.75 read-only platform audit for adding selected-user bot statistics drilldown to `/admin/users/[userId]/bots`.

Audited how to add read-only positions, closed trades, and equity summaries for a selected user and bot without live bot/provider reads. This audit inspected the current admin user bot detail loader/page, DB snapshot schema and repositories, user-facing positions/trades/equity pages, bot read-model source, and relevant tests. No product code, tests, migrations, worker files, live services, provider systems, secrets, environment probes, SSH, tmux, systemd, exchange pings, or live bot controls were edited or called.

This is the single assigned `ecosystem-platform-architect` handoff for this audit.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- `docs/handoffs/20260603-1922-admin-bot-drilldown-platform-auditor.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/analytics/src/metrics.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None — read-only audit. Product code, tests, migrations, worker files, and runtime configuration were not changed; only this handoff file was written.

## Findings
1. Severity: PASS. The persisted DB model already has the required read-only sources for Phase 3.75; a schema expansion is not required for basic positions/trades/equity summaries.
   Evidence: `bot_metric_snapshots` stores `bot_instance_id`, optional `bot_provider_account_id`, `snapshot_at`, wallet equity, PnL, drawdown, trade count, source adapter, and `raw_json` at `packages/db/src/schema.ts:451` to `packages/db/src/schema.ts:478`; `bot_position_snapshots` stores point-in-time open positions at `packages/db/src/schema.ts:480` to `packages/db/src/schema.ts:506`; `bot_trade_imports` stores immutable closed trades with fees/funding and provider scoping at `packages/db/src/schema.ts:508` to `packages/db/src/schema.ts:537`. Provider-scoped indexes exist in migration `0018_provider_snapshot_scope.sql:1` to `0018_provider_snapshot_scope.sql:12`.
   Recommendation: implement Phase 3.75 as DB snapshot projection over these tables. Do not add live adapter calls, new provider probes, or a new runtime integration path.
   Target part: admin detail DTO/loader/page.

2. Severity: GAP. The current admin drilldown still exposes only latest metric summary, not positions, closed trades, or equity history.
   Evidence: `AdminUserBotSummary` has `latestMetric` but no positions/trades/equity fields at `apps/web/src/features/admin/types.ts:75` to `apps/web/src/features/admin/types.ts:90`; `loadAdminUserBotDetailFromDb()` selects current config rows and metric snapshots only for per-bot runtime detail at `apps/web/src/features/admin/user-bot-detail-loader.ts:323` to `apps/web/src/features/admin/user-bot-detail-loader.ts:353`; the page renders saved WTC settings and latest metric cards, then stops at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:197` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:213`. Phase 3.74 explicitly left this as the next gap at `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md:56` and `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md:80`.
   Recommendation: extend `AdminUserBotSummary` or add a nested `AdminUserBotRuntimeSummary` with bounded safe fields: latest position snapshot time/count/rows, recent closed trades/aggregate net PnL, and metric-derived equity series/summary.
   Target part: `apps/web/src/features/admin/types.ts`, `apps/web/src/features/admin/user-bot-detail-loader.ts`, and `/admin/users/[userId]/bots`.

3. Severity: HIGH. The admin implementation should not call `loadBotReadModelForUser()` directly unless its DB-only path is extracted, because that public user-facing loader can fall back to direct adapters outside DB snapshot mode.
   Evidence: user-facing pages call `loadBotReadModelForUser()` for positions, trades, and equity at `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:11`, `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:13`, and `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:14`; the loader's DB path filters by user, bot instance, and provider mapping at `apps/web/src/features/bots/data.tsx:275` to `apps/web/src/features/bots/data.tsx:355`, but `loadBotReadModelForUser()` falls back to `loadAdapterBotReadModel()` at `apps/web/src/features/bots/data.tsx:565` to `apps/web/src/features/bots/data.tsx:575`; `loadAdapterBotReadModel()` calls `getBotAdapter()` and adapter reads at `apps/web/src/features/bots/data.tsx:540` to `apps/web/src/features/bots/data.tsx:562`.
   Recommendation: either keep admin statistics logic inside `loadAdminUserBotDetailFromDb()` or extract a shared DB-only projection helper that accepts `db`, `targetUserId`, `productCode`, and `parts`, and never falls back to adapter reads.
   Target part: admin loader architecture and shared bot snapshot projection.

4. Severity: HIGH. Legacy runtime statistics must use exactly the same active provider-account boundary as the current metric summary; null-provider rows and ambiguous mappings must fail closed for selected-user drilldown.
   Evidence: the admin loader builds active provider mappings by bot instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:377` to `apps/web/src/features/admin/user-bot-detail-loader.ts:382`; current Legacy metrics skip rows unless `row.botProviderAccountId === activeProvider.id` at `apps/web/src/features/admin/user-bot-detail-loader.ts:387` to `apps/web/src/features/admin/user-bot-detail-loader.ts:392`; the user DB read model rejects zero or multiple active Legacy mappings at `apps/web/src/features/bots/data.tsx:314` to `apps/web/src/features/bots/data.tsx:344`; the worker writes Legacy metric and position snapshots with `botProviderAccountId` when scoped at `apps/worker/src/legacy-live.ts:414` to `apps/worker/src/legacy-live.ts:452`.
   Recommendation: apply the active provider-account id to metric, position, and trade WHERE clauses. If no active mapping or more than one active mapping exists, return an explicit blocked/pending issue state instead of showing fleet rows or a green empty table.
   Target part: Legacy selected-user snapshot scoping.

5. Severity: MEDIUM. Equity for this admin drilldown is metric-derived, not a separate provider equity endpoint or table.
   Evidence: user-facing DB read model builds `equityCurve` from `bot_metric_snapshots.snapshot_at` and `wallet_equity_usd` at `apps/web/src/features/bots/data.tsx:469` to `apps/web/src/features/bots/data.tsx:486`; `@wtc/analytics` defines `EquityPoint` as `{ t, equity }` at `packages/analytics/src/metrics.ts:48` to `packages/analytics/src/metrics.ts:51`; `filterZeroEquity()` removes non-positive placeholder rows at `packages/analytics/src/metrics.ts:234` to `packages/analytics/src/metrics.ts:237`.
   Recommendation: use the latest bounded metric snapshots for an admin equity summary or small curve preview. Apply the same zero-equity filtering and show honest empty states when there are fewer than two usable points.
   Target part: admin equity DTO and UI copy.

6. Severity: MEDIUM. Closed-trade support exists for Tortila snapshots today, but Legacy currently writes metric/position snapshots only in the inspected worker path.
   Evidence: Tortila worker imports closed trades through `importBotTrade()` at `apps/worker/src/jobs.ts:206` to `apps/worker/src/jobs.ts:229`; Legacy snapshot code imports `insertBotMetricSnapshot` and `insertBotPositionSnapshot` only at `apps/worker/src/legacy-live.ts:401` and writes no `bot_trade_imports` in the inspected snapshot function at `apps/worker/src/legacy-live.ts:414` to `apps/worker/src/legacy-live.ts:452`.
   Recommendation: Phase 3.75 can query `bot_trade_imports` for both products, but the Legacy UI must be ready to show "no closed trades persisted" without implying the Legacy runtime has no historical trades. A future Legacy closed-trade importer would be a separate integration slice.
   Target part: admin trade summary empty states and acceptance wording.

7. Severity: MEDIUM. Safe projection must stay scalar and allowlisted; raw snapshot payloads can contain adapter details that are useful internally but should not become normal admin DTOs.
   Evidence: `bot_metric_snapshots.raw_json` and `bot_trade_imports.raw_json` exist at `packages/db/src/schema.ts:471` and `packages/db/src/schema.ts:528`; the user read model currently uses trade `rawJson` only for optional `holdHours` and `retPct` at `apps/web/src/features/bots/data.tsx:452` to `apps/web/src/features/bots/data.tsx:467`; admin static tests already forbid sealed exchange secrets, password hashes, raw config history, and live-apply language at `tests/integration/admin-user-bot-detail-static.test.ts:16` to `tests/integration/admin-user-bot-detail-static.test.ts:39`.
   Recommendation: do not return raw snapshot JSON from the admin loader. If trade quality fields are needed, allowlist numeric `holdHours` and `retPct` only, and keep exchange secrets, provider credentials, and raw config out of serialized DTOs.
   Target part: DTO mapping and static leak tests.

8. Severity: TEST GAP. Existing admin user bot tests prove current metric scoping and leak prevention, but they do not fixture or assert position snapshots, trade imports, or equity series for target versus non-target users.
   Evidence: the PGlite admin loader test imports only `insertBotMetricSnapshot` from snapshot helpers at `tests/integration/admin-user-bot-detail-loader.test.ts:15`; fixture rows insert target, non-target, and null-provider metric snapshots at `tests/integration/admin-user-bot-detail-loader.test.ts:215` to `tests/integration/admin-user-bot-detail-loader.test.ts:257`; assertions verify latest metric and leak prevention at `tests/integration/admin-user-bot-detail-loader.test.ts:300` to `tests/integration/admin-user-bot-detail-loader.test.ts:374`, but no `botPositionSnapshots` or `botTradeImports` fixture appears in that test.
   Recommendation: add PGlite fixtures for target/non-target positions, trades, and multiple metric points; assert target-only rows, Legacy provider-account filtering, null-provider fleet row exclusion, raw JSON exclusion, and unchanged table counts after the read.
   Target part: `tests/integration/admin-user-bot-detail-loader.test.ts` and `tests/integration/admin-user-bot-detail-static.test.ts`.

## Decisions
1. Phase 3.75 should be DB-only. The admin page should read WTC-owned persisted snapshots, not live bot adapters, provider DBs, exchange APIs, SSH, tmux, systemd, or environment values.
2. Source chain for selected-user facts should remain: `users` and `user_roles` for identity, `entitlements` for access state, target-owned `bot_instances` for ownership, and snapshot rows keyed by the selected bot instance.
3. Legacy selected-user runtime facts require an active `bot_provider_accounts` row for the selected user, bot instance, product `legacy_bot`, and provider `legacy-db`; rows with null or mismatched `bot_provider_account_id` are fleet diagnostics, not selected-user facts.
4. Equity summaries are derived from `bot_metric_snapshots.wallet_equity_usd`; there is no separate equity table in the inspected schema.
5. Admin DTOs should be explicit and safe: no `passwordHash`, no `exchange_api_key_secrets`, no raw bot config/history JSON, no raw snapshot JSON, no provider credentials, and no live-control fields.
6. A DB-only shared projection helper is acceptable if it cannot fall back to adapters. The existing public `loadBotReadModelForUser()` should not be used directly by admin Phase 3.75 unless that fallback is removed or bypassed.

## Risks
1. Reusing `loadBotReadModelForUser()` directly can accidentally introduce adapter reads in development/demo modes, violating the Phase 3.75 no-live-probe constraint.
2. Copying `/admin/bots` fleet diagnostics into `/admin/users/[userId]/bots` can leak global Legacy pub_id facts into a selected-user view.
3. Legacy closed trades will likely render empty until a separate Legacy trade import path exists; product copy must avoid overclaiming.
4. Large trade histories can overfetch on an admin page; use bounded limits, aggregate counts, and "recent" language.
5. Historical snapshot rows whose provider mapping was later disabled or deleted may become hidden under fail-closed active-mapping rules. This is safer for selected-user admin detail, but support workflows may later need an audited historical reveal model.
6. The worktree was already dirty with many pre-existing Phase 3 changes and untracked handoffs. This audit did not revert or modify any of them.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - repository is git-backed on branch `codex/bot-analytics-settings-canary-20260603`; many pre-existing modified and untracked Phase 3 files were observed and left untouched.
2. Read-only inspection with `Get-Content`, `rg`, and targeted line-number reads over the files listed above.
3. No background agents were spawned by this per-agent audit; none are left running by this task.

NOT RUN in this audit:
1. `npx vitest`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, Playwright, full `npm test`, or full gates - not run because this assignment was a read-only platform audit plus one handoff, not implementation acceptance.
2. DB migrate/push/seed against managed Postgres - not run.
3. Worker tick, worker smoke, live bot continuity, live provider DB reads, exchange ping/test, SSH, Docker, tmux/systemd/process control, live start/stop/retest/apply-config, `.env` reads, or secret/environment probes - forbidden by scope and not run.

## Next actions
1. Add safe admin DTOs for runtime detail, for example `AdminUserBotPositionSummary`, `AdminUserBotTradeSummary`, `AdminUserBotEquitySummary`, and a nested `AdminUserBotRuntimeSummary`.
2. Extend `loadAdminUserBotDetailFromDb()` or extract a DB-only snapshot projector to query latest position epoch, recent closed trades, and bounded metric equity points for each target-owned bot instance.
3. For Legacy, require exactly one active provider mapping before returning runtime rows, and filter every metric/position/trade query by that mapping id.
4. Render compact read-only panels on `/admin/users/[userId]/bots`: latest open positions, recent closed trades/net PnL, and equity summary/curve preview with honest empty or blocked states.
5. Add focused PGlite and static tests for positions/trades/equity scoping, non-target leakage, Legacy null-provider exclusion, raw JSON exclusion, no adapter imports/calls, and read-only page controls.
6. Implementation acceptance should then run focused admin tests, bot read-safety static tests, typecheck, lint, secret scan, web build, and mobile/desktop admin browser QA before aggregate Phase 3.75 completion.
