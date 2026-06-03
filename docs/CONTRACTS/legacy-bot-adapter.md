# Contract: Legacy Bot Adapter

**Document type:** Integration contract
**Owner:** ecosystem-bot-integration-auditor (WTC side), Legacy bot team (provider side)
**Consumer:** `packages/bot-adapters/LegacyBotAdapter`, `apps/worker` snapshot job
**Status:** Phase 3.68 read-only DB snapshot canary. Direct HTTP/control adapter remains blocked.
**Last updated:** 2026-06-03

Related: [BOT_INTEGRATION_PLAN.md](../BOT_INTEGRATION_PLAN.md),
[BOT_CONTROL_SAFETY_MODEL.md](../BOT_CONTROL_SAFETY_MODEL.md),
[CANONICAL_ANALYTICS_MODEL.md](../CANONICAL_ANALYTICS_MODEL.md),
[SECRET_VAULT_DESIGN.md](../SECRET_VAULT_DESIGN.md)

---

## Parties

| Role | Component | Location |
|---|---|---|
| Provider | Legacy Bot FastAPI | `0.0.0.0:8000` on the bot server |
| Consumer | WTC `apps/worker` (snapshot job) | WTC platform server |
| Interface | `apps/worker/src/legacy-live.ts` snapshot job | Compiled TypeScript |

WTC is a **read-only consumer**. The accepted canary path does not call Legacy HTTP management endpoints
and does not start/stop/retest/apply config. It reads provider Postgres safe columns by existing provider
`pub_id`, writes WTC-owned snapshots, and renders from WTC Postgres.

---

## Auth Method

**Current canary type:** server-side Postgres connection string stored outside the repo.

The worker selects only explicit safe columns from provider tables. It does not select `api_key`,
`secret_key`, or other secret-looking columns, and it rejects selected secret-hint field names before
building WTC snapshots. `pub_id` is the provider account identity.

**Future HTTP adapter type:** JWT Bearer token via username/password login.

**Future HTTP flow (not active in Phase 3.68):**
1. WTC worker holds a service-account credential in the encrypted vault
   (secret type: `legacy_bot_service_account`; fields: `username`, `password`).
2. On startup (or when token expires), worker calls `POST /auth/login` with credentials.
3. Response contains a JWT token.
4. All subsequent requests include `Authorization: Bearer <jwt>`.
5. Token expiry: unknown (not documented in legacy bot source). Adapter assumes 24h
   and refreshes proactively at 20h or on 401 response.

**Service account setup required before production:**
- Create a dedicated read-only service account on the legacy bot (login: `wtc_readonly`).
- Store credentials in WTC vault with `secret_type: legacy_bot_service_account`.
- The service account must not be the same as any user's personal legacy bot account.
- Credentials must never appear in logs, environment variables exposed to UI, or API
  responses (vault returns only success/error, never plaintext secret).

**Current state:** Legacy read-only canary uses `LEGACY_LIVE_READS_ENABLED=true` plus
`LEGACY_DATABASE_URL` for worker snapshots. Direct `LegacyBotAdapter` HTTP/control routes remain blocked.

**Network boundary:** Legacy bot is on `0.0.0.0:8000` with no nginx proxy discovered.
Before production use: restrict port 8000 to WTC server IP via security group / iptables.

---

## Endpoint / Function Boundary

The legacy bot's API surface (from source and OpenAPI discovery):

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `POST /auth/login` | POST | None | Obtain JWT token |
| `POST /auth/register` | POST | None | Create user account |
| `GET /api_management/` | GET | JWT | List all API keys for authenticated user |
| `GET /api_management/{api_id}` | GET | JWT | Get single API key with settings |
| `GET /api_management/{api_id}/settings` | GET | JWT | Get symbol settings for an API key |
| `GET /api_management/{api_id}/stage_config` | GET | JWT | Get stage/slot config for an API key |
| `POST /api_management/{api_id}/stage_config` | POST | JWT | Update stage config — NOT USED by WTC |
| `POST /api_management/{api_id}/retest` | POST | JWT | Trigger retest — NOT USED by WTC |

**WTC Phase 3.68 uses no HTTP endpoints.** Future HTTP acceptance, if reopened, may use only read
endpoints (`GET /api_management/` and `GET /api_management/{api_id}`) after separate security acceptance.
`retest`, start/stop, and stage_config write endpoints are explicitly excluded.

---

## Request / Response Schemas (Zod, for validation on WTC side)

