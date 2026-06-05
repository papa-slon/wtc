# bot-readiness-server-dto-db-backend-auditor handoff
## Scope
Phase 3.84 read-only DB/backend provenance audit for the planned server-only `loadBotReadinessForUser(userId, productCode)` DTO. Scope was to inspect the current repository methods and web loaders for safe sources of Tortila exchange-key metadata, Legacy provider DB mapping, WTC config source/version, runtime snapshot state, statistics availability, and warnings.

This audit did not edit product or test code, did not read or write `.env`, did not open or decrypt vault secrets, did not ping exchanges, did not start/stop/apply/retest bots, did not tick/restart workers, and did not touch SSH/tmux/systemd/provider DBs. The repository was already dirty before this handoff was written; branch observed as `codex/bot-analytics-settings-canary-20260603`.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`
5. `packages/db/src/schema.ts`
6. `packages/db/src/repositories.ts`
7. `apps/web/src/lib/backend.ts`
8. `apps/web/src/lib/db-store.ts`
9. `apps/web/src/lib/access.ts`
10. `apps/web/src/features/bots/data.tsx`
11. `apps/web/src/features/bots/config.ts`
12. `apps/web/src/features/bots/readiness.ts`
13. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
14. `apps/web/src/features/cabinet/loader.ts`
15. `apps/web/src/features/admin/user-bot-detail-loader.ts`
16. `apps/web/src/features/admin/bot-health-loader.ts`
17. `apps/web/src/features/admin/queries.ts`
18. `apps/web/src/features/admin/types.ts`
19. `apps/web/src/features/admin/health-detail.ts`
20. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
22. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
23. `apps/web/src/app/(app)/app/bots/page.tsx`
24. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
25. `apps/worker/src/jobs.ts`
26. `apps/worker/src/legacy-live.ts`

## Files changed
None - read-only audit; required handoff written at `docs/handoffs/20260603-2356-bot-readiness-server-dto-db-backend-auditor.md`.

## Findings
1. High - Tortila count-only exchange-key evidence is safe metadata but not enough for green readiness. Evidence: `packages/db/src/repositories.ts:404` selects only `exchange_accounts`, and `packages/db/src/repositories.ts:406` explicitly never joins `exchange_api_key_secrets`; the dashboard currently maps any count to `metadata_saved` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:140`; the cabinet does the same at `apps/web/src/features/cabinet/loader.ts:95`. Recommendation: `loadBotReadinessForUser` should not promote `listExchangeKeys(userId)` count to `vault_metadata_confirmed`; use it only for `metadata_saved` or "user has key metadata". Target part: Tortila exchange key metadata.

2. High - The existing account-plus-secret metadata proof exists, but the function is an audited action, not a passive loader source. Evidence: `recordExchangeKeyMetadataCheck` selects the owned account row by `exchangeAccountId` and `userId` at `packages/db/src/repositories.ts:430-439`, selects the secret row id without sealed material at `packages/db/src/repositories.ts:440-445`, returns `checkKind: 'sealed_metadata_only'` and `livePing: false` at `packages/db/src/repositories.ts:448-456`, then writes `exchange_key.test` audit metadata at `packages/db/src/repositories.ts:459-470`; the setup/settings actions call it only after CSRF, Tortila product, and entitlement checks at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:146-161`. Recommendation: add a new read-only repository helper with the same owned-account-plus-secret-id semantics but no audit write, preferably scoped to `bot_instances.exchange_account_id` when present. Target part: Tortila vault metadata confirmation.

3. High - Legacy provider DB mapping has a safe DB source, but the exact "single active mapping" logic is currently hand-rolled in web loaders. Evidence: schema stores `bot_provider_accounts` with `userId`, `botInstanceId`, `productCode`, `provider`, `providerAccountId`, and `status` at `packages/db/src/schema.ts:146-160`; uniqueness allows only one active provider per bot instance at `packages/db/src/schema.ts:166-168`; admin mapping writes through `upsertBotProviderAccountMapping` with owned-instance validation at `packages/db/src/repositories.ts:1807-1817`; the user loader queries active `legacy-db` rows for exact `userId`, `botInstanceId`, product, provider, and status and limits to 2 at `apps/web/src/features/bots/data.tsx:314-330`; it blocks runtime facts unless exactly one mapping exists at `apps/web/src/features/bots/data.tsx:332-343`. Recommendation: add a narrow repo helper such as `getActiveBotProviderMappingProof(db, { userId, productCode: 'legacy_bot', provider: 'legacy-db' })` returning `missing | confirmed | ambiguous`, count, mapping id, updatedAt, and masked provider id only. Target part: Legacy user-scoped provider DB mapping.

4. High - Runtime snapshot and statistics should come from persisted WTC Postgres snapshots, not raw runtime config or live adapter calls. Evidence: the DB loader reads `integration_health_checks` target `legacy-bot` or `tortila-journal` at `apps/web/src/features/bots/data.tsx:280-290`, requires a user-owned bot instance at `apps/web/src/features/bots/data.tsx:296-309`, scopes Legacy snapshots to the active provider mapping at `apps/web/src/features/bots/data.tsx:346-355`, and reads latest metric/position/trade snapshot rows at `apps/web/src/features/bots/data.tsx:357-390`; the Phase 3.83 dashboard still infers Legacy `providerPubIdState` from `runtimeConfig.providerAccounts` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:124-143`. Recommendation: the DTO should derive runtime state from snapshot/health row presence, freshness, and source adapter, while provider readiness should come only from the DB mapping proof in Finding 3. Target part: safe runtime snapshot and stats availability.

