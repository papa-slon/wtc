# ecosystem-bot-integration-auditor handoff
## Scope
Phase 4.41 read-only bot-integration audit to identify the next useful local hardening step after:
- Phase 4.39: Legacy closed-trade source remained blocked.
- Phase 4.40: local bot/admin acceptance runner became green under scrubbed mock/no-live env.

Constraints honored: no product-code edits, no long gates, no provider probes, no exchange calls, no live bot control, no
`LEGACY_DATABASE_URL`, no `TORTILA_JOURNAL_URL`, and no DB mutation. This handoff is the only file written.

Repo baseline observed before writing: branch `codex/bot-analytics-settings-canary-20260603`; worktree already heavily
dirty with many modified/untracked bot/admin/runtime files and prior handoffs. This audit did not reconcile, revert, stage,
or commit any of that state.

## Files inspected
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/warnings.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`

## Files changed
None - read-only audit except this handoff: `docs/handoffs/20260605-0015-bot-integration-next-gap-auditor.md`.

## Findings
1. Severity P1 - The next useful local integration hardening step should be a no-env, no-DB-mutation
   two-bot continuity contract fixture/gate, not another managed proof run. Evidence: current next actions say managed worker
   continuity requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and creates/drops throwaway Postgres DBs
   (`docs/NEXT_ACTIONS.md:29`, `docs/NEXT_ACTIONS.md:30`, `docs/NEXT_ACTIONS.md:31`, `docs/NEXT_ACTIONS.md:32`,
   `docs/NEXT_ACTIONS.md:33`); the managed runner says it creates fixture-only Legacy rows and proves full continuity without
   touching live bots, but still requires an admin DB URL (`scripts/run-worker-continuity-managed.mjs:23`,
   `scripts/run-worker-continuity-managed.mjs:25`, `scripts/run-worker-continuity-managed.mjs:26`,
   `scripts/run-worker-continuity-managed.mjs:28`); the actual two-bot worker status reducer is already pure and exported
   (`apps/worker/src/index.ts:98`, `apps/worker/src/index.ts:105`, `apps/worker/src/index.ts:110`,
   `apps/worker/src/index.ts:112`) with direct unit coverage (`tests/integration/worker-health-mapping.test.ts:73`,
   `tests/integration/worker-health-mapping.test.ts:79`, `tests/integration/worker-health-mapping.test.ts:84`,
   `tests/integration/worker-health-mapping.test.ts:94`). Recommendation: create a Phase 4.42 fixture/static acceptance
   lane such as `tests/integration/two-bot-continuity-contract-static.test.ts` plus optional `npm run
   accept:worker:continuity:fixture`, importing only pure helpers/source text and asserting full, setup-needed, and error
   tuples without DATABASE_URL or provider URLs. Target part: worker continuity acceptance.

2. Severity P1 - Legacy operational continuity can be locally represented, but closed-trade performance must stay pending
   until a real source exists. Evidence: Phase 4.39 status says WTC destination/repository is ready if a source is found, but
   no durable Legacy closed-trade/fill source was proven (`docs/STATUS.md:17`, `docs/STATUS.md:18`,
   `docs/STATUS.md:19`, `docs/STATUS.md:20`, `docs/STATUS.md:21`, `docs/STATUS.md:22`); current not-green list says Legacy
   win rate, PF, realized PnL, and attribution remain pending (`docs/STATUS.md:40`, `docs/STATUS.md:43`,
   `docs/STATUS.md:44`, `docs/STATUS.md:45`, `docs/STATUS.md:46`); the worker Legacy snapshot writes wallet/runtime config
   evidence but deliberately leaves `closedPnlUsd`, `winRate`, `profitFactor`, fees, funding, and trade count unavailable
   (`apps/worker/src/legacy-live.ts:416`, `apps/worker/src/legacy-live.ts:421`, `apps/worker/src/legacy-live.ts:422`,
   `apps/worker/src/legacy-live.ts:424`, `apps/worker/src/legacy-live.ts:425`, `apps/worker/src/legacy-live.ts:428`,
   `apps/worker/src/legacy-live.ts:429`, `apps/worker/src/legacy-live.ts:431`). Recommendation: the fixture gate should
   explicitly prove that a Legacy runtime snapshot/readState can be `ok` while closed-trade analytics remain unavailable and
   UI/status copy says pending import, never zero or loaded. Target part: Legacy runtime-vs-performance truth.

3. Severity P1 - Direct Legacy HTTP remains correctly hard-blocked; the next step must not re-open it. Evidence: the adapter
   factory ignores `legacyBaseUrl` in real modes and returns the blocked adapter (`packages/bot-adapters/src/factory.ts:26`,
   `packages/bot-adapters/src/factory.ts:32`, `packages/bot-adapters/src/factory.ts:35`,
   `packages/bot-adapters/src/factory.ts:36`, `packages/bot-adapters/src/factory.ts:39`); the blocked adapter reports a
   deterministic no-network health state and still surfaces warnings (`packages/bot-adapters/src/legacy/legacy-blocked.ts:54`,
   `packages/bot-adapters/src/legacy/legacy-blocked.ts:55`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:59`,
   `packages/bot-adapters/src/legacy/legacy-blocked.ts:64`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:68`);
   the Legacy DB worker path uses safe selected columns and rejects accidental secret fields
   (`apps/worker/src/legacy-live.ts:143`, `apps/worker/src/legacy-live.ts:146`, `apps/worker/src/legacy-live.ts:147`,
   `apps/worker/src/legacy-live.ts:333`, `apps/worker/src/legacy-live.ts:335`, `apps/worker/src/legacy-live.ts:347`).
   Recommendation: fixture/static acceptance should assert no `createHttpLegacyAdapter` export/path, no selected
   `api_key`/`secret_key`, and no live-control symbols in bot/admin continuity proof. Target part: Legacy adapter safety.

4. Severity P2 - Tortila read-only adapter/import boundaries are appropriate for local fixture hardening and must remain
   journal-only, token-gated, and exchange-free. Evidence: Tortila HTTP adapter documents implemented read endpoints and says
   it never calls `/api/marks` or control (`packages/bot-adapters/src/http.ts:76`, `packages/bot-adapters/src/http.ts:79`,
   `packages/bot-adapters/src/http.ts:80`, `packages/bot-adapters/src/http.ts:81`,
   `packages/bot-adapters/src/http.ts:82`, `packages/bot-adapters/src/http.ts:83`,
   `packages/bot-adapters/src/http.ts:85`, `packages/bot-adapters/src/http.ts:88`); absent journal token fails closed before
   authenticated reads (`packages/bot-adapters/src/http.ts:93`, `packages/bot-adapters/src/http.ts:95`); worker import
   filters closed trades and writes them through `importBotTrade` idempotently (`apps/worker/src/jobs.ts:233`,
   `apps/worker/src/jobs.ts:236`, `apps/worker/src/jobs.ts:249`, `apps/worker/src/jobs.ts:256`). Recommendation: include
   Tortila fixture assertions around read-only import semantics and the no-`/api/marks`/no-live-control boundary, but do not
   require `TORTILA_JOURNAL_URL`. Target part: Tortila read-only import contract.

5. Severity P2 - Warning truth is centralized enough to be locked in the same local fixture gate; a green continuity tuple
   must not imply safety all-clear. Evidence: warning registry says Tortila P0/P1 warnings persist across adapter modes
   (`packages/bot-adapters/src/warnings.ts:6`, `packages/bot-adapters/src/warnings.ts:7`,
   `packages/bot-adapters/src/warnings.ts:33`, `packages/bot-adapters/src/warnings.ts:36`,
   `packages/bot-adapters/src/warnings.ts:42`); Legacy warnings include credential-boundary and no-trade-history truth
   (`packages/bot-adapters/src/warnings.ts:59`, `packages/bot-adapters/src/warnings.ts:62`,
   `packages/bot-adapters/src/warnings.ts:65`, `packages/bot-adapters/src/warnings.ts:67`); warning normalization filters
   to canonical runtime codes (`packages/bot-adapters/src/warnings.ts:148`, `packages/bot-adapters/src/warnings.ts:154`,
   `packages/bot-adapters/src/warnings.ts:157`, `packages/bot-adapters/src/warnings.ts:159`,
   `packages/bot-adapters/src/warnings.ts:163`). Recommendation: fixture gate should assert Tortila persistent warnings and
   Legacy `no_trade_history` survive ok reads and that secret-shaped warning strings are dropped. Target part: warning
   normalization/runtime truth.

6. Severity P2 - Statistics surfaces already show the correct product distinction, but they are not yet tied to a cheap
   no-env two-bot continuity proof. Evidence: user data reads hide Legacy runtime facts until exactly one active provider
   mapping exists (`apps/web/src/features/bots/data.tsx:450`, `apps/web/src/features/bots/data.tsx:468`,
   `apps/web/src/features/bots/data.tsx:473`, `apps/web/src/features/bots/data.tsx:475`,
   `apps/web/src/features/bots/data.tsx:476`); scoped DB reads select provider-scoped trades when available
   (`apps/web/src/features/bots/data.tsx:489`, `apps/web/src/features/bots/data.tsx:517`,
   `apps/web/src/features/bots/data.tsx:523`, `apps/web/src/features/bots/data.tsx:525`); the Legacy statistics panel shows
   operational coverage separately from pending closed-trade history (`apps/web/src/features/bots/statistics-panels.tsx:569`,
   `apps/web/src/features/bots/statistics-panels.tsx:582`, `apps/web/src/features/bots/statistics-panels.tsx:587`,
   `apps/web/src/features/bots/statistics-panels.tsx:588`, `apps/web/src/features/bots/statistics-panels.tsx:605`,
   `apps/web/src/features/bots/statistics-panels.tsx:608`, `apps/web/src/features/bots/statistics-panels.tsx:609`).
   Recommendation: the fixture/static lane should scan or import these builders enough to prove two-bot continuity wording
   remains separate from Legacy performance availability. Target part: bot statistics truth.

## Decisions
- Recommended next step: Phase 4.42 "two-bot continuity contract fixture" - a cheap, local, no-provider, no-DB-mutation
  fixture/static acceptance lane.
- Do not run `npm run accept:worker:continuity:managed` until `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is intentionally
  supplied in a separate managed proof phase.