All schemas live in `packages/bot-adapters/src/legacy/legacy.schemas.ts`.

### `POST /auth/login`

**Request:**
```typescript
const LegacyLoginRequestSchema = z.object({
  login: z.string(),    // legacy bot uses "login" not "email"
  password: z.string(), // NEVER log this
});
```

**Response (success, HTTP 200):**
```typescript
const LegacyLoginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
});
```

**Error (HTTP 401/400):**
```typescript
const LegacyLoginErrorSchema = z.object({
  detail: z.string(), // FastAPI default error detail
});
```

---

### `GET /api_management/`

**Request:** No parameters. JWT required.

**Response (success, HTTP 200):**
The legacy bot's `/api_management/` endpoint returns the list of API keys belonging
to the authenticated user. Based on source model, the shape is:

```typescript
const LegacyApiKeyListSchema = z.array(LegacyApiKeySchema);

const LegacyApiKeySchema = z.object({
  pub_id: z.string().uuid(),       // this is the `api_id` / `bot_instance_id`
  api_key: z.string(),             // exchange API key — WTC must NOT log or return this
  secret_key: z.string().nullable(),// exchange secret — WTC must NOT log or return this
  market: z.enum(["BINANCE", "BINGX"]),
  user_id: z.string(),
  running: z.boolean(),
  balance: z.number(),             // last known wallet balance (USDT)
  quarantined: z.boolean(),
  quarantine_reason: z.string().nullable(),
});
```

**CRITICAL — Secret redaction:** The adapter must redact `api_key` and `secret_key`
immediately after parsing, before they are stored, logged, or passed to any other layer.
The `BotConfigView` returned by the adapter contains `"exchange_key": "[REDACTED]"` only.

The fact that the legacy bot returns plaintext exchange keys in its API response
is a known security issue that must be flagged for remediation.
See [SECURITY_MODEL.md](../SECURITY_MODEL.md) for the remediation plan.

---

### `GET /api_management/{api_id}`

**Request:** Path param `api_id` = `pub_id` of the API key. JWT required.

**Response (success, HTTP 200):**
The full API key record with related settings and slot/order data:

```typescript
const LegacyApiKeyDetailSchema = LegacyApiKeySchema.extend({
  settings: z.array(LegacySymbolSettingsSchema),
  stage_config: z.array(LegacyStageConfigSchema).optional(),
  slots: z.array(LegacySlotSchema).optional(),
  orders: z.array(LegacyOrderSchema).optional(),
});

const LegacySymbolSettingsSchema = z.object({
  symbol: z.string(),
  api_id: z.string(),
  timeframe: z.string().default("15m"),
  rsi_length: z.number().int().default(14),
  cci_length: z.number().int().default(20),
  rsi_threshold: z.number().default(30.0),
  cci_threshold: z.number().default(-100.0),
  use_rsi: z.boolean().default(true),
  use_cci: z.boolean().default(true),
  take_profit_percent: z.number().nonnegative().default(1.0),
  initial_entry_percent: z.number().nonnegative().default(5.0),
  averaging_levels: z.number().int().nonnegative().default(3),
  averaging_percents: z.string().default("2,4,6"),      // comma-sep drop percentages
  averaging_volume_percents: z.string().default("10,20,30"),
  use_balance_percent: z.number().nonnegative().default(100.0),
  leverage: z.number().int().positive().default(1),
  active: z.boolean().default(true),
  stage: z.number().int().default(1),
});

const LegacyStageConfigSchema = z.object({
  stage: z.number().int(),
  rsi_slots: z.number().int().default(0),   // RSI (YELLOW) signal slots
  cci_slots: z.number().int().default(0),   // CCI (RED) signal slots
  api_id: z.string(),
});

const LegacySlotSchema = z.object({
  api_id: z.string(),
  position: z.string(),                     // symbol (open position)
  reason: z.enum(["RED", "YELLOW", "GREEN"]),
  stage: z.number().int(),
  averaging_count: z.number().int(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const LegacyOrderSchema = z.object({
  order_id: z.string(),
  order_type: z.enum(["LIMIT", "MARKET", "STOP_MARKET", "TRAILING_STOP_MARKET", "TRAILING_TP_SL"]),
  position_side: z.enum(["LONG", "SHORT"]),
  side: z.enum(["BUY", "SELL"]),
  note: z.enum(["TAKE_PROFIT", "AVERAGING", "STOP_LOSS", "BUY"]),
  price: z.number(),
  quantity: z.number(),
  position: z.string(),   // symbol
  api_id: z.string(),
  system_id: z.string(),
  reason: z.enum(["RED", "YELLOW", "GREEN"]),
  active: z.boolean(),
  stage: z.number().int(),
});
```

