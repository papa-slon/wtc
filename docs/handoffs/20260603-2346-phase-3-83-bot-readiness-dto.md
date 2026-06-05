# phase-3-83-bot-readiness-dto handoff
## Scope
Phase 3.83 completed the next bot-readiness slice for Legacy and Tortila after Phase 3.82. The goal was to stop duplicating readiness logic across bot dashboard, settings, setup review, and cabinet, while keeping all user-facing bot pages honest: no live exchange ping claim, no live start/stop/apply control, no secret exposure, and no green readiness state from weak evidence.

This phase did not read or write `.env`, did not open/decrypt vault secrets, did not ping live exchanges, did not start/stop/apply/retest bots, did not tick/restart workers, did not touch SSH/tmux/systemd, and did not read/write provider DBs. A separate local `next dev` server was started for web UI verification only.

Per-agent handoffs linked by path:
1. `docs/handoffs/20260603-2312-bot-readiness-dto-ux-auditor.md`
2. `docs/handoffs/20260603-2312-bot-readiness-dto-platform-security-auditor.md`
3. `docs/handoffs/20260603-2312-bot-readiness-dto-tests-auditor.md`

All three background agents were closed with `close_agent` before this aggregate was written.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`
5. `docs/handoffs/20260603-2312-bot-readiness-dto-ux-auditor.md`
6. `docs/handoffs/20260603-2312-bot-readiness-dto-platform-security-auditor.md`
7. `docs/handoffs/20260603-2312-bot-readiness-dto-tests-auditor.md`
8. `apps/web/src/features/bots/readiness.ts`
9. `apps/web/src/features/bots/BotReadinessMap.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/cabinet/loader.ts`
14. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
15. `packages/cabinet/src/derive.ts`
16. `tests/integration/bot-readiness-builder.test.ts`
17. `tests/integration/bot-read-safety-static.test.ts`
18. `tests/integration/cabinet-pg9.test.ts`
19. `tests/e2e/bot-readiness-map.spec.ts`
20. `tests/e2e/bot-settings.spec.ts`
21. `tests/e2e/cabinet-pg9-mobile.spec.ts`
22. `apps/web/next-env.d.ts`

## Files changed
1. `apps/web/src/features/bots/readiness.ts` - new pure shared readiness builder/status contract.
2. `apps/web/src/features/bots/BotReadinessMap.tsx` - presentational map now imports shared readiness types.
3. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` - dashboard now uses the shared builder; dashboard tables get mobile wrappers/data labels.
4. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` - settings now uses the shared builder and removes duplicated readiness logic.
5. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` - setup review now renders the shared readiness map.
6. `apps/web/src/features/cabinet/loader.ts` - cabinet bot signals now derive compact readiness rows from the shared builder only inside the allowed branch.
7. `apps/web/src/features/cabinet/CabinetProductCard.tsx` - cabinet cards render compact readiness rows.
8. `packages/cabinet/src/derive.ts` - pure cabinet model now carries readiness rows and fails closed for denied products.
9. `tests/integration/bot-readiness-builder.test.ts` - new direct matrix coverage for readiness status/row behavior.
10. `tests/integration/bot-read-safety-static.test.ts` - updated static boundaries for the shared builder and call sites.
11. `tests/integration/cabinet-pg9.test.ts` - cabinet fail-closed/readiness static coverage expanded.
12. `tests/e2e/bot-readiness-map.spec.ts` - new dashboard readiness e2e for Tortila and Legacy on desktop/mobile.
13. `tests/e2e/screenshots/bot-tortila-readiness-desktop.png`
14. `tests/e2e/screenshots/bot-tortila-readiness-mobile.png`
15. `tests/e2e/screenshots/bot-legacy-readiness-desktop.png`
16. `tests/e2e/screenshots/bot-legacy-readiness-mobile.png`
17. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`

## Findings
1. High - Readiness logic was spread across surfaces and could drift in copy/status behavior. Evidence: the new builder is now centralized at `apps/web/src/features/bots/readiness.ts:173`; dashboard/settings/setup/cabinet call it at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:134`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:218`, and `apps/web/src/features/cabinet/loader.ts:89`. Recommendation: keep future readiness changes in the shared builder or a future server-only DTO loader, not inline page code. Target part: bot readiness source of truth.
2. High - Count-only Tortila key evidence could be mistaken for live connectivity. Evidence: `apps/web/src/features/bots/readiness.ts:34-38` now requires provenance states, and `apps/web/src/features/bots/readiness.ts:95-107` treats `metadata_saved` as attention while reserving ready for `vault_metadata_confirmed`; tests assert this in `tests/integration/bot-readiness-builder.test.ts:76-86`. Recommendation: later wire a safe metadata-only repository summary before ever producing `vault_metadata_confirmed`; still do not call a live exchange ping in this slice. Target part: Tortila exchange key readiness.
3. High - Legacy provider evidence must not become green from raw runtime/config snapshots. Evidence: `apps/web/src/features/bots/readiness.ts:38` now separates `runtime_snapshot` from `db_mapping_confirmed`, and `apps/web/src/features/bots/readiness.ts:131-135` keeps runtime snapshot as attention; tests assert missing/snapshot/confirmed behavior in `tests/integration/bot-readiness-builder.test.ts:89-112`. Recommendation: next slice should feed `db_mapping_confirmed` from the narrow user-scoped DB provider mapping summary, not from `config.raw` or runtime provider snapshots. Target part: Legacy provider pub_id readiness.
4. Medium - Shared builders must fail closed even if a caller is later wrong. Evidence: `apps/web/src/features/bots/readiness.ts:189` returns only the access row when `accessAllowed` is false; static and builder tests cover this at `tests/integration/bot-read-safety-static.test.ts:90` and `tests/integration/bot-readiness-builder.test.ts:61-65`. Recommendation: keep caller-side entitlement gates, but also preserve this internal fail-closed branch. Target part: entitlement data minimization.
5. Medium - Cabinet needed readiness visibility without importing app/backend logic into `@wtc/cabinet`. Evidence: `packages/cabinet/src/derive.ts:49` adds pure readiness item types, `packages/cabinet/src/derive.ts:221` returns empty readiness when denied, and `apps/web/src/features/cabinet/loader.ts:89-114` maps the shared builder into compact card rows only after access is allowed. Recommendation: keep DTO loading in `apps/web` and keep `packages/cabinet` pure. Target part: package boundary.
6. Medium - Browser/e2e coverage needed to prove dashboard readiness maps are visible and responsive. Evidence: `tests/e2e/bot-readiness-map.spec.ts:13` visits Tortila and Legacy dashboards, asserts rows and no `Connection verified`, and captured desktop/mobile screenshots. Recommendation: keep this e2e in the focused bot acceptance gate until full dashboard coverage is broader. Target part: dashboard acceptance.

## Decisions
1. `ready` never means "live exchange verified" or "bot controllable" in this phase.
2. Tortila count-only exchange-key metadata is `attention`; only a future metadata-only account-plus-secret-row proof may become `vault_metadata_confirmed`.
3. Legacy runtime/provider snapshot evidence is `attention`; only a future active user-scoped DB provider mapping summary may become `db_mapping_confirmed`.
4. Settings rows are intentionally smaller than dashboard rows: Access, connection, Settings source, Live apply disabled.
5. Dashboard/setup/cabinet can reuse the same builder with surface-specific row labels and operational rows.
6. Cabinet readiness stays compact and entitlement-gated. Denied products get no readiness rows.
7. Live bot controls remain disabled and copy explicitly says stop never closes positions.

## Risks
1. Full user-facing bot completion is not done. This phase completed the shared readiness DTO/builder slice, not the full Legacy/Tortila configuration product requested by the operator.
2. A future server-only `loadBotReadinessForUser` DTO is still needed to remove broad page-loader inputs and feed only safe scalar facts into the builder.
3. Current Legacy readiness still reports runtime snapshot as attention where the page has safe read evidence; it does not yet prove DB mapping as ready.
4. Current Tortila readiness still reports exchange metadata count as attention; it does not yet prove account-plus-secret metadata as ready.
5. The worktree was already heavily dirty before this phase. This handoff lists the files touched by the Phase 3.83 slice, but many unrelated modified/untracked files remain in the repository.
6. A local web dev server was started on `http://127.0.0.1:3310` for UI verification; it is not a bot/worker/live service.

