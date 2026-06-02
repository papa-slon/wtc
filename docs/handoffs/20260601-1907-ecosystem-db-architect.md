# ecosystem-db-architect handoff
## Scope
Read-only DB planning lane for epoch `20260601-1907`. Scope was TradingView external revoke task uniqueness/concurrency hardening after `repairMissingTvRevokeTasks`, including whether the next safe step should be repository-only or migration/DDL-backed. Also checked whether Axioma consume/account-link local readiness has related DB impact. No source, schema, migration, or product docs were edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/DATA_MODEL.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0001_early_toad_men.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0003_fresh_blockbuster.sql`
- `packages/db/migrations/0007_romantic_mulholland_black.sql`
- `apps/worker/src/index.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - `tradingview_access_tasks` still has no database uniqueness guard for the logical task identity `(request_id, kind)`. Evidence: current Drizzle schema defines only `id`, `requestId`, `kind`, `createdAt`, and `done` with no index callback at `packages/db/src/schema.ts:172`; the initial migration creates the table without a unique index at `packages/db/migrations/0000_broken_jack_murdock.sql:171`; repository/migration grep shows unique indexes for other domains but none for `tradingview_access_tasks` (`packages/db/migrations/0001_early_toad_men.sql:2`, `packages/db/migrations/0002_sour_paibok.sql:260`, `packages/db/migrations/0003_fresh_blockbuster.sql:33`, `packages/db/migrations/0007_romantic_mulholland_black.sql:24`). Recommendation: add additive DDL `UNIQUE(request_id, kind)` via a new migration and matching `uniqueIndex` in `packages/db/src/schema.ts`. Target part: TradingView external-task table.
2. HIGH - Repository-only idempotency is not concurrency-safe. Evidence: `repairMissingTvRevokeTasks` selects candidates at `packages/db/src/repositories.ts:356`, checks for an existing task at `packages/db/src/repositories.ts:374`, then inserts at `packages/db/src/repositories.ts:380`; two workers can both pass the check before either insert commits. `atomicRevokeTv` inserts the same logical task when `queueExternalRevokeTask` is true at `packages/db/src/repositories.ts:1845`, so a repair worker racing a revoke path has the same duplicate risk unless the insert is conflict-safe. Recommendation: combine the unique index with `onConflictDoNothing` on all `tradingviewAccessTasks` inserts, and count `repairMissingTvRevokeTasks().repaired` from `returning()` rows rather than the pre-insert check. Target part: `packages/db/src/repositories.ts`.
3. MEDIUM - The right unique shape is full `(request_id, kind)`, not a partial open-task index. Evidence: current repair intentionally treats a completed revoke task as sufficient and does not create a new open task (`tests/integration/tv-access-hardening.test.ts:137` to `tests/integration/tv-access-hardening.test.ts:163`); the admin list can include done tasks (`packages/db/src/repositories.ts:390` to `packages/db/src/repositories.ts:394`). A partial `WHERE done=false` unique index would allow a second pending revoke after a completed one and would contradict this behavior. Recommendation: enforce one logical task per request/kind for both open and done states; if future automation needs retries, model attempts/status columns instead of duplicate task rows. Target part: migration `0008` and schema.
4. MEDIUM - A uniqueness migration must handle pre-existing duplicates or it can fail on a real database. Evidence: Phase 3.9 explicitly left uniqueness hardening open in `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`, and the current table has permitted duplicates since `0000` (`packages/db/migrations/0000_broken_jack_murdock.sql:171` to `packages/db/migrations/0000_broken_jack_murdock.sql:177`). Recommendation: make the migration dedupe first, preserving an unfinished task when one exists, otherwise preserving one completed task, then create the unique index. A suitable ordering is `row_number() over (partition by request_id, kind order by case when done = false then 0 else 1 end, created_at asc, id asc)`. Target part: generated/hand-reviewed migration.
5. MEDIUM - `sweepTvExpiry` and repair now run in the same worker tick, so DDL-backed idempotency is the cleanest boundary. Evidence: worker tick calls `sweepTvExpiry` then `repairMissingTvRevokeTasks` at `apps/worker/src/index.ts:51` to `apps/worker/src/index.ts:52`; `sweepTvExpiry` delegates each due request to `atomicRevokeTv(..., { queueExternalRevokeTask: true })` at `packages/db/src/repositories.ts:333` to `packages/db/src/repositories.ts:345`. Recommendation: keep repair in the tick, but after the unique index use conflict-safe inserts so repeated or overlapping ticks are harmless. Target part: worker/repository boundary.
6. LOW - TradingView docs still contain stale task/sweep descriptions that can mislead the next implementation phase. Evidence: `docs/CONTRACTS/tradingview-access.md:255` still says the sweep scans only `status = 'granted'`, marks `expired`, and writes no audit; current code scans `granted` and `expiring_soon` and writes `tv_access.revoke` through `atomicRevokeTv` (`packages/db/src/repositories.ts:333` to `packages/db/src/repositories.ts:345`, `packages/db/src/repositories.ts:1838` to `packages/db/src/repositories.ts:1844`). `docs/TRADINGVIEW_ACCESS_PLAN.md:102` is closer but still describes task insert as after delegation rather than inside `atomicRevokeTv`. Recommendation: update contract docs in the implementation phase after the DDL decision lands. Target part: TradingView docs.
7. MEDIUM - Axioma JTI consume is already DB-concurrency oriented, but account-link readiness still needs separate DDL before enabling a real OTC/link consume flow. Evidence: `axioma_handoff_jti_revocations` has `jti` as primary key and indexes for expiry/sub at `packages/db/src/schema.ts:638` to `packages/db/src/schema.ts:652`; `consumeHandoffJti` is a single conditional `UPDATE` guarded by `usedAt`, `revokedAt`, and `expiresAt` at `packages/db/src/repositories.ts:1182` to `packages/db/src/repositories.ts:1195`; a real Postgres cross-connection consume race test already exists but is skipped without `REAL_POSTGRES_DATABASE_URL` at `tests/integration/db-axioma-jti.test.ts:136`. By contrast, `axioma_account_links` still stores `oneTimeCode` in plaintext and has no visible uniqueness/index callback at `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155`, while the journal-handoff route simply reads one linked row with `.limit(1)` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:78`. Recommendation: no immediate Axioma DB change is required for the TradingView uniqueness slice, but a future Axioma account-link/consume phase should add hashed OTC storage, consumed/used timestamps, expiry indexes, and uniqueness for active linked user/account rows before CTAs are enabled. Target part: Axioma B4 account-link DDL.

## Decisions
- Recommendation is DDL-backed hardening, not repository-only hardening. Repository-only `select` before `insert` is acceptable for single-process local repair but cannot prove correctness under concurrent workers or overlapping repair/sweep calls.
- The unique key should be `(request_id, kind)` across all rows. Do not include `done` in the key and do not make it partial on `done=false`, because a completed revoke task is currently treated as satisfying the external removal obligation.
- The implementation phase should make both task insert paths conflict-safe after the unique index lands: the insert inside `atomicRevokeTv` and the insert inside `repairMissingTvRevokeTasks`.
- Axioma JTI consume does not need a new uniqueness migration; `jti` primary key plus the conditional update is the right primitive. Axioma account-link/OTC readiness is a separate migration scope and should not be bundled into the TradingView task uniqueness slice unless that phase also enables account-link consume.

## Risks
- Adding the unique index without a dedupe step can fail on any database that already has duplicate `(request_id, kind)` rows.
- Dedupe deletes task rows, so the migration must preserve the most conservative operational state: prefer an unfinished task if present, otherwise keep one completed row.
- `onConflictDoNothing` without a unique index gives a false sense of safety; it only becomes a concurrency boundary once the database has the matching unique constraint.
- PGlite tests can validate migration shape and local idempotency, but true race behavior should be confirmed through the existing opt-in real-Postgres harness with a new TV task concurrency case.
- Axioma account-link rows can currently be ambiguous if multiple `linked` rows exist for a user; the current route masks that with `limit(1)`. This is acceptable while CTAs remain fail-closed, but not for real account-link activation.

## Verification/tests
Not run in this read-only planning lane. Only file inspection and `rg` searches were performed; no live DB or external service was touched.

Exact targeted gates for the implementation phase:
- `npm run db:generate -w @wtc/db`
- `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts`
- `npm test -- tests/integration/db-real-postgres.test.ts` after adding a throwaway-real-Postgres TV duplicate-task concurrency case and setting `REAL_POSTGRES_DATABASE_URL` to a `wtc_test` or `wtc_test_*` database.
- `npm test -- tests/integration/db-axioma-jti.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-skeleton-static.test.ts` if the same phase touches Axioma account-link/readiness.
- `npm run typecheck`
- `node scripts/gates.mjs full`
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`

## Next actions
1. Add a new migration, likely `0008`, that dedupes `tradingview_access_tasks` by `(request_id, kind)` and then creates a unique index such as `tvat_request_kind_idx`.
2. Add `uniqueIndex('tvat_request_kind_idx').on(t.requestId, t.kind)` to `packages/db/src/schema.ts`.
3. Update both task insert sites to be conflict-safe: `atomicRevokeTv(... queueExternalRevokeTask)` and `repairMissingTvRevokeTasks`.
4. Extend `tests/integration/tv-access-hardening.test.ts` for duplicate pre-state and conflict-safe repair behavior, and extend `tests/integration/db-real-postgres.test.ts` with a guarded cross-connection race that proves only one `(request_id, kind='revoke')` row survives.
5. Update stale TradingView contract/plan docs in the same implementation phase after code and migration behavior are verified.
6. Keep Axioma account-link DDL as a separate scoped phase unless the operator explicitly scopes B4 consume/account-link activation.
