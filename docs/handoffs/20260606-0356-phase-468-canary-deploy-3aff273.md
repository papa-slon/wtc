# Phase 4.68 canary deploy 3aff273 handoff
## Scope
Deploy GitHub `main` commit `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` from PR #8 to the existing WTC HTTPS canary and worker, while preserving live bot services and keeping WTC in read-only bot mode. This phase replaced only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` with a new release directory. It did not restart `turtle-bot.service`, `turtle-journal.service`, `journal-server.service`, nginx, PostgreSQL, Docker, Legacy, or Tortila/Turtle bot runtimes; it did not run live bot controls, exchange pings, `/api/marks`, `/api/overview`, or config apply.

Protocol note: the two read-only verification agents below were launched after the switch as post-deploy auditors, not as pre-mutation agents. The release still has direct operator approval and live evidence, but future broad deploy phases should launch read-only auditors before any server mutation.

Agent handoffs:
- [docs/handoffs/20260606-0356-post-deploy-release-auditor.md](20260606-0356-post-deploy-release-auditor.md)
- [docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md](20260606-0356-post-deploy-bot-continuity-auditor.md)

## Files inspected
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/handoffs/20260606-0240-phase-467-bot-settings-catalog-admin-polish.md`
- Server Docker metadata for `wtc-ecosystem-canary` and `wtc-ecosystem-worker`
- Server systemd/process metadata for live bot continuity
- GitHub PR #8 and `main` CI metadata

## Files changed
- `docs/handoffs/20260606-0356-post-deploy-release-auditor.md`
- `docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`

## Findings
1. Severity: P0. WTC HTTPS canary now runs the PR #8 release. Evidence: server release `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker` is mounted into `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; release git revision is `3aff2738815562c18f5623e9686c4c2f4ba2ef3a`; public `<wtc-canary-host>` `/api/health` returned `200`. Recommendation: treat this as current canary truth. Target part: WTC canary release.
2. Severity: P0. PR #8 and post-merge `main` CI are green for the deployed commit. Evidence: PR #8 merged; PR checks `gates` and `e2e` passed; post-merge `main` CI run `27038370453` passed `gates` and `e2e`. Recommendation: continue requiring green GitHub checks before deploy. Target part: release governance.
3. Severity: P0. Live bots stayed alive and were not restarted. Evidence: `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` remained `active/running` with unchanged PIDs and `NRestarts=0`; Legacy tmux/Python process stayed live; worker logs reported `bot_continuity ok`, `tortila ok`, and `legacy ok`. Recommendation: do not restart bots unless a later monitor shows down/degraded state. Target part: live bot continuity.
4. Severity: P1. WTC DB migrations were checked and no new migration beyond `0021_complete_pepper_potts.sql` was present. Evidence: server `npm run db:migrate -w @wtc/db` completed successfully after the Phase 4.66 DB backup/migration state. Recommendation: no new DB backup/restore path is required for this UI-only release, but rollback to the prior release remains available. Target part: WTC DB migration boundary.
5. Severity: P1. Short burn-in is green, but long burn-in/alerting is still open. Evidence: three one-minute cycles kept local health `200`, worker continuity green, service PIDs unchanged, and recent warning count `0`. Recommendation: keep longer monitoring as a standing production-readiness gate. Target part: operations monitoring.

## Decisions
1. Built a new release directory instead of mutating the prior release.
2. Reused the existing server-side canary env files without printing values.
3. Recreated only `wtc-ecosystem-canary` and `wtc-ecosystem-worker`.
4. Kept bot adapters read-only and live-control disabled.
5. Did not run WTC DB seed; existing canary data was preserved.

## Risks
1. Rollback web/worker target is the prior canary release `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-180016-72f21d5-phase465-main`; DB rollback was not required because this phase introduced no new migration.
2. Legacy is still tmux-managed, so process supervision evidence is weaker than systemd-managed Turtle/Tortila.
3. Docker containers have no formal `HEALTHCHECK`; runtime health is proven by HTTP and worker logs.
4. This deploy does not clear full branded production, canonical Tortila source, Legacy realized closed-trade source/import, live-control audit, or external provider credential gates.

## Verification/tests
RUN:
1. Local PR #8 static fix gates before merge: `git diff --check`, focused static test, root/web typecheck, lint, governance, secret scan, web build - PASS.
2. PR #8 GitHub checks - PASS; `gates` 5m8s, `e2e` 9m55s.
3. PR #8 squash merge - PASS; `main` commit `3aff2738815562c18f5623e9686c4c2f4ba2ef3a`.
4. Post-merge `main` CI run `27038370453` - PASS; `gates` 5m23s, `e2e` 9m26s.
5. Server preflight bot service state - PASS; bot services active/running before switch.
6. New release clone/checkout to `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` - PASS.
7. Env file copy from prior release without printing values - PASS.
8. Server `npm ci --no-audit --no-fund` in `node:22-bookworm` one-off container - PASS.
9. Server `npm run build -w @wtc/web` in `node:22-bookworm` one-off container - PASS; `36/36` static pages generated.
10. Server `npm run db:migrate -w @wtc/db` in `node:22-bookworm` one-off container - PASS; no new migration beyond prior `0021` state.
11. Container switch for `wtc-ecosystem-canary` and `wtc-ecosystem-worker` - PASS.
12. Local health and protected-route smoke - PASS; local `/api/health` `200`, protected bot/admin routes `307`.
13. Public `<wtc-canary-host>` smoke - PASS; `/api/health`, `/`, `/login`, `/products` returned `200`; protected bot/admin routes returned `307`.
14. Short burn-in - PASS; three one-minute cycles kept WTC health `200`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`, bot PIDs unchanged, `NRestarts=0`, and recent warning count `0`.
15. Post-deploy release auditor - PASS and closed.
16. Post-deploy bot-continuity auditor - PASS and closed.

NOT RUN:
1. Live bot restart/start/stop/apply-config - not needed; bots stayed healthy.
2. Order/position close/cancel, exchange calls, `/api/marks`, `/api/overview` - forbidden/out of scope.
3. nginx/systemd/PostgreSQL/Docker daemon restart - not needed.
4. WTC DB seed - skipped to preserve existing canary data.
5. Authenticated browser smoke - skipped; public protected-route redirects were sufficient for this deploy smoke.
6. Long burn-in/alerting - not complete; only short burn-in was run.
7. Full branded production cutover - not scoped.

## Next actions
1. Keep WTC canary on `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` unless rollback is required.
2. Continue monitoring worker continuity and bot service state.
3. Start the next non-looping source phase with read-only agents before mutation: Tortila canonical source/token/network/burn-in or Legacy closed-trade source proof.
4. Keep live-control actions disabled until a separate security and bot-integration audit authorizes them.
