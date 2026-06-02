# ecosystem-bot-integration-auditor handoff
## Scope
Read-only live bot/server audit for WTC Ecosystem Platform on 2026-06-02 from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope covered current WTC adapter support for Tortila and Legacy bots, live server process/endpoint classification, minimum safe read-only connection path, production blockers before `BOT_ADAPTER_MODE=read-only`, and canary-safe adapter/control settings.

No product code, configs, bot directories, server files, bot processes, WTC processes, exchange state, DB state, provider state, or secrets were modified. SSH was used only for read-only classification of service active states, listening ports, tmux session names, safe health responses, and OpenAPI path names/methods. No env files or process environments were read.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-1918-ecosystem-bot-integration-auditor.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/INTEGRATION_MAP.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- Read-only SSH classification of `ubuntu@54.179.188.61` without env/secrets.

## Files changed
None — read-only audit

## Findings
1. Severity: High. Evidence: `packages/bot-adapters/src/factory.ts:26` to `packages/bot-adapters/src/factory.ts:38` selects mock by default, real Tortila only when non-mock mode plus Tortila base URL exists, and routes every non-mock Legacy request to `createLegacyBlockedAdapter`; `packages/bot-adapters/src/http.ts:75` to `packages/bot-adapters/src/http.ts:88` implements Tortila health/summary/equity/trades/positions read-only and explicitly excludes `/api/marks`; `packages/bot-adapters/src/http.ts:90` to `packages/bot-adapters/src/http.ts:183` refuses unauthenticated real reads and keeps `getConfig` not implemented. Recommendation: classify WTC support as Tortila mock plus gated read-only data, Legacy mock plus hard-blocked non-mock, and no audited control for either bot. Target part: adapter capability truth.

2. Severity: High. Evidence: `packages/bot-adapters/src/control.ts:1` to `packages/bot-adapters/src/control.ts:17` requires both a flag and audit approval before any control method can proceed; `packages/bot-adapters/src/http.ts:57` to `packages/bot-adapters/src/http.ts:70`, `packages/bot-adapters/src/mock-tortila.ts:120` to `packages/bot-adapters/src/mock-tortila.ts:130`, and `packages/bot-adapters/src/legacy/legacy-blocked.ts:89` to `packages/bot-adapters/src/legacy/legacy-blocked.ts:99` all hard-disable `startBot`, `stopBot`, and `applyConfig`; `docs/BOT_CONTROL_SAFETY_MODEL.md:93` to `docs/BOT_CONTROL_SAFETY_MODEL.md:151` keeps required live-control gates not green. Recommendation: keep all live controls disabled; do not expose or route bot start/stop/apply-config from WTC. Target part: live-control safety.

3. Severity: High. Evidence: read-only SSH observed `turtle-bot.service` active/running, `turtle-journal.service` active/running, `journal-server.service` active/running, `nginx.service` active/running, and `wtc-ecosystem-preview.service` not found/inactive; `ss -ltnp` observed Legacy FastAPI on `0.0.0.0:8000` via `python3`, Tortila journal on `0.0.0.0:8080` via `python`, Axioma journal on `127.0.0.1:8123`, and nginx on `:80`/`:443`; `tmux list-sessions` observed session `bot`. Local corroboration: `docs/handoffs/0000-orchestrator-seed.md:20` to `docs/handoffs/0000-orchestrator-seed.md:28` identifies Legacy as `/home/ubuntu/apps/bot` in tmux `bot` on `:8000`, Tortila worker as `turtle-bot.service`, and Tortila journal as `turtle-journal.service` on `:8080`; `docs/handoffs/0000-orchestrator-seed.md:41` warns bot ports are bound to `0.0.0.0` with no discovered reverse proxy. Recommendation: do not touch `turtle-bot.service`, `turtle-journal.service`, tmux session `bot`, ports `8000`/`8080`, bot code dirs, bot DBs, or bot env/config; WTC must layer above them. Target part: live server process boundary.

