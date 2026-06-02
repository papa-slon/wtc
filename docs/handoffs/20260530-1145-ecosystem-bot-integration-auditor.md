# Handoff: ecosystem-bot-integration-auditor
Epoch: 20260530-1145
Agent: ecosystem-bot-integration-auditor
Role: Part 5 — bot product visibility, read-only audit

---

## Scope

Read-only audit of the bot adapter layer, bot UI surfaces, DB repositories, contract docs, and
safety model as they exist at Phase 2.3 entry. Covers:
- Control-method gate confirmation (startBot / stopBot / applyConfig)
- BOT_ADAPTER_MODE default and env fallback path
- Config-version surface (WTC DB vs live bot)
- Tortila read-only mapping safety verdict
- Legacy plaintext-key / service-account issue status
- Contract doc field drift (types.ts vs docs/)
- Schema / fixture gap findings
- Safe UX improvement recommendations for Part 5

---

## Files inspected

- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/db/src/repositories.ts` (bot-related functions, lines 515–638)
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/lib/server-config.ts`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py` (read-only discovery snapshot)

---

## Files changed

None — read-only audit

---

## Findings

### F-01 CONFIRMED: Live control is HARD-disabled at the adapter layer — not UI-only

**Severity:** LOW (confirming a safety property, not a defect)
**Evidence:** `packages/bot-adapters/src/control.ts:16-18`; `packages/bot-adapters/src/mock-tortila.ts:106-117`;
`packages/bot-adapters/src/http.ts:33-48`; `packages/bot-adapters/src/adapters.test.ts:27-31`.

`assertBotControlAllowed(action, false, false)` is called unconditionally from `startBot`,
`stopBot`, and `applyConfig` in all three adapter implementations (mock Tortila, mock Legacy, real
HTTP). The function throws `BotControlDisabledError` unless BOTH `flagEnabled` and `auditApproved`
are `true`. Today both are hardcoded `false`. A Vitest test (`adapters.test.ts:27-31`) confirms
mock control methods throw. The UI renders start/stop as `disabled` HTML buttons with tooltip text
citing the safety model.

**Recommendation (Part 5):** No change required for Part 5. Confirm that Part 4 (admin ops) does
not add any route that calls `startBot`/`stopBot`/`applyConfig`; those must remain blocked.

---

### F-02 CONFIRMED: BOT_ADAPTER_MODE defaults to mock at every call site

**Severity:** LOW (confirming a safety property)
**Evidence:** `apps/web/src/lib/server-config.ts:6-8`; `packages/bot-adapters/src/factory.ts:23-28`.

`botAdapterMode()` maps any string that is not exactly `'read-only'` or `'audited'` to `'mock'`.
`getBotAdapter()` falls back to the mock adapter when `mode !== 'read-only' && mode !== 'audited'`,
and also falls back when `mode === 'read-only'` but the base URL is absent (factory.ts:26-28).
This double guard means a misconfigured or blank env always gives the mock, never an
accidentally wired real adapter.

**Recommendation (Part 5):** Existing guard is sufficient. No change needed.

---

### F-03 CONFIRMED: Config-version surface is WTC-DB-only, never forwarded to the live bot

**Severity:** LOW (confirming a safety property)
**Evidence:** `apps/web/src/features/bots/config.ts:83-88`; `packages/db/src/repositories.ts:539-551`.

`persistBotConfig()` at config.ts:83 calls `saveBotConfig(db, ...)` which is entirely within the
WTC Postgres DB (bot_configs + bot_config_versions + audit_logs in a single transaction). There
is no call to any adapter, no HTTP to a live bot. The function returns `'demo'` without persisting
when `DATABASE_URL` is absent. The settings page at settings/page.tsx:82 contains the comment
"WTC DB only — never forwarded to the live bot." The `saveBotConfigAction` server action
(settings/page.tsx:12-33) applies CSRF check, entitlement gate, and Zod validation before calling
`persistBotConfig`.

**Recommendation (Part 5):** No change required for Part 5.

---

### F-04 HIGH: Contract docs use a different BotHealth field vocabulary than the live types.ts

**Severity:** HIGH
**Evidence:**
- `packages/bot-adapters/src/types.ts:25-31` — interface uses `processAlive: boolean`,
  `status: HealthStatus`, `lastSyncAt`, `staleDataSeconds`, `uptimeSeconds`.
- `docs/CONTRACTS/tortila-adapter.md:95` — uses `processState: "degraded"`, `journalReachable: false`.
- `docs/BOT_INTEGRATION_PLAN.md:56-57` — uses `processState: BotProcessState`, `journalReachable: boolean`.
- `docs/BOT_CONTROL_SAFETY_MODEL.md:190` — references `BotHealth.processState`.

The contract docs and the safety model reference a `processState`/`journalReachable` shape that
does not match the `processAlive: boolean` / `status: HealthStatus` shape in the actual TypeScript
interface. Any engineer writing adapter tests against the contract doc will produce tests that fail
or check the wrong field names. This is a real field-name mismatch, not just a naming choice.

**Recommendation (Part 5):** Update `docs/CONTRACTS/tortila-adapter.md`, `docs/CONTRACTS/legacy-bot-adapter.md`,
`docs/BOT_INTEGRATION_PLAN.md`, and `docs/BOT_CONTROL_SAFETY_MODEL.md` to use the live field
names: `processAlive: boolean`, `status: HealthStatus` (`'healthy' | 'degraded' | 'stale' | 'down'`).
Also align the unit test table rows in the contract docs accordingly. This is a doc-only fix, no
code change.

---

### F-05 HIGH: Zod schemas for Tortila endpoints do not exist in the codebase

**Severity:** HIGH
**Evidence:** `docs/CONTRACTS/tortila-adapter.md:79` states schemas live in
`packages/bot-adapters/src/tortila/tortila.schemas.ts`; `docs/CONTRACTS/legacy-bot-adapter.md:79`
states they live in `packages/bot-adapters/src/legacy/legacy.schemas.ts`. Neither file exists.
`Glob('**/*schemas*', packages/bot-adapters)` returned no matches. Similarly `__fixtures__` files
`packages/bot-adapters/src/__fixtures__/tortila.ts` and `legacy.ts` referenced in both contracts
do not exist.

The real HTTP adapter at http.ts:60-61 casts the health response as `{ ok?: boolean }` with a
TypeScript type assertion rather than a Zod parse. There is no runtime validation of the journal's
actual JSON shape.

**Recommendation (Part 5):** Before enabling `BOT_ADAPTER_MODE=read-only` in any environment,
the schema files and fixture files referenced by both contracts must be created. For Part 5 scope
(read-only UI only, mock data), the immediate blocker is lower — but the contract doc references
to non-existent files must be flagged as a gate-3/gate-4 prerequisite before any real adapter use.
Do not fabricate the schema files in a Phase 2.3 doc sprint; create them with the real Tortila
shapes when the read-only adapter is properly gated.

---

### F-06 MEDIUM: BotConfigView interface in types.ts diverges from the richer shape in BOT_INTEGRATION_PLAN.md

**Severity:** MEDIUM
**Evidence:**
- `packages/bot-adapters/src/types.ts:34-45` — `BotConfigView` has: `productCode`, `instanceId`,
  `symbols`, `riskPercent?`, `leverage?`, `maxUnits?`, `takeProfitPercent?`, `mode`, `raw`.
- `docs/BOT_INTEGRATION_PLAN.md:66-75` — specifies `exchange`, `perSymbolConfig[]`,
  `globalSettings`, no `raw`.

The code uses a simplified `raw: Record<string, unknown>` bag while the plan document describes a
structured per-symbol config. The mock adapters at mock-tortila.ts:79 and mock-legacy.ts:42 both
use `raw: {...}`. This divergence means a UI that tries to display per-symbol config (planned in
the legacy-bot-adapter.md normalization table) will have no typed field to bind to.

**Recommendation (Part 5):** For the read-only UI the `raw` bag is safe to render as a pre/JSON
block (as done in bots/[bot]/page.tsx:122). Do not change the types.ts interface for Part 5. Flag
this as a tracked deviation: when the real legacy adapter is wired, the per-symbol config
normalization in the contract requires a `perSymbolConfig[]` field on `BotConfigView`. That
requires an additive change to the interface and the adapter. Document it as an open item in
CONTRACTS/legacy-bot-adapter.md.

---

### F-07 HIGH: Legacy real adapter is BLOCKED — plaintext-key / service-account issue is unresolved

**Severity:** HIGH
**Evidence:**
- `packages/bot-adapters/src/http.ts:94` — comment: "WARNING: legacy API returns plaintext keys —
  never proxy them."
- `packages/bot-adapters/src/http.ts:111-113` — `getConfig()` throws `AdapterNotReadyError('legacy', 'getConfig')`
  with explicit reason "must strip plaintext keys before mapping".
- `docs/CONTRACTS/legacy-bot-adapter.md:49` — "No service account exists. BOT_ADAPTER_MODE=mock
  until a service account is provisioned and credentials are stored in vault."
- `warnings.ts:62-65` — `legacy_plaintext_keys` warning at severity `'error'`, detail: "the legacy
  :8000 API exposes API keys in responses. WTC must NOT proxy this; migrate to the encrypted vault
  before any real adapter use."

The legacy real adapter is correctly blocked. `getConfig` throws before it could read or return
any exchange key. The mock adapter returns an `error`-severity warning on every health check. All
five required gates for legacy read-only (service account, vault, firewall, key redaction, written
acceptance of security issue) remain NOT STARTED.

**Recommendation (Part 5):** The legacy real adapter MUST remain blocked. The `legacy_plaintext_keys`
warning must persist on every legacy health response regardless of adapter mode (it is already
hardcoded into `LEGACY_WARNINGS` at warnings.ts:62). No code change required; this is a status
confirmation. Document in Part 5 that the legacy bot's product page must prominently surface the
`legacy_plaintext_keys` warning as an `error`-severity permanent notice, not something users can
dismiss.

---

### F-08 MEDIUM: Tortila real `getConfig()` throws AdapterNotReadyError — confirmed intentional, but the contract doc should note why

**Severity:** MEDIUM
**Evidence:** `packages/bot-adapters/src/http.ts:77` — `throw new AdapterNotReadyError('tortila', 'getConfig')` with
comment "journal has no /api/config yet (see contract)". `docs/CONTRACTS/tortila-adapter.md:483-484` — tracks
`GET /api/config` JSON endpoint as P1 ("Expose current bot config as JSON so WTC adapter doesn't need to parse
HTML or read SQLite directly"). Confirmed in local source: `bot_tortila/src/turtle_bot/journal/app.py` has no
`/api/config` JSON route; the config is only served as an HTML template at `GET /config`.

**Recommendation (Part 5):** Safe to leave as-is. The `AdapterNotReadyError` is the correct
mechanism. The contract doc already tracks this. The settings page reads config from WTC DB, not
from the adapter's `getConfig()`, so users see their saved config without needing a journal config
endpoint. Add a note to tortila-adapter.md clarifying that the WTC config-save surface is
independent of this P1 gap.

---

### F-09 MEDIUM: Tortila `getHealth()` real adapter hardcodes `status: 'degraded'` regardless of whether warnings resolve

**Severity:** MEDIUM
**Evidence:** `packages/bot-adapters/src/http.ts:68-70` — the real Tortila adapter returns
`status: 'degraded'` unconditionally (comment: "unresolved P0/P1 keep status non-healthy"). The
`TORTILA_PERSISTENT_WARNINGS` at warnings.ts:33-46 are injected on every response and are never
cleared by a journal `ok` response.

This is the correct policy per the safety model, but it means even a fully healthy Tortila instance
will always show `degraded` status until the P0 (`tp_reconcile_p0`) and P1 (`margin_preflight_p1`)
warnings are resolved. Users may experience alert fatigue or learn to ignore the status badge.

**Recommendation (Part 5):** This is intentional and documented. However, the UX should
differentiate between "degraded because of unresolved P0/P1" and "degraded because of a live
journal error." A future UX improvement is to add a `degradedReason: 'unresolved_open_items' |
'journal_unreachable' | 'schema_mismatch'` field to `BotHealth` so the UI can display contextual
messages. Flag as a Phase 3 backlog item. Do not change today.

---

### F-10 LOW: The backtester page (Tortila) has an unguarded HTML form with no server action

**Severity:** LOW
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:48-63` — the configure
form has no `action={}` attribute, all buttons are `disabled`. There is no server action, no POST
route, and no data flow — it is a UI placeholder. The "Queue run" button is disabled with label
"local runner required."

