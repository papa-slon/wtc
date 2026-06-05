# legacy-provider-identity-schema-auditor handoff
## Scope
Phase 3.92 read-only audit of the Legacy provider identity schema split around `providerPubId` versus persistable user config. Focus was the minimal design needed to keep provider identity out of user-saved config while preserving safe runtime/display provider identity for Legacy statistics and snapshot views. No product code, tests, package files, migrations, env, vault, live services, SSH/tmux/systemd, provider DB, worker, exchange, or bot state was modified.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`
8. `apps/web/src/features/bots/config.ts`
9. `apps/web/src/features/bots/config-types.ts`
10. `apps/web/src/features/bots/config-export.ts`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/statistics-panels.tsx`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
15. `apps/web/src/features/bots/data.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
19. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
20. `apps/worker/src/legacy-live.ts`
21. `packages/db/src/repositories.ts`
22. `tests/integration/bot-config-export-route-handler.test.ts`
23. `tests/integration/bot-config-export-static.test.ts`
24. `tests/integration/bot-config-review-static.test.ts`
25. `tests/integration/bot-config-source-audit-static.test.ts`
26. `tests/integration/bot-runtime-config-sanitizer.test.ts`
27. `tests/integration/bot-statistics-static.test.ts`
28. `tests/integration/user-resolved-bot-config-db.test.ts`
29. `tests/integration/user-resolved-bot-config-static.test.ts`
30. `tests/integration/db-0002.test.ts`
31. `tests/integration/legacy-live-worker-static.test.ts`
32. `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Runtime provider identity is written by the worker but removed before the UI can use it. Evidence: the Legacy worker builds `liveConfig` with `providerPubId` on stage rows, symbol rows, active slots, active orders, and positions at `apps/worker/src/legacy-live.ts:199`, `apps/worker/src/legacy-live.ts:207`, `apps/worker/src/legacy-live.ts:258`, `apps/worker/src/legacy-live.ts:268`, and `apps/worker/src/legacy-live.ts:293`; the web read model extracts `rawMetric.liveConfig` then calls `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:629`; the sanitizer forbids `providerpubid`, `pubid`, and `provideraccounts` at `apps/web/src/features/bots/runtime-config-sanitizer.ts:17` and `apps/web/src/features/bots/runtime-config-sanitizer.ts:20`; settings expects `config.providerAccounts` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:77`, and statistics expects provider identity in rows and raw snapshot arrays at `apps/web/src/features/bots/statistics-panels.tsx:465`, `apps/web/src/features/bots/statistics-panels.tsx:530`, `apps/web/src/features/bots/statistics-panels.tsx:551`, and `apps/web/src/features/bots/statistics-panels.tsx:575`. Recommendation: split runtime display sanitization from persistable config sanitization; keep provider identity forbidden for saves, but allow a display-safe Legacy runtime identity shape, preferably masked or display-only, under `BotConfigView` or a dedicated `LegacyRuntimeSnapshotView`. Target part: `runtime-config-sanitizer.ts` and DB-backed Legacy read model.
2. Severity: High. Runtime snapshot callers still parse `liveConfig.symbolConfigs` with the persistable parser, which strips `providerPubId` even if the sanitizer is fixed. Evidence: `legacySymbolConfigSchema` is now persistable-only and does not include provider identity at `apps/web/src/features/bots/config.ts:70` and `apps/web/src/features/bots/config.ts:110`; `legacyRuntimeSymbolConfigSchema` adds optional `providerPubId` at `apps/web/src/features/bots/config.ts:112`; `legacySymbolConfigsFromConfig` uses the persistable schema at `apps/web/src/features/bots/config.ts:612`; `legacyRuntimeSymbolConfigsFromConfig` exists at `apps/web/src/features/bots/config.ts:638`; the statistics page passes `legacyLiveConfig` through `legacySymbolConfigsFromConfig` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:243`; settings does the same for snapshot rows at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:203`; the bot dashboard summary does the same for `runtimeConfig ?? referenceConfig` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:60`. Recommendation: use `legacyRuntimeSymbolConfigsFromConfig` only for runtime/snapshot sources and keep `legacySymbolConfigsFromConfig` for `state.current`, presets, form rows, and saved user config. Target part: Legacy statistics, settings snapshot block, and dashboard runtime summary.
3. Severity: Medium. Persistable/export schema ownership is partially split but duplicated, leaving a manual "parse runtime then delete identity" pattern in export. Evidence: `config-export.ts` defines a local persistable `legacySymbolConfigSchema` at `apps/web/src/features/bots/config-export.ts:72`, a local runtime schema with `providerPubId` at `apps/web/src/features/bots/config-export.ts:74`, and then uses `legacyRuntimeSymbolConfigsFromConfig(config)` plus `delete safe.providerPubId` at `apps/web/src/features/bots/config-export.ts:251`; tests pin that deletion at `tests/integration/bot-config-export-static.test.ts:22`, and the route-handler test seeds `state.current` with `providerPubId` at `tests/integration/bot-config-export-route-handler.test.ts:35` before asserting omission at `tests/integration/bot-config-export-route-handler.test.ts:234`. Recommendation: move the pure Legacy persistable/runtime schemas into one server-neutral module or keep the current duplication only temporarily; export should parse the persistable safe shape for `state.current` and retain a backwards-compatible pollution test without making the manual delete the design contract. Target part: `config-export.ts` and export tests.
4. Severity: Medium. Tests currently prove provider identity is stripped, not that safe runtime/display identity is preserved. Evidence: `bot-runtime-config-sanitizer.test.ts` lists `providerPubId`, `provider-pub-id-secret-value`, `providerAccountId`, and `provider-account-secret-value` as forbidden markers at `tests/integration/bot-runtime-config-sanitizer.test.ts:4`, injects `providerPubId` into `symbolConfigs` at `tests/integration/bot-runtime-config-sanitizer.test.ts:50`, and expects the sanitized raw config to contain only symbol data at `tests/integration/bot-runtime-config-sanitizer.test.ts:69`; `bot-statistics-static.test.ts` verifies labels such as "Provider accounts" and "DB snapshot evidence" at `tests/integration/bot-statistics-static.test.ts:73`, but does not assert that the statistics page uses the runtime parser or that a provider identity survives as masked display evidence. Recommendation: replace the sanitizer test with a dual assertion: raw secrets/provider account DB ids/live-control keys are removed, while Legacy display identity is preserved in a safe masked/display-only form; add a static or unit test that statistics/settings runtime sources call `legacyRuntimeSymbolConfigsFromConfig`. Target part: runtime-config and statistics test coverage.
5. Severity: Info. The lower persistence boundary already rejects provider identity and should remain the backstop after the schema split. Evidence: `packages/db/src/repositories.ts` forbids `providerpubid`, `provideraccountid`, `pubid`, and `provideraccounts` at `packages/db/src/repositories.ts:506`; `saveBotConfig` calls the recursive guard before opening the transaction at `packages/db/src/repositories.ts:2175`; `tests/integration/db-0002.test.ts` verifies that a nested `symbolConfigs[].providerPubId` write rejects and leaves config history count unchanged at `tests/integration/db-0002.test.ts:69`. Recommendation: keep the DB guard unchanged; the next slice should narrow app schemas and runtime display models above this guard rather than weakening repository validation. Target part: DB persistence boundary.

