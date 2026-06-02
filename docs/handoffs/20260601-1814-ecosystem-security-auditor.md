# ecosystem-security-auditor handoff
## Scope
Read-only security audit for epoch `20260601-1814`, focused on Stripe webhook idempotency and billing webhook route safety. The audit specifically checks the open blocker from the prior aggregate: the webhook ledger can be marked `applied` before entitlement mutation completes. No live Stripe, live server, DB migration, secret, SSH, bot, exchange, or preview service was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0003_fresh_blockbuster.sql`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/stripe.ts`
- `docs/CONTRACTS/billing-webhooks.md`
- `vitest.config.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/db-0003.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Duplicate Stripe deliveries can be acknowledged from an optimistic ledger state, not from a verified entitlement application state. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:180-197` inserts `billing_webhook_events` with `status: 'applied'` before any entitlement mutation and returns HTTP 200 for any duplicate. `apps/web/src/app/api/billing/webhook/route.ts:280-309` applies entitlements later and only then updates the ledger. `packages/db/src/repositories.ts:1431-1467` returns only `isDuplicate`/`rowId`, so the route does not know whether the existing row is terminal, partial, stale, or failed. Recommendation: insert the initial ledger row as non-terminal (`processing` or `received`), make duplicate handling status-aware, and only acknowledge duplicates when the existing row is terminal (`applied`, `manual_review`, or intentional `no_op`). Duplicates with non-terminal or error status should return HTTP 500 or enter an explicit recovery path so Stripe retries instead of suppressing a potentially unapplied event. Target part: billing webhook route plus `@wtc/db` webhook ledger helpers.

2. HIGH - The current delete-on-error fallback is not safe enough while the initial row says `applied`. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:293-309` tries to delete the ledger row after `applyStripeEvent` fails, but `apps/web/src/app/api/billing/webhook/route.ts:294-299` treats deletion failure as non-fatal. With the current optimistic `applied` status, a retry after failed deletion hits `apps/web/src/app/api/billing/webhook/route.ts:194-197` and is acknowledged without proving entitlement mutation finished. Recommendation: after this failure path, a persisted row must not look terminal unless the mutation committed. The smallest safe path is to use a non-terminal initial status and, if deletion fails, leave or stamp a non-terminal/error status that duplicate handling will not acknowledge as success. Target part: webhook failure/retry safety.

3. MEDIUM - Existing tests do not directly cover the Next route ordering or the crash/retry window. Evidence: `vitest.config.ts:8-9` excludes `apps/web/**`; `tests/integration/billing-webhook.test.ts:2-4` says route handlers themselves are excluded; `tests/integration/billing-webhook-hardening.test.ts:70-102` simulates a manual-review route path rather than invoking the route; `tests/integration/billing-webhook-hardening.test.ts:155-164` uses static source assertions. Recommendation: add a direct route-level or extracted-handler harness that injects a PGlite DB and a failing entitlement application path, then asserts: missing signature 400, bad signature 400, valid signed event 200 plus ledger/entitlement effects, duplicate after terminal `applied` 200/no second mutation, and duplicate while ledger is non-terminal/error 500 or recoverable retry rather than 200. Target part: signed webhook replay/harness.

4. MEDIUM - The schema/docs semantics are internally inconsistent with the route behavior. Evidence: `packages/db/src/schema.ts:716` and `packages/db/src/repositories.ts:1416-1418` define only terminal-looking statuses (`applied`, `no_op`, `manual_review`, `error`), while `packages/db/migrations/0003_fresh_blockbuster.sql:24` keeps the DB column as unconstrained text. `docs/CONTRACTS/billing-webhooks.md:216-218` says the ledger row is not committed on HTTP 500, but the route currently commits the row before mutation at `apps/web/src/app/api/billing/webhook/route.ts:180-192`. Recommendation: extend the TypeScript status model to include a non-terminal state without a migration, then update the billing webhook contract after implementation to match the actual terminal/non-terminal semantics. Target part: status model and operator docs.

## Decisions
- No implementation was performed; this handoff is the only file written.
- Route signature handling looks directionally correct for this scope: the route reads the raw body, checks `stripe-signature`, requires `STRIPE_WEBHOOK_SECRET`, and verifies with `createStripeProvider().parseWebhook` before DB access at `apps/web/src/app/api/billing/webhook/route.ts:106-140`.
- Development logging is limited to event id and type at `apps/web/src/app/api/billing/webhook/route.ts:142-145`; no raw body, signature, or secret logging was found in the inspected route.
- The smallest safe implementation should avoid a DB migration because `billing_webhook_events.status` is plain text in the migration. Use a TypeScript status expansion plus status-aware duplicate handling first.
- `packages/db/src/repositories.ts:1486-1497` already has `getWebhookEventByProviderEvent`; the route can use it, or `insertWebhookEventOnce` can return the existing row/status on duplicates.

## Risks
- A status-aware duplicate fix prevents false 200 acknowledgements, but a pure two-step route still has a crash window after entitlement commit and before ledger finalization. A stronger follow-up would move ledger claim, entitlement mutation, audit write, and final ledger status into one repository-owned transaction.
- A direct route harness may require factoring the post-verification processing out of `apps/web/src/app/api/billing/webhook/route.ts`, because current Vitest config excludes app tests and the route imports the Next app alias plus `server-only`.
- Real Stripe CLI replay and real Postgres cross-connection behavior remain unproven in this read-only pass.
- Returning HTTP 500 for non-terminal duplicates is safer than HTTP 200, but it can create extra Stripe retries until the original delivery reaches a terminal state or an operator recovery path clears stale rows.

## Verification/tests
Tests run in this audit: none. This was a read-only source audit and live Stripe, live servers, DB migrations, secrets, and external services were explicitly out of scope.

Exact tests to run after implementing the smallest safe path:
- `npm test -- tests/integration/billing-webhook-idempotency-status.test.ts`
- `npm test -- tests/integration/billing-webhook-route-handler.test.ts`
- `npm test -- tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/db-0003.test.ts`
- `npm run check:core`
- `npm run typecheck`
- `npm run lint`
- `node scripts/gates.mjs full`

Required new/updated regression assertions:
- First delivery creates a non-terminal ledger row before processing, not `applied`.
- Duplicate delivery with non-terminal/error ledger status is not acknowledged as successful.
- Duplicate delivery with terminal `applied` returns 200 and creates no second entitlement or product-access event.
- Injected entitlement failure does not leave an `applied` ledger row.
- Manual-review paths still finalize as `manual_review` and still create at most one review item/notification set.

## Next actions
1. Add a non-terminal webhook status in `packages/db/src/repositories.ts` and switch the route's initial insert from `applied` to that status.
2. Use `getWebhookEventByProviderEvent` or an enhanced `insertWebhookEventOnce` result so duplicate handling checks the existing status before choosing HTTP 200 versus retry/recovery.
3. Keep final updates explicit: valid application -> `applied`; missing user/unknown plan -> `manual_review`; unhandled event before ledger insert -> intentional 200 no-op.
4. Add the route/extracted-handler harness and repository status tests listed above.
5. After tests pass, update `docs/CONTRACTS/billing-webhooks.md` to document terminal versus non-terminal webhook ledger semantics.
