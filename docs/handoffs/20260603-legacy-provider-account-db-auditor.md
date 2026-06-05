# ecosystem-db-architect handoff
## Scope
Read-only DB/platform audit for the Legacy provider-account/user scoping blocker. Operator goal: finish Legacy averaging bot plus Tortila bot settings/statistics/admin UX safely. This lane inspected the current WTC schema, migrations, repositories, Legacy worker snapshot path, admin/user bot loaders, and relevant tests to answer:

1. Current schema/read path map for Legacy `pub_id` and bot snapshots.
2. Exact minimal provider-account schema/model needed.
3. Fail-closed query/read-model changes for user and admin pages.
4. Migration and test risks.

No product code was edited. No live services or bots were stopped, started, probed, or mutated.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0007_romantic_mulholland_black.sql`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/db/migrations/0013_young_martin_li.sql`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/db/migrations/0015_wet_cobalt_man.sql`
- `packages/db/migrations/0016_colorful_lyja.sql`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Current WTC bot schema has a user/product bot spine, but no normalized Legacy provider-account ownership dimension. Evidence: `packages/db/src/schema.ts:138` defines `bot_instances` with `user_id`, `product_code`, and optional `exchange_account_id`, while `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:152` define only JSON current config; `packages/db/src/schema.ts:421` to `packages/db/src/schema.ts:443` define `bot_metric_snapshots` keyed by `bot_instance_id`; `packages/db/src/schema.ts:446` to `packages/db/src/schema.ts:467` define `bot_position_snapshots` keyed by `bot_instance_id`; `packages/db/migrations/0000_broken_jack_murdock.sql:35` to `packages/db/migrations/0000_broken_jack_murdock.sql:41` and `packages/db/migrations/0002_sour_paibok.sql:11` to `packages/db/migrations/0002_sour_paibok.sql:29` show the same persisted shape. Recommendation: add first-class `bot_provider_accounts` ownership before any production user-scoped Legacy facts are exposed. Target part: `packages/db/src/schema.ts`, migrations, DB repositories.

2. Severity: Critical. User-facing DB snapshot reads are product-scoped, not current-user or provider-account scoped. Evidence: `apps/web/src/features/bots/data.tsx:241` declares `loadDbBotReadModel(productCode, parts)` with no `userId`; `apps/web/src/features/bots/data.tsx:258` to `apps/web/src/features/bots/data.tsx:270` selects the latest metric snapshot by `bot_instances.product_code`; `apps/web/src/features/bots/data.tsx:272` to `apps/web/src/features/bots/data.tsx:294` does the same for positions/trades; `apps/web/src/features/bots/data.tsx:395` to `apps/web/src/features/bots/data.tsx:410` exposes `rawJson.liveConfig` as config raw data. Settings and export call this after entitlement only: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:118` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:126`; `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24`. Recommendation: replace product-only reads with `loadBotReadModelForUser(userId, productCode, parts)` or equivalent; for Legacy, require active entitlement, target `bot_instances.user_id`, and at least one verified active provider-account mapping before returning any live config/stat/position/trade data. Target part: user bot settings, statistics, overview, trades, positions, equity, journal, and config export.

3. Severity: High. Legacy worker ingestion is safe-column and redacted, but it is still env/system-owner/fleet driven. Evidence: `apps/worker/src/legacy-live.ts:317` to `apps/worker/src/legacy-live.ts:330` reads either `where pub_id = ${apiId}` or up to 20 running provider accounts; `apps/worker/src/legacy-live.ts:335` to `apps/worker/src/legacy-live.ts:365` fans related rows by `api_id in ${apiIds}`; `apps/worker/src/legacy-live.ts:377` to `apps/worker/src/legacy-live.ts:415` resolves one WTC `botInstanceId` from env instance or system owner and then reads `env.LEGACY_API_ID`; `apps/worker/src/legacy-live.ts:425` to `apps/worker/src/legacy-live.ts:454` writes one `bot_metric_snapshots` row with aggregate wallet equity and `rawJson.liveConfig`. Recommendation: keep the safe-column SQL, but drive it from verified `bot_provider_accounts` rows and write per-provider-account snapshots; leave the env/system-owner path as canary/admin-only until replaced. Target part: `apps/worker/src/legacy-live.ts`, worker tick orchestration, DB snapshot repositories.

4. Severity: High. Current admin user bot detail deliberately fails closed for Legacy, but it cannot show target-owned Legacy facts until provider-account mapping exists. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:22` to `apps/web/src/features/admin/user-bot-detail-loader.ts:23` says Legacy provider snapshots are fleet/global until a verified mapping exists; `apps/web/src/features/admin/user-bot-detail-loader.ts:160` to `apps/web/src/features/admin/user-bot-detail-loader.ts:207` scopes instances, exchange metadata, configs, and metric snapshots to the target `userId`; `apps/web/src/features/admin/user-bot-detail-loader.ts:240` to `apps/web/src/features/admin/user-bot-detail-loader.ts:260` marks `legacy_bot` as `fleet_pub_id_pending`; `tests/integration/admin-user-bot-detail-loader.test.ts:227` to `tests/integration/admin-user-bot-detail-loader.test.ts:236` asserts no Legacy metric/config leak for the target user. Recommendation: keep this fail-closed behavior; change `providerScope` to `user_scoped` only after joining verified active provider accounts and scoped snapshots. Target part: admin user drilldown loader and DTO.

