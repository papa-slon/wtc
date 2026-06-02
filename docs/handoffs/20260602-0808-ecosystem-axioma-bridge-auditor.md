# ecosystem-axioma-bridge-auditor handoff
## Scope
Read-only Axioma bridge audit for Phase 3.41 after Phase 3.40. Scope was a likely local ES256/JWKS/handoff-token readiness preflight that can move B4 evidence without live Axioma endpoints or real production keys. No product code or docs were edited except this required handoff.

## Files inspected
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/*.test.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-account-link.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/api/axioma/**/route.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-account-link-handler.test.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `package.json`

## Files changed
- `docs/handoffs/20260602-0808-ecosystem-axioma-bridge-auditor.md`
- None else - read-only audit.

## Findings
1. High - The local ES256/JWKS primitives are implemented and testable without production keys, so the smallest B4 movement is an explicit local preflight command around generated P-256 material rather than live Axioma activation. Evidence: `packages/axioma-bridge/src/signer.ts:52` selects ES256 when PEM plus kid are present and `packages/axioma-bridge/src/signer.ts:57` fences HS256 out of staging/production; `apps/web/src/features/terminal/axioma-jwks-readiness.ts:19` parses the configured key before reporting JWKS ready; `tests/integration/axioma-jwks-readiness.test.ts:44` asserts valid generated P-256 output with no private scalar. Recommendation: add a dry-run-first `accept:axioma:handoff-preflight -- --dry-run` script that generates disposable P-256 keys in process, exercises JWKS, journal-handoff, and JTI consume handlers against disposable PGlite, and writes only redacted counts/kids/algorithms. Target part: local Axioma ES256/JWKS readiness evidence.
2. High - Journal handoff local route behavior is already dynamically covered, including POST-only CSRF ordering, linked-account requirement, ES256 verification, JTI persistence, and audit no-token checks. Evidence: `apps/web/src/features/terminal/axioma-journal-handoff.ts:72` rejects non-POST, `apps/web/src/features/terminal/axioma-journal-handoff.ts:76` checks CSRF before user resolution, `apps/web/src/features/terminal/axioma-journal-handoff.ts:99` requires a linked Axioma account before signing, and `tests/integration/axioma-journal-handoff-handler.test.ts:197` verifies active linked ES256 handoff plus atomic JTI/audit. Recommendation: do not spend the next no-credential slice reimplementing this path; wrap the existing focused tests in an operator-friendly preflight artifact. Target part: Open Journal handoff local acceptance.
3. High - Option A JTI consume is locally fail-closed and audited, but the external replay-model decision remains B4 because Axioma has not confirmed whether it will call WTC or keep local replay state. Evidence: `apps/web/src/features/terminal/axioma-jti-consume.ts:73` requires route configuration before auth, `apps/web/src/features/terminal/axioma-jti-consume.ts:78` uses bearer service-token auth, `tests/integration/axioma-jti-consume-handler.test.ts:102` proves first consume success, and `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:265` states Option A vs B external acceptance is still open. Recommendation: include Option A consume in the local preflight as WTC-side proof only, and keep the external replay decision explicitly NOT RUN. Target part: replay prevention boundary.
4. High - B4 must remain blocked because the browser CTAs and live bridge activation are intentionally disabled until external endpoint, installer, account-link, and key provisioning gates are complete. Evidence: `apps/web/src/features/terminal/loader.ts:98` computes JWKS readiness but `apps/web/src/features/terminal/loader.ts:108` and `apps/web/src/features/terminal/loader.ts:122` still return `bridgeActionsImplemented: false`; `docs/CONTRACTS/axioma-bridge.md:1070` leaves live installer streaming unchecked; `docs/CONTRACTS/axioma-bridge.md:1075` leaves Axioma token validation endpoint confirmation unchecked. Recommendation: the next slice must not enable terminal buttons, real bridge mode, live downloads, or production envs. Target part: terminal CTA activation gate.
5. Medium - Download handler local security is covered, but the runtime Next adapter still has no live installer fetcher, so a no-credential slice can only prove fixture streaming and 501 fail-closed runtime behavior. Evidence: `apps/web/src/features/terminal/axioma-download.ts:231` returns `bridge_not_implemented` when no installer provider is injected; `apps/web/src/app/api/axioma/download/terminal/route.ts:9` calls the handler without `fetchInstaller`; `tests/integration/axioma-download-handler.test.ts:207` verifies fixture installer streaming and stripped upstream headers when an injected fetcher exists. Recommendation: include mocked fixture streaming in the local preflight, but keep live installer streaming as external B4. Target part: `/api/axioma/download/terminal`.
6. Medium - Current deployment docs have a production-env wording drift: production-required envs still list the HS256 dev secret while `.env.example` and signer code require ES256 key material for staging/production. Evidence: `docs/DEPLOYMENT.md:363` lists `AXIOMA_HANDOFF_SIGNING_SECRET` as required in production; `.env.example:91` says ES256 is required for staging/production and `.env.example:95` says B4 is not provisioned; `packages/axioma-bridge/src/signer.ts:57` throws when staging/production lacks ES256. Recommendation: in a docs-owned follow-up, update deployment required envs to `AXIOMA_HANDOFF_SIGNING_KEY` plus `AXIOMA_HANDOFF_KEY_ID`, keeping the HS256 secret documented as dev/test only. Target part: deployment environment documentation.

