# ecosystem-platform-architect handoff

**Epoch:** 20260530-2230
**Agent:** ecosystem-platform-architect
**Workstream:** PG6 — Axioma non-blocked surface (pre-implementation audit)

---

## Scope

Read-only architectural audit for PG6. Decisions cover:

1. Deployment-env mechanism: where `APP_ENV` lives and how it reaches the bridge without violating `@wtc/axioma-bridge`'s zero-dependency constraint.
2. Signer-resolution placement: which layer builds the ES256 signer from env and passes it into the bridge factory.
3. Formalizing `AXIOMA_HANDOFF_SIGNING_KEY` + `AXIOMA_HANDOFF_KEY_ID` in `packages/config/src/env.ts`.
4. DB wave-first ordering and single-writer spine files for PG6.
5. INTEGRATION_MAP §6.2 JWKS path stale reference (previously flagged, not yet fixed).
6. Audit action codes for jti lifecycle (gap with the spec).

---

## Files inspected

| File | Range / notes |
|------|---------------|
| `docs/handoffs/0000-orchestrator-seed.md` | all |
| `AGENTS.md` | all |
| `docs/SESSION_PROTOCOL.md` | all |
| `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` | all |
| `docs/CONTRACTS/axioma-bridge.md` | all (v1.1.0) |
| `docs/PRODUCTION_BLOCKERS.md` | all (B4) |
| `docs/EXECUTION_PLAN_MASTER.md` | all (W7 / PG6 row) |
| `docs/ROADMAP_MASTER.md` | §6 Axioma section |
| `docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md` | all |
| `docs/handoffs/20260530-1355-ecosystem-axioma-bridge-auditor.md` | all (prior axioma audit) |
| `docs/ARCHITECTURE.md` | all |
| `docs/INTEGRATION_MAP.md` | all |
| `docs/ARCHITECTURE_DECISIONS.md` | all |
| `packages/axioma-bridge/src/bridge.ts` | all |
| `packages/axioma-bridge/src/handoff.ts` | all |
| `packages/axioma-bridge/src/es256.ts` | all |
| `packages/axioma-bridge/src/jwks.ts` | all |
| `packages/axioma-bridge/src/index.ts` | all |
| `packages/axioma-bridge/package.json` | all |
| `packages/config/src/env.ts` | all |
| `packages/db/src/schema.ts` | lines 1-30, 140-155 (Axioma section) |
| `packages/db/src/repositories.ts` | lines 1-60, 850-960 (Axioma/terminal section) |
| `packages/db/migrations/0003_fresh_blockbuster.sql` | all (last migration) |
| `packages/audit/src/audit.ts` | lines 1-130 |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | all |
| `apps/web/src/lib/server-config.ts` | all |
| `apps/worker/src/index.ts` | all |

---

## Files changed

None — read-only audit.

---

## Findings

### Finding 1 — HIGH — `APP_ENV` is absent; staging fence in `handoff.ts` guards only `NODE_ENV==='production'`

**Evidence:** `packages/axioma-bridge/src/handoff.ts:62`; `packages/config/src/env.ts:13` (schema has `NODE_ENV` with no staging value)

The HS256 dev-stub guard reads `if (process.env.NODE_ENV === 'production')`. `NODE_ENV` in the schema is constrained to `development | test | production` — staging is not a recognised value. A deployment on a staging server therefore runs with `NODE_ENV=production` (the standard practice), so the existing guard fires there and correctly blocks HS256. However, there is no explicit staging concept in the config schema, which means:

(a) The fence cannot be expressed as "staging OR production must use ES256" in the current scheme — it can only be expressed as "anything that is not development AND not test must use ES256."

(b) The ES256 signer has not yet been wired into the bridge factory at all; the guard in `handoff.ts` applies only to the HS256 path, not to the bridge dispatch logic.

**Recommendation:** Add `APP_ENV = z.enum(['development', 'test', 'staging', 'production']).default('development')` to `packages/config/src/env.ts`. The fence expression becomes: `APP_ENV !== 'development' && APP_ENV !== 'test'` (equivalently: `APP_ENV === 'staging' || APP_ENV === 'production'`). Add a `superRefine` check: when `APP_ENV` is staging or production, `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` must be present. Keep `NODE_ENV` as is (it is consumed by Next.js and Vitest and must not be re-typed). `APP_ENV` is the deployment-env discriminator.

