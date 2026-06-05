# admin-readonly-label-ux-auditor handoff
## Scope
Read-only Phase 4.43 UX copy audit for admin entry-point bot/user drilldown labels. Inspected whether admin actions on `/admin/users` and `/admin/bots` explicitly communicate read-only behavior, with attention to the requested UI and test files. No product code, tests, live providers, deploy commands, DB mutation, or reversions were performed.

## Files inspected
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md`

## Files changed
docs/handoffs/20260605-0145-admin-readonly-label-ux-auditor.md

## Findings
1. Severity P2 - One remaining admin fleet mapped-user action is still generic even though it opens the selected-user bot detail surface. Evidence: `apps/web/src/app/admin/bots/page.tsx:197` links to `/admin/users/${mappedUser.userId}/bots`, `apps/web/src/app/admin/bots/page.tsx:198` renders `Open details`, and that helper is used in user/provider drilldown contexts at `apps/web/src/app/admin/bots/page.tsx:774`, `apps/web/src/app/admin/bots/page.tsx:831`, `apps/web/src/app/admin/bots/page.tsx:860`, and `apps/web/src/app/admin/bots/page.tsx:883`. Recommendation: change the helper label from `Open details` to `Open read-only user view` to match the primary owner drilldown action. Target part: admin bot fleet mapped-user links in Tortila owner, Legacy account, active slot, and active order tables.

2. Severity P3 - The main requested entry-point labels are now in the desired read-only shape and should be preserved. Evidence: `apps/web/src/app/admin/users/page.tsx:66` uses `Open read-only bot view`, `apps/web/src/app/admin/users/page.tsx:82` uses `Open read-only Tortila view`, `apps/web/src/app/admin/users/page.tsx:103` uses `Open read-only Legacy view` for mapped rows, and `apps/web/src/app/admin/users/page.tsx:306` uses `Read-only bot view`; `apps/web/src/app/admin/bots/page.tsx:215` uses `Open read-only user view`. Recommendation: do not revert these to `drilldown`, `details`, or `manage`; keep unmapped Legacy as `Open fleet diagnostics`. Target part: `/admin/users` bot owner selector, users table actions, and `/admin/bots` owner drilldown action.

3. Severity P3 - Static tests cover the newly read-only primary labels but do not yet guard against the remaining generic `Open details` mapped-user helper. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:317` expects `Open read-only Legacy view`, `tests/integration/admin-user-bot-detail-static.test.ts:338` expects `Open read-only user view`, and `tests/integration/bot-read-safety-static.test.ts:394` expects `Open read-only user view`, while the helper itself still renders `Open details` at `apps/web/src/app/admin/bots/page.tsx:198`. Recommendation: after the copy-only label change, add static assertions near those tests that `adminBots` contains `Open read-only user view` for mapped-user summaries and does not contain `Open details`. Target part: admin read-only label regression coverage.

4. Severity P3 - Browser smoke/mobile checks verify the read-only sections but not the exact row action copy, so they should stay broad unless seeded rows are available. Evidence: `tests/e2e/smoke.spec.ts:183` to `tests/e2e/smoke.spec.ts:195` visits `/admin/users` and asserts the selector/inspection banner, and `tests/e2e/admin-mobile-pg8.spec.ts:52` to `tests/e2e/admin-mobile-pg8.spec.ts:55` asserts `/admin/bots` continuity/evidence sections at 375px. Recommendation: do not force row-action assertions into demo-mode E2E unless fixtures guarantee mapped rows; prefer the static assertions above for the exact label. Target part: smoke and mobile admin read-only copy coverage.

## Decisions
- Recommended one product-copy change only: `apps/web/src/app/admin/bots/page.tsx` mapped-user helper label `Open details` -> `Open read-only user view`.
- Preserve the already-applied `/admin/users` and primary `/admin/bots` read-only action labels.
- Keep the implementation copy-only and no-env; no live provider, deploy, DB migration, worker tick, or managed DB gate is needed for this label pass.

## Risks
- The worktree was heavily dirty before this audit, including the inspected product/test files.
- The inspected files changed during the audit window; this handoff reflects the current on-disk source after re-reading the affected snippets.
- Without a static assertion that forbids `Open details`, future label churn could reintroduce ambiguous admin drilldown copy without breaking the existing tests.
- This audit does not prove rendered row behavior for mapped users in a managed DB/browser environment.

## Verification/tests
RUN:
- `git status --short --branch` - inspected branch and dirty state only.
- Read-only `rg` and `Get-Content` inspections of requested admin UI, smoke/mobile specs, static integration specs, and the Phase 4.41 UX next-gap handoff.

NOT RUN:
- Product code edits or test edits - explicitly out of scope.
- Playwright, Vitest, lint, typecheck, build, secret scan, governance, rendered acceptance, managed DB browser proof, worker continuity, live provider probes, live bot start/stop/apply-config, DB migrate/seed, deploy, SSH/systemd/tmux, GitHub CI, or production monitoring - out of scope for this read-only copy audit.

## Next actions
1. In `apps/web/src/app/admin/bots/page.tsx`, change the mapped-user helper link text at `mappedUserSummary` from `Open details` to `Open read-only user view`.
2. In `tests/integration/admin-user-bot-detail-static.test.ts` and/or `tests/integration/bot-read-safety-static.test.ts`, add a static guard that the admin bots page does not contain `Open details`.
3. Keep the current `/admin/users` labels as-is: `Open read-only bot view`, `Open read-only Tortila view`, `Open read-only Legacy view`, `Read-only bot view`, and `Open fleet diagnostics` for unmapped Legacy.
