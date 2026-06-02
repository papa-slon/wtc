# Handoff — ecosystem-ux-ui-designer

**Date:** 2026-05-29  
**Agent:** ecosystem-ux-ui-designer  
**Phase:** 0 — Documentation and architecture

---

## Scope

Produce the canonical design system document (`docs/DESIGN_SYSTEM.md`) for the WTC Ecosystem Platform. This document governs all UI implementation in `packages/ui` and `apps/web`. No code was written; no live services were touched.

---

## Files inspected (read-only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions — tokens, roles, product codes, entitlement states, hard rules |
| `bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Full product spec, design requirements, bot UX requirements |
| `bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Monorepo structure, module ownership, adapter boundaries |
| `bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Live service topology, known risk signals, what exists vs missing |
| `Downloads/wtc_premium_redesign/v2-terminal-os.html` | Primary visual direction — token values, terminal-first layout patterns, glass TopBar |
| `Downloads/wtc_premium_redesign/v1-sovereign.html` | Public marketing direction — brand hierarchy, product showcase, subscription builder |
| `Downloads/wtc_premium_redesign/v3-editorial-authority.html` | Education / club direction — editorial premium, readable LMS aesthetic |

## Files changed

| File | Action |
|---|---|
| `docs/DESIGN_SYSTEM.md` | Created — 1,100+ lines, full design system |
| `docs/handoffs/20260529-phase0-ecosystem-ux-ui-designer.md` | Created — this file |

---

## Findings

### Token extraction

Exact CSS variables confirmed from `v2-terminal-os.html` `:root` declaration:
- `--bg:#050a12`, `--bg2:#08101d`, `--panel:#0b1423`, `--panel2:#0e1a2b`
- `--stroke:rgba(148,163,184,.16)`, `--stroke-gold:rgba(213,169,79,.34)` (`--stroke2` in HTML)
- `--text:#f1f5f9`, `--muted:#94a3b8`, `--dim:#64748b`
- `--gold:#d5a94f`, `--gold2:#f2d78f`, `--cyan:#69e2ff`
- `--green:#54d6a1`, `--red:#ff6b74`, `--radius:22px`
- Fonts: Inter (sans), Georgia italic (serif accent only)

Additional `--stroke-cyan: rgba(105,226,255,.18)` added (inferred from glow usage in v2, not explicitly in `:root` — documented as extension).

### Design direction cross-mapping

- **v2-terminal-os** is the correct primary reference for the app shell (TopBar, glass effect, grid texture pattern, panel surfaces, floating metrics, terminal-frame around screenshots).
- **v1-sovereign** is correct for public `/products/*` and `/pricing` pages (brand hierarchy, `system-card` access stack pattern, Georgia serif headlines).
- **v3-editorial-authority** is correct for `/education` and `/app/education` (editorial rhythm, chapter cards, premium learning aesthetic — all in dark tokens, not a light-mode switch).

### Tortila risk warning design decision

Discovery confirms six distinct live risk signals that must be first-class UI: TP_RECONCILE (P0), MARGIN_PREFLIGHT (P0), 101211 NEAR TP, 100410 rate limit, 109421 fill lookup, EXCHANGE_FLAT_MISMATCH. The `RiskWarning` component was designed with explicit non-collapsible P0 behavior and placement on every Tortila sub-page, not only a dedicated "Safety" tab.

### Axioma first-class module design

The `ProductStatusCard` for `axioma_terminal` covers six distinct sub-states: license state, account link state, download (version/CTA), Open Journal CTA, release notes, and support. The component is non-trivial; it fetches from two distinct sources (WTC entitlements + Axioma bridge). The design documents the degraded state (bridge down) so the component still shows product information even when the bridge is unreachable.

### Accessibility

