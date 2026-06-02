# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.14 security audit for local Axioma account-link route handlers on top of Phase 3.13 persistence. Scope covered browser init, service-auth completion, user unlink/revoke, entitlement fail-closed behavior, CSRF-before-auth, no query-string OTC, redaction of raw OTC/hash in DB/audit/responses after issuance, replay/expiry/failure audit behavior, and terminal CTA disabled state. No live services, external calls, or product-code edits.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/terminal/axioma-account-link.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`

## Files changed
None - read-only audit

## Findings
1. P1 - Account-link app route adapters are still absent, so the pure handler is not reachable through the documented API paths. Evidence: the contract still marks account-link HTTP routes and service-auth completion as not implemented (`docs/CONTRACTS/axioma-bridge.md:417`, `docs/CONTRACTS/axioma-bridge.md:419`, `docs/CONTRACTS/axioma-bridge.md:420`) and the activation checklist keeps `/api/axioma/account-link/init`, completion envelope, and unlink/revoke unchecked (`docs/CONTRACTS/axioma-bridge.md:1067`). Filesystem inspection found only existing Axioma download, journal-handoff, and jti routes under `apps/web/src/app/api/axioma`, while the new pure handler lives at `apps/web/src/features/terminal/axioma-account-link.ts:125`, `apps/web/src/features/terminal/axioma-account-link.ts:164`, and `apps/web/src/features/terminal/axioma-account-link.ts:209`. Recommendation: add thin Next route adapters for `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and `DELETE /api/axioma/account-link` before claiming Phase 3.14 route acceptance. Target part: route adapters.
2. P1 - Completion currently consumes an OTC without re-checking the WTC user's current `axioma_terminal` entitlement at consume time. Evidence: RBAC says all `/api/axioma/*` routes require active Axioma entitlement (`docs/RBAC_MATRIX.md:161`) and specifically lists `POST /api/axioma/account-link/complete` as entitlement-gated with atomic consume (`docs/RBAC_MATRIX.md:170`). The pure complete handler only service-authenticates and then calls `consumeAxiomaAccountLinkNonceWithAudit` with `linkNonceHash` and `axiomaUserId` (`apps/web/src/features/terminal/axioma-account-link.ts:177`, `apps/web/src/features/terminal/axioma-account-link.ts:191`, `apps/web/src/features/terminal/axioma-account-link.ts:193`); the repository consume input also has no entitlement snapshot or checker (`packages/db/src/repositories.ts:1159`, `packages/db/src/repositories.ts:1161`). Recommendation: before marking a pending code linked, resolve the pending row's user and require current active/grace `axioma_terminal` entitlement, failing closed with a redacted failure audit if access was revoked after code issuance. Target part: completion handler/repository boundary.
3. P2 - Query-string OTC rejection is too narrow. Evidence: the contract requires Axioma completion to post `{ code, axioma_user_id }` through a service-auth envelope with no query params (`docs/CONTRACTS/axioma-bridge.md:394`), while the complete handler rejects only `?code=` (`apps/web/src/features/terminal/axioma-account-link.ts:171`, `apps/web/src/features/terminal/axioma-account-link.ts:172`). Raw OTC sent as `?token=`, `?otc=`, or any other query key would not be consumed, but it could still land in request logs before the handler ignores it. Recommendation: reject any non-empty query string on the complete endpoint, or at minimum reject all token-like keys before reading the body. Target part: completion handler.
4. P1 - Account-link route-handler tests are missing. Evidence: current account-link tests cover migration and repository behavior only (`tests/integration/db-axioma-account-link.test.ts:52`, `tests/integration/db-axioma-account-link.test.ts:106`, `tests/integration/db-axioma-account-link.test.ts:157`, `tests/integration/db-axioma-account-link.test.ts:192`); no `axioma-account-link-handler.test.ts` or route-adapter test exists. Recommendation: add focused handler coverage for CSRF-before-auth on init/unlink, entitlement-denied no side effects, service bearer auth on complete, no query-string OTC, response/DB/audit redaction, replay/expired/revoked failure status and audit, and unlink failure/success audit. Target part: tests-runner acceptance.
5. P2 - Redaction and one-time semantics are strong in persistence but must be preserved at route level. Evidence: schema keeps legacy `one_time_code` nullable and current hash-only `link_nonce_hash` plus consume/revoke/link timestamps (`packages/db/src/schema.ts:154`, `packages/db/src/schema.ts:155`, `packages/db/src/schema.ts:156`, `packages/db/src/schema.ts:157`, `packages/db/src/schema.ts:158`), and audit guidance says `link_nonce_hash` must never appear in audit payloads (`docs/AUDIT_LOG_SCHEMA.md:286`, `docs/AUDIT_LOG_SCHEMA.md:287`, `docs/AUDIT_LOG_SCHEMA.md:288`). Repository tests prove DB/audit do not contain raw OTC or hash (`tests/integration/db-axioma-account-link.test.ts:133`, `tests/integration/db-axioma-account-link.test.ts:138`, `tests/integration/db-axioma-account-link.test.ts:139`) and replay writes failure audit without hash (`tests/integration/db-axioma-account-link.test.ts:179`, `tests/integration/db-axioma-account-link.test.ts:185`, `tests/integration/db-axioma-account-link.test.ts:188`, `tests/integration/db-axioma-account-link.test.ts:189`). Recommendation: route tests must assert init returns raw `code` only once, complete/unlink never return raw code or hash, and response bodies/audit payloads never include `linkNonceHash`. Target part: handler acceptance.
6. P2 - CTA disabled state is still correct and should remain unchanged during Phase 3.14 unless the live B4 gates are explicitly cleared. Evidence: status says account-link routes, live Axioma acceptance, OP key provisioning, live installer streaming, and enabled terminal CTAs remain open (`docs/STATUS.md:1` through `docs/STATUS.md:12` current Phase 3.13 entry), the terminal account-link button is still disabled (`apps/web/src/app/(app)/app/terminal/page.tsx:124`, `apps/web/src/app/(app)/app/terminal/page.tsx:126`, `apps/web/src/app/(app)/app/terminal/page.tsx:129`), and download/journal buttons remain gated by `bridgeActionsEnabled` (`apps/web/src/app/(app)/app/terminal/page.tsx:30`, `apps/web/src/app/(app)/app/terminal/page.tsx:170`, `apps/web/src/app/(app)/app/terminal/page.tsx:196`). Recommendation: implement and test API handlers first; keep browser CTAs disabled until account-link routes plus live Axioma endpoint/key/download acceptance are separately green. Target part: terminal UI gate.

## Decisions
- Treat `apps/web/src/features/terminal/axioma-account-link.ts` as an in-progress pure handler, not as route acceptance, until Next route adapters and handler tests exist.
- Browser-origin account-link init and unlink must follow the existing safer local pattern: method check, CSRF verification, then `requireUser`, then entitlement, then DB mutation. Current journal/download handlers demonstrate this pattern (`apps/web/src/features/terminal/axioma-journal-handoff.ts:72`, `apps/web/src/features/terminal/axioma-journal-handoff.ts:76`, `apps/web/src/features/terminal/axioma-journal-handoff.ts:80`; `apps/web/src/features/terminal/axioma-download.ts:175`, `apps/web/src/features/terminal/axioma-download.ts:176`, `apps/web/src/features/terminal/axioma-download.ts:179`).
- Service-auth completion should reuse the bearer-token/timing-safe comparison convention already used by the JTI consume route (`apps/web/src/features/terminal/axioma-jti-consume.ts:27`, `apps/web/src/features/terminal/axioma-jti-consume.ts:33`, `apps/web/src/features/terminal/axioma-jti-consume.ts:78`, `apps/web/src/features/terminal/axioma-jti-consume.ts:80`), while also adding current entitlement verification for the row owner.
- Do not enable terminal CTAs in this phase.

## Risks
- If completion does not re-check entitlement at consume time, a short-lived code issued while access was valid can become a linked Axioma account after the WTC entitlement was revoked.
- If the complete endpoint permits any query string, operators or upstream proxies can log raw OTC material even when the handler ignores it.
- If route adapters are added without handler tests, CSRF-before-auth and service-auth ordering can regress without coverage.
- If UI CTAs are enabled on local-only handler acceptance, users can trigger flows before live Axioma endpoint shapes, service credentials, and installer streaming are accepted.

## Verification/tests
- No npm, Vitest, Playwright, or live-service gates were run in this read-only auditor lane.
- Static/file inspection only. No Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service was contacted or mutated.
- Handoff file created as the single allowed edit for this auditor scope.

## Next actions
1. Add thin Next route adapters for account-link init, complete, and delete/unlink, wiring `csrfToken`, `requireUser`, `accessFor`, `reasonLabel`, `getServerDb`, and `process.env` exactly like the existing Axioma route adapters.
2. Add current-entitlement verification to service-auth completion before `consumeAxiomaAccountLinkNonceWithAudit` marks a row linked.
3. Change completion to reject all query strings or all token-like query keys before parsing the body.
4. Add focused `axioma-account-link-handler` tests covering CSRF-before-auth, fail-closed entitlement, service auth, no query-string OTC, redaction, replay/expiry/failure audit, and unlink/revoke.
5. Keep terminal CTAs disabled until Phase 3.14 API acceptance and the later live B4 Axioma gates are explicitly green.
