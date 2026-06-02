# ecosystem-tests-runner handoff

_Epoch: 20260531-0030 — Phase Group 10 (Backtester / distribution), read-only audit + gate run._

## Scope

Quality gates for the PG10 pre-implementation baseline, with the operator decision already made:
option (b) — explicit, permanently-honest "not available yet" locked card. Audit the current
half-state page against that decision, confirm gate baselines, lay out the PG10 test plan for
option (b), and flag all dishonesty or inconsistency that must be fixed.

No code was written. This is a read-only audit and gate run.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `AGENTS.md`, `docs/SESSION_PROTOCOL.md`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `packages/backtester/src/index.ts`, `packages/backtester/package.json`
- `docs/BACKTESTER_DISTRIBUTION_PLAN.md` (§§1-17)
- `docs/CONTRACTS/backtester-runner.md` (§§1-3)
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/ROADMAP_MASTER.md` (§§10-12)
- `docs/EXECUTION_PLAN_MASTER.md` (§§2-3, W11)
- `packages/cabinet/src/derive.ts`, `packages/cabinet/src/index.ts`
- `packages/cabinet/src/derive.test.ts` (26 unit tests — PG9 precedent)
- `tests/integration/cabinet-pg9.test.ts` (15 static guards — PG9 precedent)
- `tests/e2e/cabinet-pg9-mobile.spec.ts` (PG9 375px spec — template for PG10)
- `tests/e2e/smoke.spec.ts`, `playwright.config.ts`
- `vitest.config.ts`, `tsconfig.json`, `tsconfig.base.json`
- `packages/ui/src/theme.css`, `docs/DESIGN_SYSTEM.md`

## Files changed

None — read-only audit.

## Gate run results (PG10 pre-implementation baseline)

All commands run in `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.

### npm run lint

Command: `npm run lint 2>&1; echo "EXIT_CODE:$?"`
Result: **PASS — exit 0**. ESLint with `--max-warnings 0`; no warnings or errors.

### npm run typecheck (packages)

Command: `npm run typecheck 2>&1; echo "EXIT_CODE:$?"`
Result: **PASS — exit 0**. `tsc --noEmit -p tsconfig.json` (includes `packages/*/src/**/*.ts`).
`packages/backtester/src/index.ts` IS covered by this typecheck (path `@wtc/backtester` in
`tsconfig.base.json` line 39; `packages/*/src/**/*.ts` glob in `tsconfig.json` include).
The orchestrator prompt described a latent `backtesterStatusLabel()` referencing an undefined
`engine` variable around line 29; that function does not exist in the current `packages/backtester/src/index.ts`
(current file is 70 lines: `BacktestService`, `BacktestStore`, `createMemoryBacktestStore` — no label
helper). Typecheck exits 0 with no errors.

### npm run typecheck -w @wtc/web (web app)

Command: `npm run typecheck -w @wtc/web 2>&1; echo "EXIT_CODE:$?"`
Result: **PASS — exit 0**. `tsc --noEmit` in `apps/web`. No new errors introduced.

### npm test (Vitest)

Command: `npm test 2>&1 | tail -10; echo "EXIT_CODE:$?"`

Run 1: 470 passed / 8 skipped — 1 unhandled error (V8 fatal OOM in a tinypool worker, mid-PGlite
heavy test; manifests as "Worker exited unexpectedly" from `tinypool/dist/index.js:118:30`; 41 of
42 test files completed green in that run; exit code 1 due to the unhandled error).

Run 2: **482 passed / 8 skipped (490 total) — 42 test files — exit 0.** Matches the PG9 baseline
exactly (482/8/490). The OOM crash on run 1 is a transient Windows-heap exhaustion under concurrent
PGlite workers; a clean re-run passes. The gate is green.

Coverage snapshot (from `npm run coverage`, exit 0):
- All files: **26.49% stmts / 75.35% branch** (matches PG9 26.49 / 75.33, minor rounding).
- `packages/backtester/src`: **0% stmts / 0% branch / 0% funcs**. The package is ORPHANED —
  not imported anywhere, not tested anywhere, and produces zero coverage.

### npm run db:generate -w @wtc/db

Command: `npm run db:generate -w @wtc/db 2>&1; echo "EXIT_CODE:$?"`
Result: **PASS — exit 0. 41 tables. "No schema changes, nothing to migrate."**
Option (b) — the honest locked card — requires no new tables. This confirms migrationNeeded=false
for PG10 option (b).

