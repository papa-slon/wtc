# user-resolved-bot-config-platform-auditor handoff
## Scope
Read-only platform/data audit for how published `bot_global_configs` should compose with user-owned `bot_configs` in `/app/bots/[bot]/settings`, `/app/bots/[bot]/setup`, and adjacent user-facing bot config consumers.

No product code, tests, migrations, live services, provider databases, exchange endpoints, `.env` files, SSH, tmux, systemd, worker tick/restart, live bot start/stop/apply/retest, or exchange ping was touched.

Background agent note: no background agents were launched because this session did not expose a general background-agent/thread dispatch tool. This is a single platform/data auditor handoff only; no N-agent audit is claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/cabinet/loader.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`

## Files changed
- `docs/handoffs/20260603-2047-user-resolved-bot-config-platform-auditor.md` - this handoff only.
- None - product code, tests, migrations, and live services were not changed.

## Findings
1. Severity: High. User settings/setup do not currently consume `bot_global_configs`; they resolve only user-owned `bot_configs` and then fall back to built-in defaults. Evidence: Phase 3.76 records the open risk at `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:63`; `loadBotConfig` reads `listBotInstancesForUser`, `getCurrentBotConfig`, and `listBotConfigVersions` only at `apps/web/src/features/bots/config.ts:774`; settings loads `loadBotConfig` and `botConfigDefaultsFor` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:146`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:158`. Recommendation: add a single resolved-config loader with source order `user_override -> published_system_default -> built_in`, then use it in settings and setup. Target part: user bot config resolver and settings/setup UI.

2. Severity: High. The existing global-config repo helper is unsafe as the direct user inheritance primitive because it returns a profile row without filtering to `status='published'` and `appliesToNewUsers=true`. Evidence: `getBotGlobalConfig` filters only `productCode` and `profileCode` at `packages/db/src/repositories.ts:1840`; the schema explicitly tracks `status`, `appliesToNewUsers`, and `allowUserOverride` at `packages/db/src/schema.ts:185`; the active default uniqueness rule is scoped to published/applying rows at `packages/db/src/schema.ts:204` and migration SQL `packages/db/migrations/0020_moaning_robin_chapel.sql:47`. Recommendation: create a repo/read helper such as `getPublishedBotGlobalDefault(db, productCode)` or perform equivalent filtering in the resolved loader; validate the row with `botConfigSchemaFor(productCode)` before rendering. Target part: DB repo boundary plus app-level config validation.

3. Severity: High. `allowUserOverride=false` is persisted and displayed by admin, but user save paths currently ignore it. Evidence: admin schema accepts `allowUserOverride` at `apps/web/src/features/admin/schemas.ts:124`; admin action persists it at `apps/web/src/features/admin/actions.ts:528`; admin UI labels it "Users may customize" or "Locked for future review" at `apps/web/src/app/admin/bots/config/page.tsx:146`; settings saves manual and preset configs after only CSRF/user/access validation at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:115`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:92` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:119`. Recommendation: resolved state should carry `allowUserOverride`; server actions should fail closed or explicitly ignore this field only after a product decision. Target part: user config mutation authorization and UI disabled states.

4. Severity: Medium. A future "Use system default" action cannot safely be implemented by simply deleting the current `bot_configs` row. Evidence: `bot_configs` has no source metadata and only stores current `version`/`config` at `packages/db/src/schema.ts:177`; history has a unique `(bot_instance_id, version)` index at `packages/db/src/schema.ts:463`; `saveBotConfig` derives the next version from the current row only at `packages/db/src/repositories.ts:1976`, then appends to `bot_config_versions` at `packages/db/src/repositories.ts:1983`; `BotConfigState` also lacks source/global metadata at `apps/web/src/features/bots/config.ts:737`. Recommendation: either add an explicit inherited/source state or add a clear-override repo that preserves history and computes the next version from history, not just the current row. Do not label a copied config as inherited. Target part: DB model/repositories for override clearing.

5. Severity: Medium. Adjacent consumers would stay inconsistent if only settings/setup are changed. Evidence: config export uses `state.current ?? liveConfig` and then `exportBotConfig` falls back to built-in defaults at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` and `apps/web/src/features/bots/config.ts:675`; the bot dashboard combines runtime config with `wtcConfig.current` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:111`; cabinet setup completion uses `cfg.version != null` at `apps/web/src/features/cabinet/loader.ts:83`. Recommendation: centralize resolved source use for settings, setup, export, dashboard summaries, and cabinet setup signals; distinguish "inherited system default vN" from "user config vN saved." Target part: app bot feature consumers.

