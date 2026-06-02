# Phase 2.5 — Master Roadmap + Foundation Truth + Real-PG Readiness (aggregate handoff)

_2026-05-30, epoch `20260530-1625`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **6 read-only auditor/planner fan-out (agents-before-edits, Rule 1)** → operator-orchestrated
**serial** doc + test-harness implementation (no parallel edits — not a git repo, no worktrees). **6 per-agent
handoff files** at this epoch, every one cited below. Not a git repo — no commits/branches/PRs/CI proof. No
SSH / live server / live bot control / live exchange / Stripe charge / TradingView automation / Axioma
production call. **Not production-ready.** First phase of the operator's continuous 12-phase-group program._

## Scope

Open the continuous build program: produce the 5 mandatory master planning docs **before** any code, then
execute **Phase Group 1 (Foundation / Real-DB / Truth)** — fix every confirmed doc drift vs Phase 2.4 reality,
and harden the real-PG acceptance harness so the gate is honestly RUNNABLE (DB-name guard + migration-0003
proof + cross-connection concurrent `billing_webhook_events` test) while staying **NOT RUN** until credentials
exist. PGlite remains the no-DB path and is **not** a substitute for real-PG acceptance.

## Agents launched (6 per-agent handoffs — all closed; every one cited)

Read-only planning + audit fan-out (one Workflow run, `wr89v5ocz`; all returned, none left running):
1. `ecosystem-task-router` → [`…-ecosystem-task-router.md`](20260530-1625-ecosystem-task-router.md) — 12-group → workstream classification, single-writer spine, parallelization, risk gates.
2. `ecosystem-product-architect` → [`…-ecosystem-product-architect.md`](20260530-1625-ecosystem-product-architect.md) — product roadmap status + MVP boundaries + open product decisions + drift edits.
3. `ecosystem-platform-architect` → [`…-ecosystem-platform-architect.md`](20260530-1625-ecosystem-platform-architect.md) — critical path + dependency graph + `middleware.ts` gap (ADR-015) + serial-spine prereqs.
4. `ecosystem-db-architect` → [`…-ecosystem-db-architect.md`](20260530-1625-ecosystem-db-architect.md) — 40-table verification, DB-name-guard + 2-test design, DATA_MODEL §13/§5.3 drift.
5. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-1625-ecosystem-security-auditor.md) — `middleware.ts` absent (CRITICAL), redact value-guard, jti store, LMS RBAC-throw, legacy plaintext-key gate.
6. `ecosystem-devops-docs-auditor` → [`…-ecosystem-devops-docs-auditor.md`](20260530-1625-ecosystem-devops-docs-auditor.md) — exact 7-edit doc-truth list + deployment/CI readiness gaps.

## Files changed

**Master planning docs (NEW):** `docs/ROADMAP_MASTER.md`, `docs/EXECUTION_PLAN_MASTER.md`,
`docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/RISK_REGISTER_MASTER.md`, `docs/PRODUCTION_BLOCKERS.md`.

**Doc-truth fixes (Phase Group 1):**
- `docs/IMPLEMENTED_FILES.md` — Persistence table 38→**40 tables** / 3→**4 migrations** (+`0003_fresh_blockbuster.sql` row); Tortila fixtures 8→**11**; Contracts table billing-webhooks row now names the real route + `billing_webhook_events`.
- `docs/CONTRACTS/billing-webhooks.md` — §1 idempotency store `webhook_idempotency_keys`→**`billing_webhook_events`**; §14 Gap 3 `OPEN`→**`FIXED (Phase 2.4)`** (`/admin/entitlements/review` shipped).
- `docs/STATUS.md` + `docs/NEXT_ACTIONS.md` — fixtures 8→**11**; NEXT_ACTIONS `db:generate` comment 3→**4 migrations, 40 tables**.
- `docs/DATA_MODEL.md` — §13 `billing_webhook_events` + `billing_manual_review_items` column lists corrected to the actual `0003` DDL (`event_snapshot`/`'pending'`/`resolution_note`/`event_type`/`user_id`/`expires_at`/`products_changed`; removed phantom `meta`/`raw_event`/`'open'`/`resolution`); §5.3 `terminal_download_events.ip_address` `INET`→**`TEXT`** (matches its own note + schema).

**Real-PG harness (`tests/integration/db-real-postgres.test.ts`):** exported pure `assertThrowawayDbName()`
(refuses any DB name not matching `^wtc_test(_[a-z0-9]+)?$`; uses `globalThis.URL` because the module-level
`const URL` shadows the global) + guard call as the first line of `beforeAll`; **3 always-on guard unit tests**
(accept/refuse/malformed — run without a DB); **2 new skipIf tests** — migration-0003 40-table `information_schema`
proof + **cross-connection** concurrent `insertWebhookEventOnce` dedup via two independent pools (the race PGlite
cannot do). Imported `insertWebhookEventOnce` from `@wtc/db`.

## Findings → fixes

