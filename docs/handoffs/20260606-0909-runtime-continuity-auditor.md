# runtime-continuity-auditor handoff
## Scope
Phase 4.74 read-only runtime continuity audit for the WTC exact-main canary/worker update target
`abe6784518abcbebe38368f3cef05039d55c520f`.

Scope: determine the exact pre/post monitor gates required so Legacy tmux and Tortila services stay alive
through a WTC canary/worker deploy. This audit inspected repo docs, current Phase 4.74 sibling handoffs,
local git state, release diffs, and one read-only live server baseline through the known operator SSH target.
No server mutation was performed. No Docker, systemd, firewall, nginx, env, DB, tmux, bot, exchange, or
live-control state was changed. No raw host/IP, secret, DSN, token, env value, raw DB row, or raw log body is
recorded here.

This is a single foreground runtime-continuity auditor handoff. No N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0719-runtime-deploy-readiness-auditor.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md`
- `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md`
- `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/http.ts`
- `apps/worker/src/index.ts`
- Local git state/diff commands for `3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f`
- Read-only live server baseline: systemd selected fields, Legacy tmux/listener metadata, WTC container metadata,
  server-local health status codes, and count-only worker continuity signals.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Exact-main deploy is a WTC canary/worker release switch, not a bot-runtime change. Evidence:
`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:3` says the prior canary deploy replaced only
`wtc-ecosystem-canary` and `wtc-ecosystem-worker` and did not restart bot services; `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md:54`
repeats the WTC-only boundary for `abe6784`; `AGENTS.md:76-82` keeps discovery read-only, live controls blocked,
and entitlements fail-closed. Recommendation: deploy/restart only WTC web/worker containers for this target;
if bot runtime repair is needed, stop and open a separate audited recovery phase. Target part: deploy blast radius.

2. Severity: P0. Pre-switch bot continuity must be captured immediately before any WTC container recreation. Evidence:
`docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md:63` requires systemd state, Legacy tmux/listener PID,
WTC container metadata, and worker continuity logs before mutation; this audit's live read-only baseline at
`2026-06-06T02:06:23Z` observed `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service`
`active/running` with `NRestarts=0`, Legacy tmux session `bot` with a `python3` pane and matching Legacy listener,
WTC canary/worker containers running with restart count `0`, server-local WTC health `200`, Tortila missing-token
summary `401`, and 30 recent worker successes each for `bot_continuity ok`, `tortila ok`, `legacy ok`,
`tortila-snapshot ok`, and `legacy-snapshot ok`. Recommendation: treat those fields as the minimum baseline shape;
do not proceed if any baseline field is missing/degraded. Target part: pre-switch runtime baseline.

3. Severity: P0. Post-switch proof must compare forbidden bot-service identity, not just WTC uptime. Evidence:
`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:69` accepted three one-minute burn-in cycles only
because WTC health, worker continuity, bot PIDs, and `NRestarts` all stayed green; `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md:65`
requires a one-minute monitor loop after every runtime step. Recommendation: after WTC switch, run at least three
one-minute cycles requiring WTC health `200`, WTC canary/worker running, worker `bot_continuity ok` plus both bot
snapshot lines, unchanged `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service`
PIDs/start timestamps/`NRestarts`, unchanged Legacy tmux pane/listener PID, and no retained secret/log payloads.
Target part: post-switch burn-in.

4. Severity: P0. Legacy continuity has to be checked through tmux plus listener plus worker evidence because it has no
systemd restart counter. Evidence: `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md:26` records Legacy
as tmux-managed and weaker to supervise; `docs/BOT_CONTROL_SAFETY_MODEL.md:37` forbids tmux interaction because it
bypasses bot safety gates. Recommendation: pre/post gates must use read-only tmux list metadata, the Legacy listener PID,
and worker `legacy-snapshot ok`/`legacy ok`; never use `tmux send-keys`, process kill, or Legacy HTTP management control
as recovery for a WTC deploy. Target part: Legacy tmux continuity.

5. Severity: P0. Tortila trading bot restart remains forbidden; Tortila journal restart is not justified for this WTC
exact-main deploy. Evidence: Phase 4.72 already completed the journal-only auth switch while leaving WTC containers on
`3aff273` and not touching `turtle-bot.service` in `docs/STATUS.md:19-31`; `docs/DEPLOYMENT.md:64-65` says journal
rollback restarts only `turtle-journal.service` and does not restart `turtle-bot.service` without a separate audited
recovery phase; this audit observed current `turtle-journal.service` active/running with `NRestarts=0` and missing-token
summary `401`. Recommendation: for `abe6784`, do not restart `turtle-journal.service` unless a separate journal-source,
token, or firewall change is explicitly approved; never restart `turtle-bot.service` in this phase. Target part:
Tortila service boundary.

6. Severity: P1. A WTC worker soft restart is justified only as WTC release activation or WTC rollback, not as a bot fix.
Evidence: `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md:57` identifies limited package/runtime-adjacent
changes in `@wtc/bot-adapters` and verifier scripts, so exact-tree parity requires deploying the worker; `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md:105`
limits rollback to remounting/recreating only WTC canary/worker if WTC health or worker continuity fails. Recommendation:
soft restart/recreate `wtc-ecosystem-canary` and `wtc-ecosystem-worker` only after exact SHA build, no-surprise migration
check, pre-switch smoke, and rollback target are ready; if post-switch health fails, soft-rollback only those WTC containers.
Target part: soft restart criteria.

7. Severity: P1. Runtime monitors must keep auth/perimeter and live-control exclusions in the gate set. Evidence:
`docs/CONTRACTS/tortila-adapter.md:52-56` records current Tortila runtime auth proof, while `docs/CONTRACTS/tortila-adapter.md:454-456`
excludes `/api/overview` and `/api/marks`; `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md:101`
requires rollback if public smoke, internal bot-port perimeter, worker continuity, secret hygiene, bot PID, or live-control
boundaries fail. Recommendation: post-switch continuity gates must include missing-token `401` sanity, public/internal
perimeter probes from the security lane, no `/api/marks`, no `/api/overview`, no exchange ping, no start/stop/apply-config,
and no raw host/IP or secret output. Target part: runtime safety perimeter.

## Decisions
1. This auditor records the runtime continuity gate plan only; it does not authorize or perform the canary deploy.
2. Pre-switch gate set: exact target SHA confirmed, sibling release/security preflight reviewed, rollback target present,
   current WTC release identity refreshed, systemd bot services baselined, Legacy tmux/listener baselined, WTC container
   metadata baselined, server-local WTC health `200`, Tortila missing-token `401`, worker continuity counts present, and
   restart/failure markers checked without raw logs.
3. Switch boundary: recreate only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` on the new exact-main release.
4. Post-switch gate set: local/public WTC smoke, protected-route redirects, WTC container running/restart counts,
   worker two-bot continuity tuple, unchanged forbidden bot-service PIDs/start timestamps/`NRestarts`, unchanged Legacy
   tmux/listener identity, perimeter negative probes, and redacted evidence scans.
