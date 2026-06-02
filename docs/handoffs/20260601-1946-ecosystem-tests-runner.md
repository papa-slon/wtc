# ecosystem-tests-runner handoff
## Scope
Read-only verification-planning lane for phase epoch `20260601-1946`. Scope was to produce the exact local verification plan for extracting and testing `/api/axioma/journal-handoff` without editing source, migrations, fixtures, or product docs, and without running tests, gates, live services, or external Axioma calls.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/backend.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `package.json`
- `vitest.config.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Evidence: `apps/web/src/app/api/axioma/journal-handoff/route.ts:4` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:13` import Next/server-bound auth, CSRF, access, backend DB/audit, Drizzle, and route helpers directly; `apps/web/src/features/terminal/axioma-routes.ts:1` imports `server-only`; `apps/web/src/app/api/axioma/journal-handoff/route.ts:44` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:104` performs all logic in the route. Recommendation: extract a dependency-injected `handleAxiomaJournalHandoffRequest(req, opts)` into `apps/web/src/features/terminal/axioma-journal-handoff.ts` with no `server-only` import, then leave the route adapter to wire `requireUser`, CSRF, `accessFor`, `getServerDb`, `audit`, and `process.env`. Target part: journal-handoff local testability.
2. HIGH - Evidence: the current route checks CSRF at `apps/web/src/app/api/axioma/journal-handoff/route.ts:45` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:47`, auth at `apps/web/src/app/api/axioma/journal-handoff/route.ts:49` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:54`, entitlement at `apps/web/src/app/api/axioma/journal-handoff/route.ts:56` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:59`, readiness/DB at `apps/web/src/app/api/axioma/journal-handoff/route.ts:61` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:65`, linked Axioma account lookup at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:78`, JTI persistence at `apps/web/src/app/api/axioma/journal-handoff/route.ts:79` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:84`, audit at `apps/web/src/app/api/axioma/journal-handoff/route.ts:85` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:92`, and POST-body token response at `apps/web/src/app/api/axioma/journal-handoff/route.ts:93` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:100`. Recommendation: the new focused handler suite must cover every branch above, including no DB/audit/JTI writes on CSRF/auth/entitlement/config failures and successful token/JTI/audit behavior. Target part: route behavior proof.
3. HIGH - Evidence: current PGlite suites replay all migrations before Drizzle setup in `tests/integration/axioma-jti-consume-handler.test.ts:18` to `tests/integration/axioma-jti-consume-handler.test.ts:24` and `tests/integration/db-axioma-jti.test.ts:37` to `tests/integration/db-axioma-jti.test.ts:44`; the relevant DB surfaces are `axioma_account_links` at `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155` and `axioma_handoff_jti_revocations` at `packages/db/src/schema.ts:642` to `packages/db/src/schema.ts:657`. Recommendation: create `tests/integration/axioma-journal-handoff-handler.test.ts` using the same PGlite migration replay, Drizzle schema binding, direct user/link fixtures as needed, and `createMemoryAuditWriter`; assert JTI rows are present only on success. Target part: DB-backed local harness.
4. MEDIUM - Evidence: generated P-256 keys are already the accepted test pattern in `packages/axioma-bridge/src/signer.test.ts:4` to `packages/axioma-bridge/src/signer.test.ts:9`, `packages/axioma-bridge/src/signer.test.ts:26` to `packages/axioma-bridge/src/signer.test.ts:29`, `packages/axioma-bridge/src/es256.test.ts:10` to `packages/axioma-bridge/src/es256.test.ts:12`, and `tests/integration/axioma-jwks-readiness.test.ts:6` to `tests/integration/axioma-jwks-readiness.test.ts:9`; route readiness requires `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` at `apps/web/src/features/terminal/axioma-routes.ts:29` and signer resolution consumes them at `apps/web/src/features/terminal/axioma-routes.ts:38` to `apps/web/src/features/terminal/axioma-routes.ts:46`. Recommendation: the new handler tests must generate a fresh P-256 key per suite/test, inject `APP_ENV: 'test'`, `AXIOMA_ROUTE_SKELETON_ENABLED: 'true'`, `AXIOMA_BRIDGE_API_TOKEN`, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID`, and `AXIOMA_JOURNAL_BASE_URL`, then verify the response token with the generated public key. Target part: ES256/JWKS local proof without provisioned OP keys.
5. MEDIUM - Evidence: existing static coverage only proves source shape and absence of query-token/fetch via regex in `tests/integration/axioma-skeleton-static.test.ts:42` to `tests/integration/axioma-skeleton-static.test.ts:58`, while dynamic response behavior is not covered. Recommendation: add dynamic assertions that `postUrl` is exactly the configured base plus `/wtc-handoff`, contains no `?token=`, `method` is `POST`, the token appears only in the JSON body, `cache-control` is `no-store`, and a stubbed `globalThis.fetch` is never called; keep the static `not.toMatch(/fetch\()/`, `not.toMatch(/\?token=/)`, and `not.toMatch(/redirect\()/` guards. Target part: no query-token and no live Axioma call boundary.
6. MEDIUM - Evidence: Phase 3.10 explicitly left journal-handoff extraction unproven at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:87` and made it the next action at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:113`; `docs/STATUS.md:14` to `docs/STATUS.md:15` still list Axioma endpoint-shape, OP-key, live consume/download acceptance, account-link hash migration, and enabled CTAs as open. Recommendation: treat this phase as local extraction/readiness only and do not claim B4 activation or production readiness even after local tests pass. Target part: acceptance language.
7. MEDIUM - Evidence: `scripts/gates.mjs:43` to `scripts/gates.mjs:52` makes e2e its own plan even though `full` runs governance/check/lint/typecheck/secret/test/db-generate/build; Playwright uses a dedicated e2e dev server, one worker, no retries, and safe env flags at `playwright.config.ts:23` to `playwright.config.ts:35`. Recommendation: final operator verification should run focused Vitest first, then `node scripts/gates.mjs full`, then env-cleared `npm run e2e` (or `node scripts/gates.mjs e2e`) separately, then final `npm run governance:check` after aggregate docs are written. Target part: gate discipline.
8. LOW - Evidence: terminal CTAs remain disabled by `bridgeActionsImplemented: false` in `apps/web/src/features/terminal/loader.ts:120` to `apps/web/src/features/terminal/loader.ts:122` and by the button disabled state in `apps/web/src/app/(app)/app/terminal/page.tsx:194` to `apps/web/src/app/(app)/app/terminal/page.tsx:203`. Recommendation: keep e2e expectations aligned with disabled CTAs unless a separate implementation lane deliberately enables them after external B4 acceptance. Target part: browser/product state.

