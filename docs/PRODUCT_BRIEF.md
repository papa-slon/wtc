# WTC Ecosystem Platform — Product Brief

> Version: 2.0 | Owner: ecosystem-product-architect | Date: 2026-05-30
>
> Related: [SITEMAP.md](./SITEMAP.md) · [MVP_SCOPE.md](./MVP_SCOPE.md) · [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) · [handoff seed](./handoffs/0000-orchestrator-seed.md)

---

## 1. Vision

World Trader Club (WTC) is a **product operating system for serious retail traders**. It is the single account where a trader purchases, activates, configures, and monitors every WTC product — from algorithmic bots and a desktop terminal to TradingView indicator sets and structured trading education.

The platform is not a generic SaaS landing page or a link directory. It is an operational hub: entitlement-gated, audit-logged, dark/fintech-styled, and built around the assumption that every active user has real money on the line. Every screen must reflect that gravity.

Core promise: **one login, one dashboard, every WTC product — professionally managed, never confusing, never hiding risk**.

---

## 2. Target Users

### 2.1 Retail Traders (primary)

- Active crypto/futures traders, predominantly BingX users today.
- Run Tortila Bot or Legacy Bot unattended; check positions and equity daily.
- Want clear P&L, drawdown, risk warnings, and enough config control to trust the bot.
- Overwhelmed by raw technical dashboards; need labels, tooltips, and safe defaults.
- **Key need**: know the bot is running correctly and see honest risk signals, not a green "all ok" badge that masks known issues.

### 2.2 Serious / Power Traders (secondary)

- Run multiple bots or the Axioma terminal simultaneously.
- Use TradingView indicators alongside automated strategies.
- Want dense, operational dashboards — no decorative empty states.
- Expect professional tooling: backtester, equity curves, per-symbol analytics.
- **Key need**: a unified portfolio view and precise config control.

### 2.3 Students / Learners

- Purchase education courses, attend live sessions, consume video/written materials.
- May or may not also use trading products.
- Entitlement-gated: see only courses they have paid for or been manually granted.
- **Key need**: smooth course/lesson navigation and progress tracking.

### 2.4 Teachers / Instructors

- Upload and curate course content: videos, PDFs, links, embeds.
- Manage their own student cohort and lesson materials.
- Object-ownership enforced: cannot edit another teacher's course.
- **Key need**: a lightweight CMS within the dashboard; no separate tool.

### 2.5 Admins / Support Staff

- Manage user accounts, grant/revoke product access, process TradingView access requests.
- Review audit logs, investigate support tickets, monitor system health.
- **Key need**: fast admin queue workflows and a complete audit trail.

---

## 3. The WTC Master-Account Model

Every user has exactly **one WTC account**. That account is the authority for:

| Concern | Owner |
|---------|-------|
| Identity / authentication | WTC platform |
| Product entitlements | WTC `packages/entitlements` — fail-closed |
| Billing / subscription state | WTC billing adapter + payment provider |
| Exchange API key vault | WTC encrypted-at-rest vault (`packages/crypto`) |
| Bot configuration store | WTC `packages/db` → bot-adapters read into live services |
| Axioma license / download | WTC bridge → `axi-o.ma journal_server` (BRIDGE only) |
| TradingView access | WTC admin queue → manual grant |
| Education progress | WTC LMS module |
| Audit trail | WTC `audit_logs` table — every action logged |

WTC is **never** the order-execution path. Live trading stays in the product services (Tortila systemd worker, Legacy Bot FastAPI, Axioma desktop + its server). WTC reads status, stores config, and delegates via adapters.

### 3.1 Entitlement as the Single Source of Truth

All product access is determined by `packages/entitlements.hasAccess(userId, productCode)`. No UI, no API route, and no bot adapter may infer access from client state, role labels, or payment metadata. Entitlements fail closed: any state that is not explicitly `active` (or `grace` within the grace window) denies access.

### 3.2 Product Codes (canonical)

See seed for full registry. Short form:

| ProductCode | Display | Route |
|-------------|---------|-------|
| `tortila_bot` | Tortila Bot | `/products/tortila`, `/app/bots/tortila` |
| `legacy_bot` | Legacy Bot | `/products/legacy-bot`, `/app/bots/legacy` |
| `axioma_terminal` | Axioma Terminal | `/products/terminal`, `/app/terminal` |
| `tradingview_indicators` | TradingView Indicators | `/products/indicators`, `/app/indicators` |
| `education` | Education | `/education`, `/app/education` |
| `club` | Private Club | n/a separate public page; `/app/products` shows club card |

---

## 4. The Six Products

### 4.1 Tortila Bot (`tortila_bot`)

**What it is.** An algorithmic futures trading bot (BingX) built on a turtle/trend strategy with ATR-based position sizing, winner filter, trailing take-profit, and a real-time journal (`:8080`). The bot runs as a systemd service; WTC wraps it as a first-class product.

**Value proposition.** Tortila removes the need to watch charts all day. The strategy is rules-based and risk-managed; equity curves, per-trade audit, and safety events are surfaced transparently including known risk signals (TP reconciliation gaps, margin pre-flight warnings, exchange error codes `101211`, `100410`, `109421`). WTC never hides these behind a "healthy" badge.

**WTC-side experience.** Setup wizard → API key vault → symbol/risk config → read-only position/trade/equity monitoring → backtester → safety/audit events tab. "Open Tortila Journal" CTA links to `:8080` or future protected route.

**Monetization.** Monthly subscription (`tortila_monthly`) or yearly (`tortila_yearly`). Included in `bundle_pro` and `bundle_starter`. Manual admin grant possible.

**Known risks surfaced in UI.** TP reconciliation/restore not yet production-complete; margin pre-flight not yet blocking live adds. Both are P0 items displayed as persistent audit warnings until resolved.

**Phase 2 additions.**
- Bot overview tab (`/app/bots/tortila`) is implemented (Phase 1.7): live mock adapter, metric cards, positions table, trades table, risk warning banner, disabled controls.
- Sub-tabs for settings, positions, trades, equity, safety, backtester exist as placeholder pages; full implementations are Phase 2 targets.
- Tortila-specific setup wizard (symbol/risk/ATR config) ships as a dedicated tab within `/app/bots/tortila/settings`.
- Backtester form is implemented; local runner distribution is deferred per `BACKTESTER_DISTRIBUTION_PLAN.md`.

---

### 4.2 Legacy Bot (`legacy_bot`)

**What it is.** An older crypto bot (FastAPI, Postgres, `:8000`) supporting RSI/CCI signals, multi-stage averaging, configurable take-profit %, leverage, and balance allocation. Uses a tmux session for the process.

**Value proposition.** Proven, simpler strategy for users who want a configurable averaging/DCA-style bot. Familiar to existing users who already run it.

**WTC-side experience.** Setup wizard → API key vault → symbols/RSI/CCI/stages/slots/leverage config → normalized monitoring (equity, trades, positions, safety) mapped through a canonical analytics adapter. "Open Legacy Bot Panel" CTA links to `:8000` or future route.

**Monetization.** Monthly subscription (`legacy_monthly`). Manual admin grant possible. No yearly plan at seed — add via plan registry when needed.

**Note.** Legacy bot control (start/stop) is mock-only at MVP. No live process commands until bot-control-safety-model is fully audited (see [BOT_CONTROL_SAFETY_MODEL.md](./BOT_CONTROL_SAFETY_MODEL.md) — TBD).

**Phase 2 additions.** Same sub-tab structure as Tortila (`/app/bots/legacy/{settings,positions,trades,equity,safety,backtester}`); backtester tab is locked at MVP ("not available for Legacy Bot") per `docs/MVP_SCOPE.md`.

---

### 4.3 Axioma Terminal (`axioma_terminal`)

**What it is.** A premium desktop trading terminal (Electron 33 + React 18 + TypeScript + Lightweight Charts). Exchange keys encrypted locally via Electron `safeStorage`. Cloud journal and license state managed by `journal_server` at `axi-o.ma`. Current package identity: `com.greenfield.terminal` / "Trading Terminal" — rename to Axioma is a deliberate migration in progress (see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) Q-1).

