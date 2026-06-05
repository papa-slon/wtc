# legacy-closed-trade-tests-auditor handoff
## Scope
Read-only tests/gates audit for WTC Phase 4.47 Legacy closed-trade source proof.

Objective: identify the minimal tests and gates for either:
- Path A: implement Legacy closed-trade import after a source is proven.
- Path B: add fail-closed source-proof/preflight artifacts while no source is proven.

Current recommendation: Path B. Phase 4.39 and `docs/NEXT_ACTIONS.md` still mark Legacy closed-trade import as source-blocked.

Safety scope observed: no `.env` or secret reads, no live provider calls, no DB mutation, no live server/bot control, no source/product/test/doc edits except this required handoff. No gates were run because the requested output is an audit handoff and running the local gate runner would create additional log artifacts.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `package.json`
- `scripts/gates.mjs`
- Focused evidence references: `apps/worker/src/legacy-live.ts`, `apps/web/src/features/bots/statistics-panels.tsx`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx`, `apps/web/src/features/bots/data.tsx`, `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`

## Files changed
None - read-only audit. Required handoff written at `docs/handoffs/20260605-0333-legacy-closed-trade-tests-auditor.md`.

## Findings
1. Severity P1 - Current evidence selects Path B, not Path A. Evidence: Phase 4.39 says no durable local Legacy closed-trade/fill source was proven and the importer must wait for a source-proof artifact (`docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:44`, `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:67`); `docs/NEXT_ACTIONS.md` repeats "do not implement Legacy closed-trade import" until the proof names table/API, required economic fields, replay semantics, and raw-payload allowlist (`docs/NEXT_ACTIONS.md:61`, `docs/NEXT_ACTIONS.md:63`). Recommendation: implement fail-closed source-proof/preflight artifacts first. Target part: Phase 4.47 scope selection.

2. Severity P1 - The minimal Path B test addition should be a static fail-closed source-proof/preflight test, not a worker importer test. Evidence: existing worker static coverage already asserts `no_trade_history`, whitelisted Legacy columns, and no exchange credential column selection (`tests/integration/legacy-live-worker-static.test.ts:160`, `tests/integration/legacy-live-worker-static.test.ts:175`, `tests/integration/legacy-live-worker-static.test.ts:178`); UI completion tests already require pending import copy and hidden PF/win-rate/realized-PnL claims (`tests/integration/bot-statistics-completion.test.ts:31`, `tests/integration/bot-statistics-completion.test.ts:33`, `tests/integration/bot-statistics-completion.test.ts:48`). Recommendation: add `tests/integration/legacy-closed-trade-source-proof-static.test.ts` to require a fail-closed artifact that refuses "ready" unless every mandatory source field, provider filter, replay rule, and raw-payload allowlist is documented; it should also reject inactive orders/slots and Tortila/Turtle journal rows as Legacy substitutes. Target part: source-proof/preflight artifacts.

3. Severity P1 - If Path A later unblocks, importer tests must prove destination idempotency and provider scoping before UI is allowed to show loaded closed trades. Evidence: `bot_trade_imports` includes provider-scoped trade uniqueness (`packages/db/src/schema.ts:565`, `packages/db/src/schema.ts:589`, `packages/db/src/schema.ts:592`), and `importBotTrade()` applies provider-scoped/unscoped conflict handling plus audit logging (`packages/db/src/repositories.ts:2241`, `packages/db/src/repositories.ts:2248`, `packages/db/src/repositories.ts:2257`, `packages/db/src/repositories.ts:2266`). Recommendation: Path A needs a fixture-backed mapper/importer Vitest that inserts once, replays exactly to zero inserts, treats the same external id under another mapped WTC provider account as distinct, and asserts no secret/raw provider dump leakage. Target part: future Legacy closed-trade importer.

4. Severity P1 - Existing provider-worker coverage proves scoped snapshots, not closed-trade import. Evidence: `legacy-provider-worker.test.ts` writes metric/position snapshots with `botProviderAccountId`, `sourceAdapter: 'legacy-db'`, and `providerAccountScoped: true` (`tests/integration/legacy-provider-worker.test.ts:162`, `tests/integration/legacy-provider-worker.test.ts:182`, `tests/integration/legacy-provider-worker.test.ts:186`, `tests/integration/legacy-provider-worker.test.ts:199`) and checks serialization avoids credential-shaped fields (`tests/integration/legacy-provider-worker.test.ts:205`). Recommendation: keep this test in both Path A and Path B focused gate sets, but do not count it as source proof or importer proof. Target part: worker snapshot/scoping tests.

5. Severity P2 - The canonical local bot/admin acceptance runner is useful only after code/UI changes and does not prove Legacy source readiness. Evidence: `scripts/gates.mjs` labels local bot/admin plans as "LOCAL MOCK/NO-LIVE ONLY" (`scripts/gates.mjs:65`), scrubs `LEGACY_DATABASE_URL` and `LEGACY_LIVE_READS_ENABLED` (`scripts/gates.mjs:96`, `scripts/gates.mjs:98`), forces mock/no-live env (`scripts/gates.mjs:120`, `scripts/gates.mjs:121`, `scripts/gates.mjs:123`), and defines `bot-admin-local` as `ci:local`, worker smoke, continuity fixture, rendered E2E, and visual inventory (`scripts/gates.mjs:174`). Recommendation: do not use `npm run accept:bots:local` as a source proof gate; use it only as rendered/local regression proof if Path B changes user/admin surfaces or Path A changes importer-visible UI. Target part: gate selection.

6. Severity P2 - Managed/live gates remain out of scope for this source-proof lane unless the operator opens a separate approved throwaway/metadata-only phase. Evidence: session protocol keeps discovery read-only and forbids live server/bot/secrets mutation (`docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:85`); `docs/NEXT_ACTIONS.md` says managed worker and admin-user DB gates require supplied throwaway-admin env and must not use production URLs (`docs/NEXT_ACTIONS.md:56`, `docs/NEXT_ACTIONS.md:59`). Recommendation: Path B should not run managed DB, live provider, exchange, SSH, deploy, or bot-control gates. Target part: safety gates.

## Decisions
- Chosen path for the next implementation slice is Path B: fail-closed source-proof/preflight artifacts.
- Minimal new Path B test target: `tests/integration/legacy-closed-trade-source-proof-static.test.ts`.
- Path B should keep existing Legacy UI/worker assertions green: `no_trade_history`, pending closed-trade import copy, no fabricated PF/win-rate/realized PnL, provider-mapping requirement, no live-control/read-secret wiring.
- Path A remains conditional on a real source-proof artifact. Once proven, Path A must add importer/mapper tests around `importBotTrade()` and then update UI from pending to loaded branches only from imported closed trades.
- `npm run accept:bots:local` is not a source-proof gate. It is a local mock/no-live rendered regression gate if UI/worker acceptance surfaces change.

## Risks
- A future importer could accidentally treat inactive orders/slots as history; the Path B static test should explicitly forbid this.
- A future source artifact could name a table/API without replay semantics or fee/funding sign policy; the preflight must fail closed in that case.
- Repository-level importer fixtures can prove WTC destination behavior but still cannot prove the Legacy provider source.
- This checkout is heavily dirty with many pre-existing modified/untracked files; gate results in the next phase should record branch and dirty state before edits.

## Verification/tests
RUN:
- Read-only inspection of the requested protocol, status, prior handoff, test, package, and gate files.
- Read-only focused line searches for current worker/UI/repository evidence.
- `git status --short --branch` to confirm the current checkout is dirty before this audit.

NOT RUN:
- Vitest/typecheck/lint/build/Playwright/browser proof - not run because this audit was requested as a read-only tests/gates handoff and no product/source/test/docs were changed except this handoff.
- `npm run accept:bots:local` - not run because it writes `logs/gates/*` and proves local mock/no-live rendered regression, not Legacy source proof.
- Managed DB gates, live Legacy DB/provider/exchange probes, SSH/tmux/systemd, deploy, production monitoring, and bot start/stop/apply-config - not run by scope and safety rules.

## Next actions
1. Implement Path B artifacts first:
   - Add a fail-closed source-proof/preflight artifact that remains "unproven" until it names the source table/API, mapped provider/account filter, stable trade/fill id, symbol, side, size, entry/exit prices, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw-payload allowlist.
   - Add `tests/integration/legacy-closed-trade-source-proof-static.test.ts` to enforce the above fields, fail-closed status, no inactive order/slot substitution, no Tortila/Turtle substitution, no live calls, no DB mutation, no `.env`/secret reads, and no live-control strings.
2. Minimal Path B commands after implementation:
   ```powershell
   npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts
   npm run typecheck
   npm run typecheck -w @wtc/web
   npm run typecheck -w @wtc/worker
   npm run secret:scan
   npm run governance:check
   git diff --check
   ```
3. Conditional Path A commands only after a source-proof artifact is accepted and importer code is implemented:
   ```powershell
   npx vitest run tests/integration/legacy-closed-trade-importer.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts
   npm run typecheck
   npm run typecheck -w @wtc/worker
   npm run typecheck -w @wtc/web
   npm run secret:scan
   npm run governance:check
   git diff --check
   npm run accept:bots:local
   ```