- **Doc drift (3 HIGH/MEDIUM, all confirmed on disk by ≥3 agents)** — 38-table count (IMPLEMENTED_FILES:107-108),
  dead `webhook_idempotency_keys` name (billing-webhooks:21; HIGH — could trigger a spurious migration), 8-vs-11
  fixture count. **Fixed.** Plus the platform/devops/db agents surfaced 4 more: billing-webhooks §14 Gap-3 stale
  OPEN status, IMPLEMENTED_FILES contracts-table "no live webhook route yet", NEXT_ACTIONS db:generate comment,
  DATA_MODEL §13 column lists materially wrong vs the `0003` DDL, DATA_MODEL §5.3 INET vs TEXT. **All fixed.**
- **Real-PG harness had no DB-name guard (HIGH)** — could run schema-mutating SQL + seed against a non-throwaway
  DB. **Fixed:** `assertThrowawayDbName` fail-closed guard, unit-tested without a DB.
- **Migration 0003 + concurrent `billing_webhook_events` UNIQUE unproven on real PG (HIGH)** — PGlite (single
  connection) cannot prove the cross-connection race. **Fixed (readiness):** two skipIf tests added; remain NOT RUN
  until creds (PGlite is not a substitute).
- **Operator fix during gates:** TS2352 on the 40-table cast (`postgres` `Row` → `{n}`) → cast via `unknown`;
  secret:scan flagged `u:p@` basic-auth-shaped literals in the guard tests → switched to credential-free URLs
  (the guard parses `pathname`, so credentials are irrelevant to what is tested). Both re-run green.
- **Carried forward (not this phase, logged in the master docs):** `middleware.ts` absent (CRITICAL, PG11);
  LMS silent-return-on-RBAC (PG7/11); `redact.ts` value-pattern guard (PG11); Axioma jti store (PG6);
  `db:seed` non-idempotent course insert (PG12).

## Decisions

1. **Master docs before code** (mission requirement) — 5 docs synthesized from the real fan-out output, not generic.
2. **This phase = doc truth + real-PG readiness only.** The real-PG **run** stays NOT RUN (no `DATABASE_URL`/Docker);
   the harness is now safe to run the moment a `wtc_test` URL exists. No false gate-green.
3. **Guard is pure + always unit-tested** so the safety logic is verified every `npm test` run, not only with creds.
4. **Did not rewrite frozen historical handoffs** (e.g. the Phase 2.4 "8 fixtures" aggregate) — only living truth docs.
5. **Continuous program, governed per group.** Each phase group gets its own epoch + aggregate; the newest is the
   strictly-validated one. Stop per Rule 7 (context/scope/quality) with a new-session prompt — that stop is mandated.

## Risks

- All surfaces still render their honest labelled demo state here (no `DATABASE_URL`); DB path is PGlite-tested +
  fails closed in production. **PGlite is NOT a substitute for real-PG acceptance** (B1).
- `middleware.ts` is still absent → no app-layer auth rate-limit / security headers; billing-webhook CSRF exclusion
  is per-action, not framework-level (PG11, CRITICAL). Full register in [`RISK_REGISTER_MASTER.md`](../RISK_REGISTER_MASTER.md).
- Coverage statements 24.94% (UI/routes are e2e-covered, excluded from Vitest); branch 70.74% is the reliable gate.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|---|---|
| 1 | `npm run check:core` | **PASS** (7 smokes) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** (after fixing TS2352 `unknown` cast) |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** |
| 5 | `npm run secret:scan` | **PASS** (after replacing `u:p@` literals with credential-free URLs) |
| 6 | `npm test` (Vitest) | **PASS — 241 passed / 7 skipped (248)** across 27 files (+3 always-on guard tests; +2 skipped real-PG tests) |
| 7 | `npm run coverage` | **PASS — 24.94% stmts / 70.74% branch** |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 40 tables; "No schema changes"** (in sync) |
| 9 | `npm run build -w @wtc/web` | **PASS — compiled; 33/33 static pages, no errors** |
| 10 | `npm run governance:check` | **PASS** (this aggregate; 6 cited per-agent handoffs present) |
| 11 | `npm run e2e` (Playwright, `CI=1`) | **PASS — 34/34** (4.6m; re-run this session to confirm the build's served output despite no UI/route change) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent. Harness now guard-protected + has the 0003/concurrent tests, ready the moment a `wtc_test` URL exists. |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma
production handoff/download, TradingView automation, plaintext exchange keys.

## Background agents — closed

All 6 per-agent runs in the planning fan-out (Workflow `wr89v5ocz`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG11 (next, serial spine):** create `apps/web/src/middleware.ts` (IP-keyed auth rate-limit + security headers; CSRF-exclude `/api/billing/webhook`) + `redact.ts` value-pattern guard. Prerequisite for new API routes in PG4/5/6.
- **PG2 Tortila:** read-only health states (not_configured/unreachable/malformed/stale) + `getWarnings()` + `JOURNAL_READ_TOKEN`.
- **PG5 TradingView:** `sweepTvExpiry`→`atomicRevokeTv`; `listUsersWithEmailByIds` (kill N+1); surface `revokeReason`; <14-day expiry banner.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); backtester model decision (PG10); club bundling Q-6.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md), ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
