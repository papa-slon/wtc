# docs-contract-truth-auditor handoff

_2026-05-29 20:52. Phase 1.6 (Tasks C + F). STRICTLY READ-ONLY audit. No code or existing
doc modified. Builds on the 1921 docs-contracts-drift-auditor — reports only what is STILL
false after that pass landed._

## Scope

Eliminate FALSE "current" claims so docs match verified code, for the seven drift patterns:
(1) `PostgreSQL 16`/`pg16`; (2) `SKIP LOCKED`; (3) `job_queue`/`durable queue`/`polls job_queue`;
(4) `apps/web/api` · `apps/web/src/app/api` · `/api/**` claimed as existing; (5) "read-only methods
are available immediately" (and similar immediate-availability adapter claims); (6)
"TradingViewAccessService is DB-backed" (and any TV web-service/UI DB-backed CURRENT claim);
(7) `BOT_ADAPTER_MODE=real` (any `=real`). Plus Task C: recommend the truthful queue/worker wording.

Verified code truth used as the oracle:
- DB is **PostgreSQL 17** (local PG17 on :5432; ADR-010 `docs/ARCHITECTURE_DECISIONS.md:61`).
- `job_queue` is **RESERVED / NOT consumed** — `packages/db/src/schema.ts:217-221` comment + no
  enqueue/dequeue anywhere; worker (`apps/worker/src/index.ts`, `jobs.ts`) uses **cron-style direct
  calls** (`reconcileAllEntitlements`/`sweepTvExpiry`/`recordHealthCheck`); **no SKIP LOCKED consumer**.
  `tradingview_access_tasks` rows ARE queued by `sweepTvExpiry` but **not consumed by automation** yet.
- **No** `apps/web/src/app/api/**` (Glob → none); web app = server actions + `apps/web/src/lib/backend.ts`.
- `BOT_ADAPTER_MODE` enum = `mock|read-only|audited` (default `mock`), `packages/config/src/env.ts`.
  **No `=real`** value exists; real adapters throw `AdapterNotReadyError` (`packages/bot-adapters/src/http.ts`).
- `TradingViewAccessService` is the **in-memory** `TvAccessService` over `createMemoryTvStore`
  (`packages/tradingview-access/src/index.ts`); web UI is memory-backed. DB TV repos exist in
  `packages/db` but the WEB service/UI is NOT DB-backed (deferred — Part E).

## Files inspected

Ground truth: `AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`;
`docs/STATUS.md`; `docs/IMPLEMENTED_FILES.md`; `docs/NEXT_ACTIONS.md`;
`docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`;
`docs/handoffs/20260529-1921-docs-contracts-drift-auditor.md`.

Code/fact confirmation: `apps/worker/src/{index.ts,jobs.ts}` (+ empty `jobs/` dir);
`packages/db/src/schema.ts:217-234` (job_queue RESERVED comment); `packages/config/src/env.ts`
(enum); `packages/bot-adapters/src/http.ts` (AdapterNotReadyError); `packages/tradingview-access/src/index.ts`
(memory store); Glob `apps/web/src/app/api/**` → no files; `apps/web/src/lib/backend.ts` exists.

Audited docs (whole-tree greps + targeted reads): `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_DECISIONS.md`,
`docs/DATA_MODEL.md`, `docs/INTEGRATION_MAP.md`, `docs/MVP_SCOPE.md`, `docs/CONTRACTS/tradingview-access.md`,
`docs/CONTRACTS/tortila-adapter.md`, `docs/CONTRACTS/legacy-bot-adapter.md`, `docs/BOT_INTEGRATION_PLAN.md`,
`docs/TRADINGVIEW_ACCESS_PLAN.md`, `docs/BOT_CONTROL_SAFETY_MODEL.md`, `docs/STATUS.md`,
`docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `README.md`, `docs/DEPLOYMENT.md`,
`docs/BACKTESTER_DISTRIBUTION_PLAN.md`, `docs/handoffs/0000-orchestrator-seed.md`.

## Files changed

None — read-only audit.

## Findings

Severity legend: HIGH = false current claim a reader/agent would act on (wrong version, non-existent
queue/route, invalid env value); MEDIUM = misleading current claim; LOW/INFO = minor or already-correct.

### Pattern 1 — "PostgreSQL 16" / pg16 (correct = 17). 6 hits in CURRENT docs (handoffs excluded as historical).

1. **[HIGH]** `docs/DATA_MODEL.md:9`
   Current: `> **Stack**: PostgreSQL 16 + Drizzle ORM + drizzle-kit. Schema package: \`packages/db\`.`
   Corrected: `> **Stack**: PostgreSQL 17 + Drizzle ORM + drizzle-kit. Schema package: \`packages/db\`.`