**Value proposition.** Professional, offline-capable trading terminal with cloud journal, license vault, and future SSO into WTC account. Bridges local order execution (stays local) with a cloud analytics and account-management layer.

**WTC-side experience.** Full product module inside WTC. The `/app/terminal` page (Phase 1.7-implemented) shows:
  - License/entitlement state (active/expired/grace) and plan
  - Latest terminal version + release notes (from mock bridge)
  - Download CTA (placeholder in dev; real signed URL from `axi-o.ma/releases` requires `CONTRACTS/axioma-bridge.md`)
  - "Open Axioma Journal" CTA with health/connection status (placeholder in dev; production POSTs a single-use handoff token)
  - Account-link state ("linked" / "pending" / "not linked") with connect flow
  - Support / FAQ with inline links

WTC is **not** the runtime: it does not copy `journal_server` code, does not proxy order execution, and does not replace the Axioma auth system. It wraps the product experience through the bridge.

**Monetization.** Monthly (`axioma_monthly`) or yearly (`axioma_yearly`). Included in `bundle_pro`.

---

### 4.4 TradingView Indicators (`tradingview_indicators`)

**What it is.** Proprietary TradingView Pine Script indicators published under the WTC account on TradingView. Access is granted by adding the user's TradingView username to the indicator's access list — a manual admin step via TradingView's web UI.

**Value proposition.** Institutional-quality signal overlays for TradingView charts. Complements the bots and terminal for traders who prefer manual execution.

**WTC-side experience.** The `/app/indicators` page (Phase 1.7-implemented with DB persistence when `DATABASE_URL` is set, in-memory dev fallback otherwise) shows:
  - Current backend storage mode: a `[storage: Postgres]` or `[storage: in-memory (dev)]` badge is shown on the page
  - User's TradingView username entry form (fail-closed: requires active `tradingview_indicators` entitlement to submit)
  - Access request status (pending / granted / expiring_soon / expired / revoked) with expiry date
  - Audit log: `tradingview.submit` / `tradingview.grant` / `tradingview.revoke` actions

Admin processes requests from `/admin/tradingview-access`. No credential-stuffing or brittle browser automation as the production default. An optional automation adapter may be added behind a feature flag if a ToS-compliant path is confirmed (see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) Q-3).

**NOTE on DB tables:** `tradingview_profiles` and `tradingview_access_grants` are TARGET tables (planned for Phase 2 schema expansion). Current implementation uses `tradingview_access_requests` and `tradingview_access_tasks` (both EXIST in schema.ts). Any doc reference to `tradingview_profiles`/`tradingview_access_grants` as current tables is inaccurate — they are Phase 2 targets.

**Monetization.** Quarterly (`indicators_quarterly`) or yearly (`indicators_yearly`). Included in `bundle_pro`.

---

### 4.5 Education (`education`)

**What it is.** An internal LMS: structured courses, video/link/embed lessons, downloadable materials, progress tracking, and a teacher/student management layer.

**Value proposition.** Trading education that actually works alongside the trading tools. Students learn strategy concepts, risk management, and platform configuration in the same place they run their bots.

**WTC-side experience.** The thin LMS is implemented in Phase 1.7:
  - `/app/education` (Phase 1.7): entitlement-gated course list with DB persistence (in-memory dev fallback when no `DATABASE_URL`)
  - `/teacher/courses/:id` (Phase 1.7): course/lesson/material CRUD with ownership enforcement
  - Backend mode badge shown on page (Postgres vs in-memory)

Full enrollment/progress tracking (`enrollments`, `lesson_progress` tables) and teacher-profiles are Phase 1.8 targets (TARGET tables, not yet in schema.ts). Students cannot enumerate unenrolled/hidden content. Teachers manage courses via `/teacher`; admins manage all of education via `/admin/education`.

**NOTE:** This product must not be described as "purely planned" in any doc. The thin LMS (courses/lessons/materials CRUD, entitlement-gated student view) is implemented as of Phase 1.7.

**Monetization.** Lifetime access purchase (`education_lifetime`). Included in `bundle_pro` and `bundle_starter`. Whether `club` is bundled with `education` is an open question (see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) Q-6).

---

### 4.6 Club (`club`)

