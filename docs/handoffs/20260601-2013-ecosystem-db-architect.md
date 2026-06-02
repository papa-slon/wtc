# ecosystem-db-architect handoff
## Scope
Read-only DB planning lane for Phase 3.12, epoch `20260601-2013`. Scope was DB/repository needs for local Axioma download token/proxy acceptance after Phase 3.11: whether to add schema/migration or reuse `terminal_download_events` / `terminal_release_cache`, how to represent one-time download token state safely, transactional audit requirements, and PGlite test strategy. No source, migrations, fixtures, live DBs, external services, servers, or production services were changed or run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`
- `docs/handoffs/20260601-1946-ecosystem-db-architect.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/db/src/client.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0004_overconfident_frightful_four.sql`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/loader.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/phase23-visible-progress.test.ts`
- `package.json`

## Files changed
None - read-only audit

## Findings
1. HIGH - Phase 3.12 should add a schema migration, but it should extend the existing `terminal_download_events` table rather than create a new download-token table. Evidence: the contract makes Option B the WTC v1 default and says the one-time token is stored in `terminal_download_events`, with `consumed_at` set on use at `docs/CONTRACTS/axioma-bridge.md:235` and `docs/CONTRACTS/axioma-bridge.md:250`; the contract table inventory says `terminal_download_events` owns one-time download token, consumed_at, WTC user, and Axioma user at `docs/CONTRACTS/axioma-bridge.md:590` to `docs/CONTRACTS/axioma-bridge.md:595`; the current schema only has event fields `id`, `userId`, `releaseId`, `version`, `platform`, `ipAddress`, `userAgent`, `entitlementVerified`, and `createdAt` at `packages/db/src/schema.ts:603` to `packages/db/src/schema.ts:617`; migration 0002 created that same non-token shape at `packages/db/migrations/0002_sour_paibok.sql:167` to `packages/db/migrations/0002_sour_paibok.sql:177`. Recommendation: add an additive migration for nullable `token_hash`, `expires_at`, `consumed_at`, `axioma_user_id`, and token lifecycle indexes on `terminal_download_events`, then have new repository helpers require those fields for token rows. Target part: download token persistence.
2. HIGH - Reuse `terminal_release_cache` unchanged for Phase 3.12 local acceptance. Evidence: the release cache already stores current release identity, platform, publish time, release notes, download URL template, checksum, minimum supported version, and current-row indexes at `packages/db/src/schema.ts:582` to `packages/db/src/schema.ts:600`; the repository already enforces one current row per channel/platform inside `upsertTerminalRelease` at `packages/db/src/repositories.ts:1075` to `packages/db/src/repositories.ts:1122`; tests prove current-release demotion at `tests/integration/db-0002.test.ts:181` to `tests/integration/db-0002.test.ts:188`; the terminal loader already derives installer name and treats size as currently absent from schema at `apps/web/src/features/terminal/loader.ts:24` to `apps/web/src/features/terminal/loader.ts:69`. Recommendation: do not add release-cache DDL in this phase; select the current release, validate any required HTTPS upstream/download template in the handler, and leave future manifest fields such as durable `size_bytes` to a release-sync phase if production requires them. Target part: release metadata boundary.
3. HIGH - One-time download token state must store only a strong token hash and must consume with a single conditional update. Evidence: sessions already model raw token secrecy as `tokenHash` with raw token only in the cookie at `packages/db/src/schema.ts:40` to `packages/db/src/schema.ts:50`; audit redaction treats any key containing `token` and 64+ hex values as secret-like at `packages/audit/src/redact.ts:12` to `packages/audit/src/redact.ts:18` and `packages/audit/src/redact.ts:45` to `packages/audit/src/redact.ts:62`; audit docs forbid session tokens/hashes and full request/response bodies in audit logs at `docs/AUDIT_LOG_SCHEMA.md:307` to `docs/AUDIT_LOG_SCHEMA.md:320`; the existing JTI consume helper uses the right DB pattern, a single guarded update followed by a read only to categorize failure, at `packages/db/src/repositories.ts:1218` to `packages/db/src/repositories.ts:1251`. Recommendation: generate a high-entropy raw token, store `sha256(rawToken)` in `terminal_download_events.token_hash`, return the raw token only once in the WTC proxy URL, and consume with `UPDATE ... WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > now RETURNING ...`; never log, audit, fixture, or persist the raw token. Target part: token secrecy and replay prevention.
4. HIGH - Token issue and consume audit must be transaction-coupled to the token state, but the streaming response itself should not be held inside an open DB transaction. Evidence: Phase 3.11 fixed JTI issuance by adding `issueHandoffJtiWithAudit`, which inserts the JTI and `axioma.account_link_init` audit row in one transaction at `packages/db/src/repositories.ts:1180` to `packages/db/src/repositories.ts:1216`; the Phase 3.11 aggregate records that JTI plus audit atomicity was accepted at `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md:64` to `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md:75`; the current download event helper already inserts a row and `terminal.download` audit in one transaction, but has no token lifecycle state at `packages/db/src/repositories.ts:1131` to `packages/db/src/repositories.ts:1135`. Recommendation: add `issueTerminalDownloadTokenWithAudit` and `consumeTerminalDownloadTokenWithAudit` repository helpers; issuance inserts the token row plus issuance audit in one transaction, consumption uses the conditional update plus consume/replay/expired audit in one transaction, and the route streams the mocked or upstream bytes only after DB claim succeeds. Target part: transactional audit truth.
5. MEDIUM - Audit action naming must be settled before implementation because the contract contains token-specific action names that are not registered in `@wtc/audit`. Evidence: `docs/CONTRACTS/axioma-bridge.md:628` to `docs/CONTRACTS/axioma-bridge.md:630` names `axioma.download.token_issued`, `axioma.download.token_consumed`, and `axioma.download.token_expired`; the implemented audit action union only includes `axioma.download_request`, `axioma.release_publish`, JTI actions, and `terminal.download` for this area at `packages/audit/src/audit.ts:68` to `packages/audit/src/audit.ts:83`; `AuditInput.action` is typed as that union at `packages/audit/src/audit.ts:128` to `packages/audit/src/audit.ts:150`; the current audit schema docs list `axioma.download_request` and `terminal.download`, not the contract token-specific names, at `docs/AUDIT_LOG_SCHEMA.md:196` to `docs/AUDIT_LOG_SCHEMA.md:208`. Recommendation: for the narrow Phase 3.12 local acceptance, prefer existing registered actions (`axioma.download_request` for token issuance and `terminal.download` for successful proxy claim) unless the security lane co-lands a package/docs update for the token-specific action names. Target part: audit schema consistency.
6. MEDIUM - The current Axioma download route is still a fail-closed skeleton, so repository tests alone would not prove route acceptance. Evidence: the route authenticates the user, checks `axioma_terminal` access, requires route readiness, then always returns `501 bridge_not_implemented` with no live call at `apps/web/src/app/api/axioma/download/route.ts:16` to `apps/web/src/app/api/axioma/download/route.ts:41`; the only current download route test is static source checking at `tests/integration/axioma-skeleton-static.test.ts:33` to `tests/integration/axioma-skeleton-static.test.ts:40`; the only current DB download tests prove `recordDownloadEvent` happy-path audit, not token issue/consume/expiry/reuse route behavior, at `tests/integration/db-0002.test.ts:190` to `tests/integration/db-0002.test.ts:197` and `tests/integration/phase23-visible-progress.test.ts:188` to `tests/integration/phase23-visible-progress.test.ts:207`. Recommendation: mirror the Phase 3.11 handler pattern with an extracted download handler and a separate proxy/consume handler using injected DB/env/auth/access/clock/streamer dependencies; keep the live Axioma fetch mocked or absent in this phase. Target part: local route acceptance harness.
7. MEDIUM - PGlite is the right default for Phase 3.12 tests, but it cannot prove cross-connection consume races. Evidence: Phase 3.11 handler tests build fresh PGlite databases and replay all migrations per test at `tests/integration/axioma-journal-handoff-handler.test.ts:29` to `tests/integration/axioma-journal-handoff-handler.test.ts:36`; the JTI DB suite documents that PGlite is single-connection and keeps cross-connection consume races as opt-in real Postgres only at `tests/integration/db-axioma-jti.test.ts:132` to `tests/integration/db-axioma-jti.test.ts:158`; the repository already documents nested transaction/savepoint fragility under PGlite and avoids nested transaction composition in another critical path at `packages/db/src/repositories.ts:1657` to `packages/db/src/repositories.ts:1663`. Recommendation: add PGlite tests for migration columns/index behavior, token issuance rollback, hash-only storage, single consume, replay, expired token, denied entitlement no row, and mocked stream success; add an opt-in `REAL_POSTGRES_DATABASE_URL` race test later, not as a blocker for local acceptance. Target part: DB test strategy.

