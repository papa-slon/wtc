# WTC Ecosystem Platform

Premium, terminal-first web platform and **control plane** for the World Trader Club ecosystem:
a unified account/product hub for the Tortila bot, the Legacy bot, the **Axioma** terminal
(first-class product, integrated by bridge — never a runtime copy), TradingView indicator access,
education/LMS, billing/entitlements, and admin/support.

> Built by a multi-agent engineering team. See [`AGENTS.md`](AGENTS.md) and
> [`docs/handoffs/0000-orchestrator-seed.md`](docs/handoffs/0000-orchestrator-seed.md) for the
> canonical decisions, and [`docs/STATUS.md`](docs/STATUS.md) for current progress.
>
> For a new continuation session after Phase 3.55, start from
> [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`](docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md).

## Architecture at a glance

Modular **monorepo** (npm workspaces). WTC is the control plane; bots and Axioma are product
services reached through **adapters/bridges** — WTC never executes orders and never controls live
bots until a separately audited adapter is approved.

```
apps/
  web/      Next.js 15 App Router — public site + app/admin/teacher dashboards
  worker/   background jobs: entitlement expiry, TradingView queue, metric sync
packages/
  shared/   product/plan codes, entitlement states, zod schemas, error envelope
  config/   typed env loading
  crypto/   AES-256-GCM envelope secret vault (exchange keys, never plaintext)
  db/       Drizzle schema + migrations + seed (Postgres)
  auth/     Argon2id passwords, sessions, server-side RBAC, CSRF
  audit/    append-only audit log helpers
  entitlements/  fail-closed access state machine (the only access source of truth)
  billing/  Stripe / crypto / manual billing adapters (mock dev provider)
  analytics/  canonical metric normalization across both bots
  bot-adapters/   Tortila + Legacy adapters (read-only/mock; control feature-flagged off)
  axioma-bridge/  Axioma license/release/download/journal/account-link bridge
  lms/      education domain services
  tradingview-access/  username requests + admin grant/revoke queue
  backtester/   job/result model + local runner distribution (no fake results)
  ui/       premium terminal-first design system (tokens + primitives + state matrix)
docs/       Phase 0 architecture/security/product docs + CONTRACTS + handoffs
tests/      integration + Playwright e2e/screenshots
```

## How to run locally

> Requires Node ≥ 20.11. This host has Node 24 + npm 11 (pnpm/turbo absent → npm workspaces).

> **The app boots on an in-memory demo backend by default (no DB needed)** — `copy .env.example .env`,
> `npm install`, `npm run dev` is enough to reach http://localhost:3000. The `docker compose` / `db:migrate`
> / `db:seed` lines below are the **OPTIONAL real-Postgres path**, used only when you set `DATABASE_URL`.
> Docker is **not installed on this host**; a native **PostgreSQL 17** also works via `DATABASE_URL` (skip
> the `docker compose` line in that case).

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
copy .env.example .env          # then fill SESSION_SECRET + SECRET_VAULT_KEK
docker compose up -d            # OPTIONAL (real-Postgres path) — local Postgres; Docker not installed here, native PostgreSQL 17 via DATABASE_URL also works
npm install                     # install workspaces
npm run db:migrate              # OPTIONAL (real-Postgres path) — apply schema
npm run db:seed                 # OPTIONAL (real-Postgres path) — demo products/plans/users
npm run dev                     # Next.js app at http://localhost:3000
```

Quality gates:

```powershell
node scripts/gates.mjs full       # compact local full gate runner (governance, core, lint, typecheck x2, secret scan, test, db generate, web build)
npm run check:core              # quick Node type-strip smoke for security core (no install needed)
npm run lint                    # ESLint 9 flat config
npm run typecheck               # tsc --noEmit (packages)
npm run test                    # Vitest (entitlements, crypto, rbac, csrf, env-guards, adapters, axioma)
npm run build -w @wtc/web       # Next production build (also typechecks the app)
npx playwright install chromium # one-time, ~150 MB — REQUIRED before e2e
npm run e2e                     # Playwright smoke + screenshots (desktop + mobile)
npm run evidence:visual -- --inventory tests/e2e/screenshots  # inventory only; not screenshot acceptance
```

## Safety / hard rules

- Discovery is **read-only**; no live service is stopped, restarted, or modified. No secrets copied.
- Exchange API keys are **encrypted at rest** (envelope vault) and never logged or returned.
- **Entitlements fail closed** — access is granted only by `packages/entitlements`.
- **Live bot control is disabled/mock** until a dedicated audited adapter is approved.
  "Stop bot" never means "close positions".
- **TradingView access is a manual admin queue** by default; no credential-stuffing automation.
- **Axioma** is a full WTC-side product module via bridge; WTC is never its order-execution path.

See [`docs/`](docs/) for the full security model, RBAC matrix, secret vault design, entitlement
state machine, payment webhook state machine, Axioma handoff token spec, and integration contracts.
