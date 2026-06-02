# ecosystem-ux-ui-designer handoff

## Scope

Phase 2 UX/UI Design. Epoch 20260530-0126.

Deliver `docs/UX_SPEC_PHASE2.md` (full Phase 2 surface specs) and amend `docs/DESIGN_SYSTEM.md`
(Phase 2 additions, §13). No code changes. No shared-package edits.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — design tokens, product codes, risk signal inventory, hard rules
- `docs/SESSION_PROTOCOL.md` — governance process
- `docs/DESIGN_SYSTEM.md` (pre-existing Phase 0/1 version) — full read
- `packages/ui/src/tokens.ts` — JS token values (JS runtime + chart colors)
- `packages/ui/src/components.tsx` — actual primitives exported: Card, SectionHeader, StatusPill,
  MetricCard, MetricValue, RiskWarningBanner, EmptyState, ProductStatusCard, Tone
- `packages/ui/src/index.ts` — barrel export
- `apps/web/src/app/globals.css` — mobile nav, focus ring, layout utilities
- `apps/web/src/app/(public)/page.tsx` — landing page
- `apps/web/src/app/(app)/app/page.tsx` — app cockpit
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — bot overview
- `apps/web/src/app/(app)/app/terminal/page.tsx` — Axioma terminal module
- `apps/web/src/app/(app)/app/indicators/page.tsx` — TradingView indicators
- `apps/web/src/app/(app)/app/education/page.tsx` — student education view
- `apps/web/src/app/(app)/app/billing/page.tsx` — billing and entitlements
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` — safety placeholder
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx` — equity placeholder
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` — settings placeholder
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` — backtester (mostly Phase 1)
- `apps/web/src/app/(public)/products/[slug]/page.tsx` — product page
- `apps/web/src/app/(public)/pricing/page.tsx` — pricing page
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard
- `apps/web/src/app/teacher/courses/page.tsx` — teacher course list placeholder
- `apps/web/src/app/admin/system-health/page.tsx` — system health placeholder
- `downloads/wtc_premium_redesign/v2-terminal-os.html` — design direction reference (terminal-first)

---

## Files changed

- `docs/DESIGN_SYSTEM.md` — appended §13 (Phase 2 Amendments): new composite components, WarnBanner
  alias, ProductCard formalisation, implementation gap table, mock/dev banner placement rule
- `docs/UX_SPEC_PHASE2.md` — created; full Phase 2 surface specs (see Findings §1 for scope)

---

## Findings

### 1. Deliverable scope

`docs/UX_SPEC_PHASE2.md` specifies all Phase 2 surfaces, in 12 sections:

| Section | Surfaces |
|---|---|
| §2 Public pages | `/products/[slug]`, `/pricing`, `/` (homepage) |
| §3 Bot dashboards | Overview, Positions, Trades, Equity, Safety, Config, Backtester, Compare |
| §4 App cockpit | `/app` overview page |
| §5 Axioma Terminal | `/app/terminal` app module + `/products/terminal` public page |
| §6 TradingView | `/app/indicators` + full state flow |
| §7 Education LMS | Student, Teacher dashboard, Teacher course editor, Admin education |
| §8 Billing | `/app/billing` entitlement cards + plan grid + renewal flow spec |
| §9 Admin | System health, TradingView admin queue |
| §10 Key vault | `ExchangeKeyVaultForm` in a Drawer, security constraints |
| §11 Responsive | Navigation, table, form, chart, hero — per-breakpoint rules |
| §12 Warning index | 24 named warning treatments, triggers, components, dismissibility |

### 2. New components required (DESIGN_SYSTEM.md §13.1)

18 new composite components are catalogued. The 5 most immediately load-bearing for the
implementation sprint:

| Component | Blocking which pages |
|---|---|
| `BotSubNav` | All bot sub-pages (Equity, Safety, Settings currently placeholders) |
| `EquityChart` | Bot equity tab |
| `ExchangeKeyVaultForm` | Bot settings / security |
| `EntitlementGate` | Any page where `access.allowed === false` |
| `PricingTable` | `/pricing` Phase 2 |