## Decisions
- Keep this lane read-only and local-only. No live Axioma, production key, Stripe, bot, exchange, SSH, nginx, systemd, or preview-server mutation was performed.
- Treat generated disposable P-256 keys as acceptable for local preflight proof, but not as OP key provisioning.
- Recommend a preflight wrapper over existing tested handlers rather than another product-code slice.
- Keep terminal CTAs disabled and B4 production activation blocked until external Axioma acceptance and real deployment secrets are observed.

## Risks
- A green local preflight would prove WTC-side request/signing/replay/download/account-link behavior only; it would not prove `axi-o.ma` accepts the token envelope, JWKS cache behavior, Option A consume usage, installer hosting, or account-link completion from Axioma.
- Retained preflight evidence could leak secrets if the script records raw JWTs, raw OTCs, bearer tokens, PEM, JWK private scalar `d`, authorization headers, installer URLs with query secrets, or raw provider responses. The script should reuse existing artifact scanner deny-rule patterns before archive.
- The workspace is not git-backed from this directory, so no branch, commit, or CI state was verified.

## Verification/tests
- `npm test -- packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/axioma-account-link-handler.test.ts` - PASS, 7 test files, 50 tests.
- `git status --short` - NOT RUN as git evidence; command failed because this directory has no `.git` parent.
- NOT RUN: live Axioma endpoint-shape check, live JWKS fetch from deployed WTC host, live Open Journal browser flow, live installer streaming from Axioma, live account-link acceptance, production ES256 key provisioning, production service-token provisioning, real bridge CTA enablement, CI via GitHub Actions.

## Next actions
1. Add a local no-credential `accept:axioma:handoff-preflight -- --dry-run` script that generates disposable P-256 keys, uses disposable PGlite, exercises JWKS, journal-handoff, JTI consume, account-link, and mocked download fixture paths, and writes redacted summary evidence only.
2. Add artifact scanner deny rules for Axioma preflight evidence: PEM blocks, private JWK `d`, JWT-looking compact tokens, bearer tokens, raw OTCs, OTC hashes, Authorization headers, raw download tokens, secret query strings, raw installer provider bodies, and exact service tokens.
3. Update `docs/DEPLOYMENT.md` in a docs-owned slice so production Axioma required envs name ES256 `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`, with `AXIOMA_HANDOFF_SIGNING_SECRET` retained only as dev/test HS256 stub.
4. Keep B4 blocked after the local preflight until an operator supplies approved staging/prod key material and the Axioma team confirms endpoint shapes, replay model, live installer streaming, account-link completion, and browser CTA acceptance.
