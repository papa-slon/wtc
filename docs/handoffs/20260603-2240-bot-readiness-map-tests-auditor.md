# bot-readiness-map-tests-auditor handoff
## Scope
Phase 3.82 read-only tests audit for a user-facing bot readiness map across bot dashboard, settings, setup, and cabinet setup signals. The audit focused on static and browser guardrails for: access entitlement, exchange key/vault metadata, strategy config source, runtime/provider snapshot, statistics readiness, and live-control disabled state.

No product code, test code, live services, `.env`, provider DBs, worker ticks, bot controls, SSH, tmux, or systemd were touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`
5. `docs/STATUS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/NEXT_ACTIONS.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/features/bots/BotReadinessMap.tsx`
12. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
13. `apps/web/src/features/bots/data.tsx`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/statistics-panels.tsx`
16. `apps/web/src/features/cabinet/loader.ts`
17. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
18. `packages/cabinet/src/derive.ts`
19. `packages/cabinet/src/derive.test.ts`
20. `packages/db/src/repositories.ts`
21. `packages/shared/src/schemas.ts`
22. `apps/web/src/features/admin/user-bot-detail-loader.ts`
23. `apps/web/src/features/admin/bot-health-loader.ts`
24. `tests/integration/bot-read-safety-static.test.ts`
25. `tests/integration/cabinet-pg9.test.ts`
26. `tests/e2e/cabinet-pg9-mobile.spec.ts`
27. `tests/e2e/bot-settings.spec.ts`
28. `tests/e2e/admin-mobile-pg8.spec.ts`
29. `tests/integration/admin-user-bot-detail-static.test.ts`
30. `tests/integration/admin-user-bot-detail-loader.test.ts`
31. `tests/integration/admin-global-bot-config-static.test.ts`
32. `tests/integration/admin-bot-health-loader.test.ts`
33. `tests/integration/user-resolved-bot-config-static.test.ts`
34. `tests/integration/user-resolved-bot-config-db.test.ts`
35. `tests/integration/bot-statistics-static.test.ts`

## Files changed
None - read-only audit. Only this handoff file was written.

