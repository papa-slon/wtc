# ecosystem-bot-integration-auditor handoff

Epoch: 20260530-0925. Phase 2.1 read-only audit.
Prior handoff: `docs/handoffs/20260530-0126-ecosystem-bot-integration-auditor.md` (Phase 2 design).

---

## Scope

Phase 2.1 adds:
- Bot-config persistence to WTC DB (bot_configs + bot_config_versions via migration 0002).
- Metric / position / trade / safety snapshots written by a background worker.
- `/app/bots/[bot]/settings` promoted from placeholder to a real WTC-DB-only config surface.

This audit verifies: (1) config-save flow is WTC-DB-only with zero live forward to :8000/:8080;
(2) exact settings-form field sets per bot with Zod constraints; (3) safety-event severity → risk-signal
mapping and rendering rules; (4) snapshot tables are worker-written with honest empty states in UI;
(5) integration test specifications covering ownership isolation, config versioning, and critical-safety
audit paths.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-bot-integration-auditor.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/analytics/src/metrics.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `packages/db/src/schema.ts` (bot_configs table, line 128–134)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### Finding 1 — [P0] Config save must write bot_configs + bot_config_versions in a single transaction with an in-txn audit row; no live forward to :8000/:8080

**Evidence:** `packages/db/src/schema.ts:128–134` has a `bot_configs` table with
`(id, bot_instance_id, version, config, updated_at)`. The db-architect handoff
(`docs/handoffs/20260530-0126-ecosystem-db-architect.md`, "Table: bot_config_versions") specifies a
separate append-only `bot_config_versions` table as the history log. No server action or API route
for config save currently exists — the settings page is a stub placeholder
(`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:1–6`).

**What a config save must write (exact sequence, in one transaction):**

1. Read the current `bot_configs.version` for this `bot_instance_id`.
2. Compute `next_version = current_version + 1`.
3. `UPDATE bot_configs SET config = $newConfigJson, version = next_version, updated_at = NOW()
   WHERE id = $configId AND bot_instance_id = $botInstanceId`.
4. `INSERT INTO bot_config_versions (bot_instance_id, version, config_json, changed_by, note)
   VALUES ($botInstanceId, $nextVersion, $newConfigJson, $userId, $optionalNote)`.
   This is append-only and never mutated after insert.
5. `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, ...)
   VALUES ($userId, 'bot.config.save', 'bot_instance', $botInstanceId, ...)`.
6. Commit. If any step fails, roll back the entire transaction. No partial writes.

**What a config save must NOT do (hard invariants):**
- Must not call `adapter.applyConfig()`, `adapter.startBot()`, or `adapter.stopBot()`.
- Must not issue any HTTP request to `:8000` or `:8080`.
- Must not write to the bot's own `.env`, SQLite, or PostgreSQL database.
- `applyConfig` in `packages/bot-adapters/src/types.ts:68` always throws `BotControlDisabledError`
  regardless of what the UI sends — this is adapter-level enforcement, not UI-level.
- `assertBotControlAllowed` in `control.ts:16–18` requires BOTH `flagEnabled=true` AND
  `auditApproved=true`; both mock and real adapters call this with `(false, false)` unconditionally.

**Recommendation:** The Wave-2 settings-page implementer must wire the save action as a Next.js server
action that: (a) calls `validateConfig(input)` on the adapter first (pure Zod, no network);
(b) enforces RBAC (user owns the bot_instance via `bot_instances.user_id`); (c) executes the three-step
transaction above; (d) never touches the bot adapter's control methods. The server action must be
annotated `'use server'` and must not be callable from a client component without CSRF protection.

---

### Finding 2 — [P0] Settings form field matrix: exact fields per bot, Zod constraints, WTC-DB-only scope

