# admin-global-provider-identity-boundary-auditor handoff
## Scope
Read-only Phase 3.93 audit of the admin/global bot config provider identity persistence boundary. Scope was limited to determining whether admin-published system defaults can persist `providerPubId`, `providerAccountId`, `providerAccounts`, `rawJson`, or live-control fields through the admin route/page, server action, schemas, config builders, DB repositories, and focused tests. No product code, tests, existing docs, live services, provider DB, worker, exchange, SSH, tmux, systemd, env, vault, or bot state were modified or touched.

This is one named read-only auditor handoff, not an N-agent audit claim. No background agents were spawned in this thread, so none required cleanup.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md`
8. `apps/web/src/app/admin/bots/config/page.tsx`
9. `apps/web/src/features/admin/actions.ts`
10. `apps/web/src/features/admin/schemas.ts`
11. `apps/web/src/features/bots/config.ts`
12. `packages/db/src/repositories.ts`
13. `tests/integration/admin-global-bot-config-db.test.ts`
14. `tests/integration/admin-global-bot-config-static.test.ts`
15. `tests/integration/db-0002.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The normal admin route/action path blocks the named provider identity, raw runtime, and live-control fields before it calls the repository. Evidence: the route displays system-default scope and disabled live control (`apps/web/src/app/admin/bots/config/page.tsx:101`, `apps/web/src/app/admin/bots/config/page.tsx:109`), uses the admin save action (`apps/web/src/app/admin/bots/config/page.tsx:133`), and the action runs `requireUser`, `assertAdmin`, `assertCsrf`, form-key guard, strict metadata schema, product config parser, and recursive config guard before `saveBotGlobalConfig` (`apps/web/src/features/admin/actions.ts:496`, `apps/web/src/features/admin/actions.ts:499`, `apps/web/src/features/admin/actions.ts:500`, `apps/web/src/features/admin/actions.ts:502`, `apps/web/src/features/admin/actions.ts:521`, `apps/web/src/features/admin/actions.ts:526`, `apps/web/src/features/admin/actions.ts:532`). Recommendation: keep admin-published defaults routed only through this action and keep route tests asserting no adapter/live-control calls. Target part: admin global config route/action.
2. Severity: High. The repository backstop blocks `providerPubId`, `providerAccountId`, `providerAccounts`, `rawJson`, and common live-control keys such as `applyConfig`, `startBot`, and `stopBot` before writing current rows, version rows, or audit metadata. Evidence: the shared repository forbidden-key set includes provider/raw/common live keys (`packages/db/src/repositories.ts:506`, `packages/db/src/repositories.ts:520`, `packages/db/src/repositories.ts:521`, `packages/db/src/repositories.ts:523`, `packages/db/src/repositories.ts:525`, `packages/db/src/repositories.ts:532`, `packages/db/src/repositories.ts:533`, `packages/db/src/repositories.ts:534`); `saveBotGlobalConfig` calls that guard before its transaction (`packages/db/src/repositories.ts:2072`, `packages/db/src/repositories.ts:2089`); the write path stores `input.config` in both `bot_global_configs` and `bot_global_config_versions` only after the guard (`packages/db/src/repositories.ts:2111`, `packages/db/src/repositories.ts:2118`, `packages/db/src/repositories.ts:2145`, `packages/db/src/repositories.ts:2154`); focused DB tests reject nested provider/raw/common live fields without count changes (`tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-db.test.ts:184`, `tests/integration/admin-global-bot-config-db.test.ts:186`, `tests/integration/admin-global-bot-config-db.test.ts:189`, `tests/integration/admin-global-bot-config-db.test.ts:191`, `tests/integration/admin-global-bot-config-db.test.ts:195`, `tests/integration/admin-global-bot-config-db.test.ts:220`). Recommendation: keep this repository guard as the final backstop for normal provider identity/raw fields. Target part: `packages/db/src/repositories.ts` and `tests/integration/admin-global-bot-config-db.test.ts`.
3. Severity: High. The repository backstop is incomplete for three live-control aliases that the admin action already knows about: `liveControl`, `exchangeApply`, and `exchangeOrder`. Evidence: the admin action forbidden set includes `exchangeapply`, `exchangeorder`, and `livecontrol` (`apps/web/src/features/admin/actions.ts:464`, `apps/web/src/features/admin/actions.ts:465`, `apps/web/src/features/admin/actions.ts:467`), but the repository forbidden set ends at `testexchange` and does not include those aliases (`packages/db/src/repositories.ts:506`, `packages/db/src/repositories.ts:539`, `packages/db/src/repositories.ts:540`); the DB test forbidden cases cover provider/raw plus `applyConfig`/`startBot`/`stopBot` but not these aliases (`tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-db.test.ts:191`, `tests/integration/admin-global-bot-config-db.test.ts:192`); an in-memory PGlite proof this session called `saveBotGlobalConfig` directly and observed `liveControl: ACCEPTED persisted=true`, `exchangeApply: ACCEPTED persisted=true`, and `exchangeOrder: ACCEPTED persisted=true`. Recommendation: add `exchangeapply`, `exchangeorder`, and `livecontrol` to `FORBIDDEN_BOT_CONFIG_KEYS`, then add focused DB tests proving they reject without appending current/version/audit rows. Target part: repository guard and admin-global DB tests.
4. Severity: Medium. Persistable Legacy config excludes `providerPubId`; only the runtime/display schema allows it. Evidence: `legacySymbolConfigSchema` is provider-free while `legacyRuntimeSymbolConfigSchema` alone extends it with optional `providerPubId` (`apps/web/src/features/bots/config.ts:111`, `apps/web/src/features/bots/config.ts:113`, `apps/web/src/features/bots/config.ts:114`), and `legacyBotConfigSchema` persists `symbolConfigs` through the provider-free schema (`apps/web/src/features/bots/config.ts:128`, `apps/web/src/features/bots/config.ts:138`). The global action builds Legacy rows from form data through `legacySymbolConfigSchema` and no longer reads provider pub-id form fields (`apps/web/src/features/bots/config.ts:492`, `apps/web/src/features/bots/config.ts:500`, `apps/web/src/features/bots/config.ts:523`). Recommendation: keep runtime identity display paths separate from editable/admin-published defaults. Target part: `apps/web/src/features/bots/config.ts`.
5. Severity: Medium. Audit rows for global default saves are metadata-only and do not store raw strategy JSON or provider identity. Evidence: `saveBotGlobalConfig` writes raw config to config/version rows but audit `after` includes metadata only (`packages/db/src/repositories.ts:2145`, `packages/db/src/repositories.ts:2154`, `packages/db/src/repositories.ts:2158`, `packages/db/src/repositories.ts:2165`), and focused tests assert audit rows omit `symbolConfigs`, symbols, `apiKey`, and `providerPubId` (`tests/integration/admin-global-bot-config-db.test.ts:224`, `tests/integration/admin-global-bot-config-db.test.ts:230`, `tests/integration/admin-global-bot-config-db.test.ts:232`, `tests/integration/admin-global-bot-config-db.test.ts:235`). Recommendation: preserve audit metadata-only shape and add the live-control alias regression once the repository guard is fixed. Target part: global config audit writer/tests.

