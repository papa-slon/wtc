# ecosystem-axioma-bridge-auditor handoff

## Scope

Phase 2.1 / Epoch 20260530-0925. Read-only verification audit.

Tasks per prompt:
1. Specify the ES256/JWKS upgrade precisely (signer, claims, jwks.ts, JWKS route, private-key exposure, HS256 reachability, jti/replay feasibility).
2. Specify the terminal product surfaces (/products/axioma-terminal content model, /app/terminal license + download + account-link flow).
3. Confirm no production bridge claim until verified.
4. List the required Axioma tests for Phase 2.1.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-axioma-bridge-auditor.md` (Phase 2 predecessor)
- `docs/CONTRACTS/axioma-bridge.md` (v1.1.0)
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/TERMINAL_PRODUCT_AREA.md`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/crypto/src/vault.ts`
- `packages/crypto/src/index.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(public)/products/[slug]/page.tsx`
- `apps/web/src/lib/server-config.ts`
- `.env.example`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md` (terminal table specs)
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md` (S-8 / P-D spec)

---

## Files changed

None — read-only audit (this handoff only)

---

## Findings

### F-1 — ES256/JWKS signer: `packages/axioma-bridge/src/signer.ts` does not yet exist (severity: high, blocking)

**Evidence:** `packages/axioma-bridge/src/` contains only `handoff.ts`, `bridge.ts`, `index.ts`, `__smoke__.ts`, `handoff.test.ts`. There is no `signer.ts` and no `jwks.ts`. The platform-architect handoff S-8 names `packages/axioma-bridge/src/signer.ts` as the target file for the production ES256 signer. `AXIOMA_HANDOFF_TOKEN_SPEC.md` defines the signer contract at `packages/axioma-bridge/src/handoffToken.ts` (a different filename). These two specifications name different files for the same feature.

**Recommendation:** Reconcile the filename before Wave-2 implementation. The canonical location defined in `AXIOMA_HANDOFF_TOKEN_SPEC.md` (`handoffToken.ts`) should be used — it is the security-auditor-owned spec document, which outranks the platform-architect planning handoff for security-critical naming. The implementer must create `packages/axioma-bridge/src/handoffToken.ts` (not `signer.ts`).

**Target part:** `packages/axioma-bridge/src/handoffToken.ts` (to be created in Wave-2 S-8)

---

### F-2 — AXIOMA_HANDOFF_SIGNING_KEY vs WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>: env var name divergence (severity: medium)

**Evidence:** The platform-architect handoff (S-8, line ~295) says the env var is `AXIOMA_HANDOFF_SIGNING_KEY`. The `AXIOMA_HANDOFF_TOKEN_SPEC.md` says the env var is `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` (kid-suffixed, e.g. `WTC_AXIOMA_SIGN_PRIVATE_KEY_wtc-axioma-sign-2026-01`). The `.env.example` does not contain either of these ES256 vars — it still shows only `AXIOMA_HANDOFF_SIGNING_SECRET` (the HS256 symmetric secret). The `packages/config/src/env.ts` registers only `AXIOMA_BRIDGE_API_TOKEN` as optional.

**Recommendation:** The token spec's naming is authoritative: `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` (for the private PEM, base64-encoded) and `WTC_AXIOMA_ACTIVE_SIGN_KID` (for the active key id). The `.env.example` and `packages/config/src/env.ts` must add these before S-8 implementation begins. Both must be marked `z.string().optional()` for dev (HS256 dev stub is the fallback) and required in production gate checks.

**Target part:** `.env.example`, `packages/config/src/env.ts`

---

### F-3 — JWKS route path discrepancy between spec and platform-architect handoff (severity: low)

**Evidence:** `AXIOMA_HANDOFF_TOKEN_SPEC.md` specifies the JWKS endpoint as `GET https://app.wtc.example.com/.well-known/axioma-jwks.json`. The platform-architect handoff (P-D file list) names the route file `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts`, which would resolve to `/api/axioma/.well-known/jwks.json` under the Next.js App Router — not `/.well-known/axioma-jwks.json`. These resolve to different URL paths.

