# Phase 2.4 — Real Bot Read-Only + Access Ops + Production Readiness Spine (aggregate handoff)

_2026-05-30 13:55 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **12-auditor read-only fan-out (agents-before-edits, Rule 1)** → **operator-orchestrated serial implementation
waves** (DB foundation first, then consumers; no parallel edits — not a git repo, no worktrees). **18 per-agent handoff
files** at this epoch, every one cited below. Not a git repo — no commits/branches/PRs/CI proof. No SSH / live exchange /
live bot control / production Stripe charge / TradingView automation / Axioma production call. **Not production-ready.**_

## Scope

Phase 2.4 makes the platform visibly closer to real operation across **five product areas**, on a hardened data spine
(migration 0003). The headline is a **real, schema-backed, read-only Tortila journal adapter** built from the actual
local journal source (`bot_tortila/src/turtle_bot/journal/app.py`) with Zod validation + fixtures — no live HTTP/SSH.

- **B — Tortila real read-only adapter:** Zod schemas + 8 fixtures + `getMetrics/getPositions/getTrades/getEquityCurve` mapping + 35 fixture-only tests; worker read-only `tortila-journal` health collector. Control stays disabled; legacy stays BLOCKED.
- **D — Billing webhook hardening + manual_review:** durable `billing_webhook_events` ledger (UNIQUE provider+event_id, INSERT-on-conflict — replaces the select-then-insert race); `upsertSubscription` wiring; missing/ambiguous data → fail-closed `manual_review` item + admin notify (**never auto-grant**); admin approve/reject/dismiss queue.
- **E — TradingView atomicity:** `atomicGrantTv`/`atomicRevokeTv` — request+grant+profile+audit commit-or-rollback together; revoke reason persisted end-to-end; no orphan/divergent state.
- **F — Admin ops console:** N+1 fix (`listUsersWithCreatedAt`), manual-review queue page, `/admin/bots` (Tortila status, legacy BLOCKED, last snapshot/error, disabled control), system-health additions.
- **A/G — Docs truth + real-DB readiness:** contracts/DATA_MODEL/.env/DEPLOYMENT corrected; real-PG honestly **NOT RUN**.
- **H — terminal/Axioma:** bounded/deferred (no confirmed endpoint shapes; stays disabled dev-placeholders).

## Agents launched (18 per-agent handoffs — all closed; every one cited)

**Wave 1 — read-only audit fan-out (12; agents-before-edits):**
1. `ecosystem-task-router` → [`…-ecosystem-task-router.md`](20260530-1355-ecosystem-task-router.md) — 8-workstream classification, write-ownership, Rule-7 scope (operator-persisted; no Write tool).
2. `ecosystem-devops-docs-auditor` → [`…-ecosystem-devops-docs-auditor.md`](20260530-1355-ecosystem-devops-docs-auditor.md) — doc-drift edit list.
3. `ecosystem-tortila-journal-auditor` → [`…-ecosystem-tortila-journal-auditor.md`](20260530-1355-ecosystem-tortila-journal-auditor.md) — code-exact Zod schemas + 8 fixtures + 20 mapping tests + fees-sign-inversion/mark-price rules.
4. `ecosystem-bot-runtime-auditor` → [`…-ecosystem-bot-runtime-auditor.md`](20260530-1355-ecosystem-bot-runtime-auditor.md) — adapter/runtime/worker wiring + /admin/bots content.
5. `ecosystem-billing-access-auditor` → [`…-ecosystem-billing-access-auditor.md`](20260530-1355-ecosystem-billing-access-auditor.md) — durable ledger + manual_review tables + admin actions + subscription upsert.
6. `ecosystem-tradingview-access-auditor` → [`…-ecosystem-tradingview-access-auditor.md`](20260530-1355-ecosystem-tradingview-access-auditor.md) — atomic grant/revoke design + rollback tests.
7. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-1355-ecosystem-security-auditor.md) — per-mutation pipelines + no-secrets checklist.
8. `ecosystem-admin-ops-ux-auditor` → [`…-ecosystem-admin-ops-ux-auditor.md`](20260530-1355-ecosystem-admin-ops-ux-auditor.md) — admin console layout + states.
9. `ecosystem-axioma-bridge-auditor` → [`…-ecosystem-axioma-bridge-auditor.md`](20260530-1355-ecosystem-axioma-bridge-auditor.md) — terminal readiness (bounded; stays disabled).
10. `ecosystem-qa-gates-auditor` → [`…-ecosystem-qa-gates-auditor.md`](20260530-1355-ecosystem-qa-gates-auditor.md) — pre-edit baseline + full test matrix.
11. `ecosystem-deployment-realpg-auditor` → [`…-ecosystem-deployment-realpg-auditor.md`](20260530-1355-ecosystem-deployment-realpg-auditor.md) — opt-in real-PG flow + DB-name guard.
12. `ecosystem-db-architect` → [`…-ecosystem-db-architect.md`](20260530-1355-ecosystem-db-architect.md) — **served as auditor AND implementer**; this file is the implementation handoff (migration 0003 + repos + db-0003 tests).

