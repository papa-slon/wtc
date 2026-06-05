# ecosystem-tests-runner handoff
## Scope
Verify the current bot analytics/settings richness changes only. Scope covered richer legacy bot reference settings, safe legacy config export shape, advanced bot analytics in `@wtc/analytics`, the bot statistics UI panels, and the current phase handoffs. No live servers or bots were mutated.

## Files inspected
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/package.json`
- `packages/analytics/src/advanced.ts`
- `packages/analytics/src/advanced.test.ts`
- `packages/analytics/src/index.ts`
- `packages/analytics/src/metrics.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-ux-statistics-auditor.md`
- `package.json`
- `vitest.config.ts`

## Files changed
- `docs/handoffs/20260603-1147-ecosystem-tests-runner.md`

## Findings
1. Severity: Medium. The focused bot statistics static gate is red because `tests/integration/bot-statistics-static.test.ts:48` still expects `/Symbol performance/`, while the current implementation has replaced that panel with `Symbol contribution` in `apps/web/src/features/bots/statistics-panels.tsx:349`. Recommendation: update the static test to assert the new advanced statistics panels (`Symbol contribution`, returns, risk, trade quality, heatmap, distribution) while preserving the "no fabricated unavailable data" intent. Target part: bot statistics static coverage.
2. Severity: Info. Advanced analytics are exported and covered by focused unit tests: `packages/analytics/src/index.ts` exports `computeAdvancedAnalytics`, `packages/analytics/src/advanced.ts:326` computes returns/risk/symbol/daily/distribution/exposure output, and `packages/analytics/src/advanced.test.ts:18` covers symbol contribution, daily PnL, and distribution. Recommendation: keep these unit tests in the focused bot analytics gate. Target part: analytics package.
3. Severity: Info. The inspected legacy settings/export path remains WTC-side/reference-only: `apps/web/src/features/bots/config.ts:539` exports safe bot config, `apps/web/src/features/bots/config.ts:575` emits native settings/stage data without exchange credentials, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:158` labels the export as safe JSON. Recommendation: keep live apply disabled until the legacy adapter/security audits clear B3. Target part: legacy config/export safety.

## Decisions
- Did not modify product code or tests during this verification pass; only the required handoff was written.
- Treated the failing bot statistics static assertion as a coverage drift/blocker for this phase rather than silently updating it as tests-runner.
- Ran focused bot analytics/read/config/statistics gates first, then compile/lint/build gates to separate test assertion drift from runtime/build breakage.

## Risks
- The phase is not fully green until `tests/integration/bot-statistics-static.test.ts` is updated or the implementation restores the old `Symbol performance` label intentionally.
- Full `npm test` was not run after the focused suite failed; it may reveal unrelated failures outside this bot analytics/settings slice.
- No Playwright visual/manual browser pass was run, so responsive layout quality for the richer statistics/settings UI remains unverified in this session.

## Verification/tests
RUN:
- `npx vitest run packages/analytics/src/advanced.test.ts packages/analytics/src/metrics.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-statistics-static.test.ts` - FAIL. 4 files passed, 1 file failed. 40 tests passed, 1 failed. Failure: `tests/integration/bot-statistics-static.test.ts:48` expected `/Symbol performance/`.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run build -w @wtc/web` - PASS.

NOT RUN:
- Full `npm test` - skipped because the focused bot statistics static suite is already red on an in-scope assertion and full test sweep would broaden beyond this verification slice.
- Playwright/e2e/browser visual pass - skipped to avoid starting local servers in this tests-runner slice; no live server or bot mutation was allowed.
- Live bot/API checks, service restarts, DB migrations, and secret-bearing config reads - intentionally not run by scope and safety rules.
- `npm run secret:scan` - not run; bot-config-export static coverage checked the in-scope export code for key/live-apply patterns without printing broad repository findings.

## Next actions
1. Update `tests/integration/bot-statistics-static.test.ts` to match the renamed/new advanced statistics panels or intentionally restore the old `Symbol performance` label.
2. Re-run the focused vitest command after that fix, then run full `npm test` if the focused gate is green.
3. Add a visual/browser pass for `/app/bots/statistics?bot=legacy` and legacy bot settings/setup once a non-live local preview is approved for UI verification.
