# Handoff — ecosystem-axioma-bridge-auditor

**Epoch:** 20260530-1145
**Phase:** 2.3 — Read-only audit wave
**Agent:** ecosystem-axioma-bridge-auditor
**Part:** 3 — Terminal / Axioma wiring

---

## Scope

Read-only audit of the Axioma bridge package, its integration into the `/app/terminal` page, the
DB-layer repos for terminal release/download/license, the JWKS route, and all related contract and
product-area docs. Goal: specify the exact DB-backed wiring for Part 3 and flag gaps before
implementation.

No code was modified. No live server was contacted.

---

## Files inspected

| File | Key content |
|------|-------------|
| `packages/axioma-bridge/src/bridge.ts` | `LicenseStatus`, `AxiomaProductState`, `createMockAxiomaBridge` |
| `packages/axioma-bridge/src/handoff.ts` | HS256 dev-stub signer, `HandoffClaims`, production guard |
| `packages/axioma-bridge/src/es256.ts` | `createEs256Signer`, `publicJwk` private-scalar hard-assert, `verifyEs256HandoffToken` |
| `packages/axioma-bridge/src/jwks.ts` | `buildJwks` — delegates to `publicJwk()` per signer |
| `packages/axioma-bridge/src/index.ts` | Public exports |
| `packages/axioma-bridge/src/__smoke__.ts` | 7 HS256 smoke checks |
| `packages/axioma-bridge/src/es256.test.ts` | 6 ES256/JWKS Vitest cases incl. `'d' in jwk === false` |
| `packages/axioma-bridge/src/handoff.test.ts` | 4 HS256 Vitest cases incl. prod-guard throws |
| `packages/db/src/repositories.ts` (lines 788-825) | `upsertTerminalRelease`, `getCurrentTerminalRelease`, `recordDownloadEvent`, `recordLicenseEvent` |
| `packages/db/src/schema.ts` (lines 138-146, 516-565) | `axiomaAccountLinks`, `terminalReleaseCache`, `terminalDownloadEvents`, `terminalLicenseEvents` |
| `apps/web/src/app/(app)/app/terminal/page.tsx` | Server component — current mock-bridge wiring |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | JWKS GET route |
| `apps/web/src/lib/server-config.ts` | `axiomaBridgeIsDev()` — gates on `AXIOMA_BRIDGE_API_TOKEN` |
| `apps/web/src/lib/access.ts` | `accessFor`, `reasonLabel`, `reasonTone` |
| `apps/web/src/lib/backend.ts` | `getServerDb()`, `entitlementsOf`, fail-closed guard |
| `docs/CONTRACTS/axioma-bridge.md` | Full contract v1.1.0 incl. §17 view shapes |
| `docs/TERMINAL_PRODUCT_AREA.md` | Product area design doc (Phase 2) |
| `docs/INTEGRATION_MAP.md` (§3 Axioma row) | Integration map — Axioma section |

---

## Files changed

None — read-only audit

---

## Findings