The settings page at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` is currently a
`BotSubPagePlaceholder`. When implemented for Phase 2.1, it must expose the following field sets.
All fields are persisted to WTC DB only. None are forwarded to the bot at save time.

#### Tortila Bot config form

Source authority: `C:\Users\maxib\GTE BOT\bot_tortila` `PerSymbolConfig` in `config.py`;
`BotConfigView.raw` shape in `mock-tortila.ts:79`.

| Field | Widget | Zod constraint | Notes |
|---|---|---|---|
| `symbols` | Multi-select or comma-list | `z.array(z.string().min(1)).min(1)` | Non-empty; e.g. `['BTC-USDT','ETH-USDT']` |
| `timeframe` | Select (1m, 5m, 15m, 1h, 4h, 1d, 1w) | `z.string().regex(/^\d+[mhdw]$/)` | Regex matches known BingX timeframe format |
| `system` | Toggle: "System 1 (20/10)" / "System 2 (55/20)" | `z.union([z.literal(1), z.literal(2)])` | Turtle system selection |
| `riskPct` | Number input (%) | `z.number().min(0.001).max(0.05)` | 0.1% – 5% of account per position |
| `stopN` | Number input | `z.number().gt(0).max(20)` | ATR multiplier for initial stop |
| `addStep` | Number input | `z.number().gt(0).max(5)` | ATR units between pyramid additions |
| `maxUnits` | Integer input | `z.number().int().min(1).max(20)` | Maximum pyramid units per symbol |
| `atrPeriod` | Integer input | `z.number().int().min(2).max(400)` | ATR lookback period |
| `tpRr` | Number input | `z.number().min(0)` | 0 = TP disabled; > 0 = TP at N × risk |
| `useWinnerFilter` | Checkbox | `z.boolean()` | Winner filter on/off |
| `leverage` | Integer input | `z.number().int().min(1).max(125)` | Exchange leverage (global) |
| `haltDdPct` | Number input (%) | `z.number().min(0).max(100)` | Drawdown halt threshold |
| `dailyMaxLossPct` | Number input (%) | `z.number().min(0).max(100)` | Daily loss limit |
| `mode` | Read-only badge | Not editable via WTC | `'demo' \| 'live'` — display only |

All Tortila fields that control live-exchange behaviour (leverage, mode) must carry a tooltip:
"This config is stored in WTC DB only. Changes do not reach the bot until the audited adapter ships."

#### Legacy Bot config form

Source authority: `/api_management/{api_id}/settings` endpoint (legacy bot :8000);
`BotConfigView.raw` shape in `mock-legacy.ts:41–53`.

| Field | Widget | Zod constraint | Notes |
|---|---|---|---|
| `symbols` | Multi-select | `z.array(z.string().min(1)).min(1)` | Active symbols only |
| `timeframe` | Select | `z.string().min(1)` | Known BingX/Binance values (1m, 3m, 5m, 15m, 1h, 4h, 1d) |
| `rsiLength` | Integer input | `z.number().int().min(2).max(200)` | RSI lookback |
| `cciLength` | Integer input | `z.number().int().min(2).max(200)` | CCI lookback |
| `rsiThreshold` | Number input | `z.number()` | RSI oversold/overbought level |
| `cciThreshold` | Number input | `z.number()` | CCI threshold |
| `useRsi` | Checkbox | `z.boolean()` | Enable RSI signal |
| `useCci` | Checkbox | `z.boolean()` | Enable CCI signal |
| `takeProfitPercent` | Number input (%) | `z.number().min(0)` | 0 = TP disabled |
| `averagingLevels` | Integer input | `z.number().int().min(0).max(10)` | Number of averaging add levels |
| `leverage` | Integer input | `z.number().int().min(1).max(125)` | Exchange leverage |
| `useBalancePercent` | Number input (%) | `z.number().min(1).max(100)` | % of balance to use per slot |
| `stages` (RSI slots) | Stage config table | `z.array(z.object({slot: z.number().int(), sizePercent: z.number()}))` | Per-stage slot allocation |

**Config validation rules (both bots):**
- `validateConfig(input)` on the adapter is called first; it is a pure local Zod check with no network
  request. This is the only validation before the DB write. The adapter's `validateConfig` is listed
  in `BOT_INTEGRATION_PLAN.md:407` as "Local Zod schema only — No round-trip to journal required."
- If validation fails, no DB write occurs and the server action returns the error list to the form.
- The form never shows a "save successful — config applied to bot" message. The correct message is:
  "Config saved to WTC. Changes will be applied to the bot when the audited adapter ships."

---

### Finding 3 — [P0] Safety-event severity → risk-signal mapping and rendering rules

The `bot_safety_events` table (db-architect handoff, "Table: bot_safety_events") uses a `severity`
column with values `'info'`, `'warning'`, `'critical'`. The adapter warnings in
`packages/bot-adapters/src/warnings.ts` use `'info'`, `'warning'`, `'error'`. These must be mapped
consistently as follows:

#### Severity alignment

| DB `severity` | Adapter `RiskWarning.severity` | Canonical UI tone |
|---|---|---|
| `critical` | `'error'` | Red banner (`--red:#ff6b74`) — P0 items |
| `warning` | `'warning'` | Gold banner (`--gold:#d5a94f`) — P1 items |
| `info` | `'info'` | Muted banner (`--muted:#94a3b8`) — informational |

