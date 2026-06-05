# user-resolved-bot-config-ux-auditor handoff
## Scope
Phase 3.77 read-only UX/product audit for the WTC user bot settings source chooser.

Scope was limited to defining how users should see and use `Use system default` vs `Customize my settings` for Tortila and Legacy, after Phase 3.76 added admin-owned system defaults. Admin views must stay read-only toward selected-user bot profiles. No product code, tests, DB migrations, live services, worker ticks, `.env` files, provider endpoints, exchange pings, bot start/stop/apply-config/retest, SSH, tmux, or systemd controls were edited or run.

This is a single requested auditor handoff, not an aggregate phase handoff and not an N-agent audit claim. No background agents were launched from this lane, and none are left running.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md`
- `docs/handoffs/20260603-2009-admin-global-bot-config-ux-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/ui/src/theme.css`

## Files changed
None - read-only audit except this handoff file: `docs/handoffs/20260603-2044-user-resolved-bot-config-ux-auditor.md`.

## Findings
1. Severity: High. Evidence: Phase 3.76 states user-facing settings still do not consume the new system-default table and should add resolved source labels plus `Use system default / Customize my settings` at `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:63-66` and `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:95-96`; user settings still derives `sourceLabel` only from saved user version vs built-in defaults at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:72-91`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:42-55`; `loadBotConfig()` reads only the current user's `bot_configs` row and never joins `bot_global_configs` at `apps/web/src/features/bots/config.ts:774-789`. Recommendation: add a resolved-config read model before UI acceptance, returning `sourceKind: built_in_fallback | system_default | user_custom`, source label/version, `allowUserOverride`, preview config, and current user-custom version/history. Target part: user settings/setup loader contract.

2. Severity: High. Evidence: user config remains instance-owned via `bot_instances.user_id/product_code` at `packages/db/src/schema.ts:138-143` and `bot_configs.bot_instance_id` at `packages/db/src/schema.ts:177-183`; Phase 3.76 added separate global default rows keyed by `product_code/profile_code`, status, `applies_to_new_users`, `allow_user_override`, version, and config at `packages/db/src/schema.ts:185-206`; global version history is separate at `packages/db/src/schema.ts:480-504`. Recommendation: do not model source choice as "presence of a saved config" only. If a user with custom history chooses `Use system default`, preserve immutable custom history and add an explicit per-user source preference/current-pointer model, or a safe inactive-current custom model. Target part: persistence model for returning from custom to inherited source.

3. Severity: High. Evidence: the admin system-default page already explains inheritance layers as built-in fallback, system default, user override, and runtime read-only snapshots at `apps/web/src/app/admin/bots/config/page.tsx:291-298`; it states admin defaults affect new/no-custom users and existing custom profiles stay unchanged at `apps/web/src/app/admin/bots/config/page.tsx:75-80`; the admin copy says defaults do not mutate user overrides or running bots at `apps/web/src/app/admin/bots/config/page.tsx:267-273`. Recommendation: user copy must mirror this layer model exactly: `Resolved source`, not `runtime config`. Use `System default vN`, `Custom settings vN`, or `Built-in fallback`; never present Legacy provider snapshots or Tortila exchange keys as config sources. Target part: settings/setup terminology.

4. Severity: High. Evidence: selected-user admin drilldown already declares `user settings: read-only` and `provider mappings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:50-65`; the saved-settings panel says admins cannot edit the user's saved reference at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150-158`; the provider mapping card says it does not create, disable, or edit mappings, saved settings, exchange keys, live bot config, start/stop state, or positions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:328-333`; the admin loader projects only saved WTC references as read-only summaries at `apps/web/src/features/admin/user-bot-detail-loader.ts:256-304`. Recommendation: admin user pages may show `source: system default vN`, `source: custom vN`, or `source: built-in fallback`, plus a link to `/admin/bots/config`; they must not add `Use system default for this user`, `Reset user settings`, `Customize as user`, or inline config editors. Target part: admin selected-user UX boundary.

5. Severity: Medium. Evidence: the current user settings page has a source card but no source-selection fieldset at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200-231`; reference profile cards currently save user-owned WTC versions at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:337-356`; the main configuration form is always editable once access is allowed at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:361-418`. Recommendation: add a top-of-page `Settings source` fieldset before `Reference profiles` and before the editable config form. Exact controls:
   - `Use system default` radio/card. Copy: `Inherit the latest published WTC system default for this bot. WTC may update this default; your saved custom versions stay in history but are not the active source while this is selected. No live bot is changed.`
   - `Customize my settings` radio/card. Copy: `Create or continue a user-owned WTC config version. Start from the current default, then save your own profile. It is not pushed to the live bot.`
   - Primary action when inherited: `Customize from this default`.
   - Primary action when custom: `Save custom settings`.
   - Secondary action when custom exists and the user selects inherited: `Use system default` with confirmation copy `Your custom history stays saved, but the active source will resolve to the system default.`
   Target part: `/app/bots/[bot]/settings` source chooser.

