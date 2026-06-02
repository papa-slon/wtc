# ecosystem-security-auditor handoff

## Scope

PG11 lead audit: produce the precise, implementable security spec for `apps/web/src/middleware.ts`
(IP-keyed auth rate-limiting + security headers + billing-webhook exclusion) and the `redact.ts`
value-pattern guard. Covers six scoped questions assigned by the orchestrator. Read-only; no edits.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SECURITY_MODEL.md` (all sections, binding spec)
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-1625-ecosystem-security-auditor.md` (prior security audit; F-01/F-07 drivers)
- `apps/web/src/app/(auth)/actions.ts` — loginAction, registerAction, logoutAction (server actions)
- `apps/web/src/app/(auth)/login/page.tsx` — form posts to loginAction (next-action header)
- `apps/web/src/app/(auth)/register/page.tsx` — form posts to registerAction
- `apps/web/src/app/api/billing/webhook/route.ts` — CSRF-exempt, raw body, HMAC-first
- `apps/web/src/lib/session.ts` — sessionCookieName, requireUser
- `apps/web/src/lib/csrf.tsx` (referenced but not re-read; already known from prior audit)
- `apps/web/next.config.ts` — no headers() config; no existing middleware wiring
- `playwright.config.ts` — dev server (NODE_ENV=development) on port 3100; 34/34 green
- `vitest.config.ts` — includes `packages/**/*.test.ts` + `tests/integration/**`; EXCLUDES `apps/web/**`
- `packages/audit/src/redact.ts` — current redact() implementation (field-name only; no value patterns)
- `packages/auth/src/index.ts` — barrel exports (imports @node-rs/argon2 via password.ts)
- `packages/auth/src/session.ts` — Node-crypto only; Edge-safe
- `packages/auth/src/csrf.ts` — Node-crypto only; Edge-safe
- `packages/auth/src/logger.ts` — absent (confirmed)
- `tests/e2e/smoke.spec.ts` — 34 e2e scenarios, all auth via form + cookie
- `tests/integration/billing-webhook.test.ts` — BW-001..004
- `tests/integration/billing-webhook-phase24.test.ts` — BW-005..008

---

## Files changed

None — read-only audit

---

## Findings

### F-PG11-01 — SPEC — Security headers: exact name→value map

**Severity:** Spec/Implementation guidance (prerequisite for F-01 fix)

Based on `docs/SECURITY_MODEL.md` §6 (binding), the exact header map to emit on every response
from middleware.ts (except where overridden per-path; see below):

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Content-Security-Policy: <see F-PG11-02>
```

**HSTS in dev:** HSTS MUST be omitted when the request arrives over plain HTTP (i.e., when
`request.headers.get('x-forwarded-proto') !== 'https'` and `process.env.NODE_ENV !== 'production'`).
Sending HSTS over HTTP is useless and causes test friction. Condition: only emit HSTS when
`NODE_ENV === 'production'` OR the request already arrived over HTTPS. The safe heuristic for
middleware: only emit HSTS if `NODE_ENV === 'production'`.

**Recommendation:** in the header-injection helper, gate HSTS on `NODE_ENV === 'production'`.
All other headers above are safe to emit in dev and prod without change.

---

### F-PG11-02 — SPEC — CSP: exact prod string + dev relaxation decision

**Severity:** Spec/Implementation guidance

**Prod CSP** (exact string from `docs/SECURITY_MODEL.md` §6, with nonce placeholder):

```
default-src 'self';
script-src 'self' 'nonce-{NONCE}';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://cdn.axi-o.ma;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://axi-o.ma;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

`{NONCE}` is replaced with a per-request `crypto.randomUUID()` (or `randomBytes(16).toString('base64url')`).
The nonce value is forwarded to Next.js via a request header (`x-nonce`) so the `<head>` layout can
stamp `nonce={nonce}` on every `<script>` tag. This is the Next.js documented middleware→layout nonce
pattern: middleware sets `request.headers.set('x-nonce', nonce)` and the layout server component reads
`headers().get('x-nonce')`.

