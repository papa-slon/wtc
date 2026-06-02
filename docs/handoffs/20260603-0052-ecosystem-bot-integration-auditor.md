# ecosystem-bot-integration-auditor handoff
## Scope
Read-only audit for WTC Phase 3.65: Tortila real read-only production canary integration gates.

Objective: determine exactly what code, environment, and server gates must pass before Tortila can move from mock data to real read-only production canary data, and what must remain disabled.

This audit did not modify bot code, bot config, WTC product code, server config, secrets, live bot services, exchange state, database state, or provider state. The only artifact written is this handoff.

No SSH or live server probe was run in this session. Current server facts below are sourced from the latest Phase 3.64 handoffs and local source/docs; they must be re-verified in the activation session before any switch.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `.env.example`
- `package.json`
- `apps/worker/package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/safe-preview.mjs`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `C:\Users\maxib\GTE BOT\bot_tortila\AGENTS.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\README.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\DEPLOYMENT.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\__init__.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\metrics.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py`

## Files changed
None - read-only audit.

Exception: `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md` - this handoff only.

## Findings
1. Severity: High. Evidence: `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:52` says the canary intentionally runs `BOT_ADAPTER_MODE=mock` and `FEATURE_LIVE_BOT_CONTROL=false`; `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:94` lists real Tortila non-mock read-only acceptance as NOT RUN; `docs/PRODUCTION_BLOCKERS_CURRENT.md:11-14` keeps real Tortila/Legacy adapter acceptance and worker rollout blocked. Recommendation: do not switch the existing canary to full bot-integrated production; treat Phase 3.65 as a separate Tortila-only read-only canary gate. Target part: production status truth.

2. Severity: High. Evidence: `packages/bot-adapters/src/factory.ts:26-38` selects a real Tortila adapter only when non-mock mode plus a Tortila base URL exists, while Legacy non-mock returns the blocked adapter; `packages/bot-adapters/src/http.ts:41-50` issues GET requests with optional bearer auth; `packages/bot-adapters/src/http.ts:75-88` allowlists Tortila health, summary, trades/list, and equity while excluding `/api/marks`; `packages/bot-adapters/src/http.ts:93-98` and `packages/bot-adapters/src/http.ts:154-155` refuse unauthenticated real Tortila reads. Recommendation: the code-side Tortila adapter can support a read-only canary, but only through the current GET-only allowlist with a configured token. Target part: WTC adapter capability.

3. Severity: High. Evidence: `docs/CONTRACTS/tortila-adapter.md:32-44` says the Tortila journal has no auth in the current state and requires `JOURNAL_READ_TOKEN` plus port restriction before production; local Tortila source `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:315-318` creates the FastAPI app without auth middleware, and `app.py:572-574`, `app.py:576-622`, `app.py:626-633`, and `app.py:775-805` expose the mapped JSON endpoints as plain GET routes. Recommendation: add and prove provider-side bearer-token auth before any production WTC `BOT_ADAPTER_MODE=read-only` switch; WTC env alone is not sufficient. Target part: Tortila provider auth gate.

