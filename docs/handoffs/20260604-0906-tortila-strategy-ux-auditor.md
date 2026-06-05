# tortila-strategy-ux-auditor handoff
## Scope
Read-only UX/product audit for Phase 4.07. Goal: identify the most valuable narrow UX slice to make Tortila settings/setup as understandable as the Phase 4.06 Legacy trigger-resolution map, while preserving WTC-only reference settings, default-vs-custom clarity, per-coin Turtle strategy clarity, portfolio cap clarity, easy row visibility, and no false live-control claims.

Out of scope: product code edits, test edits, live server mutation, env/secret/DB/SSH/tmux/systemd access, bot/provider endpoints, runtime apply/start/stop, exchange ping, worker tick, and broad bot completion claims.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md`
5. `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md`
6. `docs/handoffs/20260604-0836-legacy-trigger-resolution-source-auditor.md`
7. `docs/handoffs/20260604-0836-legacy-trigger-resolution-tests-security-auditor.md`
8. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
9. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
10. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
11. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/config-error-copy.ts`
15. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
17. `tests/e2e/bot-settings.spec.ts`
18. `tests/integration/bot-config-review-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Tortila has the right editable per-coin inputs, but not the compact explanatory map that Legacy now has. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:64` titles the section `Per-coin Tortila configuration`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:66` lists coin/system/risk/ATR/pyramid/TP in prose, and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:81` through `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:187` renders up to eight separate row cards. Phase 4.06 solved the analogous Legacy scan problem with a compact map before users edit rows (`docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md:38`). Recommendation: add a `Tortila strategy map` inside `TortilaSymbolConfigTable`, above the row cards, with row number links and columns for coin, timeframe, Turtle system, risk %, ATR stop N, add step N, max units, ATR period, and TP R/off. Target part: Tortila settings/setup row comprehension.
2. Severity: High. Portfolio caps exist and are summarized, but they are visually separated from the per-coin decision surface while users edit. Evidence: Tortila schema/top-level caps are `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick` (`apps/web/src/features/bots/config.ts:63`, `apps/web/src/features/bots/config.ts:68`); the editable cap fields render later through the generic `fields.map` after the Tortila table in settings and setup (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:560`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:581`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:535`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:549`); the review summary reports caps only after save/load (`apps/web/src/features/bots/config-review.ts:134`, `apps/web/src/features/bots/config-review.ts:147`). Recommendation: include a small `Portfolio caps` strip directly in the Tortila strategy map, fed from the resolved config/defaults, and label it as WTC reference caps rather than live exposure or live account capacity. Target part: Tortila portfolio-risk understanding.
3. Severity: High. The best slice should be shared at the component level because both settings and guided setup already use the same Tortila table. Evidence: settings passes `TortilaSymbolConfigTable` with `sourceLabel`, no-live-apply source detail, and row save issue (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:542`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:548`); setup passes the same table and equivalent no-live-apply source detail (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:517`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:523`). Recommendation: implement the map once in `TortilaSymbolConfigTable`; add only narrow props for resolved portfolio caps/source metadata if needed. Target part: shared settings/setup UX surface.
4. Severity: Medium. Existing top-level panels already name the concept, but they do not give users a concrete row-level Tortila map. Evidence: `BotSetupControlCenter` has a `Coin strategy map` row whose detail says each coin keeps timeframe/system/risk/stop/add/TP settings (`apps/web/src/features/bots/BotSetupControlCenter.tsx:225`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:229`), and `BotOperationMapPanel` says Tortila's profile defines stop N, add step, max units, ATR period, TP, and portfolio caps (`apps/web/src/features/bots/BotOperationMapPanel.tsx:94`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:108`). Recommendation: after adding the table-local map, keep these panels as orientation/links, not the only explanation; point actions to the map anchor. Target part: control center and operation map coherence.
5. Severity: Medium. Default-vs-custom and no-live-control copy is already strong, so the next slice should preserve it instead of inventing new runtime language. Evidence: settings explains system default vs custom and says no live bot changes happen (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:347`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:395`); setup repeats the same source split (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:415`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:463`); the control center marks live control disabled (`apps/web/src/features/bots/BotSetupControlCenter.tsx:255`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:257`). Recommendation: map copy should use `saved WTC reference`, `draft preview`, and `updates after save` or real draft-aware wording; avoid `running`, `synced`, `applied`, `will open`, `connection verified`, `start`, `stop`, and `applyConfig` except as explicit negative guardrails. Target part: safety-sensitive copy.
6. Severity: Medium. Test coverage currently proves Tortila field presence and no false live ping, but it does not prove an understandable strategy map or before-save draft behavior. Evidence: rendered E2E asserts Tortila control center, `Coin strategy map`, per-coin fields, export preview, and no `Connection verified` (`tests/e2e/bot-settings.spec.ts:39`, `tests/e2e/bot-settings.spec.ts:62`); Legacy E2E already asserts the new `Trigger resolution map`, candidate cells, and before-save trigger/stage updates (`tests/e2e/bot-settings.spec.ts:80`, `tests/e2e/bot-settings.spec.ts:94`); static coverage only checks the Tortila table contains the editor/export markers (`tests/integration/bot-read-safety-static.test.ts:393`, `tests/integration/bot-read-safety-static.test.ts:404`). Recommendation: add focused static and Playwright coverage for the Tortila map heading, row-number anchors, at least one client-side edit reflected before save or explicit saved-reference-only copy, portfolio cap strip, mobile no-horizontal-scroll, and no live-control terms/actions. Target part: Phase 4.07 acceptance tests.

## Decisions
1. Best next UX slice: a compact `Tortila strategy map` in `TortilaSymbolConfigTable`, not a new page or backend feature.
2. The map should be advisory and WTC-reference scoped. It must not become persistence, entitlement, live-read, or live-control logic.
3. Preferred first implementation: derive from existing resolved rows and resolved top-level cap fields, then make per-row draft changes visible before save if the implementation stays narrow. If draft awareness is deferred, the copy must explicitly say the map reflects the saved/resolved profile loaded at page render.
4. Preserve the existing source model: system default, user custom version, or built-in fallback remain the settings source; exchange keys/journal snapshots remain separate evidence.

## Risks
1. A saved-only map that looks live or draft-aware could mislead users after they edit a row but before saving.
2. Putting portfolio caps only below the row cards leaves users comparing per-coin pyramid units against global caps by memory.
3. Adding runtime-sounding language to make the map feel more concrete would violate the current safety boundary.
4. A row map without anchors or row numbers would improve copy but not the actual row-finding problem.

## Verification/tests
RUN:
1. Read-only source/docs inspection with `rg` and numbered `Get-Content` slices.
2. Verified target handoff path did not already exist before writing.
3. Confirmed current branch/status before audit: branch `codex/bot-analytics-settings-canary-20260603`; worktree was already heavily dirty.

NOT RUN:
1. Playwright, Vitest, typecheck, lint, build, secret scan, governance check - skipped because this is an authorized read-only audit handoff with no product/test edits.
2. Live bot start/stop/apply, live diagnostics, exchange ping, worker tick, provider DB reads/writes, raw provider payload inspection, env/secret inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.

## Next actions
1. Implement `Tortila strategy map` inside `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` above the cards. Include row anchors (`#tortila-symbol-N`), source badge, row count, S1/S2 mix, and a dense table/list of coin, timeframe, system, risk, stop, add step, max units, ATR, and TP.
2. Pass resolved portfolio caps from settings/setup into the table or a small adjacent shared helper so max open symbols, max total units, units per direction, daily max loss, halt drawdown, and entry throttle are visible next to the per-coin rows.
3. Add focused tests in `tests/e2e/bot-settings.spec.ts`, `tests/integration/bot-config-review-static.test.ts`, and/or `tests/integration/bot-read-safety-static.test.ts` for map visibility, row findability, optional before-save draft updates, mobile no-horizontal-scroll, and absence of false live-control language.
