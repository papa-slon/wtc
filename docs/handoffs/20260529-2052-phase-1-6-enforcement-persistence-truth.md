# Phase 1.6 — Enforcement + Persistence Race Safety + Truth Cleanup (aggregate handoff)

_2026-05-29 20:52. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by **6 background read-only auditors**, each with its own per-agent handoff file (linked below —
this is a real N-agent run, mechanically verified by `npm run governance:check`). Implementation +
this aggregate were authored by the operator (security-critical / judgment-heavy). No live
servers/SSH/bots touched; real adapters stay mock; no real secrets stored; **not** production-ready._

## Scope

Phase 1.6 Tasks A–G: (A) add a mechanical governance checker (`governance:check`) and wire it into the
local + CI gate sets; (B) make `grantProduct`/`createUser` race-safe (DB-level upsert; graceful
unique-violation mapping) with tests; (C) align job_queue / TradingView-task **truth** in docs
(Variant 1 — no durable worker built); (D) validate `SECRET_VAULT_KEK` as a base64 32-byte key at
config load (+ prod tests, incl. Axioma HS256 prod-fence); (E) fix UI truth labels (TV-access
memory-backed; bots-list mock banner); (F) sweep docs/contracts for false current claims; (G) run all
acceptance gates. Live TradingView automation, live bot control, ES256/JWKS, real adapters/billing,
and the real-Postgres migrate/seed remain **out of scope / deferred** (unchanged).

## Files inspected

`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`,
`docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, the Phase 1.5 aggregate + the Phase 1.5
integration-risk handoff; `packages/db/src/{repositories,schema,client}.ts`,
`tests/integration/db-persistence.test.ts`; `packages/config/src/{env,env.test}.ts`,
`packages/shared/src/{env-guards,index}.ts`, `packages/crypto/src/{vault,vault.test}.ts`,
`apps/web/src/lib/vault.ts`, `packages/axioma-bridge/src/{handoff,handoff.test}.ts`;
`apps/web/src/app/admin/tradingview-access/page.tsx`, `apps/web/src/app/(app)/app/bots/{page,[bot]/page}.tsx`;
`apps/worker/src/{index,jobs,tick-once}.ts`; `package.json`, `.github/workflows/ci.yml`, `.env.example`;
`docs/{ARCHITECTURE,DATA_MODEL,INTEGRATION_MAP,MVP_SCOPE,BOT_INTEGRATION_PLAN,SECRET_VAULT_DESIGN}.md`,
`docs/CONTRACTS/tradingview-access.md`.

## Agents launched (all closed — see Verification)

6 read-only auditors (background `general-purpose` agents), each wrote a per-agent handoff in the
canonical format (`## Files changed` = "None — read-only audit"):

1. `governance-enforcement-auditor` → [`20260529-2052-governance-enforcement-auditor.md`](20260529-2052-governance-enforcement-auditor.md)
2. `db-race-safety-auditor` → [`20260529-2052-db-race-safety-auditor.md`](20260529-2052-db-race-safety-auditor.md)
3. `docs-contract-truth-auditor` → [`20260529-2052-docs-contract-truth-auditor.md`](20260529-2052-docs-contract-truth-auditor.md)
4. `security-config-auditor` → [`20260529-2052-security-config-auditor.md`](20260529-2052-security-config-auditor.md)
5. `ui-product-truth-auditor` → [`20260529-2052-ui-product-truth-auditor.md`](20260529-2052-ui-product-truth-auditor.md)
6. `qa-ci-gates-auditor` → [`20260529-2052-qa-ci-gates-auditor.md`](20260529-2052-qa-ci-gates-auditor.md)

## Files changed

