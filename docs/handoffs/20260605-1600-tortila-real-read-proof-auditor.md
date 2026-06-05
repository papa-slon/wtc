# tortila-real-read-proof-auditor handoff

## Scope

Read-only Phase 4.58 audit of the WTC Tortila adapter, worker, tests, and nearby local Tortila artifacts under `C:\Users\maxib\GTE BOT\bot_tortila`. The goal was to identify the safest next non-looping implementation that proves a read-only Tortila source path without `/api/marks`, live bot start/stop/apply-config, exchange/provider calls, or secret printing.

No code was edited. No live service was started. No `/api/marks`, `/api/overview`, exchange/provider, bot control, or journal HTTP call was run. Secret values, DSNs, and raw row payloads are intentionally omitted from this handoff.

## Files inspected

- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- `docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\README.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\cli.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\config.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\conftest.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` schema and counts only; no raw payloads.
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\database.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\config.ini` field presence only; secret values omitted.

## Files changed

- `docs/handoffs/20260605-1600-tortila-real-read-proof-auditor.md` only.

## Findings

1. P0 - The local WTC managed-DB/browser/worker loop is already green; repeating it will not close the real Tortila source gate. Evidence: `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:75` reports current-user Tortila DB route proof green with no `/api/marks` or marker leaks; `:77` reports worker continuity green in a disposable DB; `:81`, `:117`, `:119`, and `:127` keep the remaining blocker on an external/live/source proof with `sourceAdapter=tortila`, `readState=ok`, redaction, no `/api/marks`, and no live bot control. Recommendation: stop looping on local UI/DB proof and implement a deliberately scoped read-only source proof. Target part: Phase 4.58 implementation plan.

2. P0 - The WTC HTTP Tortila adapter is safety-oriented, but the current journal HTTP surface is not the safest first real-read proof path without extra hardening. Evidence: `packages/bot-adapters/src/http.ts:8` to `:10` states the adapter must not call `/api/marks`, exchange endpoints, SSH, tmux, or controls; `:41` to `:50` uses GET with optional bearer auth and avoids logging/returning the token; `:75` to `:88` only maps `/api/health`, `/api/summary`, `/api/trades/list`, and `/api/equity`; `packages/bot-adapters/src/control.ts:1` to `:10` hard-disables live control. However, `docs/CONTRACTS/tortila-adapter.md:33` to `:45` says the journal still lacks auth middleware and needs firewall restriction, `:249` to `:255` permanently excludes `/api/marks` because it calls BingX, and `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:705` to `:717` exposes `/api/marks` while `:845` to `:905` exposes `/api/overview` that bundles mark fetching. Recommendation: do not use public journal HTTP for the next proof unless a strict endpoint allowlist, token gate, and no-`/api/overview` rule are added first. Target part: Tortila source proof transport choice.

3. P0 - The worker already has the right persistence seam for a real Tortila source proof, including `sourceAdapter` and read-state handling. Evidence: `apps/worker/src/jobs.ts:97` to `:113` defines the read-only Tortila snapshot collector; `:120` to `:127` sets `sourceAdapter` based on real vs mock mode; `:134` to `:148` records non-green health as health-only/skipped; `:190` to `:251` writes metrics, position, trade, and equity snapshots/imports. `apps/worker/src/index.ts:266` to `:317` wires journal URL, owner, instance, adapter mode, and read token into the worker and records `not_configured` instead of faking green when configuration is missing. Recommendation: the next proof should feed this existing worker snapshot path or an adjacent one-shot job, not create a separate one-file prototype. Target part: worker integration.

4. P1 - The modern local Tortila SQLite DB is the safest nearby real artifact, but it must be opened through a read-only SQLite path rather than through Tortila runtime classes. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py:32` to `:44` defines `positions`, `:76` to `:89` defines `trades`, `:132` to `:137` defines `equity_log` and `bot_state`, and `:178` to `:186` opens SQLite with WAL and migrations through `Store`. `C:\Users\maxib\GTE BOT\bot_tortila\README.md:64` to `:67` and `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\cli.py:43` to `:57`, `:60` to `:72`, `:79` to `:90`, and `:147` to `:151` show CLI paths that construct exchange/runtime components for run/status/reconcile. Recommendation: implement an opt-in WTC read-only SQLite source reader using a `file:<path>?mode=ro&immutable=1` style connection or a copied read-only fixture, with allowlisted columns only. Do not instantiate Tortila `Store` against the real DB for proof because it can initialize/migrate/write. Target part: source reader.

5. P1 - The current local `turtle_bot.db` can prove an equity-only read path, not full position/trade import. Evidence from a read-only schema/count probe only: tables include `bot_state`, `decisions`, `equity_log`, `funding_payments`, `orders`, `positions`, `safety_events`, `trades`, and `unit_fills`; row counts show `equity_log=16` and `bot_state=4`, with `positions=0`, `trades=0`, `orders=0`, `funding_payments=0`, `decisions=0`, `safety_events=0`, and `unit_fills=0`. No raw rows were printed. Recommendation: pair the current DB equity proof with a seeded fixture SQLite DB for idempotent positions/trades/import tests, or obtain an approved richer Tortila artifact before claiming full closed-trade/open-position proof. Target part: proof data selection.

