# ecosystem-axioma-bridge-auditor handoff

## Scope

Phase 2 / Epoch 20260530-0126. Axioma bridge product-area design (Part 6).

Read-only audit of all referenced source and docs; edits limited to:
- `docs/CONTRACTS/axioma-bridge.md` (owned by this agent)
- `docs/TERMINAL_PRODUCT_AREA.md` (new, unowned doc created per session instructions)
- This handoff file

Deliverables:
- (a) `/products/axioma-terminal` public product page content model
- (b) `/app/terminal` authenticated dashboard content model
- (c) Mock bridge view shape with gap analysis
- (d) Future ES256/JWKS bridge/SSO shape described as TARGET

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/CONTRACTS/axioma-bridge.md` (owned — read before edit)
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/index.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(public)/products/[slug]/page.tsx`
- `apps/web/src/app/(public)/products/page.tsx`
- `docs/INTEGRATION_MAP.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/handoffs/20260529-phase0-axioma-bridge-auditor.md`

---

## Files changed

- `docs/CONTRACTS/axioma-bridge.md` — appended §§17–17.5 (Part 6 product-area design); bumped version to 1.1.0
- `docs/TERMINAL_PRODUCT_AREA.md` — created (new, unowned; companion to contract §17)
- `docs/handoffs/20260530-0126-ecosystem-axioma-bridge-auditor.md` — this file

No code files edited. No shared packages modified. `docs/INTEGRATION_MAP.md` not edited
(proposed deltas captured in contract §17.5 for platform-architect to merge).

---

## Findings

### F-1 — LicenseStatus type gap (severity: medium, blocks real bridge wiring)

**Evidence:** `packages/axioma-bridge/src/bridge.ts` line 8:
`export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'none';`

The journal_server entitlement endpoint (`GET /api/v1/entitlement/me`) returns:
`active | grace | expired | revoked | none` (contract §5.3).

`'grace'` and `'revoked'` are missing from the bridge type. `'inactive'` is not a server value.
The dashboard page maps `'inactive'` to tone `'neutral'`, which is harmless in mock mode but
would be wrong against the real endpoint.

**Recommendation:** Before wiring the real bridge, extend `LicenseStatus` to
`'active' | 'grace' | 'expired' | 'revoked' | 'none' | 'unknown'` in `bridge.ts`.
Add a grace-period sub-object (`{ daysRemaining: number }`) to the license field.
Target type defined in contract §17.3.2.

**Target part:** `packages/axioma-bridge/src/bridge.ts`

---

### F-2 — TerminalRelease shape is a subset of the server response (severity: low, informational)

**Evidence:** `bridge.ts` `TerminalRelease` interface (lines 11–17) vs contract §5.4 server response.

Missing from bridge type: `product` (string — must come from manifest, must not be hardcoded due
to rename risk), `installer_name`, `sha256`, `size_bytes`, `release_entry` (structured sections).

The page only uses `version`, `channel`, `publishedAt`, `minSupportedVersion`, `notes` so this is
not a current defect. However the download button (when real) needs `installer_name`, `sha256`,
and `size_bytes` for the download eligibility response.

**Recommendation:** Extend `TerminalRelease` to match the full server response before real bridge
wiring. Target type defined in contract §17.3.2 as `AxiomaTerminalRelease`.

**Target part:** `packages/axioma-bridge/src/bridge.ts`

---

### F-3 — Mock download URL is a plain path, not a proxy token URL (severity: low, by design)

**Evidence:** `bridge.ts` line 66:
```
url: hasEntitlement ? `${base}/releases/axioma-setup-${SAMPLE_RELEASE.version}.exe` : undefined
```

This is a plain file path, not a WTC proxy token URL (`/api/axioma/download/terminal?token=<one-time>`).
The download button is disabled in dev mode so this URL is never fetched — the current state is
intentionally harmless.

**Recommendation:** Document (done in contract §17.3.3) that the mock URL is a non-functional
placeholder. Real bridge must return a WTC proxy URL with `expiresAt`. The WTC proxy endpoint
(Option B, contract §5.5) must be implemented before the download feature can go live.

**Target part:** `packages/axioma-bridge/src/bridge.ts` (mock); `/api/axioma/download/terminal` route (real)

---

### F-4 — HS256 dev-stub handoff throws in production; this is correct and must stay labelled (severity: informational)

