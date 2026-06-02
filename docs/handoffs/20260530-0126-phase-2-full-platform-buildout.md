# Phase 2 — Full Platform Buildout (aggregate handoff)

_2026-05-30 01:26 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by **14 background design/audit agents** (one parallel fan-out), each with a per-agent handoff file
(cited below). Implementation followed the established **audit-fan-out → operator-serial-implement** pattern
(Phase 1.7 precedent): the heavy shared-file work was NOT parallelised. No live servers/SSH/bots touched; real
adapters/billing stay mock; no Axioma production handoff; no TradingView automation; no real `db:migrate`/`db:seed`
(no `DATABASE_URL`); **not** production-ready._

## Scope

Phase 2 = the full WTC product platform (public site, cabinet, two bot dashboards + setup, bot-config UI,
analytics, terminal/Axioma, TradingView access, full LMS, admin, billing/entitlements, DB persistence, truthful
docs). Per **Rule 7**, the full 12-part build cannot be implemented AND gate-verified at quality in one session.
This session therefore: (1) ran the mandatory **parallel design/audit fan-out (agents before edits)** producing
the complete, coherent Phase-2 blueprint + write-ownership map across all 12 parts; (2) implemented and
**gate-verified one coherent vertical** — **Part 4 unified analytics + Parts 2/3 read-only bot dashboards** —
using existing packages + mock adapters (no migration). Parts 5/6/7/8/9 (migration-`0002`-dependent) are fully
designed and **staged** for subsequent sessions.

## Agents launched (14 — all closed; per-agent handoffs cited)

