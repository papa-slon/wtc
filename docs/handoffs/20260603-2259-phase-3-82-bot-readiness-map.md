# phase-3-82 bot-readiness-map handoff
## Scope
Implemented the first user-facing bot readiness map slice for Tortila and Legacy bot rooms.

The slice focused on making the bot room easier to understand without pretending live control exists: access, exchange key/provider mapping, WTC strategy source, runtime snapshot, statistics availability, and live-control-disabled state are now surfaced as explicit rows on the bot dashboard and settings page. Cabinet bot setup copy was tightened so Tortila exchange readiness is metadata-only and Legacy readiness is provider pub_id based.

This phase did not start, stop, restart, retest, apply config to, or live-ping any bot, worker, exchange, provider DB, SSH, tmux, or systemd service. The work stayed in WTC web/test/docs surfaces.

External research inputs used for product direction, not as runtime dependencies:
1. Bloomberg Portfolio and Risk Analytics: unified portfolio, risk, performance, attribution, scenarios, and reporting should read as one operational view - https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/
2. BlackRock Aladdin: configurable dashboards, multi-lens risk/performance, consistent data source, and open architecture are the right product mental model for the future analytics room - https://www.blackrock.com/institutions/en-us/investment-capabilities/technolgy/aladdin-portfolio-management-software
3. 3Commas DCA indicator conditions: RSI/CCI-style bot conditions need simple indicator, timeframe, condition, and signal-value controls - https://help.3commas.io/en/articles/3108986-dca-bot-start-close-conditions-via-indicators
4. TradingView Pine Screener and screeners: watchlist/symbol filters, table columns, indicator inputs, and scan/settings flow are the UX baseline for the future symbol/stage editor - https://www.tradingview.com/support/solutions/43000742436-tradingview-pine-screener-key-features-and-requirements/ and https://www.tradingview.com/support/solutions/43000718885-tradingview-screeners-walkthrough/

Per-agent handoffs:
1. `docs/handoffs/20260603-2240-bot-readiness-map-ux-auditor.md`
2. `docs/handoffs/20260603-2240-bot-readiness-map-platform-security-auditor.md`
3. `docs/handoffs/20260603-2240-bot-readiness-map-tests-auditor.md`

Agent cleanup: close was attempted for all three known agent IDs after their handoffs were collected. The post-compaction agent manager returned `not found` for each ID, so no closeable background agent handles remained visible in this session.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`
5. `docs/handoffs/20260603-2240-bot-readiness-map-ux-auditor.md`
6. `docs/handoffs/20260603-2240-bot-readiness-map-platform-security-auditor.md`
7. `docs/handoffs/20260603-2240-bot-readiness-map-tests-auditor.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/features/bots/BotReadinessMap.tsx`
11. `apps/web/src/features/cabinet/loader.ts`
12. `tests/integration/bot-read-safety-static.test.ts`
13. `tests/integration/cabinet-pg9.test.ts`
14. `tests/e2e/bot-settings.spec.ts`
15. `tests/e2e/cabinet-pg9-mobile.spec.ts`
16. External product sources listed in Scope.

## Files changed
1. `apps/web/src/features/bots/BotReadinessMap.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
4. `apps/web/src/features/cabinet/loader.ts`
5. `tests/integration/bot-read-safety-static.test.ts`
6. `tests/integration/cabinet-pg9.test.ts`
7. `tests/e2e/bot-settings.spec.ts`
8. `tests/e2e/cabinet-pg9-mobile.spec.ts`
9. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
10. `apps/web/src/features/bots/config-types.ts`
11. `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`

