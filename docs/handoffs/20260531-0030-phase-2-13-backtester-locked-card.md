# Phase 2.13 / Phase Group 10 — Backtester honest locked card (aggregate handoff)

_2026-05-31, epoch `20260531-0030`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **5 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_a8038d9d-4b7`)
→ operator-orchestrated **serial** implementation (not a git repo; no worktrees; no parallel writers). **5 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / Axioma production handoff. **Not production-ready.** Ninth phase-group window in the operator's
continuous program (follows Phase 2.12 / PG9, epoch `20260531-0005`)._

## Operator decision (the hard blocker — resolved at session start)

**PG10 model: option (b) — an explicit, permanently-honest "not yet available" backtester card.** NOT the real
local-runner pipeline (option a). The full option-a design (`backtest_jobs`/`backtest_artifacts` tables, 9 API routes,
HMAC upload tokens, artifact storage, Zod artifact schemas, chart components, vendored Python runner ZIP) is a
multi-session epic; it stays the documented blueprint, deferred. **No fake backtest results ever.** Recorded in **ADR-020**.

## Scope

PG10 (Backtester / distribution) from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md) W11 /
[`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §10 — a **UI/UX + pure-logic phase, no migration** (`db:generate` =
"No schema changes"; 41 tables, unanimous 5/5 auditor verdict). The shipped surface was a **half-state**: the Tortila
backtester page rendered a dead config form + two disabled teaser buttons ("Queue run (local runner required)" /
"Download local runner (soon)") and "coming in a future release" copy; the Legacy card said "Coming soon"; and
`packages/backtester` was an orphaned, untested (0% coverage), spec-drifted in-memory `BacktestService` stub imported by
nothing. PG10 replaces all of it with an honest, no-half-state locked surface driven by a pure, unit-tested deriver.

## Agents launched (5 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_a8038d9d-4b7`; all 5 returned, none left running):
1. `ecosystem-backtester-architect` → [`…-ecosystem-backtester-architect.md`](20260531-0030-ecosystem-backtester-architect.md) —
   the half-state inventory (F-01 legacy "Coming soon", F-02 dead form + teaser buttons), the orphaned/0%-coverage package
   (F-03), inline-logic-in-React (F-04), the spec-drifted stub types `system: string` / missing `cancelled` (F-05/F-06),
   the doc-truth updates (F-07..F-09 ROADMAP/BLOCKERS/ADR), the unused-dep (F-10), the wrong MVP_SCOPE citation (F-11).
   `migrationNeeded:false`.
2. `ecosystem-ux-ui-designer` → [`…-ecosystem-ux-ui-designer.md`](20260531-0030-ecosystem-ux-ui-designer.md) — the 3 honest
   states + copy (legacy boundary / access-required / not-yet-available), the cross-surface false "Available" pill on the
   bot overview, reuse of the PG8/PG9 primitives, 375px/a11y. `migrationNeeded:false`.
3. `ecosystem-frontend-implementer` → [`…-ecosystem-frontend-implementer.md`](20260531-0030-ecosystem-frontend-implementer.md) —
   the SPINE-vs-disjoint file map, the thin-shell page plan, the package-wiring question (dep already present), the
   demo-honesty rule (the page is data-less, renders identically in demo + real-PG). `migrationNeeded:false`.
4. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260531-0030-ecosystem-security-auditor.md) — confirmed
   the locked card adds **no** attack surface (no actions/routes/tokens/secrets), the fail-closed entitlement ordering must
   be preserved, and the no-fake-results / no-web-tier-compute invariants are assertable; the orphaned package finding (F-03).
5. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260531-0030-ecosystem-tests-runner.md) — confirmed the
   baseline gates + `db:generate` (41 tables), and the unit + static + 375px-e2e test plan (incl. wiring `packages/backtester`
   into coverage). Noted the dev-only Server-Action e2e flake (`retries:2`). `migrationNeeded:false`.

## Cross-auditor conflicts resolved (operator decisions)

