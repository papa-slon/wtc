# admin-bot-drilldown-security-auditor handoff
## Scope
Read-only Phase 3.74 security audit of the current admin user bot drilldown in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope questions:
- Admin can view all users' bot stats, saved settings summaries, and provider mappings.
- Admin must not edit user-owned bot settings or secrets from the drilldown.
- Provider `pub_id` and exchange keys must not leak beyond admin-safe masked views.
- No live bot, exchange, provider DB, SSH, tmux, systemd, `.env`, worker tick, migration, seed, or real database probe/mutation was allowed or run.

This was the assigned `ecosystem-security-auditor` foreground lane. No background agents were launched by this lane, and no N-agent claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `docs/handoffs/20260603-1815-legacy-provider-security-rbac-auditor.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-security-auditor.md`
- `docs/handoffs/20260603-1918-admin-bot-drilldown-ux-auditor.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECURITY_MODEL.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/config.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.test.ts`
- `packages/audit/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/bot-config-export-static.test.ts`

## Files changed
- `docs/handoffs/20260603-1921-admin-bot-drilldown-security-auditor.md` only.

## Findings
1. Severity: HIGH. The current drilldown route is not view-only because it renders provider-mapping mutation controls. Evidence: the page imports `CsrfField` and map/disable actions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:4` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:6`; it renders `Map Legacy pub_id` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:221` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:240`; it renders a disable form at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:273` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:280`; the actions write WTC DB state and revalidate admin pages at `apps/web/src/features/admin/actions.ts:347` to `apps/web/src/features/admin/actions.ts:418`. Recommendation: for Phase 3.74, remove mapping/disable forms and action imports from `/admin/users/[userId]/bots`, or move them behind a separate explicitly audited admin mapping workflow. Keep this route as read-only stats/settings/source/mapping status. Target part: admin user bot drilldown route and static tests.

2. Severity: HIGH. Full provider `pub_id` is exposed in the normal admin DTO/UI and mapping audit payloads, which violates the requested admin-safe masked-view boundary. Evidence: `AdminUserProviderAccountSummary` exposes `providerAccountId` at `apps/web/src/features/admin/types.ts:65` to `apps/web/src/features/admin/types.ts:72`; the loader selects and maps full `providerAccountId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:220` to `apps/web/src/features/admin/user-bot-detail-loader.ts:237` and `apps/web/src/features/admin/user-bot-detail-loader.ts:300` to `apps/web/src/features/admin/user-bot-detail-loader.ts:314`; the page prints it in prose and a table at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:117` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:120` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:263` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:268`; tests currently assert full fixture IDs at `tests/integration/admin-user-bot-detail-loader.test.ts:329` to `tests/integration/admin-user-bot-detail-loader.test.ts:337`; the repository audit payload includes full `providerAccountId` at `packages/db/src/repositories.ts:1773` to `packages/db/src/repositories.ts:1790`, while `packages/audit/src/redact.ts:12` to `packages/audit/src/redact.ts:36` does not treat provider account identifiers as redactable. Recommendation: store the full `providerAccountId` only in `bot_provider_accounts`; normal DTO/UI/audit payloads should use `providerAccountMask` plus optional stable hash/id. Full reveal should require a separate audited inspect action with a reason. Target part: admin DTO, page, repository audit payload, audit tests.

