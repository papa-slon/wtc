# Handoff: ecosystem-billing-access-auditor — Phase 0

**Date:** 2026-05-29
**Agent:** ecosystem-billing-access-auditor
**Phase:** 0 — Documentation and Architecture

---

## Scope

Design and document the complete billing and entitlement subsystem for the WTC Ecosystem Platform.
This covers the entitlement state machine, the billing provider abstraction and implementations,
the payment webhook state machine, and the billing webhooks contract document.

No code was written. No live services were touched. No secrets were copied.
All output is documentation only, consistent with Phase 0 deliverables.

---

## Files Inspected (read-only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions: states, plan codes, product codes, schema groups, RBAC roles, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Platform scope, billing/entitlement requirements, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Module boundaries, `packages/billing`, `packages/entitlements` boundaries |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Runtime topology, existing services, integration constraints |

---

## Files Written

| File | Description |
|---|---|
| `docs/ENTITLEMENT_STATE_MACHINE.md` | 12-section canonical state machine: all states, full transition table, mermaid stateDiagram, product+plan code registry, bundle expansion rules, manual grant/revoke precedence, expiry+grace, refund/chargeback revocation, admin override audit schema, fail-closed behavior, `explainAccess` reason taxonomy |
| `docs/BILLING_PROVIDER_PLAN.md` | Provider abstraction interface; Stripe, crypto, and manual implementations; billing type matrix; mock dev provider; billing→entitlement sync path; required tests |
| `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` | Signature verification (Stripe HMAC + crypto HMAC); idempotency design and SQL schema; duplicate and out-of-order event handling; full Stripe and crypto event coverage matrix; webhook state diagram; monitoring/alerting conditions; required tests |
| `docs/CONTRACTS/billing-webhooks.md` | Contract doc with: owner, consumer, auth method, endpoint boundary, request/response schemas, error envelope, idempotency, rate limits, timeouts, mock-vs-real status matrix, activation checklist, 23 required tests |

---

## Findings

1. **No billing provider is currently wired.** The WTC platform is greenfield. Stripe is the recommended primary provider. Crypto is a documented stub awaiting operator decision on processor selection.

2. **Manual grants are already the de-facto access mechanism** for existing Axioma users (admin-managed via journal_server). The `admin_grant` plan code and manual provider cover this path without requiring a payment provider in early phases.

3. **Bundle expansion requires atomicity.** The seed specifies `bundle_pro` (4 products) and `bundle_starter` (2 products). A naive implementation that creates entitlements one by one risks partial-grant states. The state machine mandates a single DB transaction for all members.

4. **Webhook idempotency store uses PostgreSQL** (not Redis) to avoid additional infrastructure in Phase 0. This is a deliberate trade-off: acceptable for low-volume early deployment; Redis can be substituted later without changing the `IdempotencyStore` interface.

5. **Fail-closed on DB errors** is explicitly required and documented. A DB outage must deny access, not silently allow it. This is the most safety-critical behavior in the entitlement layer.

6. **Chargeback handling requires admin resolution.** Chargebacks transition to a terminal-from-billing state. Even if the dispute is won (merchant favor), the entitlement moves to `expired`, not back to `active`. Re-purchase is required. This prevents automatic re-activation after a successful chargeback resolution, which could be exploited.

7. **Partial refunds cannot be automatically resolved.** The correct access state after a partial refund is ambiguous (could be proportional access, reduced term, or full revocation). `manual_review` is the only safe default.

8. **Out-of-order Stripe delivery is a real operational concern.** Stripe's retry infrastructure can deliver events out of timestamp order. The late-renewal window (7 days, configurable) handles the `subscription.deleted` + delayed `invoice.paid` scenario gracefully.

---

## Decisions

1. **PostgreSQL for idempotency store** (not Redis) — reduces infrastructure complexity in Phase 0. Documented in this handoff as a deliberate choice with a clear upgrade path.

2. **Chargeback won → `expired`, not `active`** — user must re-purchase after a chargeback regardless of outcome. This is the safest default for a fintech platform.

3. **Partial refund → `manual_review`** — no automated partial access calculation. Admin decides the fair resolution.

4. **Billing events do NOT override `revoked` state** — admin manual revoke is always the highest-precedence signal.

5. **Crypto recurring billing** is implemented as serial invoice series (one invoice per period), not as native crypto subscriptions (which do not exist on-chain). Each renewal generates a new invoice.

6. **`explainAccess` reason taxonomy** has been defined with 8 codes (`allowed`, `allowed_grace`, `blocked_no_entitlement`, `expired`, `pending_payment`, `manual_review`, `revoked`, `refunded`, `chargeback`) matching all entitlement states. UI components must use these codes, never raw status strings.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Stripe price IDs not yet configured | Medium | `STRIPE_PRICE_MAP` is a separate config file; documented as a required activation step |
| Crypto processor not selected | Medium | Interface is complete; processor selection is an operator decision; documented as a stub |
| DB transaction atomicity for bundle expansion | High | Documented as a hard requirement; must be verified in integration tests (BW-018) |
| Missing `wtc_user_id` in Stripe metadata if checkout creation has a bug | High | Handler transitions to `manual_review` and alerts admin rather than guessing or denying silently |
| Late renewal window (7 days) too long or too short for actual payment retry patterns | Low | Configurable via `BILLING_LATE_RENEWAL_WINDOW_DAYS`; review after first 30 days of production data |
| Rate limit allowlist for Stripe IPs not configured in nginx | Medium | Documented in activation checklist; must be done before go-live |
| Chargebacks with automatic re-activation expectations from users | Low | Documented user-facing message: "Contact support"; no auto re-activation |

---

## Tests / Verification

23 required tests are listed in `docs/CONTRACTS/billing-webhooks.md` (BW-001 through BW-023).

Tests BW-001 through BW-021 are Vitest unit/integration tests that must pass in CI before
any production wiring. No live Stripe API calls in these tests — all use mock provider and
Stripe fixture JSON.

Tests BW-022 and BW-023 (end-to-end subscription lifecycle + chargeback) require staging
environment with real Stripe test keys and Stripe test clock.

All entitlement state machine transitions also require Vitest unit tests in `packages/entitlements`
that run without a live DB (mock repository pattern).

---

## Next Actions

1. **Scaffold `packages/billing`** with the `BillingProvider` interface and mock provider implementation so Phase 1 can exercise the checkout flow locally.
2. **Scaffold `packages/entitlements`** with `hasAccess`, `explainAccess`, `grantAccess`, `revokeAccess`, `syncBillingState` — all operating through a repository interface (testable without DB).
3. **Create DB migration** for: `entitlements`, `product_access_events`, `billing_customers`, `webhook_idempotency_keys` tables under `packages/db`.
4. **Create `apps/worker`** expiry job that moves `active → grace → expired` on schedule.
5. **Implement Stripe provider** after price IDs are configured in Stripe Dashboard (requires operator action first).
6. **Select and integrate crypto processor** (operator decision required).
7. **Write Vitest tests** BW-001 through BW-021.
8. **Admin panel entitlement management UI** — list, grant, revoke, flag for review — after Phase 2 backend is scaffolded.

Blocking dependency for Stripe production wiring: operator must provide Stripe account, create products/prices, and configure the webhook endpoint in the Stripe Dashboard.
