# Phase 4.23 admin bot owner selector handoff

## Scope
Bounded implementation slice toward the larger Legacy/Tortila bot completion goal: make the admin entry point for selected-user bot inspection obvious and searchable.

This phase adds a read-only bot owner selector to `/admin/users` so an admin can search across:

- user display name
- user email
- user id
- Tortila owner snapshot identity
- masked Legacy `pub_id`

The selector routes mapped rows to `/admin/users/<userId>/bots` with product anchors and routes unmapped Legacy `pub_id` rows to `/admin/bots` fleet diagnostics. It does not edit user settings, provider mappings, exchange keys, live config, positions, or runtime state.

Per-agent handoffs linked by this aggregate:

- `docs/handoffs/20260604-1626-bot-admin-selector-ux-auditor.md`
- `docs/handoffs/20260604-1626-bot-admin-selector-gates-auditor.md`
- `docs/handoffs/20260604-1628-bot-admin-selector-security-auditor.md`

## Files inspected
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/screenshots/admin-users-desktop.png`
- `tests/e2e/screenshots/admin-users-mobile.png`
- `tests/e2e/screenshots/admin-users-mobile375.png`

## Files changed
- `apps/web/src/app/admin/users/page.tsx` - added a server-rendered read-only bot owner selector using safe `loadAdminUsers()` and `loadAdminBotHealth()` DTOs; supports query string filtering by `q`.
- `tests/integration/admin-user-bot-detail-static.test.ts` - added static guardrails for the selector, links, global-default boundary, and absence of secrets/live-control markers.
- `tests/integration/bot-read-safety-static.test.ts` - added a dedicated safety assertion that the admin users selector stays read-only and does not expose raw provider/control data.
- `tests/e2e/smoke.spec.ts` - extended admin users rendered smoke to check selector, search submission, selected-user boundary copy, and global defaults link.

## Findings
1. Severity P1 - The selected-user drilldown was strong once reached, but the admin entry workflow was still a plain user table and did not feel like a searchable operator surface. Evidence: `apps/web/src/app/admin/users/page.tsx` only rendered user rows and a `Bot drilldown` link before this phase. Resolution: added `Bot owner selector` with search and product-specific drilldown actions.
2. Severity P1 - Admins needed a clear distinction between selected-user settings/statistics inspection and global system defaults. Resolution: selector includes a visible `Global defaults` link to `/admin/bots/config` and copy stating that system defaults are separate.
3. Severity P2 - Unmapped Legacy `pub_id` rows must not be presented as user-owned facts. Resolution: unmapped rows route to `/admin/bots` as fleet diagnostics, while mapped rows route to `/admin/users/<userId>/bots#bot-legacy_bot`.
4. Severity P2 - Mobile admin workflow needed rendered 375px proof because the selector adds another table/form surface. Resolution: existing admin mobile PG8 spec covers `/admin/users` and passed after the selector was added.

## Decisions
- Reused the existing safe `loadAdminBotHealth()` projection instead of introducing raw DB reads into the page.
- Kept the selector server-rendered and query-string based; no client-side state or new endpoint was added.
- Search uses only safe visible fields: display name, email, user id, bot instance id, masked Legacy `pub_id`, market, and product labels.
- Kept unlock form behavior unchanged and isolated from the selector.
- No mapping/edit controls were added; provider mapping remains outside this selector.

## Risks
- Formal visual-artifact acceptance is still not green because no review manifest exists for the screenshot root. Manual screenshot spot-check was performed only.
- Demo mode has zero users/snapshots, so rendered smoke proves layout/search controls but not populated selector rows. DB-backed admin matrix remains the stronger real-row proof path.
- The selector uses masked `pub_id` values only; searching by full raw `pub_id` is intentionally not supported from this UI.

## Verification/tests
RUN:
- `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-account-unlock-static.test.ts` - PASS, 84 tests.
- `npm run typecheck -w @wtc/web` - PASS.
- `npx playwright test tests/e2e/smoke.spec.ts -g "Phase 2.3 admin pages"` with `E2E_PORT=3450` - PASS, desktop and mobile.
- `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` with `E2E_PORT=3450` - PASS.
- `node scripts/gates.mjs quick` - PASS: lint, root typecheck, web typecheck, full Vitest.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS with one known historical warning.
- `git diff --check` - PASS.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory only: 103 image files, 0 blocked binary/container artifacts.
- Manual screenshot spot-check: `tests/e2e/screenshots/admin-users-desktop.png`, `tests/e2e/screenshots/admin-users-mobile.png`, `tests/e2e/screenshots/admin-users-mobile375.png`.

NOT RUN / NOT GREEN:
- `npm run evidence:visual -- --manifest <manifest>` - NOT RUN/NOT GREEN; no visual review manifest was created for retained screenshots.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires explicit disposable admin Postgres URL/harness authorization.
- Worker live continuity with real Tortila journal or Legacy DB - NOT RUN; this phase did not authorize live provider reads.
- Live bot start/stop/apply-config, exchange key probe, provider probe - NOT RUN by design and remains disabled.
- Production deploy - NOT RUN.

## Next actions
1. Add a DB-backed selector/browser scenario when disposable Postgres is available, proving populated rows for user, Tortila owner, mapped Legacy `pub_id`, and unmapped Legacy fleet diagnostics.
2. Continue completing Legacy/Tortila bot surfaces by improving user-facing analytics depth and runtime continuity proof without enabling live-control actions.
3. Create a visual review manifest if retained screenshots need to be promoted from manual QA/inventory into formal visual acceptance.
