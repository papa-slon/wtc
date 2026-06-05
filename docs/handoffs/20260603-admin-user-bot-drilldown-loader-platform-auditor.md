# ecosystem-platform-db-architect handoff
## Scope
Read-only platform/DB audit for the bounded admin user bot drilldown loader slice.

Questions answered:
- Smallest safe loader hardening needed for user-scoped drilldown.
- Exact table joins and filters for `entitlements`, `exchange_accounts`, `bot_instances`, `bot_configs`, and `bot_metric_snapshots`.
- Whether a pure PGlite test can exercise `loadAdminUserBotDetail` directly, or whether a helper extraction is needed.

No application/runtime code, live services, real DB migrations, worker, SSH, bot controls, or provider/exchange calls were run or changed. This is the assigned platform/DB auditor handoff only; no multi-agent count is claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/index.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0001_early_toad_men.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0007_romantic_mulholland_black.sql`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/db-pg5.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `vitest.config.ts`
- `package.json`

## Files changed
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md` only.

## Findings
1. Severity: HIGH. The existing schema is sufficient for the bounded WTC-owned drilldown; no schema migration is required for a read-only first slice.
   Evidence: `entitlements` is keyed by `user_id` and `product_code` with a unique user/product index at `packages/db/src/schema.ts:76` to `packages/db/src/schema.ts:95`; safe exchange account metadata is separate from secret material at `packages/db/src/schema.ts:118` to `packages/db/src/schema.ts:135`; `bot_instances` carries `user_id`, `product_code`, and optional `exchange_account_id` at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:144`; current configs sit behind `bot_instance_id` at `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:152`; metrics hang off `bot_instance_id` with an `(bot_instance_id, snapshot_at)` index at `packages/db/src/schema.ts:421` to `packages/db/src/schema.ts:443`.
   Recommendation: do not add a migration for this slice. Harden the loader to project only target-owned rows and safe summaries.
   Target part: `apps/web/src/features/admin/queries.ts`, optional extracted DB helper.

2. Severity: HIGH. `loadAdminUserBotDetail` should not load the selected user through `listUsersWithCreatedAt()` because that repository intentionally selects every user and includes `passwordHash`.
   Evidence: current loader calls `listUsersWithCreatedAt(db)` then filters in memory at `apps/web/src/features/admin/queries.ts:239` to `apps/web/src/features/admin/queries.ts:240`; the repository warning says the returned shape includes `passwordHash` and must not be returned directly at `packages/db/src/repositories.ts:3274` to `packages/db/src/repositories.ts:3280`; the actual select includes `passwordHash` and all users at `packages/db/src/repositories.ts:3282` to `packages/db/src/repositories.ts:3296`.
   Recommendation: replace that first step with a target-only `users` select that omits `password_hash`, plus a target-only `user_roles` select. This is the smallest safe hardening because it removes unnecessary cross-user data from the loader before DTO mapping.
   Target part: user prelude in `loadAdminUserBotDetail`.

3. Severity: HIGH. Entitlement access should be date-aware and fail closed through the entitlement engine, not a raw `status === active || grace` check.
   Evidence: current `botAccessOpen()` returns true only for raw `active` or `grace` at `apps/web/src/features/admin/queries.ts:83` to `apps/web/src/features/admin/queries.ts:85`; the current entitlement query omits `source`, `startsAt`, `graceUntil`, `expiresAt`, and `manualOverride` at `apps/web/src/features/admin/queries.ts:252` to `apps/web/src/features/admin/queries.ts:262`; `packages/entitlements` declares itself the only access source of truth and evaluates expiry/grace windows at `packages/entitlements/src/engine.ts:1` to `packages/entitlements/src/engine.ts:4` and `packages/entitlements/src/engine.ts:63` to `packages/entitlements/src/engine.ts:87`; `explainAccess()` grants only effective active/grace access at `packages/entitlements/src/engine.ts:113` to `packages/entitlements/src/engine.ts:155`.
   Recommendation: select all fields needed to build `Entitlement` rows and compute per-product `explainAccess(entitlements, productCode, now)`. Return both displayed entitlement row status and effective access reason/status if the DTO needs both.
   Target part: entitlement projection and `accessOpen` calculation.

4. Severity: HIGH. The safest row isolation rule is: all bot facts must join through target-owned `bot_instances`, and exchange account metadata must be constrained to the same target user.
   Evidence: `bot_configs`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, and `bot_trade_reviews` all reference `bot_instances.id` at `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:152` and `packages/db/src/schema.ts:403` to `packages/db/src/schema.ts:524`; current `loadAdminUserBotDetail` already scopes instance rows by `bot_instances.user_id = userId` and bot product code at `apps/web/src/features/admin/queries.ts:263` to `apps/web/src/features/admin/queries.ts:271`, and scopes configs/metrics through those instance IDs at `apps/web/src/features/admin/queries.ts:284` to `apps/web/src/features/admin/queries.ts:310`; exchange rows are selected by `exchange_accounts.user_id = userId` and only safe metadata columns at `apps/web/src/features/admin/queries.ts:272` to `apps/web/src/features/admin/queries.ts:281`.
   Recommendation: keep the same ownership spine but make it explicit and deterministic in the helper. Prefer SQL joins through `bot_instances` or an instance-ID list produced only by `bot_instances.user_id = targetUserId`. Attach `exchange_accounts` only when both `exchange_accounts.id = bot_instances.exchange_account_id` and `exchange_accounts.user_id = targetUserId`.
   Target part: row scoping for exchange/config/metric data.

5. Severity: MEDIUM. Current config and metric selection is safe on secrecy, but needs deterministic "latest/current" semantics.
   Evidence: current config selection intentionally returns only `botInstanceId`, `version`, and `updatedAt`, not raw `config`, at `apps/web/src/features/admin/queries.ts:285` to `apps/web/src/features/admin/queries.ts:293`; current metric selection returns normalized safe metric columns and not `rawJson` at `apps/web/src/features/admin/queries.ts:294` to `apps/web/src/features/admin/queries.ts:310`; however `bot_configs` has no unique index on `bot_instance_id` in the schema at `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:152`, and current `configsByInstance = new Map(...)` has no ordering guard at `apps/web/src/features/admin/queries.ts:325` to `apps/web/src/features/admin/queries.ts:327`.
   Recommendation: order configs by `bot_instance_id`, `version DESC`, `updated_at DESC` and take the first row per instance, or query one current row per target-owned instance. For metrics, avoid a global `LIMIT 100` as the correctness rule; choose latest per target-owned instance with `DISTINCT ON`, `row_number() over (partition by bot_instance_id order by snapshot_at desc)`, or at most one query per fixed product instance.
   Target part: config/metric reducer.

6. Severity: MEDIUM. A pure PGlite test should not exercise `loadAdminUserBotDetail` directly in its current shape; a dependency-injected helper extraction is needed.
   Evidence: `loadAdminUserBotDetail` calls `getServerDb()` directly at `apps/web/src/features/admin/queries.ts:226` to `apps/web/src/features/admin/queries.ts:237`; `getServerDb()` only returns a cached DB from `DATABASE_URL` or null/fail-closed based on environment at `apps/web/src/lib/backend.ts:20` to `apps/web/src/lib/backend.ts:47`; the cached DB is created from a postgres URL in `apps/web/src/lib/db-store.ts:45` to `apps/web/src/lib/db-store.ts:59`; existing PGlite tests create `new PGlite()`, replay migration SQL, and cast `drizzle(pg, { schema })` to `Db` at `tests/integration/db-persistence.test.ts:46` to `tests/integration/db-persistence.test.ts:55`, `tests/integration/db-0002.test.ts:34` to `tests/integration/db-0002.test.ts:41`, and `tests/integration/worker-tortila-snapshot.test.ts:44` to `tests/integration/worker-tortila-snapshot.test.ts:55`.
   Recommendation: extract `loadAdminUserBotDetailFromDb(db: Db, targetUserId: string, now = Date.now())` or equivalent. Keep `loadAdminUserBotDetail(userId)` as a thin server wrapper for demo/no-DB behavior. Put the helper somewhere importable by Vitest without `getServerDb()` or live URL coupling, for example a server-only-free admin loader helper module or a small `@wtc/db` read helper if package-level reuse is desired.
   Target part: test seam for PGlite row-isolation coverage.

7. Severity: MEDIUM. Static coverage exists for forbidden joins and live controls, but it does not prove cross-user DB isolation.
   Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:16` to `tests/integration/admin-user-bot-detail-static.test.ts:30` checks source strings for safe tables and no secret/config-version joins; `tests/integration/admin-user-bot-detail-static.test.ts:32` to `tests/integration/admin-user-bot-detail-static.test.ts:43` checks route RBAC/read-only strings and no live-control terms; existing PGlite repository tests already prove the local migration harness pattern and per-user isolation for other domains at `tests/integration/db-0002.test.ts:110` to `tests/integration/db-0002.test.ts:123`.
   Recommendation: add a PGlite loader test with two users, two bot instances, separate entitlements/configs/metrics, and assertions that user A's DTO contains no user B bot IDs, values, symbols, external IDs, raw JSON, password hash, sealed secret, or audit/config row mutations.
   Target part: `tests/integration/admin-user-bot-detail-loader.test.ts` or `tests/integration/admin-user-bot-drilldown-loader.test.ts`.

