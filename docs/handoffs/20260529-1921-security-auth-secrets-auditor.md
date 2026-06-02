# security-auth-secrets-auditor handoff

_2026-05-29. Phase 1.5 read-only security audit. No live servers or secrets touched. No code modified._

## Scope

Focused audit of auth/secrets hardening items (Part F) for the WTC Ecosystem Platform post-Phase-1:

- **F1** — Production session cookie `__Host-` prefix: is the web layer wired to use it?
- **F2** — Config-level secret validation: does it reject repeated-character / low-entropy fake secrets in production, not just known placeholder strings?
- **F3** — Axioma HS256 dev-stub vs. ES256/JWKS production signer: current status.
- **F4** — Mock billing impossible in production: prod guard verified.
- **F5** — Live bot control disabled (control always throws): verified.
- **Additional** — plaintext secret leakage into logs, responses, or audit payloads.

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260529-phase1-persistence-hardening.md`
- `docs/SECURITY_MODEL.md` (partial)
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` (partial)
- `apps/web/src/lib/session.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/vault.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts` (lines 195-215)
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx` (partial)
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `packages/auth/src/session.ts`
- `packages/auth/src/index.ts`
- `packages/shared/src/env-guards.ts`
- `packages/shared/src/env-guards.test.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/provider.test.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/repositories.ts` (lines 128-175)
- `.env.example`
- `.secretlintrc.json`
- `.secretlintignore`

## Files changed

None — read-only audit.

## Findings

### Finding 1 — HIGH: Production session cookie does not use `__Host-` prefix (F1)

**Severity:** high

**Evidence:** `apps/web/src/lib/session.ts:6` exports `SESSION_COOKIE = 'wtc_session'` (always the plain dev name). `apps/web/src/app/(auth)/actions.ts:8` imports from `@/lib/session` (not from `@wtc/auth`) and calls `jar.set(SESSION_COOKIE, ...)` at line 14. The package `@wtc/auth` exports the correct `sessionCookieName(isProd: boolean)` function (`packages/auth/src/session.ts:37`) that returns `'__Host-wtc_session'` in production, but the web app **never calls it**. The `apps/web/src/lib/session.ts` module re-exports only the plain dev name with a comment saying "prod uses the `__Host-` prefix — see `@wtc/auth sessionCookieName`" but does not call that function. The result is that in production the cookie is set and read under the plain name `wtc_session` regardless of `NODE_ENV`, violating the `SECURITY_MODEL.md §2` specification and RFC 6265bis `__Host-` enforcement.

Also: `apps/web/src/lib/csrf.tsx:5` and `apps/web/src/app/(auth)/actions.ts:59,60` read/delete the session cookie using the same plain `SESSION_COOKIE` constant, so logout also uses the wrong name in production.

**Recommendation:** In `apps/web/src/lib/session.ts`, replace the hardcoded `export const SESSION_COOKIE = 'wtc_session'` with a dynamic function or a computed constant:

```ts
import { sessionCookieName } from '@wtc/auth';
export const SESSION_COOKIE = sessionCookieName(process.env.NODE_ENV === 'production');
```

Alternatively, delete `apps/web/src/lib/session.ts` and import `sessionCookieName` + `SESSION_COOKIE_PROD`/`SESSION_COOKIE_DEV` directly from `@wtc/auth` in `actions.ts` and `csrf.tsx`. Add a Vitest test that asserts `SESSION_COOKIE === '__Host-wtc_session'` when `NODE_ENV=production`.

**Target part:** F

---

### Finding 2 — HIGH: Config-level secret validation does not catch repeated-character / low-entropy fake secrets (F2)

**Severity:** high

**Evidence:** `packages/config/src/env.ts:18-19` defines `SESSION_SECRET: z.string().min(16)` and `SECRET_VAULT_KEK: z.string().min(16)`. Neither field is validated by `isPlaceholderSecret` at parse time. `packages/config/src/env.test.ts:7-8` uses `'s'.repeat(24)` and `'k'.repeat(24)` as the test values and the `loadEnv` call at line 15 succeeds — confirming a 24-character repeated single-character string passes all validation. The `isPlaceholderSecret` function in `packages/shared/src/env-guards.ts:17` only matches a short list of known prefix strings (replace-with, dev-only, changeme, etc.) via regex; it does not detect all-same-character or other low-entropy patterns.

The downstream `requiredSecret()` calls in `apps/web/src/lib/csrf.tsx:11` and `apps/web/src/lib/vault.ts:14` do invoke `isPlaceholderSecret`, so the known prefix strings are caught at runtime on first use. However, a value like `ssssssssssssssssssssssss` (24 × 's') passes both `min(16)` and `isPlaceholderSecret`, silently allowing a trivially brute-forceable key in production. For `SECRET_VAULT_KEK` (used as AES-256-GCM KEK), this is a critical cryptographic weakness.

**Recommendation:**

1. In `packages/config/src/env.ts`, add a `superRefine` clause or extend the existing one to call `isPlaceholderSecret` on `SESSION_SECRET`, `SECRET_VAULT_KEK`, and `AXIOMA_HANDOFF_SIGNING_SECRET` when `NODE_ENV=production`.
2. In `packages/shared/src/env-guards.ts`, extend `isPlaceholderSecret` with an entropy heuristic: reject any string whose character set is a single character (all same byte), or strings that are obvious keyboard runs (e.g., unique-char count < 4 for length > 12). Example: `if (new Set(value).size < 4) return true`.
3. Add a test case in `packages/shared/src/env-guards.test.ts` and `packages/config/src/env.test.ts` asserting that `'s'.repeat(32)` is rejected in production.

**Target part:** F

---

### Finding 3 — HIGH: Axioma HS256 is the only signer; ES256/JWKS production signer does not exist (F3)

**Severity:** high

**Evidence:** `packages/axioma-bridge/src/handoff.ts:59` hard-codes `{ alg: 'HS256', typ: 'WTC-HANDOFF' }` in the JWT header. There is no ES256 signer in any file under `packages/axioma-bridge/src/`. The `handoff.test.ts:27-29` test explicitly asserts `alg === 'HS256'` and labels it the "documented dev stub". The `AXIOMA_HANDOFF_TOKEN_SPEC.md` specifies ES256 with a `kid` field and states "Axioma MUST reject tokens with any other algorithm value, including `HS256`". There is no `ES256Signer` class, no JWKS endpoint, no `.pem`/key generation utility, and no `jose` or equivalent library dependency in `packages/axioma-bridge/package.json` (only `node:crypto`).

The `apps/web/src/app/(app)/app/terminal/page.tsx:13` calls `createMockAxiomaBridge` — the mock bridge — so even the web app path uses HS256. Because Axioma journal_server is spec'd to reject HS256, the handoff flow will not work in production without this upgrade.

The `packages/config/src/env.ts:32` marks `AXIOMA_HANDOFF_SIGNING_SECRET` as `.optional()`, so `loadEnv` will not fail in production if it is missing; the failure is deferred to the first bridge call via `requiredSecret()`.

**Recommendation:**

1. Implement an ES256 signer using Node.js `crypto.generateKeyPair('ec', { namedCurve: 'P-256' })` or the `jose` library in `packages/axioma-bridge/src/handoff-es256.ts`. Include a `kid` in the header matching a rotation schedule.
2. Expose a JWKS endpoint (`/api/axioma/jwks.json` or similar) that publishes the public key so Axioma journal_server can verify without a shared secret.
3. Change `AXIOMA_HANDOFF_SIGNING_SECRET` in `env.ts` to the new key material field (or a path/env combo) and remove `.optional()` when `NODE_ENV=production`.
4. Keep the HS256 path only under an explicit `DEV_STUB` flag; the test that asserts `alg=HS256` is good as a regression guard.
5. Block deployment of the real bridge until ES256 is wired.

**Target part:** F

---

### Finding 4 — MEDIUM: `AXIOMA_HANDOFF_SIGNING_SECRET` is `.optional()` in `env.ts`, config-level enforcement absent (F3 sub-issue)

**Severity:** medium

**Evidence:** `packages/config/src/env.ts:32`: `AXIOMA_HANDOFF_SIGNING_SECRET: z.string().min(16).optional()`. This means `loadEnv()` in production succeeds even if the signing secret is completely absent. The only safety net is `requiredSecret()` inside `apps/web/src/app/(app)/app/terminal/page.tsx:15`, which fires at first request, not at startup. A production deploy without this secret will serve the terminal page in error state rather than failing closed at boot.

**Recommendation:** Add a `superRefine` in `env.ts`: when `NODE_ENV=production` and `AXIOMA_BRIDGE_API_TOKEN` or any Axioma-bridge feature is in use, require `AXIOMA_HANDOFF_SIGNING_SECRET` to be set. At minimum, document this as a deployment gate in `DEPLOYMENT.md`.

**Target part:** F

---

### Finding 5 — MEDIUM: Demo credentials rendered in production login page HTML (partial F1/F2 concern)

**Severity:** medium

**Evidence:** `apps/web/src/app/(auth)/login/page.tsx:5` imports `DEMO_PASSWORD` from `@/lib/backend`. Lines 24 and 29 render it as a prefilled input `defaultValue` and as visible text (`<code>{DEMO_PASSWORD}</code>`). There is no `NODE_ENV !== 'production'` guard on this block. `DEMO_PASSWORD = 'wtc-demo-pass-123'` (`apps/web/src/lib/demo.ts:20`). In production with `DATABASE_URL` set, the in-memory demo accounts do not exist, so the credentials will not work — but they are still visible in the HTML, revealing the seed password string to any visitor.

Separately, `packages/db/src/seed-cli.ts:10` prints `DEMO_PASSWORD` to stdout on every `db:seed` run; this is acceptable for a CLI tool but should not be committed to log infrastructure in production.

**Recommendation:** Gate the demo credential display block in `login/page.tsx` behind `process.env.NODE_ENV !== 'production'`. Example: define a server-side `isDev = process.env.NODE_ENV !== 'production'` and conditionally render the demo hint paragraph and the `defaultValue`. This prevents the seed password from appearing in production page source even though the accounts would not be valid.

**Target part:** F

---

### Finding 6 — LOW: `demo.ts` passes plaintext `apiKey`/`apiSecret` into audit `after` field (audit redaction relies on key-name matching)

**Severity:** low

**Evidence:** `apps/web/src/lib/demo.ts:208`:
```
await audit.write({ ..., after: { exchange: input.exchange, apiKey: input.apiKey, apiSecret: input.apiSecret } });
```
The plaintext exchange API key and secret are passed as object values in the `after` field. Redaction in `packages/audit/src/redact.ts:5-19` will catch these because `'apikey'` and `'secret'` are in `SECRET_HINTS`, so the stored/logged audit event correctly shows `[REDACTED]`. The smoke test at `packages/audit/src/__smoke__.ts:24-27` verifies this. The risk is shallow: the values live in memory only for the duration of the `buildEvent` call, and the output is always redacted.

However, passing plaintext credentials deeper into a call chain (even if redacted at the boundary) is a structural weakness. If the redaction layer were ever bypassed (e.g., a new writer added without calling `buildEvent`), raw keys would leak.

The `db-store.ts` path does not have this issue: `apps/web/src/lib/db-store.ts` never passes `apiKey`/`apiSecret` to the audit log — it only logs `{ exchange, keyMask }`.

**Recommendation:** In `apps/web/src/lib/demo.ts:208`, replace the `after` payload with the already-computed `view` (which already uses `keyMask`, not the raw key): `after: { exchange: input.exchange, keyMask: view.keyMask }`. This brings `demo.ts` in line with the `db-store.ts` pattern and removes the need to rely on redaction for defense.

**Target part:** F

---

### Finding 7 — LOW: `createConsoleAuditWriter` (dev writer) logs redacted audit events to stdout with no production guard (audit log side-channel)

**Severity:** low

**Evidence:** `packages/audit/src/audit.ts:96-104`: `createConsoleAuditWriter` calls `console.log('[audit]', JSON.stringify(e))`. The event is redacted, so no plaintext secrets appear. However, the console writer is a dev artifact and should not be used in production, where audit events must go to the DB (`createDbAuditWriter`). There is no `assertNotProduction` guard inside the console writer itself.

The `apps/web/src/lib/backend.ts` selector picks `dbStore.audit` (which uses `createDbAuditWriter`) when `DATABASE_URL` is set and the `memory.audit` (which uses `createConsoleAuditWriter`, visible in `demo.ts`) when not. So in production with `DATABASE_URL`, the console writer is not used. The risk is low but the console writer has no in-code protection should it be accidentally called.

**Recommendation:** Add `assertNotProduction('console audit writer')` at the top of `createConsoleAuditWriter` (or at least a comment and a lint rule). This makes accidental production use a startup error rather than silent downgrade.

**Target part:** F

---

### Finding 8 — INFO: F4 and F5 verified — no issues found

**F4 (mock billing impossible in production):** Confirmed correctly implemented.
- `packages/config/src/env.ts:38-42`: `superRefine` rejects `BILLING_PROVIDER=mock` in production.
- `packages/billing/src/provider.ts:37-39`: `createMockBillingProvider` throws in production at the provider-selection level.
- `apps/web/src/app/(app)/app/billing/page.tsx:12`: `assertNotProduction('Mock checkout')` guards the dev self-grant action.
- Tests at `packages/config/src/env.test.ts` and `packages/billing/src/provider.test.ts` both pass.

**F5 (live bot control disabled):** Confirmed correctly implemented.
- `packages/bot-adapters/src/control.ts:16-18`: `assertBotControlAllowed` requires both `flagEnabled` AND `auditApproved`; both mock and real adapters call this.
- `packages/bot-adapters/src/adapters.test.ts:23-31`: tests confirm `startBot`, `stopBot`, `applyConfig` all throw `BotControlDisabledError` in both mock and real adapters.
- `FEATURE_LIVE_BOT_CONTROL` defaults to `false`.

**Target part:** F

---

### Finding 9 — INFO: No auth rate-limiting middleware exists

**Severity:** info

**Evidence:** No `middleware.ts` exists anywhere under `apps/web/src/` (Glob confirmed). No `rateLimit`, `throttle`, or similar pattern appears in `packages/auth/` or `apps/web/src/`. `NEXT_ACTIONS.md` item 5 already lists "add auth rate-limiting middleware" as a pending Phase 1.5 task.

**Recommendation:** Implement Next.js edge middleware (`apps/web/src/middleware.ts`) with an IP-keyed in-memory (or Redis-backed) rate limiter on `POST /login` and `POST /register` paths. A simple token-bucket at ~5 attempts per 15-minute window per IP is sufficient for MVP. This blocks credential-stuffing and brute-force against the Argon2id verifier.

**Target part:** F

## Decisions

- No code was modified. All findings are proposals for Phase 1.5 implementation.
- F4 (mock billing) and F5 (bot control) are correctly implemented and tested; no action required on these items.
- F1 (`__Host-` prefix) and F2 (low-entropy secret rejection) are the highest-priority fixes before production deployment because they affect session security and KEK integrity.
- F3 (HS256 → ES256) is a prerequisite before the real Axioma bridge goes live; the current mock state is safe because the mock bridge is clearly labelled and the token is never sent to a real Axioma verifier.

## Risks

1. **F1 (session cookie name):** If deployed to production as-is, the session cookie will be `wtc_session` without the `__Host-` binding, meaning it could theoretically be set from a subdomain (if one exists) or without `Secure` enforcement at the browser. Low immediate risk because the app is not yet deployed, but must be fixed before go-live.
2. **F2 (low-entropy KEK):** A `SECRET_VAULT_KEK` consisting of repeated characters passes current validation. If an operator accidentally sets `SECRET_VAULT_KEK=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, the AES-256-GCM vault is trivially broken. This is a deployment-time risk, not a code-execution risk, but it is invisible until a secret is brute-forced.
3. **F3 (HS256 stub):** Safe for dev. Not safe once the bridge connects to a real Axioma journal_server that enforces `alg=ES256`. The `AXIOMA_HANDOFF_TOKEN_SPEC.md` is explicit that Axioma MUST reject HS256 tokens.
4. **Demo credentials in login page HTML:** The in-memory accounts do not exist in production with a real DB, so login with these credentials will fail. The risk is reputational/informational (password string visible to any visitor), not an authentication bypass.
5. **Console audit writer:** Redaction protects against secret leakage but relying on it as the only guard is fragile if new audit paths are added without careful review.

