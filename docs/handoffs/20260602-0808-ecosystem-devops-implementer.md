# ecosystem-devops-implementer handoff
## Scope
Read-only devops/env/runbook audit for Phase 3.41 local Axioma ES256/JWKS/handoff-token readiness preflight. Scope covered `.env.example`, deployment and production-blocker docs, package scripts, Axioma ES256/JWKS/handoff-token requirements, route readiness gates, and operator guardrails. No live servers, databases, bot services, Stripe, object storage, scanner, or Axioma endpoints were contacted.

## Files inspected
- `.env.example`
- `README.md`
- `package.json`
- `docker-compose.yml`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/SECURITY_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `packages/config/src/env.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/backend.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`

## Files changed
`docs/handoffs/20260602-0808-ecosystem-devops-implementer.md` only. Product code and existing docs: None - read-only audit.

## Findings
1. **HIGH - Axioma production activation remains NOT RUN despite local ES256/JWKS pieces being present.** Evidence: `.env.example:91-97` says the ES256 private key is required for staging/production and is not provisioned in this environment; `docs/PRODUCTION_BLOCKERS_CURRENT.md:18` says real download/open-journal/OTC activation remains blocked on endpoint shapes, OP ES256 key provisioning, live Axioma consume/download/account-link acceptance, installer streaming/security acceptance, and enabled browser CTA acceptance; `docs/CONTRACTS/axioma-bridge.md:1060-1075` leaves `AXIOMA_BRIDGE_API_TOKEN`, live installer streaming, and Axioma token-validation acceptance unchecked. Recommendation: keep `APP_ENV=development` and `AXIOMA_ROUTE_SKELETON_ENABLED=false` for local/operator preview until a real EC P-256 PEM, `AXIOMA_HANDOFF_KEY_ID`, service bridge token, confirmed endpoint shapes, live installer provider, and Axioma-side acceptance evidence exist. Target part: deployment env and Axioma bridge activation.

2. **HIGH - The route readiness guard is correctly fail-closed but all required knobs must be treated as one operator bundle.** Evidence: `apps/web/src/features/terminal/axioma-route-core.ts:35-38` blocks unless `AXIOMA_ROUTE_SKELETON_ENABLED=true`, DB is available, `AXIOMA_BRIDGE_API_TOKEN` is non-empty, and both ES256 key variables exist; `apps/web/src/features/terminal/axioma-download.ts:230-233` still returns `bridge_not_implemented` when no runtime installer fetcher is injected; `apps/web/src/features/terminal/loader.ts:106-122` reports route readiness but keeps `bridgeActionsImplemented: false`; `apps/web/src/app/(app)/app/terminal/page.tsx:236-237` tells users routes fail closed until flag, DB, bridge token, and ES256 signer are configured. Recommendation: do not flip one env switch at a time in a shared preview; require a preflight checklist that sets DB + bridge token + ES256 key/kid + live installer fetcher + Axioma endpoint URLs together, then validates the browser CTAs still remain disabled until acceptance passes. Target part: operator runbook and Axioma CTA enablement.

3. **MEDIUM - `docs/DEPLOYMENT.md` has stale production env wording that can cause wrong key provisioning.** Evidence: `docs/DEPLOYMENT.md:363-364` lists `AXIOMA_HANDOFF_SIGNING_SECRET` as required in production, but `.env.example:89-97` labels that secret as an HS256 dev/test stub and documents `AXIOMA_HANDOFF_SIGNING_KEY` plus `AXIOMA_HANDOFF_KEY_ID` as the production ES256 signer; `packages/config/src/env.ts:89-94` enforces `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` when `APP_ENV` is staging or production. Recommendation: in a later docs lane, replace the production-required Axioma env in `DEPLOYMENT.md` with `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`, and label `AXIOMA_HANDOFF_SIGNING_SECRET` as dev/test only. Target part: deployment runbook.

4. **MEDIUM - Public JWKS behavior is locally implemented, but current readiness is not observable without real key material.** Evidence: `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:17-19` returns `jwks_not_configured` with HTTP 503 when readiness is false; `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:10` uses `no-store` on errors and `public, max-age=300` on success; `apps/web/src/features/terminal/axioma-jwks-readiness.ts:13-22` distinguishes missing key, missing key id, and invalid key; `tests/integration/axioma-jwks-readiness.test.ts:58-80` covers 503 when unconfigured and cacheable JWKS with a generated key. Recommendation: operator preflight should use a throwaway staging EC P-256 key first, verify `/.well-known/axioma-jwks.json` exposes only public JWK fields and the expected `kid`, then replace with vault-managed production key material only after Axioma confirms trust/rotation behavior. Target part: JWKS deployment readiness.