The contract (`docs/CONTRACTS/axioma-bridge.md §17.4.1`) says the endpoint is `https://app.wtc.example.com/.well-known/axioma-jwks.json`.

**Recommendation:** The JWKS route file must be placed at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (no `/api/axioma/` prefix) so it resolves to `/.well-known/axioma-jwks.json`. This path must be coordinated with the Axioma team — they will cache and call this exact URL. Axioma-team confirmation of the public key URL is a hard prerequisite before moving the HS256 guard from dev-stub to production (activation checklist item in contract §17.4.2). The P-D file list in the platform-architect handoff is incorrect and must be updated.

**Target part:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (correct path)

---

### F-4 — Precise ES256/JWKS implementation specification (severity: informational, forward spec)

This finding provides the exact implementation shape for `handoffToken.ts` and `jwks.ts` for the Wave-2 implementer. It is derived from `AXIOMA_HANDOFF_TOKEN_SPEC.md` and `CONTRACTS/axioma-bridge.md §6.1`.

#### 4a. `packages/axioma-bridge/src/handoffToken.ts` — ES256 signer

Environment inputs:
- `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>`: PEM private key, base64-encoded. Decoded at startup, never logged, never serialized into any response or audit event. The decoded PEM must be kept in a module-scoped variable that is not exported.
- `WTC_AXIOMA_ACTIVE_SIGN_KID`: the active key id string, e.g. `wtc-axioma-sign-2026-01`.

JWT header:
```json
{ "alg": "ES256", "typ": "JWT", "kid": "<active-kid>" }
```

JWT payload claims (all required):
- `iss`: exact string `"https://app.wtc.example.com"` — matches `HANDOFF_ISSUER` already defined in `handoff.ts`
- `aud`: `"https://axi-o.ma"` — Axioma validates this exactly
- `sub`: WTC user UUID (string)
- `jti`: `crypto.randomUUID()` — UUID v4, replay prevention
- `iat`: Unix seconds, `Math.floor(Date.now() / 1000)`
- `exp`: `iat + 300` (5-minute TTL, matching `HANDOFF_TTL_MS / 1000`)
- `nbf`: equal to `iat` — token is immediately valid
- `wtc_flow`: `'open_journal' | 'account_link'`
- `wtc_entitlement`: `{ product_code: 'axioma_terminal', state: 'active' | 'grace', expires_at: string }` — snapshot at issuance; Axioma must re-verify for sensitive flows
- `wtc_axioma_user_id`: linked Axioma user id (string) or `null` if not yet linked
- `nonce`: `crypto.randomBytes(32).toString('hex')` — 32-byte hex, matched against the WTC session's CSRF nonce server-side

Algorithm: `ES256` using Node.js `crypto.sign()` with the decoded P-256 private key. The implementation must use Node's built-in `crypto` module (zero external JWT library dependency), following the same pattern as `handoff.ts`. The header and payload are base64url-encoded separately; the DER signature output from `crypto.sign('SHA256', ...)` must be converted from DER encoding to the 64-byte IEEE P1363 (r||s) format that ES256 expects before base64url-encoding.

Private key handling constraints:
- The decoded PEM buffer must never be returned by any exported function.
- It must never appear in an audit log entry or error message.
- If `WTC_AXIOMA_ACTIVE_SIGN_KID` is unset, the function must throw with message `[axioma-handoff] ES256 signer not configured — set WTC_AXIOMA_ACTIVE_SIGN_KID`.
- If `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` is unset for the active kid, the function must throw with message `[axioma-handoff] ES256 private key not found for kid: <kid>` (never include the key value, only the kid).

#### 4b. `packages/axioma-bridge/src/jwks.ts` — JWKS public key builder

This module exports ONLY the public JWK, never the private key.

Function: `buildJwksResponse(privateKeyPem: string, kid: string): { keys: JwkPublicKey[] }`

