# admin-global-bot-config-security-auditor handoff
## Scope
Read-only Phase 3.76 security/RBAC audit before implementation of an admin global bot configuration/system-defaults surface for Legacy and Tortila.

This lane did not edit product code, tests, migrations, live services, `.env`, provider configuration, or secrets. It did not access live providers and did not run live bot control, exchange tests, SSH, tmux, systemd, worker ticks, or adapter probes.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/csrf.tsx`
- `packages/auth/src/rbac.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: Critical. Evidence: Phase 3.75 explicitly leaves "separate admin global bot configuration/system-defaults" as Phase 3.76 and says it is "explicitly not user-owned settings" at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:86` to `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:87`; current `bot_instances` and `bot_configs` are user/instance-owned at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:183`; current saves call `persistBotConfig(user.id, ...)` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:112` and `persistBotConfig()` ensures a user bot instance at `apps/web/src/features/bots/config.ts:791` to `apps/web/src/features/bots/config.ts:802`. Recommendation: implement global defaults as a separate admin-owned/versioned model keyed by `productCode`/profile, not by synthetic user, not by a target user's `bot_instance`, and not by `exchangeAccountId`. Target part: DB schema/repositories and `/admin/bots/config`.

2. Severity: Critical. Evidence: admin mutations must follow `requireUser() -> assertAdmin(roles) -> assertCsrf(formData) -> Zod -> repo (in-txn audit)` at `apps/web/src/features/admin/actions.ts:3` to `apps/web/src/features/admin/actions.ts:8`; CSRF hidden fields and fail-closed validation are required for authenticated mutating server actions at `docs/SECURITY_MODEL.md:106` to `docs/SECURITY_MODEL.md:126`; `assertAdmin()` must be the first statement of admin-only server actions at `packages/auth/src/rbac.ts:89` to `packages/auth/src/rbac.ts:94`; admin route contracts require every mutating admin action to be audited at `docs/RBAC_MATRIX.md:226` to `docs/RBAC_MATRIX.md:239`. Recommendation: every global-default create/update/archive action must start from the current session actor, call `assertAdmin(actor.roles)`, call `assertCsrf(formData)`, validate with a dedicated Zod schema, require a 10+ character admin reason, and write the mutation plus audit row in one DB transaction. Support may view a read-only subset only if explicitly allowed; support must not mutate. Target part: admin server actions, schemas, repository transaction.

3. Severity: High. Evidence: current `adminMutationReason` is min 10 at `apps/web/src/features/admin/schemas.ts:18` to `apps/web/src/features/admin/schemas.ts:25`, and RBAC_MATRIX says admin grant/revoke/unlock reason is min 10 at `docs/RBAC_MATRIX.md:298` to `docs/RBAC_MATRIX.md:300`; however existing grant/revoke schemas still use min 3 at `apps/web/src/features/admin/schemas.ts:35` to `apps/web/src/features/admin/schemas.ts:55`. Recommendation: do not copy the older min-3 grant/revoke pattern into global defaults; use `adminMutationReason` or a new equivalent `z.string().trim().min(10).max(500)` for every default change and include the validated reason in the audit payload summary. Target part: `apps/web/src/features/admin/schemas.ts` and new action tests.

4. Severity: Critical. Evidence: all bot controls are disabled by default and cannot be enabled by Phase 0-3 environment config at `docs/BOT_CONTROL_SAFETY_MODEL.md:13` to `docs/BOT_CONTROL_SAFETY_MODEL.md:24`; prohibited actions include SSH, systemctl/service, tmux/screen, process kill, `.env` mutation, exchange order calls, reading/logging bot exchange keys, clearing bot DB state, and overwriting bot config files at `docs/BOT_CONTROL_SAFETY_MODEL.md:31` to `docs/BOT_CONTROL_SAFETY_MODEL.md:43`; write config/start/stop/SSH/.env/order/key reads are forbidden until all gates pass at `docs/BOT_CONTROL_SAFETY_MODEL.md:253` to `docs/BOT_CONTROL_SAFETY_MODEL.md:267`; Phase 3.75 did not run start/stop/restart/retest/exchange ping/apply-config/SSH/tmux/systemd/provider mutation/live adapter probes at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:11` and `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:84`. Recommendation: the Phase 3.76 UI and actions must not include `Start`, `Stop`, `Restart`, `Apply to bot`, `applyConfig`, `Retest`, `Test exchange`, `Ping exchange`, live provider probe, worker tick, process control, `.env` write, or direct bot config push. It may save WTC-side defaults and show read-only safety status only. Target part: `/admin/bots/config` UI, route/action names, static forbidden-string tests.

