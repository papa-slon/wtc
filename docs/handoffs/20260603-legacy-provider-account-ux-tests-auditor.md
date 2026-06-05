# ecosystem-ux-ui-designer + ecosystem-tests-runner handoff
## Scope
Read-only UX/tests audit for the Legacy provider-account/user scoping prerequisite behind safer Legacy averaging bot and Tortila bot settings/statistics/admin UX. The lane inspected current bot settings/setup/statistics pages, admin users drilldown, admin bots fleet diagnostics, DB/provider-account shape as it affects UX state modeling, e2e/static tests, and recent handoffs. No product code was edited. No live services or bots were stopped, started, probed, or mutated.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-legacy-provider-account-db-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-security-auditor.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Critical. User-facing Legacy settings/statistics/export still read latest DB snapshots by product code, not by current user plus active provider-account mapping. Evidence: `apps/web/src/features/bots/data.tsx:241` defines `loadDbBotReadModel(productCode, parts)` without `userId`; `apps/web/src/features/bots/data.tsx:258` to `apps/web/src/features/bots/data.tsx:270` selects latest metrics by `bot_instances.product_code`; `apps/web/src/features/bots/data.tsx:272` to `apps/web/src/features/bots/data.tsx:294` does the same for positions/trades; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:118` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:127` uses that live config before user saved config; `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24` exports that live config after entitlement only. Recommendation: add and use a `loadBotReadModelForUser(user.id, productCode, parts)` path for all user bot pages and export; for Legacy, return no live runtime facts unless the user has active entitlement, a target-owned bot instance, and an active `bot_provider_accounts` row. Target part: user bot read model, settings, statistics, dashboard, export route.

2. Severity: High. The new admin drilldown mapping state is promising but incomplete for the requested mapped/unmapped/disabled/ambiguous UX taxonomy. Evidence: `apps/web/src/features/admin/types.ts:51` to `apps/web/src/features/admin/types.ts:75` models provider accounts and `providerScope` as `user_scoped | provider_account_mapped | provider_account_pending`; `apps/web/src/features/admin/user-bot-detail-loader.ts:270` to `apps/web/src/features/admin/user-bot-detail-loader.ts:274` promotes only active rows to the per-bot `providerAccount`; `apps/web/src/features/admin/user-bot-detail-loader.ts:305` to `apps/web/src/features/admin/user-bot-detail-loader.ts:309` collapses every non-active/non-present Legacy row into `provider_account_pending`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:111` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:120` renders only "Provider account not mapped" for that collapsed state. Recommendation: expose distinct bot-level states for `mapped_active`, `unmapped`, `mapped_disabled`, and `needs_review/ambiguous`, with disabled and ambiguous never rendered as generic pending. Target part: admin user drilldown DTO and card state.

3. Severity: High. The DB/repository mapping primitive exists, but live Legacy worker/user snapshot reads are not wired through it yet, so UI copy must not imply personal Legacy ownership outside admin drilldown mapping summaries. Evidence: `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:170` defines `bot_provider_accounts` with `active | disabled | needs_review`; `packages/db/src/repositories.ts:1686` to `packages/db/src/repositories.ts:1776` adds audited map/update; `packages/db/src/repositories.ts:1778` to `packages/db/src/repositories.ts:1800` adds audited disable; but `apps/worker/src/legacy-live.ts:377` to `apps/worker/src/legacy-live.ts:415` still resolves one env/system-owned bot instance and reads `env.LEGACY_API_ID`; `apps/worker/src/legacy-live.ts:425` to `apps/worker/src/legacy-live.ts:454` writes one aggregate raw `liveConfig`. Recommendation: until worker snapshots are per mapped provider account, label user-facing Legacy runtime facts as "provider snapshot pending ownership" or hide them; do not say "your Legacy account" or include balances/slots/orders on user pages without the scoped path. Target part: Legacy worker, user bot pages, admin copy.

4. Severity: High. Admin fleet diagnostics correctly belong on `/admin/bots`, but they currently show full `pub_id`/balance/slot/order data from the latest product-level raw snapshot. Evidence: `apps/web/src/features/admin/queries.ts:436` to `apps/web/src/features/admin/queries.ts:469` reads latest `legacy_bot` raw `liveConfig` by product; `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:245` renders full `pub_id`, balance, symbols, slots, orders, and snapshot time; `apps/web/src/app/admin/bots/page.tsx:254` to `apps/web/src/app/admin/bots/page.tsx:288` renders slot/order rows by full `pub_id`. Recommendation: keep this page as admin-only fleet diagnostics, but after mapping use normalized account rows, mask `pub_id` by default, and require an audited inspect/reveal action for full account identity. Target part: `/admin/bots` UX and admin audit actions.

