# ecosystem-axioma-bridge-auditor handoff

## Scope

Workstream E read-only bridge audit for terminal/Axioma product content, `/app/terminal` room states, ES256/JWKS readiness, download and journal handoff routes staying disabled until gates pass, and the hard boundary that WTC never gates local Axioma order execution.

This auditor did not edit source code, did not mutate live services, and did not launch or leave any background agents running.

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/TERMINAL_PRODUCT_AREA.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/PROJECT_CHAT_HANDOFF_20260601.md`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/admin/terminal/page.tsx`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/lib/product-status.ts`
- `apps/web/src/features/cabinet/loader.ts`
- `apps/web/src/features/cabinet/CabinetProductCard.tsx`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0004_overconfident_frightful_four.sql`
- `packages/cabinet/src/derive.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `.env.example`
- `package.json`

## Files changed

None - read-only audit

## Findings

1. **HIGH - Journal handoff route can issue a token that does not match the binding handoff spec once readiness is flipped on.**
   - Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:43` says the token is JWT compact serialization; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:51-57` requires header `alg: ES256`, `typ: JWT`, and rejects HS256; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:90-96` requires Unix-second `iat/exp/nbf`, `wtc_flow`, `wtc_entitlement`, `wtc_axioma_user_id`, and a 32-byte nonce. The implementation claim shape is only `iss/aud/sub/ent/iat/exp/jti/nonce/purpose` in `packages/axioma-bridge/src/handoff.ts:18-28`; `HANDOFF_TTL_MS` is milliseconds at `packages/axioma-bridge/src/handoff.ts:30`; `buildHandoffClaims` writes `iat: now` and `exp: now + HANDOFF_TTL_MS` at `packages/axioma-bridge/src/handoff.ts:45-55`; ES256 header emits `typ: WTC-HANDOFF` at `packages/axioma-bridge/src/es256.ts:38`. The POST route issues this token with `buildAxiomaHandoff` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:52-75`.
   - Recommendation: Keep `/api/axioma/journal-handoff` operationally disabled until `buildHandoffClaims` is spec-shaped: JWT header `typ: JWT`, Unix-second time claims, `nbf`, `wtc_flow`, entitlement snapshot, linked Axioma user id/null, and nonce semantics matching the spec. Add a spec-vector test that decodes the issued ES256 token and asserts the exact payload contract before any production enablement.
   - Target part: PG6 Axioma journal handoff / ES256 token contract.

2. **HIGH - Passing the route-readiness gate would enable inert or nonfunctional `/app/terminal` CTAs.**
   - Evidence: `bridgeActionsEnabled` is `access.allowed && terminalData.routeSkeletonConfigured` at `apps/web/src/app/(app)/app/terminal/page.tsx:30`. The Download control is a plain button with no `form`, `href`, or server action at `apps/web/src/app/(app)/app/terminal/page.tsx:162-170`; Open Journal is also a plain button at `apps/web/src/app/(app)/app/terminal/page.tsx:189-199`. The download API still returns `bridge_not_implemented` with status 501 after readiness passes at `apps/web/src/app/api/axioma/download/route.ts:31-40`. The journal route returns JSON `{ postUrl, token, expiresAt, method }` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68-75`, but the terminal page has no form/action that consumes it.
   - Recommendation: Do not enable these CTAs solely on `routeSkeletonConfigured`. Either keep them disabled with blocker copy until the download route streams a real signed/proxied installer and the journal flow has a CSRF-backed POST/form handoff, or wire the page to real actions and add e2e coverage for enabled states.
   - Target part: `/app/terminal` Download and Open Axioma Journal room states.

