# legacy-provider-scope-data-auditor handoff
## Scope
Phase 4.29 read-only Legacy/provider data-scope audit after Phase 4.28 in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Focus:
- multi-provider Legacy fleet aggregation;
- provider-identity-safe warning attribution;
- selected-user scoped statistics readiness;
- provider-aware trade import idempotency.

Observed repo state before this handoff: branch `codex/bot-analytics-settings-canary-20260603`; worktree already heavily dirty with many modified/untracked bot/admin/worker/test files. This auditor did not run background agents, did not run heavy gates, and did not edit code.

## Files inspected
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
None - read-only audit. Handoff written at `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`.

## Findings
1. P1 - Global admin Legacy fleet aggregation is not ready for multiple provider-scoped snapshots. Evidence: Phase 4.28 explicitly deferred this as Phase 4.29 data-scope work at `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:50` and `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:89`. Current `loadAdminBotHealthFromDb` selects one latest Legacy metric row at `apps/web/src/features/admin/bot-health-loader.ts:290-299`, then derives all Legacy provider accounts, active slots, and active orders from that one row's `rawJson.liveConfig` at `apps/web/src/features/admin/bot-health-loader.ts:308-360`. The worker already loops every active Legacy provider mapping and writes provider-scoped snapshots at `apps/worker/src/legacy-live.ts:536-561`, while metric/position schema has `botProviderAccountId` and provider snapshot indexes at `packages/db/src/schema.ts:513-532` and `packages/db/src/schema.ts:542-560`. Recommendation: refactor `loadAdminBotHealthFromDb` to query active `bot_provider_accounts` plus each account's latest scoped Legacy metric row, then merge safe `liveConfig` DTO rows across providers; do not use one global latest raw metric as the fleet source. Target part: `apps/web/src/features/admin/bot-health-loader.ts`, `/admin/bots`, `/admin/users` owner selector, `tests/integration/admin-bot-health-loader.test.ts`.

2. P1 - Legacy runtime warning attribution is still count-scoped, not provider-identity-scoped. Evidence: user statistics treats Legacy runtime warnings as provider-scoped when health detail has `providerAccountMappingsSeen === 1` and `providerAccountMappingsSnapshotted === 1` at `apps/web/src/features/bots/data.tsx:329-330`, then applies `provider_account_health` based on that count at `apps/web/src/features/bots/data.tsx:427-434`. Admin selected-user warnings use the same count-only helper at `apps/web/src/features/admin/user-bot-detail-loader.ts:420-454`. Worker aggregate health records mapping counts and `warningCodes`, but no successful scoped provider mapping id, at `apps/worker/src/legacy-live.ts:583-601`; health detail allowlists counts and warnings but no provider identity at `apps/web/src/features/admin/health-detail.ts:29-31` and `apps/web/src/features/admin/health-detail.ts:51`. Recommendation: carry an internal safe scope identity, such as `botProviderAccountId`, only when exactly one provider account was successfully snapshotted, allowlist that internal id, and attribute runtime warnings only if it equals the selected active mapping id; otherwise keep `runtime_not_scoped`. Target part: `apps/worker/src/legacy-live.ts`, `apps/web/src/features/admin/health-detail.ts`, `apps/web/src/features/bots/data.tsx`, `apps/web/src/features/admin/user-bot-detail-loader.ts`, `tests/integration/admin-user-bot-detail-loader.test.ts`, `tests/integration/bot-read-safety-static.test.ts`.

