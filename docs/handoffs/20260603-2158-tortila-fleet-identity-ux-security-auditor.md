# tortila-fleet-identity-ux-security-auditor handoff
## Scope
Phase 3.80 read-only UX/security audit for Tortila fleet identity on `/admin/bots`.

The audit reviewed how the admin bot fleet page should present Tortila mapped owner/user identity, snapshot freshness, and links to `/admin/users/[userId]/bots` while preserving admin-only RBAC, read-only behavior, no live controls, no secret exposure, no raw provider identifiers, and no false ownership. This phase was treated as exactly one named auditor lane, not an N-agent aggregate phase.

No product-code edits, live bot/provider/env operations, SSH, tmux, systemd, worker tick/restart, provider DB reads/writes, exchange pings, `.env` reads/writes, or database mutations were performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`
8. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-platform-auditor.md`
9. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-ux-security-auditor.md`
10. `apps/web/src/app/admin/bots/page.tsx`
11. `apps/web/src/features/admin/bot-health-loader.ts`
12. `apps/web/src/features/admin/types.ts`
13. `apps/web/src/features/admin/queries.ts`
14. `apps/web/src/features/admin/user-bot-detail-loader.ts`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/app/admin/users/page.tsx`
17. `apps/web/src/app/admin/layout.tsx`
18. `apps/web/src/lib/nav.ts`
19. `apps/web/src/features/admin/health-detail.ts`
20. `apps/web/src/features/bots/data.tsx`
21. `apps/worker/src/index.ts`
22. `apps/worker/src/jobs.ts`
23. `packages/db/src/schema.ts`
24. `tests/integration/admin-bot-health-loader.test.ts`
25. `tests/integration/admin-user-bot-detail-loader.test.ts`
26. `tests/integration/admin-user-bot-detail-static.test.ts`
27. `tests/integration/bot-read-safety-static.test.ts`
28. `tests/integration/admin-responsive.test.ts`
29. `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. `/admin/bots` currently has no safe Tortila user/owner identity DTO, and its "Latest bot metric snapshot" is not even product-filtered to Tortila. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:153` to `apps/web/src/features/admin/bot-health-loader.ts:161` selects the latest row from `bot_metric_snapshots` without joining `bot_instances` or filtering `productCode='tortila_bot'`; `apps/web/src/features/admin/types.ts:309` to `apps/web/src/features/admin/types.ts:314` exposes only `snapshotAt`, `walletEquityUsd`, and `sourceAdapter`; `apps/web/src/app/admin/bots/page.tsx:187` to `apps/web/src/app/admin/bots/page.tsx:203` renders those fields without product, bot instance, or user identity; the schema supports the required safe join through `bot_metric_snapshots.botInstanceId` at `packages/db/src/schema.ts:508` to `packages/db/src/schema.ts:527` and `bot_instances.userId/productCode` at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:143`. Recommendation: replace the generic `latestSnapshot` with a Tortila-specific snapshot projection joined through `bot_instances -> users`, and do not label any generic latest metric row as Tortila owner evidence. Target part: `loadAdminBotHealthFromDb`, `AdminBotHealthResult`, and the `/admin/bots` Tortila card.

2. Severity: High. Tortila selected-user detail already has a safe user-scoped semantics, but `/admin/bots` cannot link admins from Tortila fleet evidence to that user drilldown. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:296` to `apps/web/src/features/admin/user-bot-detail-loader.ts:302` scopes user detail reads by `bot_instances.userId` and product; `apps/web/src/features/admin/user-bot-detail-loader.ts:899` to `apps/web/src/features/admin/user-bot-detail-loader.ts:933` returns Tortila as `providerScope: 'user_scoped'`; `/admin/users` already links every user to `/admin/users/${u.id}/bots` at `apps/web/src/app/admin/users/page.tsx:115` to `apps/web/src/app/admin/users/page.tsx:119`; `/admin/bots` only has mapped-user links for Legacy through `mappedUserSummary` at `apps/web/src/app/admin/bots/page.tsx:31` to `apps/web/src/app/admin/bots/page.tsx:45`. Recommendation: show `WTC mapped owner` or `WTC bot-instance owner` for Tortila rows when the joined `users` row exists, with a navigation-only `Open user bot details` action to `/admin/users/[userId]/bots`. Target part: Tortila fleet identity section on `/admin/bots`.

