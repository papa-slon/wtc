# ecosystem-security-auditor handoff
## Scope
Phase 4.38 read-only security and bot-integration audit for safety boundaries around a future local bot/admin acceptance runner.

Scope was limited to scripts, env guards, tests, and docs that distinguish local mock/no-live proof from managed throwaway-DB proof and live/provider proof. This audit did not run managed DB gates, did not read or print secret values, did not mutate databases, did not start preview/browser/server processes, did not touch live bot services, and did not edit code.

## Files inspected
- `AGENTS.md`
- `package.json`
- `.env.example`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/redacted-child-process.mjs`
- `scripts/gates.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/index.ts`
- `packages/shared/src/env-guards.ts`
- `docs/SESSION_PROTOCOL.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2055-managed-env-gates-auditor.md`
- `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`

## Files changed
None - read-only audit. Wrote this required handoff only: `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md`.

## Findings
1. Severity P1 - A new local bot/admin acceptance command must be explicitly local/mock/no-live, not managed continuity or production evidence. Evidence: `docs/STATUS.md:21-24` keeps managed worker continuity, admin selected-user DB Playwright matrix, live exchange ping, live bot start/stop/apply-config, provider probes, deploy, production monitoring, and GitHub CI not green; `docs/NEXT_ACTIONS.md:11-15` says the managed worker and admin DB matrix gates require `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and create/drop throwaway DBs; `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md:73-76` records those managed/live gates as not run. Recommendation: name any wrapper/status output as "LOCAL BOT/ADMIN MOCK ACCEPTANCE ONLY - not managed worker continuity, not admin DB matrix, not live/provider proof." Target part: acceptance runner status boundary.

2. Severity P1 - The safe local runtime boundary is already encoded and should be forced by any wrapper. Evidence: `scripts/safe-worker-tick.mjs:107-111` forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`; `scripts/run-admin-user-bot-detail-e2e.mjs:25-39` forces the DB browser child env to mock/live-control-off/TV-off with generated local secrets when absent; `playwright.admin-user-bots-db.config.ts:61-72` also forces the web server env to mock/live-control-off/TV-off; `.env.example:74-82` documents safe defaults. Recommendation: the wrapper should set those safe child env values itself and print that unsafe parent values were ignored or refused. Target part: local child-process env construction.

3. Severity P1 - The wrapper must refuse or scrub env variables that would move the run into managed, read-only, or live/provider territory. Evidence: `scripts/run-worker-continuity-managed.mjs:11` reads `WORKER_CONTINUITY_ADMIN_DATABASE_URL`; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:11-12` reads `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and `--matrix`; `playwright.admin-user-bots-db.config.ts:13-32` refuses direct use without a prepared `ADMIN_USER_BOTS_E2E_DATABASE_URL`, prep token, and HMAC marker; `apps/worker/src/index.ts:183-235` consumes Tortila journal URL/token envs for read-only snapshots; `apps/worker/src/index.ts:262-280` consumes Legacy live-read env/config when present; `.env.example:84-98` documents bot endpoint/token envs as non-mock inputs. Recommendation: for a local-only command, refuse if `WORKER_CONTINUITY_ADMIN_DATABASE_URL` or `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is set unless the command is explicitly a managed wrapper; unset/override `DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `ADMIN_USER_BOTS_E2E`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `LEGACY_API_ID`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `JOURNAL_READ_TOKEN`, `SYSTEM_BOT_OWNER_ID`, `SYSTEM_BOT_INSTANCE_ID`, `SYSTEM_LEGACY_BOT_OWNER_ID`, `BOT_ADAPTER_MODE`, `FEATURE_LIVE_BOT_CONTROL`, and `FEATURE_TV_AUTOMATION` for child local proof. Target part: env allowlist/refusal policy.

4. Severity P1 - Do not include strict/managed DB acceptance commands in a local rerun wrapper unless the wrapper is deliberately changed into a managed gate. Evidence: `package.json:22-24` separates `worker:smoke`, strict `accept:worker:continuity`, and managed `accept:worker:continuity:managed`; `package.json:35-37` separates direct, managed, and managed-matrix admin DB browser commands; `tests/integration/worker-continuity-acceptance-runner.test.ts:42-47` asserts worker continuity commands are opt-in and excluded from e2e/gates; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:26-33` asserts admin-user DB harnesses are opt-in and excluded from default gates. Recommendation: local acceptance may include static/rendered/visual/ci-local proof, but must not call `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed`, `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, or `npm run e2e:admin-user-bots:db:managed:matrix` unless the operator supplied approved throwaway/admin DB scope and the output is reported as managed, not local. Target part: command composition.

5. Severity P1 - Live-control, exchange, shell/process-manager, and direct provider actions remain forbidden. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:17-24` says `startBot`, `stopBot`, and `applyConfig` throw until all gates pass; `docs/BOT_CONTROL_SAFETY_MODEL.md:35-43` permanently prohibits SSH, systemctl/service, tmux/screen, process kill, `.env` mutation, exchange order calls, key reads, and direct bot state/config mutation; `docs/BOT_CONTROL_SAFETY_MODEL.md:255-267` keeps `/api/marks`, config writes, start/stop, SSH/systemd/tmux, exchange orders, and key reads out of current mode; `packages/bot-adapters/src/control.ts:1-18` hard-disables bot control without both the live flag and audit approval. Recommendation: the wrapper must not contain `startBot`, `stopBot`, `applyConfig`, `systemctl`, `service`, `tmux`, `ssh`, process kill, exchange order/cancel/close calls, `/api/marks`, `exchange_key.test`, or "Test connection" steps. Target part: forbidden command/API set.

