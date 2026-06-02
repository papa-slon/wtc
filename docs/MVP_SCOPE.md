# WTC Ecosystem Platform — MVP Scope

> Version: 2.0 | Owner: ecosystem-product-architect | Date: 2026-05-30
>
> Related: [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) · [SITEMAP.md](./SITEMAP.md) · [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)

---

## Purpose of this Document

Defines the exact boundary between what must ship for MVP (Phases 0–3 of the implementation plan) and what is deferred to later phases. Every item maps to the Definition of Done in the platform prompt. Items in "MVP" have no asterisk; items listed as "deferred" must not be partially stubbed or hidden — they must use the honest adapter/mock + documented TODO pattern.

**Ground truth as of Phase 1.7:** The platform is a mature codebase, not a blank slate. Section 2 reflects current implementation status. Section 3 defines Phase 2 targets. Section 4 lists explicitly deferred items.

---

## 1. Definition of Done (DoD) Mapping

| DoD Condition | MVP? | Phase 1.7 Status |
|--------------|------|------------------|
| Public premium site exists | YES | Implemented: `/`, `/products`, `/products/[slug]`, `/education`, `/pricing`, `/login`, `/register`, `/legal/[doc]` |
| User can register/login | YES | Implemented: email/password, Argon2id, httpOnly session cookie, CSRF |
| Products/entitlements exist | YES | Implemented: DB schema + entitlement state machine; admin manual grant works |
| User dashboard shows product access | YES | Implemented: `/app` and `/app/products` read from `hasAccess()` |
| Tortila + legacy bot pages with settings + metrics | YES (Phase 1.7 overview; sub-tabs Phase 2) | Overview tab implemented with mock adapter; settings/equity/positions/trades/safety tabs are placeholder pages targeted for Phase 2 |
| Admin can grant/revoke product access | YES | Implemented: `/admin/entitlements` with audit log |
| TradingView access request workflow exists | YES | Implemented: user username form + admin queue UI; DB-backed when `DATABASE_URL` set |
| Teacher can create course/lesson/material | YES | Implemented: `/teacher/courses/[id]` editor with thin LMS |
| Student sees entitled education | YES | Implemented: `/app/education` entitlement gate with course/lesson list |
| Security model documented + tests pass + no UI breakage | YES | `SECURITY_MODEL.md` required before Phase 2 wiring; Vitest unit tests for entitlements/crypto/rbac pass |

---

## 2. Implemented (Phase 1.7 Ground Truth)

### 2.1 Documentation

| Document | Owner | Status |
|----------|-------|--------|
| `PRODUCT_BRIEF.md` | product-architect | Written + updated Phase 2 |
| `SITEMAP.md` | product-architect | Written + updated Phase 2 |
| `MVP_SCOPE.md` | product-architect | Written + updated Phase 2 |
| `OPEN_QUESTIONS.md` | product-architect | Written + updated Phase 2 |
| `ARCHITECTURE.md` | platform-architect | Written (Phase 0) |
| `INTEGRATION_MAP.md` | platform-architect | Written (Phase 0) |
| `DOMAIN_MODEL.md` | db-architect | Written (Phase 0) |
| `DATA_MODEL.md` | db-architect | Written (Phase 0) |
| `SECURITY_MODEL.md` | security-auditor | Written (Phase 0) |
| `RBAC_MATRIX.md` | security-auditor | Written (Phase 0) |
| `SECRET_VAULT_DESIGN.md` | security-auditor | Written (Phase 0) |
| `AUDIT_LOG_SCHEMA.md` | security-auditor | Written (Phase 0) |
| `AXIOMA_HANDOFF_TOKEN_SPEC.md` | security-auditor | Written (Phase 0) |
| `ENTITLEMENT_STATE_MACHINE.md` | billing-access-auditor | Written (Phase 0) |
| `BILLING_PROVIDER_PLAN.md` | billing-access-auditor | Written (Phase 0) |
| `PAYMENT_WEBHOOK_STATE_MACHINE.md` | billing-access-auditor | Written (Phase 0) |
| `BOT_INTEGRATION_PLAN.md` | bot-integration-auditor | Written (Phase 0) |
| `BOT_CONTROL_SAFETY_MODEL.md` | bot-integration-auditor | Written (Phase 0) |
| `CANONICAL_ANALYTICS_MODEL.md` | bot-integration-auditor | Written (Phase 0) |
| `TRADINGVIEW_ACCESS_PLAN.md` | tradingview-access-implementer | Written (Phase 0) |
| `EDUCATION_LMS_PLAN.md` | education-implementer | Written (Phase 0) |
| `BACKTESTER_DISTRIBUTION_PLAN.md` | backtester-architect | Written (Phase 0) |
| `CONTRACTS/tortila-adapter.md` | bot-integration-auditor | Written (Phase 0) |
| `CONTRACTS/legacy-bot-adapter.md` | bot-integration-auditor | Written (Phase 0) |
| `CONTRACTS/axioma-bridge.md` | axioma-bridge-auditor | Written (Phase 0) |
| `CONTRACTS/billing-webhooks.md` | billing-access-auditor | Written (Phase 0) |
| `CONTRACTS/tradingview-access.md` | tradingview-access-implementer | Written (Phase 0) |
| `CONTRACTS/backtester-runner.md` | backtester-architect | Written (Phase 0) |

