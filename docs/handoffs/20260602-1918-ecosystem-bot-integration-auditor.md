# ecosystem-bot-integration-auditor handoff
## Scope
Read-only Phase 3.63 production-readiness audit of WTC bot integration from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
Scope covered Tortila/current bot read-only access, legacy/current averaging bot boundary, live-control safety gates, worker
snapshot/import readiness, adapter mode behavior, exchange-secret risk, and what must be true before any production bot
connection.

No bot was started, stopped, configured, probed through SSH/systemd/tmux, or connected to exchange state. No live bot services,
provider calls, DB mutations, deploy, SSH, nginx/systemd, or worker/service starts were run. This was a narrow single-agent
handoff lane; no background agents were spawned by this auditor and none were left running.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`
- `docs/handoffs/20260602-1918-ecosystem-devops-implementer.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/IMPLEMENTED_FILES.md`
- `.env.example`
- `package.json`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/safe-preview.mjs`
- `packages/config/src/env.ts`
- `apps/web/src/lib/server-config.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`

## Files changed
- Required handoff only: `docs/handoffs/20260602-1918-ecosystem-bot-integration-auditor.md`.
- No product code, product docs, env files, DB state, provider state, bot state, or exchange state changed.

## Findings
1. Severity: High. Evidence: `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:6` to
   `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:8` says Phase 3.62 did not attempt production deployment
   or live provider acceptance; `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:91` to
   `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:93` lists bot services/control, server checks, deploy,
   CI, and production monitoring as NOT RUN; `docs/STATUS.md:13` to `docs/STATUS.md:16` repeats bot services/control and
   production gates as still NOT RUN. Recommendation: keep Phase 3.62 evidence scoped to local demo/mock website readiness and
   start a separate approved phase for any production bot connection. Target part: production-readiness truth.
2. Severity: High. Evidence: `docs/BOT_INTEGRATION_PLAN.md:13` to `docs/BOT_INTEGRATION_PLAN.md:14` requires data to flow
   bot runtime -> adapter -> WTC DB snapshots -> WTC UI and says WTC never becomes a control plane; `docs/BOT_INTEGRATION_PLAN.md:350`
   to `docs/BOT_INTEGRATION_PLAN.md:353` says the worker decouples dashboards from bot availability; `docs/BOT_INTEGRATION_PLAN.md:372`
   says the web app reads snapshots and never calls adapter endpoints directly. Current web code still constructs an adapter at
   `apps/web/src/features/bots/data.tsx:140` and calls `getMetrics`, `getPositions`, `getTrades`, `getEquityCurve`, and
   `getConfig` at `apps/web/src/features/bots/data.tsx:149` to `apps/web/src/features/bots/data.tsx:157`; multiple bot routes
   call that loader (`rg` result: bot list, statistics, detail, positions, trades, equity, safety). Recommendation: before
   enabling `BOT_ADAPTER_MODE=read-only` in production, make user-facing bot dashboards read DB snapshots/imports in production
   and reserve direct adapter reads for the worker or an explicit non-user diagnostic lane. Target part: Tortila read path /
   dashboard source of truth.
