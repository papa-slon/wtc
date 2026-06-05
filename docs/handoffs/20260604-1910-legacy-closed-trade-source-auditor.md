# legacy-closed-trade-source-auditor handoff
## Scope
Phase 4.31 read-only source-model audit after Phase 4.30 provider-aware trade idempotency. Scope was to determine, from repo/local-source evidence only, what Legacy source tables are currently read, whether a Legacy closed-trade source table/columns are known, what a safe candidate import contract would require, the unknowns, and exact stop conditions.

No code implementation, no migration, no tests, no live DB/provider/exchange probe, no live bot start/stop/apply-config, no raw env/secret read, no SSH/tmux/systemd/deploy, and no managed DB mutation were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/*legacy*` via read-only text search for `closed`, `trade`, `source`, `pub_id`, `provider`, `idempotency`, `snapshot`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/DATA_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/db-0002.test.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `C:/Users/maxib/GTE BOT/bot/models.py`
- `C:/Users/maxib/GTE BOT/bot/database.py`

## Files changed
None - read-only audit. Required protocol artifact written: `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`.

## Findings
1. Severity P1 - Current Legacy worker source reads only safe live-state tables, not closed trades. Evidence: `readLegacyRows()` reads `api_keys.pub_id/market/running/balance/quarantined/quarantine_reason` at `apps/worker/src/legacy-live.ts:333-347`, symbol settings from detected `symbolsettingss`/`symbolsettings` at `apps/worker/src/legacy-live.ts:327-363`, `stageconfigs` at `apps/worker/src/legacy-live.ts:364-369`, active `slots` at `apps/worker/src/legacy-live.ts:370-375`, and active `orders` at `apps/worker/src/legacy-live.ts:376-380`. It rejects secret-looking selected fields at `apps/worker/src/legacy-live.ts:143-149` and asserts that for all queried row sets at `apps/worker/src/legacy-live.ts:383-386`. Recommendation: keep this source whitelist intact; do not reinterpret active orders or slot closure as historical trades. Target part: Legacy source reader.

2. Severity P1 - The current Legacy worker writes metric and position snapshots only; closed-trade import is not implemented. Evidence: `snapshotLegacyRowsToWtc()` imports only `insertBotMetricSnapshot` and `insertBotPositionSnapshot` at `apps/worker/src/legacy-live.ts:403`, writes `closedPnlUsd: undefined` and `tradeCount: 0` at `apps/worker/src/legacy-live.ts:416-431`, writes positions at `apps/worker/src/legacy-live.ts:450-466`, and returns counters for accounts/settings/stages/positions/slots without a trade counter at `apps/worker/src/legacy-live.ts:468-479`. Phase 4.30 records the same boundary at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:57` and explicitly says the importer was not built at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:61`. Recommendation: do not claim Legacy closed-trade analytics are complete until a source reader plus importer exists and is tested. Target part: worker/import readiness.

3. Severity P1 - Repo evidence does not identify a known Legacy closed-trade source table or source columns. Evidence: the local Legacy SQLAlchemy source defines `Api_Key`, `Order`, `SymbolSettings`, `StageConfig`, and `Slot` models at `C:/Users/maxib/GTE BOT/bot/models.py:91-185`; default table naming is class lower-case plus `s` at `C:/Users/maxib/GTE BOT/bot/database.py:50-52`; `close_slot()` only marks a slot inactive and returns the slot at `C:/Users/maxib/GTE BOT/bot/models.py:266-281`; order helpers cover active/current orders and toggling orders at `C:/Users/maxib/GTE BOT/bot/models.py:527-653`. The Legacy contract states no closed-trade history endpoint exists and active orders/slots are current state only at `docs/CONTRACTS/legacy-bot-adapter.md:293-313`, and the open item asks for a future `GET /api_management/{api_id}/trades` at `docs/CONTRACTS/legacy-bot-adapter.md:471-480`. Recommendation: classify Legacy closed-trade source table/columns as `UNKNOWN_NO_EVIDENCE` in the repo. Target part: source model.

4. Severity P1 - Phase 4.30 made the WTC destination/import idempotency contract ready, but it is not a source proof. Evidence: `bot_trade_imports` has destination fields for `bot_provider_account_id`, `external_trade_id`, symbol/side/entry/exit/size, realized PnL, fees, funding, opened/closed timestamps, source adapter, raw JSON, and partial provider-aware uniqueness at `packages/db/src/schema.ts:564-596`; migration `packages/db/migrations/0021_complete_pepper_potts.sql:1-3` split unscoped and provider-scoped uniqueness; `importBotTrade()` branches conflict handling by normalized WTC provider-account UUID at `packages/db/src/repositories.ts:2239-2268`; tests prove unscoped duplicate replay and same-external-id cross-provider behavior at `tests/integration/db-0002.test.ts:119-188`. Recommendation: future Legacy importer may target this WTC contract, but only after a real source row model is proven. Target part: destination import contract.

5. Severity P1 - Provider scoping must stay based on WTC `bot_provider_accounts.id`, with raw Legacy `pub_id` used only for source filtering. Evidence: `bot_provider_accounts.provider_account_id` stores the Legacy `Api_Key.pub_id` at `packages/db/src/schema.ts:146-155`, with active uniqueness on instance/provider and product/provider/account at `packages/db/src/schema.ts:163-173`; the worker reads active `legacy_bot` / `legacy-db` mappings at `apps/worker/src/legacy-live.ts:536-540`, filters source reads by `providerAccount.providerAccountId` at `apps/worker/src/legacy-live.ts:552-555`, and writes snapshots using `botProviderAccountId: providerAccount.id` at `apps/worker/src/legacy-live.ts:555-558`. User-facing reads require exactly one active mapping and scope trade reads by `bot_provider_account_id` at `apps/web/src/features/bots/data.tsx:450-490`. Recommendation: never use raw `pub_id` as the WTC `bot_trade_imports.bot_provider_account_id`; pass the WTC UUID into `importBotTrade()`. Target part: provider-scoped import mapping.

6. Severity P2 - Current UI/admin surfaces already preserve honest pending semantics for Legacy closed trades. Evidence: `BOT_CAPS.legacy_bot.hasTradeHistory` and `hasEquityCurve` are false and notes say closed-trade analytics are not connected at `apps/web/src/features/bots/meta.ts:69-80`; the user trades page shows "No closed-trade history available" when the capability is absent at `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:51-58`; Legacy statistics show "pending import" and a warning that win rate, PF, realized PnL, and attribution stay hidden until imports exist at `apps/web/src/features/bots/statistics-panels.tsx:586-610`; readiness copy says Legacy statistics are snapshot/projection based until closed-trade history is available at `apps/web/src/features/bots/readiness.ts:224-230`. Recommendation: keep the UI pending state until real source-backed imports exist. Target part: Legacy statistics/admin surfaces.

7. Severity P2 - A safe candidate import contract is inferable only as a required target shape, not as a current source mapping. Required candidate fields: stable `externalTradeId`; source filter by Legacy `api_id/pub_id`; symbol; normalized side; entry price; exit price; size; realized PnL; fees as positive cost or explicit sign normalization; funding paid/received with documented sign; opened timestamp; closed timestamp; exit reason when known; raw JSON with no secrets; `sourceAdapter: 'legacy-db'`; and WTC `botProviderAccountId`. Evidence: the destination schema requires these fields at `packages/db/src/schema.ts:569-584`, the repository input requires the same core fields at `packages/db/src/repositories.ts:2234-2237`, and the generic worker import path shows the existing normalized import shape for Tortila at `apps/worker/src/jobs.ts:233-255`. Recommendation: implement no Legacy importer until each required source field is mapped with evidence and a fixture/test. Target part: future closed-trade import contract.

8. Severity P2 - The standing secret boundary is still mandatory for any future source discovery/import. Evidence: the accepted canary contract says WTC reads provider Postgres safe columns by `pub_id` and does not call management/control endpoints at `docs/CONTRACTS/legacy-bot-adapter.md:20-36`; the Legacy HTTP response contract still includes plaintext `api_key` and `secret_key` fields as a known issue at `docs/CONTRACTS/legacy-bot-adapter.md:125-146`; Phase 3.68 notes provider DB credential columns exist provider-side, WTC code does not select/render them, and closed-trade history remains unavailable at `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md:66-78`; the provider worker test asserts serialized metrics/positions do not contain secret markers at `tests/integration/legacy-provider-worker.test.ts:204-206`. Recommendation: any metadata/source discovery must be column-name-only or fixture/source-code based unless a separately approved restricted role/probe phase exists, and no import raw JSON may include credential-shaped keys. Target part: security/source discovery.

## Decisions
- Classify the Legacy closed-trade source table and source columns as `UNKNOWN_NO_EVIDENCE` from repo/local-source inspection.
- Treat `orders` and `slots` as current/open runtime state only, even though inactive slots/orders may exist; they lack the required realized PnL, fee, funding, entry/exit, and stable closed-trade semantics.
- Treat WTC `bot_trade_imports` plus `importBotTrade()` as the destination contract, not a source proof.
- Require WTC `bot_provider_accounts.id` for provider-scoped imports; raw Legacy `pub_id` is only a source-side filter.
- Keep closed-trade analytics/user/admin UI in pending/unavailable state until a proven source model and importer are implemented.
- No background agents were launched by this auditor lane; this was the single requested read-only per-agent handoff. No background agents are left running by this lane.

## Risks
- Implementing from guessed table names such as `orders`, inactive `slots`, exchange order ids, or HTTP `/api_management` responses would fabricate analytics and may double-count or miss real closes.
- If a future source is exchange-side rather than provider-DB-side, it may violate the no exchange/provider probe boundary unless a separate audited, read-only adapter phase authorizes it.
- If a future source table exists only in production provider DB and not local source, this lane cannot prove it without an operator-approved metadata-only discovery gate.
- `docs/DATA_MODEL.md` still describes older provider-unaware uniqueness at `docs/DATA_MODEL.md:548-551`; schema and Phase 4.30 are newer. Future docs cleanup should update DATA_MODEL to the Phase 4.30 partial-index truth.
- Existing Legacy UI copy now says imports are pending; if a later phase adds imports, rendered browser proof must confirm those pending states switch only when real scoped rows exist.

## Verification/tests
RUN:
- Read-only protocol/doc inspection.
- Read-only code inspection of `apps/worker/src/legacy-live.ts`, `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and required integration tests.
- Read-only handoff search across `docs/handoffs/*legacy*` for Legacy closed-trade/source/idempotency evidence.
- Read-only local Legacy source inspection of `C:/Users/maxib/GTE BOT/bot/models.py` and `database.py`.
- Read-only text searches for likely closed-trade table/column names (`closed_trades`, `trade_history`, `tradehistory`, `deals`, `fills`, `realized`, `pnl`, `commission`, `funding`, `income`, `closed`) across WTC repo docs/code and the local Legacy source.

NOT RUN:
- `npm test`, Vitest, typecheck, lint, build, Playwright, governance, secret scan - not run because this lane made no code/schema/test change and was scoped to source-model audit plus handoff only.
- `npm run db:migrate` / `db:seed` / managed worker continuity - not run; no DB mutation or runtime acceptance in this lane.
- Live Legacy DB/provider/exchange metadata probes - not run; explicitly forbidden by scope.
- Raw env/secret reads - not run.
- Live bot start/stop/retest/apply-config, SSH/tmux/systemd, deploy, production monitoring - not run and intentionally out of scope.

## Next actions
1. Stop implementation until one of these evidence sources exists: a repo-local Legacy model/migration/table definition for closed trades, an upstream Legacy PR/contract adding a closed-trade endpoint/table, or an operator-approved metadata-only provider schema handoff that names the table and columns without exposing secrets or row data.
2. Exact source-model acceptance requirement before code: table name; ownership/filter column tied to `api_id/pub_id`; stable external trade id; symbol; side; entry price; exit price; size; realized PnL; fee sign convention; funding sign convention; opened/closed timestamps; exit reason semantics; update/replay behavior; retention/backfill window; and a no-secret raw payload allowlist.
3. Exact stop conditions for the next phase: stop if any required source column is absent/ambiguous; stop if only active orders/slots are available; stop if source requires exchange/API probing; stop if only plaintext-key HTTP endpoints expose the data; stop if raw provider rows or credentials would be logged/stored/rendered; stop if provider mapping is zero or multiple active mappings; stop if WTC `botProviderAccountId` cannot be passed into `importBotTrade()`; stop if same-source replay/cross-provider idempotency cannot be tested with fixtures.
4. Once source evidence is proven, implement the smallest importer slice: add a fixture-backed Legacy closed-trade source mapper, import rows with `sourceAdapter: 'legacy-db'` and WTC `botProviderAccountId`, keep raw JSON secret-filtered, and add replay tests for two provider mappings with the same external id plus same-provider duplicate replay.
5. After importer tests pass, run rendered browser proof for Legacy/Tortila settings, statistics, trades/journal, and admin user/bot surfaces on desktop/mobile; only then replace the pending closed-trade copy.
