# production-boundary-auditor handoff
## Scope
Phase 4.61 read-only production boundary audit for the current WTC bot completion lane.
This audit classifies what can continue immediately after Phase 4.60 and what requires
explicit target/source/production credentials or operator approval.

Boundaries honored in this audit: no SSH, no systemd/service/tmux/screen commands, no
production DB access, no provider probes, no live bot controls, no exchange calls, no
process control, no secrets printed, and no product/source edits. The only artifact
created is this required handoff.

## Files inspected
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `package.json`
- `.github/workflows/ci.yml`
- `scripts/gates.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/safe-preview.mjs`
- `scripts/redacted-child-process.mjs`

## Files changed
None - read-only audit. This handoff file is the required audit artifact only; no
product code, runtime code, configs, contracts, or status docs were edited.

## Findings
1. Severity P0 - Phase 4.60 is local release-readiness proof, not production completion.
   Evidence: Phase 4.60 states "Full production-ready status is still not claimable" and
   keeps CI/deploy, production journal secret provisioning, firewall/network proof,
   monitoring/burn-in, canonical Tortila source, and Legacy source proof as separate gates
   (`docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:50`,
   `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:125`).
   Recommendation: continue with merge/main CI/local docs or with one explicit external
   gate, but do not relabel Phase 4.60 as production done.
   Target part: release orchestration.

2. Severity P0 - The next safe no-prod-touch actions are repo/GitHub and local gates.
   Evidence: Phase 4.60 observed `npm run ci:local`, `npm run accept:bots:local`, and
   `npm run accept:tortila:real-read:managed` green locally
   (`docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:118`,
   `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:119`,
   `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:120`).
   The deployment checklist also names local verification as doable now
   (`docs/DEPLOYMENT.md:531`, `docs/DEPLOYMENT.md:533`, `docs/DEPLOYMENT.md:535`).
   Recommendation: allowed now means merge/review/CI/local docs/gate reruns, not live
   server operations.
   Target part: operator sequencing.

3. Severity P0 - CI on `main` is allowed as a verification boundary, not as deployment.
   Evidence: `.github/workflows/ci.yml` triggers on push and PR to `main`, has `gates`
   and `e2e` jobs, and the inspected workflow contains no SSH/systemd/deploy job
   (`.github/workflows/ci.yml:6`, `.github/workflows/ci.yml:8`). It uses a GitHub
   service Postgres and ephemeral test values, not production infrastructure
   (`.github/workflows/ci.yml:15`, `.github/workflows/ci.yml:31`,
   `.github/workflows/ci.yml:68`, `.github/workflows/ci.yml:83`).
   Recommendation: merging the ready PR to `main` and observing GitHub Actions is allowed
   if branch protection/review policy permits it. Treat any new deploy workflow or secret
   environment as a separate explicit-approval phase.
   Target part: GitHub/CI boundary.

