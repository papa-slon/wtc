# ecosystem-security-auditor handoff
## Scope
Phase 3.63 production-readiness read-only security audit for auth, RBAC, secrets, audit logs, session cookies, login lockout, registration readiness, and whether a security gate currently blocks production.

This lane did not run live provider calls, SSH, nginx/systemd, deploy, database mutation, preview/prod rollout, or bot service/control. The only command gate run was a read-only secret scan.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`
- `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md`
- `docs/STATUS.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `package.json`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `packages/auth/src/session.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/login-lockout.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/security-headers.ts`
- `packages/config/src/env.ts`
- `packages/shared/src/env-guards.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/integration/csrf-coverage.test.ts`

## Files changed
Only this required handoff:
- `docs/handoffs/20260602-1918-ecosystem-security-auditor.md`

No code, config, blocker/status docs, runtime files, provider state, database state, or bot state were changed.

## Findings
1. Severity: HIGH. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:5-9` says remaining live or credentialed gates are still NOT RUN and local dry-runs/PGlite/local site gates are not substitutes; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:81-89` lists production/preview intended audit-role, live LMS object-store/scanner, Stripe, Axioma, live/server preview, GitHub CI, and deploy/server checks as NOT RUN; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:102-105` states Phase 3.61 cleared only local generated-role append-only audit proof and Phase 3.62 cleared only local demo/mock site-readiness. Recommendation: production remains security-blocked until the intended environment gates are run green; do not mark production ready from Phase 3.62 local evidence. Target part: production security gate truth.
2. Severity: HIGH. Evidence: `docs/AUDIT_LOG_SCHEMA.md:91-95` requires `npm run accept:audit:append-only-role` to pass against the intended production role/database before production; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:80-81` shows only the local managed generated-role proof is RUN/PASS while the production/preview intended role proof is NOT RUN; `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md:1-7` scopes Phase 3.61 to a throwaway database and temporary role, and `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md:62` lists the direct intended-role proof as NOT RUN. Recommendation: run `npm run accept:audit:append-only-role` against the actual restricted preview/production app role only after operator credentials and consent are supplied; archive only redacted summary evidence. Target part: append-only audit DB role.
3. Severity: HIGH. Evidence: `apps/web/src/lib/backend.ts:20-26` selects the DB backend only when `DATABASE_URL` is set and denies production memory fallback; `apps/web/src/lib/backend.ts:44-64` makes `getServerDb()`, core auth/session/access functions, and audit writer fail closed in production without `DATABASE_URL`; `apps/web/src/lib/db-store.ts:76-89` hashes registration passwords, passes `auditRegistration: true`, and creates DB-backed hashed sessions. Recommendation: no additional code-level auth/registration blocker was found in this read-only pass, but production still needs the intended DB/runtime gate execution before launch. Target part: production auth persistence and registration readiness.
4. Severity: MEDIUM. Evidence: `apps/web/src/app/(auth)/actions.ts:14-19` sets an httpOnly, Secure-in-production, SameSite=Lax session cookie; `apps/web/src/lib/session.ts:6-9` derives the production `__Host-` cookie name; `packages/auth/src/session.ts:18-21` generates 32 random bytes as the raw session token and stores only `hashToken(token)`; `packages/db/src/schema.ts:48-58` stores `sessions.token_hash` with a unique index, not the raw token. Recommendation: keep the current cookie/session contract, and require a production HTTPS deployment plus current-session server smoke before calling session-cookie readiness green in production. Target part: session cookies.
5. Severity: MEDIUM. Evidence: `apps/web/src/middleware.ts:77-100` rate-limits POSTs to `/login` and `/register`, returns generic 429 JSON and `Retry-After`, and fails closed to an `unknown` bucket in production if client IP is unavailable; `packages/auth/src/rate-limit.ts:36-55` extracts only proxy headers, never body/query IPs; `tests/integration/auth-rate-limit-middleware.test.ts:33-53` covers login/register 429 behavior and `tests/integration/auth-rate-limit-middleware.test.ts:55-71` covers no-IP production fail-closed behavior. Recommendation: acceptable for current app-level readiness, but multi-instance production still needs the documented nginx/shared-store throttle proof before treating brute-force protection as fully production hardened. Target part: auth rate limiting.
6. Severity: MEDIUM. Evidence: `packages/db/src/repositories.ts:129-197` performs DB-backed login attempts inside a transaction with row lock, generic unknown-account audit, locked-account denial before password verification, failed-login counters, and audit rows; `tests/integration/auth-login-lockout-db.test.ts:57-146` covers 15-minute lockout, locked denial without verifier calls, reset on success, generic unknown-account audit, and review-required state. Recommendation: retain the implementation; run a fresh intended-Postgres cross-connection/race proof when preview/prod credentials are available, as current docs still separate local proof from production rollout. Target part: login lockout.
7. Severity: MEDIUM. Evidence: `apps/web/src/features/admin/actions.ts:139-160` enforces `requireUser()`, `assertAdmin()`, CSRF, Zod, DB requirement, and repository unlock; `packages/db/src/repositories.ts:200-229` clears lockout state and writes `auth.account_unlock` in the same transaction; `tests/integration/admin-account-unlock-db.test.ts:57-100` proves state clear plus audit row without password leakage, and `tests/integration/admin-account-unlock-static.test.ts:16-33` statically guards the admin/RBAC/CSRF/Zod/repo pipeline. Recommendation: no new admin-unlock security blocker found, but production append-only audit-role proof must pass before relying on the production audit trail. Target part: admin account unlock and audit.
8. Severity: MEDIUM. Evidence: `packages/db/src/repositories.ts:247-275` creates users transactionally, enforces the unique-email guard, inserts roles, and writes `auth.register` audit with only `{ roles, hasDisplayName }`; `apps/web/src/lib/db-store.ts:76-77` enables `auditRegistration: true`; `apps/web/src/lib/demo.ts:211-225` mirrors the registration audit event in demo mode; `docs/AUDIT_LOG_SCHEMA.md:317` requires registration audit payloads to exclude email, password, password hash, and session token material. Recommendation: registration is locally ready from a security-code standpoint; production readiness still depends on the DB role, DB rollout, and server gates. Target part: registration audit readiness.
9. Severity: MEDIUM. Evidence: `packages/config/src/env.ts:78-100` rejects non-base64 KEKs, production mock billing, missing Axioma ES256 key/kid for staging/production, and missing journal token for non-mock production bot adapter mode; `packages/config/src/env.ts:136-154` rejects public production uploads unless production storage/scanner are configured and rejects weak production secrets; `packages/shared/src/env-guards.ts:55-70` makes required secrets fail closed in production with no dev fallback. Recommendation: production env provisioning is a security gate: provide strong `SESSION_SECRET`, base64 32-byte `SECRET_VAULT_KEK`, `DATABASE_URL`, non-mock billing settings, Axioma ES256 key/kid, and live LMS storage/scanner settings before public launch. Target part: secrets/configuration.
10. Severity: MEDIUM. Evidence: `packages/audit/src/redact.ts:12-35` already includes `ciphertext`, `vaultrecord`, `sealed`, `credentials`, bearer/refresh/id/access token hints, and `onetimecode`; `packages/audit/src/redact.ts:7-11` deliberately omits bare `iv` and `tag` because substring matching would over-redact innocuous fields while sealed/vault parent keys are redacted; `docs/AUDIT_LOG_SCHEMA.md:290-297` still says those additions are TARGET and not yet in `redact.ts`, and includes `iv`/`tag` as required additions. Recommendation: update `docs/AUDIT_LOG_SCHEMA.md` in a future docs-truth slice to match the implemented redaction policy and the deliberate `iv`/`tag` omission; this is doc drift, not a code-level production blocker found in this lane. Target part: audit redaction source of truth.
11. Severity: LOW. Evidence: `packages/auth/src/security-headers.ts:17-22` documents that production CSP currently ships `script-src 'self' 'unsafe-inline'` when no nonce is passed; `packages/auth/src/security-headers.ts:43-47` implements that fallback; `apps/web/src/middleware.ts:62-67` applies headers without a nonce and `apps/web/src/middleware.ts:104-108` applies them to document navigations. Recommendation: not listed as a current credential blocker, but wire a per-request CSP nonce before a high-assurance public production launch if practical. Target part: security headers/CSP.
12. Severity: LOW. Evidence: `apps/web/src/app/api/e2e/login/route.ts:7-11` returns 404 in production, unless `E2E_AUTH_BYPASS=1`, and only on localhost hosts; `apps/web/src/app/api/e2e/login/route.ts:19-27` creates a dev/e2e session with non-secure cookie only after real credential verification; `tests/integration/lms-db-e2e-harness.test.ts` is listed in the repo as the static harness covering this local-only route. Recommendation: keep the route disabled in production and include it in final deploy smoke/static checks. Target part: e2e auth bypass boundary.