#### Risk signal → event_code mapping

The `bot_safety_events.event_code` column must use the following canonical values to match the
orchestrator-seed risk signals (`0000-orchestrator-seed.md:32–34`) and the warning codes in
`warnings.ts:12–25`:

| DB `event_code` | Adapter warning code | Severity | Trigger |
|---|---|---|---|
| `TP_RECONCILIATION_PENDING` | `tp_reconcile_p0` | `critical` | P0: TP not restored after bot restart |
| `MARGIN_PREFLIGHT_MISSING` | `margin_preflight_p1` | `warning` | P1: no margin check before entry |
| `TP_REJECTION_101211` | `tp_rejection_101211` | `warning` | BingX error 101211 — TP price too close to mark |
| `RATE_LIMIT_100410` | `rate_limit_100410` | `warning` | BingX rate-limit / funding error 100410 |
| `FILL_LOOKUP_109421` | `fill_lookup_109421` | `info` | Fill-detail lookup miss (order not found) |
| `EXCHANGE_FLAT_MISMATCH` | `exchange_flat_mismatch` | `warning` | Exchange flat ≠ bot state; reconciliation triggered |

When the worker writes a `bot_safety_events` row with `severity = 'critical'`, `insertBotSafetyEvent`
(db-architect handoff, "Repo functions for Wave-2 — Bots") must also write an `audit_logs` row in the
same transaction with action `'bot.safety_event'`. This is the only severity level that triggers an
in-transaction audit entry; `info` and `warning` events are written to `bot_safety_events` only.

#### Safety history rendering rules (non-negotiable)

These rules apply to `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`:

1. The full warning list from `BotHealth.warnings[]` is rendered for every bot regardless of whether
   `safety_events` table rows exist yet (the table may be empty before the worker runs). Current code
   at `safety/page.tsx:36–45` already does this correctly via `adapter.getHealth()`.

2. Safety events from the DB (once the worker writes them) must be rendered in a separate chronological
   table beneath the active-warning banners. Column order: `observed_at` (newest first), `event_code`,
   `severity` (coloured chip), `symbol` (or "—"), `description`, `acknowledged_at` (or "Unacknowledged").

3. No safety event, at any severity, may be collapsed behind a green "All clear" card. The current
   implementation shows `EmptyState` only when `health.warnings.length === 0`, which is correct — the
   empty state is never shown while warnings are present.

4. The P0 warning (`TP_RECONCILIATION_PENDING` / `tp_reconcile_p0`) must always appear at the top of
   the list as a red banner, regardless of the sort order of other events. It is cleared from the
   adapter's warning list only when the Tortila journal reports a `tp_reconcile_ok` state key — not
   automatically. `warnings.ts:33–46` implements this correctly.

5. The P1 warning (`MARGIN_PREFLIGHT_MISSING` / `margin_preflight_p1`) must appear as a gold banner
   immediately after any P0 warning. If P0 is absent and P1 is the only warning, it appears at the top.

6. Error-code warnings (`101211`, `100410`, `109421`, `exchange_flat_mismatch`) are rendered as a
   collapsible list below the persistent banners. The collapsed state shows the count of events in the
   last 24 hours. Expanding shows detail and timestamps. They must not be collapsed by default when
   any of these codes is present.

