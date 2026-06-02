## Scope

Security/hardening backlog audit for Phase Group 11 and the RISK_REGISTER/PRODUCTION_BLOCKERS master docs.
Five lanes: (a) auth rate-limiting middleware presence, (b) per-mutation pipeline invariant coverage,
(c) secret redaction and secret:scan coverage, (d) Axioma handoff token hardening (ES256/JWKS/jti replay),
(e) legacy-bot plaintext-key blocker. State as-of Phase 2.4 (2026-05-30 epoch 20260530-1355).

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/middleware.ts` — absent (confirmed: no file at this path)
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/session.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/__fixtures__/tortila/*.json` (11 files)
- `.secretlintrc.json`
- `.env.example`
- `apps/worker/src/jobs.ts`

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — CRITICAL — Auth rate-limiting middleware does not exist

**Severity:** CRITICAL (production blocker)

**Evidence:** `apps/web/src/middleware.ts` — file absent. Confirmed via Glob and direct Read returning "File does not exist."

The security model (`docs/SECURITY_MODEL.md` §4) specifies IP-based rate-limiting on `POST /api/auth/login` and `POST /api/auth/register` at the nginx layer (10 req/min, burst 5) and also at the application middleware layer. The Phase 2.4 aggregate (`docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` production blockers §6) explicitly lists "Auth rate-limiting middleware still pending." The NEXT_ACTIONS doc also lists it. The Next.js security headers mandated by `docs/SECURITY_MODEL.md` §6 (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) are all set in this file per the spec — but the file does not exist. This means no middleware-level headers are being set for non-JWKS routes either.

**Impact:** Without application-layer rate-limiting, brute-force login is limited only to nginx (not yet deployed) and the account-lockout logic in the DB (Argon2id still runs per request for each attempt within a lockout window). Without CSP/HSTS middleware headers, the XSS/clickjacking defences described in the spec are absent for all pages.

**Recommendation:** Create `apps/web/src/middleware.ts` implementing: (1) IP-keyed sliding-window throttle for `/api/auth/login` (10 req/min) and `/api/auth/register` (10 req/min); (2) per-account lockout at 5 failed attempts in 15 min; (3) security headers (CSP with nonce, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) on all responses; (4) `429 Too Many Requests` with `Retry-After` header. All logic in `packages/auth`; tests required before production.

**Target phase group:** Phase Group 11 (Security/rate-limiting/observability).

---

### F-02 — HIGH — LMS mutation pipeline: RBAC check is a silent return, not a thrown 403

**Severity:** HIGH

**Evidence:** `apps/web/src/features/lms/actions.ts` lines 59, 60, 75, 76, 90, 91, 106, 107, 121-123, 137, 138, 153, 154, 210-212.

The canonical pipeline from `docs/RBAC_MATRIX.md` Step 3 requires `requireRole(session, allowedRoles) — 403 if role not in set`. All LMS teacher/admin actions (createCourse, updateCourse, setCoursePublished, createLesson, setLessonPublished, createMaterial, deleteMaterial, adminEnrollAction) check role via the inline helper `roles(user)` and then silently `return` (void) if the role is not held. A silent return does not prevent timing-based probing (the caller cannot distinguish "forbidden" from "success with no-op") and does not emit an audit row for the rejected attempt. Contrast with `features/admin/actions.ts` which calls `assertAdmin(actor.roles)` (throws `AccessDeniedError`).

The RBAC spec also lists `lesson` and `enrollment` as resources that must be added to `packages/auth/src/rbac.ts` before Phase-2 routes ship to production (`docs/RBAC_MATRIX.md` Phase-2 RBAC Resource additions). While `lesson` and `enrollment` now appear in `rbac.ts`'s `Resource` type, the LMS actions do not call `can(user.roles, 'lesson', 'create')` or equivalent — they use an inline ad-hoc role check instead.

