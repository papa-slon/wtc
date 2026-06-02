# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.43 / epoch 20260602-0903 security audit of current auth/account-lockout requirements and risks before implementation. Focus: DB-backed account-specific login lockout, generic login errors, account enumeration resistance, audit payload shape, reset-on-success, admin unlock needs, race/lockout semantics, and what must not be claimed. No product code edits.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/e2e/helpers/auth.ts`
## Files changed
This handoff only: `docs/handoffs/20260602-0903-ecosystem-security-auditor.md`. Product code/docs audited: None - read-only audit.
## Findings
1. HIGH - DB-backed account-specific login lockout is still not implemented. Evidence: `docs/SECURITY_MODEL.md:147`-`docs/SECURITY_MODEL.md:162` defines target failed-login counters and lockout columns, and explicitly says the columns/admin unlock flow are not present. The shipped `users` table still has only identity fields (`id`, `email`, `passwordHash`, `displayName`, `createdAt`) at `packages/db/src/schema.ts:15`-`packages/db/src/schema.ts:24`. The DB login path only finds a user and verifies the password at `apps/web/src/lib/db-store.ts:78`-`apps/web/src/lib/db-store.ts:82`; the memory path mirrors that at `apps/web/src/lib/demo.ts:204`-`apps/web/src/lib/demo.ts:207`. Recommendation: implement a DB-backed lockout slice with persistent attempt state, lock-until state, reset-on-success, admin unlock, and tests before claiming account lockout. Target part: auth/account lockout.
2. HIGH - Current login failure handling cannot distinguish or enforce locked accounts, and the success path cannot reset counters because no counters exist. Evidence: `apps/web/src/app/(auth)/actions.ts:26`-`apps/web/src/app/(auth)/actions.ts:33` calls `verifyLogin`, writes `auth.login_failed` on a null result, writes `auth.login` on success, and redirects; there is no pre-check for `account_locked_until`, no failed-count update, and no reset-on-success. Recommendation: move login decisioning into a backend auth repository/service that performs one transactionally coherent operation: resolve normalized identifier, evaluate lock state, verify password when allowed, increment/lock on failure, reset attempt state on success, create session only after the reset decision, and emit audit rows. Target part: backend auth service.
3. HIGH - Race/lockout semantics are undefined and untested. Evidence: `packages/db/src/repositories.ts:59`-`packages/db/src/repositories.ts:61` performs a plain `findUserByEmail`; `apps/web/src/lib/db-store.ts:78`-`apps/web/src/lib/db-store.ts:82` verifies outside any transaction; `tests/integration/auth-rate-limit-middleware.test.ts:33`-`tests/integration/auth-rate-limit-middleware.test.ts:71` covers IP middleware only. Recommendation: define atomic semantics before implementation: concurrent bad-password attempts against the same normalized account must not lose increments; the request that crosses the threshold should set the lock exactly once; attempts during lock should not run Argon2 verification; success racing with failures must not leave stale lock state. Use row-level locking or a single conditional `UPDATE ... RETURNING` pattern and add PGlite plus real-Postgres race proof where possible. Target part: DB/repository lockout primitive.
4. MEDIUM - Browser-facing account enumeration is currently controlled by generic copy, but internal failed-login audit target shape is not ready for lockout. Evidence: error copy allowlists stable neutral codes at `apps/web/src/features/auth/error-copy.ts:1`-`apps/web/src/features/auth/error-copy.ts:30`, and tests reject hostile/account-specific query text at `tests/integration/auth-error-copy.test.ts:25`-`tests/integration/auth-error-copy.test.ts:35`. However failed login audit currently writes `targetType: 'user'` and `targetId: parsed.data.email` at `apps/web/src/app/(auth)/actions.ts:27`-`apps/web/src/app/(auth)/actions.ts:29`, including for unknown users. Recommendation: for the lockout slice, keep browser responses identical for nonexistent, bad-password, and locked accounts; use an audit payload that does not require lying about `targetType: 'user'` for unknown accounts. Prefer `targetType: 'auth_login_identifier'` with a normalized/HMACed identifier, plus `after` fields like `{ outcome, lockoutApplied, attemptWindow }`; include `userId` only when resolved and avoid password, session, CSRF, IP-derived secrets, or raw exception text. Target part: audit payload and enumeration resistance.
5. MEDIUM - Admin unlock is specified but has no route/repository/state to operate on. Evidence: `docs/RBAC_MATRIX.md:233` lists `POST /api/admin/users/:id/unlock` with `auth.account_unlock`; `packages/audit/src/audit.ts:40`-`packages/audit/src/audit.ts:46` already reserves `auth.account_unlock`; `docs/SECURITY_MODEL.md:160`-`docs/SECURITY_MODEL.md:162` says admin unlock is target-only. Search of app/repository surfaces found no admin unlock handler or repository. Recommendation: implement admin unlock as an admin-only, CSRF-protected mutation that clears lockout/failed-attempt state in the same transaction as an `auth.account_unlock` audit row, requires a reason, and returns no credential-state detail to public auth flows. Target part: admin unlock.
6. MEDIUM - The only shipped throttling is per-instance/IP middleware; it is not an account-specific defense and should not be described as one. Evidence: `apps/web/src/middleware.ts:28`-`apps/web/src/middleware.ts:43` documents an in-process `Map`; `apps/web/src/middleware.ts:77`-`apps/web/src/middleware.ts:100` throttles `POST /login` and `POST /register` by client IP; `tests/integration/auth-rate-limit-middleware.test.ts:33`-`tests/integration/auth-rate-limit-middleware.test.ts:52` proves generic 429 for IP bursts. Phase 3.42 also states DB-backed account lockout was NOT RUN at `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:114`-`docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:117`. Recommendation: keep claims narrow: "IP middleware auth throttling is locally covered"; do not claim account lockout, distributed credential-stuffing protection, shared-store production throttling, admin unlock, or reset-on-success until implemented and verified. Target part: docs/status/acceptance truth.
## Decisions
- Do not treat middleware 429 coverage as account lockout coverage. It is useful Layer 1 throttling only.
- Keep user-facing login/register errors generic. The lockout implementation must not expose whether the identifier exists, whether the password was wrong, or whether a specific account is locked.
- The next implementation should centralize login decisioning in a backend auth service/repository instead of scattering lockout state updates across server actions.
- `auth.account_unlock` is already available in `AUDIT_ACTIONS`; no audit action registration is needed for the basic unlock event, but the schema/repository/admin route and in-transaction audit write are still missing.
- Do not claim reset-on-success until a successful login actually clears failed-attempt/lockout-window state in the same durable model used for failures.
## Risks
- Distributed credential stuffing can rotate IPs and continue attacking one account until account-specific lockout exists.
- A naive implementation can leak account existence through timing, response text, redirect codes, audit target conventions shown in admin UI, or different behavior for locked versus nonexistent users.
- A non-atomic counter update can undercount concurrent failures or unlock/reset stale state incorrectly.
- Locking by raw email without normalization can let attackers bypass counters via case/whitespace variants.
- Logging raw identifiers for unknown accounts may become sensitive operational data; if retained, it should be normalized, minimized, and never exposed outside admin/security audit contexts.
## Verification/tests
Gates RUN:
- Source inspection only of the files listed above.
- Targeted repository search for `failed_login`, `account_locked`, `lockout`, `auth.account_unlock`, `unlock`, `rate_limited`, and auth/rate-limit/csrf tests.