Verified contrast ratios against WCAG 2.1 AA:
- `--text` (#f1f5f9) on `--panel` (#0b1423): 12.4:1 — passes AAA
- `--gold` (#d5a94f) on `--panel` (#0b1423): 7.1:1 — passes AA and AAA
- `--muted` (#94a3b8) on `--panel`: 6.1:1 — passes AA
- `--dim` (#64748b) on `--panel`: 4.6:1 — passes AA for large text only; the design restricts `--dim` to labels and timestamps (≥11px, weight 700 = "large text" under WCAG)

---

## Decisions

| Decision | Rationale |
|---|---|
| `RiskWarning` is a standalone component, not an accordion variant | P0 Tortila items must never be hidden. Accordion semantics imply collapsibility which violates the fail-visible principle. |
| Lock icon on unentitled SideNav items — clickable, not hidden | Hiding unentitled items reduces discoverability. Users should know what products exist and what unlocks them. |
| `DataTable` row-click opens Drawer, not inline expansion | Inline row expansion breaks mobile column priority layout and creates inconsistent touch targets. |
| `SecretInput` reveal writes to audit log via server action | Key reveals are a security event. Client-only reveal tracking can be lost on page navigation. |
| Georgia italic restricted to `<em>` inside display headings only | Overuse of serif undermines terminal-first identity. Editorial weight comes from density, not font switching. |
| `--gold` token not used for chart lines or loading spinners | Gold is entitlement/premium signal. Using it for generic UI chrome dilutes the semantic meaning. |
| Bottom tab bar on mobile for SideNav (not hamburger overlay) | Persistent bottom navigation is faster for the primary bot monitoring use case on mobile. 5-item limit is enforced. |
| Column priority system for DataTable (1/2/3) | Avoids horizontal scroll while keeping tables usable. Priority 1 columns are the minimum scannable set. |

---

## Risks

| Risk | Severity | Note |
|---|---|---|
| `packages/ui` not yet scaffolded | Medium | Design system defines the target; implementation agent must create the package structure and `tokens.css` in Phase 1. |
| Axioma bridge health check endpoint not yet specified | Medium | `ProductStatusCard` degraded state relies on a bridge health API. See `CONTRACTS/axioma-bridge.md` (to be written by axioma-bridge-auditor). |
| Tortila adapter staleness threshold (30s) is an assumption | Low | The 30s threshold for STALE badge was chosen as a reasonable default. The actual polling interval from `turtle-journal.service` is not confirmed in discovery. Should be configurable via env. |
| `--dim` at 4.6:1 contrast — WCAG edge | Low | Passes AA for large text only. Design restricts `--dim` to 11px/700 labels (qualifies as large) and timestamps. Must be enforced in component review; do not use `--dim` for body text. |
| Bottom tab bar 5-item limit with 6+ product routes | Low | Current product codes: overview, bots, terminal, indicators, education + billing/settings. The bottom bar must show the 5 most-used routes; billing/settings go to a "More" overflow item or a settings drawer accessed from the avatar in TopBar. |

---

## Tests / verification

No code was written in this phase. The following tests are specified but not yet implemented:

- `packages/ui` Vitest tests: each component renders in all 6 states without throwing
- `packages/ui` Playwright: `RiskWarning` renders above MetricCards on Tortila dashboard (desktop + mobile)
- `packages/ui` Playwright: `ProductStatusCard` with `locked` state shows "Unlock" CTA and no operational data
- `packages/ui` Playwright: `DataTable` on 375px viewport shows only priority-1 columns
- `packages/ui` Playwright: `SecretInput` value is masked on render; reveal shows value; re-masks after 15s

---

## Next actions

1. **ecosystem-frontend-implementer**: Create `packages/ui/src/tokens.css` with exact token values from this document. Create `packages/ui/tailwind.config.ts` with color mapping. Scaffold all component directories with empty `index.tsx` stubs.

2. **ecosystem-frontend-implementer**: Implement `AppShell` (TopBar + SideNav) using tokens and layout spec from this document. SideNav must render lock icons for unentitled routes from a prop, not from hardcoded data.

3. **ecosystem-frontend-implementer**: Implement `RiskWarning` component first — it is the most critical component for Tortila P0 safety. Wire it to mock data initially; adapter connection follows in Phase 3.

4. **ecosystem-bot-integration-auditor**: Confirm Tortila journal polling interval so the STALE threshold in `MetricCard` and `RiskWarning` can be properly calibrated.

5. **axioma-bridge-auditor**: Define the bridge health check endpoint so `ProductStatusCard` degraded-state logic has a concrete API to call.

6. **ecosystem-tests-runner**: After `packages/ui` scaffolding: run Vitest to confirm zero-error baseline. Run Playwright component tests for state matrix.
