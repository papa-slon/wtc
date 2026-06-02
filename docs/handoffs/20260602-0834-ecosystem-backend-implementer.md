# ecosystem-backend-implementer handoff
## Scope
Phase 3.42 read-only backend audit for auth rate limiting. Inspected the current auth entry points, Next middleware, session creation, login/register paths, `packages/auth`, DB/memory auth selectors, and relevant tests. No product code was edited. This handoff does not claim an N-agent audit or aggregate phase completion.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/DEPLOYMENT.md`
- `docker-compose.yml`
- `.env.example`
- `package.json`
- `apps/web/package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `packages/auth/package.json`
- `packages/auth/src/index.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/session.test.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/*.sql` names and auth-related matches
- `packages/shared/src/schemas.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`

## Files changed
None — read-only audit. Only this handoff file was written.

## Findings
1. Severity: HIGH. Evidence: `docs/SECURITY_MODEL.md:151` through `docs/SECURITY_MODEL.md:164` specifies account-specific failed-login counters and lockout thresholds, and `docs/SECURITY_MODEL.md:170` says login is protected by IP limit plus account lockout. The current `users` schema has only `id`, `email`, `passwordHash`, `displayName`, and `createdAt` at `packages/db/src/schema.ts:15` through `packages/db/src/schema.ts:24`. The DB login path only finds the user and verifies the Argon2 hash at `apps/web/src/lib/db-store.ts:78` through `apps/web/src/lib/db-store.ts:82`; the memory path does the same at `apps/web/src/lib/demo.ts:204` through `apps/web/src/lib/demo.ts:207`; the server action only writes an `auth.login_failed` audit event before redirecting at `apps/web/src/app/(auth)/actions.ts:26` through `apps/web/src/app/(auth)/actions.ts:29`. Recommendation: implement account-specific lockout as a backend auth slice, with generic user-facing failure text and no account-existence disclosure. Target part: account-level auth rate limiting.

2. Severity: MEDIUM. Evidence: IP-based auth POST limiting exists in `apps/web/src/middleware.ts:77` through `apps/web/src/middleware.ts:99`, using `@wtc/auth/rate-limit`. The pure limiter is tested in `packages/auth/src/rate-limit.test.ts:7` through `packages/auth/src/rate-limit.test.ts:106`, but `vitest.config.ts:8` through `vitest.config.ts:9` excludes `apps/web/**`, so the middleware route/method/production-fallback wiring is not directly tested. `tests/e2e/security-headers.spec.ts:30` through `tests/e2e/security-headers.spec.ts:34` explicitly does not exercise 429, and current Playwright auth uses the local bypass route at `tests/e2e/helpers/auth.ts:5` through `tests/e2e/helpers/auth.ts:11` with `E2E_AUTH_BYPASS=1` configured at `playwright.config.ts:23` through `playwright.config.ts:35`. Recommendation: add deterministic static or extracted-helper coverage for middleware wiring; do not add a bursty shared-dev-server Playwright 429 test. Target part: auth rate-limit test coverage.

3. Severity: MEDIUM. Evidence: the runtime now documents real auth entry points as Next server-action POSTs to `/login` and `/register`, with "NO /api/auth/* routes" at `apps/web/src/middleware.ts:5` through `apps/web/src/middleware.ts:7`; the forms submit those actions at `apps/web/src/app/(auth)/login/page.tsx:19` and `apps/web/src/app/(auth)/register/page.tsx:16`. The older docs still name `POST /api/auth/login` and `POST /api/auth/register` at `docs/SECURITY_MODEL.md:166` through `docs/SECURITY_MODEL.md:174`, and ADR-015 still says middleware must rate-limit `/api/auth/login` and `/api/auth/register` at `docs/ARCHITECTURE_DECISIONS.md:126` through `docs/ARCHITECTURE_DECISIONS.md:130`. Recommendation: update the docs to distinguish current server-action page POSTs from planned `/api/auth/*` endpoints before claiming rate-limit acceptance. Target part: auth contract/source-of-truth.

4. Severity: MEDIUM. Evidence: `getClientIp()` trusts the first `x-forwarded-for` hop before `x-real-ip` at `packages/auth/src/rate-limit.ts:41` through `packages/auth/src/rate-limit.ts:55`; middleware only falls back to the `unknown` bucket when no IP header exists in production at `apps/web/src/middleware.ts:81` through `apps/web/src/middleware.ts:88`. The repo contains no production nginx config; `docker-compose.yml:1` through `docker-compose.yml:18` is local Postgres only, and production nginx/domain cutover remains explicitly approval-gated/not run at `docs/DEPLOYMENT.md:367` through `docs/DEPLOYMENT.md:377` and `docs/DEPLOYMENT.md:412` through `docs/DEPLOYMENT.md:418`. Recommendation: make the production deployment gate prove nginx overwrites inbound `X-Forwarded-For`/`X-Real-IP` and applies the layer-1 `limit_req` zone, or add an app-level trusted-proxy boundary before treating header-derived IPs as authoritative. Target part: deployment-backed IP limiter trust boundary.

