# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.13 DB audit for local Axioma account-link OTC hash migration plus active-link uniqueness. Scope was limited to current repository evidence, migration metadata, and migration replay test patterns. No live DB, no external calls, and no code/schema edits were performed.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DATA_MODEL.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0009_wide_orphan.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0009_snapshot.json`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: HIGH. Evidence: `packages/db/src/schema.ts:147` defines `axioma_account_links`, and `packages/db/src/schema.ts:152` still maps `one_time_code`; `packages/db/migrations/meta/0009_snapshot.json:182` confirms the current migration snapshot still contains plaintext `one_time_code`. Recommendation: Phase 3.13 should add hash-only OTC storage (`link_nonce_hash` or `one_time_code_hash`) and stop writing raw OTC immediately; do not attempt to hash historical plaintext in-place unless the operator explicitly accepts that migration behavior. Target part: migration 0010 + `@wtc/db` account-link repos.
2. Severity: HIGH. Evidence: `packages/db/migrations/meta/0009_snapshot.json:202` and `packages/db/migrations/meta/0009_snapshot.json:219` show no indexes or unique constraints on `axioma_account_links`; `docs/DATA_MODEL.md:571` claims `user_id` is unique, which is not true in the current schema. Recommendation: add DB-enforced partial uniqueness for active links, at minimum one active linked row per WTC `user_id`; also add a partial unique index on `axioma_user_id` for linked rows unless product/security explicitly allows one Axioma account to be shared across WTC accounts. Target part: migration 0010 partial unique indexes.
3. Severity: HIGH. Evidence: `packages/db/src/schema.ts:153` has only `code_expires_at`; there is no `consumed_at`, `revoked_at`, `linked_at`, `last_verified_at`, or `updated_at` for account-link state, while the contract requires atomic single-use consume and stored link metadata at `docs/CONTRACTS/axioma-bridge.md:398` through `docs/CONTRACTS/axioma-bridge.md:413`. Recommendation: add lifecycle columns `code_consumed_at`, `code_revoked_at`, `linked_at`, `last_verified_at`, and `updated_at`, reusing existing `code_expires_at` as the pending OTC expiry column to avoid a rename. Target part: account-link schema and migration.
4. Severity: MEDIUM. Evidence: `apps/web/src/features/terminal/axioma-journal-handoff.ts:101` through `apps/web/src/features/terminal/axioma-journal-handoff.ts:106` reads linked accounts by `state='linked'`, orders by `created_at DESC`, and limits to one; with no uniqueness this can return whichever duplicate happens to be newest. Recommendation: add deterministic repository read `getActiveAxiomaAccountLinkForUser` using the new active-link uniqueness invariant and order by `linked_at DESC, created_at DESC, id DESC` as a defensive tie-breaker. Target part: `packages/db/src/repositories.ts` plus journal-handoff consumer.
5. Severity: MEDIUM. Evidence: `docs/CONTRACTS/axioma-bridge.md:387` through `docs/CONTRACTS/axioma-bridge.md:393` specify OTC issue/consume, `docs/CONTRACTS/axioma-bridge.md:627` through `docs/CONTRACTS/axioma-bridge.md:630` list account-link audit events, but `packages/db/src/repositories.ts:1272` through `packages/db/src/repositories.ts:1274` only records terminal license events; there is no account-link issue/consume repo. Recommendation: implement transactional repos `issueAxiomaAccountLinkCodeWithAudit`, `consumeAxiomaAccountLinkCodeWithAudit`, and optionally `revokePendingAxiomaAccountLinkCodesWithAudit`; audit payloads must omit raw OTC and hash. Target part: repository layer and future backend route.
6. Severity: MEDIUM. Evidence: migration replay patterns already apply every SQL file in order in `tests/integration/db-persistence.test.ts:47` through `tests/integration/db-persistence.test.ts:54`, and the Phase 3.12 download token tests verify hash-only token/audit behavior at `tests/integration/db-axioma-download-token.test.ts:70` through `tests/integration/db-axioma-download-token.test.ts:82`. Recommendation: mirror this pattern for focused PGlite account-link tests, including schema/migration proof and raw-OTC absence from rows/audits. Target part: `tests/integration/db-axioma-account-link-token.test.ts`.

## Decisions
1. Recommended migration shape is additive-first and PGlite-friendly: keep the existing `state`, `one_time_code`, and `code_expires_at` columns to avoid destructive rename/drop churn, but add new columns and make all new application paths use hash-only state.
2. Recommended columns for migration 0010:
   - `link_nonce_hash TEXT` nullable, indexed unique where non-null.
   - `code_consumed_at TIMESTAMPTZ` nullable.
   - `code_revoked_at TIMESTAMPTZ` nullable.
   - `linked_at TIMESTAMPTZ` nullable.
   - `last_verified_at TIMESTAMPTZ` nullable.
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
3. Recommended plaintext replacement behavior:
   - Add the new columns.
   - Revoke any existing pending plaintext rows by setting `code_revoked_at = NOW()` and clearing `one_time_code = NULL`.
   - Add a guard constraint such as `CHECK (one_time_code IS NULL)` after cleanup, or at minimum a static/repo test that no production write path can populate `one_time_code`. The DB check is safer because plaintext OTC is a security invariant, not just an app convention.