6. Severity: Medium. Evidence: the setup wizard has a source card but no source decision at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:234-256`; the strategy step offers reference profiles and then an editable strategy form at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:319-390`; review only reports saved config state and live-control-disabled copy at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:395-412`. Recommendation: keep the source chooser in the `strategy` step. If `Use system default` is selected, show a read-only preview and let the review step proceed with `Strategy config: system default vN`. If `Customize my settings` is selected, reveal the existing editable form and save a user-owned version before review. Target part: `/app/bots/[bot]/setup?step=strategy` and review copy.

7. Severity: Medium. Evidence: Tortila source details currently mention WTC reference profiles and disabled live exchange apply at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:88-91`, exchange keys are separate encrypted metadata at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:295-325`, and the Tortila table already labels per-coin WTC-side profile/exact export preview at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:56-75` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:164-177`. Recommendation: Tortila-specific source copy should say `Exchange keys are separate from settings source. Changing source does not add, remove, reveal, or test keys.` The inherited preview should show per-coin rows in read-only/disabled preview mode; the edit table should appear only for custom mode. Target part: Tortila settings/setup copy and table mode.

8. Severity: Medium. Evidence: Legacy setup skips/explains exchange-key collection and uses provider snapshots as read-only evidence at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:214-231`; Legacy settings shows provider runtime snapshots as evidence, not editable source, at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:233-245`; the Legacy table copy already says rows are WTC-side reference intent and has provider-count pills at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:86-106`; admin global config explicitly says Legacy defaults are generic strategy rows and provider pub_id mappings are not a system default at `apps/web/src/app/admin/bots/config/page.tsx:172-179`. Recommendation: Legacy-specific source copy should say `Provider pub_id mappings, balances, active slots, active orders, and runtime snapshots are read-only evidence, not settings source.` The source chooser must not expose `providerPubId`, provider account ids, balances, slots, orders, or `copy runtime into settings`. Target part: Legacy settings/setup source chooser.

9. Severity: Medium. Evidence: `adminSaveBotGlobalConfigAction` blocks secret/raw/live-control form and config keys including `apiKey`, `apiSecret`, `secret`, `token`, `providerPubId`, `providerAccountId`, `providerAccounts`, `liveConfig`, `rawJson`, `legacyDatabaseUrl`, `tortilaJournalBaseUrl`, `headers`, `applyConfig`, `start`, `stop`, `restart`, `retest`, and `testExchange` at `apps/web/src/features/admin/actions.ts:431-464`; the admin action requires admin RBAC, CSRF, schema validation, DB presence, versioned global save, and revalidation at `apps/web/src/features/admin/actions.ts:492-544`; AGENTS forbids plaintext exchange secrets, live bot control, fake integration, and non-entitlement access truth at `AGENTS.md:74-82`. Recommendation: user source chooser and admin projections must not include forbidden live controls or secret paths. Forbidden controls: `Apply to live bot`, `Start`, `Stop`, `Restart`, `Retest`, `Test exchange connection`, `Sync runtime`, `Copy runtime config`, `Apply default to this user`. Forbidden secret/raw paths: `.env`, exchange key/secret, sealed vault payloads, key ids, provider pub_id/account ids, provider account arrays, raw snapshot JSON, live config JSON, DB URLs, journal base URLs, headers, cookies, tokens, and raw audit config JSON. Target part: source chooser safety copy, static tests, and DTO shape.

10. Severity: Medium. Evidence: design requires explicit/fail-visible state at `docs/DESIGN_SYSTEM.md:34-37`; bot config settings should become full-width sections on mobile at `docs/DESIGN_SYSTEM.md:1064-1083`; grid layouts collapse to one column below 640px at `packages/ui/src/theme.css:62-67`; buttons carry unconditional 44px min-height at `packages/ui/src/theme.css:88-90`; setup steppers scroll within their own strip at `packages/ui/src/theme.css:186-194` and `docs/DESIGN_SYSTEM.md:1702-1713`. Recommendation: source chooser radio/cards must collapse to a single column below 640px, status pills must wrap, and action buttons should become full-width or wrap cleanly. Do not implement the choice as a wide two-button segmented control that forces page-level horizontal scroll. Target part: mobile source chooser layout.