### F-1 (HIGH) — Terminal page does not call `getCurrentTerminalRelease`; release data is mock-only even when a DB is connected

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:12-18, 28`

`getBridge()` always returns `createMockAxiomaBridge(...)`. The page never calls `getServerDb()` or
`getCurrentTerminalRelease`. So when `DATABASE_URL` is set and the DB contains a real release row
(populated by the worker), the terminal page still shows the static `SAMPLE_RELEASE` from the mock bridge.

**Recommendation:** When `getServerDb()` returns a non-null `Db`, read the current release via
`getCurrentTerminalRelease(db, 'stable', 'windows-x64')` (or whichever channel/platform is active)
and map it onto `TerminalRelease` fields for display. The mock bridge path remains the fallback when
`db === null`. This is a safe read-only DB call with no external network call; it belongs in Part 3.
Add a `getServerDb()` call at the top of `TerminalPage()` before the bridge call, and pass the DB
result into a `buildReleaseFromDb()` helper that prefers the DB row over the mock data.

**Target part:** 3

---

### F-2 (HIGH) — `axiomaAccountLinks` schema is missing contract-required columns

**Evidence:** `packages/db/src/schema.ts:138-146`

The schema has: `id`, `userId`, `state`, `axiomaUserId`, `oneTimeCode`, `codeExpiresAt`, `createdAt`.

The contract (`docs/CONTRACTS/axioma-bridge.md:388-398`) requires additionally:
- `axioma_username` (display only)
- `linked_at` (timestamp of when link was established)
- `last_verified_at` (timestamp of last entitlement verification)
- `link_nonce_hash` (hash of OTC for audit; raw OTC discarded after use)

The `link_status` field exists under the name `state` (values match: `pending | active | unlinked`) — that is fine.

Critically, `oneTimeCode` stores the raw OTC rather than a hash. The contract states: "link_nonce_hash
(hash of OTC for audit; OTC itself discarded after use)". Storing the raw OTC in a DB column is a
security gap — if the `axioma_account_links` table is exfiltrated, active OTCs can be replayed.

**Recommendation:** Before the OTC account-link endpoint is built in Part 3:
(a) Store only a hash of the OTC (SHA-256 base64url) in `one_time_code` / rename column to
`one_time_code_hash`. The raw OTC is shown to the user once and then discarded — never persisted.
(b) Add the missing nullable columns: `axioma_username text`, `linked_at timestamptz`,
`last_verified_at timestamptz`, `link_nonce_hash text`.
(c) Determine if this requires a migration-0003 column-add (additive ALTER TABLE, no data loss).
Given the constraint against proposing migration-0003 unless strictly required for correctness, the
raw-OTC storage (security correctness) qualifies as a required fix. The display/audit columns
(`axioma_username`, `linked_at`, `last_verified_at`) can be deferred to the same migration.

**Target part:** 3

---

### F-3 (HIGH) — `LicenseStatus` type in bridge.ts missing `'grace'` and `'revoked'`; has `'inactive'` which the server never emits

**Evidence:** `packages/axioma-bridge/src/bridge.ts:8`

```typescript
export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'none';
```

The Axioma journal_server entitlement endpoint (`docs/CONTRACTS/axioma-bridge.md:177-188`) returns:
`active | grace | expired | revoked | none`

Two problems:
1. `'grace'` and `'revoked'` are absent from `LicenseStatus`. When the real bridge is wired, these
   values will arrive and be untyped / fall through silently.
2. `'inactive'` is present in the WTC type but is not a server value. It will never be returned,
   but its presence makes the exhaustiveness analysis misleading.

**Recommendation for Part 3 (must ship before real bridge wiring):** Replace `LicenseStatus` with:

```typescript
export type LicenseStatus = 'active' | 'grace' | 'expired' | 'revoked' | 'none' | 'unknown';
// 'unknown' = bridge degraded / not yet fetched
```

Simultaneously update the `licenseTone` computation in `apps/web/src/app/(app)/app/terminal/page.tsx:32`:

```typescript
// Current (incomplete):
const licenseTone: Tone = state?.license.status === 'active' ? 'ok'
  : state?.license.status === 'expired' ? 'bad'
  : 'neutral';

// Required (covers grace + revoked):
const licenseTone: Tone =
  state?.license.status === 'active'                  ? 'ok'
  : state?.license.status === 'grace'                 ? 'warn'
  : state?.license.status === 'expired'
    || state?.license.status === 'revoked'            ? 'bad'
  : 'neutral';
