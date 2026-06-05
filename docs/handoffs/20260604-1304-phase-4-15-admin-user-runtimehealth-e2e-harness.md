# Phase 4.15 - admin user runtimeHealth DB E2E harness
## Scope
Strengthen the selected-user admin bot drilldown acceptance harness so the opt-in DB-backed browser test proves `runtimeHealth` is actually rendered for the chosen user's Tortila and Legacy bot cards. This phase is coverage-only for the bot/admin slice: no app runtime behavior was changed, no live bot control was enabled, no exchange/provider call was made, and no DB-backed browser or worker continuity acceptance was run without an explicit throwaway Postgres target.

Read-only agents launched before edits:
- [20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md](20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md)
- [20260604-1253-bot-acceptance-gates-auditor.md](20260604-1253-bot-acceptance-gates-auditor.md)
- [20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md](20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md)

All three background agents completed and were closed after their results were collected.

## Files inspected
- `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md`
- `docs/handoffs/20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md`
- `docs/handoffs/20260604-1253-bot-acceptance-gates-auditor.md`
- `docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `scripts/gates.mjs`
- `logs/gates/test.log`

## Files changed
- `scripts/prepare-admin-user-bot-detail-e2e.ts` - added safe `readStateDetail` canaries for the Tortila and Legacy selected-user runtime health rows.
- `tests/e2e/admin-user-bot-detail-db.spec.ts` - added direct rendered assertions for `Runtime health`, `Runtime scope`, runtime status pills, overview runtime scope strings, degraded-but-readable statistics gating, and the sanitized health detail copy.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - locked the new prep markers and browser assertions in the static harness.
- `docs/handoffs/20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1253-bot-acceptance-gates-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md` - this aggregate handoff.

## Findings
1. Severity P1 - evidence `tests/e2e/admin-user-bot-detail-db.spec.ts:133`, `tests/e2e/admin-user-bot-detail-db.spec.ts:135`, `tests/e2e/admin-user-bot-detail-db.spec.ts:136`, `tests/e2e/admin-user-bot-detail-db.spec.ts:137`, `tests/e2e/admin-user-bot-detail-db.spec.ts:138`, `tests/e2e/admin-user-bot-detail-db.spec.ts:139` - recommendation: keep these direct rendered assertions as the acceptance proof for selected-user runtimeHealth consumption; target part: admin selected-user DB E2E. The spec now fails if runtime health is no longer visible in the selected-user drilldown.
2. Severity P1 - evidence `scripts/prepare-admin-user-bot-detail-e2e.ts:393`, `scripts/prepare-admin-user-bot-detail-e2e.ts:401`, `tests/e2e/admin-user-bot-detail-db.spec.ts:140`, `tests/e2e/admin-user-bot-detail-db.spec.ts:141`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:63`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:90` - recommendation: preserve sanitized `readStateDetail` fixture strings so the browser proof covers rendered health notes without exposing tokens or raw provider detail; target part: DB E2E prep and browser spec.
3. Severity P1 - evidence `package.json:34`, `package.json:35`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:16`, `scripts/prepare-admin-user-bot-detail-e2e.ts:32`, `playwright.admin-user-bots-db.config.ts:14` - recommendation: keep `npm run e2e:admin-user-bots:db` and `npm run e2e:admin-user-bots:db:managed` NOT RUN unless an explicit fresh throwaway DB URL or approved maintenance admin URL is provided; target part: DB mutation safety.
4. Severity P1 - evidence `logs/gates/test.log`, `tests/integration/cabinet-pg9.test.ts:111` - recommendation: treat the failed full `npm test` gate as outside this bot phase and resolve in a separate cabinet/setup phase; target part: unrelated dirty cabinet work. The isolated repro is `npx vitest run tests/integration/cabinet-pg9.test.ts`, which still fails 1 of 18 tests because the test expects at least two `if (!access.allowed) return;` checks and sees one.
5. Severity P2 - evidence `docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md`, `tests/integration/admin-user-bot-detail-loader.test.ts` - recommendation: the next bot acceptance slice should design a dedicated browser fixture for fresh-green, stale, and missing runtime states; target part: selected-user runtimeHealth browser matrix. Loader-level tests already cover stale and missing DTO behavior, but the browser DB fixture in this phase intentionally covers degraded-but-readable state only.

## Decisions
- Keep this phase coverage-only. No app UI, loader, worker, schema, adapter, or live-control behavior was changed.
- Do not run or claim DB-backed admin browser acceptance without a disposable Postgres target.
- Do not run or claim live/DB worker continuity without an explicit throwaway `DATABASE_URL`.
- Keep the unrelated cabinet/setup failure documented instead of expanding this bot phase into a cabinet repair.
- Continue to report the checkout as heavily dirty/untracked; this phase worked with existing dirty state and did not revert user or prior generated changes.

## Risks
- The DB-backed browser E2E itself was not executed in this phase, so the new rendered assertions are locked by static harness and loader tests but not yet by a real Postgres browser run.
- Full `node scripts/gates.mjs core` is not green because `npm test` fails in `tests/integration/cabinet-pg9.test.ts` and the same run later recorded a Vitest worker OOM. This is not caused by the bot files changed here, but it prevents claiming full local core green.
- Fresh-green, stale, and missing runtimeHealth browser states remain a separate acceptance gap. Adding them honestly requires dedicated latest-row fixture design or separate DB runs because product health rows are global by target.
- Many files in the checkout were already modified or untracked before this phase, including cabinet files. Gate results should be interpreted against that dirty worktree.

## Verification/tests
RUN:
- `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - passed, 1 file / 6 tests.
- `npm run e2e:admin-user-bots:db:managed -- --help` - passed; printed safe usage without DB mutation.
- `npx eslint scripts/prepare-admin-user-bot-detail-e2e.ts tests/e2e/admin-user-bot-detail-db.spec.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts --max-warnings 0` - passed.
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - passed, 3 files / 18 tests.
- `node scripts/gates.mjs core` - partial: governance, check:core, lint, typecheck, typecheck-web, secret:scan, and db:generate passed; `test` failed due `tests/integration/cabinet-pg9.test.ts`.
- `npx vitest run tests/integration/cabinet-pg9.test.ts` - failed, 1 of 18 tests, confirming the unrelated cabinet failure outside the bot slice.
- `git diff --check` - passed.

NOT RUN:
- `npm run e2e:admin-user-bots:db` - no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- `npx playwright test -c playwright.admin-user-bots-db.config.ts` - requires runner-created env and prepared marker.
- `npm run accept:worker:continuity` - no explicit throwaway `DATABASE_URL` was provided; no DB-backed/live worker continuity proof was observed in this phase.
- Full Playwright, production build, deploy, SSH/tmux/systemd, live bot start/stop/apply-config, exchange/provider calls, raw env or secret value reads - skipped by scope and safety policy.

## Next actions
1. When a disposable Postgres target is available, run `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<redacted maintenance postgres url> npm run e2e:admin-user-bots:db:managed`; record only the redacted DB identity, runner mode, cleanup result, and screenshots/artifact review outcome.
2. If the operator wants worker continuity proof, run `npm run accept:worker:continuity` only with an explicit throwaway `DATABASE_URL`; otherwise keep it NOT RUN.
3. Build the next selected-user browser matrix for fresh-green, stale, and missing runtimeHealth states without false greens from newer same-target health rows.
4. Resolve the unrelated cabinet/setup test failure in a separate phase before claiming full `npm test` or `node scripts/gates.mjs core` green.
