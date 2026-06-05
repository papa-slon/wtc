# phase-3-94-bot-settings-rendered-ux-slots handoff
## Scope
Phase 3.94 improves and verifies the bot settings rendered UX core for the broader Legacy + Tortila completion goal. The slice focuses on making the Legacy averaging-bot settings easier to understand: coin -> RSI/CCI trigger -> stage slot group -> stage RSI/CCI slot usage. It also rechecks the existing safe rendered core for bot settings/setup/readiness and admin system defaults.

No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, or live server mutation was performed.

Per-agent handoffs:
- [`docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md`](20260604-0410-bot-settings-rendered-ux-auditor.md)
- [`docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md`](20260604-0410-bot-settings-integration-safety-auditor.md)
- [`docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`](20260604-0410-bot-settings-rendered-tests-auditor.md)

Background agents:
- `019e8f45-f6da-7c11-8b23-bac375212692` closed after result collection.
- `019e8f46-4142-7940-b76c-992d2c91c6b0` closed after result collection.
- `019e8f46-8aca-7d73-abfd-ca775dd3d0c3` closed after result collection.

External UX benchmark notes:
- FreqUI: monitor/interact UI depends on a separately configured REST API, reinforcing UI/runtime separation.
- Hummingbot Dashboard: configure/backtest strategies before deploying instances, reinforcing review-before-live apply.
- 3Commas DCA: averaging orders make indicator conditions and order execution rules explicit, reinforcing visible slot/trigger semantics.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md`
8. `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md`
9. `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md`
10. `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/app/admin/bots/config/page.tsx`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
17. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
18. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
19. `apps/web/src/features/bots/BotReadinessMap.tsx`
20. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
21. `apps/web/src/features/bots/config.ts`
22. `apps/web/src/features/bots/config-review.ts`
23. `apps/web/src/features/bots/readiness.ts`
24. `apps/web/src/features/bots/readiness-loader.ts`
25. `apps/web/src/features/admin/user-bot-detail-loader.ts`
26. `packages/db/src/repositories.ts`
27. `packages/bot-adapters/src/types.ts`
28. `packages/bot-adapters/src/http.ts`
29. `tests/e2e/bot-settings.spec.ts`
30. `tests/e2e/bot-readiness-map.spec.ts`
31. `tests/e2e/warning-summary-visual.spec.ts`
32. `tests/e2e/admin-mobile-pg8.spec.ts`
33. `tests/integration/bot-config-review-static.test.ts`
34. `tests/integration/bot-read-safety-static.test.ts`
35. `tests/integration/bot-readiness-builder.test.ts`
36. `tests/integration/admin-global-bot-config-static.test.ts`
37. `tests/integration/admin-global-bot-config-db.test.ts`
38. `tests/integration/user-resolved-bot-config-static.test.ts`
39. `tests/integration/user-resolved-bot-config-db.test.ts`
40. `tests/integration/admin-user-bot-detail-static.test.ts`
41. `tests/integration/admin-user-bot-detail-loader.test.ts`
42. `tests/integration/bot-statistics-static.test.ts`
43. `tests/integration/bot-runtime-config-sanitizer.test.ts`
44. `tests/integration/bot-config-export-route-handler.test.ts`

## Files changed
1. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
2. `tests/integration/bot-config-review-static.test.ts`
3. `tests/e2e/bot-settings.spec.ts`
4. `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md`
5. `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md`
6. `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`
7. `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`

## Findings
1. Severity: High. Legacy settings now make the requested coin -> RSI/CCI -> stage -> slots model visible in the editor. Evidence: the table computes active usage per stage and signal (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:43`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:97`), explains that a coin consumes a slot in its selected stage and trigger bucket (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:112`), labels each coin card with `Stage N / RSI|CCI slot` (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:157`), and shows RSI/CCI usage plus capacity status in the stage table (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:337`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:338`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:343`). Recommendation: keep the slot budget visible in both settings and setup while later DB-backed admin-user drilldown work proceeds. Target part: Legacy bot settings/setup UX.
2. Severity: High. Legacy threshold meaning is clearer without enabling live control. Evidence: RSI/CCI fields now say `RSI trigger threshold`, `CCI trigger threshold`, accepted ranges, and stage slot group meaning (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:210`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:212`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:225`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:227`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:234`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:236`). Recommendation: future save-error work should point to the exact invalid row, but the visible field semantics are no longer hidden in schema/test knowledge. Target part: Legacy strategy map form.
3. Severity: High. Focused rendered bot settings/setup/admin-defaults/readiness core is green after a clean e2e state. Evidence: `tests/e2e/bot-settings.spec.ts` now asserts the slot model, threshold labels, stage usage, no horizontal scroll, and no false `Connection verified` language (`tests/e2e/bot-settings.spec.ts:44`, `tests/e2e/bot-settings.spec.ts:46`, `tests/e2e/bot-settings.spec.ts:47`, `tests/e2e/bot-settings.spec.ts:52`, `tests/e2e/bot-settings.spec.ts:53`, `tests/e2e/bot-settings.spec.ts:54`); final Playwright command `E2E_PORT=3423 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts` passed 8/8. Recommendation: treat this as scoped rendered acceptance for the edited bot settings/readiness core only. Target part: rendered settings/setup/readiness acceptance.
4. Severity: High. Safety boundaries stayed intact: no live bot control, no exchange ping claim, and no secret exposure was added. Evidence: the integration-safety auditor found current web UI/actions do not start/stop/retest/apply config to live bots and that control methods remain disabled (`docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md:50`, `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md:51`, `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md:52`, `docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md:53`); the final e2e core continued to assert no `Connection verified` copy. Recommendation: keep the WTC reference/config editor separate from any future audited live adapter work. Target part: bot settings safety boundary.
5. Severity: Medium. Broader rendered acceptance is still not green. Evidence: the tests auditor's wider rendered command failed with port collision/Next `.next-e2e` manifest crash and statistics/admin-warning assertions before this main thread cleaned `.next-e2e` and reran the narrower core (`docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:43`, `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:44`, `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:45`, `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:88`, `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:90`). Recommendation: do not claim full bot/admin visual readiness until warning summary, statistics, admin mobile sweep, and populated admin-user drilldown pass from a clean serialized rendered gate. Target part: full rendered bot/admin acceptance.
6. Severity: Medium. Admin user drilldown remains source/test safe but lacks populated rendered proof. Evidence: the UX auditor found source and loader coverage for admin read-only user bot detail, but rendered proof only covers demo-empty states (`docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md:34`, `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md:35`, `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md:36`, `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md:37`). Recommendation: next slice should add a DB-backed/populated rendered admin-user drilldown acceptance path. Target part: `/admin/users/[userId]/bots`.

