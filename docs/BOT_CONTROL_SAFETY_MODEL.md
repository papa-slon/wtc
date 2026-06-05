# Bot Control Safety Model

Owner: ecosystem-bot-integration-auditor
Status: Phase 0 — all controls are mock/disabled. No live bot interaction.
Last updated: 2026-05-29

Related: [BOT_INTEGRATION_PLAN.md](./BOT_INTEGRATION_PLAN.md),
[SECURITY_MODEL.md](./SECURITY_MODEL.md),
[AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md)

---

## Safe Default: All Controls Mock / Read-Only

**The default state of all bot controls in WTC is disabled.**

Until every gate in §"Required Gates" is passed, all control methods
(`startBot`, `stopBot`, `applyConfig`) throw `ControlDisabledError` at the adapter level.
No environment configuration can enable them during Phase 0–3. A feature flag
`BOT_CONTROL_ENABLED=true` is required, and this flag must not be set in any
development or staging environment until the audit is complete.

This is not a UI-only restriction. The restriction lives in the adapter code and is
enforced regardless of what the UI sends.

---

## Explicit Prohibitions

The following actions are permanently prohibited from WTC — they can never be enabled
even after audit, without replacing the adapter entirely with a separately reviewed component:

| Prohibited Action | Why |
|---|---|
| SSH to any server from WTC | WTC is a web app; SSH is a server-side shell operation. Risk of privilege escalation, key exposure, arbitrary command execution. |
| `systemctl start/stop/restart` or `service` calls | Direct systemd control bypasses all exchange safety nets, leaves orders open on exchange. |
| `tmux send-keys` or any tmux/screen session interaction | Same as systemctl — bypasses bot's own safety gates. Tortila uses systemd; Legacy uses tmux. Both are off-limits. |
| Process kill / SIGTERM / SIGKILL via WTC | Abrupt termination leaves orders on exchange in unknown state. |
| `.env` file writes or mutations | Secrets must never be written by WTC. Config changes go through bot's own API (when audited). |
| Exchange API calls (place order, cancel order, close position) via WTC | WTC must never be an order execution path. The exchange connection belongs to the bot. |
| Reading or logging exchange API keys from bot environments | Keys are encrypted at rest on the bot host. WTC manages its own vault for user-configured keys only. |
| Clearing or resetting bot SQLite/PostgreSQL state | WTC is a read-only consumer of bot data. |
| Overwriting bot configuration files directly | Config changes must go through the bot's own validated config pipeline. |

---

## "Stop Bot" is NOT "Close Positions"

This distinction is critical and must be surfaced to the user **before** any stop action.

When a trading bot stops:
- The bot process halts its trading loop.
- **All open positions remain on the exchange as-is.**
- **All open orders (stop-losses, TPs, entries) remain on the exchange as-is.**
- If the bot was managing a stop-loss order, that stop-loss remains active — the exchange
  will still execute it if price hits the trigger.
- If the bot crashes during a position, the stop-loss may already be placed; if not,
  the position is **unprotected** until an operator manually intervenes.

**The operator is responsible for all open positions after stopping the bot.**

WTC UI requirements when stop control is eventually enabled:
1. Show all currently open positions with entry price, current stop, unrealized PnL.
2. Show an explicit confirmation dialog: "Stopping the bot does NOT close positions.
   Your [N] open positions remain on [Exchange]. You must close them manually if desired."
3. Require the user to type "I understand" or check a confirmation box.
4. Log the stop request and confirmation to the audit log with full position snapshot.
5. Never infer that positions are closed after a stop event.

Until stop control is enabled, WTC admin and user bot evidence pages show no runtime
control buttons. Any future disabled control affordance, including a read-only
"Stop Bot" placeholder, must be scoped and audited separately before it appears in
the UI.

---

## "Apply Config" is NOT "Stop and Restart"

Applying a new config to the bot is a separate action from stopping and starting.
On Tortila: config is loaded at startup from the `.env` file; there is no live reload.
Changing config therefore requires a restart — which carries all the same risks as a stop.
The WTC adapter must not silently restart the bot when applying config.

