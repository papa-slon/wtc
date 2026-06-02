# ecosystem-tradingview-access-implementer handoff
## Scope
Read-only audit/planning lane for epoch `20260601-1841`: TradingView historical missing-task repair after phase 3.8 made new worker expiry sweeps atomic. The audit inspected current schema, repository functions, worker dispatch, admin queue rendering, current tests, and phase 3.8 handoff evidence. No source code was edited, no live TradingView calls were made, and no browser automation was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`
- `docs/handoffs/20260601-1814-ecosystem-tradingview-access-implementer.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `apps/worker/src/index.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
None - read-only audit

## Findings
1. HIGH - Historical missing revoke tasks are still unrepaired. Evidence: `sweepTvExpiry` only selects request statuses `granted` and `expiring_soon`, then delegates to `atomicRevokeTv` (`packages/db/src/repositories.ts:333-345`). Once a pre-phase-3.8 partial state has `tradingview_access_requests.status='revoked'`, a later sweep will never reselect it. `atomicRevokeTv` now can insert the task in the same transaction (`packages/db/src/repositories.ts:1764-1810`), but that only fixes new sweeps. Recommendation: add `repairMissingTvRevokeTasks(db, now)` that finds historical `revoked` + expired + `grant.revokeReason='expired_by_worker'` rows with no `tradingview_access_tasks(kind='revoke')`, inserts the missing task, and returns `{ repaired }`. Target part: `packages/db/src/repositories.ts` and `apps/worker/src/index.ts`.
2. MEDIUM - Task idempotency is repository-only today; the table has no uniqueness guard. Evidence: `tradingview_access_tasks` contains only `id`, `requestId`, `kind`, `createdAt`, and `done` in schema (`packages/db/src/schema.ts:172-178`) and initial migration (`packages/db/migrations/0000_broken_jack_murdock.sql:171-177`). The current atomic insert is unconditional (`packages/db/src/repositories.ts:1807-1808`). Recommendation: for the smallest no-live repair, use a `NOT EXISTS` guard in the repair insert and keep the worker single-pass; if this worker can run concurrently, add a follow-up migration for a unique `(request_id, kind)` revoke-task guard. Target part: `tradingview_access_tasks`.
3. MEDIUM - Current tests prove happy-path queueing and static source shape, but not historical repair. Evidence: the task test creates a fresh expired grant and confirms a task exists after `sweepTvExpiry` (`tests/integration/tv-access-hardening.test.ts:86-103`), and the atomicity test is source-text based (`tests/integration/tv-access-hardening.test.ts:106-114`). Recommendation: add PGlite tests that seed a partial historical state by calling `atomicRevokeTv(..., TV_EXPIRED_BY_WORKER_REASON, ..., { queueExternalRevokeTask: false })`, run repair once, run repair twice, and assert exactly one open revoke task. Target part: `tests/integration/tv-access-hardening.test.ts` or a new focused repair test.
4. LOW - Documentation still contains stale wording around the old worker path and task model. Evidence: phase 3.8 says new sweeps are atomic but repair remains open (`docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md:10` and `:66-68`); `docs/ARCHITECTURE.md:590-595` still says `sweepTvExpiry` calls the older non-atomic `revokeTv`; `docs/CONTRACTS/tradingview-access.md:246-260` still describes the worker-facing sweep as partial. Recommendation: update docs after the repair implementation so the next audit starts from accurate current behavior. Target part: TradingView plan/contract/architecture docs.

## Decisions
- The smallest repair should remain manual-first: no TradingView credentials, no browser automation, no task consumer, and no live endpoint call.
- Repair should only recreate missing external revoke tasks for worker expiry revokes, not arbitrary manual admin revokes. The safest discriminator currently available is `tradingview_access_grants.revokeReason === 'expired_by_worker'` plus an expired timestamp and revoked request state.
- No schema expansion is required for the first repair pass because the current task table already has enough fields to show a manual revoke task in the admin queue. A unique index is a concurrency hardening follow-up, not a blocker for a single-worker no-live repair.

## Risks
- Without a DB uniqueness constraint, two concurrent repair workers could create duplicate task rows despite a repository-level `NOT EXISTS` check.
- A historical partial row with a missing or nonstandard `revokeReason` cannot be repaired safely without risking false-positive external revoke work.
- `listTvAccessTasks` shows only the latest 100 tasks by default in the admin loader (`apps/web/src/features/tv/queries.ts:88-92`), so a large backlog may need pagination later; this is not required for the minimal repair.
- This audit cannot prove whether production data actually contains historical partial states because no live DB was accessed.

## Verification/tests
RUN:
- PASS - `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts`; 2 files passed, 12 tests passed.
- READ - `git status --short --branch`; failed with `fatal: not a git repository (or any of the parent directories): .git`, so no branch/status claim is made.

NOT RUN:
- No live TradingView calls; explicitly out of scope.
- No browser automation; explicitly out of scope.
- No real Postgres data scan; no scoped DB was provided and this is a read-only local audit.
- No full gate, e2e, migration, or build gate; this lane only audits/plans the repair path.

## Next actions
1. Implement `repairMissingTvRevokeTasks(db, now)` in `packages/db/src/repositories.ts`:
   - select revoked requests whose request or grant expiry is `<= now`;
   - join the grant for the request and require `grant.revokeReason === TV_EXPIRED_BY_WORKER_REASON`;
   - require no existing `tradingview_access_tasks` row for `(requestId, kind='revoke')`;
   - insert `{ requestId, kind: 'revoke', done: false }`;
   - return `{ repaired }`.
2. Call the repair after `sweepTvExpiry(db, now)` in `runDbWorkerTick` and include `tvTasksRepaired` in the worker health payload/log.
3. Add non-live PGlite tests for repair creation, repair idempotency, manual-revoke exclusion, and worker tick reporting.
4. After implementation, run `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts` plus `node scripts/gates.mjs full`. If scoped DB access is later provided, run a separate live/throwaway-DB acceptance phase.
