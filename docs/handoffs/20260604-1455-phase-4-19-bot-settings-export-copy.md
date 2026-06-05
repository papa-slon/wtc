# phase-4-19-bot-settings-export-copy handoff
## Scope
Phase 4.19 foreground implementation and acceptance for the Legacy/Tortila bot settings export/copy slice. The objective was to make the settings export surface clearer and safer: users can distinguish unsaved Tortila draft `SYMBOL_CONFIGS` from the last saved WTC reference export, the draft preview uses the same formatter as the export builder, Legacy export no longer looks clickable when the required provider `pub_id` mapping is missing, and export safety tests cover more secret/live-control markers.

Read-only background agents were launched before edits, per `AGENTS.md` / `docs/SESSION_PROTOCOL.md`.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md`
- `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-security-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-gates-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`

## Files changed
- `apps/web/src/features/bots/tortila-runtime-format.ts` - new shared pure Tortila runtime formatter for `SYMBOL_CONFIGS`.
- `apps/web/src/features/bots/config-export.ts` - export builder now uses the shared Tortila formatter instead of a local duplicate serializer.
- `apps/web/src/features/bots/config.ts` - re-exports the shared Tortila formatter instead of keeping a server-only duplicate serializer.
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` - draft preview now uses the shared formatter, opens by default, adds `Copy draft SYMBOL_CONFIGS`, and explicitly says copy is for visible unsaved draft while download uses the last saved WTC reference.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` - export action is relabeled to `Download last saved reference export`; Legacy with zero mapped `pub_id` shows a disabled `Export requires mapped pub_id` action and inline warning instead of an active link to a blocked JSON response.
- `tests/e2e/bot-settings.spec.ts` - browser assertions now prove exact `SYMBOL_CONFIGS` draft content after row edits, the copy-draft action value, Tortila saved export link href, and Legacy disabled provider-mapping export state.
- `tests/integration/bot-config-export-static.test.ts` - static assertions now lock shared formatter usage, copy-draft copy, saved-export copy, and Legacy disabled export copy.
- `tests/integration/bot-config-export-route-handler.test.ts` - hostile export fixtures now include sealed/wrapped key markers, DB/JOURNAL URL markers, admin/user fields, and nested live-control objects.
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md` - this aggregate handoff.

Retained screenshots reviewed:
- `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
- `tests/e2e/screenshots/bot-tortila-settings-mobile.png`
- `tests/e2e/screenshots/bot-legacy-settings-desktop.png`

## Agent handoffs
- UX/export audit: `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`
- Security/export audit: `docs/handoffs/20260604-1427-bot-settings-export-security-auditor.md`
- Gates/export audit: `docs/handoffs/20260604-1427-bot-settings-export-gates-auditor.md`

## Findings
1. Severity P1 - evidence `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` - the previous Tortila preview showed unsaved client draft text while the only export action downloaded saved reference config. Recommendation implemented: separate `Copy draft SYMBOL_CONFIGS` from `Download last saved reference export`, with visible copy explaining the source difference. Target part: Tortila settings export/copy mental model.
2. Severity P1 - evidence `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`, `apps/web/src/features/bots/tortila-runtime-format.ts`, `apps/web/src/features/bots/config-export.ts`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` - client preview and export builder used duplicate serializers. Recommendation implemented: shared pure formatter now feeds both preview and export. Target part: generated `SYMBOL_CONFIGS` exactness.
3. Severity P2 - evidence `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`, `apps/web/src/features/bots/config-export-handler.ts` - Legacy export could look available while the handler would return `provider_mapping_required`. Recommendation implemented for the current zero-mapping state: disabled action plus inline warning. Target part: Legacy export affordance.
4. Severity P2 - evidence `docs/handoffs/20260604-1427-bot-settings-export-security-auditor.md`, `tests/integration/bot-config-export-route-handler.test.ts` - export route tests missed several forbidden marker classes. Recommendation partially implemented: tests now include sealed/wrapped key, DB/JOURNAL URL, admin/user, and nested live-control markers. Target part: export leak regression coverage.

## Decisions
- Kept this as a local mock/browser and static export slice. No live bot controls, exchange/provider calls, DB migrate/seed/generate, raw env, or worker runtime actions were bundled.
- Did not add a real clipboard read assertion because Playwright clipboard permissions add avoidable flake. The browser test asserts the exact visible copy source via the `data-copy-value` on the copy button plus rendered preview text.
- Kept the Legacy route handler's fail-closed provider-mapping behavior and made the UI match it rather than changing the handler semantics in this phase.
- Used split `bot-settings.spec.ts --project=desktop` and `--project=mobile` full-file runs, matching the stable pattern from Phase 4.18.

## Risks
- The copy button has browser clipboard behavior but the automated gate verifies the exact data source, not OS clipboard contents.
- Legacy export remains unavailable without a mapped `pub_id`; that is now visible, but the product decision could still change later to allow saved-reference export independent of provider mapping.
- This phase does not prove real production DB saved export bytes from a disposable Postgres target.
- The worktree was already heavily dirty with many prior phase files before this phase. This handoff only claims the files listed above.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts` - passed, 2 files / 8 tests.
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts` - passed, 3 files / 33 tests.
- `npx eslint "apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx" "apps/web/src/features/bots/TortilaSymbolConfigTable.tsx" "apps/web/src/features/bots/config-export.ts" "apps/web/src/features/bots/config.ts" "apps/web/src/features/bots/tortila-runtime-format.ts" "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-config-export-static.test.ts" "tests/integration/bot-config-export-route-handler.test.ts" --max-warnings 0` - passed.
- `npm run typecheck -w @wtc/web` - passed.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench"` - passed, 2/2 desktop+mobile.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - passed, 10/10.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - passed, 10/10.
- `node scripts/gates.mjs quick` - passed, 4/4 gates: lint, typecheck, typecheck-web, test.
- `npm run evidence:visual -- --inventory` - passed inventory: 103 image files, 0 blocked binary/container artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.
- Manual visual review of `bot-tortila-settings-desktop.png`, `bot-tortila-settings-mobile.png`, and `bot-legacy-settings-desktop.png` - no obvious horizontal breakage, live-control claim, or unsafe export affordance observed.
- `git diff --check` - passed.

NOT RUN:
- `node scripts/gates.mjs core` / `full` - skipped because those include `db:generate`; this phase avoided DB/schema generation.
- `npm run evidence:visual -- --manifest <manifest>` - skipped because no visual review manifest was created; inventory plus manual screenshot review were performed.
- Real browser download body assertions - skipped; route-handler Vitest covers response body/header safety without a live browser download.
- OS clipboard read assertions - skipped to avoid browser permission flake; exact copy source is asserted in browser.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - skipped by phase scope.
- `npm run e2e:admin-user-bots:db`, managed DB e2e, worker continuity, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - skipped by safety policy and scope.

## Next actions
1. Add browser API/download assertions for `/api/bots/tortila/config-export` and the Legacy blocked response if we want rendered-browser proof beyond route-handler Vitest.
2. Decide product policy for Legacy saved-reference export without provider mapping; current implementation is fail-closed and visibly disabled.
3. Continue the next settings-quality slice: 375px cabinet/setup expansion or admin selected-user settings/statistics drilldown polish.
