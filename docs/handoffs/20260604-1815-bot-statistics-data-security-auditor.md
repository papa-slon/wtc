# bot-statistics-data-security-auditor handoff
## Scope
Phase 4.28 read-only bot statistics data-scope/security audit for the current checkout at `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Inspected bot statistics loaders/data files, user statistics pages, admin selected-user detail loader/page, admin bot pages, DB repositories/schema/migrations for bot snapshots/trades/positions/provider mappings, worker heartbeat/statistics boundaries, and existing tests. Focus was data scoping, user/admin separation, secret leakage, and worker heartbeat/statistics boundary risks for the next patch.

Observed repo state: branch `codex/bot-analytics-settings-canary-20260603`; worktree already heavily dirty with many modified/untracked bot/admin/worker/test files before this audit. This read-only lane did not run background agents and did not edit code.
## Files inspected
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/tick-once.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `package.json`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `docs/handoffs/20260604-1555-bot-stats-admin-security-auditor.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1628-bot-admin-selector-security-auditor.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
## Files changed
None — read-only audit
## Findings
1. P1 - User-facing bot statistics are currently scoped correctly, but this is a high-risk regression boundary for the next patch. Evidence: user statistics calls `loadBotReadModelForUser(user.id, bot.code, ...)` only after access checks at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:226-239`; the DB loader finds the signed-in user's bot instance at `apps/web/src/features/bots/data.tsx:437-443`, requires exactly one active Legacy `legacy-db` provider mapping at `apps/web/src/features/bots/data.tsx:455-485`, scopes metric/position/trade reads by `botInstanceId` plus `botProviderAccountId` at `apps/web/src/features/bots/data.tsx:487-496`, and fails closed in non-mock modes instead of global adapter fallback at `apps/web/src/features/bots/data.tsx:707-724`. Recommendation: any new statistics loaders/panels must keep this path and must not call `loadBotReadModel`, `getBotAdapter`, `fetch`, or live provider APIs from user pages. Target part: user bot statistics/dashboard/read model.
2. P1 - Admin selected-user statistics are mostly scoped by selected user and exact Legacy provider mapping, but future patches must not bypass the loader. Evidence: selected-user lookup starts from `users.id = userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:946-960`; entitlements, instances, exchange metadata, and provider rows are all filtered by that `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:966-1020`; metric/position/trade rows are fetched only for selected user's `instanceIds` at `apps/web/src/features/admin/user-bot-detail-loader.ts:1054-1127`; Legacy rows are filtered by `rowMatchesProviderScope` at `apps/web/src/features/admin/user-bot-detail-loader.ts:863-880` and `buildAdminBotStats` at `apps/web/src/features/admin/user-bot-detail-loader.ts:892-925`; ambiguous active mappings suppress stats at `apps/web/src/features/admin/user-bot-detail-loader.ts:1153-1165` and `apps/web/src/features/admin/user-bot-detail-loader.ts:1183-1204`. Existing tests hide cross-user markers at `tests/integration/admin-user-bot-detail-loader.test.ts:583-618` and ambiguous mappings at `tests/integration/admin-user-bot-detail-loader.test.ts:720-776`. Recommendation: keep `/admin/users/[userId]/bots` as read-only selected-user projection only; do not add direct DB reads in the page or client components. Target part: admin selected-user loader/page.
3. P1 - Global admin Legacy fleet statistics can under-report provider-scoped data because `loadAdminBotHealthFromDb` reads only one latest Legacy metric snapshot raw JSON. Evidence: admin bot health selects a single `legacySnap` by `productCode = 'legacy_bot'` ordered by `snapshotAt` at `apps/web/src/features/admin/bot-health-loader.ts:290-299`, then derives all `legacyProviderAccounts`, slots, and active orders from that one row's `rawJson.liveConfig` at `apps/web/src/features/admin/bot-health-loader.ts:308-360`. The worker now loops active Legacy provider mappings and writes one provider-scoped metric snapshot per mapping at `apps/worker/src/legacy-live.ts:536-561`, with aggregate health counts only at `apps/worker/src/legacy-live.ts:583-601`. Risk: if two or more provider mappings snapshot in one cycle, `/admin/bots` and the admin owner selector can show whichever provider row wins latest ordering and miss other mapped/unmapped pub_id rows. Recommendation: aggregate latest provider-scoped Legacy snapshots per active `bot_provider_accounts.id`, or query provider accounts plus latest scoped metric rows directly instead of deriving fleet identity from one raw metric row. Target part: `loadAdminBotHealthFromDb`, `/admin/bots`, `/admin/users` owner selector.
4. P1 - Selected-user runtime/worker readiness is still product/worker-global context, not selected-user statistic proof. Evidence: selected-user loader fetches runtime health by target only at `apps/web/src/features/admin/user-bot-detail-loader.ts:1025-1048`, assigns `runtimeHealthSummary(productCode, healthByProduct.get(productCode), now)` to every selected-user bot at `apps/web/src/features/admin/user-bot-detail-loader.ts:1201`, and assigns aggregate `target='worker'` continuity at `apps/web/src/features/admin/user-bot-detail-loader.ts:1230`. The page marks runtime and worker readiness independently at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:288-297`, while tests currently allow a selected user with no Legacy instance/provider stats to show Legacy runtime health `ok` from a global row at `tests/integration/admin-user-bot-detail-loader.test.ts:640-689`. Recommendation: rename/label these as fleet health and aggregate worker heartbeat unless tied to the selected `botInstanceId` or provider account; selected-user "ready" should require scoped statistic evidence, not just global health. Target part: admin selected-user evidence ladder and readiness mirror.
5. P1 - Legacy warning attribution can be over-broad because scoped health is inferred from counts, not a provider identity match. Evidence: user loader treats Legacy runtime health as scoped when `providerAccountMappingsSeen === 1` and `providerAccountMappingsSnapshotted === 1` at `apps/web/src/features/bots/data.tsx:329-330` and applies warnings before selected provider matching at `apps/web/src/features/bots/data.tsx:427-434`; admin selected-user warning summary uses the same count-only rule at `apps/web/src/features/admin/user-bot-detail-loader.ts:420-454`; worker aggregate `legacy-bot` health writes counts and warning codes but no safe `botProviderAccountId`/mapping identity at `apps/worker/src/legacy-live.ts:583-601`; health projection allowlists counts but no provider identity at `apps/web/src/features/admin/health-detail.ts:29-31`. Recommendation: carry a safe mapping id/provider-account id only when exactly one scoped provider is snapshotted, or suppress runtime warning attribution unless the latest scoped metric/position rows match the selected provider account. Target part: Legacy warning summary and worker health detail.
6. P2 - Trade import idempotency is not provider-account-aware. Evidence: `bot_trade_imports` now has nullable `botProviderAccountId` at `packages/db/src/schema.ts:566-570`, but the unique import key remains `(botInstanceId, externalTradeId, sourceAdapter)` at `packages/db/src/schema.ts:587-590`; `importBotTrade` uses `onConflictDoNothing()` with that key at `packages/db/src/repositories.ts:2241-2248`. Risk: provider rotation or duplicated external trade IDs across provider accounts for the same bot instance/source can suppress a valid new provider-scoped import, causing missing selected-user stats rather than a cross-user leak. Recommendation: either include `botProviderAccountId` in the idempotency key for provider-scoped imports or add a documented invariant plus regression test. Target part: DB migration/schema and `importBotTrade`.
7. P2 - Raw snapshot JSON is still a sensitive boundary even though current DTOs mostly sanitize it. Evidence: user loader selects metric `rawJson` to extract only `liveConfig` before `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:498-505` and `apps/web/src/features/bots/data.tsx:633-637`; admin fleet loader selects `rawJson` from one Legacy metric row at `apps/web/src/features/admin/bot-health-loader.ts:290-294`; admin health details are allowlisted and redacted at `apps/web/src/features/admin/health-detail.ts:87-102`; exchange secret rows are not joined and only `keyMask` is exposed at `apps/web/src/features/admin/user-bot-detail-loader.ts:996-1005`; global admin defaults reject secret/provider/raw/live-control keys at `apps/web/src/features/admin/actions.ts:431-468` and repository tests cover those cases at `tests/integration/admin-global-bot-config-db.test.ts:181-239`. Recommendation: next UI/data patch must render only DTO fields, never raw `rawJson`, `providerAccountId`, `exchangeApiKeySecrets`, `sealed`, `apiKey`, `apiSecret`, URLs, or raw health errors. Target part: all bot/admin statistics components and loaders.
8. P2 - Route-level admin separation is present, but loaders remain callable projection functions. Evidence: selected-user page gates with `requireUser()` and `assertAdmin()` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:394-399`; admin bot page gates at `apps/web/src/app/admin/bots/page.tsx:312-316`; admin bot config page gates at `apps/web/src/app/admin/bots/config/page.tsx:267-269`; `loadAdminUserBotDetail(userId)` itself just loads from DB at `apps/web/src/features/admin/queries.ts:172-178`. Recommendation: every new consumer of selected-user/admin bot loaders must live behind admin route/action gates; do not expose loader output through user routes or public API handlers. Target part: future routes/server components/API handlers.
9. P2 - Existing coverage is useful but not sufficient for Phase 4.28 completion. Evidence: selected-user DB loader tests cover cross-user/secret markers and ambiguous mappings at `tests/integration/admin-user-bot-detail-loader.test.ts:583-618` and `tests/integration/admin-user-bot-detail-loader.test.ts:720-776`; admin health loader tests cover one Legacy raw snapshot with mapped/unmapped provider rows at `tests/integration/admin-bot-health-loader.test.ts:70-210`; worker continuity runner and selected-user DB matrix scripts exist at `package.json:23-37`, but Phase 4.27 recorded the DB browser matrix and managed worker gates as not run due missing admin DB URLs at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:83-90`. Recommendation: add behavioral multi-provider fleet, warning-attribution, runtime/worker scope, and trade-id collision tests before claiming Phase 4.28 green. Target part: integration/e2e acceptance gates.
## Decisions
- Treat user-facing bot statistics as DB/user-scope only in non-mock modes. Adapter/global reads are acceptable only for explicit mock/demo/internal previews.
- Treat selected-user admin statistics as persisted selected-user evidence, not live bot truth.
- Treat `integration_health_checks.target='legacy-bot'`, `target='tortila-journal'`, and `target='worker'` as fleet/aggregate context unless the row is explicitly tied to the selected `botInstanceId` or provider account.
- Keep admin global defaults separate from user settings and runtime state; `/admin/bots/config` is a system-default mutation surface, not a statistics or live-control surface.
- No live server mutation, live bot start/stop/apply-config, exchange ping, provider probe, deploy, SSH, or production monitoring belongs in the next statistics patch.
## Risks
- Current worktree is heavily dirty and includes many pre-existing modified/untracked files; this audit only describes the current tree and does not certify unrelated changes.
- The global admin Legacy fleet view likely needs loader refactor before it can be considered complete for multiple provider-account snapshots.
- Selected-user runtime/worker green states can still be misread as selected-user data freshness unless UI/DTO wording and readiness gating are tightened.
- Legacy health warning attribution lacks a provider identity check and should stay conservative until worker health details carry safe scope identity.
- DB trade import idempotency can cause missing provider-scoped trade rows after provider account rotation or external ID collision.
- No gates were executed in this read-only audit, so all acceptance commands below are proposed/not-run, not observed green.
## Verification/tests
RUN:
- Read-only inspection only with `git status`, `rg`, `Get-Content`, and targeted file reads. No npm, Vitest, Playwright, worker, DB, build, lint, or secret-scan gates were run.

