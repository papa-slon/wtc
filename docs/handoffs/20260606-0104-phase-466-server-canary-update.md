# Phase 4.66 - server canary update handoff
## Scope
Use the operator-provided SSH target to replace the WTC canary/worker release with current GitHub `main` commit `72f21d5a735ba5ce3a1b6e112cebf70742b72b62`, while preserving live bot services and keeping WTC in read-only bot mode. This phase updated only WTC canary/worker containers and the WTC canary DB migrations. It did not restart `turtle-bot.service`, `turtle-journal.service`, `journal-server.service`, nginx, PostgreSQL, Docker, or Legacy/Tortila bot services.

Agent handoffs:
- [docs/handoffs/20260606-0104-server-discovery-readonly-auditor.md](20260606-0104-server-discovery-readonly-auditor.md)
- [docs/handoffs/20260606-0104-server-discovery-security-auditor.md](20260606-0104-server-discovery-security-auditor.md)
## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `package.json`
- `apps/worker/package.json`
- `apps/web/package.json`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- Server read-only metadata for services, containers, release mounts, schema, counts, env key names, and health codes
## Files changed
- `docs/handoffs/20260606-0104-server-discovery-readonly-auditor.md`
- `docs/handoffs/20260606-0104-server-discovery-security-auditor.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
## Findings
1. Severity P0 - WTC current main is now live on the HTTPS canary. Evidence: server release `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-180016-72f21d5-phase465-main` is mounted into `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; public `https://<wtc-canary-host>/api/health` returned `http=200` with `{"ok":true,"status":"ok","service":"wtc-web"}`. Recommendation: treat Phase 4.66 as current server canary truth for WTC release `72f21d5`. Target part: WTC canary release.
2. Severity P0 - Bot services stayed alive and were not restarted. Evidence: after switch, `journal-server.service` PID `256388`, `turtle-bot.service` PID `256398`, and `turtle-journal.service` PID `256372` remained `active/running` with original start timestamps from `2026-06-04 06:28 UTC`; `NRestarts=0`. Recommendation: keep bot restarts out unless a later controlled bot runtime recovery phase requires them. Target part: live bot continuity.
3. Severity P0 - New WTC worker is reading both bots in read-only mode. Evidence: worker logs after switch show `tortila-snapshot ok`, `legacy-snapshot ok`, `bot_continuity ok`, `tortila ok`, and `legacy ok`; WTC DB health rows updated to `2026-06-05 18:03:10 UTC` for `worker`, `tortila-journal`, and `legacy-bot`. Recommendation: keep `BOT_ADAPTER_MODE=read-only` and `FEATURE_LIVE_BOT_CONTROL=false`. Target part: WTC worker integration.
4. Severity P1 - WTC DB migrations were required and applied after backup. Evidence: pre-migration max id was `17`; `npm run db:migrate -w @wtc/db` in a one-off `node:22-bookworm` container applied migrations successfully and post-migration max id was `22`. Backup file was created at `/home/ubuntu/apps/wtc_ecosystem_platform_releases/_db_backups/20260605-180016-wtc_platform_canary_20260602_1412-pre-72f21d5.dump` with `2123336` bytes. Recommendation: rollback web/worker by remounting release `20260603-1525-e2d705f-legacy-premium`; DB restore is available if ever needed. Target part: DB migration/rollback.
5. Severity P1 - Legacy realized analytics remains blocked by source shape, not WTC destination schema. Evidence: server `tradingbot` DB has `api_keys`, `orders`, `slots`, `stageconfigs`, `symbolsettingss`, and `users`; it has `orders=3425` and `slots=718`, but no closed-trade table with stable trade id, realized PnL, fees/funding, opened/closed timestamps, exit reason, and replay semantics. WTC `bot_trade_imports` contains `tortila=27` and no `legacy-db` trade imports. Recommendation: do not fabricate Legacy realized PnL/win-rate; keep source-proof blocked until a valid source artifact exists. Target part: Legacy analytics/import.
6. Severity P1 - Tortila has a real local runtime source shape on the server, but runtime source is not git-backed. Evidence: `/home/ubuntu/apps/turtle_bingx/turtle_bot.db` has `trades`, `positions`, `orders`, `equity_log`, `funding_payments`, `safety_events`, and `unit_fills`; `/home/ubuntu/apps/turtle_bingx` is `NO_GIT`. Recommendation: count the server as runtime/source evidence, but not canonical git-backed source proof. Target part: Tortila canonical source gate.
## Decisions
1. WTC canary/worker were updated to `72f21d5` using a new release directory instead of mutating the old release.
2. Existing server-side `.env.canary.live` and `.env.canary.local` were copied into the new release without printing values.
3. WTC DB was backed up before migrations; no seed was run.
4. Only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` containers were stopped/removed/recreated. `wtc-ecosystem-preview` stayed running.
5. Live bot controls, exchange pings, `/api/marks`, `/api/overview`, bot config apply, and bot service restarts were not run.
## Risks
1. DB migrations 0018-0021 are now applied on canary; rollback to old web/worker is available, but full DB rollback would require restoring the pre-migration dump.
2. Legacy source still cannot support honest realized analytics; adding UI around active/inactive orders would be misleading.
3. Tortila runtime source exists on the server but is not git-backed, so source drift can still happen outside WTC GitHub.
4. Long burn-in was short in this phase; continued monitoring is recommended.
## Verification/tests
RUN:
- Two read-only agents completed and were closed.
- SSH identity/read-only server discovery: host metadata, Ubuntu AWS kernel, target paths and service states collected.
- Current WTC release before switch: `20260603-1525-e2d705f-legacy-premium`, mounted into canary and worker.
- Backup: `pg_dump -Fc` to `_db_backups/20260605-180016-wtc_platform_canary_20260602_1412-pre-72f21d5.dump`, `2123336` bytes.
- New release: cloned GitHub `main` and checked out `72f21d5a735ba5ce3a1b6e112cebf70742b72b62`.
- `npm ci --no-audit --no-fund` in `node:22-bookworm` one-off container - PASS.
- `npm run build -w @wtc/web` in `node:22-bookworm` one-off container - PASS, `36/36` static pages generated.
- `npm run db:migrate -w @wtc/db` in `node:22-bookworm` one-off container - PASS.
- Container switch: `wtc-ecosystem-canary` and `wtc-ecosystem-worker` recreated on the new release - PASS.
- Local and public WTC health: `http://127.0.0.1:8301/api/health` and `https://<wtc-canary-host>/api/health` returned `200`.
- Public smoke: `/`, `/login`, `/products` returned `200`; `/app/bots` and `/admin/bots` returned `307` to `/login`.
- Post-switch bot service monitor: `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` remained `active/running`, same PIDs, `NRestarts=0`.
- Post-switch worker monitor: logs and DB health show `worker`, `tortila-journal`, and `legacy-bot` `ok` at `2026-06-05 18:03:10 UTC`.

NOT RUN:
- Bot service restart - not needed; services stayed healthy.
- WTC DB seed - not run; existing canary data preserved.
- nginx/systemd reload/restart - not needed; container port and nginx proxy already worked.
- Production branded-domain DNS/TLS cutover - not scoped; canary nip.io domain used.
- Live exchange ping, start/stop/apply-config, `/api/marks`, `/api/overview` - forbidden/out of scope.
- Legacy closed-trade importer - not run because source proof is missing.
- Long monitoring/burn-in - short smoke and worker wait only; continue monitoring separately.
## Next actions
1. Continue monitoring the canary and worker health over a longer window.
2. Keep WTC canary on `72f21d5` unless rollback is required.
3. For Legacy realized analytics, supply or build a real closed-trade source artifact/API/table; current `tradingbot` schema is insufficient.
4. For Tortila canonical source, move or confirm the server runtime source in a git-backed canonical repo and keep journal token middleware under source control.
5. Live control remains a separate audited phase; do not add restart/start/stop/apply controls to WTC.
