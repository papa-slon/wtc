# ecosystem-tests-runner handoff
## Scope
Phase 3.65 read-only tests/devops audit for Tortila real read-only production canary integration.

Objective: identify the exact local, CI, and server verification stack for enabling Tortila real read-only on the production canary while keeping both live bots alive and live control disabled.

This lane did not edit product code, server files, server config, bot files, bot config, bot processes, DB rows, nginx, Docker state, provider state, or secrets. SSH and DB access were used only for read-only status/count checks with secret-like values redacted. No bot start/stop/restart/apply-config action was run.

Important live-state drift: Phase 3.64 documented the canary as `BOT_ADAPTER_MODE=mock`; during this audit the current canary container was observed restarted and running `BOT_ADAPTER_MODE=read-only` with a journal token present. This handoff treats that as an unaccepted live-state change requiring operator reconciliation, not as a green Tortila read-only acceptance.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260602-2029-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`
- `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-0053-ecosystem-security-auditor.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/RISK_REGISTER_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `.github/workflows/ci.yml`
- `package.json`
- `.env.example`
- `playwright.config.ts`
- `playwright.auth.config.ts`
- `playwright.auth-db.config.ts`
- `playwright.lms-db.config.ts`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- Git/GitHub state for `papa-slon/wtc`
- Read-only SSH server state for the operator-known server: service active states, listeners, Docker container names/status, redacted canary env flags, local HTTP status probes, firewall status, and aggregate canary DB health/snapshot counts.

## Files changed
None - read-only audit.

Exception: `docs/handoffs/20260603-0056-ecosystem-tests-runner.md` - this handoff only.

## Findings
1. Severity: High. Evidence: Phase 3.64 says the canary intentionally ran `BOT_ADAPTER_MODE=mock` and `FEATURE_LIVE_BOT_CONTROL=false` (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:52`) and lists real Tortila non-mock acceptance as NOT RUN (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:93-95`). Current read-only SSH at `2026-06-02T17:57:29Z` observed the canary container up about 3 minutes with `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL=SET_REDACTED`, and `JOURNAL_READ_TOKEN=SET_REDACTED`. Recommendation: reconcile whether this change was intentional; do not call it accepted until the worker/DB/journal-auth/UI gates below pass. If it was accidental, rollback the WTC canary env to `BOT_ADAPTER_MODE=mock` in an approved mutation step. Target part: canary runtime env.

2. Severity: High. Evidence: current read-only DB SELECTs against the canary DB returned no `integration_health_checks` rows for `worker` or `tortila-journal`, no `bot_metric_snapshots`, no `bot_position_snapshots`, and no `bot_trade_imports`; process inventory found web canary/preview containers but no accepted WTC worker service. The blocker doc still says production worker rollout/monitoring is open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:80`). Recommendation: real read-only acceptance must include a worker-only tick or managed worker service that writes redacted health/snapshot rows, followed by DB/admin verification. Target part: worker/DB acceptance.

3. Severity: High. Evidence: the Tortila contract requires journal token auth and port restriction before production read-only (`docs/CONTRACTS/tortila-adapter.md:32-44`, `docs/CONTRACTS/tortila-adapter.md:469-473`); production config requires `JOURNAL_READ_TOKEN` for non-mock production adapter mode (`packages/config/src/env.ts:111-115`); the real adapter refuses unauthenticated data reads (`packages/bot-adapters/src/http.ts:93-98`, `packages/bot-adapters/src/http.ts:154-155`). Current server-local unauthenticated `GET http://127.0.0.1:8080/api/health` returned HTTP 200, so journal-side auth enforcement is not proven by this audit. Recommendation: before accepting read-only, prove no-token requests to all mapped data endpoints fail, valid-token requests pass, and token values do not appear in logs, health payloads, retained artifacts, or UI. Target part: Tortila journal auth gate.

4. Severity: High. Evidence: the code-side Tortila adapter is GET-only and excludes exchange-owned `/api/marks` (`packages/bot-adapters/src/http.ts:1-10`); it attaches bearer auth only when token is configured (`packages/bot-adapters/src/http.ts:41-50`); data methods use `/api/summary`, `/api/trades/list`, and `/api/equity` with schema validation (`packages/bot-adapters/src/http.ts:100-120`, `packages/bot-adapters/src/http.ts:235-271`). Recommendation: keep the production allowlist to health/summary/trades-list/equity; do not use `/api/marks`, `/api/overview`, bot HTML config pages, SSH, tmux, or exchange endpoints from WTC. Target part: endpoint allowlist.

