# ecosystem-backend-implementer handoff
## Scope
Phase 3.39 read-only backend audit for a local Stripe webhook replay/preflight slice. Inspected the current Stripe webhook route boundary, `@wtc/billing` signature/event mapping, DB billing webhook ledger, entitlement state transitions, audit writes, focused tests, and existing acceptance/preflight script patterns. No product code, package code, tests, route handlers, scripts, env files, or status docs were changed.

Recommended narrow implementation boundary: add a local-only, dry-run-first Stripe webhook replay/preflight command that uses signed fixture events and the existing extracted handler against a disposable PGlite database by default, plus an optional explicit Stripe CLI/test-key mode later. It should not require production Stripe keys, should stay out of default gates, and should emit only redacted count/status evidence.

## Files inspected
- `AGENTS.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `packages/billing/src/index.ts`
- `packages/billing/src/stripe.ts`
- `packages/billing/src/webhook.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/entitlements/src/registry.ts`
- `packages/entitlements/src/engine.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `tests/integration/lms-external-scanner-live-preflight.test.ts`
- `scripts/gates.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `package.json`
- `.env.example`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260531-1500-billing-webhook-hardening.md`
- `docs/handoffs/20260602-0659-phase-3-38-lms-external-scanner-live-preflight.md`

## Files changed
None - read-only audit except this handoff:
- `docs/handoffs/20260602-0725-ecosystem-backend-implementer.md`

