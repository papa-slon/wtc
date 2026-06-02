# Phase 2.7 / Phase Groups 2 + 5 — Tortila read-only states + TradingView bounded fixes (aggregate handoff)

_2026-05-30, epoch `20260530-1930`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **4 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run → operator-orchestrated
**serial** implementation (not a git repo, no worktrees, no parallel writers). **4 per-agent handoff files** at this
epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge / TradingView automation /
Axioma production call. **Not production-ready.** Third phase group window executed in the operator's continuous program
(follows Phase 2.6 / PG11, epoch `20260530-1815`)._

## Scope

Execute two bounded phase groups from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md):

- **Phase Group 2 (Tortila read-only states):** surface all four read states end-to-end
  (`not_configured` / `unreachable` / `malformed` / `stale`) from the adapter through the worker to the bot dashboards;
  add a first-class `getWarnings()` surface for the known Tortila risk signals (TP/margin/101211/100410/109421); add
  `JOURNAL_READ_TOKEN` bearer auth + `.env.example` before any read-only-in-prod. `BOT_ADAPTER_MODE=mock` stays the
  default; live bot control stays **BLOCKED**; the legacy adapter stays **BLOCKED**.
- **Phase Group 5 (TradingView bounded fixes):** `sweepTvExpiry` → `atomicRevokeTv` (reason `expired_by_worker`);
  add `listUsersWithEmailByIds` and kill the admin-queue N+1; surface `revokeReason` in the admin TV UI; add a
  `<14-day` expiry banner to `/app/indicators`.

No migration this phase (`db:generate` → "No schema changes"): PG5 reuses the existing `tradingview_access_grants.revoke_reason`
column; PG2 reuses the free-text `integration_health_checks.status` column.

## Agents launched (4 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run, `wf_182aafd5-eb9`; all 4 returned, none left running):
1. `ecosystem-bot-integration-auditor` → [`…-ecosystem-bot-integration-auditor.md`](20260530-1930-ecosystem-bot-integration-auditor.md) — the 4-state model (optional `readState` field, never widen `HealthStatus`), `getWarnings()` design + delegation, `JOURNAL_READ_TOKEN` placement, worker status mapping, dashboard pill tones, the 5-minute stale threshold, env-var normalization.
2. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-1930-ecosystem-security-auditor.md) — `JOURNAL_READ_TOKEN` secret handling (env-only, never logged/in-rawJson/in-audit), the **actor-descriptor** for `atomicRevokeTv` (`audit_logs.actor_user_id` is nullable + no FK ⇒ `null`/`system`, **no sentinel UUID**), `revokeReason` admin-only surfacing, and the standing-invariant confirmation.
3. `ecosystem-tradingview-access-implementer` → [`…-ecosystem-tradingview-access-implementer.md`](20260530-1930-ecosystem-tradingview-access-implementer.md) — applyable PG5 call-site plan: sweep delegation (+ keep the informational task row), `listUsersWithEmailByIds` signature + N+1 rewrite, revokeReason column JSX, the 14-day banner computation, the `db-persistence.test.ts` assertion flip.
4. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-1930-ecosystem-tests-runner.md) — the focused test matrix (4 health states, getWarnings canonical, token header, sweep atomicity, batched email), the isolated-PGlite recommendation, the **no-429/no-burst-e2e** ruling, and the full gate sequence.

## Files changed

