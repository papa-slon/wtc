# bot-readiness-server-dto-platform-security-auditor handoff
## Scope
Phase 3.84 platform/security read-only audit for the next bot readiness slice: a server-only readiness DTO that can feed dashboard, settings, setup review, and cabinet without leaking raw config/runtime/secrets or weakening entitlement fail-closed behavior.

This audit did not edit product or test code. It did not read or write `.env`, did not open/decrypt vault secrets, did not ping exchanges, did not start/stop/apply/retest bots, did not tick/restart workers, and did not touch SSH, tmux, systemd, provider DBs, or live bot services.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`
5. `docs/handoffs/20260603-2312-bot-readiness-dto-platform-security-auditor.md`
6. `apps/web/src/features/bots/readiness.ts`
7. `apps/web/src/features/bots/BotReadinessMap.tsx`
8. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
12. `apps/web/src/features/cabinet/loader.ts`
13. `packages/cabinet/src/derive.ts`
14. `apps/web/src/features/bots/data.tsx`
15. `apps/web/src/features/bots/config.ts`
16. `apps/web/src/lib/access.ts`
17. `apps/web/src/lib/backend.ts`
18. `apps/web/src/lib/db-store.ts`
19. `packages/db/src/repositories.ts`
20. `packages/db/src/schema.ts`
21. `apps/web/src/features/admin/user-bot-detail-loader.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/bot-readiness-builder.test.ts`
24. `tests/integration/cabinet-pg9.test.ts`

## Files changed
None - read-only audit. Required handoff only: `docs/handoffs/20260603-2356-bot-readiness-server-dto-platform-security-auditor.md`

## Findings
1. High - The server-only DTO boundary does not exist yet, so dashboard/settings/setup/cabinet still build readiness locally from broad page inputs. Evidence: dashboard loads read model/config/keys at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112-115`, derives `runtimeConfig` from `config.raw` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:122-130`, and passes count/snapshot provenance into the builder at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:134-157`; settings repeats this through `legacyRead?.config.data?.raw` and builder inputs at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:177-185` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208-222`; setup repeats it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:194-201` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:218-240`; cabinet builds compact readiness rows from `listExchangeKeys`/`loadBotConfig` at `apps/web/src/features/cabinet/loader.ts:84-103`. Recommendation: add a server-only loader, for example `apps/web/src/features/bots/readiness-server.ts`, that is the only module allowed to assemble readiness provenance. Pages and cabinet should consume its DTO output rather than constructing `exchangeKeyState`, `providerPubIdState`, or count fields directly. Target part: readiness DTO boundary and all four callsites.

2. High - Raw runtime/config provenance is still in the current path and must be explicitly forbidden from the future DTO input contract. Evidence: the DB read model extracts `rawMetric.liveConfig` and returns it as `config.raw` at `apps/web/src/features/bots/data.tsx:490-506`; dashboard uses `runtimeConfig?.providerAccounts` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:63-72` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:124-130`; settings maps provider account rows from a generic runtime config object at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:65-80` and derives `legacyAccounts` from `legacyLiveConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:182-199`; setup counts runtime provider accounts at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:51-57` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:199-216`. Recommendation: the server DTO must not accept `BotConfigView`, `config.raw`, `rawJson`, `liveConfig`, provider snapshot objects, or runtime `providerAccounts`; it should accept or compute only narrow scalars/enums after sanitization. Target part: DTO type and future static tests.

3. High - Tortila exchange-key readiness is now displayed as attention, but all current readiness callsites still use count-only key metadata as their source. Evidence: `listExchangeKeys` selects only `exchange_accounts` and never joins secret material at `packages/db/src/repositories.ts:404-407`; the safer metadata check proves account ownership plus an `exchange_api_key_secrets` row by selecting only the secret row id and returns `livePing: false` at `packages/db/src/repositories.ts:424-456`; dashboard passes `exchangeKeys.length` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:140-141`; settings passes `exchangeKeys.length` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:214-215`; setup passes `keys.length` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:224-225`; cabinet passes `keys.length` at `apps/web/src/features/cabinet/loader.ts:95-96`. Recommendation: reserve `vault_metadata_confirmed` for a dedicated metadata-only repository summary that proves an owned exchange account row and encrypted secret metadata row without selecting `sealed`, plaintext key fields, or running a live ping. Count-only evidence must remain `metadata_saved`/attention. Target part: Tortila readiness provenance.