**Target:** `packages/config/src/env.ts` (serial spine — single writer).

---

### Finding 2 — HIGH — `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are not in `env.ts`; consumed via raw `process.env`

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:13-14`; `packages/config/src/env.ts` (schema does not contain either key)

Both environment variables are read directly from `process.env` in the JWKS route. They are absent from the `envSchema` in `packages/config/src/env.ts`. This means:

(a) They are not validated at startup — a misconfigured key (wrong format, empty string) is only discovered at runtime when the JWKS route is called or the signer is constructed.

(b) They cannot participate in the `superRefine` fence described in Finding 1.

(c) The `__resetEnvCache()` test helper does not cover these keys, so test isolation is weaker.

**Recommendation:** Add both to `envSchema` as optional with no default: `AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional()` and `AXIOMA_HANDOFF_KEY_ID: z.string().optional()`. Add to the staging/production `superRefine`: when `APP_ENV` is staging or production, both must be present (non-empty). Update the JWKS route to read from `loadEnv()` instead of `process.env` directly. Update `server-config.ts` to expose an `axiomaBridgeSignerConfig()` helper that returns the resolved key/kid pair.

**Target:** `packages/config/src/env.ts` (serial spine), `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, `apps/web/src/lib/server-config.ts`.

---

### Finding 3 — HIGH — ES256 signer wiring decision: where does signer construction live?

**Evidence:** `packages/axioma-bridge/package.json` (no deps listed); `packages/axioma-bridge/src/bridge.ts` (bridge factory takes `MockBridgeOptions` that includes `signingSecret`); `apps/web/src/lib/server-config.ts` (axiomaBridgeIsDev checks only AXIOMA_BRIDGE_API_TOKEN)

The `@wtc/axioma-bridge` package is explicitly pure — no external dependencies. It must NOT import `@wtc/config` or read `process.env` directly. The current bridge factory `createMockAxiomaBridge(opts: MockBridgeOptions)` accepts `signingSecret` as a string — the right pattern is already partially there.

The correct wiring pattern for PG6 is:

1. `packages/config/src/env.ts` parses and validates `APP_ENV`, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID`.
2. `apps/web/src/lib/server-config.ts` (or a new `axioma-config.ts` in the same dir) reads `loadEnv()` and constructs an `Es256Signer | null`:
   - When `APP_ENV` is staging or production AND both key vars are present: call `createEs256Signer(pem, kid)` from `@wtc/axioma-bridge` and return it.
   - When in dev/test: return `null`.
3. The bridge factory receives the resolved signer (or null for dev stub). A new `createAxiomaBridge(opts: AxiomaBridgeOptions)` exported from `packages/axioma-bridge/src/bridge.ts` accepts an optional `signer?: Es256Signer`. When `signer` is provided it uses ES256; when absent it falls back to the HS256 stub (dev/test only; the stub's own guard still fires in production via `APP_ENV` check passed in).
4. The JWKS route reads `loadEnv()` for the key/kid pair and calls `createEs256Signer()` directly — it has always been independent of the bridge factory and should remain so.

This keeps `@wtc/axioma-bridge` pure (it exports `createEs256Signer`, `Es256Signer` but never calls `loadEnv`). The decision about which signer to use is made in the web server layer and passed in. The bridge never reads `process.env`.

**Recommendation:** Define the decision boundary as: `apps/web/src/lib/server-config.ts` exports `getAxiomaSignerOrNull(): Es256Signer | null` which reads `loadEnv()` and calls `createEs256Signer(pem, kid)` from `@wtc/axioma-bridge`. The bridge factory signature becomes `createAxiomaBridgeFromOptions(opts: AxiomaBridgeOptions)` where `AxiomaBridgeOptions` includes an optional `signer: Es256Signer | null`. The web server passes in the resolved signer. Test code passes `null`.

**Target:** `apps/web/src/lib/server-config.ts` (new export); `packages/axioma-bridge/src/bridge.ts` (updated factory signature).

---

### Finding 4 — MEDIUM — Audit action codes for jti lifecycle are missing from `AUDIT_ACTIONS`

**Evidence:** `packages/audit/src/audit.ts:66-71` (axioma action codes); `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` §"Audit Events Emitted"

The existing `AUDIT_ACTIONS` array contains:
- `axioma.account_link_init`
- `axioma.account_link_complete`
- `axioma.account_link_revoke`
- `axioma.download_request`
- `axioma.release_publish`

The spec defines three additional jti-lifecycle audit actions that are NOT in the array:
- `axioma.account_link.jti.consume` (token consumed at WTC — Option A in the spec)
- `axioma.account_link.jti.replay` (replay attempt detected)
- `axioma.account_link.jti.revoke` (admin or entitlement revoke of a specific jti)

These actions are needed for the `consumeJti` repository function (PG6 goal #2) to write audit rows in-transaction.

**Recommendation:** Add the three jti lifecycle codes to `AUDIT_ACTIONS` as part of the PG6 security-auditor or db-architect wave. These are purely additive to the `as const` array. Note: the dot-notation style (`axioma.account_link.jti.consume`) is already consistent with the existing `tv_access.grant` style. This must go through the serial `packages/audit/src/audit.ts` writer.

**Target:** `packages/audit/src/audit.ts` (serialized with other Phase-2 auditors).

---

### Finding 5 — MEDIUM — `axioma_handoff_jti_revocations` table is absent; spec DDL is complete and migration-ready

**Evidence:** `packages/db/src/schema.ts` (no jti table exists); `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` §"Replay Prevention" (DDL specified); `docs/PRODUCTION_BLOCKERS.md` B4 ("jti replay store table absent")

The spec DDL is:
```sql
CREATE TABLE axioma_handoff_jti_revocations (
  jti           uuid PRIMARY KEY,
  sub           uuid NOT NULL,
  issued_at     timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  revoked_at    timestamptz,
  revoke_reason text
);
```

The scope constraint (from PG6 hard constraints) is: migration 0004 contains ONLY this table. The `axioma_account_links` schema refactor (raw OTC → link_nonce_hash, missing columns) belongs to the blocked OTC account-link workstream (B4) and must NOT be included in 0004.

The migration must be tightly scoped. The db-architect wave is the first step of PG6 (before any bridge/web/worker wiring).

**Recommendation:** Confirm migration 0004 DDL matches the spec exactly. Add worker cleanup job `purgeExpiredJtis(db, now)` that deletes rows where `expires_at < now - 1 hour`. Add `consumeJti(db, jti, now)` repository that runs: `UPDATE ... SET used_at=now() WHERE jti=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()` and returns `rowsUpdated === 1`. Add `insertJti(db, {jti, sub, issuedAt, expiresAt})` for issuance-time recording. All three functions must write through `@wtc/db`; the audit row for consumption/replay goes through the missing audit codes in Finding 4.

**Target:** `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/db/migrations/0004_*.sql` (db-architect only; single-writer).

---

### Finding 6 — MEDIUM — INTEGRATION_MAP §6.2 JWKS path is stale (carried from prior axioma-bridge-auditor finding 6)

**Evidence:** `docs/INTEGRATION_MAP.md:319` (§6.2 "Handoff signer" row); `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:1` (correct path confirmed)

The INTEGRATION_MAP §6.2 still references `/api/axioma/.well-known/jwks.json` as the JWKS endpoint path. The actual route file is at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, which Next.js resolves to `/.well-known/axioma-jwks.json`. This was flagged in the 20260530-1355 axioma-bridge-auditor handoff (Finding 6) but was not corrected because the platform-architect is the INTEGRATION_MAP owner and that session was read-only.

This is a doc-only fix. No code change needed. The stale path could mislead Axioma when they configure JWKS auto-discovery.

**Recommendation:** Update `docs/INTEGRATION_MAP.md §6.2` row for "Handoff signer" to read `/.well-known/axioma-jwks.json` (not `/api/axioma/.well-known/jwks.json`). This is the platform-architect's owned doc. Apply as part of the PG6 architecture wave or as a standalone operator doc fix. Not blocking code work.

**Target:** `docs/INTEGRATION_MAP.md` (platform-architect owns this file).

---

### Finding 7 — LOW — Worker does not currently have a jti purge job; the worker pattern is established

**Evidence:** `apps/worker/src/index.ts:30-41` (dbTick shows the existing job dispatch pattern: reconcileAllEntitlements → markExpiringSoon → sweepTvExpiry → recordHealthCheck)

The worker uses a direct async function call pattern inside `dbTick`. Adding a jti purge job (`purgeExpiredJtis`) follows the same pattern. The job must be called AFTER the standard entitlement sweeps and must not block or throw (wrap in try/catch; log and continue). The spec says: delete rows where `expires_at < now() - 1 hour`.

**Recommendation:** The implementer adds a `purgeExpiredJtis(db, now)` call to `dbTick` in `apps/worker/src/index.ts` after the existing TV sweep. Log the count purged. This is an additive edit to the worker serial-spine file.

**Target:** `apps/worker/src/index.ts` (single-writer spine).

---

### Finding 8 — LOW — `handoff.ts` HS256 stub guard uses `process.env.NODE_ENV` directly; should be passed in as APP_ENV once the fence is added

**Evidence:** `packages/axioma-bridge/src/handoff.ts:62` (`if (process.env.NODE_ENV === 'production')`)

The pure-package constraint requires `@wtc/axioma-bridge` not to import `@wtc/config` and not to read `process.env`. The current guard in `signHandoffToken` reads `process.env.NODE_ENV` directly. This is the only direct `process.env` access in the package.

With the new `APP_ENV` approach, the correct design is to pass `isProductionLike: boolean` into the factory (or into `signHandoffToken` itself). The caller (web server layer) resolves `APP_ENV` and passes the boolean. This removes the last `process.env` read from the pure package.

**Recommendation:** Replace the `process.env.NODE_ENV` check in `signHandoffToken` with a parameter: `signHandoffToken(claims, secret, { isProductionLike: boolean })`. The web server layer calls with `isProductionLike = loadEnv().APP_ENV === 'staging' || loadEnv().APP_ENV === 'production'`. Update existing tests to pass the flag. This is a small but important purity improvement.

**Target:** `packages/axioma-bridge/src/handoff.ts`, `packages/axioma-bridge/src/bridge.ts` (update call site), `packages/axioma-bridge/src/handoff.test.ts` (update tests).

---

### Finding 9 — INFO — CTA constraint is correctly enforced; no action needed

**Evidence:** `docs/PRODUCTION_BLOCKERS.md` B4; `apps/web/src/app/(app)/app/terminal/page.tsx` (Download/Open-Journal/account-link buttons all disabled in dev mode)

The hard constraint "CTAs STAY DISABLED (B4)" is enforced by `axiomaBridgeIsDev()` in `server-config.ts` which returns true when `AXIOMA_BRIDGE_API_TOKEN` is absent. The PG6 work adds jti store + ES256 wiring but does NOT enable any CTA — the CTAs remain disabled until B4 is cleared by the operator (EC P-256 key provisioned + Axioma endpoint confirmation). This ordering is correct and no architectural change is needed to enforce it.

**Recommendation:** No action. Document in the aggregate handoff that PG6 does not enable any CTAs.

---

### Finding 10 — INFO — `axiomaBridgeIsDev()` will need a dual-condition check once ES256 is wired

**Evidence:** `apps/web/src/lib/server-config.ts:22-24` (`axiomaBridgeIsDev()` checks only `AXIOMA_BRIDGE_API_TOKEN`)

Currently `axiomaBridgeIsDev()` returns true when `AXIOMA_BRIDGE_API_TOKEN` is absent. After PG6, the bridge will also need the ES256 signer to be configured for real operation. The real-bridge mode requires BOTH: `AXIOMA_BRIDGE_API_TOKEN` AND `AXIOMA_HANDOFF_SIGNING_KEY`/`AXIOMA_HANDOFF_KEY_ID`.

The current single-condition check is safe for now (the whole bridge is mock until the token is set) but should be updated when the real bridge factory is wired in a future phase.

**Recommendation:** Note as a follow-up for the bridge-activation phase: update `axiomaBridgeIsDev()` to also check that a signer is configured. Not a PG6 blocker since CTAs stay disabled.

---

## Decisions

### D1 — Add `APP_ENV` to `packages/config/src/env.ts`

`APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development')` is the deployment-env discriminator. `NODE_ENV` is not extended. The staging+production fence for ES256 is: `APP_ENV === 'staging' || APP_ENV === 'production'`. A `superRefine` check requires `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` to be present when `APP_ENV` is staging or production. This is the only change to the `envSchema` spine needed for PG6 (in addition to the two new key vars).

