# ecosystem-security-auditor handoff
## Scope
Read-only security audit and implementation planning for epoch `20260601-1841`, focused on adding a direct route-level or extracted-handler Stripe webhook harness. The audit covered current route structure, safe DB/env injection for tests, terminal versus non-terminal duplicate behavior, stale `processing` cleanup, and exact tests to add. No source code, live Stripe, secrets, servers, DB migrations, or external services were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/tsconfig.json`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/webhook.ts`
- `packages/billing/package.json`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tsconfig.json`
- `tsconfig.base.json`
- `vitest.config.ts`
- `docs/CONTRACTS/billing-webhooks.md`

## Files changed
None - read-only audit

## Findings
1. MEDIUM - The current webhook route is test-hostile because it owns raw request reading, env lookup, DB acquisition, signature parsing, dedupe, manual-review side effects, subscription upsert, entitlement application, stale cleanup, and HTTP response construction in one `POST` function. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:110-327`. Recommendation: extract the processing body into a pure handler such as `apps/web/src/features/billing/stripe-webhook-handler.ts` with inputs `{ rawBody, signatureHeader, webhookSecret, db, nowMs, staleProcessingMs, deps? }`; keep `route.ts` as a thin Next adapter that reads `req.text()`, `process.env.STRIPE_WEBHOOK_SECRET`, and `getServerDb()`. Target part: route harness seam.

2. MEDIUM - A direct Vitest import of `route.ts` is brittle under the current test setup. Evidence: root Vitest includes only `packages/**/*.test.ts` and `tests/integration/**/*.test.ts` while excluding `apps/web/**` at `vitest.config.ts:8-9`; the route imports the Next app alias at `apps/web/src/app/api/billing/webhook/route.ts:29`; `apps/web/src/lib/backend.ts:1` imports `server-only`; and `apps/web/src/lib/backend.ts:20-24` chooses DB versus memory from `process.env.DATABASE_URL` at module load. Recommendation: prefer an extracted handler with explicit DB/env injection. If a true route-adapter test is later required, add a dedicated web test config or Vite aliases plus mocks for `@/lib/backend` and `server-only`; do not mutate global env after importing the route. Target part: test injection and route-level coverage.

3. HIGH - The phase 3.8 duplicate behavior is safer but is still not directly proven at HTTP/handler level. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:187-196` inserts a non-terminal `processing` row; `apps/web/src/app/api/billing/webhook/route.ts:198-213` returns HTTP 500 for duplicate rows that are absent or non-terminal, and HTTP 200 only for terminal statuses; `packages/db/src/repositories.ts:1418-1423` defines terminal statuses as `applied`, `no_op`, and `manual_review`. Existing coverage is indirect: `tests/integration/billing-webhook-hardening.test.ts:157-168` is a static source assertion and `tests/integration/billing-webhook-hardening.test.ts:170-191` exercises repository helpers, while `tests/integration/billing-webhook.test.ts:2-4` states route handlers are excluded. Recommendation: add handler tests that assert actual response status and DB effects for terminal duplicates, fresh non-terminal duplicates, and stale non-terminal duplicates. Target part: Stripe duplicate/retry safety.

4. HIGH - Stale `processing` cleanup exists but has no direct behavior test and needs an injected clock to be deterministic. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:50` sets a 10 minute stale window, and `apps/web/src/app/api/billing/webhook/route.ts:201-206` deletes a stale `processing` row before returning HTTP 500; `packages/db/src/schema.ts:722` sets `processedAt` with `defaultNow()`, and `packages/db/src/repositories.ts:1474-1485` updates status/products but does not expose a way to stamp `processedAt` for tests. Recommendation: make the extracted handler accept `nowMs` and `staleProcessingMs`; in the integration test, create a `processing` ledger row, update `processedAt` via `schema.billingWebhookEvents` to an old timestamp, call the handler, assert HTTP 500 plus row deletion, then call again and assert the event processes to `applied`. Target part: stale processing recovery.

5. MEDIUM - The safest handler seam should inject only runtime inputs, not secrets through globals, and should use the real PGlite DB for positive paths. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:119-140` already verifies the raw body before DB access; `apps/web/src/app/api/billing/webhook/route.ts:151-156` acknowledges honestly when `db` is null; `packages/billing/src/webhook.ts:12-44` provides fake signed bodies without Stripe network calls; `packages/db/src/client.ts:5-12` and current tests use repository-level DB injection. Recommendation: handler tests should pass `webhookSecret` and `db` explicitly, use `signWebhook()` for local HMAC bodies, and avoid setting real `STRIPE_*` or `DATABASE_URL`. Use dependency overrides only for fault injection such as `applyStripeEvent` throwing or ledger deletion failing. Target part: safe env/DB test harness.

6. MEDIUM - Route comments and billing contract text still describe older duplicate semantics and can mislead the harness implementer. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:13-15` says duplicate delivery returns 200; `docs/CONTRACTS/billing-webhooks.md:216-218` says conflicts return HTTP 200 and the ledger row is not committed on HTTP 500. Current code returns HTTP 500 for non-terminal duplicates and may commit a `processing` row until deletion/retry logic runs at `apps/web/src/app/api/billing/webhook/route.ts:198-213` and `apps/web/src/app/api/billing/webhook/route.ts:310-325`. Recommendation: after the handler harness lands, update route comments and contract docs to document terminal duplicate 200, non-terminal duplicate 500, and stale-processing cleanup. Target part: operator/security documentation.

