# ecosystem-security-auditor handoff
## Scope
Phase 4.40 read-only security audit of the local bot/admin acceptance runner after Phase 4.38 and Phase 4.39. Goal: verify security boundary tests/docs needed around `scripts/gates.mjs`, especially env refusal vs scrubbing, excluded commands, redacted child output, and status wording that must not overclaim.

Constraints followed: no code/test edits, no long gates, no live services, no provider calls, no DB mutation, no bot control, no env value printing. This handoff is the only file changed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-runner-auditor.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md`
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`
- `docs/handoffs/20260604-2245-legacy-closed-trade-source-safety-auditor.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`

## Files changed
`docs/handoffs/20260604-2335-bot-admin-runner-safety-auditor.md` - this required handoff only.

## Findings
1. Severity P1 - `bot-admin-local` still runs `ci:local` before the bot/admin child env scrub/refusal is applied. Evidence: `scripts/gates.mjs:107` defines `ci:local` with no `env`; `scripts/gates.mjs:147-148` runs `bot-admin-local` as `ci:local`, then `bot-admin-e2e`, then `visual-inventory`; `scripts/gates.mjs:166-169` inherits `{ ...process.env }` whenever a gate has no `env`; the local refusal/scrub only lives inside `createLocalBotAdminEnv()` at `scripts/gates.mjs:85-102` and is attached only to `bot-admin-e2e` at `scripts/gates.mjs:118-129`. `ci:local` includes `npm test` via `package.json:51`, and `npm test` can activate schema-mutating real-Postgres suites when `REAL_POSTGRES_DATABASE_URL` is present (`tests/integration/db-real-postgres.test.ts:41-99`, `tests/integration/db-real-postgres.test.ts:108-280`; `tests/integration/db-axioma-jti.test.ts:133-136`). Recommendation: for `bot-admin-local` and `bot-admin-e2e`, compute a local-safe child env before the first plan step, not only for the Playwright step. At minimum refuse `REAL_POSTGRES_DATABASE_URL` and all admin/managed DB envs before any gate starts; preferably run every bot-admin plan gate under the same local mock/no-live scrubbed env. Target part: `scripts/gates.mjs` plus `tests/integration/bot-admin-acceptance-runner.test.ts`.

2. Severity P1 - The refused-env list is too narrow for a "local mock/no-live" command if inherited parent shells are expected. Evidence: current refused list contains only `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` (`scripts/gates.mjs:63-66`), but package scripts expose other credentialed or DB-mutating opt-in gates: `accept:real-pg:managed`, auth/LMS/admin DB managed runners, audit append-only managed/direct runners, live LMS provider preflights, billing preflights, and Axioma preflight (`package.json:31-47`). Recommendation: refuse before running any bot-admin local gate when these are set: `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `REAL_POSTGRES_ADMIN_DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `AUTH_E2E_ADMIN_DATABASE_URL`, `LMS_E2E_ADMIN_DATABASE_URL`, `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL`, and any direct production/intended role env such as `AUDIT_APPEND_ONLY_DATABASE_URL` unless the command is explicitly that gate. The refusal message must name env keys only, never values. Target part: local runner env policy and docs.

3. Severity P1 - Runtime/provider env names should be scrubbed or overwritten for all child gates in the local bot/admin plan. Evidence: current scrub list deletes `DATABASE_URL`, admin-user DB marker vars, `LEGACY_DATABASE_URL`, `LEGACY_API_ID`, `LEGACY_LIVE_READS_ENABLED`, Tortila journal URL/token vars, and system bot owner/instance ids (`scripts/gates.mjs:68-83`), then forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and `LEGACY_LIVE_READS_ENABLED=false` (`scripts/gates.mjs:94-102`). The existing static test covers most of this (`tests/integration/bot-admin-acceptance-runner.test.ts:48-81`) but misses `ADMIN_USER_BOTS_E2E_PREP_TOKEN` and `ADMIN_USER_BOTS_E2E_HMAC`, both present in the scrub list (`scripts/gates.mjs:72-73`). Recommendation: extend the test to assert the complete scrub list and forced override set, including `ADMIN_USER_BOTS_E2E_PREP_TOKEN`, `ADMIN_USER_BOTS_E2E_HMAC`, `AUTH_E2E_DATABASE_URL`, `LMS_E2E_DATABASE_URL`, and any future local DB marker envs. Target part: `tests/integration/bot-admin-acceptance-runner.test.ts`.

