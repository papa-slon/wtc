# legacy-provider-identity-tests-auditor handoff
## Scope
Phase 3.92 read-only audit for Legacy provider identity tests and security boundaries. Scope was to inspect whether current tests prove provider identity cannot enter persistable user/global bot config while runtime snapshots can still display sanitized provider identity. No product code, tests, docs, live services, provider DBs, worker ticks, exchange calls, secrets, SSH, tmux, systemd, or env files were changed or touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`
8. `tests/integration/bot-read-safety-static.test.ts`
9. `tests/integration/bot-config-export-static.test.ts`
10. `tests/integration/bot-config-export-route-handler.test.ts`
11. `tests/integration/bot-config-action-handler.test.ts`
12. `tests/integration/bot-config-source-audit-static.test.ts`
13. `tests/integration/admin-global-bot-config-db.test.ts`
14. `tests/integration/db-0002.test.ts`
15. `tests/integration/legacy-provider-worker.test.ts`
16. `tests/integration/legacy-live-worker-static.test.ts`
17. `tests/integration/bot-runtime-config-sanitizer.test.ts`
18. `apps/web/src/features/bots/config.ts`
19. `apps/web/src/features/bots/config-export.ts`
20. `apps/web/src/features/bots/config-action-handler.ts`
21. `apps/web/src/features/bots/config-export-handler.ts`
22. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
23. `apps/web/src/features/bots/data.tsx`
24. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
25. `apps/web/src/features/bots/statistics-panels.tsx`
26. `apps/web/src/features/bots/config-types.ts`
27. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
28. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
29. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
30. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
31. `packages/db/src/repositories.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The main save paths forbid provider identity, but the exported low-level config-history append path can still persist forbidden JSON. Evidence: the DB forbidden-key set includes `providerpubid`, `provideraccountid`, `provideraccounts`, `rawjson`, and live-control keys at `packages/db/src/repositories.ts:506`; recursive rejection is implemented at `packages/db/src/repositories.ts:544`; `saveBotGlobalConfig` calls it before global writes at `packages/db/src/repositories.ts:2087`; `saveBotConfig` calls it before user writes at `packages/db/src/repositories.ts:2175`; `insertBotConfigVersion` writes `configJson` directly without that guard at `packages/db/src/repositories.ts:2191`. Existing user-config coverage rejects nested `providerPubId` through `saveBotConfig` at `tests/integration/db-0002.test.ts:69`, but the explicit-version test only covers duplicate `(instance, version)` behavior at `tests/integration/db-0002.test.ts:90`. Recommendation: either add `assertNoForbiddenBotConfigKeys(input.configJson)` to `insertBotConfigVersion` or make the helper non-exported/test-only; add a PGlite assertion that `insertBotConfigVersion` rejects `symbolConfigs[].providerPubId`, `providerAccounts`, and `rawJson` without writing history. Target part: DB config history boundary.
2. Severity: Medium. The persistable-vs-runtime Legacy schema split is present, but the tests should pin the exact split instead of only searching for broad markers. Evidence: persistable `legacySymbolConfigShape` has no provider identity field at `apps/web/src/features/bots/config.ts:70`; the runtime-only schema adds `providerPubId` at `apps/web/src/features/bots/config.ts:112`; `legacyBotConfigSchema` uses the persistable `legacySymbolConfigSchema` at `apps/web/src/features/bots/config.ts:128`; user persistence rejects forbidden keys before parsing at `apps/web/src/features/bots/config.ts:765`; the current static guard only asserts the source contains `providerPubId` and does not read `legacy_pub_id_` FormData at `tests/integration/bot-read-safety-static.test.ts:355`. Recommendation: add a focused source-slice or pure-schema regression proving `providerPubId` appears only in `legacyRuntimeSymbolConfigSchema`, not in `legacySymbolConfigShape`, `legacyBotConfigSchema`, or `botConfigFormInput`. Target part: Legacy schema boundary.
3. Severity: High. Current runtime sanitizer tests prove provider identity is stripped from `BotConfigView.raw`, but they do not yet prove the requested positive behavior that sanitized provider identity can still be displayed. Evidence: worker snapshot tests intentionally keep provider identity in runtime evidence at `tests/integration/legacy-provider-worker.test.ts:185`; user DB reads require exactly one active Legacy provider mapping before scoped runtime snapshots are exposed at `apps/web/src/features/bots/data.tsx:451`; the latest snapshot `liveConfig` is passed to `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:629`; the sanitizer drops `providerpubid`, `provideraccountid`, and `provideraccounts` at `apps/web/src/features/bots/runtime-config-sanitizer.ts:17`; `tests/integration/bot-runtime-config-sanitizer.test.ts:31` asserts the resulting JSON contains no provider identity markers. Meanwhile settings/statistics/dashboard code tries to display provider-account/runtime identity from `runtimeConfig?.providerAccounts` or row `providerPubId` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:398`, `apps/web/src/features/bots/statistics-panels.tsx:492`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:64`. Recommendation: introduce a display-only masked provider-identity DTO outside persistable config/raw JSON, keep full IDs out of `raw`, and update sanitizer/display tests to assert masked IDs or counts render while full provider IDs, provider-account IDs, secrets, URLs, headers, rawJson, and live-control keys do not. Target part: runtime snapshot display boundary.
4. Severity: Medium. Global config DB coverage rejects provider-account and raw/live keys, but it does not directly cover the exact Legacy provider identity key that caused this phase. Evidence: `tests/integration/admin-global-bot-config-db.test.ts:181` loops forbidden global config cases; the cases include `providerAccountId`, `providerAccounts`, `rawJson`, `applyConfig`, and live control at `tests/integration/admin-global-bot-config-db.test.ts:184`; the audit metadata assertion checks `providerPubId` is not in audit rows at `tests/integration/admin-global-bot-config-db.test.ts:221`; repository guards would reject `providerpubid` at `packages/db/src/repositories.ts:520`. Recommendation: add a `provider_pub_id` case like `{ symbolConfigs: [{ symbol: 'BTC/USDT:USDT', providerPubId: 'provider-pub-redacted' }] }` and assert `bot_global_configs`, `bot_global_config_versions`, and `audit_logs` counts remain unchanged. Target part: admin global default boundary.
5. Severity: Medium. Export tests are directionally correct but `config-export.ts` duplicates a Legacy schema that accepts `providerPubId`, which creates a future drift point separate from `config.ts`'s persistable/runtime split. Evidence: the export-local Legacy schema accepts `providerPubId` at `apps/web/src/features/bots/config-export.ts:31`; export sanitization deletes it at `apps/web/src/features/bots/config-export.ts:232`; route-handler coverage injects `providerPubId` and verifies it is absent from exported JSON/native payloads at `tests/integration/bot-config-export-route-handler.test.ts:203`; static export coverage only checks for `delete safe.providerPubId` at `tests/integration/bot-config-export-static.test.ts:15`. Recommendation: either derive export parsing from the same runtime-only schema used by display code or add a static drift test that export may accept provider identity only to delete/mask it, while persistable user/global config schemas may not accept it at all. Target part: config export boundary.

