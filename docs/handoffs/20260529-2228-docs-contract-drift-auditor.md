# docs-contract-drift-auditor handoff

## Scope

Phase 1.6.1 Task C — targeted docs/contract drift cleanup (truth audit only; NO new
production integrations, NO code edits). READ-ONLY. I own DOCS drift in `docs/*` and `README.md`.
Targets: (1) `docs/MVP_SCOPE.md`, (2) `docs/CONTRACTS/tradingview-access.md`,
(3) `docs/DATA_MODEL.md`, (4) `docs/BACKTESTER_DISTRIBUTION_PLAN.md`, plus (5) six verification
grep families across docs/apps/packages/README to LOCATE every "TARGET-presented-as-CURRENT" claim.

Explicitly OUT of scope (owned by worker-jobqueue-truth-auditor, handoff
`docs/handoffs/20260529-2228-worker-jobqueue-truth-auditor.md`): `apps/worker/src/jobs.ts` source
comments. For apps/packages I only grep to LOCATE stray current-claims and report them; I do not
prescribe code edits there.

## Files inspected

Context: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`,
`docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`,
`docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md`,
`docs/handoffs/20260529-2052-docs-contract-truth-auditor.md`,
`docs/handoffs/20260529-2228-worker-jobqueue-truth-auditor.md`.

Reality verification (oracle = code, all CONFIRMED):
- `packages/tradingview-access/src/**` → Glob returns ONLY `index.ts`. Read confirms a single
  in-memory `TvAccessService` over `createMemoryTvStore` (a `Map`). NO `service.ts`,
  `admin-service.ts`, `scheduler.ts`, `task-runner.ts`.
- `packages/db/src/**` → `client.ts`, `index.ts`, `repositories.ts`, `schema.ts`, `seed.ts`,
  `seed-cli.ts`. NO `schema/` subdirectory; NO `ops.ts`. Single `schema.ts` (21 tables).
  `schema.ts:217-221` comment: `job_queue` "RESERVED — NOT YET CONSUMED". No `backtest_jobs`/
  `backtest_artifacts` table anywhere in `packages` (grep → 0 hits in packages).
- `packages/db/src/repositories.ts` → separate async DB repos (TV repos: `submitTvRequest`,
  `grantTv`, `revokeTv`, `sweepTvExpiry`, etc.).
- `packages/backtester/` → `package.json` + `src/index.ts` only (job/result type model; no runner,
  no DB table; per `docs/IMPLEMENTED_FILES.md:41`).
- `apps/web/**` → Glob confirms NO `apps/web/src/app/api/**` directory (only route-group page.tsx
  files + `src/lib/*`). Web app uses server actions + `apps/web/src/lib/backend.ts`.
- ADR-010 (`docs/ARCHITECTURE_DECISIONS.md:61`): Postgres standardised to 17; "PostgreSQL 16" is the
  superseded value, not current.

Audit-target docs read in full or to the relevant sections: `docs/MVP_SCOPE.md`,
`docs/CONTRACTS/tradingview-access.md`, `docs/DATA_MODEL.md`,
`docs/BACKTESTER_DISTRIBUTION_PLAN.md`, `README.md`, `docs/ARCHITECTURE_DECISIONS.md`,
`docs/TRADINGVIEW_ACCESS_PLAN.md`.

## Files changed

None — read-only audit

## Findings

Severity: HIGH = false current claim an agent would act on (non-existent file/table/route);
MEDIUM = misleading current claim / stale pointer; INFO = context only.

IMPORTANT pre-note: Phase 1.6 (the 2052 pass) already corrected MANY of the seven classic patterns
in `docs/ARCHITECTURE.md`, `docs/INTEGRATION_MAP.md`, `docs/DATA_MODEL.md §8.5`,
`docs/CONTRACTS/tradingview-access.md` (Mock-vs-Real table §"Mock vs Real Status"), `README.md`,
`docs/STATUS.md`. Those are now OK and are listed under "OK-as-labelled". The NEEDS-FIX items below
are the **residual** drift that the 2052 pass did NOT cover — primarily the `schema/ops.ts` split,
the non-existent TV multi-file layout, and the `backtest_jobs` table presented as current.

---

### Target 1 — docs/MVP_SCOPE.md

No NEEDS-FIX in MVP_SCOPE.md. Verified:
- `:94` already reads `| PostgreSQL 17 + Drizzle schema + migrations | Real | ... |` (PG fixed in 2052).
- `:124` `Job stored in \`job_queue\`; runner not wired until BACKTESTER_DISTRIBUTION_PLAN.md approved`
  and `:156` `Job type exists in \`job_queue\`; worker cron not running at MVP` — both are
  MOCK/deferred-labelled ("**MOCK** runner", "**MOCK** execution", "worker cron not running at MVP"),
  not current-wired claims. Classification: OK-as-labelled (borderline; see Risks — a fixer may
  optionally add "RESERVED/unconsumed" for `job_queue`, but it is not a false CURRENT claim today).
- No `TradingViewAccessService DB-backed`, no `BOT_ADAPTER_MODE=real`, no `apps/web/src/app/api`,
  no `SKIP LOCKED` in this file.

The prompt's hypothesis (TV UI/grants/scheduler/job_queue "production-wired NOW") is NOT present in
MVP_SCOPE.md — §2.6 already says "no automation", "**EXCLUDED** from MVP", "worker cron not running
at MVP". So Target 1 = clean.

---

### Target 2 — docs/CONTRACTS/tradingview-access.md

The "Mock vs Real Status" table (`:415-418`) was already corrected by the 2052 pass (OK). The
residual drift is the **structural** description that still presents a 4-file package + async
Postgres API + a live scheduler/task-runner as CURRENT.

**Finding 1 — HIGH — NEEDS FIX**
- Evidence: `docs/CONTRACTS/tradingview-access.md:16`
- Current: `| **Implementation location** | \`packages/tradingview-access/src/service.ts\`, \`admin-service.ts\`, \`scheduler.ts\`, \`task-runner.ts\` |`
- Corrected: `| **Implementation location (CURRENT)** | \`packages/tradingview-access/src/index.ts\` — single in-memory \`TvAccessService\` (memory \`Map\`). DB persistence is separate: \`packages/db/src/repositories.ts\` (\`submitTvRequest\`/\`grantTv\`/\`revokeTv\`/\`sweepTvExpiry\`) over \`tradingview_access_requests\`/\`tradingview_access_tasks\` in \`packages/db/src/schema.ts\`. |`
  `| **Implementation location (TARGET, Phase 2)** | the multi-file split \`service.ts\` / \`admin-service.ts\` / \`scheduler.ts\` / \`task-runner.ts\` — NOT yet created. |`
- Classification: NEEDS FIX. Glob proves these four files do not exist.

**Finding 2 — HIGH — NEEDS FIX**
- Evidence: `docs/CONTRACTS/tradingview-access.md:18`
- Current: `| **Worker host** | \`apps/worker\` (scheduler + task runner) |`
- Corrected: `| **Worker host (CURRENT)** | \`apps/worker\` runs a cron-style sweep (\`sweepTvExpiry\`) that marks expiry + **queues** \`tradingview_access_tasks\`. There is NO scheduler loop and NO task-runner consuming those tasks yet (TARGET, Phase 2). |`
- Classification: NEEDS FIX (no scheduler/task-runner exists; tasks queued but unconsumed).

**Finding 3 — HIGH — NEEDS FIX**
- Evidence: `docs/CONTRACTS/tradingview-access.md:52` and `:105` (both `**Location:** \`packages/tradingview-access/src/service.ts\``); `:192` (`admin-service.ts`); `:289` (`scheduler.ts`); `:310` (`task-runner.ts`).
- Current (representative, `:52`): `**Location:** \`packages/tradingview-access/src/service.ts\``
- Corrected: prefix the contract body with a single TARGET banner so every `**Location:**` below is read as target, e.g. insert after the title: `> **CONTRACT IS TARGET.** The function/file locations below describe the planned multi-file DB-backed package. CURRENT code is the single in-memory \`packages/tradingview-access/src/index.ts\`; see the Implementation-location row.` (Per-line alternative: change each `src/service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts` `**Location:**` to `**Location (TARGET):**`.)
- Classification: NEEDS FIX (5 file pointers to non-existent files presented as current locations).

**Finding 4 — MEDIUM — NEEDS FIX**
- Evidence: `docs/CONTRACTS/tradingview-access.md:17`
- Current: `| **Exposed via** | Next.js server actions + route handlers in \`apps/web\` |`
- Corrected: `| **Exposed via** | Next.js server actions in \`apps/web\` (CURRENT). Route handlers under \`apps/web/src/app/api/\` are TARGET — no such directory exists today. |`
- Classification: NEEDS FIX (route handlers do not exist; §"Endpoint/Function Boundary":44 even says "Route handlers are used only for admin list/search" as if present).

Note: the long API spec (`submitTvUsername`/`adminGrantAccess`/`GET /api/admin/tradingview-access`/
`runExpiryScheduler`/`processTasks`, request/response/error/idempotency sections) describes a
DB-backed async surface that is the TARGET; the single TARGET banner from Finding 3 covers it.
The "read-only methods are available immediately" string is NOT in this file (grep → 0 hits here;
that pattern lived in ARCHITECTURE.md and was already fixed in 2052).

---

### Target 3 — docs/DATA_MODEL.md

§8.5 `job_queue` (`:923-947`) and the SKIP-LOCKED SQL block (`:947`) were already TARGET-labelled by
the 2052 pass (OK). The residual drift is the **`schema/ops.ts` / one-file-per-context** claim,
which is false against the single `schema.ts`.

**Finding 5 — MEDIUM — NEEDS FIX**
- Evidence: `docs/DATA_MODEL.md:18`
- Current: `- Drizzle schema lives in \`packages/db/src/schema/\` with one file per bounded context.`
- Corrected: `- CURRENT: the Drizzle schema is a SINGLE file \`packages/db/src/schema.ts\`. TARGET (Phase 2): MAY split into \`packages/db/src/schema/\` with one file per bounded context.`
- Classification: NEEDS FIX (no `schema/` directory exists).

**Finding 6 — HIGH — NEEDS FIX (8 sibling lines, same root cause)**
- Evidence — every per-context "Package file" header asserting a `schema/<x>.ts` that does not exist:
  `:28` `packages/db/src/schema/identity.ts`; `:126` `…/products.ts`; `:247` `…/secrets.ts`;
  `:324` `…/bots.ts`; `:534` `…/axioma.ts`; `:620` `…/tradingview.ts`; `:710` `…/education.ts`;
  `:840` `…/ops.ts`.
- Current (representative, `:28`): `**Package file**: \`packages/db/src/schema/identity.ts\``
- Corrected: either (a) add a one-line note under §0 Conventions — `> NOTE: all "Package file" lines below name the TARGET split layout; CURRENT code places every table in the single \`packages/db/src/schema.ts\`.` — and leave the per-section headers, OR (b) change each header to `**Package file (TARGET split)**: \`packages/db/src/schema/<x>.ts\` — CURRENT: \`packages/db/src/schema.ts\``.
- Classification: NEEDS FIX (none of these 8 files exist; only `schema.ts`).

**Finding 7 — MEDIUM — NEEDS FIX**
- Evidence: `docs/DATA_MODEL.md:1103` (inside the drizzle-kit config snippet)
- Current: `  schema: './src/schema/index.ts',`
- Corrected: `  schema: './src/schema.ts',   // CURRENT single-file schema (TARGET split would use ./src/schema/index.ts)`
- Classification: NEEDS FIX (points drizzle-kit at a non-existent `./src/schema/index.ts`; the real config uses the single file).

**Finding 8 — HIGH — NEEDS FIX**
- Evidence: `docs/DATA_MODEL.md:963` (§8.6 `backtest_jobs` header) and `:987` (§8.7
  `backtest_results` header) — both table definitions are presented in the same "current schema"
  §8 Ops context as the live tables, with no TARGET marker.
- Current (header `:963`): `### 8.6 \`backtest_jobs\` (sub-context within Bots, stored in Ops for job management)`
- Corrected: prefix §8.6 (`:963`) and §8.7 (`:987`) with `**(TARGET — NOT implemented.** No \`backtest_jobs\`/\`backtest_results\` table exists in \`packages/db/src/schema.ts\`; the backtester is Phase 2.)`
- Classification: NEEDS FIX (no such tables in schema.ts; grep `backtest_jobs` in packages → 0 hits).

**Finding 9 — MEDIUM — NEEDS FIX**
- Evidence: `docs/DATA_MODEL.md:1223`
- Current: `- \`backtest_jobs\` is placed in \`packages/db/src/schema/ops.ts\` (alongside \`job_queue\`) but logically belongs to the Bots bounded context. Drizzle schema file placement can be moved if the team decides to split the ops schema further.`
- Corrected: `- TARGET: \`backtest_jobs\` would live alongside \`job_queue\` (today in the single \`packages/db/src/schema.ts\`; a future split could use \`schema/ops.ts\`). \`backtest_jobs\` is not implemented yet.`
- Classification: NEEDS FIX (`schema/ops.ts` non-existent; `backtest_jobs` non-existent).

(Lines `:1081` "…job_queue, backtest_jobs, backtest_results" and `:1215` job_queue index row are
part of the same TARGET schema-reference tables; folding them under the Finding-6/8 TARGET banners
is sufficient — they are schema-reference, not "running now" claims. MEDIUM, covered.)

---

### Target 4 — docs/BACKTESTER_DISTRIBUTION_PLAN.md

The doc header (`:4` "Status: Phase 0 — design only; no compute runs from the web tier") and the API
section (`:552` "TARGET (not yet implemented): All routes are in \`apps/web/src/app/api/...\`") are
already correct/labelled (OK — the latter was fixed in the 1921/2052 passes). The residual drift is
the §8 database-schema pointer to `schema/ops.ts`.

**Finding 10 — HIGH — NEEDS FIX**
- Evidence: `docs/BACKTESTER_DISTRIBUTION_PLAN.md:414`
- Current: `The backtest tables live in the \`Ops\` bounded context alongside \`job_queue\`. They are defined in \`packages/db/src/schema/ops.ts\`.`
- Corrected: `TARGET (NOT implemented): the backtest tables would live alongside \`job_queue\` in \`packages/db/src/schema.ts\` (a future split could add \`schema/ops.ts\`). Today there is no \`backtest_jobs\`/\`backtest_artifacts\` table and no \`schema/ops.ts\` file.`
- Classification: NEEDS FIX (`schema/ops.ts` and the two tables do not exist).

Note: the `CREATE TABLE backtest_jobs (...)` / `backtest_artifacts (...)` SQL at `:416-454` is design
SQL; the §8 lead-in correction (Finding 10) plus the doc-level "design only" Status banner is enough
— do not present it as applied. (Optionally prefix the SQL block "TARGET DDL — not migrated".)

---

### Target 5 — Verification grep families (full results table)

| # | Pattern | Scope | Hits (file:line) | Classification |
|---|---|---|---|---|
| 1 | `BOT_ADAPTER_MODE=real` | docs + README | NONE in current docs/README. (All hits are inside historical handoffs `docs/handoffs/2026*` quoting the pattern, plus `docs/STATUS.md:27` which is a past-tense "corrected … `BOT_ADAPTER_MODE=real`" changelog line.) | OK — no current claim. STATUS.md:27 = historical changelog (OK). |
| 2 | `PostgreSQL 16` / `Postgres 16` | docs + README + packages + apps | `docs/ARCHITECTURE_DECISIONS.md:61` (ADR-010 title "supersedes seed's PostgreSQL 16"); `:62` (ADR-010 Context); `docs/handoffs/0000-orchestrator-seed.md:48` (seed lock, already carries "_(Superseded → PostgreSQL 17; see ADR-010.)_"); `docs/STATUS.md:26` (changelog "PostgreSQL 16→17"); all other hits = `docs/handoffs/2026*` historical. README.md / DATA_MODEL.md / MVP_SCOPE.md already say 17. | OK — all are ADR-010 / seed-supersede / historical. NO new current "16" claim. |
| 3 | `apps/web/src/app/api` / `apps/web/api` | docs + README | `docs/ARCHITECTURE.md:135,177,179,235` (all explicitly "TARGET (planned), not current"); `docs/BACKTESTER_DISTRIBUTION_PLAN.md:552` ("TARGET (not yet implemented)"); `docs/IMPLEMENTED_FILES.md:8` ("There is **no** …"). Residual: `docs/CONTRACTS/tradingview-access.md:17` "server actions + route handlers in apps/web" (Finding 4). | OK except Finding 4 (NEEDS FIX). README has no hit. |
| 4 | `read-only methods are available immediately` | docs + README | NONE in current docs/README (only the 2052 auditor handoff quotes it). The ARCHITECTURE.md:147 source was fixed in 2052. | OK — no current claim. |
| 5 | `TradingViewAccessService.*DB-backed` / `DB-backed.*fully implemented` | docs + README | `docs/CONTRACTS/tradingview-access.md:415-416` now read "Mock/in-memory (web) … NOT DB-backed yet" (fixed 2052). `docs/STATUS.md:27` = historical changelog. No `| Real | DB-backed; fully implemented |` cell remains. | OK — already corrected. |
| 6a | `polls the job_queue` | docs + apps + packages + README | NONE (the ARCHITECTURE.md/README current claims were removed in 2052; `apps/worker/src/jobs.ts` comment is the worker-auditor's scope, not a docs hit). | OK in docs. |
| 6b | `SKIP LOCKED` (any) | docs + apps + packages + README | `docs/ARCHITECTURE.md:296` ("no `SKIP LOCKED` claim implemented yet … A future durable queue would use …" — TARGET-labelled, OK); `docs/DATA_MODEL.md:957` (inside the `:947` "Worker claim pattern (TARGET — not implemented…)" block, OK); `packages/db/src/schema.ts:218` (RESERVED comment, OK); rest = `docs/handoffs/*` historical. | OK — every current-doc hit is TARGET/RESERVED-labelled. |
| 6c | `FOR UPDATE SKIP LOCKED` | docs + apps + packages + README | `docs/DATA_MODEL.md:957` (TARGET block, OK); `docs/ARCHITECTURE.md:296` (TARGET, OK); `packages/db/src/schema.ts:218` (RESERVED, OK). | OK — TARGET/RESERVED. |
| 6d | `schema/ops.ts` / `schema/<x>.ts` | docs + apps + packages + README | `docs/DATA_MODEL.md:18,28,126,247,324,534,620,840,1103,1223` (Findings 5,6,7,9); `docs/BACKTESTER_DISTRIBUTION_PLAN.md:414` (Finding 10); `docs/handoffs/*` historical (OK). | NEEDS FIX (Findings 5-10). |

SKIP-LOCKED disambiguation (as required): the ONLY current-doc SKIP-LOCKED occurrences
(`ARCHITECTURE.md:296`, `DATA_MODEL.md:947-957`) are explicitly framed as a future/TARGET durable-queue
design, and `schema.ts:218` is a RESERVED comment — all OK. There is NO current-claim SKIP-LOCKED in
docs. (The one current-claim SKIP-LOCKED in the repo is `apps/worker/src/jobs.ts:12`, which belongs to
the worker-jobqueue-truth-auditor — see "Out of scope" below.)

---

### OK-as-labelled (verified, no fix)

- `docs/ARCHITECTURE.md:135,177,179,235,283,296` and repo-tree `:41,:111` — all already CURRENT-vs-TARGET
  / RESERVED-labelled by the 2052 pass.
- `docs/INTEGRATION_MAP.md:285` — "no cross-process queue … `job_queue` … RESERVED" (fixed).
- `docs/DATA_MODEL.md:9` (PG17), `:925` (job_queue RESERVED), `:947-961` (SKIP-LOCKED TARGET block).
- `docs/CONTRACTS/tradingview-access.md:4` Status, `:415-418` Mock-vs-Real table.
- `docs/MVP_SCOPE.md:94` (PG17), `:124`,`:156` (MOCK/deferred-labelled).
- `docs/BACKTESTER_DISTRIBUTION_PLAN.md:4` (design-only), `:552` (TARGET routes).
- `README.md` — clean: no PostgreSQL-16, no `BOT_ADAPTER_MODE`, no `apps/web/src/app/api`, no
  job_queue/SKIP-LOCKED current claim.
- `docs/ARCHITECTURE_DECISIONS.md:61-62`, `docs/handoffs/0000-orchestrator-seed.md:48,54` — ADR /
  seed-supersede notes (historical, OK).
- `packages/db/src/schema.ts:217-221` — RESERVED job_queue comment (source, OK).

### Out of scope (located, not owned by this auditor)

- `apps/worker/src/jobs.ts:12` — `// Worker sweep loop: polls the job_queue using SKIP LOCKED (FOR
  UPDATE SKIP LOCKED).` — a FALSE current-claim in worker SOURCE. Owned by
  worker-jobqueue-truth-auditor (see `docs/handoffs/20260529-2228-worker-jobqueue-truth-auditor.md`).
  Reported for completeness only; no doc edit prescribed here.

## Decisions

- Reported only **residual** drift left after the Phase-1.6 (2052) truth pass; did not re-list the
  patterns it already fixed (PG16→17, ARCHITECTURE/INTEGRATION_MAP job_queue/SKIP-LOCKED,
  TV Mock-vs-Real table, README). This keeps the fixer focused on what is still false.
- Treated the `schema/ops.ts` / one-file-per-context layout as the single largest residual: it recurs
  across DATA_MODEL.md (10 lines) and BACKTESTER_DISTRIBUTION_PLAN.md (1 line). Recommended a
  doc-level CURRENT-vs-TARGET banner per file plus targeted line edits, rather than 11 isolated edits.
- The TV contract's rich API spec and the backtester DDL are legitimate TARGET designs — recommend
  TARGET banners, not deletion.
- Did NOT flag MVP_SCOPE.md `job_queue` MOCK lines as NEEDS FIX: they are deferred/MOCK-labelled, not
  false CURRENT claims (noted as borderline in Risks).
- No files edited (read-only). Fixes deferred to Phase 1.6.2.

## Risks

- Highest: `schema/ops.ts` appears in 11 current-doc lines. A fixer that patches only some leaves the
  doc internally inconsistent (and a future agent could `import` from a non-existent path). The fixer
  must address all of Findings 5-10.
- The TV contract (Findings 1-4) still reads, in its body, like a built DB-backed multi-file service;
  without the TARGET banner an implementer may believe `service.ts`/`scheduler.ts`/`task-runner.ts`
  exist and wire against them.
- `backtest_jobs`/`backtest_results` (Findings 8-10) presented in the "current schema" section could
  lead someone to assume the tables exist; they do not.
- Borderline (NOT counted as NEEDS FIX): MVP_SCOPE.md:124/156 say jobs are "stored in `job_queue`".
  Since `job_queue` is RESERVED/unconsumed, a fixer MAY add "(RESERVED/unconsumed)" for full
  precision, but the MOCK/deferred framing already prevents a false "it works now" reading.
- If the 1.6.2 fixer rewrites whole sections, line numbers shift — match on the quoted CURRENT text.
- Platform remains not production-ready (unchanged).

## Verification/tests

None — read-only audit. No npm/tests/builds/git run. Reality confirmed via Glob/find/Read of source;
drift located via ripgrep (read-only) over docs/apps/packages/README. Key oracle checks:
Glob `packages/tradingview-access/src/**` → only `index.ts`; Glob `packages/db/src/**` → no `schema/`
dir, no `ops.ts`; Glob `apps/web/src/app/api/**` → none; grep `backtest_jobs` in `packages` → 0 hits;
`packages/db/src/schema.ts:217-221` job_queue RESERVED. Grep families 1-6 results are in the Target-5
table above.

Post-fix re-greps the 1.6.2 fixer should run (expect zero current-doc hits after edits):
- `rg -n "schema/ops\.ts|src/schema/[a-z]+\.ts" docs --glob '!docs/handoffs/**'`
- `rg -n "src/service\.ts|admin-service\.ts|scheduler\.ts|task-runner\.ts" docs/CONTRACTS/tradingview-access.md`
- `rg -n "backtest_jobs|backtest_artifacts|backtest_results" docs --glob '!docs/handoffs/**'` (expect only TARGET-labelled)

## Next actions

- Phase 1.6.2 fixer applies Findings 1-10 (match on quoted CURRENT text). Suggested owners:
  tradingview-access-implementer → CONTRACTS/tradingview-access.md (1-4); db-architect →
  DATA_MODEL.md (5-9); backtester-architect → BACKTESTER_DISTRIBUTION_PLAN.md (10).
- Add a one-line CURRENT-vs-TARGET banner at the top of CONTRACTS/tradingview-access.md, DATA_MODEL.md,
  and BACKTESTER_DISTRIBUTION_PLAN.md to prevent recurrence.
- Worker-jobqueue-truth-auditor / 1.6.2 fixer handles `apps/worker/src/jobs.ts:12`.
- After fixes, run the re-greps in Verification → expect zero residual current-claims.
