# ecosystem-tests-runner handoff
## Scope
Phase 3.75 admin user bot statistics drilldown test audit for `/admin/users/[userId]/bots`.

Audited current tests and code for focused coverage of admin read-only positions, trades, and equity:
loader isolation, no cross-user leakage, no rawJson/secrets/full provider pub ids, page mutation-control absence, and build/typecheck/mobile readiness. This lane was read-only for product code and did not run live provider probes, live bot controls, SSH, tmux, systemd, exchange pings, provider DB reads outside local tests, or `.env` reads.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `playwright.config.ts`
- `package.json`
- `apps/web/package.json`

## Files changed
None - read-only audit. Handoff only: `docs/handoffs/20260603-1943-admin-bot-stats-tests-auditor.md`.

## Findings
1. Severity: High. Evidence: `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md:56` and `:76` explicitly leave admin positions/trades/equity unimplemented, with Phase 3.75 named as the next action at `:80`. Current admin types expose only `AdminUserBotMetricSummary` and `latestMetric` (`apps/web/src/features/admin/types.ts:39`, `:75`, `:89`, `:93`); the loader selects only `schema.botMetricSnapshots` (`apps/web/src/features/admin/user-bot-detail-loader.ts:337`-`:351`) and maps one latest metric (`:385`, `:419`); the page renders wallet equity and trade count only from that metric (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:200`-`:202`). Recommendation: do not accept Phase 3.75 as covered until admin DTOs and tests include read-only positions, closed trades, and an equity series. Target part: admin selected-user bot statistics.
2. Severity: High. Evidence: DB storage already has provider-aware indexes for metrics, positions, and trades (`packages/db/src/schema.ts:476`, `:504`, `:534`), and the user-facing DB read model filters Legacy rows by active provider account (`apps/web/src/features/bots/data.tsx:348`-`:355`, `:417`-`:419`). The current admin loader applies provider-account filtering only to latest metrics (`apps/web/src/features/admin/user-bot-detail-loader.ts:391`), while generic DB list helpers return positions/trades by `botInstanceId` only (`packages/db/src/repositories.ts:1885`-`:1886`, `:1908`-`:1909`). Recommendation: when Phase 3.75 adds admin stats rows, query with selected user + bot instance and require active Legacy `botProviderAccountId` equality; exclude null/fleet Legacy rows and other users. Target part: loader isolation/no cross-user leakage.
3. Severity: Medium. Evidence: current admin loader test proves non-mutating summary isolation with table counts (`tests/integration/admin-user-bot-detail-loader.test.ts:30`-`:49`, `:262`-`:264`) and leak sentinels for user B, secrets, raw config/history, and full pub ids (`:346`-`:367`), but it seeds/asserts only metric snapshots (`:218`-`:254`) and has no admin fixture for `schema.botPositionSnapshots` or `schema.botTradeImports`. Static coverage likewise checks only `schema.botMetricSnapshots` for this loader (`tests/integration/admin-user-bot-detail-static.test.ts:26`). Recommendation: extend the admin PGlite test with target-user Tortila rows, target-user Legacy provider-scoped rows, same-user Legacy null/fleet rows, and other-user rows for positions/trades/equity, with rawJson/pub-id/secret sentinels that must not serialize. Target part: focused integration coverage.
4. Severity: Medium. Evidence: the page currently advertises disabled live control and read-only user settings/provider mappings (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:52`-`:54`), and the static test blocks old mutation controls such as `Map Legacy pub_id`, submit forms, start/stop, and apply-config strings (`tests/integration/admin-user-bot-detail-static.test.ts:62`-`:69`). The page copy also says it does not create, disable, edit, or control open positions (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:222`). Recommendation: keep those assertions and add Phase 3.75-specific checks that the new position/trade/equity panels have no close-position, cancel-order, start/stop, retest, apply-config, raw export, or submit controls. Target part: page mutation-control absence.
5. Severity: Medium. Evidence: mobile e2e includes `/admin/users/demo-user/bots` (`tests/e2e/admin-mobile-pg8.spec.ts:20`-`:23`) and checks heading, mobile nav, storage pill, and no horizontal scroll (`:42`-`:56`), but it does not assert stats panels or mutation-control absence. It also writes screenshots to `tests/e2e/screenshots/*-mobile375.png` (`:18`, `:58`) and starts a local Next dev server with `.next-e2e` (`playwright.config.ts:27`-`:37`). Recommendation: after Phase 3.75 product changes, run the mobile gate in the aggregate/operator lane and add assertions for positions/trades/equity panel presence at 375px plus absence of mutation controls. Target part: mobile/build acceptance.

## Decisions
1. Current green admin drilldown tests cover the Phase 3.74 summary-only surface, not Phase 3.75 positions/trades/equity.
2. The safest Phase 3.75 acceptance shape is a PGlite loader test plus a static page test first, then build and mobile e2e in the aggregate lane after implementation.
3. Admin stats must be snapshot-backed only. No live adapter, provider DB, exchange, bot-control, or `.env` probe is needed or acceptable for this drilldown.
4. Legacy admin stats require active WTC provider mapping before rows become selected-user facts; unmapped/null provider rows stay fleet diagnostics.

## Risks
1. The worktree was already substantially dirty before this audit, including the admin drilldown route/tests and adjacent bot/admin files. This audit did not revert or edit any product code.
2. Current tests can pass while Phase 3.75 remains unimplemented because they do not require admin position rows, closed trade rows, or an equity series.
3. Reusing generic `listBotPositionSnapshots` or `listBotTradeImports` directly in admin user detail would risk Legacy fleet/null-provider leakage unless an admin-specific provider filter is added.
4. Build and mobile e2e were not run in this handoff-only lane because they write local artifacts; the operator should run them after the product implementation is present.

## Verification/tests
RUN:
1. Required docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`.
2. Static/source audit with `rg` over admin loader/page/types, DB schema/repositories, user-facing bot read model, admin detail tests, admin mobile e2e, and Phase 3.74 handoff.
3. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 2 files, 6 tests.
4. `npm run typecheck` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `git status --short --branch` inspected before and after; product-code dirty state was pre-existing and left untouched.

NOT RUN:
1. `npm run build -w @wtc/web` - skipped because Next build writes local build artifacts and this lane was constrained to handoff-only file changes.
2. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - skipped because the spec starts a local dev server and writes screenshot files; also, the Phase 3.75 stats panels are not present yet, so the current spec would only re-prove the older shell/readability check.
3. `npm run lint`, `npm run secret:scan`, full `npm test`, and full `npm run ci:local` - skipped because this was a focused tests-runner audit with no product code edits; run these in the aggregate implementation lane.
4. DB migration apply/push/seed against live services - skipped because this audit used no DB outside local PGlite tests and did not add migrations.
5. Live Legacy/Tortila bot start/stop/retest/apply-config, exchange ping, SSH, tmux, systemd, worker restart, `.env` reads, provider DB live reads, and other live probes - forbidden by scope and not run.

## Next actions
1. Implement Phase 3.75 admin DTOs for `positions`, `trades`, and `equityCurve` under `apps/web/src/features/admin/user-bot-detail-loader.ts` and `apps/web/src/features/admin/types.ts`; keep rawJson, sealed secrets, config history JSON, password hashes, and full provider pub ids out of the DTO.
2. Extend `tests/integration/admin-user-bot-detail-loader.test.ts` with PGlite fixtures for target Tortila rows, target Legacy provider-scoped rows, same-user Legacy null/fleet rows, and other-user rows across metrics/positions/trades/equity. Assert table counts unchanged and serialized output excludes rawJson, secret sentinels, full pub ids, user B ids, and unmapped Legacy fleet rows.
3. Extend `tests/integration/admin-user-bot-detail-static.test.ts` to require new read-only panel labels/tables and to reject mutation controls specific to stats rows, including close/cancel/start/stop/retest/apply-config/export-raw/submit controls.
4. Extend `tests/e2e/admin-mobile-pg8.spec.ts` or a dedicated admin detail mobile spec to assert stats panels fit at 375px and remain read-only, then run it after implementation.
5. After implementation, recommended gates: focused admin vitest, `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/bot-statistics-static.test.ts`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, and mobile admin Playwright.
