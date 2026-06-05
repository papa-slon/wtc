# safety-gate-orchestration-auditor handoff
## Scope
Read-only Phase 4.57 safety/gate orchestration audit after the operator gave broad permission to inspect/copy demo/test data and run needed checks. This audit inspected package scripts, managed DB runners, redaction helpers, `docs/NEXT_ACTIONS.md`, `docs/BOT_CONTROL_SAFETY_MODEL.md`, and recent Phase 4.54-4.56 handoffs to produce a safe resume runbook.

Safety boundaries enforced: no code edits, no live server mutation, no plaintext secret logging, no production-shaped DB create/drop, no live bot start/stop/apply-config, no exchange pings, no `/api/marks`, and no deploy/CI.

Agent/process note: no callable background thread/agent tool was exposed in this Codex session (`tool_search` found no thread tools), so this is a single foreground read-only auditor handoff. No N-agent claim is made and no background agents were left open.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`
- `docs/handoffs/20260605-0550-user-route-db-proof-platform-auditor.md`
- `docs/handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md`
- `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`
- `docs/handoffs/20260605-1411-gates-blocker-auditor.md`
- `package.json`
- `apps/worker/package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260605-1425-safety-gate-orchestration-auditor.md`.

## Findings
1. Severity P0 - The current shell still has no external gate input set. Evidence: env presence check by name only reported `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=NOT_SET`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL=NOT_SET`, `REAL_POSTGRES_ADMIN_DATABASE_URL=NOT_SET`, `REAL_POSTGRES_DATABASE_URL=NOT_SET`, `DATABASE_URL=NOT_SET`, `TORTILA_JOURNAL_BASE_URL=NOT_SET`, `TORTILA_JOURNAL_URL=NOT_SET`, `TORTILA_JOURNAL_TOKEN=NOT_SET`, `JOURNAL_READ_TOKEN=NOT_SET`, and `LEGACY_SOURCE_ARTIFACT=NOT_SET`; Phase 4.56 recorded the same blocker pattern in `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`. Recommendation: do not run managed/source/deploy gates until one named input is supplied. Target part: gate orchestration.
2. Severity P0 - If local test DB credentials are discovered, the first runnable gate should be the narrow disposable-DB browser proof for the Phase 4.54/4.55 blocker: `npm run e2e:admin-user-bots:db:managed:user-routes`, provided `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` points to an isolated non-production maintenance DB. Evidence: `docs/NEXT_ACTIONS.md:110-133` names the user-routes managed proof as the ready Tortila current-user route gate and requires artifact scans afterward; `package.json:37-40` exposes the managed user-routes and matrix scripts; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:18-27` documents the admin URL and throwaway DB behavior. Recommendation: run user-routes first, then the admin matrix, then worker continuity if its separate admin URL is supplied. Target part: ordered DB gate runbook.
3. Severity P0 - The disposable DB preflight must prove the provided credential is an admin/maintenance URL and that the created target DB is throwaway and empty before migrations/fixtures. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:47-51`, `scripts/run-worker-continuity-managed.mjs:48-52`, and `scripts/run-real-pg-harness-managed.mjs:37-41` reject non-Postgres or throwaway admin DB names; `scripts/prepare-admin-user-bot-detail-e2e.ts:39-49` accepts only target DB names matching `wtc_test*`; `scripts/prepare-admin-user-bot-detail-e2e.ts:173-180` refuses non-empty target DBs. Recommendation: use only managed runners that create/drop `wtc_test*` targets, and never point direct `DATABASE_URL` at production/app DBs. Target part: DB safety preflight.
4. Severity P0 - The managed worker continuity gate is a separate disposable DB gate with a specific acceptance tuple, not a substitute for browser user-route proof. Evidence: `package.json:25` maps `accept:worker:continuity:managed`; `scripts/run-worker-continuity-managed.mjs:23-27` creates a fresh `wtc_test_worker_continuity_*` DB and states it does not touch live bots/exchanges/provider systems; `scripts/run-worker-continuity-managed.mjs:314-321` requires `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, and `legacy=ok`. Recommendation: run it after user-routes/matrix when `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied, or first only if that is the only DB credential provided. Target part: worker continuity proof.
5. Severity P0 - Live control and exchange paths remain prohibited regardless of broad operator permission for local testing. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:4` says all controls are mock/disabled with no live bot interaction; `docs/BOT_CONTROL_SAFETY_MODEL.md:15-18` says control methods throw `ControlDisabledError` until required gates pass; `docs/BOT_CONTROL_SAFETY_MODEL.md:40` forbids exchange API calls through WTC; `docs/BOT_CONTROL_SAFETY_MODEL.md:262-265` says `/api/marks`, start bot, and stop bot are never/currently unavailable. Recommendation: keep live bot start/stop/apply-config, exchange pings, provider probes, `/api/marks`, SSH/systemctl/tmux/process control, `.env` writes, deploy, CI, monitoring, and burn-in NOT RUN. Target part: safety boundary.
6. Severity P1 - Redaction exists but does not replace artifact review. Evidence: `scripts/redacted-child-process.mjs:44-62` redacts DB URLs, secret assignments, auth headers, cookies, JWTs, private keys, Stripe secrets, and raw public IP URLs; `docs/NEXT_ACTIONS.md:118-119` requires scanning stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` after DB matrix runs. Recommendation: after every managed DB/browser run, scan command output and retained artifacts before archiving or citing them. Target part: evidence retention.
7. Severity P1 - The active blocked goal can be unblocked only by observed external evidence, not by more local polish. Evidence: `docs/NEXT_ACTIONS.md:105-112` says resume only by supplying a named managed DB/source/deploy input or a fresh failing gate; `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md` found all required inputs missing and recommended stopping as blocked. Recommendation: unblock only with one of the evidence packages listed in Next actions below. Target part: blocked-goal release criteria.