6. Severity: Medium. Current tests lock the admin/global boundary but do not cover user-facing resolved inheritance. Evidence: DB tests assert global saves do not create user bot instances/configs at `tests/integration/admin-global-bot-config-db.test.ts:95`; static tests assert admin global actions do not call `persistBotConfig`/`saveBotConfig` at `tests/integration/admin-global-bot-config-static.test.ts:55`; bot read safety tests only assert old source labels/sections exist at `tests/integration/bot-read-safety-static.test.ts:226`. Recommendation: add focused PGlite and static tests for published-vs-draft inheritance, user override precedence, invalid global fallback, export behavior, cabinet setup signals, and `allowUserOverride=false` save denial. Target part: tests/integration plus any focused e2e for settings/setup.

## Decisions
1. Recommended resolved source order: first user-owned `bot_configs` current row, then published `bot_global_configs` profile `system_default` where `appliesToNewUsers=true`, then built-in defaults/presets.
2. Admin publishing a global default must not create or mutate user `bot_instances`, `bot_configs`, or live runtime state. Phase 3.76's separation remains correct.
3. Runtime/provider snapshots remain read-only evidence. They must not be silently copied into editable user config or system defaults.
4. User access remains gated through the existing entitlement path before resolving config; admin role bypass for admin browsing is separate from normal user access.
5. If database mode is unavailable, the user-facing resolved source should remain honest demo/built-in fallback; it should not imply a published system default was loaded.
6. `allowUserOverride` needs an explicit product decision before public UX: either enforce it fail-closed on customize/save, or rename/remove the surfaced lock wording until enforcement lands.

## Risks
1. Users without custom configs will keep seeing stale built-in defaults even after admins publish system defaults.
2. Using `getBotGlobalConfig` directly could expose draft, archived, or preview-only config as inherited user config.
3. Copying a global default into `bot_configs` would make future admin publishes stop composing, while the UI might still claim inheritance.
4. Clearing overrides without a version/history design can create duplicate history-version failures or lose the ability to explain who changed the active source.
5. Export, cabinet, and dashboard signals can disagree with settings/setup unless all of them consume the same resolved loader.
6. Any resolver that skips Zod validation could render or export malformed JSON stored by a future import/admin path.

## Verification/tests
RUN:
1. Read required governance docs and Phase 3.76 handoff.
2. Static source inspection with `rg` and line-numbered reads.
3. `git status --short --branch` for dirty-tree awareness.

NOT RUN:
1. `npm test`, focused Vitest, typecheck, lint, build, Playwright, and governance checks - not run because this was a read-only audit handoff only.
2. DB migration apply/seed, provider DB reads/writes, worker tick/restart, live bot start/stop/apply/retest, SSH, tmux, systemd, `.env` reads/writes, and exchange ping - forbidden by scope.

Tests to run after implementation:
1. PGlite integration for resolved source order: user override wins; published/applying system default is inherited when no user config exists; draft/archived/non-applying rows fall back to built-in; invalid global config fails closed to built-in plus warning.
2. PGlite/server-action tests for `allowUserOverride=false`: manual save and preset/customize are denied or disabled according to the chosen product decision.
3. Versioning tests for "Use system default" / clear override: history is preserved, next custom save has a non-conflicting version, and audit records the source change.
4. Static tests that settings/setup/export/cabinet/dashboard use the same resolved loader and do not call live adapters or provider config as editable source.
5. Focused e2e for `/app/bots/[bot]/settings` and `/app/bots/[bot]/setup` on desktop/mobile with a seeded published default and a seeded user override.
6. Follow-up gates: focused Vitest files, `npm run typecheck -w @wtc/web`, root `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run governance:check`, and `git diff --check`.

## Next actions
1. Implement a resolved bot config helper and source metadata type in the bot feature boundary; include `source`, `sourceLabel`, `current`, `version`, `globalConfigId`, `globalVersion`, `allowUserOverride`, and validation/fallback warnings.
2. Add a filtered DB helper for published/applying system defaults, or keep that filtering inside the resolver if app-level validation needs to stay colocated with `botConfigSchemaFor`.
3. Wire settings/setup to render inherited global defaults before built-ins, while keeping user-owned `bot_configs` as the only custom override storage.
4. Decide and implement "Use system default" semantics before adding the button; avoid a hidden copy-vs-inherit mismatch.
5. Update export, cabinet, and dashboard summaries to use resolved source state so labels and setup completion are consistent.
6. Add the focused tests listed above before any visual/e2e acceptance claim.
