# phase-3-95-bot-rendered-admin-user-gate handoff
## Scope
Phase 3.95 reclassified the Phase 3.94 broad rendered failures, kept the current bot settings/warning/admin UI stable when the clean rendered gate passed, and added an opt-in DB-backed rendered acceptance harness for `/admin/users/<userId>/bots`.

The implementation does not start, stop, retest, apply config to, or probe live bots. It does not inspect env/vault/secret files, SSH, tmux, systemd, provider DBs, exchange APIs, or worker tick/restart paths. The new harness is local/throwaway-DB only, forces `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`, and refuses non-`wtc_test*` database names.

Per-agent handoffs:
- [`docs/handoffs/20260604-0424-bot-rendered-warning-admin-ux-auditor.md`](20260604-0424-bot-rendered-warning-admin-ux-auditor.md)
- [`docs/handoffs/20260604-0424-bot-rendered-gates-auditor.md`](20260604-0424-bot-rendered-gates-auditor.md)
- [`docs/handoffs/20260604-0424-admin-user-bot-drilldown-rendered-auditor.md`](20260604-0424-admin-user-bot-drilldown-rendered-auditor.md)

Background agents:
- `019e8f60-94bf-7110-b4b0-068ce961f608` closed after result collection.
- `019e8f60-a8dc-7823-b312-d633ac64f744` closed after result collection.
- `019e8f60-be0a-7492-9410-04bd3810dc6e` closed after result collection.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`
8. `docs/handoffs/20260604-0424-bot-rendered-warning-admin-ux-auditor.md`
9. `docs/handoffs/20260604-0424-bot-rendered-gates-auditor.md`
10. `docs/handoffs/20260604-0424-admin-user-bot-drilldown-rendered-auditor.md`
11. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
12. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
13. `apps/web/src/features/admin/user-bot-detail-loader.ts`
14. `apps/web/src/features/admin/queries.ts`
15. `apps/web/src/app/api/e2e/login/route.ts`
16. `tests/integration/admin-user-bot-detail-loader.test.ts`
17. `tests/integration/admin-user-bot-detail-static.test.ts`
18. `tests/e2e/admin-mobile-pg8.spec.ts`
19. `tests/e2e/warning-summary-visual.spec.ts`
20. `tests/e2e/bot-settings.spec.ts`
21. `tests/e2e/bot-readiness-map.spec.ts`
22. `tests/e2e/helpers/auth.ts`
23. `playwright.config.ts`
24. `playwright.auth-db.config.ts`
25. `playwright.lms-db.config.ts`
26. `scripts/run-auth-db-e2e.mjs`
27. `scripts/run-auth-db-e2e-managed.mjs`
28. `scripts/prepare-auth-db-e2e.ts`
29. `scripts/run-lms-db-e2e.mjs`
30. `scripts/run-lms-db-e2e-managed.mjs`
31. `scripts/prepare-lms-db-e2e.ts`
32. `package.json`
33. `.gitignore`
34. `eslint.config.js`

## Files changed
1. `.gitignore`
2. `eslint.config.js`
3. `package.json`
4. `playwright.config.ts`
5. `playwright.admin-user-bots-db.config.ts`
6. `scripts/prepare-admin-user-bot-detail-e2e.ts`
7. `scripts/run-admin-user-bot-detail-e2e.mjs`
8. `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
9. `tests/e2e/admin-user-bot-detail-db.spec.ts`
10. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
11. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
12. `docs/handoffs/20260604-0424-bot-rendered-warning-admin-ux-auditor.md`
13. `docs/handoffs/20260604-0424-bot-rendered-gates-auditor.md`
14. `docs/handoffs/20260604-0424-admin-user-bot-drilldown-rendered-auditor.md`
15. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`

## Findings
1. Severity: High. The Phase 3.94 broad rendered failure is not current for the four rendered files that failed/aborted before. Evidence: after deleting generated `apps/web/.next-e2e`, `E2E_PORT=3424 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile` passed `13` and skipped `1`; after this phase's edits and a fresh `.next-e2e` cleanup, the same rendered set on `E2E_PORT=3425` with `--reporter=line` again passed `13` and skipped `1`. Recommendation: classify the previous statistics/admin abort as stale `.next-e2e`/port contamination, not as a current UI copy/layout bug. Target part: rendered warning/statistics/admin gate.
2. Severity: High. The selected-user admin bot drilldown now has a guarded path for real populated rendered acceptance instead of only demo-empty e2e. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts` opens `/admin/users/${marker.userAId}/bots`, asserts selected-user visible facts, `storage: Postgres`, `LIVE CONTROL: DISABLED`, `user settings: read-only`, and absence of hidden user/raw/secret/action markers; `playwright.admin-user-bots-db.config.ts` requires the prepared marker/HMAC before starting Next; `scripts/prepare-admin-user-bot-detail-e2e.ts` seeds a selected-user fixture copied from the existing loader evidence shape. Recommendation: run `npm run e2e:admin-user-bots:db:managed` once a throwaway-DB admin URL is available. Target part: admin selected-user rendered acceptance.
3. Severity: High. The new rendered harness is opt-in and fail-closed. Evidence: `package.json` adds `e2e:admin-user-bots:db` and `e2e:admin-user-bots:db:managed`; `playwright.config.ts` excludes `admin-user-bot-detail-db.spec.ts` from default e2e; `scripts/prepare-admin-user-bot-detail-e2e.ts` refuses non-empty and non-`wtc_test*` DBs; the managed runner creates `wtc_test_admin_user_bots_*` and drops it with `WITH (FORCE)`. Recommendation: keep this gate outside `ci:local` until the CI job provisions a throwaway Postgres database. Target part: test operations safety.
4. Severity: High. Admin selected-user drilldown remains read-only for user settings and live control. Evidence: the Maxwell handoff found the route admin-gated and read-only, and the new e2e spec asserts no forms, CSRF hidden inputs, or start/stop/apply/test-connection buttons. Recommendation: future admin mutation work must remain in separate audited actions, not this drilldown. Target part: RBAC/mutation boundary.
5. Severity: Medium. The DB-backed rendered acceptance itself is not green in this phase because the required admin Postgres URL was not present. Evidence: `npm run e2e:admin-user-bots:db:managed` refused with the safe message asking for `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`. Recommendation: do not claim populated rendered acceptance green until that command creates/drops the throwaway DB and Playwright passes. Target part: DB-backed rendered acceptance.
6. Severity: Low. `npm run lint` initially found an unused `legacySymbolConfigsFromConfig` import in the bot statistics page; the import was removed and final lint passed. Recommendation: keep this cleanup because it is in the same warning/statistics gate area and prevents a full lint red. Target part: statistics page hygiene.

