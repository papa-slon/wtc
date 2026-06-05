# bot-acceptance-gates-auditor handoff
## Scope
Read-only Phase 4.15 audit of available gates and scripts for the next safe acceptance pass after selected-user `runtimeHealth` E2E/harness edits.

This audit did not edit application code, did not run live bot start/stop/apply-config, did not read secret values, and did not run DB-mutating acceptance commands.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/redacted-child-process.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-health-detail.test.ts`

## Files changed
- `docs/handoffs/20260604-1253-bot-acceptance-gates-auditor.md` - this handoff only.
- Application code: None - read-only audit.

## Findings
1. Severity P1 - evidence `package.json:34`, `package.json:35`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:26`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:31`, `tests/e2e/admin-user-bot-detail-db.spec.ts:5`, `tests/e2e/admin-user-bot-detail-db.spec.ts:109` - recommendation: after selected-user `runtimeHealth` E2E/harness edits, the main agent should first run the safe local gates that do not require a real Postgres target: `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-bot-health-loader.test.ts`, plus `npm run typecheck`, targeted eslint or `npm run lint`, `npm run secret:scan`, and `npm run governance:check` after the aggregate handoff is written. Target part: selected-user admin bot detail runtime-health harness and static guardrails.
2. Severity P1 - evidence `scripts/gates.mjs:13`, `scripts/gates.mjs:15`, `scripts/gates.mjs:16`, `scripts/gates.mjs:44`, `scripts/gates.mjs:47`, `scripts/gates.mjs:49`, `scripts/gates.mjs:50`, `scripts/gates.mjs:51` - recommendation: for a broader post-edit sweep, prefer `node scripts/gates.mjs core` as the safe sequential local gate bundle; use `node scripts/gates.mjs full` when a web build is needed, and run Playwright separately via `node scripts/gates.mjs e2e` or a targeted Playwright command because the gate runner intentionally keeps E2E out of `full`. Target part: local acceptance sequencing and host stability.
3. Severity P1 - evidence `package.json:23`, `scripts/safe-worker-tick.mjs:3`, `scripts/safe-worker-tick.mjs:4`, `scripts/safe-worker-tick.mjs:21`, `scripts/safe-worker-tick.mjs:22`, `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md:85`, `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md:91` - recommendation: keep `npm run accept:worker:continuity` NOT RUN unless the operator provides an explicit throwaway WTC `DATABASE_URL` and approves the DB mutation target. `worker:smoke` without `--require-db` can exercise the memory demo path, but it must not be reported as DB-backed worker continuity. Target part: worker continuity acceptance.
4. Severity P1 - evidence `package.json:34`, `package.json:35`, `scripts/run-admin-user-bot-detail-e2e.mjs:8`, `scripts/run-admin-user-bot-detail-e2e.mjs:10`, `scripts/prepare-admin-user-bot-detail-e2e.ts:39`, `scripts/prepare-admin-user-bot-detail-e2e.ts:57`, `scripts/prepare-admin-user-bot-detail-e2e.ts:60`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:16`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:104`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:115`, `playwright.admin-user-bots-db.config.ts:13`, `playwright.admin-user-bots-db.config.ts:20`, `playwright.admin-user-bots-db.config.ts:29` - recommendation: keep `npm run e2e:admin-user-bots:db` and `npm run e2e:admin-user-bots:db:managed` NOT RUN unless a fresh throwaway Postgres DB URL or approved maintenance admin URL is provided. If run, the handoff must record the redacted DB identity/runner mode and cleanup result, not the full URL. Target part: DB-backed selected-user runtime-health E2E.
5. Severity P1 - evidence `docs/SESSION_PROTOCOL.md:54`, `docs/SESSION_PROTOCOL.md:57`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:84`, `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md:84`, `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md:88`, `tests/e2e/admin-user-bot-detail-db.spec.ts:136`, `tests/e2e/admin-user-bot-detail-db.spec.ts:138` - recommendation: the aggregate handoff language should say: "`accept:worker:continuity` - NOT RUN; no DB-backed/live worker continuity proof was observed in this phase because no explicit throwaway `DATABASE_URL` was provided. Admin/harness checks proved read-only persisted/mock visibility only; they did not prove live bot continuity and did not enable live bot start/stop/apply-config." If the DB gate is actually run later, replace this with the exact observed command, redacted throwaway DB target, and result. Target part: aggregate handoff truth language.
6. Severity P2 - evidence `package.json:17`, `package.json:44`, `package.json:46`, `scripts/redacted-child-process.mjs:6`, `scripts/redacted-child-process.mjs:9`, `scripts/redacted-child-process.mjs:44`, `scripts/redacted-child-process.mjs:51`, `scripts/check-retained-visual-artifacts.mjs:17`, `scripts/check-retained-visual-artifacts.mjs:30`, `scripts/check-retained-visual-artifacts.mjs:34`, `tests/integration/admin-user-bot-detail-static.test.ts:42`, `tests/integration/admin-user-bot-detail-static.test.ts:117`, `tests/integration/admin-user-bot-detail-static.test.ts:167`, `tests/integration/admin-user-bot-detail-static.test.ts:175`, `tests/integration/admin-bot-health-loader.test.ts:306`, `tests/integration/admin-bot-health-loader.test.ts:406` - recommendation: keep `npm run secret:scan` and `npm run governance:check` mandatory for bot settings/secrets/runtime-health phases; run `npm run evidence:visual` before retaining screenshots/traces/artifacts from the DB E2E; preserve the static tests that assert no secret joins, raw payload leakage, adapters, or live-control semantics. Target part: governance/security/static checks for bot settings, secrets, and runtime health.

## Decisions
- This audit classifies `node scripts/gates.mjs core`, targeted vitest/eslint/typecheck, `npm run secret:scan`, and `npm run governance:check` as safe local post-edit gates.
- This audit classifies `npm run accept:worker:continuity`, `npm run e2e:admin-user-bots:db`, and `npm run e2e:admin-user-bots:db:managed` as NOT RUN unless the operator provides an explicit throwaway Postgres target or approved managed runner URL.
- Live bot control, exchange/provider calls, env dumps, deploy, SSH, tmux, and systemd remain outside this acceptance slice.

## Risks
- The worktree was already heavily dirty/untracked before this audit; gate results in the next phase must state exactly which revision and dirty state they covered.
- `node scripts/gates.mjs core` runs broad local checks but does not include worker package typecheck or a web build; use `npm run ci:local` or explicit extra commands if the next edits touch worker/build boundaries.
- DB-backed E2E screenshots are produced by the spec; retained artifacts should be reviewed and scanned before archiving.

## Verification/tests
- Read-only inspection only: `rg`, `Get-Content`, `Get-ChildItem`, `git status --short --branch`, and `Get-Date`.
- NOT RUN: `npm run accept:worker:continuity`.
- NOT RUN: `npm run e2e:admin-user-bots:db`.
- NOT RUN: `npm run e2e:admin-user-bots:db:managed`.
- NOT RUN: live bot start/stop/apply-config, exchange/provider calls, env/secret value reads, deploy, SSH, tmux, systemd.
- No application tests or build gates were run by this read-only auditor.

## Next actions
1. After selected-user `runtimeHealth` E2E/harness edits, run targeted vitest/static gates first, then `node scripts/gates.mjs core` or equivalent explicit core commands.
2. Run `npm run evidence:visual` if any DB E2E screenshots/traces/artifacts are retained.
3. Only run `npm run accept:worker:continuity` with an explicit throwaway WTC `DATABASE_URL`; otherwise list it as NOT RUN with the reason above.
4. Only run `npm run e2e:admin-user-bots:db` or `npm run e2e:admin-user-bots:db:managed` with an explicit disposable Postgres target; otherwise list it as NOT RUN with the reason above.
5. In the aggregate handoff, avoid "live worker continuity green" language unless the relevant DB-backed gate actually ran and passed in that same session.
