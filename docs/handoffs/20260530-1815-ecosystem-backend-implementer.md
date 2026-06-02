## Scope

Read-only audit for Phase Group 11 middleware implementation. Four concrete questions answered:
(1) enumerate every auth/credential POST entry point that rate-limiting must cover;
(2) how to identify a Next.js 15 server-action POST at the middleware layer;
(3) billing webhook invariants that PG11 must not break, and how the tests invoke the route;
(4) IP extraction reality on Next 15 and safe fallback strategy for dev/e2e.

---

## Files inspected

- `docs/SECURITY_MODEL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260530-1625-ecosystem-security-auditor.md`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(app)/app/layout.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/teacher/layout.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/backend.ts`
- `packages/auth/src/index.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/csrf.ts`
- `packages/audit/src/redact.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/e2e/smoke.spec.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `apps/web/next.config.ts`
- All `apps/web/src/app/**/page.tsx` files (grepped for `<form action=` to enumerate server-action call sites)

---

## Files changed

None — read-only audit

---

## Findings

### F-1 — INFO — Auth entry points are ALL server actions; zero /api/auth/* routes exist

**Evidence:** `apps/web/src/app/api/` contains exactly one file: `billing/webhook/route.ts`. There are no `/api/auth/*` route handlers of any kind. The `docs/SECURITY_MODEL.md` §4 table lists `POST /api/auth/login` and `POST /api/auth/register` as the rate-limited endpoints — these names are WRONG for this implementation. The SECURITY_MODEL was written as a design spec before implementation; the actual auth uses server actions, not route handlers.

The real entry points:

| Server action | Exported from | Form in file | Page path where form renders |
|---|---|---|---|
| `loginAction` | `apps/web/src/app/(auth)/actions.ts` | `apps/web/src/app/(auth)/login/page.tsx` | `/login` |
| `registerAction` | same | `apps/web/src/app/(auth)/register/page.tsx` | `/register` |
| `logoutAction` | same | `apps/web/src/app/(app)/app/layout.tsx` | any `/app/**` page |
| `logoutAction` | same | `apps/web/src/app/admin/layout.tsx` | any `/admin/**` page |

The teacher layout (`apps/web/src/app/teacher/layout.tsx`) does NOT include a logout form — it has no logout UI whatsoever.

The `/.well-known/axioma-jwks.json` route is GET-only — not a credential entry point.

**Definitive set of (method, path) to throttle:**

| Method | Path | Throttle | Rationale |
|---|---|---|---|
| POST | `/login` | YES — 10 req/min/IP, account lockout | Brute-force password guessing |
| POST | `/register` | YES — 10 req/min/IP | Registration spam / email enumeration |
| POST | `/app/**` (logoutAction only) | NO — do not throttle | Authenticated action; session already required; no secret to brute-force |
| POST | `/admin/**` (logoutAction only) | NO — do not throttle | Same reasoning |
| POST | `/api/billing/webhook` | EXCLUDE from rate-limiting | Stripe server-to-server; must never be throttled |

**Conclusion:** The rate-limiter must match POST to `/login` and POST to `/register`. No other path contains a credential-accepting action.

---

### F-2 — INFO — Next.js 15 server-action POST identification at middleware layer

**How it works:** When a Next.js 15 form uses `action={serverActionFn}`, the browser submits a multipart/form-data POST to the *page path* (e.g., `/login` for the login page). Next.js attaches a `next-action` header (value is a hashed action ID). There is no separate `/api/` route; the POST hits the same path as the GET for that page.

**Confirmed by code:** `apps/web/src/app/(auth)/login/page.tsx:19` — `<form action={loginAction}>` with no explicit action URL. The form action is the function reference, so Next.js routes the POST to `/login`. Same for register at `/register`.

**Recommended middleware predicate for rate-limiting:**

```typescript
// Match: POST to /login or /register that carries the next-action header.
// The next-action header confirms this is a server-action invocation, not an
// unrelated tool POST (e.g., a browser prefetch or crawl probe).
const isAuthAction =
  request.method === 'POST' &&
  (pathname === '/login' || pathname === '/register') &&
  request.headers.has('next-action');
```

**Why include `next-action` header check:** A POST to `/login` without the `next-action` header is not a server-action invocation — it is a malformed or bot request. Including the `next-action` check prevents rate-limiting legitimate GET-like browser pre-flight probes, but because any brute-force tool targeting this stack will trivially add the header, the header check should NOT be the only gate. The primary gate is `method === POST && (pathname === '/login' || pathname === '/register')`. The `next-action` header is an additional specificity filter; dropping it causes no false negatives against real attackers.

**Alternative — simpler predicate without next-action check:** Just match `POST` + path. This is slightly more aggressive (catches malformed POSTs too) but is safer from a security standpoint because it over-counts rather than under-counts. Recommended for the actual rate-limit check; the `next-action` header check is useful only for *logging* whether this is a real action invocation.

