# Phase 2.6 / Phase Group 11 — Security middleware spine + redact value-guard (aggregate handoff)

_2026-05-30, epoch `20260530-1815`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **4 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run → operator-orchestrated
**serial** implementation (not a git repo, no worktrees, no parallel writers). **4 per-agent handoff files** at this
epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge / TradingView automation /
Axioma production call. **Not production-ready.** Second phase group executed in the operator's continuous program
(follows Phase 2.5 / PG1, epoch `20260530-1625`)._

## Scope

Execute **Phase Group 11 (Security / rate-limiting / headers)** — the serial-spine prerequisite for the new API routes
in PG4/PG5/PG6. Create the greenfield `apps/web/src/middleware.ts`: IP-keyed auth rate-limiting (429 + `Retry-After`) on
the **real** auth entry points + the full security-header suite (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/
Referrer-Policy/Permissions-Policy/COOP/CORP), with `/api/billing/webhook` excluded (raw body, CSRF-exempt, never
rate-limited). Plus the `redact.ts` value-pattern guard (PHC/Bearer/64-hex) flagged as F-07 by the Phase-2.5 security
auditor. Closes production blocker **B5** (CRITICAL) and the F-07 hardening item.

## Agents launched (4 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run, `wzt3rieb4`; all 4 returned, none left running):
1. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-1815-ecosystem-security-auditor.md) — exact header/CSP map, dev-vs-prod CSP split, rate-limit policy, redact value-guard spec, webhook exclusion, F-03 logger scope call.
2. `ecosystem-platform-architect` → [`…-ecosystem-platform-architect.md`](20260530-1815-ecosystem-platform-architect.md) — Edge-safety (argon2 barrel), Option-A subpath placement, exact matcher, nonce/dynamic-rendering implication, no spine conflict.
3. `ecosystem-backend-implementer` → [`…-ecosystem-backend-implementer.md`](20260530-1815-ecosystem-backend-implementer.md) — real auth entry points (server actions, no `/api/auth/*`), server-action POST detection, webhook test invariants, IP-extraction + e2e fallback risk.
4. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-1815-ecosystem-tests-runner.md) — unit-test matrix (rate-limit/headers/redact), the **explicit "do NOT add a 429 e2e burst"** ruling, the full gate sequence.

## Files changed

**New (greenfield):**
- `apps/web/src/middleware.ts` — Edge middleware: rate-limit auth POSTs + document-only security headers + webhook exclusion.
- `packages/auth/src/rate-limit.ts` — pure, dependency-free sliding-window limiter + `getClientIp` (Edge-safe; no barrel).
- `packages/auth/src/security-headers.ts` — pure `buildSecurityHeaders` + `buildContentSecurityPolicy` (env-aware).
- `packages/auth/src/rate-limit.test.ts` (14 cases) · `packages/auth/src/security-headers.test.ts` (21 cases) · `packages/audit/src/redact.test.ts` (18 cases — redaction had no co-located test before).
- `tests/e2e/security-headers.spec.ts` — asserts the header suite on `GET /` (×2 projects).

**Edited:**
- `packages/audit/src/redact.ts` — added `isSecretValue()` (PHC/bcrypt, `Bearer `/`Basic `, 64+-hex) applied to string values at any depth; `redact()` now redacts secret-looking VALUES, not just keys.
- `packages/audit/src/index.ts` — export `isSecretValue`.
- `packages/auth/package.json` — `exports` map: add `./rate-limit` + `./security-headers` subpaths (barrel `.` unchanged).
- `tsconfig.base.json` — add `@wtc/auth/rate-limit` + `@wtc/auth/security-headers` path aliases.
- `playwright.config.ts` — `retries: 2` (dev-only server-action recompilation race; see Risks).

## Findings → fixes

- **B5 / F-01 — `middleware.ts` absent (CRITICAL).** Created. **Rate-limit targets corrected to reality:** auth is
  Next.js **server actions** posting to `/login` (`loginAction`) and `/register` (`registerAction`) — there are **no
  `/api/auth/*` routes** (SECURITY_MODEL §4 endpoint names are aspirational; all 4 agents confirmed). The limiter is
  IP-keyed (x-forwarded-for first hop → x-real-ip), 10 req / 60s, 429 + `Retry-After`, no account-existence disclosure.
- **Edge-safety (platform-architect).** The `@wtc/auth` barrel transitively imports `@node-rs/argon2` (Node-native) →
  unusable in the Edge middleware. **Option A:** pure modules `packages/auth/src/{rate-limit,security-headers}.ts` with
  **new subpath exports**; the middleware imports `@wtc/auth/rate-limit` + `@wtc/auth/security-headers` only. Build
  confirms the Edge bundle (35.2 kB) — no argon2 pulled. Logic lives in packages (AGENTS.md), co-located tests auto-run.
- **Security headers (security-auditor).** Full §6 suite. HSTS production-only (dev is http). CSP is env-aware: dev =
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'` + localhost ws (HMR / e2e dev server); prod = `script-src 'self'
  'unsafe-inline'` (MVP — see Decision 2). Shared: `default-src 'self'`, `style-src 'self' 'unsafe-inline'`,
  `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, img/font/connect per §6,
  `upgrade-insecure-requests` (prod).
- **F-07 — redact value-pattern guard (security-auditor).** `isSecretValue()` added; PHC/bcrypt, Bearer/Basic, 64+-hex
  redacted regardless of key name (catches a session-token-shaped or PHC value under an innocuous key). 63-hex, UUIDs,
  emails, prose are NOT matched. 18 unit tests; existing audit smoke + db-persistence redaction assertions stay green.