```

The safe display mapping for the current dev/mock phase (before real bridge):
- `'grace'` → tone `'warn'`, display "Grace period"
- `'revoked'` → tone `'bad'`, display "Revoked"
- `'unknown'` → tone `'neutral'`, display bridge-degraded banner instead of license label

**Target part:** 3

---

### F-4 (MEDIUM) — Terminal page shows mock download URL in `download.url` even when `access.allowed` is true; no dev-placeholder guard prevents it from being a real link target

**Evidence:** `packages/axioma-bridge/src/bridge.ts:66`

```typescript
url: hasEntitlement ? `${base}/releases/axioma-setup-${SAMPLE_RELEASE.version}.exe` : undefined,
```

This produces a plain URL (not a proxy token URL, not a signed URL). If a user somehow had the
download button enabled (e.g., `isDev` incorrectly false) this URL would point at a non-existent
or unauthorized endpoint.

The download button IS correctly disabled when `isDev` is true (`page.tsx:76: disabled={isDev}`).
But the guard is the `isDev` flag, not the URL shape. If `AXIOMA_BRIDGE_API_TOKEN` is set but
no real proxy endpoint exists, the button becomes enabled with a non-functional mock URL.

**Recommendation:** Add a second guard: `download.url` must follow the pattern
`/api/axioma/download/terminal?token=...` (a WTC proxy URL) to be treated as "real". Expose a
`download.isProxyUrl: boolean` field or validate the URL prefix before enabling the button. For
Part 3, the download button should remain disabled until `/api/axioma/download/terminal` is
implemented, regardless of bridge mode. Document this explicitly so the implementer does not
accidentally enable it by just setting `AXIOMA_BRIDGE_API_TOKEN`.

**Target part:** 3

---

### F-5 (MEDIUM) — JWKS route sets `force-dynamic` but also `max-age=3600`; these are contradictory for the happy path

**Evidence:** `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:10,15`

```typescript
export const dynamic = 'force-dynamic';
// ...
const headers = { 'cache-control': 'public, max-age=3600' };
```

`force-dynamic` means Next.js will not statically cache the route at the edge/CDN layer. The
`cache-control: public, max-age=3600` header instructs downstream HTTP caches and browsers to
cache the response for 1 hour. This is directionally correct (JWKS should be cacheable by
Axioma/intermediaries), but the combination is inconsistent: `force-dynamic` opts out of Next.js
static optimization while still relying on HTTP-layer caching.

This is low-risk because: (a) the JWKS route reads only env vars, not the DB, so there is no
stale-data risk; (b) the error fallback returns `max-age=60` (line 24), which is correct.
The inconsistency could confuse operators who see the route re-execute on every request despite
the `public` cache hint.

**Recommendation:** Change to `export const dynamic = 'force-static'` (or remove the directive and
let Next.js treat it as a static edge route). The route has no request-dependent state — it reads
only `AXIOMA_HANDOFF_SIGNING_KEY` / `AXIOMA_HANDOFF_KEY_ID` from env at build time. If key
rotation requires the response to refresh without a redeploy, `force-dynamic` + `max-age=3600` is
acceptable — but then the comment should explain the intent explicitly.

Alternatively: keep `force-dynamic` and reduce `max-age` to 300 (5 min) to match the handoff token
TTL. Axioma re-fetches JWKS at most every 5 minutes anyway for key rotation.

**Target part:** 3

---

### F-6 (MEDIUM) — `INTEGRATION_MAP.md` Axioma row states release cache TTL of "6 hours" but contract sets 10 minutes

**Evidence:** `docs/INTEGRATION_MAP.md:197`

> WTC bridge caches release metadata in `terminal_release_cache` (TTL 6 hours) to reduce calls.

`docs/CONTRACTS/axioma-bridge.md:218` states:

> WTC caches this response in `terminal_release_cache` table (TTL: 10 min). Stale cache is shown with a "last updated" timestamp.

The worker job schedule in `docs/CONTRACTS/axioma-bridge.md:597` also uses "Every 10 min".

**Recommendation:** Update `docs/INTEGRATION_MAP.md:197` from "TTL 6 hours" to "TTL 10 min (per
axioma-bridge contract §5.4 and worker job §15)". This is a documentation-only fix but is an
owned maintenance task for this auditor agent on INTEGRATION_MAP Axioma sections.

**Target part:** 0 (doc truth cleanup)

---

### F-7 (MEDIUM) — `axiomaBridgeIsDev()` gates on `AXIOMA_BRIDGE_API_TOKEN` alone, but the contract requires several additional env vars before production mode is safe

**Evidence:** `apps/web/src/lib/server-config.ts:18-21`

```typescript
export function axiomaBridgeIsDev(): boolean {
  return !process.env.AXIOMA_BRIDGE_API_TOKEN;
}
```

The real-bridge activation checklist in `docs/CONTRACTS/axioma-bridge.md:1036-1047` requires:
- `ENTITLEMENT_ENABLED=True` on journal_server
- `release-manifest.json` deployed on journal_server
- All four Axioma DB tables migrated
- OTC account-link bridge endpoint implemented
- Download proxy endpoint implemented
- ES256/JWKS signer implemented (`handoffToken.ts`)
- JWKS endpoint live and Axioma team confirms validation
- Circuit breaker and health-check worker active

Setting `AXIOMA_BRIDGE_API_TOKEN` alone currently enables the "real bridge" UI mode (buttons
become enabled, no dev-placeholder labels) even though none of the other pre-conditions are met.
This is a single point of failure for the safety labelling.

**Recommendation:** Extend `axiomaBridgeIsDev()` to also check `AXIOMA_HANDOFF_SIGNING_KEY` and
`AXIOMA_HANDOFF_KEY_ID` (the ES256 signer prerequisites) as a minimum additional gate:

```typescript
export function axiomaBridgeIsDev(): boolean {
  return (
    !process.env.AXIOMA_BRIDGE_API_TOKEN ||
    !process.env.AXIOMA_HANDOFF_SIGNING_KEY ||
    !process.env.AXIOMA_HANDOFF_KEY_ID
  );
}
```

This ensures the "Open Journal" button (which requires an ES256 token) cannot be enabled without
the signer being configured. Document the full activation checklist in a `AXIOMA_ACTIVATION.md`
ops runbook.

**Target part:** 3

---

### F-8 (LOW) — Terminal page uses `'inactive'` status path in `licenseTone` but `'inactive'` is not a real server value and is not in the target `LicenseStatus`

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:32`

