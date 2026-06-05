# bot-settings-row-error-security-auditor handoff
## Scope
Read-only Phase 3.96 security/action audit for adding row-targeted bot settings save errors. Scope was limited to the user bot settings form/action path, config parsing/sanitization boundaries, related admin system-default actions, and existing static/integration tests. No product code, tests, package files, generated artifacts, live services, env files, vaults, SSH, tmux, systemd, provider DB, exchange endpoints, worker tick/restart, or bot start/stop/apply/retest paths were changed or invoked.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/features/bots/config-action-handler.ts`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-types.ts`
12. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
13. `apps/web/src/features/bots/meta.ts`
14. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
15. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
16. `apps/web/src/features/admin/actions.ts`
17. `apps/web/src/app/admin/bots/config/page.tsx`
18. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
19. `apps/web/src/features/admin/user-bot-detail-loader.ts`
20. `tests/integration/bot-config-action-handler.test.ts`
21. `tests/integration/bot-config-review-static.test.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/admin-user-bot-detail-static.test.ts`
24. `tests/integration/admin-global-bot-config-static.test.ts`

## Files changed
None - read-only audit. Only this required handoff file was written: `docs/handoffs/20260604-0459-bot-settings-row-error-security-auditor.md`.

## Findings
1. Severity: High. The current user settings save path is safe but too coarse for row-targeted feedback. Evidence: settings actions route config failures to fixed `?err=config` paths in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:115`; `handleSaveBotConfigAction` redirects any forbidden key, form issue, or parse failure to `routes.configError` in `apps/web/src/features/bots/config-action-handler.ts:156`, `apps/web/src/features/bots/config-action-handler.ts:159`, and `apps/web/src/features/bots/config-action-handler.ts:162`; the page renders only a generic banner at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:257`. Recommendation: introduce a sanitized public row-error model and preserve the existing generic fallback for all non-row or unsafe failures. Target part: user settings save error UX.
2. Severity: High. Row targeting must not leak submitted values, raw configs, secret-shaped keys, provider pub_id data, or raw Zod issue text into URLs, logs, or rendered copy. Evidence: current row parsing can produce row-specific strings from Zod messages at `apps/web/src/features/bots/config.ts:397`, `apps/web/src/features/bots/config.ts:435`, `apps/web/src/features/bots/config.ts:472`, and `apps/web/src/features/bots/config.ts:486`; forbidden form keys are blocked before parsing/persistence in `apps/web/src/features/bots/config-action-handler.ts:44` and `apps/web/src/features/bots/config-action-handler.ts:156`; persisted user configs are recursively checked for forbidden keys before save in `apps/web/src/features/bots/config.ts:751` and `apps/web/src/features/bots/config.ts:959`. Recommendation: expose only bounded enums such as `section=tortila-symbol|legacy-symbol|legacy-stage`, `row=1..limit`, and optional generic codes like `range|duplicate|invalid`; never expose raw key names for forbidden submissions, raw issue messages, row values, config JSON, or provider identifiers. Target part: secret/config disclosure boundary.
3. Severity: High. The row-error redirect must remain a closed internal route, not an open redirect or query-injection surface. Evidence: canonical bot slugs are only `tortila` and `legacy` in `apps/web/src/features/bots/meta.ts:9`, resolved by `botMeta()` in `apps/web/src/features/bots/meta.ts:25`; the action helper resolves access before returning redirect failures in `apps/web/src/features/bots/config-action-handler.ts:112`; current settings routes are fixed internal paths in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:115`. Recommendation: build the redirect from the validated `ctx.slug` or `meta.slug`, append query with `URLSearchParams`, and parse any `focus`/`row` search param on render through a whitelist; do not accept `next`, `returnTo`, arbitrary path, arbitrary hash, or caller-supplied query fragments. Target part: redirect construction and searchParam parsing.
4. Severity: High. Adding row feedback must not introduce live bot apply, test, start/stop, network, or exchange behavior. Evidence: the helper has no adapter/network paths and existing tests assert this at `tests/integration/bot-config-action-handler.test.ts:212`; settings copy states WTC version-only save behavior at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:287`; persistence only saves a WTC bot config version through `persistBotConfig` and `saveBotConfig` in `apps/web/src/features/bots/config.ts:959` and `apps/web/src/features/bots/config.ts:973`; runtime config sanitization removes live-control and secret/runtime keys in `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`. Recommendation: keep row feedback entirely inside form validation/rendering; do not call adapters, worker jobs, exchange key tests, config export, runtime apply, or provider endpoints. Target part: live-control safety boundary.
5. Severity: High. Admin must not gain user-settings edit capability while row errors are added. Evidence: selected-user bot detail is admin-gated but read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:71` and explicitly labels `user settings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:92`; the same page states it does not edit mappings, saved settings, exchange keys, live config, or positions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:421`; admin system-default editing is a separate route/action with `user settings unaffected` copy at `apps/web/src/app/admin/bots/config/page.tsx:103` and saves only `bot_global_configs` via `adminSaveBotGlobalConfigAction` in `apps/web/src/features/admin/actions.ts:496` and `apps/web/src/features/admin/actions.ts:532`; static tests assert the user drilldown has no submit forms or admin config action at `tests/integration/admin-user-bot-detail-static.test.ts:63` and `tests/integration/admin-global-bot-config-static.test.ts:122`. Recommendation: wire row errors only into user-owned self-service settings and, if desired, admin system-default validation feedback; do not add any admin action that calls `persistBotConfig`, `saveBotConfig`, `ensureBotInstance` for selected-user config edits, or selected-user settings forms. Target part: RBAC/admin-user boundary.
6. Severity: Medium. Forbidden-key policy is duplicated across user action filtering, user config persistence, admin global defaults, and runtime config sanitization, so a row-error change could accidentally diverge the safety lists. Evidence: duplicated sets exist in `apps/web/src/features/bots/config-action-handler.ts:44`, `apps/web/src/features/bots/config.ts:713`, `apps/web/src/features/admin/actions.ts:431`, and `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`. Recommendation: either centralize the normalized forbidden-key registry in a shared server-safe helper or add focused static tests that prove all four lists still cover secret, provider, raw runtime, URL/header, and live-control aliases. Target part: forbidden-key alias governance.

