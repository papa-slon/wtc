# admin-fleet-user-mapping-tests-auditor handoff
## Scope
Phase 3.79 read-only tests audit for the WTC admin fleet provider-to-user mapping slice.

Scope covered:
- Read required governance and prior handoff docs first.
- Inspect existing integration/e2e coverage for admin bot fleet, selected admin user bot detail, admin mobile PG8, and bot read safety.
- Recommend focused PGlite, static, and Playwright gates proving:
  - mapped Legacy provider accounts show a safe link to the owning user's bot drilldown;
  - unmapped provider snapshot rows remain fleet-only with no user link;
  - raw secrets and provider identifiers are safe under the chosen display policy;
  - no start, stop, apply-config, retest, exchange-test, or live provider controls appear.

Out of scope and not performed:
- No product-code edits.
- No test execution.
- No live bot mutation.
- No worker tick/restart.
- No provider DB read/write.
- No exchange ping/test.
- No SSH, tmux, systemd, or `.env` operations.

Recommended provider identifier display policy for this test plan:
- Use the secure default: once fleet rows can link to a user, do not render raw Legacy `pub_id` values in admin UI DTOs/pages. Render a deterministic fingerprint or masked value, and keep the raw value server-side only for matching worker snapshot rows to `bot_provider_accounts`.
- If the operator deliberately chooses "raw `pub_id` allowed on fleet diagnostics", encode that as an explicit product/security decision before tests are written, and make the static tests prove that raw `pub_id` is the only allowed raw provider field, never exchange keys, DB URLs, tokens, raw JSON, or secrets.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`
- `package.json`
- `apps/web/package.json`
- `playwright.config.ts`
- `playwright.auth-db.config.ts`
- `scripts/run-auth-db-e2e.mjs`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `apps/web/src/features/admin/queries.ts:436` selects the latest Legacy metric snapshot raw JSON, `apps/web/src/features/admin/queries.ts:458` maps `legacyLiveConfig.providerAccounts` to fleet rows, and `apps/web/src/features/admin/queries.ts:519` returns those rows without joining `bot_provider_accounts` or users. `apps/web/src/app/admin/bots/page.tsx:232` renders those rows and `apps/web/src/app/admin/bots/page.tsx:234` renders `account.pubId`. Recommendation: add/extract a pure PGlite-testable `loadAdminBotHealthFromDb(db, envFlags)` projection that left-joins snapshot provider rows to active `bot_provider_accounts` by `(productCode='legacy_bot', provider='legacy-db', providerAccountId, status='active')`, then to a safe user display projection. Target part: `apps/web/src/features/admin/queries.ts`, `apps/web/src/features/admin/types.ts`, `apps/web/src/app/admin/bots/page.tsx`, and a new PGlite test.

2. Severity: High. Evidence: the selected-user drilldown already masks provider IDs in `apps/web/src/features/admin/user-bot-detail-loader.ts:207`, fingerprints short IDs at `apps/web/src/features/admin/user-bot-detail-loader.ts:209`, selects provider mappings at `apps/web/src/features/admin/user-bot-detail-loader.ts:758`, and scopes Legacy stats to the active mapped provider at `apps/web/src/features/admin/user-bot-detail-loader.ts:888`. The existing PGlite test asserts mapped provider evidence is masked and scoped at `tests/integration/admin-user-bot-detail-loader.test.ts:518`, `tests/integration/admin-user-bot-detail-loader.test.ts:523`, `tests/integration/admin-user-bot-detail-loader.test.ts:537`, `tests/integration/admin-user-bot-detail-loader.test.ts:744`, and `tests/integration/admin-user-bot-detail-loader.test.ts:749`. Recommendation: reuse this masking/scoping pattern for fleet user-link rows, or deliberately document the fleet-only raw `pub_id` exception before encoding tests. Target part: shared admin provider display helper and fleet DTO.

3. Severity: High. Evidence: Phase 3.78 explicitly left the fleet raw `pub_id` policy unchanged in `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md:59` and recorded the risk at `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md:63`. Recommendation: make provider display policy an acceptance precondition for this slice. The safest default gate should assert no raw provider IDs in `JSON.stringify(loadAdminBotHealthFromDb(...))`, no raw provider IDs in rendered page text, and only masked/fingerprinted provider labels in mapped and unmapped fleet rows. Target part: test fixtures and static source guards.

4. Severity: Medium. Evidence: `packages/db/src/schema.ts:146` through `packages/db/src/schema.ts:173` defines `bot_provider_accounts` with user, bot instance, provider account id, active uniqueness, and status checks. `packages/db/src/repositories.ts:1678` lists mappings by user, `packages/db/src/repositories.ts:1689` lists active mappings by product/provider, and `packages/db/src/repositories.ts:1714` through `packages/db/src/repositories.ts:1804` upserts mappings with ownership checks and an audited masked provider id. Recommendation: write the PGlite fleet test against the schema/repository primitives instead of mocking the mapping table, so disabled rows and duplicate active provider constraints are represented by the same DB behavior used in production. Target part: new `tests/integration/admin-bot-fleet-provider-user-mapping.test.ts`.

5. Severity: Medium. Evidence: existing static tests prove selected-user bot detail is RBAC-gated and read-only at `tests/integration/admin-user-bot-detail-static.test.ts:56`, no selected-user mapping forms or live controls exist at `tests/integration/admin-user-bot-detail-static.test.ts:86` through `tests/integration/admin-user-bot-detail-static.test.ts:97`, and admin mapping actions themselves are CSRF/admin/Zod/audited at `tests/integration/admin-user-bot-detail-static.test.ts:100` through `tests/integration/admin-user-bot-detail-static.test.ts:126`. Bot read-safety static coverage proves user DB snapshots are provider-mapping scoped at `tests/integration/bot-read-safety-static.test.ts:88` through `tests/integration/bot-read-safety-static.test.ts:98`, and only checks that admin fleet exposes a safe inspector and no DB URL at `tests/integration/bot-read-safety-static.test.ts:110` through `tests/integration/bot-read-safety-static.test.ts:116`. Recommendation: add a fleet-specific static guard that checks user links are conditional, unmapped rows render `fleet-only`, no secret/source raw fields are passed through, and `/admin/bots` still has no live controls. Target part: new or extended static Vitest test.

6. Severity: Medium. Evidence: current PG8 Playwright coverage includes `/admin/users/demo-user/bots` and `/admin/bots` at `tests/e2e/admin-mobile-pg8.spec.ts:23` and `tests/e2e/admin-mobile-pg8.spec.ts:28`, but the file states e2e runs in demo mode with no DB rows at `tests/e2e/admin-mobile-pg8.spec.ts:12`. It asserts mobile nav/storage/no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:42` through `tests/e2e/admin-mobile-pg8.spec.ts:59`; static admin-responsive coverage wraps tables and data labels at `tests/integration/admin-responsive.test.ts:69` through `tests/integration/admin-responsive.test.ts:82`. Recommendation: keep PG8 as the UI regression gate, but do not use it as proof of DB-backed mapping semantics unless a throwaway DB-backed admin mapping Playwright harness is added. Target part: Playwright gate plan and optional new DB e2e harness.

