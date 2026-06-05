# bot-operation-map-security-auditor handoff
## Scope
Read-only platform/security audit for adding an operation-map panel to user/admin Legacy and Tortila bot surfaces. The audit identifies safe existing sanitized sources, forbidden raw/control sources, and the admin/user read-only boundary. No product code, tests, package metadata, or existing docs were edited.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
8. `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`
9. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`
10. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
11. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`
12. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
13. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
14. `apps/web/src/features/bots/readiness.ts`
15. `apps/web/src/features/bots/readiness-loader.ts`
16. `apps/web/src/features/bots/BotReadinessMap.tsx`
17. `apps/web/src/features/bots/config-review.ts`
18. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
19. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
20. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
21. `apps/web/src/features/bots/data.tsx`
22. `apps/web/src/features/bots/config.ts`
23. `apps/web/src/features/bots/config-action-handler.ts`
24. `apps/web/src/features/bots/statistics-panels.tsx`
25. `apps/web/src/features/admin/queries.ts`
26. `apps/web/src/features/admin/user-bot-detail-loader.ts`
27. `apps/web/src/features/admin/types.ts`
28. `apps/web/src/features/admin/actions.ts`
29. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
30. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
31. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
32. `packages/db/src/schema.ts`
33. `packages/db/src/repositories.ts`
34. `packages/bot-adapters/src/control.ts`
35. `packages/bot-adapters/src/factory.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The operation map should be assembled from existing sanitized DTO/view-model sources, not new raw DB/runtime reads. Evidence: `loadBotReadinessForUser` is server-only, entitlement-aware, and returns scalar readiness/config/runtime/statistics DTO fields at `apps/web/src/features/bots/readiness-loader.ts:116`; the shared readiness items include access, key/provider state, settings source, runtime/statistics rows, and disabled live-control rows at `apps/web/src/features/bots/readiness.ts:175`; the config review DTO exposes only derived settings copy/metrics/sections at `apps/web/src/features/bots/config-review.ts:30`; warning summaries use a bounded `BotWarningSummary` shape at `apps/web/src/features/bots/data.tsx:80`. Recommendation: use `readiness.items`, `buildBotConfigReview(...)`, `read.warningSummary`, and existing admin `configSummary`/`warningSummary` models as the operation-map inputs. Target part: user/admin operation-map data source.
2. Severity: High. User operation maps must remain current-user and entitlement scoped. Evidence: `loadBot()` resolves the current session user and `botAccessForUser` before returning bot access at `apps/web/src/features/bots/data.tsx:29`; `loadBotReadinessForUser` returns only an access row and hides bot readiness data when access is denied at `apps/web/src/features/bots/readiness-loader.ts:126`; DB snapshot reads require a user-owned bot instance before exposing runtime facts at `apps/web/src/features/bots/data.tsx:431`; Legacy runtime rows require exactly one active provider mapping before user-scoped metric/position/trade reads at `apps/web/src/features/bots/data.tsx:469`. Recommendation: user operation maps may use `loadBotReadinessForUser(currentUser, ...)` and `loadBotReadModelForUser(currentUser.id, ...)` only; never import admin user detail loaders into user pages. Target part: user bot surfaces.
3. Severity: High. Admin operation maps may use `loadAdminUserBotDetail`, but only as a read-only admin projection. Evidence: `/admin/users/[userId]/bots` requires `requireUser()` plus `assertAdmin()` before loading detail at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:71`; the page copy states user settings and provider mappings are view-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:80`; the loader selects user/entitlement/instance/key/provider/snapshot rows into DTOs at `apps/web/src/features/admin/user-bot-detail-loader.ts:789`; the returned result hard-sets `liveControlDisabled: true` at `apps/web/src/features/admin/user-bot-detail-loader.ts:1047`. Recommendation: admin operation maps can show target-user access, config source, key metadata status, masked provider mapping status, warning summary, latest metric, and stats scope, but must not add edit/apply/test controls. Target part: admin user bot detail.
4. Severity: High. Raw provider IDs and raw runtime JSON must not be used as operation-map inputs. Evidence: raw Legacy provider IDs live in `bot_provider_accounts.provider_account_id` at `packages/db/src/schema.ts:146`; the user runtime sanitizer drops provider/control/raw keys and only masks allowed Legacy provider identity values at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3` and `apps/web/src/features/bots/runtime-config-sanitizer.ts:72`; DB read-model code touches `botMetricSnapshots.rawJson` only to derive a sanitized `BotConfigView` through `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:629`; admin user detail masks provider account IDs before projection at `apps/web/src/features/admin/user-bot-detail-loader.ts:215` and `apps/web/src/features/admin/user-bot-detail-loader.ts:636`. Recommendation: operation maps should display provider count/state/scope/fingerprint only, never raw `providerAccountId`, raw `providerAccounts`, `liveConfig`, or raw snapshot JSON. Target part: provider identity boundary.
5. Severity: High. Exchange key readiness must stay metadata-only and must not load sealed secret material. Evidence: schema documents that `exchange_api_key_secrets` has no plaintext column at `packages/db/src/schema.ts:6`; `listExchangeKeys` never joins the secret table at `packages/db/src/repositories.ts:404`; `summarizeExchangeKeyMetadata` selects account IDs and secret-row account IDs only at `packages/db/src/repositories.ts:415`; the UI says the readiness check does not contact the exchange or start/stop/reconfigure a bot at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:69` and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:145`. Recommendation: operation maps may show key count, mode, key mask, and vault-metadata state, but not `sealed`, `keyId`, ciphertext fields, vault payloads, env/vault files, or any live exchange ping result. Target part: exchange-key/vault boundary.
6. Severity: High. Live apply/start/stop/retest must remain absent from the operation map. Evidence: AGENTS non-negotiables prohibit live bot start/stop/apply-config until audits pass at `AGENTS.md:74`; the seed locks "No live bot control / ssh / tmux / systemd / process control / .env mutation" at `docs/handoffs/0000-orchestrator-seed.md:113`; the bot control gate throws unless both flag and audited approval are true at `packages/bot-adapters/src/control.ts:16`; the bot dashboard renders start/stop buttons disabled and says live config apply is unavailable at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:278`. Recommendation: the operation map can include a readonly row such as "Live control disabled"; it must not contain forms, route handlers, server actions, adapter calls, worker tick/restart, provider DB calls, exchange calls, SSH, tmux, or systemd operations. Target part: live-control boundary.
7. Severity: Medium. Existing admin/user pages already contain operation-map-adjacent UI; the safest next implementation is consolidation, not a parallel data path. Evidence: the user bot page already renders `BotReadinessMap` with operational-map copy at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:152`; settings separates resolved source, provider/key state, and save behavior at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:284`; admin user detail renders canonical warning summaries, resolved settings, key metadata, and user-scoped stats from the DTO at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:176`. Recommendation: factor a presentational operation-map panel over existing DTOs instead of querying DB tables or adapters again. Target part: UI composition.

