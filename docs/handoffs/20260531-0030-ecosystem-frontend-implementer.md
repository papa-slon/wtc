# ecosystem-frontend-implementer handoff

**Epoch:** 20260531-0030
**Agent:** ecosystem-frontend-implementer
**Phase:** PG10 — Backtester / Distribution (option b — permanent honest locked card)
**Mode:** Read-only audit

---

## Scope

Pre-implementation audit for PG10 (Backtester/Distribution, option b). The operator has decided the
backtester ships as an **explicit, permanently-honest "not available yet" locked card** — not the real
local-runner ZIP and its nine API routes (option a, green-lit separately as a future multi-session epic).

This agent's lens:
- Map SPINE vs disjoint files for this phase.
- Describe how the page should consume the pure `@wtc/backtester` deriver (option b: no import needed;
  option b is a UI concern only).
- Audit whether `BotSubNav.tsx` makes the "Backtester" tab reachable today and whether PG10 must touch it.
- Confirm `migrationNeeded=false` (no new tables under option b).
- Flag the "demo-honesty" rule: the page renders identically in demo and real-PG.
- Inventory the exact current half-state defects and what the implementer must fix.

---

## Files inspected

| File | Notes |
|------|-------|
| `AGENTS.md` | Handoff format, non-negotiables, conventions |
| `docs/SESSION_PROTOCOL.md` | Process governance |
| `docs/handoffs/0000-orchestrator-seed.md` | ProductCode registry (no `backtester` code; sub-feature of `tortila_bot`/`legacy_bot`) |
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | Current half-state page (primary subject) |
| `packages/backtester/src/index.ts` | Orphaned type-model stub |
| `packages/backtester/package.json` | Package manifest |
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Full option-a design (context for what is deferred); §16.1/§17 locked design |
| `docs/CONTRACTS/backtester-runner.md` | Contract for the deferred option-a implementation |
| `docs/PRODUCTION_BLOCKERS.md` | PG10 operator-decision line (B2/B3/B4/B6; no backtester-specific blocker) |
| `docs/ROADMAP_MASTER.md` §10 | PG10 status + operator-decision gate |
| `docs/EXECUTION_PLAN_MASTER.md` | SPINE vs disjoint; W11 / PG10 placement |
| `docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md` | PG9 aggregate: patterns, gates, ADR-019 |
| `docs/handoffs/20260531-0005-ecosystem-security-auditor.md` | F-03: backtester entitlement gate ordering (deferred from PG9) |
| `packages/cabinet/src/derive.ts` | Pure deriver precedent (@wtc/cabinet pattern) |
| `packages/cabinet/src/index.ts` | Cabinet index; type-only import pattern |
| `packages/ui/src/theme.css` | Design system CSS: pills, buttons, EmptyState, locked-card patterns |
| `docs/DESIGN_SYSTEM.md` | §8 state matrix, §10 responsive, §11 anti-patterns |
| `apps/web/src/components/BotSubNav.tsx` | Tab strip; includes "Backtester" tab entry |
| `apps/web/src/features/bots/meta.ts` | `BOT_CAPS.hasBacktester`; capability matrix |
| `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` | Uses `caps.hasBacktester` to conditionally show the Backtester link |
| `apps/web/package.json` | Already has `@wtc/backtester: "*"` dep |
| `apps/web/next.config.ts` | Already has `@wtc/backtester` in `transpilePackages` |
| `tsconfig.base.json` | Already has `@wtc/backtester` path alias |
| `apps/web/src/app/(app)/app/layout.tsx` | Auth gate: `getCurrentUser()` → redirect('/login') |
| `vitest.config.ts` | Excludes `apps/web/**`; includes `packages/**/*.test.ts` |
| `docs/handoffs/20260530-0126-ecosystem-backtester-architect.md` | Observations on stub type inconsistencies |

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — HIGH — Disabled teaser form + two disabled buttons violate the "no half-state" rule

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:47-59`

The Tortila branch (when `access.allowed`) renders a "Configure a run" card with a full form (Symbols,
Timeframe, System, Risk %, Start, End) and two permanently-disabled buttons:
- `"Queue run (local runner required)"` (disabled)
- `"Download local runner (soon)"` (disabled, `title="Local runner packaging is planned — not
  downloadable in this build"`)