The function must:
1. Parse the PEM string using `crypto.createPublicKey(crypto.createPrivateKey(pem))` to extract the public key only.
2. Export the public key as JWK via `publicKey.export({ format: 'jwk' })`.
3. Return the JWK with the required additional fields: `use: 'sig'`, `alg: 'ES256'`, `kid`.
4. The returned object must contain only `kty`, `crv`, `use`, `alg`, `kid`, `x`, `y` — never `d` (the private scalar). The implementation must assert `'d' in jwk === false` before returning; if `d` is present, throw `[axioma-jwks] private key material detected in JWKS output — this is a bug`.
5. Supports multiple keys (for rotation overlap): if multiple `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` vars are configured, `buildJwksResponse` collects all public keys into the `keys` array.

The JWKS response shape:
```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "use": "sig",
      "alg": "ES256",
      "kid": "wtc-axioma-sign-2026-01",
      "x": "<base64url>",
      "y": "<base64url>"
    }
  ]
}
```

#### 4c. `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` — public JWKS route

This is a Next.js App Router Route Handler. It must:
- Require NO authentication (public endpoint, Axioma fetches it without credentials).
- Return `Content-Type: application/json`.
- Return `Cache-Control: public, max-age=3600, s-maxage=3600`.
- Call `buildJwksResponse(...)` with the active private key and kid from env.
- If env vars are unset (dev mode / no ES256 keys configured), return `{ "keys": [] }` with status 200 — do not throw a 500; an empty JWKS is a valid signal that the production signer is not yet configured.
- Never log or expose `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` in any error output from this route.

---

### F-5 — jti/replay persistence: no `axioma_handoff_jti_revocations` table in current or planned schema (severity: medium, honest gap)

**Evidence:** `AXIOMA_HANDOFF_TOKEN_SPEC.md` defines a `axioma_handoff_jti_revocations` table with columns `jti, sub, issued_at, expires_at, used_at, revoked_at, revoke_reason`. The `docs/handoffs/20260530-0126-ecosystem-db-architect.md` (migration 0002 design) does not include this table — it is not in the REAL-in-0002 or TARGET columns for the Axioma bounded context. The db-architect handoff covers only `terminal_release_cache`, `terminal_download_events`, `terminal_license_events` for the Axioma context.

**Consequence:** Full server-side jti replay prevention (Option A in the token spec) is not achievable with the current migration plan. The token spec's Option B — a local bloom filter / Redis set on the Axioma side — is simpler and does not require a new WTC table, but it requires Axioma to maintain a Redis TTL set, which is an Axioma team commitment that has not been confirmed. Without either option, the jti claim exists in tokens but replay prevention is not enforced end-to-end.

**Recommendation:** Document this clearly as a TARGET gap. The `axioma_handoff_jti_revocations` table must be added to the migration 0002 scope (db-architect to confirm) or deferred to a migration 0003 with an explicit activation gate: the production JWKS signer must not be promoted to `bridgeMode: 'real'` until replay prevention is active. The activation checklist in contract §17.4.2 already has a gate for "All tests in §13 green" — that gate implicitly requires replay prevention because `handoff-token.test.ts` tests the single-use constraint. Make it explicit: add a checklist item "axioma_handoff_jti_revocations table migrated OR Axioma team confirms Redis jti store active".

**State label:** jti is PRESENT in token claims and CORRECT by spec; server-side WTC persistence of jti state is TARGET — not yet achievable with current schema.

---

### F-6 — /products/axioma-terminal: public page content model is a minimal stub; full content model is designed but not implemented (severity: low, informational)

**Evidence:** `apps/web/src/app/(public)/products/[slug]/page.tsx` line 9: the `axioma_terminal` entry in `COPY` has a single tagline and 4 bullets. The full content model (three-panel description, feature highlights, hard-boundary callout, screenshots slot, pricing section, account-link explainer) is specified in `docs/TERMINAL_PRODUCT_AREA.md §2.2` and `docs/CONTRACTS/axioma-bridge.md §17.1`. This gap was noted in Phase 2 predecessor handoff (F-7) and remains open.

