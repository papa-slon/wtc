# ecosystem-devops-implementer handoff
## Scope
Phase 3.64 read-only devops/server discovery for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform` and SSH target `ubuntu@54.179.188.61`.

The session inspected local protocol/deployment docs and the live server with read-only commands only. No server files, git state, services, nginx, systemd, Docker containers, databases, environment files, or bot processes were changed. Secret values were not printed; `.env` discovery was limited to file presence plus a small set of non-secret preview flags.

A scoped `ecosystem-devops-implementer` Claude agent was dispatched before this handoff edit. The first tool-enabled CLI attempt timed out without a usable payload; the second no-tools agent prompt completed and confirmed the discovery checklist. No N-agent audit claim is made for this phase.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `.env.example`
- `docker-compose.yml`
- `package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/*.sql`
- Server read-only SSH observations: `ss -ltnp`, filtered `ps`, `systemctl list-units`, `docker ps`, runtime command presence, project path listings, WTC migration/package metadata, safe preview flags, nginx site/config summary, certbot summary, UFW status, local server curl probes.
- Workstation read-only probes: local `git` status/log/remote, public raw-IP HTTP status/title, `https://axi-o.ma/health`.

## Files changed
- `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md` - this handoff only.

## Findings
1. Severity: High. Current WTC server preview is a dev-mode Docker container, not a production service. Evidence: SSH process/docker probes show `wtc-ecosystem-preview` using image `node:22-bookworm` and command `npm run dev -w @wtc/web -- --hostname 127.0.0.1 --port 8300`; `ss` shows `127.0.0.1:8300` listening; `docs/DEPLOYMENT.md:496-497` says server rollout should run on `127.0.0.1:8300` first, with nginx only after approval. Recommendation: do not cut over this container as production; define an approved production start path (`next build`/`next start` or equivalent), process manager, logs, rollback, and smoke checks. Target part: WTC web preview/deploy runtime.
2. Severity: High. The server WTC copy is stale against the local workspace. Evidence: server `/home/ubuntu/apps/wtc_ecosystem_platform/packages/db/migrations` contains only `0000` through `0007`; local `packages/db/migrations` contains `0000` through `0016`; local `package.json:28-40` includes auth/LMS/provider/audit acceptance scripts absent from the server package. Recommendation: do not run target migrations or deploy from the current server tree until an approved artifact/source sync plan, backup, and rollback are in place. Target part: server repo/project path and database migration readiness.
3. Severity: High. Current live process layout includes existing bot/journal services that must stay isolated from WTC. Evidence: SSH `ss`/`ps`/systemd probes show old bot on `0.0.0.0:8000` via `/home/ubuntu/apps/bot/.venv/bin/python3 app.py`, Tortila journal on `0.0.0.0:8080`, Axioma journal server on `127.0.0.1:8123`, PostgreSQL 16 on `127.0.0.1:5432`, and WTC preview on `127.0.0.1:8300`; `AGENTS.md:76-82` and `docs/SESSION_PROTOCOL.md:83-85` forbid live server/bot mutation and live bot control before audits. Recommendation: keep discovery/deploy work read-only around existing bots, and route WTC only through audited adapter boundaries. Target part: live server service boundaries.
4. Severity: High. Nginx currently exposes a raw-IP WTC preview over HTTP, while TLS is only confirmed for Axioma. Evidence: SSH nginx summary shows active `axioma-journal` and `wtc-ecosystem-ip`; `server_name 54.179.188.61` proxies to `127.0.0.1:8300`; certbot shows only `axi-o.ma` cert valid until 2026-08-17; workstation curl to `http://54.179.188.61/` returns `200` with title `WTC Ecosystem - World Trader Club`; `https://axi-o.ma/health` returns `{"status":"ok","db":"connected","service":"journal-server"}`. `docs/DEPLOYMENT.md:497` and `docs/DEPLOYMENT.md:543-544` keep production domain/TLS cutover and trusted proxy/rate-limit proof NOT RUN. Recommendation: do not treat raw-IP HTTP as production; approve WTC domain/TLS/HSTS/session-cookie/trusted-proxy work separately. Target part: nginx/domain/TLS.
5. Severity: High. Server preview env is development/mock, not production. Evidence: safe flag grep from `.env.preview.local` printed only non-secret values: `APP_ENV=development`, `NODE_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `BILLING_PROVIDER=mock`; `.env.example:7-8` requires staging/production Axioma ES256 config; `.env.example:75-76` keeps live controls and TV automation off; `docs/DEPLOYMENT.md:514-518` lists required production env and safe defaults. Recommendation: provision production/staging env only through approved secret handling; keep live controls off and entitlements fail-closed until all live gates pass. Target part: server environment and feature gates.
6. Severity: Medium. WTC preview has no observed app health endpoint. Evidence: server curl probes returned `http://127.0.0.1:8300/` = `200`, `http://127.0.0.1:8300/api/health` = `404`, Tortila journal `/api/health` = `200`, Axioma `/health` = `200`, old bot root = `404`. Recommendation: add or document a WTC health/smoke endpoint before production monitoring and load-balancer readiness. Target part: WTC health/monitoring.
7. Severity: High. Production blockers remain external/intended-environment blockers, not local substitutes. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:35-55` says local and dry-run gates do not replace intended audit-role, live provider, server/deploy, CI, monitoring, or live bot gates; `docs/PRODUCTION_BLOCKERS_CURRENT.md:57-69` lists Stripe, bot adapter, Axioma, TradingView real-PG, LMS live object/scanner, and worker-service blockers; `docs/DEPLOYMENT.md:537-548` keeps production DB, server deploy, nginx/TLS, trusted proxy, Axioma, real bot adapters, and live bot process control NOT RUN. Recommendation: deploy only after the matching live/intended gates are approved and observed green in the target environment. Target part: production readiness gates.
8. Severity: Medium. Local git state has changed since Phase 3.63 docs and the docs are now stale on that point. Evidence: current `git` probes show the workspace is git-backed at `main`, `origin/main`, `HEAD 0b5d233`, while `docs/PRODUCTION_BLOCKERS_CURRENT.md:47-49` and `docs/DEPLOYMENT.md:541` still describe GitHub CI as NOT RUN because the folder was not git-backed. Post-write status also shows non-owned worktree changes outside this devops handoff (`packages/config/src/env.ts` and `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`). Recommendation: update status/blocker docs in a later docs phase and run actual GitHub Actions before claiming CI green. Target part: repo/CI readiness documentation.
9. Severity: Medium. The server WTC path is not a git checkout. Evidence: SSH `wtc_git_and_package` probe reported `wtc_git=missing .git` under `/home/ubuntu/apps/wtc_ecosystem_platform`. Recommendation: do not use `git pull` as the deploy model on the server unless the operator intentionally changes that layout; prefer an explicit artifact/copy/rsync strategy with checksum, backup, and rollback. Target part: server deployment source model.

## Decisions
- Used SSH only for read-only discovery and used a throwaway known-hosts sink (`UserKnownHostsFile=NUL`) so the probe did not update local SSH known-hosts.
- Did not read or print server secret values. `.env.preview.local` checks were limited to non-secret mode/feature flags.
- Treated fresh command output as current when it conflicted with older docs, especially current local git state.
- Did not run `db:migrate`, `db:seed`, tests, provider calls, process control, Docker control, nginx reload/test changes, systemd control, or bot commands.
- Did not claim an N-agent audit. Only the required devops handoff is written.

## Risks
- The raw-IP WTC preview is reachable over HTTP but is a stale development-mode container; treating it as production would bypass current migration, build, health, env, CI, and monitoring requirements.
- Public listeners `:8000` and `:8080` remain visible on the host, and UFW reports inactive; safe production rollout needs an explicit network/security-group/proxy review without touching existing services.
- Server WTC migrations stop at `0007` while local code expects migrations through `0016`; applying current code against the existing preview DB without backup/rehearsal risks schema drift and app failures.
- No WTC production health endpoint was observed at `/api/health`; production monitoring would need a different probe or new endpoint.
- The current server WTC tree has no `.git`, so rollback/source provenance depends on whatever copy/artifact process was used previously.

## Verification/tests
RUN in this phase:
- Read required protocol/session docs before editing.
- Confirmed project agents are available with `claude agents`; dispatched scoped `ecosystem-devops-implementer` before editing. First tool-enabled CLI attempt timed out; second no-tools prompt completed. No spawned CLI agent process remained from this run.
- Local git probe: `main`, `origin/main`, `HEAD 0b5d233`. Final worktree status also showed non-owned changes outside this devops handoff.
- Server SSH identity/read-only discovery: user `ubuntu`, host `ip-172-31-19-144`, timestamp `2026-06-02T13:39:21+00:00`, Linux `6.17.0-1007-aws`.
- Server listeners/processes/systemd/docker discovery: WTC preview `127.0.0.1:8300`; old bot `0.0.0.0:8000`; Tortila journal `0.0.0.0:8080`; Axioma `127.0.0.1:8123`; PostgreSQL `127.0.0.1:5432`; nginx `:80/:443`; systemd services active for `journal-server`, `turtle-bot`, `turtle-journal`, `nginx`, Docker/containerd, PostgreSQL.
- Docker read-only listing: `wtc-ecosystem-preview` image `node:22-bookworm`, command `npm run dev -w @wtc/web -- --hostname 127.0.0.1 --port 8300`, up about 27 hours.
- Server project path discovery: `/home/ubuntu/apps/wtc_ecosystem_platform`, `/home/ubuntu/apps/bot`, `/home/ubuntu/apps/turtle_bingx`, `/home/ubuntu/journal_server` all exist; WTC server path lacks `.git`.
- Server env safe flag check: `APP_ENV=development`, `NODE_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `BILLING_PROVIDER=mock`.
- Server HTTP probes: `127.0.0.1:8300/` = `200`, `127.0.0.1:8300/api/health` = `404`, `127.0.0.1:8080/api/health` = `200`, `127.0.0.1:8123/health` = `200`, `127.0.0.1:8000/` = `404`.
- Public route probes: `http://54.179.188.61/` = `200`, title `WTC Ecosystem - World Trader Club`; `https://axi-o.ma/health` GET returned Axioma journal OK JSON.
- Nginx/certbot/UFW read-only discovery: active sites `axioma-journal` and `wtc-ecosystem-ip`; Axioma cert valid until 2026-08-17; UFW inactive.

NOT RUN in this phase:
- No server mutation, no `systemctl start|stop|restart|reload`, no `docker start|stop|restart|exec`, no nginx edit/reload, no `.env` mutation, no DB mutation, no bot process control.
- No `npm run ci:local`, `npm test`, `npm run build`, `npm run e2e`, `npm run secret:scan`, or GitHub Actions.
- No `db:migrate` / `db:seed` against preview or production.
- No direct intended append-only audit-role proof.
- No live LMS object-store/scanner, Stripe, Axioma, TradingView, production monitoring, or live bot adapter/control acceptance.

## Next actions
1. Decide the server deploy source model: artifact/copy/rsync from local `origin/main` vs making `/home/ubuntu/apps/wtc_ecosystem_platform` a real checkout. Document checksum, backup, and rollback either way.
2. Before any deploy, run local `npm run ci:local`, `npm run e2e`, `npm run secret:scan`, and a fresh GitHub Actions run from the current git-backed repo.
3. Prepare an approved server rollout plan: `pg_dump`, migration rehearsal, migrate/seed target DB, production build, non-dev service start, health smoke, rollback, and retained redacted evidence.
4. Replace the current dev-mode preview service only after approval; production should not run `next dev`.
5. Add or identify a WTC health endpoint before monitoring/cutover; `/api/health` currently returns `404`.
6. Keep `BOT_ADAPTER_MODE=mock`, live bot control off, and TV automation off until security plus bot-integration audits approve read-only/live adapter phases.
7. Plan WTC domain/TLS/nginx separately from the raw-IP preview, including HSTS, `__Host-` cookies, trusted proxy headers, and production rate-limit proof.
8. Refresh docs that still say the workspace is not git-backed, but only in a dedicated docs/status phase after this read-only discovery handoff is accepted.
