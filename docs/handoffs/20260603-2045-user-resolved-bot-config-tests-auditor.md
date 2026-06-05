# user-resolved-bot-config-tests-auditor handoff
## Scope
Read-only Phase 3.77 tests/acceptance audit for the user-facing resolved bot config source chooser after Phase 3.76 admin global bot defaults.

The audit inspected governance docs, Phase 3.76, current bot settings/config/export code, DB global-default repositories, existing admin/bot config integration tests, and existing e2e coverage. It identifies the focused Vitest/static/PGlite/Playwright gates needed to prove:
- published system defaults are previewed and inherited by users without custom config,
- custom user config remains user-owned and is not overwritten by admin defaults,
- settings and exports remain entitlement-gated,
- no live controls, provider secrets, DB URLs, raw runtime JSON, or plaintext secrets appear.

No product code, tests, migrations, live services, `.env`, worker, provider DB, SSH, tmux, systemd, exchange, or bot-control path was edited or invoked. Codex thread/agent tools were not exposed in this session; because this was the single requested read-only tests-auditor lane and the user requested only one handoff artifact, no background-agent claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md`
- `package.json`
- `playwright.config.ts`
- `playwright.auth-db.config.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/helpers/auth.ts`

## Files changed
None - read-only audit. Handoff artifact only: `docs/handoffs/20260603-2045-user-resolved-bot-config-tests-auditor.md`.

## Findings
1. Severity: High. Current user settings resolution has no published system-default inheritance proof. Evidence: Phase 3.76 explicitly left user-facing source resolution as the next action at `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:64` and `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:95`; global default tables/repos now exist at `packages/db/src/schema.ts:185` to `packages/db/src/schema.ts:210` and `packages/db/src/repositories.ts:1840` to `packages/db/src/repositories.ts:1850`; but `loadBotConfig` only looks up a user bot instance/current config and returns `current: null` when no user instance exists at `apps/web/src/features/bots/config.ts:774` to `apps/web/src/features/bots/config.ts:789`. Recommendation: add a PGlite DB resolver test proving fallback order `user_override > published_system_default > built_in_default`. Target part: resolved bot config loader/repository boundary.
2. Severity: High. Current user-facing source labels can distinguish saved user reference vs built-in defaults, but not inherited published system defaults. Evidence: `editableSourceLabelFor` returns only `WTC reference vN` or `Built-in Legacy/Tortila defaults` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:72` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:79`; `editableSourceDetailFor` likewise describes saved user versions or safe WTC defaults only at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:81` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:91`; the settings card renders only that label/detail at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:212`. Recommendation: add static and Playwright assertions for explicit source states: `Published system default`, `Inherited from system default`, `Custom user config`, and built-in fallback when no published default exists. Target part: settings/setup UI and source chooser copy.
3. Severity: High. Custom user config ownership is not yet tested against admin default changes. Evidence: Phase 3.76 DB tests prove admin global saves do not create user bot instances/configs at `tests/integration/admin-global-bot-config-db.test.ts:95` to `tests/integration/admin-global-bot-config-db.test.ts:138`; user saves still write through `persistBotConfig` and `saveBotConfig` at `apps/web/src/features/bots/config.ts:791` to `apps/web/src/features/bots/config.ts:803`; global default saves write separate `bot_global_configs` and `bot_global_config_versions` rows at `packages/db/src/repositories.ts:1870` to `packages/db/src/repositories.ts:1966`. Recommendation: add PGlite tests where a user first inherits a published default, then customizes, then the admin publishes a new default; the user's effective config must remain the user-owned saved config, while the new system default remains available only as preview/inherit target. Target part: source resolver and user customization flow.
4. Severity: High. Export acceptance must move from `state.current ?? liveConfig` to the resolved safe config source, while keeping entitlement and provider-mapping gates. Evidence: the export route currently requires session and bot access at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:14`, blocks missing Legacy provider mapping at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:25`, then exports `state.current ?? liveConfig` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:27`; existing static tests check these old guardrails at `tests/integration/bot-config-export-static.test.ts:27` to `tests/integration/bot-config-export-static.test.ts:36`. Recommendation: extend export tests so inherited system default is exported when there is no user override, user override wins when present, unentitled users get 403, and Legacy runtime/raw provider config is never silently exported over a published system default. Target part: config export route and export static/PGlite tests.
5. Severity: High. Settings entitlement gating needs an explicit negative e2e/static gate for this chooser, not only route-level code review. Evidence: settings returns `BotAccessRequired` before loading config when access is denied at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:140` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:149`; `BotAccessRequired` renders a fail-closed entitlement message at `apps/web/src/features/bots/data.tsx:35` to `apps/web/src/features/bots/data.tsx:48`; demo seed gives `teacher@wtc.local` education only, not bot entitlements, at `apps/web/src/lib/demo.ts:181` to `apps/web/src/lib/demo.ts:190`; `tests/e2e/helpers/auth.ts:15` to `tests/e2e/helpers/auth.ts:17` already exposes `loginTeacher`. Recommendation: add Playwright coverage that `teacher@wtc.local` sees `Access required` on `/app/bots/tortila/settings` and receives `403 { error: 'access_required' }` from `/api/bots/tortila/config-export`, with no source chooser or export content rendered. Target part: Playwright acceptance for entitlement gates.
6. Severity: High. Secret/live-control regression checks must be duplicated around the new chooser because it touches config, export, and provider-adjacent Legacy UX. Evidence: existing export sanitizer removes Legacy `providerPubId` at `apps/web/src/features/bots/config.ts:648` to `apps/web/src/features/bots/config.ts:654` and emits no-key/no-live-apply warnings at `apps/web/src/features/bots/config.ts:675` to `apps/web/src/features/bots/config.ts:704`; existing static tests already forbid live controls/secrets in admin defaults at `tests/integration/admin-global-bot-config-static.test.ts:74` to `tests/integration/admin-global-bot-config-static.test.ts:99`; current settings still renders no-live-apply copy at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`. Recommendation: add source-chooser static assertions forbidding `startBot`, `stopBot`, `applyConfig`, `retest`, `testExchange`, `apiSecret`, `apiKey`, `providerAccountId`, full `providerPubId`, `rawJson`, DB URL env names, and direct adapter/control imports in settings/setup/export changes. Target part: static safety tests.
7. Severity: Medium. Existing e2e covers bot settings layout and export link, but not the new source states or source switching. Evidence: current `tests/e2e/bot-settings.spec.ts:13` to `tests/e2e/bot-settings.spec.ts:43` verifies headings, safe tables, export link, and no horizontal scroll; current admin mobile spec covers `/admin/bots/config` at `tests/e2e/admin-mobile-pg8.spec.ts:20` to `tests/e2e/admin-mobile-pg8.spec.ts:30`; neither asserts inherited vs custom source states. Recommendation: add a focused `tests/e2e/bot-settings-source.spec.ts` or extend `bot-settings.spec.ts` for desktop and mobile source-state visibility, no horizontal scroll at 375px, no live-control buttons, and entitlement-denied export/settings behavior. Target part: Playwright source chooser acceptance.