3. Severity: High. Evidence: `docs/CONTRACTS/tortila-adapter.md:32` to `docs/CONTRACTS/tortila-adapter.md:44` says the
   journal currently has no auth, needs `JOURNAL_READ_TOKEN`, vault storage, token rotation, and firewall/IP restriction before
   production; `docs/CONTRACTS/tortila-adapter.md:469` to `docs/CONTRACTS/tortila-adapter.md:473` says
   `BOT_ADAPTER_MODE=read-only` must not be set until tests pass, token auth is configured, and port `:8080` is restricted;
   `packages/config/src/env.ts:97` to `packages/config/src/env.ts:100` requires `JOURNAL_READ_TOKEN` only when non-mock mode is
   used in production; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:39` says no bot service was run. Recommendation: do not
   connect Tortila in production until journal auth, firewalling, vault/secret handling, and a scoped read-only acceptance
   phase are completed without `/api/marks`. Target part: Tortila production read-only adapter gate.
4. Severity: High. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:13` to `docs/BOT_CONTROL_SAFETY_MODEL.md:24` says all controls
   are disabled at adapter level until every gate passes; `docs/BOT_CONTROL_SAFETY_MODEL.md:93` to
   `docs/BOT_CONTROL_SAFETY_MODEL.md:149` lists four required live-control gates with security, integration, exchange, and CI
   evidence still NOT STARTED/IN PROGRESS; `packages/bot-adapters/src/control.ts:6` to `packages/bot-adapters/src/control.ts:17`
   throws unless both feature and audit approval are true; `packages/bot-adapters/src/http.ts:57` to
   `packages/bot-adapters/src/http.ts:70` hard-disables `startBot`, `stopBot`, and `applyConfig`. Recommendation: keep
   `FEATURE_LIVE_BOT_CONTROL=false` and do not implement or expose live controls until the four documented gates are observed
   green in a dedicated phase. Target part: live-control safety.
5. Severity: High. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:202` to `docs/BOT_CONTROL_SAFETY_MODEL.md:224` marks Tortila
   TP reconciliation/restore as a P0 that must surface and not auto-clear; `docs/BOT_CONTROL_SAFETY_MODEL.md:226` to
   `docs/BOT_CONTROL_SAFETY_MODEL.md:238` marks margin pre-flight as P1; `packages/bot-adapters/src/warnings.ts:32` to
   `packages/bot-adapters/src/warnings.ts:45` injects those warnings across adapter modes; `docs/CONTRACTS/tortila-adapter.md:105`
   to `docs/CONTRACTS/tortila-adapter.md:107` says Tortila cannot report `healthy` until both are cleared. Recommendation:
   treat any live Tortila connection as degraded/read-only until Tortila reports explicit resolution signals and WTC tests
   prove the warnings remain visible. Target part: Tortila safety state.
6. Severity: High. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:113` to
   `docs/CONTRACTS/legacy-bot-adapter.md:138` documents plaintext `api_key`/`secret_key` in the legacy API response;
   `docs/CONTRACTS/legacy-bot-adapter.md:363` to `docs/CONTRACTS/legacy-bot-adapter.md:382` says this must be remediated
   before production read-only use; `packages/bot-adapters/src/factory.ts:32` to `packages/bot-adapters/src/factory.ts:38`
   routes all non-mock legacy modes to `createLegacyBlockedAdapter`; `packages/bot-adapters/src/legacy/legacy-blocked.ts:46`
   to `packages/bot-adapters/src/legacy/legacy-blocked.ts:101` has no URL/token constructor and throws on data/control
   methods; `docs/PRODUCTION_BLOCKERS_CURRENT.md:54` keeps B3 blocked on the upstream plaintext-key fix and live-control
   gates. Recommendation: keep legacy/current averaging bot production access blocked until the upstream API removes plaintext
   exchange keys, a read-only service account exists, credentials are vaulted, port `:8000` is restricted, and written
   security acceptance is recorded. Target part: legacy/current averaging bot adapter.
7. Severity: Medium. Evidence: `apps/worker/src/jobs.ts:82` to `apps/worker/src/jobs.ts:99` defines
   `snapshotTortilaJournal` as read-only and non-crashing; `apps/worker/src/index.ts:151` to `apps/worker/src/index.ts:186`
   requires `TORTILA_JOURNAL_URL`/base URL plus a system bot binding before snapshots run; `scripts/safe-worker-tick.mjs:9`
   to `scripts/safe-worker-tick.mjs:23` forces `BOT_ADAPTER_MODE=mock` and only runs memory demo unless DB is present;
   `docs/PRODUCTION_BLOCKERS_CURRENT.md:59` says a separately managed preview/production worker process still needs
   operator-approved deployment/monitoring. Recommendation: deploy a managed worker process only after DB/secrets are approved,
   set `SYSTEM_BOT_OWNER_ID` or `SYSTEM_BOT_INSTANCE_ID`, run a redacted DB-backed worker smoke, and verify fresh worker plus
   `tortila-journal` heartbeats in `/admin/system-health`. Target part: worker snapshot/import readiness.
