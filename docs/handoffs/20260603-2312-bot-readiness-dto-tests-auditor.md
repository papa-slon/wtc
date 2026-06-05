# bot-readiness-dto-tests-auditor handoff
## Scope
Phase 3.83 read-only tests audit for the shared bot readiness DTO/builder across dashboard, settings, setup, and cabinet.

Scope was limited to inspecting the current source/tests and recording exact acceptance coverage to add now. This auditor did not edit product code or test code, did not read/write `.env`, did not ping exchanges, did not start/stop/apply/retest any bot, did not tick/restart workers, and did not touch SSH/tmux/systemd/provider DB state.

No background agents were spawned from this auditor lane; none remained to close.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`
5. `tests/integration/bot-read-safety-static.test.ts`
6. `tests/integration/cabinet-pg9.test.ts`
7. `tests/e2e/bot-settings.spec.ts`
8. `tests/e2e/cabinet-pg9-mobile.spec.ts`
9. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
12. `apps/web/src/features/bots/BotReadinessMap.tsx`
13. `apps/web/src/features/bots/readiness.ts`
14. `apps/web/src/features/cabinet/loader.ts`
15. `apps/web/next-env.d.ts` status/path only

## Files changed
None - read-only audit. Required handoff only: docs/handoffs/20260603-2312-bot-readiness-dto-tests-auditor.md

## Findings
1. High - The shared builder exists but has no pure status/row matrix test yet. Evidence: `apps/web/src/features/bots/readiness.ts:58` maps access status, `apps/web/src/features/bots/readiness.ts:66` maps runtime status, `apps/web/src/features/bots/readiness.ts:73` maps statistics status, and `apps/web/src/features/bots/readiness.ts:139` builds the readiness row list. Current coverage only checks source strings around the map component and pages, not builder behavior: `tests/integration/bot-read-safety-static.test.ts:78`. Recommendation: add `tests/integration/bot-readiness-builder.test.ts` importing `buildBotReadinessItems`, `runtimeReadinessStatus`, `statisticsReadinessStatus`, and `providerPubIdSummary` directly from `../../apps/web/src/features/bots/readiness.ts`. Target part: pure readiness DTO/builder.
2. High - Static import/forbidden-string boundaries are stale for the new builder. Evidence: `apps/web/src/features/bots/BotReadinessMap.tsx:3` imports DTO types from `./readiness`, dashboard imports the builder at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:10`, and settings imports it at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:14`. Existing static coverage does not read `readiness.ts` (`tests/integration/bot-read-safety-static.test.ts:8`) and still asserts old inline dashboard/settings details such as `readState === ...` and `reasonLabel(...)` at `tests/integration/bot-read-safety-static.test.ts:81` and `tests/integration/bot-read-safety-static.test.ts:87`. Recommendation: update the static test to read `apps/web/src/features/bots/readiness.ts`, assert dashboard/settings/setup/cabinet import the shared builder once adopted, and forbid live-control/secret/provider imports in both the builder and presentational component. Target part: source safety and import boundaries.
3. High - Dashboard and settings are currently on the builder, but setup and cabinet are not yet accepted on the shared DTO path. Evidence: dashboard calls `buildBotReadinessItems` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:134`; settings calls it at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`; setup has no readiness import in its import block (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:1`) and still renders review rows inline at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:496`; cabinet still builds bot setup/activity labels in `gatherSignals` at `apps/web/src/features/cabinet/loader.ts:79`. Recommendation: either route setup-review and cabinet compact bot readiness through `buildBotReadinessItems({ surface: 'setup-review' | 'cabinet' })` or record a deliberate exception; acceptance should prefer shared DTO use. Target part: setup review and cabinet product cards.
4. High - Cabinet fail-closed coverage should be strengthened before cabinet consumes shared readiness. Evidence: loader gathers user data inside `gatherSignals` via `listExchangeKeys`/`loadBotConfig` at `apps/web/src/features/cabinet/loader.ts:83`, and `loadCabinet` gates `gatherSignals` on `decision.allowed` at `apps/web/src/features/cabinet/loader.ts:157`. Current test only regex-checks the ternary branch at `tests/integration/cabinet-pg9.test.ts:41`. Recommendation: extend `tests/integration/cabinet-pg9.test.ts` to assert no bot readiness/user-signal builder call, `listExchangeKeys`, or `loadBotConfig` can run for unallowed products; if cabinet gets a compact readiness DTO, assert it is created only from allowed-branch signals and absent/empty for fail-closed products. Target part: cabinet fail-closed data minimisation.
5. Medium - Dedicated dashboard readiness e2e is still missing for desktop and mobile. Evidence: Phase 3.82 explicitly left this as next action at `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md:108`; current e2e covers settings only at `tests/e2e/bot-settings.spec.ts:13` and cabinet/setup mobile at `tests/e2e/cabinet-pg9-mobile.spec.ts:13` and `tests/e2e/cabinet-pg9-mobile.spec.ts:31`. Recommendation: add `tests/e2e/bot-readiness-dashboard.spec.ts` that visits `/app/bots/tortila` and `/app/bots/legacy` under desktop and mobile projects, asserts readiness rows, asserts no horizontal scroll, asserts `Connection verified` count is zero, and saves screenshots with the project name. Target part: dashboard e2e acceptance.
6. Medium - The no-generated-`next-env.d.ts` requirement is not encoded in tests/gates. Evidence: `apps/web/next-env.d.ts` is the only discovered generated Next env file, and `git status --short -- apps/web/next-env.d.ts` returned no dirty entry during this audit. Recommendation: make acceptance run `git status --short -- apps/web/next-env.d.ts` and `git diff --exit-code -- apps/web/next-env.d.ts`; if the team wants it inside Vitest, add a small git-dependent generated-file churn test, but prefer a final gate because this is repository state, not app behavior. Target part: generated artifact discipline.

## Decisions
1. Treat `apps/web/src/features/bots/readiness.ts` as the canonical shared readiness DTO/builder target for this slice.
2. Keep `BotReadinessMap` presentational only; static tests should forbid data loaders, adapters, vault/sealed secret references, fetches, and live-control verbs in that component.
3. Add the pure builder matrix before relying on page/e2e coverage; e2e should prove rendering and responsiveness, not the full decision table.
4. Treat `next-env.d.ts` churn as an acceptance gate unless a git-dependent test is explicitly accepted.
5. No live exchange or bot-control proof belongs in this slice.

## Risks
1. The worktree was already heavily dirty before this auditor wrote the required handoff. Current dirty paths include the bot pages, cabinet loader, static tests, e2e specs, and untracked `BotReadinessMap.tsx`, `readiness.ts`, and `bot-settings.spec.ts`.
2. Product code changed during this audit: `readiness.ts` appeared and settings moved onto `buildBotReadinessItems` while inspection was in progress. Re-check the files immediately before implementing the tests.
3. Static regex tests match this repo's established pattern, but they should be kept focused to avoid brittle failures on harmless formatting.
4. Direct Vitest import from `apps/web/src/features/bots/readiness.ts` should remain pure/type-strip friendly; if a future edit adds server-only or Next runtime imports, the pure builder test should fail.

## Verification/tests
RUN:
1. Read required process docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
2. Read prior phase handoff: `docs/handoffs/20260603-2259-phase-3-82-bot-readiness-map.md`.
3. Inspected current tests and target source files listed in `## Files inspected`.
4. Checked git root/branch/status. Observed branch `codex/bot-analytics-settings-canary-20260603` with pre-existing dirty/untracked files.
5. Checked `apps/web/next-env.d.ts` path/status; no dirty entry was reported for that file.

