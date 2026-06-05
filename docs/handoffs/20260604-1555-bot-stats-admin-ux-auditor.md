# bot-stats-admin-ux-auditor handoff
## Scope
Read-only UX/product audit for the current bot statistics and admin/user bot drilldown surfaces after Phase 4.21 Basic settings path. Goal checked: premium, highly understandable settings/statistics for Legacy averaging bot and Tortila; users see only their own stats/settings; admins can select a user/pub_id and inspect read-only user stats/settings; global system defaults remain managed elsewhere.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
- `docs/handoffs/20260604-1555-bot-stats-admin-ux-auditor.md`

## Findings
1. Severity P1 - Admin selection exists as links, not as a premium user/pub_id selection workflow. Evidence: the fleet page builds owner/pub_id drilldown rows and links mapped rows to `/admin/users/${mappedUser.userId}/bots#${row.detailAnchor}` (`apps/web/src/app/admin/bots/page.tsx:124`, `apps/web/src/app/admin/bots/page.tsx:140`, `apps/web/src/app/admin/bots/page.tsx:442`); the user directory links each row to `Bot drilldown` (`apps/web/src/app/admin/users/page.tsx:115`); the selected-user page accepts only path `userId` and has no `searchParams`, query, filter, or selector (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:201`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:205`). Recommendation: next bounded slice should add a read-only admin selection strip or compact explorer that supports user/email and Legacy pub_id/mapped-owner discovery, preserves anchors into Tortila/Legacy cards, and clearly separates mapped vs unmapped Legacy rows. Target part: `/admin/bots`, `/admin/users`, `/admin/users/[userId]/bots` navigation only; no DB mutation.
2. Severity P1 - Selected-user drilldown safely shows settings and stats, but it does not yet mirror the new Basic settings path as one understandable admin story. Evidence: Phase 4.21 added a user first-viewport quick path and named admin read-only selected-user settings/statistics refinement as next work (`docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md:92`); the admin page has a good overview table (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:258`) plus dense per-bot blocks for evidence, provider mapping, warnings, settings, operation map, metrics, positions, trades, and equity (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:326`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:407`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:462`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:494`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:512`). Recommendation: add an admin-facing `SelectedUserBotQuickPath` or similar read-only component above each bot card that reuses safe DTO fields to summarize access, settings source, Legacy pub_id/provider scope, key metadata, runtime evidence, latest stats, warnings, and links/anchors to the detailed sections. Target part: admin selected-user bot card first viewport.
3. Severity P2 - Global defaults are correctly separated technically, but the admin UX does not make the separation discoverable from the selected-user drilldown. Evidence: global system defaults have a dedicated `/admin/bots/config` editor that states "scope: system defaults", "user settings unaffected", and "Saving here changes only the WTC system reference profile" (`apps/web/src/app/admin/bots/config/page.tsx:101`, `apps/web/src/app/admin/bots/config/page.tsx:109`); the selected-user drilldown correctly says user settings and provider mappings are read-only (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:222`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:223`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:407`), but its bottom actions link only fleet bot health and entitlements (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:674`). Recommendation: add a non-mutating "Open global defaults" link/card from the selected-user page and copy that explains this user's resolved source vs global defaults. Target part: selected-user drilldown navigation/copy.
4. Severity P2 - User-facing statistics are strong, owner-scoped, and honest, but admin statistics still lack the same analytics readability for selected users. Evidence: user statistics load through `requireUser`, entitlement checks, and `loadBotReadModelForUser(user.id, ...)` (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:226`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:229`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:231`) and show per-bot operation/evidence maps plus Legacy operational panels (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:367`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:380`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:454`). The admin loader already scopes Legacy stats by active provider account (`apps/web/src/features/admin/user-bot-detail-loader.ts:788`, `apps/web/src/features/admin/user-bot-detail-loader.ts:830`) and maps selected-user metrics/trades/equity (`apps/web/src/features/admin/user-bot-detail-loader.ts:1105`), but the admin page renders them mostly as raw metric/table blocks (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:494`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:519`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:552`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:585`). Recommendation: bounded implementation should not add new analytics math; instead add a compact admin stats summary using existing scoped DTO counts/freshness and keep full tables behind the existing sections. Target part: selected-user statistics readability.
5. Severity P2 - Existing tests cover safety and DB-backed selected-user rendering, but the next UX slice needs focused coverage for selection/discoverability and quick-path copy. Evidence: static tests assert read-only/RBAC/secret guardrails and selected-user overview markers (`tests/integration/admin-user-bot-detail-static.test.ts:67`, `tests/integration/admin-user-bot-detail-static.test.ts:182`, `tests/integration/admin-user-bot-detail-static.test.ts:244`, `tests/integration/admin-user-bot-detail-static.test.ts:253`); opt-in DB Playwright asserts selected-user facts, absence of forms/buttons, no horizontal scroll, and screenshots (`tests/e2e/admin-user-bot-detail-db.spec.ts:177`, `tests/e2e/admin-user-bot-detail-db.spec.ts:226`, `tests/e2e/admin-user-bot-detail-db.spec.ts:229`). Recommendation: extend static tests for the new selector/quick-path/global-default link and, if the slice changes rendered layout materially, run the admin-user-bots DB managed matrix. Target part: `tests/integration/admin-user-bot-detail-static.test.ts`, `tests/e2e/admin-user-bot-detail-db.spec.ts`.

