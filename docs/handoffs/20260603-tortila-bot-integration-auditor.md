# ecosystem-bot-integration-auditor handoff
## Scope
Focused read-only Tortila/Turtle bot integration audit for WTC.

Mapped the current end-to-end operation path:

1. Tortila runtime: `turtle-bot.service` runs `python main.py run`; `turtle-journal.service` runs `python -m turtle_bot.journal run --port 8080`.
2. Tortila config: environment / `.env` driven, including `SYMBOL_CONFIGS`, risk, safety, live-gate, and DB path settings.
3. Tortila journal: read-only FastAPI process over the bot SQLite WAL DB, exposing health, summary, equity, trades, decisions, advanced metrics, marks, breakdowns, calendar, distribution, drawdown, and activity endpoints.
4. WTC adapter: GET-only Tortila HTTP adapter, disabled controls, bearer token requirement for real reads, no `/api/marks`, no live config endpoint.
5. WTC worker: read-only snapshot job imports journal health, metrics, positions, trades, and equity-derived metrics into WTC DB tables.
6. WTC web/admin: user product pages, journal overlays, statistics, settings/export, and `/admin/bots` consume WTC DB snapshots and WTC-side config versions.

Boundaries observed:

- No live server mutation.
- No bot start/stop/restart.
- No config apply.
- No exchange calls.
- No `.env` secret reads.
- No bot SQLite/WAL data reads.
- Adjacent `..\bot_tortila` was inspected only as source/docs evidence.

## Files inspected
WTC repo:

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/warnings.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`

Adjacent Tortila repo:

- `..\bot_tortila\DEPLOYMENT.md`
- `..\bot_tortila\README.md`
- `..\bot_tortila\pyproject.toml`
- `..\bot_tortila\main.py`
- `..\bot_tortila\src\turtle_bot\cli.py`
- `..\bot_tortila\src\turtle_bot\config.py`
- `..\bot_tortila\src\turtle_bot\journal\app.py`
- `..\bot_tortila\src\turtle_bot\journal\metrics.py`
- `..\bot_tortila\src\turtle_bot\state\models.py`
- `..\bot_tortila\src\turtle_bot\state\store.py`
- `..\bot_tortila\src\turtle_bot\engine\orchestrator.py`
- `..\bot_tortila\src\turtle_bot\engine\reconciler.py`
- `..\bot_tortila\src\turtle_bot\execution\order_manager.py`
- `..\bot_tortila\src\turtle_bot\risk\risk_manager.py`

Not inspected:

- `..\bot_tortila\.env`
- Live bot processes
- Bot SQLite/WAL contents
- Remote server/systemd state
- Exchange APIs

## Files changed
`docs/handoffs/20260603-tortila-bot-integration-auditor.md` - this handoff only.

## Findings
1. Severity: High. The accepted WTC Tortila operation is currently DB-backed and read-only: Tortila journal -> WTC GET-only adapter -> worker snapshot -> WTC DB -> web/admin UI. Evidence: adjacent deployment docs define the bot CLI process and journal port 8080 (`..\bot_tortila\DEPLOYMENT.md:7-21`); the WTC adapter is explicitly GET-only, disables controls, refuses `/api/marks`, and leaves `getConfig` unimplemented (`packages/bot-adapters/src/http.ts:1-10`, `packages/bot-adapters/src/http.ts:75-89`); the worker writes health, metric, position, and trade snapshots (`apps/worker/src/jobs.ts:82-105`, `apps/worker/src/jobs.ts:163-246`); production web reads Tortila from DB snapshot mode (`apps/web/src/features/bots/data.tsx:147-149`, `apps/web/src/features/bots/data.tsx:241-299`). Recommendation: keep production product pages on WTC DB snapshots, not direct browser/server calls to the live journal, until auth, scoping, and observability are complete. Target part: adapter, worker, web read model.

2. Severity: High. Provider-side journal authentication remains unfinished from WTC's production-readiness perspective. WTC attaches bearer auth when `JOURNAL_READ_TOKEN` exists and refuses real data reads without it (`packages/bot-adapters/src/http.ts:41-49`, `packages/bot-adapters/src/http.ts:93-98`), but the adjacent FastAPI journal imports only `FastAPI`, `Query`, and `Request`, creates the app with no observed auth middleware, and defines endpoints directly (`..\bot_tortila\src\turtle_bot\journal\app.py:19-20`, `..\bot_tortila\src\turtle_bot\journal\app.py:315-318`, `..\bot_tortila\src\turtle_bot\journal\app.py:572-622`). The WTC contract also records "no auth on the journal" and requires a bearer token plus network restriction before production read-only use (`docs/CONTRACTS/tortila-adapter.md:33-45`, `docs/CONTRACTS/tortila-adapter.md:470-476`). Recommendation: implement provider-side bearer middleware, return 401 on missing/wrong token, prove 200 with the configured WTC token, and restrict port 8080 to WTC infrastructure before any production real-read enablement. Target part: Tortila journal provider, deploy checklist, WTC env gate.

3. Severity: High. The current Tortila settings page is WTC-side versioning/reference export, not a production runtime settings page. Tortila itself loads settings from environment / `.env` and `SYMBOL_CONFIGS` (`..\bot_tortila\src\turtle_bot\config.py:128-154`) and live mode requires `MODE=live`, `I_UNDERSTAND_LIVE_TRADING=YES`, and `--live` (`..\bot_tortila\src\turtle_bot\config.py:377-401`). WTC saves config only into `bot_configs` / `bot_config_versions` and audit logs, never forwards it to the live bot (`packages/db/src/repositories.ts:1663-1690`); WTC export emits safe `.env` reference lines only, with no secrets and no live-apply token (`apps/web/src/features/bots/config.ts:543-558`); the settings action validates and persists WTC state only (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:68-80`); Tortila journal has `/config` HTML but no JSON `/api/config` (`..\bot_tortila\src\turtle_bot\journal\app.py:560-568`). Recommendation: define the production settings contract separately from live apply: current runtime config JSON, WTC saved draft, diff/review, admin approval, audit trail, and an explicit no-restart/no-apply state until bot-control gates are complete. Target part: settings UX, config contract, provider journal.

