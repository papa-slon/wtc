# ecosystem-axioma-bridge-auditor handoff
## Scope
Read-only Axioma bridge audit lane for WTC Ecosystem Platform Phase 3.12, epoch `20260601-2013`.

Scope covered: local Axioma download token/proxy readiness after Phase 3.11; docs/contracts versus current code; `/api/axioma/download` route shape; terminal release/download tables; one-time token or proxy model; endpoint-shape blockers; no live fetch in local acceptance; POST/body versus GET token risks; disabled terminal CTAs; and exact external B4 blockers.

No live Axioma, live server, SSH, tmux, systemd, bot, exchange, Stripe, TradingView, or preview-worker operation was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`
- `docs/handoffs/20260601-1946-ecosystem-axioma-bridge-auditor.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DATA_MODEL.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `.env.example`
- `packages/config/src/env.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - The Axioma download route is still a fail-closed skeleton, not token/proxy acceptance. Evidence: `apps/web/src/app/api/axioma/download/route.ts:16` exposes only `GET`; it authenticates and entitlement-checks at `apps/web/src/app/api/axioma/download/route.ts:17-27`; it returns `503 not_configured` when route prerequisites are absent at `apps/web/src/app/api/axioma/download/route.ts:29-33`; and even when configured it returns `501 bridge_not_implemented` with a no-live-call detail at `apps/web/src/app/api/axioma/download/route.ts:35-40`. The static test asserts the route contains no `fetch(` at `tests/integration/axioma-skeleton-static.test.ts:33-40`. Recommendation: implement the download boundary as a separate local phase with a mocked stream, no live Axioma fetch, and dynamic tests for auth, entitlement, token issue, token consume, replay, expiry, and no secret logging. Target part: `/api/axioma/download` / future `/api/axioma/download/terminal`.

2. HIGH - The one-time download-token model described by the contract is not present in the schema or repositories. Evidence: the contract requires a time-limited token stored in `terminal_download_events`, consumed via the WTC proxy, with expired/consumed tokens returning `410` at `docs/CONTRACTS/axioma-bridge.md:235-250`. Current `terminal_download_events` has only `userId`, `releaseId`, `version`, `platform`, `ipAddress`, `userAgent`, `entitlementVerified`, and `createdAt` at `packages/db/src/schema.ts:603-615`; migration `0002` creates the same audit-only shape at `packages/db/migrations/0002_sour_paibok.sql:167-177`; and `recordDownloadEvent` only inserts a download event plus `terminal.download` audit row at `packages/db/src/repositories.ts:1131-1135`. Recommendation: add a token lifecycle model before proxy activation, either by extending `terminal_download_events` or adding a dedicated table with `token_hash`, `expires_at`, `consumed_at`, release/user binding, purge semantics, and redacted audit events. Target part: terminal download DB/repository lifecycle.

3. MEDIUM - The docs currently mix two different truths for terminal tables: the tables exist, but the download-token contract fields do not. Evidence: the contract activation checklist still says `terminal_release_cache`, `terminal_download_events`, and `terminal_license_events` are TARGET at `docs/CONTRACTS/axioma-bridge.md:1046-1050` and repeats that they are "not yet migrated" at `docs/CONTRACTS/axioma-bridge.md:1078`; current code has `terminalReleaseCache`, `terminalDownloadEvents`, and `terminalLicenseEvents` in `packages/db/src/schema.ts:582-624`; `DATA_MODEL.md` marks `terminal_download_events` as REAL-in-0002 and defines it as an audit trail at `docs/DATA_MODEL.md:608-625`. Recommendation: reconcile the contract to say the release/download/license audit tables exist, while one-time token columns/repos remain TARGET/B4. Target part: docs/contracts truth.

4. HIGH - Endpoint shape is not aligned with the default download contract. Evidence: the contract's recommended Option B is a WTC proxy endpoint at `/api/axioma/download/terminal` with a `download_url` containing `?token=<one-time-token>` at `docs/CONTRACTS/axioma-bridge.md:235-242`; the current implementation file is `apps/web/src/app/api/axioma/download/route.ts` and exposes only `GET` at `apps/web/src/app/api/axioma/download/route.ts:16`; the terminal page renders disabled buttons rather than a form/action/link at `apps/web/src/app/(app)/app/terminal/page.tsx:166-179` and `apps/web/src/app/(app)/app/terminal/page.tsx:191-204`. Recommendation: decide and document the concrete endpoint shape before implementation: either keep GET streaming behind an opaque, hashed, single-use, short-TTL token with no-store/referrer/log controls, or use POST to mint a short-lived server-side/cookie-bound download session and then GET the stream. Target part: download endpoint contract and browser handoff.

5. MEDIUM - POST-body/no-query protection is good for journal handoff, but the download contract's query token needs explicit leakage controls before it is safe. Evidence: Phase 3.11 verifies journal handoff responses return `{ postUrl, token, expiresAt, method: 'POST' }` and no `?token=` at `tests/integration/axioma-journal-handoff-handler.test.ts:197-206`; the contract says production journal handoff is POST, not GET, at `docs/CONTRACTS/axioma-bridge.md:1028-1029`; but the download response example still places the one-time token in a URL query at `docs/CONTRACTS/axioma-bridge.md:239-250`. Recommendation: if a query download token remains, make it random opaque material stored only as a hash, TTL 5 minutes or less, single-use, no-store, no raw-token audit/log output, and preferably scoped to user/release/session. Target part: token secrecy and browser-download UX.

6. INFO - Terminal CTAs remain correctly disabled after Phase 3.11. Evidence: `loadTerminalRelease` returns `bridgeActionsImplemented: false` in both demo and Postgres modes at `apps/web/src/features/terminal/loader.ts:101-123`; the page enables actions only when `access.allowed && routeSkeletonConfigured && bridgeActionsImplemented` at `apps/web/src/app/(app)/app/terminal/page.tsx:30-34`; the Download and Open Journal buttons are disabled when that gate is false at `apps/web/src/app/(app)/app/terminal/page.tsx:166-179` and `apps/web/src/app/(app)/app/terminal/page.tsx:194-204`; the page also warns that bridge actions are fail-closed at `apps/web/src/app/(app)/app/terminal/page.tsx:76-82`. Recommendation: keep this false until download token/proxy, account-link, live endpoint acceptance, and browser e2e action coverage exist. Target part: `/app/terminal` activation gate.

7. HIGH - Account-link activation remains blocked by the older OTC schema and lack of active-link uniqueness. Evidence: `axioma_account_links` still stores `oneTimeCode` and `codeExpiresAt` directly, with no `link_nonce_hash`, consumed timestamp, or active-link uniqueness boundary, at `packages/db/src/schema.ts:146-155`; the Phase 3.11 aggregate explicitly kept account-link OTC hash migration and uniqueness as separate B4 work at `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md:73-82`; `PRODUCTION_BLOCKERS_CURRENT.md` lists account-link OTC hash migration plus active-link uniqueness as a B4 blocker at `docs/PRODUCTION_BLOCKERS_CURRENT.md:10-13`. Recommendation: land an account-link migration and repo tests before enabling Connect Account or Open Journal CTAs. Target part: account-link persistence and uniqueness.

8. HIGH - External B4 blockers remain exact and not cleared by local Phase 3.11 work. Evidence: current blockers list real download/open-journal/OTC activation blocked on endpoint shapes, OP ES256 key provisioning, replay-model confirmation, account-link OTC hash migration plus active-link uniqueness, installer/download security, and enabled browser CTA acceptance at `docs/PRODUCTION_BLOCKERS_CURRENT.md:10-13`; the Axioma token spec keeps EC P-256 key, confirmed `journal_server` endpoint shapes, live Open-Journal/Download activation, replay decision, and OTC-to-hash migration as TARGET/B4 at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:8-18`; Q-15 remains open until Axioma confirms Option A versus Option B replay handling and the exact endpoint/auth envelope at `docs/OPEN_QUESTIONS.md:326-336`; the activation checklist still has unchecked service token, `ENTITLEMENT_ENABLED`, release manifest, OTC endpoint, download proxy endpoint, live Axioma token validation, and tests at `docs/CONTRACTS/axioma-bridge.md:1042-1058`. Recommendation: do not claim B4 acceptance or enable CTAs until those external facts are provided and tested in a separate scoped session. Target part: production B4 acceptance.

## Decisions
- Treat Phase 3.11 as real local journal-handoff progress, not download readiness.
- Treat `/api/axioma/download` as skeleton-only and fail-closed.
- Do not run live Axioma, live servers, SSH, tmux, systemd, bots, exchanges, Stripe, TradingView, or Playwright/browser preview from this read-only lane.
- Do not run full gates because they can write generated artifacts (`coverage`, `test-results`, `.next`, logs) and this lane is allowed to write only this handoff.
- Keep `bridgeActionsImplemented` false until the download and account-link slices have their own local acceptance plus external endpoint-shape evidence.

## Risks
- A future implementer could mistake existing `terminal_download_events` for a token store because the contract says it stores one-time tokens, while the actual table is currently only an audit/event table.
- The current route path (`/api/axioma/download`) and contract path (`/api/axioma/download/terminal`) can diverge into a silent endpoint-shape bug if not reconciled before tests.
- Query-string download tokens are convenient for browser downloads but can leak through browser history, referrers, reverse-proxy logs, screenshots, and analytics unless explicitly controlled.
- Enabling CTAs before account-link hash/uniqueness and download token/proxy acceptance would create a user-visible path that either fails late or depends on unproven live Axioma behavior.
- Local WTC tests cannot prove live Axioma `/wtc-handoff`, JWKS cache behavior, Option A consume calls, release manifest shape, installer stream headers, or service-account auth envelope.

## Verification/tests
RUN:
- Read-only file inspection with `rg` and `Get-Content` for the required docs, route handlers, terminal feature files, DB schema/repos, Axioma bridge package, and integration tests.
- Static absence checks for download token/proxy implementation files and `fetch(` usage under Axioma route/feature/package paths.
- Existing repo state check from this CWD: `git status --short` returned `fatal: not a git repository`, so no git diff gate is available from this directory.

NOT RUN:
- `npm test` / focused Vitest: not run because this is a read-only audit lane and test runners can update local artifacts.
- `node scripts/gates.mjs full`: not run because full gates can write `coverage`, build, and test output artifacts.
- Playwright/e2e: not run because it starts a server and writes artifacts.
- Real Axioma endpoint-shape/JWKS/consume/download acceptance: not run, external B4 scope and explicitly prohibited for this lane.
- Live Axioma, live servers, SSH, tmux, systemd, bots, exchanges, Stripe, TradingView, preview-worker, or production-service checks: not run.

## Next actions
1. Reconcile `docs/CONTRACTS/axioma-bridge.md` to distinguish existing terminal release/download/license audit tables from missing download-token lifecycle fields/repos.
2. Choose the download endpoint shape: `/api/axioma/download/terminal` per contract, or update the contract to the current route path before code lands.
3. Implement local-only download acceptance in a new phase: POST/token issuance or equivalent, hashed single-use token, 5-minute TTL, consume/replay/expiry behavior, no raw-token audit/log output, and mocked stream tests with no live fetch.
4. Land account-link OTC hash migration and active-link uniqueness before enabling account-link or Open Journal browser CTAs.
5. Keep B4 blocked until Axioma provides endpoint shapes, OP ES256 key provisioning, replay model confirmation, release/download contract details, and live acceptance approval.
