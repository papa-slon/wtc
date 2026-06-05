# legacy-closed-trade-tests-ux-auditor handoff
## Scope
Phase 4.31 read-only tests/UX acceptance audit for the Legacy closed-trade completion boundary. Scope: if Legacy closed-trade import becomes available, identify the tests and UI labels that must change so Legacy statistics no longer say pending; if the source model is still unknown, identify the copy and gates that must remain pending. No implementation, no browser, no live services.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - User Legacy statistics already have a count-based positive path, but the command-center PnL label is still hardcoded pending for Legacy. Evidence: `apps/web/src/features/bots/statistics-panels.tsx:587-595` flips the Legacy closed-trade metric and status pill when `closedTradeCount > 0`; `apps/web/src/features/bots/statistics-panels.tsx:605-609` shows the pending warning only when `closedTradeCount === 0`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:532-537` passes closed trades by filtering `trade.closedAt !== null`; but `apps/web/src/app/(app)/app/bots/statistics/page.tsx:457-459` still forces `pnlLabel` to `closed trade imports pending` for every Legacy render. Recommendation: after source-model and worker-import proof, derive a `legacyClosedTradeCount` once and make command-center PnL copy conditional: count 0 keeps `closed trade imports pending`; count > 0 shows real closed/net PnL from the imported-trade-backed metrics. Target part: user statistics command-center copy.
2. Severity P1 - Selected-user admin statistics can already flip away from pending when provider-scoped trades exist, but rendered tests should assert that positive state explicitly. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57-60` returns `pending import` only when Legacy `bot.trades.length === 0`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:139-144` changes Legacy from `operational evidence present` to `evidence present` once trades exist and worker/runtime gates are OK; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:183-189` changes the coverage row from `pending import` to `${n} imported trades`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:811-818` keeps Closed-trade history / Imported trades pending only for zero Legacy trades. Recommendation: once import is proven, the admin UI acceptance must assert numeric Imported trades, non-pending Closed-trade history, `Closed-trade history` coverage state like `1 imported trades`, and `Analytics status` = `evidence present` only when worker/runtime are fresh. Target part: selected-user admin statistics card and coverage matrix.
3. Severity P1 - The source model is still unknown; direct repository fixtures prove loader/render behavior, not provider import availability. Evidence: Phase 4.30 says it implemented only the DB/repository/test idempotency invariant and not a Legacy closed-trade source reader at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:60-62`; it records Legacy source ingestion as NOT RUN at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:87-92`; its next action is to identify the real provider DB closed-trade table, stable external id, PnL/fee/funding columns, and safe mapped-`pub_id` filters at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:95-98`. The current loader test directly inserts a scoped Legacy trade with `importBotTrade` at `tests/integration/admin-user-bot-detail-loader.test.ts:390-407` and then verifies the admin loader returns it at `tests/integration/admin-user-bot-detail-loader.test.ts:539-545`. Recommendation: until the provider source model is audited, keep Legacy performance UI pending and treat direct DB fixtures as scoped-rendering coverage only. Target part: Legacy closed-trade source acceptance boundary.
4. Severity P2 - The static completion test currently pins pending Legacy copy; after import proof it should assert both branches and prevent a permanent hardcoded pending state. Evidence: `tests/integration/bot-statistics-completion.test.ts:25-35` asserts `pending import`, `Legacy closed-trade history pending`, and hidden PF/win/PnL copy; `tests/integration/bot-statistics-completion.test.ts:38-48` asserts admin pending and non-fabrication copy. Recommendation: if import becomes available, update this test to assert the branch predicates and loaded labels too: `closedTradeCount > 0 ? closedTradeCount : 'pending import'`, `closed imports available`, `closed trades loaded`, the warning guarded by `closedTradeCount === 0`, and a non-hardcoded Legacy `pnlLabel` path. If the source model remains unknown, leave these pending assertions in place. Target part: `tests/integration/bot-statistics-completion.test.ts`.
5. Severity P2 - The rendered admin DB e2e already has a positive imported-trade fixture, but it does not yet guard against stale pending copy inside the Legacy card. Evidence: the fresh-green scenario expects `statisticsLabel: 'evidence present'` at `tests/e2e/admin-user-bot-detail-db.spec.ts:52-68`; common visible markers include `USER_A_LEGACY_TRADE_SOURCE` at `tests/e2e/admin-user-bot-detail-db.spec.ts:130-146`; the assertion loop checks generic visible markers at `tests/e2e/admin-user-bot-detail-db.spec.ts:256-270`. Recommendation: after import proof, add Legacy-card-scoped rendered assertions for no `pending import` in the fresh-green positive fixture, visible `Closed-trade history`, visible `Imported trades`, visible provider-account `Stats scope`, and continued no-leak checks. Keep stale/degraded scenarios from going green when worker/runtime freshness is not OK. Target part: `tests/e2e/admin-user-bot-detail-db.spec.ts`.

