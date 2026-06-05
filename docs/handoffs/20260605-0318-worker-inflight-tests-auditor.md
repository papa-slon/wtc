# worker-inflight-tests-auditor handoff
## Scope
Read-only Phase 4.46 tests/gates audit for the minimal no-env worker in-flight guard around DB worker ticks. Scope is limited to identifying focused test coverage and safe gates. No product/source/test/docs edits were made beyond this required handoff. No live provider probes, DB mutation, server start/stop, bot start/stop, or live-control action was performed.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `apps/worker/src/index.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `scripts/gates.mjs`
- `package.json`
## Files changed
None — read-only audit
## Findings
1. Severity P1 - The target Phase 4.46 gap is explicitly a no-env in-flight guard, and it should stay local/testable. Evidence: `docs/NEXT_ACTIONS.md:52`-`54` says the next item is a serialized/in-flight guard around DB worker ticks so a slow tick cannot overlap the next interval, and says not to call providers. Recommendation: implement the guard as a tiny worker-local scheduler primitive with an injected async tick function so Vitest can prove serialization without `DATABASE_URL`, providers, or a managed DB. Target part: `apps/worker/src/index.ts` scheduler and focused worker continuity tests.
2. Severity P1 - The DB interval currently has no in-flight state, so a slow `runDbWorkerTick(db)` can overlap the next interval. Evidence: `apps/worker/src/index.ts:393`-`404` creates one DB handle, runs an initial tick, then calls `runDbWorkerTick(db)` on every interval with only a `.catch()` handler and no pending-promise guard. Recommendation: add an explicit in-flight guard that starts a tick only when idle, skips/logs an overlap attempt, resets after both resolve and reject, and preserves the existing redacted error behavior. Target part: `apps/worker/src/index.ts`.
3. Severity P1 - The minimal regression test should be pure/no-env and focused on the guard behavior, not on managed DB acceptance. Evidence: `package.json:23`-`25` separates the no-env fixture, strict DB continuity wrapper, and managed runner; `tests/integration/worker-continuity-acceptance-runner.test.ts:42`-`52` asserts managed continuity is not embedded in local gates; `tests/integration/two-bot-continuity-contract-static.test.ts:132`-`145` asserts the no-env fixture stays separate from provider probes, managed DB, and live adapters. Recommendation: add or extend a Vitest test that uses deferred promises to assert: first tick starts, second trigger while pending is skipped and does not call the tick body, the guard allows a later tick after resolve, and the guard allows a later tick after reject while preserving redacted error handling. Target part: `tests/integration/two-bot-continuity-contract-static.test.ts` or a new focused `tests/integration/worker-inflight-guard.test.ts`.
4. Severity P2 - `worker:smoke` and `accept:bots:continuity:contract` are necessary sanity gates but not sufficient alone for the DB-overlap bug. Evidence: `package.json:21`-`23` maps `worker:smoke` to the safe worker wrapper and the fixture to the static continuity test; `scripts/gates.mjs:130`-`133` defines `worker-smoke` and `worker-continuity-fixture`; `scripts/gates.mjs:174`-`175` composes the local continuity plan from those two gates. Recommendation: run those existing commands after the focused in-flight test, but do not treat them as proof unless the new guard test is present and passing. Target part: gate selection.
5. Severity P2 - Managed DB and live-control gates remain out of scope for this no-env slice. Evidence: `docs/NEXT_ACTIONS.md:55`-`59` says `npm run accept:worker:continuity:managed` is blocked until `WORKER_CONTINUITY_ADMIN_DATABASE_URL` exists and must use throwaway DBs without echoing DSNs; `docs/NEXT_ACTIONS.md:65`-`66` keeps live exchange ping and live bot start/stop/apply-config disabled; `tests/integration/legacy-live-worker-static.test.ts:164`-`180` protects the Legacy worker boundary from serialized exchange-key fields and credential-column selects. Recommendation: do not run managed continuity, admin-user-bots managed matrix, provider probes, or any live bot/server action for Phase 4.46. Target part: test/gate plan.
## Decisions
1. Recommended test shape: prefer an exported worker-local helper such as `createInFlightTickGuard()` or equivalent from `apps/worker/src/index.ts`, with an injected async callback and optional logger, so tests can drive overlap deterministically without timers or DB connections.
2. Minimal focused coverage should live in `tests/integration/two-bot-continuity-contract-static.test.ts` if the team wants to keep all no-env continuity contracts together; use a new `tests/integration/worker-inflight-guard.test.ts` only if the guard test becomes too large for that file.
3. Keep `npm run accept:bots:continuity:contract` as the focused acceptance aggregate because `scripts/gates.mjs` already keeps it local-only and separate from managed DB.
4. Do not add the managed continuity runner to `scripts/gates.mjs` local plans for this slice.
## Risks
1. The checkout was already dirty before this audit, including worker, gate, package, test, and many handoff files. Treat existing changes as pre-existing and avoid broad cleanup in this phase.
2. A static source assertion alone would miss real overlap behavior. The guard needs a deterministic async unit/contract test with a pending promise.
3. Timer-based tests can become flaky on Windows. Prefer directly invoking the guard twice while the first promise is unresolved instead of waiting for real `setInterval`.
4. `worker:smoke` in no-DB mode proves the memory/safe wrapper path, not the DB interval serialization path by itself.
## Verification/tests
Product gates were NOT RUN in this read-only audit. Only read-only file inspection and `git status --short --branch` were performed.

Exact focused commands to run after the implementation/test patch:

```powershell
npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/legacy-live-worker-static.test.ts
npm run typecheck -w @wtc/worker
npm run worker:smoke
npm run accept:bots:continuity:contract
npm run secret:scan
npm run governance:check
git diff --check
```

Exact gates NOT RUN for this no-env slice unless prerequisites are explicitly supplied:

```powershell
npm run accept:worker:continuity:managed
npm run e2e:admin-user-bots:db:managed:matrix
node scripts/gates.mjs e2e
npm run accept:bots:local
```

Reasons: managed worker continuity requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and throwaway DB creation; admin-user-bots DB matrix requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; e2e/rendered/local website gates start browser/dev-server flows and are outside the DB in-flight guard; no live provider, exchange, server, or bot control is allowed in this audit scope.
## Next actions
1. Implement the in-flight guard in `apps/worker/src/index.ts` around DB interval ticks, with no provider calls and no DB mutation in the guard test itself.
2. Add the focused no-env Vitest coverage described above before running broader gates.
3. Run the exact focused commands listed in `## Verification/tests`.
4. In the aggregate Phase 4.46 handoff, cite this handoff and list all gates RUN vs NOT RUN with observed results only.