**Recommendation:** Replace inline `if (!isTeacher) return` with `assertTeacherRole(user.roles)` (throws `AccessDeniedError`) analogous to `assertAdmin`. Add a failed-access audit write in the catch path. Align with the `can(roles, resource, action)` matrix rather than ad-hoc role strings.

**Target phase group:** Phase Group 7 (Education/LMS) + Phase Group 11 (Security).

---

### F-03 — HIGH — Structured app logger does not exist; redaction enforced only by audit path

**Severity:** HIGH

**Evidence:** `packages/auth/src/logger.ts` — file absent. `docs/SECRET_VAULT_DESIGN.md` line 32: "packages/auth/src/logger.ts with a structured-logger blocklist is PLANNED — not yet implemented. Until it exists, structured app logging must not be passed raw secrets."

The billing webhook route (`apps/web/src/app/api/billing/webhook/route.ts`) uses `console.log`/`console.error` in non-production mode, explicitly restricted to event id + type, which is acceptable. However, `packages/audit/src/audit.ts` uses `console.log` in the `createConsoleAuditWriter()` (dev-only). No structured logger exists that applies the redaction blocklist outside the audit path. If any developer adds a `console.log` with a user object, a config object containing `sealed`, or a caught exception whose message contains key material, nothing will intercept it in the logging layer.

**Recommendation:** Implement `packages/auth/src/logger.ts` as a thin structured-logger wrapper that applies the same `SECRET_HINTS` blocklist from `redact.ts` to all fields before writing. Gate production log level at `info` or above; reject calls that contain any object key matching the blocklist. This blocks the most likely accidental secret-logging path.

**Target phase group:** Phase Group 11 (Security/rate-limiting/observability).

---

### F-04 — HIGH — Axioma handoff token: jti/replay store is not durable; HS256 dev-stub active in all non-production environments

**Severity:** HIGH

**Evidence:**
- `packages/axioma-bridge/src/es256.ts` line 13: "HONEST GAP: jti/replay persistence is a documented TARGET — there is no jti store table yet, so a caller may pass `isReplayed` backed by whatever store it has, but durable cross-process replay protection is not provided here."
- `packages/axioma-bridge/src/handoff.ts` line 62: `if (process.env.NODE_ENV === 'production') { throw ... }` — HS256 is production-fenced but freely callable in development and staging (NODE_ENV !== 'production').
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` line 14-15: JWKS endpoint returns `{ keys: [] }` if `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_HANDOFF_KEY_ID` are absent, with no warning logged.
- `packages/axioma-bridge/src/bridge.ts` line 89: `createMockAxiomaBridge` calls `signHandoffToken(claims, opts.signingSecret)` — uses the HS256 dev-stub at all environment levels except production.
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` §5: jti revocation table `axioma_handoff_jti_revocations` is specified; it does not appear in migration 0003 schema (confirmed by Phase 2.4 aggregate which lists migration 0003 tables; the jti table is absent).

The ES256 signer (`packages/axioma-bridge/src/es256.ts`) exists and passes tests, but it is not wired into the live bridge flow (`bridge.ts` still calls the HS256 stub). A deployed staging environment with `NODE_ENV=staging` or no NODE_ENV override would use the HS256 signer. More critically, the jti replay store is entirely in-memory (the `isReplayed` callback in tests), meaning a replayed token between two serverless function instances or a restart would not be detected.