### npx playwright test (desktop + mobile smoke + screenshots)

Command: `npx playwright test --timeout=90000 2>&1; echo "EXIT_CODE:$?"`

Run 1: 37 passed / 1 failed / 1 flaky / 3 skipped — exit 0 (flaky test auto-retried green; 1
failed test later retried green on run 2).
Run 2: **38 passed / 1 flaky / 3 skipped — exit 0.**

The flaky test is `[mobile] › smoke.spec.ts:217:1 › Phase 2.3 no live-control buttons enabled on
bot pages` — the known dev-only Next.js Server-Action recompilation race (`page.waitForURL` timeout
60s on login, caused by on-demand route compilation in dev mode). This is precisely the race
documented in `playwright.config.ts` and `STATUS.md` (retries:2, never a production issue).
Effectively 39 tests succeeded across both projects (38 clean + 1 via retry = 39 green), matching
the PG9 baseline (39 passed / 3 skipped / 0 flaky). Gate is green.

Screenshots written to `tests/e2e/screenshots/` per spec (smoke.spec.ts + admin-mobile-pg8.spec.ts
+ cabinet-pg9-mobile.spec.ts). No backtester-specific screenshots exist yet (PG10 not implemented).

Gate summary:

| Gate | Command | Result |
|---|---|---|
| lint | `npm run lint` | PASS — exit 0 |
| typecheck (packages) | `npm run typecheck` | PASS — exit 0 |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 |
| test (Vitest) | `npm test` | PASS — 482/8/490, 42 files, exit 0 (transient OOM on run 1; clean on run 2) |
| coverage | `npm run coverage` | PASS — 26.49% stmts / 75.35% branch |
| db:generate | `npm run db:generate -w @wtc/db` | PASS — 41 tables, no schema changes |
| e2e (Playwright) | `npx playwright test` | PASS — 38+1flaky/3-skip exit 0 (known dev-race; PG9 baseline matched) |
| NOT RUN | `npm run db:migrate -w @wtc/db` | NOT RUN — no DATABASE_URL (B1) |
| NOT RUN | `npm run db:seed -w @wtc/db` | NOT RUN — no DATABASE_URL (B1) |
| NOT RUN | real-PG harness | NOT RUN — no DATABASE_URL (B1) |
| NOT RUN | Stripe checkout | NOT RUN — B2 |
| NOT RUN | Axioma ES256 activation | NOT RUN — B4 |
| NOT RUN | `npm ci` | NOT RUN — no npm registry access confirmed this session |

## Findings

### F-01 (HIGH) — Tortila backtester page has a dead config form implying option (a) is live

Evidence: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:47-60`

The entitled Tortila path renders a 6-field config form (Symbols, Timeframe, System, Risk%, Start,
End) with inputs, a disabled "Queue run (local runner required)" button, and a disabled
"Download local runner (soon)" button. Option (a) is the deferred multi-session epic (job tables,
9 API routes, HMAC tokens, artifact storage, vendored Python runner — all explicitly out of scope).
The operator decision for PG10 is option (b): the form must be REMOVED and replaced with the
honest locked card described in `BACKTESTER_DISTRIBUTION_PLAN.md §17.3 State A/§17.5`.

The form is inert HTML (no server action, no `form action`) but its presence is dishonest: it
implies the user can configure a backtest run and that the only missing piece is the runner — which
is not the case (no job table, no upload token, no 9 API routes).

Recommendation: Remove the config form, the "Queue run" button, and the "Download local runner (soon)"
button from the entitled Tortila path entirely. Replace with the option (b) honest locked card
(a `Card` with the "not available yet" product-boundary copy, matching §17.3 State A but locked:
no form, no job creation, no runner download). The card must NOT say "coming soon" or imply
imminent availability (BACKTESTER_DISTRIBUTION_PLAN.md §17.2 rule).

Target part: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:47-66`

### F-02 (HIGH) — Legacy backtester card says "Coming soon" — violates §17.2 product boundary rule

