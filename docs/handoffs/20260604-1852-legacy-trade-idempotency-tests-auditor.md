# legacy-trade-idempotency-tests-auditor handoff
## Scope
Phase 4.30 read-only tests/acceptance audit for provider-aware Legacy closed-trade import idempotency after Phase 4.29.

Goal: identify exact regressions to add, existing tests to run, and enough/non-enough gates for the next DB migration slice without implementing code, touching live DB/provider/exchange systems, or reading raw secrets/env values.

This is the single per-agent auditor artifact requested by the operator. No N-agent audit claim is made; no background agents were spawned by this auditor, so none required cleanup.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`
- `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `package.json`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/package.json`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - Provider-aware trade import idempotency is still not encoded in the DB invariant. Evidence: `bot_trade_imports` gained nullable `bot_provider_account_id` in migration `packages/db/migrations/0018_provider_snapshot_scope.sql:4` and schema `packages/db/src/schema.ts:569-571`, but the current unique index remains provider-unaware at `packages/db/src/schema.ts:587-588` and original migration `packages/db/migrations/0002_sour_paibok.sql:266`. `importBotTrade` still documents idempotency as `(botInstanceId, externalTradeId, sourceAdapter)` at `packages/db/src/repositories.ts:2239-2240` and uses bare `.onConflictDoNothing()` at `packages/db/src/repositories.ts:2243-2247`. Recommendation: replace the single provider-unaware invariant with two deliberate partial unique rules: unscoped uniqueness on `(bot_instance_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NULL`, and scoped uniqueness on `(bot_instance_id, bot_provider_account_id, external_trade_id, source_adapter)` where `bot_provider_account_id IS NOT NULL`. Target part: `bot_trade_imports`, migrations, Drizzle schema, `importBotTrade`.

2. Severity P1 - The primary regression belongs in `tests/integration/db-0002.test.ts`, because current coverage only proves one unscoped duplicate. Evidence: `tests/integration/db-0002.test.ts:34-39` applies all migrations to PGlite before tests, and the only trade idempotency assertion at `tests/integration/db-0002.test.ts:118-125` imports one unscoped Tortila trade twice and expects `inserted:false` on replay. Prior Phase 4.29 auditors already identified the same gap at `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md:42` and `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md:47`. Recommendation: add `it('importBotTrade scopes idempotency by Legacy provider account')` immediately after the existing unscoped idempotency test. Exact expected assertions: provider A insert returns `true`; replay for provider A returns `false`; provider B with the same `botInstanceId`, `externalTradeId`, and `sourceAdapter` but a different `botProviderAccountId` returns `true`; querying `schema.botTradeImports` for that `botInstanceId` / `externalTradeId` / `sourceAdapter` returns exactly two rows with the two provider account ids. Also extend the existing unscoped test to assert row count remains exactly one, so a nullable composite unique regression cannot make `NULL` replays duplicate. Target part: `tests/integration/db-0002.test.ts`.

3. Severity P1 - A worker-level Legacy trade regression should not be claimed until the Legacy live worker actually reads/imports closed trades. Evidence: `LegacyLiveSnapshotResult` reports accounts/settings/positions/provider scope but no trade counts at `apps/worker/src/legacy-live.ts:8-17`; `snapshotLegacyRowsToWtc` imports only `insertBotMetricSnapshot` and `insertBotPositionSnapshot` at `apps/worker/src/legacy-live.ts:393-403`, writes metrics at `apps/worker/src/legacy-live.ts:416-448`, and writes positions at `apps/worker/src/legacy-live.ts:450-466`. The provider loop totals accounts/settings/positions only at `apps/worker/src/legacy-live.ts:542-567` and records `positionsSnapshotted` at `apps/worker/src/legacy-live.ts:594-600`. Recommendation: keep `tests/integration/legacy-provider-worker.test.ts` as an adjacent existing gate now; add a new worker regression only when the Legacy source row model gains closed-trade rows and the worker imports them. Exact future test: seed two mapped Legacy provider accounts with the same closed-trade external id, run the Legacy worker import twice, assert first run imports two scoped rows, second run imports zero, and no raw `pub_id`/secret markers leak. Target part: `apps/worker/src/legacy-live.ts`, `tests/integration/legacy-provider-worker.test.ts`.

4. Severity P2 - Admin selected-user trade display should remain a guardrail after the DB invariant changes, but it is not the primary idempotency proof. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:390-405` seeds a provider-scoped Legacy trade, and `tests/integration/admin-user-bot-detail-loader.test.ts:539-545` asserts the selected-user Legacy DTO returns that scoped trade. The same file also proves no selected-provider evidence leaves metrics/positions/trades/equity empty at `tests/integration/admin-user-bot-detail-loader.test.ts:754-758`, and multiple active provider mappings suppress selected-provider statistics at `tests/integration/admin-user-bot-detail-loader.test.ts:814-822`. Recommendation: after the DB migration, add or extend one loader regression only if DTO behavior changes: seed an unscoped Legacy trade and a provider-scoped Legacy trade with the same external id/source, then assert a selected provider mapping shows only the scoped row and does not leak unscoped/raw provider markers. Target part: selected-user admin Legacy trade DTO.

5. Severity P2 - Focused PGlite gates are enough before/after the migration, but managed/browser gates must stay NOT RUN without env URLs. Evidence: `package.json:14-24` exposes Vitest plus worker continuity scripts; `package.json:35-37` exposes admin-user bot DB E2E managed scripts; the managed worker runner requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and creates/drops a throwaway DB at `scripts/run-worker-continuity-managed.mjs:23-29`, `scripts/run-worker-continuity-managed.mjs:35-38`, and `scripts/run-worker-continuity-managed.mjs:358-388`; the admin-user managed runner requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:17-24` and `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29-34`. Recommendation: for this migration, use PGlite repository/loader tests as the required local proof; run managed worker continuity and admin-user DB Playwright only when the operator supplies explicit admin DB URLs and approves those opt-in gates. Target part: acceptance gate selection.

## Decisions
- The next implementation should start with the focused DB regression in `tests/integration/db-0002.test.ts`; it should fail before the migration/repository invariant changes and pass after.
- Use split partial unique indexes instead of a single nullable composite unique index. A regular unique index containing `bot_provider_account_id` would not protect unscoped `NULL` replays.
- Keep `sourceAdapter` in both scoped and unscoped idempotency keys.
- Keep live provider/exchange checks, live bot control, SSH/tmux/systemd, deploy, production monitoring, raw env dumps, and raw secret reads out of this phase.
- Do not claim managed continuity or rendered browser acceptance without explicit env URLs and observed green output in that same session.

## Risks
- No tests were executed in this read-only auditor lane, so no gate is claimed green here.
- The worktree was already heavily dirty before this handoff; this audit certifies only the inspected idempotency slice.
- Dropping/replacing `bti_external_trade_idx` without a deliberate migration plan could either keep the provider collision bug or accidentally allow duplicate unscoped imports.
- If Legacy closed-trade worker import is implemented in the same slice as the DB invariant, the worker test requirement expands beyond the repository-only regression.

## Verification/tests
RUN:
- Read-only inspections only: `git status --short --branch`, `rg`, `Get-Content`, `Select-String`, and targeted line-number reads of the files above.
- Handoff write only: `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`.

NOT RUN:
- `npx vitest run ...` - not run; this was a read-only auditor handoff and no implementation was attempted.
- `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker` - not run.
- `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, `npm run ci:local` - not run.
- `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed` - not run; managed mode requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and creates a throwaway DB.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix`, full Playwright, visual evidence review - not run; DB/browser gates require explicit env URLs/artifact review and are outside this read-only audit.
- Live bot start/stop/apply-config, exchange/provider reachability probes, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and not appropriate for this phase.

Existing tests to run for the next implementation:
- Before migration code, run baseline non-live coverage: `npx vitest run tests/integration/db-0002.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`.
- After adding the DB regression but before the migration, run `npx vitest run tests/integration/db-0002.test.ts` and expect the new provider-collision test to fail against the current invariant.
- After migration/repository/schema changes, run `npx vitest run tests/integration/db-0002.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`.
- After the focused tests pass, run `npm run typecheck`, `npm run secret:scan`, `npm run governance:check`, and `git diff --check`.
- If the implementation adds Legacy closed-trade worker ingestion, also run `npx vitest run tests/integration/legacy-provider-worker.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts`.

Enough before/after migration:
- Before migration: baseline focused PGlite tests plus the intentionally failing new DB regression are enough; no live DB/provider/exchange proof is needed.
- After migration: the focused PGlite set, root typecheck, secret scan, governance check, and diff check are enough for local acceptance of the DB invariant.
- Managed worker continuity and admin-user DB Playwright matrix are additional confidence gates only after explicit env URLs are provided; they are not safe defaults for this read-only/migration-local slice.

## Next actions
1. Add the `db-0002` provider-scoped idempotency regression and extend the existing unscoped duplicate test with a row-count assertion.
2. Implement the split partial unique migration and matching Drizzle schema update for `bot_trade_imports`.
3. Re-run the focused PGlite tests listed above and record exact pass/fail output in the aggregate Phase 4.30 handoff.
4. Only if Legacy closed-trade worker ingestion is added, add the worker-level two-provider replay regression before claiming closed-trade import acceptance.
5. Keep managed continuity and browser DB matrix NOT RUN until the operator provides the required admin DB URLs.
