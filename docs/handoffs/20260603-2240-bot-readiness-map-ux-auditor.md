# bot-readiness-map-ux-auditor handoff
## Scope
Read-only UX/product audit for Phase 3.82: WTC bot readiness map and cabinet/setup signal clarity for Tortila and Legacy bot users, with light admin-surface cross-check. The audit inspected the current dirty worktree only, did not run product gates, did not access live providers, did not read or write `.env`, did not touch provider DBs, and did not start/stop/retest/apply any bot or worker path.

This is a single-auditor handoff. No background agents were launched because the operator requested exactly one handoff file for this phase; no N-agent audit claim is made.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`
5. `docs/STATUS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/NEXT_ACTIONS.md`
8. `apps/web/src/features/cabinet/loader.ts`
9. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
10. `packages/cabinet/src/derive.ts`
11. `apps/web/src/app/(app)/app/page.tsx`
12. `apps/web/src/app/(app)/app/bots/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
16. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
17. `apps/web/src/app/(app)/app/security/page.tsx`
18. `apps/web/src/features/bots/BotReadinessMap.tsx`
19. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
20. `apps/web/src/features/bots/data.tsx`
21. `apps/web/src/features/bots/config.ts`
22. `apps/web/src/features/bots/meta.ts`
23. `apps/web/src/features/bots/statistics-panels.tsx`
24. `apps/web/src/lib/backend.ts`
25. `apps/web/src/lib/db-store.ts`
26. `apps/web/src/lib/demo.ts`
27. `apps/web/src/lib/access.ts`
28. `packages/shared/src/schemas.ts`
29. `packages/db/src/repositories.ts`
30. `packages/bot-adapters/src/types.ts`
31. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
32. `apps/web/src/features/admin/user-bot-detail-loader.ts`
33. `tests/e2e/cabinet-pg9-mobile.spec.ts`
34. `tests/e2e/bot-settings.spec.ts`
35. `tests/integration/cabinet-pg9.test.ts`
36. `tests/integration/bot-read-safety-static.test.ts`
37. `tests/integration/bot-statistics-static.test.ts`
38. `tests/integration/user-resolved-bot-config-static.test.ts`

## Files changed
None - read-only audit. Handoff written only at `docs/handoffs/20260603-2240-bot-readiness-map-ux-auditor.md`.

## Findings
1. High - Runtime readiness can be falsely shown as ready for broken reads. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:51-54` maps only impossible strings `blocked`/`error` to `blocked`, then returns `ready` for everything else except `stale`, `not_configured`, or mock mode. But the canonical read states are `ok`, `not_configured`, `unreachable`, `malformed`, and `stale` in `packages/bot-adapters/src/types.ts:26-33`, and the DB/read layer can produce `unreachable` in `apps/web/src/features/bots/data.tsx:212-240`. Recommendation: make the helper accept the real `ReadState` union and map `unreachable`/`malformed` to `blocked` or at least `attention`; prefer reusing `botHealthPill` tone semantics from `apps/web/src/features/bots/meta.ts:95-113`. Target part: bot dashboard readiness map status model.

2. Medium - The new readiness map hard-codes access as "Entitlement active" even when a grace entitlement is allowed. Evidence: dashboard readiness items set `value: 'Entitlement active'` in `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:150-156`; settings does the same in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:207-213`. The entitlement engine grants both active and grace, returning reason `allowed` or `grace` in `packages/entitlements/src/engine.ts:129-139`, and user labels already distinguish `Active` from `Grace period` in `apps/web/src/lib/access.ts:17-31`. Recommendation: drive the Access row from `access.reason`/`access.status` with `reasonLabel` and warn tone for grace. Target part: readiness map access row.

3. Medium - `BotReadinessMap` exists and is a good presentational primitive, but readiness item construction is duplicated in server pages instead of a tested source of truth. Evidence: the presentational component only renders supplied items in `apps/web/src/features/bots/BotReadinessMap.tsx:29-72`; dashboard builds a six-layer map inline in `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:150-210`; settings builds a separate four-layer map inline in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:207-247`. Recommendation: extract a small pure builder such as `features/bots/readiness.ts` with typed inputs for access, key/provider mapping, config source, health/read model, metrics issue, and live-control policy. Add unit/static tests there, then have dashboard/settings/setup/cabinet consume it. Target part: shared bot readiness model.

4. Medium - Cabinet overview still cannot show the full user-facing readiness map, and the top summary can over-signal key readiness. Evidence: cabinet signals are limited to setup items, activity, and warnings in `packages/cabinet/src/derive.ts:36-45`; the cabinet bot loader currently exposes only key/provider and strategy setup text in `apps/web/src/features/cabinet/loader.ts:83-109`; `CabinetProductCard` renders setup/activity/blockers only in `apps/web/src/features/cabinet/CabinetProductCard.tsx:35-72`; `/app` also shows an unconditional `KEYS VAULT` card with `Encrypted` in `apps/web/src/app/(app)/app/page.tsx:26-31`. Recommendation: smallest high-value cabinet slice is a compact readiness row on Tortila/Legacy product cards: Access, Key/vault or provider pub_id, Strategy source, Runtime snapshot, Stats readiness, Live control disabled. Replace or qualify the global key-vault card with an actual key metadata count/status. Target part: cabinet loader/card and `/app` overview.

5. Medium - Setup wizard is clear for key and strategy steps, but users do not see the full readiness map before finishing setup. Evidence: setup loads keys/config/Legacy config only in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:190-215`; the setup source card covers resolved source, key/provider count, and finish requirement in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:270-279`; the review step covers keys, strategy config, and live control disabled in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:488-505`. It does not surface stats readiness or runtime snapshot status in the same map users see on the dashboard. Recommendation: add a compact `Setup readiness map` to the review step using the shared builder, with read-only snapshot/stat rows marked unavailable when not loaded. Target part: guided setup review.

