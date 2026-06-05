# admin-selected-user-drilldown-security-auditor handoff
## Scope
Read-only Phase 3.99 security/data-boundary audit for the selected-user admin bot drilldown.

Focus areas:
1. Approved DTO fields for selected-user overview/detail.
2. Forbidden sources/actions: raw provider payloads, sealed exchange secrets, live bot control, user setting edits, provider mapping edits, direct adapters, env/vault/secret files, provider DB/live service mutation.
3. Anchor/deep-link safety, specifically whether raw provider ids can enter URLs, fragments, or DOM ids.
4. Confirmation that admins cannot edit user-owned bot settings from this drilldown.

No product code was edited. No env/vault/secret files were inspected. No live services/provider DB/SSH/tmux/systemd/worker/start/stop/apply/retest path was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`
8. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
9. `apps/web/src/app/admin/bots/page.tsx`
10. `apps/web/src/features/admin/types.ts`
11. `apps/web/src/features/admin/user-bot-detail-loader.ts`
12. `apps/web/src/features/admin/actions.ts`
13. `apps/web/src/features/admin/schemas.ts`
14. `tests/integration/admin-user-bot-detail-static.test.ts`
15. `tests/integration/admin-user-bot-detail-loader.test.ts`

Supporting files inspected to verify the imported loaders and masked fleet DTOs:
1. `apps/web/src/features/admin/queries.ts`
2. `apps/web/src/features/admin/bot-health-loader.ts`
3. `apps/web/src/features/admin/health-detail.ts`

## Files changed
1. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-security-auditor.md`

