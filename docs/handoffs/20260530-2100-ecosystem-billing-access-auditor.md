# ecosystem-billing-access-auditor handoff

## Scope

Phase 2.8, epoch `20260530-2100`. Read-only audit of PG4 Billing (UNBLOCKED parts only) and PG5
`markExpiringSoon` follow-up. Covers:

1. Billing feature directory scaffold: what is genuinely consumable vs dead code under current
   constraints (Q-2 open, B2 blocked, no Stripe test keys).
2. Honest pricing CTA: how `/pricing` and `/app/billing` should drive the CTA and a status pill
   from checkout availability without implying instant Stripe checkout.
3. `markExpiringSoon` follow-up: scope, placement, and what would be dead without a real DB run.
4. Standing entitlement invariant confirmation.
5. TARGET/NOT-RUN surface for `createCheckout`, price map, and the pending_payment→active integration test.

Governance documents read: `AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`,
`docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, prior aggregate
`docs/handoffs/20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md`.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/OPEN_QUESTIONS.md` (Q-2 lines 44-65)
- `docs/PRODUCTION_BLOCKERS.md` (B2 lines 24-32)
- `docs/ROADMAP_MASTER.md` (Section 4, lines 51-58)
- `docs/BILLING_PROVIDER_PLAN.md` (all sections; §5 mock dev provider; §10 display model)
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` (§1-§2)
- `docs/CONTRACTS/billing-webhooks.md` (§1-§3)
- `docs/ENTITLEMENT_STATE_MACHINE.md` (all sections)
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/features/billing/timeline.ts` (all 107 lines)
- `apps/web/src/app/(public)/pricing/page.tsx` (all 191 lines)
- `apps/web/src/app/(app)/app/billing/page.tsx` (all 243 lines)
- `packages/billing/src/provider.ts` (all 80 lines)
- `packages/billing/src/stripe.ts` (all 83 lines)
- `packages/billing/src/webhook.ts` (all 79 lines)
- `packages/billing/src/index.ts` (all 12 lines)
- `packages/entitlements/src/registry.ts` (all 74 lines)
- `packages/entitlements/src/engine.ts` (all 220 lines)
- `packages/entitlements/src/state-machine.ts` (via imports)
- `apps/web/src/lib/access.ts` (all 33 lines)
- `apps/web/src/app/(app)/app/indicators/page.tsx` (all 202 lines)
- `apps/worker/src/jobs.ts` (all 175 lines)
- `apps/worker/src/index.ts` (all 113 lines)

## Files changed

None — read-only audit.

## Findings

### F-01 (medium) — Inline PLANS filter/map duplicated across two pages; no shared view-model

**Evidence:**
- `apps/web/src/app/(public)/pricing/page.tsx:35` — `const DISPLAY_PLANS: PlanDef[] = Object.values(PLANS).filter((p) => p.code !== 'admin_grant');`
- `apps/web/src/app/(public)/pricing/page.tsx:79-140` — map over `DISPLAY_PLANS` deriving `isBundle`, `productNames`, `alreadyHave` inline in JSX
- `apps/web/src/app/(app)/app/billing/page.tsx:220-239` — `Object.values(PLANS).filter((p) => p.code !== 'admin_grant').map(...)` inline in JSX (identical filter, same shape)

Both pages duplicate the `admin_grant` exclusion filter, the `isBundle` derivation, and the product-name join.
The `BILLING_PROVIDER_PLAN.md §10` already specifies a `PricingPlanCard` interface for this view-model but
no corresponding `apps/web/src/features/billing/plans.ts` file exists. `timeline.ts` is the only file in
`features/billing/`.

**Recommendation (unblocked, no dead code risk):** Create
`apps/web/src/features/billing/plans.ts` exporting:

```typescript
// Pure function — derives display data from PLANS/PRODUCTS; no network, no DB.
// Consumed by pricing/page.tsx (replace lines 35, 79-140) and billing/page.tsx (replace lines 220-239).
export interface PricingPlanCard { ... }    // matches BILLING_PROVIDER_PLAN.md §10
export function buildPricingCards(): PricingPlanCard[]
```

`buildPricingCards()` does exactly the current inline logic:
`Object.values(PLANS).filter(p => p.code !== 'admin_grant')` with `isBundle`, `products` (names array),
`billing` cadence, and `priceDisplay: '—'` (placeholder until Stripe price IDs exist — never expose raw IDs).
This file is fully consumable NOW: it is pure, has no dependencies beyond `@wtc/entitlements`, zero call-site
ambiguity, and removes the duplicated inline code. It is also the correct long-term foundation for the
`CheckoutButton` (when B2 unblocks) and the `PlanCard` React component.

