# phase-4-21-bot-settings-basic-path handoff
## Scope
Implement the first-viewport/basic settings path for user bot settings so Tortila and Legacy users can immediately see the simple path from source/defaults to coin/stage/caps, connection evidence, statistics, save/export, and live-control boundary before entering the long expert workbench.

This phase also fixed the security auditor's P2 finding: the Legacy export UI now matches the export endpoint's exact-one mapped provider pub_id rule.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-ux-auditor.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-security-auditor.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-gates-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/config-types.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-review-static.test.ts`

## Files changed
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-ux-auditor.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-security-auditor.md`
- `docs/handoffs/20260604-1525-bot-settings-basic-path-gates-auditor.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`

## Findings
1. Severity P1 - First-viewport settings clarity was still too indirect. Evidence: the settings page had a strong `BotSetupControlCenter`, readiness, continuity, review, operation map, and then the detailed editor, but no compact user path that tied source/default/custom, first coin, stage/caps, key/pub_id, statistics, export, and live boundary into one visible checklist. Recommendation: add a top-level read-only quick path immediately after the control center. Target part: user settings first viewport.
2. Severity P1 - The new quick path must stay non-mutating. Evidence: existing settings save/system-default/preset flows already run through CSRF-protected server actions and shared config-action handlers. Recommendation: implement `BotSettingsQuickPath` as a server-rendered navigation/status component only; no new client state, no new API route, no adapter calls. Target part: `apps/web/src/features/bots/BotSettingsQuickPath.tsx`.
3. Severity P2 - Legacy export UI was weaker than the endpoint's fail-closed rule. Evidence: security auditor found the UI blocked only zero mapped accounts while `config-export-handler` requires exactly one safe mapped provider account. Recommendation: change UI gating to `legacyExportProviderCount !== 1` and add static plus route-handler regression coverage for multiple mapped accounts. Target part: Legacy export card and quick-path export row.
4. Severity P1 - Browser acceptance should cover both products and mobile. Evidence: new quick-path copy/actions appear above long expert tables, where mobile overflow is most likely. Recommendation: extend `bot-settings.spec.ts` to assert Tortila/Legacy quick-path layers and rerun desktop and mobile projects. Target part: `tests/e2e/bot-settings.spec.ts`.

## Decisions
- Launched the required read-only agents before edits:
  - `019e91b9-c3b7-7c82-a283-233c456438b5` -> `docs/handoffs/20260604-1525-bot-settings-basic-path-ux-auditor.md`
  - `019e91ba-08f0-7b50-8444-6f83dc8e38dd` -> `docs/handoffs/20260604-1525-bot-settings-basic-path-security-auditor.md`
  - `019e91ba-50e6-7d12-87c0-f276451c10ea` -> `docs/handoffs/20260604-1525-bot-settings-basic-path-gates-auditor.md`
- Added `BotSettingsQuickPath` as a pure UI/status/navigation component; it links to existing anchors and routes only.
- Kept the existing settings editor, CSRF actions, source selector, readiness map, continuity monitor, review panel, and operation map intact.
- Fixed Legacy export UI to require exactly one mapped provider pub_id, matching the endpoint.
- Started a local dev server on `http://localhost:3410` for visual/browser work. In-app Browser reached the local login page and DOM, but its click/cookie APIs timed out or were read-only for authenticated settings navigation. Browser acceptance is therefore based on Playwright desktop/mobile runs plus inspected retained screenshots.
- Closed all three background agents before this aggregate/final report.

## Risks
- The repository was already heavily dirty before this phase; several files touched by tests are untracked from earlier phases, so this handoff reports the files this phase intentionally used/modified but does not claim the whole worktree is clean.
- `npm run build -w @wtc/web` was not run; only typecheck, lint, Vitest, Playwright, quick gate, secret scan, governance, visual inventory, and diff whitespace were run.
- Admin selected-user DB matrix, disposable DB migrations, and worker continuity acceptance were not run in this narrow UI/settings phase.
- In-app Browser authenticated navigation could not be completed because Browser plugin interactions timed out on click and page-scope cookie writes are read-only; Playwright browser coverage did complete on desktop and mobile.

## Verification/tests
RUN:
- `git status --short --branch` - branch `codex/bot-analytics-settings-canary-20260603`; heavily dirty worktree observed before edits.
- `npx vitest run tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-config-review-static.test.ts` - 4 files, 19 tests passed.
- `npm run typecheck -w @wtc/web` - passed.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench renders safe coin configuration"` - 2 tests passed: desktop and mobile.
- `npm run lint` - passed.
- `node scripts/gates.mjs quick` - passed 4/4: lint, typecheck, typecheck-web, test.
- `npm run secret:scan` - passed.
- `npm run governance:check` - 0 errors, 1 known historical warning for `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
- `npm run evidence:visual -- --inventory` - 103 image files, 0 blocked binary/container artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.
- `git diff --check` - passed.
- Local dev server `http://127.0.0.1:3410` - responded 200.
- In-app Browser - connected, loaded `/login`, confirmed visible login DOM; authenticated settings navigation not completed due Browser plugin interaction limitations.
- Visual inspection of retained Playwright screenshots:
  - `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
  - `tests/e2e/screenshots/bot-legacy-settings-mobile.png`

NOT RUN:
- `npm run build -w @wtc/web` - skipped to keep this phase bounded after typecheck/lint/quick/Playwright passed.
- `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `npm run ci:local` - skipped; quick gate and focused browser/static gates covered this slice.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - not required; no schema/migration changes.
- `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix` - skipped; no admin selected-user DB loader changes in this phase.
- `npm run accept:worker:continuity` - skipped; no worker/runtime continuity code changed in this phase.
- Clipboard permission/stub proof - skipped; this phase did not change clipboard behavior.
- Live bot start/stop/apply-config, live exchange ping, live provider mutation, SSH/tmux/deploy - not run by safety policy and out of scope.

## Next actions
1. Continue with a broader settings usability pass only after a new phase: inline presets/default chooser polish, guided empty-state coin creation, and admin read-only selected-user settings/statistics refinement.
2. Add a dedicated ambiguous Legacy mapping browser fixture when a disposable DB matrix phase is scheduled, so the exact-one UI state is proven with rendered data, not only static and handler tests.
3. Keep live bot control, live exchange ping, and provider mutation out until separate security and bot-integration audits approve those adapter/control paths.
