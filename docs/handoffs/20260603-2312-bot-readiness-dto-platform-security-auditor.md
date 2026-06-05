# bot-readiness-dto-platform-security-auditor handoff
## Scope
Phase 3.83 platform/security read-only audit of the current bot readiness-map implementation after Phase 3.82. Scope focused on safe boundaries for a shared readiness DTO/builder used by dashboard, settings, setup, and cabinet, especially access fail-closed ordering, safe readiness inputs, forbidden rawJson/config.raw/vault/adapter calls, and avoiding false green states.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `packages/cabinet/src/derive.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit. Required handoff only: docs/handoffs/20260603-2312-bot-readiness-dto-platform-security-auditor.md

## Findings
1. High - Shared readiness input shape still allows unsafe provenance for green connection states. Evidence: `apps/web/src/features/bots/readiness.ts:16-43` accepts plain `exchangeKeyCount` and `providerAccountCount`; dashboard passes Legacy provider count from `config?.raw` via `runtimeConfig?.providerAccounts` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:124-140`; settings passes `legacyLiveConfig` provider count from `legacyRead?.config.data?.raw` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:182-214`; setup still derives `legacyAccountsCount` from `legacyLiveConfig` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:197-214`. Recommendation: replace raw counts with typed, provenance-bearing inputs, for example `tortilaExchangeMetadata` sourced only from exchange-account metadata/check summaries and `legacyProviderMapping` sourced only from DB provider mapping rows. The shared DTO/builder must not accept or derive from `rawJson`, `config.raw`, runtime `liveConfig`, vault values, adapters, or provider snapshots. Target part: `features/bots/readiness.ts` DTO contract and all dashboard/settings/setup/cabinet callsites.

2. High - Tortila key metadata count can currently render as ready and say vault metadata is saved without requiring an explicit account-plus-secret metadata check. Evidence: `apps/web/src/features/bots/readiness.ts:80-92` sets Tortila connection to `ready` when `exchangeKeyCount > 0` and labels it "WTC vault metadata saved"; `packages/db/src/repositories.ts:404-407` shows `listExchangeKeys` selects exchange-account metadata and never joins the secret table; `packages/db/src/repositories.ts:424-456` shows `recordExchangeKeyMetadataCheck` is the safe metadata-only path that proves both an owned account row and a sealed secret row exist while keeping `livePing: false`. Recommendation: distinguish `metadata_saved` from `vault_metadata_confirmed`; make count-only evidence `attention` or `readonly`, and reserve `ready` for a safe repository summary that proves account plus secret row existence, such as the latest `vault_present` metadata check or a dedicated non-secret boolean. Target part: Tortila connection readiness builder and copy.

3. High - Legacy readiness can become false green from runtime/config raw provider evidence instead of a user-scoped active DB mapping. Evidence: `apps/web/src/features/cabinet/loader.ts:88-92` hardcodes a Legacy setup item as done with "Legacy uses provider pub_id runtime"; `packages/cabinet/src/derive.ts:138-145` converts all done setup items to `ready`; `apps/web/src/features/bots/data.tsx:318-344` correctly requires exactly one active user-scoped Legacy provider mapping before returning runtime facts, but downstream readiness still counts raw `providerAccounts` after that point. Recommendation: use the DB mapping itself as the readiness input: exactly one active `bot_provider_accounts` row for the current user, bot instance, product, and provider should be eligible for ready; zero or multiple mappings should be `attention` or `blocked`; runtime `providerAccounts` should remain diagnostics only and never be the green source. Target part: cabinet setup items, setup page source metrics, settings/dashboard readiness DTO.

4. Medium - Access fail-closed ordering is currently good at route/loader boundaries, but the builder itself is not fail-closed if reused incorrectly. Evidence: dashboard gates before loading readiness data at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:97-116`; settings gates before config/key reads at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:173-180`; setup gates before config/key reads at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:171-186`; cabinet only gathers signals when `decision.allowed` at `apps/web/src/features/cabinet/loader.ts:147-158`; however `apps/web/src/features/bots/readiness.ts:139-182` will still build connection/config/operational rows for non-allowed access reasons if a caller supplies such inputs. Recommendation: make access decision a first-class builder input with `allowed`; when not allowed, return only a blocked access row and no setup, config, runtime, vault, or action rows. Keep caller gating, but make the shared builder fail closed independently. Target part: readiness builder contract.

5. Medium - The presentational map is clean, but static coverage has not moved with the new builder and can miss forbidden imports or stale false-green behavior. Evidence: `apps/web/src/features/bots/BotReadinessMap.tsx:1-63` is presentational and imports only UI/types; `tests/integration/bot-read-safety-static.test.ts:78-92` still checks old page-level readiness strings and only checks the component for forbidden backend/vault/adapter/control terms; Phase 3.82 handoff records that dashboard e2e coverage was not added at `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md:107-109`. Recommendation: add unit/static tests directly for `features/bots/readiness.ts` and callsites: no imports from backend/db-store/repositories/vault/adapters; no `rawJson`, `config.raw`, or `liveConfig.providerAccounts` as builder input; no start/stop/apply/retest/ping wording; count-only exchange metadata and raw Legacy provider snapshots must not produce ready. Target part: readiness tests and static safety tests.

6. Low - Admin user-bot detail already demonstrates the safer boundary model and should be treated as the pattern, while fleet health raw diagnostics should not feed user readiness. Evidence: admin detail requires user/admin at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:59-64`; its loader omits secret/raw metric fields and notes no raw config/secrets/live-apply credentials at `apps/web/src/features/admin/user-bot-detail-loader.ts:410-417`; tests assert no `exchangeApiKeySecrets`, no metric/trade `rawJson`, and no live controls at `tests/integration/admin-user-bot-detail-static.test.ts:16-54`. By contrast, fleet health diagnostics intentionally parse `rawJson.liveConfig` at `apps/web/src/features/admin/bot-health-loader.ts:206-227` for admin diagnostics. Recommendation: reuse the admin user-bot detail style for safe summaries; do not reuse fleet raw health loader data for user-facing readiness DTOs. Target part: future shared readiness source adapters.