## Decisions
1. Approved user sources: `loadBotReadinessForUser`, `readiness.items`, `loadBotReadModelForUser` safe read parts, `read.warningSummary`, `buildBotConfigReview`, `BotConfigReviewPanel`, `WarningSummaryPanel`, and `ExchangeKeyReadinessPanel` metadata fields.
2. Approved admin sources: `loadAdminUserBotDetail` result fields, specifically `bots[].configSummary`, `bots[].exchangeAccount` metadata, `bots[].providerAccount` masked projection, `bots[].warningSummary`, `bots[].latestMetric`, `bots[].statsSource`, and `liveControlDisabled`.
3. Forbidden sources: raw `bot_provider_accounts.provider_account_id`, raw provider/runtime `providerAccounts`, raw `botMetricSnapshots.rawJson` or `botTradeImports.rawJson` outside existing sanitizer/mappers, `exchange_api_key_secrets.sealed`, vault/env/secret files, exchange clients, provider DB calls, live adapter control paths, start/stop/apply/retest actions, worker tick/restart, SSH, tmux, and systemd.
4. User boundary: current user only, server-side entitlement check first, no cross-user admin DTOs, and no bot readiness detail when access is denied.
5. Admin boundary: `assertAdmin` required, read-only projection only, no user-owned settings edits, no provider mapping edits inside the operation map, no exchange-key secret reads, and no live-control affordance beyond disabled state.

## Risks
1. Several existing files are uncommitted/untracked from prior phases; this audit did not normalize or verify the dirty tree beyond reading relevant current files.
2. Some existing UI labels still say `pub_id` while values are masked/fingerprinted by loaders; a compact operation map should label them as mapped/masked provider identity to avoid implying raw provider IDs are safe display data.
3. `loadBotReadModelForUser(..., ['config'])` still derives sanitized config from raw metric snapshot JSON internally; operation-map code should consume only its returned `BotConfigView`, not the raw snapshot object.
4. No runtime/browser/tests were run in this read-only security audit, so rendered layout and regression coverage remain for the implementation phase.

## Verification/tests
RUN:
1. Required protocol/status/seed/Phase 3.96 docs were read first.
2. `git status --short --branch` was inspected; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked state.
3. Source inspection was read-only via `rg`/PowerShell; no product code, tests, packages, env/vault/secret files, provider DB, live services, SSH, tmux, systemd, worker tick/restart, exchange calls, start/stop/apply/retest, or browser preview was touched.

NOT RUN:
1. Unit/integration/e2e/build/lint/typecheck/secret scan/governance gates - not run because this was a read-only audit with exactly one handoff write.
2. Background agents - not launched or claimed; this file is one foreground read-only auditor handoff, not an N-agent audit.
3. Live bot services, provider DB, exchange ping/calls, env/vault/secret inspection, SSH/tmux/systemd, worker tick/restart, start/stop/apply/retest - forbidden by scope.

## Next actions
1. Implement the operation-map panel as a pure presentational component over existing DTOs; do not introduce DB queries or adapter calls in the component.
2. Add a focused static test that forbids operation-map imports of `schema`, `getBotAdapter`, `recordExchangeKeyMetadataCheck`, raw JSON fields, provider raw IDs, and live-control action names.
3. Add user/admin rendered coverage after implementation to prove the panel shows disabled live control, metadata-only key/provider status, warning summary state, and no raw provider/secret/control text.