**Recommendation (Part 5):** Acceptable as-is for Phase 2.3. The placeholder correctly signals
that the backtester is not functional. Before Part 6 (tests + e2e), add a Playwright assertion
that both backtester buttons are disabled and the empty-state card is visible, so a future
implementer cannot accidentally enable a form that posts to nowhere.

---

### F-11 LOW: `HealthStatus` type in types.ts uses 'stale' but BOT_INTEGRATION_PLAN.md uses 'offline'

**Severity:** LOW
**Evidence:**
- `packages/bot-adapters/src/types.ts:20` — `HealthStatus = 'healthy' | 'degraded' | 'stale' | 'down'`.
- `docs/BOT_INTEGRATION_PLAN.md:47-51` — `BotProcessState = "running" | "degraded" | "unknown" | "offline"`.
- `docs/BOT_CONTROL_SAFETY_MODEL.md:190` — references `running`/`degraded`/`unknown`/`offline`.

The two vocabularies are not the same. The code uses `'stale'` (process alive, data stale) and
`'down'` (process down), while the docs use `'unknown'` and `'offline'`. The mock legacy adapter
(mock-legacy.ts:26) returns `status: 'stale'` and the UI (bots/page.tsx, healthTone function) has
a case for `'stale'`. But the safety model's UI indicator table (BOT_CONTROL_SAFETY_MODEL.md:190)
references `'unknown'/'offline'` which would never match the actual `HealthStatus` values.

