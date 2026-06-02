# ecosystem-axioma-bridge-auditor handoff

## Scope

Epoch `20260601-1814` read-only audit of Axioma bridge readiness honesty. Scope was limited to handoff token spec shape, JWKS status, terminal CTA disabled/enabled logic, token-in-query drift, implementation order, test evidence, and no-live-boundary notes.

No source code was edited. No live Axioma, bot, exchange, Stripe, TradingView, SSH, tmux, systemd, preview, or production endpoint was called.

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `docs/handoffs/20260601-1740-ecosystem-axioma-bridge-auditor.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `.env.example`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/server-config.ts`
- `packages/config/src/env.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed

None - read-only audit

## Findings

1. HIGH - The issued handoff token shape still does not match the binding token specification.
   Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:43-57` requires compact JWT with `alg: ES256`, `typ: JWT`, and a `kid`; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:60-96` requires Unix-second `iat/exp/nbf`, `wtc_flow`, `wtc_entitlement`, `wtc_axioma_user_id`, and a 32-byte nonce. Current claims are only `iss/aud/sub/ent/iat/exp/jti/nonce/purpose` in `packages/axioma-bridge/src/handoff.ts:18-28`; times are epoch-ms via `HANDOFF_TTL_MS` and `Date.now()` at `packages/axioma-bridge/src/handoff.ts:30` and `packages/axioma-bridge/src/handoff.ts:45-55`; the ES256 header emits `typ: WTC-HANDOFF` at `packages/axioma-bridge/src/es256.ts:37-39`. The active route issues that token at `apps/web/src/app/api/axioma/journal-handoff/route.ts:52-75`.
   Recommendation: Keep Axioma handoff activation disabled until the token builder emits the exact spec shape, including `typ: JWT`, Unix-second registered claims, `nbf`, `wtc_flow`, entitlement snapshot, linked Axioma user id/null, and spec nonce semantics. Add a decode-and-assert ES256 vector test against the route-level token before enablement.
   Target part: Axioma handoff token contract and `@wtc/axioma-bridge` signer payload.

2. HIGH - Token transport is inconsistent: current docs, UI copy, route code, package API, and tests disagree on whether the token may be placed in a URL query.
   Evidence: the spec sequence still returns `handoff_url: "https://axi-o.ma/wtc-handoff?token=<JWT>&nonce=<nonce>"` and sends `GET /wtc-handoff?token=<JWT>&nonce=<nonce>` at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:121-123`. The product contract says production Open Journal must never put a long-lived GET token in browser history at `docs/CONTRACTS/axioma-bridge.md:779-783`, and the terminal page repeats a POST/no-GET-history claim at `apps/web/src/app/(app)/app/terminal/page.tsx:202-205`. The route currently returns `{ postUrl, token, expiresAt, method: 'POST' }` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68-75`, but `createAxiomaBridge().createJournalHandoff()` returns `${base}/handoff?token=...` at `packages/axioma-bridge/src/bridge.ts:111-118`, and `packages/axioma-bridge/src/signer.test.ts:96-103` verifies the query-token URL path. The static route test only asserts the route source lacks `?token=` at `tests/integration/axioma-skeleton-static.test.ts:38-50`; it does not catch the package helper drift.
   Recommendation: Make a single product/security decision before activation. If the intended flow is POST body, update `AXIOMA_HANDOFF_TOKEN_SPEC.md`, `packages/axioma-bridge/src/bridge.ts`, and signer tests to remove query-token URLs. If Axioma requires a redirect/query handoff, change terminal copy and route semantics to be honest and add a URL-leak risk note.
   Target part: Open Journal transport contract, bridge helper API, and tests.

3. HIGH - Passing `routeSkeletonConfigured` can enable terminal CTAs that still do not perform real actions.
   Evidence: `bridgeActionsEnabled` is only `access.allowed && terminalData.routeSkeletonConfigured` at `apps/web/src/app/(app)/app/terminal/page.tsx:30`. The Download button has no `href`, form, or server action at `apps/web/src/app/(app)/app/terminal/page.tsx:162-170`; the Open Axioma Journal button is also inert at `apps/web/src/app/(app)/app/terminal/page.tsx:189-199`. The download route returns `bridge_not_implemented` with HTTP 501 after readiness passes at `apps/web/src/app/api/axioma/download/route.ts:29-40`. The journal route returns JSON but the terminal page has no action that calls it at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68-75`.
   Recommendation: Do not use `routeSkeletonConfigured` alone as CTA enablement. Split readiness into `routesConfigured`, `downloadActionReady`, and `journalActionReady`, or keep CTAs disabled until the page is wired to working actions with positive and negative e2e coverage.
   Target part: `/app/terminal` Download and Open Axioma Journal CTAs.