5. Medium - WTC config source/version is already safely resolved; reuse it rather than querying raw config ad hoc in page code. Evidence: `loadBotConfig` uses `getPublishedBotGlobalConfig` and `listBotInstancesForUser` at `apps/web/src/features/bots/config.ts:884-890`, returns `system_default` or `built_in` without an instance at `apps/web/src/features/bots/config.ts:895-906`, reads current user config and versions at `apps/web/src/features/bots/config.ts:908-914`, returns `user_override` when valid at `apps/web/src/features/bots/config.ts:915-927`, and otherwise resolves back to `system_default` or `built_in` at `apps/web/src/features/bots/config.ts:928-938`; repository writes config as WTC-only and never forwards it to live bots at `packages/db/src/repositories.ts:2053-2065`. Recommendation: `loadBotReadinessForUser` can call/factor this resolver and return only source, label, detail, version, updatedAt, and safety-count summary, not the raw config body. Target part: config source/version.

6. Medium - Warning provenance is safe but currently inconsistent by key name. Evidence: Tortila worker health detail writes `warnings` at `apps/worker/src/jobs.ts:118-129` and `apps/worker/src/jobs.ts:235-246`; Legacy worker health detail writes `warningCodes` at `apps/worker/src/legacy-live.ts:567-587`; `dbWarningsFromDetail` reads `warningCodes` at `apps/web/src/features/bots/data.tsx:187-190`; the admin health-detail projector allowlist includes `warnings` but not `warningCodes` at `apps/web/src/features/admin/health-detail.ts:3-37`. Recommendation: the DTO should normalize both `warnings` and `warningCodes` into safe warning codes/titles, and a follow-up should align the projector/loader keys so Legacy warning codes are not silently dropped on admin health views. Target part: safe statistics availability/warnings.

7. Medium - Admin user bot detail is the best model for safe projection but should not be imported directly into user readiness. Evidence: admin loader strips exchange keys to metadata via `mapExchangeKeySummary` at `apps/web/src/features/admin/user-bot-detail-loader.ts:90-103`, masks provider ids at `apps/web/src/features/admin/user-bot-detail-loader.ts:545-562`, filters Legacy rows by active provider mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:615-632`, computes stats source with `providerScoped` at `apps/web/src/features/admin/user-bot-detail-loader.ts:644-675`, and maps per-user bot summaries without raw secrets at `apps/web/src/features/admin/user-bot-detail-loader.ts:899-933`; the admin page copy states the view is read-only metadata and user-scoped snapshots at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:68-72`. Recommendation: copy the provenance rules into shared repository helpers or a small server DTO module, not the admin DTO shape. Target part: admin/user loader boundary.

