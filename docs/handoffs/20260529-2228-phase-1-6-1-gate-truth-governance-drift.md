# Phase 1.6.1 — Gate Truth + Governance Strictness + Remaining Contract Drift Cleanup (aggregate handoff)

_2026-05-29 22:28. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by **6 background read-only auditors**, each with its own per-agent handoff file (cited below).
This is a real N-agent run, mechanically verified by the strengthened `npm run governance:check`
(N-claim now backed by **cited** per-agent links, not merely epoch files on disk). No live servers/SSH/bots
touched; real adapters stay mock; no real secrets stored; **not** production-ready._

## Scope

Phase 1.6.1 Tasks A–F: (A) clean **sequential** gate verification (no parallel `next build`/`e2e`/`coverage`)
after a read-only artifact audit + safe-clean; (B) strengthen `governance:check` (N-claim = cited per-agent
links; unlinked-current-epoch-participant → fail; fixture self-tests); (C) remaining docs/contract drift
cleanup (truth only, label TARGET); (D) security/runtime config follow-up (`isBase64Key` unit tests +
boot-time `loadEnv` wiring); (E) prepare — do not fake — the real-Postgres gate (opt-in skipped harness);
(F) update truth docs + this aggregate. Out of scope / unchanged: live bot control, real adapters/billing,
Axioma production handoff, TradingView automation, real `db:migrate`/`db:seed` (no `DATABASE_URL`).

## Agents launched (all closed — see Verification)

6 read-only auditors (background `general-purpose` agents), each wrote a per-agent handoff in the canonical
format (`## Files changed` = "None — read-only audit"):

1. `gate-repro-auditor` → [`20260529-2228-gate-repro-auditor.md`](20260529-2228-gate-repro-auditor.md)
2. `governance-checker-auditor` → [`20260529-2228-governance-checker-auditor.md`](20260529-2228-governance-checker-auditor.md)
3. `docs-contract-drift-auditor` → [`20260529-2228-docs-contract-drift-auditor.md`](20260529-2228-docs-contract-drift-auditor.md)
4. `worker-jobqueue-truth-auditor` → [`20260529-2228-worker-jobqueue-truth-auditor.md`](20260529-2228-worker-jobqueue-truth-auditor.md)
5. `security-runtime-config-auditor` → [`20260529-2228-security-runtime-config-auditor.md`](20260529-2228-security-runtime-config-auditor.md)
6. `frontend-build-e2e-auditor` → [`20260529-2228-frontend-build-e2e-auditor.md`](20260529-2228-frontend-build-e2e-auditor.md)

## Files changed

**B — governance:** `scripts/check-governance.mjs` (rewritten: pure exported `evaluateGovernance({files, readFile, phaseArg})`
+ guarded CLI wrapper; N-claim denominator = **cited** per-agent links; new rule-3 unlinked-current-epoch-participant
→ fail unless `NON_PARTICIPANT_ALLOWLIST`/`KNOWN_HISTORICAL_DRIFT`/line-scoped "superseded" marker),
`tests/integration/check-governance.test.ts` (new — 7 fixture self-tests),
`docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md` ("prepended into `ci:local`" →
"inserted … after `check:core`").
**C — docs/contract drift:** `docs/CONTRACTS/tradingview-access.md` (TARGET banner; owner rows split
CURRENT/TARGET; all five `**Location:**` → `**Location (TARGET)**` — single in-memory `index.ts` is CURRENT),
`docs/DATA_MODEL.md` (§0 note: single `schema.ts` CURRENT / `schema/<x>.ts` split TARGET; §8.6 `backtest_jobs`
+ §8.7 `backtest_results` "TARGET — NOT implemented"; drizzle config `./src/schema.ts`; §12 open-item TARGET
wording), `docs/BACKTESTER_DISTRIBUTION_PLAN.md` (`schema/ops.ts` → TARGET), `docs/SECRET_VAULT_DESIGN.md`
(KEK `<hex-64-chars>` → `<base64-32-bytes>`; `openssl rand -hex 32` → `-base64 32`).
**C2 — worker source truth:** `apps/worker/src/jobs.ts` + `apps/worker/src/index.ts` (comments: cron-style
direct repository calls; `job_queue` RESERVED/unconsumed; durable queue = TARGET).
**D — security/runtime config:** `packages/shared/src/env-guards.test.ts` (new `isBase64Key` describe — 4
cases, runtime-generated vectors), `apps/web/instrumentation.ts` (new — `register()` calls `loadEnv()` under
`NEXT_RUNTIME==='nodejs'`: boot-time config validation, not invoked during `next build`).
**E — real-Postgres harness:** `tests/integration/db-real-postgres.test.ts` (new — `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`;
opt-in; covers migrate+idempotent seed, unique entitlement, **true cross-connection concurrent `grantProduct`**,
session create/resolve/destroy, FK cascade, pool teardown).
**F — truth docs + aggregate:** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this file.

