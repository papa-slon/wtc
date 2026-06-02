# orchestrator-seed handoff

Canonical decisions and discovery facts. **Every agent must read this file first.**
For **session & multi-agent process** governance (agents-before-edits, per-agent handoffs, the
"N-agent" honesty rule, gates RUN/NOT-RUN), read [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md).
If you must deviate, record the reason in `docs/ARCHITECTURE_DECISIONS.md` and
`docs/OPEN_QUESTIONS.md`. Conflicting facts → newest discovery doc wins.

## Scope

Seed the WTC Ecosystem Platform build. Lock stack, naming, states, and tokens so
all parallel agents produce consistent artifacts.

## Discovery facts (read-only, from WTC_ECOSYSTEM_DISCOVERY_MAP.md, snapshot 2026-05-29 08:04 UTC)

Decision: we DO NOT re-SSH the live trading server. The discovery map is a complete
read-only snapshot dated today; relying on it is the safest reading of the
"do not touch live server" rule. Local repos were read read-only.

- **Old/Legacy bot** `/home/ubuntu/apps/bot` — FastAPI, Postgres/SQLAlchemy, tmux `bot`, port `:8000`.
  API: `/auth/login`, `/auth/register`, `/api_management/`, `/api_management/{api_id}`,
  `/api_management/{api_id}/settings`, `/api_management/{api_id}/stage_config`,
  `/api_management/{api_id}/retest`. Config concepts: API keys, symbols, RSI/CCI,
  averaging levels, take-profit %, leverage, balance %, stages/slots.
- **Tortila bot** `/home/ubuntu/apps/turtle_bingx` — Python `turtle_bot`, SQLite, systemd `turtle-bot.service`. No public HTTP for worker.
  Local source: `C:\Users\maxib\GTE BOT\bot_tortila` (pkg `turtle_bot`: exchange/bingx_client, strategy/{turtle,indicators,atr_gerchik,winner_filter,trailing_tflab}, risk/risk_manager, execution/{order_manager,position}, state/{store,models}, engine/{orchestrator,reconciler}, journal/{app,metrics}).
- **Tortila journal** systemd `turtle-journal.service`, port `:8080`.
  API: `/api/health` → `{ok:true}`, `/api/summary`, `/api/overview`, `/api/trades`, `/api/equity`, `/api/decisions`, `/api/marks`.
  KNOWN RISK SIGNALS (must surface as warnings, never hide behind a green card):
  repeated TP/stop missing & re-placement; exchange-flat mismatch reconciliation;
  NEAR TP rejection `101211`; BingX rate-limit/funding `100410`; fill lookup `109421`;
  margin-preflight block on a LINK add. Open P0/P1: TP reconciliation/restore, margin pre-flight.
- **Axioma journal server** `/home/ubuntu/journal_server` — FastAPI + alembic, uvicorn `127.0.0.1:8123`, nginx `axi-o.ma`/`www.axi-o.ma`.
  Modules: auth/register/login, entitlements, terminal release metadata, terminal downloads,
  user settings, journal/trades, stats/analytics (stats_v2), feedback/support, JWT/rate-limit.
  Health `GET /health` → `{status:ok, db:connected, service:journal-server}`.
- **Axioma desktop terminal** `C:\Users\maxib\TV_GREENFIELD_TERMINAL` — Electron 33 + React 18 + TS + lightweight-charts + zustand.
  Exchange keys encrypted locally with Electron `safeStorage`; license vault `license.enc`.
  Package identity is still `com.greenfield.terminal` / "Trading Terminal" → rename to Axioma is a
  DELIBERATE migration, not a blind replace (see OPEN_QUESTIONS).
- **nginx**: only `axioma-journal` site active. Bot ports `:8000`/`:8080` bound to `0.0.0.0` with no discovered reverse proxy → do not assume protected proxy.

## Locked stack (pnpm unavailable on this host → npm workspaces)