## Findings
1. High - access entitlement must be the first readiness gate. Evidence: dashboard returns the access-required view before `loadBotReadModelForUser`, `loadBotConfig`, and `listExchangeKeys` (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:115`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:127`); settings does the same before loading readiness inputs (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:172`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:173`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:176`); cabinet gathers signals only inside `decision.allowed` (`apps/web/src/features/cabinet/loader.ts:152`, `apps/web/src/features/cabinet/loader.ts:157`). Recommendation: keep/extend `tests/integration/bot-read-safety-static.test.ts` to assert all dashboard/settings/setup/cabinet readiness data loaders occur after access checks and that denied users never trigger `listExchangeKeys`, `loadBotConfig`, or `loadBotReadModelForUser`. Target part: access entitlement.

2. High - exchange-key readiness must stay metadata-only and must not imply exchange connectivity. Evidence: metadata checks select only account metadata plus `exchangeApiKeySecrets.id`, return `checkKind: 'sealed_metadata_only'`, `livePing: false`, and audit only safe fields (`packages/db/src/repositories.ts:424`, `packages/db/src/repositories.ts:440`, `packages/db/src/repositories.ts:442`, `packages/db/src/repositories.ts:453`, `packages/db/src/repositories.ts:454`, `packages/db/src/repositories.ts:459`); the UI says no live ping and keeps the future ping disabled (`apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:73`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:97`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:107`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:126`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:147`). Recommendation: keep the current static guard in `tests/integration/bot-read-safety-static.test.ts:233` and add map-specific assertions that `Exchange key` values are `WTC vault metadata saved` or `No key saved`, never `Connection verified`. Target part: key/vault metadata.

3. High - recommended forbidden strings/imports for key/readiness static guards. Evidence: current guard already bans dangerous calls in metadata actions (`tests/integration/bot-read-safety-static.test.ts:250` through `tests/integration/bot-read-safety-static.test.ts:255`). Recommendation: for `BotReadinessMap.tsx`, dashboard readiness item construction, settings readiness item construction, and the two metadata-check server actions, statically forbid `Connection verified`, `Exchange connected`, `Live exchange verified`, `livePing: true`, `vault.open`, `getVault().open`, `decrypt`, `fetch(`, `axios`, `getBotAdapter`, `startBot`, `stopBot`, `applyConfig`, `retest`, `s.exchangeApiKeySecrets.sealed`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `BINGX_API`, and `SECRET_VAULT_KEK`. For the extracted metadata-check action bodies only, also forbid `apiKey`, `apiSecret`, `sealed`, and raw provider output names. Target part: static safety guard.

4. Medium - `BotReadinessMap` is presentational and should remain logic-free. Evidence: the component has only a status union, label/tone mapping, responsive table markup, and optional links (`apps/web/src/features/bots/BotReadinessMap.tsx:4`, `apps/web/src/features/bots/BotReadinessMap.tsx:15`, `apps/web/src/features/bots/BotReadinessMap.tsx:29`, `apps/web/src/features/bots/BotReadinessMap.tsx:41`, `apps/web/src/features/bots/BotReadinessMap.tsx:55`). Recommendation: add or strengthen a static test so this file may import only `next/link` and `@wtc/ui`, and must not import backend/session/config/data/db/vault/bot-adapter modules. Target part: shared map component.

5. High - strategy config readiness must use the WTC config source, not provider runtime snapshots. Evidence: dashboard computes `strategyConfigured` from `wtcConfig.source` and displays `wtcConfig.sourceLabel` (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:149`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:179`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:181`); settings uses `state.source`, `sourceLabel`, and `sourceDetail` for readiness (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:200`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:234`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:235`); config source tests already pin the resolver model and live-control exclusions (`tests/integration/user-resolved-bot-config-static.test.ts:9`, `tests/integration/user-resolved-bot-config-static.test.ts:77`). Recommendation: add map-specific assertions that the `Strategy source` readiness item uses `wtcConfig.sourceLabel`/`state.sourceLabel` and does not read `runtimeConfig`, `liveConfig`, `providerAccounts`, `rawJson`, or adapter config as the source of truth. Target part: strategy config source.

6. High - runtime/provider readiness must stay user-scoped and provider-scoped. Evidence: user runtime reads are scoped to the current user's `botInstances` and, for Legacy, exactly one active `botProviderAccounts` mapping (`apps/web/src/features/bots/data.tsx:296`, `apps/web/src/features/bots/data.tsx:301`, `apps/web/src/features/bots/data.tsx:314`, `apps/web/src/features/bots/data.tsx:321`, `apps/web/src/features/bots/data.tsx:326`, `apps/web/src/features/bots/data.tsx:332`); snapshot queries then use the scoped `botInstanceId` and optional `botProviderAccountId` (`apps/web/src/features/bots/data.tsx:346`, `apps/web/src/features/bots/data.tsx:347`, `apps/web/src/features/bots/data.tsx:350`, `apps/web/src/features/bots/data.tsx:353`). Recommendation: extend static tests to assert the dashboard `Runtime snapshot` item is fed from `health.readState`, `read.adapterMode`, and scoped loader output only; forbid global product/fleet snapshots in user-facing map code. Target part: runtime/provider snapshot.

7. Medium - statistics readiness must distinguish unavailable data from zero data. Evidence: dashboard uses `statisticsStatus(!!metrics, read.metrics.issue ?? read.trades.issue)` and says unavailable states are honest rather than fabricated (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:195`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:196`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:200`); existing statistics static tests assert safe read models, no direct adapter calls, no-equity states, and Legacy snapshot evidence (`tests/integration/bot-statistics-static.test.ts:26`, `tests/integration/bot-statistics-static.test.ts:34`, `tests/integration/bot-statistics-static.test.ts:64`). Recommendation: add readiness-map assertions for the `Statistics` layer, link to `/app/bots/statistics?bot=${bot}`, and no fabricated `0`, `0%`, or green status when metrics/trades issue is present. Target part: statistics readiness.

8. High - live control must remain explicitly read-only. Evidence: dashboard readiness includes `Live control`, `readonly`, and `Start/stop/apply disabled` (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:205`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:206`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:207`); the actual buttons are disabled and the page repeats that live config apply is unavailable (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:348`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:349`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:355`); settings has `Live apply` as `readonly` (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:242`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:243`). Recommendation: keep static guards that reject any enabled submit action or server action named start/stop/apply/retest/testExchange on dashboard/settings/setup/cabinet readiness surfaces. Target part: live-control disabled state.

9. Medium - cabinet setup signal clarity is already moving in the right direction, but should stay pinned. Evidence: the loader labels Tortila as metadata-only and Legacy as provider-pub-id runtime (`apps/web/src/features/cabinet/loader.ts:90`, `apps/web/src/features/cabinet/loader.ts:95`, `apps/web/src/features/cabinet/loader.ts:96`, `apps/web/src/features/cabinet/loader.ts:103`, `apps/web/src/features/cabinet/loader.ts:104`); static and mobile tests already assert those exact strings (`tests/integration/cabinet-pg9.test.ts:54`, `tests/integration/cabinet-pg9.test.ts:55`, `tests/e2e/cabinet-pg9-mobile.spec.ts:21`, `tests/e2e/cabinet-pg9-mobile.spec.ts:22`, `tests/e2e/cabinet-pg9-mobile.spec.ts:23`). Recommendation: preserve these exact phrases or equivalent metadata/live-ping-negative assertions whenever cabinet copy changes. Target part: cabinet setup signal clarity.

10. Medium - browser acceptance currently covers settings and cabinet but not the bot dashboard readiness map. Evidence: `tests/e2e/bot-settings.spec.ts` checks `Settings readiness map`, `Live apply`, no `Connection verified`, and no horizontal scroll (`tests/e2e/bot-settings.spec.ts:16`, `tests/e2e/bot-settings.spec.ts:18`, `tests/e2e/bot-settings.spec.ts:19`, `tests/e2e/bot-settings.spec.ts:26`, `tests/e2e/bot-settings.spec.ts:27`); cabinet mobile checks the setup signals (`tests/e2e/cabinet-pg9-mobile.spec.ts:18`, `tests/e2e/cabinet-pg9-mobile.spec.ts:22`). Recommendation: add `tests/e2e/bot-readiness-map.spec.ts` or extend `bot-settings.spec.ts` to visit `/app/bots/tortila` and `/app/bots/legacy`, assert the readiness rows `Access`, `Exchange key` or `Provider pub_id`, `Strategy source`, `Runtime snapshot`, `Statistics`, and `Live control`, assert `Start/stop/apply disabled`, assert `Connection verified` count is zero, and assert no horizontal scroll at desktop plus 375px mobile. Target part: end-to-end acceptance.

## Decisions
1. No gates were run in this audit because the task was read-only source inspection plus handoff.
2. Recommended coverage should be mostly static/source assertions, with one focused Playwright pass for dashboard/settings/cabinet rendering and responsive table behavior.
3. The readiness map should remain a display component; readiness decisions should come from existing entitlement, vault metadata, config, read-model, and statistics loaders.
4. Do not introduce a live exchange ping, bot control, worker tick, provider DB read, or secret/vault-open operation as part of readiness-map acceptance.

## Risks
1. Dashboard and settings currently build readiness arrays separately. Without map-specific tests, the six-layer vocabulary can drift between surfaces.
2. A green `ready` status for `Exchange key` can be misread as live exchange connectivity unless every test and copy keeps `metadata`, `live ping not run`, or equivalent language.
3. Browser coverage currently proves settings and cabinet clarity, but not the dashboard map itself.
4. Static string tests can become brittle; keep them focused on safety semantics, forbidden operations, and exact user-facing claims that must not regress.

## Verification/tests
RUN:
1. Required docs/protocol/source inspection only.

NOT RUN:
1. `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-bot-health-loader.test.ts` - not run by audit scope.
2. `npm run e2e -- tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` - not run by audit scope.
3. Proposed future `npm run e2e -- tests/e2e/bot-readiness-map.spec.ts` - not run because the audit did not create tests.
4. `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `git diff --check`, `npm run check:core` - not run by audit scope.
5. Live exchange ping/test, live bot start/stop/apply-config/retest, worker tick/restart, SSH, tmux, systemd, `.env` read/write, and provider DB live read/write - not run by policy.

Recommended acceptance gates for the main rollout:
1. Static: `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-statistics-static.test.ts`.
2. Loader safety: `npm run test -- tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-bot-health-loader.test.ts`.
3. Browser: `npm run e2e -- tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` plus the proposed dashboard readiness-map e2e.
4. Hygiene: `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, and `git diff --check`.

## Next actions
1. Strengthen `tests/integration/bot-read-safety-static.test.ts` with dashboard/settings readiness-map item assertions and the forbidden operation/import lists above.
2. Add or extend a static test for `apps/web/src/features/bots/BotReadinessMap.tsx` so it stays presentational and responsive.
3. Preserve `tests/integration/cabinet-pg9.test.ts` and `tests/e2e/cabinet-pg9-mobile.spec.ts` cabinet labels that distinguish exchange metadata from live ping verification.
4. Add one focused Playwright dashboard readiness-map check for Tortila and Legacy at desktop/mobile widths before calling the rollout accepted.
5. Keep all live-control, live exchange ping, worker, provider DB, and secret-vault-open gates out of this readiness-map acceptance until separate security and bot-integration audits approve them.
