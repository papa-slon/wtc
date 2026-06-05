# Phase 3.98 admin bot owner drilldown handoff
## Scope
Implemented the next read-only admin bot explorer slice after Phase 3.97.

The slice adds a top-of-page owner drilldown on `/admin/bots` so an admin can scan mapped Tortila owners and Legacy masked pub_id rows, then open the selected user's read-only bot detail page. Unmapped Legacy pub_id rows stay labelled as fleet diagnostics only. No user settings, provider mappings, exchange keys, live bot config, worker state, or open positions can be mutated from this slice.

Read-only agents were dispatched before product edits, per `docs/SESSION_PROTOCOL.md`. All three agents wrote handoffs and were closed before this aggregate report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
8. `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md`
9. `docs/handoffs/20260604-0603-bot-admin-drilldown-security-auditor.md`
10. `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md`
11. `apps/web/src/app/admin/bots/page.tsx`
12. `apps/web/src/app/admin/users/page.tsx`
13. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
14. `apps/web/src/features/admin/types.ts`
15. `apps/web/src/features/admin/queries.ts`
16. `apps/web/src/features/admin/bot-health-loader.ts`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `tests/integration/admin-user-bot-detail-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/admin-bot-health-loader.test.ts`
21. `tests/integration/admin-responsive.test.ts`
22. `tests/e2e/admin-mobile-pg8.spec.ts`
23. `package.json`
24. `playwright.config.ts`

External references checked for UX sanity:
1. Hummingbot Dashboard docs: configure, backtest, deploy, and monitor are separate dashboard flows.
2. Freqtrade freqUI docs: web UI emphasizes bot status, performance, and monitoring as dashboard concerns.

## Files changed
1. `apps/web/src/app/admin/bots/page.tsx`
2. `tests/integration/admin-user-bot-detail-static.test.ts`
3. `tests/integration/bot-read-safety-static.test.ts`
4. `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md`
5. `docs/handoffs/20260604-0603-bot-admin-drilldown-security-auditor.md`
6. `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md`
7. `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`

## Findings
1. Severity: High. `/admin/bots` already had the safe fleet DTOs needed to build the admin entry point without new DB schema, raw queries, or adapter calls. Evidence: `loadAdminBotHealth()` returns `tortilaFleetSnapshots`, `legacyProviderAccounts`, `legacyActiveSlots`, and `legacyActiveOrders` through `AdminBotHealthResult`; the new `botOwnerDrilldownRows()` consumes only those safe DTOs. Recommendation: keep this slice presentation-only. Target part: admin fleet explorer.
2. Severity: High. Admins needed a clear route from fleet facts to selected-user facts. Evidence: the new `Bot owner drilldown` card combines mapped Tortila owners and Legacy masked `pub_id` rows, with `Open bot details` only when a mapped owner exists. Recommendation: use this as the admin starting point before drilling into `/admin/users/<id>/bots`. Target part: admin navigation.
3. Severity: High. Unmapped Legacy pub_id rows must not become user-owned facts. Evidence: the new table labels unmapped owners as `fleet-only / unmapped`, shows `mapping required`, and sets scope to `fleet diagnostics only`. Recommendation: do not add selected-user links for unmapped rows until a WTC provider-account mapping exists. Target part: Legacy attribution.
4. Severity: High. The new UI remains read-only and has no mutation hooks. Evidence: product code does not import admin mapping actions, CSRF fields, submit forms, live-control actions, direct adapters, or exchange secret sources; tests guard against those strings. Recommendation: preserve this boundary for later admin drilldown improvements. Target part: admin security boundary.
5. Severity: Medium. External bot-dashboard references support the same separation of concerns used here: configuration, deployment/control, monitoring, and instance drilldown should be distinct flows. Recommendation: keep WTC admin drilldown as monitoring/inspection, and continue treating live control as a separate audited phase. Target part: product structure.
6. Severity: Medium. The current worktree is broadly dirty and includes many pre-existing tracked/untracked Phase 3.x files. Recommendation: do not treat this phase as a clean branch baseline and do not revert unrelated changes. Target part: release hygiene.

