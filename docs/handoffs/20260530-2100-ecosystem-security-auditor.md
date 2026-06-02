# ecosystem-security-auditor handoff

## Scope

Phase 2.8 (epoch 20260530-2100) security review across PG3 (legacy hard gate), PG4 (billing
unblocked parts), and PG5 (markExpiringSoon follow-up). Read-only audit — no code changes.

Three specific mandates:
1. PG3: audit SECRET_HINTS list vs. Zod legacy-body exclusion requirement; confirm legacy
   getHealth() body-isolation; confirm 5 BOT_CONTROL_SAFETY_MODEL gates remain NOT STARTED;
   confirm LegacyBlockedAdapter invariant integrity.
2. PG4: confirm B2 checkout is NOT RUN and must remain so; specify the honest fail-closed seam
   for the UNBLOCKED part; verify env.ts STRIPE_* handling; confirm entitlements remain the
   only access source of truth.
3. PG5: confirm system actor pattern for markExpiringSoon; decide whether an expiring_soon
   status bump needs an audit row; confirm idempotency and no access loosening.

## Files inspected

- `packages/audit/src/redact.ts` (full)
- `packages/bot-adapters/src/http.ts` (full)
- `packages/bot-adapters/src/control.ts` (full)
- `packages/bot-adapters/src/warnings.ts` (full)
- `packages/bot-adapters/src/factory.ts` (full)
- `packages/bot-adapters/src/mock-legacy.ts` (full)
- `packages/db/src/repositories.ts` (full — lines 1–1419)
- `apps/worker/src/index.ts` (full)
- `apps/worker/src/jobs.ts` (full)
- `packages/config/src/env.ts` (full)
- `packages/billing/src/provider.ts` (full)
- `packages/billing/src/stripe.ts` (full)
- `docs/SECURITY_MODEL.md` (partial — head)
- `docs/BOT_CONTROL_SAFETY_MODEL.md` (full)
- `docs/PRODUCTION_BLOCKERS.md` (full)
- `.env.example` (full)
- `.secretlintrc.json` (full)
- `docs/handoffs/0000-orchestrator-seed.md` (full)
- `docs/handoffs/20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md` (full)

## Files changed

None — read-only audit.

## Findings

### F-01 (INFO) — SECRET_HINTS list is correct and sufficient for PG3 Zod legacy-body exclusion

**Evidence:** `packages/audit/src/redact.ts` lines 12–36.

The authoritative `SECRET_HINTS` array is:

```
'secret', 'password', 'passwordhash', 'apikey', 'token', 'authorization', 'cookie',
'kek', 'dek', 'wrappeddek', 'privatekey', 'mnemonic', 'seedphrase',
'ciphertext', 'vaultrecord', 'sealed', 'credentials', 'bearer', 'refreshtoken',
'idtoken', 'accesstoken', 'onetimecode'
```

The legacy bot's `/api_management/` response returns plaintext exchange keys under field names
confirmed in discovery: `api_key`, `api_secret`. After normalization (lowercase,
strip `_`/`-`/` `) these become `apikey` and `apisecret`. `apikey` matches the `'apikey'` hint
at line 13. `apisecret` contains `secret` (line 12). Both are caught.

For PG3, the Zod schema on any legacy body should use the same `isSecretKey` predicate from
`redact.ts` line 40–43 rather than duplicating the list. The `isSecretValue` patterns at lines
54–61 (PHC hash, `Bearer ` prefix, 64-hex blob) provide value-level defence-in-depth for
values that might slip through under an innocuous key name.

**Recommendation:** When PG3 writes the Zod legacy-body exclusion, import `isSecretKey` and
`isSecretValue` from `@wtc/audit` directly rather than maintaining a second copy of the list.
The test asserting no secret-hint field can reach the WTC layer should assert against both
predicates. No change to the existing `SECRET_HINTS` array is required.

**Target part:** PG3 (B3 clearing).

---

### F-02 (INFO, CONFIRMED) — Legacy getHealth() correctly probes only reachability; the body is discarded

**Evidence:** `packages/bot-adapters/src/http.ts` lines 279–289.

`createHttpLegacyAdapter.getHealth()` calls `getJson(`${base}/api_management/`)` (line 284).
`getJson` (lines 41–55) uses `fetch(...) then res.json()` and returns the parsed JSON
to the caller. However, the `getHealth` implementation discards the return value: the call
is `await getJson(...)` with no assignment (line 284). The body is JSON-parsed by `getJson`
but the return value of `getJson` is not captured, not stored, not logged, and not surfaced
in the returned `BotHealth` object (line 289). The returned health object contains only the
boolean `alive` flag derived from whether the `getJson` call threw.