**PG2 — adapters (`@wtc/bot-adapters`):**
- `packages/bot-adapters/src/types.ts` — new `ReadState` union + `ADAPTER_STALE_THRESHOLD_MS` (5 min); optional `readState?`/`readStateDetail?` on `BotHealth` (back-compat); `getWarnings(): Promise<RiskWarning[]>` added to `BotAdapter`.
- `packages/bot-adapters/src/http.ts` — `createHttpTortilaAdapter(baseUrl, token?)`; `getJson(url, timeoutMs, token?)` attaches `Authorization: Bearer` (only when a token is set; never logged); `getHealth()` rewritten to the **4-state machine** (never throws): `not_configured` (no token) / `unreachable` (network·non-2xx) / `malformed` (bad shape·unparseable ts) / `stale` (ts > 5 min) / `ok`; `getWarnings()` added; legacy HTTP adapter gets `getWarnings()` + `readState`.
- `packages/bot-adapters/src/mock-tortila.ts`, `mock-legacy.ts` — `getWarnings()` added; `getHealth().warnings` delegates to it; `readState: 'ok'` (synthetic data always available).
- `packages/bot-adapters/src/tortila/tortila.mapping.ts` — `healthToCanonical` forwards `readState: 'ok'`.
- `packages/bot-adapters/src/factory.ts` — `AdapterOptions.tortilaReadToken?` threaded into the Tortila HTTP adapter.
- `packages/bot-adapters/src/index.ts` — export `ReadState` + `ADAPTER_STALE_THRESHOLD_MS`.

**PG2 — worker + config + UI:**
- `apps/worker/src/jobs.ts` — `healthCheckStatusFor(readState, processAlive)` (→ `not_configured`/`down`/`error`/`ok`); `snapshotTortilaJournal` records the precise status + `readState`/`readStateDetail` in `detail` (token-free rawJson preserved).
- `apps/worker/src/index.ts` — the no-system-instance early-exit records `status='not_configured'` (was `'error'`); reads `process.env.JOURNAL_READ_TOKEN` and passes `tortilaReadToken`.
- `packages/config/src/env.ts` — `JOURNAL_READ_TOKEN` optional + `superRefine` (required when `NODE_ENV=production` AND `BOT_ADAPTER_MODE != mock`).
- `apps/web/src/lib/server-config.ts` — `botAdapterOptions()` adds `tortilaReadToken`; normalizes to canonical `TORTILA_JOURNAL_URL` (fallback `TORTILA_JOURNAL_BASE_URL`).
- `apps/web/src/features/bots/meta.ts` — `botHealthPill(health)` helper (type-only imports): honest tone+label per state; `not_configured` = "Setup needed" (neutral, not an alarm).
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, `…/safety/page.tsx` — use `botHealthPill`; the safety page now calls `adapter.getWarnings()` first-class; both surface `readStateDetail` honestly.
- `.env.example` — `JOURNAL_READ_TOKEN=` placeholder with comment.

**PG5 — DB + UI:**
- `packages/db/src/repositories.ts` — `inArray` import; `atomicRevokeTv` actor descriptor `{ id: string|null; role: 'admin'|'system' }` (request+grant `revoked_by` + audit actor); `sweepTvExpiry` delegates to `atomicRevokeTv({id:null,role:'system'}, 'expired_by_worker')` per expired row (+ keeps the informational task); `TV_EXPIRED_BY_WORKER_REASON` const; `listUsersWithEmailByIds(db, ids)` (single `inArray`, empty-ids short-circuit, email-only).
- `apps/web/src/features/tv/actions.ts` — `enhancedRevokeAction` passes `{ id: actor.id, role: 'admin' }`.
- `apps/web/src/features/tv/queries.ts` — `loadTvAdminData` uses the batched `listUsersWithEmailByIds` (N+1 removed).
- `apps/web/src/app/admin/tradingview-access/page.tsx` — admin-only "Revoke reason" column.
- `apps/web/src/app/(app)/app/indicators/page.tsx` — `<14-day` expiry banner (computed from active grants/granted requests; only future expiries).

**Tests:**
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts` (new, 9) — the 4 states + never-throws + token-header presence/absence + no-token-leak.
- `packages/bot-adapters/src/adapters.test.ts` (+2) — `getWarnings()` canonical-code invariant + health/warnings delegation.
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` (+1, W-07) — machine-verified healthy-status guard; W-06 given a token.
- `tests/integration/db-pg5.test.ts` (new, 5) — sweep full-revoke (system actor, reason, profile null, audit) + `listUsersWithEmailByIds` (batch/empty/dedupe).
- `tests/integration/worker-health-mapping.test.ts` (new, 6) — `healthCheckStatusFor` mapping (`not_configured` ≠ outage).
- `tests/integration/db-persistence.test.ts` (assertion flip `expired`→`revoked`), `tests/integration/db-0003.test.ts` (2 `atomicRevokeTv` callers → actor descriptor).

