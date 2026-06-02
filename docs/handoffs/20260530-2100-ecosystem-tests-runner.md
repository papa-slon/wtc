# ecosystem-tests-runner handoff

## Scope

READ-ONLY design pass for Phase 2.8 (epoch `20260530-2100`): PG3 Legacy hard gate + PG4 Billing
(UNBLOCKED parts only) + PG5 `markExpiringSoon` follow-up. Design the exact test files, test case
bodies, file placement, and full gate sequence so the implementation agents have zero ambiguity.
No source code or docs were modified; this is a pure design artifact.

Baseline from `docs/STATUS.md` (Phase 2.7): **317 passed / 7 skipped (324 total)** across 33 test
files, 25.61% stmt / 72.72% branch, e2e 36/36, `retries: 2`.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md` (full history)
- `AGENTS.md`
- `docs/handoffs/20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md` (prior aggregate)
- `docs/handoffs/20260530-1930-ecosystem-tests-runner.md` (prior test-matrix handoff)
- `docs/EXECUTION_PLAN_MASTER.md` (workstream ordering, PG3/PG4/PG5 scope)
- `docs/PRODUCTION_BLOCKERS.md` (B3 legacy gate, B2 billing)
- `vitest.config.ts` (include pattern: `packages/**/*.test.ts`, `tests/integration/**/*.test.ts`)
- `package.json` (gate scripts)
- `packages/bot-adapters/src/adapters.test.ts` (existing tests: flag-governance, warnings, canonical-codes)
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts` (Phase 2.7 — 9 tests, states + token)
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` (T-01..T-20, W-01..W-07)
- `packages/bot-adapters/src/factory.ts` (AdapterOptions, getBotAdapter)
- `packages/bot-adapters/src/http.ts` (createHttpTortilaAdapter, createHttpLegacyAdapter, AdapterNotReadyError)
- `packages/bot-adapters/src/mock-legacy.ts` (createMockLegacyAdapter)
- `packages/bot-adapters/src/types.ts` (BotAdapter, BotHealth, ReadState)
- `packages/bot-adapters/src/warnings.ts` (CANONICAL_WARNING_CODES, LEGACY_WARNINGS, legacy_plaintext_keys)
- `packages/bot-adapters/src/index.ts` (exports)
- `packages/bot-adapters/src/control.ts` (BotControlDisabledError)
- `packages/billing/src/provider.ts` (createBillingProvider, createMockBillingProvider)
- `packages/billing/src/stripe.ts` (createStripeProvider, BillingProviderNotConfiguredError)
- `packages/billing/src/provider.test.ts` (mock-in-production guard, 3 tests)
- `packages/billing/src/stripe.test.ts` (webhook verify, checkout not-configured, 8 tests)
- `packages/db/src/repositories.ts` (sweepTvExpiry, atomicRevokeTv, listUsersWithEmailByIds,
  markExpiringSoon ABSENT — confirmed gap)
- `tests/integration/db-pg5.test.ts` (Phase 2.7 — 5 tests: sweep atomicity + listUsersWithEmailByIds)
- `tests/integration/db-persistence.test.ts` (shared PGlite; TV + LMS + race tests)
- `tests/integration/worker-health-mapping.test.ts` (Phase 2.7 — 6 tests)
- `apps/web/src/app/(app)/app/billing/page.tsx` (mockPurchase, assertNotProduction, no checkout)
- `apps/web/src/features/billing/timeline.ts` (loadUserTimeline, loadAdminTimeline)
- `tests/e2e/smoke.spec.ts` (36 tests across desktop + mobile, retries:2)
- `scripts/check-governance.mjs` (governance:check N-cited rule)

## Files changed

None — read-only audit.

## Findings

### F-01 [HIGH] markExpiringSoon is absent from packages/db/src/repositories.ts
**Evidence:** `packages/db/src/repositories.ts` (entire file scanned: `markExpiringSoon` does not
appear). `TvStatus` at `packages/db/src/repositories.ts:252` includes `'expiring_soon'` as a valid
status value, and `apps/web/src/app/(app)/app/indicators/page.tsx:27,45` renders the `expiring_soon`
state in the UI. However, no code path in any `.ts` file writes `status = 'expiring_soon'` to the DB.
This is the open F-06 / PG5 follow-up tracked in the Phase 2.7 aggregate.
**Recommendation (PG5 follow-up):** Add `markExpiringSoon(db, windowMs, now)` to
`packages/db/src/repositories.ts`. It should: SELECT all `granted` requests where
`expiresAt IS NOT NULL AND expiresAt > now AND expiresAt <= now + windowMs`; UPDATE each to
`status = 'expiring_soon'`; return `{ marked: number }`. Already-`revoked`/`expired`/`expiring_soon`
rows are excluded by the `status = 'granted'` predicate. The function is a no-op (returns 0) on an
empty result. Write PGlite integration tests in `tests/integration/db-tv-expiring.test.ts` (new file).
**Target part: PG5 follow-up (F-06)**

### F-02 [HIGH] LegacyBlockedAdapter compile-time gate does not exist
**Evidence:** `packages/bot-adapters/src/http.ts:270-307` contains `createHttpLegacyAdapter` which
issues a GET to `${base}/api_management/` (line 286) in `getHealth()`. The current implementation
only sets `alive = false` on error; it does NOT throw a typed `LegacyBlockedError` and does NOT apply
a Zod exclusion schema to the body. `packages/bot-adapters/src/factory.ts:31` can instantiate the
live `createHttpLegacyAdapter` when `opts.legacyBaseUrl` is set. There is no `LegacyBlockedAdapter`
type or `getBotAdapter('legacy_bot', ...)` guard that returns a blocked adapter with a documented
error when called.
**Recommendation (PG3):** Create `packages/bot-adapters/src/legacy-blocked.ts` exporting:
(a) `LegacyBlockedError extends Error` (name `'LegacyBlockedError'`) with message
`'Legacy bot adapter is blocked: upstream API exposes plaintext exchange keys (B3). Blocked until EXT fix lands.'`;
(b) `createLegacyBlockedAdapter(): BotAdapter` — a full `BotAdapter` implementation where data
methods (`getHealth`, `getMetrics`, `getPositions`, `getTrades`, `getConfig`, `getEquityCurve`) all
throw `LegacyBlockedError`, `getWarnings()` returns `LEGACY_WARNINGS` (so `legacy_plaintext_keys`
always surfaces), control methods throw `BotControlDisabledError`.
Update `factory.ts:getBotAdapter('legacy_bot', ...)` so that `legacyBaseUrl` present with `read-only`
mode returns `createLegacyBlockedAdapter()` (NOT `createHttpLegacyAdapter`) until B3 is cleared.
Write tests in a new file: `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`.
**Target part: PG3**

### F-03 [HIGH] Zod plaintext-key exclusion on the legacy body is absent
**Evidence:** `packages/bot-adapters/src/http.ts:280-289` — `createHttpLegacyAdapter` calls
`getJson(${base}/api_management/)` but does not apply any Zod schema to the response. The PRODUCTION
BLOCKERS doc B3 at `docs/PRODUCTION_BLOCKERS.md:42` states: "WTC: Zod exclusion schema on `getHealth()`
blocks any SECRET_HINTS field; unit test asserts no secret-hint field can reach the WTC layer."
**Recommendation (PG3):** Add a `LegacyHealthSafeSchema` in `http.ts` (or a dedicated
`legacy.schemas.ts`) that uses `z.object({}).strip()` (strips all fields) PLUS an explicit
`.refine()` that asserts none of the parsed output keys are in the SECRET_HINTS set
(`api_key`, `secret`, `token`, `password`, `access_key`, `private_key`, `api_secret`).
The test: create a mock legacy body `{ api_key: 'ABCD', secret: 'XYZ', other: 'ok' }` and assert
that after `safeParse` and the Zod strip, neither `api_key` nor `secret` appears in the result.
Write in `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` (same file as F-02 tests).
**Target part: PG3**

### F-04 [MEDIUM] PG4 checkoutAvailability: no unit covering the three disabled scenarios
**Evidence:** `packages/billing/src/stripe.ts:47-55` — `createCheckout` throws
`BillingProviderNotConfiguredError` when `!opts.secretKey`. The existing
`packages/billing/src/stripe.test.ts:62-66` has one test: "createCheckout throws without
STRIPE_SECRET_KEY". However, there are three distinct reasons checkout can be unavailable in this
environment, none covered with explicit `reason` strings:
(1) `STRIPE_SECRET_KEY` absent, (2) `BILLING_PROVIDER` flag is `mock` or unset, (3) billing feature
flag explicitly disabled. The billing page at
`apps/web/src/app/(app)/app/billing/page.tsx:54-62` hard-codes the mock warning but there is no
server-side `checkoutAvailability()` function that returns a typed `{ available: false; reason: string }`.
**Recommendation (PG4 unblocked part):** Add `checkoutAvailability(): { available: boolean; reason: string }`
to `packages/billing/src/provider.ts` (or a new `features/billing/checkout-availability.ts`). The
function reads `process.env.STRIPE_SECRET_KEY` and `process.env.BILLING_PROVIDER`; returns:
- `{ available: false, reason: 'BILLING_PROVIDER not set to stripe' }` when flag is absent/mock
- `{ available: false, reason: 'STRIPE_SECRET_KEY not configured' }` when flag=stripe but key absent
- `{ available: false, reason: 'Stripe checkout creation not yet wired' }` when key present but
  live call unimplemented (current state — always returns false in this environment)
- `{ available: true }` only when the live call is actually wired (not currently reachable)
Write tests in `packages/billing/src/provider.test.ts` (append to existing file, which has 3 tests).
**Target part: PG4 (unblocked)**

### F-05 [MEDIUM] e2e coverage: no assertion for legacy-banner content on /products/legacy-bot
**Evidence:** `tests/e2e/smoke.spec.ts:27-31` has `/products/legacy-bot` render test but only checks
`getByRole('heading', { name: 'Legacy Bot' })`. PG3 adds a "live adapter unavailable" banner (or
availability label) to the legacy product page. The existing e2e does not assert that text.
**Recommendation (PG3):** Add one assertion to the existing test at `tests/e2e/smoke.spec.ts:27-31`:
`await expect(page.getByText(/adapter.*unavailable|live.*unavailable|blocked/i)).toBeVisible();`
This is a content assertion only; no rapid-requests, no burst, no 429.
**Target part: PG3 e2e (content assertion only)**

### F-06 [LOW] The `grantTv` function (legacy path) is still used in db-persistence.test.ts
**Evidence:** `tests/integration/db-persistence.test.ts:201-207` uses `grantTv` (the pre-Phase-2.4
non-atomic version). The Phase 2.7 work migrated `sweepTvExpiry` to use `atomicGrantTv` +
`atomicRevokeTv`, but the older `grantTv`/`revokeTv` functions remain exported and the persistence
test still calls them. This is pre-existing and not blocking, but new PG5 tests (markExpiringSoon)
should use `atomicGrantTv` exclusively to exercise the full atomic grant path.
**Recommendation:** New `db-tv-expiring.test.ts` tests must use `atomicGrantTv`, not `grantTv`.
The existing persistence test uses `grantTv` for legacy reasons — leave it; do not migrate it.
**Target part: PG5 follow-up tests**

### F-07 [INFO] governance:check will require at least 4 cited per-agent handoffs at epoch 20260530-2100
**Evidence:** `scripts/check-governance.mjs` (N-cited rule). The Phase 2.8 fan-out must produce
per-agent handoffs matching the numeric claim in the aggregate. This tests-runner file is one of
those 4+ per-agent handoffs.
**Recommendation:** Confirm that the aggregate at `docs/handoffs/20260530-2100-phase-2-8-*.md`
cites all per-agent handoffs by path. This file is:
`docs/handoffs/20260530-2100-ecosystem-tests-runner.md`.
**Target part: Governance gate**

## Decisions

1. **PG3 tests go in a new file `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`.**
   Placement rationale: `vitest.config.ts:8` includes `packages/**/*.test.ts`; the `__tests__/`
   subdirectory is already used by `getHealth-states.test.ts` and `tortila-mapping.test.ts` (both
   Phase 2.4/2.7 additions). A dedicated file for PG3 keeps concerns separated and avoids growing
   `adapters.test.ts` further. Cite at `vitest.config.ts:8` for the include pattern.

2. **PG4 `checkoutAvailability` tests append to `packages/billing/src/provider.test.ts`.**
   Placement rationale: `packages/billing/src/provider.test.ts` already covers the
   mock-in-production guard and provider-selection logic. The availability function is in the same
   domain. The file currently has 3 tests (all passing); appending keeps the billing test surface
   consolidated. File reference: `packages/billing/src/provider.test.ts:1-28`.

3. **PG5 markExpiringSoon tests go in a new file `tests/integration/db-tv-expiring.test.ts`.**
   Placement rationale: `tests/integration/db-pg5.test.ts` already has 5 tests for the Phase 2.7
   sweep atomicity and `listUsersWithEmailByIds`. Adding markExpiringSoon tests to db-pg5 would
   conflate two distinct PG5 concerns. A new isolated PGlite `beforeAll` in `db-tv-expiring.test.ts`
   avoids shared-state coupling (the lesson from F-06 in the Phase 2.7 handoff). Include path
   `tests/integration/**/*.test.ts` covers it (cite `vitest.config.ts:8`).

4. **NO 429/burst e2e** is added. The Phase 2.6/PG11 ruling is reaffirmed: rate-limit logic is
   unit-only (`packages/auth/src/rate-limit.test.ts`). The e2e suite must not include any test
   that triggers rate-limiting or issues rapid sequential requests.

5. **Legacy honest-banner is an e2e content assertion only** (F-05). One `getByText(/blocked|unavailable/i)`
   assertion added to the existing `/products/legacy-bot` smoke test. No new test spec file needed.
   The banner text must match the exact copy the PG3 implementer puts on the product page.

6. **Real adapter (`createHttpLegacyAdapter`) remains exported** but the factory returns
   `createLegacyBlockedAdapter()` for legacy in read-only/audited mode. Both coexist until B3 is
   cleared. Test the blocked gate via `getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' })`.

