# ecosystem-security-auditor handoff
## Scope
Read-only source/security audit for the current Tortila top-level portfolio cap validation path and safety boundaries around `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick`.

This audit stayed inside local source inspection. It did not inspect env values or secrets, call provider APIs, ping exchanges, mutate live servers, start/stop/apply/retest bots, run worker ticks, or claim current live runtime enforcement.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`
4. `apps/web/src/features/bots/config.ts`
5. `apps/web/src/features/bots/config-action-handler.ts`
6. `apps/web/src/features/bots/config-error-copy.ts`
7. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/features/bots/config-review.ts`
11. `tests/integration/bot-read-safety-static.test.ts`
12. `tests/integration/bot-config-action-handler.test.ts`
13. `tests/integration/bot-config-review-static.test.ts`

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260604-0954-tortila-cap-validation-source-security-auditor.md`.

## Findings
1. Severity: High. Evidence: `apps/web/src/features/bots/config.ts:63`, `apps/web/src/features/bots/config.ts:68`, `apps/web/src/features/bots/config-action-handler.ts:165`, `apps/web/src/features/bots/config-action-handler.ts:176`, `apps/web/src/features/bots/config.ts:1110`. Current cap saves are schema-backed and pass through access resolution, forbidden form-key rejection, product schema parsing, and final persistence parsing before a version is saved. Recommendation: keep the cap fields on this server-side path only; do not add client-only acceptance or runtime/apply shortcuts. Target part: Tortila settings/setup save validation.
2. Severity: Medium. Evidence: `apps/web/src/features/bots/config.ts:479`, `apps/web/src/features/bots/config.ts:481`, `apps/web/src/features/bots/config-error-copy.ts:141`, `apps/web/src/features/bots/config-error-copy.ts:146`. Invalid cap errors are safely grouped as global Tortila errors: portfolio limits, risk limits, and entry throttle. The copy is safe but generic. Recommendation: use exact allowed-range copy without runtime claims: "Max open symbols must be 1-20, max total units 1-50, and units per direction 1-30"; "Drawdown halt must be 1-95% and daily max loss 0.5-50%"; "Max new entries per tick must be a whole number from 1-20." Target part: cap validation error copy.
3. Severity: Medium. Evidence: `apps/web/src/features/bots/config.ts:564`, `apps/web/src/features/bots/config.ts:590`, `apps/web/src/features/bots/config.ts:559`, `apps/web/src/features/bots/config-action-handler.ts:169`, `apps/web/src/features/bots/config-action-handler.ts:176`. `botConfigFormIssues()` returns early for Tortila row/duplicate issues and does not itself collect top-level cap failures; cap failures are caught by the later schema parse plus `botConfigFirstFormIssue()`. Recommendation: add targeted tests that invalid cap values redirect with `tortila-portfolio-limit`, `tortila-risk-limit`, or `tortila-entry-throttle` and never call persistence; document that cap validation lives in the schema parse path. Target part: validation tests and action-handler contract.
4. Severity: Medium. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:110`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:118`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:361`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:369`. The cap map's draft-pressure display falls back to default numeric values for blank/non-numeric drafts and the inputs do not show min/max or invalid state before submit. Recommendation: add inline allowed-range hints or client draft validation that says the draft will be rejected on save; keep it framed as "WTC reference profile validation," not live enforcement. Target part: Tortila portfolio cap UI.
5. Severity: Low. Evidence: `apps/web/src/features/bots/config-action-handler.ts:51`, `apps/web/src/features/bots/config-action-handler.ts:86`, `apps/web/src/features/bots/config.ts:864`, `apps/web/src/features/bots/config.ts:896`. The action-layer forbidden form-key list includes `exchangeapply`, `exchangeorder`, and `livecontrol`, while the persistence-layer recursive forbidden config-key list stops at `testexchange`. Schema parsing still prevents these unknown keys from being saved, but the deny-list drift weakens defense-in-depth and future readability. Recommendation: centralize or synchronize the forbidden bot config key set and add a parity/static test. Target part: config safety boundary.
6. Severity: High. Evidence: `AGENTS.md:76`, `AGENTS.md:82`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:85`, `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md:6`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:342`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:396`, `tests/integration/bot-read-safety-static.test.ts:202`, `tests/integration/bot-read-safety-static.test.ts:204`. Current copy and tests correctly preserve the live-control boundary: draft preview, WTC reference caps, no live exchange apply, no adapter calls, no vault open, no start/stop/apply/retest, and no connection-verified claims. Recommendation: continue forbidding copy that says caps are live runtime enforcement, current exchange exposure, current position reports, synced live config, margin sufficiency, exchange proof, or permission to start/stop/apply/retest the bot. Target part: UI, errors, reviews, handoffs, and acceptance reports.

## Decisions
1. Treat the six cap fields as WTC-side reference profile fields only.
2. Treat cap validation as server-side schema validation with safe grouped global error copy, not live runtime enforcement.
3. Do not claim runtime Tortila enforcement, exchange exposure, live config sync, or provider/API proof from these sources.
4. This file is a single per-agent read-only handoff, not an aggregate phase handoff and not an N-agent audit claim.

## Risks
1. Runtime Tortila truth can drift from WTC reference config until a separate audited source/runtime snapshot and diff phase exists.
2. The cap UI can show fallback-based draft-pressure statuses before save even when a user has typed an invalid cap value.
3. Cap errors are currently global, not inline field-targeted, so users may need clearer allowed-range copy to fix failures quickly.
4. The broad worktree was already heavily dirty before this audit; this handoff did not attempt to separate or revert unrelated changes.
5. No automated tests were executed in this read-only handoff-only lane, so recommendations rely on static source inspection.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and a large pre-existing dirty tree.
2. Static source inspection of the files listed above - completed with line evidence.

NOT RUN:
1. `npx vitest ...` - skipped because this was a read-only source/security handoff with no product-code edits.
2. `npm run typecheck`, `npm run lint`, `npm run build`, Playwright, and full local CI - skipped because this lane wrote only the handoff and did not change code.
3. Live bot start/stop/apply/retest, live diagnostics, exchange ping/order/position reads, provider/API calls, worker tick, DB migration/seed, env/secret inspection, deploy, SSH, tmux, or systemd - skipped by safety scope.

## Next actions
1. Add focused invalid-cap tests for all three cap error groups and assert no persistence on rejection.
2. Tighten cap error copy with exact ranges while preserving WTC reference/no-live-apply language.
3. Add inline cap input range hints or draft invalid states in `TortilaSymbolConfigTable`.
4. Synchronize the action-layer and persistence-layer forbidden key deny-lists, preferably through one shared constant plus a static parity test.
5. Start a separate audited runtime/source phase before showing current live Tortila config, runtime diffs, exchange proof, or any start/stop/apply/retest capability.