6. Low - Admin user bot detail has strong read-only and secret-safe signals, but it uses different vocabulary from the user readiness map. Evidence: admin page states live control disabled and read-only settings/provider mappings in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:74-83`; per-bot pills show access/settings/key/provider scope in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:117-139`; exchange key metadata is masked and secret material is not loaded in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229-235`; stats scope is explicit in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:263-268`. Loader reads only safe exchange-account metadata in `apps/web/src/features/admin/user-bot-detail-loader.ts:749-755`. Recommendation: later align admin cards to the same layer names as user readiness (`Access`, `Key/vault`, `Strategy source`, `Runtime snapshot`, `Statistics`, `Live control`) without adding any admin mutation action. Target part: admin user bot detail UX copy.

## Decisions
1. The smallest high-value product slice is not to create a new full page. It is to finish and normalize the already-present readiness map primitive: fix the runtime/access status bugs, extract a shared builder, then render compact versions on cabinet bot cards and setup review.
2. The readiness map must remain read-only. It may use existing WTC metadata and snapshot loaders, but must not run live exchange pings, open the vault, start/stop/apply/retest bots, restart workers, or call provider services.
3. The user-facing status language should distinguish "WTC metadata saved", "live ping not run", "system default", "user custom", "built-in fallback", "provider pub_id mapped", "snapshot unavailable/stale", "stats unavailable", and "live control disabled".
4. Settings can keep a settings-specific map, but its title/copy should not imply it is the complete operational readiness map unless runtime and statistics rows are included or linked.

## Risks
1. The current dirty worktree already contains pre-existing modified/untracked readiness-map work; evidence line numbers reflect the current snapshot and may move if parallel work continues.
2. If `unreachable` or `malformed` stays mapped to `ready`, users may see an apparently good runtime layer when the journal/worker read path is actually broken.
3. Adding runtime/stat snapshot rows to cabinet/setup could create extra DB reads. Keep all per-user signal loading inside the existing entitlement-allowed branch and avoid any direct provider call.
4. Key readiness must stay metadata-only until a separately audited read-only exchange adapter exists. Do not turn `Check WTC vault readiness` into "Connection verified".
5. Legacy provider mapping is a user-scoped attribution signal, not permission for live control or config apply.

## Verification/tests
RUN:
1. Read required protocol/source docs listed in Scope.
2. Static, read-only source inspection with `rg`, `Get-Content`, and `Test-Path`.
3. `git status --short` - read-only; confirmed many pre-existing modified/untracked files before this handoff.
4. Verified target handoff path did not exist before writing.

NOT RUN:
1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e`, `npm run governance:check`, `npm run secret:scan` - not run; this was a read-only UX/product audit and no product gate execution was requested.
2. Live exchange ping/test - prohibited.
3. Bot start/stop/apply-config/retest - prohibited.
4. Worker tick/restart, SSH, tmux, systemd, provider DB live read/write, `.env` read/write - prohibited.
5. Browser/manual visual verification - not run; no local server was started.

## Next actions
1. Fix `runtimeReadinessStatus` so `unreachable` and `malformed` cannot render as `ready`; add focused tests for `ok`, `not_configured`, `stale`, `unreachable`, `malformed`, and mock mode.
2. Replace hard-coded "Entitlement active" in dashboard/settings readiness rows with `reasonLabel(access.reason)`/status-aware copy so grace is explicit.
3. Extract a pure readiness item builder and reuse it across bot dashboard, settings, setup review, and cabinet compact bot cards.
4. Add cabinet bot-card readiness rows for Access, Key/vault or Provider pub_id, Strategy source, Runtime snapshot, Statistics, and Live control disabled; qualify or replace the global `KEYS VAULT Encrypted` metric.
5. Add a setup review readiness map that shows runtime/stat rows as read-only unavailable when not loaded, rather than silently omitting them.
6. Extend tests with a static no-live-call/no-secret guard for the shared builder plus mobile e2e assertions for cabinet, setup review, dashboard, and settings readiness labels.
