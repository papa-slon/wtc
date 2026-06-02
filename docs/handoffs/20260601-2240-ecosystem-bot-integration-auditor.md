# ecosystem-bot-integration-auditor handoff
## Scope
Phase 3.16 read-only bot-integration safety audit for the worker service. Confirm whether any existing worker/import path can start, stop, apply live bot config, or touch exchange credentials; identify evidence that a local worker deployment/monitoring slice can remain read-only/import-only; list remaining live-control blockers.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tradingview-access.md`
- `docs/CONTRACTS/backtester-runner.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `.env.example`
- `packages/worker/**` (no files found; current worker package is `apps/worker`)
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-cli.ts`
- `packages/config/src/env.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/db-persistence.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - No existing worker path starts/stops bots or applies live bot config. Evidence: the DB worker tick imports only entitlement, TradingView, JTI purge, health, and bot-instance DB helpers (`apps/worker/src/index.ts:37-46`), selects an adapter mode that fails closed to `mock` for unknown/missing values (`apps/worker/src/index.ts:30-35`), and calls `snapshotTortilaJournal()` only after constructing a Tortila adapter (`apps/worker/src/index.ts:64-100`). The snapshot job documents and implements no `startBot`/`stopBot`/`applyConfig` calls (`apps/worker/src/jobs.ts:74-89`), while adapter control methods are typed as disabled (`packages/bot-adapters/src/types.ts:89-92`) and throw unless both feature flag and audit approval are true (`packages/bot-adapters/src/control.ts:16-18`). Recommendation: keep worker implementation limited to data reads plus WTC DB writes; add/keep static guard coverage that worker code never calls adapter control methods. Target part: worker service / bot-adapter boundary.

2. High - The local worker snapshot/import slice is read-only toward Tortila and import-only toward WTC DB. Evidence: the real Tortila adapter is documented as GET-only and explicitly excludes mutation/control (`packages/bot-adapters/src/http.ts:1-10`); implemented real endpoints are `GET /api/health`, `/api/summary`, `/api/trades/list`, and `/api/equity`, and control remains disabled (`packages/bot-adapters/src/http.ts:75-88`). The generic HTTP helper uses `fetch(..., { method: 'GET' })` and attaches only the optional journal bearer token (`packages/bot-adapters/src/http.ts:41-50`). The worker writes metric snapshots, position snapshots, closed-trade imports, and integration health rows (`apps/worker/src/jobs.ts:155-238`), matching DB tables that are snapshot/import tables (`packages/db/src/schema.ts:361-436`); closed-trade import is idempotent with conflict-do-nothing plus audit only on insert (`packages/db/src/repositories.ts:910-920`). Recommendation: a local deployment/monitoring slice can run with `BOT_ADAPTER_MODE=mock` for preview or with explicitly approved `read-only` Tortila journal credentials; monitor `integration_health_checks` and imported snapshot freshness, not live bot state. Target part: Phase 3.16 worker deployment/monitoring.

3. High - The audited code path does not call Tortila `/api/marks` or become an exchange data client. Evidence: the Tortila contract says `/api/marks` calls BingX and WTC must never consume it (`docs/CONTRACTS/tortila-adapter.md:249-255`), and the current adapter status table marks `/api/marks` excluded and start/stop/apply hard-disabled (`docs/CONTRACTS/tortila-adapter.md:458-460`). The adapter source repeats the ban (`packages/bot-adapters/src/http.ts:8-10`), position mapping uses `avg_entry` as an approximation and warns not to call `/api/marks` (`packages/bot-adapters/src/tortila/tortila.mapping.ts:151-174`), and the latest status states the worker remains read-only and never calls `/api/marks` (`docs/STATUS.md:126-129`). Recommendation: keep mark-price/unrealized-PnL gaps labelled as unavailable; do not add `/api/marks` to worker polling. Target part: Tortila read-only adapter / analytics import.