4. Severity: High. Evidence: read-only SSH safe health checks observed Tortila `GET /api/health` returning `ok:true`, Legacy `GET /docs` and `GET /openapi.json` returning HTTP 200, and Axioma `GET /health` returning service ok; read-only OpenAPI path-name extraction observed Legacy paths `/auth/login`, `/auth/register`, `/api_management/`, `/api_management/{api_id}`, `/api_management/{api_id}/retest`, `/api_management/{api_id}/settings`, and `/api_management/{api_id}/stage_config`; Tortila paths include `/api/health`, `/api/summary`, `/api/overview`, `/api/equity`, `/api/trades`, `/api/trades/list`, `/api/decisions`, `/api/activity`, `/api/metrics/advanced`, `/api/symbol_breakdown`, `/api/monthly`, `/api/calendar`, `/api/distribution`, `/api/drawdown`, `/api/marks`, and HTML/dashboard paths. Local docs match this at `docs/BOT_INTEGRATION_PLAN.md:258` to `docs/BOT_INTEGRATION_PLAN.md:284` and `docs/BOT_INTEGRATION_PLAN.md:304` to `docs/BOT_INTEGRATION_PLAN.md:315`. Recommendation: use only Tortila journal GET endpoints already mapped by WTC and never call `/api/marks`; do not use Legacy management endpoints until plaintext-key remediation and service-account gates are cleared. Target part: endpoint boundary.