**Recommendation (Part 5):** Align the docs to the code. Update BOT_INTEGRATION_PLAN.md and
BOT_CONTROL_SAFETY_MODEL.md to use the four live values: `'healthy' | 'degraded' | 'stale' |
'down'`. This is a doc-only fix.

---

### F-12 LOW: Tortila `getHealth()` real adapter uses a 4000ms timeout but the contract specifies 5s

**Severity:** LOW
**Evidence:** `packages/bot-adapters/src/http.ts:20` — `getJson(url, timeoutMs = 4000)` default.
`docs/CONTRACTS/tortila-adapter.md:405-410` — health check timeout = 5 seconds.

**Recommendation (Part 5):** Align either the code (change default to 5000ms for health) or
the contract doc. The code currently calls `getJson` without specifying timeout for all real
adapter calls (http.ts:61,77,80,84,87), so all endpoints use the 4000ms default. The contract
specifies different timeouts per endpoint (5s health, 15s data, 20s marks). The `getJson` function
does not allow per-call overrides at the call sites. Fix: add explicit `timeoutMs` argument at
each call site in http.ts to match the contract, or update the contract to 4s for all.

---

## Decisions

### D-01: Safe to implement read-only Tortila health mapping NOW; all other methods must stay as AdapterNotReadyError

