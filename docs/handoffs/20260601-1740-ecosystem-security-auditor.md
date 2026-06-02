# ecosystem-security-auditor handoff
## Scope
Security audit for:
- No plaintext exchange secrets.
- RBAC, entitlement, and mutation flow.
- Audit redaction.
- Stripe safety.
- ES256, JWKS, and private key exposure.
- Disabled download and journal handoff routes.
- TradingView automation safety.

Constraints followed:
- Read-only audit of source and docs.
- No live server mutations.
- No source code edits.
- Created only this handoff file.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/AUDIT_LOG_SCHEMA.md
- docs/AXIOMA_HANDOFF_TOKEN_SPEC.md
- docs/TRADINGVIEW_ACCESS_PLAN.md
- .env.example
- scripts/safe-preview.mjs
- apps/web/src/app/(app)/app/billing/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/security/page.tsx
- apps/web/src/app/api/axioma/download/route.ts
- apps/web/src/app/api/axioma/journal-handoff/route.ts
- apps/web/src/app/api/billing/webhook/route.ts
- apps/web/src/app/api/bots/[bot]/config-export/route.ts
- apps/web/src/app/.well-known/axioma-jwks.json/route.ts
- apps/web/src/features/admin/actions.ts
- apps/web/src/features/billing/checkout.ts
- apps/web/src/features/bots/config.ts
- apps/web/src/features/lms/actions.ts
- apps/web/src/features/lms/guard.ts
- apps/web/src/features/terminal/axioma-routes.ts
- apps/web/src/features/tv/actions.ts
- apps/web/src/lib/csrf.tsx
- apps/web/src/lib/db-store.ts
- apps/web/src/lib/demo.ts
- apps/web/src/lib/session.ts
- apps/web/src/lib/vault.ts
- apps/web/src/middleware.ts
- apps/worker/src/jobs.ts
- packages/audit/src/redact.ts
- packages/auth/src/rbac.ts
- packages/auth/src/session.ts
- packages/axioma-bridge/src/bridge.ts
- packages/axioma-bridge/src/es256.ts
- packages/axioma-bridge/src/jwks.ts
- packages/axioma-bridge/src/signer.ts
- packages/billing/src/provider.ts
- packages/billing/src/stripe.ts
- packages/billing/src/webhook.ts
- packages/bot-adapters/src/control.ts
- packages/bot-adapters/src/factory.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/legacy/legacy-blocked.ts
- packages/config/src/env.ts
- packages/crypto/src/vault.ts
- packages/db/src/repositories.ts
- packages/db/src/schema.ts
- packages/entitlements/src/engine.ts
- packages/entitlements/src/state-machine.ts
- packages/shared/src/schemas.ts
- packages/tradingview-access/src/index.ts
- tests/integration/admin-ops-rbac.test.ts
- tests/integration/axioma-skeleton-static.test.ts
- tests/integration/billing-webhook-hardening.test.ts
- tests/integration/bot-config-export-static.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/csrf-coverage.test.ts
- tests/integration/tv-access-hardening.test.ts

## Files changed
None - read-only audit

## Findings
1. HIGH - Stripe webhook idempotency can acknowledge a duplicate event as already applied even when entitlement application did not finish.
   Evidence: apps/web/src/app/api/billing/webhook/route.ts:180-197 inserts the webhook ledger with status "applied" before the entitlement mutation runs. apps/web/src/app/api/billing/webhook/route.ts:280-309 applies entitlements later and then updates the ledger. packages/db/src/repositories.ts:1430-1461 treats a duplicate insert as "alreadyExists", and apps/web/src/app/api/billing/webhook/route.ts:193-197 returns success for that duplicate without checking whether entitlement application actually completed.
   Recommendation: introduce non-terminal statuses such as received/processing, make duplicate handling status-aware, and only return duplicate success for terminal applied/no_op/manual_review states. Prefer a single transaction or a recovery path that can safely resume application after a crash between ledger insert and entitlement mutation.
   Target part: Stripe webhook safety and entitlement idempotency.