**Wave 2 — DB foundation (db-architect, above).** **Wave 3 — consumers/UI/docs/tests (6):**
13. `ecosystem-backend-implementer` (billing) → [`…-ecosystem-backend-implementer-billing.md`](20260530-1355-ecosystem-backend-implementer-billing.md)
14. `ecosystem-backend-implementer` (Tortila + worker) → [`…-ecosystem-backend-implementer-tortila.md`](20260530-1355-ecosystem-backend-implementer-tortila.md)
15. `ecosystem-tradingview-access-implementer` → [`…-ecosystem-tradingview-access-implementer.md`](20260530-1355-ecosystem-tradingview-access-implementer.md)
16. `ecosystem-frontend-implementer` (admin ops) → [`…-ecosystem-frontend-implementer.md`](20260530-1355-ecosystem-frontend-implementer.md)
17. `ecosystem-devops-implementer` → [`…-ecosystem-devops-implementer.md`](20260530-1355-ecosystem-devops-implementer.md)
18. `ecosystem-tests-runner` → [`…-tests-runner.md`](20260530-1355-tests-runner.md)

## Files changed

**Migration 0003 + repos (db-architect):** `packages/db/src/schema.ts` (+`billing_webhook_events`, +`billing_manual_review_items`, +`subscriptions` unique index, +`audit_action_target_idx`), `packages/db/migrations/0003_fresh_blockbuster.sql` (additive; **40 tables**), `packages/db/src/repositories.ts` (`insertWebhookEventOnce`/`updateWebhookEventStatus`, `createManualReviewItem`/`listManualReviewItems`/`resolveManualReviewItem`/`flagProductForReview`, `atomicGrantTv`/`atomicRevokeTv`/`revokeTv(+reason)`, `upsertSubscription` ON CONFLICT, `listUsersWithCreatedAt`), `packages/audit/src/audit.ts` (6 new action codes), `tests/integration/db-0003.test.ts` (14 tests).

**Billing (backend):** `packages/billing/src/{provider.ts,stripe.ts,webhook.ts}` (NormalizedEvent +providerRef/currentPeriodEnd/subscriptionStatus; EVENT_MAP +`invoice.payment_action_required`; dispute handling), `apps/web/src/app/api/billing/webhook/route.ts` (durable idempotency gate, upsertSubscription, missing-userId→manual_review+notify, delete-on-error).

**Tortila adapter + worker (backend):** `packages/bot-adapters/src/tortila/{tortila.schemas.ts,tortila.mapping.ts}` (NEW), `packages/bot-adapters/src/__fixtures__/tortila/*` (8 NEW), `packages/bot-adapters/src/http.ts` (real getMetrics/getPositions/getTrades/getEquityCurve), `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` (35 NEW), `apps/worker/src/{jobs.ts,index.ts}` (read-only `tortila-journal` health collector, env-guarded).

**TV (tv-implementer):** `apps/web/src/features/tv/actions.ts` (atomicGrantTv/atomicRevokeTv wiring).

**Admin ops (frontend):** `apps/web/src/features/admin/{types,queries,schemas,actions}.ts`, `apps/web/src/app/admin/entitlements/page.tsx`, `apps/web/src/app/admin/entitlements/review/page.tsx` (**NEW**), `apps/web/src/app/admin/bots/page.tsx` (placeholder→real), `apps/web/src/app/admin/system-health/page.tsx`, `apps/web/src/lib/{format.ts,nav.ts}`.

