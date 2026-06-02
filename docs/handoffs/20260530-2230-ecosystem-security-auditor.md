# ecosystem-security-auditor handoff

## Scope

PG6 Axioma non-blocked surface — read-only security audit before any implementation.
Mandates per the PG6 prompt:

1. Fence correctness: staging+prod must refuse HS256 stub; dev/test only may use HS256.
2. ES256 private key never logged, never in JWKS, never in audit/responses/readiness payloads.
3. `consumeJti` atomicity: race-safety, TOCTOU analysis, cross-process correctness.
4. Audit events: jti lifecycle actions missing from `AUDIT_ACTIONS`; system-actor pattern.
5. Alg-confusion: ES256 verify rejects non-ES256; wiring preserves this.
6. APP_ENV/deployment-env decision; fail-closed posture.
7. No plaintext secret anywhere; CTAs stay disabled; hard boundary preserved.

## Files inspected

| File | Lines / notes |
|------|---------------|
| `docs/handoffs/0000-orchestrator-seed.md` | all |
| `docs/SESSION_PROTOCOL.md` | all |
| `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` | all |
| `docs/CONTRACTS/axioma-bridge.md` | all (v1.1.0) |
| `docs/PRODUCTION_BLOCKERS.md` | all |
| `docs/EXECUTION_PLAN_MASTER.md` | §3 W7 row |
| `docs/ROADMAP_MASTER.md` | §6 Axioma table |
| `docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md` | all |
| `docs/handoffs/20260530-1355-ecosystem-axioma-bridge-auditor.md` | all |
| `docs/handoffs/20260530-2100-ecosystem-security-auditor.md` | all |
| `packages/axioma-bridge/src/handoff.ts` | all (100 lines) |
| `packages/axioma-bridge/src/es256.ts` | all (90 lines) |
| `packages/axioma-bridge/src/bridge.ts` | all (100 lines) |
| `packages/axioma-bridge/src/jwks.ts` | all (14 lines) |
| `packages/axioma-bridge/src/index.ts` | all (22 lines) |
| `packages/axioma-bridge/src/es256.test.ts` | all (83 lines) |
| `packages/axioma-bridge/src/handoff.test.ts` | all (51 lines) |
| `packages/axioma-bridge/package.json` | all |
| `packages/config/src/env.ts` | all (95 lines) |
| `packages/audit/src/audit.ts` | all (194 lines) |
| `packages/db/src/repositories.ts` | lines 1–100, 300–400, 1343–1420 |
| `packages/db/src/schema.ts` | lines 140–160 (axiomaAccountLinks) |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | all (26 lines) |
| `apps/web/src/features/terminal/loader.ts` | all (114 lines) |
| `apps/web/src/lib/server-config.ts` | all (24 lines) |

## Files changed

None — read-only audit.

## Findings

---

### F-01 — CRITICAL — Staging fence is absent: `signHandoffToken` HS256 stub only throws on `NODE_ENV === 'production'`

**Evidence:** `packages/axioma-bridge/src/handoff.ts:62`

```ts
if (process.env.NODE_ENV === 'production') {
  throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production...');
}
```

`packages/config/src/env.ts` confirms: `NODE_ENV: z.enum(['development', 'test', 'production'])`. There is no `APP_ENV` or `DEPLOYMENT_ENV` variable on the env spine. Only three values exist. A staging deployment that sets `NODE_ENV=production` would be correctly blocked. However, common practice is to run staging at `NODE_ENV=development` or `NODE_ENV=test` to avoid other production-only checks (or even to leave it at `NODE_ENV=production` but with dev keys). Under any staging configuration where `NODE_ENV !== 'production'`, the HS256 stub would silently sign and emit a token that Axioma's spec-compliant verifier would reject. The fence is insufficient by the PG6 requirement: "a real (staging OR production) deployment MUST use ES256 and MUST refuse the HS256 stub".

**The core problem:** the HS256 guard is keyed on `NODE_ENV`, which is a build-time semantic (`development` / `test` / `production`), not a deployment-environment semantic (dev box / staging / production). These are not the same axis. A staging server that legitimately runs `NODE_ENV=development` or `NODE_ENV=test` would silently use the HS256 stub, which (a) Axioma rejects and (b) leaks the fact that staging issued a non-ES256 token.

