# bot-admin-selector-security-auditor handoff
## Scope
Read-only Phase 4.23 security/data-boundary audit for the next admin bot selector/search slice. Inspected admin users/bots, provider `pub_id` mapping, bot stats/settings, config export, and user-scoped snapshot paths. Focused on preserving read-only user settings, avoiding secrets/raw provider payloads, requiring exact-one Legacy provider mapping for user-owned stats, and preventing live start/stop/apply-config.

## Files inspected
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
`docs/handoffs/20260604-1628-bot-admin-selector-security-auditor.md` only.

## Findings
1. MEDIUM - Fleet `pub_id` lookup helper is diagnostic, not sufficient as selector ownership proof. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:159-187` loads up to 500 active Legacy provider mappings, keys them by normalized provider id, and keeps the first row encountered; `packages/db/src/schema.ts:169-171` currently backs exact active provider uniqueness at the DB layer, but the loader shape itself does not return an exact-one count or ambiguity state; `apps/web/src/app/admin/bots/page.tsx:696-724` renders this as a fleet inspector with masked `pub_id` and mapped user. Recommendation: implement the next selector/search path with a dedicated equality-based read helper, e.g. query by exact normalized `providerAccountId` plus `productCode='legacy_bot'`, `provider='legacy-db'`, `status='active'`, `limit 2`, and return `missing | exact_one | ambiguous_or_constraint_drift`; do not reuse the fleet `Map` as authorization/user-scope proof. Target part: future admin selector/search loader and DB/integration tests.
2. MEDIUM - Admin selector/search must stay on the read-only selected-user loader and must not import existing provider-mapping or global-config actions. Evidence: the selected-user page calls `loadAdminUserBotDetail(userId)` and renders read-only status copy at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:270-294`, while the mutation actions exist separately at `apps/web/src/features/admin/actions.ts:354-395` for mapping and `apps/web/src/features/admin/actions.ts:496-545` for global default saves; the schemas validate mapping/config mutations at `apps/web/src/features/admin/schemas.ts:106-122` and `apps/web/src/features/admin/schemas.ts:124-138`. Recommendation: keep selector/search UI as links/forms with GET/query-state only, no `CsrfField`, no server action import, no hidden `providerAccountId` mutation form, no `saveBotConfig`, no `saveBotGlobalConfig`, no `upsertBotProviderAccountMapping`, and no `disableBotProviderAccountMapping`. Target part: future admin users/bots selector/search page/component and static tests.
3. LOW - Selected-user stats boundary is currently correctly scoped, but the next slice should lock it with selector-specific regression tests. Evidence: Legacy rows match only when an active provider account id equals the snapshot provider account at `apps/web/src/features/admin/user-bot-detail-loader.ts:788-805`; the loader builds a single active provider per bot instance only when active rows count equals one at `apps/web/src/features/admin/user-bot-detail-loader.ts:1066-1077`; latest metrics/stats are built from that single provider id at `apps/web/src/features/admin/user-bot-detail-loader.ts:1092-1113`; the existing ambiguous-mapping test proves no first-row pickup at `tests/integration/admin-user-bot-detail-loader.test.ts:719-779`. Recommendation: add selector tests that search by user email, user id, masked `pub_id`, raw `pub_id`, missing `pub_id`, and duplicate/constraint-drift `pub_id`, proving Legacy stats remain empty unless the resolved user has exactly one active Legacy provider mapping for that bot instance. Target part: `tests/integration/admin-user-bot-selector-loader.test.ts` or extension of `admin-user-bot-detail-loader.test.ts`.
4. LOW - Raw provider payload/secret projection is guarded, but selector/search should not render raw health/detail JSON or raw `pub_id`. Evidence: admin health projection allowlists keys and redacts strings in `apps/web/src/features/admin/health-detail.ts:4-61` and `apps/web/src/features/admin/health-detail.ts:67-102`; fleet Legacy rows mask `pub_id` in `apps/web/src/features/admin/bot-health-loader.ts:129-136` and map from raw snapshot data to masked DTOs at `apps/web/src/features/admin/bot-health-loader.ts:317-361`; existing tests assert no raw `pub_id`, secret, token, or raw marker leakage at `tests/integration/admin-bot-health-loader.test.ts:195-210` and `tests/integration/admin-user-bot-detail-loader.test.ts:583-638`. Recommendation: add selector result DTO tests that stringify the full result and assert absence of `rawJson`, `liveConfig`, `providerAccountId`, raw `pub_id`, `apiKey`, `apiSecret`, `sealed`, `token`, bearer strings, provider DB URL, and health error detail beyond the existing sanitized fields. Target part: selector/search DTO and page/static tests.
5. LOW - Config export is currently user/entitlement gated and strips provider ids, but admin selector/search must not add an admin export path for another user's settings. Evidence: the API route delegates to `handleBotConfigExportRequest` with `requireUser`, `botAccessForUser`, `loadBotConfig`, and `loadBotReadModelForUser` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:1-16`; the handler blocks unauthenticated/denied users before exporting at `apps/web/src/features/bots/config-export-handler.ts:56-78`; Legacy export deletes `providerPubId` before serializing at `apps/web/src/features/bots/config-export.ts:224-249` and writes no live apply token at `apps/web/src/features/bots/config-export.ts:251-309`; route-handler tests cover provider mapping required, unsafe marker absence, and no-store headers at `tests/integration/bot-config-export-route-handler.test.ts:176-309`. Recommendation: selector/search should link users to their read-only drilldown only; do not add `/admin/users/:id/bots/config-export` or any admin impersonation export unless separately designed with audited consent, entitlement checks, and owner-scope proof. Target part: future selector/search routing and static route inventory tests.
6. LOW - Live control remains disabled in adapter/page surfaces; selector/search should preserve that as a static gate. Evidence: admin pages render `LIVE CONTROL: DISABLED` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:291` and `apps/web/src/app/admin/bots/page.tsx:342`; worker Legacy health/check payloads keep `liveControlDisabled: true` at `apps/worker/src/legacy-live.ts:583-602`; adapter control methods throw at `packages/bot-adapters/src/http.ts:59-68`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:89-98`, `packages/bot-adapters/src/mock-legacy.ts:77-86`, and `packages/bot-adapters/src/mock-tortila.ts:120-129`; static/e2e tests assert no start/stop/apply controls at `tests/integration/admin-user-bot-detail-static.test.ts:174-187` and `tests/e2e/admin-user-bot-detail-db.spec.ts:83`. Recommendation: add selector/search static tests that reject `startBot`, `stopBot`, `applyConfig`, `restart`, `retest`, `getBotAdapter`, `fetch(`, `vault.open`, and `type="submit"` in the selector component/page unless the submit is explicitly a GET search form with no server action. Target part: future selector/search component/page tests.

