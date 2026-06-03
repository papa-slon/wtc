# ecosystem-devops-implementer handoff
## Scope
Read-only deploy audit for the next WTC canary deploy slice in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Objective: identify the safest canary deployment path used in recent phases, rollback shape, WTC services/containers that may be touched, and the commands/evidence the main operator should collect.

This audit inspected repository deployment docs and handoffs only. No SSH, Docker, systemd, nginx, DB, provider, bot, or live mutation command was run.

## Files inspected
- `AGENTS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-0056-ecosystem-tests-runner.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The safest recent web deploy path is the Phase 3.64 HTTPS production canary, not a full production cutover. Evidence: Phase 3.64 deployed release `5522900` to a timestamped release directory, started `wtc-ecosystem-canary` on `127.0.0.1:8301`, switched WTC nginx routing from `127.0.0.1:8300` to `127.0.0.1:8301`, and created an HTTPS canary host at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:34-38`. Recommendation: for the next canary slice, deploy a timestamped WTC release and switch only the WTC canary route/process after local and CI gates pass. Target part: WTC web canary deploy path.

2. Severity: High. Rollback shape is already defined as WTC-only: keep the old preview container on localhost port `8300` and either route back to it or revert the WTC canary env/process. Evidence: Phase 3.64 left `wtc-ecosystem-preview` on `127.0.0.1:8300` as rollback-only old preview at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:44`; it also states nginx public routing is on canary `8301` while the old preview remains rollback evidence at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:63`. Deployment docs require `pg_dump` before prod migration and rollback by restoring the dump plus redeploying the prior build at `docs/DEPLOYMENT.md:502-505`. Recommendation: rollback must touch WTC route/env/container/release only, plus DB restore only if the slice applied a production migration. Target part: rollback.

3. Severity: High. The next deploy may touch only WTC services/containers unless an explicit separate bot-owner maintenance phase is approved. Evidence: Phase 3.65 accepted `wtc-ecosystem-canary` for web and `wtc-ecosystem-worker` for the managed worker loop while keeping `wtc-ecosystem-preview` available as rollback at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:95-99`; Phase 3.65 verification says release `20260602-1816-4487b3d` replaced only the WTC canary container and started the managed Docker worker at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:120-124`. Recommendation: allowed WTC touch surface is `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and rollback-only `wtc-ecosystem-preview`; do not touch `turtle-bot.service`, `turtle-journal.service`, legacy tmux bot, Axioma journal, exchange state, or bot env/config. Target part: service boundary.

4. Severity: High. Bot API firewall state is part of deploy safety, not optional evidence. Evidence: Phase 3.64 added `wtc-bot-api-firewall.service` to drop non-loopback inbound TCP access to ports `8000` and `8080` at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:40-41`; verification observed bot ports open locally but timing out externally at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:86-90`; Phase 3.65 next actions require monitoring `wtc-bot-api-firewall.service` at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:146-149`. Recommendation: before and after deploy, collect service-active evidence and external denial for `8000` and `8080`; never make bot ports public to make WTC work. Target part: network boundary.

5. Severity: High. Tortila real data is accepted only through the DB-backed worker path, not direct journal reads from user page renders. Evidence: Phase 3.65 scope defines the accepted flow as `Tortila journal -> WTC worker -> WTC Postgres snapshots/imports -> WTC web/admin UI` at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:1-5`; blocker docs restate the same production-canary flow at `docs/PRODUCTION_BLOCKERS_CURRENT.md:5-7`; status says the UI is not direct journal reads from user page renders at `docs/STATUS.md:3-6`. Recommendation: next canary deploy should preserve DB-first UI behavior and collect worker freshness plus DB aggregate evidence, not ad hoc live journal page probes. Target part: Tortila read-only canary.

6. Severity: High. Live control, Legacy non-mock, Axioma live routes, Stripe, LMS live providers, branded-domain migration, and burn-in remain out of scope for a safe next canary unless explicitly phased. Evidence: Phase 3.65 keeps live control disabled, Legacy blocked, Axioma routes disabled at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:99-100`; Phase 3.65 lists provider-side journal auth, live control, Legacy, marks/overview, Stripe, Axioma, LMS live providers, branded-domain DNS/TLS, burn-in, and append-only intended audit role as NOT RUN/NOT GREEN at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:133-144`; production blockers repeat that this is not full production at `docs/PRODUCTION_BLOCKERS_CURRENT.md:12-14`. Recommendation: deploy UI/statistics/canary maintenance slices without expanding product/provider scope. Target part: scope control.

7. Severity: Medium. Main operator evidence should be compact and redacted; raw coordinates, DB URLs, tokens, cookies, and bot secrets must stay out of durable artifacts. Evidence: Phase 3.65 decided not to document raw public host coordinates, IPs, DB URLs, tokens, cookies, or bot secrets at `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:95-101`; deployment hard rules forbid secret copying and live server/bot mutation during discovery at `docs/DEPLOYMENT.md:551-554`. Recommendation: collect counts, service states, HTTP statuses, release IDs, commit IDs, and scanned redacted logs only. Target part: evidence retention.

## Decisions
- Treat Phase 3.64 as the canonical web canary deploy pattern: timestamped WTC release, canary container on localhost-only `8301`, nginx route to canary host, TLS smoke, and rollback preview on localhost-only `8300`.
- Treat Phase 3.65 as the canonical Tortila read-only canary pattern: worker-only real reads into WTC DB snapshots/imports, DB-backed web/admin UI, live control disabled, Legacy blocked, and no direct user-page journal reads.
- For the next canary deploy slice, allowed WTC touch surface is limited to `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and rollback-only `wtc-ecosystem-preview`, plus WTC nginx route only if the operator explicitly approves route switching.
- Do not touch live bot services, bot tmux sessions, bot code/config/env, exchange state, Axioma server state, or provider credentials as part of this canary deploy slice.
- Do not claim full production readiness from a canary deploy; provider-side journal auth, monitoring/burn-in, branded domain, billing, Axioma, LMS live providers, Legacy, and live controls remain separate gates.