The Tortila journal's `/api/health` endpoint shape is confirmed from two sources: the contract doc
(tortila-adapter.md:86-92) and the local source snapshot (bot_tortila/journal/app.py:572-574).
The actual response is `{"ok": true, "ts": "..."}`. The real adapter at http.ts:57-74 correctly
maps this. It is safe to use this single confirmed mapping.

All other Tortila endpoints (`/api/summary`, `/api/overview`, `/api/trades/list`, `/api/marks`,
etc.) have Zod schemas documented in the contract but the schemas do NOT exist in
`packages/bot-adapters/src/tortila/tortila.schemas.ts` (that file does not exist). The contract
doc's schemas are design specs, not yet implemented. The real adapter correctly throws
`AdapterNotReadyError` for all non-health methods. Do not implement the mappings in Part 5 until
the schema files exist and the endpoints are confirmed to return exactly those shapes against a live
instance.

**Verdict: do NOT invent Tortila endpoint mappings in Part 5. The health check is the only safe,
confirmed mapping.**

### D-02: Legacy real adapter MUST stay blocked

The legacy service-account / plaintext-key issue is unresolved. All five gates for legacy
read-only use remain NOT STARTED (contract doc, legacy-bot-adapter.md:393-399). The mock
adapter correctly surfaces the `legacy_plaintext_keys` error-severity warning on every health
check. The HTTP legacy adapter's `getConfig()` throws before it could read any key. No Part 5
work should loosen these gates.

