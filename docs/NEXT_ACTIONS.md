# NEXT ACTIONS

**Current local/server bot/admin state after Phase 4.67:** the WTC-side Legacy/Tortila settings, setup, readiness, warning,
statistics, admin fleet, selected-user read-only, provider-scoping, no-live-control, root test, and retained visual evidence
surfaces are substantially built, locally green in mock/no-live mode, and deployed to the WTC HTTPS canary at
`72f21d5a735ba5ce3a1b6e112cebf70742b72b62`. Phase 4.66 created a server-side DB backup, built the current `main` tree in
`node:22-bookworm`, applied pending WTC migrations, recreated only `wtc-ecosystem-canary` and `wtc-ecosystem-worker`, and
proved public `/api/health` plus worker/bot continuity. `journal-server.service`, `turtle-bot.service`, and
`turtle-journal.service` stayed `active/running` with unchanged PIDs and no restarts. Phase 4.46 closes the no-env worker interval
overlap gap: long-running DB worker intervals now use a serialized in-flight guard that skips overlapping attempts with
constant/numeric telemetry and does not refresh worker continuity proof. Phase 4.45 closes the `/app/bots` two-bot finish
board product gap: users now land on a user-scoped Tortila/Legacy completion map with direct settings, setup, dashboard,
statistics, worker, and no-live-control rows, without exchange pings, admin data, secrets, or live-control actions.
Phase 4.47 adds a fail-closed Legacy closed-trade source-proof preflight after three auditors re-confirmed `NO_SOURCE`.
Phase 4.48 surfaces that proof state in the user Legacy statistics path through a sanitized DTO and `Source-proof gate`
copy, without exposing raw worker JSON, provider payloads, env names, secrets, or live-control affordances. Current Legacy
closed-trade import remains blocked, but the worker now carries a safe `blocked_no_source` proof summary and focused tests
prevent inactive orders/slots, position snapshots, Tortila/Turtle rows, or GTE journal rows from becoming fake Legacy
realized statistics. Phase 4.49 mirrors the proof reason into the selected-user admin drilldown: it prefers a provider-scoped
Legacy metric proof summary when present, marks provenance as `scoped_worker_metric`, ignores unscoped newer metric rows,
and otherwise falls back to `global_preflight`.
Phase 4.50 pins the rendered DB acceptance for that admin source-proof row: the guarded selected-user DB fixture carries
scoped and unscoped Legacy source-proof payloads, the DB Playwright spec requires a Legacy-only row-scoped `Source-proof gate`
with `mapper-ready proof` and `scoped worker metric`, and the same spec forbids unscoped/raw/provider/API-key-shaped
source-proof markers from rendered text. The managed DB matrix is ready to run, but still **NOT RUN** until
`ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied.
Phase 4.51 adds the anti-loop verdict and a distinct Tortila source-confidence slice. The loop audit says Phase 4.40-4.46
were real distinct blocker reductions, while Phase 4.47-4.50 were one Legacy source-proof cluster that should stop receiving
local polish unless a managed DB run fails or real source evidence arrives. Tortila now has a user `Tortila journal
confidence` panel and an admin selected-user `Journal import gate`, both stating that analytics come from persisted WTC
journal/user-instance rows, not live exchange probes or `/api/marks`. Tortila is still not fully complete until real journal
auth/firewall, worker continuity, source-config provenance, safety-signal ingestion, identity scope, and the `/api/marks`
contract contradiction are resolved or explicitly blocked.
Phase 4.52 resolves the `/api/marks` contradiction instead of adding another Legacy source-proof polish pass. Tortila
`/api/marks` is now permanently excluded from WTC worker/admin contracts: the adapter document no longer lists it as a
required or polled endpoint, real-mode worker snapshots do not persist Tortila mark/uPnL placeholders, and selected-user
admin renders Tortila position Mark/uPnL as `N/A` so mock/demo placeholders cannot masquerade as live market proof. Tortila
still needs the real journal/auth/worker/source-config/safety-signal/identity gates before it is final.
Phase 4.53 closes the remaining local Mark/uPnL placeholder gap: the user bot read model now carries a fail-closed
`markUnavailable` flag from real Tortila position/metric/source adapters, user dashboard/positions/statistics render
Tortila Mark/uPnL `N/A` with neutral styling and no-`/api/marks` source-boundary copy, selected-user admin metric-level
Unrealized PnL is also `N/A` for Tortila, and the adapter contract no longer presents marks timeout/integration rows as
WTC gates. User-route managed DB browser proof is still NOT RUN until a throwaway DB/user-position fixture lane exists.
Phase 4.54 removes that fixture-lane gap by extending the existing admin-user-bots managed DB harness with a `--user-routes`
mode instead of creating a second DB lifecycle. `npm run e2e:admin-user-bots:db:managed:user-routes` now prepares a
login-capable selected user, hostile real-source Tortila Mark/uPnL values, and a focused current-user Playwright spec for
`/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`. Static/type/security gates are
green; the actual managed browser run is still NOT RUN until `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied.
Phase 4.55 confirms the next true progress is external-gate execution, not more local implementation. Current managed/source
env gates were `NOT_SET`; focused local no-env regression and the local continuity contract were green; an extra
`accept:bots:rendered` attempt timed out at the command limit and is not proof. Phase 4.56 rechecked the same gate inputs,
confirmed they were still `NOT_SET`, launched three read-only blocker/loop/security agents, and all three converged on
blocked-threshold met. Phase 4.57 then used an operator-approved isolated local disposable Postgres lane to run the
previously blocked managed gates: user-route DB proof PASS (`2` desktop/mobile tests), admin selected-user scenario matrix
PASS (`8` desktop/mobile tests across degraded-readable, fresh-green, stale, and missing), and worker continuity managed
PASS (`worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`). The local managed-DB blocker is now cleared for
this tree. Phase 4.58 adds a real WTC read-only Tortila source proof: `npm run accept:tortila:real-read:managed` starts a
temporary local Tortila journal fixture behind an allowlist proxy, runs the WTC worker in `BOT_ADAPTER_MODE=read-only`, and
verifies `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, and `marksRequests=0`.
Phase 4.59 adds the local Tortila journal read-token boundary: the adjacent `../bot_tortila` checkout returns 401 for
missing/wrong `JOURNAL_READ_TOKEN` on `/api/*`, the WTC managed runner proves the auth matrix before worker execution,
clears preflight logs, then proves the worker still reads only the allowed journal endpoints with no `/api/marks` and no
`/api/overview`. Remaining blockers are canonical/production Tortila auth-firewall rollout and authorized probes, Legacy
closed-trade source/import proof, live-control audit, and deploy/CI/live monitoring. Phase 4.60 is a production-readiness
hardening pass, not another UI polish loop: production-like non-mock adapter mode now requires `JOURNAL_READ_TOKEN` plus
explicit `TORTILA_JOURNAL_URL`; CI validates that production-like read-only fence with ephemeral values; worker wrong-token
`401` behavior fails closed without importing or leaking the token; `/api/health` is a non-secret liveness route; and the
Tortila contract/deploy docs now separate local adjacent token proof from canonical-source and production firewall/deploy
proof. Phase 4.60 broad local gates are green: `npm run accept:bots:local` PASS (`ci:local`, worker smoke, continuity
fixture, rendered E2E `65` passed, visual inventory `117` images), and `npm run accept:tortila:real-read:managed` PASS
against a disposable local Postgres lane with token matrix and WTC persisted read proof.
Phase 4.61 is the release/CI truth pass: PR #1 was merged to `main` at
`ed31aaaf89ebc4920a13887542fa3bb0bbd99545`; pre-merge PR CI run `27015532545` and post-merge `main` push CI run
`27016644974` both passed `gates` and `e2e`. This closes the "GitHub Actions for the committed exact tree" gap for this
release, but it does not deploy production and does not clear canonical Tortila source, production Tortila
auth/firewall/probes, Legacy closed-trade source, live-control audit, monitoring, or burn-in.
Phase 4.62 turns those remaining gates into a concrete input map instead of another local implementation loop: deploy
requires an operator-approved target packet; Tortila production source requires the canonical git-backed Tortila repo/source
bundle; Legacy realized analytics requires a valid closed-trade source artifact/API/table. Without one of those packets, do
not start another local UI/source-proof polish phase.
Phase 4.63 is a separate CI infrastructure hardening pass: the active workflow migrates the official GitHub JavaScript
actions from Node 20-runtime majors to Node 24-runtime majors (`checkout@v6`, `setup-node@v6`, `upload-artifact@v7`) after
GitHub's deprecation warning appeared on green `main` CI. This does not change bot runtime behavior or clear deploy/source
blockers.
Phase 4.64 records that migration as merged and green: PR #4 CI run `27022463493` passed `gates` and `e2e`, the merge commit
is `787443d8ca040cf94d001f79d1a28bbdc0d84bd3`, and post-merge `main` run `27023047118` also passed `gates` and `e2e`.
Phase 4.65 protects `main` with repository ruleset `17324564` (`WTC main required CI`): strict required GitHub Actions
checks `gates` and `e2e` pinned to integration `15368`, no force-push, no branch deletion, and no bypass actors. Future
release PRs should verify the merge box requires only `gates` and `e2e`; do not treat empty legacy commit statuses as CI
failure when Checks/Actions are green.
Phase 4.66 deploys that protected `main` to the existing WTC canary target. Current release path is
`/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-180016-72f21d5-phase465-main`; rollback web/worker release path
is `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260603-1525-e2d705f-legacy-premium`; DB backup is
`_db_backups/20260605-180016-wtc_platform_canary_20260602_1412-pre-72f21d5.dump`. Continue monitoring, but do not add local
UI polish as a substitute for the remaining source/live-control gates.
Phase 4.67 is a focused local UI correctness pass, not another source-proof substitute: Legacy and Tortila settings now use
a shared instrument catalog/picker, admin Tortila system defaults no longer duplicate portfolio-cap inputs, setup wizard
completion text is ASCII-safe, and `accept:bots:rendered` is green (`65` passed plus visual inventory). The next real
product-completion work is still source/prod gate work: Tortila canonical source/token/network/burn-in, Legacy closed-trade
source packet, and audited live-control design later.

**Current gate state as of Phase 4.67:**

| Gate | Current state | Next action |
| --- | --- | --- |
| Local bot/admin UX, settings, statistics, admin drilldowns | Substantially built; Phase 4.67 `accept:bots:rendered` green with shared instrument picker/admin cap de-duplication | Do not add more local UI polish unless a fresh gate fails or locked override read-only UX is explicitly prioritized |
| Managed DB user/admin/worker proof | Green in Phase 4.57 for this tree; rerun after relevant DB/web/worker changes | Rerun managed gates only under disposable local `wtc_test_*` DB lifecycle |
| Tortila local real-read and token proof | Green in Phase 4.60 after env/wrong-token hardening and disposable local Postgres rerun | Rerun only after adapter/worker/journal/auth changes |
| Tortila production auth/firewall/deploy | NOT RUN | Requires canonical bot repo/source landing, production secret provisioning, firewall/private-network proof, authorized probes, deploy, monitoring, artifact scans |
| Legacy closed-trade realized analytics/import | Blocked by source proof | Do not implement importer or loaded realized PnL until a valid Legacy source artifact exists |
| Live control, exchange ping, test-connection, start/stop/apply-config | NOT RUN and intentionally disabled | Needs separate bot-integration plus security approval; no local shortcut |
| Exact-tree release/CI | Phase 4.65: `main` protected by ruleset `17324564`; required checks are GitHub Actions `gates` and `e2e` only, strict policy enabled. | Future release changes must branch from `main`, run PR CI, confirm merge box requires only `gates`/`e2e`, then watch post-merge `main` CI |
| Current WTC canary deploy | RUN/PASS in Phase 4.66 for `72f21d5` | Continue monitoring; rollback web/worker to `20260603-1525-e2d705f-legacy-premium` only if health fails |
| Full production/branded-domain rollout | NOT RUN | Requires branded target, DNS/TLS cutover, longer burn-in, provider/live gates, and rollback plan |

**Phase 4.62 required external packets:**

| Packet | Required contents | Why it is required |
| --- | --- | --- |
| Deploy target packet | Phase 4.66 supplied and used the existing canary target for WTC `72f21d5`; full branded production still needs target host/domain, release SHA, rollback target, allowed services, DB migration/seed approval, secret provisioning method, smoke routes, firewall/proxy probes, monitoring window | Local repo + GitHub CI prove code; Phase 4.66 proves the existing WTC canary only |
| Canonical Tortila source packet | git-backed repo/path/remote/branch or source bundle, proof of `JOURNAL_READ_TOKEN` middleware/tests, bot-side pytest/ruff plan | Adjacent `../bot_tortila` has the patch but is not source-control authority |
| Legacy closed-trade source packet | source table/API/artifact, provider/pub_id filter, stable trade/fill id, symbol/side/size, entry/exit, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, raw payload allowlist | Active orders/slots/FILLED handling cannot prove realized analytics honestly |
Phase 4.44 closes the admin worker-continuity
freshness gap: stale `target='worker'` rows now stay attention and cannot make `/admin/bots` show green continuity proof.
Phase 4.43 closes the admin read-only-label copy
gap on `/admin/users` and `/admin/bots`, clarifies selected-user provider mapping as a separate audited workflow, and updates
the safety model so current evidence pages show no runtime-control buttons. Phase 4.42 adds the no-env two-bot continuity
contract fixture and `npm run accept:bots:continuity:contract`; the canonical local bot/admin runner now names that fixture
as its own child gate. Phase 4.41 adds the `/admin/bots` Bot completion gate map and `worker-smoke`. Phase 4.40 hardens
the runner so local children run under scrubbed local mock/no-live env and refuse managed DB/source-shaped env before the
first command starts. Phase 4.39 confirms WTC's destination contract is ready for provider-scoped Legacy closed trades, but
no durable local Legacy source was proven. Canonical local website proof is:

```powershell
npm run accept:bots:local
```

Latest observed canonical result after Phase 4.42: `npm run accept:bots:local` PASS with `ci:local`, `worker-smoke`,
`worker-continuity-fixture`, bot/admin rendered E2E (`65 passed` on `E2E_PORT=3470`), and visual inventory (`107` image
files). The focused continuity loop is:

```powershell
npm run accept:bots:continuity:contract
```

Latest observed focused continuity result: PASS (`worker-continuity-fixture` PASS, `worker-smoke` PASS with
`[worker:tick] memory demo tick OK`). Phase 4.44 focused freshness result: PASS (`45` Vitest tests, root typecheck,
secret scan, governance, `git diff --check`). The faster rendered-only loop is:

```powershell
npm run accept:bots:rendered
```

Latest local bot/admin aggregates:
[`docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md`](handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md),
[`docs/handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md`](handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md),
[`docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`](handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md),
[`docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`](handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md),
[`docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`](handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md),
[`docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`](handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md),
[`docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`](handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md),
[`docs/handoffs/20260605-0110-phase-4-42-two-bot-continuity-contract.md`](handoffs/20260605-0110-phase-4-42-two-bot-continuity-contract.md),
[`docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`](handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md),
[`docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`](handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md),
[`docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`](handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md),
[`docs/handoffs/20260605-0318-phase-4-46-worker-inflight-guard.md`](handoffs/20260605-0318-phase-4-46-worker-inflight-guard.md),
[`docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`](handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md),
[`docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`](handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md),
[`docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`](handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md),
[`docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`](handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md),
[`docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`](handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md),
[`docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`](handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md),
[`docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`](handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md),
[`docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`](handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md),
[`docs/handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md`](handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md),
[`docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`](handoffs/20260605-1411-phase-4-56-blocked-threshold.md),
[`docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`](handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md),
[`docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`](handoffs/20260605-1600-phase-458-tortila-real-read-proof.md),
and [`docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`](handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md).

**Anti-loop operating rule:** do not add another local Legacy source-proof UI/static-test/dashboard slice. Continue only if
the next phase clears an env gate, consumes real source evidence, fixes a fresh failing gate, or publishes/deploys the exact
tree. Stop and mark blocked if two consecutive phases do not remove, pass, or honestly reclassify one named NOT RUN blocker.

**Do next, in this order:**
0. **Local managed DB, Tortila read-source, local Tortila read-token, and Phase 4.60 config/health hardening are cleared
   locally for this tree:** do not continue local Legacy/Tortila UI/static/docs polish unless a fresh gate fails. The next
   non-looping progress is Legacy source proof, canonical/production Tortila auth/firewall hardening, live-control audit,
   or release/deploy proof.
1. **Rerun managed DB proof only after relevant code changes:** `npm run e2e:admin-user-bots:db:managed:user-routes`,
   `npm run e2e:admin-user-bots:db:managed:matrix`, and `npm run accept:worker:continuity:managed` are green in Phase 4.57
   against an isolated disposable local Postgres lane. Future reruns must still use local/admin maintenance URLs, let the
   runners create/drop only `wtc_test_*` databases, avoid echoing DSNs, and scan stdout/stderr, `test-results`,
   `playwright-report`, and `tests/e2e/screenshots` before retaining artifacts.
2. **Blocked by source:** do not implement Legacy closed-trade import until a source-proof artifact names the table/API and
   fields for stable trade id, mapped provider filter, symbol, side, size, entry/exit prices, realized PnL, fees/funding,
   opened/closed timestamps, exit reason, replay semantics, and raw-payload allowlist. Phase 4.39 re-checked local Legacy
   source and still found no durable closed-trade/fill table/API; Phase 4.47 re-confirmed `NO_SOURCE` and added a
   fail-closed source-proof preflight; Phase 4.48 surfaces that blocker safely in user Legacy statistics; Phase 4.49
   surfaces it in selected-user admin statistics with scoped-worker/global-preflight provenance. Inactive orders/slots, open-order reconciliation, position snapshots,
   Turtle/Tortila journal rows, and GTE manual/terminal journal rows are not valid Legacy substitutes.
3. **Blocked by safety/audit:** live exchange ping and live bot start/stop/apply-config remain disabled. Do not enable them
   until bot-integration and security audits explicitly approve live-control adapters.
4. **Tortila user-route rendered proof:** Phase 4.57 ran this gate successfully. If the route/read model changes again,
   rerun `npm run e2e:admin-user-bots:db:managed:user-routes`; it seeds hostile Tortila Mark/uPnL values under a real source
   adapter and proves `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render
   `N/A` without up/down styling or `/api/marks` calls. Do not add production-only test hooks to force this branch.
5. **Tortila real-read path:** Phase 4.58 adds and runs `npm run accept:tortila:real-read:managed`, proving local WTC
   read-only worker ingestion from a Tortila journal fixture with `sourceAdapter=tortila`, `readState=ok`, trade/position
   import, redacted output, and no `/api/marks`. The remaining Tortila production gate is auth/firewall/network hardening
   for a deployed journal, not another local read-path proof. Phase 4.59 adds local `JOURNAL_READ_TOKEN` proof and an auth
   matrix in the managed runner; production still requires real secret provisioning, firewall/security-group proof,
   authorized positive/negative probes, deploy/monitoring evidence, and artifact scans. Phase 4.52 makes `/api/marks` a
   permanent exclusion, not a TODO endpoint.
6. **Deploy/CI path:** if this local dirty tree is to be published, run a dedicated git/CI/deploy phase with staging scope,
   branch/commit/PR or canary deploy proof, and post-deploy browser/runtime smoke. Do not fold deploy into a source/env gate.

**Known green local proof through Phase 4.55:** Phase 4.55 verification/blocker audit passed focused Vitest (`60` tests),
web typecheck, worker typecheck, root typecheck, `npm run accept:bots:continuity:contract`, secret scan, governance, and
`git diff --check`. Managed runner preflights refused before DB when env was missing. `npm run accept:bots:rendered` timed
out at the 5-minute command limit and is NOT counted as green; the spawned local process chain was closed and fresh trace
artifacts were removed. Phase 4.54 user-route DB proof lane passed focused Vitest (`50` tests
across admin DB harness, bot read-safety, two-bot continuity, and selected-user static coverage), web typecheck, root
typecheck, direct/managed runner help/refusal preflights, secret scan, governance, and `git diff --check`. Phase 4.53 Tortila Mark/uPnL unavailable hardening passed focused Vitest
(`56` tests across bot read-safety, two-bot continuity contract, admin selected-user static/DB harness, and worker Tortila
snapshot), web typecheck, root typecheck, secret scan, governance, and `git diff --check`. Phase 4.52 Tortila `/api/marks` exclusion passed focused Vitest (`32`
tests across continuity contract, selected-user static/DB harness, statistics completion, and worker snapshot coverage),
web typecheck, worker typecheck, root typecheck, secret scan, governance, and `git diff --check`. Phase 4.51 Tortila source-confidence passed focused Vitest (`33`
tests), web typecheck, root typecheck, and bot-statistics Playwright (`4` desktop/mobile tests on `E2E_PORT=3521`). Phase 4.50 admin selected-user rendered source-proof acceptance hardening
passed focused Vitest (`32` tests across source-proof/static/loader/DB harness/statistics coverage), web typecheck, root
typecheck, secret scan, governance, and `git diff --check`; the managed DB matrix remains env-blocked. Phase 4.49 admin
selected-user source-proof hydration passed focused Vitest (`26` tests across source-proof/static/loader/statistics
coverage), web typecheck, worker typecheck, root typecheck, secret scan, governance, and `git diff --check`. Phase 4.48 source-proof visibility passed web typecheck, focused Vitest
(`48` tests across statistics/read-safety/admin-user/admin-health coverage), and bot-statistics Playwright desktop (`2`
tests on `E2E_PORT=3511`). Phase 4.47 source-proof preflight passed focused Vitest (`47` tests),
root typecheck, worker typecheck, and web typecheck before docs closeout; final secret/governance/diff gates are recorded in
the Phase 4.47 and Phase 4.48 aggregates. Phase 4.46 worker in-flight proof passed Vitest (`14` focused tests and
`38` expanded worker safety tests), worker typecheck, root typecheck, `worker:smoke`, and
`accept:bots:continuity:contract`, secret scan, governance, and `git diff --check`. Phase 4.45 focused bot-list proof passed Vitest (`41` tests), root
typecheck, focused rendered smoke (`2` desktop/mobile tests), in-app Browser DOM sanity, secret scan, governance, and
`git diff --check`. Canonical `npm run accept:bots:local` passed under scrubbed local
mock/no-live env (`ci:local` PASS, `worker-smoke` PASS, `worker-continuity-fixture` PASS, `65 passed` bot/admin E2E,
`107` visual inventory images). `npm run accept:bots:continuity:contract` passed separately.
Phase 4.44 focused worker freshness proof passed Vitest (`45` tests), root typecheck, secret scan, governance, and
`git diff --check`. Phase 4.43 focused
admin-label proof passed static Vitest (`80` tests), PG8 mobile admin (`1` passed, `1` skipped), smoke rendered (`34`
passed), root typecheck, secret scan, and `git diff --check`. `npm run accept:bots:rendered` passed
earlier after the same scrub; focused runner/redaction Vitest passed (`8` tests);
root `npm run typecheck -- --pretty false` and `git diff --check` passed during Phase 4.41 before docs closeout. Dedicated
bot statistics rendered proof passed; root `npm test` passed with `126` files, `1090` passed,
`10` skipped; root lint/typecheck/secret/governance gates passed; web build passed; formal retained visual manifest passed
for `107` reviewed screenshots in Phase 4.37. This proves local rendered mock/demo safety and screenshot-review hygiene, not
live DB/provider/exchange readiness or live bot continuity.

**Phase 3.67 (bot analytics/settings canary deploy) is live** - public URL remains the operator-known
`https://<wtc-canary-host>`. Agents closed: devops and security. Current WTC web canary release:
`20260603-1246-8075523-bot-analytics`, mounted by `wtc-ecosystem-canary` on `127.0.0.1:8301`. This deploy touched only the
WTC canary container; `wtc-ecosystem-worker` and `wtc-ecosystem-preview` stayed running, existing bot services stayed active,
and bot API ports `8000/8080` remained externally closed. Verified in browser: Legacy settings with saved `v1` reference
config and symbol/stage matrix, Legacy statistics coverage matrix, Tortila advanced statistics, and Tortila dashboard with
`REAL DATA`. Verified gates: local `npm run ci:local` PASS, server web build PASS, pre-switch smoke PASS, public HTTPS smoke
PASS, browser console errors empty, and governance PASS. Aggregate:
[`docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`](handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md).

**Do not treat the richer Legacy UI as permission for live Legacy control.** Legacy remains WTC-side reference/export only.
Still blocked/not green: Legacy live adapter, live bot start/stop/apply-config, provider-side journal bearer-auth proof,
Stripe checkout/webhook acceptance, Axioma live bridge/download/account-link, live LMS object-store/scanner,
branded-domain DNS/TLS, GitHub CI for this exact uncommitted deploy, production burn-in/alerting, and final monitoring.

**Phase 3.65 (Tortila DB-backed read-only canary) is live** - public URL remains the operator-known
`https://<wtc-canary-host>`. Agents closed: bot-integration, security, and tests/devops. Tortila now uses real read-only data
through WTC DB snapshots/imports: Tortila journal -> `wtc-ecosystem-worker` -> WTC Postgres -> web/admin UI. Current release:
commit `4487b3d`, server release `20260602-1816-4487b3d`. Verified in browser: public Tortila product page, authenticated
Tortila dashboard, positions, trades, equity, journal, statistics, `/admin/bots`, and `/admin/system-health`. Verified gates:
local `npm run ci:local` PASS, root `npm test` PASS (`105` files, `936` passed, `10` skipped), web build PASS, secret scan
PASS, and GitHub Actions CI PASS for `4487b3d`. Existing bot services stayed up; live controls stayed disabled.
Aggregate: [`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`](handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md).

**Do not call this full production for the whole platform.** Tortila read-only canary is accepted only through WTC DB
snapshots. Still blocked/not green: provider-side journal bearer-auth proof, Legacy non-mock integration, live bot
start/stop/apply-config, Stripe checkout/webhook acceptance, Axioma live bridge/download/account-link, live LMS
object-store/scanner, branded-domain DNS/TLS, long production burn-in/alerting, and direct intended append-only audit-role
proof. Next phase should be exactly one of these blockers; do not bundle them.

**Phase 3.64 (production canary deploy) is live** - public URL:
operator-known `https://<wtc-canary-host>`. Agents closed: devops, security, tests, and bot-integration. The server now runs release
`5522900` as `wtc-ecosystem-canary` on `127.0.0.1:8301`, with nginx/TLS on the canary hostname. Browser/curl HTTPS smokes
passed, real registration/login passed, GitHub Actions for `5522900` passed, local `npm run ci:local` passed, and the
canary uses secure/httpOnly `__Host-wtc_session` cookies. Both live bots stayed up. `wtc-bot-api-firewall.service` now blocks
external access to bot API ports: external probe shows `8000/8080` timeout while server-local probes still open.
Aggregate: [`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`](handoffs/20260602-2125-phase-3-64-production-canary-deploy.md).

**Do not call this full bot-integrated production yet.** Current canary is intentionally `BOT_ADAPTER_MODE=mock` with
`FEATURE_LIVE_BOT_CONTROL=false`. Next phase should be exactly one of these: Tortila read-only adapter hardening, Legacy
adapter security remediation, billing provider acceptance, branded-domain DNS/TLS, production worker/monitoring rollout, or
rollback-container cleanup. Do not start/stop/apply live bot config until the bot-integration and security gates pass.

**Phase 3.63 (production-readiness gap closure) is landed locally** - production is still not ready, but the local
production-readiness harness is stronger. Agents closed: security, bot-integration, devops, backend, frontend, tests.
Changes landed: production-like Stripe/Axioma CI env validation, production-like Stripe config requirements, real-form auth
production-profile Playwright, DB-backed auth Playwright managed runner, default e2e exclusion for opt-in auth/LMS DB specs,
and e2e ports moved from Windows-reserved `3100-3103` to env-overridable `3410-3413`. Fresh gates observed: root
`npm test` PASS (`105` files, `934` passed, `10` skipped), `npm run build -w @wtc/web` PASS, `npm run check:core` PASS,
root/web typecheck PASS, lint PASS, `npm run secret:scan` PASS, default `npm run e2e` PASS (`44` passed, `6` skipped),
`npm run e2e:auth:production-profile` PASS (`2` passed), no-network Stripe/Axioma/LMS preflight dry-runs PASS, and
`npm run e2e:auth:db:managed` PASS using the existing local bot Postgres source only in-process (`wtc_test_auth_20260602130742_099899`
created/dropped, 17 migrations plus seed, Playwright `2` passed). Aggregate:
[`docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`](handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md).

**Recommended next phase:** this is now blocked on external/intended-environment gates, not more local substitutes. Start
exactly one new phase for one of these: git-backed GitHub CI, direct intended audit-role proof, live LMS object-store,
live LMS scanner, Stripe test checkout/webhook replay, Axioma live bridge acceptance, or approved server deploy/runbook.
Use [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_63_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_63_20260602.md).

**Phase 3.62 (local site-readiness) is landed locally** - the local demo/mock site can be checked at
`http://127.0.0.1:3000`. Agents closed: tests, frontend, devops. Fresh gates observed: root `npm test` PASS (`103` test
files, `921` passed, `10` skipped), `npm run build -w @wtc/web` PASS (Next `15.5.18`, `35` static pages), default
`npm run e2e` PASS on rerun (`44` passed, `8` skipped, no failures/flaky), local preview HTTP smoke PASS (`200`, title
contains `WTC Ecosystem` and `World Trader Club`), `npm run check:core` PASS, `npm run db:generate -w @wtc/db` PASS (`43` tables, no
schema changes), and visual inventory PASS inventory-only (`69` images, `0` blocked containers). Aggregate:
[`docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`](handoffs/20260602-1856-phase-3-62-local-site-readiness.md).
This is **not production readiness**: the preview is local demo/mock, screenshot inventory is not screenshot acceptance, and
the folder is still not git-backed.

**Recommended next phase:** do not rerun local site-readiness unless code changed or fresh proof is requested. The remaining
work is credentialed/live: direct production/preview intended audit-role proof, live LMS object-store, live LMS external
scanner, Stripe test checkout/webhook replay, Axioma live bridge/handoff acceptance, GitHub CI, and deploy/server checks.
Use [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_62_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_62_20260602.md) if a new
session is needed.

**Phase 3.61 (audit append-only managed acceptance) is landed locally** - local managed throwaway audit-role proof is now
RUN/PASS. Using the operator-identified local `C:\Users\maxib\GTE BOT\bot\.env` Postgres settings without printing values,
the final `npm run accept:audit:append-only-role:managed` created `wtc_test_audit_20260602113142_0aa15f`, applied `17`
migrations, created `wtc_app_role_20260602113142_97bf21`, proved
`select=true insert=true update=false delete=false truncate=false probe=inserted`, and dropped both the DB and role. The first
attempt created/dropped `wtc_test_audit_20260602113036_6c10be` but failed before preflight on `CREATE ROLE ... PASSWORD`
utility syntax; the runner was fixed before the final passing run. Agents closed: security, tests, devops. Aggregate:
[`docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md`](handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md).
Follow-up gates observed: focused audit runner Vitest PASS (`16` passed), root `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, and `npm run secret:scan` PASS. Direct production/preview
intended-role proof is still NOT RUN. **Still NOT RUN:** root `npm test`, web build, live LMS object-store/scanner
acceptance, Stripe, Axioma, preview/live smoke, SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

**Recommended next phase:** run exactly one remaining credentialed/live or site-readiness gate if prerequisites are available:
`npm run accept:lms:object-storage -- --live`, `npm run accept:lms:external-scanner -- --live`, a scoped Stripe/Axioma runbook
from `docs/DEPLOYMENT.md`, or local site readiness (`npm run build -w @wtc/web`, root `npm test`, default e2e/preview smoke).
Do not rerun LMS DB, real-PG, or local managed audit-role acceptance unless code/DB behavior changed or fresh proof is
explicitly requested. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_61_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_61_20260602.md) to start the next
session without reconstructing Phase 3.61 from chat.

**Phase 3.60 (existing-bot real-PG managed acceptance) is landed locally** - the active managed real-Postgres proof is now
RUN/PASS. Using the operator-identified local `C:\Users\maxib\GTE BOT\bot\.env` Postgres settings without printing values,
the final `npm run accept:real-pg:managed` created `wtc_test_realpg20260602105824d18bef`, ran the active real-PG harness
(`14 passed`), and dropped the throwaway DB. The first attempt also created/dropped
`wtc_test_realpg20260602105728361315` but failed on a test-only raw timestamp type assertion; that assertion was fixed before
the final passing run. Agents closed: security, tests, devops. Aggregate:
[`docs/handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md`](handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md).
Follow-up gates observed: focused safety/helper Vitest PASS (`13` passed, `9` skipped inactive DB block), root
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run secret:scan` PASS, and
`npm run governance:check` PASS (`0` errors, `1` known historical warning). **Still NOT RUN:** root `npm test`, web build,
append-only audit DB-role proof, live LMS object-store/scanner acceptance, Stripe, Axioma, preview/live smoke,
SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

**Recommended next phase:** run exactly one remaining credentialed/live gate if credentials are available:
`npm run accept:audit:append-only-role`, `npm run accept:lms:object-storage -- --live`,
`npm run accept:lms:external-scanner -- --live`, or a scoped Stripe/Axioma runbook from `docs/DEPLOYMENT.md`. Do not rerun
LMS DB or real-PG managed acceptance unless code/DB behavior changed or fresh proof is explicitly requested. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_60_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_60_20260602.md) to start the next
session without reconstructing Phase 3.60 from chat.

**Phase 3.59 (existing-bot LMS DB acceptance) is landed locally** - the LMS DB browser managed gate is now RUN/PASS.
Using the operator-identified local `C:\Users\maxib\GTE BOT\bot\.env` Postgres settings without printing values, the final
`npm run e2e:lms:db:managed` created `wtc_test_lms_20260602101117_cc7889`, applied 17 migrations plus seed data, ran
desktop/mobile LMS DB Playwright (`2 passed`), ran the generated-artifact scanner PASS, and dropped the throwaway DB. The
retained mobile lesson screenshot was reviewed with
`npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png`
PASS. Agents closed: security, tests, devops. Aggregate:
[`docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`](handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md).
Gates observed: focused Vitest PASS (`29` passed, then `21` passed), strip-only import smoke PASS,
`npm run typecheck -w @wtc/web` PASS, root `npm run typecheck` PASS, `npm run lint` PASS, `npm run secret:scan` PASS,
`npm run governance:check` PASS (`0` errors, `1` known historical warning), managed LMS DB browser acceptance PASS, and
retained visual review PASS. **Still NOT RUN:** root `npm test`, web build, active managed real-Postgres proof,
append-only audit DB-role proof, live LMS object-store/scanner acceptance, Stripe, Axioma, preview/live smoke,
SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

**Recommended next phase:** run exactly one remaining credentialed/live gate if credentials are available:
`npm run accept:real-pg:managed`, `npm run accept:audit:append-only-role`,
`npm run accept:lms:object-storage -- --live`, `npm run accept:lms:external-scanner -- --live`, or a scoped Stripe/Axioma
runbook from `docs/DEPLOYMENT.md`. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_59_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_59_20260602.md) to start the next
session without reconstructing Phase 3.59 from chat.

**Phase 3.58 (credentialed acceptance blocker packet) is landed locally as docs-only work** - no live acceptance was run.
`docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` is now the current operator packet for the exact blocked credential/live gates:
LMS DB browser, real-Postgres managed proof, append-only audit role, LMS object storage, LMS external scanner, Stripe, Axioma,
preview/live smoke, GitHub CI, and deploy/server checks. Current shell env checks printed only `SET`/`NOT_SET`; all checked
credential/consent vars were `NOT_SET`. The current folder still is not git-backed, so no commit/branch/PR/CI claim is
available. Aggregate:
[`docs/handoffs/20260602-1626-phase-3-58-credentialed-acceptance-blocker-packet.md`](handoffs/20260602-1626-phase-3-58-credentialed-acceptance-blocker-packet.md).
Agents closed: security, tests, devops, platform. Gates observed: docs/protocol reads PASS, values-hidden env check PASS as
blocker evidence, git-root check NOT GIT-BACKED, final `npm run secret:scan` PASS, final `npm run governance:check`
PASS. **Still NOT RUN:** live preview, e2e/Playwright, actual LMS DB browser acceptance, active managed real-Postgres
proof, production/preview append-only audit DB-role proof, live provider preflights/acceptance, SSH/nginx/systemd/server
checks, GitHub CI, deploy, and production monitoring.

**Recommended next phase:** if one credential set becomes available, start a new single-purpose acceptance phase and run
only the matching documented command. If credentials remain unavailable, keep the blocker packet current and do not invent
another local substitute. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_58_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_58_20260602.md) to start the next
session without reconstructing Phase 3.58 from chat.

**Phase 3.57 (symlink-hard preflight root confinement) is landed locally** - the operator's continuous phase-group program
continues, but the next honest step is credentialed acceptance or an explicit blocker packet. `scripts/workspace-path-guard.mjs`
now rejects symlink, junction, and reparse-point components for retained evidence paths. `scripts/preflight-log-root.mjs`
uses it for `*_PREFLIGHT_LOG_ROOT` resolution and summary writes, with exclusive summary creation. `scripts/gates.mjs`
guards the fixed `logs/gates` retained-log directory. The LMS retained text scanner and retained visual checker now refuse
linked roots, nested linked descendants, linked dynamic marker manifests, linked visual manifests, and linked OCR sidecars
without echoing secret-shaped path labels. Aggregate:
[`docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md`](handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md).
Gates observed: syntax checks PASS for five changed scripts, focused Vitest PASS (`61` passed), `npm run secret:scan` PASS,
`npm run typecheck` PASS, `node scripts/gates.mjs full` PASS (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates`
PASS, `npm run evidence:visual -- --inventory tests/e2e/screenshots` PASS inventory only (`68` image files; not acceptance),
and final `npm run governance:check` PASS. Agents closed: security, tests, devops, platform. **Still NOT RUN:** live preview,
e2e/Playwright, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit
DB-role proof, live provider preflights, SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, do not invent another local substitute for live acceptance; write or update a blocker packet
listing exact missing credential gates and exact commands still NOT RUN. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md) to start the next
session without reconstructing Phase 3.57 from chat.

**Phase 3.56 (safe-preview retained output policy) is landed locally** - the operator's continuous phase-group program
continues. `npm run preview:safe` still was **NOT RUN**, but its wrapper no longer inherits raw stdout/stderr. It preserves
direct Next dev startup, `shell:false`, `--hostname 0.0.0.0`, `--port 3000`, and forced development/mock/no-live flags while
forwarding a redacted stream. The redactor buffers incomplete lines and private-key blocks to handle split chunks. Raw
`dev-server.log` and `preview-safe*.log` files are now refused by the retained-artifact scanner as archive evidence; ignored
logs are not acceptance evidence. Aggregate:
[`docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md`](handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md).
Gates observed: syntax checks PASS for `scripts/safe-preview.mjs` and `scripts/scan-lms-db-e2e-artifacts.mjs`, focused
Vitest PASS (`32` passed), raw preview-log retained-evidence refusal PASS, `npm run secret:scan` PASS, `npm run typecheck`
PASS, `node scripts/gates.mjs full` PASS (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, and final
`npm run governance:check` PASS. Agents closed: security, tests, devops, platform. **Still NOT RUN:** live preview,
e2e/Playwright, actual LMS DB browser acceptance, active managed real-Postgres
proof, production/preview append-only audit DB-role proof, live provider preflights, SSH/nginx/systemd/server checks,
GitHub CI, deploy, and production monitoring.

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is symlink-hard preflight root confinement. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_56_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_56_20260602.md) to start the next
session without reconstructing Phase 3.56 from chat.

**Phase 3.55 (retained visual artifact policy) is landed locally** - the operator's continuous phase-group program continues.
Screenshots/images are no longer allowed to be treated as clean just because text artifact scanning or `secret:scan` passes.
`scripts/check-retained-visual-artifacts.mjs` adds a separate visual evidence command: `--inventory` counts images only and is
not acceptance, while `--manifest <visual-review.json>` requires every retained image in the supplied roots to have passing
manual/OCR review metadata. OCR sidecar text is scanned for DB URLs, auth/cookie tokens, signed URL tokens, raw public-IP
URLs, provider tokens, LMS internal metadata, and dynamic marker values without printing matched values. Staged CI no longer
uploads raw `tests/e2e/screenshots/**` directly; it validates any reviewed visual manifest upload candidate before upload.
LMS DB archive instructions now require both text artifact and visual review gates before retaining screenshots. **Still NOT RUN:** OCR review of current screenshots, any retained screenshot acceptance
manifest, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role
proof, live preflights, live Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI
execution, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`](handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md).
Gates observed: syntax checks PASS for the visual checker and LMS DB runner, focused Vitest PASS (`10` passed),
visual inventory PASS (`68` image files), expected no-manifest refusal PASS, `npm run secret:scan` PASS,
`node scripts/gates.mjs full` PASS (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, and final
`npm run governance:check` PASS.

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is long-running safe-preview retained-output policy or
symlink-hard preflight root confinement. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md) to start the next
session without reconstructing Phase 3.55 from chat.

**Phase 3.54 (child-process output redaction) is landed locally** - the operator's continuous phase-group program continues.
One-shot proof/evidence runners no longer inherit or retain raw child stdout/stderr. `scripts/redacted-child-process.mjs`
now redacts Postgres URLs/DSNs, DB/env secret assignments, password fragments, auth headers, cookies, bearer/basic/JWT-like
values, provider tokens, signed URL parameters, provider/preview URL assignments, raw public-IP preview URLs, and private-key
blocks before retained console/log output. LMS DB browser runner, LMS DB managed runner, real-PG managed runner,
`safe-worker-tick`, and `scripts/gates.mjs` use the helper; `logs/gates/*.log` discard full output for passing gates and
retain full redacted output only for failing gates, while the compact gate summary remains quiet. `safe-preview.mjs` is still
a long-running interactive dev-server stream and should not be archived as retained evidence. **Still NOT RUN:** actual LMS DB browser acceptance, active managed real-Postgres proof,
production/preview append-only audit DB-role proof, live preflights, live Stripe/Axioma acceptance, preview/prod DB rollout,
SSH/nginx/systemd/server checks, screenshot OCR, GitHub CI, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`](handoffs/20260602-1357-phase-3-54-child-output-redaction.md).
Gates observed: syntax checks PASS for six changed scripts, focused Vitest PASS (`56` passed), regression focused Vitest PASS
(`6` passed), `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9),
`node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, post-cleanup `npm run governance:check` PASS, and post-cleanup
`npm run secret:scan` PASS.

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is screenshot retention/OCR policy, long-running safe-preview
retained-output policy, or symlink-hard preflight root confinement. Use
[`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md) to start the next
session without reconstructing Phase 3.54 from chat.

**Phase 3.53 (preflight log-root confinement) is landed locally** - the operator's continuous phase-group program continues.
Five summary-writing preflight scripts now accept `*_PREFLIGHT_LOG_ROOT` only as relative repo-local `logs/...` paths and
refuse absolute, UNC, URL-shaped, traversal, and non-`logs/` roots before summary writes. Printed summary paths are normalized
relative `logs/.../summary-*.json` values. The retained-artifact scanner now refuses unsafe explicit roots, missing explicit
roots, and unsafe dynamic marker manifest paths instead of scanning off-workspace evidence or passing missing explicit roots.
**Still NOT RUN:** live object-store/scanner preflights, live Stripe/Axioma acceptance, actual LMS DB browser acceptance,
active managed real-Postgres proof, production/preview append-only audit DB-role proof, preview/prod DB rollout, SSH/nginx/
systemd/server checks, GitHub CI, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md`](handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md).
Gates observed: syntax checks PASS for helper/five preflight scripts/scanner, focused Vitest PASS (`55` passed),
`npm run governance:check` PASS (0 errors / 1 known warning; 4 cited per-agent handoffs all present), `npm run secret:scan`
PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `npm run typecheck` PASS, and
`node scripts/gates.mjs full` PASS (9/9).

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is screenshot retention/OCR policy, child-process output
redaction, or symlink-hard preflight root confinement.

**Phase 3.52 (raw preview URL hygiene) is landed locally** - the operator's continuous phase-group program continues.
The repo no longer carries the old raw preview host as a hardcoded Next dev origin; set `WTC_DEV_ALLOWED_ORIGINS` in an
operator-only env when a network dev preview origin is needed. Active durable docs now use placeholders for raw preview URL,
SSH command, demo password, and preview DB name. Generated artifact scanning now rejects raw public IPv4 URLs, public-IP SSH
targets, preview/base URL assignments, app redirect URL fields, DB/admin URL or DSN assignments, and generic token/API-key
assignments. Runtime preview logs and `.next-e2e*` browser build outputs are ignored for local/export hygiene.
**Still NOT RUN:** live preview smoke, SSH/nginx/systemd/server checks, preview/prod DB rollout, actual LMS DB browser
acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, GitHub CI, and production
monitoring. Aggregate:
[`docs/handoffs/20260602-1319-phase-3-52-raw-preview-url-hygiene.md`](handoffs/20260602-1319-phase-3-52-raw-preview-url-hygiene.md).
Gates observed: focused Vitest PASS (`21` passed), active docs/config old-coordinate search PASS (no matches in active docs
outside historical handoffs), `npm run governance:check` PASS (0 errors / 1 known warning; 4 cited per-agent handoffs all
present), `npm run secret:scan` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and
`node scripts/gates.mjs full` PASS (9/9).

**Recommended next phase:** if credentials are available, run the blocked acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is screenshot retention/OCR policy, child-process output
redaction, or preflight log-root confinement.

**Phase 3.51 (LMS DB wrapper redaction) is landed locally** - the operator's continuous phase-group program continues.
LMS and real-PG managed wrappers no longer echo unknown CLI argument values, closing URL-shaped argument leak paths before any
DB parsing or mutation. `scripts/run-lms-db-e2e-managed.mjs` now exports a guarded `safeMessage()` sanitizer for no-DB tests,
and LMS child/prep scripts (`run-lms-db-e2e.mjs`, `prepare-lms-db-e2e.ts`) redact raw Postgres URLs and `password=` fragments
in catch paths before inherited stderr can become retained evidence. Focused tests now cover URL-shaped unknown args,
credential-present unknown args, missing/invalid/throwaway URL refusals, direct sanitizer redaction, and child/prep redaction
guards. **Still NOT RUN:** actual LMS DB browser acceptance (`npm run e2e:lms:db` / `npm run e2e:lms:db:managed`), active
managed real-Postgres proof, production/preview append-only audit DB-role proof, production DB rollout, GitHub CI, and
production monitoring. Aggregate:
[`docs/handoffs/20260602-1257-phase-3-51-lms-db-wrapper-redaction.md`](handoffs/20260602-1257-phase-3-51-lms-db-wrapper-redaction.md).
Gates observed: syntax checks PASS, direct URL-shaped unknown-arg refusals PASS for LMS and real-PG managed wrappers, and
focused Vitest PASS (`42` passed), `npm run governance:check` PASS (0 errors / 1 known warning; 3 cited per-agent handoffs
all present), `npm run secret:scan` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and
`node scripts/gates.mjs full` PASS (9/9).

**Recommended next phase:** if credentials are available, run the blocked live acceptance path that has credentials first:
`npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm run accept:real-pg:managed` with
`REAL_POSTGRES_ADMIN_DATABASE_URL`, or `npm run accept:audit:append-only-role` with the restricted `wtc_app_role` URL. If
credentials remain unavailable, the next local safety slice is raw preview URL hygiene.

**Phase 3.50 (runner/gate help safety) is landed locally** - the operator's continuous phase-group program continues.
`scripts/run-real-pg-harness-managed.mjs` now refuses unknown arguments such as `--dry-run` before parsing
`REAL_POSTGRES_ADMIN_DATABASE_URL`, constructing a Postgres client, or creating a throwaway DB. The focused safety test clears
`REAL_POSTGRES_ADMIN_DATABASE_URL` by default and also covers the risky credential-present typo case. `scripts/gates.mjs`
now derives invalid-mode help from `Object.keys(PLANS)` and creates `logs/gates` only after mode validation, so typo refusals
do not create gate artifacts. **Still NOT RUN:** active managed real-Postgres proof, manual `REAL_POSTGRES_DATABASE_URL`
real-PG harness, production/preview append-only audit DB-role proof, production DB rollout, GitHub CI, and production
monitoring. Aggregate:
[`docs/handoffs/20260602-1240-phase-3-50-runner-gate-help-safety.md`](handoffs/20260602-1240-phase-3-50-runner-gate-help-safety.md).
Gates observed: `node --check scripts/run-real-pg-harness-managed.mjs` PASS, `node --check scripts/gates.mjs` PASS,
focused Vitest PASS (`7` passed), `npm run accept:real-pg:managed -- --dry-run` refusal PASS, credential-present unknown-arg
refusal PASS via focused test, `node scripts/gates.mjs nope` refusal PASS with all valid modes listed,
`npm run governance:check` PASS (0 errors / 1 known warning; 3 cited per-agent handoffs all present), `npm run secret:scan`
PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and `node scripts/gates.mjs full` PASS (9/9).

**Phase 3.49 (audit append-only role preflight) is landed locally** - the operator's continuous phase-group program continues.
`npm run accept:audit:append-only-role` now exists as the explicit PostgreSQL permission acceptance path for `public.audit_logs`.
It connects as the restricted application role (`wtc_app_role` by default), verifies the role is not elevated and does not own
`audit_logs`, proves `SELECT` and `INSERT` are granted while `UPDATE`, `DELETE`, and `TRUNCATE` are not, then writes one safe
`system.health_check` probe row. The command refuses without `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`, refuses missing/invalid
URLs, rejects admin-looking URL users, and refuses non-`wtc_test*` databases unless the operator sets
`AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=1` for an approved run. Docs now standardize the example restricted role
as `wtc_app_role`, and focused coverage was added in `tests/integration/audit-append-only-role-preflight.test.ts`.
**Still NOT RUN:** production/preview append-only audit DB-role proof with real restricted-role credentials, active real-Postgres
auth/account race proof, production nginx/shared-store auth throttling, production DB rollout, GitHub CI, and production
monitoring. Aggregate:
[`docs/handoffs/20260602-1225-phase-3-49-audit-append-only-role-preflight.md`](handoffs/20260602-1225-phase-3-49-audit-append-only-role-preflight.md).
Gates observed: `node --check scripts/audit-append-only-role-preflight.mjs` PASS, `npm run accept:audit:append-only-role -- --help`
PASS, missing-accept refusal PASS, invalid-URL refusal PASS, admin-looking URL user refusal PASS, non-throwaway DB refusal PASS,
focused Vitest PASS (`9` passed), `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
`npm run governance:check` PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all present), `npm run secret:scan`
PASS, and `node scripts/gates.mjs full` PASS (9/9).

**Phase 3.48 (auth lockout docs truth) is landed locally** - the operator's continuous phase-group program continues.
`DATA_MODEL.md` now carries the eight REAL-in-0016 lockout columns in the active `users` table, keeps richer identity fields
as TARGET-only, and aligns current email index wording with `users_email_idx` on `email`. `AUDIT_LOG_SCHEMA.md` now marks
`auth.account_unlock` implemented and documents the exact lockout-state before/after allowlist; it also forbids email,
password/hash, session/token, raw identifiers, IP/user-agent, stack traces, and full user-row dumps in unlock audit snapshots.
**Still NOT RUN:** active real-Postgres auth/account race proof, production nginx/shared-store auth throttling, production DB
rollout, append-only audit DB role, GitHub CI, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1202-phase-3-48-auth-lockout-docs-truth.md`](handoffs/20260602-1202-phase-3-48-auth-lockout-docs-truth.md).
Gates observed: `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `npm run governance:check` PASS
(0 errors / 1 known warning; 4 cited per-agent handoffs all present), `npm run secret:scan` PASS, and
`node scripts/gates.mjs full` PASS (9/9).

**Phase 3.47 (managed real-PG proof runner) is landed locally** - the operator's continuous phase-group program continues.
The active real-Postgres auth/account proof still cannot be claimed without credentials, but the operator path is now safer:
`npm run accept:real-pg:managed` accepts `REAL_POSTGRES_ADMIN_DATABASE_URL`, creates a fresh `wtc_test_<suffix>`, runs only
`npm test -- tests/integration/db-real-postgres.test.ts`, and drops the throwaway database. It does not print full URLs or
secrets. Local discovery: native PostgreSQL 17 is running on `127.0.0.1:5432`, `psql.exe` exists under
`C:\Program Files\PostgreSQL\17\bin`, Docker is unavailable, `REAL_POSTGRES_DATABASE_URL`/`DATABASE_URL` are unset, and
passwordless/default credentials did not authenticate. **Still NOT RUN:** active real-Postgres auth/account race proof,
production nginx/shared-store auth throttling, production DB rollout, append-only audit DB role, GitHub CI, and production
monitoring. Gates observed: script syntax PASS, help PASS, missing-admin-url refusal PASS (expected exit 2 before DB
mutation), focused default real-PG harness PASS (`5 passed / 9 skipped`), and `node scripts/gates.mjs full` PASS (9/9).
Aggregate:
[`docs/handoffs/20260602-1144-phase-3-47-managed-real-pg-proof-runner.md`](handoffs/20260602-1144-phase-3-47-managed-real-pg-proof-runner.md).

**Recommended next phase:** run the managed proof after the operator supplies:
`REAL_POSTGRES_ADMIN_DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/postgres`, then
`npm run accept:real-pg:managed`. Report the gate as RUN only if the active real-PG tests pass without skipped DB-mutating
tests.

**Phase 3.46 (real-Postgres harness table-set truth) is landed locally** - the operator's continuous phase-group program
continues. The stale real-PG harness table-count assertion is no longer an open local blocker: the harness now compares the
real migrated `information_schema` base table names to the current Drizzle schema-derived table-name set, and an always-run
helper test proves the schema table list can be derived even when no real DB URL is provided. Focused default verification:
`npm test -- tests/integration/db-real-postgres.test.ts` PASS (`5 passed / 9 skipped`); skipped tests are the DB-mutating
real-PG block because `REAL_POSTGRES_DATABASE_URL` was not supplied. Current schema truth remains 43 tables through
`0016_colorful_lyja`; no migration was needed. Final gates: `npm run db:generate -w @wtc/db` PASS (43 tables, no schema
drift), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run secret:scan` PASS,
`npm run governance:check` PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all present), and
`node scripts/gates.mjs full` PASS (9/9). **Still NOT RUN:** active real-Postgres auth/account race proof with
operator-provided fresh `wtc_test*` credentials, production nginx/shared-store auth throttling, production DB rollout, email
notification/review workflow, password reset/change/verify-email route lockout, append-only audit DB role, live production
deploy, GitHub CI, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md`](handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md).

**Manual fallback:** operator provides a fresh empty `REAL_POSTGRES_DATABASE_URL=postgres://.../wtc_test_<suffix>`; run only
`npm test -- tests/integration/db-real-postgres.test.ts`; report the gate as RUN only if all active real-PG tests pass without
skips against that fresh throwaway DB. Do not point this harness at preview, production, or a persistent developer DB.

**Phase 3.45 (registration audit) is landed locally** - the operator's continuous phase-group program continues.
`@wtc/audit` now includes `auth.register`; DB-backed public registration passes `auditRegistration: true` into
`createUser()`, which inserts the new user, inserts roles, and writes the registration audit row in the same DB transaction.
Demo mode writes the same event for local parity. The audit payload contains only `roles` and `hasDisplayName`; focused tests
assert it does not contain the submitted email or password hash, duplicate registration does not create a success audit row,
and public register/login copy remains neutral. Gates observed: focused registration/auth Vitest **27 passed**,
`npm run check:core` PASS, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `npm run secret:scan` PASS, and
`node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44 passed`), `npm run worker:smoke` PASS,
final artifact scan PASS, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS (0 errors / 1 known
warning; 7 cited per-agent handoffs all present). **Still NOT RUN:** active real-Postgres auth race proof without
`REAL_POSTGRES_DATABASE_URL`, production nginx/shared-store auth throttling, production DB rollout, email
notification/review workflow, password reset/change/verify-email route lockout, append-only audit DB role, live production
deploy, GitHub CI, and production monitoring. The stale real-Postgres table-set assertion cleanup landed locally in
Phase 3.46. Aggregate:
[`docs/handoffs/20260602-1045-phase-3-45-registration-audit.md`](handoffs/20260602-1045-phase-3-45-registration-audit.md).

**Phase 3.44 (admin account unlock) is landed locally** - the operator's continuous phase-group program continues.
`@wtc/db` now owns `unlockUserLoginLockout()`: a target-user row lock, full failed-login/lockout/review-state clear, and
in-transaction `auth.account_unlock` audit row with safe before/after state plus validated admin reason. The admin users
server action now runs `requireUser()`, `assertAdmin(actor.roles)`, `assertCsrf(formData)`, `unlockAccountSchema`, the DB
repo call, and revalidation of `/admin/users` plus `/admin/audit-log`. `/admin/users` renders admin-safe lockout state and a
per-row unlock form only for locked or review-required accounts. Public `/login` copy and redirects remain generic.
No migration was needed. Gates green: focused admin-unlock/auth Vitest **82 passed / 9 skipped**, `npm run check:core` PASS,
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), `npm run worker:smoke` PASS, final artifact scan PASS, final
`npm run secret:scan` PASS, and final `npm run governance:check` PASS.
**Still NOT RUN:** active real-Postgres admin-unlock race proof without `REAL_POSTGRES_DATABASE_URL`, production
nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring.
Registration audit landed locally in Phase 3.45. Aggregate:
[`docs/handoffs/20260602-0940-phase-3-44-admin-account-unlock.md`](handoffs/20260602-0940-phase-3-44-admin-account-unlock.md).

**Phase 3.43 (DB-backed account login lockout) is landed locally** - the operator's
continuous phase-group program continues. `@wtc/auth` now owns pure login-lockout policy math, `users` has durable
failed-login/lockout/review columns via migration `0016_colorful_lyja`, and `@wtc/db` owns the transactional
`attemptUserLogin` path that row-locks the account, denies locked accounts before password verification, increments failure
state, resets state on success, and writes safe `auth.login_failed` audit rows. The web login action delegates to
`attemptLogin()` and keeps invalid, unknown, and locked accounts on the same generic `invalid_credentials` browser copy.
Gates green: focused lockout/auth Vitest **17 passed / 8 skipped**, `npm run check:core` PASS, `npm run typecheck`
PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `node --check scripts/gates.mjs` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and `node scripts/gates.mjs full` PASS (9/9; Vitest
**824 passed / 9 skipped**), `node scripts/gates.mjs e2e` PASS (`44 passed`), `npm run worker:smoke` PASS, final artifact
scan PASS, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
**Still NOT RUN:** production nginx/shared-store auth throttling, production DB rollout, email notification/review workflow,
live production deploy, GitHub CI, and active real-Postgres account-lockout race proof without
`REAL_POSTGRES_DATABASE_URL`. Admin unlock UI/action landed locally in Phase 3.44. Aggregate:
[`docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`](handoffs/20260602-0903-phase-3-43-auth-account-lockout.md).

**Phase 3.41 (Axioma handoff preflight) is landed locally** - the operator's
continuous phase-group program continues. `@wtc/axioma-bridge` now owns a generated-key ES256/JWKS preflight helper, and
`npm run accept:axioma:handoff-preflight` runs a no-network dry-run through the local journal-handoff and JTI consume handlers
against disposable PGlite. The command refuses production and pre-existing Axioma signing-key/service-token env values, writes
only redacted count/status evidence, and stays out of `ci:local`, default `e2e`, and `scripts/gates.mjs`. Shared route
readiness now rejects invalid ES256 key material before signing, `check:core` includes generated ES256/JWKS smoke coverage,
and the artifact scanner denies Axioma PEM/key/token/JWT/raw-claim/handoff-route evidence. Gates green: focused
Axioma/scanner Vitest **72 passed**, script syntax PASS, `npm run check:core` PASS, dry-run Axioma preflight plus temp artifact
scan PASS, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9; Vitest
**806 passed / 8 skipped**), `node scripts/gates.mjs e2e` PASS (`44 passed`), final artifact scan PASS, final
`npm run secret:scan` PASS, and final `npm run governance:check` PASS.
**Still NOT RUN:** live Axioma endpoint-shape/JWKS/handoff/download/account-link acceptance, production P-256 key
provisioning, service-token provisioning, live installer streaming/security acceptance, real-Postgres JTI race proof, browser
CTA enablement, and CI. Aggregate:
[`docs/handoffs/20260602-0808-phase-3-41-axioma-handoff-preflight.md`](handoffs/20260602-0808-phase-3-41-axioma-handoff-preflight.md).

**Phase 3.40 (Stripe checkout request preflight) is landed locally** - the operator's
continuous phase-group program continues. `@wtc/billing` now owns Stripe checkout request helpers for price-map parsing,
test-mode config validation, request/body construction, and redacted summaries. `npm run accept:billing:stripe-checkout`
builds generated fake checkout requests in memory only, performs no Stripe network I/O, writes no pending-payment rows, and
refuses `APP_ENV=production` or live `sk_live_` keys. The artifact scanner now denies Stripe price IDs, Checkout endpoint
paths, raw request field names, secret keys, and Checkout Session IDs in retained evidence. Gates green: focused
billing/checkout Vitest **48 passed**, script syntax PASS, dry-run checkout preflight plus temp artifact scan PASS,
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), final artifact scan PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS.
**Still NOT RUN:** real Stripe Checkout Session creation, Stripe CLI/Dashboard replay, Stripe test price verification,
pending-payment to active with provider events, production key provisioning, production endpoint registration, live/staging
route replay, and CI. Aggregate:
[`docs/handoffs/20260602-0751-phase-3-40-stripe-checkout-preflight.md`](handoffs/20260602-0751-phase-3-40-stripe-checkout-preflight.md).

**Phase 3.39 (Stripe webhook replay preflight) is landed locally** - the operator's
continuous phase-group program continues. `@wtc/billing` now owns Stripe replay fixture helpers, and
`npm run accept:billing:stripe-webhook` runs a no-network dry-run through the extracted webhook handler against disposable
PGlite. It proves valid signed checkout replay, terminal duplicate no-op, bad-signature rejection, and missing-user
manual-review behavior while writing only redacted count/status evidence. The artifact scanner now denies retained Stripe
secret assignments/tokens, signatures, raw event bodies, and checkout session IDs. Gates green: focused
billing/replay Vitest **55 passed**, script syntax PASS, dry-run replay plus temp artifact scan PASS, `npm run typecheck`
PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), final artifact scan PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS.
**Still NOT RUN:** Stripe CLI/Dashboard replay, real Stripe test checkout acceptance, production key provisioning,
production webhook endpoint registration, live/staging route replay, and CI. Aggregate:
[`docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`](handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md).

**Phase 3.38 (LMS live external scanner acceptance preflight) is landed locally** - the operator's
continuous phase-group program continues. `@wtc/lms` now owns the external scanner request/response contract, web uploads reuse
that shared scanner helper, `npm run accept:lms:external-scanner` provides a dry-run-first/live-opt-in scanner preflight
command, and the artifact scanner now denies scanner request headers, live scanner consent envs, octet-stream request markers,
and raw provider JSON verdict bodies in retained evidence. Gates green: focused scanner/preflight Vitest **44 passed**,
script syntax PASS, dry-run scanner preflight plus temp artifact scan PASS, `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial `npm run governance:check` PASS,
initial `npm run secret:scan` PASS, initial artifact scan PASS, `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), final artifact scan PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS.
**Still NOT RUN:** live external scanner acceptance with operator endpoint/token, live S3/R2 acceptance, DB-backed browser
acceptance, cleanup/reconcile live acceptance, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0659-phase-3-38-lms-external-scanner-live-preflight.md`](handoffs/20260602-0659-phase-3-38-lms-external-scanner-live-preflight.md).

**Phase 3.37 (LMS live S3/R2 acceptance preflight) is landed locally** - the operator's
continuous phase-group program continues. Shared object-store tests now pin exact deterministic SigV4 PUT/DELETE/read URL
vectors, `npm run accept:lms:object-storage` provides a dry-run-first and live-opt-in S3/R2 preflight command, and the
artifact scanner now denies object-store env assignments, signed request headers, provider XML body markers, and request-id
headers in retained evidence. Gates green: focused LMS/storage/preflight Vitest **103 passed**, script syntax PASS,
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS,
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial `npm run secret:scan` PASS,
initial `npm run governance:check` PASS, initial artifact scan PASS, `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), final artifact scan PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS.
**Still NOT RUN:** live S3/R2 acceptance with throwaway credentials, DB-backed browser acceptance, live external scanner
acceptance, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md`](handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md).

**Phase 3.36 (LMS cleanup dead-letter acknowledgement/retry) is landed locally** - the operator's
continuous phase-group program continues. `lms_object_cleanup_tasks` now has durable acknowledgement metadata, admin ack/retry
actions are guarded aggregate cohort mutations with expected count/latest timestamp snapshots, `/admin/system-health` exposes
acknowledged counts plus compact CSRF-protected controls, and retry requeues reviewed dead letters for the worker without
performing object DELETE in the admin request or resetting attempts. Gates green: focused Phase 3.36 Vitest
**28 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
`npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
initial `npm run governance:check` PASS, initial `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9),
`node scripts/gates.mjs e2e` PASS (`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final
`npm run secret:scan` PASS, and final `npm run governance:check` PASS. **Still NOT RUN:** DB-backed browser acceptance,
live S3/R2 acceptance, live external scanner acceptance, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md`](handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md).

**Phase 3.35 (LMS shared object-storage primitives) is landed locally** - the operator's continuous
phase-group program continues. `@wtc/lms` now owns shared S3/R2 request builders for signed PUT, DELETE, and read redirects;
web upload/download/compensation and worker cleanup use those helpers instead of app-local SigV4 code. Gates green:
focused Phase 3.35 Vitest **24 passed**, broader focused LMS/config/worker/scanner Vitest **73 passed**,
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
`npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial `npm run governance:check` PASS,
initial `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS
(`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS. **Still NOT RUN:** DB-backed browser acceptance, live S3/R2 acceptance, live external
scanner acceptance, dead-letter acknowledgement/retry workflow, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md`](handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md).

**Phase 3.34 (LMS cleanup dead-letter ops review) is landed locally** - the operator's continuous
phase-group program continues. `/admin/system-health` now has a count-only LMS upload cleanup review card backed by a safe DB
summary that never selects cleanup task IDs or storage keys. Worker `error` renders as a bad heartbeat state, LMS pending
cleanup count fields are projected into admin health detail, and dead-letter transitions write summary-only cleanup audit
events. Gates green: focused Phase 3.34 Vitest **51 passed**, broader focused LMS/admin/worker/scanner Vitest
**94 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
`npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
`node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44 passed`),
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS. **Still NOT RUN:** DB-backed browser acceptance, live S3/R2 acceptance, live external scanner acceptance,
dead-letter acknowledgement/retry workflow, shared object-store primitive extraction, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md`](handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md).

**Phase 3.33 (LMS durable upload cleanup boundary) is landed locally** - the operator's continuous
phase-group program continues. LMS clean `s3-r2` uploads now create a private `lms_object_cleanup_tasks` row before object
PUT, and successful material creation clears that row in the same DB transaction as the material insert/audit. Failed material
creation still attempts immediate compensation; successful compensation completes the cleanup task, while failed compensation
records generic retry state. The worker now processes pending upload cleanup rows separately from expired material-row cleanup:
signed DELETE 2xx/404 completes rows, failures increment attempts/backoff, and max-attempt failures dead-letter. Schema is now
**43 tables**. Gates green: focused Phase 3.33 Vitest **68 passed**, broader focused LMS/config/worker/scanner Vitest
**134 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run worker:smoke` PASS,
`npm run db:generate -w @wtc/db` PASS (no schema drift after migration), initial `npm run governance:check` PASS,
`node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44 passed`),
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final `npm run secret:scan` PASS, and final
`npm run governance:check` PASS. **Still NOT RUN:** DB-backed browser acceptance, live S3/R2 acceptance, live external
scanner acceptance, dead-letter operational review/alerting, shared object-store primitive extraction, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md`](handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md).

**Phase 3.32 (LMS upload compensation boundary) is landed locally** - the operator's continuous phase-group program
continues. The LMS teacher material upload path now has a local best-effort compensation boundary for the case where a clean
`s3-r2` object PUT succeeds but material DB creation fails: the action delegates through
`createMaterialWithUploadCompensation`, attempts a signed `DELETE` for actually-written clean `s3-r2` file inputs, treats
`404` as already reconciled, does not delete quarantined metadata-only rows, and preserves the original DB/material creation
error even when compensation fails. Gates green: focused helper/storage/static Vitest **42 passed**, broader focused
LMS/config/worker/scanner Vitest **123 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
`npm run worker:smoke` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS
(`40 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots, final `npm run secret:scan`
PASS, and final `npm run governance:check` PASS. **Still NOT RUN:** durable pending-row/outbox/staging-key retry for failed
compensation or process interruption, live S3/R2 upload/download/delete/reconcile acceptance, live external scanner
acceptance, actual DB browser acceptance, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md`](handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md).

**Phase 3.31 (LMS object-store cleanup/reconciliation boundary) is landed locally** - the operator's
continuous phase-group program continues. The worker now has a separate local `s3-r2` cleanup path for expired LMS file rows:
it selects eligible object-store rows, sends SigV4 `DELETE` for clean soft-deleted rows before hard-deleting DB state, treats
`404` as already reconciled, purges non-clean metadata-only rows without remote object calls, and leaves rows retryable when
remote delete fails. Worker health and one-shot output now report count-only object cleanup fields, and cleanup audit remains
summary-only. Runtime LMS uploads reject local storage providers in `APP_ENV=staging`, and artifact scanner coverage now
fails retained cleanup evidence with raw object keys, auth headers, or signed tokens. Gates green: focused
LMS/config/worker/scanner Vitest **91 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
`npm run worker:smoke` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS
(`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots, final `npm run secret:scan`
PASS, and final `npm run governance:check` PASS. **Still NOT RUN:** live S3/R2 upload/download/delete/reconcile acceptance, live external scanner
acceptance, actual DB browser acceptance, compensating delete/outbox coverage for object PUT followed by DB insert failure,
and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md`](handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md).

**Phase 3.30 (LMS external malware scanner adapter boundary) is landed locally** - the operator's
continuous phase-group program continues. External LMS scanning is now a real fail-closed server boundary rather than only a
config label: `LMS_FILE_SCANNER_MODE=external` requires HTTPS endpoint, bearer token, and optional timeout; uploads call the
scanner before storage writes; scanner failures/timeouts stop before object writes; clean verdicts may store normally; and
quarantined `s3-r2` verdicts create non-downloadable metadata rows without writing unsafe bytes to the standard object bucket.
Upload audit now records only `hasQuarantineReason`, and the generated-artifact scanner rejects scanner endpoint/token
assignments. Gates green: focused LMS/config/scanner Vitest **76 passed**, `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
`node scripts/gates.mjs e2e` PASS (`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated
roots, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS. **Still NOT RUN:** live external scanner
acceptance, live S3/R2 acceptance, object-store delete/reconciliation cleanup, actual DB browser acceptance, and public upload
rollout. Aggregate:
[`docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`](handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md).

**Phase 3.29 (LMS S3/R2 object-storage adapter boundary) is landed locally** - the operator's continuous phase-group program
continues. `s3-r2` is now an explicit LMS storage provider with typed fail-closed config for HTTPS endpoint, bucket, region,
access key id, and secret access key. The server storage boundary can SigV4 PUT to an S3/R2-compatible path-style endpoint,
keeps new object keys opaque, persists no inline DB bytes for object-store rows, and signs short-lived redirect URLs for clean
downloads after session, entitlement, published-row, and storage-resolution gates pass. Teacher file uploads now check
lesson/course ownership before any external object write. Repository insertion rejects unknown providers, and the artifact
scanner now rejects signed URL tokens (`X-Amz-*`, `AWSAccessKeyId`) in retained generated text artifacts. Gates green:
focused LMS/config/scanner Vitest **82 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
`node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:** live S3/R2
upload/download/delete/reconcile acceptance, external malware scanner acceptance, actual DB browser acceptance, and public
upload rollout. Aggregate:
[`docs/handoffs/20260602-0317-phase-3-29-lms-s3-r2-object-storage-boundary.md`](handoffs/20260602-0317-phase-3-29-lms-s3-r2-object-storage-boundary.md).

**Phase 3.28 (LMS DB artifact dynamic marker manifest) is landed locally** - the operator's continuous phase-group program
continues. The guarded LMS DB browser runner now creates a transient dynamic marker manifest at
`.next-e2e-db/lms-db-e2e-dynamic-markers.json`, passes it as `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, and deletes it before final
archive instructions. The DB browser spec appends per-run uploaded body, quarantined body, filename, SHA-256, and raw embed
markers, and the scanner rejects those exact values plus base64 forms while printing only marker labels. Gates green: focused
scanner/harness Vitest **17 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
`node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:** actual DB browser acceptance, real
S3/R2 object storage, production malware scanner, signed-object redirects, object-store delete/reconciliation cleanup, and
public upload rollout. Aggregate:
[`docs/handoffs/20260602-0301-phase-3-28-lms-db-dynamic-artifact-markers.md`](handoffs/20260602-0301-phase-3-28-lms-db-dynamic-artifact-markers.md).

**Phase 3.27 (LMS filename minimization) is landed locally** - the operator's continuous phase-group program continues.
Successful LMS material downloads now use generic MIME-derived attachment names (`lesson-material.*`) instead of uploaded
filenames. LMS material upload/download audit payloads omit `fileName` and `mimeType`, and teacher material DTO/UI no longer
projects or renders original file names. The generated-artifact scanner now rejects `fileName` and `mimeType` markers in LMS DB
e2e text artifacts. Gates green: focused LMS/scanner Vitest **66 passed**, `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e`
PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:**
actual DB browser acceptance, real S3/R2 object storage, production malware scanner, signed-object redirects, object-store
delete/reconciliation cleanup, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md`](handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md).

**Phase 3.26 (LMS opaque keys and no hash header) is landed locally** - the operator's continuous phase-group program continues.
This phase keeps new local LMS storage keys opaque and non-deterministic: new upload paths generate a single `lms/materials/<opaque-id>`
segment with `node:crypto.randomUUID()` and tests prove identical names/bytes do not produce deterministic hash/name keys.
Successful downloads now have no `x-lms-sha256` response header, the route/browser-source assertions pin that absence, and
the generated-artifact scanner now rejects the deprecated header name. Upload/download audit payloads retain only
`hasContentHash` instead of raw content digests; DB/server-private hashes remain for byte integrity. Gates green: focused
LMS/scanner Vitest **49 passed**, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
`node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:** actual DB browser
acceptance, real S3/R2 object storage, production malware scanner, signed-object redirects, object-store delete/reconciliation
cleanup, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0227-phase-3-26-lms-opaque-keys-no-hash-header.md`](handoffs/20260602-0227-phase-3-26-lms-opaque-keys-no-hash-header.md).

**Phase 3.25 (LMS storage adapter boundary) is landed locally** - the operator's continuous phase-group program continues.
This phase adds the first real storage abstraction before production object storage: `db-local` remains the default local DB-byte
adapter, `fs-local` is an explicit local object-style adapter that writes under `LMS_FILE_STORAGE_ROOT`, and migration `0013`
allows non-`db-local` rows to omit inline `file_bytes_base64`. Downloads now provider-gate through the storage boundary and
fail closed for unsupported providers without writing a download audit. Typed config and `.env.example` document
`LMS_FILE_STORAGE_PROVIDER`, `LMS_FILE_STORAGE_ROOT`, `LMS_FILE_SCANNER_MODE`, and `LMS_PUBLIC_UPLOADS_ENABLED`; production
upload attempts with local-only providers are rejected. Gates green so far: focused LMS/config Vitest **80 passed**.
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
`node scripts/gates.mjs e2e` PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated
roots. **Still NOT RUN:** actual DB browser acceptance, real S3/R2 object storage, production malware scanner, signed-object
redirects, opaque production object keys, object-store delete/reconciliation cleanup, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0207-phase-3-25-lms-storage-adapter-boundary.md`](handoffs/20260602-0207-phase-3-25-lms-storage-adapter-boundary.md).

**Phase 3.24 (LMS local material cleanup worker) is landed locally** - the operator's continuous phase-group program continues.
The LMS DB browser gate still cannot be marked RUN because no usable `LMS_E2E_DATABASE_URL` or
`LMS_E2E_ADMIN_DATABASE_URL` has been supplied. This phase adds the local maintenance slice for DB-backed material cleanup:
expired `db-local` file rows are hard-deleted only when already soft-deleted or unsafe (`pending` / `quarantined` / `failed`)
and only when their storage key matches the local `lms/materials/` prefix. The worker tick now invokes that cleanup and records
`lmsMaterialsPurged` in count-only health/log surfaces. Cleanup audit accountability is a summary-only
`education.material_cleanup` event with no material IDs, filenames, hashes, raw bytes, base64, storage keys, or quarantine
details. Gates green: focused LMS/worker Vitest **34 passed**, `npm run worker:smoke` PASS,
`node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:** actual DB browser
acceptance, production object storage, production malware scanner, signed-object redirects, object-store delete/reconciliation
cleanup, and public upload rollout. Aggregate:
[`docs/handoffs/20260602-0144-phase-3-24-lms-material-cleanup.md`](handoffs/20260602-0144-phase-3-24-lms-material-cleanup.md).

**Phase 3.23 (LMS DB browser managed runner) is landed locally** - the operator's continuous phase-group program continues.
The LMS DB browser gate still cannot be marked RUN because no usable `LMS_E2E_DATABASE_URL` or admin
`LMS_E2E_ADMIN_DATABASE_URL` has been supplied in this session. Local inspection found Postgres listening on `127.0.0.1:5432`
but no `psql`/Docker CLI and no accepted default credentials. To reduce that blocker, this phase adds
`npm run e2e:lms:db:managed`, a repo-native wrapper that creates a fresh `wtc_test_lms_*` database from an operator-supplied
admin URL, delegates to the existing guarded `npm run e2e:lms:db` runner, and drops the throwaway DB in `finally` without
printing URLs. The prep/config DB-name guard now accepts documented multi-segment names such as `wtc_test_lms_<timestamp>`.
Gates green: focused harness/scanner Vitest **15 passed**, script syntax check PASS, `node scripts/gates.mjs full` PASS
(9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS
on current generated roots. **Still NOT RUN:** actual DB browser acceptance, because no valid throwaway/admin DB URL is
available yet. Aggregate:
[`docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md`](handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md).

**Phase 3.22 (LMS material DTO boundary hardening) is landed locally** - the operator's continuous phase-group program continues.
**Phase 3.22:** LMS material projection boundaries are now explicit before the first real throwaway-Postgres browser run.
`MaterialView` is student-safe and omits filename/MIME plus storage/hash/quarantine/retention/delete metadata; teacher
management surfaces use `TeacherMaterialView` for display-only `fileName` and `mimeType`; admin audit rendering remains
summary-only and payload-free. Static coverage now pins the student DTO slice, teacher-only filename projection, student vs.
teacher mapper usage, and admin audit projection allowlist. Gates green: focused Vitest **66 passed**, `npm run typecheck`
PASS, `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
`node scripts/gates.mjs e2e` PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated
roots. Final governance after the aggregate exists is PASS (0 errors / 1 known historical warning). **Still NOT RUN:** the actual `npm run e2e:lms:db` gate, because no fresh empty `LMS_E2E_DATABASE_URL` was supplied.
**Next local LMS gate:** when a fresh throwaway DB is available, run `npm run e2e:lms:db`, archive only redacted evidence after
the scanner passes, and drop the DB. Aggregate:
[`docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`](handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md).

**Phase 3.21 (LMS DB no-leak assertion hardening) is landed locally pending broad gates** - the operator's continuous phase-group program continues.
**Phase 3.21:** the LMS DB browser source/spec layer is stricter before the first real throwaway-Postgres run. Failed download
responses now assert no uploaded bytes/base64, concrete filename/hash, internal material metadata, success-only headers,
`set-cookie`, or non-JSON content type on `401`/`403`/`400`; admin/rendered pages assert no internal material metadata; safe
iframe checks pin sandbox, no-referrer, lazy loading, allowlist, fullscreen, and absent `srcdoc`. The artifact scanner now also
rejects internal metadata fields plus session-cookie and lowercase/JSON auth-header forms, and handler integration tests assert
failed paths do not leak or audit. Gates green: focused Vitest **61 passed**, `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e`
PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. **Still NOT RUN:** the
actual `npm run e2e:lms:db` gate, because no fresh empty `LMS_E2E_DATABASE_URL` was supplied. **Next local LMS gate:** when a
fresh throwaway DB is available, run `npm run e2e:lms:db`, archive only redacted evidence after the scanner passes, and drop
the DB. Aggregate:
[`docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`](handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md).

**Phase 3.20 (LMS DB e2e artifact no-leak scanner) is landed locally** - the operator's continuous phase-group program continues.
**Phase 3.20:** the opt-in LMS DB browser runner now includes a generated-artifact no-leak scanner. The scanner checks only
generated artifact roots (`test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`), fails on raw
material bytes/base64/storage-key/raw-iframe markers and secret-shaped runtime values, skips screenshot image bytes, fails
closed on compressed/container artifacts, and does not print matched values. The runner invokes the scanner after any Playwright
attempt, including failed attempts, while preserving the Playwright failure status. Gates green: focused Vitest **60 passed**,
`npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
`node scripts/gates.mjs e2e` PASS (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated
roots. **Still NOT RUN:** the actual `npm run e2e:lms:db` gate, because no fresh empty `LMS_E2E_DATABASE_URL` was supplied.
**Next local LMS gate:** create a fresh throwaway Postgres DB, set `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db`, archive
only redacted evidence after the scanner passes, and drop the DB. Remaining production LMS upload work is real object storage,
a production malware scanner, signed-object redirects, quarantine cleanup, and public rollout approval. Aggregate:
[`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`](handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md).

**Phase 3.19 (LMS DB browser negative/embed acceptance hardening) is landed locally** - the operator's continuous phase-group program continues.
**Phase 3.19:** the opt-in LMS DB browser spec now covers more of the fail-closed material surface before the first real
throwaway-Postgres run: unauthenticated download `401`, non-entitled teacher download `403`, quarantined file visible but
download-unavailable, sanitized Vimeo iframe rendering, raw embed/no byte/base64/storage-key leakage, invalid material-ID
`400`, clean-file headers/body/hash, and admin audit visibility. The runner now requires `LMS_E2E_DATABASE_URL` only,
reserves `REAL_POSTGRES_DATABASE_URL` for the non-browser real-PG Vitest harness, cleans its prep marker after the run, and
documents artifact capture. Gates green so far: focused Vitest **54 passed**, `npm run typecheck` PASS,
`npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), and env-cleared `node scripts/gates.mjs e2e`
PASS (`44 passed`). **Still NOT RUN:** the actual
`npm run e2e:lms:db` gate, because no fresh empty `LMS_E2E_DATABASE_URL` was supplied. **Next local LMS gate:** create a fresh
throwaway Postgres DB, set `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db`, archive artifacts, scan artifacts for leaks, and
drop the DB. Remaining production LMS upload work is real object storage, a production malware scanner, signed-object redirects,
quarantine cleanup, and public rollout approval.
Aggregate:
[`docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`](handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md).

**Phase 3.17 (LMS storage/scan/retention metadata) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.17:** LMS file uploads now persist explicit local storage identity, scan/quarantine state, retention timestamps,
and soft-delete visibility. Migration `0012` adds `storage_provider`, non-public `storage_key`, `scan_status`,
`scan_checked_at`, `quarantine_reason`, `retained_until`, and `deleted_at` to `materials`, with a backfill for existing
local file rows. The LMS package now byte-sniffs PDF/PNG/JPEG uploads, prepares deterministic `db-local` keys, and locally
quarantines EICAR/executable-looking text signatures. Downloads fail closed unless the file is active, published,
hash-valid, and clean; UI surfaces show scan state without exposing storage keys. Gates green: focused Vitest **55 passed**,
`node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance
PASS. Remaining production LMS upload work is real object storage, a production malware scanner, signed-object redirects,
quarantine cleanup, and DB-backed browser acceptance; do not market `db-local` byte storage as production object storage.
Aggregate:
[`docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`](handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md).

**Phase 3.16 (worker local smoke and heartbeat monitoring) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.16:** local worker readiness now has a safe one-shot command: `npm run worker:smoke`. It forces mock adapters and
disables live bot control / TV automation before running the worker tick path (`DATABASE_URL` DB tick when configured,
memory-demo tick otherwise). Worker DB ticks persist a `worker` heartbeat with safety flags; admin system health shows the
latest heartbeat, redacted health details, and newest-first health rows. Remaining non-local acceptance: operator-approved
preview/production process deployment, process-manager/service health monitoring, and real-Postgres worker acceptance when
credentials are provided. Gates green: focused Vitest **36 passed**, `npm run worker:smoke` PASS, `node scripts/gates.mjs full`
PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance PASS. Aggregate:
[`docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`](handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md).

**Phase 3.15 (LMS local file/embed storage) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.15:** LMS file/embed support now has a real local backend slice. Migration `0011` adds sanitized lesson embeds,
DB-backed material file bytes/metadata, material embed storage, and payload checks. Teacher actions sanitize iframe embeds,
normalize file uploads (PDF/PNG/JPEG/TXT, max 5 MB), and create link/file/embed materials. Student lesson pages render sanitized
iframe props without raw HTML and download files through `/api/education/materials/[materialId]/download` with session,
education-entitlement, published-course/lesson, strict headers, and `education.material_download` audit. Focused tests are green:
`packages/lms/src/materials.test.ts`, `tests/integration/db-lms-ph3-1.test.ts`,
`tests/integration/lms-material-download-handler.test.ts`, `tests/integration/lms-ph3-1-static.test.ts`, and
`tests/integration/lms-service.test.ts` -> **49 passed**. Broad gates are green: `node scripts/gates.mjs full` PASS (9/9),
env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance PASS (0 errors / 1 known historical warning).
Remaining production LMS upload work is object storage,
malware scan/quarantine, retention policy, and DB-backed browser acceptance; do not market local DB byte storage as production
object storage.

**Phase 3.14 (Axioma account-link route handlers) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.14:** WTC-side local account-link routes are implemented without touching live Axioma. `POST /api/axioma/account-link/init`
uses CSRF/session/entitlement/readiness gates, emits a five-minute raw OTC only once, persists only `link_nonce_hash`, and blocks
already-linked users from issuing new codes. `POST /api/axioma/account-link/complete` is a service-bearer JSON envelope only,
rejects all query strings, accepts `axiomaUserId` or `axioma_user_id`, re-checks current WTC entitlement for the pending row owner,
and consumes the hash-only OTC with redacted audit. `DELETE /api/axioma/account-link` revokes pending/linked rows through the
transactional DB helper. Aggregate:
[`docs/handoffs/20260601-2117-phase-3-14-axioma-account-link-routes.md`](handoffs/20260601-2117-phase-3-14-axioma-account-link-routes.md)
(cites 4 per-agent handoffs). Gates green: focused Vitest **52 passed / 1 skipped**, `node scripts/gates.mjs full` PASS (9/9),
env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance PASS. **Next big phase:** live Axioma
endpoint-shape/key/download/account-link acceptance only when credentials and endpoint contracts are provided; terminal CTA
enablement only after those live gates pass. Still do not touch live bots/exchanges/TradingView/Axioma without explicit scoped
approval.

**Phase 3.13 (Axioma account-link hash/uniqueness persistence) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.13:** WTC-side Axioma account-link persistence no longer depends on plaintext OTC for new local flows. Migration
`0010` adds `link_nonce_hash`, consume/revoke/link/verify timestamps, an expiry index, a unique nonce-hash index, and partial
active-link uniqueness for both WTC user id and Axioma user id. The migration clears existing `one_time_code` values and
revokes legacy pending codes. `@wtc/db` now issues only canonical SHA-256-hex OTC hashes, revokes prior pending nonces on
reissue, consumes once with audit redaction, rejects expired/revoked/replayed/invalid cases, and exposes a deterministic
linked-account read helper used by journal handoff issuance. **Next big phase:** account-link route handlers
(`/api/axioma/account-link/init`, completion/service-auth envelope, and unlink/revoke), followed by live Axioma endpoint-shape
and key/download acceptance only when credentials and endpoint contracts are provided. Aggregate:
[`docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md`](handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md)
(cites 4 per-agent handoffs). Gates green: focused Vitest **20 passed**, `node scripts/gates.mjs full` PASS (9/9),
env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance PASS. Terminal CTAs stay disabled.

**Phase 3.12 (Axioma download token/proxy local acceptance) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.12:** WTC-side Axioma download delivery now has durable local token semantics without touching live Axioma. The
`POST /api/axioma/download` route issues a short-lived one-time WTC proxy URL only after CSRF/auth/entitlement/readiness checks, stores only
`token_hash` in `terminal_download_events`, and audits `axioma.download_request` without raw token values. The
`GET /api/axioma/download/terminal?token=...` path consumes the token atomically, rejects replay/expiry/wrong-user cases, and streams only
through an injected installer provider in tests. The runtime Next adapter intentionally has no live installer fetcher yet and
returns fail-closed `501` without consuming tokens. Migration `0009` adds `token_hash`, `expires_at`, `consumed_at`,
`revoked_at`, and `axioma_user_id` to `terminal_download_events`. Aggregate:
[`docs/handoffs/20260601-2013-phase-3-12-axioma-download-token-proxy.md`](handoffs/20260601-2013-phase-3-12-axioma-download-token-proxy.md)
(cites 4 per-agent handoffs). Gates green: focused Vitest **35 passed / 1 skipped**, `node scripts/gates.mjs full` PASS
(9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44 passed`), and final governance PASS. **Next big phase:**
account-link OTC hash migration plus active-link uniqueness, live Axioma endpoint-shape/key/download acceptance only when
credentials and endpoint contracts are provided, and terminal CTA enablement only after those gates pass. Still do not touch
live bots/exchanges/TradingView/Axioma without explicit scoped approval.

**Phase 3.11 (journal handoff route acceptance) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.11:** local Axioma Open Journal issuance is now dynamically proven without touching live Axioma. The journal-handoff
route is extracted into an injectable handler, requires POST plus CSRF/auth/entitlement/readiness, requires a linked Axioma
user id before signing `open_journal`, writes the replay JTI and `axioma.account_link_init` audit row atomically, and preserves
POST-body/no-query-token behavior. Grace entitlement snapshots now use `graceUntil` as the effective access window. Aggregate:
[`docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`](handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md)
(cites 4 per-agent handoffs). Gates green: focused Vitest **29 passed / 1 skipped**, `node scripts/gates.mjs full` PASS
(9/9), env-cleared Playwright e2e **44 passed / 6 skipped**, and final governance PASS. **Next big phase:** Axioma download
route token/proxy acceptance, account-link OTC hash migration plus active-link uniqueness, and live Axioma endpoint-shape/key
acceptance only when credentials and endpoint contracts are provided. Still do not touch live bots/exchanges/TradingView/Axioma
without explicit scoped approval.

**Phase 3.10 (local B4 consume + TradingView task uniqueness) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.10:** WTC-side local readiness is stronger without touching live services. TradingView revoke tasks now have a
database uniqueness boundary on `(request_id, kind)` through migration `0008`, with historical duplicate cleanup and
conflict-safe inserts from both expiry sweep and repair. Axioma now has a fail-closed `POST /api/axioma/jti/consume` route
for Option A replay checks, protected by route flag, DB availability, trimmed non-empty `AXIOMA_BRIDGE_API_TOKEN`, bearer
auth, UUID validation, no-store responses, and consume/replay audit rows. Docs were reconciled to current audit codes,
current ES256 env names, JWKS fail-closed behavior, and the local consume-route boundary. Aggregate:
[`docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`](handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md)
(cites 4 per-agent handoffs). Gates green: targeted Vitest **38 passed / 1 skipped**, `node scripts/gates.mjs full` PASS
(9/9), and env-cleared Playwright e2e rerun **44 passed / 6 skipped** after one transient `ECONNRESET` during the first
e2e attempt's test-login request. `db:generate` PASS with 42 tables and no schema changes. **Next big phase:** route-level journal-handoff acceptance,
download token/proxy design, account-link OTC hash migration, and real integration acceptance only when credentials and
Axioma endpoint shapes are provided. Still do not touch live bots/exchanges/TradingView/Axioma without explicit scoped approval.

**Phase 3.9 (route harness + repair/config readiness) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.9:** the local acceptance layer is stronger. Stripe webhooks now run through a testable extracted handler with signed
Request coverage for retry/duplicate/manual-review behavior. TradingView worker ticks repair historical worker-expiry revokes
that missed manual external revoke tasks. Axioma production config no longer requires the unused HS256 dev-stub secret; JWKS
readiness is shared and parse-verified; handoff claims now carry the actual entitlement snapshot and linked Axioma user id when
present. Aggregate:
[`docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`](handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md)
(cites 4 per-agent handoffs). Gates green: `node scripts/gates.mjs full` PASS; e2e **44 passed / 6 skipped**. **Next big phase:**
real integration acceptance if credentials are provided: Stripe CLI/dashboard replay, throwaway real-Postgres route/worker
acceptance, and Axioma B4 only after endpoint shapes and OP key provisioning are explicitly scoped. Still do not touch live
bots/exchanges/TradingView/Axioma without explicit scoped approval.

**Phase 3.8 (integration safety + bridge honesty) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.8:** local safety/honesty blockers from phase 3.7 are tightened. Billing webhook idempotency now starts with
`processing` and only acknowledges duplicate deliveries from terminal states. TradingView expiry revokes queue the manual
external revoke task in the same transaction. Axioma handoff tokens now match the documented JWT shape more closely
(`typ: JWT`, Unix-second claims, `nbf`, `wtc_*`, 32-byte nonce) and no exported bridge helper returns `?token=` URLs; terminal
CTAs remain fail-closed behind a separate implementation gate. Admin bot health preserves `not_configured` as setup-needed,
and the bot journal checks DB imports before adapter fallback. Aggregate:
[`docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`](handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md)
(cites 5 per-agent handoffs). Gates green: `node scripts/gates.mjs full` PASS; e2e **44 passed / 6 skipped**. **Next big phase:**
route-level Stripe webhook harness + real Stripe replay when credentials are provided; Axioma B4 endpoint/key/download/consume
activation only after endpoint shapes are approved; TradingView historical missing-task repair if production data can contain
pre-fix partial states. Still do not touch live bots/exchanges/TradingView/Axioma without explicit scoped approval.

**Phase 3.6 (strict e2e + IP-safe preview + admin terminal room) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.6:** the broad package is now inspectable without the old Playwright flake. E2E login moved to a guarded non-production
`/api/e2e/login` bypass, all e2e specs use shared helpers, retries are `0`, `.next-e2e` isolates the test server, and the gate
runner fails on any flaky count. `npm run preview:safe` binds `0.0.0.0:3000` with `shell:false`, so browser review can use the
local adapter IP. `/admin/terminal` now exists as a DB-only terminal release metadata room. Aggregate:
[`docs/handoffs/20260531-1600-phase-3-6-strict-e2e-ip-preview-admin-terminal.md`](handoffs/20260531-1600-phase-3-6-strict-e2e-ip-preview-admin-terminal.md)
(cites 4 per-agent handoffs). Gates green (test 575/8/583, coverage 24.17/76.27, e2e **44 passed / 6 skipped / 0 flaky / 0 failed**,
db:generate 41 tables). **Next big phase:** real integration acceptance plus production bridge readiness in parallel: throwaway
real-PG migrate/seed/harness, Stripe CLI/test webhook replay, Axioma endpoint/key activation, bot durable read snapshots, and
remaining LMS upload/embed/automation work. Do not narrow this into one small subsystem unless a blocker forces it.
Current blocker snapshot: [`docs/PRODUCTION_BLOCKERS_CURRENT.md`](PRODUCTION_BLOCKERS_CURRENT.md).

---

**Phase 3.5 (integration hardening + safe preview readiness) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.5:** deploy/preview safety and integration correctness are harder now: seed is idempotent, `npm run preview:safe`
forces mock/dev safety flags, billing webhook metadata failures go to durable manual review instead of silent `no_op`, Axioma
download/journal-handoff route skeletons fail closed, bot safety pages degrade to warnings, and `/admin/products` is a real
read-only admin overview. Aggregate:
[`docs/handoffs/20260531-1500-phase-3-5-integration-hardening.md`](handoffs/20260531-1500-phase-3-5-integration-hardening.md)
(cites 4 per-agent handoffs). Gates green (test 572/8/580, coverage 24.33/76.37, e2e 41 passed / 3 flaky-green / 6 skipped,
build 48 routes, db:generate 41 tables). **Next big phase:** real integration acceptance and production bridge readiness:
run throwaway real-PG migrate/seed/harness when credentials are provided, run Stripe CLI test webhook acceptance, finish Axioma
production bridge only after endpoint/key approval, and remove the old Playwright login flaky helper.

---

**Phase 3.4 (Stripe test checkout + pending-payment chain) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.4:** commercial checkout is no longer just a stub. Stripe test-mode Checkout Session creation is wired through
`@wtc/billing` REST calls, gated by `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PRICE_MAP`. `/app/billing` can start checkout when configured; WTC records `pending_payment` after session creation and
does **not** grant access until a signed webhook applies. Aggregate:
[`docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`](handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md)
(cites 4 read-only audit handoffs). Gates green (test 557/8/565, coverage 25.09/76.36, e2e 42 passed / 2 flaky-green / 6 skipped,
build 48 routes, db:generate 41 tables). **Next big phase:** production-readiness + integration acceptance: make `db:seed`
idempotent, run throwaway real-PG migrate/seed/harness, then run Stripe CLI/test-price webhook acceptance. Parallel follow-ups:
Axioma B4 fail-closed route skeletons, bot safety wrapper hardening, and admin products replacement.

---

**Phase 3.3 (bot rooms + education rooms) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.3:** Tortila and Legacy bot rooms now have product-specific WTC-side setup/settings, reference profiles, explicit
manual/auto intent, and demo config persistence. `/app/bots` is now entitlement-first and does not call read adapters for locked
products. Teacher education surfaces now include `/teacher/materials`, `/teacher/community`, teacher profile/social-link editing,
teacher-profile pinned links, course pinned links, and per-lesson material management. `/app/education` now renders community
links from `loadStudentCatalogue` instead of hardcoded "soon" placeholders. Aggregate:
[`docs/handoffs/20260531-1310-phase-3-3-bot-education-rooms.md`](handoffs/20260531-1310-phase-3-3-bot-education-rooms.md)
(cites 7 read-only audit handoffs). Gates green (test 550/8/558, coverage 24.74/75.98, e2e 41 passed / 3 flaky-green / 6 skipped,
build 48 routes, governance 7-cited, db:generate 41 tables). **Next big phase:** production-readiness + integration hardening:
real Postgres acceptance (B1), Stripe test-mode checkout (B2), Axioma production bridge/download/open-journal (B4), then the
remaining LMS epics (global pinned links, upload/object storage, embed sanitizer, slug routing).

---

**Phase 3.2 (backtester local-runner MVP + bot product surfaces + product directory) is landed & gate-verified** - the operator's continuous phase-group program continues.
**Phase 3.2:** Tortila now has an honest entitlement-gated **download-only local runner** (`wtc-backtester-0.1.0.zip` +
checksum test + `/api/bots/[bot]/backtest/runner-download`). Results stay local; server jobs/artifact upload are still deferred.
Bot settings/setup are now **product-specific** for Tortila vs Legacy and default to manual; Legacy live setup remains blocked by
B3. Tortila real-read mark/uPnL displays `N/A` when unavailable. `/app/products` is now a real cabinet product directory instead
of a placeholder. Aggregate:
[`docs/handoffs/20260531-1220-phase-3-2-backtester-product-surfaces.md`](handoffs/20260531-1220-phase-3-2-backtester-product-surfaces.md)
(cites 4 per-agent handoffs). Gates green (test 539/8/547, coverage 25.93/76.00, e2e 42 passed / 2 flaky-green / 6 skipped,
build 46 routes, governance 4-cited, db:generate 41 tables). **Next big phase:** production-readiness + integration hardening:
provide/verify throwaway real Postgres (B1) and run migrate/seed/harness; wire Stripe test-mode checkout (B2); continue Axioma
production handoff/download bridge (B4); then finish server-side backtester artifact pipeline if desired.

---

**Phase 3.1 (LMS rich — first bounded slice; migration 0005) is landed & gate-verified** — the operator's continuous phase-group program continues.
**Phase 3.1:** the **first bounded slice** of the rich LMS that PG7 deferred to Phase-3. Migration **0005** (additive, **41 tables**)
adds `courses.level` (+CHECK), `courses.tags` (text[], display/write only), `lessons.content_type` (+ backfill from `video_url`,
+CHECK) and `lessons.external_url`. **`deriveContentType` is retired** (the column is the single source of truth — co-landed to kill
dual-truth). Consumers co-landed (no dead schema): teacher create/edit forms (level/tags/content_type/external_url) + a **new
`updateLessonAction`** + level/tags/content-type display on catalogue/teacher/admin/student. **Security:** every URL write is now
`https://`-only (**fixed a pre-existing `javascript:`/`data:` href gap** in material/video URLs) + a render-time `safeHttpsUrl`
guard (`@wtc/lms/urls`); `'embed'` is a forward-compat CHECK value only (never written/rendered — needs the sanitizer). Aggregate:
[`docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`](handoffs/20260531-0130-phase-3-1-lms-rich.md) (cites 5 per-agent audit
handoffs at epoch `20260531-0130`). Gates green (test 532/8/540, db:generate **41 tables**, build, governance 5-cited; e2e per the
aggregate). ADR-021. New tooling: **`scripts/gates.mjs`** (sequential single-process gate runner — run `node scripts/gates.mjs
core|full|e2e`; avoids the Windows tool-result late-flush).
**Next slices (each its own session, each gated on its blocker):** the **embed sanitizer** (unlocks `embed_html` + a selectable
'embed'); the **upload security review + object-storage adapter** (unlocks `materials` file-meta); **Q-6 + a hand-edited CHECK
migration** (unlocks `pinned_links 'global'`); **slug-URL routing** (unlocks `courses.slug`); the **teacher community /
teacher-profile web surfaces are landed in Phase 3.3; only global pinned links remain deferred**; then **PG12 CI/deploy
readiness** (gated on real-PG B1 + git init B6). When real-PG (B1) is provided, apply 0005 to a throwaway `wtc_test` to prove
the CHECK + backfill on real Postgres.

---

**Phase 2.13 / PG10 (Backtester — honest permanently-locked card) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG10 (operator chose option (b)):** the Tortila backtester half-state (dead config form + disabled "Queue run" / "Download local runner (soon)" teasers + "future release" copy; Legacy "Coming soon") is replaced by an honest thin-shell page over a new **pure `@wtc/backtester` `deriveBacktesterView`** (+ `backtesterPill` + `BACKTESTER_RUNNER_DISTRIBUTED=false`) — 3 honest states (legacy boundary / access-required / "not yet available"), **no fake results**, FAIL CLOSED, **10 unit tests** (closing the package's prior 0% coverage; the orphaned spec-drifted in-memory stub was gutted). The bot-overview's false green "Available" backtester pill is now the shared honest pill. The real local-runner pipeline (option a) stays a deferred multi-session epic (blueprint in `BACKTESTER_DISTRIBUTION_PLAN.md` + `CONTRACTS/backtester-runner.md`); ADR-020. **No migration** (41 tables). Aggregate: [`docs/handoffs/20260531-0030-phase-2-13-backtester-locked-card.md`](handoffs/20260531-0030-phase-2-13-backtester-locked-card.md) (cites 5 per-agent audit handoffs at epoch `20260531-0030`). Gates green (lint, typecheck ×2, secret:scan, **test 504/8/512**, coverage **26.8/75.56**, db:generate **41 tables**, build, check:core, **e2e 40/5-skip/1-flaky-green/0-fail**, governance 5-cited). **Next phase groups (each its own session): Phase-3 LMS rich** (migration 0005 + consumers + pinned-link/teacher-profile surfaces), then **PG12 CI/deploy readiness** (gated on real-PG B1 + git init B6). Carried: F-05 double `requireUser`, F-07 settings audit-on-denial; F-03 structured logger (PG12); CSP per-request nonce; consolidate `ProductStatusCard` tone map onto `@wtc/cabinet`; backtester **option (a)** when green-lit (DB wave → routes/tokens/storage/runner → flip the flag).

---

**Phase 2.12 / PG9 (User cabinet + product UX) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG9 (per-product cabinet cards + mobile-first setup wizard):** `/app` now renders enriched **`ProductCabinetCard`s** (entitlement /
**setup** / **activity** / **next-action** / **blockers**, fail-closed) driven by a new **pure `@wtc/cabinet` package**
(`deriveProductCard` + `ACCESS_REASON_COPY`, **26 unit tests** incl. 5 fail-closed invariants — real coverage). A server-only
`features/cabinet/loader.ts` gathers per-product signals **only when `access.allowed`** (data-minimisation) and calls the pure
deriver; the presentational `CabinetProductCard` lives in `features/cabinet` (avoids a `@wtc/ui→@wtc/cabinet` cycle). New
mobile-first **setup wizard** `/app/bots/[bot]/setup?step=` (3 steps; 2 CSRF-first fail-closed actions; `.wtc-wizard-steps`/
`.wtc-step` CSS §15). Folded-in security fixes: **F-01** (indicators page now gates `loadTvUserData` on `access.allowed`),
**F-02** (security `addKeyAction` CSRF-first), **F-04** (Tortila notices per-card + entitlement-gated). The 375px e2e caught a
real shell overflow → fixed at the source (`.wtc-shell` grid `minmax(0,1fr)` + `min-width:0`; hardens every app page). **No
migration** (41 tables). Aggregate:
[`docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md`](handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md)
(cites 4 per-agent audit handoffs at epoch `20260531-0005`). Gates green (test 482/8/490, e2e 39 passed/3 skipped/0 flaky, build
34 routes + `ƒ Middleware 35.2 kB`, coverage 26.49/75.33, **41 tables**). **Next phase group (its own session): PG10**
(Backtester — needs the operator decision real-runner vs locked card), then **Phase-3 LMS rich** + **PG12 CI/deploy**. Ordering:
`EXECUTION_PLAN_MASTER.md`. Carried: F-03 backtester gate ordering, F-05 double `requireUser`, F-07 settings audit-on-denial;
F-03 structured logger (PG12); CSP per-request nonce; a real-PG e2e for populated cabinet signals; consolidate the legacy
`ProductStatusCard` tone map onto `@wtc/cabinet`. ADR-019 records the cabinet architecture.

---

**Phase 2.11 / PG8 (Admin console — mobile-readable cards + honest state pills) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG8 (Admin console):** `.wtc-table` had zero responsive handling — the **10-column TradingView queue** + ~6 other admin tables
overflowed at 375px. New **CSS-only `data-label` card-stack** `.wtc-table-wrap` (`packages/ui/src/theme.css`; DESIGN_SYSTEM §14)
turns each row into a labelled card below 640px (no horizontal page scroll regardless of column count; `.wtc-td-action` keeps the
inline grant/revoke forms full-width; `overflow-wrap:anywhere` wraps long mono ids). The admin layout now renders
`<MobileNav items={ADMIN_NAV} />` (it had **no mobile nav** — sidenav `display:none` below 900px). Honest pills consume the real
state: a **derived PG2 read-state pill** on `/admin/bots` (from persisted health checks — no live probe), a **PG5 expiring-soon
`RiskWarningBanner`** on the TV queue, a DB-backed `/admin` overview (`loadAdminOverview`, demo→0) + per-page `requireUser`+
`assertAdmin` on overview/audit-log, and an `eventSnapshot` `{id,type,planCode}` allowlist. The education page moved to canonical
RBAC + a `<div className="wtc-stack">` root (no nested `<main>`). **Also fixed an inherited PG7 red gate:** `npm run typecheck`
was exit 2 (5 `noUncheckedIndexedAccess` errors in PG7 test files) — now exit 0. **No migration** (41 tables). Tests:
`admin-responsive.test.ts` (35 static) + `admin-mobile-pg8.spec.ts` (375px e2e). Aggregate:
[`docs/handoffs/20260530-2345-phase-2-11-admin-console-mobile-cards.md`](handoffs/20260530-2345-phase-2-11-admin-console-mobile-cards.md)
(cites 4 per-agent audit handoffs at epoch `20260530-2345`). Gates green (test 441/8/449, e2e 36 passed/1 flaky-green/1 skipped, build `ƒ Middleware 35.2 kB`,
coverage 26.83/74.32, **41 tables**). **Next phase group (its own session): PG9** (User cabinet — per-product cards
entitlement/setup/activity/next-action/blockers + mobile-first setup wizards), then **Phase-3 LMS rich**. Ordering:
`EXECUTION_PLAN_MASTER.md`. Carried: F-03 structured logger (PG12); CSP per-request nonce; a real-PG e2e pass to exercise
populated admin tables (demo renders EmptyState for DB-backed pages). ADR-018 records the responsive convention.

---

**Phase 2.10 / PG7 (LMS authorization hardening) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG7 (LMS RBAC/ownership/entitlement denial → audit + throw; CSRF-first):** the 10 LMS server actions previously **silently
`return`ed** on authz denial (no audit trace). New `apps/web/src/features/lms/guard.ts` exposes
`requireTeacher`/`requireAdmin`/`requireCourseOwnership`/`requireEducationAccess` — each **writes one audit row
(`result:'failure'`, `after:{reason,attempted}`) then throws `AppError`** (`forbidden`/`entitlement_denied`). Two new audit
codes `education.rbac_denied` + `education.entitlement_denied` (`AuditResult` unchanged). Every action now calls
`assertCsrf(formData)` **first** (before `requireUser`); Zod/not-found/demo stay graceful. The rich LMS migration 0005 was
**unanimously deferred to Phase-3** (no consumer this phase; embed_html needs a sanitizer; file-meta BLOCKED on upload review;
`pinned_links 'global'` is non-additive). **No migration** (41 tables). Tests are static (vitest excludes `apps/web/**`):
`lms-rbac-pipeline.test.ts` (8) + `audit.test.ts` (4). Aggregate:
[`docs/handoffs/20260530-2330-phase-2-10-lms-rbac-throw-csrf-first.md`](handoffs/20260530-2330-phase-2-10-lms-rbac-throw-csrf-first.md)
(cites 5 per-agent audit handoffs at epoch `20260530-2330`). Gates green (test 406/8/414, e2e 36/36, build `ƒ Middleware 35.2 kB`,
coverage 27.12/74.32, **41 tables**). **Next phase groups (each its own session): PG8** (Admin console mobile cards + honest
state pills consuming PG2/PG5 real state), then **Phase-3 LMS rich** (migration 0005 co-landed with its consumers + the
pinned-link/teacher-profile web surfaces). Ordering: `EXECUTION_PLAN_MASTER.md`. Carried: F-03 structured logger (PG12); CSP
per-request nonce; ADR-017 denial-audit convention recorded; rich-migration DDL spec in `EDUCATION_LMS_PLAN.md`.

---

**Phase 2.9 / PG6 (Axioma non-blocked surface) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG6 (Axioma ES256 wiring + jti replay store):** migration **0004** adds `axioma_handoff_jti_revocations` (one additive table;
40→**41**; `jti uuid PK`, `sub uuid` **no-FK**, used/revoked/expires + 2 indexes). Pure repos `recordHandoffJti` /
`consumeHandoffJti` (atomic conditional UPDATE, TOCTOU-free; categorized failure reason) / `revokeHandoffJtisByUser` /
`purgeExpiredHandoffJtis` (worker `dbTick` purges after `sweepTvExpiry`). `createEs256Signer` is **wired into the bridge behind a
staging+prod fence**: new pure `resolveHandoffSigner` + `createAxiomaBridge` (injected `HandoffSigner`); `env.ts` gains `APP_ENV`
+ `AXIOMA_HANDOFF_SIGNING_KEY`/`_KEY_ID` + a staging/prod superRefine. `@wtc/axioma-bridge` stays zero-dep/pure. **CTAs stay
disabled (B4); hard boundary preserved.** 3 jti audit codes pre-registered for the future B4 routes. **B4 open:** P-256 key
(OP) + endpoint shapes (EXT) ⇒ ES256 activation + web resolver + Open-Journal/consume/Download routes + `account_links` OTC→hash
(0005) stay NOT RUN/TARGET. Aggregate:
[`docs/handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md`](handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md)
(cites 5 per-agent audit handoffs at epoch `20260530-2230`). Gates green (test 394/8/402, e2e 36/36, build `ƒ Middleware 35.2 kB`,
coverage 27.2/74.32, **41 tables**). **Next phase groups (each its own session): PG7** (LMS rich migration if bounded + LMS
RBAC-throw + CSRF-first), **PG8** (Admin console mobile cards + honest state pills). Ordering: `EXECUTION_PLAN_MASTER.md`.
Deferred/carried: F-03 structured logger (PG12); CSP per-request nonce; move static headers to `next.config.ts`; **F-07**
(deprecate the HS256-secret prod requirement once `APP_ENV` is the deploy axis); the spec audit-code dot→underscore
reconciliation; Q-14 SECRET_HINTS coordination. When B4 clears: build the web signer resolver + the Open-Journal/consume/Download
routes (route-level in-txn jti audit) + the `account_links` OTC→`link_nonce_hash` migration, then enable the CTAs.

---

**Phase 2.8 / PG3 + PG4(unblocked) + PG5-follow-up (prior session) is landed & gate-verified** — the operator's continuous phase-group program continues.
**PG3 (Legacy hard gate, B3 in-repo gate):** the real legacy HTTP adapter (`createHttpLegacyAdapter`, which probed the
plaintext-key `/api_management/`) is **DELETED**; the factory routes legacy non-mock modes to **`createLegacyBlockedAdapter`**
(no network; data methods throw `LegacyAdapterBlockedError(blockerRef='B3')`; `getHealth()` deterministic blocked state). A
**Zod exclusion** `LegacyApiSafeBodySchema` strips any SECRET_HINTS field from a `/api_management/` body (WTC-side B3
deliverable). Dashboards show an honest **"Live adapter unavailable — blocked (B3)"** banner (`BOT_CAPS.liveAdapterBlocked`).
The **real adapter stays BLOCKED** on the upstream plaintext-key fix + the 5 BOT_CONTROL_SAFETY_MODEL gates (EXT). **PG5
follow-up:** `markExpiringSoon` pre-pass writes the 7-day `expiring_soon` status (worker runs it before `sweepTvExpiry`), and
**`sweepTvExpiry` was widened to `status IN ('granted','expiring_soon')`** (critical co-land — else expiring_soon rows would
never be revoked). **PG4 (Billing, UNBLOCKED only):** Q-2 OPEN + no Stripe test keys ⇒ **B2 (test-mode checkout) NOT RUN**;
delivered the no-dead-code scaffold — pure `checkoutAvailability()` in `@wtc/billing` (no `available:true` branch yet),
`features/billing/{plans.ts,checkout.ts}`, and an honest pricing CTA ("Self-serve checkout unavailable" + "Contact support").
**No migration** (40 tables). Aggregate:
[`docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md`](handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md)
(cites 5 per-agent audit handoffs at epoch `20260530-2100`). Gates green (test 370/7/377, e2e 36/36, build 44 routes +
`ƒ Middleware 35.2 kB`, coverage 26.21/73.49). `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter deleted +
factory-blocked; live control stays BLOCKED; real-PG **run** still NOT RUN (needs a throwaway `wtc_test` `DATABASE_URL`); B2
checkout NOT RUN (needs Q-2 decision + Stripe test keys).
**Next phase groups (each its own session): PG6** (Axioma non-blocked surface — ES256 wire behind a staging fence +
`axioma_handoff_jti_revocations` + `consumeJti`; CTAs stay disabled, B4), **PG7** (LMS rich migration if bounded + LMS
RBAC-throw + CSRF-first), **PG8** (Admin console mobile cards + honest state pills). Ordering: `EXECUTION_PLAN_MASTER.md`.
Deferred: F-03 structured logger (PG12), CSP per-request nonce, move static headers to `next.config.ts`, Q-14 SECRET_HINTS
coordination. When B2 unblocks (Q-2 + Stripe test keys): wire `createCheckout` + the `available:true` branch in
`@wtc/billing` checkoutAvailability + `checkout.ts` + a pending_payment→active integration test.

---

Phase 2.4 is **landed & gate-verified**: a **12-auditor read-only fan-out → DB-foundation (migration 0003) → serial consumer
implementation** (18 per-agent handoffs at epoch 20260530-1355) delivering five areas — real read-only **Tortila journal
adapter** (Zod + 11 fixtures + getMetrics/getPositions/getTrades/getEquityCurve + 35 fixture-only tests; control disabled,
legacy BLOCKED); **billing** durable `billing_webhook_events` idempotency + fail-closed `manual_review` queue (never
auto-grant); **TV atomicity** (`atomicGrantTv`/`atomicRevokeTv`, reason persisted); **admin ops** (N+1 fix +
`/admin/entitlements/review` + real `/admin/bots`); **docs truth** + real-PG honestly NOT RUN. Gates green (test 238/5,
e2e 34/34, build 53 routes, coverage 24.94/70.77, 40 tables). See `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` and `docs/STATUS.md`.
Prior: Phase 2.3 `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md`; Phase 2.2 `docs/handoffs/20260530-1042-phase-2-2-full-lms-service-wiring.md`.
NOT production-deployable yet. Nothing touches live servers without explicit approval.
**Each new phase = a new session** (`docs/SESSION_PROTOCOL.md`).

## Next phases (each its own session)
- **Phase 2.5 — real-PG acceptance + Axioma bridge:** provision a throwaway `wtc_test` DB → run `db:migrate`/`db:seed`/real-PG harness (incl. migration 0003 + the `insertWebhookEventOnce` concurrent-duplicate under the real unique index; DB-name guard `wtc_test`/`wtc_test_*`); `sweepTvExpiry`→`atomicRevokeTv`; surface `revokeReason` in the TV UI; `listUsersWithEmailByIds` (kill the TV-admin N+1); Axioma ES256 signer + JWKS consume + download proxy + OTC account-link (needs the raw-OTC→hash migration). Keeps the hard boundary (WTC never gates local order execution).
- **Phase 3 — LMS migration `0003`-rich** (slug/level/tags/content_type/embed/file-meta/global-pinned/progress state-machine) + the rich LMS UI; **Stripe checkout** (test-mode `STRIPE_SECRET_KEY` + price map) behind a flag — no live charge path.
- **Ops:** auth rate-limiting middleware; CI activation once git + a remote exist; legacy bot adapter stays BLOCKED until the plaintext-key/service-account gates are cleared.

## Phase 2.1 DONE (this session) — the data/crypto spine + 2 surfaces
- Migration `0002` (18 tables + 1 ALTER + backfill + CHECK), generated + PGlite-tested (19 new integration cases).
- ~40 `@wtc/db` repos (bots/education/TV/products/terminal/ops/billing) with in-txn audit; `product_access_events`
  wired into grant/revoke; `addExchangeKey` audit + `revokeTv` revoke-metadata debts cleared.
- `@wtc/billing` real Stripe webhook adapter (+8 tests); `@wtc/axioma-bridge` ES256/JWKS (+7 tests) + JWKS route.
- Security: Phase-2.1 AUDIT_ACTIONS, redact SECRET_HINTS, RBAC resources.
- Surfaces: `/app/bots/[bot]/settings` (real config + versions + safety) and `/app/support` (tickets + notifications),
  via `getServerDb()` (real Postgres when `DATABASE_URL` set; honest labelled demo otherwise).

## Phase 2.1 STAGED (Rule 7 — designed + repo-backed; build next, in order)
The DB layer + repos already exist; these are mostly UI + service wiring. Follow the serial spine in
`docs/handoffs/20260530-0126-ecosystem-platform-architect.md` (shared files single-writer).
1. **Full LMS (S-4 + P-A)** — `packages/lms` 22-method contract + full `db-store.ts`/`demo.ts` selectors + teacher/
   student/admin routes on the `enrollments`/`lesson_progress`/`teacher_profiles`/`pinned_links` repos.
   Spec: `docs/handoffs/20260530-0925-ecosystem-education-implementer.md`.
2. **Billing UI + webhook route (P-B)** — `/pricing` + `/app/billing` + `POST /api/billing/webhook` (verify-first via
   `createStripeProvider`) + `product_access_events` timeline.
3. **TV grants/profiles UI (P-E)** + **admin panels (P-F admin)** + **terminal DB-wiring (P-D)** on the landed repos.
4. Throughout: the per-mutation pipelines in `docs/handoffs/20260530-0925-ecosystem-security-auditor.md`.

## Run / verify it now

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
npm ci                            # reproducible install (368 pkgs)
npm run ci:local                  # check:core + lint + typecheck(x2) + secret:scan + test + build
# …or the individual gates:
npm run check:core               # zero-install security/correctness smokes
npm run lint                     # ESLint 9 flat config
npm run typecheck                # tsc --noEmit (packages)
npm run typecheck -w @wtc/web    # app types
npm test                         # Vitest suite — see docs/STATUS.md for current pass/skip counts (incl. PGlite DB integration)
npm run secret:scan              # secretlint
npm run db:generate -w @wtc/db   # regenerate migrations (no DB needed; 4 migrations, 40 tables as of 0003)
npm run coverage                 # coverage baseline — see docs/STATUS.md for current % (statements/branch)
npm run build -w @wtc/web        # Next build
npx playwright install chromium  # one-time — REQUIRED before e2e (already installed on this host)
npm run e2e                      # Playwright (16) desktop + mobile
npm run dev                      # http://localhost:3000  (login user@wtc.local / <demo-password>, in-memory)
```

## Real Postgres DB gate (B1 — still NOT run; needs throwaway credentials)
The target server currently has PostgreSQL available on `127.0.0.1:5432` (observed PG16 on the preview host), but the WTC real-PG harness has not been run. To clear B1, use a fresh `wtc_test` / `wtc_test_*` throwaway database and run only the opt-in harness:

```powershell
$env:REAL_POSTGRES_DATABASE_URL = "postgres://...@127.0.0.1:5432/wtc_test_accept_YYYYMMDDHHMMSS"
$env:DATABASE_URL = $env:REAL_POSTGRES_DATABASE_URL
npm test -- tests/integration/db-real-postgres.test.ts
```

## Remaining (each = its own session, in order)

1. **Full LMS — SUPERSEDED.** The LMS DB layer (`teacher_profiles`/`enrollments`/`lesson_progress`/`pinned_links` +
   repos + in-txn audit) **landed in Phase 2.1** (migration `0002`). The full teacher/student/admin LMS UI on top of
   it is **Phase 2.2** (the current/just-completed session — see the Phase-2.2 aggregate handoff). The old
   "Phase 1.8" label and `EDUCATION_LMS_PLAN.md` §20 prompt are obsolete.
2. **Real Postgres in CI / locally**: run the opt-in harness above against a throwaway Postgres DB; do not point it at any live app database.
3. **Billing:** choose a provider (`docs/OPEN_QUESTIONS.md` #2); implement the Stripe adapter behind
   `@wtc/billing`'s `BillingProvider`; wire the signature-verified webhook route → entitlements.
4. **Axioma:** confirm `journal_server` endpoint shapes; implement the **ES256/JWKS** handoff signer
   (HS256 now throws in production) per `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`; build consume/jti-revocation.
5. **Bot adapters:** confirm Tortila journal + legacy `/api_management` JSON shapes, then implement the real
   read-only mappings (currently `AdapterNotReadyError`). Require the legacy plaintext-key fix upstream.
   Keep control disabled until audited. Add graceful `AdapterNotReadyError` handling before enabling read-only.
6. **Auth hardening:** IP-keyed middleware on `POST /login` and `POST /register` is implemented and has deterministic
   middleware integration 429 coverage. DB-backed account-specific login lockout for `/login` and admin account unlock are
   implemented locally with PGlite coverage and opt-in real-Postgres race tests. Registration audit landed locally in
   Phase 3.45. Remaining auth hardening: run the real-Postgres lockout/unlock race gate with
   `REAL_POSTGRES_DATABASE_URL`, prove production nginx/shared-store rate limiting, and add append-only `audit_logs` DB role.
7. **CI activation:** once this becomes a git repo with a GitHub remote, `.github/workflows/ci.yml` runs as-is.

## Phase 1.6 follow-ups (new this phase; deferred, each low-risk)

- **Boot-time `loadEnv()`** — **DONE in Phase 1.6.1** via `apps/web/instrumentation.ts` (`register()` calls
  `loadEnv()` under `NEXT_RUNTIME==='nodejs'`), so the base64-32 `SECRET_VAULT_KEK` config check runs at
  server boot. The lazy `getVault()` (`apps/web/src/lib/vault.ts` → `parseKek`, 32-byte-strict) is retained
  as the fail-closed backstop.
- **Real-Postgres `grantProduct` concurrency test** — **harness exists** (`tests/integration/db-real-postgres.test.ts`
  includes a true cross-connection concurrent `grantProduct` case); it is **skipped** without
  `REAL_POSTGRES_DATABASE_URL`. Only running it against a fresh throwaway real-Postgres DB remains.
- **TradingView-access contract structure drift**: `CONTRACTS/tradingview-access.md` + `TRADINGVIEW_ACCESS_PLAN.md`
  describe a multi-file package (`service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts`) that does
  not match the actual single `packages/tradingview-access/src/index.ts` memory service — reconcile when Part E lands.

## Do NOT
- Do not touch live bot services or exchange state. The safe WTC preview may be checked/restarted separately only when explicitly approved and with `BOT_ADAPTER_MODE=mock` / live controls off.
- Do not collapse into a one-file prototype. Keep business logic in `packages/*`.
- Do not run two phases in one session, and do not claim an "N-agent audit" without N per-agent handoffs
  (`docs/SESSION_PROTOCOL.md` §2–§3).
