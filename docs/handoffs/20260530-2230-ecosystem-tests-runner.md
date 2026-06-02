# ecosystem-tests-runner handoff

## Scope

READ-ONLY gate run + test design for Phase Group 6 (epoch `20260530-2230`): Axioma non-blocked surface
(ES256 wire behind staging+prod fence, `axioma_handoff_jti_revocations` migration 0004, `consumeJti`
replay store, jti-replay tests, ES256-into-bridge fence tests). CTAs remain DISABLED (B4).

Baseline from `docs/STATUS.md` (Phase 2.8 / PG3+PG4+PG5-followup): **370 passed / 7 skipped (377 total)**
across 35 test files, 26.21% stmt / 73.51% branch, e2e 36/36, `retries: 2`.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md` (full history)
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` (DDL spec, replay prevention, audit actions)
- `docs/CONTRACTS/axioma-bridge.md` (§11 mock-vs-real, §13 required tests, §17 product area design)
- `docs/PRODUCTION_BLOCKERS.md` (B4 — CTAs, P-256 key, endpoint shapes)
- `docs/EXECUTION_PLAN_MASTER.md` (W7 / PG6 row)
- `docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md` (prior aggregate)
- `docs/handoffs/20260530-2230-ecosystem-axioma-bridge-auditor.md` (PG6 bridge auditor)
- `docs/handoffs/20260530-2230-ecosystem-db-architect.md` (PG6 DB wave)
- `packages/axioma-bridge/src/es256.ts` (createEs256Signer, verifyEs256HandoffToken)
- `packages/axioma-bridge/src/es256.test.ts` (7 existing tests)
- `packages/axioma-bridge/src/handoff.ts` (HS256 dev stub, NODE_ENV production guard)
- `packages/axioma-bridge/src/handoff.test.ts` (5 existing tests)
- `packages/axioma-bridge/src/bridge.ts` (createMockAxiomaBridge, MockBridgeOptions)
- `packages/axioma-bridge/src/jwks.ts`, `index.ts`
- `packages/axioma-bridge/package.json` (zero deps confirmed — no @wtc/config, no process.env inside)
- `packages/config/src/env.ts` (NODE_ENV ∈ {development,test,production}; no APP_ENV/staging variant)
- `packages/db/src/schema.ts` (no axioma_handoff_jti_revocations — confirmed absent)
- `packages/db/src/repositories.ts` (consumeJti absent — confirmed)
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (reads raw process.env; no AXIOMA_HANDOFF_SIGNING_KEY in env.ts schema)
- `tests/integration/db-persistence.test.ts`, `db-pg5.test.ts`, `db-tv-expiring.test.ts`
- `tests/e2e/smoke.spec.ts` (36 tests, retries:2)
- `vitest.config.ts` (include pattern)
- `package.json` (gate scripts)

## Files changed

None — read-only audit.

## Findings

### F-01 [HIGH] axioma_handoff_jti_revocations table absent — migration 0004 needed
**Evidence:** `packages/db/src/schema.ts` — no `axioma_handoff_jti_revocations` table exists (grepped;
0 results). `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention` specifies the DDL:
`jti uuid PRIMARY KEY, sub uuid NOT NULL, issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
used_at timestamptz, revoked_at timestamptz, revoke_reason text`.
**Recommendation:** Add a single additive migration 0004 containing only this table. 0000-0003 untouched.
Scope discipline: the `axioma_account_links` plaintext `one_time_code` → `link_nonce_hash` refactor
is BLOCKED (B4 OTC workstream) and must NOT be folded into 0004.
**Target part: PG6 DB wave (db-architect)**

### F-02 [HIGH] consumeJti repository missing — no durable replay store
**Evidence:** `packages/db/src/repositories.ts` — `consumeJti` does not appear (grepped; 0 results).
The spec (`AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention`) requires: atomic UPDATE
`used_at=now() WHERE jti=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now`; 0 rows
updated → replay rejection.
**Recommendation:** Add `consumeJti(db, jti, now?)` and `recordJti(db, {jti,sub,issuedAt,expiresAt})`
to `packages/db/src/repositories.ts`. Also add `purgeExpiredJtis(db, buffer, now?)` for the worker
(deletes rows where `expires_at < now - buffer`). Wire `purgeExpiredJtis` into `apps/worker/src/index.ts`
`dbTick`. The worker call order must be: `markExpiringSoon → sweepTvExpiry → purgeExpiredJtis`.
**Target part: PG6 DB wave / backend (db-architect)**