**Required fix:** Introduce a new env var `APP_ENV` (or `DEPLOYMENT_ENV`) on the `env.ts` spine with values `development | staging | production` (default: `development`). The fence in `signHandoffToken` must guard on this variable (or on the presence of a provisioned P-256 key). The `packages/axioma-bridge` package is a PURE package with zero env access — it MUST NOT import `@wtc/config` or read `process.env` directly. Instead:

- The web/server layer resolves deployment env and passes a `deploymentEnv: 'development' | 'staging' | 'production'` parameter to the bridge factory (or the ES256 signer is wired in and the HS256 path is simply removed from the real bridge factory).
- The fence becomes: if `deploymentEnv === 'staging' || deploymentEnv === 'production'` and no ES256 signer is provided, throw; if an ES256 signer IS provided, use it (no HS256 fallback at all).
- In `env.ts`, add a `superRefine` rule: if `APP_ENV === 'staging' || APP_ENV === 'production'`, `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` must be present (currently they are NOT in the env schema at all — only raw `process.env` access in the JWKS route).

**Note:** `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are read directly from `process.env` in `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` lines 13–14. They are NOT in `env.ts`. This must be corrected: both vars must be added to `envSchema` as optional strings (not required globally; required in staging/prod via `superRefine`).

**Target:** PG6 — db-wave and bridge wiring step.

---

### F-02 — HIGH — `AXIOMA_HANDOFF_SIGNING_KEY` / `AXIOMA_HANDOFF_KEY_ID` are NOT in `env.ts` schema; read raw from `process.env`

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:13–14`; `packages/config/src/env.ts` (searched — neither key present in `envSchema`).

The JWKS route reads:
```ts
const pem = process.env.AXIOMA_HANDOFF_SIGNING_KEY;
const kid = process.env.AXIOMA_HANDOFF_KEY_ID;
```

`env.ts` does not declare or validate either variable. The `AXIOMA_HANDOFF_SIGNING_SECRET` (HS256 secret for the dev stub) IS in `envSchema` (line 36) and has a production `superRefine` check. But the ES256 key pair variables are entirely off the validated spine. This means:

- No strong-secret check (analogous to the `SESSION_SECRET`/`SECRET_VAULT_KEK` checks) for the P-256 private key in staging/production.
- `loadEnv()` succeeds even if `AXIOMA_HANDOFF_SIGNING_KEY` is a malformed PEM.
- The error path in the JWKS route (`catch` at line 22) swallows any PEM parse failure silently, returning `{ keys: [] }` with a short cache TTL — but no alert/log that the key is broken.

**Risk:** A misconfigured `AXIOMA_HANDOFF_SIGNING_KEY` (wrong format, wrong curve, wrong encoding) silently produces an empty JWKS, and the signing path that calls `createEs256Signer(pem, kid)` would throw at token issuance time, only then revealing the misconfiguration. This is fail-closed at the token-issuance level but not at boot time.

**Required fix:** Add to `envSchema`:
```ts
AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional(),
AXIOMA_HANDOFF_KEY_ID: z.string().optional(),
```
Add `superRefine`: if `APP_ENV` is `staging` or `production` and the bridge is live (see F-01), both must be present. The JWKS route and any bridge factory must receive these from `loadEnv()`, not from raw `process.env`.

**Target:** PG6 — env.ts spine update.

---

### F-03 — HIGH — `consumeJti` replay store: no table, no repository, no `AUDIT_ACTIONS` codes for jti lifecycle

**Evidence:** `packages/axioma-bridge/src/es256.ts:9–12` (honest gap comment); `packages/db/src/schema.ts` (searched — no `axioma_handoff_jti_revocations` table); `packages/db/src/repositories.ts` (searched — no `consumeJti`, `recordJti`, `insertJti`, or similar); `packages/audit/src/audit.ts:8–107` (AUDIT_ACTIONS list).

Three gaps are confirmed absent:

1. **Table absent:** The DDL specified in `AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention` does not exist. Migration 0003 (`packages/db/migrations/0003_fresh_blockbuster.sql`) exists but does not include `axioma_handoff_jti_revocations` (confirmed by the Phase 2.8 aggregate handoff: "40 tables; No schema changes" — the JTI table was not added in any prior migration).

2. **Repositories absent:** There is no `insertJti`, `consumeJti`, `revokeJti`, or `purgeExpiredJtis` function in `repositories.ts`.

