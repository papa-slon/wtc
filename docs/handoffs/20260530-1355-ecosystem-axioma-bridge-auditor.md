# Handoff: ecosystem-axioma-bridge-auditor
**Epoch:** 20260530-1355  
**Agent:** ecosystem-axioma-bridge-auditor  
**Workstream:** H — Terminal / Axioma readiness (read-only audit)

---

## Scope

Read-only audit of the Axioma bridge implementation as it stands entering Phase 2.4.
Bounded to safe WTC-side readiness polish that requires no live external call:

- Release-metadata truth (DB-backed loader vs mock vs contract schema)
- Download placeholder honesty (proxy does not exist; button correctly stays disabled)
- JWKS visibility (public key presence only; private scalar exclusion)
- Account-link state (not_linked honest; OTC flow + raw-OTC-to-hash migration stay TARGET)
- Hard-boundary callout presence (WTC never gates local order execution)
- Contract status header currency
- INTEGRATION_MAP delta accuracy
- `axiomaAccountLinks` schema vs contract fields gap

Package rename risk (`com.greenfield.terminal` → Axioma) stays in OPEN_QUESTIONS; no scope change here.

---

## Files inspected

| File | Lines |
|------|-------|
| `docs/handoffs/0000-orchestrator-seed.md` | all |
| `docs/CONTRACTS/axioma-bridge.md` | all (v1.1.0) |
| `packages/axioma-bridge/src/bridge.ts` | 1–100 |
| `packages/axioma-bridge/src/handoff.ts` | 1–99 |
| `packages/axioma-bridge/src/es256.ts` | 1–90 |
| `packages/axioma-bridge/src/jwks.ts` | 1–14 |
| `packages/axioma-bridge/src/index.ts` | 1–22 |
| `packages/axioma-bridge/src/__smoke__.ts` | 1–39 |
| `packages/axioma-bridge/src/handoff.test.ts` | 1–50 |
| `packages/axioma-bridge/src/es256.test.ts` | 1–83 |
| `apps/web/src/features/terminal/loader.ts` | 1–114 |
| `apps/web/src/app/(app)/app/terminal/page.tsx` | 1–224 |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | 1–26 |
| `packages/db/src/repositories.ts` | 817–962 (Axioma/terminal section) |
| `packages/db/src/schema.ts` | 138–146 (axiomaAccountLinks), 515–565 (terminal tables) |
| `docs/INTEGRATION_MAP.md` | §3 Axioma section + §6.2 |
| `apps/web/src/lib/server-config.ts` | (grep: axiomaBridgeIsDev) |

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — LOW — Hard-boundary callout is present and correct

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:45–60`

The page renders a non-dismissible `role="status"` info banner at the very top of the component tree with the text "WTC never gates your local Axioma order execution" and the explanation that only server-backed features require a WTC license. This satisfies the contract §2 hard-boundary requirement and the orchestrator seed hard rule 5. The callout is above the entitlement gate, above the dev-bridge banner, and above all action buttons — it is always visible regardless of entitlement state.

**Recommendation:** No change needed. Confirm this banner survives any future page layout refactor by noting its position requirement in the contract (§17.2 Section 1 already does this).

**Target Workstream:** H

---

### Finding 2 — LOW — Download button is correctly disabled and honestly labelled in dev mode

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:163–172`

When `isDev` is true the download button renders as a ghost, `disabled`, with title text explicitly stating "Dev placeholder — no real download endpoint configured. /api/axioma/download proxy does not exist." When entitlement is absent the button renders as ghost-disabled "Download (needs license)." The proxy endpoint `/api/axioma/download` is confirmed absent (no route file exists under `apps/web/src/app/api/` — consistent with the Phase 2.3 gate result of 44 routes, none being that path). The button is never primary-enabled in dev mode regardless of entitlement, satisfying the contract §17.2 table row for `active (dev/mock bridge)`.

**Recommendation:** No change needed. The honest placeholder is functioning correctly. When the real proxy is built it must be activated only after the activation checklist in contract §17.4.2 is complete.

**Target Workstream:** H

---

