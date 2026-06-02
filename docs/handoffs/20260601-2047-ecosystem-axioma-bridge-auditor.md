# ecosystem-axioma-bridge-auditor handoff
## Scope
Read-only audit for WTC Ecosystem Platform Phase 3.13, epoch `20260601-2047`: local Axioma account-link OTC hash migration plus active-link uniqueness. Scope explicitly excludes live Axioma calls, external endpoint probing, browser CTA enablement, production key provisioning, installer streaming, and product-code edits.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/RBAC_MATRIX.md`
- `packages/audit/src/audit.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0009_wide_orphan.sql`
- `packages/db/migrations/meta/0009_snapshot.json`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Account-link persistence is still plaintext-OTC-shaped and not contract-current. Evidence: `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155` defines `state`, `axiomaUserId`, plaintext `oneTimeCode`, `codeExpiresAt`, and `createdAt`; `packages/db/migrations/0000_broken_jack_murdock.sql:17` to `packages/db/migrations/0000_broken_jack_murdock.sql:24` created the same plaintext columns; the current migration snapshot still has `one_time_code` and `code_expires_at` with no `link_nonce_hash` at `packages/db/migrations/meta/0009_snapshot.json:153` to `packages/db/migrations/meta/0009_snapshot.json:204`. The contract requires a cryptographically random OTC, single-use atomic consume, session-user binding, and `link_nonce_hash` with raw OTC discarded at `docs/CONTRACTS/axioma-bridge.md:398` to `docs/CONTRACTS/axioma-bridge.md:414`. Recommendation: add a Phase 3.13 migration that stores only `link_nonce_hash`, adds issue/consume/revoke timestamps, deprecates or nulls plaintext `one_time_code`, and backs repository helpers with hash-only audit payloads. Target part: Axioma account-link DDL and repositories.
2. HIGH - There is no active-link uniqueness boundary, so duplicate linked rows remain possible and `open_journal` can resolve an arbitrary latest linked account. Evidence: the schema callback for `axiomaAccountLinks` has no indexes or unique constraints at `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155`; the current snapshot shows `"indexes": {}` for `axioma_account_links` at `packages/db/migrations/meta/0009_snapshot.json:202`; the journal handoff handler selects a linked row ordered by newest `createdAt` and `.limit(1)` at `apps/web/src/features/terminal/axioma-journal-handoff.ts:101` to `apps/web/src/features/terminal/axioma-journal-handoff.ts:106`. Recommendation: add partial uniqueness for active links, at minimum one active/linked row per WTC `user_id`; also consider one active row per non-null `axioma_user_id` to prevent the same Axioma identity being linked to multiple WTC accounts without explicit unlink/relink. Target part: active-link uniqueness and deterministic account mapping.
3. HIGH - The account-link API surface is not implemented and route names are drifting across docs. Evidence: the only current Axioma API routes are download, journal-handoff, and JTI consume under `apps/web/src/app/api/axioma`; no `account-link` or `link` route exists. The bridge contract describes Axioma completing with `POST /api/axioma/link?code=<OTC>&axioma_user_id=<id>` at `docs/CONTRACTS/axioma-bridge.md:392`, while RBAC describes `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and `DELETE /api/axioma/account-link` at `docs/RBAC_MATRIX.md:163` to `docs/RBAC_MATRIX.md:173`. Recommendation: choose and document one canonical local route set before implementation. Preferred local shape: browser session `POST /api/axioma/account-link/init` issues the one-time code; Axioma/terminal server-side completion uses `POST /api/axioma/account-link/complete` or a deliberately aliased `POST /api/axioma/link` with JSON body, not query params, to avoid OTC exposure in logs and browser history. Target part: route/API naming.
4. HIGH - Deep-link/code exposure boundaries are not yet enforceable in code. Evidence: the contract still shows `axioma://link?code=<OTC>` and `POST /api/axioma/link?code=<OTC>&axioma_user_id=<id>` at `docs/CONTRACTS/axioma-bridge.md:388` to `docs/CONTRACTS/axioma-bridge.md:393`; the audit policy forbids OTC values in audit payloads at `docs/CONTRACTS/axioma-bridge.md:641`; current audit constants include account-link actions but no route implementation proves raw-code redaction at `packages/audit/src/audit.ts:68` to `packages/audit/src/audit.ts:83`. Recommendation: Phase 3.13 should pass raw OTC only in the one-time user response/deep-link display, never in audit, DB, server logs, or redirect URLs after issuance; completion should accept JSON body and audit only the link row id, hash metadata, result, and failure reason. Target part: OTC exposure and audit boundary.
5. MEDIUM - `@wtc/axioma-bridge` still exposes only a placeholder account-link helper and does not persist pending/linked state. Evidence: `beginAccountLink` returns `globalThis.crypto.randomUUID()` and only comments that production should use a 32-byte base64url code stored as hash at `packages/axioma-bridge/src/bridge.ts:119` to `packages/axioma-bridge/src/bridge.ts:125`; the same factory returns `accountLink: { state: 'not_linked' }` from `getProductState` at `packages/axioma-bridge/src/bridge.ts:99` to `packages/axioma-bridge/src/bridge.ts:106`. Recommendation: keep this package helper as dev/mock only; implement real issue/consume/unlink in DB-backed route handlers or DB repositories, with the bridge consuming only sanitized linked-account state. Target part: package boundary and local account-link implementation.
6. MEDIUM - Pending vs linked UI state is not wired to persistence, which is correct while CTAs are disabled but insufficient for account-link acceptance. Evidence: the terminal page hardcodes account link as `not_linked` and disables the connect button at `apps/web/src/app/(app)/app/terminal/page.tsx:116` to `apps/web/src/app/(app)/app/terminal/page.tsx:130`; the loader always returns `bridgeActionsImplemented: false` at `apps/web/src/features/terminal/loader.ts:101` to `apps/web/src/features/terminal/loader.ts:123`; static tests assert CTAs remain disabled at `tests/integration/axioma-skeleton-static.test.ts:90` to `tests/integration/axioma-skeleton-static.test.ts:99`. Recommendation: after the local DB migration and routes land, add a loader repository that maps pending, linked, and unlinked rows into the page state without enabling Download/Open Journal until the external B4 gates and browser e2e action coverage pass. Target part: terminal page/loader account-link states.
7. MEDIUM - Axioma user id mapping has no local validation boundary beyond "linked row exists." Evidence: journal handoff accepts the selected linked row's `axiomaUserId` and signs it into `wtc_axioma_user_id` at `apps/web/src/features/terminal/axioma-journal-handoff.ts:101` to `apps/web/src/features/terminal/axioma-journal-handoff.ts:118`; tests seed any string as `axiomaUserId` at `tests/integration/axioma-journal-handoff-handler.test.ts:124` to `tests/integration/axioma-journal-handoff-handler.test.ts:130` and verify it appears in the handoff at `tests/integration/axioma-journal-handoff-handler.test.ts:197` to `tests/integration/axioma-journal-handoff-handler.test.ts:219`. Recommendation: local completion should at least Zod-validate `axioma_user_id`, bind consume to the WTC user that issued the OTC, and set active only through the atomic consume helper; live verification that the id came from Axioma's authenticated account-link flow remains external B4. Target part: account-link completion trust boundary.
8. MEDIUM - Contract/docs disagree on account-link status names and TTL. Evidence: contract link states are `pending | active | unlinked` at `docs/CONTRACTS/axioma-bridge.md:405` to `docs/CONTRACTS/axioma-bridge.md:422`; schema comments use `linked | pending | not_linked` at `packages/db/src/schema.ts:150`; `DATA_MODEL.md` describes `unlinked | pending_link | linked | error`, unique `user_id`, and additional timestamps that current schema lacks at `docs/DATA_MODEL.md:568` to `docs/DATA_MODEL.md:582`; the contract says OTC TTL 10 minutes at `docs/CONTRACTS/axioma-bridge.md:398` to `docs/CONTRACTS/axioma-bridge.md:404`, while RBAC and the secret-vault note say 5 minutes at `docs/RBAC_MATRIX.md:163` and `docs/SECRET_VAULT_DESIGN.md:290` to `docs/SECRET_VAULT_DESIGN.md:294`. Recommendation: Phase 3.13 should choose one state vocabulary and one TTL, update docs and tests in the same phase, and avoid mixing `active` versus `linked` semantics in code. Target part: contract-current local shape.
9. INFO - External B4 remains unchanged by this local audit. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:10` to `docs/PRODUCTION_BLOCKERS_CURRENT.md:13` keeps Axioma blocked on endpoint shapes, OP ES256 key provisioning, live consume/download acceptance, account-link OTC hash migration plus active-link uniqueness, installer streaming/security acceptance, and enabled browser CTA acceptance; `docs/CONTRACTS/axioma-bridge.md:1052` to `docs/CONTRACTS/axioma-bridge.md:1060` still has service token, journal_server entitlement, release manifest, OTC endpoint, and live installer streaming unchecked; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:16` to `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:18` keeps the P-256 key, endpoint shapes, live activation, replay-model decision, and OTC-to-hash migration in TARGET/B4. Recommendation: do not enable terminal CTAs or claim production bridge readiness after only a local OTC migration; live Axioma acceptance must be a separate scoped session with credentials and endpoint contracts. Target part: production B4 acceptance.

