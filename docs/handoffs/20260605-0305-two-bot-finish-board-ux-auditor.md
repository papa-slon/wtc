# two-bot-finish-board-ux-auditor handoff
## Scope
Read-only product/UX audit for Phase 4.45 before implementing a premium, terminal-first `/app/bots` two-bot finish board. The audit inspected the current user bot overview plus related setup, settings, continuity, statistics, readiness, and roadmap files. No live provider probes, exchange pings, bot control, managed DB checks, or source/test/product edits were performed.

## Files inspected
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config-review.ts`
- `apps/web/src/features/bots/meta.ts`
- `docs/NEXT_ACTIONS.md`

## Files changed
`docs/handoffs/20260605-0305-two-bot-finish-board-ux-auditor.md`

## Findings
1. P1 - `/app/bots` is still a portfolio/listing surface, not a finish board. Evidence: the overview loads only `metrics` and `warnings` for each bot (`apps/web/src/app/(app)/app/bots/page.tsx:18-23`), shows one global statistics CTA (`apps/web/src/app/(app)/app/bots/page.tsx:41-44`), then each bot card only links to the dashboard (`apps/web/src/app/(app)/app/bots/page.tsx:71-127`). Recommendation: make the first screen answer "what do I finish next for Legacy and Tortila?" by loading enough per-bot config/readiness state to summarize setup, settings source, continuity, statistics, and no-live-control state. Target part: `/app/bots` page.
2. P1 - The exact roadmap already calls for this no-env product closure. Evidence: `docs/NEXT_ACTIONS.md:48-52` says to build `/app/bots` two-bot finish board with per-bot settings, setup, continuity, statistics, no-live boundary, and direct CTAs, without live start/stop/apply or provider probes. Recommendation: implement this as the next no-env UX slice and keep it read-only/mocked-safe. Target part: `/app/bots` page plus focused static/rendered tests.
3. P1 - Rich bot-specific building blocks already exist and should be summarized rather than reimplemented. Evidence: `BotSettingsQuickPath` has a seven-layer settings path with source, coin trigger/strategy, stage/caps, provider/key, statistics, save/export, and live boundary (`apps/web/src/features/bots/BotSettingsQuickPath.tsx:80-187`), while `BotSetupControlCenter` exposes ready layers, attention count, connection state, and coin/stage model (`apps/web/src/features/bots/BotSetupControlCenter.tsx:312-327`). Recommendation: create a compact overview-specific "finish card" or local helper that mirrors these concepts in 5-6 rows per bot. Target part: `/app/bots` card content.
4. P1 - Continuity must be visible on the first screen, not discovered only inside bot rooms/statistics. Evidence: bot detail includes `BotContinuityPanel` right after readiness (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:177-187`), statistics computes aggregate worker freshness and blocks green state when target='worker' is stale or missing (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:79-110`), and `BotContinuityPanel` renders cadence, last check, snapshot age, and proof rows (`apps/web/src/features/bots/BotContinuityPanel.tsx:57-98`). Recommendation: `/app/bots` should show a "Continuity" row per bot with `fresh`, `attention`, `blocked`, or `not checked here`, plus copy like "Open dashboard for worker-backed proof; this screen does not run the worker." Target part: `/app/bots` per-bot finish board.
5. P1 - The overview currently risks hiding the no-live-control boundary behind a footer. Evidence: the first overview copy mentions live controls disabled (`apps/web/src/app/(app)/app/bots/page.tsx:36-40`) and repeats it in a small footer (`apps/web/src/app/(app)/app/bots/page.tsx:131-134`), while bot detail still renders disabled Start/Stop controls (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:332-341`). Recommendation: first-screen cards should include a visible "Live boundary" row or pill: `Start/stop/apply disabled`, with no disabled Start/Stop buttons on the finish board. Target part: `/app/bots` card rows.
6. P2 - Legacy and Tortila need distinct first-screen language. Evidence: metadata names Tortila as "Turtle-system trend engine on BingX perps" and Legacy as "RSI/CCI averaging bot (original engine)" (`apps/web/src/features/bots/meta.ts:20-23`); Legacy lacks trade history/equity/backtester and has explicit provider/pub_id notes (`apps/web/src/features/bots/meta.ts:69-82`). Recommendation: use two tailored strategy summaries:
   - Legacy copy: "RSI/CCI averaging; coin -> trigger -> stage slot -> provider pub_id snapshot."
   - Tortila copy: "Turtle trend system; coin -> timeframe/system/risk -> portfolio caps -> encrypted key metadata."
   Target part: `/app/bots` card header and first two rows.