5. Burn-in minimum: three one-minute cycles after switch; longer monitoring remains production-readiness work and should not
   be collapsed into this auditor handoff.
6. Soft restart allowed: WTC canary/worker container recreation for exact-main activation, and WTC-only recreation back to
   the `3aff273` release if WTC smoke/worker continuity fails.
7. Soft restart conditional/separate: `turtle-journal.service` only for an approved journal auth/source/firewall recovery
   with rollback path and before/after PID evidence; not justified by this WTC web/worker deploy target.
8. Forbidden in this phase: `turtle-bot.service` restart, Legacy tmux control, `journal-server.service` restart, nginx,
   PostgreSQL, Docker daemon, firewall/env/DB mutation, exchange/API-key probes, `/api/marks`, `/api/overview`, live
   start/stop/apply-config/test-connection, and raw logs/secrets/host output.

## Risks
1. Legacy tmux has no `NRestarts`; process and listener identity are necessary but weaker than systemd supervision.
2. Worker container recreation can surface pre-existing adapter/env problems even if CI and server build are green.
3. A broad warning/error word count can misclassify expected source-blocked messages; deploy proof should classify only
   redacted categories and never retain raw worker logs.
4. If `db:migrate` unexpectedly applies a migration, rollback becomes backup/restore plus release rollback, not just WTC
   container remount.
