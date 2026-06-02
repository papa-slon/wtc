# Handoff: ecosystem-backtester-architect — Phase 0

**Date:** 2026-05-29  
**Agent:** ecosystem-backtester-architect  
**Phase:** 0 — Documentation  

---

## Scope

Design and document the WTC backtester subsystem: distribution model, job lifecycle, artifact schema, visualization model, database schema, package surface, and the machine-to-machine contract between the local runner CLI and the WTC platform.

---

## Files inspected (read-only)

| File | Purpose |
|------|---------|
| `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform/docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions, stack, naming, schema groups, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Product requirements, backtester UX requirements |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Monorepo structure, `packages/backtester` placement |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Discovery snapshot |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/engine.py` | Tortila Turtle engine — `BacktestConfig`, `TradeRecord`, `BacktestResult`, `run_backtest`, `summarise` |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/sweep.py` | Parameter sweep shape — symbols, timeframes, sweep grid |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/deep_dive_v2.py` | Portfolio DD aggregation, monthly PnL, annualised return |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/download_data.py` | OHLCV download via ccxt BingX/Binance public endpoints |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/smalltf_sweep.py` | Multi-timeframe (1m/5m/15m/1h/4h) sweep structure |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/results/per_symbol.json` | Real result artifact shape |
| `C:/Users/maxib/GTE BOT/bot_tortila/backtest/results/deep_dive_v2.json` | Portfolio-level artifact shape with monthly PnL |
| `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/dca_engine.py` | Legacy DCA engine — `SymbolConfig`, `BacktestConfig`, `ClosedTrade`, `OpenAtEnd`, `BacktestResult`, `run_portfolio_backtest` |
| `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/run.py` | Legacy DCA runner shape, output format |

---

## Files written

| File | Description |
|------|-------------|
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Full distribution plan: user flow, job state machine, form params, local runner package design, artifact schemas (tortila/v1, legacy_dca/v1), DB schema, `packages/backtester` TypeScript surface, visualization model, API route table, live-trading separation controls, rate limits, future extensions |
| `docs/CONTRACTS/backtester-runner.md` | Machine-to-machine contract: all runner-facing endpoints, auth (HMAC upload token), request/response schemas (Zod), error envelope, idempotency matrix, rate limits, timeouts, mock vs real status table, security requirements, required test checklist (unit + integration + E2E + runner CLI), versioning policy, observability events |

---

## Findings

1. **Two distinct engines exist** — not one. The Tortila engine (`backtest/engine.py`) is a Turtle breakout strategy (Donchian/ATR, multi-unit pyramid, stop+exit signals). The Legacy engine (`old_bot_backtest/dca_engine.py`) is a DCA ladder strategy (RSI/CCI crossunder, 3 averaging levels, TP-only exit, no stop loss). Both engines must have separate param schemas, artifact schemas, and runner modules.

2. **Legacy DCA has a structural honesty risk** — the DCA strategy produces positions that never close if price does not recover. The old runner already surfaces this as "positions still OPEN at end of backtest." The platform must display a mandatory, non-dismissable warning for any DCA artifact with `open_at_end.length > 0`. This is documented in the visualization model.

3. **Data download uses public endpoints only** — BingX OHLCV data is available on public endpoints (no API keys). The `download_data.py` script uses ccxt with `enableRateLimit: true` and no credentials. The runner distribution can include this safely.

4. **Artifact schema is derivable from real result JSON** — the `deep_dive_v2.json` and `per_symbol.json` files gave concrete field names, types, and value ranges. The artifact schemas in the plan are grounded in actual engine output, not invented.

5. **No in-browser compute is currently planned or needed** — the existing engines are Python (numpy/pandas) and not suitable for WASM porting at MVP. The local runner distribution model is the correct approach.

---

## Decisions

1. **Local runner distribution** (not server-side compute, not WASM). Web tier creates jobs, distributes runner, receives artifacts. This is the only approach that satisfies the "no heavy backtests on web tier" rule.

2. **HMAC-SHA256 upload token** (not session cookie) for runner-to-platform auth. Scoped to `{job_id, user_id, exp}`. TTL = 7 days. Stored as bcrypt hash; never logged.

3. **Artifact immutability**: once uploaded, an artifact cannot be modified. A second upload with a different body → 409. Re-run requires a new job.

4. **Config re-validation on upload**: platform re-validates that `artifact.config` matches `BacktestJob.params` at upload time, not just at job creation. Prevents local runner modification to produce results under different params than submitted.

5. **Two artifact schema versions**: `tortila/v1` and `legacy_dca/v1`. These are kept separate — no attempt to unify into a generic schema, as the strategies are fundamentally different.

6. **Backtest tables go in the `Ops` bounded context** (`backtest_jobs`, `backtest_artifacts`) alongside `job_queue` — not in the `Bots` context (which holds live trading state). This enforces the separation from live trading at the schema level.

7. **Artifact storage key is never returned in API responses**. Platform always generates short-lived signed URLs.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Runner packaging complexity (Python env, Windows/macOS/Linux) | P1 | Document clearly; consider PyInstaller binary as Phase 7 option. See OPEN_QUESTIONS. |
| DCA "open at end" positions presenting misleadingly positive metrics | P0 | Mandatory non-dismissable warning in UI (documented in visualization model §10.3) |
| User modifying runner locally to change params before upload | P1 | Config re-validation on upload (§4.4 step 6); platform rejects mismatched config |
| OHLCV data staleness (user downloads once, reruns months later) | P2 | Runner should check data recency and warn if oldest required bar is more than `data_lookback_days + 30` days old |
| Artifact store backend not decided (local fs vs S3) | P1 | Must be resolved before Phase 6; documented as OPEN_QUESTIONS item |
| 50 MB artifact size limit: sweep over 25 symbols × 1080 days may exceed | P2 | Test with maximum params; adjust limit if needed |
| Upload token theft (URL logged by proxy/CDN) | P1 | Token in query param — must ensure CDN/nginx does not log query strings. Alternatively move token to Authorization header; documented as security consideration |

---

## Tests / verification

All tests are **required before production wiring** (Phase 6). They are documented in `CONTRACTS/backtester-runner.md §12`:

- 9 unit tests for `packages/backtester` (token generation/verification, schema validation, idempotency)
- 9 integration tests (full job lifecycle, token expiry, ownership, cascade delete)
- 5 E2E tests (Playwright: locked state, empty state, failed state, chart render, DCA warning)
- 5 runner CLI tests (pytest: dry-run, missing CSV failure, SHA256 header, 409 handling, config round-trip)

No backtest computation is performed in the tests — only the platform API surface and artifact schema validation are tested.

---

## Next actions

1. **backtester-architect / Phase 6:** Scaffold `packages/backtester/` TypeScript package with Zod schemas, job CRUD, token generation, artifact validation. No Python in this package.
2. **devops-implementer:** Decide artifact store backend (local filesystem for dev, S3-compatible for production). Configure env vars.
3. **product-architect:** Decide on OHLCV pre-caching by platform worker vs user-run download step. See OPEN_QUESTIONS.
4. **security-auditor:** Review upload token placement (query param vs Authorization header) for logging risk.
5. **frontend-implementer (Phase 6):** Implement backtester UI at `/app/bots/tortila/backtester` and `/app/bots/legacy/backtester` using the visualization components defined in §10 of the plan. Mock artifact JSON for dev mode must be clearly labeled.
6. **devops-implementer (Phase 7):** Build and sign the runner ZIP. Set up runner release pipeline. Publish `wtc-backtester-1.0.0.zip` to the artifact store.
