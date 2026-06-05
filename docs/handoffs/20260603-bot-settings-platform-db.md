# ecosystem-platform-architect + ecosystem-db-architect handoff
## Scope
Focused read-only platform and DB architecture map for bot settings and bot statistics.

Roles covered in this single handoff:
- `ecosystem-platform-architect`: package boundaries, API/server-action map, worker/adapters, safety boundaries.
- `ecosystem-db-architect`: current schema/repository truth, target tables/entities, migrations, audit events.

This is not a broad implementation phase and makes no N-agent audit claim. No background agents were launched. No live server, bot service, exchange state, runtime config, or secrets were mutated. Application/product/runtime code was not edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1459-ecosystem-ux-ui-designer.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `package.json`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0007_romantic_mulholland_black.sql`
- `packages/audit/src/audit.ts`
- `packages/shared/src/schemas.ts`
- `packages/config/src/env.ts`
- `packages/analytics/src/metrics.ts`
- `packages/analytics/src/advanced.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`

## Files changed
- `docs/handoffs/20260603-bot-settings-platform-db.md` - this handoff only.

## Findings
1. Severity: High. Current bot persistence has a useful generic spine, but it does not yet model provider-account ownership or `pub_id` scoping. Evidence: `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:152` define `bot_instances` and `bot_configs` only by WTC user/product/optional exchange account plus JSON config; `packages/db/src/schema.ts:403` to `packages/db/src/schema.ts:545` define config versions, metric snapshots, position snapshots, trade imports, trade reviews, and safety events, but no provider-account table; current source search found `pub_id` only in worker/UI snapshot code, not in `packages/db/src` or migrations. Recommendation: add first-class provider account ownership before any production user-scoped Legacy stats/settings rollout. Target part: `packages/db/src/schema.ts`, migrations, `packages/db/src/repositories.ts`, bot web loaders.

2. Severity: High. Legacy live-read currently stores rich provider state inside `bot_metric_snapshots.raw_json.liveConfig`, which works for canary visibility but is not a durable query model. Evidence: `apps/worker/src/legacy-live.ts:425` to `apps/worker/src/legacy-live.ts:455` writes a `legacy-db` metric snapshot with `rawJson.liveConfig`; `apps/web/src/features/bots/data.tsx:395` to `apps/web/src/features/bots/data.tsx:410` reconstructs the config view from that raw JSON; `apps/web/src/features/admin/queries.ts:426` to `apps/web/src/features/admin/queries.ts:459` pulls latest Legacy `rawJson.liveConfig` for the admin pub_id inspector. Recommendation: keep `raw_json` as forensic/source payload, but add normalized Legacy snapshot tables for provider accounts, settings, stages, slots, orders, and snapshot runs. Target part: DB migration plus worker ingestion.

3. Severity: High. User-facing DB snapshot reads are product-scoped, not current-user/provider-account scoped. Evidence: `apps/web/src/features/bots/data.tsx:241` to `apps/web/src/features/bots/data.tsx:270` selects the latest metric snapshot by `productCode`; `apps/web/src/features/bots/data.tsx:272` to `apps/web/src/features/bots/data.tsx:294` does the same for positions/trades; `apps/web/src/features/bots/data.tsx:296` to `apps/web/src/features/bots/data.tsx:299` chooses a bot instance from those latest rows. Recommendation: production DB reads must join through current user entitlement -> `bot_instances` -> `bot_provider_accounts`, then read the latest snapshot for that account. Target part: `loadBotReadModel`, new repository functions, admin/user DTOs.

4. Severity: High. Settings saves are correctly reference-only and audited, but the current model cannot express draft/review/apply lifecycle. Evidence: server actions use CSRF, requireUser, entitlement check, Zod parse, then `persistBotConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:67` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98`; `persistBotConfig` writes either demo memory or `saveBotConfig` at `apps/web/src/features/bots/config.ts:663` to `apps/web/src/features/bots/config.ts:674`; `saveBotConfig` bumps version, updates current config, appends `bot_config_versions`, and audits `bot.config.save` in one transaction at `packages/db/src/repositories.ts:1677` to `packages/db/src/repositories.ts:1690`. Recommendation: preserve this reference-only behavior, then add `bot_config_drafts` with status/review/apply-state fields before any live-apply design. Target part: `packages/db`, settings server actions, audit schema.

