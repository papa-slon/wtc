# WTC Ecosystem Platform — Full Sitemap

> Version: 2.0 | Owner: ecosystem-product-architect | Date: 2026-05-30
>
> Related: [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) · [MVP_SCOPE.md](./MVP_SCOPE.md) · [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)

---

## Routing Architecture Decision

### Problem

The prompt requested explicit static product paths (`/products/tortila-bot`, `/products/legacy-bot`, `/products/axioma-terminal`, `/products/tradingview-indicators`, `/products/education`) and explicit bot sub-paths (`/app/bots/tortila/{overview,setup,exchange-keys,symbols,risk,positions,trades,equity,safety,backtester,settings}` and `/app/bots/legacy/{...}`). The existing codebase already implements dynamic routes `/products/[slug]` (with per-product content via a `COPY` map) and `/app/bots/[bot]` (with a `MAP` lookup). A decision is needed: add real static routes, keep dynamic, or hybrid?

### Decision: Dynamic routes only — no static duplicates

**Keep `/products/[slug]` and `/app/bots/[bot]` as the definitive routing layer.**

Rationale:

1. **DRY and consistency.** The `[slug]` and `[bot]` dynamic routes already exist, work, and have per-product content branching. Duplicating them as static routes creates two code paths for the same pages — a maintenance and divergence hazard.
2. **The slugs ARE the identifiers.** Product slugs (`tortila`, `legacy-bot`, `terminal`, `indicators`, `education`) are defined in `packages/entitlements/src/registry.ts` and are the canonical mapping from product code to URL. The dynamic route reads these directly.
3. **SEO is not meaningfully different.** Next.js static generation works equally well with `generateStaticParams()` on the dynamic route. The rendered HTML is identical to a static route file.
4. **Bot tabs via dynamic sub-routes.** `/app/bots/[bot]/[section]` (settings, positions, trades, equity, safety, backtester) already exist as file-system dynamic routes and need no duplication.

**How explicit paths resolve:**

| Requested explicit path | Actual route file | Bot resolved by |
|------------------------|-------------------|-----------------|
| `/products/tortila-bot` | `(public)/products/[slug]/page.tsx` | slug = `tortila` (registry) |
| `/products/legacy-bot` | `(public)/products/[slug]/page.tsx` | slug = `legacy-bot` (registry) |
| `/products/axioma-terminal` | `(public)/products/[slug]/page.tsx` | slug = `terminal` (registry) |
| `/products/tradingview-indicators` | `(public)/products/[slug]/page.tsx` | slug = `indicators` (registry) |
| `/products/education` | `(public)/products/[slug]/page.tsx` | slug = `education` (registry) |
| `/app/bots/tortila/overview` | `(app)/app/bots/[bot]/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/settings` | `(app)/app/bots/[bot]/settings/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/positions` | `(app)/app/bots/[bot]/positions/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/trades` | `(app)/app/bots/[bot]/trades/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/equity` | `(app)/app/bots/[bot]/equity/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/safety` | `(app)/app/bots/[bot]/safety/page.tsx` | bot = `tortila` |
| `/app/bots/tortila/backtester` | `(app)/app/bots/[bot]/backtester/page.tsx` | bot = `tortila` |
| `/app/bots/legacy/{...}` | same sub-route files | bot = `legacy` |

**NOTE:** The prompt also listed `/app/bots/tortila/setup`, `/app/bots/tortila/exchange-keys`, `/app/bots/tortila/symbols`, and `/app/bots/tortila/risk` as separate explicit paths. These are Phase 2 wizard sub-steps within the `settings` tab. Decision: they are implemented as **wizard steps inside `/app/bots/[bot]/settings`**, not as separate top-level sub-routes, to keep the bot navigation flat and avoid deep nesting. The implementation agent for Phase 2 may choose sub-routes if the wizard state requires separate URLs — this is a UI implementation choice, not a product-scope change.

---

## Key

