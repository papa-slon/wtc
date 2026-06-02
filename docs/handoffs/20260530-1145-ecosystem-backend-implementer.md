## Scope

Phase 2.3 Part 1 — billing webhook receiver + billing timeline feature loader.

- Task A: `POST /api/billing/webhook` — verify-first, idempotent, audit-logged, CSRF-exempt Stripe webhook handler.
- Task B: `features/billing/timeline.ts` — server-only loader for product_access_events with two view shapes (user / admin).

No migration, no schema change, no new packages. All changes are additive new files inside the owned surface (`apps/web/src/app/api/billing/webhook/` and `apps/web/src/features/billing/`).

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — canonical decisions, RBAC, product codes
- `docs/DATA_MODEL.md` — `product_access_events` schema (actorId, actorType, fromState, toState, reason, createdAt)
- `packages/billing/src/{index.ts,stripe.ts,webhook.ts,provider.ts}` — exports: `createStripeProvider`, `mapProviderEvent`, `verifyWebhookSignature`; `parseWebhook` lives on the provider returned by `createStripeProvider`
- `packages/entitlements/src/{index.ts,registry.ts,state-machine.ts}` — `expandPlan`, `isProductCode`, `ProductCode`, `BillingEvent`
- `packages/config/src/env.ts` — `STRIPE_WEBHOOK_SECRET` is `z.string().optional()`; `STRIPE_SECRET_KEY` is `z.string().optional()`
- `apps/web/src/lib/server-config.ts` — existing typed-env helper (does not expose Stripe keys; accessed via `process.env` within the billing package itself)
- `apps/web/src/lib/backend.ts` — `getServerDb()` pattern: real Db when DATABASE_URL set, null in demo, throws fail-closed in production without DATABASE_URL
- `packages/db/src/repositories.ts` lines 808–961 — `listProductAccessEvents` (line 810), `applyStripeEvent` (line 932); signature: `(db, {stripeEventId, billingEvent, userId, productCodes, planCode?}, now?) => Promise<{applied:boolean; productsChanged:number}>`
- `packages/db/src/schema.ts` lines 495–513 — `productAccessEvents` table columns confirmed: `actorId` (uuid, nullable), `actorType` (text, not null), `fromState`, `toState`, `reason` (nullable), `createdAt`
- `apps/web/src/features/lms/queries.ts` and `features/support/data.ts` — established `features/*` pattern to follow
- `packages/db/src/index.ts` — `export * from './repositories.ts'` (all repos are re-exported)

## Files changed

- `apps/web/src/app/api/billing/webhook/route.ts` (NEW)
- `apps/web/src/features/billing/timeline.ts` (NEW)

## Findings

1. `createStripeProvider` from `@wtc/billing` returns a `BillingProvider` whose `parseWebhook(rawBody, sig, now)` performs HMAC verification internally via `verifyWebhookSignature` before JSON parsing — the verify-first contract is honoured at the library level.
2. `STRIPE_WEBHOOK_SECRET` is declared optional in `packages/config/src/env.ts`. The webhook handler reads it directly from `process.env.STRIPE_WEBHOOK_SECRET` (not via `loadEnv`) because `loadEnv` requires `DATABASE_URL` and other required env vars that may not be present in all environments; reading the optional Stripe key directly is the correct pattern here (the typed-env accessor is for app boot, not per-request optional-key lookup).
3. `applyStripeEvent` expects `billingEvent: BillingEvent` and `productCodes: ProductCode[]`. `mapProviderEvent` returns `BillingEvent | null`; `expandPlan` returns `ProductCode[]` by design. The route correctly guards both (no-op on null billingEvent, no-op on empty productCodes).
4. The dedupe ledger is the `audit_logs` table (`action='billing.webhook_received'`, `targetId=stripeEventId`). On failure the audit row is NOT written (the transaction rolls back), so Stripe's retry sees a fresh state and succeeds.
5. `listProductAccessEvents` accepts `{productCode?, limit?}` — both optional as documented.
6. `ProductAccessEventRow` confirmed from schema: `actorId` is `uuid` (nullable), `actorType` is `text` (not null), matching the `AdminTimelineEntry` shape.

## Decisions

- Webhook handler reads `process.env.STRIPE_WEBHOOK_SECRET` directly (not via `loadEnv`) because `loadEnv` enforces all required env keys including `DATABASE_URL`. The webhook route must survive in environments where only the Stripe secret is configured (e.g. a Stripe CLI test harness).
- No typed helper module created for the env lookup — keeping it inline in the route is consistent with how `botAdapterOptions()` reads `TORTILA_JOURNAL_BASE_URL` etc. in `server-config.ts`.
- `UserTimelineEntry` omits `actorId`/`actorType` (not just redacts them) — a future frontend cannot accidentally render them even if the object is serialized into a client component prop.
- Both loaders return `{mode:'demo', entries:[]}` when db is null — same pattern as `loadSupport`, `loadStudentCatalogue`, etc.
- No Vitest unit test file added for the timeline loader (pure I/O wrapper over a repo; repo unit tests are owned by `@wtc/db`). If a test is desired, the feature-layer pattern test would use a mock db.

## Risks

- The webhook handler silently no-ops (200) when `event.userId` is missing from the Stripe metadata. This is correct per spec (the event carries bad metadata, not a transient failure), but operators should ensure Checkout Sessions are created with `metadata.userId` set; otherwise events are acknowledged but produce no entitlement transition. This is documented in `docs/CONTRACTS/billing-webhooks.md` (owned by billing-access-auditor).
- `createStripeProvider` throws `BillingProviderNotConfiguredError` if `webhookSecret` is falsy. The handler checks for an empty `webhookSecret` before calling the factory, so this branch is unreachable in practice, but the try/catch around `parseWebhook` covers it defensively.
- No rate-limit on the webhook endpoint. Stripe signs every request; the HMAC check is O(n) on body length. For production, an upstream rate-limit (Cloudflare / nginx) is recommended as a future hardening step.

## Verification/tests

Self-verify commands run and results:

```
npm run typecheck -w @wtc/web   → clean (zero errors)
npm run build -w @wtc/web       → clean; /api/billing/webhook listed as ƒ (Dynamic) in route table
npm run secret:scan             → clean (zero findings)
```

## Next actions

- Frontend: `/app/billing` page should call `loadUserTimeline(userId, {limit:50})` (no server action needed — it is a loader). The admin `/admin/entitlements` page should call `loadAdminTimeline(userId, {limit:100})` with an RBAC guard at the page level.
- `docs/CONTRACTS/billing-webhooks.md` (billing-access-auditor) should document the `metadata.userId` + `metadata.planCode` requirement on Stripe Checkout Session creation so operators know what to configure.
- Once a Stripe account is provisioned, set `BILLING_PROVIDER=stripe`, `STRIPE_WEBHOOK_SECRET`, and optionally `STRIPE_SECRET_KEY`. The webhook will automatically activate (currently returns 400 when the secret is absent — honest and safe).
- Consider adding a Vitest integration test for the webhook route using `createMockBillingProvider.forgeWebhook` to produce a valid signed payload and verify the full path end-to-end without a real Stripe account.
