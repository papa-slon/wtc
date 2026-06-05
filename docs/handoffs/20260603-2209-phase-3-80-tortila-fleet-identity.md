# phase-3-80-tortila-fleet-identity handoff
## Scope
Phase 3.80 implemented the next narrow admin fleet identity slice for the WTC bot ecosystem.

The goal was to make Tortila visible on `/admin/bots` with the correct WTC ownership semantics, without inventing a Legacy-style provider id. Tortila fleet identity is now derived from persisted WTC snapshots through `bot_metric_snapshots -> bot_instances -> users`, shown as a WTC bot-instance owner, and linked to `/admin/users/[userId]/bots` for read-only user drilldown. Legacy remains separate and continues to use active `bot_provider_accounts` provider mapping.

No live bot start/stop/apply-config/retest/test-connection path was added or run. No exchange ping, worker tick/restart, provider DB live read/write, SSH, tmux, systemd, or `.env` read/write was performed.

## Agent handoffs
1. `docs/handoffs/20260603-2158-tortila-fleet-identity-platform-auditor.md`
2. `docs/handoffs/20260603-2158-tortila-fleet-identity-ux-security-auditor.md`
3. `docs/handoffs/20260603-2158-tortila-fleet-identity-tests-auditor.md`

Background agents were launched before edits and closed before this handoff:
1. `019e8dfe-977b-75c3-9772-05144e3abdb5`
2. `019e8dfe-e353-7473-ad60-c8cfa3d620b7`
3. `019e8dff-2db3-7103-b20b-432a420dd1e6`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`
8. `docs/handoffs/20260603-2158-tortila-fleet-identity-platform-auditor.md`
9. `docs/handoffs/20260603-2158-tortila-fleet-identity-ux-security-auditor.md`
10. `docs/handoffs/20260603-2158-tortila-fleet-identity-tests-auditor.md`
11. `apps/web/src/features/admin/bot-health-loader.ts`
12. `apps/web/src/features/admin/types.ts`
13. `apps/web/src/app/admin/bots/page.tsx`
14. `apps/web/src/features/admin/user-bot-detail-loader.ts`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/worker/src/jobs.ts`
17. `apps/worker/src/index.ts`
18. `packages/db/src/schema.ts`
19. `tests/integration/admin-bot-health-loader.test.ts`
20. `tests/integration/bot-read-safety-static.test.ts`
21. `tests/integration/admin-responsive.test.ts`
22. `tests/integration/admin-user-bot-detail-loader.test.ts`
23. `tests/integration/admin-user-bot-detail-static.test.ts`
24. `tests/integration/worker-tortila-snapshot.test.ts`
25. `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
1. `apps/web/src/features/admin/bot-health-loader.ts`
   - Added `tortilaFleetSnapshots(db)`, a safe projection from `bot_metric_snapshots` to `bot_instances` to `users`.
   - Filters Tortila rows by `bot_instances.productCode='tortila_bot'`.
   - Keeps only the latest snapshot per bot instance, with safe owner fields, snapshot time, equity, trade count, source adapter, and `scope: 'bot_instance_owner'`.
   - Filters the existing `latestSnapshot` card to Tortila rows so it cannot show a Legacy row under Tortila copy.
   - Does not select `rawJson`, exchange secrets, provider DB URLs, password hashes, or provider ids for Tortila.

2. `apps/web/src/features/admin/types.ts`
   - Added `TortilaFleetSnapshotAdminView`.
   - Added `tortilaFleetSnapshots` to `AdminBotHealthResult`.

3. `apps/web/src/app/admin/bots/page.tsx`
   - Added a read-only `Tortila user-scoped snapshots` table.
   - Shows WTC bot-instance owner, scope, snapshot time, equity, trade count, and source adapter.
   - Links owner rows to `/admin/users/[userId]/bots`.
   - Adds copy that Tortila does not expose a Legacy-style provider `pub_id` in WTC and that provider-account mapping is a future decision.
   - No live controls, forms, start/stop/apply/test actions, or provider edit controls were added.

4. `tests/integration/admin-bot-health-loader.test.ts`
   - Added PGlite coverage for Tortila owner projection, latest-per-instance selection, read-only table counts, and absence of raw journal/token/secret/password/provider-account fields.

5. `tests/integration/bot-read-safety-static.test.ts`
   - Added static guards for Tortila fleet snapshot projection, user join, no exchange-secret join, page table copy, owner scope, and user detail link.

6. `apps/web/next-env.d.ts`
   - Restored the normal `.next/types/routes.d.ts` reference after mobile Playwright generated an `.next-e2e` reference.

## Findings
1. Severity: High. Tortila fleet identity should be shown as WTC bot-instance owner. The worker writes Tortila snapshots by `botInstanceId`; there is no stable audited Tortila provider id in the current WTC contract.

2. Severity: High. The previous generic latest snapshot selection could pick a non-Tortila row. It is now product-filtered to Tortila.

3. Severity: Medium. Tortila and Legacy have different safe identity semantics. Legacy is provider-account mapped through masked `pub_id`; Tortila is user-scoped through WTC bot instance ownership.

4. Severity: Medium. DB-backed browser proof of actual Tortila owner rows is still not present. PGlite proves loader semantics; mobile Playwright proves layout/no-control behavior in demo mode.

## Decisions
1. Current Tortila `/admin/bots` identity source is `bot_metric_snapshots -> bot_instances -> users`.
2. Tortila provider-account mapping is deferred until Tortila has a stable audited provider id and a contract for persisting it.
3. The UI label is `bot instance owner`, not `provider account mapped`.
4. Owner action is navigation-only: open selected-user bot details. Admin cannot change the user's bot settings from the fleet page.
5. No schema migration is needed for this slice.

## Risks
1. If `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` points to the wrong WTC owner in deployment, `/admin/bots` will honestly show that configured WTC owner. A future non-live runbook check should verify the intended owner/instance mapping.

2. Snapshot freshness and owner identity are separate facts. This phase does not prove live Tortila continuity.

3. Admin-only user email/display name are intentionally shown on admin pages. Keep the projection minimal and do not add secrets, raw JSON, provider URLs, tokens, sealed payloads, or password hashes.

4. A future Tortila provider-account model could change copy and tests; it should be a separate audited phase.

## Verification/tests
RUN and passed:
1. Required governance reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md`.
2. Three read-only background agents launched before edits, each wrote one handoff listed above, and all three were closed.
3. `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts` - passed after implementation, 3 files and 69 tests.
4. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/worker-tortila-snapshot.test.ts` - passed, 3 files and 13 tests.
5. `npm run typecheck -w @wtc/web` - passed after implementation and again after restoring `apps/web/next-env.d.ts`.
6. `npm run typecheck` - passed.
7. `npm run lint` - passed.
8. `npm run secret:scan` - passed.
9. `npm run build -w @wtc/web` - passed, 36 static pages.
10. `npm run check:core` - passed.
11. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - passed, 1 test.
12. `npm run evidence:visual -- --inventory tests/e2e/screenshots` - passed, 75 image files and 0 blocked containers.
13. `git diff --check` - passed.

NOT RUN:
1. Full `npm test` - skipped for phase scope after focused Vitest plus core gates passed.
2. Full `npm run e2e` - skipped for phase scope; focused mobile PG8 gate was run.
3. `scripts/gates.mjs full` or `scripts/gates.mjs e2e` - skipped for phase scope.
4. Persistent DB migrate/seed - not run.
5. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` read/write, start/stop/retest/apply-config - not run and intentionally forbidden for this phase.
6. DB-backed browser proof of actual Tortila owner rows - not run; covered semantically by PGlite and layout-wise by demo mobile Playwright.

## Next actions
1. Add a non-live deployment/runbook check that verifies configured `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` matches the intended WTC Tortila owner before treating canary evidence as operationally accepted.
2. Continue toward the broader goal: exchange-key connection test UX through mocked/dev adapters, user default/custom settings polish, Legacy/Tortila statistics dashboard polish, and eventual audited runtime continuity proof without live mutations until safety gates approve them.
3. Defer Tortila provider-account mapping until a stable provider id is defined and approved.