4. Severity: High. Evidence: `docs/CONTRACTS/tortila-adapter.md:249-262` says `/api/marks` must never be consumed from WTC because it calls BingX; local Tortila source `app.py:40-91` fetches marks through `BingXClient`, `app.py:705-725` exposes `/api/marks`, and `app.py:845-909` includes `marks` inside `/api/overview`. Recommendation: keep WTC adapter production allowlist to `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; do not use `/api/overview` for WTC until the provider removes marks or WTC strips that dependency under a separate audit. Target part: endpoint allowlist.

5. Severity: High. Evidence: `docs/BOT_INTEGRATION_PLAN.md:13-14` and `docs/BOT_INTEGRATION_PLAN.md:350-353` define the intended path as bot runtime -> adapter -> WTC DB snapshots -> WTC UI; `apps/worker/src/index.ts:151-186` builds the Tortila adapter for worker snapshot import; `apps/worker/src/jobs.ts:105-248` writes read-only health, metric, position, and closed-trade snapshots; but `apps/web/src/features/bots/data.tsx:135-158` constructs an adapter directly for user-facing bot pages and reads metrics/positions/trades/equity/config/warnings based on the same process env. Recommendation: do not set shared web canary env `BOT_ADAPTER_MODE=read-only` until either the web process reads DB snapshots only or worker and web have separate env/processes with web staying mock. Target part: web/data path blocker.

6. Severity: High. Evidence: `apps/web/src/lib/server-config.ts:5-18` reads `BOT_ADAPTER_MODE`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, and `JOURNAL_READ_TOKEN` directly from `process.env`; `apps/web/src/features/bots/journal.ts:147-214` falls back from DB imports to `loadBotReadModel(productCode, ['trades'])` when no imports exist; `tests/integration/bot-read-safety-static.test.ts:70-77` currently asserts that adapter fallback exists. Recommendation: production canary must either pre-populate DB imports and disable web adapter fallback, or keep web env mock while the worker performs read-only polling. Target part: user-facing journal route.

7. Severity: High. Evidence: `scripts/safe-worker-tick.mjs:9-14` forces `BOT_ADAPTER_MODE=mock`, live control off, and TV automation off; `package.json:21-22` maps `worker:tick` to the real one-shot worker and `worker:smoke` to the mock-forced safety script; `apps/worker/src/tick-once.ts:5-24` requires `DATABASE_URL` for a real DB tick unless explicitly running memory demo. Recommendation: `npm run worker:smoke` is useful but cannot prove Tortila real read-only; acceptance must use a managed worker process or `npm run worker:tick` with the approved production canary DB and redacted real read-only env. Target part: worker acceptance gate.

8. Severity: High. Evidence: `packages/config/src/env.ts:33-45` defines `FEATURE_LIVE_BOT_CONTROL`, `FEATURE_TV_AUTOMATION`, `BOT_ADAPTER_MODE`, Tortila URLs, system bot ids, and `JOURNAL_READ_TOKEN`; `packages/config/src/env.ts:111-115` requires `JOURNAL_READ_TOKEN` only when `NODE_ENV=production` and `BOT_ADAPTER_MODE` is not mock; `packages/config/src/env.test.ts:404-431` covers optional Tortila URL/system ids and blank-token normalization. Recommendation: the worker read-only canary env must explicitly set `NODE_ENV=production`, `APP_ENV=production`, `DATABASE_URL`, `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL` or approved internal URL, `JOURNAL_READ_TOKEN`, and one of `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID`; control flags must remain false. Target part: environment gate.

9. Severity: High. Evidence: `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:40-41` records `wtc-bot-api-firewall.service` blocking non-loopback inbound TCP access to ports `8000` and `8080`; `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:86-90` records server services active and local bot ports open while external 8000/8080 time out; `docs/handoffs/20260602-2029-ecosystem-security-auditor.md:103` says Tortila read-only prerequisites are still not satisfied because token auth and network restriction need verification. Recommendation: before activation, re-verify firewall/service state, external denial for 8000/8080, and local worker reachability to 8080 in the same activation session. Target part: server network gate.

10. Severity: High. Evidence: `packages/bot-adapters/src/control.ts:1-18` hard-disables control unless both flag and audit approval are true; `packages/bot-adapters/src/http.ts:57-70` disables Tortila control methods; `docs/BOT_CONTROL_SAFETY_MODEL.md:28-44` permanently forbids SSH/systemd/tmux/process/env/exchange mutation from WTC; `docs/BOT_CONTROL_SAFETY_MODEL.md:253-268` says reads may be real read-only but `/api/marks`, config writes, start/stop, SSH/tmux, env mutation, exchange orders, and key reads remain never/disabled. Recommendation: keep `FEATURE_LIVE_BOT_CONTROL=false`; do not use `audited` mode; do not expose start/stop/apply-config. Target part: live control safety.

11. Severity: High. Evidence: `packages/bot-adapters/src/legacy/legacy-blocked.ts:1-16` states the Legacy non-mock path is a blocked adapter with no network calls; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:27-60` asserts factory non-mock returns blocked, not live HTTP; `apps/web/src/features/bots/meta.ts:69-81` marks Legacy live adapter blocked due plaintext-key risk; `docs/PRODUCTION_BLOCKERS_CURRENT.md:75` keeps B3 blocked. Recommendation: keep Legacy mock/blocked in every Phase 3.65 setting; do not probe authenticated `/api_management/*`. Target part: Legacy boundary.

