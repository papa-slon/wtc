# legacy-provider-scope-tests-auditor handoff
## Scope
Phase 4.29 read-only tests/acceptance audit for implementing Legacy/provider data-scope hardening after Phase 4.28 in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Goal: identify the smallest strong test set that proves:
- multi-provider Legacy fleet aggregation;
- Legacy warning attribution scope;
- selected-user readiness cannot be green without scoped selected-user rows;
- provider-aware closed-trade import idempotency.

Observed repo state before this handoff: branch `codex/bot-analytics-settings-canary-20260603`; worktree already heavily dirty with many modified and untracked WTC files. This lane made no code changes and wrote only this handoff. No background agents were spawned by this auditor lane.

## Files inspected
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `package.json`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`

## Files changed
None - read-only audit; wrote this handoff only as required.

## Findings
1. Severity P1 - The smallest required fleet test is one new behavioral test in `tests/integration/admin-bot-health-loader.test.ts` for two active Legacy provider mappings with two latest provider-scoped metric snapshots. Evidence: Phase 4.28 explicitly left "global admin Legacy fleet multi-provider aggregation" open at `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:64` and routes Phase 4.29 to multi-provider fleet aggregation at `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:89`; the security auditor says `loadAdminBotHealthFromDb` currently reads one latest Legacy metric snapshot and derives fleet rows from that one raw JSON row at `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md:62`; existing coverage has only one inserted Legacy metric snapshot with multiple raw `providerAccounts` inside that single row at `tests/integration/admin-bot-health-loader.test.ts:103-159`. Recommendation: add a fixture with provider A and provider B mapped to different users/instances, insert one scoped `botMetricSnapshots` row per `botProviderAccountId`, then assert both masked pub_id rows, mapped users, active slots/orders, and sanitized output are returned. Target part: `loadAdminBotHealthFromDb` and admin fleet/owner selector DTO.

2. Severity P1 - The smallest required warning-attribution test is one new selected-user loader test where global `legacy-bot` health appears "single scoped" by counts but does not identity-match the selected user's provider account. Evidence: the security auditor identifies count-only warning attribution at `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md:64`; the current loader helper treats `providerAccountMappingsSeen === 1 && providerAccountMappingsSnapshotted === 1` as sufficient at `apps/web/src/features/admin/user-bot-detail-loader.ts:420-425` and includes Legacy runtime warnings when that count condition and any selected provider account are present at `apps/web/src/features/admin/user-bot-detail-loader.ts:449-454`; existing tests cover count-scoped positive attribution at `tests/integration/admin-user-bot-detail-loader.test.ts:415-424` and ambiguous two-mapping suppression at `tests/integration/admin-user-bot-detail-loader.test.ts:755-772`, but not a one-count identity mismatch. Recommendation: after implementation adds safe provider identity to health detail or suppresses ambiguous health, seed selected user provider A, health detail for provider B or no matching safe identity, and assert `warningSummary.scope === 'runtime_not_scoped'`, runtime warning codes are absent, and provider B markers do not leak. Target part: Legacy selected-user warning summary.

3. Severity P1 - The smallest required readiness test is one selected-user fixture with aggregate runtime and worker green but no scoped metric/position/trade/equity rows for the selected Legacy provider. Evidence: Phase 4.28 marks selected-user readiness wording/gating as Phase 4.29 scope at `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:89`; the security auditor warns selected-user runtime/worker readiness is global context unless tied to the selected instance/provider at `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md:63`; current page helpers correctly require row evidence for statistics (`hasScopedStatisticsEvidence`) at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:113-140` and keep the statistics readiness item in attention without scoped rows at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:358-362`, but existing loader tests only prove stale/missing health and ambiguous mappings at `tests/integration/admin-user-bot-detail-loader.test.ts:640-717` and `tests/integration/admin-user-bot-detail-loader.test.ts:719-776`. Recommendation: add a loader-plus-static assertion: seed active Legacy mapping plus `legacy-bot` and `worker` health both green, insert no selected-provider scoped stats rows, then assert `latestMetric === null`, `positions/trades/equityCurve` are empty, `overviewStatsLabel`/static guard still contains `no user-scoped snapshot`, and the statistics readiness helper cannot return `ready` unless `hasScopedStatisticsEvidence(bot)` is true. Target part: selected-user admin readiness mirror and evidence ladder.

4. Severity P1 - The smallest required trade-idempotency test is one provider-collision import test in `tests/integration/legacy-provider-worker.test.ts` or a focused DB import test. Evidence: the security auditor identifies provider-unaware idempotency at `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md:65`; schema has nullable `botProviderAccountId` on `bot_trade_imports` at `packages/db/src/schema.ts:570` but the unique key is still `(botInstanceId, externalTradeId, sourceAdapter)` at `packages/db/src/schema.ts:588`; `importBotTrade` documents and implements `ON CONFLICT (botInstanceId, externalTradeId, sourceAdapter) DO NOTHING` at `packages/db/src/repositories.ts:2239-2248`; current Legacy provider worker tests cover metric/position snapshot scoping only, not trades, at `tests/integration/legacy-provider-worker.test.ts:156-206`. Recommendation: create one bot instance with two historical/active provider account rows as needed by the chosen invariant, import the same `externalTradeId` and `sourceAdapter` for provider A and provider B, then assert the intended provider-aware behavior explicitly. Preferred acceptance: both inserts succeed when `botProviderAccountId` differs, and exact duplicate for the same provider remains idempotent. Target part: DB migration/schema and `importBotTrade`.

5. Severity P2 - Existing opt-in acceptance scripts are useful follow-up gates, not the minimum local proof. Evidence: `package.json` exposes focused Vitest, worker continuity, admin-user DB e2e, visual evidence, and `ci:local` scripts at `package.json:14-49`; worker continuity runner tests only verify script wiring, redaction, and opt-in behavior at `tests/integration/worker-continuity-acceptance-runner.test.ts:35-126`; the admin-user Playwright matrix covers `degraded-readable`, `fresh-green`, `stale`, and `missing` runtime scenarios at `tests/e2e/admin-user-bot-detail-db.spec.ts:14-104`, but all rendered scenarios still assume selected-user Legacy scoped evidence markers such as `USER_A_LEGACY_SCOPED_SOURCE` at `tests/e2e/admin-user-bot-detail-db.spec.ts:123-132`. Recommendation: require the focused Vitest set first; run managed worker/e2e matrix only when authorized DB URLs are provided or when the implementation touches the managed runners/rendered UX. Target part: acceptance gate selection.

## Decisions
- Minimum strong local test set is four new/extended Vitest cases across three files: `admin-bot-health-loader.test.ts`, `admin-user-bot-detail-loader.test.ts`, `admin-user-bot-detail-static.test.ts`, and `legacy-provider-worker.test.ts`.
- Keep Playwright `admin-user-bot-detail-db.spec.ts` and managed worker continuity as opt-in confidence gates, not the minimum for the data-scope hardening patch, unless the patch changes rendered labels, readiness panel output, or runner fixtures.
- Do not add live provider probes, worker ticks, exchange pings, deploy checks, SSH, or raw env reads to prove this scope.
- Treat global `integration_health_checks.target='legacy-bot'` and `target='worker'` as fleet/aggregate context unless a safe provider/instance identity match exists and selected-user scoped rows are present.

## Risks
- The worktree is heavily dirty; this audit describes the current tree and does not certify unrelated modified/untracked files.
- The exact DB migration shape for provider-aware `bot_trade_imports` is not chosen here. If nullable `botProviderAccountId` participates in uniqueness, Postgres NULL behavior must be handled deliberately for non-provider imports.
- If warning health detail gains a safe provider identity field, tests must verify the identity is not raw `pub_id` or secret-bearing data.
- If Phase 4.29 changes page helper visibility without exporting helpers, rendered Playwright or a small pure helper extraction may be needed to behaviorally prove readiness rather than only static string coverage.
- No gates were executed, so no test is claimed green in this handoff.

## Verification/tests
RUN:
- Read-only inventory only: `git status --short`, `git branch --show-current`, `Get-ChildItem`, `Get-Content`, `Select-String`, `rg`, and `Get-Date`.
- No Vitest, Playwright, typecheck, lint, build, secret scan, worker, DB mutation, live provider, SSH, tmux, systemd, or deploy gates were run.

Exact tests to add:
- `tests/integration/admin-bot-health-loader.test.ts`: add `aggregates multiple provider-scoped Legacy snapshots instead of choosing one latest raw snapshot`. Seed two active `legacy-db` provider mappings and two scoped metric snapshots; assert both masked provider rows and both mapped users/slot/order groups are present, raw pub_ids/secrets/hidden users are absent, and table counts are unchanged.
- `tests/integration/admin-user-bot-detail-loader.test.ts`: add `does not attribute Legacy runtime warnings when health provider identity does not match selected provider`. Seed selected provider A and health/warnings for provider B or identity-less one-count health; assert `runtime_not_scoped`, registry-only Legacy warnings, and no provider B marker leak.
- `tests/integration/admin-user-bot-detail-loader.test.ts` plus `tests/integration/admin-user-bot-detail-static.test.ts`: add `keeps selected-user statistics/readiness pending when runtime and worker are green but scoped rows are absent`. Loader fixture should assert no metric/position/trade/equity rows; static/page guard should assert `adminStatisticsReadinessStatus` remains tied to `hasScopedStatisticsEvidence` and cannot return `ready` from runtime/worker green alone.
- `tests/integration/legacy-provider-worker.test.ts` or a focused DB import test: add `imports same external trade id for different Legacy provider accounts according to provider-aware idempotency`. Preferred expected result: provider A insert true, provider B insert true when `botProviderAccountId` differs, exact same-provider duplicate insert false; assert query rows are scoped to both provider IDs and no raw secret markers leak.

Exact focused tests to run after implementation:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/legacy-provider-worker.test.ts`

