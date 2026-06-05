# phase-4-07-tortila-strategy-map handoff
## Scope
Narrow Phase 4.07 implementation slice: make Tortila settings/setup explain the per-coin Turtle strategy draft before save, matching the clarity added to Legacy in Phase 4.06 without adding live bot control or provider/runtime claims.

The Tortila coin editor now has a shared client-side `Tortila strategy map` above the row cards. It groups draft coin rows into System 2 (55/20) and System 1 (20/10), shows row-numbered candidates with symbol, timeframe, system, risk %, ATR stop N, add step N, max units, ATR period, and TP R/off, summarizes risk shape and position guardrails, and updates when visible row fields change before save. The `SYMBOL_CONFIGS` preview is also draft-aware.

Out of scope: live Tortila start/stop/apply/retest, live exchange ping, exchange order/mark reads, `/api/marks`, worker tick, provider DB mutation/read, raw provider payloads, env/secret inspection, production/canary mutation, broad bot completion, and unrelated dirty worktree cleanup.

Per-agent handoffs collected:
1. `docs/handoffs/20260604-0906-tortila-strategy-ux-auditor.md`
2. `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md`
3. `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`

All three background agents were closed after their handoffs were collected.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md`
8. `docs/handoffs/20260604-0906-tortila-strategy-ux-auditor.md`
9. `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md`
10. `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`
11. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-types.ts`
14. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
15. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `tests/e2e/bot-settings.spec.ts`
18. `tests/integration/bot-config-review-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. External official reference: TradingView Strategy Tester overview, `https://www.tradingview.com/support/solutions/43000764138/`
21. External official/reference guide: Binance Futures Grid Trading guide, `https://academy.binance.com/hr-HR/articles/step-by-step-guide-to-grid-trading-on-binance-futures`
22. External official reference: Interactive Brokers Risk Navigator, `https://brokerage.ibkr.com/en/trading/risk-navigator.php`
23. External official reference: BlackRock Aladdin Risk, `https://www.blackrock.com/aladdin/products/aladdin-risk`

## Files changed
1. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
2. `tests/e2e/bot-settings.spec.ts`
3. `tests/integration/bot-config-review-static.test.ts`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `docs/handoffs/20260604-0906-tortila-strategy-ux-auditor.md`
6. `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md`
7. `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`
8. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`

## Findings
1. Severity: High. Tortila settings now has the missing compact strategy map, so users no longer need to mentally scan several row cards to understand the draft. Evidence: `TortilaSymbolConfigTable.tsx` adds `Tortila strategy map`, `TortilaRowDraft`, `rowDrafts`, `strategyMapRows`, `candidateLabel`, and draft-aware `SYMBOL_CONFIGS`. Recommendation: keep the map inside the shared Tortila table so settings and setup stay consistent. Target part: Tortila settings/setup clarity.
2. Severity: High. The map is draft-aware for visible row decisions before save: selected/manual symbol, timeframe, Turtle system, risk percent, ATR stop, add step, max units, ATR period, and TP R. Evidence: rendered E2E changes row 1 from System 2 to System 1 and risk to `0.7`, then asserts the map updates before submit. Recommendation: keep this client-side advisory only; persistence remains the existing server action. Target part: WTC draft explanation.
3. Severity: High. Source-truth language stayed within audited Tortila semantics. Evidence: the source auditor confirmed safe labels: System 1 = 20/10, System 2 = 55/20, risk percent exports as runtime fraction, `stopN` is ATR stop multiple, `addStep` is pyramid step in N, `maxUnits` is per-symbol pyramid cap, `atrPeriod` is Wilder ATR lookback, and `takeProfitRr` is TP R with `0` meaning no fixed TP. Recommendation: avoid describing this map as live config or live capacity. Target part: product copy.
4. Severity: High. Live-control and exchange-test boundaries remain intact. Evidence: no new server action, adapter call, provider read, exchange ping, `/api/marks`, start/stop/apply, or runtime mutation was added; static tests still cover no false live-control language and hidden-field/runtime sanitizer boundaries. Recommendation: put any real runtime diff or exchange ping in a separate security plus bot-integration phase. Target part: bot safety boundary.
5. Severity: Medium. External pattern research supports the chosen structure: serious trading/risk tools expose key metrics, risk/performance, scenario/risk context, and parameter review close to the strategy surface. Evidence: official TradingView Strategy Tester, Binance parameter-customization guide, IBKR Risk Navigator, and BlackRock Aladdin Risk were consulted. Recommendation: keep WTC dense, table-driven, and risk-first rather than turning settings into a marketing page. Target part: premium fintech UX.

## Decisions
1. `TortilaSymbolConfigTable` is now a client component so the strategy map and export preview can update before save without touching server actions.
2. The table imports only client-safe `TortilaSymbolConfig` from `config-types.ts`, avoiding the `server-only` `config.ts` boundary.
3. `Runtime export preview (current saved)` was replaced with `Runtime export preview (draft)` because the preview now reflects visible draft rows.
4. Blank Tortila rows are ignored in the strategy map and export preview.
5. The map shows WTC draft/profile shape only. It does not claim a live config is running, synced, applied, connected, or exchange-verified.

## Risks
1. Client-side draft maps are advisory and browser-editable; they must never become entitlement, persistence, provider, or live-control authority.
2. The map summarizes per-coin max units but does not yet pull the top-level portfolio caps into the same card. Those fields still render directly below the table through the existing generic config fields.
3. A future runtime-diff feature would require a separate approved Tortila current-runtime config contract; the current journal has no safe JSON config endpoint for that claim.
4. The broader worktree remains heavily dirty from previous phases; this handoff scopes ownership only to Phase 4.07 files.

## Verification/tests
RUN:
1. Required protocol/current-state docs were read before edits, and three read-only agents were launched before edits.
2. UX/product auditor handoff: `docs/handoffs/20260604-0906-tortila-strategy-ux-auditor.md`.
3. Source-truth auditor handoff: `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md`.
4. Tests/security auditor handoff: `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`.
5. External pattern research consulted official TradingView, Binance, Interactive Brokers, and BlackRock sources listed above.
6. `npm exec eslint -- 'apps/web/src/features/bots/TortilaSymbolConfigTable.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts'` - PASS.
7. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 44 tests.
8. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
9. `npm exec tsc -- --noEmit` - PASS.
10. `$env:E2E_PORT='3430'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 8 tests.
11. `$env:E2E_PORT='3431'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 8 tests.
12. `npm run secret:scan` - PASS.
13. `git diff --check` - PASS.
14. `npm run governance:check` after this aggregate - PASS, current phase `20260604-0921`, 0 errors, 1 known historical warning.

NOT RUN:
1. Full `npm test`, full `npm run lint`, build, coverage, full CI, and full e2e matrix - skipped because Phase 4.07 is a focused UI/safety slice and targeted static/type/lint/rendered gates passed.
2. Live bot start/stop/apply/retest, live config push, position close, live diagnostics, exchange ping, `/api/marks`, worker tick, provider DB mutation/read, raw provider payload inspection, env/secret value inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.
3. Git commit, push, PR - not requested.

## Next actions
1. Continue the broader goal with another single-purpose bot completion slice; do not mark the full Legacy/Tortila website objective complete yet.
2. Candidate next slice: bring top-level Tortila portfolio caps into the same strategy-map card, or enrich admin selected-user bot drilldowns with the same draft-vs-runtime clarity.
3. Keep real runtime config proof, live exchange ping, and live start/stop/apply behind separate security and bot-integration approval.
