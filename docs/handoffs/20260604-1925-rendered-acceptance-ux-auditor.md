# rendered-acceptance-ux-auditor handoff
## Scope
Phase 4.32 read-only UX audit of the rendered acceptance surfaces for user bot pages and admin bot/user pages. Focus:
settings, setup, statistics, trades, admin selected-user drilldown, admin bot health, desktop/mobile proof markers, and
honest pending states for Legacy and Tortila completion.

This audit used source, test, script, and prior handoff inspection only. No code was edited. No live services, dev server,
Playwright browser run, database mutation, provider probe, exchange probe, env/secret read, or bot control action was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/WarningSummaryPanel.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `packages/ui/src/theme.css`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `package.json`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`

## Files changed
None - read-only audit except this handoff:
- `docs/handoffs/20260604-1925-rendered-acceptance-ux-auditor.md`

## Findings
1. Severity P1 - The rendered acceptance surface is a route matrix, not one page or one generic smoke. Evidence:
   user dashboard renders `Bot readiness map`, `Launch readiness command center`, `Continuity monitor`, runtime evidence,
   disabled start/stop controls, and read-only copy at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:161`,
   `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:172`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:177`,
   `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:199`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:333`.
   Settings/setup/statistics/trades/admin each add their own markers. Recommendation: final completion proof must browser
   prove the route matrix below on desktop and mobile, with retained screenshots and marker assertions. Target part:
   rendered acceptance.

   Required routes and markers:
   - `/app/bots/tortila`, `/app/bots/legacy`: bot heading, `Bot readiness map`, `Launch readiness command center`,
     `Continuity monitor`, `Runtime evidence ladder`, `Configuration & controls`, `Start bot (disabled)`,
     `Stop bot (disabled)`, `live start disabled`, `no exchange ping`.
   - `/app/bots/tortila/settings`, `/app/bots/legacy/settings`: `Configuration`, `Bot setup control center`,
     `Basic settings path`, `Settings readiness map`, `Settings continuity monitor`, `How this bot will operate`,
     `Export current reference config`, plus Tortila `Private exchange connection` and Legacy
     `Legacy export needs exactly one mapped pub_id`.
   - `/app/bots/tortila/setup?step=key`, `/app/bots/tortila/setup?step=strategy`,
     `/app/bots/tortila/setup?step=review`, `/app/bots/legacy/setup`: `Guided onboarding`,
     `Setup continuity monitor`, `Setup operation map`, strategy review panels, Legacy
     `Exchange-key step is not used for Legacy`, and review-step pending states.
   - `/app/bots/statistics?bot=tortila`, `/app/bots/statistics?bot=legacy`: `Trading bot performance`,
     `Portfolio snapshot`, `Statistics continuity monitor`, `Statistics operation map`, `Statistics evidence ladder`,
     `Statistics command center`, plus Legacy `Legacy operations`, `Legacy statistics cockpit`, and closed-trade
     pending copy.
   - `/app/bots/tortila/trades`, `/app/bots/legacy/trades`: `Closed trades`, `Closed trade history`, Tortila
     `Net PnL (after fees)`, and Legacy `No closed-trade history available`.
   - `/admin/bots`: `Bot fleet`, `LIVE CONTROL: DISABLED`, `Runtime safety summary`, `Worker bot continuity`,
     `Admin fleet evidence ladder`, `Bot owner drilldown`, `Canonical warning summary`, `Tortila journal health`,
     `Tortila user-scoped snapshots`, `Legacy bot live-read status`, `Legacy pub_id inspector`,
     `Integration health checks`.
   - `/admin/bots/config`: `System bot defaults`, `Default ownership model`, per-bot system default cards,
     `Effective system default review`, `LIVE CONTROL: DISABLED`, `user settings unaffected`.
   - `/admin/users`: `User directory`, `Bot owner selector`, `Selected-user inspection only`, `Global defaults`,
     `Fleet diagnostics`, search placeholder `email, name, user id, masked pub_id`.
   - `/admin/users/<preparedUserId>/bots`: user-specific bot heading, `Selected-user statistics command center`,
     `LIVE CONTROL: DISABLED`, `user settings: read-only`, `provider mappings: read-only`,
     `Selected-user read-only drilldown`, `Admin launch readiness mirror`, `Selected-user evidence ladder`,
     `System provider mappings`, `Saved exchange keys`, and pending-state branches.

