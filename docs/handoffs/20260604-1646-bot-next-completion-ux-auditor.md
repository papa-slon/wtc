# bot-next-completion-ux-auditor handoff
## Scope
Read-only Phase 4.24 UX/product audit after Phase 4.23 for WTC bot completion. Inspected current Legacy/Tortila user settings, setup, statistics, admin selector/drilldown, readiness, and bot room surfaces. Focused on the operator objective: a premium, obvious settings/statistics website for averaging bot and Tortila, with clear defaults vs personal config, coin/stage RSI/CCI slots, key readiness/test clarity, safe start-readiness clarity without unsafe live control, and admin read-only inspection.

Recommended next bounded implementation slice: **Phase 4.24 - Manual start-readiness command center**. Build a read-only readiness verdict panel shared between the user bot room, setup review/settings first viewport, and selected-user admin drilldown. It should answer "what is ready, what blocks a manual operator start discussion, and why WTC still cannot start/apply/stop the bot" without adding live-control actions.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1637-phase-4-23-admin-bot-owner-selector.md`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config-review.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity P1 - Start-readiness is safe but fragmented across multiple panels, so the user still has to synthesize whether the bot is "ready to discuss manual start" from separate readiness, continuity, operation, runtime, settings, and statistics tables. Evidence: the bot room renders `BotReadinessMap`, `BotContinuityPanel`, `BotOperationMapPanel`, and `BotRuntimeEvidencePanel` as separate sections at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:169`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:174`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:186`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:196`; settings similarly stacks setup control, quick path, readiness, and continuity at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:282`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:317`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:323`. Recommendation: add one shared read-only `ManualStartReadinessPanel` above these detailed tables. Target part: user bot room/settings/setup first viewport.
2. Severity P1 - Key/provider readiness is correctly non-live, but the product needs one clearer "safe test clarity" verdict so users do not confuse WTC vault metadata with exchange connectivity. Evidence: Tortila readiness explicitly says live exchange ping is not run at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:72` and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:147`; the future ping button is disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122` and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:129`. Legacy readiness correctly requires exact mapped provider pub_id evidence at `apps/web/src/features/bots/readiness.ts:129` and `apps/web/src/features/bots/readiness.ts:133`. Recommendation: the next panel should state "WTC metadata ready / live ping not run" for Tortila and "mapped pub_id ready / provider facts read-only" for Legacy. Target part: key readiness and Legacy provider readiness copy.
3. Severity P1 - Defaults vs personal config are implemented, but not yet presented as a single effective-config answer everywhere the operator cares about. Evidence: setup explains user custom vs system default vs built-in fallback at `apps/web/src/features/bots/BotSetupControlCenter.tsx:190`; settings quick path lists source and custom version count at `apps/web/src/features/bots/BotSettingsQuickPath.tsx:88`; admin defaults define built-in fallback, system default, user override, and runtime as separate layers at `apps/web/src/app/admin/bots/config/page.tsx:304`; selected-user admin summary explains resolved source read-only at `apps/web/src/features/admin/user-bot-detail-loader.ts:560`. Recommendation: the start-readiness panel should show "effective source" as a first-class verdict: built-in fallback, system default, or personal custom version, with links to the right editor/default page. Target part: user/admin effective settings source.
4. Severity P2 - Legacy RSI/CCI coin/stage slot UX is now strong in the expert editor, but users still have to open the long table to know if stage capacity blocks readiness. Evidence: Legacy editor explains one coin = one RSI/CCI trigger and stage slots at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:280`, computes draft stage usage at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:246`, shows bucket capacity state at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:331`, and the config review already exposes active coins, signal split, and stage capacity metrics at `apps/web/src/features/bots/config-review.ts:245`. Recommendation: surface the same Legacy slot health in the manual readiness verdict: active coins, RSI/CCI split, stage capacity ok/full/over, and the first blocking stage link. Target part: Legacy averaging bot readiness.
5. Severity P2 - Tortila coin/cap configuration is clear in the editor, but the same "ready enough for manual start review" summary is missing from the bot room. Evidence: Tortila settings show coin strategy and portfolio caps at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:336`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:357`, and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:380`; the export preview warns nothing is pushed live at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:632`. Recommendation: include configured coin count, system mix, cap pressure, and key metadata state in the shared verdict. Target part: Tortila bot readiness.
6. Severity P2 - Admin read-only inspection is now discoverable after Phase 4.23, but it should mirror the user's readiness verdict instead of only showing separate command/evidence tables. Evidence: `/admin/users` now has a bot owner selector and global defaults link at `apps/web/src/app/admin/users/page.tsx:168` and `apps/web/src/app/admin/users/page.tsx:182`; selected-user admin drilldown states live control, user settings, and provider mappings are read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:291`; it also has a selected-user statistics command center at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:327` and evidence ladder at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:421`. Recommendation: mount the same read-only readiness verdict per bot in admin selected-user drilldown, with no mapping/edit/config mutation. Target part: admin selected-user bot inspection.
7. Severity P2 - Statistics are improved but not yet used as an explicit readiness gate. Evidence: `BotStatisticsCommandCenter` has data scope, performance, risk, settings link, admin mirror, and live boundary layers at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:45`; readiness has a statistics item but only reports metrics available/unavailable at `apps/web/src/features/bots/readiness.ts:157`. Recommendation: treat statistics availability, warning count, and runtime freshness as "start-readiness evidence" without claiming trade quality is green when closed-trade history is missing. Target part: statistics/readiness bridge.

## Decisions
- Recommend one bounded UX/product slice, not a broad rebuild: create a shared read-only manual start-readiness command center and mount it in existing surfaces.
- Do not add start, stop, live apply, provider probe, exchange ping, position action, provider mapping mutation, or user settings mutation to admin drilldowns.
- Use existing source data already loaded by current pages where possible: `readiness.items`, `configReview.metrics`, `BotContinuityHealth`, runtime health, warning summary, exchange key metadata count, provider mapping count, and statistics availability.
- Keep product wording explicit: "manual operator start discussion" or "ready for review" is acceptable; "Start bot" is not acceptable until a separately audited control adapter phase exists.

## Risks
- A "readiness" label can accidentally imply permission to run live control. The UI must keep "WTC cannot start/apply/stop" visible in the same panel as any ready verdict.
- If the panel re-computes readiness separately from `readiness.ts` and `config-review.ts`, source drift is likely. Prefer a pure builder that consumes existing DTOs/metrics.
- Demo mode can render a visually complete but data-empty readiness panel. Browser acceptance should cover both empty/demo state and DB-backed populated state when disposable Postgres is authorized.
- Legacy readiness must not treat runtime pub_id snapshots as user-owned unless active provider mapping is exact and user-scoped.

## Verification/tests
RUN:
- Read-only file searches and file reads only.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty worktree before this audit.
- Protocol/source reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, Phase 4.20-4.23 handoffs, status/next/implemented docs, and current bot/admin source files listed above.

NOT RUN:
- No tests, Playwright, dev server, live server commands, DB commands, provider probes, exchange pings, worker runs, or live bot commands were run per read-only instruction.
- No background agents were launched from this audit session; this was a single requested read-only auditor handoff, not an N-agent aggregate phase.

## Next actions
1. Implement **Phase 4.24 - Manual start-readiness command center**:
   - Add a shared pure builder plus UI component, e.g. `apps/web/src/features/bots/BotManualStartReadinessPanel.tsx`.
   - Mount it on the user bot room near the first viewport, settings after `BotSetupControlCenter`, setup review, and selected-user admin drilldown.
   - Inputs should reuse existing readiness/config/statistics/runtime DTOs rather than adding adapter calls.
2. Acceptance criteria for the slice:
   - Tortila verdict shows effective config source, configured coins/system mix/caps, WTC vault metadata state, statistics/runtime freshness, warnings, and "live exchange ping/start/apply/stop not run".
   - Legacy verdict shows effective config source, active coins, RSI/CCI split, stage capacity ok/full/over with blocking stage link, exact provider pub_id mapping state, statistics/runtime freshness, warnings, and "live control disabled".
   - Admin selected-user drilldown shows the same verdict read-only, with no controls to edit user settings, provider mapping, exchange keys, live config, positions, or bot state.
   - No visible CTA or form label uses "Start", "Apply live", "Stop", "Run exchange ping", or equivalent live-control language except as disabled/boundary text.
   - Static tests assert the no-live-control boundary, exact provider-mapping language, Legacy RSI/CCI stage capacity presence, Tortila key/cap presence, and admin read-only mirror.
   - Rendered browser coverage checks desktop and mobile for Tortila and Legacy bot room/settings plus admin selected-user drilldown; DB-backed populated matrix remains NOT RUN unless a disposable admin Postgres URL is explicitly authorized.
3. Keep the follow-up narrow. Do not combine this with live provider ingestion, exchange ping adapter work, admin provider-mapping mutation, production deploy, or visual manifest promotion.
