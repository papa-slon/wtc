# phase-3-79-admin-fleet-user-mapping handoff
## Scope
Phase 3.79 implemented a narrow read-only admin fleet mapping slice for the WTC bot ecosystem.

The goal was to make `/admin/bots` connect Legacy runtime fleet evidence from the latest worker snapshot to active WTC user/provider mappings, so an admin can see which fleet rows are mapped to a WTC user and open `/admin/users/[userId]/bots` for that user's bot stats/settings. The slice also aligned Legacy `pub_id` display with the safer selected-user policy: raw provider ids are used only as server-side join keys and are not returned in the admin health DTO.

No live bot start/stop/apply-config/retest/test-connection path was added or run. No exchange ping, worker tick/restart, provider DB live read/write, SSH, tmux, systemd, or `.env` read/write was performed.

## Agent handoffs
1. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-platform-auditor.md`
2. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-ux-security-auditor.md`
3. `docs/handoffs/20260603-2144-admin-fleet-user-mapping-tests-auditor.md`

Background agents were launched before edits and closed before this handoff:
1. `019e8dec-c9a6-77a2-a79b-a2c51ef2cdbc`
2. `019e8dec-ddb2-7c61-9b6f-50d723b95c10`
3. `019e8dec-f233-73b3-93c1-17b11f9b4ec3`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`
5. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-platform-auditor.md`
6. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-ux-security-auditor.md`
7. `docs/handoffs/20260603-2144-admin-fleet-user-mapping-tests-auditor.md`
8. `apps/web/src/features/admin/queries.ts`
9. `apps/web/src/features/admin/types.ts`
10. `apps/web/src/features/admin/user-bot-detail-loader.ts`
11. `apps/web/src/app/admin/bots/page.tsx`
12. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
13. `packages/db/src/schema.ts`
14. `tests/integration/bot-read-safety-static.test.ts`
15. `tests/integration/admin-responsive.test.ts`
16. `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
1. `apps/web/src/features/admin/bot-health-loader.ts`
   - Extracted a PGlite-testable admin bot health DB loader from the server-only query wrapper.
   - Added active Legacy provider-account mapping projection by joining `bot_provider_accounts` to safe `users` fields for `productCode='legacy_bot'`, `provider='legacy-db'`, and `status='active'`.
   - Uses raw Legacy `pub_id` only internally to match worker snapshot rows to WTC mappings.
   - Returns masked/fingerprinted provider ids in the DTO and attaches optional `mappedUser` to provider accounts, active slots, and active orders.

2. `apps/web/src/features/admin/queries.ts`
   - Kept the env/base-mode wrapper and delegated DB projection to `loadAdminBotHealthFromDb`.
   - Preserved demo behavior when no DB is configured.

3. `apps/web/src/features/admin/types.ts`
   - Added `LegacyMappedUserAdminView`.
   - Added optional mapped-user fields to Legacy provider account, active slot, and active order admin views.

4. `apps/web/src/app/admin/bots/page.tsx`
   - Added the `Mapped user` column to Legacy provider account, active slot, and active order tables.
   - Mapped rows show user identity plus an `Open details` link to `/admin/users/[userId]/bots`.
   - Unmapped rows render as fleet-only/unmapped diagnostics.
   - No live controls or mutation forms were added.

5. `tests/integration/admin-bot-health-loader.test.ts`
   - Added a PGlite regression covering mapped and unmapped Legacy provider rows, slot/order mapping, read-only table counts, and DTO redaction.

6. `tests/integration/bot-read-safety-static.test.ts`
   - Updated static safety checks for the extracted loader, safe user join, masked provider display, fleet-only unmapped copy, and conditional user detail links.

7. `apps/web/next-env.d.ts`
   - Restored the normal `.next/types/routes.d.ts` reference after mobile Playwright generated an `.next-e2e` reference.

## Findings
1. Severity: High. The previous `/admin/bots` fleet page displayed Legacy runtime rows without WTC user mapping. The new loader now maps active Legacy provider accounts to WTC users through the WTC DB only, and the page links mapped rows to selected-user bot details.

