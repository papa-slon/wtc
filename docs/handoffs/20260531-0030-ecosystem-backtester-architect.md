# ecosystem-backtester-architect handoff

**Epoch:** 20260531-0030
**Agent:** ecosystem-backtester-architect
**Phase:** PG10 — Backtester option (b) audit (read-only)

---

## Scope

Read-only audit of the backtester domain against the operator decision: option (b) — a permanently
honest "not available yet" locked card, NOT the real local-runner infrastructure. Validates that:

- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` removes all half-state (dead config
  form, disabled teaser buttons, "coming soon" language).
- The replacement is an honest permanent product-boundary statement, not a roadmap promise.
- `packages/backtester/src/index.ts` is in a correct state and wired into typecheck and coverage.
- All design docs record the decision so the deferral is not lost.
- No migration is needed (41 tables confirmed).

---

## Files inspected

| File | Notes |
|------|-------|
| `docs/handoffs/0000-orchestrator-seed.md` | Product codes, hard rules, agent roster |
| `AGENTS.md` | Handoff format, non-negotiables, conventions |
| `docs/SESSION_PROTOCOL.md` | Process governance |
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | Current half-state (67 lines) |
| `packages/backtester/src/index.ts` | Package stub (70 lines); current type model |
| `packages/backtester/package.json` | Package config |
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Full option-a design + §16/§17 locked decisions |
| `docs/CONTRACTS/backtester-runner.md` | Contract v1.1.0; mock/real table; required tests |
| `docs/ROADMAP_MASTER.md` §10 | Backtester roadmap line |
| `docs/PRODUCTION_BLOCKERS.md` | PG10 operator-decision line |
| `docs/EXECUTION_PLAN_MASTER.md` | W11 PG10 placement |
| `docs/handoffs/20260530-0126-ecosystem-backtester-architect.md` | Phase 2 design handoff |
| `docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md` | PG9 aggregate (precedent) |
| `packages/cabinet/src/derive.ts` | @wtc/cabinet precedent: pure deriver + types |
| `packages/cabinet/src/index.ts` | @wtc/cabinet re-export pattern |
| `packages/cabinet/src/derive.test.ts` | 26 unit tests; zero-dep pattern |
| `packages/ui/src/theme.css` | Design-system CSS (not read here; referenced indirectly) |
| `vitest.config.ts` | Test include: `packages/**/*.test.ts`; excludes `apps/web/**` |
| `tsconfig.base.json` | Path aliases; `@wtc/backtester` wired at `packages/backtester/src/index.ts` |
| `apps/web/package.json` | `@wtc/backtester: *` in dependencies |
| `apps/web/next.config.ts` | `@wtc/backtester` in transpilePackages |
| `apps/web/src/features/bots/meta.ts` | `BOT_CAPS.legacy_bot.hasBacktester = false`; capability matrix |
| `coverage/wtc_ecosystem_platform/packages/backtester/src/index.ts.html` | 0/69 statements, 0/1 functions |

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — CRITICAL: Legacy card uses "Coming soon" title implying future availability

**Severity:** critical
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:22`
```
<Card title="Coming soon">
```
**The problem:** `BACKTESTER_DISTRIBUTION_PLAN.md §17.2` and `CONTRACTS/backtester-runner.md §10`
both specify that the Legacy card must state a product boundary, NOT imply forthcoming availability.
The current title "Coming soon" is a direct violation of the "must NOT say coming soon, state the
product boundary" rule that the plan already mandates. It makes a roadmap promise WTC cannot fulfil.

**Also at line 24:** "See the product roadmap for a future release." — this is a teaser, not a
boundary statement.

**Required replacement:** Remove the `<Card title="Coming soon">` wrapping and the "product
roadmap" reference. The card must say that Legacy Bot does not have a backtester, period, and
redirect users to the Tortila path if they need backtesting. The exact wording from §17.2:

> "The Legacy Bot does not have a backtester. The Tortila Turtle strategy backtester is available
> under Bots → Tortila → Backtester."

No form. No job creation link. No download button. No "coming soon" or "future release" copy.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` lines 19–29.

---

### F-02 — CRITICAL: Tortila path has a dead config form implying queuing is possible

**Severity:** critical
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:47–59`

The entitled Tortila path renders:
- A fully-interactive config form (`<form class="wtc-grid wtc-grid-3">`) with six fields
  (Symbols, Timeframe, System, Risk, Start, End) that accept user input but do nothing.
- A disabled `<button>Queue run (local runner required)</button>` that implies job queuing
  exists and is merely blocked by a missing runner.
- A disabled `<button>Download local runner (soon)</button>` with `title="Local runner
  packaging is planned"` — the word "planned" in a title attribute is an implicit roadmap promise.

**The problem (option b):** Under the operator decision, option (b) is a permanently honest
"not available yet" card. There is no job-queuing infrastructure (no `backtest_jobs` table, no
API routes, no HMAC upload tokens). Showing a functional-looking config form with inputs the user
can fill creates a false affordance. The disabled "Queue run" button implies the machinery exists
but is blocked by a missing runner, which is not the truth — the machinery does not exist at all.
The "Queue run (local runner required)" label frames the runner as the only missing piece.

The `(soon)` label on the download button was already prohibited by the §16.1 / §17 decision
("must NOT say coming soon, state the product boundary").

**Required replacement for entitled Tortila path:** Remove the config form and both buttons.
Replace with an honest product-boundary EmptyState card stating:

> The local backtester runner is not yet distributed. When it is available, entitled Tortila Bot
> users will be able to download it, run it locally, and upload results here. The platform never
> fabricates returns — this area will remain empty until a real artifact exists.

No CTA, no form, no disabled buttons that imply a queue. One EmptyState component and honest copy
is the complete UI for this state. No chart shapes, no placeholder metrics.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` lines 43–66.

---

### F-03 — HIGH: packages/backtester is completely orphaned (0% coverage; not imported anywhere)

**Severity:** high
**Evidence:** coverage HTML `0/69 statements, 0/1 functions`; grep confirms no `from
'@wtc/backtester'` in `apps/web/src/**`.

The package is listed in `apps/web/package.json` as a dependency and in `next.config.ts`
`transpilePackages`, but no file in the web app imports it. Vitest's
`include: ['packages/**/*.test.ts']` would pick up tests if they existed, but no test file exists
under `packages/backtester/`. This means:

1. `packages/backtester/src/index.ts` is never typechecked as part of the web build (the web
   typecheck compiles the web app; the package is dead import-wise).
2. `packages/backtester` has no `tsconfig.json`, so `tsc --noEmit` run at the workspace root via
   the web app references does NOT include it as a project reference (unlike packages that have
   explicit `tsconfig.json` files).
3. The 1 function in the package (`BacktestService.createJob`) has 0% coverage and will never
   accumulate coverage under the current config.

**Required fix:** Under option (b), the existing `BacktestService` class and in-memory
`createMemoryBacktestStore()` represent option-a infrastructure that does not exist yet. Two
clean choices:

- **Preferred for option (b):** Trim `index.ts` to pure type exports + a new pure
  `deriveBacktesterView()` deriver (see F-04). Remove `BacktestService`, `createMemoryBacktestStore`,
  and all in-memory runtime state. Add a `packages/backtester/src/index.test.ts` that covers
  `deriveBacktesterView` with real Vitest tests (mirroring `@wtc/cabinet`). Add a `tsconfig.json`
  to the package so it is part of the workspace typecheck graph.

- **Minimum (if trimming is deferred):** Add `packages/backtester/tsconfig.json`, run `tsc
  --noEmit` across it explicitly, and add at least a smoke test file so coverage is not 0/0.
  The `BacktestService` class can stay for documentation value only if it is clearly marked
  `// TARGET — not implemented; option-a infrastructure` and has zero runtime dependants.

Either way, the coverage report showing 0% on a production-wired package in `transpilePackages`
is a correctness gap: the package is wired but untested.

---

### F-04 — HIGH: Decision logic (legacy vs tortila-not-entitled vs tortila-entitled-locked) is inline React, violating AGENTS.md §9