4. Severity P0 - Live bot controls remain prohibited until the named control gates are
   complete. Evidence: all control methods stay disabled until required gates pass and
   `BOT_CONTROL_ENABLED=true` must not be set before audit completion
   (`docs/BOT_CONTROL_SAFETY_MODEL.md:17`, `docs/BOT_CONTROL_SAFETY_MODEL.md:20`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:95`). The same model marks SSH/systemd/tmux,
   `.env` mutation, exchange orders, exchange key reads, and `/api/marks` as never or
   prohibited actions (`docs/BOT_CONTROL_SAFETY_MODEL.md:28`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:35`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:36`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:37`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:39`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:40`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:262`,
   `docs/BOT_CONTROL_SAFETY_MODEL.md:266`).
   Recommendation: no start/stop/apply-config/test-connection/exchange-ping work in this
   phase.
   Target part: bot control safety.

5. Severity P0 - Tortila production read-only is still an external gate. Evidence: WTC
   can use `BOT_ADAPTER_MODE=read-only` only with `TORTILA_JOURNAL_URL`, and
   production-like environments require `JOURNAL_READ_TOKEN`
   (`docs/CONTRACTS/tortila-adapter.md:7`, `docs/CONTRACTS/tortila-adapter.md:8`).
   The contract says the current token proof is local adjacent source only and production
   requires canonical source landing, deployment secret provisioning, WTC bearer use, and
   firewall/private-network proof (`docs/CONTRACTS/tortila-adapter.md:34`,
   `docs/CONTRACTS/tortila-adapter.md:40`,
   `docs/CONTRACTS/tortila-adapter.md:47`).
   Recommendation: do not probe a production journal or promote real adapter mode without
   the exact canonical repo/source, target URL, secret, firewall rule, and retained
   positive/negative probe plan.
   Target part: Tortila adapter/deploy boundary.

6. Severity P0 - Tortila `/api/overview` and `/api/marks` remain outside current WTC
   runtime proof. Evidence: the Tortila contract keeps `/api/overview` out because it can
   bundle mark-price data, and marks is never consumed because it calls BingX through the
   bot-owned exchange connection (`docs/CONTRACTS/tortila-adapter.md:69`,
   `docs/CONTRACTS/tortila-adapter.md:71`,
   `docs/CONTRACTS/tortila-adapter.md:254`,
   `docs/CONTRACTS/tortila-adapter.md:258`,
   `docs/CONTRACTS/tortila-adapter.md:427`,
   `docs/CONTRACTS/tortila-adapter.md:429`,
   `docs/CONTRACTS/tortila-adapter.md:450`,
   `docs/CONTRACTS/tortila-adapter.md:464`).
   Recommendation: keep static guards and runner allowlists; do not add live marks or
   overview probes as "production proof."
   Target part: Tortila data contract.

7. Severity P0 - Legacy production read/live analytics remain blocked by source and
   security boundaries. Evidence: the current Legacy path is read-only DB snapshots with
   no start/stop/retest/apply config (`docs/CONTRACTS/legacy-bot-adapter.md:6`,
   `docs/CONTRACTS/legacy-bot-adapter.md:25`). The direct HTTP/control adapter remains
   blocked; future HTTP acceptance may use only read endpoints and excludes retest,
   start/stop, and stage-config writes (`docs/CONTRACTS/legacy-bot-adapter.md:79`,
   `docs/CONTRACTS/legacy-bot-adapter.md:81`). Legacy has no closed-trade history endpoint,
   and direct HTTP unblocking requires the upstream plaintext-key/service-account fix plus
   all safety gates (`docs/CONTRACTS/legacy-bot-adapter.md:295`,
   `docs/CONTRACTS/legacy-bot-adapter.md:403`,
   `docs/CONTRACTS/legacy-bot-adapter.md:409`,
   `docs/CONTRACTS/legacy-bot-adapter.md:414`,
   `docs/CONTRACTS/legacy-bot-adapter.md:475`,
   `docs/CONTRACTS/legacy-bot-adapter.md:476`).
   Recommendation: do not implement realized Legacy analytics/import until a valid
   source artifact names stable closed-trade fields and provider scoping.
   Target part: Legacy analytics/import boundary.

8. Severity P1 - Local bot/admin gates are explicitly scrubbed and no-live. Evidence:
   `scripts/gates.mjs` labels local bot/admin modes as "LOCAL MOCK/NO-LIVE ONLY" and
   refuses managed DB/source/live/deploy/CI/production-shaped env in those modes
   (`scripts/gates.mjs:65`, `scripts/gates.mjs:68`, `scripts/gates.mjs:108`,
   `scripts/gates.mjs:110`). It forces `BOT_ADAPTER_MODE=mock`,
   `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and
   `LEGACY_LIVE_READS_ENABLED=false` (`scripts/gates.mjs:120`,
   `scripts/gates.mjs:121`, `scripts/gates.mjs:123`).
   Recommendation: use these local gates freely after repo changes; do not pass live
   env into them.
   Target part: local gate safety.

9. Severity P1 - The Tortila real-read managed runner is allowed only as a local
   throwaway proof, not a production probe. Evidence: its usage requires
   `TORTILA_REAL_READ_ADMIN_DATABASE_URL`, creates a fresh
   `wtc_test_tortila_real_read_*` DB, and states no live bot controls, no provider probes,
   no `/api/marks`, and no production DB targets (`scripts/run-tortila-real-read-managed.mjs:19`,
   `scripts/run-tortila-real-read-managed.mjs:23`,
   `scripts/run-tortila-real-read-managed.mjs:26`). It refuses invalid/admin-target misuse
   and fails if `/api/marks` or `/api/overview` is requested
   (`scripts/run-tortila-real-read-managed.mjs:39`,
   `scripts/run-tortila-real-read-managed.mjs:54`,
   `scripts/run-tortila-real-read-managed.mjs:456`,
   `scripts/run-tortila-real-read-managed.mjs:459`).
   Recommendation: rerun only after adapter/worker/journal/auth changes and only against
   a local maintenance DB that creates/drops `wtc_test_*`.
   Target part: Tortila proof runner.

## Decisions
1. Allowed now without additional prod credentials:
   - Merge/review the existing PR or branch into `main` if policy allows, then observe
     GitHub Actions `gates` and `e2e`; this is CI verification only, not deployment.
   - Update local docs/handoffs/PR notes to reflect exact RUN/NOT RUN gate truth.
   - Run read-only repo inspections: `git status --short --branch`, `git diff --stat`,
     `git diff --check`, `git log --oneline -n 5`, `rg`, and `Get-Content`.
   - Run local quality gates: `npm run governance:check`, `npm run secret:scan`,
     `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`,
     `npm run typecheck -w @wtc/worker`, `npm test`, `npm run build -w @wtc/web`,
     and `npm run ci:local`.
   - Run local no-live bot gates: `npm run accept:bots:local`,
     `npm run accept:bots:rendered`, and `npm run accept:bots:continuity:contract`.
   - Run local browser smoke: `npm run e2e` or `npm run preview:safe`, with the existing
     mock/no-live defaults.
   - Run managed local throwaway gates only when their admin URL points to a local
     maintenance DB and the runner creates/drops `wtc_test_*`: `npm run
     accept:tortila:real-read:managed`, `npm run accept:worker:continuity:managed`,
     `npm run e2e:admin-user-bots:db:managed:user-routes`, and `npm run
     e2e:admin-user-bots:db:managed:matrix`.

2. Requires explicit target/source/production credentials or approval:
   - Any production or preview `DATABASE_URL`, `REAL_POSTGRES_*`,
     `AUDIT_APPEND_ONLY_*`, `ADMIN_USER_BOTS_E2E_*`, or worker/admin DB URL.
   - Any production `db:migrate`, `db:seed`, backup/restore, canary switch, nginx/TLS,
     firewall, monitoring, burn-in, or worker/service rollout.
   - Canonical Tortila source landing: exact git repo/path/remote/branch/source bundle.
   - Production Tortila `JOURNAL_READ_TOKEN`, `TORTILA_JOURNAL_URL`, WTC bearer wiring,
     firewall/private-network proof, and authorized positive/negative probes.
   - Legacy closed-trade source artifact with stable trade id, provider filter, symbol,
     side, size, entry/exit, realized PnL, fees/funding, opened/closed timestamps, exit
     reason, replay semantics, and raw-payload allowlist.
   - Live-control security and bot-integration audit for start/stop/apply-config.
   - Provider live preflights outside bots, including Stripe/Axioma/LMS object-store or
     scanner live modes.

3. Exact forbidden commands/actions in this boundary:
   - `ssh <server> ...`, `scp ... <server>:...`, `rsync ... <server>:...`
   - `systemctl start|stop|restart ...`, `service ... start|stop|restart`
   - `tmux send-keys ...`, `screen -X ...`
   - `kill`, `pkill`, `taskkill`, or `Stop-Process` against bot/journal/nginx/worker or
     production/server processes, except cleaning a known local test child spawned by the
     current session.
   - Editing or copying live `.env`, nginx, systemd, tmux, journal, bot, or production DB
     files.
   - `npm run db:migrate` or `npm run db:seed` with production/preview `DATABASE_URL`.
   - `psql`, `pg_dump`, `pg_restore`, `createdb`, or `dropdb` against non-throwaway
     production/preview targets without explicit operator approval.
   - Setting `BOT_CONTROL_ENABLED=true` or adding any live control endpoint/button.
   - Calling `startBot`, `stopBot`, `applyConfig`, Legacy `retest`, exchange
     test-connection, exchange ping, place/cancel/close order, or provider control APIs.
   - `curl`/browser/provider probes against live Tortila/Legacy journal/API hosts,
     including `/api/marks`, `/api/overview`, Legacy `:8000`, or Tortila `:8080`,
     unless the operator provides the exact target and approves the probe plan.
   - Printing raw secrets, DSNs, tokens, bearer headers, cookies, exchange keys, raw
     provider payloads, or raw production rows.

## Risks
1. The operator can safely merge/run CI, but a future workflow change could add deploy
   jobs. Re-check `.github/workflows/*` before any merge described as "safe."
2. A green GitHub Action after merge proves CI, not production rollout, because production
   deploy/canary/firewall/monitoring gates remain separate.
3. Reusing local dummy Tortila token proof as production proof would leave the actual
   journal source/firewall/secret boundary unproven.
4. Treating Legacy slots/orders/open positions as closed-trade history would fabricate
   realized PnL and performance analytics.
5. Running managed local gates with a preview/prod admin DB URL would turn a safe
   acceptance harness into a production mutation path.

## Verification/tests
Read-only audit commands run:
1. `git status --short --branch` - PASS, current branch is
   `codex/bot-analytics-settings-canary-20260603` tracking origin.
2. `rg --files` - PASS, repository inventory collected.
3. `Get-Content` and `rg -n` over the files listed above - PASS, evidence gathered with
   file:line references.
4. `.github/workflows/ci.yml` inspected - PASS, only `gates` and `e2e` jobs observed in
   this workflow; no deploy/SSH/systemd job observed.

Not run by design:
1. No `npm` gates were run in this audit; Phase 4.60 already records the latest local
   green gates, and this task was boundary classification.
2. No SSH/systemd/tmux/process-control commands.
3. No production DB, preview DB, provider, exchange, live bot, or journal probes.
4. No live-control/start/stop/apply-config/test-connection actions.

## Next actions
1. Continue with merge/main CI observation and local docs/status reconciliation if needed.
2. If production work is desired next, start a separate explicit production-target phase
   with the target host/domain, DB target, rollback plan, secret provisioning method,
   canonical Tortila source, and approved probe list.
3. If bot data completion is desired next, request the canonical Tortila repo/source or a
   valid Legacy closed-trade source artifact; do not add another local UI/static polish
   loop around already-green Phase 4.60 surfaces.