### Finding 3 — LOW — "Open Axioma Journal" button is correctly disabled and honestly labelled in dev mode

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:188–199`

The Journal button is disabled when `!access.allowed || isDev`. The title attribute for dev mode reads "Dev placeholder — production POSTs a single-use handoff token to Axioma. /api/axioma/download proxy does not exist." (Note: the title references the download proxy path rather than a journal handoff path — minor copy inaccuracy but functionally harmless since the button is disabled either way.) The explanatory footnote below the button correctly describes the ES256 POST-based handoff and the server-features-only gate.

**Recommendation:** LOW — the title attribute for the Journal button references `/api/axioma/download proxy` instead of a journal-specific path (copy paste from the download title). Correct when next editing the page. No functional impact.

**Target Workstream:** H

---

### Finding 4 — MEDIUM — `axiomaAccountLinks` schema is missing required contract fields; no repository functions exist

**Evidence:** `packages/db/src/schema.ts:138–146` vs `docs/CONTRACTS/axioma-bridge.md §7.1`

The schema table `axioma_account_links` contains: `id`, `userId`, `state`, `axiomaUserId`, `oneTimeCode`, `codeExpiresAt`, `createdAt`.

The contract §7.1 specifies these WTC-side fields: `wtc_user_id`, `axioma_user_id`, `axioma_username` (display only), `linked_at`, `last_verified_at`, `link_status` (`pending | active | unlinked`), `link_nonce_hash` (hash of OTC — OTC itself discarded after use).

Gaps:
1. `axioma_username` column is absent (display-only field for UI).
2. `linked_at` column is absent (schema has only `created_at`; distinct semantics when a re-link occurs).
3. `last_verified_at` column is absent (needed for staleness checking).
4. `link_nonce_hash` column is absent (the contract requires storing only the HASH of the OTC for audit, never the raw code; the current schema stores `one_time_code` in plaintext).
5. The column name used is `state` (values: `linked | pending | not_linked`) while the contract uses `link_status` (values: `pending | active | unlinked`). The "active" vs "linked" divergence must be reconciled before the OTC flow is built.
6. No repository functions for `axioma_account_links` exist in `packages/db/src/repositories.ts`. The table is schema-only with no read/write surface.

The raw `one_time_code` stored in plaintext (finding 4.4 above) is the most important concern: the contract §7.1 explicitly says "link_nonce_hash (hash of OTC for audit; OTC itself discarded after use)." If the OTC is ever stored raw it becomes a credential that can be replayed if the DB is read. Migration 0003 (which Phase 2.4 may introduce) should add the missing columns and replace `one_time_code` with `link_nonce_hash`.

**Recommendation:** Track in OPEN_QUESTIONS as a prerequisite blocker for the OTC account-link flow. The db-architect should include in migration 0003: add `axioma_username text`, `linked_at timestamptz`, `last_verified_at timestamptz`, `link_nonce_hash text` (bcrypt/sha256 of OTC); drop or rename `one_time_code` (do not store raw). Reconcile `state` values to match contract. Add repository functions: `createAxiomaLinkOtc`, `consumeAxiomaLinkOtc`, `getAxiomaLinkForUser`, `setAxiomaLinkVerified`.

**Target Workstream:** H

---

### Finding 5 — LOW — `TerminalReleaseView.sizeBytes` is permanently null; contract §17.3.1 lists it

**Evidence:** `apps/web/src/features/terminal/loader.ts:31,61,76`

`sizeBytes` is typed as `null` (hardcoded, not a DB column). The contract's target extended type `AxiomaTerminalRelease` includes `sizeBytes: number`. The DB schema `terminal_release_cache` does not have a `size_bytes` column. This is a known gap noted inline in the loader comment "bytes, derived from DB if present — currently always null (field not in schema)". It does not cause a runtime error because the UI conditionally renders size only when non-null. However the contract §17.3.1 target type claims `sizeBytes: number` — it should be typed `number | null` until the column is added.

**Recommendation:** When migration 0003 adds terminal table refinements, add `size_bytes bigint` to `terminal_release_cache`. Update `TerminalReleaseView.sizeBytes: null` to `number | null`. No action needed before that migration.

**Target Workstream:** H

---

### Finding 6 — LOW — JWKS route path is correct and matches the spec; INTEGRATION_MAP §6.2 has a stale path reference

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:1` (file exists at this path); `docs/INTEGRATION_MAP.md:312`

The actual route file is correctly at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, which Next.js App Router resolves to `GET /.well-known/axioma-jwks.json`. This matches the contract §17.4.1 and `AXIOMA_HANDOFF_TOKEN_SPEC.md`.

However `docs/INTEGRATION_MAP.md §6.2` still references `/api/axioma/.well-known/jwks.json` as the planned path. This was the stale path from the earlier platform-architect handoff that the Phase 2.1 implementer correctly resolved (placing the file at the right path), but the INTEGRATION_MAP was not updated to reflect it.