### F-03 [HIGH] HS256 fence covers only NODE_ENV=production; staging not covered
**Evidence:** `packages/axioma-bridge/src/handoff.ts:62` — `if (process.env.NODE_ENV === 'production')`.
`packages/config/src/env.ts:13` — `NODE_ENV: z.enum(['development', 'test', 'production'])`. There is
NO `APP_ENV` or `DEPLOY_ENV` enum in the schema; the only three NODE_ENV values are
`development|test|production`. The PG6 brief mandates: staging+prod MUST use ES256 and MUST refuse HS256.
There is no current mechanism to distinguish staging from production within the codebase.
**Recommendation:** The fence resolver must be PASSED IN to the bridge factory (keeping the package
pure — zero env access inside `@wtc/axioma-bridge`). Signature:
`createBridgeSignerConfig({ deployEnv: 'dev' | 'staging' | 'production', signingKeyPem?: string, keyId?: string })`.
The web/server layer resolves `deployEnv` from env (e.g. `DEPLOY_ENV` or a boolean `IS_STAGING` read
in `apps/web`, outside the package). The resolver returns either a `Es256Signer` (when key present +
(staging|production)) or allows the HS256 stub (when dev/test). If `deployEnv` is staging|production
and `signingKeyPem` is absent → throw at factory construction time (fail-closed, not at token issuance).
This keeps `@wtc/axioma-bridge` pure (no env reads) per the HARD CONSTRAINT.
**Target part: PG6 bridge (axioma-bridge + platform-architect)**

### F-04 [HIGH] createEs256Signer is not wired into bridge.ts — ES256 path unreachable
**Evidence:** `packages/axioma-bridge/src/bridge.ts` — imports only `buildHandoffClaims`,
`signHandoffToken`, `HANDOFF_TTL_MS` from `handoff.ts`; no import of `createEs256Signer` or `Es256Signer`.
`createMockAxiomaBridge` calls `signHandoffToken` (HS256 stub) for `createJournalHandoff`.
**Recommendation:** Update `MockBridgeOptions` (or add a `RealBridgeOptions`) to accept an optional
`signer?: Es256Signer`. In `createJournalHandoff`: if `opts.signer` is present, use it to sign via
`opts.signer.sign(claims)` instead of `signHandoffToken`. When `opts.signer` is absent and not in
dev/test, throw. The fence test: factory with `{ deployEnv: 'staging', signingKeyPem: undefined }` must
throw at construction; factory with a generated test key must succeed and produce an ES256 token.
**Target part: PG6 bridge (axioma-bridge)**

