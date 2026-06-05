# Phase 4.54 handoff - Tortila user-route DB proof lane

## Scope
Phase 4.54 closed the local missing-lane gap for current-user Tortila Mark/uPnL browser proof. The implementation adds an opt-in user-route mode to the existing selected-user admin managed DB harness instead of creating a second DB lifecycle.

In scope:
- Reuse `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` managed create/drop guard for the new user-route lane.
- Make the selected-user fixture login-capable for local e2e auth.
- Seed hostile Tortila real-source Mark/uPnL values only in user-route mode.
- Add a browser spec for `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`.
- Add static harness coverage for scripts, guards, fixture strings, spec assertions, and default Playwright exclusion.

Out of scope:
- Actual managed DB browser run without `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
- Real Tortila journal/auth/firewall proof.
- `/api/marks` calls, exchange probes, provider probes, live bot start/stop/apply-config, deploy, or CI.

## Agent handoffs
- [20260605-0550-user-route-db-proof-platform-auditor.md](20260605-0550-user-route-db-proof-platform-auditor.md)
- [20260605-0550-user-route-db-proof-security-auditor.md](20260605-0550-user-route-db-proof-security-auditor.md)
- [20260605-0550-user-route-db-proof-tests-auditor.md](20260605-0550-user-route-db-proof-tests-auditor.md)
- [20260605-0610-loop-regression-auditor.md](20260605-0610-loop-regression-auditor.md)

The three 0550 read-only agents were dispatched before implementation edits. The loop-regression auditor was launched later after the operator asked whether the process had become circular. All four agents were closed before this final report.

## Files changed
- `package.json`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.admin-user-bots-db.config.ts`
- `playwright.config.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`

## Decisions
1. Reused the existing selected-user DB harness and added `--user-routes`, because the platform auditor found a second DB lifecycle unnecessary for this proof.
2. Kept the managed env source as `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; the lane remains opt-in and creates/drops throwaway `wtc_test_admin_user_bots_*` DBs.
3. Switched only user-route mode to `BOT_ADAPTER_MODE=read-only` so `loadBotReadModelForUser()` consumes user-scoped DB snapshots instead of mock adapter data.
4. Made `admin-drilldown-a@wtc.local` login-capable with the seeded demo password hash in the throwaway fixture, avoiding any broader auth-bypass route change.
5. Seeded hostile values (`markPrice: 99999.99`, `unrealizedPnlUsd: 8888.88`, raw markers) only when `ADMIN_USER_BOTS_E2E_USER_ROUTES=1`.

## Findings
1. Phase 4.54 is not a loop. The loop-regression auditor found that 4.52 handled `/api/marks` contract/worker/admin exclusion, 4.53 handled UI/read-model semantics, and 4.54 targets the missing user-route DB-rendered proof.
2. The actual managed browser proof is still blocked by environment, not by local implementation. The exact command is `npm run e2e:admin-user-bots:db:managed:user-routes` with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
3. Further local Legacy source-proof polish should stop unless a managed DB run fails or a real source artifact appears. The remaining blockers are env/source/safety/deploy gates.

## Risks
1. The managed browser proof can still only be claimed after a real throwaway admin Postgres URL is supplied and the opt-in lane is run.
2. Screenshots/traces from the managed run must be scanned before retention because the fixture deliberately seeds hostile raw/secret markers.
3. Future local work can become circular if it keeps adding UI/static proof instead of clearing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, Tortila journal env/auth, Legacy source proof, live-control audit, or deploy/CI.
4. Reusing the admin-user-bots harness keeps the lifecycle small, but the command name remains admin-oriented; `NEXT_ACTIONS.md` now documents that the same harness also covers current-user route proof.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS, 7 tests.
2. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 4 files, 50 tests.
3. `node scripts/run-admin-user-bot-detail-e2e-managed.mjs --help` - PASS; documents `--user-routes`.
4. `node scripts/run-admin-user-bot-detail-e2e-managed.mjs --matrix --user-routes` - refused before DB as expected.
5. `node scripts/run-admin-user-bot-detail-e2e-managed.mjs --wat` - refused before DB as expected.
6. `npm run typecheck -w @wtc/web` - PASS.
7. `npm run typecheck` - PASS.
8. `node scripts/run-admin-user-bot-detail-e2e.mjs --help` - PASS; documents direct user-route mode.
9. `node scripts/run-admin-user-bot-detail-e2e.mjs --wat` - refused before DB as expected.
10. `npm run secret:scan` - PASS.
11. `npm run governance:check` - PASS before this aggregate; rerun after aggregate required.
12. `git diff --check` - PASS.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:user-routes` - blocked because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied.
3. `npm run accept:worker:continuity:managed` - blocked because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not supplied.
4. Real Tortila journal read-only continuity - blocked by absent journal env/auth/firewall proof.
5. Legacy closed-trade import - blocked by absent source artifact.
6. `/api/marks`, exchange probes, provider probes, live bot start/stop/apply-config - intentionally not run.
7. Deploy, GitHub CI, production monitoring, and burn-in - not run.

## Next actions
1. When a throwaway admin Postgres URL is available, run:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run e2e:admin-user-bots:db:managed:user-routes
```

2. Scan redacted stdout/stderr plus `test-results`, `playwright-report`, and `tests/e2e/screenshots` for hostile markers before retaining artifacts.
3. Then either run the admin DB matrix or the managed worker continuity tuple, depending on which env is supplied first.
4. Do not spend another phase on local Legacy/Tortila UI polish unless it consumes a real env/source/deploy blocker or fixes a fresh failing gate.
