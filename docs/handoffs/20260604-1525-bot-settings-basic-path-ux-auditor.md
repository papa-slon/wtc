# bot-settings-basic-path-ux-auditor handoff
## Scope
Phase 4.21 read-only UX/product audit before edits. Scope: inspect the current Legacy/Tortila settings page after Phase 4.20 and identify how to make the first viewport/basic path clear for the user's goal: choose default vs custom, pick coin(s), configure RSI/CCI or Tortila system/risk/stage-like essentials, save/export, while keeping advanced ladders/caps below.

This was a single foreground auditor lane. No background agents were launched from this side per the operator instruction, no N-agent claim is made, and no background agents were left open.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `docs/handoffs/20260604-1505-bot-export-browser-ux-auditor.md`
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md`
- `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `tests/e2e/bot-settings.spec.ts`
- Existing retained screenshots inspected read-only:
  - `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
  - `tests/e2e/screenshots/bot-tortila-settings-mobile.png`
  - `tests/e2e/screenshots/bot-legacy-settings-desktop.png`
  - `tests/e2e/screenshots/bot-legacy-settings-mobile.png`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:277`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:295`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:301`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:345`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:387`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:583`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:639`, `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:92` - the first viewport is dominated by control/readiness/continuity/source cards before the actual editable form starts; the save action lives at the bottom of that form. Phase 4.20 already deferred the same product issue: settings are layout-safe but still long expert workbenches. Recommendation: add a first-viewport `Basic setup path` block before the readiness/continuity detail cards or convert the top control center into that block. It should show source choice, first coin/coin count, bot-specific essentials, save, and export status as one visible path. Target part: `settings/page.tsx` top-of-page task flow.

2. Severity P1 - evidence `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:354`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:371`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:380`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:403`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:450`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:480`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:529`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:585` - Tortila's component labels itself "Per-coin Tortila configuration", but it renders the strategy map and editable portfolio caps before the coin cards. That puts advanced caps and map diagnostics ahead of the user's basic task: choose coin, choose Turtle system, set risk, save/export. Recommendation: render a compact basic coin editor first, with coin, timeframe, system, risk percent, and a primary save/export command row; move portfolio caps and strategy-map tables below as collapsed or secondary "Advanced risk caps and diagnostics" sections with summary pills above. Target part: `TortilaSymbolConfigTable`.

3. Severity P2 - evidence `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:276`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:302`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:352`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:406`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:458`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:477`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:541`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:560`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:616` - Legacy has the right primitives and already collapses position sizing/averaging/delay/delta under details, but the first practical coin task still starts after a strategy map and the full stage-capacity editor sits below all visible coin cards. Recommendation: add a compact "Basic Legacy coin" section above the map with coin, active/paused, trigger RSI/CCI, trigger length/threshold, stage bucket, and a live capacity summary for that stage; leave the trigger-resolution table, full stage-capacity table, and averaging/delay/delta controls below as review/advanced controls. Target part: `LegacyAveragingConfigTable`.

4. Severity P2 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:527`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:537`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:583`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:639`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:620`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:632`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:636`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:643`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:29`, `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:104` - save and export are semantically separated: the export card appears before the editable form and downloads the last saved reference, while Tortila's draft copy preview is inside an open details block at the bottom of the component. Legacy export is also intentionally blocked without exactly one safe provider mapping. Recommendation: make the basic path explicitly "Save WTC version" then "Export last saved reference"; place a disabled/available export state next to the save action, and keep `Copy draft SYMBOL_CONFIGS` as a secondary draft/manual-review affordance. Target part: settings save/export mental model.

