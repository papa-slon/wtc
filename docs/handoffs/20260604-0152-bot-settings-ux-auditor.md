# bot-settings-ux-auditor handoff
## Scope
Read-only UX/settings audit for user-facing bot settings/setup flows for Legacy and Tortila. Focus areas: default vs custom source clarity, coin/symbol selection, RSI/CCI/stage understandability, source/effective config explanation, admin vs user boundaries, and premium terminal-first operator understandability. No live bots, worker ticks, provider DB, `.env`, SSH, tmux, systemd, start/stop/apply/retest, or live exchange/provider checks were run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
13. `apps/web/src/features/bots/config-types.ts`
14. `apps/web/src/features/bots/readiness.ts`
15. `apps/web/src/features/bots/readiness-loader.ts`
16. `apps/web/src/features/bots/BotReadinessMap.tsx`
17. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
18. `tests/e2e/bot-settings.spec.ts`
19. `tests/integration/bot-config-export-static.test.ts`
20. `tests/integration/user-resolved-bot-config-static.test.ts`
21. `tests/integration/user-resolved-bot-config-db.test.ts`
22. `tests/integration/bot-readiness-builder.test.ts`
23. `tests/integration/bot-readiness-server-dto-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Legacy symbol selection cannot represent an intentionally blank new row and cannot add an arbitrary new Legacy coin. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:10` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:23` hard-code the base symbol list; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:81` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:83` derive options only from current rows plus that list; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:110` renders at least six rows; `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:139` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:142` default empty rows to the first option with no empty/manual override; `apps/web/src/features/bots/config.ts:478` to `apps/web/src/features/bots/config.ts:509` treats every non-empty submitted `legacy_symbol_*` as a real row. Recommendation: add a blank "Add coin..." option plus manual/searchable symbol override for Legacy, and make the parser ignore intentionally empty rows; add duplicate and blank-row regression coverage. Target part: Legacy coin/symbol setup UX.
2. Severity: High. Tortila setup review can be reached with an exchange key but no saved strategy config even though the page says saving settings is the finish requirement. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:197` defines `hasConfig` as `cfg.source !== 'built_in'`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:226` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:230` lock review for Tortila only on missing keys; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:274` says "Save custom settings first" when no config exists; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:491` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:503` still allows the review card to show "not yet saved" and "Open the dashboard". Recommendation: either require both key metadata and a non-built-in config before review, or explicitly make built-in fallback an allowed finish state and update copy/readiness consistently. Target part: Tortila setup wizard gate.
3. Severity: Medium. Effective source and version history are mixed, which can confuse system default vs custom state. Evidence: `apps/web/src/features/bots/config.ts:928` to `apps/web/src/features/bots/config.ts:935` can return `source: 'system_default'` while carrying `version: cfg?.version`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:215` renders that version as the top pill or "unconfigured"; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:357` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:358` also presents `user stream v${state.version}` next to the resolved source. Recommendation: split "resolved effective config" from "latest saved custom history" in labels and status pills; when system default is active, show the system default version as active and any user version as inactive history. Target part: default/custom/effective config explanation.
4. Severity: Medium. Validation produces detailed row issues server-side, but the UX discards them and shows only a generic banner. Evidence: `apps/web/src/features/bots/config.ts:401` to `apps/web/src/features/bots/config.ts:475` build specific duplicate/out-of-range/RSI-CCI/stage messages; settings actions redirect only to `?err=config` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:96` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:99`; the settings banner is generic at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:235` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:240`; setup repeats the same pattern at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:104` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:107` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:424` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:425`. Recommendation: surface row/field-specific issue text through a safe flash/action-state mechanism and preserve attempted values, especially for Legacy RSI/CCI exclusivity and stage capacity errors. Target part: settings/setup form error UX.
5. Severity: Medium. Tortila runtime export preview reads as "exact" but is generated from the saved `rows` prop, not from unsaved form edits. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:51` computes `exportValue` from `rows`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:105` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:152` render uncontrolled inputs for edits; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:164` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:176` labels the preview as generated/exact; the submitted form parser uses the live form values at `apps/web/src/features/bots/config.ts:553` to `apps/web/src/features/bots/config.ts:573`. Recommendation: rename it to "current saved export preview" or make the table client-side so preview updates as the user edits symbols/risk/TP. Target part: Tortila effective config preview.
6. Severity: Medium. Exchange-key readiness uses a green `ready` state for vault metadata even though no exchange ping has run, which can still look like connection readiness in a compact map. Evidence: `apps/web/src/features/bots/readiness.ts:97` to `apps/web/src/features/bots/readiness.ts:109` maps `vault_metadata_confirmed` to `ready` while saying live ping is not run; `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:70` to `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:73` says "readiness check passed" for metadata only; `tests/integration/bot-readiness-builder.test.ts:75` to `tests/integration/bot-readiness-builder.test.ts:85` locks this green state. Recommendation: distinguish "metadata ready" from "exchange connectivity ready" in status label/tone, or keep the row `attention`/`readonly` until an audited read-only exchange ping exists. Target part: Tortila readiness understandability.
7. Severity: Medium. Current acceptance coverage checks rendering, strings, and screenshots, but not the risky setup/form interactions above. Evidence: `tests/e2e/bot-settings.spec.ts:13` to `tests/e2e/bot-settings.spec.ts:45` covers settings page presence, no horizontal scroll, generic config error, and screenshots only; `tests/integration/user-resolved-bot-config-static.test.ts:32` to `tests/integration/user-resolved-bot-config-static.test.ts:60` asserts source-control strings/access order statically; `tests/integration/bot-readiness-server-dto-static.test.ts:50` to `tests/integration/bot-readiness-server-dto-static.test.ts:63` checks DTO wiring statically. Recommendation: add focused Playwright coverage for `/setup?step=key|strategy|review`, Legacy blank/custom coin rows, Tortila no-config review gating, system-default/custom transitions, and inline validation messages. Target part: bot settings/setup regression suite.

## Decisions
1. Source boundaries are directionally sound: settings/setup load after entitlement checks and use CSRF-protected server actions for saves.
2. User config and admin-published defaults are modeled as separate sources; the remaining UX issue is presentation clarity, not a missing server-side concept.
3. Runtime/provider evidence is kept read-only in the inspected user surfaces; no inspected settings/setup code path starts/stops/applies/retests a bot.
4. Legacy RSI/CCI and stage concepts are present in the UI, but the next pass should prioritize error visibility and symbol-row ergonomics before adding more controls.

## Risks
1. The worktree was already heavily dirty, including the settings/setup files audited here; findings are against the current local working tree state, not a clean commit.
2. No browser was launched in this audit, so layout/visual conclusions are source/test based rather than fresh screenshot acceptance.
3. No live or provider-backed acceptance was run by design; this audit cannot prove production DB freshness, exchange connectivity, provider runtime correctness, or live bot safety.
4. Existing tests intentionally avoid live control, but that also means setup wizard progression and form-state semantics can regress without current e2e coverage.

## Verification/tests
RUN:
1. Required protocol/state docs were read or searched with line-numbered evidence: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`.
2. Read-only workspace state check: `git status --short --branch` showed branch `codex/bot-analytics-settings-canary-20260603` and a heavily dirty worktree with in-scope files already modified before this audit.
3. Source inspection with line-numbered evidence for the two user pages, config model, Legacy/Tortila tables, readiness DTO/builder, exchange-key readiness, and focused e2e/integration tests.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker ticks/smoke, provider DB reads/writes, `.env`, vault/secrets, SSH, tmux, and systemd - forbidden by this audit scope and safety rules.
2. Playwright/browser screenshots - skipped because this was a read-only source UX audit and the existing spec already writes screenshots when run.
3. Vitest/typecheck/lint/build/full gates - skipped to avoid turning the read-only auditor lane into an implementation/acceptance lane; no product code was changed.
4. Secret scan - not run; this audit did not inspect or generate secrets and did not modify product paths.

## Next actions
1. Fix Legacy symbol-row behavior first: blank row support, custom symbol override/search, duplicate guidance, and parser/test coverage.
2. Decide whether Tortila built-in defaults are an acceptable finish state; then align setup review locking, finish requirement copy, and tests.
3. Split effective config source from saved user history in the settings/setup UI, especially when admin system defaults are active or user overrides are locked.
4. Add row-level validation display for RSI/CCI, stage capacity, duplicates, and numeric bounds.
5. Add focused Playwright coverage for setup wizard progression and form interactions before the next aggregate phase calls this UX green.