8. Severity: Medium. Evidence: `docs/CONTRACTS/tortila-adapter.md:412` to `docs/CONTRACTS/tortila-adapter.md:414` says equity
   snapshots are deduplicated by `(bot_instance_id, snapshot_at)`; `packages/db/src/schema.ts:420` to
   `packages/db/src/schema.ts:442` defines `bot_metric_snapshots` as append-only with a non-unique index, not a unique
   dedupe key; `packages/db/src/repositories.ts:1707` to `packages/db/src/repositories.ts:1708` inserts metric snapshots
   unconditionally; `packages/db/src/repositories.ts:1736` to `packages/db/src/repositories.ts:1747` proves only trade imports
   have conflict-do-nothing idempotency. Recommendation: either add metric/equity snapshot dedupe with a unique key and
   repeat-same-timestamp test, or update the contract to state metric snapshots are append-only and only trades are idempotent.
   Target part: snapshot/import idempotency.
9. Severity: Medium. Evidence: `docs/CANONICAL_ANALYTICS_MODEL.md:36` lists Tortila unrealized PnL as derived from
   `/api/marks`, while `docs/CONTRACTS/tortila-adapter.md:253` to `docs/CONTRACTS/tortila-adapter.md:262` says WTC must never
   call `/api/marks`; `packages/bot-adapters/src/tortila/tortila.mapping.ts:151` to
   `packages/bot-adapters/src/tortila/tortila.mapping.ts:174` sets `markPrice` to entry and `unrealizedPnl` to `0` only as an
   unavailable placeholder. Recommendation: reconcile analytics docs and UI copy so production dashboards never display this
   placeholder as real open PnL. Target part: analytics truth / exchange-boundary labeling.
10. Severity: Low. Evidence: `.env.example:78` to `.env.example:82` says read-only data methods are still stubbed, while
    `packages/bot-adapters/src/http.ts:75` to `packages/bot-adapters/src/http.ts:88` and `packages/bot-adapters/src/http.ts:186`
    to `packages/bot-adapters/src/http.ts:277` implement real Tortila read-only metrics, positions, trades, and equity methods.
    Recommendation: update `.env.example` wording during the next docs-truth slice so operators do not assume read-only mode is
    still a pure stub. Target part: adapter-mode documentation.

## Decisions
- Treated this as a read-only production-readiness audit, not an execution, acceptance, or implementation phase.
- Did not run `npm test`, Playwright, `worker:smoke`, preview, live adapter commands, DB migrations/seeds, SSH/systemd, bot
  service checks, or provider calls because the requested lane allowed only static audit plus this handoff.
- Counted Phase 3.59/3.60/3.61/3.62 passes only in their documented scopes; none clears production bot connection.
- Treated direct web adapter calls in read-only mode as a production blocker until WTC dashboards are DB-snapshot backed or
  explicitly approved as a server-side diagnostic path.
- Did not claim an N-agent audit. This handoff is one per-agent file.

## Risks
- Enabling `BOT_ADAPTER_MODE=read-only` today could make user-facing web routes perform server-side journal reads instead of
  consuming worker-imported DB snapshots.
- Tortila journal production access still lacks documented auth, vault, firewall, and live endpoint-shape acceptance.
- Legacy/current averaging bot access remains unsafe while upstream APIs can expose plaintext exchange keys.
- Worker snapshot/import code can be locally correct but still stale in production without a managed worker process and heartbeat
  monitoring.
- Metric/equity snapshot idempotency is ambiguous because docs promise dedupe while current schema/repository append
  unconditionally.
