# Phase 4.08 - Tortila portfolio caps map handoff

## Scope
Embed top-level Tortila portfolio caps into the existing Tortila strategy map so coin rows, Turtle buckets, pyramid budget, directional unit cap, halt thresholds, and entry throttle are reviewed in one WTC reference-profile surface.

This phase stayed inside WTC-side settings/setup UI, static tests, and rendered E2E coverage. It did not inspect secrets, ping exchanges, call provider APIs, mutate live servers, start/stop/apply/retest bots, run worker ticks, or claim current live runtime enforcement.

## Per-agent handoffs
1. [docs/handoffs/20260604-0926-tortila-portfolio-caps-ux-auditor.md](20260604-0926-tortila-portfolio-caps-ux-auditor.md)
2. [docs/handoffs/20260604-0926-tortila-portfolio-caps-source-auditor.md](20260604-0926-tortila-portfolio-caps-source-auditor.md)
3. [docs/handoffs/20260604-0926-tortila-portfolio-caps-tests-security-auditor.md](20260604-0926-tortila-portfolio-caps-tests-security-auditor.md)

All three background agents were closed after their results were collected.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/STATUS.md`
4. `docs/IMPLEMENTED_FILES.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`
7. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-review.ts`
12. `apps/web/src/features/bots/config-types.ts`
13. `tests/e2e/bot-settings.spec.ts`
14. `tests/integration/bot-config-review-static.test.ts`
15. `tests/integration/bot-read-safety-static.test.ts`
16. `playwright.config.ts`
17. `package.json`
18. Agent handoff files listed above

## Files changed
1. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
4. `tests/e2e/bot-settings.spec.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `docs/handoffs/20260604-0926-tortila-portfolio-caps-ux-auditor.md`
8. `docs/handoffs/20260604-0926-tortila-portfolio-caps-source-auditor.md`
9. `docs/handoffs/20260604-0926-tortila-portfolio-caps-tests-security-auditor.md`
10. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`

The repository was already heavily dirty before this phase; unrelated dirty files were not reverted or claimed.

## Findings
1. Severity: High. Phase 4.07 left top-level Tortila caps outside the strategy map, forcing users to compare portfolio budget below the coin/Turtle review. Evidence: `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`. Recommendation: show portfolio caps directly inside the Tortila strategy-map card. Target part: Tortila settings/setup strategy editor.
2. Severity: High. Safe cap labels already exist and match source/security guidance: max open symbols, max total units, max units per direction, drawdown halt, daily loss halt, and entries per tick. Evidence: `apps/web/src/features/bots/config.ts`; `docs/handoffs/20260604-0926-tortila-portfolio-caps-source-auditor.md`. Recommendation: reuse those labels as WTC reference/draft settings only. Target part: cap map copy.
3. Severity: High. Portfolio caps must not imply live exchange exposure, current runtime config, margin sufficiency, synced config, or live enforcement. Evidence: `AGENTS.md`; `docs/SESSION_PROTOCOL.md`; source/security handoff. Recommendation: keep copy on "WTC reference caps", "draft preview", and "no live exchange apply". Target part: UI safety boundary.
4. Severity: Medium. Settings/setup shared the same Tortila table but rendered cap fields in the generic field grid after it. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`. Recommendation: remove Tortila caps from the generic grid and pass current/default cap values into the shared table using the same form field names. Target part: form wiring.
5. Severity: Medium. The existing E2E suite shared one demo server across desktop/mobile projects, so Legacy stage-capacity draft assertions could become saved-state assertions after desktop saved a custom profile. Evidence: first Playwright run on port 3432 passed 14 tests and failed 2 mobile Legacy checks. Recommendation: choose a draft cap value different from the current field value before asserting draft warnings. Target part: rendered test determinism.

## Decisions
1. Added a `Portfolio caps` section inside `Tortila strategy map`, above the Turtle bucket table.
2. Made cap inputs controlled draft state inside `TortilaSymbolConfigTable`, preserving submitted field names: `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick`.
3. Added a cap pressure table with `Portfolio guardrail`, `Reference cap`, `Draft pressure`, and `Status`.
4. Used advisory statuses only: `draft inside reference cap`, `reference cap reached`, `draft over reference cap`, `no draft usage`, and `saved reference`.
5. Filtered Tortila `symbols` plus the six cap fields out of the lower generic field grid in settings/setup, so form names are not duplicated.
6. Kept Legacy behavior unchanged except for E2E test determinism around shared demo state.

## Risks
1. Runtime Tortila truth can still drift from WTC reference config until a separate approved runtime snapshot/diff phase exists.
2. Top-level cap validation errors remain global, not row-targeted, because this phase only moved/edit-previewed the cap controls.
3. Admin defaults still use their current shared table/generic-field behavior; this phase focused user settings/setup surfaces.
4. The broad worktree remains heavily dirty from prior phases, so final review should separate this phase's files from unrelated existing changes.

## Verification/tests
RUN:
1. `npx eslint "apps/web/src/features/bots/TortilaSymbolConfigTable.tsx" "apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx" "apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx" "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-config-review-static.test.ts" "tests/integration/bot-read-safety-static.test.ts" --max-warnings 0` - passed.
2. `npm run typecheck -w @wtc/web` - passed.
3. `npx vitest run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - passed, 29 tests.
4. `npm run typecheck` - passed.
5. `npm run secret:scan` - passed.
6. `$env:E2E_PORT='3432'; npx playwright test tests/e2e/bot-settings.spec.ts` - first rendered run found 14 passed and 2 mobile Legacy deterministic-state failures; no Tortila cap assertion failed.
7. `$env:E2E_PORT='3434'; npx playwright test tests/e2e/bot-settings.spec.ts` - passed, 16 tests across desktop and mobile.
8. Visual screenshot inspection with `tests/e2e/screenshots/bot-tortila-settings-desktop.png` and `tests/e2e/screenshots/bot-tortila-setup-strategy-mobile.png` - portfolio caps are present in the strategy map; Playwright `noHScroll` checks stayed green.
9. `git diff --check -- apps/web/src/features/bots/TortilaSymbolConfigTable.tsx 'apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx' tests/e2e/bot-settings.spec.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md` - passed.
10. `npm run governance:check` - passed with 0 errors; one known historical warning for `20260529-1921-integration-risk-auditor.md`.

NOT RUN:
1. Live bot start/stop/apply/retest, live diagnostics, position close, exchange ping, order/mark reads, `/api/marks` - skipped by safety scope.
2. Env/secret value inspection, vault open, raw provider payload reads - skipped by safety scope.
3. Worker tick, provider DB read/write, DB migration/generate/seed - skipped; not needed for this UI/reference-map slice.
4. Production/canary deploy or mutation, SSH, tmux, systemd - skipped.
5. Full e2e matrix, coverage, full `ci:local`, build - skipped in favor of focused gates for this slice.

## Next actions
1. Add top-level cap validation E2E for `tortila-portfolio-limit`, `tortila-risk-limit`, and `tortila-entry-throttle`.
2. Decide whether admin system defaults should also use the embedded cap map rather than a generic lower grid.
3. Start a separate audited source/runtime phase before showing current live Tortila config, runtime diff, exchange proof, or any live apply/start/stop capability.
