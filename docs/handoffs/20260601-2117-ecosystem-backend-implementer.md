# ecosystem-backend-implementer handoff
## Scope
Read-only Phase 3.14 backend implementation-plan audit for WTC-side Axioma account-link route handlers and adapters. Scope covered `init`, service-auth `complete`, and `unlink/revoke` handler shape after Phase 3.13 hash-only account-link persistence. No live Axioma, bot, exchange, TradingView, Stripe, SSH, tmux, systemd, preview-worker, or production service calls were made. No code/docs edits were made outside this handoff.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/RBAC_MATRIX.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0010_axioma_account_link_hash.sql`
- `packages/audit/src/audit.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/download/terminal/route.ts`
- `apps/web/src/app/api/axioma/jti/consume/route.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: HIGH. Evidence: `docs/STATUS.md:14` and `docs/NEXT_ACTIONS.md:9` to `docs/NEXT_ACTIONS.md:10` still list account-link routes/handlers as open, and the current Axioma API routes are only journal handoff, download, download terminal, and JTI consume at `apps/web/src/app/api/axioma/journal-handoff/route.ts:10`, `apps/web/src/app/api/axioma/download/route.ts:10`, `apps/web/src/app/api/axioma/download/terminal/route.ts:9`, and `apps/web/src/app/api/axioma/jti/consume/route.ts:7`. Recommendation: implement one extracted framework-neutral handler at `apps/web/src/features/terminal/axioma-account-link.ts`, then wire thin adapters only: `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and `DELETE /api/axioma/account-link`. Target part: code structure and route adapter wiring.
2. Severity: HIGH. Evidence: account-link persistence now has hash-only fields and active-link indexes at `packages/db/src/schema.ts:147` to `packages/db/src/schema.ts:170`, and migration `0010` adds/clears those columns/indexes at `packages/db/migrations/0010_axioma_account_link_hash.sql:1` to `packages/db/migrations/0010_axioma_account_link_hash.sql:16`. Repository helpers currently cover issue, consume, and linked-account read at `packages/db/src/repositories.ts:1109`, `packages/db/src/repositories.ts:1159`, and `packages/db/src/repositories.ts:1254`, but there is no unlink/revoke helper even though `axioma.account_link_revoke` is registered at `packages/audit/src/audit.ts:71` and RBAC specifies `DELETE /api/axioma/account-link` at `docs/RBAC_MATRIX.md:171`. Recommendation: add a transactional `revokeAxiomaAccountLinkWithAudit` helper before the DELETE route; it should verify ownership, set `state='revoked'`, stamp `revoked_at` and `updated_at`, write `axioma.account_link_revoke` in the same transaction, and optionally revoke live handoff JTIs for the user. Target part: DB helper gap for unlink/revoke.
3. Severity: HIGH. Evidence: `POST /api/axioma/account-link/complete` is documented as a service-auth envelope with no query params at `docs/CONTRACTS/axioma-bridge.md:394`, while the existing inbound JTI route already has a bearer parser and timing-safe token compare at `apps/web/src/features/terminal/axioma-jti-consume.ts:27` to `apps/web/src/features/terminal/axioma-jti-consume.ts:40` and `apps/web/src/features/terminal/axioma-jti-consume.ts:78` to `apps/web/src/features/terminal/axioma-jti-consume.ts:81`. The contract also treats `AXIOMA_BRIDGE_API_TOKEN` as the WTC service-account credential at `docs/CONTRACTS/axioma-bridge.md:1061`, so using it for inbound Axioma-to-WTC completion couples outbound and inbound privileges. Recommendation: factor a tiny service-bearer verifier shared with JTI consume and prefer a separate inbound env such as `AXIOMA_ACCOUNT_LINK_API_TOKEN` or `AXIOMA_BRIDGE_INBOUND_TOKEN`; if Phase 3.14 intentionally reuses `AXIOMA_BRIDGE_API_TOKEN` for local acceptance, document that as local-only and test missing, whitespace, wrong, and correct bearer cases. Target part: service-token boundary.
4. Severity: HIGH. Evidence: the RBAC convention requires Zod before business logic at `docs/RBAC_MATRIX.md:44`, and the account-link init pipeline is specified at `docs/RBAC_MATRIX.md:163`. Existing Axioma handlers use injected dependencies and explicit method gates, but JTI consume currently hand-parses JSON and validates `jti` manually at `apps/web/src/features/terminal/axioma-jti-consume.ts:84` to `apps/web/src/features/terminal/axioma-jti-consume.ts:91`. Recommendation: the account-link handler should use bounded body reading plus Zod schemas: init accepts either empty JSON or a small declared options object; complete accepts POST body fields for raw code and `axioma_user_id`/`axiomaUserId`; unlink accepts optional reason. Invalid schema must return 400 or 422 before DB mutation. Raw OTC must never be accepted in query params. Target part: Zod/body parsing.
5. Severity: HIGH. Evidence: `issueAxiomaAccountLinkNonceWithAudit` records only caller-supplied `entitlementVerified` at `packages/db/src/repositories.ts:1070` to `packages/db/src/repositories.ts:1077`; `consumeAxiomaAccountLinkNonceWithAudit` then links by nonce hash and Axioma user id at `packages/db/src/repositories.ts:1159` to `packages/db/src/repositories.ts:1250`. Entitlements are the only access source of truth per the seed, and current session routes check `accessFor(user.id, 'axioma_terminal')` before acting as shown in `apps/web/src/features/terminal/axioma-journal-handoff.ts:87` to `apps/web/src/features/terminal/axioma-journal-handoff.ts:90` and `apps/web/src/features/terminal/axioma-download.ts:223` to `apps/web/src/features/terminal/axioma-download.ts:225`. Recommendation: complete must re-check current `axioma_terminal` entitlement before changing `pending` to `linked`; add a DB helper to resolve the pending row by hash without exposing raw code, or extend consume to support an expected/current entitlement gate. Target part: entitlement fail-closed semantics.
6. Severity: MEDIUM. Evidence: the consume helper preflights duplicate active links at `packages/db/src/repositories.ts:1191` to `packages/db/src/repositories.ts:1214`, then performs a conditional update at `packages/db/src/repositories.ts:1216` to `packages/db/src/repositories.ts:1234`; the DB indexes are the true race boundary at `packages/db/src/schema.ts:166` to `packages/db/src/schema.ts:168`. Recommendation: handler/repository acceptance should cover duplicate-user and duplicate-Axioma races. If a partial unique index raises a conflict after preflight, map it to a 409-style failure with an audit row instead of letting an unaudited 500 escape. Target part: concurrent complete safety.
7. Severity: MEDIUM. Evidence: docs disagree on OTC TTL: the current contract says TTL 10 minutes at `docs/CONTRACTS/axioma-bridge.md:389` and `docs/CONTRACTS/axioma-bridge.md:402`, while RBAC says code max TTL 5 minutes at `docs/RBAC_MATRIX.md:163` and `docs/RBAC_MATRIX.md:169`. Recommendation: choose one value before implementation; for minimal local acceptance, prefer the stricter 5-minute default unless product/security owners explicitly keep 10 minutes, then update the contract/RBAC docs in the aggregate phase. Target part: handler constants and docs truth.
8. Severity: MEDIUM. Evidence: terminal UI activation is still intentionally disabled: `apps/web/src/features/terminal/loader.ts:108` and `apps/web/src/features/terminal/loader.ts:122` set `bridgeActionsImplemented: false`, and the terminal page gates download/open-journal actions at `apps/web/src/app/(app)/app/terminal/page.tsx:31`, `apps/web/src/app/(app)/app/terminal/page.tsx:170`, and `apps/web/src/app/(app)/app/terminal/page.tsx:196`. The Connect Account button is hard-disabled at `apps/web/src/app/(app)/app/terminal/page.tsx:121` to `apps/web/src/app/(app)/app/terminal/page.tsx:129`. Recommendation: Phase 3.14 should not flip CTAs or wire browser UI unless it explicitly expands scope to UI/e2e acceptance; local backend route acceptance can land while CTAs remain disabled. Target part: minimal local acceptance scope.
9. Severity: MEDIUM. Evidence: current focused tests cover DB account-link persistence at `tests/integration/db-axioma-account-link.test.ts:51`, static account-link persistence guards at `tests/integration/axioma-skeleton-static.test.ts:79`, and existing Axioma handler patterns for journal/download/JTI at `tests/integration/axioma-journal-handoff-handler.test.ts:136`, `tests/integration/axioma-download-handler.test.ts:139`, and `tests/integration/axioma-jti-consume-handler.test.ts:74`. No `axioma-account-link-handler.test.ts` exists in the current file set. Recommendation: add a handler suite before claiming Phase 3.14 acceptance: method gates, no-store responses, CSRF-before-user for init/unlink, service bearer before body/DB for complete, Zod failures, no-query raw OTC, hash-only issue/consume, entitlement-denied side effects, unlink audit, duplicate/replay/expired mappings, and no live `fetch(`. Target part: tests and local acceptance.

## Decisions
- Use the same pattern as Phase 3.11 and Phase 3.12: framework-neutral account-link handler in `apps/web/src/features/terminal`, thin Next route adapters under `apps/web/src/app/api/axioma`, and dependency injection for DB, env, session, CSRF, access, token generation, hashing, and clock.
- Treat `init` and `unlink` as browser-session mutations: method gate, CSRF header, `requireUser`, entitlement check, route readiness, DB mutation, in-transaction audit, no-store response.
- Treat `complete` as an Axioma-origin service-auth mutation: method gate, bearer/service-token verification, bounded Zod body, no session cookie or browser CSRF, route readiness, current entitlement check for the pending row's WTC user, hash-only consume, in-transaction audit.
- Return the raw OTC only once from `init` in the response body, never in query strings, audit rows, DB plaintext columns, logs, screenshots, or static docs examples.
- Keep `bridgeActionsImplemented: false` and terminal CTAs disabled for this backend-only slice.

## Risks
- Reusing `AXIOMA_BRIDGE_API_TOKEN` for inbound complete without explicitly documenting the bidirectional trust model increases blast radius and can confuse future production key rotation.
- Without a revoke helper, DELETE can easily become an app-layer update plus separate audit write, violating the repo's mutation pipeline.
- Without a pending-row lookup or consume-time entitlement gate, a code issued just before an entitlement revoke can still become a linked account during the TTL window.
- Without conflict mapping around partial unique indexes, concurrent complete attempts may throw an unaudited 500 even though the DB protects uniqueness.
- If docs keep both 5-minute and 10-minute OTC TTLs, tests can go green while product/security expectations remain split.

## Verification/tests
- Read-only audit only; no npm, Vitest, Playwright, migration, or live integration gates were run in this auditor lane.
- Verified existing Phase 3.14 backend handoff target did not already exist before writing.
- `git status --short` could not verify worktree cleanliness because this directory is not a git repository.

## Next actions
1. Backend implementer: add `apps/web/src/features/terminal/axioma-account-link.ts` with injectable `handleAxiomaAccountLinkRequest` or separate `handleInit/handleComplete/handleUnlink` functions using Zod schemas and no-query OTC rejection.
2. DB implementer/backend implementer: add account-link pending lookup and revoke/unlink helpers with in-transaction audit, plus duplicate conflict mapping if the consume helper can hit partial unique index races.
3. Backend implementer: add thin route adapters for `POST /api/axioma/account-link/init`, `POST /api/axioma/account-link/complete`, and `DELETE /api/axioma/account-link`, reusing `csrfToken`, `requireUser`, `accessFor`, `reasonLabel`, `getServerDb`, and env injection patterns from the current Axioma routes.
4. Tests runner: add `tests/integration/axioma-account-link-handler.test.ts` and extend `tests/integration/axioma-skeleton-static.test.ts` for handler extraction, Zod/body guard, service-bearer guard, no direct `fetch(`, no `?code=`, no raw OTC in audit/DB, and disabled terminal CTAs.
5. Operator: after implementation, run focused account-link/Axioma suites, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run db:generate -w @wtc/db`, governance, full gates, and e2e as the aggregate Phase 3.14 acceptance boundary.
