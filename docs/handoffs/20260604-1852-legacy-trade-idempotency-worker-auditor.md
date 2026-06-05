# legacy-trade-idempotency-worker-auditor handoff
## Scope
Phase 4.30 read-only auditor lane for provider-aware Legacy closed-trade import idempotency after Phase 4.29. Scope was inspection only: determine whether the current Legacy worker imports closed trades, identify the provider-scope rows and collision behavior, recommend the smallest safe implementation/test slice, and report gates. No code changes, no live bot start/stop/apply-config, no provider probe, no raw env/secrets.

This is one per-agent auditor handoff, not an aggregate phase handoff and not an N-agent audit claim.

## Files inspected
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None — read-only audit. The only filesystem write by this auditor is this required handoff file: `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`.

## Findings
1. Severity P1 - Current Legacy worker writes metric snapshots and open position snapshots only; it does not import closed trades. Evidence: `apps/worker/src/legacy-live.ts:403` imports only `insertBotMetricSnapshot` and `insertBotPositionSnapshot` from `@wtc/db`; `apps/worker/src/legacy-live.ts:416-448` writes `bot_metric_snapshots`, with `closedPnlUsd: undefined` at `apps/worker/src/legacy-live.ts:422` and `tradeCount: 0` at `apps/worker/src/legacy-live.ts:431`; `apps/worker/src/legacy-live.ts:450-466` writes `bot_position_snapshots`; the returned Legacy result includes accounts/settings/stages/positions/slots counters, not trade counters, at `apps/worker/src/legacy-live.ts:468-479`. Worker orchestration mirrors that: Legacy tracks `legacyAccountsSeen`, `legacySettingsSeen`, `legacyPositionsSeen`, and `legacyProviderAccountsScoped` at `apps/worker/src/index.ts:195-202` and sets them from `snapshotLegacyBotPostgres()` at `apps/worker/src/index.ts:262-271`; only Tortila tracks `tradesSeen` and `tradesImported` at `apps/worker/src/index.ts:191-194` and `apps/worker/src/index.ts:237-247`. Recommendation: do not claim Legacy closed-trade analytics are worker-imported yet; add a dedicated Legacy closed-trade importer after the DB idempotency invariant is safe. Target part: Legacy worker/import readiness.

2. Severity P1 - The current provider scope source of truth is `bot_provider_accounts`, joined to Legacy by provider pub_id/API id and persisted into snapshot rows by `botProviderAccountId`. Evidence: schema defines `bot_provider_accounts.id`, `user_id`, `bot_instance_id`, `product_code`, `provider`, and `provider_account_id` at `packages/db/src/schema.ts:146-155`; active mapping indexes are defined at `packages/db/src/schema.ts:163-171`, including `bpa_instance_provider_account_idx`, `bpa_active_instance_provider_idx`, and `bpa_active_provider_account_idx`; repository reads active mappings by `productCode`, optional `provider`, and `status='active'` at `packages/db/src/repositories.ts:1884-1900`; the Legacy worker asks for `productCode: 'legacy_bot'` and `provider: 'legacy-db'` at `apps/worker/src/legacy-live.ts:536-540`; it calls `readLegacyRows(databaseUrl, providerAccount.providerAccountId)` at `apps/worker/src/legacy-live.ts:552-555`; `readLegacyRows()` filters `api_keys.pub_id = apiId` at `apps/worker/src/legacy-live.ts:333-338` and then filters settings/stages/slots/orders by `api_id in apiIds` at `apps/worker/src/legacy-live.ts:351-380`; the snapshot write passes `botProviderAccountId: providerAccount.id` at `apps/worker/src/legacy-live.ts:555-558`. Recommendation: future Legacy trade imports should carry the WTC `bot_provider_accounts.id` UUID, not raw pub_id in audit/response surfaces. Target part: provider-scoped Legacy import mapping.

3. Severity P1 - `bot_trade_imports` already has `bot_provider_account_id`, but the current idempotency key ignores it, so same `externalTradeId` can collide across provider-scoped imports under the same bot instance and source adapter. Evidence: `bot_trade_imports` includes `bot_provider_account_id` at `packages/db/src/schema.ts:569-571`, but the unique index is `botInstanceId + externalTradeId + sourceAdapter` at `packages/db/src/schema.ts:587-589`; repository input accepts `botProviderAccountId` at `packages/db/src/repositories.ts:2233-2237` and stores it at `packages/db/src/repositories.ts:2243-2246`, but the comment and conflict behavior still document `ON CONFLICT (botInstanceId, externalTradeId, sourceAdapter) DO NOTHING` at `packages/db/src/repositories.ts:2239-2240`; the existing duplicate test only proves same-trade replay idempotency without provider scope at `tests/integration/db-0002.test.ts:118-126`. Nuance: active same-provider mappings for a single bot instance are currently constrained by `bpa_active_instance_provider_idx` at `packages/db/src/schema.ts:166-168`, and cross-bot imports do not collide because `botInstanceId` is in the key. The unsafe case remains any scoped import path that needs two rows with the same `botInstanceId`, `sourceAdapter`, and `externalTradeId` but different `botProviderAccountId`, or a scoped/unscoped transition with the same external id. Recommendation: replace the single unique index with provider-aware uniqueness: keep unscoped duplicates blocked by a partial unique index where `bot_provider_account_id IS NULL`, and block scoped duplicates by a partial unique index on `(bot_instance_id, bot_provider_account_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NOT NULL`. Target part: `bot_trade_imports` schema/migration and `importBotTrade()`.