Gates NOT RUN:
- `npm test` - not run; this was a read-only audit and existing Phase 3.42 focused tests already covered IP middleware/error-copy, not DB lockout.
- `npm run check:core` - not run; no code changes.
- `npm run typecheck` / `npm run typecheck -w @wtc/web` - not run; no code changes.
- `npm run lint` - not run; no code changes.
- `node scripts/gates.mjs full` / `node scripts/gates.mjs e2e` - not run; no code changes and no server mutation requested.
- DB-backed account lockout proof - NOT RUN; not implemented.
- Real-Postgres lockout race proof - NOT RUN; not implemented and no operator-provided DB credentials.
- Production nginx/shared-store auth throttling/trusted proxy verification - NOT RUN; outside this read-only local source audit and no live server mutation allowed.
## Next actions
1. Add a DB migration for account lockout state, either on `users` (`failed_login_count`, `failed_login_reset_at`, `account_locked_until`, optional `account_lockout_review_required`) or a dedicated `auth_login_attempts`/`auth_account_lockouts` table keyed by normalized identifier/user id. Prefer a shape that supports unknown-identifier attempts without misusing `users`.
2. Implement a backend auth decision function that enforces lockout before Argon2 verification, increments failures atomically, sets lock windows at thresholds, resets counters on success, creates the session after the decision, and writes safe audit rows.
3. Add an admin unlock route/action with admin RBAC, CSRF, reason capture, in-transaction `auth.account_unlock` audit, and no public credential-state leakage.
4. Add tests for generic responses/no account enumeration, reset-on-success, locked-account behavior, unknown-account behavior, audit payload shape, admin unlock, PGlite concurrency, and real-Postgres race acceptance when credentials are available.
5. Update docs/status only after implementation: until then, the accurate claim remains IP middleware rate limiting only; DB-backed account-specific lockout is target/not shipped.