11. Severity: Low. Evidence: current user settings version and safety tables are raw `<table className="wtc-table">` without `wtc-table-wrap` around `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:421-457`, while the design system requires wrapped/data-label card-stack tables at `docs/DESIGN_SYSTEM.md:1298-1370` and current CSS implements that treatment at `packages/ui/src/theme.css:116-178`. Recommendation: any new source-history or resolved-source audit table must use `wtc-table-wrap` and `data-label`; when touching the settings page, wrap the existing version/safety tables too if they remain visible on mobile. Target part: mobile table/accessibility markup.

## Decisions
1. User-facing source model has three resolved states: `built_in_fallback`, `system_default`, and `user_custom`.
2. The visible chooser has two user actions when a published system default exists: `Use system default` and `Customize my settings`.
3. If no published system default exists, show state `Built-in fallback` with copy `No system default is published yet. WTC is showing built-in safe defaults until an admin publishes a system default.` Do not label that as `Use system default`.
4. If `allowUserOverride` is false, show `Use system default` as active and disable `Customize my settings` with copy `Customization is locked for WTC review. You can view the system default, but custom saves are disabled until WTC reopens overrides.`
5. Tortila source choice never changes encrypted exchange keys and never tests exchange connectivity.
6. Legacy source choice never includes provider pub_id, balances, active slots/orders, or runtime snapshot copying.
7. Admin selected-user pages stay read-only; they may display resolved source labels but may not alter the user's source selection.

## Risks
1. Without an explicit user source preference/current-pointer model, `Use system default` after a prior custom save may require deleting or ignoring the current `bot_configs` row, which can confuse audit/history unless designed deliberately.
2. Calling the existing `persistBotConfig()` from an inherited/default action would create or mutate a user-owned custom profile, which is the opposite of `Use system default`.
3. `Apply profile` wording is acceptable for user custom saves, but it is risky near system defaults because it can sound like runtime apply or mass mutation. Prefer `Use system default`, `Customize from this default`, and `Save custom settings`.
4. A disabled customize state must be explicit, not silent; otherwise users may think the UI is broken when `allowUserOverride=false`.
5. Mobile source controls could create horizontal overflow if implemented as fixed-width segmented buttons instead of responsive cards/fieldset controls.

## Verification/tests
RUN:
1. Read-only source inspection of the required protocol, design, Phase 3.76 handoff, user settings/setup pages, admin defaults page, admin selected-user drilldown, config loaders/actions, DB schema/repositories, and UI CSS.
2. `git status --short --branch` - observed dirty worktree before this handoff; no existing product-code/test changes were modified by this auditor.
3. Timestamp check for handoff path: `20260603-2044`.

NOT RUN:
1. `npm test`, Vitest, typecheck, lint, build - not run because this was a read-only UX/product audit and no product/test implementation was requested.
2. Browser/Playwright visual verification - not run because no UI was implemented.
3. DB migrations, seed, or DB writes - forbidden by read-only audit scope.
4. Live Legacy/Tortila bot calls, provider calls, worker tick/restart, exchange ping, `.env` reads/writes, SSH, tmux, systemd, start/stop/retest/apply-config - forbidden by scope and not run.
5. Background agent fan-out - not run because the operator requested one canonical UX/product auditor handoff only; this handoff makes no N-agent audit claim.

## Next actions
1. Platform/backend: define a resolved bot config read model and a safe source-preference/current-pointer model so `Use system default` can be active even after prior custom history.
2. User settings/frontend: add the `Settings source` fieldset to `/app/bots/[bot]/settings` before profiles/editor, with read-only default preview and custom-only editor/save controls.
3. Setup/frontend: add the same source chooser to `/app/bots/[bot]/setup?step=strategy`; review should report `system default vN`, `custom vN`, or `built-in fallback`.
4. Admin/frontend: update `/admin/users/[userId]/bots` only with resolved source labels and a link to `/admin/bots/config`; do not add user-profile mutation controls.
5. Tests runner: add static tests for exact copy/forbidden controls, admin read-only boundaries, no secret/raw path exposure, and mobile-safe source chooser markup.