Order of operations when config change is eventually enabled:
1. `validateConfig()` → must pass without errors.
2. Show diff of what will change.
3. User explicitly confirms.
4. If restart is required, show the full stop-bot warning (positions remain open).
5. Write new config version to `bot_config_versions`.
6. Audit log: record old config, new config diff, user who approved, timestamp.
7. Bot restart (if required) is a separate, separately confirmed action.

---

## Required Gates Before ANY Live Control Is Enabled

All four gates must be satisfied and documented before `BOT_CONTROL_ENABLED=true`
is set in any environment that touches a live exchange account.

### Gate 1: Security Audit

Required evidence:
- `docs/SECURITY_MODEL.md` reviewed and signed off by a senior engineer.
- RBAC enforced server-side on all control endpoints.
- Audit log covers all control actions with pre/post state.
- Control endpoints rate-limited and CSRF-protected.
- No control actions accessible without active entitlement + correct role.
- Penetration test or threat model covering replay attacks on control endpoints.

Status: NOT STARTED.

### Gate 2: Bot Integration Audit (this document)

Required evidence:
- `docs/BOT_INTEGRATION_PLAN.md` complete and reviewed.
- `docs/BOT_CONTROL_SAFETY_MODEL.md` complete and reviewed (this document).
- All adapter interface tests passing (Vitest unit + integration mock).
- Mock adapter verified to produce identical shapes to real adapter.
- Known Tortila P0/P1 issues documented (TP reconciliation, margin pre-flight) —
  these must be resolved or explicitly accepted in writing before live control.
- Stale data labelling verified in Playwright e2e tests.

Status: IN PROGRESS (Phase 0 documentation).

### Gate 3: Exchange Safety Audit

Required evidence:
- For Tortila: Tortila's own live-gate (`I_UNDERSTAND_LIVE_TRADING=YES` + `--live` flag)
  is confirmed active and not bypassed by WTC.
- For Legacy: Legacy bot's quarantine mechanism (`quarantined` flag on `Api_Key`) is
  visible to WTC and surfaced as a warning when quarantine is active.
- Exchange API key permissions are confirmed as minimal required (no withdrawal permissions,
  no full account permissions beyond what the bot needs).
- Position reconciliation is verified to work correctly before live control.
- For Tortila: P0 TP reconciliation/restore must be implemented and tested.
- For Tortila: P1 margin pre-flight must be implemented and tested.

Status: NOT STARTED.

### Gate 4: Integration Tests

Required evidence:
- Vitest integration tests cover all control method failure modes (disabled state, auth failure,
  config validation failure, timeout, adapter error).
- Playwright e2e tests cover:
  - Stop bot warning dialog and confirmation flow.
  - Config apply diff and confirmation flow.
  - Position display during and after stop action.
  - Stale data banner behavior.
- All tests green in CI (CI pipeline pending; today local gates pass).
- Test coverage report shows >80% on `packages/bot-adapters`.

Status: NOT STARTED.

---

## Audit Log Requirements for Control Actions

Every control action (when eventually enabled) must write to `audit_logs` with:

```json
{
  "actor_user_id": "<uuid>",
  "actor_role": "admin | user",
  "action": "bot.control.start | bot.control.stop | bot.control.apply_config",
  "resource_type": "bot_instance",
  "resource_id": "<bot_instance_id>",
  "before": { "<full config/state snapshot>" },
  "after": { "<new state or config diff>" },
  "context": {
    "product_code": "tortila_bot | legacy_bot",
    "open_positions_at_action": [{ "symbol": "...", "side": "...", "qty": 0 }],
    "mode": "demo | live",
    "adapter_version": "<semver>"
  },
  "ts": "<ISO-8601>",
  "ip": "<masked or hashed>",
  "session_id": "<session uuid>"
}
```

Audit logs are append-only and are never deleted. See [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md).

---

## UI Safety Indicators (Phase 1 and Beyond)

Even before control is enabled, the WTC UI must show:

