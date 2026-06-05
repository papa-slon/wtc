# phase-4-30-legacy-trade-idempotency handoff
## Scope
Phase 4.30 implemented the provider-aware trade import idempotency slice left open by Phase 4.29:
- `bot_trade_imports` no longer uses one provider-unaware unique key;
- unscoped imports remain idempotent when `bot_provider_account_id IS NULL`;
- provider-scoped imports are idempotent per WTC provider account UUID;
- the same Legacy external trade id can now be imported for two different provider-account mappings under the same bot instance/source adapter;
- focused PGlite, worker fixture, admin loader, typecheck, secret, diff, and governance gates were run.

Read-only agents were launched before implementation and then closed before this report:
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`

All background agents from this phase were closed/cleaned up.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `packages/db/migrations/meta/_journal.json`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-journal-review.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `scripts/run-worker-continuity-managed.mjs`
- `package.json`

## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `packages/db/migrations/meta/0021_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `tests/integration/db-0002.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`

## Findings
1. Severity P1 - Provider-aware import idempotency is now encoded in the DB invariant. Evidence: migration `packages/db/migrations/0021_complete_pepper_potts.sql:1-3` drops the old `bti_external_trade_idx`, creates `bti_external_trade_unscoped_idx` for `bot_provider_account_id IS NULL`, and creates `bti_provider_external_trade_idx` for `bot_provider_account_id IS NOT NULL`; schema mirrors those partial indexes at `packages/db/src/schema.ts:588-594`, and `_journal` records migration `0021_complete_pepper_potts` at `packages/db/migrations/meta/_journal.json:156`. Recommendation: keep the split partial indexes; do not replace them with a nullable composite unique index. Target part: `bot_trade_imports`.
2. Severity P1 - Repository idempotency now documents and targets the matching partial index. Evidence: `packages/db/src/repositories.ts:2243-2266` normalizes `providerAccountId`, branches conflict handling by scoped vs unscoped import, and uses explicit `onConflictDoNothing({ target, where })` matching the partial predicates; audit metadata includes only the WTC provider-account UUID or null at `packages/db/src/repositories.ts:2266`. Recommendation: future Legacy closed-trade importer must pass the mapped WTC provider account UUID into `importBotTrade`, not raw `pub_id`. Target part: repository import path.
3. Severity P1 - Regression coverage proves both old and new idempotency behavior. Evidence: `tests/integration/db-0002.test.ts:119-134` keeps unscoped duplicate replay at exactly one row; `tests/integration/db-0002.test.ts:137-184` inserts same-provider duplicate as `false` but allows the same external id for provider A and provider B, then asserts exactly the two WTC provider account UUIDs and no raw provider marker. Recommendation: keep this test as the source-of-truth guard before enabling Legacy closed-trade analytics. Target part: DB repository integration tests.
4. Severity P1 - Legacy worker closed-trade import is still not implemented in this slice, by design. Evidence: worker auditor found `apps/worker/src/legacy-live.ts` writes metric and position snapshots only; the expanded gate `tests/integration/legacy-provider-worker.test.ts` still covers provider-scoped metric/position snapshots, and `tests/integration/worker-tortila-snapshot.test.ts` covers existing Tortila closed-trade import path. Recommendation: next Legacy closed-trade slice must audit the source DB table/id columns first, then add a worker import test that passes `botProviderAccountId`. Target part: future Legacy closed-trade importer.
5. Severity P2 - Admin loader DTO semantics were clarified while testing this slice. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts` now keeps raw aggregate runtime/worker DTO states as `ok` when the aggregate rows are green, while `warningSummary.scope === 'runtime_not_scoped'` and UI/static readiness guards remain responsible for "not selected-user proof" semantics. Recommendation: do not mutate raw health DTOs into selected-user readiness; keep proof semantics in warning/readiness layers. Target part: selected-user admin diagnostics.

## Decisions
- Implemented only the DB/repository/test idempotency invariant, not a Legacy closed-trade source reader.
- Used Drizzle-generated migration output and reviewed it before running PGlite tests.
- Used explicit conflict targets after auditor review, even though bare `ON CONFLICT DO NOTHING` also passed; explicit targets make the intended partial-index contract obvious.
- Kept live bot controls, exchange/provider probes, deploy, SSH/tmux/systemd, raw env/secret reads, and managed DB mutation out of scope.
- Continued in this thread as a fallback because thread tooling did not expose the project id needed to create a correct repo-scoped new phase thread. The phase still followed read-only agent dispatch, per-agent handoffs, aggregate handoff, cleanup, and gate reporting.

## Risks
- Full `/goal` is still not complete. This closes provider-aware trade idempotency, but Legacy closed-trade source ingestion, rendered UI proof, managed worker continuity, and Tortila parity/final acceptance remain.
- `bot_provider_accounts` should remain durable identity rows; hard-deleting provider accounts can still interact badly with `ON DELETE set null` and unscoped uniqueness if duplicate provider-scoped trades collapse to null. Prefer disabling mappings rather than deleting them.
- Existing unscoped imports and future provider-scoped imports can coexist for the same external id. Before migrating any existing importer from unscoped to scoped, decide whether a backfill/dedupe is needed.
- Managed worker continuity was not run because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not configured in this session.
- Admin-user DB Playwright matrix was not run because the opt-in admin DB URL is not configured.

## Verification/tests
RUN:
- `npm run db:generate -w @wtc/db` - PASS; generated `0021_complete_pepper_potts.sql` and `0021_snapshot.json`.
- `npx vitest run tests/integration/db-0002.test.ts` - PASS, 1 file / 22 tests.
- `npx vitest run tests/integration/legacy-provider-worker.test.ts` - PASS, 1 file / 3 tests.
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 1 file / 7 tests.
- `npx vitest run tests/integration/db-0002.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-journal-review.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts` - PASS, 6 files / 44 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/worker` - PASS.
- `git diff --check` - PASS.
- `npm run secret:scan` - PASS.
- `npm run governance:check` before aggregate - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- `npm run db:migrate` - not run; no live/managed DB mutation in this session.
- `npm run accept:worker:continuity` - not run; requires configured DB/runtime environment.
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is missing.
- `npm run e2e:admin-user-bots:db:managed:matrix` / Playwright rendered DB matrix - not run; opt-in admin DB URL is missing.
- Legacy closed-trade source ingestion test - not run; importer not implemented in this slice.
- Live bot start/stop/apply-config, exchange/provider reachability probe, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and intentionally out of scope.

## Next actions
1. Start the next phase with read-only agents for Legacy closed-trade source audit: identify real provider DB closed-trade table, stable external id, PnL/fee/funding columns, and safe filters by mapped `pub_id`.
2. Implement Legacy closed-trade importer only after the source model is proven; pass `botProviderAccountId` to `importBotTrade`.
3. Add worker-level replay regression: two provider mappings with same external id import two scoped rows on first run and zero on replay.
4. Then run rendered browser proof for Legacy/Tortila settings/statistics/admin pages across desktop/mobile.
5. Run managed worker continuity and admin-user DB matrix only after operator-approved throwaway/admin Postgres URLs are provided.
