# ecosystem-security-auditor handoff
## Scope
Read-only security audit for normalized Legacy provider-account/user scoping before exposing Legacy averaging bot and Tortila bot settings/statistics/admin facts. The audit inspected WTC session protocol, auth/RBAC/session guards, admin/user bot detail loaders, entitlement engine, exchange-secret handling, Legacy safe-column worker snapshot path, config export/static tests, current provider-account mapping scaffold, and recent Legacy bot integration handoffs. No live services were started/stopped and no live bot control or provider DB query was run.

Operator questions answered:
- Required RBAC/entitlement/security invariants: current-user bot pages require session plus active/grace entitlement; admin pages require session plus `assertAdmin`; target-user admin drilldown must evaluate the target user's entitlement and provider-account mapping, not the admin's bypass; Legacy runtime facts require an active mapping from WTC user + bot instance + product to Legacy provider `pub_id`; all mutations require CSRF, Zod validation, server-side RBAC, entitlement/mapping check, in-transaction audit, and no secret logging.
- What must never leak to user/admin drilldown: Legacy `api_key`, `secret_key`, passwords, JWTs, bearer tokens, service-account credentials, DB URLs, exchange secrets, sealed vault blobs, password hashes, raw provider errors/logs, raw provider payloads containing secret-looking fields, cross-user balances/slots/orders/configs/metrics, and live-apply tokens. Full `pub_id` is not an exchange secret, but it is an operational identifier and should be masked/minimized in normal user UI; full admin reveal should be an explicit audited inspect action.
- Fail-closed behavior: missing/ambiguous/disabled/needs_review mapping means no Legacy liveConfig, metrics, positions, active slots/orders, provider balances, or config export from provider snapshots. Entitlement states other than active/grace deny user access even if a mapping exists. Duplicate active provider mapping must be impossible at DB level and treated as manual_review/deny if observed.
- Audit-log needs: mapping create/update/disable/reassign, admin full-identifier inspect, config draft submit/review/export, and any future apply attempt need registered audit actions, actor id/role, target user, bot instance, product, mapping row id, reason, before/after status, entitlement decision, result, and redacted/minimized provider identity. Audit payloads must not include raw config JSON, provider credentials, DB URLs, JWTs, sealed blobs, or unredacted errors.
- Exact tests/gates: see `## Verification/tests`.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `packages/auth/src/rbac.ts`
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_legacy_provider_accounts.sql`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-bot-settings-security-access.md`
- `docs/handoffs/20260603-bot-settings-platform-db.md`
- `docs/handoffs/20260603-legacy-bot-integration-auditor.md`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: CRITICAL. User-facing production DB snapshot reads are still product-scoped and can expose the latest Legacy/Tortila snapshot across users instead of the current user's mapped account. Evidence: `apps/web/src/features/bots/data.tsx:241` defines `loadDbBotReadModel(productCode, parts)` with no user or mapping parameter; metric, position, and trade selectors join `bot_instances` but filter only `productCode` at `apps/web/src/features/bots/data.tsx:258`-`294`; callers pass only `meta.code` from user pages at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:107`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:120`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:133`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:210`, `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:11`, and `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:13`. Recommendation: replace this with `loadBotReadModelForUser(userId, productCode, parts)` that first checks active/grace entitlement, then joins `bot_instances.user_id`, an active `bot_provider_accounts` row, and the selected snapshot; fail closed when the mapping is absent, disabled, ambiguous, or not for the current user. Target part: user bot read model, settings/statistics/dashboard/positions/trades/equity/safety pages.

2. Severity: CRITICAL. Legacy config export can export a provider runtime snapshot that is not scoped to the requesting user's mapped `pub_id`. Evidence: export route gates by session/entitlement at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12`-`14`, then reads Legacy live config with product-only `loadBotReadModel(meta.code, ['config'])` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16`-`24`; the DB read model builds `configView.raw` from latest metric `rawJson.liveConfig` at `apps/web/src/features/bots/data.tsx:395`-`411`; Legacy export serializes provider config into JSON at `apps/web/src/features/bots/config.ts:680`-`689`. Recommendation: export should use saved WTC reference config only unless the requester has exactly one active Legacy provider-account mapping and the liveConfig was produced from that mapping; otherwise return 403 or a mapping-required response. Target part: `/api/bots/[bot]/config-export`, `exportBotConfig`, Legacy settings/export tests.

