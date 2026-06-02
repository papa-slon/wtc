# ecosystem-platform-architect handoff

_2026-05-30, epoch 20260530-1815. Read-only architecture audit for Phase Group 11 (PG11)._
_Role: ecosystem-platform-architect — Edge-runtime, module-boundary, and file-placement architecture._

## Scope

Architecture audit for the PG11 middleware.ts implementation:
1. Confirm @wtc/auth barrel pulls @node-rs/argon2 (Edge-runtime unsafe).
2. Recommend placement for rate-limit and security-headers logic (Option A: @wtc/auth subpaths vs
   Option B: app-local). Verify TypeScript moduleResolution + transpilePackages compatibility.
3. Specify the exact middleware config.matcher.
4. Audit nonce-CSP + dynamic rendering implications for the 33/33 static pages build claim.
5. Confirm no single-writer spine conflict.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260530-1625-ecosystem-security-auditor.md`
- `docs/handoffs/20260530-1625-phase-2-5-roadmap-foundation-truth.md`
- `docs/EXECUTION_PLAN_MASTER.md`
- `docs/SECURITY_MODEL.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `AGENTS.md`
- `packages/auth/src/index.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/package.json`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `tsconfig.base.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/billing-webhook.test.ts`
- Glob output: `apps/web/src/**/*.tsx` (all page files, confirmed no force-static/force-dynamic
  except `api/billing/webhook/route.ts` and `.well-known/axioma-jwks.json/route.ts`)
- Glob output: `packages/auth/src/**/*.ts`

## Files changed

None — read-only audit

## Findings

### F-01 — CONFIRMED (from prior audit) — @wtc/auth barrel is Edge-unsafe via @node-rs/argon2

**Severity:** CRITICAL (implementation prerequisite)

**Evidence:**
- `packages/auth/src/index.ts:17` — `export { hashPassword, verifyPassword } from './password.ts'`
- `packages/auth/src/password.ts:5` — `import { hash, verify } from '@node-rs/argon2'`
- `packages/auth/package.json:14` — `"@node-rs/argon2": "^2.0.2"` listed under `dependencies`
- `packages/auth/package.json:8-10` — `"exports": { ".": "./src/index.ts" }` — single dot entry only

The barrel `@wtc/auth` unconditionally imports `password.ts` which imports `@node-rs/argon2`. This
is a native Node.js binding (`node-rs` = Rust via N-API). It cannot be bundled for the Edge runtime.
Any `import ... from '@wtc/auth'` in `apps/web/src/middleware.ts` would cause a build/runtime error
under `export const runtime = 'edge'` or in the default middleware Edge runtime.

The other exports in the barrel — `session.ts` (uses `node:crypto`), `csrf.ts` (uses `node:crypto`),
`rbac.ts` (pure TypeScript) — are individually Edge-compatible. `node:crypto` IS available in the
Next.js middleware Edge runtime. The contamination is exclusively through `password.ts`.

**Recommendation:** Do not import the `@wtc/auth` barrel in middleware.ts. Rate-limit and
security-headers logic must be provided via a separate path that does NOT transitively reach
`password.ts`. See F-02 for the placement decision.

---

### F-02 — ARCHITECTURAL DECISION — Module placement for rate-limit and security-headers

**Severity:** DECISION REQUIRED (blocks PG11 implementation)

**Option A: New subpath exports in packages/auth**

Create `packages/auth/src/rate-limit.ts` and `packages/auth/src/security-headers.ts` (pure,
zero Node-native deps), with co-located `.test.ts` files. Add subpath exports to
`packages/auth/package.json`:

```json
"exports": {
  ".": "./src/index.ts",
  "./rate-limit": "./src/rate-limit.ts",
  "./security-headers": "./src/security-headers.ts"
}
```

Middleware then imports:
```typescript
import { checkRateLimit } from '@wtc/auth/rate-limit';
import { buildSecurityHeaders } from '@wtc/auth/security-headers';
```

**TypeScript compatibility analysis (Option A):**

`tsconfig.base.json:7` — `"moduleResolution": "Bundler"`. With Bundler resolution, TypeScript
honors the `exports` map from `package.json`. HOWEVER, `tsconfig.base.json:28` has only:
```
"@wtc/auth": ["packages/auth/src/index.ts"]
```
There is NO path entry for `@wtc/auth/rate-limit` or `@wtc/auth/security-headers`. This means
TypeScript (compiler paths resolution) will NOT resolve these subpath imports at typecheck time for
the root tsconfig. The `apps/web/tsconfig.json` also does not extend or override the paths map.