#### Acknowledge flow

`acknowledgeBotSafetyEvent(db, eventId, adminId)` (db-architect handoff) is the only mutation path.

- Only users with `admin` role may call the acknowledge action.
- The server action must verify the caller's role server-side (`requireUser()` + RBAC check)
  before executing the UPDATE.
- The acknowledge action writes an `audit_logs` row in the same transaction with action
  `'bot.safety_event_ack'`.
- The UI acknowledge button is visible to admin users only; non-admin users see the event as
  read-only. "Acknowledged by [admin name] at [time]" is shown inline after acknowledgement.
- Acknowledging a `critical` event does not change its visible severity or remove it from the
  banner list — it adds an "acknowledged" annotation only. The banner persists until the underlying
  condition clears (adapter reports resolution).
- There is no "dismiss all" operation. Each event must be acknowledged individually.

---

### Finding 4 — [P1] Snapshot tables are worker-written; no worker yet → honest empty states required in UI

**Evidence:** `apps/worker` background process is the designated writer for
`bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, and `bot_safety_events`
(db-architect handoff, "Repo functions for Wave-2 — Bots"; BOT_INTEGRATION_PLAN.md:348–366).
The worker is referenced as a cron-style loop but not yet wired to call bot adapter methods
(the 0000-orchestrator-seed.md:54 states "pg-table job_queue is RESERVED/unconsumed").

**Required honest UI states for each snapshot table before the worker is wired:**

| Table | Empty state message | Condition |
|---|---|---|
| `bot_metric_snapshots` | "No metric history yet. Data is collected by the background worker. Check back once the worker is running." | No rows for this bot_instance_id |
| `bot_position_snapshots` | "No position snapshots yet. Positions are polled by the worker every ~1 minute once running." | No rows |
| `bot_trade_imports` | "No trade history imported yet. Trades are imported by the worker from the adapter." | No rows |
| `bot_safety_events` | "No safety events recorded yet. Risk signals will appear here once the worker is polling." | No rows |

While there are no snapshot rows in the DB, the settings page, positions page, trades page, equity
page, and safety page all fall back to the adapter (mock or real) as the data source — this is
the current implementation. This is the correct fallback. Once the worker is wired, UI routes should
prefer DB snapshots over live adapter calls to decouple the dashboard from bot availability, as
specified in `BOT_INTEGRATION_PLAN.md:343–365`.

**Mock banner requirement (non-negotiable):** When `BOT_ADAPTER_MODE=mock` (default), every bot
sub-page that renders metric, position, trade, equity, or safety data from the adapter must display
the banner:

> "Simulated data — not a live account"
> "BOT_ADAPTER_MODE=mock: [description of what is shown] is illustrative sample data from the mock
> adapter, not your real exchange account."

The following pages currently implement this banner correctly:
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:64–70` — overview
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:25–30` — positions
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:32–38` — trades
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:31–37` — equity

**GAP:** `safety/page.tsx` (lines 1–60) does not currently show the mock-mode banner. When the
adapter is in mock mode, the safety page must also display "Simulated data — not a live account"
to be consistent with all other sub-pages.

**GAP:** The settings page is a placeholder stub and has no mock-mode banner. When implemented, it
must show the same banner when `adapter.mode === 'mock'`.

---

### Finding 5 — [P1] bot_configs.version column name mismatch: schema has `version`, plan uses `current_version`

**Evidence:** `packages/db/src/schema.ts:131` uses column name `version`.
`docs/handoffs/20260530-0126-ecosystem-db-architect.md` finding 2 explicitly documents: "The current
`bot_configs` in schema.ts has: `version` (not `current_version`) and `config` (not `config_json`)."
The db-architect handoff correctly resolved this by updating DATA_MODEL.md to match the real schema.

**However:** The settings-page server action must use the real column names from `schema.ts` (`version`,
`config`) when reading the current version to compute `next_version = current_version + 1`. If any
implementer references `current_version` or `config_json` on the `bot_configs` table, it will fail.
The new `bot_config_versions` table (to be created in migration 0002) correctly uses `config_json`
(not `config`) as its column name — these are different tables with different column names.

**Recommendation:** Add a comment in `schema.ts` at the `botConfigs` table definition noting that
`config_json` is the name used in the new `bot_config_versions` table, while `config` is the live-current
column in `bot_configs`. This prevents column name confusion during Wave-2 implementation.

---

### Finding 6 — [P1] Safety page lacks DB-persisted history; current implementation is health.warnings only

**Evidence:** `safety/page.tsx:14–45` calls only `adapter.getHealth()` and renders
`health.warnings[]`. There is no query to `bot_safety_events` table. This is expected and correct
in Phase 2.0 — the table does not exist yet. In Phase 2.1, once migration 0002 lands and the worker
begins writing `bot_safety_events` rows, the safety page must be extended to also query and render the
persisted event history.

The adapter `getSafetyEvents()` method identified as GAP-4 in the Phase 2 handoff remains unimplemented
on the `BotAdapter` interface. For Phase 2.1, the DB repository function `listBotSafetyEvents` is the
correct data source for history — it does not require a new adapter method. The adapter method would
be needed only for the real-time live-fetch path (not required until `BOT_ADAPTER_MODE=read-only`).

**Recommendation:** Phase 2.1 settings implementation should add `listBotSafetyEvents` query to the
safety page alongside the existing `getHealth()` call. The two data sources serve different purposes:
`getHealth().warnings` = real-time active signals (always shown), `listBotSafetyEvents` = persisted
historical record (empty until worker runs, shown with an honest empty state).

---

### Finding 7 — [P2] overview page shows grossPnl as "Closed PnL" without net label

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:74`:
```
<MetricCard label="Closed PnL" value={fmtMoney(metrics.closedPnl)} tone={...} />
```
`CANONICAL_ANALYTICS_MODEL.md:175–183` requires that closed PnL and net PnL are shown as separate
labelled cards: "Closed PnL (realized, USDT)" and "Net PnL (with fees & funding)". The overview page
only shows the gross `closedPnl` card; `netPnlWithFees` is correctly computed in `metrics.ts:183` but
not surfaced on the overview page.

