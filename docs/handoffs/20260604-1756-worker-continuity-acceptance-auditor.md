# worker-continuity-acceptance-auditor handoff
## Scope
Read-only Phase 4.27 worker-continuity acceptance audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Question audited: what is the safest concrete next implementation/verification slice to prove Legacy and Tortila worker continuity with a throwaway DB, without live bot start/stop/apply-config, live exchange probes, provider reachability probes, or secret leakage?

Inspected package scripts, `scripts/safe-worker-tick.mjs`, `apps/worker/src/tick-once.ts`, `apps/worker/src/index.ts`, `apps/worker/src/jobs.ts`, `apps/worker/src/legacy-live.ts`, DB schema/repositories, existing managed DB runner patterns, current worker tests, and the Phase 4.26 aggregate handoff. No worker tick, DB migration, DB seed, live bot control, exchange/provider probe, SSH, tmux, systemd, deploy, or env dump was run.

## Files inspected
- `AGENTS.md`
- `package.json`
- `apps/worker/package.json`
- `packages/db/package.json`
- `scripts/safe-worker-tick.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/client.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md`
- `docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md`
- `docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md`

## Files changed
- `docs/handoffs/20260604-1756-worker-continuity-acceptance-auditor.md` - this required read-only auditor handoff only.

## Findings
1. Severity P1 - Evidence: `package.json:21`, `package.json:22`, `package.json:23`, `scripts/safe-worker-tick.mjs:9`, `scripts/safe-worker-tick.mjs:14`, `scripts/safe-worker-tick.mjs:21`, `scripts/safe-worker-tick.mjs:27`, `apps/worker/src/tick-once.ts:17`, `apps/worker/src/tick-once.ts:22`, and `apps/worker/src/tick-once.ts:23`. Recommendation: add a managed throwaway worker-continuity acceptance runner before calling the gate green; current scripts are safe enough to force mock/no-live-control flags and reject memory-demo under `--require-db`, but they do not create, migrate, seed, validate, or drop a throwaway DB. Target part: acceptance runner.

2. Severity P1 - Evidence: `apps/worker/src/index.ts:97`, `apps/worker/src/index.ts:104`, `apps/worker/src/index.ts:109`, `apps/worker/src/index.ts:291`, `apps/worker/src/index.ts:293`, `apps/worker/src/index.ts:296`, `apps/worker/src/index.ts:315`, `apps/worker/src/index.ts:316`, and `apps/worker/src/tick-once.ts:23`. Recommendation: define the required acceptance tuple as exactly `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok`, and assert it from both redacted process output and the latest DB `integration_health_checks.target='worker'` detail. Current `tick-once.ts` prints `worker_status`, `tortila`, and `legacy`; `bot_continuity` is printed by the DB tick log and stored in DB detail, but not normalized into the one-shot final tuple. Target part: worker continuity proof tuple.

3. Severity P1 - Evidence: `apps/worker/src/legacy-live.ts:490`, `apps/worker/src/legacy-live.ts:498`, `apps/worker/src/legacy-live.ts:516`, `apps/worker/src/legacy-live.ts:536`, `apps/worker/src/legacy-live.ts:542`, `apps/worker/src/legacy-live.ts:581`, `apps/worker/src/legacy-live.ts:583`, `apps/worker/src/legacy-live.ts:604`, and `apps/worker/src/legacy-live.ts:612`. Recommendation: the next harness must seed fixture-only Legacy source tables and an active WTC `legacy_bot` provider-account mapping in the throwaway DB, set `LEGACY_LIVE_READS_ENABLED=true`, and point `LEGACY_DATABASE_URL` at that same disposable DB. Without those fixtures, Legacy remains `skipped/not_configured` and the aggregate worker status cannot prove continuity. Target part: Legacy DB-backed worker snapshot acceptance.