3. P1 - Selected-user row scoping is mostly ready, but readiness semantics need a stricter selected-user statistic gate. Evidence: selected-user loader starts from the requested `users.id` and filters entitlements, instances, exchange metadata, and provider rows by `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:946-1020`; metric/position/trade rows are loaded only for selected-user `instanceIds` at `apps/web/src/features/admin/user-bot-detail-loader.ts:1054-1127`; Legacy row filtering requires the active provider account id at `apps/web/src/features/admin/user-bot-detail-loader.ts:863-880` and `apps/web/src/features/admin/user-bot-detail-loader.ts:892-925`. However runtime health is fetched only by product target at `apps/web/src/features/admin/user-bot-detail-loader.ts:1025-1048`, then assigned to each selected-user bot at `apps/web/src/features/admin/user-bot-detail-loader.ts:1201`, and aggregate worker continuity is assigned at `apps/web/src/features/admin/user-bot-detail-loader.ts:1230`. UI readiness marks runtime and worker rows ready from those aggregate states at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:346-355`; statistics readiness is better because it requires scoped evidence before `ready` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:358-362`. Recommendation: keep global runtime/worker as context labels only, add an explicit DTO flag like `selectedUserStatisticsReady` or `scopedStatisticsEvidencePresent`, and add tests proving product/worker health cannot make selected-user statistics ready when latest metric, positions, trades, and equity are absent. Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx`, `tests/integration/admin-user-bot-detail-loader.test.ts`, `tests/integration/admin-user-bot-detail-static.test.ts`, `tests/e2e/admin-user-bot-detail-db.spec.ts`.

4. P2 - Provider-aware trade import idempotency is not encoded. Evidence: `bot_trade_imports` has nullable `botProviderAccountId` at `packages/db/src/schema.ts:569-570`, but the unique import key is still only `(botInstanceId, externalTradeId, sourceAdapter)` at `packages/db/src/schema.ts:587-590`; `importBotTrade` documents and relies on that same conflict shape at `packages/db/src/repositories.ts:2239-2247`. Current DB coverage only proves exact duplicate imports return `inserted:false` for one unscoped trade at `tests/integration/db-0002.test.ts:118-125`; there is no provider-collision test for the same external trade id across two provider accounts. Recommendation: choose and encode the invariant before Legacy closed-trade import ships. Preferred DB shape: keep one unique key for unscoped imports where `bot_provider_account_id IS NULL`, and add a provider-scoped unique key for `(bot_instance_id, bot_provider_account_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NOT NULL`; then add a regression that two provider accounts can import the same external id when intended. Target part: `packages/db/migrations/*`, `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `tests/integration/db-0002.test.ts` or `tests/integration/legacy-provider-worker.test.ts`.

5. P2 - Existing tests prove the current safety boundaries but not the Phase 4.29 edge cases. Evidence: admin health loader coverage seeds one Legacy raw metric snapshot with mapped and unmapped pub_id rows at `tests/integration/admin-bot-health-loader.test.ts:103-159`, not two latest provider-scoped metric snapshots. Legacy worker coverage proves one mapped provider account writes scoped metric/position rows at `tests/integration/legacy-provider-worker.test.ts:156-206`. Selected-user tests prove cross-user/secret markers are hidden at `tests/integration/admin-user-bot-detail-loader.test.ts:583-638` and ambiguous mappings suppress stats at `tests/integration/admin-user-bot-detail-loader.test.ts:719-779`, but the positive warning attribution case still uses only count fields at `tests/integration/admin-user-bot-detail-loader.test.ts:415-424` and `tests/integration/admin-user-bot-detail-loader.test.ts:551-557`. Recommendation: add focused behavioral tests for multi-provider fleet aggregation, mismatched warning identity, selected-user readiness with no scoped rows, and same external trade id across provider accounts before claiming the data-scope slice complete. Target part: `tests/integration/admin-bot-health-loader.test.ts`, `tests/integration/admin-user-bot-detail-loader.test.ts`, `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/db-0002.test.ts`, `tests/integration/legacy-provider-worker.test.ts`.

## Decisions
- Treat Phase 4.29 as data-scope hardening, not UI polish and not live-control enablement.
- Keep Legacy closed-trade analytics pending until immutable, provider-scoped imports exist; do not fabricate PF, win rate, realized PnL, or attribution from active slots/orders.
- Use internal WTC ids for scope matching; never expose or store raw Legacy `pub_id` in warning attribution DTOs or user-facing owner selector output.
- Keep selected-user pages read-only. Admin diagnostics can show fleet context, but user readiness must be based on selected-user/scoped persisted rows.
- Do not run live server mutations, provider probes, exchange pings, worker ticks, deploys, SSH, or raw env/secret reads in this phase.

## Risks
- `/admin/bots` can under-report or mis-route Legacy fleet diagnostics when two active Legacy provider mappings produce separate snapshots and only one is the latest row.
- Count-only Legacy warning attribution can attach a quarantined/no-history runtime warning to the wrong selected user if the aggregate health row is unique by count but not by provider mapping identity.
- Admin selected-user runtime/worker "ready" rows can still be misread as selected-user statistic freshness unless labels and DTO gates clearly separate aggregate context from scoped evidence.
- Current trade import uniqueness can drop legitimate provider-scoped Legacy trade history if two provider accounts reuse the same external trade id under the same bot instance/source adapter.
- Multi-provider aggregation must continue sanitizing raw snapshot JSON; no raw `pub_id`, exchange secrets, provider URLs, raw errors, or hidden user markers should escape DTO boundaries.

## Verification/tests
RUN:
- Read-only shell inspection only: `git rev-parse --show-toplevel`, `git branch --show-current`, `git status --short`.
- Read-only source searches and line inspection with `rg` and `Get-Content` for the files listed above.

NOT RUN:
- `npx vitest run ...` - not run; user requested no heavy gates and this was a read-only audit.
- `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker` - not run; no code patch.
- `npm run lint` - not run; no code patch.
- `npm run secret:scan` - not run; no code patch.
- `npm run build`, `npm run build -w @wtc/web` - not run; no code patch.
- `npm run e2e`, `npx playwright test ...`, rendered visual proof - not run; no browser scope.
- `npm run accept:worker:continuity:managed` - not run; requires operator-approved `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires operator-approved `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
- Live bot start/stop/apply-config, worker tick, exchange ping, provider reachability probe, SSH, tmux, systemd, deploy, production monitoring, raw env dump, or raw secret read - not run and intentionally out of scope.

## Next actions
1. Implement provider-scoped Legacy fleet aggregation in `apps/web/src/features/admin/bot-health-loader.ts` and prove it with a two-provider snapshot test.
2. Add provider identity matching for Legacy runtime warnings, then prove mismatched aggregate health stays `runtime_not_scoped`.
3. Harden selected-user readiness DTOs/labels so scoped persisted statistics, not aggregate product/worker health, decide selected-user statistics readiness.
4. Add provider-aware trade import idempotency migration/repository behavior and a same-external-id-across-provider-accounts regression.