5. Severity: High. Legacy direct HTTP/control remains blocked, and this must stay true while adding stats/settings. Evidence: `packages/bot-adapters/src/factory.ts:32` to `packages/bot-adapters/src/factory.ts:39` routes Legacy non-mock modes to `createLegacyBlockedAdapter`; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1` to `packages/bot-adapters/src/legacy/legacy-blocked.ts:17` states the real Legacy HTTP adapter was deleted and no network call is made; `packages/bot-adapters/src/legacy/legacy-blocked.ts:71` to `packages/bot-adapters/src/legacy/legacy-blocked.ts:100` throws for data/control methods; `docs/CONTRACTS/legacy-bot-adapter.md:24` to `docs/CONTRACTS/legacy-bot-adapter.md:36` define the accepted canary path as safe-column provider DB snapshots by `pub_id`. Recommendation: new platform/DB work must extend the worker DB snapshot path, not relax the Legacy adapter hard gate. Target part: worker, DB, admin/user read models.

6. Severity: High. Legacy worker selection is currently safe-column and redacted, but env/system-owner driven. Evidence: `apps/worker/src/legacy-live.ts:16` to `apps/worker/src/legacy-live.ts:83` defines safe row shapes; `apps/worker/src/legacy-live.ts:127` to `apps/worker/src/legacy-live.ts:134` rejects selected secret-looking fields; `apps/worker/src/legacy-live.ts:317` to `apps/worker/src/legacy-live.ts:371` selects whitelisted provider columns only; `apps/worker/src/legacy-live.ts:377` to `apps/worker/src/legacy-live.ts:415` gates on `LEGACY_LIVE_READS_ENABLED`, `LEGACY_DATABASE_URL`, optional instance/owner, and optional `LEGACY_API_ID`. Recommendation: target worker path should iterate verified `bot_provider_accounts` rows and snapshot by explicit provider `pub_id`; keep env/system owner path canary-only until replaced. Target part: `apps/worker/src/legacy-live.ts`, DB repos, migration.

7. Severity: Medium. Bot-specific settings schemas live in the web feature layer, while `packages/shared` only has a generic bot config envelope. Evidence: `packages/shared/src/schemas.ts:36` to `packages/shared/src/schemas.ts:45` defines a generic conservative bot config; `apps/web/src/features/bots/config.ts:32` to `apps/web/src/features/bots/config.ts:128` defines the real Tortila and Legacy settings schemas; `apps/web/src/features/bots/config.ts:383` to `apps/web/src/features/bots/config.ts:430` parses Legacy form rows/stages; `apps/web/src/features/bots/config.ts:459` to `apps/web/src/features/bots/config.ts:477` parses Tortila rows. Recommendation: move durable bot-settings schemas/serializers into a package boundary, preferably new `packages/bot-settings` (`@wtc/bot-settings`), leaving web files as UI form mappers. Target part: packages and web imports.

8. Severity: Medium. Tortila read-only adapter and worker ingestion already map current metrics/positions/trades through canonical packages, but config read remains intentionally unavailable. Evidence: `packages/bot-adapters/src/http.ts:79` to `packages/bot-adapters/src/http.ts:88` lists safe Tortila GET endpoints and says no `/api/config`; `packages/bot-adapters/src/http.ts:181` to `packages/bot-adapters/src/http.ts:184` throws `AdapterNotReadyError` for config; `apps/worker/src/jobs.ts:105` to `apps/worker/src/jobs.ts:246` writes Tortila health, metrics, positions, and imported trades without control calls. Recommendation: target Tortila settings should remain WTC reference/export until provider config introspection is audited; stats should keep flowing through `@wtc/analytics`. Target part: `packages/bot-settings`, export route, worker ingestion.

9. Severity: Medium. Statistics logic is already mostly in the right package boundary, and should stay there. Evidence: `packages/analytics/src/metrics.ts:1` to `packages/analytics/src/metrics.ts:7` defines the package as canonical bot-agnostic metric model; `packages/analytics/src/metrics.ts:53` to `packages/analytics/src/metrics.ts:107` defines canonical metric inputs/outputs; `packages/analytics/src/advanced.ts:66` to `packages/analytics/src/advanced.ts:74` defines advanced analytics; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:318` to `apps/web/src/app/(app)/app/bots/statistics/page.tsx:375` consumes metrics and advanced analytics but keeps Legacy operational rather than fabricating closed-trade stats. Recommendation: target stats should add normalized source facts and repository DTOs, not move analytics calculations into pages. Target part: `packages/analytics`, `packages/db`, `apps/web/src/features/bots/data.tsx`.

