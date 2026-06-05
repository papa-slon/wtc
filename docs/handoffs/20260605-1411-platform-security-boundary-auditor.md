# ecosystem-platform-security-boundary-auditor handoff
## Scope
Read-only Phase 4.56 platform/security boundary audit for the current Legacy/Tortila bot completion state.

Task: independently check whether a safe, aligned local code/docs change remains under the current constraints, or whether more local work now risks weakening the security/source-truth boundary.

Recommendation: stop as blocked on named external inputs. Do not continue local Legacy/Tortila implementation now. The current local workbench and safe local proof are already classified as substantially built; the remaining blockers are managed DB execution, real Tortila journal/auth/firewall proof, real Legacy closed-trade source proof, live-control audit approval, and deploy/CI authorization. More local UI/static/docs polish would be circular unless it fixes a fresh failing gate.

Out of scope and not performed: code edits, live server mutations, bot start/stop/apply-config, adapter live control, exchange/provider pings, `/api/marks`, DB migrations/seeds/queries, managed DB runners, deploy, CI, and secret value inspection.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260605-0630-phase-4-55-verification-blocker-audit.md`
- `docs/handoffs/20260605-0630-platform-blocker-auditor.md`
- `docs/handoffs/20260605-0630-security-boundary-auditor.md`
- `docs/handoffs/20260605-0630-tests-gates-auditor.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- Current shell env names only: `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `REAL_POSTGRES_ADMIN_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, `JOURNAL_READ_TOKEN`, `LEGACY_SOURCE_ARTIFACT`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `FEATURE_LIVE_BOT_CONTROL`, `FEATURE_TV_AUTOMATION`.

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260605-1411-platform-security-boundary-auditor.md`.

## Findings
1. Severity P0 - No safe, aligned local Legacy/Tortila code/docs change remains by default. Evidence: `docs/STATUS.md:11-13` says Phase 4.55 confirmed no non-looping local implementation lane remains while managed/source/deploy env gates are absent; `docs/NEXT_ACTIONS.md:103-105` says to continue only by clearing an env gate, consuming source evidence, fixing a fresh failing gate, or publishing/deploying the exact tree. Recommendation: stop local implementation now unless one named blocker input is supplied or a gate fails. Target part: phase control and platform/security boundary.
2. Severity P0 - Current shell inputs still do not unlock managed/source/live work. Evidence: env presence audit printed only SET/NOT_SET and showed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `REAL_POSTGRES_ADMIN_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, `JOURNAL_READ_TOKEN`, `LEGACY_SOURCE_ARTIFACT`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `FEATURE_LIVE_BOT_CONTROL`, and `FEATURE_TV_AUTOMATION` all `NOT_SET`; Phase 4.55 recorded the same blocker class at `docs/STATUS.md:15-23`. Recommendation: keep managed DB, source, live, and deploy gates NOT RUN until the exact inputs are supplied. Target part: env-gated acceptance.
3. Severity P0 - Legacy closed-trade completion is source-blocked, not locally implementation-blocked. Evidence: `docs/NEXT_ACTIONS.md:116-122` forbids Legacy closed-trade import until a source-proof artifact names stable trade id, provider filter, symbol, side, size, entry/exit, realized PnL, fees/funding, timestamps, exit reason, replay semantics, and raw-payload allowlist, and rejects inactive orders/slots, position snapshots, Tortila rows, and GTE journals as substitutes; `docs/CONTRACTS/legacy-bot-adapter.md:295-304` says the Legacy bot has no closed-trade history endpoint and returns empty trades. Recommendation: do not add import, analytics, copy, or DTO changes that imply realized Legacy performance until a real artifact passes the proof contract. Target part: Legacy closed-trade source truth.
4. Severity P0 - Tortila completion cannot be advanced through `/api/marks` or exchange-derived Mark/uPnL. Evidence: `docs/CONTRACTS/tortila-adapter.md:249-254` and `docs/CONTRACTS/tortila-adapter.md:424-447` permanently exclude `/api/marks`; `docs/CONTRACTS/tortila-adapter.md:451-461` says `getPositions()` has markPrice/unrealizedPnl unavailable and `/api/marks` is never consumed; `docs/BOT_CONTROL_SAFETY_MODEL.md:262` says WTC never calls `/api/marks`. Recommendation: keep Tortila Mark/uPnL as unavailable unless a separate approved read-only source provides it without exchange calls. Target part: Tortila source boundary.
5. Severity P0 - Live controls and live server operations remain prohibited. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:13-24` says all controls are disabled at the adapter level until required gates pass; `docs/BOT_CONTROL_SAFETY_MODEL.md:33-43` prohibits SSH/systemctl/tmux/process kill/.env writes/exchange calls/key reads/state resets/direct config overwrites; `docs/NEXT_ACTIONS.md:123-124` says live exchange ping and live bot start/stop/apply-config remain disabled until bot-integration and security audits approve adapters. Recommendation: do not add, invoke, or test live-control paths in this phase. Target part: live-control safety.
6. Severity P1 - The first runnable progress, once inputs exist, is exact managed verification, not new architecture. Evidence: `package.json:25`, `package.json:38`, and `package.json:40` expose `accept:worker:continuity:managed`, `e2e:admin-user-bots:db:managed:matrix`, and `e2e:admin-user-bots:db:managed:user-routes`; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:18-28` documents the admin DB managed runner and artifact warning; `scripts/run-worker-continuity-managed.mjs:23-29` documents the worker continuity managed runner and no-live guarantee. Recommendation: run those exact commands only with isolated maintenance Postgres URLs and post-run artifact scans. Target part: managed DB gate execution.
7. Severity P1 - Managed DB runners are intentionally mutating create/drop harnesses and must not receive production/app DB URLs. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:33-52` and `scripts/run-admin-user-bot-detail-e2e-managed.mjs:112-124` validate a non-throwaway Postgres admin URL, create `wtc_test_admin_user_bots_*`, and drop it; `scripts/run-worker-continuity-managed.mjs:34-53` and `scripts/run-worker-continuity-managed.mjs:348-388` do the same for `wtc_test_worker_continuity_*` and require the full tuple. Recommendation: require operator confirmation that the supplied admin URLs point to isolated maintenance DBs with create/drop rights only for disposable test databases. Target part: DB safety.
8. Severity P1 - Artifact retention is security-sensitive by design. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:481-550` seeds hostile/raw source markers for user-route proof; `tests/e2e/user-bot-routes-db.spec.ts:19-28` forbids secret/raw markers in visible text and `tests/e2e/user-bot-routes-db.spec.ts:123` fails if `/api/marks` is requested; `docs/NEXT_ACTIONS.md:113-115` requires scanning stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` before retaining artifacts. Recommendation: treat artifact scanning as part of acceptance, not cleanup. Target part: evidence retention.

## Decisions
1. Stop as blocked on external inputs; do not perform another local Legacy/Tortila code/docs slice under the current constraints.
2. Continue only if one of these happens: a managed gate fails with a concrete defect, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied for isolated managed browser DB proof, `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied for isolated worker continuity proof, a real Legacy source artifact is supplied, Tortila journal env/auth/firewall inputs are supplied for a separate read-only real-read gate, live-control audits explicitly approve adapter work, or a dedicated deploy/CI phase is requested.
3. Keep `accept:bots:rendered`, `accept:bots:local`, mock worker smoke, local static tests, and UI copy changes out of the proof set for managed DB, real journal, Legacy source, live control, deploy, or CI completion.
4. Do not claim agents/gates green unless the per-agent handoff files and current-session command evidence exist.

