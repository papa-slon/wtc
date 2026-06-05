# legacy-stage-live-preview-security-auditor handoff
## Scope
Read-only Phase 4.04 security/source-boundary audit for adding live client-side stage usage preview to `LegacyAveragingConfigTable` when users edit Legacy RSI/CCI stage capacity inputs.

Boundary audited: editable WTC config rows/stages only; aggregate stage counts only; no provider `pub_id`, raw runtime payload, `legacyLiveConfig`, secrets, live bot control, exchange/provider calls, provider DB, worker ticks, or new server action mutation.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`
8. `apps/web/src/features/bots/config-types.ts`
9. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-action-handler.ts`
12. `apps/web/src/features/bots/config-review.ts`
13. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
16. `apps/web/src/app/admin/bots/config/page.tsx`
17. `tests/integration/bot-config-review-static.test.ts`
18. `tests/integration/bot-read-safety-static.test.ts`
19. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit. Required handoff written at `docs/handoffs/20260604-0800-legacy-stage-live-preview-security-auditor.md`.

## Findings
1. Severity: High. Current live capacity preview is client-local state and does not introduce a server action, fetch, adapter call, exchange call, or live bot control path. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:1` marks the table as client-side; imports are React/UI/types at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:3` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:6`; draft state is initialized at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:102` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:122`; RSI/CCI capacity inputs update local `stageDrafts` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:407` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:431`; status is rendered from aggregate `used/rsi/cci` counts at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:437` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:443`. Recommendation: keep the live preview as local table state only; do not add fetch, server action, adapter, provider, exchange, start/stop/apply/retest, or worker reads for this preview. Target part: `LegacyAveragingConfigTable` live preview.

2. Severity: High. Settings, setup, and admin global config currently feed the table from editable WTC config rows/stages, not from `legacyLiveConfig` or runtime snapshot rows. Evidence: settings separates `legacyLiveConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:197` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:215`, derives editable `legacyRows`/`legacyStages` from `cur` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:210`, and passes those to the table at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:551` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:554`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:204` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:526` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:529`; admin global config derives from `config` at `apps/web/src/app/admin/bots/config/page.tsx:69` to `apps/web/src/app/admin/bots/config/page.tsx:71` and passes those rows at `apps/web/src/app/admin/bots/config/page.tsx:186` to `apps/web/src/app/admin/bots/config/page.tsx:189`. Recommendation: keep `legacySnapshotRows`, `legacySnapshotStages`, provider accounts, and raw runtime evidence out of table props and out of the live preview calculation. Target part: settings/setup/admin source wiring.

3. Severity: High. The save/form boundary remains the existing WTC config mutation and rejects provider/runtime/secret/control-shaped fields before persistence. Evidence: persistable Legacy stage schema is only `stage`, `rsiSlots`, and `cciSlots` at `apps/web/src/features/bots/config.ts:121` to `apps/web/src/features/bots/config.ts:140`; form input maps only `symbolConfigs` and `stageConfigs` from WTC form names at `apps/web/src/features/bots/config.ts:377` to `apps/web/src/features/bots/config.ts:386`; stage rows parse only `legacy_stage_slot_*`, `legacy_stage_rsi_*`, and `legacy_stage_cci_*` at `apps/web/src/features/bots/config.ts:679` to `apps/web/src/features/bots/config.ts:689`; forbidden keys include provider ids, live config/raw JSON, URLs, headers, apply/start/stop/retest/test-exchange, and secrets at `apps/web/src/features/bots/config.ts:878` to `apps/web/src/features/bots/config.ts:895`; `safeUserBotConfigForProduct` enforces the forbidden-key check plus product schema at `apps/web/src/features/bots/config.ts:916` to `apps/web/src/features/bots/config.ts:921`; the action handler checks forbidden form keys before parsing/persisting at `apps/web/src/features/bots/config-action-handler.ts:159` to `apps/web/src/features/bots/config-action-handler.ts:180`. Recommendation: if preview-related hidden fields are ever added, keep them under the existing WTC config schema only and extend static tests for forbidden form keys. Target part: config parsing and save mutation boundary.

