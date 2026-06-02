# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.16 security/privacy audit for worker service deployment and monitoring. Focus: environment variables, logs, audit records, health checks, plaintext secret handling, fail-closed behavior, and a bounded local implementation slice that improves monitoring without exposing secrets or enabling live bot control.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `.env.example`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/lib/backend.ts`
- `scripts/gates.mjs`
- `scripts/safe-preview.mjs`
- `package.json`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/INTEGRATION_MAP.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - `integration_health_checks.detail` is persisted and rendered without a redaction boundary. Evidence: `recordHealthCheck()` inserts caller-provided `detail` as-is into `integration_health_checks` (`packages/db/src/repositories.ts:810-811`); `snapshotTortilaJournal()` records caught error strings in health detail (`apps/worker/src/jobs.ts:241-247`); the admin system-health page renders `JSON.stringify(hc.detail).slice(0, 120)` (`apps/web/src/app/admin/system-health/page.tsx:176-178`). The audit log path has mature redaction (`packages/audit/src/redact.ts:12-36`, `packages/audit/src/audit.ts:162-179`), but health checks do not use it. Recommendation: add a safe health-detail serializer before persistence and an allowlisted display DTO before rendering; include regression tests with a fake bearer token / URL credential string. Target part: worker monitoring privacy.

2. High - Core worker tick failures can bypass health recording and run as unhandled interval rejections. Evidence: `runDbWorkerTick()` records `target='worker', status='ok'` only after entitlement, TradingView, repair, and JTI purge jobs succeed (`apps/worker/src/index.ts:48-61`); the long-running scheduler calls `void runDbWorkerTick(db)` in `setInterval` without a catch or failure health row (`apps/worker/src/index.ts:163-168`); the one-shot wrapper catches only for CLI exit (`apps/worker/src/tick-once.ts:23-25`). Recommendation: wrap every DB tick in a monitored runner that catches core-job errors, records `worker/error` with redacted detail, logs a safe compact message, and keeps the interval alive. Target part: deployment monitoring/fail-closed observability.

3. Medium - Worker environment handling drifts from the typed env contract. Evidence: production config requires `JOURNAL_READ_TOKEN` when `BOT_ADAPTER_MODE` is not `mock` (`packages/config/src/env.ts:76-80`) and validates bot mode / URL-shaped inputs (`packages/config/src/env.ts:30-37`), but the worker reads raw `process.env` through a local `WorkerEnv` and local `getBotAdapterMode()` (`apps/worker/src/index.ts:17-35`, `apps/worker/src/index.ts:64-98`). This is fail-safe for unknown modes, and missing read tokens do not fetch the journal, but URL/token requirements are not centrally validated in the worker process. Recommendation: add `loadWorkerEnv()` with explicit optional-DB support, URL validation for `TORTILA_JOURNAL_URL` / `TORTILA_JOURNAL_BASE_URL`, production token requirements, and redacted validation errors. Target part: worker deployment env contract.

4. Medium - System-health UI currently reads the oldest 50 integration checks, not the latest 50, which can hide recent worker failures. Evidence: `loadSystemHealth()` orders `integrationHealthChecks.checkedAt` ascending and limits 50 (`apps/web/src/features/admin/queries.ts:160-164`), while the page labels the table as live integration health (`apps/web/src/app/admin/system-health/page.tsx:143-150`). Recommendation: order by `desc(checkedAt)`, group latest row per target where possible, and show stale age thresholds. Target part: admin monitoring correctness.

5. Medium - Preview worker deployment/monitoring is still an explicit production blocker. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md` states the worker snapshot/import code exists but a separately managed preview worker process still needs deployment/monitoring (`docs/PRODUCTION_BLOCKERS_CURRENT.md:17`); worker scripts expose `dev`, `start`, and one-shot `tick` but no deployment health wrapper (`apps/worker/package.json:6-10`). Recommendation: implement local one-shot acceptance first, then have devops wire process supervision only after the monitored tick wrapper exists. Target part: worker service deployment readiness.

6. Low - Live bot control remains hard-disabled and legacy plaintext-key exposure remains blocked in the inspected code. Evidence: adapter control methods call `assertBotControlAllowed(..., false, false)` (`packages/bot-adapters/src/http.ts:57-70`, `packages/bot-adapters/src/control.ts:16-18`); legacy non-mock mode returns `createLegacyBlockedAdapter()` and ignores `legacyBaseUrl` (`packages/bot-adapters/src/factory.ts:32-38`); the blocked legacy adapter has no URL/token constructor and never issues a network request (`packages/bot-adapters/src/legacy/legacy-blocked.ts:41-56`). Recommendation: preserve these as regression tests in the monitoring slice; do not add any start/stop/apply-config path. Target part: live-control boundary.

## Decisions
- Treat the actual worker path as `apps/worker/**`; `packages/worker/**` does not exist in this tree.
- Do not run `node scripts/gates.mjs` during this read-only audit because it writes `logs/gates/*` (`scripts/gates.mjs:23-25`, `scripts/gates.mjs:64-98`), and the only permitted write is this handoff.
- Do not run Playwright/e2e or start dev/preview servers because this phase forbids servers/live service mutation.
- Bounded local implementation slice recommended: add a safe worker monitoring layer only. Concretely: `safeHealthDetail()`/`recordSafeHealthCheck()` using the existing audit redaction rules, a `runMonitoredDbWorkerTick()` wrapper that records redacted worker failures, latest-first/grouped admin health display, and focused tests for no secret leakage, no live bot control, read-only missing-token behavior, and worker error health rows.

## Risks
- Health checks are lower-friction than audit logs, so they are likely to accumulate operational error strings. Without redaction, future adapter or DB errors could persist sensitive URL credentials, bearer tokens, or raw exception messages.
- A worker process can look absent rather than failed if an early DB job throws before `recordHealthCheck('worker', 'ok', ...)` runs.
- Duplicating env parsing in web and worker increases the chance that production config fails closed in one process but not the other.
- Enabling `BOT_ADAPTER_MODE=read-only` before the monitoring slice would improve data freshness but increase exposure to unsanitized health/error detail.

## Verification/tests
RUN:
- Read-only file inspection and targeted `rg` searches only.

NOT RUN:
- `node scripts/gates.mjs *` - skipped because it writes gate logs and this audit permits only the handoff write.
- `npm test` / focused Vitest - skipped to avoid generated output and because the requested phase is read-only discovery.
- Playwright/e2e/dev/preview server commands - skipped because they start servers and are out of scope.
- Any live Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoint checks - explicitly prohibited by scope.

## Next actions
1. Implement the bounded local monitoring slice: redacted health-detail persistence/display, monitored worker tick error rows, latest-first grouped system-health rows, and tests proving secrets are not persisted or rendered.
2. Keep `BOT_ADAPTER_MODE=mock` for preview until the monitoring slice lands and a separate devops phase supervises the worker process with safe env.
3. Add regression coverage for: missing `JOURNAL_READ_TOKEN` makes no fetch; worker core-job throw records safe `worker/error`; admin health display never renders bearer/basic auth, DB URL credentials, or long token values; live control still throws.
4. After local tests pass, hand to devops for process supervision/deployment monitoring without touching live bot/exchange/systemd in this phase.