One parallel Wave-1 fan-out of ecosystem agents (design/audit; no code edits in Wave 1). Each wrote a per-agent
handoff in canonical format at the `20260530-0126` epoch. (`ecosystem-task-router` is a read-only agent type
with **no Write tool** by design — it authored its handoff content and the operator persisted the file; this is
noted in that file's header.)

1. `ecosystem-task-router` → [`20260530-0126-ecosystem-task-router.md`](20260530-0126-ecosystem-task-router.md) — scope classification, risk zones, write-ownership map, Wave-2 sequencing.
2. `ecosystem-product-architect` → [`20260530-0126-ecosystem-product-architect.md`](20260530-0126-ecosystem-product-architect.md) — product map, sitemap decision (dynamic routes, no static dupes), monetization, Part-0 truth list.
3. `ecosystem-platform-architect` → [`20260530-0126-ecosystem-platform-architect.md`](20260530-0126-ecosystem-platform-architect.md) — architecture deltas, serial spine S-1…S-8 + disjoint parallel groups P-A…P-E, ADR-012/013/014.
4. `ecosystem-db-architect` → [`20260530-0126-ecosystem-db-architect.md`](20260530-0126-ecosystem-db-architect.md) — migration `0002` design (18 new tables + 1 ALTER), repo specs, landable-scope recommendation.
5. `ecosystem-security-auditor` → [`20260530-0126-ecosystem-security-auditor.md`](20260530-0126-ecosystem-security-auditor.md) — per-mutation pipeline matrix, new audit vocabulary, RBAC rows, secret-vault doc truth fix.
6. `ecosystem-bot-integration-auditor` → [`20260530-0126-ecosystem-bot-integration-auditor.md`](20260530-0126-ecosystem-bot-integration-auditor.md) — read-only dashboard interface, 8 analytics gaps (incl. **P0 GAP-F**), Tortila/Legacy capability matrix.
7. `ecosystem-axioma-bridge-auditor` → [`20260530-0126-ecosystem-axioma-bridge-auditor.md`](20260530-0126-ecosystem-axioma-bridge-auditor.md) — `/products/axioma-terminal` + `/app/terminal` content models, mock bridge view, dev-placeholder labelling.
8. `ecosystem-billing-access-auditor` → [`20260530-0126-ecosystem-billing-access-auditor.md`](20260530-0126-ecosystem-billing-access-auditor.md) — `ProductAccessView` display model, pricing model, canonical webhook route (TARGET), admin grant gaps.
9. `ecosystem-ux-ui-designer` → [`20260530-0126-ecosystem-ux-ui-designer.md`](20260530-0126-ecosystem-ux-ui-designer.md) — premium UX specs for all Phase-2 surfaces + the 24-condition warning index (`docs/UX_SPEC_PHASE2.md`).
10. `ecosystem-tradingview-access-implementer` → [`20260530-0126-ecosystem-tradingview-access-implementer.md`](20260530-0126-ecosystem-tradingview-access-implementer.md) — current-vs-TARGET reconciliation, view model, `0002` table needs.
11. `ecosystem-education-implementer` → [`20260530-0126-ecosystem-education-implementer.md`](20260530-0126-ecosystem-education-implementer.md) — full LMS design (§21): teacher_profiles/enrollments/lesson_progress/pinned_links, repos, route trees, landable scope.
12. `ecosystem-backtester-architect` → [`20260530-0126-ecosystem-backtester-architect.md`](20260530-0126-ecosystem-backtester-architect.md) — Tortila-only distribution model; recommends NOT adding backtest tables to `0002`; Legacy = permanent "not available".
13. `ecosystem-tests-runner` → [`20260530-0126-ecosystem-tests-runner.md`](20260530-0126-ecosystem-tests-runner.md) — Phase-2 integration + e2e + gate plan (`docs/TEST_PLAN_PHASE2.md`); real-PG `wtc_test` guard.
14. `ecosystem-devops-implementer` → [`20260530-0126-ecosystem-devops-implementer.md`](20260530-0126-ecosystem-devops-implementer.md) — fixed stale "swap demo.ts" deploy claim; real-PG/CI readiness plan; no new env vars.

## Files changed

**Wave-1 design docs (by the owning agents, disjoint):** `PRODUCT_BRIEF.md`, `SITEMAP.md`, `MVP_SCOPE.md`,
`OPEN_QUESTIONS.md`, `ARCHITECTURE.md`, `INTEGRATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`, `DATA_MODEL.md`,
`DOMAIN_MODEL.md`, `SECURITY_MODEL.md`/`RBAC_MATRIX.md`/`SECRET_VAULT_DESIGN.md`/`AUDIT_LOG_SCHEMA.md`,
`BOT_INTEGRATION_PLAN.md`/`BOT_CONTROL_SAFETY_MODEL.md`/`CANONICAL_ANALYTICS_MODEL.md`/`CONTRACTS/{tortila,legacy-bot}-adapter.md`,
`CONTRACTS/axioma-bridge.md` + `TERMINAL_PRODUCT_AREA.md` (new), `ENTITLEMENT_STATE_MACHINE.md`/`BILLING_PROVIDER_PLAN.md`/`PAYMENT_WEBHOOK_STATE_MACHINE.md`/`CONTRACTS/billing-webhooks.md`,
`DESIGN_SYSTEM.md` + `UX_SPEC_PHASE2.md` (new), `TRADINGVIEW_ACCESS_PLAN.md`/`CONTRACTS/tradingview-access.md`,
`EDUCATION_LMS_PLAN.md`, `BACKTESTER_DISTRIBUTION_PLAN.md`/`CONTRACTS/backtester-runner.md`, `TEST_PLAN_PHASE2.md` (new), `DEPLOYMENT.md` + the 14 per-agent handoffs.

**Wave-2 implementation (operator-serial — Part 4 + Parts 2/3):**
- `packages/analytics/src/metrics.ts` — additive, no existing-field/semantic changes: **GAP-F (P0)** `filterZeroEquity` applied before `computeDrawdown` (artifact 0-rows can no longer fabricate a ~100% drawdown); `netPnlWithFees` (subtracts fees as a positive cost — never overstates the bottom line); `firstEquity`+`roiPctSinceStart`; `avgWin`/`avgLoss`/`expectancy`; `safetyEventCount`; extended optional `CanonicalPosition`/`CanonicalTrade` fields; `combineMetrics`+`CombinedMetrics`, `mergedProfitFactor`, `isDataStale` (injectable `now`).
- `packages/analytics/src/index.ts` — re-export the new functions/type.
- `packages/analytics/src/metrics.test.ts` — **new**, 13 unit tests (GAP-F/A/B/C/D/E + boundaries).
- `packages/bot-adapters/src/types.ts` — optional `getEquityCurve?` on `BotAdapter` (real HTTP adapter unaffected).
- `packages/bot-adapters/src/mock-tortila.ts` / `mock-legacy.ts` — implement `getEquityCurve` (Tortila curve; Legacy honest `[]`); Tortila position enriched (stop/TP/openedAt/units), `firstEquity`+`safetyEventCount` fed into metrics.
- `apps/web/src/features/bots/meta.ts` — **new**: bot metadata + capability matrix (Tortila vs Legacy).
- `apps/web/src/features/bots/data.tsx` — **new**: `loadBot()` access helper + shared `BotAccessRequired` gate.
- `apps/web/src/components/BotSubNav.tsx` — **new**: dashboard tab strip.
- `apps/web/src/app/(app)/app/bots/[bot]/{positions,trades,equity,safety}/page.tsx` — **replaced placeholders** with real read-only dashboards (capability-aware; Legacy shows honest "not available", never fabricated).
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — added the sub-nav.
- `apps/web/src/app/(app)/app/bots/page.tsx` — added the **unified combined-portfolio** card (`combineMetrics`, gated to entitled bots; win-rate/PF shown per bot, never averaged).
- `tests/e2e/smoke.spec.ts` — +1 spec (×2 projects) for the sub-tabs + combined view.
- Truth docs: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

## Findings → fixes

- **P0 GAP-F (drawdown):** `computeMetrics` passed the raw equity curve to `computeDrawdown`; a single artifact
  `equity<=0` row produced a false ~100% drawdown. **Fixed** + unit-tested (`filterZeroEquity` applied first;
  also exported for the worker import pipeline). The equity sub-page renders the filtered curve.
- **GAP-A net PnL:** added `netPnlWithFees = closedPnl − feesTotal + fundingTotal`. The bot-integration handoff's
  literal `+ feesTotal` assumed fees stored negative; our convention stores fees as a **positive cost**, so the
  implementation **subtracts** them (documented inline) — the metric is always ≤ gross, never overstating.
- **Sitemap drift:** Phase-2 requested explicit per-bot/per-product routes; product-architect decided the existing
  **dynamic** `/products/[slug]` + `/app/bots/[bot]` routes serve them, with bot setup steps as dashboard tabs. The
  bot dashboards were built as sub-tabs accordingly (`positions/trades/equity/safety` + the existing `settings/backtester`).
- **Part-0 truth cleanup:** TV docs (DB-backed-when-`DATABASE_URL`; `tradingview_profiles`/`grants` TARGET; audit
  actions `tradingview.submit/.grant/.revoke`), secret-vault doc (real `exchange_accounts.key_mask` +
  `exchange_api_key_secrets.sealed jsonb`, not the DATA_MODEL `ciphertext_blob/...` columns), education thin-LMS
  status, billing route unification, and the deploy "swap demo.ts accessors" staleness were all corrected by the
  owning agents.
- **Capability honesty:** Legacy has no backtester / no closed-trade history / no equity curve — the UI shows
  explicit "not available" empty states, never fabricated panels (encoded in `BOT_CAPS`).

## Decisions

- **Bounded, verifiable slice this session** (Rule 7): unified analytics + read-only bot dashboards with mock
  adapters, **no migration**. The 18-table migration `0002` + LMS/billing repos + backend-selector wiring + the
  five parallel feature groups are multi-session and were **staged**, not half-built.
- **Audit-fan-out → operator-serial-implement** (Phase 1.7 precedent): shared files
  (`schema.ts`/`repositories.ts`/`backend.ts`/`db-store.ts`/`demo.ts`/`audit.ts`) are single-writer; not a git repo,
  so no worktree isolation — parallel implementer edits to shared files were avoided entirely this session.
- **All analytics changes additive** — `__smoke__.ts` and every existing caller/test stay green.

## Risks

- The migration-dependent parts (5/7/8/9) are designed but unbuilt; implementers must follow the serial spine in
  the platform-architect handoff and not parallelise shared-file edits.
- The bot dashboards run on **mock adapters** (`BOT_ADAPTER_MODE=mock`); every page carries the "Simulated data"
  banner. Real read-only adapters remain stubbed (`AdapterNotReadyError`); the Legacy plaintext-keys upstream risk
  is unchanged.
- `getEquityCurve` is optional on the interface; the real HTTP adapter does not implement it yet (equity sub-page
  shows the honest "no equity history" empty state in real mode until the endpoint is confirmed).

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

_Sequential run on the final tree. All runnable gates GREEN:_

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — current phase 20260530-0126; 14 cited per-agent handoffs all present; 0 errors, 1 warning (allowlisted 1921 historical) |
| 2 | `npm run check:core` | **PASS** (7 zero-install smokes; analytics 14 checks) |
| 3 | `npm run lint` | **PASS** (`--max-warnings 0`) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm test` (Vitest) | **PASS — 106 passed / 5 skipped (111)** across 15 files (+13 new `packages/analytics/src/metrics.test.ts`; was 93/5) |
| 7 | `npm run secret:scan` | **PASS** (clean) |
| 8 | `npm run coverage` | **PASS — 26.74% stmts / 67.47% branch** (branch ↑ from 64.67; analytics 75.14% stmts / 88.73% branch) |
| 9 | `npm run build -w @wtc/web` | **PASS** (all routes; bot sub-tabs now real pages, not placeholders) |
| 10 | `npm run e2e` (Playwright, `CI=1`) | **PASS 16/16** (desktop + mobile; +1 sub-tab/combined-view spec ×2) |
| — | `db:migrate`/`db:seed` against **real Postgres** | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; opt-in harness skipped (5 cases). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety policy): SSH/live servers, live bot control, real adapters/billing, Axioma production handoff,
TradingView automation, plaintext exchange keys.

## Background agents — closed

The 14 Wave-1 design/audit agents ran as one parallel fan-out that **completed**. One follow-up background run of
`ecosystem-task-router` was launched to recover its handoff; it completed (and confirmed the read-only agent type
has no Write tool — the operator persisted the authored content). **No agents remain running.**

## Next actions

See [`docs/NEXT_ACTIONS.md`](../NEXT_ACTIONS.md). Each its own NEW session, following the serial spine in
[`20260530-0126-ecosystem-platform-architect.md`](20260530-0126-ecosystem-platform-architect.md):
- **Phase 2.1 — Migration `0002`** (db-architect, SERIAL): the bots-snapshot tables + LMS-full + TV grants/profiles
  + product_access_events + terminal + ops tables (additive; `db:generate` + PGlite test; real `db:migrate`/`db:seed`
  when a throwaway `wtc_test` `DATABASE_URL` exists), then the repos.
- **Phase 2.2 — LMS full** (Part 8) and **billing repos/Stripe adapter** (Part 9) on the new schema.
- **Phase 2.3 — Terminal/Axioma pages** (Part 6) + **TradingView grants/profiles UI** (Part 7).
- Throughout: per-mutation security pipelines + new audit vocabulary (security handoff), and the Part-12 integration
  tests enumerated in `docs/TEST_PLAN_PHASE2.md`.
