# Handoff: ecosystem-bot-integration-auditor — Phase 0

**Date:** 2026-05-29
**Agent:** ecosystem-bot-integration-auditor
**Phase:** 0 — documentation only, no live control, no live writes

---

## Scope

Audit the two existing bots (Tortila and Legacy) read-only, design adapter interfaces,
document control safety model, define canonical analytics model, and produce contract
documents for both adapters. All as required by `docs/handoffs/0000-orchestrator-seed.md`
under the `bot-integration-auditor` ownership block.

---

## Files Inspected (Read-Only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions, locked stack, schema group names |
| `bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Full product spec |
| `bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Architecture constraints |
| `bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Live server topology snapshot |
| `bot_tortila/src/turtle_bot/journal/app.py` | All Tortila journal endpoints + response shapes |
| `bot_tortila/src/turtle_bot/journal/metrics.py` | All Tortila metrics computations |
| `bot_tortila/src/turtle_bot/state/models.py` | Tortila Pydantic models (PositionRow, TradeRow, etc.) |
| `bot_tortila/src/turtle_bot/config.py` | Tortila Settings, PerSymbolConfig, parse_symbol_configs |
| `bot_tortila/_old_bot_source/models.py` | Legacy bot ORM models (User, Api_Key, SymbolSettings, etc.) |
| `bot_tortila/_old_bot_source/app.py` | Legacy bot FastAPI startup, routes |
| `bot_tortila/_old_bot_source/sqlalchemy_enums.py` | Legacy bot enums (MarketEnum, ReasonEnum, etc.) |

No SSH, no live server interaction, no file writes to bot repositories.

---

## Files Changed (Written)

| File | Description |
|---|---|
| `docs/BOT_INTEGRATION_PLAN.md` | BotAdapter TypeScript interface, per-bot endpoint mapping, mock adapter plan, snapshot import rules |
| `docs/BOT_CONTROL_SAFETY_MODEL.md` | Explicit prohibitions, "stop bot ≠ close positions", required gates before any live control |
| `docs/CANONICAL_ANALYTICS_MODEL.md` | Full normalized metric set with precise definitions, availability matrix, anti-misleading display rules |
| `docs/CONTRACTS/tortila-adapter.md` | Tortila contract: owner, auth, endpoints, Zod schemas, error envelope, rate limits, timeouts, tests |
| `docs/CONTRACTS/legacy-bot-adapter.md` | Legacy bot contract: owner, auth, endpoints, Zod schemas, critical security issue, tests |
| `docs/handoffs/20260529-phase0-bot-integration-auditor.md` | This handoff |

---

## Findings

### Tortila Bot

1. **Journal API is rich and well-structured.** The FastAPI journal at `:8080` exposes all data
   needed for a production analytics dashboard: equity curves, closed trades (paginated, filtered),
   advanced metrics (Sharpe/Sortino/Calmar), drawdown stats, per-symbol breakdown, monthly P&L,
   calendar heatmap, distribution, and a combined `/api/overview` bundle for efficient polling.

2. **P0 Open Item: TP reconciliation.** The bot does not restore TP orders after restart.
   This is a live-account risk. The WTC adapter hard-codes a warning for this and will not
   auto-clear it until a signal from the journal confirms resolution.

3. **P1 Open Item: Margin pre-flight.** The bot does not check available margin before
   opening positions. Visible in discovery logs (LINK position add blocked).

4. **Error codes in logs:** `101211` (NEAR TP rejection), `100410` (rate-limit/funding), `109421`
   (order not found), and exchange-flat mismatch events are all real operational signals.
   These are surfaced as first-class warnings by the adapter, not hidden.

5. **Config not accessible as JSON.** The journal reads config from env at startup.
   The `/config` route is HTML only. WTC will need a `GET /api/config` JSON endpoint from
   Tortila before the real adapter can expose config without HTML scraping.

6. **No auth on journal.** The journal at `:8080` has no authentication. Must be added
   before production WTC deployment. Network boundary must also be restricted.

7. **Zero-equity points.** The journal initializes equity snapshots at `equity = 0`. The
   existing `_valid_equity_rows()` function filters them — WTC normalizer must do the same.

### Legacy Bot

8. **No closed trade history.** The legacy bot's API (`/api_management/*`) exposes
   current bot state (slots, orders, settings) but no closed trade history. PnL, win rate,
   drawdown, and performance metrics are unavailable. This is a fundamental analytics gap.

9. **Plaintext exchange keys in API response.** `GET /api_management/{api_id}` returns
   the exchange `api_key` and `secret_key` fields in plaintext. This is a security issue.
   WTC adapter must redact immediately after parsing. Legacy bot must fix this before production.

10. **No equity curve.** The legacy bot does not record wallet equity over time. No equity
    chart is possible without adding this capability.

11. **No health endpoint.** The legacy bot has no dedicated health route. WTC derives
    "running" from a successful 200 response on the management endpoint.

12. **Slot ≠ confirmed exchange position.** Active slots represent bot intent, not confirmed
    exchange state. Position display from the legacy bot adapter must carry a disclaimer.

---

## Decisions

| Decision | Rationale |
|---|---|
| All controls (`startBot`, `stopBot`, `applyConfig`) disabled at adapter level | Matches hard rule in orchestrator seed. Gate is explicit in safety model. |
| Mock adapter is the default — `BOT_ADAPTER_MODE=mock` | Prevents accidental real connections in dev |
| Zero-equity points filtered before DB storage | Tortila journal already does this; WTC must match |
| `null` not `0` for unavailable metrics | Prevents misleading "0% win rate" display for legacy bot |
| Legacy exchange keys redacted in Zod parse step | Security non-negotiable; keys must never exit the adapter |
| Tortila P0/P1 warnings hard-coded in adapter, not user-dismissable | Discovery requirement: "never hide behind green card" |
| `BOT_CONTROL_ENABLED=true` feature flag required before any control | Defense in depth; flag must not exist in dev |
| Service account (not user account) for legacy bot auth | User accounts are personal; WTC needs a stable read-only credential |

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Tortila journal has no auth | P0 | Must add token auth before production. Flagged in contract doc. |
| Legacy bot exposes exchange keys in API | P0 | Adapter redacts immediately. Flagged for legacy bot team remediation. |
| Port 8080 and 8000 are `0.0.0.0` with no nginx proxy | P0 | Must restrict to WTC server IP before production connection |
| Tortila config not accessible as JSON | P1 | Need `GET /api/config` endpoint. Documented as open item in contract. |
| Legacy bot has no trade history | P1 | Analytics gap documented. UI shows N/A. Legacy team must add history endpoint. |
| Legacy bot has no equity curve | P2 | Wallet balance only. Not enough for performance comparison. Documented. |
| Tortila P0 TP reconciliation unresolved | P0 (live risk) | Surfaced as persistent error-level warning. Operator must acknowledge. |
| Adapter schema changes break WTC silently | P1 | Zod parse errors trigger `degraded` state, not silent failure |

---

## Tests / Verification

Phase 0 produces documentation only. No tests can be run yet (no code written).

Test requirements are specified in each contract doc:
- `docs/CONTRACTS/tortila-adapter.md` §"Required Tests Before Production Wiring" — 16 unit tests, 3 integration, 5 Playwright
- `docs/CONTRACTS/legacy-bot-adapter.md` §"Required Tests Before Production Wiring" — 14 unit tests, 3 integration, 4 Playwright

Before any test can run, the implementer must:
1. Scaffold `packages/bot-adapters/` with the structure defined in `BOT_INTEGRATION_PLAN.md`.
2. Create mock fixtures in `__fixtures__/tortila.ts` and `__fixtures__/legacy.ts`.
3. Implement the Zod schemas in `tortila.schemas.ts` and `legacy.schemas.ts`.
4. Implement the normalizer in `normalizer.ts` with the null-vs-zero rules.

---

## Next Actions

| Action | Owner | Priority |
|---|---|---|
| Scaffold `packages/bot-adapters/` directory structure | ecosystem-backend-implementer | P0 |
| Implement Zod schemas for Tortila journal endpoints | ecosystem-backend-implementer | P0 |
| Implement `TortilaMockAdapter` with fixture data | ecosystem-backend-implementer | P0 |
| Implement `LegacyMockAdapter` with fixture data | ecosystem-backend-implementer | P0 |
| Implement `normalizer.ts` with null-vs-zero and equity filter rules | ecosystem-backend-implementer | P0 |
| Write unit tests for both adapters | ecosystem-tests-runner | P1 |
| Add `GET /api/config` JSON endpoint to Tortila journal | Tortila bot team | P1 |
| Add API token auth to Tortila journal | Tortila bot team | P0 (before prod) |
| Remove plaintext keys from legacy bot API responses | Legacy bot team | P0 (before prod) |
| Restrict ports 8080 and 8000 to WTC server IP | DevOps | P0 (before prod) |
| Create service account on legacy bot for WTC | Operator | P1 (before staging) |
| Implement `apps/worker` snapshot job | ecosystem-backend-implementer | P1 |
| Resolve Tortila P0 TP reconciliation | Tortila bot team | P0 (live risk) |