---

## Adapter Normalization to WTC Types

### `getConfig()` mapping

| WTC `BotConfigView` field | Legacy source field | Notes |
|---|---|---|
| `exchange` | `api_key.market` → lowercase | "bingx" or "binance" |
| `mode` | Not available | Hardcode "unknown" — legacy bot does not expose mode |
| `symbols` | `settings[].symbol` where `active = true` | |
| `perSymbolConfig[].symbol` | `settings[].symbol` | |
| `perSymbolConfig[].timeframe` | `settings[].timeframe` | |
| `perSymbolConfig[].rsiLength` | `settings[].rsi_length` | |
| `perSymbolConfig[].cciLength` | `settings[].cci_length` | |
| `perSymbolConfig[].rsiThreshold` | `settings[].rsi_threshold` | |
| `perSymbolConfig[].cciThreshold` | `settings[].cci_threshold` | |
| `perSymbolConfig[].takeProfitPercent` | `settings[].take_profit_percent` | |
| `perSymbolConfig[].averagingLevels` | `settings[].averaging_levels` | |
| `perSymbolConfig[].leverage` | `settings[].leverage` | |
| `perSymbolConfig[].useBalancePercent` | `settings[].use_balance_percent` | |
| `globalSettings.running` | `api_key.running` | |
| `globalSettings.quarantined` | `api_key.quarantined` | |
| `globalSettings.quarantine_reason` | `api_key.quarantine_reason` | |

Exchange `api_key` and `secret_key` fields are **never** included in `BotConfigView`.

### `getMetrics()` mapping

| WTC `BotMetrics` field | Legacy source | Notes |
|---|---|---|
| `walletEquity` | `api_key.balance` | May lag; updated by bot on balance refresh |
| `firstEquity` | null | Not tracked |
| `closedPnl` | null | No trade history |
| `unrealizedPnl` | null | No mark price feed |
| `netPnlWithFees` | null | No trade history |
| `roiPct` | null | No baseline |
| `maxDrawdownPct` | null | Not tracked |
| `currentDrawdownPct` | null | Not tracked |
| `winRate` | null | No trade history |
| `profitFactor` | null | No trade history |
| `totalTrades` | null | No trade history |
| `wins` | null | No trade history |
| `losses` | null | No trade history |
| `openPositionCount` | count of active slots | Slots are not real-time positions; may lag |
| `feesTotal` | null | Not tracked |
| `fundingTotal` | null | Not tracked |
| `openRiskUsdt` | null | No stop price tracking |
| `mode` | "unknown" | Not exposed by API |

### `getPositions()` mapping

Active slots serve as a proxy for open positions. This is an approximation — slots
represent bot intent, not confirmed exchange state. The adapter must label this clearly.

| WTC `BotPosition` field | Legacy source | Notes |
|---|---|---|
| `symbol` | `slot.position` | |
| `side` | Order with `note = "BUY"` and `active = true` → derive from `position_side` | Complex derivation; fallback to "LONG" if unclear |
| `units` | `slot.averaging_count + 1` | Number of entries (initial + averagings) |
| `totalQty` | sum of `order.quantity` where `order.position = symbol, active = true, note = "BUY"` | Approximate |
| `avgEntryPrice` | Not directly available | Null — legacy bot doesn't track avg entry in the orders table |
| `currentStopPrice` | `Order.price` where `note = "STOP_LOSS", active = true` | Null if no stop order |
| `hasTp` | `Order.note = "TAKE_PROFIT", active = true` exists for this position | |
| `tpPrice` | `Order.price` where `note = "TAKE_PROFIT", active = true` | |
| `unrealizedPnl` | null | No mark price feed |
| `openedAt` | `slot.created_at` | |
| `stage` | `slot.stage` | Legacy-specific |

**Note on quarantine:** When `api_key.quarantined = true`, the adapter adds a warning
to `BotHealth.warnings[]` with code `legacy_quarantined`. The UI must show a banner.

### `getTrades()` — Not Available

The legacy bot has no closed-trade history endpoint. Active orders and slots represent
current state only; closed positions are not tracked in a retrievable format via the API.

`getTrades()` returns:
```typescript
{
  total: 0,
  rows: [],
}
```

