# ecosystem-bot-integration-auditor handoff
## Scope
Read-only audit for epoch 20260601-1814, focused on admin bot read-state rendering and bot journal DB-first ordering after the prior no-token Tortila fixes. No source edits, no live bot calls, no journal calls, no exchange calls, no SSH/tmux/systemd/process control.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/http.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Admin bot read-state rendering still collapses `not_configured` into a generic error/no-check state instead of preserving the worker's setup-needed state. Evidence: the real adapter returns first-class `readState: 'not_configured'` when `JOURNAL_READ_TOKEN` is absent (`packages/bot-adapters/src/http.ts:154`-`155`), and the worker persists this as `integration_health_checks.status = 'not_configured'` for target `tortila-journal` (`apps/worker/src/index.ts:77`-`81`, `apps/worker/src/jobs.ts:109`-`122`). The admin loader then derives only `tortilaLastOkAt` and `tortilaLastError`, selecting every non-ok row as an error (`apps/web/src/features/admin/queries.ts:277`-`299`), while the admin page turns any `tortilaLastError` into `journal: last check error` (`apps/web/src/app/admin/bots/page.tsx:15`-`19`). It also filters the detail table to `target LIKE 'bot.%'`, excluding the actual `tortila-journal` rows (`apps/web/src/features/admin/queries.ts:312`-`318`). Recommendation: expose the latest `tortila-journal` health row/status/detail in `AdminBotHealthResult`, map `not_configured` to a neutral/setup-needed admin pill like `botHealthPill` already does for user bot pages (`apps/web/src/features/bots/meta.ts:94`-`103`), and include `tortila-journal` in the admin bot health table or add a dedicated row. Target part: Workstream B/F admin bot observability.

2. HIGH - Bot journal loading is not DB-first in execution order; it probes the read adapter before checking durable imports. Evidence: `loadBotJournal` calls `loadBotReadModel(productCode, ['trades'])` before `getServerDb()`, `ensureBotInstance`, `listBotTradeImports`, or `listBotTradeReviews` (`apps/web/src/features/bots/journal.ts:147`-`166`). Only after the adapter read does it return `source: 'db_imports'` when imports exist (`apps/web/src/features/bots/journal.ts:169`-`200`). If imports are missing, it returns `source: 'adapter_latest'` (`apps/web/src/features/bots/journal.ts:203`-`211`), matching the UI banner that says adapter fallback should happen only after no durable trades are found (`apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx:145`-`155`). The no-token fix reduces unauthenticated fetches by skipping data reads after a `not_configured` health result (`apps/web/src/features/bots/data.tsx:149`-`157`), but `loadBotReadModel` still performs adapter health before DB imports are consulted (`apps/web/src/features/bots/data.tsx:140`-`147`). Recommendation: in Postgres mode, resolve DB/imports/reviews first and call the adapter only when the DB has zero imports and adapter fallback is explicitly needed; add a regression test with imported trades plus a throwing/spied adapter to prove no adapter read occurs. Target part: Workstream B bot journal DB-first ordering.

3. MEDIUM - Existing tests cover the prior no-token safety path but do not prove either audited admin/journal requirement. Evidence: `worker-tortila-snapshot` verifies no-token read-only mode makes no fetch and records `tortila-journal/not_configured` (`tests/integration/worker-tortila-snapshot.test.ts:83`-`103`), and `bot-read-safety-static` checks `canReadData` gates data reads when health is `not_configured` (`tests/integration/bot-read-safety-static.test.ts:53`-`57`). The journal static test only checks that `listBotTradeImports`, `listBotTradeReviews`, and `upsertBotTradeReview` appear in source (`tests/integration/bot-statistics-static.test.ts:57`-`65`); it does not assert call order or no adapter probe when imports exist. Recommendation: add an execution-level journal loader test and an admin loader render/model test for `not_configured`. Target part: tests-runner coverage for Workstreams B/F.

## Decisions
- Treated this as a per-agent read-only audit, not an implementation pass.
- Did not edit source code, start servers, call live journal endpoints, call bots/exchanges, or inspect secrets.
- Used current worktree files as authoritative; prior phase handoff was used only to identify the two open audit targets.

## Risks
- Admin operators may see setup-needed Tortila journal configuration as a red error, or may not see the `tortila-journal` row at all, causing noisy or misleading incident triage.
- The journal page can still perform adapter health/read work before durable DB imports are checked, so DB-backed journal behavior is not truly DB-first and remains sensitive to adapter availability/configuration during render.
- Green current tests can mask these gaps because the relevant assertions are static or cover only the worker/adapter no-token guard.

## Verification/tests
RUN - `npm test -- tests/integration/bot-read-safety-static.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/worker-tortila-snapshot.test.ts`
- PASS - 4 test files passed.
- PASS - 27 tests passed.
- No live bot, journal, exchange, SSH, tmux, systemd, preview, or Stripe calls were made.

NOT RUN
- Full gate suite - out of scope for this single read-only audit.
- Playwright/E2E - out of scope for this single read-only audit.
- Real Postgres worker/journal acceptance - no live or throwaway `DATABASE_URL` was used; live calls are prohibited by scope.

## Next actions
1. Implement admin bot health model changes: preserve latest `tortila-journal` status/detail, map `not_configured` to setup-needed/neutral, and render the actual `tortila-journal` row.
2. Reorder `loadBotJournal` so DB imports/reviews are loaded before any adapter read in Postgres mode.
3. Add execution-level tests for imported-trades/no-adapter-read and admin `not_configured` rendering.
