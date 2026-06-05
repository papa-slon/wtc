# ecosystem-bot-integration-auditor handoff
## Scope
Read-only Phase 1.5+ discovery lane for the WTC Legacy Bot integration.

Scope covered:
- Local WTC repo process truth, current Legacy contracts/adapters, worker snapshots, web settings/statistics/admin surfaces, and DB tables.
- Adjacent Legacy bot workspace at `C:\Users\maxib\GTE BOT\bot`, focused on config inputs, RSI/CCI indicators, averaging ladders, stages/slots, exchange-key handling, lifecycle start/test/health, order reconciliation, snapshots/statistics, and safety boundaries.
- Premium settings/statistics page gaps for Legacy.

Explicitly not done:
- No live server mutation.
- No Legacy bot start/stop/restart/retest/apply-config.
- No tmux/systemd/process control.
- No exchange/API calls.
- No DB mutations or migrations.
- No secret-bearing config or environment values copied into this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/20260603-1305-ecosystem-bot-integration-auditor.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py`
- `C:\Users\maxib\GTE BOT\bot\services\client_registry.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py`
- Adjacent file inventory under `C:\Users\maxib\GTE BOT\bot` was listed. Secret-bearing local `config.ini`, `.env`, and seed credential values were not copied.

## Files changed
- `docs/handoffs/20260603-legacy-bot-integration-auditor.md`

## Findings
1. Severity: CRITICAL. Legacy is an exchange-active trading runtime, not just a settings/statistics provider. Evidence: `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:101`-`145` builds RSI/CCI signals from kline data and dispatches them; `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:150`-`178` loads per-symbol settings into a `TradingBot` and calls `open_position`; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:206`-`380` sets leverage, checks slot/stage limits, places the market buy, then places TP and averaging orders; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:598`-`649` reconciles open orders, averaging fills, and TP fills; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:391`-`417`, `426`-`448`, and `496`-`545` contain real place/cancel/close/leverage exchange methods. Recommendation: keep all WTC Legacy pages read-only/reference/export only; do not expose start/stop/retest/apply-config or exchange actions from WTC. Target part: WTC bot dashboard, settings page, admin bots, worker, adapter boundary.

2. Severity: CRITICAL. Provider-side Legacy stores and uses exchange credentials; WTC must never select, store, render, log, fixture, or export them. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91`-`106` defines `api_key`, `secret_key`, `pub_id`, running, balance, and quarantine fields; `C:\Users\maxib\GTE BOT\bot\models.py:497`-`502` inserts raw `api_key`/`secret_key`; `C:\Users\maxib\GTE BOT\bot\services\client_registry.py:34`-`46` fingerprints raw credentials for client reuse/change detection; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:102`-`133` stores credentials and sends the API key header; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:160`-`181` signs private requests. WTC-side mitigation exists: `apps/worker/src/legacy-live.ts:127`-`132` rejects selected secret-looking fields; `apps/worker/src/legacy-live.ts:317`-`370` selects only whitelisted account/settings/stage/slot/order columns; `packages/bot-adapters/src/warnings.ts:59`-`68` surfaces the provider-side credential risk. Recommendation: keep direct HTTP blocked; use only safe-column DB snapshots; add column-restricted DB role proof before deeper production acceptance. Target part: Legacy worker query, admin diagnostics, screenshots, exports, retained evidence.

3. Severity: HIGH. The accepted WTC live-read integration is provider Postgres safe columns -> WTC worker snapshot -> WTC Postgres -> WTC web/admin UI; direct Legacy HTTP/control remains blocked. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:24`-`36` defines WTC as read-only, using provider safe columns by `pub_id`; `docs/PRODUCTION_BLOCKERS_CURRENT.md:5`-`14` records the Phase 3.68 canary path and says it does not clear full production readiness; `packages/bot-adapters/src/factory.ts:32`-`39` ignores `legacyBaseUrl` and returns a blocked adapter in non-mock modes; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1`-`16` says no code path can reach the Legacy plaintext-key endpoint; `apps/worker/src/index.ts:206`-`218` calls `snapshotLegacyBotPostgres`; `apps/web/src/features/bots/data.tsx:147`-`149` enables DB snapshot mode for `legacy_bot` in production non-mock. Recommendation: keep the DB snapshot path as the only production Legacy read path; treat direct HTTP/control as a separate, still-blocked adapter project. Target part: adapter factory, worker, canary deploy/runbook, contracts.

4. Severity: HIGH. `pub_id` is the Legacy provider account/runtime identity, but WTC still needs normalized provider-account ownership and entitlement scoping. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91`-`106` defines `Api_Key.pub_id`; `C:\Users\maxib\GTE BOT\bot\models.py:519`-`524` loads APIs by `pub_id`; `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py:201`-`239` keys live bots by `api.pub_id`; `apps/worker/src/legacy-live.ts:317`-`330` reads either a single `LEGACY_API_ID` or up to 20 running provider accounts; `apps/worker/src/legacy-live.ts:413`-`420` stores those rows under one WTC bot instance/system owner; `apps/web/src/app/admin/bots/page.tsx:219`-`245` renders a full admin `pub_id` inspector. Recommendation: add a normalized `bot_provider_accounts` or equivalent mapping from WTC user/entitlement/bot instance to provider `pub_id`; user pages must show only mapped accounts, while admin can inspect masked or explicitly authorized full IDs. Target part: DB model, worker scoping, user bot pages, admin bots.