### D2 — `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` formalized in `env.ts`

Both added as `z.string().optional()` with no default. The `superRefine` requires both in staging/production. The JWKS route and any future bridge activation path read these through `loadEnv()` (not raw `process.env`). This is additive to the schema.

### D3 — Signer resolution lives in `apps/web/src/lib/server-config.ts`

`server-config.ts` exports `getAxiomaSignerOrNull(): Es256Signer | null`. This is the single resolution point: it calls `loadEnv()`, checks APP_ENV, builds the signer from `createEs256Signer(pem, kid)` or returns null. The bridge factory receives the pre-resolved signer as a parameter. The JWKS route calls `createEs256Signer` directly with the env values (no change needed in its logic once env vars move to `loadEnv()`).

### D4 — Pure-package constraint maintained

`@wtc/axioma-bridge` has zero runtime imports beyond Node built-ins. The `process.env.NODE_ENV` direct read in `handoff.ts:62` is replaced with a passed-in `isProductionLike: boolean` parameter. No `@wtc/config` import is added to `@wtc/axioma-bridge`. All env resolution happens at the web server layer.

### D5 — DB wave-first ordering for PG6

Exactly as specified in the task prompt:
1. `ecosystem-db-architect`: migration 0004 (schema.ts + SQL + drizzle-kit) — tightly scoped to `axioma_handoff_jti_revocations` only.
2. `ecosystem-db-architect` or `ecosystem-backend-implementer`: `insertJti`, `consumeJti`, `purgeExpiredJtis` in `repositories.ts`.
3. `packages/config/src/env.ts`: add APP_ENV, AXIOMA_HANDOFF_SIGNING_KEY, AXIOMA_HANDOFF_KEY_ID.
4. `apps/web/src/lib/server-config.ts`: add `getAxiomaSignerOrNull()`.
5. `packages/axioma-bridge/src/bridge.ts`: update factory to accept `Es256Signer | null`.
6. `packages/axioma-bridge/src/handoff.ts`: replace `process.env.NODE_ENV` guard with passed-in bool.
7. `apps/worker/src/index.ts`: add `purgeExpiredJtis` call to `dbTick`.
8. Tests: jti-replay unit tests + ES256 round-trip tests.

