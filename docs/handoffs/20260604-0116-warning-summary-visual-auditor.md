# warning-summary-visual-auditor handoff
## Scope
Phase 3.87 read-only visual/frontend audit of the Phase 3.86 warning summary UI and user bot warning pages. Scope was limited to source and retained-artifact inspection for mobile/desktop visual risk: horizontal overflow, text overlap, nested-card risk, and misleading green states.

No product code, test code, config, server process, worker, live bot, provider DB, `.env`, SSH, tmux, or systemd target was modified or started. This was a single foreground visual-auditor handoff; no N-agent audit claim is made and no background agents were opened.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`
8. `package.json`
9. `playwright.config.ts`
10. `apps/web/package.json`
11. `packages/ui/src/theme.css`
12. `packages/ui/src/components.tsx`
13. `apps/web/src/app/globals.css`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/admin/bot-health-loader.ts`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `apps/web/src/features/admin/types.ts`
19. `apps/web/src/app/(app)/app/bots/page.tsx`
20. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
22. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
23. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
24. `apps/web/src/features/bots/data.tsx`
25. `apps/web/src/features/bots/meta.ts`
26. `tests/e2e/smoke.spec.ts`
27. `tests/e2e/admin-mobile-pg8.spec.ts`
28. `tests/e2e/bot-readiness-map.spec.ts`
29. `tests/integration/admin-responsive.test.ts`
30. `tests/e2e/screenshots/admin-bots-mobile375.png` (stale visual context only; timestamp predates Phase 3.86)
31. `tests/e2e/screenshots/admin-user-bots-mobile375.png` (stale visual context only; timestamp predates Phase 3.86)

## Files changed
None - read-only audit

