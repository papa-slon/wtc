# Axioma Terminal — Product Area Design

> Owner: ecosystem-axioma-bridge-auditor
> Created: 2026-05-30 (Phase 2, Epoch 20260530-0126)
> Status: Design document — MOCK BRIDGE TODAY. All UI sections labelled
>         dev-placeholder / not-production-handoff-yet where applicable.
>
> Related: docs/CONTRACTS/axioma-bridge.md §17
>          docs/AXIOMA_HANDOFF_TOKEN_SPEC.md
>          packages/axioma-bridge/src/{bridge,handoff,index}.ts
>          apps/web/src/app/(public)/products/[slug]/page.tsx
>          apps/web/src/app/(app)/app/terminal/page.tsx

---

## 1. Product identity

| Field | Value |
|-------|-------|
| Product code | `axioma_terminal` |
| Route slug | `terminal` |
| Display name | "Axioma Terminal" (WTC display name; see OPEN_QUESTIONS Q-1 for rename risk) |
| Plans | `axioma_monthly`, `axioma_yearly`, included in `bundle_pro` |
| Runtime owner | Axioma journal_server (`127.0.0.1:8123` / `axi-o.ma`) via `packages/axioma-bridge` |
| Entitlement gates | Downloads, cloud journal, support handoff, "Open Journal" signed link |
| NEVER gated | Local order execution in the Axioma desktop terminal |

---

## 2. /products/terminal — public product page

### 2.1 Route

`/products/terminal` — served by `apps/web/src/app/(public)/products/[slug]/page.tsx`.
No authentication required. No bridge call on this page — static content + availability status only.

### 2.2 Content model

#### Header zone

```
[StatusPill: "Flagship product" gold] [StatusPill: availability from PRODUCT_AVAILABILITY]

# Axioma Terminal

A professional desktop trading terminal with an integrated cloud journal and analytics suite —
licensed and delivered through your WTC account.
```

#### Three-panel body

**Panel A — Desktop terminal**

Title: "Built for execution"

Body: Axioma Terminal is a standalone Electron desktop application. It runs locally on your
machine and connects to your chosen exchange directly. WTC is never in your order path — your
positions, stops, and sizing are entirely local.

Feature list:
- Lightweight Charts v5 execution view
- Local order management (open, close, amend, protective stop)
- OS-level encrypted exchange keys via Electron safeStorage
- Works offline — cloud features are optional

**Panel B — Cloud journal**

Title: "A journal that thinks like a trader"

Body: Every trade you execute in Axioma Terminal can be logged to your personal Axioma cloud
journal. Annotate your premise, rate the setup quality, and let stats v2 tell you whether your
edge is real.

Feature list:
- Trade log with premise, timeframe, exchange, and outcome tagging
- Stats v2: win rate, expectancy, setup-premise outcomes, timeframe breakdowns
- "Open Journal" from WTC in one click once your account is linked
- Feedback and support submissions forwarded securely from WTC

**Panel C — WTC integration**

Title: "Your WTC account is the control plane"

Body: WTC manages your Axioma license, delivers authenticated downloads, and links your account
so you can open your journal without a second login. WTC never stores your Axioma password, never
holds your exchange keys, and never touches the terminal's order execution engine.

Feature list:
- License and entitlement state always visible in your WTC dashboard
- Signed download delivery — no guessable public URLs
- Account link via one-time code (WTC stores only your Axioma user id)
- Support handoff: submit Axioma feedback from WTC, forwarded with redaction

#### Hard boundary callout (must appear)

```
[Info callout]
WTC never gates local order execution.
Your Axioma Terminal connects to your exchange directly and operates fully independently
of your WTC subscription status. Server-backed features (journal, downloads, support)
require an active license; local trading does not.
```

#### Screenshots section

Slot for 3 images — to be provided by Axioma team:
1. Axioma Terminal execution view (no real account balances visible)
2. Cloud journal trade log view
3. Stats v2 analytics dashboard

Placeholder text while images are absent: "[Screenshot: {description} — to be provided]"
Each image requires descriptive alt text. No images showing exchange credentials or real PnL.

#### Pricing / access section

```
Available on: axioma_monthly | axioma_yearly | bundle_pro
Access is managed through WTC entitlements.
A 7-day grace period applies when a subscription lapses — server-backed features are
suspended after grace; local terminal trading is never affected.
```

CTA row:
- Primary: "Create account" → `/register`
- Secondary: "See pricing" → `/pricing`
- Tertiary (client-rendered for authed users): "Open your terminal dashboard" → `/app/terminal`