2. MEDIUM - Billing webhook audit events attribute a system/webhook action to the customer user id.
   Evidence: packages/db/src/repositories.ts:1376-1404 applies Stripe events in a transaction, and packages/db/src/repositories.ts:1384 writes billing.webhook_received with actorUserId set to input.userId while actorRole is "system". docs/AUDIT_LOG_SCHEMA.md:31-35 defines actor_user_id as NULL for system, webhook, and background-job actors.
   Recommendation: write webhook audit events with actorUserId null and actorRole "webhook" or "system"; store the affected customer user id in target/after metadata. Add a regression test asserting webhook actor attribution follows the audit schema.
   Target part: Audit log correctness for billing webhooks.

3. MEDIUM - The exported Axioma bridge helper still constructs a token-bearing GET URL even though the app route uses the safer POST body flow.
   Evidence: packages/axioma-bridge/src/bridge.ts:111-117 returns `${base}/handoff?token=${encodeURIComponent(token)}`. apps/web/src/app/api/axioma/journal-handoff/route.ts:19-21 disables GET, apps/web/src/app/api/axioma/journal-handoff/route.ts:29-44 requires POST CSRF/user/entitlement checks, and apps/web/src/app/api/axioma/journal-handoff/route.ts:68-76 returns postUrl plus token in the response body after recording the JTI. docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:121-123 still documents a query-token redirect flow.
   Recommendation: remove the token-bearing URL helper or change its contract to the POST body model used by the web route. Update the token spec and add a static test forbidding `?token=` handoff URLs in exported bridge APIs and docs.
   Target part: Axioma handoff token exposure surface and spec drift.

4. LOW - TradingView automation is currently manual-only, but the flag naming is split between implemented config and design docs.
   Evidence: packages/config/src/env.ts:28-31 validates FEATURE_TV_AUTOMATION. scripts/safe-preview.mjs:10-15 forces FEATURE_TV_AUTOMATION=false for safe preview runs. packages/tradingview-access/src/index.ts:1-5 states the workflow is manual-first and automation is behind a flag. docs/TRADINGVIEW_ACCESS_PLAN.md:494-534 describes a future FEATURE_TV_AUTOMATION_ADAPTER path, while the inspected runtime has no active browser automation adapter.
   Recommendation: before adding any automation adapter, reconcile the flag names and keep automation disabled unless the adapter passes security audit, avoids credential stuffing, avoids plaintext credentials, and emits auditable manual-review-safe state transitions.
   Target part: TradingView automation safety and configuration contract.

