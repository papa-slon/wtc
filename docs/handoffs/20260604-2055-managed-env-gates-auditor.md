# ecosystem-devops-implementer handoff
## Scope
Phase 4.37 read-only audit for the two managed DB/worker acceptance gates:
- Managed worker continuity with `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
- Admin user bot DB browser matrix with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.

This audit inspected scripts, tests, docs, and env-key availability only. It did not run the managed DB gates, did not print secret values, did not read raw env values for display, did not mutate a database, did not start live bot controls, and did not edit code.

## Files inspected
- `AGENTS.md`
- `package.json`
- `scripts/redacted-child-process.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/STATUS.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
- `docs/handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md`
- `.env.example` filename and key names only; no values.
- Current environment key presence for `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; no values printed.

## Files changed
- `docs/handoffs/20260604-2055-managed-env-gates-auditor.md` - this handoff only. No code, config, test, script, env, or app docs changed.

## Findings
1. Severity P1 - Managed worker continuity is correctly registered as a strict opt-in gate, but it cannot run in this session because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is absent. Evidence: `package.json:22-24` separates `worker:smoke`, strict `accept:worker:continuity`, and managed `accept:worker:continuity:managed`; `scripts/run-worker-continuity-managed.mjs:11` reads `WORKER_CONTINUITY_ADMIN_DATABASE_URL`; current env key check reported process/user/machine scopes absent; `.env.example` contains neither required managed key. Recommendation: run only after an operator supplies an approved local/admin Postgres maintenance URL capable of `CREATE DATABASE` and `DROP DATABASE`. Target part: managed worker continuity gate.

2. Severity P1 - The managed worker runner is throwaway-DB mutating, not read-only, but it is designed to avoid live bot/provider mutation. Evidence: `scripts/run-worker-continuity-managed.mjs:25-28` documents creation of `wtc_test_worker_continuity_*`, fixture-only Legacy rows, safe worker tick, and no live bot/exchange/provider touch; `scripts/run-worker-continuity-managed.mjs:355-358` creates the throwaway DB; `scripts/run-worker-continuity-managed.mjs:398-399` drops it; `scripts/run-worker-continuity-managed.mjs:280-290` forces the worker child onto the disposable `DATABASE_URL`/`LEGACY_DATABASE_URL`, clears Tortila URLs/tokens, and uses safe local env; `scripts/safe-worker-tick.mjs:107-111` forces `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Recommendation: classify `npm run accept:worker:continuity:managed` as safe-local/throwaway-mutating, not read-only; stop before invocation unless the admin URL is explicitly approved. Target part: worker continuity invocation safety.

3. Severity P1 - Worker acceptance success requires the full tuple, not just a zero exit code. Evidence: `scripts/safe-worker-tick.mjs:9-15` defines full as `workerStatus=ok`, `botContinuity=ok`, `tortila=ok`, `legacy=ok`; `scripts/safe-worker-tick.mjs:139-155` parses and rejects missing or mismatched tuples; `scripts/run-worker-continuity-managed.mjs:311-327` verifies the latest `target='worker'` DB row and detail read states; `docs/NEXT_ACTIONS.md:12-15` repeats the required tuple and env gate. Recommendation: record both create/drop DB names and the observed tuple; do not count `worker:smoke` or memory-demo output as continuity acceptance. Target part: worker continuity acceptance criteria.

4. Severity P1 - Admin user bot DB browser matrix is correctly registered as an opt-in managed gate, but it cannot run in this session because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is absent. Evidence: `package.json:35-37` registers direct, managed, and managed matrix commands; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:11-12` reads `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and `--matrix`; current env key check reported process/user/machine scopes absent; `.env.example` contains neither required managed key. Recommendation: run only after an operator supplies an approved local/admin Postgres maintenance URL capable of creating and dropping throwaway DBs. Target part: admin selected-user DB browser matrix.

5. Severity P1 - The admin user bot DB matrix is also throwaway-DB/browser-artifact mutating, not read-only. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:20-24` documents fresh `wtc_test_admin_user_bots_*` DB creation, delegated DB harness, matrix scenarios, and artifact cautions; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:107-111` creates a throwaway DB per scenario; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:118-119` drops it; `playwright.admin-user-bots-db.config.ts:49-50` retains screenshots/traces on failure; `tests/e2e/admin-user-bot-detail-db.spec.ts:8` writes scenario screenshots. Recommendation: classify `npm run e2e:admin-user-bots:db:managed:matrix` as safe-local/throwaway-mutating plus browser-artifact-producing; archive only reviewed, scanner-clean artifacts. Target part: admin selected-user browser acceptance.

6. Severity P1 - The admin matrix has strong stop/refusal conditions before browser startup. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29-47` refuses missing, invalid, non-Postgres, or throwaway admin URLs; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:57-64` refuses unsupported runtime scenarios; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:135-145` refuses unknown args and missing admin URL before connection; `playwright.admin-user-bots-db.config.ts:13-32` refuses direct config use, missing prepared URL, non-`wtc_test*` target DB, missing prep token, or HMAC marker mismatch; `scripts/prepare-admin-user-bot-detail-e2e.ts:163-186` requires an empty throwaway DB and migration files. Recommendation: use the managed wrapper, not raw Playwright config, for local acceptance. Target part: DB/browser harness stop conditions.

