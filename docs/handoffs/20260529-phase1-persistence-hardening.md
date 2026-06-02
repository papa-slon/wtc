# Phase 1 — Persistence + Contract Truth + Acceptance Hardening (handoff)

_2026-05-29. Driven by a single-session read-only audit pass covering 6 areas (security,
db/persistence, frontend-truth, docs/contracts, QA/CI/e2e, integration-risk → 66 findings). No live
servers/SSH/bots touched; real adapters stay mock; no real secrets stored; not claimed
production-ready._

> Honesty note (added 2026-05-29, Phase 1.5): per-agent handoff files were **not** retained for the
> 6 areas above. Per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §2–§3, read "6-agent audit"
> as **6 review areas in one session**, not 6 archived agent handoffs. (Phase 1.5's own audit, by
> contrast, has one handoff per agent: `docs/handoffs/20260529-1921-*.md`.)

## Environment reality
No Docker / psql / local Postgres on this host. DB work is therefore verified with **PGlite**
(`@electric-sql/pglite`, in-process WASM Postgres) which runs the **real** generated SQL migration +
repositories + seed. The `db:migrate`/`db:seed` scripts target real Postgres via `DATABASE_URL` and
were **not** run against a Docker Postgres here (cannot, honestly).

## Hardening (done + tested)
- **CSRF on logout**: `logoutAction(formData)` now `assertCsrf`s; `<CsrfField/>` added to both logout
  forms. Static test `tests/integration/csrf-coverage.test.ts` proves **every** `'use server'` action
  except pre-session login/register calls `assertCsrf`.
- **Mock billing impossible in production**: `packages/config/src/env.ts` rejects `BILLING_PROVIDER=mock`
  when `NODE_ENV=production` (zod superRefine); `createMockBillingProvider`/`createBillingProvider`
  throw in production. Tests: `packages/config/src/env.test.ts`, `packages/billing/src/provider.test.ts`.
- **Secret-quality guards**: `requiredSecret()` now rejects placeholder/dev strings (`replace-with…`,
  `dev-only…`, etc.) in production (`packages/shared/src/env-guards.ts` + tests). Secret scan wired:
  `.secretlintrc.json` + `.secretlintignore` + `npm run secret:scan` (passes clean).
- **e2e reliability**: dedicated port **3100** (`dev:e2e`), `reuseExistingServer: !process.env.CI` —
  no stale-server false-greens.
- **Stale docs**: `20260529-tests-runner.md` banner-superseded (was 16/16, 23 routes, 8/8).

## Persistence (done + PGlite-verified)
- **Repositories** `packages/db/src/repositories.ts`: users, sessions, entitlements, audit (DB writer),
  exchange-key sealed secrets, TradingView (async) + worker jobs (`reconcileAllEntitlements`,
  `sweepTvExpiry`, `recordHealthCheck`). Reuses `@wtc/entitlements` + `@wtc/audit` rules.
- **Schema/migration**: added `tradingview_access_tasks`; `npm run db:generate` → `migrations/0000_*.sql` (21 tables).
- **Production backend selector** `apps/web/src/lib/backend.ts` (+ `db-store.ts`): uses Postgres when
  `DATABASE_URL` is set, in-memory demo otherwise, **fail-closed in production (lazy)** — production
  never silently uses the in-memory store, and the guard does not break `next build`.
- All `@/lib/demo` imports repointed to `@/lib/backend` (14 sites). Admin audit-log/overview use the
  DB-or-memory `recentAuditEvents()`.
- **Worker** `apps/worker/src/index.ts`: DB jobs when `DATABASE_URL` set; in-memory loop otherwise.
- **Integration test** `tests/integration/db-persistence.test.ts` (PGlite): seed-from-empty, user/session
  round-trip, duplicate-email reject, grant/revoke (audited), sealed keys never returned, redacted audit,
  TV submit→grant→sweep→expired. **7/7 pass.**

## Docs / UX truth
- `docs/IMPLEMENTED_FILES.md` (verified by `rg`): `api/**` is **target, not current**; `BOT_ADAPTER_MODE`
  is `mock|read-only|audited` (no `=real`); contracts→implementing-files table; persistence reality.
- UX: persistent **backend badge** ("demo data (in-memory)" / "postgres") in the app top bar;
  landing hero metrics labelled **"sample UI / illustrative — not live data"**; `href="#"` CTAs
  (backtester runner download, education community links) now **disabled with a reason**; placeholder
  routes marked **"soon"** in nav.

## Verified gates (observed, after a fresh `npm ci`)
| Gate | Result |
|---|---|
| `npm ci` | PASS (368 pkgs, 41s; lockfile reproducible) |
| `npm run check:core` | PASS (7 zero-install smokes) |
| `npm run lint` | PASS (exit 0) |
| `npm run typecheck` (packages) + `-w @wtc/web` | PASS both |
| `npm test` (Vitest) | **55/55** (11 files; incl. PGlite DB integration 7, CSRF-coverage, billing/config prod-guard, env-guard placeholders) |
| `npm run build -w @wtc/web` | PASS (38 routes, 31 static) |
| `npx playwright install chromium && npm run e2e` | **10/10** (desktop + mobile) |
| `npm run secret:scan` | PASS (clean) |
| `npm run db:generate -w @wtc/db` | PASS (migration generated) |
| `npm run coverage` | baseline **23.75% stmts / 58.94% branch** (security-core well-covered; UI/mock surfaces drag the average; the 80% target in BOT_CONTROL_SAFETY_MODEL is aspirational, not enforced) |
| `db:migrate` / `db:seed` against Docker Postgres | **NOT RUN** — no Docker/Postgres here; equivalents verified via PGlite |

## Remaining mock/dev surfaces
- Web app **default runtime here = in-memory demo** (no Postgres available to run the DB path live);
  DB path is PGlite-integration-tested + fail-closed-wired for production.
- **TradingView + LMS web UI** still in-memory (services sync-coupled; DB TV repos exist + tested + used by worker).
- Bot adapters mock (real HTTP = `AdapterNotReadyError`; control throws). Axioma bridge mock; handoff HS256 **dev stub**.
- Billing mock provider (dev-only); no live webhook route.

## Still NOT deployable until
DB path run against a real Postgres (`db:migrate`/`db:seed` + integration in CI Postgres); real prod
secrets (KEK/SESSION/Axioma — app fails closed without them); Axioma handoff ES256/JWKS + confirmed
journal_server endpoint shapes before any real read-only call; bot adapter real mappings + legacy
plaintext-key fix upstream; real billing provider + webhook route; raise coverage; add CI workflow.

## Next phase (1.5)
Refactor TvAccessService/LmsService to async repo interfaces → DB-back the TV + LMS web UI; add a real
Postgres CI job (replace PGlite in CI or keep both); implement the billing webhook route + Stripe adapter;
Axioma ES256 handoff + read-only release/license metadata once endpoints are confirmed.