3. Severity: HIGH. Provider-account mapping scaffold exists, but it is not yet the read/write spine for Legacy facts. Evidence: table `bot_provider_accounts` exists with `provider_account_id` at `packages/db/src/schema.ts:146`-`171` and migration `packages/db/migrations/0017_legacy_provider_accounts.sql:1`-`24`; repository functions list/upsert/disable mappings at `packages/db/src/repositories.ts:1675`-`1799`; however the Legacy worker still reads `LEGACY_API_ID` or up to 20 running accounts and stores them under one system/instance path at `apps/worker/src/legacy-live.ts:317`-`330` and `apps/worker/src/legacy-live.ts:377`-`415`. Recommendation: worker production path must iterate verified active `bot_provider_accounts`, query Legacy by explicit `pub_id`, write per-account snapshots, and keep the current system/global path canary-only or admin-fleet-only. Target part: `apps/worker/src/legacy-live.ts`, DB repos, provider-account snapshot tables/read model.

4. Severity: HIGH. New provider-account audit actions are emitted by repository code but are not registered in the audit action union, so current typecheck fails and audit taxonomy is incomplete. Evidence: `packages/db/src/repositories.ts:1753`-`1768` emits `bot.provider_account.map` or `bot.provider_account.update`, and `packages/db/src/repositories.ts:1790`-`1797` emits `bot.provider_account.disable`; `packages/audit/src/audit.ts:8`-`131` does not include these action strings. Observed gate failure: `npm run typecheck` and `npm run typecheck -w @wtc/web` both fail with TS2322 at `packages/db/src/repositories.ts:1756` and `packages/db/src/repositories.ts:1793`. Recommendation: add registered audit actions for mapping create/update/disable/reassign and admin inspect; add tests asserting the actions are in `AUDIT_ACTIONS`. Target part: `packages/audit`, `packages/db`, audit schema docs, typecheck gate.

5. Severity: HIGH. Mapping audit payload currently includes full `providerAccountId`, which is operationally sensitive enough to minimize in audit and normal UI. Evidence: `packages/db/src/repositories.ts:1760`-`1766` records `providerAccountId` in the audit `after` payload; `apps/web/src/features/admin/user-bot-detail-loader.ts:120`-`136` maps full `providerAccountId` into `AdminUserProviderAccountSummary`; `apps/web/src/features/admin/types.ts:53`-`58` exposes it in the DTO. Recommendation: store full `providerAccountId` only in the normalized table; audit payload should include mapping row id plus masked/hash form unless full reveal is explicitly required, and full admin reveal should be an `admin.bot_account.inspect` action with reason. Target part: audit payloads, admin provider-account DTO, admin drilldown/inspect UX.

