# ecosystem-axioma-bridge-auditor handoff
## Scope
Read-only Axioma bridge audit lane for phase epoch `20260601-1946`. Scope: audit local B4 progress possible after Phase 3.10 for `POST /api/axioma/journal-handoff`, including route-level signed claim honesty, linked/unlinked Axioma user id behavior, active/grace entitlement snapshots, POST-body/no-query-token behavior, signer/JWKS readiness, JTI lifecycle, and remaining live endpoint-shape blockers.

No source code, migrations, fixtures, product docs, live Axioma endpoints, external calls, servers, tests, preview-worker, SSH, tmux, systemd, bot, exchange, Stripe, or TradingView operations were run. The only write from this lane is this canonical handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`
- `docs/handoffs/20260601-1946-ecosystem-db-architect.md`
- `docs/handoffs/20260601-1946-ecosystem-security-auditor.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/INTEGRATION_MAP.md`
- `docs/TERMINAL_PRODUCT_AREA.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/entitlements/src/engine.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/server-config.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - The current `open_journal` route can issue a signed handoff with `wtc_axioma_user_id: null`, which contradicts the bridge contract's linked-account branch for opening the journal. Evidence: the route selects a linked row, but then passes `axiomaLink?.axiomaUserId ?? null` into the handoff with no denial when absent at `apps/web/src/app/api/axioma/journal-handoff/route.ts:67-78`; the contract says Open Journal first checks for an existing Axioma user id, issues only "If linked", and otherwise shows Connect Account at `docs/CONTRACTS/axioma-bridge.md:326-334`. Recommendation: split `open_journal` from `account_link` semantics in the handler; for `open_journal`, return a fail-closed `409 account_link_required` or `403 account_link_required` before signing/recording a JTI when no active linked Axioma user id exists. Keep nullable `wtc_axioma_user_id` only for an explicit account-link flow. Target part: `/api/axioma/journal-handoff` linked/unlinked behavior.

2. HIGH - The grace entitlement snapshot is likely semantically wrong because the route derives `expires_at` from `currentPeriodEnd`/`expiresAt` but ignores `graceUntil`. Evidence: `buildHandoffEntitlementSnapshot` uses the minimum of `currentPeriodEnd` and `expiresAt` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:32-40`; the entitlement engine grants grace when `currentPeriodEnd` has elapsed but `graceUntil` is still in the future at `packages/entitlements/src/engine.ts:74-82`; the token spec requires Axioma to verify `wtc_entitlement.state in {'active','grace'}` at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:257-260`. A grace user can therefore receive `state: "grace"` with an `expires_at` timestamp that is already past the paid period. Recommendation: define the grace snapshot explicitly before implementation: either set `expires_at` to the current granting window end (`graceUntil` for grace), add a `grace_until` claim, or document that `expires_at` is billing-period metadata only and cannot be used as the effective access expiry. Add route-level tests for active, active with manual expiry, and grace. Target part: signed entitlement claim honesty.