8. Medium - Current readiness call sites are fragmented and should be replaced by the server DTO output. Evidence: readiness accepts explicit provenance states including `vault_metadata_confirmed` and `db_mapping_confirmed` at `apps/web/src/features/bots/readiness.ts:30-45`, maps Tortila metadata confirmation separately from count-only metadata at `apps/web/src/features/bots/readiness.ts:97-109`, maps Legacy DB mapping confirmation separately from runtime snapshot at `apps/web/src/features/bots/readiness.ts:127-136`, and fails closed to an access-only row at `apps/web/src/features/bots/readiness.ts:178-190`; dashboard, settings, setup review, and cabinet currently compose those inputs independently at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112-157`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:177-220`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:203-240`, and `apps/web/src/features/cabinet/loader.ts:80-103`. Recommendation: implement one server-only loader returning the builder input or final readiness items, then update all four call sites to consume the same DTO. Target part: web loader consolidation.

## Decisions
1. No live/provider source should be read by `loadBotReadinessForUser`; it should use WTC Postgres and existing server-only app loaders only.
2. Tortila `vault_metadata_confirmed` requires owned `exchange_accounts` plus a corresponding `exchange_api_key_secrets` metadata row; count-only `listExchangeKeys` stays `metadata_saved`.
3. Legacy `db_mapping_confirmed` requires exactly one active `bot_provider_accounts` row for user, bot instance, product `legacy_bot`, and provider `legacy-db`; runtime `liveConfig.providerAccounts` is not a readiness proof.
4. Config source/version should reuse the existing WTC-side resolution order: valid user override, published system default, then built-in fallback.
5. Runtime and statistics readiness should be derived from persisted health/snapshot rows: latest health readState, latest metric/position/trade timestamp, stale threshold, sourceAdapter, metricsAvailable, and issue kind.
6. The DTO should be server-only and entitlement-gated before user-specific data fetches; keep the readiness builder's internal fail-closed branch as a second guard.

## Risks
1. The worktree is heavily dirty and many relevant files are untracked or modified; this audit reflects the current local tree, not a committed baseline.
2. Passive exchange-key proof is not yet available as a repository helper; reusing `recordExchangeKeyMetadataCheck` for page render would create audit noise and mutate state.
3. Warning code normalization has a small drift risk because Tortila and Legacy worker details use different keys.
4. Existing page loaders fetch broader runtime/config data than readiness needs; implementation should avoid expanding the new DTO into another broad data surface.
5. No tests were run in this audit, by design; implementation should add focused unit/static coverage before claiming the DTO is wired.

## Verification/tests
RUN:
1. Read mandatory session/process docs and Phase 3.83 handoff: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`.
2. Read inspected DB schema/repository, web backend/data/config/readiness/cabinet/admin, and worker provenance files with line-numbered output only.
3. Searched current repo with `rg` for exchange-key, provider-mapping, runtime snapshot, stats, warning, and admin loader call sites.
4. Checked git root and branch; observed branch `codex/bot-analytics-settings-canary-20260603`.
5. Checked target handoff path did not exist before writing.
6. Wrote exactly this required handoff file.

NOT RUN:
1. `npm test`, focused tests, typecheck, lint, build, governance check - not run because this was a read-only provenance audit with one required handoff output.
2. `db:migrate`, `db:seed`, migration generation - not run; no schema/product code changes were made.
3. Live exchange ping/test - not run by policy.
4. Live bot start/stop/apply-config/retest - not run by policy.
5. Worker tick/restart - not run by policy.
6. SSH/tmux/systemd/provider DB read/write - not run by policy.
7. `.env` read/write or vault open/decrypt - not run by policy.
8. Browser/Playwright - not run; no UI behavior was changed.
9. Git stage/commit/push/PR - not requested.

## Next actions
1. Add DB repository helpers for passive exchange key metadata proof and exact active Legacy provider mapping proof; keep outputs metadata-only and secret-free.
2. Implement `loadBotReadinessForUser(userId, productCode)` in a server-only web data module using `getServerDb()`, entitlement gating, the config resolver, and narrow persisted snapshot/health summaries.
3. Replace dashboard, settings, setup review, and cabinet readiness inputs with the DTO so all surfaces share the same provenance rules.
4. Normalize warning keys from health detail (`warnings` and `warningCodes`) before rendering readiness/statistics warnings.
5. Add focused tests that prove no live adapter call, no secret/vault read, fail-closed entitlement behavior, Tortila count-only versus vault metadata states, and Legacy missing/ambiguous/confirmed mapping states.