```typescript
const licenseTone: Tone = state?.license.status === 'active' ? 'ok'
  : state?.license.status === 'expired' ? 'bad'
  : 'neutral';
```

The fall-through `'neutral'` handles `'inactive'`, `'none'`, and future values including `'grace'`
and `'revoked'` — which should show `'warn'` and `'bad'` respectively. This is already documented
as an issue in `docs/TERMINAL_PRODUCT_AREA.md:228` and `docs/CONTRACTS/axioma-bridge.md:844-846`.
No additional code analysis needed; the fix is tracked in F-3 above.

**Recommendation:** Resolved jointly with F-3. No separate action required.

**Target part:** 3

---

### F-9 (LOW) — No safe read-only WTC route handler for release metadata exists yet (only the mock bridge); Part 3 should add one

**Evidence:** `apps/web/src/app/api/` is empty (Glob returned no files); only `/.well-known/axioma-jwks.json/route.ts` exists.

The contract defines a worker job (`axioma-release-sync`, every 10 min) that populates
`terminal_release_cache`. A safe, read-only route at e.g. `/api/axioma/release-status` (GET,
no external calls, reads only from `terminal_release_cache`) would let client components refresh
release metadata without a full page reload. This route would call `getCurrentTerminalRelease`
on `getServerDb()` only — making zero external network calls.

**Recommendation:** Design (Part 3 only — do not build in this wave) a route handler at
`apps/web/src/app/api/axioma/release-status/route.ts` with the following contract:
- `GET /api/axioma/release-status`
- Auth: `requireUser()` (authenticated)
- No external calls: reads only `terminal_release_cache` via `getCurrentTerminalRelease(db, channel, platform)`
- Response: `{ version, channel, platform, publishedAt, minSupportedVersion, fetchedAt, isCurrent }` or `{ notFound: true }`
- CSRF: not applicable (GET, no mutation)
- Rate limit: standard session-based
This is the one safe read-only route that makes no external calls and is appropriate for Part 3.