**GET vs POST nuance:** GET requests to `/login` and `/register` are page renders (no credential processing). They must NOT be rate-limited. Only POST triggers the server action. This is critical: the middleware predicate must check `request.method === 'POST'` strictly.

**logoutAction POST paths (`/app/**`, `/admin/**`):** These are authenticated; the session cookie must be present for logoutAction to do anything. They should NOT be in the rate-limit predicate. A throttle on `/app/**` POST would interfere with all other server actions in the authenticated shell (bot config saves, TV submissions, etc.).

---

### F-3 — INFO — Billing webhook invariants that must not break; test invocation method

**Invariants asserted by `billing-webhook.test.ts` and `billing-webhook-phase24.test.ts`:**

| Test ID | What it asserts |
|---|---|
| BW-002 | Tampered body → `parseWebhook` returns null (signature mismatch detected) |
| BW-003 | Wrong webhook secret → `parseWebhook` returns null |
| BW-001 | Valid event → entitlement granted (state=active), PAE row written |
| BW-004 | Duplicate event ID → `applyStripeEvent` returns `{applied:false}`, no second PAE row |
| BW-005 | Missing userId → `createManualReviewItem` called, no entitlement granted, no `billing.webhook_received` audit row |
| BW-006 | Concurrent duplicate → exactly one audit row, exactly one entitlement, exactly one `toState=active` PAE row |
| BW-007 | Unknown planCode → `expandPlan` returns `[]`, no entitlement, audit row IS written |
| BW-008 | Refund event → entitlement transitions to `refunded`, `hasAccess` returns false, PAE row `toState=refunded` |

**How the tests invoke the route:** ALL billing webhook tests call the repository and billing-package functions DIRECTLY — they import `applyStripeEvent`, `createManualReviewItem`, `createStripeProvider`, etc. from `@wtc/db` and `@wtc/billing`. They do NOT import or call the Next.js route handler (`apps/web/src/app/api/billing/webhook/route.ts`). They do NOT make HTTP requests. They spin up PGlite in-process and run the DB operations directly.

**Critical implication for PG11:** Because the tests bypass the route handler entirely, Next.js middleware does NOT run during these tests. Middleware exclusion of `/api/billing/webhook` has zero effect on whether these tests pass or fail. The tests will keep passing regardless of what the middleware does, because middleware is a Next.js Edge/Node layer and these are Vitest unit/integration tests running outside Next.js.

**What PG11 must actually guarantee for the webhook route:**

1. The middleware `matcher` config must exclude `/api/billing/webhook` from any CSRF header check (the route has no CSRF token; adding one would break real Stripe delivery).
2. The middleware must NOT apply rate-limiting to this path (Stripe delivers events from multiple IPs; a per-IP rate limit would cause legitimate events to be dropped after retries).
3. The middleware SHOULD still apply security headers (CSP, HSTS, etc.) to the webhook response — the route sets `export const runtime = 'nodejs'` which means it runs in the Node runtime, and middleware runs before the route handler regardless of runtime.
4. The route reads the raw body with `req.text()`. Any middleware that attempts to read or transform the request body before the route handler would break this. Next.js middleware operates on `NextRequest` (streaming), not the body. The standard security-headers middleware pattern does NOT read the body, so there is no conflict.

**Confirmed exclusions needed in middleware `config.matcher`:**
- `/api/billing/webhook` — exclude from rate-limiting AND CSRF check (security headers can still be applied)
- `/.well-known/axioma-jwks.json` — GET-only, public, cacheable; exclude from rate-limiting; CSRF not applicable; security headers are fine to apply

---

### F-4 — INFO — IP extraction in Next.js 15; safe fallback for dev/e2e

**`NextRequest.ip` status:** In Next.js 15 `NextRequest.ip` was removed. It previously mapped to the `x-forwarded-for` header automatically in Edge runtime. In middleware running on the Node runtime (which this app uses — see `export const runtime = 'nodejs'` in the webhook route; middleware itself defaults to Edge but can be Node), the property may be undefined or absent. It should not be used.

**Correct IP extraction order for middleware:**

```typescript
function getClientIp(request: NextRequest): string {
  // 1. x-forwarded-for: may be a comma-separated list (leftmost = original client)
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  // 2. x-real-ip: set by nginx/Cloudflare proxies
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  // 3. Fallback: no proxy header present
  return 'dev-local';
}
```

**Dev/e2e fallback rationale:** In the e2e environment (`http://localhost:3100`, no reverse proxy) neither `x-forwarded-for` nor `x-real-ip` is set by the browser. The fallback key `'dev-local'` is a fixed string, not an IP address. This means:

- All e2e login attempts from localhost accumulate against the SAME `'dev-local'` bucket.
- The e2e smoke test (`tests/e2e/smoke.spec.ts`) calls `login()` for multiple user accounts across multiple tests. The total number of login attempts in the smoke suite is approximately 12-16 (one per test case that calls `login()`).
- If the rate limit is 10 req/min/IP with a burst of 5, and all e2e tests run within a minute against the same `'dev-local'` bucket, the later tests will hit `429` and fail.

**This is an e2e test breakage risk.** The 34/34 e2e must stay green.

**Recommended fix — two options:**

Option A (recommended): Apply a higher limit for localhost. Check if the resolved IP equals `'dev-local'` or starts with `127.` or `::1` and apply a limit of 200 req/min (effectively unlimited for tests). This is safe because a real attacker cannot forge `x-forwarded-for: 127.0.0.1` if nginx is configured to strip/override it before hitting the app.

Option B: Make the rate-limit window longer (e.g., 10 req per 2 min). The e2e suite takes ~90 seconds to run; spreading across 2 minutes means fewer collisions. However this still risks failure if tests run back-to-back quickly.

Option C: Make the rate-limit opt-out via `NEXT_PUBLIC_DISABLE_RATE_LIMIT=true` env checked in middleware (only respected when `NODE_ENV !== 'production'`). The e2e server uses `dev:e2e` which can set this env. Cleanest for test isolation.

**Recommendation:** Use Option A (localhost bypass) combined with Option C (env var escape hatch) for belt-and-suspenders. The localhost bypass is a code-level safeguard; the env var is the test-harness-level safeguard.

**Rate-limit state storage:** An in-memory sliding-window counter (a `Map<string, number[]>` of timestamps per IP) is appropriate for middleware. It is simple, zero-dependency, and survives the single-process dev server. For production with multiple Next.js processes (Vercel Edge functions, multi-instance Node), a Redis/Upstash backing is the correct path — but that is a Phase 12 concern. For PG11 the in-memory window is the right starting point, with a comment marking it as a TARGET for distributed backing.

**Important:** Rate-limiting logic must live in a `packages/` module (e.g., `packages/auth/src/rate-limit.ts`) to be unit-testable via Vitest. The middleware file itself imports from that package. The vitest config excludes `apps/web/**` but includes `packages/**/*.test.ts`, so the rate-limit logic can be tested without running Next.js.

---

## Decisions

1. The rate-limiter must match `POST /login` and `POST /register` only. No other paths need credential-specific throttling. The `next-action` header is an optional specificity filter for logging but must not be the sole gate.

2. The billing webhook path `/api/billing/webhook` must be excluded from CSRF checks and rate-limiting. Security headers (CSP/HSTS etc.) may still be applied to webhook responses — they do not interfere with body reading.

3. Billing webhook tests invoke the DB repositories directly, not the Next.js route handler. Middleware exclusion of `/api/billing/webhook` has no bearing on whether BW-001 through BW-008 pass or fail.

4. `NextRequest.ip` must not be used in Next.js 15 middleware. Use `x-forwarded-for` → `x-real-ip` → `'dev-local'` fallback.

5. The `'dev-local'` fallback key pools all localhost traffic into one bucket. This will cause e2e test failures if the window is tight. Use an elevated localhost limit (e.g., 200 req/min) and/or a `DISABLE_RATE_LIMIT_DEV` env-var escape hatch.

6. Rate-limit logic must be in `packages/auth/src/rate-limit.ts` (or similar) to be unit-testable via Vitest. The middleware imports it; the middleware itself is not testable by Vitest (excluded from `apps/web/**`).

---

## Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|-----------|
| R-1 | e2e tests call `login()` ~14 times across the smoke suite; a tight `'dev-local'` IP bucket will cause 429s on tests 2+ if all run within one rate-limit window. | HIGH | Localhost bypass or `DISABLE_RATE_LIMIT_DEV` env var. |
| R-2 | The SECURITY_MODEL.md §4 table names `/api/auth/login` and `/api/auth/register` — routes that do not exist. An implementer following the spec literally will create a middleware that matches zero real traffic. | HIGH | Must match `/login` and `/register` (page paths), not `/api/auth/*`. |
| R-3 | Middleware running in Edge runtime cannot import `@wtc/auth` barrel because `packages/auth/src/password.ts` imports `@node-rs/argon2` (native binding, not Edge-compatible). If anyone adds `import { ... } from '@wtc/auth'` to the middleware, the build will fail. | HIGH | Middleware must only import the rate-limit module and any pure-JS utilities. It must NOT import the `@wtc/auth` barrel. |
| R-4 | A nonce-based CSP (`script-src 'nonce-...'`) in middleware will conflict with Next.js dev HMR (inline scripts, eval). The e2e server runs `NODE_ENV=development`. A strict nonce-only policy will break HMR and fail e2e tests. | HIGH | In development, either omit the nonce from script-src (allow `'unsafe-inline'`) or add `'unsafe-eval' 'unsafe-inline'` to script-src when `NODE_ENV !== 'production'`. |
| R-5 | In-memory rate-limit state is lost on server restart. A rapid restart (e.g., HMR hot-reload in dev) resets all counters. This is acceptable in development; in production multi-process environments it allows a distributed brute-force to stay under the per-process limit. | MEDIUM | Document as TARGET for distributed Redis/Upstash backing. Acceptable at MVP. |
| R-6 | The `/.well-known/axioma-jwks.json` route is a GET endpoint. It must not be matched by any rate-limit or CSRF predicate. It should receive security headers. The `config.matcher` must not accidentally exclude it from header injection. | LOW | Explicitly exclude from rate-limit and CSRF; do not exclude from security headers. |

