# tortila-fleet-identity-platform-auditor handoff
## Scope
Phase 3.80 read-only platform/data audit for showing Tortila mapped WTC user identity on `/admin/bots`.

The audit determined the safest current implementation semantics for Tortila fleet identity without live bot/provider/env mutation. It inspected the WTC DB ownership spine, admin bot health loader/types/page, selected-user bot detail loader/page, Tortila worker snapshot writers, and relevant tests. It did not run a worker tick, live provider read, exchange ping, SSH/tmux/systemd command, or any start/stop/restart/apply/retest/test-connection path.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`
8. `packages/db/src/schema.ts`
9. `packages/db/src/repositories.ts`
10. `apps/web/src/features/admin/bot-health-loader.ts`
11. `apps/web/src/features/admin/types.ts`
12. `apps/web/src/features/admin/queries.ts`
13. `apps/web/src/app/admin/bots/page.tsx`
14. `apps/web/src/features/admin/user-bot-detail-loader.ts`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/bots/data.tsx`
17. `apps/worker/src/index.ts`
18. `apps/worker/src/jobs.ts`
19. `apps/worker/src/legacy-live.ts`
20. `tests/integration/admin-bot-health-loader.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
22. `tests/integration/admin-user-bot-detail-loader.test.ts`
23. `tests/integration/admin-user-bot-detail-static.test.ts`
24. `tests/integration/worker-tortila-snapshot.test.ts`
25. `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Tortila fleet identity should be derived now from WTC snapshot ownership, not from a provider account. Evidence: `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:143` defines `bot_instances.user_id`; `packages/db/src/schema.ts:508` to `packages/db/src/schema.ts:527` defines `bot_metric_snapshots.bot_instance_id`; current `apps/web/src/features/admin/bot-health-loader.ts:116` to `apps/web/src/features/admin/bot-health-loader.ts:153` joins `bot_metric_snapshots -> bot_instances -> users`, filters `bot_instances.productCode='tortila_bot'`, returns one latest row per bot instance, and marks `scope: 'bot_instance_owner'`. Recommendation: keep this as the current Tortila `/admin/bots` identity semantics. Target part: admin bot health loader/types/page and its PGlite/static tests.

2. Severity: High. `bot_provider_accounts` is the correct current source for Legacy identity, but not for Tortila identity yet. Evidence: `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:173` defines provider-account mapping with `provider` and `provider_account_id`; `apps/web/src/features/admin/bot-health-loader.ts:86` to `apps/web/src/features/admin/bot-health-loader.ts:114` uses it only for active `legacy_bot` / `legacy-db` mappings; `apps/worker/src/jobs.ts:163` to `apps/worker/src/jobs.ts:187` writes Tortila metric snapshots with a `botInstanceId` and no `botProviderAccountId`; `apps/worker/src/index.ts:180` to `apps/worker/src/index.ts:191` resolves Tortila from `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID`, then calls `snapshotTortilaJournal`. Recommendation: defer Tortila `bot_provider_accounts` use until Tortila has a stable audited provider id and a contract for persisting it. Target part: future Tortila provider-account contract/worker mapping, not the current `/admin/bots` owner display.

3. Severity: Medium. The current admin DTO/page already follows the safest owner-labeling policy. Evidence: `apps/web/src/features/admin/types.ts:315` to `apps/web/src/features/admin/types.ts:363` defines `tortilaFleetSnapshots` with `ownerUser` and `scope: 'bot_instance_owner'`; `apps/web/src/app/admin/bots/page.tsx:226` to `apps/web/src/app/admin/bots/page.tsx:269` renders a "Tortila user-scoped snapshots" table, links the owner to `/admin/users/[userId]/bots`, and states that no Legacy-style provider `pub_id` is inferred. Recommendation: preserve the wording as "Owner" / "bot instance owner", not "provider mapped user". Target part: `/admin/bots` UI copy and DTO naming.

4. Severity: Medium. The selected-user bot detail path is consistent with this split: Tortila is user-scoped by bot instance, while Legacy requires an active provider mapping. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:620` to `apps/web/src/features/admin/user-bot-detail-loader.ts:675` scopes rows by bot instance for non-Legacy products and by active provider account for Legacy; `apps/web/src/features/admin/user-bot-detail-loader.ts:718` to `apps/web/src/features/admin/user-bot-detail-loader.ts:818` selects user-owned bot instances, provider accounts, metrics, and positions; `apps/web/src/features/admin/user-bot-detail-loader.ts:888` to `apps/web/src/features/admin/user-bot-detail-loader.ts:932` sets Legacy to `provider_account_mapped` or `provider_account_pending`, while Tortila remains `user_scoped`. Recommendation: mirror this distinction on `/admin/bots`; do not back-port the Legacy provider-account requirement onto Tortila. Target part: selected-user/fleet semantic consistency.

5. Severity: Medium. The generic `latestSnapshot` card is not a Tortila identity source because it still selects the latest row across all `bot_metric_snapshots`. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:194` to `apps/web/src/features/admin/bot-health-loader.ts:202` orders all metric snapshots without joining/filtering by product. Recommendation: use `tortilaFleetSnapshots` for Tortila identity; if this generic card remains, label it as global or filter it by product in a later cleanup. Target part: `/admin/bots` global metric card.

