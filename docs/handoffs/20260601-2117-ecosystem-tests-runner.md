# ecosystem-tests-runner handoff
## Scope
Phase 3.14 read-only test plan for local Axioma account-link route handlers at epoch 20260601-2117. Target route scope: `/api/axioma/account-link/init`, service-auth completion, and unlink/revoke. This lane did not implement routes, did not run gates, and did not touch live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production services.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `scripts/gates.mjs`

## Files changed
None - read-only audit

## Findings
1. HIGH - Account-link HTTP handlers are the next unimplemented local Axioma surface. Evidence: Phase 3.13 explicitly deferred "Account-link HTTP route handlers" (`docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md:82`) and next actions call for init, completion service-auth envelope, and unlink/revoke (`docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md:93`). The contract still marks the bridge endpoints unchecked (`docs/CONTRACTS/axioma-bridge.md:1067`). Recommendation: add an extracted framework-neutral account-link handler plus thin Next route adapters, then cover those adapters statically. Target part: account-link route boundary.
2. HIGH - Init tests must prove CSRF/auth/entitlement/readiness order and hash-only OTC issue semantics. Evidence: contract flow says WTC generates a short-lived OTC, stores only `link_nonce_hash`, and shows the OTC once (`docs/CONTRACTS/axioma-bridge.md:388`, `docs/CONTRACTS/axioma-bridge.md:389`, `docs/CONTRACTS/axioma-bridge.md:390`); OTC properties require 32-byte randomness, 10-minute TTL, single use, user binding, and atomic consumed status (`docs/CONTRACTS/axioma-bridge.md:400`). DB issue already revokes prior pending rows and writes `axioma.account_link_init` without raw token material (`packages/db/src/repositories.ts:1109`). Recommendation: add focused handler tests for POST-only, CSRF-before-user, unauthenticated/denied/unconfigured fail-closed, raw OTC returned only once in a no-store body, hash-only DB/audit rows, prior pending revocation, and no query-string OTC. Target part: `/api/axioma/account-link/init`.
3. HIGH - Completion tests must treat Axioma completion as a service-auth JSON envelope and prove consume-before-side-effect safety. Evidence: the contract requires `POST /api/axioma/account-link/complete { code, axioma_user_id }` with service-auth envelope and no query params (`docs/CONTRACTS/axioma-bridge.md:394`), then validates OTC and marks it consumed (`docs/CONTRACTS/axioma-bridge.md:395`). Current service-auth precedent exists in the JTI consume handler tests for bearer rejection before consume (`tests/integration/axioma-jti-consume-handler.test.ts:62`) and JSON/body validation (`tests/integration/axioma-jti-consume-handler.test.ts:84`). DB consume reasons already cover not-found, consumed, revoked, expired, already-linked, duplicate Axioma user, and invalid Axioma user (`packages/db/src/repositories.ts:1079`). Recommendation: add tests for bearer missing/wrong before DB mutation, malformed JSON/body validation, no query-param code acceptance, success maps to `{ linked: true }`, replay/expired/revoked/invalid/duplicate cases map deterministically, and raw OTC/hash never appears in audit or responses. Target part: account-link completion route.
4. MEDIUM - Unlink/revoke route tests should reuse the existing revoke helper and preserve fail-closed browser semantics. Evidence: `revokeAxiomaAccountLinksForUserWithAudit()` revokes pending and linked rows in one transaction and writes `axioma.account_link_revoke` (`packages/db/src/repositories.ts:1278`); the audit action is registered as account-link revoked (`docs/AUDIT_LOG_SCHEMA.md:202`). Recommendation: add handler tests for POST-only, CSRF-before-user, unauthenticated/denied/unconfigured no side effects, linked and pending rows revoked with one audit row, repeat revoke maps to a deterministic empty/no-active-link result, and no Axioma live call. Target part: unlink/revoke route.
5. MEDIUM - Migration and repository coverage should be reused, not duplicated, but must stay in the focused Phase 3.14 gate. Evidence: `db-axioma-account-link.test.ts` already replays migration 0010 and checks hash-only columns/indexes (`tests/integration/db-axioma-account-link.test.ts:52`), hash-only issue and audit redaction (`tests/integration/db-axioma-account-link.test.ts:106`), canonical hash rejection (`tests/integration/db-axioma-account-link.test.ts:142`), once-only consume (`tests/integration/db-axioma-account-link.test.ts:156`), failure reasons (`tests/integration/db-axioma-account-link.test.ts:192`), and active-link uniqueness (`tests/integration/db-axioma-account-link.test.ts:251`). Recommendation: run this DB suite alongside new route-handler tests so route acceptance is backed by migration replay and repository behavior. Target part: focused test gate composition.
6. MEDIUM - Static tests need to grow from persistence-only account-link checks to route wiring checks. Evidence: current static skeleton tests assert hash-only account-link persistence and uniqueness (`tests/integration/axioma-skeleton-static.test.ts:79`) and terminal CTAs disabled (`tests/integration/axioma-skeleton-static.test.ts:107`), but there are no account-link route files yet. Recommendation: extend static coverage to assert `apps/web/src/app/api/axioma/account-link/*/route.ts` use the extracted handler, include no direct `fetch(`, use bearer/service-auth for completion, use CSRF for browser init/revoke, do not write `oneTimeCode`, do not expose `linkNonceHash`, send no-store responses, and keep CTAs disabled unless server-side readiness and future CTA gates pass. Target part: static route guard.
7. LOW - Full gate execution must keep the existing split between local full gates and Playwright e2e. Evidence: `scripts/gates.mjs` documents `e2e` as its own plan (`scripts/gates.mjs:43`) and defines `full` without e2e (`scripts/gates.mjs:50`) plus a separate `e2e` plan (`scripts/gates.mjs:52`). Recommendation: after implementation, run focused Vitest first, then typecheck/db-generate/governance, then `node scripts/gates.mjs full`, then env-cleared `node scripts/gates.mjs e2e`, then final governance. Target part: verification sequence.