## Decisions
1. Add `tests/integration/user-resolved-bot-config-db.test.ts`. Required PGlite cases:
   - applies all migrations and seeds demo users/products.
   - saves a published `tortila_bot` system default via `saveBotGlobalConfig`, with `appliesToNewUsers: true`.
   - resolves an entitled user with no `bot_configs` row to `source.kind === 'system_default'`, `source.version === <published version>`, `source.label`, and effective config matching the published default.
   - ignores draft/archived or `appliesToNewUsers: false` defaults and falls back to `source.kind === 'built_in_default'`.
   - saves a user custom config and proves `source.kind === 'user_override'`, `bot_configs`/`bot_config_versions` are user-owned by `bot_instance_id`, and `bot_global_configs`/versions are unchanged.
   - publishes a newer system default after the user override and proves the user's effective config stays user-owned while the newer system default remains previewable/inheritable.
   - repeats the inheritance/override proof for `legacy_bot`, including Legacy symbol/stage rows.
   - serializes the resolved output and proves no `apiKey`, `apiSecret`, `token`, `providerAccountId`, full `providerPubId`, DB URL, `rawJson`, or live-control field appears.
2. Add `tests/integration/user-resolved-bot-config-static.test.ts`. Required static cases:
   - source resolver/loader uses the global-default repository or a pure `resolveBotConfigStateFromDb(db, userId, productCode)` helper, not only `getCurrentBotConfig`.
   - resolved state exposes an explicit union, for example `built_in_default | system_default | user_override`, plus label/version/preview metadata.
   - settings/setup render source labels and controls for `Use system default` and `Customize my settings` after entitlement gating.
   - source actions, if added, use `assertCsrf`, `requireUser`, `botAccessForUser`, product Zod validation, and user-owned config persistence only for custom saves.
   - source actions do not import/call admin global save actions, live adapters, live controls, exchange tests, or direct env mutation.
3. Extend `tests/integration/bot-config-export-static.test.ts` or add a companion export test. Required cases:
   - export route uses the resolved effective config, not `state.current ?? liveConfig`.
   - route still requires `requireUser`, `botAccessForUser`, provider-mapping checks for Legacy, `content-disposition`, and `cache-control: no-store`.
   - static source forbids raw Legacy runtime fallback when a published system default exists.
   - export sanitizer still strips Legacy provider identity and secret-like fields.
4. Extend `tests/integration/bot-read-safety-static.test.ts`. Required cases:
   - settings/setup source chooser keeps no-live-control copy.
   - no `startBot`, `stopBot`, `applyConfig`, `retest`, `testExchange`, close-position, cancel-order, or direct adapter-control import appears in chooser code.
   - no full provider pub_id, sealed secret, API key/secret, token, DB URL, or raw runtime JSON is rendered.