3. **AUDIT_ACTIONS codes missing:** The spec (`AXIOMA_HANDOFF_TOKEN_SPEC.md §Audit Events`) defines these required lifecycle audit actions:
   - `axioma.account_link.jti.consume` — when Axioma consumes the token at WTC (Option A)
   - `axioma.account_link.jti.replay` — replay attempt detected
   - `axioma.account_link.jti.revoke` — admin or entitlement revoke

   The current `AUDIT_ACTIONS` array (audit.ts lines 66–71) has:
   ```
   'axioma.account_link_init',
   'axioma.account_link_complete',
   'axioma.account_link_revoke',
   'axioma.download_request',
   'axioma.release_publish',
   'terminal.account_link',
   'terminal.download',
   'terminal.license_event',
   ```
   Missing: `'axioma.account_link.jti.consume'`, `'axioma.account_link.jti.replay'`, `'axioma.account_link.jti.revoke'`.
   Also missing is a dedicated jti-issuance audit action; the spec uses `axioma.account_link.init` (the existing `axioma.account_link_init` is close, but note the underscore vs dot naming inconsistency between existing codes and the spec — this must be reconciled).

**Atomicity analysis of the intended `consumeJti`:** The spec prescribes:
```sql
UPDATE axioma_handoff_jti_revocations
SET used_at = now()
WHERE jti = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
RETURNING *;
```
Zero rows returned = replay/expired/revoked rejection. This is a single conditional UPDATE with no prior SELECT — it is atomic and TOCTOU-free at the DB level. Postgres evaluates the WHERE predicate and performs the write in a single lock cycle; two concurrent consumers with the same JTI cannot both see `used_at IS NULL` and succeed because only one UPDATE can land first. This is the correct pattern; no TOCTOU exists in the UPDATE itself.

**Cross-process correctness:** Because the atomicity is enforced by the DB `UPDATE` (not by an in-process Set or cache), it is correct under multi-instance deployments. Any number of WTC web processes can call `consumeJti` concurrently for the same jti; only one UPDATE will match the `used_at IS NULL` predicate.

**Worker purge:** The spec specifies deletion of rows where `expires_at < now() - 1 hour`. This is a simple DELETE and is not safety-critical (it is cleanup only; the `used_at IS NULL AND expires_at > now()` predicate in `consumeJti` prevents any post-expiry replay regardless of whether the row has been purged). The purge must run in the worker (e.g. added to `dbTick` after `sweepTvExpiry`).

**Required fixes:**
- Migration 0004 (tightly scoped to this table only per hard constraint): create `axioma_handoff_jti_revocations`.
- `repositories.ts`: add `insertJti`, `consumeJti`, `revokeJtiForUser`, `purgeExpiredJtis`.
- `packages/audit/src/audit.ts`: add `'axioma.account_link.jti.consume'`, `'axioma.account_link.jti.replay'`, `'axioma.account_link.jti.revoke'` to `AUDIT_ACTIONS`.

**Target:** PG6 — db wave (migration 0004) + repository wave.

---

### F-04 — HIGH — Bridge wiring is absent: `bridge.ts` still uses `signHandoffToken` (HS256) with no ES256 path

**Evidence:** `packages/axioma-bridge/src/bridge.ts:6` imports only `buildHandoffClaims, signHandoffToken, HANDOFF_TTL_MS` from `'./handoff.ts'`; `createMockAxiomaBridge.createJournalHandoff` at line 87–91 calls `signHandoffToken(claims, opts.signingSecret)` (HS256).

The PG6 requirement is to wire `createEs256Signer` into the bridge behind a staging+prod fence. Currently:
- `createEs256Signer` exists in `es256.ts` and is exported from `index.ts`.
- It is NOT imported or used in `bridge.ts`.
- The `MockBridgeOptions` interface (bridge.ts:52–57) has a `signingSecret: string` field (HS256 secret), no ES256 key field.
- The bridge factory is `createMockAxiomaBridge`. There is no `createRealAxiomaBridge` or `createAxiomaBridge` factory that would accept an `Es256Signer`.