5. Severity: High. Evidence: WTC config saves are WTC DB-only and never forwarded to the live bot until an audited adapter exists at `docs/ARCHITECTURE.md:526` to `docs/ARCHITECTURE.md:530`; current `saveBotConfig()` writes `bot_configs`, appends `bot_config_versions`, and audits in one transaction, explicitly "NEVER forwarded to the live bot" at `packages/db/src/repositories.ts:1836` to `packages/db/src/repositories.ts:1849`. Recommendation: global-default saves must be WTC DB-only, versioned, and non-applying. Any later runtime propagation is a separate phase requiring security + bot-integration audits, CSRF/rate-limit gates, diff confirmation, and separate restart/stop confirmation where applicable. Target part: global default repository and copy.

6. Severity: High. Evidence: no plaintext secrets are allowed in DB/logs/audit/errors/screenshots/fixtures/browser/API responses at `docs/SECRET_VAULT_DESIGN.md:24` to `docs/SECRET_VAULT_DESIGN.md:33`; exchange-key UI responses may return only `key_mask` and never echo plaintext at `docs/SECRET_VAULT_DESIGN.md:283` to `docs/SECRET_VAULT_DESIGN.md:286`; `exchange_api_key_secrets` stores sealed vault JSON only, never plaintext, at `packages/db/src/schema.ts:130` to `packages/db/src/schema.ts:133`; selected-user admin exchange-key UI renders only label/exchange/mode/keyMask at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:191` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:198` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:362` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:378`. Recommendation: global defaults must never include or display `apiKey`, `apiSecret`, `secret`, `password`, `token`, `authorization`, `cookie`, `sealed`, `keyId`, `wrappedDek`, vault payloads, provider DB URLs, journal URLs, raw headers, stack traces, or live credentials. Target part: Zod schema, DTO, audit payload, UI, tests.

7. Severity: High. Evidence: audit action codes must be added to `AUDIT_ACTIONS` before a route writes them at `docs/AUDIT_LOG_SCHEMA.md:130` to `docs/AUDIT_LOG_SCHEMA.md:133`; existing bot config actions cover user config saves/version deletes and mock enable/disable at `docs/AUDIT_LOG_SCHEMA.md:162` to `docs/AUDIT_LOG_SCHEMA.md:170`; audit snapshot rules forbid full row dumps and specifically say `bot.config.save` uses only version metadata with no raw config JSON at `docs/AUDIT_LOG_SCHEMA.md:312` to `docs/AUDIT_LOG_SCHEMA.md:323`. Recommendation: add explicit action codes such as `bot.system_default.save`, `bot.system_default.archive`, and optionally `bot.system_default.publish` before implementation, and write redacted before/after summaries with product code, version, profile id/name, changed field names/counts, reason, and safety policy flags. Do not audit full config JSON or raw diff values if they can contain future sensitive fields. Target part: `packages/audit/src/audit.ts`, `docs/AUDIT_LOG_SCHEMA.md`, DB repository.

8. Severity: High. Evidence: all access decisions must flow through `packages/entitlements` and fail closed at `docs/ENTITLEMENT_STATE_MACHINE.md:6` to `docs/ENTITLEMENT_STATE_MACHINE.md:8`, `docs/ENTITLEMENT_STATE_MACHINE.md:26` to `docs/ENTITLEMENT_STATE_MACHINE.md:27`, and `docs/ENTITLEMENT_STATE_MACHINE.md:271` to `docs/ENTITLEMENT_STATE_MACHINE.md:280`; server actions/route handlers must await access server-side and client state is cosmetic at `docs/ENTITLEMENT_STATE_MACHINE.md:315` to `docs/ENTITLEMENT_STATE_MACHINE.md:317`; bot pages hard-gate data on `accessFor` at `docs/ENTITLEMENT_STATE_MACHINE.md:519` to `docs/ENTITLEMENT_STATE_MACHINE.md:521`; current `botAccessForUser()` grants admin override but regular users go through `accessFor()` at `apps/web/src/lib/access.ts:5` to `apps/web/src/lib/access.ts:14`. Recommendation: global defaults must not grant product access, bypass entitlement checks, or make unentitled user bot data render. Admin may manage defaults by role, but any user-facing resolved config or default preview must still be behind server-side bot entitlement checks, except admin-only pages guarded by `assertAdmin()`. Target part: resolved-config loaders and user bot pages.