## Decisions
- Recommend the extracted-handler harness over importing the full Next route directly. It proves route behavior while avoiding fragile `@/` alias, `server-only`, and module-load `DATABASE_URL` problems.
- Keep extraction inside the web app boundary, not inside `@wtc/billing`, because `@wtc/billing/package.json:15-17` currently has no `@wtc/db` dependency and the orchestration crosses billing, DB, entitlements, notifications, and web runtime concerns.
- The extracted handler should accept a real `Db | null`, `webhookSecret`, `nowMs`, and optional operation overrides. Production route code should pass `getServerDb()`, `process.env.STRIPE_WEBHOOK_SECRET`, and `Date.now()`.
- Tests should use fake local HMAC signatures from `signWebhook()` and PGlite migrations. No Stripe SDK/API, live webhook endpoint, real secret, live server, or migration change is needed for this harness.

## Risks
- If the handler injects too many mocked operations, the test can become another simulation instead of route behavior. Use real PGlite and real repository functions for all happy-path, duplicate, and manual-review cases; reserve mocks for failure windows that cannot be induced cleanly.
- If the handler remains in `apps/web`, root `npm test` can still import it from `tests/integration`, but web typecheck must also cover it via `npm run typecheck -w @wtc/web`.
- If a direct `route.ts` test is attempted without a dedicated config, importing `@/lib/backend` can capture stale env at module load and make test order matter.
- Returning HTTP 500 for non-terminal duplicates is the safer fail-retry behavior, but it must be documented so operators understand extra Stripe retries during an in-flight or stale webhook row.

## Verification/tests
Tests run in this audit: none. This was a read-only source audit and planning lane.

Exact implementation tests to add:
- `tests/integration/billing-webhook-route-handler.test.ts`
  1. `missing stripe-signature returns 400 and creates no ledger row`.
  2. `missing webhookSecret returns 400 and creates no ledger row`.
  3. `tampered signed body returns 400 and creates no ledger row`.
  4. `valid checkout.session.completed returns 200, writes applied ledger, grants entitlement, and writes one billing.webhook_received audit row`.
  5. `duplicate after terminal applied returns 200 and does not create a second product_access_events row`.
  6. `duplicate after terminal manual_review returns 200 and does not grant entitlement`.
  7. `duplicate while processing is fresh returns 500, leaves the processing row, and grants nothing`.
  8. `duplicate while processing is stale deletes the row, returns 500, and a later retry processes to applied`.
  9. `missing userId returns 200, creates manual_review item and notification, marks ledger manual_review, and grants nothing`.
  10. `unknown planCode returns 200, creates manual_review item and notification, marks ledger manual_review, and grants nothing`.
  11. `applyStripeEvent failure returns 500 and leaves the event retryable: row absent if delete succeeds; non-terminal or error if delete is deliberately mocked to fail; a duplicate must not return 200`.

Suggested focused commands after implementation:
- `npm test -- tests/integration/billing-webhook-route-handler.test.ts`
- `npm test -- tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook.test.ts`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `node scripts/gates.mjs full`

Gates not run:
- NOT RUN - real Stripe CLI/dashboard replay; no scoped test credentials were provided and live/external calls were out of scope.
- NOT RUN - live server or route endpoint calls; the lane was read-only and no server mutation was allowed.
- NOT RUN - DB migrations or real Postgres acceptance; the requested scope was planning for a harness, not schema or live DB changes.

## Next actions
1. Implement `apps/web/src/features/billing/stripe-webhook-handler.ts` with explicit `db`, `webhookSecret`, `nowMs`, `staleProcessingMs`, and minimal dependency override inputs.
2. Reduce `apps/web/src/app/api/billing/webhook/route.ts` to raw body/header reading plus handler invocation; preserve raw-body-first signature verification and no raw-body logging.
3. Add `tests/integration/billing-webhook-route-handler.test.ts` with the exact cases above using PGlite, `seedDatabase()`, and fake `signWebhook()` bodies.
4. After the tests pass, update `apps/web/src/app/api/billing/webhook/route.ts` comments and `docs/CONTRACTS/billing-webhooks.md` so terminal/non-terminal duplicate semantics match current code.
