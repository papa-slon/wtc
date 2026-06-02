# ecosystem-security-auditor handoff

**Epoch:** 20260531-0030
**Agent:** ecosystem-security-auditor
**Phase:** PG10 — Backtester / distribution (option b: permanent locked card)
**Session type:** Read-only audit (pre-implementation, agents-before-edits)

---

## Scope

Security and fail-closed audit for PG10: the operator has decided the backtester ships as option (b),
an explicit permanently-honest "not available yet" locked card, with all of option (a) (tables, API
routes, HMAC upload tokens, artifact storage, runner ZIP) deferred.

Lens: entitlement gate ordering; Legacy boundary card information leakage; attack surface added or
removed; no-web-tier-compute invariant; no-fake-results invariant; no secrets; no disabled teaser
buttons or "coming soon" language; correctness of the F-03 carried finding (backtester gate ordering
from PG9); audit-log codes needed; migration check.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `packages/backtester/src/index.ts`
- `packages/backtester/package.json`
- `docs/BACKTESTER_DISTRIBUTION_PLAN.md` (all sections, including §16–§17)
- `docs/CONTRACTS/backtester-runner.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/ROADMAP_MASTER.md` §10
- `docs/EXECUTION_PLAN_MASTER.md` (W11)
- `packages/cabinet/src/derive.ts`
- `packages/cabinet/src/index.ts` (via package.json + derive.ts inspection)
- `packages/ui/src/theme.css` (referenced; not re-read in full)
- `docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md`
- `docs/handoffs/20260531-0005-ecosystem-security-auditor.md` (PG9 per-agent)
- `docs/handoffs/20260530-0126-ecosystem-backtester-architect.md`
- `apps/web/src/app/(app)/app/layout.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/components/BotSubNav.tsx`
- `apps/web/next.config.ts`
- `tsconfig.base.json`
- `apps/web/package.json`
- `packages/config/src/env.ts`
- `packages/entitlements/src/engine.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts` (confirmed: no backtest_jobs/backtest_artifacts tables)
- `tests/integration/cabinet-pg9.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/e2e/` (file listing)
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/IMPLEMENTED_FILES.md`

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — HIGH — Tortila entitlement check fires AFTER a slug-guarded static branch; carried F-03 from PG9

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:11-31`

The function signature awaits `params` (async, correct for Next.js 15), then immediately checks
`MAP[bot]` (notFound if unknown slug — this is correct: 404 for unknown bots). It then enters the
`if (bot === 'legacy')` branch at line 18 and returns the locked card WITHOUT calling `requireUser()`
or `accessFor()` first.

The `requireUser()` / `accessFor()` calls are at lines 31-32, after the legacy branch exits.

Security consequence audit:
1. **Unauthenticated access:** The `(app)/app/layout.tsx` line 15 calls `getCurrentUser()` and
   redirects to `/login` if null. This layout gate covers all routes under `/app` including
   `/app/bots/legacy/backtester`. An unauthenticated request therefore hits the layout redirect
   BEFORE the page renders. The lazy entitlement ordering on the Legacy branch is NOT an
   unauthenticated-access hole in the current architecture.
2. **Authenticated but non-entitled user:** Any authenticated user (with any entitlement state for
   `legacy_bot` — including `blocked_no_entitlement`, `expired`, `revoked`) reaches the
   `bot === 'legacy'` branch and sees the locked card. The card contains no per-user data, no
   secrets, and no fabricated results. The locked card content is: a section header and a paragraph
   stating "The Legacy Bot backtester is out of scope at MVP." No data is disclosed.
3. **Attack surface for the current page:** None. The locked card adds zero attack surface.
4. **Problem:** The pattern is inconsistent with every other bot sub-page (positions, trades, equity,
   safety, settings) which all call `requireUser()` before rendering anything product-specific, as
   documented in the PG9 security handoff (F-03). A future implementor copying this page as a
   template would import the anti-pattern. It also means a user whose `legacy_bot` entitlement is
   `revoked` sees the locked card rather than a denial banner — although in this case that is arguably
   better UX (there is truly nothing available regardless of entitlement), the inconsistency with the
   RBAC model is a design debt.

