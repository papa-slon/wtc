# legacy-provider-security-rbac-auditor handoff
## Scope
Read-only Phase 3.72 security/RBAC audit for Legacy provider-account ingestion and the admin mapping foundation.

Focus areas:
- Admin/user access and mutation pipelines for bot settings and Legacy provider-account mapping.
- `apps/web/src/features/admin`, `apps/web/src/app/admin/users/[userId]/bots`, auth/RBAC/CSRF helpers, `packages/audit`, and `packages/db` repositories.
- Safe design for admin map/update/disable actions: admin may map a Legacy provider `pub_id` to a user's Legacy bot instance and WTC system mapping/config metadata, but must not edit the user's personal bot settings.

Safety constraints observed:
- No live services, SSH, tmux, systemd, exchange APIs, provider DB, `.env`, bot start/stop/apply-config, or live probes were touched.
- Read-only audit only; the only write was this handoff file.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/lib/csrf.tsx`
- `packages/auth/src/rbac.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.test.ts`
- `packages/audit/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`

## Files changed
None - read-only audit. Handoff file written: `docs/handoffs/20260603-1815-legacy-provider-security-rbac-auditor.md`.

## Findings
1. Severity: High. Admin provider-account map/update/disable server actions and Zod schemas are not implemented yet. Evidence: Phase 3.71 explicitly left "live admin map/update/disable forms" to a later slice at `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md:98`; `apps/web/src/features/admin/actions.ts:3`-`4` documents the generic admin action spine but no provider-account action exists; `apps/web/src/features/admin/schemas.ts:14`-`81` defines only ticket/product/review/lockout/LMS cleanup schemas; the user bot admin page is read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:34` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:44`. Recommendation: add dedicated `adminMapLegacyProviderAccountAction`, `adminUpdateLegacyProviderAccountAction`, and `adminDisableLegacyProviderAccountAction` plus schemas; do not mix these with user bot-setting actions. Target part: admin actions, schemas, and `/admin/users/[userId]/bots` UI.

2. Severity: High. `disableBotProviderAccountMapping` disables by mapping id only and does not validate target user, Legacy product, provider, or bot-instance ownership inside the repository. Evidence: `packages/db/src/repositories.ts:1797` defines the function with only `{ id, actorUserId, reason }`; `packages/db/src/repositories.ts:1804` selects by id only before updating and auditing. Recommendation: change the repository signature to require `targetUserId`, `botInstanceId`, `productCode: 'legacy_bot'`, and `provider: 'legacy-db'`, then select/update with all ownership predicates in one transaction; alternatively perform an equivalent repository-level validation helper before disable. Target part: `packages/db/src/repositories.ts`.

3. Severity: High. The foundation does not enforce exactly one active Legacy provider mapping per bot instance. Evidence: Phase 3.71 requires exactly one active mapping for Legacy production reads at `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md:96`; schema has `bpa_instance_provider_idx` as a non-unique index and the active uniqueness is only across `(productCode, provider, providerAccountId)` at `packages/db/src/schema.ts:163`-`168`; the user read model correctly fails closed when active mappings are zero or multiple at `apps/web/src/features/bots/data.tsx:330`-`344`; the admin detail loader currently picks the first active row per instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:270`-`273`. Recommendation: add a partial unique active index for `(bot_instance_id, provider)` or make map/update fail when another active mapping exists unless the action disables/replaces it in the same transaction; update admin loader to render an ambiguous state instead of picking first. Target part: DB schema/repositories and admin loader.

4. Severity: High. Admin user bot detail can show a Legacy metric snapshot scoped only by bot instance, not by the active provider-account mapping. Evidence: the admin loader reads `botMetricSnapshots` for all target user's instance ids at `apps/web/src/features/admin/user-bot-detail-loader.ts:218`-`244`; it chooses the latest per instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:276`-`280` and assigns it to the bot at `apps/web/src/features/admin/user-bot-detail-loader.ts:304`; the safer user read path filters Legacy metrics/positions/trades by `botProviderAccountId` at `apps/web/src/features/bots/data.tsx:344`-`352`. Recommendation: for Legacy admin detail, require exactly one active provider account and filter metric snapshots by that mapping id; if missing or ambiguous, show no user-scoped runtime snapshot. Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts` plus integration tests.

