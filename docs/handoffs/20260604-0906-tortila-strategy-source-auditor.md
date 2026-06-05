# tortila-strategy-source-auditor handoff
## Scope
Phase 4.07 read-only source-truth and bot-integration audit for Tortila strategy settings copy. Scope was limited to local source, WTC docs/contracts, WTC adapter/worker/web settings code, and adjacent `..\bot_tortila` source/tests. No product code, tests, env files, secrets, DB contents, WAL contents, logs, live servers, SSH, tmux, systemd, worker ticks, bot/provider endpoints, exchange APIs, or live control paths were touched.

Goal: establish safe product truth for a Tortila settings map: what System 1/2 mean, what `riskPercent`, `stopN`, `addStep`, `maxUnits`, `atrPeriod`, `takeProfitRr`, and portfolio caps can be called, what cannot be claimed without live proof, and exact unsafe phrases/functions to avoid.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/handoffs/20260603-tortila-bot-integration-auditor.md`
- `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `..\bot_tortila\src\turtle_bot\config.py`
- `..\bot_tortila\src\turtle_bot\strategy\turtle.py`
- `..\bot_tortila\src\turtle_bot\strategy\winner_filter.py`
- `..\bot_tortila\src\turtle_bot\risk\risk_manager.py`
- `..\bot_tortila\src\turtle_bot\execution\order_manager.py`
- `..\bot_tortila\src\turtle_bot\engine\orchestrator.py`
- `..\bot_tortila\src\turtle_bot\journal\app.py`
- `..\bot_tortila\tests\test_per_symbol_config.py`
- `..\bot_tortila\tests\test_tp_flow.py`
- `..\bot_tortila\tests\test_winner_filter.py`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Tortila System 1/2 has a narrow source-backed meaning: System 1 maps to Donchian entry/exit 20/10, and System 2 maps to 55/20. Evidence: provider per-symbol config derives `effective_entry_period` as 20 for system 1 and 55 otherwise, and `effective_exit_period` as 10 for system 1 and 20 otherwise at `..\bot_tortila\src\turtle_bot\config.py:49` and `..\bot_tortila\src\turtle_bot\config.py:55`; global settings use the same mapping at `..\bot_tortila\src\turtle_bot\config.py:289` and `..\bot_tortila\src\turtle_bot\config.py:295`; WTC UI labels exactly `System 2 (55/20)` and `System 1 (20/10)` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:360`. Recommendation: call these "System 1 (20/10)" and "System 2 (55/20)" only; do not call either inherently safe, conservative, aggressive, low-drawdown, or live-ready without separate evidence. Target part: Tortila strategy map labels and explanatory copy.

2. Severity: High. `riskPercent` is WTC UI percent, but the provider runtime DSL expects a fraction named `risk_pct`; WTC correctly exports percent divided by 100. Evidence: WTC validates `riskPercent` from 0.1 to 3 at `apps/web/src/features/bots/config.ts:40` and converts `riskPercent / 100` in `toRuntimeRiskFraction` at `apps/web/src/features/bots/config.ts:698`; serialized rows put that converted value into the fourth `SYMBOL_CONFIGS` field at `apps/web/src/features/bots/config.ts:702`; the provider parser requires `risk_pct` and validates it in `[0.001, 0.05]` at `..\bot_tortila\src\turtle_bot\config.py:71` and `..\bot_tortila\src\turtle_bot\config.py:110`; provider sizing uses `(risk_pct * equity_usdt) / atr` and documents that a 1N adverse move changes PnL by `risk_pct * equity` at `..\bot_tortila\src\turtle_bot\risk\risk_manager.py:50`. Recommendation: call it "Risk per trade (%)" or "risk fraction in export"; never imply it is leverage, position size percent, guaranteed maximum loss, or exchange-applied account risk. Target part: row field label, export preview, help text.

3. Severity: High. `stopN`, `addStep`, `maxUnits`, and `atrPeriod` are source-backed Turtle mechanics, but only as strategy intent unless runtime config proof exists. Evidence: WTC validates `stopN`, `addStep`, `maxUnits`, and `atrPeriod` at `apps/web/src/features/bots/config.ts:41`; provider `StrategyConfig` stores `atr_period`, `add_step`, `stop_n`, and `max_units` at `..\bot_tortila\src\turtle_bot\strategy\turtle.py:26`; decisions compute Wilder ATR and Donchian channels from `cfg.atr_period`, `cfg.entry_period`, and `cfg.exit_period` at `..\bot_tortila\src\turtle_bot\strategy\turtle.py:95`; add logic triggers at `last_entry_price +/- add_step * N` and blocks adds when units reach `max_units` at `..\bot_tortila\src\turtle_bot\strategy\turtle.py:129`; stops are calculated from `stop_n * N` at entry/add decision time at `..\bot_tortila\src\turtle_bot\strategy\turtle.py:164`; the provider parser accepts these as `stop_n`, `add_step`, optional `max_units`, and optional `atr_period` fields in `SYMBOL_CONFIGS` at `..\bot_tortila\src\turtle_bot\config.py:69`. Recommendation: safe names are "ATR stop multiple", "pyramid add step in N", "per-symbol pyramid cap", and "Wilder ATR lookback"; avoid "active stop on exchange", "will add", "will stop", or "current runtime stop" without live runtime and order evidence. Target part: row field copy and strategy-map guardrails.

4. Severity: High. `takeProfitRr` is not a percent and not a guarantee; it is `tp_rr`, a take-profit risk multiple where `0` disables TP and positive values are per-symbol opt-in. Evidence: provider comments define `tp_rr` as long `avg_entry + tp_rr * (stop_n * N_ATR)` and short `avg_entry - tp_rr * (stop_n * N_ATR)`, with default `0.0`, at `..\bot_tortila\src\turtle_bot\config.py:40`; the parser states the ninth field is `tp_rr` and `0` disables TP at `..\bot_tortila\src\turtle_bot\config.py:73`; `OrderManager.place_take_profit` repeats the formula, says `n_atr * stop_n` is 1R, and returns `None` when `tp_rr <= 0`, quantity is nonpositive, or risk distance cannot be derived at `..\bot_tortila\src\turtle_bot\execution\order_manager.py:376`; orchestrator refreshes TP only from per-symbol `per.tp_rr`, cancels stale TP first, and exits early when `tp_rr <= 0` at `..\bot_tortila\src\turtle_bot\engine\orchestrator.py:602` and `..\bot_tortila\src\turtle_bot\engine\orchestrator.py:669`; focused provider tests assert long/short formulas and disabled behavior at `..\bot_tortila\tests\test_tp_flow.py:530` and `..\bot_tortila\tests\test_tp_flow.py:588`. Recommendation: call it "TP R" or "take-profit R multiple"; say "0 = no fixed TP in the exported profile"; avoid "TP percent", "profit target percent", "TP guaranteed", or "exchange TP is active" without live order proof. Target part: row label, presets, export copy, warnings.

5. Severity: High. Portfolio caps have source-backed names, but WTC should present them as WTC-side/exported caps, not as observed live capacity. Evidence: WTC exposes `maxOpenSymbols`, `maxTotalUnits`, and `maxUnitsPerDirection` fields with labels equivalent to `MAX_OPEN_SYMBOLS`, portfolio-wide total units, and directional exposure cap at `apps/web/src/features/bots/config.ts:189`; safe export emits `MAX_OPEN_SYMBOLS`, `MAX_TOTAL_UNITS`, and `MAX_UNITS_PER_DIRECTION` at `apps/web/src/features/bots/config-export.ts:284`; provider settings define `max_units_per_direction`, `max_total_units`, and `max_open_symbols` at `..\bot_tortila\src\turtle_bot\config.py:173`; provider risk manager enforces per-symbol `max_units`, per-direction unit totals, total units, and max open symbol count at `..\bot_tortila\src\turtle_bot\risk\risk_manager.py:124`. Recommendation: safe copy is "portfolio cap in the WTC reference/export profile"; avoid "live capacity", "available slots", "current exposure limit", or "bot will accept N more units" without runtime state. Target part: strategy map `Position guardrails`, export text, setup/settings summaries.

6. Severity: Critical. WTC settings are reference profiles and safe exports, not live runtime config or a live apply surface. Evidence: WTC operation mode copy says saved automation intent still requires a separately audited adapter at `apps/web/src/features/bots/config.ts:165`; Tortila table says each card saves a WTC-side profile only at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:205`; the draft preview says saving stores a WTC config version only and pushes nothing to the live bot at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:401`; persistence saves sanitized WTC config to WTC DB at `apps/web/src/features/bots/config.ts:1110`; the real Tortila adapter `getConfig` throws because the journal has no `/api/config` endpoint at `packages/bot-adapters/src/http.ts:181`; the adjacent journal exposes HTML `/config`, not JSON `/api/config`, at `..\bot_tortila\src\turtle_bot\journal\app.py:560`. Recommendation: phrase the map as "WTC-side strategy intent", "draft", "saved profile", or "safe export"; do not call it "current live config", "running config", "synced", "applied", "connected", or "verified" until a separate approved current-runtime config contract and acceptance proof exist. Target part: Tortila settings page, setup wizard, config export, admin defaults.

7. Severity: Critical. Live-control, live-mark, and secret-bearing paths are explicitly unsafe for this product surface. Evidence: orchestrator seed forbids live bot control, SSH, tmux, systemd, process control, and `.env` mutation at `docs/handoffs/0000-orchestrator-seed.md:115`; session protocol repeats no live bot control or plaintext exchange secrets at `docs/SESSION_PROTOCOL.md:83`; control methods require both a feature flag and completed security plus bot-integration audit and otherwise throw `BotControlDisabledError` at `packages/bot-adapters/src/control.ts:1`; real HTTP adapter comments say GET-only, never control/mutation, never `/api/marks`, and control methods disabled at `packages/bot-adapters/src/http.ts:1`; worker safety says `snapshotTortilaJournal` is read-only, never calls `startBot`/`stopBot`/`applyConfig`, and never calls `/api/marks` at `apps/worker/src/jobs.ts:9`; contract excludes `/api/marks` because it calls BingX directly and WTC must never consume it at `docs/CONTRACTS/tortila-adapter.md:250`; adjacent journal `/api/marks` opens a short-lived BingX client at `..\bot_tortila\src\turtle_bot\journal\app.py:31` and serves `/api/marks` at `..\bot_tortila\src\turtle_bot\journal\app.py:705`. Recommendation: exact unsafe functions/endpoints to avoid are `startBot`, `stopBot`, `applyConfig`, `testExchange`, `retest`, `exchangeApply`, `exchangeOrder`, `liveControl`, `getConfig` as a live claim, `/api/marks`, exchange pings, and any env/secret/DB/SSH/systemd/tmux path. Exact unsafe phrases to avoid are "applied to live bot", "synced with Tortila", "running config", "current live strategy", "connection verified", "exchange test passed", "start/stop bot", "live apply", "live-ready", "will open", "next trade", "TP protected", "warnings cleared", and "healthy" when based only on source review. Target part: copy, forms, tests, route/action names.

8. Severity: Medium. Winner-filter semantics are source-backed but not exposed as a current WTC row setting; avoid smuggling it into System 1 copy. Evidence: provider winner filter docstring says it applies only when `USE_WINNER_FILTER=True` and `SYSTEM=1`; System 2 is always taken as fail-safe at `..\bot_tortila\src\turtle_bot\strategy\winner_filter.py:1`; `should_skip_system1_entry` returns false unless the filter is enabled and `system == 1` at `..\bot_tortila\src\turtle_bot\strategy\winner_filter.py:152`; orchestrator computes `wf_skip` only when `per.use_winner_filter and per.system == 1` at `..\bot_tortila\src\turtle_bot\engine\orchestrator.py:389`; WTC Tortila row fields include system, risk, stop, add, max units, ATR, and TP, but no winner-filter field at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:356`. Recommendation: do not claim "System 1 skips previous winners" unless an explicit `useWinnerFilter` or runtime config field is added and proved; safe wording is "optional provider winner filter exists outside this WTC row map." Target part: System 1 explanatory copy and future advanced settings.

