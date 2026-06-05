# ecosystem-db-architect / ecosystem-platform-architect handoff
## Scope
Phase 4.39 read-only destination-model and importer-contract audit for Legacy closed trades. Goal: answer whether the WTC-side destination is ready to ingest provider-scoped Legacy closed trades if a source is found, and define the exact adapter/importer contract, mandatory vs optional fields, idempotency/replay rule, and proof tests.

Constraints followed: no code implementation, no live services, no provider calls, no DB mutation, no bot start/stop/apply-config, no process kill, no secret printing. This auditor wrote exactly one file: this handoff.

## Files inspected
- `AGENTS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `packages/db/migrations/meta/_journal.json`
- `docs/DATA_MODEL.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`

## Files changed
`docs/handoffs/20260604-2245-legacy-closed-trade-destination-contract-auditor.md`

## Findings
1. Severity P1 - The WTC destination table is ready for provider-scoped closed-trade rows, assuming a real Legacy closed-trade source is proven. Evidence: `bot_trade_imports` has `bot_provider_account_id`, `external_trade_id`, symbol/side/entry/exit/size/PnL/fee/funding/open/close/source/raw fields and provider-aware indexes at `packages/db/src/schema.ts:564-596`; migration `0018_provider_snapshot_scope.sql` added `bot_provider_account_id` to trade imports with FK/index support at `packages/db/migrations/0018_provider_snapshot_scope.sql:4-12`; migration `0021_complete_pepper_potts.sql` split uniqueness into unscoped and provider-scoped partial indexes at `packages/db/migrations/0021_complete_pepper_potts.sql:1-3`; `docs/DATA_MODEL.md:526-563` now states that proven Legacy sources normalize to this schema while Legacy source ingestion stays blocked until source proof. Recommendation: no new destination-table migration is required before a Legacy importer unless source discovery proves a genuinely missing destination concept; target part: `bot_trade_imports` destination model.

2. Severity P1 - Legacy imports must scope by WTC provider-account UUID, not raw Legacy `pub_id`. Evidence: `bot_provider_accounts.provider_account_id` stores the Legacy `pub_id` while `bot_provider_accounts.id` is the WTC identity row at `packages/db/src/schema.ts:146-155`; active provider uniqueness is enforced at `packages/db/src/schema.ts:163-173`; the Legacy worker filters source reads by `providerAccount.providerAccountId` but snapshots with `botProviderAccountId: providerAccount.id` at `apps/worker/src/legacy-live.ts:552-558`; user reads require one active mapping and scope `bot_trade_imports` by `bot_provider_account_id` at `apps/web/src/features/bots/data.tsx:450-490`; admin loader scoping rejects Legacy rows whose provider UUID does not match the single active mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:870-910`. Recommendation: the importer contract must use raw `pub_id` only as the provider-source filter and must pass `botProviderAccountId: providerAccount.id` into `importBotTrade()`; target part: Legacy provider-account mapper.

3. Severity P1 - The importer is not implemented today; current Legacy worker reads live-state snapshots only. Evidence: `readLegacyRows()` selects `api_keys`, symbol settings, `stageconfigs`, active `slots`, and active `orders` only at `apps/worker/src/legacy-live.ts:333-380`; it rejects selected secret-looking fields at `apps/worker/src/legacy-live.ts:143-149`; `snapshotLegacyRowsToWtc()` imports only `insertBotMetricSnapshot` and `insertBotPositionSnapshot` at `apps/worker/src/legacy-live.ts:403`, writes `closedPnlUsd: undefined` and `tradeCount: 0` at `apps/worker/src/legacy-live.ts:416-431`, and returns no trade counter at `apps/worker/src/legacy-live.ts:468-479`; worker health tracks Tortila trade counters but Legacy only account/settings/position/provider-scope counters at `apps/worker/src/index.ts:190-202` and `apps/worker/src/index.ts:294-315`; the Legacy contract still says `getTrades()` is unavailable at `docs/CONTRACTS/legacy-bot-adapter.md:293-314`. Recommendation: do not claim ingestion readiness beyond the destination/repository layer until a source-backed Legacy reader/mapper is added; target part: `apps/worker/src/legacy-live.ts`.

