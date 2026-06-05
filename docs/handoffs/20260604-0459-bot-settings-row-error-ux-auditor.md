# bot-settings-row-error-ux-auditor handoff
## Scope
Read-only Phase 3.96 audit of bot settings/setup save-error UX for invalid Tortila and Legacy settings.

Focus was limited to per-symbol and per-stage invalid rows, the use-system-default marker, and avoiding live-control claims. No product code, tests, package files, generated artifacts, live services, env files, vaults, SSH, tmux, systemd, provider DB, exchange endpoints, worker tick/restart, or bot start/stop/apply/retest path was edited or invoked.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
11. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `apps/web/src/features/bots/config-review.ts`
15. `tests/e2e/bot-settings.spec.ts`
16. `tests/integration/bot-config-action-handler.test.ts`
17. `tests/integration/bot-config-review-static.test.ts`
18. `tests/integration/bot-config-source-audit-static.test.ts`
19. `tests/integration/bot-config-export-static.test.ts`
20. `tests/integration/user-resolved-bot-config-static.test.ts`
21. `tests/integration/admin-global-bot-config-static.test.ts`
22. `tests/integration/bot-runtime-config-sanitizer.test.ts`
23. `tests/integration/bot-readiness-server-dto-static.test.ts`

## Files changed
None - read-only audit. This handoff file is the only permitted write.

## Findings
1. Severity: High. Invalid row identity is already available during parsing, but the save action drops it before the UI can render a targeted error. Evidence: `botConfigFormIssues()` emits strings such as `Tortila coin ${i + 1}`, `Legacy coin ${i + 1}`, and `Legacy stage ${i + 1}` in `apps/web/src/features/bots/config.ts:413`, `apps/web/src/features/bots/config.ts:435`, `apps/web/src/features/bots/config.ts:472`, and `apps/web/src/features/bots/config.ts:486`; `handleSaveBotConfigAction()` collapses any non-empty issue list to `routes.configError` in `apps/web/src/features/bots/config-action-handler.ts:158`; settings/setup route that to only `?err=config` in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:115` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:82`. Recommendation: make the smallest contract extension by returning a structured first issue from the form parser, then redirect with safe row metadata such as `err=config&scope=legacy-stage&row=2&field=rsiSlots&reason=range`; do not store raw submitted values in DB/session and do not include secrets or provider IDs. Target part: save action error contract.
2. Severity: High. Settings/setup currently show only generic top banners, so users cannot tell which coin or stage blocked the save. Evidence: settings renders "Configuration was not saved" with generic detail at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:257`; setup renders "Check your inputs" with generic detail at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:451`; both pages pass only rows/source props into `TortilaSymbolConfigTable` and `LegacyAveragingConfigTable` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:504` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:511`, with the same shape in setup at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:473` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:480`. Recommendation: add a shared `saveIssue` prop to both row tables, highlight only the matching row/field, render a compact inline `role="alert"` message, set `aria-invalid`/`aria-describedby` on the input, and link the top banner to the row anchor. Target part: per-row settings UX.
3. Severity: Medium. The Legacy stage table has a useful "over capacity" preview, but it is not a substitute for row-targeted submit errors and should not be presented as live validation coverage. Evidence: stage capacity status is derived from the loaded rows/stages and local signal state at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:321`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:327`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:342`; the actual submit validation for `legacy_stage_slot_*`, `legacy_stage_rsi_*`, and `legacy_stage_cci_*` happens separately in `apps/web/src/features/bots/config.ts:476`. Recommendation: first target invalid `Legacy stage N` save errors to the exact stage row and capacity input; leave richer live capacity recalculation for a later controlled-input slice. Target part: Legacy per-stage invalid row clarity.
4. Severity: Medium. The use-system-default marker exists, but a failed custom save does not explicitly reassure users that the inherited/default source remains active and no live bot or saved version changed. Evidence: settings computes `system v${state.systemDefault.version}`, `custom v${state.version}`, or built-in fallback at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:227`; the source card marks "Use system default" active/available at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:325`; selecting the default writes only the marker config note `use-system-default:...` in `apps/web/src/features/bots/config.ts:986`. Recommendation: when `err=config` is row-targeted, include a short sentence beside the row issue: "Active source remains system vN/custom vN; this failed draft was not saved and was not applied to the live bot." Target part: source-state reassurance.
5. Severity: Low. Current tests prove the generic error banner and no-live-control boundaries, but not row-targeted error rendering. Evidence: Playwright only asserts the generic settings error at `tests/e2e/bot-settings.spec.ts:33`; static/review tests assert row-table presence and live-control exclusions at `tests/integration/bot-config-review-static.test.ts:73`; action-handler tests assert no-write behavior for forbidden/locked failures at `tests/integration/bot-config-action-handler.test.ts:248`. Recommendation: add focused tests for structured `botConfigFormIssues` output, `handleSaveBotConfigAction` redirect metadata, table `saveIssue` rendering, and a no-screenshot browser assertion for one invalid Tortila row plus one invalid Legacy stage row. Target part: acceptance coverage.

## Decisions
1. No product or test code was edited.
2. The smallest recommended implementation is a deterministic first-error metadata path from existing form validation to existing row tables.
3. The recommendation intentionally avoids cookies/session storage, DB writes, provider calls, adapter calls, and live-control wording.
4. Playwright was not run because the relevant spec writes screenshots/artifacts and the audit scope asked to avoid artifact-writing Playwright.

## Risks
1. The worktree was already heavily dirty, including the inspected settings/setup/config files; this audit preserved those changes.
2. If row issue metadata is encoded in the URL, it must use safe enums/indices/field keys, not raw user-entered symbols, provider identifiers, keys, or JSON.
3. Client row tables are client components, while validation lives server-side; keep shared issue types simple and serializable to avoid importing server-only code into client modules.
4. A first-error-only slice is intentionally small; users with multiple invalid rows will need a follow-up summary/count after the first targeted fix lands.

## Verification/tests
RUN:
1. Required protocol/status/handoff docs read before writing this handoff.
2. `git status --short --branch` read before and after inspection; dirty state was preserved.
3. Focused static/runtime boundary check: `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/admin-global-bot-config-static.test.ts` - PASS, 4 files / 21 tests.

NOT RUN:
1. Playwright / `tests/e2e/bot-settings.spec.ts` - skipped because it writes screenshots/artifacts.
2. Full `npm test`, typecheck, lint, build, full e2e, and governance - skipped for read-only audit scope.
3. Live bot start/stop/apply/retest, exchange/provider calls, worker tick/restart, SSH, tmux, systemd, env/vault/secret inspection, and provider DB checks - forbidden by scope.

## Next actions
1. Add a small structured issue type near `config.ts`/`config-action-handler.ts` that identifies `scope`, `row`, `field`, and a safe reason enum for the first invalid save issue.
2. Pass the parsed issue from settings/setup into `TortilaSymbolConfigTable` and `LegacyAveragingConfigTable`; highlight the matching row/input and keep the source marker visible.
3. Add focused tests for invalid Tortila row, invalid Legacy coin row, invalid Legacy stage row, locked/default no-write behavior, and no live-control/provider-secret strings.