- Do not start Legacy importer work until source proof names the real source table/API and required fields.
- Do not re-enable direct Legacy HTTP, provider probes, `/api/marks`, exchange calls, or live start/stop/apply-config.
- No background agents were spawned by this single auditor lane; nothing needed cleanup.

## Risks
- A fixture/static gate will not replace the managed DB tuple proof; it only prevents local contract drift while managed env is
  unavailable.
- The current worktree is heavily dirty and may contain uncommitted work from earlier phases; this audit did not determine
  publication readiness.
- Warning/continuity semantics can be misread by operators unless the fixture explicitly states that `botContinuityStatus=ok`
  is not live-control permission and not Legacy closed-trade proof.
- Some contract docs still mention future/live checks; the next implementation should keep local fixture scope explicit to
  avoid accidentally turning source/env blockers into "green" claims.

## Verification/tests
RUN:
- `git branch --show-current`
- `git status --short`
- `rg --files docs packages apps/worker apps/web/src/features/bots apps/web/src/features/admin tests/integration scripts`
  filtered for contracts, adapters, worker, continuity, warning, statistics, and status files.
- Targeted `rg -n` and line-numbered `Get-Content` reads over the inspected files above.

NOT RUN:
- Long gates, root tests, Playwright, build, lint, typecheck, secret scan, governance.
- `npm run accept:worker:continuity:managed` - not run; requires admin DB env and creates/drops throwaway DBs.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires managed admin DB env.
- Legacy/Tortila provider probes, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, exchange calls, DB mutation, migrations,
  live bot start/stop/apply-config, deploy/CI.