- Open PnL/unrealized PnL can be misread if placeholder `0` values are rendered as real exchange mark-price data.

## Verification/tests
RUN in this read-only audit:

| Gate/check | Command/check | Result |
|---|---|---|
| Required protocol/docs read | Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, latest Phase 3.62 handoff, status, credential blockers, production blockers, and bot/worker docs | PASS |
| Latest Phase 3.62 handoff discovery | `rg` over `docs/handoffs` and blocker docs for Phase 3.62 | PASS, latest aggregate identified as `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md` |
| Target handoff absence check | `Test-Path docs\handoffs\20260602-1918-ecosystem-bot-integration-auditor.md` before write | PASS, file absent |
| Git-root truth | `git status --short` | NOT GIT-BACKED, `fatal: not a git repository` |
| Static bot/worker audit | `rg` plus line-numbered reads over bot docs, adapter code, worker code, DB schema/repos, web bot surfaces, and tests | PASS, read-only |
| Live-service safety | No SSH/systemd/tmux/deploy/bot-control/provider/DB mutation commands were run | PASS |

NOT RUN in this audit:

| Gate/check | Reason |
|---|---|
| `npm test`, focused Vitest, coverage | Not run; read-only audit lane and no code changes besides handoff |
| `npm run e2e`, Playwright, preview smoke | Not run; would start/use app runtime and is outside this bot-audit lane |
| `npm run worker:smoke` / `worker:tick` | Not run; worker tick may write DB/health rows when DB is configured, and this lane was static/read-only |
| Tortila `BOT_ADAPTER_MODE=read-only` live journal acceptance | Not run; no approved journal token, firewall proof, target, or live bot access in scope |
| Legacy/current averaging bot live adapter acceptance | Not run; adapter is intentionally blocked on plaintext-key issue |
| Start/stop/apply-config controls | Not run; forbidden and hard-disabled |
| `/api/marks` or any exchange-state call | Not run; explicitly forbidden by contract and scope |
| SSH, nginx/systemd, deploy/server checks | Not run; explicitly forbidden |
| DB migrations/seeds/real-PG/append-only audit role | Not run; outside this static audit lane |
| GitHub CI | Not run; current folder is not git-backed |

## Next actions
1. Before production read-only bot connection, refactor or gate user-facing bot dashboards so production reads from WTC DB
   snapshots/imports instead of direct adapter calls; add a static test that production web routes do not construct bot
   adapters for user dashboard rendering.
2. For Tortila read-only production acceptance, require `JOURNAL_READ_TOKEN`, vault/secret handling, firewall restriction of
   journal port `:8080` to WTC, explicit `BOT_ADAPTER_MODE=read-only`, and a scoped no-control acceptance that verifies
   `/api/health`, `/api/summary`, `/api/trades/list`, and `/api/equity` shapes without `/api/marks`.
3. Deploy the worker as a managed preview/production process only after DB/secrets are approved; set a system bot owner or
   instance binding, run a redacted DB-backed worker smoke, and prove fresh worker plus `tortila-journal` heartbeats in admin
   health.
4. Keep legacy/current averaging bot access blocked until the upstream plaintext exchange-key leak is fixed, a read-only
   service account exists, credentials are vaulted, port `:8000` is restricted, redaction tests pass, and written security
   acceptance is recorded.
5. Keep all live controls disabled until the security, bot-integration, exchange-safety, and CI/test gates in
   `docs/BOT_CONTROL_SAFETY_MODEL.md` are green, and Tortila P0/P1 are resolved or explicitly accepted in writing.
6. Resolve metric/equity snapshot idempotency truth: add unique/dedupe behavior and tests, or update contracts to state
   metrics are append-only while trade imports alone are idempotent.
7. Reconcile analytics/docs/UI wording for Tortila open PnL so placeholder `unrealizedPnl=0` is never treated as real exchange
   mark-price PnL.
8. Update `.env.example` adapter-mode text to reflect that Tortila read-only data mappings now exist but remain production-gated.
