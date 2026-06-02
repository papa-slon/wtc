# Phase 2.12 / Phase Group 9 — User cabinet + product UX (aggregate handoff)

_2026-05-31, epoch `20260531-0005`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **4 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_cb3dcdfe-5fb`)
→ operator-orchestrated **serial** implementation (not a git repo, no worktrees, no parallel writers). **4 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / Axioma production handoff. **Not production-ready.** Eighth phase-group window in the operator's
continuous program (follows Phase 2.11 / PG8, epoch `20260530-2345`)._

## Scope

PG9 (User cabinet / product UX) from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md) W10 / [`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §9 —
a **UI/UX + pure-logic phase, no migration** (`db:generate` = "No schema changes"; 41 tables, unanimous 4/4 auditor verdict).
Two deliverables:

1. **Per-product cards on `/app`** that honestly show, per product: **entitlement** state, **setup** progress, recent
   **activity**, the single most-actionable **next action**, and any **blockers** — all **fail-closed** (the entitlement
   engine is the only access source of truth; per-user setup/activity signals are gathered ONLY when access is allowed).
2. **Mobile-first setup wizard** for bot exchange-key onboarding (`/app/bots/[bot]/setup?step=key|strategy|review`).

Reuses the PG8 responsive patterns (canonical pill taxonomy; the design-system CSS), consumes PG2 (bot health/blockers),
PG4 (billing-checkout availability → honest "Contact support" CTA), PG5 (TV state), PG6 (Axioma B4) and PG7 (LMS) outputs.

**Migration:** none (41 tables; `db:generate` = "No schema changes, nothing to migrate"). Confirmed by the tests-runner audit.

## Agents launched (4 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_cb3dcdfe-5fb`; all 4 returned, none left running):
1. `ecosystem-ux-ui-designer` → [`…-ecosystem-ux-ui-designer.md`](20260531-0005-ecosystem-ux-ui-designer.md) — the per-product
   card anatomy (5 zones), the `ACCESS_REASON_COPY` map (all 10 reasons), the per-product state map, the wizard stepper UX
   + CSS spec, 375px/a11y. F-01..F-09 (migrationNeeded:false).
2. `ecosystem-frontend-implementer` → [`…-ecosystem-frontend-implementer.md`](20260531-0005-ecosystem-frontend-implementer.md) —
   the file map (SPINE vs disjoint), the loader fan-out + per-product signal plan, the pure-derivation location debate, the
   wizard route, `migrationNeeded:false`, the demo-honesty rule. F1..F9.
3. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260531-0005-ecosystem-security-auditor.md) — **F-01
   (medium): `indicators/page.tsx` loads per-user TV data BEFORE the entitlement check** (the anti-pattern PG9 must not copy);
   F-02 CSRF ordering; positive confirmations on vault/keyMask/fail-closed bot sub-pages/blocker honesty. F-01..F-11.
4. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260531-0005-ecosystem-tests-runner.md) — confirmed the 5
   baseline gates green; ran `db:generate` (41 tables, no change); the unit/static/e2e test plan; the dual-tone-derivation
   drift risk (F-07); the 390-vs-375 viewport + Server-Action flake notes. F-01..F-07.

## Cross-auditor conflicts resolved (operator decisions)

1. **Pure-derivation location.** frontend-implementer (F2: `apps/web/features/cabinet/deriver.ts`, static-guarded only) vs
   tests-runner (F-01: `packages/cabinet` for **real Vitest coverage**). **Decision: a new pure package `@wtc/cabinet`** —
   fail-closed access→view-model logic is security-critical and deserves real unit coverage (26 tests; vitest excludes
   `apps/web/**`), and AGENTS.md mandates "logic in packages, not React files". The frontend objection (server-only types /
   cascading edits) is avoided by making **all cross-package imports type-only** (the package is zero-runtime-dependency, like
   `@wtc/entitlements`); the app-layer loader gathers signals and calls the pure deriver.
2. **Card component location.** ux-ui-designer + tests-runner (new `ProductCabinetCard` in `packages/ui`) vs frontend
   (app-layer wrapper). **Decision: `apps/web/src/features/cabinet/CabinetProductCard.tsx`** — putting it in `packages/ui`
   would create a **`@wtc/ui` → `@wtc/cabinet` circular dependency** (the card consumes the `CabinetCardView` type, and
   `@wtc/cabinet` already type-imports `Tone` from `@wtc/ui`). The design-system kit stays low-level; the feature-specific
   card composes its primitives. The reusable parts (stepper + card-row CSS) DO live in `packages/ui/src/theme.css`.
3. **Wizard route.** ux (multi-route `[step]`) vs frontend (single route `?step=`). **Decision: single route
   `/app/bots/[bot]/setup` with `?step=`** — fully server-rendered, browser back/forward works, and step navigation is GET
   links (not form posts), which keeps the e2e **navigation-only** and clear of the known dev-only Server-Action flake
   (tests-runner guidance). `BotSubNav` is NOT given a `setup` tab (frontend risk honoured).
