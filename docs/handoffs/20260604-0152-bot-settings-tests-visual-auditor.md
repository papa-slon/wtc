# bot-settings-tests-visual-auditor handoff
## Scope
Phase 3.88 read-only tests/visual audit for bot settings/setup pages and admin bot config pages. Focus: desktop/mobile horizontal-scroll risk, table/card wrapping, default/custom config source proof, Legacy RSI/CCI stage clarity, Tortila symbol config clarity, and absence of misleading live exchange ping/start/apply/retest controls. This audit inspected source and tests only; it did not start Playwright, Vitest, preview, workers, live bots, provider DBs, exchange clients, SSH, tmux, systemd, `.env`, or any start/stop/apply/retest path.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`
8. `tests/e2e/bot-settings.spec.ts`
9. `tests/e2e/warning-summary-visual.spec.ts`
10. `tests/e2e/bot-readiness-map.spec.ts`
11. `tests/e2e/admin-mobile-pg8.spec.ts`
12. `tests/e2e/cabinet-pg9-mobile.spec.ts`
13. `tests/integration/user-resolved-bot-config-static.test.ts`
14. `tests/integration/user-resolved-bot-config-db.test.ts`
15. `tests/integration/admin-global-bot-config-static.test.ts`
16. `tests/integration/admin-global-bot-config-db.test.ts`
17. `tests/integration/bot-readiness-server-dto-static.test.ts`
18. `tests/integration/bot-readiness-builder.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/cabinet-pg9.test.ts`
21. `packages/ui/src/theme.css`
22. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
23. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
24. `apps/web/src/app/admin/bots/config/page.tsx`
25. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
26. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
27. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
28. `apps/web/src/features/bots/readiness.ts`
29. `apps/web/src/features/admin/actions.ts`
30. `apps/web/src/features/admin/schemas.ts`
31. `packages/db/src/repositories.ts`
32. `playwright.config.ts`
33. `package.json`
34. `apps/web/package.json`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. Admin bot system defaults have static and broad mobile coverage, but no bot-config-specific visual proof for the actual admin config workbench on desktop plus mobile. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts:29` includes `/admin/bots/config`, and `tests/e2e/admin-mobile-pg8.spec.ts:37` to `tests/e2e/admin-mobile-pg8.spec.ts:59` checks only the broad admin 375px criterion; content-specific guardrails live in static assertions at `tests/integration/admin-global-bot-config-static.test.ts:16` to `tests/integration/admin-global-bot-config-static.test.ts:41`. Recommendation: add a focused admin bot config Playwright path that screenshots `/admin/bots/config` at desktop and mobile, asserts `LIVE CONTROL: DISABLED`, `user settings unaffected`, `entitlements remain source of access`, Tortila symbol config, Legacy stage capacity, version history wrapping, no `Connection verified`, and no h-scroll. Target part: admin bot config visual acceptance.
2. Severity: Medium. Setup pages have older PG9 mobile navigation coverage, but Phase 3.88 source/default/custom semantics and setup-specific Tortila/Legacy config clarity are not fully browser-proved. Evidence: `tests/e2e/cabinet-pg9-mobile.spec.ts:31` to `tests/e2e/cabinet-pg9-mobile.spec.ts:58` visits Tortila key/strategy and Legacy setup only at 375px; it checks a generic `riskPercent` and one Legacy RSI input, while setup renders the source cards and tables at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:266`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:354`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:448`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:455`, and the review readiness at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:487`. Recommendation: extend `bot-settings.spec.ts` or add a focused setup visual spec for `/app/bots/tortila/setup?step=strategy`, `/app/bots/tortila/setup?step=review`, `/app/bots/legacy/setup`, and `/app/bots/legacy/setup?step=review` across desktop/mobile. Target part: user setup wizard visual/source proof.
3. Severity: Medium. Default/custom source UX is mostly locked by static/PGlite tests, not by rendered route assertions. Evidence: settings renders the config source and source chooser at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:257`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:290`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:294`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:317` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:328`; static tests assert those strings at `tests/integration/user-resolved-bot-config-static.test.ts:32` to `tests/integration/user-resolved-bot-config-static.test.ts:60`, and DB tests prove inheritance/override behavior at `tests/integration/user-resolved-bot-config-db.test.ts:102`, `tests/integration/user-resolved-bot-config-db.test.ts:129`, and `tests/integration/user-resolved-bot-config-db.test.ts:170`. `tests/e2e/bot-settings.spec.ts:16` to `tests/e2e/bot-settings.spec.ts:45` does not assert the rendered source chooser states. Recommendation: add browser assertions for resolved source, built-in fallback/system default/custom profile states, locked customization copy, and save behavior on settings/setup. Target part: user config source visual proof.
4. Severity: Medium. Tortila symbol config clarity is only partially browser-proved. Evidence: `tests/e2e/bot-settings.spec.ts:22` to `tests/e2e/bot-settings.spec.ts:28` checks `Per-coin Tortila configuration`, `Manual symbol override`, `Turtle system`, `Runtime export preview`, no `Connection verified`, and no h-scroll; the component also renders the crucial runtime export mapping and generated `SYMBOL_CONFIGS` textarea at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:157` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:167` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:171`, but those specifics are only statically locked at `tests/integration/bot-read-safety-static.test.ts:298` to `tests/integration/bot-read-safety-static.test.ts:307`. Recommendation: assert generated `SYMBOL_CONFIGS`, export mapping text, and wrapped textarea visibility in settings, setup, and admin defaults screenshots. Target part: Tortila symbol config UI.
5. Severity: Medium. Legacy RSI/CCI clarity is good on the settings page but not visually proven across setup and admin defaults. Evidence: `tests/e2e/bot-settings.spec.ts:34` to `tests/e2e/bot-settings.spec.ts:45` checks Legacy settings, stage capacity, and first RSI/CCI stage inputs; the component renders one-trigger copy and stage capacity matrix at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:90` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:102` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:271` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:296`; admin defaults embeds the same component at `apps/web/src/app/admin/bots/config/page.tsx:173`. Recommendation: expand visual coverage to assert Legacy one-trigger copy, RSI/CCI option exclusivity, delay/delta filters, and stage matrix on setup and admin config pages. Target part: Legacy config clarity.
6. Severity: Low. Current focused settings/readiness no-scroll helpers return only a boolean, so failures would not identify the overflowing element. Evidence: `tests/e2e/bot-settings.spec.ts:6` to `tests/e2e/bot-settings.spec.ts:10` and `tests/e2e/bot-readiness-map.spec.ts:6` to `tests/e2e/bot-readiness-map.spec.ts:10` only compare document width; the warning visual spec already has a more diagnostic offender collector at `tests/e2e/warning-summary-visual.spec.ts:6` to `tests/e2e/warning-summary-visual.spec.ts:28`. Recommendation: reuse the offender-reporting helper for settings/setup/admin config visual specs. Target part: visual test diagnostics.
7. Severity: Low. Live-control and exchange-ping safety copy is well-covered statically, but it should be included in the next focused visual spec so the screenshots themselves prove the user cannot mistake WTC metadata checks for live exchange pings. Evidence: exchange readiness copy and disabled future ping are in `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:72`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122` to `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:139`, and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:147`; static guards cover no `Connection verified` at `tests/integration/bot-read-safety-static.test.ts:311` to `tests/integration/bot-read-safety-static.test.ts:337`; rendered settings coverage checks no `Connection verified` at `tests/e2e/bot-settings.spec.ts:26`. Recommendation: include disabled ping button/copy checks in setup/settings/admin screenshots and keep all live apply/start/stop/retest strings negative except disabled-policy copy. Target part: no misleading live integration UX.

## Decisions
1. Treat existing static and PGlite tests as valid boundary proof, but not as visual acceptance for the rendered settings/setup/admin config routes.
2. Treat `.wtc-table-wrap`, `.wtc-wizard-steps`, `.wtc-grid > * { min-width: 0; }`, and `.wtc-shell` shrink fixes as current layout safeguards, not as substitutes for route-specific screenshots.
3. Do not recommend running live bots, workers, provider DBs, exchange pings, start/stop/apply/retest, `.env`, SSH, tmux, or systemd for this scope.
4. Keep all future config UX tests in mock/demo or controlled local browser mode with `BOT_ADAPTER_MODE=mock` and `FEATURE_LIVE_BOT_CONTROL=false`.

## Risks
1. Admin bot config can still regress visually on desktop without failing a bot-config-specific test, because current admin config route coverage is broad mobile admin-shell coverage plus static source assertions.
2. Setup wizard desktop/table/card wrapping can regress without a targeted setup screenshot because PG9 setup coverage is mobile-only and narrow.
3. Demo/mock Playwright route checks cannot prove Postgres-specific published default/custom override combinations unless a seeded DB browser harness is added.
4. Static tests can miss rendered text truncation, button wrapping, and nested card/table overflow.

## Verification/tests
RUN:
1. Required protocol/status reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`.
2. Read-only inspection using `rg` and `Get-Content` only over the requested e2e specs, static/DB integration specs, settings/setup/admin config routes, shared UI CSS, bot config components, exchange readiness component, readiness DTO/builders, admin actions/schemas, DB repositories, and Playwright config.

