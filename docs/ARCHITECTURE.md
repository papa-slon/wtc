# WTC Ecosystem Platform — Architecture

> Owner: ecosystem-platform-architect | Updated Phase 2 epoch 20260530-0126 | First written 2026-05-29
>
> Related: [INTEGRATION_MAP.md](./INTEGRATION_MAP.md) · [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) · [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) · [SECURITY_MODEL.md](./SECURITY_MODEL.md)

---

## 1. System Philosophy: Control Plane vs Product Services

WTC Ecosystem Platform is a **control plane** — it owns identity, billing, entitlements, and configuration UX — but it never becomes the runtime execution environment for trading or for Axioma's order logic. Every product (bot, terminal, indicators, education) is a **product service** or an **internal module** that WTC wraps with product experience, entitlement gating, and operational monitoring.

```
┌───────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE  (WTC Ecosystem Platform)                          │
│  Identity · Billing · Entitlements · Admin · Audit · Education    │
│  Bot setup/config UX · Analytics aggregation · TV Access queue    │
└────────┬────────────────────────┬──────────────────┬─────────────┘
         │ Bot Adapter Layer      │ Axioma Bridge    │ Internal Modules
   ┌─────▼──────┐         ┌───────▼────────┐  ┌─────▼──────────┐
   │ Tortila    │         │ journal_server │  │ LMS / Education │
   │ Journal    │         │ axi-o.ma       │  │ TradingView     │
   │ :8080      │         │ :8123          │  │ Access Queue    │
   └────────────┘         └────────────────┘  └─────────────────┘
   ┌────────────┐
   │ Legacy Bot │
   │ :8000      │
   └────────────┘
```

**Non-negotiable boundary**: WTC never executes orders, never controls live bots until adapters are separately audited, never becomes the runtime path for Axioma local order execution, and never stores secrets in plaintext or returns them via any API.

---

## 2. Monorepo Layout

```
wtc_ecosystem_platform/
├── apps/
│   ├── web/                  # Next.js 15 App Router — public site + dashboard
│   └── worker/               # Background job runner — cron-style direct calls (job_queue table RESERVED/unconsumed)
├── packages/
│   ├── ui/                   # Design system: tokens, components, layouts
│   ├── config/               # Typed environment and runtime configuration
│   ├── db/                   # Drizzle ORM schema, migrations, repositories
│   ├── auth/                 # Sessions, RBAC, Argon2id, CSRF helpers
│   ├── entitlements/         # Product access engine (single source of truth)
│   ├── billing/              # Payment provider adapters (Stripe/mock)
│   ├── audit/                # Audit log writers and query helpers
│   ├── crypto/               # AES-256-GCM envelope encryption, key rotation
│   ├── bot-adapters/         # Tortila + legacy bot adapter interfaces + mocks
│   ├── axioma-bridge/        # Axioma product bridge (release, download, link)
│   ├── analytics/            # Canonical metrics normalization across both bots
│   ├── lms/                  # Education domain: courses, lessons, enrollments
│   ├── tradingview-access/   # TV username requests, admin grant/revoke queue
│   ├── backtester/           # Backtest job model + local runner distribution
│   └── shared/               # Types, Zod schemas, utility functions
├── docs/
│   ├── ARCHITECTURE.md       ← this file
│   ├── INTEGRATION_MAP.md
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── DOMAIN_MODEL.md
│   ├── DATA_MODEL.md
│   ├── SECURITY_MODEL.md
│   ├── RBAC_MATRIX.md
│   ├── SECRET_VAULT_DESIGN.md
│   ├── ENTITLEMENT_STATE_MACHINE.md
│   ├── BILLING_PROVIDER_PLAN.md
│   ├── PAYMENT_WEBHOOK_STATE_MACHINE.md
│   ├── AXIOMA_HANDOFF_TOKEN_SPEC.md
│   ├── AUDIT_LOG_SCHEMA.md
│   ├── BOT_INTEGRATION_PLAN.md
│   ├── BOT_CONTROL_SAFETY_MODEL.md
│   ├── CANONICAL_ANALYTICS_MODEL.md
│   ├── TRADINGVIEW_ACCESS_PLAN.md
│   ├── EDUCATION_LMS_PLAN.md
│   ├── BACKTESTER_DISTRIBUTION_PLAN.md
│   ├── MVP_SCOPE.md
│   ├── OPEN_QUESTIONS.md
│   ├── STATUS.md
│   ├── NEXT_ACTIONS.md
│   ├── CONTRACTS/
│   │   ├── tortila-adapter.md
│   │   ├── legacy-bot-adapter.md
│   │   ├── axioma-bridge.md
│   │   ├── billing-webhooks.md
│   │   ├── tradingview-access.md
│   │   └── backtester-runner.md
│   └── handoffs/
├── tests/
│   ├── e2e/                  # Playwright desktop + mobile smoke tests
│   └── integration/          # DB + service-level integration tests
├── docker-compose.yml        # Local Postgres 17 + optional worker
├── .env.example              # Redacted schema; never committed real values
├── package.json              # npm workspaces root
├── tsconfig.json             # root typecheck config (paths to @wtc/* packages)
└── eslint.config.js          # ESLint 9 flat config
```
(No `turbo.json` is present — Turbo can be added later if build caching is needed.)

---

## 3. Package Responsibilities

### `apps/web`

Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS v4. The web app is the public marketing site and the authenticated user/admin/teacher dashboard in one deployment. Route groups separate public pages from authenticated app from admin. All data-fetching uses server components and Next.js route handlers; no business logic lives in component files — all domain work is delegated to `packages/*`. Features follow a per-feature directory structure described in section 7.

### `apps/worker`

A Node.js process that runs a cron-style loop making direct repository calls (Drizzle on Postgres 17); the `job_queue` table is RESERVED / not yet consumed (no code enqueues or dequeues it). In development it runs in-process; in production it is a separate process that can be scaled independently. Responsibilities: subscription and entitlement expiry sweeps; TradingView grant/revoke task generation; bot metric snapshot polling (when adapters are wired); Axioma release-metadata cache refresh; terminal download event cleanup; notification dispatch (email/Telegram, later phase). The worker never holds secrets in memory longer than required per job.

