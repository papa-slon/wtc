# ecosystem-security-auditor handoff
## Scope
Read-only Phase 4.08 source/security audit for top-level Tortila portfolio caps in the settings strategy map. Scope was limited to current WTC docs/source, latest Phase 4.07 handoff, WTC Tortila settings/config/test files, and local adjacent `bot_tortila` docs/source. Goal: identify safe labels/metrics that can be shown for portfolio caps and unsafe claims/actions to avoid. No live server mutation, env/secret inspection, provider/API exchange action, bot start/stop/apply/test, worker tick, or runtime endpoint call was performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/STATUS.md`
4. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`
5. `apps/web/src/features/bots/config-types.ts`
6. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
7. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
8. `tests/integration/bot-read-safety-static.test.ts`
9. `apps/web/src/features/bots/config.ts`
10. `apps/web/src/features/bots/config-review.ts`
11. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
12. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `packages/db/src/repositories.ts`
15. `../bot_tortila/src/turtle_bot/config.py`
16. `../bot_tortila/src/turtle_bot/risk/risk_manager.py`
17. `../bot_tortila/src/turtle_bot/engine/orchestrator.py`
18. `../bot_tortila/src/turtle_bot/journal/templates/config.html`
19. `../bot_tortila/MONEY_MANAGEMENT_OPTIONS.md`
20. `../bot_tortila/DEPLOYMENT.md`
21. `../bot_tortila/PROTECTIONS_AUDIT.md`
22. `../bot_tortila/PROMPT_turtle_bingx_bot.md`

## Files changed
None — read-only audit. This handoff itself was written: `docs/handoffs/20260604-0926-tortila-portfolio-caps-source-auditor.md`.

## Findings
1. Severity: High. Safe portfolio-cap labels already exist in WTC source and align with adjacent Tortila source. Evidence: `apps/web/src/features/bots/config.ts:63` defines `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick`; `apps/web/src/features/bots/config.ts:189` labels them as "Max open symbols", "Max total units", "Max units per direction", "Halt drawdown (%)", "Daily max loss (%)", and "Max new entries per tick"; `../bot_tortila/src/turtle_bot/config.py:175` defines `max_units_per_direction`, `max_total_units`, and `max_open_symbols`; `../bot_tortila/src/turtle_bot/config.py:185` defines drawdown/daily-loss halts and the per-tick throttle. Recommendation: use those exact labels in the strategy map and present them as WTC reference profile values. Target part: Tortila settings strategy map.

2. Severity: High. Safe cap metrics are reference metrics, not live-runtime proof. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:397` says a user-owned WTC config version is not pushed to the live bot; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:507` says config export contains no exchange keys and applies nothing to a live bot; `packages/db/src/repositories.ts:2178` says `saveBotConfig` is WTC DB only and never forwarded to the live bot. Recommendation: acceptable copy is "saved WTC reference profile", "draft/reference portfolio caps", or "runtime apply disabled"; avoid "active", "synced", "applied", "live enforced", or "currently running" unless a separate runtime proof exists. Target part: product/security copy.

3. Severity: High. The sibling Tortila runtime has cap enforcement code, but this audit did not verify current live values. Evidence: `../bot_tortila/src/turtle_bot/risk/risk_manager.py:117` checks portfolio caps for max units per symbol, direction, total units, and open symbols; `../bot_tortila/src/turtle_bot/engine/orchestrator.py:501` calls `check_portfolio_caps` before entry/add; `../bot_tortila/DEPLOYMENT.md:111` documents `/config` as current runtime configuration, but this audit did not call that endpoint. Recommendation: do not infer current runtime config from WTC DB/reference settings; require a separate approved read-only runtime snapshot/contract before claiming current live enforcement. Target part: runtime evidence boundary.

4. Severity: High. Live actions and raw runtime inputs must remain out of this slice. Evidence: `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md:7` excludes live start/stop/apply/retest, exchange ping, order/mark reads, `/api/marks`, worker tick, provider DB reads/mutations, raw payloads, env/secret inspection, and production/canary mutation; `AGENTS.md:76` requires read-only discovery and `AGENTS.md:81` blocks live bot start/stop/apply-config until adapter audits pass; `apps/web/src/features/bots/config-action-handler.ts:51` rejects secret/live-control form keys, including apply/start/stop/retest/exchange actions. Recommendation: keep the portfolio-cap map as pure read/display of WTC reference config and existing draft state; put any runtime diff, exchange test, or live apply work in a separate security plus bot-integration phase. Target part: Phase 4.08 implementation boundary.

