# ecosystem-db-architect handoff
## Scope
Read-only DB planning lane for phase epoch `20260601-1946`. Scope was the DB/repository impact of extracting `POST /api/axioma/journal-handoff` into a testable handler: JTI insert behavior, issuance audit atomicity, current `@wtc/db` transaction options, `axioma_account_links` query shape, and whether this phase should add schema/migration changes or stay handler/test-only. No source, migrations, fixtures, product docs, live DBs, or external services were changed or run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`
- `docs/handoffs/20260601-1907-ecosystem-db-architect.md`
- `packages/db/src/client.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
None - read-only audit

## Findings
1. HIGH - Current journal-handoff issuance writes the JTI row and issuance audit as two independent operations, so an audit failure after `recordHandoffJti` can leave a live, unconsumed JTI row with no matching issuance audit while the client receives `503`. Evidence: `apps/web/src/app/api/axioma/journal-handoff/route.ts:79` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:92` inserts the JTI then calls `audit.write`; `recordHandoffJti` is explicitly a pure insert at `packages/db/src/repositories.ts:1165` to `packages/db/src/repositories.ts:1178`; `createDbAuditWriter` is a standalone insert at `packages/db/src/repositories.ts:236` to `packages/db/src/repositories.ts:240`. Recommendation: add a minimal `@wtc/db` repository helper, e.g. `recordHandoffJtiWithAudit(db, { jti, sub, issuedAt, expiresAt, audit }, now?)`, that inserts `axioma_handoff_jti_revocations` and `audit_logs` inside one transaction before the handler returns the token. Target part: journal-handoff issuance DB boundary.
2. HIGH - `@wtc/db` already has the transaction primitive needed for atomic issuance, and existing critical mutations use it to keep state and audit rows in lock-step. Evidence: the exported `Db` type is the Drizzle postgres-js database from `packages/db/src/client.ts:5` to `packages/db/src/client.ts:14`; `grantProduct` documents and implements entitlement mutation plus audit in one `db.transaction` at `packages/db/src/repositories.ts:125` to `packages/db/src/repositories.ts:161`; `atomicGrantTv` uses the same pattern for multi-row TradingView state at `packages/db/src/repositories.ts:1763` to `packages/db/src/repositories.ts:1784`. Recommendation: keep the extracted request handler outside any outer transaction, then call a single repository transaction for JTI+audit. Avoid nested transaction composition unless a future helper accepts an explicit transaction object. Target part: `@wtc/db` transaction design.
3. MEDIUM - No schema or migration change is required for the journal-handoff extraction itself. Evidence: the JTI table already has caller-supplied `uuid` primary key plus expiry/sub indexes at `packages/db/src/schema.ts:633` to `packages/db/src/schema.ts:657`; the replay spec says issuance is an insert and consume is the guarded update at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:200` to `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:218`; current DB tests cover record, consume-once, replay, expired, not-found, revoked, purge, and an opt-in real-Postgres race at `tests/integration/db-axioma-jti.test.ts:57` to `tests/integration/db-axioma-jti.test.ts:158`. Recommendation: keep this phase handler/test-only plus, at most, the repository helper above; do not generate a migration. Target part: phase scope and migrations.
4. MEDIUM - The current `axioma_account_links` read is optional for claims, but it is nondeterministic if duplicate linked rows exist and the table still has the B4 plaintext OTC shape. Evidence: schema defines `axioma_account_links` with `state`, `axiomaUserId`, plaintext `oneTimeCode`, and no unique/index callback at `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:155`; the route selects one linked row with `.limit(1)` and no ordering at `apps/web/src/app/api/axioma/journal-handoff/route.ts:68` to `apps/web/src/app/api/axioma/journal-handoff/route.ts:78`; Phase 3.10 still records account-link OTC storage as a blocker at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:84` to `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:89`. Recommendation: for this extraction, either keep the read inline but add deterministic `orderBy(desc(createdAt))`, or add a tiny repository read helper `getLinkedAxiomaAccountForUser(db, userId)` that returns only `{ axiomaUserId }`; leave hashed OTC storage, `linked_at`, consumed timestamps, and uniqueness constraints to a separate account-link activation phase. Target part: Axioma account-link query.
5. MEDIUM - Handler extraction should prove route-level behavior with a real request harness, not only source-pattern static checks. Evidence: the static test currently checks that the route imports `recordHandoffJti`, reads `schema.axiomaAccountLinks`, and uses `axioma.account_link_init` at `tests/integration/axioma-skeleton-static.test.ts:42` to `tests/integration/axioma-skeleton-static.test.ts:59`; the snapshot test only proves claim serialization for supplied entitlement/link values at `tests/integration/axioma-handoff-snapshot.test.ts:17` to `tests/integration/axioma-handoff-snapshot.test.ts:53`; Phase 3.10 explicitly left journal-handoff issuance extraction unproven at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:86` to `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:88`. Recommendation: add a testable handler with injected DB, audit/atomic helper seam, session user, CSRF verifier, access decision, env, and clock; cover 405, CSRF failure, unauthenticated, entitlement denied, not configured, linked and unlinked successful claims, duplicate/failed JTI insert rollback, and audit failure rollback. Target part: journal-handoff handler tests.
6. LOW - The extracted handler should not expand Axioma activation scope or enable CTAs. Evidence: Phase 3.10 deliberately kept terminal CTAs disabled and made local readiness only at `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:77` to `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md:89`; the token spec still marks live endpoint shapes, key provisioning, download/open-journal activation, and OTC migration as TARGET/B4 at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:7` to `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:16`. Recommendation: limit this phase to extraction, local PGlite tests, and the atomic issuance helper; no live Axioma calls, no download proxy, and no account-link DDL. Target part: phase boundary.

## Decisions
- Recommend no schema or migration changes for epoch `20260601-1946`.
- Recommend one minimal repository helper only if the implementation wants to prove JTI issuance and `axioma.account_link_init` audit as a single atomic mutation. The helper should live in `packages/db/src/repositories.ts`, use `db.transaction`, reuse `auditRowValues`, and return only after both rows are committed.
- Keep `recordHandoffJti` as the existing pure primitive for tests and lower-level callers; do not change its behavior or add inline audit to it.
- Keep `consumeHandoffJti` as the existing single-statement conditional update primitive. The consume route's audit behavior is already covered by Phase 3.10 and does not require this journal-handoff extraction to alter consume semantics.
- Treat `axioma_account_links` hashed OTC/uniqueness work as a separate B4 account-link activation migration, not part of handler extraction.

## Risks
- If extraction keeps `recordHandoffJti` followed by injected `AuditWriter.write`, the test harness can become cleaner while preserving the same partial-write risk.
- If a repository helper starts its own transaction while called from inside another repository transaction, PGlite/Postgres savepoint behavior could reintroduce the nested-transaction fragility already documented elsewhere in the repo. Keep the route orchestration non-transactional and call one helper transaction.
- A deterministic account-link read helper improves tests but does not solve duplicate linked rows; real account-link activation still needs DDL.
- A duplicate JTI insert should fail the whole issuance and return a configured failure; using `onConflictDoNothing` would silently issue a token without proving the replay row was created.

## Verification/tests
Not run in this read-only planning lane. Only file inspection and `rg` searches were performed; no live DB, external service, server, migration, or test command was run.

Recommended implementation gates:
- `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/db-axioma-jti.test.ts`
- `npm run typecheck -w @wtc/web`
- `npm run typecheck`
- `npm run db:generate -w @wtc/db` should report no schema changes if no migration was added.
- `node scripts/gates.mjs full`

## Next actions
1. Extract `apps/web/src/app/api/axioma/journal-handoff/route.ts` into a request-level handler under `apps/web/src/features/terminal/` with injectable auth/access/CSRF/env/clock/DB seams.
2. Add `recordHandoffJtiWithAudit` or similarly named helper in `packages/db/src/repositories.ts` if atomic issue+audit is in scope for the implementation lane.
3. Add PGlite-backed handler tests proving successful issuance inserts one JTI row and one issuance audit row, and injected audit/JTI failures roll back or leave no returned token.
4. Keep account-link DDL and live Axioma activation out of this phase unless the operator explicitly starts a separate B4 account-link activation session.