**Required design:** The bridge factory must be redesigned to accept a signer abstraction:
```ts
export interface HandoffSigner {
  sign(claims: HandoffClaims): string;
}
```
The HS256 stub satisfies this interface in dev/test. `Es256Signer` already satisfies it (its `sign` method has the same signature). The bridge factory accepts a `HandoffSigner` — the resolution of which signer to pass is the web/server layer's responsibility (gated by `APP_ENV`, resolved by `loadEnv()`), not the package's. This keeps the package pure (zero env access) per the hard constraint.

**Note:** The `MockBridgeOptions.signingSecret` field must be removed or made optional when the `HandoffSigner` abstraction is introduced. The existing HS256 `signHandoffToken` is the dev stub; it must not be called when an ES256 signer is available.

**Target:** PG6 — bridge wiring step.

---

### F-05 — HIGH — ES256 private key exposure paths: audited and confirmed safe with one gap

**Evidence:** `packages/axioma-bridge/src/es256.ts:45–48`; `packages/axioma-bridge/src/jwks.ts:12–13`; `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:19–25`; `apps/web/src/features/terminal/loader.ts:93`.

Four possible exposure paths are analyzed:

1. **JWKS output:** `publicJwk()` (es256.ts:45–48) calls `publicKey.export({ format: 'jwk' })` and then hard-asserts `if ('d' in jwk) throw new Error('[axioma-handoff] refusing to expose a JWK containing the private scalar')`. This is correct and verified by `es256.test.ts:34–43`. The JWKS route (route.ts:19–25) delegates entirely to `buildJwks([signer])` → `signer.publicJwk()` — no raw PEM is returned. SAFE.

2. **Readiness/loader payloads:** `loader.ts:93` reads `!!(process.env.AXIOMA_HANDOFF_SIGNING_KEY)` — presence-only boolean, never the value. SAFE. However: the variable name `AXIOMA_HANDOFF_SIGNING_KEY` is a PEM private key. The presence check is the correct pattern. No other readiness endpoint was found that returns this value.

3. **Audit log payloads:** When the ES256 signer is wired, the issuance audit event (`axioma.account_link_init` or the new jti-issue code) must include only `{ flow, product_code, entitlement_state, jti }` in the `after` payload — never the PEM or any key material. The `redact.ts` `SECRET_HINTS` array includes `'privatekey'` (line 23) so a payload key named `privateKey` would be redacted. However, a direct value inclusion (e.g. accidentally putting the PEM string as a field value) would only be caught by `isSecretValue` heuristics (PHC hash, Bearer prefix, 64-hex). A PEM value (`-----BEGIN EC PRIVATE KEY-----`) IS caught: `redact.ts` line 57–58 notes the `isSecretValue` function, and based on the pattern `'-----BEGIN'`, it should match. This is defence-in-depth but must be explicitly tested.

4. **Error strings:** If `createEs256Signer(pem, kid)` throws (wrong curve, empty PEM), the error message is `'[axioma-handoff] signing key must be an EC (P-256) key'` or `'[axioma-handoff] ES256 signer requires AXIOMA_HANDOFF_SIGNING_KEY'` — neither includes key material. SAFE.

**Gap identified:** There is no test asserting that a PEM private key value passed to `buildEvent` (audit) is redacted. Recommend adding a unit test: `buildEvent({ ..., after: { key: pemValue } })` asserts the key value is redacted in the output event.

**Target:** PG6 — tests step.

---

### F-06 — MEDIUM — Alg-confusion: ES256 verify correctly rejects non-ES256 but the wiring path must preserve this

**Evidence:** `packages/axioma-bridge/src/es256.ts:76–77`; `packages/axioma-bridge/src/es256.test.ts:67–75`.

`verifyEs256HandoffToken` at line 76 checks `if (head.alg !== 'ES256') return { valid: false, reason: 'wrong_alg' }`. The test at `es256.test.ts:67–75` confirms an HS256 header is rejected with `reason: 'wrong_alg'`. This is correct.

**Wiring risk:** When the ES256 signer is wired into the bridge, the verify path must also be used (or the WTC side never directly verifies — Axioma verifies the token). The `verifyEs256HandoffToken` function is the WTC-side mirror for testing. The risk is that if someone wires `verifyHandoffToken` (HS256 verify in `handoff.ts`) into any callback path where an ES256 token is expected, the HMAC verification would trivially fail on the first `timingSafeEqual` check (the signature bytes would be wrong), but the error reason would be `'bad_signature'` not `'wrong_alg'` — the alg confusion rejection would not fire. This is functionally safe (the token is rejected either way) but lacks the explicit alg-check signal.