#### Account-link explainer section

Heading: "How account linking works"

Steps:
1. Activate Axioma Terminal through WTC billing.
2. In your WTC dashboard, click "Connect Axioma account" — you will see a short-lived one-time code.
3. Enter the code in the Axioma Terminal app (or click the deep link). Axioma exchanges the code on its server.
4. WTC records that your accounts are linked — storing only your Axioma user identifier, nothing else.
5. Click "Open Journal" from your WTC dashboard. In production, a signed, single-use handoff token is exchanged — you are taken directly to your journal without re-entering credentials.

Note: "In production" above refers to the ES256/JWKS handoff described in AXIOMA_HANDOFF_TOKEN_SPEC.md.
The HS256 dev-stub signer currently implemented is a LOCAL DEVELOPMENT PLACEHOLDER only and will not
function as a production SSO mechanism.

### 2.3 Data sourced at render time

The public product page does NOT call the bridge. All content is:
- Static copy (this document)
- `PRODUCTS['axioma_terminal']` (name, slug)
- `PRODUCT_AVAILABILITY['axioma_terminal']` (availability status + note)

---

## 3. /app/terminal — authenticated product dashboard

### 3.1 Route

`/app/terminal` — served by `apps/web/src/app/(app)/app/terminal/page.tsx`.
Requires an authenticated WTC session (`requireUser()`).

### 3.2 Server-side data loading

```typescript
// Pseudocode — see actual implementation in apps/web/src/app/(app)/app/terminal/page.tsx
const user    = await requireUser();
const access  = await accessFor(user.id, 'axioma_terminal');
const isDev   = axiomaBridgeIsDev();
const state   = await getBridge().getProductState(user.id, access.allowed);
// bridgeError set to true if above throws
```

`state` is `AxiomaProductState` (current) / `AxiomaProductView` (target shape in §17.3.2 of the contract).

### 3.3 UI section inventory

See contract §17.2 for full content model. Summary of sections:

| # | Section | Source | Dev-placeholder |
|---|---------|--------|----------------|
| 1 | Page header + entitlement status pill | `access`, `reasonLabel` | No — always shown |
| 2 | Dev bridge warning banner | `isDev` flag | Yes — this IS the placeholder label |
| 3 | Bridge error banner | `bridgeError` flag | No — real error state |
| 4 | No-entitlement warning | `!access.allowed` | No — real state |
| 5 | License & account card | `state.license`, `state.accountLink` | Partially — "Connect" button is dev placeholder |
| 6 | Latest release card | `state.release` | Yes — Download button is dev placeholder |
| 7 | Journal & support card | `state.journal`, `state.support` | Yes — "Open Journal" is dev placeholder |
| 8 | Docs / training links | Static | Yes — all links are "(coming soon)" |

### 3.4 Dev-placeholder labelling rules

Every action that touches Axioma infrastructure is labelled in one or more of these ways:
1. Button label appends " (dev placeholder)"
2. Button `disabled` attribute is set to `true`
3. Button `title` attribute explains: "Dev placeholder — no real [endpoint] configured"
4. The dev bridge warning banner (section 2) is always visible when `isDev` is true

These labels are content strings in the rendered HTML — they are not CSS-hidden, not
conditional on a feature flag the user can manipulate, and not removed in any build variant
while the mock bridge is active.

### 3.5 Entitlement-state → UI state reference

See contract §17.2 for the full matrix. The two most important rows:

**active + real bridge:** Download = primary enabled; Open Journal = primary enabled; 
  no placeholder labels; no warning banner (except if bridge degrades mid-session).

**active + mock/dev bridge:** Download = ghost disabled "(dev placeholder)"; 
  Open Journal = ghost disabled "(dev placeholder)"; dev warning banner always visible.
  This is the current state of the implementation.

### 3.6 Hard boundary display

The footer of the license card and the journal/support card both contain the text:
"WTC never gates local Axioma order execution — the terminal runs independently of your
WTC subscription status."

This text is static, always rendered, and not conditional on any flag.

---

## 4. Mock bridge view shape — gap analysis vs real bridge

### 4.1 LicenseStatus gap

Current bridge type: `'active' | 'inactive' | 'expired' | 'none'`
journal_server entitlement endpoint returns: `'active' | 'grace' | 'expired' | 'revoked' | 'none'`

Missing from bridge type: `'grace'`, `'revoked'`; `'inactive'` is not a server value.

