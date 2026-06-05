# bot-admin-drilldown-ux-auditor handoff
## Scope
Read-only Phase 3.98 UX/product audit for the next WTC bot admin drilldown slice.

Goal audited: admin should choose a user or Legacy pub_id and immediately see settings source, stats, warnings, and runtime scope, while not being able to edit user settings. User bot pages must remain self-scoped.

No product code, tests, live services, provider DB, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, or preview server was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
8. `apps/web/src/app/admin/users/page.tsx`
9. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
10. `apps/web/src/app/admin/bots/page.tsx`
11. `apps/web/src/app/admin/bots/config/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
14. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
15. `apps/web/src/features/admin/queries.ts`
16. `apps/web/src/features/admin/types.ts`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `apps/web/src/features/admin/bot-health-loader.ts`
19. `apps/web/src/features/bots/data.tsx`
20. `apps/web/src/features/bots/readiness-loader.ts`
21. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
22. `tests/integration/admin-user-bot-detail-static.test.ts`
23. `tests/integration/admin-user-bot-detail-loader.test.ts`
24. `tests/integration/admin-bot-health-loader.test.ts`
25. `tests/integration/admin-responsive.test.ts`
26. `tests/integration/admin-global-bot-config-static.test.ts`
27. `tests/integration/bot-read-safety-static.test.ts`
28. `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
1. `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md`

## Findings
1. Severity: High. The selected-user admin drilldown already has the required facts, but not as an immediate top-of-page drilldown summary. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:81` introduces the page, lines `93-96` show read-only safety pills, lines `128-294` begin long per-bot cards and operation maps, lines `177-218` render warnings, and lines `314-337` render latest stats. Recommendation: add a compact `Bot drilldown overview` card immediately after the `User` card and before the per-bot grid, using existing `detail.bots` fields. Target part: admin selected-user first viewport.
2. Severity: High. The admin pub_id entry point exists, but the row action copy is generic and does not deep-link to the relevant selected-user bot section. Evidence: `apps/web/src/app/admin/bots/page.tsx:33-45` renders mapped user identity plus an `Open details` link, and lines `360-388` render the Legacy pub_id inspector rows. Recommendation: change that link copy to `Open user drilldown` and point mapped Legacy rows to `/admin/users/${mappedUser.userId}/bots#bot-legacy_bot`; add matching per-bot anchors in the selected-user page. Target part: admin pub_id-to-user path.
3. Severity: High. The loader already exposes enough safe DTO data for the overview without backend/schema work. Evidence: `apps/web/src/features/admin/types.ts:146-166` defines `AdminUserBotSummary` with config summary, provider account, latest metric, positions, trades, equity, stats scope, and warning summary; `apps/web/src/features/admin/user-bot-detail-loader.ts:1009-1044` builds those fields; lines `706-768` scope Legacy rows by active provider account. Recommendation: keep the next implementation presentation-only; do not add repository methods, migrations, provider calls, live reads, or action handlers. Target part: smallest high-value implementation slice.
4. Severity: Medium. The current read-only boundary is strong and should be preserved by tests after the overview is added. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:93-96` labels live control, user settings, and provider mappings as disabled/read-only; `tests/integration/admin-user-bot-detail-static.test.ts:104-112` forbids submit forms and live-control strings; `tests/e2e/admin-user-bot-detail-db.spec.ts:126-128` verifies no forms, CSRF hidden inputs, or start/stop/apply/test buttons render. Recommendation: extend those tests to cover the new overview, link copy, anchors, and the same no-edit/no-secret constraints. Target part: guardrails.
5. Severity: Medium. User bot pages remain self-scoped through current-user access and snapshot loaders; the admin slice should not import admin DTOs into user pages. Evidence: `apps/web/src/features/bots/data.tsx:28-35` resolves bot pages through `requireUser` and `botAccessForUser`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:101-119` loads only the current user's bot read model and config; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:224-236` loads stats for the current user; `apps/web/src/features/bots/data.tsx:433-483` scopes production DB snapshots by user bot instance and Legacy provider mapping. Recommendation: keep implementation confined to admin pages/components and tests unless a user-page regression test needs copy adjustment. Target part: user self-scope boundary.
6. Severity: Low. `/admin/users` sends admins into the correct read-only page, but the action label undersells the new drilldown workflow. Evidence: `apps/web/src/app/admin/users/page.tsx:47-59` says bot details are read-only, and lines `115-119` render a `Bot details` link. Recommendation: rename the action to `Bot drilldown` so user selection and pub_id selection use the same mental model. Target part: admin navigation copy.

