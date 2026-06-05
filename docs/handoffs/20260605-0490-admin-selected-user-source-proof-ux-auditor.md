# admin-selected-user-source-proof-ux-auditor handoff
## Scope
Read-only UX/product audit for Phase 4.49. Scope was to inspect the current admin selected-user bot drilldown and the user/admin Legacy statistics surfaces, then recommend the smallest premium and clear placement for dynamic Legacy closed-trade source-proof status on admin selected-user pages.

This audit did not read env or secret files, did not call live services, did not mutate the database, did not run servers, and did not invoke bot control. It focused on letting an admin understand a user's resolved bot settings, statistics state, and Legacy source-proof reason without gaining any ability to change the user's settings or runtime state.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-ux-auditor.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The user Legacy statistics path already has the right small source-proof UX, so admin selected-user should mirror it instead of inventing a new panel. Evidence: `apps/web/src/features/bots/data.tsx:337` defines a sanitizer for `closedTradeSourceProof`; `apps/web/src/features/bots/data.tsx:665` reads the latest metric raw object only inside the loader and `apps/web/src/features/bots/data.tsx:667` extracts `rawMetric.closedTradeSourceProof`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:302` stores the Legacy proof summary and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:540` passes it to `LegacyOperationsPanel`; `apps/web/src/features/bots/statistics-panels.tsx:623` renders the `Source-proof gate` metric and `apps/web/src/features/bots/statistics-panels.tsx:646` switches the warning title to `Legacy source proof blocked`. Recommendation: reuse this product language and status grammar on selected-user admin pages: `source blocked`, `mapper ready`, or `not evaluated`, plus a short missing-proof summary. Target part: selected-user admin Legacy statistics card and coverage matrix.
2. Severity P1 - The selected-user admin drilldown still reduces Legacy closed-trade absence to generic `pending import`, which hides the actual source-proof reason support/admins need. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57` makes Legacy metrics return `pending import` when no trades exist; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:183` has a `Closed-trade history` coverage row; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:185` sets that state to `pending import`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:812` labels the Legacy metric card `Closed-trade history`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:814` explains only `realized PnL pending import`. Recommendation: add one Legacy-only `Source proof` row immediately after `Closed-trade history` in `adminStatisticsCoverageRows`, and change the Legacy metric subcopy to `source proof blocked` when the proof status is `blocked_no_source`. Target part: `adminStatisticsCoverageRows()` and the `#bot-legacy_bot-statistics` metric grid.
3. Severity P1 - Dynamic admin selected-user proof must be a DTO-safe loader projection, not a raw worker JSON pass-through. Evidence: `apps/web/src/features/admin/types.ts:39` defines `AdminUserBotMetricSummary` without a source-proof field; `apps/web/src/features/admin/types.ts:170` defines `AdminUserBotSummary` without a source-proof summary; `apps/web/src/features/admin/user-bot-detail-loader.ts:1078` selects metric scalar columns through `profitFactor`, `maxDrawdownPct`, `tradeCount`, and `sourceAdapter` but does not select the source-proof summary; `tests/integration/admin-user-bot-detail-static.test.ts:44` and `tests/integration/admin-user-bot-detail-static.test.ts:45` currently forbid selecting trade or metric `rawJson`; `tests/integration/admin-user-bot-detail-static.test.ts:197` and `tests/integration/admin-user-bot-detail-static.test.ts:256` also forbid raw JSON in admin source/page code. Recommendation: add a small admin DTO such as `AdminLegacyClosedTradeSourceProofSummary` with only `status`, `canImportClosedTrades`, sanitized `missingRequirements`, and `blockerCount`; if the loader must touch metric JSON to hydrate it, isolate that in one server-only extractor and update static tests to forbid raw JSON pass-through while allowing the exact safe projection. Target part: `features/admin/types.ts`, `features/admin/user-bot-detail-loader.ts`, and focused static tests.
4. Severity P2 - The selected-user page already has premium, clear read-only containers for this without adding a new card or action surface. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:237` states the settings mirror shows resolved settings without edit controls; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:344` has a `User-scoped statistics` evidence-ladder row; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:557` labels the page `Selected-user read-only drilldown`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:637` renders `AdminBotRuntimeEvidencePanel` for the bot; `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:27` already displays a read-only evidence warning and `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:68` says admin visibility is diagnostic only. Recommendation: do not add a separate source-proof card or CTA. Put the dynamic status in the existing evidence ladder and coverage table, with an optional small status pill near the Legacy bot card header if screen space allows. Target part: selected-user bot card, evidence ladder, and statistics coverage table.
5. Severity P2 - Admin fleet already names the global blocker, but selected-user needs user-scoped context to prevent support from mistaking the blocker for a missing user setting. Evidence: `apps/web/src/app/admin/bots/page.tsx:180` has a `Legacy closed-trade analytics` gate; `apps/web/src/app/admin/bots/page.tsx:182` states `source proof blocked`; `apps/web/src/app/admin/bots/page.tsx:183` explains stable closed-trade ids and close timestamps are required; `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:70` says admins can inspect this user-scoped settings and statistics model in selected-user drilldown. Recommendation: keep `/admin/bots` as the fleet/global gate and add selected-user wording that says `Source proof blocked - not a user settings problem`; next proof should be `source-proof artifact before importer`, not an admin action. Target part: selected-user Legacy coverage row and read-only admin evidence copy.

