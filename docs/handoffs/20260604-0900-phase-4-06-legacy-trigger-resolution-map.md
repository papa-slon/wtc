# phase-4-06-legacy-trigger-resolution-map handoff
## Scope
Narrow Phase 4.06 implementation slice: make Legacy settings/setup explain how multiple RSI/CCI coin rows resolve by stage and trigger bucket before save. The Legacy editor now includes a compact `Trigger resolution map` that groups the current WTC draft by stage, shows RSI and CCI candidates with row number, symbol, timeframe, and threshold, and updates when the user changes trigger, stage, status, symbol, timeframe, or trigger thresholds locally.

Out of scope: live Legacy bot start/stop/apply, live diagnostics, exchange ping, worker tick, provider DB mutation/read, raw provider payloads, env/secret inspection, production/canary service checks, broad bot completion, and unrelated dirty worktree cleanup.

Per-agent handoffs collected:
1. `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md`
2. `docs/handoffs/20260604-0836-legacy-trigger-resolution-source-auditor.md`
3. `docs/handoffs/20260604-0836-legacy-trigger-resolution-tests-security-auditor.md`

All three background agents were closed after their handoffs were collected.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`
8. `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md`
9. `docs/handoffs/20260604-0836-legacy-trigger-resolution-source-auditor.md`
10. `docs/handoffs/20260604-0836-legacy-trigger-resolution-tests-security-auditor.md`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `tests/e2e/bot-settings.spec.ts`
13. `tests/integration/bot-config-review-static.test.ts`
14. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
1. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
2. `tests/e2e/bot-settings.spec.ts`
3. `tests/integration/bot-config-review-static.test.ts`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md`

## Findings
1. Severity: High. The user-facing gap is reduced: the Legacy editor now shows how current draft coin rows sit in stage RSI/CCI buckets, instead of forcing users to mentally scan up to 14 row cards. Evidence: `LegacyAveragingConfigTable.tsx` adds `Trigger resolution map`, `stageResolutionRows`, `candidateSummary`, and draft candidate labels. Recommendation: keep this map near the top of the shared Legacy table so both settings and setup benefit. Target part: Legacy settings/setup clarity.
2. Severity: High. The map is draft-aware for the fields users naturally edit while resolving capacity: symbol, manual symbol override, status, timeframe, trigger, trigger threshold, row stage, and stage capacity. Evidence: local `rowDrafts`, `stageDrafts`, `updateRowDraft`, and rendered Playwright checks that switch row `#1` from RSI to CCI and move it into Stage 2 before save. Recommendation: keep candidate math local/advisory and never use it as persistence or authorization. Target part: client-side draft model.
3. Severity: High. Source-truth wording stays conservative: the map says candidates are independent and that WTC does not assign hidden priority order. It does not claim a live coin will open, is next, or has real provider capacity. Evidence: source auditor handoff flags live priority/open/capacity claims as requiring separate approved runtime proof. Recommendation: do not add "will fire", "next", "running config", "sync", "apply", or "retest" copy to this map. Target part: Legacy runtime boundary.
4. Severity: Medium. Safety copy was tightened: `live draft inside capacity` was replaced with `draft preview inside capacity`. Evidence: focused static/read-safety tests and rendered tests were updated and passed. Recommendation: keep `live` reserved for explicit negative guardrails or real observed runtime state. Target part: no-live-control wording.
5. Severity: Medium. Mobile behavior is verified through real rendered tests. The initial mobile assertion used hidden table headers and failed; the test now targets visible `td[data-label]` cells, matching the responsive card-stack structure. Recommendation: future mobile table tests should assert visible data cells, not hidden headers. Target part: responsive e2e coverage.

## Decisions
1. The map lives inside `LegacyAveragingConfigTable` so settings and setup share one implementation.
2. Candidate labels show row number, symbol, timeframe, and trigger threshold before save.
3. Paused rows and blank coin rows are explicitly excluded from the draft map and do not consume capacity.
4. The map is a WTC reference/draft explanation only; it does not read provider state, start workers, ping exchanges, or apply config.
5. This phase does not claim the full Legacy/Tortila website objective is complete. It closes only the Legacy trigger-resolution clarity slice.

## Risks
1. The broader worktree remains heavily dirty from previous phases; this handoff scopes ownership only to the files changed in Phase 4.06.
2. The map can be spoofed or manipulated in the browser like any client advisory UI; it must never become an entitlement, persistence, provider, or live-control source.
3. The map still does not prove live Legacy bot firing order, active slot state, or real-time capacity. Those require a separate approved provider-snapshot/runtime phase.
4. Full CI/build/coverage were not run in this phase because the scope was a focused UI/safety slice.

## Verification/tests
RUN:
1. Required protocol/current-state docs were read before edits, and three read-only agents were launched before edits.
2. UX/product auditor handoff: `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md`.
3. Source-truth auditor handoff: `docs/handoffs/20260604-0836-legacy-trigger-resolution-source-auditor.md`.
4. Tests/security auditor handoff: `docs/handoffs/20260604-0836-legacy-trigger-resolution-tests-security-auditor.md`.
5. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 44 tests.
6. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
7. `npm exec eslint -- 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts'` - PASS.
8. `npm exec tsc -- --noEmit` - PASS.
9. `$env:E2E_PORT='3428'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 8 tests.
10. `$env:E2E_PORT='3429'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 8 tests.
11. `npm run secret:scan` - PASS.
12. `git diff --check` - PASS.
13. `npm run governance:check` before this aggregate - PASS with known historical warning while current phase still pointed to Phase 4.05.

NOT RUN:
1. Full `npm test`, full `npm run lint`, build, coverage, full CI, and full e2e matrix - skipped because Phase 4.06 is a focused UI/safety slice and targeted static/type/lint/rendered gates passed.
2. Live bot start/stop/apply, live config push, live diagnostics, position close, worker tick, exchange ping, provider DB mutation/read, raw provider payload inspection, env/secret value inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.
3. Git commit, push, PR - not requested.

## Next actions
1. Continue the broader goal with another Legacy/Tortila completion slice; do not mark the full bot website/settings/statistics objective complete yet.
2. Candidate next slice: make the top control center surface benign unsaved draft state, or enrich admin/user statistics drilldowns with similarly concrete "what this number means" explanations.
3. Keep live bot operation, exchange ping, provider DB evidence, and admin/system configuration behind separate security and bot-integration phases.