**Cut rule**: no Phase 2 (backend) or Phase 3 (dashboards) code may be wired to live services until the docs for that domain are approved. Entitlement, secret vault, bot control safety, and payment webhook docs are prerequisites for wiring those subsystems.

---

### 2.2 App Shell

| Item | Real or Mock | Notes |
|------|-------------|-------|
| Next.js 15 App Router scaffold | Real | monorepo `apps/web` |
| TypeScript 5 + Tailwind CSS v4 | Real | Design tokens from seed |
| Auth layout (login/register) | Real | Argon2id, httpOnly cookie, CSRF |
| Authenticated layout + nav | Real | Sidebar/topbar with product list, user menu |
| Premium design system (`packages/ui`) | Real | Buttons, cards, forms, tables, metric cards, empty/error states |
| Public marketing routes | Real | `/`, `/products`, `/products/[slug]`, `/education`, `/pricing`, `/legal/[doc]` |
| Responsive base | Real | Desktop-first, mobile does not break forms/tables |

---

### 2.3 Domain / Backend

| Item | Real or Mock | Notes |
|------|-------------|-------|
| PostgreSQL 17 + Drizzle schema + migrations | Real | 21 tables currently in schema.ts; TARGET tables documented |
| Users, roles, sessions (`packages/auth`) | Real | Argon2id, httpOnly, server-side RBAC |
| Products, plans, subscriptions, entitlements | Real | All product codes + plan codes from seed seeded |
| Entitlement state machine (`packages/entitlements`) | Real | Fail-closed, all 9 states, `hasAccess()` is the only access oracle |
| Audit log (append-only, all mutations) | Real | `audit_logs` table; no delete endpoint |
| Exchange API key vault (`packages/crypto`) | Real | AES-256-GCM envelope, per-secret DEK, key-id metadata; KEK from env (Phase 2 migration path documented in Q-11) |
| Secret vault API (create/delete/rotate) | Real | Never returns plaintext key after creation |
| Admin manual grant/revoke via `/admin/entitlements` | Real | Audit-logged |
| Zod validation at every API boundary | Real | Client provides UX feedback; server validates authoritatively |
| Rate limiting on auth endpoints | Real | 5 attempts / 15 min |
| CSRF double-submit cookie | Real | All state-changing requests |
| Payment provider integration | **MOCK** | Billing adapter interface + mock adapter; `assertNotProduction()` guard on mock purchase; real provider deferred (see Q-2) |
| Payment webhook handling | **MOCK** (interface documented) | `CONTRACTS/billing-webhooks.md` defines real shape; mock adapter simulates events |

---

### 2.4 Bot Dashboards

