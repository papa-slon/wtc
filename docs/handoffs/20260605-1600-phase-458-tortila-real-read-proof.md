# Phase 4.58 handoff - Tortila real-read proof

## Scope
Phase 4.58 continued after Phase 4.57 instead of stopping at managed DB proof. The goal was to make one more real, non-looping step: prove a WTC read-only Tortila source path against a local Tortila journal fixture while keeping Legacy closed-trade import blocked until a valid source artifact exists.

In scope:
- Launch/read auditor handoffs before implementation.
- Add an opt-in managed Tortila real-read proof runner.
- Use disposable local Postgres and temporary local Tortila SQLite fixture files only.
- Prove `sourceAdapter=tortila`, `readState=ok`, imported trade/position counts, and `marksRequests=0`.
- Keep live bot controls, exchange/provider probes, `/api/marks`, deploy, CI, monitoring, and production DB mutation out of scope.

Out of scope:
- Legacy closed-trade import without source proof.
- Production journal auth/firewall rollout.
- Live exchange key testing or exchange pings.
- Live bot start/stop/apply-config.
- Deploy/release.

## Agent handoffs
- [20260605-1600-tortila-real-read-proof-auditor.md](20260605-1600-tortila-real-read-proof-auditor.md)
- [20260605-1600-legacy-source-deep-auditor.md](20260605-1600-legacy-source-deep-auditor.md)
- [20260605-1600-phase-458-safety-tests-auditor.md](20260605-1600-phase-458-safety-tests-auditor.md)

Background agent ids from the operator context:
- `019e9736-ccf9-7433-a0ee-b2b3098bfbca`
- `019e9736-e131-7641-ad92-56eceb4d0300`
- `019e9736-ffa6-7883-8b5b-acb9b3b7ce86`

## Files changed
- `package.json`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`

## Findings
1. Severity P0 - Tortila real-read proof is now locally green. `npm run accept:tortila:real-read:managed` creates a temporary Tortila SQLite journal fixture, starts the local Tortila journal behind an allowlist proxy, runs the WTC worker in `BOT_ADAPTER_MODE=read-only`, verifies `sourceAdapter=tortila` and `readState=ok`, then drops the disposable Postgres DB and deletes temporary files.
2. Severity P0 - `/api/marks` remains excluded. The proof proxy only allows `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, fails if `/api/marks` is requested, and the green run verified `marksRequests=0`.
3. Severity P0 - The WTC persisted evidence is source-backed, not fabricated UI copy. The green run verified `tradesImported=2`, `positionsSnapshotted=1`, `tradeCount=2`, `source_adapter='tortila'`, and `tortila-journal` health `readState=ok`.
4. Severity P1 - The first two red runs found harness defects, not product regressions: a synchronous child process blocked the local proxy event loop, then an empty `SYSTEM_BOT_INSTANCE_ID` was passed as a UUID. Both were fixed in the runner and guarded by tests.
5. Severity P0 - Legacy closed-trade import remains hard-blocked. The deep source auditor found no `VALID_SOURCE_CANDIDATE`; Legacy-like folders were insufficient, and Tortila/Turtle, GTE/Axioma, BOT_TFLAB, archived overlays, WTC fixtures, and destination code were classified as wrong product, demo fixture, or insufficient.

## Decisions
1. Keep the Tortila proof as a managed opt-in acceptance runner: `npm run accept:tortila:real-read:managed`.
2. Treat the local Tortila journal fixture as real read-path proof through WTC adapter/worker, not as production auth/firewall completion.
3. Keep `/api/marks`, `/api/overview`, exchange calls, and live bot control forbidden.
4. Do not implement Legacy closed-trade import until a valid source artifact names stable id, provider/user scope, symbol, side, size, entry/exit, realized PnL, fees/funding, timestamps, exit reason, replay semantics, and raw-payload allowlist.

## Risks
1. This proves WTC can read a local Tortila journal source safely, but production journal auth/firewall remains a separate deployment/security gate.
2. The proof uses a temporary seeded SQLite fixture for deterministic trades/positions. A real local `turtle_bot.db` with empty trades can only prove equity/health, not full import.
3. The worker health tuple is `not_configured/attention` in this narrow Tortila proof because Legacy live source is intentionally disabled; the Tortila-specific evidence is green.
4. The worktree remains broad and dirty; release needs explicit staging/commit/deploy proof.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts` - PASS; 4 tests.
2. `npm run accept:tortila:real-read:managed` - PASS; verified `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, `marksRequests=0`.
3. Focused Vitest: `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS; 4 files, 44 tests.
4. `npm run typecheck -w @wtc/worker` - PASS.
5. `npm run typecheck` - PASS.
6. `npm run lint` - PASS after removing an unused import.
7. `npm run secret:scan` - PASS.
8. `git diff --check` - PASS.

NOT RUN:
1. Legacy closed-trade import - NOT RUN; source proof absent.
2. Tortila production journal auth/firewall proof - NOT RUN; separate environment/security gate.
3. `/api/marks` and `/api/overview` - NOT RUN; excluded by proof proxy and contract.
4. Exchange/provider live probes - NOT RUN.
5. Live bot start/stop/apply-config/test-connection - NOT RUN.
6. Deploy, CI, monitoring, and burn-in - NOT RUN.

## Next actions
1. Rerun `npm run accept:tortila:real-read:managed` whenever Tortila adapter/worker/journal mapping changes.
2. Start a production Tortila journal auth/firewall phase only when deployment networking/token rules are ready.
3. Keep Legacy source/import blocked until a valid source artifact is supplied and audited.
4. Start a dedicated release phase for staging/commit/PR/deploy/CI/post-deploy smoke when the tree should ship.
