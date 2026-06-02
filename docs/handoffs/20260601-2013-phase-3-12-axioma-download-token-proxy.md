# Phase 3.12 Axioma download token/proxy local acceptance handoff

## Scope
Local-only WTC Axioma download token/proxy acceptance without live Axioma calls, live installer streaming, browser CTA enablement, account-link OTC migration, or production key changes.

## Per-agent handoffs
- [`docs/handoffs/20260601-2013-ecosystem-security-auditor.md`](20260601-2013-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-2013-ecosystem-axioma-bridge-auditor.md`](20260601-2013-ecosystem-axioma-bridge-auditor.md)
- [`docs/handoffs/20260601-2013-ecosystem-db-architect.md`](20260601-2013-ecosystem-db-architect.md)
- [`docs/handoffs/20260601-2013-ecosystem-tests-runner.md`](20260601-2013-ecosystem-tests-runner.md)

## Files inspected
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0009_wide_orphan.sql`
- `packages/db/migrations/meta/0009_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Findings
1. HIGH - Axioma download token semantics are now durable locally. Evidence: migration `packages/db/migrations/0009_wide_orphan.sql` adds `token_hash`, `expires_at`, `consumed_at`, `revoked_at`, and `axioma_user_id`; `packages/db/src/repositories.ts` adds hash-only issue and atomic consume helpers. Recommendation: keep raw tokens out of DB/audit/logs and run cleanup in a later worker phase. Target part: download token lifecycle.
2. HIGH - The route path mismatch is resolved locally. Evidence: `apps/web/src/app/api/axioma/download/route.ts` handles token issuance and `apps/web/src/app/api/axioma/download/terminal/route.ts` handles token consume/proxy shape; `apps/web/src/features/terminal/axioma-download.ts` provides the shared handler. Recommendation: keep both routes as thin adapters around the handler. Target part: Axioma download boundary.
3. HIGH - Runtime live streaming remains intentionally blocked. Evidence: the runtime adapters do not wire a live installer fetcher, so proxy GET returns `501 bridge_not_implemented` before consuming a token; local success uses an injected fixture provider in tests. Recommendation: do not claim live Axioma download readiness until endpoint shape, service credential, streaming provider, and CTA behavior are separately accepted. Target part: B4 production activation.
4. MEDIUM - Browser CTAs remain disabled as required. Evidence: this phase did not change `apps/web/src/features/terminal/loader.ts` or terminal CTA enablement, and docs keep B4 blocked. Recommendation: keep CTA enablement out of local-only token/proxy work. Target part: terminal UI safety.

## Decisions
- Reused `terminal_download_events` as the local token ledger instead of creating a new table, following the db-architect handoff.
- Stored only token hashes and token metadata; the raw token is returned once in the issuance response URL.
- Kept the Next runtime fail-closed for installer streaming until a future live provider is deliberately wired and accepted.
- Used the existing audit actions `axioma.download_request` and `terminal.download` rather than introducing new audit action codes in this phase.

## Risks
- Query-string download tokens can appear in local browser history or infrastructure logs; the risk is constrained by 32-byte random values, hash-only persistence, five-minute TTL, one-time consume, no-store responses, and `Referrer-Policy: no-referrer`.
- Unknown-token probe attempts create failure audit rows. This is acceptable for local acceptance but may need rate limiting before production activation.
- Account-link OTC hashing/active-link uniqueness remains a separate B4 blocker; download token readiness does not make account linking safe.
- Live installer streaming is not proven because no live Axioma endpoint or credential was used.

## Verification/tests
RUN:
- `npm test -- tests/integration/axioma-download-handler.test.ts tests/integration/db-axioma-download-token.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts` - PASS, 6 files, 35 passed / 1 skipped.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes.
- `npm run typecheck` - PASS.
- `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
- `node scripts/gates.mjs full` - PASS, 9/9 gates, including governance, check:core, lint, typecheck, typecheck-web, secret:scan, full Vitest, db:generate, and build. Full Vitest result: 66 files, 649 passed / 8 skipped. `db:generate` result: no schema changes.
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; node scripts/gates.mjs e2e` - PASS, 44 passed.
- Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- Live Axioma endpoint-shape/JWKS/consume/download checks - external B4 scope and no credentials/contracts provided.
- Live installer streaming from Axioma - deliberately blocked by the runtime adapter.
- Live Stripe replay - outside this phase.
- Throwaway real-Postgres race acceptance - no database URL provided and outside this phase.
- Live TradingView automation - outside this phase and forbidden without explicit scoped approval.
- Live bot/exchange control - forbidden by current safety gates.
- SSH, tmux, systemd, preview-worker, or production service mutation - outside this phase.

## Next actions
1. Keep B4 blocked until live Axioma endpoint shapes, OP key provisioning, live installer streaming, account-link OTC hashing/uniqueness, and browser CTA acceptance are scoped in a new session.
2. Implement account-link OTC hash migration plus active-link uniqueness in a separate phase before exposing account-link activation.
3. Wire a real installer streaming provider only in a scoped live Axioma acceptance phase with credentials and endpoint contracts available.