3. Severity: Medium. Tortila fleet identity must be labeled as WTC owner/user mapping, not provider-side ownership. Evidence: the worker resolves a Tortila snapshot target from `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` at `apps/worker/src/index.ts:154` to `apps/worker/src/index.ts:183`; `snapshotTortilaJournal` documents that the `botInstanceId` is the system-owned Tortila bot instance at `apps/worker/src/jobs.ts:93` to `apps/worker/src/jobs.ts:102`; `bot_provider_accounts` is only a future-capable primitive for providers such as `tortila-journal` at `packages/db/src/schema.ts:146` to `packages/db/src/schema.ts:154`, but current Tortila snapshots do not carry a provider-account id in the admin fleet DTO. Recommendation: use labels such as `WTC bot-instance owner`, `System/fleet Tortila snapshot`, and `Provider owner: not asserted`; avoid `Owner` alone or `provider account mapped` for Tortila until an audited stable Tortila provider id exists. Target part: copy, status pills, and tests for `/admin/bots`.

4. Severity: Medium. Snapshot freshness is partially visible but not sufficient for Tortila identity decisions. Evidence: the loader records `tortilaLastOkAt`, `tortilaJournalStatus`, and read-state detail from `integration_health_checks` at `apps/web/src/features/admin/bot-health-loader.ts:115` to `apps/web/src/features/admin/bot-health-loader.ts:151`, and it records snapshot time at `apps/web/src/features/admin/bot-health-loader.ts:153` to `apps/web/src/features/admin/bot-health-loader.ts:161`; the page shows a journal read-state pill at `apps/web/src/app/admin/bots/page.tsx:17` to `apps/web/src/app/admin/bots/page.tsx:29`, journal health metrics at `apps/web/src/app/admin/bots/page.tsx:151` to `apps/web/src/app/admin/bots/page.tsx:184`, and snapshot time at `apps/web/src/app/admin/bots/page.tsx:187` to `apps/web/src/app/admin/bots/page.tsx:221`, but it does not combine age, owner, and source into explicit `fresh/stale/unknown` states. Recommendation: add Tortila states `No snapshot`, `Snapshot fresh`, `Snapshot stale`, `Journal setup needed`, `Journal last check error`, and `Mock snapshot`; show snapshot age beside owner identity and suppress user-detail links when the identity join is missing or the row is not Tortila. Target part: Tortila fleet card and PGlite/static tests.

5. Severity: Medium. The current security posture is compatible with adding Tortila owner identity, but only if the projection stays minimal and admin-only. Evidence: `/admin/bots` asserts `requireUser()` and `assertAdmin(actor.roles)` at `apps/web/src/app/admin/bots/page.tsx:63` to `apps/web/src/app/admin/bots/page.tsx:65`; the admin layout also redirects non-admin users at `apps/web/src/app/admin/layout.tsx:12` to `apps/web/src/app/admin/layout.tsx:16`; user DTOs strip `passwordHash` at `apps/web/src/features/admin/types.ts:6` to `apps/web/src/features/admin/types.ts:29`; health detail projection allowlists fields and redacts token/secret/key-shaped values at `apps/web/src/features/admin/health-detail.ts:3` to `apps/web/src/features/admin/health-detail.ts:73`; env URLs are collapsed to booleans in `apps/web/src/features/admin/queries.ts:353` to `apps/web/src/features/admin/queries.ts:367`. Recommendation: select only `users.id`, `email`, `displayName`, `botInstances.id`, product code, `snapshotAt`, `sourceAdapter`, and safe metric scalars; do not join exchange secrets, raw metric JSON, raw provider identifiers, sealed keys, DB URLs, or health stack traces. Target part: admin loader DTO and tests.

6. Severity: Medium. Existing guards prove Legacy mapping and selected-user isolation, but they do not guard Tortila fleet identity. Evidence: `tests/integration/admin-bot-health-loader.test.ts:58` to `tests/integration/admin-bot-health-loader.test.ts:198` covers Legacy mapped/unmapped pub_id rows and non-leakage only; `tests/integration/admin-user-bot-detail-loader.test.ts:424` to `tests/integration/admin-user-bot-detail-loader.test.ts:473` proves Tortila selected-user stats are user-scoped; `tests/integration/bot-read-safety-static.test.ts:101` to `tests/integration/bot-read-safety-static.test.ts:127` checks safe admin bot health and Legacy inspector but has no Tortila owner/link assertion; mobile proof is demo-mode and explicitly does not exercise real DB rows at `tests/e2e/admin-mobile-pg8.spec.ts:11` to `tests/e2e/admin-mobile-pg8.spec.ts:15`. Recommendation: add a focused PGlite admin bot health loader test for Tortila owner projection, product filtering, stale/fresh labels, link href, and absence of raw/sealed/secret/provider fields; add static/page assertions for `WTC bot-instance owner` and `/admin/users/${tortilaOwner.userId}/bots`. Target part: `tests/integration/admin-bot-health-loader.test.ts`, `tests/integration/bot-read-safety-static.test.ts`, and optional DB-backed admin Playwright later.