**Recommendation for PG10:** For option (b), the implementation should reorder: call `requireUser()`
at line 11 unconditionally, THEN check the slug MAP, THEN branch on `bot === 'legacy'`. The legacy
branch returns a permanently locked card regardless of entitlement state (which is correct — the
backtester is not available for `legacy_bot` regardless of ownership), but at least the auth gate is
explicit and the page is consistent with every other authenticated sub-page pattern. The `accessFor()`
call for the legacy slug can be omitted (there is nothing to gate) or retained as defence-in-depth to
surface the entitlement state in the locked card copy (e.g. showing the user's current `legacy_bot`
entitlement status). This is a PG10 implementer decision; the MUST-FIX is `requireUser()` first.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`

---

### F-02 — HIGH — "Coming soon" and disabled-teaser wording violates §17.2 of BACKTESTER_DISTRIBUTION_PLAN.md

**Evidence:**
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:23-28`: Legacy branch renders
  `<Card title="Coming soon">` with the copy "The Legacy Bot backtester is out of scope at MVP.
  Only the Tortila backtester is available. See the product roadmap for a future release."
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:57-58`: Tortila branch renders
  two disabled buttons: "Queue run (local runner required)" and "Download local runner (soon)".

These violate two explicit rules:

(a) `BACKTESTER_DISTRIBUTION_PLAN.md §17.2` states the Legacy card must NOT say "coming soon" or
    "planned" — it must state the product boundary clearly as a permanent "not available for this
    bot" statement. The current card title is "Coming soon" and the copy includes "See the product
    roadmap for a future release" which implies future availability, which is the exact half-state
    the operator decision has eliminated.

(b) The operator decision for option (b) explicitly removes the disabled config form (Symbols /
    Timeframe / System / Risk / Start / End) and the two disabled teaser buttons for the Tortila
    path. A permanently-honest locked card for Tortila shows NO form and NO disabled buttons that
    imply a run can be queued or a runner can be downloaded. The current Tortila branch still renders
    both — this is the half-state the operator is replacing.

The BACKTESTER_DISTRIBUTION_PLAN.md §17.2 canonical wording for the Legacy card:
  Title: "Not available for this bot"
  Body: "The Legacy Bot does not have a backtester. The Tortila Turtle strategy backtester is
  available under Bots → Tortila → Backtester."

For the Tortila path under option (b), the correct content per §17.3 (locked design, option b
equivalent) is a locked card with honest product-boundary copy. No form, no disabled queue button,
no "Download local runner (soon)" button.

**Security consequence:** The "Download local runner (soon)" disabled button, combined with "Queue
run (local runner required)", misleads an entitled Tortila user into believing they can queue a run
if they had the runner. This is not a security vulnerability but it is an honesty violation: the
platform's hard rule is "no disabled teaser button or 'coming soon' copy that implies imminent
availability." The current Tortila branch on the backtester page violates this rule.

**Recommendation for PG10:** Replace the Tortila branch with a permanently-honest locked card
matching the option (b) decision. No form. No disabled queue button. No download button. Wording
explains that the backtester is planned but not yet available as a self-serve feature; directs the
user to the roadmap or support.

**Target part:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`

---

### F-03 — MEDIUM — packages/backtester is orphaned: @wtc/backtester imported nowhere in apps/web; TypeScript never resolves it; the package type-checks are unverified

**Evidence:**
- Grep for `from '@wtc/backtester'` across `apps/` returns zero matches.
- `packages/backtester/src/index.ts` exports `BacktestService`, `createMemoryBacktestStore`,
  `BacktestJob`, `BacktestParams`, `BacktestResultArtifact`, `BacktestStore`, `BacktestStatus`.
- `apps/web/next.config.ts` line 21: `'@wtc/backtester'` is listed in `transpilePackages` — it is
  wired into the build pipeline even though nothing imports it.
- `tsconfig.base.json` line 39: the path alias `"@wtc/backtester"` is defined.
- `apps/web/package.json`: the `@wtc/backtester` workspace dep is declared.

Because nothing in `apps/web` imports `@wtc/backtester`, the package's TypeScript is NEVER
typechecked as part of the main typecheck pass. The `npm run typecheck -w @wtc/web` gate does not
exercise this package. Any latent type errors in `packages/backtester/src/index.ts` are invisible
to the current gate configuration.