## Decisions
1. Recommended implementation should keep the current redirect-based server-action flow rather than introducing a client-only validation authority.
2. Row feedback should be a sanitized public coordinate, not a raw validation message. Suggested public values: `tortila-symbol-1..8`, `legacy-symbol-1..14`, `legacy-stage-1..4`, and generic `config` fallback.
3. Forbidden-key failures should remain generic `err=config` with no row focus. They are security events, not helpful user-correction hints.
4. Duplicate-symbol failures may target the second duplicated row if computed server-side, but should still render generic duplicate copy without echoing the duplicated symbol.
5. Admin global defaults may reuse the same sanitized row-issue model for the system-default editor only; selected-user admin drilldown must remain view-only.

## Risks
1. If row details are carried as raw strings, Zod messages or submitted symbols could leak into the URL and browser history.
2. If redirect paths are built from the hidden `bot` field after adding query helpers, a future refactor could bypass the current `botMeta()` guard and create an internal open-redirect/query-injection bug.
3. If the UI highlights by untrusted search params without whitelist parsing, a malformed `focus` value could render confusing copy or brittle markup.
4. If admin and user settings share table components without source-specific action discipline, a future change could accidentally place user-config save controls on admin-selected user pages.
5. Current dirty worktree is broad; this audit did not normalize, revert, or validate unrelated parallel changes.

## Verification/tests
RUN:
1. Required WTC protocol/status documents and Phase 3.95 aggregate handoff were read before this handoff.
2. Targeted source/static audit was completed for the settings page, action helper, config schemas/parsers, runtime sanitizer, admin actions/pages, and relevant tests.
3. `git status --short --branch` was inspected; the worktree was already heavily dirty and all pre-existing changes were preserved.
4. No live service, provider DB, exchange endpoint, worker tick/restart, bot start/stop/apply/retest, env, vault, SSH, tmux, or systemd path was touched.

NOT RUN:
1. Product tests, typecheck, lint, build, Playwright, secret scan, and governance check - skipped because this was a read-only auditor lane whose only write was the required handoff.
2. Any DB migration/seed, provider check, runtime apply, config export, exchange metadata check, or live bot action - forbidden by scope.

Required implementation guardrails/tests:
1. Add a focused unit test in `tests/integration/bot-config-action-handler.test.ts` proving an invalid Tortila row redirects to a whitelisted row focus, persists nothing, and does not include the submitted value or raw Zod text in `redirectTo`.
2. Add a focused unit test for invalid Legacy symbol rows and Legacy stage rows with bounded `row` values only.
3. Add a duplicate-row test proving duplicate feedback does not echo the duplicate symbol in the URL or rendered error copy.
4. Add a malicious redirect/query test proving `bot=//evil.example`, `bot=legacy?x=...`, arbitrary `focus`, and arbitrary `next`/`returnTo` inputs do not redirect outside the canonical settings route.
5. Preserve and extend forbidden-key tests so `apiSecret`, `providerPubId`, `providerAccountId`, `rawJson`, `applyConfig`, `startBot`, `stopBot`, `retest`, and `liveControl` stay generic/no-write and do not receive row focus.
6. Extend static tests to assert the action helper still has no `fetch(`, `getBotAdapter`, `recordExchangeKeyMetadataCheck`, `addExchangeKey`, `startBot`, `stopBot`, `applyConfig`, or `retest`.
7. Keep admin tests proving `adminSaveBotGlobalConfigAction` saves only system defaults, does not call `persistBotConfig`/`saveBotConfig` for selected users, and the selected-user bot drilldown has no forms, CSRF fields, or submit buttons.
8. Run at minimum after implementation: `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts`, plus `npm run typecheck -w @wtc/web`, `npm run lint`, and `npm run secret:scan`.

## Next actions
1. Implement a small sanitized row-error type in the bot config/action boundary and keep the current generic config error as fallback.
2. Add whitelisted search-param parsing on the settings page and pass a validated focus prop into `TortilaSymbolConfigTable` and `LegacyAveragingConfigTable`.
3. Render row-local generic hints near the affected card/stage row without echoing submitted values or raw schema messages.
4. Add the guardrail tests listed above before any rendered/e2e acceptance claim.