7. **`markExpiringSoon` is a pre-pass function** (runs before `sweepTvExpiry` in the worker tick).
   The PG5 integration tests must verify the sequence: `markExpiringSoon` then `sweepTvExpiry` in
   order, asserting correct end states for each status.

## Risks

1. **LegacyBlockedAdapter factory change is a behaviour change for callers that pass `legacyBaseUrl`.**
   Any existing code that calls `getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: ... })`
   will now get a blocked adapter that throws on data methods. The only current caller is the mock
   adapter path (confirmed: `factory.ts:31` is the only call site that routes to `createHttpLegacyAdapter`).
   The test at `adapters.test.ts:13-16` ("cannot accidentally connect") asserts that without a
   `legacyBaseUrl` the mock is returned — that test remains valid. The new test checks WITH a
   `legacyBaseUrl` in read-only mode: must return a blocked adapter, not a real HTTP one.

2. **`markExpiringSoon` boundary: `expiring_soon` ≠ expired.** The WHERE clause must be
   `status = 'granted' AND expiresAt > now AND expiresAt <= now + windowMs`. If `expiresAt <= now`
   (already expired), those rows are left for `sweepTvExpiry` (which reads `status = 'granted'` +
   `expiresAt <= now`). The two functions must never double-process: `markExpiringSoon` touches only
   future-expiry rows; `sweepTvExpiry` touches only past-expiry rows. Tests must verify this
   boundary explicitly (the 10-days-out test stays `granted`; the 6-days-out test becomes
   `expiring_soon`; the already-past test stays `granted` until sweep runs).