4. MEDIUM - JWKS status can show configured even when the public JWKS route still fails closed.
   Evidence: loader `jwksConfigured` is true when only `AXIOMA_HANDOFF_SIGNING_KEY` exists at `apps/web/src/features/terminal/loader.ts:41-42` and `apps/web/src/features/terminal/loader.ts:96-118`. The actual JWKS route requires both `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`, and also fails if signer construction throws, at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-27`. The central readiness helper also requires both key and key id at `apps/web/src/features/terminal/axioma-routes.ts:22-35`. The terminal page renders "configured" from loader state at `apps/web/src/app/(app)/app/terminal/page.tsx:208-220`.
   Recommendation: Derive UI JWKS state from the same check as the route: key + kid + parseable P-256 signer. Ideally expose a small server-side `resolveJwksReadiness()` helper used by both the route and loader.
   Target part: ES256/JWKS readiness honesty on `/app/terminal`.

5. MEDIUM - Production config still requires the HS256 dev-stub secret even though current real-deployment signing is ES256-only.
   Evidence: `packages/config/src/env.ts:68-75` correctly requires ES256 key material when `APP_ENV` is staging or production, but `packages/config/src/env.ts:89-95` still requires `AXIOMA_HANDOFF_SIGNING_SECRET` whenever `NODE_ENV=production`. The active route signer resolver passes `hs256Secret: undefined` at `apps/web/src/features/terminal/axioma-routes.ts:37-45`. The bridge signer fence forbids HS256 in staging/production at `packages/axioma-bridge/src/signer.ts:52-67`.
   Recommendation: Remove the production requirement for `AXIOMA_HANDOFF_SIGNING_SECRET` once ES256 is the only real-deployment signer path. Keep HS256 secret validation scoped to development/test flows that intentionally use the stub, and add a config test proving `NODE_ENV=production + APP_ENV=production + ES256 key/kid` passes without HS256.
   Target part: deployment config readiness and operator secret model.

6. MEDIUM - Contract status text is stale relative to the current skeleton routes and can mislead implementation sequencing.
   Evidence: contract status says Open-Journal, consume, and Download routes are unbuilt at `docs/CONTRACTS/axioma-bridge.md:6-9`. Current route files exist and fail closed: download route at `apps/web/src/app/api/axioma/download/route.ts:16-40`; journal handoff route at `apps/web/src/app/api/axioma/journal-handoff/route.ts:19-79`; JWKS route at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-27`.
   Recommendation: Update the contract in the implementation phase to say route skeletons exist and are fail-closed, while real Download/Open-Journal/OTC activation remains blocked. This is doc honesty only; it must not be used as activation evidence.
   Target part: `docs/CONTRACTS/axioma-bridge.md` readiness status.

7. INFO - The no-live and no-local-order-execution boundary remains preserved in inspected code and docs.
   Evidence: WTC never receives Axioma passwords/exchange keys and never gates local Axioma order execution at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:34-39`; the bridge contract repeats the hard boundary at `docs/CONTRACTS/axioma-bridge.md:32-39`; the terminal page renders the always-visible boundary at `apps/web/src/app/(app)/app/terminal/page.tsx:46-61`; the handoff module repeats that the token never gates local order execution at `packages/axioma-bridge/src/handoff.ts:10-12`.
   Recommendation: Keep this callout non-dismissible and include it in every Axioma CTA activation acceptance check.
   Target part: Product safety boundary.

## Decisions

- This audit is read-only. No source-code correction was applied.
- B4/Axioma activation remains not ready. ES256 primitives, JWKS skeleton, and JTI storage exist, but token shape, transport contract, real CTA wiring, JWKS readiness honesty, and config cleanup still block any production enablement claim.
- Entitlements remain the only WTC access source of truth for server-backed Axioma features.
- WTC must not become the runtime path for Axioma local order execution.

Implementation order for the next write phase:

1. Freeze activation: keep `AXIOMA_ROUTE_SKELETON_ENABLED=false` in real environments until the items below are complete.
2. Decide the Open Journal transport contract: POST body versus redirect/query. Update `AXIOMA_HANDOFF_TOKEN_SPEC.md`, `docs/CONTRACTS/axioma-bridge.md`, package API, route response, UI copy, and tests to one story.
3. Fix token shape and signer tests: `typ: JWT`, Unix-second `iat/exp/nbf`, `wtc_flow`, `wtc_entitlement`, `wtc_axioma_user_id`, and nonce semantics.
4. Align JWKS readiness helper and UI with route reality: key + kid + successful P-256 signer construction.
5. Split CTA enablement from skeleton readiness and wire real Download/Open-Journal actions before enabling buttons.
6. Remove stale production HS256 secret requirement after adding config tests for ES256-only production.

## Risks

- If `AXIOMA_ROUTE_SKELETON_ENABLED=true` is set with entitlement, DB, bridge token, and ES256 envs, `/app/terminal` can show enabled buttons that do not complete a download or journal handoff.
- Axioma may reject currently issued ES256 tokens because header, time units, and claim names diverge from `AXIOMA_HANDOFF_TOKEN_SPEC.md`.
- The query-token package helper can be accidentally reused even though the terminal product copy and route skeleton imply a POST/no-history handoff.
- Operators can see false-positive JWKS readiness if only the private key env var is set.
- Production deployers may provision an unused HS256 shared secret because config still requires it under `NODE_ENV=production`.

## Verification/tests

RUN:

- PASS - `npm test -- packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts`; Vitest reported 5 files passed, 37 tests passed, 1 skipped.

NOT RUN:

- Full `node scripts/gates.mjs full` - not run because this was a scoped read-only audit with no source edits.
- Playwright e2e - not run; no browser server was started and no CTA implementation was changed.
- Real JWKS HTTP request - not run; no server was started and no live route activation was in scope.
- Live `journal_server` endpoint-shape confirmation - not run; no live Axioma endpoint was called.
- Real installer/download streaming - not run; current route intentionally returns fail-closed/501.

## Next actions

1. Assign a write phase to fix Axioma contract drift before any activation flag change.
2. Add a package-level static or unit test that fails on `createJournalHandoff()` returning a URL containing `?token=`, if POST-body transport is the chosen product decision.
3. Add route-level ES256 decode tests that assert the exact `AXIOMA_HANDOFF_TOKEN_SPEC.md` payload and header.
4. Add JWKS readiness tests covering key-only, kid-only, invalid-key, and valid-key states.
5. Add e2e coverage for disabled CTAs and later for enabled CTAs only after real actions exist.