## Findings
1. Severity: High. There is no repo-native Stripe webhook replay/preflight command analogous to the existing LMS live preflight commands. Evidence: `package.json:30`-`package.json:31` exposes `accept:lms:object-storage` and `accept:lms:external-scanner`, but no `accept:billing:*` command; `scripts/gates.mjs:47`-`scripts/gates.mjs:52` has only default gate plans and no opt-in billing acceptance lane; `docs/PRODUCTION_BLOCKERS_CURRENT.md:11` keeps Stripe CLI/test webhook replay NOT RUN. Recommendation: add `scripts/billing-stripe-webhook-replay-preflight.mjs` plus `accept:billing:stripe-webhook`, defaulting to dry-run fixture replay with fake `whsec_` secret and disposable PGlite. Target part: acceptance/preflight command boundary.
2. Severity: High. The existing extracted handler is already the right implementation seam; duplicating route logic in a preflight would create drift. Evidence: `apps/web/src/app/api/billing/webhook/route.ts:17`-`apps/web/src/app/api/billing/webhook/route.ts:20` delegates the route to `handleBillingWebhookRequest`; `apps/web/src/features/billing/webhook-handler.ts:120`-`apps/web/src/features/billing/webhook-handler.ts:148` reads the raw body, requires `stripe-signature`, requires `STRIPE_WEBHOOK_SECRET`, and parses through `createStripeProvider`; `tests/integration/billing-webhook-route-handler.test.ts:1`-`tests/integration/billing-webhook-route-handler.test.ts:5` states that the harness executes signed `Request` objects through the same extracted handler and makes no Stripe network calls. Recommendation: the replay/preflight should call `handleBillingWebhookRequest` with injected env/db/log, not POST to a live server by default and not reimplement signature or entitlement logic. Target part: local replay harness.
3. Severity: High. Local replay can fully cover signature, idempotency, manual-review, entitlement, and audit behavior without production Stripe keys. Evidence: `packages/billing/src/webhook.ts:11`-`packages/billing/src/webhook.ts:44` provides local Stripe-style signing and verification with timestamp tolerance; `tests/integration/billing-webhook-route-handler.test.ts:104`-`tests/integration/billing-webhook-route-handler.test.ts:217` already proves missing/bad signatures, valid checkout application, duplicate terminal no-op, processing duplicate retry, stale-processing cleanup, missing-user manual review, and unknown-plan manual review; `packages/db/src/repositories.ts:2639`-`packages/db/src/repositories.ts:2667` applies verified events to entitlements and writes `billing.webhook_received` plus `product_access_events`. Recommendation: fixture replay should include valid checkout, duplicate delivery, invalid signature, missing user, unknown plan, refund, chargeback, and processing-stale scenarios, then assert durable rows and produce a redacted summary. Target part: fixture corpus and assertions.
4. Severity: Medium. The durable billing ledger and entitlement transition model are suitable for preflight assertions, but the command must report status precisely rather than treating any 200 as success. Evidence: `packages/db/src/schema.ts:814`-`packages/db/src/schema.ts:835` defines `billing_webhook_events` with statuses including `processing`, `applied`, `no_op`, `manual_review`, and `error` plus a unique `(provider,event_id)` index; `packages/db/src/repositories.ts:2682`-`packages/db/src/repositories.ts:2683` treats only `applied`, `no_op`, and `manual_review` as terminal; `apps/web/src/features/billing/webhook-handler.ts:181`-`apps/web/src/features/billing/webhook-handler.ts:195` returns retryable 500 for duplicate events still in non-terminal processing state. Recommendation: preflight success criteria must assert expected ledger terminal states, expected product access event counts, and expected entitlement status/access for each case. Target part: preflight result model.
5. Severity: Medium. The preflight should be a local/backend acceptance tool, not a production Stripe activation tool. Evidence: `packages/billing/src/stripe.ts:76`-`packages/billing/src/stripe.ts:97` makes real Stripe REST calls only for checkout creation when `STRIPE_SECRET_KEY` is provided; webhook parsing itself is local HMAC verification via `packages/billing/src/stripe.ts:99`-`packages/billing/src/stripe.ts:118`; `docs/STATUS.md:571`-`docs/STATUS.md:572` records real Stripe CLI webhook completion as NOT RUN after checkout work. Recommendation: avoid `STRIPE_SECRET_KEY`, production endpoint URLs, dashboard registration, or live server mutation in Phase 3.39; if live/test Stripe CLI replay is added later, gate it behind explicit `STRIPE_WEBHOOK_REPLAY_LIVE_ACCEPTANCE=1`, test-mode key checks, and operator-provided URL/secret. Target part: no-production-key boundary.
6. Severity: Medium. Existing logs and audit payloads are mostly metadata-only, but a replay artifact boundary is still needed. Evidence: route handler non-production logging prints only event id/type at `apps/web/src/features/billing/webhook-handler.ts:156`-`apps/web/src/features/billing/webhook-handler.ts:158`; manual review snapshots keep `{ id, type, planCode }` at `apps/web/src/features/billing/webhook-handler.ts:75`-`apps/web/src/features/billing/webhook-handler.ts:84`; audit rows for checkout and webhook receipt store provider/plan/event/user metadata at `packages/db/src/repositories.ts:2578`-`packages/db/src/repositories.ts:2585` and `packages/db/src/repositories.ts:2645`-`packages/db/src/repositories.ts:2647`. Recommendation: preflight artifacts should omit raw webhook bodies, `Stripe-Signature`, webhook secrets, checkout/session payloads, customer emails, provider refs, and raw Stripe error bodies; output only event labels, expected status, observed status, product counts, and redacted evidence paths. Target part: retained evidence/no-secret guard.
7. Severity: Low. The current handler silently acknowledges unmapped provider event types before inserting a ledger row. Evidence: `apps/web/src/features/billing/webhook-handler.ts:165`-`apps/web/src/features/billing/webhook-handler.ts:168` returns `{ received: true }` when `billingEventForProviderEvent(event)` is null; `packages/billing/src/webhook.ts:47`-`packages/billing/src/webhook.ts:68` defines the handled event map. Recommendation: include an unmapped-event fixture in the preflight and explicitly classify it as acknowledged/no-mutation, not as an applied webhook. Target part: reporting semantics.

