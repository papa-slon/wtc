# bot-settings-rendered-ux-auditor handoff
## Scope
Read-only UX/source audit for Phase 3.94 bot configuration flows:
`/app/bots/legacy/settings`, `/app/bots/legacy/setup`, `/app/bots/tortila/settings`,
`/app/bots/tortila/setup`, `/admin/bots/config`, `/admin/bots`, and
`/admin/users/[userId]/bots`.

Focus was whether the current UI makes these boundaries brutally clear: system default versus custom config, coin/symbol selection, per-stage slots, RSI/CCI threshold setup, warning/readiness status, runtime evidence versus editable config, and admin visibility versus non-intervention.

No product code, tests, live bot services, worker tick/restart, provider DB, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, or live server state was intentionally changed. Local rendered behavior was checked only against an already-running local e2e/dev listener on `http://127.0.0.1:3411`; no server was started or stopped.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/app/admin/bots/config/page.tsx`
11. `apps/web/src/app/admin/bots/page.tsx`
12. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
13. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
14. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
15. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
16. `apps/web/src/features/bots/BotReadinessMap.tsx`
17. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
18. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
19. `apps/web/src/features/bots/config.ts`
20. `apps/web/src/features/bots/config-review.ts`
21. `apps/web/src/features/bots/readiness.ts`
22. `apps/web/src/features/bots/readiness-loader.ts`
23. `apps/web/src/features/admin/queries.ts`
24. `apps/web/src/features/admin/user-bot-detail-loader.ts`
25. `tests/e2e/bot-settings.spec.ts`
26. `tests/e2e/bot-readiness-map.spec.ts`
27. `tests/e2e/admin-mobile-pg8.spec.ts`
28. `tests/e2e/warning-summary-visual.spec.ts`
29. `tests/e2e/helpers/auth.ts`
30. `tests/integration/bot-read-safety-static.test.ts`
31. `tests/integration/bot-config-review-static.test.ts`
32. `tests/integration/admin-user-bot-detail-static.test.ts`
33. `tests/integration/admin-user-bot-detail-loader.test.ts`
34. `tests/integration/admin-global-bot-config-static.test.ts`
35. `tests/integration/admin-global-bot-config-db.test.ts`

## Files changed
1. `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md`

## Findings
1. Severity: High. Source choice is clear on the user settings/setup surfaces and admin defaults page. Evidence: settings renders a readiness map before editing (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:242`), separate "Configuration source" and "Settings source" cards (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:279`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:321`), explicit "Use system default" and "Customize my settings" choices (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:325`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:348`), and source-detail copy says user profiles, system defaults, and built-in fallbacks are distinct (`apps/web/src/features/bots/config.ts:818`, `apps/web/src/features/bots/config.ts:827`, `apps/web/src/features/bots/config.ts:832`). Admin defaults also names the four-layer model including runtime as "not a config source" (`apps/web/src/app/admin/bots/config/page.tsx:304`, `apps/web/src/app/admin/bots/config/page.tsx:309`). Recommendation: keep this two-choice source model and add rendered assertions for both active states: inherited system default and user custom override. Target part: user settings/setup source selection and admin default inheritance.
2. Severity: High. Runtime evidence versus editable config is mostly explicit and safe. Evidence: the settings page has a "Provider runtime snapshot" block only when Legacy runtime data exists (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:376`) and a separate "Export current reference config" card that says download/apply are separate (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:449`); setup warns that live control stays disabled (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:532`); admin bot fleet says no live-control buttons exist (`apps/web/src/app/admin/bots/page.tsx:73`) and repeats the runtime safety model (`apps/web/src/app/admin/bots/page.tsx:122`, `apps/web/src/app/admin/bots/page.tsx:128`, `apps/web/src/app/admin/bots/page.tsx:137`). Recommendation: preserve this read-only/runtime language anywhere new "copy from runtime" or "apply" affordances are introduced. Target part: Legacy runtime snapshot, config export, and admin fleet diagnostics.
3. Severity: Medium. Coin and slot controls are real and visible, but RSI/CCI threshold ranges and validation meaning should be more direct. Evidence: Tortila exposes per-coin controls for coin, manual symbol override, Turtle system, risk, and ATR stop (`apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:60`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:104`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:111`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:121`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:131`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:135`). Legacy exposes trigger choice, RSI threshold, CCI threshold, and stage RSI/CCI capacity inputs (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:181`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:206`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:219`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:294`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:325`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:326`). The schema has accepted ranges for these values (`apps/web/src/features/bots/config.ts:82`, `apps/web/src/features/bots/config.ts:83`, `apps/web/src/features/bots/config.ts:84`, `apps/web/src/features/bots/config.ts:97`, `apps/web/src/features/bots/config.ts:98`), but the visible labels do not show those ranges or the cross-down semantics. Recommendation: add compact inline helper text/min-max attributes for RSI threshold, CCI threshold, and stage slot inputs; make the save-error path point users to the exact invalid row when possible. Target part: Legacy strategy map threshold and stage-slot UX.
4. Severity: High. Readiness and warning states avoid false green claims. Evidence: the readiness map table forces "Layer", "Status", "Current state", "Meaning", and "Action" columns (`apps/web/src/features/bots/BotReadinessMap.tsx:35`, `apps/web/src/features/bots/BotReadinessMap.tsx:36`, `apps/web/src/features/bots/BotReadinessMap.tsx:37`, `apps/web/src/features/bots/BotReadinessMap.tsx:38`, `apps/web/src/features/bots/BotReadinessMap.tsx:39`), readiness construction adds a live row labelled "Live apply" or "Live control" with disabled values (`apps/web/src/features/bots/readiness.ts:175`, `apps/web/src/features/bots/readiness.ts:178`, `apps/web/src/features/bots/readiness.ts:215`), and exchange-key readiness repeatedly says no live exchange ping was run (`apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:72`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:97`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:110`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:147`). Static guards also forbid "Connection verified" and live adapter/control strings in these surfaces (`tests/integration/bot-read-safety-static.test.ts:107`, `tests/integration/bot-read-safety-static.test.ts:338`, `tests/integration/bot-read-safety-static.test.ts:340`, `tests/integration/bot-read-safety-static.test.ts:341`, `tests/integration/bot-read-safety-static.test.ts:342`). Recommendation: keep "connection verified" out of these surfaces until a separately audited read-only exchange adapter exists; any future metadata check should keep the current "WTC vault readiness" wording. Target part: readiness map and exchange-key status.
5. Severity: Medium. Admin visibility versus non-intervention is clear at source level, but populated admin-user drilldown rendered proof remains thin. Evidence: the admin user bot page has top-level read-only pills and operational-scope copy (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:82`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:92`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:93`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:94`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:99`), renders canonical warnings and resolved WTC settings (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:179`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229`), and separates provider mappings and exchange-key metadata into read-only sections (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:421`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:424`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:455`). The loader resolves user custom, system default, locked-default, and built-in states without secrets (`apps/web/src/features/admin/user-bot-detail-loader.ts:479`, `apps/web/src/features/admin/user-bot-detail-loader.ts:483`, `apps/web/src/features/admin/user-bot-detail-loader.ts:492`, `apps/web/src/features/admin/user-bot-detail-loader.ts:501`, `apps/web/src/features/admin/user-bot-detail-loader.ts:507`), and PGlite tests cover those cases (`tests/integration/admin-user-bot-detail-loader.test.ts:626`, `tests/integration/admin-user-bot-detail-loader.test.ts:678`, `tests/integration/admin-user-bot-detail-loader.test.ts:727`, `tests/integration/admin-user-bot-detail-loader.test.ts:778`). However, the existing rendered mobile check only visits `/admin/users/demo-user/bots` and proves heading/storage/no-h-scroll in demo mode (`tests/e2e/admin-mobile-pg8.spec.ts:23`, `tests/e2e/admin-mobile-pg8.spec.ts:37`, `tests/e2e/admin-mobile-pg8.spec.ts:49`, `tests/e2e/admin-mobile-pg8.spec.ts:52`). Recommendation: add a no-live, DB-backed rendered check or component-story style render with a populated user so the next agent can visually accept config source, provider mapping, warning summary, and stats scope in one page. Target part: admin user bot drilldown rendered acceptance.
6. Severity: Medium. Admin global defaults are visually clear in demo/read-only mode, but rendered Postgres/version-history acceptance is still open. Evidence: admin defaults labels the page as system defaults (`apps/web/src/app/admin/bots/config/page.tsx:284`), shows "LIVE CONTROL: DISABLED" and "user settings unaffected" (`apps/web/src/app/admin/bots/config/page.tsx:291`, `apps/web/src/app/admin/bots/config/page.tsx:105`), explains saving changes only the WTC system reference profile (`apps/web/src/app/admin/bots/config/page.tsx:110`), and disables save without Postgres (`apps/web/src/app/admin/bots/config/page.tsx:232`, `apps/web/src/app/admin/bots/config/page.tsx:299`). Static/DB tests cover forbidden provider/runtime/live-control keys and no selected-user global edit controls (`tests/integration/admin-global-bot-config-static.test.ts:25`, `tests/integration/admin-global-bot-config-static.test.ts:26`, `tests/integration/admin-global-bot-config-static.test.ts:74`, `tests/integration/admin-global-bot-config-static.test.ts:122`, `tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-db.test.ts:216`). Recommendation: next implementation should add a rendered DB-backed proof for a published default row, version history row, locked override state, and disabled live-control status. Target part: `/admin/bots/config` rendered acceptance.

## Decisions
1. Treat the current bot settings/setup source model as source-level PASS with one UX enhancement request for threshold/range clarity.
2. Treat the local rendered probe as scoped evidence only: desktop-width render on an existing `3411` local e2e/dev server, not production canary, not mobile, not screenshot acceptance, and not a live provider read.
3. Do not run the existing e2e specs in this audit because `tests/e2e/bot-settings.spec.ts` writes screenshots (`tests/e2e/bot-settings.spec.ts:31`, `tests/e2e/bot-settings.spec.ts:56`, `tests/e2e/bot-settings.spec.ts:68`, `tests/e2e/bot-settings.spec.ts:82`, `tests/e2e/bot-settings.spec.ts:97`); keeping this audit handoff as the only intentional file change was higher priority.
4. No background agents were spawned by this auditor, so there were none to close.
5. A generated Next `apps/web/next-env.d.ts` reference flip caused by inspecting the existing e2e server was restored to its pre-audit content; no product-code diff is intentionally left by this audit.

## Risks
1. The worktree was heavily dirty before this audit; unrelated changes were preserved and not reverted.
2. Existing local listeners on `3000` and `3412` returned HTTP 500 for `/login`; rendered checks used the already-running `3411` listener only.
3. Rendered checks were desktop-width only; existing mobile e2e source was inspected, but not run in this session.
4. The admin-user drilldown render was demo-empty-state only because no Postgres-backed user directory was available through the existing local browser target.
5. No screenshot, full e2e, full build, lint, typecheck, real Postgres, worker, provider, or live server acceptance is claimed.

## Verification/tests
RUN:
1. Required protocol and status docs were read before writing this handoff.
2. `git status --short --branch` was checked before work; branch was `codex/bot-analytics-settings-canary-20260603`, with many pre-existing modified/untracked files.
3. Local listener probe: `3410` and `3411` returned the WTC login page; `3000` and `3412` returned HTTP 500 for `/login`. No listener was started or stopped.
4. In-app browser rendered probe on existing `http://127.0.0.1:3411` after local e2e login:
   - `/app/bots/legacy/settings` - rendered `Configuration`, `Settings readiness map`, `Settings source`, `Legacy strategy map`, `Stage capacity`, `Effective Legacy settings review`, and `Download config export`; no horizontal overflow at observed `1265px` client width; no `Connection verified`.
   - `/app/bots/legacy/setup` - rendered `Guided onboarding`, `Current setup settings review`, `Effective Legacy settings review`, `Legacy strategy map`, and `Stage capacity`; no horizontal overflow; no `Connection verified`.
   - `/app/bots/tortila/settings` - rendered `Configuration`, `Settings readiness map`, `Private exchange connection`, `Per-coin Tortila configuration`, `Effective Tortila settings review`, and `Runtime export preview`; no horizontal overflow; no `Connection verified`.
   - `/app/bots/tortila/setup` - rendered `Guided onboarding`, `Setup source`, `Current setup settings review`, `Step 1 - Add an exchange API key`, and `Stored in WTC only`; no horizontal overflow; no `Connection verified`.
   - `/admin/bots/config` - rendered `System bot defaults`, `Default ownership model`, `Effective system default review`, `Effective Legacy settings review`, `Effective Tortila settings review`, `LIVE CONTROL: DISABLED`, and uppercase `USER SETTINGS: UNAFFECTED`; no horizontal overflow; no `Connection verified`.
   - `/admin/bots` - rendered `Bot fleet`, `Runtime safety summary`, `Canonical warning summary`, `Legacy pub_id inspector`, and `LIVE CONTROL: DISABLED`; no horizontal overflow; no `Connection verified`.
   - `/admin/users/demo-user/bots` - rendered `User bot details`, `LIVE CONTROL: DISABLED`, uppercase `USER SETTINGS: READ-ONLY`, uppercase `PROVIDER MAPPINGS: READ-ONLY`, and `Operational scope`; demo-empty-state only; no horizontal overflow; no `Connection verified`.
5. Focused Vitest: `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-global-bot-config-static.test.ts` - PASS, 5 files / 40 tests.

NOT RUN:
1. Existing Playwright/e2e specs - not run because they write screenshot artifacts; source inspected instead.
2. Full `npm test`, `npm run lint`, root/web typecheck, and web build - skipped for read-only audit scope/time.
3. Mobile rendered browser pass - skipped; existing mobile e2e source was inspected but not executed.
4. DB-backed rendered admin-user drilldown with a populated user - not run; no disposable browser DB target was available without starting a new managed server.
5. Real Postgres migration/seed, worker tick/restart/smoke, provider DB, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, and live server checks - forbidden by scope/protocol.

## Next actions
1. Add inline range/meaning hints and tighter error targeting for Legacy RSI threshold, CCI threshold, and stage slot inputs.
2. Add a no-screenshot rendered smoke or update existing e2e in an artifact-aware phase for the exact six scoped routes plus `/admin/users/[userId]/bots`.
3. Add a DB-backed rendered acceptance path for a populated admin user bot drilldown covering user custom, system default, locked override, provider mapping, canonical warnings, and user-scoped runtime stats.
4. Add a DB-backed rendered acceptance path for `/admin/bots/config` showing an actual published default row, version history, override lock, and live-control-disabled state.
5. Keep all future bot UX copy metadata-only until security and bot-integration audits approve a real read-only adapter; do not introduce "connection verified" language earlier.