4. Severity: High. Bot ownership/scoping is unresolved for a production settings page if Tortila is meant to support per-user accounts. DB schema and settings create per-user `bot_instances` (`packages/db/src/schema.ts:138-152`, `packages/db/src/repositories.ts:1663-1670`), but the worker snapshots one environment-selected system instance (`apps/worker/src/index.ts:154-191`) and the production read model picks latest snapshots by `productCode`, not by the current user's bot instance (`apps/web/src/features/bots/data.tsx:241-299`). User entitlement gates access before rendering, but the underlying live-read data is product/global. Recommendation: explicitly decide whether Tortila is a single shared managed strategy or per-user exchange-account runtime. If per-user, snapshot and query by bot instance/account, and make settings, statistics, journal, and admin views use the same ownership key. Target part: domain model, worker, web read model, settings.

5. Severity: Medium. WTC consumes only a subset of the Tortila journal. Adjacent journal exposes `/api/decisions`, `/api/metrics/advanced`, `/api/symbol_breakdown`, `/api/calendar`, `/api/monthly`, `/api/distribution`, `/api/drawdown`, and `/api/activity` in addition to health/summary/equity/trades (`..\bot_tortila\src\turtle_bot\journal\app.py:657-840`). WTC worker currently imports health, canonical metrics, positions, and closed trades only (`apps/worker/src/jobs.ts:133-246`), and WTC statistics compute advanced analytics locally from imported snapshots/trades rather than consuming the provider advanced endpoints. Recommendation: if production settings/status needs operational evidence, add read-only ingestion for decisions and safety/activity events into WTC-owned tables; keep `/api/marks` excluded. Target part: worker ingestion, statistics, audit/ops panels.