**Docs (devops):** `docs/CONTRACTS/{billing-webhooks,tradingview-access,tortila-adapter}.md`, `docs/{BOT_INTEGRATION_PLAN,BOT_CONTROL_SAFETY_MODEL,DATA_MODEL,PAYMENT_WEBHOOK_STATE_MACHINE,INTEGRATION_MAP,DEPLOYMENT}.md`, `.env.example`.

**Tests (tests-runner):** `tests/integration/{billing-webhook-phase24,admin-ops-rbac}.test.ts` (NEW), `tests/e2e/smoke.spec.ts` (28→34).

**Operator fixes (post-wave, to make lint+typecheck green):** removed an unused `fmtDate` import (`admin/system-health/page.tsx`), removed an unused `instanceId` param from `http.ts` `getMetrics` (matching `getConfig`), corrected `'indicators'`→`'tradingview_indicators'` (4 spots) in `admin-ops-rbac.test.ts` (vitest passed at runtime; `tsc` flagged the type). **Operator (truth docs + aggregate):** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

## Routes added/promoted

- `/admin/entitlements/review` (**NEW** — billing manual-review queue). `/admin/bots` promoted placeholder→real. Build = **53 routes**.

## Findings → fixes

- **Webhook concurrent-duplicate race (HIGH)** — select-then-insert on `audit_logs` could double-process. **Fixed:** `billing_webhook_events` UNIQUE(provider,event_id) + `insertWebhookEventOnce` (INSERT…ON CONFLICT DO NOTHING); concurrent-duplicate test proves exactly one wins.
- **Webhook missing-userId silent drop (HIGH)** — acknowledged 200 with no alert. **Fixed:** `createManualReviewItem` (snapshot = `{id,type,planCode}` only — no secrets/PII) + admin notifications + ledger `no_op`; **never auto-grants**.
- **TV grant two-transaction divergence (HIGH)** — `grantTv`+`createTvGrant` could orphan state. **Fixed:** `atomicGrantTv` (single transaction). **Revoke reason discarded (HIGH)** — **Fixed:** `atomicRevokeTv` persists `revokeReason` + nulls the profile pointer in one transaction.
- **Tortila adapter unimplemented (HIGH)** — `getMetrics/getTrades/getPositions/getEquityCurve` threw `AdapterNotReadyError`. **Fixed:** real Zod-validated mappings from the confirmed journal shapes, with the **fees sign-inversion** (`Math.abs(fees_pnl)`), `winRatePct=null` when no trades, mark-price honestly unavailable (`unrealizedPnl=0` + UI note), `filterZeroEquity` defence-in-depth. Tests are **fixtures-only**; `/api/marks` is never consumed (bot owns the exchange).
- **/admin/users N+1 (MEDIUM)** — **Fixed:** `listUsersWithCreatedAt` (2-query).
- **Doc drift (MEDIUM)** — billing idempotency store, Tortila field vocabulary (`processAlive/status`), 38→40 table count, `/api/marks` rule — **Fixed** in the contracts/DATA_MODEL.

## Decisions

1. **DB foundation in its own wave** (migration 0003 + repos), operator-reviewed before consumers; serial single-writer ownership (`packages/db` = db-architect only).
2. **Durable idempotency = `billing_webhook_events`** (supersedes the `audit_logs` ledger AND the never-built `webhook_idempotency_keys`); the INSERT commits before entitlement mutation; on processing error the ledger row is deleted so the retry re-processes.
3. **`resolveManualReviewItem` does NOT nest `grantProduct` in its transaction** (PGlite savepoint fragility) — the grant is a separate call; review-item update + audit are transactional.
4. **Tortila adapter is read-only + fixtures-tested; never live HTTP/SSH in tests; never `/api/marks`.** `BOT_ADAPTER_MODE` default stays `mock`; control (`startBot/stopBot/applyConfig`) stays disabled; **legacy adapter stays BLOCKED** (plaintext keys). The worker collector is env-guarded (`TORTILA_JOURNAL_URL`) and records `not_configured` honestly when absent.
5. **No production-ready claim.** Stripe checkout stays TARGET; Axioma ES256 stays TARGET; real-PG NOT RUN.