The current `index.ts` was inspected directly and contains no `backtesterStatusLabel` function
referencing an undefined `engine` variable (the prompt notes this as a prior latent bug). The
current content replaces the prior stub with a `BacktestService` class and `createMemoryBacktestStore`
helper — neither references an undefined symbol. However, the package has no dedicated typecheck
pass and no unit tests, which means any future regression would be similarly invisible.

**Security consequence:** Not a runtime security issue for option (b) because the package is not
imported by the page. However it is a code hygiene and governance risk: the package appears in the
build config and workspace dep list, giving false confidence that it is covered by gates.

**Recommendation for PG10:** For option (b), the locked card page should NOT import anything from
`@wtc/backtester` (there is nothing to import for a locked card). However the package should be
assigned a dedicated `typecheck` task in `packages/backtester/package.json` (add a `types: tsc
--noEmit` script) so it is not silently excluded from the gate pass. Alternatively, remove
`@wtc/backtester` from `apps/web/next.config.ts` transpilePackages and the `apps/web/package.json`
dep until the package is actually imported — keeping it wired in unused creates confusion about
what is active. A static integration test asserting the package is not imported in any page file
under the backtester route (and only there) would prevent accidental partial implementation.

**Target part:** `packages/backtester/package.json`, `apps/web/next.config.ts`

---

### F-04 — MEDIUM — BotSubNav unconditionally renders a "Backtester" tab for legacy bot, linking to the locked card

**Evidence:** `apps/web/src/components/BotSubNav.tsx:10`: `{ seg: 'backtester', label: 'Backtester' }` is in the TABS array with no per-bot filtering. The `BotSubNav` is rendered on `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:55` for both `tortila` and `legacy` bots.

The `BotCapabilities` map in `apps/web/src/features/bots/meta.ts` already models this correctly:
- `tortila_bot.hasBacktester = true`
- `legacy_bot.hasBacktester = false`

The capability table in the bot overview page (line 183-190) correctly shows a "Not available" pill
for the Legacy Bot backtester using `caps.hasBacktester`. However, the `BotSubNav` component does
NOT consult `caps.hasBacktester` — it renders the Backtester tab for both bots unconditionally.

The result: a Legacy Bot user sees a "Backtester" tab in the sub-navigation. Clicking it takes them
to the locked card. The locked card content is honest and safe. But the tab's presence implies the
backtester is a navigable feature of the Legacy Bot, which contradicts the product boundary
(`legacy_bot` has no backtester — this is a permanent product decision, not a temporary placeholder).

This is an honesty finding: the sub-nav implies availability where there is none.

**Recommendation for PG10:** Pass `caps.hasBacktester` (or the bot slug) into `BotSubNav` and
conditionally exclude the Backtester tab for bots where `hasBacktester === false`. Since `BotSubNav`
is a server component that already receives `bot`, it can look up `BOT_CAPS[meta.code].hasBacktester`
and filter the TABS array before rendering. This is a small change with no security impact but is
required for honesty.

**Target part:** `apps/web/src/components/BotSubNav.tsx`

---

### F-05 — LOW — packages/backtester type surface is inconsistent with BACKTESTER_DISTRIBUTION_PLAN.md schemas

**Evidence:** `packages/backtester/src/index.ts` lines 9-16 vs `docs/BACKTESTER_DISTRIBUTION_PLAN.md §5.1 / §9`:
- Package: `BacktestParams.system: string` (accepts any string, current value `'turtle'`)
- Plan §5.1: `system: 1 | 2` (integer, Turtle system variant)
- Package: `BacktestParams.timeframe: string` (any string)
- Plan §5.2 Zod: `timeframe: z.enum(['1h', '4h'])` (constrained)
- Package `BacktestResultArtifact`: minimal shape (equityCurve only, no per-symbol or portfolio
  fields) vs the full `TortilaArtifact` schema in Plan §7.1