**Recommendation:** (1) Wire `createEs256Signer` into `bridge.ts` + terminal/axioma page loader, guarded by `process.env.AXIOMA_HANDOFF_SIGNING_KEY` presence. (2) Create migration adding `axioma_handoff_jti_revocations` table. (3) Implement `consumeJti(jti)` repo — atomic UPDATE WHERE `used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, 0 rows = replay rejected. (4) Add `NODE_ENV !== 'production'` guard to `createMockAxiomaBridge` to prevent HS256 token issuance in staging.

**Target phase group:** Phase Group 6 (Axioma/terminal/journal).

---

### F-05 — HIGH — Legacy bot adapter: plaintext exchange key exposure path not formally code-gated

**Severity:** HIGH (production blocker)

**Evidence:** `packages/bot-adapters/src/http.ts` line 237: "Legacy bot (:8000) read-only adapter. WARNING: legacy API returns plaintext keys — never proxy them." The warning comment exists but there is no code-level assertion that prevents the plaintext keys from reaching WTC or being logged. `getConfig()` and `getMetrics()` both throw `AdapterNotReadyError`, which prevents data from flowing, but the `getHealth()` method does make a live HTTP call to `GET /api_management/` (line 248). The `api_management` endpoint on the legacy bot returns the exchange API keys for each API entry (per the discovery map: `/api_management/` and `/api_management/{api_id}`). The response from this GET is consumed only to check HTTP 200 — the response body is discarded — but there is no Zod schema enforcing that the response body does not get logged or stored.

More critically, `docs/BOT_CONTROL_SAFETY_MODEL.md` (not read but referenced in Phase 2.4 aggregate) and the control.ts file do not gate the health check against the plaintext-key leak. The BLOCKED status is documented but is a social/process gate, not a code gate.

**Recommendation:** (1) Add a Zod schema for the legacy health check response that explicitly EXCLUDES any fields matching the RBAC matrix's exchange-key naming patterns (`api_key`, `api_secret`, `secret_key`, etc.) — `z.never()` for those fields if they appear. (2) Add a Vitest test asserting that `getHealth()` for the legacy adapter does not return or log any field matching the `SECRET_HINTS` blocklist. (3) Formally document and enforce that the `api_management` response body is never forwarded, stored, or logged beyond the HTTP status code.

**Target phase group:** Phase Group 3 (Legacy/second bot boundary).

---

### F-06 — MEDIUM — Per-mutation pipeline: CSRF check order in LMS is assertCsrf BEFORE requireUser

**Severity:** MEDIUM

**Evidence:** `apps/web/src/features/lms/actions.ts` lines 57-58 (and all LMS actions): `requireUser()` is called first, then `assertCsrf(formData)`. The canonical pipeline in `docs/RBAC_MATRIX.md` CSRF note: "every POST/PUT/PATCH/DELETE route must validate the CSRF double-submit token ... before step 1 [Zod]." The CSRF check should be the first security gate (before session lookup) because CSRF is cheap to check and should short-circuit before any DB call. The actual risk is low since `assertCsrf` uses a session-derived token (requiring a valid session cookie to produce), but the ordering deviates from the canonical spec and introduces an unnecessary DB lookup on CSRF-forged requests.

**Evidence also:** The comment at the top of `lms/actions.ts` (line 3-5) documents the order as "assertCsrf → Zod → requireUser → RBAC" but the implementation is "requireUser → assertCsrf → Zod → RBAC". The comment and the code are inconsistent.

**Recommendation:** Reorder to `assertCsrf(formData)` before `requireUser()` in all LMS actions to match the spec and the module's own comment. Low-risk change; no functional security impact since the CSRF token is session-derived.

**Target phase group:** Phase Group 7 (Education/LMS).

---

### F-07 — MEDIUM — redact.ts SECRET_HINTS missing `iv`, `tag`, and `accesstoken`

**Severity:** MEDIUM

**Evidence:** `packages/audit/src/redact.ts` lines 12-36. The comment explains that bare `iv` and `tag` are intentionally omitted to avoid false matches on innocuous fields (`isActive`, `stage`). This is a documented, operator-approved trade-off from Phase 2.1 (cited comment at line 10-11). However, `accesstoken` appears in the AUDIT_LOG_SCHEMA.md target additions list (line 277) and IS present in SECRET_HINTS (line 35 `'accesstoken'`), so that one is resolved. The doc's target list also includes `vaultrecord` (present), `ciphertext` (present). The only genuine gap is that `bearer` appears in the list but the value-pattern blocklist (targeting strings starting with `Bearer `) is in the doc spec but not confirmed implemented in `redact.ts` — the current `redact.ts` has no value-pattern checks, only field-name checks.

The `docs/AUDIT_LOG_SCHEMA.md` Redaction Rules specify a value-pattern blocklist (strings of 32+ hex chars, strings starting with `Bearer `, PHC strings, bcrypt strings). None of these value-pattern guards exist in `redact.ts`. A dev log call that passes a raw JWT or PHC hash as a string field with an unredacted key name (e.g., `message: "$argon2id$..."`) would pass through unredacted.

**Recommendation:** Add a value-pattern check to `redact()` that, for string values, matches: (1) 64+ char hex strings, (2) strings starting with `Bearer ` or `Basic `, (3) strings matching `$argon2id$`, `$2b$` prefixes. These are cheap regex checks and prevent the residual category of plaintext-in-value leaks.

**Target phase group:** Phase Group 11 (Security/rate-limiting/observability).

---

### F-08 — MEDIUM — secret:scan uses only the recommend preset; no custom WTC-specific patterns

**Severity:** MEDIUM

**Evidence:** `.secretlintrc.json` contains only `@secretlint/secretlint-rule-preset-recommend`. This covers common provider key patterns (AWS, GitHub, Stripe, etc.) but does NOT cover WTC-specific patterns: `SECRET_VAULT_KEK=` with a real base64-32 value, `SESSION_SECRET=` with a real high-entropy value, `WTC_AXIOMA_SIGN_PRIVATE_KEY_*=`, or a PEM-format EC private key. If any of these were accidentally committed in a test fixture or .env.local, the recommend preset would not catch them.

The `.env.example` correctly uses placeholder strings (`replace-with-random-48-bytes-base64`, `whsec_replace_with_your_stripe_webhook_secret`) which the scan WOULD catch by virtue of not matching real key patterns (no false positives on placeholders). However, a developer who accidentally embeds a real test KEK (44-char base64) as a fixture value would not be flagged.

**Recommendation:** Add a custom secretlint rule or a pre-commit hook that uses `gitleaks` or a regex pattern targeting: (1) 44-character base64 strings in non-.env files (likely real KEK values), (2) PEM `-----BEGIN EC PRIVATE KEY-----` blocks outside of explicit test key generation fixtures. This is a defense-in-depth improvement.

**Target phase group:** Phase Group 12 (CI/deployment readiness).

---

### F-09 — LOW — sweepTvExpiry worker uses older non-atomic revokeTv, not atomicRevokeTv

**Severity:** LOW

**Evidence:** `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` Risks: "sweepTvExpiry still calls the older revokeTv (not atomicRevokeTv) — fine (request-only sweep), tracked for Phase 2.5."

The `apps/worker/src/jobs.ts` `sweepTradingViewAccess` calls `tv.sweep(now)` via the `TvAccessService` interface. The in-memory service's sweep is not atomic. For the DB-backed path, `sweepTvExpiry` in `packages/db/src/repositories.ts` calls the pre-Phase-2.4 `revokeTv` (which does not stamp `revokeReason` or atomically null the profile pointer). This is a known tracked debt, not an undiscovered gap, but it creates a divergent state window: the profile pointer can become stale if the worker tick fires during a concurrent admin revoke.

**Recommendation:** Replace `revokeTv` call in sweep with `atomicRevokeTv` in Phase 2.5. Pass `revokeReason = 'expired_by_worker'` as the reason.

**Target phase group:** Phase Group 5 (TradingView access).

---

### F-10 — LOW — Axioma JWKS endpoint: empty key set returned silently when signing key is unconfigured

**Severity:** LOW

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` lines 17-18: returns `{ keys: [] }` with no server-side warning logged when `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_HANDOFF_KEY_ID` are absent.

