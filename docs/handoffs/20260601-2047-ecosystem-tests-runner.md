# ecosystem-tests-runner handoff
## Scope
Read-only test-planning lane for WTC Ecosystem Platform Phase 3.13, epoch `20260601-2047`. Scope is local Axioma account-link OTC hash migration plus active-link uniqueness. No live services, no external calls, no production/preview mutation, and no code edits outside this handoff.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/DATA_MODEL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/RBAC_MATRIX.md`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0009_wide_orphan.sql`
- `packages/db/migrations/meta/0009_snapshot.json`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/admin/terminal/page.tsx`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `scripts/gates.mjs`
- `package.json`

## Files changed
None - read-only audit

## Findings
1. HIGH - Evidence: current Drizzle schema already models the target hash/active-link shape with `linkNonceHash`, `consumedAt`, `revokedAt`, `linkedAt`, `lastVerifiedAt`, `updatedAt`, and partial unique indexes at `packages/db/src/schema.ts:147-169`, but the applied migration baseline still creates `one_time_code` at `packages/db/migrations/0000_broken_jack_murdock.sql:17-24`, and the latest migration snapshot still records `one_time_code` at `packages/db/migrations/meta/0009_snapshot.json:182-189`. Recommendation: Phase 3.13 must add a real migration and tests that replay migrations into PGlite, introspect `axioma_account_links`, and prove the final database shape matches the schema before any repository/route test is considered accepted. Target part: DB migration truth.
2. HIGH - Evidence: repository helpers currently cover download-token lifecycle at `packages/db/src/repositories.ts:1168` and `packages/db/src/repositories.ts:1216`, and handoff-JTI lifecycle at `packages/db/src/repositories.ts:1315` and `packages/db/src/repositories.ts:1360`; no account-link OTC issue/consume helper is present, while existing journal tests insert `schema.axiomaAccountLinks` rows directly at `tests/integration/axioma-journal-handoff-handler.test.ts:124-128`. Recommendation: add repository-level account-link tests before route/UI work, using a generated raw OTC only as input/output at issue time and asserting only a hash is persisted or audited. Target part: account-link domain helpers.
3. HIGH - Evidence: the desired active-link uniqueness boundary is only visible as schema partial indexes (`aal_active_user_idx`, `aal_active_axioma_user_idx`) at `packages/db/src/schema.ts:165-167`; no current test asserts their behavior. Recommendation: add PGlite tests proving one unrevoked `linked` row per WTC user, one unrevoked `linked` row per non-null Axioma user id, revoked rows do not block relink, pending rows do not count as active links, and duplicate `link_nonce_hash` is rejected. Target part: active-link uniqueness acceptance.
4. HIGH - Evidence: the contract's OTC flow requires a cryptographically random 32-byte token, TTL, single-use, user binding, and atomic consumed state at `docs/CONTRACTS/axioma-bridge.md:398-403`, and states WTC stores `link_nonce_hash` while discarding the OTC at `docs/CONTRACTS/axioma-bridge.md:405-414`. Recommendation: focused tests should include issue -> consume -> replay, expired, wrong-user/wrong-link, revoked/unlinked, and audit-failure rollback cases, with raw OTC absent from DB rows, audit JSON, responses after issuance, logs, and fixtures. Target part: hash-only OTC lifecycle.
5. MEDIUM - Evidence: current docs disagree on account-link state names: schema uses `pending | linked | revoked | expired | error | not_linked` at `packages/db/src/schema.ts:152`, the TypeScript contract interface documents only `linked | pending | not_linked` at `docs/CONTRACTS/axioma-bridge.md:920-924`, and the data model still documents `status` instead of `state` with older values at `docs/DATA_MODEL.md:570-578`. Recommendation: add static guards that fail if docs keep stale `one_time_code`/`status` wording after the migration, and require one canonical state set before enabling account-link routes. Target part: contract/data-model consistency.
6. MEDIUM - Evidence: route naming is not yet canonical: the bridge contract sequence says Axioma calls `POST /api/axioma/link` at `docs/CONTRACTS/axioma-bridge.md:392`, while RBAC documents `POST /api/axioma/account-link/init` and `POST /api/axioma/account-link/complete` at `docs/RBAC_MATRIX.md:163` and `docs/RBAC_MATRIX.md:170`. Recommendation: choose one local route pair before implementation; if both aliases are intentionally supported, tests must prove both share the same handler, validation, audit, and no-query-token behavior. Target part: account-link API surface.
7. MEDIUM - Evidence: audit codes exist in `packages/audit/src/audit.ts:69-82`, and `docs/AUDIT_LOG_SCHEMA.md:200-204`, but the forbidden-token section still names `axioma_account_links.one_time_code` at `docs/AUDIT_LOG_SCHEMA.md:280-286`. Recommendation: account-link tests should assert canonical audit actions (`axioma.account_link_init`, `axioma.account_link_complete`, `axioma.account_link_revoke` unless renamed by owners), success/failure results, and zero raw OTC/hash leakage; static guards should update the forbidden-token note to the new hash-only shape. Target part: audit redaction and action truth.
8. MEDIUM - Evidence: terminal CTAs are still guarded by `bridgeActionsImplemented: false` in the loader at `apps/web/src/features/terminal/loader.ts:108` and `apps/web/src/features/terminal/loader.ts:122`, and page buttons require `terminalData.routeSkeletonConfigured && terminalData.bridgeActionsImplemented` at `apps/web/src/app/(app)/app/terminal/page.tsx:30-33`; existing static tests assert the disabled gate at `tests/integration/axioma-skeleton-static.test.ts:94-96`. Recommendation: Phase 3.13 should keep Download/Open Journal/Connect Account disabled unless the implementation explicitly includes and tests a complete local account-link UX surface; DB hash/uniqueness alone must not enable CTAs. Target part: terminal UI safety boundary.

## Decisions
- Use migration-replay tests as the first acceptance boundary. A Drizzle schema edit without a migration is not acceptable for this phase.
- Prefer one focused DB suite named `tests/integration/db-axioma-account-link.test.ts` for migration shape, hash-only storage, consume/replay/expiry/revoke, audit, and uniqueness behavior.
- If route handlers are implemented in this phase, add `tests/integration/axioma-account-link-handler.test.ts`; otherwise keep the phase DB/repository-only and document route work as a next slice.
- Keep all Axioma calls mocked/local. Do not call `axi-o.ma`, do not fetch live installer bytes, and do not touch Axioma credentials.
- Keep terminal CTAs disabled in static/e2e checks unless a separate scoped phase accepts live endpoint/key/replay/download behavior.

## Risks
- PGlite can prove migration replay and partial-index behavior, but it is not a substitute for a two-connection race test on real Postgres. If `REAL_POSTGRES_DATABASE_URL` is not a throwaway `wtc_test*` DB, the real-PG concurrency block must stay skipped.
- If migration 0010 drops `one_time_code`, an upgrade test should seed a legacy row after migrations through 0009 and before 0010 to prove raw OTC data is removed or safely expired without leaking.
- If route path naming is not resolved before coding, tests may bless a URL that conflicts with either the bridge contract or RBAC matrix.
- Account-link completion is an Axioma-to-WTC server callback in the contract; tests must not accidentally make it a browser-only unauthenticated mutation.

## Verification/tests
Read-only audit only; no gates were executed by this agent.

Focused tests to add:
- `tests/integration/db-axioma-account-link.test.ts`
  - Replay all migrations into PGlite before Drizzle setup, matching the existing pattern at `tests/integration/db-axioma-jti.test.ts:38-41`, `tests/integration/db-axioma-download-token.test.ts:31-33`, and `tests/integration/axioma-journal-handoff-handler.test.ts:30-32`.
  - Assert final `axioma_account_links` columns include `link_nonce_hash`, `code_expires_at`, `consumed_at`, `revoked_at`, `linked_at`, `last_verified_at`, `error_message`, `updated_at`, and do not expose writable raw `one_time_code`.
  - Assert final indexes include `aal_link_nonce_hash_idx`, `aal_active_user_idx`, `aal_active_axioma_user_idx`, `aal_user_state_idx`, and `aal_code_expires_at_idx`.
  - Seed a legacy pre-0010 row with `one_time_code`, run the new migration, and assert raw OTC is gone or nulled/expired according to the DB architect decision.
  - Issue OTC: raw token is returned once, DB stores only SHA-256 hash, expiry is deterministic, audit has no raw token/hash.
  - Consume OTC: first matching consume sets `consumed_at`, `linked_at`, `state='linked'`, and `axioma_user_id`; replay returns already-consumed/410-style result and does not relink.
  - Negative consumes: unknown hash, expired, wrong user or wrong pending row, revoked row, missing/invalid Axioma user id, and duplicate hash.
  - Uniqueness: duplicate active link for same WTC user fails; duplicate active link for same non-null Axioma user id fails; revoked/unlinked historical rows allow relink; pending rows do not satisfy open-journal.
  - Optional real-Postgres block: when `REAL_POSTGRES_DATABASE_URL` targets a throwaway `wtc_test*` DB, two concurrent consumes of the same OTC produce exactly one linked row.
- `tests/integration/axioma-account-link-handler.test.ts` if handlers land:
  - Init route: POST-only, CSRF before auth, authenticated, entitlement fail-closed, route readiness, DB required, no-store responses, hash-only persistence, audit redaction, no live fetch.
  - Complete route: POST body only, service-auth or agreed auth boundary, zod validation, no query token, atomic consume, linked result, replay/expired/wrong-user/revoked failures, no raw OTC in error bodies.
  - Unlink/revoke route if included: auth + entitlement/RBAC, stamps `revoked_at`, writes `axioma.account_link_revoke`, preserves history, and allows future relink.
- `tests/integration/axioma-skeleton-static.test.ts`
  - Schema guard: `linkNonceHash`, partial index names, no `oneTimeCode` field in schema, and no account-link code path writes raw OTC.
  - Repository guard: account-link issue/consume helpers exist if routes are implemented; no direct live `fetch(` in account-link handlers.
  - Contract/docs guard: `DATA_MODEL.md`, `CONTRACTS/axioma-bridge.md`, `AUDIT_LOG_SCHEMA.md`, and `NEXT_ACTIONS.md` mention hash-only OTC and active-link uniqueness after implementation.
  - UI guard: `bridgeActionsImplemented: false` and disabled terminal CTAs remain until a later activation phase.

Focused command after implementation:
`npm test -- tests/integration/db-axioma-account-link.test.ts tests/integration/axioma-account-link-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/db-axioma-download-token.test.ts`

Exact final gates for the operator phase:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run db:generate -w @wtc/db` and confirm no schema changes after the migration is committed
- `npm run governance:check`
- `node scripts/gates.mjs full`
- Env-cleared `node scripts/gates.mjs e2e`
- Final `npm run governance:check`

NOT RUN boundaries for this phase:
- Live Axioma endpoint-shape/JWKS/open-journal/download/OTC acceptance
- Live Axioma installer streaming
- Live Axioma service-account token exchange
- Live Stripe checkout or webhook replay
- Live TradingView automation
- Live bot/exchange control
- SSH, tmux, systemd, preview-worker, or production service mutation
- Real-Postgres cross-connection consume race unless a throwaway `wtc_test*` `REAL_POSTGRES_DATABASE_URL` is explicitly provided

## Next actions
1. DB implementer: reconcile current schema drift by adding the account-link migration, including hash-only OTC storage and active-link partial indexes, then run `npm run db:generate -w @wtc/db` until it reports no changes.
2. Backend implementer: add account-link repository helpers with in-transaction audit writes; add routes only after the route path/auth decision is settled.
3. Tests runner: add the focused DB, optional handler, and static suites above before the phase aggregate claims local account-link acceptance.
4. Operator: keep CTAs disabled and list live Axioma, real installer streaming, and optional real-PG race as NOT RUN unless they are explicitly scoped and observed green.