**Target:** PG4 unblocked scaffold.

---

### F-02 (medium) — No `checkoutAvailability()` module; pricing CTA does not distinguish "admin grant only" from "checkout available"

**Evidence:**
- `apps/web/src/app/(public)/pricing/page.tsx:129-137` — logged-in CTA is always `Link href="/app/billing"` with label "View in billing"; logged-out is always `Link href="/register"` with label "Create account". Neither pill nor copy states that self-serve checkout is not enabled.
- `docs/OPEN_QUESTIONS.md:58` — Q-2 chosen default: "Manual admin grant only". No Stripe test keys are available in this environment (B2 state: `PRODUCTION_BLOCKERS.md:24-32`).
- `packages/billing/src/stripe.ts:47-55` — `createCheckout()` throws `BillingProviderNotConfiguredError` when `opts.secretKey` is absent. This is the correct behaviour; no fake session is created.

**Gap:** The current CTA gives no signal to a logged-in user that self-serve checkout is not currently
enabled, nor any guidance toward the actual access path (admin grant / contact support). The
`RiskWarningBanner` at line 71-75 states how access works in general, but the per-plan CTA button says
only "View in billing" with no further context pill.

**Recommendation (unblocked, no dead code risk):** Create
`apps/web/src/features/billing/checkout.ts` (server-only, `'use server-only'` tag) exporting:

```typescript
export type CheckoutAvailability =
  | { available: false; reason: 'not_configured'; ctaLabel: string; ctaHref: string }
  | { available: true; checkoutHref: string };      // post-B2 path; unreachable until STRIPE_SECRET_KEY set

export function checkoutAvailability(planCode: string, userId?: string): CheckoutAvailability
```

Under Q-2 (manual-grant-only default) this returns:
```typescript
{ available: false, reason: 'not_configured',
  ctaLabel: 'Contact support for access',
  ctaHref: '/app/support' }
```