While returning an empty key set is safe (Axioma will not be able to verify any token), the absence of a log/metric means an operator misconfiguration (accidentally unset env var on a production deployment) is invisible until users report failing journal redirects. No `integration_health_checks` record is written for JWKS endpoint failures.

**Recommendation:** When `pem || kid` is absent in production (`NODE_ENV === 'production'`), emit a `system.health_check` audit/integration_health record with `status = 'error'` and `detail = 'AXIOMA_HANDOFF_SIGNING_KEY not configured'`. Keep the empty key set response — do not error the endpoint.

**Target phase group:** Phase Group 6 (Axioma/terminal/journal) / Phase Group 12 (CI/deployment readiness).

---

## Decisions

1. **F-01 (rate-limiting middleware) is the single highest-priority implementation item** for Phase Group 11. The absence of `apps/web/src/middleware.ts` means no server-side CSP/HSTS headers and no application-layer auth rate-limiting — both are production blockers.

2. **F-04 (Axioma jti replay)** is already tracked as a TARGET in the spec and handoff. The durable `axioma_handoff_jti_revocations` table must be added in a migration before any ES256 token can be issued to real Axioma journal traffic. This is a hard prerequisite for Phase Group 6, not just a hardening task.

3. **F-05 (legacy bot plaintext key blocker)** remains a BLOCKED state. No implementation should proceed until the upstream legacy bot API stops returning plaintext keys in `/api_management/` responses. The current `AdapterNotReadyError` on `getConfig`/`getMetrics` is the correct holding pattern; `getHealth` making a live GET to `api_management/` is a residual risk worth a Zod exclusion schema as described.