NOT RUN:
1. Playwright/Vitest - not run because this was a read-only audit and existing source/test inspection was sufficient to identify coverage gaps without starting the app.
2. Preview/dev server, worker ticks/smoke/restart, live bot start/stop/apply-config/retest, exchange ping, provider DB reads/writes, `.env`, vault/secrets, SSH, tmux, and systemd - forbidden by scope and safety rules.
3. Full `npm test`, `npm run e2e`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run secret:scan`, and governance - not run because the user constrained this auditor to read-only inspection.

## Next actions
1. Add a focused visual spec for settings/setup/admin bot config pages using the richer overflow offender helper from `warning-summary-visual.spec.ts`.
2. Cover `/app/bots/tortila/settings`, `/app/bots/legacy/settings`, `/app/bots/tortila/setup?step=strategy`, `/app/bots/tortila/setup?step=review`, `/app/bots/legacy/setup`, `/app/bots/legacy/setup?step=review`, and `/admin/bots/config` on desktop and mobile.
3. Assert default/custom source states, system default/built-in fallback copy, customization lock copy, save behavior, no `Connection verified`, no live apply/start/stop/retest controls, Tortila generated `SYMBOL_CONFIGS`, and Legacy RSI/CCI stage matrix.
4. If DB-backed visual proof is required later, add a controlled seeded PGlite/Postgres browser harness; do not use provider DBs or live bot runtimes for config UX proof.