6. Severity: Medium. Open-position mark price, unrealized PnL, and open risk are intentionally unavailable in the safe WTC path. The contract says `/api/marks` calls BingX and WTC must not consume it (`docs/CONTRACTS/tortila-adapter.md:250-282`); the adapter comments enforce that exclusion (`packages/bot-adapters/src/http.ts:8-10`, `packages/bot-adapters/src/http.ts:85-88`). Tortila journal does expose `/api/marks` with a short-lived BingX fetch/cache (`..\bot_tortila\src\turtle_bot\journal\app.py:705-725`), but WTC maps positions without true marks and must display N/A. Recommendation: keep user/admin UI explicit that open risk/unrealized PnL are unavailable from safe journal data until the provider emits non-exchange-calling snapshots. Target part: statistics, positions, user copy.

7. Severity: Medium. WTC P0/P1 warnings are still contract-hardcoded and cannot clear from current journal state, even though adjacent Tortila source now contains mitigation code paths. Evidence for mitigations: margin preflight fetches free margin and records `margin_insufficient` safety events (`..\bot_tortila\src\turtle_bot\engine\orchestrator.py:515-542`); runtime TP verification/replacement exists (`..\bot_tortila\src\turtle_bot\engine\orchestrator.py:1004-1106`); reconciler-side TP restoration exists (`..\bot_tortila\src\turtle_bot\engine\reconciler.py:376-574`). Evidence for WTC's uncleared state: adapter/contract always inject persistent P0/P1 warnings and require `tp_reconcile_ok` style provider signal before clearance (`docs/BOT_CONTROL_SAFETY_MODEL.md:117-134`, `docs/BOT_CONTROL_SAFETY_MODEL.md:202-237`, `docs/CONTRACTS/tortila-adapter.md:102-108`, `docs/CONTRACTS/tortila-adapter.md:533-536`). Recommendation: add explicit provider health/state fields and acceptance tests for TP reconciliation and margin preflight; only then update WTC warnings to clear conditionally. Target part: Tortila journal health contract, WTC warnings, acceptance tests.

8. Severity: Medium. Admin boundaries are mostly correct, but the latest metric snapshot card is not Tortila-specific. `/admin/bots` uses server-side admin gating and promises no keys/URLs/stack traces with live controls disabled (`apps/web/src/app/admin/bots/page.tsx`, `apps/web/src/features/admin/queries.ts:336-356`); Tortila journal health queries filter `target='tortila-journal'` (`apps/web/src/features/admin/queries.ts:375-414`). The latest metric snapshot query, however, reads the most recent `bot_metric_snapshots` row without product filtering (`apps/web/src/features/admin/queries.ts:415-424`), so a Legacy snapshot can appear in a mixed admin bot-health surface. Recommendation: split latest snapshot cards per product or join/filter through `bot_instances.productCode`. Target part: admin bots page/query.

9. Severity: Medium. Tortila settings row validation is incomplete for production operation. Tortila's own parser raises on malformed `SYMBOL_CONFIGS` entries and validates required fields, risk bounds, timeframe, duplicate symbols, and nonnegative TP (`..\bot_tortila\src\turtle_bot\config.py:66-125`). WTC form parsing silently skips invalid symbol rows and falls back to defaults if no valid rows survive (`apps/web/src/features/bots/config.ts:459-480`). Recommendation: surface row-level validation errors and block save/export when any submitted Tortila row is malformed; do not silently convert an intended profile into defaults. Target part: settings parser, settings page feedback.

10. Severity: Low. Health/statistics are useful but not full runtime observability. Tortila journal exposes decisions and safety activity (`..\bot_tortila\src\turtle_bot\journal\app.py:657-676`, `..\bot_tortila\src\turtle_bot\journal\app.py:809-840`), while WTC currently records adapter health and metric snapshots, not provider safety-event timelines. Recommendation: for a production settings/status page, add a read-only "last decisions / safety events / latest reconcile" panel sourced from persisted WTC snapshots, with no provider secrets and no direct exchange calls. Target part: worker, admin bots, user settings/status.

