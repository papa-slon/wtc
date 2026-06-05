# STATUS

_Latest update: 2026-06-06 - Phase 4.69 Tortila canonical source verifier._
Phase 4.69 adds a strict WTC-side canonical Tortila source verifier after the canary deploy. The new
`npm run verify:tortila:canonical-source` command refuses non-git adjacent/runtime source folders and requires a clean
git repo root, full HEAD, named branch, at least one remote name, `pyproject.toml`, `src/turtle_bot/journal/app.py`,
`tests/test_journal.py`, `JOURNAL_READ_TOKEN` middleware, bearer/header token parsing, `/api/*` 401 guard, and auth tests.
`accept:tortila:real-read:managed` can now run in strict mode with `TORTILA_CANONICAL_SOURCE_REQUIRED=1` so it checks only
the explicit `TORTILA_REAL_READ_SOURCE_ROOT` instead of falling back to adjacent `../bot_tortila`. The full local Vitest
gate is green (`135` files, `1138` passed, `10` skipped), and the current adjacent `bot_tortila` source correctly fails
the verifier because it is not git-backed. Server
read-only audits also confirmed Legacy still has no durable closed-trade source and Tortila runtime source still lacks the
token middleware. Aggregate:
[`docs/handoffs/20260606-0440-phase-469-tortila-canonical-source-verifier.md`](handoffs/20260606-0440-phase-469-tortila-canonical-source-verifier.md).
This improves the source gate tooling; it does not clear canonical Tortila source, production token deployment, firewall
probes, Legacy realized closed-trade source/import, live-control audit, or full branded production.

_Previous server update: 2026-06-06 - Phase 4.68 canary deploy to `3aff273`._
Phase 4.68 deploys PR #8's shared bot instrument picker release to the existing WTC HTTPS canary. PR #8 merged to `main`
at `3aff2738815562c18f5623e9686c4c2f4ba2ef3a`; PR checks and post-merge `main` CI run `27038370453` both passed
`gates` and `e2e`. Current server release:
`/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker`, mounted into
`wtc-ecosystem-canary` and `wtc-ecosystem-worker`. Server build passed in `node:22-bookworm`; `db:migrate` passed with no
new migration beyond the prior `0021` state. Public `<wtc-canary-host>` smoke is green: `/api/health`, `/`, `/login`, and
`/products` returned `200`, while protected bot/admin routes redirected to login. Short burn-in was green across three
one-minute cycles: WTC health `200`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`, bot PIDs unchanged,
`NRestarts=0`, and recent warning count `0`. Aggregate:
[`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`](handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md).
This clears the current WTC canary deploy for `3aff273`; it still does not clear full branded production, canonical
Tortila source, Legacy realized closed-trade source/import, live-control audit, or external provider credential gates.

_Previous local update: 2026-06-06 - Phase 4.67 bot settings catalog/admin polish._
Phase 4.67 is a local UI/product correctness pass after the server canary update. It launches three read-only auditors,
then adds a shared `@wtc/shared` instrument catalog plus a reusable web `InstrumentPicker` so Legacy and Tortila settings
use one canonical symbol source with runtime-symbol fallback instead of duplicated hardcoded UI lists. Admin Tortila system
defaults now render portfolio caps only once through the Tortila strategy table, preventing duplicate `name=` fields from
shadowing admin edits. The setup wizard completion marker is ASCII `OK` to avoid glyph/mojibake drift in Windows/server
rendering. Verification is green: shared catalog Vitest, root typecheck, web typecheck, lint, governance, secret scan, web
production build, focused bot settings/setup/admin Playwright, and final `npm run accept:bots:rendered` (`bot-admin-e2e`
65 passed plus visual inventory). Aggregate:
[`docs/handoffs/20260606-0240-phase-467-bot-settings-catalog-admin-polish.md`](handoffs/20260606-0240-phase-467-bot-settings-catalog-admin-polish.md).
This phase does not deploy, restart bots, run live controls, test exchange keys, clear Legacy closed-trade source proof, or
canonicalize Tortila source.

_Previous server update: 2026-06-06 - Phase 4.66 server canary update to `72f21d5`._
Phase 4.66 uses the operator-approved SSH target to deploy the current GitHub `main` commit
`72f21d5a735ba5ce3a1b6e112cebf70742b72b62` to the WTC HTTPS canary without restarting live bot services.
New server release:
`/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-180016-72f21d5-phase465-main`, mounted into
`wtc-ecosystem-canary` and `wtc-ecosystem-worker`. Pre-migration DB backup:
`/home/ubuntu/apps/wtc_ecosystem_platform_releases/_db_backups/20260605-180016-wtc_platform_canary_20260602_1412-pre-72f21d5.dump`.
Server build passed in `node:22-bookworm`; WTC DB migrations advanced from Drizzle id `17` to `22`; public
`https://<wtc-canary-host>/api/health` now returns `200`. Post-switch monitoring showed
`journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` still `active/running` with unchanged PIDs
and `NRestarts=0`; the new worker logged `tortila-snapshot ok`, `legacy-snapshot ok`, `bot_continuity ok`, and WTC DB
health rows for `worker`, `tortila-journal`, and `legacy-bot` were `ok` at `2026-06-05 18:03:10 UTC`. Aggregate:
[`docs/handoffs/20260606-0104-phase-466-server-canary-update.md`](handoffs/20260606-0104-phase-466-server-canary-update.md).
This clears the current WTC canary deploy for `72f21d5`, not full production/live-control completion.
The current WTC-side Legacy/Tortila bot workbench is substantially built locally: settings/setup quick paths, symbol/stage
configuration, safe config export/review, metadata-only exchange-key readiness, launch-readiness maps, warning summaries,
admin fleet views, selected-user read-only drilldowns, provider-scoped Legacy runtime evidence, Tortila statistics, Legacy
operational statistics, worker-continuity gating surfaces, the `/app/bots` two-bot finish board, DB worker interval
serialization, provider-aware trade-import idempotency, and safe Legacy source-proof visibility on user and selected-user
admin surfaces. Phase 4.51 adds Tortila journal/source-confidence clarity and an explicit anti-loop verdict; Phase 4.52
resolves the Tortila `/api/marks` contract contradiction; Phase 4.53 hardens Tortila Mark/uPnL unavailable display across
user/admin surfaces; Phase 4.54 adds the opt-in managed DB browser lane for current-user Tortila route proof; Phase 4.55
confirms no non-looping local implementation lane remains while managed/source/deploy env gates are absent; Phase 4.56
confirms the strict blocked threshold is met with the same inputs still absent; Phase 4.57 uses an approved isolated local
disposable Postgres lane to run the previously blocked managed DB gates; Phase 4.58 proves a WTC read-only Tortila journal
source path through the worker with `/api/marks` blocked; Phase 4.59 adds a local Tortila journal read-token boundary and
proves WTC can read through it without widening the endpoint allowlist; Phase 4.60 hardens production-like configuration,
worker token-failure behavior, Tortila contract truth, CI env validation, and non-secret web liveness; Phase 4.61 merges
the exact Phase 4.60 tree through PR #1, observes green PR and post-merge `main` GitHub Actions, and updates CI truth;
Phase 4.62 proves the remaining production/source gates need external target/source packets, not another local UI/static
loop; Phase 4.63 updates the active GitHub Actions workflow to Node 24-runtime action majors after GitHub's deprecation
warning surfaced on the green `main` runs; Phase 4.64 records the PR and post-merge `main` GitHub proof for that exact
workflow migration; Phase 4.65 protects `main` with an active GitHub repository ruleset requiring WTC's Actions checks.
This is still **not final production completion** and not a live-control release.

Phase 4.65 closes the repo-level CI enforcement gap found after the Node 24 Actions proof. `main` was previously
unprotected (`protected=false`, no branch protection, no rulesets). A GitHub repository ruleset now protects
`refs/heads/main`: `WTC main required CI`, ID `17324564`, enforcement `active`, no bypass actors, strict required status
checks `gates` and `e2e` pinned to GitHub Actions integration `15368`, plus `non_fast_forward` and `deletion` rules.
Verification observed `main protected=true`, `gh ruleset check main` reporting exactly those three rules, and the latest
Checks API still green for `gates` and `e2e`. Legacy commit statuses remain empty/`pending` and are not the CI source of
truth. The two read-only ruleset audits were closed after handoff collection. Aggregate:
[`docs/handoffs/20260605-2304-phase-465-main-required-ci-ruleset.md`](handoffs/20260605-2304-phase-465-main-required-ci-ruleset.md).

Phase 4.64 closes the CI-truth follow-up for the Node 24 action-runtime migration. PR #4 merged to `main` at
`787443d8ca040cf94d001f79d1a28bbdc0d84bd3` after green PR CI run `27022463493` (`gates=success`, `e2e=success`).
The post-merge `main` push CI run `27023047118` is also green (`gates=success`, `e2e=success`) and its job view shows
`actions/checkout@v6` and `actions/setup-node@v6` running in both jobs plus the reviewed visual evidence artifact upload
step passing. One read-only CI-truth auditor was closed after handoff collection. Aggregate:
[`docs/handoffs/20260605-2221-phase-464-node24-ci-truth.md`](handoffs/20260605-2221-phase-464-node24-ci-truth.md).

Phase 4.63 addresses the GitHub Actions Node.js 20 deprecation warning observed on the post-merge `main` CI runs. The
project Node was already set to `24`, but the JavaScript action runtime was still provided by `actions/checkout@v4`,
`actions/setup-node@v4`, and `actions/upload-artifact@v4`. The active workflow now uses `actions/checkout@v6`,
`actions/setup-node@v6`, and `actions/upload-artifact@v7`, matching current official action README examples and avoiding
the June 16, 2026 forced Node 24 transition as an untested surprise. One read-only CI-runtime auditor was closed after
handoff collection. Aggregate:
[`docs/handoffs/20260605-2147-phase-463-node24-actions.md`](handoffs/20260605-2147-phase-463-node24-actions.md).

Phase 4.62 maps the remaining non-looping blockers with three read-only source/deploy auditors. Production deploy cannot
proceed from local repo evidence alone: the current target packet is missing target host/domain/canary URL, exact release
SHA, rollback target, DB migration/seed approval, secret provisioning method, service boundaries, firewall/proxy probe
plan, smoke routes, and monitoring/burn-in plan. Canonical Tortila source landing is still not complete: the
`JOURNAL_READ_TOKEN` patch exists in adjacent `C:\Users\maxib\GTE BOT\bot_tortila`, but that folder is not git-backed and
no canonical git-backed Tortila repo/source bundle was found locally. Legacy realized analytics/import remains blocked:
WTC has the destination contract, but local Legacy-like sources expose active orders/slots/settings and no durable
closed-trade table/API with stable trade id, provider/pub_id scope, economics, timestamps, replay semantics, and raw
payload allowlist. All Phase 4.62 agents were closed. Aggregate:
[`docs/handoffs/20260605-2112-phase-462-production-source-input-map.md`](handoffs/20260605-2112-phase-462-production-source-input-map.md).

Phase 4.61 closes the GitHub release/CI proof gap for the Phase 4.60 tree without deploying production or enabling live
controls. PR #1 is merged at `ed31aaaf89ebc4920a13887542fa3bb0bbd99545` after green pre-merge PR CI run
`27015532545` (`gates=success`, `e2e=success`). The post-merge `main` push CI run `27016644974` is also green:
`gates` completed successfully at `2026-06-05T13:12:09Z`, and `e2e` completed successfully at
`2026-06-05T13:16:15Z`. Three Phase 4.61 read-only agents checked release/merge/deploy boundaries, production
boundaries, and CI/PR state; all were closed. GitHub Actions for the merged tree are now RUN/PASS, but production deploy,
production DB migration/seed, canary switch, nginx/TLS/firewall checks, production Tortila journal secret/firewall probes,
canonical Tortila source landing, Legacy closed-trade source/import proof, live-control audit, and monitoring/burn-in
remain NOT RUN. Aggregate:
[`docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md`](handoffs/20260605-2018-phase-461-main-merge-ci-truth.md).

Phase 4.60 closes the locally completable production-readiness gaps found by four read-only auditors. Production-like
non-mock adapter mode now requires both `JOURNAL_READ_TOKEN` and an explicit `TORTILA_JOURNAL_URL`, so staging/production
cannot silently rely on the loopback default. CI now validates a production-like `BOT_ADAPTER_MODE=read-only` env with
ephemeral token and explicit journal URL. The worker has explicit wrong-token `401` fail-closed coverage proving no metric,
position, or trade import and no token leakage. The Tortila contract now distinguishes local adjacent source token proof
from still-unproven canonical-source landing and production firewall/deploy proof, and keeps `/api/overview` and
`/api/marks` out of WTC ingestion. The web app now exposes `GET`/`HEAD /api/health` as a no-store, non-secret liveness
route that returns only `{ ok: true, status: "ok", service: "wtc-web" }`; detailed DB/worker/bot evidence remains on
authenticated admin and persisted health surfaces. Focused local proof is green: config env Vitest PASS, worker Tortila
snapshot Vitest PASS, Tortila managed-runner static Vitest PASS, bot-adapter Vitest PASS, manual positive/negative
production-like env probes PASS, web health route Vitest PASS, and focused Phase 4.60 pack PASS (`92` tests). Broader
local release proof is now green: web/worker/root typecheck PASS, web production build PASS, lint PASS, secret scan PASS,
governance PASS, `git diff --check` PASS, `npm run ci:local` completed through check/core, governance, lint, typecheck,
secret scan, root Vitest (`133` files, `1134` passed, `10` skipped), and web build; `npm run accept:bots:local` PASS
(`5` gates, `0` failing, rendered bot/admin E2E `65` passed, visual inventory `117` images); and
`npm run accept:tortila:real-read:managed` PASS against a disposable local Postgres lane with `missingToken=401`,
`wrongToken=401`, `bearerAllowedEndpoints=4`, `tokenHeader=ok`, `sourceAdapter=tortila`, `readState=ok`,
`tradesImported=2`, `positionsSnapshotted=1`, and `marksRequests=0`. GitHub Actions for the committed exact tree are
closed in Phase 4.61; production deploy, canonical Tortila repo landing, production firewall/authorized probes, Legacy
closed-trade source, live-control audit, and monitoring/burn-in remain NOT RUN. Aggregate:
[`docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`](handoffs/20260605-1810-phase-460-production-readiness-hardening.md).

