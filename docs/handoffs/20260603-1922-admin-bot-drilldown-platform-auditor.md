# ecosystem-platform-architect handoff
## Scope
Phase 3.74 read-only platform audit for admin bot drilldown data flow.

Mapped:
- how `/admin/users` links to a selected user's bot detail page;
- how the current admin loader reads selected-user identity, entitlements, config summaries, latest metrics, safe exchange metadata, and Legacy provider-account mappings;
- how broader positions/trades/equity are currently sourced by the user bot read model, not the admin drilldown DTO;
- where source of truth lives today;
- where global admin bot configuration should live later.

No product code, tests, migrations, worker files, live services, provider systems, secrets, environment probes, or live bot controls were edited or called. This is the single assigned platform-auditor handoff only.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-integration-auditor.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/data.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`

## Files changed
- `docs/handoffs/20260603-1922-admin-bot-drilldown-platform-auditor.md` only.

## Findings
1. Severity: PASS. The admin user directory now links each listed user to a target-user bot drilldown and both surfaces are server-side admin gated.
   Evidence: `/admin/users` calls `requireUser()`, `assertAdmin(actor.roles)`, and `loadAdminUsers()` at `apps/web/src/app/admin/users/page.tsx:19` to `apps/web/src/app/admin/users/page.tsx:23`; each row renders `Link href={`/admin/users/${u.id}/bots`}` at `apps/web/src/app/admin/users/page.tsx:115` to `apps/web/src/app/admin/users/page.tsx:119`; the detail page repeats `requireUser()` and `assertAdmin()` before loading `loadAdminUserBotDetail(userId)` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:33` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:38`.
   Recommendation: keep the selected user as the route segment and keep RBAC inside the route, not only in navigation.
   Target part: `/admin/users` and `/admin/users/[userId]/bots`.

2. Severity: PASS. The current admin drilldown loader is target-user scoped for the WTC-owned facts it actually returns.
   Evidence: target user select omits `passwordHash` at `apps/web/src/features/admin/user-bot-detail-loader.ts:240` to `apps/web/src/features/admin/user-bot-detail-loader.ts:254`; roles, entitlements, bot instances, exchange metadata, and provider mappings all filter by the selected `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:260` to `apps/web/src/features/admin/user-bot-detail-loader.ts:314`; config and metric reads are constrained to `instanceIds` produced from target-owned `bot_instances` at `apps/web/src/features/admin/user-bot-detail-loader.ts:317` to `apps/web/src/features/admin/user-bot-detail-loader.ts:346`; access is evaluated through `explainAccess()` at `apps/web/src/features/admin/user-bot-detail-loader.ts:353` to `apps/web/src/features/admin/user-bot-detail-loader.ts:365` and `apps/web/src/features/admin/user-bot-detail-loader.ts:392` to `apps/web/src/features/admin/user-bot-detail-loader.ts:406`.
   Recommendation: preserve this ownership spine: selected user -> entitlements -> target-owned bot_instances -> safe exchange metadata/config summaries/snapshots.
   Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts`.

