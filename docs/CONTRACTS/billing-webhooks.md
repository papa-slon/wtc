# CONTRACT: Billing Webhooks

**Owner:** `packages/billing` (WTC Ecosystem Platform)
**Consumer:** Stripe webhook infrastructure / Crypto payment processor / Admin manual tools
**Contract version:** 1.1.0
**Status:** Phase 0 — MOCK (not wired to live provider). Must pass all required tests before production activation.
**Last reviewed:** 2026-05-30 (Phase 2 — canonical route update)

---

## 1. Ownership and Responsibility

| Role | Owner |
|---|---|
| Endpoint implementation | WTC Platform — `packages/billing` + `apps/web` route handler |
| Signature secret management | WTC DevOps (secret vault) |
| Provider configuration | WTC Admin (Stripe Dashboard / crypto processor dashboard) |
| Entitlement application | `packages/entitlements` called by `packages/billing` |
| Audit logging | `packages/audit` called after every transition |
| Retry and delivery guarantees | Stripe / crypto processor (external SLA) |
| Idempotency store | WTC Platform — `billing_webhook_events` table (migration 0003; UNIQUE provider+event_id; INSERT-on-conflict safe under concurrent delivery) |

---

## 2. Auth Method

### Stripe

- **Method:** HMAC-SHA256 signature in `stripe-signature` header.
- **Secret:** `STRIPE_WEBHOOK_SECRET` (`whsec_...`), stored in WTC secret vault, never in plaintext.
- **Verification:** `stripe.webhooks.constructEvent(rawBody, sig, secret)` — SDK enforces 300-second clock tolerance.
- **Failure action:** HTTP 400, no event processing, security alert written to `audit_logs`.

### Crypto provider

- **Method:** HMAC-SHA512 (or provider-specific algorithm) in provider signature header.
- **Secret:** `CRYPTO_WEBHOOK_SECRET`, stored in WTC secret vault.
- **Verification:** `crypto.timingSafeEqual(hmac(secret, rawBody), sig)`.
- **Failure action:** HTTP 400, no event processing, security alert written to `audit_logs`.

### Manual provider

- No webhook endpoint. Admin actions are authenticated via WTC session + RBAC (role: admin).

---

## 3. Endpoint Boundary

### Canonical endpoint (CURRENT — landed Phase 2.3)

```
POST /api/billing/webhook
```

**This is the single, unified webhook endpoint.** The provider is detected from the
signature header present in the request (`stripe-signature` → Stripe;
`x-nowpayments-sig` / `x-coingate-sig` → crypto). A single path is registered in
Stripe Dashboard and the crypto processor dashboard.

Previous form `/api/webhooks/billing/:provider` (with per-path variants
`/api/webhooks/billing/stripe` and `/api/webhooks/billing/crypto`) is superseded by
this single canonical path. See `PAYMENT_WEBHOOK_STATE_MACHINE.md §10` for the rationale.

**Implementation:** `apps/web/src/app/api/billing/webhook/route.ts` — EXISTS (landed Phase 2.3; uses `@wtc/billing` `createStripeProvider().parseWebhook` from Phase 2.1).

### Endpoint rules

- The endpoint is public (no session auth) — authentication is purely via signature verification.
- It MUST NOT be behind CSRF middleware (raw body must reach the handler unmodified).
  The Next.js middleware matcher must explicitly exclude `/api/billing/webhook`.
- It MUST be behind rate limiting (see §10).
- It MUST NOT be accessible through the CDN edge cache layer — direct origin only.
- It MUST be excluded from the general request logging middleware that logs request bodies
  (raw billing payloads may contain PII; log only event type and event ID).
- `POST /api/billing/webhook` with no recognizable signature header → HTTP 400, `unknown_provider`.

---

## 4. Request Schema

### Stripe

The request body is a raw JSON `Buffer`. The Stripe SDK deserializes it after signature verification.

Stripe `Event` object (post-verification) shape:

```typescript
{
  id: string;                          // evt_1OXxxx... — idempotency key
  type: string;                        // e.g., 'checkout.session.completed'
  created: number;                     // Unix timestamp
  livemode: boolean;
  data: {
    object: Record<string, unknown>;   // Stripe object (session, invoice, charge, subscription)
    previous_attributes?: Record<string, unknown>;
  };
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
}
```

Required metadata fields on all Stripe checkout sessions and subscriptions
(set by WTC when creating the session):

```typescript
metadata: {
  wtc_user_id: string;      // WTC user UUID
  wtc_plan_code: string;    // PlanCode enum value
  wtc_product_code: string; // ProductCode enum value (comma-joined for bundles)
}
```