## Findings → fixes

- **PG2 readState (bot-integration F-01/F-05).** `getHealth()` collapsed every failure to `degraded`. Added an optional
  `readState` (chosen over widening `HealthStatus` — back-compat) returned, never thrown. Dashboards render an honest
  pill: `not_configured`="Setup needed" (neutral), `unreachable`/`malformed`=bad, `stale`=warn, `ok`+P0/P1="Running
  (warnings)". The worker maps `not_configured` to its own status string so a missing config never reads as an outage.
- **PG2 getWarnings (bot-integration F-04).** Added `getWarnings()` to the interface; `getHealth().warnings` delegates
  to it (no drift); the safety dashboard calls it first-class. Mock returns the full known set (persistent P0/P1 +
  101211/100410/exchange-flat/109421); the real adapter returns the persistent P0/P1 (signals are not fabricated). The
  canonical-code test invariant now also runs against `getWarnings()`.
- **PG2 token (security F-01, bot-integration F-02).** `JOURNAL_READ_TOKEN` → `Authorization: Bearer`, attached only when
  set, **never** logged / in `rawJson` / in audit / in error strings (errors carry only URL + status). Optional overall;
  required in a real mode in production (`env.ts superRefine`). `.env.example` placeholder is empty (secret:scan clean).
  Absent token in a real mode ⇒ `getHealth()` returns `not_configured` (never runs unauthenticated). The PG11
  `isSecretValue()` value-guard would redact a Bearer token if one ever reached an audit payload (defence-in-depth).
- **PG5 worker actor (security F-02).** `atomicRevokeTv` changed from `adminId: string` to an actor descriptor; the
  worker sweep revokes as `{ id: null, role: 'system' }`. `audit_logs.actor_user_id` is nullable with **no FK** to
  `users`, so `null` is the correct, honest value — **no fabricated sentinel UUID** (the tv-access auditor's sentinel
  proposal was overridden by the security/RBAC owner). Admin revoke remains `{ id: actor.id, role: 'admin' }`.
- **PG5 sweep (security F-03, tv-access F-01).** `sweepTvExpiry` now delegates to `atomicRevokeTv` so the grant row
  (`revoked_at`/`revoke_reason='expired_by_worker'`) and the profile pointer are stamped and a `tv_access.revoke` audit
  row is written — not just `status='expired'`. Terminal status is `revoked`. The informational
  `tradingview_access_tasks` row is still queued (WTC marks revoked; TV-side removal stays manual-first). `atomicRevokeTv`
  opens its own transaction per row (no nested transaction).
- **PG5 N+1 (tv-access F-02, tests F-02).** `listUsersWithEmailByIds(db, ids)` — one `WHERE id IN (...)` query, empty-ids
  short-circuit, email-only — replaces the per-row `getUserById` in `loadTvAdminData`.
- **PG5 revokeReason + banner (security F-04, tv-access F-03/F-04).** `revokeReason` shown only in the admin grant-history
  table (never on `/app/indicators`); React text-escaped. The 14-day `/app/indicators` banner is a UI horizon distinct
  from the server-side 7-day `expiring_soon` status (which no code path writes — F-06, tracked follow-up).

## Decisions

1. **`readState` is an optional field, not a widened `HealthStatus`** — existing status consumers are untouched; callers
   prefer `readState` for the pill. `getHealth()` keeps its never-throw contract (states are returned).
2. **Adapter-level stale = 5 min** from the journal `/api/health` `ts`; an unparseable `ts` is `malformed`, not `stale`.
   Distinct from any coarser UI-level staleness on `integration_health_checks.checked_at`.
