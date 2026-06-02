# ecosystem-billing-access-auditor handoff

## Scope

Phase 2 — Epoch 20260530-0126. Part 9 (a/b/c/d) of the WTC Ecosystem Platform governed build.

This agent owns: `docs/ENTITLEMENT_STATE_MACHINE.md`, `docs/BILLING_PROVIDER_PLAN.md`,
`docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`, `docs/CONTRACTS/billing-webhooks.md`.

Tasks completed:
- (a) Defined the canonical `ProductAccessView` typed object and `buildProductAccessView` factory for all product surfaces.
- (b) Defined the `PricingPlanCard` and `BillingPageData` typed objects for `/pricing` and `/app/billing`.
- (c) Audited the existing admin grant/revoke flow; documented confirmed state + 6 gaps.
- (d) Canonicalized the webhook route as `POST /api/billing/webhook` (TARGET, single unified path).

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md` (pre-edit)
- `docs/BILLING_PROVIDER_PLAN.md` (pre-edit)
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` (pre-edit)
- `docs/CONTRACTS/billing-webhooks.md` (pre-edit)
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/entitlements/src/registry.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/webhook.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/(app)/app/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(public)/pricing/page.tsx`
- `apps/web/src/app/(public)/products/[slug]/page.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/product-status.ts`

---

## Files changed

- `docs/ENTITLEMENT_STATE_MACHINE.md` — Added Section 13: Entitlement Status Display Model (Part 9a). Defines `ProductAccessView` typed object, `buildProductAccessView` factory, per-surface rendering contract and mapping table. Also corrected `allowed_grace` reason code to `grace` to match actual engine.ts implementation (the doc had `allowed_grace`; the code uses `grace`).
- `docs/BILLING_PROVIDER_PLAN.md` — Added Section 10: Pricing / Plans Display Model (Part 9b). Defines `PricingPlanCard` and `BillingPageData` typed objects; documents display rules including admin_grant filter, effective-status computation, and mock checkout guard. Also clarified mock checkout = dev-only server action (Section 5).
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` — Added Section 10: Canonical Webhook Route (Part 9d). Documents `POST /api/billing/webhook` as the single unified path, rationale, TARGET file location, CSRF exclusion, nginx rate-limit config, and supersession of the `:provider` path form.
- `docs/CONTRACTS/billing-webhooks.md` — Updated Section 3 (Endpoint Boundary) to the canonical single path. Updated Section 10 (Rate Limits) to a single entry. Added BW-024 test. Added Section 14: Admin Grant / Revoke Flow — Confirmed State and Gaps (Part 9c). Updated contract version to 1.1.0 and last-reviewed date.

---

## Findings

### F1 — Reason code drift: doc vs code (Severity: LOW, cosmetic)

**Evidence:** `docs/ENTITLEMENT_STATE_MACHINE.md §11` previously listed `allowed_grace` as a
reason code. `packages/entitlements/src/engine.ts:38` defines `AccessReason` as `'grace'` (not
`'allowed_grace'`). `apps/web/src/lib/access.ts:10` maps `'grace'` in the `LABELS` object.

**Fix applied:** Section 11 updated to use `grace` (not `allowed_grace`). Section 13 built
exclusively on the code-defined types so they cannot drift again.

### F2 — Admin grant/revoke: no `reason` field (Severity: P1)