The public product page correctly makes NO bridge call — it is static content + availability status only. This is correct by design.

**Recommendation:** Wave-2 P-D group (Axioma product pages) should expand this page using the content model in `TERMINAL_PRODUCT_AREA.md §2.2` and `contract §17.1`. No bridge wiring is required for this expansion. Screenshot slots must use placeholder text until Axioma team provides assets — no fabricated screenshots.

**Target part:** `apps/web/src/app/(public)/products/[slug]/page.tsx` or a dedicated `apps/web/src/app/(public)/products/terminal/page.tsx`

---

### F-7 — /app/terminal dashboard: entitlement state machine does not handle `grace` or `revoked` tones correctly (severity: medium, carry-forward)

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx` line 32:
```typescript
const licenseTone: Tone = state?.license.status === 'active' ? 'ok' : state?.license.status === 'expired' ? 'bad' : 'neutral';
```

`bridge.ts` line 8: `export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'none';`

Two problems:
1. `'grace'` is not in `LicenseStatus` so when the real bridge returns `'grace'`, TypeScript would accept it but the tone mapping falls to `'neutral'` (should be `'warn'` per contract §17.2).
2. `'revoked'` is likewise absent — falls to `'neutral'` instead of `'bad'`.
3. The mock bridge uses `'inactive'` which is not a journal_server value; the server returns `'none'` for no-record.

This is the same gap documented in F-1 of the Phase 2 predecessor handoff. It remains unresolved because the bridge type extension is a Wave-2 implementation task, not a Phase 2 doc task.

**Recommendation:** Wave-2 S-8 must extend `LicenseStatus` to `'active' | 'grace' | 'expired' | 'revoked' | 'none' | 'unknown'` in `bridge.ts` before the real bridge is wired. The tone mapping in `terminal/page.tsx` must be updated to: `active → ok`, `grace → warn`, `expired → bad`, `revoked → bad`, `none | unknown → neutral`. The `'inactive'` value must be removed from `LicenseStatus`.

**Target part:** `packages/axioma-bridge/src/bridge.ts` (type), `apps/web/src/app/(app)/app/terminal/page.tsx` (tone mapping)

---

### F-8 — /app/terminal download CTA: mock URL is a plain file path, not a signed proxy URL (severity: low, by design; confirmed acceptable)

**Evidence:** `bridge.ts` line 66: `url: hasEntitlement ? \`${base}/releases/axioma-setup-${SAMPLE_RELEASE.version}.exe\` : undefined`

This is a plain constructed URL, not a WTC proxy token URL. The download button is explicitly disabled when `isDev === true` (terminal/page.tsx line 76), so this URL is never fetched in the mock state. This is the correct and intentional behavior described in contract §17.3.3.

**Confirmed:** The mock download URL is a non-functional placeholder. The implementation is correct for dev/mock mode. Real bridge wiring requires implementing the WTC proxy endpoint at `/api/axioma/download/terminal` with a short-lived single-use token stored in `terminal_download_events`, as specified in contract §5.5 Option B.

**Record:** `terminal_download_events.entitlement_verified` must be set to the result of the entitlement check at download time — not to a hardcoded value. The `recordDownloadEvent` function signature from the db-architect handoff confirms this: `{ entitlementVerified: boolean }` is a required field.

---

### F-9 — Account-link flow: `beginAccountLink` in mock bridge does not write to `axioma_account_links` (severity: low, by design in mock)

**Evidence:** `bridge.ts` lines 77-82: `beginAccountLink` returns a UUID as the one-time code (OTC) and a computed expiry, but writes nothing to the database. This is correct for the mock bridge — the real bridge will write to `axioma_account_links` with `link_status: 'pending'` and `link_nonce_hash` (hash of OTC, never the raw OTC).