## Decisions
1. Recommended next slice: a small presentation-only admin drilldown overview, not a data-model or adapter slice.
2. Preferred new component: `apps/web/src/features/admin/AdminUserBotDrilldownOverview.tsx`, accepting `AdminUserBotSummary[]` and rendering no forms.
3. Placement on `/admin/users/[userId]/bots`: after the `User` card and before the current per-bot grid.
4. Exact overview title: `Bot drilldown overview`.
5. Exact overview banner copy: title `Selected-user read-only drilldown`; detail `Inspect settings source, runtime scope, warnings, and latest stats for this user. This page does not edit user settings, provider mappings, exchange keys, live bot config, or open positions.`
6. Exact table columns: `Bot`, `Access`, `Settings source`, `Runtime scope`, `Warnings`, `Latest stats`, `Drilldown`.
7. Exact runtime-scope row copy rules:
   - Tortila: `user instance snapshots`
   - Legacy with mapping: `Legacy pub_id ${bot.providerAccount.providerAccountId}`
   - Legacy without mapping: `Legacy pub_id pending`
8. Exact warning copy rules:
   - With warnings: `${count} notice(s) - max ${maxSeverity}`
   - Without warnings: `none reported - not an all-clear`
9. Exact stats copy rules:
   - With metric: `${walletEquityUsd ?? "-"} wallet / ${positions.length} positions / ${trades.length} trades / ${equityCurve.length} equity points`
   - Without metric: `no user-scoped snapshot`
10. Exact drilldown link copy: `Jump to bot card`.
11. Exact pub_id fleet link copy on `/admin/bots`: change `Open details` to `Open user drilldown`.
12. Do not add user-setting edit, provider-mapping edit, global-default edit, start, stop, apply, retest, exchange ping, secret reveal, or live probe controls in this slice.

## Risks
1. The full user goal remains open: this slice improves admin comprehension and navigation, but does not implement live bot control, provider mutation, or adapter acceptance.
2. The current worktree is heavily dirty before this handoff; future implementers must avoid reverting unrelated existing changes.
3. A top overview can become noisy if it repeats every detailed section. Keep it one row per bot and link down to details.
4. If the `#bot-legacy_bot` anchor is added only to the card title and not a stable wrapper, the `/admin/bots` pub_id deep link may land imprecisely after layout shifts.
5. DB-backed rendered admin proof is still opt-in through the existing admin-user-bots e2e harness; do not claim populated browser acceptance without running it.

## Verification/tests
RUN:
1. Required protocol and status docs read first.
2. Current admin user directory, selected-user bot detail, admin fleet bots, admin bot defaults, user bot dashboard, user settings, user statistics, admin queries, admin loaders, admin DTO types, and related tests inspected read-only.
3. `git rev-parse --show-toplevel` - PASS, root is `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short` - observed a large pre-existing dirty tree before this handoff; no product code was edited by this audit.
5. `Test-Path docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md` before writing - returned `False`.
6. `git status --short -- docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md` after writing - shows only this untracked handoff path.
7. `Select-String -LiteralPath docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md -Pattern '[ \t]+$'` - no trailing whitespace matches.
8. ASCII check for `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md` - PASS, no non-ASCII characters.
9. `Test-Path docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md` after writing - returned `True`.

NOT RUN:
1. `npm test`, focused Vitest, typecheck, lint, build, Playwright, preview, browser screenshot, secret scan, governance check - not run because this phase is a read-only UX/product audit plus one handoff.
2. DB-backed populated admin rendered gate `npm run e2e:admin-user-bots:db:managed` - not run; no DB/env gate was requested or touched.
3. Live services, provider DB, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest - not run by scope and safety policy.

## Next actions
1. Start the implementation as a new phase/session per protocol.
2. Implement only the smallest high-value slice:
   - Add `AdminUserBotDrilldownOverview`.
   - Render it on `/admin/users/[userId]/bots` immediately after the `User` card.
   - Add stable anchors to per-bot cards.
   - Rename `/admin/bots` mapped-user link to `Open user drilldown` and deep-link mapped Legacy pub_id rows to the selected user's Legacy card.
   - Rename `/admin/users` action copy from `Bot details` to `Bot drilldown`.
3. Add/extend static tests in `tests/integration/admin-user-bot-detail-static.test.ts` and `tests/integration/admin-responsive.test.ts`.
4. Extend `tests/e2e/admin-user-bot-detail-db.spec.ts` to assert the overview, masked pub_id, no edit controls, no secrets, and no horizontal scroll.
5. Do not change loaders, DB schema, repositories, provider adapters, user bot self-scoped pages, or live-control surfaces unless a test exposes a direct regression.
