# Project Chat Handoff - WTC Ecosystem Platform

> Historical handoff from 2026-06-01. For current continuation after Phase 3.55, start from
> [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md), latest
> `docs/STATUS.md`, and latest aggregate handoff. This file remains useful for server/platform context, but it is not the
> current restart packet.

Date: 2026-06-01
Project folder to open: `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`
Do not start future WTC platform sessions from `C:\Users\maxib\GTE BOT\bot_tortila`.

## Direct Verdict

The WTC ecosystem platform is substantially built, inspectable on the raw IP preview, and backed by the preview Postgres DB. It is not production-ready yet.

The next work must continue inside the WTC project folder, with agents first, broad workstreams in parallel where possible, and a reviewer/gate pass before any server preview change.

## Stop State From Current Session

Work was stopped at the operator request.

Server state verified after stopping:

- `turtle-bot.service`: active
- `turtle-journal.service`: active
- `journal-server.service`: active
- `nginx.service`: active
- `wtc-ecosystem-preview` Docker container: up
- Temporary preview DB Node probe started by Codex was killed; no `wtc_get_user_id.mjs` process remains.

No live bot, exchange, live strategy, or live order-control service was stopped or changed.

## Server Access

SSH:

```powershell
<ssh-command-from-operator-vault>
```

Raw IP preview:

- `<raw-preview-url>`

Demo accounts:

- `user@wtc.local`
- `teacher@wtc.local`
- `admin@wtc.local`
- Password: `<demo-password-from-local-seed-or-operator-note>`

Live bot services on the same server. Treat as protected:

- `turtle-bot.service`
- `turtle-journal.service`
- `journal-server.service`
- `nginx.service`

Preview WTC container:

- `wtc-ecosystem-preview`
- Next app runs inside container on `127.0.0.1:8300`, proxied by nginx/raw IP.
- Safe preview flags observed:
  - `DATABASE_URL` set
  - `BOT_ADAPTER_MODE=mock`
  - `FEATURE_LIVE_BOT_CONTROL=false`
  - `FEATURE_TV_AUTOMATION=false`

## Current WTC State

Recently implemented and verified:

- Raw-IP WTC preview deployed to the server.
- Preview Postgres DB exists and has migrations applied through `0007`.
- Bot trade journal overlay exists:
  - immutable facts: `bot_trade_imports`
  - editable reviews: `bot_trade_reviews`
  - page: `/app/bots/[bot]/journal`
- Safe bot config export exists:
  - route: `/api/bots/[bot]/config-export`
  - Tortila export includes `SYMBOL_CONFIGS`
  - no exchange keys or API secrets in exports
- Tortila statistics panels exist.
- Tortila per-symbol setup/settings exist.
- Local backtester runner download exists for Tortila.
- Teacher/student education rooms exist, with rich LMS first slices.
- Stripe test-mode checkout path exists, but real Stripe acceptance is not complete.
- TradingView access/admin manual queue exists; automation remains disabled.
- Axioma/terminal surface exists with fail-closed JWKS/download/handoff skeletons; production bridge is not active.
- Admin rooms exist for users, support, entitlements, products, system health, terminal metadata.

Latest verified local gates from the current continuation:

- `node scripts/gates.mjs full`: PASS
- `npm run e2e`: PASS, `44 passed / 6 skipped`
- raw-IP browser smoke: PASS for login, Tortila journal, settings, config export

## Current Important Caveats

- This workspace is not git-backed. Do not claim commits, branches, PRs, or CI unless git is initialized later and verified.
- The preview worker is not yet deployed as a managed service/container.
- `apps/worker/src/tick-once.ts` is only an in-memory demonstration and must not be used as proof that the real DB worker is running.
- The real worker entrypoint is `apps/worker/src/index.ts`.
- Tortila journal snapshot requires `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID`; otherwise it records or logs not-configured/skipped.
- Live bot control must remain disabled. WTC must not call exchange/order-control paths.
- Legacy real adapter remains blocked until the plaintext-key/service-account issue is fixed upstream.
- Stripe live/test webhook replay, Axioma production signing/linking, real object uploads, and full production hardening remain open.

## Protected Boundaries

Do not do these without explicit operator approval:

- Do not stop/restart `turtle-bot.service`, `turtle-journal.service`, or `journal-server.service`.
- Do not change `.env` or code in `C:\Users\maxib\GTE BOT\bot_tortila` from the WTC platform session.
- Do not enable live bot control.
- Do not set `BOT_ADAPTER_MODE=audited` or `read-only` against real bot endpoints until reviewed and approved.
- Do not use real Stripe live keys or charge live cards.
- Do not enable TradingView automation.
- Do not claim production readiness while blockers remain.

## Broad Roadmap From Here

This should be executed as large packages, not tiny slices.

### Package 1 - Runtime Acceptance + Preview Worker

Goal: make the preview environment honest and continuously populated without touching live bots.

Work:

- Re-check server services and preview container read-only.
- Verify preview DB migrations and seed state.
- Fix or add a real one-shot DB worker command if needed; do not rely on demo `tick-once`.
- Run a controlled worker tick using mock adapter and a system bot owner/instance.
- Verify rows in `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, and `integration_health_checks`.
- If stable, deploy a separate managed preview worker process/container with safe flags only.
- Add server smoke checks that prove worker data shows up in `/app/bots/tortila/journal` and admin health.

Acceptance:

- Live bot services remain active.
- WTC preview remains up.
- Worker is either deliberately not enabled with a documented reason, or enabled as a separate safe preview service.
- No live control paths are enabled.

### Package 2 - Bot Product Completion For Both Bots

Goal: WTC bot product rooms feel like usable products, not placeholders.

Work:

- Tortila: setup/settings/statistics/journal/safety/backtester/config export polish.
- Legacy bot: setup/settings/statistics/safety honest blocked state, config export, product-specific copy, no fake live data.
- Account/API-key onboarding: sealed-key UI clarity, mode labels, safety warnings, no plaintext leak.
- Manual vs automatic mode: explicit WTC-side intent; no live apply unless future gates clear.
- Journal UX: filter/search/status/tags, review queue, review detail, import status, empty states.
- Config UX: generated `SYMBOL_CONFIGS`, per-coin validation, download/export, version history.

Acceptance:

- Mobile and desktop e2e covers bot overview, Tortila journal, Tortila settings, Legacy blocked state, export route.
- No fake exchange/order data.
- No secrets in UI, logs, exports, or tests.

### Package 3 - Education/LMS Completion

Goal: teacher/student/admin education areas become coherent enough to sell.

Work:

- Teacher course CRUD polish: course slugs, lesson reorder/delete, lesson state, material management.
- Student catalog: course detail, lesson detail, progress, completion, pinned/community links.
- Admin LMS: moderation/visibility states, user/course overview.
- Upload/object-storage design and safe placeholder if storage is not ready.
- Embed sanitizer before any raw HTML/embed lesson is allowed.
- Telegram/Instagram/community links must be data-backed and entitlement-aware.

Acceptance:

- Teacher can create/edit course and lessons.
- Student sees entitled catalog and progress states.
- Admin can inspect education state.
- Unsafe links/embeds are rejected or safely disabled.

### Package 4 - Billing, Entitlements, TradingView Access

Goal: commercial access flow is auditable end to end.

Work:

- Stripe test-mode checkout acceptance with test keys only.
- Signed webhook replay with Stripe CLI or equivalent test harness.
- Manual review queue for webhook ambiguity.
- Entitlement timeline and product-access events in user/admin UI.
- TradingView manual grant/revoke queue with expiration, revoke reason, actor, history.
- Optional automation remains disabled until separately approved.

Acceptance:

- No live charges.
- Signed webhook path proves pending-payment to active/revoked states.
- Unknown/missing metadata fails closed into manual review.
- TV access state is visible and auditable.

### Package 5 - Axioma / Terminal Product Area

Goal: terminal product page and account bridge are honest, premium, and fail-closed.

Work:

- Terminal landing/product details inside WTC, not just a redirect.
- Admin release metadata and public release presentation.
- ES256/JWKS production signer readiness with no private key exposure.
- Download proxy and journal-handoff routes only when configured and entitled.
- Account-link/OTC-link model with replay protection.
- Clear boundary: WTC never gates local order execution.

Acceptance:

- Disabled until route readiness is complete.
- JWKS never exposes private material.
- Handoff tokens are short-lived, audience-bound, and replay protected.

### Package 6 - Admin Ops + Observability

Goal: operators can see what is happening without SSH for normal checks.

Work:

- Admin system health: WTC app, DB, worker, billing webhook, TV queue, bot read snapshots.
- Admin users/products/support/entitlements/audit-log polish.
- Notifications for manual review, worker failure, webhook ambiguity, TV revoke due.
- Structured logs and redaction rules.
- Backup/restore docs for preview DB and production DB.

Acceptance:

- Admin can identify degraded states from UI.
- No secrets appear in logs or audit rows.
- Preview DB backup exists before migrations/deploys.

### Package 7 - Production Hardening

Goal: move from preview to a deployable product when blockers clear.

Work:

- Real Postgres migrate/seed/harness on a throwaway DB before persistent DB changes.
- Rate limiting, CSP/nonces, session-cookie production checks, CSRF coverage.
- CI activation only after git is initialized and remote exists.
- Docker/systemd deployment docs and service separation for web vs worker.
- Rollback plan for preview/prod deploys.
- Final visual QA across desktop/mobile.

Acceptance:

- Full gates pass.
- E2E passes without flakes if strict mode is used.
- Raw-IP or staging smoke passes.
- Live bots remain active and unaffected.

## Standard Gate Set

Run after implementation and before preview deploy:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
node scripts/gates.mjs full
npm run e2e
```

Also run targeted tests for touched areas.

For DB schema edits:

```powershell
npm run db:generate -w @wtc/db
```

For server preview deploy, only after local gates pass:

- backup preview DB first
- copy archive to server
- apply migrations inside `wtc-ecosystem-preview`
- restart only `wtc-ecosystem-preview` unless separately approved
- verify live bot services are still active
- run raw-IP browser smoke

## Required End-Of-Session Report

Every session must end with:

- Done / not done verdict.
- Agents launched and closed.
- Files changed.
- Gates run and exact results.
- Server touched or not touched.
- Live bot services status if server was touched.
- What remains blocked.
- Next big package, not a tiny task.
