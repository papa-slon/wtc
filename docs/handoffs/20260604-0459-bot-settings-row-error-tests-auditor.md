# bot-settings-row-error-tests-auditor handoff
## Scope
Read-only Phase 3.96 tests/rendered audit for focused row-targeted bot config save-error coverage in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

The audit inspected existing bot settings e2e, bot config action/static/sanitizer integration tests, and Playwright config. It did not edit product code, tests, package files, generated artifacts, live services, env files, vaults, SSH, tmux, systemd, provider DBs, exchange endpoints, worker tick/restart, or bot start/stop/apply/retest paths.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
8. `tests/e2e/bot-settings.spec.ts`
9. `tests/integration/bot-config-action-handler.test.ts`
10. `tests/integration/bot-config-review-static.test.ts`
11. `tests/integration/bot-read-safety-static.test.ts`
12. `tests/integration/bot-runtime-config-sanitizer.test.ts`
13. `playwright.config.ts`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
18. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`

## Files changed
None — read-only audit.

## Findings
1. Severity: High. Current rendered coverage proves only the generic config-error banner, not row-targeted save-error behavior. Evidence: `tests/e2e/bot-settings.spec.ts:33` to `tests/e2e/bot-settings.spec.ts:35` opens `/app/bots/tortila/settings?err=config` directly and asserts `Configuration was not saved` plus generic range text; the actual settings page renders only that generic `RiskWarningBanner` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:257` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`. Recommendation: add submitted-form e2e cases, not just a direct query-param visit. Tortila expected assertions: fill `input[name="risk_0"]` with `9`, click `Save custom settings`, expect URL `/app/bots/tortila/settings?err=config`, the generic banner, a row-scoped message containing `Tortila coin 1`, the row/field context for `Risk %`, no `Connection verified`, and no horizontal scroll. Legacy expected assertions: open the first `Position sizing, averaging ladder, delay/delta filters` details block, set `input[name="legacy_levels_0"]` to `4` while the three-item drop/volume ladders remain unchanged, click `Save custom settings`, expect URL `/app/bots/legacy/settings?err=config`, the generic banner, a row-scoped message containing `Legacy coin 1` and `Drop count must match averaging levels.`, no live-control copy, and no horizontal scroll. Target part: `tests/e2e/bot-settings.spec.ts`.
2. Severity: High. The importable action helper has an early `formIssues` redirect branch that is not directly runtime-tested. Evidence: `apps/web/src/features/bots/config-action-handler.ts:154` to `apps/web/src/features/bots/config-action-handler.ts:162` resolves context, rejects forbidden fields, calls `deps.formIssues`, and redirects to `routes.configError` before parsing/persistence when issues exist. Existing tests cover valid save calls at `tests/integration/bot-config-action-handler.test.ts:119` to `tests/integration/bot-config-action-handler.test.ts:128`, forbidden hidden fields at `tests/integration/bot-config-action-handler.test.ts:143` to `tests/integration/bot-config-action-handler.test.ts:155`, and parse failure at `tests/integration/bot-config-action-handler.test.ts:158` to `tests/integration/bot-config-action-handler.test.ts:162`, but not a non-empty `formIssues` result. Recommendation: add a focused helper test where `formIssues` returns `['Tortila coin 1: Number must be less than or equal to 3.']`; assert `{ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=config', revalidatePaths: [] }`, and assert `configFromForm`, `parseConfig`, and `persistConfig` were not called. Target part: `tests/integration/bot-config-action-handler.test.ts`.
3. Severity: High. The parser already emits row-numbered messages for the needed assertions, so the next unit gate should pin those messages before the UI work. Evidence: `apps/web/src/features/bots/config.ts:413` to `apps/web/src/features/bots/config.ts:438` loops Tortila row fields and emits `Tortila coin ${i + 1}: ...`, then duplicate coin messages; `apps/web/src/features/bots/config.ts:441` to `apps/web/src/features/bots/config.ts:489` does the same for Legacy coin rows and Legacy stage rows. Recommendation: add direct `botConfigFormIssues` assertions for (a) Tortila row 1 out-of-range `risk_0=9` starts with `Tortila coin 1:`, (b) duplicate Tortila custom symbols include `Tortila coin "XRP/USDT:USDT" is duplicated.`, (c) Legacy row 1 `legacy_levels_0=4` with unchanged `legacy_drops_0='3,12,35'` and `legacy_volumes_0='4,6,12'` includes `Legacy coin 1: Drop count must match averaging levels. Volume count must match averaging levels.`, and (d) duplicate Legacy stage slots include `Legacy stage "1" is duplicated.` Target part: parser/runtime test coverage.
4. Severity: Medium. Static tests currently prove wiring and safe copy, but not row-error rendering or field-level targeting. Evidence: `tests/integration/bot-read-safety-static.test.ts:278` to `tests/integration/bot-read-safety-static.test.ts:292` checks that settings/setup call `botConfigFormIssues`, route to `err=config`, and contain `Configuration was not saved`; `tests/integration/bot-config-review-static.test.ts:78` to `tests/integration/bot-config-review-static.test.ts:90` checks table field/capacity copy; `tests/integration/bot-runtime-config-sanitizer.test.ts:4` to `tests/integration/bot-runtime-config-sanitizer.test.ts:25` lists unsafe markers that must not leak. Recommendation: after row-error UI is added, extend static coverage to require stable row anchors/error regions on both tables and to prove any serialized row-error payload excludes provider IDs, raw runtime JSON, URLs/headers, and live-control keys. Target part: static guardrails around row-error UI.
5. Severity: Medium. The row editors have stable `name=` selectors for focused browser tests, but no row-error anchor exists yet. Evidence: Tortila row controls are named `symbol_${i}`, `symbol_custom_${i}`, `risk_${i}`, `stop_${i}`, `maxUnits_${i}`, and related fields at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:105` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:152`; Legacy row/stage controls are named `legacy_symbol_${i}`, `legacy_levels_${i}`, `legacy_drops_${i}`, `legacy_stage_slot_${i}`, `legacy_stage_rsi_${i}`, and `legacy_stage_cci_${i}` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:161` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:291` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:331` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:334`. Recommendation: if implementation changes are made, add row-level `role="alert"` or `aria-describedby` wiring tied to these rows so Playwright can assert real row targeting instead of brittle global text. Target part: rendered UX testability/accessibility.
6. Severity: Medium. Generated `.next-e2e` cleanup is recommended before the rendered Playwright gate, but not before the Vitest/static gate. Evidence: `playwright.config.ts:27` to `playwright.config.ts:35` starts a dev server with `reuseExistingServer: false` and `NEXT_DIST_DIR: '.next-e2e'`; current workspace inspection found `apps/web/.next-e2e` already present with a recent write time. Phase 3.95 also recorded stale rendered contamination as a previous failure mode. Recommendation: the next runner should remove only `apps/web/.next-e2e` before the focused Playwright command; this auditor did not delete it. Target part: generated artifact hygiene.

## Decisions
1. The focused acceptance should be two-layered: a fast Vitest/parser/action gate for row-specific errors and no-persist behavior, then one rendered Playwright file for browser submission and row context.
2. No Playwright, Vitest, cleanup, or package/script edits were run in this audit because the task was read-only and explicitly said not to run Playwright.
3. The existing `tests/e2e/bot-settings.spec.ts` is the right rendered home because it already covers Tortila settings, Legacy settings, setup, admin defaults, screenshots, and no horizontal scroll.
4. `tests/integration/bot-config-action-handler.test.ts` is the right fast runtime home for the helper no-persist branch and direct parser assertions; a new tiny `tests/integration/bot-config-form-issues.test.ts` would also be acceptable if the implementer wants to keep parser assertions separated.
5. `.next-e2e` cleanup should be a pre-step only for the Playwright gate. It is unnecessary for `npx vitest run ...`.

## Risks
1. The proposed row-message e2e assertions will initially fail unless implementation work carries row issues across the server-action redirect and renders them near the originating row.
2. Zod default range wording can drift by dependency version. Prefer exact custom messages for Legacy ladder count and duplicate messages; for numeric range errors, assert row prefix plus stable field/range copy rather than overfitting every Zod word.
3. In-memory demo mode is sufficient for invalid submit tests, but it is not a DB persistence proof. Do not assert version-history mutations in the focused rendered gate.
4. The worktree was already heavily dirty; this audit preserved all pre-existing changes and did not revert or clean anything.

## Verification/tests
RUN:
1. Read required WTC protocol/status docs and Phase 3.95 handoff before the audit.
2. Inspected the requested test files and Playwright config.
3. Inspected narrowly relevant settings/action/parser/table sources to identify exact row selectors and assertion targets.
4. Observed workspace state with `git status --short --branch`; branch was `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files.
5. Observed `apps/web/.next-e2e` exists; no generated artifacts were deleted.

NOT RUN:
1. Playwright - explicitly forbidden by scope.
2. Vitest - not needed for this read-only audit; recommended commands are below.
3. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, full e2e, secret scan, governance check, DB migrate/seed, provider checks, worker tick/restart, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, and live server checks - outside scope or forbidden.

## Next actions
1. Add focused helper/parser assertions:

```powershell
npx vitest run tests/integration/bot-config-action-handler.test.ts
```

Expected assertions to add:
- `handleSaveBotConfigAction` with non-empty `formIssues` redirects to `/app/bots/tortila/settings?err=config`.
- `configFromForm`, `parseConfig`, and `persistConfig` are not called when `formIssues` is non-empty.
- `botConfigFormIssues('tortila_bot', formData)` returns row-prefixed Tortila errors and duplicate coin errors.
- `botConfigFormIssues('legacy_bot', formData)` returns row-prefixed Legacy ladder-count errors and duplicate stage errors.

2. Run the focused static/sanitizer companion gate after row-error UI changes:

```powershell
npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts
```

Expected result: all four files pass. Add static assertions only for stable implementation details: row-error anchors/alerts, settings wiring, and no unsafe provider/raw/live-control markers in any error payload.

3. Clean generated e2e output, then run the focused rendered gate after e2e row-submit tests are added:

```powershell
if (Test-Path 'apps\web\.next-e2e') { Remove-Item -LiteralPath 'apps\web\.next-e2e' -Recurse -Force }
$env:E2E_PORT='3426'
npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line
Remove-Item Env:E2E_PORT
```

Expected result after adding two row-error e2e cases: `10 passed` (`5` tests across `desktop` and `mobile`) with no retries, no horizontal scroll, and screenshots retained only by the existing test behavior. Before those two cases are added, the same file currently represents only the existing `6 passed` baseline and does not prove row-targeted save errors.