## Decisions
- No code or test implementation was performed in this auditor lane.
- No browser or Playwright run was performed because the prompt forbids browser use unless asked.
- If the Legacy closed-trade source model is unknown, the following copy must remain: `pending import`, `closed trades pending`, `PF, win rate, realized PnL pending`, `Legacy closed-trade history pending`, and command-center `closed trade imports pending`.
- If the source model and worker importer are proven, pending copy may flip only for provider-scoped imported trades tied to the WTC provider-account UUID, not raw `pub_id` and not unscoped/fleet rows.

## Risks
- A synthetic `importBotTrade` fixture can make admin UI look complete while the real Legacy provider source remains unknown.
- If trade rows import before metric aggregation is updated, UI may correctly show an imported-trade count while PnL/win/PF are still `not reported`; do not replace that with fabricated analytics.
- If the future importer passes raw `pub_id` or omits `botProviderAccountId`, Phase 4.30's provider-aware idempotency and user-scope guarantees can be bypassed.
- A global "body does not contain pending import" e2e assertion would be brittle; assertions should be scoped to the positive Legacy bot card/scenario.

## Verification/tests
RUN:
- Read-only protocol/doc inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/implemented/next-actions docs.
- Read-only source inspection of the requested UI, integration, e2e, and Phase 4.30 handoff files.
- `git status --short --branch` for start-state awareness; large dirty tree was pre-existing and untouched.

NOT RUN:
- `npx vitest run tests/integration/bot-statistics-completion.test.ts` - not run; no implementation in this read-only auditor lane.
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts` - not run; no implementation in this read-only auditor lane.
- `npm run e2e:admin-user-bots:db:managed:matrix` / Playwright rendered DB matrix - not run; browser forbidden unless asked and opt-in DB/browser acceptance is outside this lane.
- Legacy closed-trade source ingestion / worker import test - not run; source model and importer are still not implemented/proven in this lane.
- Live bot start/stop/apply-config, exchange/provider probes, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and out of scope.

## Next actions
1. First prove the source model: real Legacy closed-trade table, stable external id, close time, realized PnL, fee, funding, side/size/entry/exit fields, and safe filters by mapped provider `pub_id`.
2. Add worker/import regression only after that proof: import two provider mappings with the same external trade id as two scoped rows on first run and zero new rows on replay; pass `botProviderAccountId` into `importBotTrade`.
3. Update `tests/integration/bot-statistics-completion.test.ts` to cover both pending and loaded branches, including removal of hardcoded Legacy command-center PnL pending copy.
4. Extend `tests/integration/admin-user-bot-detail-loader.test.ts` around its scoped Legacy trade fixture to assert latest trade evidence, provider scope, no unscoped/fleet leakage, and source-adapter visibility without raw provider ids.
5. Extend `tests/e2e/admin-user-bot-detail-db.spec.ts` fresh-green scenario with Legacy-card-scoped non-pending assertions; keep degraded/stale/missing scenarios from reporting full analytics readiness.
6. Gates for the implementation phase: run `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`, the worker/source import Vitest added by that phase, `npm run typecheck`, `git diff --check`, `npm run secret:scan`, and only then the managed admin-user DB Playwright matrix if its opt-in DB URL is available.