And the adapter adds a warning to `BotHealth.warnings[]`:
```typescript
{
  code: "no_trade_history",
  severity: "info",
  title: "Trade history not available",
  detail: "The Legacy Bot API does not expose closed trade history. PnL and performance metrics are unavailable for this bot. Contact the Legacy Bot team to add a trade history endpoint.",
}
```

---

## Error Envelope

Legacy bot uses FastAPI defaults.

| Status | Meaning | Adapter behavior |
|---|---|---|
| 200 OK | Success | Parse with Zod schema; log validation errors |
| 401 Unauthorized | JWT expired or invalid | Refresh token and retry once; if still 401, mark as `degraded` |
| 403 Forbidden | Account does not own the api_id | Mark as `degraded`, log access error |
| 404 Not Found | api_id not found | Log missing resource; return empty config |
| 500 Internal Server Error | Legacy bot error | Mark as `degraded`, retry after 120s |
| Network timeout (>10s) | Bot unreachable | Mark as `unknown` |
| Zod parse failure | API shape changed | Mark as `degraded`, log mismatch, use last cached value |

---

## Idempotency

All WTC read operations are GET (idempotent). The `POST /auth/login` is not idempotent
but has no state-changing side effects other than token issuance.

Snapshot import into WTC DB is idempotent:
- `bot_metric_snapshots`: append-only, deduplicated by `(bot_instance_id, snapshot_at)`.
- `bot_position_snapshots`: append-only with `is_current` flag cleared on each new write.

---

## Rate Limits

The legacy bot has no explicit rate limiting documented. However:
- Balance updates in the legacy bot are periodic (background task driven).
- Polling faster than every 60 seconds for metrics provides no new data.

**Recommended polling intervals:**

| Operation | WTC polling interval |
|---|---|
| Auth token refresh (proactive) | Every 20 hours |
| `GET /api_management/` | 5 minutes |
| `GET /api_management/{api_id}` | 5 minutes |
| Health check (derived from API response) | 60 seconds |

---

## Timeouts

| Operation | Timeout |
|---|---|
| `POST /auth/login` | 10 seconds |
| `GET /api_management/*` | 10 seconds |

---

## Known Security Issue: Plaintext Exchange Keys in API Response

**Issue:** The `GET /api_management/{api_id}` endpoint returns the exchange `api_key`
and `secret_key` fields in plaintext in the HTTP response. This means:
- Any process that can reach `:8000` with a valid JWT can retrieve exchange credentials.
- WTC must be careful to never propagate these fields beyond the adapter layer.

**WTC mitigation (immediate, non-negotiable):**
- Redact `api_key` and `secret_key` immediately in the Zod parse step.
- Adapter's `BotConfigView` never includes these fields.
- Adapter's logs never include these fields.
- All integration tests verify that no response from `LegacyBotAdapter` contains key material.

**Remediation required on Legacy Bot side (tracked TODO):**
- Remove `api_key` and `secret_key` from API responses.
- Store exchange keys encrypted in the legacy bot DB (currently stored plaintext in Postgres).
- Expose a read-only "settings summary" endpoint that excludes all key material.

This issue is documented in [SECURITY_MODEL.md](../SECURITY_MODEL.md) and must be
resolved before WTC enters production with `BOT_ADAPTER_MODE=read-only`.

---

## Mock vs. Real Status

| Environment | `BOT_ADAPTER_MODE` | Adapter used |
|---|---|---|
| Development | `mock` (default) | `createMockLegacyAdapter` — static fixtures (synthetic demo data) |
| Staging | `read-only` / `audited` | **`createLegacyBlockedAdapter` — BLOCKED (B3)** |
| Production | `read-only` / `audited` | **`createLegacyBlockedAdapter` — BLOCKED (B3)** |

**Phase 2.8 / PG3 update — the real legacy HTTP adapter is DELETED.** `createHttpLegacyAdapter` (which probed
`/api_management/`, an endpoint that returns plaintext exchange keys) has been removed from the codebase. The factory
(`packages/bot-adapters/src/factory.ts`) routes the legacy bot to `createLegacyBlockedAdapter` in every non-mock mode —
there is **no configuration path** (no `legacyBaseUrl`, no env) that can reach the legacy bot. The blocked adapter's data
methods throw `LegacyAdapterBlockedError` (`blockerRef='B3'`); `getHealth()` returns a deterministic blocked state with no
network call. The WTC-side Zod exclusion (`legacy/legacy-plaintext-exclusion.ts`, `LegacyApiSafeBodySchema`) is in place so
that, when the upstream fix lands, no plaintext-key field can reach the canonical layer. Un-blocking requires: the upstream
service-account / plaintext-key fix AND all 5 BOT_CONTROL_SAFETY_MODEL gates cleared (see PRODUCTION_BLOCKERS.md B3).

