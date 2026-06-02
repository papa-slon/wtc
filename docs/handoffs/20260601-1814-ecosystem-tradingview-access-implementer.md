# ecosystem-tradingview-access-implementer handoff
## Scope
Read-only audit for epoch `20260601-1814`: TradingView access expiry revoke plus external task creation atomicity/recoverability. No source edits, no live TradingView calls, and no browser automation.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ARCHITECTURE.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/CONTRACTS/tradingview-access.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/tradingview-access/src/index.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `tests/integration/db-pg5.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Expiry revoke and external manual task creation are not atomic. Evidence: `packages/db/src/repositories.ts:333-341` selects due rows, calls `atomicRevokeTv(...)`, then separately inserts into `tradingviewAccessTasks`; `packages/db/src/repositories.ts:1751-1787` shows `atomicRevokeTv` owns and commits its own transaction before the task insert occurs. If task insert fails after the revoke transaction commits, WTC internally records revoked access but the manual TradingView-side removal task is missing. Recommendation: refactor revoke internals into a transaction-scoped helper, then make `sweepTvExpiry` run request revoke + grant stamp + profile null + audit + task insert in the same per-request transaction. Target part: `packages/db/src/repositories.ts` `sweepTvExpiry` / `atomicRevokeTv`.
2. HIGH - The current sweep cannot recover a missing external revoke task after a partial prior run. Evidence: due-row selection only includes request statuses `granted` and `expiring_soon` at `packages/db/src/repositories.ts:334-337`; `atomicRevokeTv` moves the request to `revoked` at `packages/db/src/repositories.ts:1754-1759`. A revoked row with no task will not be selected by a later sweep, and existing tests only prove happy-path task creation/idempotent no-op (`tests/integration/db-pg5.test.ts:94-102`, `tests/integration/tv-access-hardening.test.ts:91-103`). Recommendation: add an idempotent repair path such as `ensureMissingTvRevokeTasks` or fold a recovery scan into `sweepTvExpiry` for revoked expired grants with `revokeReason='expired_by_worker'` and no `tradingview_access_tasks(kind='revoke')`. Target part: `packages/db/src/repositories.ts`, `packages/db/src/schema.ts`, worker tick.
3. MEDIUM - The external task table is minimal, so recoverability is limited to open/done state plus audit. Evidence: `packages/db/src/schema.ts:172-178` stores only `requestId`, `kind`, `createdAt`, and `done`; `markTvAccessTaskDone` flips only `done` and writes an audit row at `packages/db/src/repositories.ts:361-377`; the plan documents missing lifecycle fields at `docs/TRADINGVIEW_ACCESS_PLAN.md:80-90`. Recommendation: for the minimal fix, add a uniqueness/idempotency guard for one revoke task per request/kind; defer richer fields (`status`, `attempts`, `lastAttemptedAt`, `error`, `completedAt`) until an automation adapter exists. Target part: `packages/db/src/schema.ts`, migration, task repository functions.
4. MEDIUM - Required PG5 e2e coverage is weaker than the acceptance wording. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:51-54` requires an e2e smoke for `revokeReason` plus expiry banner; current e2e only asserts demo/admin structure and empty states at `tests/e2e/smoke.spec.ts:253-278`. The actual expiry banner exists in the user page at `apps/web/src/app/(app)/app/indicators/page.tsx:41-91`, and admin-only revoke reason rendering exists at `apps/web/src/app/admin/tradingview-access/page.tsx:186-203`, but there is no DB-backed e2e seed proving either on screen. Recommendation: add a DB/demo fixture path or static/render-level coverage that proves the banner and admin revoke reason text, without live TradingView automation. Target part: `tests/e2e/smoke.spec.ts` or a focused integration/static test.
5. LOW - Documentation is partially stale against current code. Evidence: `docs/ARCHITECTURE.md:590-595` still says the worker `sweepTvExpiry` calls older non-atomic `revokeTv`, while current code calls `atomicRevokeTv` at `packages/db/src/repositories.ts:340`; `docs/TRADINGVIEW_ACCESS_PLAN.md:51-58` still labels `tradingview_profiles` and `tradingview_access_grants` as TARGET even though schema defines them at `packages/db/src/schema.ts:519-554`. Recommendation: update docs after the code fix so the next phase does not re-audit an already-fixed boundary. Target part: TradingView plan/contract/architecture docs.

## Decisions
- Treat `packages/db/src/repositories.ts` as the production source of truth for TradingView access state; `packages/tradingview-access/src/index.ts:54-105` is the in-memory/dev service and does not cover DB grant/profile/task consistency.
- Do not call live TradingView, use browser automation, or add any source-code changes in this read-only agent pass.
- The minimal implementation should keep the manual-first queue: no credential-stuffing and no production browser bot.

## Risks
- A single transient DB failure during `tradingview_access_tasks` insert can strand a user in internally revoked state while external TradingView removal is not queued.
- Existing green PG5 tests do not prove rollback when task insertion fails or repair of a missing task.
- Adding a uniqueness guard for task idempotency requires a migration and should be checked against any historical duplicate task rows before production migration.

## Verification/tests
Observed this session:
- NOT RUN - tests/gates; read-only audit only, no source edits.
- NOT RUN - live TradingView/browser automation; prohibited by scope.

Exact targeted gates for the minimal fix:
- `npm test -- tests/integration/db-pg5.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/tv-access-hardening.test.ts`
- Add and run: `npm test -- tests/integration/tv-access-expiry-task-atomicity.test.ts`
- `npm run typecheck`
- `npm run lint`
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e -- --grep "admin TV access|TradingView access expires"`

Required new test cases:
- Atomic rollback: simulate task insert failure inside the sweep path and assert request status, grant revoke fields, profile pointer, audit row, and task row all roll back together.
- Recovery: seed a historical partial state (`request.status='revoked'`, grant `revokeReason='expired_by_worker'`, no revoke task) and assert the repair path queues exactly one task.
- Idempotency: run sweep/repair twice and assert no duplicate revoke tasks for the same request/kind.
- UI coverage: prove admin-only revoke reason rendering and user expiry banner without live TradingView automation.

## Next actions
1. Refactor `atomicRevokeTv` internals into a transaction-scoped helper that can be reused by `sweepTvExpiry`.
2. Change `sweepTvExpiry` so each expired request revocation and its `tradingview_access_tasks` insert commit or roll back together.
3. Add an idempotent recovery path for missing external revoke tasks caused by earlier partial states.
4. Add a migration or repository-level guard preventing duplicate revoke tasks for the same request/kind.
5. Add the targeted tests and update stale TradingView docs after the implementation lands.