## Decisions
1. Treat the shared readiness DTO/builder as pure presentation-domain logic. It may accept only already-authorized, already-sanitized, provenance-bearing facts.
2. Forbidden inputs for the shared builder: `rawJson`, `config.raw`, runtime `liveConfig`, provider snapshot objects, plaintext or sealed secret values, vault handles, adapter clients, live exchange responses, worker process state, and direct DB clients.
3. Forbidden behavior inside the shared builder: DB reads, vault open/decrypt, adapter calls, live exchange ping, live bot start/stop/apply/retest, worker tick/restart, SSH/tmux/systemd/provider DB access, and mutation/audit writes.
4. Safe green evidence should be narrow:
   - Access: entitlement/user-bot access decision is allowed.
   - Tortila exchange key: metadata plus explicit account-and-secret-row proof from a safe metadata-only repository summary, not count alone.
   - Legacy provider: exactly one active, user-scoped DB provider mapping for the current bot instance/product/provider.
   - Runtime/statistics: observed safe snapshot states only; `stale`, `mock`, `not_configured`, `malformed`, `unreachable`, and missing snapshots are not green.
5. Access should fail closed inside both the route/loader and the builder. If access is not allowed, readiness output should contain only access-blocked information and should not include setup, config, connection, runtime, or operational rows.

## Risks
1. If dashboard/settings/setup/cabinet adopt `buildBotReadinessItems` before tightening the input contract, a caller can accidentally turn raw provider snapshots or count-only key metadata into a green readiness state.
2. Current copy can imply "vault saved" or "provider mapped" when the proof is only metadata count or runtime/config-derived evidence.
3. Cabinet readiness is especially exposed because setup state collapses `done` items into `ready`; a hardcoded Legacy done item can hide missing or ambiguous provider mapping.
4. Static tests may become stale because the readiness logic moved from page files into `features/bots/readiness.ts`.
5. Admin fleet diagnostics contain intentional raw snapshot parsing; future reuse must keep that path isolated from user readiness.

## Verification/tests
Gates run:
1. Read-only file inspection of all required files and relevant admin/detail/test files.
2. `git status --short --branch` to record dirty inherited state.
3. Targeted `rg` searches for `rawJson`, `config.raw`, `vault`, adapter/control verbs, admin user-bot files, and readiness callsites.

Gates not run:
1. Unit/integration/e2e tests not run - read-only auditor scope and no product/test code changes.
2. Build/typecheck/lint not run - read-only auditor scope.
3. Live exchange ping not run - explicitly prohibited.
4. Live bot start/stop/apply/retest not run - explicitly prohibited.
5. Worker tick/restart not run - explicitly prohibited.
6. SSH/tmux/systemd/provider DB live read/write not run - explicitly prohibited.
7. `.env` read/write and secret/vault open/decrypt not run - explicitly prohibited.

No background agents were spawned by this per-agent audit, and none are left running from this auditor.

## Next actions
1. Redesign `features/bots/readiness.ts` around safe, provenance-bearing DTO inputs and an internal access fail-closed branch.
2. Move Legacy provider readiness to DB mapping summaries and remove `config.raw`/`liveConfig.providerAccounts` from readiness callsites.
3. Split Tortila exchange readiness into metadata-only, vault-metadata-confirmed, and live-ping-not-run states; reserve green for safe account-plus-secret metadata proof.
4. Convert setup and cabinet to the shared DTO only after the safe input contract exists.
5. Add static/unit coverage for the builder and callsites so forbidden raw/config/vault/adapter/control inputs cannot regress.
6. Add dashboard readiness e2e coverage and update stale page-level static assertions to track the new builder module.