**Target part:** 3

---

### F-10 (LOW) — Hard-boundary text in `page.tsx` is present in footnotes but not in a top-level always-visible callout

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:64, 98-100`

The boundary text "WTC never receives exchange keys or the Axioma JWT" appears in the license card
footnote (line 64), and "gates server features only, never local order execution" appears in the
journal card footnote (line 98-100). These are visible only if the user scrolls to those cards.

The contract `docs/CONTRACTS/axioma-bridge.md:693` and `docs/TERMINAL_PRODUCT_AREA.md:215` require:
"The footer of the license card and the journal/support card both contain the text: 'WTC never
gates local Axioma order execution — the terminal runs independently of your WTC subscription status.'"
The current implementation partially meets this but uses different wording in two separate footnotes.

**Recommendation:** Add a single prominent static callout near the page header (below the entitlement
status pill, above all cards) with the canonical boundary text:
"WTC never gates your local Axioma order execution. The Axioma Terminal connects to your exchange
directly and operates fully independently of your WTC subscription status."
This text must be static, always rendered, not conditional on any flag. The footnotes in cards can
remain as additional context. This matches the public product page's "Hard boundary callout" in §2.2
of `docs/TERMINAL_PRODUCT_AREA.md`.

**Target part:** 3

---

## Decisions

### D-1: DB-backed release wiring specification for Part 3

The `/app/terminal` server component (`page.tsx`) MUST be updated in Part 3 to:

1. Call `getServerDb()` at the top of `TerminalPage()`.
2. When `db !== null`: call `getCurrentTerminalRelease(db, 'stable', 'windows-x64')` and map to
   a `TerminalRelease`-compatible shape. If the DB has no current row, fall through to the mock
   bridge data with a visible "No release in DB" note.
3. License/access state remains sourced from `accessFor(user.id, 'axioma_terminal')` via
   `entitlementsOf` — this is the WTC entitlement, not Axioma's internal entitlement state.
4. `recordLicenseEvent` is called by the worker (not the page) when entitlement sync events occur.
   The page only reads; it never calls `recordLicenseEvent` or `recordDownloadEvent` directly.
5. Account-link state is read from `axiomaAccountLinks` (query by `userId`, order by `createdAt`
   desc, limit 1). Return `state` field as `AccountLinkState` — mapping `'active'` → `'linked'`,
   `'pending'` → `'pending'`, anything else → `'not_linked'`.

### D-2: Download eligibility display (no real download in Part 3)

The download button remains disabled in Part 3 (no `/api/axioma/download/terminal` proxy endpoint
exists). Even if a real release row is in the DB, clicking download must not issue a real download.
The download metadata (version, sha256 from `checksumSha256` column, size) MAY be displayed
read-only on the card. This is a safe DB read with no external call.

### D-3: "Open Axioma Journal" remains a dev placeholder in Part 3

The journal handoff requires `handoffToken.ts` (ES256 signer) which does not yet exist. The button
remains disabled with "(dev placeholder)" label regardless of `access.allowed`. The `isDev` flag
does not control this — the check must explicitly be: `!handoffSignerConfigured()` where that
helper checks `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`.

### D-4: ES256/JWKS readiness visibility

The JWKS route at `/.well-known/axioma-jwks.json` correctly surfaces `buildJwks([signer])` when
env vars are present, with `publicJwk()` hard-asserting no `'d'` in the output (confirmed at
`packages/axioma-bridge/src/es256.ts:47`). This is already production-correct for key presence
visibility. No code change needed for this specifically — just the `axiomaBridgeIsDev()` extension
in F-7 to ensure the signer config is verified before enabling "real bridge" mode.

### D-5: `LicenseStatus` type extension is a non-breaking additive change

Extending `LicenseStatus` from `'active' | 'inactive' | 'expired' | 'none'` to
`'active' | 'grace' | 'expired' | 'revoked' | 'none' | 'unknown'` (removing `'inactive'`, adding
`'grace'`, `'revoked'`, `'unknown'`) is safe:
- The mock bridge never returns `'inactive'`, `'grace'`, or `'revoked'` today — no runtime change.
- `'unknown'` is a new value for degraded/fetch-failed state.
- The tone mapping update in `page.tsx` is a purely additive UI correctness fix.
This does NOT require a DB migration.

### D-6: `axioma_account_links` raw OTC storage is a security-correctness issue requiring migration

The `oneTimeCode text` column stores the raw OTC. This qualifies as a correctness fix under the
"no migration-0003 unless strictly required" rule. The fix: rename or repurpose the column to store
only `SHA-256(OTC)` as base64url, with the raw OTC shown to the user once (never persisted). This
change aligns with the contract's `link_nonce_hash` field. The additive columns (`axioma_username`,
`linked_at`, `last_verified_at`) should be added in the same migration.

### D-7: `handoffToken.ts` filename is canonical

Prior handoffs (20260530-0925-ecosystem-axioma-bridge-auditor) established that the ES256 signer
file must be `packages/axioma-bridge/src/handoffToken.ts`. This remains confirmed and unchanged.

---

## Risks

### R-1: Real bridge activation path is under-guarded (see F-7)
Single env var `AXIOMA_BRIDGE_API_TOKEN` unlocks "real" mode but ~10 pre-conditions in the
contract checklist remain unmet. Risk: operator sets the token before the proxy/signer/link endpoints
exist, causing users to see enabled-but-broken Axioma actions. Severity: HIGH until F-7 is fixed.

### R-2: `axioma_account_links.oneTimeCode` stores plaintext OTC (see F-2, D-6)
If the table is read in a DB exfiltration scenario, active OTCs (10-min TTL) could be replayed to
link a WTC user's Axioma account to an attacker's device. Mitigated by the 10-min TTL but the
principle of defence-in-depth requires hashing. Severity: MEDIUM (limited window, short TTL).

### R-3: `handoffToken.ts` (ES256 signer) does not exist yet
The "Open Journal" production path is blocked until this file is written. Any implementation that
attempts to use `signHandoffToken` (HS256) in production will throw. This is intentional and
correctly guarded — but it means Part 3 cannot close the "Open Journal" action for real-bridge mode.
Severity: LOW for this phase (the button is disabled); HIGH as a production gate when real-wiring begins.

### R-4: `TerminalRelease.notes` is `string[]` but the server returns structured `release_entry.sections`
The mock bridge fills `notes` with flat strings. The real bridge will return
`{title: string, items: string[]}`-structured sections. The mapping layer (to be built in Part 3
or 4) must flatten or render structured sections. If the flat list is used with structured data,
the UI will show `[object Object]` entries. Severity: LOW in mock mode; MEDIUM when real wiring begins.

### R-5: Package rename risk (`com.greenfield.terminal` → Axioma) remains an open question
`docs/CONTRACTS/axioma-bridge.md §12` documents the safeStorage decryption/re-encryption risk.
WTC's `terminal_release_cache` stores only the WTC-side release version; it does not hardcode the
Axioma package identity. The rename does not break WTC-side DB or UI unless the `product` field in
the release manifest changes. Monitor OPEN_QUESTIONS Q-1.

---

## Verification / tests

### Existing coverage confirmed:

- `packages/axioma-bridge/src/es256.test.ts`: 6 cases — ES256 sign/verify round-trip; header
  asserts `alg=ES256` + `kid`; JWKS `'d' not in jwk'` hard-assert; wrong-key rejection; expiry,
  aud-mismatch, replay all rejected; alg-confusion (`HS256` header) rejected. **Covers F-3/D-4.**