5. Severity: HIGH. Legacy settings include per-symbol RSI/CCI, delay/delta filters, sizing, leverage, take-profit, averaging ladders, and stage assignment; stages and slots are operational capacity, not decoration. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:126`-`156` defines symbol settings including timeframe, RSI/CCI thresholds, delay/delta, TP, entry %, averaging levels/ladders, balance %, leverage, active, and stage; `C:\Users\maxib\GTE BOT\bot\models.py:168`-`192` defines stage capacities and active slot uniqueness; `C:\Users\maxib\GTE BOT\bot\models.py:200`-`208` maps RSI/YELLOW and CCI/RED slot limits; `C:\Users\maxib\GTE BOT\bot\models.py:286`-`329` gates stage admission and stuck slots; `C:\Users\maxib\GTE BOT\bot\models.py:412`-`448` moves later-stage slots/orders down after slot close. WTC now reads/maps this data in `apps/worker/src/legacy-live.ts:178`-`260` and exposes settings controls in `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:108`-`220`, with stage capacity table at `228`-`247`. Recommendation: premium settings/statistics should keep stage capacity, active slots, active orders, and per-symbol ladder coverage first-class. Target part: settings cards, operations panel, statistics page.

6. Severity: HIGH. Legacy source can represent both RSI and CCI flags per symbol, but WTC intentionally enforces one visible trigger per coin; this policy must be explicit because it is not a provider-runtime limitation. Evidence: source ORM defaults both flags true at `C:\Users\maxib\GTE BOT\bot\models.py:145`-`146`; provider request schema supports both fields at `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py:19`-`32`; source signal lookup independently checks RSI and CCI at `C:\Users\maxib\GTE BOT\bot\models.py:791`-`803`; WTC validation rejects equal `useRsi`/`useCci` and says choose exactly one at `apps/web/src/features/bots/config.ts:67`-`102`; WTC UI copy says one coin uses one trigger at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:68`-`77` and renders only RSI/CCI options at `129`-`142`. Recommendation: keep one-trigger UI if this is the operator-approved risk-reduction policy, but document it as WTC policy; if runtime parity is required later, add an explicit dual-signal mode with warnings and slot-capacity impact. Target part: settings schema, product copy, config export, tests.

7. Severity: HIGH. Legacy lifecycle endpoints are mutation/control-adjacent and must remain out of WTC. Evidence: `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:19`-`27` creates an API key and starts infra; `33`-`42` deletes an API key and cleans up infra; `60`-`90` patches credentials/market, stops/starts infra, and rotates credentials; `93`-`126` writes stage/settings; `129`-`170` retests credentials, unquarantines, and restarts live infra. WTC hard control gate exists in `packages/bot-adapters/src/control.ts:1`-`18`; admin UI says no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:30`-`43` and renders live control disabled at `91`-`118`; user bot page disables start/stop at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239`-`266`. Recommendation: any future apply/retest/control phase must be new, audited, diff-reviewed, RBAC/CSRF/entitlement gated, append-only audited, and explicitly separate from the current read-only canary. Target part: bot controls, settings save/apply, admin operations.