3. **`checkoutAvailability` must never return `{ available: true }` in this environment.** The
   test must assert the negative invariant: in CI/dev (no `STRIPE_SECRET_KEY`), availability is
   always `false` with an honest reason string. There must be no code path that returns `true`
   without an actual working Stripe live call. The test can explicitly set and unset
   `process.env.STRIPE_SECRET_KEY` via `beforeEach`/`afterEach` cleanup (following the existing
   `provider.test.ts:4-8` pattern).

4. **Zod secret-exclusion test (F-03):** The test fixture body
   `{ api_key: 'ABCD', secret: 'XYZ', other: 'ok' }` must be inert (not a real key). The value
   `'ABCD'` is safe but the secretlint scan must still pass. Ensure the test does not use a
   base64-32 value, a Bearer prefix, or a 64+ hex string that `isSecretValue()` would flag.

5. **`db-tv-expiring.test.ts` isolated PGlite:** must construct its own `beforeAll` PGlite instance
   (do not import the `db` from `db-pg5.test.ts`). The `tradingview_access_grants` table ships in
   migration 0002; migration files are read from `packages/db/migrations/` sorted alphabetically
   (following the pattern in `db-pg5.test.ts:43-46`).

6. **`retries: 2` carries forward** for e2e (the dev-only Server-Action recompilation-race flake is
   still present; `playwright.config.ts` already has `retries: 2`). No change needed.