This is the exact half-state the operator decision removes. Per `BACKTESTER_DISTRIBUTION_PLAN.md §16.1`
and the hard constraints, no "coming soon" CTA that implies imminent availability is permitted. The form
fields are inert (no `onSubmit`, no server action — clicking "Queue run" does nothing), but their
presence implies the feature is near-ready. The "Download local runner (soon)" button is explicitly
prohibited by the DESIGN_SYSTEM anti-patterns rule (§11): "No disabled teaser button that implies future
availability."

**Recommendation:** Replace the entire Tortila `access.allowed` branch with the option-b locked card
pattern: a `Card` or `EmptyState` with an honest permanent statement and no form, no buttons, no
progress indicators. See F-02 for the specific wording from `§17.2` adapted to Tortila.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` (Tortila allowed branch,
lines 43-66)

---

### F-02 — HIGH — Legacy branch copy says "coming soon" and implies future availability

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:18-29`

The Legacy branch renders:
```
Card title: "Coming soon"
Text: "The Legacy Bot backtester is out of scope at MVP. Only the Tortila backtester is available.
       See the product roadmap for a future release."
```

`BACKTESTER_DISTRIBUTION_PLAN.md §17.2` (locked design, epoch 20260530-0126) explicitly states:

> "The wording does NOT say 'coming soon' or 'planned' — it states the product boundary clearly."

The locked wording is:
```
Section header kicker: "Legacy backtester"
Title: "Not available for this bot"
Card: "The Legacy Bot does not have a backtester. The Tortila Turtle strategy backtester is available
       under Bots → Tortila → Backtester."
[No form. No job creation link. No download button. No "coming soon" CTA.]
```

The current copy "Coming soon" and "See the product roadmap for a future release" both imply a future
Legacy Bot backtester is planned. `BOT_CAPS.legacy_bot.hasBacktester = false` is a permanent product
fact, not a temporary placeholder.

**Recommendation:** Replace Card title "Coming soon" with "Not available for this bot" and rewrite the
body text per the locked wording. Remove the SectionHeader `title="Not available"` — the locked design
uses `title="Not available for this bot"`.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` (Legacy branch, lines 18-29)

---

### F-03 — MEDIUM — Legacy branch skips entitlement gate (carried from PG9 security audit F-03)

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:18`

The Legacy branch (`if (bot === 'legacy')`) returns before `requireUser()` and `accessFor()` are called.
The `(app)/app/layout.tsx` auth gate (`getCurrentUser()` → redirect) means unauthenticated users never
reach this page, so there is no unauthenticated-access hole. However:

1. Any authenticated user — regardless of `legacy_bot` entitlement — sees this page, because no
   entitlement check is performed for the `legacy` slug.
2. The pattern is inconsistent with every other bot sub-page (positions, trades, equity, safety,
   settings), all of which call `requireUser()` + `accessFor()` before rendering anything bot-specific.
3. PG9 security audit (F-03 in `20260531-0005-ecosystem-security-auditor.md`) flagged this and deferred
   the fix to PG10.

The content is anodyne ("not available for this bot"), but the pattern must be corrected per the
AGENTS.md non-negotiable: entitlements fail closed and are the only access source of truth.

**Recommendation:** Call `requireUser()` then `accessFor(user.id, 'legacy_bot')` before the Legacy
branch returns. If `!access.allowed`, render the canonical `RiskWarningBanner` denial state. Then render
the permanent "not available for this bot" card. The `BAcktesterDistributionPlan §17.2` spec says the
locked card "renders immediately, before any session/entitlement check" — this is incorrect in the
context of the pattern; `requireUser` is still needed to establish the authenticated user. The
entitlement check determines which access-denied variant to show vs. the product-boundary variant; both
are non-data states so the performance cost is negligible.