**Hard boundary confirmed:** The mock OTC is `globalThis.crypto.randomUUID()` — a UUID, not a cryptographically random 32-byte token. The real OTC must be `crypto.randomBytes(32).toString('base64url')` per contract §7.1. The mock UUID serves the mock flow but must not be used in production.

**Audit constraint (non-negotiable):** The raw OTC value must never appear in `audit_logs`. Only `link_nonce_hash` (hash of OTC) is stored. The OTC is shown to the user once and discarded after consumption. The `recordLicenseEvent` signature (`terminal_license_events.metadata: JSONB, no plaintext keys`) enforces this at the schema level.

---

### F-10 — HS256 production guard: confirmed correct; must remain in place (severity: informational)

**Evidence:** `packages/axioma-bridge/src/handoff.ts` lines 62-64:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production; implement the ES256/JWKS signer first');
}
```

`packages/axioma-bridge/src/handoff.test.ts` lines 39-49: the test `'refuses to sign in production'` explicitly verifies this throw by temporarily setting `process.env.NODE_ENV = 'production'`.

**Confirmed:** The HS256 path is unreachable in production because:
1. The `signHandoffToken` function throws on `NODE_ENV === 'production'`.
2. The Vitest test asserts this throw.
3. The `createJournalHandoff` method in the mock bridge calls `signHandoffToken`, so the mock bridge's journal-open action also throws in production — the "Open Journal" button being disabled in dev mode (`isDev === true`) prevents this code path from being triggered in normal UI flow.

The HS256 guard must remain in place exactly as written. When `handoffToken.ts` is implemented, it becomes the production signer and `handoff.ts` continues to serve dev/test only.

---

### F-11 — No production bridge claim is possible without Axioma team confirmation (severity: informational, reaffirmed)

**Evidence:** `docs/CONTRACTS/axioma-bridge.md §11` mock-vs-real status table; contract §17.4.2 activation checklist.

The activation checklist has the following items not yet satisfied:
- `AXIOMA_BRIDGE_API_TOKEN` set: not set (`.env.example` line 34 shows blank value)
- `ENTITLEMENT_ENABLED=True` on journal_server: not confirmed
- `release-manifest.json` deployed on journal_server: not confirmed
- `terminal_release_cache`, `terminal_download_events`, `terminal_license_events` tables: TARGET in migration 0002, not yet migrated
- OTC account-link bridge endpoint `/api/axioma/link`: not implemented
- Download proxy endpoint `/api/axioma/download/terminal`: not implemented
- ES256/JWKS signer: not implemented (`handoffToken.ts` does not exist)
- JWKS endpoint live: not implemented
- Axioma team confirms token validation endpoint live and tested: not confirmed
- Rename migration resolved: OPEN_QUESTIONS Q-1 still open

**Bridge stays mock/dev.** `bridgeMode` is `'mock'` and must remain so until every checklist item is satisfied and verified. WTC does NOT proxy journal data — `JournalLink` is specified to open `axi-o.ma` in a new tab with the handoff token; the actual journal data lives entirely on `axi-o.ma`. This boundary is architectural and must not be crossed.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| Canonical signer filename is `handoffToken.ts`, not `signer.ts` | `AXIOMA_HANDOFF_TOKEN_SPEC.md` (security-auditor owned) outranks the platform-architect planning handoff on security-critical file naming |
| JWKS route path is `/.well-known/axioma-jwks.json` (no `/api/axioma/` prefix) | Matches `AXIOMA_HANDOFF_TOKEN_SPEC.md` and the contract §17.4.1 spec; Axioma team will call this exact URL |
| jti replay persistence is TARGET, not Wave-2 | `axioma_handoff_jti_revocations` is absent from migration 0002 scope; this is an honest gap, not a silent omission |
| Private key never in exports, logs, or error messages | Non-negotiable security constraint enforced by `jwks.ts` asserting absence of `d` claim |
| Mock OTC TTL is `HANDOFF_TTL_MS * 2` (10 min); real OTC TTL must be 10 min per contract §7.1 | Consistent — the mock double-TTL is a known deviation harmless in dev; real bridge uses 10 min |
| `bridgeMode` stays `'mock'` in production until all checklist items green | Honest about state; no fake integration |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DER-to-P1363 signature conversion omitted in ES256 signer implementation | Critical | The implementer must convert `crypto.sign('SHA256', ...)` DER output (which starts with `0x30`) to the 64-byte raw r\|\|s format before base64url encoding; test: verify round-trip against a known ES256 verifier |
| Private key `d` component accidentally included in JWKS response | Critical | `jwks.ts` must assert `!('d' in jwk)` before returning; unit test must verify the `x`, `y`, `kty`, `crv` fields are present and `d` is absent |
| JWKS route URL mismatch breaks Axioma JWKS auto-discovery | High | Route must be at `/.well-known/axioma-jwks.json`; coordination with Axioma team required before promotion to production |
| jti replay not server-persisted at launch | Medium | 5-minute TTL and short-lived nature of tokens reduce practical replay risk; Option B (Axioma Redis) is acceptable for MVP per token spec; documented TARGET |
| `LicenseStatus` type not extended before real bridge wiring | Medium | Carry-forward from Phase 2 F-1; must be resolved in Wave-2 S-8 before real bridge can activate |
| Rename migration (`com.greenfield.terminal` → Axioma) changes `product` field in release manifest | Medium | UI and cache must use `state.release.product` from the server, never hardcode; see contract §12 |
| OTC raw value leaked into audit logs | High | `recordLicenseEvent` metadata must be scrubbed; only hash stored; enforced by schema (no plaintext keys in metadata JSONB) |
| ES256 env vars absent from `.env.example` and `config/env.ts` | Medium | Must be added in Wave-2 spine S-8 before implementation begins |

---

## Verification/tests

No tests were run this session (read-only audit).

The following tests are specified as required for Phase 2.1 before any production bridge activation. These are authoritatively derived from `AXIOMA_HANDOFF_TOKEN_SPEC.md`, `CONTRACTS/axioma-bridge.md §13`, and the gaps identified in this audit.

### ES256 sign+verify round-trip

File: `packages/axioma-bridge/src/handoffToken.test.ts` (to be created in Wave-2)

```
test: issueHandoffToken produces a token with alg='ES256' in header
test: token verifies with the corresponding public key (use jwks.ts buildJwksResponse output)
test: token does NOT verify with a different P-256 key pair
test: token header contains kid matching WTC_AXIOMA_ACTIVE_SIGN_KID
test: all required claims present: iss, aud, sub, jti, iat, exp, nbf, wtc_flow, wtc_entitlement, wtc_axioma_user_id, nonce
test: exp = iat + 300 exactly (5-minute TTL)
test: nbf = iat (immediately valid)
test: wtc_entitlement.state must be 'active' or 'grace'; passing 'expired' throws
test: private key d-component is NOT present in token (token payload checked)
```

### HS256 throws in production (existing test must remain green)

File: `packages/axioma-bridge/src/handoff.test.ts` (existing, line 39)

```
test: 'refuses to sign in production — the HS256 dev-stub is fenced until the ES256/JWKS signer exists'
  → must remain green; this test must not be removed or modified when handoffToken.ts is added