4. **F-02 (LMS RBAC silent return vs throw)**: affects audit completeness. A failed teacher-role check should emit an `auth.login_failed`-class audit entry (or a new `rbac.access_denied` action code). The current silent return means unauthorized attempts to create/update courses or materials are invisible to the audit log.

5. **F-07 (value-pattern redaction) is low implementation cost, high value**: a single `isSecretValue(v: unknown): boolean` helper in `redact.ts` covers the PHC hash, Bearer token, and long hex patterns — approximately 10 lines of code. Should be included in the Phase Group 11 batch.

---

## Risks

| ID | Risk | Severity | Evidence / mitigation |
|----|------|----------|----------------------|
| R-01 | No auth rate-limiting middleware means login/register are rate-limited only at nginx (not yet deployed). Until nginx is live, credential stuffing or brute-force is unbounded at the application layer. | CRITICAL | F-01. Mitigation: implement `apps/web/src/middleware.ts` before any production exposure. |
| R-02 | Axioma HS256 dev-stub active in all non-production envs. A staging deployment with default NODE_ENV would issue HS256 tokens that a spec-compliant Axioma verifier would reject, creating a hard failure for the Axioma account-link flow. | HIGH | F-04 / `packages/axioma-bridge/src/handoff.ts:62`. |
| R-03 | jti replay table absent. Multi-instance deployments or any warm-start scenario allows token replay within the 5-minute TTL window. | HIGH | F-04 / AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay. Mitigated by 5-min TTL; not mitigated for the replay case within TTL. |
| R-04 | Legacy bot `getHealth()` makes a live HTTP GET to `/api_management/` which returns plaintext exchange keys in the response body. The body is discarded (status-only check), but there is no Zod schema verifying that the body is never captured by error handling or a future logging call. | HIGH | F-05 / `packages/bot-adapters/src/http.ts:248`. |
| R-05 | No structured logger with redaction. Console.log calls in development mode (webhook route, audit writer) have no secret-field filter. A developer adding a debug log of a config or user object containing vault material could ship to staging without detection. | HIGH | F-03. |
| R-06 | LMS mutations silently return (not throw) on RBAC failure, producing no audit trail of failed unauthorized attempts. | MEDIUM | F-02 / `apps/web/src/features/lms/actions.ts:60`. |
| R-07 | Value-pattern leaks (PHC hashes, Bearer tokens, raw hex keys as string values with benign-looking key names) pass through `redact()` undetected. | MEDIUM | F-07 / `packages/audit/src/redact.ts`. |
| R-08 | secret:scan does not cover WTC-specific high-entropy env values (KEK, SESSION_SECRET, EC private keys). A real KEK accidentally committed to a test file would not be flagged. | LOW | F-08. |
| R-09 | `sweepTvExpiry` uses pre-atomic `revokeTv`, creating a profile-pointer divergence window under concurrent worker+admin revoke. | LOW | F-09 / tracked in Phase 2.4 aggregate. |