## Decisions
1. No broad background audit agents were claimed because no callable agent/thread tool was available in this session.
2. Current state remains blocked: no DB/source/deploy env input is set now.
3. If `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is discovered and verified as isolated local/admin maintenance credentials, run `npm run e2e:admin-user-bots:db:managed:user-routes` first because it is the narrowest current unresolved rendered DB proof from Phase 4.54/4.55.
4. Run `npm run e2e:admin-user-bots:db:managed:matrix` second with the same approved admin DB lane.
5. Run `npm run accept:worker:continuity:managed` when `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied; if it is the only discovered DB credential, run it first and record the admin-browser gates as still NOT RUN.
6. Run `npm run accept:real-pg:managed` only as a generic real-Postgres harness when `REAL_POSTGRES_ADMIN_DATABASE_URL` is supplied; it does not replace the bot/admin DB browser or worker-continuity gates.
7. Keep source, live-control, deploy, CI, monitoring, and burn-in gates in separate scoped phases.

## Risks
1. A credential can look local but still target an app or production cluster. The operator must verify host/port/database purpose out of band and pass only maintenance DB URLs to managed runners.
2. Managed runners intentionally create and force-drop `wtc_test*` databases. Wrong credentials could still be dangerous if pointed at an important cluster with create/drop privileges.
3. Browser fixtures seed hostile raw/provider/secret-shaped markers; passing Playwright is not enough unless stdout/stderr and artifacts are scanned afterward.
4. Running `--matrix` and `--user-routes` together is refused by the runner and should stay separate acceptance lanes.
5. `LEGACY_LIVE_READS_ENABLED=true` appears inside the managed worker fixture path only against the disposable target DB; do not copy that setting into live/provider environments.
6. Current worktree is very broad and dirty; deploy/CI must be its own exact-tree phase with explicit staging scope.