NOT RUN:
1. `npm run test ...` - not run; read-only auditor with no product/test edits, and this handoff records tests to add next.
2. `npm run e2e ...` - not run; no dev server/browser gate was required for this read-only audit.
3. `npm run typecheck -w @wtc/web` - not run; no code was edited by this auditor.
4. Live exchange ping/test - not run by policy.
5. Live bot start/stop/apply-config/retest - not run by policy.
6. Worker tick/restart - not run by policy.
7. SSH/tmux/systemd/provider DB live read/write - not run by policy.
8. `.env` read/write - not run by policy.

## Next actions
1. Add `tests/integration/bot-readiness-builder.test.ts` with this exact matrix:
   - `runtimeReadinessStatus(null)` and `runtimeReadinessStatus(undefined)` return `readonly`.
   - Runtime `readState: 'ok', adapterMode: 'real'` returns `ready`.
   - Runtime `readState: 'ok', adapterMode: 'mock'` returns `attention`.
   - Runtime `readState: 'stale'` and `'not_configured'` return `attention`.
   - Runtime `readState: 'unreachable'` and `'malformed'` return `blocked`.
   - Statistics `null`/`undefined` return `readonly`.
   - Statistics `metricsAvailable: false, issueKind: 'blocked'` returns `blocked`.
   - Statistics `metricsAvailable: false` with `null`, `'not_ready'`, or `'error'` returns `attention`.
   - Statistics `metricsAvailable: true, issueKind: null` returns `ready`; `metricsAvailable: true` with any issue returns `attention`.
   - `providerPubIdSummary(0)`, `(1)`, and `(2)` produce `0 provider pub_ids mapped`, `1 provider pub_id mapped`, and `2 provider pub_ids mapped`.
   - Tortila builder with `exchangeKeyCount: 0` returns an `Exchange key` row with `attention`, `No key saved`, `Add key`, and `/setup?step=key`.
   - Tortila builder with `exchangeKeyCount: 1` returns `ready`, `WTC vault metadata saved`, `View keys`, and no text that claims `Connection verified`.
   - Legacy builder with `providerAccountCount: 0` returns a `Provider pub_id` row with `attention`; with `1` returns `ready`.
   - `accessReason: 'allowed'` returns `Access` `ready`; `grace` returns `attention`; every other access reason returns `blocked`.
   - `configSource: 'built_in'` makes the source row `attention`; `system_default` and `user_override` make it `ready`.
   - `surface: 'settings', includeOperationalRows: false` returns exactly `Access`, connection, `Settings source`, and `Live apply`.
   - `surface: 'dashboard'` returns exactly `Access`, connection, `Strategy source`, `Runtime snapshot`, `Statistics`, and `Live control`.
   - `surface: 'setup-review'` and `surface: 'cabinet'` have explicit row expectations before product code ships those surfaces.
