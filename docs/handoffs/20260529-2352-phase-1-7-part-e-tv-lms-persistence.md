# Phase 1.7 — Part E Readiness + TradingView DB Persistence + LMS Persistence Decision (aggregate handoff)

_2026-05-29 23:52 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by **7 background read-only auditors**, each with its own per-agent handoff file (cited below) — a real
N-agent run, mechanically verified by `npm run governance:check` (N-claim backed by **cited** per-agent links).
No live servers/SSH/bots touched; real adapters/billing stay mock; no Axioma production handoff; no TradingView
automation; no real `db:migrate`/`db:seed` (no `DATABASE_URL`); **not** production-ready._

## Scope

Phase 1.7 Tasks A–G: (A) pre-flight source-of-truth cleanup (truth only, label TARGET); (B) DB-wire the
**existing** TradingView web UI behind an async, fail-closed service selector (no TV automation); (C) decide +
implement the LMS persistence approach (**Option 1 — thin model**) and write the Phase 1.8 prompt for the full
contract; (D) TV + LMS integration tests + e2e; (E) real-Postgres gate (kept NOT RUN) + CI mapping; (F) the
sequential 10-gate run; (G) this aggregate + truth-doc updates + final report. Out of scope / unchanged: live
bot control, real adapters/billing, Axioma production handoff, TradingView automation, the full LMS contract
(→ Phase 1.8), real Postgres execution.

## Agents launched (all closed — see "Background agents")

7 read-only auditors (background `general-purpose` agents, run as one parallel Workflow fan-out). Each wrote a
per-agent handoff in canonical format (`## Files changed` = "None — read-only audit"):

1. `source-of-truth-drift-auditor` → [`20260529-2352-source-of-truth-drift-auditor.md`](20260529-2352-source-of-truth-drift-auditor.md)
2. `tradingview-persistence-auditor` → [`20260529-2352-tradingview-persistence-auditor.md`](20260529-2352-tradingview-persistence-auditor.md)
3. `lms-schema-gap-auditor` → [`20260529-2352-lms-schema-gap-auditor.md`](20260529-2352-lms-schema-gap-auditor.md)
4. `db-repository-auditor` → [`20260529-2352-db-repository-auditor.md`](20260529-2352-db-repository-auditor.md)
5. `frontend-callsite-auditor` → [`20260529-2352-frontend-callsite-auditor.md`](20260529-2352-frontend-callsite-auditor.md)
6. `qa-gates-auditor` → [`20260529-2352-qa-gates-auditor.md`](20260529-2352-qa-gates-auditor.md)
7. `security-runtime-config-auditor` → [`20260529-2352-security-runtime-config-auditor.md`](20260529-2352-security-runtime-config-auditor.md)

## Files changed

**A — source-of-truth cleanup (docs):** `docs/SECRET_VAULT_DESIGN.md` (env names → `SECRET_VAULT_KEK` /
`SECRET_VAULT_KEY_ID`; the per-keyId `WTC_VAULT_KEK_*` / `WTC_VAULT_ACTIVE_KEY_ID` scheme labelled **TARGET —
not implemented**; corrected the false "`packages/crypto/src/vault.ts` reads env" → crypto takes the KEK as an
argument, the app boundary `apps/web/src/lib/vault.ts` reads env; implemented record = `SealedSecret` base64,
hex residue dropped), `docs/NEXT_ACTIONS.md` (stale "Vitest 64" / "25.07/61.26" → defer to STATUS; boot-time
`loadEnv` marked **DONE in 1.6.1** via `instrumentation.ts`; real-PG harness marked existing; real-PG gate
stays NOT RUN), `docs/DATA_MODEL.md` (§8 `schema/ops.ts` pointer → `schema.ts`; split = TARGET),
`docs/MVP_SCOPE.md` (`job_queue` RESERVED/unconsumed on the backtester + scheduler cells),
`docs/OPEN_QUESTIONS.md` (KEK custody Q: implemented env var is `SECRET_VAULT_KEK`; per-keyId naming = TARGET).

**B — TradingView DB wiring:** `packages/audit/src/audit.ts` (+`tradingview.submit`, `+education.course_create`),
`packages/db/src/repositories.ts` (`submitTvRequest`/`grantTv`/`revokeTv` now **transactional + audit in the
same txn**; `revokeTv` actor/time made live; `auditRowValues(input, now?)`; new `TvRequestDTO` + `rowToTvDto`
epoch-ms normalizer), `apps/web/src/lib/tv-types.ts` (**new** — async `TvService` + `TvRequestView`),
`apps/web/src/lib/db-store.ts` (DB-backed `tvService`), `apps/web/src/lib/demo.ts` (in-memory async `tvService`
adapter, audit→memory sink; seed awaits), `apps/web/src/lib/backend.ts` (`DENIED_MSG`; fail-closed `tvService`
selector; `tvStore` export removed), `apps/web/src/app/(app)/app/indicators/page.tsx`,
`apps/web/src/app/admin/tradingview-access/page.tsx`, `apps/web/src/app/admin/page.tsx` (awaits +
`tvStore`→`tvService` + backend-aware storage badges).