The trades sub-page (`trades/page.tsx:44`) correctly shows `netPnlWithFees` as "Net PnL (after fees)".
The overview page should also show `netPnlWithFees` or at minimum label the `closedPnl` card as
"Closed PnL (gross, before fees)".

**Recommendation:** Add a ninth MetricCard to the overview grid or replace/relabel:
```
<MetricCard label="Net PnL (after fees & funding)" value={fmtMoney(metrics.netPnlWithFees)}
  tone={metrics.netPnlWithFees >= 0 ? 'up' : 'down'} />
```

---

### Finding 8 — [P2] Control buttons on overview page use `disabled` HTML attribute but no tooltip on the correct element

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:124–125`:
```html
<button ... disabled title="Disabled: live control requires an audited adapter">Start bot (disabled)</button>
<button ... disabled title="Disabled: 'stop' never closes positions; requires audited adapter">Stop bot (disabled)</button>
```
The `title` attribute on a `disabled` button is not reliably shown by all browsers on hover. For the
"stop bot ≠ close positions" safety message to be visible, it must also appear as static text (which
it does at `page.tsx:128–130`). This is acceptable for Phase 2.1 but the static disclaimer text should
explicitly call out the exchange-positions risk in language matching `BOT_CONTROL_SAFETY_MODEL.md:49`:
"Stopping the bot does NOT close positions. Your open positions remain on the exchange as-is."

---

## Decisions

1. Config save is WTC-DB-only: writes `bot_configs` (UPDATE) + `bot_config_versions` (INSERT) in one
   transaction with an in-txn `audit_logs` row. No live forward to :8000/:8080. This is enforced at
   two layers: (a) the server action never calls adapter control methods; (b) `applyConfig` in all
   adapters (mock-tortila.ts:114, mock-legacy.ts:79, http.ts:43–46) throws `BotControlDisabledError`
   unconditionally via `assertBotControlAllowed(action, false, false)`.

2. Live control stays disabled. `BOT_CONTROL_ENABLED` / `FEATURE_LIVE_BOT_CONTROL` must not be set
   in development or staging. `control.ts:16–18` enforces this at the package level, not just in UI.
   This cannot be relaxed until all four gates in `BOT_CONTROL_SAFETY_MODEL.md:95–150` are satisfied.

3. "Stop bot" does not close positions. This statement is a hard invariant, not a UI hint. It must
   appear (a) in the static disclaimer text on every bot sub-page that mentions controls; (b) in the
   future stop-confirmation dialog (when controls are eventually enabled); (c) in the `BotControlDisabledError`
   message itself (which currently states it — `control.ts:7–13`).

4. Snapshot tables are worker-written. The UI must not write to `bot_metric_snapshots`,
   `bot_position_snapshots`, `bot_trade_imports`, or `bot_safety_events` from a user-facing server
   action. These tables are worker-only write paths.

5. Safety acknowledge is admin-only. The `acknowledgeBotSafetyEvent` repo function must be called
   only from a server action that has verified the calling user has role `admin` via server-side RBAC.
   There is no user-level acknowledge; non-admin users see events as read-only.

6. mock-mode banner is required on all bot sub-pages. Safety and settings pages are the two currently
   missing it (Finding 4 gap). Both must add the banner before Phase 2.1 is considered complete.

7. `validateConfig` is always called before a DB write. It is a pure Zod check with no network request.
   It is called on the adapter (not on the server action directly) so that the mock and real adapters
   enforce the same schema rules. For Phase 2.1, the Zod schemas defined in `validateConfig` in
   `mock-tortila.ts:100–104` and `mock-legacy.ts:68–71` are the validation implementation — they must
   be promoted to dedicated schema files (`tortila.schemas.ts`, `legacy.schemas.ts`) per the target
   package structure in `BOT_INTEGRATION_PLAN.md:386–401`.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Config save server action accidentally calls `adapter.applyConfig()` | P0 | `applyConfig` throws `BotControlDisabledError` unconditionally at adapter layer regardless — this is defence-in-depth, but the server action must also not attempt the call. Code review gate. |
| `bot_configs.version` counter race: two concurrent saves compute the same next_version | P1 | Use `SELECT FOR UPDATE` on the `bot_configs` row, or use a DB-level UNIQUE constraint on `(bot_instance_id, version)` in `bot_config_versions` (already specified in db-architect handoff) — the insert will fail on collision rather than silently overwriting. |
| Safety acknowledge exposes admin action to non-admin via direct POST | P1 | Server-side RBAC check in the server action using `requireUser()` + role assertion before calling the repo function. Client-side hiding of the button is not sufficient. |
| Worker not yet wired → `bot_metric_snapshots` / `bot_position_snapshots` empty in DB → UI might fall back to stale adapter data without labelling it as stale | P1 | All fallback data from the adapter in mock mode must show the "Simulated data" banner. For read-only mode with no DB rows, the UI must show the staleness label (last sync time) from `integration_health_checks`. |
| `safety/page.tsx` missing mock-mode banner | P1 | Implementation gap identified in Finding 4. Must be added before Phase 2.1 ships. |
| Tortila P0 (`TP_RECONCILIATION_PENDING`) must persist across adapter mode changes | P0 | `TORTILA_PERSISTENT_WARNINGS` in `warnings.ts:33–46` is injected by both mock and http adapters. Any refactor that removes these from the warnings array before the journal reports `tp_reconcile_ok` is a regression. Test assertion required. |
| Config save without ownership check: user A saves config for user B's bot_instance | P1 | Server action must verify `bot_instances.user_id = $currentUserId` before any write. If the bot_instance belongs to a different user, return 403. See Finding integration tests below. |
| Legacy bot `legacy_plaintext_keys` warning: if a real Legacy adapter is ever used, `getConfig()` throws `AdapterNotReadyError` — this prevents the plaintext keys from reaching WTC. Confirmed in `http.ts:111–113`. | P0 | The `AdapterNotReadyError` on `getConfig` is the correct defence. Must not be replaced by a real implementation until the Legacy bot removes keys from its API response (tracked as P0 in `CONTRACTS/legacy-bot-adapter.md`). |

---

## Verification/tests

The following integration tests must pass before Phase 2.1 config-save and safety-event features
are considered production-ready. All tests use the PGlite test harness pattern established in
`tests/integration/db-persistence.test.ts`.

### 1. Bot-config ownership isolation

Test: User A cannot save a config for a bot_instance owned by User B.

```
setup:
  userA = createUser()
  userB = createUser()
  instanceA = createBotInstance(userA.id, 'tortila_bot')
  instanceB = createBotInstance(userB.id, 'legacy_bot')

