# admin-readonly-label-gates-auditor handoff
## Scope
Read-only Phase 4.43 gates audit for the admin read-only label copy phase.

Objective checked: identify the minimal focused tests/gates to update and run for a copy-only admin label change that makes admin user/bot drilldown actions explicitly read-only. No product code or tests were edited.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`

## Files changed
- `docs/handoffs/20260605-0145-admin-readonly-label-gates-auditor.md`

## Findings
1. Severity P2 - Rendered E2E coverage still does not assert the new admin read-only action labels, even though the copy phase is specifically about clickable label wording. Evidence: `tests/e2e/smoke.spec.ts:183` opens `/admin/users`, `tests/e2e/smoke.spec.ts:184` to `tests/e2e/smoke.spec.ts:188` assert heading, selector, warning, and Global defaults link only; `tests/e2e/admin-mobile-pg8.spec.ts:52` to `tests/e2e/admin-mobile-pg8.spec.ts:56` assert `/admin/bots` continuity/evidence text but not `Open read-only user view`. Recommendation: update only `tests/e2e/smoke.spec.ts` and `tests/e2e/admin-mobile-pg8.spec.ts` with rendered assertions for the read-only action labels. Target part: rendered admin read-only label proof.
2. Severity P2 - Static label guards are already aligned with the current read-only copy and should be run, not expanded broadly. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:301` expects `Read-only bot view`, `tests/integration/admin-user-bot-detail-static.test.ts:317` expects `Open read-only Legacy view`, `tests/integration/admin-user-bot-detail-static.test.ts:338` expects `Open read-only user view`; `tests/integration/bot-read-safety-static.test.ts:394` expects `Open read-only user view`, and `tests/integration/bot-read-safety-static.test.ts:428` to `tests/integration/bot-read-safety-static.test.ts:430` expect the read-only Tortila/Legacy/fleet labels. Recommendation: keep these two static tests in the minimal gate list and avoid unrelated static-test edits unless product copy changes again. Target part: static admin read-only label guards.
3. Severity P2 - Existing npm acceptance gates are broader than a copy-only label phase. Evidence: `package.json:44` maps `accept:bots:rendered` to `node scripts/gates.mjs bot-admin-e2e`, while `scripts/gates.mjs:145` to `scripts/gates.mjs:154` run smoke, bot settings, readiness, statistics, warnings, and admin mobile; `scripts/gates.mjs:157` to `scripts/gates.mjs:159` add visual inventory, and `scripts/gates.mjs:173` to `scripts/gates.mjs:174` wire the rendered/local plans to those broader gates. Recommendation: for this phase, either run raw targeted commands or add a narrow gate plan for admin-readonly-label only; do not require `accept:bots:local` or worker continuity for this copy-only proof. Target part: package/gates minimal acceptance surface.
4. Severity P3 - `admin-responsive.test.ts` is a useful cheap mobile companion gate, but it is not semantic proof of the read-only labels. Evidence: `tests/integration/admin-responsive.test.ts:21` and `tests/integration/admin-responsive.test.ts:26` include `/admin/users` and `/admin/bots` in the admin page set; `tests/integration/admin-responsive.test.ts:78` to `tests/integration/admin-responsive.test.ts:81` assert table card-stack `data-label` coverage, and `tests/integration/admin-responsive.test.ts:86` to `tests/integration/admin-responsive.test.ts:90` assert `StatusPill` presence. Recommendation: run it after the label change to protect PG8/table readability, but do not count it as the label assertion gate. Target part: PG8 mobile/static regression guard.
5. Severity P3 - The prior UX handoff already narrowed the next slice to no-env copy plus local assertions, and explicitly excluded managed/live/source gates. Evidence: `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md:75` to `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md:82` specify the label copy, the exact E2E/static files to update, and the short local proof; `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md:57` to `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md:58` exclude managed/live/source proof. Recommendation: keep Phase 4.43 bounded to local no-env rendered/static checks; do not introduce DB-managed, provider, deploy, or worker gates. Target part: phase scope and gate boundaries.

## Decisions
- Minimal tests to update: `tests/e2e/smoke.spec.ts` and `tests/e2e/admin-mobile-pg8.spec.ts`.
- Minimal tests already updated/aligned and to run: `tests/integration/admin-user-bot-detail-static.test.ts` and `tests/integration/bot-read-safety-static.test.ts`.
- Companion mobile/static gate to run: `tests/integration/admin-responsive.test.ts`.
- Minimal rendered command after E2E updates: `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/admin-mobile-pg8.spec.ts`.
- Minimal static command after copy/test updates: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts`.
- Optional broader proof only if the operator wants refreshed screenshot inventory: `npm run accept:bots:rendered`.
- Not needed for this copy-only phase: `npm run accept:bots:local`, worker smoke/continuity, DB managed matrix, live/provider/source/importer/deploy gates, full CI/local build stack.

## Risks
- The worktree was already heavily dirty before this audit, including focus files; this handoff does not classify or reconcile unrelated dirty work.
- Playwright specs write screenshots under `tests/e2e/screenshots`; evidence: `tests/e2e/smoke.spec.ts:4` defines screenshot paths and `tests/e2e/admin-mobile-pg8.spec.ts:65` writes mobile screenshots. Running rendered gates may change retained visual artifacts.
- If the rendered admin demo data does not expose mapped owner rows in a given project/browser mode, the `/admin/bots` E2E label assertion may need to assert the stable warning copy plus keep the static `Open read-only user view` guard as the row-level proof.
- No managed DB, live provider, deployment, CI, or production behavior is proven by this audit.

## Verification/tests
- Ran read-only `git status --short` and confirmed a heavily dirty worktree before writing this handoff.
- Ran read-only `rg`/`Get-Content` inspections of the requested focus files and the two admin source pages that contain the target labels.
- Confirmed no remaining generic `Open bot drilldown`, `Open Tortila drilldown`, `Open Legacy drilldown`, or `Open user drilldown` strings under `apps/web/src/app/admin`, `tests/e2e`, or `tests/integration`.
- Did not run Vitest, Playwright, npm gates, worker, DB, provider, live, deploy, or CI commands; this was a read-only gate-selection audit, and Playwright would write screenshots.

## Next actions
1. Update `tests/e2e/smoke.spec.ts` to assert the `/admin/users` read-only action labels rendered by the admin user directory.
2. Update `tests/e2e/admin-mobile-pg8.spec.ts` to assert the `/admin/bots` read-only owner action label where mapped owner rows render, while keeping the no-horizontal-scroll PG8 checks.
3. Run `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts`.
4. Run `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/admin-mobile-pg8.spec.ts`.
5. Use `npm run accept:bots:rendered` only as optional broader rendered evidence if screenshot inventory refresh is desired.