## Decisions
1. Treated `bot_metric_snapshots.raw_json.liveConfig` as runtime evidence, not as a persistable user/global config source.
2. Treated `bot_configs`, `bot_config_versions`, `bot_global_configs`, and `bot_global_config_versions` as persistable config surfaces for this proof.
3. Did not run Vitest or other gates in this read-only auditor lane; recommendations below are non-live gates for the implementation/tests lane.
4. Used the current on-disk dirty tree as the source of truth. The branch is `codex/bot-analytics-settings-canary-20260603`, with many pre-existing modified/untracked files from prior WTC rollout phases.

## Risks
1. The low-level `insertBotConfigVersion` path is the main proof gap because it can write immutable history without the forbidden-key guard.
2. The current sanitizer removes provider identity so aggressively that it may block the desired masked provider-identity display unless a separate display DTO is added.
3. Static source-string tests around provider identity are useful guardrails but insufficient alone; PGlite no-write tests should cover repository boundaries.
4. The working tree is heavily dirty and appears to be moving; future implementation should re-read these exact files before editing.

## Verification/tests
RUN:
1. Required protocol and status docs were read.
2. Read-only source and test inspection was performed for the requested files of interest plus the sanitizer/display files needed to trace runtime identity.
3. Git branch and dirty state were inspected.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd, live server mutation - forbidden by scope.
2. `npm test`, focused Vitest, typecheck, lint, Playwright/e2e, preview/browser checks, build, secret scan, governance - not run because this lane was read-only audit and handoff-only.

Recommended non-live gates after focused test changes:
1. `npx vitest run tests/integration/db-0002.test.ts tests/integration/admin-global-bot-config-db.test.ts`
2. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-source-audit-static.test.ts`
3. `npx vitest run tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts`
4. `npx vitest run tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts`

## Next actions
1. Close the `insertBotConfigVersion` forbidden-key bypass or make the append helper private/test-only, then add PGlite no-write coverage.
2. Add direct global-default PGlite coverage for `symbolConfigs[].providerPubId`.
3. Add exact schema-split tests proving `providerPubId` is runtime/display-only and cannot be part of the persistable Legacy config shape.
4. Define a masked runtime provider-identity display DTO separate from `BotConfigView.raw`, then update sanitizer/display tests so full provider IDs are never exposed but safe identity/counts can still render.
5. Keep all gates non-live until separate security and bot-integration acceptance explicitly approve live adapter/control paths.