### 3. Phase 1 implementation gaps — found

| Gap | Location | Severity |
|---|---|---|
| Bot equity, safety, settings, trades, positions sub-pages are `BotSubPagePlaceholder` | `apps/web/src/app/(app)/app/bots/[bot]/{equity,safety,settings,trades,positions}/page.tsx` | Medium — no runtime failure, but spec is missing |
| Teacher course list + editor is Placeholder | `/teacher/courses/page.tsx`, `/teacher/courses/[id]/page.tsx` | Medium |
| System health is Placeholder | `/admin/system-health/page.tsx` | Medium |
| Bots index (`/app/bots`) is Placeholder | (not in the file glob, but referenced) | Medium |
| Public product pages are minimal (2 cards, no feature grid) | `/products/[slug]/page.tsx` | Low — functional |
| Pricing page has no feature comparison matrix | `/pricing/page.tsx` | Low — functional |
| Homepage `Sparkline` warning is `wtc-dim` paragraph below metric grid, not a `DevPlaceholderBanner` above it | `(public)/page.tsx` line 55 | Low — correctness |
| `SecretInput` specified in DESIGN_SYSTEM.md §7.6 but not exported from `packages/ui/src/index.ts` | `packages/ui/src/index.ts` | Low — future use |
| `DataTable` component specified in DESIGN_SYSTEM.md §7.5 but all tables use raw `<table className="wtc-table">` | Multiple pages | Low — consistent but not componentised |

### 4. Risk signal display compliance — verified

The Phase 1 bot overview page renders `RiskWarningBanner` for `health.warnings` correctly.
The mock adapter disclaimer appears as a `RiskWarningBanner severity="warning"` above the
MetricCards. The P0 items (TP_RECONCILE, MARGIN_PREFLIGHT) are surfaced from
`TORTILA_WARNINGS` on the app cockpit. These are compliant with the "fail-visible" principle.

The Safety tab is a Placeholder — Phase 2 spec provides the full expanded treatment.
Until the Safety tab is implemented, the compact summary on the Overview tab plus the
cockpit-level P0 notice remains the primary risk surface. This is acceptable for Phase 2 but
must be closed before any production bot monitoring scenario.

### 5. Axioma module — compliance verified

The existing `/app/terminal/page.tsx` correctly:
- Shows `DevPlaceholderBanner` equivalent when `isDev`
- Shows `BridgeErrorBanner` when bridge unreachable
- Shows entitlement warning when `!access.allowed`
- Never renders as a bare link
- Explicitly notes "WTC never receives exchange keys"

Phase 2 adds: `AxiomaAccountLinkDrawer` step-by-step flow, `ReleaseNotesAccordion`,
and the full state matrix with grace period treatment.

### 6. Token compliance