## Verification/tests
RUN:
1. Read protocol and seed docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and Phase 3.82 handoff.
2. Launched three read-only auditors before edits; collected and linked all three handoff files.
3. Closed all three agents with `close_agent`: Ohm `019e8e42-8213-79d1-9520-9c1d8a08d142`, Mill `019e8e42-9701-7683-8d57-3feb4c89e5ad`, Cicero `019e8e42-ace3-7db3-b009-eb0aa620cb16`.
4. `npm run test -- tests/integration/bot-readiness-builder.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts` - PASS, 3 files, 48 tests.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `npm run typecheck` - PASS.
7. `npm run e2e -- tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` - PASS, 6 passed, 2 skipped.
8. `npm run build -w @wtc/web` - PASS.
9. `npm run lint` - PASS.
10. `npm run secret:scan` - PASS.
11. `npm run check:core` - PASS.
12. `npm run typecheck -w @wtc/worker` - PASS.
13. `git diff --check` - PASS.
14. `git status --short -- apps/web/next-env.d.ts` and `git diff --exit-code -- apps/web/next-env.d.ts` - PASS, no residual e2e route-type churn.
15. In-app Browser on `http://127.0.0.1:3310`: Tortila and Legacy bot dashboards both showed Bot readiness map, connection/source/runtime/statistics/live disabled rows; `Connection verified` was absent; no horizontal scroll.
16. `Invoke-WebRequest http://127.0.0.1:3310/login` - PASS, HTTP 200 after restarting the local web dev server with logs outside the repository.
17. `npm run governance:check` before aggregate handoff - PASS, 0 errors and 1 known historical warning.
18. `npm run governance:check` after aggregate handoff - PASS, current phase `20260603-2346`, 0 errors and 1 known historical warning.

