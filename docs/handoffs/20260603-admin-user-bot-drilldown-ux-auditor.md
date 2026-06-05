# admin-user-bot-drilldown-ux-auditor handoff
## Scope
Read-only audit for the safest bounded implementation of an admin user bot drilldown/list.

Target UX: an admin-only, read-only view that shows user name/email, entitlements, WTC-owned bot instance/config/version summaries, safe exchange-key metadata, and an explicit Legacy warning that provider `pub_id` runtime data is global/provider-scoped rather than WTC-user-scoped until a provider-account ownership mapping exists.

This was a bounded foreground read-only audit, not a broad/major implementation phase. No background-agent count is claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/meta.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/admin-health-detail.test.ts`

## Files changed
None - read-only audit. This handoff file is the only workspace artifact to be added by this task.

## Findings
1. Severity: High. The implementation must stay a narrow read-only admin UI slice, because repo policy forbids plaintext exchange secrets and live bot start/stop/apply-config until separate security and bot-integration audit. Evidence: `AGENTS.md:77`, `AGENTS.md:81`, `docs/SESSION_PROTOCOL.md:83`. Recommendation: do not add server actions, API mutation routes, worker jobs, live probes, live exchange-key tests, or adapter control calls; target `apps/web/src/features/admin/queries.ts`, `apps/web/src/features/admin/types.ts`, `apps/web/src/app/admin/users/page.tsx`, and a small label update in `apps/web/src/app/admin/bots/page.tsx`.

2. Severity: High. Phase 3.70 explicitly left normalized provider-account ownership and Legacy user/pub_id scoping unimplemented. Evidence: `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:14`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:80`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:98`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:139`. Recommendation: the admin user drilldown may show WTC-owned user/bot/config/exchange-account rows, but must not attribute Legacy provider `pub_id` rows to specific users; render a persistent label such as "Legacy provider snapshots are global/provider scoped, not WTC-user scoped yet."

3. Severity: Medium. The current `/admin/users` page is a flat lockout/security directory and has no bot or entitlement drilldown. Evidence: `apps/web/src/app/admin/users/page.tsx:22`, `apps/web/src/app/admin/users/page.tsx:62`, `apps/web/src/app/admin/users/page.tsx:77`, `apps/web/src/app/admin/users/page.tsx:82`. Recommendation: add one read-only "User bot access" section below the existing users table or a compact drilldown link from each user row; do not disturb the existing audited unlock form.

4. Severity: Medium. The current `/admin/bots` page is a cross-user fleet/Legacy inspector and already states live control is disabled, but the Legacy `pub_id` table can be misread as user-specific. Evidence: `apps/web/src/app/admin/bots/page.tsx:54`, `apps/web/src/app/admin/bots/page.tsx:56`, `apps/web/src/app/admin/bots/page.tsx:106`, `apps/web/src/app/admin/bots/page.tsx:108`, `apps/web/src/app/admin/bots/page.tsx:219`, `apps/web/src/app/admin/bots/page.tsx:245`. Recommendation: add a short `RiskWarningBanner` or dim note on the Legacy inspector saying `pub_id` rows are provider/runtime rows and are not joined to WTC users until provider-account mapping exists.

5. Severity: High. The DB schema already supports the WTC-owned part without a migration: users/roles, entitlements, exchange account metadata, bot instances, current configs, and config-version history all exist. Evidence: `packages/db/src/schema.ts:15`, `packages/db/src/schema.ts:39`, `packages/db/src/schema.ts:76`, `packages/db/src/schema.ts:118`, `packages/db/src/schema.ts:138`, `packages/db/src/schema.ts:146`, `packages/db/src/schema.ts:403`. Recommendation: do not add schema/migration work for this bounded slice; implement flat read-only SELECTs and in-memory grouping in the admin loader.

6. Severity: High. Exchange-key display must never join sealed key material. The schema stores sealed material separately and the existing repo list function deliberately returns only safe metadata. Evidence: `packages/db/src/schema.ts:6`, `packages/db/src/schema.ts:128`, `packages/db/src/schema.ts:134`, `packages/db/src/repositories.ts:384`, `packages/db/src/repositories.ts:400`, `packages/db/src/repositories.ts:404`, `packages/db/src/repositories.ts:407`. Recommendation: select only `exchange_accounts.id/userId/exchange/label/mode/keyMask/createdAt`; do not select from `exchange_api_key_secrets`, do not expose `sealed`, `keyId`, URLs, credentials, or exchange ping status.

7. Severity: High. The admin drilldown should not reuse `listUsersWithCreatedAt()` as its source because that repo function intentionally selects `passwordHash` and relies on caller stripping. Evidence: `packages/db/src/repositories.ts:3275`, `packages/db/src/repositories.ts:3280`, `packages/db/src/repositories.ts:3284`, `packages/db/src/repositories.ts:3289`, `apps/web/src/features/admin/queries.ts:104`, `apps/web/src/features/admin/queries.ts:137`. Recommendation: create a new admin loader with an explicit users SELECT that omits `passwordHash`; keep `loadAdminUsers()` unchanged for the existing lockout page.

8. Severity: High. Bot config JSON can contain arbitrary future fields, so the UI must show summaries, not raw `bot_configs.config` or `bot_config_versions.config_json`. Evidence: `packages/db/src/schema.ts:146`, `packages/db/src/schema.ts:151`, `packages/db/src/schema.ts:403`, `packages/db/src/schema.ts:410`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:10`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:86`. Recommendation: add a local allowlisted `summarizeAdminBotConfig(productCode, config)` helper in `apps/web/src/features/admin/queries.ts` that returns only counts/labels like operation mode, symbol count, configured profile, current version, updated time, history count, and latest version timestamp.