3. Severity: PASS WITH BOUNDARY. Legacy provider-account scoping is implemented for the admin drilldown's latest metric summary, but only after an active mapping exists.
   Evidence: provider mappings are selected from `bot_provider_accounts` for the target user at `apps/web/src/features/admin/user-bot-detail-loader.ts:300` to `apps/web/src/features/admin/user-bot-detail-loader.ts:314`; active mappings are reduced by bot instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:371` to `apps/web/src/features/admin/user-bot-detail-loader.ts:376`; Legacy metric rows are skipped unless `row.botProviderAccountId === activeProvider.id` at `apps/web/src/features/admin/user-bot-detail-loader.ts:381` to `apps/web/src/features/admin/user-bot-detail-loader.ts:386`; the DB schema carries provider-account linkage on metrics, positions, trades, and safety at `packages/db/src/schema.ts:452` to `packages/db/src/schema.ts:534` and `packages/db/src/schema.ts:568` to `packages/db/src/schema.ts:588`.
   Recommendation: keep null `bot_provider_account_id` rows as fleet/canary diagnostics only, and keep admin target-user runtime facts gated by the active mapping id.
   Target part: admin user drilldown loader and DB snapshot read rules.

4. Severity: GAP. The admin drilldown does not currently read positions, trades, or an equity curve; it reads config summary plus latest metric summary only.
   Evidence: `AdminUserBotSummary` contains `configSummary` and `latestMetric`, but no positions/trades/equity fields at `apps/web/src/features/admin/types.ts:75` to `apps/web/src/features/admin/types.ts:90`; the loader queries `schema.botConfigs` and `schema.botMetricSnapshots` only for per-bot detail rows at `apps/web/src/features/admin/user-bot-detail-loader.ts:317` to `apps/web/src/features/admin/user-bot-detail-loader.ts:346`; the detail page renders saved config summary and metric cards at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:143` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:210`. The broader user bot read model already has positions/trades/equity parts and provider-account filters at `apps/web/src/features/bots/data.tsx:346` to `apps/web/src/features/bots/data.tsx:355` and `apps/web/src/features/bots/data.tsx:411` to `apps/web/src/features/bots/data.tsx:530`.
   Recommendation: if Phase 3.74 acceptance requires admin positions/trades/equity, add explicit admin DTO fields and queries for them, scoped through the same target `bot_instances` and, for Legacy, the same active provider-account id. Do not claim the current admin drilldown covers those data sets.
   Target part: admin drilldown DTO/loader/page/tests.

5. Severity: MEDIUM. Config summaries are now derived from `bot_configs.config`, which is the correct current-user reference source, but this must remain an allowlisted projection.
   Evidence: `bot_configs` is documented as the current head of config history at `docs/DATA_MODEL.md:382` to `docs/DATA_MODEL.md:398`; the loader selects `schema.botConfigs.config` at `apps/web/src/features/admin/user-bot-detail-loader.ts:317` to `apps/web/src/features/admin/user-bot-detail-loader.ts:328`; `mapConfigSummary()` extracts symbols, operation mode, stage capacity, and risk text without returning raw config at `apps/web/src/features/admin/user-bot-detail-loader.ts:169` to `apps/web/src/features/admin/user-bot-detail-loader.ts:217`; static tests require `schema.botConfigs.config` but still forbid `schema.botConfigVersions`, `passwordHash`, and `exchangeApiKeySecrets` at `tests/integration/admin-user-bot-detail-static.test.ts:16` to `tests/integration/admin-user-bot-detail-static.test.ts:39`.
   Recommendation: keep raw config out of the DTO. If version history becomes part of the admin page, add a separate safe history summary that never returns `bot_config_versions.config_json`.
   Target part: config summary DTO and tests.

6. Severity: MEDIUM. Current config selection still relies on the application-level assumption that `bot_configs` has one row per bot instance.
   Evidence: the live schema defines `bot_configs` without a unique index at `packages/db/src/schema.ts:177` to `packages/db/src/schema.ts:183`; the data model notes `bot_instance_id` uniqueness is application-enforced, not DB-enforced, at `docs/DATA_MODEL.md:382` to `docs/DATA_MODEL.md:398`; the loader orders configs descending then builds `new Map(configRows.map(...))`, which would let a later duplicate row overwrite an earlier one for the same instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:317` to `apps/web/src/features/admin/user-bot-detail-loader.ts:328` and `apps/web/src/features/admin/user-bot-detail-loader.ts:366` to `apps/web/src/features/admin/user-bot-detail-loader.ts:368`.
   Recommendation: either add a DB unique index on `bot_configs.bot_instance_id` in a migration, or reduce config rows by "first row per instance" after ordering so duplicates cannot select an older row.
   Target part: `packages/db/src/schema.ts`, migrations, or loader reducer.

7. Severity: MEDIUM. Provider mapping controls are correctly separated from user-owned settings and live bot control, but they are not pure read-only UI.
   Evidence: the detail page labels user settings read-only and system mapping controls separately at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:43` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57`; the mapping form says it does not edit saved settings, exchange keys, live bot config, start/stop state, or open positions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:221` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:250`; server actions require session, admin, CSRF, Zod, and audited DB repository calls at `apps/web/src/features/admin/actions.ts:347` to `apps/web/src/features/admin/actions.ts:418`; repository map/disable writes audit rows in transactions at `packages/db/src/repositories.ts:1705` to `packages/db/src/repositories.ts:1821`.
   Recommendation: keep calling this "system provider mapping", not "admin editing user bot settings". Add richer proof metadata later before treating active mappings as production-grade onboarding.
   Target part: admin mapping actions, provider-account schema, audit policy.

8. Severity: GAP. The route still collapses disabled/needs-review/no-mapping Legacy states into a single pending bot-level scope.
   Evidence: `AdminUserProviderAccountSummary.status` can be `active`, `disabled`, or `needs_review` at `apps/web/src/features/admin/types.ts:65` to `apps/web/src/features/admin/types.ts:73`, but `AdminUserBotSummary.providerScope` is only `user_scoped | provider_account_mapped | provider_account_pending` at `apps/web/src/features/admin/types.ts:75` to `apps/web/src/features/admin/types.ts:90`; the loader only picks active mappings and otherwise returns pending at `apps/web/src/features/admin/user-bot-detail-loader.ts:371` to `apps/web/src/features/admin/user-bot-detail-loader.ts:418`; prior UX guidance calls for distinct mapped, unmapped, disabled, and needs-review states at `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md:96` to `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md:100`.
   Recommendation: extend the bot-level state model before exposing richer Legacy runtime facts or admin decision flows.
   Target part: admin detail DTO, labels, PGlite fixtures, Playwright selectors.