7. P2 - Statistics is already premium enough to be teased from the overview. Evidence: statistics page has portfolio snapshot (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:351-360`), worker heartbeat command center inputs (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:445-471`), and the command center includes performance/risk/settings/admin mirror/live boundary layers (`apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:45-96`). Recommendation: show a per-bot "Statistics" row on `/app/bots` with wallet/evidence row summary when available and CTA `Open statistics`. Target part: `/app/bots` per-bot card.
8. P2 - Settings/source state is available but absent from the overview. Evidence: settings page computes `sourceLabel`, source type, system default, customization lock, version count, config review metrics, and provider/key counts (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:213-272`), then renders `BotSettingsQuickPath` (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300-315`). Recommendation: `/app/bots` should expose the active source label (`system default`, `custom vN`, or `built-in fallback`) and one CTA: `Use default`, `Continue custom`, or `Open settings`. Target part: `/app/bots` finish row model.
9. P2 - Setup/key/pub_id readiness should be summarized without running any live connectivity test. Evidence: Tortila setup can save encrypted key fields and only run metadata checks (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:411-441`); readiness explicitly says live exchange ping is still not run for metadata confirmation (`apps/web/src/features/bots/readiness.ts:145-174`). Legacy setup skips key collection and depends on provider pub_id mapping/snapshots (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:326-337`). Recommendation: first screen row copy:
   - Tortila: `Key metadata: none/saved/vault metadata confirmed; live ping disabled`.
   - Legacy: `Provider pub_id: missing/snapshot/DB mapping; user cannot edit provider identity`.
   Target part: `/app/bots` per-bot setup row.
10. P3 - Current overview has one encoding/copy defect that may damage premium polish. Evidence: the simulated-data title renders mojibake in the source output (`apps/web/src/app/(app)/app/bots/page.tsx:45-50`). Recommendation: use ASCII-safe "Simulated data - not a live account" or fix file encoding as part of the implementation if the line is touched. Target part: `/app/bots` warning banner.

## Decisions
1. The best Phase 4.45 implementation target is a focused `/app/bots` finish-board upgrade, not another deep settings/statistics rewrite. The existing detail pages already carry the heavy mechanics.
2. The finish board should be user-facing and action-oriented: each bot gets one premium card with a concise operational sentence, 4-6 state rows, and direct CTAs.
3. The board must not introduce live controls, live exchange pings, provider probes, or any illusion that saving settings starts or applies a running bot.
4. The board should reuse current data loaders and pure helpers where possible. If a small local view model is needed, keep it in the page or a focused feature component and do not move bot logic into React-only ad hoc code.

## Risks
1. Loading too much on `/app/bots` could duplicate expensive bot reads. Keep reads scoped to lightweight config/readiness/metrics already used by nearby pages, and preserve safe fallback behavior.
2. If the overview uses dashboard health alone, it can overstate readiness. It must distinguish runtime continuity from "not checked here" and avoid treating mock data as live proof.
3. Disabled Start/Stop buttons on overview would create the wrong mental model. Prefer a non-interactive boundary row and CTAs to dashboard/settings/statistics.
4. Admin/user separation must remain copy-accurate: user cards can mention that admins have a read-only mirror, but must not imply admin can edit user-owned settings.

## Verification/tests
Read-only audit only. No tests or runtime gates were run.

Recommended gates after implementation:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-readiness-builder.test.ts`
2. Add/update a focused static test asserting `/app/bots` contains both bot finish cards, settings/setup/statistics/continuity/live-boundary rows, and no enabled live controls.
3. `npm run typecheck -- --pretty false`
4. `npm run secret:scan`
5. `git diff --check`

## Next actions
1. Implement `/app/bots` as "Bot finish board" with title copy: "Two-bot command board" and supporting copy: "Finish setup, review strategy, confirm continuity, and open statistics for Legacy and Tortila. This page is read-only and never starts, stops, pings, or applies a live bot."
2. Per bot, render a compact header with product pill, access/health pill, warning pill, source label, and one sentence:
   - Legacy: "RSI/CCI averaging: choose coin triggers, assign stage slots, review provider pub_id evidence, then inspect scoped snapshots."
   - Tortila: "Turtle trend engine: choose coin systems, risk, portfolio caps, encrypted key metadata, then inspect journal analytics."
3. Per bot, render ordered rows:
   - `1. Setup` with `Provider pub_id` for Legacy or `Exchange key metadata` for Tortila; CTA `Open setup`.
   - `2. Settings` with system/default/custom/built-in state and config metric summary; CTA `Open settings`.
   - `3. Continuity` with health/readiness or "Open dashboard for worker proof"; CTA `Open dashboard`.
   - `4. Statistics` with wallet/evidence row summary and known limitations; CTA `Open statistics`.
   - `5. Safety boundary` with `Start/stop/apply disabled`; disabled action label `No live control`.
4. Add a top "What is actually green?" strip with 3 metrics: entitled bots, portfolio wallet/evidence contributors, no-live-control state. Keep win rate/PF per bot only.
5. Fix the overview simulated-data banner text if implementation touches that area: "Simulated data - not a live account".
6. Do not add provider probes, live exchange pings, Start/Stop buttons, apply-config buttons, or admin mutation links in this phase.
