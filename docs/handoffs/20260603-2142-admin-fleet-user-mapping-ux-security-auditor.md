# admin-fleet-user-mapping-ux-security-auditor handoff
## Scope
Phase 3.79 read-only UX/security audit for the WTC admin bot fleet and selected-user bot drilldown. The audit focused on whether admins can safely understand bot/provider/user mapping, move from fleet diagnostics to selected-user bot stats/settings, and preserve the read-only/no-live-control/no-secret policy.

No code, product docs, runtime, worker, provider, live server, `.env`, SSH, tmux, systemd, exchange, or database mutation was performed. This is exactly one read-only auditor handoff, per the operator request.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The fleet `/admin/bots` page renders raw Legacy `pub_id` values from worker snapshot JSON in three visible tables. Evidence: `apps/web/src/features/admin/queries.ts:436` selects the latest Legacy metric `rawJson`, `apps/web/src/features/admin/queries.ts:458` to `apps/web/src/features/admin/queries.ts:469` copies `row.pubId` into `legacyProviderAccounts`, `apps/web/src/features/admin/queries.ts:470` to `apps/web/src/features/admin/queries.ts:484` copies active-slot/order `providerPubId`, and `apps/web/src/app/admin/bots/page.tsx:229` to `apps/web/src/app/admin/bots/page.tsx:245`, `apps/web/src/app/admin/bots/page.tsx:258` to `apps/web/src/app/admin/bots/page.tsx:284` render those values directly. Recommendation: use a shared admin display helper before React props are built: long IDs as prefix/suffix masks, short IDs as deterministic `id#<sha256-prefix>` fingerprints, and raw IDs only inside server-side query/mapping operations. Target part: `loadAdminBotHealth`, `AdminBotHealthResult` DTOs, `/admin/bots`, fleet screenshots/static tests.

2. Severity: High. `/admin/bots` cannot currently show mapped WTC user name/email or link to the selected-user bot details page, even though the schema now has a provider-account ownership spine. Evidence: the fleet loader reads the latest product-level Legacy snapshot at `apps/web/src/features/admin/queries.ts:436` to `apps/web/src/features/admin/queries.ts:445` and derives rows from `rawJson.liveConfig` at `apps/web/src/features/admin/queries.ts:447` to `apps/web/src/features/admin/queries.ts:469`, but does not join `bot_provider_accounts` or `users`; the mapping table has `userId`, `botInstanceId`, `productCode`, `provider`, and `providerAccountId` at `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:155`; selected-user detail already queries mapped accounts at `apps/web/src/features/admin/user-bot-detail-loader.ts:758` to `apps/web/src/features/admin/user-bot-detail-loader.ts:772`; the user directory links into `/admin/users/${u.id}/bots` at `apps/web/src/app/admin/users/page.tsx:115` to `apps/web/src/app/admin/users/page.tsx:119`. Recommendation: enrich fleet rows with safe mapping state by joining active `bot_provider_accounts` to users on provider/product/account, display `Mapped to <displayName> <email>` plus `Open user bot details`, and display `Unmapped fleet diagnostic` with no user link when no verified active mapping exists. Target part: `/admin/bots` loader/page and DB-backed tests.

3. Severity: Medium. The selected-user drilldown has the right provider-ID masking behavior, but its optional label rendering can accidentally make a raw `pub_id` visible if an admin typed the raw identifier into the label. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:207` to `apps/web/src/features/admin/user-bot-detail-loader.ts:214` masks provider IDs, and `apps/web/src/features/admin/user-bot-detail-loader.ts:545` to `apps/web/src/features/admin/user-bot-detail-loader.ts:559` returns the masked ID plus unchanged `label`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:141` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:149` uses `label ?? providerAccountId` in the primary mapping sentence; labels are free-form admin text at `apps/web/src/features/admin/schemas.ts:110` to `apps/web/src/features/admin/schemas.ts:114`. Recommendation: treat labels as optional human notes, not the primary account identity; the visible identity should be user name/email, provider, status, and masked/fingerprinted `pub_id`. If labels are retained in visible tables, add copy and tests that labels must not be used to reveal raw provider IDs. Target part: selected-user mapping card/table and future fleet mapping row.

4. Severity: Medium. The short-ID masking policy is inconsistent between selected-user UI and repository audit metadata. Evidence: selected-user masking fingerprints short IDs at `apps/web/src/features/admin/user-bot-detail-loader.ts:207` to `apps/web/src/features/admin/user-bot-detail-loader.ts:214`, and tests assert a short `AB12` ID does not render at `tests/integration/admin-user-bot-detail-loader.test.ts:711` to `tests/integration/admin-user-bot-detail-loader.test.ts:749`; repository audit helper still returns short provider IDs unchanged at `packages/db/src/repositories.ts:1708` to `packages/db/src/repositories.ts:1712`, then stores `providerAccountIdMasked` in audit metadata at `packages/db/src/repositories.ts:1782` to `packages/db/src/repositories.ts:1798`. The audit log page currently does not render before/after JSON (`apps/web/src/app/admin/audit-log/page.tsx:24` to `apps/web/src/app/admin/audit-log/page.tsx:35`), but retained audit records would still violate a strict no-raw-`pub_id` policy if later surfaced. Recommendation: make the repository mask helper match the selected-user fingerprint policy and add a regression test for short provider IDs in `bot.provider_account.map` audit rows. Target part: `packages/db/src/repositories.ts`, provider-account DB tests, audit policy docs if needed.

5. Severity: Medium. Existing tests prove the selected-user page is read-only, but they do not guard the fleet raw-ID/mapping-link behavior. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:56` to `tests/integration/admin-user-bot-detail-static.test.ts:98` checks selected-user RBAC, read-only labels, no map/disable/live controls; `tests/integration/admin-user-bot-detail-static.test.ts:129` to `tests/integration/admin-user-bot-detail-static.test.ts:136` checks the user directory `Bot details` link; `tests/integration/bot-read-safety-static.test.ts:110` to `tests/integration/bot-read-safety-static.test.ts:117` only asserts the fleet inspector exists and no DB URL is shown. Recommendation: add DB/static tests that fleet rows expose masked/fingerprinted display IDs, show mapped displayName/email, link to `/admin/users/[userId]/bots`, label unmapped rows as fleet diagnostics, and never render map/disable/live controls in this read-only surface. Target part: `tests/integration/bot-read-safety-static.test.ts` plus a focused admin fleet loader test.

