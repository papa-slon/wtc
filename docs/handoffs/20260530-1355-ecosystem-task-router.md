# ecosystem-task-router handoff

_Epoch 20260530-1355. Phase 2.4 — Real Bot Read-Only + Access Ops + Production Readiness Spine. Read-only routing audit; no code edited. The ecosystem-task-router agent has no Write tool — the operator persisted this file capturing the agent's returned classification + findings._

## Scope

Classify Phase 2.4 across Workstreams A–H. Produce: (1) write-ownership map (one implementer per file/dir; migration 0003 forces db-architect first); (2) Rule-7 minimum coherent landable scope across ≥5 product areas; (3) per-workstream risk gates; (4) serial implementation order; (5) confirmation the 12-auditor read-only wave precedes all edits (Rule 1).

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md` + the Phase-2.3 task-router/billing/bot-integration handoffs
- `packages/bot-adapters/src/{types.ts,http.ts,mock-tortila.ts,factory.ts}`, `packages/analytics/src/{metrics.ts,index.ts}`
- `apps/web/src/features/tv/{queries.ts,actions.ts}`, `apps/web/src/app/api/billing/webhook/route.ts`, `packages/db/src/repositories.ts` (selected ranges)
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py` (all JSON API endpoints), `…/journal/metrics.py`

## Files changed

None — read-only audit

## Findings

1. **[HIGH] Tortila Zod schema files do not exist (WS-B).** `docs/CONTRACTS/tortila-adapter.md` references `packages/bot-adapters/src/tortila/tortila.schemas.ts`; no such file. `http.ts:60` cast-only health shape. → Create the schemas (from the confirmed `app.py` shapes), then implement `getMetrics/getTrades/getPositions/getEquityCurve`; capture fixture JSON. Owner: backend-implementer (Tortila).
2. **[HIGH] TV grant is two transactions (WS-E).** `features/tv/actions.ts:100-113` — `grantTv` then `createTvGrant` separately; failure between them diverges request vs grant state. → `atomicGrantTv` single-transaction repo (db-architect); action calls it. 
3. **[HIGH] `revokeTv` discards reason; `revokeTvGrant` never called (WS-E).** `actions.ts:143` `void _reason`. → `revokeTv(+reason?)` + `atomicRevokeTv` (resolves grant by requestId). db-architect + tv-implementer.
4. **[HIGH] Webhook missing-userId acknowledged 200 with no alert (WS-D).** `route.ts:89-91`. → audit row `billing.webhook_missing_user` + `createManualReviewItem` + admin notification before 200; never auto-grant. backend + db-architect.
5. **[HIGH] EVENT_MAP missing `invoice.payment_action_required` + `charge.dispute.closed` (WS-D).** `packages/billing/src/webhook.ts`. → add mapping; handle dispute.closed (won→canceled, lost→refunded). backend.
6. **[MEDIUM] `/admin/users` N+1 on createdAt (WS-F).** `features/admin/queries.ts:59-66`. → `listUsersWithCreatedAt` single/2-query repo. db-architect + admin.
7. **[MEDIUM] No flag/approve/reject review actions (WS-D/F).** → `adminFlagReviewAction`/`adminApproveReviewAction`/`adminRejectOrDismissReviewAction` (assertAdmin+CSRF+Zod+reason+audit). admin.
8. **[MEDIUM] Bot adapter contract doc field drift (WS-A).** `tortila-adapter.md`/`BOT_INTEGRATION_PLAN.md`/`BOT_CONTROL_SAFETY_MODEL.md` use `processState/journalReachable` vs live `processAlive/status`. → doc-only fix. devops.
9. **[MEDIUM] Real-adapter call timeouts vs contract (WS-B).** `http.ts:20` 4000ms default vs contract 5s/15s/20s. → per-call `timeoutMs` or update contract in sync.

## Decisions

### D-01 — Write-ownership map (serial; single-writer for shared files)