5. Severity: High. Admin "system config" must not reuse the user personal bot config pipeline. Evidence: user settings actions persist the actor's own config via `persistBotConfig(user.id, ...)` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:70`-`83`; `persistBotConfig` writes through `ensureBotInstance` and `saveBotConfig` at `apps/web/src/features/bots/config.ts:776`-`786`; `saveBotConfig` writes `bot_configs`/`bot_config_versions` and audits with `actorRole: 'user'` at `packages/db/src/repositories.ts:1827`-`1837`. Recommendation: model admin-managed Legacy system mapping/config as a distinct provider-account metadata/config primitive, with `actorRole: 'admin'` and a provider-account audit action; never call `saveBotConfig` from admin map/update/disable actions. Target part: DB repository/API design and admin action implementation.

6. Severity: Medium. The existing generic admin action order differs from the Phase 3.72 requested mutation order. Evidence: `apps/web/src/features/admin/actions.ts:3`-`4` documents `requireUser() -> assertAdmin -> assertCsrf -> Zod`; CSRF can be verified from the session cookie without a prior `requireUser` call at `apps/web/src/lib/csrf.tsx:21` and `apps/web/src/lib/csrf.tsx:31`-`34`; `assertAdmin` remains the server-side RBAC guard at `packages/auth/src/rbac.ts:90`-`94`. Recommendation: implement the new provider-account actions as: FormData-to-object Zod parse with no IO, `assertCsrf(formData)`, `requireUser()`, `assertAdmin(actor.roles)`, DB ownership validation, in-transaction mutation + audit, then revalidate. If the team chooses to keep the older admin order, record that exception explicitly before implementation. Target part: `apps/web/src/features/admin/actions.ts`.

7. Severity: Medium. Existing tests cover read-only drilldown and user read safety, but not the provider-account admin mutation pipeline. Evidence: the static drilldown test asserts the admin page is read-only and has no start/stop/apply/test controls at `tests/integration/admin-user-bot-detail-static.test.ts:38`-`51`; the loader integration test uses `upsertBotProviderAccountMapping` directly as fixture setup at `tests/integration/admin-user-bot-detail-loader.test.ts:143`-`160`; config-export static tests only assert `provider_mapping_required` at `tests/integration/bot-config-export-static.test.ts:31`. Recommendation: add repository tests and server-action/static tests for map/update/disable, order of guards, ownership mismatch denial, ambiguous active mappings, audit rows, and no secret/live-control strings. Target part: `tests/integration` and any admin action tests.

## Decisions
1. The safe Phase 3.72 admin mutation design is:
   - Zod-normalize raw form input with no DB or live IO.
   - Verify CSRF.
   - Load actor and `assertAdmin(actor.roles)`.
   - Require Postgres; demo mode must fail closed for mapping mutations.
   - Validate target user owns the target Legacy bot instance in the DB.
   - Restrict product/provider to `legacy_bot` + `legacy-db`.
   - Mutate only provider-account mapping/system metadata in a transaction.
   - Write the audit row in that same transaction.
   - Revalidate admin user bot detail and audit log paths.
2. Admin mapping/update/disable must never call live Legacy APIs and must never start, stop, retest, or apply config to a bot.
3. Admin mapping may store and display provider `pub_id` as provider identity, but API keys, API secrets, sealed vault records, tokens, `.env` values, and live connection strings must never enter forms, audit payloads, logs, fixtures, or screenshots.
4. Admin mapping/system metadata is not the user's personal bot configuration. User config remains under the owner-driven `bot_configs` pipeline; admin system mapping/config needs distinct storage and audit semantics.
5. Legacy runtime facts shown in user/admin user detail are user-owned only when tied to exactly one active `bot_provider_accounts.id`.