6. Severity: Info. Current selected-user and nav flows preserve the no-live-control/no-edit-control policy and are safe to keep. Evidence: `/admin/users/[userId]/bots` asserts admin at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:59` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:64`, renders read-only/live-disabled pills at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:74` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:83`, explains read-only provider mapping at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:366` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:371`, and offers navigation-only links at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:424` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:427`; static tests reject map/disable/start/stop/apply controls at `tests/integration/admin-user-bot-detail-static.test.ts:86` to `tests/integration/admin-user-bot-detail-static.test.ts:98`. Recommendation: future fleet-to-user UX should be navigation-only, not mapping/editing controls, until a separate security/bot-integration approval explicitly opens an audited mutation flow. Target part: `/admin/bots` link actions and selected-user page controls.

## Decisions
1. Safe mapped row labels:
   Display mapped provider rows as `Mapped to <displayName> <email>` with a secondary `pub_id <masked-or-fingerprint>` and provider/status. The selected action label should be `Open user bot details`, linking to `/admin/users/[userId]/bots`.

2. Safe unmapped row labels:
   Display unmapped worker snapshot rows as `Unmapped fleet diagnostic` or `No WTC user mapping`. These rows may show market, status, balance, symbol/slot/order counts, snapshot freshness, and quarantine state, but should not imply user ownership and should not link to selected-user stats/settings.

3. `pub_id` display policy:
   Raw provider `pub_id` should not be rendered in admin UI, retained screenshots, audit before/after payloads, fixtures, or test output. Long IDs can use prefix/suffix masks. Short IDs must use deterministic fingerprints such as `id#<sha256-prefix>` so they are correlatable without disclosure. Raw IDs may exist only in server-side DB columns and query predicates.

4. Safe actions:
   For this surface, safe actions are navigation and inspection only: `Open user bot details`, `Open fleet bot health`, and read-only table expansion/filtering if added later. Unsafe/not-in-scope controls are `Map Legacy pub_id`, `Disable mapping`, provider edit forms, settings edit forms, exchange-key reveal, start/stop/apply/retest/test-connection, provider DB probe, worker tick/restart, and any live bot control.

5. User details:
   Mapped user name/email are acceptable on admin-only pages that already assert `requireUser` plus `assertAdmin`, because `/admin/users` already displays email/name and the selected-user page already displays the target user's email. Do not expose these mappings outside admin-only server-rendered routes.

## Risks
1. Fleet diagnostics currently make raw `pub_id` values screenshot-retainable, while selected-user detail masks them. That inconsistency will confuse admins and can leak provider-account identifiers in visual evidence.
2. Joining fleet rows to users by provider account must avoid false ownership. Only active, unique `bot_provider_accounts` rows should produce a mapped-user label; missing, disabled, duplicate, or ambiguous mappings should remain fleet diagnostics.
3. Free-form labels can reintroduce sensitive identifiers if treated as the account identity. They need either stricter copy/tests or lower visual priority.
4. The worktree was already broadly dirty before this audit. This handoff did not modify or revert any product-code changes.

## Verification/tests
RUN:
1. Read-only source/document inspection only.
2. `git status --short` was inspected to confirm the pre-existing dirty worktree before writing this handoff.

NOT RUN:
1. Vitest, Playwright, typecheck, lint, build, gates, visual evidence, and secret scan were not run because this was an audit-only request.
2. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config were not run because they are forbidden by the scope and safety protocol.
3. Browser/manual UI proof was not run because the task requested read-only source audit and no local dev server/runtime operation.

## Next actions
1. Implement a shared admin-safe provider account display helper and apply it to both selected-user and fleet DTOs.
2. Update `/admin/bots` to join active mapped provider accounts to user displayName/email and render `Open user bot details` for mapped rows only.
3. Label all unmatched snapshot rows as `Unmapped fleet diagnostic` and keep them navigation-free except for fleet-level filters.
4. Align repository audit masking with the selected-user short-ID fingerprint policy.
5. Add focused loader/static tests for fleet masked IDs, mapped user name/email, selected-user links, unmapped diagnostics, and absence of edit/live controls.