## Findings
1. High - fixed false-green runtime readiness. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` now maps `unreachable` and `malformed` to `blocked`, `stale`/`not_configured`/mock to `attention`, and only `ok` to `ready`.
2. High - kept exchange readiness metadata-only. Evidence: Tortila readiness rows and cabinet labels say `WTC vault metadata saved`, `No key saved`, or `live ping not run/not available yet`; tests forbid `Connection verified` and live-control verbs on readiness surfaces.
3. High - kept access as the first gate. Evidence: dashboard/settings return access-required views before readiness data is loaded, and the readiness access row now uses `reasonLabel(access.reason)` with grace marked as `attention`.
4. Medium - added a reusable presentational `BotReadinessMap` with responsive table markup and no backend/vault/adapter imports.
5. Medium - settings now has a clear `Settings readiness map` separating entitlement, key/provider mapping, settings source, and disabled live apply.
6. Medium - cabinet bot setup labels now distinguish Tortila exchange metadata from a live exchange ping and Legacy provider pub_id runtime from user-owned settings.
7. High - fixed a dev-server-only settings blocker where the client `LegacyAveragingConfigTable` imported types from server-only `features/bots/config.ts`. Evidence: live dev routes returned 500 with a `server-only` import trace before the fix; the component now imports structural types from `apps/web/src/features/bots/config-types.ts`, and fresh dev routes return 200.
8. Medium - this slice still does not extract a narrow `loadBotReadinessForUser` projection. Dashboard/settings use existing loaders for their wider page content, so the next slice must reduce readiness construction to a tested DTO before expanding to setup/cabinet/admin maps.
9. Medium - dashboard readiness map browser coverage is still indirect. Settings/cabinet e2e passed, but a dedicated `/app/bots/tortila` and `/app/bots/legacy` readiness-map e2e remains to add.

## Decisions
1. Readiness is a map of owned metadata and persisted snapshots, not proof of live exchange connectivity or live bot operability.
2. `ready` is reserved for explicitly observed safe states. Missing, stale, malformed, unreachable, mock, grace, or not-configured states must be `attention` or `blocked`.
3. User settings remain WTC-side versioned profiles only. Saving settings does not start, stop, retest, live-apply, or mutate a running bot.
4. Admin can inspect user bot readiness in later phases, but must remain read-only for user settings, exchange keys, provider mappings, and live control.
5. The next product architecture slice should follow the researched pattern: symbol/watchlist selection, indicator cards, stage slots, scan/test state, and portfolio-quality statistics panels, all under fail-closed entitlements and no-secret rules.

## Risks
1. The wider worktree is already dirty from prior phases; this phase changed only the files listed above and did not revert unrelated changes.
2. The readiness map still shares page-level loaders with broader bot dashboard content. A narrow DTO is required before treating the map as the canonical readiness source across cabinet/setup/admin.
3. Current exchange key checks are metadata-only. A future live ping requires separate security and bot-integration audits before implementation.
4. Legacy provider pub_id mapping proves attribution scope only. It does not authorize live control or config apply.
5. Agent cleanup after context compaction could not close by ID because the agent manager returned `not found`; no active closeable handles were visible.

## Verification/tests
RUN:
1. Required protocol/doc reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and the Phase 3.81 handoff.
2. Per-agent audits collected: UX, platform/security, and tests handoffs listed in Scope.
3. External product research: Bloomberg PORT, BlackRock Aladdin, 3Commas DCA indicator docs, and TradingView screener docs.
4. `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `npm run e2e -- tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` - PASS, 4 passed and 2 desktop-only skips.
7. `npm run typecheck` - PASS.
8. `npm run lint` - PASS.
9. `npm run secret:scan` - PASS.
10. `npm run test -- tests/integration/admin-user-bot-detail-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-statistics-static.test.ts` - PASS.
11. `npm run build -w @wtc/web` - PASS after the client type-import fix.
12. `npm run check:core` - PASS.
13. `npm run typecheck -w @wtc/worker` - PASS.
14. Live dev route checks on fresh dev server `http://localhost:3300`: `/app/bots/tortila`, `/app/bots/tortila/settings`, and `/app/bots/legacy/settings` - PASS 200.
15. Dev server restart: old stuck Next dev process on port 3300 had stale import-trace/EBUSY cache state; restarted only the web dev server, not bots/workers/live services. New listener is on port 3300.
16. `git diff --check` - PASS.

NOT RUN:
1. Live exchange ping/test - not run by policy; current key checks are sealed metadata only.
2. Live bot start/stop/apply-config/retest - not run by policy.
3. Worker tick/restart, SSH, tmux, systemd - not run by policy.
4. Provider DB live read/write - not run by policy.
5. `.env` read/write - not run by policy.
6. Dedicated dashboard readiness-map e2e - not yet created; settings/cabinet e2e passed.
7. Narrow readiness DTO tests - not yet created; next phase should own this.

## Next actions
1. Phase 3.83: implement `features/bots/readiness.ts` or equivalent narrow server-only readiness DTO/builder, then use it on dashboard/settings/setup/cabinet.
2. Add dashboard readiness-map e2e for `/app/bots/tortila` and `/app/bots/legacy` at desktop and 375px mobile.
3. Add setup review readiness map with runtime/stat rows marked read-only unavailable when not loaded.
4. Add compact cabinet readiness rows for Tortila and Legacy product cards; qualify or replace the global `KEYS VAULT Encrypted` metric with real key metadata count/status.
5. Start the deeper symbol/stage UX slice: symbol dropdown/watchlist, RSI/CCI condition cards, stage slot counts, default vs personal config mode, and clear validation.
6. Keep live ping and live control out until separate security and bot-integration phases approve safe adapters.