9. Severity: Medium. Current admin loaders already use `getServerDb()` and schema-level SELECTs when a dedicated repo helper does not exist, which fits this read-only admin slice. Evidence: `apps/web/src/features/admin/queries.ts:3`, `apps/web/src/features/admin/queries.ts:5`, `apps/web/src/features/admin/queries.ts:145`, `apps/web/src/features/admin/queries.ts:166`, `apps/web/src/features/admin/queries.ts:337`, `apps/web/src/features/admin/queries.ts:342`. Recommendation: add `loadAdminUserBotDrilldown()` to `queries.ts` rather than expanding `packages/db/src/repositories.ts` unless a later package-level reuse case appears.

10. Severity: Medium. Read-only admin inspection is not currently audited, and adding audit rows would turn this into a mutation. Evidence: `packages/audit/src/audit.ts:1`, `packages/audit/src/audit.ts:3`, `packages/audit/src/audit.ts:166`, `packages/audit/src/audit.ts:183`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:98`. Recommendation: do not add a read audit in this bounded slice; if admin inspect audit is required, make it a separate explicit security/audit phase.

## Decisions
1. Safest bounded implementation: add a read-only loader `loadAdminUserBotDrilldown()` in `apps/web/src/features/admin/queries.ts` and DTOs in `apps/web/src/features/admin/types.ts`.
2. Use flat SELECTs, grouped in memory, for users, roles, entitlements, exchange accounts, bot instances, current bot configs, and config-version metadata. Avoid N+1 loops and avoid selecting secret/history payload columns that are not needed.
3. Render the first UI on `apps/web/src/app/admin/users/page.tsx` as a compact read-only section/card under the existing user directory. Keep the existing unlock action untouched.
4. Add one explicit Legacy scope label to `apps/web/src/app/admin/bots/page.tsx` near the Legacy `pub_id` inspector.
5. Do not change `packages/db/src/schema.ts`, migrations, `packages/db/src/repositories.ts`, `packages/audit`, `packages/bot-adapters`, `apps/worker`, live env flags, or live bot/exchange-control surfaces for this slice.

## Risks
1. `apps/web/src/features/admin/queries.ts` is already dirty in the current worktree from prior Phase 3.70 work; the implementer must preserve those changes and avoid broad rewrites.
2. Without a normalized provider-account table, Legacy provider rows can only be shown as global/provider-scoped operational data. Any user attribution would be misleading.
3. A config-summary helper that accidentally spreads raw config would reopen the Phase 3.70 raw-config leak risk.
4. A read audit for admin inspection may be desirable later, but it is not part of this read-only UI slice because it writes audit rows.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - observed existing dirty Phase 3.70 files and untracked handoffs/tests before writing this handoff.
2. Read-only source inspection of the files listed above with `Get-Content` and `rg`.
3. No live server, worker, SSH, database mutation, migration, seed, bot control, or exchange ping was run.

Tests to add with implementation:
1. `tests/integration/admin-user-bot-drilldown-static.test.ts`: assert `loadAdminUserBotDrilldown`, `requireUser`, `assertAdmin`, no `exchangeApiKeySecrets`, no `sealed`, no `keyId`, no raw `configJson`, no live-control strings/routes, and explicit Legacy "not user-scoped" copy.
2. `tests/integration/admin-user-bot-drilldown-db.test.ts`: PGlite migration/seed test that inserts a user entitlement, exchange account, bot instance, config, and config versions; verifies the loader returns name/email, entitlements, safe key metadata, current version/history summary, and no password hash/sealed secret/raw config JSON.
3. Extend `tests/integration/bot-read-safety-static.test.ts`: require the `/admin/bots` Legacy inspector to include the provider/global-not-user-scoped label and still not expose DB URLs or exchange keys.
4. Extend `tests/integration/admin-responsive.test.ts` if a new route is added or new tables are rendered; every admin table needs `wtc-table-wrap` and `data-label`.
5. Optional focused Playwright: admin users page at desktop/mobile should show the read-only drilldown, no horizontal scroll, no live-control buttons, no "connection verified" exchange-key claim, and the Legacy not-user-scoped label.

NOT RUN:
1. `npm test`, typecheck, lint, Playwright - not run because this task was an audit-only handoff with no application/runtime code changes.
2. DB migrations/seeds/managed Postgres gates - not run because no schema/runtime change was made.
3. Live bot start/stop/restart/apply-config/retest - not run by policy.
4. Live exchange-key ping/test - not run by policy.

## Next actions
1. Touch `apps/web/src/features/admin/types.ts`: add DTOs such as `AdminUserBotDrilldownResult`, `AdminUserBotDrilldownUser`, `AdminUserEntitlementSummary`, `AdminUserExchangeKeySummary`, `AdminUserBotSummary`, and `AdminBotConfigSummary`.
2. Touch `apps/web/src/features/admin/queries.ts`: add `loadAdminUserBotDrilldown()` plus local helper functions for grouping rows and `summarizeAdminBotConfig(productCode, config)`. Select minimal columns only.
3. Touch `apps/web/src/app/admin/users/page.tsx`: import and call the new loader after `assertAdmin()`, render read-only user bot/access summaries, and keep unlock forms unchanged.
4. Touch `apps/web/src/app/admin/bots/page.tsx`: add the Legacy global/provider-scoped label near the `Legacy pub_id inspector`.
5. Add the tests listed in `Verification/tests`, then run focused gates first: `npx vitest run tests/integration/admin-user-bot-drilldown-static.test.ts tests/integration/admin-user-bot-drilldown-db.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts`.
6. After focused pass, run the usual WTC acceptance stack for an admin UI slice: `npm run check:core`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, and a scoped Playwright admin-users mobile/desktop check if UI changed.
