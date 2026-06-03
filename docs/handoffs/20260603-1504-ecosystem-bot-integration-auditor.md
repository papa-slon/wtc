# ecosystem-bot-integration-auditor handoff
## Scope
Phase 3.69 read-only audit of the Legacy averaging bot at `C:\Users\maxib\GTE BOT\bot` for WTC integration. Focus areas: complete trading flow, runtime state, settings and symbol settings model, RSI/CCI behavior, stage/slot/averaging configuration, `pub_id` identity, admin/user visibility, and the data WTC can safely expose without exchange secrets.

No product code was modified. No Legacy server, worker, exchange client, browser, database mutation, or live bot control path was started.

## Files inspected
- `AGENTS.md` instructions supplied by the operator in the session prompt.
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/analytics/src/metrics.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot\config.ini` redacted secret-bearing section only.
- `C:\Users\maxib\GTE BOT\bot\seed_data.json` redacted credential fields only.
- `C:\Users\maxib\GTE BOT\bot\app.py`
- `C:\Users\maxib\GTE BOT\bot\database.py`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\sqlalchemy_enums.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py`
- `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py`
- `C:\Users\maxib\GTE BOT\bot\services\client_registry.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\core.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\bot\scripts\init_db.py`

## Files changed
None — read-only audit

## Findings
1. **CRITICAL - Legacy is a live exchange-active trading engine, not only a settings source.** Evidence: `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:101-145` computes RSI/CCI signals from live kline data; `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:150-182` dispatches signals into `TradingBot.open_position`; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:206-375` sets leverage, places the market entry, take-profit order, and averaging ladder; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:495-563` recalculates TP after averaging fills; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:686-723` reconciles private order updates; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:391-448` contains real place/cancel/close exchange methods. Recommendation: WTC settings and statistics UI must stay read-only/reference/export only for Legacy; keep start/stop/retest/apply disabled until a separate audited control adapter exists. Target: WTC bot overview, settings save flow, operations panel, admin controls.

2. **CRITICAL - Provider-side exchange secrets are stored and used by Legacy and must never cross into WTC.** Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91-96` stores `api_key` and `secret_key`; `C:\Users\maxib\GTE BOT\bot\config.ini:24-26` has an API key/secret section; `C:\Users\maxib\GTE BOT\bot\seed_data.json:1-7` contains credential-bearing seed rows; `C:\Users\maxib\GTE BOT\bot\services\client_registry.py:25-35` fingerprints raw credentials; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:102-123` stores keys on the exchange client; `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py:160-181` signs private requests. Recommendation: WTC may expose only whitelisted non-secret DB columns; never expose API keys, secret keys, DB URLs, JWTs, access tokens, refresh tokens, listen keys, signatures, client fingerprints, provider passwords, or unredacted logs/errors. Target: worker queries, admin diagnostics, exports, screenshots, fixtures.

3. **HIGH - The current WTC safe-column DB snapshot boundary is the right integration boundary.** Evidence: `apps/worker/src/legacy-live.ts:16-75` defines safe account/settings/stage/slot/order row shapes; `apps/worker/src/legacy-live.ts:89-104` redacts secret-like error details; `apps/worker/src/legacy-live.ts:123-131` rejects secret field names; `apps/worker/src/legacy-live.ts:278-331` selects whitelisted columns only; `apps/worker/src/legacy-live.ts:338-452` records read-only snapshots and health; `tests/integration/legacy-live-worker-static.test.ts:146-162` asserts serialized payloads and SQL do not include secret fields. Recommendation: keep Legacy direct HTTP/control blocked and use safe DB snapshots only; extend via explicit `pub_id` mapping, not by relaxing the whitelist. Target: `apps/worker/src/legacy-live.ts`, adapter tests, admin health.