2. Update `tests/integration/bot-read-safety-static.test.ts`:
   - Add `const readiness = read('apps/web/src/features/bots/readiness.ts');`.
   - Assert `BotReadinessMap.tsx` imports `type { BotReadinessItem, BotReadinessStatus } from './readiness'`.
   - Assert dashboard/settings/setup/cabinet use `buildBotReadinessItems` once those surfaces are adopted.
   - Assert pages do not define local `BotReadinessItem[]`, local `runtimeReadinessStatus`, local `statisticsStatus`, or local `providerPubIdSummary` outside `readiness.ts`.
   - Assert `readiness.ts` and `BotReadinessMap.tsx` do not contain `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `apiKey`, `apiSecret`, `sealed`, or `Connection verified`.
3. Update `tests/integration/cabinet-pg9.test.ts`:
   - Keep the existing `decision.allowed ? await gatherSignals` guard.
   - Add a guard that no unallowed branch can call `buildBotReadinessItems`, `listExchangeKeys`, or `loadBotConfig`.
   - If cabinet gets compact readiness rows, assert they are derived from the shared builder and absent/empty for denied products.
4. Add `tests/e2e/bot-readiness-dashboard.spec.ts`:
   - Login, visit `/app/bots/tortila`, assert the dashboard readiness map is visible, rows include `Access`, `Exchange key`, `Strategy source`, `Runtime snapshot`, `Statistics`, and `Live control`, assert `Connection verified` count is zero, assert no horizontal scroll, screenshot `bot-tortila-dashboard-readiness-${project}.png`.
   - Login, visit `/app/bots/legacy`, assert rows include `Access`, `Provider pub_id`, `Strategy source`, `Runtime snapshot`, `Statistics`, and `Live control`, assert no live-control/apply text beyond disabled policy copy, assert no horizontal scroll, screenshot `bot-legacy-dashboard-readiness-${project}.png`.
   - Let this run in both desktop and mobile Playwright projects; do not mobile-skip.
5. Final acceptance commands after implementation:
   - `npm run test -- tests/integration/bot-readiness-builder.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts`
   - `npm run e2e -- tests/e2e/bot-readiness-dashboard.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts`
   - `npm run typecheck -w @wtc/web`
   - `git status --short -- apps/web/next-env.d.ts`
   - `git diff --exit-code -- apps/web/next-env.d.ts`