### D-03: Config-version surface in WTC DB is safe and complete for read-only display

The existing `loadBotConfig` / `persistBotConfig` path (features/bots/config.ts) is fully
isolated to the WTC Postgres DB. Version history, safety events, and the current config draft are
all read from `bot_configs`, `bot_config_versions`, and `bot_safety_events` tables via typed DB
repos. No live bot call is involved. This surface is production-ready for Part 5 read-only
display.

### D-04: Safe UX improvements for Part 5 (read-only only, no code changes to adapters)

The following additions are safe and do not require adapter code changes:

1. **Capability-aware "not available" panels**: The `BOT_CAPS` record in meta.ts is already
   defined and consumed by the trades and equity pages (trades/page.tsx:49, equity/page.tsx:47).
   Extend this pattern to the overview and safety pages — never render a metric card with a
   fabricated value for a `hasTradeHistory: false` bot.

2. **Adapter mode badge on every sub-page**: Currently only some sub-pages show the mock warning
   banner (positions, trades, equity). The safety page and settings page do not. Add the
   `adapter.mode === 'mock'` banner to the safety page for consistency.

3. **Persistent P0/P1 warning at the top of every Tortila sub-page**: Currently warnings are
   shown in the health card on the overview and safety pages. The settings and equity pages do not
   repeat them. A small `TortilaP0Banner` component that checks `health.warnings` for
   `tp_reconcile_p0` and `margin_preflight_p1` would give users a persistent signal on every page.
   This is consistent with the safety model (BOT_CONTROL_SAFETY_MODEL.md:192-195).

4. **Explicit capability-state column in the settings page**: The settings page currently shows
   no indication of which fields are actually consumed by the Tortila bot vs which are only stored
   in WTC. Adding a "Note: this config is stored in WTC only and is not applied to the running bot"
   per-field hint (the global banner exists; per-field inline is stronger). Already partially done
   (hint strings in BOT_CONFIG_FIELDS), but a per-field "WTC-only" tag would clarify.

5. **Legacy "limited data" hero card**: On the legacy bot overview, before the metric grid, show
   a card that lists exactly which metrics are available vs unavailable for Legacy (sourced from
   BOT_CAPS). This prevents confusion when users see "—" on most cards.

---

## Risks

### R-01 (HIGH) — Doc-to-code field name drift (processAlive vs processState, status vs processState)

As found in F-04 and F-11, the contract docs and safety model use a field vocabulary that does not
match the live TypeScript interface. Engineers writing integration tests from the docs will produce
incorrect test assertions. This is a documentation correctness risk that will become a code
correctness risk the moment the real adapter is tested.

### R-02 (HIGH) — Schema and fixture files referenced in contracts do not exist

As found in F-05, the Zod schemas and test fixtures for both adapter contracts are missing. The
contract documents specify them as the source of runtime validation, but the real HTTP adapter
uses TypeScript casts, not Zod parses. If `BOT_ADAPTER_MODE=read-only` is set without these
files, there is no runtime guard against journal API shape changes.

### R-03 (MEDIUM) — Tortila status always "degraded" may cause alert fatigue

As found in F-09, the real Tortila health adapter hardcodes `status: 'degraded'` until P0/P1 are
resolved. This is correct per policy but may cause users to treat the degraded badge as the normal
state and ignore genuine degradation signals (journal unreachable, schema mismatch). The `status`
field needs a richer sub-reason when real adapters are enabled.