- **Webhook exclusion (backend-implementer).** `/api/billing/webhook` excluded in the matcher AND short-circuited in the
  middleware body. The webhook tests call the DB repos directly (PGlite) — middleware never runs in them; all stay green.
- **F-03 structured logger → DEFERRED to PG12.** Both security + tests agents: wiring a logger with no call sites is
  dead code; the redact value-guard already covers the audit path. Recorded, not built this phase.

## Decisions

1. **Document-only headers; POSTs/RSC untouched.** Security headers are applied **only to top-level document GET
   navigations**; every POST (all server actions — fetch *or* pre-hydration native form) and every RSC fetch passes
   through a bare `NextResponse.next()`. Decorating a Server Action response corrupts Next's action protocol (observed in
   e2e as a dev "unexpected response"). Gating on the GET method covers both action shapes. The browser still enforces
   CSP/framing from the document response that loaded the page; RSC/action responses are trusted same-origin fetches.
2. **No per-request CSP nonce this phase (MVP concession).** A working nonce requires forwarding it (Next auto-nonce) or
   layout cooperation — both opt every page into dynamic rendering — and the prod nonce-stamping path cannot be verified
   this session (e2e runs only the dev server). So prod ships `script-src 'self' 'unsafe-inline'`, parallel to the §6
   `style-src 'unsafe-inline'` concession. `buildContentSecurityPolicy` **supports** a nonce (unit-tested both ways);
   wiring it (middleware forward + layout stamp + accept dynamic rendering) is a tracked **Phase-3** follow-up.
3. **Rate-limit enforcement is skipped only for an unidentifiable client in non-production.** A direct-localhost dev/e2e
   request has no `x-forwarded-for` → `ip === null` → enforcement skipped (so the smoke suite's ~28 legitimate logins
   never trip the limiter). Production fails closed: a null IP lands in the `'unknown'` bucket and is still throttled (a
   stripped header cannot bypass the limit). The pure limiter is exercised by 14 unit tests regardless.
4. **Heeded the tests-runner: no 429 e2e burst.** An initial unique-IP 429 probe was added then **removed** — hammering
   the single shared dev server destabilises adjacent server-action tests (the auditor predicted this). 429 coverage
   stays at the unit level (block-on-max+1, Retry-After); the e2e asserts header presence, which proves the middleware
   is active.
5. **Continuous program, governed per group.** This is its own epoch + aggregate; the newest aggregate is the strictly
   validated one. Stopped after PG11 per Rule 7 (context budget) — PG2/PG5 handed to a fresh session (see Next actions).

## Risks

- **e2e dev-only flake (documented).** With the middleware present, the heavier mobile pass intermittently hits a
  Next.js **dev-mode** Server-Action recompilation race ("An unexpected response was received from the server" on a
  `login()` submit). It is **not** a production issue (prod is pre-compiled) and **not** caused by header decoration
  (it persists even when the action response is passed through untouched) — it is the middleware's added per-request work
  raising dev recompilation pressure. Mitigated with `retries: 2`; the run is reported honestly as 1 flaky (auto-retried
  green). A genuine regression fails all attempts. Footprint reduction (move static headers to `next.config.ts headers()`
  and scope the matcher) is a possible future refinement.
- **CSP `script-src 'unsafe-inline'` in prod (MVP)** — weaker than the §6 nonce target; tracked for Phase 3 (Decision 2).
- **In-process rate-limit store** — per Edge instance; multi-instance prod relies on the nginx `limit_req` zone (§4
  layer 1) and/or a future shared store.
- All surfaces still render the honest labelled demo state here (no `DATABASE_URL`); **PGlite is not a substitute for
  real-PG acceptance (B1)** — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes; audit redaction verified) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0; re-run on final tree) |
| 3 | `npm run typecheck` (packages) | **PASS** |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** (middleware + subpath imports compile) |
| 5 | `npm run secret:scan` | **PASS** (clean; re-run on final tree incl. new test fixtures) |
| 6 | `npm test` (Vitest) | **PASS — 294 passed / 7 skipped (301)** across 30 files (+53: rate-limit 14, security-headers 21, redact 18) |
| 7 | `npm run coverage` | **PASS — 25.23% stmts / 71.61% branch** (branch ↑ from 70.74; `rate-limit.ts` 100/100, `redact.ts` 100/95) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 40 tables; "No schema changes"** |
| 9 | `npm run build -w @wtc/web` | **PASS — compiled; `ƒ Middleware 35.2 kB` (Edge, no argon2); 44 app routes** |
| 10 | `npm run e2e` (Playwright, `CI=1`) | **PASS — 36/36** (34 smoke + 2 header ×proj; **1 dev-race flake auto-retried green** — see Risks) |
| 11 | `npm run governance:check` | **PASS** (this aggregate; 4 cited per-agent handoffs present) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production
handoff, TradingView automation, plaintext exchange keys.

## Background agents — closed

All 4 per-agent runs in the audit fan-out (Workflow `wzt3rieb4`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG2 Tortila (next):** read-only health states (not_configured/unreachable/malformed/stale) + `getWarnings()` surface
  (TP/margin/101211/100410/109421) + `JOURNAL_READ_TOKEN` + `.env.example`; bot sub-tabs consume real adapter states.
- **PG5 TradingView:** `sweepTvExpiry` → `atomicRevokeTv` (reason `expired_by_worker`); `listUsersWithEmailByIds` (kill
  the admin-queue N+1); surface `revokeReason` in the admin TV UI; `<14-day` expiry banner on `/app/indicators`.
- **Carried from this phase:** F-03 structured logger (PG12); CSP per-request nonce + dynamic-rendering acceptance (PG3);
  consider moving static headers to `next.config.ts` + scoping the matcher to remove the dev-race flake.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma
  endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6).
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