```

### JWKS exposes only public key (no private material)

File: `packages/axioma-bridge/src/jwks.test.ts` (to be created in Wave-2)

```
test: buildJwksResponse returns an object with keys array
test: each key in keys array contains kty='EC', crv='P-256', use='sig', alg='ES256', kid, x, y
test: NO key in keys array contains field 'd' (private scalar) — critical security assertion
test: buildJwksResponse called with a P-256 private key PEM produces a key that verifies a signature made by issueHandoffToken with that key
test: buildJwksResponse with two different keys returns two entries in the keys array (rotation support)
```

### Terminal release current-exclusivity

File: integration test targeting `upsertTerminalRelease` in `packages/db/src/repositories.ts` (Wave-2, PGlite)

```
test: after upsertTerminalRelease(version='1.5.0', channel='stable', platform='windows-x64'), only one row has is_current=true for that channel/platform combination
test: prior stable/windows-x64 row (e.g. '1.4.0') has is_current set to false after upsert of '1.5.0'
test: getCurrentTerminalRelease('stable', 'windows-x64') returns the '1.5.0' row
test: getCurrentTerminalRelease('beta', 'windows-x64') returns null when only stable rows exist
```

### Download event records entitlement_verified

File: integration test targeting `recordDownloadEvent` in `packages/db/src/repositories.ts` (Wave-2, PGlite)

```
test: recordDownloadEvent with entitlementVerified=true writes a row; reading the row back shows entitlement_verified=true
test: recordDownloadEvent with entitlementVerified=false writes a row; reading back shows entitlement_verified=false
test: recordDownloadEvent without a matching terminal_release_cache.id (FK violation) throws — entitlement_verified is meaningless without a valid release reference
test: audit log entry 'terminal.download' is written in the same transaction as the event row
```

### Existing smoke test must remain green

File: `packages/axioma-bridge/src/__smoke__.ts` (existing)

```
7 assertions: sign/verify, expiry, aud-mismatch, tamper, wrong-secret, replay, no-keys-in-token
All must remain green after handoffToken.ts is added (adding a file must not break existing tests)
```

---

## Next actions

1. **Wave-2 implementer (S-8):** Create `packages/axioma-bridge/src/handoffToken.ts` (not `signer.ts` — see F-1). Implement `issueHandoffToken` and `consumeHandoffJti` per `AXIOMA_HANDOFF_TOKEN_SPEC.md`. Include DER-to-P1363 signature conversion. Ensure private key never leaves the module scope.

2. **Wave-2 implementer (S-8):** Create `packages/axioma-bridge/src/jwks.ts`. Assert `!('d' in jwk)` before returning. Export only `buildJwksResponse` — no private key type or function exported.

3. **Wave-2 implementer (S-8):** Create `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (correct path — NOT `/api/axioma/.well-known/jwks.json/route.ts`). Add `Cache-Control: public, max-age=3600`. Return `{ keys: [] }` gracefully when env vars absent.

