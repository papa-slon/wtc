# ecosystem-platform-architect handoff

## Scope

Phase 3.42 read-only platform audit for auth rate limiting. Inspect architecture, docs, package
boundaries, middleware, auth actions, config, tests, and DB schema to decide whether auth rate
limiting belongs in `@wtc/auth`, `@wtc/config`, web middleware, route/action helpers, or DB.

No product code changes were in scope. This handoff is the only file written by this audit session.

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/SECURITY_MODEL.md`
- `docs/handoffs/20260530-1815-phase-2-6-middleware-security-spine.md`
- `docs/handoffs/20260530-1815-ecosystem-platform-architect.md`
- `package.json`
- `tsconfig.base.json`
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/lib/backend.ts`
- `packages/auth/package.json`
- `packages/auth/src/index.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/security-headers.ts`
- `packages/config/src/index.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/integration/csrf-coverage.test.ts`

## Files changed

None — read-only audit

## Findings

1. **LOW - `@wtc/auth` is the right package owner for the pure limiter primitive.** Evidence:
   `packages/auth/src/rate-limit.ts:2` identifies the module as a dependency-free sliding-window
   limiter plus IP extraction; `packages/auth/src/rate-limit.ts:63` exports the pure
   `checkRateLimit` primitive; `packages/auth/package.json:10` and `tsconfig.base.json:29` expose
   it as the `@wtc/auth/rate-limit` subpath. Recommendation: keep limiter algorithms and
   header-derived client-key helpers in the `@wtc/auth/rate-limit` subpath, not in the `@wtc/auth`
   barrel and not app-local. Target part: `@wtc/auth`.

2. **LOW - web middleware is the correct current enforcement boundary.** Evidence:
   `apps/web/src/middleware.ts:5` to `apps/web/src/middleware.ts:7` states the real auth entry
   points are server-action POSTs to `/login` and `/register`; `apps/web/src/middleware.ts:39` to
   `apps/web/src/middleware.ts:40` pins the local policy to 10 requests per 60 seconds on those
   paths; `apps/web/src/middleware.ts:78` to `apps/web/src/middleware.ts:98` applies the check and
   returns `429`, `Retry-After`, and rate-limit headers before the auth action runs. Recommendation:
   leave request-path/method selection, per-instance store ownership, and 429 response shaping in
   `apps/web/src/middleware.ts`. Target part: web middleware.

3. **MEDIUM - do not move the current local limiter into `@wtc/config`.** Evidence:
   `apps/web/src/middleware.ts:31` to `apps/web/src/middleware.ts:33` deliberately imports only
   Edge-safe pure subpaths; `packages/config/src/env.ts:1` describes `@wtc/config` as typed
   server-only environment loading; the read-only search found no existing `RATE_LIMIT`,
   `AUTH_RATE`, `LOGIN_RATE`, `REGISTER_RATE`, or `THROTTLE` env keys under `packages/config/src`.
   Recommendation: keep the fixed local policy constant in middleware for now. If future operator
   scope requires tunable limits, add typed env parsing in a separate config/security phase and feed
   resolved plain values into middleware without importing `@wtc/config` into Edge code. Target part:
   `@wtc/config`.

4. **MEDIUM - route/action helpers are not the primary place for generic IP rate limiting.**
   Evidence: `apps/web/src/app/(auth)/actions.ts:23` starts `loginAction`, and
   `apps/web/src/app/(auth)/actions.ts:26` runs credential verification after the request reaches the
   server action; `apps/web/src/app/(auth)/actions.ts:28` writes `auth.login_failed` after failed
   verification; `apps/web/src/app/(auth)/actions.ts:36` starts `registerAction`. Recommendation:
   keep generic unauthenticated IP throttling before these actions in middleware so bursts are stopped
   before validation, Argon2 verification, DB work, or audit writes. Route/action helpers may later
   own account-specific lockout or endpoint-specific limits after a separate security/DB design.
   Target part: route/action helpers.

5. **MEDIUM - DB is not the conservative local owner for IP throttling, but remains the likely owner
   for future account lockout.** Evidence: `packages/db/src/schema.ts:15`, `packages/db/src/schema.ts:40`,
   and `packages/db/src/schema.ts:331` define users, sessions, and audit logs, while no rate-limit
   table or account lockout columns were found in schema search; `docs/SECURITY_MODEL.md:136` to
   `docs/SECURITY_MODEL.md:147` describes Layer 1 as IP-based nginx/middleware limiting, while
   `docs/SECURITY_MODEL.md:154` to `docs/SECURITY_MODEL.md:162` describes a separate account-lockout
   data model. Recommendation: do not add a DB dependency for the current local IP limiter. Treat DB
   persistence as a future phase for account lockout or a shared multi-instance limiter only after
   explicit acceptance criteria. Target part: DB.