2. Severity P1 - Legacy performance completion must preserve pending closed-trade states until a real source-backed
   importer exists. Evidence: Phase 4.31 explicitly says the local Legacy source does not prove a durable closed-trade/fill
   model and `Do not derive performance statistics from inactive orders or slots`
   (`docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`). Current UI keeps Legacy pending:
   `apps/web/src/features/bots/statistics-panels.tsx:587` uses `Closed-trade history`,
   `apps/web/src/features/bots/statistics-panels.tsx:588` uses `pending import`,
   `apps/web/src/features/bots/statistics-panels.tsx:608` uses `Legacy closed-trade history pending`, and selected-user
   admin keeps `pending import` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:818`. Recommendation: rendered
   proof must assert the pending labels for Legacy statistics, Legacy trades, and selected-user admin until imported
   provider-scoped trades exist; do not accept green Legacy PF/win-rate/realized-PnL copy from slots/orders. Target part:
   Legacy statistics/trades acceptance.

3. Severity P2 - The user trades table has a mobile overflow/accessibility risk because it is an eight-column raw
   `.wtc-table` without `.wtc-table-wrap` or `data-label` cells. Evidence:
   `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:60` renders the raw table, and
   `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:63` defines eight columns. The responsive table contract says
   tables must be wrapped and cells must carry labels at `packages/ui/src/theme.css:114` through
   `packages/ui/src/theme.css:118`; the mobile transform is scoped to `.wtc-table-wrap` at
   `packages/ui/src/theme.css:121` through `packages/ui/src/theme.css:127`. Recommendation: either wrap and label this
   table or require browser proof that `/app/bots/tortila/trades` with non-empty trades has no horizontal page scroll at
   375px; also prove `/app/bots/legacy/trades` shows the honest no-history state. Target part: user trades mobile/desktop.

4. Severity P2 - Settings `Version history` and `Safety events` have the same raw-table mobile risk in non-empty states.
   Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:671` and
   `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:690` render raw `.wtc-table` elements without the responsive
   wrapper; the CSS contract requires `.wtc-table-wrap` and `data-label` cells at `packages/ui/src/theme.css:114` through
   `packages/ui/src/theme.css:118`. Existing settings e2e proves no horizontal scroll for the current fixture path at
   `tests/e2e/bot-settings.spec.ts:161` and `tests/e2e/bot-settings.spec.ts:234`, but that can miss non-empty version or
   safety rows. Recommendation: add non-empty version/safety fixture coverage or wrap/label those tables before final
   rendered acceptance. Target part: settings mobile proof.

5. Severity P2 - Admin selected-user proof must use the DB-backed prepared route, not only the generic demo route.
   Evidence: generic mobile coverage includes `/admin/users/demo-user/bots` at `tests/e2e/admin-mobile-pg8.spec.ts:23`,
   while the stronger DB-backed harness navigates to `/admin/users/${marker.userAId}/bots` and asserts selected-user
   runtime/settings/statistics boundaries at `tests/e2e/admin-user-bot-detail-db.spec.ts:217` through
   `tests/e2e/admin-user-bot-detail-db.spec.ts:278`. Recommendation: final acceptance should run/cite
   `npm run e2e:admin-user-bots:db:managed:matrix` or equivalent prepared-user proof, with desktop and mobile screenshots.
   Target part: admin selected-user completion.

6. Severity P2 - Admin bot health has many required markers beyond the current generic admin mobile smoke assertions.
   Evidence: `/admin/bots` source renders `Runtime safety summary`, `Worker bot continuity`, `Admin fleet evidence ladder`,
   `Bot owner drilldown`, `Legacy bot live-read status`, and `Legacy pub_id inspector` at
   `apps/web/src/app/admin/bots/page.tsx:366`, `apps/web/src/app/admin/bots/page.tsx:395`,
   `apps/web/src/app/admin/bots/page.tsx:435`, `apps/web/src/app/admin/bots/page.tsx:442`,
   `apps/web/src/app/admin/bots/page.tsx:683`, and `apps/web/src/app/admin/bots/page.tsx:696`. The generic mobile spec
   only adds focused `/admin/bots` assertions for `Worker bot continuity`, `Admin fleet evidence ladder`, and
   `Read-only admin evidence` at `tests/e2e/admin-mobile-pg8.spec.ts:52` through
   `tests/e2e/admin-mobile-pg8.spec.ts:55`. Recommendation: add explicit rendered assertions for the admin bot health
   markers and, when DB fixtures exist, mapped/unmapped Legacy owner rows. Target part: admin bot health acceptance.

