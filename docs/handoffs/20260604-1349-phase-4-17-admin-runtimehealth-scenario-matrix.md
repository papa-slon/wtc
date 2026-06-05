# Phase 4.17 - admin runtimeHealth scenario matrix
## Scope
Strengthen the selected-user admin bot detail DB E2E harness so runtimeHealth browser acceptance can be run honestly for four distinct states: `degraded-readable`, `fresh-green`, `stale`, and `missing`. This phase is harness/acceptance infrastructure only. It does not change the admin user bot UI contract, loader semantics, schema, worker runtime behavior, live bot control, exchange/provider connectivity, or user/admin permission model.

Read-only agents launched before edits:
- [20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md](20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md)
- [20260604-1325-admin-runtimehealth-loader-ui-matrix-auditor.md](20260604-1325-admin-runtimehealth-loader-ui-matrix-auditor.md)
- [20260604-1325-admin-runtimehealth-gates-security-auditor.md](20260604-1325-admin-runtimehealth-gates-security-auditor.md)

All three background agents completed and were closed after their results were collected.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`
- `docs/handoffs/20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md`
- `docs/handoffs/20260604-1325-admin-runtimehealth-loader-ui-matrix-auditor.md`
- `docs/handoffs/20260604-1325-admin-runtimehealth-gates-security-auditor.md`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `package.json`
- `playwright.admin-user-bots-db.config.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `logs/gates/test.log`

## Files changed
- `scripts/prepare-admin-user-bot-detail-e2e.ts` - added strict runtime scenario parsing, per-scenario health seeding, and marker `runtimeScenario`.
- `tests/e2e/admin-user-bot-detail-db.spec.ts` - changed hardcoded degraded assertions into scenario-driven browser assertions for degraded, fresh, stale, and missing runtimeHealth states.
- `scripts/run-admin-user-bot-detail-e2e.mjs` - passes default `ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO=degraded-readable` into prep/spec env.
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs` - added `--matrix` mode that runs the four scenarios sequentially, one throwaway DB per scenario, with cleanup after each run.
- `package.json` - added `e2e:admin-user-bots:db:managed:matrix`.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - statically locks the scenario enum, marker field, scenario-driven spec table, matrix runner, and mock/no-live-control boundaries.
- `docs/handoffs/20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1325-admin-runtimehealth-loader-ui-matrix-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1325-admin-runtimehealth-gates-security-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md` - this aggregate handoff.

## Findings
1. Severity P1 - evidence `scripts/prepare-admin-user-bot-detail-e2e.ts:25`, `scripts/prepare-admin-user-bot-detail-e2e.ts:52`, `scripts/prepare-admin-user-bot-detail-e2e.ts:61`, `scripts/prepare-admin-user-bot-detail-e2e.ts:467`, `scripts/prepare-admin-user-bot-detail-e2e.ts:484` - recommendation: keep runtimeHealth browser coverage scenario-per-run, not multi-user-in-one-DB; target part: selected-user DB E2E fixture. The loader reads latest global `integration_health_checks` rows per target, so a newer same-target row can mask stale or missing states.
2. Severity P1 - evidence `tests/e2e/admin-user-bot-detail-db.spec.ts:17`, `tests/e2e/admin-user-bot-detail-db.spec.ts:22`, `tests/e2e/admin-user-bot-detail-db.spec.ts:193`, `tests/e2e/admin-user-bot-detail-db.spec.ts:199`, `tests/e2e/admin-user-bot-detail-db.spec.ts:214` - recommendation: keep browser assertions driven from `marker.runtimeScenario`; target part: DB browser acceptance spec. The same spec now locks exact runtime labels, overview labels, statistics labels, safe notes, and hidden secret/cross-user markers for every supported scenario.
3. Severity P1 - evidence `scripts/run-admin-user-bot-detail-e2e-managed.mjs:7`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:9`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:90`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:161`, `package.json:36` - recommendation: run the new matrix only with an explicit maintenance Postgres URL; target part: managed DB acceptance. Matrix mode creates/drops one `wtc_test_admin_user_bots_<scenario>_*` DB per scenario and still delegates to the guarded mock/no-live-control harness.
4. Severity P1 - evidence `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:30`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:43`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:82`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:99`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:145` - recommendation: preserve static guardrails so future edits cannot silently remove scenario coverage or matrix safety; target part: harness regression tests.
5. Severity P2 - evidence `node scripts/gates.mjs core` first run and `npx vitest run tests/integration/admin-bot-health-loader.test.ts` rerun - recommendation: treat the first core failure as a transient/concurrent Vitest timeout because the same test passed in isolation and the full core rerun passed; target part: gate interpretation. Final core state is green in this phase.

## Decisions
- Keep application UI/loader behavior unchanged. The loader already distinguishes `ok`, `attention`, `missing`, and `error`; the UI derives labels from the DTO.
- Keep `degraded-readable` as the default single-scenario harness for backwards compatibility with the existing degraded fixture.
- Add `fresh-green`, `stale`, and `missing` fixture states through `ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO`.
- Add `--matrix` to the managed runner rather than adding any unguarded Playwright path.
- Do not run DB-backed browser acceptance without an explicit disposable Postgres target.

## Risks
- The browser matrix was prepared but not executed against Postgres in this session because no explicit throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` or `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- Static harness and local core prove the guarded shape, not real browser rendering against a database.
- The worktree remains heavily dirty with many pre-existing modified/untracked files. This phase touched files that were already part of the broader bot/admin acceptance work, plus `package.json`.

## Verification/tests
RUN:
- `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - passed, 1 file / 6 tests.
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - passed, 3 files / 18 tests.
- `npx eslint scripts/prepare-admin-user-bot-detail-e2e.ts scripts/run-admin-user-bot-detail-e2e.mjs scripts/run-admin-user-bot-detail-e2e-managed.mjs tests/e2e/admin-user-bot-detail-db.spec.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts --max-warnings 0` - passed.
- `node scripts/gates.mjs core` - first run failed in `test` due a 5s timeout in `tests/integration/admin-bot-health-loader.test.ts`.
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts` - passed, 1 file / 7 tests; isolated repro for the first core failure.
- `node scripts/gates.mjs core` - rerun passed all 8 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate.
- `git diff --check` - passed.
- `npm run e2e:admin-user-bots:db:managed -- --help` - passed; printed safe usage and matrix scenario list without DB mutation.
- `npm run governance:check` - post-handoff passed with 0 errors and 1 historical warning.
- `npm run secret:scan` - post-handoff passed.
- `git diff --check` - post-handoff passed.

NOT RUN:
- `npm run e2e:admin-user-bots:db` - no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed:matrix` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided; this would create/drop four throwaway DBs.
- `npx playwright test -c playwright.admin-user-bots-db.config.ts` - requires guarded runner-created env and marker.
- `node scripts/gates.mjs full`, production build, full/default Playwright, deploy, SSH/tmux/systemd - skipped by scope.
- `npm run accept:worker:continuity`, `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads - skipped by scope and safety policy.

## Next actions
1. When a disposable maintenance Postgres URL is explicitly provided, run `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<redacted maintenance postgres url> npm run e2e:admin-user-bots:db:managed:matrix`; record only redacted DB names, scenario outcomes, cleanup result, and reviewed/scanner-clean artifacts if retained.
2. If real worker continuity proof is required, run it only with an explicit throwaway `DATABASE_URL`; otherwise keep worker continuity NOT RUN.
3. Continue bot acceptance toward real DB/browser proof and then worker continuity; do not claim live bot start/stop/apply-config readiness until the security and bot-integration audits authorize that lane.
