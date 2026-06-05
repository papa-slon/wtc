# Phase 4.00 bot setup control center handoff
## Scope
Implemented the next user-facing bot setup/settings clarity slice for Legacy Bot and Tortila Bot.

This phase adds a shared `Bot setup control center` to both `/app/bots/[bot]/settings` and `/app/bots/[bot]/setup`. It is a top-level, read-only summary over already-loaded safe WTC DTOs: settings source, exchange-key metadata state, Legacy provider-mapping state, coin/stage strategy shape, review/statistics readiness, user/admin boundary, and the disabled live-control boundary.

The slice is presentation/test hardening only. It does not add loaders, route handlers, server actions, schema, repositories, provider adapter calls, exchange pings, worker ticks, live start/stop/apply/retest, or position-control behavior.

Read-only agents were dispatched before product edits. All three agents wrote per-agent handoffs and were closed before this aggregate report.

External UX references were checked from official docs/help pages before implementation: Hummingbot credentials/commands, Freqtrade configuration/pairlists, and 3Commas DCA bot FAQ. The implementation keeps the useful pattern of separating credentials, configuration, status/review, and start/live control, while preserving WTC's stricter no-live-control boundary.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`
8. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
9. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
10. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
14. `apps/web/src/features/bots/BotReadinessMap.tsx`
15. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
16. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
17. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
18. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
19. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
20. `apps/web/src/features/bots/readiness.ts`
21. `apps/web/src/features/bots/readiness-loader.ts`
22. `apps/web/src/features/bots/config.ts`
23. `apps/web/src/features/bots/config-action-handler.ts`
24. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
25. `packages/ui/src/components.tsx`
26. `tests/integration/bot-read-safety-static.test.ts`
27. `tests/integration/bot-config-review-static.test.ts`
28. `tests/integration/bot-readiness-server-dto-static.test.ts`
29. `tests/integration/bot-config-action-handler.test.ts`
30. `tests/integration/bot-runtime-config-sanitizer.test.ts`
31. `tests/e2e/bot-settings.spec.ts`
32. `playwright.config.ts`
33. `package.json`

## Files changed
1. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/e2e/bot-settings.spec.ts`
7. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
8. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
9. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
10. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`