## Risks
1. Continuing local polish now risks weakening the source-truth boundary by making blocked states look complete.
2. A syntactically valid managed admin DB URL can still point at the wrong database or cluster; the scripts cannot prove operator intent.
3. Managed browser proof deliberately creates hostile and secret-shaped evidence; unscanned screenshots, traces, reports, and logs can leak unsafe markers.
4. Real Tortila journal reads are blocked until auth/firewall are supplied; unauthenticated/public journal access must not become an implicit production path.
5. The worktree is broad and dirty with many pre-existing modified/untracked files; any deploy/CI phase needs explicit staging scope and fresh exact-tree gates.

## Verification/tests
RUN:
1. Read-only docs/code inspection of the files listed above.
2. `git status --short`, `git branch --show-current`, and `git log -1 --oneline` for orientation only. Observed branch `codex/bot-analytics-settings-canary-20260603`, latest commit `e2d705f Upgrade Legacy bot settings and pub_id stats`, and a broad pre-existing dirty tree.
3. Env presence audit by name only. Observed NOT_SET for `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `REAL_POSTGRES_ADMIN_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, `JOURNAL_READ_TOKEN`, `LEGACY_SOURCE_ARTIFACT`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `FEATURE_LIVE_BOT_CONTROL`, and `FEATURE_TV_AUTOMATION`.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:user-routes` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is NOT_SET and DB mutation is prohibited in this read-only audit.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is NOT_SET and DB mutation is prohibited in this read-only audit.
3. `npm run accept:worker:continuity:managed` - NOT RUN; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is NOT_SET and DB mutation is prohibited in this read-only audit.
4. Real Tortila journal reads - NOT RUN; journal URL/token/auth/firewall inputs are NOT_SET and this would be a separate source gate.
5. Legacy closed-trade import/source proof - NOT RUN; `LEGACY_SOURCE_ARTIFACT` is NOT_SET and docs still classify source as absent.
6. `/api/marks`, exchange pings, provider probes, live bot start/stop/apply-config, SSH/systemctl/tmux/process control, `.env` writes, deploy, CI, monitoring, and burn-in - NOT RUN; prohibited or separate approved phases.
7. Vitest/typecheck/Playwright/local acceptance gates - NOT RUN; this was a read-only boundary audit, and Phase 4.55 already recorded the latest local no-env proof.

## Next actions
1. If no external inputs are supplied, stop. Do not add another local Legacy/Tortila UI/static/docs polish slice.
2. If an isolated admin maintenance Postgres URL is supplied, run the current-user Tortila route proof first:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run e2e:admin-user-bots:db:managed:user-routes
```

