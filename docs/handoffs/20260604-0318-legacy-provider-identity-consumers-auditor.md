# legacy-provider-identity-consumers-auditor handoff
## Scope
Phase 3.92 read-only audit of Legacy provider identity consumers. Inspected runtime, display, export, settings/setup, statistics, dashboard, admin fleet, and admin user bot detail consumers to determine which paths need a runtime/display provider-identity type versus a persistable user/global config type. No product code, tests, migrations, env, provider, worker, bot, exchange, vault, SSH, tmux, systemd, or live server state was modified.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`
8. `apps/web/src/features/bots/config.ts`
9. `apps/web/src/features/bots/config-types.ts`
10. `apps/web/src/features/bots/config-export.ts`
11. `apps/web/src/features/bots/config-export-handler.ts`
12. `apps/web/src/features/bots/config-action-handler.ts`
13. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
14. `apps/web/src/features/bots/data.tsx`
15. `apps/web/src/features/bots/statistics-panels.tsx`
16. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
17. `apps/web/src/features/bots/readiness.ts`
18. `apps/web/src/features/bots/readiness-loader.ts`
19. `apps/web/src/features/bots/config-review.ts`
20. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
22. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
23. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
24. `apps/web/src/app/(app)/app/bots/page.tsx`
25. `apps/web/src/app/admin/bots/page.tsx`
26. `apps/web/src/app/admin/bots/config/page.tsx`
27. `apps/web/src/features/admin/bot-health-loader.ts`
28. `apps/web/src/features/admin/user-bot-detail-loader.ts`
29. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
30. `packages/db/src/repositories.ts`
31. `tests/integration/bot-runtime-config-sanitizer.test.ts`
32. `tests/integration/bot-config-export-static.test.ts`
33. `tests/integration/bot-read-safety-static.test.ts`
34. `tests/integration/bot-config-action-handler.test.ts`
35. `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. Persistable Legacy user/global config is now correctly separated from provider identity on the current tree. Evidence: `legacySymbolConfigShape` has no `providerPubId`, while `legacyRuntimeSymbolConfigSchema` adds optional `providerPubId` only for runtime rows at `apps/web/src/features/bots/config.ts:70` and `apps/web/src/features/bots/config.ts:113`; the persistable `legacyBotConfigSchema` uses `legacySymbolConfigSchema` at `apps/web/src/features/bots/config.ts:128` and `apps/web/src/features/bots/config.ts:138`; form parsing builds Legacy rows from editable form fields only and never reads a provider pub_id field at `apps/web/src/features/bots/config.ts:492` and `apps/web/src/features/bots/config.ts:500`. Recommendation: keep `providerPubId` out of persistable user and system-default config schemas; use `LegacyRuntimeSymbolConfig` only where runtime/provider evidence is displayed. Target part: persistable Legacy config schema.
2. Severity: Medium. Lower persistence and action boundaries already reject provider identity even if hostile input reaches them. Evidence: user config forbidden keys include `providerpubid`, `provideraccountid`, `provideraccounts`, `liveconfig`, and `rawjson` at `apps/web/src/features/bots/config.ts:724`; `safeUserBotConfigForProduct` asserts those keys before schema parsing at `apps/web/src/features/bots/config.ts:765`; server-action hidden FormData rejects the same family at `apps/web/src/features/bots/config-action-handler.ts:58`; DB `saveBotConfig` and `saveBotGlobalConfig` both call the recursive forbidden-key assertion at `packages/db/src/repositories.ts:2175` and `packages/db/src/repositories.ts:2087`. Recommendation: preserve this belt-and-suspenders contract after any type cleanup, because Zod object parsing alone would strip unknown keys rather than proving they were absent. Target part: user/global config persistence boundary.
3. Severity: High. Runtime/display consumers still need an explicit provider-display DTO because `BotConfigView.raw` is intentionally sanitized before pages read it. Evidence: the sanitizer removes `providerpubid`, `provideraccountid`, and `provideraccounts` at `apps/web/src/features/bots/runtime-config-sanitizer.ts:17`; `data.tsx` builds the runtime config view from `rawMetric.liveConfig` through `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:629` and `apps/web/src/features/bots/data.tsx:633`; the bot dashboard then reads `runtimeConfig?.providerAccounts`, `activeSlots`, and `activeOrderSummary` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:126` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:134`; statistics does the same at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:240` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:248`. Recommendation: do not re-add provider identity to user config to feed these screens; instead add a narrow masked/count-only `LegacyRuntimeDisplayView` or use the existing readiness/provider-mapping DTO for user pages. Target part: user runtime display payload.
4. Severity: Medium. Display tables that legitimately show provider identity should use runtime/display types, not persistable config types. Evidence: `LegacyAveragingConfigTable` accepts `LegacyRuntimeSymbolConfig[]` and only renders pub_id labels when `showProviderIdentity` is true at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:57` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:72`; `LegacyOperationsPanel` accepts `LegacyRuntimeSymbolConfig[]` and groups `providerPubId` plus runtime `providerAccounts`, slots, and orders at `apps/web/src/features/bots/statistics-panels.tsx:456` and `apps/web/src/features/bots/statistics-panels.tsx:465`; settings/setup editable tables pass persistable `legacyRows` with only provider-account counts at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:512` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:481`. Recommendation: keep editable settings/setup on persistable rows; reserve `showProviderIdentity` and runtime row parsing for read-only snapshot panels. Target part: display table typing.
5. Severity: Medium. Export is safe if `providerPubId` is removed from the user config schema, but the export helper duplicates the base/runtime schema split and can drift. Evidence: `config-export.ts` defines a provider-free `legacySymbolConfigSchema` and a provider-bearing `legacyRuntimeSymbolConfigSchema` at `apps/web/src/features/bots/config-export.ts:72` and `apps/web/src/features/bots/config-export.ts:74`; export tolerates runtime rows through `legacyRuntimeSymbolConfigsFromConfig` and then deletes `providerPubId` before serializing at `apps/web/src/features/bots/config-export.ts:249` and `apps/web/src/features/bots/config-export.ts:253`; static coverage asserts both the runtime parser and deletion at `tests/integration/bot-config-export-static.test.ts:21` and `tests/integration/bot-config-export-static.test.ts:24`. Recommendation: centralize or re-export the base/runtime schemas from one module, or keep a static drift test that fails if export regains a persistable provider field. Target part: config export.
6. Severity: Low. Admin provider-identity surfaces are already classified as read-only display/mapping consumers rather than user config consumers. Evidence: admin fleet diagnostics masks provider pub_id before rendering at `apps/web/src/features/admin/bot-health-loader.ts:100` and maps raw runtime `providerPubId` rows to masked display rows at `apps/web/src/features/admin/bot-health-loader.ts:268` and `apps/web/src/features/admin/bot-health-loader.ts:294`; admin user detail masks `providerAccountId` in the loader at `apps/web/src/features/admin/user-bot-detail-loader.ts:636` and `apps/web/src/features/admin/user-bot-detail-loader.ts:649`; the page explicitly says the mapping is read-only and scopes persisted WTC facts at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:157` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:160`. Recommendation: keep admin mapping/fleet display types separate from `bot_configs.config`; never use admin mapping rows to seed saved Legacy strategy config. Target part: admin provider mapping display.
7. Severity: Low. Exact removal risk for historical saved user configs: rows that already contain provider identity will no longer be accepted as user overrides and will fall back to system/default config with a source issue. Evidence: user config parsing runs `parseUserBotConfigForProduct`, and invalid user configs are converted into `Saved custom profile failed validation` at `apps/web/src/features/bots/config.ts:930` and `apps/web/src/features/bots/config.ts:953`; the source issue copy is defined at `apps/web/src/features/bots/config.ts:857`; `saveBotConfig` would have blocked new provider-bearing rows at `packages/db/src/repositories.ts:2175`. Recommendation: if any pre-guard rows might exist, run a DB-only audit query for `providerPubId`/`providerAccountId` in `bot_configs.config` and `bot_config_versions.config_json` before claiming zero migration impact. Target part: historical persisted data.

