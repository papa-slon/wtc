# admin-fleet-user-mapping-platform-auditor handoff
## Scope
Phase 3.79 read-only platform/data audit for the WTC admin bot fleet page. Scope was limited to whether `/admin/bots` can show mapped WTC user identity and link to `/admin/users/[userId]/bots` for Legacy/Tortila provider-account rows, especially Legacy `pub_id`, without live/provider/worker/env mutations.

This audit did not edit product code, did not run live bot/provider paths, did not read or mutate `.env`, and did not start/stop/apply any bot configuration.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. `/admin/bots` cannot currently show mapped WTC user identity or link to `/admin/users/[userId]/bots` for Legacy `pub_id` rows. Evidence: `apps/web/src/features/admin/queries.ts:436`-`469` builds `legacyProviderAccounts` only from the latest Legacy snapshot `rawJson.liveConfig.providerAccounts`; `apps/web/src/features/admin/types.ts:325`-`336` defines `LegacyProviderAccountAdminView` with `pubId` and runtime fields only; `apps/web/src/app/admin/bots/page.tsx:232`-`245` renders those fields without any user/mapping column or link. Recommendation: extend the fleet loader with a read-only WTC mapping projection and add a `mappedUser` or `userMapping` DTO with `userId`, display label/email, mapping id/status, masked account id, and `detailHref: /admin/users/${userId}/bots`. Target part: `apps/web/src/features/admin/queries.ts`, `apps/web/src/features/admin/types.ts`, and `apps/web/src/app/admin/bots/page.tsx`.

2. Severity: High. The DB already has the required WTC-owned mapping source, but the fleet loader does not read it. Evidence: `packages/db/src/schema.ts:146`-`170` defines `bot_provider_accounts` with `userId`, `botInstanceId`, `productCode`, `provider`, `providerAccountId`, active-status uniqueness, and active provider-account uniqueness; `packages/db/src/repositories.ts:1678`-`1705` exposes provider-account list helpers but no user-joined fleet projection; `apps/web/src/features/admin/user-bot-detail-loader.ts:758`-`772` proves selected-user pages already select `botProviderAccounts` by user and product. Recommendation: either add a repo helper such as `listActiveBotProviderAccountMappingsForFleet(db, { productCode, provider, providerAccountIds })` or perform a local admin-only Drizzle join in `loadAdminBotHealth` from `botProviderAccounts` to `users` and optionally `botInstances`, selecting only safe fields. Target part: DB/admin loader data boundary.

3. Severity: Medium. Raw Legacy `pub_id` is still rendered on `/admin/bots`, including short identifiers that Phase 3.78 explicitly masked on the selected-user page. Evidence: `apps/web/src/features/admin/queries.ts:458`-`484` copies `pubId` and `providerPubId` from snapshot JSON into DTOs; `apps/web/src/app/admin/bots/page.tsx:229`-`234`, `258`-`264`, and `280`-`284` render raw `pub_id` cells; `apps/web/src/features/admin/user-bot-detail-loader.ts:545`-`559` maps selected-user provider accounts through `maskProviderAccountId`; `tests/integration/admin-user-bot-detail-loader.test.ts:733`-`744` asserts a short provider id is rendered as an `id#<hash>` fingerprint. Recommendation: keep raw `pubId` only as an internal join key inside the loader, and expose `pubIdMasked` or `pubIdFingerprint` to the page for all fleet rows. Target part: Legacy fleet DTO and UI redaction policy.

4. Severity: Medium. Tortila user mapping is not represented on the current `/admin/bots` DTO. Evidence: `apps/web/src/features/admin/queries.ts:425`-`434` selects the latest generic `botMetricSnapshots` row without joining `botInstances` or `users`; `apps/web/src/features/admin/types.ts:309`-`314` exposes latest snapshot fields without owner identity; `packages/db/src/schema.ts:507`-`514` shows `bot_metric_snapshots.botInstanceId` can join to `bot_instances`, whose `userId` is defined at `packages/db/src/schema.ts:138`-`143`. Recommendation: decide whether Tortila fleet identity should mean the WTC bot-instance owner (`bot_metric_snapshots -> bot_instances -> users`) or a future provider-account mapping (`bot_provider_accounts` with `provider='tortila-journal'`). Do not infer Tortila provider ownership from aggregate adapter health alone. Target part: product/platform mapping semantics for Tortila.

