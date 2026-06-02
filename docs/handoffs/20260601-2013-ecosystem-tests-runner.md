# ecosystem-tests-runner handoff
## Scope
Read-only ecosystem-tests-runner lane for WTC Ecosystem Platform Phase 3.12, epoch `20260601-2013`.

Scope was to produce the exact local verification plan for implementing Axioma download route token/proxy acceptance without live Axioma. Focus areas: Request-level handler extraction if needed, PGlite setup, generated fixture release/download state, no-live-fetch stubbing, route response headers, entitlement/access denial branches, token single-use behavior if in scope, static guards, and final gates.

No tests, gates, live services, or external calls were run from this lane.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `package.json`
- `vitest.config.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0004_overconfident_frightful_four.sql`

## Files changed
None - read-only audit

## Findings
1. HIGH - The current download route is still an inline skeleton, not a dynamically testable Request-level handler. Evidence: `apps/web/src/app/api/axioma/download/route.ts:16` defines only `GET`, `route.ts:19` calls `requireUser`, `route.ts:24` checks `accessFor`, `route.ts:30` checks readiness, and `route.ts:35-40` returns `bridge_not_implemented` 501 after prerequisites. Current coverage is static-only: `tests/integration/axioma-skeleton-static.test.ts:33-42` asserts auth/access/not_configured/no-fetch by text scan. Recommendation: extract `handleAxiomaDownloadRequest(req, opts)` into `apps/web/src/features/terminal/axioma-download.ts` and make `apps/web/src/app/api/axioma/download/route.ts` a thin adapter, matching the journal handler pattern. Target part: Request-level handler extraction.

2. HIGH - Existing PGlite patterns are sufficient for local download acceptance, but the fixture must generate real release state instead of relying on demo fallback. Evidence: journal tests replay every SQL migration into PGlite at `tests/integration/axioma-journal-handoff-handler.test.ts:30-36`; consume tests use the same setup at `tests/integration/axioma-jti-consume-handler.test.ts:19-24`; release tables already contain `downloadUrlTemplate`, `checksumSha256`, and current-release indexes at `packages/db/src/schema.ts:582-600`; repos can upsert and read current releases at `packages/db/src/repositories.ts:1076-1126`. Recommendation: add `tests/integration/axioma-download-handler.test.ts` with PGlite migration replay, `seedDatabase(db)`, a generated active user, and `upsertTerminalRelease(db, { version, channel: 'stable', platform: 'windows-x64', downloadUrlTemplate: 'https://axioma-fixture.local/releases/{version}/installer.exe', checksumSha256, isCurrent: true })`. Target part: PGlite setup and generated fixture release/download state.

3. HIGH - No-live-fetch must be proven dynamically, not only by source scan. Evidence: static guard currently checks `downloadRoute` has no `fetch(` at `tests/integration/axioma-skeleton-static.test.ts:42`; route readiness blocks absent flag/DB/token/key/url through `apps/web/src/features/terminal/axioma-route-core.ts:35-41`; the current route returns before bridge work at `apps/web/src/app/api/axioma/download/route.ts:30-40`. Recommendation: inject a `fetchInstaller`/`proxyFetch` function into the extracted handler, set `vi.stubGlobal('fetch', vi.fn(() => { throw new Error('live fetch forbidden'); }))`, and assert unauthenticated, denied, no-DB, no-release, and missing-template paths do not call the injected fetcher. The success path should call only the injected fixture fetcher with the generated fixture URL and never any live Axioma host. Target part: no-live-fetch stubbing.

4. HIGH - Download success response headers need explicit acceptance because the current skeleton only returns JSON errors with `Cache-Control: no-store`. Evidence: `apps/web/src/app/api/axioma/download/route.ts:9-13` sets only `cache-control`; `apps/web/src/app/api/axioma/download/route.ts:35-40` returns JSON 501; the contract expects WTC proxy download URLs and metadata at `docs/CONTRACTS/axioma-bridge.md:904-912`. Recommendation: success tests must assert `status === 200`, `Cache-Control: no-store`, `Content-Disposition: attachment; filename="axioma-setup-<version>-win.exe"` or equivalent sanitized release filename, `Content-Type: application/octet-stream`, `X-Content-Type-Options: nosniff`, optional `Content-Length` only when known, no `Set-Cookie`, no upstream `Location`, no `Authorization` echo, and body bytes equal the local fixture stream. Target part: route response headers.

