# Phase 4.67 bot settings catalog/admin polish handoff
## Scope
Implemented a focused UI/product correctness slice for the active two-bot objective: shared instrument catalog/picker for Legacy and Tortila settings, admin Tortila default cap de-duplication, setup wizard encoding polish, and rendered regression coverage. This phase launched 3 read-only agents before edits. It did not deploy, query production DBs, restart bots, apply configs, test exchange keys, or run live-control endpoints.

Agent handoffs:
- [docs/handoffs/20260606-0240-bot-ux-settings-auditor.md](20260606-0240-bot-ux-settings-auditor.md)
- [docs/handoffs/20260606-0240-bot-source-truth-auditor.md](20260606-0240-bot-source-truth-auditor.md)
- [docs/handoffs/20260606-0240-bot-verification-auditor.md](20260606-0240-bot-verification-auditor.md)

## Files inspected
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `packages/shared/src/index.ts`
- `tests/e2e/bot-settings.spec.ts`
- `scripts/gates.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
- `packages/shared/src/instrument-catalog.ts`
- `packages/shared/src/instrument-catalog.test.ts`
- `packages/shared/src/index.ts`
- `apps/web/src/features/bots/InstrumentPicker.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `tests/e2e/bot-settings.spec.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260606-0240-bot-ux-settings-auditor.md`
- `docs/handoffs/20260606-0240-bot-source-truth-auditor.md`
- `docs/handoffs/20260606-0240-bot-verification-auditor.md`
- `docs/handoffs/20260606-0240-phase-467-bot-settings-catalog-admin-polish.md`

## Findings
1. Severity: High. Bot settings now use a shared catalog source instead of duplicated hardcoded UI lists. Evidence: `packages/shared/src/instrument-catalog.ts`, `apps/web/src/features/bots/InstrumentPicker.tsx`, `LegacyAveragingConfigTable.tsx`, `TortilaSymbolConfigTable.tsx`. Recommendation: future exchange/catalog expansion should update `@wtc/shared`, not per-page UI lists. Target part: bot settings symbol selection.
2. Severity: High. Admin Tortila system defaults no longer render duplicate portfolio-cap fields. Evidence: `apps/web/src/app/admin/bots/config/page.tsx` excludes embedded Tortila fields, and `tests/e2e/bot-settings.spec.ts` asserts each cap input appears once. Recommendation: keep `TortilaSymbolConfigTable` the canonical cap editor for Tortila defaults. Target part: admin global defaults.
3. Severity: Medium. Setup wizard completion marker now avoids Unicode mojibake risk. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` uses `OK`, and setup e2e checks body text against mojibake markers. Recommendation: keep wizard state indicators ASCII or design-system icon based. Target part: guided onboarding polish.
4. Severity: P0. Legacy realized analytics remains source-blocked; this phase did not alter that boundary. Evidence: `docs/handoffs/20260606-0240-bot-source-truth-auditor.md`. Recommendation: do not claim full Legacy realized stats until source packet/API/table exists. Target part: Legacy closed-trade importer.
5. Severity: P0. Tortila canonical source/prod perimeter remains a separate required phase. Evidence: `docs/handoffs/20260606-0240-bot-source-truth-auditor.md`. Recommendation: canonicalize source/token/network/burn-in before production-complete claim. Target part: Tortila production source gate.

## Decisions
- Chose a UI-only implementation slice because it directly improves the user requirement "choose coin from a list" without touching live bot control.
- Kept manual symbol entry as a guarded fallback through datalist inputs.
- Kept live-control and exchange ping disabled.
- Treated `accept:bots:rendered` as required for this UI slice, then reran it after one unrelated transient `ECONNRESET` in TV smoke.

## Risks
- The shared catalog is still static plus runtime-symbol merge; a future exchange instrument feed can replace it, but current behavior is safer than duplicated UI lists.
- Full production completion is still not achieved: Legacy closed-trade proof, Tortila canonical source, provider mapping proof/burn-in, and deploy monitoring remain open.
- Long Playwright rendered runs can mutate `apps/web/next-env.d.ts`; this generated diff was reverted after test runs.

## Verification/tests
RUN:
1. `npm test -- packages/shared/src/instrument-catalog.test.ts` - PASS, 2 tests.
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `npm run lint` - PASS.
5. `git diff --check` - PASS.
6. `$env:E2E_PORT='3417'; npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --grep "bot settings workbench|bot setup renders|admin bot defaults"` - PASS, 3 tests.
7. First `npm run accept:bots:rendered` with 10-minute timeout - NOT GREEN; timeout was too short for the known 12+ minute rendered pack, and generated artifacts were cleaned.
8. Second `npm run accept:bots:rendered` - NOT GREEN; `64 passed`, one unrelated mobile TV smoke `ECONNRESET` on `/api/e2e/login`.
9. `$env:E2E_PORT='3471'; npx playwright test tests/e2e/smoke.spec.ts --project=mobile --grep "TV admin queue"` - PASS, proving the isolated failing TV smoke path.
10. Final `npm run accept:bots:rendered` - PASS; `bot-admin-e2e` 65 passed, `visual-inventory` PASS.

NOT RUN:
1. Managed DB/admin/user/worker gates - not touched in this UI-only slice.
2. `npm run accept:tortila:real-read:managed` - Tortila source/auth not changed.
3. Production deploy/canary monitor - no deploy in this phase.
4. Live bot start/stop/apply-config, exchange ping, `/api/marks`, `/api/overview` - intentionally out of scope and unsafe without a separate audited phase.

## Next actions
1. Run final doc/security gates after this handoff is written: governance and secret scan.
2. Start the next source/prod phase: Tortila canonical source/token/network/burn-in.
3. Start Legacy source packet work before any realized analytics/import claims.
4. Add a later UX pass for locked override forms as true read-only previews.