## Decisions
1. Recommended the smallest UX placement: one Legacy-only `Source proof` row in the selected-user statistics coverage matrix, plus one short `source proof blocked` sublabel on the existing `Closed-trade history` metric when no Legacy trades exist.
2. Recommended optional evidence-ladder enrichment only if it stays compact: add `Legacy source proof` as a diagnostic row or append the proof reason to the existing `User-scoped statistics` row. Do not add a new floating card, modal, settings editor, or CTA.
3. Recommended that admin selected-user hydration use the same safe fields as the user statistics path: `status`, `canImportClosedTrades`, sanitized `missingRequirements`, and `blockerCount`. Do not expose raw metric JSON, provider payloads, env names, source URLs, exchange identifiers beyond the existing masked/mapped pub_id conventions, or secret-shaped fields.
4. Recommended copy:
   - Status pill: `source blocked`
   - Evidence: `No durable Legacy closed-trade source is proven. Active orders, slots, and position snapshots are not closed-trade proof.`
   - Next proof: `Provide a source-proof table/API contract before importer.`
   - Boundary: `Read-only admin evidence; not a user setting or live-control action.`
5. Recommended no settings mutation changes. The existing selected-user page already shows resolved WTC settings and provider mappings as read-only evidence; source-proof visibility should explain statistics availability, not unlock editing.

## Risks
1. If the implementation reads and passes `rawJson` directly into admin React props, it will break the current selected-user safety boundary and risks leaking future provider/source payload details.
2. If the admin page keeps only `pending import`, support may incorrectly tell users to wait, change settings, or remap pub_id when the real blocker is missing Legacy closed-trade source proof.
3. If `ready_for_mapper` is displayed as `imports ready`, admins may overstate completion. Copy must say source proof accepted but mapper/importer tests are still required.
4. If `/admin/bots` and selected-user drilldowns use different labels for the same blocker, operators will see inconsistent guidance between fleet and user support views.
5. The current source-proof status is product/source-level, not a user-controlled setting. The UI should make that distinction explicit.

## Verification/tests
RUN:
1. Static inspection only via `rg` and `Get-Content` on the files listed above.
2. Checked current git state with `git status --short --branch`; the tree was already heavily dirty before this audit.
3. Confirmed no env/secret files were read, no server was started, no DB command was run, no live service was called, and no bot-control action was invoked.

NOT RUN:
1. `npm run typecheck` - not run; this was a read-only UX/product audit.
2. Vitest - not run; this was a read-only UX/product audit.
3. Playwright - not run; this was a read-only UX/product audit.
4. `npm run accept:worker:continuity:managed` - not run; outside scope and requires managed throwaway DB env.
5. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; outside scope and requires managed throwaway DB env.
6. Live Legacy DB/provider/exchange probes - not run by safety protocol.
7. Live exchange ping or live bot start/stop/apply-config - not run and not permitted in this scope.
8. Production deploy, canary switch, GitHub CI, and monitoring - outside scope.

## Next actions
1. Implement a DTO-safe admin loader projection for Legacy closed-trade source proof, reusing the user-side sanitizer shape and keeping raw JSON out of React props.
2. Add the selected-user Legacy `Source proof` row after `Closed-trade history` in `adminStatisticsCoverageRows()` and adjust the existing Legacy metric subcopy from generic pending text to `source proof blocked` when appropriate.
3. Extend focused static tests so they require the new admin selected-user source-proof status while still forbidding raw JSON pass-through, secrets, forms, start/stop/apply controls, and live provider/exchange probes.
4. If rendered proof is requested in a later phase, run the selected-user DB matrix only with the approved managed throwaway DB env, not a production URL.