## Decisions
1. Treated `providerPubId` as forbidden for persistable user/admin config and allowed only as runtime/display evidence from worker snapshots.
2. Treated raw provider-account identifiers as display-sensitive rather than exchange secrets; the safer next design is to preserve masked/display-only identity, not raw provider IDs in user-save schemas.
3. Did not recommend removing the DB forbidden-key guard; it is the correct final backstop even after schema cleanup.
4. Did not run Vitest, typecheck, build, preview, Playwright, worker, provider, or live-service commands because this was a read-only audit with no product/test edits requested.

## Risks
1. Current runtime UI can show provider snapshot rows/counts without preserving row-level `providerPubId`, depending on whether `providerAccounts` survives the sanitizer; this can make the UI look connected while the coverage matrix loses the actual row identity.
2. If the runtime sanitizer is loosened naively, raw provider IDs could leak through generic `raw` payloads. Use an explicit Legacy runtime display DTO or masked identity fields instead of a blanket allow.
3. `config-export.ts` duplicates schema logic from `config.ts`; future schema changes can drift unless the pure parts are centralized.
4. The worktree was already heavily dirty before this audit. This handoff does not certify unrelated changes or earlier phase completion.

## Verification/tests
RUN:
1. Required protocol/status/handoff docs were read before code inspection.
2. Static code inspection of the listed schema, sanitizer, display, worker snapshot, repository, and integration-test files.
3. `git status --short` was read to confirm the workspace was already heavily dirty and that this audit should not attribute those changes to this session.

NOT RUN:
1. Vitest, typecheck, lint, build, preview, Playwright/e2e, browser screenshots - skipped because this was a read-only schema audit.
2. Worker tick/restart/smoke, provider DB reads/writes, exchange pings, `.env`, vault/secret inspection, SSH, tmux, systemd, live bot start/stop/apply-config/retest - prohibited by scope.

## Next actions
1. Update runtime display reads to use `legacyRuntimeSymbolConfigsFromConfig` for `legacyLiveConfig` in statistics, settings snapshot, and dashboard summary, while keeping `legacySymbolConfigsFromConfig` for editable/persisted WTC config.
2. Replace the runtime sanitizer's blanket `providerpubid`/`provideraccounts` removal with an explicit safe Legacy runtime display DTO that keeps masked provider identity and drops secrets, DB mapping ids, raw URLs, headers, and live-control fields.
3. Keep `providerPubId` out of `LegacySymbolConfig`, `legacySymbolConfigSchema`, form parsing, presets, system defaults, and repository persistence.
4. Clean up `config-export.ts` so safe exports depend on the persistable config schema, not a runtime parser plus `delete providerPubId`; retain a regression test that polluted input cannot export provider identity.
5. Add focused tests for: DB save rejects `providerPubId`; runtime sanitizer preserves only masked/display provider identity; statistics/settings use runtime parser for snapshots; export omits provider identity; no live-control/network path is introduced.
