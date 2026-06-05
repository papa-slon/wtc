# source-artifact-discovery-auditor handoff
## Scope
Phase 4.57 read-only Legacy/Tortila source artifact discovery audit. Search the current WTC workspace plus accessible nearby local `C:\Users\maxib\GTE BOT` folders for demo/test/source artifacts that could unblock:

- `LEGACY_SOURCE_ARTIFACT` for provider-scoped closed-trade/fill proof.
- Tortila real-read or journal proof inputs that can prove `sourceAdapter=tortila` and `readState=ok` without `/api/marks`.

Safety boundaries followed: no code implementation, no import, no live probes, no exchange/provider calls, no `/api/marks`, no bot start/stop/apply-config, no deploy, no DB mutation, and no secret/raw payload printing. Local demo/test artifacts were inspected only by path, field names, schema, counts, and redacted summaries.

Protocol note: this was executed as the single named read-only auditor handoff requested by the operator. No multi-agent audit is claimed, and no aggregate phase handoff was written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/bot-adapters/src/__fixtures__/tortila/health.valid.json` (keys only)
- `packages/bot-adapters/src/__fixtures__/tortila/summary.valid.json` (keys only)
- `packages/bot-adapters/src/__fixtures__/tortila/equity.valid.json` (keys only)
- `packages/bot-adapters/src/__fixtures__/tortila/trades_list.valid.json` (keys only)
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot\seed_data.json` (keys/setting fields only)
- `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` (SQLite table names, schemas, row counts only)
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\conftest.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_codex_audit_fixes.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_tp_flow.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\backtest\test_engine_v2.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\old_bot_backtest\results\portfolio_summary.json` (path only)
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\storage\trades\*/...` (paths only; image payloads not opened)

## Files changed
None — read-only audit

## Findings
1. Severity: P0. Classification: VALID_SOURCE_CANDIDATE for Tortila read-side source shape, but INSUFFICIENT for completed Tortila real-read acceptance until a read-only journal run proves `sourceAdapter=tortila` and `readState=ok`. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` exists and contains source-state tables `bot_state`, `equity_log`, `funding_payments`, `orders`, `positions`, `trades`, `unit_fills`, `decisions`, and `safety_events`; schema inspection found `trades` fields `id`, `symbol`, `side`, `units`, `avg_entry`, `exit_price`, `realized_pnl`, `opened_at`, `closed_at`, `exit_reason`, `funding_pnl`, `fees_pnl`; `unit_fills` includes `client_order_id`, `exchange_order_id`, `filled_at`, and `fee_paid`. Counts observed: `equity_log=16`, `trades=0`, `positions=0`, `orders=0`, `funding_payments=0`, `safety_events=0`. Code evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:58-73` defines `TradeRow` with realized PnL, timestamps, exit reason, funding, and fees; `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py:433-475` inserts/lists those fields. Recommendation: target Tortila read proof by using this local DB as a demo/source-backed journal input only in a separate read-only harness; do not claim trade import because current local `trades` rows are zero.

2. Severity: P0. Classification: VALID_SOURCE_CANDIDATE for Tortila journal endpoint contract, but must exclude `/api/marks`. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:572-580` exposes `/api/health` and `/api/summary` from `Store.list_trades/list_equity/list_open_positions/list_funding`; `:626-642` exposes `/api/equity` and `/api/trades`; `:775-789` exposes `/api/trades/list`; `:705-708` defines `/api/marks`, but WTC docs and adapter code forbid consuming it. WTC adapter evidence: `packages/bot-adapters/src/tortila/tortila.schemas.ts:13` says WTC must not call `/api/marks`; `packages/bot-adapters/src/tortila/tortila.mapping.ts:16` repeats the hard exclusion; `apps/worker/src/jobs.ts:127-151` sets `sourceAdapter` to `tortila` only for real adapter mode and carries `readState`. Recommendation: if audited further, use only `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; add network interception or static assertion that `/api/marks` is not requested. Target part: Tortila real-read/journal proof.