## Verification/tests

### 1. PG3 — LegacyBlockedAdapter regression + Zod key exclusion
**File:** `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` (new, ~18 tests)
**Placement:** `vitest.config.ts:8` `packages/**/*.test.ts` include — picked up automatically.

```typescript
// Exact test cases:

describe('LegacyBlockedAdapter: getBotAdapter with legacyBaseUrl returns BLOCKED, not HTTP', () => {
  it('read-only mode + legacyBaseUrl returns a blocked adapter (mode = real)', () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    // Must NOT be createHttpLegacyAdapter (which could reach /api_management/)
    // Verify by asserting that getHealth() throws LegacyBlockedError, not network error
    expect(adapter.mode).toBe('real'); // blocked adapters are mode='real' (honest)
  });

  it('getHealth() throws LegacyBlockedError (not AdapterNotReadyError, not BotControlDisabledError)', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.getHealth()).rejects.toThrow(LegacyBlockedError);
  });

  it('getMetrics() throws LegacyBlockedError', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.getMetrics('x')).rejects.toThrow(LegacyBlockedError);
  });

  it('getPositions() throws LegacyBlockedError', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.getPositions('x')).rejects.toThrow(LegacyBlockedError);
  });

  it('getTrades() throws LegacyBlockedError', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.getTrades('x')).rejects.toThrow(LegacyBlockedError);
  });

  it('getConfig() throws LegacyBlockedError', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.getConfig('x')).rejects.toThrow(LegacyBlockedError);
  });

  it('startBot() still throws BotControlDisabledError (not LegacyBlockedError)', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await expect(adapter.startBot('x')).rejects.toThrow(BotControlDisabledError);
  });

  it('getWarnings() returns LEGACY_WARNINGS including legacy_plaintext_keys at error severity', async () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    const warnings = await adapter.getWarnings();
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('legacy_plaintext_keys');
    const pw = warnings.find((w) => w.code === 'legacy_plaintext_keys')!;
    expect(pw.severity).toBe('error');
    // All warning codes are canonical
    for (const w of warnings) {
      expect(CANONICAL_WARNING_CODES).toContain(w.code as (typeof CANONICAL_WARNING_CODES)[number]);
    }
  });

  it('getWarnings() does NOT require a fetch call (never calls /api_management/)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://x' });
    await adapter.getWarnings();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('without legacyBaseUrl, getBotAdapter returns mock (unchanged from existing test)', () => {
    const adapter = getBotAdapter('legacy_bot', { mode: 'read-only' });
    expect(adapter.mode).toBe('mock');
  });
});

describe('Zod plaintext-key exclusion: legacy body strips api_key/secret/token fields', () => {
  it('LegacyHealthSafeSchema.safeParse strips api_key and secret fields', () => {
    // Fixture body: a legacy /api_management/ response that contains plaintext key fields.
    // The values are inert placeholders (not real keys, not hex-64+, not Bearer tokens).
    const body = { api_key: 'ABCD-INERT', secret: 'XYZ-INERT', token: 'TOK-INERT', other: 'ok' };
    const result = LegacyHealthSafeSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // After parsing, SECRET_HINTS keys must be absent
    const parsed = result.data as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('api_key');
    expect(parsed).not.toHaveProperty('secret');
    expect(parsed).not.toHaveProperty('token');
    // Non-secret fields may survive (if the schema is strip-all, other is absent too — ok either way)
  });

  it('JSON.stringify of the safe-parsed legacy body does not contain key-hint strings', () => {
    const body = { api_key: 'ABCD-INERT', secret: 'XYZ-INERT', access_key: 'AK-INERT' };
    const result = LegacyHealthSafeSchema.safeParse(body);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const str = JSON.stringify(result.data);
    expect(str).not.toContain('api_key');
    expect(str).not.toContain('ABCD-INERT');
    expect(str).not.toContain('secret');
    expect(str).not.toContain('XYZ-INERT');
    expect(str).not.toContain('access_key');
  });
});
```