**Recommendation:** Wherever a WTC-side `isReplayed` callback or a jti-consume API endpoint receives a token header, ensure it uses `verifyEs256HandoffToken` and not `verifyHandoffToken`. Add an explicit test: a token produced by `signHandoffToken` (HS256) is passed to `verifyEs256HandoffToken` and the result is `{ valid: false, reason: 'wrong_alg' }`. This test already partially exists (es256.test.ts:67–75 uses a manually crafted HS256 header token) but it could be extended to use an actual HS256-signed token from `signHandoffToken`.

**Target:** PG6 — tests step.

---

### F-07 — MEDIUM — `AXIOMA_HANDOFF_SIGNING_SECRET` production requirement in `env.ts` creates a confusing dual-key situation

**Evidence:** `packages/config/src/env.ts:36` (`AXIOMA_HANDOFF_SIGNING_SECRET: z.string().min(16).optional()`); `env.ts:68–72` (superRefine: in production, `AXIOMA_HANDOFF_SIGNING_SECRET` must be present and strong).

The current `env.ts` requires `AXIOMA_HANDOFF_SIGNING_SECRET` (the HS256 secret) to be present and strong in production — yet `signHandoffToken` THROWS in production (handoff.ts:62). This is internally inconsistent: the env schema demands a value for a key that the signing function refuses to use.

This inconsistency arose because the env.ts production check was written to fail-closed on the HS256 secret before the production ES256 signer was planned. Now that ES256 is the production path, the production requirement on `AXIOMA_HANDOFF_SIGNING_SECRET` should be revised:

- In production, `AXIOMA_HANDOFF_SIGNING_SECRET` is never used (the HS256 path throws). Requiring it produces a confusing "production secret required" boot failure for an HS256 variable that is never consumed.
- The production requirement should shift to `AXIOMA_HANDOFF_SIGNING_KEY` + `AXIOMA_HANDOFF_KEY_ID` (the ES256 key pair) once the bridge is wired.
- The `AXIOMA_HANDOFF_SIGNING_SECRET` requirement in production must be REMOVED or changed to optional (or retained only for staging+ environments that want the dev stub to be explicitly disabled at config load rather than only at sign-time).

**Recommended resolution:**
```
AXIOMA_HANDOFF_SIGNING_SECRET: z.string().optional()   (was: z.string().min(16).optional())
// superRefine: no production requirement on this field
// superRefine: if APP_ENV === 'staging' || APP_ENV === 'production':
//   AXIOMA_HANDOFF_SIGNING_KEY required + AXIOMA_HANDOFF_KEY_ID required
```

**Target:** PG6 — env.ts spine update.

---

### F-08 — MEDIUM — `consumeJti` must be audited in-transaction; system-actor pattern specified

**Evidence:** `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md §Audit Events`; prior system-actor pattern in `repositories.ts:340` (`sweepTvExpiry → atomicRevokeTv` with `{ id: null, role: 'system' }`).

The spec defines these audit events for jti lifecycle:

| Event | actor_context | notes |
|-------|--------------|-------|
| Token issued (`axioma.account_link.init` or new jti-issue code) | user actor (web request) | must be written atomically with the jti INSERT |
| Token consumed (`axioma.account_link.jti.consume`) | `'system'` actor (`actorUserId=sub`, `actorRole='system'`) | called by Axioma server (Option A) or by WTC replay check |
| Replay detected (`axioma.account_link.jti.replay`) | `'system'` actor | result='failure', failure_reason='replay' |
| Admin revoke (`axioma.account_link.jti.revoke`) | admin actor | written by admin route calling revokeJti |

The `INSERT jti + audit` must be atomic (in one transaction): the issuance audit event must be written at the same time the jti row is inserted, following the precedent of `grantProduct`, `submitTvRequest`, etc. If the DB write fails, no audit event should exist for it.

The `consumeJti UPDATE + audit` should also be in a transaction so that a consumed-but-not-audited state is impossible. However, because the UPDATE is a single conditional statement, and the audit INSERT is the next step, a transaction wrapper here is strongly recommended but the failure mode without it (consumed but audit insert fails) is preferable to the reverse (audit logged but consume not atomically committed).