9. Severity: High. Evidence: current user bot settings use product-specific Zod schemas with explicit min/max bounds for Tortila at `apps/web/src/features/bots/config.ts:32` to `apps/web/src/features/bots/config.ts:65` and Legacy at `apps/web/src/features/bots/config.ts:67` to `apps/web/src/features/bots/config.ts:126`; global UX target warns not to fake system config by editing a user config and calls for a separate `/admin/bots/config` surface at `docs/handoffs/20260603-bot-settings-ux-product.md:67` to `docs/handoffs/20260603-bot-settings-ux-product.md:68` and `docs/handoffs/20260603-bot-settings-ux-product.md:100` to `docs/handoffs/20260603-bot-settings-ux-product.md:105`. Recommendation: implement a dedicated global-default Zod schema that reuses/tightens these existing safe fields instead of accepting arbitrary JSON. It should reject unknown keys with `.strict()` and derive summary strings server-side. Target part: shared/admin schemas and static tests.

10. Severity: High. Evidence: Legacy row schema currently has optional `providerPubId` at `apps/web/src/features/bots/config.ts:67` to `apps/web/src/features/bots/config.ts:70`, but safe export deletes `providerPubId` before emitting Legacy config at `apps/web/src/features/bots/config.ts:648` to `apps/web/src/features/bots/config.ts:654`; selected-user admin masks provider account ids at `apps/web/src/features/admin/user-bot-detail-loader.ts:202` to `apps/web/src/features/admin/user-bot-detail-loader.ts:205` and `apps/web/src/features/admin/user-bot-detail-loader.ts:307` to `apps/web/src/features/admin/user-bot-detail-loader.ts:324`; Phase 3.75 keeps full provider account ids out of normal admin DTO/UI at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:53` to `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:57`. Recommendation: global Legacy defaults must not store `providerPubId`, `providerAccountId`, `pubId`, `providerAccounts`, `activeSlots`, `activeOrderSummary`, `liveConfig`, or `rawJson`. Provider mapping remains user/admin mapping, not a global default. Target part: Legacy default schema and tests.

11. Severity: Medium. Evidence: current `/admin/bots` is read-only and states no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:29` to `apps/web/src/app/admin/bots/page.tsx:57`, but the same page renders full Legacy `pub_id`/balance/slot/order data from raw snapshot diagnostics at `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:290` and its loader reads `rawJson.liveConfig` at `apps/web/src/features/admin/queries.ts:436` to `apps/web/src/features/admin/queries.ts:480`. Recommendation: do not use the fleet inspector/raw snapshot path as the source of editable system defaults. The global default editor should source from its own versioned rows and show only masked identifiers or no identifiers at all. If full provider inspection remains necessary, require a separate audited reveal/inspect action with reason. Target part: admin bots route split and DTOs.

12. Severity: Medium. Evidence: the current user config export route is entitlement-gated and can export safe Tortila/Legacy reference config at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:8` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:35`; Tortila export says no keys/secrets/live-apply token at `apps/web/src/features/bots/config.ts:675` to `apps/web/src/features/bots/config.ts:692`; Legacy export says no exchange keys or live apply token at `apps/web/src/features/bots/config.ts:695` to `apps/web/src/features/bots/config.ts:731`. Recommendation: if Phase 3.76 adds admin default export/preview, keep it GET side-effect-free, `assertAdmin()` gated if admin-only, no live adapter read, no `loadBotReadModelForUser()` fallback, and output only the same safe fields. Target part: optional admin export/preview route.