## Decisions
1. This audit recommends a fail-closed provider identifier policy for the next implementation: raw Legacy `pub_id` values should not be rendered by the fleet page once the row can identify a WTC user.
2. The primary semantic proof should be PGlite, not live Postgres or provider DB, because it can replay migrations and seed worker snapshot rows plus `bot_provider_accounts` without touching live systems.
3. Static tests should protect source boundaries: no `exchangeApiKeySecrets`, no `passwordHash`, no DB URL, no unfiltered raw JSON pass-through, no start/stop/apply/retest/test-control strings, and no action form on `/admin/bots` for live controls.
4. Playwright should remain a render/mobile/no-control gate unless a separate throwaway DB harness is created. Demo-mode PG8 cannot prove mapped vs unmapped DB semantics.

## Risks
1. If product/security chooses to allow raw `pub_id` in fleet diagnostics, the PGlite and static assertions must be adjusted before implementation. Without an explicit policy, tests may either over-mask useful admin diagnostics or under-protect provider identifiers.
2. Current `loadAdminBotHealth()` depends on `getServerDb()` and process env flags, so a clean PGlite test likely needs an extracted `loadAdminBotHealthFromDb()` or dependency-injected helper. That refactor should remain read-only with respect to live systems.
3. A Playwright proof of mapped links requires a throwaway DB-backed harness. Reusing a live/staging database or reading provider env would violate the phase safety constraints.
4. Active slots and active order tables also display provider IDs. If the chosen policy masks fleet provider account rows, these related rows need the same display policy or an explicit reasoned exception.

