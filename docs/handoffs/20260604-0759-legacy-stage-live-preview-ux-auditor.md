# legacy-stage-live-preview-ux-auditor handoff
## Scope
Read-only Phase 4.04 UX/product audit for the next narrow Legacy settings/setup slice: stage usage should update live when a user edits RSI/CCI capacity inputs before saving, while staying WTC-side only and not implying live bot control. Focus areas: premium clarity, labels/copy, no horizontal overflow, and whether the behavior should be live client preview or save-blocking.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`
7. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
8. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
9. `apps/web/src/features/bots/config-review.ts`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
12. `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The Legacy stage table already provides the core live client preview for RSI/CCI capacity edits: `LegacyAveragingConfigTable` is a client component, keeps `stageDrafts` in local state, derives stage totals from that state, and recomputes over-capacity status from the current draft before save. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:1`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:105`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:115`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:372`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:413`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:427`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:437`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:442`. Recommendation: treat the next slice as polishing and promoting this live draft signal, not as inventing a save-blocking validation rule. Target part: Legacy stage table draft preview.

2. Severity: High. The top `Bot setup control center` remains saved/resolved-config driven, so its stage warning can lag behind the table while the user is typing. Settings/setup compute `legacyStageCapacityIssue` from `cur` on the server and pass it to `BotSetupControlCenter`; the control center only inserts the warning when that prop exists. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:207`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:210`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:249`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:264`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:214`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:269`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:284`, and `apps/web/src/features/bots/BotSetupControlCenter.tsx:251`. Recommendation: add a small client-side Legacy preview bridge for settings/setup that feeds the current draft capacity issue into the same control-center row, with copy such as `Draft stage capacity warning` or `Unsaved capacity preview`. Target part: top setup-control advisory.

3. Severity: Medium. The right UX model is advisory live preview, not save-blocking. Phase 4.03 explicitly kept over-capacity advisory separate from hard validation, and the current E2E proves the table can show `/0 RSI used`, `/0 CCI used`, and `over capacity` before save, then shows the top warning only after saving. Evidence: `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md:3`, `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md:90`, `tests/e2e/bot-settings.spec.ts:237`, `tests/e2e/bot-settings.spec.ts:240`, `tests/e2e/bot-settings.spec.ts:243`, `tests/e2e/bot-settings.spec.ts:244`, and `tests/e2e/bot-settings.spec.ts:246`. Recommendation: preserve save behavior; over-capacity should warn the user that the draft is not ready, but should not imply the form was rejected unless an actual validation issue exists. Target part: product behavior and validation semantics.

4. Severity: Medium. Copy already has strong WTC-side safety cues, but the draft warning needs even sharper unsaved-state wording so users do not confuse it with live bot control or provider state. Evidence: the control center shows `live control disabled` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:282`; the live-control row says start/stop/live diagnostics/live apply are unavailable at `apps/web/src/features/bots/BotSetupControlCenter.tsx:233`; the Legacy table source detail says no live Legacy apply happens from the table at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:89`; setup copy says WTC-side intent is never applied to the live bot at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:513`; and settings save copy says saving appends a user-owned versioned profile at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:583`. Recommendation: keep action text as `Review stage`; use detail copy like `This is an unsaved WTC profile preview. Saving stores a reference version only; it does not apply or retest the Legacy bot.` Target part: labels and help copy.

5. Severity: Medium. Horizontal overflow is mostly protected by wrapped tables and explicit E2E checks, but the new draft-warning copy will add another potentially long control-center row. Evidence: `BotSetupControlCenter` wraps its step table in `.wtc-table-wrap` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:292`; the stage usage pills wrap at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:436`; current tests assert no horizontal scroll for Legacy settings at `tests/e2e/bot-settings.spec.ts:89`, over-capacity settings at `tests/e2e/bot-settings.spec.ts:255`, and over-capacity setup at `tests/e2e/bot-settings.spec.ts:265`. Recommendation: keep the live preview row short, avoid long unbroken tokens, and extend the E2E to assert no horizontal scroll immediately after typing the unsaved RSI/CCI capacity draft on both settings and setup. Target part: responsive layout and Playwright coverage.

6. Severity: High. The slice must remain WTC-side only; do not use `legacyLiveConfig`, provider DB, worker ticks, exchange calls, or any control adapter to compute the draft. Evidence: the seed forbids live server mutation and live bot control at `docs/handoffs/0000-orchestrator-seed.md:115` and `docs/handoffs/0000-orchestrator-seed.md:117`; `NEXT_ACTIONS` says richer Legacy UI is not permission for live Legacy control at `docs/NEXT_ACTIONS.md:13`; status says Legacy settings are WTC-side reference/export with no live Legacy apply at `docs/STATUS.md:6`; and the current over-capacity E2E asserts forbidden live-control strings stay absent at `tests/e2e/bot-settings.spec.ts:254` and `tests/e2e/bot-settings.spec.ts:264`. Recommendation: derive the preview only from editable form rows/stages already present on the page, and keep provider/runtime snapshots as read-only evidence elsewhere. Target part: safety boundary.

## Decisions
1. Recommend live client preview, not save-blocking, for RSI/CCI capacity overage.
2. Keep saved-config warning behavior as the baseline, but let an unsaved draft issue temporarily override or sit above it with explicit draft wording.
3. Keep the stage-row anchor/action pattern; `Review stage` remains the clearest premium action.
4. Keep all computation inside WTC UI state and pure config helpers; no live service, provider DB, worker, exchange, or adapter involvement.
5. Avoid turning the top warning into a readiness guarantee; it is a draft profile quality signal.

## Risks
1. Duplicating capacity math between `config-review.ts` and `LegacyAveragingConfigTable.tsx` can drift; prefer sharing or adapting the existing pure helper for draft rows/stages.
2. A client wrapper around `BotSetupControlCenter` and `LegacyAveragingConfigTable` must initialize from server props without hydration mismatch.
3. If the preview listens only to RSI/CCI capacity inputs, changing coin stage/status/signal before save may still leave other usage numbers stale; that is outside the requested narrow slice but should be named if deferred.
4. Long draft-state details in the control-center table can regress mobile width unless the E2E no-horizontal-scroll check is extended to the pre-save typed state.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and the Phase 4.03 aggregate handoff.
2. Inspected Legacy settings/setup page wiring, `BotSetupControlCenter`, `LegacyAveragingConfigTable`, `config-review.ts`, and `tests/e2e/bot-settings.spec.ts`.
3. Checked git branch/dirty state; worktree was already broadly dirty before this read-only handoff.
4. Performed static/read-only review only. No background agents were launched by this auditor; none are left running from this auditor.

NOT RUN:
1. `npm test`, Vitest, typecheck, lint, Playwright, build, secret scan, and governance check — not run because this role was read-only UX/product audit and no product/test/docs edits were made.
2. Live services, provider DB, env, secrets, worker ticks, exchange pings, start/stop/apply/retest, and live bot controls — not run by explicit scope and safety policy.

## Next actions
1. Implement a narrow client-side Legacy draft preview bridge that updates the control-center stage warning as RSI/CCI capacity inputs change before save.
2. Label the warning as unsaved/WTC-side draft preview and keep `Review stage` anchored to the existing rendered stage row.
3. Extend Playwright coverage to assert: typed capacity edits update table usage before save, the top draft warning appears before save on settings and setup, no forbidden live-control copy appears, and no horizontal overflow occurs.