Phase 4.59 hardens the local Tortila journal proof boundary. The adjacent non-git-backed `../bot_tortila` checkout now
protects `/api/*` with `JOURNAL_READ_TOKEN` when configured, accepting `Authorization: Bearer ...` or
`x-journal-read-token` and returning a normal 401 JSON response for missing/wrong tokens. The WTC managed runner now starts
that journal with a proof token, verifies an explicit auth matrix (`missingToken=401`, `wrongToken=401`, bearer passes for
`/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, token header passes for `/api/summary`), clears
preflight request logs, then runs the worker proof and still verifies `sourceAdapter=tortila`, `readState=ok`,
`tradesImported=2`, `positionsSnapshotted=1`, `marksRequests=0`, and no `/api/overview` request. Fresh proof is green:
Tortila journal pytest PASS (`31` tests), runner static Vitest PASS, Tortila real-read managed PASS, focused safety Vitest
PASS (`44` tests), worker/root typecheck PASS, lint PASS, secret scan PASS, governance PASS, and `git diff --check` PASS.
Production auth/firewall rollout, authorized network probes, deploy/CI, monitoring, live-control audit, and Legacy source
import remain separate NOT RUN gates. Aggregate:
[`docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`](handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md).

Phase 4.58 adds the next non-looping source proof after managed DB proof. The new opt-in
`npm run accept:tortila:real-read:managed` runner creates a temporary Tortila SQLite journal fixture, starts the local
Tortila journal behind an allowlist proxy, runs the WTC worker in `BOT_ADAPTER_MODE=read-only`, and verifies persisted WTC
evidence: `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, and `marksRequests=0`.
Focused proof is green: runner static/preflight Vitest PASS, Tortila real-read managed PASS, focused safety Vitest PASS
(`44` tests), worker/root typecheck PASS, lint PASS, secret scan PASS, governance PASS, and `git diff --check` PASS. The
Legacy deep source auditor found no valid Legacy closed-trade source candidate, so Legacy import remains blocked by source
proof, not local implementation. Aggregate:
[`docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`](handoffs/20260605-1600-phase-458-tortila-real-read-proof.md).

Phase 4.57 clears the local managed DB proof blocker. Three read-only agent handoffs were present before implementation
continued. The operator-approved disposable local Postgres lane let the managed runners create/drop only `wtc_test_*`
databases. Fresh proof is green: focused Vitest PASS (`18` tests across admin DB harness, worker continuity runner, and
admin static coverage), `npm run e2e:admin-user-bots:db:managed:user-routes` PASS (`2` desktop/mobile tests),
`npm run e2e:admin-user-bots:db:managed:matrix` PASS (`8` desktop/mobile tests across degraded-readable, fresh-green,
stale, and missing scenarios), `npm run accept:worker:continuity:managed` PASS (`worker_status=ok`,
`bot_continuity=ok`, `tortila=ok`, `legacy=ok`), root/web/worker typecheck PASS, lint PASS, web production build PASS,
secret scan PASS, artifact marker scan PASS, governance PASS, and `git diff --check` PASS. The phase also fixed fresh
verification defects: valid Tortila DB fixture config, stale static assertions, strict heading/form guards, mobile table
overflow, admin recent-trade source visibility, and worker continuity SQL ordering on the real `created_at` column.
Aggregate:
[`docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`](handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md).

Phase 4.56 is a read-only blocked-threshold confirmation. Three read-only agents were launched before docs edits and all
converged on the same verdict: no safe, non-looping local Legacy/Tortila implementation lane remains without a managed DB,
source, or deploy input. Fresh env presence check again showed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`,
`WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, `LEGACY_SOURCE_ARTIFACT`, and
`DATABASE_URL` all `NOT_SET`. Fresh managed preflights again refused before DB work when the admin DB env vars were missing.
Phase 4.56 therefore marks the active goal blocked by external inputs after the same managed/source/deploy blocker repeated
for the third consecutive goal turn. Aggregate:
[`docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`](handoffs/20260605-1411-phase-4-56-blocked-threshold.md).

Phase 4.55 is a verification-only/blocker audit. Three read-only agents inspected the current scripts, latest handoffs,
security boundaries, and remaining gates; all agreed that local implementation should stop unless a managed env/source/deploy
blocker is supplied or a fresh verification gate fails. Current shell env presence check showed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`,
`WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, `LEGACY_SOURCE_ARTIFACT`, and
`DATABASE_URL` all `NOT_SET`. Local no-env regression proof passed: focused Vitest PASS (`60` tests across admin DB harness,
bot read-safety, two-bot continuity, selected-user static, worker Tortila snapshot, and worker in-flight guard), web
typecheck PASS, worker typecheck PASS, root typecheck PASS, `npm run accept:bots:continuity:contract` PASS, secret scan PASS,
governance PASS, and `git diff --check` PASS. Managed runner preflights refused before DB as expected when the required env
vars were missing. `npm run accept:bots:rendered` was attempted as an extra local browser regression but timed out at the
operator-side 5-minute command limit; it is **NOT GREEN** and is not counted as proof. The stale local process chain from
that timed-out run was closed and the fresh Playwright trace artifacts were removed. Aggregate:
[`docs/handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md`](handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md).

Phase 4.54 closes the local "no fixture lane" blocker for current-user Tortila Mark/uPnL DB proof without creating a second
DB lifecycle. Three read-only auditors inspected the existing admin-user-bots managed DB harness, auth fixture, route
rendering, and safety gates before edits; a fourth loop-regression auditor was launched after the operator asked whether the
work was looping. The existing selected-user DB harness now supports `--user-routes`, keeps the same
`ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` managed create/drop guard, switches only that opt-in lane to `BOT_ADAPTER_MODE=read-only`,
and prepares a valid login-capable selected user plus hostile Tortila real-source Mark/uPnL values. The new
`tests/e2e/user-bot-routes-db.spec.ts` logs in as that user, visits `/app/bots/tortila`,
`/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`, intercepts requests to fail on `/api/marks`, and
requires `N/A` plus neutral/no `wtc-up`/`wtc-down` styling while forbidding raw/secret/hostile values in visible text.
Focused proof: Vitest PASS (`50` tests across admin DB harness, bot read-safety, two-bot continuity, and selected-user
static coverage), web typecheck PASS, root typecheck PASS, runner help/unknown-arg/separate-lane preflights PASS, secret
scan PASS, governance PASS, and `git diff --check` PASS. The actual managed DB browser run remains **NOT RUN** because
`ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied. Aggregate:
[`docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`](handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md).

Phase 4.53 closes the residual Tortila mark/uPnL placeholder risk without calling live sources. Three read-only auditors
checked the user positions/dashboard/statistics paths, safety boundaries, and test coverage before edits. The user bot read
model now carries `markUnavailable`, derived fail-closed from real Tortila position/metric/source adapters instead of
page-level `adapterMode`; user dashboard, user positions, and user statistics render Tortila Mark/uPnL `N/A` with neutral
styling and source-boundary copy. Selected-user admin metric-level Unrealized PnL now also renders `N/A` for Tortila, and
the Tortila contract no longer lists marks timeout or marks integration tests as WTC gates. Focused proof: Vitest PASS (`56`
tests across bot read-safety, two-bot continuity contract, admin selected-user static/DB harness, and worker Tortila
snapshot), web typecheck PASS, root typecheck PASS, secret scan PASS, governance PASS, and `git diff --check` PASS.
User-route managed DB browser proof remains NOT RUN because no throwaway DB/user-position env is supplied. Aggregate:
[`docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`](handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md).

Phase 4.52 makes `/api/marks` consistently excluded from WTC. Two read-only auditors confirmed the adapter/worker code
already avoids calling `/api/marks`, but the Tortila contract still listed it as required/polled and selected-user admin
could render Tortila mark/uPnL placeholders as real values. The contract now removes `/api/marks` from required endpoints
and polling guidance while keeping it only as reference-only excluded documentation. Real Tortila worker snapshots no longer
persist mark/uPnL placeholders when the adapter mode is `real`, and selected-user admin renders Tortila position Mark/uPnL
as `N/A`. Focused proof: Vitest PASS (`32` tests across two-bot continuity contract, admin selected-user static/DB harness,
statistics completion, and worker Tortila snapshot), web typecheck PASS, worker typecheck PASS, root typecheck PASS,
secret scan PASS, governance PASS, and `git diff --check` PASS.
Managed DB browser proof and real Tortila journal reads remain NOT RUN because env/auth gates are absent. Aggregate:
[`docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`](handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md).

Phase 4.51 stops further local Legacy source-proof churn and moves to a distinct Tortila gap. The independent loop audit
verdict: Phase 4.40-4.46 reduced distinct local/no-env blockers, Phase 4.47-4.50 were one useful Legacy source-proof
cluster, and another local Legacy source-proof/UI/test slice would be diminishing return unless it runs the managed DB gate,
consumes real source evidence, or fixes a fresh failure. The Tortila slice added a user-facing `Tortila journal confidence`
panel on `/app/bots/statistics?bot=tortila` and a Tortila-only selected-user admin `Journal import gate` row. Both state
that Tortila analytics come from persisted WTC journal snapshots/user-instance rows, not live exchange probes or `/api/marks`.
Focused proof: Vitest PASS (`33` tests across statistics completion, admin selected-user static/loader, DB e2e harness, and
source-proof guard), web typecheck PASS, root typecheck PASS, and rendered Playwright PASS (`4` bot statistics tests across
desktop/mobile on `E2E_PORT=3521`). Real Tortila journal/auth/worker continuity, managed DB matrix, and deploy/live-control
remain separate NOT RUN gates. Aggregate:
[`docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`](handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md).

Phase 4.50 hardens the selected-user admin DB rendered acceptance for the Phase 4.49 source-proof row. Three read-only
auditors checked UX placement, safety/leak gates, and test coverage. The guarded DB fixture now carries scoped and unscoped
Legacy `closedTradeSourceProof` payloads with hostile raw/source/provider markers, and the DB Playwright spec now requires a
Legacy-only `Source-proof gate` row inside the Legacy statistics coverage matrix with `mapper-ready proof`,
`scoped worker metric`, the importer-replay caveat, and no buttons/links. The same spec forbids the unscoped proof marker,
source-proof API-key/raw-payload/evidence/blocker markers, and raw provider/API-key markers from rendered text. The static
DB e2e harness now pins the fixture, visible row-scoped assertions, and hidden-marker matrix. Focused proof: Vitest PASS
(`32` tests across source-proof, admin selected-user static/loader, DB e2e harness, and statistics completion), web
typecheck PASS, root typecheck PASS, secret scan PASS, governance PASS, and diff whitespace PASS. The managed DB browser
matrix remains **NOT RUN** because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied. Aggregate:
[`docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`](handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md).

Phase 4.49 closes the selected-user admin source-proof clarity gap without weakening raw payload boundaries. Three read-only
auditors inspected UX placement, safety/provenance, and tests/gates before implementation. The Legacy closed-trade
source-proof contract moved behind `@wtc/bot-adapters`, with a shared sanitizer that returns only `status`,
`canImportClosedTrades`, sanitized `missingRequirements`, `blockerCount`, and provenance (`global_preflight` or
`scoped_worker_metric`). The admin selected-user loader now prefers the latest provider-scoped Legacy metric
`closedTradeSourceProof` summary when present, ignores newer unscoped rows, and falls back to the global preflight. The
selected-user coverage matrix renders a Legacy-only `Source-proof gate` row and the existing closed-trade metric sublabel
now explains source-proof blocking without adding edit controls. Focused proof: Vitest PASS (`26` tests across source-proof,
admin selected-user static/loader, and statistics completion), web typecheck PASS, worker typecheck PASS, root typecheck
PASS, secret scan PASS, governance PASS, and diff whitespace PASS. Final
secret/governance/diff gates are recorded in:
[`docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`](handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md).

Phase 4.48 surfaces the Phase 4.47 Legacy closed-trade source-proof state on the user statistics path without exposing
raw worker JSON, provider payloads, env names, secrets, or live-control affordances. Three read-only auditors checked the
UX placement, safety boundary, and focused gate plan before edits. The user bot read model now projects only the safe
`closedTradeSourceProof` summary (`status`, `canImportClosedTrades`, sanitized `missingRequirements`, and count), and
`LegacyOperationsPanel` shows a `Source-proof gate` metric/pill plus blocked-source copy when the worker proves
`blocked_no_source`. Legacy win rate, profit factor, realized PnL, fees, funding, and attribution remain pending until a
real source artifact passes the proof contract. Focused proof: web typecheck PASS, Vitest PASS (`48` focused tests across
statistics completion/read-safety/admin-user static/admin-health loader), and Playwright desktop PASS (`2` bot statistics
tests on `E2E_PORT=3511`, with retained Tortila/Legacy screenshots). Final secret/governance/diff gates are recorded in:
[`docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`](handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md).

Phase 4.47 closes the next source-truth gap without faking Legacy performance history. Three read-only auditors re-checked
the WTC destination, Legacy source candidates, and tests/gates; verdict: WTC can store provider-scoped closed trades, but no
durable local Legacy source table/API proves stable closed-trade/fill identity, realized PnL, fees, funding, timestamps, or
replay semantics. Added `apps/worker/src/legacy-closed-trade-source-proof.ts` as a fail-closed source-proof preflight and
surface its safe `blocked_no_source` summary in Legacy worker metric raw JSON. Added
`tests/integration/legacy-closed-trade-source-proof-static.test.ts` to prevent inactive orders, inactive slots,
open-order reconciliation, position snapshots, Tortila/Turtle journal rows, or GTE journal rows from being treated as
Legacy closed-trade proof. Focused proof: Vitest PASS (`47` tests across Legacy source-proof, Legacy live worker,
provider worker, statistics completion, and bot read-safety tests), root typecheck PASS, worker typecheck PASS, web
typecheck PASS. Final secret/governance/diff gates are recorded in the Phase 4.47 aggregate:
[`docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`](handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md).

Phase 4.46 closes the next no-env runtime-clarity gap in `apps/worker`: long-running DB worker intervals now go through a
serialized in-flight guard so a slow DB tick cannot start a second overlapping DB tick. Overlap attempts return
`skipped_in_flight` and log only constant/numeric telemetry; they do not write a fresh `target='worker'` health row, so
continuity proof remains tied to completed worker ticks and existing stale-row safeguards. One-shot `dbTick()` /
`tick-once.ts` acceptance remains direct. Focused proof: Vitest PASS (`14` tests across `worker-inflight-guard`,
`worker-tortila-snapshot`, and `worker-continuity-acceptance-runner`), worker typecheck PASS, expanded worker safety Vitest
PASS (`38` tests across `worker-inflight-guard`, `worker-health-mapping`, `two-bot-continuity-contract-static`,
`child-output-redaction`, `legacy-live-worker-static`, and `worker-continuity-acceptance-runner`), root typecheck PASS,
`npm run worker:smoke` PASS, `npm run accept:bots:continuity:contract` PASS (`2` gates), secret scan PASS, governance PASS
(`0` errors; one known historical warning), and `git diff --check` PASS. Agents closed. Aggregate:
[`docs/handoffs/20260605-0318-phase-4-46-worker-inflight-guard.md`](handoffs/20260605-0318-phase-4-46-worker-inflight-guard.md).

Phase 4.45 closes the next no-env product-clarity gap on `/app/bots`: the first screen now has a **Two-bot finish board**
for Tortila and Legacy with per-bot settings/setup/worker/statistics/live-control rows, direct CTAs into the existing
settings, setup, dashboard, and statistics pages, and explicit no-live-control copy. The board is user-scoped through
`loadBotReadinessForUser`, reuses the existing bot read model, includes operational worker rows only for the cabinet
overview, and does not import admin loaders, call adapters, test exchange keys, print secrets, start/stop bots, or apply
live config. Focused proof: Vitest PASS (`41` tests across `bot-read-safety-static`, `bot-readiness-builder`, and
`bot-statistics-completion`), root typecheck PASS, focused rendered Playwright smoke PASS (`2` desktop/mobile tests on
`E2E_PORT=3492`) after repairing a strict selector collision in the new setup-review assertion, in-app Browser DOM sanity
PASS on `http://127.0.0.1:3493/app/bots`, secret scan PASS, governance PASS (`0` errors; one known historical warning),
and `git diff --check` PASS. Aggregate:
[`docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`](handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md).

Phase 4.44 closed the next no-env runtime-safety gap on `/admin/bots`: the admin fleet page no longer treats an old
`target='worker'` `ok` row as current continuity proof. `AdminBotHealthResult.workerBotContinuity` now includes freshness,
row age, and the admin stale window; the loader computes stale/fresh with a deterministic `now` option; the admin worker
pill, acceptance gate row, evidence ladder, and Worker bot continuity card all show age/freshness and keep stale rows in
attention instead of green. Setup/settings remain intentionally free of operational worker rows. Focused proof: Vitest PASS
(`45` tests across `admin-bot-health-loader`, `bot-read-safety-static`, and `bot-readiness-builder`), root typecheck PASS,
secret scan PASS, governance PASS, and `git diff --check` PASS. Aggregate:
[`docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`](handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md).

Phase 4.43 closed the no-env admin read-only-label UX gap. `/admin/users` and `/admin/bots` entry points now use explicit
read-only action copy (`Open read-only bot view`, `Open read-only Tortila view`, `Open read-only Legacy view`, `Open
read-only user view`, and `Read-only bot view`), while unmapped Legacy rows remain `Open fleet diagnostics`. The selected-user
Legacy mapping gap now points to a separate audited provider-mapping workflow, and `BOT_CONTROL_SAFETY_MODEL` now says current
admin/user bot evidence pages show no runtime-control buttons until a separately audited affordance exists. Focused proof:
static Vitest PASS (`80` tests), PG8 mobile admin PASS (`1` passed, `1` skipped on `E2E_PORT=3490`), smoke rendered PASS
(`34` passed on `E2E_PORT=3490`), root typecheck PASS, secret scan PASS, and `git diff --check` PASS. Aggregate:
[`docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`](handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md).

Phase 4.42 adds a no-env two-bot continuity contract fixture and gate. `npm run accept:bots:continuity:contract` now runs a
focused `worker-continuity-fixture` plus `worker-smoke` under the same scrubbed local mock/no-live env banner used by bot
admin acceptance. The fixture proves the product contract that Tortila + Legacy are green only when both runtime outcomes
are `ok`; setup-needed stays attention/not-configured; malformed/unreachable becomes error; warning truth persists; Legacy
runtime snapshots do not unlock win rate, PF, realized PnL, fees, funding, or closed-trade attribution; and live-control /
provider-probe boundaries stay disabled. Focused result: `worker-continuity-fixture` PASS (`7` tests) and `worker-smoke`
PASS with `[worker:tick] memory demo tick OK`. The updated canonical `npm run accept:bots:local` runner also passed with
5 gates: `ci:local`, `worker-smoke`, `worker-continuity-fixture`, `bot-admin-e2e` (`65 passed` on `E2E_PORT=3470`), and
visual inventory (`107` image files). Aggregate:
[`docs/handoffs/20260605-0110-phase-4-42-two-bot-continuity-contract.md`](handoffs/20260605-0110-phase-4-42-two-bot-continuity-contract.md).

Phase 4.41 closed the next no-env local completion gap. `/admin/bots` now has a first-screen **Bot completion gate map** that
shows the current acceptance lanes, blocked env/source/live gates, safe next commands, and env presence only
(`SET`/`NOT_SET`, values hidden). The canonical `npm run accept:bots:local` runner now includes a `worker-smoke` child gate
between `ci:local` and rendered bot/admin E2E, so local proof exercises the no-env worker memory tick path before browser
acceptance. Fresh result: `ci:local` PASS, `worker-smoke` PASS with `[worker:tick] memory demo tick OK`, `bot-admin-e2e`
PASS with `65 passed` on `E2E_PORT=3470`, and visual inventory PASS with `107` image files. Aggregate:
[`docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`](handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md).

Phase 4.40 closed the local bot/admin acceptance-runner safety gap found by the tests and security agents. The
`bot-admin-local` and `bot-admin-e2e` modes now refuse managed/admin/real-Postgres env before any child gate starts, run
every child gate under the same scrubbed local mock/no-live env, and redact HMAC-shaped secret assignments in retained child
output. The canonical `npm run accept:bots:local` runner passed after hardening: `ci:local` PASS, `bot-admin-e2e` PASS with
`65 passed` on `E2E_PORT=3470`, and visual inventory PASS with `107` image files. Aggregate:
[`docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`](handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md).

Phase 4.39 deepened the Legacy closed-trade source audit with three read-only agents. Verdict: WTC destination/repository
layer is ready for provider-scoped Legacy closed trades if a real source is found, but no durable local Legacy
closed-trade/fill source was proven. Legacy source code stores active order/slot/settings state and reacts to fills, but it
does not persist stable closed-trade/fill identity, realized PnL, fees, funding, or trade-level opened/closed timestamps.
Turtle/Tortila journal tables are a different product path and are not Legacy proof. Aggregate:
[`docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`](handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md).

Fresh local proof in this continuation: Phase 4.53 Tortila Mark/uPnL unavailable hardening passed focused Vitest (`56`
tests across bot read-safety, two-bot continuity contract, admin selected-user static/DB harness, and worker Tortila
snapshot coverage), web typecheck, root typecheck, secret scan, governance, and `git diff --check`. Phase 4.52 Tortila `/api/marks` exclusion passed focused Vitest (`32` tests), web
typecheck, worker typecheck, root typecheck, secret scan, governance, and `git diff --check`. Phase 4.51 Tortila source-confidence passed focused Vitest (`33` tests),
web typecheck, root typecheck, and bot-statistics Playwright (`4` desktop/mobile tests on `E2E_PORT=3521`). Phase 4.50 admin selected-user Legacy source-proof rendered acceptance hardening
passed focused Vitest (`32` tests across source-proof/static/loader/DB harness/statistics coverage), web typecheck, root
typecheck, secret scan, governance, and `git diff --check`. Phase 4.49 admin selected-user Legacy source-proof hydration
passed focused Vitest (`26` tests across source-proof/static/loader/statistics coverage), web typecheck, worker typecheck,
root typecheck, secret scan, governance, and `git diff --check`. Phase 4.48 Legacy source-proof visibility passed web typecheck, focused Vitest
(`48` tests across user statistics/read-safety/admin-user/admin-health coverage), and dedicated bot-statistics Playwright
desktop (`2` tests on `E2E_PORT=3511`) with retained screenshots. Phase 4.46 worker in-flight proof passed Vitest (`14` focused tests and `38`
expanded worker safety tests), worker typecheck, root typecheck, `worker:smoke`, `accept:bots:continuity:contract`,
secret scan, governance, and `git diff --check`.
Phase 4.45 focused bot-list proof passed Vitest (`41` tests), root typecheck,
focused rendered smoke (`2` desktop/mobile tests), in-app Browser DOM sanity, secret scan, governance, and
`git diff --check`. `npm run accept:bots:local` passed after the Phase 4.42 fixture addition
(`ci:local` PASS, `worker-smoke` PASS, `worker-continuity-fixture` PASS, `bot-admin-e2e` PASS with `65 passed`, and visual
inventory PASS with `107` image files). `npm run accept:bots:continuity:contract` also passed after the Phase 4.42 fixture
addition (`worker-continuity-fixture` PASS and `worker-smoke` PASS). Phase 4.44 focused worker freshness proof passed
Vitest (`45` tests), root typecheck, secret scan, governance, and `git diff --check`. Phase 4.43 focused admin label proof passed static Vitest (`80`
tests), PG8 mobile admin (`1` passed, `1` skipped), smoke rendered (`34` passed), root typecheck, secret scan, and
`git diff --check`. The faster `npm run accept:bots:rendered` runner also
passed earlier after the env scrub
(`65 passed`; visual inventory `107` image files). Earlier focused bot rendered proof passed (`26 passed` desktop/mobile),
the expanded no-live-DB rendered
pack passed with dedicated bot statistics coverage, root `npm test` passed after isolated-PGlite timeout hardening (`126`
files, `1090` passed, `10` skipped), and formal retained visual evidence passes with `107` reviewed screenshot artifacts:
[`logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json`](../logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json).
Recent local gates also passed for lint, root typecheck, worker/web typecheck, web build, `git diff --check`,
`npm run secret:scan`, governance, and the consolidated `npm run ci:local` pipeline. Current local aggregates:
[`docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md`](handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md),
[`docs/handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md`](handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md),
[`docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`](handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md),
[`docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`](handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md),
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
and [`docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`](handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md).

Still **NOT GREEN / NOT RUN**: managed worker continuity tuple proof (`WORKER_CONTINUITY_ADMIN_DATABASE_URL` not supplied),
admin selected-user DB Playwright matrix (`ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` not supplied; Phase 4.50 has the fixture
and assertions ready), real Tortila journal read-only proof (`TORTILA_JOURNAL_BASE_URL`/token not supplied and journal
auth/firewall unresolved), live exchange ping, live bot start/stop/apply-config, live provider/exchange probes,
deploy/production monitoring, and GitHub CI for the current dirty working tree. Legacy closed-trade performance history is
**blocked by source evidence**: WTC can store provider-scoped
imported trades, but the local Legacy source does not prove a durable closed-trade/fill table or API with stable trade id,
realized PnL, fees, funding, and close timestamps. Legacy win rate, profit factor, realized PnL, and attribution must remain
pending until that source is proven and imported through the provider-scoped contract.

Anti-loop rule from Phase 4.51: do not spend another local phase on Legacy source-proof copy, static tests, or dashboard rows
unless a managed DB run fails or a real source artifact is provided. Next progress should clear or honestly block one of the
env/source/deploy buckets.

_Latest update: 2026-06-03 - Phase 3.67 Bot analytics/settings canary deploy._
The WTC HTTPS canary now runs the richer bot analytics/settings release `20260603-1246-8075523-bot-analytics`.
This deploy touched only `wtc-ecosystem-canary`; it preserved the existing nginx route, kept `wtc-ecosystem-worker` and
`wtc-ecosystem-preview` running, and did not mutate live bot code/config/services. Legacy settings are now a WTC-side
reference/export matrix with a saved admin `v1` reference config; no live Legacy apply or authenticated Legacy API path is
enabled. Tortila statistics now include the richer advanced analytics panels while Tortila real data remains DB-backed via
the existing read-only worker path.

Verified: local `npm run ci:local` passed; server web production build passed; temporary pre-switch smoke on
`127.0.0.1:8311` passed; public canary `/products/tortila` and `/login` returned `200`; unauthenticated `/app/bots`
redirected to `/login`; authenticated browser checks passed for Legacy settings, Legacy statistics, Tortila statistics, and
Tortila dashboard; browser console errors were empty. Existing bot services and `wtc-bot-api-firewall.service` remained
active, server-local bot ports stayed open, and external `8000/8080` probes stayed closed. Aggregate:
[`docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`](handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md).

This is **BOT ANALYTICS/SETTINGS CANARY DEPLOYED**, not final full production. Still **NOT GREEN**: Legacy live adapter,
live bot controls, provider-side journal bearer-auth acceptance, Stripe live/test checkout acceptance, Axioma live bridge,
live LMS object-store/scanner, branded-domain DNS/TLS, production burn-in/alerting, GitHub CI for this uncommitted working
tree, and final monitoring acceptance.

_Latest update: 2026-06-03 - Phase 3.65 Tortila DB-backed read-only canary._
Tortila is now connected to the production canary with real read-only data through WTC Postgres snapshots, not mock data and
not direct journal reads from user page renders. Current accepted shape: Tortila journal -> `wtc-ecosystem-worker` ->
WTC DB snapshots/imports -> web/admin UI. The canary release is commit `4487b3d`, deployed on the server as
`20260602-1816-4487b3d`; `wtc-ecosystem-canary` serves the web canary, and `wtc-ecosystem-worker` refreshes Tortila
read-only snapshots. Existing bot services remained active, and only WTC canary/worker containers were changed.

Observed production-canary proof: worker logs showed repeated Tortila snapshot success in read-only mode; canary DB aggregates
showed `worker` and `tortila-journal` health rows, metric snapshots, position snapshots, and `13` imported trades; browser
checks passed for public Tortila product page, authenticated Tortila dashboard, positions, trades, equity, journal,
statistics, admin bots, and admin system-health. Public product copy now marks Tortila available for live read-only
monitoring; authenticated bot pages show `REAL DATA`; live controls remain disabled. Local `npm run ci:local` passed,
root `npm test` passed (`105` files, `936` passed, `10` skipped), web build passed, `npm run secret:scan` passed, and
GitHub Actions CI for `4487b3d` passed.

This is **TORTILA REAL READ-ONLY CANARY LIVE**, not full production for all products. Still **NOT GREEN**: provider-side
journal bearer-auth acceptance, any live bot control, Legacy non-mock integration, Tortila `/api/marks` / `/api/overview`
consumption, Stripe self-serve billing, Axioma live bridge/download/account-link, live LMS object-store/scanner,
branded-domain DNS/TLS, production burn-in/alerting, and direct intended production append-only audit-role proof. Aggregate:
[`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`](handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md).

_Latest update: 2026-06-02 - Phase 3.64 Production canary deploy._
WTC is now live as an HTTPS production canary at the operator-known `https://<wtc-canary-host>`. Four read-only agents ran before
deploy work and were closed: devops, security, tests, and bot-integration. The canary release is commit `5522900`, deployed
on the server as `wtc-ecosystem-canary` on `127.0.0.1:8301`; nginx routes the WTC canary hostname to it, and Let's Encrypt
TLS is active for the operator-known canary hostname. The canary DB is `wtc_platform_canary_20260602_1412`, created from the existing WTC
preview DB and then migrated/seeded. GitHub Actions for `5522900` passed, local `npm run ci:local` passed, public HTTPS
smokes passed, real browser registration/login passed, and the session cookie is secure/httpOnly `__Host-wtc_session`.
Both existing bots remained running: `turtle-bot.service` is active, tmux session `bot` exists, and server-local
`127.0.0.1:8000` / `127.0.0.1:8080` probes are open. New firewall service `wtc-bot-api-firewall.service` is active; external
TCP probes now show `80 open`, `443 open`, `8000 timeout`, and `8080 timeout`.

This is **PRODUCTION CANARY LIVE**, not full bot-integrated production. The canary intentionally runs `BOT_ADAPTER_MODE=mock`
and `FEATURE_LIVE_BOT_CONTROL=false`; real Tortila/Legacy adapters, any live bot control, Stripe self-serve billing, Axioma
live acceptance, live LMS object-store/scanner, branded-domain DNS/TLS, production worker rollout, and long-running
monitoring are still **NOT GREEN**. Aggregate:
[`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`](handoffs/20260602-2125-phase-3-64-production-canary-deploy.md).

_Latest update: 2026-06-02 - Phase 3.63 Production-readiness gap closure._
Closed the next production-readiness gap-closure phase without live server/provider mutation. Six read-only agents ran before
edits and were closed: security, bot-integration, devops, backend, frontend, and tests. CI/env fences now generate and
validate production-like Stripe and ES256 Axioma material in the staged workflow, and config now requires Stripe secret,
webhook, and price-map values when `BILLING_PROVIDER=stripe` in production-like environments. Added real-form auth browser
coverage and a managed DB-backed auth e2e runner. The existing local bot Postgres settings from
`C:\Users\maxib\GTE BOT\bot\.env` were used only in-process; the final managed auth DB run created
`wtc_test_auth_20260602130742_099899`, applied `17` migrations plus seed, ran real register/login Playwright (`2` passed),
and dropped the throwaway DB. Windows reserved ports `3100-3103`, so Playwright configs now default to env-overridable
ports `3410-3413`; final default `npm run e2e` passed (`44` passed, `6` skipped), and
`npm run e2e:auth:production-profile` passed (`2` passed). Additional fresh gates: root `npm test` **PASS** (`105` files,
`934` passed, `10` skipped), `npm run build -w @wtc/web` **PASS**, `npm run check:core` **PASS**, root/web typecheck
**PASS**, lint **PASS**, and `npm run secret:scan` **PASS**. No listener remained on `3410/3412/3413`; the local preview
listener on `3000` was left untouched.

Still **NOT PRODUCTION READY**. Still **NOT RUN:** direct intended production/preview append-only audit-role proof, live LMS
object-store/scanner, real Stripe checkout/webhook replay, Axioma live bridge/account-link/download acceptance, preview/prod
DB rollout, SSH/nginx/systemd/server deploy checks, GitHub CI, production monitoring, live bot services/control, and
coverage. The folder is still **NOT GIT-BACKED**. Aggregate:
[`docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`](handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md).

_Latest update: 2026-06-02 - Phase 3.62 Local site-readiness._
Closed the local site-readiness phase. Three read-only agents ran before execution and were closed: tests, frontend, and
devops. Fresh local gates observed: root `npm test` **PASS** (`103` test files, `921` passed, `10` skipped);
`npm run build -w @wtc/web` **PASS** (Next `15.5.18`, `35` static pages, First Load JS `103 kB`, middleware `35.3 kB`);
default `npm run e2e` **PASS** on rerun (`44` passed, `8` skipped, no failed/flaky; the earlier attempt hit only the
outer command timeout and is not counted green); `npm run check:core` **PASS**; `npm run db:generate -w @wtc/db` **PASS**
(`43` tables, no schema changes); and visual inventory **PASS inventory-only** (`69` images, `0` blocked containers).
The local `preview:safe` chain on port `3000` is from this workspace and responded at `http://127.0.0.1:3000` with HTTP
`200` and a title containing `WTC Ecosystem` and `World Trader Club`, so the user can manually check the local demo/mock
site there.
Playwright port `3100` was clear after e2e. The folder is still **NOT GIT-BACKED**, so GitHub CI is still unavailable.
Still **NOT RUN:** direct production/preview intended audit DB-role proof, live LMS object-store/scanner, Stripe, Axioma,
preview/prod DB rollout, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, production monitoring,
coverage, and screenshot acceptance beyond inventory. Aggregate:
[`docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`](handoffs/20260602-1856-phase-3-62-local-site-readiness.md).

_Latest update: 2026-06-02 - Phase 3.61 Audit append-only managed acceptance._
Closed the local managed append-only audit role proof using the operator-identified local existing-bot Postgres settings from
`C:\Users\maxib\GTE BOT\bot\.env` without printing credential values. Three read-only agents ran before DB/role mutation and
were closed: security, tests, and devops. `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL` was built only in-process. A new managed
runner `npm run accept:audit:append-only-role:managed` now creates a fresh `wtc_test_audit_*` DB, applies migrations, creates
a temporary restricted `wtc_app_role_*`, grants only `SELECT`/`INSERT` on `public.audit_logs`, runs the existing direct
preflight, and drops both generated resources. The first managed run created/dropped `wtc_test_audit_20260602113036_6c10be`
but failed before preflight on PostgreSQL utility placeholder syntax for `CREATE ROLE ... PASSWORD`; the runner now validates
generated identifiers/literals before using `unsafe()` for that utility command. The final managed run created
`wtc_test_audit_20260602113142_0aa15f`, applied `17` migrations, created `wtc_app_role_20260602113142_97bf21`, proved
`select=true insert=true update=false delete=false truncate=false probe=inserted`, and dropped both the DB and role. Follow-up
gates observed: focused audit runner Vitest **PASS** (`16` passed), root `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, and `npm run secret:scan` **PASS**. This clears local
managed throwaway audit-role proof only; direct production/preview intended-role proof is still **NOT RUN**. Still **NOT
RUN:** root `npm test`, web build, default e2e, preview, full gate runner, live LMS object-store/scanner, Stripe, Axioma,
preview/prod DB rollout, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and production monitoring.
Aggregate:
[`docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md`](handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md).

_Latest update: 2026-06-02 - Phase 3.60 Existing-bot real-PG managed acceptance._
Closed the active managed real-Postgres proof using the operator-identified local existing-bot Postgres settings from
`C:\Users\maxib\GTE BOT\bot\.env` without printing credential values. Three read-only agents ran before DB mutation and
were closed: security, tests, and devops. `REAL_POSTGRES_ADMIN_DATABASE_URL` was built only in-process. The first managed
run created and dropped `wtc_test_realpg20260602105728361315`, but failed on a test-only raw timestamp type expectation
(`13` passed, `1` failed). `tests/integration/db-real-postgres.test.ts` now accepts either a valid `Date` or parseable
timestamp string for raw `postgres-js` timestamp output. The final `npm run accept:real-pg:managed` run created
`wtc_test_realpg20260602105824d18bef`, ran the active real-PG harness (`14 passed`), and dropped the throwaway DB. This
clears the current local active managed real-PG proof. Follow-up gates observed: focused safety/helper Vitest **PASS** (`13`
passed, `9` skipped inactive DB block), root `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`npm run lint` **PASS**, `npm run secret:scan` **PASS**, and `npm run governance:check` **PASS** (`0` errors, `1` known
historical warning). Still **NOT RUN:** root `npm test`, web build, default e2e, preview, full gate runner, append-only
audit DB-role proof, live LMS object-store/scanner, Stripe, Axioma, preview/prod DB rollout, SSH/nginx/systemd/server
checks, bot services/control, GitHub CI, deploy, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md`](handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md).

_Latest update: 2026-06-02 - Phase 3.59 Existing-bot LMS DB acceptance._
Closed the first credentialed acceptance gate using the operator-identified local existing-bot Postgres settings from
`C:\Users\maxib\GTE BOT\bot\.env` without printing credential values. Three read-only agents ran before mutation and were
closed: security, tests, and devops. The final managed LMS DB browser run created `wtc_test_lms_20260602101117_cc7889`,
prepared it with 17 migrations plus demo seed data, ran desktop/mobile Playwright for `tests/e2e/lms-db-materials.spec.ts`
(`2 passed`), ran the LMS DB artifact scanner **PASS** (`2` text files, `69` images, `0` blocked containers, `10` dynamic
markers), and dropped the throwaway DB. The retained mobile lesson screenshot was manually reviewed and validated with
`npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json
tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png` **PASS**. Fixes landed during the acceptance path:
Windows `.cmd` child-process spawning through the redacted helper, Node 24 strip-only TS parameter-property removal in LMS and
TradingView packages, LMS DB e2e selector/leak-check corrections, correct lesson-page screenshot capture after auth switches,
and mobile lesson embed overflow repair. Gates also observed: focused Vitest **PASS** (`29` passed, then `21` passed),
`npm run typecheck -w @wtc/web` **PASS**, root `npm run typecheck` **PASS**, `npm run lint` **PASS**, `npm run secret:scan`
**PASS**, `npm run governance:check` **PASS** (`0` errors, `1` known historical warning), and strip-only import smoke
**PASS**. Still **NOT RUN:** default e2e, preview, full gate runner, root `npm test`, web build, active real-PG managed proof,
append-only audit DB-role proof, live LMS object-store/scanner, Stripe, Axioma, preview/prod DB rollout,
SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and production monitoring.
Aggregate:
[`docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`](handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md).

_Latest update: 2026-06-02 - Phase 3.58 Credentialed acceptance blocker packet._
Closed the post-3.57 docs-only blocker-packet phase without starting preview, Playwright, SSH, nginx, systemd, DB mutation,
bot services, provider calls, CI, deploy, or production monitoring. Four read-only agents ran before edits and were closed:
security, tests, devops, and platform. `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` now records the current blocked
credential/live gates with exact commands, required env/consent names, current `NOT_SET` evidence, and the evidence required
to clear each gate. Current shell checks printed only `SET`/`NOT_SET`; all checked LMS DB, real-PG, audit-role, object-store,
scanner, Stripe, and Axioma credential/consent variables were `NOT_SET`. `git rev-parse --show-toplevel` still fails from
this root, so branch/commit/PR/GitHub CI readiness is unavailable. Gates observed in this phase: required docs/protocol reads
**PASS**; values-hidden env presence check **PASS as blocker evidence**; git-root check **NOT GIT-BACKED**; final
`npm run secret:scan` **PASS**; final `npm run governance:check` **PASS**. Still **NOT RUN:** `npm run preview:safe`,
`npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, `npm run typecheck`, actual LMS DB browser
acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live
object-store/scanner/Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution,
deploy, and production monitoring. Packet:
[`docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`](CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md). Aggregate:
[`docs/handoffs/20260602-1626-phase-3-58-credentialed-acceptance-blocker-packet.md`](handoffs/20260602-1626-phase-3-58-credentialed-acceptance-blocker-packet.md).

_Latest update: 2026-06-02 - Phase 3.57 Symlink-hard preflight root confinement._
Closed the next local retained-evidence path hardening gap without starting preview, Playwright, SSH, nginx, systemd,
DB mutation, bot services, provider calls, CI, deploy, or production monitoring. Four read-only agents ran before edits
and were closed: security, tests, devops, and platform. `scripts/workspace-path-guard.mjs` now provides script-local
realpath/lstat confinement helpers that reject symlink, junction, and reparse-point path components. `scripts/preflight-log-root.mjs`
now applies that guard during `*_PREFLIGHT_LOG_ROOT` resolution and summary writes, and summaries are created exclusively so
existing retained summaries are not overwritten. `scripts/gates.mjs` verifies the fixed `logs/gates` root before retained
gate-log writes. `scripts/scan-lms-db-e2e-artifacts.mjs` and `scripts/check-retained-visual-artifacts.mjs` now refuse linked
explicit roots, nested linked descendants, linked dynamic marker manifests, linked visual review manifests, and linked OCR
sidecars while keeping failure output redacted for secret-shaped path labels. Gates observed: syntax checks **PASS** for
`scripts/workspace-path-guard.mjs`, `scripts/preflight-log-root.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`,
`scripts/check-retained-visual-artifacts.mjs`, and `scripts/gates.mjs`; focused Vitest **PASS** (`61` passed);
`npm run secret:scan` **PASS**; `npm run typecheck` **PASS**; `node scripts/gates.mjs full` **PASS** (9/9);
`node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` **PASS** (`15` text files, `0` images, `0` blocked containers);
`npm run evidence:visual -- --inventory tests/e2e/screenshots` **PASS inventory only** (`68` image files; not acceptance);
and final `npm run governance:check` **PASS**. Still **NOT RUN:** `npm run preview:safe`, `npm run e2e`,
`node scripts/gates.mjs e2e`, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview
append-only audit DB-role proof, live object-store/scanner/Stripe/Axioma preflights, preview/prod DB rollout,
SSH/nginx/systemd/server checks, GitHub CI execution, deploy, and production monitoring. Aggregate:
[`docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md`](handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md).

_Latest update: 2026-06-02 - Phase 3.56 Safe-preview retained output policy._
Closed the next local retained-evidence gap for the long-running safe preview stream without starting preview, Playwright,
SSH, nginx, systemd, DB mutation, bot services, provider calls, CI, deploy, or production monitoring. Four read-only agents
ran before edits and were closed: security, tests, devops, and platform. `scripts/safe-preview.mjs` no longer uses raw
`stdio: 'inherit'`; it keeps the direct Next CLI wrapper, `shell:false`, `0.0.0.0:3000`, and forced development/mock/no-live
flags while piping stdout/stderr through a streaming redactor before forwarding. The stream redactor buffers incomplete lines
and private-key blocks so split chunks do not leak Postgres URLs/DSNs, DB/env secret assignments, auth/cookie headers,
bearer/basic/JWT-like values, provider tokens, signed URL tokens, raw public-IP preview URLs, or private-key material.
`scripts/scan-lms-db-e2e-artifacts.mjs` now refuses raw `dev-server.log` and `preview-safe*.log` files as retained archive
evidence, because ignore rules are not archive approval. Gates observed: syntax checks **PASS** for `scripts/safe-preview.mjs`
and `scripts/scan-lms-db-e2e-artifacts.mjs`, focused Vitest **PASS** (`32` passed), raw preview-log retained-evidence refusal
**PASS** (expected refusal for current `dev-server.log` / `logs/preview-safe*.log`), `npm run secret:scan` **PASS**,
`npm run typecheck` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs
logs/gates` **PASS**, final `npm run governance:check` **PASS**, and all four per-agent handoffs are on disk. Still
**NOT RUN:** `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, actual LMS DB browser
acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live preflights,
live Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production
monitoring. Aggregate:
[`docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md`](handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md).

_Latest update: 2026-06-02 - Phase 3.55 Retained visual artifact policy._
Closed the next local retained-evidence truth gap without live acceptance, deploy, SSH, nginx, systemd, DB mutation,
live server checks, bot services, Stripe/Axioma network calls, LMS scanner/object-store live calls, CI execution, or
production monitoring. `scripts/check-retained-visual-artifacts.mjs` adds a separate screenshot/image evidence gate:
`--inventory` only counts retained images and is not acceptance, while `--manifest <visual-review.json>` fails closed unless
every retained image in the supplied roots has passing manual/OCR review metadata. OCR sidecar text is scanned for DB URLs,
auth/cookie tokens, signed URL tokens, raw public-IP URLs, provider tokens, LMS internal metadata, and dynamic marker values
without printing matched values. `package.json` exposes `npm run evidence:visual`; staged CI no longer uploads raw
`tests/e2e/screenshots/**` directly and instead inventories visual artifacts, validates any
`logs/retained-visual-artifacts/**/visual-review*.json` upload candidate with `--manifest`, and uploads only matching
manifest files with short retention. LMS DB runbook/runner text now requires both text artifact scanning and visual review before
retaining screenshots. Gates observed: syntax checks **PASS** for `scripts/check-retained-visual-artifacts.mjs` and
`scripts/run-lms-db-e2e.mjs`, focused Vitest **PASS** (`10` passed), `npm run evidence:visual -- --inventory
tests/e2e/screenshots` **PASS** (`68` image files inventoried), expected no-manifest refusal **PASS** (`review manifest
required for 68 image file(s)`), `npm run secret:scan` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` **PASS**, and final `npm run governance:check` **PASS**. Still
**NOT RUN:** OCR review of current screenshots, any retained screenshot acceptance manifest, actual LMS DB browser
acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live preflights,
live Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production
monitoring. Aggregate:
[`docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`](handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md).

_Latest update: 2026-06-02 - Phase 3.54 Child-process output redaction._
Closed the next local retained-evidence hygiene gap without live acceptance, deploy, SSH, nginx, systemd, DB mutation,
live server checks, bot services, Stripe/Axioma network calls, LMS scanner/object-store live calls, CI, or monitoring.
`scripts/redacted-child-process.mjs` now owns text-only child stdout/stderr redaction for one-shot proof/evidence runners:
Postgres URLs/DSNs, DB/env secret assignments, password fragments, auth headers, cookies, bearer/basic/JWT-like values,
provider tokens, signed URL parameters, provider/preview URL assignments, raw public-IP preview URLs, and private-key blocks
are redacted before retained console/log output. LMS DB, LMS DB managed, real-PG managed, `safe-worker-tick`, and
`scripts/gates.mjs` now use the helper; `logs/gates/*.log` discard full output for passing gates and retain full redacted
output only for failing gates, while the compact gate summary stays quiet. `safe-preview.mjs` remains an explicit out-of-scope
interactive dev-server stream and must not be archived as retained evidence. Gates observed: syntax checks **PASS** for six
changed scripts, focused Vitest **PASS** (`56` passed), regression focused Vitest **PASS** (`6` passed), `npm run secret:scan`
**PASS**, `node scripts/gates.mjs full` **PASS** (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` **PASS**,
post-cleanup `npm run governance:check` **PASS**, and post-cleanup `npm run secret:scan` **PASS**. Aggregate:
[`docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`](handoffs/20260602-1357-phase-3-54-child-output-redaction.md).

_Latest update: 2026-06-02 - Phase 3.53 Preflight log-root confinement._
Closed the next local retained-evidence path hygiene gap without live acceptance, deploy, SSH, nginx, systemd, DB mutation,
live server checks, bot services, Stripe/Axioma network calls, LMS scanner/object-store live calls, CI, or monitoring.
`scripts/preflight-log-root.mjs` now owns the shared policy for operator preflight summaries: `*_PREFLIGHT_LOG_ROOT` overrides
must be relative repo-local `logs/...` paths, while absolute, UNC, URL-shaped, parent-traversal, and non-`logs/` roots are
refused before summary writes. LMS object-store, LMS scanner, Stripe webhook replay, Stripe checkout, and Axioma handoff
preflights now use that helper and print normalized relative `summary=logs/.../summary-*.json` paths. The LMS artifact
scanner now refuses unsafe explicit roots, missing explicit roots, and unsafe dynamic marker manifest paths. Gates observed:
syntax checks **PASS** for helper/five preflight scripts/scanner, focused Vitest **PASS** (`55` passed),
`npm run governance:check` **PASS** (0 errors / 1 known warning; 4 cited per-agent handoffs all present),
`npm run secret:scan` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift),
`npm run typecheck` **PASS**, and `node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md`](handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md).

_Latest update: 2026-06-02 - Phase 3.52 Raw preview URL hygiene._
Closed the next local retained-evidence hygiene gap without live preview, SSH, nginx, systemd, database, bot, Stripe, Axioma,
LMS object-store/scanner, CI, or production monitoring activity. `apps/web/next.config.ts` no longer hardcodes the old raw
preview host; network dev origins are operator-configured through `WTC_DEV_ALLOWED_ORIGINS`. Active durable docs now use
operator-only placeholders for the raw preview URL, SSH command, demo password, and preview DB name. The LMS retained-artifact
scanner now rejects raw public IPv4 URLs, public-IP SSH targets, preview/base URL assignments, raw app redirect URL fields,
generic DB/admin URL or DSN assignments, and generic token/API-key assignments. `.gitignore` / `.secretlintignore` now exclude
preview runtime logs and `.next-e2e*` generated browser build outputs from accidental retention. Live preview smoke and all
credentialed acceptance gates remain **NOT RUN**. Gates observed: focused Vitest **PASS** (`21` passed),
active docs/config old-coordinate search **PASS** (no matches in active docs outside historical handoffs),
`npm run governance:check` **PASS** (0 errors / 1 known warning; 4 cited per-agent handoffs all present),
`npm run secret:scan` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), and
`node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1319-phase-3-52-raw-preview-url-hygiene.md`](handoffs/20260602-1319-phase-3-52-raw-preview-url-hygiene.md).

_Latest update: 2026-06-02 - Phase 3.51 LMS DB wrapper redaction._
Closed the local retained-evidence safety gap around LMS DB browser managed-runner output. LMS and real-PG managed wrappers no
longer echo unknown CLI argument values, so URL-shaped accidental positional args are refused without printing the value.
`scripts/run-lms-db-e2e-managed.mjs` now exposes a guarded `safeMessage()` sanitizer for no-DB canary tests, and
`scripts/run-lms-db-e2e.mjs` plus `scripts/prepare-lms-db-e2e.ts` redact raw Postgres URLs and `password=` fragments in catch
paths before inherited stderr can be archived. Actual LMS DB browser acceptance remains **NOT RUN** without
`LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL`. Gates observed: syntax checks **PASS**, direct URL-shaped unknown-arg
refusals **PASS** for LMS and real-PG managed wrappers, focused Vitest **PASS** (`42` passed),
`npm run governance:check` **PASS** (0 errors / 1 known warning; 3 cited per-agent handoffs all present),
`npm run secret:scan` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), and
`node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1257-phase-3-51-lms-db-wrapper-redaction.md`](handoffs/20260602-1257-phase-3-51-lms-db-wrapper-redaction.md).

_Latest update: 2026-06-02 - Phase 3.50 Runner/gate help safety._
Closed the small local safety gap surfaced by the Phase 3.49 agents. `scripts/run-real-pg-harness-managed.mjs` now refuses
unknown arguments before parsing `REAL_POSTGRES_ADMIN_DATABASE_URL`, constructing a Postgres client, or creating a throwaway
database. `tests/integration/real-pg-managed-runner-safety.test.ts` clears inherited admin DB URLs by default and covers the
credential-present typo case, so no-DB tests cannot accidentally run with live credentials from the shell. `scripts/gates.mjs`
now derives invalid-mode help from the `PLANS` map and creates `logs/gates` only after a valid mode is selected. Active
managed real-Postgres proof remains **NOT RUN** without operator credentials. Gates observed: syntax checks **PASS**, focused
Vitest **PASS** (`7` passed), unknown-argument refusal **PASS**, credential-present unknown-arg refusal **PASS**, and invalid
gate-mode refusal **PASS**, `npm run governance:check` **PASS** (0 errors / 1 known warning; 3 cited per-agent handoffs all
present), `npm run secret:scan` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), and
`node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1240-phase-3-50-runner-gate-help-safety.md`](handoffs/20260602-1240-phase-3-50-runner-gate-help-safety.md).

_Latest update: 2026-06-02 - Phase 3.49 Audit append-only role preflight._
Closed the next local production-readiness gap around PostgreSQL-level `audit_logs` immutability without touching a live
database. `npm run accept:audit:append-only-role` now verifies the intended restricted app role (`wtc_app_role` by default)
has `SELECT` and `INSERT` on `public.audit_logs`, lacks `UPDATE`, `DELETE`, and `TRUNCATE`, is not elevated
(superuser/createdb/createrole/replication/bypassrls), and does not own the table before writing one safe
`system.health_check` probe row. The command is refusal-first: no explicit accept, missing/invalid URL, admin-looking URL
user, and non-`wtc_test*` targets are rejected before DB mutation unless the operator explicitly approves a non-throwaway
target. `AUDIT_LOG_SCHEMA.md`, `DATA_MODEL.md`, `DEPLOYMENT.md`, `.env.example`, and `SECURITY_MODEL.md` now align on
`wtc_app_role` and report the production proof honestly. Production/preview append-only role proof remains **NOT RUN** without
operator credentials. Gates observed: script syntax **PASS**, help **PASS**, refusal checks **PASS**, focused Vitest
**PASS** (`9` passed), `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), `npm run governance:check`
**PASS** (0 errors / 1 known warning; 5 cited per-agent handoffs all present), `npm run secret:scan` **PASS**, and
`node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1225-phase-3-49-audit-append-only-role-preflight.md`](handoffs/20260602-1225-phase-3-49-audit-append-only-role-preflight.md).

_Latest update: 2026-06-02 - Phase 3.48 Auth lockout docs truth._
Closed the next docs-truth gap around migration `0016_colorful_lyja` without schema/runtime changes. `DATA_MODEL.md` now
puts the eight REAL-in-0016 auth lockout columns directly in the active `users` table, keeps richer identity fields marked as
TARGET-only unless a later migration adds them, and aligns the current email unique/index note with `users_email_idx` on
`email`. `AUDIT_LOG_SCHEMA.md` now treats `auth.account_unlock` as implemented, removes it from the target-only auth additions
table, and documents the allowed before/after lockout-state snapshot fields plus forbidden secret/public-leak fields. Active
real-Postgres proof remains **NOT RUN** without operator credentials. Gates observed: `npm run db:generate -w @wtc/db`
**PASS** (43 tables, no schema drift), `npm run governance:check` **PASS** (0 errors / 1 known warning; 4 cited per-agent
handoffs all present), `npm run secret:scan` **PASS**, and `node scripts/gates.mjs full` **PASS** (9/9). Aggregate:
[`docs/handoffs/20260602-1202-phase-3-48-auth-lockout-docs-truth.md`](handoffs/20260602-1202-phase-3-48-auth-lockout-docs-truth.md).

_Latest update: 2026-06-02 - Phase 3.47 Managed real-PG proof runner._
Prepared the next active real-Postgres auth/account proof path without mutating a database in this session.
`npm run accept:real-pg:managed` now exists and refuses to run unless the operator supplies
`REAL_POSTGRES_ADMIN_DATABASE_URL` pointing at a non-throwaway maintenance database. When supplied, it creates a fresh
`wtc_test_<suffix>` database, runs only `npm test -- tests/integration/db-real-postgres.test.ts` with redacted connection
details, and drops the throwaway database in `finally`. Local discovery found PostgreSQL 17 running on `127.0.0.1:5432` and
`psql.exe` available by full path, but `REAL_POSTGRES_DATABASE_URL`, `DATABASE_URL`, `SESSION_SECRET`, and
`SECRET_VAULT_KEK` were unset; default local credentials did not authenticate; Docker was unavailable. Therefore active
real-PG auth/account race proof remains **NOT RUN**. Gates observed: `node --check scripts/run-real-pg-harness-managed.mjs`
**PASS**, `npm run accept:real-pg:managed -- --help` **PASS**, missing-admin-url refusal **PASS** (expected exit 2 before
DB mutation), focused default real-PG harness **PASS** (`5 passed / 9 skipped`), and `node scripts/gates.mjs full` **PASS**
(9/9). Aggregate:
[`docs/handoffs/20260602-1144-phase-3-47-managed-real-pg-proof-runner.md`](handoffs/20260602-1144-phase-3-47-managed-real-pg-proof-runner.md).

_Latest update: 2026-06-02 - Phase 3.46 Real-Postgres harness table-set truth._
Closed the stale local real-Postgres harness truth gap without live server mutation, live database mutation, or a migration.
`tests/integration/db-real-postgres.test.ts` no longer hardcodes an old table count; the opt-in harness now derives the
current Drizzle schema table names and compares the migrated real-Postgres `information_schema` base table set to that
schema-derived set. A no-credential helper test also proves the table-set source can be derived locally, so future schema
growth does not require manually chasing a stale `40`/`41` assertion. Initial focused verification observed
`npm test -- tests/integration/db-real-postgres.test.ts` **PASS** in default mode (`5 passed / 9 skipped`); the DB-mutating
real-Postgres block stayed skipped because `REAL_POSTGRES_DATABASE_URL` was not supplied. Current schema truth remains
43 tables through migration `0016_colorful_lyja` (which adds auth lockout columns but no table). Final gates observed this
phase: `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run secret:scan` **PASS**,
`npm run governance:check` **PASS** (0 errors / 1 known warning; 5 cited per-agent handoffs all present), and
`node scripts/gates.mjs full` **PASS** (9/9). Phase 3.46 aggregate:
[`docs/handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md`](handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md).
Still not production-ready: active real-Postgres auth/account race proof with operator credentials, production
nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring
remain **NOT RUN**.

_Latest update: 2026-06-02 - Phase 3.45 Registration audit._
Closed the next local auth audit gap without live server mutation or a migration. `@wtc/audit` now registers
`auth.register`, and the DB-backed public registration path opts into an in-transaction registration audit row from
`createUser()` after the user and roles are inserted. The audit payload is limited to non-secret metadata (`roles` and
`hasDisplayName`) and focused tests assert it does not retain password hashes or submitted email. Demo mode mirrors the same
event for local parity, while public registration copy remains generic and unchanged. Gates observed this session:
focused registration/auth Vitest **27 passed**, `npm run check:core` **PASS**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables,
no schema drift), `node scripts/gates.mjs full` **PASS** (9/9), `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
`npm run worker:smoke` **PASS**, final artifact scan **PASS** (`2` text files, `68` images, `0` blocked containers), final
`npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning; 7 cited
per-agent handoffs all present). Aggregate:
[`docs/handoffs/20260602-1045-phase-3-45-registration-audit.md`](handoffs/20260602-1045-phase-3-45-registration-audit.md).
Still not production-ready after Phase 3.45: active real-Postgres auth race proof with operator credentials, production
nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring
remain **NOT RUN**. The stale real-Postgres table-set assertion cleanup landed locally in Phase 3.46.

_Latest update: 2026-06-02 - Phase 3.44 Admin account unlock._
Closed the next local auth-hardening gap without live server mutation. `@wtc/auth` now exposes
`nextAdminUnlockState()`, `@wtc/db` owns `unlockUserLoginLockout()`, and the unlock transaction row-locks the target user,
clears failed-login counters, reset timestamps, `last_failed_login_at`, `account_locked_until`, and
`account_lockout_review_required_at`, then writes an in-transaction `auth.account_unlock` audit row with safe before/after
lockout state plus the admin reason. `adminUnlockAccountAction()` now follows the admin server-action guard stack
(`requireUser()` -> `assertAdmin()` -> `assertCsrf()` -> Zod), requires a target user UUID and 10-500 character reason,
and revalidates `/admin/users` plus `/admin/audit-log`. `/admin/users` now projects admin-safe lockout state only and renders
per-user unlock forms for locked or review-required accounts; public login copy remains the generic
`invalid_credentials` path. No migration was needed; `npm run db:generate -w @wtc/db` reported 43 tables and no schema drift.
Gates: focused admin-unlock/auth Vitest **82 passed / 9 skipped**, `npm run check:core` **PASS**,
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**,
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), `npm run worker:smoke` **PASS**, final artifact scan **PASS** (`2`
text files, `68` images, `0` blocked containers), final `npm run secret:scan` **PASS**, and final
`npm run governance:check` **PASS** (0 errors / 1 known warning; 7 cited per-agent handoffs all present). Aggregate:
[`docs/handoffs/20260602-0940-phase-3-44-admin-account-unlock.md`](handoffs/20260602-0940-phase-3-44-admin-account-unlock.md).
Still not production-ready: active real-Postgres admin-unlock race proof with operator credentials, production
nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring
remain **NOT RUN**. Registration audit landed locally in Phase 3.45.

_Latest update: 2026-06-02 - Phase 3.43 DB-backed account login lockout._
Closed the next local auth hardening gap without live server mutation. `@wtc/auth` now owns pure login-lockout policy math,
`users` has durable failed-login/lockout/review columns through migration `0016_colorful_lyja`, and `@wtc/db` owns the
transactional `attemptUserLogin()` path that row-locks the account, denies locked accounts before password verification,
increments failure state, resets state on success, and writes safe `auth.login_failed` audit rows. The web login action now
delegates to `attemptLogin()` and keeps wrong password, unknown account, and locked account outcomes on the same generic
`invalid_credentials` browser code. Gates: focused lockout/auth Vitest **17 passed / 8 skipped**, `npm run
check:core` **PASS**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**,
`node --check scripts/gates.mjs` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema drift), and
`node scripts/gates.mjs full` **PASS** (9/9; Vitest **824 passed / 9 skipped**), `node scripts/gates.mjs e2e` **PASS**
(`44 passed`), `npm run worker:smoke` **PASS**, final artifact scan **PASS**, final `npm run secret:scan` **PASS**, and
final `npm run governance:check` **PASS** (0 errors / 1 known warning; 7 cited per-agent handoffs all present). Aggregate:
[`docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`](handoffs/20260602-0903-phase-3-43-auth-account-lockout.md).
Still not production-ready: production nginx/shared-store auth throttling and trusted proxy proof, real-Postgres active
lockout race run with operator credentials, email notification/review workflow, append-only audit DB role, live production
deploy, and CI remain **NOT RUN**. Admin unlock UI/action landed locally in Phase 3.44; registration audit landed locally in
Phase 3.45.

_Latest update: 2026-06-02 - Phase 3.41 Axioma handoff preflight._
Closed the next local B4 readiness gap without production Axioma key material or Axioma network calls. `@wtc/axioma-bridge`
now owns a generated-key ES256/JWKS preflight helper that returns redacted token-shape evidence only, and `npm run
accept:axioma:handoff-preflight` exercises the generated-key path plus local journal-handoff and JTI consume handlers against
disposable PGlite. The command refuses `APP_ENV=production`, refuses pre-existing Axioma signing-key or bridge-token env
values, performs no `axi-o.ma` calls, fetches no installers, and does not enable terminal CTAs. Shared Axioma route readiness
now parses configured ES256 key material before reporting configured, and `check:core` now includes generated ES256/JWKS smoke
coverage. The retained-artifact scanner now rejects Axioma PEM/key/token/JWT/raw-claim/handoff-route evidence. Gates: focused
Axioma/scanner Vitest **72 passed**, `node --check scripts/axioma-handoff-preflight.mjs` **PASS**, `npm run check:core`
**PASS**, dry-run `npm run accept:axioma:handoff-preflight -- --dry-run` with temp evidence scan **PASS**,
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**,
`npm run worker:smoke` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes),
`node scripts/gates.mjs full` **PASS** (9/9; Vitest **806 passed / 8 skipped**), and `node scripts/gates.mjs e2e`
**PASS** (`44 passed`), final `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**, final `npm run secret:scan` **PASS**,
and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0808-phase-3-41-axioma-handoff-preflight.md`](handoffs/20260602-0808-phase-3-41-axioma-handoff-preflight.md).
Still not production-ready: live Axioma endpoint-shape/JWKS/handoff/download/account-link acceptance, production P-256 key
provisioning, service-token provisioning, live installer streaming/security acceptance, real-Postgres JTI race proof, browser
CTA enablement, and CI remain **NOT RUN**.

_Latest update: 2026-06-02 - Phase 3.40 Stripe checkout request preflight._
Closed the next local B2 checkout-readiness gap without Stripe credentials or provider network calls. `@wtc/billing` now owns
shared Stripe checkout helpers in `packages/billing/src/stripe-checkout.ts`: price-map parsing, test-mode config validation,
Checkout request/body construction, and redacted request summaries. The real Stripe provider now uses those shared request
builders, and the web checkout config path uses the shared price-map parser. A new guarded command,
`npm run accept:billing:stripe-checkout`, builds generated fake test-mode checkout requests in memory only, refuses
`APP_ENV=production` or a live `sk_live_` key, performs no Stripe API call, writes no pending-payment rows, and stores only
redacted count/status evidence. The retained-artifact scanner now rejects Stripe price IDs, Checkout endpoint paths, raw
request field names, secret keys, and Checkout Session IDs. Gates: focused billing/checkout Vitest **48 passed**,
`node --check scripts/billing-stripe-checkout-preflight.mjs` **PASS**, dry-run
`npm run accept:billing:stripe-checkout -- --dry-run` with temp evidence scan **PASS**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run worker:smoke` **PASS**, and
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes), `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), final `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**, final
`npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0751-phase-3-40-stripe-checkout-preflight.md`](handoffs/20260602-0751-phase-3-40-stripe-checkout-preflight.md).
Still not production-ready: real Stripe Checkout Session creation, Stripe CLI/Dashboard replay, Stripe test price
verification, pending-payment to active with provider events, production key provisioning, production endpoint registration,
live/staging route replay, and CI remain **NOT RUN**.

_Latest update: 2026-06-02 - Phase 3.39 Stripe webhook replay preflight._
Closed the next local B2 readiness gap without Stripe credentials or provider network calls. `@wtc/billing` now owns shared
Stripe replay fixture helpers in `packages/billing/src/stripe-replay.ts`, and a new guarded command,
`npm run accept:billing:stripe-webhook`, replays signed fake Stripe webhook fixtures through the extracted
`handleBillingWebhookRequest` path against disposable PGlite. The command uses `node --import tsx`, defaults to local
dry-run evidence, performs no Stripe CLI/Dashboard/checkout/network calls, refuses `APP_ENV=production`, and writes only
redacted count/status summaries. The retained-artifact scanner now rejects Stripe secret assignments/tokens, signature
headers/values, raw event bodies, and checkout session IDs. Gates: focused billing/replay Vitest **55 passed**,
`node --check scripts/billing-stripe-webhook-replay-preflight.mjs` **PASS**, dry-run
`npm run accept:billing:stripe-webhook -- --dry-run` with temp evidence scan **PASS**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run worker:smoke` **PASS**, and
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes), `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), final `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**, final
`npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md`](handoffs/20260602-0725-phase-3-39-stripe-webhook-replay-preflight.md).
Still not production-ready: Stripe CLI/Dashboard replay, real Stripe test checkout acceptance, production key provisioning,
production webhook endpoint registration, live/staging route replay, and CI remain **NOT RUN**.

_Latest update: 2026-06-02 - Phase 3.38 LMS live external scanner acceptance preflight._
Closed the next local live-scanner readiness gap without live scanner credentials. `@wtc/lms` now owns shared external scanner
config parsing, request construction, response parsing, normalized quarantine reasons, and injected-fetch scanning in
`packages/lms/src/external-scanner.ts`; the web LMS upload path reuses those helpers while preserving scanner-before-storage
ordering and fail-closed behavior. A new guarded preflight command, `npm run accept:lms:external-scanner`, defaults to
dry-run/no-network and writes only redacted summary evidence; live mode refuses to run unless `LMS_FILE_SCANNER_MODE=external`,
public uploads remain disabled, `LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1`, and `LMS_FILE_SCANNER_LIVE_EICAR=1` are present. The
generated-artifact scanner now rejects retained scanner request/response evidence such as live scanner consent envs, scanner
request headers, `application/octet-stream`, and provider JSON verdict bodies. Gates: focused scanner/preflight Vitest
**44 passed**, `node --check scripts/lms-external-scanner-live-preflight.mjs` **PASS**, dry-run
`npm run accept:lms:external-scanner -- --dry-run` with temp evidence scan **PASS**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run worker:smoke` **PASS**,
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes), initial `npm run governance:check` **PASS**
(0 errors / 1 known warning), initial `npm run secret:scan` **PASS**, and initial `node scripts/scan-lms-db-e2e-artifacts.mjs`
**PASS**, `node scripts/gates.mjs full` **PASS** (9/9), `node scripts/gates.mjs e2e` **PASS** (`44 passed`), final
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers), final
`npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0659-phase-3-38-lms-external-scanner-live-preflight.md`](handoffs/20260602-0659-phase-3-38-lms-external-scanner-live-preflight.md).
Still not production-ready: live external malware-scanner acceptance itself was **NOT RUN** because no operator-approved
endpoint/token was supplied; live S3/R2 acceptance, observed DB-backed browser acceptance, cleanup/reconcile live acceptance,
and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.37 LMS live S3/R2 acceptance preflight._
Closed the next local live-object-store readiness gap without live bucket credentials. `@wtc/lms` object-storage tests now pin
deterministic exact SigV4 golden values for PUT, DELETE, and signed read URL construction, including payload hashes, dates,
authorization headers, and canonical query ordering. A new guarded preflight command, `npm run accept:lms:object-storage`,
defaults to dry-run/no-network and writes only redacted summary evidence; live mode refuses to run unless
`LMS_FILE_STORAGE_PROVIDER=s3-r2`, public uploads remain disabled, `LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1`, and
`LMS_OBJECT_STORAGE_LIVE_THROWAWAY=1` are present. The generated-artifact scanner now rejects object-store env assignments,
signed object authorization/header material, and S3/R2 provider body/request-id markers before any retained live evidence can
be archived. Gates: focused LMS/storage/preflight Vitest **103 passed**, `node --check
scripts/lms-s3-r2-live-preflight.mjs` **PASS**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`npm run lint` **PASS**, `npm run worker:smoke` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema
changes), initial `npm run secret:scan` **PASS**, initial `npm run governance:check` **PASS** (0 errors / 1 known warning),
initial `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers),
`node scripts/gates.mjs full` **PASS** (9/9), `node scripts/gates.mjs e2e` **PASS** (`44 passed`), final
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**, final `npm run secret:scan` **PASS**, and final
`npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md`](handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md).
Still not production-ready: live S3/R2 upload/download/delete/reconcile acceptance itself was **NOT RUN** because no
operator-approved throwaway credentials were supplied; live external malware-scanner acceptance, observed DB-backed browser
acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.36 LMS cleanup dead-letter acknowledgement/retry._
Closed the next local LMS cleanup operations gap without live object-store credentials. Migration `0015_wet_cobalt_man.sql`
adds durable dead-letter acknowledgement metadata to the private `lms_object_cleanup_tasks` table while keeping
`completed` reserved for confirmed cleanup. The DB repository now supports guarded aggregate admin operations for acknowledging
the current unacknowledged dead-letter cohort and retrying the current acknowledged cohort; both actions compare expected
count/latest timestamp snapshots before mutating, write summary-only admin audit rows, and never project cleanup task IDs or
object keys. Retry only requeues rows for the worker by setting `status='pending'` and `run_after=now`; object DELETE remains
worker-owned, and retry preserves the failure attempt count. `/admin/system-health` now shows acknowledged counts and compact
CSRF-protected aggregate controls with no row browser. The artifact scanner now rejects cleanup task identifier field names.
Gates: focused Phase 3.36 Vitest **28 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run worker:smoke` **PASS**, and
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes after migration), initial
`npm run governance:check` **PASS** (0 errors / 1 known warning), initial `npm run secret:scan` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers),
final `npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md`](handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md).
Still not production-ready: live S3/R2 upload/download/delete/reconcile acceptance, live external malware-scanner acceptance,
observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.35 LMS shared object-storage primitives._
Closed the next local LMS object-store drift gap without live bucket credentials. `@wtc/lms` now owns shared S3/R2 object
storage config validation plus signed PUT, DELETE, and read URL request builders in `packages/lms/src/object-storage.ts`.
The web LMS storage boundary now uses those builders for object upload, compensation delete, and signed download redirects;
the worker object cleanup path uses the same shared DELETE builder. The shared helpers take explicit env/config input and do
not read DB, audit, logs, React, Next, or `@wtc/config`; web and worker still own fetch/error mapping. Static tests now guard
against reintroducing SigV4 signing/config duplication into app files. No migration was needed; schema remains **43 tables**.
Gates: focused Phase 3.35 Vitest **24 passed**, broader focused LMS/config/worker/scanner Vitest **73 passed**,
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**,
`npm run worker:smoke` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes),
initial `npm run governance:check` **PASS** (0 errors / 1 known warning), initial `npm run secret:scan` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers),
final `npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md`](handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md).
Still not production-ready: live S3/R2 upload/download/delete/reconcile acceptance, live external malware-scanner acceptance,
observed DB-backed browser acceptance, dead-letter acknowledgement/retry workflow, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.34 LMS cleanup dead-letter ops review._
Closed the next local LMS upload cleanup operations gap without adding live object-store dependencies or row-level object
browsing. The DB layer now exposes a count-only `summarizeLmsObjectCleanupOperations()` projection for pending and
dead-lettered `lms_object_cleanup_tasks` without selecting cleanup task IDs or storage keys. Dead-letter transitions now write
a summary-only `education.material_cleanup` audit event with provider, scope, count, and generic error code only. Admin
system health now projects LMS pending cleanup count fields, renders worker `error` as a bad heartbeat state, and includes a
first-class "LMS upload cleanup review" card with dead-letter, due retry, scheduled retry, latest dead-letter timestamp, and
generic error-code summary. The admin surface explicitly hides cleanup task IDs, object keys, filenames, hashes, signed URLs,
scanner details, and provider response bodies. No migration was needed; schema remains **43 tables**. Gates: focused
Phase 3.34 Vitest **51 passed**, broader focused LMS/admin/worker/scanner Vitest **94 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run lint` **PASS**, `npm run worker:smoke` **PASS**, and
`npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes), `npm run governance:check` **PASS** (0 errors /
1 known warning), `npm run secret:scan` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text
files, `68` images, `0` blocked containers), final `npm run secret:scan` **PASS**, and final `npm run governance:check`
**PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md`](handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md).
Still not production-ready: dead-letter acknowledgement/retry workflow, shared object-store primitives, live S3/R2
upload/download/delete/reconcile acceptance, live external malware-scanner acceptance, observed DB-backed browser acceptance,
and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.33 LMS durable upload cleanup boundary._
Closed the next local LMS object lifecycle gap without live object-store credentials. Migration `0014_lazy_puff_adder.sql`
adds the private `lms_object_cleanup_tasks` table, bringing the local schema to **43 tables**. Clean `s3-r2` uploads now
register an internal cleanup task before object PUT; successful material creation completes that task in the same DB
transaction that inserts the material and writes the upload audit. If material creation fails, the Phase 3.32 compensation
DELETE still runs; successful compensation completes the task, while failed compensation records a generic retry failure and
backoff. The worker now has a separate pending-upload cleanup pass for objects with no material row: signed DELETE 2xx/404
completes tasks, failures increment attempts, and max-attempt failures dead-letter with count-only health. Retry rows store
only provider, opaque storage key, reason/status, attempts/run-after, timestamps, and generic error code; audits, health,
worker output, scanner fixtures, and docs stay free of object keys, filenames, hashes, signed URLs, auth headers, scanner
details, and provider response bodies. Gates: focused Phase 3.33 Vitest **68 passed**, broader focused
LMS/config/worker/scanner Vitest **134 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`npm run worker:smoke` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (43 tables, no schema changes after migration),
initial `npm run governance:check` **PASS** (0 errors / 1 known warning), `node scripts/gates.mjs full` **PASS** (9/9),
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text
files, `68` images, `0` blocked containers), final `npm run secret:scan` **PASS**, and final `npm run governance:check`
**PASS** (0 errors / 1 known warning).
Aggregate: [`docs/handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md`](handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md).
Still not production-ready: shared object-store primitives, dead-letter operational review/alerting, live S3/R2
upload/download/delete/reconcile acceptance, live external malware-scanner acceptance, observed DB-backed browser acceptance,
and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.32 LMS upload compensation boundary._
Closed the next local LMS object lifecycle gap without live object-store credentials. When a clean `s3-r2` file upload has
already written an object but material DB creation later fails, `createMaterialAction` now delegates through a testable
orchestrator that attempts a best-effort signed object `DELETE` and then preserves the original DB/material creation error.
The delete helper treats 2xx and already-absent `404` as reconciled, signs `DELETE` without exposing object-store secrets, and
only compensates actually-written clean `s3-r2` file inputs; quarantined metadata-only rows remain no-op under the Phase 3.30
no-standard-object-write invariant. This is local best-effort compensation only: a failed compensation delete can still orphan
an object because no durable pending-row/outbox/staging-key retry exists yet. Gates: focused helper/storage/static Vitest
**42 passed**, broader focused LMS/config/worker/scanner Vitest **123 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run worker:smoke` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9),
env-cleared `node scripts/gates.mjs e2e` **PASS** (`40 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**
(`2` text files, `68` images, `0` blocked containers), final `npm run secret:scan` **PASS**, and final
`npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md`](handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md).
Still not production-ready: durable pending-row/outbox/staging-key retry for failed compensation or process interruption,
shared object-store primitives, live S3/R2 upload/download/delete/reconcile acceptance, live external malware-scanner
acceptance, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.31 LMS object-store cleanup/reconciliation boundary._
Closed the next local LMS object lifecycle slice without live object-store credentials. The worker now has a separate
`s3-r2` cleanup/reconciliation path for expired file rows: DB selection identifies eligible object rows, clean soft-deleted
rows are hard-deleted only after a mocked SigV4 `DELETE` succeeds or returns already-absent `404`, and unsafe non-clean
metadata-only rows are purged without remote object calls under the Phase 3.30 no-standard-object-write invariant. Worker
health and one-shot output now expose count-only object cleanup fields for scanned, delete-attempted, delete-confirmed,
metadata-only-purged, rows purged, and failures; failed remote deletes retain retryable DB rows and set worker health to
`error` without logging object keys. Runtime upload storage now rejects local providers in `APP_ENV=staging`, matching typed
public-upload config. The generated-artifact scanner test suite now explicitly rejects object-cleanup evidence containing raw
`lms/materials/` keys, auth headers, or signed query tokens. Gates: focused LMS/config/worker/scanner Vitest **91 passed**,
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `npm run worker:smoke` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers), final
`npm run secret:scan` **PASS**, and final `npm run governance:check` **PASS** (0 errors / 1 known warning).
Aggregate:
[`docs/handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md`](handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md).
Still not production-ready: object PUT success followed by DB insert failure still needs compensating delete/outbox design,
live S3/R2 upload/download/delete/reconcile acceptance, live external malware-scanner acceptance, observed DB-backed browser
acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.30 LMS external malware scanner adapter boundary._
Closed the next local LMS public-upload safety slice without live scanner credentials. `LMS_FILE_SCANNER_MODE=external` now
requires `LMS_FILE_SCANNER_ENDPOINT`, `LMS_FILE_SCANNER_TOKEN`, and an optional bounded `LMS_FILE_SCANNER_TIMEOUT_MS`;
scanner endpoints must be HTTPS URLs without embedded credentials, query strings, or fragments. The upload pipeline validates
storage config, calls the external scanner before any storage write, sends only raw bytes plus MIME/size headers, and collapses
non-2xx, malformed, failed, or timed-out scanner responses into `lms_file_scan_failed` without object writes. Clean external
verdicts may proceed to storage; quarantined `s3-r2` verdicts create non-downloadable metadata rows but do not write unsafe
bytes to the standard object bucket. Upload audit payloads now keep scanner/vendor detail out by using `hasQuarantineReason`
instead of raw `quarantineReason`, and the generated-artifact scanner rejects `LMS_FILE_SCANNER_ENDPOINT=` and
`LMS_FILE_SCANNER_TOKEN=` assignments. Gates: focused LMS/config/scanner Vitest **76 passed**, `npm run typecheck`
**PASS**, `npm run typecheck -w @wtc/web` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9),
env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), `node scripts/scan-lms-db-e2e-artifacts.mjs`
**PASS** (`2` text files, `68` images, `0` blocked containers), final `npm run secret:scan` **PASS**, and final
`npm run governance:check` **PASS** (0 errors / 1 known warning). Aggregate:
[`docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`](handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md).
Still not production-ready: live external malware scanner acceptance, live S3/R2 upload/download acceptance, object-store
delete/reconciliation cleanup, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.29 LMS S3/R2 object-storage adapter boundary._
Closed the next local LMS production-storage boundary slice without live cloud credentials. `LMS_FILE_STORAGE_PROVIDER=s3-r2`
is now a first-class provider with fail-closed typed env requirements for HTTPS endpoint, bucket, region, access key id, and
secret access key. The web storage boundary can PUT uploads to an S3/R2-compatible path-style object endpoint using SigV4,
keeps storage keys as opaque `lms/materials/<id>` values, and persists no inline DB bytes for object-store rows. Downloads now
resolve a bytes-or-redirect delivery union: local providers stream bytes as before, while `s3-r2` rows produce a short-lived
signed redirect only after method, session, entitlement, clean published-row lookup, and storage resolution all pass. The
teacher upload action now proves lesson/course ownership before any external object write. Repository writes reject unknown
storage providers, and the generated-artifact scanner rejects signed URL tokens such as `X-Amz-Signature`.
Gates: focused LMS/config/scanner Vitest **82 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web`
**PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
and `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers). Aggregate:
[`docs/handoffs/20260602-0317-phase-3-29-lms-s3-r2-object-storage-boundary.md`](handoffs/20260602-0317-phase-3-29-lms-s3-r2-object-storage-boundary.md).
Still not production-ready: live S3/R2 upload/download acceptance, external malware scanner implementation/acceptance,
object-store delete/reconciliation cleanup, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.28 LMS DB artifact dynamic marker manifest._
Closed the next local LMS evidence-hardening slice for the guarded DB browser runner. `npm run e2e:lms:db` now creates a
transient `.next-e2e-db/lms-db-e2e-dynamic-markers.json`, exposes it only through `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, and deletes
it in `finally` so it is not an archive artifact. The DB browser spec appends per-project dynamic leak markers for uploaded
file body, quarantined body, uploaded filename, file SHA-256, and raw embed HTML. The artifact scanner now fails closed when a
configured manifest is missing/malformed, scans dynamic marker values and their base64 encodings, and reports only safe labels,
never matched values. Gates: focused scanner/harness Vitest **17 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**
(`2` text files, `68` images, `0` blocked containers, `0` dynamic markers because this was not the opt-in DB runner). Aggregate:
[`docs/handoffs/20260602-0301-phase-3-28-lms-db-dynamic-artifact-markers.md`](handoffs/20260602-0301-phase-3-28-lms-db-dynamic-artifact-markers.md).
Still not production-ready: real S3/R2 storage, signed redirects, external malware scanning, object-store delete/reconciliation
cleanup, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.27 LMS filename minimization._
Closed the next local LMS no-leak slice. Successful material downloads now use MIME-derived generic attachment names such as
`lesson-material.txt` instead of the uploaded filename, and success tests assert the original filename is absent from
`Content-Disposition`. LMS material upload/download audit payloads no longer include `fileName` or `mimeType`, while DB-private
file name/MIME columns remain for storage/download validation. `TeacherMaterialView` no longer extends the student-safe DTO
with display filename metadata, `toTeacherMaterialView()` stays filename-free, and teacher course/material pages render generic
file labels plus size/scan state. The LMS DB artifact scanner now rejects `fileName` and `mimeType` metadata markers in
generated text artifacts. Gates: focused LMS/scanner Vitest **66 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS**
(`2` text files, `68` images, `0` blocked containers). Aggregate:
[`docs/handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md`](handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md).
Still not production-ready: real S3/R2 storage, signed redirects, external malware scanning, object-store delete/reconciliation
cleanup, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.26 LMS opaque keys and no hash header._
Closed the next local LMS hash/key hygiene slice. New LMS material storage keys are generated with `node:crypto.randomUUID()`
as a single opaque segment under `lms/materials/`; the active upload paths no longer derive keys from filenames or content
hashes, and identical local uploads now have regression coverage proving different opaque keys. Successful material downloads
do not emit `x-lms-sha256`, focused/browser-source assertions pin that absence, and the LMS DB artifact scanner now rejects
the deprecated header in generated text artifacts. Upload/download audit payloads keep raw content digests out by using
`hasContentHash`, while server-private `contentSha256` remains for DB-local/fs-local integrity checks. Gates: focused
LMS/scanner Vitest **49 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** (`2` text files, `68` images, `0` blocked containers). Aggregate:
[`docs/handoffs/20260602-0227-phase-3-26-lms-opaque-keys-no-hash-header.md`](handoffs/20260602-0227-phase-3-26-lms-opaque-keys-no-hash-header.md).
Still not production-ready: real S3/R2 storage, signed redirects, external malware scanning, object-store delete/reconciliation
cleanup, observed DB-backed browser acceptance, and public upload rollout remain open.

_Latest update: 2026-06-02 - Phase 3.25 LMS storage adapter boundary._
Closed the next local LMS storage-boundary slice. Migration `0013_young_martin_li.sql` relaxes the material payload CHECK so
`db-local` file rows still require inline bytes while non-`db-local` rows can be metadata/key-only. The web upload path now
runs through a server storage helper with `db-local` as the default and `fs-local` as an explicit local object-style adapter
requiring `LMS_FILE_STORAGE_ROOT`; production upload attempts fail closed for local-only providers. Downloads now resolve bytes
through the storage boundary: DB-local streams verified DB bytes, `fs-local` reads by jailed storage key/root, and unsupported
providers return a generic 404 without a download audit. Typed config and `.env.example` document the local-only providers,
scanner mode, and disabled public upload flag. Gates: focused LMS/config Vitest **80 passed**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** on current
generated roots. Aggregate:
[`docs/handoffs/20260602-0207-phase-3-25-lms-storage-adapter-boundary.md`](handoffs/20260602-0207-phase-3-25-lms-storage-adapter-boundary.md).
Still not production-ready: real S3/R2 object storage, signed-object redirects, opaque production object keys, external
malware scanner, object-store delete/reconciliation cleanup, observed DB-backed browser acceptance, and public upload rollout
remain open.

_Latest update: 2026-06-02 - Phase 3.24 LMS local material cleanup worker._
Closed the local DB-backed LMS material cleanup slice. `@wtc/db` now has a `db-local`-only material cleanup primitive that
hard-deletes expired file rows only when they are already soft-deleted or unsafe (`pending` / `quarantined` / `failed`), and
only when the storage key has the local `lms/materials/` prefix. The cleanup writes a summary-only
`education.material_cleanup` system audit event with count/cutoff/provider only, and the worker DB tick reports
`lmsMaterialsPurged` in health detail and one-shot output. Gates: focused LMS/worker Vitest **34 passed**,
`npm run worker:smoke` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), and `node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** on current
generated roots. Aggregate:
[`docs/handoffs/20260602-0144-phase-3-24-lms-material-cleanup.md`](handoffs/20260602-0144-phase-3-24-lms-material-cleanup.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, object-store delete/reconciliation cleanup, live Stripe replay, live Axioma acceptance, and managed
worker deployment remain open.

_Latest update: 2026-06-02 - Phase 3.23 LMS DB browser managed runner._
Closed the next local LMS acceptance-readiness slice. The actual `npm run e2e:lms:db` browser gate is still not RUN: this session has
no `LMS_E2E_DATABASE_URL`, no `REAL_POSTGRES_DATABASE_URL`, no `DATABASE_URL`, no `psql`/Docker CLI, and common local
Postgres credentials failed even though `127.0.0.1:5432` is listening. Added a managed wrapper, `npm run e2e:lms:db:managed`,
which accepts an operator-provided `LMS_E2E_ADMIN_DATABASE_URL`, creates a fresh `wtc_test_lms_*` database, delegates to the
existing guarded DB browser runner, and drops the generated DB in `finally` without printing URLs. The prep/config DB-name
guard now accepts documented multi-segment names such as `wtc_test_lms_<timestamp>`. Gates: focused LMS harness/scanner
Vitest **15 passed**, `node --check scripts/run-lms-db-e2e-managed.mjs` **PASS**, `node scripts/gates.mjs full` **PASS**
(9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` **PASS** on current generated roots. Aggregate:
[`docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md`](handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-02 - Phase 3.22 LMS material DTO boundary hardening._
Closed the local LMS material projection slice without touching live services or databases. `MaterialView` is now the
student-safe material DTO and no longer carries filename/MIME or storage/audit lifecycle fields; teacher/admin material
management uses `TeacherMaterialView` for display-only `fileName` and `mimeType`. Student lesson loading stays on the
student mapper, teacher course/material lists use the teacher mapper, and admin audit rendering is pinned to summary-only
payload-free fields. Gates: focused Vitest **66 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web`
**PASS**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`),
and `node scripts/scan-lms-db-e2e-artifacts.mjs` against current generated roots **PASS** (`2` text files, `68` images,
`0` blocked containers). `npm run e2e:lms:db` remains **NOT RUN** because no fresh throwaway
`LMS_E2E_DATABASE_URL` was supplied. Final governance after the aggregate exists is **PASS** (0 errors / 1 known historical warning). Aggregate:
[`docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`](handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-02 - Phase 3.21 LMS DB no-leak assertion hardening._
Tightened the local LMS DB browser acceptance source/spec layer without touching live services or databases. The opt-in DB
browser spec now checks failed download bodies and headers for no file bytes/base64, filename, content hash, storage metadata,
success-only headers, `set-cookie`, and non-JSON content type on `401`/`403`/`400` paths; admin/rendered pages now assert no
internal material metadata such as `contentSha256`, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`,
`deletedAt`, or `hasStorageKey`; sanitized iframe assertions now pin sandbox, no-referrer, lazy loading, allowlist,
fullscreen, and absent `srcdoc`. The artifact scanner now rejects those internal metadata markers plus session-cookie and
lowercase/JSON auth-header forms, and handler integration tests now assert failed paths do not leak or audit. Gates: focused
Vitest **61 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` against current generated roots **PASS**. `npm run e2e:lms:db` remains
**NOT RUN** because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied. Aggregate:
[`docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`](handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-02 - Phase 3.20 LMS DB e2e artifact no-leak scanner._
Added a dedicated LMS DB browser artifact scanner and wired it into the opt-in `npm run e2e:lms:db` runner. The scanner
checks generated artifact roots only (`test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`),
fails on LMS file-byte/base64/storage-key/raw-iframe markers and secret-shaped runtime values, skips screenshot image bytes,
fails closed on compressed/container artifacts, and prints only file/category summaries rather than matched values. The runner
now runs the scanner after any Playwright attempt, including failed attempts, while preserving the original Playwright failure
status. Gates: focused Vitest **60 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and
`node scripts/scan-lms-db-e2e-artifacts.mjs` against current generated roots **PASS**. `npm run e2e:lms:db` remains
**NOT RUN** because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied. Aggregate:
[`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`](handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-01 - Phase 3.19 LMS DB browser negative/embed acceptance hardening._
Extended the opt-in LMS DB-backed browser acceptance harness without touching live services or databases. The DB browser spec
now covers unauthenticated download `401`, non-entitled teacher download `403`, quarantined-file no-download UI, sanitized
Vimeo iframe rendering, raw embed/no byte/base64/storage-key leakage, invalid material-ID no-store `400`, clean-file
headers/body/hash, mobile no-horizontal-scroll artifact capture, and admin audit visibility. The runner now requires
`LMS_E2E_DATABASE_URL` explicitly (`REAL_POSTGRES_DATABASE_URL` is reserved for the separate real-PG Vitest harness), cleans
the prep marker after execution, and documents the artifact set for an accepted run. Focused Vitest **54 passed**,
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, `node scripts/gates.mjs full` **PASS** (9/9),
and env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`).
`npm run e2e:lms:db` remains **NOT RUN** because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied. Aggregate:
[`docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`](handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md).
Still not production-ready: actual observed DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-01 - Phase 3.18 LMS DB browser acceptance harness._
Closed the next local LMS acceptance-harness slice without touching live services or databases. Added an opt-in
`npm run e2e:lms:db` path that prepares a fresh empty throwaway Postgres database (`wtc_test` / `wtc_test_*`) by applying
committed migrations plus `seedDatabase()`, writes a prep marker, then runs a dedicated Playwright config on port 3101 against
`tests/e2e/lms-db-materials.spec.ts`. Direct Playwright config invocation now fails closed unless the guarded prep marker and
URL HMAC match. The DB browser spec creates a teacher course/lesson/material through the UI, verifies student download headers
and hash, checks no byte/base64/storage-key leakage in rendered pages, asserts malformed material IDs return no-store `400`,
and checks admin audit visibility. Additional hardening landed: server-action upload size preflight before `arrayBuffer()`,
explicit CSP `frame-src` for the LMS embed allowlist, localhost-only `/api/e2e/login`, and UUID validation before material
download DB lookup. Focused Vitest **52 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), and env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`).
`npm run e2e:lms:db` was **NOT RUN** because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied. Aggregate:
[`docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`](handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md).
Still not production-ready: actual DB-backed browser acceptance run, real object storage, production malware scanner,
signed-object redirects, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-01 - Phase 3.17 LMS storage/scan/retention metadata._
Closed the next local LMS upload hardening slice without touching live services. Migration `0012_old_maelstrom.sql` adds
`materials.storage_provider`, non-public `storage_key`, `scan_status`, `scan_checked_at`, `quarantine_reason`,
`retained_until`, and `deleted_at`, and backfills existing file rows as `db-local` clean local rows before applying the new
lifecycle check. `@wtc/lms` now prepares file materials with deterministic storage keys, byte-level PDF/PNG/JPEG sniffing,
local scan/quarantine results, and 365-day retention metadata. `@wtc/db` soft-deletes materials, hides deleted rows from
lists/downloads, and only returns downloadable files when the row is active, published, hash-valid, and `scan_status='clean'`.
Teacher/student LMS surfaces show scan state but do not expose storage keys; file download URLs are exposed only for clean
files. Focused Vitest **55 passed**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and final
governance **PASS** (0 errors / 1 known historical warning). Aggregate:
[`docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`](handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md).
Still not production-ready: real object storage, production malware scanner, signed-object redirects, DB-backed browser
upload/download acceptance, live Stripe replay, live Axioma acceptance, and managed worker deployment remain open.

_Latest update: 2026-06-01 - Phase 3.16 worker local smoke and heartbeat monitoring._
Worker deployment readiness advanced locally without touching live services. Added `npm run worker:smoke`, which forces
`APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, and live-control/TV-automation flags off before running one worker tick
(`--memory-demo` when `DATABASE_URL` is absent). DB worker ticks now write a `worker` heartbeat with adapter mode and safety
flags, unsafe flags mark the heartbeat `misconfigured`, and core tick failures attempt to write a redacted `worker` error
row before rethrowing. `/admin/system-health` now surfaces the latest worker heartbeat, redacts/projects
`integration_health_checks.detail` before rendering, and lists newest checks first. Focused Vitest **36 passed**,
`npm run worker:smoke` **PASS**, `npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**,
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and
final governance **PASS** (0 errors / 1 known historical warning).
This is not a managed preview/production worker deployment; persistent process management and monitoring remain
operator-approved deployment work. Aggregate:
[`docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`](handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md).

_Latest update: 2026-06-01 - Phase 3.15 LMS local file/embed storage._
Closed the local LMS upload/embed blocker slice without touching live services. Migration `0011_late_madelyne_pryor.sql`
adds `lessons.embed_html`, DB-backed material file byte fields, material embed storage, material-kind/payload checks, and a
lesson embed payload check. `@wtc/lms` now owns the file policy and the allowlisted iframe sanitizer; `@wtc/db` stores only
canonical sanitized embed HTML and base64 file bytes with SHA-256 metadata. Teacher flows can create link/file/embed materials
and sanitized embed lessons; student flows render sanitized iframe props without `dangerouslySetInnerHTML` and download file
materials through `GET /api/education/materials/[materialId]/download` after session, entitlement, published-course, and audit
checks. Gates: focused Vitest **49 passed**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), final governance **PASS** (0 errors / 1 known historical warning),
`npm run typecheck` **PASS**, `npm run typecheck -w @wtc/web` **PASS**, and `npm run db:generate -w @wtc/db` **PASS**
(`42 tables`, no schema changes after generation). Aggregate:
[`docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`](handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md).
Still not production-ready: production object storage, malware scan/quarantine, retention policy, live Stripe replay, live
Axioma acceptance, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.14 Axioma account-link route handlers._
Closed the local account-link HTTP route slice on top of Phase 3.13 persistence. WTC now has extracted, testable handlers and
thin Next adapters for `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and
`DELETE /api/axioma/account-link`. Init is CSRF/session/entitlement/readiness gated, returns the raw OTC once, and stores only
the SHA-256 `link_nonce_hash`. Complete is service-bearer/JSON-body only, rejects any query string, re-checks the pending row
owner's current `axioma_terminal` entitlement before consume, and maps replay/expired/revoked/duplicate cases without raw
OTC/hash leakage. DELETE revokes pending/linked rows through the DB helper and audits repeat empty revokes. Terminal CTAs remain
disabled. Gates: focused Vitest **52 passed / 1 skipped**, `npm run typecheck` **PASS**,
`npm run typecheck -w @wtc/web` **PASS**, `npm run db:generate -w @wtc/db` **PASS** (`42 tables`, no schema changes),
`node scripts/gates.mjs full` **PASS** (9/9), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and final
governance **PASS**. Aggregate:
[`docs/handoffs/20260601-2117-phase-3-14-axioma-account-link-routes.md`](handoffs/20260601-2117-phase-3-14-axioma-account-link-routes.md).
Still not production-ready: live Axioma endpoint-shape/JWKS/consume/download/account-link acceptance, OP key provisioning,
live installer streaming, live Stripe replay, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.13 Axioma account-link hash/uniqueness persistence._
Closed the next local-only Axioma account-link hardening slice after phase 3.12. Migration
`0010_axioma_account_link_hash.sql` adds hash-only account-link OTC persistence fields, consume/revoke/link timestamps,
and partial active-link uniqueness indexes for WTC users and Axioma user ids. The migration also clears legacy plaintext
`one_time_code` values and revokes pending legacy rows instead of preserving raw OTC. `@wtc/db` now has repository helpers
for issuing canonical SHA-256-hex OTC hashes, revoking prior pending codes on reissue, consuming exactly once with audit,
and deterministic linked-account reads; `POST /api/axioma/journal-handoff` now uses that linked-account helper. Terminal CTAs
remain disabled. Gates: focused Vitest **20 passed**, `node scripts/gates.mjs full` **PASS** (9/9; full Vitest
**657 passed / 8 skipped**), env-cleared `node scripts/gates.mjs e2e` **PASS** (`44 passed`), and final governance **PASS**.
Aggregate:
[`docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md`](handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md).
Still not production-ready: account-link routes/handlers, live Axioma endpoint-shape/JWKS/consume/download acceptance, OP key
provisioning, live installer streaming, live Stripe replay, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.12 Axioma download token/proxy local acceptance._
Closed the next local-only Axioma readiness slice after phase 3.11. `POST /api/axioma/download` now issues a five-minute,
one-time WTC download URL after CSRF/auth/entitlement/readiness checks, stores only a SHA-256 token hash in
`terminal_download_events`, and records `axioma.download_request` audit without raw token material. The
`GET /api/axioma/download/terminal?token=...` path now consumes the hash atomically and streams only through an injected installer
provider in tests; the runtime Next adapter still has no live installer fetcher and returns fail-closed `501` without
consuming the token. Migration `0009_wide_orphan.sql` adds the token lifecycle columns/indexes. Terminal CTAs remain disabled.
Gates: focused Vitest **35 passed / 1 skipped**, `node scripts/gates.mjs full` **PASS** (9/9), env-cleared
`node scripts/gates.mjs e2e` **PASS** (`44 passed`), and final governance **PASS**. Aggregate:
[`docs/handoffs/20260601-2013-phase-3-12-axioma-download-token-proxy.md`](handoffs/20260601-2013-phase-3-12-axioma-download-token-proxy.md).
Still not production-ready: live Axioma endpoint-shape/JWKS/consume/download acceptance, OP key provisioning, account-link
OTC hash migration/uniqueness, live installer streaming, live Stripe replay, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.11 journal handoff route acceptance._
Closed the next local-only Axioma readiness slice after phase 3.10. `POST /api/axioma/journal-handoff` now uses a
framework-neutral request handler with injected CSRF/auth/access/DB/env/clock dependencies, while the Next route is a thin
adapter. Handoff issuance now records the JTI and `axioma.account_link_init` audit row atomically in one DB transaction,
requires a linked Axioma account before `open_journal` signing, preserves POST-body/no-query-token delivery, and emits grace
snapshots using the `graceUntil` access window. Terminal CTAs remain disabled. Gates: focused Vitest **29 passed / 1 skipped**,
`node scripts/gates.mjs full` **PASS** (9/9), and env-cleared Playwright e2e **44 passed / 6 skipped**. `db:generate` reports
**42 tables** and no schema changes. Aggregate:
[`docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`](handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md).
Still not production-ready: live Axioma endpoint-shape/JWKS/consume/download acceptance, OP key provisioning, account-link OTC
hash migration/uniqueness, download proxy/token security, live Stripe replay, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.10 local B4 consume + TradingView task uniqueness._
Closed the next local-only readiness slice after phase 3.9. TradingView manual revoke tasks now have a database-backed
logical identity: migration `0008_eminent_tattoo.sql` dedupes historical `(request_id, kind)` rows, preserves unfinished
tasks first, and creates `tvat_request_kind_idx`; both sweep and repair insert paths are conflict-safe. Axioma now has a
fail-closed WTC-side `POST /api/axioma/jti/consume` handler with bearer service-token auth, UUID validation, no-store
responses, DB-backed single-use consume, and `axioma.handoff_jti_consume` / `_replay` audit rows. Docs now match current
audit names, JWKS 503/no-store behavior, current ES256 env names, and local consume-route state. Gates:
targeted Vitest **38 passed / 1 skipped**, `node scripts/gates.mjs full` **PASS** (9/9), and final env-cleared
Playwright e2e rerun **44 passed / 6 skipped** after one transient `ECONNRESET` on `/api/e2e/login` in the first e2e run.
`db:generate` reports **42 tables** and no schema changes. Aggregate:
[`docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`](handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md).
Still not production-ready: live Stripe replay, throwaway real-Postgres race acceptance, Axioma endpoint-shape/OP-key
confirmation, live consume/download acceptance, account-link OTC hash migration, and enabled terminal CTAs remain open.

_Latest update: 2026-06-01 - Phase 3.9 route harness + repair/config readiness._
Closed the next local readiness slice after phase 3.8. Stripe webhook processing now lives behind a testable extracted
handler, with signed Request coverage for missing/bad signatures, apply, terminal duplicates, in-flight duplicates, stale
`processing` cleanup, and manual-review paths. TradingView worker ticks now repair historical `expired_by_worker` revokes
that missed an external manual revoke task. Axioma production config no longer requires the unused HS256 dev-stub secret;
JWKS readiness now uses one parseable-key helper shared by the terminal loader and public route; handoff claims now carry the
actual entitlement snapshot and linked Axioma user id when present. Terminal CTAs remain fail-closed. Local gates:
`node scripts/gates.mjs full` **PASS**; Playwright e2e **44 passed / 6 skipped**. No live Stripe, Axioma, TradingView, bot,
exchange, SSH, tmux, systemd, preview-worker, or production service was touched. Aggregate:
[`docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`](handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md).
Still not production-ready: real Stripe replay, Axioma B4 activation, endpoint-shape confirmation, real/throwaway Postgres
acceptance, and optional TradingView task uniqueness hardening remain open.

_Latest update: 2026-06-01 - Phase 3.8 integration safety + Axioma handoff honesty._
Closed the next local safety slice after phase 3.7. Stripe webhook ledger rows now start as non-terminal `processing`
and duplicate deliveries are acknowledged only after a terminal ledger state is present. TradingView expiry sweeps now
queue the external manual revoke task inside the same revoke transaction. Axioma handoff tokens now use `typ: JWT`,
Unix-second `iat`/`nbf`/`exp`, documented `wtc_*` claims, a 32-byte nonce, and POST-body handoff output instead of
query-token URLs; terminal CTAs remain fail-closed behind an explicit implementation gate. Admin bot health now preserves
`tortila-journal/not_configured` as setup-needed, and the bot journal checks DB imports before adapter fallback. Local
gates: `node scripts/gates.mjs full` **PASS**; Playwright e2e **44 passed / 6 skipped**. No live Stripe, Axioma,
TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service was touched. Aggregate:
[`docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`](handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md).
Still not production-ready: real Stripe replay, Axioma B4 activation, live endpoint-shape confirmation, and historical TV
task repair remain open.

_Latest update: 2026-06-01 - bot trade journal + config export continuation._
Added a first-class WTC trade review journal for bot trades. Migration `0007_romantic_mulholland_black.sql` adds
`bot_trade_reviews` as an editable overlay on top of immutable `bot_trade_imports`; users can store review status, tags,
setup/mistake notes, R-multiple, MAE, and MFE without mutating imported bot facts. `/app/bots/[bot]/journal` is now linked
from bot navigation and falls back honestly to latest adapter trades until worker imports exist. Bot settings/backtester now
include a safe config export route (`/api/bots/[bot]/config-export`): Tortila exports `.env`/`SYMBOL_CONFIGS`, Legacy exports
reference JSON; neither includes exchange keys or live-apply tokens. Local gates: `node scripts/gates.mjs full` **PASS**;
Playwright e2e **44 passed / 6 skipped**. No live bot/exchange control was touched.

_Latest update: 2026-06-01 - statistics/TV tasks/Axioma JWKS + durable Tortila snapshot continuation._
Implemented a broad visible-hardening pass on top of the Postgres-backed raw-IP preview. Bot statistics now include
journal-grade panels for drawdown profile, open risk exposure, monthly returns, symbol performance, exit reasons, and activity
feed. TradingView admin now has a manual external-task lifecycle (`tradingview_access_tasks` list + mark-done action with audit),
so WTC-side revokes are visibly paired with the human TradingView-side work. A public fail-closed
`/.well-known/axioma-jwks.json` route now exists and returns only public ES256 JWKs when configured. The worker Tortila snapshot
job now writes position snapshots and idempotent closed-trade imports in addition to metric snapshots; it remains read-only and
still never calls `/api/marks`. Local gates: `node scripts/gates.mjs full` **PASS**; Playwright e2e **44 passed / 6 skipped**.
No live bot/exchange control was touched.

_Latest update: 2026-06-01 - continuation after Phase 3.6._
The raw-IP WTC preview is now backed by real Postgres on the server. Real-PG acceptance ran against a fresh throwaway
`wtc_test_*` DB and passed **11/11**. A persistent `<preview-db-name>` DB was created, migrations through `0006`
were applied, seed succeeded, and `wtc-ecosystem-preview` now runs with `DATABASE_URL` set while keeping
`BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Tortila settings/setup now
include a per-coin editor and generated `SYMBOL_CONFIGS` export. Local gates: `node scripts/gates.mjs full` **PASS**,
Playwright e2e **44 passed / 6 skipped**. Public IP smoke passed for user Tortila setup/settings/statistics, teacher
courses, and admin system health. Live bot services remained active and untouched.

_Latest update: 2026-05-31 - **Phase 3.6 (strict e2e + IP-safe preview + admin terminal room)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-1600-phase-3-6-strict-e2e-ip-preview-admin-terminal.md`](handoffs/20260531-1600-phase-3-6-strict-e2e-ip-preview-admin-terminal.md)
(aggregate; cites 4 per-agent read-only handoffs at epoch 20260531-1600; no live server/bot/exchange touched; no live Stripe/TradingView/Axioma calls)._

## Phase 3.6 summary (this session - implemented & gate-verified)
Closed the broad package verification pass and fixed the two issues that made visual review unreliable. Playwright now uses a
guarded e2e-only login endpoint (`E2E_AUTH_BYPASS=1`, non-production only), shared auth helpers, `retries: 0`, and isolated
`.next-e2e` output; the final full run was **44 passed / 6 skipped / 0 flaky / 0 failed**. `scripts/gates.mjs` now fails on
any nonzero flaky count. `npm run preview:safe` now starts Next directly through `node` with `shell:false` and binds
`--hostname 0.0.0.0 --port 3000` for local-IP browser review. Added `/admin/terminal`, a DB-only admin room for terminal
release metadata/history; it does not upload installer bytes or enable Axioma CTAs. Gates: check:core OK, lint OK,
typecheck x2 OK, secret:scan OK, **test 575/8/583**, coverage **24.17/76.27**, db:generate OK (**41 tables**, no schema
changes), build OK, **e2e 44 passed / 6 skipped / 0 flaky / 0 failed**. Safe preview was verified on
`0.0.0.0:3000` via `127.0.0.1` and `192.168.72.141`. NOT RUN: real-PG `db:migrate`/`db:seed`/harness,
Stripe CLI/live webhook replay, Axioma production bridge, live bot/server/exchange, CI/git, `npm ci`. Current blocker snapshot:
[`docs/PRODUCTION_BLOCKERS_CURRENT.md`](PRODUCTION_BLOCKERS_CURRENT.md). **Still NOT production-ready.**

_Latest update: 2026-05-31 - **Phase 3.5 (integration hardening + safe preview readiness)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-1500-phase-3-5-integration-hardening.md`](handoffs/20260531-1500-phase-3-5-integration-hardening.md)
(aggregate; cites 4 per-agent handoffs at epoch 20260531-1500; no live server/bot/exchange touched; no live Stripe/Axioma calls)._

## Phase 3.5 summary (this session - implemented & gate-verified)
Executed the next production-readiness hardening pass after Phase 3.4. `seedDatabase()` is now idempotent for repeated
deploy/preview runs, and `npm run preview:safe` starts the browser preview with unsafe features forced off
(`BOT_ADAPTER_MODE=mock`, live bot control off, TV automation off). Billing webhook missing-user and missing/unknown-plan
paths now land in durable manual review instead of silent `no_op`; failed manual-review creation deletes the idempotency ledger
row and returns 500 for Stripe retry. Axioma download and journal-handoff route skeletons are present but fail closed until
the full route-readiness contract is configured. Bot safety pages degrade to warnings instead of crashes, and `/admin/products`
is now a real read-only product/admin overview. Gates: check:core OK, lint OK, typecheck x2 OK, secret:scan OK,
**test 572/8/580**, coverage **24.33/76.37**, db:generate OK (**41 tables**, no schema changes), build OK (**48 routes**),
**e2e 41 passed / 3 flaky-green / 6 skipped / 0 failed**. NOT RUN: real-PG `db:migrate`/`db:seed`/harness, Stripe CLI/live
webhook replay, Axioma production bridge, live bot/server/exchange, CI/git, `npm ci`. **Still NOT production-ready.**

_Latest update: 2026-05-31 - **Phase 3.4 (Stripe test checkout + pending-payment chain)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`](handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md)
(aggregate; cites 4 read-only audit handoffs at epoch 20260531-1426; no live server/bot/exchange touched; no Stripe live charge)._

## Phase 3.4 summary (this session - implemented & gate-verified)
Executed the first real commercial checkout slice. `@wtc/billing` now creates **Stripe test-mode Checkout Sessions** through REST
when `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP` are configured. `/app/billing`
renders a real Start checkout section; if checkout is configured it redirects to Stripe test checkout, otherwise it stays on the
manual support path. After session creation, WTC records `pending_payment` entitlements and product-access events; access is
still activated only by a signed webhook or admin grant. Added `billing.checkout_created`, `createPendingPaymentForPlan`, and
`STRIPE_PRICE_MAP` documentation. Gates: check:core OK, lint OK, typecheck x2 OK, secret:scan OK, **test 557/8/565**,
coverage **25.09/76.36**, db:generate OK (**41 tables**, no schema changes), build OK (**48 routes**),
**e2e 42 passed / 2 flaky-green / 6 skipped / 0 failed**. NOT RUN: real-PG `db:migrate`/`db:seed`/harness, real Stripe CLI
webhook completion, Axioma production bridge, CI/git. **Still NOT production-ready.**

_Latest update: 2026-05-31 - **Phase 3.3 (bot rooms + education rooms)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-1310-phase-3-3-bot-education-rooms.md`](handoffs/20260531-1310-phase-3-3-bot-education-rooms.md)
(aggregate; cites all 7 persisted read-only audit handoffs at epoch 20260531-1310; no live server/bot/exchange touched)._

## Phase 3.3 summary (this session - implemented & gate-verified)
Executed a broad bot/education product-surface pass.
- **Two bot rooms now have product-specific WTC setup.** Tortila and Legacy settings/setup share the same schema helpers but render different fields and reference profiles. Manual/auto is explicit WTC-side intent only; live apply/start/stop remains disabled.
- **Bot data-minimisation fixed.** `/app/bots` now calls read adapters only after entitlement allows that bot. Locked users see product/access status, not adapter health/process metadata.
- **Teacher education surfaces landed.** `/teacher/materials` is real (material list + guarded delete); `/teacher/community` is real (teacher profile/social links + teacher-profile pinned links); `/teacher/courses/[id]` now manages course pinned links and per-lesson materials.
- **Student education community is real-data driven.** `/app/education` now uses `loadStudentCatalogue` for `teacherProfiles`/`communityLinks`; the hardcoded Telegram/Instagram/Private Club "soon" links are gone.
- **Demo browser preview preserved.** Teacher dashboard again shows the seeded demo course in in-memory mode, with an explicit storage badge.
Gates: governance OK (7 cited; one allowlisted historical warning), check:core OK, lint OK, typecheck x2 OK, secret:scan OK,
**test 550/8/558**, coverage **24.74/75.98**, db:generate OK (**41 tables**, "No schema changes"), build OK (**48 routes**),
**e2e 41 passed / 3 flaky-green / 6 skipped / 0 failed**. NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1),
Stripe checkout/provisioning (B2), Axioma production bridge (B4), CI/git, `npm ci`. **Still NOT production-ready.**

_Latest update: 2026-05-31 - **Phase 3.2 (backtester local-runner MVP + bot product surfaces + product directory)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-1220-phase-3-2-backtester-product-surfaces.md`](handoffs/20260531-1220-phase-3-2-backtester-product-surfaces.md)
(aggregate; cites all 4 per-agent handoffs at epoch 20260531-1220 - read-only audit fan-out -> operator implementation -> full gates)._

## Phase 3.2 summary (this session - implemented & gate-verified)
Executed a broad product-surface slice from a **4 read-only auditor fan-out**: backtester distribution, bot product surfaces,
browser/IP readiness, and cabinet demo readiness. **No live server/bot/exchange touched; worker not run.**
- **Tortila local-runner download MVP shipped.** `@wtc/backtester` now exposes `BACKTESTER_RUNNER_DISTRIBUTED=true` with
  checksum/size/version metadata for `wtc-backtester-0.1.0.zip`. The entitled Tortila backtester page is now a real
  download-only page with local workflow instructions. The route `/api/bots/[bot]/backtest/runner-download` is
  entitlement-gated and streams the checked ZIP. Results remain local; server jobs/artifact uploads remain deferred.
- **Runner package exists on disk.** `packages/backtester/runner-src/wtc-backtester-0.1.0/*` plus
  `packages/backtester/runners/wtc-backtester-0.1.0.zip` (checksum asserted by test).
- **Bot settings/setup became product-specific.** Tortila gets Turtle fields (`timeframe/system/risk/stop/ATR/leverage/TP`);
  the legacy bot gets RSI/CCI/averaging fields. Both default to **manual**. Legacy live setup stays blocked by B3.
- **Read-only data truth fixed.** Tortila real-read mode renders unavailable mark/uPnL as `N/A`, not a fabricated zero.
- **`/app/products` is no longer a placeholder.** It now reuses the entitlement-aware cabinet cards with summary metrics,
  storage truth, blockers, and preview labels.
Gates: governance OK (4 cited; one allowlisted historical warning), check:core OK, lint OK, typecheck x2 OK, secret:scan OK,
**test 539/8/547**, coverage **25.93/76.00**, db:generate OK (**41 tables**, "No schema changes"), build OK (**46 routes**),
**e2e 42 passed / 2 flaky-green / 6 skipped / 0 failed**. NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1),
Stripe checkout/provisioning (B2), Axioma production handoff (B4), CI activation/git. **Still NOT production-ready.**

_Last updated: 2026-05-31 — **Phase 3.1 (LMS rich — first bounded slice; migration 0005)** implemented & gate-verified.
Authoritative record: [`docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`](handoffs/20260531-0130-phase-3-1-lms-rich.md)
(aggregate; cites all 5 per-agent handoffs at epoch 20260531-0130 — read-only audit fan-out → DB wave → serial consumer wave).
Prior phase record: [`docs/handoffs/20260531-0030-phase-2-13-backtester-locked-card.md`](handoffs/20260531-0030-phase-2-13-backtester-locked-card.md)._

## Phase 3.1 summary (this session — implemented & gate-verified)
Executed the **first bounded slice of the deferred rich LMS** (the rest of Phase-3 LMS stays deferred behind live blockers) from a
**5 read-only auditor fan-out** (one Workflow run `wf_c25ee765-31b`; 5 per-agent handoffs at epoch `20260531-0130`, all cited in the
aggregate — db-architect + education + frontend + security + tests). **DB wave first → serial consumer wave.** Migration **0005**
(additive, **0 new tables → still 41 tables**).
- **Migration 0005 — 4 additive columns (the core deliverable).** `courses.level` (text NOT NULL default 'beginner' + CHECK
  beginner|intermediate|advanced), `courses.tags` (text[] NOT NULL default '{}', **display/write only** — no array operators;
  PGlite can't, B1 NOT RUN), `lessons.content_type` (text NOT NULL default 'video' + a **hand-appended** backfill from `video_url`
  + CHECK video|embed|article|link), `lessons.external_url` (nullable; the 'link' companion). drizzle-kit can't emit the backfill
  UPDATE — hand-appended (precedent 0002).
- **`deriveContentType` retired (dual-truth killed).** The `videoUrl→type` heuristic + its 3 `queries.ts` callsites + the function
  + its unit test are **deleted**; `lessons.content_type` is now the single source of truth. Co-landed with the migration (the
  PG7 D-3 requirement).
- **Consumers co-landed (no dead schema).** Teacher create/edit forms gain a level select + tags input + content_type select +
  external_url; a **new `updateLessonAction`** provides the content_type write path for existing lessons (only a publish toggle
  existed); catalogue/teacher/admin/student surfaces show level badges + tag chips + content-type-aware lesson rendering
  (guarded https video/link, safe 'embed' placeholder).
- **Security (4 mandatory conditions from the gating auditor, all met) + a pre-existing XSS fix.** Every URL write path now enforces
  `z.url().startsWith('https://')` — this **closed a pre-existing gap** where `materialSchema.url` and `lessonSchema.videoUrl`
  accepted `javascript:`/`data:` URLs that render as a clickable href. New pure `@wtc/lms/urls` (`isHttpsUrl`/`safeHttpsUrl`)
  guards every outbound href at render time (defence-in-depth). `'embed'` is a forward-compat CHECK value only — **never**
  selectable, **never** rendered as raw HTML (no sanitizer → stored-XSS gate). `level` is a Zod enum AND a DB CHECK.
- **Deferred to later slices (each with a live blocker):** `embed_html` (sanitizer), `materials` file-meta (upload review BLOCKED),
  `pinned_links 'global'` (non-additive + Q-6), `courses.slug` (no routing), `lesson_progress.state` (deriveLessonState works).
  Teacher community / teacher-profile / teacher-owned pinned-link web surfaces were later landed in Phase 3.3; global pinned
  links remain deferred. ADR-021.
- **Tests:** `tests/integration/db-lms-ph3-1.test.ts` (**new**, 10 — PGlite repo round-trips + the 0005 backfill on the **real
  generated SQL**), `tests/integration/lms-ph3-1-static.test.ts` (**new**, 15 — deriveContentType retired, https-only writes, no
  embed write/render, UI wired), `tests/e2e/education-ph3-1-mobile.spec.ts` (**new** — 375px catalogue level badge);
  `lms-rbac-pipeline.test.ts` updated (11 actions). Tooling: **`scripts/gates.mjs`** (sequential single-process gate runner,
  summary-only — avoids the Windows tool-result late-flush). Also added a global `test.hookTimeout = 30_000` to
`vitest.config.ts` — a final-tree `test` run right after the 9-min e2e flaked 3 PGlite suites' `beforeAll` with a 10s
hook timeout (0 assertion failures; the migration-apply hook exceeds 10s under host load; `db-pg5` already had a per-suite
30s); the global timeout makes every PGlite suite resilient. Re-ran green.
Gates: governance ✓ (5 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 532/8/540** (+28 vs PG10's 504/8/512),
db:generate ✓ (**41 tables**, "No schema changes"), build ✓ (`ƒ Middleware 35.2 kB`), **e2e 40 passed / 4 flaky-green / 6 skipped / 0 failed** (the 4 flaky are the known dev-only Server-Action recompilation race in the pre-existing smoke spec, auto-retried green via `retries:2`; the new `education-ph3-1` catalogue level-badge spec passed; an earlier e2e attempt failed on a corrupted `.next` cache from overlapping build/dev processes — re-run clean on a fresh `.next`). NOT RUN: real-PG
`db:migrate`/`db:seed`/harness (B1 — the 0005 CHECK + backfill are PGlite-verified only; apply to a throwaway `wtc_test` to prove
on real Postgres); B2 Stripe; B4 Axioma; `npm ci`. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter stays
deleted+blocked (B3); all 3 Axioma CTAs stay disabled (B4). **Still NOT production-ready.**

## Phase 2.13 / PG10 summary (prior session — implemented & gate-verified)
Executed PG10 (Backtester / distribution) from a **5 read-only auditor fan-out** (one Workflow run `wf_a8038d9d-4b7`; 5 per-agent
handoffs at epoch `20260531-0030`, all cited in the aggregate — backtester-architect + ux-ui-designer + frontend + security +
tests). **No migration** (`db:generate` = "No schema changes"; 41 tables; unanimous 5/5). **Operator decision (hard blocker):
option (b) — an honest permanently-locked card**, NOT the real local-runner pipeline (ADR-020).
- **Half-state removed.** The Tortila backtester page had a dead config form + two disabled teaser buttons ("Queue run
  (local runner required)" / "Download local runner (soon)") + "coming in a future release" copy; the Legacy card said
  "Coming soon". All replaced by an honest **thin-shell page** over the new pure deriver — 3 states: legacy product-boundary
  ("The Legacy Bot does not have a backtester…"), Tortila access-required, and Tortila entitled → "Backtester not yet
  available" (the local runner is not yet distributed; the platform never fabricates returns). No form, no teaser, no "coming soon".
- **Pure `@wtc/backtester` deriver (core deliverable).** `deriveBacktesterView(slug, access?)` + `backtesterPill(slug)` +
  `BACKTESTER_RUNNER_DISTRIBUTED = false` (single flip-point for option a). FAIL CLOSED (missing/non-allowed decision
  denies); **carries no numeric/equity/metric/result field** (no-fake-results invariant). **10 unit tests** — closing the
  package's prior **0% coverage** (it was an orphaned, spec-drifted in-memory `BacktestService` stub imported by nothing;
  now gutted; `index.ts` re-exports the deriver). The contract docs remain the option-(a) blueprint.
- **Cross-surface honesty.** The bot-overview capability table no longer shows a false green "Available" backtester pill —
  it uses the shared `backtesterPill` (tortila → neutral "Not yet available", legacy → "Not available").
- **Tests:** `packages/backtester/src/derive.test.ts` (**10**, real unit coverage) + `tests/integration/backtester-pg10.test.ts`
  (**12** static source-guards) + `tests/e2e/backtester-pg10-mobile.spec.ts` (**new** — 375px, navigation-only). ADR-020.
Gates: governance ✓ (5 cited), lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 504/8/512** (+22), coverage **26.8% / 75.56%**
(both ↑ vs PG9), db:generate ✓ (**41 tables**, "No schema changes"), build ✓, check:core ✓, **e2e 40 passed / 5 skipped / 1
flaky-green / 0 failed** (known dev-only Server-Action smoke race auto-retried; 2 new PG10 specs pass in the mobile project).
NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1); B2 Stripe; B4 Axioma; `npm ci`. `BOT_ADAPTER_MODE=mock` default
preserved; legacy real adapter stays deleted+blocked (B3); all 3 Axioma CTAs stay disabled (B4); **no backtest result is ever
fabricated (runner pipeline not built — option b)**. **Still NOT production-ready.**

## Phase 2.12 / PG9 summary (prior session — implemented & gate-verified)
Executed PG9 (User cabinet / product UX) from a **4 read-only auditor fan-out** (one Workflow run `wf_cb3dcdfe-5fb`; 4 per-agent
handoffs at epoch `20260531-0005`, all cited in the aggregate — ux-ui-designer + frontend-implementer + security + tests). **No
migration** (`db:generate` = "No schema changes"; 41 tables; unanimous 4/4).
- **Per-product cabinet cards (the core deliverable).** The `/app` overview rendered only entitlement state + a CTA; it now
  renders enriched **`ProductCabinetCard`s** with five honest zones — entitlement pill, **setup** checklist/progress, recent
  **activity**, the single most-actionable **next action**, and **blockers** — driven by a new **pure `@wtc/cabinet` package**
  (`deriveProductCard` + `ACCESS_REASON_COPY` for all 10 reasons; **26 unit tests** incl. 5 fail-closed invariants — real
  Vitest coverage, resolving the auditors' deriver-location split in favour of `packages/*` per AGENTS.md). A server-only
  `features/cabinet/loader.ts` gathers per-product setup/activity signals **only when `access.allowed`** (fail-closed data
  minimisation) and calls the pure deriver. The presentational card lives in `features/cabinet` (not `packages/ui`) to avoid a
  `@wtc/ui → @wtc/cabinet` circular dependency. Honest CTAs: not-owned→"Contact support" (B2 checkout off), expired→"Renew"/
  "Contact support", owned+unconfigured→"Finish setup" (→wizard), owned-but-B3/B4→"View status"/"View details" (ghost, never
  implies live data), club→"Coming soon" (disabled). Per-card "demo data" pill when in-memory.
- **Mobile-first setup wizard.** New `/app/bots/[bot]/setup?step=key|strategy|review` (single route, GET-link step nav) — a
  3-step exchange-key onboarding (encrypt key → strategy config → review). Two **CSRF-first, fail-closed** server actions reuse
  the vault + bot-config pipelines (secrets sealed; only masked hints; type=password inputs). New `.wtc-wizard-steps`/`.wtc-step`
  stepper CSS (§15). `BotSubNav` unchanged (no `setup` tab).
- **Folded-in security fixes.** **F-01** (medium): `indicators/page.tsx` loaded per-user TV data *before* the entitlement check
  — now gated on `access.allowed` (the canonical fail-closed pattern the cabinet loader follows). **F-02**: security-page
  `addKeyAction` → CSRF-first. **F-04**: Tortila operational notices are now per-card + entitlement-gated (the unconditional
  overview card was removed).
- **375px overflow fixed (caught by the new e2e).** The wizard horizontally scrolled at 375px — a CSS-grid `1fr` **min-content
  blowout** from the stepper. Fixed at the source: `.wtc-shell` grid → **`minmax(0, 1fr)` + content `min-width:0`** (hardens
  every app page, not just the wizard).
- **Tests:** `packages/cabinet/src/derive.test.ts` (**26**, real unit coverage) + `tests/integration/cabinet-pg9.test.ts`
  (**15** static source-guards) + `tests/e2e/cabinet-pg9-mobile.spec.ts` (**new** — 375px, navigation-only: honest per-product
  state + the wizard stepper, no h-scroll). ADR-019; DESIGN_SYSTEM §15.
Gates: governance ✓ (4 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 482/8/490** (+41: derive 26,
cabinet-pg9 15), coverage **26.49% / 74→75.33% branch** (branch **+1.01** — `packages/cabinet` 84%/96.82%; stmts −0.34 = new
app-layer cabinet code in the e2e-covered/unit-excluded `apps/web` denominator), db:generate ✓ (**41 tables**, "No schema
changes"), build ✓ (34 routes incl. `/app/bots/[bot]/setup`, `ƒ Middleware 35.2 kB`), **e2e 39 passed / 3 skipped / 0 flaky**
(the 375px spec caught + verified the shell-overflow fix). NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1); B2 Stripe
checkout (surfaced honestly as "Contact support"); B4 Axioma activation (surfaced as the B4 blocker); `npm ci` (one `npm install`
ran to symlink `@wtc/cabinet`). `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter stays deleted+blocked (B3); all 3
Axioma CTAs stay disabled (B4). **Still NOT production-ready.**

## Phase 2.11 / PG8 summary (prior session — implemented & gate-verified)
Executed PG8 (Admin console) from a **4 read-only auditor fan-out** (one Workflow run `wf_e5c0e2fe-2d7`; 4 per-agent handoffs at
epoch `20260530-2345`, all cited in the aggregate — ux-ui-designer + frontend-implementer + security + tests). **No migration**
(`db:generate` = "No schema changes"; 41 tables) — a pure UI/UX phase (unanimous 4/4). Shared fixes applied across all 10 admin
pages (the 8 named + `/admin` overview + `/admin/audit-log`).
- **Mobile-readable cards — no 375px horizontal scroll (the core deliverable).** `.wtc-table` had zero responsive handling; the
  **10-column TradingView queue** (Action cell carrying the inline grant/revoke forms), the 7-col entitlements timeline, and ~6
  other tables overflowed at 375px. New **CSS-only `data-label` card-stack** `.wtc-table-wrap` in `packages/ui/src/theme.css`
  (DESIGN_SYSTEM §14): below 640px each row becomes a labelled card (thead hidden; `td::before { content: attr(data-label) }`;
  `.wtc-td-action` = full-width stacked forms). Long mono values (`targetType:targetId`, action codes) get
  `overflow-wrap:anywhere` so they wrap instead of forcing the card wider — **caught by the 375px e2e on `/admin/audit-log`**
  (the one table rendering rows in demo mode). `min-width:0 !important` (≤640px) lets fixed-`minWidth` inline inputs fit 375px.
  **Critical co-fix:** the admin layout never rendered `<MobileNav>` (sidenav `display:none` below 900px), so admins had **no
  mobile navigation** — `<MobileNav items={ADMIN_NAV} />` added inside the admin tree (after the `isAdmin` gate; links never
  exposed to non-admins). Support filters → 44px tap-target chips.
- **Honest empty/demo/postgres/blocked pills everywhere, consuming PG2/PG5.** Canonical pill taxonomy (§14.3) applied
  consistently. `/admin` overview moved off the stale in-memory `tvService` to a DB-backed `loadAdminOverview()` (honest demo→0)
  + canonical storage pill + per-page `requireUser`+`assertAdmin`. **PG2 Tortila read-state** surfaced on `/admin/bots` as a
  **derived** pill (from the last persisted health check — no live probe in the render path). **PG5 expiring-soon** grants get a
  `RiskWarningBanner` on the TV queue (auto-revoke timeline; admin-only `revokeReason` column preserved). `/admin/audit-log`
  gained per-page RBAC + a storage pill. **Defence-in-depth:** `eventSnapshot` allowlisted to `{id,type,planCode}` in the loader.
- **Education page corrected.** Canonical `requireUser`+`assertAdmin` (was `getCurrentUser`+`roles.includes`); root `<main>` →
  `<div className="wtc-stack">` (kills the nested-`<main>` invalid HTML). (ux F-05 "missing grid wrapper" was a false positive —
  the `wtc-grid-4` wrapper is already present; not changed.)
- **Inherited red gate fixed.** The tests-runner found `npm run typecheck` exits **2** on the PG7 tree (5
  `noUncheckedIndexedAccess` errors in PG7's `audit.test.ts` + `lms-rbac-pipeline.test.ts`); fixed with 5 non-null assertions
  (PG7's "typecheck ✓" claim was inaccurate). `db-pg5.test.ts` `beforeAll` given a 30s timeout (PGlite-under-load flake).
- **Tests:** `tests/integration/admin-responsive.test.ts` (**new**, 35 static guards — every table wrapped + has `data-label`,
  MobileNav present, education canonical-RBAC + no nested `<main>`, overview RBAC + storage pill, every page has a `StatusPill`)
  + `tests/e2e/admin-mobile-pg8.spec.ts` (**new** — 375px no-h-scroll + MobileNav + storage pill across all 10 admin pages). ADR-018.
Gates: governance ✓ (4 cited), check:core ✓, lint ✓, typecheck ×2 ✓ (inherited red gate fixed), secret:scan ✓, **test
441/8/449** (+35), coverage **26.83% / 74.32%** (branch held; stmts −0.29 = new app-layer admin code in the e2e-covered apps/web
denominator), db:generate ✓ (**41 tables**, "No schema changes"), build ✓ (33/33 pages, `ƒ Middleware 35.2 kB`), **e2e 36 passed /
1 flaky-green (known dev-only Server-Action race, `retries:2`) / 1 skipped (desktop instance of the mobile-only 375px spec)**. NOT RUN: real-PG `db:migrate`/`db:seed`/harness (B1); B2 Stripe checkout; B4 Axioma
activation; `npm ci`. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter stays deleted+blocked (B3); all 3 Axioma
CTAs stay disabled (B4). **Still NOT production-ready.**

## Phase 2.10 / PG7 summary (prior session — implemented & gate-verified)
Executed PG7 (LMS) from a **5 read-only auditor fan-out** (one Workflow run `wf_bc573b81-055`; 5 per-agent handoffs at epoch
`20260530-2330`, all cited in the aggregate). **No migration** (`db:generate` = "No schema changes"; 41 tables) — the rich
LMS migration was deferred to Phase-3 by **unanimous** auditor verdict.
- **LMS denial → audit + throw (the core security fix).** The 10 LMS server actions previously **silently `return`ed** on
  every RBAC/ownership/entitlement denial (a denied attempt looked like a no-op with **no audit row** — worst case Teacher A
  submitting Teacher B's `courseId`). New `apps/web/src/features/lms/guard.ts` exposes four gates —
  `requireTeacher`/`requireAdmin`/`requireCourseOwnership`/`requireEducationAccess` — each of which **writes one audit row
  (`result:'failure'`, `after:{reason,attempted}`, no secrets) THEN throws `AppError`** (`forbidden` 403 / `entitlement_denied`
  402). Two new audit codes `education.rbac_denied` + `education.entitlement_denied` (two, not one, so monitoring separates
  routine entitlement gating from anomalous authz violations; `AuditResult` unchanged — denials use `'failure'`). The pure
  `@wtc/lms` `assertTeacherOwns` decision is reused inside `requireCourseOwnership`; a missing course is a denial (no
  existence leak). The local `roles()`/`ownsCourse()` helpers were retired.
- **CSRF-first ordering.** Every action now calls `assertCsrf(formData)` as its **first awaited statement**, before
  `requireUser()` (was reversed). `assertCsrf` reads the session cookie directly (independent of `requireUser`), so a forged
  cross-site POST is rejected before any session read or DB I/O. Canonical pipeline: **assertCsrf → requireUser →
  RBAC/ownership/entitlement (audit+throw) → Zod → repo (in-txn success audit) → revalidate**. Zod/not-found/demo branches
  stay **graceful** (input/not-found, not authz events).
- **Rich migration 0005 → Phase-3 plan (5/5 auditors).** No candidate field (slug/level/tags/content_type/embed_html/
  file-meta/global-pinned/progress-state) has a consumer this phase; dead-code-avoidance (PG4/PG6) is decisive. `embed_html`
  needs an unbuilt server-side sanitizer (stored-XSS); `materials` file-meta is BLOCKED on the upload security review;
  `pinned_links owner_type='global'` is **non-additive** (DROP+ADD CHECK — would leave both constraints live). Ready-to-run
  Phase-3 DDL spec is in the db-architect/education handoffs + `EDUCATION_LMS_PLAN.md`.
- **Tests (static, the repo pattern for apps/web server actions).** `tests/integration/lms-rbac-pipeline.test.ts` (8) asserts
  CSRF-first + no-silent-return + guard-audit+throw by source analysis (vitest excludes `apps/web/**`); `packages/audit/src/audit.test.ts`
  (4) covers the denial codes + `buildEvent` round-trip + memory writer.
Gates: governance ✓ (5 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 406/8/414** (+12: pipeline 8, audit 4),
coverage **27.12% / 74.32%** (branch held; stmts −0.08 = new app-layer `guard.ts` in the e2e-covered/unit-excluded apps/web
denominator; `packages/audit` ↑ 92.48%), db:generate ✓ (**41 tables**, "No schema changes"), build ✓ (`ƒ Middleware 35.2 kB`),
**e2e 36/36** (all green first try; teacher/LMS pages render, no denial path exercised; `retries:2` carried). NOT RUN: real-PG
`db:migrate`/`db:seed`/harness (B1); B2 Stripe checkout; B4 Axioma activation; `npm ci`. `BOT_ADAPTER_MODE=mock` default
preserved; legacy real adapter stays deleted+blocked (B3); all 3 Axioma CTAs stay disabled (B4). **Still NOT production-ready.**

## Phase 2.9 / PG6 summary (this session — implemented & gate-verified)
Executed PG6 (Axioma non-blocked surface) from a **5 read-only auditor fan-out** (one Workflow run `wf_0515a123-c96`; 5 per-agent
handoffs at epoch `20260530-2230`, all cited in the aggregate). **DB wave first → consumers → tests.** Migration **0004** (one
additive table; 40→**41 tables**). **CTAs stay disabled (B4); hard boundary preserved.**
- **DB wave — migration 0004 `axioma_handoff_jti_revocations`.** The durable jti replay store from `AXIOMA_HANDOFF_TOKEN_SPEC.md`
  §Replay Prevention: `jti uuid PK` (caller-supplied, no defaultRandom), `sub uuid NOT NULL` (**no FK** — rows survive user
  deletion as replay/audit evidence), `issued_at`/`expires_at`/`used_at`/`revoked_at`/`revoke_reason` + indexes on `expires_at`
  (purge) and `sub` (revoke sweep). 0000–0003 untouched.
- **jti store repos (pure primitives, no inline audit — the `insertWebhookEventOnce` precedent).** `recordHandoffJti`
  (issuance), `consumeHandoffJti` (single **atomic conditional UPDATE … WHERE used_at IS NULL AND revoked_at IS NULL AND
  expires_at > now RETURNING {sub}**; 0 rows → SELECT categorizes `not_found`/`already_used`/`revoked`/`expired`),
  `revokeHandoffJtisByUser` (live-rows-only sweep), `purgeExpiredHandoffJtis` (delete `expires_at < now − 1h`). Worker `dbTick`
  runs the purge after `sweepTvExpiry`. 3 jti audit codes added (`axioma.handoff_jti_consume/_replay/_revoke`, underscore
  convention) for the future B4 routes.
- **ES256 wired into the bridge behind a STAGING+PROD fence.** New pure `resolveHandoffSigner({deploymentEnv, es256Key?,
  hs256Secret?})` + `HandoffSigner` abstraction in `packages/axioma-bridge/src/signer.ts`; `createAxiomaBridge` signs with the
  **injected** signer and records the jti before issuance. Fence: ES256 when keyed (any env); **staging|production with no key →
  throws** (HS256 dev stub forbidden); dev/test → HS256 stub. `@wtc/axioma-bridge` stays **zero-dependency/pure** (no env reads).
  `env.ts` gains `APP_ENV` (dev/test/staging/production) + `AXIOMA_HANDOFF_SIGNING_KEY`/`_KEY_ID` + a staging/prod superRefine
  (validated at boot via instrumentation `loadEnv`). The HS256-secret prod requirement + `signHandoffToken`'s prod-throw are KEPT
  (defense-in-depth; F-07 deferred).
- **B4 stays open:** real EC P-256 key unprovisioned (OP) + `journal_server` endpoint shapes unconfirmed (EXT) ⇒ ES256
  *activation* NOT RUN (wired + unit-tested with a generated key only); the web signer resolver + Open-Journal/consume/Download
  routes are **not built** (dead-code-avoidance); the `axioma_account_links` OTC→hash refactor stays TARGET (NOT in 0004).
Gates: governance ✓ (5 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 394/8/402** (+24: signer 12,
db-axioma-jti 9, env +4 — 1 of the 25 new is the real-PG cross-connection skip), coverage **27.2% / 74.32%** (both ↑), db:generate ✓
(**41 tables**, no changes), build ✓ (`/.well-known/axioma-jwks.json` intact, `ƒ Middleware 35.2 kB`), **e2e 36/36** (CTAs still
DISABLED; `retries:2` for the known dev-only Server-Action race). NOT RUN: real-PG `db:migrate`/`db:seed`/harness incl. the jti
cross-connection race (no `DATABASE_URL` — B1); **B4 Axioma activation** (P-256 key + endpoint shapes + CTAs + routes); B2 Stripe
checkout. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter stays deleted+blocked (B3); **all 3 Axioma CTAs stay
disabled (B4)**. **Still NOT production-ready.**

## Phase 2.8 / PG3 + PG4(unblocked) + PG5-follow-up summary (this session — implemented & gate-verified)
Executed three bounded workstreams from a **5 read-only auditor fan-out** (one Workflow run `wf_824781f2-457`; 5 per-agent
handoffs at epoch `20260530-2100`, all cited in the aggregate). **No migration** (`db:generate` = "No schema changes"; 40 tables).
- **PG3 — Legacy hard gate (B3 in-repo gate; real adapter stays BLOCKED).** The real legacy HTTP adapter
  (`createHttpLegacyAdapter`, which probed the plaintext-key `/api_management/`) was **DELETED**; the factory routes the legacy
  bot to the new **`createLegacyBlockedAdapter`** in every non-mock mode (no network path; data methods throw
  `LegacyAdapterBlockedError` with `blockerRef='B3'`; `getHealth()` returns a deterministic blocked state, no fetch). A **Zod
  exclusion** `LegacyApiSafeBodySchema` strips any SECRET_HINTS field (api_key/secret_key/…) from a `/api_management/` body at
  any depth (the WTC-side B3 deliverable). The bot dashboards show an **honest "Live adapter unavailable — blocked (B3)"**
  banner (data-driven via `BOT_CAPS.liveAdapterBlocked`), distinct from Tortila's "simulated data". 42 new tests.
- **PG5 follow-up — `markExpiringSoon`.** New repo pre-pass (`markExpiringSoon(db, now?, windowMs=7d)`) that writes the 7-day
  `expiring_soon` status (`granted → expiring_soon`; `> now` lower bound leaves expired rows for the sweep; idempotent; no
  per-row audit). Wired into the worker `dbTick` **before** `sweepTvExpiry`. **Critical co-land:** `sweepTvExpiry`'s predicate
  widened to `status IN ('granted','expiring_soon')` so expiring_soon rows are still revoked at expiry (else stranded forever).
  7 new PGlite tests incl. the `granted→expiring_soon→revoked` sequence.
- **PG4 — Billing (UNBLOCKED only; B2 NOT RUN).** Q-2 OPEN + no Stripe test keys ⇒ **test-mode checkout (B2) is NOT RUN**.
  Delivered the unblocked scaffold with **no dead code**: pure `checkoutAvailability(opts)` in `@wtc/billing` (3 honest
  `available:false` branches; **no `available:true` branch** until B2), a `features/billing/plans.ts` view-model
  (`buildPricingCards()` — removes the duplicated inline PLANS map from both pages), and a server-only
  `features/billing/checkout.ts` (`checkoutCta()`). The pricing CTA now shows an honest "Self-serve checkout unavailable" pill
  + "Contact support for access" (no fake purchase button); the dev-only mock-checkout section is wrapped in a
  `NODE_ENV!=='production'` render guard. 4 new tests.
Gates: governance ✓ (5 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 370/7/377** (+53: legacy-blocked 42,
db-tv-expiring 7, checkoutAvailability 4), coverage **26.21% / 73.49%** (both ↑), db:generate ✓ (40 tables, no changes), build ✓
(44 routes, `ƒ Middleware 35.2 kB`), **e2e 36/36** (incl. legacy blocked-banner content assertion; `retries:2` for the known
dev-only Server-Action race). NOT RUN: real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL` — B1); **B2 Stripe test-mode
checkout** (Q-2 undecided + no test keys). `BOT_ADAPTER_MODE=mock` default preserved; **legacy real adapter deleted +
factory-blocked (B3)**; live bot control stays BLOCKED. **Still NOT production-ready.**

## Phase 2.7 / PG2 + PG5 summary (this session — implemented & gate-verified)
Executed two bounded phase groups from a **4 read-only auditor fan-out** (one Workflow run; 4 per-agent handoffs at epoch
`20260530-1930`, all cited in the aggregate). **No migration** (`db:generate` = "No schema changes"; 40 tables) — both items
reuse existing columns.
- **PG2 — Tortila read-only states surfaced end-to-end.** New optional `readState` on `BotHealth`
  (`not_configured`/`unreachable`/`malformed`/`stale`/`ok`) — chosen over widening `HealthStatus` (back-compat). The real
  `getHealth()` is a **4-state machine that never throws**: `not_configured` (no `JOURNAL_READ_TOKEN`), `unreachable`
  (network/non-2xx), `malformed` (bad shape / unparseable `ts`), `stale` (journal `ts` > **5 min** = `ADAPTER_STALE_THRESHOLD_MS`),
  else `ok`. The worker maps each state to `integration_health_checks.status` so a missing config records **`not_configured`,
  not `error`** (no false outage). Bot dashboards render an honest `botHealthPill` (`not_configured` = "Setup needed", neutral).
- **PG2 — `getWarnings()`** added to `BotAdapter` (mock = persistent P0/P1 + signals 101211/100410/exchange-flat/109421;
  real = persistent P0/P1, signals never fabricated); `getHealth().warnings` delegates to it (no drift); the safety dashboard
  calls it first-class; the canonical-code test invariant now covers it.
- **PG2 — `JOURNAL_READ_TOKEN`** bearer auth in `getJson` (attached only when set; **never** logged / in `rawJson` / in audit /
  in error strings), threaded via factory → `botAdapterOptions()`/worker; `env.ts superRefine` requires it for a real mode in
  production; `.env.example` placeholder (secret:scan clean). `server-config` normalized to canonical `TORTILA_JOURNAL_URL`.
- **PG5 — `sweepTvExpiry` → `atomicRevokeTv`** (reason `expired_by_worker`): the worker now **fully revokes** an expired grant
  (grant `revoked_at`/`revoke_reason` + profile pointer null + `tv_access.revoke` audit), not just `status='expired'`. The
  actor is the **system actor `{ id: null, role: 'system' }`** — `audit_logs.actor_user_id` is nullable with no FK, so `null`
  is correct (no sentinel UUID). `atomicRevokeTv` signature changed to an actor descriptor; admin revoke = `{ id, role:'admin' }`.
  The informational `tradingview_access_tasks` row is still queued (TV-side removal stays manual-first). Terminal status → `revoked`.
- **PG5 — `listUsersWithEmailByIds`** (single `inArray`, empty-ids short-circuit) kills the `loadTvAdminData` per-row N+1.
- **PG5 — `revokeReason`** shown in the **admin-only** grant-history table (never on `/app/indicators`); **`<14-day` expiry banner**
  added to `/app/indicators` (computed from active grants/granted requests; future expiries only).
Gates: governance ✓ (4 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 317/7/324** (+23: getHealth-states 9,
worker-health-mapping 6, db-pg5 5, adapters +2, tortila-mapping +1), coverage **25.61% / 72.72%** (branch ↑), db:generate ✓
(40 tables, no changes), build ✓ (44 routes, `ƒ Middleware 35.2 kB`), **e2e 36/36** (34 clean + 2 dev-race flakes auto-retried
green). NOT RUN: real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL`/Docker — PGlite is not a substitute). `BOT_ADAPTER_MODE=mock`
default preserved; live bot control + legacy adapter stay BLOCKED. **Still NOT production-ready.**

## Phase 2.6 / PG11 summary (prior session — implemented & gate-verified)
Created the greenfield **`apps/web/src/middleware.ts`** (Edge runtime) — the serial-spine prerequisite for the PG4/5/6 API
routes — closing production blocker **B5** (CRITICAL) and the F-07 redact item, from a **4 read-only auditor fan-out**
(one Workflow run; 4 per-agent handoffs at epoch `20260530-1815`, all cited in the aggregate).
- **Auth rate-limiting** on the **real** entry points: auth is Next.js **server actions** posting to `/login`
  (`loginAction`) + `/register` (`registerAction`) — there are **no `/api/auth/*` routes**. IP-keyed sliding window
  (10 req / 60s, x-forwarded-for→x-real-ip), **429 + `Retry-After`**, no account-existence disclosure. Enforcement is
  skipped only for an unidentifiable client in non-production (so the e2e smoke logins never trip it); production fails
  closed (`'unknown'` bucket still throttled).
- **Security headers** (SECURITY_MODEL §6) on **document GET responses only** — POSTs (server actions) + RSC fetches pass
  through untouched (decorating a Server Action response corrupts Next's action protocol). HSTS prod-only; CSP env-aware
  (dev relaxes `script-src` for HMR; prod = `script-src 'self' 'unsafe-inline'` MVP — per-request nonce deferred to
  Phase 3). `/api/billing/webhook` excluded (matcher + early return; raw body, CSRF-exempt, never rate-limited).
- **Edge-safety:** pure, dependency-free `packages/auth/src/{rate-limit,security-headers}.ts` exposed via **new subpath
  exports** (`@wtc/auth/rate-limit`, `@wtc/auth/security-headers`) + `tsconfig.base.json` aliases — the middleware never
  imports the `@wtc/auth` barrel (it pulls `@node-rs/argon2`, Node-native). Build confirms `ƒ Middleware 35.2 kB`.
- **F-07 redact value-guard:** `isSecretValue()` (PHC/bcrypt, `Bearer `/`Basic `, 64+-hex) now redacts secret-looking
  string VALUES at any depth, not just keys — catches a session-token/PHC value under an innocuous key. 18 unit tests.
Gates: governance ✓ (4 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 294/7/301** (+53: rate-limit
14, security-headers 21, redact 18), coverage **25.23% / 71.61%** (branch ↑), db:generate ✓ (40 tables, no changes),
build ✓ (`ƒ Middleware 35.2 kB`; 44 app routes — all `ƒ` dynamic via per-request `cookies()` in PublicTopBar/layouts,
**pre-existing**, not the middleware; only `/_not-found` static), **e2e 36/36** (34 smoke + 2 header ×proj; **1 dev-only
Next Server-Action recompilation-race flake auto-retried green** — `retries: 2`; not a production issue). NOT RUN:
real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL`/Docker — PGlite is not a substitute). Deferred: F-03 structured
logger (PG12), CSP per-request nonce (PG3). **Still NOT production-ready.**

## Phase 2.5 summary (prior session — implemented & gate-verified)
Opened the operator's **continuous 12-phase-group program**. Produced the 5 mandatory master planning docs
([`ROADMAP_MASTER`](ROADMAP_MASTER.md), [`EXECUTION_PLAN_MASTER`](EXECUTION_PLAN_MASTER.md),
[`ACCEPTANCE_MATRIX_MASTER`](ACCEPTANCE_MATRIX_MASTER.md), [`RISK_REGISTER_MASTER`](RISK_REGISTER_MASTER.md),
[`PRODUCTION_BLOCKERS`](PRODUCTION_BLOCKERS.md)) from a **6 read-only auditor/planner fan-out**, then executed
**Phase Group 1**: fixed all confirmed doc drift vs Phase 2.4 (IMPLEMENTED_FILES 38→**40 tables** / 3→**4 migrations**;
8→**11 Tortila fixtures** in STATUS/NEXT_ACTIONS/IMPLEMENTED_FILES; billing-webhooks §1 `webhook_idempotency_keys`→
`billing_webhook_events` + §14 Gap-3 OPEN→**FIXED**; DATA_MODEL §13 0003 column lists corrected to the DDL + §5.3
`ip_address` INET→**TEXT**), and hardened the real-PG harness (`tests/integration/db-real-postgres.test.ts`): exported
`assertThrowawayDbName` DB-name guard (`^wtc_test(_…)?$`, via `globalThis.URL` to dodge the `const URL` shadow) + 3
always-on guard unit tests + 2 new skipIf tests (migration-0003 40-table proof; **cross-connection** concurrent
`billing_webhook_events` dedup via two independent pools — the race PGlite cannot do).
Gates: governance ✓ (6 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 241/7/248** (+3 guard),
coverage **24.94% / 70.74%**, db:generate ✓ (40 tables; "No schema changes"), build ✓ (33/33 pages), **e2e 34/34**.
NOT RUN: real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL`/Docker — **PGlite is not a substitute**).
Carried forward (in the master docs): `apps/web/src/middleware.ts` greenfield (PG11, CRITICAL — auth rate-limit +
security headers), LMS RBAC-throw (PG7/11), Axioma jti store (PG6), `db:seed` course-insert idempotency (PG12).
**Still NOT production-ready.**

## Phase 2.4 summary (prior session — implemented & gate-verified)
Migration **0003** (38→**40 tables**: `billing_webhook_events` durable idempotency, `billing_manual_review_items`, subscriptions unique index, audit composite index). **Five areas:** (B) real read-only **Tortila journal adapter** — Zod schemas + 11 fixtures + `getMetrics/getPositions/getTrades/getEquityCurve` from the actual journal shapes (fees sign-inversion handled; mark price honestly unavailable; `/api/marks` never consumed) + 35 fixture-only tests + worker `tortila-journal` health collector (env-guarded); control stays disabled, legacy stays BLOCKED; (D) billing webhook hardening — durable `insertWebhookEventOnce` (INSERT-on-conflict, concurrent-safe) + `upsertSubscription` + missing/ambiguous userId → fail-closed `manual_review` item + admin notify (**never auto-grant**) + admin approve/reject/dismiss queue; (E) **TV atomicity** — `atomicGrantTv`/`atomicRevokeTv` (request+grant+profile+audit in one transaction; revoke reason persisted end-to-end); (F) admin ops — N+1 fix (`listUsersWithCreatedAt`), `/admin/entitlements/review` queue, real `/admin/bots`; (A/G) docs truth + real-PG honestly **NOT RUN**.
Gates: governance ✓ (18 cited), check:core ✓, lint ✓, typecheck ×2 ✓, secret:scan ✓, **test 238/5/243** (27 files, +67), coverage **24.94% / 70.77%**, db:generate ✓ (40 tables), build ✓ (53 routes), **e2e 34/34**. NOT RUN: db:migrate/db:seed/real-PG (no `DATABASE_URL`/Docker — **PGlite is not a substitute**). Blockers: Stripe checkout TARGET; legacy adapter BLOCKED; Axioma ES256 TARGET; CI inert. **NOT production-ready.**

## Phase 2.3 summary (prior session — implemented & gate-verified)
Five product areas: **Part 0** docs/nav truth + 4 LMS correctness fixes (teacher read-isolation, admin-enroll audit actor,
completion audit target, course `teacherProfileId`); **Part 1** real `POST /api/billing/webhook` (signature-verify-first,
idempotent via the audit_logs ledger, CSRF-exempt raw-body, fail-closed, no secret/body logging, no live Stripe calls) +
product-access timeline (user view omits actor) + honest billing/pricing UI; **Part 2** TradingView user state + admin queue
(filters/counts, grant/revoke with reason+duration+state-guard+entitlement-recheck on the 0002 grant repos) — manual-first,
no automation; **Part 3** terminal DB-wiring (`getCurrentTerminalRelease`, license/download/account-link state, ES256/JWKS
readiness without key exposure, hard-boundary callout, disabled dev placeholders); **Part 4** admin console (`/admin/users`
passwordHash-stripped, `/admin/system-health`, **new** `/admin/support` triage, `/admin/entitlements` reason/validUntil +
timeline); **Part 5** bot read-only polish (live control + legacy adapter stay disabled/blocked). No migration 0003.
Known follow-ups: TV grant two-step atomicity + revoke-reason persistence; webhook missing-userId `manual_review` alert.

## Phase 2.3 visible-progress final gate run (this session)

Lint fixes in frontend-implementer agent files (2 errors now green). New integration tests (+8 PGlite cases: TV grant/revoke/isolation, Terminal release/download/license, Admin ticket-update/grantProduct-with-reason). Updated + extended E2E smoke spec (18 -> 28 tests: +5 new Phase 2.3 surfaces desktop + mobile).

| Gate | Command | Result |
|------|---------|--------|
| governance:check | `npm run governance:check` | PASS — 0 errors, 1 allowlisted historical warning (20260530-1042 aggregate is current phase; validates cleanly) |
| check:core | `npm run check:core` | PASS — 7 smokes |
| lint | `npm run lint` | PASS — exit 0 (fixed 2 errors: `getUserById` unused import in features/admin/queries.ts:15; `reason` unused var in features/tv/actions.ts:74) |
| typecheck (packages) | `npm run typecheck` | PASS — exit 0 |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 |
| secret:scan | `npm run secret:scan` | PASS — no findings |
| unit + integration tests | `npm test` | PASS — **171 passed / 5 skipped (176)** across 23 test files (+8 new: phase23-visible-progress; was 163/5/168 across 22 files) |
| coverage | `npm run coverage` | PASS — **24.33% stmts / 71.06% branch** (branch up from 69.64% in Phase 2.2; stmts dip as new Phase 2.3 UI pages grow denominator; branch above 70% for first time) |
| db:generate | `npm run db:generate -w @wtc/db` | PASS — 38 tables, "No schema changes" |
| build | `npm run build -w @wtc/web` | PASS — 44 routes compile cleanly |
| e2e | `npx playwright test` | PASS — **28/28** (14 desktop + 14 mobile; +10 Phase 2.3 specs; screenshots in tests/e2e/screenshots/) |
| db:migrate / db:seed / real-PG | NOT RUN | no DATABASE_URL / REAL_POSTGRES_DATABASE_URL / Docker |

## Real vs mock/dev tally (updated for Phase 2.3 final)

New PGlite-verified (this session):
- **TV:** `createTvGrant` writes grant row + tv_access.grant audit in-txn; `revokeTvGrant` stamps revokeReason on grant row + nulls profile currentGrantId + tv_access.revoke audit; per-user isolation confirmed.
- **Terminal:** `upsertTerminalRelease` exclusivity (old row isCurrent demoted to false when new current is promoted); `recordDownloadEvent` with entitlementVerified=true writes terminal.download audit with no secret in payload; `recordLicenseEvent` writes terminal.license_event audit with no plaintext secret.
- **Admin:** `updateSupportTicket` audit row has actorUserId=adminId + targetId=ticketId; `grantProduct(reason, validUntil)` populates PAE.reason + entitlement.expiresAt + audit.after.validUntil.

E2E verified (new Phase 2.3 surfaces):
- billing page: `Access event timeline` card present + `Mock checkout — hard disabled in production` labelled.
- admin/users: `User directory` heading + storage pill.
- admin/system-health: `Live bot control` + `TradingView automation` DISABLED pills always visible.
- admin/support: `Support ticket triage` heading + storage pill.
- admin/tradingview-access: `Manual grant/revoke only` copy present (updated from in-memory seeded row; demo mode = empty queue is correct).
- /app/indicators: `storage: in-memory (demo)` (updated from prior `in-memory (dev)` label change by Phase 2.3 implementer).
- /app/terminal: `WTC never gates your local Axioma order execution` callout visible; storage pill present; Download/Open-Journal buttons with `(dev placeholder)` text are DISABLED.
- /app/bots/tortila: Start/Stop buttons DISABLED + `Live controls are disabled by safety policy` text.

## Phase 2.3 tests-runner additions (must-lands scoped run)

New focused integration tests for the Phase 2.3 must-lands (no source-code changes; tests only):
- **`tests/integration/billing-webhook.test.ts`** — 4 PGlite tests covering BW-001 (valid `checkout.session.completed` grants entitlement + writes PAE row), BW-002 (tampered body rejected), BW-003 (wrong secret rejected), BW-004 (duplicate event id idempotent — no second PAE row).
- **`tests/integration/lms-fixes.test.ts`** — 5 PGlite tests covering F-02 (admin `actorUserId` threaded into `upsertEnrollment` audit row — not the enrolled student), F-03 (`markEnrollmentComplete` audit `targetId` is enrollment row id not courseId, `targetType=enrollment`), F-04 (`createCourse` with `teacherProfileId` populates `courses.teacher_profile_id`).

## Phase 2.2 additions (this session — implemented & gate-verified)
Driven by an **8-agent parallel audit fan-out** → operator-serial implementation (8 per-agent handoffs at epoch
`20260530-1042`, all cited in the aggregate). **Full LMS on the existing lean 38-table schema — no migration this phase.**
- **`@wtc/lms` domain layer** (pure, testable): error hierarchy, LEAN view types (mapped to real columns), ownership +
  fail-closed entitlement guards, progress/completion math. +7 unit tests.
- **LMS-UI repos** in `@wtc/db` (`updateCourse`/`setCoursePublished`/`createLesson`/`updateLesson`/`createMaterial`/
  `deleteMaterial`/`listLessonsForCourse`/`getCourseStudentList`/`listTeacherProfiles`/…), each with **in-txn audit**
  (all `education.*` codes already shipped in Phase 2.1). +7 PGlite tests.
- **`features/lms`** (`queries.ts` + `actions.ts`) on the Phase-2.1 `getServerDb()` selector — real Postgres when
  `DATABASE_URL` set, honest labelled demo otherwise; every mutation: assertCsrf → Zod → requireUser → RBAC → ownership
  (admin bypass) → repo → revalidate; student actions add a fail-closed entitlement check.
- **Real teacher/student/admin surfaces** (placeholders → real): `/teacher/courses`, `/teacher/courses/[id]` (publish +
  lessons + materials + roster), `/teacher/students`, `/admin/education` (overview + manual-enrol override), and the new
  `/app/education/[courseId]` + `/app/education/[courseId]/[lessonId]` (enrol, progress, mark-complete; video as a safe
  link; body escaped). Student rosters show **displayName + progress only — never email**.
- **Architecture (transparent):** used the `getServerDb()` + `features/lms` + `@wtc/lms` pattern (consistent with the
  Phase-2.1 bot-config/support surfaces) rather than expanding the 4-method `lmsService` 3-adapter — same DB/demo/
  fail-closed guarantees, less code. The thin `lmsService` is unchanged.
- **PART A truth cleanup:** 39→**38 tables** (0002 = 17 CREATE + 1 ALTER); removed stale "Phase 1.8 — Full LMS" entries;
  corrected the "Still NOT deployable" list (ES256/JWKS + revoke cols + LMS-DB landed in Phase 2.1).
- **Staged (Phase 3):** rich LMS columns (migration 0003: slug/level/tags/content_type/embed/file-meta/global-pinned/
  progress-state-machine) + the rich UI (embed players, file upload, global community links, auto-progress, slug URLs).

## Verified gates (Phase 2.2 — final post-implementation run, sequential on the final tree)
- `npm run governance:check` → **PASS** (current phase 20260530-1042; **8 cited** per-agent handoffs; 0 errors, 1 allowlisted historical warning).
- `npm run check:core` → **PASS** (7 smokes). `npm run lint` → **PASS**. `npm run typecheck` + `-w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **154 passed / 5 skipped (159)** across 20 files (+14: 7 `@wtc/lms` pure, 7 `lms-service` PGlite; was 140/5).
- `npm run secret:scan` → **PASS**. `npm run coverage` → **28.16% stmts / 69.64% branch** (stmts dip as new UI/actions grow the denominator; e2e-covered; branch held).
- `npm run db:generate -w @wtc/db` → **PASS** (**38 tables**; "No schema changes" — no migration this phase).
- `npm run build -w @wtc/web` → **PASS** (all routes incl. the new LMS pages). `npm run e2e` → **PASS 18/18** (desktop + mobile; +1 LMS spec).
- `db:migrate`/`db:seed`/real-PG → **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent). `npm ci` NOT re-run.

## Phase 2.1 additions (this session — implemented & gate-verified)

Driven by a **12-agent parallel audit fan-out** (agents-before-edits) → operator-serial implementation.
The 12 per-agent handoffs at epoch `20260530-0925` are all cited in the aggregate
([`20260530-0925-phase-2-1-platform-spine-product-surfaces.md`](handoffs/20260530-0925-phase-2-1-platform-spine-product-surfaces.md)).
_(An earlier read-only tests-runner gate run captured the **pre-implementation** baseline; the figures below are the
final post-implementation run.)_

- **Migration `0002` (additive) — generated + PGlite-verified.** 17 new tables (`bot_config_versions`,
  `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, `bot_safety_events`, `teacher_profiles`,
  `enrollments`, `lesson_progress`, `pinned_links`, `tradingview_profiles`, `tradingview_access_grants`,
  `product_access_events`, `terminal_release_cache`, `terminal_download_events`, `terminal_license_events`,
  `notifications`, `support_tickets`) + 1 ALTER (`tradingview_access_requests` +`revoked_at`/`revoked_by`) +
  the `teacher_profiles` backfill + `pinned_links` CHECK. `0000`/`0001` untouched; `owner_teacher_id` retained.
- **~40 new `@wtc/db` repositories** (bots/education/TV/products/terminal/ops/billing), each with **in-txn audit**.
  `grantProduct`/`revokeProduct` now write `product_access_events` (+ optional `actorUserId`); `addExchangeKey` now
  writes its in-txn audit row (was missing); `revokeTv` now persists `revoked_at`/`revoked_by` (Phase-1.7 debt cleared).
- **`@wtc/billing` Stripe adapter** — real `Stripe-Signature` webhook verify + event parse + idempotency
  (`applyStripeEvent`, ledgered on `audit_logs`); checkout is an honest not-configured error (never faked). +8 tests.
- **`@wtc/axioma-bridge` ES256/JWKS** — ECDSA P-256 signer + `buildJwks` (public JWK only; hard `!('d' in jwk)`
  assertion) + public `/.well-known/axioma-jwks.json` route. HS256 stub still prod-throwing. +7 tests.
- **Security hardening** — Phase-2.1 `AUDIT_ACTIONS`, `redact.ts` SECRET_HINTS (operator-omitted `iv`/`tag` — see
  aggregate), and `rbac.ts` Resource tokens + MATRIX rows.
- **2 new real product surfaces** — `/app/bots/[bot]/settings` (real config form + version history + safety log via
  `saveBotConfig`/`listBotConfigVersions`/`listBotSafetyEvents`) and `/app/support` (ticket create/list + notifications).
  Both use the new `getServerDb()` accessor: real Postgres when `DATABASE_URL` is set, an **honest labelled demo state**
  otherwise. WTC-DB-only; no live bot control.
- **Staged (Rule 7 — designed + repo-backed, UI NOT built this session):** full `@wtc/lms` 22-method contract (S-4) +
  LMS surfaces (P-A); billing UI + webhook route (P-B); TV grants/profiles UI (P-E); admin panels (P-F admin);
  terminal DB-wiring (P-D). See the aggregate "Next actions".

## Verified gates (Phase 2.1 — final post-implementation run, sequential on the final tree)
- `npm run governance:check` → **PASS** (current phase 20260530-0925; **12 cited** per-agent handoffs all present; 0 errors, 1 allowlisted historical warning).
- `npm run check:core` → **PASS** (7 smokes). `npm run lint` → **PASS**. `npm run typecheck` + `-w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **140 passed / 5 skipped (145)** across 18 files (+34: 19 `db-0002`, 8 `stripe`, 7 `es256`; was 106/5).
- `npm run secret:scan` → **PASS**. `npm run coverage` → **33.21% stmts / 69.48% branch** (↑ from 26.74 / 67.47).
- `npm run db:generate -w @wtc/db` → **PASS** (generated `0002_sour_paibok.sql`; re-run = "No schema changes" — in sync).
- `npm run build -w @wtc/web` → **PASS** (all routes incl. the new settings/support pages + the JWKS route).
- `npm run e2e` (Playwright, `CI=1`) → **PASS 16/16** (desktop + mobile; new pages render their honest demo state).
- `db:migrate`/`db:seed` against **real Postgres** → **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent). `npm ci` NOT re-run.

---

## Phase 2 additions (this session)
- **14-agent design/audit fan-out (agents before edits).** One parallel Wave-1 fan-out produced the complete
  Phase-2 blueprint + write-ownership map across all 12 parts — 14 per-agent handoffs at epoch `20260530-0126`
  (all cited in the aggregate; `governance:check` confirms 14 cited handoffs present). Design docs updated by the
  owning agents (PRODUCT/SITEMAP/MVP/ARCHITECTURE/DATA_MODEL/SECURITY/RBAC/BOT/CANONICAL_ANALYTICS/AXIOMA/BILLING/
  ENTITLEMENT/EDUCATION/TV/BACKTESTER + new `UX_SPEC_PHASE2.md`, `TERMINAL_PRODUCT_AREA.md`, `TEST_PLAN_PHASE2.md`).
- **Implemented + verified vertical: Part 4 unified analytics + Parts 2/3 read-only bot dashboards** (operator-serial,
  no migration — uses existing `@wtc/analytics` + `@wtc/bot-adapters` mock adapters).
  - `@wtc/analytics`: **P0 GAP-F fixed** — `filterZeroEquity` applied before `computeDrawdown` (artifact `equity<=0`
    rows can no longer fabricate a ~100% drawdown). Added (additive, no field/semantic break) `netPnlWithFees`
    (fees subtracted as positive cost — never overstates), `firstEquity`/`roiPctSinceStart`, `avgWin`/`avgLoss`/
    `expectancy`, `safetyEventCount`, extended optional `CanonicalPosition`/`CanonicalTrade` fields, and
    `combineMetrics`/`mergedProfitFactor`/`isDataStale`. +13 unit tests (`metrics.test.ts`).
  - `@wtc/bot-adapters`: optional `getEquityCurve?` (Tortila curve; Legacy honest `[]`); Tortila mock enriched.
  - `apps/web`: real **bot dashboard sub-tabs** (`positions`/`trades`/`equity`/`safety`, replacing placeholders) +
    a `BotSubNav` + the **unified combined-portfolio** card on `/app/bots` (`combineMetrics`, gated to entitled
    bots; win-rate/PF shown per bot, never averaged). Capability-aware: Legacy shows honest "not available" for
    backtester/trade-history/equity — never fabricated. New `features/bots/{meta.ts,data.tsx}`.
- **Staged (designed, NOT built this session — Rule 7):** migration `0002` (18 tables + 1 ALTER), full LMS (Part 8),
  billing repos/Stripe adapter (Part 9), terminal/Axioma pages (Part 6), TV grants/profiles UI (Part 7).

## Verified gates (Phase 2 — sequential run on the final tree)
- `npm run governance:check` → **PASS** (current phase 20260530-0126; **14 cited** per-agent handoffs all present; 0 errors, 1 allowlisted historical warning).
- `npm run check:core` → **PASS** (7 smokes). `npm run lint` → **PASS**. `npm run typecheck` + `-w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **106 passed / 5 skipped (111)** across 15 files (+13 `packages/analytics/src/metrics.test.ts`; was 93/5).
- `npm run secret:scan` → **PASS**. `npm run coverage` → **26.74% stmts / 67.47% branch** (branch ↑ from 64.67; analytics 88.73% branch).
- `npm run build -w @wtc/web` → **PASS** (all routes; bot sub-tabs now real pages).
- `npm run e2e` (Playwright, `CI=1`) → **PASS 16/16** (desktop + mobile; +1 sub-tab/combined-view spec ×2).
- `db:migrate`/`db:seed` against **real Postgres** → **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent). `npm ci` NOT re-run.

## Phase 1.7 additions (this session — Part E)
- **TradingView web UI is now DB-backed.** New async `TvService` (`apps/web/src/lib/tv-types.ts`) with a DB
  adapter (`db-store.ts`) over the existing `@wtc/db` TV repos and an in-memory dev adapter (`demo.ts`); the
  `backend.ts` selector uses DB when `DATABASE_URL` is set, memory otherwise, and **fails closed in production**
  (denied stub throws the byte-identical `DENIED_MSG`). Indicators / admin-TV / admin pages are `await`ed and
  their `storage:` badge is driven by `backendMode`. `submitTvRequest`/`grantTv`/`revokeTv` now write
  `audit_logs` rows **in the same transaction** (`tradingview.submit`/`.grant`/`.revoke`; admin actor recorded);
  `revokeTv` actor/time made live; `rowToTvDto` normalizes `Date`→epoch-ms (no Date leaks to the client).
- **LMS DB-wired — Option 1 (thin model), no migration.** The pre-existing `courses`/`lessons`/`materials`
  tables (migration `0000`) back 4 new repos: `createCourse` (txn+audit `education.course_create`),
  `listCoursesForTeacher` (owner/admin), `listPublishedCourses`, `listLessonsForStudent` (fail-closed). Async
  `LmsService` selector mirrors TV (fail-closed). `/teacher` + `/app/education` awaited (per-row lesson fetch →
  `Promise.all`). **NOT the full contract** — `teacher_profiles`/`enrollments`/`lesson_progress`/`pinned_links`
  + progress/completion persistence landed in **Phase 2.1** (repos) and the **Phase 2.2** UI.
- **TradingView manual-workflow decision:** revoke is a manual admin action; the worker sweep queues
  `tradingview_access_tasks` rows that remain **informational / unconsumed** (no executor; `job_queue`
  RESERVED). No mark-done/cancel control added (`docs/TRADINGVIEW_ACCESS_PLAN.md`).
- **Source-of-truth cleanup (Part A):** `SECRET_VAULT_DESIGN.md` (env names `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID`;
  per-keyId `WTC_VAULT_KEK_*` scheme → TARGET; crypto takes the KEK as an argument; `SealedSecret` base64),
  `NEXT_ACTIONS.md` (stale counts → defer to STATUS; boot `loadEnv` DONE in 1.6.1), `DATA_MODEL.md:843`
  (`schema/ops.ts` → TARGET), `MVP_SCOPE.md` (`job_queue` RESERVED), `OPEN_QUESTIONS.md` (KEK env name).
- **CI (historical Phase 1.6.1, superseded by Phase 4.61):** `REAL_POSTGRES_DATABASE_URL` mapped to a fresh `wtc_test` (dropped/created before Test + Coverage) so
  the opt-in real-PG harness no longer silently skips - **STAGED + UNVERIFIED at that time**; current GitHub CI for the
  merged WTC tree is recorded in the Phase 4.61 section.

## Verified gates (Phase 1.7 — clean SEQUENTIAL run on the final tree; artifacts safe-cleaned first; `npm ci` NOT re-run)
- Pre-step: no :3100/:3000 listener; removed generated-only `apps/web/.next`, `test-results`, `coverage`.
- `npm run governance:check` → **PASS** (current phase 20260529-2352; **max 7 ≤ 7 cited** per-agent handoffs; 0 errors, 1 informational warning = allowlisted 1921 historical handoff).
- `npm run check:core` → **PASS** (7 smokes). `npm run lint` → **PASS**. `npm run typecheck` + `-w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **93 passed / 5 skipped (98)** across 14 files (`db-persistence` now 19: +5 TV [audit/DTO/admin-list/revoke/sweep-idempotency], +4 LMS [create+audit/teacher-admin-visibility/published-only/fail-closed-lessons]).
- `npm run secret:scan` → **PASS** (clean). `npm run coverage` → **26.92% stmts / 64.67% branch** (branch ↑ from 63.77).
- `npm run build -w @wtc/web` → **PASS** (compiled 12.1s; 31/31 pages) — doubles as the no-secrets `instrumentation.ts` acceptance check.
- `npm run e2e` (Playwright, `CI=1`) → **PASS 14/14** (desktop + mobile; +indicators/education/teacher specs; no flake).
- `db:migrate`/`db:seed` against **real Postgres** -> **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent). Opt-in harness skipped (5 cases). Historical CI mapping was staged but unverified in this Phase 1.7 entry; current GitHub CI is Phase 4.61.

## Phase 1.6.1 additions (prior session)
- **governance:check strengthened:** the N-agent claim is now backed by per-agent handoff links **actually
  cited in the current aggregate** (not merely epoch files on disk); a current-epoch per-agent handoff the
  aggregate fails to cite now **fails** the gate (unless allowlisted / marked superseded). Pure logic
  refactored into an exported `evaluateGovernance()` with **7 fixture self-tests**
  (`tests/integration/check-governance.test.ts`).
- **Runtime config validation made real:** `apps/web/instrumentation.ts` runs `loadEnv()` at server **boot**
  (Next 15 does not call `register()` during `next build` — verified: secret-less build stays green), making
  the base64-32 `SECRET_VAULT_KEK` check non-theoretical. Added direct `isBase64Key` unit tests. Lazy
  fail-closed vault unchanged.
- **Remaining contract drift → TRUTH:** TradingView contract multi-file layout
  (`service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts`) labelled **TARGET** (current = single
  `index.ts` + DB repos); DATA_MODEL `schema/<x>.ts` split + `backtest_jobs`/`backtest_results` labelled
  TARGET (current = single `schema.ts`); backtester `schema/ops.ts` TARGET; SECRET_VAULT_DESIGN KEK hex →
  base64-32; worker comments corrected (cron-style direct calls; `job_queue` RESERVED/unconsumed).
- **Real-Postgres gate prepared, not faked:** opt-in `tests/integration/db-real-postgres.test.ts`
  (`describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`) covering migrate/seed/FK-cascade/unique-entitlement/
  session-destroy/**cross-connection concurrent grantProduct**/pool-teardown. Skipped here (no DB URL).

## Verified gates (Phase 1.6.1 — clean SEQUENTIAL run on the final tree; artifacts safe-cleaned first; `npm ci` NOT re-run)
- Pre-step: no :3100/:3000 listener; removed generated-only `apps/web/.next`, `test-results`, `coverage`.
- `npm run governance:check` → **PASS** (current phase 20260529-2228; max 6 ≤ 6 **cited** per-agent handoffs; 0 errors, 1 informational warning = allowlisted 1921 historical handoff).
- `npm run check:core` → **PASS**. `npm run lint` → **PASS**. `npm run typecheck` + `-w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **84 passed / 5 skipped (89)** across 14 files (new: `check-governance.test.ts` 7; `isBase64Key` cases; `db-real-postgres.test.ts` 5 real-PG cases skipped + 1 availability test; `db-persistence` 10/10).
- `npm run secret:scan` → **PASS** (clean; the harness example URL uses a `<credentials>` placeholder, not basic auth).
- `npm run coverage` → **26.96% stmts / 63.77% branch** (↑ from Phase 1.6's 24.76 / 60.89).
- `npm run build -w @wtc/web` → **PASS** (Compiled ~4s; 31/31 pages) — **doubles as the no-secrets `instrumentation.ts` acceptance check** (no `SECRET_VAULT_KEK` ⇒ `register()` not run at build).
- `npm run e2e` (Playwright, `CI=1`) → **PASS 10/10** (desktop + mobile; no flake this run).
- `db:migrate`/`db:seed` against **real Postgres** → **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent). Opt-in harness ready (skipped).

> Honesty note: NOT production-ready. A local **PostgreSQL 17** now runs on this host (`127.0.0.1:5432`),
> but its credentials are unknown to the build agent and Docker is absent — so the DB path is still
> verified via **PGlite** (in-process Postgres) running the real generated SQL. Real
> `db:migrate`/`db:seed` against Postgres = **NOT RUN (awaiting credentials)**. See "Still NOT deployable".

## Phase 1.6 additions (this session)
- **Governance enforcement:** new `npm run governance:check` (`scripts/check-governance.mjs`, zero-dep,
  fs-only) verifies the current aggregate's cited per-agent handoffs all exist, numeric "N-agent" claims
  are backed by ≥N files at that epoch, and canonical headings (normalised, required-subset). STRICT for
  the current phase, INFORMATIONAL for grandfathered handoffs. Wired into `ci:local` + `ci.yml`.
- **DB race safety:** `grantProduct` now uses `onConflictDoUpdate` on `(user_id, product_code)`
  (idempotent under concurrent grants; no unique-violation throw; audit row still in-txn). `createUser`
  maps a concurrent duplicate-email unique violation (SQLSTATE 23505) to the friendly error. +3 PGlite
  concurrency tests.
- **Security config:** `SECRET_VAULT_KEK` is validated as a **base64 32-byte** key at config load in all
  environments (`isBase64Key` in `@wtc/shared`), matching `@wtc/crypto` `parseKek`. Test fixture + CI KEK
  gen fixed to real 32-byte base64. +4 KEK tests, +1 Axioma HS256 prod-throw test.
- **Truth cleanup:** removed false current claims — `/admin/tradingview-access` now states memory-backed
  (DB wiring deferred); `/app/bots` list shows the `BOT_ADAPTER_MODE=mock` "Simulated data" banner; docs
  corrected (PostgreSQL 16→17, SKIP LOCKED / job_queue poll / durable-queue, `apps/web/api`, "read-only
  methods available immediately", TradingView "DB-backed; fully implemented", `BOT_ADAPTER_MODE=real`).

## Verified gates (Phase 1.6 — prior session 20260529-2052; `npm ci` NOT re-run, node_modules already present)
- `npm run governance:check` → **PASS** (0 errors; 1 informational warning = allowlisted historical handoff).
- `npm run check:core` → **PASS** (7 zero-install smokes).
- `npm run lint` → **PASS** (exit 0; ESLint 9 flat config; new `.mjs` Node-globals override for `scripts/`).
- `npm run typecheck` (packages) + `npm run typecheck -w @wtc/web` → **PASS** both.
- `npm test` (Vitest) → **72/72** across 12 files (PGlite DB integration now **13/13** incl. 3 new concurrency tests — idempotent concurrent grant, per-call grant audit, concurrent duplicate-email; +4 KEK base64-32 shape/entropy tests; +1 Axioma HS256 prod-throw test).
- `npm run build -w @wtc/web` → **PASS** (compiled successfully in ~5s; 31/31 pages generated).
- `npm run e2e` → **10/10** (desktop + mobile). Chromium already installed.
- `npm run secret:scan` → **PASS** (secretlint, clean).
- `npm run coverage` → **24.76% stmts / 60.89% branch** (slight dip from 25.07 / 61.26: the new, uncovered `scripts/check-governance.mjs` is counted in the denominator; security/DB core coverage rose; 80% target aspirational, not enforced).
- `npm run db:generate -w @wtc/db` → not re-run this phase (no schema change; 2 migrations, 21 tables unchanged).
- `db:migrate` / `db:seed` against **real Postgres** → **NOT RUN** (local PG17 present but credentials unknown; Docker absent). Equivalent SQL verified via the PGlite integration test.

### Phase 1.5 baseline (prior session, after a fresh `npm ci`)
- `npm ci` PASS (368 pkgs). `npm run ci:local` PASS end-to-end. `npm test` 64/64. `npm run e2e` 10/10. Coverage 25.07 / 61.26.

## Governance (Phase 1.5 — Part A)
- New [`docs/SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md): 8 binding rules (agents-before-edits, the "N-agent" honesty rule, per-agent + aggregate handoffs, close-agents-before-final, new-session-per-phase, stop-on-overrun, gates RUN/NOT-RUN). `AGENTS.md` carries the rules + a reconciled canonical handoff format; the seed points to it.
- **Honesty correction:** the prior "6-agent"/"5-auditor" claims (which had **no** per-agent handoff files) are restated as "N review areas in one session". Phase 1.5's own audit has one handoff per agent: `docs/handoffs/20260529-1921-*.md` (7 auditors + 2 implementers).

