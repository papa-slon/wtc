# ecosystem-db-architect handoff

## Scope

Phase 3.69 read-only data/API model audit for production-grade Legacy Bot settings and statistics, acting with the ecosystem-db-architect role and the ecosystem-backend-implementer mutation-boundary lens.

Focused on:
- User-owned provider `pub_id` ownership and lookup.
- Encrypted/private-key onboarding boundary.
- Admin `pub_id` / user lookup and linking model.
- Safe Legacy live snapshot ingestion.
- Versioned WTC-side config drafts with no live apply until audited.
- Statistics derived from provider orders, slots, and stage configs without fabricating unavailable trade metrics.

No product code was modified. This is not a claimed N-agent audit; background/thread agent tooling was not callable in this session, so no background agents were launched or left open. Inspection was local source/docs only; no live server, live bot, provider DB, or deployed DB was touched.

## Files inspected

- `.claude/agents/ecosystem-db-architect.md`
- `.claude/agents/ecosystem-backend-implementer.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/shared/src/schemas.ts`
- `packages/crypto/src/vault.ts`
- `packages/analytics/src/metrics.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `tests/integration/legacy-live-worker-static.test.ts`

## Files changed

None — read-only audit

## Findings

1. Severity: High. Legacy `pub_id` is not a user-owned WTC data model yet. Evidence: `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:152` only model `bot_instances` by `user_id`, `product_code`, and optional `exchange_account_id`; there is no provider account or `pub_id` ownership table. `apps/worker/src/legacy-live.ts:377` to `apps/worker/src/legacy-live.ts:415` still writes through `SYSTEM_LEGACY_BOT_INSTANCE_ID` or a system owner and optionally filters by `LEGACY_API_ID`. Recommendation: add a first-class provider-account table and route all Legacy snapshots/read models through it. Target part: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `apps/worker/src/legacy-live.ts`, web bot loaders.

2. Severity: High. User-facing DB snapshot reads lose the user/ownership dimension after entitlement. Evidence: `apps/web/src/features/bots/data.tsx:242` defines `loadDbBotReadModel(productCode, parts)` without `userId`; `apps/web/src/features/bots/data.tsx:267` to `apps/web/src/features/bots/data.tsx:293` join snapshots to `bot_instances` only by `product_code`. Recommendation: change all Legacy DB read-model loads to take `userId` and selected provider account, then join `bot_instances.user_id` and the provider-account row. Return `not_configured` rather than falling back to another user's latest product snapshot. Target part: `apps/web/src/features/bots/data.tsx`, settings/setup/statistics pages, config export route.

3. Severity: High. Safe ingestion is column-whitelisted but not normalized or idempotent enough for production statistics. Evidence: `apps/worker/src/legacy-live.ts:317` to `apps/worker/src/legacy-live.ts:365` select explicit safe columns for accounts, settings, stages, slots, and orders; `packages/db/src/schema.ts:421` to `packages/db/src/schema.ts:467` only persist aggregate metric snapshots and approximate position snapshots. Recommendation: add normalized Legacy snapshot run and child tables for account, symbol settings, stage config, slots, and orders. Use raw JSON only as sanitized diagnostic detail, not as the stats source of truth. Target part: DB schema/migrations/repositories and worker ingestion.

4. Severity: High. Current config history is WTC-only and audited, but it is not a versioned draft/review/apply-gate model. Evidence: `packages/db/src/repositories.ts:1677` to `packages/db/src/repositories.ts:1689` bumps `bot_configs`, appends `bot_config_versions`, and audits `bot.config.save`; `packages/db/src/schema.ts:403` to `packages/db/src/schema.ts:417` has no lifecycle/status, target provider account, base snapshot, review, or apply-block fields. Recommendation: add `bot_config_drafts` or lifecycle fields tied to provider account and base snapshot. Keep live apply blocked until security and bot-integration audits explicitly approve it. Target part: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, Legacy settings server actions.

5. Severity: High. The encrypted/private-key boundary is conceptually correct for Legacy, but the onboarding API is missing. Evidence: `.env.example:91` to `.env.example:94` state Legacy live-read uses provider `pub_id` and does not collect new exchange keys; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:190` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:310` render the same policy. Non-Legacy key storage is sealed through `apps/web/src/lib/db-store.ts:108` to `apps/web/src/lib/db-store.ts:112` and ciphertext-only DB tables at `packages/db/src/schema.ts:118` to `packages/db/src/schema.ts:135`. Recommendation: add a Legacy `pub_id` claim/link workflow instead of reusing exchange-key onboarding. Any future service credential or private token must be a WTC service secret in the vault, never a user exchange key and never a Legacy HTTP response field. Target part: setup server actions, shared schemas, DB provider-account/claim tables.

6. Severity: Medium. Admin cannot look up or govern Legacy accounts by `pub_id`. Evidence: `apps/web/src/features/admin/queries.ts:145` to `apps/web/src/features/admin/queries.ts:167` load generic users only; `apps/web/src/features/admin/queries.ts:342` to `apps/web/src/features/admin/queries.ts:458` expose global bot health and the latest snapshot, not a user-owned `pub_id` directory. Recommendation: add an admin Legacy accounts directory with searchable `pub_id`, user, entitlement status, claim state, latest snapshot freshness/counts, quarantine state, and audited link/unlink/disable actions. Target part: `apps/web/src/app/admin/bots/page.tsx` or new `/admin/bots/legacy/accounts`, plus repository queries.

7. Severity: Medium. Legacy statistics need a narrower DTO so unavailable metrics stay unavailable and approximate metrics are labeled. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:248` to `docs/CONTRACTS/legacy-bot-adapter.md:288` declare closed PnL, unrealized PnL, win rate, profit factor, drawdown, fees, funding, and real position state unavailable/null; `apps/worker/src/legacy-live.ts:419` to `apps/worker/src/legacy-live.ts:439` write balance and null aggregate PnL metrics, while `apps/worker/src/legacy-live.ts:278` to `apps/worker/src/legacy-live.ts:292` build approximate positions from slots/orders with `unrealizedPnl: 0`. Recommendation: derive Legacy statistics from normalized snapshots as wallet balance, active slot count, active order count, stage capacity, configured/active symbols, TP/SL coverage, and estimated entry exposure. Keep closed trade metrics null until real trade history exists; mark slot/order-derived positions as estimates. Target part: worker normalizer, `packages/analytics`, bot statistics loaders.

