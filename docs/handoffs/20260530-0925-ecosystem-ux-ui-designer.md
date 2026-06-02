# ecosystem-ux-ui-designer handoff

## Scope

Phase 2.1 UX/UI component specification. Epoch 20260530-0925.

Read-only audit of all existing code and documentation. Produces a concrete, implementer-ready
component specification for every Phase 2.1 surface: LMS (student/teacher/admin), billing,
bot config/safety, Axioma terminal module, TradingView access, admin tables/health, support
thread, and notification list. Specifies exact reuse vs new-build decisions, state matrices,
honesty labels, and responsive patterns. No code changes.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — locked tokens, product codes, risk signals, hard rules
- `docs/SESSION_PROTOCOL.md` — governance process
- `docs/handoffs/20260530-0126-ecosystem-ux-ui-designer.md` — Phase 2 design handoff (prior epoch)
- `docs/DESIGN_SYSTEM.md` — full design system including Phase 2 §13 amendments
- `docs/UX_SPEC_PHASE2.md` — Phase 2 surface specifications (all 12 sections + 24-condition warning index)
- `apps/web/src/components/BotSubNav.tsx` — existing BotSubNav: server component, TABS array, active link styling
- `apps/web/src/components/BotSubPagePlaceholder.tsx` — entitlement-guarded placeholder (still used by settings)
- `apps/web/src/components/Placeholder.tsx` — generic placeholder (used by admin/education, admin/bots, admin/users, admin/products, teacher/courses)
- `apps/web/src/components/NavLinks.tsx`, `PublicTopBar.tsx`, `MobileNav.tsx` — nav surface components
- `apps/web/src/features/bots/data.tsx` — loadBot(), BotAccessRequired(), sectionToSeg() helpers
- `apps/web/src/features/bots/meta.ts` — BotMeta, BOT_CAPS, BotCapabilities, capLabel()
- `apps/web/src/app/globals.css` — utility classes: wtc-row, wtc-spread, wtc-stack, wtc-mobile-nav
- `apps/web/src/app/(public)/page.tsx` — homepage: terminal-frame mockup, sample label placement
- `apps/web/src/app/(app)/app/page.tsx` — app cockpit: ProductStatusCard grid, OperationalNotices
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — bot overview: full composition, BotSubNav, RiskWarning
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx` — positions tab (implemented)
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx` — trades tab (implemented)
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx` — equity tab (implemented, no chart yet)
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` — safety tab (implemented)
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` — settings tab (BotSubPagePlaceholder)
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` — backtester (Phase 1 mostly done)
- `apps/web/src/app/(app)/app/terminal/page.tsx` — Axioma terminal module (Phase 1 well-structured)
- `apps/web/src/app/(app)/app/billing/page.tsx` — billing (functional dev-only mock)
- `apps/web/src/app/(app)/app/indicators/page.tsx` — TV indicators (Phase 1 functional)
- `apps/web/src/app/(app)/app/education/page.tsx` — student education (Phase 1 minimal)
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard (Phase 1 functional)
- `apps/web/src/app/teacher/courses/page.tsx` — teacher courses list (Placeholder)
- `apps/web/src/app/admin/page.tsx` — admin overview (functional)
- `apps/web/src/app/admin/system-health/page.tsx` — system health (Placeholder)
- `apps/web/src/app/admin/tradingview-access/page.tsx` — TV admin queue (functional)
- `apps/web/src/app/admin/entitlements/page.tsx` — entitlements admin (functional)
- `apps/web/src/app/admin/audit-log/page.tsx` — audit log (functional)
- `apps/web/src/app/admin/users/page.tsx` — user directory (Placeholder)
- `apps/web/src/app/admin/education/page.tsx` — education moderation (Placeholder)
- `apps/web/src/app/admin/bots/page.tsx` — bot fleet admin (Placeholder)
- `apps/web/src/app/admin/products/page.tsx` — products/plans admin (Placeholder)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. Severity map key

| Severity | Meaning |
|---|---|
| HIGH | Visible gap between spec and code; user-facing honesty or safety concern |
| MEDIUM | Missing surface; spec exists, code is Placeholder |
| LOW | Composition improvement; no honesty/safety impact |

---

### 2. (HIGH) Settings tab is BotSubPagePlaceholder — config wizard entirely absent

`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` line 1–6 renders
`BotSubPagePlaceholder` with no form, no config viewer, no ExchangeKeyVaultSection.
An entitled user sees the stub "Planned for a later phase" empty state with no context.

This is the highest-priority gap. All spec exists in `docs/UX_SPEC_PHASE2.md §3.7`.
The Config tab is the only surface where exchange account links are managed (via
`ExchangeKeyVaultForm` in a `Drawer`). Until it is built, there is no UI path for
a user to associate an exchange account with their bot.

Recommendation: Build `AccordionConfigForm` (read-only, all fields disabled) as the first step.
The live-write path stays disabled until adapter audit passes. Components needed:
`SymbolEditor` (read-only), `RiskEditor` (read-only), `ExchangeKeyVaultSection` (table +
"Add account" CTA opening the vault Drawer in preview-only mode). See component spec §A.7 below.

---

### 3. (HIGH) Equity tab has data but no chart — equity curve renders as raw table

`apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx` lines 46–68 renders a raw
`<table className="wtc-table">` with timestamped rows. No `EquityChart` (`ChartWrapper` +
dual equity/drawdown series) is present.

The spec at `docs/UX_SPEC_PHASE2.md §3.5` requires the `EquityChart` composite with:
- Primary series: equity curve `--cyan`
- Secondary series: drawdown % on a secondary Y-axis `--red`
- Time range pill tabs: 7D / 30D / 90D / All

The current raw table is correct for an intermediate state but is not the final surface.
The empty state text "The curve is never fabricated" must be present in `EmptyState.hint` —
it currently says this but in a slightly different phrasing. The exact required sentence
"The platform never fabricates an equity curve" must appear verbatim in the EmptyState hint
when no artifact exists (both here and in the backtester Results card).

Recommendation: Build `EquityChart` component; replace raw table with it. The table can
remain below the chart as `DrawdownTable` (top 5 drawdown events).

---

### 4. (HIGH) Homepage terminal-frame sample label is in wtc-dim paragraph, not DevPlaceholderBanner

`apps/web/src/app/(public)/page.tsx` line 56: `<p className="wtc-dim" style={{ fontSize: 11 }}>Illustrative sample — not live account data.</p>`

This label is below the MetricCard grid in `--dim` 11px — easy to miss, visually subordinate to
the metrics. The spec (`docs/UX_SPEC_PHASE2.md §2.3`) requires a `DevPlaceholderBanner`
(styled as `RiskWarningBanner severity="info"`) placed inside the terminal frame above
the metrics grid as the first element inside the card.

