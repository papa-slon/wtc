# bot-settings-export-ux-auditor handoff
## Scope
Phase 4.19 read-only UX/product audit for Tortila and Legacy settings/setup browser surfaces around config export/copy exactness, generated Tortila `SYMBOL_CONFIGS` draft preview, export link behavior, and whether users can distinguish WTC reference settings from live apply/control.

This was a single foreground audit lane. No background agents were spawned, no N-agent audit is claimed, and no background agents were left open.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- Existing retained screenshots:
  - `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
  - `tests/e2e/screenshots/bot-tortila-settings-mobile.png`
  - `tests/e2e/screenshots/bot-legacy-settings-desktop.png`
  - `tests/e2e/screenshots/bot-legacy-settings-mobile.png`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - evidence `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:302`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:613`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:617`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:622`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:526`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:531`, `apps/web/src/features/bots/config-export-handler.ts:56`, `apps/web/src/features/bots/config-export-handler.ts:64` - the Tortila screen shows two export-like truths: the `Generated SYMBOL_CONFIGS (draft)` block is derived from unsaved client `rowDrafts`, while the only action, `Download config export`, downloads the saved `state.current` reference. The preview is a static text `div`, so there is no exact copy action for the visible draft. Recommendation: split the actions explicitly into `Copy draft SYMBOL_CONFIGS` beside the preview and `Download last saved reference export` in the export card; show copy success/error state and label when draft differs from the saved version. Target part: Tortila settings/setup export/copy exactness.
2. Severity P1 - evidence `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:100`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:159`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:174`, `apps/web/src/features/bots/config-export.ts:164`, `apps/web/src/features/bots/config-export.ts:178`, `tests/e2e/bot-settings.spec.ts:99`, `tests/e2e/bot-settings.spec.ts:101` - the Tortila draft preview has its own client serializer and permissive numeric coercion, separate from the server export serializer. Browser coverage checks one happy-path generated row after a risk edit, but does not prove blank/invalid/incomplete draft rows render as invalid rather than runtime-looking output, nor that preview and exported content stay byte-equivalent after future edits. Recommendation: move the bot-native `SYMBOL_CONFIGS` formatter into one shared pure module used by both draft preview and export, make invalid draft fields show an inline invalid/export-blocked state, and add focused unit plus browser assertions for exact output. Target part: generated Tortila `SYMBOL_CONFIGS` draft preview.
3. Severity P2 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:526`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:529`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:531`, `apps/web/src/features/bots/config-export-handler.ts:56`, `apps/web/src/features/bots/config-export-handler.ts:60`, `apps/web/src/features/bots/config-export-handler.ts:61`, `tests/integration/bot-config-export-route-handler.test.ts:155`, `tests/integration/bot-config-export-route-handler.test.ts:165` - the Legacy export card presents a generic reference-config download, but the handler intentionally returns `provider_mapping_required` when no verified provider mapping exists. That failure condition is not surfaced at the export action, so a user can believe the WTC reference export is safe and available, click it, then receive a raw blocked JSON response. Recommendation: either allow Legacy WTC saved-reference export without provider mapping because provider ids are stripped, or disable the link with inline copy such as `Export unavailable until one active pub_id is mapped`; add browser coverage for both states. Target part: Legacy settings export affordance and provider/reference mental model.
4. Severity P2 - evidence `tests/e2e/bot-settings.spec.ts:99`, `tests/e2e/bot-settings.spec.ts:103`, `tests/e2e/bot-settings.spec.ts:155`, `tests/e2e/bot-settings.spec.ts:156`, `tests/integration/bot-config-export-route-handler.test.ts:172`, `tests/integration/bot-config-export-route-handler.test.ts:196`, `tests/integration/bot-config-export-route-handler.test.ts:203`, `tests/integration/bot-config-export-route-handler.test.ts:237` - route-handler tests prove safe attachment bodies for synthetic configs, and browser tests prove the link and one preview string are visible, but no browser test clicks the export link, waits for a download, and verifies the downloaded body against the visible saved/draft state. There is also no clipboard assertion because no copy UI exists. Recommendation: add Playwright `download` assertions for Tortila `.env` and Legacy `.json`, and when the draft copy button lands, assert clipboard text exactly equals the rendered `SYMBOL_CONFIGS` text in settings and setup mode. Target part: export/copy acceptance gates.

Positive evidence: the overall WTC-reference-vs-live-apply language is strong. The settings source copy says custom settings are not pushed to the live bot (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:418`), the save behavior metric says `WTC version only` with no live-control adapter actions (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:352`), setup reiterates WTC-only storage and disabled apply/start/stop (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:341`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:354`), and the operation/control maps mark live apply/control disabled (`apps/web/src/features/bots/BotSetupControlCenter.tsx:257`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:91`).

## Decisions
- Kept the audit read-only. No code, tests, fixtures, screenshots, or generated artifacts were changed.
- Did not run Playwright, Vitest, lint, typecheck, dev server, or export-route browser requests because this audit was allowed to write only one handoff file and those gates can create or refresh local artifacts.
- Treated this as one per-agent auditor handoff, not a broad/multi-agent phase. No N-agent claim is made.
- Existing retained screenshots were inspected read-only; they support that the page is dense but readable and consistently labels WTC reference/save boundaries.

## Risks
- A user can copy from the visible Tortila draft preview manually while the download link exports the last saved reference, creating a stale or mismatched runtime config outside WTC.
- Future changes can drift client preview serialization from server export serialization because the formatter exists in two places.
- Legacy users without a mapped provider pub_id may hit a blocked JSON response from an action that visually reads as a safe reference export.
- Current browser acceptance can stay green while export/download bytes or future clipboard behavior regress, because it checks presence more than end-to-end exactness.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and the Phase 4.18 aggregate handoff.
- Read-only source inspection of the requested settings/setup, table, route, handler, and export files.
- Read-only test inspection of `tests/e2e/bot-settings.spec.ts`, `tests/integration/bot-config-export-static.test.ts`, `tests/integration/bot-config-export-route-handler.test.ts`, `tests/integration/user-resolved-bot-config-static.test.ts`, and `tests/integration/bot-read-safety-static.test.ts`.
- Read-only visual inspection of existing retained settings screenshots for Tortila and Legacy desktop/mobile.
- `git status --short --branch` observed a heavily dirty pre-existing worktree before this handoff; this audit did not attempt to revert or clean it.

NOT RUN:
- `npx playwright test tests/e2e/bot-settings.spec.ts` - skipped because it writes/refreshes test artifacts and this audit was limited to one handoff write.
- Browser click/download/export-route verification - skipped for the same one-write read-only constraint; recommended as the next acceptance gate.
- Clipboard/copy verification - skipped because no copy UI exists yet.
- `npx vitest run ...`, `npm run typecheck -w @wtc/web`, `npm run lint`, `node scripts/gates.mjs quick|full`, `npm run build -w @wtc/web` - skipped because this was an audit-only pass with no code changes.
- Live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - skipped by non-negotiable gates.

## Next actions
1. Add a Tortila `Copy draft SYMBOL_CONFIGS` control with exact text copied from the rendered draft preview, success/error feedback, and browser clipboard coverage.
2. Rename or relabel the existing export action to `Download last saved reference export`, and show when the visible draft has unsaved changes.
3. Decide whether Legacy reference export should be independent of provider mapping; if not, disable the export action with an inline provider-mapping requirement.
4. Add browser download assertions for Tortila `.env` and Legacy `.json` export content, plus setup-mode coverage for the draft preview/copy path.
