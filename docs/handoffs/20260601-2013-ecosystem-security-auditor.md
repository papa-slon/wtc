# ecosystem-security-auditor handoff
## Scope
Read-only security audit lane for WTC Ecosystem Platform Phase 3.12, epoch `20260601-2013`.
Scope was the safest local implementation plan for Axioma download route token/proxy acceptance after
Phase 3.11, focused on auth, CSRF/order, entitlement fail-closed behavior, one-time token/JTI/download
event secrecy, no plaintext secrets, no live Axioma calls, response/download headers, and why terminal
CTAs must remain disabled.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/SECURITY_MODEL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Current download route is intentionally safe but not accepted for production download streaming. Evidence: `apps/web/src/app/api/axioma/download/route.ts:24` checks `axioma_terminal` access, `apps/web/src/app/api/axioma/download/route.ts:29` to `apps/web/src/app/api/axioma/download/route.ts:40` requires route readiness and then returns `501 bridge_not_implemented`; the static test asserts no `fetch(` in this route at `tests/integration/axioma-skeleton-static.test.ts:33` to `tests/integration/axioma-skeleton-static.test.ts:40`; Phase 3.11 explicitly left installer proxying and one-time download tokens open at `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md:82` and `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md:106`. Recommendation: keep this route fail-closed until a local-only handler exists with injected/mock installer streaming and no live Axioma calls. Target part: Axioma download route/proxy acceptance.

2. HIGH - `terminal_download_events` cannot currently enforce the contract's one-time download token lifecycle. Evidence: the current table has release/user/version/platform/IP/user-agent/entitlement fields only at `packages/db/src/schema.ts:603` to `packages/db/src/schema.ts:615`, and `recordDownloadEvent` writes only an event plus `terminal.download` audit at `packages/db/src/repositories.ts:1131` to `packages/db/src/repositories.ts:1135`; the Axioma contract requires a time-limited one-time token stored in `terminal_download_events`, consumed with `consumed_at`, and expired or already-consumed links returning `410` at `docs/CONTRACTS/axioma-bridge.md:235` and `docs/CONTRACTS/axioma-bridge.md:250`. Recommendation: add a migration or a dedicated token table before streaming: store only `token_hash`, `expires_at`, `consumed_at`, `revoked_at/status`, release/user/link metadata, and audit-safe outcome fields; return the raw token once and never persist it. Target part: one-time download token and event secrecy.

3. HIGH - Download token issuance must be a CSRF-protected POST and must not be hidden inside the GET stream endpoint. Evidence: the security model requires JavaScript to attach `X-CSRF-Token` on mutating calls and covers all POST/PUT/PATCH/DELETE handlers at `docs/SECURITY_MODEL.md:118` to `docs/SECURITY_MODEL.md:124`; the accepted journal handler checks method and CSRF before `requireUser` at `apps/web/src/features/terminal/axioma-journal-handoff.ts:74` to `apps/web/src/features/terminal/axioma-journal-handoff.ts:88`, and its test proves bad CSRF does not call user resolution at `tests/integration/axioma-journal-handoff-handler.test.ts:133` to `tests/integration/axioma-journal-handoff-handler.test.ts:156`. Recommendation: implement `POST /api/axioma/download` or `POST /api/axioma/download-token` as the only token-issue path with order `method -> CSRF -> auth -> entitlement -> route readiness -> linked/current release -> transactional token issue/audit`; keep the GET proxy as token consumption/streaming only. Target part: auth, CSRF, and side-effect order.

4. HIGH - Entitlement must fail closed at both token issue and token consume/proxy time. Evidence: route readiness already fails closed on flag, DB, bridge token, ES256 key, and journal base URL at `apps/web/src/features/terminal/axioma-route-core.ts:35` to `apps/web/src/features/terminal/axioma-route-core.ts:44`; the current download skeleton checks access before readiness at `apps/web/src/app/api/axioma/download/route.ts:24` to `apps/web/src/app/api/axioma/download/route.ts:32`; the terminal UI derives license from the server entitlement decision rather than mock bridge state at `apps/web/src/app/(app)/app/terminal/page.tsx:36` to `apps/web/src/app/(app)/app/terminal/page.tsx:45`. Recommendation: the proxy consume handler should re-check same-user session and current `axioma_terminal` entitlement immediately before streaming, then deny unknown, expired, revoked, refunded, chargeback, or manual-review states without consuming the installer response; only active and policy-approved grace should proceed. Target part: entitlement fail-closed download gating.

