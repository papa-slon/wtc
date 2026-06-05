# admin-user-runtimehealth-e2e-coverage-auditor handoff
## Scope
Read-only Phase 4.15 audit of selected-user admin bot drilldown runtimeHealth rendering and DB-backed E2E coverage. Focused on what the E2E must assert, what fixture/prep data is required for fresh/stale/missing runtime health, whether the UI remains read-only for user settings and live bot control, and the minimal coverage edits main should make next. No live bot mutation, exchange/provider call, secret read, app code edit, DB write, server start, deploy, SSH, tmux, or systemd action was performed.

## Files inspected
- AGENTS.md (operator-provided instructions in prompt)
- docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/features/admin/health-detail.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
- scripts/prepare-admin-user-bot-detail-e2e.ts
- scripts/run-admin-user-bot-detail-e2e.mjs
- scripts/run-admin-user-bot-detail-e2e-managed.mjs

## Files changed
- docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md (this handoff only)

## Findings
1. Severity P1 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:77, apps/web/src/app/admin/users/[userId]/bots/page.tsx:107, apps/web/src/app/admin/users/[userId]/bots/page.tsx:141, apps/web/src/app/admin/users/[userId]/bots/page.tsx:178, apps/web/src/app/admin/users/[userId]/bots/page.tsx:316, tests/e2e/admin-user-bot-detail-db.spec.ts:121 - recommendation: add rendered DB E2E assertions for the exact runtimeHealth consumption text, not just the generic evidence ladder - target part: tests/e2e/admin-user-bot-detail-db.spec.ts. The selected-user page consumes runtimeHealth in the overview Runtime scope column, each bot card runtime pill, the `Runtime health` metric, and the `Runtime scope` evidence row. With the current prep rows, the exact visible labels to assert are: `Runtime health` count 2, `Runtime scope` count 2, `runtime: tortila-journal: ok`, `runtime: legacy-bot: ok`, `user instance snapshots / tortila-journal: ok`, `Legacy pub_id USER_A...B_ID / legacy-bot: ok`, and because the current health status is `degraded`, `evidence stale or gated` count 2.
2. Severity P1 - evidence scripts/prepare-admin-user-bot-detail-e2e.ts:389, scripts/prepare-admin-user-bot-detail-e2e.ts:396, apps/web/src/features/admin/user-bot-detail-loader.ts:275, apps/web/src/features/admin/user-bot-detail-loader.ts:330, apps/web/src/features/admin/user-bot-detail-loader.ts:316, apps/web/src/features/admin/user-bot-detail-loader.ts:950 - recommendation: extend prep data deliberately before claiming fresh/stale/missing rendered coverage - target part: scripts/prepare-admin-user-bot-detail-e2e.ts and tests/e2e/admin-user-bot-detail-db.spec.ts. Current prep inserts latest rows for both `tortila-journal` and `legacy-bot` with `status: degraded` and `readState: ok`; this proves the page can print readState, but it does not prove green fresh state, stale state, or missing state. Because the loader selects only the latest row per target, a stale row hidden behind a newer fresh row will false-green. Required fixture coverage: latest fresh row with `status: ok` or `healthy`, `readState: ok`, checkedAt inside the 3-minute window, and user-scoped stats; latest stale row with `readState: stale` or checkedAt older than 3 minutes plus a unique `readStateDetail` and user-scoped stats; missing row by omitting/deleting the target in a dedicated fixture or DB phase, again with stats present so `User-scoped statistics` proves runtime health gates otherwise-present evidence.
3. Severity P2 - evidence apps/web/src/features/admin/user-bot-detail-loader.ts:366, apps/web/src/features/admin/user-bot-detail-loader.ts:374, apps/web/src/features/admin/health-detail.ts:4, apps/web/src/features/admin/health-detail.ts:67, tests/e2e/admin-user-bot-detail-db.spec.ts:79 - recommendation: keep health-detail fixtures scoped and secret-bearing in negative assertions - target part: selected-user runtime warning/health fixture. If the stale/missing E2E uses Legacy runtime warning assertions, Legacy needs one active provider-account mapping and health detail with `providerAccountMappingsSeen: 1` and `providerAccountMappingsSnapshotted: 1`; otherwise warning scope correctly remains `runtime_not_scoped`. Health detail should continue to include redaction canaries like the existing `TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER` and `LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER`, because the sanitizer only allows safe keys and redacted scalar/array values.
4. Severity P2 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:201, apps/web/src/app/admin/users/[userId]/bots/page.tsx:222, apps/web/src/app/admin/users/[userId]/bots/page.tsx:223, apps/web/src/app/admin/users/[userId]/bots/page.tsx:224, apps/web/src/app/admin/users/[userId]/bots/page.tsx:262, apps/web/src/app/admin/users/[userId]/bots/page.tsx:196, apps/web/src/app/admin/users/[userId]/bots/page.tsx:620, apps/web/src/features/admin/user-bot-detail-loader.ts:1143, tests/e2e/admin-user-bot-detail-db.spec.ts:136, scripts/run-admin-user-bot-detail-e2e.mjs:34 - recommendation: preserve current read-only boundaries while adding coverage - target part: selected-user admin UI safety. The page is RBAC-gated, presents `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only`, states that the page does not edit user settings/mappings/exchange keys/live config/open positions, and the loader returns `liveControlDisabled: true`. The E2E already asserts no forms, no CSRF hidden inputs, and no start/stop/apply/test-connection buttons, while the DB E2E runner forces `BOT_ADAPTER_MODE: mock` and `FEATURE_LIVE_BOT_CONTROL: false`.
5. Severity P2 - evidence tests/integration/admin-user-bot-detail-loader.test.ts:640, tests/integration/admin-user-bot-detail-loader.test.ts:693, tests/integration/admin-user-bot-detail-static.test.ts:154, tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:67, tests/e2e/admin-user-bot-detail-db.spec.ts:5 - recommendation: main should make a small coverage-only patch, then run the opt-in DB gate - target part: coverage plan. Integration tests already cover DTO stale and missing behavior, and static tests already lock page strings, but the DB E2E is opt-in and currently checks selected-user facts without exact runtimeHealth assertions. Minimal edits: add the exact visible assertions from Finding 1; add prep/harness data for fresh, stale, and missing without latest-row false greens; update the harness static test so those new prep markers/assertions are locked; run the managed DB E2E with a disposable admin Postgres URL.

