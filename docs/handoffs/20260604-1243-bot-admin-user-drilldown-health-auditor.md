# bot-admin-user-drilldown-health-auditor handoff
## Scope
Read-only Phase 4.14 audit of selected-user admin bot drilldown health. Focus: per-product runtimeHealth DTO/status/readState/checkedAt/freshness, latest rows for `tortila-journal` and `legacy-bot`, no green runtime scope from mapping/scope alone, admin/user separation, and no admin mutation of user settings.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md
- docs/handoffs/20260604-1205-bot-worker-continuity-web-admin-auditor.md
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/health-detail.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/worker/src/index.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence apps/web/src/features/admin/user-bot-detail-loader.ts:950 and apps/web/src/features/admin/types.ts:157 - recommendation: add `runtimeHealth` to `AdminUserBotSummary` with target, status, readState, readStateDetail, checkedAt, freshness, state, and note - target part: selected-user admin bot DTO and loader.
2. Severity P1 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:100 and apps/web/src/app/admin/users/[userId]/bots/page.tsx:151 - recommendation: stop treating `user_scoped` or `provider_account_mapped` as runtime green by itself - target part: evidence ladder and card status pills.
3. Severity P2 - evidence apps/web/src/features/admin/user-bot-detail-loader.ts:950 and apps/web/src/features/admin/user-bot-detail-loader.ts:987 - recommendation: fetch latest health row per expected target rather than a shared latest-20 window - target part: health row query for selected-user drilldown.
4. Severity P2 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:160 and apps/web/src/features/admin/types.ts:89 - recommendation: combine scoped statistics evidence with runtime health/freshness so old snapshots do not imply live health - target part: statistics evidence row and freshness copy.
5. Severity P2 - evidence tests/integration/admin-user-bot-detail-loader.test.ts:408 and tests/integration/admin-user-bot-detail-static.test.ts:76 - recommendation: add tests for stale readState with coarse status `ok`, missing target coverage, malformed/unreachable, and no green runtime/status pill when health is bad - target part: selected-user loader/static tests.

## Decisions
- Read-only only; no edits, tests, DB mutation, worker tick, browser, provider/exchange, env, or live bot action was run by this agent.
- Provider mapping and WTC ownership are scope evidence only, not health evidence.
- The admin route remains RBAC-gated and view-only; the missing part was runtime health gating.

## Risks
- Worktree was already heavily dirty, including target files.
- Source-level audit only; no rendered/browser test was run by this agent.

## Verification/tests
RUN:
- `git status --short --branch`
- Read-only `rg` searches and line-level source inspection.

NOT RUN:
- Unit/integration/e2e tests.
- Browser render.
- DB worker tick or live health mutation.
- Provider/exchange calls, live bot start/stop/apply-config, secrets/env reads, deploy/SSH/tmux/systemd.

## Next actions
1. Add `runtimeHealth` DTO fields and populate them in `loadAdminUserBotDetailFromDb`.
2. Replace the shared health window with latest-per-target rows.
3. Gate selected-user runtime scope and statistics tones through runtimeHealth status/readState/freshness.
4. Add PGlite/static assertions covering stale/missing/bad readState and no admin mutation controls.

