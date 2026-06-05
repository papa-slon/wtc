# ecosystem-ux-ui-designer product auditor handoff
## Scope
Read-only Phase 4.41 UX/product audit for the next local, no-env bot settings/setup/statistics/admin clarity gap.

Objective checked: bot pages should be extremely clear for users configuring Legacy averaging and Tortila; admins should be able to see everyone while not editing user settings. Phase 4.40 local bot/admin acceptance is green; managed/source/live gates are unavailable and were not run.

## Files inspected
- `docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`

## Files changed
None - read-only audit except this handoff:
- `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md`

## Findings
1. Severity P2 - The next highest-impact no-env clarity gap is the admin entry-point action labels: `/admin/users` and `/admin/bots` already expose everyone-oriented bot discovery, but their clickable actions still read as generic drilldowns instead of read-only inspection. Evidence: `apps/web/src/app/admin/users/page.tsx:54` builds selector rows for every user, `apps/web/src/app/admin/users/page.tsx:66` labels the user row action `Open bot drilldown`, `apps/web/src/app/admin/users/page.tsx:82` labels Tortila rows `Open Tortila drilldown`, `apps/web/src/app/admin/users/page.tsx:103` labels mapped Legacy rows `Open Legacy drilldown`, and `apps/web/src/app/admin/users/page.tsx:239` renders that action as the button text. The surrounding warning says results are read-only at `apps/web/src/app/admin/users/page.tsx:200` and `apps/web/src/app/admin/users/page.tsx:202`, but the primary click target does not carry that boundary. Recommendation: rename action labels to `Open read-only bot view`, `Open read-only Tortila view`, and `Open read-only Legacy view`; keep unmapped Legacy as `Open fleet diagnostics`. Target part: admin user directory bot owner selector.

2. Severity P2 - The same copy gap exists on the fleet owner drilldown: the card is correctly read-only, but the mapped-user action says `Open user drilldown`. Evidence: `apps/web/src/app/admin/bots/page.tsx:124` starts `ownerDetailAction`, `apps/web/src/app/admin/bots/page.tsx:135` renders `Open user drilldown`, while the card title/detail at `apps/web/src/app/admin/bots/page.tsx:442` and `apps/web/src/app/admin/bots/page.tsx:446` explain that the explorer is read-only and does not edit user settings, mappings, keys, or live state. Recommendation: change the action to `Open read-only user view` or `Open read-only user drilldown`, and update static/local rendered assertions so the button copy itself preserves the boundary. Target part: admin bot fleet owner drilldown.

3. Severity P3 - The selected-user admin page itself is already strong; do not spend the next local slice adding duplicate panels there unless the entry-point label gap is closed first. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:479` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:493` renders read-only page copy plus `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:462` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:465` states admin start/apply/stop are disabled and no user settings are edited. The opt-in DB E2E also asserts no forms, CSRF fields, or start/stop/apply/test buttons at `tests/e2e/admin-user-bot-detail-db.spec.ts:274` to `tests/e2e/admin-user-bot-detail-db.spec.ts:276`. Recommendation: keep selected-user page behavior unchanged; optionally extend the local no-env rendered pack to assert the same read-only pills on `/admin/users/demo-user/bots`. Target part: selected-user admin drilldown and local rendered coverage.

4. Severity P3 - User-facing Legacy/Tortila settings and setup clarity appears covered enough for this phase; the next local gap should stay in admin entry-point copy, not the dense user config tables. Evidence: settings renders the basic path and readiness map at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:321`; Legacy export is blocked without exactly one mapped pub_id at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:549` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:570`; saving is explicitly a user-owned version at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:660` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:663`; setup blocks live-control semantics at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:326` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:344`. Rendered coverage asserts the same Legacy/Tortila copy and no live-control markers in `tests/e2e/bot-settings.spec.ts:80` to `tests/e2e/bot-settings.spec.ts:235`. Recommendation: avoid refactoring these tables in Phase 4.41 unless the action-label fix exposes a specific regression. Target part: user settings/setup surfaces.

## Decisions
- Highest-impact local UI clarity recommendation: make admin owner/drilldown action labels explicitly read-only.
- Keep the implementation no-env: copy-only UI changes plus static/E2E assertions; no DB-managed matrix, live provider probes, source/importer work, browser review, or long gates are needed for the next local slice.
- Do not add admin edit controls to selected-user bot drilldowns.
- Do not weaken existing admin global defaults: `/admin/bots/config` may edit system defaults, but selected-user views should remain read-only and clearly labeled as such.

## Risks
- The worktree was already heavily dirty before this audit; this handoff did not classify or reconcile unrelated changes.
- The recommended copy change is small, but tests currently assert old labels such as `Open user drilldown`; update those tests with the UI copy.
- Managed selected-user DB browser proof remains unavailable without `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; do not claim it from local copy/spec changes.
- Live/source gates remain unavailable; this audit does not prove live provider behavior, closed-trade imports, worker continuity in managed DB, deploy, CI, or production state.

## Verification/tests
RUN:
- `git status --short --branch` - inspected branch/dirty state only.
- Read-only `rg` and `Get-Content` inspections of bot settings/setup/statistics/admin UI and E2E/static specs.
- Existing Phase 4.40 handoff reviewed; it records `npm run accept:bots:local` green as local mock/no-live proof.

NOT RUN:
- Browser/manual visual review - skipped per instruction.
- `npm run accept:bots:local` - not rerun; Phase 4.40 already records it green and this audit made no product code changes.
- `npm run accept:bots:rendered`, Playwright, Vitest, typecheck, lint, build, secret scan, governance - not run; read-only audit only.
- `npm run accept:worker:continuity:managed` - not run; managed env unavailable.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; managed admin DB env unavailable.
- Legacy closed-trade source/importer gates, live exchange ping, provider probes, live bot start/stop/apply-config, DB migrate/seed, deploy, SSH/systemd/tmux, GitHub CI, and production monitoring - not run and out of scope.

## Next actions
1. Implement the local copy-only label pass:
   - `/admin/users`: `Open read-only bot view`, `Open read-only Tortila view`, `Open read-only Legacy view`; keep unmapped Legacy as `Open fleet diagnostics`.
   - `/admin/bots`: `Open read-only user view` or `Open read-only user drilldown`.
2. Update local assertions:
   - `tests/e2e/smoke.spec.ts` should assert the read-only action label on `/admin/users`.
   - `tests/e2e/admin-mobile-pg8.spec.ts` should assert the read-only fleet owner copy/action on `/admin/bots` without running managed DB.
   - `tests/integration/admin-user-bot-detail-static.test.ts` and `tests/integration/bot-read-safety-static.test.ts` should replace old generic drilldown label expectations.
3. Run the short local proof for that slice only: focused static tests plus the targeted rendered pack or `npm run accept:bots:rendered` if the operator wants screenshot inventory refreshed.