3. With the same approved admin DB URL, run the selected-user matrix as a separate lane:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run e2e:admin-user-bots:db:managed:matrix
```

4. If an isolated worker-continuity admin maintenance Postgres URL is supplied, run:

```powershell
$env:WORKER_CONTINUITY_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run accept:worker:continuity:managed
```

Expected tuple: `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.

5. After every managed browser run, scan redacted stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for `USER_ROUTE_`, `SHOULD_NOT_RENDER`, `MUST_NOT_LEAK`, `99999`, `8888`, `apiKey`, `apiSecret`, `passwordHash`, `token=`, `Authorization`, `Cookie`, `postgres://`, `DATABASE_URL`, `SESSION_SECRET`, `SECRET_VAULT_KEK`, `JOURNAL_READ_TOKEN`, and raw public IP URLs before retaining artifacts. Then run:

```powershell
node scripts/check-retained-visual-artifacts.mjs --inventory tests/e2e/screenshots test-results playwright-report
```

6. If a real Legacy source artifact is supplied, first perform a read-only source-proof audit against required fields: stable trade id, mapped provider filter, symbol, side, size, entry/exit prices, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and raw-payload allowlist. Implement import only after that audit passes.
7. If Tortila real-read inputs are supplied, create a separate read-only continuity gate that proves authenticated journal reads, `sourceAdapter=tortila`, `readState=ok`, metric/position/trade import, source-config provenance, safety-signal ingestion, identity scope, redacted output, and no `/api/marks`.
8. Forbidden actions remain exact: do not run `/api/marks`; exchange pings; provider probes; Legacy direct HTTP/control routes; live bot start/stop/apply-config; SSH, systemctl, service, tmux/screen, process kill; `.env` writes; direct bot config overwrites; state resets; direct DB e2e against production/app DBs; deploy; CI; monitoring; or burn-in inside this boundary audit.
