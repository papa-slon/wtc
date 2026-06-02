# Handoff: ecosystem-devops-implementer — Phase 2.3 Part 0 (nav/docs truth cleanup)

**Slug:** ecosystem-devops-implementer
**Timestamp:** 20260530-1145
**Wave:** Phase 2.3 visible-progress

---

## Scope

Nav truth cleanup and doc accuracy fixes across six owned files. No app source edited.
All changes are data/doc corrections; no logic changes.

---

## Files inspected

- `apps/web/src/lib/nav.ts` — ADMIN_NAV and TEACHER_NAV soon-flags
- `apps/web/src/lib/product-status.ts` — education status
- `docs/CONTRACTS/billing-webhooks.md` — §3 endpoint note, §7 idempotency
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` — §1 endpoint reference
- `docs/CONTRACTS/tradingview-access.md` — table presence + revokedAt/revokedBy claims
- `docs/INTEGRATION_MAP.md` — Axioma release-cache TTL
- `.env.example` — Stripe key documentation
- `packages/db/src/schema.ts` — confirmed tradingview_profiles + tradingview_access_grants presence
- `apps/web/src/app/admin/**/*.tsx` — confirmed which admin routes have real content
- `apps/web/src/app/teacher/**/*.tsx` — confirmed which teacher routes have real content
- `apps/web/src/app/api/billing/webhook/route.ts` — confirmed file exists

---

## Files changed

- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/product-status.ts`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/INTEGRATION_MAP.md`
- `.env.example`

---

## Findings

### nav.ts audit results

Teacher routes:
- `/teacher/courses` — page.tsx exists with real course list content (Phase 2.2). `soon:true` removed.
- `/teacher/students` — page.tsx exists with real student list content (Phase 2.2). `soon:true` removed.
- `/teacher/materials` — page.tsx is a `<Placeholder>` component with explicit note. `soon:true` kept.

Admin routes:
- `/admin/education` — page.tsx exists with real LMS admin content (`loadAdminEducation`, `adminEnrollAction`). `soon:true` removed.
- `/admin/support` — page.tsx exists. Added to ADMIN_NAV without `soon` flag. Was entirely missing from nav.
- `/admin/users` — page.tsx exists with real content (`loadAdminUsers`, assertAdmin). `soon:true` removed.
- `/admin/system-health` — page.tsx exists with real content (`loadSystemHealth`, assertAdmin). `soon:true` removed.
- `/admin/products` and `/admin/bots` — still marked `soon:true` (placeholder Placeholder components); kept.

### product-status.ts

`education` was `status:'planned'` with note `'LMS in progress'`. Changed to `status:'demo'` with
note matching the Phase 2.2 landing. All other products (`axioma_terminal`, `tortila_bot`,
`legacy_bot`, `tradingview_indicators`) remain accurate. `club` stays `planned`.

### billing-webhooks.md §3

The "does not yet exist" claim on the implementation target was stale. The route file at
`apps/web/src/app/api/billing/webhook/route.ts` was confirmed to exist (Phase 2.1 landing).
Corrected to "EXISTS (landed Phase 2.1)".

### billing-webhooks.md §7

The `webhook_idempotency_keys` table was documented as the live idempotency store but was never
created (not in any migration, not in schema.ts). The as-built store is the `audit_logs` ledger
with `action='billing.webhook_received'` and `target_id=<stripe event id>`. Updated §7 to document
both: AS-BUILT (`audit_logs` ledger) and TARGET (`webhook_idempotency_keys` table — future only).

### PAYMENT_WEBHOOK_STATE_MACHINE.md §1

§1 still referenced `POST /api/webhooks/billing/:provider` — the old per-provider form superseded
in Phase 2. Updated to `POST /api/billing/webhook` with a note pointing to §10 for rationale and
confirming the file exists.

### tradingview-access.md

Schema.ts audit (migration 0002):
- `tradingview_access_grants` EXISTS: id, requestId, userId, tvUsername, grantedAt, expiresAt,
  grantedBy, grantedByType, revokedAt, revokedBy, revokeReason, createdAt.
- `tradingview_profiles` EXISTS: id, userId, tvUsername, verifiedAt, currentGrantId, createdAt, updatedAt.
- `tradingview_access_requests` has `revokedAt` + `revokedBy` columns (additive nullable, migration 0002).

Three stale claims corrected:
1. "Tables TARGET (not implemented): tradingview_profiles + tradingview_access_grants" — changed to CURRENT.
2. "NOT PRESENT: revokedAt, revokedBy" in TvRequestDTO — replaced with accurate note that DB columns
   exist but are not yet surfaced in the DTO (TARGET to add).
3. Mock vs Real Status table rows for both tables — changed from TARGET to CURRENT with column lists.

### INTEGRATION_MAP.md

Axioma release-cache TTL was documented as "6 hours". Per axioma-bridge contract §5.4 / worker §15
the correct value is 10 min. Updated in-line in the Axioma touchpoint table.

### .env.example

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` had empty values with no indication they are optional.
Added a comment block noting they are OPTIONAL (only needed when `BILLING_PROVIDER=stripe`) and
replaced empty values with placeholder strings using the correct key prefixes (`sk_test_`, `whsec_`).
No real secrets present.

---

## Decisions

- `/admin/support` added to ADMIN_NAV without `soon:true` because `apps/web/src/app/admin/support/page.tsx`
  exists with real content.
- `/admin/users` and `/admin/system-health` had `soon:true` removed on the same basis (both have real pages).
- `/teacher/materials` kept `soon:true` because it renders a `<Placeholder>` explicitly saying it is planned.
- education product status promoted from `planned` to `demo` (not `available`) because the LMS is
  DB-backed but entitlement/billing wiring to production is not complete.
- Stripe env vars documented with test-key-shaped placeholders rather than empty strings so operators
  can distinguish the expected format; the comment makes clear these must never be real secrets.

---

## Risks

- None introduced. All edits are doc/data corrections with no logic impact.
- The `webhook_idempotency_keys` table being entirely absent from the schema is a future gap;
  the audit_logs ledger workaround is functional but should be confirmed in the billing-access-auditor's
  test coverage (BW-004).

---

## Verification/tests

```
npm run secret:scan   → exit 0 (clean, no output)
npm run typecheck -w @wtc/web   → exit 0 (no errors)
```

Both commands passed cleanly with no warnings or errors.

---

## Next actions

- billing-access-auditor: update test BW-004 (idempotency) to reflect the as-built audit_logs store
  rather than `webhook_idempotency_keys` table.
- tradingview-access-implementer: surface `revokedAt`/`revokedBy` from `tradingview_access_grants`
  in the admin queue UI (the DB columns exist; the DTO does not expose them yet).
- db-architect: when migration 0003 lands, consider creating `webhook_idempotency_keys` if the
  audit_logs approach proves insufficient under retry-storm load.