3. Severity: HIGH. The static guardrail test currently locks in mutation controls and full `pub_id` behavior while describing the page as read-only. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:40` to `tests/integration/admin-user-bot-detail-static.test.ts:67` expects `user settings: read-only` while also expecting `system mapping controls`, `adminMapLegacyProviderAccountAction`, `adminDisableLegacyProviderAccountAction`, `Map Legacy pub_id`, and `CsrfField`; the loader test expects full `providerAccountId` in returned DTO JSON at `tests/integration/admin-user-bot-detail-loader.test.ts:329` to `tests/integration/admin-user-bot-detail-loader.test.ts:337`. Recommendation: invert the drilldown test to forbid mutation action imports/forms and full provider IDs in normal render/DTO output; move mapping action tests to a separate provider-mapping workflow spec if that workflow is approved. Target part: `tests/integration/admin-user-bot-detail-static.test.ts`, `tests/integration/admin-user-bot-detail-loader.test.ts`.

4. Severity: MEDIUM. The Legacy disable action is still broader than its name and UI scope: server-side predicates validate mapping id and target user only, not Legacy product/provider/bot instance. Evidence: the disable schema accepts only `userId`, `mappingId`, and `reason` at `apps/web/src/features/admin/schemas.ts:108` to `apps/web/src/features/admin/schemas.ts:112`; the action passes only mapping id and user id at `apps/web/src/features/admin/actions.ts:390` to `apps/web/src/features/admin/actions.ts:413`; the repository selects by id and checks optional user id, then disables the row at `packages/db/src/repositories.ts:1799` to `packages/db/src/repositories.ts:1811`. Recommendation: require `productCode: 'legacy_bot'`, `provider: 'legacy-db'`, and target `botInstanceId` in the action/repository predicate, or add a dedicated `disableLegacyProviderAccountMapping()` repository helper that enforces those predicates in one transaction. Target part: admin action, schema, repository, repository tests.

5. Severity: MEDIUM/PASS WITH RESIDUAL RISK. Admin settings viewing is now a safe summary rather than an edit path, but it reads raw `bot_configs.config` and must stay allowlisted. Evidence: the loader selects `schema.botConfigs.config` at `apps/web/src/features/admin/user-bot-detail-loader.ts:318` to `apps/web/src/features/admin/user-bot-detail-loader.ts:328`; `mapConfigSummary()` projects version, source label, operation mode, symbol counts, stage capacity, and risk summary at `apps/web/src/features/admin/user-bot-detail-loader.ts:169` to `apps/web/src/features/admin/user-bot-detail-loader.ts:217`; the page renders only read-only summary fields at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:143` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:180`; the PGlite test asserts raw config markers and history config JSON do not appear at `tests/integration/admin-user-bot-detail-loader.test.ts:342` to `tests/integration/admin-user-bot-detail-loader.test.ts:373`. Recommendation: keep this as an allowlisted projection only, and add a fixture containing `providerPubId` in saved config to prove the admin summary never returns provider IDs, raw config, or live-apply credentials. Target part: loader projection and PGlite test.

6. Severity: PASS. Exchange-key handling is correctly minimized for this route. Evidence: DTO type exposes only `id`, `exchange`, `label`, `mode`, and `keyMask` at `apps/web/src/features/admin/types.ts:31` to `apps/web/src/features/admin/types.ts:37`; the loader selects only safe exchange account metadata and never joins `exchange_api_key_secrets` at `apps/web/src/features/admin/user-bot-detail-loader.ts:290` to `apps/web/src/features/admin/user-bot-detail-loader.ts:299`; the UI renders the mask and says secret material is not loaded at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:184` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:293` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:309`; tests seed `exchange_api_key_secrets` rows and assert `sealed`, key ids, `apiSecret`, `apiKey`, and `token` are absent at `tests/integration/admin-user-bot-detail-loader.test.ts:31` to `tests/integration/admin-user-bot-detail-loader.test.ts:39`, `tests/integration/admin-user-bot-detail-loader.test.ts:115` to `tests/integration/admin-user-bot-detail-loader.test.ts:123`, and `tests/integration/admin-user-bot-detail-loader.test.ts:359` to `tests/integration/admin-user-bot-detail-loader.test.ts:373`. Recommendation: preserve the metadata-only exchange key DTO and keep exchange-key testing out of this route. Target part: loader, DTO, page, tests.