| Indicator | Source | Display Rule |
|---|---|---|
| Bot process state badge | `BotHealth.status` | `healthy` = green, `degraded` = amber, `stale` = amber, `down` = red |
| Mode badge | `BotHealth.mode` | `live` = prominent red/gold badge; `demo` = muted badge |
| Warning list | `BotHealth.warnings[]` | Always shown when non-empty; never hidden by a "healthy" summary |
| P0 warning banner | `tp_reconcile_p0` warning code | Persistent amber banner: "Tortila TP reconciliation is unresolved. Risk of TP loss after restart." |
| P1 warning banner | `margin_preflight_p1` warning code | Persistent amber banner: "Tortila margin pre-flight is unresolved. May fail to open positions on underfunded accounts." |
| Stale data banner | `integration_health_checks` age | Shown when last health check > 10 min old: "Bot data may be delayed. Last update: N minutes ago." |
| Quarantine banner | Legacy `quarantined` field | Shown when legacy bot API key is quarantined: "Bot is quarantined. Reason: [reason]. Contact admin." |

All banners use the WTC design token `--red:#ff6b74` for error, `--gold:#d5a94f` for warning.

---

## Tortila-Specific Known Issues (Must Surface as Warnings)

These are **P0/P1 open items** from the Tortila bot discovery. They are not hidden or
suppressed — they appear as first-class product warnings in the WTC UI.

### P0: TP Reconciliation / Restore

**Code:** `tp_reconcile_p0`
**Severity:** error

The Tortila bot places TP (take-profit) limit orders on BingX. If the bot restarts
while a TP order is active, the bot does not currently restore the TP tracking state
from the SQLite DB. The TP order may still exist on the exchange, but the bot treats
it as absent and may re-place it (double TP) or miss the fill.

This is a known P0 risk item from the discovery log. It affects live accounts.

**WTC treatment:** Always surface as an error-level warning on the Tortila dashboard.
Never show a "healthy" summary card while this item is unresolved.

**Remediation path:** Tortila team must implement TP reconciliation on startup.
WTC adapter clears this warning only after Tortila journal reports a `tp_reconcile_ok`
state key (or equivalent mechanism), not automatically.

### P1: Margin Pre-Flight

**Code:** `margin_preflight_p1`
**Severity:** warning

The Tortila bot does not currently verify available margin before attempting to open
a new position. If the account is underfunded (e.g., after fees, funding payments, or
existing position margin consumption), the order is rejected by BingX with an error.
The discovery log shows at least one instance of a LINK position add being blocked by
margin constraints.

**WTC treatment:** Surface as a warning-level banner on the Tortila dashboard.
Recommend users monitor equity and available margin separately.

### Discovery Log Risk Signals

These signals were observed in Tortila logs during the read-only discovery audit:

| Code | Observed Behavior | WTC Treatment |
|---|---|---|
| `101211` | "Order price should be higher than..." — NEAR TP rejection when mark price moved | Adapter checks safety events for this code and surfaces as a warning |
| `100410` | BingX rate-limit or funding endpoint error | Adapter surfaces when observed in recent safety events |
| `109421` | Fill-detail lookup: "order not exist" on BingX — happens during reconciliation | Adapter surfaces when observed in recent safety events |
| `exchange_flat_mismatch` | Exchange says position is flat but bot state shows open — triggers reconcile | Always surfaced as a warning with timestamp |

---

## Summary Table: What WTC Can and Cannot Do

| Action | Phase 0–2.3 | Phase 2.4 (read-only adapter CURRENT) | After All 4 Gates |
|---|---|---|---|
| Read health/config/metrics/positions/trades | Yes (mock) | Yes (real, read-only; health/summary/equity/trades CURRENT) | Yes |
| Display warnings and risk signals | Yes | Yes | Yes |
| Show equity charts from snapshots | Yes (mock) | Yes | Yes |
| Call `/api/marks` (BingX mark prices) | Never | Never | Never — bot owns exchange connection |
| Write config to bot | No | No | Audited only |
| Start bot | No | No | Audited only |
| Stop bot (with open position warning) | No | No | Audited only |
| SSH / systemd / tmux | Never | Never | Never |
| Mutate .env | Never | Never | Never |
| Place/cancel exchange orders | Never | Never | Never |
| Read bot exchange API keys | Never | Never | Never |

**Legacy adapter status:** BLOCKED at Phase 2.4. All five security gates (service account, vault,
firewall, key redaction, written security acceptance) remain NOT STARTED. The
`legacy_plaintext_keys` warning is surfaced on every legacy adapter response in every mode.
