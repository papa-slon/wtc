# Phase 3.13 Axioma account-link hash/uniqueness persistence handoff

## Scope
Local-only Axioma account-link persistence hardening: hash-only OTC state for new local flows, legacy plaintext OTC cleanup, active-link uniqueness, repository issue/consume/read helpers, and focused PGlite coverage. Out of scope: account-link HTTP routes, live Axioma calls, live installer streaming, browser CTA enablement, production key changes, Stripe, TradingView automation, bot/exchange control, and service mutation.

## Per-agent handoffs
- [`docs/handoffs/20260601-2047-ecosystem-security-auditor.md`](20260601-2047-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-2047-ecosystem-axioma-bridge-auditor.md`](20260601-2047-ecosystem-axioma-bridge-auditor.md)
- [`docs/handoffs/20260601-2047-ecosystem-db-architect.md`](20260601-2047-ecosystem-db-architect.md)
- [`docs/handoffs/20260601-2047-ecosystem-tests-runner.md`](20260601-2047-ecosystem-tests-runner.md)

## Files inspected
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0009_wide_orphan.sql`
- `packages/db/migrations/meta/0009_snapshot.json`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`

## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0010_axioma_account_link_hash.sql`
- `packages/db/migrations/meta/0010_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Findings
1. HIGH - Account-link persistence no longer needs plaintext OTC for new local flows. Evidence: migration `packages/db/migrations/0010_axioma_account_link_hash.sql` adds `link_nonce_hash`, `consumed_at`, `revoked_at`, `linked_at`, `last_verified_at`, `error_message`, and `updated_at`; it clears legacy `one_time_code` and revokes pending legacy rows. Recommendation: keep raw OTC out of DB, audit, logs, URLs, and docs for all future route work. Target part: account-link OTC secrecy.
2. HIGH - Active-link uniqueness is now DB-backed locally. Evidence: `aal_active_user_idx` and `aal_active_axioma_user_idx` are present in schema, migration, and PGlite tests; duplicate active WTC-user and Axioma-user links reject while revoked history and pending rows are allowed. Recommendation: keep these partial indexes as final authority and add route-level conflict mapping when completion handlers land. Target part: active-link mapping safety.
3. HIGH - Repository helpers now cover local issue/consume semantics but do not replace route-level security. Evidence: `issueAxiomaAccountLinkNonceWithAudit()`, `consumeAxiomaAccountLinkNonceWithAudit()`, and `getLinkedAxiomaAccountForUser()` exist in `packages/db/src/repositories.ts`; no `apps/web/src/app/api/axioma/account-link/*` routes exist in this phase. Recommendation: next phase should implement extracted handlers with CSRF/auth/entitlement/readiness for init and a service-auth completion envelope. Target part: account-link route boundary.
4. MEDIUM - Open Journal now uses the deterministic linked-account helper. Evidence: `apps/web/src/features/terminal/axioma-journal-handoff.ts` imports and calls `getLinkedAxiomaAccountForUser()` instead of selecting linked rows ad hoc. Recommendation: keep one linked-account definition in the DB package. Target part: handoff account mapping.
5. MEDIUM - Terminal CTAs remain disabled. Evidence: this phase did not change `apps/web/src/features/terminal/loader.ts` or CTA enablement; static tests still assert `bridgeActionsImplemented: false`. Recommendation: keep CTAs disabled until account-link routes, live Axioma endpoint/key/download acceptance, and browser action e2e gates pass in a later phase. Target part: UI activation gate.

## Decisions
- Kept legacy `one_time_code` nullable for migration compatibility, but all current app paths ignore it and migration `0010` clears existing plaintext values.
- Used 10-minute-compatible DB shape from the bridge contract while leaving HTTP route implementation to a separate phase.
- Required canonical lowercase SHA-256 hex input at the repository boundary to reduce accidental raw-token persistence.
- Reused existing audit action codes `axioma.account_link_init` and `axioma.account_link_complete`; audit payloads omit raw OTC and nonce hashes.

## Risks
- Repository helpers still accept hashes from callers; future routes must generate raw OTC server-side, hash it immediately, and return the raw value only once.
- Unique conflicts from true concurrent completes are enforced by indexes but still need route-level error mapping and optional real-Postgres cross-connection acceptance.
- The account-link completion auth envelope is not implemented; local persistence hardening does not prove live Axioma trust boundaries.
- Docs still contain older historical references outside the current top sections; current status blocks and contract sections now mark the local truth.

## Verification/tests
RUN:
- `npm test -- tests/integration/db-axioma-account-link.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-skeleton-static.test.ts` - PASS, 3 files, 20 passed.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes.
- `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
- `node scripts/gates.mjs full` - PASS, 9/9 gates, including governance, check:core, lint, typecheck, typecheck-web, secret:scan, full Vitest, db:generate, and build. Full Vitest result: 67 files, 657 passed / 8 skipped. `db:generate` result: no schema changes.
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; node scripts/gates.mjs e2e` - PASS, 44 passed.
- Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- Account-link HTTP route handlers - deliberately deferred to next phase.
- Live Axioma endpoint-shape/JWKS/open-journal/download/OTC acceptance - external B4 scope and no credentials/contracts provided.
- Live Axioma installer streaming - still blocked.
- Live Axioma service-account token exchange - not scoped.
- Live Stripe checkout or webhook replay - outside this phase.
- Live TradingView automation - outside this phase and forbidden without explicit scoped approval.
- Live bot/exchange control - forbidden by current safety gates.
- SSH, tmux, systemd, preview-worker, or production service mutation - outside this phase.
- Real-Postgres cross-connection consume race - no throwaway `wtc_test*` database URL provided.

## Next actions
1. Implement account-link route handlers in a new session: init, completion service-auth envelope, and unlink/revoke, all using the new DB helpers.
2. Add route-level tests for CSRF-before-auth, entitlement/readiness fail-closed behavior, JSON-body completion, no query-string OTC, audit redaction, and no side effects on denial.
3. Keep B4 blocked until live Axioma endpoint shapes, OP key provisioning, installer streaming, account-link completion, and browser CTA behavior are scoped and observed green.