**Dev CSP problem (HMR / React Refresh):**
Next.js dev server HMR uses:
- Inline `<script>` tags injected by the dev runtime (no nonce attribute, no src)
- `eval()` inside React Fast Refresh

A nonce-only `script-src 'self' 'nonce-{NONCE}'` would break HMR because injected scripts have no nonce
and `eval` is not permitted. The e2e suite (34 tests) runs against the dev server; a strict prod CSP would
cause HMR failures and potentially break e2e assertions that depend on React rendering.

**DECISION — dev CSP (response-header only, no nonce forwarding):**

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://cdn.axi-o.ma;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://axi-o.ma wss://localhost:* ws://localhost:*;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Changes from prod in dev:
1. `script-src`: drops `'nonce-{NONCE}'`; adds `'unsafe-inline' 'unsafe-eval'` to allow HMR.
2. `connect-src`: adds `wss://localhost:*` and `ws://localhost:*` for HMR websocket.
3. `upgrade-insecure-requests` is omitted (dev runs on http).
4. No `x-nonce` header forwarded in dev (no nonce needed; layout must NOT read nonce from header in dev).

**Implementation pattern:**

```typescript
// In middleware.ts
const isProd = process.env.NODE_ENV === 'production';
const nonce = isProd ? Buffer.from(crypto.randomUUID()).toString('base64url') : undefined;

const csp = isProd
  ? [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.axi-o.ma",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://axi-o.ma",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.axi-o.ma",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://axi-o.ma wss://localhost:* ws://localhost:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
```

The nonce is forwarded only in prod:
```typescript
if (isProd && nonce) {
  requestHeaders.set('x-nonce', nonce);
}
```

The root layout (`apps/web/src/app/layout.tsx`) should already or will need to read:
```typescript
import { headers } from 'next/headers';
const nonce = (await headers()).get('x-nonce') ?? undefined;
// pass nonce to <Script nonce={nonce}> and any inline <script nonce={nonce}>
```

---

### F-PG11-03 — SPEC — Rate-limiting: exact targets, window, key, response

**Severity:** Spec/Implementation guidance