7. Severity: Info. Current read-only/no-live-control posture should be preserved. Evidence: `/admin/bots` states live control is disabled and exposes no start/stop/apply buttons at `apps/web/src/app/admin/bots/page.tsx:72` to `apps/web/src/app/admin/bots/page.tsx:76` and `apps/web/src/app/admin/bots/page.tsx:110` to `apps/web/src/app/admin/bots/page.tsx:138`; static tests reject submit/live controls on the fleet inspector at `tests/integration/bot-read-safety-static.test.ts:112` to `tests/integration/bot-read-safety-static.test.ts:127`; selected-user static tests reject mapping/edit/live controls at `tests/integration/admin-user-bot-detail-static.test.ts:56` to `tests/integration/admin-user-bot-detail-static.test.ts:98`. Recommendation: Tortila fleet identity actions should remain navigation and inspection only: `Open user bot details`, `Open fleet health`, and optional read-only filters. Target part: `/admin/bots` UX.

## Decisions
1. Tortila fleet identity should mean `WTC bot-instance owner` derived from `bot_metric_snapshots.botInstanceId -> bot_instances.userId -> users`, not provider-side owner identity.
2. Do not infer Tortila provider ownership from journal health, source adapter, base URL presence, or raw snapshot JSON.
3. The primary label should be `WTC bot-instance owner`; secondary copy should say `Provider owner not asserted` or `System/fleet Tortila snapshot` where useful.
4. Safe mapped action: `Open user bot details` linking to `/admin/users/[userId]/bots`, rendered only when the joined user row is present.
5. Safe states: `No snapshot`, `Snapshot fresh`, `Snapshot stale`, `Journal setup needed`, `Journal last check error`, `Mock snapshot`, and `Read-only live snapshot`.
6. Staleness should be computed from persisted DB timestamps, not live probes during page render. Use the existing worker-health stale window or a named Tortila snapshot stale constant so the label is testable.
7. The Tortila section should never render raw provider identifiers, exchange secrets, sealed secret payloads, DB URLs, bearer tokens, raw metric JSON, or stack traces.

## Risks
1. Current generic latest-snapshot selection can mislead admins if the newest row is Legacy or another future product.
2. Copy that says only `Owner` can falsely imply provider-side account ownership; use `WTC bot-instance owner`.
3. A system owner id can be an operational account rather than the economic end user. The UI should make this clear if the mapped user is a system/admin account.
4. Snapshot freshness can drift independently from user mapping changes. Show snapshot time and mapping identity together.
5. User email/display name are PII. They are acceptable on admin-only pages already showing the user directory, but keep the projection minimal and server-rendered behind admin RBAC.
6. Tests are currently demo/mobile plus Legacy-focused DB tests; Tortila fleet owner proof would be unguarded until a new focused PGlite test lands.

## Verification/tests
RUN:
1. Required protocol and status docs were read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`.
2. Read-only source inspection of `/admin/bots`, admin types/loaders, selected-user detail, user directory/nav/layout, health projection, bot DB snapshot loaders, worker snapshot code, DB schema, and focused static/DB/e2e guard tests.
3. `git status --short --branch` was inspected before this handoff; the worktree was already dirty with many modified/untracked files in the admin bot/user areas.

NOT RUN:
1. Vitest, Playwright, typecheck, lint, build, governance, secret scan, visual evidence, and gate runners were not run because this was a read-only audit handoff with no product-code edits.
2. No live Legacy/Tortila continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config, or live controls were run.
3. No background agents were launched for this single named auditor handoff; no N-agent audit claim is made and there were no background agents to close from this phase.

## Next actions
1. Implement a Tortila-specific admin fleet DTO: latest Tortila metric snapshot joined to `bot_instances` and `users`, with product filtering and safe owner fields.
2. Update `/admin/bots` to render a Tortila identity/freshness card with `WTC bot-instance owner`, `Open user bot details`, snapshot age/state, source adapter, wallet equity, and explicit `Provider owner not asserted` copy.
3. Keep Legacy `mappedUser` behavior separate from Tortila `botInstanceOwner` behavior so provider-account mapping semantics do not bleed across products.
4. Add focused PGlite coverage for Tortila owner projection, stale/fresh states, wrong-product exclusion, user-detail href, and non-leakage of raw/sealed/secret/provider fields.
5. Add static/page assertions that Tortila fleet identity remains admin-only, read-only, navigation-only, and free of start/stop/apply/test-connection/provider edit controls.
