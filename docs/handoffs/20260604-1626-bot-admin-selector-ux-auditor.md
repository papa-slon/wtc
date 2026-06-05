# bot-admin-selector-ux-auditor handoff
## Scope
Read-only Phase 4.23 audit for WTC bot completion. Inspected current admin bot/user surfaces and bot statistics/settings flow for the requirement: admin can easily select/search a user by name/email/user id/pub_id and inspect that user's bot stats/settings read-only, while global admin defaults remain separate.

No code or docs were edited except this handoff file.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit, except this required handoff file: `docs/handoffs/20260604-1626-bot-admin-selector-ux-auditor.md`.

## Findings
1. Severity P1 - The selected-user detail page mostly satisfies the inspection requirement after an admin already has the `userId`, but the user-selection entry point does not satisfy the "easily select/search user/name/pub_id" part. Evidence: `/admin/users` loads every user with `loadAdminUsers()` and renders a static table with columns Email, Display name, Roles, Account state, Registered, Actions, but no `searchParams`, search form, or pub_id/provider-account data (`apps/web/src/app/admin/users/page.tsx:19`, `apps/web/src/app/admin/users/page.tsx:23`, `apps/web/src/app/admin/users/page.tsx:63`, `apps/web/src/app/admin/users/page.tsx:74`, `apps/web/src/app/admin/users/page.tsx:78`, `apps/web/src/app/admin/users/page.tsx:117`). Recommendation: implement a bounded admin selector UX on `/admin/users` or `/admin/bots/users` with server-side query filtering for display name, email, user id, and Legacy pub_id, returning only safe summary fields plus a link to `/admin/users/{id}/bots`. Target part: admin user selection/search.
2. Severity P1 - Admin can search visually in the fleet page only by browser find or table scan; the app has no first-class pub_id lookup even though pub_id is the operational identifier shown in multiple bot admin tables. Evidence: `/admin/bots` builds owner rows from Tortila snapshots and Legacy provider accounts (`apps/web/src/app/admin/bots/page.tsx:140`, `apps/web/src/app/admin/bots/page.tsx:158`, `apps/web/src/app/admin/bots/page.tsx:163`), links mapped rows to selected-user drilldown (`apps/web/src/app/admin/bots/page.tsx:124`, `apps/web/src/app/admin/bots/page.tsx:130`, `apps/web/src/app/admin/bots/page.tsx:135`), and displays Legacy pub_id inspector rows (`apps/web/src/app/admin/bots/page.tsx:696`, `apps/web/src/app/admin/bots/page.tsx:706`, `apps/web/src/app/admin/bots/page.tsx:711`, `apps/web/src/app/admin/bots/page.tsx:712`), but there is no search/filter affordance in this page or `/admin/users`. Recommendation: reuse the existing mapped-owner data shape but add a compact selector/search card that can resolve mapped pub_id to the selected-user detail; unmapped pub_id results must remain fleet diagnostics with no fake user link. Target part: pub_id-to-user discovery.
3. Severity P2 - Global admin defaults are technically separated, but navigation/context can still mislead admins into thinking `/admin/bots/config` is the place to inspect a user's settings. Evidence: the global editor is explicitly a system-default writer with controls and copy saying "Saving here changes only the WTC system reference profile" (`apps/web/src/app/admin/bots/config/page.tsx:84`, `apps/web/src/app/admin/bots/config/page.tsx:87`, `apps/web/src/app/admin/bots/config/page.tsx:101`, `apps/web/src/app/admin/bots/config/page.tsx:109`, `apps/web/src/app/admin/bots/config/page.tsx:133`, `apps/web/src/app/admin/bots/config/page.tsx:231`), while the selected-user page is read-only and displays resolved settings source (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:280`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:291`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:353`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:505`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:514`). Recommendation: put the selector/search surface near admin bot entry points with copy/actions that distinguish "Inspect selected user" from "Edit global system defaults"; do not add edit links inside selected-user cards. Target part: admin IA and copy.
4. Severity P2 - The detail page already has strong read-only stats/settings inspection once selected, so the next slice should not rebuild statistics panels. Evidence: the selected-user page shows command-center metrics and rows (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:327`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:329`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:334`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:340`), bot drilldown overview with settings source/runtime/warnings/latest stats (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:353`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:362`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:373`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:378`), resolved settings summary (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:502`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:517`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:557`), latest metrics and scoped stats (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:589`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:607`), provider mappings (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:711`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:731`), and saved key metadata without secret material (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:745`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:760`). Recommendation: highest-value bounded slice is selector/search + routing + acceptance coverage, not a new stats component. Target part: UX/product completion.
5. Severity P2 - Loader data is safe for detail inspection but not shaped for selector search by pub_id. Evidence: `loadAdminUsers()` returns only safe user fields from `listUsersWithCreatedAt()` (`apps/web/src/features/admin/queries.ts:148`, `apps/web/src/features/admin/queries.ts:155`, `apps/web/src/features/admin/queries.ts:169`), while selected-user detail separately reads provider accounts for only one `userId` (`apps/web/src/features/admin/user-bot-detail-loader.ts:871`, `apps/web/src/features/admin/user-bot-detail-loader.ts:891`, `apps/web/src/features/admin/user-bot-detail-loader.ts:931`, `apps/web/src/features/admin/user-bot-detail-loader.ts:944`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1065`). Recommendation: add a server-only `loadAdminBotUserSelector(query)` that joins/searches users plus active Legacy `bot_provider_accounts.provider_account_id`, returns masked/safe provider id display already consistent with existing DTOs, and caps result size. Target part: admin query layer.
6. Severity P3 - Some empty-state/copy can mislead admins by implying "no users" when what they need is "your selector has no matching user/pub_id" after search. Evidence: current `/admin/users` empty state only distinguishes no database users vs demo/no database (`apps/web/src/app/admin/users/page.tsx:64`, `apps/web/src/app/admin/users/page.tsx:65`, `apps/web/src/app/admin/users/page.tsx:68`, `apps/web/src/app/admin/users/page.tsx:69`, `apps/web/src/app/admin/users/page.tsx:70`). Recommendation: the selector must have separate empty states for no Postgres, no registered users, no matching query, unmapped pub_id, and ambiguous/inactive provider mappings. Target part: selector empty/error states.