5. Severity: High. Evidence: live control is still hard-disabled in code (`packages/bot-adapters/src/control.ts:1-18`; `packages/bot-adapters/src/http.ts:57-70`), current canary env has `FEATURE_LIVE_BOT_CONTROL=false`, and Phase 3.64 did not run live start/stop/apply-config (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:93-97`). Recommendation: keep `FEATURE_LIVE_BOT_CONTROL=false`, do not use `BOT_ADAPTER_MODE=audited`, and do not run any bot control command in a read-only Tortila phase. Target part: live bot control safety.

6. Severity: High. Evidence: current SSH confirms `nginx`, `postgresql`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service` active; listeners still include `0.0.0.0:8000` and `0.0.0.0:8080`, plus WTC canary/preview on `127.0.0.1:8301/8300`; external workstation TCP showed `80 open`, `443 open`, `8000 timeout_or_closed`, and `8080 timeout_or_closed`. Phase 3.64 records the firewall service as the protection that drops non-loopback inbound access to bot API ports (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:40-41`). Recommendation: keep the firewall service enabled and monitored; do not touch bot services; preferably bind bot APIs to loopback/private interface in a separate bot-owner maintenance phase. Target part: server network boundary.

7. Severity: Medium. Evidence: `npm run worker:smoke` is not a real read-only proof because `scripts/safe-worker-tick.mjs` forces `BOT_ADAPTER_MODE=mock` (`scripts/safe-worker-tick.mjs:9-14`); the real one-shot worker path is `npm run worker:tick` (`package.json:21-22`) and requires `DATABASE_URL` for a DB tick (`apps/worker/src/tick-once.ts:5-24`). Recommendation: use `worker:smoke` only as a local safety smoke; use `worker:tick` or a managed worker service with approved read-only env for production acceptance, knowing it writes health/snapshot rows and must run only in an approved mutation phase. Target part: worker command selection.

8. Severity: Medium. Evidence: the latest GitHub Actions run at current HEAD `d973919f6333006f9af62799e59a25ae95099496` is PASS (`26826764568`), and its jobs include `gates` and `e2e` with all listed steps successful; however `docs/DEPLOYMENT.md:444-456` and `docs/DEPLOYMENT.md:542-548` still say CI and real bot adapters are NOT RUN because the repo has no GitHub remote. Recommendation: use the current GitHub run as CI evidence for HEAD, but update deployment docs in a docs-truth phase so future operators do not trust stale CI/deploy text. Target part: CI/provenance documentation.

9. Severity: Medium. Evidence: the default Playwright config forces mock mode and disabled controls (`playwright.config.ts:32-39`), while smoke specs only prove mock/no-control behavior for Tortila (`tests/e2e/smoke.spec.ts:284-314`) and system-health disabled state (`tests/e2e/smoke.spec.ts:178-186`). Recommendation: default e2e remains required for no-control regressions, but it is not a real Tortila read-only acceptance; add or run a dedicated canary/admin verification after worker DB snapshots exist. Target part: browser acceptance.

10. Severity: Medium. Evidence: current untracked Phase 3.65 bot/security handoffs disagree with the later server state: the bot handoff did not SSH and treated activation as not run; the security handoff reports mock/token-absent canary state, while this lane later observed read-only/token-present state. Recommendation: the aggregate Phase 3.65 handoff must cite the per-agent files and explicitly resolve this time-order drift before any claim. Target part: phase evidence reconciliation.

## Decisions
- Treated this as tests-runner/devops read-only audit plus the required handoff artifact only.
- Used keyed SSH only for read-only server state, redacted env flag presence, local HTTP status codes, and aggregate DB counts.
- Did not print or persist DB URLs, journal tokens, session secrets, KEKs, exchange keys, cookies, provider tokens, or canary host coordinates.
- Did not run local tests, Playwright, CI, worker ticks, migrations, seed, deploy, nginx reload, Docker mutation, systemd mutation, tmux commands, DB writes, provider calls, or bot controls.
- Treated `BOT_ADAPTER_MODE=read-only` observed on the canary as live drift requiring acceptance or rollback, not as completion.
- No background agents were spawned by this lane; none are left running by this lane.

## Risks
- Current canary env appears to have crossed into read-only mode before worker/DB acceptance evidence exists.
- If journal auth is not enforced provider-side, a WTC `JOURNAL_READ_TOKEN` env value gives false assurance.
- If `wtc-bot-api-firewall.service` is disabled or iptables state is flushed, `8000` and `8080` can become externally reachable again because both services still bind `0.0.0.0`.
- A shared web canary `BOT_ADAPTER_MODE=read-only` can make user page renders perform live journal reads before DB-first worker acceptance is proven.
- Worker/tick acceptance writes append-only snapshots and health rows; bad acceptance runs may require a documented DB cleanup decision, not ad hoc deletes.
- Rollback must touch only WTC canary routing/env/processes; it must not stop or reconfigure `turtle-bot.service`, `turtle-journal.service`, or the legacy tmux bot.

## Verification/tests
RUN in this tests-runner/devops lane:

| Gate/check | Result |
|---|---|
| Protocol and seed read | PASS: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed handoff read |
| Latest phase read | PASS: Phase 3.64 aggregate plus Phase 3.64 tests/devops/bot/security handoffs read |
| Current Phase 3.65 peer handoffs | PASS: untracked bot-integration and security handoffs read; drift noted |
| Static command/test stack audit | PASS: package scripts, CI workflow, Playwright configs, worker scripts, adapter/worker tests inspected |
| Git state | PASS: `main...origin/main` at `d973919`; untracked peer handoffs present and left untouched |
| GitHub Actions current HEAD | PASS: run `26826764568`, workflow `CI`, head `d973919`, conclusion `success`; `gates` and `e2e` jobs successful |
| SSH read-only server state | PASS: services active, canary/preview containers present, bot services alive, WTC canary/preview localhost-only, bot API firewall active |
| Current canary env safe inventory | PASS as redacted inventory; observed `NODE_ENV=production`, `APP_ENV=staging`, `BOT_ADAPTER_MODE=read-only`, live control false, TV automation false, Axioma routes false, journal URL/token present redacted |
| Server-local HTTP status probes | PASS for status only: canary `/` 200, canary `/products/tortila` 200, canary `/api/health` 404, Tortila journal `/api/health` 200, legacy root 404 |
| External TCP firewall probe | PASS for expected exposure shape from workstation: `80 open`, `443 open`, `8000 timeout_or_closed`, `8080 timeout_or_closed` |
| Canary DB aggregate read-only query | PASS as read-only query; no `worker`/`tortila-journal` health rows or bot snapshot/import rows observed |

NOT RUN in this lane:

| Gate/check | Reason |
|---|---|
| `npm run ci:local`, local full test/build/e2e stack | Not run; read-only audit and no code changed |
| Focused Vitest adapter/worker tests | Not run; source inspected only |
| `npm run worker:tick` or managed worker process | Not run; writes DB health/snapshot rows and needs approved activation |
| Real Tortila read-only acceptance | Not green; canary env is read-only but worker/DB/journal-auth/UI evidence is missing |
| Journal no-token/token endpoint acceptance | Not run; only unauth `/api/health` status was probed |
| Playwright against production canary authenticated pages | Not run; would create browser/app evidence and needs current canary credentials/session plan |
| Any live bot start/stop/apply-config | Forbidden and not run |
| Tortila `/api/marks`, Legacy authenticated API, exchange API calls | Forbidden/not needed for read-only WTC acceptance |
| DB migrations/seed, append-only audit role proof, provider preflights | Not run; outside read-only scope and/or mutating |
| Server mutation: sudo edits, systemd control, Docker restart/exec mutation, nginx reload, env changes | Not run |

## Next actions
1. Reconcile live drift first. If `BOT_ADAPTER_MODE=read-only` on the canary was accidental, approved rollback is to set the WTC canary back to `BOT_ADAPTER_MODE=mock` and restart only the WTC canary process/container. Do not touch bot services.
2. Local gate stack before any accepted switch:
   - `npm run governance:check`
   - `npm run check:core`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run typecheck -w @wtc/web`
   - `npm run secret:scan`
   - `npm test -- packages/bot-adapters/src/__tests__/getHealth-states.test.ts packages/bot-adapters/src/__tests__/tortila-mapping.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/bot-read-safety-static.test.ts`
   - `npm test`
   - `npm run build -w @wtc/web`
   - `CI=1 npm run e2e`
3. CI gate: require a green GitHub Actions `CI` run on the exact activation commit. Current observed HEAD run is `26826764568` for `d973919`; rerun or supersede it if any activation code/env docs change.
4. Server read-only preflight before worker activation:
   - `systemctl is-active nginx postgresql turtle-bot.service turtle-journal.service wtc-bot-api-firewall.service`
   - `ss -ltnp | grep -E ':(80|443|8000|8080|8123|8300|8301) '`
   - `docker ps --format '{{.Names}} {{.Status}}' | grep -E 'wtc-ecosystem-canary|wtc-ecosystem-preview'`
   - localhost status probes for canary `/`, `/products/tortila`, Tortila `/api/health`
   - external TCP probe proving `8000` and `8080` are not reachable from the workstation
5. Journal auth gate: no-token requests to mapped data endpoints must fail; valid-token requests must pass; retained logs/artifacts must not contain the token.
6. Worker activation gate, only with approval because it writes WTC DB rows: run `npm run worker:tick` or the managed worker service with redacted env equivalent to `NODE_ENV=production`, `APP_ENV=staging|production`, `DATABASE_URL=<canary-db>`, `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL=<internal-journal-url>`, `JOURNAL_READ_TOKEN=<secret>`, one of `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
7. Post-worker verification: SELECT only aggregate `integration_health_checks` for `worker` and `tortila-journal`, aggregate source/count/latest rows from bot metric/position/trade tables, then verify `/admin/bots` and `/admin/system-health` show real Tortila read state without enabling controls.
8. Rollback concerns: keep `wtc-bot-api-firewall.service` active during any rollback; route nginx back to rollback preview or set WTC canary adapter mode to mock only under explicit approval; rotate `JOURNAL_READ_TOKEN` if it is exposed; document any DB snapshot cleanup separately because snapshot/import rows are append-only evidence.
