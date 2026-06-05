# ecosystem-bot-integration-auditor handoff
## Scope
Read-only Phase 4.10 audit of the Tortila runtime/source evidence path.

Goal: identify where current WTC code loads Tortila read-only runtime evidence from WTC DB snapshots, worker journal health, and journal imports; how dashboard, statistics, admin, and readiness surfaces represent that state; and the next exact UI/source gap to fix so users/admins can understand whether Tortila has current read-only runtime evidence without claiming live control or current enforcement.

Out of scope: product code edits, tests edits, live server mutation, env/secret inspection, provider/API/exchange ping/order/mark reads, bot start/stop/apply/retest, worker tick, DB mutation, deploy, or any claim that WTC proves current live Tortila enforcement.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
8. `apps/worker/src/index.ts`
9. `apps/worker/src/jobs.ts`
10. `packages/bot-adapters/src/http.ts`
11. `packages/bot-adapters/src/tortila/tortila.mapping.ts`
12. `packages/bot-adapters/src/types.ts`
13. `apps/web/src/features/bots/data.tsx`
14. `apps/web/src/features/bots/journal.ts`
15. `apps/web/src/features/bots/readiness-loader.ts`
16. `apps/web/src/features/bots/readiness.ts`
17. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
18. `apps/web/src/features/bots/statistics-panels.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
20. `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
22. `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
23. `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
24. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
25. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
26. `apps/web/src/features/admin/bot-health-loader.ts`
27. `apps/web/src/features/admin/queries.ts`
28. `apps/web/src/features/admin/types.ts`
29. `apps/web/src/app/admin/bots/page.tsx`
30. `apps/web/src/app/admin/system-health/page.tsx`
31. `tests/integration/worker-tortila-snapshot.test.ts`
32. `tests/integration/admin-bot-health-loader.test.ts`
33. `tests/integration/bot-read-safety-static.test.ts`
34. `tests/integration/bot-readiness-builder.test.ts`
35. `tests/integration/bot-readiness-server-dto-static.test.ts`
36. `tests/integration/bot-statistics-static.test.ts`
## Files changed (None - read-only audit, except this handoff path)
1. `docs/handoffs/20260604-1025-tortila-runtime-source-bot-integration-auditor.md`
## Findings
1. Severity: High. The current safe Tortila evidence path is DB-backed and read-only, but the source/freshness state is distributed across several projections rather than one user/admin decision point. Evidence: worker tick chooses `TORTILA_JOURNAL_URL` / `TORTILA_JOURNAL_BASE_URL`, `SYSTEM_BOT_INSTANCE_ID` / `SYSTEM_BOT_OWNER_ID`, and `JOURNAL_READ_TOKEN`, then calls `snapshotTortilaJournal` without live control (`apps/worker/src/index.ts:154`, `apps/worker/src/index.ts:185`, `apps/worker/src/index.ts:191`); the snapshot job writes `integration_health_checks`, `bot_metric_snapshots`, `bot_position_snapshots`, and imports closed trades (`apps/worker/src/jobs.ts:89`, `apps/worker/src/jobs.ts:164`, `apps/worker/src/jobs.ts:189`, `apps/worker/src/jobs.ts:206`, `apps/worker/src/jobs.ts:235`); user loaders read the latest `tortila-journal` health row and user-scoped snapshots (`apps/web/src/features/bots/data.tsx:411`, `apps/web/src/features/bots/data.tsx:494`, `apps/web/src/features/bots/data.tsx:507`, `apps/web/src/features/bots/data.tsx:518`). Recommendation: add a compact Tortila "runtime evidence" DTO/card used by dashboard, statistics, and admin that combines latest health readState, checkedAt, snapshotAt, sourceAdapter, metricsAvailable, positionsSnapshotted, tradesImported/tradesSeen, stale age, and scope. Target part: `apps/web/src/features/bots/data.tsx`, `apps/web/src/features/bots/readiness-loader.ts`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/app/admin/bots/page.tsx`.
2. Severity: High. A persisted Tortila metric row can be weaker than "current runtime metrics", but several UI labels treat row existence/sourceAdapter as enough to show positive snapshot state. Evidence: the worker writes a `bot_metric_snapshots` row even when `metrics` is null, with `rawJson.metricsAvailable` represented only indirectly by `metricsAvailable: metrics !== null` in the later health row (`apps/worker/src/jobs.ts:135`, `apps/worker/src/jobs.ts:164`, `apps/worker/src/jobs.ts:168`, `apps/worker/src/jobs.ts:179`, `apps/worker/src/jobs.ts:242`); admin owner drilldown marks non-mock Tortila rows as `snapshot persisted` from `sourceAdapter` alone (`apps/web/src/app/admin/bots/page.tsx:96`); the latest metric card shows `sourceAdapter` and snapshot time but not `metricsAvailable` or readState (`apps/web/src/app/admin/bots/page.tsx:388`, `apps/web/src/app/admin/bots/page.tsx:400`); tests currently assert Tortila fleet rows from metric snapshots and redaction, not the "metric row but metrics unavailable" presentation (`tests/integration/admin-bot-health-loader.test.ts:209`, `tests/integration/admin-bot-health-loader.test.ts:237`). Recommendation: project `metricsAvailable` from latest health detail/rawJson and render "health-only snapshot" or "runtime metrics unavailable" when wallet/trade metrics are missing, even if `sourceAdapter='tortila'`. Target part: admin bot health loader/page and user dashboard/statistics source labels.
3. Severity: Medium. Tortila dashboard/statistics communicate read-only monitoring and disable live controls, but the statistics operation map summarizes Tortila runtime as counts only, not as source/freshness evidence. Evidence: dashboard badges show health pill plus adapter mode (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:156`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:159`), and live controls remain disabled (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:191`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:303`); the statistics page shows health pill/adapter mode and control-disabled copy (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:317`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:339`), but its Tortila runtime summary is only `${trades.length} trades / ${positions.length} open positions` (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:354`). Recommendation: replace the Tortila runtime summary with the same evidence DTO: `readState`, "DB snapshot", last health age, last metric/position/trade age, source adapter, and explicit "not current enforcement". Target part: `BotOperationMapPanel` inputs on dashboard/statistics.
4. Severity: Medium. Tortila runtime config/current enforcement remains intentionally missing, but the UI should keep separating "WTC reference config" from "runtime evidence" so Phase 4.08/4.09 cap work is not mistaken for live enforcement. Evidence: the real HTTP adapter says `getConfig` is not implemented because the journal has no `/api/config` endpoint (`packages/bot-adapters/src/http.ts:87`, `packages/bot-adapters/src/http.ts:181`); the DB loader only builds runtime config from `rawMetric.liveConfig`, which Tortila worker rows do not write (`apps/web/src/features/bots/data.tsx:629`, `apps/web/src/features/bots/data.tsx:633`); the dashboard already shows "Runtime config read unavailable" when no config exists (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx:294`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:299`). Recommendation: next UI copy should say "current runtime config/enforcement: not evidenced by journal; WTC reference caps only" near the Tortila evidence card and cap/settings surfaces. Target part: dashboard configuration card, operation map, settings/readiness copy.
5. Severity: Medium. Warning handling is conservative and mostly correct: persistent Tortila P0/P1 warnings survive mode changes and empty warnings are not treated as exchange all-clear. Evidence: real adapter warning copy persists P0/P1 warnings (`packages/bot-adapters/src/http.ts:128`, `packages/bot-adapters/src/http.ts:140`); canonical mapping prevents `healthy` while unresolved warnings exist (`packages/bot-adapters/src/tortila/tortila.mapping.ts:36`); web warning summary states source/scope and says no warning codes do not enable live control (`apps/web/src/features/bots/WarningSummaryPanel.tsx:60`, `apps/web/src/features/bots/WarningSummaryPanel.tsx:92`); admin always renders Tortila persistent warnings (`apps/web/src/app/admin/bots/page.tsx:340`). Recommendation: preserve this model when adding runtime-evidence cards; do not collapse warning absence into green runtime health. Target part: warning panels and admin bot health summary.
6. Severity: Low. Journal trade review is DB-first in Postgres mode and no longer falls back to a live adapter when imports are empty, which is safe but can leave a blank user-facing journal without showing whether the worker has current health-only evidence. Evidence: when DB exists, journal loader ensures the bot instance and reads `listBotTradeImports`; when no imports exist it returns Postgres `db_imports` with empty trades (`apps/web/src/features/bots/journal.ts:162`, `apps/web/src/features/bots/journal.ts:169`, `apps/web/src/features/bots/journal.ts:203`); page copy says DB-first journal but empty state only says "Run the worker import or connect a read-only adapter" (`apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx:154`, `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx:170`). Recommendation: add the same runtime-evidence state to the journal page empty state so empty trades can distinguish "worker fresh but no closed trades" from "worker stale/not configured". Target part: `apps/web/src/features/bots/journal.ts` and journal page.
## Decisions
1. Current code supports the safe evidence path: Tortila journal -> worker read-only adapter -> WTC DB snapshots/imports -> user/admin UI.
2. No live health proof was collected in this audit; all runtime claims above are source-code and prior-handoff evidence only.
3. Tortila `/api/marks` remains intentionally unused; WTC should not read marks/order/provider state directly from the exchange.
4. Tortila current runtime config/enforcement is not proven by the journal path. WTC reference caps/settings must stay labelled as WTC-side reference/profile state.
5. The next implementer should improve source/freshness semantics before adding more Tortila controls, live diffs, or current-enforcement claims.
## Risks
1. Users/admins can currently see "real/read-only" style indicators and snapshot rows without one consolidated freshness/source explanation, which can overstate how current the evidence is.
2. A metric snapshot row with missing metric values can still appear as a persisted snapshot; without `metricsAvailable` presentation, operators may treat health-only evidence as analytics evidence.
3. Staleness is computed in the user DB loader, but admin fleet snapshot cards do not appear to use the same stale threshold for owner rows.
4. Tortila signal warnings from live logs are not proven by the current real adapter; only persistent P0/P1 warnings are unconditional in real mode.
5. Phase 4.08/4.09 reference cap UI could be misread as live runtime enforcement unless the next runtime-evidence UI explicitly says current enforcement is not evidenced.
## Verification/tests
RUN:
1. Required docs/protocol/source handoff reads listed above.
2. Static/source inspection with `rg` and targeted PowerShell line reads.
3. Confirmed the required handoff path did not exist before writing.

