# data-model-trade-scope-auditor handoff
## Scope
Phase 4.34 read-only DATA_MODEL audit for provider-scoped `bot_trade_imports` idempotency and the Legacy closed-trade source blocker.

Scope was limited to inspecting the requested DATA_MODEL, DB schema/repository/migration/test files, and Phase 4.30/4.31 handoffs. No DB, no services, no live provider/exchange probes, no env/secret reads, and no bot control were performed. The only write is this required handoff artifact.

## Files inspected
- `docs/DATA_MODEL.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `tests/integration/db-0002.test.ts`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`

## Files changed
None - read-only audit; required handoff artifact only.

## Findings
1. Severity P1 - The stale DATA_MODEL uniqueness text is the older provider-unaware trade-import contract from the local diff: `Purpose: Imported closed trade records. Immutable once written. Tortila and Legacy normalised to same schema.`, `**Unique**: (bot_instance_id, external_trade_id, source_adapter)`, and the old lookup index note naming `idx_bti_bot_instance_id_closed_at` / `idx_bti_external_trade_id`. Evidence: `git diff -- docs/DATA_MODEL.md` shows those exact lines removed; current `docs/DATA_MODEL.md:526-564` now includes the provider-account UUID column, split partial unique indexes, provider-account FK, renamed lookup indexes, and Legacy source blocker. Recommendation: keep the current working-tree replacement; do not restore the single nullable-provider-unaware unique key. Target part: `docs/DATA_MODEL.md` section 4.6.
2. Severity P1 - The minimal truthful DATA_MODEL replacement for idempotency is the Phase 4.30 split: unscoped imports unique on `(bot_instance_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NULL`, and provider-scoped imports unique on `(bot_instance_id, bot_provider_account_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NOT NULL`. Evidence: current DATA_MODEL lists `bti_external_trade_unscoped_idx` and `bti_provider_external_trade_idx` at `docs/DATA_MODEL.md:552-556`; schema mirrors them at `packages/db/src/schema.ts:588-594`; migration `packages/db/migrations/0021_complete_pepper_potts.sql:1-3` drops the old index and creates the two partial unique indexes; repository conflict handling branches by provider scope at `packages/db/src/repositories.ts:2239-2268`. Recommendation: keep the two partial indexes and matching repository conflict targets. Target part: DB/import idempotency.
3. Severity P1 - The Legacy source blocker remains truthful and must stay attached to DATA_MODEL. Evidence: Phase 4.31 says WTC can store provider-scoped imports but the local Legacy source does not prove a durable closed-trade/fill source at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:3-6`; it records missing stable trade id, realized PnL, fees, funding, opened/closed timestamps, and replay semantics at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:57-60`; current DATA_MODEL repeats the blocker at `docs/DATA_MODEL.md:562-564`. Recommendation: do not claim Legacy closed-trade ingestion or performance analytics until source proof exists. Target part: Legacy closed-trade source boundary.
4. Severity P1 - Provider scoping must use WTC `bot_provider_accounts.id`, not raw Legacy `pub_id`. Evidence: current DATA_MODEL says provider-scoped imports use the WTC provider-account UUID and never raw `pub_id` at `docs/DATA_MODEL.md:534`; Phase 4.31 makes the same rule at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:60`; repository audit metadata records only `botProviderAccountId` UUID/null at `packages/db/src/repositories.ts:2266`; the regression asserts rows contain provider UUIDs and not raw provider markers at `tests/integration/db-0002.test.ts:175-188`. Recommendation: any future importer should filter source rows by mapped provider id/pub_id but write `botProviderAccountId: providerAccount.id`. Target part: future Legacy import mapper.
5. Severity P2 - One narrow DATA_MODEL text remains stale/underspecified: `docs/DATA_MODEL.md:547` says `source_adapter` is `tortila | legacy`, but current tests use `sourceAdapter: 'legacy-db'` for the Legacy provider-scoped regression at `tests/integration/db-0002.test.ts:172`, and schema stores `source_adapter` as unconstrained `TEXT` at `packages/db/src/schema.ts:583`. Recommendation: minimal truthful replacement for that cell is `Source adapter key; current WTC sources include tortila and legacy-db. Not CHECK-constrained.` Target part: `bot_trade_imports.source_adapter` documentation.

## Decisions
- Treat the current DATA_MODEL trade-import block as already reconciled for provider-scoped idempotency, with one remaining adapter-label cleanup noted above.
- The exact stale uniqueness text should be replaced by the current working-tree wording: provider-account UUID column, split partial unique indexes, provider-account FK, current lookup index names, and the Legacy source blocker note.
- Do not treat `bot_trade_imports` readiness as Legacy source proof; it is only the destination contract for a future proven source-backed importer.
- No DB migrations, tests, services, provider probes, exchange probes, env/secret reads, or bot controls were run.

## Risks
- The checkout is dirty and `docs/DATA_MODEL.md` is modified in the working tree, so another branch or reset could still contain the exact stale provider-unaware text.
- `source_adapter` label drift (`legacy` vs `legacy-db`) can confuse future importer/test authors unless the doc cell is clarified.
- `bot_provider_accounts` should remain durable identity rows; hard deletion can null provider-scoped trade rows through `ON DELETE SET NULL` and interact with the unscoped unique index.

## Verification/tests
RUN:
- `git status --short --branch` - observed current branch and pre-existing dirty/untracked files.
- Read-only `rg`/line inspections across all requested files and Phase 4.30/4.31 handoffs.
- `git diff -- docs/DATA_MODEL.md` - recovered the exact stale DATA_MODEL text and current minimal replacement.

NOT RUN:
- `npm run typecheck`, Vitest, lint, Playwright, browser proof - not run; audit-only scope.
- `npm run db:migrate`, managed DB acceptance, local/live DB queries - not run; no DB mutation or DB access.
- Provider/exchange probes, env/secret reads, services, deploy, SSH/tmux/systemd, live bot start/stop/apply-config - not run and out of scope.

## Next actions
1. In a docs cleanup phase, update only the `bot_trade_imports.source_adapter` DATA_MODEL cell from `tortila | legacy` to a truthful free-text/current-source note such as `Source adapter key; current WTC sources include tortila and legacy-db. Not CHECK-constrained.`
2. Keep Legacy closed-trade importer work blocked until a source-proof artifact identifies provider filter, stable external trade/fill id, symbol, side, size, entry/exit price, realized PnL, fees, funding policy, opened/closed timestamps, exit reason, retention/backfill window, and replay semantics.
3. If source proof arrives, add the smallest future importer regression: same Legacy external id across two mapped WTC provider accounts imports two scoped rows on first run, same-provider replay inserts zero, and raw `pub_id`/secret markers never appear in rows, audit, UI, or logs.