4. High - Legacy live adapter remains correctly blocked; no worker/import path can reach the plaintext-key legacy API in the current factory. Evidence: production blocker B3 remains open for upstream plaintext exchange-key fix and live-control safety gates (`docs/PRODUCTION_BLOCKERS_CURRENT.md:12`). The legacy contract says staging/production non-mock modes route to `createLegacyBlockedAdapter`, with no configuration path that can reach the legacy bot (`docs/CONTRACTS/legacy-bot-adapter.md:391-401`). The factory ignores `legacyBaseUrl` in non-mock mode and returns `createLegacyBlockedAdapter()` (`packages/bot-adapters/src/factory.ts:32-38`), and the blocked adapter has no URL/token constructor, never makes a network call from `getHealth()`, throws data-method blocker errors, and keeps control disabled (`packages/bot-adapters/src/legacy/legacy-blocked.ts:1-16`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:54-100`). Recommendation: keep B3 closed until the upstream API removes plaintext keys and all safety gates clear; worker Phase 3.16 must not include legacy polling. Target part: legacy adapter / worker scope.

5. Medium - The worker itself does not touch exchange credential storage; exchange keys are a separate web/vault surface and are sealed when stored. Evidence: worker imports only DB worker helpers at runtime (`apps/worker/src/index.ts:37-46`) and snapshot import helpers inside the job (`apps/worker/src/jobs.ts:103`), not `addExchangeKey()` or `listExchangeKeys()`. The DB schema states `exchange_api_key_secrets` has no plaintext column and stores only sealed vault records (`packages/db/src/schema.ts:1-7`, `packages/db/src/schema.ts:120-126`). `addExchangeKey()` stores sealed data and audits only non-secret mask/label/key id (`packages/db/src/repositories.ts:189-205`), and `listExchangeKeys()` deliberately never joins sealed material (`packages/db/src/repositories.ts:209-212`). Recommendation: do not add exchange-key reads to worker monitoring; if future bot deployment checks need credential presence, use non-secret masks/counts only. Target part: worker service / exchange secret boundary.

6. Medium - WTC-side bot config save/export is local/reference-only and must not be confused with live apply. Evidence: `saveBotConfig()` is explicitly WTC DB only and never forwarded to the live bot (`packages/db/src/repositories.ts:851-863`), while the web persistence path calls `ensureBotInstance()` and `saveBotConfig()` only (`apps/web/src/features/bots/config.ts:424-435`). Current status says config export contains no exchange keys or live-apply tokens and no live bot/exchange control was touched (`docs/STATUS.md:118-119`). The Tortila adapter still has no verified config endpoint; the contract tracks `GET /api/config` JSON as a P1 future item (`docs/CONTRACTS/tortila-adapter.md:532`). Recommendation: keep worker out of config apply; label saved/exported configs as WTC-side reference until an audited live apply pipeline exists. Target part: bot config / setup UX / future worker scope.

7. Medium - Read-only Tortila worker deployment still has operational gates before production-style polling. Evidence: `.env.example` defaults live bot control off, TV automation off, and `BOT_ADAPTER_MODE=mock` (`.env.example:28-36`); production non-mock adapter mode requires `JOURNAL_READ_TOKEN` (`packages/config/src/env.ts:78-79`); the Tortila contract gates `BOT_ADAPTER_MODE=read-only` on schema/fixture/mapping confirmation, passing mapping tests, journal API token auth, and firewall restriction to the WTC server IP (`docs/CONTRACTS/tortila-adapter.md:469-473`). The current blocker list says the worker snapshot/import code exists but a separately managed preview worker process still needs deployment/monitoring (`docs/PRODUCTION_BLOCKERS_CURRENT.md:17`). Recommendation: Phase 3.16 can ship worker process management and health monitoring with mock mode first; only enable real Tortila read-only polling after token/firewall/config review, and document exact process manager/log/health behavior. Target part: devops worker deployment.

8. High - Live-control blockers are still open and are not cleared by this audit. Evidence: the safety model requires all gates before enabling `BOT_CONTROL_ENABLED=true` (`docs/BOT_CONTROL_SAFETY_MODEL.md:95-96`); Gate 1 security audit is NOT STARTED (`docs/BOT_CONTROL_SAFETY_MODEL.md:98-108`), Gate 2 bot-integration audit is still IN PROGRESS with unresolved Tortila P0/P1 requirements (`docs/BOT_CONTROL_SAFETY_MODEL.md:110-121`), Gate 3 exchange safety audit is NOT STARTED and requires Tortila live-gate, legacy quarantine, minimal key permissions, reconciliation, TP restore, and margin pre-flight evidence (`docs/BOT_CONTROL_SAFETY_MODEL.md:123-136`), and Gate 4 integration tests are NOT STARTED (`docs/BOT_CONTROL_SAFETY_MODEL.md:138-146`). The canonical analytics doc still lists Tortila TP restore and margin pre-flight as open warnings (`docs/CANONICAL_ANALYTICS_MODEL.md:274-287`). Recommendation: do not enable start/stop/apply or any "audited" control path in Phase 3.16; treat worker deployment as read-only/import-only. Target part: live bot control readiness.

## Decisions
- Treat `apps/worker` as the current worker package; `packages/worker/**` does not exist in this tree.
- A Phase 3.16 local worker deployment/monitoring slice is acceptable only as read-only/import-only: DB tick, snapshot import, health checks, process/log monitoring, and no live bot/exchange/control mutation.
- Keep `BOT_ADAPTER_MODE=mock` as the safe preview default. `read-only` Tortila polling remains an explicit phase-gated action requiring `JOURNAL_READ_TOKEN`, endpoint-shape confidence, and firewall/network review.
- Keep Legacy out of worker polling until B3 clears; current non-mock legacy adapter is a deterministic blocked adapter.
- Do not treat WTC-side config save/export as live apply. It remains local/reference-only.

## Risks
- The `audited` adapter mode name can be misread as enabling control, but current code still disables control. Future work must not let the mode name bypass `BotControlDisabledError`.
- If `BOT_ADAPTER_MODE=read-only` is enabled with a Tortila URL and token, the worker will make real GET requests to the journal. That is read-only, but it is still a live network dependency and should be separately monitored/rate-limited.
- Worker snapshot writes can make dashboards look fresh even when data is mock unless `sourceAdapter`/mode labels remain visible.
- The live-control blocker set is broad: security audit, exchange safety audit, integration tests, Tortila TP restore, Tortila margin pre-flight, and legacy plaintext-key remediation remain open.

## Verification/tests
RUN:
- Static file inspection only via `Get-Content`, `rg --files`, and `rg -n`.
- Confirmed `docs/SESSION_PROTOCOL.md` and `AGENTS.md` before audit work.
- Confirmed `packages/worker/**` is absent and current worker files live under `apps/worker`.
- Confirmed no live server, Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoint was called.

NOT RUN:
- `npm test`, `node scripts/gates.mjs full`, Playwright, `npm run build`, `npm run typecheck`, `npm run db:generate`, or worker `tick`. Reason: this was a read-only audit with only one permitted file write; those commands can create artifacts or require broader gate ownership.
- Dev server, preview server, worker daemon, SSH/tmux/systemd, bot/exchange endpoints, Stripe/Axioma/TradingView endpoints. Reason: explicitly out of scope and prohibited for this audit.
- Live Tortila journal GET checks. Reason: scope was static safety audit; live polling requires explicit deployment/monitoring authorization and token/firewall review.

## Next actions
1. Devops can implement a separately managed worker process slice with safe defaults: `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, no legacy polling, process logs, and an admin-visible `integration_health_checks` heartbeat.
2. Add a static worker safety test that reads `apps/worker/src/**` and fails if `startBot`, `stopBot`, `applyConfig`, `/api/marks`, `addExchangeKey`, `listExchangeKeys`, `ssh`, `tmux`, `systemctl`, `exec`, `spawn`, or `process.kill` appear in worker runtime code.
3. Before enabling Tortila `read-only` polling, verify `JOURNAL_READ_TOKEN` provisioning, firewall restriction to WTC server IP, endpoint shapes, rate limits, and source/mode labelling in dashboards.
4. Keep live control blocked until all BOT_CONTROL_SAFETY_MODEL gates are complete, including Tortila TP restore, margin pre-flight, exchange safety review, and Playwright/Vitest control-flow coverage.
5. Keep Legacy blocked until upstream removes plaintext exchange keys from `/api_management/*`, a service-account flow is approved, and the blocked adapter is replaced only after security acceptance.
