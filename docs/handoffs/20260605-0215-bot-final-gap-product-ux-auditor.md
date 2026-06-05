# bot-final-gap-product-ux-auditor handoff
## Scope
Read-only Phase 4.44 product/UX next-gap audit after Phase 4.43. The goal was to identify the highest-value no-env UI/product slice that still moves the original objective toward "two bots finished end-to-end" without requiring `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, live provider URLs/tokens, deploy, or live bot control.

Verdict: the best next no-env slice is a user-facing **two-bot finish board on `/app/bots`**. Settings, setup, statistics, continuity, admin read-only separation, and no-live-control copy are already deep on their dedicated pages, but the main user bot room still behaves like a directory plus combined metrics instead of a clear completion checklist for Legacy and Tortila.
## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
## Files changed
- `docs/handoffs/20260605-0215-bot-final-gap-product-ux-auditor.md`
## Findings
1. Severity P2 - The user bot overview does not yet show a two-bot completion path. Evidence: `apps/web/src/app/(app)/app/bots/page.tsx:21` loads only metrics/warnings, `apps/web/src/app/(app)/app/bots/page.tsx:42` exposes one top-level statistics link hard-coded to Tortila, and `apps/web/src/app/(app)/app/bots/page.tsx:122`-`125` gives each bot only `Open dashboard` / `View status`. Recommendation: add a first-screen "Two-bot finish board" on `/app/bots` with per-bot settings, setup, continuity, statistics, and live-boundary rows plus direct CTAs for Legacy averaging settings, Tortila settings, both statistics views, and dashboards. Target part: user bot landing page.
2. Severity P2 - Completion signals exist on deeper pages but are not summarized where users choose between the two bots. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:170`-`187` renders readiness and continuity on a bot dashboard; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300`-`333` renders the basic settings path and settings continuity monitor; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:401`-`471` renders statistics continuity and command-center facts. Recommendation: reuse the same no-live read model/config/readiness facts on `/app/bots` so the first page answers "what remains for each bot?" without making users open four screens. Target part: settings/statistics/dashboard clarity.
3. Severity P2 - The strongest easy-settings work is already present, so the next value is discoverability, not another deep settings table. Evidence: `apps/web/src/features/bots/BotSettingsQuickPath.tsx:199`-`218` already provides a basic settings path with editor/export/statistics actions; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:619`-`636` renders the Tortila and Legacy configuration tables; `tests/e2e/bot-settings.spec.ts:168`-`235` already proves Legacy averaging/stage/export behavior in rendered UI. Recommendation: make `/app/bots` point directly to those existing flows with product-specific labels (`Configure Legacy averaging`, `Review Tortila Turtle settings`) rather than expanding the settings forms again. Target part: easy Legacy/Tortila settings access.
4. Severity P2 - Continuity and silent-stop/no-live proof are strong on detail surfaces but absent from the user overview. Evidence: `apps/web/src/features/bots/BotContinuityPanel.tsx:95`-`97` states continuity proof is read-only and is not a start button or exchange test; `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:49`-`52` makes the worker heartbeat a statistics precheck; `apps/web/src/app/(app)/app/bots/page.tsx:131`-`133` only has a footer sentence about stop/live controls. Recommendation: include a compact per-bot "continuity proof" row on `/app/bots` that shows worker/runtime status labels from existing readiness data, explicitly says no worker tick/provider probe is run during render, and keeps live start/stop/apply absent. Target part: continuity/silent-stop proof and no-live-control boundary.
5. Severity P3 - Current tests do not guard the proposed user-overview finish path. Evidence: `tests/e2e/smoke.spec.ts:103`-`109` checks only combined portfolio and Legacy limited-data copy on `/app/bots`; `tests/integration/bot-read-safety-static.test.ts:80`-`83` checks only entitlement-safe adapter loading for the bot list. Recommendation: add static and rendered assertions for the new `/app/bots` finish board, per-bot settings/statistics CTAs, live-control absence, and no secret/provider/live strings. Target part: acceptance coverage.
6. Severity P3 - The current operator next-actions list points mostly to env/source/live/deploy gates, so the no-env product gap is not captured as an operator-ready next slice. Evidence: `docs/NEXT_ACTIONS.md:43`-`57` lists env-managed continuity, selected-user DB matrix, Legacy source proof, live-control approval, and deploy/CI path, but not a no-env user finish-board slice. Recommendation: if the slice is implemented, update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md` to record it as local UI/product completion proof rather than as a live-read or env gate. Target part: continuity of handoffs/docs.
## Decisions
- Recommend one bounded no-env implementation slice: **Phase 4.44 user two-bot finish board**.
- Exact implementation files: `apps/web/src/app/(app)/app/bots/page.tsx`; optionally a small presentational `apps/web/src/features/bots/BotFleetFinishPanel.tsx` only if keeping the page readable requires extraction; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`; aggregate/per-agent handoffs for that phase.
- Exact tests: extend `tests/integration/bot-read-safety-static.test.ts` to assert the bot list uses safe config/readiness/read-model inputs and contains no live-control/provider-probe paths; extend `tests/e2e/smoke.spec.ts` or add a focused `tests/e2e/bot-finish-board.spec.ts` to assert the `/app/bots` board renders both bots, `Configure Legacy averaging`, `Review Tortila Turtle settings`, `Open Legacy statistics`, `Open Tortila statistics`, continuity/no-live copy, and no enabled start/stop/apply/connection-verified controls.
- Keep the slice local/mock/no-live only. Do not run or require managed DB, provider URLs, live exchange ping, live provider probes, deploy, or live bot control.
## Risks
- The worktree was already heavily dirty before this audit; unrelated modified and untracked files must be preserved.
- Adding `loadBotConfig` / `loadBotReadinessForUser` to `/app/bots` increases first-page data loading. Keep it server-side, entitlement-scoped, and no-live; do not call adapters directly or load admin-only selected-user data.
- Avoid importing server-only config helpers into client components if a presentational component is extracted; prior Legacy UI work established that client components should use type-only imports or already client-safe props.
- This handoff is one named product/UX auditor handoff, not an aggregate phase handoff and not proof that managed/live gates are green.
## Verification/tests
RUN:
1. `git status --short --branch` - observed current branch and pre-existing dirty/untracked work before writing this handoff.
2. `Test-Path docs/handoffs/20260605-0215-bot-final-gap-product-ux-auditor.md` - confirmed the required handoff did not exist before this audit write.
3. Read-only `rg` and `Get-Content` inspections of the focused docs, user bot pages, admin bot pages, bot feature components, and focused tests.

NOT RUN:
1. Product tests, Playwright, typecheck, lint, build, secret scan, and `git diff --check` - skipped because this was a read-only audit with only one handoff write.
2. `npm run accept:bots:local`, `npm run accept:bots:rendered`, and `npm run accept:bots:continuity:contract` - not needed for this audit-only gap selection; latest observed results are documented in `docs/STATUS.md` and `docs/NEXT_ACTIONS.md`.
3. `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied and is out of scope.
4. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied and is out of scope.
5. Live provider/exchange probes, live bot start/stop/apply-config, deploy/canary publish, GitHub CI, SSH/systemd/tmux, production monitoring - not run by safety scope.
## Next actions
1. Launch the next phase as a fresh session with the bounded scope "user two-bot finish board on `/app/bots`".
2. Implement the board using existing safe facts: entitlement state, read-model health/warnings, config source/review, and readiness/continuity labels. Do not introduce live probes, admin selected-user mutation, provider mapping edits, or runtime controls.
3. Prove it locally with static safety coverage and one rendered `/app/bots` browser assertion for desktop/mobile if folded into the existing rendered pack.
4. Update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md` only after the implementation/tests are actually green.