**A — governance:** `scripts/check-governance.mjs` (new), `package.json` (`governance:check` script +
inserted into `ci:local` after `check:core`), `.github/workflows/ci.yml` (new `Governance check` step after `check:core`).
**B — DB race safety:** `packages/db/src/repositories.ts` (`grantProduct` → `onConflictDoUpdate`;
`createUser` catches SQLSTATE 23505 → friendly error; new `isUniqueViolation` helper),
`tests/integration/db-persistence.test.ts` (+3 concurrency tests).
**C — job_queue/TV truth (docs):** see F (worker code comments were already truthful — no code change).
**D — security config:** `packages/shared/src/env-guards.ts` (`isBase64Key`) + `packages/shared/src/index.ts`
(export), `packages/config/src/env.ts` (all-env base64-32 KEK refinement), `packages/config/src/env.test.ts`
(runtime-generated KEK fixture + 4 shape/entropy tests), `packages/axioma-bridge/src/handoff.test.ts`
(+1 prod-throw test), `.github/workflows/ci.yml` (KEK gen `openssl rand -hex 24` → `-base64 32`),
`docs/SECRET_VAULT_DESIGN.md` (stale "hex 64 chars" → "base64 44 chars").
**E — UI truth:** `apps/web/src/app/admin/tradingview-access/page.tsx` (removed the false "UI is wired
to Postgres" claim → memory-backed, Part E deferred), `apps/web/src/app/(app)/app/bots/page.tsx`
(added the `BOT_ADAPTER_MODE=mock` "Simulated data" banner the list page was missing).
**F — docs truth sweep:** `docs/ARCHITECTURE.md` (PG17; worker = cron-style direct calls, no SKIP
LOCKED/poll; `apps/web/src/app/api/billing/` TARGET; bot read-only adapters stubbed/throw),
`docs/DATA_MODEL.md` (PG17; job_queue RESERVED; SKIP-LOCKED block labelled TARGET),
`docs/INTEGRATION_MAP.md` (PG17; no cross-process queue), `docs/MVP_SCOPE.md` (PG17),
`docs/CONTRACTS/tradingview-access.md` (services = in-memory/Partial, not "DB-backed; fully
implemented"), `docs/BOT_INTEGRATION_PLAN.md` (`real` row → `audited`),
`docs/handoffs/0000-orchestrator-seed.md` (append-only supersede notes: PG17, job_queue RESERVED).
**Bookkeeping:** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

## Findings → fixes

- **A (governance):** there was **no** mechanical enforcement of the "N-agent" honesty rule.
  `scripts/check-governance.mjs` (zero-dep, fs-only — not a git repo) now validates: the current
  aggregate's cited per-agent handoffs all exist; numeric "N-agent/N-auditor" claims are backed by ≥N
  per-agent files at that epoch; canonical headings (normalised, required-subset). **STRICT** for the
  current phase, **INFORMATIONAL** for grandfathered handoffs. The auditor verified the suspected
  Phase-1.5 unbacked claims were **already** corrected and that the Phase-1.5 integration-risk
  heading drift is an append-only merged artifact — handled via a `KNOWN_HISTORICAL_DRIFT` allowlist
  (the user-sanctioned "exclude historical" option) rather than rewriting it.
- **B (DB race):** `grantProduct` did SELECT-then-INSERT in a txn — concurrent duplicate grants both
  INSERT and one raised a unique violation (`entitlements_user_product_idx`). Replaced with
  `onConflictDoUpdate` (target `(userId, productCode)`; `set {status:'active', manualOverride, updatedAt}`;
  insert-only `source/planCode/startsAt`); audit row stays in the same transaction. Faithful because a
  manual grant always resolves to `active`. `createUser` concurrent duplicate email now maps SQLSTATE
  **23505** → the same `'email already registered'` error (graceful; the chosen, tested contract).
  Audit contract is **defined**: the entitlement upsert is idempotent (1 row) but each grant *call* is
  audited (2 concurrent calls → 2 `product.grant` rows). No schema/migration change (unique index
  already existed).
- **C (job_queue/TV truth, Variant 1):** no durable worker built. Docs now state: `job_queue` is
  RESERVED/future; the worker uses cron-style direct repository calls
  (`reconcileAllEntitlements`/`sweepTvExpiry`/`recordHealthCheck`); **no SKIP LOCKED consumer**;
  `tradingview_access_tasks` are queued by `sweepTvExpiry` but **not consumed by automation yet**.
- **D (security config):** `SECRET_VAULT_KEK` was only `min(16)` at config load (despite a "base64
  32-byte" message) — real shape validated lazily in the vault (`parseKek`). Added `isBase64Key()` +
  an **all-environment** refinement in `loadEnv` (composes with the existing prod-only weak-secret
  check). Because a strict check would have broken the test fixture (24 bytes) and CI (`-hex 24` → 36
  bytes), both were fixed in the same change (runtime-generated KEK fixture; `openssl rand -base64 32`).
  Axioma HS256 prod-throw confirmed + now test-covered. ES256/JWKS untouched (hard blocker).
- **E (UI truth):** `/admin/tradingview-access` claimed the UI "is wired to Postgres" (false — it is
  memory-backed via `backend.ts` → `demo.ts` in every environment); corrected to memory-backed, Part E
  deferred. `/app/bots` (list) lacked the `BOT_ADAPTER_MODE=mock` "Simulated data — not a live account"
  banner that the detail page already shows; added it. No new features, no live wiring.
- **F (docs sweep):** corrected the surviving false current claims (PostgreSQL 16→17; SKIP LOCKED /
  "polls job_queue" / durable-queue; `apps/web/api`; "read-only methods available immediately";
  TradingView "DB-backed; fully implemented"; `BOT_ADAPTER_MODE=real`). Worker code comments were
  already truthful.

## Decisions

- **Audit-then-operator-implement** (6 read-only auditors → operator synthesis + implementation), per
  the established Phase-1.5 model — satisfies "agents before edits" / "not solo" without parallel
  write-conflicts on interrelated files.
- **`grantProduct` static `set` clause** (not read-after-upsert): valid only because `manual_grant`
  always activates; documented inline so a future non-activating grant switches to read-after-upsert.
- **`createUser` graceful 23505 mapping** (Option a) over "documented unique violation" (Option b): one
  stable caller contract; detected by `err.code === '23505'` (portable across postgres-js + PGlite).
- **KEK base64-32 check in all environments** (fail-fast at config load); kept the vault lazy (do NOT
  force `loadEnv` at web boot — that would break `next build`, which has no runtime secrets).
- **Integration-risk heading drift = allowlisted historical**, not rewritten (append-only norm).

## Risks

- The concurrency tests run on **PGlite (single connection)**, which serialises transactions — they
  lock in the idempotent contract + no-throw, but the true cross-connection race guarantee rests on the
  unique index + `ON CONFLICT` SQL (exercised on real Postgres in CI). Real-Postgres verification is
  still **NOT RUN** (no creds).
- `governance:check` is heuristic on prose (regex for "N-agent"/"N auditors", markdown-link citation
  extraction). It is deliberately lenient (required-subset headings, max-claim ≤ file-count) to avoid
  false failures; it is a tripwire, not a proof.
- The new KEK check only protects callers of `loadEnv`; the web vault still reads `process.env`
  directly (lazy `parseKek` is already 32-byte-strict). Wiring a boot-time `loadEnv()` is a documented
  follow-up (LOW), intentionally deferred to avoid build-time secret coupling.
- Docs realism improved but the platform remains **not production-ready** (unchanged from Phase 1.5).

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| Gate | Result |
|---|---|
| `npm run governance:check` | **PASS** (0 errors; 1 informational warning = allowlisted historical integration-risk handoff) |
| `npm run check:core` | **PASS** (7 zero-install smokes) |
| `npm run lint` | **PASS** (exit 0) |
| `npm run typecheck` (packages) | **PASS** |
| `npm run typecheck -w @wtc/web` | **PASS** |
| `npm test` (Vitest) | **PASS 72/72** (12 files; was 64 — +3 DB concurrency, +4 KEK shape/entropy, +1 Axioma prod-throw) |
| `npm run secret:scan` (secretlint) | **PASS** (clean) |
| `npm run build -w @wtc/web` | **PASS** (Next build) |
| `npm run coverage` | **PASS** — 24.76% stmts / 60.89% branch (slight dip from 25.07 / 61.26: the new, uncovered `scripts/check-governance.mjs` is counted in the denominator; security/DB core coverage rose) |
| `npm run e2e` (Playwright) | **PASS 10/10** (desktop + mobile; chromium cached) |
| `db:migrate` / `db:seed` against **real Postgres** | **NOT RUN** — local PG17 present but credentials unknown to the agent; Docker absent. SQL equivalents verified via the PGlite integration test. Not in the Task G list. |

Not run / not touched (by safety policy, unchanged): real Postgres migrate/seed, SSH/live servers,
live bot control, live TradingView automation, live billing/Axioma/bot adapters.

## Background agents — closed

All 6 background auditors ran to completion and returned their results; none remain running at the time
of this report (confirmed: 6 completion notifications received; no active background tasks).

## Next actions

See [`docs/NEXT_ACTIONS.md`](../NEXT_ACTIONS.md). Carried forward (each its own NEW session): Part E
(TradingView + LMS web UI → async DB repos), real-Postgres migrate/seed + a postgres-js integration
test (and a true cross-connection concurrency test for `grantProduct`), billing provider/webhook,
Axioma ES256/JWKS, real bot adapters, auth rate-limiting + append-only audit role, CI activation
(needs git + remote). New follow-ups logged this phase: (a) optional boot-time `loadEnv()` so the
KEK check protects the web runtime, not just unit tests; (b) reconcile the TradingView-access contract's
multi-file package layout (`service.ts`/`admin-service.ts`/`scheduler.ts`/`task-runner.ts`) with the
actual single `index.ts` memory service.