### `packages/ui`

The design system for WTC Ecosystem. Exports primitive components (Button, Card, Badge, Table, Tabs, Input, Select, Drawer, Modal, Toast) and composite operational components (MetricCard, EquityChart, PositionTable, StatusBadge, WarnBanner, EntitlementGate, ProductCard). Every component has idle/loading/success/error/disabled states. Design tokens (CSS variables) live here and are imported by both `apps/web` and any future apps. The canonical token set comes from the discovery snapshot: `--bg:#050a12`, `--gold:#d5a94f`, `--cyan:#69e2ff`, `--green:#54d6a1`, `--red:#ff6b74` (full set in the token file). No product business logic. No direct DB calls.

### `packages/config`

Typed environment wrapper: exports a `config` object parsed and validated with Zod from `process.env`. All apps and packages import config from here — no direct `process.env` access in feature code. Separates required-in-production from optional-in-dev; throws at startup on missing required keys so misconfigured deployments fail fast.

### `packages/db`

Drizzle ORM schema definitions, `drizzle-kit` migration files, and typed repository functions. The schema is grouped into bounded contexts matching the canonical table groups: Identity, Products, Secrets, Bots, Axioma, TradingView, Education, Ops. Repository functions (e.g., `getUserById`, `insertAuditLog`, `upsertEntitlement`) encapsulate all SQL so that packages above never write raw queries. No UI. No HTTP. See [DATA_MODEL.md](./DATA_MODEL.md).

### `packages/auth`

Session creation, validation, and destruction using opaque random tokens in httpOnly+Secure+SameSite=Lax cookies. Argon2id password hashing. CSRF double-submit token helpers. RBAC role-set resolvers (`getUserRoles`, `requireRole`, `requireAnyRole`). Server-side only — these functions run exclusively in route handlers or server actions, never in client components. The session token stored in the cookie is hashed before persistence in `sessions`.

### `packages/entitlements`

**The only access source of truth.** Exports `hasAccess(userId, productCode)`, `grantAccess`, `revokeAccess`, `expireAccess`, `syncBillingState`, `explainAccess`, `listUserEntitlements`. Implements the canonical state machine: `none → pending_payment → active → grace → expired` plus `revoked`, `refunded`, `chargeback`, `manual_review`. Unknown or any non-`active`/valid-`grace` state denies access (fail-closed). Bundle expansion lives here. Manual admin grant/revoke overrides billing state and emits an audit event via `packages/audit`. No page or API route may infer access from roles, client state, or payment metadata directly. See [ENTITLEMENT_STATE_MACHINE.md](./ENTITLEMENT_STATE_MACHINE.md).

### `packages/billing`

Payment provider adapters behind a `BillingAdapter` interface. MVP ships with a `MockBillingAdapter` (state changes are in-process) and a `StripeAdapter` stub (real Stripe webhook verification, idempotent event handling). Webhook handlers will live under the planned `apps/web/src/app/api/billing/` (TARGET — no `apps/web/src/app/api/` directory exists today; billing is mock + server actions); they call `packages/billing` for signature verification and `packages/entitlements` for state transitions. Refund, chargeback, cancel, and past-due events all trigger entitlement state changes and audit events. See [BILLING_PROVIDER_PLAN.md](./BILLING_PROVIDER_PLAN.md).

### `packages/audit`

Structured audit log writer: `insertAuditLog({ actorId, actorRole, action, targetType, targetId, payload, ip, userAgent })`. The `payload` field is JSON; secrets are stripped before insertion by a redaction helper that removes keys matching a blocklist (`apiKey`, `secret`, `password`, `token`, `kek`, `dek`). Query helpers for admin audit trail views. The audit log is append-only (no updates, no deletes in the application layer). See [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md).

### `packages/crypto`

AES-256-GCM envelope encryption for exchange API key secrets (and any other at-rest secrets). Key-Encryption Key (KEK) is loaded from environment (`SECRET_VAULT_KEK`, base64 32 bytes). Per-secret random Data-Encryption Key (DEK) is generated, used to encrypt the plaintext, then itself AES-256-GCM encrypted under the KEK. The ciphertext blob is `{v, keyId, iv, tag, wrappedDek, ciphertext}`. Plaintext is zeroed from memory after use. Key rotation re-wraps all DEKs under a new KEK version without ever exposing plaintext. Decryption is scoped: only `packages/crypto` exposes the decrypt function, and callers are limited to server-side context. See [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md).

### `packages/bot-adapters`

Defines the `BotAdapter` interface and ships two concrete implementations: `TortilaAdapter` (reads from Tortila journal `:8080`) and `LegacyBotAdapter` (reads from old bot `:8000`). Also exports `MockTortilaAdapter` and `MockLegacyBotAdapter` for dev and test. **Only the mock adapters are available today; the real read-only adapters are stubbed and throw `AdapterNotReadyError`** until each endpoint mapping is verified. Write/control methods (`startBot`, `stopBot`, `applyConfig`) are defined in the interface but throw until a separately audited control adapter is approved (feature-flagged). The adapters handle their own HTTP timeouts, circuit-breaker state, and error normalization. See [BOT_INTEGRATION_PLAN.md](./BOT_INTEGRATION_PLAN.md) and [CONTRACTS/tortila-adapter.md](./CONTRACTS/tortila-adapter.md).

### `packages/axioma-bridge`

The WTC-side bridge to the Axioma product. Reads release metadata and download availability from `journal_server` (`axi-o.ma`). Resolves a user's Axioma account-link status, license state, and latest terminal version. Provides helpers for generating short-lived signed handoff tokens for "Open Axioma Journal" (issuer = WTC, audience = Axioma, scoped to the user's entitlement, with nonce and replay prevention). Axioma's desktop runtime is never imported here. The bridge is read-oriented; it does not proxy order execution. See [CONTRACTS/axioma-bridge.md](./CONTRACTS/axioma-bridge.md) and [AXIOMA_HANDOFF_TOKEN_SPEC.md](./AXIOMA_HANDOFF_TOKEN_SPEC.md).

