# legacy-stage-live-preview-tests-auditor handoff
## Scope
Read-only Phase 4.04 tests/rendering audit for the smallest robust coverage around Legacy stage usage live preview. Scope was limited to confirming how `legacy_stage_rsi_0` / `legacy_stage_cci_0` edits should be tested before save, ensuring both settings and setup rendered paths stay covered, preserving no live-control text and no horizontal scroll assertions, and keeping static tests aligned. No live services, provider DB, env/secrets, worker tick, exchange ping, start/stop/apply/retest, or product/test/docs edits were performed except this required handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`
8. `tests/e2e/bot-settings.spec.ts`
9. `tests/integration/bot-config-review-static.test.ts`
10. `tests/integration/bot-read-safety-static.test.ts`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/config-review.ts`
13. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
16. `package.json`
17. `apps/web/package.json`

## Files changed
None — read-only audit. Required handoff written at `docs/handoffs/20260604-0759-legacy-stage-live-preview-tests-auditor.md`.

## Findings
1. Severity: High. The client table already has the live preview mechanism: stage capacities are controlled by `stageDrafts`, the RSI/CCI capacity inputs update that draft state, and the usage/status pills render from the draft values before submit. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:102` initializes signal and stage draft state; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:115` derives stage totals from drafts; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:122` derives usage without a save; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:408` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:422` render controlled `legacy_stage_rsi_${i}` / `legacy_stage_cci_${i}` inputs; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:437` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:442` render the live usage/status pills. Recommendation: test the row-level pills as the before-save oracle; do not require the server-rendered setup-control advisory to update before save. Target part: Legacy stage live preview.

2. Severity: Medium. Current Playwright coverage already asserts settings-side live preview before save, then saves and checks the persisted advisory routing. Evidence: `tests/e2e/bot-settings.spec.ts:237` opens Legacy settings, `tests/e2e/bot-settings.spec.ts:238` fills `legacy_stage_rsi_0`, `tests/e2e/bot-settings.spec.ts:239` fills `legacy_stage_cci_0`, `tests/e2e/bot-settings.spec.ts:241` to `tests/e2e/bot-settings.spec.ts:243` assert `/0 RSI used`, `/0 CCI used`, and `over capacity` before the save click at `tests/e2e/bot-settings.spec.ts:244`. Recommendation: keep these assertions but extract them into a helper that can be reused for setup. Target part: `tests/e2e/bot-settings.spec.ts`.

3. Severity: Medium. Setup renders the same `LegacyAveragingConfigTable`, but setup pre-save live preview is not directly asserted; current setup coverage only checks rendered labels/no-scroll before save and then verifies persisted advisory routing after settings save. Evidence: setup renders the table at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:525`; current setup visibility/no-scroll checks are at `tests/e2e/bot-settings.spec.ts:202` to `tests/e2e/bot-settings.spec.ts:216`; persisted setup advisory checks are at `tests/e2e/bot-settings.spec.ts:257` to `tests/e2e/bot-settings.spec.ts:265`. Recommendation: add the same before-save live-preview helper on `/app/bots/legacy/setup?step=strategy`, fill stage 1 to a known safe value, then fill `0/0` and assert the row pills/status update without submitting. Target part: setup rendered coverage.