4. Severity P1 - Evidence: `scripts/safe-worker-tick.mjs:11`, `scripts/safe-worker-tick.mjs:12`, `scripts/safe-worker-tick.mjs:13`, `apps/worker/src/index.ts:182`, `apps/worker/src/index.ts:203`, `apps/worker/src/index.ts:213`, `apps/worker/src/index.ts:230`, `apps/worker/src/index.ts:236`, `apps/worker/src/index.ts:246`, and `tests/integration/worker-tortila-snapshot.test.ts:92`. Recommendation: prove Tortila continuity through `BOT_ADAPTER_MODE=mock` plus a seeded `SYSTEM_BOT_OWNER_ID` or `SYSTEM_BOT_INSTANCE_ID`, while clearing `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, and `JOURNAL_READ_TOKEN` in the managed runner environment. This gives `tortila=ok` without any journal HTTP call or exchange touch. Target part: Tortila no-probe worker snapshot acceptance.

5. Severity P2 - Evidence: `packages/db/src/schema.ts:138`, `packages/db/src/schema.ts:146`, `packages/db/src/schema.ts:443`, `packages/db/src/schema.ts:508`, `packages/db/src/repositories.ts:1789`, `packages/db/src/repositories.ts:1823`, `packages/db/src/repositories.ts:1884`, `packages/db/src/repositories.ts:1909`, `packages/db/src/repositories.ts:1989`, `packages/db/src/repositories.ts:2210`, and `packages/db/src/repositories.ts:2223`. Recommendation: do not add schema for the next proof; use existing bot instances, provider-account mappings, worker health rows, metric snapshots, and position snapshots. Target part: DB persistence boundary.

6. Severity P2 - Evidence: `scripts/run-real-pg-harness-managed.mjs:14`, `scripts/run-real-pg-harness-managed.mjs:16`, `scripts/run-real-pg-harness-managed.mjs:23`, `scripts/run-real-pg-harness-managed.mjs:41`, `scripts/run-real-pg-harness-managed.mjs:103`, `scripts/run-real-pg-harness-managed.mjs:121`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:20`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:24`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:118`, and `scripts/redacted-child-process.mjs:44`. Recommendation: implement `scripts/run-worker-continuity-managed.mjs` using the same maintenance-DB URL validation, generated `wtc_test_worker_continuity_*` name, redacted child process, and `DROP DATABASE ... WITH (FORCE)` cleanup pattern. Target part: managed throwaway DB safety.

7. Severity P2 - Evidence: `tests/integration/worker-health-mapping.test.ts:79`, `tests/integration/worker-health-mapping.test.ts:84`, `tests/integration/worker-tortila-snapshot.test.ts:92`, `tests/integration/worker-tortila-snapshot.test.ts:97`, `tests/integration/worker-tortila-snapshot.test.ts:100`, `tests/integration/worker-tortila-snapshot.test.ts:127`, `tests/integration/legacy-provider-worker.test.ts:156`, `tests/integration/legacy-provider-worker.test.ts:168`, `tests/integration/legacy-provider-worker.test.ts:204`, and `tests/integration/legacy-live-worker-static.test.ts:175`. Recommendation: add a focused acceptance test/harness that drives the CLI or managed runner to the dual-green tuple; existing tests cover pure status logic, Tortila mock plus Legacy skipped, Legacy row projection, and secret-field static checks, but not one disposable Postgres run where both products are `ok`. Target part: acceptance test coverage.

## Decisions
- Safest next slice: implement a managed worker-continuity acceptance harness, not a live worker/control feature.
- Minimal file targets for the next implementation phase:
  - `scripts/run-worker-continuity-managed.mjs`
  - `scripts/prepare-worker-continuity-acceptance.ts`
  - `package.json` script such as `accept:worker:continuity:managed`
  - focused tests for runner safety and required tuple assertion