## Decisions
- Treat `/admin/bots` Legacy `pub_id` rows as fleet diagnostics. A mapped user link is helpful navigation, not the sole security boundary for user-owned stats.
- Treat `/admin/users/[userId]/bots` as the correct selected-user read model for settings, stats, warnings, exchange-key metadata, and provider mapping evidence.
- The next selector/search slice should produce navigation plus read-only DTOs only. It should not create, disable, edit, export-as-admin, probe, start, stop, apply config, test exchange connectivity, or mutate user settings/provider mappings.
- Legacy user-owned runtime/statistics attribution requires exactly one active `legacy-db` provider mapping for the selected user's Legacy bot instance and matching `botProviderAccountId` on persisted metric/position/trade rows.

## Risks
- A selector/search helper that searches by masked `pub_id` display text rather than exact raw provider id will be unreliable and may create false owner matches.
- Reusing the fleet `legacyProviderMappings()` helper for authorization can hide constraint drift or result-limit artifacts because it returns a first-row `Map` instead of an exact-one result.
- Admin actions for provider mapping/global config already exist and are valid for their pages; accidental import into selector/search would convert a read-only slice into a mutation surface.
- Raw provider data is present in worker-written snapshot `rawJson.liveConfig`; every new DTO must project only safe fields and must be covered by full-result stringify leakage tests.

## Verification/tests
- Not run: no test, dev-server, browser, worker, database mutation, live service, SSH, tmux, systemd, exchange, bot, or provider command was executed in this read-only audit.
- Read-only evidence inspection only: PowerShell `Get-Content`, `Get-ChildItem`, `Select-String`, `rg`, and `git status` were used to inspect files and current worktree state.
- Targeted tests to add before/with the selector/search slice:
  1. Add `tests/integration/admin-user-bot-selector-loader.test.ts` proving search by user id/email returns only the selected user's DTO and table counts are unchanged.
  2. Add selector tests for raw `pub_id`, masked `pub_id`, missing `pub_id`, and duplicate/constraint-drift `pub_id`; only exact-one active `legacy-db` mapping may resolve to a user drilldown link with provider-scoped stats.
  3. Add leakage assertions on the full selector result/page HTML for `rawJson`, `liveConfig`, raw `providerAccountId`, raw `pub_id`, `apiKey`, `apiSecret`, `sealed`, `token`, bearer strings, DB URLs, and hidden-user markers.
  4. Add static tests that the selector/search page imports no admin mutation actions and contains no `CsrfField`, `type="submit"` server-action form, `saveBotConfig`, `saveBotGlobalConfig`, `upsertBotProviderAccountMapping`, `disableBotProviderAccountMapping`, `startBot`, `stopBot`, or `applyConfig`.
  5. Add e2e coverage for `/admin/users` selector/search navigation to `/admin/users/[userId]/bots`, verifying `LIVE CONTROL: DISABLED`, `user settings: read-only`, and absence of live-control/apply/export-as-admin controls.

## Next actions
1. Build the selector/search as a read-only admin loader plus GET/search UI, returning search result summaries and links to the existing selected-user drilldown.
2. Add a dedicated exact-one provider lookup helper for Legacy `pub_id` search; do not use the fleet diagnostic `Map` as ownership proof.
3. Keep all user settings, provider mappings, exchange keys, config export, and runtime state non-mutating in this slice.
4. Run the targeted tests above plus the existing focused gates after implementation: `admin-user-bot-detail-loader`, `admin-bot-health-loader`, `admin-user-bot-detail-static`, `bot-config-export-route-handler`, and the relevant admin-user-bot e2e gate.