## Risks
1. If the next UI wires disable directly to the current by-id repository primitive, an admin-only IDOR-style target mismatch is possible: the actor could disable a mapping outside the viewed target user/bot if an id is supplied.
2. Multiple active mappings for one Legacy bot instance can make runtime facts ambiguous. User reads already fail closed, but the admin drilldown can currently pick a first active mapping and a latest instance snapshot.
3. Reusing `saveBotConfig` for admin "system config" would silently edit user personal settings and misattribute the audit row as `actorRole: 'user'`.
4. Full `pub_id` display is admin-only and not an exchange secret, but it is still provider identity. Keep it off non-admin pages and consider mask/reveal later if product policy treats it as sensitive.
5. No live provider DB verification was performed; all conclusions come from local source and docs only.

## Verification/tests
RUN:
1. `Get-Content` on required session files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`.
2. `git status --short --branch` - observed pre-existing dirty/untracked Phase 3.70/3.71 worktree changes; no user work was reverted.
3. `rg --files apps/web/src/features/admin apps/web/src/app/admin/users/[userId]/bots packages/audit packages/db` - scoped file inventory.
4. Focused `rg`/line-numbered source reads for admin actions/schemas/page/loader, RBAC, CSRF, audit redaction/actions, DB schema/repositories, bot config/read paths, and existing tests.
5. `Test-Path docs/handoffs/20260603-1815-legacy-provider-security-rbac-auditor.md` before writing - confirmed the target handoff did not already exist.

NOT RUN:
1. `npm test`, Vitest, lint, typecheck, Playwright - not run because this was a read-only background audit with one handoff write and no implementation patch.
2. DB migrations, worker tick, managed DB checks, deploy proof - not run by policy and scope.
3. Legacy/Tortila start, stop, restart, retest, apply-config, live exchange ping, provider DB query, SSH/tmux/systemd - not run and remained forbidden.

## Next actions
1. Add `legacyProviderAccountMapSchema`, `legacyProviderAccountUpdateSchema`, and `legacyProviderAccountDisableSchema` to `apps/web/src/features/admin/schemas.ts`. Require target user id, Legacy bot instance id, provider `legacy-db`, trimmed `providerAccountId`, reason, and bounded optional label/system metadata.
2. Add `adminMapLegacyProviderAccountAction`, `adminUpdateLegacyProviderAccountAction`, and `adminDisableLegacyProviderAccountAction` to `apps/web/src/features/admin/actions.ts` using the Phase 3.72 pipeline: Zod -> CSRF -> requireUser/assertAdmin -> DB ownership validation -> in-transaction audit -> revalidate.
3. Harden `packages/db/src/repositories.ts`: make disable ownership-scoped; require reasons for map/update/disable; restrict Legacy provider values; enforce exactly one active mapping per Legacy bot instance.
4. If admin must set "system config", add a distinct system/provider-account config primitive instead of writing `bot_configs`; add a dedicated audit action such as `bot.provider_account.system_config.update`.
5. Fix `apps/web/src/features/admin/user-bot-detail-loader.ts` so Legacy metric snapshots are filtered by the active `botProviderAccountId`, and ambiguous active mappings render fail-closed.
6. Add tests:
   - Repository tests for ownership mismatch, duplicate active mapping, disable by wrong user/bot, in-transaction audit, and redaction.
   - Static/server-action tests for Zod/CSRF/admin guard order and absence of `saveBotConfig`, start/stop/retest/apply/live API calls.
   - Admin loader integration test where null-provider and wrong-provider Legacy snapshots are newer than the mapped-provider snapshot.
   - E2E/admin smoke only after implementation, with no live provider calls.
7. Suggested gates after implementation: focused Vitest for new repo/action/loader tests, `npm run check:core`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `npm run governance:check`, and existing admin/bot Playwright suites if UI changes land.