NOT RUN:
1. Product code tests, typecheck, lint, Playwright, build, coverage - skipped because this lane is read-only audit and no product/test code was changed.
2. Worker tick, DB queries/mutations, migrations, seeds - skipped by scope.
3. Live server, SSH, tmux, systemd, nginx, deploy/canary checks - skipped by scope.
4. Provider/API/exchange pings, order reads, position reads, mark reads, journal endpoint calls - skipped by scope.
5. Bot start/stop/apply/retest/live diagnostics - skipped by safety protocol.
6. Env value or secret inspection - skipped by scope.
## Next actions
1. Implement a shared Tortila runtime-evidence DTO/projection from latest `integration_health_checks` plus user-scoped latest metric/position/trade/import rows. It should expose readState, readStateDetail, health checkedAt, snapshotAt per type, sourceAdapter, adapterMode, metricsAvailable, positionsSnapshotted, tradesSeen/imported, stale age, and evidence scope.
2. Render that DTO on Tortila dashboard, statistics, journal empty state, and admin bot fleet as the first runtime-source signal.
3. Add tests for health-only/readState-not-ok cases so `sourceAdapter='tortila'` or a metric row cannot render as full/current runtime evidence when metrics are unavailable or stale.
4. Keep all copy explicit: "read-only DB snapshot evidence", "not live control", and "current runtime config/enforcement not evidenced by WTC journal".
5. Do not add live controls, live exchange reads, direct provider mutation, worker ticks, or deploy work as part of this gap fix.