The route implementation itself is correct:
- Returns `{ keys: [] }` when `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_HANDOFF_KEY_ID` is absent, instead of erroring.
- On misconfigured PEM it catches and returns `{ keys: [] }` with a shorter cache TTL (60 s vs 3600 s).
- `buildJwks` delegates to `publicJwk()` which hard-asserts `if ('d' in jwk) throw new Error(...)` — the private scalar is structurally excluded from the JWKS output.
- `export const dynamic = 'force-dynamic'` prevents stale static serving.

**Recommendation:** MEDIUM priority doc fix — update `docs/INTEGRATION_MAP.md §6.2` row "Handoff signer" to read the JWKS endpoint as `/.well-known/axioma-jwks.json` (not `/api/axioma/.well-known/jwks.json`). Assign to platform-architect or docs owner. No code change needed.

**Target Workstream:** H

---

### Finding 7 — LOW — JWKS `force-dynamic` conflicts with `Cache-Control: public, max-age=3600`

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:10,15`

The route sets `export const dynamic = 'force-dynamic'` (which prevents Next.js from statically caching the route at build time) and simultaneously sets `Cache-Control: public, max-age=3600` on the HTTP response header. These are not contradictory — `force-dynamic` controls Next.js ISR/static behaviour at build time, while the `Cache-Control` header governs CDN/browser caching at runtime. The combination is correct and intentional: the route is always server-rendered (keys can change with key rotation), but downstream CDN caches can cache for up to 1 hour.

No functional defect. Documenting as a low-priority clarification to prevent future confusion during review.

**Recommendation:** Add a one-line comment to the route file explaining the intentional separation of Next.js `dynamic` vs HTTP `Cache-Control`. No blocking issue.

**Target Workstream:** H

---

### Finding 8 — LOW — Contract status header is slightly stale (ES256/JWKS is now implemented, not "pending")

**Evidence:** `docs/CONTRACTS/axioma-bridge.md:3`

The status line reads: "Phase 2 — Part 6 product-area design added; mock bridge + HS256 dev-stub handoff implemented; ES256/JWKS production signer and real read-only endpoints pending."

As of Phase 2.1 the ES256 signer (`packages/axioma-bridge/src/es256.ts`) and the JWKS route (`apps/web/src/app/.well-known/axioma-jwks.json/route.ts`) are implemented. The contract's `§11 Mock-vs-real status` table for "Open Axioma Journal" already records this correctly: "an HS256 dev-stub signer is implemented in `handoff.ts`. Only the ES256/JWKS production signer is not yet implemented." But this contradicts the status header, because `es256.ts` IS implemented (the ES256 signer exists and is tested) — what remains is wiring it end-to-end (activating it in the bridge, provisioning the key, confirming with Axioma team). The "production signer" phrasing in the status header is ambiguous.

**Recommendation:** Update the contract status header to: "Phase 2.3 — ES256 signer + JWKS route implemented; production activation (key provisioning + Axioma team confirmation + download proxy + OTC account-link) remains TARGET." Update version to 1.2.0.

**Target Workstream:** H

---

### Finding 9 — LOW — `LicenseStatus` gap between bridge type and page: bridge now includes 'grace' and 'revoked'

**Evidence:** `packages/axioma-bridge/src/bridge.ts:24`; `apps/web/src/app/(app)/app/terminal/page.tsx:14–20`

The contract §17.3.1 noted a gap: "`LicenseStatus` in the bridge (`'active' | 'inactive' | 'expired' | 'none'`) does not yet include `'grace'` or `'revoked'`." That gap is now resolved: `bridge.ts:24` defines `LicenseStatus = 'active' | 'grace' | 'inactive' | 'expired' | 'revoked' | 'unknown' | 'none'`.

The terminal page `licenseTone()` function at line 14–19 handles all seven values correctly (active→ok, grace→warn, none→neutral, remaining→bad). The contract §17.3.1 gap note is now outdated and should be removed from the contract doc.

**Recommendation:** Remove the gap note from contract §17.3.1 ("Gap note: `LicenseStatus` in the bridge … does not yet include `'grace'` or `'revoked'`"). The type is correct. Update §11 mock-vs-real table to reflect the extended LicenseStatus.

**Target Workstream:** H

---

### Finding 10 — MEDIUM — Account-link state is hardcoded 'not_linked' on the page; no DB read for axioma_account_links

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:113`