5. Provider-console/private-network proof remains separate from workstation/public negative probes.
6. Restarting bot services to repair WTC symptoms would widen scope into live trading runtime recovery.

## Verification/tests
RUN:
1. Memory/repo context pass for WTC canary deploy and worker continuity history.
2. Local protocol/doc inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, current status/actions/deployment docs,
   bot safety model, Legacy/Tortila contracts, Phase 4.68/4.72/4.73 handoffs, and current Phase 4.74 sibling handoffs.
3. Local git target check: `HEAD` equals `abe6784518abcbebe38368f3cef05039d55c520f`; diff from deployed `3aff273...`
   inspected. Current worktree before this handoff write was on `codex/phase-474-canary-deploy-abe6784` with pre-existing
   untracked sibling handoffs `20260606-0905-canary-deploy-preflight-auditor.md` and
   `20260606-0905-canary-security-perimeter-auditor.md`.
4. Read-only SSH baseline at `2026-06-06T02:06:23Z`: selected systemd fields only, read-only tmux/listener metadata,
   Docker container metadata without env values, server-local WTC health status, Tortila missing-token status, count-only
   worker continuity, and restart/failure marker counts.
5. Live baseline observed green for continuity: bot systemd units active/running with `NRestarts=0`, Legacy tmux/listener
   present, WTC canary/worker running with restart count `0`, WTC health `200`, Tortila missing-token summary `401`,
   and 30 recent worker successes for each required two-bot continuity signal.
6. No mutation commands were run: no Docker recreate/restart, no systemd start/stop/restart, no tmux interaction beyond
   list metadata, no firewall/env/DB writes, no raw env/log/row reads, and no bot/exchange control calls.

NOT RUN:
1. WTC exact-main deploy, server release build, `npm ci`, web build, migration, backup, temp smoke container, or container
   switch - forbidden for this read-only auditor.
2. Public canary smoke for `abe6784` - must run after switch, not before.
3. Correct-token Tortila auth probe - not run because this audit did not read or print token values; worker continuity and
   missing-token `401` were used as read-only signals.
4. Internal/public bot-port negative probes for the future post-switch state - left to deploy/security perimeter gates.
5. Local npm tests/lint/secret scan by this auditor - sibling security/preflight handoffs recorded their own gates; this
   lane focused on runtime continuity and live read-only baseline.
6. Long burn-in/alerting/provider-console/private-network proof/full branded production/live-control audit - out of scope.

## Next actions
1. Immediately before deploy, rerun the same read-only baseline and stop if any forbidden service is degraded or differs
   unexpectedly: `journal-server.service`, `turtle-bot.service`, `turtle-journal.service`, Legacy tmux/listener, WTC
   containers, WTC health, Tortila missing-token auth, worker continuity counts, and rollback release presence.
2. Build/stage `abe6784518abcbebe38368f3cef05039d55c520f` in a new release path; do not mutate the `3aff273` release.
3. Run pre-switch smoke on an unused server-local port and run the migration check under the no-surprise/backup stop policy.
4. Recreate only `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; do not restart Legacy tmux, `turtle-bot.service`,
   `turtle-journal.service`, `journal-server.service`, nginx, PostgreSQL, Docker daemon, firewall, or exchange-facing code.
5. Post-switch, run local/public smoke plus three one-minute continuity cycles. Require WTC health `200`, worker
   `bot_continuity ok`, `tortila ok`, `legacy ok`, `tortila-snapshot ok`, `legacy-snapshot ok`, unchanged forbidden bot
   service identity, unchanged Legacy tmux/listener identity, WTC worker running, and redacted evidence only.
6. Soft rollback only WTC canary/worker to the prior `3aff273` release if WTC health or worker continuity fails. Do not
   restart bots as rollback. If DB migration unexpectedly occurred, stop for DB restore procedure with explicit approval.
7. Stop immediately if any bot PID/start timestamp changes unexpectedly, `NRestarts` increases, Legacy tmux/listener
   disappears or changes unexpectedly, worker two-bot continuity misses consecutive cycles, internal bot ports become
   public, a secret/raw host/raw log appears, `/api/marks` or `/api/overview` is called, or any live-control/exchange path
   is touched.