_(Legacy table for reference — the named `LegacyBotAdapter`/`LegacyMockAdapter` were the Phase-0 design names; the
implemented functions are `createLegacyBlockedAdapter` and `createMockLegacyAdapter`.)_

**Phase gate:** `BOT_ADAPTER_MODE=read-only` for the legacy bot requires:
1. Service account created on legacy bot with read-only scope.
2. Service account credentials stored in WTC encrypted vault.
3. Port 8000 firewall-restricted to WTC server IP.
4. Exchange key redaction verified by all tests below.
5. Security issue (plaintext keys in API) documented and accepted in writing.

Mock fixture data file: `packages/bot-adapters/src/__fixtures__/legacy.ts`
Fixtures must include: active slots, symbol settings, stage config, quarantine scenario,
and the `no_trade_history` warning.

---

## Required Tests Before Production Wiring

All tests must pass (Vitest) before setting `BOT_ADAPTER_MODE=read-only`.

### Unit Tests (`packages/bot-adapters/src/__tests__/legacy.adapter.test.ts`)

| Test | Description |
|---|---|
| `getHealth — bot running` | Mock 200 from `/api_management/`; verify `processState: "running"` |
| `getHealth — bot unreachable` | Mock timeout; verify `processState: "unknown"` |
| `getHealth — quarantined` | `quarantined: true` in response → warning code `legacy_quarantined` |
| `getHealth — no trade history warning` | Verify `no_trade_history` warning always present |
| `getConfig — exchange keys redacted` | Output never contains `api_key` or `secret_key` fields |
| `getConfig — symbols from active settings` | Only `active = true` settings become symbols |
| `getMetrics — all unavailable fields null` | Closed PnL, win rate, etc. return null not 0 |
| `getPositions — slot to position mapping` | Active slot becomes a `BotPosition` with correct symbol/stage |
| `getPositions — no stop price` | Position with no STOP_LOSS order → `currentStopPrice: null` |
| `getTrades — returns empty with warning` | `{ total: 0, rows: [] }` and warning code `no_trade_history` |
| `validateConfig — valid legacy input` | Returns `{ valid: true }` |
| `validateConfig — leverage out of range` | Error when leverage > 125 |
| `auth — token refresh on 401` | Adapter retries with fresh token on first 401 |
| `auth — token never logged` | Log output does not contain access_token value |
| `schema parse — api_management list` | Zod parse of fixture data succeeds |
| `schema parse — api_management detail` | Zod parse succeeds; keys are redacted post-parse |

### Integration Tests (`tests/integration/legacy-adapter.test.ts`)

| Test | Description |
|---|---|
| `real auth flow` | Against local test legacy bot instance; obtain token, call API |
| `keys are redacted in transit` | Network capture shows WTC never emits key values in requests or logs |
| `snapshot import idempotent` | Run import twice; verify DB state unchanged |

### Playwright E2E Tests (`tests/e2e/legacy-dashboard.spec.ts`)

| Test | Description |
|---|---|
| `no trade history N/A` | All PnL, win rate, drawdown cards show "N/A" not "0.00" |
| `quarantine warning banner` | When quarantined, banner "Bot is quarantined" is visible |
| `slots as open positions` | Active slots shown as open positions with clear "approximate" label |
| `DEMO/UNKNOWN mode badge` | Mode badge shown correctly |

---

## Open Items and Future Work

| Item | Priority | Description |
|---|---|---|
| Trade history API on legacy bot | P1 | Without closed trade history, the legacy bot cannot contribute to unified analytics. A `GET /api_management/{api_id}/trades` endpoint is needed. |
| Remove plaintext keys from API | P0 (before prod) | See security issue section above. |
| Legacy bot health endpoint | P1 | Dedicated `GET /health` endpoint instead of inferring health from 200 status on data endpoint. |
| Mode (demo/live) exposure | P2 | The legacy bot does not expose whether it is running in demo or live mode. Needed for safe mode labeling. |
| Equity curve / history | P2 | The legacy bot does not record equity snapshots. Without this, equity charts are unavailable. |
| Funding tracking | P2 | The legacy bot does not track perpetual funding payments. |