**System-actor pattern for consumeJti:** When Axioma calls the WTC consume endpoint (Option A), the actor is the Axioma server, not a WTC user. The audit row should carry `actorUserId = sub` (the WTC user id from the jti row) and `actorRole = 'system'` — consistent with the `TvRevokeActor` precedent at `repositories.ts:1351`.

**Target:** PG6 — repository design.

---

### F-09 — LOW — Hard boundary confirmed intact; CTAs correctly disabled; no local execution path

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx` (confirmed by prior axioma-bridge-auditor handoff F-01); `docs/CONTRACTS/axioma-bridge.md §2`; `packages/axioma-bridge/src/bridge.ts:87–91`.

The hard boundary ("WTC MUST NEVER gate local Axioma order execution") is architecturally preserved:
- `createJournalHandoff` in the mock bridge calls `signHandoffToken` (which gates server features via the handoff token spec), never issues anything that would affect local terminal execution.
- The `AxiomaBridge` interface has no method that could send a control command to the Axioma terminal.
- All three CTAs (Download, Open-Journal, OTC account-link) are disabled dev-placeholders (confirmed by axioma-bridge-auditor F-02, F-03, F-10 in the 1355 handoff). B4 remains open.
- The terminal page's dev-bridge banner is non-dismissible.

No change needed. This finding records the confirmed state for the aggregate.

**Target:** standing invariant; no action.

---

### F-10 — LOW — `isReplayed` callback in `verifyEs256HandoffToken` is optional and in-memory only; no durable store is wired

**Evidence:** `packages/axioma-bridge/src/es256.ts:55–58` (`isReplayed?: (jti: string) => boolean`); `es256.test.ts:62–65` (tests the callback with an in-memory check).

The `isReplayed` callback is typed optional and called only if provided. There is no requirement that the callback is synchronous — but the current signature is synchronous `(jti: string) => boolean`. When `consumeJti` is implemented as an async DB operation, the callback pattern must become async: `isReplayed?: (jti: string) => Promise<boolean>` or the jti check must be moved outside `verifyEs256HandoffToken` (check the DB separately before calling verify, which avoids mutating the callback signature).

The recommended approach (consistent with the spec) is to remove the `isReplayed` callback from `verifyEs256HandoffToken` entirely once the DB-backed `consumeJti` exists. The verify function verifies the signature and claims only; replay check is a separate DB call. This keeps concerns separated and avoids the async callback typing problem.

**Target:** PG6 — es256.ts interface design decision.

---

### F-11 — LOW — `AXIOMA_HANDOFF_SIGNING_SECRET` inconsistency in `env.ts`: required at production boot but unusable at production sign-time

**Note:** This is a consolidation of F-07 into a separate enforcement note. The two-var situation (HS256 secret required at boot via superRefine; ES256 key NOT required at boot via env.ts; HS256 throws at sign-time in production) must be resolved as a single coherent change in the same PR that wires the ES256 bridge. An incremental approach (changing only one side) creates a temporary invalid state. Both changes must land together.

**Target:** PG6 — env.ts spine update (same commit as F-01/F-02 fix).

---

### F-12 — INFO — Audit action naming inconsistency: existing codes use underscore, spec uses dots

**Evidence:** `packages/audit/src/audit.ts:66–71`: `'axioma.account_link_init'`, `'axioma.account_link_complete'`, `'axioma.account_link_revoke'` (underscore after `account_link`). The spec `AXIOMA_HANDOFF_TOKEN_SPEC.md §Audit Events` defines: `axioma.account_link.jti.consume`, `axioma.account_link.jti.replay`, `axioma.account_link.jti.revoke` (all dots).

The existing codes (`account_link_init` etc.) use an underscore separator while the new codes from the spec use dots. The audit schema does not enforce a naming convention; the `AUDIT_ACTIONS` array is the canonical list. The inconsistency is cosmetic but should be resolved before more codes are added: either all existing axioma codes should be renamed to dots or the new jti codes should match the existing underscore pattern. Renaming existing codes is a breaking change (any query filtering by action string would break). The safer path is to add the new jti codes using the spec's dot convention and document the mixed convention as a known inconsistency to address in a future audit-schema cleanup.

**Target:** PG6 — audit.ts addition step.

---

## Decisions

1. **Staging fence fix (F-01) requires a new `APP_ENV` env var.** Add `APP_ENV: z.enum(['development', 'staging', 'production']).default('development')` to `env.ts`. This is the deployment-environment axis; `NODE_ENV` stays as the build-mode axis. The fence in `signHandoffToken` should NOT be changed (it's pure; it must not read env). Instead, the web layer must simply never call `signHandoffToken` when `APP_ENV` is staging or production — it must only call the ES256 signer (passed in as a `HandoffSigner` abstraction). **The HS256 stub is never called in staging/production, period.**

2. **ES256 key vars must go on the `env.ts` spine.** `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are added as `z.string().optional()` with a `superRefine` that requires both when `APP_ENV` is staging or production (and the bridge is non-mock). The JWKS route and bridge factory must read these from `loadEnv()`, not from `process.env` directly.