4. Severity P1 - Exact Legacy adapter/importer contract still needed: a source-proofed mapper from one active WTC provider mapping to sanitized normalized closed-trade rows. Evidence: repository input currently accepts `botInstanceId`, optional `botProviderAccountId`, `externalTradeId`, `symbol`, `side`, `entryPrice`, `exitPrice`, `size`, `realizedPnlUsd`, optional fees/funding, timestamps, `exitReason`, `sourceAdapter`, and `rawJson` at `packages/db/src/repositories.ts:2233-2237`; `importBotTrade()` inserts defaults and conflict handling at `packages/db/src/repositories.ts:2241-2268`; Tortila shows the existing normalized closed-trade mapping shape at `apps/worker/src/jobs.ts:233-255`; Phase 4.31 records the required candidate source fields at `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md:55`. Recommendation: add a Legacy-only importer contract requiring source evidence for provider filter, stable external trade/fill id, lifecycle timestamps, side/price/size, realized PnL, fees/funding sign semantics, and no-secret raw payload before writing rows; target part: future Legacy closed-trade adapter contract.

5. Severity P1 - Mandatory vs optional field contract should be stricter than the generic repository interface for Legacy. Evidence: destination not-null fields are `bot_instance_id`, `external_trade_id`, `symbol`, `side`, `entry_price`, `exit_price`, `size`, `realized_pnl_usd`, `fees_usd`, `funding_paid_usd`, `opened_at`, `closed_at`, `source_adapter`, and `imported_at` at `packages/db/src/schema.ts:569-585`; repository defaults `feesUsd` and `fundingPaidUsd` to `0` when omitted at `packages/db/src/repositories.ts:2243-2246`; canonical analytics says unavailable metrics must render as N/A rather than zero at `docs/CANONICAL_ANALYTICS_MODEL.md:164-170`, and Legacy has no closed PnL/fee/funding support today at `docs/CANONICAL_ANALYTICS_MODEL.md:220-225`. Recommendation: for Legacy, make `botProviderAccountId`, `sourceAdapter: 'legacy-db'`, `externalTradeId`, `symbol`, normalized `side`, `entryPrice`, `exitPrice`, `size`, `realizedPnlUsd`, `feesUsd`, `fundingPaidUsd`, `openedAt`, and `closedAt` mandatory in the mapper; allow `exitReason` and sanitized `rawJson` as optional; treat DB-generated `id` and `importedAt` as non-inputs; target part: importer DTO and validation.