6. **LOW - default gate safety is already fail-closed for production unknown IPs and must remain so.**
   Evidence: `apps/web/src/middleware.ts:82` to `apps/web/src/middleware.ts:88` skips limiting only
   for unidentifiable direct-localhost traffic in non-production; production buckets missing IP as
   `auth:unknown`. `packages/auth/src/rate-limit.ts:41` to `packages/auth/src/rate-limit.ts:42`
   restricts client IP extraction to `x-forwarded-for` first hop or `x-real-ip`, never body/query
   input. Recommendation: preserve production unknown-IP throttling as a default gate, and keep the
   non-production skip limited to local/e2e ergonomics. Target part: web middleware plus tests.

7. **LOW - webhook exclusion is a required safety boundary, not a rate-limit exception to broaden.**
   Evidence: `apps/web/src/middleware.ts:25` to `apps/web/src/middleware.ts:26` states the Stripe
   webhook must never be rate-limited; `apps/web/src/middleware.ts:75` short-circuits the path; and
   `apps/web/src/middleware.ts:114` excludes it from the matcher. Recommendation: do not reuse auth
   rate limiting for provider webhooks. Any provider abuse control belongs in provider-specific
   signature/idempotency handling or upstream infrastructure. Target part: web middleware/provider
   routes.

## Decisions

1. **Current local placement stays split:** `@wtc/auth/rate-limit` owns the pure sliding-window
   algorithm and proxy-header IP extraction; `apps/web/src/middleware.ts` owns request selection,
   local store, production fail-closed unknown-IP handling, and HTTP response headers.
2. **`@wtc/config` is not the current owner.** It may later validate tunable rate-limit env values,
   but importing server-only config into Edge middleware would be the wrong direction for the current
   conservative local implementation.
3. **Route/action helpers are secondary.** They should not carry the generic unauthenticated IP
   limiter, but they are the correct future seam for account-specific lockout once DB persistence is
   intentionally designed.
4. **DB is deferred.** No migration is recommended for Phase 3.42. DB-backed account lockout or
   shared rate-limit state should be a separate security + DB phase with tests for race behavior,
   redacted audit payloads, and production posture.
5. **No new package is needed.** A separate `@wtc/rate-limit` package would add boundary churn without
   improving the current architecture; auth-facing throttling belongs under the existing auth package.

## Risks

- The in-process middleware `Map` is per instance. Multi-instance production still needs verified
  nginx `limit_req` and/or a shared store; no live nginx config was inspected in this read-only local
  audit.
- `docs/SECURITY_MODEL.md` still names aspirational `/api/auth/*` endpoints, while the actual current
  implementation enforces `/login` and `/register` server-action POSTs. Future implementers could
  change one side without the other unless docs are reconciled in a docs-only phase.
- The Security Model account-lockout layer appears not implemented in the current schema. That is a
  separate durable auth-hardening gap, not a reason to move the existing IP limiter into DB hastily.
- Making limits configurable later can accidentally pull `@wtc/config` into Edge middleware if the
  boundary is not reviewed.

## Verification/tests

RUN this session:

- `Select-String` memory/repo protocol lookup for prior WTC guidance.
- `Get-Content` on session protocol, seed handoff, status docs, auth/config/middleware/action/DB files.
- `rg` over docs, `apps`, `packages`, `scripts`, and tests for auth rate-limiting, middleware,
  config/env keys, DB tables, and prior Phase 2.6 decisions.
- `rg` confirmed no `RATE_LIMIT`, `AUTH_RATE`, `LOGIN_RATE`, `REGISTER_RATE`, or `THROTTLE` keys under
  `packages/config/src`.
- `git status --short` attempted and failed because this checkout is not a git repository.

NOT RUN this session:

- `npm test`, focused Vitest, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`,
  `npm run check:core`, `npm run secret:scan`, `node scripts/gates.mjs full`, and
  `node scripts/gates.mjs e2e` were not run because this task was a handoff-only read-only audit and
  those gates would write logs, build metadata, or test artifacts outside the single allowed handoff
  file.
- `npm run db:generate -w @wtc/db`, `db:migrate`, `db:seed`, and real-Postgres harnesses were not run
  because no schema change was made and the task explicitly asked for placement analysis only.
- Live server, nginx, Stripe, Axioma, TradingView, bot, and exchange checks were not run because live
  mutation/network acceptance was out of scope.
- No background agents were launched by this session because no background-agent tooling is exposed
  here; no background agents are visible to this session to close.

## Next actions

1. Keep the existing conservative local split: pure logic in `@wtc/auth/rate-limit`, enforcement in
   `apps/web/src/middleware.ts`, no DB/config migration for Phase 3.42.
2. If production hardening is the next phase, verify nginx `limit_req` or design a shared store without
   weakening the current production unknown-IP fail-closed default.
3. If account lockout is the next phase, route it through `ecosystem-security-auditor` plus
   `ecosystem-db-architect`: add an explicit DB model, race-safe updates, redacted audit events, and
   focused tests.
4. Reconcile docs that still describe `/api/auth/*` endpoints with the implemented `/login` and
   `/register` server-action POST paths, or explicitly mark the API paths as future-only.