**Severity:** high
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:17–66`

All branching logic lives in the page component. AGENTS.md non-negotiable: "No one-file prototype;
use `apps/*` + `packages/*` boundaries; business logic in packages, not React files." The
backtester page currently has three branches with distinct copy and UI content:

1. `bot === 'legacy'` — locked card (product boundary).
2. Tortila, `!access.allowed` — access-denied banner.
3. Tortila, `access.allowed` — main state (currently showing the dead form).

Under option (b), this branching becomes more important, not less, because the copy differences
between Legacy (permanent product fact: no backtester exists for this bot) and Tortila (temporary
distribution fact: runner not yet distributed) must be stated differently and must never be
conflated. The current Legacy card says "Coming soon" (wrong), the Tortila card implies a working
queue (wrong).

**Recommended solution (mirrors @wtc/cabinet precedent):**

Create `packages/backtester/src/derive.ts` with a pure, zero-runtime-dependency function:

```typescript
export type BacktesterBoundary =
  | { kind: 'legacy_no_backtester'; title: string; body: string }
  | { kind: 'access_denied'; title: string; reason: string }
  | { kind: 'runner_not_distributed'; title: string; body: string };

export function deriveBacktesterView(
  botSlug: 'tortila' | 'legacy',
  access: { allowed: boolean; reason: string },
): BacktesterBoundary
```

This function carries all three branches, produces a view-model with exact copy, and is unit-
testable with Vitest before any workspace wiring. The `page.tsx` becomes a thin shell that calls
`deriveBacktesterView(bot, access)` server-side and renders the view-model — no branching logic in
JSX.

The no-fake-results invariant is a required assertion in the unit tests:
- `kind === 'runner_not_distributed'` must NEVER include any copy implying results exist or
  metrics are shown.
- The `body` text for `kind === 'legacy_no_backtester'` must NOT contain "coming soon" or "future
  release" or "planned" (assert via `expect(view.body).not.toMatch(/coming soon|planned|future/i)`).
- `kind === 'access_denied'` must not expose any product detail (test that it doesn't reference
  config form fields).

Export from `packages/backtester/src/index.ts` and cover with real Vitest tests in
`packages/backtester/src/index.test.ts` (minimum: 6 tests; mirror the cabinet's 26-test pattern).

---

### F-05 — HIGH: BacktestParams.system typed as `string` conflicts with the locked spec

**Severity:** high
**Evidence:** `packages/backtester/src/index.ts:12` — `system: string; // e.g. 'turtle'`

The full design (`BACKTESTER_DISTRIBUTION_PLAN.md §5.1`, `CONTRACTS/backtester-runner.md §5.2`)
specifies `system: 1 | 2` (an integer, matching the Python engine's `BacktestConfig.system`). The
in-memory stub type contradicts the Zod schema spec. The Phase 2 handoff
(`20260530-0126-ecosystem-backtester-architect.md`, Finding 1) noted this as an observation but
deferred it; under option (b) the stub types will never be promoted to production Zod schemas, but
the drift is still a correctness risk — if someone reads the type as authoritative, they will build
the wrong form field.

**Required fix (option b):** Under option (b), the `BacktestParams` interface and the full
option-a `BacktestJob` / `BacktestResultArtifact` / `BacktestStore` / `BacktestService` types are
pre-implementation infrastructure that does not exist yet. The correct move is either:
- Remove them from the package (keep only the pure view-model deriver per F-04), with a comment
  pointing to `BACKTESTER_DISTRIBUTION_PLAN.md §9` for the eventual full schema.
- Or retain them as a clearly-labelled `// TARGET — option-a types; not wired` block and fix
  `system: string` to `system: 1 | 2` to match the spec.

Either way, `system: string` must not remain in the codebase while `§5.2` says `system: 1 | 2`.

---

### F-06 — HIGH: BacktestStatus missing 'cancelled' state; mismatches the spec state machine

**Severity:** high
**Evidence:** `packages/backtester/src/index.ts:7`

```typescript
export type BacktestStatus = 'queued' | 'running' | 'done' | 'failed';
```

`BACKTESTER_DISTRIBUTION_PLAN.md §4.2` includes `cancelled` as a valid state ("User cancelled
before upload"). The DB DDL in `§8` also includes `'cancelled'` in the CHECK constraint. The
omission means any future code that exhaustively-switches on `BacktestStatus` will miss the
`cancelled` arm silently.

**Required fix:** Add `'cancelled'` to the type union if the option-a types are retained. If
they are removed (per F-04 recommendation), this resolves automatically.

---

### F-07 — MEDIUM: ROADMAP_MASTER §10 still says "decision required — NEXT"

**Severity:** medium
**Evidence:** `docs/ROADMAP_MASTER.md:106`

```
| **Operator decision:** real local-runner ZIP OR explicit locked card (no half-state) | NEXT | PG10; **decision required** before build |
```

The operator decision has been made (option b, locked card). This row must be updated to reflect
`DONE` with a note: "operator decision: option (b) — permanent honest locked card; option (a)
infrastructure deferred to a future multi-session epic". The plan reference to "decision required"
becomes stale and could confuse future agents reading this as the current state.

**Required fix:** Operator updates `docs/ROADMAP_MASTER.md §10` to record the decision with the
option-b status.

---

### F-08 — MEDIUM: PRODUCTION_BLOCKERS.md operator checklist still lists PG10 as undecided

**Severity:** medium
**Evidence:** `docs/PRODUCTION_BLOCKERS.md:113`

```
- [ ] **PG10** Decide backtester model: real local-runner vs permanent locked card.
```

This checkbox is now decided. It must be marked done with the decision recorded inline:
"DONE — option (b): permanent honest locked card; no tables, no API routes, no runner ZIP this
epic."

---

### F-09 — MEDIUM: No ADR records the option (b) decision

**Severity:** medium
**Evidence:** `docs/ARCHITECTURE_DECISIONS.md` — ADRs run through ADR-019 (PG9/cabinet); no
ADR-020 or subsequent ADR covers the backtester model decision.

The PG10 operator decision (option b: locked card, not runner infrastructure) is a non-trivial
scope reduction. It gates future work (any implementer who reads the codebase must understand why
the infrastructure is absent, and that it was a deliberate choice, not an oversight). Without an
ADR, the decision lives only in the PRODUCTION_BLOCKERS.md checklist row and in this handoff.

**Required fix:** Add ADR-020 to `docs/ARCHITECTURE_DECISIONS.md` stating:
- Context: the full option-a design is specified but requires tables, 9 API routes, HMAC tokens,
  artifact storage, and a vendored Python runner ZIP — a multi-session epic.
- Decision: PG10 ships option (b): a permanently honest "not available yet" locked card. No
  migration. No tables. No API routes. No runner ZIP. The design docs remain as the blueprint for
  a future epic, clearly labelled TARGET.
- Consequences: `packages/backtester` trims to a pure view-model deriver; `page.tsx` becomes a
  thin shell calling that deriver; all "coming soon" copy removed; `BOT_CAPS.hasBacktester`
  continues as the source of truth for per-bot capability.
- No-fake-results invariant: the platform never shows backtest metrics or equity curves without a
  real uploaded artifact. This invariant is active regardless of when option (a) ships.

---

### F-10 — LOW: page.tsx imports @wtc/backtester nowhere; the package is in dependencies but unused

**Severity:** low
**Evidence:** grep of `apps/web/src/**` for `from '@wtc/backtester'` — no matches.
`apps/web/package.json:30` — `"@wtc/backtester": "*"`.

Under option (b), the page does not need to import the package at all (no job types, no service).
The dependency should either be used (by importing `deriveBacktesterView` from the trimmed
package) or removed from `apps/web/package.json` and `next.config.ts transpilePackages` to
eliminate a dead dependency that adds confusion. If F-04 is resolved by adding a pure deriver to
the package, then the page imports it and the dependency is justified. If the package is gutted to
nothing useful, the dependency should be removed.

---

### F-11 — LOW: The page.tsx inline comment cites docs/MVP_SCOPE.md as the source for the Legacy lock

**Severity:** low
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:16–17`

```typescript
// MVP scope: Legacy Bot backtester is LOCKED (see docs/MVP_SCOPE.md). Show a locked card
// regardless of entitlement — no config form for legacy.
```

The real source is a product decision, not an MVP scope file. The governing reference is
`BACKTESTER_DISTRIBUTION_PLAN.md §1` + `§17.2`, which state plainly that Legacy Bot has no
backtester — a permanent product boundary, not an MVP cut. The comment framing it as "MVP scope"
implies it might be added later, contradicting the plan's language ("permanent product fact").

**Required fix:** Update the comment to cite the correct authority:
"Legacy Bot does not have a backtester — a permanent product boundary (BACKTESTER_DISTRIBUTION_PLAN.md §1, §17.2). No config form, no job creation."

---

## Decisions

1. **migrationNeeded: false.** Confirmed. The plan has always been that no backtest tables land
   until option-a is implemented. Under option (b) there is nothing that would require a migration.
   `db:generate` should continue to report no schema changes and 41 tables unchanged. This is the
   same conclusion as the PG9 audit.

2. **deriveBacktesterView() belongs in packages/backtester as a pure function.** The branching
   logic (legacy vs tortila-not-entitled vs tortila-entitled-locked) has real branching and
   copy differences. AGENTS.md mandates logic in packages. The @wtc/cabinet precedent (a pure
   deriver, zero runtime deps, real Vitest coverage, page is a thin shell) is the correct pattern
   to follow. The function signature is `deriveBacktesterView(botSlug, access) -> BacktesterBoundary`.

3. **Legacy card wording: state a permanent product fact.** "Legacy Bot does not have a
   backtester." No "coming soon". No "future release". No redirect to a roadmap. A link to
   `/app/bots/tortila/backtester` is acceptable ("Tortila Bot includes a backtester — visit Bots
   → Tortila → Backtester.").

4. **Tortila card wording (entitled, runner not distributed): state a distribution fact.**
   "The local runner is not yet distributed." Not "coming soon". Not "planned". The platform
   acknowledges the runner will exist at some point (it is designed) but does not make a timeline
   promise. The exact copy: "The local backtester runner is not yet distributed. When available,
   download and run it locally — the platform never generates returns; results appear only when
   a real artifact is uploaded."

5. **option-a types in index.ts: retain with TARGET labels or remove.** Either is acceptable
   for option (b). If retained, fix `system: string → system: 1 | 2`, add `'cancelled'` to
   `BacktestStatus`, and mark the block `// TARGET — option-a types; not wired until option-a
   is implemented`. If removed, the design docs (`BACKTESTER_DISTRIBUTION_PLAN.md §9`) are
   the sole source of truth for the eventual type shapes.

6. **No-fake-results invariant: must be asserted in tests.** The Vitest unit tests for
   `deriveBacktesterView` must assert that the function never returns a view-model that implies
   results exist, metrics are shown, or a form can be submitted. These are the key assertions:
   - `deriveBacktesterView('legacy', any)` always returns `kind: 'legacy_no_backtester'`.
   - `deriveBacktesterView('tortila', { allowed: false, ... })` always returns `kind: 'access_denied'`.
   - `deriveBacktesterView('tortila', { allowed: true, ... })` always returns `kind: 'runner_not_distributed'`.
   - The `body` text for any kind never contains chart/metric/return references.
   - None of the three view-model kinds contains a field for equity curve data or trade results
     (because no such data can exist under option b).

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Future implementer reads the half-state page and the "coming soon" copy as evidence the queue is partially built | HIGH | Remove all half-state. ADR-020 documents the option-b decision as deliberate. |
| `BacktestService` in index.ts is read as an indication that in-memory job management is the implementation pattern | MEDIUM | Label clearly as TARGET / remove for option b. |
| `system: string` in index.ts causes a future implementer to build a string-based system param, silently breaking the Python engine contract | MEDIUM | Fix the type or remove the interface. |
| Option-a infrastructure (tables, routes) is accidentally started by a future agent who did not see the decision in docs | MEDIUM | ADR-020 + updated ROADMAP §10 + updated PRODUCTION_BLOCKERS checklist are the three guard rails. |
| Coverage reporting 0% on a wired dependency causes false confidence in coverage metrics | LOW | Add tsconfig.json + test file to the package. |
| "not yet distributed" copy is read by the user as a promise that the runner is imminent | LOW | Avoid any timeline language. "Not yet distributed" + "no synthetic returns" is sufficient. |

---

## Verification/tests

Gates NOT RUN this session (read-only audit; no code changes):
- `npm run typecheck` (web app) — NOT RUN.
- `npm test` (Vitest) — NOT RUN.
- `npm run build` — NOT RUN.
- `db:generate` (schema change check) — NOT RUN; expected: "No schema changes" (41 tables).

Gates that must be RUN when the implementer makes the changes:
- `npm test` — `packages/backtester/src/index.test.ts` must pass all `deriveBacktesterView`
  tests including the no-fake-results assertions listed in Decisions §6.
- `npm run typecheck -w @wtc/web` — must pass with the trimmed page.tsx.
- `db:generate` — must still report 41 tables, no schema changes.
- E2E: at minimum, a Playwright spec asserting that:
  - `/app/bots/legacy/backtester` renders the permanent product-boundary card with no form,
    no button, and no "coming soon" text.
  - `/app/bots/tortila/backtester` (unauthenticated / no entitlement) renders the access-denied
    banner and no config form.
  - `/app/bots/tortila/backtester` (entitled) renders the "runner not distributed" card and no
    config form, no interactive inputs, no disabled queue button.

Required test assertions (no-fake-results invariants):
1. `deriveBacktesterView('legacy', ...)` never returns a kind other than `'legacy_no_backtester'`.
2. `deriveBacktesterView('tortila', { allowed: true, reason: 'allowed' })` returns
   `kind: 'runner_not_distributed'` and body text does NOT contain `equity|return|profit|metric|chart|curve`.
3. `deriveBacktesterView('tortila', { allowed: false, ... })` returns `kind: 'access_denied'`
   and does NOT mention config form fields or job parameters.
4. No variant of `deriveBacktesterView` ever returns a view-model with a `jobs`, `results`,
   `artifact`, or `equityCurve` field.
5. The Legacy body text does NOT match `/coming soon|planned|future release/i`.
6. The Tortila locked body text does NOT match `/coming soon|queue|run a backtest now/i`.

---

## Next actions

| Priority | Action | Owner | Evidence file |
|----------|--------|-------|---------------|
| P0 | Replace `page.tsx` Legacy branch (lines 19–29): remove "Coming soon" card, replace with product-boundary card per §17.2 | frontend-implementer | `page.tsx:22` |
| P0 | Replace `page.tsx` Tortila entitled branch (lines 43–66): remove dead config form and both disabled buttons, replace with EmptyState using honest "runner not distributed" copy | frontend-implementer | `page.tsx:47–59` |
| P0 | Fix inline comment at page.tsx:16 to cite `BACKTESTER_DISTRIBUTION_PLAN.md §1, §17.2` as authority | frontend-implementer | `page.tsx:16` |
| P0 | Add `packages/backtester/src/derive.ts` with pure `deriveBacktesterView` function covering all three branches; add `packages/backtester/tsconfig.json` | backtester-architect / backend-implementer | F-04 |
| P0 | Add `packages/backtester/src/index.test.ts` with ≥6 Vitest tests covering the three view-model kinds + the 6 no-fake-results invariants | ecosystem-tests-runner | F-03, F-04, Decisions §6 |
| P1 | Fix `BacktestStatus` to add `'cancelled'` (or remove option-a types) | backtester-architect | `index.ts:7` |
| P1 | Fix `BacktestParams.system: string` to `system: 1 \| 2` (or remove option-a types) | backtester-architect | `index.ts:12` |
| P1 | Add `packages/backtester/tsconfig.json` so it is part of the workspace typecheck graph | backtester-architect | F-03 |
| P1 | Update `docs/ROADMAP_MASTER.md §10` backtester row: status `DONE`, note the option-b decision | operator | F-07 |
| P1 | Update `docs/PRODUCTION_BLOCKERS.md` operator checklist PG10 checkbox: mark done with decision note | operator | F-08 |
| P1 | Add ADR-020 to `docs/ARCHITECTURE_DECISIONS.md` recording option-b as the deliberate decision | ecosystem-platform-architect | F-09 |
| P2 | Update `BACKTESTER_DISTRIBUTION_PLAN.md` status line to reflect option-b is now in force for PG10; option-a is a future epic | backtester-architect | F-07 |
| P2 | Update `CONTRACTS/backtester-runner.md` status line to reflect current session decision | backtester-architect | F-07 |
| P2 | Decide whether to keep or remove `@wtc/backtester` from `apps/web/package.json` / `next.config.ts transpilePackages` depending on F-04 resolution | frontend-implementer | F-10 |