8. Severity: HIGH. Legacy statistics are operational snapshots today, not closed-trade/equity performance analytics. Evidence: `docs/CANONICAL_ANALYTICS_MODEL.md:34`-`40`, `52`-`55`, `65`-`89`, `97`-`108` mark most Legacy PnL/ROI/drawdown/trade/open-risk metrics unavailable; display rule at `docs/CANONICAL_ANALYTICS_MODEL.md:164`-`170` requires unavailable metrics to show `N/A` or `-`, not zero; contract says active slots are approximate and no closed trades exist at `docs/CONTRACTS/legacy-bot-adapter.md:280`-`313`; worker intentionally writes only wallet equity and leaves PnL/risk fields undefined at `apps/worker/src/legacy-live.ts:425`-`440`; active slots are mapped to approximate positions with `markPrice = avgEntry` and `unrealizedPnl = 0` at `apps/worker/src/legacy-live.ts:263`-`295`. Phase 3.69 improved Legacy operations cards at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:318`-`324` and `apps/web/src/features/bots/statistics-panels.tsx:451`-`600`, but `apps/web/src/features/bots/data.tsx:413`-`421` still computes generic metrics from available rows. Recommendation: add a Legacy capability mask/null override so closed PnL, net PnL, unrealized, ROI, win rate, profit factor, drawdown, expectancy, fees, funding, and open risk cannot render as authoritative zeros. Target part: read model, metrics cards, advanced panels, tests.

9. Severity: MEDIUM. Current settings save path can silently drop invalid Legacy rows and fall back to defaults, which is not premium enough for a high-risk averaging bot. Evidence: `apps/web/src/features/bots/config.ts:383`-`415` pushes only successfully parsed rows and returns defaults if none survive; `apps/web/src/features/bots/config.ts:418`-`427` parses stage rows similarly; settings action silently returns on schema failure at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:67`-`79`; provider settings endpoint rejects averaging count mismatches at `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:111`-`123`. Recommendation: premium settings page should show row-level validation errors, preserve invalid user input for correction, and block save/export instead of defaulting silently. Target part: settings server action, form state/error UI, config tests.