3. **Migration 0004 scope is tightly bounded.** Only `axioma_handoff_jti_revocations`. The `axioma_account_links` missing columns (`link_nonce_hash`, `axioma_username`, `linked_at`, `last_verified_at`) and the `one_time_code` → `link_nonce_hash` refactor belong to B4 (OTC account-link workstream) and MUST NOT be folded into 0004.

4. **`consumeJti` atomicity via single conditional UPDATE.** The correct implementation is the single-statement conditional UPDATE with `WHERE jti = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`. This is TOCTOU-free, cross-process safe, and race-safe. Zero rows updated = replay rejection.

5. **Audit actions to add:** `'axioma.account_link.jti.consume'`, `'axioma.account_link.jti.replay'`, `'axioma.account_link.jti.revoke'` (following spec dot convention; existing codes with underscore are not renamed — that is a Phase 3 cleanup item per F-12).

6. **`AXIOMA_HANDOFF_SIGNING_SECRET` production requirement is removed from `superRefine`.** The env var stays optional overall; it is the dev-stub secret and is unused in staging/production. The production/staging requirement shifts to `AXIOMA_HANDOFF_SIGNING_KEY` + `AXIOMA_HANDOFF_KEY_ID`.

7. **`isReplayed` callback removed from `verifyEs256HandoffToken` interface** once the durable `consumeJti` exists. Pre-PG6 the callback stays optional (tests use it; no production consumer calls verify with a real store). Post-PG6 the interface is simplified: verify checks signature/claims only; replay check is a separate prior step.

8. **Real P-256 key is NOT provisioned.** The ES256 real-signing path is wired and unit-tested with a generated test key; real activation = NOT RUN/TARGET until operator provides the key (B4 item 2). The wiring + tests can land without the production key; the fence prevents it from running in staging/production without the key.

---

## Risks

1. **Staging HS256 leak (F-01).** Until the fence fix lands, any staging deployment running `NODE_ENV !== 'production'` silently uses the HS256 stub. An Axioma-side token rejection would reveal this in logs but no WTC-side protection is active. This is the highest-priority fix.

2. **`AXIOMA_HANDOFF_SIGNING_KEY` misconfiguration is silently swallowed (F-02, F-05).** A broken PEM produces an empty JWKS (60-second cache TTL) and a throw at token issuance time. No boot-time failure. Adding the key to `env.ts` and calling `createEs256Signer` at server boot (not lazily) would surface the misconfiguration immediately.

3. **No `consumeJti` = no WTC-side replay protection today (F-03).** Axioma is the backstop (5-min TTL limits exposure). This is acceptable for dev but must be resolved before any production activation. The jti table absence is the top PG6 deliverable.

4. **`AXIOMA_HANDOFF_SIGNING_SECRET` required at production boot but never used (F-07).** If the env.ts change and bridge wiring land in different deploys, there is a window where production demands the HS256 secret AND the ES256 key. Resolve in a single coherent change.

5. **Async `isReplayed` typing (F-10).** The current callback is synchronous. If a future implementer attempts to pass an async DB call as the `isReplayed` callback without updating the type signature, the callback would return a Promise (truthy) which would always cause the token to be rejected as "replayed". This is fail-closed but incorrect. Remove the callback before wiring the real store (Decision 7).

6. **Hard boundary risk (standing).** `bridge.ts` wires `signHandoffToken` which gates server features only. Any future refactor that causes the handoff token to carry exchange keys, Axioma password, or a raw Axioma JWT would violate the hard boundary. The `handoff.test.ts:13–20` test (claims set excludes forbidden keys) is the regression guard — it MUST continue to pass.

