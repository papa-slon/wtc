# bot-browser-settings-ux-auditor handoff
## Scope
Read-only audit for WTC Ecosystem Platform Phase 4.18. Inspect existing local browser coverage for Legacy/Tortila bot settings/setup surfaces and identify the next safest local browser/visual acceptance slice that can prove user-facing clarity without external DB, live bot control, exchange/provider calls, raw env reads, raw secret reads, db migrate/seed, or DB mutation.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`
- `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md`
- `package.json`
- `playwright.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`

## Files changed
- `docs/handoffs/20260604-1354-bot-browser-settings-ux-auditor.md` - required read-only agent handoff only; no code or product docs changed.

## Findings
1. Severity P1 - evidence `playwright.config.ts:8`, `playwright.config.ts:9`, `playwright.config.ts:27`, `playwright.config.ts:33`, `playwright.config.ts:36`, `playwright.config.ts:37`, `playwright.config.ts:38`, `package.json:28`, `tests/e2e/helpers/auth.ts:7` - recommendation: use the default Playwright harness for this local acceptance slice because it starts only local Next dev, uses e2e auth bypass, keeps `BOT_ADAPTER_MODE=mock`, keeps live bot control and TV automation disabled, and excludes the DB-specific specs; target part: local browser gate selection.
2. Severity P1 - evidence `tests/e2e/bot-settings.spec.ts:52`, `tests/e2e/bot-settings.spec.ts:55`, `tests/e2e/bot-settings.spec.ts:62`, `tests/e2e/bot-settings.spec.ts:100`, `tests/e2e/bot-settings.spec.ts:108`, `tests/e2e/bot-settings.spec.ts:148`, `tests/e2e/bot-settings.spec.ts:149`, `tests/e2e/bot-settings.spec.ts:293`, `tests/e2e/bot-settings.spec.ts:320`, `tests/e2e/bot-settings.spec.ts:350`, `tests/e2e/bot-settings.spec.ts:355` - recommendation: make `tests/e2e/bot-settings.spec.ts` the primary next local browser/visual acceptance spec for Legacy/Tortila settings/setup; it already proves settings/setup copy, safety boundaries, no horizontal scroll, screenshots, validation routing, and admin defaults without external DB; target part: user-facing settings/setup clarity.
3. Severity P1 - evidence `tests/e2e/bot-settings.spec.ts:316`, `tests/e2e/bot-settings.spec.ts:317`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:599`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:603`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:605`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:607`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:609`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:626`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:628` - recommendation: tighten the review-step assertions instead of using the current broad regex. Add deterministic checks for `Setup readiness map`, `Step 3 - Review & finish`, Tortila incomplete-key text, Legacy `Save reference settings first`, and, after a safe local save if used, `Settings to review`, `Live control stays disabled`, and `Open the dashboard`; target part: setup review acceptance.
4. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:526`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:529`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:531`, `tests/e2e/bot-settings.spec.ts:148`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:613`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:616`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:622`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:625`, `tests/e2e/bot-settings.spec.ts:99` - recommendation: add exact assertions for export clarity: config export link href for both bots, "no exchange keys / no live apply" copy, and generated Tortila `SYMBOL_CONFIGS` draft content after one visible row edit; target part: WTC reference/export acceptance.
5. Severity P1 - evidence `tests/e2e/cabinet-pg9-mobile.spec.ts:31`, `tests/e2e/cabinet-pg9-mobile.spec.ts:36`, `tests/e2e/cabinet-pg9-mobile.spec.ts:44`, `tests/e2e/cabinet-pg9-mobile.spec.ts:50`, `tests/e2e/cabinet-pg9-mobile.spec.ts:56`, `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md:52` - recommendation: include `tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` as the 375px companion, but expand it beyond navigation-only to assert `Bot setup control center`, `Setup continuity monitor`, Tortila `Tortila strategy map`/`Portfolio caps`, Legacy `Trigger resolution map`, and no live apply/start/stop copy; target part: mobile setup visual clarity.
6. Severity P2 - evidence `tests/e2e/warning-summary-visual.spec.ts:58`, `tests/e2e/warning-summary-visual.spec.ts:68`, `tests/e2e/warning-summary-visual.spec.ts:75`, `tests/e2e/warning-summary-visual.spec.ts:82`, `tests/e2e/warning-summary-visual.spec.ts:90`, `tests/e2e/warning-summary-visual.spec.ts:53`, `tests/e2e/warning-summary-visual.spec.ts:55` - recommendation: reuse the warning-summary overflow/no-all-clear helper on `/app/bots/{bot}/settings` and `/app/bots/{bot}/setup?step=strategy`; current warning visual coverage skips settings/setup even though those pages have dense pills, tables, warnings, and safety copy; target part: visual containment for settings/setup warnings.
7. Severity P2 - evidence `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:196`, `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:116`, `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:118`, `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:138`, `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:151`, `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:160`, `tests/e2e/smoke.spec.ts:33` - recommendation: treat `BotRuntimeEvidencePanel` as a companion dashboard proof, not the core settings/setup proof. If included in Phase 4.18 acceptance, add assertions for Source mode, WTC worker check, WTC DB snapshot, scoped page data, and the read-only/no raw payload copy; target part: post-setup runtime evidence handoff.

## Decisions
- Recommended next safest local slice: run focused local Playwright against `tests/e2e/bot-settings.spec.ts`, `tests/e2e/cabinet-pg9-mobile.spec.ts`, `tests/e2e/bot-readiness-map.spec.ts`, and `tests/e2e/warning-summary-visual.spec.ts` under the default config. This proves settings/setup UX, 375px setup navigation, dashboard readiness context, and warning containment without external DB or provider access.
- Do not use the Phase 4.17 DB-backed admin-user runtimeHealth matrix as the settings/setup visual acceptance gate unless an explicit disposable Postgres target is supplied. That matrix is valuable, but it targets selected-user admin runtimeHealth states rather than user bot settings/setup clarity.
- Keep `smoke.spec.ts` as broad regression context only. Its bot assertions are useful but too shallow to be the acceptance proof for Legacy/Tortila settings/setup.
- Keep live bot start/stop/apply-config, exchange/provider calls, raw env/secret reads, `db:migrate`, `db:seed`, and DB-backed Playwright outside this local settings/setup slice.

## Risks
- No Playwright run was executed in this read-only audit lane; recommendations are source/spec inspection only.
- Existing specs capture screenshots, but there is no reviewed visual manifest for the settings/setup screenshots in this lane. A future acceptance claim should either review retained screenshots or state screenshot capture only.
- The worktree is heavily dirty with many pre-existing modified/untracked files, including files in this audit scope. This handoff does not attribute those changes to this agent.
- Current local default e2e is mock/demo by design. It can prove clarity and safety copy, but it cannot prove DB persistence, real worker continuity, live runtime freshness, or provider connectivity.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/next-action docs, Phase 4.16, and Phase 4.17 handoffs.
- Inspected the requested tests and UI files with line-numbered source reads.
- Checked `git status --short --branch`; branch is `codex/bot-analytics-settings-canary-20260603` and the worktree is heavily dirty before this handoff.
- Checked default Playwright/package wiring for local-safe env, ignored DB specs, and e2e scripts.

NOT RUN:
- `npm run e2e` - skipped by read-only audit scope.
- `npx playwright test tests/e2e/bot-settings.spec.ts` - skipped by read-only audit scope.
- `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` - skipped by read-only audit scope.
- `npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts` - skipped by read-only audit scope.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - skipped because no fresh screenshots were generated in this lane.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, and `npm run e2e:admin-user-bots:db:managed:matrix` - skipped; require explicit disposable Postgres target and are outside this local settings/setup visual slice.
- `npm run accept:worker:continuity`, `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - skipped by safety policy and scope.

## Next actions
1. For the next implementation/acceptance lane, first add the missing assertions above to `tests/e2e/bot-settings.spec.ts`, `tests/e2e/cabinet-pg9-mobile.spec.ts`, and optionally `tests/e2e/warning-summary-visual.spec.ts`.
2. Then run a focused local browser slice: `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts` plus `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile`.
3. If screenshots are used as visual acceptance evidence, retain the key Tortila settings, Legacy settings, Tortila setup strategy, Legacy setup strategy, and mobile 375px setup screenshots and record whether they were reviewed, not just generated.
4. Keep DB-backed runtimeHealth matrix and worker continuity as separate phases with explicit disposable DB credentials; do not bundle them into this local browser/visual settings/setup slice.