6. P0 - `_old_bot_source` must remain out of bounds for implementation input because it contains secret-bearing config/model surfaces. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\config.ini:24` to `:26` contains API key/secret fields with plaintext values omitted here; `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:91` to `:102` models `Api_Key` with secret-bearing fields, and `:503` to `:516` reads keys/secrets. `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\database.py:16` to `:22` builds a DB URL from environment fields. Recommendation: use old source only as high-level schema/background reference, never as a source proof input and never in tests/fixtures/logs. Target part: source boundaries and secret hygiene.

7. P1 - Mapping semantics are already defined; the source proof should reuse them instead of inventing new analytics. Evidence: `packages/bot-adapters/src/tortila/tortila.schemas.ts:51` to `:64` documents signed `net_pnl_with_fees`, fees, and funding; `:87` to `:90` prefers `/api/trades/list` because `/api/trades` omits `fees_pnl`; `packages/bot-adapters/src/tortila/tortila.mapping.ts:7` to `:16` documents sign rules and no `/api/marks`; `:84` to `:89` maps metrics; `:125` to `:142` maps trades; `:151` to `:174` maps open positions with mark/uPnL unavailable without marks. Recommendation: route SQLite-derived rows through equivalent canonical mapping and keep mark/uPnL as unavailable or explicitly derived from non-mark sources only. Target part: adapter mapping/tests.

## Decisions

1. Safest next non-looping implementation: build an opt-in Tortila SQLite read-only source proof harness/adapter and worker test path, not another local managed-DB UI loop and not an unauthenticated public journal HTTP proof.

2. The implementation should accept an explicit source path and enable flag such as `TORTILA_SQLITE_DB_PATH` plus `TORTILA_SQLITE_READS_ENABLED=1`, then open SQLite in strict read-only mode. It should read only allowlisted columns from `equity_log`, `trades`, `positions`, and safe `bot_state` keys, and should print counts/hashes/status only.

3. The acceptance proof should record `readState=ok`, an agreed source adapter identity, idempotent WTC import behavior, and redacted output. If Phase 4.57 acceptance requires `sourceAdapter=tortila`, use that for the accepted real source path and include source-kind metadata such as `sqlite-readonly` without raw rows. If the team chooses `sourceAdapter=tortila-sqlite` as an interim identity, it must not be misrepresented as satisfying the previous `sourceAdapter=tortila` wording.

4. The current local `turtle_bot.db` should be treated as an equity-only real artifact. Full closed-trade/open-position import proof requires a seeded fixture DB or an approved richer source artifact.

5. Journal HTTP can be a later proof lane only after endpoint allowlisting, read-token enforcement, and network exposure controls are in place. `/api/overview` is excluded for now because it can fetch marks; `/api/marks` remains permanently excluded.

## Risks

1. Using Tortila `Store` or CLI commands against the real DB can mutate schema/runtime state or construct exchange clients, violating read-only scope.

2. Claiming a full Tortila source proof from the current local DB would be overstated because positions and trades are empty in the inspected DB.

3. Starting the journal on its default host/port before auth/firewall work risks exposing unsafe routes, including `/api/marks`.

4. Reading `_old_bot_source` fixtures/configs directly risks secret leakage and accidental reliance on legacy/live-provider semantics.

5. Source adapter naming must be decided before acceptance. A distinct `tortila-sqlite` identity is more explicit, but Phase 4.57 wording asked for `sourceAdapter=tortila`; this should be resolved before final gate language.

## Verification/tests

Run this session:

1. Read-only static inspection of WTC adapter, worker, tests, and handoffs.
2. Read-only static inspection of nearby Tortila source, journal, CLI, store, tests, and old-source schema/config surfaces.
3. Read-only SQLite schema/count probe of `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db`; only table names and row counts were inspected.

Not run this session:

1. No code tests, because this was an audit-only lane with no code edits.
2. No worker run, because the purpose was to select the next implementation, not mutate proof state.
3. No browser run.
4. No journal HTTP server start.
5. No `/api/marks` or `/api/overview` call.
6. No exchange/provider call.
7. No live bot start/stop/apply-config.
8. No secret scan with raw output, to avoid printing secret-bearing artifacts from adjacent local source.

Recommended gates for the next implementation:

1. New SQLite reader unit tests with a seeded fixture DB covering equity, closed trades, open positions, fee/funding signs, and empty-table behavior.
2. Worker integration test that imports fixture SQLite data into WTC snapshots/imports with idempotency and `readState=ok`.
3. Current local DB smoke proof that reports equity-only counts/status without raw rows.
4. Static guard test proving the new path contains no `/api/marks`, no `/api/overview`, no `BingXClient`, no `ccxt`, no `fetch(`, no child process/tmux/SSH, and no `_old_bot_source/config.ini` reads.
5. Redaction test proving source paths, row samples, tokens, DSNs, and secrets are not printed in proof output.

Suggested focused commands after implementation:

```powershell
npx vitest run packages/bot-adapters/src/__tests__/tortila-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts <new-tortila-sqlite-proof-test>
npm run typecheck -w @wtc/worker
npm run secret:scan
git diff --check
```

## Next actions

1. Implement a small WTC-owned Tortila SQLite read-only source reader in a package, not in React and not as a one-file prototype.

2. Add a worker one-shot/proof mode that can consume that reader with explicit env gates and write canonical snapshots/imports while printing only redacted counts/status.

3. Seed a synthetic fixture SQLite DB in tests for full metrics/trade/position coverage, and separately run an honest current-DB smoke proof that is allowed to prove only equity availability unless a richer artifact is approved.

4. Add static safety guards for forbidden routes, provider/exchange imports, child-process control, old-source config reads, and raw secret printing.

5. Only after the SQLite proof is green should the team decide whether to harden the HTTP journal lane with token enforcement, endpoint allowlisting, and firewall restrictions.
