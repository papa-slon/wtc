# ecosystem-security-auditor handoff
## Scope
Phase 3.42 read-only security audit for auth rate limiting in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Inspected auth/login/register/logout/session/CSRF/middleware surfaces and canonical docs for production-safe rate limiting, no plaintext secrets, fail-closed behavior, and no live server mutation. No product code was edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/SITEMAP.md`
- `docs/DEPLOYMENT.md`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/csrf.ts`
- `packages/shared/src/env-guards.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/csrf-coverage.test.ts`

## Files changed
None - read-only audit except this handoff.

## Findings
1. HIGH - Account-specific login lockout is documented but not implemented. Evidence: `docs/SECURITY_MODEL.md:149` documents a Postgres-backed account lockout layer and `docs/SECURITY_MODEL.md:153`-`docs/SECURITY_MODEL.md:164` specifies `failed_login_count`, `failed_login_reset_at`, `account_locked_until`, and threshold behavior. The current `users` schema only has `id`, `email`, `passwordHash`, `displayName`, and `createdAt` at `packages/db/src/schema.ts:15`-`packages/db/src/schema.ts:25`. The DB login path only reads the user and verifies the password at `apps/web/src/lib/db-store.ts:78`-`apps/web/src/lib/db-store.ts:82`; failed login handling only writes `auth.login_failed` and redirects at `apps/web/src/app/(auth)/actions.ts:26`-`apps/web/src/app/(auth)/actions.ts:30`. Recommendation: add a persistent failed-attempt/lockout model or an `auth_attempts` table with transactional updates, generic responses, reset-on-success behavior, and an admin unlock/audit path; until then, docs must not claim account lockout is shipped. Target part: PG11/PG12 auth hardening.

2. MEDIUM - The app-layer limiter is per-process and production safety depends on a deployment boundary that is not yet verified. Evidence: `apps/web/src/middleware.ts:28`-`apps/web/src/middleware.ts:29` states the in-process Map relies on nginx `limit_req` or a future shared store for multi-instance deployment; the actual store is module state at `apps/web/src/middleware.ts:42`-`apps/web/src/middleware.ts:43`. `docs/DEPLOYMENT.md:416`-`docs/DEPLOYMENT.md:418` states production deployment and nginx/domain/TLS cutover are NOT RUN, and `docs/PRODUCTION_BLOCKERS.md:83`-`docs/PRODUCTION_BLOCKERS.md:84` carries forward the shared-store/structured-logger deferral. Recommendation: before production, either enforce and test nginx `limit_req` plus trusted proxy header normalization, or move the limiter to a shared store keyed by normalized client IP; add a deployment smoke that proves stripped/spoofed client IPs still fail closed. Target part: deployment/PG12.

