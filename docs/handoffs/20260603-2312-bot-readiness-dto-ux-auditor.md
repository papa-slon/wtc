# bot-readiness-dto-ux-auditor handoff
## Scope
Read-only Phase 3.83 UX/product audit of current bot readiness/settings/setup/cabinet UX for Legacy and Tortila after Phase 3.82. Focus: safest/highest-value shared readiness DTO/builder integration, recommended rows per surface, copy clarity, responsive behavior, and admin/user vocabulary drift.

This audit did not edit product or test code. It did not read or write .env files, ping live exchanges, start/stop/apply/retest bots, tick/restart workers, SSH, tmux, systemd, or read/write provider DBs.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`
5. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
6. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
7. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
8. `apps/web/src/features/bots/BotReadinessMap.tsx`
9. `apps/web/src/features/bots/readiness.ts`
10. `apps/web/src/features/cabinet/loader.ts`
11. `packages/cabinet/src/derive.ts`
12. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
13. `apps/web/src/features/bots/data.tsx`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/app/(app)/app/page.tsx`
16. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `packages/ui/src/theme.css`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/cabinet-pg9.test.ts`
21. `tests/e2e/bot-settings.spec.ts`
22. `tests/e2e/cabinet-pg9-mobile.spec.ts`
23. `tests/e2e/smoke.spec.ts`
24. `packages/cabinet/src/derive.test.ts`
25. `tests/integration/user-resolved-bot-config-static.test.ts`

## Files changed
None - read-only audit. Required handoff only: docs/handoffs/20260603-2312-bot-readiness-dto-ux-auditor.md

## Findings
1. High - a shared pure row builder now exists, but there is still no narrow server-only readiness DTO, so dashboard/settings/setup feed it from broader loaders and raw config-shaped objects. Evidence: `apps/web/src/features/bots/readiness.ts:30` defines a UI-oriented `BuildBotReadinessInput`; dashboard still loads metrics/positions/trades/config and reads `config.raw` in `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112`; settings reads Legacy `config.data.raw` in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:177`; setup does the same in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:194`. Recommendation: add `loadBotReadinessForUser(userId, productCode)` as a server-only DTO loader that returns only safe scalar facts: access reason, key metadata count, Legacy provider mapping count/status, config source/version, runtime read state/label/detail/timestamps, metrics availability/issue, and warning counts. Target part: shared readiness source for dashboard/settings/setup/cabinet.
2. High - the current static guard is stale after builder extraction and fails now. Evidence: `tests/integration/bot-read-safety-static.test.ts:78` still expects runtime/status/copy strings inside the dashboard/settings page sources, while those strings moved to `apps/web/src/features/bots/readiness.ts:66` and `apps/web/src/features/bots/readiness.ts:80`; targeted verification `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts` failed because line 81 expected the old inline `readState === 'unreachable' || readState === 'malformed'` source. Recommendation: update the static guard to assert `buildBotReadinessItems` call sites plus direct `readiness.ts` status/copy invariants; add small direct tests for `runtimeReadinessStatus`, `statisticsReadinessStatus`, and surface-specific row labels. Target part: readiness static/unit tests.
3. Medium - cabinet still uses its older setup checklist model instead of the readiness builder, even though the builder declares a `cabinet` surface. Evidence: `apps/web/src/features/bots/readiness.ts:16` includes `cabinet`; `apps/web/src/features/cabinet/loader.ts:87` manually creates bot setup items; `packages/cabinet/src/derive.ts:84` exposes only entitlement/setup/activity/warnings on the card view. Recommendation: keep `@wtc/cabinet` pure, but let the web cabinet loader consume the server-only readiness DTO and either pass compact `readinessItems` through `CabinetSignals` or map canonical readiness rows into setup/activity labels. Target part: cabinet loader/card integration.
4. Medium - user/admin vocabulary still diverges around Legacy mapping and settings source. Evidence: readiness rows say `Provider pub_id` in `apps/web/src/features/bots/readiness.ts:97`; settings has a local `pubIdSummary` without "provider" in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:83`; setup metric copy says `Provider mapping` in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:293`; admin says `provider account mapped/pending` in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:16`; cabinet says `Legacy uses provider pub_id runtime` in `apps/web/src/features/cabinet/loader.ts:90`. Recommendation: centralize customer-facing labels as `Legacy provider pub_id`, `Tortila exchange key metadata`, `WTC settings source`, and reserve `provider account mapping` for admin detail pages where the account mapping object is actually visible. Target part: copy constants and row labels.
5. Medium - setup review now renders the shared map, but Tortila runtime/statistics rows intentionally show "Not checked here"; that is safe but can read like an incomplete setup result. Evidence: setup passes `runtime: null` for Tortila and `statistics: null` in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:218`; the builder emits `Not checked here` and dashboard/statistics CTAs in `apps/web/src/features/bots/readiness.ts:108` and `apps/web/src/features/bots/readiness.ts:121`; setup review renders the map in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:511`. Recommendation: for setup review, either omit operational rows with `includeOperationalRows: false` or change the copy to `Dashboard-only read` / `Not loaded during setup` so users do not interpret it as a blocker. Target part: setup review readiness copy.
6. Medium - responsive mechanics are sound, but browser coverage does not yet prove the new dashboard/setup readiness maps across bot slugs. Evidence: `BotReadinessMap` uses `wtc-table-wrap` and `data-label` cells in `apps/web/src/features/bots/BotReadinessMap.tsx:31`; the shared CSS converts wrapped tables to stacked cards at 640px in `packages/ui/src/theme.css:118`; settings and cabinet mobile no-horizontal-scroll checks exist in `tests/e2e/bot-settings.spec.ts:16` and `tests/e2e/cabinet-pg9-mobile.spec.ts:13`. Recommendation: add dashboard readiness map e2e for `/app/bots/tortila` and `/app/bots/legacy`, plus setup review at 375px. Target part: Playwright coverage.

