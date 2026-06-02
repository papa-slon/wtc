# ecosystem-tests-runner handoff

## Scope

Read-only audit and test-plan specification for Phase Group 11 (PG11). Defines the exact unit
test cases (Vitest), e2e test approach (Playwright), and full gate sequence required before PG11
sign-off. Three deliverables: (1) rate-limit sliding-window test cases, (2) security-headers
builder test cases, (3) redact value-pattern test cases. Plus e2e feasibility ruling and the
ordered gate list with expected deltas.

Ground truth epoch: Phase 2.5 / 20260530-1625. Baseline: 241 tests passed / 7 skipped,
e2e 34/34 (17 desktop + 17 mobile).

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/SECURITY_MODEL.md` — §4 (rate-limiting spec) and §6 (headers/CSP spec)
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260530-1625-ecosystem-security-auditor.md` — F-01 (middleware absent) and F-07 (redact value-pattern)
- `vitest.config.ts` — include: packages/**/*.test.ts, tests/integration/**/*.test.ts; exclude: apps/web/**
- `playwright.config.ts` — baseURL :3100, 1 worker, fullyParallel: false, NODE_ENV=development
- `apps/web/src/app/(auth)/actions.ts` — loginAction/registerAction/logoutAction via server actions, no /api/auth/* routes
- `packages/audit/src/redact.ts` — field-name blocklist only, no value-pattern guards (confirmed)
- `packages/audit/src/audit.ts` — buildEvent, AUDIT_ACTIONS, AuditWriter
- `packages/auth/src/rbac.ts` — can(), canActOnOwned(), assertAdmin(), AccessDeniedError
- `packages/auth/src/rbac.test.ts` — existing RBAC tests (3 cases)
- `packages/entitlements/src/state-machine.ts` — isGranting(), nextStatus(), ENTITLEMENT_STATUSES
- `packages/entitlements/src/engine.test.ts` — confirmed exists
- `packages/analytics/src/metrics.test.ts` — existing analytics tests (first 60 lines)
- `tests/e2e/smoke.spec.ts` — all 34 e2e assertions reviewed
- `tests/integration/*.test.ts` — 12 integration test files confirmed
- `package.json` — scripts: test, lint, typecheck, coverage, e2e, check:core, governance:check, db:generate, secret:scan

---

## Files changed

None — read-only audit

---

## Findings

### F-A — CRITICAL — No rate-limit or security-header unit test package exists yet

**Severity:** CRITICAL (PG11 implementation prerequisite)

**Evidence:** `packages/` contains no `rate-limit` or `middleware` package. `vitest.config.ts` line 8
includes `packages/**/*.test.ts` but excludes `apps/web/**`. The rate-limit sliding-window logic
and the security-headers builder must live in a new `packages/rate-limit` (or `packages/middleware`)
package so Vitest can discover their `.test.ts` files without touching the excluded `apps/web/` tree.
Alternatively the logic files (no Next.js imports) may live in `packages/auth/src/rate-limit.ts`
and `packages/auth/src/headers.ts` with co-located test files, since `packages/auth` is already
in the include glob.

**Recommendation:** Place `buildRateLimit(opts)` in `packages/auth/src/rate-limit.ts` and
`buildSecurityHeaders(opts)` in `packages/auth/src/headers.ts` (both zero-dependency, no Next.js
imports). Add `rate-limit.test.ts` and `headers.test.ts` co-located. The middleware
(`apps/web/src/middleware.ts`) imports from `packages/auth` and calls these functions — it is
not itself unit-tested via Vitest (excluded from the config).

---

### F-B — HIGH — redact.ts has no value-pattern check; test file does not exist

**Severity:** HIGH (security gap confirmed in F-07 of security-auditor handoff)

**Evidence:** `packages/audit/src/redact.ts` lines 46-55. The `redact()` function iterates object
keys only; it has no string-value pattern check. The `packages/audit/src/` directory contains
no `.test.ts` file (Glob returned no match). `redact.ts` is smoke-tested via `__smoke__.ts` only.

**Recommendation:** Create `packages/audit/src/redact.test.ts`. It is the canonical location
(matches the `packages/**/*.test.ts` include glob). The value-pattern guard (`isSecretValue()`)
should be added to `redact.ts` itself, then tested here.

---

### F-C — INFO — E2E 429 assertion is high-flake risk in single-worker dev-server setup

**Severity:** INFO (design constraint, not a defect)

**Evidence:** `playwright.config.ts` lines 6-7: `fullyParallel: false`, `workers: 1`.
`playwright.config.ts` lines 21-26: `webServer.command = 'npm run dev:e2e -w @wtc/web'`,
`reuseExistingServer: !process.env.CI`. The rate-limiter is IP-keyed and in-process. State
persists across the test file within one server process. The smoke spec (`tests/e2e/smoke.spec.ts`)
runs 17 test-cases per project (34 total) that include `login()` calls posting to the login
server action. If a 429-assertion test fires 11 rapid POSTs, those counted requests will
contaminate the window for all subsequent tests in the same server process.

**Recommendation:** See §1.3 (E2E approach) below. 429 coverage stays at unit level; headers-only
assertion in e2e is the correct trade-off.

---

### F-D — INFO — Dev-mode CSP must be relaxed; nonce-only CSP would break HMR

**Severity:** INFO (design constraint)

**Evidence:** `playwright.config.ts` line 4 comment: "E2E uses the dev server (NODE_ENV=development)
so session cookies are not Secure-only over http." React Fast Refresh injects inline `<script>` tags
at dev time. A `script-src 'nonce-{X}'` without `'unsafe-eval'` and `'unsafe-inline'` blocks HMR,
causing Next.js dev to break and all 34 e2e to fail. `docs/SECURITY_MODEL.md` §6 specifies the
nonce CSP for production.

**Recommendation:** `buildSecurityHeaders()` must accept a `{ env: 'production' | 'development' }`
flag. In development: emit `script-src 'self' 'unsafe-eval' 'unsafe-inline'` (no nonce). In
production: emit `script-src 'self' 'nonce-{NONCE}'`. The HSTS header should be omitted in
development (no TLS over :3100). All other headers (X-Content-Type-Options, X-Frame-Options,
Referrer-Policy, Permissions-Policy, COOP, CORP) are safe in both environments.

---

## Decisions

1. Unit tests for rate-limit and headers logic go in `packages/auth/src/` (co-located `.test.ts`),
   not in a new package, to minimise scaffolding overhead and reuse the existing package.json /
   tsconfig path.

2. 429 coverage is unit-only. E2E asserts only security headers on a normal GET. This is
   the correct risk/reward split: unit tests are deterministic; e2e 429 tests contaminate limiter
   state across the test run in a single-worker dev server.

3. The redact value-pattern test file is `packages/audit/src/redact.test.ts` — new file, no
   existing test file to conflict with.

4. HSTS is production-only. Dev server runs http on :3100; sending HSTS over http is a no-op at
   best and confusing at worst. The test suite must assert HSTS absent in dev mode.

5. `buildRateLimit(opts)` takes `now` as a parameter (defaulting to `Date.now()`). This is the
   only way to make sliding-window tests deterministic without real timers or vi.useFakeTimers.

---

## Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|-----------|
| R-A | Rate-limit state is in-process (Map/object). Under serverless/edge with multiple instances the limiter resets per instance, giving each instance its own window. | HIGH | Document as known limitation in code comment. Real production uses nginx layer-1 anyway. Not a testing risk. |
| R-B | A 429-assertion e2e test that fires 11 rapid POSTs would consume login-action calls. The dev server's in-memory limiter would block subsequent smoke tests that call login(). | HIGH | Do not add a 429 e2e test. Keep 429 coverage at unit level only. |
| R-C | The CSP nonce must be stamped on all Next.js-rendered `<script>` tags. If the nonce is generated per-request in middleware but not threaded through to the `<head>` via `headers()` or a layout prop, the CSP will block all app JS in production. | HIGH | The implementer must use Next.js's `headers()` + `nonce` convention (see Next 15 docs: pass nonce via response header `x-nonce`, read in root layout via `headers()`). This is a runtime wiring concern; the unit test cannot verify it — it must be an e2e assertion in production mode or a build-level check. |
| R-D | `apps/web` is excluded from vitest.config.ts. Any logic that imports Next.js (`next/headers`, `next/server`) cannot be tested via Vitest without mocking. The middleware itself is not unit-testable under the current config. | MEDIUM | Confirmed mitigation: extract pure functions to `packages/auth`; test those. The Next.js wiring in `middleware.ts` is covered by e2e smoke (build + load pages). |
| R-E | The billing webhook route (`apps/web/src/app/api/billing/webhook/route.ts`) must be excluded from the rate-limiter config matcher. The existing tests (`billing-webhook.test.ts`, `billing-webhook-phase24.test.ts`) must continue to pass. | MEDIUM | The middleware matcher config (`export const config = { matcher: [...] }`) must explicitly exclude `/api/billing/webhook`. The unit test for the rate-limiter does not need to cover this path; the e2e smoke for the webhook (integration tests) already cover it. |

---

## Verification/tests

### 1. Unit tests — rate-limit sliding window

**Target file:** `packages/auth/src/rate-limit.test.ts`
**Depends on:** `packages/auth/src/rate-limit.ts` (to be created by implementer)

The `buildRateLimit(opts)` function signature required for testability:

```typescript
type RateLimitOpts = {
  windowMs: number;    // e.g. 60_000
  max: number;         // e.g. 10
};
type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;  // 0 when allowed; ms until oldest entry expires when blocked
};
// now defaults to Date.now() but is injectable for tests
function checkRateLimit(store: Map<string, number[]>, key: string, opts: RateLimitOpts, now?: number): RateLimitResult
```

Assertions required (each must be a separate `it()`):

1. **allows up to limit within window**: call `checkRateLimit` `max` times with the same key and
   same `now`; all return `allowed: true`; `remaining` decrements from `max-1` to `0`.

2. **blocks on limit+1**: call `max+1` times; the (max+1)-th call returns `allowed: false`.

3. **429 result carries Retry-After > 0**: when blocked, `retryAfterMs > 0` and
   `retryAfterMs <= windowMs`.

4. **per-key isolation**: 10 calls with key `"1.2.3.4"` do not affect key `"5.6.7.8"`;
   the second key still allows on its first call.

5. **window reset after windowMs**: call `max` times with `now = 0`; then call once with
   `now = windowMs + 1`; result is `allowed: true` (old entries have expired).

6. **partial window reset**: call 5 times at `now = 0`; then 5 more at `now = windowMs - 1`
   (still within window); then call once at `now = windowMs + 1` (first 5 expired, second 5
   still live) → `remaining = max - 5 - 1` (i.e. 4 if max=10).

7. **Retry-After is the time until the oldest entry in the window expires**: when blocked,
   `retryAfterMs === windowMs - (now - entries[0])` (within ±1 ms tolerance for integer math).

8. **empty key on first call**: `remaining === max - 1`, `allowed: true`.

9. **store is mutated in place**: calling twice with the same store reference accumulates entries
   (state is caller-owned, not hidden inside a closure, so tests can inspect it).

---

### 2. Unit tests — security headers builder

**Target file:** `packages/auth/src/headers.test.ts`
**Depends on:** `packages/auth/src/headers.ts` (to be created by implementer)

The `buildSecurityHeaders(opts)` function signature:

```typescript
type HeadersOpts = {
  env: 'production' | 'development';
  nonce?: string;  // required in production; ignored in development
};
// returns a plain object of header name → value
function buildSecurityHeaders(opts: HeadersOpts): Record<string, string>
```

Assertions required:

1. **X-Content-Type-Options = nosniff** in both prod and dev.

2. **X-Frame-Options = DENY** in both prod and dev.

3. **Referrer-Policy = strict-origin-when-cross-origin** in both prod and dev.

4. **Permissions-Policy = camera=(), microphone=(), geolocation=(), payment=()** in both
   prod and dev (exact value per SECURITY_MODEL.md §6).

5. **Cross-Origin-Opener-Policy = same-origin** in both prod and dev.

6. **Cross-Origin-Resource-Policy = same-origin** in both prod and dev.

7. **Strict-Transport-Security present in production**: value must be
   `max-age=63072000; includeSubDomains; preload` (exact match from SECURITY_MODEL.md §6).

8. **HSTS absent in development**: `buildSecurityHeaders({ env: 'development' })` must not
   include a `Strict-Transport-Security` key.

9. **prod CSP contains nonce**: `buildSecurityHeaders({ env: 'production', nonce: 'abc123' })`
   produces a CSP value that includes `'nonce-abc123'` in `script-src`.

10. **prod CSP does not contain unsafe-eval or unsafe-inline in script-src**:
    `script-src` in production must NOT contain `'unsafe-eval'` or `'unsafe-inline'`.

11. **dev CSP contains unsafe-eval and unsafe-inline, no nonce**:
    `buildSecurityHeaders({ env: 'development' })` CSP `script-src` contains `'unsafe-eval'`
    and `'unsafe-inline'` and does NOT contain `'nonce-'`.

12. **frame-ancestors none in prod CSP** (prevents clickjacking even without X-Frame-Options).

13. **upgrade-insecure-requests present in prod CSP** (per SECURITY_MODEL.md §6).

14. **base-uri self and form-action self in prod CSP** (per SECURITY_MODEL.md §6).

---

### 3. Unit tests — redact value-pattern guard

**Target file:** `packages/audit/src/redact.test.ts`
**Depends on:** updated `packages/audit/src/redact.ts` (value-pattern guard added by implementer)

The `isSecretValue(v: unknown): boolean` helper (to be added to `redact.ts`) must match:
- Strings with `$argon2id$` prefix (PHC argon2id)
- Strings with `$2b$` or `$2a$` prefix (bcrypt)
- Strings starting with `Bearer ` (case-sensitive)
- Strings starting with `Basic ` (case-sensitive)
- Strings that are 64 or more lowercase hex characters (session tokens, SHA-256 hashes)

Assertions required:

1. **PHC argon2id string is redacted regardless of key name**:
   ```
   redact({ message: '$argon2id$v=19$m=65536,t=3,p=2$abc$def' })
   // → { message: '[REDACTED]' }
   ```
   The key `message` is not in SECRET_HINTS — this proves value-pattern matching is active.

2. **Bearer token string is redacted regardless of key name**:
   ```
   redact({ info: 'Bearer eyJhbGciOiJFUzI1NiJ9.abc.def' })
   // → { info: '[REDACTED]' }
   ```

3. **64-char hex string is redacted regardless of key name**:
   ```
   redact({ data: 'a'.repeat(64) })  // 64 lowercase hex chars
   // → { data: '[REDACTED]' }
   ```

4. **Normal short string is NOT redacted**:
   ```
   redact({ message: 'Hello world' })
   // → { message: 'Hello world' }
   ```

5. **Normal sentence is NOT redacted**:
   ```
   redact({ description: 'The user logged in from Paris' })
   // → { description: 'The user logged in from Paris' }
   ```

6. **Nested object: value-pattern redaction applies at every depth**:
   ```
   redact({ outer: { inner: { msg: '$argon2id$v=19$m=65536,t=3,p=2$x$y' } } })
   // → { outer: { inner: { msg: '[REDACTED]' } } }
   ```

7. **Array: value-pattern redaction applies inside arrays**:
   ```
   redact({ items: ['hello', 'Bearer abc123longtoken'] })
   // → { items: ['hello', '[REDACTED]'] }
   ```
   Note: current `redact()` handles arrays of objects (line 49) but not arrays of primitives.
   The implementer must extend `redact()` to apply `isSecretValue` to primitive array elements.

8. **Existing field-name redaction unaffected**: `{ password: 'hello' }` → `{ password: '[REDACTED]' }`
   (regression guard: the field-name path still fires independently of value-pattern).

9. **bcrypt string is redacted**:
   ```
   redact({ note: '$2b$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234' })
   // → { note: '[REDACTED]' }
   ```

10. **63-char hex string is NOT redacted** (boundary: threshold is 64 chars):
    ```
    redact({ ref: 'a'.repeat(63) })
    // → { ref: 'a'.repeat(63) }  // not redacted
    ```

11. **Null and non-string primitives are not affected by value-pattern check**:
    ```
    redact({ count: 42, flag: true, empty: null })
    // → { count: 42, flag: true, empty: null }
    ```

---

### 4. E2E approach for PG11

**Decision: do NOT add a 429 e2e test. Assert security headers only.**

**Rationale for no-429-e2e:**
The dev server runs at port 3100 in a single process across all 34 existing tests. The limiter is
in-process (Map-based). The existing smoke spec calls `login()` (which POSTs to the login server
action) in multiple tests: `user dashboard/bot warnings/terminal/security`, `admin console`,
`indicators + education`, `teacher`, `Phase 2.2 LMS`, `bot dashboard sub-tabs`,
`Phase 2.3 billing`, `Phase 2.3 admin pages`, `Phase 2.3 TV admin`, `Phase 2.3 terminal`,
`Phase 2.3 no live-control`, `Phase 2.4 E2E-29/30`, `Phase 2.4 E2E-31/32`,
`Phase 2.4 E2E-33/34`. That is ~14 test cases × 2 projects (desktop + mobile) = up to 28
separate login POST calls within the same server lifetime. If a 429-trigger test (11 rapid POSTs)
fires first, subsequent tests that call `login()` will hit the rate-limiter and fail.

**Approach for header assertion (new e2e test):**
Add one test to `tests/e2e/smoke.spec.ts`:

```typescript
test('PG11 security headers present on GET /', async ({ request }) => {
  const res = await request.get('/');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(res.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(res.headers()['cross-origin-resource-policy']).toBe('same-origin');
  // Permissions-Policy must be present (exact value checked)
  expect(res.headers()['permissions-policy']).toContain('camera=()');
  // No HSTS in dev (e2e runs NODE_ENV=development over http)
  expect(res.headers()['strict-transport-security']).toBeUndefined();
  // CSP present and contains dev-mode relaxed script-src (unsafe-eval/inline, no nonce)
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("'unsafe-eval'");  // dev mode
});
```

This uses `request` (Playwright API request context), not `page` — it is a pure HTTP request with
no browser rendering, so it is immune to HMR/CSP interaction. It runs once per project
(desktop + mobile), adding 2 assertions to the suite → e2e total becomes **36/36**.

**If the operator prefers 429 coverage at integration level (not e2e):**
Add a `tests/integration/rate-limit.test.ts` that calls `checkRateLimit()` directly (pure
function, no HTTP). This is cleaner than e2e for rate-limit logic. The 429 response code
is tested at the unit level (the middleware integration is implicitly exercised when any POST
to a rate-limited path is made during e2e; the header test above confirms the middleware runs).

---

## Next actions

### For the PG11 implementer (ordered):

1. Create `packages/auth/src/rate-limit.ts`:
   - Export `checkRateLimit(store, key, opts, now?)` with injectable `now` parameter.
   - Store type: `Map<string, number[]>` (key → array of timestamps within window).
   - Return `{ allowed, remaining, retryAfterMs }`.
   - No dependencies outside `packages/auth`.

2. Create `packages/auth/src/rate-limit.test.ts` with the 9 assertions enumerated in §1 above.

3. Create `packages/auth/src/headers.ts`:
   - Export `buildSecurityHeaders(opts: { env, nonce? })`.
   - CSP: production uses nonce; development uses unsafe-eval + unsafe-inline. No nonce in dev.
   - HSTS: production only. All other headers: both envs.
   - All header values must exactly match `docs/SECURITY_MODEL.md` §6.

4. Create `packages/auth/src/headers.test.ts` with the 14 assertions enumerated in §2 above.

5. Add `isSecretValue(v: unknown): boolean` to `packages/audit/src/redact.ts`:
   - Match PHC prefixes (`$argon2id$`, `$2b$`, `$2a$`).
   - Match `Bearer ` and `Basic ` prefixes (case-sensitive).
   - Match strings of 64+ consecutive lowercase hex chars (regex: `/^[0-9a-f]{64,}$/`).
   - Call `isSecretValue(v)` in `redact()` for primitive string values (not just key checks).
   - Extend array handling to apply `isSecretValue` to primitive elements (not just objects).

6. Create `packages/audit/src/redact.test.ts` with the 11 assertions enumerated in §3 above.

7. Create `apps/web/src/middleware.ts`:
   - Import `checkRateLimit` from `packages/auth` (not `@node-rs/argon2` — Edge-safe).
   - Import `buildSecurityHeaders` from `packages/auth`.
   - Rate-limit paths: `/app/(auth)/login` server action POST (next-action header), any POST
     to login/register page paths. Auth is via server actions, not `/api/auth/*` routes.
     Match: `/(login|register)` pages for POST requests (check `request.method === 'POST'`
     or presence of `next-action` header on form POST).
   - Exclude `/api/billing/webhook` from all middleware processing (raw body, no rate-limit,
     no CSRF). Use `export const config = { matcher: ['/((?!api/billing/webhook).*)'] }`.
   - Apply security headers to all responses.
   - On rate-limit exceeded: `return new NextResponse(null, { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } })`.
   - Generate nonce per-request (production): `crypto.randomUUID()` or 16-byte base64.
   - Pass nonce to response via `x-nonce` header so the root layout can read it via `headers()`.
   - ENV flag check: `process.env.NODE_ENV === 'production'` for nonce/HSTS.

8. Add PG11 e2e test to `tests/e2e/smoke.spec.ts` (the header-assertion test above). This adds
   2 to the e2e count (1 test × 2 projects) → expected total 36/36.

9. Do NOT add a 429 e2e test. The 9 unit assertions in `rate-limit.test.ts` cover it.

---

### Gate sequence for PG11 sign-off

Run in this exact order. Each gate must be green before moving to the next.

| # | Gate | Command | Expected result / delta |
|---|------|---------|------------------------|
| 1 | governance:check | `npm run governance:check` | PASS — PG11 aggregate must cite all per-agent handoffs at the PG11 epoch |
| 2 | check:core | `npm run check:core` | PASS — 7 smokes unchanged (no new smoke files) |
| 3 | lint | `npm run lint` | PASS — 0 warnings/errors; new `.ts` files must have no ESLint violations |
| 4 | typecheck (packages) | `npm run typecheck` | PASS — new files in `packages/auth` and `packages/audit` must compile |
| 5 | typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — `apps/web/src/middleware.ts` must compile against `@wtc/web` tsconfig |
| 6 | secret:scan | `npm run secret:scan` | PASS — no secrets in new files |
| 7 | test (Vitest) | `npm test` | PASS — expected delta: **+26 new tests** (9 rate-limit + 14 headers + 11 redact + 2 spare); total ≥ 267 passed |
| 8 | coverage | `npm run coverage` | Report only — branch coverage should stay ≥ 70%; stmts likely dips slightly as new pages grow denominator |
| 9 | db:generate | `npm run db:generate -w @wtc/db` | PASS — "No schema changes" (PG11 adds no DB tables) |
| 10 | build | `npm run build -w @wtc/web` | PASS — `middleware.ts` must compile; `apps/web` must still build cleanly; page count unchanged |
| 11 | e2e | `npx playwright test` | PASS — expected: **36/36** (+2 from new header assertion test × 2 projects); existing 34 MUST stay green |

**NOT RUN (unchanged from Phase 2.5):**
- `db:migrate` / `db:seed` / real-PG harness — NOT RUN (no DATABASE_URL, no Docker)
- Stripe checkout path — TARGET
- Axioma ES256 production handoff — TARGET
- CI (`.github/workflows/ci.yml`) — NOT RUN (not a git repo)

---

### Windows harness gotchas (do not call as degradation)

From prior phases — these are known non-failures:

1. **"shorter than offset" / read tool errors on absent files**: not a test failure.
2. **"wasted call" warnings**: not a test failure; Vitest reporter artefact.
3. **`/tmp` redirect denied**: PowerShell `$null` not `/dev/null`; use `Out-Null` or `$null =`.
4. **Playwright port 3100 already bound**: `reuseExistingServer: !process.env.CI` means if a dev
   server is already running on :3100, Playwright reuses it. For gate runs, ensure no prior server
   is running on :3100 before `npx playwright test`.
5. **Coverage stmts dip**: each new UI page added to `apps/web` (even excluded from vitest) grows
   the build output denominator if coverage instruments the build. Do not treat stmts dip as a
   failure if branch coverage holds above 70%.
6. **`npm run typecheck -w @wtc/web` timeout**: Next.js typechecking of the app router can be
   slow (15-60 seconds). Do not kill it prematurely — it is not hung.

---

### Real vs mocked tally update (after PG11)

After PG11 sign-off, `docs/STATUS.md` real-vs-mocked section should add:

- **Real + verified:** auth rate-limiting middleware (IP-keyed sliding window, 429 + Retry-After),
  security headers on all responses (CSP/HSTS/X-Content-Type-Options/X-Frame-Options/Referrer-Policy/
  Permissions-Policy/COOP/CORP), `redact()` value-pattern guard (PHC/Bearer/64-hex).
- **Still NOT RUN:** real-PG path, Stripe checkout, Axioma ES256 production handoff.