5. HIGH - Entitlement/access denial branches must prove fail-closed ordering and zero side effects. Evidence: repo rules require entitlements as sole access source at `AGENTS.md:82`; the current route has `401` at `apps/web/src/app/api/axioma/download/route.ts:19-21`, `403` at `route.ts:24-27`, and `503` at `route.ts:30-33`; `recordDownloadEvent` writes both the event row and `terminal.download` audit in one transaction at `packages/db/src/repositories.ts:1131-1135`. Recommendation: handler tests must cover unauthenticated 401, denied/no entitlement 403, expired/revoked/chargeback access 403, active and grace access allowed, route not configured 503, DB missing 503, current release missing 404 or 503 per implementation decision, release missing `downloadUrlTemplate` 503, upstream 404/410/503 mapping, and assert `terminal_download_events` plus `audit_logs` stay empty for all failures. Target part: entitlement/access denial branches.

6. MEDIUM - Download token single-use is not currently represented by `terminal_download_events`; do not claim it unless Phase 3.12 implements a token model. Evidence: `terminalDownloadEvents` currently stores event facts only (`userId`, `releaseId`, `version`, `platform`, IP/UA, `entitlementVerified`, `createdAt`) at `packages/db/src/schema.ts:603-617`; the contract's target single-use language says `terminal_download_events` is intended for one-time token/consumed tracking at `docs/CONTRACTS/axioma-bridge.md:592-595`; current JTI primitives are flow-limited to handoff purposes at `packages/db/src/repositories.ts:1180-1191`. Recommendation: if single-use is in scope, add an explicit local model before acceptance, either a new `terminal_download_tokens` table or additive token fields with hashed token, `expires_at`, `consumed_at`, `release_id`, and `user_id`; add issue/consume repos with one atomic conditional update and tests for first consume 200, replay 410 or 409, expired 410, wrong user 403, and audit rows `axioma.download.token_issued` / `axioma.download.token_consumed` with no raw token. If the phase only proxies authenticated downloads directly, mark token single-use as NOT RUN / out of scope in the aggregate. Target part: token single-use behavior if in scope.

7. MEDIUM - Static guards should evolve from "no fetch at all" to "no un-injected live fetch and no token leakage" once the proxy is implemented. Evidence: the existing static test blocks `fetch(` in the route at `tests/integration/axioma-skeleton-static.test.ts:42`; journal static checks no redirect and no `?token=` at `tests/integration/axioma-skeleton-static.test.ts:57-63`; audit policy forbids raw JWTs/download tokens/OTCs in audit rows at `docs/CONTRACTS/axioma-bridge.md:635`. Recommendation: update static guards to assert the route imports only the extracted handler, the handler accepts injected fetch/dependencies, no `axi-o.ma` or production download host literal appears in tests or handler success flow except docs/config parsing, no `?token=`, no raw download token in audit JSON, no `Set-Cookie` forwarding, and CTAs remain disabled unless bridge action enablement is intentionally in the same phase. Target part: static guards.