## Decisions
1. Recommended dashboard rows: Access, Bot connection (`Tortila exchange key metadata` or `Legacy provider pub_id`), WTC settings source, Runtime snapshot, Statistics, Live control disabled.
2. Recommended settings rows: Access, Bot connection, WTC settings source, Live apply disabled. Settings should not show runtime/stat rows unless it loads a narrow readiness DTO that is explicitly read-only.
3. Recommended setup review rows: Access, Bot connection, WTC settings source, Runtime snapshot only when a safe snapshot DTO is loaded or otherwise `Dashboard-only read`, Statistics as `Open statistics` or omitted, Live control disabled.
4. Recommended cabinet rows: compact bot readiness only: Access, Bot connection, WTC settings source, Live control disabled. Cabinet should avoid detailed runtime/statistics rows unless the DTO is already cheap and safe.
5. `ready` must never mean live exchange verified or bot controllable. Key rows mean WTC vault metadata exists; Legacy rows mean provider pub_id attribution is scoped; live ping/control remain separate future audited phases.
6. Admin vocabulary may say `provider account mapping`; user vocabulary should say `Legacy provider pub_id` and explain that admins map it.

## Risks
1. The worktree was already dirty and changed during this audit; the current state now includes `apps/web/src/features/bots/readiness.ts` and dashboard/settings/setup builder call sites. This handoff is based on the newest observed file state.
2. The targeted static guard currently fails, so this slice is not acceptance-clean even though the UX direction is coherent.
3. The new builder duplicates access reason labels instead of delegating to the canonical access copy, increasing drift risk between cabinet, bot rooms, and admin pages.
4. A cabinet integration that imports app/web loaders into `@wtc/cabinet` would create the wrong boundary. Keep DTO loading in `apps/web`, keep the cabinet package pure.

## Verification/tests
RUN:
1. Read required protocol docs and Phase 3.82 handoff: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`.
2. Read required bot dashboard/settings/setup/cabinet files plus the newly present `apps/web/src/features/bots/readiness.ts`.
3. Source-inspected relevant static/e2e coverage for bot readiness, settings, setup, cabinet, admin user bot detail, and responsive table behavior.
4. `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts` - FAIL. `cabinet-pg9.test.ts` passed; `bot-read-safety-static.test.ts` failed because assertions still target old inline dashboard readiness code.

NOT RUN:
1. Playwright e2e - not run; audit scope only and static guard already failed.
2. Typecheck/lint/build - not run; no product code was changed by this auditor.
3. Live exchange ping/test - not run by policy.
4. Live bot start/stop/apply-config/retest - not run by policy.
5. Worker tick/restart, SSH, tmux, systemd - not run by policy.
6. Provider DB live read/write - not run by policy.
7. `.env` read/write - not run by policy.

## Next actions
1. Fix `tests/integration/bot-read-safety-static.test.ts` for the builder extraction, then add direct unit/static tests for `apps/web/src/features/bots/readiness.ts`.
2. Implement a server-only `loadBotReadinessForUser` DTO loader that excludes secrets, raw provider payloads, `rawJson`, live adapter calls for cabinet, and live-control semantics.
3. Feed dashboard/settings/setup from the DTO plus `buildBotReadinessItems`; keep page-specific rows only for rich dashboard metrics and config editors.
4. Integrate cabinet through the web cabinet loader using compact DTO-derived rows, not by moving app logic into `@wtc/cabinet`.
5. Normalize copy constants for `Legacy provider pub_id`, `Tortila exchange key metadata`, `WTC settings source`, `Runtime snapshot`, `Statistics`, and live disabled rows.
6. Add Playwright coverage for dashboard readiness maps on Tortila and Legacy and setup review at 375px, then rerun the relevant static/e2e gates.