- Monorepo: **npm workspaces** + TypeScript project references. (Turbo optional, not required to run.)
- Web: **Next.js 15 App Router + React 19 + TypeScript 5**.
- Styling: **Tailwind CSS v4** + CSS-variable design tokens (below).
- DB: **PostgreSQL 16 + Drizzle ORM + drizzle-kit** migrations. (Prisma was the alt; Drizzle chosen for SQL-first repos in `packages/db`.) _(Superseded → PostgreSQL 17; see ADR-010.)_
- Auth: **custom session auth**, httpOnly+Secure+SameSite cookies, **Argon2id** password hashing, CSRF double-submit, server-side RBAC.
- Validation: **Zod** at every boundary.
- Charts: **Recharts** (MVP) + lightweight-charts for equity later.
- Secret vault: **AES-256-GCM envelope encryption** (KEK from env → per-secret DEK), key id metadata, rotation + revoke story.
- Tests: **Vitest** (unit/integration) + **Playwright** (e2e/screenshots desktop+mobile).
- Worker: `apps/worker` cron-like loop + queue abstraction (in-proc dev → pg-table durable). _(Built as cron-style direct calls; pg-table `job_queue` is RESERVED/unconsumed.)_

## Canonical product codes (ProductCode enum)

| code | route slug | display | runtime owner |
|------|-----------|---------|---------------|
| `tortila_bot` | `tortila` | Tortila Bot | Tortila journal `:8080` (adapter, read-only) |
| `legacy_bot` | `legacy` | Legacy Bot | Old bot `:8000` (adapter, read-only) |
| `axioma_terminal` | `terminal` | Axioma Terminal | journal_server `:8123` / axi-o.ma (bridge) |
| `tradingview_indicators` | `indicators` | TradingView Indicators | manual/admin access queue |
| `education` | `education` | Education / LMS | internal LMS module |
| `club` | `club` | Private Club | internal access flag |

NOTE: the prompt's "terminal" product == **Axioma**. Route slug stays `terminal`; product code is `axioma_terminal`.

## Canonical plan codes (PlanCode registry — seed)

`tortila_monthly`, `tortila_yearly`, `legacy_monthly`, `axioma_monthly`, `axioma_yearly`,
`indicators_quarterly`, `indicators_yearly`, `education_lifetime`, `club_monthly`,
`bundle_pro` (expands → tortila_bot + axioma_terminal + indicators + education),
`bundle_starter` (→ tortila_bot + education). Manual admin grants use plan `admin_grant`.

## Entitlement state machine (fail-closed)

States: `none → pending_payment → active → grace → expired`, plus `revoked`, `refunded`,
`chargeback`, `manual_review`. **Unknown/any non-`active`(/valid-`grace`) state denies access.**
Manual admin grant/revoke overrides billing state and is always audited. Bundles expand to
member product entitlements. Only `packages/entitlements` may decide access; UI/API never
infer access from role labels or client state.

## RBAC roles