### D6 — Migration 0004 scope discipline

Migration 0004 contains ONLY `axioma_handoff_jti_revocations`. The `axioma_account_links` refactor (OTC → hash, missing columns) is B4-blocked and stays TARGET. No other table changes in 0004. This is a hard scope constraint.

### D7 — `axioma.account_link.jti.consume`, `.replay`, `.revoke` added to AUDIT_ACTIONS

These three codes must be added before `consumeJti` can write audit rows. They are additive to the `as const` array. The serial writer for `packages/audit/src/audit.ts` adds them in the security-auditor or db-architect wave.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `APP_ENV` added but existing `NODE_ENV=production` deployments do not set it → defaults to `development` → ES256 NOT required even in production | HIGH | The `superRefine` on `AXIOMA_HANDOFF_SIGNING_SECRET` (already in env.ts) guards the HS256 path for production. The ES256 fence (APP_ENV check) is additive. The operator must set APP_ENV=production in any production deployment. Documented in .env.example. |
| `signHandoffToken` still reads `process.env.NODE_ENV` directly — a pure-package purity violation — until Finding 8 is fixed | MEDIUM | Not a security bug (the guard still fires in production). Fix in the same implementation wave. |
| `consumeJti` atomic UPDATE must be a single-statement database operation to avoid TOCTOU replay window | HIGH | Implementation must use a single `UPDATE ... WHERE jti=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()` statement (never a SELECT-then-UPDATE). Return rowsUpdated; reject if 0. This is the spec requirement. |
| Migration 0004 scope creep (temptation to also fix axioma_account_links) | MEDIUM | Hard scope constraint in D6. The db-architect MUST resist. The OPEN_QUESTIONS item for account_links refactor stays separate. |
| The new `getAxiomaSignerOrNull()` in server-config.ts constructs the signer on every call (key parse is cheap but repeated) | LOW | Memoize the signer singleton per process startup in server-config.ts. One construction per cold start. |
| INTEGRATION_MAP §6.2 stale JWKS path could mislead Axioma during integration | LOW | Doc fix; no code impact. Fix in PG6 doc wave. |