12. Severity: Medium. Evidence: `packages/db/src/schema.ts:420-466` defines metric and position snapshots as append-only with non-unique `(bot_instance_id, snapshot_at)` indexes; `packages/db/src/schema.ts:469-495` defines trade imports with a unique key; `packages/db/src/repositories.ts:1707-1724` inserts metric and position snapshots unconditionally; `packages/db/src/repositories.ts:1736-1747` makes trade imports idempotent; `tests/integration/worker-tortila-snapshot.test.ts:57-77` verifies positions append and closed trades import idempotently. Recommendation: acceptance should treat metric/position snapshots as append-only time series and closed trades as deduped imports; do not claim full equity-point dedupe unless a unique/upsert change lands. Target part: DB snapshot correctness.

13. Severity: Medium. Evidence: `packages/bot-adapters/src/warnings.ts:32-56` keeps Tortila P0/P1 warnings persistent; `packages/bot-adapters/src/tortila/tortila.mapping.ts:151-180` maps mark price and unrealized PnL as unavailable without `/api/marks`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:57-65` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:109-134` label Tortila real-mode mark/uPnL as `N/A`; `apps/web/src/app/admin/bots/page.tsx:89-127` renders hardcoded safety-disabled states and Tortila warnings. Recommendation: real read-only canary must still show "Running (warnings)" and `N/A` for mark/uPnL; a green healthy card or fabricated zero uPnL would be a regression. Target part: UI truthfulness.

## Decisions
- Treat Phase 3.65 activation as not approved yet. This audit defines gates only.
- Do not mutate or inspect bot `.env`, WTC `.env`, server process environments, bot SQLite DB contents, exchange keys, provider secrets, or logs.
- Do not run SSH, systemd, tmux, curl against live bot endpoints, worker ticks, migrations, e2e, or provider preflights in this read-only audit.
- Minimum safe Tortila canary shape: a worker-only read-only process writes DB snapshots; web remains mock or DB-only; admin observes persisted health/snapshots.
- Keep Legacy blocked, live bot control disabled, TradingView automation disabled, `/api/marks` excluded, and all live bot code/config/process control untouched.
- No background agents were spawned by this auditor; none are left running.

## Risks
- Setting `BOT_ADAPTER_MODE=read-only` on a shared web/worker canary environment can turn user page renders into live Tortila journal reads.
- Tortila provider auth is not present in the local source snapshot; a WTC token env var does not secure the journal unless the journal validates it.
- `/api/overview` includes mark-price exchange calls in the current Tortila source, so using it would violate the WTC no-exchange/no-marks boundary.
- The canary firewall state is from Phase 3.64 evidence and must be re-verified before activation; if firewall rules drift, 8080 could become reachable outside the intended boundary.
- `JOURNAL_READ_TOKEN` is a secret. It must not be committed, printed, captured in screenshots, emitted in health payloads, or stored in retained artifacts.
- Metric and position snapshots are append-only; repeated acceptance ticks can create multiple rows and should not be mistaken for deduped equity imports.

## Verification/tests
RUN in this read-only audit:

| Gate/check | Result |
|---|---|
| Protocol/docs read | PASS: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, latest Phase 3.64 aggregate and relevant Phase 3.64 per-agent handoffs read |
| Static WTC adapter audit | PASS: factory, HTTP Tortila adapter, control gate, Legacy blocked adapter, schemas, mappings, and tests inspected |
| Static worker snapshot audit | PASS: `apps/worker/src/index.ts`, `jobs.ts`, `tick-once.ts`, package scripts, safe worker script, DB schema/repos, worker tests inspected |
| Static web bot surface audit | PASS: user bot loaders/pages, journal fallback, admin bot/system-health surfaces, and safety static tests inspected |
| Local Tortila source audit | PASS: journal route source, `/api/marks`, `/api/overview`, SQLite store, and serialize_trade inspected without reading `.env` or DB contents |
| Secret discipline | PASS: no `.env`, process env, DB contents, secrets, keys, tokens, or live logs were read or printed |
| Git state before handoff | PASS: `git status --short` was clean before writing this handoff |

NOT RUN in this audit:

| Gate/check | Reason |
|---|---|
| Live SSH/server probe | Not run; this was a local read-only source audit. Phase 3.64 server facts must be refreshed in the activation session |
| `npm test`, focused Vitest, typecheck, lint, secret scan | Not run; no code behavior changed and the scope was read-only audit plus handoff |
| Playwright/browser/e2e | Not run; no app/server start or browser artifact creation requested for this read-only audit |
| `npm run worker:tick` or production worker process | Not run; would write WTC DB health/snapshot rows and needs an approved activation env |
| Tortila real read-only acceptance with `JOURNAL_READ_TOKEN` | Not run; provider auth, server, process-separation, and env gates are not yet proven |
| Tortila `/api/marks` or `/api/overview` live calls | Not run; `/api/marks` is excluded and `/api/overview` currently includes marks |
| Legacy authenticated API checks | Not run; Legacy remains B3 blocked due plaintext-key risk |
| Start/stop/restart/apply-config/tmux/systemd/bot control | Not run; forbidden |
| Remote env/config/DB/log inspection | Not run; forbidden by no-secret/no-mutation scope |
| GitHub CI | Not run; no commit/PR requested |

## Next actions
1. Keep the current canary safe now: web canary stays `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` until the gates below pass.
2. Provider/server gate: add/prove Tortila journal bearer-token auth; no-token requests to mapped endpoints must fail, valid-token requests must pass, and token values must not appear in logs, audit payloads, health rows, screenshots, or retained artifacts.
3. Server network gate: re-verify `wtc-bot-api-firewall.service` or equivalent rules, external denial for ports `8000` and `8080`, server-local reachability from the WTC worker to Tortila `:8080`, and no public reverse proxy for the journal.
4. Process gate: run read-only mode only in a separate worker process/env, or first change web bot pages to read DB snapshots only. Do not set shared web `BOT_ADAPTER_MODE=read-only` while `loadBotReadModel` can direct-fetch live journal data.
5. Worker env gate for the worker-only canary: set `NODE_ENV=production`, `APP_ENV=production`, `DATABASE_URL`, `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL` or approved internal URL, `JOURNAL_READ_TOKEN`, one of `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
6. Code/endpoint gate: keep the adapter allowlist to `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; do not use `/api/marks`, `/api/overview`, HTML `/config`, or any exchange-backed endpoint from WTC.
7. Acceptance gate before switch: run focused adapter/worker tests, production-like config validation, lint/typecheck/secret scan, a redacted one-shot worker tick against the canary DB, admin `/admin/bots` and `/admin/system-health` checks showing real `sourceAdapter='tortila'`, and browser checks confirming user pages are DB-backed or still mock.
8. Keep disabled: Legacy real adapter, all live bot control, `BOT_ADAPTER_MODE=audited`, `/api/marks`, WTC bot config apply, bot service start/stop/restart, tmux commands, bot env/config writes, bot DB mutation, exchange API calls, and exchange-key reads.