## Decisions
- This audit treats Phase 3.13 as a local-only account-link hardening slice: DB migration, repositories, route handlers, and local tests are in scope for implementers; live Axioma calls are out of scope.
- The current disabled terminal CTAs are correct and should remain disabled through this slice unless the operator separately scopes external B4 acceptance and browser action coverage.
- The safest local account-link target is hash-only OTC persistence plus partial active-link uniqueness before any UI activation.
- Route naming must be resolved before implementation; the current docs conflict between `/api/axioma/link` and `/api/axioma/account-link/*`.

## Risks
- If plaintext `one_time_code` remains usable, any DB snapshot, accidental log, or audit mistake can expose an account-link credential.
- Without partial uniqueness, duplicate linked rows can cause nondeterministic `open_journal` mappings and potential cross-account confusion.
- If completion accepts `code` in query params, raw OTC can land in access logs, browser history, referrers, or screenshots.
- If `bridgeActionsImplemented` is flipped after only local DB work, users will hit flows that still depend on unconfirmed Axioma endpoint shapes and service-token behavior.
- If Axioma user id validation is left to live B4 but UI is enabled locally, WTC may store unverified display/mapping data as if it were confirmed.

## Verification/tests
- Read-only inspection only; no code or docs were edited beyond this required handoff.
- Commands used: `Get-Content`, `Get-ChildItem`, `Test-Path`, and `rg` searches over docs, DB schema/migrations/repos, bridge package, terminal routes/page/loader, and integration tests.
- No npm/Vitest/Playwright gates were run by this read-only auditor lane.
- No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service calls were made.

## Next actions
1. Add a DB migration for `axioma_account_links`: hash-only OTC columns, issued/expires/consumed/linked/unlinked/verified timestamps, optional display username, and partial unique indexes for active WTC user and active Axioma user mappings.
2. Add DB repository helpers for issue, consume, get-linked, get-pending, expire/revoke, and unlink; all mutations should be transactional and write audit rows without raw OTC/hash leakage.
3. Implement extracted route handlers for account-link init/complete/unlink with CSRF/auth/entitlement on browser mutations, JSON-body completion, route readiness checks, and no live Axioma calls.
4. Reconcile route naming across `docs/CONTRACTS/axioma-bridge.md`, `docs/RBAC_MATRIX.md`, `docs/DATA_MODEL.md`, and tests before claiming contract-current acceptance.
5. Add focused PGlite and handler tests for hash-only storage, TTL, single-use consume, wrong-user rejection, replay/expired/revoked failures, active-link uniqueness, audit redaction, and no query-token exposure.
6. Wire terminal loader/page to display pending/linked/unlinked state after local acceptance, but keep Download/Open Journal/Connect Account CTAs disabled until external B4 and browser e2e action gates are separately accepted.