3. **MEDIUM - The terminal room can report ES256/JWKS as configured when the live JWKS route still fails closed.**
   - Evidence: `loadTerminalRelease` sets `jwksConfigured` from only `AXIOMA_HANDOFF_SIGNING_KEY` at `apps/web/src/features/terminal/loader.ts:96`. The actual JWKS route requires both `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`, returning `jwks_not_configured` if either is absent at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:17-20`. The shared route-readiness helper also requires both at `apps/web/src/features/terminal/axioma-routes.ts:27-28`. The UI renders "configured" from `terminalData.jwksConfigured` at `apps/web/src/app/(app)/app/terminal/page.tsx:208-220`.
   - Recommendation: Derive the JWKS status from the same readiness requirement as the route, at minimum key plus key id, and ideally from a signer construction dry run. If either value is absent or the key cannot parse as P-256, the room should show fail-closed/not configured.
   - Target part: ES256/JWKS readiness indicator on `/app/terminal`.

4. **MEDIUM - Production config still requires the HS256 dev-stub secret even though production signing is ES256-only.**
   - Evidence: `packages/config/src/env.ts:89-94` requires `AXIOMA_HANDOFF_SIGNING_SECRET` in `NODE_ENV=production`. The active route signer resolver passes `hs256Secret: undefined` at `apps/web/src/features/terminal/axioma-routes.ts:37-45`. The bridge signer fence throws in staging/production unless ES256 key material is present at `packages/axioma-bridge/src/signer.ts:57-67`, and uses HS256 only for non-real deployments with an explicit secret at `packages/axioma-bridge/src/signer.ts:63-66`.
   - Recommendation: Stop requiring `AXIOMA_HANDOFF_SIGNING_SECRET` for production when ES256 is the production path. Require or allow it only for development/test HS256 stub use, and add a config test for `NODE_ENV=production`, `APP_ENV=production`, ES256 key and kid present, HS256 secret absent.
   - Target part: `@wtc/config` Axioma env validation / deployment readiness.

5. **MEDIUM - Placeholder/degraded copy is tied too narrowly to the bridge token and contains stale route text.**
   - Evidence: `axiomaBridgeIsDev()` only checks for missing `AXIOMA_BRIDGE_API_TOKEN` at `apps/web/src/lib/server-config.ts:21-23`, while `axiomaRouteReadiness` also blocks on `AXIOMA_ROUTE_SKELETON_ENABLED`, DB availability, ES256 key/kid, and journal base URL at `apps/web/src/features/terminal/axioma-routes.ts:22-35`. The dev banner appears only when `isDev` is true at `apps/web/src/app/(app)/app/terminal/page.tsx:72-79`. The Download/Open Journal tooltips still say the `/api/axioma/download` proxy "does not exist" at `apps/web/src/app/(app)/app/terminal/page.tsx:167` and `apps/web/src/app/(app)/app/terminal/page.tsx:193`, but the fail-closed route exists at `apps/web/src/app/api/axioma/download/route.ts:16-40`.
   - Recommendation: Make the banner and tooltip copy reflect `routeBlockers`, not only missing bridge token. Replace "proxy does not exist" with "route exists but is fail-closed/not configured" until all blockers clear.
   - Target part: Terminal product content and degraded-state honesty.

6. **INFO - The "WTC never gates local order execution" boundary is preserved in the inspected surfaces.**
   - Evidence: `docs/ARCHITECTURE.md:31` states WTC never executes orders or becomes the runtime path for Axioma local order execution. `docs/PRODUCT_BRIEF.md:75` and `docs/PRODUCT_BRIEF.md:260` repeat that live order execution stays outside WTC. The terminal page renders the always-visible boundary callout at `apps/web/src/app/(app)/app/terminal/page.tsx:46-61`, including the exact local-order message at `apps/web/src/app/(app)/app/terminal/page.tsx:55-59`. The admin terminal page states release metadata does not enable local order gating at `apps/web/src/app/admin/terminal/page.tsx:74-78`. The handoff token module states it gates server-backed Axioma features only and never local Axioma order execution at `packages/axioma-bridge/src/handoff.ts:10-12`.
   - Recommendation: Keep this callout non-dismissible and include it as an acceptance check whenever Axioma CTAs move from disabled to enabled.
   - Target part: Product boundary / local execution safety.

## Decisions

- B4 remains open. ES256/JWKS primitives and the JTI store exist, but real Download/Open Journal/OTC activation is still blocked by endpoint-shape confirmation, installer/download security, spec-shaped token issuance, and frontend action wiring.
- Entitlements remain the only WTC access source for server-backed Axioma features. WTC must not infer access from product copy, roles, bridge state, or client state.
- `/admin/terminal` is release metadata only. It is not installer hosting, Axioma activation, or local terminal execution gating.
- The current route skeletons are useful fail-closed scaffolding, not production bridge activation.

## Risks

- If `AXIOMA_ROUTE_SKELETON_ENABLED=true` is set with DB, bridge token, and ES256 envs before the issues above are fixed, `/app/terminal` can show enabled buttons that do not complete a real download or journal handoff.
- Axioma may reject currently issued ES256 handoff tokens because the claim/header/time contract diverges from `AXIOMA_HANDOFF_TOKEN_SPEC.md`.
- Operators can get a false-positive JWKS status in the terminal room if only the private key is set and `AXIOMA_HANDOFF_KEY_ID` is missing.
- Requiring the HS256 dev secret in production can confuse the operational model and encourage provisioning an unused shared secret.

## Verification/tests

RUN:
- `npm run check:core` - PASS. Output included `OK @wtc/axioma-bridge handoff: 7 checks passed` plus the other core package smokes.
- `npm test -- packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts` - PASS. Vitest reported 5 files passed, 37 tests passed, 1 skipped.

NOT RUN:
- Full `npm test` - skipped because this was a scoped bridge audit; focused Axioma/JTI tests were run instead.
- `npm run ci:local` - skipped because it includes full lint/typecheck/build/secret scan beyond this read-only audit scope.
- `npm run build -w @wtc/web` - skipped; no source changes were made.
- Playwright E2E - skipped; no browser server was started and no CTA implementation was changed.
- Live `journal_server` endpoint-shape confirmation - skipped; discovery was local/read-only and no live server mutation or external activation was in scope.
- Real installer/download streaming test - skipped; route currently returns fail-closed/501 by design.

## Next actions

1. Fix the handoff token contract before any production enablement: spec-shaped claims, Unix-second JWT times, `nbf`, entitlement snapshot, linked Axioma user id/null, nonce semantics, and tests that decode the actual ES256 output.
2. Keep `/app/terminal` CTAs disabled until they are wired to real actions; then add e2e coverage for disabled and enabled states.
3. Align JWKS readiness UI with the actual JWKS route requirements: key, kid, and parseable P-256 signer.
4. Remove the production requirement for `AXIOMA_HANDOFF_SIGNING_SECRET` once ES256 is the only real-deployment signer path.
5. Update terminal copy to show exact route blockers instead of stale "proxy does not exist" text.
