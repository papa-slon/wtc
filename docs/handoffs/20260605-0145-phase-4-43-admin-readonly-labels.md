# Phase 4.43 admin read-only labels handoff
## Scope
Copy-only/admin-safety phase for the WTC bot/admin surfaces. The goal was to close the Phase 4.41 UX gap by making admin entry-point actions explicitly read-only, preserving selected-user inspection boundaries, and proving the labels locally without live provider, worker, managed DB, deploy, or bot-control mutation.

Three read-only agents were launched before implementation and then closed:
- [admin-readonly-label-ux-auditor](20260605-0145-admin-readonly-label-ux-auditor.md)
- [admin-readonly-label-safety-auditor](20260605-0145-admin-readonly-label-safety-auditor.md)
- [admin-readonly-label-gates-auditor](20260605-0145-admin-readonly-label-gates-auditor.md)

## Files inspected
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/actions.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md`
- `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`

## Files changed
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `docs/handoffs/20260605-0145-admin-readonly-label-ux-auditor.md`
- `docs/handoffs/20260605-0145-admin-readonly-label-safety-auditor.md`
- `docs/handoffs/20260605-0145-admin-readonly-label-gates-auditor.md`
- `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Findings
1. Severity P2 - Admin entry-point actions were still too generic in places. Evidence: the Phase 4.41 UX handoff identified `/admin/users` labels such as `Open ... drilldown`, and this phase's agents found the remaining `Open details` mapped-user helper in `/admin/bots`. Recommendation: use explicit read-only action text for admin navigation into selected-user bot views. Target part: `/admin/users` owner selector, users table, `/admin/bots` owner drilldown, and mapped-user summaries.
2. Severity P2 - Rendered coverage previously asserted the admin sections but not the read-only copy itself. Evidence: `tests/e2e/smoke.spec.ts` and `tests/e2e/admin-mobile-pg8.spec.ts` opened the relevant admin pages without checking the explicit read-only boundary text. Recommendation: add stable rendered assertions for read-only user settings/statistics, read-only admin evidence, and selected-user no-live-control pills. Target part: local rendered admin proof.
3. Severity P2 - The safety model still implied the current UI shows a read-only disabled `Stop Bot` button. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md` old copy described a read-only `Stop Bot` placeholder, while current admin/user bot evidence pages expose no runtime controls. Recommendation: clarify that current evidence pages show no runtime control buttons; any future disabled control affordance needs separate audit scope. Target part: bot-control safety model.
4. Severity P3 - Legacy missing-mapping copy could be read as permission for ad hoc admin mapping inside the selected-user page. Evidence: selected-user Legacy warning copy said rows remained fleet diagnostics until an admin maps a provider account. Recommendation: clarify that mapping happens through a separate audited provider-mapping workflow. Target part: selected-user Legacy provider warning.

## Decisions
- `/admin/users` now uses `Open read-only bot view`, `Open read-only Tortila view`, `Open read-only Legacy view`, and `Read-only bot view`; unmapped Legacy remains `Open fleet diagnostics`.
- `/admin/bots` now uses `Open read-only user view` for both primary owner drilldown buttons and mapped-user summary links.
- Selected-user Legacy missing-mapping copy now names a separate audited provider-mapping workflow.
- Current bot evidence pages remain no-runtime-control surfaces; disabled control affordances are future/audited only.
- Kept this phase local/no-env and did not add admin edit controls.

## Risks
- The worktree was heavily dirty before this phase; unrelated existing modifications and untracked files remain.
- Browser tests write screenshots and `test-results` artifacts; this phase used them as local evidence but did not perform visual-inventory review.
- Row-level mapped-user labels in demo mode are proven statically because `/admin/users` has no demo user rows when Postgres is absent.
- This phase does not prove managed DB matrices, live provider data, live bot control, deploy, GitHub CI, or production monitoring.

## Verification/tests
RUN:
1. `git status --short --branch` - confirmed current branch and dirty state before edits.
2. Read-only `rg`/`Get-Content` inspections of the admin pages, static tests, E2E specs, safety model, and Phase 4.41 handoffs.
3. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts` - PASS, 3 files, 80 tests.
4. `E2E_PORT=3490 npx playwright test tests/e2e/admin-mobile-pg8.spec.ts` - PASS, 1 passed, 1 skipped.
5. `E2E_PORT=3490 npx playwright test tests/e2e/smoke.spec.ts` - PASS, 34 passed.
6. `npm run typecheck -- --pretty false` - PASS.
7. `npm run secret:scan` - PASS.
8. `git diff --check` - PASS.

FAILED/REPAIRED:
- `E2E_PORT=3490 npx playwright test tests/e2e/smoke.spec.ts tests/e2e/admin-mobile-pg8.spec.ts` initially failed after 34 passes and 1 skip because a new `/admin/users/demo-user/bots` assertion expected `Selected-user read-only drilldown`, which is not rendered in demo/no-DB empty detail state. The assertion was changed to stable read-only intro/pill copy, and the focused PG8 plus smoke runs passed afterward.

NOT RUN:
- `npm run accept:bots:local` - not needed for this copy-only phase; it was green in Phase 4.42.
- `npm run accept:bots:rendered` - not run as the full rendered pack; targeted smoke and PG8 were run instead.
- `npm run accept:bots:continuity:contract` - not run; continuity code was unchanged in this phase.
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
- Legacy closed-trade source/importer proof - not run; source remains unproven.
- Live exchange/provider probes, live bot start/stop/apply-config, close-position/live config mutation, deploy/canary publish, GitHub CI, SSH/systemd/tmux, and production monitoring - not run by safety scope.

## Next actions
1. If env is supplied, run managed worker continuity and admin selected-user DB matrix as separate phases.
2. Keep Legacy closed-trade analytics blocked until a source-proof artifact identifies a durable table/API and replay contract.
3. Keep live exchange/provider probes and live bot controls disabled until bot-integration plus security audits explicitly approve them.
4. If publishing this dirty tree, run a dedicated git/CI/deploy phase with branch/commit/PR or canary deploy proof.