NOT RUN:
1. Full `npm test` - not run; focused integration suite was run for this slice, full repo test was outside scope/time for Phase 3.83.
2. Full unfocused Playwright suite - not run; focused bot readiness/settings/cabinet e2e was run.
3. `db:migrate`, `db:seed`, or migration generation - not run; this slice did not require schema changes.
4. Live exchange ping/test - not run by policy.
5. Live bot start/stop/apply-config/retest - not run by policy.
6. Worker tick/restart - not run by policy.
7. SSH/tmux/systemd/provider DB live read/write - not run by policy.
8. `.env` read/write or vault open/decrypt - not run by policy.
9. Git stage/commit/push/PR - not requested.

## Next actions
1. Implement `loadBotReadinessForUser(userId, productCode)` as a server-only DTO loader that returns only safe scalar facts for access, exchange-key metadata state, Legacy provider DB mapping state, config source, runtime snapshot state, statistics availability, and warnings.
2. Wire Tortila `vault_metadata_confirmed` from a safe metadata-only repository summary that proves owned account row plus encrypted secret metadata row, without live ping and without exposing secrets.
3. Wire Legacy `db_mapping_confirmed` from exactly one active user-scoped DB provider mapping; keep runtime provider snapshots as diagnostics only.
4. Extend setup review copy or row inclusion so "Not checked here" reads clearly as dashboard-only evidence, not a setup failure.
5. Continue toward the operator's broader goal: full Legacy and Tortila settings UX, default/custom strategy presets, per-symbol/stage indicator slots, user/admin statistics, admin read-only user drilldown, and separately audited live-control readiness.