6. Severity: HIGH. Admin user drilldown is moving toward target-user scoping, but UI/test strings are inconsistent with the new provider-account state model. Evidence: type now allows `providerScope: 'user_scoped' | 'provider_account_mapped' | 'provider_account_pending'` at `apps/web/src/features/admin/types.ts:61`-`76`; loader now returns mapped/pending at `apps/web/src/features/admin/user-bot-detail-loader.ts:284`-`310`; page label still renders every non-user-scoped value as `fleet pub_id pending` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:16`-`18`; existing loader test still expects `fleet_pub_id_pending` at `tests/integration/admin-user-bot-detail-loader.test.ts:227`-`235`. Recommendation: align labels/tests to the mapping states and render mapped vs pending explicitly; pending must not display provider balances, slots, orders, or full `pub_id`. Target part: admin user bot detail page and tests.

7. Severity: HIGH. Admin bot fleet page renders full Legacy `pub_id`, balances, slots, and orders as global fleet diagnostics without an inspect audit. Evidence: admin page is RBAC-gated at `apps/web/src/app/admin/bots/page.tsx:44`-`48`; full pub_id/balance/snapshot table renders at `apps/web/src/app/admin/bots/page.tsx:219`-`245`, active slots at `apps/web/src/app/admin/bots/page.tsx:254`-`267`, and active orders at `apps/web/src/app/admin/bots/page.tsx:276`-`288`; no audit call exists in `apps/web/src/app/admin/bots/page.tsx` or `apps/web/src/features/admin/queries.ts`. Recommendation: keep `/admin/bots` as fleet diagnostics only, add a visible "not user scoped" warning, mask `pub_id` by default, and require an audited inspect action with reason for full identifiers/details. Target part: admin bot fleet UX, audit actions, admin queries.

8. Severity: HIGH. Required Legacy safe-column and no-secret boundary is correct and must not be relaxed while adding mapping. Evidence: contract defines WTC as read-only safe-column consumer by `pub_id` at `docs/CONTRACTS/legacy-bot-adapter.md:24`-`36`; Legacy API shape includes plaintext `api_key` and `secret_key` at `docs/CONTRACTS/legacy-bot-adapter.md:121`-`145`; worker rejects selected secret-looking fields at `apps/worker/src/legacy-live.ts:127`-`135` and selects whitelisted provider columns at `apps/worker/src/legacy-live.ts:317`-`370`; direct Legacy HTTP remains blocked in factory at `packages/bot-adapters/src/factory.ts:32`-`39` and blocked adapter at `packages/bot-adapters/src/legacy/legacy-blocked.ts:1`-`17`. Recommendation: provider-account work must extend the DB snapshot path only; no HTTP management endpoint, start/stop/retest/apply-config, or credential route may be introduced in this phase. Target part: worker, adapter boundary, security gates.

9. Severity: MEDIUM. Current mapping schema prevents duplicate active provider account rows but lacks explicit ownership-proof fields and admin reason fields. Evidence: `bot_provider_accounts` has `user_id`, `bot_instance_id`, `product_code`, `provider`, `provider_account_id`, `status`, `created_by`, and `disabled_at` at `packages/db/src/schema.ts:149`-`160`; unique active `(product_code, provider, provider_account_id)` is defined at `packages/db/src/schema.ts:166`-`168`; there is no `verified_at`, `verified_by`, `claim_source`, `provider_user_ref_hash`, `disabled_reason`, or `last_seen_at` column. Recommendation: before production user scoping, either add these columns or define where equivalent evidence lives; mapping create/update must be based on proof and reason, not only manual row insertion. Target part: DB schema/migration, admin mapping actions, audit payloads.

10. Severity: MEDIUM. Current static tests assert safe adapter behavior and export presence but do not prove provider-account fail-closed behavior. Evidence: `tests/integration/bot-read-safety-static.test.ts:75`-`85` only asserts DB-snapshot backing exists, not user/mapping filters; `tests/integration/bot-config-export-static.test.ts:26`-`32` only asserts session/entitlement/no-store; no test file currently matches `provider_account` under `tests/`; `tests/integration/admin-user-bot-detail-loader.test.ts:189`-`265` proves target-owned snapshot isolation for bot instances but not active/disabled provider mapping behavior. Recommendation: add PGlite and static tests listed in `## Verification/tests` before exposing user/admin Legacy facts as owner-scoped. Target part: integration/static/e2e gate suite.

## Decisions
- Treat Legacy `pub_id` as the provider runtime account identity and WTC `user_id`/`bot_instance_id` as the platform ownership identity. They are never interchangeable.
- User-facing Legacy runtime facts require both active/grace `legacy_bot` entitlement and exactly one active provider-account mapping for that user's bot instance. No mapping means no provider runtime facts.
- Admin user drilldown may show target WTC entitlements, WTC config version metadata, safe exchange key metadata, active mapping status, and target-owned metric snapshots. It must not attribute global/fleet Legacy snapshot rows to that user.
- `/admin/bots` remains fleet diagnostics until a provider-account directory/inspect workflow lands. It should be explicitly labeled as fleet/provider scoped.
- WTC settings remain WTC reference/version/export only. Saving WTC config never applies it to Legacy/Tortila runtime.
- Direct Legacy HTTP/control stays blocked. Future live apply/retest/start/stop requires a separate phase, explicit operator approval, CSRF/RBAC/entitlement, security and bot-integration audit, exchange safety review, and append-only audit.

