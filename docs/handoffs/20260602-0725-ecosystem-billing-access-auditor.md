# ecosystem-billing-access-auditor handoff
## Scope
Phase 3.39 read-only billing/Stripe acceptance audit for a likely local Stripe webhook replay/preflight slice. Scope covered current billing provider code, Stripe webhook route/handler, entitlement transition and DB ledger boundaries, checkout UI/server action, env examples, deployment/status/blocker docs, package gates, and billing tests. No product code, docs, scripts, migrations, DB commands, server process, Stripe CLI command, live Stripe call, or production key provisioning was performed.

## Files inspected
- `AGENTS.md`
- `package.json`
- `.env.example`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/features/billing/plans.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/middleware.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/webhook.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/ENTITLEMENT_STATE_MACHINE.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`

## Files changed
`docs/handoffs/20260602-0725-ecosystem-billing-access-auditor.md` only. Product code/docs/tests/scripts were not edited.

## Findings
1. Severity: High. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:10`-`11` says B2 remains blocked because Stripe CLI/test webhook replay and production key provisioning are not run; `package.json:30`-`34` has opt-in LMS acceptance scripts and default gates, but no `accept:billing:*` or Stripe replay/preflight entry point; search found no `stripe listen`, `stripe trigger`, or billing preflight script outside narrative docs/tests. Recommendation: the smallest B2-moving slice is a dedicated opt-in local Stripe webhook replay/preflight command, for example `npm run accept:billing:stripe-webhook -- --dry-run|--local-signed|--stripe-cli`, explicitly excluded from `ci:local` and `scripts/gates.mjs`, that starts/targets a local app with a throwaway DB, posts signed Stripe test events to `POST /api/billing/webhook`, replays the same event ID, and emits redacted summary evidence. Target part: B2 local acceptance command.
2. Severity: High. Evidence: webhook reception is real and signature-first: `apps/web/src/features/billing/webhook-handler.ts:128`-`154` reads raw body, requires `stripe-signature`, requires `STRIPE_WEBHOOK_SECRET`, and rejects bad signatures before DB; `apps/web/src/app/api/billing/webhook/route.ts:4`-`10` documents raw-body/no-secret logging and ledger idempotency. Existing route tests cover missing/bad signature, valid apply, terminal duplicate, in-flight duplicate, stale processing, missing user, and unknown plan at `tests/integration/billing-webhook-route-handler.test.ts:104`-`216`, but they are PGlite/local signed Request tests, not Stripe CLI/dashboard replay against a running route. Recommendation: accept local B2 only after the new preflight proves the route boundary end-to-end through HTTP, not just handler calls. Target part: route-level acceptance evidence.
3. Severity: High. Evidence: `packages/db/src/schema.ts:814`-`838` defines `billing_webhook_events` with unique `(provider,event_id)`, TTL, and status fields; `apps/web/src/features/billing/webhook-handler.ts:170`-`196` inserts the ledger first and treats terminal duplicates as 200 no-ops while in-flight duplicates return retryable 500; `tests/integration/billing-webhook-route-handler.test.ts:123`-`139` proves duplicate terminal delivery does not write a second product-access event. Recommendation: the preflight must assert ledger-before-grant, first delivery applied, same-event replay 200/no-op after terminal status, in-flight duplicate retry semantics, and no entitlement mutation on signature failure. Target part: replay/idempotency controls.
4. Severity: High. Evidence: fail-closed access is explicit in `packages/entitlements/src/state-machine.ts:21`-`27`; `manual_review` is non-granting at `packages/entitlements/src/state-machine.ts:7`-`17`; missing user and unknown plan create manual review in `apps/web/src/features/billing/webhook-handler.ts:198`-`243`; the safe snapshot excludes raw provider payload and stores only id/type/planCode at `apps/web/src/features/billing/webhook-handler.ts:75`-`84`; tests assert pending review plus admin notification at `tests/integration/billing-webhook-route-handler.test.ts:191`-`216`. Recommendation: the B2 slice should include signed negative replay fixtures for missing `userId` and unknown/missing `planCode`, proving no access grant, a `billing_manual_review_items` row, and an admin notification. Target part: ambiguous webhook safety.
5. Severity: Medium. Evidence: Stripe checkout is already implemented as a real test-mode REST call: `packages/billing/src/stripe.ts:76`-`98` posts to `https://api.stripe.com/v1/checkout/sessions`; `apps/web/src/features/billing/checkout.ts:108`-`124` requires `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `sk_test_`, and a price map; `apps/web/src/app/(app)/app/billing/page.tsx:27`-`45` creates a pending-payment row only after session creation and redirects to Stripe. However `.env.example:101`-`105` and `docs/CONTRACTS/billing-webhooks.md:368`-`375` still say checkout creation is TARGET/not implemented. Recommendation: do not edit this in the audit lane, but make doc/env reconciliation part of the B2 slice so operators do not follow stale blockers. Target part: billing docs/env truth.
6. Severity: Medium. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:46`-`50` requires test-mode checkout with no live charge, explicit contact-us fallback, manual-review missing-user handling, and every webhook grant writing `billing_webhook_events` first; `apps/web/src/features/billing/checkout.ts:115`-`121` blocks non-test Stripe keys and empty price maps; `apps/web/src/app/(app)/app/billing/page.tsx:126`-`131` keeps mock checkout labeled and production-disabled. Recommendation: the production-readiness slice can move B2 without live production keys by requiring only Stripe test keys/CLI or local signed Stripe-shaped fixtures, while explicitly rejecting `sk_live_` in the local preflight and leaving live key provisioning as NOT RUN. Target part: no-live-key acceptance boundary.
7. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/billing/page.tsx:31`-`35` requires `DATABASE_URL` before starting Stripe checkout and creates `pending_payment` after session creation; `tests/integration/billing-checkout-phase34.test.ts:31`-`48` proves pending-payment does not grant access. Recommendation: any checkout+webhook preflight must use a disposable `wtc_test*` database or an isolated PGlite harness, generated user, generated plan, and cleanup/summary; it must not run against preview/prod DB because a failed replay can leave legitimate-looking pending rows. Target part: DB isolation and cleanup.
8. Severity: Medium. Evidence: docs claim duplicate insert conflicts return HTTP 200 immediately at `docs/CONTRACTS/billing-webhooks.md:216`-`218`, while current handler returns 500 for non-terminal duplicate rows and deletes stale processing rows before retry at `apps/web/src/features/billing/webhook-handler.ts:181`-`193`; route tests intentionally assert those 500 retryable paths at `tests/integration/billing-webhook-route-handler.test.ts:142`-`189`. Recommendation: the B2 slice should document and test the current conservative retry semantics instead of accepting against the stale contract sentence. Target part: contract/test alignment.
9. Severity: Low. Evidence: `packages/db/src/repositories.ts:2636`-`2668` still has legacy audit-log idempotency inside `applyStripeEvent`, despite the route now using `billing_webhook_events`; direct repository tests still exercise `applyStripeEvent` replay paths. Recommendation: do not use direct `applyStripeEvent` replay as B2 acceptance evidence; the acceptance target is the route handler/HTTP path that owns raw signature verification and durable ledger insertion. Target part: evidence boundary.

## Decisions
- Treat Phase 3.39 as read-only acceptance planning, not implementation or live acceptance.
- The smallest production-readiness slice that moves B2 without live production keys is a local/test-mode Stripe webhook replay preflight, not production key provisioning and not a full live payment rollout.
- Preflight shape should be dry-run-first and opt-in, similar to the existing LMS preflight pattern: no default gate wiring, no live production keys, explicit throwaway DB requirement, redacted summary artifacts only, and clear PASS/NOT RUN output.
- The route-level webhook path is the acceptance target. Package-level HMAC tests and direct repository replay tests are useful support evidence but not sufficient for B2.
- Keep entitlements as the only access source of truth. Checkout session creation may create `pending_payment`, but only a verified webhook or admin grant can activate access.

## Risks
- Running a checkout/replay preflight against a non-throwaway DB can leave pending-payment, subscription, ledger, notification, or manual-review records that look operationally real.
- Stale docs currently understate Stripe checkout implementation and overstate/alter duplicate conflict behavior; operators could either skip valid test-mode checkout or expect wrong replay results.
- PGlite tests prove most local behavior but do not prove a live server route, proxy raw-body preservation, Stripe CLI signing, or deployment webhook secret wiring.
- Production key provisioning remains a separate blocker after local/test B2 acceptance; passing local test-mode replay must not be reported as live production Stripe readiness.

## Verification/tests
- RUN: read-only source/doc/test inspection with `rg`, `Get-Content`, and targeted line-number review.
- RUN: repository status check attempted with `git status --short`; result was `fatal: not a git repository (or any of the parent directories): .git` from this working directory.
- NOT RUN: `npm test`; focused billing Vitest suites; `npm run check:core`; `npm run lint`; `npm run typecheck`; `npm run typecheck -w @wtc/web`; `npm run secret:scan`; `npm run governance:check`; `node scripts/gates.mjs full`; `npm run build -w @wtc/web`; Playwright/e2e; DB migrate/seed; local server; Stripe CLI; Stripe Dashboard replay; live/test Stripe network calls; production key provisioning.

## Next actions
1. Add a dedicated `accept:billing:stripe-webhook` script and preflight harness with `--dry-run`, `--local-signed`, and optional `--stripe-cli` modes. Keep it out of `ci:local`, `scripts/gates.mjs`, and Playwright defaults.
2. In dry-run, validate only configuration shape and refusal rules: no `sk_live_`, `STRIPE_WEBHOOK_SECRET` required for replay, disposable DB requirement for HTTP mode, redacted log root, no default live network.
3. In local signed HTTP mode, start/target a local app using a throwaway DB, create/generated user context, POST signed Stripe-shaped `checkout.session.completed`, replay the same `event.id`, and assert `billing_webhook_events`, entitlement, product-access events, subscription row, and no duplicate mutation.
4. Add negative replay cases: missing signature, bad signature, missing userId, unknown/missing planCode, in-flight duplicate, and stale processing retry behavior.
5. Add artifact/secret guard tests for the preflight output: no raw Stripe signature, webhook secret, secret key, Authorization header, raw provider payload, customer email, raw DB URL, session URL, or event body.
6. Reconcile `.env.example` and `docs/CONTRACTS/billing-webhooks.md` to current implementation: checkout creation exists but is test-mode-only; production key provisioning and Stripe CLI/dashboard replay remain NOT RUN.
7. After local/test B2 passes, keep production Stripe readiness blocked until production secret-vault entries, webhook endpoint registration, deployment raw-body verification, and operator-approved staging/live replay are observed.
