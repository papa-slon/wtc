# bot-settings-truth-auditor handoff
## Scope
Read-only Phase 3.73 audit of Legacy/Tortila settings and statistics truth boundaries. Focus: what the UI may honestly claim today about Legacy provider snapshots, Tortila DB-backed read-only data, saved WTC configs, defaults, missing provider mappings, and disabled live control. No live bot, SSH, tmux, systemd, exchange, provider DB, `.env`, or live control path was started, stopped, probed, or mutated.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/lib/format.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0019_freezing_beyonder.sql`

## Files changed
- `docs/handoffs/20260603-1840-bot-settings-truth-auditor.md` (this handoff only)

## Findings
1. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:123`-`127` makes the Legacy provider snapshot override saved WTC config as the editable `cur`; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:52`-`54` defaults the source label to "WTC reference profile"; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:286` renders the table without overriding that label; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:237`-`242` says the export downloads saved WTC reference settings while `apps/web/src/app/api/bots/[bot]/config-export/route.ts:20`-`27` exports `liveConfig ?? state.current`. Recommendation: split Legacy provider snapshot display from saved WTC reference editing/export, or add an explicit "copy provider snapshot into WTC reference" action plus source-aware export labels. Target part: Legacy settings and config export.
2. Severity: High. Evidence: `apps/web/src/features/bots/config.ts:596`-`619` falls back to `LEGACY_SYMBOL_DEFAULTS`, and `apps/web/src/features/bots/config.ts:622`-`629` falls back to default stage rows; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:226`-`231` feeds `legacyLiveConfig ?? configState?.current`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:374`-`375` always renders `LegacyOperationsPanel`; `apps/web/src/features/bots/statistics-panels.tsx:556`-`560` shows an "ok" `DB live-read` pill even when rows may be saved/default config rather than provider snapshot rows. Recommendation: make Legacy config parsing source-aware; for provider/runtime snapshot paths, empty/missing rows must render "no provider config rows in latest snapshot" instead of defaults, and the DB live-read pill should require actual provider snapshot data. Target part: Legacy statistics operations panel and defaults handling.
3. Severity: High. Evidence: `apps/worker/src/legacy-live.ts:565`-`578` records Legacy health as `healthy` when provider DB scoped reads succeed and accounts are seen, while `apps/web/src/features/bots/meta.ts:105`-`108` maps readState `ok` plus status `healthy` to the UI label "Healthy". Phase 3.72 explicitly did not collect live bot continuity proof; DB rows prove WTC read success and provider `running` flags, not end-to-end bot/process/exchange health. Recommendation: reserve "Healthy" for audited health evidence; label this state as "DB snapshot ok" or "provider running flag observed", and keep it neutral/degraded when only Legacy DB snapshots exist. Target part: Legacy worker health detail and bot status pill.
4. Severity: Medium. Evidence: `apps/web/src/features/bots/data.tsx:495`-`503` hardcodes `mode: productCode === 'legacy_bot' ? 'live' : 'unknown'`, but `docs/CONTRACTS/legacy-bot-adapter.md:227`-`230` and `docs/CONTRACTS/legacy-bot-adapter.md:248`-`269` say Legacy mode is not exposed and must be `unknown`. Recommendation: set Legacy config/metrics mode to `unknown` and carry provider market/read source separately, so "live" is never inferred from DB snapshot availability. Target part: Legacy read-model config transformation.
5. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:239` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:269` sum missing bot wallet metrics as `0` and display a single total, while `docs/CANONICAL_ANALYTICS_MODEL.md:240` and `docs/CANONICAL_ANALYTICS_MODEL.md:248`-`259` require unavailable values to remain N/A/null and combined wallet equity to show per-bot contribution/breakdown. Recommendation: display portfolio wallet equity as N/A or partial when no contributing metric exists, and show Tortila/Legacy contributors so unknown data is not silently converted into `$0.00`. Target part: bot statistics portfolio snapshot.

## Decisions
1. Legacy runtime facts are correctly hidden unless exactly one active WTC `legacy_bot` / `legacy-db` provider-account mapping exists for the user bot instance; see `apps/web/src/features/bots/data.tsx:312`-`344` and `packages/db/src/repositories.ts:1686`-`1702`.
2. Legacy worker scoping is directionally correct: it iterates active mappings, reads each provider `pub_id`, and writes snapshots with `botProviderAccountId`; see `apps/worker/src/legacy-live.ts:516`-`539` and `apps/worker/src/legacy-live.ts:414`-`416`.
3. Live control remains visibly disabled in the bot room and settings surfaces; this matches `docs/BOT_INTEGRATION_PLAN.md:9`-`14`.
4. Tortila private exchange-key UI is honest today: it shows encrypted key inventory and keeps connection testing disabled until a read-only exchange ping adapter passes audit.

## Risks
1. Users may confuse a Legacy provider snapshot rendered in an editable form with a saved WTC reference config or with proof that WTC can apply that config to the live bot.
2. Default Legacy rows can mask missing provider snapshot data and make statistics coverage look more complete than it is.
3. "Healthy" and "live" labels can be quoted later as runtime proof even though this phase has only DB snapshot/read-state evidence.
4. Portfolio totals can understate uncertainty by converting missing bot metrics into zero.

## Verification/tests
RUN:
1. Static source/docs inspection only.

NOT RUN:
1. `npm test`, typecheck, lint, Playwright, or DB gates - not run because this lane was a read-only truth audit and no product code changed.
2. Live Legacy/Tortila bot start, stop, restart, retest, apply-config, SSH, tmux, systemd, exchange API, provider DB, `.env`, or live control path checks - forbidden by scope and not run.
3. Runtime browser screenshots - not run because this audit did not start or probe the app/server.

## Next actions
1. Add a source-aware Legacy config view model: `provider_snapshot`, `wtc_reference`, `defaults`, or `none`.
2. Prevent default rows from being used in provider/runtime snapshot displays; defaults are valid only for WTC reference drafts/presets.
3. Rename Legacy DB-read health labels away from "Healthy" unless an audited health source proves actual runtime health.
4. Change Legacy mode to `unknown` and expose provider market/read source separately.
5. Add static/integration tests for missing provider mapping, empty provider rows, export source selection, and portfolio totals with no contributing metrics.
