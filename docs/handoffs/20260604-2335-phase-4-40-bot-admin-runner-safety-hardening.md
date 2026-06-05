# Phase 4.40 bot/admin runner safety hardening handoff
## Scope
Closed the Phase 4.40 local bot/admin acceptance-runner safety gap identified by the read-only tests and security agents.
The phase stayed inside local mock/no-live website acceptance. It did not run managed DB gates, provider probes, exchange
calls, live bot start/stop/apply-config, deploy, SSH/systemd/tmux, production monitoring, or CI.

Per-agent handoffs used by this aggregate:
- [`docs/handoffs/20260604-2335-bot-admin-runner-tests-auditor.md`](20260604-2335-bot-admin-runner-tests-auditor.md)
- [`docs/handoffs/20260604-2335-bot-admin-runner-safety-auditor.md`](20260604-2335-bot-admin-runner-safety-auditor.md)

Both background agents were collected and closed before this aggregate.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `docs/handoffs/20260604-2335-bot-admin-runner-tests-auditor.md`
- `docs/handoffs/20260604-2335-bot-admin-runner-safety-auditor.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
- `scripts/gates.mjs` - bot-admin local/rendered modes now build the local mock/no-live scrubbed env before the first plan
  step and pass it to every child gate, including `ci:local` and visual inventory. The refused-env list now covers managed
  worker/admin DB, real-Postgres, auth, LMS, and audit append-only DB vars, and the summary prints a local mock/no-live
  safety banner for bot-admin modes.
- `scripts/redacted-child-process.mjs` - generic secret assignment redaction now includes `HMAC`.
- `tests/integration/bot-admin-acceptance-runner.test.ts` - static runner contract now asserts opt-in scripts, focused specs,
  complete refused/scrubbed env coverage, plan-level env isolation, forced mock/no-live flags, safety banner, and excluded
  managed/live commands.
- `tests/integration/child-output-redaction.test.ts` - leak corpus now includes `ADMIN_USER_BOTS_E2E_HMAC`.
- `docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md` - this aggregate handoff.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md` - updated current status and next-action map.

## Findings
1. Severity P1 - `bot-admin-local` no longer lets `ci:local` inherit a managed/admin/real-Postgres parent environment before
   bot-admin env scrub/refusal. Evidence: `scripts/gates.mjs` now computes `localBotAdminEnv` for bot-admin modes before the
   plan loop and uses `resolveGateEnv(g, localBotAdminEnv ?? process.env)` for every child. Recommendation: keep
   `accept:bots:local` scoped to local mock/no-live proof only. Target part: local acceptance runner safety.
2. Severity P1 - Refused env coverage was widened to stop accidental managed DB or source-shaped runs in the local bot/admin
   command. Evidence: `scripts/gates.mjs` now refuses worker/admin DB, real-Postgres, auth, LMS, and audit append-only DB
   env names before any bot-admin child gate starts. Recommendation: add new managed env names to the refusal list before
   adding them to package scripts. Target part: env policy.
3. Severity P1 - Scrubbed env and forced overrides now apply consistently to every bot-admin child gate. Evidence:
   `npm run accept:bots:local` passed with `ci:local`, `bot-admin-e2e`, and `visual-inventory` under the same plan-level
   local env. Recommendation: keep live/provider/source proof in separate explicit gates. Target part: local vs live
   boundary.
4. Severity P2 - HMAC-shaped secrets are now redacted if a child ever prints assignment-shaped output. Evidence:
   `scripts/redacted-child-process.mjs` redacts assignment keys matching `HMAC`, and the child redaction corpus includes
   `ADMIN_USER_BOTS_E2E_HMAC`. Recommendation: keep HMAC scrubbed from child env and redacted as a secondary safety layer.
   Target part: retained child logs.
5. Severity P1 - The latest local bot/admin website proof remains green after hardening. Evidence:
   `npm run accept:bots:local` passed with `ci:local` PASS, `bot-admin-e2e` PASS (`65 passed`, `E2E_PORT=3470`), and visual
   inventory PASS (`107` images). Recommendation: use this as the canonical local mock/no-live website gate, not as managed
   worker, source, live provider, deploy, CI, or production readiness. Target part: status wording.

## Decisions
- `npm run accept:bots:local` is the canonical local mock/no-live bot/admin website acceptance command.
- `npm run accept:bots:rendered` remains the faster rendered-only loop.
- Bot-admin acceptance modes refuse managed/admin/real-PG env before any child command starts.
- Every bot-admin child gate runs under the same scrubbed local env, including `ci:local`.
- HMAC is treated as secret output for retained child-log redaction.
- Visual inventory in this runner is inventory proof only; reviewed visual acceptance remains the separate manifest-backed
  evidence gate from Phase 4.37 unless refreshed.

## Risks
- Managed worker continuity and selected-user admin DB browser matrix are still not green because their required admin DB
  envs were not supplied in this phase.
- Legacy realized PnL, win rate, profit factor, fees, funding, and equity curve remain source-blocked after Phase 4.39; this
  runner does not prove a Legacy closed-trade source or importer.
- The worktree is heavily dirty from the broader bot/admin completion push; this phase intentionally did not reconcile,
  stage, commit, deploy, or run GitHub CI.
- The runner summary still includes `# all green` for the selected mode; the added safety banner scopes that to local
  mock/no-live bot-admin acceptance.

## Verification/tests
RUN:
- `node --check scripts/gates.mjs` - PASS.
- `node --check scripts/redacted-child-process.mjs` - PASS.
- `npx vitest run tests/integration/bot-admin-acceptance-runner.test.ts tests/integration/child-output-redaction.test.ts`
  - PASS, `2` files and `8` tests.
- `npm run typecheck -- --pretty false` - PASS.
- Values-hidden refused-env presence check - PASS, no refused local bot/admin env present in the current process.
- `npm run accept:bots:local` - PASS: `ci:local` PASS (`195.2s`, `Generating static pages (36/36)`), `bot-admin-e2e`
  PASS (`65 passed (11.5m)`, `E2E_PORT=3470`), visual inventory PASS (`107` image files).
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS, `0` errors and `1` known historical warning.
- `git diff --check` - PASS.

NOT RUN:
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied, and this
  phase was local mock/no-live.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
- `npm run accept:bots:rendered` - not rerun in Phase 4.40 because the fuller `accept:bots:local` passed after hardening.
- Reviewed visual manifest proof - not refreshed in this phase; only visual inventory ran as part of `accept:bots:local`.
- Legacy closed-trade source/importer gates - not run; Phase 4.39 left them source-blocked.
- Live exchange ping, provider probes, live bot start/stop/apply-config, DB migrate/seed, deploy, SSH/systemd/tmux, GitHub
  CI, and production monitoring - not run and out of scope.

## Next actions
1. If managed env is available, run exactly one managed proof phase: worker continuity tuple or selected-user admin DB matrix.
2. If a real Legacy closed-trade source is found, start a source-proof/importer phase with fixture-backed mapping,
   provider-account scoping, replay/idempotency, and redaction tests.
3. Keep live exchange/provider probes and live bot controls disabled until bot-integration and security audits explicitly
   approve those adapters.
4. If the dirty tree is to be shipped, start a separate git/CI/deploy phase with branch, commit/PR, CI, canary deploy, and
   post-deploy browser/runtime smoke evidence.