3. Severity: P1. Classification: DEMO_FIXTURE_ONLY. Evidence: WTC fixture files under `packages/bot-adapters/src/__fixtures__/tortila/` include `health.valid.json`, `summary.valid.json`, `equity.valid.json`, and `trades_list.valid.json`; key-only inspection found `trades_list.valid.json` has `rows` with fields `id`, `symbol`, `side`, `units`, `qty`, `entry`, `exit`, `gross_pnl`, `fees_pnl`, `funding_pnl`, `net_pnl`, `opened_at`, `closed_at`, `hold_hours`, `exit_reason`, and `ret_pct`; `summary.valid.json` has aggregate keys including `trades_total`, `net_pnl_with_fees`, `fees_total`, `funding_total`, `open_position_summaries`, and `mode`. Test evidence: `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts:55-63` parses health fixture; `:189-230` guards fee sign/realized PnL/qty mapping; `:459-467` proves fixture health maps to `readState='ok'`. Recommendation: keep these as mapper regression fixtures, not proof of a real Tortila source read. Target part: Tortila mapping tests.

4. Severity: P0. Classification: INSUFFICIENT for `LEGACY_SOURCE_ARTIFACT`. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:107-120` defines `Order` with `order_id`, order type, position side, side, note, price, quantity, `api_id`, `system_id`, `reason`, `stage`, and `active`; `:176-184` defines `Slot` lifecycle; `:526-532` inserts orders. The same inspected Legacy folder has `seed_data.json` settings/stage examples and symbol settings, but no proven closed-trade/fill table with realized PnL, fees/funding, opened/closed timestamps, exit reason, raw allowlist, or replay semantics. Recommendation: do not use Legacy `orders`, `slots`, settings, or seed data as closed-trade proof. Target part: Legacy source artifact gate.

5. Severity: P0. Classification: INSUFFICIENT for `LEGACY_SOURCE_ARTIFACT`. Evidence: existing WTC phase docs still require a source artifact naming stable trade id, mapped provider scope/filter, symbol, side, size, entry/exit, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and raw payload allowlist; `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:85-89` names mandatory mapper/replay fields; `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md:90` keeps Legacy source/import NOT RUN because `LEGACY_SOURCE_ARTIFACT` is absent. The local Legacy folder search found no `.db`, `.sqlite`, `.csv`, or `.json` artifact containing closed-trade rows; only source, settings, and order/slot state were found. Recommendation: maintain blocked status unless a new artifact outside these inspected files is supplied. Target part: Legacy closed-trade import.

6. Severity: P1. Classification: WRONG_PRODUCT for Legacy/Tortila source proof. Evidence: `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:40-43` defines trade sources as `telegram`, `terminal`, and `manual`; `:78-128` defines Axioma/GTE journal trade fields including `asset`, `side`, exchange context, `decision_at`, `closed_at`, `result_r`, `pnl_amount`, and `pnl_percent`; `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py:51-74` defines terminal `CanonicalTradeRecord` with local UUID, source `terminal`, symbol, exchange context, entry/exit, qty, PnL, and fees; `docs/canonical_trade_contract_v1.md:94-99` says terminal `trade_id` is not sent and server assigns its own id; `:122-125` says bot-created rows still do not send exchange context, decision/closed times, or PnL fields. Recommendation: do not treat GTE/Axioma manual/terminal journal rows, screenshots, or trade ids as Legacy bot closed-trade/fill source or Tortila journal proof. Target part: wrong-product artifact filtering.

7. Severity: P1. Classification: DEMO_FIXTURE_ONLY or WRONG_PRODUCT for backtest artifacts. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\backtest\data\*.csv`, `backtest/results/*.json`, and `old_bot_backtest/results/portfolio_summary.json` are backtest/market-data/result artifacts; `C:\Users\maxib\GTE BOT\bot_tortila\tests\backtest\test_engine_v2.py:119-139` constructs synthetic trade expectations and exit reasons; `:230-262` compares intrabar vs close-mode TP fills. Recommendation: useful for strategy/backtester validation only; not a real Tortila journal read, not Legacy source proof, and not a provider-scoped replay source. Target part: artifact classification.