7. Severity: PASS WITH RESIDUAL RISK. Target-user scoping for stats/config metadata is substantially correct. Evidence: the loader selects the target user without `passwordHash` at `apps/web/src/features/admin/user-bot-detail-loader.ts:240` to `apps/web/src/features/admin/user-bot-detail-loader.ts:254`; roles, entitlements, bot instances, exchange rows, and provider rows are filtered by target `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:260` to `apps/web/src/features/admin/user-bot-detail-loader.ts:314`; Legacy metric rows are skipped unless tied to the active provider mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:381` to `apps/web/src/features/admin/user-bot-detail-loader.ts:386`; the PGlite test proves no row-count mutation and no cross-user/raw secret leakage at `tests/integration/admin-user-bot-detail-loader.test.ts:261` to `tests/integration/admin-user-bot-detail-loader.test.ts:373`. Recommendation: keep the dedicated `loadAdminUserBotDetailFromDb(db, userId)` helper and do not reuse product-scoped bot read models for this drilldown. Target part: loader and tests.

8. Severity: MEDIUM. Provider mapping state remains collapsed, which can hide disabled or needs-review security state behind generic pending/not-mapped copy. Evidence: `providerScope` has only `user_scoped | provider_account_mapped | provider_account_pending` at `apps/web/src/features/admin/types.ts:75` to `apps/web/src/features/admin/types.ts:90`; the loader promotes only active rows to `activeProviderByInstance` at `apps/web/src/features/admin/user-bot-detail-loader.ts:371` to `apps/web/src/features/admin/user-bot-detail-loader.ts:376`; every non-active Legacy case becomes `provider_account_pending` at `apps/web/src/features/admin/user-bot-detail-loader.ts:414` to `apps/web/src/features/admin/user-bot-detail-loader.ts:418`; page copy says `Provider account not mapped` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:124` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:131`. Recommendation: split states into at least `mapped_active`, `unmapped`, `mapped_disabled`, and `needs_review/ambiguous`; disabled/needs-review states must fail closed for runtime facts and be visibly distinct. Target part: admin DTO, page copy, PGlite/static tests.

## Decisions
1. Treat Phase 3.74 admin bot drilldown as a read model. Existing provider mapping mutations may be valid in a separate audited admin workflow, but they should not live inside the view-only drilldown acceptance path.
2. User-owned bot settings are not edited by the current route: no `saveBotConfig`, live apply, exchange-key test, start/stop/retest, or settings submit path was found in the inspected drilldown path.
3. Provider `pub_id` is not an exchange key, but it is an operational account identifier. Normal admin views and audit payloads should minimize it by default.
4. Exchange-key handling is safe in this route: only masks/metadata are selected and rendered.
5. Current target-user loader shape is the right security boundary; keep bot facts anchored to target `userId`, target-owned `bot_instances`, and active Legacy provider mappings.

## Risks
1. Leaving mapping/disable forms on `/admin/users/[userId]/bots` makes the route impossible to honestly label as a view-only drilldown.
2. Full `providerAccountId` in DTO/UI/audit logs can leak provider identity beyond masked admin-safe presentation.
3. A forged admin POST can use the Legacy disable action against any mapping for the same target user unless product/provider/bot-instance predicates are added.
4. The settings summary reads raw saved config internally. It is acceptable only while the returned DTO remains a strict allowlist.
5. Static tests currently preserve the wrong contract for Phase 3.74 by expecting mutation controls on the drilldown.
6. This audit did not run the focused Vitest or broader gates, so conclusions are source-inspection findings, not fresh green gate proof.

## Verification/tests
RUN in this audit:
1. Read binding docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
2. Read latest relevant Phase 3.71-3.73, admin drilldown, loader, Legacy provider-account, and concurrent Phase 3.74 UX handoffs listed in `## Files inspected`.
3. `git status --short --branch` - observed pre-existing dirty/untracked files on `codex/bot-analytics-settings-canary-20260603`; no existing product/test/handoff work was reverted.
4. `Test-Path docs/handoffs/20260603-1921-admin-bot-drilldown-security-auditor.md` - returned `False` before this handoff write.
5. Read-only source inspection with `rg`, line-numbered file reads, `git diff`, and file listing over the scoped admin pages, admin loader/actions/types/schemas, DB schema/repositories, audit package, bot config sanitization, and focused tests.
6. Confirmed no inspected admin user drilldown path imports or calls `saveBotConfig`, `loadBotReadModel`, live start/stop/apply/retest, exchange key test, SSH/tmux/systemd, `.env`, or provider DB probe code.
7. No background agents were launched by this single assigned auditor lane; no background agents are running from this lane.

NOT RUN in this audit:
1. Product code/test edits - forbidden by user scope.
2. Vitest, typecheck, lint, build, Playwright, `check:core`, `secret:scan`, governance, full/e2e gates - not run because this was a read-only source audit with exactly one handoff write.
3. Dev server/browser visual QA - not run because no application code was changed by this lane.
4. Live bot start/stop/restart/apply-config/retest, live exchange ping, worker ticks, live provider DB reads/mutations, SSH/tmux/systemd, `.env` reads/mutations, migrations, seeds, managed real-DB gates - forbidden and not run.

## Next actions
1. Remove provider mapping map/disable forms and action imports from `/admin/users/[userId]/bots`; keep the route to read-only user identity, bot stats, saved settings summaries, exchange-key masks, and mapping status.
2. Replace `providerAccountId` in normal admin DTO/UI/audit payloads with `providerAccountMask` and optional stable hash/id; add a separate reasoned audited inspect action before any full reveal.
3. Harden `adminDisableLegacyProviderAccountAction` and `disableBotProviderAccountMapping()` with product/provider/bot-instance predicates.
4. Update static/PGlite tests to forbid drilldown mutation controls, full provider IDs in normal DTO/render output, raw config markers, `providerPubId`, secret-like fields, and live-control strings.
5. Split provider states into active mapped, unmapped, disabled, needs-review, and ambiguous; ensure only active mapped rows can produce user-scoped runtime facts.
6. After product/test fixes, run focused gates: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/legacy-provider-worker.test.ts`, then web typecheck/lint/build and scoped admin Playwright/mobile proof if UI changes land.