---

## Verification / tests

### Tests needed for PG6 (unit + integration)

**`packages/axioma-bridge/src/`:**
- `es256.test.ts`: already has 7 tests; add round-trip with the new `isProductionLike` parameter shape.
- `handoff.test.ts`: already has 6 tests; update the production guard test to pass `isProductionLike: true`.
- New `jti-replay.test.ts`: unit tests for `consumeJti` logic (mock DB), `insertJti`, purge predicate.

**`tests/integration/`:**
- `db-axioma-jti.test.ts` (PGlite): insert jti → consume (rowsUpdated=1) → replay (rowsUpdated=0); insert expired → consume fails; insert revoked → consume fails; cross-connection concurrent consume (only one wins); purge removes expired rows.

**`packages/config/`:**
- `env.test.ts`: add test cases for APP_ENV=staging with missing signing key → error; APP_ENV=production with both keys present → valid.

### Not run / not target this phase

- Real Postgres: NOT RUN (no DATABASE_URL).
- Real ES256 activation with provisioned P-256 key: NOT RUN (B4 external dependency).
- CTA enablement: NOT RUN (B4 hard constraint).
- Axioma endpoint confirmation: NOT RUN (external).

---

## Next actions

1. **db-architect (first, serial-spine):** Add `axioma_handoff_jti_revocations` to `schema.ts` per the spec DDL. Run `drizzle-kit generate` → migration 0004 SQL. Add `insertJti`, `consumeJti`, `purgeExpiredJtis` to `repositories.ts`. Add jti lifecycle audit codes to `audit.ts` (coordinate with security-auditor).

2. **security-auditor (parallel to db-architect — audit.ts only):** Add `axioma.account_link.jti.consume`, `axioma.account_link.jti.replay`, `axioma.account_link.jti.revoke` to `AUDIT_ACTIONS`. This is the only `audit.ts` write; coordinate with the db-architect on the single-writer order.

3. **backend-implementer (after DB wave):** Add `APP_ENV`, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID` to `packages/config/src/env.ts` with the staging/production `superRefine`. Add `getAxiomaSignerOrNull()` to `apps/web/src/lib/server-config.ts`. Update `packages/axioma-bridge/src/handoff.ts` to replace `process.env.NODE_ENV` guard with the `isProductionLike` parameter. Update `packages/axioma-bridge/src/bridge.ts` factory to accept the signer. Update the JWKS route to use `loadEnv()`.

4. **backend-implementer (worker spine):** Add `purgeExpiredJtis(db, now)` call to `apps/worker/src/index.ts` dbTick.

5. **tests-runner:** Run focused gate: `npm test -- packages/axioma-bridge packages/config tests/integration/db-axioma-jti.test.ts`. Full gates (lint/typecheck/build/e2e) after.

6. **platform-architect (doc fix, operator can apply immediately):** Update `docs/INTEGRATION_MAP.md §6.2` JWKS path from `/api/axioma/.well-known/jwks.json` to `/.well-known/axioma-jwks.json`. Update `docs/ARCHITECTURE.md` and `docs/INTEGRATION_MAP.md` to reflect PG6 delta (jti table, APP_ENV, signer wiring). Append ADR for APP_ENV to `docs/ARCHITECTURE_DECISIONS.md`.

7. **CTAs stay disabled:** Do NOT enable Download / Open-Journal / OTC account-link buttons. B4 is open. The ES256 signer wiring makes the path production-ready but the buttons remain disabled until the operator clears B4 (provisioned key + Axioma endpoint confirmation + endpoint shapes confirmed).