5. Severity: Medium. Existing tests cover selected-user provider-account masking/isolation and the existence of the fleet `pub_id` inspector, but not fleet mapped-user identity or links. Evidence: `tests/integration/bot-read-safety-static.test.ts:110`-`117` only checks that admin bot health exposes `legacyProviderAccounts`, `legacyActiveSlots`, and `legacyActiveOrders`; `tests/integration/admin-user-bot-detail-static.test.ts:129`-`135` checks the user directory link to `/admin/users/${u.id}/bots`; `tests/integration/admin-user-bot-detail-loader.test.ts:518`-`538` checks selected-user provider masking and cross-user non-leakage. Recommendation: add a focused PGlite loader test for mapped and unmapped Legacy `pub_id` rows, assert raw short ids are absent from the DTO, and add a static/page test that the fleet table links mapped rows to `/admin/users/${userId}/bots`. Target part: `tests/integration/*admin*bot*` and fleet loader coverage.

## Decisions
1. Current verdict: `/admin/bots` cannot currently show mapped user identity or link to the selected-user bot detail page for provider accounts. It needs DTO/query/page changes.
2. The safe Legacy implementation path is a read-only WTC DB join, not a provider DB read: parse latest snapshot rows, normalize `pubId` to an internal key, query active `bot_provider_accounts` where `productCode='legacy_bot'`, `provider='legacy-db'`, and `providerAccountId` is in the snapshot key set, then join to `users` for display identity and link construction.
3. The page should display mapped rows as admin-readable identity plus link to `/admin/users/[userId]/bots`; unmapped rows should remain fleet diagnostics with an explicit unmapped status.
4. Raw `pub_id` should not be page-facing in the next implementation. The fleet page should align with selected-user masking, including hashed fingerprints for short ids.
5. Tortila mapping needs a product decision before implementation: instance-owner projection is available today through `botMetricSnapshots -> botInstances -> users`; provider-account mapping is only correct if Tortila has a stable provider account id to persist in `bot_provider_accounts`.
6. This was treated as a narrow single-auditor read-only phase. No N-agent audit claim is made.

## Risks
1. Raw `pub_id` is an operational identifier. Even though `/admin/bots` is admin-gated, rendering it raw increases screenshot/log/support-copy exposure risk and diverges from selected-user masking.
2. Adding email/display name to the fleet table broadens PII visibility inside the admin page. Keep it admin-only, select minimal fields, and avoid passwordHash or secret joins.
3. Matching snapshot `pubId` to `bot_provider_accounts.providerAccountId` can misclassify rows if whitespace/casing differs. Normalize with `trim()` for the internal key, but keep provider ids case-sensitive unless Legacy source evidence says otherwise.
4. Only active mappings should drive user identity. Disabled or `needs_review` mappings may still be useful as warnings, but should not make runtime rows look user-owned.
5. A latest-snapshot-only fleet join can show stale ownership if the worker snapshot lags behind mapping changes. The page should expose mapping status and snapshot time together so operators can tell runtime freshness from WTC mapping freshness.
6. Tortila aggregate health and latest metric snapshots may not represent a provider account. A rushed shared DTO could imply provider identity where only a WTC bot instance owner is known.

## Verification/tests
RUN:
1. Read the required protocol and seed files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`.
2. Read current status docs: `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md`.
3. Static code inspection of the scoped admin loader/page/types, DB schema/repositories, selected-user drilldown loader/page, and focused admin bot tests using `Get-Content` and `rg`.

NOT RUN:
1. No product-code edits, migrations, test rewrites, or formatting changes. Read-only audit only.
2. No Vitest, Playwright, build, typecheck, lint, governance, or secret scan. Skipped because this phase requested a read-only platform/data audit and no code was changed.
3. No live/provider/worker/env operations: no live Legacy/Tortila reads, no worker tick/restart, no exchange calls, no `.env` reads/writes, no SSH/tmux/systemd, and no start/stop/apply/retest paths.
4. No background agents were spawned for this single-auditor handoff; none are running or require cleanup from this phase.

## Next actions
1. Implement a read-only mapping projection in `loadAdminBotHealth`: collect Legacy snapshot `pubId` keys, query active WTC `bot_provider_accounts` for `legacy_bot`/`legacy-db`, join to `users`, and build a map keyed by normalized provider account id.
2. Extend `LegacyProviderAccountAdminView`, `LegacyActiveSlotAdminView`, and `LegacyActiveOrderAdminView` with masked provider id and optional mapped-user summary/link fields, while keeping raw ids internal to the loader.
3. Update `/admin/bots` to render a mapped-user/link column for provider accounts and, where useful, active slots/orders; show an explicit unmapped state for runtime rows without active WTC mapping.
4. Add focused tests: PGlite loader coverage for mapped/unmapped Legacy rows and raw-id non-leakage, plus static/page coverage that mapped fleet rows link to `/admin/users/[userId]/bots`.
5. Decide the Tortila semantics before coding: show WTC bot-instance owner from DB snapshots now, or defer provider-account identity until Tortila has an audited stable provider id stored in `bot_provider_accounts`.
