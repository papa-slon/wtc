# ecosystem-ux-ui-designer handoff
## Scope
Read-only Phase 4.12 UX/product audit for user-facing Legacy and Tortila bot dashboard, settings, setup, statistics, and safety pages. The goal was to decide how a premium, simple continuity/status surface should look for bot settings and statistics without adding fake live control, admin mutation, exchange pings, provider mutation, worker ticks, DB writes, or runtime state changes.

This audit treated the current checkout as dirty and in motion. It inspected the current files on disk and the sibling Phase 4.12 runtime/tests-security auditor handoffs, then wrote only this handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/20260604-1111-phase-4-11-admin-runtime-evidence-ladder.md
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/statistics/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx
- apps/web/src/features/bots/BotContinuityPanel.tsx
- apps/web/src/features/bots/continuity.ts
- apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx
- apps/web/src/features/bots/BotReadinessMap.tsx
- apps/web/src/features/bots/BotSetupControlCenter.tsx
- apps/web/src/features/bots/BotOperationMapPanel.tsx
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/statistics-panels.tsx
- apps/web/src/features/bots/LegacyAveragingConfigTable.tsx
- apps/web/src/features/bots/TortilaSymbolConfigTable.tsx
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/bot-settings.spec.ts
- tests/e2e/warning-summary-visual.spec.ts
- tests/e2e/smoke.spec.ts
- tests/e2e/cabinet-pg9-mobile.spec.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/bot-continuity-builder.test.ts

## Files changed
None - read-only audit

Allowed handoff written: docs/handoffs/20260604-1114-bot-continuity-ux-auditor.md

## Findings
1. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200 and apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:266, plus apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:207 and apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:286 - recommendation: bring the continuity monitor pattern into settings and setup as a compact, read-only status block before the editor/wizard, using existing safe DTOs and no live adapter calls - target part: settings/setup first-screen status. Dashboard, statistics, and safety now have a continuity monitor, but settings/setup still rely on setup/readiness/operation maps and omit the simple "is continuity proven/watch/pending/interrupted" answer where users edit bot settings.
2. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/page.tsx:169, apps/web/src/app/(app)/app/bots/[bot]/page.tsx:174, apps/web/src/app/(app)/app/bots/[bot]/page.tsx:182, apps/web/src/app/(app)/app/bots/[bot]/page.tsx:192, and apps/web/src/app/(app)/app/bots/[bot]/page.tsx:212; similar stacking appears at apps/web/src/app/(app)/app/bots/statistics/page.tsx:353, apps/web/src/app/(app)/app/bots/statistics/page.tsx:363, apps/web/src/app/(app)/app/bots/statistics/page.tsx:377, and apps/web/src/app/(app)/app/bots/statistics/page.tsx:442 - recommendation: make `BotContinuityPanel` the first-screen executive status surface, then demote `BotRuntimeEvidencePanel` and operation/readiness maps to lower "technical evidence" sections or one compact disclosure - target part: dashboard/statistics hierarchy. The current pages are honest but dense: readiness, continuity, operation map, runtime evidence, warnings, and metric grids all compete for the same operator question.
3. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/page.tsx:326 and apps/web/src/app/(app)/app/bots/[bot]/page.tsx:327 - recommendation: remove disabled "Start bot" and "Stop bot" buttons from the user dashboard and replace them with non-button status copy in the continuity/control-boundary surface - target part: no-fake-live-control UX. Even disabled buttons create a live-control affordance; this phase should show "Live control disabled" as status, not as unavailable controls.
4. Severity P2 - evidence apps/web/src/features/bots/BotContinuityPanel.tsx:68 and apps/web/src/features/bots/continuity.ts:74 - recommendation: render human continuity labels in the table status column, not raw tone names like `ok`, `warn`, `bad`, or `neutral` - target part: continuity panel clarity. The builder already has product labels such as "continuity proven", "watch continuity", "continuity interrupted", and "proof pending"; the table should use those labels or similarly plain operator states.
5. Severity P2 - evidence apps/web/src/features/bots/BotSetupControlCenter.tsx:343 and apps/web/src/features/bots/BotSetupControlCenter.tsx:345 - recommendation: split setup-row status from visible state instead of rendering the same string in both columns - target part: setup control center table. The current table uses `step.state` for both the status pill and visible-state cell, which makes "Status" less scannable than the readiness map.
6. Severity P2 - evidence apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:17, apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:48, and apps/web/src/features/bots/continuity.ts:132 - recommendation: let the continuity panel name the counted evidence type per surface, for example "warning rows" on safety and "metric/position/trade/config rows" on dashboard/statistics - target part: continuity proof copy. Safety passes only warning evidence into `dataRows`, but the panel labels it generically as scoped rows, which is technically safe but less clear.
7. Severity P2 - evidence apps/web/src/features/bots/BotContinuityPanel.tsx:6 and apps/web/src/features/bots/BotSetupControlCenter.tsx:30 - recommendation: extend the continuity surface with optional config-source and connection-state inputs rather than forcing users to reconcile continuity, WTC config source, exchange key/pub_id readiness, and live-control boundary across separate panels - target part: premium simple status model. The continuity panel currently knows runtime health, warning count, and row count; the setup control center separately knows active source, key/pub_id state, config readiness, and live-control boundary.
8. Severity P3 - evidence tests/integration/bot-read-safety-static.test.ts:219, tests/integration/bot-read-safety-static.test.ts:221, tests/integration/bot-read-safety-static.test.ts:223, tests/e2e/bot-readiness-map.spec.ts:18, tests/e2e/smoke.spec.ts:119, tests/e2e/bot-settings.spec.ts:57, and tests/e2e/bot-settings.spec.ts:293 - recommendation: after the UX slice, add tests that assert continuity is visible on settings/setup too, raw live-control buttons are absent, and the revised status labels render on desktop/mobile without horizontal overflow - target part: Phase 4.12 rendered acceptance. Existing tests cover dashboard/statistics/safety continuity and no-live-control strings, but settings/setup still only assert setup/readiness controls.