## Decisions
1. Verdict for the normal admin UI/action path: admin-published system defaults cannot persist `providerPubId`, `providerAccountId`, `providerAccounts`, `rawJson`, or the audited live-control aliases through the route/action because the action constructs a typed config and blocks forbidden form/config keys before save.
2. Verdict for the repository boundary: direct `saveBotGlobalConfig` calls cannot persist the provider identity/raw fields listed above, but can currently persist `liveControl`, `exchangeApply`, and `exchangeOrder` because those aliases are missing from the repository forbidden-key set.
3. The focused tests are green, but current test coverage does not catch the repository alias gap.
4. No live or provider-backed state was inspected; this audit is limited to repo code, PGlite tests, and in-memory proof.

## Risks
1. High: a future internal caller that bypasses `adminSaveBotGlobalConfigAction` and calls `saveBotGlobalConfig` directly can persist `liveControl`, `exchangeApply`, or `exchangeOrder` into global config current/version rows until the repository guard is expanded.
2. Medium: the admin action and repository each maintain a separate forbidden-key set, which has already drifted. Centralizing or testing parity would reduce repeat drift.
3. Medium: direct table inserts can bypass repository guards; this audit did not add or inspect DB-level JSONB CHECK constraints outside the requested files.
4. Medium: historical persisted rows, if any, were not inspected because live/provider DB access was forbidden.
5. Low: the worktree was heavily dirty before this audit, including modified/untracked focus files; unrelated existing changes were preserved.

## Verification/tests
RUN:
1. Protocol/doc read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and Phase 3.92 handoff.
2. Static keyword scan: `rg -n "providerPubId|providerAccountId|providerAccounts|rawJson|live|start|stop|apply|control|GlobalBot|global bot|system default|system defaults|defaultConfig|admin"` across the requested focus files.
3. Focused tests: `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/db-0002.test.ts` - PASS, 3 files / 31 tests.
4. In-memory repository proof with PGlite migrations/seed and direct `saveBotGlobalConfig` calls - `liveControl: ACCEPTED persisted=true`; `exchangeApply: ACCEPTED persisted=true`; `exchangeOrder: ACCEPTED persisted=true`.
5. Worktree scope check for focus files via `git status --short -- <focus files>` - observed pre-existing modified/untracked focus files; no product/test/doc file was edited by this auditor.

NOT RUN:
1. Full `npm test` - skipped for read-only scoped audit; focused suites above were run.
2. `npm run lint`, root/web/worker typecheck, and build - skipped for read-only scoped audit and no product-code edits.
3. Playwright/e2e/preview/browser visual checks - skipped; no UI acceptance claim.
4. `npm run secret:scan` and `npm run governance:check` - skipped for scoped auditor handoff; no code or existing docs were edited.
5. Real Postgres `db:migrate`/`db:seed`, provider DB, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, and live server checks - NOT RUN because forbidden by the phase prompt/protocol.

## Next actions
1. Add `exchangeapply`, `exchangeorder`, and `livecontrol` to `FORBIDDEN_BOT_CONFIG_KEYS` in `packages/db/src/repositories.ts`.
2. Add `tests/integration/admin-global-bot-config-db.test.ts` cases proving `saveBotGlobalConfig` rejects `liveControl`, `exchangeApply`, and `exchangeOrder` without appending `bot_global_configs`, `bot_global_config_versions`, or audit rows.
3. Consider parity testing or centralizing the action/repository forbidden-key list to prevent future drift.
4. Re-run the focused Vitest command above after the fix; then run typecheck/lint/build if that slice edits product code.