4. **B4 surfacing.** ux (an `AXIOMA_B4_CLEARED` env flag) vs frontend (hard-code `B4`). **Decision: a static blocker
   registry, no env flag** (dead-code-avoidance — the project's standing principle); the deriver marks `axioma_terminal` with
   B4 unconditionally and a static guard asserts it. B4 is removed in code, with its consumer, when it clears.
5. **Folded-in security fixes.** F-01 (indicators per-user load gated on `access.allowed`) and F-02 (security-page
   `addKeyAction` → CSRF-first) are fixed in this phase — F-01 is the canonical fail-closed pattern the new cabinet loader
   follows, so leaving the anti-pattern in place would invite copy-paste. F-04 (Tortila notices entitlement-gated) is resolved
   structurally: warnings now live on the tortila card (only gathered when owned). The new wizard actions are exemplary
   (CSRF-first + fail-closed re-check). Deferred (noted): F-03 backtester gate ordering, F-05 double `requireUser`, F-07
   audit-on-denial for the existing settings action.

## Files changed

**New pure package `@wtc/cabinet` (real unit coverage):**
- `packages/cabinet/package.json`, `packages/cabinet/src/index.ts`
- `packages/cabinet/src/derive.ts` — `deriveProductCard()` (pure) + `ACCESS_REASON_COPY` (all 10 reasons) + `reasonTone`/
  `reasonLabel` + the static blocker text registry. Type-only imports of `AccessReason`/`ProductCode` (`@wtc/entitlements`)
  and `Tone` (`@wtc/ui`) → zero runtime deps.
- `packages/cabinet/src/derive.test.ts` — **26 unit tests** (per-reason CTA routing, expiresInDays, blockers/warnings, and 5
  explicit fail-closed invariants U-FC-01..05).

**SPINE (single-writer, serialized-first):**
- `packages/ui/src/theme.css` — `.wtc-btn { min-height:44px }` moved to the base rule (F-04); new `.wtc-wizard-steps` /
  `.wtc-step` stepper (§15) + `.wtc-card-row` helper; **`.wtc-shell` grid → `minmax(0, 1fr)` + content `min-width:0`** (fixes a
  CSS-grid min-content blowout that horizontally scrolled the wizard at 375px — caught by the new e2e; hardens every app page).
- `tsconfig.base.json` — `@wtc/cabinet` path alias.
- `apps/web/package.json` (+`@wtc/cabinet` dep) + `apps/web/next.config.ts` (+`@wtc/cabinet` transpile); `npm install` symlinked it.

**App-layer (disjoint):**
- `apps/web/src/features/cabinet/loader.ts` (**new**, server-only) — per-product access decision + fail-closed signal fan-out
  (gathers setup/activity ONLY when `access.allowed`) → `deriveProductCard`.
- `apps/web/src/features/cabinet/CabinetProductCard.tsx` (**new**, RSC presentational).
- `apps/web/src/app/(app)/app/page.tsx` — rewritten to consume `loadCabinet()` + render `CabinetProductCard` (thin; no inline
  access logic; the unconditional Tortila notices card removed — now per-card + entitlement-gated).
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` (**new**) — 3-step wizard + 2 CSRF-first, fail-closed server actions.
- `apps/web/src/app/(app)/app/indicators/page.tsx` — **F-01**: `loadTvUserData` gated on `access.allowed`.
- `apps/web/src/app/(app)/app/security/page.tsx` — **F-02**: `addKeyAction` CSRF-first.

**Tests:**
- `tests/integration/cabinet-pg9.test.ts` (**new**, 15 static source-guards: loader fail-closed; thin page; presentational
  card / no circular dep; wizard CSRF-first + no plaintext secret + stepper CSS; F-01/F-02 fixes).
- `tests/e2e/cabinet-pg9-mobile.spec.ts` (**new** — 375px, mobile-scoped, navigation-only: cabinet honest per-product state +
  the wizard stepper, no horizontal page scroll). The 375px spec **caught a real overflow** (the shell min-content blowout), fixed pre-merge.

**Docs (owned-doc truth, serialize-last):** `docs/DESIGN_SYSTEM.md` §15, `docs/ARCHITECTURE_DECISIONS.md` **ADR-019**,
`docs/ROADMAP_MASTER.md` §9, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`.

## Findings → fixes (summary)

- **(ux F-01 / frontend F1 / tests F-01) cabinet showed only entitlement** → new `ProductCabinetCard` with 5 honest zones,
  driven by the pure `@wtc/cabinet` deriver via a fail-closed loader.
- **(security F-01, medium) indicators loaded per-user TV data before the entitlement check** → gated on `access.allowed`;
  the cabinet loader follows the same fail-closed minimisation (signals only when allowed).
- **(ux F-03 / F-05) legacy & axioma CTAs misled** → owned-but-blocked (B3/B4) products get "View status"/"View details"
  (ghost), never "Open"/"Finish setup"; the blocker strip is always shown (static product fact).
- **(ux F-04 / security F-04) button tap target only inside tables** → `min-height:44px` on the base `.wtc-btn`.
- **(security F-02) security-page action requireUser-before-CSRF** → CSRF-first.
- **375px overflow (new e2e)** → `.wtc-shell` `minmax(0,1fr)` + `min-width:0` (grid min-content blowout from the stepper).

## Decisions

1. No migration this phase (41 tables, unanimous 4/4).
2. Pure derivation in a new zero-dependency `@wtc/cabinet` package (real unit coverage); presentational card in
   `features/cabinet` (no `@wtc/ui`→`@wtc/cabinet` cycle); reusable CSS in `theme.css`.
3. Single-route `?step=` wizard; step nav via GET links (navigation-only e2e); `BotSubNav` unchanged.
4. Fail-closed data minimisation: the loader gathers per-product setup/activity ONLY when `access.allowed`. Static blockers
   (B3/B4/planned) are product facts shown regardless of entitlement (not user data).
5. B4 via a static blocker registry, no half-wired env flag.
6. F-01 + F-02 folded in (anti-pattern prevention); F-03/F-05/F-07 deferred (noted below).

## Risks

- **Demo-mode coverage.** e2e runs in demo (no `DATABASE_URL`); the seeded user yields a rich honest spread (owned/expired/
  not-owned + B3/B4/planned), but Postgres-backed setup/activity rows are not exercised end-to-end. The fail-closed gating is
  unit-tested (`@wtc/cabinet`) + statically guarded; a real-PG e2e (B1) would exercise populated signals. Honest gap.
- **Server actions not executed in vitest** (`apps/web` excluded) — the wizard's CSRF-first + fail-closed guarantees are
  static-source + e2e asserted (the established repo pattern); the pure logic has real unit coverage.
- **`@wtc/cabinet` keeps a parallel canonical reason→tone map** to the legacy `ProductStatusCard` inline map; the old card is
  no longer used by the cabinet (only the public catalog), so there is no live drift in PG9's surface. Noted for a future
  consolidation.
- Still NOT production-ready; PGlite is not a substitute for real-PG acceptance (B1) — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** (exit 0 — incl. new `@wtc/cabinet`) |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** (exit 0 — loader/card/page/wizard + the 2 security fixes) |
| 5 | `npm run secret:scan` | **PASS** (clean) |
| 6 | `npm test` (Vitest) | **PASS — 482 passed / 8 skipped (490)** across 42 files (+41 vs PG8: derive 26, cabinet-pg9 15) |
| 7 | `npm run coverage` | **PASS — 26.49% stmts / 75.33% branch** (branch **+1.01** vs PG8 — `packages/cabinet` 84%/96.82%; stmts −0.34 = new app-layer cabinet code in the e2e-covered/unit-excluded `apps/web` denominator; no enforced threshold) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 41 tables; "No schema changes, nothing to migrate"** (no migration) |
| 9 | `npm run build -w @wtc/web` | **PASS — 34 routes incl. the new `/app/bots/[bot]/setup`; `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright) | **PASS — 39 passed / 3 skipped / 0 flaky** (5.2 min; +2 PG9 mobile specs; the 375px spec caught + verified the shell-overflow fix; 3 skipped = desktop instances of the 3 mobile-only specs) |
| 11 | `npm run governance:check` | **PASS** (current phase `20260531-0005`; 4 cited per-agent handoffs all present) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B2 Stripe test-mode checkout** | **NOT RUN** — Q-2 undecided + no Stripe test keys (the cabinet/wizard surface this honestly: `checkoutEnabled=false` → "Contact support"). |
| — | **B4 Axioma real activation** | **NOT RUN / TARGET** — OP P-256 key + EXT endpoint shapes (the cabinet shows the B4 blocker). |
| — | `npm ci` | **NOT RE-RUN** — `npm install` ran once to symlink the new `@wtc/cabinet` workspace package; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production handoff /
journal_server, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter
stays deleted + factory-blocked (B3); all three Axioma terminal CTAs stay disabled (B4).

## Background agents — closed

All 4 per-agent runs in the audit fan-out (Workflow `wf_cb3dcdfe-5fb`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG10 Backtester** — needs the operator decision (real local-runner ZIP vs explicit locked card) before build ([`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §10).
- **Phase-3 LMS rich** — migration 0005 co-landed with its consumers + pinned-link/teacher-profile web surfaces (carried from PG7).
- **PG12 CI / deploy readiness** — gated on real-PG run (B1) + `git init` (B6).
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma endpoint
  shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); Q-6 club+education bundling.
- **Carried:** F-03 backtester gate ordering, F-05 double `requireUser`, F-07 settings audit-on-denial; F-03 structured logger
  (PG12); CSP per-request nonce; a real-PG e2e to exercise populated cabinet setup/activity signals; consolidate the legacy
  `ProductStatusCard` tone map onto `@wtc/cabinet`.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