**C — LMS Option 1 (thin):** `packages/db/src/repositories.ts` (Education section: `createCourse`
[txn+audit], `listCoursesForTeacher`, `listPublishedCourses`, `listLessonsForStudent` [fail-closed] +
`CourseDTO`/`LessonDTO` + mappers — **no new migration**, reuses migration `0000`), `apps/web/src/lib/lms-types.ts`
(**new** — async `LmsService` + `CourseView`/`LessonView`), `apps/web/src/lib/db-store.ts` (DB `lmsService`),
`apps/web/src/lib/demo.ts` (in-memory async `lmsService`; `lmsStore` export removed), `apps/web/src/lib/backend.ts`
(fail-closed `lmsService` selector), `apps/web/src/app/teacher/page.tsx`,
`apps/web/src/app/(app)/app/education/page.tsx` (awaits + `Promise.all` lesson fetch + backend-aware badge),
`docs/EDUCATION_LMS_PLAN.md` (Part-E thin-only status banner + §18 clarifier + **§20 Phase 1.8 prompt**),
`docs/TRADINGVIEW_ACCESS_PLAN.md` (Phase 1.7 status + manual-workflow decision).

**D — tests:** `tests/integration/db-persistence.test.ts` (+9: TV audit/DTO/admin-list/revoke/sweep-idempotency,
LMS create+audit/teacher-admin-visibility/published-only/fail-closed-lessons), `tests/e2e/smoke.spec.ts`
(+indicators/education/teacher heading specs + admin TV-row assertion).

**E — CI:** `.github/workflows/ci.yml` (`REAL_POSTGRES_DATABASE_URL` → a fresh `wtc_test`, dropped/created
before Test and Coverage; **STAGED + UNVERIFIED** — CI is inert until git + a remote exist).

**F/G — truth docs:** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

## Findings → fixes

- **source-of-truth-drift (10 findings):** `SECRET_VAULT_DESIGN.md` was the worst drift (wrong env-var names,
  false "crypto reads env", hex residue) → corrected, multi-key scheme labelled TARGET. Stale counts +
  already-closed 1.6.1 items in `NEXT_ACTIONS.md`, the un-TARGET'd `schema/ops.ts` pointer in `DATA_MODEL.md:843`,
  and the `job_queue` backtester/scheduler cells in `MVP_SCOPE.md` → fixed. Verified-already-truthful (NO edit):
  worker headers (`apps/worker/src/{index,jobs}.ts`) and the MVP_SCOPE TV-UI claim — left untouched. The rg
  sweep (`Vitest 64|25.07|61.26|…WTC_VAULT|schema/ops.ts|job_queue.*production|TV web.*DB-backed`) over
  docs/apps/packages now returns only TARGET / historical-handoff / design-context hits.
- **tradingview-persistence + db-repository + qa-gates + security (TV):** the DB TV repos existed and were
  worker-proven but the web UI was wired to memory **unconditionally** (`backend.ts`), and submit/grant/revoke
  wrote **no audit rows**; `revokeTv` discarded its actor; raw `Date` rows would mis-render via `fmtDate`.
  Fixes: async `TvService` (typecheck now catches a missing `await`), DB+memory adapters, fail-closed selector,
  in-repo in-txn audit (`tradingview.submit`/`.grant`/`.revoke`, admin actor recorded), `rowToTvDto` epoch-ms
  DTO. TV username confirmed public (safe in audit; not redacted). Badges now driven by `backendMode`.