4. High - Legacy green readiness should come from the DB provider mapping, not from runtime provider snapshots. Evidence: the schema has user/bot/product/provider scoped `bot_provider_accounts` rows and active unique constraints at `packages/db/src/schema.ts:146-173`; the DB read model already requires exactly one active user-scoped Legacy provider mapping before returning runtime facts at `apps/web/src/features/bots/data.tsx:314-346`; however dashboard/settings/setup still pass `runtime_snapshot` from runtime provider-account counts at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:142-143`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:216-217`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:226-227`. Recommendation: the server DTO should query or receive an explicit Legacy mapping summary: zero, exactly_one_active, or ambiguous. Only exactly one active row for current user, bot instance, product, and provider may map to `db_mapping_confirmed`; runtime snapshot counts stay diagnostic/attention. Target part: Legacy provider pub_id readiness.

5. Medium - Entitlement fail-closed behavior is currently layered correctly, but the future DTO must preserve query ordering so no per-user signals load for denied users. Evidence: dashboard returns before loading read/config/key data when access is denied at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:97-116`; settings returns before signal loads at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:173-180`; setup returns before signal loads at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:173-198`; cabinet gathers signals only inside the allowed branch at `apps/web/src/features/cabinet/loader.ts:172-176`; the pure builder independently returns only the access row for denied access at `apps/web/src/features/bots/readiness.ts:178-190`; `@wtc/cabinet` drops setup/readiness/activity when `input.allowed` is false at `packages/cabinet/src/derive.ts:219-225`. Recommendation: the server DTO must perform access resolution first, return access-only output when denied, and only then query config, key metadata, provider mapping, runtime, or statistics. Do not infer access from roles/client state inside DTO callers; use the existing server access decision path. Target part: server DTO execution order and tests.

6. Medium - Existing static tests cover the pure builder/map and some callsites, but they do not yet define the future server DTO guard. Evidence: current static tests forbid backend/vault/adapter/control words in the builder/map at `tests/integration/bot-read-safety-static.test.ts:79-98`, verify cabinet readiness is gated at `tests/integration/bot-read-safety-static.test.ts:101-110`, verify exchange metadata checks avoid sealed selection and live ping at `tests/integration/bot-read-safety-static.test.ts:260-281`, and builder tests confirm count-only Tortila metadata and Legacy runtime snapshots are not green at `tests/integration/bot-readiness-builder.test.ts:75-112`. Recommendation: add a future guard that checks the new server DTO and callsites together. Forbidden imports in the pure builder/map: `@/lib/backend`, `@/lib/db-store`, `@wtc/db`, value imports from `@wtc/bot-adapters`, `getBotAdapter`, `fetch`, vault helpers, worker/process/control modules. Forbidden DTO inputs/pass-through: `rawJson`, `config.raw`, `liveConfig`, runtime `providerAccounts`, `BotConfigView`, `ExchangeAccountView[]`, plaintext or sealed secret values, direct DB clients, adapter clients, exchange responses, and worker/process state. Forbidden callsite pattern: page/cabinet code manually passing `exchangeKeyState`, `providerPubIdState`, `exchangeKeyCount`, or `providerAccountCount` to `buildBotReadinessItems`. Forbidden copy: `Connection verified`, `live exchange verified`, `ping passed`, `ready to trade`, `start ready`, `apply ready`, or `provider mapped` unless backed by the safe DTO state named in the same test. Target part: future integration/static guard.