4. **HIGH - `pub_id` is the canonical Legacy account/runtime identity and must not be confused with user `public_id`.** Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91-106` defines `Api_Key.pub_id`; `C:\Users\maxib\GTE BOT\bot\models.py:497-506` creates the `pub_id`; `C:\Users\maxib\GTE BOT\bot\models.py:519-524` loads APIs by `pub_id`; `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py:168-182` builds bots from `api.pub_id`; `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py:201-239` keys `live_bots` by `pub_id`; `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py:279-297` starts runtime by `pub_id`; `apps/worker/src/legacy-live.ts:374-383` can filter snapshots by `LEGACY_API_ID`. Recommendation: WTC should map each WTC bot instance and user entitlement to one explicit provider `pub_id`; user UI should show only the mapped account and preferably a masked/alias form, while admin UI may show masked `pub_id` plus counts. Target: WTC bot instance metadata, entitlement checks, admin bot health.

5. **HIGH - Legacy user visibility is ownership-based; the apparent admin helper is not reliable source evidence.** Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:83-88` defines `User` without a `role` column; `C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py:63-72` checks `user.role == "admin"` in a helper that the model does not support; `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:33-57` checks ownership for delete/detail; `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:60-90` checks ownership for updates and credential rotation; `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:93-126` checks ownership before stage/settings writes; `C:\Users\maxib\GTE BOT\bot\models.py:541-570` scopes list/update/delete helpers by `user_id`. Recommendation: WTC user views must be WTC entitlement/user scoped and must not enumerate provider DB accounts globally; WTC admin views should use WTC RBAC only and show aggregate safe state, masked identities, and redacted quarantine reasons. Target: user bot pages, admin bot health, legacy snapshot ownership mapping.

6. **HIGH - RSI and CCI are not mutually exclusive in runtime.** Evidence: `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py:10-35` exposes both `use_rsi` and `use_cci`; `C:\Users\maxib\GTE BOT\bot\models.py:126-158` stores both flags; `C:\Users\maxib\GTE BOT\bot\models.py:145-146` defaults both ORM flags to true; `C:\Users\maxib\GTE BOT\bot\models.py:755-842` can emit RSI (`YELLOW`) or CCI (`RED`) signals; `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:135-145` runs RSI and CCI scans separately; `apps/web/src/features/bots/config.ts:67-101` allows both and rejects only both false; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:52-103` offers `RSI`, `CCI`, and `RSI + CCI`. Recommendation: do not force mutual exclusivity unless the operator intentionally chooses a risk-reduction policy; instead keep the segmented signal control, label `YELLOW = RSI` and `RED = CCI`, reject both false, and warn that `Both` means two independent trigger paths sharing one active slot guard. Target: Legacy settings table, validation copy, tests.

7. **HIGH - Stage/slot/averaging configuration is core runtime state and should be visible as operational coverage, not just form fields.** Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:168-192` defines `StageConfig` and `Slot`; `C:\Users\maxib\GTE BOT\bot\models.py:200-208` maps RSI to `rsi_slots` and CCI to `cci_slots`; `C:\Users\maxib\GTE BOT\bot\models.py:264-283` closes slots and triggers compaction; `C:\Users\maxib\GTE BOT\bot\models.py:320-367` gates later stages until previous stages are stuck; `C:\Users\maxib\GTE BOT\bot\models.py:412-448` moves later-stage slots/orders down; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:218-345` reserves slots and creates averaging ladders; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:621-628` increments averaging count on fills. Recommendation: WTC settings/statistics should show stage capacity by RSI/CCI, active slot occupancy, per-symbol assigned stage, headroom, and stuck criteria such as `averaging_count >= averaging_levels`; position rows should show stage, reason, averaging count, TP coverage, and averaging order coverage. Target: `LegacyOperationsPanel`, position tables, settings stage matrix.

8. **MEDIUM - WTC Legacy positions are approximate provider-DB projections, not exchange-confirmed positions.** Evidence: `apps/worker/src/legacy-live.ts:226-255` builds positions from active slots/orders and sets `markPrice` to the estimated entry; `docs/CONTRACTS/legacy-bot-adapter.md:271-288` states active slots are only a proxy; `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:598-649` shows reconciliation depends on exchange order state; `tests/integration/legacy-live-worker-static.test.ts:124-139` confirms the approximation behavior. Recommendation: Legacy position UI should label rows as approximate, mark `mark price`, `unrealized PnL`, `notional/open risk`, and true exchange exposure as unavailable, and avoid presenting `markPrice = entry` as a market quote. Target: read model, statistics page, open risk panel, position detail copy.

