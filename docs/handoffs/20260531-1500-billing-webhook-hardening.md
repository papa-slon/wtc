# billing-webhook-hardening handoff
## Scope
Billing webhook hardening only. Closed the Phase 3.4 follow-up where missing or unknown `planCode` could be acknowledged as a silent `no_op`, and aligned missing-user ledger status with the existing manual-review behavior. No checkout UI, seed/preview, Axioma, bot, admin product page, live Stripe, live server, live bot, or exchange work.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/billing/src/stripe.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `vitest.config.ts`
- `package.json`

## Files changed
- `apps/web/src/app/api/billing/webhook/route.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `docs/handoffs/20260531-1500-billing-webhook-hardening.md`

## Findings
1. HIGH - `apps/web/src/app/api/billing/webhook/route.ts` treated missing or unknown `planCode` as `no_op` after ledger insert, with no manual-review item or admin notification. Recommendation: route missing/unknown plan metadata into `billing_manual_review_items`, notify admins, keep productsChanged `0`, and mark `billing_webhook_events.status='manual_review'`. Target part: billing webhook route.
2. MEDIUM - The existing missing-user path created a manual-review item but finalized the webhook ledger as `no_op`, making the durable ledger understate the review state. Recommendation: use the same `manual_review` ledger status as the review queue. Target part: billing webhook route.

## Decisions
- Consolidated manual-review creation and admin notification into route-local helpers to keep the narrow behavior consistent for missing user, missing plan, and unknown plan.
- Kept notifications best-effort; the manual-review item plus `billing_webhook_events.status='manual_review'` are the durable signals.
- If manual-review item creation itself fails, delete the pre-inserted webhook ledger row and return 500 so Stripe can retry instead of permanently deduping an unreviewed event.
- Did not touch checkout UI, DB seed/preview, Axioma, bot/admin product pages, migrations, or Stripe network code.

## Risks
- Route handler direct execution remains indirectly covered because Vitest excludes `apps/web/**`; the new test combines signed fake webhook bodies, DB assertions, and static route guards. A future route-specific harness with module alias mocking would provide stronger direct HTTP coverage.
- Existing duplicate delivery semantics remain unchanged: duplicate webhook ledger rows return 200 and do not re-notify.

## Verification/tests
- `npx vitest run tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts` - PASS, 9 passed.
- `npm run typecheck -w @wtc/web -- --pretty false` - PASS.
- `npm run typecheck -- --pretty false` - PASS.
- `npm run lint -- --quiet` - PASS.
- `npm run check:core` - PASS.
- `npm run secret:scan` - PASS.
- `npm test` - PASS, 563 passed / 8 skipped (571), 53 files.
- NOT RUN: live Stripe dashboard/CLI/webhook delivery; no live Stripe calls allowed or needed.
- NOT RUN: real Postgres `db:migrate`, `db:seed`, real-PG harness; no throwaway `REAL_POSTGRES_DATABASE_URL` provided.
- NOT RUN: Playwright e2e/build/coverage/db:generate; out of scope for backend-only webhook hardening and no schema/UI changes.
- NOT RUN: governance check; this was a narrow per-agent handoff, not a new aggregate phase.
- NOT RUN: CI/git; workspace is not git-backed.

## Next actions
- Add a direct route-handler webhook harness if the app test setup later supports `@/` alias mocking cleanly.
- In the Stripe acceptance pass, replay real Stripe CLI test events for valid, missing-plan, unknown-plan, and missing-user metadata and confirm the admin review queue displays only the safe `{id,type,planCode}` snapshot.