Confirmed: no body field, no rawJson, no logging of the response. `err.message` in the
catch at line 286 is silently swallowed (bare `alive = false`), so even error messages do
not escape. The comment at line 280–281 explicitly documents the intent.

**One gap identified:** `getJson` still calls `res.json()` on the legacy response body (line
53 of http.ts). The parsed object is returned from `getJson` but discarded by the caller.
This is functionally safe today (the body is thrown away) but is a latent footgun: if a
future implementer refactors `getHealth` to `const resp = await getJson(...)` they might
inadvertently capture the plaintext keys. For defence-in-depth, PG3 should consider passing
a flag to `getJson` (or using a separate `probeOnly()` helper) that calls `fetch` without
`res.json()` — ensuring the body is never parsed at all for the legacy reachability probe.

**Recommendation:** Extract a `probeReachability(url, timeoutMs)` helper for the legacy
adapter that issues the GET, checks `res.ok`, and immediately calls `res.body?.cancel()` or
simply ignores the body without parsing it. This makes the intent explicit and removes the
latent footgun. Flag this as a targeted PG3 hardening item.

**Target part:** PG3 (B3 hardening — defence-in-depth, not a blocker).

---

### F-03 (INFO, CONFIRMED) — 5 BOT_CONTROL_SAFETY_MODEL gates remain NOT STARTED; LegacyBlockedAdapter does not weaken any invariant

**Evidence:**
- `docs/BOT_CONTROL_SAFETY_MODEL.md` lines 96–151 (Gate 1–4 status fields).
- `packages/bot-adapters/src/control.ts` lines 1–18 (hard throw regardless of flags).
- `packages/bot-adapters/src/factory.ts` lines 26–32 (mock fallback when URL absent).

Gate statuses as documented:
- Gate 1 (Security Audit): `NOT STARTED` (line 108).
- Gate 2 (Bot Integration Audit): `IN PROGRESS — Phase 0 documentation` (line 122).
- Gate 3 (Exchange Safety Audit): `NOT STARTED` (line 136).
- Gate 4 (Integration Tests): `NOT STARTED` (line 149).

The fifth gate referenced in the summary table at line 268 ("LegacyBlockedAdapter") is
documented as "all five security gates … NOT STARTED". This refers to the five acceptance
criteria in B3 (PRODUCTION_BLOCKERS.md line 35–42): (1) service-account credential fix
upstream, (2) Zod exclusion schema, (3) all 5 gates reviewed + cleared.

The current code invariant is correct: `assertBotControlAllowed` in `control.ts` line 17
throws unconditionally unless both `flagEnabled` and `auditApproved` are true. Both are
hardcoded `false` at every call site in `disabledControl()` (http.ts lines 59–72). No
env var alone can enable control. The mock legacy adapter (mock-legacy.ts lines 77–88)
also calls `assertBotControlAllowed(action, false, false)` unconditionally. The
`LegacyBlockedAdapter` label in BOT_CONTROL_SAFETY_MODEL is a gate name, not a class;
no such class exists in code — this is deliberate (the adapter is blocked at the factory
and operator level, not by a runtime class). This does not weaken any invariant.

**Recommendation:** No action required this phase. PG3's `LegacyBlockedAdapter` compile-
time gate should be a compile-time regression test asserting that the legacy HTTP adapter's
`getMetrics`/`getTrades`/`getConfig` all throw `AdapterNotReadyError` (they already do).
This is a test addition, not a new class. Ensure the regression test also asserts that
`startBot`/`stopBot`/`applyConfig` throw `BotControlDisabledError`.

**Target part:** PG3 (gate confirmation).

---

### F-04 (HIGH, DECISION) — B2 checkout MUST remain NOT RUN; no BILLING_CHECKOUT_ENABLED flag exists yet; define the seam

**Evidence:**
- `packages/billing/src/stripe.ts` lines 47–54 (createCheckout throws BillingProviderNotConfiguredError).
- `packages/config/src/env.ts` lines 39–41 (STRIPE_SECRET_KEY optional, STRIPE_WEBHOOK_SECRET optional).
- `.env.example` lines 51–57.
- `docs/PRODUCTION_BLOCKERS.md` lines 25–33 (B2 evidence to clear).