2. Severity: High. Raw Legacy `pub_id` values were page-facing in fleet diagnostics. The new DTO exposes masked/fingerprinted ids and keeps raw ids inside the server-side loader only for matching.

3. Severity: Medium. Active slots and active orders needed the same mapping/redaction treatment as provider account rows. They now receive the mapped user when their `providerPubId` matches an active WTC mapping, and otherwise remain fleet-only diagnostics.

4. Severity: Medium. Browser/mobile proof is still demo-mode only, so DB-backed mapped-row semantics are proven by PGlite rather than Playwright.

## Decisions
1. Legacy fleet identity uses active WTC provider-account mappings only:
   `bot_provider_accounts.productCode='legacy_bot'`, `provider='legacy-db'`, `status='active'`, joined to `users`.

2. Fleet UI does not render raw Legacy `pub_id`. Long ids use prefix/suffix masks. Short ids use deterministic `id#<sha256-prefix>` fingerprints.

3. Mapped rows are navigation-only. Admins can open selected-user bot details, but cannot change a user's settings from the fleet page.

4. Unmapped snapshot rows are explicitly fleet diagnostics. They do not imply user ownership and do not get a selected-user link.

5. Tortila fleet-to-user semantics remain a product/platform decision. The safe options are either WTC bot-instance owner from `bot_metric_snapshots -> bot_instances -> users`, or a future audited provider-account mapping once Tortila has a stable provider id.

## Risks
1. The latest worker snapshot can lag behind mapping changes. Operators should read snapshot time and mapping state together.

2. The PGlite test proves loader semantics and DTO redaction, but it is not a live continuity proof for Legacy or Tortila bots.

3. Admin user identity is intentionally shown on admin-only pages. Keep the projection minimal and do not join or render password hashes, exchange secrets, raw snapshot JSON, tokens, sealed payloads, or provider DB URLs.

4. This phase did not implement Tortila user mapping on `/admin/bots`.

## Verification/tests
RUN and passed:
1. Required governance reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
2. Three read-only background agents launched before edits, each wrote one handoff listed above, and all three were closed.
3. `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts` - passed, 3 files and 68 tests.
4. `npm run typecheck -w @wtc/web` - passed before and after restoring `apps/web/next-env.d.ts`.
5. `npm run typecheck` - passed.
6. `npm run lint` - passed after removing one unused import introduced during refactor.
7. `npm run secret:scan` - passed.
8. `npm run build -w @wtc/web` - passed, 36 static pages.
9. `npm run check:core` - passed.
10. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - passed, 1 test.
11. `npm run evidence:visual -- --inventory tests/e2e/screenshots` - passed, 75 image files, 0 blocked.
12. `git diff --check` - passed.

RUN initially failed and was fixed:
1. Focused static Vitest failed until `bot-read-safety-static.test.ts` was updated for the extracted loader.
2. `npm run lint` failed on an unused `and` import in `apps/web/src/features/admin/queries.ts`; the import was removed and lint passed.

NOT RUN:
1. Full `npm test` - skipped for phase scope after focused Vitest plus core gates passed.
2. Full `npm run e2e` - skipped for phase scope; focused mobile PG8 gate was run.
3. `scripts/gates.mjs full` or `scripts/gates.mjs e2e` - skipped for phase scope.
4. Persistent DB migrate/seed - not run.
5. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` read/write, start/stop/retest/apply-config - not run and intentionally forbidden for this phase.
6. DB-backed browser proof of actual mapped rows - not run; covered semantically by PGlite and layout-wise by demo mobile Playwright.

## Next actions
1. Decide and implement Tortila fleet identity semantics for `/admin/bots`.
2. Add DB-backed Playwright harness only if a throwaway DB path is created that does not touch live providers or live bots.
3. Continue toward the broader bot completion goal: exchange-key connection test UX through mocked/dev adapters, user default/custom config UX polish, Legacy/Tortila statistics dashboards, and eventual audited runtime continuity proof without live mutations until safety gates approve them.
