# worker-jobqueue-truth-auditor handoff

## Scope

Phase 1.6.1 Task C item 2 — audit the **worker source truth** about the durable queue.
Confirmed-issue target: `apps/worker/src/jobs.ts` lines 3-4 header comment claims a durable
`job_queue` table "replaces the in-memory demo loop in production." This is FALSE: `job_queue`
is RESERVED / unconsumed, and the current worker runs cron-style direct repository calls.

This is a READ-ONLY audit. No files edited/created/deleted except this one handoff. No
npm/tests/builds/git run. Scope boundary: I own **source comments** under `apps/` + `packages/`
for the worker/queue topic; `docs/*` are owned by the docs-contract-drift-auditor and are NOT
modified or prescribed here.

## Files inspected

- `apps/worker/src/index.ts` (full, 46 lines)
- `apps/worker/src/jobs.ts` (full, 39 lines)
- `apps/worker/src/tick-once.ts` (full, 25 lines)
- `packages/db/src/schema.ts` (job_queue block, lines 217-234) and `repositories.ts` (worker job
  exports: `sweepTvExpiry` :246, `reconcileAllEntitlements` :262, `recordHealthCheck` :276, plus
  the `jobs.ts` memory helpers `reconcileEntitlements`/`sweepTradingViewAccess`)