4. Recommended indexes:
   - `aal_link_nonce_hash_idx` unique on `link_nonce_hash` where `link_nonce_hash IS NOT NULL`.
   - `aal_active_user_idx` unique on `user_id` where `state = 'linked'`.
   - `aal_active_axioma_user_idx` unique on `axioma_user_id` where `state = 'linked' AND axioma_user_id IS NOT NULL`, unless product/security explicitly allows shared Axioma accounts.
   - `aal_user_state_linked_idx` on `(user_id, state, linked_at DESC, created_at DESC)` for deterministic reads.
   - `aal_code_expires_idx` on `code_expires_at` for cleanup of expired pending OTC rows.
5. Recommended repository semantics:
   - Issue path: transactionally revoke prior unconsumed pending codes for the user, insert a new `pending` row with only the hash and expiry, and write `axioma.link.otc_issued` audit without raw OTC or hash.
   - Consume path: single atomic conditional `UPDATE ... WHERE link_nonce_hash = $hash AND state = 'pending' AND code_consumed_at IS NULL AND code_revoked_at IS NULL AND code_expires_at > $now RETURNING *`; on success set `state='linked'`, `axioma_user_id`, `code_consumed_at`, `linked_at`, `last_verified_at`, and `updated_at`, then write `axioma.link.otc_consumed` without raw OTC/hash.
   - Failure path: categorize `not_found`, `already_consumed`, `revoked`, `expired`, and `active_link_conflict` without consuming; audit failure without raw OTC/hash.
   - Read path: expose `getActiveAxiomaAccountLinkForUser(db, userId)` and update current consumers to call it instead of ad hoc selects.

## Risks
1. Drizzle may not generate the exact partial indexes or plaintext-null check needed for the security invariant. If generated SQL is incomplete, hand-append reviewed SQL to migration 0010 and keep the snapshot/schema consistent.
2. Existing docs disagree on account-link state names: `schema.ts` and current code use `state='linked'`, while `DATA_MODEL.md` describes `status` values like `pending_link` and `unlinked`. Avoid a rename in Phase 3.13; reconcile docs to current `state` names or reserve a later explicit cleanup.
3. PGlite can prove migration replay and uniqueness rejection, but it cannot prove a true cross-connection concurrent consume race. A real-Postgres opt-in race harness remains useful after local acceptance.
4. If a real environment already has plaintext pending OTC rows, converting them to hashes is not necessary and may preserve an unsafe secret longer. Revoking and clearing them is safer, but it invalidates any outstanding codes and should be documented in the aggregate handoff.

## Verification/tests
Read-only audit only; no tests were run in this lane.

Recommended focused gates for implementation:
1. `npm test -- tests/integration/db-axioma-account-link-token.test.ts tests/integration/axioma-journal-handoff-handler.test.ts`
2. `npm run typecheck`
3. `npm run db:generate -w @wtc/db`
4. `npm run governance:check`

Recommended PGlite test cases:
1. Replays all migrations through 0010 and proves the new columns, partial indexes, and plaintext-null guard exist.
2. Applies migrations through 0009, inserts a legacy plaintext pending row, applies 0010, and asserts `one_time_code` is null and the row is revoked or non-consumable.
3. Issues OTC with raw token generated in test, stores only SHA-256 hash, and asserts raw token and hash do not appear in audit payloads.
4. Consumes exactly once with atomic update, sets `linked_at`/`code_consumed_at`, and replay returns `already_consumed`.
5. Expired and revoked pending codes reject without linking.
6. DB uniqueness rejects a second active linked row for the same WTC user and, if adopted, for the same Axioma user.
7. Deterministic active-link read returns the linked row and ignores pending/revoked/not-linked rows.

## Next actions
1. Implement migration 0010 in `packages/db/src/schema.ts` and generated SQL, preserving additive-first behavior and clearing/rejecting plaintext `one_time_code`.
2. Add account-link repository helpers in `packages/db/src/repositories.ts` with transaction + audit semantics.
3. Update the journal-handoff linked-account lookup to use the deterministic DB helper.
4. Add focused PGlite tests before any route/UI enablement.
5. Keep terminal CTAs disabled and avoid live Axioma calls until backend/security/axioma auditors accept the route layer and live endpoint contracts.