| File / dir | Owner | Workstream |
|---|---|---|
| `packages/db/src/{schema.ts,repositories.ts,index.ts}` + migration 0003 + `tests/integration/db-0003.test.ts` | **db-architect (sole writer; goes FIRST)** | D/E/F |
| `packages/billing/src/{provider.ts,stripe.ts,webhook.ts}` + `apps/web/src/app/api/billing/webhook/route.ts` | backend-implementer (billing) | D |
| `packages/bot-adapters/src/tortila/*`, `__fixtures__/tortila/*`, `http.ts`, tortila tests + `apps/worker/src/*` (read-only health) | backend-implementer (Tortila/worker) | B/C |
| `apps/web/src/features/tv/{queries.ts,actions.ts}` + TV pages | tradingview-access-implementer | E |
| `apps/web/src/features/admin/*` + `apps/web/src/app/admin/**` (users, system-health, bots, entitlements + review queue) | frontend-implementer | F/C-UI |
| `docs/*` (STATUS/NEXT/IMPLEMENTED + contracts + tortila-adapter drift), `.env.example`, `docs/DEPLOYMENT.md` | devops-implementer (operator finalises STATUS/NEXT/IMPLEMENTED + aggregate) | A/G |
| `tests/integration/**`, `tests/e2e/**` | tests-runner | H |

### D-02 — Rule-7 minimum coherent landable scope (≥5 areas)

Land + gate-verify: **(1)** Tortila real read-only adapter (schemas/fixtures/mapping/tests; control stays disabled; `BOT_ADAPTER_MODE` default stays mock); **(2)** billing durable `billing_webhook_events` ledger + `manual_review` queue + admin resolve actions + subscription upsert; **(3)** TV atomic grant/revoke + reason; **(4)** admin ops (N+1 fix + manual-review queue UI + `/admin/bots`); **(5)** real-DB readiness + docs truth (real-PG NOT RUN honest). Workstream C-worker (Tortila health snapshot) is best-effort; Workstream H terminal is OPTIONAL/bounded.

### D-03 — Implementation order (strict serial)

1. **db-architect** — migration 0003 (2 tables + subscription unique index) + all repos + db-0003 tests. (Foundation; operator reviews before consumers.)
2. **backend (billing)** — `NormalizedEvent`/`parseWebhook` extension + webhook route (durable idempotency, upsertSubscription, missing-userId→manual_review, delete-on-error) + EVENT_MAP.
3. **backend (Tortila)** — adapter schemas/fixtures/mapping/http wiring/tests + worker read-only health.
4. **tv-implementer** — `atomicGrantTv`/`atomicRevokeTv` wiring in `features/tv/actions.ts`.
5. **frontend (admin)** — N+1 fix wiring, manual-review queue page + actions, `/admin/bots`, system-health.
6. **devops** — docs/nav/contract truth + `.env.example` + DEPLOYMENT real-PG instructions.
7. **tests-runner** — full Phase-2.4 test matrix + e2e + all gates.

## Risks

- **Real Postgres absent** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`/Docker) → `db:migrate`/`db:seed`/real-PG acceptance = NOT RUN; PGlite is not a substitute.
- **Stripe not configured** (no `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY`) → no live Stripe test; checkout creation stays TARGET.
- **Legacy bot adapter BLOCKED** (plaintext-key/service-account unresolved) — must stay blocked.
- **Axioma ES256 production signer absent** — terminal Download/Open-Journal stay disabled dev-placeholders; OTC link flow + raw-OTC→hash migration out of scope.
- Migration 0003 must be applied before the webhook route's `insertWebhookEventOnce` gate is deployed (else table-not-found).

## Verification/tests

- Before any edit: all 12 read-only auditors closed with per-agent handoffs at epoch 20260530-1355. ✓
- Foundation gate (after db-architect): `db:generate` (expect new 0003 + 40 tables), `typecheck`, `npm test` (db-0003 green).
- Final gate sequence: governance:check → check:core → lint → typecheck → typecheck -w @wtc/web → secret:scan → test → coverage → db:generate → build → e2e. NOT RUN: db:migrate/db:seed/real-PG (no DATABASE_URL/Docker).

## Next actions

1. Run the serial implementation waves per D-03; each agent writes a handoff at `docs/handoffs/20260530-1355-<slug>.md`.
2. Operator writes the aggregate `20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` citing every per-agent handoff + the gates table.
3. Hard rules in force: live bot control disabled; legacy adapter blocked; Tortila adapter fixtures-only (never `/api/marks`, never live HTTP/SSH in tests); webhook signature-verified + idempotent + no auto-grant on ambiguous data; manual-first TV; no plaintext secrets; no production-ready claim.
