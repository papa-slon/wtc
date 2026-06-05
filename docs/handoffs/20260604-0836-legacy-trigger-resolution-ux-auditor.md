# legacy-trigger-resolution-ux-auditor handoff
## Scope
Phase 4.06 read-only UX/product audit for the next Legacy settings/setup slice: add a trigger-resolution map or explanation so users understand how multiple RSI/CCI coins resolve by stage and bucket, which rows are eligible to fire, what stage capacity means, and that WTC saves only a reference config.

Out of scope: product-code edits, live services, provider DB, env/secrets, worker ticks, exchange pings, live bot start/stop/apply/retest, SSH/tmux/systemd, and any runtime mutation.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`
7. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
9. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
10. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
11. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
12. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/config-types.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: Phase 4.05 added a top warning for unsaved over-capacity drafts, but it only tells the user counts and routes to the stage row; it does not identify the rows that make the stage over capacity (`docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md:39`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:159`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:164`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:277`). Recommendation: add a compact trigger-resolution map that groups enabled Legacy rows by Stage -> RSI bucket / CCI bucket and lists row number, symbol, timeframe, threshold, and paused/blank exclusion state. Target part: `LegacyAveragingConfigTable` near the existing Legacy strategy map and stage capacity table.
2. Severity: High. Evidence: the current Legacy table explains the model in prose and shows per-stage usage counts, but users still have to scan up to 14 row cards to discover which coins consume a given RSI/CCI bucket (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:188`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:190`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:193`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:499`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:500`). Recommendation: show the resolution map before the editable rows or immediately above "Stage capacity", so the explanation is visible before users edit capacities. Target part: copy/placement in the Legacy settings editor.
3. Severity: Medium. Evidence: both settings and setup already render the same `LegacyAveragingConfigTable`, while their surrounding pages separately render control/review/operation-map panels (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:249`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:401`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:551`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:269`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:360`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:526`). Recommendation: implement the map once inside `LegacyAveragingConfigTable`, then optionally link the control-center warning to that map or stage anchor; do not duplicate a full explanation in both routes. Target part: shared component placement for `/settings` and `/setup?step=strategy`.
4. Severity: Medium. Evidence: the actual eligibility logic excludes blank or paused rows from stage usage, while the schema enforces exactly one trigger per Legacy coin (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:70`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:71`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:74`, `apps/web/src/features/bots/config.ts:98`, `apps/web/src/features/bots/config.ts:100`). Recommendation: copy should say "Enabled rows with a symbol are eligible in this WTC reference profile. Paused or blank rows do not consume capacity. Each enabled row uses exactly one bucket: RSI or CCI." Target part: trigger-resolution explanatory copy.
5. Severity: Medium. Evidence: current stage-capacity copy says the limits decide how many active RSI/CCI slots a stage may hold "before the next signal waits" and the pill says "live draft inside capacity" (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:411`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:419`). Recommendation: avoid "live" in this local preview context and avoid implying WTC controls real firing order; use "draft inside capacity" and define capacity as "the WTC reference slot budget for active rows in each stage/bucket." Target part: safety-sensitive copy.
6. Severity: Medium. Evidence: status and next actions state Legacy settings are WTC-side reference/export only with no live Legacy apply path, and the current pages repeat that exports and profiles do not apply to the live bot (`docs/STATUS.md:6`, `docs/STATUS.md:7`, `docs/NEXT_ACTIONS.md:13`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:487`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:490`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:469`). Recommendation: keep this boundary inside the new map footer/header; the map should describe WTC reference eligibility, not claim live provider firing. Target part: boundary copy and footer.
7. Severity: Low. Evidence: existing responsive tables use `wtc-table-wrap` and `data-label`, but the Legacy editor already has many row cards plus a stage table (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:210`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:427`, `apps/web/src/features/bots/BotConfigReviewPanel.tsx:30`). Recommendation: make the map dense and scan-friendly: either one grouped table with `data-label` cells or small stage sections with wrapped status pills; avoid another long card stack on mobile. Target part: responsive layout.

## Decisions
1. This is the right next product slice after Phase 4.05: the warning now exists, so the next UX gap is helping users resolve it without scanning every coin row.
2. The slice should stay UX-only and derive from existing `legacyRows`, `legacyStages`, and local draft `signals`/`stageDrafts`; no new backend, provider read, worker tick, or live adapter is needed.
3. Best placement is inside `LegacyAveragingConfigTable`, near the "Legacy strategy map" and before or just above "Stage capacity", because that shared component serves both setup and settings.
4. The map should use careful wording: "eligible in this WTC reference profile" is safer than claiming rows "will fire" on the live Legacy bot.

## Risks
1. If the map uses "fire" or "live" too casually, it can blur the hard boundary that WTC saves reference config only and does not apply or diagnose the live Legacy bot.
2. A map that ignores local unsaved trigger/stage edits would be worse than no map because it would contradict the Phase 4.05 live draft preview behavior.
3. Adding a large second table could make mobile setup feel heavier; the map needs compact grouping and responsive labels.
4. Runtime/provider snapshots may differ from the saved WTC reference config; the map must not silently mix provider snapshot facts into the editable reference profile.

## Verification/tests
RUN:
1. Read required protocol and status files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and the Phase 4.05 aggregate handoff.
2. Inspected the Legacy settings/setup page composition and shared bot UX components listed above.
3. Confirmed this audit did not edit product code and did not touch live services, provider DB, env/secrets, worker ticks, exchange pings, SSH/tmux/systemd, or bot control paths.

NOT RUN:
1. Tests, typecheck, lint, build, Playwright, preview/browser, and visual regression - skipped because this was a read-only UX/product audit with no product-code change.
2. Live bot start/stop/apply/retest, provider DB reads/writes, worker tick, exchange ping, raw provider payload inspection, env/secret inspection, SSH/tmux/systemd - skipped by explicit scope and safety boundary.
3. Git commit, push, or PR - not requested.

## Next actions
1. Implement a compact Legacy trigger-resolution map in `LegacyAveragingConfigTable` that groups active configured rows by stage and RSI/CCI bucket, including row number, symbol, timeframe, trigger threshold, capacity used/available, and clear paused/blank exclusion copy.
2. Replace or avoid ambiguous "live draft" wording in the stage-capacity pill; prefer "draft inside capacity" or "preview inside capacity."
3. Add focused static and Playwright coverage for desktop and mobile: grouped rows render, paused/blank rows are excluded, unsaved stage/trigger edits update the map before save, over-capacity warnings link to the relevant stage/map, and no live-control terms or actions are introduced.
4. Keep this as a small UX/readability slice; do not combine it with live Legacy adapter work, provider DB evidence, worker changes, or bot controls.