9. Severity: Medium. There is guard alias drift that should be closed before expanding runtime/config copy. Evidence: action-form guards block `exchangeapply`, `exchangeorder`, and `livecontrol` at `apps/web/src/features/bots/config-action-handler.ts:51`; persisted user config guards block live-control basics but do not include those three aliases at `apps/web/src/features/bots/config.ts:864`; runtime sanitizer similarly omits those three aliases at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`; prior focused safety audit already classified sanitizer/config alias drift as medium risk in `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md:68`. Recommendation: centralize forbidden bot config/runtime keys and add parity tests across action forms, persisted config, admin config, repository guard, export, and runtime sanitizer. Target part: config safety constants/tests.

## Decisions
1. Safe System labels: `System 1 (20/10)` and `System 2 (55/20)`.
2. Safe field names:
   - `riskPercent`: `Risk per trade (%)`; exported as runtime `risk_pct` fraction.
   - `stopN`: `ATR stop multiple` or `ATR stop N`.
   - `addStep`: `Pyramid add step in N`.
   - `maxUnits`: `Per-symbol pyramid cap`.
   - `atrPeriod`: `Wilder ATR lookback`.
   - `takeProfitRr`: `TP R` or `take-profit R multiple`; `0 = no fixed TP in export`.
   - caps: `Max open symbols`, `Max total units`, `Max units per direction`, all as WTC reference/export caps.
3. Safe surface framing: "WTC-side strategy intent", "draft", "saved profile", "safe export", "reference profile", and "requires separately audited live apply/control adapter".
4. Unsafe product claims without live proof: current live runtime config, applied/synced config, active exchange orders, live readiness, next trade/open/slot, exact open risk/unrealized PnL/mark price, TP guaranteed, P0/P1 cleared, or healthy based only on source review.
5. Unsafe functions/endpoints/keys to avoid in this surface: `startBot`, `stopBot`, `applyConfig`, `testExchange`, `retest`, `exchangeApply`, `exchangeOrder`, `liveControl`, `/api/marks`, live exchange ping/order paths, `JOURNAL_READ_TOKEN`, `TORTILA_JOURNAL_URL`, API keys/secrets, env files, DB contents, SSH/tmux/systemd.

## Risks
1. Users may assume WTC settings are applied to the running Tortila bot even though current WTC saves only a WTC config version and safe export.
2. Without a provider JSON current-runtime config endpoint, WTC cannot prove live `.env`/`SYMBOL_CONFIGS` equals the WTC draft.
3. Alias drift in forbidden-key lists could let future runtime display or persistence paths use unsafe live-control wording unless centralized.
4. `takeProfitRr` is easy to mislabel as percent; that would be materially wrong and could imply a guarantee.
5. WTC-safe Tortila reads intentionally exclude `/api/marks`; exact mark price, unrealized PnL, and some open-risk claims remain unavailable from the safe path.
6. Provider source contains TP and margin mitigation code, but WTC warnings should not clear until journal health/contract fields and acceptance proof exist.

## Verification/tests
1. Ran read-only source inspection only: `git status --short --branch`, `rg`, `rg --files`, `Get-Content`, and `Test-Path`.
2. Confirmed target handoff path did not exist before writing.
3. Did not run product tests, typecheck, lint, build, Playwright, worker ticks, DB reads/writes, provider HTTP probes, exchange calls, live server checks, SSH, tmux, systemd, or env/secret inspection because this was an explicitly read-only source audit.
4. Did not inspect `.env`, secret files, live DBs, adjacent SQLite/WAL files, logs, provider endpoints, screenshots, or live services.

## Next actions
1. Update Tortila strategy-map copy to use the safe labels and avoid the unsafe phrases above.
2. Add static copy tests that ban "running config", "synced", "applied", "connection verified", "exchange test passed", "will open", "TP guaranteed/protected", and live-control function names from user-facing Tortila settings/setup surfaces except in explicit negative guardrails.
3. Centralize forbidden bot config/runtime key aliases so `exchangeApply`, `exchangeOrder`, and `liveControl` are blocked consistently across form actions, persisted config, repository guard, admin actions, export, and runtime sanitizer.
4. Define a separate provider current-runtime config JSON contract before any "current live config" or draft-vs-runtime diff claim.
5. Keep live start/stop/apply/retest/exchange-ping work in a separate phase requiring security plus bot-integration approval, entitlement checks, audit logging, and no-secret proof.