## Findings
1. Severity: High. User setup/settings needed a first-viewport control surface that connects the detailed config forms to the actual operational boundary. Evidence: prior pages already had readiness maps, source cards, config review, and operation map, but admins/users still had to scan multiple sections before understanding current state. Recommendation: keep `BotSetupControlCenter` as the first summary after bot header/subnav. Target part: user bot setup/settings.
2. Severity: High. Count-only key/provider summaries were too weak. Evidence: readiness DTO already exposes `exchangeKeyState` and `providerPubIdState`; the new component now renders WTC vault metadata confirmed/saved/missing and Legacy DB mapping/runtime snapshot/missing/conflict states. Recommendation: consume state/count DTOs, not raw key/provider objects. Target part: key/provider readiness clarity.
3. Severity: High. Exchange-key "test" language must stay metadata-only until audited live ping exists. Evidence: setup review copy was changed from ambiguous "connection test pending" to "WTC vault metadata confirmed/saved; live exchange ping not run"; tests now reject the old wording. Recommendation: never render "Connection verified" or live connectivity success from this metadata check. Target part: exchange-key UX and static/e2e tests.
4. Severity: High. User/admin boundary is now explicit in the top summary. Evidence: the control center has a `User/admin boundary` row: users save user-owned WTC profiles/key metadata, admins publish system defaults and map Legacy pub_id, and this page cannot operate bots or expose secrets. Recommendation: keep admin global-default controls and user-owned settings separate. Target part: RBAC/product UX.
5. Severity: High. Live control stays visibly disabled and code-level live-control tokens stay out of the shared component. Evidence: the control center uses only links/read-only cells and tests assert no `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `apiKey`, `apiSecret`, `sealed`, or `Connection verified`. Recommendation: any live-control or live-ping work must be its own audited phase. Target part: safety boundary.
6. Severity: Medium. Desktop and mobile rendered surfaces accept the new summary without horizontal scroll. Evidence: focused Playwright passed for `tests/e2e/bot-settings.spec.ts` on both `mobile` and `desktop`, covering Tortila settings, Legacy settings, invalid row errors, setup review, and admin bot defaults. Recommendation: keep the table/card-stack convention for future summary rows. Target part: rendered acceptance.

## Decisions
1. Added one shared `BotSetupControlCenter` presentation component under `apps/web/src/features/bots`.
2. Wired it into both settings and setup pages using already-loaded `configReview.metrics`, `readiness.exchangeKeyState`, `readiness.providerPubIdState`, key counts, provider counts, source labels, and config source.
3. Did not pass `legacyAccounts`, raw provider IDs, raw runtime config, sealed secret fields, URLs, headers, or adapter results into the component.
4. Replaced the settings save-behavior copy from `no live apply, start, stop, or retest` to `no live-control adapter actions`.
5. Replaced setup review copy from ambiguous connection-test wording to explicit WTC metadata/live-ping-not-run wording.
6. Extended static and rendered tests for control-center visibility, state-based semantics, user/admin boundary, metadata-only exchange copy, and no unsafe live-control text.
7. Did not mark the full Legacy plus Tortila website objective complete.

## Risks
1. The worktree was already heavily dirty/untracked before this phase; this phase did not create a clean release baseline.
2. The control center is presentation-only; it improves clarity but does not prove Legacy live adapter, live bot controls, provider-side bearer-auth, or production burn-in.
3. DB-backed populated admin/user bot browser gates remain separate from this slice.
4. Live exchange ping is still not implemented; the UI now says that directly.

## Verification/tests
RUN:
1. Read-only agents launched before product edits:
   - `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
   - `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
   - `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
2. All three agents closed before final report.
3. External reference check used official/current pages for Hummingbot credentials/commands, Freqtrade configuration/pairlists, and 3Commas DCA FAQ.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts` - PASS, 28 tests.
5. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 46 tests.
6. Security auditor also ran `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-config-action-handler.test.ts` - PASS, 42 tests.
7. Security auditor also ran `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 4 tests.
8. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
9. `npm exec tsc -- -p tsconfig.json --noEmit` - PASS.
10. `npm exec eslint -- apps/web/src/features/bots/BotSetupControlCenter.tsx apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/e2e/bot-settings.spec.ts --max-warnings 0` - PASS.
11. `$env:E2E_PORT='3424'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 5 tests.
12. `$env:E2E_PORT='3425'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 5 tests.
13. `npm run secret:scan` - PASS.
14. `git diff --check -- <touched files and agent handoffs>` - PASS.
15. `npm run governance:check` - PASS, 0 errors, 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.

NOT RUN:
1. Full `npm test` - not run; focused gates covered changed and adjacent bot setup/settings surfaces.
2. Full `npm run lint` - not run; focused ESLint on touched files passed.
3. `npm run build -w @wtc/web` - not run.
4. `npm run e2e` full suite - not run; focused desktop/mobile bot-settings Playwright passed.
5. DB-backed populated admin-user bot gate - not run; not touched by this slice and requires intentional throwaway admin DB URL.
6. Live bot services, provider DB mutation, env/vault/secret file inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, close positions, and live exchange ping - not run by safety policy.
7. Git staging, commit, push, or PR - not requested.

## Next actions
1. Continue user-facing setup clarity in the next protocol phase: surface first-row issue links for Legacy stage over-capacity and Tortila invalid coin rows in the control center when validation errors are present.
2. Add a compact safe "what changed since default" diff for user custom versions vs system default; keep it DTO-only and no raw runtime payloads.
3. Only after bot-integration and security audits approve it, design a separate live exchange ping/read-only adapter phase; do not mix it with setup presentation work.