8. MEDIUM - Final gates must be split correctly: `node scripts/gates.mjs full` does not run e2e in the current implementation despite the header comment. Evidence: the plan array for `full` excludes `e2e` at `scripts/gates.mjs:50`, `e2e` is a separate plan at `scripts/gates.mjs:52`, and the script comments instruct running e2e alone at `scripts/gates.mjs:43-46`; Playwright uses one worker, no retries, isolated `.next-e2e`, and no server reuse at `playwright.config.ts:7-30`. Recommendation: Phase 3.12 final report must list `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separately, plus exact focused tests run, and must not claim e2e green from `full`. Target part: final gates.

## Decisions
- Verification should require an extracted `apps/web/src/features/terminal/axioma-download.ts` Request handler unless implementation stays a deliberate fail-closed skeleton. Inline route logic would leave success/failure acceptance dependent on Next route internals instead of injectable tests.
- Use PGlite migration replay, generated users, and generated terminal release rows for local acceptance. Do not rely on demo `MOCK_RELEASE` because production mode must use DB release metadata.
- Use injected fetch/stream stubs only. No live Axioma, no live server, and no external network is needed for Phase 3.12 acceptance.
- Treat direct authenticated proxy and single-use download tokens as separate acceptance scopes. If single-use token semantics are not implemented in DB/repo code, the tests-runner acceptance must mark that branch NOT RUN rather than imply coverage.
- Keep browser CTAs disabled unless the phase explicitly includes browser action wiring and e2e acceptance. A route handler becoming locally green is not by itself CTA production readiness.

## Risks
- Existing `terminal_download_events` is an audit/event table, not a single-use token ledger. Implementing "token/proxy" only in route memory would not survive restart or concurrent requests.
- PGlite cannot prove cross-connection token-consume races. If a new single-use DB token model lands, real Postgres race acceptance should remain recommended when credentials are available.
- A mocked installer stream can prove WTC header/side-effect behavior, but it cannot prove live Axioma endpoint shape, upstream auth, byte integrity, or CDN/range behavior.
- If success headers forward upstream headers naively, the route could leak `Set-Cookie`, `Location`, or service-token context. Tests must use an upstream fixture with forbidden headers and assert they are stripped.
- If route readiness keeps requiring ES256 handoff key material for downloads, tests should document that coupling. If downloads do not need signing, implementation may need a separate download readiness function so missing journal signer does not block an otherwise valid local download proxy.

## Verification/tests
RUN:
- None. This lane was instructed not to run tests, gates, live services, or external calls.

NOT RUN:
- `npm test -- tests/integration/axioma-download-handler.test.ts ...` - not run; read-only planning lane, and the file does not exist yet.
- `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/axioma-skeleton-static.test.ts` - not run by instruction.
- `npm run typecheck` - not run by instruction.
- `npm run typecheck -w @wtc/web` - not run by instruction.
- `npm run secret:scan` - not run by instruction.
- `npm run db:generate -w @wtc/db` - not run by instruction.
- `node scripts/gates.mjs full` - not run by instruction.
- `node scripts/gates.mjs e2e` - not run by instruction.
- Live Axioma endpoint-shape, JWKS, consume, download, or installer-stream checks - not run; out of scope without credentials/contracts and forbidden for this lane.
- Live Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service mutation - not run; out of scope and forbidden.

Exact focused acceptance set to run after implementation:
1. `npm test -- tests/integration/axioma-download-handler.test.ts tests/integration/axioma-skeleton-static.test.ts`
2. If single-use download token state lands: add the new DB/repo test file to the command above, and include first-consume/replay/expired/wrong-user/no-raw-token audit cases.
3. Regression set: `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts`
4. `npm run typecheck`
5. `npm run typecheck -w @wtc/web`
6. `npm run secret:scan`
7. `npm run db:generate -w @wtc/db`
8. `node scripts/gates.mjs full`
9. `node scripts/gates.mjs e2e`
10. Final aggregate-created `npm run governance:check`

Minimum new `axioma-download-handler.test.ts` cases:
1. Replays migrations into PGlite, seeds DB, creates generated user and generated current `stable/windows-x64` release.
2. `GET` unauthenticated returns 401/no-store and does not call fetch or write DB rows.
3. Denied entitlement returns 403/no-store with reason and does not call fetch or write DB rows.
4. Active entitlement with missing DB/flag/token/key/url readiness returns 503/no-store and does not call fetch.
5. Active entitlement with no current release returns fail-closed response and no fetch.
6. Active entitlement with current release but missing/invalid `downloadUrlTemplate` returns fail-closed response and no fetch.
7. Active entitlement with fixture release calls only injected fetcher, streams fixture bytes, strips forbidden upstream headers, sets download headers, records exactly one `terminal_download_events` row, and writes one `terminal.download` audit row.
8. Grace entitlement follows the same allowed success path as active.
9. Upstream fixture 404/410/503 maps to sanitized WTC error envelopes, no raw upstream body, no download event if no bytes are served.
10. If token scope lands: issue token does not expose raw token in audit, consume succeeds once, replay/expired/wrong-user fail without a second download event.

## Next actions
1. Implement `apps/web/src/features/terminal/axioma-download.ts` as an injectable Request-level handler and keep `apps/web/src/app/api/axioma/download/route.ts` as a thin adapter.
2. Add `tests/integration/axioma-download-handler.test.ts` with the PGlite/generated-release/no-live-fetch/header/access/side-effect cases listed above.
3. Update `tests/integration/axioma-skeleton-static.test.ts` so it verifies extracted handler boundaries, injected fetch, no token URL, stripped headers, no raw token/audit leakage, and CTA fail-closed behavior.
4. Decide before coding whether Phase 3.12 includes durable single-use download tokens. If yes, add DB/repo primitives and atomic consume tests; if no, explicitly mark token single-use NOT RUN in the phase aggregate.
5. After implementation, run the focused acceptance command, regression command, typecheck pair, secret scan, db generate, `node scripts/gates.mjs full`, separate `node scripts/gates.mjs e2e`, and final governance check. Report exact RUN/NOT RUN gates with observed results only.
