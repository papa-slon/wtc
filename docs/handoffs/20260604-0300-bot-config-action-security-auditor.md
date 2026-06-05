# bot-config-action-security-auditor handoff
## Scope
Phase 3.91 read-only audit of bot config server-action security/live-control boundaries. Inspected forbidden FormData/hidden-key handling, source validation between WTC reference config and Legacy/Tortila runtime evidence, audit metadata, exchange-key metadata-check boundaries, and separation from live apply/start/stop. No product code, tests, package files, migrations, env, vault, live services, SSH/tmux/systemd, provider DB, worker, exchange, or bot state was modified.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`
5. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
6. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
7. `apps/web/src/features/bots/config-action-handler.ts`
8. `apps/web/src/features/bots/config.ts`
9. `apps/web/src/features/bots/config-export-handler.ts`
10. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/meta.ts`
13. `packages/shared/src/schemas.ts`
14. `packages/bot-adapters/src/control.ts`
15. `packages/db/src/repositories.ts`
16. `packages/audit/src/audit.ts`
17. `apps/web/src/lib/demo.ts`
18. `docs/AUDIT_LOG_SCHEMA.md`
19. `tests/integration/bot-config-source-audit-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. The action boundary is now wired through a dependency-injected helper that rejects forbidden FormData keys, but the remaining acceptance gap is runtime coverage: no focused test imports and executes the helper/actions with hostile hidden keys. Evidence: settings actions delegate to `handleSaveBotConfigAction`, `handleApplyBotPresetAction`, and `handleUseSystemDefaultBotConfigAction` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:129`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:137`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:145`; setup actions do the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:136`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:144`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:152`; forbidden-key rejection is implemented at `apps/web/src/features/bots/config-action-handler.ts:85`, `apps/web/src/features/bots/config-action-handler.ts:156`, `apps/web/src/features/bots/config-action-handler.ts:183`, and `apps/web/src/features/bots/config-action-handler.ts:211`; existing source/audit coverage is string-static only at `tests/integration/bot-config-source-audit-static.test.ts:42`. Recommendation: add `tests/integration/bot-config-action-handler.test.ts` with mocked dependencies for save, preset, and use-system-default paths, asserting that hidden keys such as `apiSecret`, `providerPubId`, `rawJson`, `applyConfig`, `startBot`, and `stopBot` redirect to config error and never call persistence. Target part: forbidden FormData/hidden keys.
2. Severity: Medium. Legacy provider identity remains a source-schema ambiguity: `providerPubId` is allowed by the Legacy symbol schema while the web and DB safety guards forbid `providerpubid` in persisted user config. Current forms do not populate it, but future presets or runtime-derived objects could parse successfully first and then fail later at persistence as a server error instead of a controlled config rejection. Evidence: `providerPubId` is optional in `apps/web/src/features/bots/config.ts:72`; the web forbidden set rejects `providerpubid` at `apps/web/src/features/bots/config.ts:710`; the DB forbidden set rejects the same key at `packages/db/src/repositories.ts:520`; Legacy form builders intentionally omit provider identity at `apps/web/src/features/bots/config.ts:438` and `apps/web/src/features/bots/config.ts:489`; the display table can still read provider identity for runtime/display contexts at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:113`. Recommendation: split Legacy runtime/display row types from persistable user-config schemas, or remove `providerPubId` from the user-config schema and add an action-helper test that provider identity is rejected before persistence. Target part: source validation.
3. Severity: Info. Exchange-key metadata checks are hard-separated from exchange pings and are user-scoped. Evidence: the shared request schema accepts only `bot` and `exchangeAccountId` at `packages/shared/src/schemas.ts:37`; settings/setup metadata actions require Tortila, entitlement access, and redirect to metadata-only results at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:153` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:118`; the DB check selects only the user's account row and secret-row id, sets `checkKind: 'sealed_metadata_only'`, `livePing: false`, and writes `exchange_key.metadata_check` at `packages/db/src/repositories.ts:449`, `packages/db/src/repositories.ts:465`, `packages/db/src/repositories.ts:478`, and `packages/db/src/repositories.ts:487`; docs reserve `exchange_key.test` for a separately audited future ping at `docs/AUDIT_LOG_SCHEMA.md:177`. Recommendation: keep `exchange_key.test` unused by these actions and add any future real exchange connectivity test as a separate audited flow. Target part: exchange-key check boundaries.
4. Severity: Info. Bot config save audit metadata is version-only, and repository guards reject nested secret/provider/live-control keys before writing config rows. Evidence: the web persistence path calls `safeUserBotConfigForProduct` before DB writes at `apps/web/src/features/bots/config.ts:942`; the web forbidden set includes secret/provider/raw/live-control keys at `apps/web/src/features/bots/config.ts:696`; the DB forbidden set and recursive assertion are at `packages/db/src/repositories.ts:506` and `packages/db/src/repositories.ts:544`; `saveBotConfig` audits only `{ version }` before/after at `packages/db/src/repositories.ts:2173` and `packages/db/src/repositories.ts:2186`; the audit schema documents no raw config JSON for `bot.config.save` at `docs/AUDIT_LOG_SCHEMA.md:325`. Recommendation: keep audit payloads metadata-only and add a PGlite/action-helper negative test proving a hostile nested config aborts before `bot_configs`, `bot_config_versions`, and `audit_logs` writes. Target part: audit metadata.
5. Severity: Info. Live apply/start/stop remain separated from config actions. Evidence: settings/setup action dependencies point to config persistence and system-default selection, not adapter control, at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:71`; `saveBotConfig` is documented as WTC DB only and never forwarded to the live bot at `packages/db/src/repositories.ts:2173`; the adapter control gate throws unless both the feature flag and audit approval are true at `packages/bot-adapters/src/control.ts:1` and `packages/bot-adapters/src/control.ts:16`. Recommendation: keep start/stop/apply out of settings/setup server actions; any future control route must require a separate security and bot-integration audit. Target part: hard separation from live apply/start/stop.
6. Severity: Info. Export/runtime response safety remains aligned with the prior acceptance slice. Evidence: config export loads WTC `state.current` and returns no-store/nosniff/no-referrer attachment responses at `apps/web/src/features/bots/config-export-handler.ts:56` and `apps/web/src/features/bots/config-export-handler.ts:64`; runtime config sanitization strips secret/provider/raw URL/header/live-control keys recursively at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3` and `apps/web/src/features/bots/runtime-config-sanitizer.ts:43`. Recommendation: keep runtime snapshot data treated as untrusted display evidence and never as an implicit source for user config saves. Target part: runtime/export safety boundary.