`user`, `teacher`, `admin`, `support`. Checks are server-side only. Teacher object-ownership
enforced (no editing another teacher's course/material). Students cannot enumerate hidden/unentitled content.

## DB schema groups (bounded contexts — table names)

- Identity: `users`, `roles`, `user_roles`, `sessions`, `user_profiles`
- Products: `products`, `plans`, `subscriptions`, `entitlements`, `product_access_events`
- Secrets: `exchange_accounts`, `exchange_api_key_secrets`, `secret_rotation_events`
- Bots: `bot_instances`, `bot_configs`, `bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, `bot_safety_events`
- Axioma: `axioma_account_links`, `terminal_release_cache`, `terminal_download_events`, `terminal_license_events`
- TradingView: `tradingview_profiles`, `tradingview_access_requests`, `tradingview_access_grants`, `tradingview_access_tasks`
- Education: `courses`, `lessons`, `materials`, `enrollments`, `lesson_progress`, `teacher_profiles`
- Ops: `audit_logs`, `notifications`, `support_tickets`, `integration_health_checks`, `job_queue`

## Design tokens (from v2-terminal-os.html — premium terminal-first dark)

```
--bg:#050a12  --bg2:#08101d  --panel:#0b1423  --panel2:#0e1a2b
--stroke:rgba(148,163,184,.16)  --stroke-gold:rgba(213,169,79,.34)
--text:#f1f5f9  --muted:#94a3b8  --dim:#64748b
--gold:#d5a94f  --gold2:#f2d78f  --cyan:#69e2ff
--green:#54d6a1  --red:#ff6b74  --radius:22px
font sans: Inter; serif accent: Georgia italic (headline emphasis)
```
Premium fintech/terminal: dark, restrained gold/cyan, dense operational dashboards, every
action has idle/loading/success/error/disabled states. No childish gamification, no empty hero blobs.

## Hard rules (non-negotiable)

1. Never stop/restart/modify live services; discovery is read-only.
2. Never copy `.env`/secrets; only redacted examples/schemas.
3. No live bot control / ssh / tmux / systemd / process control / `.env` mutation. Bot controls are mock/read-only until a separately audited adapter is approved. "Stop bot" ≠ "close positions".
4. Axioma is a first-class WTC product module (product page, license state, account-link, download, release notes, open-journal, support, future SSO) — NOT a bare link, and NOT a runtime copy. Bridge only.
5. WTC must never become the local order-execution path for Axioma or the bots.
6. Entitlements are the only access source of truth and fail closed.
7. Exchange keys only encrypted-at-rest in the vault; never logged, never in API responses/fixtures/screenshots.
8. TradingView access is manual/admin-queue by default; no credential-stuffing / brittle browser automation as production default.
9. No one-file prototype; use `apps/*` + `packages/*` boundaries; business logic in packages, not React files.
10. No fake integrations — honest adapter interface + mock/dev adapter + documented TODO.

## Doc ownership (Phase 0 — who writes what)

- product-architect: `PRODUCT_BRIEF.md`, `SITEMAP.md`, `MVP_SCOPE.md`, `OPEN_QUESTIONS.md`
- platform-architect: `ARCHITECTURE.md`, `INTEGRATION_MAP.md`, `ARCHITECTURE_DECISIONS.md`(append)
- db-architect: `DOMAIN_MODEL.md`, `DATA_MODEL.md`
- security-auditor: `SECURITY_MODEL.md`, `RBAC_MATRIX.md`, `SECRET_VAULT_DESIGN.md`, `AUDIT_LOG_SCHEMA.md`, `AXIOMA_HANDOFF_TOKEN_SPEC.md`
- billing-access-auditor: `ENTITLEMENT_STATE_MACHINE.md`, `BILLING_PROVIDER_PLAN.md`, `PAYMENT_WEBHOOK_STATE_MACHINE.md`, `CONTRACTS/billing-webhooks.md`
- bot-integration-auditor: `BOT_INTEGRATION_PLAN.md`, `BOT_CONTROL_SAFETY_MODEL.md`, `CANONICAL_ANALYTICS_MODEL.md`, `CONTRACTS/tortila-adapter.md`, `CONTRACTS/legacy-bot-adapter.md`
- axioma-bridge-auditor: `CONTRACTS/axioma-bridge.md` (+ Axioma sections in INTEGRATION_MAP)
- tradingview-access-implementer: `TRADINGVIEW_ACCESS_PLAN.md`, `CONTRACTS/tradingview-access.md`
- education-implementer: `EDUCATION_LMS_PLAN.md`
- backtester-architect: `BACKTESTER_DISTRIBUTION_PLAN.md`, `CONTRACTS/backtester-runner.md`

## Contract doc required fields

owner, consumer, auth method, endpoint/function boundary, request/response schemas,
error envelope, idempotency, rate limits, timeouts, mock-vs-real status, required tests before prod.

## Decisions

- npm workspaces (pnpm absent). Drizzle over Prisma. Next route handlers + server actions (no separate `apps/api` for MVP; documented).
- Rely on documented discovery snapshot; no live SSH this session.

## Risks

- pnpm/turbo not installed; `pnpm install` not possible — use npm. Network install may be unavailable in this environment.
- Axioma rename migration risk (`com.greenfield.terminal`).
- Two-bot data normalization; TradingView ToS; Tortila TP/margin open items.

## Tests / verification

Vitest unit tests for entitlements/crypto/rbac/analytics run without DB/network. Playwright needs a running app.

## Next actions

Agents: read this file, write your owned Phase 0 docs + a handoff `docs/handoffs/<ts>-<agent>.md`.
Orchestrator: scaffold core packages + app shell after Phase 0 docs land.