10. Severity: Medium. Audit coverage exists for current bot config/trade/safety mutations but lacks provider-account and admin-inspection actions needed by the target map. Evidence: `packages/audit/src/audit.ts:29` to `packages/audit/src/audit.ts:37` includes bot config, trade import/review, and safety events; `docs/AUDIT_LOG_SCHEMA.md:162` to `docs/AUDIT_LOG_SCHEMA.md:170` documents config actions; `docs/AUDIT_LOG_SCHEMA.md:323` states `bot.config.save` must not include raw config JSON. Recommendation: add audit actions for `bot.provider_account.claim`, `bot.provider_account.verify`, `bot.provider_account.link`, `bot.provider_account.unlink`, `bot.provider_account.disable`, `bot.snapshot.ingest`, `bot.config_draft.submit`, `bot.config_draft.review`, and `admin.bot_account.inspect`, each with redacted/minimal payloads. Target part: `packages/audit`, `docs/AUDIT_LOG_SCHEMA.md`, DB repos/server actions.

11. Severity: Medium. Admin now has a global Legacy pub_id inspector, but it is derived from the latest raw snapshot rather than searchable/governable account records. Evidence: `apps/web/src/features/admin/types.ts:179` to `apps/web/src/features/admin/types.ts:215` defines safe Legacy admin DTOs; `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:252` renders provider accounts; `apps/web/src/app/admin/bots/page.tsx:254` to `apps/web/src/app/admin/bots/page.tsx:294` renders active slots/orders. Recommendation: target admin should read normalized provider accounts with search by user/email/product/pub_id, latest snapshot freshness, quarantine state, and audited link/unlink/disable. Target part: admin repos and `/admin/bots` or `/admin/bots/legacy/accounts`.

12. Severity: Low. `job_queue` remains reserved, so target bot snapshot work should not pretend a durable queue exists. Evidence: `packages/db/src/schema.ts:364` to `packages/db/src/schema.ts:368` says `job_queue` is not consumed; `apps/worker/src/index.ts:1` to `apps/worker/src/index.ts:6` says the worker is cron-style direct DB repository jobs; `apps/worker/src/jobs.ts:1` to `apps/worker/src/jobs.ts:7` repeats that nothing enqueues/dequeues `job_queue`. Recommendation: keep bot snapshot ingestion as worker cron/direct repos unless a separate durable queue phase lands with tests. Target part: worker architecture docs and migration plan.