## Decisions
- Add a migration for Phase 3.12 if token/proxy acceptance is implemented. The migration should extend `terminal_download_events`; do not create a separate token table.
- Reuse `terminal_release_cache` as-is for this phase. No release-cache migration is needed for local token/proxy acceptance.
- Store only `token_hash` for one-time download tokens. The raw token is response-only and must never enter DB, audit, logs, screenshots, or fixtures.
- Model token consumption as an atomic DB claim, not a SELECT-then-UPDATE. Failure categorization may read after the failed update, following the JTI pattern.
- Keep token issue and token consume audit writes inside the same repository transaction as the state mutation.
- Do not keep a DB transaction open across response streaming. If streaming fails after a token is consumed, the safe recovery is to request a fresh token.
- Keep account-link OTC hash migration, active-link uniqueness, live Axioma endpoint-shape checks, and enabled browser CTAs out of this DB lane unless a separate phase scopes them.

## Risks
- If implementation tries to reuse the current `recordDownloadEvent` unchanged, it can record a download event but cannot verify, expire, or single-use a token.
- If implementation writes raw token values, token hashes, or proxy URLs into audit payloads, the audit trail becomes both secret-bearing and noisy because redaction will mask token-shaped fields.
- If implementation uses the contract-only `axioma.download.token_*` action names without updating `@wtc/audit` and docs in the same phase, typecheck or audit consistency will fail.
- If the proxy marks tokens consumed only after streaming completes, duplicate requests can race before the final update. If it marks consumed before streaming, interrupted downloads require requesting a fresh token. Prefer the latter for security.
- PGlite cannot prove two independent pools racing the same token. Keep the DB primitive race-safe by SQL shape and schedule an opt-in real-Postgres race test when credentials are available.

## Verification/tests
Not run in this read-only planning lane. Only file inspection and `rg` searches were performed; no live DB, external service, server, migration, or test command was run.

Recommended implementation gates:
- `npm test -- tests/integration/axioma-download-handler.test.ts tests/integration/db-axioma-download-token.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-0002.test.ts`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run db:generate -w @wtc/db`
- `node scripts/gates.mjs full`

## Next actions
1. Add migration 0009 extending `terminal_download_events` with download-token lifecycle columns and indexes, keeping existing event rows valid.
2. Add `issueTerminalDownloadTokenWithAudit` and `consumeTerminalDownloadTokenWithAudit` helpers in `packages/db/src/repositories.ts`.
3. Extract the download route into injectable handlers for token issue and token proxy/consume, with mocked streaming and no live Axioma call.
4. Add PGlite-backed tests for token issue, rollback, no raw token storage, consume once, replay/expired failures, audit rows, and entitlement-denied no-side-effect behavior.