- **Audience** — who can reach this route
- **Entitlement gate** — product code checked via `packages/entitlements.hasAccess()`; `none` = no check; `auth` = logged-in only; `role:X` = RBAC role checked server-side
- **Phase** — `1.x` = already implemented; `2` = Phase 2 target; `deferred` = explicitly post-MVP
- **Required UI states** — every route must implement all listed states before being considered shippable

---

## Route Map Overview

```
Public
  /                                          [public]
  /products                                  [public]
  /products/[slug]                           [public]  → tortila, legacy-bot, terminal, indicators, education
  /education                                 [public]
  /pricing                                   [public]
  /login                                     [auth]
  /register                                  [auth]
  /legal/[doc]                               [public]  → terms, privacy, risk-disclosure

Authenticated App  (/app/*)
  /app                                       [user]
  /app/products                              [user]
  /app/bots                                  [user]
  /app/bots/[bot]                            [user+entitlement] → tortila | legacy
  /app/bots/[bot]/settings                   [user+entitlement]
  /app/bots/[bot]/positions                  [user+entitlement]
  /app/bots/[bot]/trades                     [user+entitlement]
  /app/bots/[bot]/equity                     [user+entitlement]
  /app/bots/[bot]/safety                     [user+entitlement]
  /app/bots/[bot]/backtester                 [user+entitlement]
  /app/terminal                              [user+entitlement: axioma_terminal]
  /app/indicators                            [user+entitlement: tradingview_indicators]
  /app/education                             [user+entitlement: education]
  /app/billing                               [user]
  /app/settings                              [user]
  /app/security                              [user]
  /app/support                               [user]

Admin  (/admin/*)
  /admin                                     [role:admin]
  /admin/users                               [role:admin|support]
  /admin/products                            [role:admin]
  /admin/entitlements                        [role:admin]
  /admin/tradingview-access                  [role:admin]
  /admin/bots                                [role:admin]
  /admin/education                           [role:admin]
  /admin/audit-log                           [role:admin]
  /admin/system-health                       [role:admin]

Teacher  (/teacher/*)
  /teacher                                   [role:teacher]
  /teacher/courses                           [role:teacher]
  /teacher/courses/[id]                      [role:teacher|admin]
  /teacher/materials                         [role:teacher]
  /teacher/community                         [role:teacher]
  /teacher/students                          [role:teacher]
```

---

## 1. Public Routes

### 1.1 `/` — Homepage

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (hero + product cards), loading (page hydration skeleton) |

Content: premium WTC hero section; product family overview cards (Tortila, Legacy, Axioma Terminal, Indicators, Education, Club); access flow explanation; CTA to `/register` and `/pricing`. Uses design tokens from seed (dark `#050a12`, gold `#d5a94f`, cyan `#69e2ff`). No empty gradient blobs. Terminal-first aesthetic. Hero includes an illustrative sparkline (labelled "sample UI — not live account data").

---

### 1.2 `/products` — Product Catalogue

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (grid of product cards), loading skeleton |

Grid of all six products. Each card links to its product detail page or `/pricing`. "Club" card has no individual detail page at MVP — links to `/pricing#club`.

---