Also noted: the amber dot in the terminal-frame macOS decorative bar (line 43) uses
`#f5c451` — the unlocked `amber` token flagged in the prior handoff. This is acceptable in
this decorative context but should be aliased to `--gold2` (#f2d78f) for consistency.

Recommendation: Move the sample label to a `RiskWarningBanner severity="info"` with title
"Sample UI" and detail "Illustrative — not live account data." Place it as first child of
the terminal-frame Card, before Sparkline and MetricCards.

---

### 5. (HIGH) Teacher course list is Placeholder — no lesson editor accessible from teacher flow

`apps/web/src/app/teacher/courses/page.tsx` renders `Placeholder`. The teacher flow from
`/teacher` shows course titles but no "Edit" link to `/teacher/courses/[id]`. The
`MyCoursesList` spec (§7.2) requires each course item to have an "Edit" link.

Currently a teacher who creates a course cannot navigate to edit it or add lessons.
The lesson editor (`/teacher/courses/[id]`) route exists in the filesystem but renders
`Placeholder` with only a back link.

Recommendation: This is two tasks — (a) add "Edit" links to `/teacher/courses/[id]` in the
teacher overview page, and (b) build `TeacherCourseEditor` at `/teacher/courses/[id]`.
Task (a) is a single-line change. Task (b) requires new components. See §A.9 below.

---

### 6. (HIGH) Admin system-health, admin/users, admin/education, admin/bots, admin/products are all Placeholder

Five admin pages render `Placeholder`:
- `apps/web/src/app/admin/system-health/page.tsx` — critical operational surface
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/products/page.tsx`

The system-health page is the most critical of these. The spec (§9.1) requires a
`ServiceHealthGrid` with 4 service cards (Tortila journal, Legacy bot, Axioma bridge, WTC DB),
a `WorkerStatusCard`, and a `RiskEventsLog` table. Without this, there is no operational
monitoring surface in the app.

Recommendation: Build system-health first (highest operational value). User directory and
education moderation second (needed for support/admin flows). Bot fleet and products admin
are lower priority (products are code-defined; bot fleet is read-only monitoring).

---

### 7. (HIGH) Safety tab uses BotSubPagePlaceholder pattern but was promoted to full implementation — verify complete

`apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` is implemented but the spec requires
additions beyond what is in the file. Specifically:

The current implementation (lines 37–53) renders `RiskWarningBanner` per warning item inside
a `Card title="Risk & audit warnings"`. The spec (§3.6) requires two additional elements not
present:

1. `P0ItemCards` — one `Card variant="warning"` per unresolved P0 item with a "Report issue"
   link to `/app/support?product=tortila_bot&issue=<code>`. The current implementation has no
   per-item cards, just banners inside a single card.
2. `SafetyEventLog` — a full `DataTable` with columns: Timestamp, Event type, Code, Symbol,
   Detail. Row click opens a Drawer with event JSON. Currently missing entirely.

The "What this means" Accordion within each P0 banner (linking to BOT_CONTROL_SAFETY_MODEL.md)
is also specified but not yet present.

Recommendation: The safety tab is functional but not complete. Add `SafetyEventLog` and
`P0ItemCards` with "Report issue" links. The support link anchor (`/app/support`) requires
the support route to exist — see Finding 11.

---

### 8. (MEDIUM) Axioma terminal module missing AxiomaAccountLinkDrawer and ReleaseNotesAccordion

`apps/web/src/app/(app)/app/terminal/page.tsx` has a "Connect Axioma account" button
(line 61) that is a plain `<button>` with no Drawer, no step wizard, no polling.

The spec (§5.1) requires `AxiomaAccountLinkDrawer` — a `Drawer size="md"` with a 3-step
`SetupWizard`: (1) Open Terminal and copy link code, (2) Awaiting confirmation with 5s polling
(60s max), (3) Success confirmation with auto-close.

`ReleaseNotesAccordion` (last 3 releases) is also absent — release notes are shown inline as
a bullet list, not as individual collapsible accordion items.

Recommendation: Build `AxiomaAccountLinkDrawer` (blocking the account-link flow) and
`ReleaseNotesAccordion` (lower priority — cosmetic improvement). The Drawer's step-2 polling
MUST be server-side (the bridge health check requires the signing secret; never client-fetch).

---

### 9. (MEDIUM) LMS student view lacks CourseCard composition and lesson navigation

`apps/web/src/app/(app)/app/education/page.tsx` renders course content as `<Card title={c.title}>` +
an ordered list of lessons (`<ol>`). There is no `CourseCard` component with:
- Progress bar (enrollment % complete)
- "Continue lesson" CTA → next uncompleted lesson
- Chapter number kicker in `--gold2`
- Editorial typography (heading-xl 24px per v3 reference)

The lesson page route `/app/education/[courseId]/lessons/[lessonId]` does not appear to exist
yet (not in the file glob results). Without it, the student experience ends at the course list.

Recommendation: Build `CourseCard` component. Create the lesson page route with the reading
layout spec (max-width 780px, body-lg, video embed, materials section, progress toggle,
prev/next navigation). This is blocking for student product experience.

---

### 10. (MEDIUM) Billing page PlanGrid uses raw Card + inline price placeholder, no bundle distinction

`apps/web/src/app/(app)/app/billing/page.tsx` lines 61–71 renders `Card` components for all
plans in a `wtc-grid-3` without visual distinction between single-product plans and bundle
plans. `bundle_pro` and `bundle_starter` must use `Card variant="gold"` per the spec (§8).

The "Already active" disabled state for a plan the user already holds is not implemented —
all plan cards show the "Activate (mock · dev)" button regardless of current entitlement state.
This means a user with an active tortila_monthly plan sees the same button as a new user,
with no indication that it is already active.

Recommendation: In the PlanGrid, cross-reference `ents` to check if any entitlement's
`planCode` matches the plan being rendered. If matched and `active/grace`, show a disabled
`Button variant="ghost"` "Already active". Apply `Card variant="gold"` for bundle plans.

---

### 11. (MEDIUM) Support route (/app/support) does not exist

The spec (§3.6, P0ItemCards) requires a "Report issue" link to `/app/support?product=...&issue=...`.
The warning index (§12) references support threads as a first-class surface. No
`/app/support` route is visible in the codebase glob.

`SupportTicketForm` is listed in `DESIGN_SYSTEM.md §13.1` as a required new component
(ticket creation: title, body, product selector). Without the route and form, the P0 item
"Report issue" links have no destination.

Recommendation: Create `/app/support` route with `SupportTicketForm` component. This is a
blocker for the P0 item deep-links from the Safety tab. Minimal viable implementation:
a form with TextInput title, Textarea body, Select product selector, and a server action
that writes a `support_tickets` row. The full thread view is lower priority.

---

### 12. (MEDIUM) Notifications route (/app/notifications) does not exist

No notifications surface appears in the codebase. The SideNav spec (DESIGN_SYSTEM.md §7.2)
includes an alert badge on the notification bell in the TopBar. There is no
`notifications` table consumer in the web app.

Recommendation: Create `/app/notifications` route with a `DataTable` of notification rows
(timestamp, product, type, message, read state). The bell badge in TopBar shows unread count.
A server action marks-as-read on row click or "Mark all read" button. This is low priority
relative to the P0 and missing admin surfaces but blocks the TopBar bell from being functional.

---

### 13. (MEDIUM) /app/bots (compare/analytics view) is missing entirely — no route found

No `/app/bots/page.tsx` or equivalent index route appears in the glob results. The spec (§3.9)
requires a `CompareAnalyticsView` side-by-side metric grid for Tortila vs Legacy bots,
with a `CompareEquityChart` dual series. The SideNav item "My Products / Bots index" would
navigate to this page.

Recommendation: Create `/app/bots/page.tsx` with the compare view. It loads both bot adapters
and renders a `wtc-grid-2` with each bot's `MetricCard` column. If one bot is unentitled,
that column shows `EntitlementGate`. If one adapter is down, that column shows `ErrorState`
with last-known cached values and `[STALE]` badge. See component spec §A.11 below.

---

### 14. (LOW) BotSubNav missing capability-based tab disabling

`apps/web/src/components/BotSubNav.tsx` lines 4–12: `TABS` array is static — every tab renders
for every bot. The spec (§3.1) requires:
- Safety tab: present for Tortila, absent (or hidden) for Legacy
- Backtester tab: present for Tortila, disabled (`--dim`, `not-allowed` cursor) for Legacy
- Count badge on Positions tab if `positions.length > 0`
- Red count badge on Safety tab if `active warnings > 0`

Currently `BotSubNav` is a server component that receives only `bot` and `active` strings.
It cannot conditionally disable tabs or show badges without receiving counts.

Recommendation: Extend the `BotSubNav` props to receive:
```ts
interface BotSubNavProps {
  bot: string;
  active: string;
  caps: BotCapabilities;  // from meta.ts — already defined
  positionCount?: number;
  warningCount?: number;
}
```
This is a server component change — the calling pages already load `BOT_CAPS` and health data.
Pass counts down to `BotSubNav` from the page. No client hook needed.

---

### 15. (LOW) DataTable component not yet built — all tables use raw <table> with wtc-table class

DESIGN_SYSTEM.md §7.5 specifies `DataTable` with typed `Column<T>` definitions, column priority
hiding on mobile, row-click Drawer, sort indicators, and pagination. All current table
implementations use inline `<table className="wtc-table">` with hardcoded columns and no
priority system or Drawer on row click.

This means every table breaks identically on mobile: all columns show regardless of screen
width, and row detail (positions, trades, safety events) is not accessible via Drawer.

Recommendation: Build `DataTable` component. Priority: highest-traffic tables first:
1. Positions table (always visible to bot users)
2. Trades table (same)
3. Safety events table
4. Entitlements table in billing
5. Admin tables

The Drawer pattern for row detail is blocking mobile UX for positions and trades.

---

### 16. (LOW) EntitlementGate component not built — gate logic is ad-hoc per-page

Every page currently implements entitlement gating differently:
- Bot overview: `if (!access.allowed) return <div>...RiskWarningBanner...</div>`
- Education: `if (!access.allowed) return <div>...RiskWarningBanner...</div>`
- Backtester: `if (!access.allowed) return <div>...RiskWarningBanner...</div>`

DESIGN_SYSTEM.md §13.1 specifies `EntitlementGate` as a reusable component that wraps content
and renders a standardized locked state with product description, entitlement state badge,
reason text, and billing CTA. `BotSubPagePlaceholder` approximates this but is bot-specific.

Recommendation: Build `EntitlementGate` component. Migrate all ad-hoc gates to use it.
The `BotAccessRequired` function in `features/bots/data.tsx` is the closest existing pattern
and can become the reference implementation.

---

### 17. (LOW) Admin TV queue grant/revoke actions use inline forms without confirmation Drawer

`apps/web/src/app/admin/tradingview-access/page.tsx` lines 61–63: "grant" and "revoke" are
inline form buttons with no confirmation step. The spec (§9.2) requires a `Drawer size="sm"`
confirmation for both actions, showing the username and WTC user email before committing.

This is an admin surface — a mistaken grant or revoke has no server-side undo in the current
implementation. The Drawer confirmation is a safety affordance, not just UX polish.

Recommendation: Wrap grant/revoke in `Drawer size="sm"` with summary + Confirm/Cancel.
Confirm triggers the existing server action.

---

### 18. (LOW) Backtester form uses raw <input> / <select> elements, not formal Form components

`apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` lines 48–56: form fields are
raw `<input className="wtc-input">` and `<select className="wtc-input">`. The spec (§3.8)
requires formal `TextInput`, `Select`, and `NumberStepper` components from `packages/ui`.
This is a low-priority cosmetic issue as the form is currently non-functional (buttons disabled).

---

### 19. (LOW) Billing entitlements table is raw <table>, not DataTable — no mobile Drawer

`apps/web/src/app/(app)/app/billing/page.tsx` lines 41–56: raw `<table className="wtc-table">`.
On mobile, all 4 columns show. The spec (§8) requires priority columns (Product, Status always;
Plan, Renews on tablet+). Row click should open Drawer with full entitlement detail including
renewal CTA per status. The `Renew now` / `Reactivate` / `Contact support` CTAs per
entitlement state are also absent.

---

### 20. (LOW) amber #f5c451 token still in use in landing page terminal frame

`apps/web/src/app/(public)/page.tsx` line 43: `background: '#ff6b74'` (red dot — correct),
line 44: `background: '#f5c451'` (amber — this is the unlocked token from `tokens.ts`,
not in the locked palette). Flagged in the prior handoff. Should be `var(--gold2)` (#f2d78f).

---

## Decisions

### D-1: Component build priority order for Phase 2.1

Priority is determined by: user-facing safety/honesty gaps first, then operational surfaces,
then polish. The implementer should work in this order:

**Tier 1 — Safety/honesty gaps (implement first):**
1. Homepage terminal-frame sample label: move to `RiskWarningBanner severity="info"` inside
   the frame, above metrics. One-line position change + component swap.
2. `BotSubNav` prop extension: add `caps`, `positionCount`, `warningCount` — enables
   capability-based tab hiding and count badges for Tortila.
3. Billing `PlanGrid`: add bundle card distinction (`Card variant="gold"`) and "Already active"
   disabled state. Cross-reference entitlements.

**Tier 2 — Missing surfaces that block user flows:**
4. `/teacher/courses/[id]` — `TeacherCourseEditor` with lesson CRUD
5. `/app/support` — `SupportTicketForm` route (blocks P0 "Report issue" deep-links)
6. `/app/bots/[bot]/settings` — `AccordionConfigForm` read-only + `ExchangeKeyVaultSection`
7. `EquityChart` component + replace raw equity table with it
8. `CourseCard` component + student lesson page `/app/education/[courseId]/lessons/[lessonId]`
9. `/admin/system-health` — `ServiceHealthGrid` + `WorkerStatusCard` + `RiskEventsLog`

**Tier 3 — Composition improvements:**
10. `DataTable` component — migrate positions, trades, safety events, entitlements tables
11. `EntitlementGate` component — migrate ad-hoc gates
12. `AxiomaAccountLinkDrawer` — wraps existing "Connect account" button
13. `ReleaseNotesAccordion` — replaces inline bullet list in terminal module
14. `/app/bots` compare view — `CompareAnalyticsView`
15. `/app/notifications` route + bell badge
16. Admin TV queue grant/revoke Drawer confirmations
17. Admin user directory, admin education moderation, admin bot fleet

---

### D-2: Component reuse vs new-build matrix

| Surface | Components to reuse | Components to build |
|---|---|---|
| Bot settings Config tab | `BotSubNav`, `loadBot`, `BotAccessRequired`, `Card`, `Accordion`, `Toggle`, `RangeSlider`, `NumberStepper`, `SecretInput`, `Drawer`, `DevPlaceholderBanner` | `AccordionConfigForm`, `SymbolEditor`, `RiskEditor`, `ExchangeKeyVaultForm`, `ExchangeKeyVaultSection` |
| Equity tab (chart) | `BotSubNav`, `MetricCard`, `ChartWrapper`, `EmptyState`, `SkeletonChart` | `EquityChart` (ChartWrapper specialisation) |
| Safety tab (completion) | `BotSubNav`, `RiskWarningBanner`, `DataTable`, `Drawer`, `Badge` | `SafetyEventLog`, `P0ItemCard` |
| Teacher course editor | `Card`, `TextInput`, `Textarea`, `Toggle`, `Select`, `Button`, `Drawer`, `StatusPill` | `TeacherCourseEditor`, `LessonEditorDrawer` |
| Student course grid | `Card`, `EmptyState`, `StatusPill`, `SectionHeader` | `CourseCard`, `ProgressBar` |
| Student lesson page | `Card`, `Toggle`, `Button` | `LessonPage` layout component |
| Billing | `Card`, `DataTable`, `StatusPill`, `Button`, `EmptyState` | bundle `Card variant="gold"`, entitlement Renew CTAs |
| Axioma terminal | `Card`, `Drawer`, `SetupWizard`, `Accordion`, `Button`, `RiskWarningBanner` | `AxiomaAccountLinkDrawer`, `ReleaseNotesAccordion` |
| Admin system-health | `Card`, `MetricCard`, `DataTable`, `RiskWarningBanner`, `Badge` | `ServiceHealthGrid`, `WorkerStatusCard` |
| Notifications | `DataTable`, `Button`, `SectionHeader` | notifications list route, TopBar bell badge |
| Support | `Card`, `TextInput`, `Textarea`, `Select`, `Button`, `SectionHeader` | `SupportTicketForm`, support route |
| Compare view | `MetricCard`, `EntitlementGate`, `ChartWrapper`, `ErrorState` | `CompareAnalyticsView`, `CompareEquityChart` |

---

### D-3: Logic boundary rule (re-confirmed)

No business logic enters React component files. The established pattern in `features/bots/data.tsx`
is the canonical model:
- Page components call `loadBot()`, `accessFor()`, `adapter.get*()` (all server-side)
- They pass typed props to presentational components
- Presentational components receive data; they never query or mutate

For the new surfaces, this maps to:

```
/app/bots/[bot]/settings/page.tsx        → loadBot() → accessFor() → adapter.getConfig()
                                         → passes ConfigShape to AccordionConfigForm
AccordionConfigForm                      → purely presentational, no queries

/teacher/courses/[id]/page.tsx           → lmsService.getCourse() → lmsService.listLessons()
                                         → passes CourseShape, LessonShape[] to TeacherCourseEditor
TeacherCourseEditor                      → purely presentational, accordion composition

/app/support/page.tsx                    → getCurrentUser() → queries support_tickets
                                         → passes tickets[] to SupportTicketForm + SupportThreadList
SupportTicketForm                        → purely presentational, server action for submit
```

---

### D-4: Null-to-em-dash rule is mandatory everywhere

Current code correctly uses `fmtMoney()`, `fmtDate()`, `fmtNum()`, and `MetricValue` for
null-safe rendering. The `fmtDate(null)` → `"—"` pattern is already in `apps/web/src/lib/format.ts`.

New components must follow the same rule. No new component may render:
- `0.00` as a placeholder for "no data"
- `$0.00` as wallet equity when data has not loaded
- An empty string where a value was expected

The `MetricCard` error state renders `—` (em dash) in `--dim`. All new composite components
that wrap `MetricCard` inherit this behaviour automatically.

The `DataTable` (when built) must render `—` for any null cell value, never `"0"` or `""`.

---

### D-5: Honesty labels are non-negotiable placement rules

The following labels must appear at their specified positions regardless of entitlement state
or data state. They cannot be moved below data, placed in accordions, or conditionally hidden.

| Label | Mandatory placement | Component | Trigger |
|---|---|---|---|
| "Simulated data — not a live account" | First child of main content area, before MetricCards | `DevPlaceholderBanner` | `adapter.mode === 'mock'` |
| "Dev placeholder — not a live endpoint" | First child of main content area | `DevPlaceholderBanner` | `axiomaBridgeIsDev()` |
| "Storage: in-memory (dev) — resets on restart" | StatusPill row immediately below SectionHeader | `StatusPill tone="warn"` + note | `backendMode !== 'postgres'` |
| "Mock checkout — hard disabled in production" | First child of billing page | `RiskWarningBanner severity="warning"` | billing page always in dev |
| "Dev placeholder" (Axioma account link Drawer) | First element inside Drawer, above step 1 | `DevPlaceholderBanner` | `isDev` |
| "Config writes disabled — audited adapter required" | First element of Config tab content | `DevPlaceholderBanner` | always (Phase 2) |
| "Key vault writes are gated until the audited adapter ships" | Inside ExchangeKeyVaultForm Drawer | `DevPlaceholderBanner` | always (Phase 2) |
| "The platform never fabricates an equity curve" | Backtester Results EmptyState hint | `EmptyState hint=` | no artifact uploaded |
| "'Stop' does not close positions" | Below bot control buttons, always visible | `<p className="wtc-dim">` | always |
| "Illustrative sample — not live account data" | Inside homepage terminal frame, above metrics | `RiskWarningBanner severity="info"` | always |

---

### D-6: ExchangeKeyVaultForm is always inside a Drawer

This decision is carried forward from the Phase 2 epoch handoff (Decision 3). Rationale:
the Drawer prevents the DOM from containing plaintext key values in a scrollable, full-page,
screenshottable context. The Drawer content is isolated and the form never renders inline.

In Phase 2.1, the Drawer opens in preview-only mode (all fields disabled, save button
disabled). The implementer must still build the full form anatomy so the UX is reviewable
and the pattern is established before live writes are enabled.

---

### D-7: Safety P0 items have no dismissal/acknowledgement affordance

TP_RECONCILE and MARGIN_PREFLIGHT are open architectural gaps in the Tortila adapter, not
user-configuration issues. There is no UI affordance to mark them as "acknowledged" or
"understood." The `Card variant="warning"` for each P0 item shows "Open — pending resolution"
and remains visible until the adapter fix ships. This is not a UX bug — it is the correct
"fail-visible" implementation.

---

### D-8: Axioma bridge polling in AxiomaAccountLinkDrawer must be server-side

The account link step-2 polling (check bridge health every 5s, max 60s) must use a server
action or server-side route handler. The bridge health endpoint requires `AXIOMA_HANDOFF_SIGNING_SECRET`.
If polling is implemented client-side (via `fetch()` from the browser), the signing secret
would need to be exposed to the client — this is forbidden by the architecture.

Pattern: a server action `checkAxiomaLinkStatus(userId)` that calls the bridge and returns
`{linked: boolean, error?: string}`. The client calls this action on an interval, not the
bridge directly.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `EquityChart` requires Recharts or lightweight-charts client component — may need `"use client"` boundary | High | Medium | Wrap ChartWrapper in a client component; page itself stays server. Pass serialised data as props. |
| `AxiomaAccountLinkDrawer` step-2 polling implemented as client-side fetch, exposing signing secret | Medium | Critical | Decision D-8 above. Implementer must receive explicit instruction. |
| `DataTable` column priority system not understood by implementer — all columns hidden on mobile | Medium | High | Provide the `Column<T>` interface exactly as specified in §7.5 and this handoff. Vitest test for priority rendering. |
| `AccordionConfigForm` displays raw config.raw JSON instead of structured form fields | Medium | Medium | Page should pass a typed `BotConfigShape` prop, not raw JSON. If the adapter shape is not yet typed, use a fallback `<pre>` with an explicit `DevPlaceholderBanner`. |
| Teacher course editor enables editing another teacher's course (RBAC bypass) | Low | High | The server action MUST re-check `userId === course.teacherId OR isAdmin` before any mutation. The layout guard alone is insufficient (direct POST bypass). |
| Support ticket route uses in-memory storage — tickets lost on restart | Medium | Low | Add `StorageModeBanner` to `/app/support` matching the TV/LMS pattern. |
| Safety tab "Report issue" link to /app/support fails if route does not exist | High | Medium | Build support route before completing Safety tab P0ItemCards. Ordering matters. |
| Notifications table query at scale (no pagination, no cursor) | Low | Low | DataTable accepts `pagination` prop — use it. Default page size 25. |
| Compare view loads two adapters in parallel — if both are mock, double mock banners appear | Medium | Low | CompareAnalyticsView renders one `DevPlaceholderBanner` at the top of the compare page, not one per column. The page itself checks `bothAreMock` and shows a single banner. |

---

## Verification/tests

This is a design-only agent. No test execution.

Design spec correctness is verified by cross-referencing:

1. Every new component in Decisions §D-2 maps to an existing or specified entitlement state in
   `docs/ENTITLEMENT_STATE_MACHINE.md`.
2. Every warning label in Decision §D-5 maps to a row in the 24-condition warning index
   (`docs/UX_SPEC_PHASE2.md §12`).
3. Every state in the state matrices below (§A.*) covers all six canonical states:
   idle / loading / success / error / disabled / empty.
4. No locked token is violated in any new component spec.
5. The null-to-dash rule (D-4) is called out explicitly in every component spec that renders
   a numeric or date value.

Implementer must ship Vitest tests covering:
- Default render does not throw (all new components)
- All six state variants render without crashing
- `disabled` state prevents click handlers from firing
- `aria-disabled="true"` present on all disabled buttons
- Null value renders as `—`, not `0` or empty string (for MetricCard, DataTable cells)
- `DevPlaceholderBanner` renders before any data element when mock condition is true

---

## Next actions

### Component Specification Appendix (A) — Implementer Reference

The following specs are the authoritative component-level implementation guide for Phase 2.1.
Each component declares: props interface (TypeScript), state matrix, file location, and
honesty/safety constraints.

---

#### A.1 BotSubNav (extend existing)

**File:** `apps/web/src/components/BotSubNav.tsx`

**Current state:** Functional but static — no capability awareness, no badges.

**Required prop additions:**

```ts
interface BotSubNavProps {
  bot: string;
  active: string;
  caps: BotCapabilities;      // from features/bots/meta.ts
  positionCount?: number;     // undefined = not loaded; 0 = empty; N = count badge
  warningCount?: number;      // undefined = not loaded; 0 = hidden; N = red badge
}
```

**Tab rendering rules by capability:**

| Tab | Condition | Render |
|---|---|---|
| Safety | `caps.hasBacktester` is false (wrong field — use absence from a new `hasSafetyLog: boolean`) | For Legacy: hidden OR rendered as `--dim` disabled with tooltip "Not available for Legacy Bot" |
| Backtester | `!caps.hasBacktester` | `--dim`, `not-allowed` cursor, `aria-disabled="true"`, link is non-navigable |
| Positions | Always | Count badge if `positionCount > 0`: `Badge variant="active"` gold fill, white number |
| Safety | `warningCount > 0` | Red count badge: `Badge variant="warning"` |

**Safety rule:** If `bot === 'legacy'`, Safety tab is not shown (Legacy bot exposes no risk
signals). Backtester tab shows in disabled state with label "N/A".

**Mobile:** Horizontal scroll strip (`overflow-x: auto`). No truncation. Active tab has
`border: 1px solid var(--stroke-gold)`, `color: var(--text)`.

---

#### A.2 EquityChart

**File:** `packages/ui/src/components/EquityChart/index.tsx`

**Props:**

```ts
interface EquityPoint { t: number; equity: number }
interface DrawdownPoint { t: number; drawdownPct: number }

interface EquityChartProps {
  equitySeries: EquityPoint[];
  drawdownSeries?: DrawdownPoint[];
  height?: number;          // default 300, mobile override 160
  sourceNote?: string;      // rendered below chart in --dim 11px
}
```

**State matrix:**

| State | Chart | Source note |
|---|---|---|
| `idle` | Recharts AreaChart, equity `--cyan`, drawdown `--red` secondary Y | sourceNote rendered |
| `loading` | `SkeletonChart` at exact height | hidden |
| `success` | Chart re-renders with new data | sourceNote rendered |
| `error` | `ErrorState` with retry button, "Chart data unavailable — [error]" | "—" |
| `disabled` | N/A (parent EntitlementGate wraps) | N/A |
| `empty` | `EmptyState title="No equity data yet" hint="Data appears after the first closed trade."` | hidden |

**Safety rule:** If `equitySeries.length === 0`, renders EmptyState — never a flat `$0`
line. If any point has `equity === 0`, that point is filtered by `filterZeroEquity()` before
the chart renders. Never compute drawdown from a series that still contains zero artifacts.

**Recharts composition:**

```
<ChartWrapper height={height}>
  <ComposedChart>
    <Area dataKey="equity" stroke="var(--cyan)" fill="rgba(105,226,255,.08)" />
    <Line dataKey="drawdownPct" stroke="var(--red)" yAxisId="right" />
    <YAxis yAxisId="right" orientation="right" />
    <Tooltip contentStyle={{ background: 'var(--panel2)', border: '1px solid var(--stroke)' }} />
  </ComposedChart>
</ChartWrapper>
```

Time range selector: `Tabs variant="pill"` with options "7D", "30D", "90D", "All". State
is client-side (`useState`). Filters `equitySeries` by the selected window before passing
to the chart.

This is a `"use client"` component. The parent page serialises `equitySeries` as JSON props
(no direct adapter calls inside the chart component).

---

#### A.3 AccordionConfigForm (bot settings)

**File:** `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` (page) +
`apps/web/src/features/bots/ConfigForm.tsx` (presentational)

**Page data loading:**

```ts
const { meta, access } = await loadBot(bot);
if (!access.allowed) return <BotAccessRequired meta={meta} section="Settings" />;
const adapter = getBotAdapter(meta.code, botAdapterOptions());
const config = await adapter.getConfig(meta.code);
const caps = BOT_CAPS[meta.code];
```

**Props:**

```ts
interface AccordionConfigFormProps {
  config: BotConfig;   // typed from @wtc/bot-adapters
  caps: BotCapabilities;
  botSlug: string;
}
```

**Layout:**

```
[DevPlaceholderBanner: "Config writes disabled — audited adapter required"]
[BotSubNav active="settings" + caps + counts]
[Accordion]
  [Section: "Exchange accounts"]   → ExchangeKeyVaultSection
  [Section: "Symbols"]             → SymbolEditor (read-only)
  [Section: "Risk parameters"]     → RiskEditor (read-only)
  [Section: "Advanced"]            → JSON display of config.raw remaining fields
```

All form fields rendered in `disabled` state. Every section has a `Button variant="ghost" disabled`
"Save changes (requires live adapter)" at the bottom.

**Honesty constraint:** If `config.raw` is a raw JSON object (adapter not yet typed), render
a `<pre className="wtc-mono">` with JSON.stringify. This is better than fabricating form
field shapes from unknown config keys. A `DevPlaceholderBanner` note: "Config shape not yet
fully typed — raw display only. Structured editor ships with the audited adapter."

---

#### A.4 ExchangeKeyVaultForm

**File:** `packages/ui/src/components/ExchangeKeyVaultForm/index.tsx`
**Always rendered inside:** `Drawer size="md"`

**Props:**

```ts
interface ExchangeKeyVaultFormProps {
  onClose: () => void;
  onSave?: (data: ExchangeKeyPayload) => Promise<void>;  // undefined = preview-only
  isPreviewOnly?: boolean;  // true in Phase 2 — disables save
}
```

**State matrix:**

| State | Form fields | Save button | Notes |
|---|---|---|---|
| `idle` | All empty, enabled if !previewOnly | Primary "Save account" (disabled until checkbox checked) | DevPlaceholderBanner at top if previewOnly |
| `loading` (connection test) | All disabled | Disabled | Spinner on test button |
| `success` (test pass) | Re-enabled | Enabled | StatusPill "Connection verified" above form |
| `error` (test fail) | Re-enabled | "Save anyway" ghost (risky path) | `RiskWarningBanner severity="error"` with exchange error |
| `loading` (save) | All disabled | Spinner "Saving..." | |
| `success` (saved) | — | — | Drawer auto-closes, Toast "Account saved" |
| `error` (save fail) | Preserved | "Retry" primary | ErrorState in Drawer |
| `disabled` (previewOnly) | All disabled, type="password" fields show mask | Only "Cancel" | DevPlaceholderBanner first element |

**Security constraints (design-level enforcement):**
- API Key and Secret: `SecretInput` type only. No `type="text"` fallback. No clipboard icon.
- Reveal: 15s max timeout, triggers `auditRevealAction` server action before showing.
- Form submit: values go to server action only. No `onSubmit(values)` client callback that
  could log or expose the keys.
- The "I confirm read-only permissions" Checkbox is `required`. `isValid` is false until checked.
  The save button `disabled` if `!isValid || isPreviewOnly`.

---

#### A.5 CourseCard

**File:** `packages/ui/src/components/CourseCard/index.tsx`

**Props:**

```ts
interface CourseCardProps {
  courseId: string;
  chapterLabel: string;         // "Chapter 01 of 3"
  title: string;
  description: string;
  lessonCount: number;
  completedLessons: number;
  nextLessonId?: string;        // undefined → "Start course"
  status: 'not_started' | 'in_progress' | 'completed';
}
```

**State matrix:**

| State | Progress bar | CTA label | CTA href |
|---|---|---|---|
| `not_started` | 0% (empty track, `--stroke` fill) | "Start course" | first lesson |
| `in_progress` | X% `--green` fill | "Continue lesson" | nextLessonId |
| `completed` | 100% `--green` fill | "Review course" | first lesson |
| `empty` (lessonCount=0) | hidden | "Coming soon" disabled ghost | — |
| `loading` | SkeletonText | disabled ghost | — |

**Typography per v3-editorial reference:**
- Chapter kicker: 11px, `--gold2`, uppercase, `font-weight: 700`, `letter-spacing: .16em`
- Course title: 24px (`heading-xl`), `font-weight: 700`, `--text`
- Description: 14px, `--muted`, `line-height: 1.65`, 2-line clamp (`-webkit-line-clamp: 2`)
- Progress: `4px` height bar, `border-radius: 999px`, `--stroke` track, `--green` fill

**No illustrations, no gradient fills.** `Card variant="elevated"`.

---

#### A.6 LessonPage Layout

**File:** `apps/web/src/app/(app)/app/education/[courseId]/lessons/[lessonId]/page.tsx`

This is a Next.js page with a specific layout — not a `packages/ui` component, because the
layout is route-specific. However, a `LessonLayout` wrapper component can be extracted.

**Page data:**

```ts
const user = await requireUser();
const access = await accessFor(user.id, 'education');
if (!access.allowed) return <EntitlementGate ... />;
const lesson = await lmsService.getLessonForStudent(lessonId, user.id);
const progress = await lmsService.getLessonProgress(user.id, lessonId);
```

**Layout:**

```
<main style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px' }}>
  <p class="wtc-dim" style={{ fontSize: 13 }}>   // breadcrumb
    Course title / Lesson N
  </p>
  <h1 style={{ fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 700 }}>
    {lesson.title}
  </h1>
  {lesson.videoUrl && <VideoEmbed url={lesson.videoUrl} />}
  <div class="lesson-body">{renderLessonBody(lesson.body)}</div>
  {lesson.materials.length > 0 && <MaterialsCard materials={lesson.materials} />}
  <div class="wtc-spread">
    <Toggle
      label="Mark as complete"
      checked={progress.completed}
      onToggle={markCompleteAction}
    />
    <div class="wtc-row">
      <a href={prevLessonHref} class={buttonClasses('ghost')}>← Previous</a>
      <a href={nextLessonHref} class={buttonClasses('ghost')}>Next →</a>
    </div>
  </div>
</main>
```

**States:**

| State | Video | Body | Materials | Toggle |
|---|---|---|---|---|
| `idle` | Player | Rendered HTML | Download links | Enabled |
| `loading` | `SkeletonChart` (16:9 aspect) | `SkeletonText` x5 | `SkeletonText` x2 | Disabled |
| `error` (lesson not found) | — | `ErrorState` | — | — |
| `disabled` (not enrolled) | Locked overlay (CSS blur + lock icon) | "Enroll to access" | Locked | Disabled |
| `empty` (no content) | hidden | `EmptyState` "No content yet" | hidden | Disabled |

---

#### A.7 TeacherCourseEditor

**File:** `apps/web/src/app/teacher/courses/[id]/page.tsx` (page) +
`apps/web/src/features/lms/TeacherCourseEditor.tsx` (presentational)

**Page data:**

```ts
const user = await getCurrentUser();
if (!user?.roles.includes('teacher') && !user?.roles.includes('admin')) redirect('/app');
const course = await lmsService.getCourse(params.id);
// RBAC: teacher can only edit their own course
if (course.teacherId !== user.id && !user.roles.includes('admin')) redirect('/teacher');
const lessons = await lmsService.listLessonsForTeacher(course.id);
const materials = await lmsService.listMaterials(course.id);
```

**Props:**

```ts
interface TeacherCourseEditorProps {
  course: CourseShape;
  lessons: LessonShape[];
  materials: MaterialShape[];
  canReassign: boolean;     // true only for admin
}
```

**Accordion sections:**

1. "Course settings" — `TextInput` title, `Textarea` description, `Toggle` published,
   `Select` teacher (disabled for teacher role). Save button: primary.
   States: idle, loading (spinner), success (toast "Saved"), error (field errors inline).

2. "Lessons" — ordered list. Each row: title + type badge, published toggle, "Edit" button
   (opens `LessonEditorDrawer`), "Delete" button (`Button variant="danger" size="sm"` →
   confirm Drawer). "Add lesson" at bottom. Reorder via up/down arrows (Phase 2 — no drag).

3. "Materials" — file list with `FilePicker` upload. Each row: title + file type badge + size.
   "Remove" button (`Button variant="danger" size="sm"`). Upload progress: inline progress bar.

**RBAC constraint (must be enforced in every server action):**
Every mutation action (save settings, create lesson, delete lesson, upload material, remove
material) must re-check `course.teacherId === actor.id || actor.roles.includes('admin')`.
The page guard alone is insufficient — a direct POST can bypass the layout check.

---

#### A.8 ServiceHealthGrid (admin system-health)

**File:** `apps/web/src/app/admin/system-health/page.tsx`

**Services to check:**

| Service | Adapter | Health signal |
|---|---|---|
| Tortila Journal | `getBotAdapter('tortila_bot', opts).getHealth()` | `health.status` |
| Legacy Bot API | `getBotAdapter('legacy_bot', opts).getHealth()` | `health.status` |
| Axioma Bridge | `createMockAxiomaBridge(...).ping()` | bridge health check |
| WTC Platform DB | internal `db.select(sql\`SELECT 1\`)` | query success |

**MetricCard variant for service cards:** `Card variant="flat"` with `--stroke-cyan` border
(`cyan` variant). Standard `MetricCard` does not support `variant` — use `Card` with custom
header instead for these health cards.

**Layout:**

```
[wtc-grid-4]
  [ServiceCard: Tortila Journal]  [ServiceCard: Legacy Bot]
  [ServiceCard: Axioma Bridge]    [ServiceCard: WTC DB]
[WorkerStatusCard]
[RiskEventsLog]
```

**ServiceCard anatomy:**

```
SERVICE NAME               [auto-refresh badge]
STATUS LABEL               [latency]
Last check: Xs ago
```

Status label typography: 26px, bold, `--green` / `--gold` / `--red` per status.

**Auto-refresh:** `setInterval` 30s. A `Badge variant="live"` pulse shows when the last
check was within 30s. After 60s without a refresh, all cards show `[STALE]` badge.

**Down state:** When any service is `down`, a `RiskWarningBanner severity="error"` appears
below the grid: "Service [name] is unreachable. Last successful check: [timestamp]."

**Note:** The auto-refresh requires a client component or a route handler polled by the
client. Pattern: a `/api/admin/health` route handler (server-side) that calls all adapters
and returns JSON. The page component fetches this on a 30s interval from a `"use client"`
wrapper. The adapter calls stay server-side.

---

#### A.9 SupportTicketForm + /app/support route

**File:** `apps/web/src/app/(app)/app/support/page.tsx`

**Page data:**

```ts
const user = await requireUser();
const tickets = await supportService.listByUser(user.id);
```

**Layout:**

```
[SectionHeader kicker="Support" title="Help & support"]
[StorageModeBanner if !postgres]
[SupportTicketForm: create new ticket]
[SupportThreadList: existing tickets]
```

**SupportTicketForm props:**

```ts
interface SupportTicketFormProps {
  defaultProduct?: string;    // pre-filled from query param ?product=tortila_bot
  defaultIssueCode?: string;  // pre-filled from query param ?issue=TP_RECONCILE
}
```

**Form fields:**
- `Select` Product — all ProductCode options + "General / other"
- `TextInput` Subject — required, 8–120 chars
- `Textarea` Description — required, min 20 chars, 6 rows
- Submit: `Button variant="primary"` "Submit ticket"

**States:**

| State | Form | Submit button |
|---|---|---|
| `idle` | Fields empty/pre-filled | Primary, enabled when valid |
| `loading` | All fields disabled | Spinner "Submitting..." |
| `success` | Form clears | Toast "Ticket submitted — we'll respond via email" |
| `error` | Fields preserved, inline errors | "Retry" |

**SupportThreadList:** `DataTable` with columns:
- Ticket ID (priority 1, mono)
- Subject (priority 1)
- Product (priority 2)
- Status (priority 1): open / in-progress / resolved, `StatusPill`
- Created at (priority 2)
- Last reply (priority 3, desktop only)

Row click opens `Drawer size="lg"` with full ticket thread (message history, admin replies).

**StorageModeBanner:** same pattern as TV/LMS pages — if `backendMode !== 'postgres'`, show
`StatusPill tone="warn"` "storage: in-memory (dev)" + note "Tickets reset on restart."

---

#### A.10 CompareAnalyticsView (/app/bots)

**File:** `apps/web/src/app/(app)/app/bots/page.tsx`

**Page data:**

```ts
const user = await requireUser();
const [tortilaAccess, legacyAccess] = await Promise.all([
  accessFor(user.id, 'tortila_bot'),
  accessFor(user.id, 'legacy_bot'),
]);
const tortilaAdapter = getBotAdapter('tortila_bot', opts);
const legacyAdapter = getBotAdapter('legacy_bot', opts);

// Load in parallel; catch individually so one failure does not block the other
const [tortilaData, legacyData] = await Promise.allSettled([
  Promise.all([tortilaAdapter.getHealth(), tortilaAdapter.getMetrics('tortila_bot')]),
  Promise.all([legacyAdapter.getHealth(), legacyAdapter.getMetrics('legacy_bot')]),
]);
```

**DevPlaceholderBanner rule:** One banner at the top of the page if either or both adapters
are in mock mode. Text: "Simulated data — not a live account (one or both bot adapters are in
mock mode)." Do not render two separate banners.

**CompareAnalyticsView props:**

```ts
interface BotColumnData {
  meta: BotMeta;
  access: AccessDecision;
  health?: BotHealth;         // undefined if fetch failed
  metrics?: BotMetrics;       // undefined if fetch failed
  fetchError?: string;
}

interface CompareAnalyticsViewProps {
  columns: [BotColumnData, BotColumnData];
}
```

**Column states:**

| Column state | Render |
|---|---|
| Not entitled | `EntitlementGate` with product name and "Unlock" CTA |
| Entitled, fetch error | `ErrorState` with bot name, error detail, `[STALE]` badge, retry link |
| Entitled, loading | `SkeletonCard` x8 |
| Entitled, data | 8 `MetricCard` components per spec §3.2 |

**CompareEquityChart:** `ChartWrapper` with two `Area` series. Tortila: `--cyan`. Legacy: `--gold`.
If one bot has no equity data: single series, no mention of the other in the legend.
Empty state per chart: if both have no data: `EmptyState title="No equity data for comparison"`.

---

#### A.11 Notifications List (/app/notifications)

**File:** `apps/web/src/app/(app)/app/notifications/page.tsx`

**Page data:**

```ts
const user = await requireUser();
const notifications = await notificationService.listByUser(user.id);
```

**Layout:**

```
[SectionHeader kicker="Account" title="Notifications"]
["Mark all read" button — right-aligned ghost, disabled if all read]
[NotificationsTable or EmptyState]
```

**DataTable columns:**

| Column | Priority | Notes |
|---|---|---|
| Time | 1 | relative time "3h ago", ISO on hover |
| Product | 2 | `StatusPill` with product name |
| Type | 1 | Badge: info / warning / alert |
| Message | 1 | 2-line clamp |
| Read | 3 | `Toggle` (client toggle, optimistic update) |

Unread rows: `background: rgba(105,226,255,.04)` — subtle cyan tint.
Read rows: default row style.

"Mark all read" server action: sets all `notifications.read = true` for the user.
Revalidates the page. Toast "All marked as read."

Empty state: `EmptyState title="No notifications" hint="System and product alerts appear here."`

**TopBar bell badge:** Shows unread count. Zero = no badge. Implemented as a server component
slot in `TopBar` that receives `unreadCount` prop from the layout. The layout server component
queries `notificationService.unreadCount(user.id)` once per page load. No polling in Phase 2.

---

#### A.12 Entitlement status labels — exact strings

These strings must appear verbatim in the UI. They are not copy suggestions.

| Entitlement state | StatusPill label | Inline note (if applicable) |
|---|---|---|
| `active` | "Active" | none |
| `grace` | "Grace period" | "Grace period ends [date]. Renew to avoid interruption." in `--gold` 13px |
| `pending_payment` | "Pending payment" | "Complete payment to activate access." |
| `expired` | "Expired" | "Your access has lapsed. Reactivate to continue." |
| `revoked` | "Revoked" | "Contact support if you believe this is an error." |
| `chargeback` | "Chargeback" | "Contact support." |
| `refunded` | "Refunded" | "Access was removed with the refund." |
| `manual_review` | "Under review" | admin-only; shown in admin entitlements table |
| `none` | "No access" | "Activate a plan in billing to unlock this product." |

These strings map to `reasonLabel()` in `apps/web/src/lib/access.ts`. The implementer must
verify that `reasonLabel()` returns these strings or update it to match. Do not diverge.

---

#### A.13 State matrices for surfaces not yet fully specified

##### A.13.1 /app/support — full state matrix

| State | SupportTicketForm | SupportThreadList |
|---|---|---|
| `idle` | Empty form, valid = false | Rows with status badges |
| `loading` | Fields disabled, spinner on submit | SkeletonTable 3 rows |
| `success` (submit) | Clears form | New row appears (revalidate) |
| `error` (submit fail) | Field errors inline | Unchanged |
| `disabled` (user not logged in) | Redirect to /login | — |
| `empty` (no tickets) | Form shown | EmptyState |

##### A.13.2 /app/notifications — full state matrix

| State | Table | Bell badge | Mark-all button |
|---|---|---|---|
| `idle` (unread > 0) | Rows with cyan tint on unread | Gold count badge | Enabled |
| `idle` (all read) | Rows, no tint | No badge | Disabled |
| `loading` | SkeletonTable | Unchanged | Disabled |
| `success` (mark-all) | Tint removed, rows unchanged | Badge removed | Disabled |
| `error` (fetch fails) | ErrorState + retry | Unchanged | Disabled |
| `empty` | EmptyState | No badge | Disabled |

##### A.13.3 /app/bots compare view — full state matrix

| State | Column A (Tortila) | Column B (Legacy) | Compare chart |
|---|---|---|---|
| `idle` (both entitled, data) | MetricCards | MetricCards | Dual series |
| `idle` (A entitled, B not) | MetricCards | EntitlementGate | Single series (Tortila only) |
| `idle` (A errored) | ErrorState + STALE | MetricCards | Single series (Legacy only) |
| `loading` | SkeletonCard x8 | SkeletonCard x8 | SkeletonChart |
| `error` (both) | ErrorState | ErrorState | EmptyState |

---

## Verification/tests (continued — test requirements for implementer)

**Specific test requirements for Phase 2.1 new components:**

1. `EquityChart`: test that `filterZeroEquity([])` and a series of all-zero values both render
   the `EmptyState`, never a flat-zero chart line.
2. `ExchangeKeyVaultForm`: test that the save button remains disabled when `isPreviewOnly=true`,
   and that clicking save when somehow enabled does not call `onSave`.
3. `CourseCard status="completed"`: progress bar should be exactly 100% and CTA should be
   "Review course" not "Continue lesson".
4. `BotSubNav caps.hasBacktester=false`: Backtester tab link should have `aria-disabled="true"`
   and `pointer-events: none` so keyboard navigation cannot activate it.
5. `ServiceHealthGrid service.status='down'`: `RiskWarningBanner severity="error"` should be
   present in the DOM with `role="alert"`.
6. `CompareAnalyticsView column.access.allowed=false`: `EntitlementGate` should be rendered
   in that column; MetricCards should NOT be rendered.
7. `SupportTicketForm defaultProduct="tortila_bot"`: the product Select should be pre-selected
   to "Tortila Bot" on mount.
8. All new DataTable instances: null cells render `—`, not `"0"`, `""`, or `null` as string.