Recommended adjacent existing tests if touched files broaden:
- If worker continuity scripts or safe worker tuple semantics change: `npx vitest run tests/integration/worker-continuity-acceptance-runner.test.ts`
- If rendered readiness labels, screenshot matrix fixtures, or admin-user page copy change and an operator-approved admin DB URL exists: `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<admin-postgres-url> npm run e2e:admin-user-bots:db:managed:matrix`
- If managed worker setup or aggregate health acceptance changes and an operator-approved admin DB URL exists: `WORKER_CONTINUITY_ADMIN_DATABASE_URL=<admin-postgres-url> npm run accept:worker:continuity:managed`

NOT RUN gates:
- `npx vitest run ...` - not run; read-only audit scope only.
- `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker` - not run.
- `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, `npm run ci:local` - not run.
- `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed` - not run; DB/runtime acceptance is outside this read-only audit and managed mode requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix`, full Playwright, visual evidence review - not run; DB/browser artifact review is outside this read-only audit and managed mode requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
- Live bot start/stop/apply-config, exchange/provider reachability probes, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and not appropriate for this phase.

## Next actions
1. Implement the four focused tests above before or alongside the data-scope hardening code.
2. Patch `loadAdminBotHealthFromDb` to aggregate latest Legacy provider-scoped snapshots per active provider mapping, then satisfy the new admin fleet aggregation test.
3. Add safe provider identity matching or conservative suppression for Legacy runtime warning attribution, then satisfy the warning mismatch test.
4. Tighten selected-user readiness proof so scoped rows, not aggregate green health alone, make statistics ready.
5. Decide the provider-aware trade idempotency invariant and encode it in schema/repository plus the collision regression test.
