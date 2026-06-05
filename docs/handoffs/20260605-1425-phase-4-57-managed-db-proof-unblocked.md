# Phase 4.57 handoff - Managed DB proof unblocked

## Scope
Phase 4.57 resumed the blocked Legacy/Tortila bot completion lane after the operator explicitly approved inspecting and using local demo/test data. The phase goal was to stop the loop around "env not supplied" by provisioning an isolated local disposable Postgres admin lane, running the previously blocked managed DB gates, fixing any fresh gate failures, and recording exact evidence without enabling live bot control.

In scope:
- Launch/read three read-only audit agents before edits.
- Use only local disposable Postgres create/drop harnesses.
- Fix fresh test/UI/runtime defects found by the managed gates.
- Run focused static/integration, browser DB, worker-continuity, type/build/lint/security/governance checks.
- Update docs/status with exact RUN and NOT RUN gates.

Out of scope:
- Live exchange/provider pings.
- `/api/marks`.
- Live bot start/stop/apply-config/test-connection.
- Production-shaped DB mutation.
- Legacy closed-trade import without a valid source artifact.
- Tortila real journal/auth/firewall acceptance.
- Deploy, CI, monitoring, or burn-in.

## Agent handoffs
- [20260605-1425-test-db-env-discovery-auditor.md](20260605-1425-test-db-env-discovery-auditor.md)
- [20260605-1425-source-artifact-discovery-auditor.md](20260605-1425-source-artifact-discovery-auditor.md)
- [20260605-1425-safety-gate-orchestration-auditor.md](20260605-1425-safety-gate-orchestration-auditor.md)

The operator thread had three background agents in context:
- `019e96ac-b0c4-7f32-bee1-0f221b0fa8b4`
- `019e96ad-06ab-7c10-99e9-dda96a9e6556`
- `019e96ad-531f-7231-ab4f-f905a40fda4a`

All three handoff files are present. The agents were completed before this aggregate was written and are closed during final cleanup before the user-facing report.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1411-phase-4-56-blocked-threshold.md`
- `docs/handoffs/20260605-1425-test-db-env-discovery-auditor.md`
- `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md`
- `docs/handoffs/20260605-1425-safety-gate-orchestration-auditor.md`
- `package.json`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/globals.css`
- `packages/ui/src/theme.css`