### R-04 (MEDIUM) — BotConfigView shape gap between types.ts and planned per-symbol config

As found in F-06, the planned per-symbol config normalization (especially for Legacy) cannot be
implemented without extending `BotConfigView` in types.ts. Any Part 5 UI that tries to render
per-symbol RSI/CCI parameters will have no typed source.

### R-05 (LOW) — Timeout mismatch between http.ts default and contract spec

As found in F-12, all real adapter calls use 4000ms while the contract specifies up to 20s for the
marks endpoint. If the marks endpoint (which calls BingX) is implemented and uses the default 4s
timeout, it will time out on slow BingX responses and show the journal as degraded when it is
actually healthy.

---

## Verification/tests

The existing `adapters.test.ts` (Vitest) confirms the core safety properties at test time:
- Mock returns `mode: 'mock'` (test: "defaults to mock adapters").
- `read-only` without base URL returns mock (test: "cannot accidentally connect").
- Real adapter methods throw `AdapterNotReadyError` for all data methods (test: "real adapter data
  methods are stubbed").
- Real adapter control methods throw `BotControlDisabledError` (same test).
- Mock control methods also throw `BotControlDisabledError` (test: "mock control methods are also
  disabled").
- P0 (`tp_reconcile_p0`) and P1 (`margin_preflight_p1`) warnings are present in both mock and real
  Tortila health responses.
- All warning codes in mock/http adapters are members of `CANONICAL_WARNING_CODES`.

**Gaps in test coverage (gate-4 prerequisites):**
- No test verifies that `status` is never `'healthy'` while P0 is unresolved.
- No test covers the Legacy adapter's `legacy_plaintext_keys` warning persistence.
- No Playwright test confirms disabled start/stop buttons on the bot overview page.
- No test confirms that `null` metric fields render as "—" and not "0" or "0.00".
- No test for `filterZeroEquity` (used in equity/page.tsx:18) being applied before chart render.

Gates 2, 3, and 4 in BOT_CONTROL_SAFETY_MODEL.md all show status "NOT STARTED" for the
integration test and exchange safety requirements.

---

## Next actions

**For Part 5 (bot product visibility, this phase):**

1. Fix doc-only drift (F-04, F-11): Update `docs/CONTRACTS/tortila-adapter.md`,
   `docs/CONTRACTS/legacy-bot-adapter.md`, `docs/BOT_INTEGRATION_PLAN.md`, and
   `docs/BOT_CONTROL_SAFETY_MODEL.md` to use `processAlive / status / 'healthy' | 'degraded' |
   'stale' | 'down'` consistently. No code change.

2. Add `adapter.mode === 'mock'` mock-data warning banner to the safety page (currently missing;
   all other sub-pages have it).

3. Add a `TortilaP0Banner` component or inline P0/P1 check to the settings and equity sub-pages
   so the unresolved warning is visible on every Tortila page, not only on the overview and safety
   pages.

4. Add the Legacy "limited data" capability summary card to the legacy bot overview page, sourced
   from `BOT_CAPS['legacy_bot']`, so users understand what "—" means before they see it.

5. For Part 6 (tests + e2e): add Playwright assertions that:
   - Start/stop buttons are `disabled` on all bot overview pages.
   - P0 warning banner is visible on Tortila pages.
   - `no_trade_history` empty-state is shown (not "0") on Legacy trades page.
   - Mock-data warning banner is shown on every bot sub-page when `BOT_ADAPTER_MODE=mock`.

**Blocked until separate gates pass (do NOT do in Phase 2.3):**
- Do not implement Tortila `getMetrics`/`getTrades`/`getPositions`/`getConfig` real mappings
  until schema files exist and live endpoint shapes are confirmed.
- Do not enable `BOT_ADAPTER_MODE=read-only` for Legacy until all five gates in
  legacy-bot-adapter.md are complete (service account, vault, firewall, key-redaction tests,
  written security acceptance).
- Do not add any `startBot`/`stopBot`/`applyConfig` route or UI path.