8. Severity: Medium. Production live-read still lacks deployed DB role proof. Evidence: Phase 3.68 left column-restricted Legacy DB role proof not run at `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md:75` to `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md:109`; `packages/config/src/env.ts:122` to `packages/config/src/env.ts:123` only require a `LEGACY_DATABASE_URL` when enabled. Recommendation: add a deployment preflight that proves the configured role can read only safe columns and cannot read `api_key`, `secret_key`, or other credential columns. The preflight must never print provider values. Target part: deployment scripts/docs and worker startup health detail.

9. Severity: Medium. `ensureBotInstance` is an app-level get-or-create without a DB uniqueness constraint or provider-account dimension. Evidence: `packages/db/src/repositories.ts:1665` to `packages/db/src/repositories.ts:1669` selects then inserts by `(userId, productCode)`; `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:144` does not define a unique index. Recommendation: add uniqueness around `(user_id, product_code)` for the current single-instance assumption or, preferably for Legacy production, `(user_id, product_code, provider_account_id)` after provider-account modeling. Use `onConflict` semantics instead of select-then-insert. Target part: DB schema/migration/repositories.

## Decisions

1. Add `bot_provider_accounts` as the production ownership spine for Legacy:
   - Columns: `id`, `user_id`, `bot_instance_id`, `provider`, `provider_pub_id`, `provider_user_ref_hash`, `market`, `display_label`, `claim_state`, `claim_source`, `verified_at`, `verified_by`, `last_seen_at`, `disabled_at`, `disabled_reason`, `created_at`, `updated_at`.
   - Values: `provider = 'legacy'`; `claim_state` values `pending_admin_review`, `verified`, `discovered_unassigned`, `disabled`; `claim_source` values `user_claim`, `admin_link`, `worker_discovery`.
   - Indexes: unique active `(provider, provider_pub_id)`, index `(user_id, provider)`, index `(bot_instance_id)`, index `(claim_state)`, and a case-normalized/searchable `provider_pub_id` index for admin lookup.

