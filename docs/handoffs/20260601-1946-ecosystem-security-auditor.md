# ecosystem-security-auditor handoff
## Scope
Read-only security planning lane for phase epoch `20260601-1946`. Scope: plan the safest local implementation for extracting and testing `/api/axioma/journal-handoff` as a Request-level handler without live Axioma, focusing on CSRF ordering, entitlement fail-closed behavior, signer readiness, JTI insert plus audit atomicity, response secrecy, and why terminal CTAs must remain disabled.

No source code, migrations, fixtures, product docs, live services, external calls, test commands, preview-worker, SSH, tmux, systemd, bot, exchange, Stripe, TradingView, or live Axioma operations were run from this lane. The only write from this lane is this canonical handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `packages/auth/src/csrf.ts`
- `packages/entitlements/src/engine.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `.env.example`

## Files changed
None - read-only audit

## Findings
1. HIGH - CSRF must remain the first state-changing gate after method validation when the route is extracted. Evidence: the current route returns POST-only `405` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:22-24`, then validates CSRF before `requireUser`, entitlement, DB readiness, signing, JTI insert, or audit at `apps/web/src/app/api/axioma/journal-handoff/route.ts:44-64`; the CSRF token is derived from the session cookie at `apps/web/src/lib/csrf.tsx:19-22`, and the constant-time verifier rejects missing or mismatched tokens at `packages/auth/src/csrf.ts:14-20`. Recommendation: extract `handleAxiomaJournalHandoffRequest(req, deps)` so method and CSRF checks run before all injected `getUser`, `accessFor`, `getDb`, signer, JTI, and audit dependencies; add tests proving a bad/missing CSRF returns `403 no-store` and no dependency beyond CSRF is called. Target part: `/api/axioma/journal-handoff` request boundary.
2. HIGH - Entitlement fail-closed behavior must be injected and asserted dynamically before any token or JTI side effect. Evidence: the current route calls `accessFor(user.id, 'axioma_terminal')` and returns `403 entitlement_denied` before DB readiness or handoff issuance at `apps/web/src/app/api/axioma/journal-handoff/route.ts:56-65`; `accessFor` delegates to the entitlement engine at `apps/web/src/lib/access.ts:5-8`; the engine grants only active/grace and otherwise returns denying reasons at `packages/entitlements/src/engine.ts:113-150`; the seed makes entitlements the only access source of truth at `docs/handoffs/0000-orchestrator-seed.md:76-82` and `docs/handoffs/0000-orchestrator-seed.md:120`. Recommendation: the handler tests should cover `none`, `pending_payment`, `expired`, `revoked`, `refunded`, `chargeback`, `manual_review`, and `grace`; all denied states must return `403`, must not call signer, must not insert a JTI, must not write issuance audit, and must not include token or postUrl in the response. Target part: Axioma entitlement gate.
3. HIGH - Signer readiness should use parseable ES256/JWKS readiness, not only env-name presence. Evidence: route readiness currently treats `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` presence as enough at `apps/web/src/features/terminal/axioma-routes.ts:23-35`; signer resolution then parses the key during `buildAxiomaHandoff` at `apps/web/src/features/terminal/axioma-routes.ts:49-77`; the JWKS readiness helper already rejects invalid key material at `apps/web/src/features/terminal/axioma-jwks-readiness.ts:11-23`, and tests assert invalid key rejection at `tests/integration/axioma-jwks-readiness.test.ts:34-41`; the signer fence forbids HS256 fallback in staging/production at `packages/axioma-bridge/src/signer.ts:52-67`. Recommendation: make the extracted handler depend on a readiness object or signer factory that proves a parseable ES256 key before JTI insert; add generated P-256 success tests and invalid-key `503 no-store` tests proving no JTI/audit/token side effects. Target part: Axioma signer readiness.
4. HIGH - JTI issuance and issuance audit are still split, so the next implementation must make them atomic before any CTA can call the route. Evidence: the current route builds the handoff at `apps/web/src/app/api/axioma/journal-handoff/route.ts:73-78`, inserts the JTI at `apps/web/src/app/api/axioma/journal-handoff/route.ts:79-84`, then writes audit through the app-level audit writer at `apps/web/src/app/api/axioma/journal-handoff/route.ts:85-92`; the repository notes `recordHandoffJti` is a pure insert and leaves issuance audit to the route at `packages/db/src/repositories.ts:1165-1177`; the route gets DB and audit through separate backend selectors at `apps/web/src/lib/backend.ts:44-47` and `apps/web/src/lib/backend.ts:63`. Recommendation: implement a DB repository helper that inserts the JTI and the `axioma.account_link_init` audit row in one transaction, or pass a transaction-scoped audit insert explicitly; add a failure-injection test proving an audit failure rolls back the JTI and no token is returned. Target part: Axioma issuance replay/audit truth.
5. MEDIUM - Response secrecy is mostly shaped correctly but currently lacks dynamic proof. Evidence: the route returns the raw handoff token only in the successful POST body at `apps/web/src/app/api/axioma/journal-handoff/route.ts:93-100`, while the audit payload omits the token and only records purpose/product/signer algorithm at `apps/web/src/app/api/axioma/journal-handoff/route.ts:85-92`; source-level static tests assert no redirect and no `?token=` in the route/package bridge at `tests/integration/axioma-skeleton-static.test.ts:42-59`; contract text requires POST, not GET token history, at `docs/CONTRACTS/axioma-bridge.md:1020-1031`; Axioma validation failures should return generic errors without probing detail at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:263-279`. Recommendation: the Request-level tests should assert `cache-control: no-store` on all route responses, no token/postUrl on every non-200, no private key material or stack detail in 503s, no token in audit payloads, and `postUrl` never contains `token` or a query secret. Target part: Axioma response/audit secrecy.
6. MEDIUM - Current coverage is static/source-level for journal-handoff, while the consume route shows the preferred extracted-handler pattern. Evidence: the static suite reads the route source as text and checks regexes at `tests/integration/axioma-skeleton-static.test.ts:8-18` and `tests/integration/axioma-skeleton-static.test.ts:42-59`; package snapshot tests prove claim helpers preserve explicit snapshots but do not execute the Next route at `tests/integration/axioma-handoff-snapshot.test.ts:17-52`; the newer consume route already has a handler with injected DB/audit/env/clock at `apps/web/src/features/terminal/axioma-jti-consume.ts:65-102` and dynamic Request tests for auth, bad input, consume, replay, and audit at `tests/integration/axioma-jti-consume-handler.test.ts:66-151`; Phase 3.10 names journal-handoff extraction as the next action at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:111-115`. Recommendation: mirror the consume-route pattern for `apps/web/src/features/terminal/axioma-journal-handoff.ts`, keeping the Next route as a thin adapter, and add `tests/integration/axioma-journal-handoff-handler.test.ts` with PGlite and generated P-256 keys. Target part: local acceptance harness.
7. HIGH - Terminal CTAs must remain disabled after handler extraction because route-level local proof is still not B4 activation. Evidence: loader hard-codes `bridgeActionsImplemented: false` in both demo and DB paths at `apps/web/src/features/terminal/loader.ts:98-123`; the terminal page enables bridge actions only when entitlement, route skeleton, and `bridgeActionsImplemented` are all true at `apps/web/src/app/(app)/app/terminal/page.tsx:30-34`; the Download and Open Journal controls are disabled when bridge actions are false at `apps/web/src/app/(app)/app/terminal/page.tsx:166-179` and `apps/web/src/app/(app)/app/terminal/page.tsx:191-204`; Phase 3.10 still lists live Axioma endpoint shape, live consume/download acceptance, account-link OTC hash migration, and enabled terminal CTAs as open at `docs/STATUS.md:13-15`; the contract activation checklist still has external B4 items unchecked at `docs/CONTRACTS/axioma-bridge.md:1040-1057`. Recommendation: do not flip `bridgeActionsImplemented`, wire UI forms, or enable terminal buttons in this local extraction phase; CTAs should wait for journal-handoff handler tests, download-route security, live endpoint-shape acceptance, production key provisioning, and account-link OTC hardening. Target part: `/app/terminal` CTA activation gate.

