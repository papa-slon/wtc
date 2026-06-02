# ecosystem-backend-implementer handoff
## Scope
Read-only backend audit for Phase 3.41 local Axioma ES256/JWKS/handoff-token readiness preflight. Inspected the Axioma bridge package, web route handlers, account-link/download/handoff/JTI consume paths, DB JTI/download/account-link primitives, worker purge wiring, Axioma tests, and relevant scripts/package gates. No live Axioma calls were made or recommended.

## Files inspected
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-account-link.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `apps/web/src/app/api/axioma/account-link/route.ts`
- `apps/web/src/app/api/axioma/account-link/init/route.ts`
- `apps/web/src/app/api/axioma/account-link/complete/route.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0010_axioma_account_link_hash.sql`
- `apps/worker/src/index.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-account-link-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `package.json`
- `.env.example`
- `scripts/gates.mjs`
- `scripts/check-governance.mjs`

## Files changed
`docs/handoffs/20260602-0808-ecosystem-backend-implementer.md` only.

Read-only audit result for product code/docs: None - read-only audit.

## Findings
1. Medium - JTI consume readiness is narrower than the shared Axioma route readiness. Evidence: `apps/web/src/features/terminal/axioma-jti-consume.ts:34` only requires route flag, bridge token, and DB; `apps/web/src/features/terminal/axioma-route-core.ts:32` also requires ES256 signing key/key id and valid journal base URL. This means `/api/axioma/jti/consume` can be enabled while ES256/JWKS are not locally ready. Recommendation: for Phase 3.41 preflight, either reuse `axiomaRouteReadiness` in the JTI consume handler or add a dedicated local preflight route/script that checks JWKS/signing readiness and JTI consume readiness together without consuming real tokens. Target part: `apps/web/src/features/terminal/axioma-jti-consume.ts`.
2. Low - Journal handoff collapses signer/config/DB write failures into the same 503 body. Evidence: `apps/web/src/features/terminal/axioma-journal-handoff.ts:100` enters linked-account/sign/JTI issue flow, and `apps/web/src/features/terminal/axioma-journal-handoff.ts:133` catches all failures as `{ error: 'not_configured' }`. This is safe externally, but local preflight has less diagnostic precision for invalid PEM, duplicate JTI, and DB/audit failures. Recommendation: keep the public response generic, but add internal structured preflight diagnostics or branch-local test helpers that classify invalid key vs DB/audit failure without logging secrets. Target part: `apps/web/src/features/terminal/axioma-journal-handoff.ts`.
3. Info - ES256/JWKS signing boundary is implemented and fail-closed for real deployments. Evidence: `packages/axioma-bridge/src/signer.ts:52` chooses ES256 when key+kid exist and `packages/axioma-bridge/src/signer.ts:57` throws for staging/production without ES256; `packages/axioma-bridge/src/es256.ts:44` refuses to expose a JWK containing private scalar `d`; `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:14` returns 503 unless JWKS readiness succeeds. Recommendation: preserve the pure package boundary and keep env/key loading in the web/server layer. Target part: `packages/axioma-bridge` and `apps/web/src/features/terminal/axioma-jwks-readiness.ts`.
4. Info - Journal handoff issuance is local-only and does not call live Axioma. Evidence: `apps/web/src/features/terminal/axioma-journal-handoff.ts:94` requires route readiness and DB, `apps/web/src/features/terminal/axioma-journal-handoff.ts:100` requires an existing linked Axioma account, and `apps/web/src/features/terminal/axioma-journal-handoff.ts:113` records the JTI with audit before responding. Tests verify ES256 token verification and no query-token transport at `tests/integration/axioma-journal-handoff-handler.test.ts:197` and `tests/integration/axioma-journal-handoff-handler.test.ts:208`. Recommendation: keep this as the local readiness boundary; do not add live `journal_server` calls to preflight. Target part: `apps/web/src/features/terminal/axioma-journal-handoff.ts`.
5. Info - Download readiness is correctly split from live installer fetching. Evidence: token issue/consume logic lives in `apps/web/src/features/terminal/axioma-download.ts:268`; the handler returns `bridge_not_implemented` when no `fetchInstaller` provider is injected at `apps/web/src/features/terminal/axioma-download.ts:231`; tests explicitly forbid accidental global live fetch at `tests/integration/axioma-download-handler.test.ts:212` and assert it was not called at `tests/integration/axioma-download-handler.test.ts:232`. Recommendation: narrow implementation boundary is a fixture/injected `fetchInstaller` adapter plus release-row validation, not a live Axioma fetch. Target part: `apps/web/src/features/terminal/axioma-download.ts`.
6. Info - DB primitives cover hash-only account-link OTC, hash-only download tokens, atomic JTI consume, revoke, and purge. Evidence: account-link repository starts at `packages/db/src/repositories.ts:1872`; terminal download token issue/consume start at `packages/db/src/repositories.ts:2213` and `packages/db/src/repositories.ts:2261`; JTI issue/consume/revoke/purge starts at `packages/db/src/repositories.ts:2360`, `packages/db/src/repositories.ts:2405`, `packages/db/src/repositories.ts:2437`, and `packages/db/src/repositories.ts:2459`; worker purge calls `purgeExpiredHandoffJtis` at `apps/worker/src/index.ts:110`. Recommendation: use these primitives as-is for local preflight and avoid new schema. Target part: `packages/db` and `apps/worker`.
7. Info - Existing tests cover the main local preflight behavior, with one known real-Postgres gap. Evidence: JWKS configured/unconfigured tests at `tests/integration/axioma-jwks-readiness.test.ts:58` and `tests/integration/axioma-jwks-readiness.test.ts:69`; JTI consume tests at `tests/integration/axioma-jti-consume-handler.test.ts:73` and `tests/integration/axioma-jti-consume-handler.test.ts:127`; account-link query-token rejection and replay at `tests/integration/axioma-account-link-handler.test.ts:312` and `tests/integration/axioma-account-link-handler.test.ts:347`; real-PG cross-connection race is opt-in/skipped at `tests/integration/db-axioma-jti.test.ts:136`. Recommendation: next boundary should add a local preflight test that composes JWKS readiness, issue journal handoff, consume JTI once, and attempt download token issue using fixture release rows; real-PG race remains separately gated by `REAL_POSTGRES_DATABASE_URL`. Target part: `tests/integration`.

## Decisions
- Do not add live Axioma calls for Phase 3.41. The narrowest useful boundary is local ES256 key/JWKS readiness, DB-backed handoff JTI issue/consume/replay, account-link OTC completion via bearer-auth service handler, and download token issuance/fixture installer injection.
- Keep `@wtc/axioma-bridge` pure and env-free; continue resolving `APP_ENV`, PEM, key id, audience, and base URL in the web/server layer.
- Keep raw tokens/codes write-once to responses only; DB/audit stay hash-only or metadata-only.
- Public error bodies can remain fail-closed and generic; local preflight can provide safer diagnostic detail if it avoids secrets.

## Risks
- JTI consume can be locally "configured" even when JWKS/ES256 readiness is not, because it does not share `axiomaRouteReadiness`.
- Invalid signer/DB/audit failures in journal handoff are externally indistinguishable as `not_configured`; operators may need test output or internal diagnostics to pinpoint the blocker.
- The real Postgres cross-connection consume race remains unobserved in this session because only the PGlite/default targeted test suite was run.
- Actual Axioma endpoint shape, provisioned production P-256 key, and live installer availability remain outside this local preflight.

## Verification/tests
- Ran: `npm test -- --run tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/axioma-account-link-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/db-axioma-download-token.test.ts tests/integration/db-axioma-account-link.test.ts`
- Result: PASS - 8 test files passed; 49 tests passed; 1 skipped (`db-axioma-jti` real Postgres cross-connection race).
- Not run: full `npm test`, `npm run ci:local`, `npm run lint`, `npm run typecheck`, `npm run build -w @wtc/web`, live Axioma calls, real-PG harness. Reason: scope was read-only backend local Axioma readiness preflight; targeted tests covered the inspected backend surface.

## Next actions
1. Add a local-only Axioma readiness preflight boundary that composes: JWKS builds from generated P-256 key, journal handoff issues ES256 token for a linked test user, JTI consume succeeds once and rejects replay, account-link complete rejects query token and accepts bearer JSON-body completion, and download token issuance uses fixture release rows with injected installer provider only.
2. Align `/api/axioma/jti/consume` readiness with shared `axiomaRouteReadiness`, or explicitly document why service-side consume may be enabled independently of ES256/JWKS.
3. Preserve `fetchInstaller` injection for downloads; do not introduce a default live fetch path until endpoint shape, allowlist, timeout, checksum, and secret-handling rules are reviewed.
4. Run the real-PG JTI race test only when `REAL_POSTGRES_DATABASE_URL` is available; keep it separate from the local no-live-call preflight.