## Decisions
1. Required RBAC/CSRF/Zod pipeline for global defaults: `requireUser()` -> `assertAdmin(actor.roles)` -> `assertCsrf(formData)` -> dedicated strict Zod schema -> repository transaction -> audit row in the same transaction -> `revalidatePath('/admin/bots')`, `revalidatePath('/admin/bots/config')`, and `revalidatePath('/admin/audit-log')`.
2. Required entitlement rule: admin default management is role-gated, but it does not grant access. User-facing resolved/default config is rendered only after server-side bot entitlement (`tortila_bot` or `legacy_bot`) allows access, except admin-only inspection pages guarded by `assertAdmin()`.
3. Required audit rule: use new explicit system-default audit codes before implementation. Audit summary may include `productCode`, `profileId`, `profileName`, `versionBefore`, `versionAfter`, `changedKeys`, `changedKeyCount`, `reason`, `createdBy/updatedBy`, and safety booleans. It must not include raw full config JSON, secrets, provider IDs, URLs, headers, stack traces, or live runtime snapshots.
4. Required no-secret rule: no plaintext exchange secrets, sealed vault records, provider DB URLs, journal base URLs, tokens, authorization headers, cookies, passwords, `providerPubId`, `providerAccountId`, raw `pubId`, or `rawJson` fields in payloads, DTOs, UI, logs, audit, tests, screenshots, or exports.
5. Required no-live-control rule: global defaults are WTC-side reference/config inheritance only. No start, stop, restart, retest, exchange connection test, live apply, worker tick, provider DB mutation, `.env` write, SSH, tmux, systemd, process control, mark-price call, or exchange order/key read.
6. Required user-setting separation: do not call `persistBotConfig()`, `saveBotConfig()` with a user's `botInstanceId`, `ensureBotInstance()` for a synthetic admin user, or `loadBotConfig(userId, productCode)` for global defaults. Use a separate global defaults table/repository/DTO.
7. Safe Tortila global-default allowlist: `productCode = 'tortila_bot'`, `profileId`, `profileName`, `status` (`draft`/`published`/`archived` if modelled), `operationMode` (`manual`/`auto` as WTC intent only), `symbolConfigs[]` with `symbol`, `timeframe`, `system`, `riskPercent`, `stopN`, `addStep`, `maxUnits`, `atrPeriod`, `takeProfitRr`, plus portfolio caps `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, `maxNewEntriesPerTick`, and admin `reason`. Derive `symbols` server-side from `symbolConfigs`.
8. Safe Legacy global-default allowlist: `productCode = 'legacy_bot'`, `profileId`, `profileName`, `status`, `operationMode`, `apiProfile` as a human label only, `maxSymbols`, `defaultTimeframe`, `defaultTakeProfitPercent`, `defaultInitialEntryPercent`, `defaultUseBalancePercent`, `defaultLeverage`, `symbolConfigs[]` with symbol/signal/timeframe/risk/averaging/stage fields from the existing Legacy Zod schema except `providerPubId`, and `stageConfigs[]` with `stage`, `rsiSlots`, `cciSlots`, plus admin `reason`. Derive `symbols` server-side from `symbolConfigs`.
9. Forbidden global-default payload keys: `apiKey`, `apiSecret`, `secret`, `password`, `passwordHash`, `token`, `authorization`, `cookie`, `sealed`, `keyId`, `wrappedDek`, `vaultRecord`, `credentials`, `providerPubId`, `providerAccountId`, `pubId`, `providerAccounts`, `liveConfig`, `rawJson`, `raw_json`, `activeSlots`, `activeOrderSummary`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_URL`, adapter URLs, headers, stack traces, `applyConfig`, `start`, `stop`, `restart`, `retest`, `testExchange`.

## Risks
1. There is no current DB model for global/default bot config; implementing it by reusing user `bot_configs` would create ownership, audit, entitlement, and inheritance confusion.
2. Current admin fleet diagnostics still render full Legacy `pub_id` data from raw snapshots; copying that DTO/source into the global defaults editor would leak provider identifiers into a configuration surface.
3. `bot.config.save` audit semantics are user/instance-oriented; using that action code for global defaults would obscure who changed a system baseline and which users/configs inherit from it.
4. Future "Test exchange" and "Apply config" UX are security-sensitive live-provider/control paths and remain out of scope until separately approved.
5. Existing grant/revoke reason schema drift (min 3 vs documented min 10) can spread if implementers copy the older schema instead of `adminMutationReason`.

## Verification/tests
RUN:
1. Read-only file and source inspection only.
2. Confirmed latest Phase 3.75 aggregate leaves Phase 3.76 global defaults as separate and not user-owned.
3. Confirmed current user settings save paths are CSRF-protected, entitlement-gated, Zod-validated, user-owned, versioned, audited, and WTC DB-only.
4. Confirmed selected-user admin bot page is read-only and masks key/provider metadata, while fleet admin page remains raw diagnostic-only.
5. Confirmed no agents were launched from this lane; none are running from this lane.

NOT RUN:
1. Product code/tests/migrations edits - forbidden by scope.
2. Unit/integration/e2e tests - not run because this was a read-only audit and no product code changed.
3. Secret scan/governance gates - not run because no product code or test fixtures changed; next implementation phase must run them.
4. Live Legacy/Tortila probes, SSH, tmux, systemd, worker tick, exchange ping/test, provider DB mutation, `.env` read/write, start/stop/retest/apply-config - forbidden by scope.

## Next actions
1. Add a separate global defaults DB model and repository, e.g. `bot_system_default_profiles` plus `bot_system_default_versions`, keyed by `productCode` and profile id/name, not by user/bot instance.
2. Add new `@wtc/audit` action codes and docs for global default save/archive/publish before any route writes them.
3. Add strict Zod schemas for Tortila and Legacy global defaults using the allowlists above and rejecting unknown/forbidden keys.
4. Build `/admin/bots/config` as admin-only, CSRF-protected, WTC DB-only, versioned, audited, and clearly labelled "future/resolved WTC reference only; no live apply".
5. Add static and repository tests proving: admin-only mutation, CSRF required, min-10 reason, entitlement not bypassed for user views, strict payload rejection, no secrets/provider ids/raw JSON, no live-control/test-exchange strings, audit redaction/version-only summaries, and no writes to user `bot_configs`.