4. Severity P1 - Managed, live, provider, deploy, and bot-control commands must stay excluded from `accept:bots:local`. Evidence: the current local plan is only `ci:local`, focused bot/admin Playwright, and visual inventory (`scripts/gates.mjs:147-148`), while Phase 4.38 explicitly did not run managed worker continuity, admin DB matrix, Legacy importer, exchange ping, live bot start/stop/apply-config, live provider probes, deploy/SSH/systemd/tmux, or fresh formal visual review (`docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:104-111`). Bot-control safety forbids systemd/service calls, process kill, exchange order/cancel/close calls, and reading/logging exchange API keys (`docs/BOT_CONTROL_SAFETY_MODEL.md:36-41`), and admin DB e2e asserts no start/stop/apply/test connection buttons (`tests/e2e/admin-user-bot-detail-db.spec.ts:276`). Recommendation: keep these out of `bot-admin-local`: `worker:tick`, `worker:smoke` unless explicitly labeled smoke-only, `accept:worker:continuity`, `accept:worker:continuity:managed`, all `e2e:*:db*` managed/direct DB browser gates, `accept:real-pg:managed`, `accept:audit:*`, live LMS/billing/Axioma preflights, `db:migrate`, `db:seed`, SSH/systemd/tmux/screen/process-kill commands, exchange pings, provider probes, Legacy `/api_management` probing, `/api/marks`, and live bot `startBot`/`stopBot`/`applyConfig`. Target part: package scripts, `scripts/gates.mjs`, and runner safety test.

5. Severity P2 - Redacted child output is correctly wired for finite gate children, but `ADMIN_USER_BOTS_E2E_HMAC` is scrubbed rather than redacted if a child ever prints it. Evidence: `scripts/gates.mjs:25` imports `runRedactedChildProcess`; `scripts/gates.mjs:167-174` runs children through it with stdout/stderr capture; passing logs discard full child output (`scripts/gates.mjs:197-206`). The helper redacts DB assignments, token/secret/API key assignments, auth headers, cookies, JWTs, Stripe secrets, private keys, and public IP URLs (`scripts/redacted-child-process.mjs:6-25`, `scripts/redacted-child-process.mjs:44-62`), and tests cover the generic leak corpus (`tests/integration/child-output-redaction.test.ts:13-71`). However `ADMIN_USER_BOTS_E2E_HMAC` does not match the generic `TOKEN|API_KEY|SECRET|ACCESS_KEY` assignment pattern. Recommendation: either add `HMAC` to the redaction assignment pattern or add an explicit `ADMIN_USER_BOTS_E2E_HMAC=` corpus case, while still keeping it scrubbed from local child env. Target part: `scripts/redacted-child-process.mjs` and `tests/integration/child-output-redaction.test.ts`.

6. Severity P1 - Status wording must stay scoped to local mock/no-live acceptance and must not imply managed DB, live provider, source, deploy, CI, or production readiness. Evidence: `scripts/gates.mjs:214` prints `# all green` for a selected mode; Phase 4.38 correctly says the local runner does not run managed worker continuity, selected-user admin DB matrix, Legacy importer, exchange ping, live bot control, deploy, or server/CI gates (`docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:58-64`, `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:104-111`); current docs also say local proof is not live DB/provider/exchange readiness (`docs/NEXT_ACTIONS.md:42-47`) and keep managed/live/source gates not green (`docs/STATUS.md:31-37`). Recommendation: runner/docs should say "LOCAL MOCK/NO-LIVE bot/admin website acceptance passed" or "`bot-admin-local` plan green", never "bot/admin is production ready", "worker continuity green", "admin DB matrix green", "Legacy source/import green", "live exchange/provider ready", "deploy ready", or "all gates green" without naming the selected local plan. Target part: `scripts/gates.mjs` summary/banner and status docs.