5. Severity: High. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:113` to `docs/CONTRACTS/legacy-bot-adapter.md:138` documents that Legacy API responses include plaintext `api_key` and `secret_key`; `docs/CONTRACTS/legacy-bot-adapter.md:363` to `docs/CONTRACTS/legacy-bot-adapter.md:382` says this must be remediated before production read-only use; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1` to `packages/bot-adapters/src/legacy/legacy-blocked.ts:16` states the blocked adapter is the only non-mock Legacy path and makes no network calls; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:27` to `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:60` tests that non-mock Legacy remains blocked. Recommendation: classify Legacy as mock-only for user data and blocked in `read-only`/`audited`; do not probe authenticated `/api_management/*` from WTC or this audit. Target part: Legacy bot adapter.

6. Severity: High. Evidence: `docs/CONTRACTS/tortila-adapter.md:32` to `docs/CONTRACTS/tortila-adapter.md:44` says the Tortila journal currently has no auth and requires token auth plus port restriction before production; `packages/config/src/env.ts:96` to `packages/config/src/env.ts:100` requires `JOURNAL_READ_TOKEN` for non-mock production mode; `packages/bot-adapters/src/http.ts:93` to `packages/bot-adapters/src/http.ts:98` and `packages/bot-adapters/src/http.ts:154` to `packages/bot-adapters/src/http.ts:155` refuse unauthenticated real reads. Recommendation: before Tortila read-only production, add/prove journal auth, store the read token via approved secret handling, restrict `:8080` to WTC, and verify mapped endpoint shapes without `/api/marks`. Target part: Tortila production read-only gate.

7. Severity: High. Evidence: `docs/BOT_INTEGRATION_PLAN.md:13` to `docs/BOT_INTEGRATION_PLAN.md:14` and `docs/BOT_INTEGRATION_PLAN.md:350` to `docs/BOT_INTEGRATION_PLAN.md:353` define the intended path as bot runtime -> adapter -> WTC DB snapshots -> WTC UI; `apps/worker/src/index.ts:151` to `apps/worker/src/index.ts:186` builds the Tortila adapter for the worker using `BOT_ADAPTER_MODE`, journal URL, and `JOURNAL_READ_TOKEN`; `apps/worker/src/jobs.ts:105` to `apps/worker/src/jobs.ts:248` writes health, metric, position, and trade snapshots read-only; but `apps/web/src/features/bots/data.tsx:135` to `apps/web/src/features/bots/data.tsx:158` still constructs an adapter directly for user-facing bot pages. Recommendation: minimum safe read-only path is worker-only Tortila polling into DB snapshots, with user pages reading DB state in production; direct web adapter reads should stay mock/diagnostic until explicitly approved. Target part: dashboard data path.

8. Severity: Medium. Evidence: `apps/web/src/features/admin/queries.ts:338` to `apps/web/src/features/admin/queries.ts:445` reads admin bot health from `integration_health_checks` and latest `bot_metric_snapshots`, with `liveControlDisabled` and `legacyAdapterBlocked` hardcoded true; `apps/web/src/app/admin/bots/page.tsx:89` to `apps/web/src/app/admin/bots/page.tsx:127` displays safety-disabled state plus persistent Tortila P0/P1 warnings; `packages/bot-adapters/src/warnings.ts:32` to `packages/bot-adapters/src/warnings.ts:66` keeps Tortila and Legacy warning codes first-class. Recommendation: use `/admin/bots` and `/admin/system-health` as DB-backed canary observation surfaces after a managed worker is deployed, not as live control panels. Target part: operations canary.

9. Severity: Medium. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:57` to `docs/PRODUCTION_BLOCKERS_CURRENT.md:69` keeps Stripe, Legacy, Axioma, TradingView, LMS live gates, worker service, and production/server checks incomplete; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:5` to `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:10` says local dry-runs and PGlite/local gates are not substitutes for remaining live gates; `docs/PRODUCTION_BLOCKERS_CURRENT.md:47` to `docs/PRODUCTION_BLOCKERS_CURRENT.md:55` records Phase 3.63 as local/dry-run hardening, not production live-bot acceptance. Recommendation: do not mark production bot read-only enabled until the specific bot live gates are run in an approved phase and recorded green. Target part: production readiness truth.

10. Severity: Medium. Evidence: `packages/db/src/schema.ts:420` to `packages/db/src/schema.ts:443` defines `bot_metric_snapshots` with a non-unique index on `(botInstanceId, snapshotAt)`; `packages/db/src/repositories.ts:1707` to `packages/db/src/repositories.ts:1708` inserts metric snapshots unconditionally; `packages/db/src/repositories.ts:1736` to `packages/db/src/repositories.ts:1747` shows only trade imports are idempotent with conflict handling, while `docs/BOT_INTEGRATION_PLAN.md:367` to `docs/BOT_INTEGRATION_PLAN.md:370` describes dedupe for equity points. Recommendation: before relying on repeated worker read-only imports, reconcile metric/equity idempotency by adding a unique key/upsert or updating the contract to state metrics are append-only. Target part: snapshot import correctness.

## Decisions
- Treated this as a read-only live bot/server audit plus the explicitly allowed handoff artifact only.
- Used SSH only for read-only service/port/route classification. Did not read remote env files, process environments, DB contents, bot configs, or server files.
- Did not run `npm test`, Playwright, worker ticks, migrations, seed, preview, deploy, provider commands, or any bot control command.
- Did not call authenticated Legacy endpoints because they may expose plaintext exchange keys.
- Did not call Tortila `/api/marks` because the contract excludes it and it can touch exchange-owned mark data.
- Classified `audited` control as not supported in practice because every adapter control method still throws and the documented gates are not green.
- No background agents were spawned by this auditor; none are left running.

## Risks
- Setting `BOT_ADAPTER_MODE=read-only` in production today can activate real Tortila HTTP reads from both worker code and current user-facing web route loaders if a URL/token are configured.
- Tortila journal is currently reachable on `0.0.0.0:8080` and the docs still require auth plus firewall restriction before production WTC read-only use.
- Legacy FastAPI is live on `0.0.0.0:8000`, but authenticated API management responses are documented to expose plaintext exchange-key fields; WTC must not proxy or ingest them.
- The live bots are running and trading-critical; touching `turtle-bot.service`, `turtle-journal.service`, tmux session `bot`, bot env/config, bot DBs, or process controls risks interrupting the existing bots.
- Worker snapshot/import behavior exists but production freshness depends on a managed worker process, DB bindings, approved secrets, and admin heartbeat verification.
- Metric/equity snapshot dedupe remains ambiguous in current DB code versus docs.

## Verification/tests
RUN in this read-only audit:

| Gate/check | Command/check | Result |
|---|---|---|
| Protocol/docs read | Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, bot contracts, bot plan, integration map, blockers, acceptance matrix | PASS |
| Static code audit | `rg` plus line-numbered reads of adapter factory, HTTP adapter, blocked Legacy adapter, control gate, worker, web bot loaders, admin health, DB schema/repos, tests | PASS |
| Target handoff absence check | `Test-Path docs\handoffs\20260602-2029-ecosystem-bot-integration-auditor.md` before write | PASS, file absent |
| Git state check before write | `git rev-parse --show-toplevel; git status --short` | PASS, git-backed now; one unrelated untracked security-auditor handoff existed before this write |
| Git state check after write | `git status --short` | PASS for scope tracking; this auditor added only this handoff. Current worktree also showed unrelated `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`, and `docs/handoffs/20260602-2029-ecosystem-security-auditor.md` changes not made by this auditor |
| Read-only SSH service/port classification | `systemctl show` selected services, `ss -ltnp`, `tmux list-sessions`, safe `curl` health/status checks | PASS; no control commands, no env reads |
| Read-only SSH route-name classification | OpenAPI path/method extraction only for `:8000` and `:8080` | PASS; paths/methods only, no schemas/secrets |
| Live-service safety | No start/stop/restart/apply-config/tmux-send/systemd mutation/deploy/server-file mutation commands were run | PASS |

NOT RUN in this audit:

| Gate/check | Reason |
|---|---|
| `npm test`, focused Vitest, typecheck, lint, coverage | Not run; static read-only audit and only handoff artifact allowed |
| Playwright/e2e/preview smoke | Not run; outside this live bot/server audit and could create artifacts or start app runtime |
| `npm run worker:smoke`, worker tick, DB migrations/seeds | Not run; worker/DB paths can write health/snapshot rows and were outside read-only scope |
| Tortila `BOT_ADAPTER_MODE=read-only` acceptance | Not run; journal auth/firewall/token/worker deployment gates are not cleared |
| Legacy authenticated API acceptance | Not run; blocked because upstream API may expose plaintext exchange keys |
| Tortila `/api/marks` | Not run; explicitly forbidden/excluded because bot owns exchange connection |
| Start/stop/restart/apply-config/live control | Not run; forbidden and hard-disabled |
| Remote env/config/DB/log secret inspection | Not run; forbidden by no-secret/no-modification scope |
| Deploy/nginx/systemd/server mutation | Not run; forbidden |
| GitHub CI | Not run; no commit/PR requested |

## Next actions
1. Keep current deploy canary safe with `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` until a dedicated approved Tortila read-only phase clears token, firewall, worker, DB, and UI-source gates.
2. For minimum safe Tortila read-only connection, do not modify bot code/config first; instead firewall `:8080` to WTC, provision a journal read token through approved secret handling, run the WTC worker with `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL`, `JOURNAL_READ_TOKEN`, and a system bot binding, then verify DB-backed `integration_health_checks` and snapshots in `/admin/bots`.
3. Keep Legacy blocked. A future Legacy read-only path requires upstream removal of plaintext key fields or a safe summary endpoint, a dedicated read-only service account, vaulted credentials, `:8000` firewall restriction, redaction tests, and written security acceptance.
4. Refactor or production-gate user-facing bot pages so production dashboards read WTC DB snapshots rather than constructing live adapters in request rendering.
5. Resolve metric/equity snapshot idempotency before relying on repeated production imports.
6. Keep `turtle-bot.service`, `turtle-journal.service`, tmux session `bot`, bot env/config files, bot DBs, and exchange state untouched unless the operator starts a separately scoped bot-owner maintenance session.
