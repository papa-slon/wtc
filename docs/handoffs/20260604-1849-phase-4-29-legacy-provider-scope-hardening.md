# phase-4-29-legacy-provider-scope-hardening handoff
## Scope
Phase 4.29 hardened the Legacy/provider data-scope layer left open by Phase 4.28:
- admin Legacy fleet aggregation now merges latest provider-scoped metric snapshots instead of deriving fleet facts from one latest raw Legacy snapshot;
- selected-user Legacy runtime warnings stay unscoped unless the selected provider has persisted user-scoped runtime/statistics evidence;
- selected-user admin readiness now labels aggregate `target='worker'` as `Aggregate worker precheck` and does not treat it as selected-user proof;
- focused tests were added/updated for multi-provider fleet aggregation, warning suppression, readiness wording, and nearby continuity/read-safety regression coverage.

Read-only agents were launched before implementation and closed before this report:
- `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`
- `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`
- `docs/handoffs/20260604-1835-selected-user-readiness-ux-auditor.md`

All background agents from this phase were closed/cleaned up.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`
- `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`
- `docs/handoffs/20260604-1835-selected-user-readiness-ux-auditor.md`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `scripts/run-worker-continuity-managed.mjs`
- `package.json`

## Files changed
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`
- `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`
- `docs/handoffs/20260604-1835-selected-user-readiness-ux-auditor.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`

## Findings
1. Severity P1 - Admin Legacy fleet aggregation was vulnerable to under-reporting when multiple provider accounts wrote separate scoped snapshots. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:404-434` now queries recent Legacy metric rows, keeps only the latest row per provider snapshot source, and aggregates `legacyProviderAccounts`, active slots, and active orders through `latestLegacyProviderAccounts()` / scoped runtime sources at `apps/web/src/features/admin/bot-health-loader.ts:248-320`; the new regression `tests/integration/admin-bot-health-loader.test.ts:212` seeds two provider-scoped snapshots and asserts both mapped users and masked pub_id rows. Recommendation: keep admin fleet diagnostics based on latest scoped provider rows, not one global raw JSON row. Target part: admin bot health loader and fleet diagnostics.
2. Severity P1 - Selected-user Legacy warnings could be over-attributed from aggregate runtime health. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:431-458` now requires `hasScopedRuntimeEvidence` before applying Legacy runtime warnings; `apps/web/src/features/admin/user-bot-detail-loader.ts:1209-1238` derives that evidence from selected-user persisted metric/position/trade/equity rows; `tests/integration/admin-user-bot-detail-loader.test.ts:719` asserts runtime warnings stay `runtime_not_scoped` when the selected provider has no persisted evidence. Recommendation: only attribute Legacy runtime warnings after scoped selected-user evidence exists; otherwise show registry/product context only. Target part: admin selected-user warning summary.
3. Severity P1 - User-facing Legacy warning scoping needed the same conservative boundary. Evidence: `apps/web/src/features/bots/data.tsx:549-552` computes `scopedLegacyRuntimeHealth` and only applies runtime detail warnings when the Legacy provider mapping is scoped; `tests/integration/bot-read-safety-static.test.ts` now passes the static guard that requires this boundary. Recommendation: do not treat count-only Legacy health as user safety evidence. Target part: user bot read model.
4. Severity P1 - Selected-user admin readiness wording could make aggregate worker health look like selected-user proof. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:141-158`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:255-258`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:337-341`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:428-433` now use `Aggregate worker precheck`, mention global `target='worker'`, and mark missing scoped evidence as attention; static and E2E text guards were updated at `tests/integration/admin-user-bot-detail-static.test.ts:109-113` and `tests/e2e/admin-user-bot-detail-db.spec.ts:136-137`. Recommendation: keep worker health as fleet/product precheck until combined with selected-user runtime and statistics rows. Target part: selected-user admin drilldown.
5. Severity P2 - Provider-aware closed-trade import idempotency remains intentionally open. Evidence: the tests auditor called for same `externalTradeId` across provider accounts in `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`; existing nearby worker coverage still passes in `tests/integration/legacy-provider-worker.test.ts`, but this phase did not add the DB migration/repository invariant. Recommendation: implement a dedicated DB migration and regression next, preferably separate uniqueness for unscoped imports and provider-scoped imports. Target part: `bot_trade_imports`, repository import behavior, Legacy closed-trade import readiness.

## Decisions
- Kept this phase focused on read/data-scope and selected-user proof semantics; no live bot start/stop/apply-config, exchange ping, provider probe, deploy, SSH, tmux, systemd, or raw secret/env read was added.
- Chose conservative warning attribution: Legacy health can remain visible as fleet context, but selected-user runtime warnings require selected-user persisted rows.
- Renamed selected-user worker language to `Aggregate worker precheck` instead of changing global user-side readiness labels that still intentionally describe the platform worker heartbeat.
- Did not implement provider-aware trade idempotency in this phase because it needs a DB migration and conflict-invariant decision, which should be isolated and tested as the next slice.
- Did not run managed worker continuity because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not set in this session.

## Risks
- Full `/goal` is still not complete. Legacy/Tortila settings, statistics, readiness, and admin surfaces are substantially built, but final DB migration, rendered visual proof, managed continuity, and Tortila parity acceptance remain.
- The worktree remains heavily dirty with many pre-existing modified/untracked WTC files from previous phases. This handoff reports the Phase 4.29 scope only and does not certify unrelated files.
- Provider-aware trade import idempotency is still a P1/P2 follow-up before Legacy closed-trade analytics can be called production-ready.
- Managed worker continuity could not be freshly observed because the required admin Postgres URL is missing. The local fixture/regression tests passed, but that is not the same as managed DB continuity acceptance.
- Admin-user DB Playwright matrix was not run; static/E2E text expectations were updated, but rendered DB matrix proof still needs the opt-in admin DB URL.

## Verification/tests
RUN:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-statistics-completion.test.ts` - PASS, 4 files / 26 tests.
- `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/legacy-provider-worker.test.ts` - PASS, 5 files / 48 tests.
- `npm run typecheck -w @wtc/web` - PASS.
- `git diff --check` - PASS.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
- `WORKER_CONTINUITY_ADMIN_DATABASE_URL` presence check - observed missing; no URL value printed.

NOT RUN:
- `npm run typecheck` - not run; scoped web typecheck was run.
- `npm run typecheck -w @wtc/worker` - not run; worker code was not changed in this phase.
- `npm run lint` - not run; focused static/integration tests plus typecheck were run.
- `npm run build -w @wtc/web` - not run.
- `npx playwright test ...` / `npm run e2e:admin-user-bots:db:managed:matrix` - not run; the opt-in admin-user DB URL is not configured and no browser session was started in this phase.
- `npm run accept:worker:continuity` - not run; requires configured DB/runtime environment.
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is missing.
- Provider-aware trade idempotency migration/regression - not run/implemented; deferred as next DB slice.
- Live bot start/stop/apply-config, exchange/provider reachability probe, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and intentionally out of scope.

## Next actions
1. Start Phase 4.30 with read-only agents first, focused on provider-aware trade import idempotency and Legacy closed-trade readiness.
2. Add DB migration/repository behavior so the same `externalTradeId` can be safely handled per Legacy provider account while exact same-provider duplicates stay idempotent.
3. Run the focused DB/import regression plus the existing Legacy provider worker tests.
4. After the DB slice, run rendered browser proof for Legacy/Tortila settings/statistics/admin pages across desktop/mobile.
5. Run managed worker continuity and admin-user DB matrix only after operator-approved throwaway/admin Postgres URLs are provided.
