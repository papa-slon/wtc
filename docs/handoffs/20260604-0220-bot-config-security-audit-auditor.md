# bot-config-security-audit-auditor handoff
## Scope
Phase 3.89 read-only security/audit review of bot settings audit taxonomy, secret handling, exchange-key readiness audit payloads, and live-control wording. Inspected the audit schema, `@wtc/audit`, `@wtc/db` bot/exchange repositories, bot settings/setup/admin defaults surfaces, config export, and focused static/DB guard tests. No live bot start/stop/apply-config/retest, exchange ping, provider DB access, worker tick/restart, `.env`, vault secret inspection, SSH, tmux, systemd, or live/prohibited path was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
8. `docs/AUDIT_LOG_SCHEMA.md`
9. `packages/audit/src/audit.ts`
10. `packages/audit/src/redact.ts`
11. `packages/audit/src/audit.test.ts`
12. `packages/audit/src/redact.test.ts`
13. `packages/db/src/schema.ts`
14. `packages/db/src/repositories.ts`
15. `apps/web/src/lib/db-store.ts`
16. `apps/web/src/lib/demo.ts`
17. `apps/web/src/features/bots/config.ts`
18. `apps/web/src/features/bots/config-review.ts`
19. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
20. `apps/web/src/features/bots/readiness-loader.ts`
21. `apps/web/src/features/admin/actions.ts`
22. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
23. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
24. `apps/web/src/app/admin/bots/config/page.tsx`
25. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
26. `tests/integration/bot-config-source-audit-static.test.ts`
27. `tests/integration/db-0002.test.ts`
28. `tests/integration/db-persistence.test.ts`
29. `tests/integration/admin-global-bot-config-db.test.ts`
30. `tests/integration/admin-global-bot-config-static.test.ts`
31. `tests/integration/bot-read-safety-static.test.ts`
32. `tests/integration/bot-readiness-server-dto-static.test.ts`
33. `tests/integration/user-resolved-bot-config-db.test.ts`
34. `tests/integration/user-resolved-bot-config-static.test.ts`
35. `tests/integration/bot-config-review-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. `saveBotGlobalConfig` still relies on the web admin action for forbidden secret/provider/live-control key rejection, while the repository itself accepts `config: Record<string, unknown>` and writes it to both current and version history rows. Evidence: `packages/db/src/repositories.ts:2070` defines `saveBotGlobalConfig`, `packages/db/src/repositories.ts:2079` accepts raw `input.config`, `packages/db/src/repositories.ts:2115` updates `bot_global_configs.config`, `packages/db/src/repositories.ts:2133` inserts `bot_global_configs.config`, and `packages/db/src/repositories.ts:2151` writes `bot_global_config_versions.configJson`; the only repository-level `assertNoForbiddenBotConfigKeys(input.config)` hit is in user `saveBotConfig` at `packages/db/src/repositories.ts:2175`. The web action does guard form/config payloads at `apps/web/src/features/admin/actions.ts:496` and `apps/web/src/features/admin/actions.ts:522`, but that is above the package boundary. Recommendation: call the shared forbidden-key guard at the start of `saveBotGlobalConfig` before opening the transaction, and add a PGlite regression that direct repository calls with `apiKey`, `providerAccounts`/`providerAccountId`, `rawJson`, `legacyDatabaseUrl`, `applyConfig`, `startBot`, or `stopBot` reject without writing current/history rows. Target part: `packages/db` admin global bot config repository.
2. Severity: Medium. `bot.config.save` audit target taxonomy is inconsistent between docs and implementation. Evidence: the repository writes `action: 'bot.config.save'` with `targetType: 'bot_instance'` and `targetId: input.botInstanceId` at `packages/db/src/repositories.ts:2185`, while the schema example shows `"target_type": "bot_config"` and `"target_id": "bc-version002"` at `docs/AUDIT_LOG_SCHEMA.md:422` and `docs/AUDIT_LOG_SCHEMA.md:423`. Recommendation: choose the canonical target identity for config saves, then align docs, tests, and code. If audit drilldown needs immutable-version precision, return the inserted `bot_config_versions.id` and target `bot_config_version`; otherwise update the schema example to `bot_instance` and state that version lives only in before/after. Target part: audit taxonomy for bot config saves.
3. Severity: Low. First-save `bot.config.save` before-version semantics are implemented but not explicitly documented. Evidence: docs require `before = { version }`, `after = { version }` at `docs/AUDIT_LOG_SCHEMA.md:325`, while implementation emits `before: { version: cur?.version ?? null }` at `packages/db/src/repositories.ts:2185`. Recommendation: document initial-save `before.version = null` or change the repository to use `0` consistently; add an assertion for the first-save row, not only the v1-to-v2 row. Target part: audit schema clarity and focused DB tests.
4. Severity: Info. The previous `exchange_key.test` wording debt appears closed for the metadata-only readiness path. Evidence: docs split `exchange_key.metadata_check` from reserved future `exchange_key.test` at `docs/AUDIT_LOG_SCHEMA.md:177` and `docs/AUDIT_LOG_SCHEMA.md:178`; `AUDIT_ACTIONS` includes both at `packages/audit/src/audit.ts:44` and `packages/audit/src/audit.ts:45`; the repository writes `exchange_key.metadata_check` at `packages/db/src/repositories.ts:487`; the payload is bounded to `checkKind`, `livePing:false`, outcome/reason/exchange/mode/keyMask/checkedAt at `packages/db/src/repositories.ts:490`; and the UI states no live exchange ping was run at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:69` through `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:74`. Recommendation: keep `exchange_key.test` unused until a separately audited read-only exchange ping adapter exists. Target part: exchange-key readiness audit taxonomy.
5. Severity: Info. User bot config save/load now has layered validation and no raw config in `bot.config.save` audit. Evidence: forbidden config keys include secret/provider/raw/live-control markers at `packages/db/src/repositories.ts:506` through `packages/db/src/repositories.ts:538`; user `saveBotConfig` rejects them before transaction at `packages/db/src/repositories.ts:2175`; `bot.config.save` only writes version metadata at `packages/db/src/repositories.ts:2185`; web user saves parse product schemas before persistence at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` through `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:106` through `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:112`; and saved user overrides are re-parsed on load at `apps/web/src/features/bots/config.ts:1004` through `apps/web/src/features/bots/config.ts:1027`. Recommendation: keep the repository-level guard as the source of last resort and add runtime tests for invalid-row fallback/sourceIssue if not already planned. Target part: user bot config save/load boundary.
6. Severity: Info. I did not find plaintext exchange secrets, provider raw snapshots, or live-control leakage in the scoped bot settings/readiness/export surfaces. Evidence: `listExchangeKeys` never joins secret rows at `packages/db/src/repositories.ts:404` through `packages/db/src/repositories.ts:407`; the metadata check selects only secret-row id metadata at `packages/db/src/repositories.ts:465` through `packages/db/src/repositories.ts:470`; config export uses `state.current` and `cache-control: no-store` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23` through `apps/web/src/app/api/bots/[bot]/config-export/route.ts:29`; Legacy export deletes `providerPubId` at `apps/web/src/features/bots/config.ts:654` through `apps/web/src/features/bots/config.ts:660`; settings state "no live apply, start, stop, or retest" at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:277` through `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:282`; setup states encrypted save only/live ping disabled at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:270` through `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:285`; and readiness UI marks live bot control disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:105` through `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:110`. Recommendation: preserve this wording until real adapters pass bot-integration and security gates. Target part: bot settings UX/security boundary.

## Decisions
1. Treated `exchange_key.metadata_check` as the correct action for WTC vault metadata ownership checks; `exchange_key.test` remains reserved for a future audited exchange ping.
2. Treated raw provider snapshot storage in bot metric/trade tables as outside this finding unless it is copied into settings saves, exports, readiness audit payloads, or live-control wording.
3. Treated the handoff write as the only allowed write for this read-only auditor role.

## Risks
1. The worktree was already heavily dirty on branch `codex/bot-analytics-settings-canary-20260603`; this audit reviewed current file contents and did not separate all pre-existing changes by author.
2. Because no tests were run in this read-only auditor pass, findings are line-inspection based. Existing tests indicate coverage for user `saveBotConfig`, exchange metadata checks, and static taxonomy guards, but not a direct repository-level rejection test for `saveBotGlobalConfig`.
3. The admin web action blocks unsafe global-default form/config keys today, but package-boundary safety should not depend on every future caller remembering to duplicate that guard.

## Verification/tests
RUN:
1. Required docs/protocol read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`.
2. Static source inspection with line evidence across `docs/AUDIT_LOG_SCHEMA.md`, `packages/audit`, `packages/db/src/repositories.ts`, bot settings/setup/admin defaults, config export, and focused tests.
3. Git/worktree status inspection before writing: branch `codex/bot-analytics-settings-canary-20260603`, many pre-existing modified/untracked Phase 3 files.

NOT RUN:
1. Vitest, Playwright, build, typecheck, lint, secret scan, governance, or full gate runner - not run because this was a read-only auditor slice focused on source inspection and a single handoff.
2. Live bot start/stop/apply-config/retest, exchange ping, provider DB read/write, worker tick/restart, `.env`, vault secret inspection, SSH, tmux, systemd, server/canary/prod checks - skipped by explicit scope and non-negotiable safety gates.

## Next actions
1. Add repository-level forbidden-key rejection to `saveBotGlobalConfig` and a PGlite regression proving unsafe direct package calls do not write current/history rows.
2. Reconcile `bot.config.save` audit target taxonomy (`bot_instance` vs `bot_config`/version id) in `docs/AUDIT_LOG_SCHEMA.md`, repository code, and focused tests.
3. Document first-save `before.version` semantics for `bot.config.save` and add a first-save audit row assertion.
4. Keep `exchange_key.metadata_check` as metadata-only; do not emit `exchange_key.test` until a separately audited read-only exchange ping adapter exists.