### 1.3 `/products/[slug]` — Product Detail Page (dynamic)

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` (public marketing) |
| Phase | 1.x (implemented for all 6 product slugs) |
| Required UI states | loaded, loading, 404 (unknown slug → `notFound()`) |

Canonical dynamic route. `slug` values: `tortila`, `legacy-bot`, `terminal`, `indicators`, `education`, `club`. Per-product content via `COPY` map in the page component; availability status from `PRODUCT_AVAILABILITY`. Phase 2 expands per-product copy to full sales pages with screenshots, feature lists, system requirements (Axioma), backtester note (Tortila), pricing CTA. Current MVP renders bullets + pricing CTA card.

**Phase 2 content expansions per slug:**
- `tortila` — how the strategy works, BingX integration, backtester availability, risk disclosure excerpt, sample equity chart (static/illustrative), risk/known-limitations section referencing TP reconciliation and margin pre-flight.
- `legacy-bot` — DCA/averaging strategy overview, RSI/CCI signal description, configurable parameters list. Honest positioning as a mature (not cutting-edge) bot.
- `terminal` — full Axioma sales page inside WTC ecosystem: Axioma brand, feature list (Lightweight Charts, safeStorage key vault, cloud journal, release channels), system requirements (Windows/macOS/Linux), current version badge, download flow diagram, SSO/account-link roadmap note. Not a redirect to `axi-o.ma`.
- `indicators` — indicator screenshots, strategy descriptions, TradingView username flow explanation, access timeline (pending → granted).
- `education` — course titles, teacher names, lesson count preview (public teaser), CTA to enroll.
- `club` — premium community description, member benefits, monthly pricing.

---

### 1.4 `/education` — Education Landing

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` |
| Phase | 1.x (implemented as public marketing page) |
| Required UI states | loaded (public course previews), loading |

Public teaser: course titles, teacher names, lesson count. Enrolled courses locked behind entitlement. CTA to `/pricing#education` and `/register`.

---

### 1.5 `/pricing` — Pricing Page

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (plan cards), loading |

Plan cards for all products and bundles. Anchors: `#tortila`, `#legacy`, `#terminal`, `#indicators`, `#education`, `#club`, `#bundle-pro`, `#bundle-starter`. Billing provider is mock at MVP (see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) Q-2). Displays plan codes from seed: `tortila_monthly`, `tortila_yearly`, `legacy_monthly`, `axioma_monthly`, `axioma_yearly`, `indicators_quarterly`, `indicators_yearly`, `education_lifetime`, `club_monthly`, `bundle_pro`, `bundle_starter`.

---

### 1.6 `/login` — Login

| Field | Value |
|-------|-------|
| Audience | Unauthenticated users |
| Entitlement gate | `none` (redirect to `/app` if already authenticated) |
| Phase | 1.x (implemented) |
| Required UI states | idle, loading (submitting), error (invalid credentials / rate limit), success (redirect) |

Email + password form. Server-side Argon2id hash check. Pre-session form (no CSRF token); rate-limited by middleware (10 requests / 60s per client IP on `POST /login`) plus DB-backed account lockout for repeated failed logins. Audit log: `auth.login` / `auth.login_failed`. Public error copy stays generic for invalid, unknown, and locked accounts. No magic links at MVP.

---

### 1.7 `/register` — Register

| Field | Value |
|-------|-------|
| Audience | Unauthenticated users |
| Entitlement gate | `none` |
| Phase | 1.x (implemented) |
| Required UI states | idle, loading, neutral error (validation / duplicate / temporary failure), success (redirect to `/app`) |

Display name (optional) + email + password. Zod validation is server-authoritative. Pre-session form (no CSRF token); rate-limited by middleware (10 requests / 60s per client IP on `POST /register`). Argon2id hash. Default role: `user`. Browser errors are neutral and do not confirm whether an email exists. Successful DB-backed registration writes `auth.register` with non-secret metadata only. After registration, user lands on `/app` with `none` entitlements on all products.

---

### 1.8 `/legal/[doc]` — Legal Pages

| Field | Value |
|-------|-------|
| Audience | Everyone |
| Entitlement gate | `none` |
| Phase | 1.x (implemented) |
| Required UI states | loaded |

Dynamic route. `doc` values: `terms`, `privacy`, `risk-disclosure`. Static legal content. The `/legal/risk-disclosure` page is linked from every bot product page and must be acknowledged before live-mode activation in the bot setup wizard.

---

## 2. App Routes (Authenticated Dashboard)

All `/app/*` routes require `auth`. The server layout component checks for a valid session cookie before rendering; missing session redirects to `/login?next={path}`.

### 2.1 `/app` — Dashboard Overview

| Field | Value |
|-------|-------|
| Audience | Authenticated users (`role:user` minimum) |
| Entitlement gate | `auth` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (product cards, portfolio summary), loading (skeleton cards), error (session expired), empty (no active products → upgrade CTA) |