## Decisions
- Keep this lane read-only and local-only; no live Axioma, no live services, and no product docs were changed.
- The safest next implementation is a Request-level handler extraction, not a direct CTA activation.
- Preserve the existing security order: method check, CSRF, authenticated user, entitlement, DB/readiness/signer, linked-account lookup, signed handoff build, atomic JTI plus audit, response.
- Treat ES256 signer parseability and JWKS readiness as route prerequisites, not merely UI metadata.
- Keep terminal CTAs disabled until B4 external acceptance and download/account-link security gaps are separately closed.

## Risks
- If `AXIOMA_ROUTE_SKELETON_ENABLED=true` plus DB and key env are configured before handler extraction is tested, a direct API caller can exercise `/api/axioma/journal-handoff` even while the UI buttons remain disabled.
- A non-atomic JTI insert plus audit sequence can create orphan issued JTIs if audit write fails after insert.
- A presence-only signer readiness check can produce confusing 503 behavior for invalid key material; local tests should prove parseable-key gating before side effects.
- Static regex tests can miss execution-order regressions, especially CSRF-before-auth, entitlement-before-signer, and no-side-effect failure paths.
- The local handler can prove WTC-side behavior only; it cannot prove live Axioma will accept the endpoint shape, service-token envelope, JWKS cache behavior, or browser handoff flow.

## Verification/tests
Read-only verification performed:
- Confirmed the target handoff path did not exist before writing.
- Inspected the binding session protocol and canonical handoff requirements.
- Inspected current Axioma route code, route readiness helpers, entitlement/CSRF helpers, signer/JWKS helpers, DB JTI primitives, terminal CTA gating, and current Axioma tests/docs.

Tests and gates NOT RUN from this read-only lane:
- `npm test` - not run; no implementation changed.
- `node scripts/gates.mjs full` - not run; no implementation changed.
- `npm run e2e` - not run; no UI/runtime mutation was made.
- Live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, and production service checks - not run by scope.

Recommended local test command after implementation:
- `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-jti-consume-handler.test.ts`

Recommended full gates after implementation:
- `node scripts/gates.mjs full`
- Env-cleared `npm run e2e`
- Final `npm run governance:check` after the aggregate handoff cites every per-agent handoff.

## Next actions
1. Add `apps/web/src/features/terminal/axioma-journal-handoff.ts` with `handleAxiomaJournalHandoffRequest(req, deps)` and keep `apps/web/src/app/api/axioma/journal-handoff/route.ts` as a thin adapter.
2. Move JTI insert plus issuance audit into one DB transaction or a repository helper, then make the handler return success only after the atomic write succeeds.
3. Add PGlite Request-level tests for method, CSRF ordering, unauthenticated, denied entitlement states, grace/active success, readiness failures, invalid ES256 key, linked/unlinked Axioma user id, no token in URL, no secrets in errors/audit, JTI row creation, and rollback on audit failure.
4. Keep `bridgeActionsImplemented: false` and terminal CTAs disabled in this phase.
5. After the local handler passes focused tests, hand off separate phases for download-route security, account-link OTC hashing, and live Axioma endpoint-shape acceptance.