## Decisions
- Keep Phase 3.39 implementation local-only: use generated signed fixture bodies and a fake webhook secret by default; no production Stripe keys, no production endpoint registration, no live server mutation.
- Reuse the extracted `handleBillingWebhookRequest` route seam and disposable DB setup already proven by `billing-webhook-route-handler.test.ts`.
- Put replay/preflight code in `scripts/` with a package script such as `accept:billing:stripe-webhook`; keep it out of `ci:local`, default `e2e`, and `scripts/gates.mjs`.
- Use a dedicated evidence root such as `logs/billing-stripe-webhook-preflight`; write redacted JSON/text summary only.
- Treat real Stripe CLI/test-mode webhook replay as a later opt-in mode, not required for the no-production-key local slice.

## Risks
- Local signed fixtures prove WTC's HMAC verification, route handling, DB transitions, and audit shape, but do not prove Stripe CLI forwarding, dashboard endpoint config, network reachability, or Stripe's exact live/test event payload variants.
- Current `upsertSubscription` failures are logged and do not fail the webhook application path (`apps/web/src/features/billing/webhook-handler.ts:251`-`apps/web/src/features/billing/webhook-handler.ts:265`); a local preflight may still pass entitlement assertions while subscription snapshot persistence is degraded unless it explicitly checks subscription rows for provider-ref cases.
- `applyStripeEvent` still uses `audit_logs` as its internal processed-event guard while the route uses `billing_webhook_events` as the durable delivery ledger (`packages/db/src/repositories.ts:2645`-`packages/db/src/repositories.ts:2647`, `packages/db/src/repositories.ts:2691`-`packages/db/src/repositories.ts:2728`). The command should inspect both ledgers to catch drift.
- Workspace is not git-backed in this environment (`git status --short` returned "fatal: not a git repository"), so this handoff cites current-tree evidence only and makes no branch/commit claims.

## Verification/tests
- Read-only audit only; no product tests or gates were run in this agent pass.
- `rg`/PowerShell source inspection was run over route handlers, `packages/billing`, `packages/db`, `packages/entitlements`, tests, scripts, and docs.
- `git status --short` - NOT RUN successfully because this workspace is not a git repository.
- NOT RUN: `npm test -- tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook-hardening.test.ts` because this phase asked for a read-only audit and no implementation verification.
- NOT RUN: Stripe CLI/dashboard webhook replay; no Stripe test keys, webhook forwarding URL, or operator approval were supplied.
- NOT RUN: real Postgres migrate/seed/harness; no throwaway Postgres credentials were supplied and local replay can use PGlite.
- NOT RUN: live server, live bot, exchange, Axioma, TradingView, LMS object-store/scanner live commands; out of scope.

## Next actions
1. Add `scripts/billing-stripe-webhook-replay-preflight.mjs` with `--dry-run` default and optional explicit `--live-test` refusal unless consent/test env is present.
2. Add `accept:billing:stripe-webhook` to `package.json`, and static tests proving it is absent from `ci:local`, default `e2e`, and `scripts/gates.mjs`.
3. Build the dry-run fixture corpus around `handleBillingWebhookRequest`: valid checkout, duplicate replay, invalid signature, missing user, unknown plan, refund, chargeback, unmapped event, processing duplicate, and stale processing row.
4. Assert `billing_webhook_events`, `audit_logs`, `product_access_events`, `entitlements`, `billing_manual_review_items`, `notifications`, and subscription rows where provider refs exist.
5. Write only redacted summaries under `logs/billing-stripe-webhook-preflight` and add/extend artifact scanning to reject `STRIPE_WEBHOOK_SECRET`, `whsec_`, `Stripe-Signature`, raw webhook JSON bodies, customer identifiers, provider refs, and raw Stripe error payloads in retained evidence.
6. After local dry-run is green, run Stripe CLI/test webhook replay only with operator-provided test-mode credentials and report it separately from local fixture replay.