Sections:
- **Active Products** panel: shows entitlement state for all 6 products (active / pending / expired / locked) — never inferred from role, always from `hasAccess()`.
- **Portfolio Summary**: combined equity (sum across active bots if adapters healthy), combined open PnL (mocked at MVP), last sync timestamp.
- **Risk Warnings banner**: persistent banner if any active bot has unresolved P0 warnings (Tortila TP/margin items).
- **Recent Notifications**: latest audit events for the user.
- **Quick Links**: "Open Tortila Journal", "Open Axioma Journal", "Open Legacy Bot Panel" — only rendered if entitlement is active; shows connection/health status.

---

### 2.2 `/app/products` — My Products

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` |
| Phase | 3.3 (implemented; link metadata only, no byte upload) |
| Required UI states | loaded, loading, empty (no products), error |

Full-width product entitlement grid. Each card shows: product name, plan code, entitlement state, expiry date, renewal CTA or manage link. Includes `club` card. Upgrade links for products with `none` or `expired` state.

---

### 2.3 `/app/bots` — Bots Overview

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` (product-specific checks happen on sub-routes) |
| Phase | 1.x (implemented) |
| Required UI states | loaded, loading, empty (no bot entitlements → upgrade cards) |

Side-by-side Tortila Bot and Legacy Bot status cards with mini equity summaries and quick-navigate buttons to `/app/bots/tortila` and `/app/bots/legacy`.

---