If `wtc_user_id` is absent from metadata on a paid event, the webhook handler transitions to
`manual_review` and alerts admin. No entitlement is granted automatically.

### Crypto provider

Payload format varies by processor. The WTC adapter normalizes to:

```typescript
{
  payment_id: string;        // idempotency key
  payment_status: string;    // processor status string
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  actually_paid: number;     // actual amount received
  order_id: string;          // WTC checkout session ID
  order_description: string; // human-readable: 'wtc:userId:planCode:productCode'
  created_at: string;        // ISO8601
  updated_at: string;
}
```

The `order_id` must be a WTC-generated UUID stored in `subscriptions.provider_session_id`
at checkout creation time. The handler uses this to look up the user and plan.

---

## 5. Response Schema

All successful responses (including idempotent duplicates):

```
HTTP 200
Content-Type: application/json

{
  "received": true
}
```

Signature verification failure:

```
HTTP 400
Content-Type: application/json

{
  "error": "signature_invalid",
  "message": "Webhook signature verification failed"
}
```

Internal error (DB failure, unexpected exception):

```
HTTP 500
Content-Type: application/json

{
  "error": "internal_error",
  "message": "Webhook processing failed. Event will be retried."
}
```

**Note:** HTTP 500 is returned intentionally for transient errors so the provider retries.
HTTP 4xx is never returned for business logic errors (only for signature failure and bad payload shape).
Unknown event types return HTTP 200 (acknowledged but not processed).

---

## 6. Error Envelope

All error responses follow this envelope:

```typescript
{
  error: string;    // machine-readable code: 'signature_invalid' | 'internal_error' | 'bad_payload' | 'unknown_provider'
  message: string;  // human-readable description (never include secret values or stack traces)
}
```

Stack traces are written to server logs only. They are never included in HTTP responses.

---

## 7. Idempotency

- **Key:** `${providerName}:${eventId}` — e.g., `stripe:evt_1OXxxxxx`
- **Store (Phase 2.3 AS-BUILT — deprecated path):** `audit_logs` ledger — select-then-insert on
  `(action='billing.webhook_received', target_id=<eventId>)`. This approach has a concurrent-duplicate
  weakness: two simultaneous deliveries of the same event can both pass the SELECT check before either
  commits, resulting in double-processing. This is the current as-built state; it is being superseded by
  the Phase 2.4 durable store below.
- **Store (Phase 2.4 CURRENT — migration 0003):** `billing_webhook_events` table with UNIQUE
  `(provider, event_id)` constraint. The handler performs INSERT-then-detect-conflict (not
  select-then-insert): if the INSERT raises a unique-constraint violation, the event is a duplicate and
  the handler returns HTTP 200 immediately with no state change. This is the only safe approach under
  concurrent delivery. The `webhook_idempotency_keys` table name was an earlier design; the landed table
  is `billing_webhook_events`.
- **TTL:** 90 days
- **Behavior:** If INSERT on `billing_webhook_events` conflicts → HTTP 200, no state change, no further
  processing. INSERT is attempted only after signature verification. On HTTP 500 (processing error), the
  `billing_webhook_events` row is NOT committed (allows provider retry).

```sql
-- Table: billing_webhook_events (CURRENT — migration 0003; replaces audit_logs select-then-insert approach)
-- Group: Ops (billing bounded context)
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
provider      TEXT NOT NULL              -- 'stripe' | 'crypto'
event_id      TEXT NOT NULL              -- provider-assigned event ID, e.g. evt_1OXxxx
status        TEXT NOT NULL DEFAULT 'pending'
               -- CHECK (status IN ('pending','processed','failed','manual_review'))
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
processed_at  TIMESTAMPTZ               -- set when status transitions to processed/failed
meta          JSONB                      -- provider, eventType, userId, planCode (no secrets)
UNIQUE (provider, event_id)             -- the idempotency gate; INSERT-then-conflict is the safe pattern
```

Also: `billing_manual_review_items` (migration 0003) captures ambiguous/unresolvable webhook data
(missing userId, partial payments, unknown plan codes) for admin investigation. UNIQUE `(provider, event_id)`.
Schema:

```sql
-- Table: billing_manual_review_items (CURRENT — migration 0003)
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
provider      TEXT NOT NULL
event_id      TEXT NOT NULL
reason        TEXT NOT NULL              -- 'missing_user_id' | 'ambiguous_amount' | 'unknown_plan' | etc.
raw_event     JSONB NOT NULL             -- raw event payload (no secrets; stripped of API keys)
status        TEXT NOT NULL DEFAULT 'open'
               -- CHECK (status IN ('open','resolved','dismissed'))
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
resolved_at   TIMESTAMPTZ
resolved_by   UUID REFERENCES users(id)
resolution    TEXT
UNIQUE (provider, event_id)             -- one review item per event
```