5. Add or extend Playwright with `tests/e2e/bot-settings-source.spec.ts`. Required browser cases:
   - `loginUser`, visit `/app/bots/tortila/settings` and `/app/bots/legacy/settings`, see `Configuration source` and the correct inherited/custom/built-in state for the seeded mode.
   - if demo mode cannot seed published DB defaults, Playwright should prove the visible chooser states that exist in demo, while PGlite proves published default inheritance.
   - click the custom path or submit a safe custom edit, then verify the source label changes to user-owned custom config and no live-control success is claimed.
   - use `loginTeacher`, visit `/app/bots/tortila/settings`, verify `Access required`, verify no chooser/export content, and verify `/api/bots/tortila/config-export` returns 403.
   - run on desktop and mobile, with no horizontal scroll at 375px.
6. If the team wants Playwright to prove actual Postgres-backed published defaults rather than relying on PGlite for that layer, add a guarded managed DB e2e runner modeled after the existing auth/LMS managed runners. It must create a throwaway `wtc_test_*` database, apply migrations/seed, insert published system defaults, run the source spec, scan retained artifacts, and drop the DB. Do not point it at preview/prod or existing bot databases.

## Risks
1. Without a PGlite resolver test, the UI can appear to show a system-default chooser while still falling back to built-in defaults or live Legacy runtime config.
2. Without a user-override precedence test, an admin-published default can accidentally overwrite or shadow user-owned custom settings.
3. Without export-specific tests, `/api/bots/[bot]/config-export` can keep exporting `state.current ?? liveConfig`, bypassing the intended published-default inheritance layer.
4. Without negative entitlement e2e, the chooser/export may be visible to users without active bot entitlements.
5. Without duplicated safety assertions, a source chooser can reintroduce live-control verbs or provider/raw/secret fields through copy, hidden inputs, exports, screenshots, or retained artifacts.
6. Default Playwright demo mode alone cannot prove DB-backed published defaults; use PGlite for DB resolution or add a guarded managed DB e2e runner.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - PASS/read-only. Observed branch `codex/bot-analytics-settings-canary-20260603` with substantial pre-existing dirty and untracked product/test/handoff changes. This audit did not modify them.
2. `Get-Content AGENTS.md`, `Get-Content docs/SESSION_PROTOCOL.md`, `Get-Content docs/handoffs/0000-orchestrator-seed.md`, `Get-Content docs/STATUS.md`, `Get-Content docs/IMPLEMENTED_FILES.md`, `Get-Content docs/NEXT_ACTIONS.md`, and `Get-Content docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md` - PASS/read-only.
3. `rg --files tests | rg -i "bot|admin|config|e2e|settings|export|safety"` - PASS/read-only.
4. Focused `rg -n` and numbered `Get-Content` inspections over bot config loader, settings/setup pages, export route, DB global config repos/schema, admin global config tests, bot export/static tests, bot settings e2e, admin mobile e2e, and auth helper - PASS/read-only.

NOT RUN / NOT GREEN in this audit:
1. `npx vitest run tests/integration/user-resolved-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts` - NOT RUN; tests do not exist yet.
2. `npx vitest run tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` - NOT RUN; this audit identified how to extend them and did not execute product gates.
3. `npx playwright test tests/e2e/bot-settings-source.spec.ts --project=desktop` and `--project=mobile` - NOT RUN; focused source spec does not exist yet.
4. `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` / `--project=mobile` - NOT RUN; current spec does not prove published-default inheritance or entitlement-denied export.
5. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - NOT RUN; existing admin route coverage already includes `/admin/bots/config`, but no current user source chooser proof was requested to run.
6. `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, `npm run governance:check`, `git diff --check` - NOT RUN; no implementation was performed.
7. Full `npm test`, full `npm run e2e`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run ci:local`, and `npm run evidence:visual` acceptance - NOT RUN; out of scope for this read-only audit.
8. DB migrate/seed against persistent Postgres, managed DB e2e, preview/server restart, worker tick/restart, live Legacy/Tortila bot continuity, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - NOT RUN and forbidden for this phase.

Required focused gates after implementation:
1. `npx vitest run tests/integration/user-resolved-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts`
2. `npx playwright test tests/e2e/bot-settings-source.spec.ts --project=desktop`
3. `npx playwright test tests/e2e/bot-settings-source.spec.ts --project=mobile`
4. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
5. `npm run typecheck -w @wtc/web`
6. `npm run typecheck`
7. `npm run lint`
8. `npm run secret:scan`
9. `npm run build -w @wtc/web`
10. `npm run governance:check`
11. `git diff --check`
12. If screenshots are retained: `npm run evidence:visual -- --inventory tests/e2e/screenshots` for inventory-only, or a manifest-backed `npm run evidence:visual -- --manifest <manifest> <retained screenshot>` for acceptance.

## Next actions
1. Implement the resolved config state as a small testable resolver before editing the UI: user override wins, published system default inherits for no-custom users, built-in defaults remain fallback, and entitlements remain the access source of truth.
2. Add the focused PGlite/static tests listed above before or alongside UI changes.
3. Add the Playwright source/entitlement spec and run it on desktop and mobile.
4. Keep live bot controls, provider calls, worker restarts/ticks, SSH/tmux/systemd, `.env`, and real exchange tests out of scope.
5. The implementation handoff must list exactly which gates ran green and which were not run, without promoting this audit's recommended gates to observed pass evidence.