4. Severity P1 - Legacy currently has no inspected closed-trade source reader; `readLegacyRows()` reads live account/settings/stage/slot/order state, and `orders` are active orders only. Evidence: `readLegacyRows()` selects from `api_keys`, symbol settings, `stageconfigs`, `slots`, and `orders` at `apps/worker/src/legacy-live.ts:333-380`; both `slots` and `orders` filters include `active = true` at `apps/worker/src/legacy-live.ts:370-380`; the warning builder always emits `no_trade_history` at `apps/worker/src/legacy-live.ts:313-316`. Recommendation: Phase 4.30 should not jump straight into Legacy trade table parsing until the source table/id columns are audited; the first safe slice is DB/repository idempotency, then a separately scoped Legacy closed-trade source reader. Target part: Legacy closed-trade import implementation order.

5. Severity P2 - Phase 4.29 explicitly left this open, so the next implementation should be narrow and test-first. Evidence: Phase 4.29 finding 5 says provider-aware closed-trade import idempotency remains open and calls for same `externalTradeId` across provider accounts at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:55-60`; Phase 4.29 decisions deferred it because it needs a DB migration and conflict-invariant decision at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:62-67`; next actions name Phase 4.30 and require DB/import regression plus existing Legacy provider worker tests at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:97-100`. Recommendation: implement exactly one DB migration plus repository/schema/test update before touching worker source parsing. Target part: next phase scope control.

6. Severity P2 - Nearby tests prove provider-scoped Legacy snapshots and Tortila trade idempotency separately, but no test combines Legacy/provider scope with closed-trade import idempotency. Evidence: `tests/integration/legacy-provider-worker.test.ts:156-206` asserts Legacy metric and position snapshots are scoped to `botProviderAccountId` and secret fields do not serialize; `tests/integration/worker-tortila-snapshot.test.ts:58-76` asserts Tortila closed trades import idempotently and only five audit rows are created across two snapshots; `tests/integration/worker-continuity-acceptance-runner.test.ts:59-75` only checks the managed continuity runner fixture and redaction/opt-in behavior, not trade import uniqueness. Recommendation: add a focused DB/import regression that imports the same `externalTradeId` twice for the same provider account and once for a different provider account under the same bot instance, then asserts same-provider duplicate is skipped and cross-provider scoped import is inserted. Target part: tests.

## Decisions
- Treat current Legacy worker state as metrics/positions-only, with closed-trade import not implemented.
- Keep provider identity based on `bot_provider_accounts.id` plus provider metadata, not raw provider pub_id in user/admin surfaces or audit payloads.
- Recommend DB/repository idempotency as the smallest safe first slice before adding any Legacy closed-trade source reader.
- Recommend partial unique indexes so historical unscoped imports remain idempotent while provider-scoped imports can coexist across provider account UUIDs.
- No code, migration, test, live worker, provider, exchange, env, or secret mutation was performed in this auditor lane.

## Risks
- Legacy closed-trade analytics remain incomplete until a provider-aware import key and a Legacy closed-trade source reader exist.
- `bot_trade_reviews` still uses `(botInstanceId, externalTradeId, sourceAdapter)` uniqueness at `packages/db/src/schema.ts:597-618`; if per-provider trade review notes are required, that overlay will need a separate provider-scope decision after import idempotency.
- Real Postgres migration behavior should be verified for partial unique indexes; PGlite is useful for focused tests, but acceptance should include real Postgres when an admin/throwaway URL is intentionally provided.
- The worktree was already heavily dirty before this audit; this handoff does not certify unrelated modified/untracked files.

## Verification/tests
RUN:
- `git status --short --branch` - observed current branch and pre-existing dirty tree; no cleanup/revert performed.
- Read-only line inspection using `rg`/`Get-Content` for the files listed above.
- Handoff path existence check before writing - target did not exist.

NOT RUN:
- `npx vitest ...` - not run; this was a read-only auditor lane with no code/test implementation.
- `npm run typecheck`, `npm run typecheck -w @wtc/db`, `npm run typecheck -w @wtc/worker` - not run; no implementation was performed.
- DB migration generation/application - not run; migration is recommended as next implementation slice, not performed here.
- `npm run secret:scan` / `npm run governance:check` - not run; no code changed and no raw env/secrets were read.
- `npm run accept:worker:continuity` / `npm run accept:worker:continuity:managed` - not run; no live/managed worker acceptance in this read-only audit, and no admin Postgres URL was requested/read.
- Playwright/browser visual gates - not run; out of scope for provider-aware import idempotency audit.
- Live bot start/stop/apply-config, provider/exchange reachability probe, raw env/secret reads, SSH/tmux/systemd/deploy/production monitoring - not run and intentionally forbidden by scope.

## Next actions
1. Add a DB migration that drops/replaces the current `bti_external_trade_idx` with partial uniqueness for unscoped imports and provider-scoped imports.
2. Update `packages/db/src/schema.ts` to match the migration and keep `importBotTrade()` idempotent via `onConflictDoNothing()`.
3. Add a focused repository regression for same-provider duplicate replay, cross-provider same external id insertion, and unscoped duplicate behavior.
4. Run at minimum the focused DB/import regression, `tests/integration/db-0002.test.ts`, `tests/integration/legacy-provider-worker.test.ts`, `tests/integration/worker-tortila-snapshot.test.ts`, and `tests/integration/worker-continuity-acceptance-runner.test.ts`.
5. Only after the DB invariant is green, audit the Legacy source for closed-trade table/id columns and implement the Legacy closed-trade reader/importer as a separate small slice.