**Hard rule:** Ambiguous or unresolvable webhook data MUST create a `billing_manual_review_items` row
and MUST NOT auto-grant any entitlement. Missing `userId`, unknown `planCode`, and partially-paid
amounts all route to manual review. The admin resolve/approve/reject path is the only path to clear
these items.

---

## 8. Covered Events

### Stripe events handled

| Event | Handler Action |
|---|---|
| `checkout.session.completed` | `pending_payment → active`; extract userId/planCode from metadata |
| `invoice.paid` | `active/grace/expired → active`; extend `valid_until` to `period_end` |
| `invoice.payment_failed` | `active → grace`; grace countdown starts |
| `invoice.payment_action_required` | `active → grace`; user notified to complete auth |
| `customer.subscription.updated` | Log change; no state transition (plan change or quantity) |
| `customer.subscription.deleted` | `active/grace → expired`; immediate if `cancel_at_period_end=false` |
| `charge.refunded` (full) | `active/grace/expired → refunded`; access cut immediately |
| `charge.refunded` (partial) | any → `manual_review`; admin notified |
| `charge.dispute.created` | any non-terminal → `chargeback`; access cut; admin notified |
| `charge.dispute.closed` | `chargeback → expired` (won) or `chargeback → refunded` (lost) |
| `payment_intent.payment_failed` | `pending_payment` cleanup (worker handles TTL) |
| `customer.subscription.trial_will_end` | Notification only; no state change |

### Stripe events explicitly ignored (no-op, HTTP 200)

- `customer.created`, `customer.updated`, `customer.deleted`
- `payment_method.attached`, `payment_method.detached`
- `invoice.created`, `invoice.updated`, `invoice.finalized`, `invoice.sent`
- `payout.*`
- Any event type not in the handled list above

### Crypto events handled

| Event | Handler Action |
|---|---|
| `payment_confirmed` | `pending_payment → active` (after min confirmations) |
| `payment_waiting` | `pending_payment` stays (idempotent); notification to user |
| `payment_expired` | Worker TTL cleanup; `pending_payment → none` |
| `payment_failed` | Worker TTL cleanup; `pending_payment → none` |
| `payment_partially_paid` | `pending_payment → manual_review`; admin notified |

---

## 9. Required Fields Summary

Every inbound webhook that triggers an entitlement change MUST produce the following
fields for the audit log entry:

```typescript
{
  billing_event_id: string;          // provider event ID
  billing_event_type: string;        // e.g., 'checkout.session.completed'
  billing_event_created_at: Date;    // provider timestamp
  provider: 'stripe' | 'crypto';
  user_id: string;                   // resolved from metadata or order_id lookup
  plan_code: string;                 // resolved from metadata or subscription
  product_code: string;              // resolved from metadata or subscription
  from_state: EntitlementState;
  to_state: EntitlementState;
  valid_from: Date;
  valid_until: Date | null;
  amount_cents?: number;             // for refund/chargeback events
  currency?: string;
  raw_event_id: string;              // stored for dispute resolution reference
}
```

If any required field cannot be resolved (e.g., `user_id` missing from metadata), the handler
MUST NOT guess. It transitions to `manual_review` and writes an alert with the raw event ID
for admin investigation.

---

## 10. Rate Limits

| Endpoint | Limit | Window | Response on breach |
|---|---|---|---|
| `POST /api/billing/webhook` | 300 req/min | per source IP | HTTP 429 |

Rate limits are applied by the reverse proxy (nginx) before the Next.js handler.
Stripe's IP ranges should be allowlisted to avoid false positives on burst delivery.
Current Stripe webhook IP ranges: https://stripe.com/files/ips/ips_webhooks.txt

Note: Previously two separate rate-limit entries existed (one per provider path). The
single canonical endpoint unifies these. The 300 req/min limit applies to all providers
on this path; if burst from the crypto processor is a concern, the limit can be
reduced to 60 req/min with the Stripe IP allowlist compensating for Stripe traffic.

---

## 11. Timeouts

| Phase | Timeout |
|---|---|
| Signature verification | < 10ms (sync, no I/O) |
| Idempotency store lookup | < 100ms |
| Entitlement DB transaction | < 2000ms |
| Total handler budget | < 5000ms |
| Provider delivery timeout (Stripe) | 30 seconds |
| Provider retry window (Stripe) | 72 hours (up to 3 days) |

