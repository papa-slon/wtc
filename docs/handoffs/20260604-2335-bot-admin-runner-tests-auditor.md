# ecosystem-tests-runner handoff
## Scope
Phase 4.40 read-only tests audit for the local bot/admin acceptance runner added in `scripts/gates.mjs` and `package.json`.

Scope focused on static/focused coverage needed to lock the runner surface: `accept:bots` scripts, `bot-admin-local` and `bot-admin-e2e` plans, refusal of managed DB env, scrubbing of DB/provider/live env, forced local mock/no-live env, redacted child-process execution, and absence of managed/live commands. No code, test, script, runtime, database, bot, provider, exchange, live-control, server, browser, deploy, or env value state was intentionally changed.

Current checkout state observed before this handoff: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty/untracked worktree. This audit did not reconcile or modify those unrelated changes.

## Files inspected
- `package.json:11-51` - root scripts, including `ci:local`, managed worker/admin DB gates, and the new `accept:bots:rendered` / `accept:bots:local` commands.
- `scripts/gates.mjs:1-20` - runner purpose and supported `bot-admin-e2e` / `bot-admin-local` modes.
- `scripts/gates.mjs:63-102` - local bot/admin refused env list, scrubbed env list, and forced child env values.
- `scripts/gates.mjs:118-129` - targeted bot/admin Playwright command and local env hook.
- `scripts/gates.mjs:141-149` - `bot-admin-e2e` and `bot-admin-local` plans.
- `scripts/gates.mjs:166-174` - redacted child-process invocation and output suppression.
- `scripts/gates.mjs:197-206` - retained log behavior for passing/failing gates.
- `scripts/redacted-child-process.mjs:6-25` - redaction patterns for DB URLs, secrets, provider URLs, auth headers, cookies, JWTs, Stripe secrets, and private keys.
- `scripts/redacted-child-process.mjs:44-62` - redaction transform.
- `scripts/redacted-child-process.mjs:65-92` - `runRedactedChildProcess` spawn behavior.
- `tests/integration/worker-continuity-acceptance-runner.test.ts:35-75` - adjacent opt-in runner/static safety pattern for worker continuity.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-34` - adjacent opt-in/default-excluded admin DB harness pattern.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:84-94` - existing mock/no-live assertions for the lower-level admin DB harness.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:159-183` - existing managed-runner refusal/redaction/source-safety assertions.
- `tests/integration/child-output-redaction.test.ts:45-71` - redaction corpus coverage.
- `tests/integration/child-output-redaction.test.ts:73-104` - focused child-process redaction behavior coverage.
- `tests/integration/child-output-redaction.test.ts:118-137` - generic gate-runner retained-output wiring assertions.
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-runner-auditor.md:45-64` - Phase 4.38 runner audit findings.
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md:41-56` - Phase 4.38 safety/env boundary findings.
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:35-45` - files changed when the runner was added.
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:91-111` - recorded runner verification and still-not-run managed/live gates.

## Files changed
- `docs/handoffs/20260604-2335-bot-admin-runner-tests-auditor.md` - this handoff only. No code, tests, scripts, configs, runtime artifacts, DB state, env files, app docs, or visual artifacts were changed.

## Findings
1. Severity P1 - The new `accept:bots` package surface is not locked by a focused test yet. Evidence: `package.json:43-44` registers `accept:bots:rendered` and `accept:bots:local`; `scripts/gates.mjs:147-148` maps `bot-admin-e2e` and `bot-admin-local`; the current test search found no `tests/*` references to `accept:bots:local`, `accept:bots:rendered`, `bot-admin-local`, `bot-admin-e2e`, or `LOCAL_BOT_ADMIN_*`. Recommendation: add `tests/integration/bot-admin-local-acceptance-runner.test.ts` with static package/plan assertions. Target part: root package script and gate plan regression coverage.

2. Severity P1 - Local managed-DB refusal exists in the runner but lacks a dedicated regression test. Evidence: `scripts/gates.mjs:63-66` lists `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; `scripts/gates.mjs:85-89` throws `local bot/admin acceptance refuses managed DB env`; adjacent managed-runner tests cover refusal patterns at `tests/integration/worker-continuity-acceptance-runner.test.ts:93-118` and `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:159-175`. Recommendation: in the new static test, assert both refused env names and the throw message are present; if later refactored, move `createLocalBotAdminEnv` to a small importable helper and add an in-memory behavior test that does not run gates. Target part: local vs managed DB safety boundary.

3. Severity P1 - The scrub list should be locked because inherited parent shells can contain DB/provider/live values from earlier WTC phases. Evidence: `scripts/gates.mjs:68-83` deletes `DATABASE_URL`, admin-user-bot E2E DB/prep/HMAC env, Legacy DB/API/live-read env, Tortila journal URL/token env, and system bot owner/instance env; Phase 4.38 safety audit identified the same risk at `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md:46`. Recommendation: assert the scrubbed env array contains at least `DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_PREP_TOKEN`, `ADMIN_USER_BOTS_E2E_HMAC`, `LEGACY_DATABASE_URL`, `LEGACY_API_ID`, `LEGACY_LIVE_READS_ENABLED`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `JOURNAL_READ_TOKEN`, `SYSTEM_BOT_OWNER_ID`, `SYSTEM_BOT_INSTANCE_ID`, and `SYSTEM_LEGACY_BOT_OWNER_ID`. Target part: child env construction.

4. Severity P1 - The forced local mock/no-live env values exist but are only indirectly covered elsewhere. Evidence: `scripts/gates.mjs:94-102` forces `E2E_PORT`, `APP_ENV='development'`, `BOT_ADAPTER_MODE='mock'`, `FEATURE_LIVE_BOT_CONTROL='false'`, `FEATURE_TV_AUTOMATION='false'`, and `LEGACY_LIVE_READS_ENABLED='false'`; lower-level admin DB harness coverage asserts a subset at `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:84-94`; generic auth/LMS harness tests assert similar webServer flags but not this runner. Recommendation: add direct static assertions against `scripts/gates.mjs` for all five required forced values and for the `E2E_PORT: botAdminE2ePort` handoff into the child env. Target part: local proof env invariants.

5. Severity P1 - The redacted child-process path is generically tested, but not specifically tied to the new bot/admin runner plan. Evidence: `scripts/gates.mjs:25` imports `runRedactedChildProcess`; `scripts/gates.mjs:166-174` runs child gates through it with `forwardStdout: false`, `forwardStderr: false`, `windowsHide: true`, and a large buffer; `tests/integration/child-output-redaction.test.ts:118-137` only asserts generic gate wiring. Recommendation: in the new runner test, assert the bot/admin gate path still uses `env: createLocalBotAdminEnv`, `runRedactedChildProcess`, `forwardStdout: false`, `forwardStderr: false`, `windowsHide: true`, and does not use `execSync`, `spawnSync(` directly in `gates.mjs`, or `stdio: 'inherit'`. Target part: retained-output safety.

6. Severity P1 - The local runner must stay free of managed/live commands, and that absence should be locked at both package and plan levels. Evidence: managed worker continuity and admin DB matrix commands are separate at `package.json:23-24` and `package.json:35-37`; `scripts/gates.mjs:118-127` includes only the six focused bot/admin rendered Playwright specs; `scripts/gates.mjs:147-148` includes only `bot-admin-e2e` plus `visual-inventory`, optionally preceded by `ci:local`; existing tests enforce similar exclusions for other runners at `tests/integration/worker-continuity-acceptance-runner.test.ts:42-47` and `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:26-34`. Recommendation: assert `accept:bots:local` is exactly `node scripts/gates.mjs bot-admin-local`, `accept:bots:rendered` is exactly `node scripts/gates.mjs bot-admin-e2e`, and the bot-admin gate/plan source does not call `accept:worker:continuity`, `run-worker-continuity-managed`, `e2e:admin-user-bots:db`, `run-admin-user-bot-detail-e2e`, `run-admin-user-bot-detail-e2e-managed`, `accept:real-pg:managed`, live preflight scripts, `ssh`, `systemctl`, `tmux`, `startBot`, `stopBot`, `applyConfig`, or exchange/order commands. Target part: command composition safety.

7. Severity P2 - The safest implementation is static-first, with no Playwright or full gate spawn inside Vitest. Evidence: `scripts/gates.mjs:147-148` would run `ci:local` and Playwright when invoked normally; Phase 4.38 recorded `accept:bots:local` as about 15 minutes at `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:84`; this audit was explicitly told not to run long gates. Recommendation: keep the first coverage slice as source-reading Vitest assertions in `tests/integration/bot-admin-local-acceptance-runner.test.ts`; do not spawn `node scripts/gates.mjs bot-admin-local` or `bot-admin-e2e` from the test. If behavior-level env refusal is required, refactor env creation into an importable pure helper rather than exercising the full gate runner. Target part: fast/safe regression coverage.

## Decisions
- Recommended test target: new file `tests/integration/bot-admin-local-acceptance-runner.test.ts`.
- Recommended test style: static source assertions using the existing `readFileSync` pattern from `worker-continuity-acceptance-runner.test.ts`, `admin-user-bot-detail-db-e2e-harness.test.ts`, and `child-output-redaction.test.ts`.
- Do not run the local bot/admin gate from Vitest; the test should lock command shape and safety invariants without starting dev servers, Playwright, DB connections, provider calls, or bot controls.
- If maintainers want stronger behavior coverage for env refusal/scrubbing, refactor the env builder into a pure helper and test that helper in memory. Do not make the focused test execute the long gate plan.
- No background agents were launched by this tests-runner lane, and none are left running by this audit.

## Risks
- Without the proposed static test, a future edit can accidentally remove `accept:bots:*`, change plan contents, inherit live/provider env, or add managed DB commands while `npm test` still passes.
- A naive behavior test that spawns `scripts/gates.mjs bot-admin-local` would be slow, write `logs/gates`, start Playwright/dev-server work, and risk screenshot/artifact churn.
- Pure substring tests can become brittle if `scripts/gates.mjs` is reorganized; mitigate by keeping assertions focused on security-critical names, flags, and command exclusions rather than exact formatting.
- The current checkout is heavily dirty and contains many untracked handoffs/tests; this audit did not distinguish owner changes from generated phase output beyond the requested target surface.

## Verification/tests
RUN in this read-only audit:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty/untracked tree.
- `Get-ChildItem -Force` - confirmed repository root and existing generated folders.
- `rg -n` searches over `package.json`, `scripts`, `tests`, and relevant handoffs for `gates.mjs`, `accept:bots`, `bot-admin-local`, `bot-admin-e2e`, local env flags, managed env names, and redacted child-process wiring.
- Line-numbered `Get-Content` inspection of `package.json`, `scripts/gates.mjs`, `scripts/redacted-child-process.mjs`, and the adjacent tests listed in `## Files inspected`.
- `Test-Path docs/handoffs/20260604-2335-bot-admin-runner-tests-auditor.md` before writing - returned `False`.

NOT RUN in this audit:
- `npm test`, targeted Vitest, lint, typecheck, build, secret scan, governance, and `node --check scripts/gates.mjs` - not run because this lane was a read-only audit of tests needed, not implementation verification.
- `npm run accept:bots:local` and `npm run accept:bots:rendered` - not run; they can write `logs/gates`, start Playwright/dev servers, and overwrite screenshots.
- `npm run ci:local`, `npm run e2e`, and raw Playwright commands - not run; long/browser gates were out of scope.
- `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed`, `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, and `npm run e2e:admin-user-bots:db:managed:matrix` - not run; DB-mutating/managed gates were out of scope and no approved disposable/admin DB env was provided.
- Live services, provider calls, DB mutation, bot start/stop/apply-config, exchange/order actions, env value printing, SSH/systemd/tmux, deploy, GitHub CI, and production monitoring - not run.

## Next actions
1. Add `tests/integration/bot-admin-local-acceptance-runner.test.ts` with static assertions for:
   - exact `accept:bots:rendered` and `accept:bots:local` package scripts;
   - `bot-admin-e2e` and `bot-admin-local` plans;
   - refused managed DB env names and refusal message;
   - scrubbed DB/provider/live env names;
   - forced `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and `LEGACY_LIVE_READS_ENABLED=false`;
   - `env: createLocalBotAdminEnv` on `bot-admin-e2e`;
   - `runRedactedChildProcess` with non-forwarded stdout/stderr and hidden Windows child process;
   - no managed/live command names in the bot-admin local/rendered plan.
2. Run only the focused new test first:

```powershell
npm test -- tests/integration/bot-admin-local-acceptance-runner.test.ts
```

3. If that passes and the phase touches only tests, follow with the smallest relevant local static set, for example:

```powershell
npm test -- tests/integration/bot-admin-local-acceptance-runner.test.ts tests/integration/child-output-redaction.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
```

4. Keep `npm run accept:bots:local`, `npm run accept:bots:rendered`, and managed DB/browser gates out of the test implementation itself; run them only as explicit acceptance gates in a separate verification phase.
