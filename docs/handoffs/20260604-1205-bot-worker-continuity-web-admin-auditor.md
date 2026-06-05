# bot-worker-continuity-web-admin-auditor handoff
## Scope
Read-only audit of WTC web/admin bot health consumption. Focused on `/admin/bots`, selected-user bot drilldown, admin health loaders/types/detail projection, and app bot readiness/continuity surfaces that consume `BotHealth.readState`.

## Files inspected
- AGENTS.md
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/meta.ts
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/continuity.ts
- apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx
- apps/worker/src/jobs.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts

## Files changed
None - read-only audit

## Findings
1. Severity High - evidence apps/web/src/features/admin/bot-health-loader.ts:221 and apps/web/src/app/admin/bots/page.tsx:18 and apps/web/src/app/admin/bots/page.tsx:28 - recommendation: make `journalReadStatePill()` prioritize readState for stale, unreachable, and malformed before coarse status/last-ok - target part: `/admin/bots` journal pill and fleet health row.
2. Severity High - evidence apps/web/src/features/admin/bot-health-loader.ts:323 and apps/web/src/features/admin/bot-health-loader.ts:329 and apps/web/src/features/admin/bot-health-loader.ts:340 - recommendation: query latest rows per bot target or use a target-filtered query before limiting, and return coverage metadata for missing expected targets - target part: loadAdminBotHealthFromDb bot health checks and canonical warning summaries.
3. Severity Medium - evidence apps/web/src/app/admin/bots/page.tsx:90 and apps/web/src/app/admin/bots/page.tsx:98 and apps/web/src/app/admin/bots/page.tsx:113 - recommendation: gate owner drilldown green states with normalized product health/readState coverage and snapshot age - target part: `/admin/bots` owner drilldown and admin fleet evidence ladder.
4. Severity Medium - evidence apps/web/src/features/admin/user-bot-detail-loader.ts:868 and apps/web/src/features/admin/types.ts:146 and apps/web/src/app/admin/users/[userId]/bots/page.tsx:151 - recommendation: add a small runtimeHealth DTO per product with status, readState, checkedAt, stale/coverage, then gate runtime scope/statistics tones through it - target part: selected-user admin bot drilldown loader/page.
5. Severity Low - evidence apps/web/src/features/bots/data.tsx:329 and apps/web/src/features/bots/meta.ts:95 and apps/web/src/features/bots/readiness.ts:69 and apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:95 and apps/web/src/features/bots/continuity.ts:147 - recommendation: keep main readiness logic, but downgrade row-level snapshot/data-row green when runtime readTone is warn/bad - target part: app bot runtime evidence and continuity row rendering.

## Decisions
- No code changes made in this read-only lane.
- Smallest safe web/admin slice after backend runtime proof: normalize admin health/readState in one server-loader helper, use target-filtered/per-target latest health queries, extend admin DTOs with runtime health coverage, and gate only affected status pills/metric tones.

## Risks
- Current worktree is dirty with many modified/untracked files, including files in scope.
- No live DB or browser render was run; findings are source-level.

## Verification/tests
RUN:
- git status --short --branch.
- rg searches and line-level source inspection.

NOT RUN:
- Tests, browser render, live DB, worker tick, provider/exchange calls, and live bot control - not run by read-only audit scope.

## Next actions
1. Add PGlite tests for readState stale plus status ok, malformed/unreachable detail, and more than 50 newer non-bot health rows.
2. Patch admin loaders to fetch expected bot targets before limiting.
3. Patch `/admin/bots` and selected-user drilldown to treat missing/stale/bad readState as warn/bad instead of green.
4. Add render/static assertions that no stale/unreachable/malformed health row can show a green admin pill.