1. **Keep vs gut the option-a stub types.** backtester-architect's lean was "retain `BacktestJob`/`BacktestService`/… as a
   labelled TARGET stub (fix `system: 1|2`, add `cancelled`)". **Decision: gut them.** They had **no consumer**
   (dead-code-avoidance — the project's standing principle, applied in PG4/PG6/PG7) and **contradicted** the authoritative
   spec (F-05/F-06). The contract docs (`BACKTESTER_DISTRIBUTION_PLAN.md` §5–§9 + `CONTRACTS/backtester-runner.md`) remain
   the single source of truth for option (a) until it is built (DB-backed, correct enums). `index.ts` re-exports the deriver.
2. **Remove vs keep the `@wtc/backtester` dependency.** ux/security/frontend leaned "remove it from `apps/web` deps +
   `transpilePackages` (the page doesn't need it)". **Decision: keep it, and USE it** — the pure `deriveBacktesterView` lives
   in the package per AGENTS.md §9 ("logic in packages, not React files"), and the page + the bot overview both import it.
   This resolves the orphan (F-10) by use, not deletion, and is the more correct architecture.
3. **Pure-derivation location.** Unanimous (and consistent with ADR-019): a pure, zero-runtime-dependency deriver in
   `packages/backtester` with **real Vitest coverage** (the package was 0% before).

## Files changed

**`@wtc/backtester` (gutted stub → pure, tested deriver):**
- `packages/backtester/src/derive.ts` (**new**) — `deriveBacktesterView(slug, access?)` (pure; 3 honest `BacktesterView`
  kinds; FAIL CLOSED — a missing/non-allowed decision denies; **carries no numeric/equity/metric/result field**) +
  `backtesterPill(slug)` + `botHasBacktester(slug)` + `BACKTESTER_RUNNER_DISTRIBUTED = false` (single source of truth).
  Type-only imports of `AccessReason` (`@wtc/entitlements`) + `Tone` (`@wtc/ui`) → zero runtime deps.
- `packages/backtester/src/index.ts` — rewritten to `export * from './derive'` (removed the unused in-memory
  `BacktestService`/`createMemoryBacktestStore` + the drifted `BacktestJob`/`BacktestParams`/`BacktestStatus` types).
- `packages/backtester/src/derive.test.ts` (**new**, **10 unit tests**) — per-state routing, legacy-ignores-access,
  fail-closed default, the `BACKTESTER_RUNNER_DISTRIBUTED` guard, `backtesterPill`, and a **no-fake-results invariant**
  (the view has no result keys and no numeric values). Closes the 0%-coverage gap.
- `packages/backtester/package.json` — `+ "scripts": { "test": "vitest run" }` (parity with `@wtc/cabinet`).

**App-layer (disjoint):**
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` — rewritten to a **thin shell** over the deriver. 3 states,
  no config form, no disabled teaser button, no "coming soon"/"future release"/"(soon)" copy. FAIL CLOSED — Tortila path
  checks entitlement (`requireUser` → `accessFor`) before any content, loads no per-user data. (F-02/F-04/F-11.)
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — the bot-overview capability table's backtester pill now uses the
  shared `backtesterPill(meta.code …)` (tortila → neutral "Not yet available", legacy → "Not available") instead of the
  false green "Available" (cross-surface honesty). (ux F-02.)

**Tests:**
- `tests/integration/backtester-pg10.test.ts` (**new**, 12 static source-guards: page has no form / no teaser / no
  "coming soon"; thin-shell over the deriver; fail-closed ordering; deriver has the honest copy + no result payload; index
  drops the stub; overview no longer hard-codes "Available").
- `tests/e2e/backtester-pg10-mobile.spec.ts` (**new**, 375px, mobile-scoped, navigation-only: Tortila honest "not yet
  available" + Legacy boundary card, no horizontal page scroll).

**Docs (owned-doc truth, serialize-last):** `docs/ARCHITECTURE_DECISIONS.md` **ADR-020**, `docs/ROADMAP_MASTER.md` §10,
`docs/PRODUCTION_BLOCKERS.md` (PG10 checklist → done), `docs/BACKTESTER_DISTRIBUTION_PLAN.md` + `docs/CONTRACTS/backtester-runner.md`
(status → option (b) shipped; option (a) deferred blueprint), `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`.

## Findings → fixes (summary)

- **(arch F-01 / ux F-01) Legacy "Coming soon"** → permanent product-boundary card ("The Legacy Bot does not have a backtester…").
- **(arch F-02 / ux F-02) Tortila dead form + disabled teaser buttons + "future release"** → honest "not yet available"
  card; no form, no teaser, no timeline promise.
- **(arch F-03 / security F-03) orphaned 0%-coverage package** → pure deriver + 10 unit tests; package now imported & covered.
- **(arch F-04) inline branching in the React page** → pure `deriveBacktesterView` in `@wtc/backtester`; page is a thin shell.
- **(arch F-05/F-06) spec-drifted stub types** → removed (the contract docs are the source of truth for option a).
- **(ux) false green "Available" pill on the bot overview** → shared `backtesterPill`; honest neutral "Not yet available".
- **(arch F-07/F-08/F-09/F-11) doc truth** → ROADMAP §10 DONE, PRODUCTION_BLOCKERS PG10 checked, ADR-020 added, page comment
  cites `BACKTESTER_DISTRIBUTION_PLAN.md §1/§17.2`.
- **(self-caught) the new static guard flagged a literal `"coming soon"` inside a page comment** → comment reworded; the
  e2e spec's invented `storageState` path → rewritten to the proven manual-login pattern. Both fixed pre-merge.

## Decisions

1. Option (b): honest permanently-locked card; no tables/routes/runner ZIP; no fake results. ADR-020.
2. No migration this phase (41 tables, unanimous 5/5).
3. Pure `deriveBacktesterView` in `@wtc/backtester` (real unit coverage); gut the unused/drifted stub; `index.ts` re-exports.
4. Keep + USE the `@wtc/backtester` dep (logic in packages); the page + overview import the deriver.
5. `BACKTESTER_RUNNER_DISTRIBUTED = false` is the single flip-point for option (a); the no-fake-results invariant is
   active regardless of when option (a) ships.

## Risks

- **Demo-mode e2e.** e2e runs in demo (the seeded user owns `tortila_bot` → "not yet available"); the locked card is
  data-less so it renders identically under real-PG. Low risk; honest.
- **Option (a) is deferred, not built.** A future agent must read ADR-020 + the contract docs before reintroducing the
  job/artifact pipeline (correct `system: 1|2`, `cancelled` state, DB-backed) and flipping `BACKTESTER_RUNNER_DISTRIBUTED`.
- Still NOT production-ready; PGlite is not a substitute for real-PG acceptance (B1) — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 2 | `npm run typecheck` (packages) | **PASS** (exit 0 — incl. the rewritten `@wtc/backtester`) |
| 3 | `npm run typecheck -w @wtc/web` | **PASS** (exit 0 — thin page + overview pill) |
| 4 | `npm run secret:scan` | **PASS** (clean) |
| 5 | `npm test` / `npm run coverage` | **PASS — 504 passed / 8 skipped (512)** across 44 files (+22 vs PG9: derive 10, backtester-pg10 12) |
| 6 | `npm run coverage` | **PASS — 26.8% stmts / 75.56% branch** (both ↑ vs PG9 26.49/75.33 — `@wtc/backtester` now covered) |
| 7 | `npm run db:generate -w @wtc/db` | **PASS — 41 tables; "No schema changes, nothing to migrate"** (no migration) |
| 8 | `npm run check:core` | **PASS** (7 smokes) |
| 9 | `npm run build -w @wtc/web` | **PASS** (exit 0) |
| 10 | `npm run e2e` (Playwright) | **PASS — 40 passed / 5 skipped / 1 flaky-green / 0 failed** (the known dev-only Server-Action smoke race auto-retried green; the 2 new PG10 specs pass in the mobile project, desktop instances skipped) |
| 11 | `npm run governance:check` | **PASS** (current phase `20260531-0030`; 5 cited per-agent handoffs all present) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B2 Stripe / B4 Axioma activation** | **NOT RUN** — out of PG10 scope (surfaced honestly elsewhere). |
| — | `npm ci` | **NOT RE-RUN** — no new workspace package added; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production
handoff, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter
stays deleted + factory-blocked (B3); all three Axioma terminal CTAs stay disabled (B4); **no backtest result is ever
fabricated** (the runner pipeline is not built — option b).

## Background agents — closed

All 5 per-agent runs in the audit fan-out (Workflow `wf_a8038d9d-4b7`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **Phase-3 LMS rich** — migration 0005 co-landed with its consumers + pinned-link/teacher-profile web surfaces (carried from PG7).
- **PG12 CI / deploy readiness** — gated on real-PG run (B1) + `git init` (B6); `db:seed` idempotency; structured logger.
- **Backtester option (a)** — when green-lit, a future multi-session epic: `backtest_jobs`/`backtest_artifacts` migration
  (db-architect wave first), the 9 routes + HMAC tokens + artifact storage + runner ZIP, then flip `BACKTESTER_RUNNER_DISTRIBUTED`.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma endpoint
  shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); Q-6 club+education bundling.
- **Carried:** F-05 double `requireUser`, F-07 settings audit-on-denial; F-03 structured logger (PG12); CSP per-request nonce;
  consolidate the legacy `ProductStatusCard` tone map onto `@wtc/cabinet`.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