5. Severity: Medium. User-facing copy still risks false ownership/live-control impressions on Legacy statistics and settings. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:266` to `apps/web/src/app/(app)/app/bots/statistics/page.tsx:275` shows "Total wallet equity" for entitled bots while Legacy may be product-scoped; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:316` to `apps/web/src/app/(app)/app/bots/statistics/page.tsx:324` labels Legacy values as wallet balance snapshot, provider pub_id, active slots, and active orders; `apps/web/src/features/bots/statistics-panels.tsx:484` to `apps/web/src/features/bots/statistics-panels.tsx:555` renders provider accounts/slots/orders when `liveConfig` exists; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:165` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:202` renders provider accounts when a product-level live config exists. Recommendation: use copy like "Mapped provider account", "Mapping required", "Provider account disabled", "Needs review - ownership ambiguous", "WTC reference only", and "Fleet diagnostic, not user-owned" as state labels; avoid "connected", "your provider account", "live profile", "running account", and "total wallet equity" unless scoped to active mapping. Target part: user settings/statistics/dashboard copy.

6. Severity: Medium. Current tests cover layout/read-only posture but not the provider-account UX states or user-scoped route contract. Evidence: `tests/e2e/bot-settings.spec.ts:32` to `tests/e2e/bot-settings.spec.ts:43` verifies Legacy settings render but not mapped/unmapped/disabled/ambiguous states; `tests/integration/admin-user-bot-detail-loader.test.ts:189` to `tests/integration/admin-user-bot-detail-loader.test.ts:277` proves target-owned rows and secret non-leakage but does not seed active/disabled/needs_review provider mappings; `tests/integration/bot-statistics-static.test.ts:62` to `tests/integration/bot-statistics-static.test.ts:70` asserts Legacy pub_id snapshots render rather than gating by mapping. Recommendation: add PGlite tests for no mapping, active mapping, disabled mapping, needs_review/duplicate mapping, wrong-user mapping, expired entitlement, user export isolation, admin drilldown state labels, and product-level read-model rejection. Target part: integration tests and e2e route coverage.