To make the subpath imports typecheck, the implementer would need to add entries to `tsconfig.base.json`:
```
"@wtc/auth/rate-limit": ["packages/auth/src/rate-limit.ts"],
"@wtc/auth/security-headers": ["packages/auth/src/security-headers.ts"]
```

`tsconfig.base.json` is a **serial-spine file** (EXECUTION_PLAN_MASTER.md section 1, under
`packages/auth/src/rbac.ts`, `packages/config/src/env.ts` "serialized"). Editing it requires
care. Adding two path entries is low-risk but is a spine touch.

`apps/web/next.config.ts` lists `'@wtc/auth'` under `transpilePackages` at line 12. Webpack's
`transpilePackages` transpilation covers the whole package directory. At bundle time, Next.js/Webpack
will resolve subpath imports via the `package.json` exports map (Bundler mode resolution). The
`transpilePackages` mechanism does NOT require explicit path entries in tsconfig for runtime — it
uses the package exports. But typecheck (`tsc`) requires the paths entries.

Summary of Option A friction:
- Requires tsconfig.base.json path additions (spine touch, low risk but serialized)
- Requires package.json exports map extension (fine, not a spine file)
- Tests land in `packages/auth/src/*.test.ts` — vitest.config.ts includes `packages/**/*.test.ts`
  so they are discovered automatically (no config change needed)
- The package stays cohesive under the `@wtc/auth` namespace