## Verification/tests

Tests needed to confirm fixes (none run during this read-only audit):

| Fix | Test to add |
|-----|-------------|
| F1 cookie name | Vitest: `SESSION_COOKIE === '__Host-wtc_session'` when `NODE_ENV=production` |
| F2 entropy check | `packages/shared/src/env-guards.test.ts`: `'s'.repeat(32)` rejected in production by `isPlaceholderSecret` or new entropy check; `packages/config/src/env.test.ts`: `loadEnv` throws for repeated-char `SESSION_SECRET` and `SECRET_VAULT_KEK` in production |
| F3 ES256 signer | `handoff.test.ts`: new `it('production signer uses ES256')` test against the future ES256 path; existing HS256 test becomes a dev-guard regression test |
| Demo credentials | Playwright e2e: production build does not render `DEMO_PASSWORD` in login page HTML |

## Next actions

In priority order for Phase 1.5:

1. **F1 (high)** — Fix `apps/web/src/lib/session.ts` to return `sessionCookieName(isProd)` from `@wtc/auth`. Update all callers (`actions.ts`, `csrf.tsx`) to use the dynamic name. Add the Vitest regression test. This is a one-file change.

2. **F2 (high)** — Extend `isPlaceholderSecret` with a character-entropy check (unique char count < 4 for strings > 12 chars). Add a `superRefine` in `env.ts` to apply `isPlaceholderSecret` to `SESSION_SECRET` and `SECRET_VAULT_KEK` in production. Update `env.test.ts` to use a real-entropy test vector instead of `'s'.repeat(24)`.

3. **F5-demo (medium)** — Gate the demo credential display in `apps/web/src/app/(auth)/login/page.tsx` behind `NODE_ENV !== 'production'`.

4. **F3 (high, prerequisite for bridge go-live)** — Implement ES256 signer (`packages/axioma-bridge/src/handoff-es256.ts`) + JWKS endpoint. Make `AXIOMA_HANDOFF_SIGNING_SECRET` required-in-production in `env.ts`. This is not blocking for Phase 1.5 internal dev but is blocking before real Axioma bridge activation.

5. **F4-audit (low)** — Fix `demo.ts:208` `after` payload to use `keyMask` instead of raw `apiKey`/`apiSecret`.

6. **F6-rate-limit (info)** — Add auth rate-limiting middleware (`apps/web/src/middleware.ts`) per `NEXT_ACTIONS.md` item 5.

7. **F7-console-writer (low)** — Add `assertNotProduction` guard to `createConsoleAuditWriter` in `packages/audit/src/audit.ts`.