## Decisions
1. Classified `LegacySymbolConfig` / `legacySymbolConfigSchema` as the persistable user/global config type.
2. Classified `LegacyRuntimeSymbolConfig` / `legacyRuntimeSymbolConfigsFromConfig` as the runtime row type for read-only worker/provider snapshots.
3. Classified `providerAccounts`, `activeSlots`, and `activeOrderSummary` as runtime display payloads, not config payloads.
4. Classified `bot_provider_accounts.providerAccountId` as admin/readiness mapping data that may be counted or masked, not saved into user config.
5. No recommendation requires re-adding `providerPubId` to the user config schema.

## Risks
1. User-facing dashboard/statistics/settings pages can under-report provider identity if they keep deriving identity from sanitized `BotConfigView.raw`.
2. The duplicated base/runtime Zod schemas in `config.ts` and `config-export.ts` can drift in a later phase.
3. Historical dirty rows with provider identity in saved user config would now be ignored as invalid user overrides; this is safer than persisting identity, but should be audited before a production migration claim.
4. The worktree was already heavily dirty before this handoff; this audit did not attribute or revert pre-existing product/test/doc changes.

## Verification/tests
RUN:
1. Required protocol/docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`.
2. Targeted `rg` and line-numbered inspection of all listed runtime/display/export consumers plus admin fleet and provider-mapping boundaries.
3. `npm run typecheck -w @wtc/web` - passed.
4. `npx vitest run tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` - 3 files, 29 tests passed.

NOT RUN:
1. Full `npm test`, full lint, full build, Playwright/e2e, preview/browser checks - skipped because this was a focused read-only consumer audit.
2. DB audit query for historical provider identity in saved configs - skipped because no DB mutation/provider/live access was in scope.
3. Live bot start/stop/apply-config/retest, worker tick/restart, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.

## Next actions
1. Add a narrow `LegacyRuntimeDisplayView` or equivalent masked/count-only provider snapshot DTO for user pages that need pub_id counts, active slots, active orders, and provider-account evidence.
2. Update dashboard/statistics/settings display consumers to stop reading provider identity from sanitized `BotConfigView.raw`; keep `BotConfigView.raw` provider-stripped.
3. Centralize the Legacy base/runtime schema pair or add a stronger drift guard between `config.ts` and `config-export.ts`.
4. Run a DB-only historical saved-config audit for provider identity markers before claiming no migration impact from the user-schema removal.
