# bot-config-action-tests-auditor handoff
## Scope
Read-only Phase 3.91 audit of current Vitest/static/PGlite coverage around bot config save/default/preset/source behavior. Focus was the current test surface for locked-default rejection/no-write, malicious extra FormData keys, invalid override fallback/sourceIssue, and no live apply/start/stop call path. No product code, tests, package files, migrations, env, vault, live services, SSH/tmux/systemd, provider DB, worker, or bot state were changed or touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`
5. `apps/web/src/features/bots/config.ts`
6. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
7. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
8. `apps/web/src/app/admin/bots/config/page.tsx`
9. `apps/web/src/features/admin/actions.ts`
10. `apps/web/src/features/admin/schemas.ts`
11. `apps/web/src/lib/backend.ts`
12. `packages/db/src/repositories.ts`
13. `tests/integration/db-0002.test.ts`
14. `tests/integration/admin-global-bot-config-db.test.ts`
15. `tests/integration/admin-global-bot-config-static.test.ts`
16. `tests/integration/user-resolved-bot-config-db.test.ts`
17. `tests/integration/user-resolved-bot-config-static.test.ts`
18. `tests/integration/bot-config-source-audit-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/bot-config-review-static.test.ts`
21. `tests/integration/bot-config-export-static.test.ts`
22. `tests/integration/bot-config-export-route-handler.test.ts`
23. `tests/integration/bot-runtime-config-sanitizer.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The settings/setup config save/default/preset actions still lack runtime tests because they are page-local server-action closures, not extracted dependency-injected helpers. Evidence: Phase 3.90 explicitly left "Settings/setup server-action runtime behavior" and "Settings/setup action-helper runtime tests" not run at `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`; current settings actions are local at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:89`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:111`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:134`; setup equivalents are local at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:97`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:119`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:142`; current coverage is static string coverage at `tests/integration/user-resolved-bot-config-static.test.ts:37` and `tests/integration/bot-read-safety-static.test.ts:278`. Recommendation: extract a small `apps/web/src/features/bots/config-action-handlers.ts` with injected `assertCsrf`, `requireUser`, `botAccessForUser`, `persistBotConfig`, `selectSystemDefaultBotConfig`, `redirect`/outcome hooks, and no live-control dependency; then add runtime Vitest cases that call the helper with real `FormData`. Target part: settings/setup user config action layer.
2. Severity: High. Locked-default rejection/no-write is implemented in the feature path but not proven by PGlite or action runtime tests. Evidence: `persistBotConfig` rejects when a published system default has `allowUserOverride` false at `apps/web/src/features/bots/config.ts:952` and `apps/web/src/features/bots/config.ts:955`; settings/setup map that error to locked redirects at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:102` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:110`; existing PGlite user-source tests only exercise `allowUserOverride: true` at `tests/integration/user-resolved-bot-config-db.test.ts:170`; lower-level `saveBotConfig` itself has no lock policy and writes when called at `packages/db/src/repositories.ts:2175`. Recommendation: add a PGlite-backed feature/helper test that seeds a published default with `allowUserOverride: false`, attempts manual save and preset save, asserts locked outcome, and asserts `bot_configs`/`bot_config_versions` counts are unchanged; use a pure injected action test to verify both settings and setup redirect/revalidate behavior. Target part: user override lock enforcement.
3. Severity: Medium. Malicious extra FormData keys are only indirectly covered for user actions; there is no runtime proof that hostile fields are rejected or ignored before persistence. Evidence: user form parsing whitelists known fields through `Object.fromEntries(fields.map(...))` at `apps/web/src/features/bots/config.ts:365` and row-specific readers at `apps/web/src/features/bots/config.ts:402`, while forbidden config-object keys are guarded after parsing at `apps/web/src/features/bots/config.ts:696` and `apps/web/src/features/bots/config.ts:734`; admin global config has an explicit `formData.keys()` guard at `apps/web/src/features/admin/actions.ts:484` and calls it before parsing at `apps/web/src/features/admin/actions.ts:492`, but the user settings/setup save actions do not have an equivalent form-key guard at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:89` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:97`. Existing PGlite tests cover forbidden config objects at `tests/integration/db-0002.test.ts:69` and global defaults at `tests/integration/admin-global-bot-config-db.test.ts:181`, not hostile user `FormData`. Recommendation: in the new pure action-helper tests, submit valid bot rows plus extra keys such as `apiKey`, `providerAccountId`, `rawJson`, `liveConfig`, `applyConfig`, `startBot`, `stopBot`, and `symbolConfigs`; assert the chosen contract explicitly, preferably fail with config error/no write, or at minimum assert the persisted config is exactly the parsed whitelist and contains no unsafe markers. Target part: user FormData boundary.
4. Severity: Medium. Invalid saved override fallback/sourceIssue is statically asserted but not runtime-tested with DB state. Evidence: invalid profile fallback is implemented via `invalidUserConfigIssue` at `apps/web/src/features/bots/config.ts:840` and `loadBotConfig` falls back to system/default while preserving `sourceIssue` at `apps/web/src/features/bots/config.ts:913` and `apps/web/src/features/bots/config.ts:928`; static tests only check source strings at `tests/integration/bot-config-source-audit-static.test.ts:42` and `tests/integration/user-resolved-bot-config-static.test.ts:16`; existing PGlite source tests cover published defaults and valid user overrides at `tests/integration/user-resolved-bot-config-db.test.ts:102` and `tests/integration/user-resolved-bot-config-db.test.ts:170`. Recommendation: extract the config-state resolver or allow a DB-injected loader, then add a PGlite fixture with a historical invalid but non-forbidden user config (for example out-of-range numeric values), a valid published default, and assertions that `source` falls back, `current` is the fallback, `userCurrent` is null, and `sourceIssue.title` is "Saved custom profile failed validation". Target part: source resolution/read model.
5. Severity: Medium. No-live apply/start/stop is covered by static action scans and adapter package tests, but not by runtime action-path tests for save/default/preset. Evidence: static source chooser surfaces reject live-control strings at `tests/integration/user-resolved-bot-config-static.test.ts:87`; metadata check action snippets are statically asserted not to call adapter/fetch/live controls at `tests/integration/bot-read-safety-static.test.ts:329`; package adapters throw disabled errors separately, but settings/setup config actions only call `persistBotConfig` or `selectSystemDefaultBotConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:126`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:143`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:111`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:134`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:151`. Recommendation: add pure injected helper tests with poison live-control spies, or better no live-control dependency in the helper options at all; assert save, preset, and use-system-default paths complete without any adapter/start/stop/apply hook being available or called. Target part: bot config action safety boundary.