**Alternative (simpler):** since the content reveals no sensitive data and the layout already gates
unauthenticated requests, a `requireUser()` call (no full `accessFor`) is sufficient for consistency,
at the cost of not knowing whether the authenticated user has `legacy_bot` access. The full pattern
(requireUser + accessFor) is preferred for exact consistency.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` (Legacy branch, before
line 18)

---

### F-04 — MEDIUM — `packages/backtester/src/index.ts` is an orphaned stub with latent design drift

**Evidence:** `packages/backtester/src/index.ts:7-69`

The package contains:
- `BacktestParams.system: string` (line 11) — the full design in `BACKTESTER_DISTRIBUTION_PLAN.md §5.1`
  specifies `system: 1 | 2` (integer), matching the Python engine's `BacktestConfig.system`. These are
  inconsistent.
- `BacktestStatus` (4 states: queued/running/done/failed) vs. the full design's 5 states
  (queued/running/done/failed/cancelled).
- `BacktestJob` has no `engine: 'tortila' | 'legacy_dca'` field — required per the artifact validation
  contract (§4.4 of `backtester-runner.md`).
- `BacktestResultArtifact.metrics: Record<string, number | null>` is a loose approximation of the
  detailed typed artifact schemas in `BACKTESTER_DISTRIBUTION_PLAN.md §7`.
- The stub `BacktestService` class with `createJob`, `attachResult`, `getResult` is option-a logic
  (memory store, job creation) that belongs in a future phase and should not exist in a pure
  type-definition package.
- **No `backtesterStatusLabel()` function exists in the current file** (the prompt's description appears
  to reference a planned helper that was never written). The package has no test coverage
  (`vitest.config.ts` includes `packages/**/*.test.ts` but no test file exists for `@wtc/backtester`).

The package is currently orphaned: it is in `apps/web/package.json` and `next.config.ts`
`transpilePackages`, but the backtester page does NOT import from `@wtc/backtester`. The page uses
local access helpers directly.

**Under option b**, `packages/backtester` should export only:
- A pure status-label helper (for future display, when real jobs exist).
- The canonical `BACKTESTER_LOCKED_REASONS` or similar pure constant — but only if the page imports it.

The option-b page needs nothing from `@wtc/backtester` at all. The package can remain as a typed
foundation for option a (future phase) without being imported by option b.

**Recommendation:** Do NOT import `@wtc/backtester` from the option-b page. The package stays as a
deferred foundation. A `packages/backtester/src/backtester.test.ts` with at least one test should be
added in a future phase when the package is real; until then, the Vitest run simply finds no tests and
does not report a failure (zero test files is not a failure, only zero coverage — which is already
accounted for in the 26.49% baseline from PG9).

**Target part:** `packages/backtester/src/index.ts` (no change in PG10; defer to option-a phase)

---

### F-05 — LOW — `BotSubNav.tsx` "Backtester" tab is always rendered, even for legacy_bot

**Evidence:** `apps/web/src/components/BotSubNav.tsx:10`

```typescript
{ seg: 'backtester', label: 'Backtester' },
```

The "Backtester" tab is always included in `TABS` regardless of bot slug. For the legacy bot,
navigating to this tab renders the "not available for this bot" card (after F-02 is fixed). This is
not a breakage — it is the correct behaviour under the permanent locked-card model, since the tab
navigates to the page that explains the product boundary. However it may create a slightly confusing
UX where a legacy bot user sees a tab that leads to a "not available" screen.

The bot overview page (`bots/[bot]/page.tsx:148-149`) already conditionally shows the Backtester
link in the Configuration card: `{caps.hasBacktester && (<Link href=... className={...}>Backtester</Link>)}`.
This is consistent with `BOT_CAPS.legacy_bot.hasBacktester = false`.

**Decision needed by implementer:** keep the Backtester tab visible in `BotSubNav` for all bots
(current), or conditionally omit it for bots where `BOT_CAPS[code].hasBacktester === false`.

If the tab is kept for legacy, it routes to the honest "not available for this bot" card — which is
acceptable and honest. Removing it from the nav for legacy_bot is cleaner UX. PG10 may touch
`BotSubNav.tsx` to conditionally suppress the tab, or may leave it as-is (the page already handles
the case).

The implementer should choose one approach and be consistent with `BOT_CAPS`. **This file is a
disjoint edit** (not on the SPINE) so it is safe to modify independently.

**Target part:** `apps/web/src/components/BotSubNav.tsx` (optional PG10 edit)

---

### F-06 — INFO — The option-b page imports `@wtc/backtester` via `apps/web/package.json` but does not use it

**Evidence:** `apps/web/package.json:29` (`"@wtc/backtester": "*"`), `next.config.ts:20`
(`'@wtc/backtester'` in `transpilePackages`), `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:1-4`
(no import from `@wtc/backtester`)

The backtester page currently imports only:
- `'next/navigation'` (notFound)
- `'@/lib/session'` (requireUser)
- `'@/lib/access'` (accessFor, reasonLabel)
- `'@wtc/ui'` (Card, SectionHeader, EmptyState, RiskWarningBanner, buttonClasses)

No import from `@wtc/backtester`. The package is declared as a dependency and in `transpilePackages`
as infrastructure for the option-a future phase, not because option b needs it. This is correct and
should remain as-is — the dep/transpile entries do not hurt and they mean option-a can be added without
touching `package.json` / `next.config.ts` again.

**Recommendation:** No change. The dep and transpile entries stay as option-a preparation. The
option-b page should not import from `@wtc/backtester`.

**Target part:** No change needed.

---

### F-07 — INFO — `BOT_CAPS.hasBacktester` is available but not consulted by the backtester page

**Evidence:** `apps/web/src/features/bots/meta.ts:56-88` (`BOT_CAPS.tortila_bot.hasBacktester = true`,
`BOT_CAPS.legacy_bot.hasBacktester = false`); `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:6-9`

The backtester page has its own `MAP` object duplicating the bot slug → product code mapping, and uses
`bot === 'legacy'` for its branch condition. The `BOT_CAPS` capability matrix already declares
`hasBacktester` per bot. Using `BOT_CAPS[meta.code].hasBacktester` would be more canonical and
eliminate the string-literal guard. Under option b, both approaches reach the same result; under
option a, aligning with `BOT_CAPS` would make adding a new bot with a backtester trivially correct.

**Recommendation:** Consider refactoring the backtester page to use `BOT_CAPS[meta.code].hasBacktester`
instead of `bot === 'legacy'` for the "not available" branch. Not a blocking issue for option b. The
current MAP is correctly defined.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` (optional refactor)