## Decisions
1. Recommended boundary: keep `apps/web/src/features/bots/readiness.ts` as pure presentation-domain logic and add `apps/web/src/features/bots/readiness-server.ts` as the only server-only readiness assembler.
2. Import direction: route/pages and `features/cabinet/loader.ts` may import the server DTO; the server DTO may import access/config/safe repository loaders and the pure readiness builder; the pure builder, `BotReadinessMap`, `ExchangeKeyReadinessPanel`, and `packages/cabinet` must not import the server DTO or backend modules.
3. Server DTO access order: resolve `botAccessForUser` or `accessFor` first; if denied, return only an access-blocked readiness DTO and perform no key/config/provider/runtime/statistics reads.
4. Safe DTO output shape should be scalar and provenance-bearing, for example `access`, `exchangeKeyProofState`, `legacyProviderMappingState`, `configSource`, `runtimeSnapshotState`, `statisticsState`, and final `items`. It should not expose raw config, raw runtime objects, key masks by default, provider account ids, or secret metadata ids.
5. Tortila green source: only an owned account row plus encrypted secret metadata row proven by a metadata-only query/check may become `vault_metadata_confirmed`; live exchange ping remains not run.
6. Legacy green source: only exactly one active DB provider mapping scoped to user, bot instance, product, and provider may become `db_mapping_confirmed`; runtime `providerAccounts` or `liveConfig` remain diagnostics.
7. Cabinet should continue to receive compact projected readiness rows only after entitlement allows access; `packages/cabinet` remains pure and fail-closed.

## Risks
1. Broad/raw provenance remains close to user-facing pages until the server-only DTO is implemented, so future edits can accidentally pass `config.raw`, `liveConfig`, or runtime provider snapshots into readiness.
2. Count-only Tortila key metadata is easy to misread as vault/connection proof unless the next loader separates `metadata_saved` from `vault_metadata_confirmed`.
3. Legacy provider snapshots can look like user-owned mappings; green readiness must come from `bot_provider_accounts`, not from runtime `providerAccounts`.
4. Duplicated readiness assembly across four callsites increases the chance that one surface skips the entitlement-first query order or diverges in copy.
5. Static tests can go stale because they currently check the pure builder/map but not a future server DTO contract or page-level manual provenance construction.

## Verification/tests
RUN:
1. Read required governance and phase context: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`.
2. Read prior platform/security readiness DTO audit handoff for continuity.
3. Inspected dashboard, settings, setup, cabinet loader, shared builder/map/panel, DB/backend loaders, entitlement access helper, DB schema/repositories, admin user-bot safe projection, and current integration/static tests.
4. `git status --short` - RUN to observe inherited dirty state before writing this handoff.
5. Targeted `rg` searches for readiness callsites, `config.raw`, `liveConfig`, provider snapshots, key metadata, secret/vault references, and existing tests.
6. Wrote exactly this required handoff file.

NOT RUN:
1. Unit/integration/e2e tests - not run because this was a read-only audit with no product/test code edits.
2. Build/typecheck/lint - not run because this was a read-only audit.
3. Live exchange ping - not run by policy.
4. Live bot start/stop/apply-config/retest - not run by policy.
5. Worker tick/restart - not run by policy.
6. SSH/tmux/systemd/provider DB live read/write - not run by policy.
7. `.env` read/write or vault open/decrypt - not run by policy.
8. Secret scan - not run because no product/test code or secret-bearing files were changed.
9. Git stage/commit/push/PR - not requested.

No background agents were spawned by this per-agent audit, and none are left running from this auditor.

## Next actions
1. Implement `apps/web/src/features/bots/readiness-server.ts` with `import 'server-only'`, access-first ordering, and safe scalar DTO output.
2. Replace direct readiness builder calls in dashboard/settings/setup/cabinet with the server DTO result.
3. Add safe repository helpers for Tortila exchange metadata proof and Legacy active provider mapping summary; neither helper should select plaintext/sealed secret values or raw runtime config.
4. Add the future static guard defined in Finding 6 to prevent forbidden imports, forbidden raw inputs, and forbidden false-green copy.
5. Keep `buildBotReadinessItems` pure and fail-closed, with count-only key metadata and runtime provider snapshots remaining attention states.