## Decisions
- Do not create separate migration tests for Phase 3.14 unless implementation changes schema; reuse `tests/integration/db-axioma-account-link.test.ts` in the focused gate.
- Follow the current extracted-handler pattern used by download, journal-handoff, and JTI consume tests: injected DB/env/auth/access/clock/token generator dependencies and thin route adapters.
- Keep completion service-auth local-only with a configured bearer token and fixture-free JSON Request tests; no live Axioma endpoint is required for this phase.
- Keep browser CTA enablement out of Phase 3.14 route acceptance. Passing local handlers is necessary but not sufficient for production Axioma activation.

## Risks
- A route test that only checks success can miss raw OTC leakage; every success and failure path should assert DB/audit/response redaction.
- If completion accepts query parameters, the no-query OTC boundary in the bridge contract can regress without failing current DB tests.
- PGlite covers repository behavior and migration replay, but it does not prove a real-Postgres cross-connection race; keep that listed as NOT RUN unless throwaway credentials are provided.
- Enabling terminal CTAs from route-local green tests would overstate readiness because live endpoint shape, OP key, installer streaming, and browser acceptance remain outside this phase.

## Verification/tests
Performed in this read-only lane:
- Inspected protocol, current status/next actions, Phase 3.13 aggregate, DB account-link tests, existing Axioma handler tests, static skeleton tests, and gate runner.
- No npm, Vitest, Playwright, db-generate, build, or live-service gate was run in this read-only lane.

Planned focused gate after account-link route implementation:
- `npm test -- tests/integration/axioma-account-link-handler.test.ts tests/integration/db-axioma-account-link.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-journal-handoff-handler.test.ts`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run db:generate -w @wtc/db`
- `npm run governance:check`
- `node scripts/gates.mjs full`
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; node scripts/gates.mjs e2e`
- Final `npm run governance:check`

Focused handler/static tests to add:
- `tests/integration/axioma-account-link-handler.test.ts`: init CSRF/auth/entitlement/readiness; hash-only issue; prior pending revoke; complete service bearer/authz/body validation; once-only consume; all consume failure mappings; unlink/revoke side effects; no raw OTC/hash leakage; no live fetch.
- `tests/integration/axioma-skeleton-static.test.ts`: route-file existence and thin-adapter wiring; no direct live fetch; no `oneTimeCode` writes; no query-string OTC; no-store/static redaction guards; CTAs remain disabled.

Exact NOT RUN boundaries for Phase 3.14 unless separately scoped:
- Live Axioma endpoint-shape/JWKS/open-journal/download/OTC acceptance.
- Live Axioma installer streaming or service-account token exchange.
- Live Stripe checkout or webhook replay.
- Live TradingView automation.
- Live bot/exchange control.
- SSH, tmux, systemd, preview-worker, or production service mutation.
- Real-Postgres cross-connection account-link consume race without a fresh `wtc_test*` URL.
- Browser CTA enablement or e2e asserting connected terminal UI unless a later implementation explicitly enables those CTAs.

## Next actions
1. Implement extracted local account-link handler(s) and thin Next route adapters for init, completion, and unlink/revoke.
2. Add the focused handler/static tests above and run the planned focused gate before broader gates.
3. Keep B4 production activation blocked until live Axioma endpoint contracts, OP ES256 key provisioning, live consume/download/account-link acceptance, installer streaming, and CTA browser acceptance are observed green.