## Decisions
1. Did not run broad/full tests; static inspection was enough to classify the coverage gaps without mutating product/test files or touching live systems.
2. Classified tests by the right layer: pure injected helpers for server-action branching, redirect/revalidate behavior, hostile `FormData`, and live-call absence; PGlite lower-level tests for repository write/no-write counts and historical DB state such as invalid saved config fallback.
3. Treated current DB repository tests as real coverage for forbidden persisted config objects, not as proof of the page-action `FormData` contract.
4. Treated `getServerDb()` global selection as a reason to extract an injectable resolver/handler before writing robust PGlite tests for `loadBotConfig` behavior.

## Risks
1. Until action helpers are extracted, tests can keep passing while page-local server actions regress in redirect target, revalidation, or persistence-call order.
2. If malicious user `FormData` is meant to be rejected rather than ignored, the current user action contract is not locked by tests.
3. Locked system defaults rely on `persistBotConfig`; direct repository calls intentionally do not enforce the lock, so action/feature-level tests are required to prevent future bypass.
4. Invalid override fallback can drift because current PGlite tests do not exercise a real saved invalid row through the config-state resolver.

## Verification/tests
RUN:
1. Read required protocol and prior handoff files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`.
2. Targeted static inspection with `rg`/`Get-Content` over the requested tests, config feature, settings/setup pages, admin global config action, backend DB selector, and DB repositories.
3. Confirmed the requested handoff path did not exist before writing it.

NOT RUN:
1. Broad/full Vitest, typecheck, lint, build, Playwright/e2e, preview/browser screenshots - not necessary for this read-only coverage audit.
2. PGlite test execution - skipped because the task was to inspect current coverage and specify precise tests to add.
3. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.
4. Background agent launch/cleanup - this was a single named read-only auditor lane; no background agents were spawned by this auditor.

## Next actions
1. Extract the settings/setup save, preset, and use-system-default action logic into a dependency-injected bot config action helper, keeping page files as thin wrappers.
2. Add `tests/integration/bot-config-action-handlers.test.ts` covering manual save, preset save, use-system-default, denied access, invalid form, invalid preset, locked default redirects, no revalidate on failure, and no live-control dependency/call.
3. Add hostile `FormData` cases for extra secret/provider/raw/live-control keys and assert the agreed contract: reject with no write, or explicitly ignore extras while persisting only whitelisted parsed config.
4. Add a PGlite-backed invalid saved override/sourceIssue test after the resolver is injectable, and a locked-default no-write test that counts `bot_configs` and `bot_config_versions`.
