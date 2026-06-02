# WTC Ecosystem Platform — UX Spec Phase 2

**Version:** 1.0 — Phase 2 canonical  
**Owner:** ecosystem-ux-ui-designer  
**Epoch:** 20260530-0126  
**Status:** Authoritative for all Phase 2 UI implementation.  
**Companion:** `docs/DESIGN_SYSTEM.md` (tokens, type scale, spacing, component inventory, state matrix)

---

## Table of Contents

1. [Shared Patterns and Rules](#1-shared-patterns-and-rules)
2. [Public Pages](#2-public-pages)
   - 2.1 [Product Pages (`/products/*`)](#21-product-pages-productslug)
   - 2.2 [Pricing (`/pricing`)](#22-pricing-pricing)
   - 2.3 [Homepage (`/`)](#23-homepage-)
3. [Bot Dashboards (`/app/bots/*`)](#3-bot-dashboards-appbots)
   - 3.1 [Bot Sub-Navigation Shell](#31-bot-sub-navigation-shell)
   - 3.2 [Overview Tab](#32-overview-tab)
   - 3.3 [Positions Tab](#33-positions-tab)
   - 3.4 [Trades Tab](#34-trades-tab)
   - 3.5 [Equity Tab](#35-equity-tab)
   - 3.6 [Safety Tab](#36-safety-tab)
   - 3.7 [Config / Settings Tab](#37-config--settings-tab)
   - 3.8 [Backtester Tab (Tortila only)](#38-backtester-tab-tortila-only)
   - 3.9 [Compare / Analytics View](#39-compare--analytics-view)
4. [App Cockpit (`/app`)](#4-app-cockpit-app)
5. [Axioma Terminal Module (`/app/terminal` + `/products/terminal`)](#5-axioma-terminal-module)
   - 5.1 [App Module (`/app/terminal`)](#51-app-module-appterminal)
   - 5.2 [Public Product Page (`/products/terminal`)](#52-public-product-page-productsterminal)
6. [TradingView Access (`/app/indicators`)](#6-tradingview-access-appindicators)
7. [Education / LMS](#7-education--lms)
   - 7.1 [Student View (`/app/education`)](#71-student-view-appeducation)
   - 7.2 [Teacher Dashboard (`/teacher`)](#72-teacher-dashboard-teacher)
   - 7.3 [Teacher Course Editor (`/teacher/courses/[id]`)](#73-teacher-course-editor-teachercoursesid)
   - 7.4 [Admin Education (`/admin/education`)](#74-admin-education-admineducation)
8. [Billing & Entitlement Cards (`/app/billing`)](#8-billing--entitlement-cards-appbilling)
9. [Admin Surfaces](#9-admin-surfaces)
   - 9.1 [System Health (`/admin/system-health`)](#91-system-health-adminsystem-health)
   - 9.2 [TradingView Queue (`/admin/tradingview-access`)](#92-tradingview-queue-admintradingview-access)
10. [Exchange Key Vault Form](#10-exchange-key-vault-form)
11. [Responsive Behaviour Summary](#11-responsive-behaviour-summary)
12. [Warning Treatment Index](#12-warning-treatment-index)

---

## 1. Shared Patterns and Rules

### 1.1 Page shell

All authenticated `/app/*` pages render inside `AppShell`: fixed `TopBar` (72px) + fixed `SideNav`
(240px desktop, 64px icon-only at `md`, bottom tab bar at `sm`/`xs`) + scrollable main content area.
Main area padding: `24px 24px 48px` desktop, `16px 16px 88px` mobile (88px = bottom tab bar clearance).

All public pages render inside `PublicShell`: fixed `TopBar` + footer. No sidebar.

### 1.2 Page-level layout primitives

| Class / Pattern | Use |
|---|---|
| `wtc-stack` (flex-col, gap 14px) | Vertical section stack within a page |
| `wtc-grid wtc-grid-2/3/4` | Responsive card grids |
| `wtc-spread` | Horizontal space-between row (header + badge) |
| `wtc-row` | Horizontal flex, gap 12px, wraps |
| `wtc-container` | `max-width: 1240px`, centered, `padding: 0 20px` |

### 1.3 Mandatory page-level states

Every page that loads async data must handle all six states: `idle` (data rendered), `loading`
(Skeleton), `success` (brief visual refresh), `error` (ErrorState + retry), `disabled`
(EntitlementGate), `empty` (EmptyState with contextual CTA).

The loading state must match the shape of the loaded content — use `SkeletonCard`, `SkeletonTable`,
or `SkeletonChart` as appropriate, never a spinner alone.

### 1.4 Mock / dev data banner placement rule

If `adapter.mode === 'mock'` OR `bridgeIsDev === true` OR `backendMode !== 'postgres'`, a
`DevPlaceholderBanner` (styled as `RiskWarningBanner severity="info"`) must be the **first visible
element in the main content area**, above all MetricCards, tables, or charts. It must include the
mandatory phrase (see DESIGN_SYSTEM.md §13.5). It is never dismissible while the condition persists.

### 1.5 Entitlement gate pattern

When `access.allowed === false`, the page renders:
1. `SectionHeader` with product kicker + title
2. `EntitlementGate` card: product description, entitlement state badge, reason text (plain English,
   no jargon), CTA button that links to `/app/billing` or the public product page
3. No operational data is shown behind the gate

The gate never shows a spinner — the access decision is synchronous from the server.

### 1.6 Error and retry pattern

When an adapter call fails:
1. A `RiskWarningBanner severity="error"` appears above the content area
2. `ErrorState` replaces the data section (not a blank area)
3. A "Retry" button triggers `router.refresh()` or a server action refetch
4. If last-cached data exists, it is shown with an explicit `[STALE — last sync: Xm ago]` badge in
   the card header. The badge uses `--gold` color, not `--green`.

### 1.7 Numeric data rules

- All monetary values: `fmtMoney()` — 2 decimal places, currency symbol, tabular-nums
- All percentages: `fmtPct()` — 2 decimal places, `%` suffix, tabular-nums
- All trade counts and quantities: `fmtNum()` — locale-aware, tabular-nums
- Null / non-finite values: `MetricValue` component renders `—` (em dash) in `--dim`, never `0.00`
- Positive delta: `--green` text; negative delta: `--red` text. Never green for zero.

### 1.8 Navigation lock for unentitled products

Unentitled product items in `SideNav` show a lock icon and `--dim` text. They are still clickable
and navigate to the product's app page, which renders the `EntitlementGate`. They are never hidden.
The lock icon is 14px, `--dim` color, positioned inline after the label.

---

## 2. Public Pages

### 2.1 Product Pages (`/products/[slug]`)

One canonical template for all six product slugs. The v1-sovereign reference informs the marketing
hierarchy; v2-terminal-os informs the product frame visual.

#### Layout

```
[PublicTopBar]
[Hero section]
  [ProductHero: kicker + product name + tagline + feature highlights + CTA column]
  [ProductFrame: terminal-frame mockup or product preview image — right column]
[ProductFeatureGrid: 2-4 feature cards]
[AccessFlow: Choose > Pay > Access diagram]
[PricingSnapshot: plans for this product with CTA]
[Footer]
```

#### Hero section

- Left column (`.55fr`): kicker pill in `--gold2` uppercase, `display-md` product title, `body-lg`
  tagline in `--muted`, feature bullet list (4-6 items, `--text`, 14px, `--green` dot prefix),
  CTA row (primary "Get access" + ghost "See pricing")
- Right column (`.45fr`): `terminal-frame` pattern from v2-terminal-os:
  - `border: 1px solid rgba(213,169,79,.24)`, `border-radius: 34px`,
    `background: linear-gradient(180deg, rgba(11,20,35,.8), rgba(5,10,18,.96))`,
    `box-shadow: 0 42px 120px rgba(0,0,0,.55)`
  - Window bar: macOS-style dots (decorative, `rgba(148,163,184,.34)`), window title in
    `--dim` uppercase 11px, `pill` badge (product status: "subscription required", "available")
  - Inner area: product screenshot or a static diagram at desktop, hidden below `sm`

For `axioma_terminal`: window title "Axioma Terminal · Journal", screenshot of terminal chart view.
For `tortila_bot`: window title "Tortila Bot · Journal", diagram showing journal metrics grid.
For `education`: window title "WTC Academy · Course player", screenshot of lesson layout.
For `tradingview_indicators`: window title "TradingView · Indicator access", indicator list diagram.
For `legacy_bot` and `club`: minimal frame with feature bullet diagram (no screenshot available).

#### ProductFeatureGrid

Four `Card variant="elevated"` components in a 2x2 grid (4 cols desktop, 2 cols tablet, 1 col mobile).

Each card:
```
[icon: 42x42 rounded, --panel2 bg, --stroke-gold border, --gold2 symbol]
[heading: 19px, bold, --text, margin-top 28px]
[body: 14px, --muted, 1.65 line-height]
```
No decorative backgrounds on cards. No glow effects.

#### AccessFlow diagram

Three `flow-card` panels (same pattern as v2-terminal-os `#flow` section):
- "Choose" — product-specific plan options listed as `flow-row` rows
- "Pay" — billing cycle options
- "Access" — what gets unlocked (module list)

Panel style: `border: 1px solid var(--stroke)`, `border-radius: 28px`,
`background: rgba(255,255,255,.035)`, `padding: 22px`.
Row style: `border: 1px solid rgba(255,255,255,.07)`, `border-radius: 14px`, `padding: 11px`,
`font-size: 13px`. Right value in `--gold2`.

#### PricingSnapshot

Plans relevant to this product, rendered as a horizontal row of `Card` components:
- Plan name (17px, bold), billing cycle badge (`StatusPill tone="gold"`), included products list
  (`--dim`, 12px), CTA button (primary for bundle plans, secondary for single-product).

If user is authenticated (SSR cookie check): CTA = "Activate" → `/app/billing`.
If unauthenticated: CTA = "Get started" → `/register`.

#### States

| State | Treatment |
|---|---|
| `idle` | Full layout |
| `loading` | Not applicable — product pages are SSG or ISR, no client fetch |
| `error` | Not applicable for static content |
| `disabled` (product sunset) | StatusPill `--dim` "Discontinued", feature grid still shown, CTAs replaced with "See roadmap" |

#### Tortila-specific additions

Above the hero, immediately below TopBar: no banner in public context. Risk warnings are app-only.
The product page copy acknowledges the read-only monitoring model: "Controls are gated until
a separately audited adapter is approved — this is an intentional safety boundary."

#### Axioma-specific additions

The hero frame carries the `--stroke-gold` border. The copy section includes:
"Download, license management, and journal access are handled within your WTC account. WTC never
intermediates your order execution."

---

### 2.2 Pricing (`/pricing`)

#### Layout

```
[PublicTopBar]
[SectionHeader: kicker "Pricing" + display-md title + body-lg copy]
[BillingToggle: Monthly / Yearly (pill tabs)]
[PricingTable: plan comparison matrix]
[BundleCallout: bundle_pro + bundle_starter highlighted cards]
[FAQ accordion]
[Footer]
```

#### PricingTable

Responsive plan comparison. Desktop: columns = plans, rows = features. Mobile: cards per plan,
features as `Accordion` inside each card.

**Desktop layout:**

```
             Starter   Tortila   Axioma   Indicators   Education   Club   Bundle Pro
Tortila Bot    —         ✓         —         —            —          —        ✓
Axioma Term    —         —         ✓         —            —          —        ✓
TV Indicators  —         —         —         ✓            —          —        ✓
Education      ✓         —         —         —            ✓          —        ✓
Club           —         —         —         —            —          ✓        —
Billing        M/Y       M/Y       M/Y       Q/Y          lifetime   M       M/Y
Price          [price]   [price]   [price]   [price]      [price]   [price]  [price]
               [CTA]     [CTA]     [CTA]     [CTA]        [CTA]     [CTA]   [CTA]
```

Checkmarks use `--green` filled circle (7px). Dashes use `--dim`. Column highlight for
`bundle_pro`: `border: 1px solid var(--stroke-gold)`, `background: rgba(213,169,79,.04)`.

**Column header:**
- Plan name: `heading-md`, bold
- Kicker label below name: billing cycle in `--dim`, 11px

**CTA row:**
- Plans shown with accurate price placeholder (token price from plan registry; actual prices
  are injected at implementation by the billing provider integration)
- Authenticated users: "Activate" buttons link to `/app/billing?plan=<code>`
- Unauthenticated: "Get started" → `/register?plan=<code>`

**Mobile (below 768px):** Each plan becomes an `Accordion` item. Collapsed state shows plan name +
price + CTA. Expanded shows feature list. Feature rows use `wtc-spread` (feature name + check/dash).

#### BillingToggle

Pill tab strip: "Monthly" / "Yearly". Yearly shows a `Badge variant="new"` with "Save 20%"
(placeholder copy; real discount from billing provider). Toggle is client-side state only, no
page navigation.

#### BundleCallout

Two cards with `Card variant="gold"` for `bundle_pro` and `Card variant="elevated"` for
`bundle_starter`. Each shows expanded product list as badges. CTA: primary gold button.

#### FAQ accordion

6–8 entries, `Accordion` component. Default: all collapsed. Topics:
- What happens when my subscription expires?
- Can I buy products individually?
- How does TradingView access work?
- Is the Axioma terminal download separate from WTC?
- How are exchange keys stored?
- What is the grace period?

No decorative content. Plain prose answers.

#### States

| State | Treatment |
|---|---|
| `idle` | Full pricing table |
| `loading` | `SkeletonCard` per plan column while prices load (if dynamic pricing API) |
| `error` | `ErrorState` in PricingTable area; FAQ and BundleCallout still visible |
| `disabled` (plan code deprecated) | Plan column shows `--dim` "Discontinued" header, no CTA |

---

### 2.3 Homepage (`/`)

The existing `page.tsx` is Phase 1 functional but under-designed. Phase 2 expands it.

#### Layout

```
[PublicTopBar with status pill]
[HeroSection: left copy + right TerminalFrame]
[TickerBar: product module names + status pills]
[ProductModuleGrid: 6 module cards]
[AccessFlowSection: Choose > Pay > Access]
[TrustSection: key facts about architecture — no fake testimonials]
[Footer]
```

#### HeroSection

Left column:
- StatusPill `tone="gold"` "World Trader Club"
- `display-xl` headline with Georgia italic accent: `One account. Every WTC <em>product.</em>`
- `body-lg` lead copy in `--muted`: honest description of what WTC is (operating system framing)
- CTA row: primary "Create your account" + secondary "Explore Axioma"

Right column (`terminal-frame`):
- Window bar: "Axioma Terminal · Journal", StatusPill `tone="warn"` "sample UI"
- `Sparkline` component (equity curve shape, sample values, no real data implied)
- `MetricCard` grid (3 metrics: Wallet equity, Closed PnL, Max drawdown) with `--dim` note below:
  "Illustrative sample — not live account data."
- This is the current implementation; Phase 2 adds the explicit sample label in a more prominent
  `DevPlaceholderBanner` style (not a `wtc-dim` paragraph below the grid)

The right-column illustrative warning must be the `DevPlaceholderBanner` component (or equivalent
`RiskWarningBanner severity="info"`) placed inside the frame, above the metrics grid.

#### TickerBar

Same pattern as v2-terminal-os `#ticker` section. Static content. No live prices.
```
[WTC] master brand · [Axioma] terminal + journal · [Tortila] turtle system bot · ...
● subscription-ready  ● fail-closed entitlements  ● encrypted keys
```
Style: `border-top/bottom: 1px solid var(--stroke)`, `background: rgba(255,255,255,.025)`,
`padding: 12px 20px`, `overflow: hidden`, `font-size: 12px`, `color: #b9c2d0`.

#### ProductModuleGrid

6 cards in a `wtc-grid-3` (3 cols desktop, 2 cols tablet, 1 col mobile).

Each card:
```
[kicker: "01" in --gold2, padded]
[route: "/products/terminal" in --dim, 11px, right-aligned]
[h3: product name, 19px]
[p: honest description, --muted, 14px]
```
No illustrations. No gradient fills. `Card variant="elevated"`.

#### TrustSection

Three `flow-card` panels (same style as v2-terminal-os `#flow`):
- "Keys encrypted at rest" — AES-256-GCM envelope, never in logs or API responses
- "Entitlements fail closed" — unknown state = denied, no client-flag bypass
- "Bot controls gated" — read-only monitoring until separately audited adapter

This section replaces social proof (no fake testimonials). It communicates the security and
safety architecture in plain language.

---

## 3. Bot Dashboards (`/app/bots/*`)

Applies to both `tortila` and `legacy`. Differences per bot are called out in each section.

### 3.1 Bot Sub-Navigation Shell

**Component:** `BotSubNav`

A horizontal `Tabs variant="underline"` strip rendered above all tab content, below the page
`SectionHeader`. The strip is sticky on scroll (position sticky, `z-index: 10`, `--panel`
background, `border-bottom: 1px solid var(--stroke)`).

**Tabs:**

| Tab | Tortila | Legacy | Route |
|---|---|---|---|
| Overview | Yes | Yes | `/app/bots/[bot]` |
| Positions | Yes | Yes | `/app/bots/[bot]/positions` |
| Trades | Yes | Yes | `/app/bots/[bot]/trades` |
| Equity | Yes | Yes | `/app/bots/[bot]/equity` |
| Safety | Yes | No | `/app/bots/[bot]/safety` |
| Config | Yes | Yes | `/app/bots/[bot]/settings` |
| Backtester | Tortila only | No (locked) | `/app/bots/[bot]/backtester` |

**Tab badge:** "Positions 3" style count badge (gold fill) if open positions > 0.
Safety tab badge: red count if active P0/P1 warnings.
Backtester tab (Legacy): shows `--dim` "N/A" label, disabled state, no cursor-pointer.

**Mobile:** On `sm`/`xs`, the tab strip becomes a horizontal scroll strip. No truncation.
Each tab is a pill. The active tab has `--gold` border + `--text` color.

**RiskWarning placement for Tortila:** Above the `BotSubNav` strip, not inside any tab. Compact
summary form (`WarnBanner compact` variant): "⚠ 2 active warnings (1 P0, 1 P1) — see Safety tab."
The compact banner links to the Safety tab. The full banner is on the Safety tab itself.

### 3.2 Overview Tab

**URL:** `/app/bots/[bot]`

**Current implementation:** Functional Phase 1 page. Phase 2 improves composition.

#### Layout

```
[SectionHeader: kicker "Bot dashboard" + title + adapter status row]
[DevPlaceholderBanner if mock adapter]
[CompactRiskWarning if Tortila and warnings present]
[MetricCardGrid: 8 cards, 4-col desktop, 2-col tablet, 1-col mobile]
[PositionsSummaryCard + RecentTradesCard: 2-col grid]
[ControlsCard]
```

#### MetricCardGrid

8 `MetricCard` components in a `wtc-grid-4` (wraps to 2 on tablet, 1 on mobile):

| Card | Value source | Tone rule |
|---|---|---|
| Wallet equity | `metrics.walletEquity` | neutral |
| Closed PnL | `metrics.closedPnl` | green if ≥0, red if <0 |
| Unrealized PnL | `metrics.unrealizedPnl` | green if ≥0, red if <0 |
| ROI on margin | `metrics.roiOnMarginPct` | green if ≥0, red if <0 |
| Win rate | `metrics.winRatePct` | neutral (label: X/Y trades) |
| Profit factor | `metrics.profitFactor` | neutral (em-dash if null) |
| Max drawdown | `metrics.maxDrawdownPct` | always red (drawdown is always a loss metric) |
| Open risk (margin) | `metrics.openRisk` | neutral |

**Staleness indicator:** Each MetricCard has a sub-label showing "updated Xs ago" from
`health.lastSyncAt`. If stale > 30s: sub-label becomes `[STALE]` in `--gold`. If
`health.status === 'down'`: all 8 cards render in `error` state with `—` values and a
`--red` border tint.

#### PositionsSummaryCard

`Card variant="flat"` with header "Open positions" + count badge.

**Table columns (priority system):**

| Column | Priority | Mobile |
|---|---|---|
| Symbol | 1 | Always |
| Side | 1 | Always |
| Qty | 2 | Tablet+ |
| Entry price | 2 | Tablet+ |
| Mark price | 3 | Desktop only |
| Unrealized PnL | 1 | Always |

On mobile: tapping a row opens a `Drawer size="md"` with full position detail.

Empty state: `EmptyState title="No open positions"` (no CTA — the bot opens positions autonomously).

#### RecentTradesCard

`Card variant="flat"` with header "Recent trades" + "View all" link to Trades tab.

Shows last 8 closed trades.

**Table columns (priority):**

| Column | Priority | Mobile |
|---|---|---|
| Symbol | 1 | Always |
| Side | 1 | Always |
| Realized PnL | 1 | Always |
| Fee | 2 | Tablet+ |
| Closed at | 2 | Tablet+ |

On mobile: same Drawer pattern.

Empty state: `EmptyState title="No closed trades" hint="Win rate and profit factor will appear once the first trade closes."`

#### ControlsCard

`Card variant="flat"` with header "Controls".

Phase 2 composition:
- "Start bot" button: `Button variant="ghost"` with `disabled` + `title="Disabled: live control requires an audited adapter"`. Renders a `[MOCK]` Badge next to label in dev mode.
- "Stop bot" button: same disabled pattern + explicit tooltip: "'Stop' does not close positions."
- "Open Journal" link button: for Tortila links to Tortila journal `:8080`; for Legacy links to Legacy bot `:8000`.
- For Axioma Terminal: this section does not appear on bot pages.

Below the buttons, a permanent `wtc-dim` note (12px):
"Live controls are disabled by safety policy. 'Stop' never means 'close positions.' See BOT_CONTROL_SAFETY_MODEL.md."

The note is always visible — not in a tooltip, not in an accordion.

#### States (Overview)

| State | MetricCards | Positions | Trades | Controls |
|---|---|---|---|---|
| `idle` | Live values | Data table | Data table | Disabled buttons with labels |
| `loading` | SkeletonCard x8 | SkeletonTable 3 rows | SkeletonTable 3 rows | Buttons disabled |
| `success` | Brief green ring flash on all cards | Table refreshes | Table refreshes | Buttons revert |
| `error` | All show `—`, red border | ErrorState | ErrorState | Buttons disabled, retry CTA |
| `disabled` (unentitled) | EntitlementGate replaces entire content | — | — | — |
| `empty` (first run) | All show EmptyState MetricCards | EmptyState | EmptyState | "Setup wizard" CTA |

---

### 3.3 Positions Tab

**URL:** `/app/bots/[bot]/positions`

Full `DataTable` with all columns visible. Filter controls above the table.

#### Layout

```
[CompactRiskWarning if Tortila and warnings]
[FilterRow: symbol Combobox + side Select + "clear filters" ghost button]
[DataTable: positions with all columns]
[PositionDetailDrawer: opens on row click]
```

#### DataTable columns

| Column | Priority | Type | Notes |
|---|---|---|---|
| Symbol | 1 | text | `wtc-mono` |
| Side | 1 | Badge (long=green, short=red) | |
| Qty | 1 | number | tabular-nums |
| Entry price | 1 | money | tabular-nums |
| Mark price | 1 | money | tabular-nums, live update indicator |
| Unrealized PnL | 1 | money | green/red |
| Leverage | 2 | number | `Xx` suffix |
| Liq. price | 2 | money | tabular-nums |
| Margin used | 3 | money | desktop only |
| Open time | 3 | datetime | desktop only |

Mark price column has a `Badge variant="live"` pulse indicator when `health.status === 'healthy'`.
When `health.status === 'down'`, the live badge becomes `Badge variant="mock"` with dashed border.

#### PositionDetailDrawer

`Drawer size="md"` (480px desktop, full-screen mobile). Shows all columns for the selected row plus:
- PnL history sparkline (if available)
- "Close position" button: always `disabled`, tooltip: "Position close requires audited adapter."
- Exchange error codes (if any `101211`, `100410` etc. present for this position): displayed as
  `code` style text in `--red`

---

### 3.4 Trades Tab

**URL:** `/app/bots/[bot]/trades`

Same pattern as Positions but for closed trades history.

#### Layout

```
[FilterRow: symbol Combobox + side Select + date range inputs + "export CSV" ghost button (disabled)]
[DataTable: trades]
[TradeDetailDrawer: opens on row click]
```

#### DataTable columns

| Column | Priority | Type |
|---|---|---|
| Symbol | 1 | text/mono |
| Side | 1 | Badge |
| Realized PnL | 1 | money, green/red |
| Fee | 2 | money |
| Entry price | 2 | money |
| Exit price | 2 | money |
| Qty | 2 | number |
| Duration | 3 | string ("2h 14m") |
| Closed at | 2 | datetime |
| Exchange trade ID | 3 | mono, desktop only |

#### TradeDetailDrawer

`Drawer size="md"`. Full row data + exchange error codes if any (displayed as code blocks with
`--red` tint and `--code` font). No actions available (read-only).

For Tortila: if this trade has an associated risk event (TP rejection, fill lookup failure), show
it as a `RiskWarningBanner severity="warning"` inside the Drawer, above the data rows.

---

### 3.5 Equity Tab

**URL:** `/app/bots/[bot]/equity`

Currently a `BotSubPagePlaceholder`. Phase 2 full spec.

#### Layout

```
[MetricSummaryRow: 4 key metrics at a glance]
[EquityChart: equity curve + drawdown dual series]
[DrawdownTable: top 5 drawdown events]
[MetricGrid: extended stats]
```

#### MetricSummaryRow

4 `MetricCard` components in a row:
- Peak equity (`--text`)
- Current equity (`--text`)
- Total return % (`--green`/`--red`)
- Max drawdown % (always `--red`)

#### EquityChart

`ChartWrapper` component. Dual series:
- Series 1: equity curve, `--cyan` color
- Series 2: drawdown (%) on secondary Y-axis, `--red` color, area fill `rgba(255,107,116,.08)`

Time range selector: pill tabs "7D / 30D / 90D / All". Selected: gold underline.

Chart empty state: `EmptyState title="No equity data yet" hint="Data appears after the first closed trade."`
Chart error state: `ErrorState` with last-sync timestamp and retry.
Chart loading state: `SkeletonChart` at exact chart height.

Below chart: data source note in `--dim` 11px: "Sourced from Tortila journal :8080 — read-only."

#### DrawdownTable

`DataTable` with columns: Start date, End date, Peak equity, Trough equity, Drawdown %. Max 5 rows.
Empty state: "No drawdown events recorded."

#### MetricGrid

`wtc-grid-4`: Win rate, Profit factor, Avg win, Avg loss, Sharpe (placeholder, `--dim` if not
available from journal), Total trades, Total fees paid, Days active.

---

### 3.6 Safety Tab

**URL:** `/app/bots/[bot]/safety`

Currently a `BotSubPagePlaceholder`. Phase 2 full spec. Tortila only.

For Legacy bot: render a `Card` with "Safety event log is not available for the Legacy Bot adapter.
The Legacy Bot does not expose the risk signals tracked for Tortila." No Placeholder component.

#### Layout (Tortila)

```
[SectionHeader: "Safety & risk events"]
[RiskWarningBanner: all P0/P1 items, expanded, non-collapsible]
[SafetyEventLog: DataTable of safety events from bot_safety_events]
[P0ItemCards: one Card per unresolved P0 item]
```

#### RiskWarningBanner (full expanded form on Safety tab)

All warnings from `health.warnings` rendered as individual `RiskWarningBanner` components,
not collapsed into a summary. P0 items have `role="alert"`, P1 items have `role="status"`.

Each P0 item also has a "What this means" expand section (Accordion within the banner) that
explains the risk in plain language and links to the relevant section of
`BOT_CONTROL_SAFETY_MODEL.md`.

#### P0ItemCards

One `Card variant="warning"` per unresolved P0 item. Not dismissible. Shows:
- P0 severity badge (`--red` fill)
- Title (e.g., "TP reconciliation not implemented")
- Technical detail (e.g., error code, frequency)
- Status: "Open — pending resolution"
- "Report issue" link → `/app/support?product=tortila_bot&issue=<code>`

The card does not show a "Resolved" state until the P0 issue is actually fixed in the adapter.
There is no UI affordance to mark P0 items as acknowledged or dismissed.

#### SafetyEventLog

`DataTable` with columns:

| Column | Priority | Notes |
|---|---|---|
| Timestamp | 1 | datetime, mono |
| Event type | 1 | Badge (warn/error) |
| Code | 1 | mono, `--code` font |
| Symbol | 2 | if applicable |
| Detail | 1 | text, 2-line clamp |

Row click opens `Drawer` with full event JSON (syntax-highlighted in `--code` font,
`rgba(255,255,255,.04)` background).

---

### 3.7 Config / Settings Tab

**URL:** `/app/bots/[bot]/settings`

Currently a `BotSubPagePlaceholder`. Phase 2 full spec.

#### Layout

```
[DevPlaceholderBanner: "Config writes disabled — audited adapter required"]
[SetupWizard or AccordionConfigForm (see below)]
[ExchangeKeyVaultSection]
```

#### SetupWizard vs AccordionConfigForm

On first visit (no config exists): render `SetupWizard` — a multi-step wizard with step indicators
at the top. Steps:

1. "Exchange account" → links to `ExchangeKeyVaultForm` (see section 10)
2. "Symbols" → `SymbolEditor` component
3. "Risk parameters" → `RiskEditor` component
4. "Confirm & save" → readonly summary, submit button (disabled in Phase 2)

On subsequent visits (config exists): render `AccordionConfigForm` — one `Accordion` per config
section, each containing the relevant form fields in read-only mode (values visible, editing
disabled until live adapter ships).

The "disabled" state of all form fields must use `--stroke` 50% opacity border + `--panel` bg
(per DESIGN_SYSTEM.md §7.6 Field States). A `Button variant="ghost" disabled` labeled
"Save changes (requires live adapter)" sits at the bottom of each section.

#### SymbolEditor

Combobox input for symbol search + tag list showing currently configured symbols.
- Tag: `Badge variant="active"` for active, `Badge variant="warning"` for symbols with known risk events
- Remove button on each tag: disabled in Phase 2 (live adapter required)
- The symbol list matches the exchange's available pairs (static list in dev, dynamic from adapter in production)

For Tortila: additionally shows per-symbol risk info if any `101211` (NEAR TP) events are present
for that symbol — inline `Badge variant="warning"` "1 TP rejection (24h)" next to the tag.

#### RiskEditor

Two sections rendered as Accordion items:

**Position sizing:**
- `RangeSlider` "Balance used per trade %" (1%–10%, step 0.5%)
- `NumberStepper` "Leverage" (1x–10x)
- `NumberStepper` "Max open positions"

**Stop loss / take profit:**
- `RangeSlider` "Stop loss %" (0.5%–5%, step 0.1%)
- `RangeSlider` "Take profit %" (0.5%–10%, step 0.1%)
- `Toggle` "Trailing stop"

All fields are read-only (display-only) in Phase 2. Values sourced from `config.raw`.

#### ExchangeKeyVaultSection

`Card variant="gold"` with header "Exchange accounts".

Shows a table of linked exchange accounts:

| Column | Priority | Notes |
|---|---|---|
| Exchange | 1 | name + logo |
| Account label | 1 | user-provided nickname |
| Key ID | 1 | partial prefix only (e.g. "abc1...") |
| Status | 1 | Badge active/expired/revoked |
| Added | 2 | date |

"Add account" CTA opens `ExchangeKeyVaultForm` in a `Drawer` (see section 10).

---

### 3.8 Backtester Tab (Tortila only)

**URL:** `/app/bots/tortila/backtester`

Phase 1 implementation is mostly complete. Phase 2 improvements:

#### Layout

```
[SectionHeader]
[DevPlaceholderBanner: "Heavy backtests run in a local runner — no synthetic returns shown here"]
[ConfigureRunCard]
[ResultsCard]
```

#### ConfigureRunCard

Phase 2 improves the form layout:
- `wtc-grid-2` for the form fields (not `wtc-grid-3`), so each field is full-width-enough on tablet
- Each field uses the `TextInput` / `Select` / `NumberStepper` formal components, not raw `<input>`
- "Queue run" button: `Button variant="secondary"` disabled with tooltip "Requires the local runner binary."
- "Download local runner" button: `Button variant="ghost"` disabled with tooltip "Runner packaging is planned — not available in this build."

#### ResultsCard

Shows the last uploaded backtest artifact if present. Components:
- `BacktesterResultCard`: run metadata (symbols, timeframe, system, date range), then:
  - `EquityChart` of the backtest equity curve (read from artifact JSON)
  - `DataTable` of per-trade results
  - `MetricGrid`: Total return, Sharpe, Max drawdown, Win rate, Profit factor

If no artifact: `EmptyState title="No results yet" hint="The platform never fabricates an equity curve. Run the local runner and upload its artifact."`

**Important:** The empty state text must explicitly state "The platform never fabricates an equity
curve." This is a safety rule, not a copy suggestion.

#### Legacy Backtester (locked state)

`/app/bots/legacy/backtester` renders:
```
[SectionHeader kicker="Legacy backtester" title="Not available"]
[Card variant="flat"]
  "The Legacy Bot backtester is out of scope at MVP. Only the Tortila backtester is
   available. See the product roadmap for details."
  [Button variant="ghost" href="/products/legacy" label="Legacy Bot product page"]
```
No spinner, no placeholder. This is a permanent scope decision, not a loading state.

---

### 3.9 Compare / Analytics View

**URL:** `/app/bots` (the bots index page)

Currently shows `BotSubPagePlaceholder`. Phase 2: full multi-bot comparison.

#### Layout

```
[SectionHeader: "Bot analytics — compare"]
[BotStatusRow: quick status pills for each bot]
[CompareAnalyticsView: side-by-side metric grid]
[CompareEquityChart: dual series equity]
```

#### BotStatusRow

A horizontal row of `ProductStatusCard variant="compact"` per bot:
- Bot name, adapter status badge, last sync time, entitlement status
- Quick link to full bot dashboard

#### CompareAnalyticsView

`wtc-grid-2`: Left column = Tortila metrics, Right column = Legacy metrics.
Each column is a stack of `MetricCard` with the same 8 metrics as the Overview tab.
Column header: bot name + adapter status badge.

If one bot is unentitled: that column shows `EntitlementGate` overlay.
If one bot adapter is down: that column shows `ErrorState` with last-known values and `[STALE]` badge.

#### CompareEquityChart

`ChartWrapper` with both bots' equity as separate series:
- Tortila: `--cyan`
- Legacy: `--gold`

Time range selector. If only one bot has data: single series shown, no mention of the other.

---

## 4. App Cockpit (`/app`)

The Phase 1 implementation is functional. Phase 2 improves density, adds adapter health, and
upgrades the component composition.

#### Layout

```
[SectionHeader: "Welcome, [name]" kicker + "Account overview" title]
[AccountSummaryRow: 4 MetricCards]
[OperationalNoticesSection: if any warnings]
[SectionHeader: "Your products"]
[ProductAccessGrid: 6 ProductCard components]
```

#### AccountSummaryRow

Replace the 4 ad-hoc `Card` + `wtc-dim` text cards with proper `MetricCard` components:

| Card | Value | Notes |
|---|---|---|
| Active products | `activeCount` | neutral tone |
| Roles | badge row | uses StatusPill per role |
| Open notices | warning count | `--red` if > 0, `--dim` if 0 |
| Keys vault | "Encrypted" / "None linked" | `--green` / `--dim` |

#### OperationalNoticesSection

Shown only if `blockingTortila.length > 0`.

Heading: `SectionHeader title="Operational notices"` (no kicker, no copy — it's already serious).
Content: `RiskWarningBanner` per P0/P1 warning.

The section is not a `Card` wrapper — it is a bare stack. This prevents the appearance of a
"container" that could be collapsed. P0 notices are `role="alert"`.

#### ProductAccessGrid

6 `ProductCard` components in `wtc-grid-3` (2 cols on tablet, 1 col on mobile).

**ProductCard Phase 2 spec:**

```
┌──────────────────────────────────────────┐
│ [icon 42px]  Product name     [badge]    │
│              tagline                     │
│──────────────────────────────────────────│
│  [data row 1: key metric or status]      │
│  [data row 2: secondary status]          │
│──────────────────────────────────────────│
│  [CTA button]          [secondary link]  │
└──────────────────────────────────────────┘
```

**Data rows per product:**

| Product | Row 1 | Row 2 |
|---|---|---|
| `tortila_bot` | Adapter health: OK/STALE/DOWN badge | Warning count if >0 |
| `legacy_bot` | Adapter health badge | Last sync time |
| `axioma_terminal` | License state badge | Account link state |
| `tradingview_indicators` | Grant status badge | Expiry date if granted |
| `education` | Enrollment count | Last lesson activity |
| `club` | Access level | — |

**Locked state:** If `allowed === false`, the card shows a `Badge variant="locked"` and a single
"Unlock" CTA. No data rows shown. The card opacity is reduced to 0.65.

**Error state (adapter down):** For bot products, if the adapter is unhealthy at page load, data
rows show `[STALE]` badge + last-known value. The card does not become an ErrorState — it degrades
gracefully with visible staleness markers.

---

## 5. Axioma Terminal Module

### 5.1 App Module (`/app/terminal`)

The Phase 1 implementation is well-specified. Phase 2 improves composition and adds missing sections.

#### Layout

```
[SectionHeader + entitlement StatusPill row]
[DevPlaceholderBanner if isDev]
[BridgeErrorBanner if bridgeError]
[EntitlementGate if !access.allowed]
[if access.allowed && state:]
  [LicenseAccountCard + ReleaseCard: 2-col grid]
  [DownloadSection]
  [JournalSupportCard]
  [ReleaseNotesAccordion]
```

#### LicenseAccountCard

`Card variant="gold"` (gold border for Axioma premium identity). Sections:

**License block:**
- License state: `StatusPill tone={licenseTone}` — active (ok), grace (warn), expired (bad),
  not-linked (neutral)
- Valid until: `--mono` date, or "—" if not linked
- Grace period note: if `state === 'grace'`, inline note: "Grace period — renew before [date] to
  avoid interruption." in `--gold` 13px.

**Account link block:**
- Account link state: `StatusPill` — linked (ok), not-linked (warn), error (bad)
- If `state === 'not-linked'`: CTA button "Connect Axioma account" opens
  `AxiomaAccountLinkDrawer`
- If linked: "Reconnect" ghost button
- Note (always visible): "Device link uses a one-time code Axioma exchanges server-side. WTC
  never receives exchange keys or the Axioma JWT." in `--dim` 12px.

#### AxiomaAccountLinkDrawer

`Drawer size="md"`. Steps rendered as a `SetupWizard`:

**Step 1: Open Axioma Terminal**
- Instruction text
- Copy-paste the WTC link code shown in a `code` block with `--panel2` background

**Step 2: Enter code in Axioma**
- Waiting state: `StatusPill tone="warn"` "Awaiting confirmation..."
- A "Check status" button polls the bridge health every 5s (max 60s)
- Success: `StatusPill tone="ok"` "Account linked", Drawer closes automatically

**Step 3: Confirmation**
- Success message, "Done" close button

**States:** idle (step 1), loading (step 2 waiting), success (step 3), error (bridge error during
link — shows `ErrorState` inside Drawer with retry).

In `isDev` mode: the entire Drawer shows `DevPlaceholderBanner` before step 1, explaining
the link is not a real production endpoint.

#### ReleaseCard

`Card variant="flat"`. Content:
- Release version: `heading-xl` bold, `StatusPill tone="gold"` channel badge (stable/beta)
- Published date + min supported version: `--dim` 12px
- Changelog bullets: `ul` with `--muted` text, 13px, 1.7 line-height

**Download CTA:**
- Entitled + production bridge: `Button variant="gold"` "Download Axioma Terminal v{version}"
- Entitled + dev bridge: `Button variant="ghost" disabled` "Download (dev placeholder)"
  + `DevPlaceholderBanner` note
- Not entitled: `Button variant="ghost" disabled` "Download — activate license first"

States of the Download button:
| State | Visual |
|---|---|
| `idle` (entitled) | Gold button, full label |
| `loading` (download in progress) | Spinner replaces label, "Downloading..." |
| `success` | Checkmark + "Download complete" for 2s |
| `error` | Red border, "Download failed — retry" |
| `disabled` (not entitled) | Ghost disabled, tooltip |
| `disabled` (dev) | Ghost disabled, dev placeholder badge |

#### JournalSupportCard

`Card variant="flat"`. Content:
- "Open Axioma Journal" button: entitled+prod = primary, entitled+dev = ghost disabled,
  not-entitled = ghost disabled
- "FAQ" and "Support" ghost links
- Note about handoff token mechanism (always visible, 12px `--dim`)

#### ReleaseNotesAccordion

Last 3 releases from `terminal_release_cache`. Each release is one `Accordion` item:
- Collapsed: version + date + "stable/beta" badge
- Expanded: changelog list

Default: most recent release expanded, older releases collapsed.

#### Axioma Module — full state matrix

| State | LicenseCard | ReleaseCard | JournalCard | Notes |
|---|---|---|---|---|
| `idle` (entitled, linked) | active badge | version + download CTA | journal CTA enabled | — |
| `idle` (entitled, not linked) | not-linked badge + link CTA | version shown, download enabled | journal disabled | |
| `idle` (grace) | grace badge + renewal CTA | — | enabled | `--gold` grace warning in LicenseCard |
| `idle` (expired) | expired badge | download disabled | journal disabled | EntitlementGate overlay |
| `loading` (bridge fetch) | Skeleton content | Skeleton | Skeleton | Above-fold dev banner still shown |
| `error` (bridge down) | BridgeErrorBanner + last-cached state | Cached version + "STALE" | Disabled with tooltip | Full error banner at top |
| `disabled` (not entitled) | EntitlementGate | Locked | Locked | Gate shows plan options |
| `dev placeholder` | DevPlaceholderBanner + all actions disabled | Dev placeholder download | Dev placeholder journal | Everywhere isDev=true |

---

### 5.2 Public Product Page (`/products/terminal`)

Follows the general product page template (section 2.1) with Axioma-specific additions:

- Hero right column: `terminal-frame` with the Axioma logo and a representative screenshot
- Feature grid 4 cards: Journal & Analytics, Local Key Encryption, Release Cadence, License Management
- Trust note in AccessFlow: "WTC manages license and account-link. Your order execution always stays local in the Axioma terminal — WTC is never the execution path."
- PricingSnapshot shows `axioma_monthly` and `axioma_yearly` plans

---

## 6. TradingView Access (`/app/indicators`)

The Phase 1 implementation is mostly complete. Phase 2 improves the state diagram and mobile layout.

#### Layout

```
[SectionHeader]
[StorageModeBanner: ok if postgres, warn if in-memory]
[EntitlementWarning if !access.allowed]
[StatusCard: current grant state]
[AccessRequestTable]
[SubmitRequestCard]
```

#### StatusCard

New card in Phase 2. Shows the most recent `granted` or `pending` request prominently:

```
┌──────────────────────────────────────────────────────┐
│  TradingView Access                    [status badge] │
│                                                        │
│  Username:   your_tradingview_username                 │
│  Status:     Granted                                   │
│  Expires:    2026-08-01                                │
│  Granted by: admin                                     │
└──────────────────────────────────────────────────────┘
```

If no granted/pending request: `EmptyState title="No active access" hint="Submit your TradingView username below."`

**Visual states per grant status:**

| Status | Badge | Card border |
|---|---|---|
| `granted` | green active | `--stroke-cyan` |
| `pending` | gold pending | `--stroke-gold` |
| `expiring_soon` | gold grace | `--stroke-gold` + note: "Renew access before [date]" |
| `expired` | dim expired | `--stroke` |
| `revoked` | red revoked | `rgba(255,107,116,.28)` |

#### AccessRequestTable

`DataTable` with columns: TradingView username, Status, Requested at, Expires at.

Column priority: username (1), status (1), requested (2), expires (2).

**Mobile:** All 4 columns are priority 1 on mobile for this table (short values, fits on screen).
No Drawer needed for this table — all info visible in row.

Empty state: `EmptyState title="No requests yet"`

#### SubmitRequestCard

`Card variant="flat"`. Contains the submit form.

Form fields:
- `TextInput` "TradingView username" — 64-char max, no spaces validator
- `CsrfField` (hidden)
- Submit button: `Button variant="primary"` "Submit request"
  - Disabled if `!access.allowed` (tooltip: "Active entitlement required")
  - Disabled if pending request already exists (tooltip: "A request is already pending")
  - Loading state while server action runs
  - Error state if validation fails (inline field error message)

Note below form (always visible): "No credential-stuffing or brittle automation. Access is granted
by an admin and revoked automatically when your entitlement lapses."

#### Full state flow visual

```
[No entitlement]
  → EntitlementWarning banner + form disabled + table empty

[Entitled, no username submitted]
  → StatusCard: EmptyState + form enabled

[Entitled, pending]
  → StatusCard: pending badge
  → Table: 1 row, pending status
  → Form: disabled (tooltip: pending request exists)

[Entitled, granted]
  → StatusCard: active, username, expiry
  → Table: row with granted status + expiry
  → Form: disabled (tooltip: access already granted — renew at expiry)

[Entitled, expiring_soon]
  → StatusCard: gold border + "Renew before [date]" note
  → Table: row with expiring badge
  → Form: "Submit new request" button enabled

[Entitled, expired]
  → StatusCard: dim badge + "Submit a new request to restore access"
  → Form: enabled for new submission

[Entitled, revoked]
  → StatusCard: red badge + reason if available
  → RiskWarningBanner severity="warning" if reason is "entitlement expired"
  → Form: enabled if entitlement is still active
```

---

## 7. Education / LMS

### 7.1 Student View (`/app/education`)

The Phase 1 implementation is functional but minimal. Phase 2 expands it.

#### Layout

```
[SectionHeader]
[StorageModeBanner]
[EntitlementGate if !access.allowed]
[CourseGrid: CourseCard per published course]
[CommunityCard]
```

#### CourseCard

`Card variant="elevated"` per course. Component:

```
┌──────────────────────────────────────────────────────┐
│  Chapter 01 of 3                    [enrolled badge]  │
│  Course title                                         │
│  Course description (2-line clamp)                    │
│                                                       │
│  ████████████░░░░░  67% complete (4 of 6 lessons)    │
│                                                       │
│  [Continue lesson]          [View all lessons →]      │
└──────────────────────────────────────────────────────┘
```

Progress bar: `--green` fill, `--stroke` track, `border-radius: 999px`, height 4px.
Chapter number kicker: `--gold2` uppercase 11px.
Course title: `heading-xl` 24px (editorial warmth per v3 reference).
"Continue lesson" CTA → `/app/education/[courseId]/lessons/[lessonId]` (next uncompleted lesson).

**States:**

| State | Progress bar | CTA |
|---|---|---|
| Not started | 0% (empty track) | "Start course" |
| In progress | X% filled, green | "Continue lesson" |
| Completed | 100%, green | "Review course" |
| No lessons yet | hidden | "Coming soon" (disabled ghost) |

#### CommunityCard

`Card variant="flat"`. Phase 2: replace placeholder `wtc-dim` spans with real links when available,
or clearly labeled "Not yet configured" states:
- Telegram: if `communityLinks.telegram` configured → `<a>` link; else `--dim` "Not configured"
- Instagram: same pattern
- Private Club: link to `/products/club` if not entitled, `/app/billing` if entitled

#### Lesson Page (`/app/education/[courseId]/lessons/[lessonId]`)

Reading layout per v3-editorial reference:
- Max-width 780px, centered, `margin: 0 auto`, `padding: 0 24px`
- `body-lg` text (17px, 1.72 line-height)
- Course title in `heading-md` `--dim` at top (breadcrumb context)
- Lesson title: `display-md` (28–48px clamp), bold
- Video embed: full-width, 16:9 aspect ratio, `border-radius: --radius`, `--panel` background
- Lesson body: rich text (rendered HTML or MDX)
- Materials section: `Card variant="flat"` with `FilePicker`-style material download rows
- Progress: `Toggle` "Mark as complete" — server action, updates `lesson_progress`
- Navigation: bottom row "← Previous lesson" + "Next lesson →" ghost buttons

**States for lesson content:**

| State | Video | Body | Materials |
|---|---|---|---|
| `idle` | Player renders | Text renders | Download links |
| `loading` | SkeletonChart (video shape) | SkeletonText | SkeletonText |
| `error` (material fetch fails) | Player renders | Text renders | ErrorState per material |
| `disabled` (not enrolled) | Locked overlay | "Enroll to access" | Locked |
| `empty` (no content yet) | EmptyState | EmptyState | EmptyState |

---

### 7.2 Teacher Dashboard (`/teacher`)

The Phase 1 implementation is functional. Phase 2 improves it.

#### Layout

```
[SectionHeader: "Teacher console" kicker + "Your courses"]
[Back to app link — top right]
[CoursesGrid: 2-col]
  [CreateCourseCard]
  [MyCoursesList]
```

#### CreateCourseCard

`Card variant="gold"` (teacher creative zone). Form:
- `TextInput` Title — required
- `TextInput` Description
- `Toggle` "Publish immediately"
- Submit button: `Button variant="primary"` "Create course"

Form states: idle, loading (submit in progress), success (toast "Course created"), error (field validation or server error shown inline).

#### MyCoursesList

`Card variant="flat"` with header "My courses (N)".

List items (not a DataTable — short list):
- Course title (bold) + description (`--dim` 12px)
- Published/Draft `StatusPill`
- "Edit" link → `/teacher/courses/[id]`
- "Add lesson" link → opens Drawer with quick-add lesson form

Empty state: `EmptyState title="No courses yet" hint="Create your first course."`

---

### 7.3 Teacher Course Editor (`/teacher/courses/[id]`)

Currently a Placeholder. Phase 2 full spec.

#### Layout

```
[SectionHeader: course title + published/draft badge]
[TeacherCourseEditor component]
```

#### TeacherCourseEditor

An `Accordion`-per-section course editor.

**Section 1: Course settings**
- `TextInput` Title
- `Textarea` Description
- `Toggle` Published
- `Select` Teacher (admin only can reassign — teacher sees their own name, disabled)
- Save button: `Button variant="primary"` "Save settings"

**Section 2: Lessons (ordered)**

Lesson list with drag handle (drag is visual only in Phase 2 — reordering via up/down arrows as
accessible alternative):

Each lesson row:
- Lesson title + type badge (video/text/quiz)
- Published/Draft toggle
- "Edit" button → opens `LessonEditorDrawer`
- "Delete" button → `Button variant="danger"` with confirm modal

"Add lesson" button at bottom: opens `LessonEditorDrawer` in create mode.

**Section 3: Materials**

File list with upload via `FilePicker`:
- Material title + file type badge + size
- "Remove" button → `Button variant="danger" size="sm"`
- Upload progress: inline progress bar per file during upload

#### LessonEditorDrawer

`Drawer size="lg"` (640px).

Fields:
- `TextInput` Title
- `Select` Type (video / text / quiz)
- `Textarea` Body (markdown, 6 rows)
- `TextInput` Video URL (if type=video)
- `Toggle` Published

Actions: "Save lesson" (primary), "Delete lesson" (danger, bottom), "Cancel" (ghost).

States: idle, loading (save in progress), success (toast + Drawer closes), error (validation inline).

---

### 7.4 Admin Education (`/admin/education`)

Currently a Placeholder. Phase 2 full spec.

#### Layout

```
[SectionHeader: "Admin · Education"]
[AdminCoursesTable: all courses across all teachers]
[AdminEnrollmentsTable]
```

#### AdminCoursesTable

`DataTable` with columns: Course title, Teacher, Published, Lesson count, Enrollment count, Created.

Actions column: "View" → `/teacher/courses/[id]` (admin can view any course), "Toggle publish".

Filters: teacher Select, published/draft Toggle filter.

#### AdminEnrollmentsTable

`DataTable` with columns: User email, Course title, Enrolled at, Progress %, Last activity.

Filters: course Select, date range.

---

## 8. Billing & Entitlement Cards (`/app/billing`)

The Phase 1 implementation is functional (dev-only mock). Phase 2 improves visual composition and
adds the entitlement renewal/cancellation flow spec (backend is future; UI spec ships now).

#### Layout

```
[SectionHeader]
[DevPlaceholderBanner: "Mock checkout — hard disabled in production"]
[CurrentEntitlementsCard]
[PlanGrid]
[CancellationSection (future, disabled)]
```

#### DevPlaceholderBanner

Uses `RiskWarningBanner severity="warning"` with title "Dev-only mock checkout" (matches Phase 1
implementation). Remains the first element on the page, above all entitlement data.

#### CurrentEntitlementsCard

`Card variant="flat"` with header "Your entitlements".

`DataTable` with columns:

| Column | Priority | Notes |
|---|---|---|
| Product | 1 | with product icon if available |
| Plan | 2 | plan code in `--dim` |
| Status | 1 | `StatusPill` per entitlement state |
| Renews / expires | 1 | `--mono` date |
| Actions | 1 | "Renew" or "Manage" ghost button |

Status badges use the entitlement state color map from DESIGN_SYSTEM.md §2 (Status Color Shortcuts).

**Renew CTA per status:**
- `active`: "Manage" (ghost) — no urgency
- `grace`: "Renew now" (gold secondary) + note: "Grace period ends [date]"
- `expiring_soon` (within 7 days): "Renew" (gold) + inline note
- `expired`: "Reactivate" (primary) 
- `revoked`/`chargeback`/`refunded`: "Contact support" (ghost) — no self-serve
- `pending_payment`: "Complete payment" (primary)

Empty state: `EmptyState title="No products yet" action="Browse plans"` → anchor scrolls to PlanGrid.

#### PlanGrid

`wtc-grid-3` of `Card` components per plan (filtering out `admin_grant`).

Each card:
- Plan name (17px bold) + billing cycle `StatusPill tone="gold"` 
- Included products list: `--dim` 12px
- Price: bold 24px (placeholder — implementation adds real price from billing provider)
- CTA: `Button variant="primary"` "Activate (mock · dev)"

Bundle plans (`bundle_pro`, `bundle_starter`) use `Card variant="gold"` to distinguish them.

**Card CTA states:**

| State | Button | Notes |
|---|---|---|
| `idle` | Primary "Activate" | |
| `loading` | Spinner, "Processing..." | |
| `success` | Checkmark + "Activated", 2s then page refresh | |
| `error` | Red border + "Failed — retry" | Toast with error detail |
| Already active | Ghost disabled "Already active" | Tooltip: "This plan is already active" |

---

## 9. Admin Surfaces

### 9.1 System Health (`/admin/system-health`)

Currently a Placeholder. Phase 2 full spec.

#### Layout

```
[SectionHeader: "System health"]
[ServiceHealthGrid]
[WorkerStatusCard]
[RiskEventsLog]
```

#### ServiceHealthGrid

4 `MetricCard variant="cyan"` (cyan border for live status data):

| Service | Endpoint | Check |
|---|---|---|
| Tortila Journal | `:8080/api/health` | `{ok:true}` |
| Legacy Bot API | `:8000/auth/login` (HEAD) | HTTP 200/405 |
| Axioma Bridge | `axi-o.ma/health` | `{status:"ok"}` |
| WTC Platform DB | internal | Drizzle connectivity |

Each card shows:
- Service name (label, `--dim`)
- Status (large: "OK" / "DEGRADED" / "DOWN" in `--green`/`--gold`/`--red`)
- Last check timestamp (`--dim` 11px)
- Latency ms (`--mono` 12px)

**States:**
- `ok`: `--green` badge + text
- `degraded` (slow or partial): `--gold` badge + latency warning
- `down`: `--red` badge + `RiskWarningBanner severity="error"` appears below the grid

**Auto-refresh:** Every 30s. `Badge variant="live"` pulse indicator on card headers when live.
Staleness: if last check > 60s ago, show `[STALE]` badge on affected cards.

#### WorkerStatusCard

`Card variant="flat"`. Shows worker/job queue status:
- Job queue: last run, pending job count, last error
- Status: `StatusPill` (ok if last run within 5m, warn if 5-30m, bad if >30m)
- "Force run" button: `Button variant="ghost" disabled` in Phase 2

#### RiskEventsLog

`DataTable` of recent `bot_safety_events` across all bots:

| Column | Priority | Notes |
|---|---|---|
| Timestamp | 1 | |
| Bot | 1 | badge (tortila/legacy) |
| Code | 1 | `--code` font, `--red` tint |
| Severity | 1 | P0/P1/P2 badge |
| Detail | 2 | 2-line clamp |

Filtered to last 100 events. "Export" button: disabled in Phase 2.

P0 events render with `--red` row background tint: `rgba(255,107,116,.06)`.

---

### 9.2 TradingView Queue (`/admin/tradingview-access`)

#### Layout

```
[SectionHeader: "TradingView access queue"]
[PendingRequestsTable]
[AllRequestsTable]
```

#### PendingRequestsTable

`Card variant="warning"` if `pendingCount > 0`, else `Card variant="flat"`.

`DataTable` — pending requests only:

| Column | Priority | Notes |
|---|---|---|
| Username | 1 | `--mono` |
| WTC user | 1 | email |
| Requested | 1 | datetime |
| Entitlement status | 1 | `StatusPill` — admin must verify entitlement is still active |
| Actions | 1 | "Grant" (primary sm) + "Deny" (danger sm) |

"Grant" action: opens `Drawer size="sm"` with confirmation: "Grant TradingView access to
[username] for user [email]? This triggers the access grant workflow." Confirm = `Button
variant="gold"` "Confirm grant". Cancel = ghost.

"Deny" action: opens `Drawer size="sm"` with reason `Textarea`. Confirm = `Button
variant="danger"` "Deny".

Both actions are server actions with CSRF. Loading state while server action runs.

#### AllRequestsTable

Full history `DataTable`:

| Column | Priority |
|---|---|
| Username | 1 |
| WTC user | 1 |
| Status | 1 |
| Requested | 2 |
| Granted at | 2 |
| Expires at | 2 |
| Granted by | 3 |

Filters: status Select, date range inputs.

---

## 10. Exchange Key Vault Form

**Component:** `ExchangeKeyVaultForm`
**Used in:** `/app/bots/[bot]/settings` Config tab, `/app/security`
**Rendered inside:** `Drawer size="md"` always (never inline on a page)

#### Layout

```
[Drawer header: "Add exchange account"]
[DevPlaceholderBanner: "Keys are encrypted at rest with AES-256-GCM. WTC never logs or transmits plaintext keys."]
[Form fields]
[Actions row]
```

#### Form fields

1. `Select` Exchange — BingX / Binance / Bybit / (future: others)
2. `TextInput` Account label — user-provided nickname (displayed in table, not the key)
3. `SecretInput` API Key — masked by default
4. `SecretInput` API Secret — masked by default, reveal = 15s max, audit logged
5. (Optional) `SecretInput` Passphrase — shown only if exchange requires it
6. `Toggle` "Test connection before saving" — recommended, default ON
7. `Checkbox` "I confirm this key has read-only permissions" — required for form submit

#### Security constraints (design enforcement)

- API Key and API Secret fields are `SecretInput` — `type="password"` in DOM, no clipboard copy
- Reveal triggers server-side audit log entry (DESIGN_SYSTEM.md §7.6)
- Form submit POST goes to a server action; the plaintext values are encrypted in the action
  before touching any storage layer
- No `console.log`, no toast with key values, no network log exposure
- The "I confirm read-only permissions" checkbox is mandatory — form cannot submit without it

#### States

| State | Form | Actions |
|---|---|---|
| `idle` | All fields empty/default | "Save account" (primary disabled until checkbox), "Cancel" ghost |
| `loading` (connection test) | Fields disabled, spinner on "Test connection" | Buttons disabled |
| `success` (connection test) | Fields re-enabled, `StatusPill tone="ok"` "Connection verified" | "Save account" enabled |
| `error` (connection test fails) | Fields re-enabled, `RiskWarningBanner severity="error"` with exchange error detail | "Save anyway" (ghost, risky) + "Retry test" (secondary) |
| `loading` (save in progress) | All disabled, spinner on save button | Disabled |
| `success` (saved) | Drawer closes, Toast "Account saved" | — |
| `error` (save fails) | ErrorState in Drawer, fields preserved | "Retry" primary |
| `disabled` (live writes off) | All fields read-only | Only "Cancel" available |

In Phase 2, live writes are disabled. The form renders all fields in `disabled` state with a
`DevPlaceholderBanner`: "Key vault writes are gated until the audited adapter ships. This form
is preview-only."

The "Add account" CTA in the Config tab still opens the Drawer (the form must be visible so
the implementer can build it), but the save action is disabled.

---

## 11. Responsive Behaviour Summary

This section consolidates the mobile strategy across all pages.

### Navigation

| Breakpoint | Pattern |
|---|---|
| `xl`/`lg` (≥1050px) | 240px `SideNav` fixed sidebar, full grid layouts |
| `md` (768–1050px) | 64px icon-only `SideNav`, single/2-col grids |
| `sm`/`xs` (<768px) | Bottom tab bar (5 items: Overview, Bots, Terminal, Education, Account) |

Bottom tab bar items: icon (24px) + label (10px). Active: `--gold` border-top 2px. The 5 items
map to the top-5 most-visited sections — not all SideNav items. A "More" item at position 5
expands to a drawer showing remaining nav items.

### Table mobile rules

All tables follow the priority column system (DESIGN_SYSTEM.md §10). Summary:

| Table | Priority-1 columns (always) | Mobile row action |
|---|---|---|
| Positions | Symbol, Side, uPnL | Tap → Drawer (full detail) |
| Trades | Symbol, Side, Realized PnL | Tap → Drawer |
| Safety events | Timestamp, Code, Severity | Tap → Drawer (JSON detail) |
| Entitlements | Product, Status | Tap → Drawer (plan + dates) |
| TV requests | Username, Status | No Drawer (all info in row) |
| Admin users | Email, Role | Tap → Drawer (actions) |
| Courses (admin) | Title, Teacher | Tap → navigate |

### Form mobile rules

All forms inside a `Drawer` use full-screen on mobile (`Drawer size="full"` on `sm`/`xs`).
Forms inline on a page use single-column layout on mobile. Two-column desktop forms stack
vertically. `NumberStepper` and `RangeSlider` use full-width on mobile.

### Chart mobile rules

Chart height: 300px desktop → 180px tablet → 160px mobile.
Secondary Y-axis hidden on mobile.
Tooltip repositioned: bottom-center on mobile (not overlay).
Time range selector: scrollable pill row on mobile.

### Hero section (public pages) mobile rules

Below `md`: grid becomes single-column. `terminal-frame` product mockup moves below the copy.
Frame height reduced: `max-height: 260px`, inner `terminal-img` is hidden, only the metrics
overlay is shown (3 metrics in a row, `--panel` background, `border-radius: --radius`).

---

## 12. Warning Treatment Index

All warning, disclaimer, and simulated-data notices used across the platform, indexed for implementers.

| Key | Trigger | Component | Style | Dismissible? |
|---|---|---|---|---|
| `MOCK_ADAPTER` | `adapter.mode === 'mock'` | `DevPlaceholderBanner` (info) | `--stroke-cyan` left border | No |
| `DEV_BRIDGE` | `axiomaBridgeIsDev()` | `DevPlaceholderBanner` (info) | `--stroke-cyan` left border | No |
| `STORAGE_INMEM` | `backendMode !== 'postgres'` | `StatusPill tone="warn"` + note | inline row | No |
| `MOCK_CHECKOUT` | billing page in dev | `RiskWarningBanner severity="warning"` | `--gold` left border | No |
| `BRIDGE_DOWN` | bridge fetch throws | `RiskWarningBanner severity="error"` | `--red` left border | No, retry CTA |
| `ADAPTER_STALE` | last sync > 30s | `[STALE]` badge in card header | `--gold` badge | N/A (auto-clears) |
| `ADAPTER_DOWN` | health.status === 'down' | `RiskWarningBanner severity="error"` + ErrorState | `--red` | No, retry CTA |
| `ENT_BLOCKED` | `!access.allowed` | `EntitlementGate` card | gate overlay | N/A |
| `ENT_GRACE` | entitlement state = grace | inline note in card + `--gold` badge | inline | No |
| `ENT_EXPIRED` | entitlement state = expired | `EntitlementGate` + badge | gate | N/A |
| `LIVE_CTRL_OFF` | `FEATURE_LIVE_BOT_CONTROL=false` | inline `--dim` note below controls | paragraph | No |
| `TORTILA_P0_TP` | always (TP_RECONCILE unresolved) | `RiskWarningBanner severity="error"` | `--red` | No |
| `TORTILA_P0_MARGIN` | always (MARGIN_PREFLIGHT unresolved) | `RiskWarningBanner severity="error"` | `--red` | No |
| `TORTILA_101211` | journal reports event | `RiskWarningBanner severity="warning"` | `--gold` | After first view (P1) |
| `TORTILA_100410` | journal reports event | `RiskWarningBanner severity="warning"` | `--gold` | After first view (P1) |
| `TORTILA_109421` | journal reports event | `RiskWarningBanner severity="warning"` | `--gold` | After first view (P1) |
| `EXCH_FLAT_MISMATCH` | journal reports event | `RiskWarningBanner severity="warning"` | `--gold` | After first view (P1) |
| `TV_EXPIRING` | grant `expiring_soon` | inline `StatusPill tone="warn"` + note | inline in StatusCard | N/A |
| `TV_REVOKED` | grant status = revoked | `StatusPill tone="bad"` + reason | in StatusCard | N/A |
| `KEY_READONLY_REQUIRED` | vault form | checkbox + note | form field | N/A — form gated |
| `BACKTEST_NO_SYNTHETIC` | backtester results empty | `EmptyState` with explicit note | EmptyState | N/A |
| `AXIOMA_NOT_BARE_LINK` | N/A (architecture) | Full `ProductStatusCard` | component | N/A |
| `SIMULATED_HOMEPAGE` | hero `Sparkline` / metrics | `DevPlaceholderBanner` inside frame | cyan info | No |

**Rules for all warnings:**
1. Mock/dev banners: first element in main content area, above all data.
2. P0 risk banners: above BotSubNav, visible on every bot sub-page, never in an accordion.
3. Entitlement gates: full-page gate (not just a locked button); shows reason and CTA.
4. Adapter stale/down: data still shown if cached, but always with explicit `[STALE]` badge —
   never silently as if live.
5. No warning uses a green background or a dismissal that allows the condition to appear resolved
   when it is not.

---

*Companion docs:*
- `docs/DESIGN_SYSTEM.md` — tokens, type scale, spacing, component inventory, state matrix
- `docs/handoffs/20260530-0126-ecosystem-ux-ui-designer.md` — this phase's canonical handoff
- `docs/BOT_CONTROL_SAFETY_MODEL.md` — risk signal definitions (P0/P1)
- `docs/CONTRACTS/axioma-bridge.md` — Axioma bridge states and error envelope
- `docs/ENTITLEMENT_STATE_MACHINE.md` — entitlement state transitions