## Findings
1. Severity: High. The Phase 3.86 warning summary UI still lacks a current browser/Playwright visual pass with populated warning rows. Evidence: the Phase 3.86 handoff explicitly says full UI/browser rendering was not rechecked and Playwright/screenshot checks were skipped (`docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md:77`, `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md:90-94`), while the existing 375px admin spec documents that demo mode renders empty states and relies on static table checks for real rows (`tests/e2e/admin-mobile-pg8.spec.ts:12-15`). Recommendation: add a populated warning-summary Playwright spec before accepting visual readiness. Target part: `/admin/bots`, `/admin/users/[userId]/bots`, user bot warning pages.
2. Severity: High. `/admin/bots` renders the new warning summary as a 5-column table and puts the warning list inside the mobile card-stack value cell; this is the highest horizontal-overflow risk when warning titles/details/code strings are present. Evidence: the table and warning cell are at `apps/web/src/app/admin/bots/page.tsx:152-198`; the responsive table rule keeps each `td` as a label/value flex row with a fixed `data-label` label (`packages/ui/src/theme.css:140-164`). Recommendation: the Playwright check must seed at least three warnings per row and assert `documentElement.scrollWidth <= clientWidth + 1`; likely CSS hardening is `td[data-label="Warnings"] { flex-direction: column; }` or a child wrapper with `min-width:0;width:100%;overflow-wrap:anywhere`. Target part: admin fleet canonical warning summary.
3. Severity: Medium. `/admin/users/[userId]/bots` puts several pills plus a full evaluated timestamp and long source label inside a `wtc-warning` detail block. Evidence: the canonical summary block uses `wtc-warning info`, pill cluster, `source: {bot.warningSummary.source}`, and `evaluated: {fmtDateTime(...)}` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:176-205`; `.wtc-pill` has no `max-width`, `min-width:0`, or `overflow-wrap` guard (`packages/ui/src/theme.css:77-86`), and `.wtc-warning` has no descendant shrink/wrap guard (`packages/ui/src/theme.css:97-102`). Recommendation: the visual spec should assert every visible `.wtc-pill` and `.wtc-warning` stays within its parent bounding box at 375/390px; likely CSS hardening is `max-width:100%; min-width:0; overflow-wrap:anywhere` for pills and warning body children. Target part: admin user bot warning summary.
4. Severity: Medium. Header rows on user bot pages can squeeze or overflow because `wtc-spread` does not wrap by default. Evidence: `.wtc-spread` is a non-wrapping flex row in `apps/web/src/app/globals.css:5`; the safety page and bot detail page use it around a `SectionHeader` plus status pills at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:23-27` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:138-143`. Recommendation: Playwright should check 375px/390px no-overlap for `/app/bots/tortila`, `/app/bots/legacy`, `/app/bots/tortila/safety`, and `/app/bots/legacy/safety`; likely markup fix is `style={{ flexWrap:'wrap', alignItems:'flex-start' }}` on these header spreads or a responsive `.wtc-spread` wrap rule. Target part: user bot warning headers.
5. Severity: Medium. `/app/bots/statistics` still uses the old direct warning list/empty state instead of the richer warning-summary state, so unavailable/not-evaluated warnings can visually collapse into "No adapter warnings." Evidence: Phase 3.86 called out this gap as a next action (`docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md:96-99`); the statistics page still renders `activeRead?.warnings.data` or `<EmptyState title="No adapter warnings" />` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393-400`. Recommendation: use `WarningSummaryPanel` or a compact equivalent on statistics, then browser-test unavailable, not-evaluated, none-reported, and warnings-present states. Target part: user statistics warning panel.
6. Severity: Medium. Some green states can read as stronger than the warning semantics allow. Evidence: safety shows `Active warnings` with `tone="up"` when `warningSummary.status === 'none_reported'` (`apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:47-55`), and the bot list health pill uses only coarse `health.status` (`apps/web/src/app/(app)/app/bots/page.tsx:71-84`) while the richer summary itself warns that no canonical codes is not a live-control all-clear (`apps/web/src/features/bots/WarningSummaryPanel.tsx:83-86`). Recommendation: keep zero/none-reported warning metrics neutral, and ensure any `ok` health pill is accompanied by visible warning-summary language when warnings are unavailable or not evaluated. Target part: user bot summary tone model.
7. Severity: Low. No direct nested `Card` inside `Card` pattern was found in the new warning-summary surfaces. Evidence: admin fleet summary is a table inside one card (`apps/web/src/app/admin/bots/page.tsx:152-198`), admin user summary is a `.wtc-warning` block inside each bot card (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:176-205`), and the reusable user summary is one top-level card (`apps/web/src/features/bots/WarningSummaryPanel.tsx:49-88`). Recommendation: keep warning details as banners/rows inside existing cards, and add a static guard for `.wtc-card .wtc-card` under warning-summary selectors if a future redesign frames individual warnings as cards. Target part: nested-card prevention.

## Decisions
1. Treat the retained admin mobile screenshots as stale context only; their timestamps predate the Phase 3.86 01:13 handoff and they do not certify the new warning-summary blocks.
2. Do not start `npm run dev`, `npm run preview:safe`, Playwright, worker ticks, or any live/provider process in this read-only audit.
3. The visual acceptance target should be populated-warning rendering, not only demo empty states.
4. The exact visual gate should include both desktop and mobile browser checks, plus retained screenshots and a reviewed visual manifest if screenshots become acceptance evidence.

## Risks
1. Without seeded populated warning rows, the current admin mobile regression suite can pass while the new warning cell/pill layouts overflow in real Postgres/canary data.
2. The stale retained screenshots are useful for shell shape only; relying on them as current Phase 3.86 proof would be a false visual claim.
3. Long runtime strings are currently sanitized to registry-owned copy, which lowers secret/PII risk, but warning codes, source labels, dates, and provider-account status pills can still create narrow-width layout pressure.

## Verification/tests
RUN:
1. Required docs/protocol reads completed.
2. Read-only source inspection of warning summary render sites and shared responsive CSS completed.
3. Existing retained screenshots inspected only as stale visual context: `tests/e2e/screenshots/admin-bots-mobile375.png` and `tests/e2e/screenshots/admin-user-bots-mobile375.png`.
4. `git status --short --branch` observed a heavily dirty worktree on `codex/bot-analytics-settings-canary-20260603`; all product/test changes were treated as pre-existing.

NOT RUN:
1. Playwright/e2e/browser preview - skipped by explicit read-only/no-server scope.
2. `npm run dev`, `npm run preview:safe`, Next build, Vitest, lint, typecheck, and secret scan - not run because this phase was source-only visual audit and no product/test code changed.
3. Worker tick/smoke, live bot start/stop/apply-config/retest, exchange/provider DB reads, `.env`, SSH, tmux, and systemd - not run by policy/scope.

Exact Playwright/browser checks to run next:
1. Add `tests/e2e/warning-summary-visual.spec.ts` with helper:
   - `noHScroll(page): document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`
   - `assertVisibleBoxesWithinViewport('.wtc-warning, .wtc-pill, .wtc-table-wrap')`
   - `assertNoCardNestingUnderWarningBlocks()`
2. Run desktop and mobile projects:
   - `npx playwright test tests/e2e/warning-summary-visual.spec.ts --project=desktop`
   - `npx playwright test tests/e2e/warning-summary-visual.spec.ts --project=mobile`
3. For mobile, explicitly set `375x812` in the test in addition to the default `390x844` mobile project.
4. Routes/checks:
   - `/admin/bots`: seed or fixture-populate `botWarningSummaries`; assert "Canonical warning summary" visible, at least one `notice` pill, no horizontal scroll, warnings cell wraps, and no green all-clear copy.
   - `/admin/users/<real-or-seeded-user-id>/bots`: assert canonical warning block visible for Tortila and Legacy, source/evaluated pills visible and contained, no text overlap, no nested cards.
   - `/app/bots`: assert `WarningSummaryInline` visible for entitled Tortila/Legacy, no green-only all-clear when warnings exist or are not evaluated.
   - `/app/bots/tortila` and `/app/bots/legacy`: assert `WarningSummaryPanel` visible, no header overlap, no horizontal scroll.
   - `/app/bots/tortila/safety` and `/app/bots/legacy/safety`: assert `Risk & audit warnings`, `Active warnings`, and summary states render without overflow; zero state is not misleadingly green when warnings are unavailable/not evaluated.
   - `/app/bots/statistics?bot=tortila` and `?bot=legacy`: after wiring summary state, assert warnings-present, unavailable, not-evaluated, and none-reported states are visually distinct.
5. If screenshots are retained as acceptance evidence, write a manifest under `logs/retained-visual-artifacts/<run>/visual-review.json` and validate it with:
   - `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run>/visual-review.json tests/e2e/screenshots`

## Next actions
1. Implement the populated warning-summary Playwright spec before claiming Phase 3.86 visual acceptance.
2. Harden warning summary CSS around mobile table warning cells, `.wtc-pill`, and `.wtc-warning` body shrink/wrap behavior if Playwright reproduces overflow.
3. Replace the statistics page's direct `warnings.data` empty state with the shared `WarningSummaryPanel` semantics.
4. Reconsider green tone use for zero warning counts and coarse healthy states so "none reported" never reads as "safe to control live bot."