## Verification/tests
RUN:
1. `git branch --show-current` - observed `codex/bot-analytics-settings-canary-20260603`.
2. `git status --short` - observed a broad pre-existing dirty tree; this audit did not classify or revert unrelated changes.
3. Env presence check by name only - all managed/source DB and journal/source env inputs listed in Findings were `NOT_SET`.
4. `node scripts/run-admin-user-bot-detail-e2e-managed.mjs` - refused before DB because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is missing.
5. `node scripts/run-worker-continuity-managed.mjs` - refused before DB because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is missing.
6. `node scripts/run-real-pg-harness-managed.mjs` - refused before DB because `REAL_POSTGRES_ADMIN_DATABASE_URL` is missing.
7. Read-only inspections of docs, package scripts, managed runners, redaction helper, and recent handoffs.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:user-routes` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied.
3. `npm run accept:worker:continuity:managed` - NOT RUN; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not supplied.
4. `npm run accept:real-pg:managed` - NOT RUN; `REAL_POSTGRES_ADMIN_DATABASE_URL` is not supplied and this is not the primary bot/admin blocker.
5. Direct `db:migrate`, `db:seed`, or direct DB e2e against arbitrary `DATABASE_URL` - NOT RUN; production-shaped DB mutation is forbidden and disposable preflight is required.
6. Tortila real journal read gate - NOT RUN; journal URL/token/auth/firewall inputs are not supplied.
7. Legacy closed-trade source/import gate - NOT RUN; no source artifact names the required table/API and fields.
8. `/api/marks`, exchange pings, provider probes, live bot start/stop/apply-config, SSH/systemctl/tmux/process control, `.env` writes, deploy, CI, monitoring, and burn-in - NOT RUN; prohibited or separate approved phases.
9. Local Vitest/typecheck/lint/build/Playwright acceptance - NOT RUN in Phase 4.57; this was a read-only orchestration audit and Phase 4.55 remains the latest local no-env proof set.

## Next actions
Ordered safe resume runbook:

1. Confirm the discovered DB credential is a local/isolated admin maintenance URL, not an app DB and not a `wtc_test*` target DB. Do not print the value.

```powershell
$names = @('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL','WORKER_CONTINUITY_ADMIN_DATABASE_URL','REAL_POSTGRES_ADMIN_DATABASE_URL')
foreach ($name in $names) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { "$name=NOT_SET" } else { "$name=SET" }
}
```

2. If `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is set, run the narrow current-user Tortila route proof first:

```powershell
npm run e2e:admin-user-bots:db:managed:user-routes
```

Acceptance: managed runner creates and drops a fresh `wtc_test_admin_user_bots_*` database; Playwright proves `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render Tortila Mark/uPnL as `N/A`, neutral/no up/down styling for unavailable cells, and no `/api/marks` source path.

3. With the same approved admin DB lane, run the selected-user matrix separately:

```powershell
npm run e2e:admin-user-bots:db:managed:matrix
```

Acceptance: all scenarios pass separately and the runner creates/drops only `wtc_test_admin_user_bots_*` databases.

4. If `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is set, run worker continuity:

```powershell
npm run accept:worker:continuity:managed
```

Acceptance: created/dropped `wtc_test_worker_continuity_*` database and observed tuple `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.

5. If `REAL_POSTGRES_ADMIN_DATABASE_URL` is set and a generic real-PG gate is explicitly desired, run:

```powershell
npm run accept:real-pg:managed
```

Acceptance: created/dropped `wtc_test_*` database and focused `tests/integration/db-real-postgres.test.ts` passes. This does not unblock bot/admin DB browser or worker continuity by itself.

6. After every managed DB/browser run, perform mandatory artifact scans before retaining evidence:

```powershell
npm run secret:scan
Select-String -Path logs\**\*,test-results\**\*,playwright-report\**\*,tests\e2e\screenshots\**\* -Pattern 'SHOULD_NOT_RENDER|MUST_NOT_LEAK|apiKey|token=|Bearer |postgres://|password=|SOURCE_PROOF_RAW|USER_B_' -ErrorAction SilentlyContinue
git diff --check
```

7. Evidence that would unblock the previously blocked goal:
- `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` supplied for an isolated maintenance DB and fresh PASS for `npm run e2e:admin-user-bots:db:managed:user-routes`, plus artifact scan clean.
- Fresh PASS for `npm run e2e:admin-user-bots:db:managed:matrix`, plus artifact scan clean.
- `WORKER_CONTINUITY_ADMIN_DATABASE_URL` supplied for an isolated maintenance DB and fresh PASS for `npm run accept:worker:continuity:managed` with the required tuple.
- Or a valid Legacy source artifact naming stable trade id, mapped provider filter, symbol, side, size, entry/exit prices, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and raw-payload allowlist, followed by a separate read-only source-proof audit.
- Or Tortila journal URL/token/auth/firewall evidence sufficient for a separate read-only real-read gate proving authenticated reads, `sourceAdapter=tortila`, `readState=ok`, metric/position/trade import, source-config provenance, safety-signal ingestion, identity scope, redacted output, and no `/api/marks`.
- Or an explicitly scoped deploy/CI phase with exact-tree staging, canary/PR proof, and post-deploy smoke.

8. What must remain NOT RUN without a separately scoped phase: live bot start/stop/apply-config, exchange pings, provider probes, `/api/marks`, SSH/systemctl/tmux/process control, `.env` writes, production/app DB create/drop or migrations, direct deploy, CI publication, monitoring, and burn-in.