---

## Verification/tests

All findings above are based on static code and documentation inspection. No tests were run in this audit.

Current test gate baselines (from Phase 2.4 epoch 20260530-1355, last gate run):
- `npm test` — 238 passed / 5 skipped
- `npm run coverage` — 24.94% stmts / 70.77% branch
- `npm run e2e` — 34/34
- `npm run secret:scan` — PASS (clean; verifies the recommend preset passes but does not confirm WTC-specific high-entropy patterns are covered)
- `npm run governance:check` — PASS

Tests that MUST be written before Phase Group 11 items ship:
- Rate-limiting middleware: Vitest unit tests for the sliding-window logic; Playwright e2e asserting `429` on the 11th login attempt from the same IP within 1 minute.
- `redact.ts` value-pattern additions: Vitest tests asserting `$argon2id$...` strings, `Bearer abc...` strings, and 64-char hex strings are redacted regardless of field name.
- Logger: Vitest tests asserting that calling the structured logger with an object containing `{ sealed: '...', password: '...' }` produces output with `[REDACTED]` values.

Items confirmed NOT RUN (unchanged from Phase 2.4 aggregate):
- `db:migrate` / `db:seed` / real-PG harness — NOT RUN (no DATABASE_URL)
- Stripe checkout path — TARGET
- Axioma ES256 production handoff — TARGET
- CI — inert (not a git repo)

---

## Next actions

Ordered by priority for Phase Group 11:

1. **IMMEDIATE (production blocker):** Create `apps/web/src/middleware.ts` with IP-keyed auth rate-limiting (login: 10 req/min + account lockout at 5 fails in 15 min; register: 10 req/min) and security headers (CSP with nonce, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP). Tests required. — F-01.

2. **IMMEDIATE (production blocker):** Add value-pattern redaction to `packages/audit/src/redact.ts` — PHC hash prefix, Bearer/Basic prefix, 64+ char hex string. ~10 lines. — F-07.

3. **PHASE GROUP 6 PREREQUISITE:** Add `axioma_handoff_jti_revocations` table in next migration; implement `consumeJti` repo; wire `createEs256Signer` into `bridge.ts`. Gate: must have tests for the replay rejection path before enabling any production Axioma redirect. — F-04.

4. **PHASE GROUP 7:** Replace LMS `if (!isTeacher) return` with `assertTeacherRole(roles)` (throw + audit write on failure). Reorder CSRF to be first gate in all LMS actions to match spec. — F-02, F-06.

5. **PHASE GROUP 11:** Implement `packages/auth/src/logger.ts` as a thin structured-logger wrapper applying the SECRET_HINTS blocklist. Route all app-level `console.log/error` through it in non-test environments. — F-03.

6. **PHASE GROUP 3 (BLOCKED until plaintext-key upstream fix):** Add Zod exclusion schema for legacy `/api_management/` health response to prevent any key field reaching WTC, even on future code changes. Document as a hard gate in `docs/CONTRACTS/legacy-bot-adapter.md`. — F-05.

7. **PHASE GROUP 5:** Replace `revokeTv` with `atomicRevokeTv` in `sweepTvExpiry` path (`apps/worker/src/jobs.ts`). Pass `revokeReason = 'expired_by_worker'`. — F-09.

8. **PHASE GROUP 12:** Add WTC-specific gitleaks / secretlint rules for high-entropy base64 values and PEM EC private keys outside test-key generation contexts. — F-08.

9. **PHASE GROUP 6:** Add `system.health_check` audit record in `/.well-known/axioma-jwks.json` route when signing key is absent in production. — F-10.