6. Severity P1 - Replay/idempotency rule is already encoded and should be enforced as the importer acceptance invariant. Evidence: schema has `bti_external_trade_unscoped_idx` on `(bot_instance_id, external_trade_id, source_adapter)` where scope is null and `bti_provider_external_trade_idx` on `(bot_instance_id, bot_provider_account_id, external_trade_id, source_adapter)` where scope is not null at `packages/db/src/schema.ts:588-596`; repository branches `ON CONFLICT DO NOTHING` by scoped vs unscoped input at `packages/db/src/repositories.ts:2243-2268`; `tests/integration/db-0002.test.ts:119-134` proves duplicate unscoped replay returns one row; `tests/integration/db-0002.test.ts:137-188` proves the same external id duplicates within one provider but imports independently for two WTC provider-account UUIDs without raw provider markers; Phase 4.30 records the invariant at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:54-57`. Recommendation: Legacy importer replay rule must be "first run inserts one row per `(botInstanceId, botProviderAccountId, externalTradeId, sourceAdapter)`, exact replay inserts zero new rows and writes no duplicate audit, same external id under a different WTC provider account is a different row"; target part: import idempotency/replay.

7. Severity P2 - User/admin destination consumers are mostly ready for provider-scoped rows, but UI acceptance must stay pending until source-backed imports exist. Evidence: user data loader scopes trade rows by the mapped provider account at `apps/web/src/features/bots/data.tsx:489-595`; `LegacyOperationsPanel` can flip `Closed-trade history` from `pending import` to a count at `apps/web/src/features/bots/statistics-panels.tsx:586-610`; the user statistics command center still hardcodes Legacy PnL as `closed trade imports pending` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:457-459`; selected-user admin cards switch from `pending import` to imported trade counts at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57-60`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:183-189`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:812-818`. Recommendation: after source-backed import proof, update UI tests to assert both pending and loaded branches and fix the hardcoded command-center Legacy PnL label; target part: bot statistics/admin read models.

8. Severity P2 - Existing tests prove adjacent destination behavior, but not a real Legacy closed-trade importer. Evidence: `tests/integration/legacy-provider-worker.test.ts:156-206` proves provider-scoped metric/position snapshots and no secret serialization, not trade import; `tests/integration/admin-user-bot-detail-loader.test.ts:390-407` directly inserts a synthetic scoped Legacy trade and `tests/integration/admin-user-bot-detail-loader.test.ts:539-545` verifies the loader returns it; `tests/integration/admin-user-bot-detail-loader.test.ts:790-820` proves ambiguous Legacy provider mappings hide scoped rows; `tests/integration/worker-tortila-snapshot.test.ts:58-76` proves Tortila closed-trade idempotency only; `tests/integration/bot-statistics-completion.test.ts:25-48` still pins pending Legacy copy. Recommendation: add importer-level proof only after source proof exists, and keep direct DB fixtures classified as destination/render coverage; target part: test plan.

9. Severity P2 - Any future `rawJson` or source discovery must keep the no-secret boundary. Evidence: `assertNoSecretFields()` blocks selected Legacy secret fields at `apps/worker/src/legacy-live.ts:143-149`; static tests reject `select *`, `api_key`, and `secret_key` in Legacy queries at `tests/integration/legacy-live-worker-static.test.ts:175-180`; provider worker serialization is checked for no credential markers at `tests/integration/legacy-provider-worker.test.ts:204-206`; the Legacy contract still warns that plaintext key fields exist in old HTTP responses and keeps closed-trade history unavailable at `docs/CONTRACTS/legacy-bot-adapter.md:293-314` and `docs/CONTRACTS/legacy-bot-adapter.md:475-480`. Recommendation: importer `rawJson` must be sanitized, bounded, and free of secrets/raw provider responses; source discovery should remain source-code/metadata-only unless a separate approved phase authorizes otherwise; target part: security/source boundary.

## Decisions
- Verdict: WTC destination is ready to ingest provider-scoped Legacy closed trades if and only if a real source model is proven. The missing piece is not schema capacity; it is the Legacy source reader/mapper/importer contract and its replay tests.
- Required Legacy importer input: `botInstanceId`, `botProviderAccountId` as WTC `bot_provider_accounts.id`, `sourceAdapter: 'legacy-db'`, `externalTradeId`, `symbol`, normalized `side` (`long` or `short`), `entryPrice`, `exitPrice`, `size`, `realizedPnlUsd`, explicitly normalized `feesUsd`, explicitly normalized `fundingPaidUsd`, `openedAt`, and `closedAt`.
- Optional Legacy importer input: `exitReason` when the source proves it, and sanitized `rawJson` for non-secret source trace data such as source row id, source table/version, hold duration, or return percent. `id`, `importedAt`, and DB defaults are not source inputs.
- Source filter contract: read only rows for the mapped Legacy `pub_id`/equivalent source account, but never store or use raw `pub_id` as `bot_trade_imports.bot_provider_account_id`.
- Replay contract: provider-scoped identity is `(botInstanceId, botProviderAccountId, externalTradeId, sourceAdapter)`. Exact replay must be a no-op; same external id under a different WTC provider account is a distinct row.
- Inactive Legacy orders/slots remain invalid as canonical closed trades unless a separate source proof shows stable fill/trade identity, economics, and lifecycle semantics.
- No background agents were spawned for this single requested auditor handoff; none remain open.

## Risks
- If the future mapper lets `botProviderAccountId` be null for Legacy, it bypasses the provider-aware destination invariant and can leak or collapse user scope.
- If fees/funding are silently omitted and repository defaults store zero, UI could imply "no fees/funding" rather than "unknown." Require explicit source semantics before enabling net-fee/funding analytics.
- Hard-deleting `bot_provider_accounts` can still null historical scoped rows because the FK is `ON DELETE SET NULL`; prefer disabling mappings and avoid delete paths for provider identity rows.
- The WTC destination can store rows even if the source is low quality. Acceptance must reject inactive orders/slots or exchange-control side effects as a substitute for durable closed-trade/fill source proof.
- UI positive branches can be made to pass with synthetic `importBotTrade()` fixtures; that does not prove Legacy ingestion from provider source.

## Verification/tests
RUN:
- Read-only inspection of DB schema/repositories, migrations 0017-0021, worker Legacy code, worker orchestration, bot statistics/data/admin loaders, tests, and Phase 4.30-4.31 handoffs.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and a pre-existing dirty/untracked tree before writing this handoff.
- `Test-Path docs/handoffs/20260604-2245-legacy-closed-trade-destination-contract-auditor.md` - returned `False` before writing.

NOT RUN:
- Vitest/typecheck/lint/build/Playwright/browser proof - not run because this was a read-only contract audit with no implementation.
- `npm run db:migrate`, managed DB worker continuity, admin-user DB matrix - not run by explicit no-DB-mutation/no-live-services scope.
- Live Legacy DB/provider/exchange probes, raw env/secret reads, SSH/tmux/systemd/deploy - not run by scope and safety rules.
- Legacy closed-trade importer test - not run because the importer and source reader are not implemented in this phase.

Tests that would prove readiness after source proof:
- DB/repository regression: keep `tests/integration/db-0002.test.ts` coverage for unscoped replay and provider-scoped same-external-id separation.
- Legacy worker importer regression: seed two active Legacy provider mappings, feed source rows with the same `externalTradeId` under both source accounts, assert first run imports two scoped rows, exact replay imports zero, and audit count increases only on first inserts.
- Scope/leak regression: assert imported rows contain WTC provider-account UUIDs, not raw `pub_id`, and ambiguous/missing active provider mappings do not surface Legacy trades in user/admin loaders.
- Source-mapping regression: fixture each mandatory field and sign policy for `realizedPnlUsd`, `feesUsd`, and `fundingPaidUsd`; reject rows without stable id, close timestamp, economic fields, or source account match.
- Secret regression: assert query text and serialized `rawJson` do not contain `api_key`, `secret_key`, `authorization`, `access_token`, or raw provider response bodies.
- UI/render regression: pending branch remains when no imports exist; positive branch shows imported trade count and closed-trade history only for provider-scoped source-backed rows; command-center Legacy PnL copy is no longer hardcoded pending once imports exist.

## Next actions
1. Obtain a source-proof artifact before implementation: upstream Legacy model/migration/API contract, source fixture, or approved metadata-only schema handoff that proves stable closed-trade/fill rows and mandatory field semantics.
2. Implement the smallest importer only after that proof: add a safe Legacy closed-trade reader/mapper in `apps/worker/src/legacy-live.ts`, call `importBotTrade()` with `botProviderAccountId: providerAccount.id`, and add Legacy trade counters to worker health.
3. Add the proof tests listed above before flipping Legacy performance UI from pending to loaded.
4. Keep provider-account identity durable; do not add delete-based cleanup for mapped provider accounts before resolving historical trade FK/nulling implications.
