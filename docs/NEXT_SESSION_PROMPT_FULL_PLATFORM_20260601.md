# Copy-Paste Prompt For New Project Chat

> Historical prompt from 2026-06-01. For current continuation after Phase 3.55, use
> [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md) instead.
> Keep this file as historical server/platform context only; do not treat it as the current restart packet without first
> reading the Phase 3.55 prompt, latest `docs/STATUS.md`, and latest aggregate handoff.

Open this folder first:

`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`

Do not work from `C:\Users\maxib\GTE BOT\bot_tortila` for this WTC platform phase.

You are continuing the WTC Ecosystem Platform. This is a broad platform build, not a narrow one-file task. Use agents first. If agent tooling is unavailable, say so explicitly and stop for operator decision unless the operator tells you to proceed solo.

## Read First

Read these files before planning edits:

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/PROJECT_CHAT_HANDOFF_20260601.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ROADMAP_MASTER.md`
- `docs/EXECUTION_PLAN_MASTER.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/TERMINAL_PRODUCT_AREA.md`

Also verify whether this folder is git-backed:

```powershell
git rev-parse --show-toplevel
```

Expected current truth: it is not git-backed. Do not claim commits/branches/PR/CI unless this changes and you verify it.

## Server Access And Safety Boundary

Server:

```powershell
<ssh-command-from-operator-vault>
```

Raw IP preview:

- `<raw-preview-url>`

Demo accounts:

- `user@wtc.local`
- `teacher@wtc.local`
- `admin@wtc.local`
- password: `<demo-password-from-local-seed-or-operator-note>`

Protected live bot services:

- `turtle-bot.service`
- `turtle-journal.service`
- `journal-server.service`
- `nginx.service`

Do not stop or restart protected live bot services. Do not change the live bot repo/env. Do not enable live bot control. WTC preview must keep:

- `BOT_ADAPTER_MODE=mock` unless explicitly approved otherwise
- `FEATURE_LIVE_BOT_CONTROL=false`
- `FEATURE_TV_AUTOMATION=false`

If you touch the server, first and last check:

```bash
systemctl is-active turtle-bot turtle-journal journal-server nginx || true
docker ps --filter name=wtc-ecosystem-preview --format 'table {{.Names}} {{.Status}} {{.Ports}}'
```

## Mandatory Agent Model

Launch a read-only audit fan-out before any edit. Minimum lanes:

1. platform-runtime/deploy auditor
2. bot-products auditor
3. worker/DB/journal auditor
4. education/LMS auditor
5. billing/entitlements/TradingView auditor
6. terminal/Axioma auditor
7. security/secrets/RBAC auditor
8. frontend/mobile/visual auditor
9. QA/gates/e2e auditor
10. docs/roadmap/truth auditor

Then run implementation agents by disjoint ownership when possible:

- DB/schema/repositories
- worker/runtime
- bot product UI
- LMS UI/service
- billing/TV access
- terminal/Axioma
- admin/ops
- tests/e2e
- docs/handoff

After implementation, run reviewer agents before claiming done:

- security reviewer
- product/UX reviewer
- DB/runtime reviewer
- QA/e2e reviewer
- docs truth reviewer

Each agent must produce a handoff in `docs/handoffs/` or the final report must clearly say why a lane did not run. Close all agents before final response. No open background agents at the end.

## Big Work Package To Execute Now

Do not spend the whole session on one tiny fix. Execute this as one broad package with gates and review.

### Workstream A - Runtime Acceptance And Safe Preview Worker

1. Verify local repo state and server state.
2. Inspect `apps/worker/src/index.ts` and `apps/worker/src/jobs.ts`.
3. Do not use `apps/worker/src/tick-once.ts` as real acceptance; it is demo/in-memory only.
4. Build or fix a real one-shot DB worker command if needed, using the real `dbTick` path or equivalent safe function.
5. In preview only, run one controlled worker snapshot with mock adapter and a configured system bot owner/instance.
6. Verify DB rows for:
   - `integration_health_checks`
   - `bot_metric_snapshots`
   - `bot_position_snapshots`
   - `bot_trade_imports`
7. Verify `/app/bots/tortila/journal` uses DB-first imported rows after the snapshot.
8. If stable, deploy a separate managed preview worker container/process. If not stable, do not enable it; document exact blocker.

Hard rule: no live bot control, no exchange call, no `/api/marks` call.

### Workstream B - Bot Product Completion For Tortila And Legacy

Improve both bot product areas as a coherent user-facing product:

- Tortila setup/settings/statistics/journal/safety/backtester/config-export polish.
- Legacy setup/settings/statistics/safety/config-export with honest blocked-live-adapter state.
- Journal UX: filters, tags, status, review queue, empty states, import status.
- Config UX: per-coin validation, generated `SYMBOL_CONFIGS`, export, version history.
- Account/API key onboarding clarity: sealed key only, no plaintext, no fake live apply.

Add tests and mobile e2e for the visible flows.

### Workstream C - Education/LMS Product Completion

Make the LMS area sellable enough for preview:

- Teacher course CRUD polish.
- Lesson detail and student progress states.
- Material handling with safe links only.
- Upload/object-storage placeholder or real adapter only after security review.
- No raw embed HTML until sanitizer exists.
- Student catalog/course/lesson pages should be coherent on mobile.
- Admin LMS inspection/moderation surface.

### Workstream D - Billing, Entitlements, TradingView Access

Advance commercial access end to end without live charges:

- Stripe test-mode checkout acceptance if test keys are available; otherwise keep fail-closed and document missing envs.
- Signed webhook replay/harness for pending-payment to active state.
- Manual review queue for missing/ambiguous metadata.
- Entitlement timeline visible in user/admin UI.
- TradingView grant/revoke/expiry history and manual external-task flow.
- Keep TV automation disabled unless explicitly approved.

### Workstream E - Terminal/Axioma Product Area

Make the terminal area honest and premium:

- Product page content and app terminal room should explain terminal/journal/download states clearly.
- ES256/JWKS readiness must not expose private key material.
- Download and journal handoff routes stay disabled unless all readiness gates pass.
- WTC must never gate local order execution.

### Workstream F - Admin Ops And Observability

Give the operator useful visibility:

- Admin system health should show DB, worker, WTC app, bot snapshot freshness, billing webhook, TV queue.
- Support/admin/user/product/entitlement pages should be consistent on desktop/mobile.
- Add alerts/notifications for manual review, worker failure, TV revoke due, webhook ambiguity.
- Keep audit logs redacted.

## Required Gates

Run targeted tests for every touched area, then the full gates:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
node scripts/gates.mjs full
npm run e2e
```