7. Severity P3 - Source review found the read-only/live-control copy is present and consistent on the inspected surfaces,
   but it still needs fresh browser proof this session before green claims. Evidence: settings/setup/dashboard/admin pages
   repeatedly render `live control disabled`, disabled start/stop/apply boundaries, and no-live-probe copy at
   `apps/web/src/features/bots/BotSetupControlCenter.tsx:257`, `apps/web/src/features/bots/BotSettingsQuickPath.tsx:181`,
   `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:91`, `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:77`,
   `apps/web/src/app/admin/users/[userId]/bots/page.tsx:491`, and `apps/web/src/app/admin/bots/page.tsx:342`.
   Recommendation: acceptance report should list exact gates run and not run; do not label any rendered route green from
   source inspection alone. Target part: gate reporting.

## Decisions
- Treat Phase 4.32 as a rendered-acceptance definition/audit, not an implementation phase.
- No live services were needed for this auditor lane; source/test/script inspection was sufficient to identify exact routes,
  markers, and proof gaps.
- Legacy closed-trade analytics remain pending by design. Current completion should prove that pending state, not hide or
  "solve" it with fabricated performance numbers.
- Admin selected-user acceptance should prefer the prepared DB harness because it can prove user-scoped Tortila and Legacy
  facts, missing/stale/degraded/fresh runtime branches, no edit controls, no secret markers, and no horizontal scroll.
- Browser proof must retain both desktop and mobile screenshots for the route matrix; screenshots alone are insufficient
  unless paired with text/role assertions for the exact markers above.

## Risks
- A completion claim based only on `/app/bots/statistics` or `/admin/bots` can miss setup/settings/export/trades/selected-user
  regressions.
- Raw `.wtc-table` instances can pass current empty/demo fixtures while overflowing once real version, safety, or trade rows
  render.
- Legacy slot/order runtime evidence can be mistaken for closed-trade history; Phase 4.31 explicitly blocks that inference.
- Generic `/admin/users/demo-user/bots` coverage can pass while the real DB selected-user route regresses.
- Running only source/static tests would not prove the actual responsive layout, sticky/mobile nav, wrapping, or long-ID
  behavior on 375px screens.

## Verification/tests
RUN:
- `git status --short --branch` to record current dirty state.
- Read-only source inspection with `Get-Content` and `Select-String` over the listed route, component, CSS, test, script,
  and docs files.
- Existing route/test/marker mapping from source and Playwright specs.
- Prior Phase 4.31 handoff inspection for the Legacy closed-trade pending boundary.

NOT RUN:
- No dev server or live service startup.
- No Playwright/browser execution.
- No Vitest, lint, typecheck, build, secret scan, governance check, or CI.
- No DB migration, DB seed, worker tick, managed DB harness, provider DB read, exchange probe, journal probe, env/secret read,
  SSH, deploy, systemd, tmux, or bot start/stop/apply-config.

Reason skipped: the requested auditor lane was read-only source/test/script inspection, and browser/service execution was
not explicitly needed to identify the acceptance route matrix and risk points.

## Next actions
1. Create or extend a rendered acceptance spec that proves the route matrix in Finding 1 on desktop and mobile, with exact
   text/role assertions plus retained screenshots.
2. Run/cite the DB-backed selected-user harness for admin completion: `npm run e2e:admin-user-bots:db:managed:matrix`.
3. Run/cite default browser coverage for user bot surfaces, including settings/setup/dashboard/statistics/trades/admin pages:
   `npm run e2e` or a narrower explicitly listed Playwright command.
4. Before calling mobile acceptance green, fix or browser-prove the raw-table risks in user trades plus settings version/safety
   non-empty states.
5. Preserve Legacy pending assertions: `pending import`, `Legacy closed-trade history pending`, `No closed-trade history
   available`, and selected-user `No user-scoped metric snapshot`/`not selected-user proof` branches where applicable.
6. Final aggregate should list gates RUN and NOT RUN with reasons, and cite this handoff as the Phase 4.32
   rendered-acceptance UX auditor artifact.