assertions:
  - saveBotConfig(db, {botInstanceId: instanceA.id, userId: userA.id, configJson: {...}})
      → succeeds; bot_config_versions has 1 row for instanceA
  - saveBotConfig(db, {botInstanceId: instanceB.id, userId: userA.id, configJson: {...}})
      → throws OwnershipError or returns { ok: false, error: 'forbidden' }
  - bot_config_versions still has 0 rows for instanceB after the second call
```

### 2. Config versioning: monotonic append-only

Test: Each save increments version by 1; versions are never skipped or duplicated.

```
setup:
  instance = createBotInstance(user.id, 'tortila_bot')
  // bot_configs starts at version=1 (default) per schema.ts:131

assertions:
  - saveBotConfig(db, {botInstanceId: instance.id, userId: user.id, configJson: {v:'a'}})
      → bot_configs.version = 2; bot_config_versions has row (version=2, config_json={v:'a'})
  - saveBotConfig(db, {botInstanceId: instance.id, userId: user.id, configJson: {v:'b'}})
      → bot_configs.version = 3; bot_config_versions has 2 rows (v=2 and v=3)
  - listBotConfigVersions(db, instance.id)
      → returns [{version:3, ...}, {version:2, ...}] (DESC order)
  - INSERT INTO bot_config_versions (bot_instance_id, version, ...) VALUES (instance.id, 2, ...)
      → fails with unique constraint violation on (bot_instance_id, version)
