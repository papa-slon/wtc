# ecosystem-tests-runner handoff
## Scope
Read-only audit of current static and Playwright coverage for user-facing Tortila position/overview surfaces after Phase 4.52. Focus was the smallest test patch needed to prove ordinary user Tortila position pages do not render placeholder Mark/uPnL as live values, and that no `/api/marks` or exchange/live-control copy appears.

No code, live servers, env, secrets, exchange endpoints, `/api/marks`, or bot controls were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/worker/src/jobs.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - Ordinary user Tortila positions currently have the right masking implementation but no focused rendered real-mode regression proof. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` sets `markUnavailable` only for `tortila_bot` with `read.adapterMode === 'real'`; `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:57-58` renders Mark and uPnL as `N/A` only through that branch. Current smoke coverage visits `/app/bots/tortila/positions` and checks `NEAR-USDT` only, not Mark/uPnL masking (`tests/e2e/smoke.spec.ts:126-130`). Recommendation: add one focused rendered assertion for `/app/bots/tortila/positions` under a non-mock/DB-backed Tortila snapshot containing hostile placeholder Mark/uPnL values, and assert Mark/uPnL cells render `N/A`. Target part: `tests/e2e/smoke.spec.ts` or a new narrowly scoped user-bot DB Playwright spec reusing the admin DB fixture pattern.

2. Severity P1 - The DB read model still normalizes persisted missing/synthetic position values into live-looking numbers before the page masks them, so the rendered page mask must be pinned. Evidence: `apps/web/src/features/bots/data.tsx:534-535` infers `adapterMode` from snapshot `sourceAdapter`, and `apps/web/src/features/bots/data.tsx:575-588` maps DB rows by defaulting `markPrice` to `entryPrice` and `unrealizedPnl` to `0`. Recommendation: the test should seed a Tortila position with explicit hostile `markPrice` and `unrealizedPnlUsd` values under a real-looking source adapter, then assert those values do not appear and `N/A` appears in the Mark/uPnL cells. Target part: user positions rendered acceptance.

3. Severity P2 - Phase 4.52 already proves the selected-user admin version of this behavior, but that proof does not cover the ordinary user route. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:398-416` seeds `A_ONLY_POSITION_SYMBOL` with `markPrice: '105.00000000'` and `unrealizedPnlUsd: '12.5000'`; `tests/e2e/admin-user-bot-detail-db.spec.ts:303-306` asserts the selected-user admin Mark/uPnL cells are `N/A`; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:162-165` statically pins that admin assertion. Recommendation: copy the same hostile-value pattern into a user-facing Tortila positions fixture/spec instead of expanding the admin assertion. Target part: `tests/e2e/smoke.spec.ts` or a new opt-in user positions DB harness.

4. Severity P2 - Current static coverage guards the no-`/api/marks` contract and admin `N/A` formatter, but not the user positions route text boundary. Evidence: `tests/integration/two-bot-continuity-contract-static.test.ts:152-162` checks adapter/contract no-`/api/marks`, worker omission, and admin formatter; `tests/integration/bot-read-safety-static.test.ts:73-77` confirms bot pages use the safe read model and not direct adapters; `tests/integration/bot-read-safety-static.test.ts:364-374` confirms production Tortila read-only UI is DB-snapshot backed. Recommendation: add static assertions that `positions/page.tsx` contains the `markUnavailable` branch, `N/A` Mark/uPnL rendering, and does not contain `/api/marks`, `Connection verified`, `startBot`, `stopBot`, `applyConfig`, or live-control route copy. Target part: `tests/integration/bot-read-safety-static.test.ts`.

5. Severity P2 - Worker-side storage behavior is already guarded and should be kept in the focused command set. Evidence: `apps/worker/src/jobs.ts:216-228` only persists Tortila position mark/uPnL placeholders when `adapter.mode !== 'real'`; the Phase 4.52 aggregate recorded focused worker snapshot proof as part of 32 Vitest tests. Recommendation: keep `tests/integration/worker-tortila-snapshot.test.ts` in the focused patch command so storage and rendering remain tied. Target part: focused verification commands.

## Decisions
1. Smallest useful patch is test-only: add one rendered user positions proof plus static pins. No application behavior change is recommended by this audit because the user positions page already masks real-mode Tortila Mark/uPnL.
2. Prefer a narrowly scoped user-facing DB Playwright fixture/spec if a prepared throwaway DB is available; otherwise extend `tests/e2e/smoke.spec.ts` only if the existing local/mock route can be forced into the real-mode snapshot path without live env.
3. Do not add any `/api/marks` fetch, exchange probe, provider probe, live-control affordance, or live server mutation.

## Risks
1. Default `tests/e2e/smoke.spec.ts` currently runs in mock mode, so a naive assertion there would not exercise `markUnavailable` and could produce false confidence.
2. Reusing the selected-user admin managed DB harness directly would prove admin rendering again, not the ordinary user `/app/bots/tortila/positions` route.
3. If the patch adds a new DB-backed user positions Playwright runner, it must be opt-in or scrubbed like the existing admin DB runner so local/default gates do not require managed DB env.
4. Real Tortila journal auth/firewall and worker continuity remain separate NOT RUN gates; this audit is only about rendered truth for already persisted user position snapshots.

## Verification/tests
Read-only inspection only. No test command was run in this auditor lane.

Recommended focused commands after the test patch:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/worker-tortila-snapshot.test.ts`
2. If implemented as default local rendered coverage: `npx playwright test tests/e2e/smoke.spec.ts --grep "bot dashboard sub-tabs render with unified analytics"`
3. If implemented as a new opt-in DB rendered coverage: run its dedicated prepared-DB command, mirroring the existing managed DB style, and keep DSNs redacted.
4. `npm run typecheck -w @wtc/web`
5. `git diff --check`

Not run:
1. Live Tortila journal reads - blocked/out of scope.
2. `/api/marks`, exchange ping, provider probes, live bot start/stop/apply-config - forbidden/out of scope.
3. Managed DB browser matrix - not run in this read-only lane and requires explicit throwaway DB env.

## Next actions
1. Add the focused user-facing rendered test for `/app/bots/tortila/positions` with hostile Mark/uPnL fixture values and assert the row renders `N/A` for both cells.
2. Add static pins in `tests/integration/bot-read-safety-static.test.ts` for the positions page `markUnavailable` branch and absence of `/api/marks`/live-control copy.
3. Run the recommended focused commands above and record exact RUN/NOT RUN gates in the next aggregate handoff.
