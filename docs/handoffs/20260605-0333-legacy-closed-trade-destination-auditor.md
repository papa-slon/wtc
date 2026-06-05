# legacy-closed-trade-destination-auditor handoff
## Scope
Read-only WTC Phase 4.47 audit of the existing destination/import contract for Legacy closed-trade imports. Objective: identify the smallest safe implementation slice if, and only if, a durable Legacy closed-trade/fill source is later proven.

Safety boundaries observed: no `.env` or secret reads, no live service/provider/exchange calls, no DB mutation, no server/bot control, and no product/source/test/docs edits beyond this required handoff artifact.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DATA_MODEL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/legacy-live.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`

## Files changed
None - read-only audit. Only this required handoff artifact was written.

## Findings
1. Severity P1 - WTC already has a closed-trade destination contract, but it is only a sink, not Legacy source proof. Evidence: `docs/DATA_MODEL.md:522` documents `bot_trade_imports` for imported immutable closed trades; `docs/DATA_MODEL.md:534` requires WTC `bot_provider_account_id`; `docs/DATA_MODEL.md:535` through `docs/DATA_MODEL.md:548` name `external_trade_id`, `symbol`, `side`, entry/exit prices, size, realized PnL, fees, funding, opened/closed timestamps, exit reason, source adapter, and raw JSON; the schema implements those columns at `packages/db/src/schema.ts:565` through `packages/db/src/schema.ts:584`. Recommendation: do not add a destination migration for Legacy unless source proof reveals a missing concept; map proven Legacy rows into the existing contract. Target part: `bot_trade_imports`.

2. Severity P1 - Replay/idempotency is provider-aware and must be preserved by any Legacy importer. Evidence: `docs/DATA_MODEL.md:552` through `docs/DATA_MODEL.md:560` document scoped and unscoped unique indexes; `packages/db/src/schema.ts:588` through `packages/db/src/schema.ts:596` implement those indexes; `importBotTrade()` inserts once and returns `{ inserted: false }` for duplicates at `packages/db/src/repositories.ts:2239` through `packages/db/src/repositories.ts:2267`. Recommendation: call `importBotTrade()` with WTC `botProviderAccountId`, stable `externalTradeId`, and `sourceAdapter: 'legacy-db'`; test exact replay as no-op and the same external id under a different WTC provider account as distinct. Target part: importer idempotency.

3. Severity P1 - The provider filter pattern exists for current Legacy snapshots, but it covers live settings/slots/orders only. Evidence: `bot_provider_accounts.providerAccountId` is documented as Legacy `Api_Key.pub_id` at `packages/db/src/schema.ts:152` through `packages/db/src/schema.ts:155`; active mappings are selected by `productCode`, `provider`, and `status` at `packages/db/src/repositories.ts:1884` through `packages/db/src/repositories.ts:1900`; the worker filters Legacy rows by `pub_id = ${apiId}` at `apps/worker/src/legacy-live.ts:333` through `apps/worker/src/legacy-live.ts:349` and loops mapped provider accounts at `apps/worker/src/legacy-live.ts:536` through `apps/worker/src/legacy-live.ts:558`. Recommendation: a future closed-trade reader must use the same mapped provider-account loop and provider filter; never import fleet-wide closed rows without a mapped WTC provider account. Target part: source reader/import scope.

4. Severity P1 - Current Legacy worker state intentionally says closed-trade history is absent. Evidence: current worker row types and queries cover active orders with `api_id`, `position`, `position_side`, `note`, `price`, `quantity`, and `active` only at `apps/worker/src/legacy-live.ts:83` through `apps/worker/src/legacy-live.ts:91` and `apps/worker/src/legacy-live.ts:376` through `apps/worker/src/legacy-live.ts:380`; snapshot metrics leave closed PnL, fees, funding undefined and set `tradeCount: 0` at `apps/worker/src/legacy-live.ts:416` through `apps/worker/src/legacy-live.ts:431`; warnings include `no_trade_history` at `apps/worker/src/legacy-live.ts:313` through `apps/worker/src/legacy-live.ts:315` and are asserted at `tests/integration/legacy-live-worker-static.test.ts:159` through `tests/integration/legacy-live-worker-static.test.ts:161`. Recommendation: keep Legacy closed analytics pending; do not derive closed trades from inactive orders, slots, TP/SL order state, or approximate positions. Target part: Legacy worker/product truth.

5. Severity P1 - A source-proof artifact remains the hard gate before implementation. Evidence: Phase 4.39 found no durable local Legacy closed-trade/fill source with realized PnL, fees, funding, timestamps, or fill identity at `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:44` through `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:56`; `docs/NEXT_ACTIONS.md:61` through `docs/NEXT_ACTIONS.md:65` says not to implement until source proof names the table/API and fields. Recommendation: require proof for stable trade id, provider filter, symbol, side, qty/size, entry and exit prices, realized PnL, fees/funding, opened and closed timestamps, exit reason, replay/idempotency semantics, and a raw-payload allowlist. Target part: Legacy source proof gate.

6. Severity P2 - `rawJson` is available but not self-sanitizing, so the mapper must enforce a bounded allowlist. Evidence: `BotTradeImportInput.rawJson` accepts `Record<string, unknown>` at `packages/db/src/repositories.ts:2233` through `packages/db/src/repositories.ts:2237`; current worker safety only guards selected rows against secret-shaped fields at `apps/worker/src/legacy-live.ts:143` through `apps/worker/src/legacy-live.ts:150`; static tests assert no `select *` and no credential-column selection at `tests/integration/legacy-live-worker-static.test.ts:164` through `tests/integration/legacy-live-worker-static.test.ts:180`. Recommendation: the smallest safe slice must include `sanitizeLegacyClosedTradeRaw()` with an explicit allowlist, never raw provider row dumps, DSNs, credential fields, headers, auth tokens, or unbounded payloads. Target part: importer raw-payload safety.

7. Severity P2 - The smallest safe implementation slice after source proof is mapper-first, fixture-backed, and migration-free. Evidence: Phase 4.39 already directs a mapper in `apps/worker/src/legacy-live.ts`, `importBotTrade()`, and replay tests at `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:111` through `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:119`; the repository input already accepts the required destination fields at `packages/db/src/repositories.ts:2233` through `packages/db/src/repositories.ts:2247`. Recommendation: implement only a pure source-row-to-`BotTradeImportInput` mapper, raw allowlist sanitizer, fixture tests, and an import call inside the existing mapped provider-account worker path once source proof exists; postpone UI "loaded" states until imports are proven. Target part: future implementation slice.

## Decisions
- No destination schema change is recommended for Phase 4.47 based on current evidence.
- Legacy closed-trade import remains blocked until a source-proof artifact names the source table/API and all required fields.
- Required mapper fields are: stable trade id as `externalTradeId`, mapped provider filter, WTC `botProviderAccountId`, `symbol`, normalized `side`, `qty`/`size`, entry/exit prices, realized PnL, fees, funding, opened/closed timestamps, optional bounded `exitReason`, `sourceAdapter: 'legacy-db'`, and sanitized allowlisted `rawJson`.
- Replay rule: `(botInstanceId, botProviderAccountId, externalTradeId, sourceAdapter)` inserts once; exact replay is a no-op; the same external id under a different WTC provider account is distinct.
- Active orders, inactive orders, slots, TP/SL order markers, and approximate positions are not valid Legacy closed-trade imports.

## Risks
- A future importer could accidentally fabricate performance by treating order or slot lifecycle as realized trade history.
- Importing without WTC `botProviderAccountId` would collapse provider-scoped replay semantics into the unscoped path.
- `rawJson` can leak secrets or provider internals unless the mapper uses an allowlist and bounded payload shape.
- A source may provide fees/funding with ambiguous signs; source proof must define the sign policy before import.
- Hard-deleting provider-account mappings can null historical scoped imports because the destination FK uses `ON DELETE SET NULL`; durable identity policy should be considered before production import.

## Verification/tests
RUN:
- Read-only inspection of the requested files.
- Static line-level contract check of `bot_trade_imports`, `importBotTrade()`, Legacy provider scoping, current worker warnings, and existing Legacy worker tests.
- Branch/status check only; no mutation or cleanup performed.

NOT RUN:
- Vitest, typecheck, lint, build, Playwright, browser proof - not run because this was a read-only contract audit with no product/test code changes.
- `npm run db:migrate`, DB writes, managed DB runners, worker continuity, live Legacy DB/provider/exchange probes, SSH/tmux/systemd, deploy, production monitoring, and bot start/stop/apply-config - not run by scope and safety boundaries.
- Legacy closed-trade importer - not implemented because source proof is still absent.

## Next actions
1. Obtain a source-proof artifact that names the Legacy table/API, provider filter, stable trade/fill id, symbol, side, qty/size, entry/exit prices, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason semantics, replay/backfill semantics, and raw-payload allowlist.
2. After source proof, add a pure mapper plus sanitizer in `apps/worker/src/legacy-live.ts` that returns `BotTradeImportInput` and rejects missing required fields.
3. Add fixture-backed tests for required-field validation, provider filtering, raw-payload allowlist/secret exclusion, exact replay no-op, and same external id under two WTC provider accounts.
4. Wire the importer only inside the existing mapped `legacy_bot`/`legacy-db` provider-account worker loop, then run local mock/no-live acceptance before any managed or live-source phase.
