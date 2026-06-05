# bot-admin-drilldown-security-auditor handoff
## Scope
Read-only security and data-boundary audit for a possible admin bot explorer / selected-user drilldown enhancement after Phase 3.97. The audit identifies approved safe fields and sources for admin user list, provider pub_id identity, config source, settings summary, warning summary, snapshots, positions, trades, and equity; it also identifies forbidden sources/actions, RBAC/CSRF boundaries, and user-vs-admin separation.

No product code, tests, package metadata, env/vault/secret files, live services, provider DB, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, or browser preview was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
8. `docs/handoffs/20260604-0531-bot-operation-map-security-auditor.md`
9. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
10. `apps/web/src/app/admin/users/page.tsx`
11. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
12. `apps/web/src/app/admin/bots/page.tsx`
13. `apps/web/src/features/admin/queries.ts`
14. `apps/web/src/features/admin/types.ts`
15. `apps/web/src/features/admin/user-bot-detail-loader.ts`
16. `apps/web/src/features/admin/bot-health-loader.ts`
17. `apps/web/src/features/admin/health-detail.ts`
18. `apps/web/src/features/admin/actions.ts`
19. `apps/web/src/features/admin/schemas.ts`
20. `apps/web/src/features/bots/data.tsx`
21. `apps/web/src/features/bots/config.ts`
22. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
23. `apps/web/src/features/bots/readiness-loader.ts`
24. `packages/db/src/schema.ts`
25. `packages/db/src/repositories.ts`
26. `package.json`
27. `tests/integration/admin-user-bot-detail-static.test.ts`
28. `tests/integration/admin-user-bot-detail-loader.test.ts`
29. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
30. `tests/e2e/admin-user-bot-detail-db.spec.ts`
31. `tests/integration/admin-bot-health-loader.test.ts`
32. `tests/integration/admin-responsive.test.ts`
33. `tests/integration/bot-read-safety-static.test.ts`
34. `tests/integration/bot-runtime-config-sanitizer.test.ts`

## Files changed
1. `docs/handoffs/20260604-0603-bot-admin-drilldown-security-auditor.md`