If schema changes:

```powershell
npm run db:generate -w @wtc/db
```

If preview deploy is performed:

1. Back up preview DB first.
2. Apply migrations inside `wtc-ecosystem-preview`.
3. Restart only `wtc-ecosystem-preview` and/or the new WTC preview worker service/container.
4. Do not restart live bot services.
5. Run raw-IP browser smoke for:
   - `/`
   - login
   - `/app`
   - `/app/bots/tortila/journal`
   - `/app/bots/tortila/settings`
   - `/app/bots/legacy-bot`
   - `/app/education`
   - `/teacher`
   - `/admin/system-health`
6. Re-check live services are still active.

## Stop Conditions

Stop and report instead of improvising if:

- a protected live bot service is down before your work starts;
- a change requires stopping/restarting `turtle-bot`, `turtle-journal`, or `journal-server`;
- real exchange/order-control behavior would be enabled;
- real Stripe live charges would be possible;
- private keys/secrets would be exposed to browser/logs/audit;
- agents are unavailable and operator has not approved solo mode;
- local full gates cannot be made green;
- preview deploy fails and rollback is required.

## Final Report Required

Return a concise but complete operator report:

- done/not done verdict;
- agents launched, handoff paths, and confirmation all closed;
- what changed by workstream;
- files changed;
- gates run with exact results;
- server touched or not touched;
- if server touched, live services status before/after;
- preview URL and smoke result;
- production blockers still open;
- next broad package, not a small single-file task.