## Decisions
- Recommended extraction artifact: `apps/web/src/features/terminal/axioma-journal-handoff.ts`, export `handleAxiomaJournalHandoffRequest(req, opts)`, and keep it importable from Vitest like `apps/web/src/features/terminal/axioma-jti-consume.ts`.
- The route adapter should keep `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`; `GET()` should return `405` with `cache-control: no-store` without touching DB, and `POST(req)` should pass the real dependencies into the extracted handler.
- The handler options should inject current user lookup, CSRF verification, access decision, DB, audit writer, env, and clock. This avoids Next cookies/server-only imports in integration tests and makes all failure branches deterministic.
- Focused local tests should use generated P-256 keys only. They must not require provisioned OP keys, live Axioma endpoint shape, live JWKS acceptance, or any real Axioma fetch.
- Keep terminal CTAs fail-closed during this phase. A passing journal-handoff local handler suite is not enough to enable browser actions.

## Risks
- If the extracted handler imports `server-only`, `next/headers`, or route modules indirectly, Vitest will be brittle or fail outside Next. Keep the testable handler dependency-injected and framework-neutral.
- The current route catches all success-path errors and maps them to `503 not_configured`; after extraction, tests should either lock that behavior or require more specific error reasons before product docs claim operator-diagnosable failures.
- PGlite proves migrations and repository behavior locally, but it does not prove cross-connection real-Postgres races or deployed connection settings.
- Dynamic "no live Axioma" proof requires both source assertions and a runtime `fetch` spy/stub; one without the other is weaker evidence.
- The route currently issues `axioma.account_link_init` for an `open_journal` handoff. If product/audit owners expect a distinct `axioma.journal_handoff_issue` code, this phase should surface that as a docs/API decision before activation.