**Option B: App-local pure modules at apps/web/src/lib/**

Create `apps/web/src/lib/rate-limit.ts` and `apps/web/src/lib/security-headers.ts` (pure, no
Node-native imports). Middleware imports them via relative or `@/*` alias.

Tests for these files would need to live in `tests/integration/` (relative imports) because
`vitest.config.ts:8` excludes `apps/web/**`. The test file would use relative paths like:
```typescript
import { checkRateLimit } from '../../apps/web/src/lib/rate-limit.ts';
```

AGENTS.md hard rule (line 78): "No one-file prototype — use `apps/*` + `packages/*`; **logic in
packages, not React files**." App-local lib files are explicitly contrary to this architectural
mandate when the logic is pure domain logic (not React-specific).

Additionally, the integration test relative import path is verbose and fragile. The vitest
`exclude: ['apps/web/**']` means the tests cannot be co-located with the implementation.

**RECOMMENDATION: Option A.**

Reasons:
1. AGENTS.md mandates logic in packages, not app directories. Rate-limiting and security headers
   are pure infrastructure logic with zero React dependency — they belong in packages.
2. Vitest auto-discovers `packages/**/*.test.ts`, so co-located tests require zero config change
   (vs Option B's cross-tree relative import ergonomics).
3. The subpath approach correctly isolates the argon2 contamination — each subpath import is
   independent. Only the barrel (`.`) pulls argon2; `./rate-limit` and `./security-headers` would
   have zero native-binding imports.
4. The only additional friction is two path entries in `tsconfig.base.json` — a small, low-risk
   spine touch.
5. It keeps all auth-layer modules under `@wtc/auth`, consistent with the existing namespace.

**Implementation note for Option A:** The new modules MUST have zero imports from the barrel
`./index.ts` or from `./password.ts`. If they import from `./session.ts` or `./csrf.ts` for
token helpers, those are safe (node:crypto is Edge-compatible). Verify any new import chain does
not transitively reach `@node-rs/argon2` before shipping.

---

### F-03 — ARCHITECTURE — Exact middleware config.matcher specification

**Severity:** GUIDANCE (required for correct implementation)

The matcher must:
- Cover all page routes (for security headers)
- Cover server action POST paths (for rate-limiting login/register)
- Exclude Next.js internals: `_next/static`, `_next/image`
- Exclude static files: `favicon.ico`, and files with extensions (images, fonts, etc.)
- Exclude `/api/billing/webhook` (CSRF-exempt raw body route; see billing webhook comment at
  `apps/web/src/app/api/billing/webhook/route.ts:7-8`)
- Exclude `.well-known/` (JWKS endpoint, no rate-limit needed)

**Recommended matcher:**

```typescript
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static (static files)
     *   - _next/image (image optimization)
     *   - favicon.ico
     *   - Files with extensions (images, fonts, docs: .svg, .png, .jpg, .ico, .css, .js)
     *   - /api/billing/webhook (CSRF-exempt raw-body Stripe receiver)
     *   - /.well-known/ (JWKS + any future well-known paths)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|\\.well-known|api/billing/webhook|[^/]+\\.[^/]+$).*)',
  ],
};
```

**Rationale:**
- The negative lookahead `[^/]+\\.[^/]+$` excludes any path ending in `filename.ext` at the last
  segment, which covers static assets in the `public/` directory served at root.
- `/api/billing/webhook` is excluded explicitly and completely — no rate-limiting, no CSRF header
  injection. The route already sets `export const runtime = 'nodejs'` and `export const dynamic =
  'force-dynamic'` (`route.ts:25-26`), so it never enters the Edge middleware path anyway for the
  runtime, but the matcher exclusion is the correct defense-in-depth belt.
- `/.well-known/` is excluded because the JWKS endpoint (`apps/web/src/app/.well-known/axioma-jwks.json/route.ts`)
  already handles its own headers and sets `force-dynamic`.
- Auth server actions POST to the page path (`/login`, `/register`) with a `next-action` header.
  These paths are covered by the matcher (they have no extension, are not in _next/, are not
  billing/webhook). The middleware correctly intercepts these for rate-limiting. Rate-limit logic
  should check for the `next-action` header OR match the path AND method to avoid rate-limiting
  GET /login page renders along with POST action submissions.

**Auth path clarification (confirmed):** `apps/web/src/app/(auth)/actions.ts` uses Next.js server
actions. `loginAction` is referenced as `<form action={loginAction}>` at `login/page.tsx:19`.
Server actions POST to the page URL (e.g., `/login`) with a `next-action: ...` header. There are
NO `/api/auth/login` or `/api/auth/register` route handlers. The rate-limiter must key on
`/login` + `next-action` header presence (or just `/login` + POST method) not on
`/api/auth/login`.

---

### F-04 — ARCHITECTURE — Nonce CSP and dynamic rendering implications for the build count claim

**Severity:** MEDIUM (documentation accuracy + test stability risk)

**Evidence of the claim:**
- `docs/STATUS.md:20` — `build ✓ (33/33 pages)` for Phase 2.5
- `docs/handoffs/20260530-1625-phase-2-5-roadmap-foundation-truth.md:95` — `PASS — compiled; 33/33 static pages, no errors`

**The nonce-CSP problem:**

`docs/SECURITY_MODEL.md:285` specifies: "`nonce-{SERVER_NONCE}` is a per-request random value
injected into Next.js middleware and stamped onto all `<script>` tags."

If middleware generates a nonce and sets it in a `Content-Security-Policy` response header, AND
if the nonce value needs to be forwarded to the React server component tree for stamping on
`<script>` tags, the canonical Next.js pattern forwards it as a request header from middleware:

```typescript
requestHeaders.set('x-nonce', nonce);
return NextResponse.next({ request: { headers: requestHeaders } });
```

The page/layout then reads it with `headers().get('x-nonce')`. Reading from the `headers()` function
causes Next.js to opt the route into **dynamic rendering**. A page that was previously statically
prerendered at build time becomes server-rendered per-request.

**Impact on "33/33 pages":**

Currently (Phase 2.5), 0 of the 33 pages read from `headers()` in layout or page — confirmed by
Grep showing no `force-dynamic` except the two API routes. The 33/33 static count reflects
pages that Next.js can prerender at build time.

If middleware forwards a nonce via request headers AND `apps/web/src/app/layout.tsx` (the root
layout) reads it, then ALL 33 pages become dynamically rendered. The `next build` output would
show them as `λ` (server) instead of `○` (static) or `●` (SSG). This is NOT a build failure —
`next build` still succeeds — but:
1. The claim "33/33 static pages" in STATUS.md becomes inaccurate post-PG11
2. E2e tests (34/34) do not assert on static vs dynamic rendering mode, so they still pass
3. There is a mild performance regression (no static prerender for public pages like `/`, `/pricing`)

**Recommended approach to preserve build correctness:**

Option 1 (Simplest — recommended for PG11): Set the CSP header in middleware **without** forwarding
the nonce to page components. Use `'unsafe-inline'` for scripts in the initial implementation (as
`SECURITY_MODEL.md:288` already concedes `style-src 'unsafe-inline'` as a pragmatic concession)
and defer full nonce-stamping to a later phase. The header still provides frame-ancestors, HSTS,
X-Content-Type-Options, etc. Set a static CSP without `nonce-...` in the script-src directive in
dev; use a per-request nonce in the response header only (not forwarded as a request header) so
page layouts are never forced dynamic.

Option 2 (Full nonce): Forward nonce via request header, accept that all 33 pages become dynamic.
Update STATUS.md's "33/33 static pages" wording to "53 routes compile cleanly" (the Phase 2.4
accurate claim). This is architecturally clean but needs the doc update to avoid a false claim.

**The `SECURITY_MODEL.md` spec currently calls for nonce-based CSP. The PG11 implementer must
choose and document this decision explicitly.** The safe default for PG11 is Option 1 — apply the
CSP as a response header only (no forwarding to layout), with a static script-src for dev and a
nonce-only approach restricted to production-only forwarding. This avoids breaking any static pages.

**Concrete guidance for dev vs prod CSP:**

In development (NODE_ENV !== 'production'), emit a permissive `script-src 'self' 'unsafe-inline'
'unsafe-eval'` to preserve HMR (React refresh uses eval). In production, emit the nonce-based CSP.
If the nonce is only set as a response header and not forwarded as a request header, pages remain
static-eligible and 34/34 e2e still passes (the dev server does not run with the nonce constraint
anyway since NODE_ENV=development).

**E2e risk:** The 34 tests run against NODE_ENV=development (confirmed: `playwright.config.ts:4`
comment; `reuseExistingServer` for local). A strict nonce-only CSP in dev would break HMR and
potentially Playwright's script injection for tracing. The dev-permissive path is mandatory.

---

### F-05 — CONFIRMED — No single-writer spine conflict for middleware.ts and redact.ts

**Severity:** INFORMATIONAL (confirm-only)

**Evidence:**
- `docs/EXECUTION_PLAN_MASTER.md:25` — `apps/web/src/middleware.ts` is listed as greenfield, owned
  by `ecosystem-security-auditor`/PG11 only. No other agent is assigned this file.
- `docs/EXECUTION_PLAN_MASTER.md:24` — `packages/audit/src/{audit,redact}.ts` are listed as
  serialized under "security/db". The PG11 redact.ts value-guard addition is the only pending
  change for this session. No concurrent writer is documented.
- `apps/web/src/middleware.ts` — confirmed absent (Glob returns no match, prior security-auditor
  handoff at `20260530-1625-ecosystem-security-auditor.md:21` confirms "file absent").

There is no spine conflict. PG11 owns both `middleware.ts` (greenfield) and the redact.ts
value-pattern addition (serialized, no other writer pending).

---

## Decisions

1. **@wtc/auth barrel is confirmed Edge-unsafe** via `@node-rs/argon2` chain. This is the binding
   constraint for all module placement decisions.

2. **Option A (packages/auth subpaths) is the correct architectural choice** for rate-limit and
   security-headers logic. AGENTS.md mandate + vitest discoverability + namespace coherence all
   favor it over app-local files.

3. **Two tsconfig.base.json path entries are required** for Option A to typecheck. This is a
   low-risk spine touch and should be treated as a serialized edit owned by the PG11 implementer.

4. **The nonce-CSP forwarding decision is the highest-risk implementation detail.** The safe default
   for PG11 is to set the CSP as a response header only, without forwarding the nonce as a request
   header to layout components. This keeps all 33 pages static-eligible and avoids forced dynamic
   rendering globally.

5. **The build count claim must be updated** in STATUS.md and NEXT_ACTIONS.md after PG11 lands,
   regardless of whether nonce forwarding is adopted, because middleware.ts affects the build output
   description. If nonce is forwarded, "33/33 static pages" becomes inaccurate. If it is not, the
   claim remains valid.

## Risks

| ID | Risk | Severity | Detail |
|----|------|----------|--------|
| R-01 | Option A subpath import is not added to tsconfig.base.json paths — typecheck fails | HIGH | Implementer must add 2 path entries to tsconfig.base.json before running `npm run typecheck` |
| R-02 | New rate-limit.ts or security-headers.ts in packages/auth accidentally imports password.ts | CRITICAL | Transitively re-introduces argon2 into middleware; must be verified at code review |
| R-03 | Nonce forwarded as request header → all pages forced dynamic → "33/33 static" claim becomes false | MEDIUM | Use response-header-only nonce for PG11; update docs if forwarding is chosen later |
| R-04 | Middleware rate-limiter keys on `/api/auth/login` which does not exist → no rate-limit applied | HIGH | Rate-limiter must key on `/login` + POST + `next-action` header presence, NOT on a nonexistent API path |
| R-05 | /api/billing/webhook not excluded from middleware matcher → raw body consumed by NextResponse processing before route handler reads it | MEDIUM | Explicit exclusion in matcher is the correct defense; confirmed by route.ts comment line 7-8 |
| R-06 | Dev CSP includes nonce-only script-src → HMR breaks → 34/34 e2e fails | HIGH | Dev (NODE_ENV !== 'production') MUST use 'unsafe-inline'+'unsafe-eval' in script-src |

## Verification/tests

All findings are based on static code and documentation inspection. No code was executed.

Tests that MUST accompany the PG11 implementation (not run in this audit):

**packages/auth/src/rate-limit.test.ts** (co-located, auto-discovered by vitest):
- Sliding-window counter: first N requests below threshold return `{ allowed: true }`
- Request N+1 within window returns `{ allowed: false, retryAfterSeconds: N }`
- Window expiry resets counter
- Different IPs do not share counters
- The module imports zero Node-native bindings (import chain check via manual review)

**packages/auth/src/security-headers.test.ts** (co-located, auto-discovered):
- `buildSecurityHeaders(opts)` returns all required headers: CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP
- Dev mode (isProd=false) returns permissive script-src ('unsafe-inline'+'unsafe-eval'), no HSTS
- Prod mode (isProd=true) returns strict CSP with nonce, HSTS max-age=63072000+includeSubDomains+preload

**packages/audit/src/redact.test.ts** (must be created — no file found at this path):
- PHC string `$argon2id$v=19$...` as a value is redacted regardless of key name
- `Bearer abc123...` string as a value is redacted
- 64+ char hex string as a value is redacted
- Normal string values pass through unredacted
- Existing key-name blocklist tests remain green

**E2e gate (34/34 must stay green):** After PG11 middleware.ts lands, re-run `npx playwright test`.
The dev server (NODE_ENV=development) must not apply HSTS or nonce-only CSP. Confirm no test
fails due to CSP blocking Playwright's script injection.

## Next actions

Ordered for the PG11 implementer:

1. Create `packages/auth/src/rate-limit.ts` — pure sliding-window rate-limiter (no imports from
   index.ts, no argon2, no Node-native bindings beyond the Web Crypto API or plain counters).
   Storage: in-memory Map with TTL expiry (sufficient for single-process; documented limitation).
   Exports: `checkRateLimit(ip: string, key: string, opts: RateLimitOpts): RateLimitResult`.

2. Create `packages/auth/src/security-headers.ts` — pure function returning a `Record<string,string>`
   of all headers from SECURITY_MODEL.md §6. Accepts `{ isProd: boolean, nonce?: string }`.

3. Create `packages/auth/src/rate-limit.test.ts` and `packages/auth/src/security-headers.test.ts`
   (co-located; auto-discovered by vitest).

4. Extend `packages/auth/package.json` exports map:
   ```json
   "./rate-limit": "./src/rate-limit.ts",
   "./security-headers": "./src/security-headers.ts"
   ```

5. Add two path entries to `tsconfig.base.json` (serialized, single-writer):
   ```json
   "@wtc/auth/rate-limit": ["packages/auth/src/rate-limit.ts"],
   "@wtc/auth/security-headers": ["packages/auth/src/security-headers.ts"]
   ```

6. Create `apps/web/src/middleware.ts` (greenfield, PG11-owned):
   - Import from `@wtc/auth/rate-limit` and `@wtc/auth/security-headers`
   - Do NOT import from `@wtc/auth` (the barrel)
   - Rate-limit: key on `${ip}:login` for `/login` + POST + `next-action` header; same for `/register`
   - Security headers: call `buildSecurityHeaders({ isProd: process.env.NODE_ENV === 'production' })`
   - Return 429 + `Retry-After` header on rate-limit breach; `x-wtc-rate-limited: 1` optional
   - Use the matcher from F-03 above

7. Add value-pattern guard to `packages/audit/src/redact.ts` (serialized, single-writer):
   - Add `isSecretValue(v: unknown): boolean` checking: `$argon2id$` prefix, `$2b$` prefix,
     `Bearer ` or `Basic ` prefix, 64+ char hex strings
   - Call in `redact()` for string values that pass the key-name check

8. After implementation, run full gates: `npm run typecheck`, `npm test` (must stay 241+ passed),
   `npm run build -w @wtc/web` (must compile; update static/dynamic page count in STATUS.md if
   changed), `npx playwright test` (must stay 34/34).

9. Update STATUS.md: if nonce forwarding is NOT adopted, confirm "33/33 pages" remains accurate;
   if it IS adopted, update the claim to "N routes compile cleanly" with the actual count.
