# ecosystem-axioma-bridge-auditor handoff
## Scope
Read-only Phase 3.14 audit for local Axioma account-link route handlers at epoch 20260601-2117. Scope covered route naming, init payload, complete service-auth envelope, unlink/revoke behavior, relation to live B4, and required documentation truth. No live Axioma, external, bot, exchange, Stripe, TradingView, SSH, tmux, systemd, preview-worker, or production service calls were made.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260601-2047-phase-3-13-axioma-account-link-hash-uniqueness.md`
- `apps/web/src/app/api/axioma/**`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0010_axioma_account_link_hash.sql`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - The route names for Phase 3.14 should stay exactly on the documented account-link boundary; the repo still treats those handlers as next work, not landed behavior. Evidence: `docs/NEXT_ACTIONS.md:9-11` names `/api/axioma/account-link/init`, completion/service-auth envelope, and unlink/revoke as the next phase; `docs/RBAC_MATRIX.md:169-171` lists the same init, complete, and delete route names; `docs/STATUS.md:14-15` still says account-link routes/handlers remain open. Recommendation: implement thin Next adapters for `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and `DELETE /api/axioma/account-link`, backed by extracted framework-neutral handlers under `apps/web/src/features/terminal/`. Do not fold this into `journal-handoff`, `jti/consume`, or `download`. Target part: route naming and ownership.

2. HIGH - Do not use `packages/axioma-bridge.beginAccountLink()` as the production route implementation; it is still a placeholder and bypasses the Phase 3.13 hash-only DB lifecycle. Evidence: `packages/axioma-bridge/src/bridge.ts:88-93` says `getProductState/beginAccountLink` remain placeholder B4 state; `packages/axioma-bridge/src/bridge.ts:119-124` returns a `randomUUID()` code and calls it a dev-only placeholder; the accepted persistence helpers live in `packages/db/src/repositories.ts:1109-1156` and require a canonical SHA-256 hash plus in-transaction audit. Recommendation: the Phase 3.14 init handler should generate a 32-byte base64url OTC server-side, hash it immediately with SHA-256 hex, call `issueAxiomaAccountLinkNonceWithAudit()`, and return the raw OTC exactly once. Either leave the bridge method unused for account-link routes or refactor it to accept the DB-backed issuer. Target part: init payload and package boundary.

3. HIGH - The completion endpoint must be an Axioma service-auth endpoint, not a browser-session endpoint, and the docs currently blur that boundary. Evidence: `docs/CONTRACTS/axioma-bridge.md:394` says Axioma calls `POST /api/axioma/account-link/complete { code, axioma_user_id }` using a service-auth envelope with no query params; `docs/RBAC_MATRIX.md:161-171` frames all `/api/axioma/*` routes around active user entitlement and lists `POST /api/axioma/account-link/complete` in the user/teacher entitlement matrix; the existing service route pattern uses `Authorization: Bearer <token>` with timing-safe comparison at `apps/web/src/features/terminal/axioma-jti-consume.ts:29-40` and `apps/web/src/features/terminal/axioma-jti-consume.ts:78`. Recommendation: make complete `POST`-only, JSON-body-only, no CSRF, no cookies required, authenticated by `AXIOMA_BRIDGE_API_TOKEN` or a dedicated account-link service token, with timing-safe bearer comparison. The handler should hash the submitted code, call `consumeAxiomaAccountLinkNonceWithAudit()`, map failures without leaking code validity beyond necessary statuses, and re-check the pending row's WTC user entitlement before final link if entitlement can be revoked during the OTC TTL. Target part: complete service-auth envelope.

4. HIGH - The init route must preserve the one-time disclosure rule and resolve the TTL mismatch before implementation is accepted. Evidence: RBAC requires a 5-minute max TTL and one-time return at `docs/RBAC_MATRIX.md:163` and `docs/RBAC_MATRIX.md:169`; the bridge contract still says 10 minutes at `docs/CONTRACTS/axioma-bridge.md:389` and `docs/CONTRACTS/axioma-bridge.md:402`; the DB tests demonstrate the accepted local pattern of returning no raw token to rows or audits at `tests/integration/db-axioma-account-link.test.ts:106-140` and rejecting non-hash input at `tests/integration/db-axioma-account-link.test.ts:142-153`. Recommendation: pick one canonical TTL before coding; I recommend the RBAC max of 5 minutes to match the download-token route. The init response should be minimal, for example `{ code, expiresAt }`, with `Cache-Control: no-store`, no code in query strings, no audit/hash exposure, and no repeat read endpoint. Target part: init payload and secrecy.

5. MEDIUM - Unlink/revoke has a DB primitive, but route semantics still need to be explicit, especially for expired or unentitled users. Evidence: `revokeAxiomaAccountLinksForUserWithAudit()` revokes pending and linked rows for a WTC user and writes `axioma.account_link_revoke` audit at `packages/db/src/repositories.ts:1278-1308`; RBAC says all Axioma routes require active entitlement unless noted at `docs/RBAC_MATRIX.md:161`, while the delete row only says own/admin revoke at `docs/RBAC_MATRIX.md:171`. Recommendation: implement `DELETE /api/axioma/account-link` with CSRF-first browser protection, session auth, own/admin authorization, no raw code inputs, and in-transaction audit through the DB helper. Decide and document whether a user without current `axioma_terminal` entitlement may still unlink their own account; allowing self-unlink does not grant server features and avoids trapping stale links, but it must be a documented exception if chosen. Target part: unlink/revoke behavior.

6. MEDIUM - Account-link routes will not clear B4 or justify enabling terminal CTAs by themselves. Evidence: the terminal loader still hardcodes `bridgeActionsImplemented: false` in both demo and DB modes at `apps/web/src/features/terminal/loader.ts:101-123`; the terminal page gates actions on `access.allowed && terminalData.routeSkeletonConfigured && terminalData.bridgeActionsImplemented` at `apps/web/src/app/(app)/app/terminal/page.tsx:29-34`; connect/download/journal controls remain disabled at `apps/web/src/app/(app)/app/terminal/page.tsx:121-129`, `apps/web/src/app/(app)/app/terminal/page.tsx:166-180`, and `apps/web/src/app/(app)/app/terminal/page.tsx:194-204`; live activation still requires token, endpoint, account-link, streaming, and CTA acceptance at `docs/CONTRACTS/axioma-bridge.md:1061-1069`. Recommendation: after local route acceptance, docs should say "local account-link routes implemented and tested; live Axioma OTC acceptance, installer streaming, endpoint-shape confirmation, OP key provisioning, and browser CTA enablement remain B4." Keep `bridgeActionsImplemented` false until a later activation phase observes those gates green. Target part: live B4 boundary and UI activation.

7. MEDIUM - The bridge contract contains stale Phase 3.13 carryover text that will become misleading during Phase 3.14 unless corrected with the route work. Evidence: the current top status correctly says hash-only persistence and uniqueness landed while routes remain open at `docs/CONTRACTS/axioma-bridge.md:3-14` and `docs/CONTRACTS/axioma-bridge.md:417-420`; later text still says account-link OTC hashing is B4 at `docs/CONTRACTS/axioma-bridge.md:1028-1033`; the cleanup section still says `axioma_account_links` needs OTC hash/active-link hardening at `docs/CONTRACTS/axioma-bridge.md:1095-1097`. Recommendation: update the contract after implementation to remove stale "hashing still needed" statements, preserve the route/live distinction, align TTL text with RBAC, and document the exact local route payloads and auth envelopes. Target part: documentation truth.

## Decisions
- Treat Phase 3.14 as local account-link route acceptance only; no live Axioma endpoint, installer, or browser CTA activation should be implied.
- Keep `@wtc/db` as the source of truth for hash-only OTC issue, consume, linked-account read, and revoke semantics.
- Treat `packages/axioma-bridge/src/bridge.ts` account-link behavior as dev/mock placeholder until it is refactored to the DB-backed lifecycle or explicitly bypassed by route handlers.
- Prefer a 5-minute account-link OTC TTL unless the operator deliberately updates RBAC and contract docs to another single value.

## Risks
- A service-auth completion route that also expects browser session/CSRF will fail the real Axioma server-to-server flow.
- A completion route that consumes by raw code, query string, or non-hashed storage would regress the Phase 3.13 secrecy boundary.
- If unlink is blocked for expired/unentitled users, stale account links may become user-inaccessible without admin intervention.
- If the terminal CTA gate changes during this route phase, local route tests could be mistaken for live B4 acceptance.
- True concurrent complete/link races are DB-index-protected, but route-level conflict mapping and real-Postgres cross-connection acceptance remain separate verification.

## Verification/tests
- Read-only audit only.
- No npm, Vitest, Playwright, database migration, build, secret scan, or governance gates were run in this auditor lane.
- No live Axioma, external network, bot, exchange, Stripe, TradingView, SSH, tmux, systemd, preview-worker, or production service calls were made.
- Verified the target handoff path did not exist before writing.

## Next actions
1. Implement extracted account-link handlers plus thin Next adapters for init, complete, and delete in a separate implementation lane.
2. Add route tests for CSRF-before-auth on browser init/delete, method rejection, schema/body-size validation, entitlement/readiness fail-closed behavior, service bearer auth for complete, no query-string OTC, no raw OTC/hash in DB/audit/response except one-time init response, replay/expired/revoked/conflict mapping, and no side effects on denial.
3. Update `docs/CONTRACTS/axioma-bridge.md`, `docs/RBAC_MATRIX.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and any aggregate handoff to state exactly what is local-only versus still B4/live-blocked.
4. Keep terminal CTAs disabled until a later phase observes live Axioma endpoint-shape, account-link, download streaming, OP key, and browser action gates green.