5. Severity: LOW. Evidence: `apps/web/src/app/api/e2e/login/route.ts:7` through `apps/web/src/app/api/e2e/login/route.ts:29` can create sessions without going through `/login`, but it is fenced by production refusal, `E2E_AUTH_BYPASS === '1'`, and localhost host checks at `apps/web/src/app/api/e2e/login/route.ts:5` through `apps/web/src/app/api/e2e/login/route.ts:10`. Static coverage asserts those fences at `tests/integration/lms-db-e2e-harness.test.ts:118` through `tests/integration/lms-db-e2e-harness.test.ts:123`. Recommendation: keep this route local-only and include it in any future auth-rate-limit review so it does not silently become a production session-minting bypass. Target part: test-only session helper boundary.

## Decisions
- Current IP rate limiting is already implemented on the real server-action POST paths: `POST /login` and `POST /register`.
- The smallest safe implementation boundary is not a rewrite of session auth. Keep `packages/auth/src/rate-limit.ts` and `apps/web/src/middleware.ts` mostly stable, then add the missing account-lockout state and deterministic middleware-wiring tests.
- Exact files likely to change for the smallest safe account-lockout slice:
  - `packages/auth/src/login-lockout.ts` - new pure threshold/policy helper.
  - `packages/auth/src/login-lockout.test.ts` - new deterministic threshold tests.
  - `packages/auth/src/index.ts` - export the policy helper if used outside the package.
  - `packages/db/src/schema.ts` - add `failed_login_count`, `failed_login_reset_at`, and `account_locked_until` or equivalent.
  - `packages/db/migrations/0016_<generated>.sql`, `packages/db/migrations/meta/_journal.json`, and `packages/db/migrations/meta/0016_snapshot.json` - generated migration metadata.
  - `packages/db/src/repositories.ts` - repository helpers for atomic failure recording, lockout check, and success reset.
  - `apps/web/src/lib/db-store.ts` - call the repository/policy path around password verification.
  - `apps/web/src/lib/demo.ts` - dev parity for lockout semantics, or an explicit documented demo-only no-lockout exception.
  - `apps/web/src/app/(auth)/actions.ts` - preserve generic invalid/locked response and audit result without account enumeration.
  - `tests/integration/auth-login-lockout.test.ts` - new PGlite or static integration coverage for DB-backed lockout.
  - `tests/integration/auth-rate-limit-middleware-static.test.ts` - new deterministic middleware wiring coverage.
- Docs-only drift cleanup likely touches `docs/SECURITY_MODEL.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, and `docs/ARCHITECTURE_DECISIONS.md`.
- Background agents were not launched in this lane; this handoff is the single requested per-agent backend audit artifact.

## Risks
- A green `packages/auth/src/rate-limit.test.ts` does not prove Next middleware invokes the limiter on the intended paths.
- A green local/dev e2e run does not exercise real login/register rate limiting because e2e logs in through `/api/e2e/login`.
- Account-lockout implementation will require a migration. That means the smallest safe implementation phase must run `db:generate`, schema tests, and a DB-backed login-lockout test, not only package unit tests.
- If production traffic can reach Next directly or nginx preserves spoofed `X-Forwarded-For`, the IP limiter can be diluted by client-supplied header rotation.
- Updating docs to `/login` and `/register` must not accidentally delete the planned `/api/auth/*` future surface if that remains a target architecture.

## Verification/tests
- RUN: read-only source inspection with `rg`, `Get-Content`, and line-numbered PowerShell reads.
- RUN: confirmed this workspace directory is not git-backed (`git status --short` returned "not a git repository").
- NOT RUN: `npm test` - read-only audit scope; no test execution requested.
- NOT RUN: `npm run typecheck` / `npm run typecheck -w @wtc/web` - read-only audit scope.
- NOT RUN: `npm run lint` - read-only audit scope.
- NOT RUN: `npm run db:generate -w @wtc/db` - no schema edits in this lane.
- NOT RUN: `npm run build -w @wtc/web` - read-only audit scope.
- NOT RUN: `npm run e2e` or `node scripts/gates.mjs e2e` - not needed for this audit and current e2e auth uses `/api/e2e/login`.
- NOT RUN: live nginx, production deploy, or live server checks - forbidden without explicit operator approval.

## Next actions
1. If Phase 3.42 proceeds to implementation, start with account-lockout as the backend-owned slice above; do not expand into password reset, remember-me sessions, or production nginx work in the same slice.
2. Add deterministic middleware wiring coverage before any acceptance claim that auth rate limiting is fully covered by tests.
3. Update docs after code/test boundaries are chosen so the contract says current `/login` and `/register` server-action POSTs, with planned `/api/auth/*` called out separately if still desired.
4. Leave `/api/e2e/login` production-fenced and local-only; do not reuse it for production auth or rate-limit acceptance.