Also from the backtester-architect PG0 handoff (finding #1): these type inconsistencies were
previously flagged and accepted as a deferred item for Phase 6. The plan §9 exports (`createBacktestJob`,
`validateTortilaArtifact`, etc.) do not exist in the current package — they are described as the
TARGET surface, not the current surface.

**Security consequence for option (b):** None. The page does not import the package. The package is
not used. However if any future session partially scaffolds option (a) work and accidentally imports
the current package's types rather than implementing the plan-specified Zod schemas, the validation
gap would allow a malformed artifact to pass type checking at the TypeScript level while failing at
runtime. The plan §7.3 artifact validation rules are the authoritative source.

**Recommendation for PG10:** For option (b), no change to the package types is strictly required.
However the package should carry a comment or JSDoc making clear that the current types are a sketch
and that `BACKTESTER_DISTRIBUTION_PLAN.md §5 / §7 / §9` are the authoritative schemas for any real
implementation. The `BacktestService` class with its in-memory store should be marked clearly as a
development/test scaffold only, not a production service.

**Target part:** `packages/backtester/src/index.ts` (comment/annotation only)

---

### F-06 — INFO — No audit log codes are needed for option (b) locked card; positive confirmation

**Evidence:** The locked card is a read-only server-rendered page. It:
- Performs no mutations (no server actions, no API route calls from the page)
- Does not create, modify, or delete any database records
- Does not handle secrets or exchange keys
- Does not generate upload tokens, HMAC tokens, or any credentials

The `AUDIT_LOG_SCHEMA.md` required audited events include: login, key CRUD, bot config change,
product/TradingView grant/revoke, teacher material change, admin action. None of these apply to a
locked card read. No audit codes are needed for PG10 option (b).

**Recommendation:** No action needed. Documented for implementer clarity.

---

### F-07 — INFO — No migration needed; confirmed 41 tables

**Evidence:**
- `packages/db/src/schema.ts` contains no `backtest_jobs`, `backtest_artifacts`, or
  `backtest_results` tables.
- `docs/BACKTESTER_DISTRIBUTION_PLAN.md §8` marks those tables as "TARGET — NOT implemented."
- The PG9 aggregate handoff and tests-runner handoff confirm "41 tables, No schema changes."
- Option (b) (locked card) requires no DB tables. Option (a) is the deferred epic that needs them.

`migrationNeeded = false` confirmed for PG10 option (b).

**Recommendation:** Run `npm run db:generate -w @wtc/db` as part of the PG10 gates to confirm
0 schema changes, as was done for PG8 and PG9.

---

### F-08 — INFO — No new server actions, API routes, or secrets added by option (b); attack surface confirmed zero-addition

**Evidence:**
- The current `page.tsx` has no `'use server'` directive, no `export async function` actions,
  and no fetch calls to `/api/*` routes.
- `apps/web/src/app/api/` contains only `billing/webhook/route.ts` — no backtester API routes exist.
- `packages/config/src/env.ts` has no `SECRET_BACKTESTER_TOKEN_KEY` or `ARTIFACT_STORE` env var.
  These are option (a) secrets only, per `docs/CONTRACTS/backtester-runner.md §3.1`.

Option (b) removes the dead form (6 inputs), the disabled "Queue run" button, and the disabled
"Download local runner (soon)" button. Removing these elements removes no real protection (the form
was never submitted, the buttons were disabled, no server action existed). The replacement locked card
is a simpler surface with zero mutations, zero credentials, and zero API coupling.

**Recommendation:** Confirm in the PG10 implementation that no `'use server'` block is introduced
in the backtester page under option (b).

---

### F-09 — INFO — Positive: Tortila entitlement gate is correctly fail-closed for the current Tortila branch

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:31-40`:
- `requireUser()` is called before `accessFor()`.
- `accessFor()` is called with `user.id` and `meta.code` (which is `'tortila_bot'`).
- The decision is checked: `if (!access.allowed)` returns the denial banner.
- Adapter data, config, and per-user signals are only fetched AFTER the `!access.allowed` guard exits.

The fail-closed invariant is met for the Tortila path. The entitlement check uses `accessFor` from
`@/lib/access` which delegates to `explainAccess` (the authoritative engine in `@wtc/entitlements`)
and considers only `active` and valid-`grace` states as `allowed`.

For option (b) the Tortila branch will be replaced with a locked card. The same `requireUser()` +
`accessFor()` ordering MUST be preserved if the Tortila locked card is to remain inside a
post-entitlement-check branch. See F-01 for the recommended consolidation: `requireUser()` first,
unconditionally, before either the slug-guard or the bot-type branch.

---

### F-10 — INFO — Positive: no-web-tier-compute invariant is preserved and assertable

**Evidence:**
- The current `page.tsx` contains no compute calls, no Python runner invocations, no in-process
  backtest logic.
- `packages/backtester/src/index.ts` `BacktestService.createJob()` uses `globalThis.crypto.randomUUID()`
  only (UUID generation, not backtest compute). `attachResult()` stores a result in memory — it does
  not compute anything.
- The `EmptyState` hint on line 63-64 of the current page explicitly states: "Run the local runner
  and upload its artifact. The platform never fabricates an equity curve."
- The plan's §17.4 empty state rules are already in the current page copy.

For option (b) this invariant trivially holds: a locked card with no form and no job creation path
performs no compute.

**Recommendation:** Add a static integration test guard asserting the backtester page does not
import any compute-heavy package (e.g. Python runner modules) — this is already trivially true but
a static guard would prevent future regression.

---

### F-11 — INFO — Positive: no fake/synthetic results anywhere in the current codebase

**Evidence:**
- `packages/backtester/src/index.ts:65`: `getResult()` returns `null` if no artifact exists —
  never a fabricated curve.
- The current page `EmptyState` copy explicitly states "The platform never fabricates an equity
  curve" (line 64).
- `docs/CONTRACTS/backtester-runner.md §10` specifies that the mock visualization path in
  `NODE_ENV=development` must be clearly labeled "MOCK DATA — no real backtest has been run". This
  code does NOT yet exist (it is a TARGET for option-a Phase 6). For option (b) there is no
  visualization at all, so this concern is moot.
- No fixture data, no demo equity curves, no placeholder metrics are rendered by the current page.

---

### F-12 — INFO — csrf-coverage.test.ts floor is stale (carried from PG9 F-06)

**Evidence:** `tests/integration/csrf-coverage.test.ts:24`: floor is `>= 7`. The PG9 security
handoff flagged this as F-06. Not resolved in PG9 (deferred). PG10 does not add any new server
actions (option b adds none), so the count does not change this phase. Still deferred.

**Recommendation:** Raise the floor to the current actual count in a future phase (PG12 governance
pass). Not a blocker for PG10 option (b).

---

## Decisions

1. **F-01 is the must-fix ordering issue for PG10:** `requireUser()` must be the first call in the
   backtester page, before any branch on `bot === 'legacy'`. The layout auth gate provides a safety
   net but per-page `requireUser()` is mandatory for consistency and defence-in-depth.

2. **F-02 is the primary content correctness issue:** the Legacy "Coming soon" wording and the
   Tortila disabled-teaser buttons must both be removed. Option (b) is a permanent locked card for
   both bots, per the operator decision. The Legacy card must say "Not available for this bot" (no
   future-availability implication). The Tortila card must not render a config form or disabled
   queue/download buttons.

3. **F-03 (orphaned package):** For option (b), `@wtc/backtester` should be removed from
   `apps/web/next.config.ts` transpilePackages and from `apps/web/package.json` deps until it is
   actually consumed. This is optional (the package is harmless) but cleans up false signals.

4. **F-04 (BotSubNav):** The Backtester tab should be hidden for `legacy_bot` using
   `BOT_CAPS[meta.code].hasBacktester` as the filter.

5. **No audit log codes needed for PG10 option (b).** A read-only locked card page requires no
   audit events.

6. **migrationNeeded = false.** No DB tables are added or changed. Gate: `db:generate` must return
   "No schema changes."

7. **No server actions, no API routes, no upload tokens, no `SECRET_BACKTESTER_TOKEN_KEY` needed**
   for option (b). All of those are option (a) items.

---

## Risks

- **F-01 layout gate dependency:** The layout's `getCurrentUser() → redirect('/login')` is a
  process-level guard, not a per-page guard. If the layout were bypassed (e.g. by a Next.js edge
  middleware misconfiguration or a future route restructure), the Legacy backtester locked card
  would be served to unauthenticated users. The content is safe (no user data, no secrets) but the
  auth bypass itself would be the risk. Per-page `requireUser()` eliminates this dependency.

- **BotSubNav Backtester tab on Legacy:** Until F-04 is fixed, a Legacy Bot entitled user sees a
  "Backtester" tab, follows it, and sees the locked card. The UX is confusing but not a security
  risk. Risk is honesty/trust erosion.

- **Orphaned package:** `@wtc/backtester` in `transpilePackages` adds to the Next.js compilation
  scope with zero type coverage. If a future partial option (a) implementation is started and
  abandoned mid-session, types from the package could leak into the app layer and create a
  false-implementation impression. The clean state for option (b) is to remove the wiring until the
  package is ready to be consumed.

- **Drift between `packages/backtester/src/index.ts` and the plan schemas:** The package types
  (`system: string`, minimal artifact shape) differ from the authoritative plan Zod schemas. Any
  future option (a) implementer who starts from the package types rather than the plan will
  introduce schema drift. This risk is noted in F-05; it is deferred and non-blocking for option (b).

---

## Verification/tests

Gates that MUST be run for PG10 (and their expected outcomes):

| # | Gate | Expected outcome |
|---|------|-----------------|
| 1 | `npm run check:core` | PASS |
| 2 | `npm run lint` | PASS (`--max-warnings 0`) |
| 3 | `npm run typecheck` (packages) | PASS — incl. `@wtc/backtester` if its tsconfig is added |
| 4 | `npm run typecheck -w @wtc/web` | PASS — backtester page changes typecheck cleanly |
| 5 | `npm run secret:scan` | PASS — no new secrets introduced |
| 6 | `npm test` (Vitest) | PASS — no regression; count ≥ 482 (PG9 baseline) |
| 7 | `npm run db:generate -w @wtc/db` | PASS — **"No schema changes, nothing to migrate" / 41 tables** |
| 8 | `npm run build -w @wtc/web` | PASS — backtester page builds cleanly |
| 9 | `npm run e2e` (Playwright) | PASS — backtester locked card navigable at 375px + desktop |
| 10 | `npm run governance:check` | PASS — aggregate handoff cites this and all per-agent handoffs |

Tests that SHOULD be added in PG10:

- Static integration test (`tests/integration/backtester-pg10.test.ts`):
  - Assert the backtester page file (`app/(app)/app/bots/[bot]/backtester/page.tsx`) does NOT
    contain `'use server'` (no server actions on a locked card).
  - Assert the page does NOT contain `disabled` attribute paired with a "Queue run" or "Download"
    button text (removes the teaser-button anti-pattern).
  - Assert the page does NOT contain the text "coming soon" or "Coming soon" (case-insensitive,
    honesty rule).
  - Assert the page DOES call `requireUser()` before any `if (bot === 'legacy')` branch (gate
    ordering — F-01 fix).
  - Assert `@wtc/backtester` is NOT imported by the page (package is not needed for option b).
  - Assert `BotSubNav.tsx` does NOT render the Backtester tab unconditionally (F-04 fix).

- E2E test (`tests/e2e/backtester-pg10.spec.ts`):
  - Navigate to `/app/bots/legacy/backtester` as an authenticated user → assert the page shows a
    locked card with "Not available for this bot" wording, no form, no disabled buttons.
  - Navigate to `/app/bots/tortila/backtester` as a user with `tortila_bot` entitlement → assert
    the page shows a locked card with honest copy, no config form, no disabled buttons.
  - Navigate to `/app/bots/tortila/backtester` as a user WITHOUT `tortila_bot` entitlement → assert
    the denial banner renders.
  - Navigate to `/app/bots/unknown/backtester` → assert 404.

NOT RUN (by design — these are option (a) items deferred to a future epic):
- Backtest job creation / upload token generation
- Artifact upload and validation
- Runner download URL generation
- DB migration for `backtest_jobs` / `backtest_artifacts`

---

## Next actions

1. **PG10 implementer (frontend-implementer):** Fix `page.tsx` per F-01 (requireUser first),
   F-02 (remove form + disabled buttons + "coming soon" / "Coming soon" copy), and F-04
   (BotSubNav conditional tab). These are the three must-fix items for option (b) honesty.

2. **PG10 implementer:** Consider removing `@wtc/backtester` from `apps/web/next.config.ts`
   transpilePackages and `apps/web/package.json` deps (F-03) to avoid orphan-package confusion.

3. **PG10 tests-runner:** Add `tests/integration/backtester-pg10.test.ts` (static guards per
   the test list above) and `tests/e2e/backtester-pg10.spec.ts` (locked card e2e).

4. **Deferred (not PG10 blockers):**
   - F-05: annotate `packages/backtester/src/index.ts` as a sketch / non-production scaffold.
   - F-12: raise CSRF-coverage floor (PG12 governance pass).
   - F-03 (if kept): add a dedicated typecheck task to `packages/backtester/package.json`.