7. Severity P2 - The relevant wrappers already route child process output through DSN redaction helpers. Evidence: `scripts/redacted-child-process.mjs:7-18` redacts DB URL/env assignments, Postgres URLs, URL credentials, and password fragments; `scripts/redacted-child-process.mjs:44-62` applies the redaction pipeline; `scripts/redacted-child-process.mjs:65-91` returns/forwards redacted stdout/stderr; worker managed runner imports the helper at `scripts/run-worker-continuity-managed.mjs:6` and wraps seed/tick children at `scripts/run-worker-continuity-managed.mjs:85-91` and `scripts/run-worker-continuity-managed.mjs:274-292`; admin managed/direct runners import the helper at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:4` and `scripts/run-admin-user-bot-detail-e2e.mjs:4`. Recommendation: still avoid raw env dumps and do not archive unreviewed logs, but prefer these wrappers because they redact DSNs. Target part: retained evidence safety.

## Decisions
- Did not run `npm run accept:worker:continuity:managed`; required env key is absent and the gate creates/drops a DB.
- Did not run `npm run e2e:admin-user-bots:db:managed:matrix`; required env key is absent and the gate creates/drops DBs plus browser artifacts.
- Treated both managed gates as safe-local/throwaway-mutating only when supplied with an approved admin maintenance Postgres URL; they are not read-only.
- Treated the direct `npm run accept:worker:continuity` and `npm run e2e:admin-user-bots:db` commands as lower-level harnesses for already-prepared throwaway DBs, not the recommended first invocation for this phase.
- Checked only key availability and env filenames/key names. No secret value was printed or quoted.

## Risks
- Current local environment cannot produce green managed acceptance for either gate because both required admin DB env keys are absent.
- A supplied admin URL must point at a non-throwaway maintenance database, not the target `wtc_test*` database; both managed wrappers refuse throwaway admin DB names.
- Failed admin matrix runs can leave Playwright traces/screenshots for review. These must be reviewed and scanned before retention; do not archive raw traces or unreviewed artifacts.
- If DB create succeeds but drop fails, both managed runners report failure; the operator must manually inspect/drop only the generated `wtc_test_worker_continuity_*` or `wtc_test_admin_user_bots_*` database named in the redacted runner output.
- The repo started with a large pre-existing dirty/untracked tree on branch `codex/bot-analytics-settings-canary-20260603`; this audit did not reconcile unrelated changes.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with large pre-existing dirty/untracked tree.
- `git log -1 --oneline` - observed `e2d705f Upgrade Legacy bot settings and pub_id stats`.
- Env-key availability check across process/user/machine scopes - both `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` absent; values were not printed.
- Recursive `.env*` filename/key-name scan excluding `.git`, `node_modules`, `.next`, `test-results`, and `playwright-report` - only `.env.example` found; neither required managed key present; values were not printed.
- `node --check scripts/safe-worker-tick.mjs` - PASS.
- `node --check scripts/run-worker-continuity-managed.mjs` - PASS.
- `node --check scripts/run-admin-user-bot-detail-e2e-managed.mjs` - PASS.
- `node --check scripts/run-admin-user-bot-detail-e2e.mjs` - PASS.
- `npx vitest run tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS, 2 files, 10 tests. This verified wrapper safety/refusal/static invariants only; it did not run managed DB gates.

NOT RUN / NOT GREEN:
- `npm run accept:worker:continuity:managed` - NOT RUN; blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and requires an approved admin maintenance Postgres URL. Mutates a throwaway DB.
- `npm run accept:worker:continuity` - NOT RUN; lower-level strict worker DB harness requires an explicit prepared `DATABASE_URL` and approved full fixture path. Not sufficient when memory-demo/no DB is used.
- `npm run worker:smoke` - NOT RUN; not accepted as continuity proof because it may run memory-demo without `DATABASE_URL`.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and requires an approved admin maintenance Postgres URL. Mutates throwaway DBs and may write browser artifacts.
- `npm run e2e:admin-user-bots:db:managed` - NOT RUN; same env blocker as matrix, single scenario only.
- `npm run e2e:admin-user-bots:db` - NOT RUN; lower-level harness requires a pre-created fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL`.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probes, deploy, SSH/tmux/systemd, production monitoring, raw env dumps, and raw secret reads - NOT RUN.

## Next actions
1. To run the managed worker continuity gate after operator approval, set only the key, do not echo it, then run:
   ```powershell
   $env:WORKER_CONTINUITY_ADMIN_DATABASE_URL = '<operator-provided-maintenance-postgres-url>'
   npm run accept:worker:continuity:managed
   Remove-Item Env:WORKER_CONTINUITY_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
   ```
   Accept only if the output records create/drop of `wtc_test_worker_continuity_*` and the tuple `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.

2. To run the managed admin user bot DB browser matrix after operator approval, set only the key, do not echo it, then run:
   ```powershell
   $env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = '<operator-provided-maintenance-postgres-url>'
   npm run e2e:admin-user-bots:db:managed:matrix
   Remove-Item Env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
   ```
   Review scenario screenshots/traces before retention; archive only redacted stdout and reviewed/scanner-clean artifacts.

3. Stop immediately on any missing/invalid env refusal, non-Postgres URL refusal, throwaway-admin-DB refusal, unknown arg refusal, unsupported runtime scenario, DB create/drop failure, migration/seed/fixture failure, worker tuple mismatch, Playwright marker mismatch, or browser assertion failure. Do not fall back to raw URLs, raw env dumps, direct Playwright config, or live bot/provider/exchange probes.