2. Add normalized Legacy snapshot tables:
   - `legacy_snapshot_runs`: `id`, `bot_provider_account_id`, `bot_instance_id`, `provider_pub_id`, `snapshot_at`, `source_adapter`, `source_schema_version`, `status`, row counts, `data_quality`, `error_code`, `created_at`; unique `(bot_provider_account_id, snapshot_at, source_adapter)`.
   - `legacy_account_snapshots`: account-level running/balance/quarantine state without any exchange key material.
   - `legacy_symbol_setting_snapshots`: symbol, active, timeframe, RSI/CCI settings, TP, entry percent, averaging settings, balance percent, leverage, stage, delay/delta fields.
   - `legacy_stage_config_snapshots`: stage, RSI slot capacity, CCI slot capacity.
   - `legacy_slot_snapshots`: symbol, signal/reason, stage, averaging count, active flag, opened timestamp, provider-derived stable key/hash.
   - `legacy_order_snapshots`: symbol, side/position side, note, price, quantity, active flag, stage/reason/system/order ids when safe; fallback to a deterministic order hash when provider ids are not safely selected.

3. Add `bot_config_drafts` for Legacy config intent instead of treating every save as live-intent:
   - Columns: `id`, `bot_instance_id`, `bot_provider_account_id`, `base_snapshot_run_id`, `version`, `status`, `config_json`, `schema_version`, `created_by`, `updated_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`, `apply_state`, `applied_at`, `created_at`, `updated_at`.
   - Values: `status` values `draft`, `submitted`, `approved_reference`, `rejected`, `superseded`; `apply_state` default `blocked_not_audited`.
   - Existing `bot_config_versions` can remain the immutable history table for saved references; production Legacy UI should show drafts/reference versions scoped to the selected provider account.

4. Keep Legacy onboarding as `pub_id` claim/linking, not exchange-key collection:
   - User action: claim a provider `pub_id` for review if they have an allowed `legacy_bot` entitlement.
   - Admin action: verify/link/unlink/disable by `pub_id`.
   - Secret boundary: WTC never asks for Legacy exchange `api_key` or `secret_key`; future service credentials must use the vault and service-secret metadata, not user exchange-key tables unless they are actual exchange keys for a non-Legacy exchange account.

5. Worker production path should iterate verified `bot_provider_accounts` rows and write one snapshot run per provider account. The current env-driven `SYSTEM_LEGACY_BOT_OWNER_ID`, `SYSTEM_LEGACY_BOT_INSTANCE_ID`, and optional `LEGACY_API_ID` path can remain canary-only until replaced.

6. No live apply route should exist for Legacy until audited. If an apply endpoint/action is introduced early for UI plumbing, it must return fail-closed, audit `bot.config.apply_blocked`, and never call the Legacy runtime.

## Risks

- Current canary snapshots may aggregate multiple provider accounts into one system-owned instance when `LEGACY_API_ID` is unset.
- Provider-side Legacy DB still contains credential columns; WTC source code avoids selecting them, but column-restricted role proof was not observed in this session.
- Exact deployed DB grants/schema were not verified live; conclusions are based on local code and docs.
- Adding provider-account uniqueness may require a data migration for any existing system-owned Legacy snapshots.
- Slot/order-derived statistics are useful for operations, but they are not equivalent to exchange-confirmed positions or closed-trade analytics.

## Verification/tests