## Decisions
1. No DB migration is needed for the bounded drilldown. Use the existing user -> entitlement/exchange account/bot instance/config/metric spine.
2. The minimal loader hardening is:
   - target-only user select that omits `password_hash`;
   - date-aware `explainAccess()` from `@wtc/entitlements`;
   - explicit target-owned `bot_instances` as the only path to configs and snapshots;
   - target-owned exchange account attachment;
   - deterministic latest config/metric selection.
3. Exact joins/filters for the implementation:

```sql
-- Target user, no password_hash.
SELECT id, email, display_name, created_at,
       failed_login_total_count, last_failed_login_at,
       account_locked_until, account_lockout_review_required_at
FROM users
WHERE id = :targetUserId
LIMIT 1;

SELECT role_code
FROM user_roles
WHERE user_id = :targetUserId;

-- Entitlement labels and effective access inputs.
SELECT user_id, product_code, status, source, plan_code,
       starts_at, current_period_end, grace_until, expires_at,
       manual_override, updated_at
FROM entitlements
WHERE user_id = :targetUserId
  AND product_code IN ('tortila_bot', 'legacy_bot');

-- Ownership spine.
SELECT id, product_code, exchange_account_id, created_at
FROM bot_instances
WHERE user_id = :targetUserId
  AND product_code IN ('tortila_bot', 'legacy_bot');

-- Safe exchange metadata only; never join exchange_api_key_secrets.
SELECT ea.id, ea.exchange, ea.label, ea.mode, ea.key_mask, ea.created_at
FROM exchange_accounts ea
WHERE ea.user_id = :targetUserId;
-- When attaching to a bot: ea.id = bi.exchange_account_id AND ea.user_id = bi.user_id.

-- Config summary only. If config is selected, run it through an allowlist helper.
SELECT bc.bot_instance_id, bc.version, bc.updated_at
FROM bot_configs bc
JOIN bot_instances bi ON bi.id = bc.bot_instance_id
WHERE bi.user_id = :targetUserId
  AND bi.product_code IN ('tortila_bot', 'legacy_bot')
ORDER BY bc.bot_instance_id, bc.version DESC, bc.updated_at DESC;

-- Latest normalized metric per target-owned bot instance; never select raw_json.
SELECT bms.bot_instance_id, bms.snapshot_at, bms.wallet_equity_usd,
       bms.closed_pnl_usd, bms.unrealized_pnl_usd, bms.win_rate,
       bms.profit_factor, bms.max_drawdown_pct, bms.trade_count,
       bms.source_adapter
FROM bot_metric_snapshots bms
JOIN bot_instances bi ON bi.id = bms.bot_instance_id
WHERE bi.user_id = :targetUserId
  AND bi.product_code IN ('tortila_bot', 'legacy_bot')
ORDER BY bms.bot_instance_id, bms.snapshot_at DESC;
```