4. Severity: Medium. The current review helper is aggregate-only and safe, but `LegacyAveragingConfigTable` is still typed to accept `LegacyRuntimeSymbolConfig` and includes an optional provider identity display path, which is broader than the Phase 4.04 live-preview boundary needs. Evidence: `LegacyRuntimeSymbolConfig` extends `LegacySymbolConfig` with `providerPubId` at `apps/web/src/features/bots/config-types.ts:38`; the table imports that runtime-capable type at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:5`; `showProviderIdentity` defaults false but exists at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:91` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:99`; provider count/display branches exist at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:113`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:158`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:196`. Recommendation: harden before or with implementation by narrowing the table `rows` and `stageUsageRows` type to `readonly LegacySymbolConfig[]`, or move provider identity display to a separate runtime-evidence component; add a static guard that settings/setup/admin config do not pass runtime rows or `showProviderIdentity`. Target part: shared component source-boundary hardening.

5. Severity: Medium. Static tests cover the saved advisory and source-boundary guards, and focused static gates passed, but live browser behavior is currently proven by Playwright only and was not run in this read-only audit. Evidence: static review tests assert capacity issue helpers and table status strings at `tests/integration/bot-config-review-static.test.ts:71`, `tests/integration/bot-config-review-static.test.ts:180` to `tests/integration/bot-config-review-static.test.ts:184`, and forbidden action/control strings at `tests/integration/bot-config-review-static.test.ts:206` to `tests/integration/bot-config-review-static.test.ts:210`; read-safety static tests assert no Legacy pub-id form field and table capacity UI at `tests/integration/bot-read-safety-static.test.ts:424` to `tests/integration/bot-read-safety-static.test.ts:445`; Playwright includes the live capacity fill proof at `tests/e2e/bot-settings.spec.ts:234` to `tests/e2e/bot-settings.spec.ts:264`. Recommendation: keep the static tests as the source-boundary gate and run the focused Playwright spec only in an implementation/verification phase with mock/dev flags and no live provider services. Target part: test plan.

## Decisions
1. No blocker found for the proposed live client-side stage usage preview if it remains local to `LegacyAveragingConfigTable` and uses only editable WTC `legacyRows`/`legacyStages`.
2. Runtime/provider evidence must remain separate from the editable table and the live preview calculation.
3. The preview must remain aggregate-only: stage number, RSI used/slots, CCI used/slots, and inside/full/over-capacity status.
4. No new server action mutation is needed or acceptable for the preview. The existing save path remains the only WTC config mutation.
5. No background agents were launched in this turn because this is a single named read-only per-agent audit, not an aggregate broad phase. No background agents remain running from this audit.

## Risks
1. The table's runtime-capable row type and optional provider identity branch are a future misuse risk even though current settings/setup/admin config callers pass editable WTC rows.
2. Static tests do not yet forbid `providerPubId` inside `LegacyAveragingConfigTable` because prior runtime-evidence display support left an optional provider identity path in the component.
3. The worktree was already broadly dirty before this audit, including the files in scope; this handoff does not claim ownership of those pre-existing changes.
4. This audit inspected but did not execute Playwright, dev server, provider DB, worker, exchange, or live bot paths by explicit safety scope.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/current-state docs, and the latest Phase 4.03 aggregate handoff.
2. Inspected `LegacyAveragingConfigTable`, config schemas/form parsing, config-review helper, settings/setup/admin config wiring, and static/e2e tests.
3. Searched scoped files for provider/runtime/secrets/live-control terms including `providerPubId`, `legacyLiveConfig`, `raw`, `fetch`, `api_management`, `applyConfig`, `startBot`, `stopBot`, `retest`, secrets, and exchange/provider boundaries.
4. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 2 files and 29 tests passed.
5. `git status --short --branch` - observed pre-existing dirty branch `codex/bot-analytics-settings-canary-20260603`.

NOT RUN:
1. Playwright/e2e/dev server/browser preview - skipped by read-only security audit scope; e2e file was inspected only.
2. Full `npm test`, lint, typecheck, build, coverage, governance, and secret scan - skipped because this was a narrow source-boundary audit with focused static gates.
3. Live services, provider DB, env/secret/vault inspection, worker ticks, exchange/provider pings, SSH/tmux/systemd, start/stop/apply/retest/position-close - skipped by explicit safety boundary.
4. Git commit/push/PR - not requested.

## Next actions
1. Implementer may proceed with the live preview only inside local client state and only from editable WTC config rows/stages.
2. Harden the shared table by narrowing `rows`/`stageUsageRows` to `LegacySymbolConfig[]` or by splitting runtime identity display out of the editable config table.
3. Add or keep static guards for settings/setup/admin config source wiring, forbidden provider/runtime form fields, and no preview-side fetch/server-action/live-control usage.
4. In the implementation phase, run focused static tests plus the existing safe Playwright `Legacy stage over-capacity advisory routes from setup control center` case if local mock/dev browser verification is allowed.