## Next actions
1. Implement Phase 4.42 as a local fixture/static acceptance lane:
   - Add a focused test such as `tests/integration/two-bot-continuity-contract-static.test.ts`.
   - Optionally add `npm run accept:worker:continuity:fixture` if an explicit command is useful.
   - Import/use only pure helpers and source-text assertions: `finalWorkerHealthStatus`, `botContinuityStatus`,
     `healthCheckStatusFor`, warning normalization helpers, and static checks over Legacy/Tortila adapter/worker/statistics
     files.
   - Assert these fixture tuples: both bots `snapshot=ok/readState=ok` -> worker `ok` and `bot_continuity=ok`;
     setup-needed Legacy -> worker `not_configured` and `bot_continuity=attention`; malformed/unreachable -> worker/error;
     Tortila ok still carries persistent P0/P1 warnings; Legacy ok still carries `no_trade_history`.
   - Assert no fake Legacy closed-trade import: Legacy runtime snapshot may prove wallet/config/positions, but PF/win
     rate/realized PnL/fees/funding remain pending unless `bot_trade_imports` exists from a real Legacy source.
2. Keep managed worker continuity and selected-user DB matrix as separate env-gated proof phases.
3. Keep Legacy closed-trade source discovery/import as a separate source-proof phase.
4. Keep provider probes, exchange calls, and live bot controls disabled until explicit bot-integration plus security approval.