---

## Decisions

### SPINE vs disjoint file map for PG10 (option b)

| File | Classification | Writer | Notes |
|------|---------------|--------|-------|
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | DISJOINT | ecosystem-frontend-implementer | Primary deliverable — replace half-state with honest locked cards |
| `apps/web/src/components/BotSubNav.tsx` | DISJOINT | ecosystem-frontend-implementer | Optional: suppress Backtester tab for legacy_bot |
| `packages/backtester/src/index.ts` | DISJOINT (package) | None / defer | No change under option b; deferred to option-a phase |
| `packages/ui/src/theme.css` | SPINE (single-writer) | None this phase | No new CSS classes needed; locked-card uses existing `.wtc-card`, `.wtc-stack`, `EmptyState` |
| `tsconfig.base.json` | SPINE (operator) | None this phase | Already has `@wtc/backtester` alias |
| `apps/web/package.json` | SPINE | None this phase | Already has `@wtc/backtester` dep |
| `apps/web/next.config.ts` | SPINE | None this phase | Already has `@wtc/backtester` transpile |
| `vitest.config.ts` | SPINE (operator) | None this phase | No new package needs wiring |
| `tests/integration/backtester-pg10.test.ts` | DISJOINT (new) | ecosystem-frontend-implementer | Static source guards: no form, no disabled buttons, entitlement gate before legacy render |
| `tests/e2e/backtester-pg10.spec.ts` | DISJOINT (new) | ecosystem-frontend-implementer | E2e: locked card shows for tortila (access.allowed) + denial state + legacy boundary message |
| `docs/ROADMAP_MASTER.md` §10 | Operator aggregate, serialize-last | Operator | Update status once gates pass |
| `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` | SPINE, operator | Operator | Serialize-last after gates |

**Observation:** Option b adds zero SPINE conflicts. The only file that strictly needs a change is the
backtester page. `BotSubNav.tsx`, the static test file, and the e2e spec are all disjoint.

---

### Package wiring — does the page need to import from `@wtc/backtester`?

No. Option b is a pure UI change: replace the dead config form and two disabled teaser buttons with an
honest locked card. The `@wtc/backtester` package contains option-a runtime logic (`BacktestService`,
`createJob`, `attachResult`). None of that is relevant to option b.

The page already imports correctly from `@wtc/ui` (Card, SectionHeader, EmptyState, RiskWarningBanner)
which is all the presentation layer it needs. The dep/transpile entries for `@wtc/backtester` in
`apps/web/package.json` and `next.config.ts` are infrastructure for option a and should remain.

---

### How the page stays thin (no inline logic)

Under option b:

1. The MAP lookup + `notFound()` call is the only routing logic (acceptable — same pattern as all
   other bot sub-pages).