5. Severity: High. The global admin Legacy inspector renders full `pub_id` and active slot/order details from the latest product-level raw snapshot. Evidence: `apps/web/src/features/admin/queries.ts:436` to `apps/web/src/features/admin/queries.ts:469` extracts `legacyProviderAccounts` from latest `legacy_bot` `rawJson.liveConfig`; `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:245` renders full `pub_id`, balance, slots, orders, and snapshot time; `apps/web/src/app/admin/bots/page.tsx:254` to `apps/web/src/app/admin/bots/page.tsx:288` renders active slots/orders with full `pub_id`. Recommendation: after normalization, admin should list provider accounts from `bot_provider_accounts` plus latest scoped snapshots; mask `pub_id` by default or add an audited explicit reveal/inspect action. Target part: `/admin/bots`, admin query DTOs, audit actions.

6. Severity: Medium. Legacy `pub_id` should be modeled as provider text, not a WTC UUID foreign key. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:34` to `docs/CONTRACTS/legacy-bot-adapter.md:36` defines `pub_id` as provider account identity; `apps/worker/src/legacy-live.ts:16` to `apps/worker/src/legacy-live.ts:23` types `pub_id` as `string`; `apps/web/src/features/bots/config.ts:67` to `apps/web/src/features/bots/config.ts:70` accepts `providerPubId` as a trimmed string up to 256 chars; tests use fixture values like `legacy-pub-1` at `tests/integration/legacy-live-worker-static.test.ts:16`. Recommendation: use `text` for `provider_pub_id` with length/format validation in Zod/repositories; do not use `uuid` unless live-provider evidence proves every historical and future value is UUID-shaped. Target part: migration, schemas, validation.

7. Severity: Medium. Existing repository helpers are scoped by bot instance, but they do not enforce user ownership at call boundaries. Evidence: `packages/db/src/repositories.ts:1656` to `packages/db/src/repositories.ts:1661` expose `getBotInstance(id)` and `listBotInstancesForUser(userId)` separately; `packages/db/src/repositories.ts:1673` to `packages/db/src/repositories.ts:1711` read config and snapshots by `botInstanceId`; `packages/db/src/repositories.ts:1726` to `packages/db/src/repositories.ts:1750` read positions/trades by `botInstanceId`. Recommendation: add repository functions that accept `{ userId, productCode, providerAccountId? }`, join through ownership internally, and return empty/fail-closed on any mismatch. Target part: `packages/db/src/repositories.ts`, app loaders.

8. Severity: Medium. Current tests prove sanitization and current fail-closed admin behavior, but do not yet prove provider-account ownership isolation because the model is missing. Evidence: `tests/integration/bot-read-safety-static.test.ts:75` to `tests/integration/bot-read-safety-static.test.ts:85` checks DB snapshot backing by table names, not user scope; `tests/integration/bot-read-safety-static.test.ts:97` to `tests/integration/bot-read-safety-static.test.ts:103` checks the admin Legacy inspector is safe/no DB URL; `tests/integration/admin-user-bot-detail-loader.test.ts:159` to `tests/integration/admin-user-bot-detail-loader.test.ts:184` seeds cross-user snapshots and `tests/integration/admin-user-bot-detail-loader.test.ts:221` to `tests/integration/admin-user-bot-detail-loader.test.ts:236` verifies the target view hides the other user's Legacy details. Recommendation: add DB repository tests for no-mapping fail-closed, mapping mismatch, verified mapping success, disabled mapping exclusion, expired entitlement, config export isolation, and admin target-user isolation. Target part: integration/static tests.

## Decisions
- Current schema/read path map:
  - `exchange_accounts` is already user-scoped (`user_id`) and secret material is isolated in `exchange_api_key_secrets`; repositories expose only masks/metadata (`packages/db/src/schema.ts:118` to `packages/db/src/schema.ts:135`; `packages/db/src/repositories.ts:404` to `packages/db/src/repositories.ts:407`).
  - `bot_instances` is WTC user/product scoped, with optional `exchange_account_id`, but not provider-account scoped (`packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:144`).
  - `bot_configs`, `bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, and `bot_safety_events` hang off `bot_instance_id` only (`packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:152`; `packages/db/src/schema.ts:403` to `packages/db/src/schema.ts:545`).
  - Legacy provider `pub_id` currently enters WTC through worker safe-column provider DB reads, then lives inside `bot_metric_snapshots.raw_json.liveConfig.providerAccounts`, `activeSlots`, and `activeOrderSummary` (`apps/worker/src/legacy-live.ts:221` to `apps/worker/src/legacy-live.ts:230`; `apps/worker/src/legacy-live.ts:440` to `apps/worker/src/legacy-live.ts:454`).
  - User-facing Legacy settings/statistics/config export call the product-only read model, so they can see the latest Legacy DB snapshot for the product rather than a verified target-owned `pub_id` unless the next slice changes the read path.