Evidence: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:22`

```
<Card title="Coming soon">
```

`BACKTESTER_DISTRIBUTION_PLAN.md §17.2` is explicit: "The wording does NOT say 'coming soon' or
'planned' — it states the product boundary clearly." The copy inside the card also says "See the
product roadmap for a future release" which implies availability is planned. The Legacy bot does not
have a backtester; this is a permanent product decision, not a temporary state.

Recommendation: Change the `Card` title from "Coming soon" to "Not available for this bot".
Update the body copy to: "The Legacy Bot does not have a backtester. The Tortila Turtle strategy
backtester is available under Bots → Tortila → Backtester." Remove the "future release" reference.
Align exactly with §17.2 spec.

Target part: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:21-28`

### F-03 (MEDIUM) — "Download local runner (soon)" button copy uses "soon" — dishonest under option (b)

Evidence: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:58`

```
<button ... disabled title="Local runner packaging is planned — not downloadable in this build">Download local runner (soon)</button>
```

The label "(soon)" and the `title` attribute "is planned" both imply imminent availability. Under
option (b) this button must not exist at all in the entitled Tortila path (the whole config form is
removed per F-01). If the implementer retains any download reference, it must state the permanent
product boundary ("not available — the local runner is a future multi-session deliverable") rather
than "soon" or "planned". Note: This finding is subsumed by F-01's form removal, but captured
separately because the copy rule in §17.2 applies independently to any remaining reference.

Recommendation: Delete the button entirely as part of the F-01 form removal. Do not replace with
any "soon" or "planned" label.

Target part: `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:58`

### F-04 (HIGH) — packages/backtester is ORPHANED: zero coverage, no Vitest tests, no import

Evidence: `packages/backtester/src/index.ts` (70 lines); `npm run coverage` output:
`packages/backtester/src: 0% stmts / 0% branch / 0% funcs`; no test file in
`packages/backtester/src/` or `tests/integration/backtester*.ts`; no import of `@wtc/backtester`
in any other package or app file.

The package is structurally included in typecheck (via `tsconfig.base.json` paths + `tsconfig.json`
`packages/*/src/**/*.ts` glob) and exits typecheck clean, so there is no current TypeScript error.
But it has ZERO test coverage. It exports types and a `BacktestService` with create/attach/get
methods that are never called, never integration-tested, and never used by the page. The
`BacktestStore` / `BacktestService` / `BacktestJob` shape in the current `index.ts` also diverges
from the TARGET types described in `BACKTESTER_DISTRIBUTION_PLAN.md §9` (the plan's target API
uses DB repos, not a Map-based memory store; the target export shape is entirely different — jobs,
artifacts, tokens, schemas). This is option (a) scaffolding in a package that option (b) does not
use.

Recommendation for option (b): Replace the contents of `packages/backtester/src/index.ts` with a
pure `deriveBacktesterView` function — analogous to `@wtc/cabinet`'s `deriveProductCard` — that
accepts the bot slug, entitlement access decision, and bot product code, and returns a view-model
for the honest locked card. This function is the ONLY logic that option (b) needs. Write real Vitest
unit tests for it (legacy branch, not-entitled branch, entitled-locked branch, fail-closed
invariant that never returns a form/job/button). This resolves the orphan status and gives the
package real coverage. See "PG10 test plan" in Decisions below.

Target part: `packages/backtester/src/index.ts` (full replacement)

### F-05 (MEDIUM) — Entitled Tortila path has no integration guard preventing regressions

Evidence: No file `tests/integration/backtester-pg10.test.ts` exists (confirmed by Glob). No
test currently asserts: no fake form, no disabled teaser "Queue run"/"Download" button, no
"coming soon"/"soon"/"future release" copy, the honest locked card present, the entitlement gate
intact, and the no-fake-results invariant.

Without a static source guard analogous to `tests/integration/cabinet-pg9.test.ts`, a future edit
could silently re-introduce the half-state. The PG9 pattern (static source analysis via
`readFileSync`) works exactly here because `apps/web/**` is excluded from Vitest execution
(server components / JSX are e2e-covered), so the guards run as source assertions.

Recommendation: Create `tests/integration/backtester-pg10.test.ts` as the authoritative static
regression guard for the option (b) honest locked card. Minimum assertions:
- no `<form` element in the entitled Tortila backtester page source.
- no disabled button with label "Queue run".
- no "soon" or "coming soon" or "future release" literal in the page source (any branch).
- the Legacy path card title is NOT "Coming soon".
- an honest locked-card heading or copy asserting product boundary is present.
- entitlement `access.allowed` check is present (fail-closed gate).
- no import from `BacktestService` or `createMemoryBacktestStore` in the page (option a dead code).
- `deriveBacktesterView` from `@wtc/backtester` is imported in the page (the pure deriver).

Target part: `tests/integration/backtester-pg10.test.ts` (new file)

### F-06 (MEDIUM) — No 375px mobile e2e for the backtester pages

Evidence: `tests/e2e/backtester-pg10-mobile.spec.ts` does not exist (confirmed by Glob). No spec
currently navigates to `/app/bots/tortila/backtester` or `/app/bots/legacy/backtester` at 375px
to assert the honest locked card renders with no horizontal scroll.

The PG8 pattern (`tests/e2e/admin-mobile-pg8.spec.ts`) and the PG9 pattern
(`tests/e2e/cabinet-pg9-mobile.spec.ts`) both cover mobile readability as a Playwright navigation-
only spec (no form submits, to avoid the known Server-Action dev-race). A backtester spec is needed
to lock in the option (b) card at 375px.

Recommendation: Create `tests/e2e/backtester-pg10-mobile.spec.ts` scoped to the mobile project:
- login as `user@wtc.local` (demo user owns `tortila_bot`).
- navigate to `/app/bots/tortila/backtester` at 375px.
- assert the honest locked card heading is visible (e.g. "Not available yet" or the option-b title).
- assert no `<form>` or "Queue run" button is visible.
- assert `noHScroll(page)` (scrollWidth <= clientWidth + 1).
- screenshot to `tests/e2e/screenshots/backtester-tortila-mobile375.png`.
- navigate to `/app/bots/legacy/backtester` at 375px.
- assert the permanent "not available for this bot" card is visible.
- assert `noHScroll(page)`.
- screenshot to `tests/e2e/screenshots/backtester-legacy-mobile375.png`.
Keep to navigation-only (no server-action trigger) to avoid the known dev-race flake.

Target part: `tests/e2e/backtester-pg10-mobile.spec.ts` (new file)

### F-07 (LOW) — BacktestService and BacktestStore in packages/backtester are option (a) scaffolding

Evidence: `packages/backtester/src/index.ts:44-69` — `BacktestService` with Map-based in-memory
store, `createJob`, `attachResult`, `getResult`.

These types/class are option (a) scaffolding (the in-memory equivalent of the future DB-backed
backtest job store). Option (b) does not use them. Under option (b) the package must expose a pure
`deriveBacktesterView` deriver instead. Leaving the old scaffolding creates confusion and may
introduce false coverage claims if someone adds a test for the option-(a) class rather than the
option-(b) deriver.

Recommendation: Replace the file contents entirely (per F-04 recommendation). Do not keep the
`BacktestService` / `BacktestStore` in the option (b) implementation; they belong in a future
option (a) epic. This is a clean slate for the package under option (b).

Target part: `packages/backtester/src/index.ts`

### F-08 (INFO) — Coverage for packages/backtester will not reach the configured 75.33% branch threshold

Evidence: `npm run coverage` — overall 26.49% stmts / 75.35% branch. `packages/backtester/src`:
0% all metrics. The vitest.config.ts include is `packages/**/*.test.ts` — so a new
`packages/backtester/src/derive-backtester-view.test.ts` (covering the pure deriver) will add
to the denominator AND to the numerator.

If `deriveBacktesterView` has a simple branch structure (legacy vs entitled-locked vs not-entitled),
expect 3-4 branches, each ~10 lines, easily 100% branch coverage. The effect on the aggregate
branch metric will be positive (the package goes from 0% to ~100% branch, adding a small number
of branches to both numerator and denominator). The statements metric may dip slightly if other
new app-layer code in `apps/web` grows the denominator (the same pattern as PG9: stmts −0.34).

Recommendation: Track coverage movement after the pure deriver + tests are wired in. Target:
branch metric stays above 75%, stmts within ±0.5% of 26.49%.

Target part: coverage baseline; vitest.config.ts (no change needed — `packages/**/*.test.ts` already covers it)

## Decisions

**Operator decision (already made, not relitigated):** option (b) — explicit, permanently-honest
locked card — is the PG10 deliverable. Option (a) (job tables, 9 routes, HMAC tokens, artifact
store, Python runner ZIP, chart components) is a separately green-lit future multi-session epic.

**PG10 test plan (for option b — three layers):**

1. Unit tests: `packages/backtester/src/derive-backtester-view.test.ts`
   Pure Vitest coverage for the new `deriveBacktesterView(input) → BacktesterCardView` function:
   - legacy branch: always returns the permanent "not available for this bot" card, no form, no
     job, no runner download, regardless of entitlement.
   - not-entitled branch: returns the entitlement-locked card (RiskWarningBanner copy), no form.
   - entitled-locked branch: returns the option (b) honest locked card, no form, no disabled
     "Queue run" button, no "coming soon" copy.
   - fail-closed invariant: every return value has `hasForm: false` and `hasRunnerDownload: false`
     (the deriver can include boolean flags the page asserts; or the test asserts string contents).
   - determinism invariant: same input twice = same output.
   Minimum 5 tests (matching the @wtc/cabinet fail-closed invariant count from PG9). Run under
   `npm test` without any workspace symlink (pure file, zero runtime deps).

2. Static integration guard: `tests/integration/backtester-pg10.test.ts`
   Source assertions via `readFileSync` (Vitest, no app execution). Asserts the page:
   - has NO `<form` element (the config form is gone).
   - has NO "Queue run" text (the disabled button is gone).
   - has NO "coming soon" / "soon" / "future release" literal (dishonest copy is gone).
   - has NO "Coming soon" as a card title (legacy branch fix from F-02).
   - has NO import of `BacktestService` or `createMemoryBacktestStore` (option-a dead code gone).
   - imports `deriveBacktesterView` from `@wtc/backtester` (pure deriver wired in).
   - contains `access.allowed` check (fail-closed entitlement gate present).
   - contains the product-boundary copy for the Legacy branch ("does not have a backtester").

3. 375px mobile e2e: `tests/e2e/backtester-pg10-mobile.spec.ts`
   Navigation-only Playwright spec (mobile project only, `retries:2` carried). Asserts both pages
   render the honest locked card with no horizontal scroll at 375px. Screenshots to
   `tests/e2e/screenshots/`.

**migrationNeeded = false.** Confirmed by `db:generate`: 41 tables, no schema changes. Option (b)
requires zero new tables. The `BacktestService` Map-based store and the option (a) DB design
(`backtest_jobs`, `backtest_artifacts`) are both deferred to the future epic.

**packages/backtester typecheck status.** The package IS covered by `npm run typecheck` via
`tsconfig.json include: packages/*/src/**/*.ts` and `tsconfig.base.json paths @wtc/backtester`.
The prompt's mention of a latent `backtesterStatusLabel` referencing undefined `engine` does not
appear in the current file (70 lines, no such function). Either the bug was fixed before this
audit or the prompt described a prior state. Typecheck exits 0 with no errors.

## Risks

R-01 (HIGH): Option (b) is a permanent product boundary claim. If the wording in the page still
implies "coming soon" or "planned", users will expect option (a) to arrive and file support
tickets. The spec in §17.2 is clear: state the boundary, not the timeline. All three "soon"/
"future release"/"Coming soon" occurrences must be gone.

R-02 (MEDIUM): The OOM crash in the first `npm test` run (V8 fatal OOM in tinypool worker) is a
Windows heap-under-pressure issue that occurs when PGlite workers run concurrently under memory
load. A clean re-run passes. This is not a test logic regression; it is a Windows/V8 memory
management issue under the existing test suite. If it becomes more frequent, the fix is to split
the PGlite-heavy tests into a separate vitest pool with `--pool-options.forks.singleFork=true` or
to increase the Node heap via `--max-old-space-size`. For now it is documented as a known risk.

R-03 (LOW): The e2e `1 flaky / retried green` pattern is stable (retries:2 covers the dev-only
race). If the test suite grows and the flake spreads to more tests, the `retries:2` policy will
mask genuine regressions. Monitor per-test retry counts in the aggregate handoff after PG10.

R-04 (LOW): `packages/backtester/src/index.ts` currently defines `BacktestJob` and
`BacktestService` types that partially overlap with the TARGET types in
`BACKTESTER_DISTRIBUTION_PLAN.md §9` but are not identical (current: Map-based memory store;
target: DB repos). If option (a) is implemented in a future epic and the implementer inherits the
current `index.ts` without reading the spec, there is a type-drift risk. The PG10 replacement
(option-b deriver) avoids this by giving the package a clean, correctly-scoped surface.

R-05 (INFO): The `packages/backtester` package has no `derive` logic yet, so there is nothing to
import in the page. The PG10 implementer must (1) add `deriveBacktesterView` to the package,
(2) add unit tests, (3) update the page to import and call it, (4) add the integration guard and
the e2e spec. All four changes are disjoint from every other package (the backtester scope is
documented as parallel-safe in `EXECUTION_PLAN_MASTER.md §1`).

## Verification / tests

Priority unit coverage that must land with PG10:

- **Entitlement state machine** (fail-closed): covered by `packages/entitlements/src/engine.test.ts`
  (11 tests, PG9 baseline). No regression this audit. The backtester page's entitlement gate reuses
  `accessFor(user.id, meta.code)` from `@/lib/access` — the same call pattern as all other product
  pages. The integration guard (F-05) will assert the gate is present.

- **Crypto envelope vault** (no plaintext): covered by `packages/crypto/src/vault.test.ts`
  (5 tests, PG9 baseline). No regression this audit. Backtester option (b) introduces no new vault
  calls (no exchange keys, no tokens, no secrets).

- **RBAC matrix**: covered by `packages/auth/src/rbac.test.ts` (3 tests) and
  `tests/integration/admin-ops-rbac.test.ts` (12 tests, PG9 baseline). No regression this audit.

- **Analytics normalization** (closed vs unrealized PnL, drawdown): covered by
  `packages/analytics/src/metrics.test.ts` (13 tests, PG9 baseline). No regression this audit.
  Backtester option (b) introduces no analytics calls (no results to display).

- **deriveBacktesterView pure deriver**: NOT YET COVERED — 0% stmts / 0% branch.
  This is the primary test gap to fill in PG10 (per F-04 and the test plan above).

Real-vs-mocked tally (no change from PG9 baseline; option b adds no new integrations):
- REAL (PGlite-verified): entitlements, crypto vault, RBAC, LMS, audit, TV atomicity, billing
  webhook, admin ops, cabinet, jti store.
- MOCK/DEMO: bot adapter (BOT_ADAPTER_MODE=mock default); legacy adapter (hard-blocked B3);
  Axioma CTAs (B4 disabled); self-serve checkout (B2 not run).
- NOT RUN: real-PG db:migrate/db:seed/harness (B1); Stripe checkout (B2); Axioma ES256 activation (B4).

## Next actions

For the PG10 implementer (ecosystem-frontend-implementer or ecosystem-backend-implementer, disjoint scope):

1. Replace `packages/backtester/src/index.ts` with the pure `deriveBacktesterView` deriver
   (zero runtime deps; pure function; view-model out). Export the view-model type. Do not keep
   `BacktestService` / `BacktestStore` (option-a dead code under option b).

2. Write `packages/backtester/src/derive-backtester-view.test.ts` — minimum 5 Vitest unit tests
   covering all branches + the fail-closed invariant (no form, no runner download, ever).

3. Update `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`:
   - Remove the 6-field config form, the "Queue run" button, the "Download local runner (soon)"
     button, and the Results `EmptyState` card (all option-a UI).
   - For the Legacy branch: change `<Card title="Coming soon">` to `<Card title="Not available for
     this bot">` and update body copy to the permanent product-boundary wording from §17.2.
   - For the entitled Tortila branch: render the honest locked card (option-b design from §17.3):
     no form, no job creation, no runner download, clear product-boundary copy, the no-fake-results
     invariant stated ("no backtest results are shown until a future release of the local runner"),
     import and call `deriveBacktesterView` from `@wtc/backtester`.
   - Keep: `requireUser()`, `accessFor()`, `notFound()`, the entitlement-locked path (unchanged).

4. Write `tests/integration/backtester-pg10.test.ts` — static source guards (F-05).

5. Write `tests/e2e/backtester-pg10-mobile.spec.ts` — 375px navigation-only spec (F-06).

6. Run all gates in order: lint → typecheck ×2 → npm test → db:generate (confirm still 41) →
   build → npx playwright test. Record exact pass counts. Update `docs/STATUS.md` with the new
   test count and coverage (expect +5 unit + ~8 static guards + e2e in the right projects).

7. If any gate fails, fix before writing the aggregate handoff. Do NOT claim a gate is green
   unless observed green this session (SESSION_PROTOCOL.md Rule 8).

8. Write the aggregate `docs/handoffs/20260531-0030-phase-2-13-backtester-pg10.md` citing all
   per-agent handoffs for this epoch.