## Decisions
1. No production UI rewrite was made for warning/statistics/admin pages because clean rendered evidence passed.
2. The remaining real gap was treated as evidence coverage: populated admin-user drilldown browser acceptance.
3. The new browser gate is opt-in and excluded from default `npm run e2e`/`ci:local` because it requires a throwaway Postgres admin URL.
4. The actual DB-backed browser gate is recorded as NOT RUN rather than green because no `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was available.
5. Generated `apps/web/next-env.d.ts` churn from Playwright was restored to the checked-in `.next` reference.

## Risks
1. The worktree was heavily dirty before this phase; unrelated existing changes were preserved and not reverted.
2. The new prepared fixture duplicates the existing integration fixture shape. This is acceptable for a bounded acceptance harness, but a later cleanup could factor it into a shared test fixture if it starts drifting.
3. The new DB-backed e2e has not executed successfully yet because credentials were absent; only harness/static safety and existing loader coverage are green.
4. Existing long-running node processes on old ports are still present; this phase did not kill them.

## Verification/tests
RUN:
1. Required WTC protocol/status docs and the Phase 3.94 handoff were read before edits.
2. Three read-only agents were dispatched before edits and each wrote a per-agent handoff linked above.
3. Background agents `019e8f60-94bf-7110-b4b0-068ce961f608`, `019e8f60-a8dc-7823-b312-d633ac64f744`, and `019e8f60-be0a-7492-9410-04bd3810dc6e` were closed after result collection.
4. Clean broad rendered gate before edits: `E2E_PORT=3424 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile` - PASS, 13 passed / 1 skipped.
5. Focused admin-user harness/static/loader gate: `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 3 files / 13 tests. An earlier version of the new static test had one over-broad assertion and was fixed before the final green run.
6. `npm run typecheck` - PASS.
7. `npm run typecheck -w @wtc/web` - PASS.
8. `npm run lint` - PASS after removing the unused statistics import. An earlier run failed on that unused import.
9. `npm run e2e:admin-user-bots:db:managed` - safe refusal observed because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set; no DB was created and no rendered DB acceptance was run.
10. Clean broad rendered gate after edits: `E2E_PORT=3425 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile --reporter=line` - PASS, 13 passed / 1 skipped. A prior same-command attempt without `--reporter=line` exited before writing Playwright artifacts and was not counted green.
11. `git diff --check` - PASS before and after aggregate handoff.
12. `npm run secret:scan` - PASS before and after aggregate handoff.
13. `npm run governance:check` - PASS after aggregate handoff: current phase `20260604-0424`, 3 cited per-agent handoffs all present, 0 errors, 1 known historical warning (`20260529-1921-integration-risk-auditor.md` missing `## Files inspected`, exempt).

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed` as an actual populated rendered acceptance - blocked/refused because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set.
2. Full `npm test` - skipped for phase scope/time; focused admin-user static/loader/harness tests were run.
3. `npm run build` / `npm run build -w @wtc/web` - skipped for phase scope/time; typecheck/lint/rendered gates covered the changed harness and web config.
4. Full `npm run e2e` - skipped for phase scope/time; the relevant bot/settings/warning/admin rendered subset was run cleanly.
5. Real Postgres migration/seed outside the throwaway harness, provider DB checks, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret file inspection, SSH, tmux, systemd, and live server checks - forbidden by scope.

## Next actions
1. Provide `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` as a local/admin Postgres maintenance URL and run `npm run e2e:admin-user-bots:db:managed` to close populated rendered admin-user drilldown acceptance.
2. If that gate passes, retain only reviewed screenshots/artifacts and record the created/dropped throwaway DB name in the next aggregate handoff.
3. Continue toward the broader Legacy + Tortila completion goal with the next bounded phase: row-targeted config save errors or forbidden-key alias centralization are the next safest WTC-side quality slices.