## Findings
1. Severity: High. Selected-user bot detail uses an approved, narrow DTO surface and stays scoped to the requested user. Evidence: `apps/web/src/features/admin/types.ts:31` exposes only exchange key metadata including `keyMask`; `apps/web/src/features/admin/types.ts:96` defines a summarized config DTO rather than raw config; `apps/web/src/features/admin/types.ts:125` defines provider account summaries; `apps/web/src/features/admin/types.ts:146` bounds bot detail to two bot products, scoped stats, provider scope, warnings, and `liveControlDisabled`. The loader selects only `exchangeAccounts.keyMask` and never joins sealed secrets at `apps/web/src/features/admin/user-bot-detail-loader.ts:840`; it scopes provider mappings by `userId` and bot product at `apps/web/src/features/admin/user-bot-detail-loader.ts:849`; and it filters Legacy metric/position/trade rows to the active provider mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:706`. Recommendation: keep future selected-user fields behind the DTO mapper plus leakage tests before rendering. Target part: selected-user admin bot detail loader/DTO.
2. Severity: High. The new anchors/deep links do not place raw provider ids in URL fragments or DOM ids. Evidence: selected-user anchors are derived only from `productCode` via `botAnchor()` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72`, used as `href="#..."` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:177`, and used as the card `id` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190`. Fleet-to-user links use only `mappedUser.userId` plus fixed `detailAnchor` values at `apps/web/src/app/admin/bots/page.tsx:33` and `apps/web/src/app/admin/bots/page.tsx:77`. Legacy pub_id display values are masked before the fleet DTO at `apps/web/src/features/admin/bot-health-loader.ts:100`, `apps/web/src/features/admin/bot-health-loader.ts:277`, `apps/web/src/features/admin/bot-health-loader.ts:293`, and `apps/web/src/features/admin/bot-health-loader.ts:308`. Recommendation: keep fragments as fixed product anchors such as `bot-tortila_bot` / `bot-legacy_bot`; never derive anchors from provider ids, labels, symbols, or external trade ids. Target part: admin bot fleet and selected-user deep links.
3. Severity: High. The selected-user page is read-only and does not expose admin edit paths for user bot settings. Evidence: the page requires `requireUser()` and `assertAdmin()` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:94`, labels user settings and provider mappings as read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:115`, and states the overview cannot edit user settings, provider mappings, exchange keys, live config, or open positions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150`. Static guards forbid mapping actions, CSRF fields, submit buttons, save/select config actions, start/stop, applyConfig, adapters, raw JSON, and sealed-secret tables at `tests/integration/admin-user-bot-detail-static.test.ts:107` and `tests/integration/admin-user-bot-detail-static.test.ts:140`. Recommendation: do not import `actions.ts` into this page unless a separate mutation phase adds CSRF/Zod/RBAC/audit coverage and explicit acceptance. Target part: selected-user admin bot page.
4. Severity: Medium. Existing admin mutation actions are present in `actions.ts`, but the selected-user drilldown does not call them; the actions themselves remain guarded. Evidence: Legacy provider mapping requires `requireUser`, `assertAdmin`, `assertCsrf`, Zod schema validation, and audited DB functions at `apps/web/src/features/admin/actions.ts:354`; disable mapping follows the same pattern at `apps/web/src/features/admin/actions.ts:397`; schemas require UUIDs and long admin reasons at `apps/web/src/features/admin/schemas.ts:106`; global bot config save is an admin-owned system-default action with forbidden-key filtering at `apps/web/src/features/admin/actions.ts:431` and `apps/web/src/features/admin/actions.ts:496`. Recommendation: keep selected-user settings inspection separate from admin system-default management and Legacy mapping workflows. Target part: admin action boundary.
5. Severity: Medium. Residual adjacent DTO footgun: the fleet health DTO still carries `LegacyProviderAccountAdminView.quarantineReason` as a provider-origin string, even though the current pages inspected here do not render it and selected-user tests assert provider-origin health reasons do not leak. Evidence: the type includes `quarantineReason` at `apps/web/src/features/admin/types.ts:359`, and `bot-health-loader` maps it from `legacyLiveConfig.providerAccounts` at `apps/web/src/features/admin/bot-health-loader.ts:268` and `apps/web/src/features/admin/bot-health-loader.ts:277`. The selected-user loader projects health details through the allowlisted/redacted `projectHealthDetail()` path at `apps/web/src/features/admin/user-bot-detail-loader.ts:986`, and the loader test asserts `PROVIDER_REASON_SHOULD_NOT_RENDER` does not appear in selected-user output at `tests/integration/admin-user-bot-detail-loader.test.ts:612`. Recommendation: remove `quarantineReason` from `LegacyProviderAccountAdminView` or map it to canonical warning codes before any future render, link, log, or client component prop. Target part: adjacent `/admin/bots` fleet DTO hardening.
6. Severity: Low. Focused guardrails cover the selected-user boundary well, but rendered browser/managed DB acceptance was not run in this audit lane. Evidence: static tests assert forbidden imports/actions/anchors at `tests/integration/admin-user-bot-detail-static.test.ts:125` and `tests/integration/admin-user-bot-detail-static.test.ts:200`; PGlite loader tests seed cross-user data, raw config, raw trade JSON, sealed secret rows, provider ids, and health secret markers at `tests/integration/admin-user-bot-detail-loader.test.ts:136`, then assert no leakage at `tests/integration/admin-user-bot-detail-loader.test.ts:570`. Recommendation: run the populated rendered admin-user-bots DB gate when the operator deliberately supplies a throwaway DB URL. Target part: test coverage.

## Decisions
1. Accepted the selected-user drilldown as read-only from a security/data-boundary perspective.
2. Accepted current deep-link anchors because they are product-code/fixed-anchor based, not provider-id based.
3. Treated provider account ids rendered on selected-user pages as masked DTO values because `mapProviderAccountSummary()` masks them before render.
4. Did not recommend adding user-setting edit controls to this page.
5. Recorded `LegacyProviderAccountAdminView.quarantineReason` as a residual adjacent DTO cleanup item, not as an active selected-user page leak.

## Risks
1. The worktree was already broadly dirty before this audit; this handoff does not assert branch cleanliness or release readiness.
2. `LegacyProviderAccountAdminView.quarantineReason` remains a provider-origin DTO field in the adjacent fleet loader and should be removed or canonicalized before any render.
3. Rendered browser output was not inspected in this lane; only static source guards and PGlite loader behavior were tested.
4. The selected-user DTO still includes user-owned `externalTradeId` for trade summaries; it is used only as a React row key in the inspected server page, not as a URL/anchor/display field. If a future client component receives trades, reassess whether that field should be masked or omitted.

## Verification/tests
RUN:
1. Protocol/source reads listed above.
2. Source inspection for selected-user page, fleet page, DTOs, loader, actions, schemas, and tests.
3. `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 2 files, 9 tests.

NOT RUN:
1. Full `npm test` - not run; audit scope used focused selected-user guardrail tests.
2. `npm run build -w @wtc/web` - not run.
3. Playwright/e2e or rendered browser inspection - not run.
4. Managed DB admin-user-bots rendered gate - not run; requires deliberately supplied throwaway admin DB URL.
5. Live services/provider DB/SSH/tmux/systemd/worker/start/stop/apply/retest - not run by safety policy.
6. Env/vault/secret file inspection - not run by explicit instruction.

## Next actions
1. Remove or canonicalize `LegacyProviderAccountAdminView.quarantineReason` before any future fleet rendering consumes it.
2. Keep selected-user anchors restricted to static product anchors; do not add provider-account, trade-id, symbol, or label-derived fragments.
3. If a future phase adds admin mutation controls near this drilldown, require a separate audited phase with CSRF, Zod, RBAC, entitlement/audit semantics, and focused rendered tests.
4. Run the populated admin-user-bots rendered DB gate when a throwaway DB URL is intentionally available.