| Item | Real or Mock | Notes |
|------|-------------|-------|
| `/app/bots/tortila` — overview tab | Real UI + mock adapter | Metric cards, positions table, trades table, risk warning banner, disabled controls |
| `/app/bots/legacy` — overview tab | Real UI + mock adapter | Same structure |
| `/app/bots/[bot]/settings` | Real UI / **PLACEHOLDER** | `BotSubPagePlaceholder` renders; full form is Phase 2 |
| `/app/bots/[bot]/positions` | Real UI / **PLACEHOLDER** | Placeholder; Phase 2 replaces with full adapter-driven table |
| `/app/bots/[bot]/trades` | Real UI / **PLACEHOLDER** | Placeholder; Phase 2 replaces with paginated table |
| `/app/bots/[bot]/equity` | Real UI / **PLACEHOLDER** | Placeholder; Phase 2 replaces with Recharts equity chart |
| `/app/bots/[bot]/safety` | Real UI / **PLACEHOLDER** | Placeholder; Phase 2 replaces with safety event timeline |
| `/app/bots/[bot]/backtester` | Real UI (form) / **MOCK** runner | Form rendered; submit button disabled until runner wired; Legacy Bot = locked card |
| Tortila adapter (`packages/bot-adapters`) | **MOCK** | Interface defined; dev adapter returns shaped fixtures; live adapter deferred |
| Legacy bot adapter | **MOCK** | Same pattern |
| Bot settings form (config stored in WTC DB) | **PLACEHOLDER** | Config save path to `bot_configs` / `bot_config_versions` is Phase 2 |
| Bot controls (start/stop) | **DISABLED** | Buttons rendered, disabled; tooltip: safety policy |
| Canonical analytics normalization | Real (Zod schema in `packages/analytics`) | Both bots map to same canonical metric type; mock data conforms to schema |
| Risk pre-flight / live-mode warning | Real UI | Risk disclosure acknowledgment gated; controls remain disabled at MVP |

---

### 2.5 Axioma Terminal Area

| Item | Real or Mock | Notes |
|------|-------------|-------|
| `/products/terminal` public page | Real | Via dynamic `/products/[slug]` with `terminal` slug |
| `/app/terminal` product dashboard | Real UI / **MOCK** bridge | All sections implemented; data from mock bridge |
| License/entitlement state display | Real (from entitlements) | `accessFor()` drives state badge |
| Latest release card | **MOCK** (bridge not wired) | Version + notes from mock bridge fixture |
| Download CTA | **PLACEHOLDER** | Button disabled in dev with explicit label; real signed URL requires `CONTRACTS/axioma-bridge.md` |
| Account link state | **MOCK** | Shows state from mock bridge; production uses one-time code handoff |
| "Open Axioma Journal" button | **PLACEHOLDER** | Button exists; production POSTs single-use handoff token; dev shows placeholder label |
| Dev/prod distinction banner | Real | Info banner when `AXIOMA_BRIDGE_API_TOKEN` unset; production: real bridge |
| Support/FAQ section | Real (static content links) | |

---

### 2.6 TradingView Indicators

| Item | Real or Mock | Notes |
|------|-------------|-------|
| `/app/indicators` user area | Real UI | Implemented Phase 1.7 |
| Username capture form | Real | Stores in DB (`tradingview_access_requests`) when `DATABASE_URL` set; in-memory dev fallback |
| `TradingViewAccessRequest` creation | Real | Fail-closed: requires active entitlement server-side |
| `/admin/tradingview-access` queue | Real | Grant / reject actions; audit-logged (`tradingview.grant`, `tradingview.revoke`) |
| `tradingview_access_requests` tracking | Real | Exists in schema.ts; DB-backed with `DATABASE_URL` |
| `tradingview_access_tasks` tracking | Real | Exists in schema.ts; used by worker sweep |
| `tradingview_profiles` table | **TARGET** | Not yet in schema.ts; Phase 2 addition for per-user TV profile metadata |
| `tradingview_access_grants` table | **TARGET** | Not yet in schema.ts; Phase 2 addition for normalized grant records |
| Expiry scheduler task design | Real (job defined) / cron loop | Worker sweep uses `tradingview_access_tasks`; runs only with `DATABASE_URL` set |
| Automation adapter | **EXCLUDED** from MVP | `CONTRACTS/tradingview-access.md` documents interface; no implementation |

---

### 2.7 Education / LMS

| Item | Real or Mock | Notes |
|------|-------------|-------|
| `/teacher/courses/[id]` editor | Real | Phase 1.7; ownership enforced |
| Course/lesson/material CRUD | Real | `courses`, `lessons`, `materials` tables exist in schema.ts |
| `/app/education` entitlement-gated student view | Real | Phase 1.7; fail-closed |
| Published course list | Real | DB-backed or in-memory dev fallback |
| Video URL, body text, link materials | Real | Stored in `lessons.videoUrl` / `materials.url` |
| Social/community links section | Real (placeholder links) | Become admin-managed links in Phase 2 |
| `teacher_profiles` table | **TARGET** | Not yet in schema.ts; Phase 1.8 |
| `enrollments` table | **TARGET** | Not yet in schema.ts; Phase 1.8 |
| `lesson_progress` table | **TARGET** | Not yet in schema.ts; Phase 1.8 |
| Individual lesson pages (`/app/education/[courseId]/[lessonId]`) | **Phase 2** | Not yet implemented |
| Progress bar per course | **Phase 2** | Requires `enrollments`/`lesson_progress` tables (Phase 1.8) |
| File upload for materials | **DEFERRED** | Security review required for upload handling |