The function reads `BILLING_PROVIDER=mock` (or absent `STRIPE_SECRET_KEY`) from env at call time —
no client state. Both pages import `checkoutAvailability` and render:
- A `StatusPill tone="neutral"` with "Self-serve not available" next to the plan name.
- The CTA button as `Link href={ctaHref}` with `ctaLabel` text.
- On /pricing: when logged-out, the CTA still routes to `/register` (user must have an account first);
  `checkoutAvailability()` shapes the post-login expectation shown in the card body ("After registering,
  contact support or wait for an admin grant.").

This module has exactly one consumer path per billing state: not_configured → honest copy.
It is NEVER a fake purchase button. The `checkoutAvailability` result is computed server-side,
never from client state or a role label.

When B2 is cleared (Stripe test keys provisioned), `checkout.ts` is the single place to update —
no page changes needed. This is the correct boundary.

**Target:** PG4 unblocked scaffold. The `available: true` branch must remain TARGET/NOT-RUN (dead code
if added now — there is no consumer; the module only grows with the un-blocked path later).

---

### F-03 (low) — `billing/page.tsx` mock checkout section has no `assertNotProduction()` guard at the render level (only at the server-action level)

**Evidence:**
- `apps/web/src/app/(app)/app/billing/page.tsx:14-23` — `mockPurchase` server action calls `assertNotProduction('Mock checkout')` as its first statement.
- `apps/web/src/app/(app)/app/billing/page.tsx:217-240` — The "Activate a plan (dev only)" section and all mock checkout `<form>` cards render unconditionally. `assertNotProduction()` is only called at action invocation, not at render time.

**Impact:** In production the "Activate a plan (dev only)" section and `<button>` elements render in the
HTML even though submitting them would throw. This does not bypass any security gate (the action guard is
authoritative), but it is a confusing prod-visible UX: users see "Activate (mock · dev)" buttons that
silently fail.

**Recommendation:** Wrap the dev-only section in `if (process.env.NODE_ENV !== 'production')` at the
component level, or expose `showMockCheckout: boolean` (already specified in `BILLING_PROVIDER_PLAN.md §10
BillingPageData.showMockCheckout`) computed server-side. The `checkoutAvailability()` module from F-02
could signal this cleanly without adding a new env read.

**Target:** PG4 unblocked; low-risk isolated change; no shared-spine files touched.

---

### F-04 (low) — `markExpiringSoon` pre-pass: `expiring_soon` DB status is never written; follow-up scope

**Evidence:**
- `docs/handoffs/20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md:122` — "The 7-day `expiring_soon` status is still never written" and "tracked as a PG5 follow-up".
- `packages/tradingview-access/src/index.ts:100` — in-memory `TvAccessService.sweep()` writes `status: 'expiring_soon'` for the in-memory adapter path.
- `apps/worker/src/index.ts:35` — `sweepTvExpiry(db, now)` in the DB tick does NOT call `markExpiringSoon`.
- `packages/db/src/repositories.ts` (confirmed by grep: `expiring_soon` appears only in the schema comment and the type union at line 252, never in a write call).

**Scope of the follow-up:**

The `markExpiringSoon` pre-pass is a bounded, isolated addition to `packages/db/src/repositories.ts`:
a new function `markExpiringSoon(db, horizonMs)` that issues:
```sql
UPDATE tradingview_access_requests
SET status = 'expiring_soon'
WHERE status = 'granted'
  AND expires_at > NOW()
  AND expires_at <= NOW() + $horizonMs
```

Called in the `dbTick()` before `sweepTvExpiry` (which handles `expired`). No migration needed — the
column and `expiring_soon` value already exist in the schema (`packages/db/src/schema.ts:162`).

**Dead code risk assessment:** This function would have exactly one call site (the worker tick) and one
test site (the `db-persistence` / `db-pg5` integration tests). It is NOT dead code — it is directly
consumed by an existing code path. The PG11 structured-logger was deferred specifically because it had
zero call sites; this is the opposite case.

**Recommendation:** Include `markExpiringSoon` in PG5 follow-up implementation. It is unblocked (no
migration, no credential, no Stripe key). The 7-day horizon should be a named constant
(`TV_EXPIRING_SOON_DAYS = 7`) in `packages/db/src/repositories.ts` alongside the existing
`TV_EXPIRED_BY_WORKER_REASON` constant.

**Target:** PG5 follow-up (this phase group session, if ordered before PG4 Billing).

---

### F-05 (info) — `createCheckout`, price map, and pending_payment→active integration test: explicit TARGET/NOT-RUN confirmation

**Evidence:**
- `packages/billing/src/stripe.ts:47-55` — `createCheckout()` throws `BillingProviderNotConfiguredError`
  when `opts.secretKey` is absent. No Stripe SDK network call is made.
- `docs/PRODUCTION_BLOCKERS.md:24-32` (B2) — "checkout creation is TARGET — no `createCheckout`, so no
  user can be charged. Billing provider undecided (Q-2)."
- `docs/OPEN_QUESTIONS.md:58` — Q-2 chosen default: "Manual admin grant only".
- No `STRIPE_SECRET_KEY` or `STRIPE_PRICE_MAP` are present in this environment.
- `docs/BILLING_PROVIDER_PLAN.md:186-201` — `STRIPE_PRICE_MAP` is specified as a design artifact with
  placeholder `price_xxx` values; no live IDs exist.

**Status (binding):**

| Artifact | Status | Reason |
|---|---|---|
| `createCheckout` (Stripe) | TARGET / NOT RUN | B2: no STRIPE_SECRET_KEY; Q-2: provider undecided |
| `STRIPE_PRICE_MAP` | TARGET / NOT RUN | B2: no live/test Stripe prices configured |
| `pending_payment → active` integration test (real Stripe event) | NOT RUN | B2: no test-mode keys; no real Checkout Session |
| Mock checkout self-grant (`mockPurchase` server action) | DONE (dev-only, assertNotProduction) | Correct; must remain dev-only |
| Billing webhook reception (signature-verified, idempotent) | DONE | Phase 2.3/2.4; does not require createCheckout |

Nothing in this status changes the entitlement layer or access decisions. Entitlements remain the
only access source of truth.

---

### F-06 (info) — Standing invariant confirmation: entitlements are the only access source of truth; mock checkout is dev-only

**Evidence:**
- `apps/web/src/lib/access.ts:1-8` — `accessFor()` calls `explainAccess(ents, productCode, Date.now())`. No
  client state, no role label, no billing table read.
- `packages/entitlements/src/engine.ts:117-151` — `explainAccess()` is pure over `Entitlement[]`; unknown
  states collapse to `blocked_unknown_state` (fail-closed); no network call.
- `apps/web/src/app/(app)/app/billing/page.tsx:16-23` — `mockPurchase` server action: first statement is
  `assertNotProduction('Mock checkout')`. The action is unreachable in production.
- `packages/billing/src/provider.ts:44-46` — `createMockBillingProvider` throws immediately in production
  (`process.env.NODE_ENV === 'production'`).

**Confirmed:** Access comes only from the server-side entitlement engine. The mock checkout self-grant
is dev-only at two enforcement layers (action guard + provider guard). No client flag, no role label,
no unchecked payment status is trusted. This invariant is intact across all PG4 artifacts.

---

## Decisions

1. **PG4 unblocked scaffold = two files only, both with real consumers:**
   - `apps/web/src/features/billing/plans.ts` — `buildPricingCards()` pure view-model (Finding F-01).
     Consumed by both pages, removes the current duplicate inline filter/map.
   - `apps/web/src/features/billing/checkout.ts` — `checkoutAvailability()` server-only module (Finding F-02).
     Returns `{ available: false, reason: 'not_configured', ... }` under Q-2; drives the per-plan CTA pill.

2. **No additional billing scaffold files (actions/schemas/PlanCard/CheckoutButton/SubscriptionStatus) in
   this phase.** Reason: all of these depend either on B2 (checkout) or on a real server action that
   calls `createCheckout`. Adding them now produces dead code with no call sites — the PG11 structured-logger
   precedent applies directly (deferred precisely because it had no call sites). They are designed in
   `BILLING_PROVIDER_PLAN.md §10` and `ARCHITECTURE.md` and can be built when B2 is unblocked.

3. **Pricing CTA honest copy (Finding F-02):** The per-plan CTA must never imply instant Stripe checkout.
   Under Q-2 the copy is: CTA button = "Contact support for access", href = "/app/support"; status pill =
   "Self-serve not available" (tone: neutral). The existing `RiskWarningBanner` at pricing/page.tsx:71-75
   remains in place as the general "How access works" banner. The per-plan pill is an additive change.
   Logged-out users: CTA still → `/register` (must register first); the `checkoutAvailability` pill
   appears in the card body below the register button as explanatory copy.

4. **`markExpiringSoon` is in-scope for PG5 follow-up.** It is not dead code (one existing call site in
   the worker tick, direct integration test coverage path). A 7-day constant alongside the existing
   `TV_EXPIRED_BY_WORKER_REASON` constant in `packages/db/src/repositories.ts` is the correct placement.

5. **Mock checkout section render guard (Finding F-03) is an optional improvement:** correctness is
   preserved by the server-action `assertNotProduction()` guard. The render-level guard is UX polish.
   Low priority; can be bundled with F-01 or F-02 in the same implementation pass.

## Risks

- **Dead-code trap:** The roadmap lists "actions/schemas/PlanCard/CheckoutButton/SubscriptionStatus" as
  PG4 items (ROADMAP_MASTER.md:55). Only `plans.ts` and `checkout.ts` are genuinely consumable NOW.
  Scaffolding `CheckoutButton.tsx` (client component) or `SubscriptionStatus.tsx` without a wired
  server action would produce components that are never rendered — the PG11 precedent.
  **Mitigation:** Implement only the two modules specified in Decision 1; annotate the remaining items
  as TARGET in the billing feature directory and in `ROADMAP_MASTER.md §4`.

- **B2 / Q-2 coupling:** Any `checkout.ts` `available: true` branch written now has no test path (no
  `STRIPE_SECRET_KEY`, no mock-checkout-via-createCheckout). Adding that branch before B2 is unblocked
  would be dead code and could mislead future implementers. The `available: true` branch must remain
  entirely absent until B2 is cleared.

- **`checkoutAvailability()` server-only requirement:** This function reads process env (`BILLING_PROVIDER`,
  `STRIPE_SECRET_KEY`). It must carry the `'use server-only'` / `import 'server-only'` guard (matching
  `timeline.ts:1`) so it cannot be bundled into the client. Risk if omitted: env var leak to the browser.

- **`plans.ts` must not import `server-only`:** It is a pure view-model (no DB, no env). It should be
  importable by both server components and any future tests without triggering the server-only guard.
  Keep it free of server-only imports.

- **`markExpiringSoon` without real-PG acceptance is demo-only:** The function will be PGlite-testable
  (same pattern as `db-pg5.test.ts`), but the real `sweepTvExpiry` → `markExpiringSoon` worker path has
  not been run against real Postgres (B1 still NOT RUN). This is consistent with every other worker job
  and is acceptable — document in the test file.

- **Shared-spine check:** Neither `plans.ts` nor `checkout.ts` touches `schema.ts`, `repositories.ts`,
  `backend.ts`, or `middleware.ts`. Both are additive files in `features/billing/`. Zero shared-spine risk.

## Verification/tests

Gates that must pass after PG4 scaffold implementation (in order; no new gates added, same sequence as
Phase 2.7):

| Gate | Expected result |
|---|---|
| `npm run check:core` | PASS (7 smokes — new files are pure, no env at import time) |
| `npm run lint` | PASS (`--max-warnings 0`) |
| `npm run typecheck` (packages) | PASS |
| `npm run typecheck -w @wtc/web` | PASS (`plans.ts` + `checkout.ts` both typed; pages import them) |
| `npm run secret:scan` | PASS (`checkout.ts` reads env names as strings, no value leaks) |
| `npm test` | PASS (count ≥ 317 + any new unit tests for `buildPricingCards` / `checkoutAvailability`) |
| `npm run build -w @wtc/web` | PASS (44 routes minimum; no new routes from PG4 scaffold) |
| `npm run e2e` | PASS (36/36; the pricing/billing pages exist and render; CTA text update is a smoke check) |
| `npm run governance:check` | PASS (this per-agent handoff cited in aggregate) |

NOT RUN (unchanged blockers):
- `db:migrate` / `db:seed` / real-PG harness — B1, no `DATABASE_URL`.
- Real Stripe checkout flow (`createCheckout` → Checkout Session) — B2, no `STRIPE_SECRET_KEY`.
- `pending_payment → active` integration test with real Stripe event — B2.
- `markExpiringSoon` DB path against real Postgres — B1.

**Recommended unit tests for the two new modules:**

`tests/unit/billing-plans.test.ts`:
- `buildPricingCards()` excludes `admin_grant`.
- Bundle plans have `isBundle: true`; single plans have `isBundle: false`.
- All plans have non-empty `products` (except `admin_grant`, which is filtered).
- `priceDisplay` is `'—'` for all cards in the absence of a price map.

`tests/unit/billing-checkout.test.ts`:
- `checkoutAvailability('tortila_monthly')` returns `{ available: false, reason: 'not_configured' }` when
  `STRIPE_SECRET_KEY` is absent / `BILLING_PROVIDER=mock`.
- The returned `ctaHref` is `/app/support` and `ctaLabel` is non-empty.
- No test exercises the `available: true` branch (it must not be implemented yet — B2).

## Next actions

1. **PG4 implementation (this phase session):**
   - Create `apps/web/src/features/billing/plans.ts` — `buildPricingCards()` pure view-model.
   - Create `apps/web/src/features/billing/checkout.ts` — `checkoutAvailability()` server-only module.
   - Update `apps/web/src/app/(public)/pricing/page.tsx` lines 35 and 79-140: replace inline
     `DISPLAY_PLANS` derivation with `buildPricingCards()` + `checkoutAvailability()` per-plan pill.
   - Update `apps/web/src/app/(app)/app/billing/page.tsx` lines 220-239: replace inline
     `Object.values(PLANS).filter(...)` with `buildPricingCards()`.
   - Optional: add render-level `NODE_ENV !== 'production'` guard on the dev-only section (F-03).
   - Add unit tests for both new modules (see Verification/tests above).
   - Run full gate sequence; confirm build count unchanged (44 routes).

2. **PG5 follow-up (`markExpiringSoon`) — independent of PG4, can be batched:**
   - Add `markExpiringSoon(db, horizonMs)` to `packages/db/src/repositories.ts` alongside `TV_EXPIRED_BY_WORKER_REASON`.
   - Call it in `apps/worker/src/index.ts` `dbTick()` before `sweepTvExpiry`.
   - Add a PGlite integration test to `tests/integration/db-pg5.test.ts` (or a new `db-pg5-markexpiring.test.ts`).
   - Confirm `db:generate` still reports "No schema changes" (no migration needed).

3. **Operator decision gating PG4 full checkout path (not this session):**
   - B2: select billing provider (Q-2) + provision Stripe test keys → then build the `available: true`
     branch in `checkout.ts` + wire `createCheckout` + add `pending_payment → active` integration test.

4. **Standing deferred (not this phase):**
   - F-03 structured logger (PG12) — no call sites yet.
   - CSP per-request nonce (PG3).
   - Real-PG run (B1) — needs `DATABASE_URL`.
   - Axioma ES256 wiring (B4) — needs P-256 key.
   - Legacy adapter (B3) — needs upstream plaintext-key fix.