6. Severity: Medium. Tortila owner identity depends on correct WTC worker owner configuration. Evidence: `apps/worker/src/index.ts:155` to `apps/worker/src/index.ts:183` accepts `SYSTEM_BOT_INSTANCE_ID` directly or creates/finds a `tortila_bot` instance from `SYSTEM_BOT_OWNER_ID`; `tests/integration/worker-tortila-snapshot.test.ts:92` to `tests/integration/worker-tortila-snapshot.test.ts:103` proves mock worker snapshots land on the configured owner instance. Recommendation: future acceptance should verify, without live bot/provider mutation, that the configured system owner/instance matches the intended WTC owner before using this as operator evidence. Target part: worker deployment/runbook validation.

7. Severity: Low. Current tests cover the intended semantics at PGlite/static level, not live continuity. Evidence: `tests/integration/admin-bot-health-loader.test.ts:200` to `tests/integration/admin-bot-health-loader.test.ts:260` asserts Tortila owner projection, latest-per-instance selection, no raw journal markers/secrets, and no `providerAccountId`; `tests/integration/bot-read-safety-static.test.ts:101` to `tests/integration/bot-read-safety-static.test.ts:117` statically checks the loader/page shape; `tests/integration/worker-tortila-snapshot.test.ts:57` to `tests/integration/worker-tortila-snapshot.test.ts:150` covers Tortila snapshot writes and health-only behavior. Recommendation: before implementation acceptance, run focused PGlite/static/typecheck gates in an implementer lane; do not run live provider or worker acceptance in this audit lane. Target part: tests-runner follow-up.

## Decisions
1. Current safest semantics: show Tortila fleet identity from `bot_metric_snapshots -> bot_instances -> users`.
2. Treat the displayed Tortila identity as a WTC bot-instance owner, not a provider-account mapping.
3. Do not derive Tortila identity from `bot_provider_accounts` now. That path is deferred until Tortila has a stable audited provider id and worker/repository contract for it.
4. The smallest aligned implementation is the current narrow shape: `tortilaFleetSnapshots(db)` in `apps/web/src/features/admin/bot-health-loader.ts`, `TortilaFleetSnapshotAdminView` in `apps/web/src/features/admin/types.ts`, the `/admin/bots` "Tortila user-scoped snapshots" table, and PGlite/static tests. No schema migration, provider DB read, worker tick, env read, or live bot action is needed.
5. Legacy remains separate: Legacy fleet identity uses active `bot_provider_accounts.productCode='legacy_bot'`, `provider='legacy-db'`, `status='active'`, joined to `users`, with raw `pub_id` kept server-side only for matching.

## Risks
1. If `SYSTEM_BOT_INSTANCE_ID` is pointed at the wrong WTC bot instance, `/admin/bots` will honestly show that instance owner, even if the deployment intended another owner.
2. Snapshot data can be stale. The owner label is a WTC ownership fact for the persisted snapshot, not a fresh live bot continuity proof.
3. The global latest metric card can still show a non-Tortila row; it must not be interpreted as Tortila identity.
4. Admin-only user display intentionally exposes user name/email. Keep the projection minimal and never include password hashes, exchange secrets, provider DB URLs, raw snapshot JSON, tokens, or sealed payloads.
5. A future Tortila provider-account model could conflict with current owner wording if it is added without a migration/contract decision and explicit UI copy.

## Verification/tests
RUN:
1. Required governance/context reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`.
2. Static file inspection with `rg` and line-numbered `Get-Content` for schema, repositories, admin loaders/types/pages, worker writers, and tests.
3. `git status --short --branch` read-only check observed a dirty/concurrent workspace on `codex/bot-analytics-settings-canary-20260603`; this audit did not revert or overwrite others' changes.
4. Confirmed the requested handoff path did not already exist before writing.

NOT RUN:
1. `npm test`, focused Vitest, typecheck, lint, build, Playwright, and `git diff --check` - not run in this read-only auditor lane.
2. Worker tick/restart, `tick-once`, preview/server start, provider DB live read/write, exchange ping/test, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - not run and intentionally forbidden.
3. Live Tortila/Legacy continuity proof - not run; current evidence is DB/schema/code/test inspection only.

## Next actions
1. If an implementer continues this slice, keep the current `bot_instance_owner` semantics and run focused acceptance: `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/worker-tortila-snapshot.test.ts`, then `npm run typecheck -w @wtc/web`, lint, secret scan, and build as phase scope allows.
2. Consider a tiny cleanup to make the global "Latest bot metric snapshot" card explicitly global or product-filtered so it cannot be confused with Tortila identity.
3. Add a non-live deployment/runbook check that verifies `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` points to the intended WTC Tortila owner before using canary evidence operationally.
4. Defer Tortila `bot_provider_accounts` until there is a stable provider id, a contract update, and tests proving no false provider ownership or secret leakage.