5. HIGH - Do not reuse raw JTI/JWT semantics as the download token model, but mirror the atomic consume pattern. Evidence: JTI consume uses a bearer service token, UUID validation, no-store responses, and consume/replay audit at `apps/web/src/features/terminal/axioma-jti-consume.ts:78` to `apps/web/src/features/terminal/axioma-jti-consume.ts:101`; DB consume is a single conditional update before failure categorization at `packages/db/src/repositories.ts:1219` to `packages/db/src/repositories.ts:1251`; tests cover single-use, replay, expired, unknown, and revoked cases at `tests/integration/db-axioma-jti.test.ts:63` to `tests/integration/db-axioma-jti.test.ts:99`. Recommendation: build a separate opaque random download token with hash-based lookup and atomic `consumed_at IS NULL AND expires_at > now()` update, then audit `axioma.download.token_issued`, `axioma.download.token_consumed`, and `axioma.download.token_expired` without storing raw token values. Target part: replay prevention and download-event secrecy.

6. MEDIUM - Streaming response headers are not yet implemented and must be part of local acceptance. Evidence: the current download route only has the JSON helper's `cache-control: no-store` at `apps/web/src/app/api/axioma/download/route.ts:9` to `apps/web/src/app/api/axioma/download/route.ts:13` and never reaches a stream; the contract's response shape includes installer name, checksum, and size metadata at `docs/CONTRACTS/axioma-bridge.md:239` to `docs/CONTRACTS/axioma-bridge.md:247`. Recommendation: mocked streaming acceptance must assert `Cache-Control: no-store, private`, `Content-Disposition: attachment` with a sanitized filename, `Content-Type: application/octet-stream` or a strict allowlist, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, no upstream `Set-Cookie`, no upstream internal URL in the response, and no blind upstream header forwarding. Target part: response/download headers.

7. MEDIUM - Axioma service credentials must stay server-only and absent from DB, audit, responses, fixtures, and screenshots. Evidence: `.env.example` identifies `AXIOMA_BRIDGE_API_TOKEN` as the journal_server service token at `.env.example:50`; the contract says WTC uses a dedicated service-account JWT/static API key stored server-side and the browser never sees it at `docs/CONTRACTS/axioma-bridge.md:60`; audit entries must never include raw JWTs, download token values, OTC values, exchange credentials, or personal financial data at `docs/CONTRACTS/axioma-bridge.md:635`. Recommendation: local tests should use placeholder tokens only, assert token/API-secret strings are absent from event/audit JSON and responses, and keep any future live credential in env/secret manager only, not in `terminal_download_events` or route logs. Target part: no plaintext secrets.

8. MEDIUM - Terminal CTAs must remain disabled after the download route local plan because B4 still has multiple external and schema blockers. Evidence: the loader returns `bridgeActionsImplemented: false` in both demo and Postgres branches at `apps/web/src/features/terminal/loader.ts:101` to `apps/web/src/features/terminal/loader.ts:123`; the page only enables actions when `access.allowed && routeSkeletonConfigured && bridgeActionsImplemented` at `apps/web/src/app/(app)/app/terminal/page.tsx:30` to `apps/web/src/app/(app)/app/terminal/page.tsx:33`, and both download/open-journal buttons are disabled on that value at `apps/web/src/app/(app)/app/terminal/page.tsx:166` to `apps/web/src/app/(app)/app/terminal/page.tsx:204`; the current production blocker says real download/open-journal/OTC activation still depends on endpoint shapes, OP key provisioning, replay-model confirmation, OTC hash/active-link uniqueness, installer/download security, and enabled CTA acceptance at `docs/PRODUCTION_BLOCKERS_CURRENT.md:13`. Recommendation: do not flip `bridgeActionsImplemented` or wire browser submit/download actions in Phase 3.12; the phase can accept local token/proxy mechanics only. Target part: terminal CTA activation gate.