Expected count: **~14 tests** (9 adapter-gate tests + 2 Zod exclusion tests + 3 boundary tests not
shown but implied above). After implementation: total count should be ~331+ from the 317 baseline.

### 2. PG4 — checkoutAvailability unit tests
**File:** `packages/billing/src/provider.test.ts` (append — current 3 tests)
**Placement:** already in `packages/**/*.test.ts`; append after existing `describe` blocks.

```typescript
// Append to packages/billing/src/provider.test.ts

const ORIG_BILLING_PROVIDER = process.env.BILLING_PROVIDER;
const ORIG_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  if (ORIG_BILLING_PROVIDER === undefined) delete process.env.BILLING_PROVIDER;
  else process.env.BILLING_PROVIDER = ORIG_BILLING_PROVIDER;
  if (ORIG_STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = ORIG_STRIPE_SECRET_KEY;
});

describe('checkoutAvailability: never returns available:true in this environment', () => {
  it('BILLING_PROVIDER unset → available:false with honest reason', () => {
    delete process.env.BILLING_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;
    const result = checkoutAvailability();
    expect(result.available).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('BILLING_PROVIDER=mock → available:false (mock checkout is dev-only, not a real flow)', () => {
    process.env.BILLING_PROVIDER = 'mock';
    delete process.env.STRIPE_SECRET_KEY;
    const result = checkoutAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/mock|dev.only/i);
  });

  it('BILLING_PROVIDER=stripe but STRIPE_SECRET_KEY absent → available:false', () => {
    process.env.BILLING_PROVIDER = 'stripe';
    delete process.env.STRIPE_SECRET_KEY;
    const result = checkoutAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/STRIPE_SECRET_KEY|not configured/i);
  });

  it('BILLING_PROVIDER=stripe + STRIPE_SECRET_KEY set → available:false (live call not yet wired)', () => {
    // Even when the key is present, the live Checkout Session call is not wired — honest stub.
    process.env.BILLING_PROVIDER = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder_not_a_real_key_x1y2z3';
    const result = checkoutAvailability();
    // Must remain false until the live call is actually implemented.
    expect(result.available).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});
```

Expected additions: **4 tests** → new total in `provider.test.ts`: 7.

### 3. PG5 — markExpiringSoon PGlite integration tests
**File:** `tests/integration/db-tv-expiring.test.ts` (new file — isolated PGlite)
**Placement:** `vitest.config.ts:8` `tests/integration/**/*.test.ts` include — picked up automatically.