3. MEDIUM - The rate-limit acceptance gate is inconsistent with current tests. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:205`-`docs/ACCEPTANCE_MATRIX_MASTER.md:209` still requires an e2e 429 gate. Current e2e coverage explicitly does not exercise the breach path at `tests/e2e/security-headers.spec.ts:30`-`tests/e2e/security-headers.spec.ts:34`, and `docs/PRODUCTION_BLOCKERS.md:78`-`docs/PRODUCTION_BLOCKERS.md:82` says the 429 path is unit-level only. Recommendation: either add a stable middleware/production smoke for 429 + `Retry-After`, or update acceptance docs so future operators do not claim an e2e gate that was not run. Target part: tests-runner/docs.

4. MEDIUM - Auth/CSRF docs drift from the implemented server-action design. Evidence: `apps/web/src/middleware.ts:5`-`apps/web/src/middleware.ts:7` correctly identifies the real auth entry points as server actions posting to `/login` and `/register`, but `docs/SECURITY_MODEL.md:170`-`docs/SECURITY_MODEL.md:174` still lists `/api/auth/*` endpoints and `docs/RBAC_MATRIX.md:63` labels the namespace as `/api/auth/*`. `docs/SECURITY_MODEL.md:112`-`docs/SECURITY_MODEL.md:130` describes a double-submit cookie/header CSRF model, while the implementation derives a session-bound hidden-field token from the session cookie and `SESSION_SECRET` at `apps/web/src/lib/csrf.tsx:19`-`apps/web/src/lib/csrf.tsx:34`. Recommendation: update the docs to make `/login` and `/register` the canonical auth POST paths, document the production `unknown` bucket behavior, and replace the double-submit CSRF description with the current session-HMAC synchronizer-token model. Target part: security docs.

5. LOW - Registration audit documentation is ahead of implementation. Evidence: `docs/SITEMAP.md:208` says registration writes `auth.register`, but `packages/audit/src/audit.ts:8`-`packages/audit/src/audit.ts:46` reserves login/logout/password/session actions and does not include `auth.register`. `registerAction` creates the user and session at `apps/web/src/app/(auth)/actions.ts:46`-`apps/web/src/app/(auth)/actions.ts:52` without an audit write. Recommendation: either add an `auth.register` audit action with non-secret payload or revise docs to state registration is not audited yet. Target part: auth/register audit trail.

## Decisions
- Treat current middleware rate limiting on `POST /login` and `POST /register` as implemented: `apps/web/src/middleware.ts:78`-`apps/web/src/middleware.ts:99` enforces `10/60s` and returns `429`, `Retry-After`, and generic non-enumerating JSON on breach.
- Treat account-specific lockout as not shipped until a persistent counter/lockout write path exists.
- Treat `/api/e2e/login` as not a production auth bypass: `apps/web/src/app/api/e2e/login/route.ts:7`-`apps/web/src/app/api/e2e/login/route.ts:11` returns 404 unless non-production, `E2E_AUTH_BYPASS=1`, and local host.
- No live server, nginx, systemd, bot, database migration, or `.env` mutation was performed.

## Risks
- Distributed credential stuffing can still rotate IPs and avoid the current IP-only middleware limiter because account-level lockout is absent.
- Horizontal or multi-Edge deployment can dilute the in-memory limiter unless nginx/shared-store enforcement is active and tested.
- Stale `/api/auth/*` and double-submit-CSRF docs can cause future nginx, monitoring, and test gates to target the wrong surface.
- The current 429 breach behavior is covered by unit tests, not by a browser/e2e or deployment smoke.

## Verification/tests
RUN:
- `npm test -- packages/auth/src/rate-limit.test.ts packages/auth/src/security-headers.test.ts packages/auth/src/session.test.ts packages/auth/src/csrf.test.ts tests/integration/csrf-coverage.test.ts` - PASS, 5 test files, 46 tests.
- `npm run secret:scan` - PASS, no findings.
- `rg -n "failed_login_count|failed_login_reset_at|account_locked_until|account_locked|lockout" apps packages tests scripts ...` - no implementation matches outside docs.
- `git status --short` - NOT A GIT REPO from this workspace; no git state was assumed.

NOT RUN:
- Playwright/e2e 429 breach test - not run because it requires a dev server/browser path and current repo test notes mark that path flaky for rapid POST bursts.
- `npm run build`, full `node scripts/gates.mjs full`, database migrations, seeds, nginx/TLS checks, and live deployment checks - out of scope for this read-only security audit and would exceed the requested no-live-mutation boundary.

## Next actions
1. Implement persistent account lockout or formally downgrade/remove the claim from `SECURITY_MODEL.md`, `RBAC_MATRIX.md`, and `SITEMAP.md`.
2. Add a stable 429 acceptance mechanism: direct middleware test, isolated route smoke, or approved deployment smoke proving `429` + `Retry-After`.
3. Update security docs to match the current server-action auth paths and session-bound CSRF implementation.
4. Add or explicitly defer `auth.register` audit logging.
5. Before production cutover, verify nginx/shared-store rate limiting and trusted proxy header normalization without exposing live secrets or mutating live bot/server processes.
