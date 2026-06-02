# ecosystem-security-auditor handoff
## Scope
Read-only Stripe/webhook/security audit for Phase 3.39 local Stripe webhook replay/preflight slice. Inspected webhook secret handling, signature verification, audit payloads, env examples, secret scanning, artifact/log risks, checkout code, middleware boundary, and recommended gates. No live Stripe call, live server mutation, live DB mutation, or product/docs edits were performed.

## Files inspected
- `AGENTS.md`
- `.env.example`
- `.secretlintignore`
- `.secretlintrc.json`
- `package.json`
- `scripts/gates.mjs`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/provider.test.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`

## Files changed
`docs/handoffs/20260602-0725-ecosystem-security-auditor.md` only. Product code/docs unchanged.

## Findings
1. Severity: High. Local webhook replay/preflight must avoid the checkout server action because it can make a real Stripe test-mode network mutation when configured. Evidence: `apps/web/src/app/(app)/app/billing/page.tsx:27`-`apps/web/src/app/(app)/app/billing/page.tsx:44` calls `createStripeCheckout`, records pending payment, then redirects to the returned session; `apps/web/src/features/billing/checkout.ts:108`-`apps/web/src/features/billing/checkout.ts:124` enables the path when `BILLING_PROVIDER=stripe`, both Stripe secrets exist, and the key starts with `sk_test_`; `packages/billing/src/stripe.ts:80`-`packages/billing/src/stripe.ts:89` POSTs to `https://api.stripe.com/v1/checkout/sessions`. Recommendation: Phase 3.39 replay/preflight should exercise only signed local webhook requests with fake/local secrets and mocked/PGlite dependencies; do not set a real `STRIPE_SECRET_KEY`, click checkout UI, or run any browser flow that can invoke `startStripeCheckout`. Target part: local Stripe replay/preflight procedure.
2. Severity: High. The webhook receiver is signature-first and uses the durable ledger before entitlement mutation, which is the correct replay boundary for this slice. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:4`-`apps/web/src/app/api/billing/webhook/route.ts:10` states raw body/signature/secret/payload are not logged or stored; `apps/web/src/features/billing/webhook-handler.ts:126`-`apps/web/src/features/billing/webhook-handler.ts:151` reads `req.text()`, requires `stripe-signature`, requires `STRIPE_WEBHOOK_SECRET`, and parses only through `createStripeProvider().parseWebhook`; `apps/web/src/features/billing/webhook-handler.ts:162`-`apps/web/src/features/billing/webhook-handler.ts:190` inserts `billing_webhook_events` before processing duplicates; `packages/db/src/schema.ts:814`-`packages/db/src/schema.ts:839` has the unique `(provider,event_id)` ledger. Recommendation: all replay tests should call `handleBillingWebhookRequest` or the route, not `applyStripeEvent` directly, when asserting duplicate/retry behavior. Target part: replay gate coverage.
3. Severity: Medium. Direct `applyStripeEvent` still contains the deprecated audit-ledger select-then-insert dedupe path, so it is not the concurrency-safe replay contract by itself. Evidence: `packages/db/src/repositories.ts:2636`-`packages/db/src/repositories.ts:2647` documents and implements replay detection by selecting `audit_logs` before insert; the current durable path lives separately at `packages/db/src/repositories.ts:2691`-`packages/db/src/repositories.ts:2728`. Recommendation: keep `applyStripeEvent` internal to the route flow for Stripe replay coverage, or add a guard/comment/test that direct callers must first acquire `billing_webhook_events`. Target part: repository boundary.
4. Severity: Medium. Invalid Stripe signature/missing-secret failures fail closed before DB writes, but they do not currently emit `billing.webhook_rejected` despite the action code and contract language. Evidence: `apps/web/src/features/billing/webhook-handler.ts:135`-`apps/web/src/features/billing/webhook-handler.ts:151` returns 400 before `db` is read; `packages/audit/src/audit.ts:53`-`packages/audit/src/audit.ts:55` reserves `billing.webhook_rejected`; `docs/CONTRACTS/billing-webhooks.md:29`-`docs/CONTRACTS/billing-webhooks.md:33` says signature failure writes a security alert. Recommendation: for this local slice, keep the no-state-write assertion on invalid signatures; before production activation, decide whether to add a low-cardinality rejection metric/audit that stores only reason class and no raw body/signature/header. Target part: webhook rejection observability.
5. Severity: Medium. Manual-review and audit payloads are intentionally narrow and currently avoid raw Stripe body/signature/secret material. Evidence: `apps/web/src/features/billing/webhook-handler.ts:70`-`apps/web/src/features/billing/webhook-handler.ts:77` writes `eventSnapshot` as only `{ id, type, planCode }`; `packages/db/src/repositories.ts:2774`-`packages/db/src/repositories.ts:2814` states `eventSnapshot` must exclude `NormalizedEvent.raw` and writes manual-review audit only with provider/eventId/reason; `packages/db/src/repositories.ts:2647` writes `billing.webhook_received` after payload as billingEvent/planCode/userId only; `packages/audit/src/redact.ts:12`-`packages/audit/src/redact.ts:36` and `packages/audit/src/redact.ts:45`-`packages/audit/src/redact.ts:62` cover secret-looking keys and values. Recommendation: add replay/preflight assertions that serialized audit rows, manual-review rows, stdout, and retained artifacts do not contain `STRIPE_WEBHOOK_SECRET`, `stripe-signature`, raw request body, `whsec_`, `sk_test_`, `sk_live_`, or checkout-session URLs. Target part: no-plaintext-secret gate.
6. Severity: Medium. `.env.example` contains active-looking Stripe placeholder assignments that secretlint allows, but they are still a copy/paste and artifact ambiguity for preflight logs. Evidence: `.env.example:101`-`.env.example:108` documents optional placeholders and sets `STRIPE_SECRET_KEY=sk_test_replace_with_your_stripe_test_key`, `STRIPE_WEBHOOK_SECRET=whsec_replace_with_your_stripe_webhook_secret`, and a JSON `STRIPE_PRICE_MAP`; `npm run secret:scan` passed this session. Recommendation: keep real secrets out of `.env.example`; for the next devops/security slice, prefer commented empty assignments or generated local-only `.env` instructions so retained preflight output cannot be mistaken for configured Stripe credentials. Target part: env template and retained evidence hygiene.
7. Severity: Low. Billing webhook contract docs have drift relative to the current Stripe-only route behavior and middleware boundary. Evidence: `docs/CONTRACTS/billing-webhooks.md:29`-`docs/CONTRACTS/billing-webhooks.md:33` references Stripe SDK `constructEvent` and rejection audit; `docs/CONTRACTS/billing-webhooks.md:104`-`docs/CONTRACTS/billing-webhooks.md:113` names metadata `wtc_user_id`/`wtc_plan_code`, while implementation extracts `userId`/`user_id`/`client_reference_id` and `planCode`/`plan_code` at `packages/billing/src/stripe.ts:112`-`packages/billing/src/stripe.ts:123`; `docs/CONTRACTS/billing-webhooks.md:71` says the endpoint must be rate limited, while `apps/web/src/middleware.ts:25`-`apps/web/src/middleware.ts:26` and `apps/web/src/middleware.ts:73`-`apps/web/src/middleware.ts:75` intentionally exclude it from middleware rate limiting. Recommendation: do not use the contract doc alone as preflight acceptance truth; update it in a docs-owned slice after Phase 3.39 implementation decisions settle. Target part: docs/current-state alignment.

## Decisions
- Treat Phase 3.39 as local replay/preflight only: signed fake Stripe payloads, fake webhook secret, PGlite or mocked dependencies, no live Stripe Dashboard registration, no real `STRIPE_SECRET_KEY`, no checkout-session creation, and no live server mutation.
- The route/handler path is the canonical replay target because it performs signature verification and durable ledger insertion before entitlement mutation.
- Invalid signature tests should continue to assert no ledger/entitlement/manual-review write for this slice. Rejection audit/metric can be a future production-observability decision as long as it remains secret-free.
- Retained evidence must be summary-only: operation, status, event id class/test id, terminal ledger status, productsChanged count, and gate result. Do not retain raw request bodies, `stripe-signature`, webhook secret, Stripe secret key, checkout session URL, full Stripe object, headers, stack traces, or `.env` contents with secrets.

## Risks
- If an operator sets `BILLING_PROVIDER=stripe`, a real `STRIPE_SECRET_KEY`, and a price map, the billing page can create a real Stripe test Checkout Session; that is outside read-only replay/preflight.
- The repo is not a Git working tree from this directory, so I could not use `git status` to separate unrelated local edits; I therefore avoided product file edits.
- Secretlint is useful but not enough for retained Stripe preflight artifacts; it does not replace a purpose-built artifact scanner that fails on Stripe signatures, `whsec_`, `sk_live_`, raw bodies, checkout URLs, HAR/trace files, or copied `.env` contents.
- Direct repository tests around `applyStripeEvent` can pass while bypassing the route's durable ledger, so replay acceptance must include route/handler-level tests.

## Verification/tests
RUN:
- `npm run secret:scan` -> PASS.
- `npx vitest run tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-checkout-phase34.test.ts packages/billing/src/stripe.test.ts packages/billing/src/provider.test.ts` -> PASS, 7 files, 44 tests.

NOT RUN:
- `node scripts/gates.mjs full` -> skipped because this lane is a narrow read-only security audit and the targeted billing/secret gates are the relevant local preflight subset.
- `node scripts/gates.mjs e2e` / Playwright -> skipped because browser checkout flows risk invoking non-read-only checkout behavior if Stripe env is configured, and e2e is not needed for local signed webhook replay.
- Live Stripe CLI replay / Stripe Dashboard webhook delivery / checkout-session creation -> skipped by scope; would be live provider mutation or network interaction.
- Live server/database preflight -> skipped by scope; no live server mutation during discovery.

## Next actions
1. Implement a dedicated local Stripe webhook replay/preflight harness that signs fixture payloads with a fake local `whsec_` value, calls `handleBillingWebhookRequest` against PGlite/mocks, and exits non-zero on missing-signature, bad-signature, stale-processing duplicate, terminal duplicate, missing-user manual review, unknown-plan manual review, and valid entitlement cases.
2. Add a retained-artifact scanner for Stripe preflight logs/evidence. Deny `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `sk_live_`, high-confidence `sk_test_`, `whsec_`, `stripe-signature`, raw JSON bodies containing Stripe `data.object`, `https://checkout.stripe`, Authorization headers, cookies, HAR/trace archives, and copied `.env` material.
3. Keep checkout session creation out of Phase 3.39. If checkout must be tested later, use a separate explicitly live/test-mode phase with mocked fetch by default, explicit operator consent for any real Stripe network call, and summary-only evidence.
4. Update `docs/CONTRACTS/billing-webhooks.md` in a docs-owned slice to match current implementation: local HMAC verifier vs SDK wording, metadata names, signature failure behavior, middleware/rate-limit boundary, and durable ledger terminal-status behavior.
5. Consider adding `billing.webhook_rejected` metric/audit in a future production-hardening slice, with no raw body, no signature header, no secret, and rate-limit/cardinality controls.
