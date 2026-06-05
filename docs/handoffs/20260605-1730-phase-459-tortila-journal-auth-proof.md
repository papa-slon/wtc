# phase-4-59-tortila-journal-auth-proof handoff
## Scope
Phase 4.59 hardens the local Tortila journal read boundary after Phase 4.58 proved WTC read-only ingestion from a local Tortila journal fixture. The slice adds a local `JOURNAL_READ_TOKEN` gate to the adjacent `../bot_tortila` checkout, then updates the WTC managed real-read runner to prove missing-token, wrong-token, and correct-token behavior before worker execution.

This phase does not enable live bot control, exchange/provider probes, `/api/marks`, production DB mutation, production deploy, or production network/firewall changes.

Per-agent handoffs:
- [`docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`](20260605-1730-tortila-journal-auth-boundary-auditor.md)
- [`docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md`](20260605-1730-tortila-auth-proof-tests-auditor.md)
- [`docs/handoffs/20260605-1730-phase-459-safety-gate-auditor.md`](20260605-1730-phase-459-safety-gate-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`
- `docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md`
- `docs/handoffs/20260605-1730-phase-459-safety-gate-auditor.md`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `../bot_tortila/AGENTS.md`
- `../bot_tortila/src/turtle_bot/journal/app.py`
- `../bot_tortila/tests/test_journal.py`

## Files changed
- `../bot_tortila/src/turtle_bot/journal/app.py`
- `../bot_tortila/tests/test_journal.py`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`

## Findings
1. `high` - The local Tortila journal API was readable without an explicit read token when embedded behind WTC's local proof harness. Evidence: `../bot_tortila/src/turtle_bot/journal/app.py` previously had no configured-token guard for `/api/*`. Recommendation: require `JOURNAL_READ_TOKEN` when configured, accept bearer or `x-journal-read-token`, and return a normal JSON 401 for missing/wrong tokens. Target part: Tortila journal local proof boundary.
2. `high` - Raising `HTTPException` directly from FastAPI middleware produced an exception-group failure in the native journal pytest instead of a stable 401 response. Evidence: `python -m pytest tests/test_journal.py -q` initially failed `test_api_requires_read_token_when_configured`. Recommendation: make the middleware return `JSONResponse({"detail": ...}, status_code=401)`. Target part: Tortila journal auth middleware.
3. `medium` - Phase 4.58 proved WTC worker success with a correct token but did not separately prove negative auth cases in the managed runner. Evidence: `docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md`. Recommendation: add an explicit runner auth matrix before worker execution, then clear preflight request logs so final endpoint evidence remains worker-owned. Target part: WTC managed Tortila real-read runner.
4. `medium` - The adjacent `../bot_tortila` checkout is not git-backed in this workspace. Evidence: `git -C ../bot_tortila status` failed before this phase. Recommendation: treat the local journal patch as proven local source, not canonical production landing, until the canonical bot repository is identified and updated. Target part: release/source-control workflow.

## Decisions
- Gate only `/api/*` in the local Tortila journal when `JOURNAL_READ_TOKEN` is configured; leave browser HTML pages unchanged for this local proof slice.
- The WTC runner starts the local journal with a proof token, verifies missing token equals 401, wrong bearer equals 401, correct bearer passes `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, and correct `x-journal-read-token` passes `/api/summary`.
- The WTC runner clears proxy request logs after auth preflight and before the worker tick, so final required endpoint evidence still proves the worker path.
- `/api/marks` remains permanently excluded and counted as a failure if requested. `/api/overview` is also refused as outside the current WTC proof lane.

## Risks
- Production Tortila auth/firewall is not green from this phase. It still needs real secret provisioning, service/env rollout, firewall or security-group proof, authorized positive/negative probes, deploy/monitoring evidence, and artifact scans.
- The local `../bot_tortila` patch must be reconciled into the canonical bot source before release because this adjacent checkout is not git-backed.
- Legacy closed-trade import remains blocked by missing source proof; this phase intentionally does not infer Legacy realized analytics from Tortila/GTE/slot/order data.
- A stale protected `pg_ctl`/Postgres process tree owned by the host OS remained visible after earlier local experimentation, but the Phase 4.59 disposable ports were freed and the Phase 4.59 `PGDATA` directories were removed.

## Verification/tests
RUN:
- `python -m pytest tests/test_journal.py -q` in `../bot_tortila` - PASS (`31` tests).
- `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts` - PASS (`4` tests).
- `npm run accept:tortila:real-read:managed` with isolated local Postgres on `127.0.0.1:55436` - PASS; verified `missingToken=401`, `wrongToken=401`, `bearerAllowedEndpoints=4`, `tokenHeader=ok`, `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, and `marksRequests=0`.
- `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS (`44` tests).
- `npm run typecheck -w @wtc/worker` - PASS.
- `npm run typecheck` - PASS.
- `npm run lint` - PASS.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS (`0` errors, one known historical warning for `20260529-1921-integration-risk-auditor.md`).
- `git diff --check` - PASS.

NOT RUN:
- Production Tortila auth/firewall deploy or network probes - no authorized production target/secrets/firewall scope in this local phase.
- Live exchange/provider probes, exchange key tests, live bot start/stop/apply-config - still blocked by live-control/security audit.
- `/api/marks` positive integration - intentionally excluded from WTC.
- Legacy closed-trade import - blocked by missing valid Legacy closed-trade source artifact.
- CI, production deploy, monitoring, and burn-in - out of this local proof scope.

## Next actions
1. Reconcile the local Tortila journal auth patch into the canonical git-backed Tortila bot source before release.
2. For production Tortila completion, provision real read token secrets, bind the service behind loopback/VPN/firewall controls, run authorized positive/negative probes, and capture deploy/monitoring evidence without printing secrets.
3. Continue Legacy only when a valid source artifact proves the closed-trade table/API and replay semantics; do not implement from inactive orders, slots, open positions, Tortila/Turtle, or GTE manual journals.
4. Do not add more local UI/static polish unless a fresh gate fails; the next non-looping progress is production auth/firewall, canonical source landing, Legacy source proof, live-control audit, or deploy/CI proof.