- `packages/axioma-bridge/src/handoff.test.ts`: 4 cases — claims contain only declared fields
  (no password/JWT); issuer matches spec string; alg is `HS256` (dev-stub visibility); verify
  rejects expiry/aud/replay; prod-guard throws. **Covers the hard-assert that HS256 is dev-only.**

- `packages/axioma-bridge/src/__smoke__.ts`: 7 assert-based checks — sign/verify, expiry, aud,
  tamper, wrong secret, replay, no-key-material in token.

### Tests REQUIRED before Part 3 ships (not yet written):

| Test file | What it must cover |
|-----------|-------------------|
| `packages/axioma-bridge/src/bridge.test.ts` | `LicenseStatus` exhaustiveness with updated type (grace, revoked, unknown all map to a valid tone) |
| `apps/web/src/app/(app)/app/terminal/page.test.tsx` | DB-backed release card shows DB values; mock fallback shows mock values; isDev banner non-dismissible |
| `packages/db/src/repositories.test.ts` | `getCurrentTerminalRelease` returns null when no current row; `upsertTerminalRelease` demotes prior isCurrent; `recordDownloadEvent` writes audit log |
| `tests/e2e/terminal-page-entitlement-states.e2e.ts` | UI for grace/revoked/none/active states (per contract §13) |
| `tests/e2e/terminal-page-no-release.e2e.ts` | Shows "No release available" when DB has no current row |