## Findings
1. Severity: High. Admin user list is approved only through the existing safe projection, not raw DB user rows. Evidence: `/admin/users` requires `requireUser()` plus `assertAdmin()` before `loadAdminUsers()` at `apps/web/src/app/admin/users/page.tsx:19`; `AdminUserView` documents that `passwordHash` is stripped and exposes only id/email/displayName/roles/createdAt/lockout summary at `apps/web/src/features/admin/types.ts:7`; `loadAdminUsers()` maps `listUsersWithCreatedAt()` rows through `mapToAdminUserView()` before returning at `apps/web/src/features/admin/queries.ts:148`; the repository warns `listUsersWithCreatedAt()` includes `passwordHash` and must never be returned directly at `packages/db/src/repositories.ts:3781`. Recommendation: an admin explorer may list only `AdminUserView` fields plus the existing bot-detail link; never render or pass through `DbUserWithCreatedAt`, `passwordHash`, session rows, auth tokens, or raw audit actor payloads. Target part: admin user list.
2. Severity: High. Provider/pub_id identity is approved only as a WTC mapping and masked display value. Evidence: raw Legacy pub_id is stored as `bot_provider_accounts.provider_account_id` at `packages/db/src/schema.ts:146`; the selected-user loader masks short ids to `id#<hash>` and long ids to a prefix/suffix display at `apps/web/src/features/admin/user-bot-detail-loader.ts:215`; `mapProviderAccountSummary()` returns provider, masked providerAccountId, label, status, and updatedAt at `apps/web/src/features/admin/user-bot-detail-loader.ts:636`; Legacy runtime rows match selected-user data only when the active WTC provider mapping id equals `botProviderAccountId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:706`. Recommendation: approved selected-user fields are provider, masked providerAccountId/pub_id, label, status, updatedAt, providerScope, and mapped-owner link; raw pub_id is server-side join material only and must not be a route param, API response, search key visible in UI, log line, or cache key exposed to the client. Target part: provider identity.
3. Severity: High. Config source and settings summary are approved as derived summaries only. Evidence: current user config rows are selected from `bot_configs` at `apps/web/src/features/admin/user-bot-detail-loader.ts:881`; user/default/built-in source resolution uses product-specific Zod validation through `safeAdminResolvedConfig()` at `apps/web/src/features/admin/user-bot-detail-loader.ts:415`; `mapResolvedConfigSummary()` projects sourceLabel/sourceDetail/userVersion/systemDefault projection/operationMode/symbol counts/stage capacity/riskSummary/notes at `apps/web/src/features/admin/user-bot-detail-loader.ts:512`; tests assert the loader does not select `botConfigVersions` and does not leak raw config markers at `tests/integration/admin-user-bot-detail-static.test.ts:41` and `tests/integration/admin-user-bot-detail-loader.test.ts:607`. Recommendation: approve `AdminUserBotConfigSummary` fields only; forbid raw `config`, `configJson`, config history bodies, provider account arrays, `globalConfigId`, `selectedGlobalVersion`, raw Zod messages, and submitted form values in the drilldown. Target part: config/settings summary.
4. Severity: High. Warning summary is approved through canonical warning-code projection, not arbitrary provider strings. Evidence: `projectHealthDetail()` allowlists health-detail keys, redacts first, normalizes warning codes, and deletes raw `warningCodes` at `apps/web/src/features/admin/health-detail.ts:4`; selected-user warnings start from registry warnings and include Tortila runtime health only from sanitized health rows at `apps/web/src/features/admin/user-bot-detail-loader.ts:270`; Legacy runtime warnings are included only when an active provider mapping exists and the worker reported exactly one mapped/snapshotted provider account at `apps/web/src/features/admin/user-bot-detail-loader.ts:292`; tests prove health secret markers and provider-origin quarantine reason do not appear in selected-user detail at `tests/integration/admin-user-bot-detail-loader.test.ts:612`. Recommendation: approve status, count, maxSeverity, canonical warning code/severity/title/detail, evaluatedAt, source, scope, and note; do not render raw `detail`, raw `warningCodes`, provider error bodies, bearer/token strings, DB URLs, or "none reported" as a green all-clear. Target part: warning summary.
5. Severity: High. Selected-user snapshots/positions/trades/equity are approved only from persisted WTC DB read-model tables and only after user-instance plus Legacy provider-scope filtering. Evidence: selected-user loader first resolves bot instances by `userId` and product code at `apps/web/src/features/admin/user-bot-detail-loader.ts:831`; it selects metric, position, and trade columns from snapshot/import tables without `rawJson` at `apps/web/src/features/admin/user-bot-detail-loader.ts:892`; Legacy rows are filtered by active provider account id in `scopedRows()` and `buildAdminBotStats()` at `apps/web/src/features/admin/user-bot-detail-loader.ts:715`; DTO types define the approved metric, position, trade, equity, and stats-source fields at `apps/web/src/features/admin/types.ts:39`; tests seed other-user rows, unscoped Legacy fleet rows, raw trade payloads, and sealed secrets, then assert none leak into the selected-user JSON at `tests/integration/admin-user-bot-detail-loader.test.ts:569`. Recommendation: approve `AdminUserBotMetricSummary`, `AdminUserBotPositionSummary`, `AdminUserBotTradeSummary`, `AdminUserBotEquityPoint`, and `AdminUserBotStatsSourceSummary`; forbid `rawJson`, unscoped Legacy rows, other-user bot instances, provider DB live queries during render, direct adapter calls, and computed user attribution from fleet rows without a WTC mapping. Target part: selected-user runtime facts.
6. Severity: High. User and admin bot surfaces must remain separate. Evidence: user bot loading resolves the current session user and entitlement before returning bot access at `apps/web/src/features/bots/data.tsx:29`; production DB snapshots require a user-owned bot instance at `apps/web/src/features/bots/data.tsx:433`; Legacy user DB reads fail closed unless exactly one active provider mapping exists at `apps/web/src/features/bots/data.tsx:469`; static tests assert bot pages use `loadBotReadModelForUser()` and do not call adapters directly at `tests/integration/bot-read-safety-static.test.ts:65`. Recommendation: user pages must never import admin loaders or cross-user DTOs; admin pages must use dedicated admin projections and visible read-only labels. Target part: user-vs-admin separation.
7. Severity: High. RBAC/CSRF boundaries are adequate for current read-only drilldown and nearby provider-mapping mutations, but a future explorer must not blur them. Evidence: selected-user bot page requires `requireUser()` and `assertAdmin()` before calling `loadAdminUserBotDetail()` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72`; the same page labels live control, user settings, and provider mappings as disabled/read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:87`; rendered DB e2e asserts the page has zero forms, zero CSRF hidden fields, and zero start/stop/apply/test buttons at `tests/e2e/admin-user-bot-detail-db.spec.ts:126`; provider mapping/disable actions separately require `requireUser`, `assertAdmin`, `assertCsrf`, Zod schemas, DB-only repos, and audit/revalidate at `apps/web/src/features/admin/actions.ts:354`. Recommendation: the proposed drilldown should remain render-only; any future mapping mutation must stay on a separate admin action surface with CSRF, Zod, audit, reason, and no live-control side effects. Target part: RBAC/CSRF/action split.
8. Severity: High. Live-control, secret, provider-runtime, and process-control sources are forbidden for this enhancement. Evidence: protocol forbids live server/bot/secret mutation during discovery at `docs/SESSION_PROTOCOL.md:83`; the seed forbids live bot control, SSH, tmux, systemd, process control, and `.env` mutation at `docs/handoffs/0000-orchestrator-seed.md:117`; admin global config rejects secret/control/provider/raw keys including providerAccountId, rawJson, applyConfig, startBot, stopBot, restart, retest, testExchange, and liveControl at `apps/web/src/features/admin/actions.ts:435`; runtime config sanitizer drops the same class of provider/control/raw keys before returning a `BotConfigView` at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`. Recommendation: forbid `exchange_api_key_secrets`, sealed vault records, env/vault files, raw provider DB payloads, raw `botMetricSnapshots.rawJson`, raw `botTradeImports.rawJson`, exchange clients, `getBotAdapter()` calls in admin drilldown, worker tick/restart, start/stop/apply/retest, SSH, tmux, and systemd. Target part: forbidden source/action boundary.
9. Severity: Medium. Existing fleet health DTO contains a raw-provider `quarantineReason` slot that is not rendered today but is not approved for selected-user drilldown. Evidence: `LegacyProviderAccountAdminView` includes `quarantineReason` at `apps/web/src/features/admin/types.ts:359`; `bot-health-loader` copies `row.quarantineReason` from Legacy liveConfig into the DTO at `apps/web/src/features/admin/bot-health-loader.ts:277`; the current admin bot page renders status, balance, symbols, slots, orders, and snapshot but not quarantineReason in the Legacy pub_id table at `apps/web/src/app/admin/bots/page.tsx:480`. Recommendation: do not promote `quarantineReason` into selected-user drilldown or owner explorer detail unless it is converted to registry-owned warning codes or passed through `projectHealthDetail()`-style allowlisting/redaction; add a static guard if the field remains on the DTO. Target part: future fleet-to-user drilldown expansion.

## Decisions
1. Approved admin user-list source: `loadAdminUsers()` returning `AdminUserView` only. Approved fields: id, email, displayName, roles, createdAt, lockout.failedLoginTotalCount, lockout.lastFailedLoginAt, lockout.accountLockedUntil, lockout.accountLockoutReviewRequiredAt, lockout.isLocked, lockout.requiresReview, lockout.unlockable, and a link to `/admin/users/<id>/bots`.
2. Approved selected-user drilldown source: `loadAdminUserBotDetail()` / `loadAdminUserBotDetailFromDb()` only. The page may show `mode`, `user`, `bots`, `exchangeKeys`, `providerAccounts`, `liveControlDisabled`, and `legacyProviderScopeWarning` after admin RBAC.
3. Approved provider identity fields: provider, masked providerAccountId/pubId, label, status, updatedAt, providerScope, mapped user display/email/userId only when a WTC active mapping exists. Raw pub_id/providerAccountId is allowed only as server-side matching material inside loaders/actions.
4. Approved config/settings fields: `AdminUserBotConfigSummary` source, version, updatedAt, sourceLabel, sourceDetail, userVersion, userUpdatedAt, resolvedFromUserSelection, userConfigIgnoredByLock, systemDefault projection, operationMode, symbolCount, symbols, symbolPreview, stageCount, stageCapacity, riskSummary, and notes.
5. Approved warning fields: status, count, maxSeverity, canonical warnings code/severity/title/detail, evaluatedAt, source, scope, and note.
6. Approved runtime-stat fields: `AdminUserBotMetricSummary`, `AdminUserBotPositionSummary`, `AdminUserBotTradeSummary`, `AdminUserBotEquityPoint`, and `AdminUserBotStatsSourceSummary` as defined in `apps/web/src/features/admin/types.ts`.
7. Approved admin fleet explorer bridge: `/admin/bots` may link mapped owners to `/admin/users/<id>/bots`; unmapped Legacy pub_id rows must remain labeled fleet diagnostics only and must not be treated as selected-user facts.
8. Forbidden: raw password hashes, sessions/tokens/cookies, raw `bot_configs.config`, `bot_config_versions.config_json`, raw `bot_provider_accounts.provider_account_id` in UI/API/logs, raw provider `providerAccounts`/`activeSlots`/`activeOrderSummary`, raw metric/trade `rawJson`, exchange secret rows, sealed vault payloads, keyId/ciphertext metadata, env/vault/secret files, provider DB live calls during render, direct adapter calls from admin drilldown, live exchange ping, worker tick/restart, start/stop/apply/retest, SSH, tmux, and systemd.
9. RBAC decision: every admin page remains `requireUser()` + `assertAdmin()`; every mutation remains `requireUser()` + `assertAdmin()` + `assertCsrf()` + Zod + audited repo action. The proposed drilldown itself should add no form, submit button, CSRF field, route handler, or server action.

## Risks
1. The worktree was already heavily dirty/untracked before this audit, including many bot/admin files and existing Phase 3.x handoffs. This audit preserved all pre-existing changes.
2. `LegacyProviderAccountAdminView.quarantineReason` is a future-footgun because it is raw provider-origin text currently present in a DTO even though the current page does not render it.
3. The DB-backed admin-user rendered gate is opt-in and was not run in this audit; existing coverage points at `npm run e2e:admin-user-bots:db:managed`, but it requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
4. Admin visibility includes sensitive business facts such as email, equity, open positions, and trades; keep these server-rendered behind admin RBAC and avoid adding public API endpoints or client-side caches.
5. Pre-existing `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md` and `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md` were present before this handoff was written; this auditor did not launch, modify, or claim lifecycle ownership of them.

## Verification/tests
RUN:
1. Required start docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`.
2. Read-only source inspection of admin pages, loaders, actions, schemas, DTO types, bot read-model/config loaders, tests, schema, and repositories.
3. `git rev-parse --show-toplevel` - PASS, repo root resolved to `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short --branch` - RUN before handoff write; branch `codex/bot-analytics-settings-canary-20260603` with broad pre-existing modified/untracked state.
5. `Test-Path docs/handoffs/20260604-0603-bot-admin-drilldown-security-auditor.md` - PASS before write, returned `False`.