```

### 3. Safety event critical → in-txn audit

Test: Inserting a `bot_safety_events` row with `severity = 'critical'` writes an `audit_logs` row
in the same transaction. Inserting with `severity = 'warning'` or `'info'` does not write an
audit row.

```
setup:
  instance = createBotInstance(user.id, 'tortila_bot')

assertions:
  - insertBotSafetyEvent(db, {botInstanceId: instance.id, eventCode: 'TP_RECONCILIATION_PENDING',
      severity: 'critical', description: 'test'})
      → bot_safety_events has 1 row
      → audit_logs has 1 row with action='bot.safety_event', resource_id=instance.id
  - insertBotSafetyEvent(db, {botInstanceId: instance.id, eventCode: 'MARGIN_PREFLIGHT_MISSING',
      severity: 'warning', description: 'test'})
      → bot_safety_events has 2 rows
      → audit_logs still has 1 row (no new audit row for warning)
  - insertBotSafetyEvent(db, {botInstanceId: instance.id, eventCode: 'FILL_LOOKUP_109421',
      severity: 'info', description: 'test'})
      → bot_safety_events has 3 rows
      → audit_logs still has 1 row (no new audit row for info)
```

### 4. Safety event acknowledgement: admin-only

Test: Only admin users can acknowledge safety events; non-admin gets a rejection.

```
setup:
  adminUser = createUser(role='admin')
  regularUser = createUser(role='user')
  event = insertBotSafetyEvent(db, {..., severity: 'critical'})

assertions:
  - acknowledgeBotSafetyEvent(db, event.id, adminUser.id)
      → event.acknowledged_at is set; event.acknowledged_by = adminUser.id
      → audit_logs has 1 row with action='bot.safety_event_ack', actor_user_id=adminUser.id
  - acknowledgeBotSafetyEvent(db, event.id, regularUser.id)
      → throws ForbiddenError or returns { ok: false, error: 'admin required' }
      → event.acknowledged_by is still adminUser.id (not overwritten)