3. **System actor = `{ id: null, role: 'system' }`** (no sentinel UUID). Security/RBAC owner's call; consistent with the
   `reconcileEntitlements` worker precedent (`actorUserId: null, actorRole: 'system'`).
4. **Keep the informational `tradingview_access_tasks` row** on auto-expiry — WTC marking a grant revoked does not remove
   the user from the TradingView indicator; that stays a manual/queued action (manual-first invariant).
5. **No migration this phase** — both items reuse existing columns; `db:generate` = "No schema changes".
6. **Continuous program, governed per group.** Own epoch + aggregate; the newest aggregate is the strictly validated one.

## Risks

- **`JOURNAL_READ_TOKEN` not yet configured on the live journal** — `BOT_ADAPTER_MODE=read-only` in production stays
  effectively blocked (the `env.ts` guard requires the token; without it the adapter reports `not_configured`). Honest
  by design; clearing it needs both sides provisioned (operator + journal maintainer).
- **`atomicRevokeTv` signature change** is breaking for its callers — all updated atomically (`enhancedRevokeAction` +
  two `db-0003` test callers). No other callers exist (grep-confirmed).
- **Auto-expiry terminal status moved `expired` → `revoked`** — semantically correct, but any future query filtering on
  `status='expired'` for worker-expired grants must use `revoked` + `revoke_reason='expired_by_worker'`. The grant row
  now also carries `revoked_at`.
- **`expiring_soon` is still never written** by any code path (the 7-day server status) — pre-existing; tracked as a PG5
  follow-up (a `markExpiringSoon` pre-pass). The 14-day UI banner does not depend on it.
- The worker (`apps/worker`) is strip-run and **not** in the gate typecheck set (pre-existing); the one new pure helper
  (`healthCheckStatusFor`) is unit-tested directly to compensate.
- All surfaces still render the honest labelled demo state here (no `DATABASE_URL`); **PGlite is not a substitute for
  real-PG acceptance (B1)** — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** |
| 5 | `npm run secret:scan` | **PASS** (clean; `.env.example` `JOURNAL_READ_TOKEN=` is an empty placeholder) |
| 6 | `npm test` (Vitest) | **PASS — 317 passed / 7 skipped (324)** across 33 files (+23: getHealth-states 9, worker-health-mapping 6, db-pg5 5, adapters +2, tortila-mapping +1) |
| 7 | `npm run coverage` | **PASS — 25.61% stmts / 72.72% branch** (branch ↑ from 71.61) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 40 tables; "No schema changes"** (no migration this phase) |
| 9 | `npm run build -w @wtc/web` | **PASS — 44 app routes; `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright, `CI=1`) | **PASS — 36/36** (34 passed clean + **2 dev-only Server-Action recompilation-race flakes auto-retried green** — `retries: 2`; exit 0; mock-mode dashboards/indicators render unchanged — readState/expiry banners only appear in non-mock/expiring states) |
| 11 | `npm run governance:check` | **PASS** (this aggregate; 4 cited per-agent handoffs present) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production
handoff, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved; legacy adapter BLOCKED.

## Background agents — closed

All 4 per-agent runs in the audit fan-out (Workflow `wf_182aafd5-eb9`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG3 Legacy hard gate:** honest "live adapter unavailable" UI, `LegacyBlockedAdapter` compile-time gate + regression
  test, Zod plaintext-key body exclusion (real adapter stays BLOCKED on the upstream key fix).
- **PG4 Billing:** test-mode checkout behind `STRIPE_SECRET_KEY` + price-map flag (no live charge), billing feature dir,
  honest pricing CTA — gated on the provider decision (Q-2).
- **PG5 follow-up:** `markExpiringSoon` pre-pass so the 7-day `expiring_soon` status is actually written (F-06).
- **Carried:** F-03 structured logger (PG12); CSP per-request nonce (PG3); move static headers to `next.config.ts`.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma
  endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); live journal
  `JOURNAL_READ_TOKEN` provisioning before `read-only` in prod.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
