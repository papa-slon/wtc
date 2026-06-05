# admin-global-bot-config-platform-auditor handoff
## Scope
Read-only Phase 3.76 platform/data audit before implementing a separate admin global bot configuration/system-defaults surface for Tortila and Legacy bots.

This lane inspected the current WTC bot config storage, admin action/query/schema/type/page/nav boundaries, and user bot settings/config code. It did not edit product code, tests, migrations, live services, environment files, SSH, tmux, systemd, workers, provider databases, or bot controls.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- `docs/handoffs/20260603-1922-admin-bot-drilldown-platform-auditor.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `docs/ARCHITECTURE.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/entitlements/src/registry.ts`
- `packages/auth/src/rbac.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Existing `bot_configs` is per user-owned bot instance, so it is not safe storage for admin global/system defaults. Evidence: `bot_instances` requires `user_id` and product code at `packages/db/src/schema.ts:138-142`; `bot_configs` points only to `bot_instance_id` and current JSON config at `packages/db/src/schema.ts:177-182`; the original migration creates the same instance-owned shape at `packages/db/migrations/0000_broken_jack_murdock.sql:27-40` and adds the `bot_configs -> bot_instances` FK at `packages/db/migrations/0000_broken_jack_murdock.sql:192-195`; `ensureBotInstance()` is explicitly keyed by `(userId, productCode)` at `packages/db/src/repositories.ts:1665-1671`; `persistBotConfig()` creates/uses that user instance and calls `saveBotConfig()` with `changedBy: userId` at `apps/web/src/features/bots/config.ts:791-802`. Recommendation: do not fake global defaults with a system user, admin user, or hidden `bot_instances` row. Add a separate global defaults bounded context. Target part: `packages/db/src/schema.ts`, migrations, repositories.

2. Severity: High. Existing `bot_config_versions` is also instance-scoped history, not global defaults history. Evidence: `bot_config_versions` stores `bot_instance_id`, `version`, `config_json`, optional `changed_by`, and note at `packages/db/src/schema.ts:432-447`; migration `0002` creates the same table at `packages/db/migrations/0002_sour_paibok.sql:1-8`, FK to `bot_instances` and users at `packages/db/migrations/0002_sour_paibok.sql:231-232`, and unique `(bot_instance_id, version)` at `packages/db/migrations/0002_sour_paibok.sql:260-261`; `saveBotConfig()` bumps the per-instance version, writes current config, appends the version row, and audits `bot.config.save` with `actorRole: 'user'` at `packages/db/src/repositories.ts:1836-1849`. Recommendation: add `bot_global_configs` plus `bot_global_config_versions` (or equivalent names) with unique `(product_code, profile_key)` current rows and unique `(global_config_id, version)` or `(product_code, profile_key, version)` history. Target part: DB migration and repo tests.

3. Severity: High. The admin mutation pipeline exists, but there is no admin global bot-config action or schema today, and current RBAC treats bot config create/update as user-owned. Evidence: admin action protocol is documented in code as `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidatePath` at `apps/web/src/features/admin/actions.ts:1-8`; admin entitlement actions follow that pattern at `apps/web/src/features/admin/actions.ts:38-68`; account unlock requires DB and writes through a repository at `apps/web/src/features/admin/actions.ts:141-165`; current admin schemas cover product grants, Legacy provider mapping, and provider disable, but no global bot config schema at `apps/web/src/features/admin/schemas.ts:35-48` and `apps/web/src/features/admin/schemas.ts:96-112`; RBAC allows `bot_config` create/update only for `user`, while admin only reads/manages `bot_instance` separately at `packages/auth/src/rbac.ts:30-39`. Recommendation: add an admin-only global config resource/action boundary instead of reusing user `bot_config` mutation semantics. Target part: `packages/auth`, `apps/web/src/features/admin/{schemas,actions,types,queries}.ts`.