## Decisions
- The safest Phase 3.12 local implementation shape is a two-step flow: CSRF-protected POST issues an opaque one-time WTC download token; GET proxy consumes that token and streams only from an injected mocked installer source during local acceptance.
- Download tokens should be purpose-specific opaque random values, not Axioma handoff JWTs and not JTI table rows. Store only hashes and lifecycle timestamps.
- The proxy must re-check session user, entitlement, release row, and token ownership immediately before streaming. A valid token alone is not enough.
- No live Axioma endpoint, credentialed `fetch`, SSH, production service, bot, exchange, Stripe, or TradingView operation belongs in this lane or in local acceptance.
- Terminal CTAs stay disabled until download proxy security, account-link OTC hash/active-link uniqueness, external Axioma endpoint-shape/replay acceptance, OP ES256 key provisioning, and browser CTA behavior are accepted in separate scoped work.

## Risks
- A query-string download token is contract-compatible, but it can appear in browser history, local logs, or referrers. The risk is only acceptable with a 32-byte random token, hash-only storage, 5-minute TTL, one-time consume, `Referrer-Policy: no-referrer`, no-store headers, and no audit/log persistence of the raw value.
- Current `axioma_account_links` still stores the older `one_time_code` shape and has no active-link uniqueness boundary (`packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155`), so account-link activation remains unsafe to expose even if download token mechanics pass.
- PGlite can prove most handler behavior, but real Postgres cross-connection token consume races remain stronger evidence. The existing JTI real-PG race test is opt-in and skipped without `REAL_POSTGRES_DATABASE_URL` at `tests/integration/db-axioma-jti.test.ts:132` to `tests/integration/db-axioma-jti.test.ts:158`.
- If the proxy copies upstream headers blindly later, Axioma cookies, internal paths, cache headers, or content sniffing behavior could leak across the WTC boundary.
- Enabling CTAs based only on route skeleton readiness would create a misleading half-state because route readiness does not prove installer streaming, download-token lifecycle, account linking, live Axioma replay behavior, or production key provisioning.

## Verification/tests
- Not run: this was a read-only audit lane and the user explicitly prohibited live services or external calls.
- Inspected current local evidence only: Phase 3.11 aggregate, Axioma route/source files, DB schema/repos, Axioma contract/spec docs, terminal loader/page, and relevant Vitest/static tests listed above.
- Recommended local-only Phase 3.12 verification after implementation: focused Vitest for download token repo lifecycle, route handler tests for CSRF/auth/entitlement/config/token issue, proxy handler tests for first consume/reuse/expiry/revocation and mocked streaming headers, static no-live tests proving no unmocked `fetch` in fail-closed paths, `node scripts/gates.mjs full`, and env-cleared Playwright only after UI remains disabled or explicitly tested as disabled.
- Explicitly not acceptable as Phase 3.12 evidence: live Axioma download, live JWKS fetch, real journal_server endpoint probing, real service-token use, Stripe replay, TradingView automation, bot/exchange calls, SSH, tmux, systemd, or preview-worker mutation.

## Next actions
1. Add the download-token persistence boundary first: `token_hash`, `expires_at`, `consumed_at`, status/revoke fields, release/user/link metadata, and indexes for token lookup and expiry cleanup.
2. Extract a framework-neutral Axioma download handler with injected clock, DB, CSRF, auth, entitlement, token generator/hasher, audit writer, and installer stream provider.
3. Implement token issue as POST-only with CSRF before auth; implement proxy consume as same-user, entitlement-rechecked, atomic single-use, no-store streaming with strict download headers.
4. Add tests that prove no raw token, JWT, OTC, service token, exchange secret, upstream URL, or installer internal path appears in DB events, audit rows, JSON responses, or download headers.
5. Keep `bridgeActionsImplemented: false` and terminal CTAs disabled after local download acceptance; CTA enablement needs a later phase that includes account-link schema safety plus external Axioma endpoint/replay/key acceptance.
