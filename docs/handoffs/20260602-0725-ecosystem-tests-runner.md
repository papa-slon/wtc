# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.39 test/gate audit for a local Stripe webhook replay/preflight slice. Reviewed existing billing tests, route-handler integration coverage, secret/artifact scan coverage, `scripts/gates.mjs`, and package scripts. No live Stripe calls were made.

## Files inspected
- `package.json`
- `packages/billing/package.json`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/__smoke__.ts`
- `packages/billing/src/stripe.test.ts`
- `packages/billing/src/provider.test.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/features/billing/checkout.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
`docs/handoffs/20260602-0725-ecosystem-tests-runner.md` only. Product code/docs: None - read-only audit.

## Findings
1. MEDIUM - There is strong local webhook-handler replay coverage, but no dedicated Stripe webhook preflight/replay command that produces retained, redacted evidence. Evidence: `package.json:30-31` only exposes LMS live preflight scripts; `scripts/gates.mjs:47-51` plans contain core/full/build/e2e gates but no Stripe preflight lane; `tests/integration/billing-webhook-route-handler.test.ts:123-188` proves valid delivery, terminal duplicate no-op, in-flight duplicate 500, and stale-row retry behavior only as Vitest assertions. Recommendation: add a local-only `accept:billing:stripe-webhook` dry-run script or documented gate that replays signed fixtures through the handler, writes redacted evidence, refuses live Stripe by default, and is explicitly excluded from default/full gates unless requested. Target part: billing preflight gate.

2. MEDIUM - Generated-artifact scanning is currently LMS/object-storage oriented and does not explicitly name Stripe webhook artifacts or Stripe-shaped secrets. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:12-71` forbids LMS storage fields, object-store tokens, cookies, bearer/basic auth, and DB URLs; there are no Stripe-specific markers for `stripe-signature`, `STRIPE_WEBHOOK_SECRET`, `whsec_`, `sk_test_`, `sk_live_`, provider raw body, or checkout session URLs. Recommendation: either extend this scanner with billing rules or create `scan-billing-webhook-artifacts.mjs` to reject raw Stripe bodies/signatures/secrets and provider payload dumps in retained preflight logs. Target part: artifact scan coverage.

3. MEDIUM - The route comments promise raw body/signature/secret/payload are never logged or stored, but tests primarily assert behavior and sanitized snapshots, not log/evidence redaction under failure paths. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:4-10` states the route never logs/stores/returns raw body, signature, secret, or payment payload; `apps/web/src/features/billing/webhook-handler.ts:157` logs only event id/type after verification; `apps/web/src/features/billing/webhook-handler.ts:203-212` and `apps/web/src/features/billing/webhook-handler.ts:229-242` handle manual review failures; `packages/db/src/repositories.ts:2775-2779` says manual-review `eventSnapshot` must not include `NormalizedEvent.raw` or secrets. Recommendation: add focused tests that inject a logger spy and failing repository path, then assert no raw body, `stripe-signature`, `whsec`, `sk_`, or full `event.raw` appears in logs/responses/manual-review snapshots. Target part: webhook redaction tests.

4. LOW - Existing billing coverage is split across package tests and integration tests, but there is no focused npm script for the exact local proof set. Evidence: `packages/billing/package.json:10-13` only defines `smoke` and broad `test`; `package.json:32-34` has `check:core` and `ci:local`, but no `test:billing` or `accept:billing:*`. Recommendation: add a narrow script such as `test:billing:webhook` covering `packages/billing/src/*.test.ts` plus `tests/integration/billing-webhook*.test.ts` and `tests/integration/billing-checkout-phase34.test.ts`, then make the Phase 3.39 acceptance command explicit. Target part: package scripts.

5. INFO - Current tests already cover the main non-live safety properties for the slice. Evidence: `packages/billing/src/stripe.test.ts:21-49` covers tamper/wrong-secret/out-of-tolerance/valid parse; `packages/billing/src/provider.test.ts:55-69` rejects live keys and requires webhook secret plus price map; `tests/integration/billing-webhook-route-handler.test.ts:105-120` rejects missing/invalid signatures before ledger writes; `tests/integration/billing-webhook-route-handler.test.ts:123-188` covers valid apply, duplicate terminal replay, in-flight duplicate retry, and stale processing cleanup; `tests/integration/billing-webhook-hardening.test.ts:117-190` covers manual-review and terminal-status behavior. Recommendation: keep these in the final proof set and add only the preflight/evidence scan gaps above. Target part: final acceptance gates.

## Decisions
1. Did not edit product code or product docs.
2. Did not run any live Stripe, Stripe CLI, checkout, object-store, scanner, or Playwright browser flow.
3. Treated the existing PGlite/Vitest billing route-handler tests as the current best local proof for replay/idempotency behavior.
4. Treated `npm run secret:scan` as the repo-level secret safety gate for this audit; it passed.

## Risks
1. Without a dedicated local Stripe replay/preflight command, final acceptance can pass unit/integration tests but still lack retained evidence that a preflight artifact stays redacted.
2. Without Stripe-specific artifact scan rules, a future preflight log could retain `stripe-signature`, `whsec_`, raw event JSON, checkout URLs, or API-key-shaped strings and still pass the LMS-oriented scanner.
3. Full `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, and real-Postgres/browser gates were not run in this lane, so this handoff does not claim whole-repo readiness.

## Verification/tests
RUN:
- `npx vitest run packages/billing/src/stripe.test.ts packages/billing/src/provider.test.ts tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-checkout-phase34.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS, 8 test files, 58 tests.
- `npm run secret:scan` - PASS.

NOT RUN:
- `node scripts/gates.mjs full` - skipped by scope; this was a focused read-only test/gate audit, not whole-repo acceptance.
- `node scripts/gates.mjs e2e` / `npm run e2e` - skipped by scope; Playwright browser flow is not needed to audit local webhook replay/preflight coverage.
- Stripe CLI or live Stripe webhook replay - skipped by scope and safety boundary; no live Stripe should be touched for this local slice.
- `accept:lms:object-storage` / `accept:lms:external-scanner` - skipped; unrelated live-preflight lanes.

## Next actions
1. Add a local-only Stripe webhook replay/preflight script that signs deterministic fixtures, calls the existing handler directly, exercises valid/duplicate/in-flight/stale/manual-review/bad-signature cases, and writes redacted evidence under `logs/billing-stripe-webhook-preflight/`.
2. Add Stripe-specific artifact scanning for retained webhook evidence, including `stripe-signature`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `whsec_`, `sk_test_`, `sk_live_`, raw provider event bodies, checkout URLs, and bearer/auth headers.
3. Add focused logger/response/snapshot redaction tests for failure paths.
4. Add a narrow `test:billing:webhook` or `accept:billing:stripe-webhook` package script so final acceptance can run a stable, explicit proof set without live Stripe.
5. Final gates for the slice after implementation: focused billing Vitest suite, new local Stripe preflight dry-run, new billing artifact scan, `npm run secret:scan`, then `node scripts/gates.mjs full`; run `node scripts/gates.mjs e2e` separately only if the phase owner requires browser proof.