4. Severity: High. The existing admin bot pages are read-only diagnostics/drilldown surfaces, not a global defaults workbench. Evidence: admin nav includes `/admin/bots` but no `/admin/bots/config` at `apps/web/src/lib/nav.ts:20-32`; `/admin/bots` states all data is read-only and no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:29-43`; the page copy says live control/applyConfig is disabled at `apps/web/src/app/admin/bots/page.tsx:53-57` and runtime safety repeats that start/stop/live config apply are unavailable at `apps/web/src/app/admin/bots/page.tsx:91-109`; selected-user admin drilldown says saved WTC settings are read-only and admins cannot edit them there at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150-158`; provider mappings are also read-only on that page at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:328-333`. Recommendation: implement a separate `/admin/bots/config` route or equivalent admin section, with a nav entry, without adding edit controls to selected-user drilldown. Target part: admin IA/page/nav.

5. Severity: Medium. Product-specific validation and safe export helpers exist and should be reused, but the global defaults schema must reject user/provider-specific fields. Evidence: bot product codes are only `tortila_bot` and `legacy_bot` within the broader product registry at `packages/entitlements/src/registry.ts:6-13` and `packages/entitlements/src/registry.ts:24-31`; product-specific config schemas are exported via `botConfigSchemaFor()` at `apps/web/src/features/bots/config.ts:342-344`; defaults and presets are exported at `apps/web/src/features/bots/config.ts:350-359`; Legacy config schema currently permits optional `providerPubId` at `apps/web/src/features/bots/config.ts:67-70`; safe Legacy export explicitly deletes `providerPubId` at `apps/web/src/features/bots/config.ts:648-654`. Recommendation: validate global defaults with the existing product schemas plus an admin-global refinement that strips/rejects `providerPubId`, user ids, bot instance ids, exchange account ids, secrets, live URLs, and any apply token fields. Target part: admin schema and repository input validation.

6. Severity: Medium. Current admin DTOs are safe projections, but there is no DTO for global defaults/resolved config. Evidence: `apps/web/src/features/admin/types.ts` is DTO-only by design at `apps/web/src/features/admin/types.ts:1-4`; selected-user config summary exposes only version/source/symbol/risk summary fields at `apps/web/src/features/admin/types.ts:96-108`; provider account summaries use masked account ids at `apps/web/src/features/admin/types.ts:110-118`; the user bot loader selects raw `bot_configs.config` server-side but maps it into read-only summaries at `apps/web/src/features/admin/user-bot-detail-loader.ts:537-548` and `apps/web/src/features/admin/user-bot-detail-loader.ts:256-305`; Legacy metrics/trades are scoped to the active provider mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:377-438`. Recommendation: add separate DTOs such as `AdminBotGlobalConfigView`, `AdminBotGlobalConfigVersionView`, and `ResolvedBotConfigPreview`; do not overload `AdminUserBotSummary` or expose raw JSON on admin/user pages. Target part: `apps/web/src/features/admin/types.ts` and query mapper.

