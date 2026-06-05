# bot-statistics-ux-product-auditor handoff
## Scope
Phase 4.28 read-only bot statistics UX/product audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected:
- `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md`
- User bot statistics page and components
- `BotStatisticsCommandCenter`
- `statistics-panels`
- Tortila and Legacy statistics data sources
- Admin fleet bot statistics page
- Admin selected-user bot statistics page
- The user's objective: simple defaults/custom settings, coin/stage RSI/CCI slots, exchange key readiness, Bloomberg/BlackRock-quality statistics, admin read-only user drilldown, and bot continuity proof.

This is one per-agent read-only audit handoff. I did not claim or launch additional background agents for this single auditor lane, and I did not edit code outside this required handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `package.json`

## Files changed
None - read-only audit.

## Findings
1. Severity P1 - Highest-value local patch: add a shared "statistics completion cockpit" that grades what is evidence-grade today versus what is performance-history pending, then mount it on user statistics, admin fleet, and selected-user drilldown. Evidence: the prior product audit names "Bloomberg/BlackRock-quality statistics" as an explicit user objective at `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md:5`-`11`; the user stats page already loads user-scoped metrics, positions, trades, equity, config, and warnings at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:228`-`245`; Tortila already renders institutional-style financial metrics such as win rate, PF, drawdown, Sharpe, Sortino, Calmar, recovery, trades/week, and best/worst day at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:435`-`452`; Legacy currently renders wallet, configured symbols, active slots, and active orders at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:425`-`430`; the Legacy worker intentionally writes wallet/liveConfig but leaves closed PnL, win rate, PF, drawdown, and tradeCount unsupported at `apps/worker/src/legacy-live.ts:416`-`432`; the schema already has metric snapshots and immutable closed-trade imports at `packages/db/src/schema.ts:507`-`527` and `packages/db/src/schema.ts:564`-`590`. Recommendation: implement a local pure helper plus UI panel, for example `buildBotStatisticsCompletion()`, that emits the same completion rows for user/admin surfaces without live provider access. Concrete UI needed: cards named `Evidence grade`, `Latest source`, `Freshness`, `History state`, `Provider scope`, and `Coverage`; a table named `Statistics coverage matrix` with rows `Wallet balance`, `Open exposure`, `Closed-trade history`, `Equity curve`, `Risk metrics`, `Signal/stage coverage`, `Worker heartbeat`; copy: `Legacy is operational-evidence complete when provider scope, worker freshness, active slots, and active order coverage are present. Closed-trade analytics remain pending until imported trades exist.` Target part: `apps/web/src/features/bots/statistics-panels.tsx`, `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/app/admin/bots/page.tsx`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx`.
2. Severity P1 - Admin selected-user statistics still exposes unsupported finance labels for Legacy as bare dash values, which looks less institutional than the user page's explicit "closed trade imports pending" copy. Evidence: the selected-user admin page renders latest metric cards `Closed PnL`, `Trades`, `Unrealized PnL`, `Win rate`, and `Profit factor` whenever `bot.latestMetric` exists at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:730`-`740`; the admin metric row type includes nullable `closedPnlUsd`, `winRate`, `profitFactor`, and `maxDrawdownPct` at `apps/web/src/features/admin/user-bot-detail-loader.ts:813`-`825`; Legacy stats are correctly provider-scoped only when an active provider account matches at `apps/web/src/features/admin/user-bot-detail-loader.ts:863`-`924`; the user-facing command center already says Legacy win rate and PF remain unavailable until closed-trade imports exist at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:52`-`56`. Recommendation: for `legacy_bot`, replace the generic finance-card block with the completion cockpit and cards `Wallet snapshot`, `Provider scope`, `Active slots`, `Active orders`, `Closed-trade history`, and `Analytics status`; show `pending import` or `not enough closed trades` instead of `-` for PF/win rate/PnL. Target part: selected-user admin statistics block and the admin summary helpers in `apps/web/src/app/admin/users/[userId]/bots/page.tsx`.
3. Severity P1 - User statistics has the pieces for source clarity, but the top command center does not yet show the aggregate worker heartbeat/freshness that Phase 4.27 made a formal acceptance concept. Evidence: the statistics page mounts `BotContinuityPanel` with "statistics evidence rows" at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:353`-`365` and `BotRuntimeEvidencePanel` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:381`-`394`; `BotStatisticsCommandCenter` top cards are only wallet, net PnL, open positions, and evidence rows at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:98`-`103`; the readiness loader reads the latest aggregate `target='worker'` row and fail-closes stale/error/non-ok tuples at `apps/web/src/features/bots/readiness-loader.ts:118`-`197`; the worker writes `botContinuityStatus`, Tortila snapshot/readState, and Legacy snapshot/readState into `integration_health_checks.target='worker'` at `apps/worker/src/index.ts:288`-`315`; Phase 4.27 added strict managed continuity gates but did not run them without env at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:83`-`90`. Recommendation: add a top-row `Worker heartbeat` card to the stats completion cockpit using the same DTO/readiness semantics, or show `not loaded on this page` with a link when the stats route has not loaded it. Do not run a worker tick during render. Target part: user stats command center and admin mirrors.
4. Severity P2 - Admin fleet has good raw evidence tables, but no single analyst-grade statistics summary that reconciles Tortila owner snapshots and Legacy pub_id rows. Evidence: fleet evidence metrics already include `Worker continuity`, `Journal proof`, `Owner rows`, `Latest Tortila metric`, `Latest Legacy pub_id`, and warning notices at `apps/web/src/app/admin/bots/page.tsx:187`-`237`; the admin fleet evidence ladder is mounted at `apps/web/src/app/admin/bots/page.tsx:435`-`440`; the owner drilldown table shows product, runtime identity, scope, latest, and metrics at `apps/web/src/app/admin/bots/page.tsx:442`-`485`; the Legacy pub_id inspector, active slots, and active order coverage tables exist at `apps/web/src/app/admin/bots/page.tsx:696`-`775`; `bot-health-loader` extracts Legacy provider accounts, slots, and active orders from `rawJson.liveConfig` at `apps/web/src/features/admin/bot-health-loader.ts:290`-`361`. Recommendation: add a fleet-level `Statistics coverage by owner` table with columns `Owner`, `Product`, `Scope`, `Freshness`, `Wallet/Balance`, `Open exposure`, `Closed history`, `Operational coverage`, `Next proof`. For unmapped Legacy pub_id rows, copy should say `fleet diagnostics only - map pub_id before user-owned statistics`. Target part: `apps/web/src/app/admin/bots/page.tsx` plus a shared completion helper.
5. Severity P2 - Existing tests prove safety/static presence, but not the proposed "completion clarity" contract or Legacy anti-fabrication copy. Evidence: static bot statistics tests assert the command center, Legacy operations, safe pub_id snapshots, and no direct adapter calls at `tests/integration/bot-statistics-static.test.ts:17`-`121`; the smoke test renders Tortila and Legacy statistics but does not assert completion taxonomy or Legacy no-fabrication strings beyond existing headings at `tests/e2e/smoke.spec.ts:116`-`141`; selected-user DB E2E asserts worker heartbeat, stats scope, no forms, no CSRF, no start/stop/apply/test connection buttons, and no horizontal scroll at `tests/e2e/admin-user-bot-detail-db.spec.ts:220`-`277`; package scripts expose strict worker and admin DB matrix gates at `package.json:23`-`37`. Recommendation: add focused tests for the new helper and UI copy before implementation is called complete. Target part: new `tests/integration/bot-statistics-completion.test.ts`, extended static tests, and dedicated `tests/e2e/bot-statistics.spec.ts`.
6. Severity P2 - The next patch should stay narrow; settings/defaults/key readiness/drilldown are not the best value target for Phase 4.28. Evidence: the prior audit found simple defaults/custom settings, RSI/CCI slots, exchange key metadata readiness, admin read-only drilldown, and continuity UI mostly present while naming statistics completion as the next slice at `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md:63`-`69`; the Phase 4.22 statistics handoff already added the command center and left user-facing analytics depth and worker reliability as next work at `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md:80`-`83`; Phase 4.27 moved worker acceptance into strict opt-in gates and explicitly says product/UX completion remains separate at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:53`-`58`. Recommendation: implement only the stats completion/clarity slice, not another broad settings rebuild, not provider mutation, not live exchange ping, and not deployment. Target part: Phase 4.28 implementation scope.

## Decisions
- Recommended local patch name: Phase 4.28 "bot statistics completion cockpit."
- Use existing persisted WTC rows only: metric snapshots, position snapshots, trade imports, equity points, Legacy `rawJson.liveConfig`, provider-account mapping, warning summaries, and aggregate worker heartbeat rows.
- Do not create synthetic Legacy PF, win rate, Sharpe, drawdown, PnL, or all-clear states from slots/orders.
- Treat Tortila as "performance analytics" when trade/equity history exists; treat Legacy as "operational analytics" until immutable closed-trade imports exist.
- Mirror the same completion taxonomy across user stats, admin fleet, and selected-user admin pages so the product feels deliberate rather than patched in different dialects.
- Keep exchange key readiness as metadata/vault readiness only. No live exchange ping in this slice.
- Keep all admin pages diagnostic-only: no forms, provider mapping edits, settings mutation, start/stop/apply, exchange ping, provider probe, or worker tick during render.

## Risks
- The worktree was heavily dirty before this audit on branch `codex/bot-analytics-settings-canary-20260603`; this handoff certifies only the inspected state and did not attempt cleanup.
- No tests were run in this read-only audit, so all evidence is static inspection evidence rather than freshly observed green gates.
- "Bloomberg/BlackRock-quality" can be misread as "show more fancy ratios." In this repo, quality means precise source/freshness/scope taxonomy and honest pending states.
- If the completion helper is built inside a React page only, the three surfaces will drift. Use a shared pure builder and test it directly.
- Worker continuity proof is now better tooled after Phase 4.27, but the managed worker/admin DB gates remain not run in this lane because no approved admin Postgres env was provided.

## Verification/tests
RUN in this audit:
- `git status --short --branch` - observed branch and pre-existing dirty/untracked files.
- `Get-Date -Format 'yyyyMMdd-HHmm'` - chose this handoff timestamp.
- `Test-Path docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md` - confirmed target did not exist before writing.
- `rg --files` and `rg -n` over statistics/admin/worker/test files.
- PowerShell line-number reads of the files listed above.

NOT RUN in this audit:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `npm run secret:scan`
- `npm run governance:check`
- `npx vitest ...`
- `npx playwright ...`
- `npm run accept:worker:continuity`
- `npm run accept:worker:continuity:managed`
- `npm run e2e:admin-user-bots:db:managed:matrix`
- Live exchange ping, provider reachability probe, Legacy DB live read, worker tick, live bot start/stop/apply-config, SSH, tmux, systemd, deploy, or production monitoring.

Tests/gates to add or run for the recommended local patch:
- Add `tests/integration/bot-statistics-completion.test.ts` for the pure completion builder: Tortila with full trade/equity history, Legacy with provider snapshot but no closed trades, Legacy with missing/ambiguous provider scope, stale worker heartbeat, and no fabricated PF/win-rate/PnL.
- Extend `tests/integration/bot-statistics-static.test.ts` to require `Statistics coverage matrix`, `Evidence grade`, `Closed-trade history`, `pending import`, `Worker heartbeat`, and no live provider/exchange calls in the new components.
- Extend `tests/integration/admin-user-bot-detail-static.test.ts` to require the selected-user completion mirror and forbid Legacy bare dash PF/win-rate/PnL cards when closed history is absent.
- Extend `tests/integration/bot-read-safety-static.test.ts` to forbid `Connection verified`, `fetch(`, `getBotAdapter`, `startBot`, `stopBot`, `applyConfig`, `test connection`, `apiKey`, `apiSecret`, and `sealed` in the new stats completion files.
- Add or split out `tests/e2e/bot-statistics.spec.ts` for desktop/mobile user stats: Tortila performance analytics visible, Legacy operational analytics visible, completion matrix visible, no horizontal scroll, and unsupported Legacy finance metrics shown as pending rather than zero/dash.
- Run: `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/bot-readiness-builder.test.ts`.
- Run: `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop`.
- Run: `npx playwright test tests/e2e/bot-statistics.spec.ts --project=mobile`.
- Run after local patch: `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `git diff --check`.
- Optional authorized DB proof only with approved env: `npm run accept:worker:continuity:managed`.
- Optional authorized browser DB proof only with approved env/artifact review: `npm run e2e:admin-user-bots:db:managed:matrix`.

## Next actions
1. Open implementation as a new Phase 4.28 session and dispatch required read-only agents before code edits if treating it as a broad phase.
2. Build a shared statistics completion helper and UI panel from existing WTC DTOs and snapshots only.
3. Mount it on user statistics, admin fleet, and selected-user admin drilldown.
4. Replace Legacy unsupported finance labels with explicit pending/history-state copy.
5. Add the focused integration and Playwright coverage above, then record exact gates RUN and NOT RUN in the aggregate handoff.
