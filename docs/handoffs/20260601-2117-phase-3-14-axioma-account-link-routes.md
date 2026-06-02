# Phase 3.14 Axioma account-link route handlers handoff

## Scope
Local-only Axioma account-link HTTP route acceptance on top of Phase 3.13 hash-only persistence. Implemented extracted
handlers and thin Next adapters for init, service-auth completion, and unlink/revoke. Out of scope: live Axioma calls,
live installer streaming, browser CTA enablement, production key changes, Stripe, TradingView automation, bot/exchange
control, SSH/tmux/systemd/preview-worker, and production service mutation.

## Per-agent handoffs
- [`docs/handoffs/20260601-2117-ecosystem-security-auditor.md`](20260601-2117-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-2117-ecosystem-axioma-bridge-auditor.md`](20260601-2117-ecosystem-axioma-bridge-auditor.md)
- [`docs/handoffs/20260601-2117-ecosystem-backend-implementer.md`](20260601-2117-ecosystem-backend-implementer.md)
- [`docs/handoffs/20260601-2117-ecosystem-tests-runner.md`](20260601-2117-ecosystem-tests-runner.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`

## Files changed
- `packages/db/src/repositories.ts`
- `apps/web/src/features/terminal/axioma-account-link.ts`
- `apps/web/src/app/api/axioma/account-link/init/route.ts`
- `apps/web/src/app/api/axioma/account-link/complete/route.ts`
- `apps/web/src/app/api/axioma/account-link/route.ts`
- `tests/integration/axioma-account-link-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Findings
1. HIGH - Local account-link route handlers now exist and are testable without importing Next server plumbing. Evidence:
   `apps/web/src/features/terminal/axioma-account-link.ts` exports separate init, complete, and delete handlers, and the three
   route files under `apps/web/src/app/api/axioma/account-link/` are thin adapters. Recommendation: keep route behavior in the
   extracted handler so Vitest can continue to prove request semantics. Target part: account-link route boundary.
2. HIGH - The completion route is service-auth and JSON-body only, and it re-checks current WTC entitlement before consume.
   Evidence: the handler rejects any query string, verifies bearer auth against `AXIOMA_BRIDGE_API_TOKEN`, looks up the pending
   row by nonce hash, calls `accessFor(pending.userId, 'axioma_terminal')`, records a redacted failure audit on entitlement
   denial, then consumes via `consumeAxiomaAccountLinkNonceWithAudit()`. Recommendation: keep this current-access check until
   a dedicated inbound Axioma token model and entitlement callback contract are approved. Target part: completion safety.
3. HIGH - Raw OTC disclosure remains one-time and hash-only at rest. Evidence: init returns `{ code, expiresAt, state,
   method }` once, DB rows store only `link_nonce_hash`, completion accepts code only in the JSON body, and tests assert raw
   OTC/hash redaction in audit/responses. Recommendation: do not add GET/readback endpoints for account-link codes. Target part:
   OTC secrecy.
4. MEDIUM - Unlink/revoke is now transactional and audited. Evidence: `revokeAxiomaAccountLinksForUserWithAudit()` revokes
   pending/linked rows and writes `axioma.account_link_revoke`; the DELETE handler uses CSRF/session/entitlement/readiness
   before calling it. Recommendation: decide in a later product/security review whether self-unlink should remain entitlement
   gated or become a documented exception for expired users. Target part: unlink semantics.
5. MEDIUM - Terminal CTAs remain correctly disabled and B4 remains blocked. Evidence: this phase did not change
   `bridgeActionsImplemented: false` or terminal button gates; docs now distinguish local route acceptance from live Axioma
   endpoint/key/download/account-link acceptance. Recommendation: keep CTA enablement as a later live-gated phase. Target part:
   UI activation gate.

## Decisions
- Used the stricter five-minute OTC TTL from `docs/RBAC_MATRIX.md`, aligning account-link with download token lifetime.
- Reused `AXIOMA_BRIDGE_API_TOKEN` for the local service-auth completion envelope, documented as local-only acceptance; a
  dedicated inbound token can be split later when production Axioma endpoint contracts are confirmed.
- Accepted both `axiomaUserId` and `axioma_user_id` in the completion JSON body to bridge TypeScript and contract naming.
- Kept init/unlink as browser-session mutations with CSRF-before-user ordering.
- Did not enable terminal CTAs or wire browser UI actions in this backend-only slice.

## Risks
- Reusing `AXIOMA_BRIDGE_API_TOKEN` bidirectionally is acceptable for local acceptance but should be revisited before
  production key rotation.
- True cross-connection race behavior is protected by DB partial indexes but was not proven against a fresh real Postgres URL
  in this phase.
- Users without current entitlement cannot self-unlink through the route; this preserves the existing mutation convention but
  may need a documented exception later.
- Live Axioma may require a different completion field shape or inbound credential once endpoint contracts are confirmed.

## Verification/tests
RUN:
- `npm test -- tests/integration/axioma-account-link-handler.test.ts tests/integration/axioma-skeleton-static.test.ts` - PASS,
  2 files, 16 passed.
- `npm test -- tests/integration/axioma-account-link-handler.test.ts tests/integration/db-axioma-account-link.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/db-axioma-download-token.test.ts` - PASS, 8 files, 52 passed / 1 skipped.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes.
- `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
- `node scripts/gates.mjs full` - PASS, 9/9 gates, including governance, check:core, lint, typecheck, typecheck-web,
  secret:scan, full Vitest, db:generate, and build.
- `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; node scripts/gates.mjs e2e` - PASS, 44 passed.
- Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- Live Axioma endpoint-shape/JWKS/open-journal/download/account-link acceptance - external B4 scope and no credentials/contracts provided.
- Live Axioma installer streaming - still blocked.
- Live Axioma service-account token exchange or dedicated inbound token rotation - not scoped.
- Browser CTA enablement or e2e for enabled terminal account-link/download/journal buttons - deliberately not implemented.
- Live Stripe checkout or webhook replay - outside this phase.
- Live TradingView automation - outside this phase and forbidden without explicit scoped approval.
- Live bot/exchange control - forbidden by current safety gates.
- SSH, tmux, systemd, preview-worker, or production service mutation - outside this phase.
- Real-Postgres cross-connection account-link consume race - no throwaway `wtc_test*` database URL provided.

## Next actions
1. Keep B4 blocked until live Axioma endpoint shapes, OP ES256 key provisioning, live account-link completion, installer
   streaming, and browser CTA behavior are scoped and observed green.
2. Before production, consider splitting inbound account-link completion auth from outbound `AXIOMA_BRIDGE_API_TOKEN`.
3. Decide whether self-unlink should remain entitlement-gated or become a documented exception for expired/revoked users.