## Persistence + correctness (Parts C/D)
- `@wtc/db` repositories now **transactional**: `grantProduct`/`revokeProduct` (entitlement change + audit row in one txn), `createUser` (user + roles, in-txn dup check), `addExchangeKey` (account + sealed secret). `destroySession` is `async` and **awaited** at logout.
- `entitlements` has a **UNIQUE** index on `(user_id, product_code)` (migration `0001`); seed entitlement inserts are `onConflictDoNothing` (idempotent re-seed).
- `drizzle.config.ts` localhost fallback **removed** (no accidental migration of an unintended Postgres). `job_queue` documented **RESERVED / not-yet-consumed** (no fake durable queue; cron-style worker calls + `tradingview_access_tasks` are the current mechanism).
- Core users/sessions/entitlements/audit/exchange-keys go through the DB backend when `DATABASE_URL` is set, in-memory otherwise (fail-closed in production). **TradingView + LMS web UI remain in-memory** (Phase 1.5 deferred Part E) and now show an explicit "storage: in-memory (demo)" badge.

## Security hardening (Part F)
- **`__Host-` session cookie wired** in production (`apps/web` now derives the name from `sessionCookieName(isProd)` — realises ADR-007). Dev stays `wtc_session` over http.
- **Secret quality:** `@wtc/shared` rejects placeholder **and** low-entropy/repeated secrets; `@wtc/config` `loadEnv` enforces this in production and **requires** `AXIOMA_HANDOFF_SIGNING_SECRET`.
- **Axioma HS256** signer now **throws in production** (dev-stub only until ES256/JWKS exists). Console audit writer throws in production. Demo credentials hidden from production login HTML. `addExchangeKey` audit no longer carries raw key material (defence-in-depth beyond redaction).