4. Severity: Medium. The setup-control stage warning is intentionally saved/server-derived, so it is the wrong before-save oracle. Evidence: `apps/web/src/features/bots/config-review.ts:169` to `apps/web/src/features/bots/config-review.ts:208` compute saved config capacity issues; settings passes that issue at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:210` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:264`; setup passes it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:284`; the warning row is inserted at `apps/web/src/features/bots/BotSetupControlCenter.tsx:251`. Recommendation: preserve the existing post-save advisory routing assertions separately from pre-save row-pills assertions. Target part: test design.

5. Severity: Low. Static tests are aligned with high-level stage/advisory strings but do not yet pin the controlled draft-state contract that makes the live preview work. Evidence: `tests/integration/bot-config-review-static.test.ts:168` to `tests/integration/bot-config-review-static.test.ts:180` checks stage capacity labels/status strings; `tests/integration/bot-read-safety-static.test.ts:130` to `tests/integration/bot-read-safety-static.test.ts:145` checks anchor/error wiring; `tests/integration/bot-read-safety-static.test.ts:441` to `tests/integration/bot-read-safety-static.test.ts:443` checks stage capacity surface presence. Recommendation: add static assertions for `useState`, `stageDrafts`, `setStageDrafts`, `value={draft.rsiSlots}`, `value={draft.cciSlots}`, `overRsi`, `overCci`, and the two input-name templates so a future uncontrolled-input regression is caught without rendering. Target part: static tests.

6. Severity: Low. Existing e2e helpers already support the safety/rendering assertions this slice needs. Evidence: `tests/e2e/bot-settings.spec.ts:6` defines the document horizontal-scroll check; live-control absence checks already exist for Legacy paths at `tests/e2e/bot-settings.spec.ts:134`, `tests/e2e/bot-settings.spec.ts:156`, `tests/e2e/bot-settings.spec.ts:254`, and `tests/e2e/bot-settings.spec.ts:264`; setup/settings no-scroll checks exist at `tests/e2e/bot-settings.spec.ts:89`, `tests/e2e/bot-settings.spec.ts:215`, `tests/e2e/bot-settings.spec.ts:255`, and `tests/e2e/bot-settings.spec.ts:265`. Recommendation: reuse those helpers and assertions in the new setup before-save branch instead of adding a second visual framework. Target part: rendering guardrails.

## Decisions
1. Recommend a tiny test-only implementation: reuse one Playwright helper for Legacy stage live preview on both settings and setup.
2. Treat row-level usage/status pills as the only before-save live preview oracle.
3. Keep the setup-control `Stage capacity warning` assertions as post-save/persisted-config coverage.
4. Keep static alignment in the existing static guard files; no new test file is necessary.
5. Do not introduce provider/runtime/live-control checks for this slice.

## Risks
1. `tests/e2e/bot-settings.spec.ts` currently saves an over-capacity Legacy config in the advisory test; this is acceptable for the existing persisted-advisory proof, but future edits should avoid relying on prior test state. The live-preview helper should fill known values before asserting.
2. The worktree was already broadly dirty before this audit, including the inspected files. This audit does not assign ownership of those pre-existing changes.
3. Running the full e2e spec writes screenshots for unrelated tests. For this slice, use a grep-focused Playwright run unless the operator explicitly wants the wider screenshot pass.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and the latest Phase 4.03 aggregate handoff.
2. Inspected `tests/e2e/bot-settings.spec.ts`, both named static test files, `LegacyAveragingConfigTable`, `config-review`, `BotSetupControlCenter`, and settings/setup pages with line-numbered evidence.
3. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and a pre-existing dirty worktree.

NOT RUN:
1. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - not run because this was a read-only audit with no test edits.
2. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` and `npm exec tsc -- --noEmit` - not run because no product/test code changed.
3. `npm exec eslint -- 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts' 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx'` - not run because no product/test code changed.
4. Playwright desktop/mobile - not run because no test edits were made and the audit scope forbade live-service style activity; recommended focused commands are below.
5. `npm run secret:scan`, `git diff --check`, and `npm run governance:check` - not run because this auditor only wrote a handoff.
6. Full `npm test`, full `npm run lint`, full build, full CI matrix, coverage, preview, live provider DB, worker ticks, exchange pings, env/secret/vault inspection, bot start/stop/apply/retest - not run by explicit scope and safety policy.

## Next actions
1. Update `tests/e2e/bot-settings.spec.ts` by extracting a helper such as `expectLegacyStageLivePreview(page)` that:
   - locates `#legacy-stage-1`;
   - fills `legacy_stage_rsi_0` to `3` and `legacy_stage_cci_0` to `2`;
   - asserts `/3 RSI used`, `/2 CCI used`, and `inside capacity|full`;
   - fills both fields to `0`;
   - asserts `/0 RSI used`, `/0 CCI used`, and `over capacity`;
   - asserts no `Connection verified|applyConfig|startBot|stopBot` text and no horizontal scroll on the current page.
2. Call that helper once on `/app/bots/legacy/settings` before the existing save/advisory assertions, and once on `/app/bots/legacy/setup?step=strategy` before any setup submit. Keep the existing saved advisory route checks for `Review stage`.
3. Add static guards in `tests/integration/bot-config-review-static.test.ts` and/or `tests/integration/bot-read-safety-static.test.ts` for `stageDrafts`, `setStageDrafts`, `value={draft.rsiSlots}`, `value={draft.cciSlots}`, `legacy_stage_rsi_${i}`, `legacy_stage_cci_${i}`, `overRsi`, and `overCci`.
4. Recommended focused commands after those edits:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts
npm exec tsc -- -p apps/web/tsconfig.json --noEmit
npm exec eslint -- 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts' 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx'
$env:E2E_PORT='3423'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --grep "Legacy stage"
$env:E2E_PORT='3424'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile --grep "Legacy stage"
npm run secret:scan
git diff --check
npm run governance:check
```

5. Do not run live bot controls, provider DB mutations, exchange pings, worker ticks, env/secret inspection, start/stop/apply/retest, or any broad production/live gate for this slice.