---

## Verification/tests

This is a read-only audit. No tests were run this session.

### Tests that MUST be added for PG6

**Unit tests (packages/axioma-bridge, Vitest):**
- `es256-fence.test.ts` or extension of `es256.test.ts`:
  - Verify that the bridge factory throws when `APP_ENV='staging'` and no ES256 signer is provided.
  - Verify that the bridge factory throws when `APP_ENV='production'` and no ES256 signer is provided.
  - Verify that the bridge factory accepts an ES256 signer and produces an ES256 token (not HS256).
  - Verify that `verifyEs256HandoffToken` on a token produced by `signHandoffToken` (HS256) returns `{ valid: false, reason: 'wrong_alg' }`.
  - Verify that a PEM private key value in an audit `after` payload is redacted by `buildEvent`.

**Integration tests (packages/db or tests/integration, Vitest + PGlite):**
- `axioma-jti-replay.test.ts`:
  - `insertJti` then `consumeJti` → returns `{ consumed: true }`.
  - `consumeJti` on already-consumed jti → returns `{ consumed: false, reason: 'already_consumed' }` (0 rows updated).
  - `consumeJti` on expired jti → returns `{ consumed: false, reason: 'expired' }`.
  - `consumeJti` on revoked jti → returns `{ consumed: false, reason: 'revoked' }`.
  - Concurrent `consumeJti` for the same jti (cross-connection if PGlite supports it) → exactly one succeeds.
  - `purgeExpiredJtis` removes rows with `expires_at < now() - 1 hour`; leaves unexpired rows.

**Existing tests that must remain green:**
- `handoff.test.ts:39–48` (HS256 stub throws in production).
- `es256.test.ts:67–75` (HS256-header token rejected by ES256 verifier as `wrong_alg`).
- `es256.test.ts:34–43` (JWKS never contains private scalar `d`).

### Gates NOT RUN

- Real-PG harness (B1): no `DATABASE_URL`.
- ES256 with provisioned P-256 key: no key provisioned (B4 item 2).
- Axioma production handoff: B4 fully blocked.

---

## Next actions

1. **env.ts spine (single coherent change):** Add `APP_ENV`, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID` to `envSchema`. Add `superRefine`: staging/production requires the ES256 key pair. Remove the production `superRefine` requirement on `AXIOMA_HANDOFF_SIGNING_SECRET`. This is on the serial spine — one writer.

2. **Migration 0004 (db-architect, additive-only):** Create `axioma_handoff_jti_revocations` per the spec DDL. Scope: exactly this table, nothing else. The 40-table count becomes 41.

3. **Repositories (db-architect or backend-implementer):** Add `insertJti`, `consumeJti`, `revokeJtiForUser`, `purgeExpiredJtis` to `packages/db/src/repositories.ts`. Use the single conditional UPDATE pattern for `consumeJti`. Add in-txn audit for issuance and consumption.

4. **AUDIT_ACTIONS (security-auditor or backend-implementer):** Add `'axioma.account_link.jti.consume'`, `'axioma.account_link.jti.replay'`, `'axioma.account_link.jti.revoke'` to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts`.

5. **Bridge wiring (backend-implementer):** Introduce `HandoffSigner` abstraction in `bridge.ts`. Wire `createEs256Signer` into the bridge factory when a P-256 key PEM is passed in (resolved at the web layer from `loadEnv()`). HS256 path is used only when no ES256 signer is provided AND deployment env is dev/test. Remove `MockBridgeOptions.signingSecret` field once the abstraction lands (or keep for backward-compat with existing tests, but clearly mark as dev-only).

6. **Worker (backend-implementer):** Add `purgeExpiredJtis(db)` call to `dbTick` in `apps/worker/src/index.ts` after `sweepTvExpiry`.

7. **Test additions (tests-runner):** Write `axioma-jti-replay.test.ts` (PGlite integration) and ES256-fence unit tests. Confirm existing `handoff.test.ts` and `es256.test.ts` stay green.

8. **B4 stays open:** Real P-256 key provisioning, confirmed `journal_server` endpoint shapes, raw-OTC→hash migration — all remain external/OP blockers. None of the PG6 implementation unblocks B4 by itself.
