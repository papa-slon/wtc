# admin-global-provider-identity-tests-auditor handoff
## Scope
Read-only Phase 3.93 tests/security audit for coverage proving provider identity cannot enter admin/global system defaults or global config history while Legacy runtime display remains safe. Scope was limited to the requested files and focused gates. No product code, test code, live services, env, provider DB, worker, exchange, SSH, tmux, systemd, or bot state was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `tests/integration/admin-global-bot-config-db.test.ts`
4. `tests/integration/admin-global-bot-config-static.test.ts`
5. `tests/integration/bot-config-source-audit-static.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `tests/integration/bot-runtime-config-sanitizer.test.ts`
8. `packages/db/src/repositories.ts`
9. `apps/web/src/features/bots/config.ts`
10. `apps/web/src/features/bots/config-export.ts`
11. `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md`

## Files changed
This handoff only: `docs/handoffs/20260604-0340-admin-global-provider-identity-tests-auditor.md`

## Findings
1. Severity: High. Admin/global DB coverage now proves provider identity and raw runtime fields are rejected before both current system-default writes and version-history appends. Evidence: `tests/integration/admin-global-bot-config-db.test.ts:181` starts the repository-boundary rejection case; `tests/integration/admin-global-bot-config-db.test.ts:184` covers nested `symbolConfigs[].providerPubId`; `tests/integration/admin-global-bot-config-db.test.ts:185` covers nested `providerAccountId`; `tests/integration/admin-global-bot-config-db.test.ts:186` covers `providerAccounts`; `tests/integration/admin-global-bot-config-db.test.ts:187` and `tests/integration/admin-global-bot-config-db.test.ts:188` cover runtime provider containers; `tests/integration/admin-global-bot-config-db.test.ts:196` through `tests/integration/admin-global-bot-config-db.test.ts:220` assert config/version/audit counts are unchanged after rejection. Recommendation: keep this PGlite test in the Phase 3.93 acceptance gate. Target part: admin global config repository coverage.
2. Severity: High. The repository backstop is positioned before admin/global current-row and history writes. Evidence: `packages/db/src/repositories.ts:506` through `packages/db/src/repositories.ts:540` define the forbidden key set, including provider identity and raw/live-control keys; `packages/db/src/repositories.ts:546` through `packages/db/src/repositories.ts:557` recursively reject nested keys; `packages/db/src/repositories.ts:2088` through `packages/db/src/repositories.ts:2089` call the guard before the global config transaction writes `bot_global_configs` and `bot_global_config_versions` at `packages/db/src/repositories.ts:2111` through `packages/db/src/repositories.ts:2157`. Recommendation: keep any future admin/global save helper behind this same guard before transaction writes. Target part: `packages/db/src/repositories.ts`.
3. Severity: High. The Phase 3.92 follow-up to add global-default DB coverage for `symbolConfigs[].providerPubId` is satisfied in the scoped test set. Evidence: the Phase 3.92 handoff requested this at `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md:103` through `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md:104`; the current DB test covers it at `tests/integration/admin-global-bot-config-db.test.ts:184` and proves no history row is appended at `tests/integration/admin-global-bot-config-db.test.ts:196` through `tests/integration/admin-global-bot-config-db.test.ts:220`. Recommendation: close this specific Phase 3.92 test debt in the aggregate Phase 3.93 report. Target part: Phase 3.93 test debt tracking.
4. Severity: High. Persistable Legacy config remains split from runtime/display provider identity. Evidence: `apps/web/src/features/bots/config.ts:111` defines the persistable Legacy symbol schema without `providerPubId`, while `apps/web/src/features/bots/config.ts:113` through `apps/web/src/features/bots/config.ts:115` define the runtime-only schema extension; `tests/integration/bot-read-safety-static.test.ts:358` through `tests/integration/bot-read-safety-static.test.ts:364` statically assert this ordering and absence/presence split. Recommendation: keep editable user/global config on `legacySymbolConfigSchema`; use runtime schema only for read-only runtime snapshots. Target part: Legacy config schema boundary.
5. Severity: High. Runtime display remains safe while preserving only masked Legacy provider evidence in approved containers. Evidence: `apps/web/src/features/bots/runtime-config-sanitizer.ts:58` through `apps/web/src/features/bots/runtime-config-sanitizer.ts:69` limit provider masking to Legacy `providerAccounts`, `symbolConfigs`, `activeSlots`, and `activeOrderSummary`; `apps/web/src/features/bots/runtime-config-sanitizer.ts:77` through `apps/web/src/features/bots/runtime-config-sanitizer.ts:87` mask allowed identity values and drop forbidden keys; `tests/integration/bot-runtime-config-sanitizer.test.ts:49` through `tests/integration/bot-runtime-config-sanitizer.test.ts:84` prove full provider IDs, provider account IDs, secrets, URLs, headers, raw JSON, and live-control markers do not survive the safe view. Recommendation: treat masked provider identity as display-only evidence, never as config input. Target part: runtime config sanitizer.
6. Severity: Medium. Export shaping remains safe for runtime-shaped Legacy input, but the scoped gate only ran `config-export.ts` source inspection, not the export route-handler suite. Evidence: `apps/web/src/features/bots/config-export.ts:249` through `apps/web/src/features/bots/config-export.ts:255` parse possible runtime rows and delete `providerPubId`; `apps/web/src/features/bots/config-export.ts:302` through `apps/web/src/features/bots/config-export.ts:305` label the output as safe config with no exchange keys or live apply token. Recommendation: run the existing export route-handler tests in the aggregate phase if export acceptance is claimed beyond this tests/security lane. Target part: bot config export acceptance.

## Decisions
1. The focused Phase 3.93 provider-identity tests/security verdict is PASS for admin/global system-default and config-history coverage.
2. No broad/major operator phase was run by this auditor lane, so no background agents were spawned and no N-agent audit claim is made.
3. No full-platform green status is claimed because broad gates and live/prohibited gates were not run.

## Risks
1. Historical production/provider DB rows were not scanned; the audit only proves the current repository guard and focused tests.
2. Several guardrail tests are static string checks, so they are useful tripwires but weaker than runtime or DB-path tests.
3. The sanitizer test name says it strips provider keys while the intended behavior is to preserve masked Legacy provider identity in approved runtime display containers; this is not a behavior blocker, but a future rename would reduce ambiguity.

## Verification/tests
RUN:
1. Protocol/read-only scope check: `AGENTS.md` and `docs/SESSION_PROTOCOL.md` inspected.
2. Scoped code/test inspection: all requested files listed above inspected.
3. `npx vitest run tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/bot-config-source-audit-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 5 files / 39 tests.

NOT RUN:
1. Full `npm test` - skipped; outside the focused read-only auditor scope.
2. `npm run typecheck`, `npm run lint`, `npm run build` - skipped; no product code changes and not required for this focused coverage verdict.
3. `npm run secret:scan` and `npm run governance:check` - skipped; not requested for this single-lane audit and no secret/env files were inspected.
4. Playwright/e2e/preview/browser screenshots - skipped; no visual acceptance claimed.
5. Worker tick/restart/smoke, live bot start/stop/apply-config/retest, provider DB, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - NOT RUN because forbidden by the user scope and protocol.

## Next actions
1. In the aggregate Phase 3.93 handoff, mark the Phase 3.92 next action for global-default `symbolConfigs[].providerPubId` DB coverage as closed.
2. If export safety is part of the aggregate acceptance claim, add or run the export route-handler suite alongside this focused gate.
3. In a later cleanup, rename the runtime sanitizer test description to say "masks allowed Legacy provider display identity" instead of implying all provider identity is stripped.
4. When a safe disposable production-like DB snapshot exists, run a historical saved-config scan for provider identity markers before claiming old data is clean.