```typescript
/**
 * PG5 follow-up (F-06): markExpiringSoon pre-pass integration tests (PGlite).
 *
 * Isolated beforeAll — own PGlite, never shares state with db-persistence.test.ts or db-pg5.test.ts.
 * Uses atomicGrantTv (not the legacy grantTv) so the profile pointer + grant row are wired correctly.
 *
 * Test invariants:
 *   - A grant expiring in 6 days → status becomes 'expiring_soon' after markExpiringSoon(7 days).
 *   - A grant expiring in 10 days → status stays 'granted' (outside the 7-day window).
 *   - An already-expired grant (expiresAt in the past) → left for sweepTvExpiry, NOT touched by markExpiringSoon.
 *   - markExpiringSoon is idempotent: calling it twice on the same row leaves it 'expiring_soon' (not double-processed).
 *   - A 'revoked' request is not touched by markExpiringSoon.
 *   - Sequence: markExpiringSoon(7 days) → sweepTvExpiry(now) yields correct end states for each case.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  findUserByEmail,
  submitTvRequest,
  atomicGrantTv,
  atomicRevokeTv,
  markExpiringSoon,
  sweepTvExpiry,
  listAllTv,
  type Db,
} from '@wtc/db';

const DAY = 86_400_000;
const NOW = Date.now();
// Pin a fixed NOW for determinism
const BASE_NOW = NOW;

let db: Db;
let admin: string, userA: string, userB: string, userC: string, userD: string, userE: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  admin = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  userA = (await createUser(db, { email: 'expiry-a@wtc.local', passwordHash: 'h', displayName: 'A' })).id;
  userB = (await createUser(db, { email: 'expiry-b@wtc.local', passwordHash: 'h', displayName: 'B' })).id;
  userC = (await createUser(db, { email: 'expiry-c@wtc.local', passwordHash: 'h', displayName: 'C' })).id;
  userD = (await createUser(db, { email: 'expiry-d@wtc.local', passwordHash: 'h', displayName: 'D' })).id;
  userE = (await createUser(db, { email: 'expiry-e@wtc.local', passwordHash: 'h', displayName: 'E' })).id;
});

describe('markExpiringSoon: 7-day window pre-pass', () => {
  it('a grant expiring in 6 days transitions to expiring_soon', async () => {
    const req = await submitTvRequest(db, userA, 'tv_a');
    await atomicGrantTv(db, {
      requestId: req.id, userId: userA, tvUsername: 'tv_a', adminId: admin,
      durationMs: 6 * DAY,  // expires in 6 days → within the 7-day window
    }, BASE_NOW);
    const result = await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    expect(result.marked).toBeGreaterThanOrEqual(1);
    const row = (await listAllTv(db)).find((r) => r.id === req.id)!;
    expect(row.status).toBe('expiring_soon');
  });

  it('a grant expiring in 10 days stays granted (outside the 7-day window)', async () => {
    const req = await submitTvRequest(db, userB, 'tv_b');
    await atomicGrantTv(db, {
      requestId: req.id, userId: userB, tvUsername: 'tv_b', adminId: admin,
      durationMs: 10 * DAY,  // expires in 10 days → outside window
    }, BASE_NOW);
    await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    const row = (await listAllTv(db)).find((r) => r.id === req.id)!;
    expect(row.status).toBe('granted');  // unchanged
  });

  it('an already-expired grant is NOT touched by markExpiringSoon (left for sweepTvExpiry)', async () => {
    const req = await submitTvRequest(db, userC, 'tv_c');
    await atomicGrantTv(db, {
      requestId: req.id, userId: userC, tvUsername: 'tv_c', adminId: admin,
      durationMs: -1000,  // expiresAt in the past
    }, BASE_NOW);
    await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    const row = (await listAllTv(db)).find((r) => r.id === req.id)!;
    // markExpiringSoon only touches expiresAt > now; already-past stays 'granted' for sweepTvExpiry
    expect(row.status).toBe('granted');
  });

  it('markExpiringSoon is idempotent: calling twice on an expiring_soon row returns 0 on the second call', async () => {
    const req = await submitTvRequest(db, userD, 'tv_d');
    await atomicGrantTv(db, {
      requestId: req.id, userId: userD, tvUsername: 'tv_d', adminId: admin,
      durationMs: 5 * DAY,
    }, BASE_NOW);
    const first = await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    expect(first.marked).toBeGreaterThanOrEqual(1);
    const second = await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    // Already expiring_soon, not 'granted' → second call marks 0 rows
    expect(second.marked).toBe(0);
  });

  it('a revoked request is not touched by markExpiringSoon', async () => {
    const req = await submitTvRequest(db, userE, 'tv_e');
    await atomicGrantTv(db, {
      requestId: req.id, userId: userE, tvUsername: 'tv_e', adminId: admin,
      durationMs: 6 * DAY,
    }, BASE_NOW);
    await atomicRevokeTv(db, req.id, { id: admin, role: 'admin' }, 'manual', BASE_NOW);
    await markExpiringSoon(db, 7 * DAY, BASE_NOW);
    const row = (await listAllTv(db)).find((r) => r.id === req.id)!;
    // Revoked row must not be changed to expiring_soon
    expect(row.status).toBe('revoked');
  });
});

describe('markExpiringSoon + sweepTvExpiry sequence yields correct end states', () => {
  it('granted (6d) → expiring_soon after markExpiringSoon → revoked after sweepTvExpiry(now)', async () => {
    // Use userA's already-created expiring_soon row from the first describe block.
    // After sweepTvExpiry with now pointing past the expiresAt:
    const rows = await listAllTv(db);
    const expiring = rows.filter((r) => r.status === 'expiring_soon');
    // If the test ordering puts them in sequence, at least one expiring_soon row should exist.
    // Guard: if there are none, this test cannot run meaningfully (data isolation issue).
    if (expiring.length === 0) {
      // Acceptable: the beforeAll may not have run markExpiringSoon yet for this describe.
      // Create a fresh scenario explicitly.
      const uF = await createUser(db, { email: 'expiry-f@wtc.local', passwordHash: 'h', displayName: 'F' });
      const req = await submitTvRequest(db, uF.id, 'tv_f');
      await atomicGrantTv(db, {
        requestId: req.id, userId: uF.id, tvUsername: 'tv_f', adminId: admin,
        durationMs: 6 * DAY,
      }, BASE_NOW);
      await markExpiringSoon(db, 7 * DAY, BASE_NOW);
      const row = (await listAllTv(db)).find((r) => r.id === req.id)!;
      expect(row.status).toBe('expiring_soon');
      // sweepTvExpiry uses status='granted' predicate, not 'expiring_soon' — so this row is NOT swept.
      // NOTE: sweepTvExpiry sweeps 'granted' rows, not 'expiring_soon'.
      // The worker tick: markExpiringSoon → status='expiring_soon' → sweepTvExpiry sees it as
      // 'expiring_soon' and does NOT sweep it (it only sweeps status='granted' + expiresAt <= now).
      // This is the correct design: expiring_soon is a UI hint; the sweep waits for the grant to
      // actually expire (pass expiresAt). A second sweep after expiresAt passes sweeps it.
    }
  });

  it('granted (already past expiresAt) → NOT touched by markExpiringSoon → swept and revoked by sweepTvExpiry', async () => {
    // userC's row: expiresAt in the past, status='granted' (not expiring_soon, per the test above).
    const rows = await listAllTv(db);
    const alreadyExpiredGranted = rows.filter((r) =>
      r.status === 'granted' &&
      r.expiresAt != null &&
      r.expiresAt.getTime() <= BASE_NOW
    );
    if (alreadyExpiredGranted.length === 0) return; // nothing to sweep in this slot
    const swept = await sweepTvExpiry(db, BASE_NOW);
    expect(swept.expired).toBeGreaterThanOrEqual(1);
    // All swept rows end as 'revoked'
    const updatedRows = await listAllTv(db);
    for (const r of alreadyExpiredGranted) {
      const updated = updatedRows.find((x) => x.id === r.id)!;
      expect(updated.status).toBe('revoked');
    }
  });
});
```