### F-05 [MEDIUM] AUDIT_ACTIONS missing jti lifecycle codes
**Evidence:** `packages/audit/src/audit.ts` — has `axioma.account_link_init`, `axioma.account_link_complete`,
`axioma.account_link_revoke`, `axioma.download_request`, `axioma.release_publish`. The spec
(`AXIOMA_HANDOFF_TOKEN_SPEC.md §Audit Events Emitted`) names three new codes:
`axioma.account_link.jti.consume`, `axioma.account_link.jti.replay`, `axioma.account_link.jti.revoke`.
These do not yet exist.
**Recommendation:** Add the three jti lifecycle codes to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts`.
Record as a finding for the security auditor / audit-domain owner. The `consumeJti` repository must
emit an `axioma.account_link.jti.consume` audit row on success and `axioma.account_link.jti.replay` on
0-rows-updated.
**Target part: PG6 audit (security-auditor / db-architect)**

### F-06 [MEDIUM] AXIOMA_HANDOFF_SIGNING_KEY not in env.ts schema — raw process.env access
**Evidence:** `packages/config/src/env.ts` — no `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_HANDOFF_KEY_ID`
field. `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` reads these via raw `process.env` (not
via `loadEnv()`). This bypasses the config quality guard and makes the key invisible to the env schema.
**Recommendation:** Add `AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional()` and
`AXIOMA_HANDOFF_KEY_ID: z.string().optional()` to `env.ts`. In the production `superRefine`, if
`DEPLOY_ENV`/`IS_STAGING` indicates a real deployment, require both fields to be non-empty (fail-closed
at boot). The JWKS route should read from `loadEnv()` instead of raw `process.env`. This must be
done by the app-layer (outside `@wtc/axioma-bridge` — the package must stay zero-env).
**Target part: PG6 config / env.ts (platform-architect)**

### F-07 [LOW] Cross-connection PGlite replay race not reproducible
**Evidence:** PGlite (in-process) runs all queries in a single connection; there is no multi-pool
concurrency path. A true cross-connection replay race (two simultaneous `consumeJti` calls under
separate connections) cannot be tested with PGlite — it requires real Postgres with two connection
pools (the same pattern as `db-real-postgres.test.ts` `billing_webhook_events` concurrent test, which
is `skipIf(!REAL_POSTGRES_DATABASE_URL)`).
**Recommendation:** The jti-replay integration test file must include one `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)` block for the cross-connection race. The serial same-connection tests (insert→consume ok, second consume→replay, expired→rejected, revoked→rejected, purge) run on PGlite and are always-on. Be honest: the PGlite suite is not a substitute for the cross-connection atomicity guarantee.
**Target part: PG6 tests (db-architect / tests-runner)**

## Decisions

1. **PG6 jti-replay tests go in a new file `tests/integration/db-jti-replay.test.ts`** (PGlite,
   always-on tests; `skipIf` block for cross-connection race). Placement rationale: `vitest.config.ts`
   `tests/integration/**/*.test.ts` include covers it. A dedicated file keeps axioma jti concerns
   isolated from the TV/billing integration suites.

2. **ES256 fence tests go in `packages/axioma-bridge/src/bridge-signer-fence.test.ts`** (new file
   for fence/deployment-env logic). The existing `es256.test.ts` covers round-trip/JWKS/rejection;
   the fence tests need to exercise the resolver logic without mutating real env. Both files are in
   `packages/**/*.test.ts`.

3. **NO 429/burst e2e.** The Phase 2.6/PG11 ruling holds: rate-limit tested unit-only. CTAs stay
   DISABLED in e2e (no new CTA assertion needed — the existing `terminal-page` smoke asserts
   DISABLED dev-placeholder buttons).

4. **CTA e2e assertion: confirm disabled, NOT enabled.** The existing e2e test at
   `tests/e2e/smoke.spec.ts:198` ("Phase 2.3 terminal page: hard-boundary callout + DISABLED
   dev-placeholder buttons") already asserts that Download and Open-Journal are DISABLED. This
   assertion MUST remain unchanged after PG6. B4 is not cleared; CTAs must stay disabled.

5. **Worker `purgeExpiredJtis` call order:** `markExpiringSoon → sweepTvExpiry → purgeExpiredJtis`
   (jti purge is last — a brief post-expiry buffer is intentional per the spec: 1-hour buffer keeps
   rows available for audit queries just after expiry).

6. **Package purity invariant.** `@wtc/axioma-bridge` has zero deps (confirmed from `package.json`).
   It must NOT add `@wtc/config` or `@wtc/db` as a dependency. The signer selection and deployEnv
   flag are passed-in parameters at factory creation time.

## Risks

1. **No `APP_ENV`/`DEPLOY_ENV` exists in `env.ts` today.** Adding a staging fence requires either
   (a) a new `DEPLOY_ENV: z.enum(['development','staging','production'])` env var, or (b) repurposing
   an existing flag. The platform-architect handoff at epoch `20260530-2230` must decide this. Until
   resolved, the fence cannot be correctly wired. Risk: if the implementer uses NODE_ENV alone, staging
   deployments (where NODE_ENV may be set to 'production') will require the ES256 key — which is
   correct behaviour, but the test for "staging-without-key → throw" requires a separate signal.

2. **PGlite consumeJti atomicity:** PGlite does not exercise UPDATE-WHERE concurrency. The serial tests
   (second consume → 0 rows → replay rejection) are correct but cannot prove the cross-connection race.
   The `skipIf` test documents the gap honestly; real-PG B1 remains open.

3. **jti purge window:** `purgeExpiredJtis(db, buffer=1h)` deletes rows where `expires_at < now - 1h`.
   If this is called before the 5-minute token TTL + 1 hour has elapsed, rows will still be present.
   Tests must use a `buffer=0` (or a very small value) to exercise actual deletion, while production
   uses the 1-hour buffer.

4. **CTAs must stay disabled post-PG6.** The staging+prod fence wires ES256, but the CTAs remain
   disabled dev-placeholders because B4 requires (a) confirmed endpoint shapes + (b) provisioned
   P-256 key — both EXTERNAL/OP. The e2e must assert disabled state after PG6; an accidentally
   enabled CTA is a production blocker.

5. **`retries: 2` carry-forward.** The dev-only Server-Action recompilation race flake persists.
   `playwright.config.ts` already has `retries: 2`. No change needed.

## Verification/tests

### 1. ES256-into-bridge fence tests
**File:** `packages/axioma-bridge/src/bridge-signer-fence.test.ts` (new)
**Placement:** `packages/**/*.test.ts` — picked up automatically.

```typescript
// Exact test cases — signer selection / fence logic
// The fence resolver is PASSED IN (pure; no process.env inside the package).