## Decisions
- No inspected exchange-key path stores plaintext exchange secrets. apps/web/src/lib/db-store.ts:104-117 seals apiKey/apiSecret through getVault().seal before persistence; packages/db/src/schema.ts:108-126 separates non-secret account metadata from sealed exchange_api_key_secrets; packages/db/src/repositories.ts:187-204 persists sealed secrets and audits only keyMask/keyId; packages/db/src/repositories.ts:207-210 lists only exchange account metadata.
- Bot config export appears secret-safe. apps/web/src/features/bots/config.ts:32-65 defines bot config schemas without apiKey/apiSecret, and apps/web/src/features/bots/config.ts:339-366 exports only whitelisted safe config values with explicit comments that exchange keys are not included.
- RBAC and entitlement checks are present on inspected mutations. Admin mutations follow requireUser/assertAdmin/assertCsrf/Zod before repo writes in apps/web/src/features/admin/actions.ts:1-9 and apps/web/src/features/admin/actions.ts:27-253. TV grant/revoke/task actions require admin, CSRF, DB, and state guards in apps/web/src/features/tv/actions.ts:63-170. Axioma routes require user plus entitlement before returning any handoff data in apps/web/src/app/api/axioma/download/route.ts:16-33 and apps/web/src/app/api/axioma/journal-handoff/route.ts:29-50.
- Entitlements are fail-closed by design in the inspected engine. packages/entitlements/src/engine.ts:1-4 states entitlement is the only access source of truth; packages/entitlements/src/engine.ts:117-151 denies when no candidate grants access; packages/entitlements/src/state-machine.ts:21-26 limits granting states to active and grace.
- Audit redaction is broad and recursive. packages/audit/src/redact.ts:12-36 includes common secret key names such as apiKey, token, authorization, cookie, privateKey, sealed, and credentials; packages/audit/src/redact.ts:45-79 also redacts suspicious values and deep payloads. packages/db/src/repositories.ts:216-232 applies buildEvent before audit row insertion.
- ES256/JWKS handling does not expose private key material in the inspected route. packages/axioma-bridge/src/es256.ts:28-51 signs with ES256 and rejects public JWK export if private member d is present; packages/axioma-bridge/src/jwks.ts:12-13 builds JWKS only from signer.publicJwk(); apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-27 fails closed with 503 when ES256 key or kid is not configured.
- Disabled Axioma download route remains non-operative. apps/web/src/app/api/axioma/download/route.ts:16-41 requires user/entitlement/readiness and then returns 501 bridge_not_implemented without live download behavior.
- Live bot and TradingView automation controls remain disabled in inspected runtime paths. packages/bot-adapters/src/control.ts:16-18 requires both the feature flag and audit approval; packages/bot-adapters/src/http.ts:57-70 disables start/stop/applyConfig; packages/bot-adapters/src/legacy/legacy-blocked.ts:1-17 and packages/bot-adapters/src/legacy/legacy-blocked.ts:89-99 keep the legacy adapter blocked.

## Risks
- Finding 1 can cause payment webhook delivery to be acknowledged without the expected entitlement transition if the process fails between webhook ledger insert and entitlement application.
- Finding 2 weakens audit provenance by making a customer appear as the actor for a webhook/system action.
- Finding 3 is not used by the inspected app route, but exported package APIs and docs can reintroduce token-in-query behavior in downstream integrations.
- Finding 4 is not an active runtime vulnerability today, but inconsistent flag naming raises implementation risk when a future automation adapter is added.
- The workspace did not appear to be git-backed from this directory; `git status --short` returned `fatal: not a git repository (or any of the parent directories): .git`, so branch/dirty-state evidence could not be recorded.

## Verification/tests
Gates run this session:
- PASS - `npm run secret:scan`
- PASS - `npx vitest run tests/integration/axioma-skeleton-static.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/tv-access-hardening.test.ts tests/integration/csrf-coverage.test.ts tests/integration/admin-ops-rbac.test.ts tests/integration/bot-read-safety-static.test.ts`
- Result for targeted Vitest slice: 7 test files passed, 41 tests passed.
- PASS - Read-only source inspection for exchange-secret storage, RBAC/entitlement mutations, audit redaction, Stripe webhook handling, ES256/JWKS exposure, Axioma download/journal routes, bot control, and TradingView automation paths.

Gates not run this session:
- NOT RUN - `node scripts/gates.mjs full`; skipped because this was a targeted read-only security audit and full gates were outside the requested scope.
- NOT RUN - Playwright/browser E2E; skipped to avoid starting live app flows during this read-only audit.
- NOT RUN - Live Stripe CLI/webhook replay; skipped because live external mutation/replay was out of scope.
- NOT RUN - Live Axioma, TradingView, bot, exchange, or worker calls; skipped by the no-live-server-mutation constraint.
- NOT RUN - DB migration/seed or real Postgres mutation checks; skipped because they would mutate local or external state.

## Next actions
1. Fix Stripe webhook idempotency so duplicate acknowledgement is tied to a terminal, verified application state.
2. Correct billing webhook audit actor attribution to use a null actor user for webhook/system actors and record the affected user separately.
3. Remove or rewrite the Axioma bridge token-in-query helper and update the token spec to match the app's POST handoff route.
4. Reconcile TradingView automation flag naming before any browser automation adapter is implemented.
5. After fixes, rerun the targeted Vitest slice plus `npm run secret:scan`; then run `node scripts/gates.mjs full` in a separate verification session if broad release confidence is required.