## Findings → fixes

- **A (gate-repro):** no stale :3100 listener (unrelated node/electron procs exist → never blanket-kill node);
  `apps/web/.next` was STALE (mixed dev+prod packs from the e2e `next dev`) and `test-results/.last-run.json`
  recorded the documented `public landing` cold-compile **flake** (not a real bug). Fix: safe-cleaned
  generated-only artifacts (`apps/web/.next`, `test-results`, `coverage`) before the run; ran the 10 gates
  strictly sequentially; used `CI=1` for e2e so Playwright owns its server (avoids the `reuseExistingServer: !CI`
  false-green). Result: e2e 10/10 with **no flake** this run.
- **B (governance-checker):** the prior N-claim compared against ALL epoch files on disk, not the aggregate's
  cited links — so an aggregate could under-cite and still pass. Rewrote to compare `maxClaim` against the
  count of **cited** per-agent links, and added rule-3: any current-epoch per-agent handoff not cited (and not
  allowlisted / not marked superseded) → fail. Refactored into a pure `evaluateGovernance()` + 7 fixture
  self-tests (claims6/links2→fail; missing link→fail; unlinked participant→fail; superseded→pass; older-epoch
  drift→warn; correct→pass; no-aggregate→fail). Also fixed the Phase-1.6 "prepended first" wording.
- **C (docs-contract-drift):** MVP_SCOPE.md was already CLEAN. Remaining drift was the TradingView contract's
  non-existent multi-file layout (`service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts`), the
  `packages/db/src/schema/<x>.ts` split + `backtest_jobs`/`backtest_results` tables in DATA_MODEL, the
  backtester `schema/ops.ts`, and the stale hex KEK in SECRET_VAULT_DESIGN — all corrected to label CURRENT
  vs TARGET truthfully. (PostgreSQL 16, `BOT_ADAPTER_MODE=real`, `apps/web/api`, "available immediately",
  TradingView "DB-backed; fully implemented", SKIP LOCKED were already OK/TARGET-labelled from Phase 1.6.)
- **C2 (worker-jobqueue-truth):** `apps/worker/src/jobs.ts` falsely said "a durable queue (job_queue table)
  replaces the in-memory demo loop in production"; `index.ts` said "periodic durable jobs". Both corrected to
  the truth (cron-style `setInterval` scheduler; direct repo calls; `job_queue` RESERVED/unconsumed). Confirmed
  `jobQueue` has **zero** consumers (only the schema definition).
- **D (security-runtime-config):** `isBase64Key` (added in Phase 1.6) had no direct tests — added them. `loadEnv()`
  was **test-only** (no runtime caller; no `instrumentation.ts`/`middleware.*`), so the base64-32 KEK config
  check was theoretical. Added `apps/web/instrumentation.ts` calling `loadEnv()` in `register()` under the
  Node-runtime guard. **Acceptance check passed:** `npm run build -w @wtc/web` with **no `SECRET_VAULT_KEK`**
  compiled green (31/31), proving `register()` is not invoked at build. Lazy fail-closed vault unchanged.
- **E (frontend-build-e2e + harness):** e2e = 1 spec × 5 tests × 2 projects = 10; `next dev :3100` (build/e2e
  independent); the suite never visits `/app/bots` list (only `/app/bots/tortila` + `/admin/tradingview-access`
  asserting the unchanged heading) → no selector update needed for the Phase-1.6 UI edits. Added the opt-in
  real-Postgres harness (skipped here — no `REAL_POSTGRES_DATABASE_URL`) so the real-PG gate is **prepared, not faked**.

## Decisions

- **Audit-then-operator-implement** (6 read-only auditors → operator synthesis + implementation), per the
  established model — agents before edits, no parallel write-conflicts.
