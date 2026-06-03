# ecosystem-legacy-settings-auditor handoff
## Scope
Read-only inventory of the local legacy averaging bot configuration model under `C:\Users\maxib\GTE BOT\bot` and the related `trading-bot-server` copy.

## Files inspected
- `C:\Users\maxib\GTE BOT\bot\config.ini`
- `C:\Users\maxib\GTE BOT\bot\app.py`
- `C:\Users\maxib\GTE BOT\bot\database.py`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\services\bot_registry.py`
- `C:\Users\maxib\GTE BOT\bot\seed_data.json`
- Related server-copy files under `C:\Users\maxib\GTE BOT\trading-bot-server`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. The real legacy settings model is per-symbol and DB-backed, not one flat bot-level profile. It includes symbol, timeframe, RSI/CCI toggles and parameters, TP, initial entry, averaging depth, averaging drop ladder, averaging volume ladder, balance percent, leverage, active state, and stage. Recommendation: WTC settings must use per-symbol rows. Target part: legacy settings UI.
2. Severity: High. Stage configuration is a separate matrix of stage, RSI slots, and CCI slots per API account. Recommendation: WTC must expose stage/slot controls separately from symbol strategy rows. Target part: legacy settings UI.
3. Severity: Medium. Settings API replacement is whole-set per API account: updating settings deletes and recreates the submitted set. Recommendation: live apply must remain disabled until a safe adapter and safer update workflow are audited. Target part: legacy control safety.
4. Severity: Medium. Runtime reload semantics are mixed: some global symbol subscriptions come from startup config, while DB timeframes and per-symbol execution settings are re-read. Recommendation: WTC should label saved config as reference/export only. Target part: settings truth.
5. Severity: Medium. Local `bot` and `trading-bot-server` differ on delay/delta filters and signal semantics. Recommendation: represent delay/delta as optional/compat fields only, not as guaranteed live production fields. Target part: schema design.

## Decisions
- Model the WTC legacy config around API account, global engine defaults, per-symbol strategy rows, signal filters, position sizing, averaging ladder, and stage slots.
- Do not include exchange keys in any export, screenshot, log, DB config, or UI text.
- Keep live apply disabled.

## Risks
- `config.ini` and seed files contain secret-bearing fields; they must not be copied into WTC docs or exports.
- Newly added symbols may require a runtime restart in the original bot; WTC must not imply live hot-reload.

## Verification/tests
RUN: read-only file inventory, sanitized config/schema reads, model/schema/API route review, local-vs-related-copy comparison.

NOT RUN: DB writes, seed scripts, bot server startup, exchange calls, authenticated legacy API calls, or service restarts.

## Next actions
1. Replace the simplified legacy settings schema with a per-symbol/stage/ladders WTC reference model.
2. Add validation for symbol, timeframe, averaging drop/volume list lengths, and stage slots.
3. Export safe JSON only, with no secrets and no live-apply token.