```tsx
<StatusPill tone="warn">not_linked</StatusPill>
```

The account-link status is hardcoded to the string `not_linked` with `tone="warn"`. There is no call to `getAxiomaLinkForUser` (which does not exist in repositories.ts — see Finding 4) and no import of the `axiomaAccountLinks` table. This is honest (the OTC flow is not yet built), and the footnote at line 115 makes the placeholder explicit: "The Axioma account-link flow is not yet implemented." The button is disabled with `(dev placeholder)` in the label.

This finding confirms that the not_linked display is an intentionally honest placeholder, not a silent failure. No user can be left thinking they are linked when they are not.

**Recommendation:** No immediate action. When the OTC account-link repositories (Finding 4) are built and migration 0003 lands, replace the hardcoded pill with a server-side read of `axiomaAccountLinks` for the current user. The page already imports `getServerDb` indirectly via the loader — wiring the account-link read is additive.

**Target Workstream:** H

---

### Finding 11 — LOW — Mock bridge `beginAccountLink` returns a UUID not a cryptographically random OTC per the spec

**Evidence:** `packages/axioma-bridge/src/bridge.ts:93–97`

```typescript
async beginAccountLink(_userId) {
  const code = globalThis.crypto.randomUUID();
  return { code, expiresAt: now() + HANDOFF_TTL_MS * 2 };
}
```

`crypto.randomUUID()` produces a version-4 UUID (128 bits), which is cryptographically random and suitable for a dev stub. However the contract §7.1 specifies "Cryptographically random 32-byte token, base64url-encoded" for production OTCs. A UUID is 16 bytes (128 bits) encoded as a dash-separated hex string, not a base64url 32-byte token. The expiresAt uses `HANDOFF_TTL_MS * 2` (10 minutes) which matches the contract TTL of 10 minutes exactly (HANDOFF_TTL_MS = 5 min, × 2 = 10 min — correct).

This is a dev-stub divergence, not a production bug (the OTC flow is disabled in the UI). The real implementation must use `randomBytes(32).toString('base64url')` and the result must be stored only as its hash.

**Recommendation:** Add a comment to `beginAccountLink` noting the production OTC must be `randomBytes(32).toString('base64url')` and stored only as its bcrypt/sha256 hash. Flag in OPEN_QUESTIONS as a prerequisite for the real account-link bridge endpoint.

**Target Workstream:** H

---

### Finding 12 — LOW — JTI replay protection has no durable store; documented gap is honest

**Evidence:** `packages/axioma-bridge/src/es256.ts:9–12`

The file header states: "HONEST GAP: jti/replay persistence is a documented TARGET — there is no jti store table yet, so a caller may pass `isReplayed` backed by whatever store it has, but durable cross-process replay protection is not provided here."

The `verifyEs256HandoffToken` accepts an optional `isReplayed` callback. Without a store the caller passes nothing and replay is not caught server-side by WTC — Axioma's validation is the backstop. The handoff token TTL is 5 minutes, limiting the replay window. This is acceptable for dev but is a prerequisite for production activation.

**Recommendation:** Add `axioma_token_revocations` table (or extend `axioma_account_links`) per INTEGRATION_MAP §6.2 to store consumed `jti` values with their `exp` timestamp. Include in migration 0003. Add a db-backed `isReplayed` implementation to the bridge before the activation checklist is cleared.

**Target Workstream:** H

---

## Decisions

1. The hard-boundary callout ("WTC never gates local Axioma order execution") is correctly placed and non-dismissible — no change needed.
2. The JWKS route at `/.well-known/axioma-jwks.json` is correctly implemented; `publicJwk()` hard-asserts no private scalar. No security action needed.
3. The download proxy and OTC account-link flows are correctly kept disabled (no proxy endpoint, no OTC repositories). These stay TARGET.
4. Migration 0003 (Phase 2.4 db-architect scope) should include: `axiomaAccountLinks` missing columns + rename `one_time_code` → `link_nonce_hash`, `sizeBytes` on release cache, `axioma_token_revocations` for jti replay. These are all additive.
5. Contract doc version bump to 1.2.0 with updated status header is a low-priority doc edit; not blocking any gate.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `axiomaAccountLinks.one_time_code` stored in plaintext — would become a replayable credential if OTC flow built on current schema | HIGH (latent — not exploitable until OTC flow is wired) | Must replace with `link_nonce_hash` in migration 0003 before any OTC endpoint is built |
| JTI replay store absent — 5-minute window where a captured handoff token is replayable at the WTC verifier (Axioma is the backstop) | MEDIUM | Add `axioma_token_revocations` table in migration 0003 |
| INTEGRATION_MAP §6.2 JWKS path stale reference | LOW | Doc-only fix; no runtime impact since correct route file exists |
| `beginAccountLink` in mock bridge returns UUID not 32-byte base64url OTC | LOW (dev-only; flow disabled in UI) | Document and fix when real OTC endpoint is built |
| Missing `axioma_account_links` repositories means any OTC feature attempt would fail at compile time with no obvious error | MEDIUM (future sprint risk) | Must be caught in the Phase 2.5 planning sprint; db-architect adds repos alongside migration 0003 |

