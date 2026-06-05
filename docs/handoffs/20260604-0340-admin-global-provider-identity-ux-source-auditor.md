# admin-global-provider-identity-ux-source-auditor handoff
## Scope
Read-only Phase 3.93 UX/source audit of bot-settings source clarity after Phase 3.92. Scope was limited to whether admin global config UI, user settings/setup UI, and config source/review panels communicate that system defaults are editable shared WTC config, user overrides are user-owned, and Legacy provider identity/runtime pub_id is read-only evidence rather than a setting. No product code, tests, existing docs, live services, env, provider DB, worker, exchange, SSH, tmux, systemd, or bot state was changed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md`
8. `apps/web/src/app/admin/bots/config/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
12. `apps/web/src/features/bots/config-review.ts`
13. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
14. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
15. `tests/integration/admin-global-bot-config-static.test.ts`
16. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Info. Admin global config UI clearly frames system defaults as shared/admin-owned WTC reference config, not user or runtime state. Evidence: `apps/web/src/app/admin/bots/config/page.tsx:284` title is "System bot defaults"; `apps/web/src/app/admin/bots/config/page.tsx:285` says these admin-owned profiles define inheritance and do not mutate user overrides or running bots; `apps/web/src/app/admin/bots/config/page.tsx:304` to `apps/web/src/app/admin/bots/config/page.tsx:309` shows the ownership model from built-in fallback to system default to user override to runtime snapshots; `apps/web/src/app/admin/bots/config/page.tsx:109` to `apps/web/src/app/admin/bots/config/page.tsx:110` says saving changes only the WTC system reference profile and does not push runtime config or start/stop bots. Recommendation: keep this language on the admin route and preserve "user settings unaffected" and "LIVE CONTROL: DISABLED" pills. Target part: admin global config UI.
2. Severity: Info. Admin Legacy default editing keeps provider identity out of shared defaults. Evidence: `apps/web/src/app/admin/bots/config/page.tsx:186` to `apps/web/src/app/admin/bots/config/page.tsx:192` passes `providerAccountCount={0}` and states Legacy defaults are generic strategy rows while provider pub_id mappings stay mapping data, not a system default. Recommendation: keep provider pub_id excluded from system default editor inputs and review summaries. Target part: admin Legacy system default editor.
3. Severity: Info. User settings UI separates resolved source, system inheritance, user-owned overrides, and read-only Legacy runtime evidence. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:279` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:287` labels resolved source, provider mapping, and "WTC version only"; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:321` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:369` explains system-default inheritance and user-owned custom versions; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:375` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:385` labels provider runtime as a read-only snapshot and says it is not silently rewritten as custom config; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:428` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:432` avoids claiming runtime balance or live slots when zero pub_ids are mapped. Recommendation: keep the runtime snapshot block separate from the editable form and continue showing zero mappings honestly. Target part: user bot settings source/review UI.
4. Severity: Info. Setup wizard repeats the same source model before onboarding actions. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:260` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:277` blocks old Legacy HTTP/control setup and says WTC does not collect new Legacy exchange keys; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:281` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:292` shows resolved source, provider mapping/exchange keys, and no live apply/start/stop; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:337` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:341` clarifies Legacy reads by pub_id through worker snapshots; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:377` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:425` separates system default from user-owned custom settings and states provider pub_id data is read-only evidence. Recommendation: keep the Legacy exchange-key step disabled and preserve the "WTC-side reference" language in setup. Target part: user bot setup wizard.
5. Severity: Info. Shared review/table/sanitizer code supports the UX claim instead of relying only on copy. Evidence: `apps/web/src/features/bots/config-review.ts:161` to `apps/web/src/features/bots/config-review.ts:170` carries an explicit provider mapping count, including zero; `apps/web/src/features/bots/config-review.ts:199` states provider pub_id mappings and worker snapshots are read-only evidence not copied into user settings; `apps/web/src/features/bots/BotConfigReviewPanel.tsx:71` to `apps/web/src/features/bots/BotConfigReviewPanel.tsx:75` labels unframed review as read-only; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:95` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:105` shows source detail and pub_id mapping count; `apps/web/src/features/bots/runtime-config-sanitizer.ts:17` to `apps/web/src/features/bots/runtime-config-sanitizer.ts:22` keeps provider identity in the forbidden key set, while `apps/web/src/features/bots/runtime-config-sanitizer.ts:77` to `apps/web/src/features/bots/runtime-config-sanitizer.ts:87` only allows masked Legacy identity in scoped runtime containers. Recommendation: keep `providerAccountCount` explicit, avoid `|| 1` style fallbacks, and keep sanitizer masking limited to scoped Legacy runtime evidence. Target part: config review panel, Legacy table, and runtime sanitizer.
6. Severity: Low. Current verification is static/source-level, not browser-visible acceptance. Evidence: `tests/integration/admin-global-bot-config-static.test.ts:16` to `tests/integration/admin-global-bot-config-static.test.ts:30` checks admin route/navigation strings; `tests/integration/admin-global-bot-config-static.test.ts:74` to `tests/integration/admin-global-bot-config-static.test.ts:91` checks forbidden provider/runtime keys in global defaults; `tests/integration/bot-read-safety-static.test.ts:345` to `tests/integration/bot-read-safety-static.test.ts:389` checks Legacy pub_id/source clarity, schema split, and zero-mapping behavior; Phase 3.92 also recorded no visual/e2e acceptance at `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md:78` to `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md:80`. Recommendation: before claiming visual UX acceptance, run a focused browser/Playwright pass for admin defaults, user settings, and setup at desktop/mobile widths. Target part: verification coverage.

