# phase-4-31-legacy-closed-trade-source-audit handoff
## Scope
Phase 4.31 closed the Legacy closed-trade importer question after Phase 4.30 made the WTC destination idempotency contract provider-aware. Scope was read-only source proof, importer feasibility, and tests/UX acceptance boundaries.

This phase did not implement a Legacy closed-trade importer. The phase outcome is a scoped stop condition: WTC can safely store provider-scoped imported trades, but the local Legacy source does not prove a durable closed-trade/fill source yet. Do not derive performance statistics from inactive orders or slots.

Read-only agents launched before any phase write:
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`

All background agents for this phase were closed after their results were collected.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `C:/Users/maxib/GTE BOT/bot/models.py`
- `C:/Users/maxib/GTE BOT/bot/database.py`
- `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/routes/api_management.py`

## Files changed
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`

## Findings
1. Severity P1 - The local Legacy source does not prove a durable closed-trade/fill model. Evidence: `C:/Users/maxib/GTE BOT/bot/models.py` defines account, order, settings, stage, and slot state; `Order` lacks realized PnL, fees, funding, trade-level opened/closed timestamps, and stable closed-trade/fill identity; `close_slot()` and order toggles only mark runtime state inactive. Recommendation: do not build a Legacy closed-trade importer from inactive `orders` or `slots`. Target part: Legacy source model.
2. Severity P1 - Current WTC Legacy ingestion intentionally reads safe runtime state, not trade history. Evidence: `apps/worker/src/legacy-live.ts` reads provider accounts, symbol settings, stage configs, active slots, active orders, metrics, and position snapshots; it emits `no_trade_history` and sets metric trade count/closed PnL unavailable. Recommendation: keep the worker in runtime-snapshot mode until source proof exists. Target part: Legacy worker.
3. Severity P1 - Phase 4.30 completed the WTC destination invariant, not source ingestion. Evidence: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and `packages/db/migrations/0021_complete_pepper_potts.sql` now support provider-scoped idempotency for imported trades. Recommendation: treat `bot_trade_imports` plus `importBotTrade()` as ready to receive proven source rows, not as evidence that Legacy can produce them. Target part: DB/import contract.
4. Severity P1 - Provider scoping must use WTC `bot_provider_accounts.id`; raw Legacy `pub_id` remains a source filter only. Evidence: Phase 4.30 tests prove same external id across mapped provider accounts can be imported independently, and repository audit metadata records WTC UUID/null scope only. Recommendation: any future Legacy importer must pass `botProviderAccountId: providerAccount.id` and must not expose raw provider ids in UI, audit, or logs. Target part: scoped import mapper.
5. Severity P1 - Legacy performance UI must remain pending while source proof is absent. Evidence: current UI copy says `pending import`, `Legacy closed-trade history pending`, `closed trade imports pending`, and hides win rate, profit factor, realized PnL, and attribution for Legacy when no imported closed trades exist. Recommendation: preserve these labels until provider-scoped imported trades are produced by a real source-backed importer. Target part: user/admin statistics.
6. Severity P2 - User/admin UI already has partial positive branches for imported trade counts, but one user command-center label remains hardcoded pending for Legacy. Evidence: `apps/web/src/features/bots/statistics-panels.tsx` can flip based on `closedTradeCount`, admin selected-user cards can show imported trade counts, while `apps/web/src/app/(app)/app/bots/statistics/page.tsx` still forces Legacy `pnlLabel` to `closed trade imports pending`. Recommendation: after source-backed import exists, update command-center copy and tests to assert both pending and loaded branches. Target part: future UI acceptance.

## Decisions
- Legacy closed-trade importer implementation is blocked on source evidence and was not implemented.
- Inactive Legacy orders/slots are not accepted as canonical closed trades.
- WTC provider-aware trade idempotency from Phase 4.30 remains the required destination contract for any future importer.
- Legacy UI stays honest: snapshot/projection status is allowed; performance analytics stay pending/unavailable until real provider-scoped imported trades exist.
- No live DB/provider/exchange probes, env/secret reads, live bot control, SSH/tmux/systemd/deploy, or managed DB mutations were performed.
- All Phase 4.31 background agents were closed before this aggregate report.

## Risks
- Deriving analytics from inactive order/slot state would fabricate win rate, profit factor, realized PnL, fees, and exit attribution.
- Live Legacy DB could contain a table that is absent from local source, but proving that requires a separate operator-approved metadata-only discovery phase with no row data and no secrets.
- If future import uses exchange history directly from WTC, it may cross the current no-provider/no-exchange-probe safety boundary and needs a separate audited adapter plan.
- `docs/DATA_MODEL.md` may still contain older provider-unaware trade uniqueness wording; schema and Phase 4.30 are newer and should be reconciled in a docs cleanup.

## Verification/tests
RUN:
- Read-only per-agent source audit.
- Read-only per-agent importer feasibility audit.
- Read-only per-agent tests/UX acceptance audit.
- Local source inspection of the Legacy bot model/control files.
- Handoff aggregation with exact agent artifact links.

NOT RUN:
- Vitest/typecheck/lint/build/Playwright/browser proof - no code or test implementation was made in this phase.
- `npm run db:migrate`, managed DB worker continuity, admin-user DB Playwright matrix - no live/managed DB mutation or opt-in DB acceptance in this phase.
- Live Legacy DB/provider/exchange probes - source discovery was repo/local-source only.
- Raw env/secret reads - explicitly not run.
- Live bot start/stop/apply-config - forbidden until adapter/security gates approve control actions.

## Next actions
1. Continue WTC completion on non-blocked slices: rendered proof, admin/user acceptance matrices, Tortila parity, and gate consolidation.
2. Before implementing Legacy closed-trade import, obtain one source-proof artifact: repo-local Legacy model/migration, upstream Legacy contract/PR, or operator-approved metadata-only provider schema handoff.
3. Required future source fields: provider filter tied to mapped `pub_id`, stable external trade/fill id, symbol, side, size, entry price, exit price, realized PnL, fees, funding policy, opened timestamp, closed timestamp, exit reason, retention/backfill window, replay semantics, and raw payload allowlist.
4. Future implementation gate after source proof: fixture-backed source mapper, two-provider same-external-id replay test, secret scan, worker typecheck, root typecheck, governance check, and rendered user/admin statistics proof.