5. **MEDIUM - Axioma contract status contains an internal contradiction around account-link route readiness.** Evidence: `docs/CONTRACTS/axioma-bridge.md:3-7` says local account-link persistence and init/complete/unlink handlers exist, while `docs/CONTRACTS/axioma-bridge.md:535` says account-link routes are not implemented; later `docs/CONTRACTS/axioma-bridge.md:1068` marks OTC account-link bridge endpoints implemented locally, and `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:139-154` describes current local init/complete/unlink behavior but says live acceptance is still pending. Recommendation: in a later docs lane, correct the readiness-table wording to "local routes implemented; live Axioma acceptance not run" so operators do not confuse local handler existence with production activation. Target part: Axioma bridge contract/runbook truth.

6. **LOW - Gate commands exist, but this lane did not run them because the task was a read-only preflight and real Axioma inputs are absent.** Evidence: `package.json:34-36` defines `check:core`, `governance:check`, and `ci:local`; `package.json:30-33` defines live/acceptance preflights for LMS and billing, but there is no equivalent live Axioma acceptance command; `docs/DEPLOYMENT.md:383-391` explicitly lists production DB deploy, CI, production deployment, TLS cutover, Axioma bridge production handoff, and real bot adapters as NOT RUN. Recommendation: when operator supplies real Axioma endpoint shapes and a staging key, add or run an explicit Axioma preflight that records redacted evidence for JWKS fetch, POST-body handoff shape, JTI consume behavior, account-link completion envelope, and installer stream response headers. Target part: verification/runbook.

## Decisions
- Treated this as a read-only audit lane; no product code or existing docs were edited.
- Did not run live or destructive commands: no `db:migrate`, `db:seed`, server restart, Docker start, preview start, Stripe preflight, LMS preflight, bot adapter mode change, or Axioma network call.
- Classified local ES256/JWKS/JTI/download/account-link mechanics as locally implemented where the source/tests prove them, but classified production activation as NOT RUN until operator key material and Axioma endpoint-shape acceptance exist.
- Treated the workspace as not git-backed from this path after `git status --short` returned "not a git repository"; no git operations were attempted.

## Risks
- If an operator follows the stale `DEPLOYMENT.md` production env line and provisions only `AXIOMA_HANDOFF_SIGNING_SECRET`, staging/production should fail closed because `packages/config/src/env.ts` requires the ES256 PEM and key id, but the failed deploy may be confusing and delay activation.
- If `AXIOMA_ROUTE_SKELETON_ENABLED=true` is enabled before a DB, bridge token, ES256 key/kid, live installer provider, and Axioma endpoint shapes are ready, the routes should still fail closed, but operators may misread "configured" UI as production-ready.
- Current JWKS route publishes only the active key; if Axioma requires overlapping key rotation, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:198-200` says multi-key JWKS support must be added before rotation.
- Live installer streaming and Axioma-side handoff/account-link validation are external acceptance risks, not local unit-test risks.

## Verification/tests
- Ran read-only file discovery and greps only.
- Confirmed no existing `docs/handoffs/20260602-0808-ecosystem-devops-implementer.md` was present before writing.
- Did not run `npm run ci:local`, `npm test`, Playwright, or live acceptance commands because this scoped lane was preflight/audit-only and no real Axioma endpoint shapes or production/staging ES256 key were supplied.
- NOT RUN: real Axioma JWKS fetch with production key, Axioma `/wtc-handoff` POST acceptance, Axioma JTI consume callback acceptance, account-link init/complete/unlink against live Axioma, live installer streaming/provider acceptance, production DB migration/seed, production deploy, GitHub Actions CI, real bot adapters, Stripe live/test replay, LMS live object-store/scanner acceptance.

## Next actions
1. Fix `docs/DEPLOYMENT.md` production Axioma env wording in a docs lane: production requires `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`; `AXIOMA_HANDOFF_SIGNING_SECRET` is dev/test HS256 only.
2. Fix `docs/CONTRACTS/axioma-bridge.md` account-link readiness wording to say local routes exist but live Axioma acceptance remains NOT RUN.
3. Operator: provide a staging-only EC P-256 PEM, `AXIOMA_HANDOFF_KEY_ID`, `AXIOMA_BRIDGE_API_TOKEN`, confirmed Axioma endpoint shapes, and an installer streaming target; keep production key material out of `.env.example`, logs, screenshots, and handoffs.
4. After those inputs exist, run a dedicated Axioma acceptance phase that records redacted evidence for JWKS, POST-body handoff, JTI consume/replay, account-link completion, installer streaming headers, and browser CTA enablement.
5. Keep `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `BOT_ADAPTER_MODE=mock`, and Axioma live CTAs disabled until security and integration auditors sign off on the live acceptance artifacts.