**What it is.** A private members area providing access to premium community content, Telegram groups, curated trading signals, and exclusive resources.

**Value proposition.** The social layer of WTC: accountability, live discussion, signal access, and community mentorship that amplifies the technical products.

**WTC-side experience.** Entitlement check on `/app/products` club card → access to pinned community links, Telegram deep-link, social areas, and exclusive materials. No separate public product page at MVP (club is upsold within the dashboard). As of Phase 3.3, `/app/education` renders teacher profile links and pinned community links from the LMS catalogue instead of hardcoded placeholders.

**Monetization.** Monthly subscription (`club_monthly`). May be bundled with education (open question).

---

## 5. Positioning vs Generic SaaS

| Dimension | Generic SaaS landing | WTC Ecosystem |
|-----------|---------------------|---------------|
| Aesthetic | Gradient blobs, hero carousels | Dark terminal-first, gold/cyan accents, product screenshots |
| After login | Marketing dashboard | Operational trading hub with live data |
| Access model | Role checkboxes | Entitlement state machine, fail-closed |
| Risk disclosure | None or footnote | First-class: known bot issues surfaced as persistent warnings |
| Secret handling | Text fields | Encrypted-at-rest vault, never logged, never in API responses |
| Multi-product | Tabs or nav links | Per-product entitlement, setup wizards, adapters |
| Audit | None | Every action written to `audit_logs` |
| Bot control | Buttons | Mock until audited; "Stop" never closes positions |
| Axioma | Link out | First-class product module with full lifecycle in WTC |
| TV access | Not applicable | Fail-closed admin queue; DB-backed when DATABASE_URL set |
| Education | CMS link | Thin LMS implemented; enrollment/progress Phase 1.8 |

---

## 6. Success Metrics

### Operational (platform health)

| Metric | Target |
|--------|--------|
| Entitlement check latency (p95) | < 50 ms |
| Exchange key decrypt failure rate | 0 % in audit log |
| Secret leak in logs / API responses | 0 incidents |
| Audit log completeness | 100 % of mutations |
| TradingView access request → grant SLA | < 24 h (admin manual) |

### Product (user outcomes)

| Metric | Definition |
|--------|------------|
| Active products per user | Avg entitlements in `active` state |
| Bot dashboard engagement | Sessions reaching `/app/bots/:bot/equity` |
| Education completion rate | `lesson_progress` / total enrolled lessons |
| Axioma download conversion | Downloads / `axioma_terminal` entitlement holders |
| Support ticket volume | Tickets per 100 active users |

### Business

| Metric | Definition |
|--------|------------|
| MRR per product | Subscriptions × plan price |
| Bundle attach rate | `bundle_pro` / total paid subscriptions |
| Entitlement renewal rate | Renewals / expired subscriptions |
| TradingView churn | Revocations / active grants |

---

## 7. Explicit Non-Goals

The following are **out of scope** for the WTC platform — they must never be built without a separate explicit decision and audit:

1. **Live order execution.** WTC must never route, submit, or modify exchange orders. Axioma and bots own their own execution paths.
2. **Copying live .env/secrets.** WTC uses its own vault; it does not read or replicate secrets from existing service environments.
3. **SSH/tmux/systemd control from WTC.** Process management of live services requires a separately audited control adapter.
4. **Credential-stuffing TradingView.** Any automation of TradingView must be ToS-compliant and feature-flagged; default is manual queue.
5. **One-file prototype.** All business logic lives in `packages/*`; no god-component or single-route monolith.
6. **Fake integrations.** If an adapter cannot yet call a real service, it ships with an honest mock + documented TODO, not a hardcoded result presented as real data.
7. **Cross-product data leakage.** A student cannot enumerate courses they are not enrolled in. A user cannot see another user's positions, keys, or config.
8. **Removing the Axioma brand.** Axioma keeps its domain (`axi-o.ma`) and product identity. WTC wraps it; it does not absorb it.
9. **Paying out profits / acting as a financial advisor.** WTC is a tooling platform; it does not make trading decisions or manage user funds.
10. **Ignoring known Tortila risk signals.** The TP reconciliation gap and margin pre-flight issues are active P0 items that must be surfaced, not hidden.