2. `requireUser()` + `accessFor()` calls are the entitlement layer — these are package calls, not
   inline logic.
3. The Legacy branch is a static product-boundary render — no computation.
4. The Tortila branch is either the entitlement-denied state or the locked card — no computation,
   no data loading, no signals.

This is thinner than the current page (which has a dead form with inline JSX state) and is fully
consistent with the "thin page, logic in packages" rule from AGENTS.md.

---

### Entitlement gate ordering (incorporating F-03 fix)

The correct call order for both branches:

```
requireUser()           → establishes authenticated user (layout already ensures this, but required
                          by convention and for per-page fail-closed correctness)
accessFor(user.id, code) → entitlement decision via @wtc/entitlements only
if !access.allowed      → render RiskWarningBanner denial state, return
if bot === 'legacy'     → render permanent "not available for this bot" card
  (or if !BOT_CAPS[code].hasBacktester — see F-07)
else                    → render Tortila locked card
```

This ordering means the Legacy "not available" card is only shown to users who are both authenticated
and entitled to `legacy_bot` (or the reverse: show an access-denied card first, then a product-boundary
note — the implementer may choose either; the former is simpler because it matches the Tortila access
flow exactly).

---

### Migration confirmation

`migrationNeeded = false`. Option b adds no tables. No new routes. No new server actions. No CSRF
surface added. `db:generate` stays at 41 tables (confirmed from PG9 gate 8 result: "No schema changes,
nothing to migrate"). No interaction with `backtest_jobs` or `backtest_artifacts` (TARGET / not
implemented, stays that way).

---

### Demo-honesty rule

The option-b page renders identically in demo (in-memory backend, `backendMode === 'demo'`) and real-PG.
The page shows no data — only the static locked card content and entitlement state. There is no
database query for artifact data, no equity curve, no job list. The entitlement check works in both
modes (demo backend provides seeded entitlement records). No special demo-mode guard is needed.

This satisfies the hard constraint: "the page renders identically in demo and real-PG because it shows
no data."

---

### New/changed files under option b

| File | Change type | Contents |
|------|-------------|----------|
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | REPLACE | Remove dead form + disabled buttons; add F-03 entitlement gate fix; honest Legacy card per §17.2; honest Tortila locked card per §17.3 state A (runner not available, no form) |
| `apps/web/src/components/BotSubNav.tsx` | OPTIONAL CHANGE | Accept `caps?: BotCapabilities` prop and suppress Backtester tab when `!caps.hasBacktester` |
| `tests/integration/backtester-pg10.test.ts` | NEW | Static source guards: no `<form`, no `disabled` teaser buttons, entitlement gate present before any legacy-branch render |
| `tests/e2e/backtester-pg10.spec.ts` | NEW | E2e: tortila locked card visible, legacy locked card with correct wording, entitlement denial state |

---

## Risks

1. **F-03 entitlement gate adds a DB call for the Legacy branch.** Currently the Legacy branch returns
   before `requireUser()`. Adding `requireUser()` + `accessFor()` means a DB round-trip for every
   legacy/backtester page visit. This is negligible cost (the same call is made on every other bot
   sub-page) and is required for pattern correctness. Not a regression risk.

2. **`BOT_CAPS`-based branching vs. `bot === 'legacy'` string guard.** If the implementer refactors to
   use `BOT_CAPS[meta.code].hasBacktester`, they must ensure the `MAP` lookup happens before the
   `BOT_CAPS` dereference (which it already does — `meta` is resolved from `MAP[bot]` first, then
   `notFound()` on miss). No risk if ordering is preserved.

3. **BotSubNav change is optional.** If `BotSubNav.tsx` is modified to accept `caps` and the caller
   (`bots/[bot]/page.tsx`) is updated to pass it, that page must be tested too. The simpler approach is
   to leave `BotSubNav.tsx` unchanged and let the tab remain for legacy (routing to the honest card).
   Recommend leaving `BotSubNav.tsx` unchanged in PG10 for minimal blast radius.

4. **`packages/backtester/src/index.ts` design drift is not fixed in PG10.** The stub types remain
   inconsistent with the option-a spec. This is explicitly deferred and noted in the option-a epic.

5. **No coverage for `packages/backtester` in Vitest.** The package has no `.test.ts` file. Vitest
   finds no tests, which is not a failure (zero files = zero tests reported, not a failure count). The
   26.49% statement coverage from PG9 will not be materially affected by PG10 (option b adds no package
   code). The only change is the page file which is already excluded from Vitest by `apps/web/**`.