## Decisions
1. Treat Tortila integration as read-only and snapshot-backed for this phase.
2. Do not inspect `.env`, live DB contents, systemd state, or exchange APIs.
3. Do not run tests/builds because this lane must change exactly one handoff file and avoid generated artifacts.
4. Do not classify adjacent Tortila P0/P1 code as production-accepted merely because mitigation code exists. WTC still needs explicit provider state, acceptance evidence, and contract updates before warning clearance.
5. Treat current WTC settings as a safe draft/export surface, not live runtime control.

## Risks
1. If `BOT_ADAPTER_MODE=read-only` is enabled against an unauthenticated reachable journal, journal data can be read by any network path that reaches port 8080.
2. If users assume WTC settings are applied to the live Tortila runtime, they may trade under a different `.env` profile than the WTC UI displays.
3. If Tortila becomes per-user without changing snapshot scoping, users may see product-level/system-level metrics instead of their own exchange-account state.
4. If invalid Tortila symbol rows are silently dropped, a saved/exported profile can diverge from operator intent.
5. If P0/P1 warnings are cleared manually without journal-level proof, WTC may show a safe/healthy state while TP or margin protection remains unverified.
6. If admin latest snapshot remains cross-product, bot-health triage can misattribute the newest metric snapshot.

## Verification/tests
Gates run this session:

1. `git status --short` before audit edits: clean output observed.
2. `rg --files` inventory over WTC repo.
3. Targeted read-only `Get-Content` / `rg -n` inspection of WTC protocol, contracts, adapter, worker, DB schema/repos, web, admin, and settings files.
4. Read-only `Get-ChildItem ..\bot_tortila -Force` to verify adjacent repo exists. `.env` was observed as present but not opened.
5. Targeted read-only inspection of adjacent Tortila docs/source for runtime services, config, journal endpoints, safety nets, state model, and parser behavior.
6. `Test-Path docs\handoffs\20260603-tortila-bot-integration-auditor.md` before write: `False`.

Gates not run:

1. No npm/pnpm lint, typecheck, unit tests, or Playwright: no product code changed and this lane is read-only except the single handoff.
2. No worker tick: would mutate WTC DB health/snapshot tables.
3. No live journal HTTP probe: could touch a live service and auth/network state was not required for source mapping.
4. No bot start/stop/restart/status commands: prohibited by scope and bot-control safety model.
5. No `.env`, secret, DB, WAL, log, or screenshot inspection: prohibited or unnecessary for this read-only source audit.
6. No exchange/API calls and no `/api/marks` call: WTC contract excludes marks and exchange-owned data from WTC reads.

## Next actions
1. Add provider-side bearer auth to Tortila journal, with tests/proof for missing token 401, wrong token 401, valid token 200, and no token leakage in logs/errors.
2. Restrict journal port 8080 to WTC infrastructure before any production `BOT_ADAPTER_MODE=read-only` enablement.
3. Add `GET /api/config` JSON or equivalent current-runtime config snapshot so WTC can distinguish live runtime config from WTC saved drafts.
4. Decide Tortila ownership model: single shared managed strategy versus per-user exchange-account runtime. Update worker snapshot keys and web queries accordingly.
5. Replace silent Tortila settings row skipping with row-level validation errors and blocked save/export on malformed submitted rows.
6. Add read-only ingestion for provider decisions and safety/activity events if production settings/status must show operational runtime context.
7. Add explicit provider health/state fields for TP reconciliation and margin preflight clearance; update WTC warning logic only after acceptance evidence.
8. Filter `/admin/bots` latest metric snapshots by product or show one latest snapshot per bot product.
9. Keep live start/stop/apply-config disabled until security, bot-integration, entitlement, audit, and Tortila safety gates are all green in a dedicated phase handoff.