describe('ES256 signer fence: dev/test allows HS256 stub; staging+prod requires ES256', () => {
  it('dev/test mode with no signer key: HS256 stub allowed (signHandoffToken does not throw)', () => {
    // NODE_ENV=test (default in vitest); no signer present
    const claims = buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD);
    expect(() => signHandoffToken(claims, 'test-secret')).not.toThrow();
  });

  it('staging deployEnv with no signingKeyPem: factory must throw at construction time', () => {
    // The fence resolver (passed in by web layer) detects staging + no key → throw
    expect(() =>
      createBridgeSigner({ deployEnv: 'staging', signingKeyPem: undefined, keyId: undefined })
    ).toThrow(/staging|production|key required/i);
  });

  it('production deployEnv with no signingKeyPem: factory must throw at construction time', () => {
    expect(() =>
      createBridgeSigner({ deployEnv: 'production', signingKeyPem: undefined, keyId: undefined })
    ).toThrow(/staging|production|key required/i);
  });

  it('staging deployEnv with a valid P-256 key: returns Es256Signer, not HS256 stub', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const signer = createBridgeSigner({ deployEnv: 'staging', signingKeyPem: pem, keyId: 'test-kid' });
    const claims = buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD);
    const token = signer.sign(claims);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    expect(header.alg).toBe('ES256');  // NOT HS256
    expect(header.kid).toBe('test-kid');
  });

  it('production deployEnv with a valid P-256 key: ES256 token verifies against publicJwk', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const signer = createBridgeSigner({ deployEnv: 'production', signingKeyPem: pem, keyId: 'prod-kid' });
    const claims = buildHandoffClaims('user-2', 'axioma_terminal', 'open_journal', NOW, AUD);
    const token = signer.sign(claims);
    const res = verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW + 1000 });
    expect(res.valid).toBe(true);
  });

  it('dev deployEnv with a key present: still uses ES256 (key wins over dev default)', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const signer = createBridgeSigner({ deployEnv: 'development', signingKeyPem: pem, keyId: 'dev-kid' });
    const claims = buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD);
    const token = signer.sign(claims);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    expect(header.alg).toBe('ES256');
  });
});
```

Expected count: ~6 tests. Total with existing es256.test.ts (7) and handoff.test.ts (5): ~18 in axioma-bridge.

### 2. jti-replay integration tests (PGlite + skipIf cross-connection)
**File:** `tests/integration/db-jti-replay.test.ts` (new file)
**Placement:** `vitest.config.ts` `tests/integration/**/*.test.ts` — picked up automatically.

Test cases (always-on PGlite, isolated `beforeAll`):
- `recordJti` inserts a row; row is visible in the table.
- `consumeJti` on an unconsumed row: returns `{ consumed: true }`; row has `used_at` set.
- `consumeJti` on an already-consumed row: returns `{ consumed: false, reason: 'already_used' }` (replay).
- `consumeJti` on an expired row (`expires_at < now`): returns `{ consumed: false, reason: 'expired' }`.
- `consumeJti` on a revoked row (`revoked_at IS NOT NULL`): returns `{ consumed: false, reason: 'revoked' }`.
- `purgeExpiredJtis(db, buffer=0, now)`: deletes expired rows; active rows are untouched.
- Cross-connection race (`describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`): two pools, concurrent
  consumeJti on the same jti — exactly one pool gets `consumed: true`, the other gets `consumed: false`;
  requires real Postgres (PGlite single-pool cannot prove UPDATE atomicity under two connections).

Expected count: ~7 tests (6 PGlite + 1 skipIf). Total Vitest count post-PG6: ~383+ (370 + ~13 new).

### 3. Full gate sequence for Phase 2.8 / PG6

Run all gates in this exact order, sequentially:

| # | Gate | Command | Expected | Notes |
|---|------|---------|----------|-------|
| 1 | governance:check | `npm run governance:check` | PASS — N cited per-agent handoffs at epoch 20260530-2230 | Run AFTER all per-agent handoffs exist + aggregate cites them |
| 2 | check:core | `npm run check:core` | PASS — 7 smokes | Pure logic; axioma-bridge smoke still exercises HS256 stub (dev) |
| 3 | lint | `npm run lint` | PASS — 0 errors, 0 warnings | New files must be lint-clean |
| 4 | typecheck (packages) | `npm run typecheck` | PASS — exit 0 | |
| 5 | typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 | AXIOMA_HANDOFF_SIGNING_KEY added to env.ts must not break web |
| 6 | secret:scan | `npm run secret:scan` | PASS — clean | No P-256 PEM in any test fixture; generated keys only |
| 7 | test (Vitest) | `npm test` | PASS — >=370 passed / 7 skipped | New tests: ~6 fence + ~7 jti-replay = >=13 new |
| 8 | coverage | `npm run coverage` | PASS — stmts >=26.21%, branch >=73.51% | Hold or improve |
| 9 | db:generate | `npm run db:generate -w @wtc/db` | PASS — **41 tables** (new `axioma_handoff_jti_revocations`) | Migration 0004 generates a new SQL file |
| 10 | build | `npm run build -w @wtc/web` | PASS — 44 routes compile | JWKS route and bridge factory must compile |
| 11 | e2e | `npx playwright test` | PASS — 36/36 (retries:2) | CTA disabled assertions MUST still pass; no new CTAs enabled |

### Gates NOT RUN (with reason)

| Gate | Reason |
|------|--------|
| `db:migrate` / `db:seed` against real Postgres | No `DATABASE_URL`; Docker absent (B1). PGlite verifies the DDL only. |
| real-PG harness (`db-real-postgres.test.ts`) | `REAL_POSTGRES_DATABASE_URL` not set; `describe.skipIf` skips all real-PG cases. |
| Cross-connection jti-replay race | `REAL_POSTGRES_DATABASE_URL` not set; `describe.skipIf` in `db-jti-replay.test.ts`. |
| B4 real P-256 key activation | No provisioned `AXIOMA_HANDOFF_SIGNING_KEY` in env; the real-signing path is wired + unit-tested with a generated test key but NOT activated in this environment. |
| B4 CTAs (Download / Open-Journal / OTC link) | Disabled dev-placeholders. B4 requires confirmed endpoint shapes (EXT) + provisioned P-256 key (OP) — both EXTERNAL/OP blockers. CTA enable is NOT TARGET in this phase. |
| B2 Stripe checkout | Q-2 undecided + no Stripe test keys. |
| `npm ci` | `node_modules` present; not a git repo. |

### Real vs mock/dev tally update (what PG6 adds)

New PGlite-verified items (PG6):
- **`axioma_handoff_jti_revocations` table:** DDL in migration 0004; PGlite-verified via db-jti-replay tests.
- **`consumeJti` / `recordJti` / `purgeExpiredJtis`:** unit-tested (replay rejection, expiry rejection, revoke rejection, purge buffer).
- **ES256-into-bridge fence:** unit-tested (staging+prod with no key → throw; with key → ES256 token; dev → HS256 allowed OR ES256 when key present).

Items remaining NOT production-wired (unchanged from Phase 2.8):
- Real-PG `db:migrate`/`db:seed` (no `DATABASE_URL` — B1).
- Stripe live checkout (no keys — B2).
- Legacy real adapter (B3).
- Axioma CTAs, provisioned P-256 key, confirmed endpoint shapes (B4).

### Priority unit coverage observed (this gate run)

- **Entitlement state machine (fail-closed):** `packages/entitlements/src/engine.test.ts` — 11 tests.
  Covers: deny with no entitlements, only active/grace grant (all others deny), time transitions
  (active→grace→expired), lifetime entitlement, manual grant precedence, refund/chargeback from any
  state. `isGranting('weird')` → false. PASS observed.
- **Crypto envelope vault (no plaintext):** `packages/crypto/src/vault.test.ts` — 5 tests.
  Covers: round-trip + JSON.stringify never contains plaintext, wrong AAD throws VaultError, tamper
  throws VaultError, unknown keyId throws VaultError, KEK rotation via rewrap, malformed KEK rejected.
  PASS observed.
- **RBAC matrix:** `packages/auth/src/rbac.test.ts` — 3 tests. Covers: admin passes assertAdmin,
  non-admin throws AccessDeniedError, matrix: only admin manages entitlements.
- **Analytics normalization (closed vs unrealized PnL, drawdown):** `packages/analytics/src/metrics.test.ts`
  — 13 tests. Covers: zero-equity artifact prevention (GAP-F), netPnlWithFees vs closedPnl (GAP-A),
  ROI (GAP-B), avgWin/avgLoss/expectancy (GAP-C), safety events (GAP-D), cross-bot aggregation (GAP-E).
- **Axioma ES256 round-trip:** `packages/axioma-bridge/src/es256.test.ts` — 7 tests.
  Covers: sign→verify with matching key, ES256/kid header (not HS256), JWKS public-only (no `d`),
  wrong key rejects, expired/aud/replay rejected, no HS256 downgrade, key+kid required.
- **Axioma HS256 dev-stub:** `packages/axioma-bridge/src/handoff.test.ts` — 5 tests.
  Covers: no forbidden claims (no password/jwt/apiKey), correct issuer, alg=HS256 (visible divergence),
  verify+expiry+aud+replay rejection, production throw.

All 370 Vitest tests PASS observed in this gate run.

## Next actions

1. **(PG6 db-architect)** Add `axioma_handoff_jti_revocations` table to `packages/db/src/schema.ts`
   and generate migration 0004 (`npm run db:generate -w @wtc/db` → expect 41 tables). Add
   `recordJti`, `consumeJti`, `purgeExpiredJtis` to `packages/db/src/repositories.ts`. Export from
   `packages/db/src/index.ts`. Add jti audit codes to `packages/audit/src/audit.ts`.

2. **(PG6 axioma-bridge)** Add `createBridgeSigner({ deployEnv, signingKeyPem?, keyId? })` resolver
   to `packages/axioma-bridge/src/` (new file, e.g. `signer-factory.ts`). Update `bridge.ts`
   `MockBridgeOptions` to accept `signer?: Es256Signer`. Export from `index.ts`. No env reads inside
   the package.

3. **(PG6 platform-architect)** Add `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` to
   `packages/config/src/env.ts`. Add `DEPLOY_ENV` (or equivalent staging signal) to env schema.
   Update `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` to use `loadEnv()`. Update
   the web bridge factory call site to pass `deployEnv` + key from env.

4. **(PG6 tests-runner)** Write `packages/axioma-bridge/src/bridge-signer-fence.test.ts` per
   §Verification/tests §1. Write `tests/integration/db-jti-replay.test.ts` per §Verification/tests §2.

5. **(operator)** After all per-agent handoffs at epoch 20260530-2230 exist, write the aggregate
   at `docs/handoffs/20260530-2230-phase-2-9-axioma-pg6-jti-es256.md` (or equivalent) citing all
   per-agent handoffs by path. Run the full gate sequence from §Verification/tests §3 in order.
   Update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` (serialize-last).
   Run `npm run governance:check` to confirm the N-cited pass at the new epoch.

6. **(safety carry-over)** `BOT_ADAPTER_MODE=mock` default preserved. CTAs remain DISABLED (B4).
   No live bot control, no real adapters activated, no exchange keys exposed, no live Stripe charge,
   no Axioma production handoff. `retries: 2` for e2e. Legacy real adapter deleted + factory-blocked (B3).