10. Severity: MEDIUM. Delay/delta filters are present in source and WTC mapping, but the premium UI still underrepresents the on/off state. Evidence: source settings include `use_delay_filter`, `delay_bars`, `use_delta_filter`, `delta_filter` at `C:\Users\maxib\GTE BOT\bot\models.py:140`-`143`; WTC worker reads them with compatibility fallbacks at `apps/worker/src/legacy-live.ts:311`-`343`; WTC schema validates them at `apps/web/src/features/bots/config.ts:86`-`89`; the visible card includes delay bars and delta filter values but hides the enable flags as hidden inputs at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:211`-`220`. Recommendation: add visible toggles/badges for delay and delta filters, and show their effect in the export preview. Target part: premium settings page, config export.

11. Severity: MEDIUM. The DB/worker snapshot path is safer than HTTP, but column-restricted provider DB role proof and longer burn-in remain open. Evidence: production blockers say the accepted read surface is worker DB snapshot with safe-column SQL only, while direct HTTP/control remains blocked at `docs/PRODUCTION_BLOCKERS_CURRENT.md:96`-`101`; Phase 3.69 handoff lists column-restricted Legacy DB role proof as not run at `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:86`-`97`; env validation requires `LEGACY_DATABASE_URL` and system owner/instance only when live reads are enabled at `packages/config/src/env.ts:121`-`127`; worker stores redacted errors at `apps/worker/src/legacy-live.ts:93`-`107` and `500`-`508`. Recommendation: provision/read with a restricted provider DB role, run a values-hidden privilege proof, then burn in worker freshness and secret-scan retained evidence. Target part: devops/security gate, worker deploy acceptance.

12. Severity: LOW. Current export path is appropriately safe/reference-only, but it should become an operator review artifact before any future live apply. Evidence: settings page says export has no exchange keys and applies nothing live at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:184`-`190`; export route enforces user/session/entitlement at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:8`-`24`; Legacy export warning says no exchange keys and no live apply token at `apps/web/src/features/bots/config.ts:561`-`600`; WTC config saves are versioned and audited but never forwarded to the live bot at `packages/db/src/repositories.ts:1677`-`1690`. Recommendation: for premium settings, add a review/diff tab comparing WTC reference config to latest provider snapshot, still with no live apply. Target part: settings UX, audit trail.

## Decisions
- Treat Legacy as a live exchange-active averaging bot. WTC integration remains read-only snapshot/config visibility only.
- Treat `Api_Key.pub_id` as the provider account/runtime identity; do not confuse it with WTC user ids or Legacy `User.public_id`.
- Keep direct Legacy HTTP and all live control paths blocked. The only accepted live-read path is provider DB safe columns through the worker.
- Keep WTC-side settings as reference/export/version history only. Saving WTC settings does not apply them to the running Legacy bot.
- Treat WTC's one-trigger-per-coin UI as a risk-reduction product policy, not as a provider-runtime fact.
- Treat active slots/orders as operational state proxies. They are not proof of exchange-confirmed open risk, current mark price, closed trades, or performance history.
- Do not expose or copy local secret-bearing values from adjacent bot config/seed/env files.

## Risks
- Without normalized provider-account ownership mapping, a system-owned snapshot can aggregate multiple Legacy `pub_id` rows and make user scoping ambiguous.
- Provider-side plaintext exchange credentials remain present in Legacy code/data model; WTC mitigates by not selecting them, but the provider-side issue is not remediated.
- Active-slot projections can be mistaken for exchange-confirmed positions unless UI labels stay explicit.
- Generic metrics code can turn missing Legacy performance sources into zero-like values unless Legacy-specific masking is enforced throughout.
- Future live apply is high risk because provider settings/stage endpoints mutate whole runtime collections and credential/mode endpoints can start/stop/rotate live infrastructure.
- Column-restricted Legacy DB-role proof and long burn-in are still missing, so this should not be called final production readiness.

## Verification/tests
RUN:
- Required protocol/source docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, current status/action docs, recent Legacy phase handoffs.
- Static WTC source inspection for Legacy worker, adapter, settings, statistics, admin, DB schema/repositories, config env, and tests.
- Static adjacent Legacy source inspection for models, API routes/schemas, indicators, trading logic, bot/client registry, and BingX client.
- `git status --short --branch` before writing: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603`, no dirty entries observed.
- Handoff file existence check before writing: target did not exist.

NOT RUN:
- `npm test`, Vitest, lint, typecheck, build, Playwright: not run because this was a read-only discovery lane with only the requested handoff write.
- Live Legacy endpoint calls, database queries, worker tick, server deploy, SSH, tmux, systemd, Docker, process control: not run by policy.
- Legacy start/stop/retest/apply-config/credential rotation: not run and remains forbidden.
- Exchange/BingX calls: not run.
- Provider DB role/column privilege proof: not run; gap remains.
- Background agent fan-out: not run in this lane because the operator directly assigned this session to `ecosystem-bot-integration-auditor`; no additional agents were spawned and none are left running.

## Next actions
1. Add normalized Legacy provider-account ownership: map WTC user/entitlement/bot instance to provider `pub_id`; require that mapping for user-facing snapshots.
2. Provision or prove a column-restricted Legacy DB role that can read only the safe columns selected by `apps/worker/src/legacy-live.ts`; retain values-hidden proof.
3. Add a Legacy metric availability mask/null override in the read model and UI so unsupported performance fields cannot render as zero-like facts.
4. Add row-level settings validation with visible errors and no silent fallback to defaults.
5. Add visible delay/delta filter toggles and filter-state badges in the premium settings page.
6. Add a provider snapshot vs WTC reference diff/review tab for settings/export, still with no live apply.
7. Add tests for `pub_id` scoping, secret-field exclusion, unsupported metric masking, approximate-position labeling, one-trigger policy, delay/delta visibility, and row-level validation.
8. Keep live apply/retest/start/stop as a separate future phase gated by security, bot-integration, exchange-safety, audit, CSRF/RBAC/entitlement, and explicit operator approval.
