# Phase 3.99 admin selected-user drilldown overview handoff
## Scope
Implemented the next selected-user admin bot drilldown slice after Phase 3.98.

The slice adds a compact `Bot drilldown overview` near the top of `/admin/users/[userId]/bots`, directly after the `User` card. It summarizes each bot's access, settings source, runtime scope, warning state, latest stats, and provides stable `Jump to bot card` anchors for `#bot-tortila_bot` and `#bot-legacy_bot`. It also updates the admin user-directory action copy to `Bot drilldown` and deep-links `/admin/bots` mapped owner rows into the selected user's exact bot card.

This phase is presentation-only over existing admin DTOs. No loader, schema, repository, action, provider adapter, worker, live bot, exchange key, or secret path was added or changed.

Read-only agents were dispatched before product edits. All three agents wrote per-agent handoffs and were closed before this aggregate report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`
8. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-ux-auditor.md`
9. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-security-auditor.md`
10. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-tests-auditor.md`
11. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
12. `apps/web/src/app/admin/bots/page.tsx`
13. `apps/web/src/app/admin/users/page.tsx`
14. `apps/web/src/features/admin/types.ts`
15. `apps/web/src/features/admin/queries.ts`
16. `apps/web/src/features/admin/user-bot-detail-loader.ts`
17. `apps/web/src/features/admin/bot-health-loader.ts`
18. `tests/integration/admin-user-bot-detail-static.test.ts`
19. `tests/integration/admin-user-bot-detail-loader.test.ts`
20. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
22. `tests/integration/admin-responsive.test.ts`
23. `tests/e2e/admin-mobile-pg8.spec.ts`
24. `tests/e2e/admin-user-bot-detail-db.spec.ts`
25. `playwright.config.ts`
26. `package.json`

## Files changed
1. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
2. `apps/web/src/app/admin/bots/page.tsx`
3. `apps/web/src/app/admin/users/page.tsx`
4. `tests/integration/admin-user-bot-detail-static.test.ts`
5. `tests/integration/bot-read-safety-static.test.ts`
6. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
7. `tests/e2e/admin-user-bot-detail-db.spec.ts`
8. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-ux-auditor.md`
9. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-security-auditor.md`
10. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-tests-auditor.md`
11. `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`

## Findings
1. Severity: High. Selected-user admin detail had all required facts, but the first viewport forced admins to scan long per-bot cards. Evidence: `detail.bots` already exposes `configSummary`, `providerScope`, `warningSummary`, `latestMetric`, positions, trades, and equity; the new overview summarizes those fields directly. Recommendation: keep selected-user top summary as the first admin inspection surface. Target part: admin selected-user drilldown.
2. Severity: High. Stable product anchors solve the fleet-to-user drilldown path without leaking provider ids. Evidence: selected-user anchors are `#bot-tortila_bot` and `#bot-legacy_bot`; `/admin/bots` mapped rows link to `/admin/users/<userId>/bots#<fixed-product-anchor>`. Recommendation: never derive fragments from raw pub_id, labels, symbols, or trade ids. Target part: admin deep links.
3. Severity: High. The overview remains read-only. Evidence: it renders no forms, CSRF fields, submit buttons, actions imports, direct adapters, raw JSON, secret tables, or live-control names; static tests guard those conditions. Recommendation: any future mutation near this page must be a separate audited phase. Target part: admin security boundary.
4. Severity: Medium. User-directory navigation now matches the drilldown mental model. Evidence: the user row action copy is `Bot drilldown`, not a vague `Bot details`. Recommendation: keep admin flows named by operator task: directory -> drilldown -> bot card. Target part: admin navigation.
5. Severity: Medium. Populated rendered DB proof is prepared but not run in this phase. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts` now asserts overview heading, read-only banner, and two `Jump to bot card` links, but the gate is opt-in and needs a throwaway admin DB URL. Recommendation: run `npm run e2e:admin-user-bots:db:managed` when the operator deliberately supplies credentials. Target part: rendered acceptance.
6. Severity: Medium. Adjacent fleet DTO risk remains: `LegacyProviderAccountAdminView.quarantineReason` carries provider-origin text. Evidence: security-auditor handoff flags this; current phase does not render it. Recommendation: remove or canonicalize before any future fleet rendering consumes it. Target part: future data-boundary cleanup.

## Decisions
1. Implemented the selected-user overview in the existing server component rather than adding a new loader or component.
2. Used existing safe admin DTO fields only.
3. Added stable anchors through `botAnchor(bot)` returning `bot-${bot.productCode}`.
4. Deep-linked `/admin/bots` owner drilldown rows to those fixed anchors.
5. Updated `/admin/users` action copy to `Bot drilldown`.
6. Extended static and DB-e2e harness guardrails; did not run the opt-in DB-backed browser gate without a supplied throwaway DB URL.
7. Did not mark the full Legacy plus Tortila website objective complete.

## Risks
1. The worktree was already heavily dirty/untracked before Phase 3.99; this phase did not create a clean release baseline.
2. `.next-e2e` output may be regenerated by the Playwright mobile run and remains generated/ignored output.
3. DB-backed populated rendered gate remains not run without `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
4. `LegacyProviderAccountAdminView.quarantineReason` is still a residual adjacent DTO cleanup item.

## Verification/tests
RUN:
1. Read-only agents launched before product edits:
   - `docs/handoffs/20260604-0620-admin-selected-user-drilldown-ux-auditor.md`
   - `docs/handoffs/20260604-0620-admin-selected-user-drilldown-security-auditor.md`
   - `docs/handoffs/20260604-0620-admin-selected-user-drilldown-tests-auditor.md`
2. All three agents closed before final report.
3. `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 6 tests.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts` - PASS, 25 tests.
5. `npm exec vitest -- run tests/integration/admin-responsive.test.ts` - PASS, 46 tests.
6. `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS, 12 tests.
7. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts` - PASS, 71 tests.
8. Security auditor also ran `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 9 tests.
9. `npm exec tsc -- -p tsconfig.json --noEmit` - PASS.
10. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
11. `E2E_PORT=3422 npm exec playwright -- test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test.
12. `npm exec eslint -- apps/web/src/app/admin/users/[userId]/bots/page.tsx apps/web/src/app/admin/bots/page.tsx apps/web/src/app/admin/users/page.tsx tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/e2e/admin-user-bot-detail-db.spec.ts --max-warnings 0` - PASS.
13. `npm run secret:scan` - PASS.
14. `git diff --check -- <touched files>` - PASS.
15. `npm run governance:check` - PASS, 0 errors, 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
16. `git diff --check -- <touched files and aggregate handoff>` - PASS.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed` - requires intentionally supplied throwaway admin Postgres URL.
2. Full `npm test` - not run; focused gates covered touched and adjacent surfaces.
3. Full `npm run lint` - not run; focused ESLint on touched files passed.
4. `npm run build -w @wtc/web` - not run.
5. Live bot services, provider DB mutation, env/vault/secret file inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, and live exchange ping - not run by safety policy.

## Next actions
1. Run `npm run e2e:admin-user-bots:db:managed` when a throwaway admin DB URL is deliberately available, so the populated browser gate proves the new overview and anchors with real seeded rows.
2. Remove or canonicalize `LegacyProviderAccountAdminView.quarantineReason` before any future fleet UI consumes it.
3. Continue bot website completion in new protocol phases: user settings/setup clarity, safer key metadata/test semantics, worker snapshot evidence, then separately audited live-control discussion only after bot-integration and security acceptance.