### Axioma bridge contract tests required before production wiring (from §13):

All 10 unit tests and 6 integration tests in `docs/CONTRACTS/axioma-bridge.md §13` remain un-written.
Most critical: `entitlement-status-mapper.test.ts` (maps all 5 server statuses) and
`download-token.test.ts` (OTC consume lifecycle). These must be written before F-2/D-6 changes land.

---

## Next actions

1. **Part 3 implementer:** Fix `LicenseStatus` type in `packages/axioma-bridge/src/bridge.ts:8`
   (add `'grace'`, `'revoked'`, `'unknown'`; remove `'inactive'`). Update `licenseTone` map in
   `apps/web/src/app/(app)/app/terminal/page.tsx:32`. (See F-3, D-5.)

2. **Part 3 implementer:** Extend `axiomaBridgeIsDev()` in `apps/web/src/lib/server-config.ts`
   to also check `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`. (See F-7.)

3. **Part 3 implementer:** Add `getServerDb()` call and `getCurrentTerminalRelease` read to
   `apps/web/src/app/(app)/app/terminal/page.tsx`. Map DB row to release display fields. (See F-1, D-1.)

4. **Part 3 implementer:** Read `axiomaAccountLinks` by `userId` (most recent row) to populate
   account-link state. Display `state` → `AccountLinkState` mapping as specified in D-1.

5. **Part 3 implementer:** Add static hard-boundary callout near page header per F-10 and D-3
   footnote text. Ensure it is not conditional on any flag.

6. **DB / migration owner:** File a migration to: (a) rename/repurpose `one_time_code` column to
   store only SHA-256 hash; (b) add `axioma_username`, `linked_at`, `last_verified_at`,
   `link_nonce_hash` columns to `axioma_account_links`. (See F-2, D-6.) This is a correctness fix
   that qualifies under the migration-0003 exception.

7. **INTEGRATION_MAP maintainer (this agent's owned section):** Update
   `docs/INTEGRATION_MAP.md:197` Axioma row TTL from "6 hours" to "10 min". (See F-6.) Note:
   this document edit is deferred to the next write-enabled session since this is a read-only wave.

8. **Part 3 implementer:** Do NOT build the download proxy or OTC link endpoint in Part 3 (those
   belong in Parts 3/4 with separate security review). Display download metadata (version, sha256,
   size) from DB read-only; button remains disabled until the proxy endpoint is implemented. (See F-4, D-2.)

9. **JWKS route:** Consider reducing `max-age` to 300 or resolving the `force-dynamic` vs
   `max-age=3600` inconsistency. Low priority. (See F-5.)

10. **Test author (Part 6):** Write the 5 missing test files listed in Verification/tests above
    before the real bridge wiring gate is opened.
