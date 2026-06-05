# bot-stats-admin-gates-auditor handoff
## Scope
Read-only tests/gates audit for Phase 4.22 around bot statistics pages and admin selected-user bot drilldowns. Goal context: the next implementation should improve premium statistics/admin-read-only clarity without weakening read-only, provider-scope, secret-safety, mobile, or opt-in DB gates.

No background agents were launched per operator instruction. No live bot/provider/exchange calls, DB migrations/seeds, deploy, SSH/tmux, or live-control commands were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `package.json`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`

## Files changed
None - read-only audit, except this required handoff file:
- `docs/handoffs/20260604-1555-bot-stats-admin-gates-auditor.md`

## Findings
1. Severity P1 - Bot statistics lacks a focused rendered acceptance spec, so premium statistics changes can regress layout/source clarity while only broad smoke and warning specs notice a subset. Evidence: `tests/e2e/smoke.spec.ts:116` enters `/app/bots/statistics?bot=tortila` and checks headings through Legacy at `tests/e2e/smoke.spec.ts:130-135`; `tests/e2e/warning-summary-visual.spec.ts:82-86` only checks warning summary behavior on statistics; there is no dedicated `tests/e2e/bot-statistics.spec.ts`. Recommendation: add `tests/e2e/bot-statistics.spec.ts` with desktop and mobile coverage for Tortila and Legacy, asserting `Trading bot performance`, portfolio snapshot, statistics continuity monitor, operation map, evidence ladder, warning summary, no horizontal scroll, no live-control copy/actions, and screenshots. Target part: bot statistics rendered browser gate.
2. Severity P1 - Legacy statistics source identity and runtime snapshot masking are mostly guarded by static presence checks, not by a rendered no-leak fixture. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:250-258` passes safe runtime config arrays into the statistics view; `apps/web/src/features/bots/statistics-panels.tsx:492-563` renders provider accounts, active slots, and active order coverage with shortened pub_id cells; `tests/integration/bot-statistics-static.test.ts:81-92` checks those panels exist but does not assert that raw provider ids, raw runtime payloads, secrets, or live-control markers cannot render. Recommendation: add a focused static or unit-style regression around `LegacyOperationsPanel`/statistics source text, plus rendered E2E hidden-marker checks, using marker values like full provider pub_id, `apiKey`, `apiSecret`, `sealed`, `startBot`, `stopBot`, `applyConfig`, and `Connection verified`. Target part: Legacy statistics operational snapshot clarity and secret/live-control safety.
3. Severity P1 - Admin selected-user DB E2E proves runtime scenarios, but it does not assert the exact premium stats values and source rows that a clarity pass is likely to touch. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:193-205` checks scenario pills, notes, statistic status label counts, evidence ladders, and jump links; `tests/e2e/admin-user-bot-detail-db.spec.ts:208-210` checks only that two `Stats scope` labels and generic `provider account`/`user instance` text exist. Loader-level exact data is strong at `tests/integration/admin-user-bot-detail-loader.test.ts:469-550`, but browser coverage does not pin the rendered overview values from `apps/web/src/app/admin/users/[userId]/bots/page.tsx:91-99` and detail cards at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:494-517`. Recommendation: extend `tests/e2e/admin-user-bot-detail-db.spec.ts` to assert exact rendered strings for `1234.5600 wallet / 1 positions / 1 trades / 2 equity points`, `2222.2200 wallet / 1 positions / 1 trades / 1 equity points`, metric source labels, position/trade/equity table markers, and both stats scopes. Target part: admin selected-user bot drilldown browser acceptance.
4. Severity P2 - The real DB-backed selected-user admin route has mobile project coverage at 390px, while the strict PG8 375px check uses the demo route and shallow assertions. Evidence: `playwright.admin-user-bots-db.config.ts:52-54` defines desktop plus 390x844 mobile for the DB harness; `tests/e2e/admin-mobile-pg8.spec.ts:20-35` includes `/admin/users/demo-user/bots`; `tests/e2e/admin-mobile-pg8.spec.ts:42-65` checks heading, mobile nav, storage pill, no h-scroll, and screenshot only. Recommendation: in `tests/e2e/admin-user-bot-detail-db.spec.ts`, set mobile viewport to 375x812 inside the mobile project before the selected-user page assertions, or add a second DB-backed 375px test. Keep the existing `admin-mobile-pg8.spec.ts` for global shell coverage. Target part: admin selected-user mobile readability gate.
5. Severity P2 - The admin DB matrix is opt-in and correctly excluded from default gates, so Phase 4.22 must name it explicitly when admin drilldown copy/statistics change. Evidence: `package.json:34-36` exposes `e2e:admin-user-bots:db`, `e2e:admin-user-bots:db:managed`, and `e2e:admin-user-bots:db:managed:matrix`; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-33` asserts it is excluded from default `e2e`/`ci:local`; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:17-24` documents the throwaway DB runner; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:148-150` expands `--matrix` to all scenarios. Recommendation: if Phase 4.22 touches admin selected-user drilldown, run and report the managed matrix when a local/admin Postgres URL is available; otherwise list it as NOT RUN with missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`. Target part: main-thread verification discipline.