3. HIGH - Route-level acceptance is still indirect; static regex checks and package claim snapshots do not prove the actual Next route signs, persists, and responds correctly under active/grace, linked/unlinked, and failure conditions. Evidence: the route performs CSRF, auth, entitlement, readiness, link lookup, signing, JTI insert, audit write, and response construction at `apps/web/src/app/api/axioma/journal-handoff/route.ts:44-104`; the static suite checks source patterns only at `tests/integration/axioma-skeleton-static.test.ts:42-59`; the snapshot test proves `buildHandoffClaims` preserves supplied values, not that the route supplies correct values, at `tests/integration/axioma-handoff-snapshot.test.ts:17-52`; Phase 3.10 explicitly left journal-handoff issuance extraction unproven at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:86-88`. Recommendation: extract a request-level `handleAxiomaJournalHandoffRequest` with injected session, CSRF, access, DB, audit, env, signer, and clock. Test generated P-256 signing with PGlite, active/grace decisions, linked and no-link cases, all non-200 no-token responses, and token payload/JTI-row consistency. Target part: route-level signed claim and response proof.

4. HIGH - JTI issuance and issuance audit are not atomic, so a failure after `recordHandoffJti` can leave a live replay row without a matching issuance audit and without returning the token. Evidence: the route records the JTI at `apps/web/src/app/api/axioma/journal-handoff/route.ts:79-84`, then writes `axioma.account_link_init` audit at `apps/web/src/app/api/axioma/journal-handoff/route.ts:85-92`, and catches all errors as `503` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:102-104`; `recordHandoffJti` is a pure insert that leaves audit to the route at `packages/db/src/repositories.ts:1165-1178`. Recommendation: make issuance a single DB transaction before the handler returns success, for example a repository helper that inserts the JTI row and audit row together, with failure-injection tests proving rollback/no token on audit failure. Target part: JTI issuance lifecycle and audit truth.

5. MEDIUM - POST-body/no-query-token behavior is implemented in code, but the token spec still describes a nonce query parameter that conflicts with the current route shape and the no-query-token invariant. Evidence: the route returns `{ postUrl, token, expiresAt, method: 'POST' }` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:93-100`; `buildAxiomaHandoff` builds `postUrl` as `/wtc-handoff` without token query data at `apps/web/src/features/terminal/axioma-routes.ts:69-75`; static tests assert no redirect and no `?token=` at `tests/integration/axioma-skeleton-static.test.ts:42-58`. However, the spec says the handoff URL contains a nonce query parameter and that Axioma verifies the query nonce against the JWT nonce at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:183-193`, while `buildHandoffClaims` currently creates a random `nonce` claim only at `packages/axioma-bridge/src/handoff.ts:67-75`. Recommendation: update the contract/spec in the eventual docs phase to remove query-nonce requirements or replace them with an explicit POST-body nonce/form field; then test that `postUrl` has no query secrets and that the token nonce has a clear validation role. Target part: POST-body handoff contract and CSRF/nonce semantics.