## Decisions
1. Treated this as a per-agent read-only audit, not an implementation phase.
2. Did not modify product code, tests, package files, migrations, env, vault, worker, provider DB, live services, or bot state.
3. Included `apps/web/src/features/bots/config-action-handler.ts` because the current settings/setup pages import it and it is central to the action-security boundary.
4. Did not run Vitest or Playwright because the requested scope was read-only inspection and the only permitted write was this handoff.

## Risks
1. Without focused runtime tests, the new helper wiring can regress while the existing string-static test still passes.
2. The Legacy `providerPubId` schema ambiguity can confuse future code that reuses runtime/provider rows as user config input.
3. This audit observed current local files in a heavily dirty worktree; unrelated pre-existing changes were not reviewed or reverted.
4. Static inspection cannot prove transaction behavior under PGlite for hostile nested config writes.

## Verification/tests
RUN:
1. Read the required protocol docs and prior Phase 3.90 handoff before code inspection.
2. Static line-number inspection of settings/setup actions, config helper, config source/persistence code, export handler, runtime sanitizer, control gate, audit docs, and repository boundaries.
3. `rg` scans for config-action helper wiring and live-control/start/stop/apply references.
4. Confirmed `docs/handoffs/20260604-0300-bot-config-action-security-auditor.md` did not exist before writing.

NOT RUN:
1. Vitest, Playwright, typecheck, build, lint, secret scan, governance check - skipped because this was a read-only auditor pass and no product/test edits were allowed.
2. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, and systemd - forbidden by scope and non-negotiable gates.

## Next actions
1. Add focused runtime tests for `config-action-handler.ts` covering hidden forbidden keys on save, preset apply, and use-system-default for settings and setup route behavior.
2. Resolve the Legacy `providerPubId` source-schema ambiguity by splitting runtime/display identity from persistable user config, then test that provider identity cannot enter saved user config.
3. Add a PGlite negative test for nested forbidden config keys proving no bot config version or audit row is written on rejection.
4. Keep `exchange_key.metadata_check` metadata-only; implement any future exchange connectivity test only under a separate audited `exchange_key.test` flow.