**Evidence:** `packages/axioma-bridge/src/handoff.ts` lines 59–63:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production...');
}
```

This guard is correct. The "Open Journal" button being disabled in dev mode ensures users never
receive an HS256 token that Axioma's production validator would reject. The page correctly renders
a "(dev placeholder)" label on the button.

**Recommendation:** No change needed to the guard. The production ES256/JWKS signer
(`issueHandoffToken` in `handoffToken.ts`) is defined in `AXIOMA_HANDOFF_TOKEN_SPEC.md` and
described as TARGET in contract §17.4.1. Implementation is blocked on: Axioma team confirming
the `/wtc-handoff` validation endpoint is live and the JWKS auto-discovery is operational.

**Target part:** `packages/axioma-bridge/src/handoffToken.ts` (to be created)

---

### F-5 — INTEGRATION_MAP release cache TTL is stale (severity: low)

**Evidence:** `docs/INTEGRATION_MAP.md` line 197 states "WTC bridge caches release metadata in
`terminal_release_cache` (TTL 6 hours)". Contract §5.4 and worker §15 both specify 10 minutes.

**Recommendation:** Platform-architect to update INTEGRATION_MAP §3 Axioma row. Proposed delta
recorded in contract §17.5 to avoid this agent editing a file it does not own.

**Target part:** `docs/INTEGRATION_MAP.md` (platform-architect owned)

---

### F-6 — TARGET tables not yet migrated (severity: informational, known)

`terminal_release_cache`, `terminal_download_events`, `terminal_license_events` are listed as TARGET
in the seed doc. Only `axioma_account_links` is confirmed to exist. The mock bridge does not require
these tables. Real bridge wiring requires all four.

**Recommendation:** These are a prerequisite for real bridge activation. Listed in contract §17.4.2
activation checklist.

---

### F-7 — Public product page uses minimal content block (severity: informational)

**Evidence:** `apps/web/src/app/(public)/products/[slug]/page.tsx` lines 8–11:
The `COPY['axioma_terminal']` entry is 4 bullets and a single tagline sentence.

The page template renders title, tagline, availability note, feature bullets, and a two-card CTA.
This is functional but does not deliver the full product-area content model defined in contract §17.1
and `TERMINAL_PRODUCT_AREA.md §2.2` (three-panel description, feature highlights, screenshots,
hard-boundary callout, pricing section, account-link explainer).

**Recommendation:** Expand the product page incrementally. The existing template supports richer
content via the `COPY` record. A dedicated Axioma terminal product page layout can be created
without breaking the shared template for other products. This is a frontend-implementer task —
no bridge wiring required; the public page is static-content-only.

**Target part:** `apps/web/src/app/(public)/products/[slug]/page.tsx` or a new
`apps/web/src/app/(public)/products/terminal/page.tsx` if a bespoke layout is warranted.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| Public product page has NO bridge call | Static content + availability status only; no server-side data required for marketing page |
| `bridgeMode: 'mock' \| 'real'` added to target view shape | Explicit mode field drives UI labelling; no implicit inference from env |
| `openJournalAvailable` is a derived boolean in the view | Combines linked + active/grace + real-bridge into one clear gate rather than ad-hoc conditionals in the component |
| Dev-placeholder labels are content strings, not CSS-only | Accessible, survives dark-mode / custom CSS, visible in automated tests |
| INTEGRATION_MAP delta proposed but not applied | This agent does not own INTEGRATION_MAP; proposing via contract §17.5 for platform-architect to merge |
| `TERMINAL_PRODUCT_AREA.md` created as an unowned doc | Session instructions permitted it; it is a companion reference, not a governed contract |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Real bridge wiring before `LicenseStatus` is extended | Medium | F-1 documents the gap; activation checklist in §17.4.2 requires it |
| `product` field hardcoded in UI after rename | Medium | Contract §12 and §17.3.2 note: use `state.release.product`, never hardcode |
| HS256 dev-stub accidentally enabled in production via env override | Low | `NODE_ENV === 'production'` guard throws; no way to bypass without code change |
| TARGET tables absent when real bridge activates | Low | Activation checklist in §17.4.2 lists table migrations as prerequisites |
| Public product page copy not updated to reflect rename | Low | Copy is static strings; update alongside rename migration |

---

## Verification / tests

No new tests run this session (read-only audit + contract/doc edits only).

Tests required before real bridge activation are specified in contract §13 (unit, integration, e2e).
The mock bridge + existing page render correctly under the current test suite (93+ unit, 14 e2e
from prior phase — not re-verified this session, but no code was changed).

The dev-placeholder label rendering is verifiable in the existing Playwright e2e test
`terminal-page-entitlement-states.e2e.ts` (specified in §13, not yet written).

---

## Next actions

1. **platform-architect:** Apply INTEGRATION_MAP deltas from contract §17.5 (release cache TTL 10 min,
   add product-page/dashboard row, mark TARGET tables, update mock-vs-real note).

2. **frontend-implementer:** Expand `/products/terminal` page with the full content model from
   `TERMINAL_PRODUCT_AREA.md §2.2`. No bridge call needed — static content only. Requires operator
   to provide screenshot assets.

3. **platform-architect / axioma-bridge-auditor:** Extend `LicenseStatus` and `TerminalRelease`
   types in `packages/axioma-bridge/src/bridge.ts` to match server response (F-1, F-2). This is a
   prerequisite for real bridge wiring, not a mock defect.

4. **platform-architect:** Implement `AxiomaProductView` target type (contract §17.3.2) as the
   canonical page-binding shape; update `apps/web/src/app/(app)/app/terminal/page.tsx` to consume it.

5. **security-auditor / platform-architect:** Implement `issueHandoffToken` (ES256/JWKS) in
   `packages/axioma-bridge/src/handoffToken.ts` per `AXIOMA_HANDOFF_TOKEN_SPEC.md`. Coordinate with
   Axioma team on JWKS endpoint and `/wtc-handoff` validation. This unblocks the "Open Journal" action.

6. **platform-architect:** Implement the WTC download proxy endpoint
   `/api/axioma/download/terminal` (Option B, contract §5.5). Required before the download button
   goes live.

7. **db-architect:** Migrate `terminal_release_cache`, `terminal_download_events`,
   `terminal_license_events` tables. `axioma_account_links` already exists.

8. **operator:** Resolve OPEN_QUESTIONS Q-1 (rename migration), Q-5 (cross-domain auth),
   Q-8 (download auth model). These are the three open questions directly blocking the Axioma
   product area from going to production.
