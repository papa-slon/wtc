# Phase 3.75 admin bot stats drilldown handoff
## Scope
Bounded implementation slice for selected-user admin bot statistics on `/admin/users/[userId]/bots`: admins can inspect read-only persisted positions, recent imported trades, and metric-derived equity snapshots for Tortila and Legacy bot instances, while preserving Phase 3.74 read-only settings/provider mapping behavior.

Read-only background agents were launched before product edits and closed before final report:
- [platform auditor](20260603-1941-admin-bot-stats-platform-auditor.md)
- [UX auditor](20260603-1941-admin-bot-stats-ux-auditor.md)
- [security auditor](20260603-1943-admin-bot-stats-security-auditor.md)
- [tests auditor](20260603-1943-admin-bot-stats-tests-auditor.md)

No live Legacy/Tortila bot start, stop, restart, retest, exchange ping, apply-config, SSH, tmux, systemd, `.env`, provider DB mutation, worker tick, live bot control path, or live adapter probe was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- Per-agent handoffs listed above.
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `playwright.config.ts`
- `package.json`
- `apps/web/package.json`

## Files changed
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `docs/handoffs/20260603-1941-admin-bot-stats-platform-auditor.md`
- `docs/handoffs/20260603-1941-admin-bot-stats-ux-auditor.md`
- `docs/handoffs/20260603-1943-admin-bot-stats-security-auditor.md`
- `docs/handoffs/20260603-1943-admin-bot-stats-tests-auditor.md`
- `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`

## Findings
1. Severity: High. Evidence: Phase 3.74 admin drilldown exposed only latest metric summary, and this phase's auditors called out missing positions/trades/equity. Fix: admin DTO now includes `positions`, `trades`, `equityCurve`, and `statsSource`; page renders read-only open positions, recent trades, and equity snapshot tables.
2. Severity: High. Evidence: Legacy selected-user facts must not show null-provider fleet rows. Fix: the admin loader applies the active target-user provider-account id to metrics, positions, trades, and equity; unscoped Legacy rows remain hidden from selected-user drilldown.
3. Severity: High. Evidence: generic full-row trade/metric reads can include `rawJson`. Fix: admin loader uses explicit scalar selects and never selects metric/trade `rawJson`, exchange secret rows, config history JSON, password hashes, or live-apply credentials.
4. Severity: Medium. Evidence: equity has no separate table. Decision implemented: admin equity curve is derived from bounded `bot_metric_snapshots.wallet_equity_usd` rows and rendered as persisted WTC snapshots.
5. Severity: Medium. Evidence: mobile admin tables can overflow. Fix: all new tables use `wtc-table-wrap` and `data-label` cells; focused admin mobile Playwright passed at 375px.

## Decisions
1. `/admin/users/[userId]/bots` remains a selected-user read-only drilldown. It does not edit user settings, provider mappings, exchange keys, live config, positions, or orders.
2. Phase 3.75 admin statistics are DB-only and snapshot-backed. The page does not call `loadBotReadModelForUser()` because that public loader can fall back to adapter reads outside DB mode.
3. Tortila stats are scoped by the selected user's bot instance. Legacy stats additionally require an active selected-user `legacy-db` provider mapping and matching `botProviderAccountId`.
4. Recent trades are read from immutable `bot_trade_imports`; Legacy can honestly render no closed trades until a separate Legacy trade importer exists.
5. Full provider account ids stay out of normal admin DTO/UI. Existing masked provider mapping behavior from Phase 3.74 is preserved.

## Risks
1. This slice does not implement the separate global admin bot configuration/system-defaults page. That remains a future phase.
2. Browser in-app manual login verification was limited by the local Browser runtime: clipboard-backed input failed and its read-only evaluation sandbox had no `fetch`. The real Playwright mobile browser gate passed.
3. Dev server is running for manual inspection at `http://localhost:3412` with demo/mock settings. Demo mode does not show DB-backed seeded stats panels; PGlite loader tests provide the data-backed proof.
4. The worktree remains substantially dirty from earlier adjacent bot/admin phases. This slice did not revert unrelated changes.

## Verification/tests
RUN:
1. Four read-only background agent audits completed and were closed.
2. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 6 tests.
3. `npx tsc --noEmit -p apps/web/tsconfig.json` - PASS.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run typecheck` - PASS.
6. `npm run lint` - PASS.
7. `npm run governance:check` - PASS after aggregate, 0 errors and 1 known historical warning.
8. `npm run secret:scan` - PASS.
9. `npm run build -w @wtc/web` - PASS; `/admin/users/[userId]/bots` compiled.
10. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test.
11. Local dev server smoke: `http://localhost:3412/login` returned HTTP 200.

NOT RUN:
1. Full `npm test` - skipped for this bounded slice after focused admin tests, root/web typecheck, lint, secret scan, web build, and focused admin mobile Playwright passed.
2. Full `npm run ci:local` - skipped because its components relevant to this slice were run individually except full test suite and worker typecheck.
3. DB migration apply/push/seed against managed Postgres - skipped because this slice added no migrations.
4. DB-backed browser visual fixture for selected-user stats - skipped because no stable seeded browser DB route exists in the default demo app; loader PGlite tests cover data scoping and serialization.
5. Live Legacy/Tortila bot continuity proof, process watchdog, SSH, tmux, systemd, worker restart, exchange ping, provider DB mutation/read outside local app mocks, `.env` reads, start/stop/retest/apply-config - forbidden by scope and not run.

## Next actions
1. Phase 3.76: build separate admin global bot configuration/system-defaults surface, explicitly not user-owned settings.
2. Add DB-backed browser fixture coverage for `/admin/users/[userId]/bots` once a stable seeded target user route exists.
3. Add Legacy closed-trade import support as a separate worker/provider integration slice if admin Legacy trade history is required beyond persisted metric/position snapshots.
4. Continue toward full Legacy and Tortila completion without changing the no-live-control boundary until security and bot-integration gates approve it.
