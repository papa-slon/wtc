# Phase 3.16 worker local smoke and heartbeat monitoring handoff
## Scope
Implemented a local worker deployment-readiness slice for epoch `20260601-2240` after dispatching the required read-only agents before edits.

Per-agent handoffs:
- [`docs/handoffs/20260601-2240-ecosystem-devops-implementer.md`](20260601-2240-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260601-2240-ecosystem-backend-implementer.md`](20260601-2240-ecosystem-backend-implementer.md)
- [`docs/handoffs/20260601-2240-ecosystem-bot-integration-auditor.md`](20260601-2240-ecosystem-bot-integration-auditor.md)
- [`docs/handoffs/20260601-2240-ecosystem-security-auditor.md`](20260601-2240-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-2240-ecosystem-tests-runner.md`](20260601-2240-ecosystem-tests-runner.md)

All five background agents were closed after their handoffs were collected. No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service was touched.

## Files inspected
See the five per-agent handoffs above plus the implementation files listed below.

## Files changed
- `.env.example`
- `package.json`
- `scripts/safe-worker-tick.mjs`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2240-ecosystem-devops-implementer.md`
- `docs/handoffs/20260601-2240-ecosystem-backend-implementer.md`
- `docs/handoffs/20260601-2240-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260601-2240-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-2240-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`

## Findings
1. High - The open blocker is managed worker deployment/monitoring, not missing worker business logic. This phase adds local command and UI evidence, but does not deploy a persistent preview/production worker process.
2. High - The long-running worker could previously fall back to the in-memory demo loop without `DATABASE_URL`. It now fails closed for `NODE_ENV=production` or `APP_ENV=staging|production`, while `npm run worker:smoke` forces development/mock mode for local checks.
3. Medium - Worker heartbeat detail needed an admin rendering boundary. Health details are now allowlisted and redacted before `/admin/system-health` renders them.
4. Medium - Admin system health read oldest health rows first and did not highlight worker heartbeat freshness. It now shows the latest worker row and lists integration checks newest-first.
5. Medium - Worker snapshot env vars were not represented in the typed/template env surface. `TORTILA_JOURNAL_URL`, `SYSTEM_BOT_OWNER_ID`, and `SYSTEM_BOT_INSTANCE_ID` are now documented/typed as optional worker bindings.

## Decisions
- Add `npm run worker:smoke` as the local one-shot operator command; it forces mock adapters and disables live bot control / TradingView automation.
- Keep persistent preview/production worker deployment out of scope because that requires operator approval and live service/process-manager access.
- Preserve the worker as read-only/import-only for bot data; no start/stop/apply-config path was introduced.
- Treat `integration_health_checks.detail` as unsafe-by-default for admin UI and project it through an explicit allowlist.
- Require DB-backed worker operation in staging/production-like environments instead of silently running memory demo mode.

## Risks
- `npm run worker:smoke` proves local script wiring and memory-demo behavior in this shell, not a managed service restart policy.
- The worker heartbeat stale threshold is UI-level freshness only; external process monitoring still needs a real preview/production process manager.
- Real read-only Tortila HTTP acceptance still depends on endpoint credentials/contracts and must stay separate from this local mock-mode slice.

## Verification/tests
RUN:
- `npm test -- packages/config/src/env.test.ts tests/integration/admin-health-detail.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/db-seed-preview-hardening.test.ts` - PASS, 5 files, 36 tests.
- `npm run worker:smoke` - PASS, memory demo tick OK with no `DATABASE_URL` in this shell.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates green (`governance`, `check:core`, `lint`, `typecheck`, `typecheck-web`, `secret:scan`, `test`, `db:generate`, `build`).
- env-cleared `node scripts/gates.mjs e2e` - PASS, 44 passed.
- final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- Managed preview/production worker process deployment, systemd/tmux/SSH/process-manager checks, real-Postgres worker acceptance, live Tortila/Axioma/Stripe/TradingView integrations, and live bot/exchange control. Reason: out of scope for this local phase, unavailable credentials/contracts, or explicitly forbidden without operator approval.

## Next actions
1. With operator approval, deploy a separately managed preview worker process and add external process monitoring/alerting.
2. When credentials/contracts are provided, run real-Postgres worker acceptance and read-only Tortila endpoint-shape acceptance.