5. Severity P2 - evidence `apps/web/src/features/bots/BotSetupControlCenter.tsx:207`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:209`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:227`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:237`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:322`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:329`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:341`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:349` - the control center names useful layers, but it is a status table with ghost links rather than an in-place task path. On mobile this table/card stack consumes substantial vertical space before any coin editor appears. Recommendation: keep the safety/status facts but compress them into a task-step summary: 1) Default/custom, 2) Coin essentials, 3) Save/export, 4) Disabled live-control boundary. Move the full status table below the basic path or behind a details section. Target part: `BotSetupControlCenter`.

6. Severity P2 - evidence `tests/e2e/bot-settings.spec.ts:79`, `tests/e2e/bot-settings.spec.ts:92`, `tests/e2e/bot-settings.spec.ts:101`, `tests/e2e/bot-settings.spec.ts:104`, `tests/e2e/bot-settings.spec.ts:150`, `tests/e2e/bot-settings.spec.ts:157`, `tests/e2e/bot-settings.spec.ts:171`, `tests/e2e/bot-settings.spec.ts:191`, `tests/e2e/bot-settings.spec.ts:216`, `tests/e2e/bot-settings.spec.ts:296`, `tests/e2e/bot-settings.spec.ts:348`, `tests/e2e/bot-settings.spec.ts:491` - current Playwright coverage proves content presence, export route safety, error anchors, and no horizontal scroll. It does not assert that the basic path appears in the first viewport on desktop or mobile, nor that advanced caps/ladders are below or collapsed. Recommendation: add a focused acceptance check that loads Tortila and Legacy settings at desktop/mobile, verifies default/custom plus the first editable coin essentials and save/export state are in the initial viewport, and verifies advanced portfolio caps/averaging ladders are secondary. Target part: `tests/e2e/bot-settings.spec.ts`.

## Decisions
- Kept this audit read-only except for this requested handoff artifact.
- Treated this as a per-agent foreground auditor handoff, not a broad implementation phase; no background agents were launched from this side per the operator instruction.
- Did not run Playwright, Vitest, lint, typecheck, build, preview/dev server, DB, worker, provider, or live commands because the task asked for read-only inspection before edits.
- Used current source, latest handoffs, tests, and retained screenshots for UX inspection. The screenshots were inspected as existing artifacts only; no new screenshots were generated.
- Did not inspect raw env, raw secrets, live provider data, SSH, tmux, systemd, or deployment state.

## Risks
- No executable gates were run, so this audit cannot prove current runtime or browser freshness.
- Existing retained screenshots may be stale relative to the very latest source changes; code order and current tests still support the same density/scroll-depth finding.
- The worktree was already heavily dirty before this audit, including the settings files; this handoff does not claim ownership of pre-existing modified/untracked files.
- Legacy no-`pub_id` export remains secure/fail-closed but may still frustrate a user who can configure a WTC reference profile before admin mapping exists.

## Verification/tests
Read-only inspection RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and many pre-existing modified/untracked files.
- Read protocol/governance docs and latest relevant handoffs listed above.
- `rg` and line-numbered `Get-Content` inspection of the settings page, `LegacyAveragingConfigTable`, `TortilaSymbolConfigTable`, `BotSetupControlCenter`, and `tests/e2e/bot-settings.spec.ts`.
- Existing retained settings screenshots were opened read-only for Tortila/Legacy desktop and mobile.

Commands/gates NOT RUN:
- `npx playwright test tests/e2e/bot-settings.spec.ts` - not run; read-only audit only, would start browser/server and can write screenshots/artifacts.
- First-viewport browser proof, screenshot refresh, and visual manifest review - not run; no new browser artifacts were generated.
- `npx vitest run ...`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, `npm run build -w @wtc/web`, `node scripts/gates.mjs quick|core|full`, `npm run ci:local`, `npm run secret:scan`, `npm run governance:check` - not run; outside this read-only UX audit scope and some commands write retained logs/artifacts.
- `npm run dev`, `npm run preview:safe` - not run; no local server startup was needed for source/screenshot inspection.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, managed DB acceptance, worker tick/continuity, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - not run by scope and non-negotiable safety policy.

## Next actions
1. Implement a first-viewport basic settings path in the user settings page: default/custom decision, first coin/coin count, bot-specific essentials, save, and export state.
2. For Tortila, move editable portfolio caps and strategy-map diagnostics below the basic coin editor, preferably collapsed by default with summary pills above.
3. For Legacy, add a compact basic coin/stage/trigger editor before the trigger-resolution map, while keeping averaging ladders, delay/delta filters, and the full stage-capacity table below.
4. Add desktop/mobile Playwright assertions for first-viewport basic-path visibility and advanced-section placement, while preserving existing no-horizontal-scroll, fail-closed export, and live-control-disabled assertions.
5. Keep all live bot apply/start/stop/diagnostic actions disabled and out of scope; this is UX simplification of WTC reference settings only.