- **lms-schema-gap + db-repository + qa-gates (LMS):** thin `courses`/`lessons`/`materials` already exist
  (migration `0000`) and match `@wtc/lms` 1:1, but ZERO education repos existed and LMS was pinned to memory.
  → Added 4 repos (no migration), async `LmsService`, DB+memory adapters, fail-closed selector, awaited the 2
  call sites (education's per-row lesson fetch refactored to `Promise.all`).
- **frontend-callsite:** verified all 10 sync call sites; current line numbers + the 3 `storage: in-memory (demo)`
  badges located. All enclosing functions were already `async`, so awaits are legal; the async interfaces make a
  dropped `await` a hard typecheck error.
- **qa-gates / security (gates + config):** the PGlite `db-persistence.test.ts` pattern was reused for the new
  TV/LMS tests; `ci.yml` did not map `REAL_POSTGRES_DATABASE_URL` (silent skip) → mapped (staged); Part-A runtime
  truths confirmed (boot `loadEnv` real via `instrumentation.ts`; `SECRET_VAULT_KEK` base64-32; `parseKek` takes
  the KEK as an argument). No new env var introduced.

## Decisions

- **Audit-then-operator-implement** (7 read-only auditors → operator synthesis + serial implementation): TV and
  LMS share write scopes (`repositories.ts`, `backend.ts`, `db-store.ts`, `demo.ts`), so implementation was **not**
  parallelised — only the audit fan-out was.
- **LMS = Option 1 (thin), per the operator's explicit instruction**, resolving a real auditor split:
  `lms-schema-gap` + `db-repository` + `qa-gates` gave a bounded Option-1 plan (no migration; ~4 repos);
  `frontend-callsite` cautioned LMS is greenfield-repos (riskier than TV's pure wiring). Mitigation: TV shipped +
  typechecked **first** (independently green), then the bounded LMS add; a Rule-7 STOP was reserved if scope
  degraded (not triggered). Full LMS contract → **Phase 1.8 prompt** (`EDUCATION_LMS_PLAN.md` §20).
- **TV/LMS audit lives IN the repo, in-txn** (canonical `grantProduct` pattern; 3 auditors) rather than the
  app adapter — more robust and needed no schema change (`revokeTv` already received the actor).
- **TradingView manual workflow:** KEEP the queued-but-unconsumed revoke task; **no** mark-done/cancel control
  this phase (it would imply a workflow that does not exist; `job_queue` is RESERVED). Documented in
  `TRADINGVIEW_ACCESS_PLAN.md`.
- **Real Postgres stays NOT RUN** (no `DATABASE_URL`/creds); CI mapping added in the safe fresh-`wtc_test`-per-run
  form and labelled **STAGED + UNVERIFIED** (CI inert). The harness is left **non-destructive** (it fails loud if
  pointed at a populated DB — no `DROP SCHEMA` footgun).

## Risks

- **Blast radius:** TV + LMS Option 1 touched the shared persistence layer (`repositories.ts`, `backend.ts`,
  `db-store.ts`, `demo.ts`). Mitigated by gates (typecheck/test/build/e2e) and TV-first sequencing.
- **CI real-PG mapping is UNVERIFIED** — CI cannot run here (not a git repo). The fresh-DB-per-run logic is sound
  but must be confirmed on the first real CI run; until then PGlite (`db-persistence.test.ts`) is the active
  real-engine coverage and real `db:migrate`/`db:seed` = NOT RUN.
- **In-memory vs DB audit asymmetry:** the DB path audits in the repo txn; the memory path audits in the adapter
  (the in-memory service has no txn). Both emit the same actions; documented in `db-store.ts`/`demo.ts`.
- **`tradingview_access_tasks` still accumulate unconsumed** (no executor) — by design this phase; flagged for a
  future task-runner/cleanup (Phase 1.8+).
- **Pre-existing doc drift left intentionally:** `TRADINGVIEW_ACCESS_PLAN.md` / `MVP_SCOPE.md` still name
  `tradingview_profiles` / `tradingview_access_grants` tables — now explicitly labelled TARGET (current storage
  is `tradingview_access_requests` + `tradingview_access_tasks`).

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

_Strictly-sequential Part-F run on the final tree (no :3100/:3000 listener; `apps/web/.next`, `test-results`,
`coverage` safe-cleaned first). All 10 gates GREEN:_

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — current phase 20260529-2352; **max 7 ≤ 7 cited** per-agent handoffs; 0 errors, 1 warning (allowlisted 1921 historical) |
| 2 | `npm run check:core` | **PASS** (7 zero-install smokes) |
| 3 | `npm run lint` | **PASS** (exit 0, `--max-warnings 0`) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm test` (Vitest) | **PASS — 93 passed / 5 skipped (98)** across 14 files (`db-persistence` now 19: +9 TV/LMS) |
| 7 | `npm run secret:scan` | **PASS** (clean) |
| 8 | `npm run coverage` | **PASS — 26.92% stmts / 64.67% branch** (branch ↑ from 63.77; stmts ≈ 26.96) |
| 9 | `npm run build -w @wtc/web` | **PASS** (compiled 12.1s; 31/31 pages) — no `SECRET_VAULT_KEK` ⇒ `instrumentation.ts` `register()` not run at build |
| 10 | `npm run e2e` (Playwright, `CI=1`) | **PASS 14/14** (desktop + mobile; +indicators/education/teacher specs; no flake) |
| — | `db:migrate`/`db:seed` against **real Postgres** | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; opt-in harness skipped (5 cases). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety policy): SSH/live servers, live bot control, real adapters/billing, Axioma production
handoff, TradingView automation.

## Background agents — closed

All 7 Phase-1.7 auditors ran as a single Workflow fan-out that **completed** (one completion notification; none
left running). Their per-agent handoffs exist on disk at the `20260529-2352` epoch and are all cited above.

## Next actions

See [`docs/NEXT_ACTIONS.md`](../NEXT_ACTIONS.md). Each its own NEW session: **Phase 1.8 — full LMS**
(`EDUCATION_LMS_PLAN.md` §20: `teacher_profiles`/`enrollments`/`lesson_progress`/`pinned_links` + repos + audit +
route trees; additive migration `0002`); real-Postgres run (`REAL_POSTGRES_DATABASE_URL` → the opt-in harness,
then `db:migrate`/`db:seed`; confirm the CI mapping on first run); TradingView task-runner/cleanup +
`revoked_at`/`revoked_by` columns; billing provider/webhook; Axioma ES256/JWKS; real bot adapters; auth
rate-limiting + append-only audit role; CI activation (needs git + remote).