6. Severity P1 - Worker success text must not overclaim continuity when running local/no-DB smoke. Evidence: `scripts/safe-worker-tick.mjs:24-34` documents memory-demo behavior without `DATABASE_URL`; `scripts/safe-worker-tick.mjs:139-155` only accepts a continuity tuple when an expectation profile is active; `tests/integration/worker-continuity-acceptance-runner.test.ts:77-91` covers refusal of unsupported safe-worker args/profiles; `docs/handoffs/20260604-2055-managed-env-gates-auditor.md:75-82` explicitly says `worker:smoke` and lower-level commands were not run/green as managed continuity. Recommendation: if local acceptance calls `npm run worker:smoke`, status must say "safe worker smoke/memory or local DB tick only; NOT managed continuity tuple proof." Target part: worker output wording.

7. Severity P1 - Admin DB browser proof has strong safety gates, but it is not a local no-live wrapper target unless a throwaway DB is prepared. Evidence: `scripts/run-admin-user-bot-detail-e2e.mjs:7-13` requires `ADMIN_USER_BOTS_E2E_DATABASE_URL` and reserves other DB gate envs for their own gates; `scripts/prepare-admin-user-bot-detail-e2e.ts:36-46` enforces `wtc_test*` DB names; `scripts/prepare-admin-user-bot-detail-e2e.ts:163-186` requires an empty throwaway DB before fixture prep; `playwright.admin-user-bots-db.config.ts:49-50` can retain screenshots/traces on failure; `tests/e2e/admin-user-bot-detail-db.spec.ts:220-227` asserts local UI labels `storage: Postgres`, `LIVE CONTROL: DISABLED`, and read-only mappings, while `tests/e2e/admin-user-bot-detail-db.spec.ts:274-276` asserts no forms and no start/stop/apply/test-connection buttons. Recommendation: keep DB browser acceptance outside the local wrapper unless using the existing guarded managed/direct harness, then review/scanner-clean retained artifacts before archiving. Target part: admin DB browser acceptance boundary.