**Confirmed auth entry points (server actions, NOT /api/auth/* routes):**

Evidence: `apps/web/src/app/(auth)/actions.ts` — `loginAction` and `registerAction` are exported
server actions. Forms at `/login` and `/register` post to the SAME PAGE PATH with the `next-action`
header. There are NO route handlers at `/api/auth/login` or `/api/auth/register`. The prior
`docs/SECURITY_MODEL.md` §4 table lists `/api/auth/login` and `/api/auth/register` — these labels
are doc-level names for the auth operations, not literal URL paths.

**Correct rate-limit targets for middleware.ts:**

Next.js server actions post to the page's own URL (`/login`, `/register`) with:
- Method: `POST`
- Header: `next-action: <action-id>`

The middleware must intercept `POST /login` and `POST /register` (and detect server-action posts).
The most robust matcher: check `request.method === 'POST'` AND `request.nextUrl.pathname` is one of
`/login`, `/register`. Do NOT check for the `next-action` header — rate-limit ALL POSTs to those
paths because: (a) an attacker will not send the header, (b) it is simpler and equally safe.

```typescript
const AUTH_PATHS = new Set(['/login', '/register']);
const isAuthPost = request.method === 'POST' && AUTH_PATHS.has(request.nextUrl.pathname);
```

**Rate-limit policy (from SECURITY_MODEL.md §4):**
- Window: 60 seconds (1 minute)
- Limit: 10 requests per window
- Burst: 5 (spec says burst=5 at nginx layer; in-process implementation: fixed window of 10 is the
  simpler Edge-safe equivalent — burst is an nginx concern; the application layer enforces 10/min)
- Key: client IP address

**IP extraction (header priority order):**
```typescript
function getClientIp(request: NextRequest): string {
  // x-forwarded-for: may be a comma-separated list; take ONLY the first hop.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  // x-real-ip: set by nginx/Vercel as the direct client IP.
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  // Fallback: no trusted IP — use a sentinel so rate-limit still applies.
  return 'unknown';
}
```

**CRITICAL EDGE RUNTIME CONSTRAINT:** `@node-rs/argon2` and any Node.js built-in (crypto.createHash,
etc.) cannot be imported in the Edge runtime. However, the rate-limit store itself only needs a
simple in-process Map. The `@wtc/auth` barrel (`packages/auth/src/index.ts`) re-exports `password.ts`
which imports `@node-rs/argon2` — DO NOT import `@wtc/auth` or any barrel that transitively imports
Node-native bindings in `middleware.ts`. The safe imports from `@wtc/auth` for middleware are
`packages/auth/src/session.ts` and `packages/auth/src/csrf.ts` only if imported directly (not via
the barrel). The safest approach: implement the IP extraction and rate-limit Map entirely inline in
`middleware.ts` with no imports from `@wtc/auth`.

**In-process sliding-window store (Edge-compatible, no Node native):**

```typescript
// Top-level module scope — survives across requests in the same Edge worker instance.
// This is intentionally in-memory: a serverless environment with multiple instances still
// benefits (each instance limits its own 10/min burst). For multi-instance correctness,
// a Vercel KV or Upstash Redis store would be needed — acceptable debt for MVP.
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { limited: false, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { limited: true, retryAfterSeconds };
  }
  return { limited: false, retryAfterSeconds: 0 };
}
```

**429 response (no account-enumeration):**

```typescript
return new NextResponse(
  JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Please try again later.' }),
  {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
    },
  },
);
```

The 429 body MUST NOT reveal whether the account exists, the current count, or whether the lockout
is per-account or per-IP. The message above is correct. The `Retry-After` value is the integer
seconds remaining in the current window.

---

### F-PG11-04 — SPEC — redact.ts value-pattern guard (F-07 resolution)

**Severity:** Spec/Implementation guidance

**Current state** (`packages/audit/src/redact.ts` line 46-54): `redact()` only redacts by field
name (`isSecretKey(k)`). String values with sensitive content but benign-looking key names pass
through unredacted. The prior audit handoff (F-07) identifies the gap.

**Proposed `isSecretValue(v: unknown): boolean` function:**

```typescript
// Matches string values that are likely secret material regardless of field name.
// Applied only to STRING values — does not affect non-string types.
// Order matters: check cheapest/most-specific patterns first.
const PHC_PREFIX = /^\$(argon2id|argon2i|argon2d|2a|2b|2y)\$/;
const BEARER_PREFIX = /^(Bearer |Basic )/;
const LONG_HEX = /^[0-9a-f]{64,}$/i;

function isSecretValue(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  if (v.length === 0) return false;
  // PHC strings: $argon2id$..., $2b$... (bcrypt), etc.
  if (PHC_PREFIX.test(v)) return true;
  // HTTP auth header values: Bearer <token>, Basic <base64>
  if (BEARER_PREFIX.test(v)) return true;
  // 64+ character lowercase/uppercase hex strings (session token, SHA-256 hash, AES key hex)
  if (LONG_HEX.test(v)) return true;
  return false;
}
```

**Integration into `redact()`:**

In the object branch of `redact()`, change the value assignment to:

```typescript
// Current (field-name only):
out[k] = isSecretKey(k) ? REDACTED : redact(v, depth + 1);

// New (field-name OR value-pattern):
out[k] = isSecretKey(k) ? REDACTED : (isSecretValue(v) ? REDACTED : redact(v, depth + 1));
```

For the non-object branch (scalar values passed directly to `redact()`), add a check before the
existing early-return:

```typescript
// At the top of redact(), after the depth check and before the null/non-object check:
if (typeof value === 'string' && isSecretValue(value)) return REDACTED;
```

**False-positive analysis:**

| Pattern | Example that SHOULD be redacted | Example that SHOULD NOT be redacted |
|---|---|---|
| PHC prefix | `$argon2id$v=19$m=65536,t=3,p=2$...` | `$HOME` (does not match PHC_PREFIX — `$H` is not a valid argon2 variant) |
| Bearer prefix | `Bearer eyJhbGc...` | `Bearer` alone with no space (BEARER_PREFIX requires the space) |
| 64+ hex | 64-char session token hex | 63-char hex (just under threshold — would NOT be redacted; acceptable) |

**Specific false-positive risks to confirm acceptable:**

1. `LONG_HEX` threshold of 64: The session token is exactly 64 hex chars (`randomBytes(32).toString('hex')`).
   The SHA-256 hash stored in the DB is also 64 hex chars. Both SHOULD be redacted. A UUID (32 hex
   chars, no dashes after removal) would not trigger this regex because it is only 32 chars. A short
   commit hash (7-40 chars) would not trigger. The threshold of 64 is intentionally chosen to match
   the session token length exactly. Accept this threshold.

2. `LONG_HEX` case-insensitivity: The regex uses `/i` flag. This means `0-9A-F` uppercase hex
   strings (e.g. from some exchange APIs) are also caught. This is correct behaviour — uppercase
   hex secrets should also be redacted.

3. PHC prefix: `$HOME` and `$PATH` do not match because the regex requires `$(argon2id|...|2a|2b|2y)$`
   — both characters on either side of the variant name must be `$`. Shell env var references are safe.

4. Bearer prefix: Legitimate log fields like `message: "Bearer fails"` would NOT trigger — the
   regex tests whether the value STARTS with `Bearer ` (capital B, followed by space), not whether
   it CONTAINS the word. A log message containing "Bearer fails" starts with `B`, but the regex
   `^Bearer ` requires the space after Bearer. This is correct.

**Short-hex false-negative (accept):**
A 32-char hex string (e.g. a short API key) would NOT be caught by the value pattern — but it
WOULD be caught if its field name contains any of the SECRET_HINTS (e.g. `apiKey`, `secret`).
The value-pattern guard is defense-in-depth; field-name redaction remains the primary gate.

**Test requirements (go in `packages/audit/src/redact.test.ts`):**

```
RP-01: isSecretValue('$argon2id$v=19$m=65536,...') → true
RP-02: isSecretValue('$2b$12$...') → true (bcrypt)
RP-03: isSecretValue('Bearer eyJhbGciOiJFUzI1NiJ9...') → true
RP-04: isSecretValue('Basic dXNlcjpwYXNz') → true
RP-05: isSecretValue('a'.repeat(64)) → true (64 hex-like chars — but must be hex chars)
RP-06: isSecretValue('0'.repeat(64)) → true (64 zeros — valid hex)
RP-07: isSecretValue('not a secret') → false
RP-08: isSecretValue('a'.repeat(63)) → false (below 64-char threshold)
RP-09: isSecretValue(42) → false (non-string)
RP-10: isSecretValue('$HOME') → false (not a PHC variant)
RP-11: redact({ message: '$argon2id$v=19$...' }) → { message: '[REDACTED]' }
       (field name 'message' is NOT in SECRET_HINTS — caught only by value pattern)
RP-12: redact({ token: 'hello' }) → { token: '[REDACTED]' }
       (field name 'token' IS in SECRET_HINTS — caught by field name, not value pattern)
RP-13: redact({ count: 42 }) → { count: 42 } (numeric, unaffected)
RP-14: redact('$argon2id$v=19$...') → '[REDACTED]' (scalar string directly passed to redact)
```

---

### F-PG11-05 — SPEC — Billing webhook exclusion requirements

**Severity:** Spec/Implementation guidance

**Confirmed exclusion requirements** (`apps/web/src/app/api/billing/webhook/route.ts` line 1-23,
line 25 `export const runtime = 'nodejs'`):

The billing webhook route has `runtime = 'nodejs'` — it DOES NOT run in the Edge runtime. The
Next.js middleware does run in the Edge runtime. This means middleware CANNOT import the billing
webhook module directly, but it CAN and SHOULD skip processing for the webhook path.

**Three invariants that must be preserved by middleware exclusion:**

1. **Raw body intact:** The webhook handler reads `req.text()` before HMAC verification. Any
   middleware that reads or transforms the request body (e.g. JSON parsing) would consume it. The
   current middleware must NOT read the request body at all — it only inspects headers and the URL.
   This is already satisfied by the header-injection + rate-limit design (no body reads).

2. **No CSRF token check:** The webhook is CSRF-exempt (Stripe cannot supply a CSRF token). The
   middleware must NOT apply CSRF validation to `/api/billing/webhook`. Since the planned middleware
   does not implement CSRF checking (CSRF is done in server actions via `assertCsrf`), this is
   naturally satisfied.

3. **No rate-limiting:** The webhook path must NOT be rate-limited. Stripe has multiple delivery
   IP addresses and can retry; rate-limiting would cause legitimate retries to be dropped with 429.

**Implementation — matcher config (middleware.ts `config` export):**

```typescript
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/billing/webhook (CSRF-exempt, raw body, no rate-limit)
     * - .well-known/* (JWKS endpoint, static-like)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/billing/webhook|.well-known).*)',
  ],
};
```

Alternatively, implement the exclusion as an early return inside the middleware function body:

```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Billing webhook: skip ALL middleware processing. Raw body, HMAC-only auth, no CSRF, no rate-limit.
  if (pathname === '/api/billing/webhook') {
    return NextResponse.next();
  }
  // ... rest of middleware
}
```

Both approaches work; the early-return inside the function is more readable and explicit.

**Test invariants that must keep passing:**

- `tests/integration/billing-webhook.test.ts`: BW-001..004 — these test `applyStripeEvent`,
  `createStripeProvider`, and `signWebhook` at the package layer. They do NOT invoke the route
  handler and are NOT affected by middleware at all. They will continue to pass.
- `tests/integration/billing-webhook-phase24.test.ts`: BW-005..008 — same reasoning. Package-layer
  tests only.
- Neither test file exercises the route handler path (Vitest excludes `apps/web/**`; the route handler
  is only tested via the dev server if e2e covers it). No e2e test currently POSTs to `/api/billing/webhook`.
- Adding middleware will not affect these tests as long as `/api/billing/webhook` is excluded.

**Additional invariant:** The billing webhook route sets `runtime = 'nodejs'`. The middleware must
set `runtime` to `'edge'` (or omit it, defaulting to Edge). If middleware accidentally used `'nodejs'`
runtime, it would lose the Edge pre-processing benefit and conflict with Next.js middleware semantics.

---

### F-PG11-06 — SCOPE — F-03 (structured logger packages/auth/src/logger.ts): PG11 vs deferrable

**Severity:** Scope decision

**Context:** F-03 from the prior audit: `packages/auth/src/logger.ts` does not exist. The
`SECRET_VAULT_DESIGN.md` documents it as PLANNED. No structured logger with redaction exists
outside the audit path.

**Assessment for PG11:**

PG11's core deliverable is `middleware.ts` (rate-limiting + headers) and the `redact.ts` value-pattern
guard. The structured logger is a separate file in `packages/auth/` and does not block the middleware
implementation or the redact guard. Its primary risk (R-05 from prior audit) is that `console.log`
calls in dev mode could accidentally log secrets — this is a process/discipline risk, not a runtime
attack vector at the middleware layer.

**Arguments for including in PG11:**
- Small scope (~30 lines of wrapper code + tests).
- Naturally pairs with the redact guard (uses the same SECRET_HINTS blocklist).
- Closes a documented gap before any staging deployment.

**Arguments for deferring:**
- PG11 already has two clear deliverables (middleware.ts + redact guard) that are production blockers.
- The logger does not block any other PG11 item.
- No existing code calls a logger — adding the logger now but not wiring it into call sites produces
  no security improvement until call sites are migrated.
- The audit-path redaction via `redact()` (enhanced by the value-pattern guard) already protects the
  most critical surface (audit log writes).

**DECISION: Defer F-03 to PG12 (CI/deployment readiness).**

Rationale: The redact guard (highest-leverage item) is in PG11 and covers the audit path. The
structured logger's value is in preventing accidental console.log leaks in future developer calls —
this is best addressed alongside the CI secret:scan improvements (PG12 F-08) and as part of a
deliberate call-site migration sweep. Implementing the logger in PG11 without wiring it into any
call site produces dead code that inflates the PG11 diff without reducing any current risk.

Tag it as: **Target: PG12, next phase after PG11 closes.**

---

## Decisions

1. **Dev vs prod CSP split:** prod uses nonce-only `script-src`; dev uses `'unsafe-inline' 'unsafe-eval'`
   to allow HMR. No nonce forwarding in dev. `connect-src` adds `wss://localhost:*` in dev.
   HSTS is gated on `NODE_ENV === 'production'`. This preserves all 34 e2e tests.

2. **Rate-limit targets are `/login` and `/register` (POST), not `/api/auth/*`:** Auth uses server
   actions. The middleware intercepts `POST /login` and `POST /register`. The spec table
   (SECURITY_MODEL.md §4) uses `/api/auth/login` as a logical name, not a literal route. This is
   now confirmed by reading `apps/web/src/app/(auth)/actions.ts`.

3. **In-process Map for rate-limit store:** Edge-compatible. Acceptable for MVP single-instance.
   Multi-instance correctness (Vercel KV / Upstash) is tracked as a TARGET for PG12 deployment
   readiness. Document the limitation in the middleware file header.

4. **`isSecretValue` 64-char hex threshold:** matches the session token length exactly (32 bytes →
   64 hex chars). Chosen deliberately. Short hex values (UUIDs, commit hashes) are not caught.
   This is acceptable — field-name redaction remains the primary gate.

5. **F-03 (structured logger) deferred to PG12.** See F-PG11-06 reasoning.

6. **Billing webhook exclusion via early return in middleware function body** (not matcher config
   exclusion alone). Both approaches work; early return is more readable and explicit. Using both
   (matcher exclusion + early return) provides belt-and-suspenders — the matcher ensures the
   middleware never runs for the webhook path even if the early-return is accidentally removed.

---

## Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R-PG11-01 | In-process rate-limit Map is instance-local. Multiple Edge worker instances (Vercel production) will each have independent counters — an attacker can effectively multiply the limit by the number of instances. | MEDIUM | Acceptable at MVP. Document clearly. Target Upstash/KV in PG12. |
| R-PG11-02 | Nonce forwarding (middleware → layout) only works in prod. In dev, the layout must NOT attempt to read the nonce header or it will embed `undefined` in script tags, causing HMR breakage. The layout must guard: `const nonce = isProd ? (await headers()).get('x-nonce') ?? undefined : undefined`. | HIGH | Must be spec'd clearly for the implementer. |
| R-PG11-03 | The matcher exclusion pattern for `api/billing/webhook` must exactly match the pathname. If the route moves or gains a trailing slash, the exclusion could break. The early-return guard inside the function is more robust. | LOW | Use both matcher and early-return. |
| R-PG11-04 | `isSecretValue` applied to values that are themselves objects or arrays would do nothing (the typeof check guards this). But redact() recurses into nested objects — value-pattern checking is only applied to string leaf values. A PHC string nested inside an array inside an object IS caught because redact() recurses, hits the string leaf, and calls isSecretValue. | LOW | Confirmed correct by the existing recursion design of redact(). |
| R-PG11-05 | LONG_HEX regex uses `/i` flag — a 64-char uppercase hex string matches. This could false-positive on certain data URLs or identifiers. However, legitimate 64-char uppercase hex identifiers with benign field names are extremely rare in the audit log domain. Accept. | LOW | Accept; document in code. |

---

## Verification/tests

All findings are based on static inspection. No tests were run.

**Tests that MUST be written before PG11 ships (gate: npm test must stay green):**

### For `packages/audit/src/redact.test.ts` (new file — runs under Vitest automatically):
Cases RP-01 through RP-14 as specified in F-PG11-04 above.

### For the rate-limit logic in middleware:
Since `apps/web/**` is excluded from Vitest, the rate-limit logic must be extractable to a testable
module. **Recommended approach:** extract `checkRateLimit` and `getClientIp` into
`packages/auth/src/rate-limit.ts` (pure functions, no imports, no Node native). Then test in
`packages/auth/src/rate-limit.test.ts`:

```
RL-01: first request from an IP → not limited
RL-02: 10th request from same IP within window → not limited
RL-03: 11th request from same IP within window → limited, retryAfterSeconds > 0
RL-04: request after window expiry → count resets, not limited
RL-05: different IPs do not share counters
RL-06: getClientIp with x-forwarded-for 'a.b.c.d, e.f.g.h' → returns 'a.b.c.d' (first only)
RL-07: getClientIp with no XFF, x-real-ip present → returns x-real-ip value
RL-08: getClientIp with neither header → returns 'unknown'
```

### For middleware headers (Playwright e2e — new test file `tests/e2e/security-headers.spec.ts`):
```
SH-01: GET / returns X-Content-Type-Options: nosniff
SH-02: GET / returns X-Frame-Options: DENY
SH-03: GET / returns Content-Security-Policy header (contains "frame-ancestors 'none'")
SH-04: GET /api/billing/webhook (POST) does NOT return 429 on first request
SH-05: POST /login 11 times from same IP within 60s → 11th returns 429 with Retry-After header
```

Note: SH-05 requires the e2e test to be able to make raw fetch() calls (not via page navigation).
Playwright supports `page.evaluate(() => fetch(...))` or direct fetch from the test runner via
`request.post(...)` using the `APIRequestContext`.

**Gates (unchanged from Phase 2.4 baseline):**
- `npm test` — must stay at 238 passed / 5 skipped (or higher with new tests added)
- `npm run e2e` — must stay at 34/34 (new SH tests add to this count)
- `npm run secret:scan` — PASS
- `npm run governance:check` — PASS

---

## Next actions

Ordered for the PG11 implementer:

1. **Create `packages/auth/src/rate-limit.ts`** — pure `checkRateLimit(ip, store, now)` + `getClientIp(headers)` functions. No imports. Write `packages/auth/src/rate-limit.test.ts` with RL-01..RL-08. Run `npm test` to confirm green.

2. **Add `isSecretValue` to `packages/audit/src/redact.ts`** — PHC_PREFIX, BEARER_PREFIX, LONG_HEX regexes. Integrate into `redact()` for both scalar and object-value paths. Write `packages/audit/src/redact.test.ts` with RP-01..RP-14. Run `npm test`.

3. **Create `apps/web/src/middleware.ts`** using the exact specs in F-PG11-01 through F-PG11-05. Key points:
   - `export const runtime = 'edge'` (or omit; default is Edge)
   - Early return for `/api/billing/webhook`
   - Import rate-limit logic from `packages/auth/src/rate-limit.ts` (safe; no Node native)
   - DO NOT import the `@wtc/auth` barrel (transitively imports @node-rs/argon2)
   - Gate HSTS on `NODE_ENV === 'production'`
   - Gate nonce forwarding on `NODE_ENV === 'production'`
   - Dev CSP includes `'unsafe-inline' 'unsafe-eval'` and `wss://localhost:*`
   - Add a top-of-file comment: "In-process rate-limit Map is instance-local. For multi-instance deployments, replace Map with Upstash Redis or Vercel KV."

4. **Update `apps/web/src/app/layout.tsx`** (or the root layout component): read `x-nonce` from headers only in production; pass nonce to `<Script>` tags. If using `next/script`, pass `nonce={nonce}`. Guard against reading the header in dev.

5. **Write `tests/e2e/security-headers.spec.ts`** with SH-01..SH-05 using Playwright's `APIRequestContext`. Run `npm run e2e` to confirm 34+N/34+N green.

6. **Do NOT create `packages/auth/src/logger.ts` in PG11.** Defer to PG12.

7. **Update `docs/SECURITY_MODEL.md` §4** to replace `/api/auth/login` and `/api/auth/register` with the correct server-action target paths (`POST /login`, `POST /register` via next-action). This is a doc correction, not a security change.