9. **HIGH - Legacy performance statistics are mostly unavailable, but the generic WTC metrics path can make zeros look authoritative.** Evidence: `docs/CANONICAL_ANALYTICS_MODEL.md:32-40` marks wallet/equity partial; `docs/CANONICAL_ANALYTICS_MODEL.md:50-55` marks ROI unavailable; `docs/CANONICAL_ANALYTICS_MODEL.md:65-89` marks drawdown and trade metrics unavailable; `docs/CANONICAL_ANALYTICS_MODEL.md:106-109` marks open risk unavailable; `docs/CANONICAL_ANALYTICS_MODEL.md:164-170` requires unavailable values to display `N/A` or `-`; `apps/web/src/features/bots/data.tsx:375-423` still computes generic metrics from balance/empty trade data; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:306-317` renders generic metric cards; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:105-115` renders generic overview metrics; `packages/analytics/src/metrics.ts:147-231` turns missing trade series into zero-like metrics. Recommendation: add a Legacy capability mask/null override so closed PnL, net PnL, unrealized, ROI, win rate, profit factor, drawdown, expectancy, fees, funding, and open risk display as unavailable; show wallet balance snapshots, running/quarantine status, active slots, and stage/order coverage instead. Target: `loadBotReadModel`, overview cards, statistics page, analytics panels.

10. **MEDIUM - Legacy mode should not be shown as confirmed live/demo from current source evidence.** Evidence: `C:\Users\maxib\GTE BOT\bot\sqlalchemy_enums.py:22-24` distinguishes exchange market enum values, not account live/demo mode; `apps/web/src/features/bots/data.tsx:403-413` forces Legacy `configView.mode` to `live`; `docs/CONTRACTS/legacy-bot-adapter.md:248-269` treats several runtime metrics as unavailable or approximate. Recommendation: show `provider DB snapshot` or `mode unknown` and display the provider market separately, for example `BINGX`; do not label the account `live` unless a verified source distinguishes live/demo. Target: config view, bot overview, statistics header.