### 2.4 `/app/bots/[bot]` — Bot Dashboard Overview Tab

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` (active or grace); resolved via `MAP` lookup → `notFound()` on unknown bot |
| Phase | 1.x (implemented for tortila and legacy) |
| Required UI states | loaded (metric cards + positions + trades summary), loading (adapter fetch), error (adapter unreachable), disabled (entitlement expired/revoked → upgrade CTA) |

Shows: bot status badge, adapter mode badge, risk warning banner (P0 items, non-dismissible), metric cards (8 metrics), open positions table, recent trades table, config preview, disabled start/stop controls with safety disclaimer. The `MAP` is hardcoded to `{tortila: tortila_bot, legacy: legacy_bot}`; unknown slugs return 404.

---

### 2.5 `/app/bots/[bot]/settings` — Bot Settings

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active; ownership check server-side |
| Phase | 2 (placeholder implemented; full form is Phase 2) |
| Required UI states | idle (form with current config), loading (fetching config), saving (submitting), saved (success toast), error (validation / save failure), disabled (entitlement not active) |

**Tortila** fields: symbols (multi-select), timeframe, risk % per trade, max ATR multiplier, max open units, trailing TP toggle, trailing offset, winner filter toggle, per-symbol overrides. Recommended profile button ("use safe defaults") with confirmation dialog. The setup wizard (API key selection, exchange connection, symbol/risk/ATR config) is exposed as a multi-step form within this route; wizard step sub-routes (`/setup`, `/exchange-keys`, `/symbols`, `/risk`) are UI implementation detail — not separate product routes.

**Legacy Bot** fields: existing provider `pub_id` runtime status (no WTC exchange-key entry), symbols, RSI period, CCI period, averaging levels (up to N stages), stage size % increment, take-profit %, leverage, balance %, max slots. Per-symbol overrides via accordion.

Config saved to `bot_configs` / `bot_config_versions` in WTC DB. Adapter propagation to live bot is deferred; at MVP the config is stored and a "pending sync" badge is shown.

---

### 2.6 `/app/bots/[bot]/positions` — Open Positions

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active |
| Phase | 2 (placeholder implemented; full table is Phase 2) |
| Required UI states | loaded (positions table), loading, empty (no open positions), error (adapter unavailable → stale data badge with last-seen timestamp), disabled (entitlement not active) |

Positions table columns (Tortila): symbol, side, size, entry price, current price (from adapter), unrealized PnL, margin used, leverage, TP price, SL price, age. Known error code column: flags `101211` / `109421` / `100410` if any position has a logged warning against it.

**Stale data rule**: if adapter health check fails, show a `[STALE — last sync: {timestamp}]` badge above the table. Never show stale data as if it were live.

---

### 2.7 `/app/bots/[bot]/trades` — Trade History

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active |
| Phase | 2 (placeholder implemented; full table is Phase 2) |
| Required UI states | loaded (paginated table), loading, empty, error (stale badge), disabled |

Trades table: opened, closed, symbol, side, entry, exit, realized PnL, fees, funding, result (win/loss). Paginated (50/page). Date range filter. Export as CSV (deferred).

---

### 2.8 `/app/bots/[bot]/equity` — Equity Curve

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active |
| Phase | 2 (placeholder implemented; chart is Phase 2) |
| Required UI states | loaded (chart + metric cards), loading (chart skeleton), error (no data / adapter unavailable), empty (< 2 data points → "not enough data yet" card), disabled |

Metric cards: total equity, closed PnL, unrealized PnL, wallet balance, ROI on margin, max drawdown (from peak), current drawdown, win rate, profit factor, fee/funding total, open risk %. Recharts area chart for equity curve. Lightweight-charts for a future version (post-MVP).

**Labelling rule**: every metric must be labelled with its definition tooltip. No misleading "profit" without specifying realized vs unrealized.

---

### 2.9 `/app/bots/[bot]/safety` — Safety & Audit Events

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active |
| Phase | 2 (placeholder implemented; full timeline is Phase 2) |
| Required UI states | loaded, loading, empty (no safety events — show "no issues detected"), error, disabled |

Timeline of `bot_safety_events`: TP missing/replace, reconciliation events, exchange error codes, margin-preflight blocks, rate-limit warnings. Severity badges: P0 (red), P1 (amber), info (grey). Persistent P0 items that are not user-resolvable are linked to the public known-issues note.

---

### 2.10 `/app/bots/[bot]/backtester` — Backtester

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `{bot}_bot` active (Tortila only at MVP; Legacy Bot backtester is locked) |
| Phase | 1.x UI implemented; runner deferred |
| Required UI states | idle (config form), submitting (job queued), running (progress indicator), completed (results panel), error (job failed), disabled (entitlement not active), locked (Legacy Bot — "coming soon" card) |

Tortila only: symbol selection, date range, timeframe, risk %, strategy profile selector. The form is rendered; submit button is disabled pending local runner. Results panel shows `EmptyState` until a real artifact is uploaded. **No fake results**: if the backtester runner is not connected, the "submit" button shows "Queue run (local runner required)" and is disabled. Legacy Bot shows "not available at MVP" card.

---

### 2.11 `/app/terminal` — Axioma Terminal Product Area

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `axioma_terminal` active or grace |
| Phase | 1.x (implemented) |
| Required UI states | loaded (full dashboard), loading, disabled (no entitlement → sales card with upgrade CTA), error (bridge unavailable) |

Dashboard sections (all implemented Phase 1.7):
- **License/Entitlement Status**: state badge (active / grace / expired), expiry date, plan, renewal CTA.
- **Latest Release**: version number, release notes (from bridge — mock in dev), release date, "Download" button (disabled in dev with placeholder label; production uses signed URL from `axi-o.ma/releases`).
- **Account Link Status**: "Axioma account connected" with email/ID display, or "Connect existing Axioma account" flow (placeholder in dev; production uses one-time code handoff).
- **Open Axioma Journal**: health badge, "Open Journal" button (dev placeholder; production POSTs a single-use handoff token).
- **Support / FAQ**: inline FAQ links and support contact.

In dev (`AXIOMA_BRIDGE_API_TOKEN` unset), an info banner is shown: "Axioma bridge: dev / placeholder — actions below do NOT point at a real production endpoint."

---

### 2.12 `/app/indicators` — TradingView Indicators Area

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `tradingview_indicators` active or grace |
| Phase | 1.x (implemented with DB persistence) |
| Required UI states | loaded, loading, disabled (no entitlement → upgrade CTA), error |

Sections:
- **Backend mode badge**: `[storage: Postgres]` or `[storage: in-memory (dev)]` — always visible.
- **Access Requests table**: TradingView username, status (pending / granted / expiring_soon / expired / revoked), requested date, expiry date.
- **Username Submission form**: text input for TradingView username; submit requires active `tradingview_indicators` entitlement (fail-closed server-side).
- **Expiry Warning**: amber banner if expiring in < 14 days (Phase 2).

---

### 2.13 `/app/education` — Education / Courses

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `education` active or grace |
| Phase | 1.x (implemented, thin LMS) |
| Required UI states | loaded (enrolled course list), loading, empty (entitled but no courses yet), locked (no entitlement → purchase CTA), error |

Implemented (Phase 1.7):
- Entitlement check (fail-closed): unauthenticated or unlicensed users see a warning and no course content.
- Published course list from `lmsService.listPublishedCourses()` (DB-backed or in-memory).
- Lessons per course via `lmsService.listLessonsForStudent()` (fail-closed).
- Backend mode badge.
- Community section from `loadStudentCatalogue()` teacher profiles + pinned links (Phase 3.3); no hardcoded Telegram/Instagram placeholders.

Phase 2 targets: individual lesson pages (`/app/education/[courseId]/[lessonId]`), progress tracking, progress bar per course. Enrollment tracking (`enrollments` table) is a Phase 1.8 target.

---

### 2.14 `/app/billing` — Billing & Subscriptions

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` |
| Phase | 1.x (implemented with mock billing) |
| Required UI states | loaded (subscription list + payment history), loading, empty (no paid plans → upgrade CTA), error (billing provider unreachable → stale badge) |