- Context: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`,
  `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md`
- Repo-wide Grep for `jobQueue`, `job_queue`, and durable-queue claim phrases (`durable`,
  `SKIP LOCKED`, `FOR UPDATE`, `replaces ... production`, `polls job_queue`, `enqueue`/`dequeue`)
  across `apps/**` + `packages/**` (`*.ts`,`*.tsx`,`*.js`,`*.mjs`,`*.sql`).

## Files changed

None — read-only audit

## Findings

### Ground truth — what the worker actually does today (confirmed from source)

- `apps/worker/src/index.ts` `main()` (lines 37-43): logs a start line, runs `tick()` once, then
  `setInterval(tick, TICK_MS)`. **`TICK_MS = 60_000` (60 seconds)** — index.ts:10.
- `tick()` (lines 31-35) branches on `process.env.DATABASE_URL`:
  - **set** → `dbTick(url)` (lines 12-20): `createDb(url)`, then awaits
    `reconcileAllEntitlements(db, now)`, `sweepTvExpiry(db, now)`, `recordHealthCheck(db, 'worker',
    'ok', {...})` — all dynamically imported from `@wtc/db` (line 13), then a console summary.
  - **unset** → `memoryTick()` (lines 22-29): builds a console audit writer + an in-memory
    `TvAccessService`, calls the local `reconcileEntitlements([], now, audit)` and
    `sweepTradingViewAccess(tv, now)` from `./jobs.ts`, logs only. This is the **in-memory demo
    loop** (dev only); it operates on an empty `[]` entitlement list.
- `apps/worker/src/jobs.ts` exports the two pure memory-path helpers used by `index.ts`/`tick-once.ts`:
  `reconcileEntitlements(entitlements, now, audit?)` (entitlement drift + audit) and
  `sweepTradingViewAccess(tv, now)` (delegates to `tv.sweep(now)`). It does NOT contain the
  DB-path functions (those live in `@wtc/db`).
- `apps/worker/src/tick-once.ts` is a single-pass demo for cron/verification: it builds the SAME
  in-memory services and calls `reconcileEntitlements` + `sweepTradingViewAccess` once, then exits.
  (It does not use the DB path at all.)
- **NOTHING enqueues or dequeues `job_queue`.** No `setInterval`/poll loop reads it; no
  `SELECT ... FOR UPDATE SKIP LOCKED` consumer exists anywhere. The TradingView side inserts into a
  **different** table, `tradingview_access_tasks` (via `sweepTvExpiry` →
  `db.insert(s.tradingviewAccessTasks)`, `repositories.ts:254`; surfaced as `tasksQueued`), and even
  those task rows are not consumed by automation yet. The `job_queue` table is wholly unused.

---

1. **[HIGH — false current-state claim in source comment] `jobs.ts` header.**
   - Evidence: `apps/worker/src/jobs.ts:3-4` (inside the header comment, lines 1-5).
   - Current text (exact, lines 1-5):
     ```
     /**
      * Background jobs. Pure functions over injected services so they are testable and DB-agnostic.
      * See docs/ARCHITECTURE.md (Background Jobs). A durable queue (job_queue table) replaces the
      * in-memory demo loop in production.
      */
     ```
   - Why false: `job_queue` is RESERVED / unconsumed (no enqueue/dequeue; see Finding 4). In
     production (DATABASE_URL set) the worker runs **cron-style direct repository calls**
     (`reconcileAllEntitlements` / `sweepTvExpiry` / `recordHealthCheck` from `@wtc/db`, driven by a
     `setInterval` in `index.ts`), NOT a durable queue. The "in-memory demo loop" is merely the
     no-DB fallback; nothing "replaces" it with a queue. A durable queue is a future / TARGET design.
   - Exact corrected text (replace lines 1-5 with):
     ```
     /**
      * Background jobs. Pure functions over injected services so they are testable and DB-agnostic.
      * These pure helpers (reconcileEntitlements / sweepTradingViewAccess) back the in-memory demo
      * path; when DATABASE_URL is set, apps/worker/src/index.ts instead calls the @wtc/db repository
      * jobs (reconcileAllEntitlements / sweepTvExpiry / recordHealthCheck) directly. The current
      * worker is a cron-style scheduler (setInterval) making direct repository calls — there is NO
      * durable job queue: the `job_queue` table in @wtc/db is RESERVED / not yet consumed (nothing
      * enqueues or dequeues it). A durable queue is a future / TARGET design, not today's mechanism.
      * See docs/ARCHITECTURE.md (Background Jobs).
      */
     ```
   - Target part: `apps/worker/src/jobs.ts` header comment.

2. **[HIGH — false current-state claim in source comment] `index.ts` header ("durable jobs").**
   (NOTE: not in the prompt's checklist, but a second stray durable-queue source falsehood under my
   ownership — `index.ts` is NOT already truthful, contrary to the seed assumption.)
   - Evidence: `apps/worker/src/index.ts:2` (and the framing on line 4), header lines 1-5.
   - Current text (exact, lines 1-5):
     ```
     /**
      * WTC worker — periodic durable jobs. When DATABASE_URL is set it runs DB-backed jobs (entitlement
      * expiry reconciliation, TradingView revoke sweep + task queue, integration-health snapshot) via the
      * @wtc/db repositories. Without DATABASE_URL it runs the in-memory demo loop (dev only).
      */
     ```
   - Why false/misleading: "periodic **durable** jobs" implies a durable queue; there is none. The
     worker is a **cron-style scheduler** (`setInterval(tick, TICK_MS)`, `TICK_MS = 60_000`). "task
     queue" in line 3 refers to `tradingview_access_tasks` inserts inside `sweepTvExpiry`, which are
     not yet consumed — calling it a "queue" without that caveat overstates it. The body is otherwise
     accurate about the DB-vs-memory branch.
   - Exact corrected text (replace lines 1-5 with):
     ```
     /**
      * WTC worker — cron-style scheduler (setInterval; TICK_MS) making direct @wtc/db repository
      * calls. When DATABASE_URL is set it runs DB-backed jobs (entitlement expiry reconciliation,
      * TradingView revoke sweep, integration-health snapshot). Without DATABASE_URL it runs the
      * in-memory demo loop (dev only). There is NO durable job queue: the `job_queue` table in
      * @wtc/db is RESERVED / not yet consumed. The TradingView sweep inserts `tradingview_access_tasks`
      * rows, but those are not consumed by automation yet either.
      */
     ```
   - Target part: `apps/worker/src/index.ts` header comment.

3. **[INFO — already truthful; no change] `schema.ts` job_queue comment.**
   - Evidence: `packages/db/src/schema.ts:217-221` (the block immediately above the `jobQueue`
     export at line 222).
   - Current text (exact):
     ```
     // RESERVED — NOT YET CONSUMED. This table is scaffolding for a future durable job queue
     // (SELECT ... FOR UPDATE SKIP LOCKED). The worker today uses direct cron-style calls
     // (reconcileAllEntitlements / sweepTvExpiry / recordHealthCheck) and the tradingview_access_tasks
     // table; no code enqueues or dequeues job_queue rows yet. See docs/IMPLEMENTED_FILES.md. Do not
     // present this as a working queue until a consumer + tests land (Phase 1.5+).
     ```
   - Assessment: ACCURATE and already encodes the exact truth required by item 2 (RESERVED /
     not-yet-consumed; current = cron-style direct calls; SKIP LOCKED is the FUTURE shape). No
     correction needed. The corrected `jobs.ts` / `index.ts` text in Findings 1-2 is deliberately
     aligned to this canonical phrasing.

4. **[INFO — evidence the table is unconsumed] `jobQueue` Drizzle export has ZERO consumers.**
   - Evidence: repo-wide Grep for `jobQueue` over source (`*.ts`/`*.tsx`) returns a **single**
     hit — the definition itself at `packages/db/src/schema.ts:222` (`export const jobQueue =
     pgTable(`). No other source file references it: `packages/db/src/{repositories,seed,seed-cli,
     client,index}.ts` = zero (`grep jobQueue` → no matches); `apps/worker/**` = zero; `apps/web/src/**`
     = zero. The only non-source occurrences are the generated migration / snapshot for the
     `job_queue` table (`migrations/0000_broken_jack_murdock.sql:94,211`; `meta/*.json`), the
     compiled `apps/web/.next/**` build artifacts (schema re-export bundled by webpack — not a
     consumer), the coverage HTML mirror, and prior handoff docs. This is direct, mechanical
     evidence that `job_queue` is RESERVED / unconsumed: it is declared (so the migration creates the
     table) but never enqueued, dequeued, selected, updated, or otherwise used by any code path.
   - (Corroborates the Phase-1.5 `20260529-1921-db-postgres-persistence-auditor` /
     `integration-risk-auditor` findings that `jobQueue` has zero usages outside schema + migration.)

5. **[INFO — no OTHER stray durable-queue claims in source comments under apps/ + packages/]**
   - Evidence: Grep across `apps/**` + `packages/**` for `durable`, `SKIP LOCKED` / `SKIP_LOCKED`,
     `FOR UPDATE`, `replaces ... production`, `polls job_queue`, `in-memory demo loop`,
     `enqueue`/`dequeue` returned exactly: (a) `jobs.ts:3-4` (Finding 1, FALSE); (b) `index.ts:2,4`
     (Finding 2, FALSE/misleading); (c) `schema.ts:217-221` (Finding 3, TRUTHFUL). One unrelated,
     correct use of the word "durable" exists in `packages/audit/src/audit.ts:97` ("stdout is
     neither durable nor the append-only audit_logs table") — not a queue claim, no change.
     **No additional worker/queue source-comment falsehoods found** under my ownership. Any remaining
     durable-queue / SKIP-LOCKED prose lives in `docs/*` (e.g. `docs/DATA_MODEL.md:925`,
     `docs/CONTRACTS/tradingview-access.md`, `docs/STATUS.md`) — owned by the
     docs-contract-drift-auditor, not touched or prescribed here.

## Decisions

- **Two** source-comment fixes are required, not one: `apps/worker/src/jobs.ts:1-5` (Finding 1, the
  explicitly-flagged issue) **and** `apps/worker/src/index.ts:1-5` (Finding 2). The seed's
  assumption that `index.ts` was "already truthful" does not hold against the actual file — its
  header says "periodic **durable** jobs", which implies the very durable queue that does not exist.
- Corrected text for both is aligned to the already-truthful `schema.ts:217-221` phrasing so the
  three worker/queue source comments tell one consistent story: current = cron-style scheduler making
  direct repository calls; `job_queue` = RESERVED/unconsumed; durable queue (SKIP LOCKED) =
  future/TARGET; `tradingview_access_tasks` = queued but not yet consumed.
- `schema.ts` is left as-is (already truthful). No docs changes proposed (docs owned by the
  docs-contract-drift-auditor).

## Risks

- LOW. Both recommended changes are comment-only; they do not alter runtime behaviour, types, or
  exports. Corrected text was verified against the actual `index.ts` control flow (`tick` → `dbTick`
  /`memoryTick`; `TICK_MS = 60_000`) and the real `@wtc/db` function names, so there is no risk of
  substituting one inaccuracy for another.
- The `job_queue` table remains declared-but-unused after these fixes (by design / Phase 1.6
  Variant 1). The truthful `schema.ts:217-221` comment must remain the canonical marker. If the
  table is ever consumed, all three worker/queue comments (`jobs.ts`, `index.ts`, `schema.ts`) must
  be updated together.
- Separately tracked (out of scope here): `tradingview_access_tasks` rows accumulate unconsumed
  (`done` always false) — already logged by the Phase-1.5 integration-risk auditor; not a comment
  issue.

## Verification/tests

- No tests/builds/lints run (read-only audit, per instructions). Gate execution belongs to the
  operator / tests-runner after the edits land.
- Evidence method: full Reads of all three `apps/worker/src/*.ts` files; targeted Reads of the
  `schema.ts` `jobQueue` block (217-234) and `repositories.ts` worker exports (246/262/276); Grep
  for `jobQueue` (1 source hit = definition only) and for durable-queue claim phrases across
  `apps/**` + `packages/**`.
- Recommended post-edit gates (operator): `npm run lint`, `npm run typecheck` (packages),
  `npm run check:core` — comment-only changes should leave all green. (`db:migrate`/`db:seed`
  against real Postgres remain NOT RUN — unchanged, no creds.)

## Next actions

1. Apply Finding 1: replace `apps/worker/src/jobs.ts:1-5` with the corrected header above (the
   explicitly-flagged Task C item 2 fix).
2. Apply Finding 2: replace `apps/worker/src/index.ts:1-5` with the corrected header above
   (second stray durable-queue falsehood — "periodic durable jobs").
3. No further worker/queue source-comment edits required — `schema.ts:217-221` is already truthful,
   and `jobQueue` has zero consumers (Finding 4).
4. (For the docs-contract-drift-auditor, FYI only) durable-queue / SKIP-LOCKED prose in `docs/*`
   is out of my scope; confirm it is consistent with "cron-style direct calls; job_queue RESERVED".
