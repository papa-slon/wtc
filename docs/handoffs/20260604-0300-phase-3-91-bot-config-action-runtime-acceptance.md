# phase-3-91-bot-config-action-runtime-acceptance handoff
## Scope
Phase 3.91 runtime acceptance slice for Legacy/Tortila settings and setup config actions. The phase launched three read-only agents before product/test edits, then extracted the duplicated settings/setup save, preset, and use-system-default control flow into a server-only-free dependency-injected helper. It added runtime Vitest coverage for success, invalid config, hidden forbidden FormData fields, locked default redirects, no-write counts on a migrated PGlite schema, preset behavior, system-default selection, and hard separation from live-control/network paths.

Per-agent handoffs:
1. [docs/handoffs/20260604-0300-bot-config-action-helper-architecture-auditor.md](20260604-0300-bot-config-action-helper-architecture-auditor.md)
2. [docs/handoffs/20260604-0300-bot-config-action-tests-auditor.md](20260604-0300-bot-config-action-tests-auditor.md)
3. [docs/handoffs/20260604-0300-bot-config-action-security-auditor.md](20260604-0300-bot-config-action-security-auditor.md)

All three background agents were closed before this aggregate report. No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, `.env`, vault secret inspection, SSH, tmux, systemd, or live server mutation was performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`
8. `docs/handoffs/20260604-0300-bot-config-action-helper-architecture-auditor.md`
9. `docs/handoffs/20260604-0300-bot-config-action-tests-auditor.md`
10. `docs/handoffs/20260604-0300-bot-config-action-security-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/bots/config.ts`
14. `apps/web/src/features/bots/config-action-handler.ts`
15. `apps/web/src/features/bots/config-export-handler.ts`
16. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
17. `apps/web/src/features/bots/meta.ts`
18. `apps/web/src/features/admin/actions.ts`
19. `packages/db/src/repositories.ts`
20. `packages/bot-adapters/src/control.ts`
21. `tests/integration/bot-config-action-handler.test.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/user-resolved-bot-config-static.test.ts`
24. `tests/integration/bot-config-source-audit-static.test.ts`
25. `tests/integration/admin-global-bot-config-db.test.ts`
26. `tests/integration/user-resolved-bot-config-db.test.ts`
27. `tests/integration/db-0002.test.ts`

## Files changed
1. `apps/web/src/features/bots/config-action-handler.ts`
2. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
4. `tests/integration/bot-config-action-handler.test.ts`
5. `tests/integration/bot-read-safety-static.test.ts`
6. `docs/handoffs/20260604-0300-bot-config-action-helper-architecture-auditor.md`
7. `docs/handoffs/20260604-0300-bot-config-action-tests-auditor.md`
8. `docs/handoffs/20260604-0300-bot-config-action-security-auditor.md`
9. `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`

## Findings
1. Severity: High. Fixed the untested page-local server-action branching by extracting a server-only-free action helper. Evidence: helper entrypoints are `handleSaveBotConfigAction`, `handleApplyBotPresetAction`, and `handleUseSystemDefaultBotConfigAction` at `apps/web/src/features/bots/config-action-handler.ts:148`, `apps/web/src/features/bots/config-action-handler.ts:176`, and `apps/web/src/features/bots/config-action-handler.ts:204`; settings wires the helper through injected deps at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103` and calls it at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:133`; setup wires/calls it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:71` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:140`. Recommendation: keep page files as thin CSRF/redirect/revalidate wrappers and add helper tests whenever new action outcomes appear. Target part: settings/setup action runtime architecture.
2. Severity: High. Added explicit forbidden hidden FormData rejection before parsing or persistence. Evidence: `forbiddenBotConfigActionFormKey` scans normalized form keys at `apps/web/src/features/bots/config-action-handler.ts:85`, and save/preset/default actions reject through config-error routes at `apps/web/src/features/bots/config-action-handler.ts:156`, `apps/web/src/features/bots/config-action-handler.ts:183`, and `apps/web/src/features/bots/config-action-handler.ts:211`; runtime tests cover `apiSecret`, `providerAccountId`, `rawJson`, `applyConfig`, `startBot`, and `stopBot` at `tests/integration/bot-config-action-handler.test.ts:143`. Recommendation: treat hidden secret/provider/raw/live-control form fields as malformed config, not as ignored extras. Target part: user FormData boundary.
3. Severity: High. Added locked-default runtime and no-write acceptance. Evidence: locked persist errors are mapped to locked redirects at `apps/web/src/features/bots/config-action-handler.ts:132`; runtime tests cover locked default routing at `tests/integration/bot-config-action-handler.test.ts:164`; the migrated PGlite test publishes a system default with `allowUserOverride: false`, attempts manual save, preset save, and hidden live-control field save, and asserts `bot_instances`, `bot_configs`, and `bot_config_versions` counts are unchanged at `tests/integration/bot-config-action-handler.test.ts:221`. Recommendation: keep lock policy enforced above direct repository writes and prove no-write counts for rejected action paths. Target part: override-lock acceptance.
4. Severity: Medium. Preserved surface-specific settings vs setup behavior. Evidence: settings routes revalidate on success without success redirect at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:113` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:124`; setup routes redirect successful save/preset/default to review at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:81` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:92`; runtime tests cover both settings success and setup review redirect at `tests/integration/bot-config-action-handler.test.ts:119` and `tests/integration/bot-config-action-handler.test.ts:130`. Recommendation: keep route maps explicit so future UX changes do not silently normalize setup and settings. Target part: action outcome compatibility.
5. Severity: Medium. Confirmed helper separation from live controls and network paths. Evidence: helper has injected persistence/default selection only and no adapter/network dependency; static runtime test asserts no `@wtc/bot-adapters`, `fetch(`, exchange-key metadata, or key-add calls at `tests/integration/bot-config-action-handler.test.ts:212`. Recommendation: any future live apply/start/stop route must be a separate audited flow, not an extension of config save/default actions. Target part: live-control separation.
6. Severity: Medium. Legacy `providerPubId` remains a follow-up schema ambiguity. Evidence: security auditor flagged optional `providerPubId` in the Legacy symbol schema while lower forbidden sets reject provider identity later; this phase added FormData rejection but did not split runtime/display rows from persistable user-config rows. Recommendation: split Legacy runtime/display identity from persistable config in a later narrow phase, then add a runtime test that provider identity cannot enter saved user config. Target part: Legacy source validation.

## Decisions
1. Kept the new helper in `apps/web/src/features/bots/config-action-handler.ts` free of `server-only`, `@/lib/backend`, `next/cache`, `next/navigation`, adapter control, exchange-key metadata checks, and direct DB selection.
2. Injected `botConfigFormIssues`, `botConfigFormInput`, schema parsing, preset lookup, persistence, and system-default selection from the page wrappers instead of importing `config.ts` into the helper.
3. Chose the safer hidden-field contract: forbidden user FormData keys reject with config error and no write.
4. Kept settings invalid/missing preset behavior as noop, while setup invalid/missing preset redirects to strategy config error.
5. Added a PGlite-backed no-write test in the action-helper suite rather than trying to import `server-only` feature facades into root Vitest.

## Risks
1. Invalid historical user override fallback/sourceIssue still has static and lower DB coverage but not a new PGlite test through an injectable `loadBotConfig` facade in this phase.
2. Legacy `providerPubId` remains present in a schema that is also used for persistable user rows; lower guards prevent persistence, but this is still a design ambiguity.
3. Full browser/RSC payload checks, preview, Playwright, and full build were not run in this focused action-runtime slice.
4. The worktree remains heavily dirty from the broader multi-phase rollout; this phase did not revert unrelated prior changes.

## Verification/tests
RUN:
1. Required protocol/docs read and per-agent handoffs collected.
2. Three read-only agents dispatched before product/test edits and cited above.
3. All three background agents closed before final reporting.
4. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-config-source-audit-static.test.ts` - 4 files, 41 tests passed.
5. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/db-0002.test.ts` - 4 files, 38 tests passed.
6. `npm run typecheck -w @wtc/web` - passed.
7. `npm run typecheck` - initially failed on three test mock literal return types, then passed after typing the mocks.
8. `npm run secret:scan` - passed.
9. `git diff --check -- "apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx" "apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx" tests/integration/bot-read-safety-static.test.ts` - passed.
10. Phase-file whitespace check over the new helper/test/handoff files plus touched settings/setup/static files - passed.
11. `npm run governance:check` - initially failed because per-agent handoffs were listed as code paths instead of markdown links, then passed after converting them to links; final result was 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.

OBSERVED NON-GREEN BUT RESOLVED:
1. The first focused static run failed because `bot-read-safety-static.test.ts` still expected direct `botConfigFormInput(meta.code, formData)` calls inside page actions. The static guard was updated to assert dependency wiring plus helper calls, and the focused suite reran green.
2. The first root typecheck failed because three Vitest mocks inferred broad `string`/`boolean` return types; the mocks now return literal `'saved'`, `'unavailable'`, and `success: false as const`, and root typecheck reran green.
3. The first governance run failed because per-agent handoffs were cited as plain code paths. The aggregate now links each per-agent handoff with markdown links, and governance reran green.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.
2. Full `npm test`, full build, full lint, full Playwright/e2e, preview/browser screenshots - skipped to keep this runtime action/security slice focused.
3. New PGlite invalid saved override/sourceIssue test - not implemented in this phase; tracked as a follow-up.

## Next actions
1. Split Legacy runtime/display provider identity from persistable user config so `providerPubId` cannot be part of the user-save schema at all.
2. Add a PGlite DB snapshot test for invalid historical user override fallback/sourceIssue through an injectable config-state loader.
3. Add later browser/RSC response coverage for settings/setup save/default/preset feedback after the action-helper and export slices are both in place.
4. Continue the broader Legacy/Tortila completion goal in the next single-purpose protocol phase; do not enable live bot controls until separate security and bot-integration acceptance gates pass.