Implemented: entitlements table, plan cards with mock-purchase form (dev-only, hard-disabled in production via `assertNotProduction()`). Active subscriptions with status, plan code, next billing date. Manual admin grants shown as "Admin Grant" plan type. A warning banner is always shown in dev: "Dev-only mock checkout — unreachable in production."

**Billing route is unified** — there is one `/app/billing` route. The old `PRODUCT_BRIEF.md` reference to a separate billing route variant is not applicable; the route is as defined here.

---

### 2.15 `/app/settings` — Account Settings

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` |
| Phase | 1.x (implemented) |
| Required UI states | idle (form), saving, saved, error |

Display name, email change (requires password confirm + audit log), profile fields. Exchange accounts management sub-section: add/delete exchange accounts (BingX only at MVP). **Key display**: shows alias and last 4 chars of key only — never the full key in UI or API response.

---

### 2.16 `/app/security` — Security Settings

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` |
| Phase | 1.x (implemented) |
| Required UI states | idle, saving, saved, error |

Change password (current + new + confirm). Active sessions list (device, IP masked to /24, last seen, revoke button). API key vault: list of exchange API keys by alias, create/delete only — no "view key" button. Audit log for all mutations. Future: 2FA setup placeholder (greyed out at MVP).

---

### 2.17 `/app/support` — Support

| Field | Value |
|-------|-------|
| Audience | Authenticated users |
| Entitlement gate | `auth` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | idle (create ticket form), submitting, submitted (ticket ID shown), loaded (ticket list), error |

Create support ticket: subject, product selector, description. Ticket list with status (open/in-progress/resolved). For Axioma-specific issues: "Open Axioma Support" CTA links to Axioma support channel via bridge. Audit log: `support.ticket.created`.

---

## 3. Admin Routes

All `/admin/*` routes require `role:admin`. RBAC checked server-side on every request — never client-side only. Missing role → 403, not a redirect to login (different error from unauthenticated).