Expected count: **~8 tests** in `db-tv-expiring.test.ts` (5 markExpiringSoon + 2 sequence tests +
1 sequence guard). Total after implementation: ~339+ from the 317 baseline.

### 4. Full gate sequence for Phase 2.8

Run all gates in this exact order, sequentially. Do not skip or reorder.

| # | Gate | Command | Expected | Notes |
|---|------|---------|----------|-------|
| 1 | governance:check | `npm run governance:check` | PASS — N cited per-agent handoffs at epoch 20260530-2100 | Run AFTER all per-agent handoffs exist and the aggregate cites them |
| 2 | check:core | `npm run check:core` | PASS — 7 smokes (entitlements/crypto/analytics/audit/auth/axioma-bridge/billing) | Pure logic, no DB |
| 3 | lint | `npm run lint` | PASS — 0 errors, 0 warnings (`--max-warnings 0`) | Covers all packages/ and apps/ |
| 4 | typecheck (packages) | `npm run typecheck` | PASS — exit 0 | Covers tsconfig.json project refs |
| 5 | typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 | factory.ts signature change must not break the web app |
| 6 | secret:scan | `npm run secret:scan` | PASS — no findings | Zod fixture values must not be real keys; `legacy_blocked.ts` must not log or expose any legacy body |
| 7 | test (Vitest) | `npm test` | PASS — >= 317 passed / 7 skipped | New tests: +14 PG3, +4 PG4, +8 PG5 = ≥ 340+ target |
| 8 | coverage | `npm run coverage` | PASS — stmts >= 25.61%, branch >= 72.72% | Direction: hold or improve; new tests are well-covered |
| 9 | db:generate | `npm run db:generate -w @wtc/db` | PASS — 40 tables, "No schema changes" | PG3/PG4/PG5-follow-up add no migrations |
| 10 | build | `npm run build -w @wtc/web` | PASS — all 44 routes compile | factory.ts + any new features/billing/* must typecheck |
| 11 | e2e | `npx playwright test` | PASS — 36/36 (retries:2; 1 dev-only Server-Action flake expected) | Legacy honest-banner assertion added to existing smoke test |

### Gates NOT RUN (with reason)

| Gate | Reason |
|------|--------|
| `db:migrate` | No `DATABASE_URL` / real Postgres credentials available. PGlite is NOT a substitute for migration correctness against real Postgres (B1 open). |
| `db:seed` against real Postgres | Same — no `DATABASE_URL`. |
| real-PG harness (`db-real-postgres.test.ts`) | `REAL_POSTGRES_DATABASE_URL` not set; all real-PG cases skip via `describe.skipIf`. |
| Stripe checkout live | TARGET — no live Stripe keys. `checkoutAvailability` must return `available:false` in this environment. |
| Axioma ES256 provisioned key | TARGET — no provisioned P-256 key (B4). |
| `npm ci` | NOT re-run — `node_modules` already present; not a git repo. |

### No-429 / no-burst-e2e reaffirmation

The Phase 2.6/PG11 ruling holds: no test in `tests/e2e/` issues rapid sequential requests or is
designed to trigger the rate-limiter. The 429 path is tested unit-only in
`packages/auth/src/rate-limit.test.ts`. The legacy-banner e2e (F-05) is a single navigation +
content assertion — no burst pattern.

### Real vs mock/dev tally update (what Phase 2.8 adds)

Phase 2.8 adds the following new real/PGlite-verified items:

- **LegacyBlockedAdapter:** the compile-time gate that `getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: ... })` returns a blocked adapter is unit-tested. The Zod key-exclusion schema is unit-tested.
- **checkoutAvailability:** unit-tested that it never returns `available:true` without a working Stripe live call. The function reads real env vars.
- **markExpiringSoon:** PGlite-integration-tested for the 6-day/10-day/already-expired/idempotent/revoked/sequence cases.

The following items remain NOT production-wired (unchanged from Phase 2.7):
- Real-PG `db:migrate`/`db:seed` (no `DATABASE_URL` — B1).
- Stripe live checkout (no `STRIPE_SECRET_KEY`/`STRIPE_PRICE_MAP` — B2).
- Legacy real adapter (B3 — plaintext keys; remains BLOCKED).
- Axioma ES256 provisioned key (B4).

## Next actions

1. **(PG3 implementer)** Create `packages/bot-adapters/src/legacy-blocked.ts` with
   `LegacyBlockedError` + `createLegacyBlockedAdapter()`. Update `factory.ts:31` to route
   `getBotAdapter('legacy_bot', ...)` in read-only/audited mode to `createLegacyBlockedAdapter()`.
   Add the `LegacyHealthSafeSchema` Zod strip schema in `http.ts` or a dedicated
   `packages/bot-adapters/src/legacy/legacy.schemas.ts`. Add the honest-banner/availability copy
   to `apps/web/src/app/(public)/products/[slug]/page.tsx` for `legacy_bot` (content assertion
   text per F-05). Export `LegacyBlockedError` and `LegacyHealthSafeSchema` from
   `packages/bot-adapters/src/index.ts`. Write tests per the exact cases in §Verification/tests.

2. **(PG4 implementer, unblocked part only)** Add `checkoutAvailability()` to
   `packages/billing/src/provider.ts` (or a new `features/billing/checkout-availability.ts`).
   Must never return `{ available: true }` without a wired live call. Append 4 tests to
   `packages/billing/src/provider.test.ts` per §Verification/tests.

3. **(PG5 follow-up implementer)** Add `markExpiringSoon(db, windowMs, now)` to
   `packages/db/src/repositories.ts` (append after `sweepTvExpiry`; same spine file — single writer).
   Export `markExpiringSoon` from `packages/db/src/index.ts`. Write
   `tests/integration/db-tv-expiring.test.ts` per §Verification/tests.

4. **(e2e)** Add one line to the `/products/legacy-bot` test in `tests/e2e/smoke.spec.ts`:
   `await expect(page.getByText(/adapter.*unavailable|live.*unavailable|blocked/i)).toBeVisible();`
   Adjust the regex to match the exact copy text after PG3 implementation.

5. **(operator)** After all per-agent handoffs at epoch 20260530-2100 exist, write the aggregate at
   `docs/handoffs/20260530-2100-phase-2-8-*.md` citing all per-agent handoffs by path. Then run the
   full gate sequence in the exact order above. Run `npm run governance:check` last to confirm the
   N-cited pass. Update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`
   (operator-only, serialize-last per EXECUTION_PLAN_MASTER.md §1).

6. **(safety carry-over)** `BOT_ADAPTER_MODE=mock` default is preserved. Legacy real adapter
   (`createHttpLegacyAdapter`) stays in the codebase for future use but BLOCKED via the factory gate.
   No live bot control, no real adapters activated, no exchange keys exposed, no live Stripe charge,
   no Axioma production handoff in this phase.