6. **E2e test for entitlement-denied state requires the demo seeded user to NOT have a `tortila_bot`
   entitlement.** Check the demo seed before writing that spec. If the demo user has an active
   `tortila_bot` entitlement, the e2e cannot exercise the denial state without a separate test user or
   a mock. This is the same constraint already accepted in PG9 cabinet e2e.

---

## Verification/tests

Recommended gates for the implementer after making changes:

| # | Gate | Expected result |
|---|------|-----------------|
| 1 | `npm run typecheck -w @wtc/web` | PASS — no new type errors from the page rewrite |
| 2 | `npm run lint` | PASS — `--max-warnings 0` |
| 3 | `npm test` (Vitest) | PASS — at least 482 passed / 8 skipped (PG9 baseline); the new integration static tests add to this count |
| 4 | `npm run build -w @wtc/web` | PASS — backtester route still compiles (it is a simple RSC) |
| 5 | `npm run e2e` (Playwright) | PASS — existing 39 pass; new backtester e2e specs pass |
| 6 | `npm run db:generate -w @wtc/db` | PASS — "No schema changes, nothing to migrate"; 41 tables |
| 7 | `npm run governance:check` | PASS — new per-agent handoff file present at this epoch |
| — | `db:migrate` / real-PG harness | NOT RUN — no `DATABASE_URL` (B1, unchanged) |
| — | Real Stripe checkout | NOT RUN — B2, unchanged |
| — | Axioma production handoff | NOT RUN — B4, unchanged |

---

## Next actions

1. **Implementer** (ecosystem-frontend-implementer in the implementation session): rewrite
   `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` with:
   a. F-03 fix: call `requireUser()` + `accessFor()` before either branch; render `RiskWarningBanner`
      denial state when `!access.allowed`.
   b. F-02 fix: Legacy locked card per `BACKTESTER_DISTRIBUTION_PLAN.md §17.2` — no "Coming soon",
      no roadmap hint; just the product-boundary statement.
   c. F-01 fix: Tortila locked card (when `access.allowed`) — no form, no disabled buttons, honest
      "runner not yet available, check back" wording per §17.3 State A adapted for option b (the runner
      is permanently deferred, not "soon").
   d. Optionally: refactor Legacy branch to use `BOT_CAPS[meta.code].hasBacktester` (F-07, low
      priority).

2. **Implementer**: add `tests/integration/backtester-pg10.test.ts` (static source guards per PG9
   pattern in `tests/integration/cabinet-pg9.test.ts`).

3. **Implementer**: add `tests/e2e/backtester-pg10.spec.ts` (at minimum: verify locked card renders
   for tortila with access; verify legacy card renders correct boundary text; verify no form element
   and no disabled teaser buttons).

4. **Operator**: after gates pass, update `docs/ROADMAP_MASTER.md §10`, `docs/STATUS.md`,
   `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` (serialize-last per EXECUTION_PLAN_MASTER).

5. **Operator**: write the PG10 aggregate handoff linking this per-agent file and any other per-agent
   handoffs dispatched in the same epoch.

6. **Future / option-a phase**: `packages/backtester/src/index.ts` stub drift should be cleaned up
   (F-04) when option a is green-lit. At that point: align `BacktestParams.system: 1 | 2`, add
   `BacktestJob.engine`, align status to 5-state, replace the memory-store `BacktestService` with
   proper Drizzle-backed repos, and add real Vitest unit tests for the pure helpers.

---

## Summary

The current `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` has three defects that make it
dishonest or half-built under the option-b decision:
- F-01 (HIGH): dead config form + two disabled teaser buttons in the Tortila branch.
- F-02 (HIGH): "Coming soon" / "product roadmap for a future release" copy in the Legacy branch.
- F-03 (MEDIUM, carried from PG9): Legacy branch skips entitlement gate.

All three are disjoint edits to a single file. No migration, no SPINE edits, no new packages. The
`@wtc/backtester` package stays wired but unused by option b; `BotSubNav.tsx` is optional. After the
page is corrected, the platform's backtester surface will be permanently honest, rendering an explicit
product-boundary card for both bot slugs with no synthetic data, no form, no disabled CTAs implying
future availability, and no missing access gate.