7. Severity P2 - Visual inventory is not the same as reviewed visual acceptance. Evidence: local runner executes only `npm run evidence:visual -- --inventory tests/e2e/screenshots` (`scripts/gates.mjs:131-133`), while Phase 4.38 states formal reviewed visual acceptance remains separate from automated inventory and requires a fresh manifest after screenshot-producing runs (`docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:65-68`, `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md:110-111`). Recommendation: status should say "visual inventory passed" for `accept:bots:local`; only claim "reviewed visual evidence passed" when `npm run evidence:visual -- --manifest <reviewed-manifest> tests/e2e/screenshots` has passed for the current screenshot set. Target part: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and aggregate handoffs.

8. Severity P1 - Legacy closed-trade/source proof remains outside this runner. Evidence: Phase 4.39 found WTC destination/repository is ready for provider-scoped Legacy trades if a source is found, but no durable local Legacy closed-trade/fill source was proven (`docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:44-67`); it explicitly says `npm run accept:bots:local` remains local mock/no-live website acceptance and does not clear source/live gates (`docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:120`). Recommendation: keep Legacy realized PnL, win rate, profit factor, fee/funding attribution, equity curve, importer, and replay/idempotency claims blocked until a source-proof artifact exists and a fixture-backed mapper/importer has passed its own redaction and replay gates. Target part: status docs and future Legacy importer phase.

## Decisions
- Treat `npm run accept:bots:local` as local mock/no-live website acceptance only.
- Refused envs should be reserved for explicit managed/admin/live/source gates and should halt the local runner before any child command starts.
- Scrubbed/overwritten envs should prevent ordinary runtime/provider/bot configuration from leaking into the local proof.
- `ci:local` must not inherit opt-in DB envs when it is part of `bot-admin-local`.
- Keep command exclusion tests static and cheap; do not prove this boundary by running long Playwright or DB gates.

## Risks
- If `REAL_POSTGRES_DATABASE_URL` is present, current `bot-admin-local` can run real-Postgres integration tests during the `ci:local` step before the bot/admin env scrub is applied.
- If a parent shell contains admin DB URLs, current refusal happens too late for `bot-admin-local` because `ci:local` runs first.
- `# all green` is easy to misread unless paired with the selected mode and local/mock/no-live wording.
- Passing visual inventory can be mistaken for formal reviewed screenshot acceptance.

## Verification/tests
RUN:
- `git branch --show-current` - observed `codex/bot-analytics-settings-canary-20260603`.
- `git status --short` - observed a large pre-existing dirty/untracked tree before this audit; not modified except this handoff.
- Read-only `rg` inspections of runner, helper, package scripts, tests, safety docs, and Phase 4.38/4.39 handoffs.
- `Test-Path docs/handoffs/20260604-2335-bot-admin-runner-safety-auditor.md` before writing - returned `False`.

NOT RUN:
- `npm run accept:bots:local`, `npm run accept:bots:rendered`, `node scripts/gates.mjs *`, Playwright, Vitest, lint, typecheck, build, secret scan, governance - not run because this was read-only audit scope and those commands can be long and/or write artifacts.
- Managed worker continuity, admin selected-user DB matrix, real-Postgres, audit append-only role, auth/LMS DB managed, live LMS/billing/Axioma preflights - not run; require explicit managed/live scope and/or credentials.
- DB migrate/seed, provider calls, exchange calls, live bot start/stop/apply-config, SSH/systemd/tmux/deploy/live services - forbidden by scope.

## Next actions
1. Patch `scripts/gates.mjs` so bot-admin modes refuse dangerous managed/admin/real-PG envs before the first plan step and run every bot-admin child gate under the local mock/no-live scrubbed env.
2. Extend `tests/integration/bot-admin-acceptance-runner.test.ts` to assert the complete refused list, complete scrub list, complete forced override set, and excluded command list.
3. Add redaction coverage for `ADMIN_USER_BOTS_E2E_HMAC=` or a generic `HMAC` assignment pattern in `tests/integration/child-output-redaction.test.ts`.
4. Add a mode-specific banner/summary wording in `scripts/gates.mjs` for `bot-admin-local`/`bot-admin-e2e`: "LOCAL MOCK/NO-LIVE ONLY; not managed DB, source, live provider, deploy, CI, or production readiness."
5. Keep `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and future aggregate handoffs split between RUN local proof, NOT RUN managed/live/source/deploy/CI gates, and separate reviewed visual-manifest proof.