```

### 5. No adapter control method callable from config save

Test: The settings server action must not be able to call startBot / stopBot / applyConfig.

```
assertions (unit test, not integration):
  - createMockTortilaAdapter().startBot('any')
      → throws BotControlDisabledError (confirmed: mock-tortila.ts:106–109)
  - createMockTortilaAdapter().stopBot('any')
      → throws BotControlDisabledError (confirmed: mock-tortila.ts:111–114)
  - createMockTortilaAdapter().applyConfig('any', {})
      → throws BotControlDisabledError (confirmed: mock-tortila.ts:115–118)
  - Same three assertions for createMockLegacyAdapter() (confirmed: mock-legacy.ts:73–86)
  - createHttpTortilaAdapter('http://localhost:8080').startBot('any')
      → throws BotControlDisabledError (confirmed: http.ts:34–37)
```

### 6. Mock banner present on all bot sub-pages

Test (Playwright e2e or snapshot test): When `BOT_ADAPTER_MODE=mock`, visit each bot sub-page
and assert that the text "Simulated data — not a live account" is visible on screen.

```
pages to check:
  - /app/bots/tortila         (overview — confirmed present)
  - /app/bots/tortila/positions (confirmed present)
  - /app/bots/tortila/trades    (confirmed present)
  - /app/bots/tortila/equity    (confirmed present)
  - /app/bots/tortila/safety    (MISSING — gap identified in Finding 4)
  - /app/bots/tortila/settings  (MISSING — not yet implemented)
  - /app/bots/legacy and all sub-pages (same coverage required)
```

---

## Next actions

These are ordered by priority. Implementation is delegated to the appropriate Wave-2 implementer
agent. This auditor owns specification only.

1. **[P0] Add mock-mode banner to `safety/page.tsx`** (Finding 4 gap). One-line addition:
   after `<BotSubNav .../>`, insert the same `adapter.mode === 'mock'` conditional block present
   in positions/trades/equity pages.

2. **[P0] Implement settings-page server action** with the exact transaction sequence from Finding 1:
   `validateConfig` → ownership check → `UPDATE bot_configs` + `INSERT bot_config_versions` +
   `INSERT audit_logs` in a single transaction. Server action must annotate `'use server'`, verify
   CSRF, verify `requireUser()`, verify `bot_instances.user_id = currentUserId`, and never call
   any adapter control method.

3. **[P0] Add mock-mode banner to the settings page** once implemented (Finding 4 gap).

4. **[P1] Promote validateConfig Zod schemas to dedicated schema files** per the package structure
   target in `BOT_INTEGRATION_PLAN.md:386–401` (`tortila.schemas.ts`, `legacy.schemas.ts`).
   The current inline schemas in mock adapters are dev stubs — the server action's validation must
   import from the schema package, not re-implement inline.

5. **[P1] Extend safety page to query `listBotSafetyEvents`** from the DB once migration 0002 lands
   (Finding 6). Show persisted history below active-warning banners. Add the DB empty state message
   from Finding 4.

6. **[P1] Add comment to `schema.ts` bot_configs table** clarifying column name difference between
   `bot_configs.config` (live current) and `bot_config_versions.config_json` (history log).

7. **[P1] Write the five integration tests** specified in Verification/tests above.
   File: `tests/integration/db-persistence.test.ts` (existing PGlite pattern).

8. **[P2] Relabel overview page "Closed PnL" card** as "Closed PnL (gross)" or add a second card
   for `netPnlWithFees` (Finding 7). The trades page already labels this correctly; the overview
   should match.

9. **[P2] Extend "Stop bot" disclaimer text** on overview page to include the exact phrasing from
   `BOT_CONTROL_SAFETY_MODEL.md:49` (Finding 8): "Stopping the bot does NOT close positions —
   your open positions remain on the exchange."

10. **[Future] Wire worker to call adapter and write snapshot tables** per `BOT_INTEGRATION_PLAN.md:342`.
    Until then, honest empty-state messages from Finding 4 are the correct UI behaviour.