## Files changed
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-worker-continuity-managed.mjs`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/globals.css`
- `packages/ui/src/theme.css`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`

## Findings
1. Severity P0 - The previous Phase 4.56 managed DB blocker is cleared locally. An isolated local Postgres admin lane was used only for disposable `wtc_test_*` databases; the managed runners created and dropped every target DB.
2. Severity P0 - The current-user Tortila DB route proof is green. `npm run e2e:admin-user-bots:db:managed:user-routes` passed 2/2 desktop/mobile tests after seeding hostile real-source Mark/uPnL values and proving `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render safe unavailable states without `/api/marks` or secret/raw marker leaks.
3. Severity P0 - The selected-user admin DB scenario matrix is green. `npm run e2e:admin-user-bots:db:managed:matrix` passed 8/8 browser tests across `degraded-readable`, `fresh-green`, `stale`, and `missing` scenarios on desktop/mobile.
4. Severity P0 - Worker continuity is green in a disposable DB. `npm run accept:worker:continuity:managed` passed with `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, and `legacy=ok`.
5. Severity P1 - The gate failures were fresh drift, not an infinite loop. The remaining failures were stale static expectations and strict selectors after implementation moved to scoped copy (`user evidence present; aggregate worker pending`) and shell-aware no-form checks (`main form`).
6. Severity P1 - The worker continuity runner had a real SQL column bug. It queried `ORDER BY checked_at DESC` even though the actual DB column is `created_at`; the runner now uses `created_at`, and a static guard prevents regression.
7. Severity P1 - Mobile horizontal scroll risk was real and fixed. User positions table cells now carry mobile labels inside a table wrapper, `.wtc-main` clips page-level overflow, and the fixed mobile nav no longer widens the viewport.
8. Severity P0 - Remaining true blockers are external/live/source gates, not local managed DB proof: Legacy closed-trade import still lacks a valid source artifact, Tortila real journal/auth/firewall proof was not run, live bot control remains disabled, and deploy/CI/live monitoring were not performed in this phase.

## Decisions
1. Reclassify the managed DB gates from blocked/not-run to locally green for this branch state.
2. Keep `/api/marks`, exchange/provider probes, and live bot control disabled.
3. Keep admin selected-user drilldowns read-only; admins can inspect user settings/statistics/provider evidence but cannot mutate user-owned runtime settings.
4. Keep Legacy realized performance metrics fail-closed until a real source artifact proves stable closed-trade/fill identity, provider scope, replay semantics, realized PnL, fees/funding, timestamps, exit reason, and raw-payload allowlist.
5. Treat Tortila local DB/journal artifacts found by the source auditor as candidates for a separate read-only real-read phase, not as completed acceptance proof.

## Risks
1. This is local disposable-DB proof, not production deployment or live runtime burn-in.
2. A future rerun must still use isolated admin maintenance DB credentials; the managed runners intentionally create/drop `wtc_test_*` databases.
3. Legacy closed-trade analytics remain honest-pending until source proof exists; inactive orders, slots, position snapshots, Tortila rows, and GTE/Axioma manual journal rows are still invalid substitutes.
4. Tortila real-read proof still needs a controlled read-only harness that proves authenticated source reads without `/api/marks`.
5. The worktree is broad and dirty; any PR/deploy phase must stage intentionally and run exact-tree CI/deploy verification.

## Verification/tests
RUN:
1. `git status --short --branch` - broad dirty tree confirmed on `codex/bot-analytics-settings-canary-20260603`.
2. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS; 3 files, 18 tests.
3. `npm run e2e:admin-user-bots:db:managed:user-routes` with isolated local admin Postgres env - PASS; 2/2 Playwright tests.
4. `npm run e2e:admin-user-bots:db:managed:matrix` with isolated local admin Postgres env - PASS; 8/8 Playwright tests across four runtime scenarios.
5. `npm run accept:worker:continuity:managed` with isolated local admin Postgres env - PASS; worker continuity tuple OK.
6. `npm run typecheck` - PASS.
7. `npm run typecheck -w @wtc/web` - PASS.
8. `npm run typecheck -w @wtc/worker` - PASS.
9. `npm run lint` - PASS.
10. `npm run build -w @wtc/web` - PASS; Next production build compiled and generated 36 static pages.
11. `npm run secret:scan` - PASS.
12. `git diff --check` - PASS.
13. Artifact marker scan over `test-results`, `playwright-report`, `.next-e2e-admin-user-bots`, and `tests/e2e/screenshots` textual artifacts - PASS.
14. `npm run governance:check` before this aggregate - PASS with 0 errors and one known historical heading warning; it still saw Phase 4.56 as current before this handoff existed.
15. `npm run governance:check` after this aggregate/status update - PASS with 0 errors and one known historical heading warning; it sees `20260605-1425-phase-4-57-managed-db-proof-unblocked.md` as the current aggregate and all three cited agent handoffs are present.
16. `git diff --check` after docs update - PASS.

NOT RUN:
1. Tortila real journal/auth/firewall read gate - NOT RUN; separate read-only source phase required.
2. Legacy closed-trade source/import gate - NOT RUN; no valid `LEGACY_SOURCE_ARTIFACT` was supplied or proven.
3. `/api/marks` - NOT RUN; WTC contract excludes it.
4. Exchange pings, provider live probes, live bot start/stop/apply-config/test-connection - NOT RUN; still prohibited.
5. Production DB migration/seed/create/drop - NOT RUN; only disposable local `wtc_test_*` targets were created/dropped.
6. Deploy, remote CI, post-deploy monitoring, and burn-in - NOT RUN; separate release phase required.
7. Full root `npm test` and `npm run accept:bots:local` - NOT RUN in this phase; focused and production-build gates above were run instead.

## Next actions
1. If UI/runtime code changes again, rerun the same managed DB trio: user-routes, matrix, and worker continuity.
2. Start a separate Tortila real-read proof only when a read-only journal/source harness is approved; prove `sourceAdapter=tortila`, `readState=ok`, redacted output, no `/api/marks`, and no live bot control.
3. Start a separate Legacy source-proof/import phase only when a valid source artifact names all closed-trade/fill fields required by the existing contract.
4. Start a dedicated release phase for staging/commit/PR/deploy/CI/post-deploy smoke if this local tree should ship.