- **Strengthened `governance:check`** keeps the historical allowlist; only the current phase is strict. The
  Phase-1.6.1 aggregate cites all six 2228 handoffs so rule-3 passes.
- **`instrumentation.ts` over forcing `loadEnv` elsewhere:** Next 15 runs `register()` at server boot but NOT
  during `next build`, so the boot-time KEK validation is real without breaking the secret-less build. The lazy
  `parseKek`/`requiredSecret` throw remains the backstop (defence-in-depth, not weakened).
- **Real Postgres stays NOT RUN** (no `DATABASE_URL`); shipped a skipped opt-in harness instead of a fake pass.

## Risks

- The real-Postgres harness is **unexercised** here (skipped) — its first real run (operator-provided
  `REAL_POSTGRES_DATABASE_URL`) may surface postgres-js-specific issues the PGlite tests can't (it is written
  against confirmed `@wtc/db` exports + the committed migrations, but is not yet green against a live engine).
- `governance:check` remains heuristic on prose (regex N-claim + markdown-link citation + line-scoped
  non-participant marker). It is a tripwire, not a proof; deliberately fail-closed (empty `NON_PARTICIPANT_ALLOWLIST`).
- `apps/web/instrumentation.ts` validation only fires at server **boot**; the secret-less `next build` correctly
  does not run it (verified). If a future deploy expects build-time validation, that is intentionally NOT provided.
- Process honesty: during this session I three times misread normal harness messages ("Wasted call — file
  unchanged", a `/tmp` redirect `Permission denied`, "file shorter than offset") as a tooling outage and wrote
  premature stop handoffs, then reverted them after probes (`SHELL_PROBE_42`, `PS_PROBE_42`, `RECOVERY_CHECK`)
  proved the environment healthy. No stop handoff remains; all gates were ultimately RUN and observed green.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6; clean sequential run on the final tree)

Pre-step: confirmed no :3100/:3000 listener; safe-cleaned `apps/web/.next`, `test-results`, `coverage` (generated-only, abs paths). Then, strictly sequential:

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** (0 errors; 1 informational warning = allowlisted 1921 integration-risk handoff) |
| 2 | `npm run check:core` | **PASS** (7 zero-install smokes) |
| 3 | `npm run lint` | **PASS** (exit 0) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** (incl. the new `.mjs`-import test + harness) |
| 6 | `npm test` (Vitest) | **PASS 84 passed / 5 skipped (89)** across 14 files (was 72/12; +`check-governance` 7, +`isBase64Key` cases, +`db-real-postgres` [5 real-PG cases skipped without `REAL_POSTGRES_DATABASE_URL`, 1 availability test active]; `db-persistence` 10/10) |
| 7 | `npm run secret:scan` | **PASS** (clean) |
| 8 | `npm run coverage` | **PASS** — 26.96% stmts / 63.77% branch (↑ from Phase 1.6's 24.76 / 60.89) |
| 9 | `npm run build -w @wtc/web` | **PASS** (Compiled in ~5s; 31/31 pages) — **doubles as the Task D no-secrets `instrumentation.ts` acceptance check** (no `SECRET_VAULT_KEK` ⇒ `register()` not run at build) |
| 10 | `npm run e2e` (Playwright, `CI=1`) | **PASS 10/10** (desktop + mobile; no flake this run) |
| — | `db:migrate` / `db:seed` against **real Postgres** | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent. Opt-in harness `tests/integration/db-real-postgres.test.ts` is ready (skipped). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` already present; not a git repo. |

Not touched (safety policy): SSH/live servers, live bot control, real adapters/billing, Axioma production handoff, TradingView automation.

## Background agents — closed

All 6 Phase-1.6.1 auditors completed and returned (6 completion notifications received); none remain running.

## Next actions

See [`docs/NEXT_ACTIONS.md`](../NEXT_ACTIONS.md). Each its own NEW session: Part E (TradingView + LMS web UI →
async DB repos — then build the TV `service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts` the contract
labels TARGET, and the `schema/<x>.ts` split + `backtest_jobs`/`backtest_results` tables); real-Postgres run
(`REAL_POSTGRES_DATABASE_URL` → the new opt-in harness, then `db:migrate`/`db:seed`); billing provider/webhook;
Axioma ES256/JWKS; real bot adapters; auth rate-limiting + append-only audit role; CI activation (needs git + remote).
