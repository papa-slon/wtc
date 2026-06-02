# ecosystem-platform-architect handoff
## Scope
Read-only Phase 3.44 / epoch 20260602-0940 architecture audit before admin account unlock implementation. Scope focused on package boundaries between `@wtc/auth`, `@wtc/db`, and `apps/web` admin feature code; avoiding Edge middleware and DB coupling; avoiding one-file prototype work; and preserving honest docs/status claims after the unlock slice.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/SECURITY_MODEL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`
- `packages/auth/package.json`
- `packages/auth/src/index.ts`
- `packages/auth/src/login-lockout.ts`
- `packages/audit/src/audit.ts`
- `packages/db/package.json`
- `packages/db/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/package.json`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/db-real-postgres.test.ts`

## Files changed
None — read-only audit

## Findings
1. High - Admin unlock belongs in the durable DB repository boundary, not in a React page or standalone route. Evidence: `packages/db/src/schema.ts:22`-`29` already owns durable failed-login and lockout columns on `users`; `packages/db/src/repositories.ts:111`-`174` owns the transactional login-attempt path, row lock, lockout checks, counter mutation, and failure audit rows; `packages/db/src/repositories.ts:3206`-`3211` warns that admin user repository shapes must be deliberately stripped before UI use. Recommendation: add an `@wtc/db` repository primitive such as `unlockUserAccount(db, { targetUserId, actorUserId, reason, now })` that row-locks the target user, clears the lockout columns, and writes the unlock audit row in the same transaction. Target part: `@wtc/db` identity/auth repository contract.
2. High - The pure reset semantics already exist in `@wtc/auth`, but an admin unlock should get an explicit semantic helper or deliberately reuse the reset state with clear naming. Evidence: `packages/auth/src/login-lockout.ts:21`-`30` defines the lockout state shape, `packages/auth/src/login-lockout.ts:39`-`48` defines the empty state, and `packages/auth/src/login-lockout.ts:110`-`111` resets counters for successful login. Recommendation: keep threshold and reset math in `@wtc/auth`; either add `nextAdminUnlockState()` as a small alias around the empty state or have the DB repository call the existing reset helper with an inline comment explaining the admin-unlock semantics. Target part: `@wtc/auth` pure policy boundary.
3. High - The admin surface has a natural home for this feature but currently exposes only a read-only user directory with no lockout state. Evidence: `apps/web/src/app/admin/users/page.tsx:15`-`18` labels the page as a read-only user directory, `apps/web/src/app/admin/users/page.tsx:43`-`47` says account suspension is unavailable, and the table headers at `apps/web/src/app/admin/users/page.tsx:66`-`70` include only email, display name, roles, and registered date. Recommendation: extend the existing `/admin/users` surface with a lockout/status column and guarded unlock form, or add a small child component under the admin feature tree; do not create a new one-file prototype outside `apps/web/src/features/admin` plus `apps/web/src/app/admin`. Target part: admin users UI.
4. High - The admin user DTO/repository currently cannot power an unlock UI because it strips password hashes correctly but also omits safe lockout metadata. Evidence: `packages/db/src/repositories.ts:3215`-`3221` selects `id`, `email`, `displayName`, `passwordHash`, and `createdAt` but not lockout columns; `apps/web/src/features/admin/types.ts:10`-`17` defines `AdminUserView` without lockout fields; `apps/web/src/features/admin/queries.ts:108`-`115` maps only identity/role/createdAt fields. Recommendation: add a safe admin identity DTO that includes `isLocked`, `accountLockedUntil`, `lastFailedLoginAt`, `failedLoginTotalCount`, and `accountLockoutReviewRequiredAt` while continuing to exclude `passwordHash`; keep 15m/60m counters either hidden or clearly admin-only if surfaced. Target part: admin loader/query DTO boundary.
5. High - The web mutation should follow the existing admin server action security chain. Evidence: `apps/web/src/features/admin/actions.ts:3`-`4` states the action protocol `requireUser() -> assertAdmin(roles) -> assertCsrf(formData) -> Zod -> repo -> revalidatePath`, and existing actions follow it at `apps/web/src/features/admin/actions.ts:35`-`65`; `apps/web/src/lib/csrf.tsx:24`-`34` provides the hidden field and fail-closed verifier. Recommendation: add `adminUnlockAccountAction` in `apps/web/src/features/admin/actions.ts`, a Zod schema in `apps/web/src/features/admin/schemas.ts`, and a `<CsrfField />` form in `/admin/users`; require a reason and revalidate `/admin/users` and `/admin/audit-log`. Target part: app admin action orchestration.
6. High - The audit action is already available; unlock must write it transactionally and without public credential-state leakage. Evidence: `packages/audit/src/audit.ts:45` includes `auth.account_unlock`; `packages/db/src/schema.ts:339`-`355` supports audit actor, action, target, before/after, and result fields; `docs/SECURITY_MODEL.md:164`-`165` says review/unlock must be admin/audit logged; Phase 3.43 moved failed-login audit into the DB path at `packages/db/src/repositories.ts:152`-`166`. Recommendation: the DB unlock repository should write `auth.account_unlock` with `actorUserId` as the admin, `actorRole: 'admin'`, `targetType: 'user'`, `targetId` as the target user id, safe before/after lockout metadata, and no submitted password or secret material. Target part: audit consistency.
7. Medium - Do not put account unlock in middleware or any Edge path. Evidence: `apps/web/src/middleware.ts:11`-`13` explicitly forbids importing the `@wtc/auth` barrel because it pulls the native Argon2 binding, while `apps/web/src/middleware.ts:31`-`34` imports only `next/server` plus Edge-safe auth subpaths. Recommendation: keep middleware limited to IP throttling and headers; unlock belongs in a Node server action/repository path only. Target part: Edge/runtime boundary.
8. Medium - DB-only unlock is the correct production-hardening default; memory parity is optional and must not become acceptance evidence. Evidence: `apps/web/src/lib/backend.ts:20`-`24` selects DB when `DATABASE_URL` exists and fails closed in production without it; `apps/web/src/features/admin/queries.ts:123`-`127` returns an empty demo user list without DB; `apps/web/src/lib/demo.ts:57`-`60` has in-memory lockout state for local login parity. Recommendation: implement the production unlock path against `getServerDb()` and fail closed when DB is absent; only add memory unlock helpers if a later UX/dev requirement needs them, and label them non-authoritative. Target part: backend selector and demo adapter boundary.
9. Medium - Tests should cover the repository and action boundary, not only UI rendering. Evidence: `tests/integration/auth-login-lockout-db.test.ts:57`-`147` covers PGlite lockout behavior and safe unknown-account audit fields; `tests/integration/auth-error-copy.test.ts:37`-`54` statically guards generic auth action/page copy; `tests/integration/db-real-postgres.test.ts:176`-`210` has an opt-in cross-connection failed-login race. Recommendation: add PGlite tests for `unlockUserAccount` clearing all lockout fields and writing `auth.account_unlock`; add a static/web action test proving the action calls the repository after admin+CSRF+Zod and that the users page includes CSRF; consider an opt-in real-Postgres lock/unlock race only if unlock has concurrent stale-state expectations. Target part: verification plan.
10. Medium - Docs/status must remain precise after the slice. Evidence: `docs/SECURITY_MODEL.md:174`-`175` currently marks admin unlock, email notification, reset/change/verify-email lockout, production shared-store proof, and production rollout as target-only/not run; `docs/NEXT_ACTIONS.md:14`-`16` repeats that admin unlock and active real-Postgres lockout race proof remain not run; `docs/PRODUCTION_BLOCKERS_CURRENT.md:9` still treats production nginx/shared-store throttling, real-Postgres race proof, admin unlock, and rollout as separate hardening items. Recommendation: after implementation, update docs to say only local admin unlock is implemented; do not claim email notification, production rollout, nginx/shared-store proof, append-only DB role, or CI. Target part: docs/status truth.