## Risks
- If a slice changes the canary web env globally, it could reintroduce direct live journal reads unless the DB-first UI boundary is rechecked.
- If `wtc-bot-api-firewall.service` drifts or iptables is flushed, bot ports `8000` and `8080` can become publicly reachable while the bot services still bind broadly.
- If a DB migration is included, rollback becomes DB restore plus prior build redeploy, not just container/route rollback.
- Worker acceptance writes health/snapshot/import rows by design; cleanup of bad evidence rows must be a documented DB decision, not an ad hoc delete.
- The rollback preview is useful only while intentionally retained and known-good; stopping it removes the simple route-back option.

## Verification/tests
RUN in this read-only audit:
- Inspected Phase 3.64 aggregate canary deploy handoff.
- Inspected Phase 3.65 aggregate Tortila DB-backed read-only canary handoff.
- Inspected Phase 3.64 devops handoff and Phase 3.65 bot/tests handoffs for command/evidence shape.
- Inspected deployment, status, and production blocker docs.
- Confirmed from docs that recent safe canary deploys touched WTC containers/services only and left live bot services running.

NOT RUN in this read-only audit:
- SSH/server read-only probes.
- Docker/systemd/nginx commands.
- DB queries, migrations, seeds, backups, or restores.
- Local tests, Playwright, build, secret scan, or CI reruns.
- Worker ticks or managed worker changes.
- Provider calls, bot endpoint calls, live bot controls, or exchange checks.

Main operator should collect in the next approved canary deploy session:
- Pre-deploy repo evidence: `git status --short --branch`, activation commit, `npm run ci:local`, `npm test`, `npm run build -w @wtc/web`, `npm run secret:scan`, and a green GitHub Actions CI run for the exact activation commit.
- Pre-deploy server read-only evidence: active state for `nginx`, `postgresql`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service`; container list for `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and `wtc-ecosystem-preview`; listener shape for `80`, `443`, `8000`, `8080`, `8123`, `8300`, and `8301`; external denial for `8000` and `8080`.
- Deploy evidence: release directory or artifact ID, commit hash, WTC canary container replacement/start result, WTC worker restart/start result if in scope, nginx route target if changed, and no changes to bot services.
- Post-deploy HTTP/browser evidence: canary `/`, `/login`, `/register`, `/products/tortila`, authenticated Tortila dashboard/statistics pages, `/admin/bots`, and `/admin/system-health`; session cookie remains secure/httpOnly `__Host-wtc_session`; live controls remain absent/disabled.
- Post-deploy DB/worker evidence: aggregate counts/latest timestamps for `worker` and `tortila-journal` health, metric snapshots, position snapshots, and trade imports; no raw DB URLs or secrets retained.
- Rollback evidence: prior release/container still identified, `wtc-ecosystem-preview` availability if retained, DB dump ID if migrations are included, and exact operator-approved route/env/container rollback command shape.
- Retention evidence: redacted compact logs only, retained artifact scans clean, and no tokens, cookies, DB URLs, raw host coordinates, provider payloads, or bot secrets in durable docs.

## Next actions
1. Main operator should decide whether the next slice is web-only, web plus worker, or route-changing; do not mix provider activation or live-control scope into it.
2. Before deploy, rerun local and CI gates on the exact activation commit and record the run IDs.
3. In the approved deploy session, collect server preflight evidence before any mutation, then mutate only WTC canary/worker/route surfaces needed for the slice.
4. After deploy, verify canary pages, worker freshness, firewall state, and disabled controls before declaring the slice accepted.
5. Keep rollback ready: previous WTC release/container, rollback preview on `8300` if retained, and `pg_dump`/restore path if migrations are in scope.