Current state: `createCheckout` throws `BillingProviderNotConfiguredError` unconditionally
(stripe.ts line 52) even when `STRIPE_SECRET_KEY` is set, because the live Stripe API call
is not wired (line 52: "Stripe Checkout Session creation is not wired yet"). This is the
correct NOT-RUN posture.

The UNBLOCKED part for PG4 is a `checkoutAvailability()` gate — a pure diagnostic function
that signals whether checkout can be attempted, for UI and admin tooling, without actually
creating a session. The seam should be:

```ts
// packages/billing/src/stripe.ts (TARGET, not yet implemented)
export function checkoutAvailability(opts: { secretKey?: string; checkoutEnabled?: boolean }): {
  available: boolean;
  reason: string;
} {
  if (!opts.checkoutEnabled) return { available: false, reason: 'BILLING_CHECKOUT_ENABLED is not set' };
  if (!opts.secretKey) return { available: false, reason: 'STRIPE_SECRET_KEY is not configured' };
  return { available: false, reason: 'createCheckout is not yet wired — TARGET, see BILLING_PROVIDER_PLAN.md' };
}
```

The third branch (returning false even when both flags are present) enforces the invariant
that `checkoutAvailability() = true` is IMPOSSIBLE until `createCheckout` is actually wired.
Any future wiring must change this branch to return `{ available: true, reason: '' }` — that
change is the precise, auditable seam for the PG4 checkout gate.

`env.ts` should add `BILLING_CHECKOUT_ENABLED: boolFromEnv` (optional, default false) with
a `superRefine` rule: if true in production, `STRIPE_SECRET_KEY` must be present and not
a placeholder. This keeps the env validation as the authoritative gate.

**Critical invariant — checkout never directly grants:** entitlements remain the only access
source of truth. A checkout session creation does NOT write any entitlement row; only a
verified webhook event (`invoice.paid` etc.) triggers an entitlement transition via
`applyBillingEvent`. This is already correctly designed: `createCheckout` returns only a URL;
the webhook path via `parseWebhook` → `applyStripeEvent` → `grantProduct` is the only
grant path. Confirm this invariant is covered by the PG4 test plan before any wiring.

**Must be marked NOT RUN:** Stripe test-mode checkout integration test (B2 gate 3) requires
real `STRIPE_SECRET_KEY` test keys. No such keys are present in this environment. B2 stays
as NOT RUN until operator provides test keys and the checkout wiring is implemented.

**Target part:** PG4 (B2 scoping).

---

### F-05 (MEDIUM) — .env.example STRIPE_SECRET_KEY placeholder uses the `sk_test_` prefix — may trip secretlint

**Evidence:** `.env.example` line 56: `STRIPE_SECRET_KEY=sk_test_replace_with_your_stripe_test_key`.

The secretlint preset `@secretlint/secretlint-rule-preset-recommend` (`.secretlintrc.json`
line 4) detects Stripe API key patterns. The `sk_test_` prefix is the canonical Stripe
test-mode key prefix. Whether `sk_test_replace_with_your_stripe_test_key` triggers the
Stripe rule depends on the exact regex. The prior phase (Phase 2.7) confirmed
`npm run secret:scan` passes (aggregate handoff gate 5), but the STRIPE_SECRET_KEY
placeholder was already present at that time, so the scan is confirmed clean as-is.

However, this is an operational risk: a developer who runs `secret:scan` locally after
changing this line to a real test key (e.g. obtained from the Stripe dashboard) may
expect a failure and not get one if their local secretlint version differs. The safer
form is a commented-out placeholder:

```
# STRIPE_SECRET_KEY=          # sk_test_... — obtain from Stripe Dashboard; never commit
```

**Recommendation:** In a future cleanup pass, change the STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET lines to commented-out empty forms (matching the pattern used for
`AXIOMA_BRIDGE_API_TOKEN` at line 45, which is also empty). This reduces the surface area
for accidental leakage if a developer uncomments and fills a real key. Not a blocker for
PG4 since the scan is currently passing.

**Target part:** PG4 / operational hygiene.

---

### F-06 (INFO, CONFIRMED) — STRIPE_* env vars are optional with no secret leakage path; env.ts is correct

**Evidence:** `packages/config/src/env.ts` lines 39–41, 77.