## Product-truth UI (Part G)
- Public top bar status is **environment-aware** ("demo environment" vs "ecosystem online"). Mock bot dashboards show a **"Simulated data — not a live account"** banner + warn pill. Mobile nav renders **"soon"** markers (parity with desktop). Public products show an **availability taxonomy** (demo / planned). Placeholder Terms/Privacy carry a **DRAFT** banner. Backend source badge confirmed present.

## Environment facts
- Host: Windows 11, Node v24.15.0, npm 11.12.1. **Not a git repo** (`.git` absent → `.github/workflows/ci.yml` is staged but inert until git + a remote exist; local equivalent is `npm run ci:local`). pnpm/turbo absent → npm workspaces.
- **PostgreSQL 17** service running on `:5432`; `psql` at `C:\Program Files\PostgreSQL\17\bin`; credentials unknown to the agent; Docker not installed.
- Live server NOT touched; discovery from documented snapshot + local repos only.

## Real vs mock/dev (honest)
- **Real + verified (tests/build/e2e):** fail-closed entitlement state machine, envelope vault (AES-256-GCM), RBAC + `assertAdmin`, audit redaction + transactional DB audit, analytics, Argon2id + opaque sessions, session-bound CSRF, `__Host-` cookie logic, secret-quality guards, Axioma handoff token (HS256 **dev stub**, now prod-fenced), billing webhook signature/idempotency logic + applyStripeEvent idempotency (BW-001/BW-004 PGlite-verified), LMS audit-actor correctness (F-02/F-03/F-04 PGlite-verified), TV grant/revoke/isolation (TV-1/TV-2/TV-3 PGlite-verified), terminal release exclusivity + download/license events (TRM-1/TRM-2/TRM-3 PGlite-verified), admin ticket-update audit + grantProduct reason/validUntil (ADM-1/ADM-2 PGlite-verified), the Next app (build + e2e), `@wtc/db` repositories incl. transactions + unique constraint (PGlite-integration-tested). **As of Phase 1.7 the TradingView access web UI + the LMS thin model (courses/lessons) run through async DB-backed services** (`TvService`/`LmsService` — fail-closed selectors in prod, in-memory dev fallback; TV submit/grant/revoke + course-create audited in-txn) — PGlite-integration-tested + e2e-smoked.
- **Real interface + mock/dev backend (NOT production-wired):** bot adapters (real HTTP stubbed `AdapterNotReadyError`), Axioma bridge (mock; dev placeholder), billing provider (mock; self-grant dev-only), backtester. Web app default runtime here = in-memory demo (no DB creds) — so TV + LMS-thin also run via their **in-memory adapter** in THIS environment, though the DB path is wired + PGlite-tested + fails closed in production.
- **Disabled by safety policy:** live bot control (always throws), TradingView automation (manual queue), real adapters (`BOT_ADAPTER_MODE=mock` default).

## Still NOT deployable to production until
- Real Postgres path run (`db:migrate`/`db:seed` against Postgres + a postgres-js integration job) — currently NOT RUN (no creds). Real secrets provided (KEK/SESSION/Axioma — app fails closed without them, and now also rejects low-entropy ones).
- **LMS** — TradingView + LMS DB landed (Phase 1.7 thin → **Phase 2.1** full DB repos incl. `enrollments`/`lesson_progress`/`teacher_profiles`/`pinned_links` + `revoked_at`/`revoked_by`; **Phase 2.2** full teacher/student/admin LMS UI). Remaining: the real-Postgres run; a TradingView task-runner executor.
- Axioma **ES256/JWKS signer + JWKS route landed (Phase 2.1)** — needs a provisioned P-256 key; bot adapter real read-only mappings + legacy plaintext-key fix upstream; the **billing webhook route** (the Stripe adapter landed in Phase 2.1); auth rate-limiting middleware; CI activated (needs git + GitHub remote).

See `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md`, `docs/OPEN_QUESTIONS.md`, `docs/NEXT_ACTIONS.md`.