## Risks

- All surfaces render their **honest labelled demo state** here (no `DATABASE_URL`); the DB path is PGlite-tested + fails closed in production. **PGlite is NOT a substitute for real-PG acceptance.**
- `sweepTvExpiry` still calls the older `revokeTv` (not `atomicRevokeTv`) — fine (request-only sweep), tracked for Phase 2.5.
- TV admin queue has an N+1 enriching user emails (`listUsersWithEmailByIds` not yet added) and `revokeReason` is persisted but not yet surfaced in the UI — tracked.
- Coverage statements 24.94% (UI/route handlers are e2e-covered, excluded from Vitest); branch 70.77%.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

_Final tree (after the operator dead-code/typecheck fixes). All runnable gates GREEN:_

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — operator re-run after this aggregate: current phase 20260530-1355; **18 cited** per-agent handoffs present; 0 errors (historical warnings allowlisted) |
| 2 | `npm run check:core` | **PASS** (7 smokes) |
| 3 | `npm run lint` | **PASS** (`--max-warnings 0`; 2 operator dead-code fixes) |
| 4 | `npm run typecheck` (packages) | **PASS** (operator fixed `'indicators'`→`'tradingview_indicators'` in a new test) |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm run secret:scan` | **PASS** (clean) |
| 7 | `npm test` (Vitest) | **PASS — 238 passed / 5 skipped (243)** across 27 files (+67 over the 171/5 Phase-2.3 baseline: db-0003 14, tortila-mapping 35, billing-webhook-phase24 6, admin-ops-rbac 12) |
| 8 | `npm run coverage` | **PASS — 24.94% stmts / 70.77% branch** |
| 9 | `npm run db:generate -w @wtc/db` | **PASS — 40 tables; "No schema changes"** (0003 in sync) |
| 10 | `npm run build -w @wtc/web` | **PASS — 53 routes** incl. `/admin/entitlements/review` |
| 11 | `npm run e2e` (Playwright, `CI=1`) | **PASS 34/34** (17 ×2; +TV grant/revoke, bot mock+disabled, review-queue specs) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent. **PGlite is not a substitute for real-PG acceptance.** |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production handoff/download, TradingView automation, plaintext exchange keys.

## Background agents — closed

All 18 per-agent runs across the three workflows (1 audit fan-out + DB foundation + consumer wave) **completed**. **No agents remain running.**

## Production blockers (NOT production-ready)

1. **Real Postgres run** — `db:migrate`/`db:seed`/real-PG NOT RUN (no `DATABASE_URL`/Docker). Provide a throwaway `wtc_test` URL to finish (DB-name guard: `wtc_test`/`wtc_test_*`).
2. **Stripe** — webhook RECEPTION is real (needs `STRIPE_WEBHOOK_SECRET`); checkout creation is TARGET (no live charge path); secrets not provisioned.
3. **Legacy bot adapter BLOCKED** — plaintext-key/service-account unresolved; 5 security gates NOT STARTED.
4. **Axioma ES256 production signer TARGET** — terminal Download/Open-Journal stay disabled dev-placeholders; OTC link flow + raw-OTC→hash migration deferred.
5. **CI INERT** — not a git repo / no remote; `ci.yml` has never executed.
6. Auth rate-limiting middleware still pending.

## Next actions (each its own NEW session)

- **Phase 2.5 — real-PG acceptance + Axioma bridge:** provision a `wtc_test` DB → run `db:migrate`/`db:seed`/real-PG harness (+migration 0003 against real PG, concurrent-duplicate under the real unique index); `sweepTvExpiry`→`atomicRevokeTv`; surface `revokeReason` in the TV UI; `listUsersWithEmailByIds` (kill the TV-admin N+1); Axioma ES256 signer + JWKS consume + download proxy + OTC link (raw-OTC→hash migration).
- **Phase 3 — LMS migration 0003-rich (slug/level/tags/embed/progress-state) + Stripe checkout** (test-mode, `STRIPE_SECRET_KEY` + price map) behind a flag, no live charge.
- **Ops:** auth rate-limiting middleware; CI activation once git + a remote exist.