## Decisions
1. Target package map:
   - `packages/db`: owns tables, migrations, repository transactions, scoped bot snapshot reads, provider-account linking, config draft lifecycle.
   - `packages/bot-settings` (new target package): owns Tortila/Legacy Zod settings schemas, form-independent DTOs, safe export serializers, Legacy pub_id claim schemas, version/draft validation. Keep TypeScript strip-friendly.
   - `packages/bot-adapters`: remains runtime read boundary. Tortila HTTP is read-only; Legacy HTTP/control remains blocked. No config apply lives here until a separate audited adapter exists.
   - `packages/analytics`: remains canonical metric and advanced analytics package. Pages consume computed DTOs; pages do not own metric math.
   - `apps/worker`: owns read-only ingestion into WTC DB. It may read provider systems only through explicit safe adapters/queries and writes snapshots/health/audit.
   - `apps/web`: owns server actions, route handlers, UI loaders, admin/user DTO assembly, and entitlement/RBAC/CSRF gates.

2. Target table/entity map:
   - Current kept: `bot_instances`, `bot_configs`, `bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, `bot_trade_reviews`, `bot_safety_events`, `integration_health_checks`, `audit_logs`.
   - Add `bot_provider_accounts`: `id`, `user_id`, `bot_instance_id`, `provider`, `provider_pub_id`, `provider_user_ref_hash`, `market`, `display_label`, `claim_state`, `claim_source`, `verified_at`, `verified_by`, `last_seen_at`, `disabled_at`, `disabled_reason`, `created_at`, `updated_at`.
   - Add `legacy_snapshot_runs`: `id`, `bot_provider_account_id`, `bot_instance_id`, `provider_pub_id`, `snapshot_at`, `source_adapter`, `source_schema_version`, `status`, row counts, `data_quality`, `error_code`, `created_at`.
   - Add `legacy_account_snapshots`: one row per provider account/run with market/running/balance/quarantine fields.
   - Add `legacy_symbol_setting_snapshots`: one row per provider account/run/symbol with active, timeframe, signal flags, RSI/CCI thresholds, TP, entry percent, averaging ladder, balance percent, leverage, stage, delay/delta filters.
   - Add `legacy_stage_config_snapshots`: one row per provider account/run/stage with RSI/CCI slot capacity.
   - Add `legacy_slot_snapshots`: one row per provider account/run/active slot with symbol, signal/reason, stage, averaging count, opened time.
   - Add `legacy_order_snapshots`: one row per provider account/run/active order with symbol, side/type/note, price, quantity.
   - Add `bot_config_drafts`: `id`, `bot_instance_id`, `bot_provider_account_id`, `base_snapshot_run_id`, `version`, `status`, `config_json`, `schema_version`, `created_by`, `updated_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`, `apply_state`, `applied_at`, `created_at`, `updated_at`.

3. Target indexes/constraints:
   - Unique active provider account by `(provider, provider_pub_id)` where disabled/unlinked is null or active.
   - Index `(user_id, provider)`, `(bot_instance_id)`, `(claim_state)`, and searchable normalized `provider_pub_id`.
   - Unique `(bot_provider_account_id, snapshot_at, source_adapter)` on `legacy_snapshot_runs`.
   - Child snapshot indexes on `(snapshot_run_id)`, `(bot_provider_account_id, snapshot_at)`, and symbol/stage where needed.
   - Unique config draft `(bot_instance_id, version)` or `(bot_instance_id, bot_provider_account_id, version)` depending final scoping.

4. Target server actions / API route map:
   - Current keep: `saveBotConfigAction`, `applyBotPresetAction`, `GET /api/bots/[bot]/config-export`, and journal review save action.
   - Add user action: claim/link existing Legacy `pub_id` for review, gated by user session, CSRF, active `legacy_bot` entitlement, Zod schema, and audit.
   - Add admin action: verify/link/unlink/disable provider account, gated by admin RBAC, CSRF, Zod schema, and audit.
   - Add admin read route/page: searchable provider-account inspector with safe DTOs only.
   - Add optional read API only if needed for downloads/export; prefer server actions and server loaders for app pages.
   - Do not add any live start/stop/apply-config route in this phase.

5. Target mock/dev adapter map:
   - Keep `BOT_ADAPTER_MODE=mock` as default and keep `botAdapterMode()` fail-safe to mock.
   - Keep Legacy mock for demo UI only; Legacy non-mock remains `createLegacyBlockedAdapter`.
   - For normalized DB work, add PGlite/dev seed helpers or repository fixtures that populate `bot_provider_accounts` and normalized snapshot tables without provider calls.
   - All demo/mock surfaces must keep storage/mode labels and never imply exchange connectivity.

6. Target migration plan:
   - Land one additive migration for provider accounts, normalized Legacy snapshots, and config drafts.
   - Do not drop `bot_metric_snapshots.raw_json` or existing snapshot tables. Backfill optional latest `legacy_snapshot_runs` from existing `rawJson.liveConfig` only if safe and useful.
   - Add repository functions before UI consumers: claim/list provider accounts, latest snapshots by account, insert normalized snapshot run with children, save/submit/review config draft, admin inspect with audit.
   - Add PGlite tests for scoping, uniqueness, in-transaction audit, no-secret payloads, and snapshot idempotency before any deploy.

## Risks
1. User/account leakage risk remains until product-code-only snapshot reads are replaced with user/provider scoped repository functions.
2. Raw JSON snapshot dependence will become brittle as Legacy settings grow; it is acceptable as a canary payload but not as the production query model.
3. Moving schemas out of `apps/web` will touch imports across settings, export, tests, and possibly worker/admin code; keep the package small and pure to avoid churn.
4. Provider `pub_id` is operational identity, not a secret, but it should still be minimized/masked in normal user UI and audited when inspected by admins.
5. Live apply is not part of this target map. A draft/apply-state table is for governance and future review only until bot-integration and security gates clear.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/implemented/next-action docs, and latest Phase 3.69 handoff.
- Read-only source inspection with `rg`/`Get-Content` across DB schema/repositories, migrations, bot adapters, worker, web bot features, admin features, audit docs, and contracts.
- `git status --short --branch` before handoff write showed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with no dirty files.
- `npx secretlint "docs/handoffs/20260603-bot-settings-platform-db.md"` passed for this handoff.
- Final worktree note after the handoff write: `git status --short --branch` also showed unrelated dirty files that changed outside this audit, including `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`, `apps/web/src/features/bots/config.ts`, `tests/integration/bot-read-safety-static.test.ts`, and untracked `docs/handoffs/20260603-legacy-bot-integration-auditor.md`. They were not edited by this audit and were left untouched.

NOT RUN:
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`: not run because this was a read-only architecture/DB map and only a handoff file was added.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`: not run because no schema/application code was changed and no DB mutation was allowed.
- Playwright/browser checks: not run because no UI/runtime code changed.
- Worker tick, live server checks, SSH/nginx/systemd/bot service checks, live bot start/stop/apply-config, provider calls: not run by scope and safety policy.

## Next actions
1. Start a new implementation phase for the DB/provider-account spine. Before edits, dispatch the required read-only agents per `docs/SESSION_PROTOCOL.md` if treating it as a broad/major phase.
2. Add the additive DB migration and repository tests first: `bot_provider_accounts`, normalized Legacy snapshot tables, and `bot_config_drafts`.
3. Move bot settings schemas/serializers into `packages/bot-settings` and update web imports without changing runtime semantics.
4. Update `apps/worker/src/legacy-live.ts` to iterate verified provider accounts and write normalized snapshot runs; keep current env/system-owner path as canary fallback until replaced.
5. Update `loadBotReadModel` and admin bot queries to read scoped repository DTOs, not latest product-level snapshots.
6. Add audit codes/docs for provider account claim/link/unlink/disable, config draft submit/review, snapshot ingest, and admin inspect.
7. Verify with focused PGlite tests, static no-secret tests, `npm run typecheck`, `npm run lint`, bot-read safety tests, and then broader gates before deploy.
