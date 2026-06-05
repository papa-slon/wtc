# phase-4-34-data-model-provider-trade-scope handoff
## Scope
Phase 4.34 reconciled `docs/DATA_MODEL.md` with the Phase 4.30 provider-aware trade-import destination contract and Phase 4.31 Legacy closed-trade source blocker.

Read-only participant handoff launched before docs edits:
- [data-model-trade-scope-auditor](20260604-2000-data-model-trade-scope-auditor.md)

The background lane for this phase was closed after its result was collected.

## Files inspected
- `docs/DATA_MODEL.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `tests/integration/db-0002.test.ts`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-2000-data-model-trade-scope-auditor.md`

## Files changed
- `docs/DATA_MODEL.md`
- `docs/handoffs/20260604-2000-data-model-trade-scope-auditor.md`
- `docs/handoffs/20260604-2000-phase-4-34-data-model-provider-trade-scope.md`

## Findings
1. Severity P1 - `DATA_MODEL.md` still described provider-unaware trade import uniqueness. Evidence: before this phase, section 4.6 listed unique `(bot_instance_id, external_trade_id, source_adapter)` while `packages/db/src/schema.ts` and migration `0021_complete_pepper_potts.sql` now define scoped/unscoped partial unique indexes. Recommendation: document both partial unique indexes and provider-account scope. Target part: `bot_trade_imports` data model.
2. Severity P1 - The data model lacked the current `bot_provider_account_id` trade-import column. Evidence: `packages/db/src/schema.ts` stores nullable `bot_provider_account_id` on `bot_trade_imports`, and `importBotTrade()` uses it to choose the conflict target. Recommendation: document the column, FK, and raw-provider-id boundary. Target part: trade import scope.
3. Severity P1 - The Legacy closed-trade source blocker must be visible in the data model, otherwise the ready destination schema can be mistaken for source ingestion. Evidence: Phase 4.31 found no local Legacy closed-trade/fill source with stable trade id, realized PnL, fees, funding, and close timestamps. Recommendation: state that WTC can store provider-scoped imports but Legacy source ingestion remains blocked until source proof exists. Target part: analytics/source truth.
4. Severity P2 - The trade-import `source_adapter` examples were too narrow. Evidence: current Phase 4.30/4.31 wording and worker contracts use `legacy-db` for provider DB source context. Recommendation: document examples as `tortila` and `legacy-db`. Target part: adapter naming.

## Decisions
- Updated only the `bot_trade_imports` section and index summary rows in `docs/DATA_MODEL.md`.
- Documented WTC `bot_provider_accounts.id` as the provider scope key; raw Legacy `pub_id` remains source-side only.
- Preserved Legacy closed-trade performance analytics as blocked by source proof.
- Did not change schema, migrations, repositories, tests, or runtime code in this phase.
- The Phase 4.34 background lane was closed before this aggregate handoff.

## Risks
- Existing docs elsewhere may still mention older provider-unaware uniqueness and should be cleaned when encountered.
- `bot_trade_imports.bot_provider_account_id` uses `ON DELETE SET NULL`; hard-deleting provider accounts still needs a retention/dedupe policy if historical scoped imports must remain separated.
- Docs-only reconciliation does not prove the managed DB migration has run against a live database.

## Verification/tests
RUN:
- Read-only source/model search for `bot_trade_imports`, `botProviderAccountId`, partial index names, and import idempotency tests.
- Manual docs patch in `docs/DATA_MODEL.md`.

NOT RUN:
- Vitest, lint, typecheck, build, Playwright, DB migrate, managed DB gates, worker continuity, provider/exchange probes, raw env/secret reads, live bot control, deploy, SSH/tmux/systemd, and production monitoring - not run because this was a docs-only model reconciliation.
- `git diff --check` and `npm run governance:check` - to be rerun immediately after this aggregate.

## Next actions
1. Run `git diff --check` and `npm run governance:check`.
2. Continue fixable-now acceptance with dedicated statistics rendered proof or move to opt-in worker/admin DB gates when the required disposable DB env values are supplied.