### 3.1 `/admin` — Admin Overview

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` (server-side) |
| Phase | 1.x (implemented) |
| Required UI states | loaded (summary cards), loading, error |

Summary cards: total users, active entitlements per product, pending TradingView requests, open support tickets, recent audit log entries, system health badge.

---

### 3.2 `/admin/users` — User Management

| Field | Value |
|-------|-------|
| Audience | `role:admin`, `role:support` (read-only for support) |
| Entitlement gate | `role:admin` or `role:support` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded (searchable paginated table), loading, empty, error |

User table: email, roles, created at, last login, active product count. Row actions (admin only): view profile, assign role, disable account. Audit log: every role or status change.

---

### 3.3 `/admin/products` — Product Catalogue Management

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, error |

Read/update product metadata: display name, description, pricing copy. Plan registry view: list of all plan codes with pricing and features. At MVP, plan codes are seeded from migration; changes require a code deploy.

---

### 3.4 `/admin/entitlements` — Entitlement Management

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (searchable), loading, empty, error, confirming (revoke dialog) |

Search by user + product. Entitlement detail: state, plan, granted at, expires at, billing source. Actions: manual grant (with plan code `admin_grant`), extend, revoke. Every action writes to `audit_logs` with admin user ID, target user ID, product, reason. Revoke confirmation modal with explicit warning.

---

### 3.5 `/admin/tradingview-access` — TradingView Access Queue

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented with DB persistence) |
| Required UI states | loaded (queue table), loading, empty (no pending), error |

Pending access requests table: user email, TradingView username, status, expiry. Per-row actions: Grant (marks granted, sets 90-day expiry), Revoke. Backend mode badge shown. All actions audited (`tradingview.grant`, `tradingview.revoke`). Expiring tab and notifications (Phase 2).

---

### 3.6 `/admin/bots` — Bot Health Dashboard

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, error (adapter unavailable), stale (badge) |

Adapter health cards for Tortila (`:8080`) and Legacy Bot (`:8000`): last ping, status, uptime, known error events. Read-only at MVP. **No controls**: no start/stop/restart. Audit warning panel showing all active P0/P1 bot risk signals.

---

### 3.7 `/admin/education` — Education Admin

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, error |

All courses (across all teachers): course list, teacher owner, lesson count, enrollment count. Admin can create/edit any course (overrides teacher ownership for admin). Manage teacher profiles: assign/remove teacher role, view teacher's courses.

---

### 3.8 `/admin/audit-log` — Audit Log Viewer

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented) |
| Required UI states | loaded (paginated, filterable table), loading, empty (no results for filter), error |

Full `audit_logs` table view. Filters: user, action category, product, date range. Columns: timestamp, actor (user ID + email), action code, target (user/resource), product, IP (masked), result. **Immutable**: audit log rows are append-only, no delete/edit UI.

---

### 3.9 `/admin/system-health` — System Health

| Field | Value |
|-------|-------|
| Audience | `role:admin` |
| Entitlement gate | `role:admin` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded (health cards), loading, error |

Integration health cards sourced from `integration_health_checks`:
- WTC DB: connected / latency
- Tortila Journal (`:8080`): ping status, last success
- Legacy Bot (`:8000`): ping status, last success
- Axioma Bridge (`axi-o.ma`): health endpoint result
- Billing provider: mock/real status
- Worker: last job run, queue depth

Each card: green/amber/red status badge, last checked timestamp, error message if any. **No fake green**: if a check has never run, show "unknown" in grey, not healthy.

---

## 4. Teacher Routes

All `/teacher/*` routes require `role:teacher`. Object-ownership enforced: teacher can only modify their own courses. RBAC + ownership checked on every mutation server-side.

### 4.1 `/teacher` — Teacher Overview

| Field | Value |
|-------|-------|
| Audience | `role:teacher` |
| Entitlement gate | `role:teacher` |
| Phase | 1.x (implemented) |
| Required UI states | loaded, loading, error |

Summary: my courses, total students, recent activity. Quick-create course button.

---

### 4.2 `/teacher/courses` — My Courses

| Field | Value |
|-------|-------|
| Audience | `role:teacher` |
| Entitlement gate | `role:teacher` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, empty (no courses → "create your first course" CTA), error |

Table of teacher's own courses: title, lesson count, published/draft status, enrolled students. Create course button → modal or new page.

---

### 4.3 `/teacher/courses/[id]` — Course Editor

| Field | Value |
|-------|-------|
| Audience | `role:teacher` (owner only), `role:admin` |
| Entitlement gate | `role:teacher` + ownership check; `role:admin` bypasses ownership |
| Phase | 1.x (implemented with thin LMS) |
| Required UI states | idle (editor), saving, saved, error (ownership violation → 403), loading |

Edit course metadata (title, description, thumbnail). Lesson list with manual order field. Add lesson: title, type (video/link/embed/file), content URL or upload, body text. Materials section: add link or embed URL. Publish/unpublish toggle. Audit log: `education.course.updated`, `education.lesson.added`.

---

### 4.4 `/teacher/materials` — Materials Library

| Field | Value |
|-------|-------|
| Audience | `role:teacher` |
| Entitlement gate | `role:teacher` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, empty, error |

Reusable material files and links belonging to this teacher. Attach to lessons from any course.

---

### 4.4a `/teacher/community` - Teacher Profile & Links

| Field | Value |
|-------|-------|
| Audience | `role:teacher` |
| Entitlement gate | `role:teacher` |
| Phase | 3.3 (implemented) |
| Required UI states | loaded, empty profile, demo storage, error |

Teacher profile/social-link editor plus teacher-profile pinned links. Student community cards read these links through the LMS catalogue.

---

### 4.5 `/teacher/students` — Student View

| Field | Value |
|-------|-------|
| Audience | `role:teacher` |
| Entitlement gate | `role:teacher` |
| Phase | 1.x (implemented, nav item marked `soon`) |
| Required UI states | loaded, loading, empty, error |

Students enrolled in this teacher's courses: name/email (masked to support@… if admin-configured), enrolled courses, progress percentages. Read-only; no access to student financial or bot data.

---

## 5. Phase 2 Build List — New Routes

The following routes do not yet have full implementations and are the Phase 2 target build list:

| Route | Type | Notes |
|-------|------|-------|
| `/app/bots/[bot]/settings` | Full form | Replace `BotSubPagePlaceholder`; multi-step config wizard for Tortila and Legacy |
| `/app/bots/[bot]/positions` | Full table | Replace placeholder; positions from adapter with stale badge |
| `/app/bots/[bot]/trades` | Full table | Replace placeholder; paginated trade history |
| `/app/bots/[bot]/equity` | Full chart | Replace placeholder; Recharts area chart + metric cards |
| `/app/bots/[bot]/safety` | Full timeline | Replace placeholder; safety event timeline with severity badges |
| `/app/education/[courseId]/[lessonId]` | New | Individual lesson page with video/embed/PDF, progress mark |
| `/app/products` | Full grid | Replace skeleton; entitlement state cards for all 6 products |
| `/app/support` | Full form | Replace skeleton; create ticket + ticket list |

All other routes are implemented at Phase 1.x level as described above.

---

## 6. Route State Requirements — Cross-Cutting Rules

Every route in this sitemap must implement all of the following states before being considered shippable:

| State | Definition | Visual treatment |
|-------|-----------|-----------------|
| **loading** | Data is being fetched | Skeleton placeholders matching the layout; no spinner without content estimate |
| **loaded** | Data is available | Full content render |
| **error** | Fetch/mutation failed | Inline error card with message + retry button; never a blank page |
| **empty** | No data (valid, not an error) | Purpose-built empty state with context and CTA |
| **disabled** | Feature locked (no entitlement) | Locked overlay with product name, state, and upgrade CTA; never shows partial data |
| **stale** | Adapter returned cached/old data | Banner: `[STALE — last updated: {timestamp}]`; data visible but flagged |
| **confirming** | Destructive action pending | Modal with explicit action description, target, and two-button confirm/cancel |

No state may be skipped by claiming "it won't happen in practice."