4. **Wave-2 implementer (S-8):** Add `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` and `WTC_AXIOMA_ACTIVE_SIGN_KID` to `.env.example` (with placeholder values and generation instructions) and `packages/config/src/env.ts` (as `z.string().optional()`).

5. **Wave-2 implementer (S-8):** Extend `LicenseStatus` in `packages/axioma-bridge/src/bridge.ts` to include `'grace' | 'revoked' | 'unknown'`; remove `'inactive'`. Update tone mapping in `apps/web/src/app/(app)/app/terminal/page.tsx` accordingly.

6. **db-architect:** Confirm whether `axioma_handoff_jti_revocations` should be added to migration 0002 or deferred to 0003. Add an explicit checklist item to contract §17.4.2 activation gate: "jti replay prevention active (WTC table OR Axioma Redis store confirmed)".

7. **platform-architect:** Correct the JWKS route file path in the P-D file list (platform-architect handoff `20260530-0126` S-8 and P-D sections) from `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts` to `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`.

8. **Wave-2 implementer (P-D):** When implementing the `AccountLinkFlow` component and `beginAccountLink` action: the real OTC must use `crypto.randomBytes(32).toString('base64url')`, not `randomUUID()`. Write only the hash of the OTC to `axioma_account_links.link_nonce_hash` and to `terminal_license_events.metadata`. Never write the raw OTC value to any DB column, log, or audit event.

9. **operator:** Coordinate with Axioma team to confirm the JWKS URL (`https://app.wtc.example.com/.well-known/axioma-jwks.json`), the token validation endpoint (`https://axi-o.ma/wtc-handoff`), and jti replay handling (Option A vs B per token spec). These confirmations unblock the activation checklist.
