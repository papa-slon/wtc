# phase-474-canary-deploy-abe6784 handoff
## Scope
Phase 4.74 deployed the WTC canary app/worker release for GitHub `main`
`abe6784518abcbebe38368f3cef05039d55c520f` to the existing HTTPS canary. Scope was limited to WTC release staging,
server build/migrate check, WTC canary/worker container recreation, redacted smoke, short burn-in, and documentation.

The phase explicitly did not restart or mutate Legacy tmux, `journal-server.service`, `turtle-bot.service`,
`turtle-journal.service`, nginx, PostgreSQL, Docker daemon, firewall, exchange endpoints, DB rows beyond the WTC migration
check, env files, bot runtime configs, or live-control paths. No raw host/IP, env value, token, DSN, secret, exchange key,
raw DB row, or full raw log body is retained in this handoff.

Agents launched before mutation and closed after results:
- [20260606-0905-canary-deploy-preflight-auditor.md](20260606-0905-canary-deploy-preflight-auditor.md)
- [20260606-0905-canary-security-perimeter-auditor.md](20260606-0905-canary-security-perimeter-auditor.md)
- [20260606-0909-runtime-continuity-auditor.md](20260606-0909-runtime-continuity-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md`
- `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md`
- `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md`
- `docs/handoffs/20260606-0909-runtime-continuity-auditor.md`
- Local git state and release diff from `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` to
  `abe6784518abcbebe38368f3cef05039d55c520f`
- Redacted server metadata: WTC release mounts, selected systemd fields, tmux session metadata, route status codes, and
  filtered worker continuity lines

## Files changed
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md`

## Findings
1. Severity: P0. The prior documented WTC canary was still the Phase 4.68 `3aff273` release, while GitHub `main` had
   advanced to `abe6784518abcbebe38368f3cef05039d55c520f`. Evidence: `docs/DEPLOYMENT.md` before this phase listed
   `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker` as current, and
   `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md` identified the exact-main deploy gap. Recommendation:
   stage a new exact-SHA release and preserve `3aff273` as immediate WTC web/worker rollback. Target part: release truth.
2. Severity: P0. Deploy blast radius needed to stay WTC canary/worker only. Evidence:
   `docs/handoffs/20260606-0909-runtime-continuity-auditor.md` forbids Legacy tmux and Tortila trading bot restarts for
   this phase, and AGENTS hard rules forbid live bot control until separate audits pass. Recommendation: recreate only
   `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; treat any bot degradation as a separate recovery phase. Target part:
   live bot continuity.
3. Severity: P0. The WTC switch succeeded and both bots stayed alive. Evidence: post-switch server inspection showed
   both WTC containers running on `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260606-0213-abe6784-phase474-main`
   with `restartCount=0`; five burn-in cycles returned WTC health `200`, worker `bot_continuity ok`, `tortila ok`, and
   `legacy ok`; selected systemd fields for `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service`
   remained `active/running` with `NRestarts=0`; Legacy tmux session `bot` remained present. Recommendation: keep
   monitoring; if WTC health/worker continuity fails, roll back only WTC canary/worker to `3aff273`. Target part:
   post-deploy continuity.
4. Severity: P1. The release delta had no DB migration/package-lock changes, so `db:migrate` was a safety check rather
   than a planned schema change. Evidence: preflight diff over `packages/db/migrations`, `packages/db/src/schema.ts`, the
   migration journal, and `package-lock.json` returned no changed files; server `db:migrate` completed successfully.
   Recommendation: do not create a new DB backup claim for Phase 4.74; retain the prior DB-changing deploy backup as
   historical backup context and use WTC release rollback if app health fails. Target part: migration/rollback.
5. Severity: P1. The server build completed, but Next.js installed TypeScript during build in the release container.
   Evidence: server build output reported a successful production build and a TypeScript install warning. Recommendation:
   add a later devops cleanup for deterministic release installs/builds; do not treat it as a bot/runtime blocker. Target
   part: build reproducibility.

## Decisions
1. Current WTC canary app/worker release is now
   `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260606-0213-abe6784-phase474-main`.
2. Immediate WTC web/worker rollback is
   `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker`.
3. WTC canary/worker were recreated; Legacy tmux, Tortila trading bot, journal server, journal read service, nginx,
   PostgreSQL, Docker daemon, firewall, env files, exchange-facing processes, and live-control routes were not restarted or
   mutated.
4. No live-control, exchange ping, test-connection, start/stop/apply-config, `/api/marks`, or `/api/overview` path was run.
5. Phase 4.74 clears only the existing WTC canary exact-main app/worker deploy. Full branded production, provider-console
   perimeter proof, Legacy realized closed-trade source/import, audited live controls, Stripe/Axioma/LMS credentialed
   provider gates, and long production burn-in remain separate.

## Risks
1. The release has no formal Docker healthcheck, so health proof relies on HTTP smoke, Docker running/restart count, worker
   continuity lines, and bot service continuity.
2. Legacy tmux has weaker supervision than systemd; read-only tmux presence plus worker `legacy ok` is the current safe
   continuity signal for WTC deploys.
3. The build/install path is not fully deterministic because Next installed TypeScript during build; later devops cleanup
   should make this explicit in release dependencies.
4. Public TCP negative probes for bot/internal ports were not rerun in this phase after the WTC switch; prior Phase 4.72
   proof remains the latest public-port probe proof.
5. Full production/branded-domain acceptance still requires a longer monitoring window, provider-console perimeter proof,
   DNS/TLS/domain target, and rollback plan.

## Verification/tests
RUN:
1. Agents-before-mutation gate - PASS; three read-only handoffs exist and are cited above.
2. Pre-switch server baseline - PASS; selected bot systemd fields were `active/running` with `NRestarts=0`, WTC
   canary/worker were running on `3aff273`, Legacy tmux `bot` was present, and WTC local health was `200`.
3. Release staging - PASS; cloned GitHub repo to
   `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260606-0213-abe6784-phase474-main` and checked out exact
   `abe6784518abcbebe38368f3cef05039d55c520f`.
4. Server install/build/migrate - PASS; `npm ci --no-audit --no-fund`, `npm run build -w @wtc/web`, and
   `npm run db:migrate -w @wtc/db` completed successfully in `node:22-bookworm`.
5. WTC-only switch - PASS; recreated only `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; both mounted the new release
   and had `restartCount=0`.
6. Local route smoke - PASS; `/api/health`, `/`, `/login`, `/products` returned `200`; `/app/bots` and `/admin/bots`
   returned `307`.
7. Public route smoke - PASS with target redacted; `/api/health`, `/`, `/login`, `/products` returned `200`.
8. Burn-in - PASS; five short cycles with WTC health `200`, WTC containers running, worker `bot_continuity ok`, `tortila
   ok`, `legacy ok`, `journal-server.service`/`turtle-bot.service`/`turtle-journal.service` active/running with
   `NRestarts=0`, and Legacy tmux `bot` present.
9. Agent cleanup - PASS; all listed phase participants were closed after handoff collection.
10. `npm run governance:check` - PASS; current aggregate cited all three phase handoffs. One known historical heading
    warning remained allowlisted and unrelated.
11. `npm run secret:scan` - PASS.
12. `git diff --check` - PASS.

NOT RUN:
1. No live bot start/stop/restart/apply-config/test-connection, exchange ping, order close/cancel, `/api/marks`, or
   `/api/overview` - forbidden/out of scope.
2. No Legacy tmux control, no `turtle-bot.service` restart, no `journal-server.service` restart, no
   `turtle-journal.service` restart - not needed and forbidden for this WTC-only deploy.
3. No nginx, PostgreSQL, Docker daemon, firewall, env-file, DB-row, or secret mutation - out of scope.
4. No new DB backup - no DB migration/schema/package-lock diff was present for this release delta; `db:migrate` was a
   successful safety check.
5. No provider-console security-group proof, branded-domain cutover, long burn-in/alerting, Stripe/Axioma/LMS live
   credentialed provider acceptance, Legacy importer, or live-control audit - separate future phases.
6. No full `npm test`, `npm run typecheck`, `npm run lint`, web build, or Playwright local suite after documentation edits -
   not run because Phase 4.74 local changes are documentation/handoff-only and the server build/gates plus secret/governance
   checks covered the deploy record.

## Next actions
1. Open a docs-only PR for Phase 4.74 records, observe GitHub required checks, merge, and observe post-merge `main` checks.
2. After merge, run another short live monitor proving WTC canary/worker and both bots remain alive.
3. Continue with non-looping production work only: full branded-domain/burn-in readiness, valid Legacy closed-trade source
   packet if supplied, and separate audited live-control design/approval.