Action required (platform-architect): extend `LicenseStatus` in `packages/axioma-bridge/src/bridge.ts`
before wiring the real bridge. The page currently maps `'inactive'` to tone `'neutral'` which is not
wrong for mock purposes but must be updated.

### 4.2 Release shape gap

Current `TerminalRelease` in bridge.ts:
```typescript
{ version, channel, publishedAt: number, minSupportedVersion, notes: string[] }
```

Server response shape (§5.4) includes additionally:
- `product` (string — must not be hardcoded; changes on rename)
- `installer_name`, `sha256`, `size_bytes`
- `release_entry` with structured sections and excerpt

The page's release card currently uses only `version`, `channel`, `publishedAt`, `minSupportedVersion`,
`notes`. The extended fields are needed for: download eligibility display (installer name, size),
security verification (sha256), and richer release notes (sections).

### 4.3 Download URL gap

Mock bridge: `download.url` is a plain base-URL path (not a proxy token URL).
Real bridge: `download.url` must be a WTC proxy URL (`/api/axioma/download/terminal?token=<one-time>`)
with `expiresAt` set.

The download button is disabled in dev mode so the mock URL is never fetched.
Real wiring requires the WTC proxy endpoint (§5.5 Option B) to be implemented first.

### 4.4 Journal reachability gap

Mock bridge: `journal.reachable: true` (always, static).
Real bridge: must call health endpoint and reflect circuit breaker state.

The `openJournalAvailable` field added in the target view shape (§17.3.2 of contract) resolves this
by combining `reachable`, `accountLink.state`, `license.status`, and `bridgeMode`.

### 4.5 ES256/JWKS handoff state

Current: ES256/JWKS primitives exist in `packages/axioma-bridge/src/{es256,signer,jwks}.ts`; the public
JWKS route is `/.well-known/axioma-jwks.json`, and the journal-handoff route resolves the signer from
`AXIOMA_HANDOFF_SIGNING_KEY` plus `AXIOMA_HANDOFF_KEY_ID`. The HS256 helper in
`packages/axioma-bridge/src/handoff.ts` remains a dev/test stub and throws in production.

The "Open Journal" button remains disabled because live Axioma endpoint shapes, key provisioning,
browser CTA behavior, and download/account-link boundaries are still B4 blockers, not because ES256 code is absent.

---

## 5. Integration with existing [slug] page

The public product page (`/products/[slug]/page.tsx`) already has a minimal content block for
`axioma_terminal`:

```typescript
axioma_terminal: {
  tagline: 'A premium desktop trading terminal, licensed and supported through WTC.',
  bullets: [
    'Lightweight-charts execution view',
    'Local encrypted keys (OS safeStorage)',
    'Cloud journal & analytics bridge',
    'Signed download + release notes',
  ],
}
```

This content is a starting point. The full content model in §2.2 above defines the richer design
that should be implemented when the product page is expanded beyond the MVP template. The template
renders: status pills, title, tagline, availability note, "What you get" bullets, and a "Get access"
CTA. The full design adds: three-panel description, feature highlights, screenshots, hard boundary
callout, pricing/access section, and account-link explainer.

The richer content can be added incrementally — the slug page supports it via the `COPY` record
and an extended layout, without breaking the existing shared template for other products.

---

## 6. Open questions relevant to this product area

Sourced from `docs/OPEN_QUESTIONS.md`:

| Q | Issue | Impact on this product area |
|---|-------|---------------------------|
| Q-1 | Axioma package rename (`com.greenfield.terminal` → Axioma) | Product display name, release manifest `product` field, deep-link scheme |
| Q-5 | Cross-domain WTC ↔ Axioma auth | Account-link and handoff SSO shape |
| Q-8 | Axioma desktop download auth model | Download button real implementation |

The "dev placeholder" labels are correct and required until Q-5 and Q-8 are resolved.

---

## 7. What is NOT a placeholder

The following work correctly today and are NOT dev placeholders:

- The page loads and renders for all entitlement states (active/expired/none/no-access)
- The mock bridge returns a valid `AxiomaProductState` for display
- The dev-warning banner correctly identifies the mock bridge state
- The entitlement access check (`accessFor`) is real and fail-closed
- The hard-boundary footnote text is always rendered
- The status pills (license tone, account-link state) display correctly from mock data
- The FAQ/Support links render (pointing at the mock base URL)
- The release notes bullet list renders from mock data

These items do not require bridge wiring to be correct and useful.