### `packages/analytics`

Normalizes raw metrics from both bots into the canonical analytics model: closed PnL, unrealized PnL, wallet equity, ROI on margin, win rate, profit factor, max drawdown from peak, current drawdown, fees + funding, open risk, safety event count, uptime, last exchange sync. Each metric is labeled and distinguishes closed vs unrealized vs wallet values so no misleading aggregation is possible. Adapters feed typed `BotRawSnapshot` objects; this package outputs typed `CanonicalMetrics`. See [CANONICAL_ANALYTICS_MODEL.md](./CANONICAL_ANALYTICS_MODEL.md).

### `packages/lms`

Education domain services: course/lesson/material CRUD with object-ownership enforcement (a teacher cannot modify another teacher's content), enrollment management, lesson progress tracking, entitlement-gated content resolution (students cannot enumerate hidden or unentitled content). No UI. HTTP is in `apps/web` route handlers. See [EDUCATION_LMS_PLAN.md](./EDUCATION_LMS_PLAN.md).

### `packages/tradingview-access`

Manual-first TradingView username request and grant/revoke workflow. Exports `submitAccessRequest`, `grantAccess`, `revokeAccess`, `checkExpiryAndQueue`. The admin queue is a view over `tradingview_access_tasks`. Automation is defined as an optional adapter behind a feature flag; by default the workflow is manual. No credential-stuffing. No brittle browser automation in production paths. See [TRADINGVIEW_ACCESS_PLAN.md](./TRADINGVIEW_ACCESS_PLAN.md) and [CONTRACTS/tradingview-access.md](./CONTRACTS/tradingview-access.md).

### `packages/backtester`

Tortila backtester distribution model: job lifecycle (`pending → running → done | failed`), result artifact schema, local runner download packaging plan, and visualization data model. Does not ship fake backtest results. The actual backtest computation runs in the local Tortila runner; this package defines the interface for submitting jobs, polling status, and displaying results in the WTC UI. See [BACKTESTER_DISTRIBUTION_PLAN.md](./BACKTESTER_DISTRIBUTION_PLAN.md) and [CONTRACTS/backtester-runner.md](./CONTRACTS/backtester-runner.md).

### `packages/shared`

Common TypeScript types used across multiple packages: `ProductCode`, `PlanCode`, `EntitlementState`, `RbacRole`, API error envelopes, pagination types, Zod schema primitives. No runtime side-effects. Acts as a shared type vocabulary; anything that would create a circular dependency should be moved here.

---

## 4. API Namespaces

> **TARGET (planned), not current.** There is no `apps/web/src/app/api/` directory today; the app currently uses server actions plus the `apps/web/src/lib/backend.ts` selector. The table below is the planned REST surface, not the present build.

The planned design is that all routes live under `apps/web/src/app/api/` as Next.js route handlers, with every mutation following the pipeline described in section 5.

| Namespace | Purpose | Auth requirement |
|---|---|---|
| `POST /api/auth/login` | Create session | Public |
| `POST /api/auth/register` | Create account | Public |
| `POST /api/auth/logout` | Destroy session | Any authenticated |
| `POST /api/auth/forgot-password` | Password reset flow | Public |
| `GET /api/me` | Current user profile + entitlements summary | Authenticated |
| `PATCH /api/me` | Update profile fields | Authenticated |
| `GET /api/products` | List all products with public pricing | Public |
| `GET /api/products/:code` | Single product detail | Public |
| `GET /api/entitlements` | Current user's entitlement states | Authenticated |
| `GET /api/entitlements/:productCode` | Single product access state + reason | Authenticated |
| `GET /api/bots` | List user's bot instances | Authenticated + `tortila_bot` or `legacy_bot` entitlement |
| `GET /api/bots/tortila/health` | Tortila journal health pass-through | Authenticated + entitlement |
| `GET /api/bots/tortila/summary` | Adapter: summary from `:8080/api/summary` | Authenticated + entitlement |
| `GET /api/bots/tortila/overview` | Adapter: overview | Authenticated + entitlement |
| `GET /api/bots/tortila/trades` | Adapter: trades | Authenticated + entitlement |
| `GET /api/bots/tortila/equity` | Adapter: equity curve | Authenticated + entitlement |
| `GET /api/bots/tortila/decisions` | Adapter: recent decisions | Authenticated + entitlement |
| `GET /api/bots/tortila/marks` | Adapter: marks | Authenticated + entitlement |
| `GET /api/bots/tortila/warnings` | Known risk signals (TP/margin warnings) | Authenticated + entitlement |
| `GET /api/bots/legacy/health` | Legacy bot API health | Authenticated + `legacy_bot` entitlement |
| `GET /api/bots/legacy/settings` | Legacy bot API settings (read) | Authenticated + entitlement |
| `GET /api/bots/legacy/stage-config` | Legacy bot stage/slot config (read) | Authenticated + entitlement |
| `POST /api/bots/:bot/config` | Save bot config draft | Authenticated + entitlement + audit |
| `POST /api/bots/:bot/config/validate` | Validate config without saving | Authenticated + entitlement |
| `GET /api/axioma/status` | Axioma license + account-link state for user | Authenticated + `axioma_terminal` entitlement |
| `GET /api/axioma/releases` | Latest terminal releases from bridge | Authenticated + entitlement |
| `GET /api/axioma/download` | Signed download URL (scoped, expiring) | Authenticated + entitlement |
| `POST /api/axioma/account-link` | Initiate account-link / handoff flow | Authenticated + entitlement + audit |
| `DELETE /api/axioma/account-link` | Unlink Axioma account | Authenticated + entitlement + audit |
| `GET /api/tradingview-access` | User's TV access requests + grant status | Authenticated + `tradingview_indicators` entitlement |
| `POST /api/tradingview-access` | Submit TV username access request | Authenticated + entitlement + audit |
| `GET /api/education/courses` | List entitled courses | Authenticated + `education` entitlement |
| `GET /api/education/courses/:id` | Course detail + lessons (gated) | Authenticated + entitlement |
| `GET /api/education/lessons/:id` | Lesson content (gated) | Authenticated + entitlement |
| `POST /api/education/progress` | Update lesson progress | Authenticated + entitlement |
| `GET /api/admin/users` | User list + roles | `admin` role |
| `GET /api/admin/users/:id` | User detail + entitlements | `admin` |
| `POST /api/admin/entitlements` | Manual grant/revoke | `admin` + audit |
| `GET /api/admin/tradingview-access` | Pending TV access tasks | `admin` |
| `POST /api/admin/tradingview-access/:id/grant` | Grant TV access | `admin` + audit |
| `POST /api/admin/tradingview-access/:id/revoke` | Revoke TV access | `admin` + audit |
| `GET /api/admin/system-health` | All adapter/bridge health checks | `admin` |
| `GET /api/admin/axioma/releases` | Manage Axioma release cache | `admin` |
| `POST /api/admin/axioma/releases` | Push new release metadata | `admin` + audit |
| `GET /api/support/tickets` | User's support tickets | Authenticated |
| `POST /api/support/tickets` | Create support ticket | Authenticated + audit |
| `GET /api/support/tickets/:id` | Ticket detail | Authenticated + ownership |
| `POST /api/support/tickets/:id/messages` | Reply to ticket | Authenticated + ownership |
| `GET /api/admin/support/tickets` | All tickets | `admin` or `support` role |
| `GET /api/audit/log` | User's own audit events | Authenticated |
| `GET /api/admin/audit/log` | Full audit log (paginated, filterable) | `admin` |

> **TARGET (planned), not current.** The billing webhook route below is part of the planned `/api/` surface; it is not built today (no `apps/web/src/app/api/` directory exists).

**Billing routes** (`/api/billing/`) are handled by the `StripeAdapter` webhook receiver; they verify the provider signature before any state change and are outside the standard RBAC gate (they use provider-signature auth instead).

---

## 5. Mutation Pipeline

Every state-changing route handler (POST/PATCH/PUT/DELETE) follows this exact sequence. Deviating from the order is a bug.

```
HTTP request
    │
    ▼
1. Zod schema validation (packages/shared schemas)
    │ 422 on any validation error — client receives field-level errors
    ▼
2. Session authentication (packages/auth)
    │ 401 if no valid session
    ▼
3. Server-side RBAC check (packages/auth — requireRole)
    │ 403 if role insufficient
    ▼
4. Entitlement check if product-gated (packages/entitlements — hasAccess)
    │ 403 + reason code if entitlement denied
    ▼
5. Business logic / action (packages/*)
    │ Domain errors → structured error response
    ▼
6. Audit log insert (packages/audit — insertAuditLog, non-blocking*)
    │ Failure logged but does not roll back the action (see note below)
    ▼
7. HTTP response

* The audit log write is in the same DB transaction for critical mutations
  (key creation, entitlement grant/revoke, admin actions). For read-heavy
  adapters (bot health polls) it is fire-and-forget.

Secret rule: at no point in this pipeline are exchange API keys, session
secrets, KEK/DEK values, or TradingView passwords present in route handler
scope unless the specific route is a vault operation, and even then only the
scoped decrypt result is used, never stored in locals or returned.
```

---

## 6. Background Worker Responsibilities

The `apps/worker` process today runs a cron-style loop that calls typed handlers directly (it does NOT poll `job_queue` — that table is RESERVED/unconsumed). Each handler is idempotent (safe to retry). Planned job types and their triggers:

| Job type | Trigger | Handler package | Frequency |
|---|---|---|---|
| `entitlement.expire` | Worker sweep | `packages/entitlements` | Every 15 min |
| `subscription.sync` | Worker sweep | `packages/billing` | Every 30 min |
| `tradingview.queue_revoke` | Entitlement expiry event | `packages/tradingview-access` | On event |
| `tradingview.check_pending` | Worker sweep | `packages/tradingview-access` | Every 1 hour |
| `bot.snapshot_poll` | Worker sweep (when adapters wired) | `packages/bot-adapters` | Every 5 min |
| `axioma.release_sync` | Worker sweep | `packages/axioma-bridge` | Every 6 hours |
| `axioma.download_cleanup` | Worker sweep | `packages/axioma-bridge` | Daily |
| `notification.dispatch` | Event-driven (future phase) | Internal | On event |

The worker today makes cron-style direct repository calls; there is no `job_queue` consumer and no `SKIP LOCKED` claim implemented yet (the `job_queue` table is RESERVED scaffolding). A future durable queue would use `SELECT ... FOR UPDATE SKIP LOCKED` on `job_queue` rows so multiple worker instances can run safely. In development, the worker can be started in-process via a flag in `apps/web`; in production it is a separate Node.js process deployed alongside the web app.

---

## 7. UI Layering: Feature Directories

No god component. Every product feature lives in its own directory under `apps/web/src/features/` with a consistent internal shape:

```
apps/web/src/features/
  dashboard/
    components/      # AccountOverviewCard, ProductAccessGrid, WarningBanner
    queries.ts       # Server-side fetch functions (called from server components)
    actions.ts       # Server actions for mutations
    schemas.ts       # Zod input schemas
    types.ts         # Local TypeScript types
  bots/
    tortila/
      components/    # TortilaDashboard, EquityPanel, TradeTable, RiskWarnings
      queries.ts
      actions.ts
      schemas.ts
      types.ts
    legacy/
      components/    # LegacyDashboard, ConfigForm, StageEditor
      queries.ts
      actions.ts
      schemas.ts
      types.ts
    shared/
      components/    # BotSetupWizard, ApiKeyVaultForm, MetricsGrid, HealthBadge
      types.ts
  axioma/
    components/      # AxiomaProductCard, LicenseState, DownloadCTA, JournalLink
    queries.ts
    actions.ts
    schemas.ts
    types.ts
  billing/
    components/      # PlanCard, SubscriptionStatus, PaymentHistory
    queries.ts
    actions.ts
    schemas.ts
    types.ts
  education/
    components/      # CourseGrid, LessonPage, ProgressTracker, MaterialList
    queries.ts
    actions.ts
    schemas.ts
    types.ts
  tradingview/
    components/      # TVAccessRequest, AccessStatusBadge, AdminGrantQueue
    queries.ts
    actions.ts
    schemas.ts
    types.ts
  admin/
    components/      # UserTable, EntitlementManager, AuditLogTable, HealthPanel
    queries.ts
    actions.ts
    schemas.ts
    types.ts
  support/
    components/      # TicketList, TicketThread, NewTicketForm
    queries.ts
    actions.ts
    schemas.ts
    types.ts
```

Route files in `apps/web/src/app/` are thin shells: they import feature components and pass server-fetched data down. No data fetching or domain logic in `page.tsx` files beyond calling `queries.ts` functions.

---

## 8. Deployment Phases

Deployment is gated; each phase requires explicit operator approval before proceeding to the next.

| Phase | Environment | Services active | Bot adapter mode | Notes |
|---|---|---|---|---|
| **Local dev** | `localhost:3000` + Postgres in Docker | `apps/web` + `apps/worker` (in-proc) | Mock adapters only | No live bot connections. All secrets local. |
| **Safe IP preview** | `127.0.0.1:8300` on production host, operator-only raw-IP/domain proxy | `npm run preview:safe` / Next dev container; set `WTC_DEV_ALLOWED_ORIGINS` only in operator env if needed | Mock adapters only, live controls forced off | Public preview URL is operator-only (`<raw-preview-url>`); not production and not DB-backed unless explicitly configured. |
| **Production nginx approval** | Public domain (e.g., `wtc.example.com`) | production Next start path behind nginx | Still read-only adapters | nginx config reviewed + approved before activation. |
| **Axioma bridge** | Production | Real bridge to `axi-o.ma / :8123` | Read-only; mock still for bots | Signed handoff tokens operational. Entitlement sync live. |
| **Read-only bot adapters** | Production | Real adapter calls to `:8080` (Tortila) and `:8000` (Legacy) | Read-only: health, metrics, trades | All adapter calls logged. No write/control. |
| **Audited controls** | Production (future phase) | Control methods enabled per adapter audit sign-off | Control methods unlocked per bot after audit | Separate safety spec required. "Stop bot" ≠ "close positions". |

The deployment phase flag is `BOT_ADAPTER_MODE` in `packages/config`: `mock | read-only | audited`. The entitlement engine is always live from phase 1 onward.

---

## 9. Stack Justification

### npm workspaces (not pnpm or Turbo)

`pnpm` is unavailable on the current host (Node 24 + npm 11 confirmed). npm workspaces provide the same workspace hoisting and `--workspace` script targeting without requiring an additional binary. No `turbo.json` is present (it was never scaffolded); Turbo can be added later if build caching is needed. (ADR-001)

### Drizzle ORM (not Prisma)

Drizzle is SQL-first with no Rust binary, no query engine process, and no generated client to manage across Node versions. This makes it ideal for a repository pattern over a shared Postgres database and for writing the analytics queries that join bot snapshot tables. Drizzle migrations (via `drizzle-kit generate` + `drizzle-kit migrate`) are plain SQL files that are transparent and auditable. (ADR-002)

### Next.js 15 route handlers + server actions (not a separate `apps/api`)

For the MVP scope, collocating the API surface inside the Next.js app removes a deployment unit, a network hop, and a second authentication boundary without sacrificing separation of concerns (all domain logic is in `packages/*`). The trade-off is acknowledged: if the API must scale or be consumed independently (e.g., a future mobile app), the route handlers can be extracted into a standalone Fastify/Hono app while the package boundaries remain unchanged. (ADR-003)

### Zod at every boundary

Zod schemas defined in `packages/shared` are the single canonical definition of every request and response shape. The same schema used for API validation generates the TypeScript types used in client code. This eliminates the category of bugs where client and server disagree on the shape of a mutation.

### Argon2id + httpOnly sessions (not JWT)

JWT access tokens are stateless, which makes immediate revocation impossible — a critical property for a platform that must revoke access when entitlements expire or bots are de-authorized. httpOnly session cookies + server-side session table give WTC full control over session lifecycle, including instant invalidation on logout, revocation, or suspicious activity. (ADR-007)

---

## 10. Risk Register (Architecture Layer)

| Risk | Severity | Mitigation |
|---|---|---|
| Live bot control before audit complete | P0 | `BOT_ADAPTER_MODE` flag; control methods throw until unlocked |
| Exchange API key exposure | P0 | AES-256-GCM envelope; never returned in API; redaction in audit log |
| Entitlement bug grants wrong access | P0 | `packages/entitlements` is the only access path; fail-closed state machine; unit tests |
| Tortila TP/margin known warnings hidden | P0 | `warnings` endpoint in adapter; WTC UI always shows `WarnBanner` if warnings present |
| TradingView ToS / automation compliance | P1 | Manual-only queue by default; automation strictly behind feature flag |
| Axioma rename (`com.greenfield.terminal`) | P1 | Rename is a deliberate migration, documented in OPEN_QUESTIONS.md |
| Cross-domain auth WTC ↔ Axioma | P1 | Signed handoff token spec; explicit "connect Axioma account" flow; no silent cross-domain cookies |
| pnpm/turbo unavailable for CI | P2 | npm workspaces sufficient; CI uses `npm ci` |
| Tortila journal `:8080` not behind nginx | P1 | Adapter calls are server-side only; no direct browser exposure; firewall review recommended |

---

## 11. Phase 2 Architecture Deltas

> This section records what changes (or is confirmed unchanged) entering Wave-2 / Phase 2 implementation.
> The sub-sections below are the canonical reference; the Wave-2 sequenced plan lives in
> `docs/handoffs/20260530-0126-ecosystem-platform-architect.md`.

### 11.1 Package inventory — no new packages needed

Wave-2 reuses the existing 14 packages. The mapping of Part to package:

| Wave-2 Part | Package(s) consumed | Notes |
|---|---|---|
| Part 1 — Full LMS | `@wtc/lms`, `@wtc/db`, `@wtc/entitlements`, `@wtc/audit` | Migration `0002` adds `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`. Additive only. |
| Part 2 — Billing / Stripe | `@wtc/billing`, `@wtc/entitlements`, `@wtc/audit`, `@wtc/db` | StripeAdapter wired; webhook route `app/api/billing/`. |
| Part 3 — Axioma ES256 / real bridge | `@wtc/axioma-bridge`, `@wtc/crypto`, `@wtc/audit` | HS256 stub replaced by ES256/JWKS signer per `AXIOMA_HANDOFF_TOKEN_SPEC.md`. |
| Part 4 — Bot analytics dashboard | `@wtc/bot-adapters`, `@wtc/analytics`, `@wtc/db`, `@wtc/audit` | Mock adapters only; `@wtc/analytics` `computeMetrics` is the pure transform. |
| Part 5 — Auth hardening | `@wtc/auth`, `apps/web/src/middleware.ts` | Rate-limiting, append-only audit DB role. |

No new `packages/*` directory is introduced. If a future need arises (e.g. a notification package), it must be justified in an ADR before creation. `@wtc/analytics` owns ALL bot metric normalization logic; React components never compute metrics.

### 11.2 Feature directory layout — confirmed canonical

The `apps/web/src/features/<domain>/` layout defined in §7 is the sole home for Wave-2 UI logic. Each feature directory contains `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`, and a `components/` subdirectory. `page.tsx` files remain thin shells: they call `queries.ts` functions and pass data to feature components. No domain logic in `page.tsx`.

New feature directories introduced in Wave-2:

```
apps/web/src/features/
  lms/                     # full LMS: enrollments, progress, teacher-profile, materials
    queries.ts
    actions.ts
    schemas.ts
    types.ts
    components/            # CourseGrid, LessonPage, ProgressBar, EnrollmentGate, MaterialList
  billing/                 # Stripe checkout, subscription status, payment history
    queries.ts
    actions.ts
    schemas.ts
    types.ts
    components/            # PlanCard, CheckoutButton, SubscriptionStatus, PaymentHistory
  bots/
    tortila/
      queries.ts           # fetchTortilaHealth, fetchTortilaMetrics, fetchTortilaWarnings
      actions.ts           # (no mutations until audited control)
      schemas.ts
      types.ts
      components/          # TortilaDashboard, EquityChart, TradeTable, RiskWarnings
    legacy/
      queries.ts
      actions.ts
      schemas.ts
      types.ts
      components/          # LegacyDashboard, ConfigReadView, StageView
    shared/
      components/          # BotMetricGrid, HealthBadge, WarnBanner, ApiKeyVaultForm
      types.ts
```

Existing partial feature directories (`bots/`, `axioma/`, `tradingview/`, `admin/`, `support/`) are extended in-place.

### 11.3 Part 4 analytics data-flow

Bot analytics logic must live entirely in `packages/analytics`. The data-flow is:

```
Mock/Real BotAdapter (packages/bot-adapters)
    │  returns BotSnapshot: { trades, positions, equityCurve, walletEquity, warnings }
    ▼
apps/web/src/features/bots/tortila/queries.ts  (server-only)
    │  calls adapter.getSnapshot(instanceId)
    │  calls computeMetrics(snapshot) from @wtc/analytics
    ▼
CanonicalMetrics  (typed output, serializable — no class instances, no functions)
    │
    ▼
page.tsx  (passes CanonicalMetrics + warnings as props to feature components)
    │
    ▼
TortilaDashboard / LegacyDashboard components  (display only; no metric computation)
```

Rules enforced by this architecture:
1. `computeMetrics` is called exactly once per request, in `queries.ts`, server-side.
2. Feature components receive `CanonicalMetrics` as a typed prop — they never import `@wtc/analytics` directly.
3. `RiskWarning[]` from the adapter is always rendered if non-empty. A `WarnBanner` with severity `error` blocks the green-card display.
4. All nulls from `CanonicalMetrics` render as `—`, never as `0`.

### 11.4 Schema migration sequence (additive)

Wave-2 introduces one additive migration:

- `0002_lms_full.sql` — adds `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`.
  Existing `courses`/`lessons`/`materials` rows are unaffected (no column drops).
  Coordinates with db-architect via the Wave-2 handoff.

No migration is introduced for billing (Stripe metadata fields added to `subscriptions` via `onConflictDoUpdate`), axioma (existing `axioma_account_links` extended with nullable columns), or bot analytics (existing `bot_metric_snapshots` used as-is for caching adapter output).

### 11.5 Server action mutation pipeline — Wave-2 additions

All Wave-2 server actions follow the existing mutation pipeline (§5): Zod → session auth → RBAC → entitlement → business logic → in-txn audit → response. Additional Wave-2 rules:

- Billing webhook route (`/api/billing/webhook`): Stripe signature verified BEFORE any parsing; idempotency key = `stripe_event_id`; entitlement state change and audit row written in one transaction.
- LMS teacher mutations: object-ownership check (`assertTeacherOwns`) runs as step 3.5, between RBAC and the main business logic call.
- Bot config save: config is written to `bot_configs` (WTC DB only); it is NEVER forwarded to the live bot until `BOT_ADAPTER_MODE=audited`. Audit row always written in the same transaction.

### 11.6 Confirmed non-changes

- `apps/web/src/lib/backend.ts` selector pattern (DB vs in-memory, fail-closed) is extended with new service selectors as needed (e.g. `billingService`, expanded `lmsService`) using the exact same guard pattern already in place.
- `BOT_ADAPTER_MODE` remains the single runtime flag for adapter promotion (`mock → read-only → audited`).
- `job_queue` remains RESERVED/unconsumed through Wave-2. Worker still uses cron-style direct calls.
- No new `apps/*` process is introduced. Worker and Web remain the only two processes.

---

## 12. Phase 2.4 Architecture Deltas

> Added epoch 20260530-1625. Records what changed in Phase 2.4 (real bot read-only + access ops + production spine).
> Authoritative record: `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md`.

### 12.1 Migration 0003 — now 40 tables

Phase 2.4 added migration `0003_fresh_blockbuster.sql` (additive):
- `billing_webhook_events` — durable idempotency store with UNIQUE `(provider, event_id)` constraint.
  **Supersedes** the earlier `webhook_idempotency_keys` design (never built). Landed table name is
  `billing_webhook_events`.
- `billing_manual_review_items` — fail-closed admin review queue for ambiguous webhook events (missing
  userId, unknown plan). Admin approve/reject/dismiss; **never auto-grant**.
- UNIQUE index on `subscriptions(user_id, provider, provider_ref)`.
- Composite index on `audit_logs(action, target_type, target_id)` (`audit_action_target_idx`).

**Total tables as of Phase 2.4: 40.**

### 12.2 Tortila journal adapter — read-only CURRENT

`packages/bot-adapters` now has real Zod-validated schemas (`tortila.schemas.ts`), 11 fixture JSON
files, and implemented read methods (`getMetrics`/`getPositions`/`getTrades`/`getEquityCurve`) mapped
from the confirmed journal source shapes. Key mapping rules (non-negotiable):

- `fees_pnl` from the journal is negative (profit-reducing); WTC uses `Math.abs(fees_pnl)` to store
  fees as a positive cost value in `CanonicalMetrics.fees`.
- `unrealizedPnl` is honestly unavailable (`=0`, not fabricated) because mark prices come from
  `/api/marks` which WTC **must never consume** (the bot owns the exchange connection).
- `winRatePct` is `null` (not `0`) when the trade count is zero — never fabricated.
- `filterZeroEquity` is applied before `computeDrawdown` to prevent artifact drawdown from zero-equity
  rows.
- The worker `snapshotTortilaJournal` job is env-guarded by `TORTILA_JOURNAL_URL`. In its absence,
  the health record shows `not_configured` — never a false positive.

Control methods (`startBot`/`stopBot`/`applyConfig`) remain hard-disabled regardless of adapter mode.
Legacy bot adapter remains BLOCKED (plaintext keys unresolved — 5 security gates NOT STARTED).

### 12.3 Billing webhook hardening

The webhook route (`POST /api/billing/webhook`) now uses `insertWebhookEventOnce` (INSERT-then-detect-
conflict) rather than the previous select-then-insert on `audit_logs`. The INSERT is attempted AFTER
signature verification but BEFORE entitlement mutation. If INSERT raises a unique-constraint violation,
the event is a duplicate and the handler returns HTTP 200 with no state change. On processing error,
the `billing_webhook_events` row is deleted so the provider retry re-processes cleanly.

Missing or ambiguous `userId` → `createManualReviewItem` (snapshot contains `{id, type, planCode}` —
no PII, no secrets) + admin notification. Admin never receives an auto-grant; all ambiguous events
require explicit admin approval.

### 12.4 TradingView atomicity

`atomicGrantTv` and `atomicRevokeTv` (in `packages/db/src/repositories.ts`) commit the
request + grant + profile + audit in a single transaction. `revokeReason` is persisted end-to-end.
No orphan state is possible if the transaction rolls back. The worker `sweepTvExpiry` now calls
`atomicRevokeTv` with a system actor and conflict-safely queues one manual revoke task per `(request_id, kind)`.

### 12.5 `apps/web/src/middleware.ts` — architectural gap (Phase Group 11 prerequisite)

No `middleware.ts` exists in `apps/web/src/` as of Phase 2.4. The billing webhook contract requires
the webhook path to be excluded from CSRF middleware at the framework level. Phase Group 11 (security)
must create this file on the serial implementation spine before any other group adds API route handlers
that depend on per-request authentication, rate-limiting, or CSRF logic. See ADR-015.

### 12.6 12-group program execution ordering

The execution ordering and dependency graph for the 12 program phase groups is in
`docs/handoffs/20260530-1625-ecosystem-platform-architect.md` (this session). Summary:

```
Critical path: 1 → 11 → [2,3,4,5,6,7] → [8,9,10] → 12

Group 1  — Foundation/Truth:           No dependencies. Start now.
Group 11 — Security/middleware.ts:     Depends on 1. Serial spine file.
Groups 2-7 — Product workstreams:      Depend on 1+11. Parallelizable with disjoint scopes.
Groups 8-10 — Console/UX/Backtester:  Depend on 2-7.
Group 12 — CI/Deployment:             Depends on all; requires git init + remote.
```

Parallelization constraint: `packages/db/src/repositories.ts` and `apps/web/src/lib/backend.ts` are
shared files. Any two groups that add DB queries or service selectors must be serialized (DB-architect
wave first, then consumers), per ADR-014.

---

## 13. Phase Group 6 (PG6) Architecture Deltas — Axioma Non-Blocked Surface

> Added epoch 20260530-2230. Pre-implementation audit by ecosystem-platform-architect.
> Authoritative per-agent handoff: `docs/handoffs/20260530-2230-ecosystem-platform-architect.md`.
> Scope: ES256 signer wiring + staging fence + jti replay store. CTAs remain DISABLED (B4).
>
> **As-shipped reconciliation (operator decisions — see the PG6 aggregate
> [`20260530-2230-phase-2-9-axioma-es256-jti-store.md`](handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md)).**
> §13 below is the *pre-implementation design*; three points shipped differently:
> 1. **The fence lives in a pure `resolveHandoffSigner` in `packages/axioma-bridge/src/signer.ts`** (not in
>    `server-config.ts`). `signHandoffToken` was NOT changed to take `isProductionLike` — it keeps its
>    `NODE_ENV==='production'` throw as defense-in-depth (the existing test stays green); the new staging+prod
>    fence is `resolveHandoffSigner` (keyed on `APP_ENV`) + the env.ts boot superRefine.
> 2. **The web route signer resolver now exists for the journal-handoff skeleton** (`resolveAxiomaRouteSigner`);
>    JWKS readiness is parse-verified and returns fail-closed 503/no-store when not configured.
> 3. **The unused `AXIOMA_HANDOFF_SIGNING_SECRET` production requirement was removed in Phase 3.9**; ES256 key/kid
>    are the staging/production gate. **Repo functions shipped as** `recordHandoffJti` / `consumeHandoffJti(db, jti, now): ConsumeJtiResult
>    {consumed, reason?, sub?}` / `revokeHandoffJtisByUser` / `purgeExpiredHandoffJtis` (db-architect naming; the
>    result object carries the failure `reason` + `sub`, not a bare boolean). The jti repos are **pure (no inline
>    audit)**; Phase 3.10 adds the WTC-side consume route that writes `axioma.handoff_jti_consume` /
>    `axioma.handoff_jti_replay` audit rows.

### 13.1 Deployment-env discriminator: `APP_ENV`

`packages/config/src/env.ts` gains a new field:

```typescript
APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development')
```

`NODE_ENV` is not extended (it is consumed by Next.js/Vitest and must remain `development | test | production`). `APP_ENV` is the deployment-env discriminator for business-logic fences. The staging+production fence for the ES256 signer applies when Axioma routes are explicitly enabled: `(APP_ENV === 'staging' || APP_ENV === 'production') && AXIOMA_ROUTE_SKELETON_ENABLED === true`.

A new `superRefine` check requires `AXIOMA_BRIDGE_API_TOKEN`, `AXIOMA_HANDOFF_SIGNING_KEY`, and `AXIOMA_HANDOFF_KEY_ID` to be present when Axioma routes are enabled in `staging` or `production`. If the Axioma module is out of scope, keep `AXIOMA_ROUTE_SKELETON_ENABLED=false`; Axioma routes remain fail-closed while the rest of WTC can deploy.

### 13.2 Env schema additions: `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`

Both variables are formalized in `envSchema` as `z.string().optional()`. Previously they were consumed directly from raw `process.env` in the JWKS route — a validation gap. After PG6 they are validated at startup alongside all other env vars. The JWKS route reads from `loadEnv()` instead of `process.env` directly.

### 13.3 Pure-package constraint preserved: signer resolution at the web layer

`@wtc/axioma-bridge` must have zero runtime dependencies beyond Node built-ins. It must NOT import `@wtc/config` or read `process.env`. The PG6 wiring respects this constraint:

```
packages/config/src/env.ts           ← parses APP_ENV, AXIOMA_HANDOFF_SIGNING_KEY, KEY_ID
         ↓
apps/web/src/lib/server-config.ts    ← getAxiomaSignerOrNull(): Es256Signer | null
         ↓  (passes in signer or null)
packages/axioma-bridge/src/bridge.ts ← factory accepts Es256Signer | null as a parameter
```

`getAxiomaSignerOrNull()` is the single resolution point: it calls `loadEnv()`, checks `APP_ENV`, and returns either `createEs256Signer(pem, kid)` from `@wtc/axioma-bridge` or `null` for dev/test. Business logic in packages, not React; env resolution at the web server layer; bridge stays pure.

The `signHandoffToken` guard in `packages/axioma-bridge/src/handoff.ts` is updated to accept a caller-passed `isProductionLike: boolean` parameter instead of reading `process.env.NODE_ENV` directly. This removes the last direct `process.env` access from the pure package.

### 13.4 Migration 0004 — `axioma_handoff_jti_revocations` (tightly scoped)

Migration 0004 adds exactly one table:

```sql
CREATE TABLE axioma_handoff_jti_revocations (
  jti           uuid PRIMARY KEY,
  sub           uuid NOT NULL,
  issued_at     timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  revoked_at    timestamptz,
  revoke_reason text
);
```

Scope discipline: the `axioma_account_links` refactor (raw OTC → link_nonce_hash, missing columns) belongs to the BLOCKED OTC account-link workstream (B4) and is NOT included in 0004. Total tables after 0004: 41.

### 13.5 Repository functions for jti lifecycle

Three new repository functions in `packages/db/src/repositories.ts`:

- `insertJti(db, {jti, sub, issuedAt, expiresAt})` — called at token issuance.
- `consumeJti(db, jti, now): Promise<boolean>` — atomic `UPDATE ... SET used_at=now() WHERE jti=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()`. Returns `rowsUpdated === 1`. Single-statement; no SELECT-then-UPDATE (TOCTOU prevention).
- `purgeExpiredJtis(db, now): Promise<number>` — deletes rows where `expires_at < now - 1 hour`. Returns count purged.

### 13.6 Worker: jti purge job added to `dbTick`

`apps/worker/src/index.ts` dbTick gains a `purgeExpiredJtis(db, now)` call after the existing TV sweeps. Non-fatal (wrapped in try/catch); logs the count purged. Same direct-repository-call pattern as `markExpiringSoon` / `sweepTvExpiry`.

### 13.7 Audit action codes for jti lifecycle

Three codes added to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts`:
- `axioma.handoff_jti_consume`
- `axioma.handoff_jti_replay`
- `axioma.handoff_jti_revoke`

These are the codes for the `consumeJti` repository to write audit rows in-transaction.

### 13.8 CTAs remain disabled (B4)

PG6 wires the ES256 path and adds the jti store, but the Download / Open-Journal / OTC account-link CTAs remain disabled dev-placeholders. `axiomaBridgeIsDev()` still returns true when `AXIOMA_BRIDGE_API_TOKEN` is absent. B4 requires: (a) EXT — confirmed `journal_server` endpoint shapes; (b) OP — provisioned EC P-256 key. Both are external dependencies.

### 13.9 INTEGRATION_MAP §6.2 JWKS path correction

The INTEGRATION_MAP §6.2 row "Handoff signer" stale path `/api/axioma/.well-known/jwks.json` is corrected to `/.well-known/axioma-jwks.json` (the actual Next.js App Router route location). See INTEGRATION_MAP §8.2.