- Minimal additive DB model:
  - Add `bot_provider_accounts`.
  - Required columns: `id uuid pk`, `user_id uuid not null references users(id) on delete cascade`, `bot_instance_id uuid not null references bot_instances(id) on delete cascade`, `provider text not null`, `provider_pub_id text not null`, `claim_state text not null default 'pending_verification'`, `claim_source text not null`, `market text`, `display_label text`, `verified_at timestamptz`, `verified_by uuid references users(id)`, `last_seen_at timestamptz`, `disabled_at timestamptz`, `disabled_reason text`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
  - Required checks: `provider in ('legacy')` for the first migration, `claim_state in ('pending_verification','verified','rejected','disabled')`, and non-empty trimmed `provider_pub_id`.
  - Required indexes/constraints: unique active `(provider, provider_pub_id)` where `disabled_at is null`; index `(user_id, provider)`; index `(bot_instance_id)`; index `(claim_state)`; optional unique `(bot_instance_id, provider, provider_pub_id)`.
  - Required ownership enforcement: add a DB-level path if feasible by adding unique `(id, user_id)` on `bot_instances` and a composite FK `(bot_instance_id, user_id) -> bot_instances(id, user_id)`; otherwise enforce the same invariant in one transaction in repository tests.
  - Required snapshot scoping: add nullable `bot_provider_account_id references bot_provider_accounts(id)` to Legacy-capable snapshot tables at minimum `bot_metric_snapshots` and `bot_position_snapshots`; strongly consider `bot_trade_imports`, `bot_safety_events`, and future config draft/review tables. Existing null rows are fleet/canary/system snapshots and must be excluded from user reads.