NOT RUN:
1. Unit/integration/e2e/build/lint/typecheck/secret scan/governance gates - not run because this was a read-only auditor scope with exactly one handoff write.
2. Background agents - not launched or claimed by this auditor; none were closed by this auditor.
3. Browser preview, Playwright, local dev server, live provider DB, live bot services, env/vault/secret inspection, exchange ping/calls, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest - forbidden by scope and not run.
4. DB-backed admin-user rendered acceptance - not run because no `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was supplied and this audit did not mutate databases.

## Next actions
1. Implement the next admin bot explorer / selected-user drilldown slice as a pure presentation layer over `loadAdminUsers()`, `loadAdminBotHealth()`, and `loadAdminUserBotDetail()` DTOs; do not add new raw DB/runtime reads in React components.
2. Add static guards that forbid the new drilldown code from importing `schema`, `getBotAdapter`, `exchangeApiKeySecrets`, raw `rawJson`, raw `providerAccountId`, `botConfigVersions`, live-control action names, SSH/tmux/systemd/process-control strings, or env/vault/secret files.
3. Before rendering `quarantineReason` anywhere, either remove it from the admin DTO or replace it with sanitized canonical warning-code output.
4. When credentials are available, run `npm run e2e:admin-user-bots:db:managed` and assert selected-user facts render while other-user, unscoped Legacy, raw config, raw trade, sealed secret, and live-control markers do not.