## Verification/tests
No tests, gates, Playwright runs, live services, or external calls were run from this read-only lane.

Focused Vitest plan after implementation:
- Add `tests/integration/axioma-journal-handoff-handler.test.ts`.
- PGlite setup: in `beforeEach`, create `new PGlite()`, replay sorted `packages/db/migrations/*.sql`, bind `drizzle(pg, { schema }) as Db`, create a memory audit writer, generate an EC P-256 key with `generateKeyPairSync('ec', { namedCurve: 'P-256' })`, and inject env with route flag, bridge token, ES256 PEM, key id, journal base URL, and `APP_ENV: 'test'`.
- Branch cases: `GET`/non-POST returns `405 no-store`; missing/bad CSRF returns `403` with no JTI/audit; unauthenticated returns `401` with no JTI/audit; denied entitlement returns `403` with no signer/JTI/audit; DB null or disabled flag or missing/blank bridge token or missing key/key id or invalid journal URL returns `503` with no token; malformed dependencies fail closed.
- Success cases: active entitlement plus no linked row returns `200 no-store` JSON `{ postUrl, token, expiresAt, method: 'POST' }`; token verifies ES256 against the generated public key; header has `alg: 'ES256'`, `typ: 'JWT'`, and the injected `kid`; claims include `sub`, `wtc_flow: 'open_journal'`, `wtc_entitlement`, `wtc_axioma_user_id: null`, `iat`, `nbf`, `exp`, `nonce`, and a UUID `jti`; `axioma_handoff_jti_revocations` contains the same `jti`, `sub`, `issuedAt`, and `expiresAt`; audit contains one `axioma.account_link_init` event with `targetType: 'axioma_handoff_jti'`, `targetId: jti`, and `after.signerAlg: 'ES256'`.
- Linked-account case: insert a `schema.axiomaAccountLinks` row with `state: 'linked'` and assert the verified token carries that `wtc_axioma_user_id`; insert non-linked states and assert they do not populate the claim.
- Entitlement snapshot cases: active/grace status maps to the expected token state and expiry; `pending_payment` maps to `none` per current route logic; denied/revoked/expired/refunded/chargeback/manual-review states do not issue a token unless the access decision explicitly allows it.
- No query token/no live fetch cases: assert `postUrl` does not contain `?token=`, token is not in any URL or redirect, response method remains `POST`, `globalThis.fetch` stub is not called, and static guards continue to reject `fetch(`, `redirect(`, and `?token=`.

Focused command:
`npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts packages/axioma-bridge/src/handoff.test.ts`

Post-focused local gates:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run db:generate -w @wtc/db` - expected no schema changes unless this phase deliberately edits schema/migrations.
- `node scripts/gates.mjs full` - sequential governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- Env-cleared `npm run e2e` from PowerShell: `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`
- Final `npm run governance:check` after the aggregate phase handoff is written.

NOT RUN for this lane and expected to remain NOT RUN unless separately provisioned:
- Live Axioma journal endpoint-shape acceptance, live `/wtc-handoff`, live JWKS verification by Axioma, live consume/download checks - external B4 scope.
- Provisioned OP production key acceptance - no real key material in local tests.
- Real Stripe replay - unrelated and no credentials in this scope.
- Throwaway real-Postgres race acceptance - requires `REAL_POSTGRES_DATABASE_URL`.
- Live TradingView automation, live bot/exchange control, SSH, tmux, systemd, preview-worker, or production service mutation - prohibited for this lane.

## Next actions
1. Backend implementer: extract `handleAxiomaJournalHandoffRequest(req, opts)` into `apps/web/src/features/terminal/axioma-journal-handoff.ts` and keep the route as a thin adapter.
2. Tests runner/operator: add the focused PGlite/generate-P-256 handler suite and extend `axioma-skeleton-static.test.ts` for the new helper/route shape.
3. Operator: run the focused command, typechecks, `db:generate`, `node scripts/gates.mjs full`, env-cleared e2e, and final governance check; list exact RUN/NOT RUN gates in the aggregate handoff.
4. Product/security owners: do not enable terminal CTAs or claim B4 done until external Axioma endpoint shape, OP key provisioning, live acceptance, download security, and account-link OTC hash migration are handled in later sessions.