Exact acceptance tests for the next patch:
- Add/extend `tests/integration/admin-bot-health-loader.test.ts`: seed two active `legacy-db` provider mappings with two provider-scoped Legacy metric snapshots from the same worker cycle; assert `loadAdminBotHealthFromDb` returns both masked pub_id rows, both mapped users, both slot/order sets as applicable, no raw pub IDs, no hidden-user leak, and no `rawJson`/secret markers. Then run `npx vitest run tests/integration/admin-bot-health-loader.test.ts`.
- Add/extend `tests/integration/admin-user-bot-detail-loader.test.ts`: seed global `legacy-bot` health with `providerAccountMappingsSeen=1`, warnings, and a selected user whose active provider mapping is not the snapshotted mapping; assert warning scope is `runtime_not_scoped`, runtime warnings are not attributed, and no other provider markers leak. Then run `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts`.
- Add/extend `tests/integration/admin-user-bot-detail-loader.test.ts` or `tests/integration/admin-user-bot-detail-static.test.ts`: assert product/global runtime health and aggregate worker heartbeat cannot make selected-user readiness `ready` when `latestMetric`, positions, trades, and equity are all absent. Then run `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts`.
- Add/extend DB/import coverage, preferably `tests/integration/legacy-provider-worker.test.ts` or a focused DB test: insert/import same `externalTradeId` for same bot instance/source but different `botProviderAccountId`; assert the intended provider-scoped behavior is explicit, either both insert or the second is intentionally rejected with documented scope. Then run `npx vitest run tests/integration/legacy-provider-worker.test.ts`.
- Re-run existing boundary suites after patch: `npx vitest run tests/integration/bot-statistics-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`.
- Run build/static gates: `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker`, `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`.
- With an operator-approved local/admin Postgres URL, run `WORKER_CONTINUITY_ADMIN_DATABASE_URL=<admin-postgres-url> npm run accept:worker:continuity:managed` and record the created/dropped DB name plus `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.
- With an operator-approved local/admin Postgres URL, run `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<admin-postgres-url> npm run e2e:admin-user-bots:db:managed:matrix`, review retained screenshots, and run `npm run evidence:visual -- --inventory tests/e2e/screenshots`.
- Final local completion gate after focused fixes: `npm run ci:local`.

NOT RUN gates:
- `npx vitest run ...` - NOT RUN; read-only audit scope only.
- `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker` - NOT RUN; read-only audit scope only.
- `npm run lint` - NOT RUN; read-only audit scope only.
- `npm run secret:scan` - NOT RUN; read-only audit scope only.
- `npm run build`, `npm run build -w @wtc/web` - NOT RUN; read-only audit scope only.
- `npm run ci:local` - NOT RUN; read-only audit scope only.
- `npm run accept:worker:continuity` - NOT RUN; requires configured DB/worker environment and is outside this read-only audit.
- `npm run accept:worker:continuity:managed` - NOT RUN; requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and browser artifact review.
- `npm run e2e`, full Playwright, production build/deploy, SSH/tmux/systemd, live bot controls, live exchange pings, provider reachability probes, raw env dumps, raw secret reads, Stripe/Axioma/LMS live gates - NOT RUN and not appropriate for this read-only audit.
## Next actions
1. Patch `loadAdminBotHealthFromDb` so Legacy fleet diagnostics aggregate latest provider-scoped snapshots instead of using one latest raw metric row.
2. Tighten selected-user runtime/worker labels and readiness so global health is context and only scoped rows can make selected-user statistics ready.
3. Add provider identity matching or suppress runtime warning attribution for Legacy health until safe scope identity exists.
4. Decide and encode provider-aware trade import idempotency, then add a regression around same external trade ID across provider accounts.
5. Run the focused tests and exact gates listed above; do not claim green for any gate not observed in the patch session.