## Decisions
1. Phase 3.94 accepts only the edited bot settings/setup/readiness rendered core, not full platform or full bot/admin visual acceptance.
2. Legacy stage/slot usage is displayed as a pre-save reference aid; it does not apply or validate live bot state.
3. Existing e2e screenshot artifacts are acceptable as rendered evidence, but `.next-e2e` generated output is not a product change; generated `next-env.d.ts` churn was restored.
4. The Hume wider rendered failure is kept as open evidence instead of hidden. The main thread reran and passed the narrower core after clearing generated `.next-e2e`, but did not claim the failed wider gate green.
5. No live/provider acceptance was attempted because this phase is local WTC-side UX and safety work.

## Risks
1. The worktree was heavily dirty before the phase; unrelated changes were preserved and not reverted.
2. Stage usage is a client-side UX guide based on the rows loaded/rendered on the page. It helps the user understand capacity before save but is not a replacement for server-side validation.
3. Full warning-summary/statistics/admin rendered acceptance is still open.
4. Admin-user drilldown still needs populated DB-backed rendered proof.
5. The forbidden-key alias centralization risk noted by the safety auditor remains open.

## Verification/tests
RUN:
1. Required WTC protocol docs and Phase 3.93 handoff refreshed before edits.
2. Three read-only agents were dispatched before edits and each wrote a per-agent handoff linked above.
3. Background agents `019e8f45-f6da-7c11-8b23-bac375212692`, `019e8f46-4142-7940-b76c-992d2c91c6b0`, and `019e8f46-8aca-7d73-abfd-ca775dd3d0c3` were closed after result collection.
4. Focused static/safety gate: `npx vitest run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts` - PASS, 3 files / 36 tests.
5. Hume safety gate: `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-config-export-route-handler.test.ts` - PASS, 10 files / 42 tests.
6. `npm run typecheck` - PASS.
7. `npm run typecheck -w @wtc/web` - PASS.
8. First focused Playwright after implementation: `E2E_PORT=3421 npx playwright test tests/e2e/bot-settings.spec.ts` - PASS, 6 tests.
9. Final rendered core after threshold hints and clean `.next-e2e`: `E2E_PORT=3423 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts` - PASS, 8 tests.
10. Visual screenshot inspection: `tests/e2e/screenshots/bot-legacy-settings-desktop.png` and `tests/e2e/screenshots/bot-legacy-settings-mobile.png` were inspected; new stage usage is visible and no incoherent overlap was observed.
11. `git diff --check` - PASS.
12. `npm run secret:scan` - PASS.
13. `npm run governance:check` - PASS for current phase `20260604-0410`: 0 errors, 1 known historical warning (`20260529-1921-integration-risk-auditor.md` missing `## Files inspected`, exempt).

NOT RUN:
1. Full `npm test` - skipped for phase scope/time; focused safety suites above covered the changed boundaries.
2. `npm run lint` - skipped for phase scope/time.
3. `npm run build` / `npm run build -w @wtc/web` - skipped for phase scope/time.
4. Full `npm run e2e` and Hume's wider rendered sweep - not accepted green; Hume's prior wider sweep failed, and this phase only reran the clean bot settings/readiness core.
5. DB-backed populated admin-user bot drilldown rendered acceptance - not run; tracked as next action.
6. Real Postgres migration/seed, provider DB, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd, and live server checks - forbidden by protocol/scope for this slice.

## Next actions
1. Add a clean serialized broader rendered gate for statistics/warning summaries/admin mobile so Hume's failing wider gate can be classified and fixed.
2. Add DB-backed rendered acceptance for `/admin/users/[userId]/bots` with populated config source, provider mapping, canonical warnings, positions/trades/equity cards, and no edit/live controls.
3. Centralize forbidden bot config/runtime key aliases and add parity tests across action form, admin form, user parser, runtime sanitizer, and repository guard.
4. Add row-targeted save-error feedback for Legacy invalid threshold/stage/ladder rows.
5. Continue the broader Legacy + Tortila completion goal in a new phase; this phase only improves and verifies the bot settings rendered UX core.