`STRIPE_SECRET_KEY: z.string().optional()` and `STRIPE_WEBHOOK_SECRET: z.string().optional()`.
Neither appears in the `loadEnv` error message (line 85), which only lists invalid field keys
(not values). Neither is logged at boot. The `isWeakSecret` check (lines 60–65) only covers
`SESSION_SECRET` and `SECRET_VAULT_KEK` in production — intentional, since Stripe keys are
not weak-secret-checked (they are either absent or valid from Stripe's generation). This is
correct: requiring a non-weak `STRIPE_SECRET_KEY` in production before the checkout path
is wired would be premature.

The `createBillingProvider` function (`provider.ts` line 77) passes `process.env.STRIPE_SECRET_KEY`
directly to `createStripeProvider` — it does not go through `@wtc/config`. This is acceptable
for now but means the key bypasses the centralized env validation. When PG4 wires checkout,
`STRIPE_SECRET_KEY` should be added to the `envSchema` with a `superRefine` rule tying it to
`BILLING_CHECKOUT_ENABLED`, and `createBillingProvider` should accept it from the validated
config rather than reading `process.env` directly.

**Target part:** PG4 / env hardening (TARGET, not a current blocker).

---

### F-07 (INFO, CONFIRMED) — PG5 system actor pattern is correct; expiring_soon audit row decision

**Evidence:**
- `apps/worker/src/jobs.ts` lines 34–44 (`reconcileEntitlements` — `actorUserId: null, actorRole: 'system'`).
- `packages/db/src/repositories.ts` lines 1305–1309 (`TvRevokeActor` type).
- `packages/db/src/repositories.ts` line 333 (`{ id: null, role: 'system' }` in `sweepTvExpiry`).
- `packages/db/src/repositories.ts` line 252 (`TvStatus` type includes `expiring_soon`).

The `{ id: null, role: 'system' }` actor pattern is confirmed correct:
- It is consistent with the precedent in `reconcileEntitlements` (jobs.ts lines 33–43).
- `audit_logs.actor_user_id` is nullable with no FK constraint (confirmed in Phase 2.7
  aggregate handoff, decision 3). `null` is the honest value.
- No fabricated sentinel UUID is used anywhere.

**Decision on `expiring_soon` audit row:** `markExpiringSoon` is an internal status transition
(`granted` → `expiring_soon` on the `tradingview_access_requests` row). It does NOT revoke
or loosen access — TV indicator access continues until the grant actually expires. It is a
notification/UI state change only. Writing an audit row for this transition is recommended
(for completeness of the state machine audit trail) but not strictly required by the audit
schema (which mandates rows for grant/revoke, not for intermediate status transitions). The
recommendation is to write a `tv_access.expiring_soon` audit row with the system actor so
the transition is traceable, but classify it as LOW severity if omitted for the MVP. If
written, actor must be `{ actorUserId: null, actorRole: 'system' }`.

**Idempotency:** `markExpiringSoon` MUST be idempotent. A correct implementation:
1. Queries `tradingview_access_requests WHERE status = 'granted' AND expires_at <= now + 7 days`.
2. Updates matched rows to `status = 'expiring_soon'`.
3. Does NOT touch rows already in `expiring_soon`, `expired`, or `revoked` status
   (the WHERE clause on `status = 'granted'` ensures this).
4. Does NOT modify the `expires_at` column or any access-granting column.
5. Runs in a single UPDATE (or per-row within `sweepTvExpiry` — consistent with the existing
   pattern). No additional grant, no loosening.

**Target part:** PG5 follow-up (F-06 from Phase 2.7).

---

### F-08 (MEDIUM, GAP) — markExpiringSoon does not yet exist in repositories.ts; no worker call site

**Evidence:**
- `packages/db/src/repositories.ts` — full file searched; `markExpiringSoon` does not appear.
- `apps/worker/src/index.ts` — no call to `markExpiringSoon`.
- `apps/worker/src/jobs.ts` — no call to `markExpiringSoon`.
- The Phase 2.7 aggregate handoff (line 123) explicitly notes: "`expiring_soon` is still never
  written by any code path (the 7-day server status) — pre-existing; tracked as a PG5 follow-up."

The `TvStatus` union at `repositories.ts` line 252 includes `'expiring_soon'` as a valid
status, and the DOMAIN_MODEL describes the `granted → expiring_soon` transition. But no
`markExpiringSoon` repository function exists and no worker job calls it. The 14-day UI
banner added in Phase 2.7 (`/app/indicators/page.tsx`) is a UI-side computation independent
of this server status — it does not depend on the DB status being `expiring_soon`.

This means the `expiring_soon` DB status is currently a dead code path: rows transition
directly from `granted` to `revoked` (via `sweepTvExpiry → atomicRevokeTv`) without ever
passing through `expiring_soon`. Users with grants expiring within 7 days will not see the
`expiring_soon` status in any server-side query.

**Recommendation:** For PG5, implement:

```ts
// packages/db/src/repositories.ts (TARGET)
export async function markExpiringSoon(db: Db, now = Date.now(), windowMs = 7 * 24 * 60 * 60 * 1000): Promise<{ marked: number }> {
  const windowEnd = new Date(now + windowMs);
  const rows = await db.select({ id: s.tradingviewAccessRequests.id })
    .from(s.tradingviewAccessRequests)
    .where(and(
      eq(s.tradingviewAccessRequests.status, 'granted'),
      lte(s.tradingviewAccessRequests.expiresAt, windowEnd),
    ));
  if (rows.length === 0) return { marked: 0 };
  await db.update(s.tradingviewAccessRequests)
    .set({ status: 'expiring_soon' })
    .where(inArray(s.tradingviewAccessRequests.id, rows.map(r => r.id)));
  return { marked: rows.length };
}
```

Call it from `sweepTvExpiry` (or as a separate pre-pass in `dbTick`) BEFORE the expiry
sweep. No audit row is strictly required but one may be written per F-07.

**Target part:** PG5 implementation.

---

### F-09 (INFO, CONFIRMED) — JOURNAL_READ_TOKEN never reaches rawJson, audit payloads, or error messages

**Evidence:** `apps/worker/src/jobs.ts` lines 140–147 (rawJson shape).

The `rawJson` field written by `snapshotTortilaJournal` contains:
`adapterMode`, `sourceAdapter`, `healthStatus`, `readState`, `processAlive`, `warningCodes`.
No token field. The token is consumed at adapter construction time (factory.ts line 29,
http.ts constructor parameter) and never stored on the adapter object or propagated into
health/metrics return values. Error messages in http.ts (lines 154, 159, 163, etc.) carry
only URL + status code, never token values. The `readStateDetail` strings (lines 147, 154,
159, 163) do not interpolate token values.

The `isSecretValue` value-guard (redact.ts line 59–62) provides defence-in-depth: a
`Bearer <token>` value that reached an audit payload would match `HTTP_AUTH_VALUE` at line
60 and be redacted as `[REDACTED]`. Confirmed clean.

**Target part:** PG3 / PG5 (standing invariant).

## Decisions

1. **SECRET_HINTS is authoritative for PG3.** The existing 22-entry list in `redact.ts`
   lines 12–36 covers all known legacy bot field names (`apikey`, `apisecret` via `secret`
   substring). PG3's Zod exclusion schema must import `isSecretKey` + `isSecretValue` from
   `@wtc/audit` rather than maintaining a separate list.

2. **B2 (Stripe checkout) is NOT RUN and must remain so.** No Stripe test keys are present.
   `createCheckout` throws unconditionally. The UNBLOCKED PG4 work is `checkoutAvailability()`
   (pure diagnostic, no live call) plus `BILLING_CHECKOUT_ENABLED` env guard in `envSchema`.

3. **expiring_soon audit row is RECOMMENDED but not REQUIRED.** The transition is internal
   and non-access-changing. If omitted for MVP, classify as a follow-up item. Actor must be
   `{ actorUserId: null, actorRole: 'system' }` if written.

4. **markExpiringSoon must run as a pre-pass before sweepTvExpiry.** This preserves the
   semantic progression `granted → expiring_soon → revoked` in the DB. Rows already in
   `expiring_soon` must be included in the expiry sweep (the `sweepTvExpiry` WHERE clause
   must cover BOTH `granted` AND `expiring_soon` status, or `markExpiringSoon` must be
   run on the `expiring_soon` rows only). Current `sweepTvExpiry` (repositories.ts line 330)
   filters only on `status = 'granted'` — this needs updating if `markExpiringSoon` is
   implemented, or `sweepTvExpiry` will miss rows already in `expiring_soon`.

5. **Legacy getHealth() body isolation is functionally correct but fragile.** The result of
   `getJson()` is discarded today. A `probeReachability()` helper (F-02) should be
   implemented in PG3 to make the invariant compile-time-obvious.

## Risks

1. **sweepTvExpiry WHERE clause does not include `expiring_soon`** (repositories.ts line 330:
   `eq(status, 'granted')` only). If `markExpiringSoon` is added as a pre-pass, rows that
   were bumped to `expiring_soon` will NOT be swept by the current `sweepTvExpiry`. This is
   a correctness bug: grants would linger in `expiring_soon` forever after their expiry date
   without being revoked. Any `markExpiringSoon` implementation MUST be accompanied by a
   corresponding update to `sweepTvExpiry` to include `status IN ('granted', 'expiring_soon')`.

2. **`sk_test_replace_with_your_stripe_test_key` in .env.example.** While `secret:scan`
   passes today, the `sk_test_` prefix pattern could trigger secretlint in future versions.
   Low risk while the value is not a real key; becomes a tracking item.

3. **`STRIPE_SECRET_KEY` bypasses `@wtc/config` validation.** `createBillingProvider`
   (provider.ts line 77) reads `process.env.STRIPE_SECRET_KEY` directly. If PG4 adds a
   `BILLING_CHECKOUT_ENABLED` guard to `envSchema`, this bypass means the guard is only
   enforced on the web config load path, not on the billing provider construction path.
   The two paths must be reconciled when checkout is wired.

4. **Standing risk: LegacyBlockedAdapter has no compile-time test.** The blocking is
   currently enforced by runtime throws in the adapter methods. A compile-time test (a
   Vitest test that imports the adapter and asserts all data-reading methods throw) is the
   PG3 deliverable. Until that test exists, a refactor could accidentally make a method
   succeed.

## Verification/tests

This is a read-only audit. No tests were run this session.

Tests that MUST be added for PG3 (from F-02, F-03):
- Unit test: `createHttpLegacyAdapter.getHealth()` discards body (assert rawJson not included
  in returned BotHealth, assert no token/key in returned object).
- Unit test: `startBot`, `stopBot`, `applyConfig` on the legacy HTTP adapter throw
  `BotControlDisabledError`.
- Unit test: `getMetrics`, `getTrades`, `getConfig` on the legacy HTTP adapter throw
  `AdapterNotReadyError`.
- Unit test: Zod exclusion schema rejects any object with an `isSecretKey`-matching field.

Tests that MUST be added for PG5 (from F-07, F-08):
- Unit test: `markExpiringSoon` moves rows from `granted` to `expiring_soon`; idempotent on
  re-run; does not touch `revoked`/`expired` rows.
- Unit test: `sweepTvExpiry` after `markExpiringSoon` correctly revokes `expiring_soon` rows.
- Unit test: `markExpiringSoon` does NOT write any entitlement row, does NOT change access.

Tests that MUST NOT be run yet (gates NOT RUN):
- Stripe test-mode checkout integration test (B2 gate 3) — no test keys present.
- Real-PG harness (B1) — no `REAL_POSTGRES_DATABASE_URL`.

## Next actions

1. **PG3 (implementer):** Add `probeReachability()` helper in `http.ts` for the legacy adapter
   (F-02). Write compile-time regression tests for the legacy adapter's blocked methods (F-03).
   Implement Zod exclusion schema using `isSecretKey`/`isSecretValue` from `@wtc/audit`
   (F-01). Update `BOT_CONTROL_SAFETY_MODEL.md` summary table to distinguish the 5 gate items
   from the "5 security gates" count in B3.

2. **PG4 (implementer):** Add `BILLING_CHECKOUT_ENABLED: boolFromEnv` to `envSchema` in
   `env.ts` with a `superRefine` requiring `STRIPE_SECRET_KEY` when `true` in production (F-04,
   F-06). Implement `checkoutAvailability()` in `stripe.ts` (F-04). Move STRIPE_SECRET_KEY and
   STRIPE_WEBHOOK_SECRET in `.env.example` to commented-out empty forms (F-05). Wire
   `STRIPE_SECRET_KEY` through validated config rather than raw `process.env` (F-06). Mark
   B2 gate 3 as NOT RUN in the aggregate handoff.

3. **PG5 (implementer):** Implement `markExpiringSoon` in `repositories.ts` with idempotency
   (F-08). Update `sweepTvExpiry` WHERE clause to cover `status IN ('granted', 'expiring_soon')`
   (Decision 4 / Risk 1). Add call site in `dbTick` (worker). Write tests (F-07, F-08).
   Optionally add `tv_access.expiring_soon` audit row with system actor (Decision 3).

4. **Ongoing invariants (every phase):** Entitlements remain the only access source of truth —
   checkout never grants directly (F-04). No plaintext secrets in DB/logs/audit/fixtures/API
   responses. JOURNAL_READ_TOKEN handled correctly (F-09). BOT_CONTROL_SAFETY_MODEL gates
   remain NOT STARTED (F-03). sweepTvExpiry manual-first (task row queued but not auto-executed).