---

### 2.8 Admin Panels

| Item | Real or Mock | Notes |
|------|-------------|-------|
| `/admin/users` | Real | Read for support role; full for admin |
| `/admin/entitlements` | Real | Grant/revoke with audit |
| `/admin/tradingview-access` | Real | Queue management; DB-backed |
| `/admin/bots` | Real UI / **MOCK** data | Health cards; no controls |
| `/admin/education` | Real | Course/teacher management |
| `/admin/audit-log` | Real | Paginated, filterable |
| `/admin/system-health` | Real UI / **MOCK** checks | Integration health cards; mock results until adapters wired |
| `/admin/products` | Real (read) / limited write | Plan pricing edit deferred to code |

---

## 3. Phase 2 Target Items

The following items have placeholder implementations and are targeted for full implementation in Phase 2:

| Item | Phase 1.7 State | Phase 2 Target |
|------|-----------------|----------------|
| `/app/bots/[bot]/settings` | `BotSubPagePlaceholder` | Full config wizard form (symbols/risk/ATR for Tortila; RSI/CCI/stages for Legacy); save to `bot_configs`; "pending sync" badge |
| `/app/bots/[bot]/positions` | `BotSubPagePlaceholder` | Positions table from adapter; stale badge; error code flags (`101211`, `109421`, `100410`) |
| `/app/bots/[bot]/trades` | `BotSubPagePlaceholder` | Paginated trade history; date range filter; export CSV (deferred) |
| `/app/bots/[bot]/equity` | `BotSubPagePlaceholder` | Recharts area chart; metric cards (8 metrics); definition tooltips; no misleading labels |
| `/app/bots/[bot]/safety` | `BotSubPagePlaceholder` | Safety event timeline; severity badges (P0/P1/info); non-dismissible P0 warnings |
| `/app/education/[courseId]/[lessonId]` | Not yet a route | Individual lesson page with video embed/PDF/link materials; progress mark button |
| `/app/products` | Skeleton (nav: `soon`) | Full entitlement state cards for all 6 products |
| `/app/support` | Skeleton (nav: `soon`) | Create ticket form + ticket list |
| Public `/products/[slug]` copy | Minimal bullets | Full per-product sales pages with screenshots and feature lists (see SITEMAP.md §1.3) |
| TV access expiry warning banner | Not implemented | Amber banner at `/app/indicators` if expiring in < 14 days |
| `tradingview_profiles` table | TARGET | Phase 2 DB schema addition |
| `tradingview_access_grants` table | TARGET | Phase 2 DB schema addition |
| `teacher_profiles` table | TARGET | Phase 1.8 DB schema addition |
| `enrollments` table | TARGET | Phase 1.8 DB schema addition |
| `lesson_progress` table | TARGET | Phase 1.8 DB schema addition |

---

## 4. Explicit Deferred (Not MVP)

The following items are **explicitly out of scope for MVP**. They must not be partially implemented, hidden behind flags that are on by default, or faked with hardcoded responses presented as real:

| Item | Why deferred | Where documented when ready |
|------|-------------|----------------------------|
| Live bot control (start/stop via WTC) | Requires audited `BOT_CONTROL_SAFETY_MODEL.md` and a separately approved adapter | `CONTRACTS/tortila-adapter.md` |
| Real Tortila journal adapter (live HTTP to `:8080`) | Requires network path approval, timeout/retry design | `BOT_INTEGRATION_PLAN.md` |
| Real Legacy Bot adapter (live HTTP to `:8000`) | Same as above | `BOT_INTEGRATION_PLAN.md` |
| Axioma signed handoff / SSO | Requires `AXIOMA_HANDOFF_TOKEN_SPEC.md` approval + Axioma server changes | `CONTRACTS/axioma-bridge.md` |
| Axioma download signed URLs | Requires release metadata contract and download auth spec | `CONTRACTS/axioma-bridge.md` |
| Payment provider (Stripe / crypto) | Billing provider TBD (see Q-2); mock adapter ships | `BILLING_PROVIDER_PLAN.md` |
| Payment webhooks | Depends on billing provider selection | `CONTRACTS/billing-webhooks.md` |
| Tortila backtester runner | Packaging/distribution design required | `BACKTESTER_DISTRIBUTION_PLAN.md` |
| Legacy Bot backtester | Not planned for MVP | Out of scope |
| TradingView access automation | ToS compliance unclear (see Q-3); manual queue ships | `TRADINGVIEW_ACCESS_PLAN.md` |
| File upload for education materials | Upload security review needed | `EDUCATION_LMS_PLAN.md` |
| 2FA / TOTP | Not in MVP DoD | `SECURITY_MODEL.md` (future section) |
| Email notifications | Not in MVP DoD | Worker Phase 7 |
| Telegram notifications | Not in MVP DoD | Worker Phase 7 |
| Lightweight-charts equity curves | Recharts ships at MVP | Post-MVP enhancement |
| Axioma desktop device-link flow | Requires native deep-link + `journal_server` changes | `CONTRACTS/axioma-bridge.md` |
| Status page (`status.wtc.example.com`) | Post-MVP ops | Deployment phase |
| Export (CSV) for trades/audit | Post-MVP UX | Phase 4+ |
| Audit log export | Post-MVP | Phase 4+ |
| Billing portal redirect (Stripe customer portal) | Depends on billing provider | Post billing-provider selection |
| KEK migration to managed KMS (AWS KMS / Vault) | Phase 3 hard gate; env-var KEK acceptable for pre-production; not before real user exchange keys at scale | `OPEN_QUESTIONS.md` Q-11; `SECRET_VAULT_DESIGN.md` |

---

## 5. Real vs Mock Summary

| Subsystem | MVP state | Evidence of mock-vs-real boundary |
|-----------|-----------|-----------------------------------|
| Auth / sessions | Real | Argon2id + httpOnly cookie; no magic link |
| Entitlements | Real | State machine, fail-closed |
| Exchange key vault | Real | AES-256-GCM; plaintext never in API |
| Audit log | Real | Append-only; every mutation |
| Billing | Mock adapter | `BillingAdapter` interface; `MockBillingAdapter` ships; `assertNotProduction()` guard on mock purchase |
| Tortila adapter | Mock adapter | `BotAdapter` interface; `MockTortilaAdapter` returns shaped fixtures with stale banner |
| Legacy bot adapter | Mock adapter | Same pattern |
| Axioma bridge | Mock bridge | `AxiomaBridge` interface; `MockAxiomaBridge` returns static release/license fixtures |
| TradingView service | Real (DB-backed when DATABASE_URL set) | In-memory dev fallback; backend mode badge shown on page |
| LMS service | Real (DB-backed when DATABASE_URL set; thin model) | In-memory dev fallback; backend mode badge shown on page |
| TradingView automation | Not implemented | `TradingViewAutomationAdapter` interface only; no implementation |
| Backtester runner | Not implemented | Job schema + interface; no runner connection; submit button disabled |
| Worker cron | Skeleton | Job queue table and type definitions; TV expiry sweep runs with `DATABASE_URL` |

---

## 6. Cut Lines and Escalation Rules

If scope creep is requested during implementation, apply these rules:

1. **Any live process control** (bot start/stop/restart, SSH, systemd, tmux) → **blocked** until `BOT_CONTROL_SAFETY_MODEL.md` is approved and the adapter is audited. No exceptions.
2. **Any plaintext secret in an API response, log, or fixture** → **blocked** immediately. Stop and escalate.
3. **Any feature that exposes data from service X to users not entitled to product X** → **blocked**. Check `hasAccess()` first.
4. **New plan codes or product codes** not in the seed registry → must be added via a migration and recorded in `ARCHITECTURE_DECISIONS.md` before use.
5. **Billing provider integration** → mock adapter only until Q-2 is resolved and a real adapter is contracted.
6. **TradingView automation** → feature-flagged and off by default; requires `TRADINGVIEW_ACCESS_PLAN.md` approval.
7. **Axioma SSO/handoff tokens** → `AXIOMA_HANDOFF_TOKEN_SPEC.md` must be finalized and Axioma server must confirm it can validate WTC tokens before any real handoff is built.
8. **`tradingview_profiles` / `tradingview_access_grants` / `teacher_profiles` / `enrollments` / `lesson_progress`** → TARGET tables; any code referencing them as EXISTING tables is wrong. A migration must land first.
