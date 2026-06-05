# admin-global-bot-config-ux-auditor handoff
## Scope
Read-only UX/product audit before implementation of an admin global bot configuration/system-defaults page for Legacy averaging bot and Tortila bot.

Target UX: admins configure system default/reference profiles that are separate from per-user settings; user pages can choose system defaults or custom settings; admins cannot edit a selected user's settings in drilldown. No code, tests, docs, live bots, providers, worker ticks, SSH, tmux, systemd, `.env`, exchange pings, live config apply, start, stop, or retest were run or changed from this lane.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`

## Files changed
None — read-only audit.

## Findings
1. Severity: High. Evidence: `apps/web/src/lib/nav.ts:20` defines `ADMIN_NAV`, and `apps/web/src/lib/nav.ts:26` has only the existing `Bots` admin route; `apps/web/src/app/admin/bots/page.tsx:53`-`apps/web/src/app/admin/bots/page.tsx:57` positions that route as "Bot fleet" diagnostics with live control disabled, not as a configuration page; Phase 3.75 explicitly leaves the global defaults page for Phase 3.76 at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:86`-`docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:88`. Recommendation: implement a separate route, recommended `/admin/bots/defaults`, with nav/action label `Bot Defaults`; keep `/admin/bots` as fleet health and `/admin/users/[userId]/bots` as selected-user read-only drilldown. Target part: admin nav and route structure.
2. Severity: High. Evidence: `packages/db/src/schema.ts:138`-`packages/db/src/schema.ts:143` makes `bot_instances` user-owned; `packages/db/src/schema.ts:177`-`packages/db/src/schema.ts:183` ties `bot_configs` to `bot_instance_id`; `apps/web/src/features/bots/config.ts:774`-`apps/web/src/features/bots/config.ts:789` loads config by `userId` and product; `apps/web/src/features/bots/config.ts:791`-`apps/web/src/features/bots/config.ts:803` persists by ensuring a user bot instance first. Recommendation: the global defaults page must use a new admin/system-owned profile concept and must not save through `persistBotConfig(userId, ...)` or selected-user instance ids. The page should show pills `scope: system defaults`, `user settings: unaffected`, and `LIVE CONTROL: DISABLED`. Target part: data ownership model and page status summary.
3. Severity: High. Evidence: current save behavior is explicitly WTC DB only and never forwarded to a live bot in `packages/db/src/repositories.ts:1836`-`packages/db/src/repositories.ts:1848`; AGENTS forbids live bot start/stop/apply-config until audits pass at `AGENTS.md:74`-`AGENTS.md:82`; seed hard rules also forbid live control and runtime copying at `docs/handoffs/0000-orchestrator-seed.md:113`-`docs/handoffs/0000-orchestrator-seed.md:124`. Recommendation: page copy must say "Publishing changes only the WTC system reference profile. It does not apply to a running bot, does not edit existing user custom profiles, and does not test exchange connectivity." Controls must be `Save draft`, `Validate`, `Publish system default`, `Duplicate profile`, `Deactivate profile`, and `Download safe export`; do not include `Apply to live bot`, `Start`, `Stop`, `Retest`, `Sync runtime`, or `Test exchange connection`. Target part: live-disabled warnings and forbidden controls.
4. Severity: High. Evidence: selected-user drilldown already declares `user settings: read-only` and `provider mappings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:56`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:65`; its saved-settings copy says admins cannot edit user settings at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:158`; Phase 3.75 decisions preserve that the page does not edit user settings, provider mappings, keys, config, positions, or orders at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:52`-`docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:57`. Recommendation: do not add inline default-profile editors, "Apply default to this user", or "Reset user to default" buttons to `/admin/users/[userId]/bots`. At most, add a read-only badge per bot: `uses system default`, `custom profile`, or `no saved user setting`, plus a link to `/admin/bots/defaults`. Target part: selected-user drilldown boundaries.
5. Severity: Medium. Evidence: user settings currently distinguishes saved WTC reference versions from built-in defaults at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:72`-`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:91`; setup uses the same source language at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:42`-`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:55`; user settings already has `Reference profiles` that "only saves a WTC-side config version" at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:337`-`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:356`. Recommendation: user pages should present a clear two-choice source control once system defaults exist: `Use system default` and `Customize my settings`. If custom is selected, save a user-owned version. If system default is selected, show a read-only preview and a `Customize from this default` button rather than silently copying the default. Empty state: `No system default published - using built-in Tortila/Legacy defaults until an admin publishes one.` Target part: user settings/setup source model.
6. Severity: Medium. Evidence: the common config schema already covers Tortila fields at `apps/web/src/features/bots/config.ts:46`-`apps/web/src/features/bots/config.ts:65` and Legacy fields at `apps/web/src/features/bots/config.ts:114`-`apps/web/src/features/bots/config.ts:128`; field labels/hints are defined at `apps/web/src/features/bots/config.ts:150`-`apps/web/src/features/bots/config.ts:190`; built-in defaults and profile presets are defined at `apps/web/src/features/bots/config.ts:192`-`apps/web/src/features/bots/config.ts:259` and `apps/web/src/features/bots/config.ts:294`-`apps/web/src/features/bots/config.ts:338`; the export helper strips Legacy provider pub ids at `apps/web/src/features/bots/config.ts:648`-`apps/web/src/features/bots/config.ts:673`. Recommendation: reuse the existing field definitions, validation, per-coin Tortila table, Legacy strategy/stage table, and safe-export logic for the admin editor; add admin-only profile metadata fields above the strategy editor: `Profile name`, `Bot`, `Status`, `Admin reason`, `Applies to new users`, `Allow users to customize`, and `Published version`. Target part: controls, labels, and profile editor structure.
7. Severity: Medium. Evidence: `TortilaSymbolConfigTable` already exposes per-coin configuration cards and exact export preview copy at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:56`-`apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:75` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:164`-`apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:177`; `LegacyAveragingConfigTable` already exposes signal/stage concepts and provider-count warning pills at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:86`-`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:106` plus stage capacity at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:269`-`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:303`. Recommendation: page structure should be:
   - Header: `Admin - bot defaults`, title `System bot defaults`, copy explaining WTC reference profiles only.
   - Status row: storage, scope, live-control disabled, Tortila default status, Legacy default status.
   - Product switch: `Tortila Bot` and `Legacy Averaging Bot`.
   - Profile library: active default, draft profiles, built-in baseline, last published, changed by, audit reason.
   - Editor: product-specific fields, per-coin/stage sections, validation summary.
   - User impact preview: what new/no-custom users inherit; explicit note that existing custom profiles are unaffected.
   - Audit/version history: versions and admin reasons, no raw JSON by default.
   Empty states: `No system default published`, `No draft profiles`, `No version history`, `Postgres required to publish system defaults`. Target part: page composition and empty states.
8. Severity: Medium. Evidence: design requires terminal-first density and explicit/fail-visible state at `docs/DESIGN_SYSTEM.md:28`-`docs/DESIGN_SYSTEM.md:37`; admin tables must use data-label card-stack wrappers at `docs/DESIGN_SYSTEM.md:1280`-`docs/DESIGN_SYSTEM.md:1303`; mobile table rows become cards with labels at `docs/DESIGN_SYSTEM.md:1304`-`docs/DESIGN_SYSTEM.md:1348`; tap targets are minimum 44px at `docs/DESIGN_SYSTEM.md:1408`-`docs/DESIGN_SYSTEM.md:1413`; the setup stepper is horizontally scroll-contained at `docs/DESIGN_SYSTEM.md:1703`-`docs/DESIGN_SYSTEM.md:1713`. Recommendation: on mobile, product tabs/profile chips must scroll inside their own strip, all profile/version tables must use `wtc-table-wrap` and `data-label`, action cells must stack full width, and product editors must be single-column with advanced Legacy averaging/delta filters inside `details`. Do not use wide raw JSON panels, horizontally scrolling tables, nested card-in-card dashboards, or dense four-column metric grids below 640px. Target part: responsive constraints.
9. Severity: Low. Evidence: admin actions follow `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidate` in `apps/web/src/features/admin/actions.ts:1`-`apps/web/src/features/admin/actions.ts:9`; AGENTS requires every mutation to validate, check RBAC/entitlement, act, audit, and never log secrets at `AGENTS.md:84`-`AGENTS.md:88`; admin loaders intentionally expose safe DTOs and omit password hashes/secrets at `apps/web/src/features/admin/queries.ts:1`-`apps/web/src/features/admin/queries.ts:11`. Recommendation: any admin default-profile mutation must require admin RBAC, CSRF, Zod schema validation, reason text, in-transaction audit, and secret-free DTOs. Publish should be disabled or blocked in demo mode instead of pretending a global default was persisted. Target part: product copy, form requirements, and audit affordances.

## Decisions
1. Recommend route `/admin/bots/defaults` and label `Bot Defaults`. It is a system/admin page, not a selected-user drilldown.
2. Use "system default" and "system reference profile" as primary language. Avoid "global live config" because it implies runtime apply.
3. Each bot should have exactly one active published system default at a time, plus drafts/version history. Existing built-in defaults remain visible as a fallback baseline.
4. User pages should choose between `Use system default` and `Customize my settings`; customizing creates/updates only the current user's WTC config version.
5. Admin selected-user pages remain read-only. They may show whether a user is default-backed or custom-backed, but they must not edit or reset user settings.
6. No live provider/bot affordance belongs on the defaults page. The page is DB/profile/audit UX only.

## Risks
1. Current persistence is user-instance-scoped, so implementing system defaults will require a new system-owned storage path or schema change before the UX can be truthful.
2. Reusing existing user save actions would accidentally create or mutate a user bot instance; that would violate the target UX and Phase 3.75 selected-user boundary.
3. "Apply profile" language from user settings is acceptable for saving a user's WTC-side profile, but on admin defaults it may imply mass user mutation. Prefer "Publish system default" and "Customize from default."
4. The admin nav is already long. Adding `Bot Defaults` is acceptable only if the mobile nav remains horizontally self-scrolling and does not cause page-level horizontal overflow.
5. Demo mode could mislead admins if it allows fake published defaults. Publish should require Postgres or carry an unmistakable non-persisted warning.

## Verification/tests
RUN:
1. Read-only source inspection only.
2. Confirmed latest Phase 3.75 handoff identifies Phase 3.76 as the separate admin global bot configuration/system-defaults page.
3. Confirmed current admin bot fleet page is diagnostics/live-disabled, not defaults editing.
4. Confirmed selected-user admin bot drilldown is read-only and must remain so.
5. Confirmed current user settings/setup pages already have WTC reference profile language and bot-specific controls that can inform the defaults UX.
6. No background agents were launched from this auditor lane; none are left running from this lane.

NOT RUN:
1. Tests/typecheck/lint/build - not run because this was a read-only UX/product audit and no product code changed.
2. Browser/Playwright visual verification - not run because no UI was implemented in this lane.
3. Live Legacy/Tortila bot calls, provider calls, worker tick, SSH, tmux, systemd, exchange ping, `.env` reads, start/stop/retest/apply-config - forbidden by scope and not run.
4. DB migrations/seed/apply - not run because this lane did not implement schema or persistence.

## Next actions
1. Platform/backend implementer: define system-default profile storage separate from user `bot_instances` and user `bot_configs`; include versioning, one active profile per product, changed-by admin id, reason, and audit.
2. Frontend implementer: add `/admin/bots/defaults` using the page structure above; reuse existing bot config schemas/tables where possible without calling user-scoped save paths.
3. User-settings implementer: update `/app/bots/[bot]/setup` and `/app/bots/[bot]/settings` source controls to distinguish system default, built-in fallback, and custom user setting.
4. Tests runner: add static tests proving no selected-user edit controls appear on `/admin/users/[userId]/bots`, no live-control labels exist on `/admin/bots/defaults`, and mobile markup uses `wtc-table-wrap`/`data-label` for profile/version tables.