4. A pure PGlite test should call the dependency-injected helper, not the current wrapper. Directly testing the wrapper would require `DATABASE_URL`, app module mocking, or Next/server-only import behavior, none of which is the row-isolation property this slice needs to prove.
5. Keep `exchange_api_key_secrets`, `bot_metric_snapshots.raw_json`, `bot_config_versions.config_json`, live adapter calls, worker ticks, and audit writes out of this loader.

## Risks
1. If `listUsersWithCreatedAt()` remains in this drilldown, the loader continues to pull every user's password hash before stripping, which is unnecessary blast radius for a target-user view.
2. If access is derived from raw entitlement status only, expired active rows can be mislabeled open until a worker reconciliation catches up.
3. If metrics are selected by product or global latest timestamp rather than target-owned `bot_instances`, admin drilldown can show another user's or a fleet/system snapshot as target-user data.
4. If `bot_configs.config`, `bot_config_versions.config_json`, or `bot_metric_snapshots.raw_json` is added later without allowlist projection, arbitrary future config/runtime fields can leak.
5. If a read audit is added inside this loader, the slice is no longer read-only and needs a separate security/audit decision.

## Verification/tests
RUN in this audit:
1. `git rev-parse --is-inside-work-tree`, `git branch --show-current`, and `git status --short` - repository is git-backed on branch `codex/bot-analytics-settings-canary-20260603` with pre-existing modified/untracked admin/bot/settings/test/handoff files. They were left untouched.
2. `Test-Path docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md` before writing returned `False`.
3. Read-only source inspection with `rg` and `Get-Content` over AGENTS/session protocol, sibling handoffs, admin queries/types/routes, backend DB accessors, DB schema/repositories/client/index, entitlements engine, migrations, and PGlite tests.
4. `node_modules\.bin\secretlint.cmd "docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md"` passed.
5. No live server, worker, SSH, Docker, real database migration/seed, bot start/stop/apply-config, provider call, exchange key ping/test, or secret-bearing runtime command was run.

NOT RUN:
1. Vitest/Playwright/typecheck/lint/build/gates - not run because this task was a read-only audit plus one handoff file, not an implementation acceptance pass.
2. PGlite loader test - not run because the helper does not yet exist and application code was out of scope for this audit.
3. Real Postgres/managed DB gates - not run by scope.
4. Worker tick/canary/live bot gates - not run by policy.

## Next actions
1. Extract a pure helper, for example `loadAdminUserBotDetailFromDb(db: Db, targetUserId: string, now = Date.now())`, and keep `loadAdminUserBotDetail(userId)` as the server/demo wrapper.
2. Replace the all-users prelude with target-only `users` and `user_roles` selects that omit `password_hash`.
3. Expand the entitlement query fields and compute effective access via `explainAccess()`.
4. Keep bot facts joined through target-owned `bot_instances`; attach `exchange_accounts` only when account and bot share the same target user.
5. Add a PGlite loader test with two users and before/after row-count assertions to prove isolation and read-only behavior.