7. Severity: Medium. Static test expectations are already stale against the new provider-account wording. Evidence: focused command `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` failed because `tests/integration/admin-user-bot-detail-static.test.ts:45` still expects `fleet pub_id pending`, while `apps/web/src/app/admin/users/[userId]/bots/page.tsx:16` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:20` now labels `provider account mapped` / `provider account pending`; the same focused run reported `admin-user-bot-detail-loader.test.ts` passing. Recommendation: update static assertions to the new taxonomy and add assertions that no bot mutation controls exist, provider mapping tables render, and disabled/needs_review labels are not collapsed into pending. Target part: static admin tests.

8. Severity: Medium. The recent DB-auditor handoff is useful context but has drifted relative to the current working tree. Evidence: `docs/handoffs/20260603-legacy-provider-account-db-auditor.md:100` to `docs/handoffs/20260603-legacy-provider-account-db-auditor.md:103` says no current `bot_provider_accounts` schema/migration was present, while `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:170` and `packages/db/migrations/0017_funny_gambit.sql:1` to `packages/db/migrations/0017_funny_gambit.sql:24` now define it. Recommendation: treat that handoff as pre-implementation audit context only; current acceptance must review the actual schema/repository/migration now in the worktree. Target part: operator handoff synthesis.

## Decisions
1. Exact Legacy provider-account UX states:
   - `mapped_active`: show "Provider account mapped"; show masked `pub_id`, provider, status active, last snapshot time, and user-scoped metrics only. Allow WTC reference config save/export. Keep live start/stop/apply disabled.
   - `unmapped`: show "Mapping required"; hide balances, slots, orders, wallet totals, and provider account tables from user pages. User copy: "Legacy runtime rows stay fleet diagnostics until WTC maps a provider account to your Legacy bot." Admin drilldown may show the absence, not live facts.
   - `mapped_disabled`: show "Provider account disabled"; hide live facts and export of live config, keep historical WTC reference config visible. Admin system config may re-map or keep disabled after audit; user cannot self-enable.
   - `ambiguous/needs_review`: show "Needs review - provider account ownership ambiguous"; hide live facts until one active mapping is verified. Duplicate/claim collision should fail closed and send admins to review.
2. Admin read-only vs allowed actions:
   - `/admin/users` may clear login lockout with an audited reason, as already rendered.
   - `/admin/users/[userId]/bots` should remain read-only: user bot state, exchange-key masks, provider mapping status, and user-scoped snapshots only. No edit bot settings, no test connection, no start/stop/apply.
   - A separate admin system-config/mapping surface may map/update/disable provider accounts using audited repository actions. These are ownership metadata changes only, not live bot control.
   - `/admin/bots` stays fleet diagnostics; full `pub_id` reveal should be masked or audited.
3. User-facing labels/copy:
   - Prefer: "WTC reference settings", "Saved WTC config version", "Provider account mapped", "Mapping required", "Provider account disabled", "Needs review", "Fleet diagnostic", "Live control disabled".
   - Avoid until scoped: "your Legacy account", "connected account", "running account", "managed live profile", "total wallet equity" for mixed/Legacy totals, "apply to live bot", "connection verified".
4. Test/e2e selectors and route coverage needed:
   - Add stable selectors such as `data-testid="legacy-provider-state"`, `legacy-provider-account-card`, `legacy-provider-mapping-table`, `legacy-provider-disabled-banner`, `legacy-provider-needs-review-banner`, `legacy-live-facts-gated"`, and `admin-provider-mapping-status`.
   - Cover `/app/bots/legacy`, `/app/bots/legacy/settings`, `/app/bots/statistics?bot=legacy`, `/api/bots/legacy/config-export`, `/admin/users/[userId]/bots`, and `/admin/bots`.
   - For each route, cover mapped active, unmapped, disabled, needs_review/ambiguous, wrong-user mapping, expired entitlement, and no-snapshot-yet states.

## Risks
1. Legacy user pages can still expose product-level latest snapshots in production read-only mode if `NODE_ENV=production` and adapter mode is not mock, because the DB read model has no user argument.
2. Disabled or needs-review mappings can look like generic "pending" on the bot card, making support/admin action unclear and potentially hiding a safety decision.
3. Full `pub_id` values in admin fleet diagnostics may be acceptable for admin-only operations, but they need an explicit masking/audit decision before wider admin use.
4. Static tests can pass while route/data leakage persists; the next tests need real PGlite fixtures with multiple users, multiple mappings, and conflicting provider account claims.
5. The working tree changed during this audit; this handoff reflects the latest state observed before writing, not the initial state at session start.

## Verification/tests
- Ran read-only source inspection with `rg`, `git status --short --branch`, and line-numbered `Get-Content`.
- Ran focused local/in-memory tests: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`.
- Result: FAIL overall. `admin-user-bot-detail-static.test.ts` failed 1 assertion at line 45 because it still expects `fleet pub_id pending`; `admin-user-bot-detail-loader.test.ts` passed. Total: 1 failed file, 1 passed file, 4 passed tests, 1 failed test.
- NOT RUN: Playwright/e2e, dev server, worker smoke, live bot checks, DB migrations/generate, secret scan, governance check. Reason: this lane is read-only, browser/server/live-service mutation was out of scope, and the focused static/loader failure already identifies an acceptance blocker.

## Next actions
1. Replace product-scoped `loadBotReadModel(productCode, parts)` calls on user routes/export with user-scoped reads that require active mapping for Legacy.
2. Update admin drilldown DTO/page to distinguish `mapped_active`, `unmapped`, `mapped_disabled`, and `needs_review/ambiguous` instead of collapsing non-active mappings into pending.
3. Wire Legacy worker snapshots through `bot_provider_accounts` or explicitly gate product-level legacy snapshots as fleet/admin-only until per-account writes exist.
4. Update copy on Legacy settings/statistics/dashboard/export to avoid ownership claims; hide Legacy live facts on unmapped/disabled/needs_review states.
5. Fix stale static test wording, then add PGlite tests for active, disabled, needs_review, duplicate/wrong-user, expired entitlement, export isolation, and route-level fact gating.
6. Add Playwright coverage for the exact routes/selectors listed above at 375px and desktop after the data model gates are in place.