8. Severity: P1. Classification: DEMO_FIXTURE_ONLY for Tortila unit tests. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\tests\conftest.py:74-87` stubs exchange calls; `tests/test_codex_audit_fixes.py:41-46` constructs in-memory trade rows; `tests/test_tp_flow.py:483-514` seeds synthetic order rows and fake filled stop responses. Recommendation: keep these as behavior/unit fixtures; do not use them to prove real `sourceAdapter=tortila` reads. Target part: Tortila test fixture boundary.

## Decisions
1. No `LEGACY_SOURCE_ARTIFACT` was found in the inspected local workspace or nearby folders. Legacy remains source-blocked.
2. `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` plus `bot_tortila` journal source code is the best Tortila source candidate found, but its current local data has no closed trades and no WTC `readState=ok` proof was run this session.
3. WTC Tortila JSON fixtures are mapper/regression fixtures only. They can prove parsing/mapping and fixture-level `readState='ok'`, but not a real source read.
4. GTE/Axioma journal artifacts are wrong-product for Legacy/Tortila source proof.
5. No raw payloads, secret values, tokens, passwords, cookies, exchange keys, DSNs, or row payloads were printed.

## Risks
1. Running a local Tortila journal server against `turtle_bot.db` may still execute app startup code; the next phase must ensure it stays local/read-only and does not start the bot engine, exchange client, live marks, or provider calls.
2. `C:\Users\maxib\GTE BOT\bot_tortila\.env` exists but was not opened or printed; any future harness must avoid echoing env values and should use test-only redacted env.
3. The current `turtle_bot.db` has zero closed trades, so it may prove health/equity/read wiring but not trade import unless another local/demo DB or redacted export with `trades` rows is supplied.
4. GTE/Axioma storage screenshots and terminal logs may contain sensitive visual/user context; they were not opened and should not be copied into WTC evidence without a separate redaction pass.
5. Legacy `orders` can look tempting because they have order ids and quantities, but they do not prove closed fills, realized PnL, fees/funding, or replay-safe trade identity.

## Verification/tests
Ran read-only inspections only:

1. `git status --short --branch` - RUN; branch is `codex/bot-analytics-settings-canary-20260603` with extensive pre-existing dirty/untracked files.
2. Protocol/doc read - RUN for `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/next-actions/implemented-files/latest handoffs.
3. Workspace file discovery - RUN with `rg --files` and `Get-ChildItem` over WTC and nearby `C:\Users\maxib\GTE BOT` folders.
4. Keyword/schema search - RUN with `rg` / `Select-String` for source-proof, Legacy closed-trade, Tortila readState/sourceAdapter, journal/trade/fill/schema fields.
5. SQLite schema/count inspection - RUN via Python stdlib `sqlite3` because `sqlite3` CLI is unavailable; inspected only table names, schema, and counts for `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db`.

Gates NOT RUN:

1. `npm test`, typecheck, lint, build, Playwright, governance, secret scan - NOT RUN; this was a read-only artifact discovery audit, not a code/test phase.
2. Managed DB runners - NOT RUN; no managed DB env was supplied and DB mutation is out of scope.
3. Tortila journal server/API calls - NOT RUN; live/local probes were forbidden in this task.
4. `/api/marks` - NOT RUN; prohibited and excluded.
5. Legacy import/source mapper - NOT RUN; no valid Legacy source artifact found.
6. Exchange/provider calls, live bot start/stop/apply-config, deploy, CI, DB migrations/seeds/mutations - NOT RUN; prohibited or separate phases.

## Next actions
1. If the operator wants to audit the Tortila source candidate further, run a separate read-only local harness phase that copies `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` to a temp file, starts only the Tortila journal app against the temp copy, sets WTC to read-only Tortila adapter mode against localhost, intercepts/fails `/api/marks`, and proves `sourceAdapter=tortila`, `readState=ok`, `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list` behavior. Do not run the engine, exchange client, or live bot services.
2. Before any Tortila trade-import proof, supply a local/redacted Tortila DB or export with nonzero `trades` rows; current `turtle_bot.db` has `trades=0`.
3. For Legacy, request or locate a real `LEGACY_SOURCE_ARTIFACT` that names a closed-trade/fill table/API and required fields: stable trade id, provider scope/filter, symbol, side, size, entry/exit, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and raw allowlist.
4. Reject the following as Legacy source substitutes: `C:\Users\maxib\GTE BOT\bot` settings/orders/slots/seed data, Tortila/Turtle journal rows, GTE/Axioma manual/terminal journal rows, screenshots, terminal logs, and backtest result JSON/CSV.
5. Suggested read-only follow-up commands, to be run only in a new approved phase:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"

# Re-check Tortila local DB shape without row payloads.
@'
import sqlite3
from pathlib import Path
p = Path(r"C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db")
con = sqlite3.connect(p)
cur = con.cursor()
for (name,) in cur.execute("select name from sqlite_master where type='table' order by name"):
    print(name, cur.execute(f'select count(*) from "{name}"').fetchone()[0])
con.close()
'@ | python -

# Re-scan Legacy source-only fields without secrets/raw payloads.
rg -n "class Order|class Slot|realized_pnl|fees_pnl|funding_pnl|closed_at|exit_reason|fill|trade_id" "C:\Users\maxib\GTE BOT\bot" "C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source"
```