## Decisions
- Treated Phase 3.62 as local site-readiness evidence only, not production readiness.
- Ran `npm run secret:scan` because it is read-only and directly security-relevant.
- Did not run DB, provider, live server, deploy, CI, preview/prod rollout, SSH/nginx/systemd, or bot-service gates because this lane was read-only and those gates require credentials/approval or mutation.
- Did not update blocker/status docs; this agent was asked to write exactly one handoff file.

## Risks
- WTC is not production-ready while intended-environment credential/live gates remain NOT RUN.
- Local managed audit-role proof does not prove the real preview/production app role is append-only.
- App-level in-process rate limiting is not a complete multi-instance brute-force defense without nginx/shared-store production proof.
- Production CSP still uses an `unsafe-inline` script fallback unless a nonce is wired.
- The workspace is not git-backed, so GitHub CI, commit, branch, PR, and remote production change provenance cannot be claimed from this folder.
- Audit redaction docs are stale relative to the implementation and could mislead future readiness audits if not reconciled.

## Verification/tests
Gates RUN in this Phase 3.63 security-auditor lane:
- Required protocol/doc reads - PASS by inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed handoff, latest Phase 3.62 handoff, `docs/STATUS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Static source audit - PASS by inspection for auth actions, session cookies, CSRF helpers, middleware rate limiting, RBAC/admin actions, registration audit, audit redaction, env guards, e2e login boundary, and relevant tests.
- `npm run secret:scan` - PASS, no findings printed.
- `git rev-parse --show-toplevel` - RUN/OBSERVED NOT GIT-BACKED (`fatal: not a git repository`).

Gates NOT RUN in this Phase 3.63 security-auditor lane:
- `npm test` - not run; Phase 3.62 already ran local root tests and this read-only lane focused on security audit plus secret scan.
- `npm run build -w @wtc/web` - not run; Phase 3.62 already ran local build and this lane made no code changes.
- `npm run e2e` / Playwright - not run; outside this read-only audit and would create/refresh test artifacts.
- `npm run check:core` - not run; Phase 3.62 already ran it and this lane made no package changes.
- `npm run db:generate -w @wtc/db` - not run; no schema changes and this lane avoided generated output.
- `npm run coverage` - not run; outside scope.
- `npm run governance:check` - not run; this per-agent handoff exists without an aggregate Phase 3.63 handoff yet, so governance is operator/aggregate-phase work.
- `npm run e2e:lms:db:managed` - not run; DB-mutating managed gate already passed in Phase 3.59 and is outside this read-only lane.
- `npm run accept:real-pg:managed` - not run; DB-mutating managed gate already passed in Phase 3.60 and is outside this read-only lane.
- `npm run accept:audit:append-only-role:managed` - not run; DB-mutating managed gate already passed in Phase 3.61 and is outside this read-only lane.
- `npm run accept:audit:append-only-role` - not run; intended preview/production restricted role URL and consent absent, and this lane did not mutate DBs.
- `npm run accept:lms:object-storage -- --live` - not run; live object-store config/consent absent and live provider calls were forbidden.
- `npm run accept:lms:external-scanner -- --live` - not run; live scanner endpoint/token/consent absent and live provider calls were forbidden.
- Stripe test checkout/webhook acceptance - not run; Stripe env/provider setup absent and live provider calls were forbidden.
- Axioma live bridge/handoff/account-link/download acceptance - not run; ES256 key/kid/bridge token and endpoint-shape approval absent, live calls forbidden.
- Live/server preview smoke, SSH/nginx/systemd checks, deploy, production monitoring - not run; forbidden in this lane without operator-approved target/rollback/evidence plan.
- Bot service/control - not run; forbidden and still requires separate audited adapters.
- GitHub CI - not run; folder is not git-backed.

## Next actions
1. Run the direct production/preview intended append-only audit role proof: `npm run accept:audit:append-only-role` with `AUDIT_APPEND_ONLY_DATABASE_URL`, `AUDIT_APPEND_ONLY_EXPECTED_ROLE`, and `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1` supplied for the actual restricted app role.
2. Provision and verify production secrets/config: `DATABASE_URL`, strong `SESSION_SECRET`, base64 32-byte `SECRET_VAULT_KEK`, non-mock billing provider settings, Stripe test/production webhook settings as scoped, Axioma ES256 key/kid, Axioma bridge token as required, and LMS object-store/scanner settings before public uploads.
3. Run one remaining credential/live gate per new session with read-only agents first: LMS object-store, LMS external scanner, Stripe checkout/webhook, Axioma endpoint/account-link/download, live/server preview smoke, GitHub CI, and deploy/server checks.
4. Add intended-Postgres race proof for account lockout/admin unlock if operator provides preview/prod-safe credentials or a fresh throwaway real-Postgres target.
5. Reconcile `docs/AUDIT_LOG_SCHEMA.md` with current `packages/audit/src/redact.ts`, including the deliberate `iv`/`tag` omission, so future security agents do not treat fixed code as still TARGET.
6. Consider wiring a production CSP nonce before public launch; current headers are present but `script-src 'unsafe-inline'` remains an MVP concession.