## Verification/tests
Commands run in this audit:
1. Read-only file inspection with `Get-Content`, `rg`, and line-numbered PowerShell reads.

Gates not run in this audit:
1. `npx vitest ...` - not run because this phase is a read-only tests audit and no test files were changed.
2. `npx playwright ...` - not run because this phase is a read-only tests audit and current Playwright admin PG8 is demo-mode only.
3. `npm run worker:smoke`, `npm run worker:tick`, or any worker command - forbidden by scope.
4. Persistent DB migrate/seed, live provider DB reads/writes, exchange ping/test, SSH, tmux, systemd, `.env` read/write, start/stop/retest/apply-config - forbidden by scope.

Focused gates recommended after implementation:
1. PGlite semantic gate:
   `npx vitest run tests/integration/admin-bot-fleet-provider-user-mapping.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`
   - The new test should replay migrations in PGlite, seed users and Legacy bot instances, insert one active mapped provider account, one disabled/old mapping, and at least one unmapped worker snapshot `pubId`.
   - Assert mapped row has `userBotHref` equal to `/admin/users/<userId>/bots`, safe user label only, mapped status, and masked/fingerprinted provider label.
   - Assert unmapped snapshot row has no `userId`, no email/displayName, no href, and an explicit `fleet_only`/`unmapped` state.
   - Assert disabled or wrong-product mappings do not produce a link.
   - Assert table counts do not change before/after loader call.
   - Assert `JSON.stringify(result)` does not contain raw provider IDs, `LEGACY_DATABASE_URL`, `apiKey`, `apiSecret`, `sealed`, `token`, `passwordHash`, raw snapshot markers, or another user's private markers.

2. Static source gate:
   `npx vitest run tests/integration/admin-bot-fleet-user-mapping-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts`
   - Assert fleet loader uses `schema.botProviderAccounts` and safe `schema.users` projection but never joins `exchangeApiKeySecrets`.
   - Assert fleet DTO/page uses the chosen provider display helper and does not render raw provider IDs under the fail-closed policy.
   - Assert mapped link rendering is conditional and unmapped rows render fleet-only copy with no link.
   - Assert `/admin/bots` contains no `startBot`, `stopBot`, `applyConfig`, `retest`, `test connection`, live exchange ping copy, live control form action, or submit button for live controls.
   - Assert table wrappers/data labels remain intact for PG8.

3. Playwright render/mobile gate:
   `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
   - Proves `/admin/bots` and `/admin/users/demo-user/bots` still render, keep storage state visible, preserve mobile nav, and avoid 375px horizontal scroll.
   - This gate does not prove DB mapping semantics because it runs without `DATABASE_URL`.

4. Optional DB-backed Playwright gate only after a throwaway DB harness exists:
   `npx playwright test tests/e2e/admin-bot-fleet-user-mapping.spec.ts --project=mobile`
   - Must use a fresh throwaway DB, E2E auth bypass, mock bot adapter mode, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
   - Must not use live provider env, live provider DB, worker tick, SSH, tmux, or systemd.
   - Assert mapped row link opens `/admin/users/<userId>/bots`, unmapped row has no link, raw provider IDs/secrets are absent from visible text, and no start/stop/apply/test controls are visible.

5. Post-change hygiene gates:
   `npm run typecheck -w @wtc/web`
   `npm run typecheck`
   `npm run lint`
   `npm run secret:scan`
   `npm run governance:check`
   `npm run evidence:visual -- --inventory tests/e2e/screenshots` if Playwright screenshots are retained.

## Next actions
1. Confirm or override the fail-closed fleet provider identifier display policy before coding.
2. Extract or add a PGlite-testable admin fleet DB loader projection.
3. Add `tests/integration/admin-bot-fleet-provider-user-mapping.test.ts` with mapped, disabled, and unmapped provider snapshot fixtures.
4. Add or extend a static fleet mapping guard for conditional user links, provider redaction, no secret joins, and no live controls.
5. Run the focused gates above, recording exact RUN and NOT RUN results in the phase implementation handoff.