## Decisions
- Treat the current selected-user detail view as the destination to preserve. It is already read-only and evidence-rich; the missing product value is fast, reliable selection.
- Keep global defaults at `/admin/bots/config` as a separate system-default writer. The selector should link to user inspection, not global default editing.
- Keep pub_id lookup read-only. A matched active mapping may link to `/admin/users/{userId}/bots#bot-legacy_bot`; an unmapped pub_id should stay fleet diagnostics and must not invent ownership.
- Do not add live probes, start/stop/apply-config, exchange tests, provider mutation, or config mutation to this slice.

## Risks
- If selector search uses client-only filtering over the existing full user table, it will not scale and will still miss pub_id lookup unless every provider mapping is preloaded into the page.
- If pub_id lookup returns raw provider ids inconsistently with existing masking/hashing behavior, it could leak more operational identity than intended. Reuse existing safe display conventions and static tests.
- If the selector is placed only on `/admin/bots`, admins who start from `/admin/users` still face a table scan. Put the search affordance on `/admin/users` or make it reachable from both `/admin/users` and `/admin/bots`.
- If copy/actions blur selected-user inspection and global system-default editing, admins may assume a global config save changes the selected user's live settings.

## Verification/tests
RUN:
- Read-only file/search inspection only.

NOT RUN:
- No unit/integration tests run; user requested no tests/live commands except read-only searches/file reads.
- No Playwright/browser run; user requested read-only searches/file reads only.
- No live server, database, worker, provider, exchange, or bot commands run.
- No lint/typecheck/build/secret scan run; outside the requested read-only audit scope.
- No background agents launched from this Codex session; this is the single requested auditor handoff and no N-agent audit claim is made.

## Next actions
1. Implement the next bounded UX/product slice: `admin bot user selector`.
   - Add a server-rendered selector/search on `/admin/users` (or a shared admin selector card mounted on `/admin/users` and `/admin/bots`) that accepts one query field.
   - Search by email, display name, user id, and active Legacy pub_id/provider account id.
   - Return capped safe rows: display name, email, user id, roles, access summary, bot products, Legacy pub_id mapping status, latest scoped stats timestamp/counts if already available, and "Open user bot drilldown".
   - Keep unmapped pub_id rows visibly fleet-only with no user drilldown link.
   - Keep global system defaults separate with explicit "Edit global defaults" action only outside selected-user inspection.
2. Concrete acceptance checks for the implementation slice:
   - `/admin/users?q=<display name>` shows matching user row and `Open user bot drilldown` links to `/admin/users/{userId}/bots`.
   - `/admin/users?q=<email>` shows the same selected user and does not require scanning the full directory.
   - `/admin/users?q=<user id>` resolves the exact user and keeps bot details read-only.
   - `/admin/users?q=<mapped Legacy pub_id>` shows the mapped user, labels the mapping as Legacy pub_id/provider-account scoped, and links to `/admin/users/{userId}/bots#bot-legacy_bot`.
   - `/admin/users?q=<unmapped Legacy pub_id>` shows a fleet-diagnostics result or clear no-owner state and does not fabricate a user link.
   - Search result rows contain no exchange secrets, raw configs, raw provider response bodies, URLs, stack traces, or live-control actions.
   - Selected-user drilldown continues to show settings source, scoped statistics, provider mapping evidence, and saved key metadata as read-only.
   - `/admin/bots/config` remains visibly "system defaults" and does not appear as a selected-user settings editor.
   - Demo/no-Postgres, no users, no matches, unmapped pub_id, and ambiguous/inactive mapping states have distinct copy.
3. Suggested focused tests once implementation is authorized:
   - Static test for selector copy and no live-control/provider-mutation actions.
   - Loader test with two users, one active mapped Legacy pub_id, one unmapped pub_id, and one inactive/ambiguous mapping.
   - Existing admin mobile smoke extended to verify the selector input and first result action are usable at mobile width.
