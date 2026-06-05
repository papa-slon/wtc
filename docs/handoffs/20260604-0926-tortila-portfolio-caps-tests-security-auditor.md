# ecosystem-tests-runner handoff
## Scope
Phase 4.08 read-only tests/security audit for embedding top-level Tortila portfolio caps into the Tortila strategy map.

Goal: inspect the current Tortila settings/setup tests and recommend focused gates that prove max open symbols, total units, directional unit cap, drawdown halt, daily loss halt, and entry throttle become part of the strategy-map review without becoming live-control, exchange-ping, provider-read, secret, or runtime-authority surfaces.

Out of scope: product-code edits, test-code edits, docs edits beyond this handoff, live servers, env files, secret values, DB reads/writes, provider/API exchange actions, worker tick, live bot start/stop/apply/test/retest, deploy/canary checks, broad CI, and unrelated dirty worktree cleanup.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/STATUS.md`
4. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`
5. `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`
6. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
7. `apps/web/src/features/bots/config.ts`
8. `apps/web/src/features/bots/config-review.ts`
9. `apps/web/src/features/bots/config-action-handler.ts`
10. `apps/web/src/features/bots/config-error-copy.ts`
11. `apps/web/src/features/bots/config-export.ts`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/app/admin/bots/config/page.tsx`
15. `tests/e2e/bot-settings.spec.ts`
16. `tests/integration/bot-config-review-static.test.ts`
17. `tests/integration/bot-read-safety-static.test.ts`
18. `tests/integration/bot-config-action-handler.test.ts`
19. `tests/integration/bot-config-export-route-handler.test.ts`
20. `tests/integration/admin-global-bot-config-static.test.ts`
21. `package.json`

## Files changed
None — read-only audit; this handoff file was written at `docs/handoffs/20260604-0926-tortila-portfolio-caps-tests-security-auditor.md`.

## Findings
1. Severity: High. Current rendered coverage proves the Phase 4.07 per-row strategy map, but not embedded top-level portfolio caps. Evidence: `tests/e2e/bot-settings.spec.ts:62` asserts the `Tortila strategy map` heading, `tests/e2e/bot-settings.spec.ts:65` asserts a coin candidate, and `tests/e2e/bot-settings.spec.ts:66-69` proves draft system/risk updates; no assertion touches `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, or `maxNewEntriesPerTick`. Recommendation: extend the desktop and mobile `bot-settings.spec.ts` Tortila settings/setup paths to edit those six top-level fields and assert the strategy map updates before submit with concrete cap text. Target part: rendered Tortila settings/setup gate.
2. Severity: High. The current table explicitly leaves portfolio caps outside the map, so an implementation can accidentally keep saved/default cap values stale while row drafts update live. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:215-258` renders the strategy map, but `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:255-257` says portfolio caps are edited in fields below; settings render the table before generic fields at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:542-581`, and setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:517-549`. Recommendation: add tests that distinguish saved caps from unsaved draft caps; the map should say draft/advisory and use the visible form values when the user edits cap inputs. Target part: draft-state correctness.
3. Severity: High. Static safety tests pin the current Tortila map strings and no-live boundary, but they do not yet pin cap embedding. Evidence: `tests/integration/bot-config-review-static.test.ts:220-239` checks Tortila table helper/string names through `Runtime export preview (draft)`, and `tests/integration/bot-read-safety-static.test.ts:394-419` checks the same surface plus `no live exchange apply`; neither asserts portfolio-cap helper names, labels, or forbidden-token boundaries inside the map. Recommendation: add focused static assertions for cap helper/interface names, all six cap labels, `draft preview`/`WTC reference` wording, and absence of `Connection verified`, `applyConfig`, `startBot`, `stopBot`, `testExchange`, provider IDs, raw runtime, URLs, and secret-shaped terms. Target part: static source/security gates.
4. Severity: High. Top-level Tortila cap validation and safe global error copy exist, but current rendered tests only cover a row-targeted Tortila save error. Evidence: top-level caps are constrained in `apps/web/src/features/bots/config.ts:63-68`, mapped to safe issue codes at `apps/web/src/features/bots/config.ts:467-481`, and copied safely at `apps/web/src/features/bots/config-error-copy.ts:141-146`; the current Tortila e2e invalid-save path only fills `risk_0` and expects `issue=tortila-row-risk` at `tests/e2e/bot-settings.spec.ts:124-143`. Recommendation: add focused invalid-cap acceptance for at least one portfolio limit, one risk halt, and the entry throttle; assert global banner copy, no row anchor, failed draft not saved/applied, and no unsafe live-control copy. Target part: validation/error routing.
5. Severity: Medium. `config-review.ts` already has a safe saved-config representation for these caps, but the static review test only checks broad structure. Evidence: `apps/web/src/features/bots/config-review.ts:113-118` reads all six cap fields, `apps/web/src/features/bots/config-review.ts:134` summarizes portfolio caps, and `apps/web/src/features/bots/config-review.ts:147-154` lists risk-limit rows; `tests/integration/bot-config-review-static.test.ts:29-33` only checks title, configured-coin count, `System mix`, section titles, and forbidden text. Recommendation: add exact assertions for `Portfolio caps`, `3 symbols`, `8 total units / 5 per side`, daily loss, halt drawdown, and entry throttle so the map and review do not drift. Target part: pure config-review/static gate.
6. Severity: High. Security boundaries for config forms and export remain the right gates for this slice because caps are exported runtime env-like values but must not open live-control paths. Evidence: forbidden form keys include secrets/provider/raw/live-control terms at `apps/web/src/features/bots/config-action-handler.ts:51-86` and are rejected before parsing/persistence at `apps/web/src/features/bots/config-action-handler.ts:167-177`; Tortila export includes the cap env lines at `apps/web/src/features/bots/config-export.ts:285-290`, while `tests/integration/bot-config-export-route-handler.test.ts:172-200` checks no-store headers and unsafe payload leakage. Recommendation: include `bot-config-action-handler.test.ts` and `bot-config-export-route-handler.test.ts` in the focused gate stack after cap-map changes. Target part: security regression gate.
7. Severity: Medium. Admin system-defaults use the same Tortila table plus generic top-level fields, so a component-signature change can silently affect admin defaults even if user settings pass. Evidence: admin defaults build `configReview` from the same config at `apps/web/src/app/admin/bots/config/page.tsx:63-81`, render `TortilaSymbolConfigTable` at `apps/web/src/app/admin/bots/config/page.tsx:178-183`, then render generic fields at `apps/web/src/app/admin/bots/config/page.tsx:195-210`; `tests/integration/admin-global-bot-config-static.test.ts:16-43` currently asserts the route and table presence but not cap-map embedding. Recommendation: add static admin assertions if the cap-map props/component are shared with admin defaults; rendered admin e2e can stay optional for this focused user settings slice. Target part: shared component/admin default coverage.
8. Severity: Medium. The available package scripts support a narrow, honest gate stack; broad/live gates should remain explicitly not run. Evidence: `package.json:13-18` defines typecheck, test, secret scan, and lint; `package.json:27` defines e2e; `package.json:45-46` defines governance and local CI. Recommendation: use focused Vitest/static, desktop/mobile `bot-settings.spec.ts`, web typecheck, targeted ESLint, `secret:scan`, and `governance:check`; list live bot, provider/API, env/secret, worker, deploy, full CI, and broad e2e as not run unless a separate phase authorizes them. Target part: acceptance reporting.

## Decisions
1. Treat top-level Tortila portfolio caps as WTC-side draft/reference settings, not live exchange capacity, runtime sync, current position capacity, or provider-confirmed state.
2. Recommend tests that prove draft cap values update in the strategy map before save, matching the current row-draft behavior from Phase 4.07.
3. Keep the implementation test surface inside existing settings/setup/admin-default form wiring and existing config-review/action/export safety gates.
4. Do not recommend new provider reads, adapter calls, exchange pings, worker ticks, env/secret inspection, DB mutation, or live bot actions for this slice.

## Risks
1. If the caps remain generic fields below the table, users may miss the portfolio-level risk budget when reviewing the Tortila strategy map.
2. If the cap map reads only saved config while row drafts read visible form state, the UI can show mixed saved/draft truth during editing.
3. If copy says live capacity, running limit, synced, applied, or connection verified, the advisory WTC draft becomes a false live-state claim.
4. Top-level cap errors are global, not row-targeted; tests should prevent confusing `Fix row` anchors for cap failures.
5. The worktree was already heavily dirty on `codex/bot-analytics-settings-canary-20260603`; implementation acceptance must not attribute unrelated changes to Phase 4.08.

## Verification/tests
1. Read-only inspection performed with `git status --short --branch`, `rg`, and targeted `Get-Content` line reads.
2. No Vitest, Playwright, typecheck, lint, build, secret scan, governance check, coverage, full CI, live server, provider/API exchange action, bot action, worker tick, env/secret inspection, or DB mutation was run by this auditor.
3. Recommended focused static gate after implementation: `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/admin-global-bot-config-static.test.ts`.
4. Recommended rendered gate after implementation: `$env:E2E_PORT='3432'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` and `$env:E2E_PORT='3433'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile`.
5. Recommended compile/lint gate after implementation: `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` and targeted `npm exec eslint -- apps/web/src/features/bots/TortilaSymbolConfigTable.tsx apps/web/src/features/bots/config.ts apps/web/src/features/bots/config-review.ts apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx apps/web/src/app/admin/bots/config/page.tsx tests/e2e/bot-settings.spec.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/admin-global-bot-config-static.test.ts`.
6. Recommended repository safety gates after implementation: `npm run secret:scan` and `npm run governance:check`.
7. Gates intentionally not run/recommended for this read-only audit: live bot start/stop/apply/test/retest, position close, exchange ping, provider DB read/write, provider/API exchange action, raw provider payload inspection, env/secret value inspection, worker tick, SSH, tmux, systemd, production/canary mutation, deploy, full e2e matrix, coverage, and full CI.

## Next actions
1. Add the cap-map implementation with a pure/shared cap draft shape or helper so tests can pin exact labels and values without brittle prose.
2. Extend `tests/e2e/bot-settings.spec.ts` to edit all six Tortila cap fields in settings and at least assert the same cap summary exists in setup.
3. Extend `bot-config-review-static.test.ts` and `bot-read-safety-static.test.ts` to assert cap-map labels/helper names and forbidden-token absence.
4. Extend validation/error coverage for `tortila-portfolio-limit`, `tortila-risk-limit`, and `tortila-entry-throttle`.
5. Keep any real runtime diff, exchange ping, provider proof, or live apply path for a separate security plus bot-integration phase.