7. Severity: High. Global defaults must stay WTC-reference-only and never become live apply. Evidence: AGENTS forbids live bot start/stop/apply-config until safety audits pass at `AGENTS.md:74-82`; the seed hard rules forbid live bot control, SSH/tmux/systemd/env mutation, and making WTC an execution path at `docs/handoffs/0000-orchestrator-seed.md:113-124`; architecture says bot config saves write WTC DB only and are never forwarded until `BOT_ADAPTER_MODE=audited` at `docs/ARCHITECTURE.md:524-531`; user settings labels save behavior as "WTC version only" and "no live apply, start, stop, or retest" at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200-209`; exports say no exchange keys, secrets, or live-apply token at `apps/web/src/features/bots/config.ts:675-692` and `apps/web/src/features/bots/config.ts:701-704`. Recommendation: global defaults save must not call adapters, workers, provider DBs, export routes, live controls, or `persistBotConfig()`/`saveBotConfig()`. It should write only global default tables plus audit logs. Target part: repository and server action implementation.

## Decisions
1. Existing tables do not safely support admin global/system defaults. A new additive migration is needed.

2. Recommended schema model:
   - `bot_global_configs`: `id`, `product_code`, `profile_key`, `label`, `status`, `version`, `config_json`, `schema_version`, `created_by`, `updated_by`, `created_at`, `updated_at`.
   - `bot_global_config_versions`: `id`, `global_config_id`, `product_code`, `profile_key`, `version`, `config_json`, `schema_version`, `changed_by`, `change_reason`, `created_at`.
   - Add checks for `product_code IN ('tortila_bot','legacy_bot')`, non-empty `profile_key`, status such as `draft | active | retired`, unique current `(product_code, profile_key)`, and unique version history.

3. Global defaults should be product/profile owned, not user owned. They should not reference `bot_instances`, `bot_configs`, `bot_config_versions`, `exchange_accounts`, `bot_provider_accounts`, entitlements, provider pub_id rows, or live adapter state.

4. Repository boundary should be explicit: `listBotGlobalConfigs()`, `getBotGlobalConfig(productCode, profileKey)`, `saveBotGlobalConfig({ productCode, profileKey, config, actorUserId, reason })`, and `listBotGlobalConfigVersions(...)`. The save repository should run in one transaction: read current row, bump version, upsert current row, append version row, insert audit row.

5. Audit action names should be added before implementation, for example `bot.global_config.save` and optionally `bot.global_config_version_created`, with `targetType: 'bot_global_config'`. The `before`/`after` payloads should contain version/profile/status summaries, not full secrets or raw provider material.

6. Admin action boundary should be: `requireUser()` -> `assertAdmin(actor.roles)` -> `assertCsrf(formData)` -> Zod admin schema -> `botConfigSchemaFor(productCode)` validation plus global-only refinement -> global config repository -> `revalidatePath('/admin/bots/config')` and `revalidatePath('/admin/audit-log')`.

7. Demo mode should be read-only for global defaults. Unlike user settings demo memory at `apps/web/src/features/bots/config.ts:752-802`, admin system defaults need durable audit/history; if `getServerDb()` returns null, the page can show built-in code defaults but save should be disabled or throw "Database is required for global bot defaults".

8. User-owned settings stay unchanged. Future resolved-config reads can compose `global default + profile default + personal override + per-symbol override`, but they must not overwrite `bot_configs`. A future "copy default into my profile" action, if desired, should be a user action that creates a normal user config version with the user as actor and an explicit note.

## Risks
1. Migration/order risk: the worktree already contains recent uncommitted migrations through `0019_freezing_beyonder.sql`; implementers must verify the current Drizzle journal before generating the next migration.

2. Concurrency risk: current user `saveBotConfig()` increments a version inside a transaction and relies on unique history for collisions at `packages/db/src/repositories.ts:1838-1848`; the new global repository should add explicit unique indexes and a collision test so two admin saves cannot silently overwrite one version.

3. Provider identity leakage risk: Legacy schemas can carry `providerPubId` but global defaults must not. Keep provider pub_id mapping in `bot_provider_accounts`; admin global defaults should store generic rows only.

4. Silent fallback risk: form helpers can default rows when no valid parsed rows survive at `apps/web/src/features/bots/config.ts:476-507` and `apps/web/src/features/bots/config.ts:510-522`. The global defaults action should reject malformed/empty submissions using `botConfigFormIssues()` and schema parsing, not silently convert a failed admin save into built-in defaults.

5. Product semantics risk: Tortila and Legacy share UI primitives but not strategy vocabulary. The existing UX handoff separates global defaults, bot profile defaults, personal overrides, resolved config, and runtime snapshots at `docs/handoffs/20260603-bot-settings-ux-product.md:99-110`; keep those terms in the implementation.

6. Live-control boundary risk: a "system defaults" page could be misread as "apply to all live bots". The page and action should state and enforce that changes affect WTC reference/resolved defaults only and do not call live apply.

## Verification/tests
RUN:
1. Required protocol/status handoff documents were read.
2. Read-only `git status --short --branch` was run; the worktree was already substantially dirty from adjacent Phase 3.x work before this lane.
3. Read-only source inspection was run with `rg`, `Get-Content`, and directory listings.
4. No agents were spawned from this lane, so no background agents are left running from this lane.

NOT RUN:
1. Product code edit - forbidden by scope.
2. Test edit or test execution - skipped because this is a read-only audit.
3. Migration generation, migration apply, seed, or DB mutation - forbidden by scope.
4. Live services, SSH, tmux, systemd, worker tick/restart, provider DB read/write, `.env` read/write, or bot control - forbidden by scope.
5. Browser/Playwright verification - not applicable to this read-only platform/data audit.

## Next actions
1. Add the DB migration and schema objects for `bot_global_configs` and `bot_global_config_versions`; update Drizzle meta and package exports.

2. Add repository functions and PGlite tests for create/update/list/version history/audit, invalid product/profile rejection, provider-field rejection, and concurrent admin save behavior.

3. Add admin schemas/actions/types/queries for the global defaults page using the existing admin pipeline and product-specific config schemas, with DB required for saves.

4. Add `/admin/bots/config` and a nav entry from `/admin/bots`; keep `/admin/users/[userId]/bots` read-only and do not add user-setting edit controls there.

5. Add static/integration tests that the global defaults action does not import or call `persistBotConfig`, `saveBotConfig`, `getBotAdapter`, worker jobs, provider DB code, live-control helpers, or config export routes.

6. Add a resolved-config read model later only after the global default table exists; it should label inherited system defaults separately from saved user overrides and never imply live runtime config.