5. Severity: Medium. Existing WTC review components already compute safe portfolio-cap metrics, but Phase 4.07 left them outside the coin strategy map. Evidence: `apps/web/src/features/bots/config-review.ts:130` emits metrics for coins configured, system mix, risk profile, and portfolio caps; `apps/web/src/features/bots/config-review.ts:147` renders "Risk limits" rows for max open symbols, max total units, daily max loss, halt drawdown, and entry throttle; `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md:67` states the top-level portfolio caps are not yet pulled into the same card. Recommendation: reuse the existing review labels/derivation or pass the top-level values into a small sibling/top section in the map rather than duplicating new semantics. Target part: UI/data model.

6. Severity: Medium. Directional unit cap is safe to show, but it is currently only summarized in the "Portfolio caps" metric, not the detailed "Risk limits" list. Evidence: `apps/web/src/features/bots/config-review.ts:113` reads `maxOpenSymbols`, `maxTotalUnits`, and `maxUnitsPerDirection`; `apps/web/src/features/bots/config-review.ts:134` displays "Portfolio caps" as symbols, total units, and per-side units; `apps/web/src/features/bots/config-review.ts:149` lists detailed risk rows but omits a separate "Max units per direction" row. Recommendation: when adding the cap map, include "Max units per direction" as its own row or pill so the top-level map does not hide long/short exposure. Target part: portfolio-cap detail.

7. Severity: Medium. Avoid implying the cap map proves margin sufficiency or production readiness. Evidence: `../bot_tortila/MONEY_MANAGEMENT_OPTIONS.md:14` records an insufficient-margin rejection and says portfolio caps could still ask the exchange for more margin than the account can reserve; `../bot_tortila/src/turtle_bot/engine/orchestrator.py:514` has a margin pre-flight path, but this WTC audit did not run or verify it; `docs/STATUS.md:18` and `docs/STATUS.md:38` both mark live bot control and broader production readiness as not green. Recommendation: copy may say caps are risk/position guardrails; do not say "margin safe", "production ready", "exchange verified", or "safe to increase size" from this settings map. Target part: risk disclaimer/copy.

## Decisions
1. Treat `Max open symbols`, `Max total units`, `Max units per direction`, `Halt drawdown (%)`, `Daily max loss (%)`, and `Max new entries per tick` as safe top-level Tortila portfolio-cap labels for WTC reference settings.
2. Treat `Coins configured`, `System mix`, `Risk profile`, `Portfolio caps`, `Risk limits`, and a separate directional-cap row/pill as safe metrics if they are derived from the saved/draft WTC config.
3. Keep all labels scoped to WTC reference/draft/source-state language. No claim should imply live bot synchronization, exchange acceptance, current runtime state, or order/action readiness.
4. No env files, secrets, live journal endpoints, provider APIs, worker ticks, bot services, or exchange paths were inspected or invoked.
5. No background agents were launched by this auditor lane in this session, and none were left running.

## Risks
1. Static source/docs can drift from the currently running Tortila process; runtime truth requires a separately approved read-only proof path.
2. The worktree was heavily dirty before this audit, including relevant bot settings files; this handoff does not attribute or revert any pre-existing changes.
3. `docs/STATUS.md` is current through Phase 3.67/3.65 production-canary notes, while Phase 4.07 exists as an untracked local handoff; use the latest handoff chain for current local slice truth.
4. Adjacent `bot_tortila` docs include historical/stale risk notes alongside newer source code; use them as evidence of safety language boundaries, not as proof of current live runtime state.

## Verification/tests
RUN:
1. `git status --short --branch` - read-only state check; branch `codex/bot-analytics-settings-canary-20260603`, heavily dirty worktree observed before writing this handoff.
2. `rg` / `Get-Content` read-only inspections of the requested WTC docs/source/test files.
3. `Test-Path ..\bot_tortila` - adjacent local Tortila repository was available.
4. `rg` / `Get-Content` read-only inspections of adjacent `bot_tortila` docs/source listed above.

NOT RUN:
1. `npm test`, `npm run lint`, `npm run typecheck`, build, Playwright, browser checks - skipped because this was a read-only source/security audit with no product/test code edits.
2. Live server, SSH, tmux, systemd, worker tick, production/canary probe, provider DB read/mutation - skipped by explicit scope and protocol.
3. Env/secret file reads, plaintext key inspection, vault opens, exchange ping, order/mark reads, `/api/marks`, live bot start/stop/apply/retest - skipped by explicit security boundary.
4. Git commit/push/PR - not requested.

## Next actions
1. If Phase 4.08 proceeds to implementation, add a compact top-level portfolio-cap section to the Tortila strategy map using the safe labels above and WTC reference/draft wording only.
2. Add focused static/rendered tests that assert the cap map includes max open symbols, max total units, directional unit cap, drawdown halt, daily loss halt, and entry throttle while preserving "no live exchange apply" / "not pushed to the live bot" copy.
3. Defer runtime diff, exchange verification, current live config proof, and any start/stop/apply pathway to a separate audited security plus bot-integration phase.