11. **MEDIUM - Delay and delta filters are safe Legacy settings but are underexposed in the current settings UI.** Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:140-143` stores `use_delay`, `delay_bars`, `use_delta`, and `delta`; `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py:19-30` accepts the same fields; `apps/worker/src/legacy-live.ts:44-48` reads them and `apps/worker/src/legacy-live.ts:205-208` maps them into live config; `apps/web/src/features/bots/config.ts:85-88` validates them and `apps/web/src/features/bots/config.ts:406-409` parses them, but `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:52-137` does not render controls or badges for them. Recommendation: add a compact advanced-filter disclosure or columns for delay/delta state so exported settings and visible settings match the provider model. Target: Legacy settings table, config export review UI.

12. **MEDIUM - Current WTC form parsing can silently drop invalid Legacy symbol rows.** Evidence: `apps/web/src/features/bots/config.ts:382-413` pushes parsed rows only on success and falls back to defaults if no rows survive; `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:111-121` rejects averaging list length mismatches at the provider API. Recommendation: surface row-level validation errors and block save/export when symbol rows or averaging CSV counts are invalid; do not silently replace user input with defaults. Target: settings form actions, validation messages, tests.

13. **LOW - Some Legacy UI copy now blurs DB live-read status with direct HTTP/control blocking.** Evidence: `apps/web/src/features/bots/statistics-panels.tsx:459-464` shows `live reads blocked`; `packages/bot-adapters/src/factory.ts:27-39` blocks direct Legacy HTTP adapters; `docs/CONTRACTS/legacy-bot-adapter.md:24-36` allows safe DB snapshot reads; `docs/CONTRACTS/legacy-bot-adapter.md:394-409` keeps real HTTP/control blocked. Recommendation: use separate labels such as `DB snapshot read: ok/stale/not configured` and `direct HTTP/control: blocked`. Target: Legacy operations panel and health pill copy.

## Decisions
- Treat Legacy as a live exchange-active runtime; WTC Phase 3.69 should expose read-only state and reference settings only.
- Treat `Api_Key.pub_id` as the provider account/runtime identity. Treat `User.public_id` as provider user ownership identity. Do not conflate them.
- Keep the Legacy integration boundary at safe-column DB snapshots plus WTC-side reference config/export. Do not use Legacy direct HTTP endpoints or live control endpoints for WTC user/admin workflows.
- Treat RSI and CCI as independently enabled signal paths. WTC may support `RSI`, `CCI`, and `RSI + CCI`, but must make the `Both` behavior explicit.
- Treat active slots/orders as operational state proxies. Do not treat them as confirmed exchange positions or performance history.
- Treat Legacy statistics as health, balance snapshot, stage/slot coverage, and order coverage until a trade-history/equity source is implemented.

## Risks
- If WTC reads all running Legacy accounts into one system-owned snapshot without explicit user/bot-instance to `pub_id` mapping, users or admins may see aggregate state that is not correctly scoped.
- If unsupported Legacy metrics are rendered as `0`, users may interpret missing trade/equity data as real performance.
- If direct HTTP, provider config files, seed data, DB URLs, or raw error payloads are exposed, exchange secrets can leak into WTC pages, logs, fixtures, exports, or screenshots.
- If `retest`, start, stop, rotate credentials, or apply-config endpoints are exposed prematurely, WTC can mutate private WebSocket/runtime state or exchange-adjacent state.
- If a symbol has both RSI and CCI enabled, duplicate signal attempts can increase slot/capacity pressure even though the active-slot uniqueness guard blocks a second active position for the same symbol.
- Future live config apply is risky because Legacy settings/stage writes replace whole setting collections; any control adapter would need diff review, transaction boundaries, audit logs, entitlement checks, and explicit confirmation.

## Verification/tests
- RUN: static source inspection of the WTC files and Legacy files listed above.
- RUN: redacted inspection of secret-bearing Legacy `config.ini` and `seed_data.json`; raw credential values were not copied into this handoff.
- RUN: `git status --short --branch` before writing the handoff. Pre-existing unrelated dirty files were observed in `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`, `apps/web/src/features/bots/config.ts`, `apps/worker/src/legacy-live.ts`, plus an untracked UX handoff; this auditor did not modify them.
- NOT RUN: npm, Vitest, Playwright, build, database migrations, worker execution, Legacy server startup, Legacy bot runtime, exchange/client calls, live DB queries. Reason: read-only auditor lane with no product-code edits and no live server mutation during discovery.
- NOT RUN: background agent fan-out. Reason: this session prompt assigned this lane directly as `ecosystem-bot-integration-auditor`; no additional agents were spawned, so none remained open.

## Next actions
1. Add an explicit Legacy `pub_id` mapping between WTC bot instances, WTC users/entitlements, and provider accounts; require the mapping for user-facing snapshots.
2. Add a Legacy metric availability mask in the read model and UI so unsupported performance metrics render as `N/A` or are replaced by Legacy operational panels.
3. Update Legacy statistics copy to separate safe DB snapshot reads from blocked direct HTTP/control paths.
4. Update Legacy position/open-risk rendering to label active-slot projections as approximate and hide or mark unavailable true mark price, unrealized PnL, and open risk.
5. Extend the Legacy settings UI to expose safe delay/delta filter fields and to show stage capacity, active slot occupancy, stuck state, and TP/averaging order coverage.
6. Add row-level validation errors for Legacy symbol settings instead of silently dropping invalid rows.
7. Add tests for `RSI + CCI` behavior, unsupported metric masking, `pub_id` scoping, safe export without secret fields, Legacy mode labeling, and exact warning labels for DB snapshot versus direct-control blocking.