6. MEDIUM - Signer/JWKS readiness is fail-closed, but route readiness still treats key and key-id presence as configured even when the key is unparsable. Evidence: `axiomaRouteReadiness` only checks `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` presence at `apps/web/src/features/terminal/axioma-routes.ts:23-35`; `resolveAxiomaRouteSigner` parses the key later at `apps/web/src/features/terminal/axioma-routes.ts:38-46`; the JWKS helper already has a parse-verified `signing_key_invalid` state at `apps/web/src/features/terminal/axioma-jwks-readiness.ts:11-23`; the public JWKS route returns 503/no-store when not configured at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-21`. Recommendation: make journal-handoff route readiness share the parse-verified JWKS/signer readiness, or return a precise `es256_key_invalid` blocker before any JTI/audit side effects. Target part: signer/JWKS readiness and operator diagnostics.

7. MEDIUM - Phase 3.10 completed the local Option A consume route, but live replay-model and endpoint-shape acceptance remain external blockers and cannot be inferred from local tests. Evidence: the consume handler requires POST, route flag, DB, non-empty bearer token, UUID body, no-store responses, and `consumeHandoffJti` at `apps/web/src/features/terminal/axioma-jti-consume.ts:65-102`; dynamic tests cover consume/replay/expired/revoked locally at `tests/integration/axioma-jti-consume-handler.test.ts:66-151`; `OPEN_QUESTIONS.md` still marks Option A versus Option B open and requires Axioma confirmation of model and auth envelope at `docs/OPEN_QUESTIONS.md:326-336`; `PRODUCTION_BLOCKERS_CURRENT.md` keeps B4 blocked on endpoint shapes, ES256 key provisioning, replay-model confirmation, OTC hash migration, and download security at `docs/PRODUCTION_BLOCKERS_CURRENT.md:10-15`. Recommendation: keep the local consume route as evidence only; do not enable browser CTAs or claim B4 complete until Axioma confirms `/wtc-handoff`, JWKS cache behavior, consume endpoint usage/auth, and download/account-link endpoint shapes. Target part: remaining live B4 acceptance.

8. INFO - Terminal CTAs are correctly still fail-closed after Phase 3.10 and should stay that way through this journal-handoff extraction. Evidence: loader returns `bridgeActionsImplemented: false` in both demo and DB modes at `apps/web/src/features/terminal/loader.ts:98-123`; the terminal page requires `access.allowed && terminalData.routeSkeletonConfigured && terminalData.bridgeActionsImplemented` before enabling actions at `apps/web/src/app/(app)/app/terminal/page.tsx:30-34`; Download and Open Journal controls are disabled when bridge actions are false at `apps/web/src/app/(app)/app/terminal/page.tsx:166-204`. Recommendation: keep `bridgeActionsImplemented` false until route-level journal-handoff tests, download-route security, account-link hash storage, live endpoint confirmation, and e2e browser action coverage are complete. Target part: `/app/terminal` activation gate.

## Decisions
- This lane remained read-only and wrote only this handoff.
- Treat Phase 3.10 local consume/JWKS work as real local progress, not production B4 acceptance.
- The next local implementation should be a journal-handoff handler extraction plus tests; it should not enable CTAs or perform live Axioma calls.
- `open_journal` should require a linked Axioma user id before signing unless the product owner explicitly redefines no-link Open Journal behavior.
- Grace entitlement claim semantics must be clarified before live Axioma validates `wtc_entitlement`.
- Preserve POST-body handoff delivery and do not reintroduce token-bearing query URLs.

## Risks
- A direct API caller could exercise `/api/axioma/journal-handoff` once route prerequisites are configured even while the UI button remains disabled.
- A no-link `open_journal` token may be accepted unpredictably by Axioma or fail after redirect, creating an unsafe product promise.
- Grace snapshots may be rejected by Axioma if `expires_at` is interpreted as the effective access expiry.
- Non-atomic JTI-plus-audit issuance can create orphan replay rows and weaken audit reconstruction.
- Presence-only signer readiness can make invalid key deployments look route-ready until signing time.
- Local WTC route tests cannot prove Axioma's live endpoint shape, service-token envelope, JWKS cache behavior, or download/account-link implementation.

## Verification/tests
RUN:
- Read-only inspection of the files listed above.
- Confirmed `docs/handoffs/20260601-1946-ecosystem-axioma-bridge-auditor.md` did not exist before writing.

NOT RUN:
- `npm test` - not run; read-only planning lane.
- `node scripts/gates.mjs full` - not run; no implementation change beyond this handoff.
- `npm run e2e` - not run; no server/UI mutation.
- Live Axioma, live JWKS HTTP checks, live download/consume acceptance, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service checks - explicitly out of scope.

Recommended focused gates after implementation:
- `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts`
- `npm run typecheck -w @wtc/web`
- `npm run typecheck`
- `npm run db:generate -w @wtc/db` should report no schema changes if the phase remains handler/test-only.
- `node scripts/gates.mjs full`

## Next actions
1. Extract `POST /api/axioma/journal-handoff` into an injectable request-level handler under `apps/web/src/features/terminal/`.
2. Add route-level PGlite/P-256 tests for CSRF, unauthenticated, denied states, active/grace success, linked versus unlinked behavior, invalid key readiness, token/JTI consistency, and all non-200 no-token responses.
3. Make JTI issuance plus `axioma.account_link_init` audit atomic before returning a token.
4. Clarify or fix grace entitlement `expires_at` semantics and no-link `open_journal` behavior before CTA activation.
5. Keep download proxy, account-link OTC hash migration, browser CTA enablement, and live Axioma endpoint-shape acceptance as separate B4 phases.
