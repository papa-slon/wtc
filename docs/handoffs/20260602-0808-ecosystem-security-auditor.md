# ecosystem-security-auditor handoff
## Scope
Phase 3.41 read-only security audit for local Axioma ES256/JWKS/handoff-token readiness preflight. Inspected signing key handling, token claims, JTI replay, JWKS exposure, env docs, artifact/log risks, and live-call boundaries. No product code or docs changed except this required handoff.

## Files inspected
- `AGENTS.md`
- `.env.example`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/index.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`

## Files changed
None - read-only audit except this handoff: `docs/handoffs/20260602-0808-ecosystem-security-auditor.md`.

## Findings
1. Severity: High. Route readiness does not parse the ES256 key before declaring the Axioma route configured. Evidence: shared route readiness only checks presence of `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` at `apps/web/src/features/terminal/axioma-route-core.ts:32`-`44`; signer parsing happens later in `buildAxiomaHandoff` at `apps/web/src/features/terminal/axioma-route-core.ts:68`-`84`; the JWKS readiness helper already parses the key and returns `signing_key_invalid` at `apps/web/src/features/terminal/axioma-jwks-readiness.ts:11`-`23`, with tests at `tests/integration/axioma-jwks-readiness.test.ts:34`-`41`. Recommendation: make the Phase 3.41 preflight and route readiness share parseable JWKS/signer readiness, and fail with no token/JTI/audit side effects when key material is invalid. Target part: ES256 readiness.

2. Severity: High. Local JTI replay primitives look correctly atomic, but real cross-connection race acceptance is still opt-in and not observed here. Evidence: JTI table stores caller-supplied UUID, sub, expiry, used/revoked timestamps at `packages/db/src/schema.ts:737`-`760`; consume is one conditional `UPDATE` requiring unused, unrevoked, unexpired state at `packages/db/src/repositories.ts:2398`-`2432`; PGlite tests cover replay/expired/revoked behavior at `tests/integration/db-axioma-jti.test.ts:57`-`130`; real Postgres concurrent consume is skipped unless `REAL_POSTGRES_DATABASE_URL` is set at `tests/integration/db-axioma-jti.test.ts:132`-`158`. Recommendation: Phase 3.41 should require a throwaway real-Postgres preflight for concurrent consume before calling JTI replay production-ready. Target part: JTI replay.

3. Severity: Medium. JWKS exposure is public and correctly public-key-only in code/tests, but key rotation is single-active-key only. Evidence: `publicJwk()` hard-refuses a private scalar `d` and adds `kid/use/alg` at `packages/axioma-bridge/src/es256.ts:44`-`48`; JWKS builder emits signer public JWKs at `packages/axioma-bridge/src/jwks.ts:12`-`13`; route returns `public, max-age=300` when configured and `no-store` 503 when not configured at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:6`-`21`; spec says current rotation publishes only the active key and needs multi-key JWKS for overlap at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:194`-`203`. Recommendation: keep Phase 3.41 readiness limited to single-key acceptance unless multi-key overlap and stale-cache behavior are implemented/tested. Target part: JWKS exposure/rotation.

4. Severity: Medium. Handoff token response is intentionally returned to the browser once, but retained-token guardrails are incomplete outside route-level assertions. Evidence: journal handoff returns `{ postUrl, token, expiresAt, method }` on success at `apps/web/src/features/terminal/axioma-journal-handoff.ts:124`-`132`; tests verify POST body, no `?token=`, ES256 validity, JTI row, and no token in audit at `tests/integration/axioma-journal-handoff-handler.test.ts:197`-`237`; audit schema says download request and terminal download audit omit raw token/hash at `docs/AUDIT_LOG_SCHEMA.md:206`-`208`. Recommendation: add a generated-artifact scan for Axioma JWT-shaped tokens, `AXIOMA_HANDOFF_SIGNING_KEY` assignments, EC private key PEM blocks, `AXIOMA_BRIDGE_API_TOKEN`, `Authorization: Bearer`, `/.well-known/axioma-jwks.json` private scalar `d`, and `?token=` handoff URLs. Target part: no-retained-token/no-plaintext-key guardrails.

5. Severity: Medium. Live-call boundaries remain blocked and should stay explicit in the preflight. Evidence: JTI consume route uses DB plus bearer auth and does not call `fetch` at `apps/web/src/features/terminal/axioma-jti-consume.ts:65`-`101`; spec states the route does not call live Axioma and does not put tokens in URLs at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:259`-`265`; production blockers say live Axioma endpoint-shape/account-link/download acceptance, OP ES256 key provisioning, and installer streaming/security acceptance remain blocked at `docs/PRODUCTION_BLOCKERS_CURRENT.md:18`; download runtime returns `501 bridge_not_implemented` unless an installer provider is injected at `apps/web/src/features/terminal/axioma-download.ts:221`-`236`. Recommendation: Phase 3.41 preflight must be dry-run/local by default and refuse live Axioma network calls unless the operator supplies explicit live-acceptance env and throwaway/non-production confirmation. Target part: live-call boundary.