The existing `packages/ui/src/tokens.ts` is fully aligned with the locked palette.
One addition found: `amber: '#f5c451'` — this color is not in the locked palette.
It is used only in the JS token map (not in any CSS variable). It should be treated as an
alias for `--gold2` (#f2d78f) in UI contexts, or removed if unused. No action required by
this agent (design-only scope), but noted for the implementer.

---

## Decisions

1. The `BotSubNav` sticky tab strip renders **above** the RiskWarning compact summary, not inside
   any tab. This ensures P0 warnings are visible regardless of which tab is active. This is the
   only compliant interpretation of the "fail-visible" principle for multi-tab bot dashboards.

2. The Safety tab (Tortila) does not have a dismissal affordance for P0 items. There is no
   "acknowledged" state that changes the visual. The P0 item card shows "Open — pending resolution"
   until the adapter fix ships. This is a design decision, not a UX oversight.

3. The `ExchangeKeyVaultForm` renders inside a `Drawer` always — never inline on a page — to
   prevent the risk of the DOM containing plaintext key values in a scrollable, screenshottable
   context.

4. Backtester `EmptyState` carries the sentence "The platform never fabricates an equity curve" as
   literal required copy, not a suggestion. This must appear verbatim.

5. `terminal-frame` pattern from v2-terminal-os.html is used for product page heroes and the
   homepage right column. It is not used elsewhere (no decorative terminal frames on admin pages,
   settings pages, or any operational dashboard).

6. The pricing table uses a feature matrix on desktop (column-per-plan) and Accordion-per-plan on
   mobile. No horizontal scroll is permitted on mobile.

7. Public product pages are SSG/ISR — no client-side loading states apply to their main content.
   Only the PricingSnapshot CTA buttons have a state dependency (authenticated vs not).

---

## Risks

| Risk | Mitigation in spec |
|---|---|
| `SecretInput` not yet exported — implementer builds inline `<input type="password">` | DESIGN_SYSTEM.md §13.4 gap table lists this; spec requires `SecretInput` with 15s reveal + audit log |
| Bot sub-pages are placeholders — implementer unfamiliar with `BotSubNav` ordering | UX_SPEC_PHASE2.md §3.1 specifies all tabs, priority, disabled state, and badge logic |
| Axioma `AxiomaAccountLinkDrawer` step 2 polling — implementer may implement client-side only | Spec §5.1 notes "polls the bridge health every 5s (max 60s)" — bridge polling must be server-side to avoid CORS and bridge secret exposure |
| `amber: '#f5c451'` in tokens.ts diverges from locked palette | Flag to implementer — alias to `gold2` or remove |
| `CompareAnalyticsView` requires data from two separate adapters | If one adapter is down, spec requires graceful column-level ErrorState, not a full-page error |
| Teacher object-ownership enforcement: admin can view any course via `/teacher/courses/[id]` | Spec §7.3 notes "admin can view any course" — implementation must check role before allowing edits |

---

## Verification / tests

This is a design-only agent. No tests are run.

Design spec correctness is verified by:
- Cross-referencing every warning trigger against `BOT_CONTROL_SAFETY_MODEL.md` risk signal list
  (from seed discovery snapshot)
- Cross-referencing every entitlement state badge against the state machine in
  `ENTITLEMENT_STATE_MACHINE.md`
- Confirming the 6-state matrix (idle/loading/success/error/disabled/empty) is defined for every
  new component in UX_SPEC_PHASE2.md
- Confirming no locked token is violated (all color references in UX_SPEC_PHASE2.md use the 13
  locked tokens only)
- Confirming the `DevPlaceholderBanner` placement rule is stated at the top of every section
  where mock/dev data can appear

---

## Next actions

For the **frontend implementer**:

1. Build `BotSubNav` component — enables all currently-Placeholder bot sub-pages to be staffed.
2. Build `EquityChart` (ChartWrapper + dual series spec) — unblocks the Equity tab.
3. Build `EntitlementGate` — formalises the currently ad-hoc gate pattern into a reusable component.
4. Build `ExchangeKeyVaultForm` in `Drawer` with `SecretInput` — prerequisite for Config tab.
5. Implement `/app/bots/[bot]/equity`, `/safety`, `/settings`, `/positions`, `/trades` per
   UX_SPEC_PHASE2.md §3.3–3.7.
6. Implement `/app/bots` compare view per §3.9.
7. Implement public product pages per §2.1 — `ProductFeatureGrid`, `terminal-frame` hero, `AccessFlow`.
8. Implement `/pricing` `PricingTable` per §2.2.
9. Implement `/teacher/courses/[id]` `TeacherCourseEditor` per §7.3.
10. Implement `/admin/system-health` per §9.1.
11. Fix homepage `Sparkline` warning placement (move `DevPlaceholderBanner` above metrics grid,
    inside the terminal-frame, as first element). This is a one-line location change.
12. Export `SecretInput` from `packages/ui/src/index.ts` (or confirm it is not yet built and add
    to build backlog).
13. Audit `amber: '#f5c451'` usage in tokens.ts — alias to `gold2` or remove.