---

## Verification/tests

**Tests that must be written in `packages/auth/src/rate-limit.test.ts`** (unit-testable via Vitest because it lives in `packages/**`):

- Sliding window: 10 requests within 60 seconds → 11th returns `{ allowed: false, retryAfterMs: ... }`.
- Reset: after the window expires, counter resets and requests are allowed again.
- Per-IP isolation: two different IPs each get their own 10-req budget (no cross-contamination).
- Localhost passthrough: `'dev-local'` or `'127.0.0.1'` with an elevated limit never returns `{ allowed: false }` before 200 requests.

**e2e invariant:** The 34 existing e2e tests must still pass after middleware is introduced. Specifically:
- `login()` in `smoke.spec.ts` must never receive `429`.
- Pages must receive security headers (assert on `Content-Security-Policy` header in at least one test, or accept as a separate Playwright test added in PG11).

**Billing webhook tests (BW-001 through BW-008):** These invoke DB repositories directly. They are unaffected by middleware changes. No additional middleware work is needed to keep them green.

---

## Next actions

Ordered for the PG11 implementer:

1. **Create `packages/auth/src/rate-limit.ts`** — pure-JS in-memory sliding-window rate limiter. Signature: `rateLimit(key: string, opts: { limit: number; windowMs: number }): { allowed: boolean; retryAfterMs: number }`. Write co-located `rate-limit.test.ts` with the unit tests described above.

2. **Create `apps/web/src/middleware.ts`** with:
   - Import `rateLimit` from `packages/auth/src/rate-limit.ts` (NOT from `@wtc/auth` barrel — that imports argon2 which is Node-native, not Edge-safe).
   - Rate-limit predicate: `request.method === 'POST' && (pathname === '/login' || pathname === '/register')`.
   - IP extraction: `x-forwarded-for` → `x-real-ip` → `'dev-local'` fallback.
   - Localhost/dev bypass: if resolved IP is `'dev-local'` or `NODE_ENV !== 'production'` and `process.env.DISABLE_RATE_LIMIT_DEV === 'true'`, skip rate-limiting (apply headers only).
   - On rate-limit violation: return `new Response('Too many requests', { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } })`.
   - Security headers on ALL responses (including the 429): CSP (dev: `unsafe-inline`/`unsafe-eval`; prod: nonce-based), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP.

3. **`config.matcher` in `middleware.ts`**:
   ```typescript
   export const config = {
     matcher: [
       // Apply to all paths EXCEPT Next internals and static assets.
       '/((?!_next/static|_next/image|favicon.ico).*)',
     ],
   };
   ```
   The billing webhook path (`/api/billing/webhook`) is matched by this pattern — the middleware will run on that request. That is fine: it will apply security headers and skip rate-limiting (because the rate-limit predicate only fires on POST `/login` or `/register`). Do NOT add a CSRF check in middleware for the webhook path.

4. **`packages/audit/src/redact.ts` value-pattern guard (F-07 from security-auditor):** Add an `isSecretValue(v: unknown)` helper checking: strings starting with `$argon2id$` or `$2b$`, strings matching `/^Bearer /i` or `/^Basic /i`, strings of 64+ hex chars (`/^[0-9a-f]{64,}$/i`). Call it in `redact()` before recursing: if `typeof v === 'string' && isSecretValue(v) return REDACTED`. Write co-located test asserting all three patterns are caught.

5. **Update `docs/SECURITY_MODEL.md` §4 endpoint table** — replace `POST /api/auth/login` → `POST /login` and `POST /api/auth/register` → `POST /register` to match implementation reality. Note that CSRF does not apply to `loginAction` and `registerAction` (they are unauthenticated form posts; no session token exists yet to derive the CSRF token from; the `assertCsrf` call is correctly absent in those two actions). The `logoutAction` does assert CSRF because it runs in an authenticated context.