## Decisions
- The correct premium surface is not another large dashboard. Use `BotContinuityPanel` as the one simple first-screen answer, then let readiness/operation/runtime evidence become supporting detail.
- Recommended first-screen shape: a compact continuity card with (1) overall state, (2) runtime source, (3) last worker check/snapshot age, (4) scoped evidence count with a surface-specific label, (5) active warnings, (6) active WTC settings source, (7) key/pub_id readiness, and (8) live-control boundary as status only.
- Settings/setup should stay editor-first but not status-blind. The user should see the continuity state before saving a WTC-side config version, and the copy must keep saying saves do not apply to the running bot.
- Do not add start, stop, apply, retest, exchange ping, provider-mapping mutation, admin mutation, secret reveal, raw provider payload display, worker tick, or live probe in the UX slice.
- The bounded Phase 4.12 UX slice should be "bot continuity surface polish": extend and reuse existing continuity/readiness components, remove fake control affordances, and add focused rendered/static tests.

## Risks
- The checkout was already heavily dirty and appeared to change during this audit. This handoff records the current inspected state only and does not claim clean git state, CI state, deployment state, or authorship of existing code changes.
- Runtime truth is only as strong as the worker heartbeat and DB snapshot logic. The sibling runtime auditor found worker-heartbeat authority gaps; the UX should not call continuity green unless the underlying status says it is green.
- No browser or visual verification was run in this auditor lane. Dense tables, long labels, and mobile overflow remain risks until Playwright/browser acceptance is explicitly run by the implementation/tests lane.
- Removing disabled start/stop buttons may require updating e2e expectations that currently tolerate or ignore those labels while denying internal live-control names.

## Verification/tests
RUN:
- Read-only inspection with `Get-Content`, `rg`, and `Select-String`.
- `git status --short --branch` to record branch and dirty state.
- `Test-Path docs/handoffs/20260604-1114-bot-continuity-ux-auditor.md` before writing this handoff.
- Static inspection of current bot pages/components/tests and sibling Phase 4.12 handoffs.

NOT RUN:
- `npm test`, Vitest, typecheck, lint, build, secret scan, Playwright, browser screenshots, and visual gates - not run because this auditor lane was read-only file inspection plus one handoff write.
- Worker tick, DB mutation, preview/server startup, provider calls, exchange pings, SSH, deploy, tmux, systemd, live bot start/stop/apply/retest, env/secret reads - not run by prompt and safety policy.

## Next actions
1. Implement the bounded UX slice: extend `BotContinuityPanel`/`continuity.ts` with human row labels plus optional `configSourceLabel`, `connectionLabel`, `connectionState`, and `dataRowsLabel`; keep it pure and free of adapters/fetch/vault access.
2. Render the compact continuity monitor on settings and setup near the top, using existing safe readiness/config data. If runtime evidence is not loaded there, show "runtime proof not checked on this step" with links rather than calling live adapters.
3. On dashboard/statistics, keep the continuity monitor first and move detailed readiness/operation/runtime evidence below the primary metrics or behind a clearly secondary technical-evidence section.
4. Replace disabled Start/Stop buttons with a non-interactive live-control boundary card/row that says start, stop, live apply, retest, exchange ping, and position-closing actions are not available.
5. Update focused tests: static no-live-control guard, continuity builder tests for labels/data-row naming, bot settings/setup e2e for continuity visibility, dashboard e2e for no Start/Stop buttons, and desktop/mobile no-horizontal-scroll screenshots.