- Fail-closed read-model changes:
  - Add `loadBotReadModelForUser(userId, productCode, parts)` and make all user routes/export use it.
  - For `legacy_bot`: require active entitlement, target `bot_instances.user_id`, and at least one `bot_provider_accounts` row where `claim_state = 'verified'` and `disabled_at is null`; otherwise return a not-ready/blocked issue and no live data.
  - Query metrics/positions/trades/equity/config by joined `bot_provider_account_id` and `user_id`, never by product code alone.
  - Validate Legacy saved/exported config so every `providerPubId` in user config belongs to one of the user's verified active provider accounts; reject or omit unmapped values.
  - For admin user detail, keep `fleet_pub_id_pending` until the target user has verified active mappings and scoped snapshots.
  - For `/admin/bots`, move from latest raw product snapshot to normalized account rows; mask full `pub_id` by default or add audited explicit inspect.

## Risks
- Backfill risk: existing `bot_metric_snapshots.raw_json.liveConfig` rows may contain multiple provider accounts under one system bot instance. Do not auto-assign these to users from raw snapshots or hidden form fields. Treat them as historical fleet/canary rows with `bot_provider_account_id = null`.
- Duplicate risk: current `bot_instances` relies on repository get-or-create for `(user_id, product_code)` and no DB unique index was found in the inspected schema/migrations. Adding a unique index may require a duplicate preflight/dedupe migration.
- Claim collision risk: unique active `(provider, provider_pub_id)` can fail if two users claim the same Legacy account. This should fail closed and create an admin/manual-review path, not silently reassign ownership.
- Format risk: provider `pub_id` may be UUID-shaped in production, but current code/tests treat it as arbitrary string. A UUID column could reject existing/test/provider values.
- Aggregate metric risk: existing `wallet_equity_usd` for Legacy is the sum across all accounts in one worker run. It must not be reused as a user/provider-account metric after mapping unless it was written for that exact provider account.
- Raw JSON risk: filtering `raw_json.liveConfig` by allowed pub IDs can be a transitional display bridge, but it should not become the durable ownership model. Prefer normalized per-account snapshot rows.
- Test drift risk: many current tests are static source assertions; add live repository tests with two users/two pub IDs because a static regex can pass while a join still leaks.

## Verification/tests
- Ran read-only source inspection with `rg` and line-numbered `Get-Content` for schema, migrations, repositories, worker, admin/user loaders, pages, and tests.
- Verified there is no current `bot_provider_accounts`, `provider_account`, or `provider_pub_id` schema/migration entry under `packages/db/src` or `packages/db/migrations` via source search.
- Did not run `db:generate`, migrations, test suites, Playwright, worker smoke, or dev servers because this lane is read-only and must not mutate generated files, databases, or live services.
- Gates run: read-only source inspection only.
- Gates not run: `db:generate`, `db:migrate`, `db:seed`, `npm test`, `npm run check:core`, Playwright/e2e, worker smoke, secret scan, governance check. Reason: audit-only lane with no product-code edits and no service/database mutation.

## Next actions
1. Add an additive DB migration and schema exports for `bot_provider_accounts`, ownership constraints/indexes, and nullable `bot_provider_account_id` on Legacy-capable snapshot tables.
2. Add repository functions for claiming/verifying/disabling provider accounts and for scoped snapshot reads by `{ userId, productCode, providerAccountId }`.
3. Update Legacy worker ingestion to iterate verified provider accounts, call the safe-column read for one `provider_pub_id` at a time, write scoped snapshots, and update `last_seen_at`.
4. Replace user-facing `loadBotReadModel(productCode, parts)` calls with a user-scoped read path for settings/statistics/overview/trades/positions/equity/journal/export.
5. Update admin user drilldown to show Legacy facts only from target-owned verified mappings; keep `fleet_pub_id_pending` otherwise.
6. Update `/admin/bots` to read normalized provider accounts, mask full `pub_id` by default, and add audited reveal/inspect if full IDs remain visible.
7. Add tests for no mapping, wrong-user mapping, disabled mapping, verified mapping success, duplicate claim, expired entitlement, config export isolation, admin target-user isolation, and worker per-account snapshot writes.