## Decisions
- This was a single read-only auditor lane requested by the operator; no background agents were launched.
- Treated the heavily dirty worktree as pre-existing state. Only this handoff file was added.
- Best next Phase 4.22 implementation slice: admin selected-user/pub_id UX refinement only. Reuse existing safe loader DTOs and read-only components; do not touch live control, provider calls, exchange keys, schema/migrations, or global-default save behavior.

## Risks
- The current admin selected-user page is safe but dense; adding more sections without a compact selector/quick-path could make the premium UX worse.
- Admin global defaults already exist, including mutation forms, so any navigation from selected-user drilldown must be framed as "global defaults elsewhere" and not imply that admins can edit this user's settings from the drilldown.
- Legacy pub_id visibility is more sensitive than ordinary display copy. Continue using masked IDs on selected-user pages; unmapped/raw fleet pub_id rows should remain fleet diagnostics unless a mapping exists.

## Verification/tests
RUN:
- `git status --short --branch` - branch `codex/bot-analytics-settings-canary-20260603`; dirty worktree observed before this audit.
- Read-only source inspection with `Get-Content` and `rg`.
- Protocol gate: no live server mutation, no DB migrations/seeds, no live bot/provider/exchange calls, no deploy/SSH/tmux.

NOT RUN:
- `npm run lint`, `npm run typecheck`, `npm run build`, Vitest, Playwright, `scripts/gates.mjs` - skipped because this was a read-only UX/product audit and no application code changed.
- `npm run e2e:admin-user-bots:db:managed` / matrix - skipped; would be appropriate for the implementation slice after UI changes.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - forbidden/out of scope; no schema change proposed.
- Live bot start/stop/apply-config, live provider/exchange calls, SSH/tmux/deploy - forbidden by scope and safety protocol.

## Next actions
1. Implement a read-only admin selection/discovery strip: user/email from `/admin/users`, mapped Tortila owners, mapped Legacy pub_id rows, and clear unmapped Legacy state that stays fleet-only.
2. Add a selected-user quick-path component above each admin bot card, using existing `AdminUserBotSummary` fields to summarize access, settings source, provider scope/pub_id, runtime health, latest stats, warnings, and the read-only boundary.
3. Add a visible link/copy from selected-user drilldown to `/admin/bots/config` for global system defaults, making clear that it changes only system reference profiles and not user-owned profiles.
4. Extend static tests for the new selector/quick-path/global-default link; run focused Vitest and, for rendered confidence, the opt-in admin-user-bots DB managed Playwright matrix.