## Decisions
1. Verdict: source clarity is acceptable for this read-only audit; no blocking UX/source issue was found.
2. The audited UX should continue treating `System default` as shared/admin-owned WTC config, `User override` as user-owned config versions, and Legacy pub_id/runtime identity as read-only evidence.
3. No product-code or test changes were made. This handoff is the only permitted write.
4. No background agents were spawned by this auditor lane; none required cleanup from this lane.

## Risks
1. The worktree was already dirty before this audit, including focused product/test files and many untracked handoffs. This audit inspected current local content but did not attribute authorship.
2. Static tests and source inspection do not prove visual placement, responsive wrapping, or that the copy is prominent enough in the rendered UI.
3. No production/provider DB or historical-row audit was performed, so this does not add evidence beyond the Phase 3.92 schema/runtime boundary.
4. `config-export.ts` schema centralization remains a Phase 3.92 follow-up and was outside this UX/source audit.

## Verification/tests
RUN:
1. Protocol/session reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and Phase 3.92 aggregate handoff.
2. Workspace state read: `git status --short --branch` observed a dirty worktree on `codex/bot-analytics-settings-canary-20260603`; no cleanup or revert was performed.
3. Focused source inspection with line evidence for the requested admin, user settings/setup, review, sanitizer, and static-test files.
4. `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 2 files / 30 tests.

NOT RUN:
1. Full `npm test` - skipped for read-only auditor scope; focused static suites above were run.
2. `npm run lint`, `npm run typecheck`, and `npm run build -w @wtc/web` - skipped for read-only UX/source audit scope.
3. Playwright/e2e/browser screenshots/visual acceptance - skipped; no visual acceptance claim is made.
4. `npm run governance:check` - skipped because this is a per-agent handoff, not an aggregate phase handoff, and no Phase 3.93 aggregate exists yet.
5. DB migrations, worker tick/restart, live bot start/stop/apply-config/retest, provider DB, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, live server checks - NOT RUN because forbidden by scope/protocol.

## Next actions
1. If this source clarity needs visual acceptance, run a focused browser/Playwright pass over `/admin/bots/config`, `/app/bots/legacy/settings`, and `/app/bots/legacy/setup?step=strategy` at desktop and mobile widths.
2. Add or keep a future static guard for the exact review-panel footnote that provider pub_id mappings are read-only evidence and are not copied into user settings.
3. Carry forward the Phase 3.92 follow-up to centralize server-neutral Legacy schema pairs when an implementation phase is opened.
