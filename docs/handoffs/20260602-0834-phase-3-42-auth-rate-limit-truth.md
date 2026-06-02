# Phase 3.42 Auth rate-limit truth handoff
## Scope
Close the local auth-rate-limit truth gap without live server mutation: verify the existing `POST /login` and
`POST /register` middleware limiter, add deterministic middleware 429 coverage, make auth page error display code-mapped
and account-neutral, and reconcile docs that still described target-era `/api/auth/*`, double-submit CSRF, and e2e 429
requirements. This phase does not implement DB-backed account-specific login lockout, production nginx/shared-store
throttling, registration audit logging, append-only DB roles, or live production acceptance.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0834-ecosystem-security-auditor.md](20260602-0834-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0834-ecosystem-backend-implementer.md](20260602-0834-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0834-ecosystem-platform-architect.md](20260602-0834-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0834-ecosystem-tests-runner.md](20260602-0834-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0834-ecosystem-devops-implementer.md](20260602-0834-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0834-ecosystem-frontend-implementer.md](20260602-0834-ecosystem-frontend-implementer.md)

All six background agents completed and were closed after their handoffs were collected.
## Files inspected
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/csrf.tsx`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/csrf-coverage.test.ts`
- `scripts/gates.mjs`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/SITEMAP.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/__smoke__.ts`
- `scripts/gates.mjs`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/SITEMAP.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- this aggregate handoff.
## Findings
1. High - The pure limiter existed, but the middleware 429 binding was not directly tested. Implemented:
   `tests/integration/auth-rate-limit-middleware.test.ts` imports the actual middleware, verifies matcher scope, proves
   `POST /login` and `POST /register` return `429`, `Retry-After`, rate-limit headers, and generic JSON on the 11th request
   per client IP, and pins production no-IP fail-closed behavior. Target part: PG11 auth rate-limit acceptance.
2. High - The auth pages rendered arbitrary `error` query-string text and registration disclosed duplicate-email state.
   Implemented: `apps/web/src/features/auth/error-copy.ts` maps stable codes only; login/register pages render mapped copy;
   login/register actions redirect with stable codes; duplicate/unknown/hostile text maps to neutral copy. Target part:
   auth browser error safety.
3. Medium - Public registration copy exposed the Argon2id implementation detail. Implemented: registration page copy now says
   "Use one account for every WTC product." Target part: auth UI.
4. Medium - Security docs still described double-submit-cookie CSRF, `/api/auth/*` current endpoints, and shipped account
   lockout. Implemented: docs now describe session-bound hidden-field CSRF, current `/login` and `/register` server-action
   POSTs, and mark account lockout as target/not-yet-implemented. Target part: security source of truth.
5. Medium - Acceptance docs required normal-suite e2e 429 despite existing tests-runner decisions that rapid POST bursts
   destabilize the shared dev server. Implemented: acceptance now requires pure limiter tests plus deterministic middleware
   integration 429 and keeps e2e as security-header smoke. Target part: gate accuracy.
6. Low - `scripts/gates.mjs` comment said `full = core + build + e2e` while implementation keeps e2e separate. Implemented:
   comment now states `full = core + build` and `e2e` is its own plan. Target part: gate reporting accuracy.
## Decisions
- Keep the existing architecture split: `@wtc/auth/rate-limit` owns pure Edge-safe limiter logic; `apps/web/src/middleware.ts`
  owns route/method selection, local store, production unknown-IP fail-closed behavior, and HTTP 429 response shaping.
- Do not move the current IP limiter into DB or config in this phase.
- Do not add normal-suite Playwright 429 burst coverage; deterministic middleware integration is the accepted local 429 proof.
- Treat DB-backed account-specific lockout as a future backend + DB + security phase.
- Preserve `/api/e2e/login` as local-only e2e bypass; it is not production auth and not used for rate-limit acceptance.
## Risks
- The middleware store is process-local. Multi-instance production still needs verified nginx `limit_req` and/or shared-store
  throttling plus trusted proxy header normalization.
- Distributed credential stuffing can rotate IPs until account-specific lockout is implemented.
- Middleware still returns JSON 429 for throttled server-action POSTs. The browser pages now have safe `rate_limited` copy for
  code-mapped redirects, but an end-to-end user-visible throttle navigation proof was not added in this phase.
- Registration is not audited as `auth.register`; docs now state that honestly, but the audit event remains a future hardening
  item.
## Verification/tests
- Focused auth Vitest: `npm test -- packages/auth/src/rate-limit.test.ts tests/integration/auth-rate-limit-middleware.test.ts tests/integration/auth-error-copy.test.ts tests/integration/csrf-coverage.test.ts` - PASS (`25` passed).
- `npm run check:core` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `node --check scripts/gates.mjs` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- `node scripts/gates.mjs full` - PASS (9/9 gates; Vitest `814` passed / `8` skipped; build includes `ƒ Middleware 35.3 kB`).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers, `70` total artifacts).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (current phase `20260602-0834`, 6 cited per-agent handoffs all present, 0 errors / 1 known historical warning).
- NOT RUN: DB-backed account lockout, production nginx/shared-store rate-limit verification, live production deploy, live server mutation, CI via GitHub Actions.
## Next actions
- Implement DB-backed account-specific login lockout in a separate security + backend + DB phase with migration, race-safe
  updates, generic user-facing responses, audit coverage, and real-Postgres race proof.
- Add registration audit logging or keep the explicit deferral in docs.
- Verify production nginx/shared-store auth throttling and trusted proxy header normalization only with explicit operator
  approval and redacted evidence.
