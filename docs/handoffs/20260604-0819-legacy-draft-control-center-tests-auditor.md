# legacy-draft-control-center-tests-auditor handoff
## Scope
Read-only Phase 4.05 tests/rendered audit for the Legacy top control-center unsaved stage-capacity draft warning. Scope was limited to identifying robust focused tests for this behavior: before save, editing `legacy_stage_rsi_0` and `legacy_stage_cci_0` to `0` should surface a `Draft stage capacity warning` / unsaved over-capacity row in `BotSetupControlCenter`, link to `#legacy-stage-1` (or setup strategy URL plus that anchor), avoid live-control strings, and be covered on desktop and mobile.

No product, test, or existing docs were edited. No live bot start/stop/apply/retest, no provider DB, no env/secret inspection, no exchange ping, no worker tick, no live service mutation.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`
8. `tests/e2e/bot-settings.spec.ts`
9. `tests/integration/bot-config-review-static.test.ts`
10. `tests/integration/bot-read-safety-static.test.ts`
11. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
12. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
16. `package.json`
17. `playwright.config.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. The current working tree already contains the intended draft bridge from `LegacyAveragingConfigTable` to `BotSetupControlCenter`: the table dispatches `LEGACY_STAGE_CAPACITY_DRAFT_EVENT`, the control center listens for it, and the active draft issue inserts a `Draft stage capacity warning` row with state `Unsaved over capacity` and `Review stage` action. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:108`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:160`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:273`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:277`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:281`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:291`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:298`. Recommendation: keep the event bridge focused on WTC-side draft capacity only; do not route through provider/runtime state. Target part: top control-center draft warning.

2. Severity: High. The current static read-safety gate is red because the draft detail copy includes the live-control term `retest`. Evidence: `apps/web/src/features/bots/BotSetupControlCenter.tsx:162` says saving does not apply or retest the Legacy bot; `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` failed 1 of 29 tests at `tests/integration/bot-read-safety-static.test.ts:174` because `BotSetupControlCenter.tsx` matched the forbidden live-control regex. Recommendation: replace the draft suffix with wording that avoids `retest` and other live-control terms, for example "Saving stores a WTC reference version only; live bot actions remain disabled." Target part: no-live-control copy and static guard.

3. Severity: Medium. The rendered tests now exercise the right pre-save edit path in both setup and settings, including filling `legacy_stage_rsi_0` and `legacy_stage_cci_0` to `0`, asserting `/0 RSI used`, `/0 CCI used`, `over capacity`, draft warning label, draft detail, and the stage link. Evidence: setup path assertions at `tests/e2e/bot-settings.spec.ts:215` to `tests/e2e/bot-settings.spec.ts:225`; settings path assertions at `tests/e2e/bot-settings.spec.ts:248` to `tests/e2e/bot-settings.spec.ts:258`. Recommendation: make the warning-row locator row-scoped and explicitly assert `Unsaved over capacity` on that same row. Target part: Playwright acceptance robustness.

4. Severity: Medium. The current rendered no-live-control assertion is page-level but incomplete: it checks `Connection verified|applyConfig|startBot|stopBot`, while the observed blocker is `retest`. Evidence: current setup assertion is at `tests/e2e/bot-settings.spec.ts:225`; current settings assertion is at `tests/e2e/bot-settings.spec.ts:269`; static guard fails on `retest` at `tests/integration/bot-read-safety-static.test.ts:174`. Recommendation: after locating the draft warning row, assert that row does not contain `Connection verified|applyConfig|startBot|stopBot|retest`; avoid banning all page-level human safety labels because the control center intentionally contains live-control boundary copy. Target part: rendered no-live-control regression.

5. Severity: Medium. Static tests now guard the draft bridge symbols and copy, but they should remain paired with rendered checks because the bridge is browser-event behavior. Evidence: `tests/integration/bot-config-review-static.test.ts:138` to `tests/integration/bot-config-review-static.test.ts:186` checks the draft event, labels, and table dispatch code; `tests/integration/bot-read-safety-static.test.ts:120` to `tests/integration/bot-read-safety-static.test.ts:141` checks the same safety contract. Recommendation: keep static tests as wiring/safety sentries, not as the only acceptance proof. Target part: static test scope.

## Decisions
1. This lane stayed read-only and wrote only this required handoff.
2. No background agents were spawned from this auditor lane; this handoff is the per-agent artifact for the assigned tests/rendered audit.
3. The focused acceptance gate should be two rendered Playwright runs, one desktop and one mobile, plus the static Vitest guardrails.
4. The draft warning test should be row-scoped to `BotSetupControlCenter`, because the page intentionally contains separate live-control boundary messaging.

## Risks
1. Current static guardrail is not green until the `retest` copy is removed or the safety test is intentionally narrowed.
2. Desktop/mobile rendered gates were not run in this audit, so the current draft behavior is not observed green on rendered viewports in this session.
3. The worktree is already broadly dirty and several relevant files are untracked or modified; treat this audit as current-working-tree evidence, not committed baseline evidence.
4. The current event bridge depends on client-side `window` events; rendered tests are necessary because static tests cannot prove event delivery.

## Verification/tests
RUN:
1. Read required protocol/current-state docs and Phase 4.04 aggregate.
2. Inspected `tests/e2e/bot-settings.spec.ts`, static tests, `BotSetupControlCenter`, `LegacyAveragingConfigTable`, `config-review`, and settings/setup pages.
3. `git status --short --branch` - observed a broadly dirty worktree with relevant untracked/modified files.
4. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - FAILED: 1 failed, 28 passed. Failure: `tests/integration/bot-read-safety-static.test.ts:174` forbids live-control strings and matched `retest` in `BotSetupControlCenter.tsx`.

EXACT FOCUSED COMMANDS TO RUN AFTER COPY/TEST FIX:
1. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts`
2. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit`
3. `npm exec eslint -- apps/web/src/features/bots/BotSetupControlCenter.tsx apps/web/src/features/bots/LegacyAveragingConfigTable.tsx tests/e2e/bot-settings.spec.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts`
4. `$env:E2E_PORT='3426'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --grep "bot setup renders effective review|Legacy stage over-capacity advisory"`
5. `$env:E2E_PORT='3427'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile --grep "bot setup renders effective review|Legacy stage over-capacity advisory"`

NOT RUN:
1. Desktop Playwright focused gate - not run to avoid starting even a local rendered dev server from this read-only audit lane; exact command listed above.
2. Mobile Playwright focused gate - not run for the same reason; exact command listed above.
3. Full `npm test`, full `npm run lint`, full typecheck matrix, build, coverage, full e2e, CI, governance check, secret scan - skipped because this was a narrow tests/rendered audit and the focused static gate is already red.
4. Live bot start/stop/apply/retest/position-close, provider DB, env/vault/secret reads, exchange ping, worker tick, tmux/systemd/service checks, deploy, GitHub commit/push/PR - not run by explicit safety boundary.

## Next actions
1. Replace the `retest` draft detail in `BotSetupControlCenter` with non-live-control wording.
2. In `tests/e2e/bot-settings.spec.ts`, use a row-scoped draft warning locator and assert `Draft stage capacity warning`, `Unsaved over capacity`, the unsaved draft detail, the correct stage link, and absence of `Connection verified|applyConfig|startBot|stopBot|retest` in that row for both setup and settings.
3. Run the exact focused static, typecheck, eslint, desktop, and mobile commands listed above before any Phase 4.05 aggregate claims this gate green.
