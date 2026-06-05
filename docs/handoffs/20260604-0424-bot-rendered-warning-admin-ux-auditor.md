# bot-rendered-warning-admin-ux-auditor handoff
## Scope
Read-only Phase 3.95 audit of the rendered UX gaps left by Phase 3.94 around warning-summary, statistics, and admin pages.

Inspected the required WTC protocol/status files first, then audited the targeted Playwright specs and source paths for whether the prior failures look like stale assertions, UI copy mismatch, demo data gaps, or infrastructure. No product code, tests, package files, generated artifacts, live services, env files, vaults, SSH, tmux, systemd, provider DB, exchange endpoints, worker tick/restart, or bot start/stop/apply/retest were changed or touched. Existing dirty changes were preserved.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`
8. `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`
9. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`
10. `tests/e2e/warning-summary-visual.spec.ts`
11. `tests/e2e/admin-mobile-pg8.spec.ts`
12. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
13. `apps/web/src/app/admin/bots/page.tsx`
14. `apps/web/src/app/admin/products/page.tsx`
15. `apps/web/src/app/(app)/app/bots/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
18. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
19. `apps/web/src/features/bots/statistics-panels.tsx`
20. `apps/web/src/features/bots/data.tsx`
21. `apps/web/src/features/admin/bot-health-loader.ts`
22. `apps/web/src/features/admin/queries.ts`
23. `packages/bot-adapters/src/warnings.ts`
24. `tests/integration/bot-statistics-static.test.ts`
25. `tests/integration/admin-bot-health-loader.test.ts`
26. `playwright.config.ts`

## Files changed
None - read-only audit.

Allowed handoff written: `docs/handoffs/20260604-0424-bot-rendered-warning-admin-ux-auditor.md`.

## Findings
1. Severity: High. The Phase 3.94 desktop statistics failure is not proven to be a current UI copy mismatch; current source renders the exact expected title in both access-allowed warning branches. Evidence: the spec expects `Risk and status notes` on `/app/bots/statistics?bot=${bot}` (`tests/e2e/warning-summary-visual.spec.ts:82`, `tests/e2e/warning-summary-visual.spec.ts:83`), while the current statistics page renders `<WarningSummaryPanel ... title="Risk and status notes" />` and an access-fallback card with the same title (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:395`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:398`); the static guard also requires the title and shared warning panel (`tests/integration/bot-statistics-static.test.ts:34`, `tests/integration/bot-statistics-static.test.ts:36`). Phase 3.87 previously passed the warning-summary Playwright spec after fixing statistics overflow (`docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md:79`). Recommendation: classify this as likely stale-server/cache/infra until a clean isolated rerun says otherwise; if it still fails after isolation, inspect the rendered access branch and selected-bot state before changing copy. Target part: `/app/bots/statistics` rendered warning surface.
2. Severity: High. The admin aborts in Phase 3.94 are most consistent with e2e infrastructure, not missing admin page copy. Evidence: the recorded failure says desktop `/admin/bots` and mobile `/admin/products` aborted after the web server reported missing `.next-e2e/server/app-paths-manifest.json` (`docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md:80`); Playwright hardcodes a shared `NEXT_DIST_DIR=.next-e2e` and refuses to reuse existing servers (`playwright.config.ts:31`, `playwright.config.ts:34`); `Get-NetTCPConnection` still showed `127.0.0.1:3410` listening during this audit. The targeted admin pages do contain the expected headings/storage surfaces (`apps/web/src/app/admin/bots/page.tsx:84`, `apps/web/src/app/admin/bots/page.tsx:93`, `apps/web/src/app/admin/products/page.tsx:27`, `apps/web/src/app/admin/products/page.tsx:35`). Recommendation: isolate Playwright by stopping/avoiding the stale 3410 listener and using a per-run or per-port Next dist dir before treating admin rendered failures as product failures. Target part: rendered admin gate reliability.
3. Severity: Medium. Admin canonical warning-summary acceptance has a demo data gap: demo mode renders an empty canonical summary table state, while the visible Tortila P0 copy comes from the separate persistent warning banner, not from populated canonical warning rows. Evidence: the admin loader returns `botWarningSummaries: []` in empty/demo health (`apps/web/src/features/admin/bot-health-loader.ts:28`, `apps/web/src/features/admin/bot-health-loader.ts:43`); `/admin/bots` shows `No evaluated bot warning snapshots` when that array is empty (`apps/web/src/app/admin/bots/page.tsx:152`, `apps/web/src/app/admin/bots/page.tsx:155`); the same page then renders `TORTILA_PERSISTENT_WARNINGS` separately (`apps/web/src/app/admin/bots/page.tsx:216`, `apps/web/src/app/admin/bots/page.tsx:217`), whose P0 title is defined in the registry (`packages/bot-adapters/src/warnings.ts:33`, `packages/bot-adapters/src/warnings.ts:38`). Recommendation: add a DB-backed no-live fixture or a sanitized demo-seeded health row if the rendered admin warning-summary gate must prove populated canonical rows, not just the empty state plus persistent banner. Target part: `/admin/bots` canonical warning summary.
4. Severity: Medium. The user warning-summary spec is useful but thin for statistics: it checks title/scope/no all-clear/overflow, not the statistics page's richer panel contract. Evidence: the spec asserts `Risk and status notes`, `scope: adapter warning read`, and all-clear absences (`tests/e2e/warning-summary-visual.spec.ts:50`, `tests/e2e/warning-summary-visual.spec.ts:83`, `tests/e2e/warning-summary-visual.spec.ts:84`), while the statistics page renders advanced journal/Legacy operations panels below the summary (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:380`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:391`, `apps/web/src/features/bots/statistics-panels.tsx:630`). Recommendation: after the infra-clean rerun, extend the focused statistics e2e to assert the heading, portfolio snapshot, advanced panels, Legacy operational empty/provider-snapshot states, no `Connection verified`, and no horizontal scroll. Target part: statistics rendered regression coverage.
5. Severity: Medium. The current worktree is heavily dirty, so this audit cannot attribute failures to a clean baseline or claim final rendered readiness. Evidence: `git status --short` reported many modified and untracked product/test/handoff files, including `apps/web/src/app/(app)/app/bots/statistics/page.tsx`, `apps/web/src/app/admin/bots/page.tsx`, `apps/web/src/features/bots/WarningSummaryPanel.tsx`, `apps/web/src/features/bots/statistics-panels.tsx`, `tests/e2e/warning-summary-visual.spec.ts`, and `tests/e2e/admin-mobile-pg8.spec.ts`. Recommendation: preserve all dirty changes, then run the next rendered gate only from an explicitly serialized e2e state and cite the exact diff baseline used. Target part: audit evidence integrity.

## Decisions
1. Classified the prior statistics missing-text failure as likely infra/stale-server until a clean isolated rerun proves a product branch issue. Current source does not support a simple copy-mismatch diagnosis.
2. Classified the prior `/admin/bots` and `/admin/products` aborts as infrastructure, because both pages contain the expected route headings/storage pills and the recorded failure includes a missing Next manifest.
3. Classified admin canonical warning-summary population as a demo data gap: current demo e2e can prove empty-state containment and persistent warning banners, but not populated canonical summary rows.
4. Did not run Playwright or local tests because the user's write constraint permits exactly one handoff, and those gates can create `.next-e2e`, screenshots, traces, or test-results.

## Risks
1. Without a clean rerun, the statistics failure remains not fully closed; access-state or selected-bot rendering could still be involved if the isolated run reproduces it.
2. Existing port 3410 listener and shared `.next-e2e` output can keep producing misleading red gates until the e2e setup is isolated.
3. Demo-mode admin warning UI does not prove DB-populated canonical warning summaries.
4. The heavily dirty worktree means line evidence reflects the current local state, not necessarily a committed or deployable baseline.

## Verification/tests
RUN:
1. Required protocol/status reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`.
2. Read-only source/spec inspection with `Get-Content` and `rg` over the files listed above.
3. `git status --short` - observed a heavily dirty worktree before writing this handoff; no cleanup or revert performed.
4. `Get-NetTCPConnection -LocalPort 3410,35410 -ErrorAction SilentlyContinue` - observed `127.0.0.1:3410` listening; no live service mutation performed.

NOT RUN:
1. Playwright/e2e - not run because it can write generated output/screenshots/traces and the allowed write scope is exactly this handoff.
2. Vitest/static tests - not run because no product/test code was edited and this was a read-only classification audit.
3. Lint, typecheck, build, secret scan, governance check - not run for this per-agent handoff lane.
4. Real Postgres migration/seed, provider DB, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, and live server checks - NOT RUN by scope/protocol.

## Next actions
1. Rerun the focused rendered gate from a clean serialized e2e state with no stale 3410 listener. Before treating this as a hard gate, parameterize the Playwright webServer `NEXT_DIST_DIR` or use a one-off config so each concurrent/adjacent run gets a unique dist dir, then run:
   `E2E_PORT=<free-port> npx playwright test tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile`
2. If statistics still fails after isolation, debug the rendered access/selected-bot branch before changing the expected copy, because current source already renders `Risk and status notes`.
3. Add a no-live DB-backed or sanitized demo fixture for `/admin/bots` canonical warning rows so admin warning-summary rendered acceptance can prove populated warnings rather than only the empty state plus persistent Tortila banner.
4. Extend statistics rendered coverage to assert advanced panels and Legacy operational states once the infra issue is removed.
