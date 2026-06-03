# ecosystem-bot-integration-auditor handoff
## Scope
Read-only audit for a new Legacy Live production canary slice.

Objective: determine the safest concrete path to enable Legacy Live on the WTC canary, including which legacy endpoints can be read without secret leakage, what WTC adapter code must change, what must stay blocked, and exact post-deploy evidence.

This audit did not run live bot mutation, did not call live legacy endpoints, did not read `.env`, process environments, databases, runtime logs, cookies, tokens, or operator secrets. The only repository write is this handoff.

## Files inspected
- `AGENTS.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `packages/config/src/env.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot\app.py`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`

## Files changed
Exception to read-only: `docs/handoffs/20260603-1305-ecosystem-bot-integration-auditor.md` - this requested handoff only.

## Findings
1. Severity: High. Current WTC cannot enable Legacy Live by environment switch. Evidence: `packages/bot-adapters/src/factory.ts:26-38` routes every non-mock legacy adapter request to `createLegacyBlockedAdapter()` and intentionally ignores `legacyBaseUrl`; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1-16` says the real legacy HTTP adapter was deleted and no network call is possible; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:27-60` asserts read-only and audited modes remain blocked. Recommendation: add a new reviewed read-only legacy HTTP adapter behind a separate feature/env gate; do not weaken the existing B3 blocked adapter until the new path passes the gates below. Target part: adapter factory and package boundary.

2. Severity: High. The safest candidate read endpoints are now `POST /auth/login` for token issuance, `GET /api_management/` for key-safe account summaries, and `GET /api_management/{api_id}` for key-safe detail/config. Evidence: `C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py:93-107` issues access/refresh tokens through login; `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:45-57` exposes the two GET routes; `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py:36-52` defines list/detail response models that omit `api_key` and `secret_key` while including `pub_id`, market, running, balance, quarantine fields, settings, and stage config. Recommendation: accept only these three routes for canary reads, and require a live response-shape proof that no secret-hint fields appear before storing or displaying data. Target part: legacy endpoint allowlist.

3. Severity: High. All legacy mutation and exchange-touching routes must stay blocked from WTC. Evidence: `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:19-30` creates API keys and starts infra; `:33-42` deletes API keys and cleans up infra; `:60-90` patches credentials/market and can rotate credentials or start/stop infra; `:93-126` mutates stage/settings; `:129-170` retests, calls exchange read methods, clears quarantine, and starts infra. Recommendation: WTC must never call POST/PATCH/DELETE legacy routes in this canary; live control, config apply, retest, unquarantine, and infra start/stop stay blocked. Target part: adapter method allowlist and safety model.

4. Severity: High. Legacy source still stores exchange credentials on the provider side, so endpoint response safety is necessary but not sufficient. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91-106` has `Api_Key.api_key` and `secret_key` columns plus balance/quarantine state; `docs/PRODUCTION_BLOCKERS_CURRENT.md` still lists B3 as blocked on the upstream plaintext exchange-key fix and live-control safety gates. Recommendation: for canary, require provider owner sign-off that current response models are deployed, secret-free, and not bypassed by alternate serializers; keep full production blocked until provider-side credential storage and audit acceptance are completed. Target part: provider-side secret model.

5. Severity: High. WTC already has a schema-level secret stripping primitive but no live legacy caller. Evidence: `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts:1-18` documents secret-field stripping before the canonical layer; `:51-86` removes secret-hint fields at nesting depth; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:168-227` verifies stripping of known secret fields and preservation of clean fields. Recommendation: any new legacy HTTP adapter must parse raw responses through `LegacyApiSafeBodySchema` before any stricter schema, mapping, logging, DB write, or UI read. Target part: adapter parser.

6. Severity: High. WTC has no Legacy DB-backed worker import path today. Evidence: `apps/worker/src/index.ts:151-186` constructs only the Tortila adapter and calls `snapshotTortilaJournal`; `apps/worker/src/jobs.ts:82-105` documents a Tortila-only snapshot collector; `apps/web/src/features/bots/data.tsx:148-150` enables DB snapshot mode only for `tortila_bot`; `apps/web/src/features/bots/data.tsx:407-430` otherwise falls back to direct adapter calls from user-facing web renders. Recommendation: implement `snapshotLegacyBot` as a worker-only DB import path and extend DB snapshot mode to `legacy_bot` before enabling Legacy Live on the web canary. Target part: worker and web read path.