RUN:
- Static local inspection with `rg` and `Get-Content` across the files listed above.
- Confirmed the current worker safe-column selection includes provider `pub_id` and rejects secret-looking selected fields.
- Confirmed the current DB model has sealed exchange-key storage, bot instances/config versions, metric snapshots, position snapshots, trade imports, and safety events, but no provider-account ownership table.
- Confirmed the current web DB snapshot loader filters by product code, not by current user plus provider `pub_id`.

NOT RUN:
- No live Legacy provider DB connection or role-grant probe, by read-only/no-live-mutation scope.
- No live bot HTTP/control path, start/stop/retest/apply, or config apply; these remain blocked.
- No migrations, `db:generate`, typecheck, lint, unit tests, Playwright, secret scan, or governance gates; this was a read-only model audit.
- No browser verification.
- No background agent fan-out; agent/thread tooling was unavailable in this session, so no N-agent audit is claimed.

## Next actions

1. DB migration: update `packages/db/src/schema.ts` and migrations to add `bot_provider_accounts`, `legacy_snapshot_runs`, `legacy_account_snapshots`, `legacy_symbol_setting_snapshots`, `legacy_stage_config_snapshots`, `legacy_slot_snapshots`, `legacy_order_snapshots`, and `bot_config_drafts`; add the indexes and uniqueness rules listed in Decisions.

2. Repositories: update `packages/db/src/repositories.ts` with `claimLegacyProviderPubId`, `adminLinkLegacyProviderPubId`, `adminDisableLegacyProviderAccount`, `listLegacyProviderAccountsForUser`, `adminListLegacyProviderAccounts`, `recordLegacySnapshotRun`, `replaceLegacySnapshotChildren`, and `loadLegacyReadModelForUser`.

3. Worker ingestion: update `apps/worker/src/legacy-live.ts` to read verified `bot_provider_accounts`, query Legacy by explicit `pub_id` batches, write one `legacy_snapshot_runs` row per provider account, then write normalized children and aggregate bot snapshots from those normalized rows. Keep the system-owner env path canary-only.

4. Web ownership: change `apps/web/src/features/bots/data.tsx` and callers to pass `user.id` plus selected provider account into the Legacy read model. Update settings/setup/statistics/config export so a user can never read another user's product-level latest snapshot.

5. Onboarding/API: add a Legacy `pub_id` claim form/action to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`, with shared validation in `packages/shared/src/schemas.ts`. Do not reuse `apiKey/apiSecret` fields for Legacy.

6. Admin API/UI: add `/admin/bots/legacy/accounts` or expand `apps/web/src/app/admin/bots/page.tsx` with searchable `pub_id`, user, entitlement, claim state, latest snapshot, quarantine, and audited link/unlink/disable actions. Add joins to `/admin/users` only as non-secret summary badges.

7. Config drafts: update `apps/web/src/features/bots/config.ts` and settings actions to save provider-scoped drafts/reference versions, including `base_snapshot_run_id`, draft status, and `apply_state='blocked_not_audited'`.

8. Statistics: update Legacy stats derivation to use normalized settings/stage/slots/orders. Expose wallet balance, active slots, active orders, stage capacity, symbol count, TP/SL coverage, and estimated exposure with `data_quality` flags; keep closed-trade metrics null.

9. Proof and tests: add PGlite repository tests for provider ownership isolation, worker snapshot idempotency, admin lookup, config draft lifecycle, and user read isolation. Add/extend static tests that prove no Legacy secret columns are selected and that config export cannot cross users. Add a deployment role-proof script that verifies denied access to secret columns without printing data.

10. Docs: update `docs/DATA_MODEL.md`, `docs/DOMAIN_MODEL.md`, `docs/CONTRACTS/legacy-bot-adapter.md`, `docs/AUDIT_LOG_SCHEMA.md`, and `docs/handoffs/0000-orchestrator-seed.md` after implementation so the canonical docs describe provider-account ownership, normalized Legacy snapshots, and the no-live-apply boundary.