## Decisions
- Treated `runtimeHealthLabel` output as the primary rendered proof because it is used in both overview and bot-card status pills.
- Treated `Runtime health` metric and `Runtime scope` evidence row as secondary proof because they show the same DTO through the shared admin evidence ladder.
- Did not recommend changing app behavior in this lane; the requested next work is coverage-only unless main finds the rendered assertions fail.
- Missing-health rendered coverage cannot be honestly proven by adding another selected user while product-level health rows still exist for both targets; it needs a dedicated fixture/run/target state where the relevant latest target row is absent.
- Existing `status: degraded` plus `readState: ok` should be understood as fresh-but-attention evidence, not fresh-green evidence.

## Risks
- Current DB E2E may still pass if runtimeHealth stops rendering, because it only asserts generic ladder text and broader fixture markers.
- A stale fixture can false-green if a newer same-target row exists, since the loader orders target rows by `checkedAt desc` and takes one.
- Missing-health assertions can false-green if the product also lacks stats; then `User-scoped statistics` shows `pending` rather than proving runtime health gated otherwise-present evidence.
- Adding Legacy runtime warning assertions without the single active provider-account mapping shape will correctly change warning scope to `runtime_not_scoped`, which may look like a regression if the fixture intent is unclear.
- The checkout was already heavily dirty before this audit; this agent did not attempt to classify or revert pre-existing changes.

## Verification/tests
RUN:
- `git status --short` - inspected dirty state only.
- Static line-number inspection with `rg` and `Get-Content` for the files listed above.
- `Test-Path docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md` before writing - confirmed the handoff path did not already exist.

NOT RUN:
- `npm run e2e:admin-user-bots:db` / `npm run e2e:admin-user-bots:db:managed` - not run because this read-only audit was not provided a disposable admin Postgres URL, and the task asked for inspection/coverage guidance.
- Vitest, typecheck, eslint, full Playwright, build, secret scan, governance check - not run due read-only audit scope.
- Live bot start/stop/apply-config, exchange/provider calls, env/secret value reads, deploy/SSH/tmux/systemd - not run by safety policy.

## Next actions
1. In `tests/e2e/admin-user-bot-detail-db.spec.ts`, add exact rendered assertions for `Runtime health`, `Runtime scope`, `runtime: tortila-journal: ok`, `runtime: legacy-bot: ok`, `user instance snapshots / tortila-journal: ok`, `Legacy pub_id USER_A...B_ID / legacy-bot: ok`, and the appropriate statistics-gate label for the fixture state.
2. In `scripts/prepare-admin-user-bot-detail-e2e.ts`, add explicit fresh-green, stale, and missing health scenarios using latest-per-target data. Use stats-present products for stale/missing so the UI proves runtime health gates otherwise-present user evidence.
3. If Legacy runtime warning scope is asserted, keep exactly one active provider-account mapping in the fixture and include the mapping counts in the sanitized health detail.
4. Update `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` so the new prep markers and E2E assertions are statically locked.
5. Run `npm run e2e:admin-user-bots:db:managed` with a disposable admin Postgres URL, then run targeted lint/typecheck/static tests for the changed coverage files.
