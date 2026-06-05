# Phase 4.47 Legacy source-proof preflight handoff

## Scope
No-env source-truth closure for Legacy closed-trade statistics. The goal was not to implement a Legacy importer; all
auditors returned source-blocked/`NO_SOURCE`, so this phase added a fail-closed source-proof preflight that prevents WTC from
turning active order/slot state or non-Legacy journals into fake realized performance.

Read-only phase handoffs:
- [20260605-0333-legacy-closed-trade-source-auditor.md](20260605-0333-legacy-closed-trade-source-auditor.md)
- [20260605-0333-legacy-closed-trade-destination-auditor.md](20260605-0333-legacy-closed-trade-destination-auditor.md)
- [20260605-0333-legacy-closed-trade-tests-auditor.md](20260605-0333-legacy-closed-trade-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- [20260605-0333-legacy-closed-trade-source-auditor.md](20260605-0333-legacy-closed-trade-source-auditor.md)
- [20260605-0333-legacy-closed-trade-destination-auditor.md](20260605-0333-legacy-closed-trade-destination-auditor.md)
- [20260605-0333-legacy-closed-trade-tests-auditor.md](20260605-0333-legacy-closed-trade-tests-auditor.md)
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- Nearby Legacy/Tortila/GTE source candidates under `C:/Users/maxib/GTE BOT`, excluding env/secret/log/data-dump paths.

## Files changed
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0333-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260605-0333-legacy-closed-trade-destination-auditor.md`
- `docs/handoffs/20260605-0333-legacy-closed-trade-tests-auditor.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`

## Findings
1. Severity P1 - Durable Legacy closed-trade source proof is still absent. Evidence:
   [20260605-0333-legacy-closed-trade-source-auditor.md](20260605-0333-legacy-closed-trade-source-auditor.md) returns
   `NO_SOURCE`; `apps/worker/src/legacy-live.ts` still builds Legacy snapshots from provider accounts, settings, active
   slots, and active orders and keeps closed PnL/fees/funding unavailable with `tradeCount: 0`. Recommendation: keep Legacy
   realized statistics pending. Target part: Legacy analytics/import.
2. Severity P1 - The destination contract is ready but not a source. Evidence:
   [20260605-0333-legacy-closed-trade-destination-auditor.md](20260605-0333-legacy-closed-trade-destination-auditor.md)
   confirms `bot_trade_imports` and `importBotTrade()` can store provider-scoped immutable trades once a real source is
   proven. Recommendation: do not add another destination migration until source proof shows a missing concept. Target part:
   WTC DB import contract.
3. Severity P1 - A fail-closed preflight is now encoded in code, not only docs. Evidence:
   `apps/worker/src/legacy-closed-trade-source-proof.ts` defines required proof fields, forbidden substitutes, raw-payload
   allowlist validation, and `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.status === 'blocked_no_source'`; `apps/worker/src/legacy-live.ts`
   records only the safe proof summary in metric raw JSON. Recommendation: future importer work must update this proof only
   after a source artifact names line-level source evidence. Target part: worker preflight.
4. Severity P1 - Focused tests now guard the false-source cases. Evidence:
   `tests/integration/legacy-closed-trade-source-proof-static.test.ts` requires source table/API, mapped provider filter,
   stable trade/fill id, economic fields, timestamps, replay semantics, raw allowlist, and explicit rejection of inactive
   orders, inactive slots, open-order reconciliation, position snapshots, Tortila/Turtle journals, and GTE journals.
   Recommendation: keep this test in the focused Legacy gate set. Target part: source-proof tests.

## Decisions
1. Chose Path B from the tests auditor: fail-closed source-proof/preflight artifacts, not a Legacy importer.
2. Kept Legacy `no_trade_history`, closed PnL, win rate, profit factor, fees, funding, and trade count semantics unchanged.
3. Added a small worker-side preflight module rather than a new DB table or UI page.
4. Stored only non-secret proof status and missing requirement keys in worker metric raw JSON.
5. Closed the three background agents for this phase after collecting their handoffs.

## Risks
1. The preflight proves source readiness shape, not the real upstream data itself. A future phase still needs a source-proof
   artifact with evidence references before mapper implementation.
2. A future fully-populated candidate can only mean mapper-ready; importer replay and provider-scope tests must still pass
   before UI changes from pending to loaded.
3. Managed worker continuity and selected-user DB matrix remain blocked by missing throwaway DB env variables.
4. Live exchange ping, live bot start/stop/apply-config, live provider reads, deploy, CI, and production monitoring remain
   separate not-run gates.

## Verification/tests
RUN:
1. This phase's read-only agents created handoffs before implementation:
   [20260605-0333-legacy-closed-trade-source-auditor.md](20260605-0333-legacy-closed-trade-source-auditor.md),
   [20260605-0333-legacy-closed-trade-destination-auditor.md](20260605-0333-legacy-closed-trade-destination-auditor.md), and
   [20260605-0333-legacy-closed-trade-tests-auditor.md](20260605-0333-legacy-closed-trade-tests-auditor.md).
2. Source sweep/static inspection of WTC Legacy worker, WTC import destination, nearby Legacy source candidates, Tortila/Turtle
   source candidates, and GTE journal source candidates, excluding env/secret/log/data-dump paths.
3. `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts`
   -> PASS (`5` files, `47` tests).
4. `npm run typecheck` -> PASS.
5. `npm run typecheck -w @wtc/worker` -> PASS.
6. `npm run typecheck -w @wtc/web` -> PASS.
7. `npm run secret:scan` -> PASS.
8. `npm run governance:check` -> PASS (`0` errors, one known historical warning).
9. `git diff --check` -> PASS.
10. Completed background agents were closed after collecting results:
    `019e9457-7c21-7cf2-a61b-ab52c1ebd13f`, `019e9457-9033-7230-a43e-ea67430ed938`, and
    `019e9457-a4ec-7222-8192-b389e8c13411`.

NOT RUN:
1. Legacy closed-trade importer - not implemented because source proof is still absent.
2. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
3. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
4. `npm run accept:bots:local`, rendered Playwright/browser gates, and visual inventory - not rerun because this phase changed
   worker source-proof metadata and tests, not user/admin UI rendering.
5. Live Legacy DB/provider/exchange probes, live exchange ping, live bot start/stop/apply-config - blocked by safety protocol.
6. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this source-proof preflight phase.

## Next actions
1. If a real Legacy source artifact appears, run a new phase to validate it against the preflight and then implement a
   fixture-backed mapper/importer with provider-scoped replay tests.
2. If managed throwaway DB env is supplied first, run `npm run accept:worker:continuity:managed` and
   `npm run e2e:admin-user-bots:db:managed:matrix` as separate gated work.
