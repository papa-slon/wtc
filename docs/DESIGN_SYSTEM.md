# WTC Ecosystem Platform — Design System

**Version:** 1.0 — Phase 0 canonical reference  
**Owner:** ecosystem-ux-ui-designer  
**Status:** Authoritative for all UI implementation. Implementation lives in `packages/ui/`.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design Tokens](#2-design-tokens)
3. [Typography](#3-typography)
4. [Spacing Scale](#4-spacing-scale)
5. [Elevation and Blur](#5-elevation-and-blur)
6. [Motion](#6-motion)
7. [Component Inventory](#7-component-inventory)
8. [State Matrix](#8-state-matrix)
9. [Product-Specific Patterns](#9-product-specific-patterns)
10. [Responsive Strategy](#10-responsive-strategy)
11. [Anti-patterns](#11-anti-patterns)
12. [Implementation Notes](#12-implementation-notes)

---

## 1. Design Philosophy

WTC Ecosystem is a **control plane** for professional traders. The design language must communicate operational density, institutional restraint, and trustworthiness — not gamification, not decoration.

Four principles govern every decision:

| Principle | Meaning | Violation to avoid |
|---|---|---|
| **Terminal-first** | Every screen is designed for active monitoring, not passive reading. Dense information layouts are correct. | Whitespace-heavy marketing layouts inside the app |
| **Restrained premium** | Gold and cyan are data indicators, not decoration. Use them sparingly. | Gold applied to hero blobs, gradient fill backgrounds, purely decorative glows |
| **Explicit state** | Every interactive element and every data feed has a visible, honest state. Loading is shown. Errors are shown. Warnings are never hidden. | Green "all good" card hiding a known Tortila TP reconciliation failure |
| **Fail-visible** | Risk warnings (Tortila P0/P1 items, margin preflight block, rate limits, reconciliation mismatches) are first-class UI elements, never collapsed by default | Risk summary hidden inside an accordion that defaults to closed |

The three reference variants map to three UI contexts:

- `v2-terminal-os.html` — **App shell, dashboards, product modules** (primary direction)
- `v1-sovereign.html` — **Public marketing pages** (brand hierarchy, product showcase)
- `v3-editorial-authority.html` — **Education and Club** (premium editorial, readable LMS)

---

## 2. Design Tokens

All tokens are defined as CSS custom properties on `:root`. Tailwind config maps each to a utility class. `packages/ui/src/tokens.css` is the single source of truth.

### Color Tokens

```css
:root {
  /* Backgrounds */
  --bg:      #050a12;   /* page root background */
  --bg2:     #08101d;   /* slightly lighter page background for alternating sections */
  --panel:   #0b1423;   /* card and panel surface */
  --panel2:  #0e1a2b;   /* elevated panel, modal interior, drawer */

  /* Strokes */
  --stroke:      rgba(148, 163, 184, 0.16);   /* default border for panels, cards */
  --stroke-gold: rgba(213, 169, 79, 0.34);    /* gold-accent border (Axioma, premium CTAs) */
  --stroke-cyan: rgba(105, 226, 255, 0.18);   /* data frame border */

  /* Text */
  --text:  #f1f5f9;   /* primary text */
  --muted: #94a3b8;   /* secondary / metadata */
  --dim:   #64748b;   /* tertiary / labels / timestamps */

  /* Brand accents */
  --gold:  #d5a94f;   /* primary gold — CTAs, active states, license indicators */
  --gold2: #f2d78f;   /* lighter gold — italic headline accents, kicker text */

  /* Data colors */
  --cyan:  #69e2ff;   /* live/streaming data, chart highlights */
  --green: #54d6a1;   /* positive PnL, active entitlement, success state */
  --red:   #ff6b74;   /* negative PnL, error, revoked, risk warning */

  /* Geometry */
  --radius: 22px;     /* standard card border-radius */
  --radius-sm: 14px;  /* compact items: badges, input fields, table rows */
  --radius-lg: 30px;  /* large panels, drawers, modals */

  /* Layout */
  --max-w: 1240px;    /* maximum content width */
}
```

### Tailwind Mapping (`packages/ui/tailwind.config.ts`)

```ts
colors: {
  bg:         'var(--bg)',
  bg2:        'var(--bg2)',
  panel:      'var(--panel)',
  panel2:     'var(--panel2)',
  text:       'var(--text)',
  muted:      'var(--muted)',
  dim:        'var(--dim)',
  gold:       'var(--gold)',
  'gold-2':   'var(--gold2)',
  cyan:       'var(--cyan)',
  green:      'var(--green)',
  red:        'var(--red)',
}
```

### Semantic Usage Rules

| Token | Do | Do not |
|---|---|---|
| `--gold` | Active state indicator, premium CTA border, license badge | Background fills, decorative gradient orbs, loading spinners |
| `--gold2` | Georgia-italic headline emphasis, kicker labels | Regular body text |
| `--cyan` | Live data values, streaming chart lines, real-time badges | Generic link color |
| `--green` | Positive PnL, entitlement active status, success toast | Marketing adjectives like "great returns" |
| `--red` | Negative PnL, error state, risk warning banner, revoked entitlement | Anything that could be confused with a simple design accent |
| `--stroke` | Card border, divider, table row separator | As a background |
| `--stroke-gold` | Axioma product frames, premium CTA buttons | Random decorative boxes |

### Status Color Shortcuts

These map directly to entitlement states from the seed:

| Entitlement state | Color | Style |
|---|---|---|
| `active` | `--green` | solid dot + text |
| `grace` | `--gold` | pulsing dot + text |
| `pending_payment` | `--gold2` | outline dot + text |
| `expired` | `--dim` | grayed text |
| `revoked` / `chargeback` / `refunded` | `--red` | solid badge |
| `manual_review` | `--cyan` | outlined badge, admin only |
| `none` | `--dim` | "no access" label |

---

## 3. Typography

### Font Families

```css
--font-sans:   Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-serif:  Georgia, "Times New Roman", serif;  /* italic only, for headline accents */
```

Inter is the operational font. Georgia italic is reserved for editorial accent — used exclusively in `<em>` within large display headings and pull-quotes. Never use Georgia for body copy, UI labels, table data, or form fields.

### Type Scale

| Token | CSS | Size | Weight | Leading | Use |
|---|---|---|---|---|---|
| `display-xl` | `clamp(54px,7vw,96px)` | — | 800 | 0.92 | Hero headlines (public pages only) |
| `display-lg` | `clamp(36px,5vw,66px)` | — | 700 | 0.96 | Section headlines, major dashboard titles |
| `display-md` | `clamp(28px,3.5vw,48px)` | — | 700 | 1.05 | Product page h2, modal titles |
| `heading-xl` | `24px` | — | 700 | 1.2 | Card titles, sidebar section headers |
| `heading-lg` | `20px` | — | 600 | 1.3 | Panel headers, sub-section titles |
| `heading-md` | `16px` | — | 600 | 1.4 | Form section headers, small panel titles |
| `body-lg` | `17px` | — | 400 | 1.72 | Long descriptions, lead text |
| `body-md` | `14px` | — | 400 | 1.65 | Standard UI text, card paragraphs |
| `body-sm` | `13px` | — | 400 | 1.55 | Table cells, secondary descriptions |
| `label` | `11px` | — | 700 | 1.0 | Kickers, ALL CAPS labels, nav items |
| `label-sm` | `10px` | — | 700 | 1.0 | Timestamps, micro-metadata |
| `code` | `13px` | — | 400 | 1.5 | Exchange error codes, API error strings |
| `mono-data` | `14px` | — | 600 | 1.2 | Numeric metrics (PnL, equity, %) — tabular-nums |

**Numeric data** must always use `font-variant-numeric: tabular-nums` so values align in columns without layout shift.

```css
.data-value {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

**Kicker pattern** (used before section headers):

```html
<span class="text-label text-gold2 uppercase tracking-widest font-black">
  Product modules
</span>
<h2 class="display-lg font-bold tracking-tight">
  WTC as <em class="font-serif italic text-gold2">the control plane.</em>
</h2>
```

---

## 4. Spacing Scale

Based on a 4px base. Tailwind default spacing covers this; these are the named semantic steps:

| Name | Value | CSS variable | Use |
|---|---|---|---|
| `space-1` | 4px | `--s-1` | Icon gap, dense metric row padding |
| `space-2` | 8px | `--s-2` | Badge padding, compact row padding |
| `space-3` | 12px | `--s-3` | Card inner padding (dense) |
| `space-4` | 16px | `--s-4` | Standard row padding, form field padding |
| `space-5` | 20px | `--s-5` | Card padding desktop |
| `space-6` | 24px | `--s-6` | Section inner padding |
| `space-7` | 32px | `--s-7` | Section gap, grid gap |
| `space-8` | 48px | `--s-8` | Section vertical padding |
| `space-9` | 64px | `--s-9` | Large section spacing |
| `space-10` | 96px | `--s-10` | Hero top padding |

**Grid gutters:** 12px (dense dashboard), 16px (standard card grid), 24px (section layout).

**Max-width container:**

```css
.container { max-width: var(--max-w); margin: 0 auto; padding: 0 20px; }
```

---

## 5. Elevation and Blur

Panels live in z-layered space. Never use elevation purely decoratively — it signals modality or overlay.

| Level | Shadow | Backdrop blur | Use |
|---|---|---|---|
| Flat | none | none | Inline table rows, plain list items |
| Raised | `0 4px 16px rgba(0,0,0,.24)` | none | Standard cards, form sections |
| Elevated | `0 12px 40px rgba(0,0,0,.35)` | none | Feature cards, dashboard panels |
| Float | `0 24px 70px rgba(0,0,0,.45)` | `blur(12px)` | TopBar, SideNav, sticky headers |
| Overlay | `0 34px 100px rgba(0,0,0,.55)` | `blur(20px)` | Drawers, modals |
| Modal | `0 48px 140px rgba(0,0,0,.65)` | `blur(24px)` | Full modals, confirmation dialogs |

**TopBar** uses `rgba(5,10,18,.78)` + `blur(20px)` — glass over the grid texture, matching `v2-terminal-os.html`.

**Grid texture** (fixed, behind all content):

```css
.app-bg::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.8), transparent 86%);
}
```

**Gold glow** is permitted only on: active license badge dots, CTA button box-shadow. Maximum: `box-shadow: 0 16px 42px rgba(213,169,79,.18)`. Never use gold glow on chart lines or risk banners.

**Cyan ambient** is permitted only on the top-right page decoration and live-data badges. Maximum: `radial-gradient(circle at 70% 2%, rgba(105,226,255,.15), transparent 28%)`.

---

## 6. Motion

Transitions must communicate state change, not brand personality. Every animation is functional.

| Purpose | Duration | Easing |
|---|---|---|
| Hover (color, border) | 120ms | `ease-out` |
| Focus ring | 80ms | `ease-out` |
| Skeleton shimmer | 1200ms | `ease-in-out` infinite |
| Toast appear | 200ms | `cubic-bezier(.17,.67,.42,1)` |
| Toast dismiss | 150ms | `ease-in` |
| Drawer open | 260ms | `cubic-bezier(.2,0,0,1)` |
| Drawer close | 200ms | `ease-in` |
| Modal appear | 240ms | `cubic-bezier(.2,0,0,1)` |
| Accordion expand | 200ms | `ease-out` |
| Status pulse dot | 2s | `ease-in-out` infinite |

No parallax. No page-scroll animations. No entrance animations on dashboard data — data appears immediately or shows skeleton. Animations that run only when `prefers-reduced-motion: no-preference` checks.

---

## 7. Component Inventory

All components live in `packages/ui/src/components/`. Each exports named TypeScript components. No component has product business logic.

---

### 7.1 TopBar

**Location:** `packages/ui/src/components/TopBar/`

Fixed, 72px tall, `z-index: 40`. Glass effect over grid texture.

**Slots:**
- `brand` — WTC logo + optional status pill ("ecosystem online")
- `nav` — horizontal link list (hidden on mobile `<1050px`, menu opens in Drawer)
- `actions` — user avatar/menu, notification bell, CTA button

**Anatomy:**

```
[WTC logo] [status pill]    [nav links...]    [bell] [avatar/menu] [CTA]
```

**States:**

| State | Visual |
|---|---|
| Default | `rgba(5,10,18,.78)` + `blur(20px)` + bottom `--stroke` border |
| Scrolled | Same (always fixed) |
| Mobile | Nav links hidden; hamburger icon opens SideNav Drawer |
| Unauthenticated | CTA = "Get Access" (gold); no user avatar |
| Authenticated | CTA hidden or replaced with avatar menu |

**Status pill variants:**

```
● ecosystem online     (--green dot, green-tinted background)
● 1 warning           (--gold dot, gold-tinted background)
● degraded            (--red dot, red-tinted background)
```

---

### 7.2 SideNav

**Location:** `packages/ui/src/components/SideNav/`

Fixed sidebar for the authenticated `/app/*` shell. 64px wide (icon-only, collapsed) or 240px (expanded with labels). Collapses to bottom tab bar on mobile.

**Navigation groups:**

```
Overview           /app
───────────────────────
My Products        /app/products
  Tortila Bot      /app/bots/tortila
  Legacy Bot       /app/bots/legacy
  Axioma Terminal  /app/terminal
  Indicators       /app/indicators
  Education        /app/education
───────────────────────
Analytics          /app/analytics  (future)
───────────────────────
Account
  Billing          /app/billing
  Settings         /app/settings
  Security         /app/security
  Support          /app/support
```

**Item states:**

| State | Visual |
|---|---|
| Default | `--muted` text, no background |
| Hover | `--stroke` border, `rgba(255,255,255,.04)` background |
| Active | Left `2px` gold border, `--text` color |
| Disabled (unentitled) | `--dim` text, lock icon, click opens upgrade prompt |
| Alert badge | Red count bubble on icon (e.g., unread warnings) |

**Lock behavior:** Unentitled product nav items show a lock icon and are clickable (redirect to product page showing upgrade CTA), not hidden. Hiding unentitled items violates the "fail-visible" principle and reduces discoverability.

---

### 7.3 Card

**Location:** `packages/ui/src/components/Card/`

Base container. All cards have `--panel` or `--panel2` background, `--stroke` border, `--radius` radius.

**Variants:**

| Variant | Background | Border | Use |
|---|---|---|---|
| `default` | `--panel` | `--stroke` | Standard data cards |
| `elevated` | gradient `--panel` to `--panel2` | `--stroke` | Feature cards |
| `gold` | `--panel` | `--stroke-gold` | Axioma product sections, premium CTAs |
| `cyan` | `--panel` | `--stroke-cyan` | Live data panels |
| `warning` | `rgba(255,107,116,.08)` | `rgba(255,107,116,.28)` | Risk warning cards (never collapse by default) |
| `flat` | transparent | `--stroke` | Table containers, inline sections |

**Props:**
- `header` — optional section title + optional action/badge slot
- `footer` — optional action row
- `noPad` — removes default padding (for full-bleed chart or table inside card)

---

### 7.4 MetricCard

**Location:** `packages/ui/src/components/MetricCard/`

Displays a single KPI. Used in bot dashboards, equity overview, account summary.

**Anatomy:**

```
┌─────────────────────────────┐
│ LABEL                  [i]  │  <- label (--label, uppercase, --dim), optional info tooltip
│                             │
│ 12,847.34            +2.4%  │  <- value (--mono-data, --text), delta (--green/--red)
│ ────────────────────────    │  <- optional sparkline (single-line chart)
│ updated 3s ago             │  <- staleness timestamp (--dim, --label-sm)
└─────────────────────────────┘
```

**States:** See State Matrix in section 8.

**Rules:**
- Positive delta: `--green`
- Negative delta: `--red`
- If data is stale (last update > 30s from journal), show orange staleness indicator, not green dot
- Never show `$0.00` or `0.00%` as placeholder data — show Skeleton instead
- Closed PnL, Unrealized PnL, Wallet Equity, ROI, and Max Drawdown are always labeled distinctly (never conflated)

---

### 7.5 DataTable

**Location:** `packages/ui/src/components/DataTable/`

Used for: trade history, positions, equity events, audit log, admin user list.

**Features:**
- Column sorting (click header)
- Sticky header on scroll
- Row hover: `rgba(255,255,255,.035)` background
- Numeric columns: `text-right`, `tabular-nums`
- Status column: renders `Badge` component
- Pagination (or infinite scroll — configurable)
- Mobile: column hiding via priority tiers (see section 10)
- Empty state: `EmptyState` component
- Loading state: full-table `Skeleton` rows

**Column definition shape:**
```ts
interface Column<T> {
  key:         keyof T
  header:      string
  align?:      'left' | 'right' | 'center'
  priority?:   1 | 2 | 3          // 1 = always visible, 3 = desktop only
  render?:     (value, row) => ReactNode
  sortable?:   boolean
}
```

**Row click:** Optional. If a row is clickable it has cursor-pointer and expands a detail Drawer, not an inline accordion row (inline rows destroy mobile layout).

---

### 7.6 Form Fields

**Location:** `packages/ui/src/components/Form/`

All form fields share the same visual DNA. Input surface: `--panel2`. Border: `--stroke`. Radius: `--radius-sm`. Focus: `box-shadow: 0 0 0 2px var(--gold)` (not outline — outline doesn't respect radius).

**Components:**

| Component | Use |
|---|---|
| `TextInput` | Text, email, number |
| `PasswordInput` | Password with show/hide toggle, value never logged |
| `SecretInput` | Exchange API key/secret — masked by default, explicit reveal button, audit trail on reveal |
| `Select` | Dropdown, native `<select>` semantics |
| `Combobox` | Searchable select (symbol picker) |
| `Checkbox` | Binary option |
| `Toggle` | On/off setting |
| `Textarea` | Multi-line text |
| `NumberStepper` | Integer with +/- controls (leverage, levels) |
| `RangeSlider` | Bounded float (risk %, take-profit %) |
| `FilePicker` | Education materials upload |

**Field anatomy:**

```
[Label]                    [Optional hint]
┌────────────────────────────────────────┐
│ value                                  │
└────────────────────────────────────────┘
[Validation message if error]
```

**States:**

| State | Border | Background |
|---|---|---|
| Default | `--stroke` | `--panel2` |
| Focus | `--gold` ring | `--panel2` |
| Error | `--red` | `rgba(255,107,116,.06)` |
| Disabled | `--stroke` 50% opacity | `--panel` |
| Success | `--green` ring (briefly, then clears) | `--panel2` |
| Loading | `--stroke` + spinner right | `--panel2` |

**SecretInput additional rules:**
- Value is `type="password"` by default
- Reveal button requires click and shows for 15s maximum, then re-masks
- Reveal event writes to audit log via server action — never client-only
- No copy-to-clipboard on secret fields in admin views

---

### 7.7 Tabs

**Location:** `packages/ui/src/components/Tabs/`

Used to switch views within a product area. Never used for top-level navigation (that is SideNav).

**Variants:**

| Variant | Use |
|---|---|
| `underline` | Bot sub-pages (Positions / Trades / Equity / Safety / Config) |
| `pill` | Compact tab switching within a Card (daily/weekly/monthly) |
| `drawer-tabs` | Replaces table columns on mobile — see section 10 |

**Tab states:**

| State | Visual |
|---|---|
| Default | `--muted` text, no background |
| Hover | `--text` text |
| Active | `--text` + gold underline or gold-filled pill |
| Disabled | `--dim` text, no hover |
| Count badge | Small number pill in gold on the tab (e.g., "Positions 3") |

---

### 7.8 Drawer

**Location:** `packages/ui/src/components/Drawer/`

Slides in from right (desktop) or bottom (mobile). Used for:
- Row detail expansion (trade detail, position detail)
- Bot config on mobile
- Mobile navigation (SideNav)
- Confirm destructive action (not a Dialog — Drawer allows review of context)

**Sizes:** `sm` (320px), `md` (480px), `lg` (640px), `full` (100vw)

**Always renders a close button.** No click-outside-to-close on destructive confirm drawers.

---

### 7.9 Accordion

**Location:** `packages/ui/src/components/Accordion/`

Used for:
- Bot config sections (Symbol config → sub-settings)
- FAQ / Support
- Bot setup wizard steps
- Education course modules

**Never use Accordion to hide risk warnings.** Risk warnings render as `RiskWarning` banner, always expanded.

**States:**

| State | Visual |
|---|---|
| Collapsed | Title + chevron-down icon |
| Expanded | Title + chevron-up + content revealed, animated |
| Disabled | `--dim` text, no toggle |
| Warning | Gold-bordered, default open, `⚠` icon |

---

### 7.10 Badge / Status Pill

**Location:** `packages/ui/src/components/Badge/`

Compact inline status display.

**Variants by semantic meaning:**

| Variant | Color | Use |
|---|---|---|
| `active` | `--green` bg/border | Entitlement active, bot running |
| `grace` | `--gold` bg/border | Grace period |
| `pending` | `--gold2` outline | Pending payment, pending TV grant |
| `expired` | `--dim` bg | Expired access |
| `revoked` | `--red` bg | Revoked/chargeback |
| `warning` | `--red` bg | Risk warning label |
| `info` | `--cyan` bg/border | Informational, manual review |
| `new` | `--gold` bg | New release, new feature |
| `beta` | `--stroke-cyan` border | Beta feature flag |
| `locked` | `--dim` outline | Unentitled product |
| `mock` | `--stroke` dashed border | Mock/dev adapter data |
| `live` | `--cyan` with pulse | Live streaming data indicator |

**Status pill with dot:**
```
● Active    (dot = 7px circle, box-shadow glow in matching color)
```

Pulsing animation only for `active` and `live` — not for `warning` (pulse on warnings would dilute attention).

---

### 7.11 Button Variants

**Location:** `packages/ui/src/components/Button/`

| Variant | Background | Border | Text | Use |
|---|---|---|---|---|
| `primary` | `#ffffff` | none | `#07101c` | Main CTA on public pages |
| `gold` | gradient `--gold2` → `--gold` | `--stroke-gold` | `#0b0f16` | Premium subscriptions, download CTA |
| `secondary` | `rgba(213,169,79,.08)` | `--stroke-gold` | `--gold2` | Secondary gold action |
| `ghost` | `rgba(255,255,255,.035)` | `--stroke` | `--text` | Standard secondary action |
| `danger` | `rgba(255,107,116,.12)` | `rgba(255,107,116,.3)` | `--red` | Delete, revoke, destructive |
| `outline-cyan` | transparent | `--stroke-cyan` | `--cyan` | Live data actions |
| `disabled` | `--panel` | `--stroke` 50% | `--dim` | Any disabled state |

**Size variants:** `sm` (32px height), `md` (40px, default), `lg` (48px)

**Loading state:** Spinner replaces label content, button width locked to prevent layout shift.

**Icon buttons:** 40×40px minimum hit target. Icon-only buttons require `aria-label`.

**Never use Button for navigation** — use `<a>` styled as a button. Router-link vs action is a semantic distinction enforced at the component level via `as` prop.

---

### 7.12 EmptyState

**Location:** `packages/ui/src/components/EmptyState/`

Shown when a list, table, or feed has zero items — not zero data (that is Skeleton).

**Anatomy:**

```
        [icon: neutral monochrome, 48px]
        No trades yet
        Once your bot executes its first trade,
        history will appear here.
        [optional CTA button]
```

**Rules:**
- No illustration blobs, no gradients, no decorative color
- Icon is `--dim` color only
- Title max 4 words
- Description max 2 sentences
- CTA is optional and only shown when there is a clear action the user can take

**Product-specific empty states are customized** — e.g., Axioma Terminal locked empty state has a "Download Terminal" CTA. The empty state component accepts `title`, `description`, `icon`, and `action` props.

---

### 7.13 ErrorState

**Location:** `packages/ui/src/components/ErrorState/`

Shown when a data fetch fails or an adapter returns an error.

**Anatomy:**

```
        [icon: exclamation, --red]
        Could not load positions
        Tortila adapter returned HTTP 503.
        Error code: ADAPTER_TIMEOUT
        [Retry]   [View last cached data]
```

**Rules:**
- Show the actual error code/message from the adapter — do not genericize to "something went wrong" without the technical detail
- Retry button triggers the same fetch with exponential backoff awareness
- If cached data exists, offer to show stale data with a `[STALE]` badge in the header
- Never auto-retry more than 3 times silently; surface the error after the third failure

---

### 7.14 Skeleton / Loading

**Location:** `packages/ui/src/components/Skeleton/`

Shown during initial data fetch. Never show a spinner alone for multi-cell content — show a skeleton that matches the shape of the loaded content.

**Variants:**
- `SkeletonText` — inline text placeholder, configurable width
- `SkeletonCard` — full card placeholder matching MetricCard shape
- `SkeletonTable` — configurable row count, column count
- `SkeletonChart` — rectangle placeholder matching chart height

**Shimmer:** single horizontal light sweep, `1200ms ease-in-out infinite`.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--panel) 25%,
    rgba(148,163,184,.08) 50%,
    var(--panel) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### 7.15 Toast

**Location:** `packages/ui/src/components/Toast/`

Transient system-level feedback. Stacked in top-right corner (desktop), top-center (mobile). Maximum 3 visible at once; older ones dismissed when limit exceeded.

| Variant | Color | Duration | Use |
|---|---|---|---|
| `success` | `--green` left border | 4s | Config saved, grant applied |
| `error` | `--red` left border | 8s (persist) | Adapter failure, form error |
| `warning` | `--gold` left border | 6s | Staleness, rate limit warning |
| `info` | `--cyan` left border | 4s | Download ready, sync complete |

**Rules:**
- Success toasts auto-dismiss
- Error toasts require manual dismiss (critical information must not vanish)
- Never show "Successfully updated" for a form that failed server-side validation — the component receives the actual server response
- Toasts have an accessible `role="alert"` or `role="status"` depending on urgency

---

### 7.16 RiskWarning Banner

**Location:** `packages/ui/src/components/RiskWarning/`

This is a **first-class, always-visible** component for the Tortila Bot dashboard and the admin system health page. It is not a toast, not an accordion item, not a collapsible card. It is a top-of-content banner that cannot be dismissed during a session if the underlying condition persists.

**Triggers (from seed discovery — specific to Tortila P0/P1):**

| Code | Signal | Severity |
|---|---|---|
| TP_RECONCILE | TP reconciliation/restore not yet implemented | P0 |
| MARGIN_PREFLIGHT | Margin preflight check not implemented | P0 |
| `101211` | NEAR TP placement rejection — order price below market | P1 |
| `100410` | BingX rate limit / funding warning | P1 |
| `109421` | Fill-detail lookup: order not found | P1 |
| EXCHANGE_FLAT_MISMATCH | Bot position vs exchange position mismatch | P1 |
| ADAPTER_STALE | Journal adapter data older than threshold | P2 |

**Anatomy:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠  RISK WARNING — Tortila Bot                         [Details] │
│                                                                   │
│  P0  TP reconciliation not implemented. Do not rely on take-     │
│      profit placement until this is resolved.                     │
│                                                                   │
│  P0  Margin preflight check not implemented. Increase in         │
│      position size or new instruments carry unverified risk.      │
│                                                                   │
│  P1  2 NEAR TP rejections (101211) in last 24h                   │
└─────────────────────────────────────────────────────────────────┘
```

**Visual:**
- Background: `rgba(255,107,116,.08)` 
- Border: `rgba(255,107,116,.28)`, 1px, `--radius-sm`
- Left accent bar: 3px `--red`
- Header text: `--red`
- Detail text: `--muted`
- No glow, no animation on this component — severity is communicated by presence and position, not motion

**Display rules:**
- Rendered at the top of the Tortila dashboard, above all MetricCards
- P0 warnings are always expanded and cannot be collapsed
- P1 warnings can be collapsed to a summary count after first view, but the collapsed state shows a non-green badge
- Never replace with a "Bot Healthy" green card when P0 items are unresolved

---

### 7.17 ProductStatusCard

**Location:** `packages/ui/src/components/ProductStatusCard/`

Used in `/app/products` overview and `/app` dashboard to show the user's subscription/access state for each product.

**Anatomy:**

```
┌──────────────────────────────────────────────────────┐
│  [product icon]   Axioma Terminal          [badge]   │
│                   Axioma Trading Terminal             │
│                                                       │
│  License          Account Link       Version          │
│  Active           Connected          v2.1.4           │
│                                                       │
│  [Open Journal]              [Download]              │
│                                                       │
│  Renews 2026-08-01                                   │
└──────────────────────────────────────────────────────┘
```

**States per product:**

| Product | Key states to show |
|---|---|
| `axioma_terminal` | License state · Account link state · Latest version · Download CTA · Open Journal CTA |
| `tortila_bot` | Entitlement · Risk warning count · Open Journal CTA · Adapter health |
| `legacy_bot` | Entitlement · Adapter health · Open Panel CTA |
| `tradingview_indicators` | Entitlement · TV username · Grant status · Expiry |
| `education` | Entitlement · Enrollment count · Last activity |
| `club` | Entitlement · Access level |

**Locked/unentitled state:** Shows product name, description, locked badge, and an "Unlock" CTA. Does not show any operational data.

---

### 7.18 ChartWrapper

**Location:** `packages/ui/src/components/ChartWrapper/`

Wraps Recharts (MVP) and lightweight-charts (equity / candlestick). Enforces consistent sizing, dark theme, and loading/empty/error patterns.

**Inner area background:** `--bg` (darker than panel, for chart contrast)

**Chart colors:**

| Series | Color |
|---|---|
| Primary line | `--cyan` |
| Secondary line | `--gold` |
| Positive area fill | `rgba(84,214,161,.12)` |
| Negative area fill | `rgba(255,107,116,.12)` |
| Grid lines | `--stroke` |
| Axis labels | `--dim` |
| Tooltip background | `--panel2` |
| Tooltip border | `--stroke` |

**Loading:** `SkeletonChart` placeholder matching exact chart height.

**Empty:** "No data yet" centered in chart area (no illustration).

**Error:** "Chart data unavailable — [error detail]" with retry button.

**Rules:**
- Never show flat `$0` line as a placeholder equity chart
- Y-axis zero must be labeled (shows whether equity is above or below zero)
- Drawdown line is a distinct series, not overlaid on equity without distinction
- Charts on mobile collapse to a smaller height and hide secondary axes

---

## 8. State Matrix

The following matrix defines the visual treatment for the six canonical states across key interactive components. States map directly to the loading/data lifecycle and entitlement states defined in the seed.

### States defined

| State | Code | Trigger |
|---|---|---|
| **Idle** | `idle` | Default, no active operation |
| **Loading** | `loading` | Fetch in progress |
| **Success** | `success` | Operation completed |
| **Error** | `error` | Fetch/operation failed |
| **Disabled** | `disabled` | Action not available (unentitled, missing permission) |
| **Empty** | `empty` | No data exists |

---

### MetricCard State Matrix

| State | Value | Label | Delta | Timestamp | Border |
|---|---|---|---|---|---|
| `idle` | Numeric value | `--dim` label | `--green`/`--red` | Updated Xs ago | `--stroke` |
| `loading` | `SkeletonText` | `SkeletonText` | hidden | hidden | `--stroke` |
| `success` | Value flashes briefly | Same | Same | "just now" | Briefly `--green` ring (200ms) then `--stroke` |
| `error` | `—` em dash | Same | hidden | "Error" in `--red` | `--red` at 30% |
| `disabled` | `—` | `--dim` | hidden | hidden | `--stroke` at 50% |
| `empty` | `—` | Same | hidden | "No data" | `--stroke` |

---

### Button State Matrix

| State | Background | Text | Border | Cursor | Extra |
|---|---|---|---|---|---|
| `idle` | Variant default | Variant default | Variant default | `pointer` | — |
| `loading` | Variant default | hidden | Same | `wait` | Spinner replaces text |
| `success` | `--green` 15% | `--green` | `--green` 30% | `default` | Checkmark icon, 1.5s then revert |
| `error` | `--red` 15% | `--red` | `--red` 30% | `pointer` | Error icon, message in Toast |
| `disabled` | `--panel` | `--dim` | `--stroke` 50% | `not-allowed` | `aria-disabled="true"` |

---

### Form Field State Matrix

| State | Border | Background | Icon | Helper text |
|---|---|---|---|---|
| `idle` | `--stroke` | `--panel2` | none | Hint text in `--dim` |
| `loading` | `--stroke` | `--panel2` | Spinner (right) | "Validating..." in `--dim` |
| `success` | `--green` (2s then revert) | `--panel2` | Check (2s) | "Saved" in `--green` |
| `error` | `--red` | `rgba(255,107,116,.06)` | Exclamation | Error message in `--red` |
| `disabled` | `--stroke` 50% | `--panel` 50% | Lock (if access) | `--dim` |
| `empty` | `--stroke` | `--panel2` | none | Placeholder text in `--dim` |

---

### DataTable State Matrix

| State | Rows | Header | Footer |
|---|---|---|---|
| `idle` | Data rows with hover | Sticky, sort indicators | Pagination controls |
| `loading` | `SkeletonTable` (5 rows) | Same, sort disabled | Pagination disabled |
| `success` | Rows flash `--green` bg (200ms) | Same | Updated count |
| `error` | `ErrorState` component spanning all columns | Same | Retry button |
| `disabled` | Grayed rows, no hover, no click | `--dim` headers | `--dim` controls |
| `empty` | `EmptyState` component spanning all columns | Same | No pagination |

---

### Bot Dashboard (composite) State Matrix

| State | MetricCards | Positions table | RiskWarning | Controls |
|---|---|---|---|---|
| `idle` | Live values | Live rows | Shown if signals present | Buttons enabled (mock) |
| `loading` | Skeleton cards | Skeleton table | Shown if cached | Buttons disabled |
| `success` (after action) | Cards refresh | Table refreshes | Re-evaluated | Buttons revert to idle |
| `error` (adapter down) | Error cards | ErrorState | Shown + ADAPTER_STALE warning | Buttons disabled |
| `disabled` (unentitled) | Locked placeholder | Locked EmptyState | N/A | Upgrade CTA |
| `empty` (no data yet) | EmptyState cards | EmptyState table | N/A | Setup wizard CTA |

---

### ProductStatusCard State Matrix

| State | Badge | Actions | Data rows |
|---|---|---|---|
| `idle` | Entitlement badge | Enabled | Account link / version / expiry |
| `loading` | Skeleton badge | Disabled | Skeleton text |
| `success` (after link) | `active` badge | Enabled | Updated data |
| `error` (bridge down) | `--gold` "Degraded" | Open Journal disabled, tooltip explains | Last cached data with `[STALE]` |
| `disabled` (unentitled) | `locked` badge | "Unlock" CTA only | None |
| `empty` (account not linked) | `pending` badge | "Connect Account" CTA | N/A |

---

### Tabs State Matrix

| State | Tab item | Panel |
|---|---|---|
| `idle` | Default style | Content |
| `loading` | Disabled + spinner on active | `SkeletonTable` / `SkeletonCard` |
| `success` | Active gold indicator | Refreshed content |
| `error` | Default | `ErrorState` in panel |
| `disabled` | `--dim` + `not-allowed` | Not accessible |
| `empty` | Default | `EmptyState` in panel |

---

## 9. Product-Specific Patterns

### 9.1 Axioma Terminal Module

Axioma is a first-class WTC product module. The following UI patterns are mandatory:

**`/app/terminal` dashboard sections (in order):**

1. **License & Entitlement** — `ProductStatusCard` with license state from `axioma_account_links` + bridge. States: active / grace / expired / not-linked / error.

2. **Account Link Status** — Connection to `axi-o.ma` journal server. States: connected / not-linked / linking-in-progress / error. "Connect Account" button opens a Drawer with step-by-step account link flow.

3. **Download** — Latest release from `terminal_release_cache`. Shows version, release date, channel (stable/beta), changelog excerpt. Download CTA opens signed URL or shows pending if not entitled. States: download-available / downloading / already-installed (device-linked) / not-entitled.

4. **Open Axioma Journal** — CTA to open `axi-o.ma` journal in new tab (or signed handoff if SSO is implemented). States: available / degraded (bridge health check failed) / not-linked.

5. **Release Notes** — Last 3 releases from cache. Collapsed accordion per release.

6. **Support / FAQ** — Links to support ticket creation within WTC, links to Axioma-specific documentation.

**Public `/products/terminal` page (marketing):**
- Product headline + Georgia-italic accent
- Terminal mockup screenshot inside the `terminal-frame` pattern from `v2-terminal-os.html`
- Feature list (Journal, Charts, Local key encryption, Release cadence)
- Pricing / subscribe CTA
- No live data, no entitlement checks

**The Axioma module must never be a bare link.** Even when the bridge is down, the page shows the product description, last-known state, and a degraded-service notice.

---

### 9.2 Tortila Bot Module

**`/app/bots/tortila` sub-navigation:**
- Overview (default)
- Positions
- Trades
- Equity
- Safety / Warnings
- Config / Settings
- Backtester

**RiskWarning banner placement:**
- Rendered at the very top of every Tortila sub-page (Overview, Positions, Safety), not just on a dedicated "Safety" tab
- On the Safety tab: expanded full detail for each signal
- On Overview/Positions: compact summary with count and severity badges

**Adapter health indicator:**
- Shows last successful sync timestamp from Tortila Journal `:8080`
- If stale > 30s: orange STALE badge next to all metrics
- If unreachable: ERROR badge, last-known cached values shown with explicit warning

**Bot controls (all mock until adapter audited):**
- Start/Stop buttons present but render with `[MOCK]` badge in development
- Never show a green "Running" status as the default starting state — fetch actual status from adapter health endpoint

---

### 9.3 Legacy Bot Module

Same structure as Tortila but simplified — no backtester, no safety tab (legacy bot does not expose the same risk signals).

Config form fields map to the old bot settings shape: symbols, RSI/CCI params, averaging levels, TP %, leverage, balance %, stages/slots.

---

### 9.4 TradingView Indicators Module

**User flow visual states:**

```
[No TV username] → "Enter Username" form
[Username submitted, pending] → pending badge + "Admin processing" message
[Granted] → active badge + indicator list + expiry date
[Expiring soon] → gold badge + "Renew access" CTA
[Expired] → gray badge + "Renew" CTA
[Revoked] → red badge + reason if available
```

No automation interface is shown to users. The admin queue is in `/admin/tradingview-access`.

---

### 9.5 Education Module (v3-editorial direction)

For education content, the editorial warmth of `v3-editorial-authority.html` informs the visual language: slightly more generous line-height, Georgia headings for course titles, content-forward layout. The dark tokens remain — this is not a light-mode switch.

**Course card:** Shows chapter number in `--gold`, course title in `display-md`, completion progress bar in `--green`.

**Lesson page:** Full-width reading layout, max-width 780px centered, `body-lg` text, video/embed full-width.

**Teacher dashboard:** Standard admin-style panel using the dark design tokens — editorial aesthetic only for student-facing pages.

---

## 10. Responsive Strategy

### Breakpoints

| Name | Width | Description |
|---|---|---|
| `xs` | < 480px | Small phones |
| `sm` | 480px – 768px | Large phones |
| `md` | 768px – 1050px | Tablets, small laptops |
| `lg` | 1050px – 1240px | Standard desktops |
| `xl` | > 1240px | Wide desktops |

### Dashboard Layout

| Breakpoint | SideNav | Content |
|---|---|---|
| `xl` / `lg` | 240px fixed sidebar | Full dashboard grid |
| `md` | 64px icon sidebar | Single-column grid |
| `sm` / `xs` | Bottom tab bar (5 items max) | Single-column, stack layout |

### Table Responsiveness

Tables never scroll horizontally and never break layout. Mobile strategy per table type:

| Table | Mobile treatment |
|---|---|
| Trade history | Priority columns only (date, symbol, PnL). "Details" row tap opens Drawer. |
| Positions | Priority columns only (symbol, side, size, unrealPnL). Drawer for detail. |
| Bot config settings | Converted to Accordion per section. Each param is a full-width form field. |
| Audit log | Priority: timestamp, action, user. Drawer for full details. |
| Admin user list | Priority: email, role, status. Drawer for actions. |

**Column priority system:**
- Priority 1: always visible (minimum required to scan)
- Priority 2: visible at `md` and up
- Priority 3: visible at `lg` and up (desktop only)

### Form Responsiveness

All forms in the bot setup wizard and config use a single-column layout on `sm`/`xs`. Two-column forms (desktop) become stacked on mobile. Drawer-based forms are full-screen on mobile.

### Chart Responsiveness

Charts respond to container width. On mobile:
- Height reduced from 300px to 180px
- Secondary Y-axis hidden
- Tooltip repositioned to bottom on mobile

---

## 11. Anti-patterns

The following patterns are explicitly forbidden in this design system:

| Anti-pattern | Why | Correct pattern |
|---|---|---|
| Empty gradient-blob hero on auth pages | Not a marketing page — app shell starts at the dashboard | SideNav + TopBar + content immediately |
| "Ecosystem Online" green card with no real data | Hides real adapter status | Show actual adapter health, STALE badges |
| Single collapsible "Risk Events" accordion (default closed) | Hides P0/P1 Tortila warnings | `RiskWarning` banner, default open, P0 items non-collapsible |
| Progress bar as entitlement placeholder | Implies quantified access that doesn't exist | `ProductStatusCard` with explicit state |
| Gamification elements (streaks, points, level badges) | Not appropriate for professional trading tools | Plain status badges and data |
| Overlapping gold gradient backgrounds on cards | Reduces readability; signals distrust | Single-color `--panel` surface, gold for borders/text only |
| `$0.00` placeholder metric values | Misleads about actual zero equity vs no data | `Skeleton` until data arrives |
| Axioma as a `<a href="https://axi-o.ma">Open Terminal</a>` link only | Violates first-class product rule | Full `ProductStatusCard` + account link flow |
| Bot status as hardcoded "Running" green dot | Lies about actual adapter state | Fetch from adapter health, show STALE/ERROR if offline |
| Hiding the Tortila TP reconciliation warning until the tab is clicked | P0 issue must be immediately visible | `RiskWarning` banner on every bot sub-page |
| One React component for the entire dashboard | Violates bounded context architecture | Feature-level components in `features/` per architecture |

---

## 12. Implementation Notes

### Package structure

```
packages/ui/
  src/
    tokens.css                  # CSS custom properties — canonical token source
    components/
      TopBar/
        index.tsx
        TopBar.tsx
        TopBar.test.tsx
      SideNav/
      Card/
      MetricCard/
      DataTable/
      Form/
        TextInput.tsx
        PasswordInput.tsx
        SecretInput.tsx
        Select.tsx
        Combobox.tsx
        Checkbox.tsx
        Toggle.tsx
        Textarea.tsx
        NumberStepper.tsx
        RangeSlider.tsx
        FilePicker.tsx
      Tabs/
      Drawer/
      Accordion/
      Badge/
      Button/
      EmptyState/
      ErrorState/
      Skeleton/
      Toast/
      RiskWarning/
      ProductStatusCard/
      ChartWrapper/
    layouts/
      AppShell.tsx              # SideNav + TopBar + content area
      PublicShell.tsx           # TopBar (marketing) + footer
      AdminShell.tsx            # Admin-specific nav
    index.ts                    # barrel export
```

### Tailwind v4 setup

`packages/ui/src/tokens.css` is imported in `apps/web/src/app/globals.css` via `@import "../../../../packages/ui/src/tokens.css"`. Tailwind v4 reads CSS variables through `@theme inline` declaration.

### Component testing

Every component ships with a Vitest test file covering:
- Default render does not throw
- All state variants render (loading, error, empty)
- Accessibility: focus management, aria attributes
- `disabled` state prevents click handlers

Playwright visual tests in `tests/e2e/components/` cover the state matrix for MetricCard, RiskWarning, and ProductStatusCard at desktop and mobile viewport sizes.

### Accessibility baseline

- All interactive elements meet WCAG 2.1 AA contrast ratios (dark-on-dark panels with `--text` #f1f5f9 against `--panel` #0b1423: ratio 12.4:1 — passes)
- `--gold` (#d5a94f) on `--panel` (#0b1423): ratio 7.1:1 — passes AA and AAA
- `--dim` (#64748b) on `--panel` (#0b1423): ratio 4.6:1 — passes AA (large text only for dim; body text uses `--muted` #94a3b8 which is 6.1:1)
- Focus rings visible at all zoom levels
- Skeleton components set `aria-hidden="true"` and `aria-busy="true"` on parent
- RiskWarning uses `role="alert"` with `aria-live="polite"` for dynamic updates

---

*Cross-references:*
- Component states consume entitlement states from [ENTITLEMENT_STATE_MACHINE.md](./ENTITLEMENT_STATE_MACHINE.md)
- Bot adapter health signals map to [BOT_INTEGRATION_PLAN.md](./BOT_INTEGRATION_PLAN.md)
- Axioma bridge states map to [CONTRACTS/axioma-bridge.md](./CONTRACTS/axioma-bridge.md)
- Risk warning codes sourced from [BOT_CONTROL_SAFETY_MODEL.md](./BOT_CONTROL_SAFETY_MODEL.md)
- Token implementation is owned by `packages/ui` per [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 13. Phase 2 Amendments (20260530)

This section records additions and corrections made during Phase 2 UX specification. The token set
and design philosophy in sections 1–8 remain authoritative and unchanged.

### 13.1 New composite components required by Phase 2

The following composites are added to `packages/ui` inventory for Phase 2 implementation. Full
specs live in `docs/UX_SPEC_PHASE2.md`.

| Component | Path | Purpose |
|---|---|---|
| `EntitlementGate` | `components/EntitlementGate/` | Wraps any content; shows locked/upgrade state when `allowed=false` |
| `SetupWizard` | `components/SetupWizard/` | Multi-step wizard shell (bot setup, exchange key vault, Axioma link) |
| `ExchangeKeyVaultForm` | `components/ExchangeKeyVaultForm/` | Exchange API key entry — SecretInput fields, never plaintext in DOM |
| `SymbolEditor` | `components/SymbolEditor/` | Combobox + tag list for bot symbol configuration |
| `RiskEditor` | `components/RiskEditor/` | RangeSlider + NumberStepper fields for bot risk parameters |
| `EquityChart` | `components/EquityChart/` | ChartWrapper specialised: equity + drawdown dual series |
| `BacktesterResultCard` | `components/BacktesterResultCard/` | Tabular backtest metrics + equity chart placeholder |
| `CourseCard` | `components/CourseCard/` | Student-facing course entry: title, progress bar, CTA |
| `LessonPage` | `components/LessonPage/` | Full-width reading layout, video embed, materials list |
| `TeacherCourseEditor` | `components/TeacherCourseEditor/` | Accordion-per-module course builder |
| `PricingTable` | `components/PricingTable/` | Responsive plan comparison: features matrix, CTA per plan |
| `ProductFeatureGrid` | `components/ProductFeatureGrid/` | 2-4 column feature cards used on public product pages |
| `AdminQueue` | `components/AdminQueue/` | TradingView access request list with approve/revoke actions |
| `BotSubNav` | `components/BotSubNav/` | Tab strip for bot sub-pages (Overview / Positions / Trades / Equity / Safety / Config / Backtester) |
| `AxiomaAccountLinkDrawer` | `components/AxiomaAccountLinkDrawer/` | Step-by-step account link flow in a Drawer |
| `DevPlaceholderBanner` | `components/DevPlaceholderBanner/` | Consistent "dev placeholder — not a live endpoint" banner |
| `CompareAnalyticsView` | `components/CompareAnalyticsView/` | Side-by-side bot metrics comparison (Tortila vs Legacy) |
| `SupportTicketForm` | `components/SupportTicketForm/` | Support ticket creation within WTC (title, body, product selector) |

### 13.2 WarnBanner alias

`DevPlaceholderBanner` is the Phase 2 name for the "mock/read-only/live-disabled" inline warning
pattern. It uses the same visual as `RiskWarning` variant `info` (cyan left border, `--panel`
background) but carries a fixed prefix "DEV PLACEHOLDER" or "SIMULATED DATA" in its header, never
a plain description that could be mistaken for a real warning.

### 13.3 ProductCard

The existing `Card` + `StatusPill` composition used in `/app/products` is formalised as
`ProductCard` for Phase 2. It replaces the ad-hoc `wtc-card` + header pattern with explicit props:
`icon`, `title`, `statusLabel`, `statusTone`, `description`, `cta`, `href`, `locked`. The locked
state renders `EntitlementGate` overlay inside the card, not a separate page.

### 13.4 Corrections to existing implementation

The following gaps between the Phase 1 implementation and DESIGN_SYSTEM.md v1.0 are noted for
Phase 2 closure:

| Gap | Phase 1 state | Phase 2 requirement |
|---|---|---|
| Bot sub-pages (equity, safety, settings) are `BotSubPagePlaceholder` | Placeholder text | Full component composition per UX_SPEC_PHASE2.md §3 |
| Teacher course list has no lesson editor link | Basic list | Full `TeacherCourseEditor` per UX_SPEC_PHASE2.md §7 |
| Pricing page has no feature comparison | Plan cards only | `PricingTable` with feature matrix per UX_SPEC_PHASE2.md §2.2 |
| Product pages are minimal (two cards) | Sparse | Full `ProductFeatureGrid` + hero per UX_SPEC_PHASE2.md §2.1 |
| Billing page is dev-only mock checkout | Functional for dev | Keep warning; add entitlement renewal flow spec |
| Admin system-health page is Placeholder | Empty | Full spec per UX_SPEC_PHASE2.md §9 |
| `SecretInput` is specified but not in `packages/ui` exports | Not exported | Add to `index.ts` in Phase 2 |
| `DataTable` is specified but only `wtc-table` class used | Inline HTML tables | `DataTable` component with priority columns, mobile Drawer |

### 13.5 Mock/dev data warning pattern (mandatory)

Every data surface connected to a mock adapter, a dev bridge, or an in-memory fallback must render
a `DevPlaceholderBanner` (or the existing `RiskWarningBanner severity="warning"/"info"`) with one
of the following mandatory phrases visible to the user:

- "Simulated data — not a live account" (bot mock adapter)
- "Dev placeholder — not a live endpoint" (Axioma bridge in dev mode)
- "Storage: in-memory (dev) — resets on restart" (LMS/TV in-memory fallback)
- "Mock checkout — hard disabled in production" (billing dev self-grant)

The banner must appear above all operational data on the page. It must not be below a data grid or
inside an accordion.

---

## 14. Phase 2.11 / PG8 Admin Console Responsive Spec (20260530)

Owner: ecosystem-ux-ui-designer. Implementer target: PG8 frontend sprint.
This section is binding — every admin page MUST conform.

---

### 14.1 Responsive pattern decision: CSS data-label card-stack

**Decision: use the CSS-only data-label card-stack pattern.** The wrapper scroll option (option a)
is explicitly rejected because "no horizontal scroll" is a hard requirement from the orchestrator.
A shared `<DataCards>` / `<ResponsiveTable>` component layer is NOT required for PG8; the pure CSS
approach suffices and eliminates a new component dependency. If the component is later warranted
(Phase 3+), it can be extracted from the CSS-only base.

**Where the CSS lives:** Add a new rule block to `packages/ui/src/theme.css` under the existing
`.wtc-table` block (not in `apps/web/src/app/globals.css` — the design system owns this, not the
app). Keep it in `theme.css` so all admin pages and any future app tables inherit it.

**CSS spec (add to packages/ui/src/theme.css after the existing `.wtc-table tr:hover td` rule):**

```css
/* ── Responsive table: card-stack at 640px ──────────────────────────────── */
/*
 * Usage:
 *   Wrap <table className="wtc-table"> in <div className="wtc-table-wrap">
 *   Each <td> must have data-label="Column Header" to render the label in
 *   the card view. No JavaScript; pure CSS media query.
 */
.wtc-table-wrap { width: 100%; }

@media (max-width: 640px) {
  .wtc-table-wrap table,
  .wtc-table-wrap thead,
  .wtc-table-wrap tbody,
  .wtc-table-wrap th,
  .wtc-table-wrap td,
  .wtc-table-wrap tr { display: block; }

  /* Hide the original column headers — labels come from data-label */
  .wtc-table-wrap thead { display: none; }

  /* Each row becomes a card */
  .wtc-table-wrap tbody tr {
    border: 1px solid var(--stroke);
    border-radius: var(--radius);
    margin-bottom: 12px;
    padding: 12px;
    background: rgba(14, 26, 43, 0.6);
  }
  .wtc-table-wrap tbody tr:last-child { margin-bottom: 0; }

  /* Each cell: label above value */
  .wtc-table-wrap td {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.07);
    font-size: 13px;
  }
  .wtc-table-wrap td:last-child { border-bottom: none; padding-bottom: 0; }
  .wtc-table-wrap td:first-child { padding-top: 0; }

  /* Label injected from data-label attribute */
  .wtc-table-wrap td::before {
    content: attr(data-label);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--dim);
    flex-shrink: 0;
    padding-top: 2px;
    min-width: 90px;
  }

  /* The "Action" cell: full-width, stacked, centered */
  .wtc-table-wrap td.wtc-td-action {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .wtc-table-wrap td.wtc-td-action::before {
    display: none;  /* Action cell needs no label */
  }
  .wtc-table-wrap td.wtc-td-action form { width: 100%; }
  .wtc-table-wrap td.wtc-td-action .wtc-input { font-size: 13px; }
  .wtc-table-wrap td.wtc-td-action .wtc-btn { width: 100%; justify-content: center; }
}
```

**Markup change required on every admin table (four-step):**
1. Wrap `<table className="wtc-table">` with `<div className="wtc-table-wrap">`.
2. Add `data-label="Column Header"` to every `<td>` matching its `<th>` header text.
3. For the Action column `<td>`, also add `className="wtc-td-action"` (suppresses label,
   makes forms full-width).
4. No other change required — the rest is CSS.

---

### 14.2 TradingView 10-column table: exact mobile spec

The tradingview-access table is the hardest case because the Action `<td>` contains nested
`<form>` elements with inputs and buttons. The `wtc-td-action` treatment above handles it:
the action cell becomes a full-width block, each form stacks vertically, inputs and buttons
stretch to fill available width.

**Priority column reduction for TradingView at 640px:**
Do NOT hide columns via JS — the card-stack shows all columns as labelled rows. This is
intentional: each row becomes a self-contained "record card" showing all relevant data.
The Action cell with its form is always last, full-width.

**TradingView card-stack render at 375px (per row):**

```
┌──────────────────────────────────────────┐  border: 1px --stroke; radius: 18px; padding: 12px
│  USER           user@example.com         │  font-size 13px
│  TV USERNAME    tradingview_handle        │  mono
│  STATUS         [pending pill]            │  StatusPill
│  SUBMITTED      2026-05-01               │  mono, dim
│  GRANTED        —                        │
│  GRANTED BY     —                        │
│  EXPIRES        —                        │
│  REVOKED        —                        │
│  REVOKED BY     —                        │
├──────────────────────────────────────────┤  separator
│  [reason for grant input ——————————————] │  full-width, 13px
│  [duration select ————————————————————]  │  full-width
│  [Grant access ————————————————————————] │  full-width secondary btn
│  [reason for revoke input —————————————] │  only if granted/expiring_soon
│  [Revoke ——————————————————————————————]  │  full-width ghost btn, red text
└──────────────────────────────────────────┘
```

Tap targets: minimum 44px height for all buttons. Inputs minimum 44px height on mobile.
Add to `packages/ui/src/theme.css`:
```css
@media (max-width: 640px) {
  .wtc-input { min-height: 44px; }
  .wtc-btn   { min-height: 44px; }
}
```

---

### 14.3 Honest state-pill taxonomy (canonical — all 8 admin pages)

**The complete pill set. Use ONLY these; do not improvise new variants.**

| Pill label | Tone | CSS class | Trigger condition | Pages |
|---|---|---|---|---|
| `storage: Postgres` | `ok` | `.wtc-pill.ok` | `mode === 'postgres'` | All 8 |
| `storage: in-memory (demo)` | `warn` | `.wtc-pill.warn` | `mode === 'demo'` | All 8 |
| `0 records` | `neutral` | `.wtc-pill` | Empty result set on a table/list | All 8 |
| `adapter: mock` | `warn` | `.wtc-pill.warn` | `adapterMode === 'mock'` | bots |
| `adapter: read-only` | `neutral` | `.wtc-pill` | `adapterMode === 'read-only'` | bots |
| `adapter: audited` | `ok` | `.wtc-pill.ok` | `adapterMode === 'audited'` | bots |
| `LIVE CONTROL: DISABLED` | `bad` | `.wtc-pill.bad` | Always (hardcoded `liveControlDisabled:true`) | bots, system-health |
| `LEGACY: BLOCKED` | `bad` | `.wtc-pill.bad` | Always (hardcoded `legacyAdapterBlocked:true`) | bots |
| `TV AUTOMATION: DISABLED` | `bad` | `.wtc-pill.bad` | Always (hardcoded `tvAutomationDisabled:true`) | system-health, bots |
| `base URL: configured` | `neutral` | `.wtc-pill` | `tortilaBaseUrlConfigured === true` | bots |
| `base URL: not set` | `warn` | `.wtc-pill.warn` | `tortilaBaseUrlConfigured === false` | bots |
| `N pending` (review queue) | `bad` | `.wtc-pill.bad` | `reviewItems.length > 0` | entitlements, system-health |
| `0 pending` | `ok` | `.wtc-pill.ok` | `reviewItems.length === 0` | entitlements, system-health |
| `published` | `ok` | `.wtc-pill.ok` | `course.isPublished` | education |
| `draft` | `warn` | `.wtc-pill.warn` | `!course.isPublished` | education |
| `active` (teacher) | `ok` | `.wtc-pill.ok` | `teacher.isActive` | education |
| `inactive` (teacher) | `bad` | `.wtc-pill.bad` | `!teacher.isActive` | education |
| `open` (ticket) | `bad` | `.wtc-pill.bad` | `ticket.status === 'open'` | support |
| `in progress` | `warn` | `.wtc-pill.warn` | `ticket.status === 'in_progress'` | support |
| `resolved` / `closed` | `ok` | `.wtc-pill.ok` | `status === 'resolved'\|'closed'` | support |
| `urgent` (priority) | `bad` | `.wtc-pill.bad` | `ticket.priority === 'urgent'` | support |
| `high` | `warn` | `.wtc-pill.warn` | `ticket.priority === 'high'` | support |
| `normal` / `low` | `neutral` | `.wtc-pill` | `priority === 'normal'\|'low'` | support |
| `pending` (TV) | `warn` | `.wtc-pill.warn` | `status === 'pending'\|'expiring_soon'` | tradingview-access |
| `granted` | `ok` | `.wtc-pill.ok` | `status === 'granted'` | tradingview-access |
| `expired` / `revoked` | `bad` | `.wtc-pill.bad` | `status === 'expired'\|'revoked'` | tradingview-access |
| `ok` (health check) | `ok` | `.wtc-pill.ok` | `hc.status === 'ok'\|'healthy'` | system-health, bots |
| `degraded` / `error` | `bad` | `.wtc-pill.bad` | any non-ok health check status | system-health, bots |
| `admin` (role) | `bad` | `.wtc-pill.bad` | `role === 'admin'` | users |
| `teacher` | `warn` | `.wtc-pill.warn` | `role === 'teacher'` | users |
| `user` | `neutral` | `.wtc-pill` | `role === 'user'` | users |
| `pending` (review item) | `warn` | `.wtc-pill.warn` | `item.status === 'pending'` | entitlements/review |
| `active` (entitlement) | `ok` | `.wtc-pill.ok` | `eff === 'active'` | entitlements |
| `grace` | `warn` | `.wtc-pill.warn` | `eff === 'grace'` | entitlements |
| `expired` / `revoked` / `refunded` | `bad` | `.wtc-pill.bad` | other non-active states | entitlements |

**Rule:** `neutral` tone renders as `.wtc-pill` without a modifier class. The dot is `--muted`,
border is `--stroke`, text is `--muted`. Use it for informational pills that are neither alarming
nor reassuring (e.g., storage info for configured states, role = 'user').

---

### 14.4 Admin MobileNav: add to layout.tsx (PG8 required)

**Assessment:** The admin console has zero navigation below 900px. The sidenav is `display:none`
and `<MobileNav>` is not rendered by `apps/web/src/app/admin/layout.tsx`. ADMIN_NAV has 10 items.
The (app) layout correctly renders `<MobileNav items={APP_NAV} />`. Admin does not.

**Decision:** PG8 MUST add admin mobile navigation. The existing `<MobileNav>` component and
`.wtc-mobile-nav` styles already support this exactly — zero CSS additions required. The component
reads from `NavItem[]` and applies active state via `usePathname`.

**Required change to `apps/web/src/app/admin/layout.tsx`:**
1. Import `MobileNav` from `@/components/MobileNav`.
2. Import `ADMIN_NAV` (already imported).
3. Render `<MobileNav items={ADMIN_NAV} />` as a sibling of `<main>` inside the layout div.
4. Add `pb-[88px]` to the `<main className="wtc-main">` element on mobile only — or rely on the
   existing `.wtc-main { padding-bottom: 88px }` from globals.css (already defined for
   `@media (max-width: 900px)`).

**ADMIN_NAV has 10 items — overflow treatment:**
The `.wtc-mobile-nav` CSS uses `overflow-x: auto` with `white-space: nowrap`. This is acceptable
for admin (staff-only; not consumer UX). All 10 items scroll horizontally in the pill bar.
No restructuring of ADMIN_NAV is required for PG8.

**Visual treatment is identical to the app shell's mobile nav** — premium dark bar,
`rgba(5,10,18,.94)` background, `blur(14px)`, gold-border active item. Consistent.

---

### 14.5 Per-page empty/loading/blocked/demo state map

**All 8 admin pages — full state specification**

#### /admin (overview)
| State | Treatment |
|---|---|
| `demo` | Metrics show `0`; add `storage: in-memory (demo)` pill in the wtc-grid-4 backend card |
| `postgres` | Real counts. `storage: Postgres` pill. |
| `empty` | All metrics `0`; no special treatment — this is a valid initial state |
| `error` | Not currently surfaced; data loaders do not throw in demo mode (fail-closed) |

#### /admin/users
| State | Treatment |
|---|---|
| `demo + empty` | EmptyState: "No DATABASE_URL configured — demo mode shows no users." (already correct) |
| `postgres + empty` | EmptyState: "No registered users found." (already correct) |
| `postgres + data` | Table with card-stack at 375px (requires `wtc-table-wrap` + `data-label` attrs) |

#### /admin/entitlements
| State | Treatment |
|---|---|
| `demo` | Storage pill + "Dev fallback" note. Grant/revoke forms still render (will fail gracefully). |
| `postgres + no users` | EmptyState "No users" (already correct). |
| `manual_review items pending` | BadPill "N pending" in queue card header. |
| `manual_review items 0` | OkPill "0 pending". |
| The per-user grant form and per-entitlement revoke/flag forms already have `flexWrap: 'wrap'`
  so they do not break at 375px — verified in source. No `wtc-table-wrap` needed for those inline
  forms. The product-access-timeline sub-table inside `<details>` DOES need `wtc-table-wrap`. |

#### /admin/entitlements/review
| State | Treatment |
|---|---|
| `demo` | EmptyState "Demo mode — no review items" (already correct) |
| `postgres + empty` | EmptyState "No pending items" (already correct) |
| `postgres + items` | Card-per-item. Approve/Reject/Dismiss forms use `wtc-row` + `flexWrap:'wrap'`
  already — safe at 375px. The event-snapshot `<pre>` has `overflowX:'auto'` — fine. |

#### /admin/tradingview-access
| State | Treatment |
|---|---|
| `demo` | Storage pill + note. Both tables show EmptyState. |
| `postgres + empty queue` | EmptyState: "Queue is empty" (already correct). |
| `postgres + rows` | **REQUIRES** `wtc-table-wrap` on BOTH tables. 10-col queue table and 6-col
  grant-history table both overflow without it. Action cell gets `className="wtc-td-action"`. |
| `expiring_soon` | `warn` pill; grant AND revoke forms both shown (this is already coded but
  the status pill tone mapping uses `warn` for `expiring_soon` — confirm at line 10 of page. |

#### /admin/bots
| State | Treatment |
|---|---|
| `demo` | `storage: in-memory (demo)` pill + RiskWarningBanner "Demo mode" (already correct). |
| `postgres + no checks` | EmptyState with demo-vs-postgres hint (already correct). |
| `postgres + checks` | Health checks table REQUIRES `wtc-table-wrap`. 4 cols (Target, Status,
  Checked at, Detail). |
| `adapterMode = mock` | `warn` pill: "adapter: mock". Already coded. |
| `tortilaBaseUrlConfigured = false` | `warn` pill: "base URL: not set". Already coded. |
| `tortilaLastError ≠ null` | MetricCard with `tone="down"`. Already coded. |
| **TORTILA P0/P1 warnings** | `TORTILA_PERSISTENT_WARNINGS` are mapped with `RiskWarningBanner`
  severity="error/warning". Already coded. These are non-dismissible. CONFIRM: they always render
  regardless of adapterMode — they do (loop at bots/page.tsx line 96). |
| `readState` surfacing | The `readState` field on `BotHealth` (`ok/not_configured/unreachable/
  malformed/stale`) is NOT currently surfaced in the admin/bots page. The page shows
  `adapterMode` (env-based) and `tortilaLastOkAt/tortilaLastError` (DB-based health checks).
  For PG8, add a `readState` pill derived from `tortilaLastOkAt` and `tortilaLastError`:
  if `tortilaLastOkAt=null && tortilaLastError=null` → neutral "read-state: no data";
  if `tortilaLastError!=null` → bad "read-state: error";
  if `tortilaLastOkAt!=null && !tortilaLastError` → ok "read-state: ok";
  This is a UI-only derivation from existing query data — no schema change. |

#### /admin/education
| State | Treatment |
|---|---|
| `demo` | Pill + note. Already coded. |
| `postgres + empty` | EmptyState per table. Already coded. |
| `postgres + courses` | The 4-col courses table REQUIRES `wtc-table-wrap`. |
| Layout bug | This page uses `<main className="wtc-container" style={{padding:'34px 22px'}}>` as
  its root instead of `<div className="wtc-stack">` like every other admin page. This means
  it renders a SECOND `<main>` inside the layout's `<main className="wtc-main">` — invalid HTML
  (nested `<main>` is non-conforming). Fix: change to `<div className="wtc-stack">` to match
  all other admin pages. The `wtc-grid-4` MetricCards have no containing `.wtc-grid` wrapper —
  they need `<div className="wtc-grid wtc-grid-4">` wrapping them (line 25). |

#### /admin/support
| State | Treatment |
|---|---|
| `demo` | Pill + note. Already coded. |
| `postgres + empty` | EmptyState with filter-aware hint. Already coded. |
| `postgres + tickets` | Ticket cards use `.wtc-card` with `flexWrap:'wrap'` — safe at 375px.
  Status update form uses `wtc-row` + `flexWrap:'wrap'` — safe. No table to wrap. |
| Filter nav | The status filter links (`all / open / in_progress / resolved / closed`) are a
  `wtc-row` with `flexWrap:'wrap'` — safe at 375px. |

#### /admin/system-health
| State | Treatment |
|---|---|
| `demo` | `storage: in-memory (demo)` pill + note. Already coded. |
| `postgres` | `storage: Postgres` pill. Safety-disabled cards show DISABLED pills. |
| `safety states` | Both `DISABLED` pills always visible (`liveControlDisabled:true` hardcoded).
  Already coded. |
| `health checks` | Integration health checks table REQUIRES `wtc-table-wrap`. 4 cols. |
| `tvQueueCounts` | MetricCard row already uses `flexWrap:'wrap'`. Safe. |

---

### 14.6 Tortila readState / BotHealth surfacing in admin/bots

The `readState` type (`ok | not_configured | unreachable | malformed | stale`) from
`packages/bot-adapters/src/types.ts` is the most precise signal of WTC's ability to read the
journal. However, it is computed by the adapter's `getHealth()` call, not from DB rows.

The admin/bots page currently surfaces the DB-backed signals (`tortilaLastOkAt`,
`tortilaLastError`) which are the persisted version of what the worker observed last time it ran.
This is correct for an admin ops page — it reflects the last worker cycle, not a live probe.

**PG8 decision:** Keep DB-backed signals as primary. Add a derived pill:
- `tortilaLastOkAt !== null && !tortilaLastError` → `ok` pill "journal: last check ok"
- `tortilaLastError !== null` → `bad` pill "journal: last check error"
- `tortilaLastOkAt === null && tortilaLastError === null && mode === 'postgres'` → `neutral`
  pill "journal: no checks recorded (worker not run)"
- `mode === 'demo'` → `warn` pill "journal: demo mode"

No schema change. No new query. Derived from existing `AdminBotHealthResult` fields.

---

### 14.7 Migration assessment

**No DB migration is required for PG8.** All required data already exists in the schema:
- `mode` (postgres/demo): computed from `getServerDb()` null-check
- `revokeReason`, `expiresAt`: in `tradingview_access_grants` (PG5, migration 0003)
- `tortilaLastOkAt`, `tortilaLastError`: derived from `integration_health_checks`
- `readState` surfacing: derived from existing query results, no new columns
- Bot readState history: not persisted (adapter is stateless); DB signals are sufficient for ops

PG8 is CSS + layout work + one layout.tsx change. Zero migrations.

---

### 14.8 Implementation checklist for frontend implementer

**packages/ui/src/theme.css:**
- [ ] Add `.wtc-table-wrap` + `@media (max-width:640px)` card-stack rules (section 14.1 CSS)
- [ ] Add `@media (max-width:640px) .wtc-input, .wtc-btn { min-height: 44px }` (section 14.2)

**apps/web/src/app/admin/layout.tsx:**
- [ ] Import `MobileNav` from `@/components/MobileNav`
- [ ] Render `<MobileNav items={ADMIN_NAV} />` after `</main>` inside the shell div

**apps/web/src/app/admin/tradingview-access/page.tsx:**
- [ ] Wrap both `<table className="wtc-table">` blocks in `<div className="wtc-table-wrap">`
- [ ] Add `data-label="User"` ... `data-label="Revoked by"` to every `<td>` in queue table
- [ ] Add `className="wtc-td-action"` to the Action `<td>` (replaces label, makes forms full-width)
- [ ] Add `data-label` attrs to all 6 cols of the grant-history table

**apps/web/src/app/admin/users/page.tsx:**
- [ ] Wrap `<table>` in `<div className="wtc-table-wrap">`
- [ ] Add `data-label` to all 4 cols (Email, Display name, Roles, Registered)

**apps/web/src/app/admin/entitlements/page.tsx:**
- [ ] The per-user product-access timeline `<table>` inside `<details>`: wrap in `wtc-table-wrap`
- [ ] Add `data-label` to all 7 cols (Date, Product, From, To, Reason, Actor, Actor type)
- [ ] The billing review queue preview table (5-row): wrap in `wtc-table-wrap`

**apps/web/src/app/admin/education/page.tsx:**
- [ ] Change root `<main className="wtc-container">` → `<div className="wtc-stack">`
- [ ] Wrap `.wtc-grid wtc-grid-4` MetricCards (lines 25-30) in proper wrapper
- [ ] Wrap courses `<table>` in `<div className="wtc-table-wrap">` with `data-label` on all 4 cols

**apps/web/src/app/admin/bots/page.tsx:**
- [ ] Wrap health checks `<table>` in `<div className="wtc-table-wrap">` with `data-label` attrs
- [ ] Add derived `readState` pill (section 14.6) in the status-badges row

**apps/web/src/app/admin/system-health/page.tsx:**
- [ ] Wrap integration health checks `<table>` in `<div className="wtc-table-wrap">`

**No changes required to:**
- entitlements/review/page.tsx (card-per-item, no tables that scroll)
- support/page.tsx (card-per-ticket, no problematic tables)
- admin/page.tsx (wtc-grid-4 already collapses responsively)

---

## 15. Phase 2.12 / PG9 User-Cabinet + Setup-Wizard Spec (20260531)

The `/app` cabinet shows one **`ProductCabinetCard`** per product with five honest zones, plus a mobile-first **setup wizard**.
All decision logic is the pure `@wtc/cabinet` `deriveProductCard` (ADR-019); this section is the visual/UX contract.

### 15.1 ProductCabinetCard anatomy (5 zones)
1. **Entitlement pill** — `StatusPill` toned by `ACCESS_REASON_COPY[reason].tone` (canonical, all 10 reasons): `allowed`→ok,
   `grace`/`pending_payment`/`manual_review`→warn, `blocked_no_entitlement`→neutral, `expired`/`revoked`/`refunded`/
   `chargeback`/`blocked_unknown_state`→bad. Optional secondary pills: `planned` (neutral), `demo data` (warn, when in-memory),
   `renews in Nd` (warn, only when `reason==='allowed'` and 0≤days≤14).
2. **Setup** — a labelled row (`.wtc-card-row`) + a checklist: `✓` (green) done / `○` (dim) not done. Label = `Ready` /
   `Setup N/M` / `Setup needed` / `—` (not_applicable). Only present when the loader supplied setup items (i.e. when allowed).
3. **Activity** — a one-line `.wtc-card-row` ("—" when none); never a secret value, never another user's data.
4. **Blockers/warnings** — a `RiskWarningBanner` per static blocker (`Blocked (B3/B4)`) + an aggregated warnings banner
   (`N operational notice(s)`, severity from `warnings.maxSeverity`). Static blockers show regardless of entitlement.
5. **Next action** — the single most-actionable CTA (a real `<a>`/`Link` or a disabled `<button>`): not-owned→"Get access"
   (or "Contact support" while B2 checkout is off), expired→"Renew"/"Contact support", owned+unconfigured→"Finish setup"
   (→wizard), owned-but-B3→"View status" (ghost), owned-but-B4→"View details" (ghost), planned→"Coming soon" (disabled).

### 15.2 Fail-closed rule
Per-user setup/activity signals are gathered by `features/cabinet/loader.ts` **only when `access.allowed`** — a non-entitled
product shows entitlement + blockers + next-action only (no activity/setup fetch). The card NEVER implies access without an
active/grace entitlement. The deriver ignores any signals passed for a non-allowed product (defence-in-depth).

### 15.3 Setup-wizard stepper
`/app/bots/[bot]/setup?step=key|strategy|review` — a single server-rendered route; steps are **GET links** (no client state).
`.wtc-wizard-steps` is a horizontal flex row with `overflow-x:auto` (scrolls **within itself** so the page never h-scrolls at
375px); each `.wtc-step` is a 44px-min pill with a 26px `.wtc-step-circle` and a nowrap `.wtc-step-label`, with `.active`
(gold), `.done` (green ✓), `.locked` (dim, review until a key exists) modifiers. Step bodies are `Card`s reusing the existing
form primitives; secrets use `type=password`, are vault-sealed server-side, and only a masked hint is ever shown. Each step
action is **CSRF-first → requireUser → fail-closed entitlement re-check → Zod → repo → next step**.

### 15.4 Responsive (375px)
The app shell uses `grid-template-columns: minmax(0, 1fr)` (not `1fr`) with `min-width:0` on the content column so a wide child
(e.g. the stepper) can never blow the column past the viewport — the canonical fix for a CSS-grid min-content overflow. The
base `.wtc-btn` carries `min-height:44px` unconditionally (tap target for cabinet/wizard CTAs outside any table context).