---

## Verification/tests

### What is tested and green

- `packages/axioma-bridge/src/handoff.test.ts` (5 tests): HS256 sign/verify, expiry, audience, replay, production guard (throws in prod), claim set excludes forbidden keys.
- `packages/axioma-bridge/src/es256.test.ts` (6 tests): round-trip sign/verify, ES256 header + kid assertion, JWKS private scalar absence, wrong-key rejection, expired/aud/replay rejection, HS256-downgrade rejection, empty-key/empty-kid constructor guard.
- `packages/axioma-bridge/src/__smoke__.ts` (7 inline assertions): sign/verify, expiry, aud, tamper, wrong secret, replay, no-keys-in-token.

### What is NOT tested (gaps for Phase 2.5)

- No test for `axioma_account_links` OTC lifecycle (table has no repos yet).
- No integration test for `loadTerminalRelease` against a PGlite DB instance.
- No e2e test for the terminal page's account-link card state (`not_linked` pill, button disabled).
- No test for the JWKS route handler itself (the route is exercised by the build type validator but has no Vitest/Playwright test).
- No test for `createMockAxiomaBridge.beginAccountLink` shape vs contract spec.

### Gates (read-only; NOT RUN this wave — no DATABASE_URL)

- Real-PG: NOT RUN (no DATABASE_URL / Docker).
- Build / type-check: confirmed by prior Phase 2.3 gate result (44 routes, no type errors in axioma-bridge or terminal page).
- Vitest: 171 passing per Phase 2.3 gate. The `es256.test.ts` and `handoff.test.ts` tests are part of that count.

---

## Next actions

1. **db-architect (Phase 2.4 / migration 0003):** Add to `axioma_account_links`: `axioma_username text`, `linked_at timestamptz`, `last_verified_at timestamptz`, `link_nonce_hash text`. Drop/rename `one_time_code` (never store raw OTC). Reconcile `state` values to match contract `link_status` enum (`pending | active | unlinked`). Add `axioma_token_revocations (id, jti text UNIQUE, exp timestamptz, created_at timestamptz)` for handoff token replay prevention. Add `size_bytes bigint` to `terminal_release_cache`. All additive.

2. **db-architect / repositories (Phase 2.5 prerequisite):** Implement `getAxiomaLinkForUser`, `createAxiomaLinkOtc`, `consumeAxiomaLinkOtc`, `setAxiomaLinkVerified`, `isJtiReplayed` / `recordJti` in `packages/db/src/repositories.ts` backed by the new 0003 columns.

3. **docs owner (low priority):** Update `docs/CONTRACTS/axioma-bridge.md` status header to reflect ES256/JWKS route implemented; bump version to 1.2.0; remove the outdated LicenseStatus gap note from §17.3.1.

4. **platform-architect (low priority):** Update `docs/INTEGRATION_MAP.md §6.2` JWKS endpoint path from `/api/axioma/.well-known/jwks.json` to `/.well-known/axioma-jwks.json`.

5. **terminal page maintainer (low priority):** Fix the title attribute on the "Open Axioma Journal" button — it incorrectly references the download proxy path instead of the journal handoff path.

6. **Phase 2.5 activation prerequisite (Workstream H gate):** Before `isDev` can be false in production, the full checklist from contract §17.4.2 must be satisfied. The most critical outstanding items as of Phase 2.4: (a) `link_nonce_hash` migration landed and OTC flow built, (b) JTI revocation store in place with `isReplayed` wired into the ES256 verifier, (c) download proxy endpoint `/api/axioma/download/terminal` built, (d) `AXIOMA_BRIDGE_API_TOKEN` provisioned, (e) Axioma team confirms `https://axi-o.ma/wtc-handoff` validation endpoint is live and tested against the JWKS.