7. Severity: High. Legacy canary evidence must not use closed-trade, equity-curve, win-rate, drawdown, or profit-factor claims unless new provider endpoints exist. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md` states legacy has no closed-trade history endpoint and derives only wallet balance/open slots; `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py:49-52` detail responses include settings/stage config but not orders/slots/trades in the current response model inspected. Recommendation: canary Legacy Live should start with health/config/balance/quarantine/stage/settings only, show performance analytics as unavailable, and add positions/trades only after a key-safe provider endpoint is designed and verified. Target part: analytics truthfulness.

8. Severity: Medium. Existing canary posture supports a WTC-only deploy without touching live bot services, and that pattern must be preserved. Evidence: `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md` records that the latest deploy replaced only the WTC canary, kept worker/preview running, kept bot services active, kept external bot API ports closed, kept `FEATURE_LIVE_BOT_CONTROL=false`, and kept Legacy reference/export-only. Recommendation: the Legacy Live canary deploy must replace only WTC web/worker containers or release files, not the legacy bot process, bot config, bot database, tmux/systemd, exchange state, or firewall policy except for an explicitly approved network allowlist check. Target part: deploy safety.

9. Severity: Medium. Environment validation currently has `LEGACY_BOT_BASE_URL` but no legacy service-account secret/token requirement. Evidence: `packages/config/src/env.ts:33-45` validates bot mode, Tortila URLs, Legacy base URL, and Tortila journal token; `:111-115` requires only `JOURNAL_READ_TOKEN` for production non-mock mode. Recommendation: add separate production-like validation for legacy canary credentials or vault reference, with no plaintext legacy username/password in ordinary env, logs, UI, DB health details, or retained artifacts. Target part: config/vault boundary.

## Decisions
- Do not enable Legacy Live in the current code state.
- Do not call the live legacy API from WTC until a new read-only adapter is implemented, schema-strips secret fields first, and is wired through the worker/DB path.
- Treat `POST /auth/login`, `GET /api_management/`, and `GET /api_management/{api_id}` as the only candidate canary endpoints, pending live response-shape proof.
- Keep all POST/PATCH/DELETE legacy API management routes, retest, unquarantine, start/stop, config apply, tmux/systemd/process control, provider DB mutation, provider env mutation, and exchange API calls blocked.
- Keep Legacy analytics operational/reference-only until key-safe positions/trades/equity endpoints exist.
- No background agents were spawned by this auditor; none are left running.

## Risks
- The current provider source appears to omit raw exchange keys from API response models, but the WTC contract and production blocker still record B3 as blocked; a deployed legacy server could differ from the local source snapshot.
- A service-account login necessarily handles credentials and JWTs; without a vault-backed design and redacted child/log handling, the canary could leak authentication material even if API responses omit exchange keys.
- User-facing web renders can direct-call adapters for non-DB-backed products; enabling a real legacy adapter before DB snapshot mode would expose the legacy API to page-render traffic patterns.
- Legacy balance may lag, stage/settings are operational configuration, and the inspected response model does not include closed trades/equity. Treating this as full performance analytics would be misleading.
- The local source tree contains sample/fixture files with credential-shaped fields; they must not be copied into WTC evidence, screenshots, logs, or durable docs.

## Verification/tests
RUN in this audit:
- Static WTC adapter gate review: factory, blocked adapter, control gate, warning registry, secret stripping, and legacy-blocked tests inspected.
- Static WTC worker/web route review: current Tortila-only worker import and Tortila-only DB snapshot mode inspected.
- Static legacy source review: auth route, API management route, response schemas, settings/stage schemas, and ORM models inspected for endpoint and model shape.
- Current canary status review: Phase 3.65 and 3.67 handoffs plus current production blockers inspected.
- Git start state check: `git status --short --branch` showed branch `codex/bot-analytics-settings-canary-20260603` with no dirty files before writing this handoff.

NOT RUN / NOT GREEN in this audit:
- Live legacy endpoint calls: NOT RUN by read-only/no-secret scope and because WTC code still blocks Legacy.
- Live bot mutation/control: NOT RUN and remains forbidden.
- Provider response-shape proof: NOT RUN; must be collected post-implementation with redacted evidence.
- Unit/integration/e2e tests: NOT RUN; this audit changed only the requested handoff.
- Server deploy, worker restart, Docker, SSH, tmux, systemd, DB migrations, and production worker ticks: NOT RUN.
- Secret scan after handoff: NOT RUN in this audit; required in implementation/deploy phase.

## Next actions
1. Add a new `createHttpLegacyReadOnlyAdapter` behind an explicit legacy-live canary gate, leaving `createLegacyBlockedAdapter` as the default non-mock path until acceptance is complete.
2. First operation in the adapter after `fetch` body parse: run `LegacyApiSafeBodySchema.parse(raw)`; then validate a strict key-free schema for login, list, and detail responses.
3. Implement only `getHealth`, `getConfig`, and minimal `getMetrics` from key-safe list/detail responses: process/read state, running, balance, quarantine, settings, and stage config. Return unavailable/null for equity curve, closed trades, win rate, profit factor, drawdown, funding, fees, and unrealized PnL unless provider adds key-safe endpoints.
4. Add `snapshotLegacyBot` in the worker, with a target such as `legacy-bot`, source adapter `legacy`, redacted health detail, and DB writes only for safe metric/config/health evidence. Do not import raw provider bodies.
5. Extend web DB snapshot mode for `legacy_bot` so production user pages read WTC Postgres snapshots, not the live legacy adapter directly.
6. Add production-like config/vault validation for legacy canary auth material; do not store plaintext service-account credentials in normal env, durable docs, DB health rows, logs, or UI.
7. Add focused tests: adapter factory gate, no calls to mutation endpoints, secret stripping before schema mapping, no secret-hint keys in serialized adapter outputs, blocked control methods, web DB-backed Legacy mode, worker redaction, and static deny tests for POST/PATCH/DELETE `/api_management`.
8. Post-deploy evidence required before calling Legacy Live canary accepted:
   - WTC release/container replacement touched only WTC web/worker, not legacy bot service/config/DB/exchange state.
   - `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and all Axioma/live-control gates still disabled.
   - External bot ports remain closed; WTC worker can reach the approved internal legacy base URL.
   - Redacted live response-shape proof for the three allowed endpoints shows no secret-hint field names or values.
   - Worker logs show `legacy-snapshot ok` without token, password, authorization header, API key, secret key, raw response body, cookie, or URL credential leakage.
   - WTC DB has `integration_health_checks` for `legacy-bot` and safe metric/config snapshots with no secret-hint keys in `detail` or `rawJson`.
   - Browser checks for Legacy dashboard/settings/statistics show live/read-only status, quarantine and no-trade-history warnings, and N/A for unavailable analytics rather than fabricated zeros.
   - `npm run ci:local`, focused legacy adapter tests, worker tests, `npm run secret:scan`, and a browser smoke pass green on the exact deployed tree.