## Risks
- Current dirty workspace is not typecheck-clean because provider-account audit actions are not registered.
- Without wiring `bot_provider_accounts` into `loadBotReadModel`, a multi-user production Legacy rollout risks cross-user operational data exposure.
- Full `pub_id`, balance, active slot, and order details can become support/admin leakage if rendered without scoped mapping and inspect audit.
- Provider-side Legacy still has plaintext exchange credential columns. WTC code avoids selecting them, but provider-side remediation and column-restricted DB role proof remain required.
- If mapping is manual without verification evidence, a wrong `pub_id` assignment can make another provider account look user-owned.
- Static tests currently can pass while product-only DB snapshot queries remain present.

## Verification/tests
RUN this session:
- `npm run typecheck` - FAILED. TS2322: `bot.provider_account.update/map/disable` are not assignable to registered audit action union at `packages/db/src/repositories.ts:1756` and `packages/db/src/repositories.ts:1793`.
- `npm run typecheck -w @wtc/web` - FAILED with the same TS2322 audit action errors.
- Static source inspection with `rg`/line reads for auth, RBAC, entitlements, audit, DB schema/repos, worker, user/admin bot pages, export route, tests, and Legacy handoffs.

NOT RUN this session:
- `npm test` / targeted Vitest - not run after typecheck failed; this was a read-only auditor lane.
- `npm run lint` - not run after typecheck failed.
- `npm run secret:scan` - not run in this lane; must run before acceptance.
- `npm run build -w @wtc/web` - not run after typecheck failed.
- Playwright/e2e - not run; would create artifacts and is downstream of typecheck.
- Worker tick / preview / live server / provider DB proof - not run by policy.
- Legacy start/stop/retest/apply-config/exchange calls - not run and remain forbidden.
- Background agents - not spawned in this lane; no background agents left running.

Required gates before acceptance:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/legacy-live-worker-static.test.ts`
- New PGlite provider-account tests: map/update/disable in-txn audit; duplicate active provider account rejected; missing/disabled/needs_review mapping denies runtime facts; target user A cannot read/export user B provider snapshot; admin target-user drilldown shows mapped vs pending without secrets.
- New static test: no user-facing production DB snapshot query filters only by productCode; `loadBotReadModelForUser` must include current user and active provider-account mapping.
- New export test: Legacy export returns 403/mapping-required when no active mapping exists and never includes another user's providerAccounts, activeSlots, activeOrderSummary, or providerAccountId.
- New admin inspect test: full `pub_id` reveal requires an audited `admin.bot_account.inspect` or equivalent action with reason.
- `npm run secret:scan`
- `npm run lint`
- `npm run build -w @wtc/web`
- Browser/e2e checks for `/app/bots/legacy`, `/app/bots/legacy/settings`, `/app/bots/statistics?bot=legacy`, `/admin/bots`, and `/admin/users/[userId]/bots` after the mapping fix.
- Values-hidden provider DB role proof: role can read only whitelisted Legacy columns used by `apps/worker/src/legacy-live.ts` and cannot read `api_key`, `secret_key`, password/token/session/config secret fields.

## Next actions
1. Register provider-account audit actions in `packages/audit/src/audit.ts` and docs, then rerun root and web typecheck.
2. Decide whether current `bot_provider_accounts` schema is sufficient or add ownership-proof fields (`verified_at`, `verified_by`, `claim_source`, `provider_user_ref_hash`, `disabled_reason`, `last_seen_at`) before production.
3. Replace product-only `loadDbBotReadModel` with a user/provider scoped read model and update all user bot pages plus config export to call it.
4. Update the Legacy worker production path to iterate active verified provider mappings and snapshot by explicit `pub_id`; leave env/system-owner path canary-only.
5. Align admin user drilldown types/page/tests with `provider_account_mapped` and `provider_account_pending`; pending must show no provider runtime facts.
6. Add admin provider-account inspect/link/disable actions with CSRF, `assertAdmin`, Zod, in-transaction audit, reason, and redacted/minimized payloads.
7. Add the required PGlite/static/e2e tests and rerun the exact gates above.
