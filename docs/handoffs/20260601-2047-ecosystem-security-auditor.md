# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.13 security audit for local Axioma account-link OTC hash migration plus active-link uniqueness. Focus areas: no plaintext OTC at rest/logs/audit, CSRF/auth/entitlement ordering, audit redaction, replay and single-use semantics, active-link uniqueness safety, and keeping terminal CTAs disabled until all B4 gates are met. No live services, external calls, or product-code edits were performed.
## Files inspected
- AGENTS.md instructions from prompt context.
- docs/handoffs/0000-orchestrator-seed.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/CONTRACTS/axioma-bridge.md
- docs/AXIOMA_HANDOFF_TOKEN_SPEC.md
- docs/AUDIT_LOG_SCHEMA.md
- docs/RBAC_MATRIX.md
- docs/SECRET_VAULT_DESIGN.md
- docs/PRODUCTION_BLOCKERS_CURRENT.md
- docs/DATA_MODEL.md
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/db/migrations/0000_broken_jack_murdock.sql
- packages/db/migrations/0009_wide_orphan.sql
- packages/audit/src/audit.ts
- packages/audit/src/redact.ts
- apps/web/src/features/terminal/axioma-route-core.ts
- apps/web/src/features/terminal/axioma-journal-handoff.ts
- apps/web/src/features/terminal/loader.ts
- apps/web/src/app/(app)/app/terminal/page.tsx
- apps/web/src/app/api/axioma/download/route.ts
- apps/web/src/app/api/axioma/download/terminal/route.ts
- apps/web/src/app/api/axioma/journal-handoff/route.ts
- apps/web/src/app/api/axioma/jti/consume/route.ts
- tests/integration/axioma-journal-handoff-handler.test.ts
- tests/integration/axioma-skeleton-static.test.ts
- tests/integration/axioma-download-handler.test.ts
- tests/integration/db-axioma-download-token.test.ts
- tests/integration/axioma-jti-consume-handler.test.ts
- tests/integration/db-axioma-jti.test.ts
## Files changed
None - read-only audit
## Findings
1. CRITICAL - Current source schema shows the intended OTC hash and active-link indexes, but the visible migration set does not contain the account-link migration. Evidence: `packages/db/src/schema.ts:154` to `packages/db/src/schema.ts:169` defines `link_nonce_hash`, consume/revoke/link timestamps, and partial unique indexes; the initial DDL still creates plaintext `one_time_code` at `packages/db/migrations/0000_broken_jack_murdock.sql:17` to `packages/db/migrations/0000_broken_jack_murdock.sql:23`; the latest visible migration only alters `terminal_download_events` at `packages/db/migrations/0009_wide_orphan.sql:1` to `packages/db/migrations/0009_wide_orphan.sql:7`. Recommendation: generate and review the account-link migration before acceptance; it should remove or retire plaintext `one_time_code`, add the hash/timestamp columns and partial unique indexes, and define an explicit policy for any existing pending plaintext codes, preferably expire/revoke them rather than preserving raw OTC. Target part: DB migration and schema truth.
2. HIGH - The new nonce issuance API trusts a caller-supplied `linkNonceHash`, so a route bug could still persist raw OTC under a hash-named column. Evidence: `IssueAxiomaAccountLinkNonceInput` accepts `linkNonceHash` as a plain string at `packages/db/src/repositories.ts:1070` to `packages/db/src/repositories.ts:1077`; the insert stores it directly at `packages/db/src/repositories.ts:1120` to `packages/db/src/repositories.ts:1128`; the schema column is unconstrained `text` at `packages/db/src/schema.ts:154`. Recommendation: either make the repository derive the SHA-256/base64url hash from a raw nonce and never expose a raw storage field, or strictly validate a canonical hash shape before insert; add a regression test proving the displayed/raw OTC never appears in `axioma_account_links`, audit rows, errors, or logs. Target part: OTC issuance storage boundary.
3. HIGH - Active-link uniqueness relies on preflight SELECTs plus intended partial unique indexes, but the repository does not yet gracefully handle the race outcome if the unique index rejects a concurrent consume. Evidence: active-user and active-Axioma-user indexes are declared at `packages/db/src/schema.ts:166` to `packages/db/src/schema.ts:167`; `consumeAxiomaAccountLinkNonceWithAudit` first checks for an existing active row at `packages/db/src/repositories.ts:1183` to `packages/db/src/repositories.ts:1204`, then performs the conditional link update at `packages/db/src/repositories.ts:1206` to `packages/db/src/repositories.ts:1224`. Recommendation: treat the DB unique constraints as the final authority, add concurrent consume tests for two pending nonces for the same WTC user and for the same Axioma user id, and map unique-violation losers to `already_linked` or `axioma_user_already_linked` with an audited failure rather than an unclassified 500. Target part: active-link uniqueness and replay safety.
4. HIGH - No account-link route/handler can be accepted from the repository helpers alone because CSRF, session auth, entitlement, readiness, and service-auth ordering are not enforced at the DB layer. Evidence: RBAC requires `Zod -> session auth -> role -> entitlement -> generate one-time code -> upsert -> in-txn audit` for `POST /api/axioma/account-link/init` at `docs/RBAC_MATRIX.md:161` to `docs/RBAC_MATRIX.md:170`; the repository input only records a caller-supplied `entitlementVerified` boolean at `packages/db/src/repositories.ts:1070` to `packages/db/src/repositories.ts:1077`; the helper then inserts the pending row and audit at `packages/db/src/repositories.ts:1120` to `packages/db/src/repositories.ts:1146`. Recommendation: implement an injectable account-link handler that is POST-only, validates body size/schema, checks CSRF before any mutation on browser-initiated init/revoke, requires the current user and active/grace `axioma_terminal` entitlement, requires route readiness/DB, and uses a separate authenticated Axioma-server envelope for consume/complete. Target part: account-link route gate ordering.
5. HIGH - The contract still describes OTC in a URL/query string, which conflicts with the no-plaintext-OTC objective and makes access-log/browser-history leakage likely. Evidence: the contract shows `axioma://link?code=<OTC>` at `docs/CONTRACTS/axioma-bridge.md:386` to `docs/CONTRACTS/axioma-bridge.md:389` and `POST /api/axioma/link?code=<OTC>&axioma_user_id=<id>` at `docs/CONTRACTS/axioma-bridge.md:392` to `docs/CONTRACTS/axioma-bridge.md:393`; audit docs explicitly say `onetimecode` must never appear in audit payloads at `docs/AUDIT_LOG_SCHEMA.md:281` to `docs/AUDIT_LOG_SCHEMA.md:286` and list Axioma one-time linking codes as forbidden secret material at `docs/AUDIT_LOG_SCHEMA.md:314` to `docs/AUDIT_LOG_SCHEMA.md:319`. Recommendation: change the Phase 3.13 route contract to POST-body delivery for any raw OTC, never query strings; if a local deep link is kept, ensure it is terminal-local only and is not sent to WTC logs, audit, referrers, or browser history. Target part: account-link contract and HTTP envelope.
6. MEDIUM - `open_journal` still reads `axioma_account_links` directly instead of the new linked-account helper, which leaves duplicate active-link semantics in the app layer. Evidence: the journal handler selects linked rows directly and orders by `createdAt` at `apps/web/src/features/terminal/axioma-journal-handoff.ts:101` to `apps/web/src/features/terminal/axioma-journal-handoff.ts:106`; the new `getLinkedAxiomaAccountForUser` helper centralizes linked-state, non-revoked, non-null Axioma-user filtering at `packages/db/src/repositories.ts:1244` to `packages/db/src/repositories.ts:1265`. Recommendation: after the migration is generated and tested, switch journal handoff to the helper so Open Journal observes the same active-link definition as account-link consume. Target part: linked-account read path.
7. MEDIUM - Audit redaction has a useful backstop, but account-link success audit should be a deliberate PII decision rather than accidental payload growth. Evidence: redaction covers `onetimecode` key names and long hex values at `packages/audit/src/redact.ts:12` to `packages/audit/src/redact.ts:62`; account-link init audit omits the nonce hash at `packages/db/src/repositories.ts:1132` to `packages/db/src/repositories.ts:1146`; complete audit includes `axiomaUserId` at `packages/db/src/repositories.ts:1227` to `packages/db/src/repositories.ts:1239`. Recommendation: keep raw OTC and hash out of all audit payloads; either document that `axiomaUserId` is acceptable operational metadata or replace it with link row id/status only. Target part: account-link audit payload.
8. HIGH - Terminal CTAs are still correctly disabled and must remain disabled after this local account-link slice. Evidence: Phase 3.12 status leaves account-link hash/uniqueness, live Axioma acceptance, and enabled CTAs open at `docs/STATUS.md:13` to `docs/STATUS.md:14`; production blockers keep B4 blocked on endpoint shapes, OP key provisioning, live consume/download acceptance, account-link hash/uniqueness, installer streaming/security, and browser CTA acceptance at `docs/PRODUCTION_BLOCKERS_CURRENT.md:10` to `docs/PRODUCTION_BLOCKERS_CURRENT.md:13`; the loader hard-codes `bridgeActionsImplemented: false` at `apps/web/src/features/terminal/loader.ts:101` to `apps/web/src/features/terminal/loader.ts:123`; the terminal account-link, download, and Open Journal buttons are disabled at `apps/web/src/app/(app)/app/terminal/page.tsx:124` to `apps/web/src/app/(app)/app/terminal/page.tsx:129`, `apps/web/src/app/(app)/app/terminal/page.tsx:166` to `apps/web/src/app/(app)/app/terminal/page.tsx:174`, and `apps/web/src/app/(app)/app/terminal/page.tsx:194` to `apps/web/src/app/(app)/app/terminal/page.tsx:203`. Recommendation: do not flip `bridgeActionsImplemented`, wire UI submit actions, or expose account-link/download/journal CTAs until the account-link migration/tests, live Axioma endpoint/key/replay/download acceptance, and browser CTA e2e gates all pass in a later scoped session. Target part: `/app/terminal` activation gate.
## Decisions
- Treat the current worktree as an in-progress account-link hardening snapshot, not accepted Phase 3.13 completion, because source schema/repository changes are visible but account-link migration and dedicated tests are not yet visible.
- No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service calls are needed for this read-only audit.
- The security bar for the account-link slice is hash-only storage, no raw OTC in URLs/logs/audit/DB, transactional issue/consume audit, single-use consume, and DB-enforced active-link uniqueness.
- Terminal CTAs remain disabled until all B4 gates are complete, not merely until local repository helpers exist.
## Risks
- Parallel edits were observed during the audit; the handoff reflects the current snapshot after re-reading changed files.
- If schema changes ship without a generated migration, production and PGlite replay will still have the old plaintext OTC shape.
- If active-link conflicts are only preflight SELECTs, concurrent account-link completes can either create duplicate links when indexes are absent or throw an unaudited unique-violation failure when indexes are present.
- If a future handler accepts raw OTC through query strings, infrastructure access logs can capture the code even when DB/audit redaction is correct.
- If `bridgeActionsImplemented` is flipped before external B4 acceptance, users will see account-link/download/journal actions whose live safety and endpoint contracts are not proven.
## Verification/tests
- Static read-only inspection only.
- Used `rg` and line-numbered `Get-Content` over the requested docs, DB schema/repositories, terminal/account-link web surfaces, audit package, migrations, and relevant tests.
- Did not run Vitest, Playwright, `db:generate`, or governance checks in this read-only auditor lane.
- Did not make external calls or live service mutations.
## Next actions
1. Generate and review the account-link migration, including meta snapshot, then run `npm run db:generate -w @wtc/db` until it reports no schema drift.
2. Add `tests/integration/db-axioma-account-link.test.ts` covering hash-only issuance, raw OTC absence from DB/audit, pending revocation on reissue, single-use consume, expiry/revoked replay, duplicate WTC-user active link, duplicate Axioma-user active link, and concurrent consume races.
3. Add injectable account-link route handlers and tests for `init`, `complete`, and `revoke`: method, schema, CSRF/auth/entitlement/readiness ordering, service-auth envelope for Axioma-origin complete, no query-string OTC, audit success/failure, and no side effects on denial.
4. Update `docs/CONTRACTS/axioma-bridge.md`, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, `docs/AUDIT_LOG_SCHEMA.md`, and `docs/DATA_MODEL.md` to match the hash-only account-link shape and remove query-string OTC examples.
5. Switch Open Journal linked-account lookup to `getLinkedAxiomaAccountForUser` after the migration and DB tests are green.
6. Keep `bridgeActionsImplemented: false` and all terminal CTAs disabled until local account-link acceptance and the remaining external B4 gates are explicitly run and green.