- Use one fresh throwaway Postgres database named `wtc_test_worker_continuity_<timestamp>_<suffix>` for the acceptance run. Apply WTC migrations into it, seed WTC users/entitlements, add fixture-only Legacy source tables (`api_keys`, `symbolsettingss` or `symbolsettings`, `stageconfigs`, `slots`, `orders`) in that disposable DB, and point both `DATABASE_URL` and `LEGACY_DATABASE_URL` at the same disposable URL.
- Required output tuple: `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok`.
- Required DB assertion: latest `integration_health_checks` row where `target='worker'` must have `status='ok'`, `detail.botContinuityStatus='ok'`, `detail.tortilaSnapshot='ok'`, `detail.tortilaReadState='ok'`, `detail.legacySnapshot='ok'`, and `detail.legacyReadState='ok'`.
- Required env constraints for the managed run:
  - `APP_ENV=development`
  - `BOT_ADAPTER_MODE=mock`
  - `FEATURE_LIVE_BOT_CONTROL=false`
  - `FEATURE_TV_AUTOMATION=false`
  - `DATABASE_URL=<fresh throwaway WTC DB URL>`
  - `LEGACY_LIVE_READS_ENABLED=true`
  - `LEGACY_DATABASE_URL=<same fresh throwaway DB URL>`
  - `SYSTEM_BOT_OWNER_ID=<seeded WTC user id>`
  - `SYSTEM_LEGACY_BOT_OWNER_ID=<seeded WTC user id>`
  - clear or override `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `JOURNAL_READ_TOKEN`, live exchange/proxy/provider URLs, and live credential env.
- Current scripts enforce enough for no memory-demo under `accept:worker:continuity` and enough no-live-control flags for the worker process, but not enough for full acceptance because they do not provision the throwaway DB, seed dual product fixtures, clear all inherited provider env, or assert the normalized tuple.

## Risks
- Running `npm run accept:worker:continuity` manually with an inherited `DATABASE_URL` can write worker health and snapshot rows into the wrong DB. It must be wrapped by a managed throwaway runner or run only after explicit operator DB scope confirmation.
- If `LEGACY_LIVE_READS_ENABLED=true` is inherited together with a real `LEGACY_DATABASE_URL`, the worker can read a live Legacy source. The managed runner must override `LEGACY_DATABASE_URL` to the throwaway fixture DB.
- If `BOT_ADAPTER_MODE` is changed from `mock` and Tortila URL/token env is present, Tortila can become a journal HTTP probe. The managed runner must force `mock` and clear Tortila URL/token env.
- Redacted stdout is not the same as artifact safety. Any retained logs must be secret-scanned/reviewed; do not archive raw env, full URLs, DB URLs, cookies, tokens, or screenshots/traces unless explicitly reviewed.
- The worktree was already heavily dirty before this audit, including worker, DB, web, tests, and many untracked handoffs. This handoff certifies only the read-only audit and this single file.

## Verification/tests
RUN in this read-only audit:
- `Select-String -Path C:\Users\maxib\.codex\memories\MEMORY.md -Pattern 'WTC|worker|Phase 4.26|wtc_ecosystem_platform|handoff' -Context 2,2` - memory quick pass.
- `git rev-parse --show-toplevel` - confirmed project root.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and heavy pre-existing dirty/untracked state.
- `Get-ChildItem -Path docs\handoffs | Sort-Object Name | Select-Object -Last 20` - located Phase 4.26 aggregate.
- `rg -n "safe-worker|worker:|tick|managed|DATABASE_URL|POSTGRES|throwaway|continuity|Legacy|Tortila|exchange|start|stop|apply-config" ...` - located scripts, worker, DB, managed runner, and handoff evidence.
- Line-numbered `Get-Content` inspections for all files listed under `Files inspected`.
- `rg -n "integrationHealthChecks|botInstances|botMetricSnapshots|botPositionSnapshots|botTrades|legacyProvider|providerAccount|legacy|recordHealthCheck|insertBotMetricSnapshot|insertBotPositionSnapshot|importBotTrade|ensureBotInstance|upsertLegacy|Legacy" packages/db/src/schema.ts packages/db/src/repositories.ts`.
- `rg -n "startBot|stopBot|applyConfig|BotControlDisabledError|mode: 'mock'|createMockTortilaAdapter|read-only" packages/bot-adapters/src apps/worker/src/jobs.ts apps/worker/src/index.ts scripts/safe-worker-tick.mjs`.

NOT RUN:
- `npm run accept:worker:continuity` - not run; writes DB health/snapshot rows and currently lacks managed throwaway provisioning/assertions.
- `npm run worker:smoke` - not run and not accepted as continuity proof because it can run memory-demo without `DATABASE_URL`.
- `npm run worker:tick`, `npm run tick -w @wtc/worker`, `npm run dev:worker`, `npm run dev -w @wtc/worker`, or direct `tsx apps/worker/src/tick-once.ts` - not run by read-only scope.
- `npm run db:migrate`, `npm run db:seed`, `npm run accept:real-pg:managed`, `npm run e2e:admin-user-bots:db:managed:matrix`, tests, Playwright, build, or browser probes - not run by this acceptance-audit scope.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, env dump, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - forbidden by scope and not run.

## Next actions
1. Add `scripts/run-worker-continuity-managed.mjs` using `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, validating that it points at a non-throwaway maintenance DB, creating/dropping `wtc_test_worker_continuity_*`, and running all child processes through `runRedactedChildProcess`.
2. Add `scripts/prepare-worker-continuity-acceptance.ts` to migrate/seed WTC data, create fixture-only Legacy source tables in the throwaway DB, create a `legacy_bot` instance plus active `legacy-db` provider mapping, and emit only non-secret fixture IDs needed by the runner.
3. Update or wrap `accept:worker:continuity` so managed acceptance emits and asserts exactly `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok`, then independently reads the latest `target='worker'` row and checks the same tuple.
4. Add focused tests for managed-runner refusal of missing/non-maintenance admin URLs, redaction of DB URLs/secrets, rejection when any tuple part is not `ok`, and prevention of inherited live provider/Tortila env.
5. Verification for the implementation phase should run worker typecheck, focused Vitest for worker/Legacy/Tortila/runner safety, `npm run accept:worker:continuity:managed` with a local/admin throwaway Postgres URL, `npm run secret:scan`, and `npm run governance:check` after the aggregate handoff cites this auditor file.