## Decisions
- Keep the next Phase 4.22 test work focused on rendered acceptance and hidden-marker regression, not broad gate redesign.
- Do not add live bot/provider/exchange checks for statistics or admin pages; these surfaces remain read-only and DB/snapshot-backed.
- Treat the admin selected-user DB matrix as a required opt-in acceptance gate only when admin drilldown loader/page behavior changes or when a local throwaway Postgres admin URL is available.
- Keep PG8 global admin mobile coverage, but add DB-backed selected-user mobile proof where the real dense rows render.

## Risks
- The repository was already heavily dirty before this audit; this handoff does not classify unrelated worktree changes.
- No tests were executed in this read-only auditor turn; recommendations are based on source/test inspection only.
- The focused DB E2E matrix requires a local/admin Postgres URL that can create/drop throwaway `wtc_test_admin_user_bots_*` databases. Without that env, the matrix must be honestly reported as NOT RUN.
- Adding screenshots or visual artifacts in the next phase should be paired with `npm run evidence:visual -- --inventory` and reviewed retained screenshots, otherwise visual proof can become stale or unreviewed.

## Verification/tests
RUN in this auditor turn:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty pre-existing worktree.
- Read-only source inspection with `Get-Content` and `rg` over the requested protocol, tests, gate scripts, and relevant app/source files.

NOT RUN in this auditor turn:
- `npx vitest run ...` - not run; auditor scope requested inspection and one handoff only.
- Playwright/browser specs - not run; they would write screenshots/artifacts and are for the next implementation verification.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires explicit throwaway Postgres admin URL and is not read-only.
- `npm run typecheck -w @wtc/web`, `npm run lint`, `node scripts/gates.mjs quick`, `npm run secret:scan`, `npm run governance:check`, `npm run evidence:visual -- --inventory`, `git diff --check` - not run; list below as recommended main-thread gates.
- DB migrations/seeds, deploy, SSH/tmux, live bot start/stop/apply-config, live exchange/provider calls - not run by safety policy and out of scope.

Recommended Phase 4.22 focused commands after implementing tests/clarity changes:
- `npx vitest run tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-responsive.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `npx playwright test tests/e2e/bot-statistics.spec.ts`
- `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench renders safe coin configuration"`
- If admin selected-user drilldown code/copy changes and throwaway Postgres admin URL is available in PowerShell: `$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL='postgres://<user>:<password>@<host>:<port>/postgres'; npm run e2e:admin-user-bots:db:managed:matrix`
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `node scripts/gates.mjs quick`
- `npm run secret:scan`
- `npm run governance:check`
- `npm run evidence:visual -- --inventory`
- `git diff --check`

Recommended NOT RUN unless scope explicitly expands:
- `npm run db:migrate`, `npm run db:seed`, `npm run db:generate` - no schema/generation work expected for a statistics/admin-read-only clarity phase.
- `npm run accept:worker:continuity` - only needed if worker snapshot/runtime continuity code changes.
- `npm run build -w @wtc/web`, `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `npm run ci:local` - optional broader gates if Phase 4.22 grows beyond focused UI/tests.
- Live bot/provider/exchange calls, live start/stop/apply-config, SSH/tmux/deploy - forbidden for this slice unless a separate audited live-control/deploy phase authorizes them.

## Next actions
1. Add a dedicated `tests/e2e/bot-statistics.spec.ts` covering Tortila and Legacy statistics on desktop/mobile, with no-h-scroll, no live-control markers, no secret/raw provider markers, continuity/evidence/operation-map assertions, and retained screenshots.
2. Extend `tests/integration/bot-statistics-static.test.ts` or add a small focused test to pin Legacy provider identity masking and absence of raw runtime/secrets/live-control strings in statistics source/panels.
3. Extend `tests/e2e/admin-user-bot-detail-db.spec.ts` to assert exact selected-user rendered stat summaries, source markers, table rows, no leaks, and 375px mobile readability for the DB-backed route.
4. For the main Phase 4.22 final report, list exact gates RUN and NOT RUN, and do not claim the opt-in admin DB matrix green unless `npm run e2e:admin-user-bots:db:managed:matrix` actually ran green in that session.
