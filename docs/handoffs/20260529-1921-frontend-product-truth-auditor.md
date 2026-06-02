# frontend-product-truth-auditor handoff

_2026-05-29 19:21 UTC. Read-only audit of apps/web/src/components/* and apps/web/src/app/**._
_Phase 1.5 context: BOT_ADAPTER_MODE=mock default; Axioma bridge is dev placeholder; DB backend is in-memory unless DATABASE_URL is set._

## Scope

Focused audit of six product-truth claims (G1–G6) in the WTC Ecosystem Platform web UI:

- G1: Always-green "ecosystem online" status — should be environment-aware
- G2: Mock bot metrics rendered without explicit badge distinguishing from live-account data
- G3: Mobile nav omits "soon" markers present in desktop NavLinks
- G4: Public product pages do not distinguish available / demo / planned / disabled
- G5: Placeholder legal pages look like finalized legal documents
- G6: Backend source badge (memory/demo vs postgres) presence and correctness

## Files inspected

- `apps/web/src/components/PublicTopBar.tsx`
- `apps/web/src/components/NavLinks.tsx`
- `apps/web/src/components/MobileNav.tsx`
- `apps/web/src/components/Placeholder.tsx`
- `apps/web/src/components/BotSubPagePlaceholder.tsx`
- `apps/web/src/components/Sparkline.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/(app)/app/layout.tsx`
- `apps/web/src/app/(app)/app/page.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/(app)/app/products/page.tsx`
- `apps/web/src/app/(public)/page.tsx`
- `apps/web/src/app/(public)/products/page.tsx`
- `apps/web/src/app/(public)/products/[slug]/page.tsx`
- `apps/web/src/app/(public)/pricing/page.tsx`
- `apps/web/src/app/(public)/education/page.tsx`
- `apps/web/src/app/(public)/legal/[doc]/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260529-phase1-persistence-hardening.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`

## Files changed

None — read-only audit.

## Findings

### Finding 1 (HIGH) — G1: "ecosystem online" hardcoded green in public top bar

**Evidence:** `apps/web/src/components/PublicTopBar.tsx:14`

```tsx
<StatusPill tone="ok">ecosystem online</StatusPill>
```

This pill is `tone="ok"` (green) unconditionally. It appears on every public page (landing, products, pricing, education, legal). It implies live connected services when the actual runtime is: in-memory demo store (no DATABASE_URL), mock bot adapters (BOT_ADAPTER_MODE=mock), and mock Axioma bridge (AXIOMA_BRIDGE_API_TOKEN unset). A user or potential customer reads this as a health indicator for real trading infrastructure.

The component is a client-safe async Server Component — it can read `backendMode` from `@/lib/backend` (already imported in the app layout) or `process.env` flags. No environment-detection logic exists here.

**Recommendation:**
- Remove the always-green pill or replace it with an environment-aware component.
- When `backendMode === 'memory'` or any adapter token is unset, render `<StatusPill tone="warn">demo mode</StatusPill>`.
- When `backendMode === 'postgres'` and integrations are wired, render neutral/gold `<StatusPill tone="neutral">WTC</StatusPill>` or omit entirely — the brand wordmark is enough.
- If a real integration health check is wired (planned: `admin/system-health`), derive from that; otherwise gate on env flags.

---

### Finding 2 (HIGH) — G2: Mock bot metric values lack a prominent "mock data" banner on the bot detail page

**Evidence:**
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:48` — `<StatusPill tone="neutral">{adapter.mode} data</StatusPill>` (neutral tone, small, in header row alongside health status)
- `apps/web/src/app/(app)/app/bots/page.tsx:30` — `copy={...BOT_ADAPTER_MODE=mock}` in `SectionHeader` sub-copy text (small, plain, easy to miss)

The bot detail page renders a full 8-metric grid (`MetricCard` × 8), an open-positions table, and a recent-trades table. All values are sourced from the mock adapter. The only disambiguation is a small `StatusPill tone="neutral">mock data</StatusPill>` in the page header row. There is no banner-level warning, and `tone="neutral"` does not visually distinguish this from a live data pill. A user entitled to the bot could believe the wallet equity, PnL, and win-rate figures reflect their real account.

The bots list page embeds the mode in a paragraph of `copy={}` text — not a distinct UI element.

**Recommendation:**
- When `adapter.mode === 'mock'` (or any non-`read-only`/`audited` mode), render a `<RiskWarningBanner severity="warning" ...>` immediately above the metric grid with explicit text: "These figures are simulated mock data — not your live account. Real data requires BOT_ADAPTER_MODE=read-only or audited with a confirmed adapter."
- Upgrade the `StatusPill` from `tone="neutral"` to `tone="warn"` for `mock` mode, and `tone="ok"` only for `read-only` or `audited` mode.
- On the bots list page, replace the inline `copy` text with a `RiskWarningBanner` shown when `botAdapterMode() === 'mock'`.

---

### Finding 3 (HIGH) — G3: MobileNav does not render "soon" markers — desktop and mobile nav diverge in product truth

**Evidence:**
- `apps/web/src/components/NavLinks.tsx:15` — renders `{item.soon && <span ...>soon</span>}` for each item where `soon: true`
- `apps/web/src/components/MobileNav.tsx:1–21` — iterates `items.map((i) => <Link ...>{i.label}</Link>)` with no reference to `i.soon` at all

Items with `soon: true` in `APP_NAV` (fed to both NavLinks and MobileNav via `apps/web/src/app/(app)/app/layout.tsx:42`):
- `/app/products` — `soon: true`
- `/app/support` — `soon: true`

Items with `soon: true` in `ADMIN_NAV` (fed to NavLinks only — admin layout has no MobileNav):
- `/admin/users`, `/admin/products`, `/admin/bots`, `/admin/education`, `/admin/system-health` — all `soon: true`

TEACHER_NAV has three `soon: true` items; teacher layout has no MobileNav.

The immediate risk is the app shell: on mobile, `/app/products` and `/app/support` appear as regular nav links with no "soon" indicator. A mobile user tapping these sees a skeleton placeholder but receives no advance indication it is incomplete. This is a product-truth divergence between desktop and mobile.

**Recommendation:**
- In `MobileNav.tsx`, add the same "soon" marker as NavLinks:
  ```tsx
  {i.label}
  {i.soon && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.6 }}>soon</span>}
  ```
- Or centralise the link rendering into a single `NavLinkItem` component shared by both NavLinks and MobileNav, so the `soon` logic cannot drift again.

---

### Finding 4 (MEDIUM) — G4: Public product catalog and product detail pages give no availability/status distinction across products

**Evidence:**
- `apps/web/src/app/(public)/products/page.tsx:13–17` — renders all six PRODUCTS identically with no status badge (available / demo / planned / disabled)
- `apps/web/src/app/(public)/products/[slug]/page.tsx:26` — only distinction is `tone="gold"` for `axioma_terminal` vs `"WTC product"` for others; no availability or readiness indicator

From the orchestrator seed, product readiness is uneven:
- `axioma_terminal` — bridge wired but Axioma handoff is HS256 dev stub; download/journal are dev placeholder
- `tortila_bot` — mock adapter; P0/P1 open items (TP reconciliation, margin pre-flight)
- `legacy_bot` — mock adapter
- `tradingview_indicators` — manual admin queue, no automation; TV access is functional
- `education` — in-memory LMS; no published courses in seed
- `club` — no implementation beyond entitlement flag

A visitor to `/products/education` or `/products/club` sees the same "Get access / See pricing" CTAs as `/products/terminal`, with no indication that these are at different stages of readiness.

**Recommendation:**
- Add a `status` field to the per-product copy map in `[slug]/page.tsx`: `'available' | 'demo' | 'planned' | 'disabled'`.
- Render a `StatusPill` below the `SectionHeader` in the product detail page showing this status, e.g.:
  - `axioma_terminal` → `available (dev bridge)` tone gold
  - `tortila_bot` → `available (mock data)` tone warn
  - `education` → `planned` tone neutral
  - `club` → `planned` tone neutral
- On the products catalog page (`/products`), add the same pill to each product card.
- This makes the catalog honest for users deciding what to purchase.

---

### Finding 5 (MEDIUM) — G5: Placeholder legal pages lack a user-facing DRAFT/placeholder banner

**Evidence:** `apps/web/src/app/(public)/legal/[doc]/page.tsx:6–7`

```ts
terms: { title: 'Terms of Service', body: 'Placeholder terms. Use of WTC products is subject to these terms and the risk disclosure. Replace with counsel-reviewed copy before launch.' },
privacy: { title: 'Privacy Policy', body: 'Placeholder privacy policy. WTC stores account data and encrypted secrets; plaintext exchange keys are never stored or logged.' },
```

The page renders these as a standard `<Card>` with no visual DRAFT indicator. The page title is "Terms of Service" and "Privacy Policy" with `kicker="Legal"`. A user navigating to `/legal/terms` or `/legal/privacy` sees a full-looking page with those titles. The placeholder notice is only legible by reading the body text closely — the word "Placeholder" is the first word in the body but there is no banner, badge, or colour treatment that distinguishes this from a finalized document.

Note: `/legal/risk-disclosure` is substantially real (it references the Tortila P0/P1 items and adds a `RiskWarningBanner`) and is acceptable. Only `terms` and `privacy` are placeholder.

**Recommendation:**
- Render a `<RiskWarningBanner severity="warning" title="Draft — not final legal document" detail="These terms/policy are placeholder copy and have not been reviewed by counsel. Do not rely on these for legal decisions." />` immediately below the `SectionHeader` for `terms` and `privacy` docs.
- Alternatively, add `draft: true` to the `DOCS` map and conditionally render the banner for any `draft` doc.
- Do NOT remove the placeholder body text — it carries the explicit "replace before launch" instruction.

---

### Finding 6 (PASS) — G6: Backend source badge is present and correct

**Evidence:**
- `apps/web/src/app/(app)/app/layout.tsx:32` — `<StatusPill tone={backendMode === 'postgres' ? 'ok' : 'warn'}>{backendMode === 'postgres' ? 'postgres' : 'demo data (in-memory)'}</StatusPill>` — shown in authenticated app top bar; tone correctly differentiates postgres (ok/green) from in-memory (warn/amber)
- `apps/web/src/app/admin/page.tsx:17` — admin overview card also shows `backendMode` with `wtc-up` vs `wtc-down` class; readable to an operator
- `apps/web/src/lib/backend.ts:29` — `export const backendMode: 'postgres' | 'memory' = useDb ? 'postgres' : 'memory'` — derived from `DATABASE_URL` presence at module load time

The badge is accurate and properly scoped to authenticated screens. No issues.

---

### Finding 7 (LOW) — G2 sub-issue: Sparkline on public hero is correctly labelled but tone is misleading

**Evidence:**
- `apps/web/src/app/(public)/page.tsx:47` — `<StatusPill tone="warn">sample UI</StatusPill>` — correct
- `apps/web/src/app/(public)/page.tsx:55` — `<p ...>Illustrative sample — not live account data.</p>` — correct
- `apps/web/src/components/Sparkline.tsx:10–11` — the sparkline automatically colours green/red based on whether the last value exceeds the first, using hardcoded values `[1000, 1042, 1090, ...]` which always trends up → always renders cyan/green

The Sparkline is correctly labelled "sample UI" and "not live account data" (passing). However the hardcoded values always trend upward, so the chart always shows a green line. This creates an optimistic impression. The issue is presentational, not a product-truth deception given the labels, but worth noting.

**Recommendation:**
- No urgent action required given the labels. For future iterations, replace with a flat or realistically varied dataset, or add a comment in the data array explaining the presentational choice.

---

### Finding 8 (INFO) — G2: Bot detail page `adapter.mode` pill is the only live/mock disambiguation in the metric cards — no explicit note in card titles or subtitles

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:61–68` — eight `MetricCard` components with no data-source annotation in their label, sub-text, or card title.

The `adapter.mode` pill (line 48) is in the page header. The metric cards themselves (`MetricCard label="Wallet equity"` etc.) have no per-card indication that values are synthetic. If a user screenshots a metric card, the source context is lost.

**Recommendation (low priority):** When in mock mode, append `(mock)` to each `MetricCard` value, or add a `sub` prop like `{adapter.mode === 'mock' ? 'mock data' : undefined}`. This is secondary to Finding 2 (the banner-level fix).

## Decisions

- All findings marked G1–G5 are confirmed with file:line evidence. Finding G6 is a confirmed PASS.
- Severity hierarchy: G1 (high — public-facing always-green), G2 (high — mock metrics look live), G3 (high — mobile nav product-truth gap), G4 (medium — no availability taxonomy), G5 (medium — placeholder legal looks final).
- No speculation; every claim grounded in code read in this session.

## Risks

- Finding G1 (`ecosystem online` green pill) will confuse any demo/investor walkthrough of the platform, since the backend is definitively NOT "online" in the cloud sense — it is an in-memory demo store with no live bot/Axioma connections.
- Finding G3 (MobileNav `soon` gap) means mobile users may tap "Products" or "Support" and hit a skeleton without any prior indication — a minor trust erosion.
- Finding G5 (legal placeholder) becomes a compliance risk the moment any real user creates an account; Terms of Service and Privacy Policy being obviously placeholder is not acceptable at public launch.
- None of these are exploitable security vulnerabilities, but they directly contradict the "no fake integration — honest adapter interface" rule from AGENTS.md and the "no fake data rendered to look real" intent from the orchestrator seed.

## Verification/tests

- All evidence verified by Read/Grep against actual source files — no inferred or assumed lines.
- The `adapter.mode` badge on the bot detail page was verified at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:48`.
- The `soon` field rendering gap was verified by diffing `NavLinks.tsx:15` (renders `soon`) against the full `MobileNav.tsx` source (no reference to `.soon`).
- The `backendMode` badge correctness was verified at `app/layout.tsx:32` and confirmed against `backend.ts:29`.
- No runtime execution performed; all claims are static code analysis.

Recommended post-fix verification:
- After applying G3 fix: run `npm run e2e` (Playwright desktop + mobile). The 10 e2e tests include mobile nav checks; confirm no regression.
- After applying G1 fix: visually confirm the public top bar in both `npm run dev` (in-memory) and with DATABASE_URL set (postgres).
- After applying G5 fix: navigate `/legal/terms` and `/legal/privacy` and confirm the DRAFT banner renders above the card body.

## Next actions

Priority order for the frontend implementer:

1. **G3 (MobileNav `soon` gap) — fix first** — one-line change in `apps/web/src/components/MobileNav.tsx`; low risk, immediately testable by existing e2e.
2. **G1 (`ecosystem online` always-green) — fix second** — modify `apps/web/src/components/PublicTopBar.tsx` to derive status from `backendMode` (import from `@/lib/backend`) and adapter env flags; render `<StatusPill tone="warn">demo</StatusPill>` when not fully wired.
3. **G2 (mock bot metrics banner) — fix third** — in `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, add a `<RiskWarningBanner>` above the metric grid when `adapter.mode === 'mock'`; upgrade the pill tone to `warn` for mock. On bots list page, add a banner for mock mode instead of inline copy.
4. **G5 (legal placeholder banner) — fix fourth** — add `<RiskWarningBanner severity="warning">` to `terms` and `privacy` docs in `apps/web/src/app/(public)/legal/[doc]/page.tsx`.
5. **G4 (product availability taxonomy) — fix in Phase 1.5** — add `status` field to product copy map in `[slug]/page.tsx`; propagate to products catalog; coordinate with product-architect on canonical readiness states.