6. Severity: Low. Existing artifact scanner has broad secret/log rules but is still LMS-named and lacks Axioma-specific deny rules/default roots. Evidence: default scan roots are LMS/e2e/log paths at `scripts/scan-lms-db-e2e-artifacts.mjs:5`; generic forbidden rules include database/session/KEK/authorization/bearer tokens at `scripts/scan-lms-db-e2e-artifacts.mjs:40`-`83`, but no Axioma signing key, EC private key, JWT compact token, JWKS private scalar, or Axioma preflight log root. Recommendation: either add a billing-style/Axioma wrapper over the scanner or rename/generalize scanner roots and rules before retaining Phase 3.41 evidence. Target part: artifact/log retention.

## Decisions
- Treat ES256/JWKS implementation as locally present but not production-ready until a preflight proves parseable private-key handling, public-only JWKS, route issuance, and retained-artifact cleanliness in one bounded run.
- Treat JTI single-use as implemented locally, with real-Postgres concurrent consume still required for production-readiness language.
- Keep handoff JWTs in POST bodies only; never in GET query strings, logs, audit payloads, screenshots, or retained fixtures.
- Keep private key material server-only in `AXIOMA_HANDOFF_SIGNING_KEY` or secret manager; never write PEM, public/private JWK with `d`, service token, handoff JWT, or raw download token to DB/audit/log/artifacts.
- Keep live Axioma calls out of normal gates; live endpoint acceptance needs a separate explicit operator-approved gate.

## Risks
- A deployment with syntactically present but invalid ES256 key env may report route readiness until the signing step throws; current handler catches this as generic 503, but readiness/ops evidence can be misleading.
- Real replay safety depends on Postgres row-lock behavior; PGlite coverage is useful but not enough for cross-connection race acceptance.
- Single-active-key JWKS can break rotation if Axioma caches the old key or expects overlap.
- Raw handoff JWTs and private PEM blocks are high-risk if a future preflight writes verbose env dumps, response bodies, screenshots, or request/response logs.
- A live installer/download provider could accidentally retain upstream URLs, `Set-Cookie`, bearer headers, or installer request metadata unless the strict response/header and artifact scan rules are reused.

## Verification/tests
- Gates run this session: none. This was a read-only audit plus handoff write.
- Static/inspection evidence: inspected Axioma signer/JWKS/handoff/JTI/download code, env docs, DB replay schema/repositories, worker purge path, relevant integration tests, and artifact scanner rules.
- Not run: `npm test`, `npm run secret:scan`, `npm run build -w @wtc/web`, `npm run e2e`, real-Postgres JTI race test, live Axioma endpoint checks, live installer streaming, live JWKS fetch, git status. `git status --short` could not run because this workspace is not a git repository at the current path.

## Next actions
1. Implement a dry-run-first Axioma ES256/JWKS/handoff-token preflight that generates a throwaway P-256 key in-process, signs a token, verifies ES256 claims, serves/builds public-only JWKS, asserts no `d`, records/consumes one JTI in a throwaway DB, and writes only redacted summary evidence.
2. Add Axioma-specific retained-artifact deny rules for EC private key PEM blocks, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_BRIDGE_API_TOKEN`, compact JWTs, bearer auth, query `token=`, JWKS `d`, raw download tokens, Axioma upstream internal URLs, and live-call request/response bodies.
3. Add a real-Postgres opt-in acceptance step for concurrent JTI consume with a fresh `wtc_test_*` database before calling replay protection production-ready.
4. Align `axiomaRouteReadiness` with `resolveAxiomaJwksReadiness` so configured means parseable ES256 signer material, not just env-name presence.
5. Keep live Axioma endpoint-shape/download/account-link acceptance as a separate operator-approved phase with explicit no-production/no-retained-secret guardrails.