If the handler takes > 5000ms, it risks the provider marking the delivery as failed and retrying.
If idempotency key is set, the retry is a safe no-op. If not yet set (failure during processing),
the retry re-runs the handler, which is the intended behavior.

---

## 12. Mock vs Real Status

| Provider | Current Status | Production Gate |
|---|---|---|
| Stripe | WEBHOOK RECEPTION REAL (Phase 2.3 route exists; `STRIPE_WEBHOOK_SECRET` required); test-mode checkout creation implemented; local signed replay preflight implemented; Stripe CLI/Dashboard replay and production key provisioning NOT RUN | All required tests passing + test-mode Stripe replay observed + production secrets/endpoints provisioned |
| Crypto | STUB (interface only; no processor selected) | Operator selects processor + configures keys |
| Manual | LIVE (admin grants use real DB; no external provider) | Already in use |

**Checkout creation status:** Stripe Checkout Session creation is implemented for test-mode only and is gated by
`BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY` starting with `sk_test_`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP`.
The local replay preflight added in Phase 3.39 does not call checkout creation or Stripe APIs; it signs local fixtures and
exercises the extracted webhook handler against disposable PGlite. Production Stripe remains blocked until operator-approved
test replay, production key provisioning, endpoint registration, and deployment acceptance are observed.

**Activation checklist for Stripe production wiring:**

- [ ] `STRIPE_SECRET_KEY` (live) stored in secret vault
- [ ] `STRIPE_WEBHOOK_SECRET` (live) stored in secret vault — REQUIRED for the webhook route to process any event
- [ ] All Stripe price IDs populated in `STRIPE_PRICE_MAP`
- [ ] Stripe webhook endpoint registered in Stripe Dashboard pointing to `POST /api/billing/webhook`
- [ ] Stripe CLI/Dashboard replay observed with scoped test-mode keys and redacted evidence
- [ ] Stripe IP allowlist configured in nginx
- [ ] All required tests below passing in CI (CI pipeline pending; today local gates pass)
- [ ] Admin confirms test checkout → active entitlement flow on staging with real Stripe test keys

---

## 13. Required Tests Before Production

| Test ID | Description | Type |
|---|---|---|
| BW-001 | Valid Stripe signature + `checkout.session.completed` → HTTP 200 + `pending_payment → active` | Integration |
| BW-002 | Tampered Stripe body → HTTP 400, no state change | Unit |
| BW-003 | Missing `stripe-signature` header → HTTP 400 | Unit |
| BW-004 | Duplicate `event.id` → HTTP 200, no state change | Unit |
| BW-005 | `invoice.paid` → `grace → active` (late renewal) | Unit |
| BW-006 | `invoice.payment_failed` → `active → grace` | Unit |
| BW-007 | `customer.subscription.deleted` → `active → expired` | Unit |
| BW-008 | `charge.refunded` (full) → `active → refunded` | Unit |
| BW-009 | `charge.refunded` (partial) → `active → manual_review` + admin alert | Unit |
| BW-010 | `charge.dispute.created` → `active → chargeback` + admin alert | Unit |
| BW-011 | `charge.dispute.closed` won → `chargeback → expired` | Unit |
| BW-012 | `charge.dispute.closed` lost → `chargeback → refunded` | Unit |
| BW-013 | Unknown event type → HTTP 200, logged, no state change | Unit |
| BW-014 | DB transaction failure → HTTP 500, idempotency key NOT stored | Unit |
| BW-015 | Missing `wtc_user_id` in metadata → `manual_review` + admin alert | Unit |
| BW-016 | `invoice.paid` arrives after `revoked` state → no state change, `manual_override_preserved` logged | Unit |
| BW-017 | Out-of-order `invoice.paid` after `charge.refunded` → no state change | Unit |
| BW-018 | Bundle plan paid → all member entitlements created atomically | Integration |
| BW-019 | Crypto `payment_partially_paid` → `manual_review` | Unit |
| BW-020 | Crypto `payment_confirmed` (underpayment) → `manual_review` | Unit |
| BW-021 | Rate limit breach → HTTP 429 | Integration (nginx) |
| BW-022 | End-to-end: Stripe test clock subscription lifecycle (monthly renewal × 3) | E2E (staging) |
| BW-023 | End-to-end: Stripe test chargeback flow | E2E (staging) |
| BW-024 | No `stripe-signature` and no crypto sig header → HTTP 400, `unknown_provider` | Unit |

Tests BW-001 through BW-021 and BW-024 must pass in CI before any production wiring.
Tests BW-022 and BW-023 must pass in staging with real Stripe test keys before go-live.

---

## 14. Admin Grant / Revoke Flow — Confirmed State and Gaps (Phase 2 — Part 9c)

### Confirmed existing flow

The admin entitlements flow at `apps/web/src/app/admin/entitlements/page.tsx` is LIVE (not a
stub). It provides:

1. `grantAction` server action: calls `grantProduct(userId, productCode)` after RBAC check
   (`assertAdmin`) and CSRF verification. Grants a product entitlement via the backend.
2. `revokeAction` server action: calls `revokeProduct(userId, productCode)` after RBAC and CSRF.
   Revokes a product entitlement.
3. Both actions call `revalidatePath('/admin/entitlements')` to refresh the view.
4. The page renders all users × their entitlements with effective status, grant form, and
   per-entitlement revoke button.

The `assertAdmin` check is applied inside each server action, not only in the layout. This is
correct — server actions are independently callable HTTP endpoints and must not rely on layout-level
auth alone.

Manual grants and revokes flow through `packages/entitlements` (via `grantProduct` /
`revokeProduct` in `lib/backend` → `lib/db-store` or `lib/demo`), and they write `audit_logs`
entries (confirmed by `audit` export in `lib/backend.ts`).

### Gaps identified

The following items are absent from the current admin grant/revoke implementation and are
required before this flow is considered complete for production:

**Gap 1 — FIXED (Phase 2.3):** `reason` field now required on both grant and revoke in
`apps/web/src/features/admin/schemas.ts` + `actions.ts`. `grantProduct(+reason?)` and
`revokeProduct(+reason?)` in `repositories.ts` accept and persist the reason. Gap closed.

**Gap 2 — FIXED (Phase 2.3):** `validUntil` date input added to the admin grant form.
`grantProduct(+validUntil?)` persists the expiry to `entitlements.expires_at` and
`product_access_events.valid_until`. Confirmed by ADM-2 PGlite test. Gap closed.

**Gap 3 — No `flag_review` / `manual_review` resolution action in admin UI (P2)**

The admin UI supports only grant and revoke. There is no action to transition to `manual_review`
or to resolve an existing `manual_review` entitlement (approve → `active` or reject → `revoked`).

Required: add "Flag for review", "Approve review", and "Reject review" actions to the admin
entitlements page.

**Gap 4 — No `plan_code` shown for admin grants (P3)**

The admin entitlements table renders product name + effective status but not the plan code.
For admin-granted entitlements, the plan code is always `admin_grant`, but for billing-
originated entitlements the plan code is informative. The billing page already shows plan codes.
The admin page should too.

**Gap 5 — CONFIRMED FIXED (Phase 2.1):** `grantProduct`/`revokeProduct` in `repositories.ts`
write `product_access_events` rows in-txn alongside `audit_logs`. Confirmed by PGlite integration
tests in `tests/integration/db-0002.test.ts`. Gap closed.

**Gap 6 — No bulk operations (P3)**

The current admin UI operates one user × one product at a time. No bulk grant or bulk revoke
is available. This is acceptable for MVP but should be noted as a known gap.

### Summary table

| Gap | Severity | Status | Notes |
|---|---|---|---|
| No `reason` field on grant/revoke | P1 | FIXED (Phase 2.3) | Required reason validated in schemas.ts + actions.ts |
| No `validUntil` on admin grants | P1 | FIXED (Phase 2.3) | Date input + grantProduct(validUntil?) wired |
| No `manual_review` flag/resolve actions | P2 | FIXED (Phase 2.4) | `billing_manual_review_items` in migration 0003; `/admin/entitlements/review` page with approve/reject/dismiss shipped |
| Plan code not shown in admin UI | P3 | OPEN | Low priority UX gap |
| `product_access_events` write not confirmed | P1 | FIXED (Phase 2.1) | Written in-txn by grantProduct/revokeProduct; confirmed by PGlite tests |
| No bulk operations | P3 | OPEN | Acceptable MVP gap |

---

## Related Documents

- [ENTITLEMENT_STATE_MACHINE.md](../ENTITLEMENT_STATE_MACHINE.md)
- [BILLING_PROVIDER_PLAN.md](../BILLING_PROVIDER_PLAN.md)
- [PAYMENT_WEBHOOK_STATE_MACHINE.md](../PAYMENT_WEBHOOK_STATE_MACHINE.md)
- [AUDIT_LOG_SCHEMA.md](../AUDIT_LOG_SCHEMA.md)
- [SECRET_VAULT_DESIGN.md](../SECRET_VAULT_DESIGN.md)