2. **[HIGH]** `docs/INTEGRATION_MAP.md:21`
   Current: `        DB[("PostgreSQL 16\npackages/db")]`
   Corrected: `        DB[("PostgreSQL 17\npackages/db")]`

3. **[HIGH]** `docs/ARCHITECTURE.md:111`
   Current: `A Node.js process that runs a cron-style loop against the \`job_queue\` table (Drizzle on Postgres 16).`
   Corrected (also fixes Pattern 3 in same sentence): `A Node.js process that runs a **cron-style loop making direct repository calls** (Drizzle on Postgres 17). The \`job_queue\` table is **RESERVED / not yet consumed** (scaffolding for a future durable queue).`

4. **[MEDIUM]** `docs/ARCHITECTURE.md:93`
   Current: `├── docker-compose.yml        # Local Postgres 16 + optional worker`
   Corrected: `├── docker-compose.yml        # Local Postgres 17 + optional worker`

5. **[MEDIUM]** `docs/MVP_SCOPE.md:94`
   Current: `| PostgreSQL 16 + Drizzle schema + migrations | Real | All schema groups from seed |`
   Corrected: `| PostgreSQL 17 + Drizzle schema + migrations | Real | All schema groups from seed |`

6. **[LOW]** `docs/handoffs/0000-orchestrator-seed.md:48`
   Current: `- DB: **PostgreSQL 16 + Drizzle ORM + drizzle-kit** migrations.`
   Corrected: append a pointer rather than rewrite the historical lock — `- DB: **PostgreSQL 16 + Drizzle ORM + drizzle-kit** migrations. _(Superseded → standardised on **PostgreSQL 17**; see ADR-010 in \`docs/ARCHITECTURE_DECISIONS.md\`.)_` (The seed is a frozen decision log; ADR-010 already documents the 16→17 supersession. Optional — the inline note prevents a fresh reader treating "16" as current.)

   NOTE: `docs/ARCHITECTURE_DECISIONS.md:61-62` "PostgreSQL 16" mentions are CORRECT (ADR-010 explicitly
   supersedes the seed's 16). README.md / DEPLOYMENT.md / STATUS.md / NEXT_ACTIONS.md / IMPLEMENTED_FILES.md
   already say 17 — no change. All `Postgres 16` in `docs/handoffs/2026*` are historical audit records — leave.

### Pattern 2 — "SKIP LOCKED" (no consumer exists). 2 hits in CURRENT docs.

7. **[HIGH]** `docs/ARCHITECTURE.md:296`
   Current: `The worker uses a \`SKIP LOCKED\` advisory lock pattern on \`job_queue\` rows so multiple worker instances can run safely. In development, the worker can be started in-process via a flag in \`apps/web\`; in production it is a separate Node.js process deployed alongside the web app.`
   Corrected: `The worker today makes **cron-style direct repository calls** (\`reconcileAllEntitlements\` / \`sweepTvExpiry\` / \`recordHealthCheck\`); there is **no \`job_queue\` consumer and no \`SKIP LOCKED\` claim implemented yet**. A future durable queue would use \`SELECT ... FOR UPDATE SKIP LOCKED\` over \`job_queue\` for safe multi-instance workers (RESERVED scaffolding, not built). In development the worker runs in-process; in production it is a separate Node.js process.`

8. **[MEDIUM]** `docs/DATA_MODEL.md:947-961` (the "Worker claim pattern" SQL block, header at `:947`, `FOR UPDATE SKIP LOCKED` at `:957`)
   Current: `**Worker claim pattern**:` followed by the `UPDATE job_queue ... FOR UPDATE SKIP LOCKED` SQL.
   Corrected: prefix the block with a TARGET banner — `**Worker claim pattern (TARGET — not implemented; \`job_queue\` is RESERVED/unconsumed today):**`. The SQL itself may stay as the future design; only the framing must stop implying it runs now. (This is design-doc SQL, so TARGET-labelling is sufficient — do not delete.)

### Pattern 3 — "job_queue" / "durable queue" / "polls job_queue" presented as working. 5 hits in CURRENT docs.

9. **[HIGH]** `docs/ARCHITECTURE.md:283`
   Current: `The \`apps/worker\` process polls the \`job_queue\` table for pending jobs and dispatches them to typed handlers. Each handler is idempotent (safe to retry). Job types and their triggers:`
   Corrected: `The \`apps/worker\` process today runs a **cron-style loop that calls typed handlers directly** (it does **not** poll \`job_queue\` — that table is RESERVED/unconsumed). Each handler is idempotent (safe to retry). Planned job types and their triggers:`

10. **[HIGH]** `docs/INTEGRATION_MAP.md:285`
    Current: `- \`apps/web\` ↔ \`apps/worker\`: via the \`job_queue\` table in Postgres (Drizzle ORM, both processes share the same DB connection pool).`
    Corrected: `- \`apps/web\` ↔ \`apps/worker\`: today there is **no cross-process queue** — the worker runs independent cron-style sweeps via shared \`@wtc/db\` repositories (shared Postgres pool). The \`job_queue\` table is **RESERVED** for a future durable hand-off but is **not yet enqueued or consumed**.`

11. **[MEDIUM]** `docs/DATA_MODEL.md:925`
    Current: `Purpose: Durable background job queue (pg-table based, replaces in-process cron for production).`
    Corrected: `Purpose: **RESERVED** — durable background job queue (pg-table based) intended to replace cron-style direct calls in a later phase. **Not yet consumed**: no code enqueues or dequeues \`job_queue\`; the worker uses cron-style repository calls + \`tradingview_access_tasks\` today.`

12. **[MEDIUM]** `docs/ARCHITECTURE.md:41` (repo-tree comment)
    Current: `│   └── worker/               # Background job runner — cron-style + pg queue`
    Corrected: `│   └── worker/               # Background job runner — cron-style direct calls (job_queue table RESERVED/unconsumed)`

13. **[LOW]** `docs/handoffs/0000-orchestrator-seed.md:54`
    Current: `- Worker: \`apps/worker\` cron-like loop + queue abstraction (in-proc dev → pg-table durable).`
    Corrected (optional, historical doc): append `_(Built as cron-style direct calls; the pg-table \`job_queue\` is RESERVED/unconsumed — see \`docs/IMPLEMENTED_FILES.md\`.)_` Leave the original lock text intact.

    CORRECT, no change: `docs/IMPLEMENTED_FILES.md:45-47`, `docs/STATUS.md:33`, `docs/ARCHITECTURE_DECISIONS.md:83-84`
    all already say job_queue is RESERVED/not-consumed. `docs/BACKTESTER_DISTRIBUTION_PLAN.md:414` ("alongside
    \`job_queue\`") is a neutral schema-placement note — not a working-queue claim — leave it.

### Pattern 4 — `apps/web/api` · `apps/web/src/app/api` · `/api/**` claimed as existing. 1 hit remains.

14. **[HIGH]** `docs/ARCHITECTURE.md:135`
    Current: `... Webhook handlers live inside route handlers in \`apps/web/api/billing/\`; they call \`packages/billing\` ...`
    Corrected: `... Webhook handlers will live inside route handlers under the planned \`apps/web/src/app/api/billing/\` (**TARGET — no \`apps/web/src/app/api/\` directory exists today**; billing is mock + server actions); they call \`packages/billing\` ...`
    Evidence it is false: Glob `apps/web/src/app/api/**` → no files; `docs/IMPLEMENTED_FILES.md:8`. This line uses
    the **wrong path too** (`apps/web/api/billing/`, not even `src/app/api`) and is **unlabelled** as TARGET,
    unlike `:177`/`:233`/`:235` which the 1921 pass already correctly relabelled.

    CORRECT, no change (already TARGET-labelled by the 1921 pass): `docs/ARCHITECTURE.md:177,179,235` and the
    `/api/...` route table `:183-231`; `docs/BACKTESTER_DISTRIBUTION_PLAN.md:552`. External journal `/api/...`
    surfaces (Tortila `:8080`, journal_server) are not WTC routes — out of scope.

### Pattern 5 — "read-only methods are available immediately" (false; real adapters throw AdapterNotReadyError). 1 hit.

15. **[HIGH]** `docs/ARCHITECTURE.md:147`
    Current: `... Also exports \`MockTortilaAdapter\` and \`MockLegacyBotAdapter\` for dev and test. **Read-only methods are available immediately**; write/control methods (\`startBot\`, \`stopBot\`, \`applyConfig\`) are defined in the interface but throw \`NotImplementedError\` until a separately audited control adapter is approved (feature-flagged). ...`
    Corrected: `... Also exports \`MockTortilaAdapter\` and \`MockLegacyBotAdapter\` for dev and test. **Only the mock adapters are available today; the real read-only adapters are stubbed and throw \`AdapterNotReadyError\` until each endpoint mapping is verified** (\`packages/bot-adapters/src/http.ts\`). Write/control methods (\`startBot\`, \`stopBot\`, \`applyConfig\`) throw until a separately audited control adapter is approved (feature-flagged). ...`
    Evidence: `packages/bot-adapters/src/http.ts:14-16` real methods throw `AdapterNotReadyError`. (No other
    "immediately available" adapter claim found; the AXIOMA_HANDOFF_TOKEN_SPEC "immediately valid" / billing
    "immediately fires" hits are unrelated token-lifetime / dev-route wording — out of scope.)

### Pattern 6 — "TradingViewAccessService is DB-backed" / TV web service "fully implemented" (false; in-memory, deferred Part E). 2 hits.

16. **[HIGH]** `docs/CONTRACTS/tradingview-access.md:415`
    Current: `| \`TradingViewAccessService\` | Real | DB-backed; fully implemented |`
    Corrected: `| \`TradingViewAccessService\` | Mock/in-memory (web) | In-memory service (\`packages/tradingview-access/src/index.ts\`); DB TV repos exist in \`packages/db\` but the **web service/UI is NOT DB-backed yet** (deferred — Part E) |`

17. **[HIGH]** `docs/CONTRACTS/tradingview-access.md:416`
    Current: `| \`TvAdminService\` | Real | DB-backed; fully implemented |`
    Corrected: `| \`TvAdminService\` | Mock/in-memory (web) | Memory-backed admin queue today; DB-backed admin service is deferred (Part E) |`

    Related context (recommend tightening, lower priority):
    - **[MEDIUM]** `docs/CONTRACTS/tradingview-access.md:417-418` mark `runExpiryScheduler`/`processTasks` as
      "Real / Implemented". The worker **does** sweep + queue `tradingview_access_tasks` via `sweepTvExpiry`, but
      **nothing consumes** those tasks (no `processTasks` task-runner consumes the queue). Suggest `:418` →
      `| \`processTasks\` | Partial | Revoke tasks are **queued** (\`sweepTvExpiry\`) but **not consumed by any automation yet**; no task-runner drains the queue |`.
    - **[INFO]** `docs/CONTRACTS/tradingview-access.md:4` Status: `Mock/dev adapter implemented; real adapter
      stubbed (TODO)` — acceptable. `:16-18` implementation-location lists files (`service.ts`/`admin-service.ts`/
      `scheduler.ts`/`task-runner.ts`) and `docs/TRADINGVIEW_ACCESS_PLAN.md:527-549` lists a richer package layout
      that does **not** match the actual single `index.ts` memory service. This is structural drift (the contract
      describes a TARGET package shape), not one of the seven truth patterns — flag to the TV-access owner but
      out of strict scope here.
    - CORRECT, no change: `docs/STATUS.md:34,51`, `docs/IMPLEMENTED_FILES.md:24-27,40` already state TV web UI is
      in-memory / deferred Part E with the DB repos existing.

### Pattern 7 — `BOT_ADAPTER_MODE=real` (any `=real`; enum is mock|read-only|audited). 1 hit remains.

18. **[HIGH]** `docs/BOT_INTEGRATION_PLAN.md:326-327` (Mock/Dev Adapter mode table)
    Current:
    `| \`mock\` (default dev) | Returns static fixture data shaped exactly like real adapter outputs |`
    `| \`real\` | Connects to live journal/legacy endpoints |`
    Corrected (replace the `real` row with the two real enum values):
    `| \`read-only\` | Connects to the live journal/legacy endpoints for **reads only** (control still throws) |`
    `| \`audited\` | Read-only **plus** the audited live-control gate (still disabled until adapters pass audit) |`
    Evidence: `packages/config/src/env.ts` enum `mock|read-only|audited`; there is no `real`. The two adapter
    contracts were already fixed to `read-only` by the 1921 pass (`tortila-adapter.md:417-421`,
    `legacy-bot-adapter.md:388-392` now show `mock`/`read-only`) — `BOT_INTEGRATION_PLAN.md:327` is the last
    surviving `=real`-equivalent in current docs. (The `| real |` cells in `docs/IMPLEMENTED_FILES.md:15,18,19`
    are the "Real" implementation-status column, unrelated to the env value — leave.)

## Decisions

- Reported only what is STILL false after the 1921 docs-contracts-drift-auditor pass. That pass already
  fixed: all `BOT_ADAPTER_MODE=real` in the two adapter contracts, the unlabelled `/api/**` table in
  ARCHITECTURE §4 (`:177/:233`), README/DEPLOYMENT in-memory + Docker-absent framing, and the axioma-bridge
  status. Those are NOT re-listed except where a sibling hit was missed (Findings 14, 18).
- Treated a `| real |` *mode* table cell (BOT_INTEGRATION_PLAN:327) as in-scope for Pattern 7 — it is the
  `=real` value under a table layout, equally false against the enum — consistent with the 1921 auditor's
  same call on the adapter-contract tables.
- Did NOT flag the seed (`0000`) "PostgreSQL 16"/queue lines as HIGH: the seed is a frozen decision record and
  ADR-010 already supersedes it. Recommended only optional inline supersession notes (Findings 6, 13).
- Did NOT delete the DATA_MODEL job_queue SQL / claim pattern (Findings 8, 11) — it is legitimate TARGET design;
  it only needs RESERVED/TARGET framing so it is not read as currently running.
- Left external `/api/...` (Tortila :8080, journal_server) and the AXIOMA token "immediately valid" / billing
  dev-route "immediately fires" wording out of scope — not WTC route-handlers and not adapter-availability claims.

## Risks

- Most load-bearing: Findings 9/10/7 (ARCHITECTURE §6 + INTEGRATION_MAP §5) describe a polling `job_queue` +
  `SKIP LOCKED` worker that does not exist; an implementer could "wire" against a queue the code never consumes,
  or assume durability/retry guarantees that are absent (a worker crash currently loses in-progress reconcile —
  see `docs/handoffs/20260529-1921-integration-risk-auditor.md:88-97`).
- Finding 18 (`BOT_ADAPTER_MODE=real`) risks an operator setting an env value the zod enum rejects at boot — a
  deploy-time crash.
- Findings 16/17 over-claim TV as DB-backed; a reader could believe the web TV UI persists when it is in-memory
  (data lost on restart), and could de-prioritise Part E.
- Findings 1-5 (PostgreSQL 16) risk provisioning/CI against the wrong major version vs the live PG17 + ADR-010.
- Finding 15 over-claims real read-only adapter availability; a reader may expect live bot reads that actually
  throw `AdapterNotReadyError`.

## Verification/tests

Read-only audit; no tests run, no files changed. All claims verified by Read/Grep/Glob only. Key checks:
`packages/config/src/env.ts` enum = `mock|read-only|audited` (no `real`); `packages/bot-adapters/src/http.ts:14-16`
real methods throw `AdapterNotReadyError`; `packages/db/src/schema.ts:217-221` job_queue RESERVED/unconsumed
comment + no enqueue/dequeue in `apps/worker/src/{index.ts,jobs.ts}` (cron-style direct calls only; `jobs/` dir
empty); `packages/tradingview-access/src/index.ts` = in-memory `TvAccessService`/`createMemoryTvStore`; Glob
`apps/web/src/app/api/**` → no files (directory absent); `apps/web/src/lib/backend.ts` present. Post-edit re-greps
to confirm zero remaining hits: `rg -n "Postgres(ql)? 16|pg16" docs --glob '!docs/handoffs/**'`,
`rg -n "SKIP LOCKED|polls the .?job_queue" docs --glob '!docs/handoffs/**'`,
`rg -n "BOT_ADAPTER_MODE.?=.?real|\| .?real.? \| Connects" docs`, `rg -n "DB-backed; fully implemented" docs`,
`rg -n "available immediately" docs`, `rg -n "apps/web/api/billing" docs`.

## Next actions

- Doc owners apply Findings 1-18 with the exact corrected text above. By owner:
  platform-architect → ARCHITECTURE.md (3,4,7,9,12,14,15), INTEGRATION_MAP.md (2,10), ARCHITECTURE_DECISIONS
  is already correct; db-architect → DATA_MODEL.md (1,8,11); product-architect → MVP_SCOPE.md (5);
  bot-integration-auditor → BOT_INTEGRATION_PLAN.md (18); tradingview-access-implementer →
  CONTRACTS/tradingview-access.md (16,17, + :418 partial). Optional historical notes: seed (6,13).
- Task C canonical wording to standardise everywhere job_queue/worker is described:
  "**`job_queue` = RESERVED / future (scaffolding for a durable queue; no code enqueues or dequeues it).
  The worker uses cron-style direct repository calls (`reconcileAllEntitlements`/`sweepTvExpiry`/
  `recordHealthCheck`). There is no `SKIP LOCKED` consumer yet. `tradingview_access_tasks` rows ARE queued
  by `sweepTvExpiry` but are NOT consumed by any automation yet.**"
- After edits, run the re-greps in Verification → expect zero hits in current (non-handoff) docs.
- Out-of-scope but noted for a follow-up: TV-access contract package-layout drift
  (CONTRACTS/tradingview-access.md:16-18 + TRADINGVIEW_ACCESS_PLAN.md:527-549 describe files that do not exist).