9. Severity: DECISION. Global admin bot configuration should not live in `bot_configs` for a selected user and should not be implemented through this drilldown.
   Evidence: architecture states bot config saves write WTC DB only and are not forwarded live at `docs/ARCHITECTURE.md:524` to `docs/ARCHITECTURE.md:531`; the target admin IA names `/admin/bots/config` for global defaults, hard caps, key-test policy, and safety gates at `docs/handoffs/20260603-bot-settings-ux-product.md:99` to `docs/handoffs/20260603-bot-settings-ux-product.md:102`; the same handoff defines "System default" as global WTC baseline distinct from personal override at `docs/handoffs/20260603-bot-settings-ux-product.md:104` to `docs/handoffs/20260603-bot-settings-ux-product.md:110`; Phase 3.73 left "Admin global system-configuration UI completion" as not run and next action at `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md:93` to `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md:104`.
   Recommendation: add a separate admin global defaults bounded context, for example `/admin/bots/config` backed by versioned `@wtc/db` tables such as `bot_global_configs`/`bot_global_config_versions` or equivalent. It should audit every change, compose into resolved WTC reference settings, and clearly state "no live apply". Do not overload user-owned `bot_configs` or provider-account mappings.
   Target part: Phase 3.74 global admin config architecture.

## Decisions
1. Current selected-user admin flow:
   `/admin/users` safe user list -> `Bot details` link -> `/admin/users/[userId]/bots` -> `loadAdminUserBotDetail(userId)` -> `loadAdminUserBotDetailFromDb(db, userId)`.

2. Current admin source truth:
   - User identity/roles: `users` plus `user_roles`, target-selected and password-hash-free.
   - Access: `entitlements` rows evaluated through `@wtc/entitlements` `explainAccess()`.
   - User-owned bot existence: `bot_instances.user_id + product_code`.
   - Saved user WTC config: current `bot_configs` row, projected through `mapConfigSummary()` only.
   - Config history: `bot_config_versions`, not currently read by admin drilldown.
   - Safe exchange metadata: `exchange_accounts`, never `exchange_api_key_secrets`.
   - Latest admin drilldown metric: `bot_metric_snapshots`, target instance only; Legacy additionally requires matching active `bot_provider_accounts.id`.
   - Positions/trades/equity: not part of current admin DTO. Current user-facing source is `loadBotReadModelForUser()`, which uses `bot_position_snapshots`, `bot_trade_imports`, and metric-derived equity when requested.
   - Fleet diagnostics: `/admin/bots` still reads global/fleet Legacy raw snapshot data from latest metric `rawJson.liveConfig`; do not reuse that as selected-user truth.

3. Global admin config should be a new admin/system defaults surface under `/admin/bots/config` or equivalent, with its own versioned DB records and audit semantics. It is not the selected user's `bot_configs` row and not a provider-account mapping.

## Risks
1. Product wording can overclaim if "bot details" is interpreted as positions/trades/equity today. The current admin page is safer but narrower.
2. If a future admin query copies `/admin/bots` fleet diagnostics, it can reintroduce global Legacy `pub_id` data into a selected-user page.
3. Config summary now reads raw current config internally. That is acceptable only while the DTO remains allowlisted and tests keep raw markers out of JSON.
4. Duplicate `bot_configs` current rows are not DB-impossible today; this can make config summary selection nondeterministic.
5. Full provider `pub_id` is still rendered to admins in target-user mapping and fleet diagnostics. It is not an exchange key, but future policy may require mask/reveal/audited inspect.
6. The worktree changed during this audit from parallel Phase 3.74 activity. Final source observations are based on the re-read and green focused test run after those changes appeared.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - repository is git-backed on branch `codex/bot-analytics-settings-canary-20260603`; many pre-existing modified/untracked Phase 3 files and handoffs were observed and left untouched.
2. Read-only inspection with `Get-Content`, `Get-ChildItem`, and `rg` over the files listed above.
3. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - initial run failed while the worktree was changing around safe-note wording; after re-reading current files, the same command passed: 2 files, 6 tests.

NOT RUN in this audit:
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, Playwright, full `npm test`, or full gates - not run because this task was a read-only platform audit plus one handoff, not implementation acceptance.
2. DB migrations/seeds/managed Postgres gates - not run.
3. Worker tick, worker smoke, live bot continuity, live provider DB reads, exchange ping/test, SSH, Docker, tmux/systemd/process control, live start/stop/retest/apply-config, or environment/secret probes - forbidden by scope and not run.

## Next actions
1. Decide whether Phase 3.74 admin drilldown must include positions/trades/equity. If yes, add explicit admin DTOs and PGlite fixtures for those tables with Legacy provider-account scoping.
2. Add deterministic current-config selection or a DB unique index for `bot_configs.bot_instance_id`.
3. Extend Legacy provider state taxonomy to distinguish active mapped, unmapped, disabled, and needs_review/ambiguous.
4. Design `/admin/bots/config` as a separate versioned global defaults surface with audit rows and no live apply.
5. Add focused tests for any new admin runtime detail fields, then run typecheck, lint, secret scan, web build, and admin desktop/mobile Playwright before aggregate acceptance.