**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx:13-14` — `grantAction` calls
`grantProduct(userId, product)` with no `reason`. `ENTITLEMENT_STATE_MACHINE.md §9` specifies
`reason TEXT NOT NULL` in `audit_logs` for all manual actions.

**Recommendation:** Implementation agent adds a required `reason` text input to the grant form
and threads it through `grantProduct` → `audit.write`. Empty reason must be rejected server-side.

### F3 — Admin grant/revoke: no `validUntil` on grants (Severity: P1)

**Evidence:** `lib/backend.ts:46` exports `grantProduct` with signature `(userId, productCode)`
— no `validUntil` parameter. All admin grants are therefore indefinite (`valid_until = NULL`).

**Recommendation:** Extend `grantProduct` to accept an optional `validUntil: number | null`.
Add optional date input to the admin form.

### F4 — No `manual_review` flag / resolve actions (Severity: P2)

**Evidence:** The admin entitlements page has only "Grant" and "revoke" actions. No path
exists to flag a user for review or to resolve a `manual_review` state.

**Recommendation:** Add "Flag for review", "Approve review", "Reject review" server actions.

### F5 — `product_access_events` write not confirmed (Severity: P1)

**Evidence:** The table is in the seed schema (confirmed in `0000-orchestrator-seed.md`). The
`grantProduct` / `revokeProduct` implementations in `lib/db-store.ts` were not read in this
audit session. The state machine spec (§12) requires a full snapshot row written on every
state transition.

**Recommendation:** db-architect to confirm `product_access_events` rows are written by the
DB-backed `grantProduct` and `revokeProduct` implementations. If absent, add them.
This is the event-sourced record needed for billing dispute resolution.

### F6 — No `apps/web/src/app/api/` directory (Severity: INFO)

**Evidence:** `apps/web/src/app/api/**` glob returned no files. The canonical webhook route
`POST /api/billing/webhook` does not yet have an implementation file.

**Status:** Expected for a DESIGN phase. The TARGET file path is documented:
`apps/web/src/app/api/billing/webhook/route.ts`. Implementation is deferred to a future wave.

### F7 — No `/app/club` product surface (Severity: LOW)

**Evidence:** No `apps/web/src/app/(app)/app/club/` directory or page exists. The `club`
product has `status: 'planned'` in `product-status.ts`.

**Recommendation:** When created, must follow the same `ProductAccessView` / `accessFor` pattern
defined in `ENTITLEMENT_STATE_MACHINE.md §13`.

### F8 — Public product page has no authenticated entitlement status display (Severity: LOW)

**Evidence:** `apps/web/src/app/(public)/products/[slug]/page.tsx` is a public page with no
session; it shows product info and "Create account / See pricing" CTAs regardless of login.
When a logged-in user visits a public product page, they see the same unauthenticated view.

**Recommendation:** The public product page does not need to show entitlement status (it is
public by design). Logged-in users should go to `/app` for their access status. This is
acceptable. No change required.

---

## Entitlement status display model

The canonical typed view object is `ProductAccessView` (defined in `ENTITLEMENT_STATE_MACHINE.md §13`):

```
ProductAccessView {
  productCode, productName,
  allowed,                   // only from explainAccess — never from client state
  reason,                    // AccessReason from explainAccess
  statusLabel,               // human label for StatusPill
  tone,                      // 'ok' | 'warn' | 'bad' | 'neutral'
  message,                   // full sentence why access is allowed/blocked/etc.
  expiresAt,                 // ISO string or null
  cta,                       // { label, href } or null
  showGraceBanner,           // true only when reason === 'grace'
}
```

Factory: `buildProductAccessView(entitlements, productCode, now)` — server-side only.

All 6 current product surfaces already use `accessFor()` + `reasonLabel()` + `reasonTone()` from
`apps/web/src/lib/access.ts` — which is the inline equivalent. The `ProductAccessView` type
formalises this into a single typed object so pages stop reconstructing it ad hoc.

Every surface MUST show WHY access is blocked (reason message), not just that it is blocked.
The `cta` field drives the single buy/renew button — no surface adds CTA logic outside this object.

---

## Pricing/plans display model

Two typed objects (defined in `BILLING_PROVIDER_PLAN.md §10`):

`PricingPlanCard` — for `/pricing` (public, no session):
- Derived from `PLANS` registry (static). Excludes `admin_grant`.
- Bundles shown with `gold` pill; non-bundles with `neutral`.
- CTA always → `/register` (not checkout); logged-out users register first.
- `priceDisplay` is currently `'—'` until Stripe price map is configured.

`BillingPageData` — for `/app/billing` (logged-in):
- `entitlements`: rows with `effectiveStatus` from `evaluateStatus(ent, now)` (time-based, not raw DB status).
- `plans`: same plan cards as pricing (dev-only mock checkout button added).
- `showMockCheckout`: guarded by `NODE_ENV !== 'production'`.
- Grace rows get a prominent warning banner in addition to the status pill.

---

## Canonical webhook route (TARGET)

Single unified path:

```
POST /api/billing/webhook
```

- Target file: `apps/web/src/app/api/billing/webhook/route.ts` (does not exist yet).
- Provider detected from signature header (`stripe-signature` → Stripe; `x-*-sig` → crypto).
- Supersedes `/api/webhooks/billing/:provider` and the separate `/stripe` / `/crypto` paths.
- CSRF exclusion required in `apps/web/src/middleware.ts`.
- Single nginx location block, 300 req/min, Stripe IP allowlist.
- Mock checkout path (`/dev/billing/simulate`) is unchanged (GET, dev-only).
- No real provider calls; mock checkout = dev-only server action (already guarded by `assertNotProduction()`).

---

## Admin flow gaps

| Gap | Severity | Owner |
|---|---|---|
| No `reason` field on grant/revoke | P1 | implementation agent |
| No `validUntil` on admin grants | P1 | implementation agent |
| No `manual_review` flag/approve/reject actions | P2 | implementation agent |
| `plan_code` not shown in admin entitlements table | P3 | implementation agent |
| `product_access_events` write not confirmed in DB store | P1 | db-architect + implementation agent |
| No bulk grant/revoke | P3 | future phase |

---

## Decisions

1. `grace` is the correct reason code (not `allowed_grace`) — matches `engine.ts` implementation.
2. `ProductAccessView` is the single typed interface for all product surface renders; no surface adds ad-hoc access logic outside it.
3. `admin_grant` plan is filtered from both `/pricing` and `/app/billing` plan lists — it is internal only.
4. `POST /api/billing/webhook` is the single canonical route for all providers. The `:provider` path form is deprecated.
5. Mock checkout stays as a Next.js Server Action guarded by `assertNotProduction()` — no route handler variant.
6. Public product pages (`/products/[slug]`) intentionally show no entitlement status; they are pre-login marketing surfaces.

---

## Risks

1. `product_access_events` writes are not confirmed in the DB store layer (F5). If absent, billing dispute resolution is incomplete. Escalated to db-architect.
2. The canonical webhook route file (`apps/web/src/app/api/billing/webhook/route.ts`) does not exist. Until it is created, no real webhooks are processed. This is expected and documented as TARGET.
3. The admin grant/revoke form missing a `reason` field (F2) means the current admin UI would produce audit log entries with empty or missing reasons, which violates the state machine spec. This must be fixed before admin grants are used in production.

---

## Verification/tests

Not applicable — this is a DESIGN ONLY agent. No code was written or executed. All findings are from static file inspection.

---

## Next actions

1. **db-architect**: Confirm `product_access_events` rows are written on every entitlement state transition (grant, revoke, webhook-driven). Coordinate the table schema with the requirements in `ENTITLEMENT_STATE_MACHINE.md §12`.
2. **implementation agent (billing)**: Create `apps/web/src/app/api/billing/webhook/route.ts` per the TARGET spec in `PAYMENT_WEBHOOK_STATE_MACHINE.md §10`.
3. **implementation agent (admin UI)**: Fix the 3 P1 admin gaps: add `reason` field, add `validUntil`, confirm `product_access_events` writes in `grantProduct`/`revokeProduct`.
4. **implementation agent (product surfaces)**: Replace ad-hoc `accessFor + reasonLabel + reasonTone` chains with `buildProductAccessView` once `packages/entitlements/src/view.ts` is created (TARGET). Until then, the inline pattern in `lib/access.ts` is acceptable.
5. **implementation agent (club)**: When `/app/club` page is created, follow the `ProductAccessView` contract from `ENTITLEMENT_STATE_MACHINE.md §13`.