## Decisions
- Use existing package layering: `@wtc/auth` for pure lockout reset semantics, `@wtc/db` for durable row lock/mutation/audit, and `apps/web` for admin form/action orchestration.
- Extend the existing `/admin/users` admin feature instead of adding an isolated unlock page or route.
- Keep middleware untouched for this phase; no `@wtc/db`, auth barrel, session lookup, or admin unlock work belongs in Edge middleware.
- Prefer a DB-required admin unlock action. Demo/memory parity is optional and should remain non-production evidence.
- Treat unlock as local production-hardening progress only, not proof of production deployment or shared-store throttling.

## Risks
- If unlock clears counters outside the same transaction as the audit row, the platform can produce an unlocked account with no durable operator trail.
- If the UI exposes raw counters or account-specific public messages outside admin-only pages, it can weaken the generic login enumeration boundary established in Phase 3.43.
- If the action accepts only `userId` with no reason/expected-state guard, an admin can accidentally clear state without an operational explanation or race visibility.
- If docs overstate the result, the project may again treat a local PGlite/server-action slice as production rollout proof.
- The project is currently not git-backed (`git status --short` returned `fatal: not a git repository`), so do not imply branch, commit, PR, or CI readiness unless that changes.

## Verification/tests
- Read-only inspection only; no product code, docs, migrations, live services, databases, or preview processes were mutated.
- Commands run: targeted `rg` searches, `Get-Content` line inspections, `Test-Path` for this handoff path, and `git status --short` to verify repository backing.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run lint`, `npm run db:generate`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, real-Postgres unlock/race proof, production nginx/shared-store proof, live server mutation, CI.

## Next actions
1. In `@wtc/auth`, add or document a named admin-unlock reset helper that returns the empty lockout state without introducing DB/Next/env dependencies.
2. In `@wtc/db`, add `unlockUserAccount()` with target row lock, lockout-field reset, `auth.account_unlock` audit row, safe before/after metadata, and PGlite tests.
3. Extend admin users DTO/query mapping to include safe lockout status while continuing to strip `passwordHash`.
4. Add `adminUnlockAccountAction` under `apps/web/src/features/admin/actions.ts` with `requireUser`, `assertAdmin`, `assertCsrf`, Zod validation, DB-required fail-closed behavior, and revalidation of `/admin/users` plus `/admin/audit-log`.
5. Add a guarded unlock control to `apps/web/src/app/admin/users/page.tsx` using `<CsrfField />`; keep the page within the existing admin layout/RBAC gate.
6. Update security/status docs only after implementation and gates, preserving NOT RUN production claims for email notification, production rollout, shared-store/nginx proof, CI, and any real-Postgres race gate not actually executed.