## Decisions
1. Implemented a read-only `Bot owner drilldown` card on `/admin/bots` rather than adding new loaders, migrations, actions, or provider calls.
2. Used existing safe DTOs only: Tortila owner snapshots from WTC bot instances and Legacy masked provider rows from worker snapshots.
3. Kept mapped owners linked to `/admin/users/<userId>/bots`; kept unmapped Legacy rows without a detail link.
4. Kept live control, provider mapping mutation, exchange ping, raw provider payload display, and user-setting edits out of this slice.
5. Extended static guardrails so future edits cannot quietly turn the explorer into a mutation surface.
6. Did not mark the overall bot website goal complete. Phase 3.98 is one accepted slice inside the broader Legacy plus Tortila completion track.

## Risks
1. The populated DB-backed admin user-bot rendered gate was not run because no `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was supplied. Demo/mobile and loader gates are green, but populated browser proof remains an opt-in gate.
2. `.next-e2e` was generated by the Playwright mobile run and is ignored generated output; no tracked screenshot diffs were produced.
3. The first Playwright attempt on port `3410` was blocked because the port was already in use; the same gate passed on isolated port `3421`.
4. `pnpm` is not available in this PowerShell PATH; repository scripts use `npm`, and all accepted gates were rerun through `npm`.
5. `LegacyProviderAccountAdminView.quarantineReason` remains a DTO footgun identified by the security auditor. It is not rendered by this slice.

## Verification/tests
RUN:
1. Read-only agents launched before product edits:
   - `docs/handoffs/20260604-0603-bot-admin-drilldown-ux-auditor.md`
   - `docs/handoffs/20260604-0603-bot-admin-drilldown-security-auditor.md`
   - `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md`
2. All three agents closed before final report.
3. `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 5 tests.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts` - PASS, 25 tests.
5. `npm exec vitest -- run tests/integration/admin-bot-health-loader.test.ts` - PASS, 3 tests.
6. `npm exec vitest -- run tests/integration/admin-responsive.test.ts` - PASS, 46 tests.
7. `npm exec tsc -- -p tsconfig.json --noEmit` - PASS.
8. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
9. `E2E_PORT=3421 npm exec playwright -- test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test.
10. `npm exec eslint -- apps/web/src/app/admin/bots/page.tsx tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts --max-warnings 0` - PASS.
11. `npm run secret:scan` - PASS.
12. `npm run governance:check` before this aggregate - PASS with 0 errors and 1 known historical warning.
13. `git diff --check -- apps/web/src/app/admin/bots/page.tsx tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS.
14. External UX sanity check via Hummingbot Dashboard docs and Freqtrade freqUI docs - RUN.

ATTEMPTED BUT NOT ACCEPTED AS FINAL GATES:
1. `pnpm exec ...` attempts - failed because `pnpm` is not in PATH; rerun through `npm`.
2. `npm exec playwright -- test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` on default port 3410 - blocked by existing server on that port; rerun on `E2E_PORT=3421` passed.
3. First `admin-user-bot-detail-static` run - failed because the new test forbade the existing safety text `applyConfig`; guardrail was corrected to forbid action/function usage and rerun passed.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed` - requires intentionally supplied throwaway admin Postgres URL.
2. Full `npm test` - not run because this phase used focused gates against touched and adjacent surfaces.
3. Full `npm run lint` - not run; focused ESLint on touched files passed.
4. `npm run build -w @wtc/web` - not run.
5. Live bot services, provider DB mutation, env/vault/secret file inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, and live exchange ping - not run by safety policy.

## Next actions
1. Next admin UX slice: add a selected-user `Bot drilldown overview` to `/admin/users/[userId]/bots`, with one row per bot and anchors to each bot card.
2. Add a deep link from mapped Legacy pub_id rows to the selected user's Legacy card after stable anchors exist.
3. Run the populated DB admin rendered gate when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is deliberately available.
4. Keep broader Legacy plus Tortila completion moving in separate protocol phases: user setup/settings, safe key metadata checks, worker snapshot evidence, then only later any live-control discussion after security and bot-integration acceptance.
