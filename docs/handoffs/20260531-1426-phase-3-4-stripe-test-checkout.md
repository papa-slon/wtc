# Phase 3.4 - Stripe test checkout + pending-payment chain

## Scope
Implement the commercial checkout spine for Stripe test mode without touching live bots, live exchange, live server, Axioma production bridge, or Stripe live charges.

## Governance
- 4 read-only auditors ran before implementation:
  - [docs/handoffs/20260531-1426-deploy-production-readiness-auditor.md](20260531-1426-deploy-production-readiness-auditor.md)
  - [docs/handoffs/20260531-1426-billing-commercial-auditor.md](20260531-1426-billing-commercial-auditor.md)
  - [docs/handoffs/20260531-1426-axioma-tv-auditor.md](20260531-1426-axioma-tv-auditor.md)
  - [docs/handoffs/20260531-1426-lms-bot-gap-auditor.md](20260531-1426-lms-bot-gap-auditor.md)
- Agents were closed after results were collected.
- Workspace is not git-backed; no commit/branch/PR/CI claims.
- No live server, SSH, bot, exchange, worker, live adapter, Stripe live charge, or Axioma production bridge was touched.

## Implemented
- `@wtc/billing` now creates real Stripe test-mode Checkout Sessions through Stripe REST when configured.
- `checkoutAvailability()` now has a true branch gated by `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP`.
- Stripe checkout request includes `client_reference_id`, WTC `userId`, WTC `planCode`, and subscription/payment metadata.
- `/app/billing` now renders a real "Start checkout" section. When configured, it redirects to Stripe test checkout; otherwise it stays on the manual support path.
- After a Checkout Session is created, WTC records `pending_payment` entitlements and product-access events. Access is not granted until a signed webhook transitions the entitlement.
- Audit action `billing.checkout_created` added.
- `.env.example` documents `STRIPE_PRICE_MAP`.

## Files changed
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/index.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/features/billing/plans.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `.env.example`
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/e2e/smoke.spec.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Findings
- Billing was the largest real commercial gap: the webhook existed but checkout creation was unavailable.
- Axioma and real-PG remain open production blockers.

## Decisions
- Use Stripe REST instead of adding the Stripe SDK dependency.
- Enforce test-mode keys (`sk_test_`) for this phase to avoid accidental live charges.
- Record `pending_payment` only after a Checkout Session is created; never grant access from checkout creation alone.

## Risks
- If the DB write fails after Stripe session creation, the user is not redirected and no payment is attempted from WTC.
- Webhook ledger robustness still has known follow-up work around unknown plan and crash/retry handling.

## Tests Added/Updated
- `packages/billing/src/provider.test.ts`
- `packages/billing/src/stripe.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/e2e/smoke.spec.ts` updated to tolerate the old/new dash rendering of the mock-checkout banner.

## Gates
- `npm run check:core`: PASS
- `npm run lint -- --quiet`: PASS
- `npm run typecheck -- --pretty false`: PASS
- `npm run typecheck -w @wtc/web -- --pretty false`: PASS
- `npm run secret:scan`: PASS
- `npm test`: PASS - 557 passed / 8 skipped (565), 51 files
- `npm run coverage`: PASS - 25.09% statements / 76.36% branch
- `npm run db:generate -w @wtc/db`: PASS - 41 tables, no schema changes
- `npm run build -w @wtc/web`: PASS - 48 dynamic app routes
- `CI=1 npx playwright test --reporter=list`: PASS - 42 passed / 2 flaky-green / 6 skipped / 0 failed

## Verification/tests
- Same as Gates above.

## Not Run / Still Blocked
- Real Postgres `db:migrate`, `db:seed`, and real-PG harness: NOT RUN, no throwaway `REAL_POSTGRES_DATABASE_URL`.
- Stripe real dashboard/CLI completion: NOT RUN, no real Stripe test price IDs or webhook secret provided.
- Axioma production bridge/download/open-journal: still B4/TARGET.
- Legacy live bot adapter: still blocked by upstream plaintext-key issue.
- CI remains inert because this checkout is not git-backed.

## Next actions
- Production readiness pass: seed idempotency + throwaway real-PG migrate/seed/harness.
- Stripe acceptance pass with real test price IDs and Stripe CLI webhook delivery.
- Axioma B4 route skeletons, still fail-closed.
- Bot safety wrapper hardening and admin products replacement.