8. Severity P2 - Output and artifact hygiene must remain redacted even for local proof. Evidence: `scripts/redacted-child-process.mjs:6-18` detects DB/secret/provider URL assignments, credentials in URLs, sensitive query params, auth headers, cookies, JWTs, Stripe secrets, and private keys; `scripts/redacted-child-process.mjs:44-62` redacts them; `scripts/redacted-child-process.mjs:65-82` forwards only redacted stdout/stderr; `tests/integration/worker-continuity-acceptance-runner.test.ts:120-125` asserts runner sources do not contain full DB URLs or credentials; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:177-183` asserts likely archived files do not contain full DB URLs or credentials. Recommendation: any wrapper should use `runRedactedChildProcess`, avoid `stdio: inherit`, never print raw env dumps, and finish with explicit "archive only redacted stdout and reviewed/scanner-clean artifacts." Target part: retained evidence safety.

9. Severity P1 - Legacy closed-trade import must stay source-blocked and outside the local acceptance command. Evidence: `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:57-61` rejects inactive Legacy orders/slots as durable closed-trade/fill evidence and keeps performance UI pending; `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:65-68` says the importer was not implemented and source proof is required; `docs/STATUS.md:21-25` repeats that Legacy closed-trade performance history is blocked by source evidence. Recommendation: status text should list Legacy closed-trade import/history as "NOT RUN/BLOCKED BY SOURCE", not as covered by bot/admin local acceptance. Target part: status/docs wording.

## Decisions
- Treat the future local bot/admin acceptance wrapper as an aggregator for existing local mock/no-live proof only.
- Do not let a local wrapper silently upgrade itself into managed proof based on inherited admin DB URLs; require a distinct managed command path and explicit operator approval.
- Prefer a child env allowlist over inherited `process.env`; if inheritance is needed, override/scrub the env names listed above before spawning children.
- Require wrapper output to include separate sections for `RUN`, `NOT RUN`, and `INTENTIONALLY REFUSED/IGNORED ENV`, with "not live", "not managed", and "not provider/exchange proof" language.
- No background agents were launched by this combined auditor; no background agents are left running by this audit.

## Risks
- A combined command name such as `accept:bot-admin` could be misread as closing managed worker continuity or admin DB matrix unless the script name and banner include "local" and "mock/no-live".
- Parent shells may contain `DATABASE_URL`, `LEGACY_DATABASE_URL`, journal URLs, tokens, or admin DB URLs from earlier work; relying on inherited env would make the proof ambiguous.
- Failed browser runs can create screenshots/traces; even local fixtures contain deliberate secret/leak markers, so artifact retention needs review and scanning.
- The repo started with a large pre-existing dirty/untracked tree on branch `codex/bot-analytics-settings-canary-20260603`; this audit did not reconcile or modify unrelated files.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty/untracked tree.
- Read-only `rg` and line-numbered file inspections of the scripts, tests, worker code, env template, and docs listed above.
- `Test-Path docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md` before writing - returned `False`.

NOT RUN:
- `npm run accept:worker:continuity:managed` - not run; requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and creates/drops a throwaway DB.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, creates/drops throwaway DBs, and may produce browser artifacts.
- `npm run accept:worker:continuity`, `npm run e2e:admin-user-bots:db`, raw Playwright config invocation, live exchange ping, live bot start/stop/apply-config, live provider/exchange probes, SSH/tmux/systemd, deploy, GitHub CI, production monitoring, and Legacy closed-trade import - not run by scope.
- No formal test suite was run for this read-only audit.

## Next actions
1. If adding a local bot/admin acceptance command, make it opt-in and unmistakably local, for example `accept:bot-admin:local`, with a startup banner: "LOCAL MOCK/NO-LIVE ACCEPTANCE ONLY. Does not run managed worker continuity, admin DB matrix, live exchange ping, provider probes, or live bot control."
2. Implement a strict child env allowlist: force `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`; generate local-only `SESSION_SECRET`/`SECRET_VAULT_KEK` when needed; scrub/refuse the managed/live/provider env names listed in Finding 3.
3. Include only local no-live commands already accepted by Phase 4.37, and list every skipped gate in output. Do not include the managed DB commands, direct admin DB Playwright harness, live preflights, or control/provider commands.
4. Add a focused static safety test for the wrapper that asserts opt-in package registration, exclusion from `ci:local` and `scripts/gates.mjs`, redacted child-process usage, no raw env printing, forced mock/no-live flags, forbidden command absence, and required status wording.
5. Keep Legacy closed-trade import blocked until a source-proof artifact names the durable closed-trade/fill table/API and replay contract.
