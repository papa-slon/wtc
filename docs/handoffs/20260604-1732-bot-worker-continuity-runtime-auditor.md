# bot-worker-continuity-runtime-auditor handoff
## Scope
Read-only Phase 4.26 runtime continuity audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
Question audited: what is the next safest implementation slice to prove Legacy and Tortila bots do not silently stop?

Inspected current worker heartbeat/snapshot orchestration, one-shot worker scripts, DB health/snapshot schema and repositories, user/admin continuity and launch-readiness projections, and Phase 4.12/4.13 handoffs/tests. No code/tests/config/migrations were edited. No worker tick, live bot start/stop/apply-config, provider/exchange probe, env dump, SSH, tmux, systemd, or deploy command was run.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md
- docs/handoffs/20260604-1205-bot-worker-continuity-runtime-auditor.md
- docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md
- apps/worker/package.json
- package.json
- scripts/safe-worker-tick.mjs
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- apps/worker/src/tick-once.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/continuity.ts
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/BotContinuityPanel.tsx
- apps/web/src/features/bots/BotLaunchReadinessPanel.tsx
- apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/app/admin/bots/page.tsx
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/legacy-provider-worker.test.ts
- tests/integration/legacy-live-worker-static.test.ts
- tests/integration/bot-continuity-builder.test.ts
- tests/integration/bot-readiness-builder.test.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts

## Files changed
None - read-only audit, except this required handoff:
- docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md

## Findings
1. Severity: P1. Evidence: `apps/worker/src/index.ts:17`, `apps/worker/src/index.ts:287`, `apps/worker/src/index.ts:291`, `apps/worker/src/index.ts:293`, `apps/worker/src/index.ts:315`, and `apps/worker/src/index.ts:398`. Recommendation: keep Phase 4.13's final aggregate worker heartbeat as the runtime source of truth, but make launch readiness consume it directly. Target part: worker continuity acceptance boundary. The worker runs every 60s, derives final status after Tortila and Legacy outcomes, and persists `target='worker'` with `botContinuityStatus`, per-bot snapshot/readState fields, and redacted errors. The next slice should not refactor this first; it should prove every readiness surface fails closed when this aggregate row is missing, stale, `not_configured`, `attention`, or `error`.

2. Severity: P1. Evidence: `apps/web/src/features/bots/readiness.ts:91`, `apps/web/src/features/bots/readiness.ts:105`, `apps/web/src/features/bots/readiness-loader.ts:94`, `apps/web/src/features/bots/readiness-loader.ts:105`, `apps/web/src/features/bots/data.tsx:415`, `apps/web/src/features/bots/data.tsx:423`, and `apps/web/src/features/bots/data.tsx:536`. Recommendation: replace the current user-facing "Worker heartbeat" readiness source with an explicit `target='worker'` aggregate read, or rename the row if it remains product-health based. Target part: user launch readiness. Current `Worker heartbeat` row is built from `read.health`, but `read.health` comes from latest `tortila-journal` or `legacy-bot` rows plus metric/position snapshot timestamps, not from the aggregate `worker` row that proves both bot snapshot jobs completed in the same worker cycle.

3. Severity: P1. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:62`, `apps/web/src/features/admin/bot-health-loader.ts:68`, `apps/web/src/features/admin/bot-health-loader.ts:70`, `apps/web/src/features/admin/bot-health-loader.ts:228`, `apps/web/src/features/admin/bot-health-loader.ts:236`, `apps/web/src/app/admin/bots/page.tsx:67`, `apps/web/src/app/admin/bots/page.tsx:70`, and `apps/web/src/app/admin/bots/page.tsx:78`. Recommendation: add freshness/age to `workerBotContinuity` and make admin fleet launch/readiness widgets warn or block when the latest `worker` row is older than the worker freshness window. Target part: admin launch readiness mirror. Admin reads the latest aggregate worker row, but `workerContinuityPill()` currently evaluates status fields only; an old green row can still render `worker continuity: ok` because `checkedAt` age is displayed but not part of the tone/state.

4. Severity: P1. Evidence: `apps/worker/src/index.ts:17`, `apps/web/src/features/admin/queries.ts:187`, `apps/web/src/features/admin/queries.ts:269`, `apps/web/src/features/admin/queries.ts:273`, `apps/web/src/features/admin/user-bot-detail-loader.ts:41`, `apps/web/src/features/admin/user-bot-detail-loader.ts:330`, `apps/web/src/features/bots/data.tsx:297`, `apps/web/src/features/bots/data.tsx:342`, `apps/web/src/features/bots/readiness.ts:94`, and `apps/web/src/features/bots/continuity.ts:115`. Recommendation: standardize launch-readiness heartbeat freshness around worker cadence: expected 60s, stale after 3m for the aggregate `worker` row; keep 10m only for historical data-display freshness if needed. Target part: cadence/freshness policy. The code currently has 60s worker cadence, 3m system/admin runtime stale windows, and 10m user data/continuity stale windows. For "bots do not silently stop", 10m is too loose for launch readiness and the 3m worker heartbeat rule should be the hard gate.

5. Severity: P2. Evidence: `apps/worker/src/tick-once.ts:1`, `apps/worker/src/tick-once.ts:17`, `apps/worker/src/tick-once.ts:22`, `apps/worker/src/tick-once.ts:23`, `package.json:21`, `package.json:22`, `package.json:23`, `scripts/safe-worker-tick.mjs:21`, and `scripts/safe-worker-tick.mjs:22`. Recommendation: use `npm run accept:worker:continuity` only with an explicit throwaway `DATABASE_URL` in an implementation/acceptance phase; never accept `npm run worker:smoke` as continuity proof. Target part: safe proof commands. The one-shot DB tick now emits both `tortila=` and `legacy=`, but `worker:smoke` can still fall back to `--memory-demo` when no DB URL is set. The acceptance command is the right proof hook because it passes `--require-db`, but it writes worker health/snapshot rows and was correctly not run in this read-only lane.

6. Severity: P2. Evidence: `tests/integration/worker-health-mapping.test.ts:79`, `tests/integration/worker-health-mapping.test.ts:84`, `tests/integration/worker-health-mapping.test.ts:94`, `tests/integration/worker-tortila-snapshot.test.ts:92`, `tests/integration/worker-tortila-snapshot.test.ts:148`, `tests/integration/worker-tortila-snapshot.test.ts:182`, `tests/integration/bot-readiness-builder.test.ts:132`, `tests/integration/bot-readiness-builder.test.ts:138`, and `tests/integration/admin-bot-health-loader.test.ts:373`. Recommendation: next tests should add missing/stale aggregate-worker cases, not just product-health/runtime cases. Target part: test coverage. Existing tests lock final worker status derivation and product/readiness behavior, but the next regression test should assert launch readiness is non-green when `target='worker'` is missing or older than 3m even if a product health row is `ok`.

7. Severity: P2. Evidence: `packages/db/src/schema.ts:443`, `packages/db/src/schema.ts:448`, `packages/db/src/repositories.ts:1789`, `packages/db/src/repositories.ts:1790`, `packages/db/src/schema.ts:507`, `packages/db/src/schema.ts:536`, `packages/db/src/repositories.ts:2210`, and `packages/db/src/repositories.ts:2223`. Recommendation: do not add a migration for the next slice unless a retained acceptance ledger is explicitly required; use append-only `integration_health_checks` plus existing metric/position snapshot tables. Target part: DB boundary. The needed proof state already has timestamped health rows and append-only worker snapshots. The safer next slice is read/projection/gate logic, not schema churn.

## Decisions
- Safest next implementation slice: "aggregate worker continuity launch gate." Read latest `integration_health_checks.target='worker'` in the user readiness loader and admin bot-health loader, compute freshness against a 3m stale window, and add/strengthen launch-readiness rows so no user/admin surface can show ready/ok when the aggregate worker row is missing, stale, `attention/not_configured`, or `error`.
- User bot pages should require the aggregate worker row to be fresh and this product's aggregate outcome to be `snapshot=ok` plus `readState=ok` before the `Worker heartbeat`/launch-readiness row can be ready. Admin fleet/global readiness should require both Tortila and Legacy aggregate outcomes to be ok before showing global continuity ok.
- Keep product runtime snapshots and scoped metric rows as data evidence, not as a substitute for the aggregate worker heartbeat.
- Keep `not_configured/skipped` distinct from outages, but never green for launch readiness.
- No live-control, provider probe, exchange ping, env-secret read, SSH, tmux, systemd, deploy, or worker tick belongs in the implementation portion of this slice.

## Risks
- The worktree was already heavily dirty, including worker, web, DB, tests, and many untracked handoffs/components. During this audit, concurrent/pre-existing changes were visible in `apps/web/src/features/bots/readiness.ts`; this handoff reports current checkout state and does not claim authorship.
- A stale green `target='worker'` row is the main remaining silent-stop risk in launch/readiness language. Status-only admin logic is not enough if the worker process stopped after its last ok tick.
- `accept:worker:continuity` is a useful acceptance hook but mutates the configured DB by writing health/snapshot rows; it must use a throwaway WTC DB and be explicitly authorized in a non-read-only phase.
- Product-level `tortila-journal`/`legacy-bot` freshness and aggregate `worker` freshness are related but not identical. The next slice should avoid double-counting or contradictory labels by naming sources precisely.

## Verification/tests
RUN in this read-only audit:
- `Select-String -Path C:\Users\maxib\.codex\memories\MEMORY.md -Pattern 'WTC|Phase 4.12|Phase 4.13|runtime continuity|Legacy|Tortila|worker snapshot|apps/worker/src/index.ts|tick-once' -Context 2,2`
- `Get-Date -Format 'yyyy-MM-dd HH:mm K'`
- `git status --short --branch`
- Line-numbered `Get-Content` inspections for the files listed above.
- `rg -n "recordHealthCheck|integration_health_checks|bot_metric_snapshots|bot_position_snapshots|latest|snapshot|health" packages\db\src packages\db\migrations tests\integration -g "*.ts" -g "*.sql"`
- `rg -n "continuity|stale|snapshot|heartbeat|launch readiness|ready|worker|runtime" apps\web\src\features apps\web\src\app tests\integration docs\handoffs -g "*.ts" -g "*.tsx" -g "*.md"`
- `rg -n "ADMIN_BOT_RUNTIME_STALE_AFTER_MS|DB_SNAPSHOT_STALE_MS|staleAfter|TICK_MS|workerStaleAfter" apps packages tests -g "*.ts" -g "*.tsx"`
- `Test-Path docs\handoffs\20260604-1732-bot-worker-continuity-runtime-auditor.md`

NOT RUN:
- `npm run accept:worker:continuity` - not run; requires explicit throwaway `DATABASE_URL` and writes worker health/snapshot rows.
- `npm run worker:smoke` - not run and not acceptable as continuity proof; it can fall back to memory demo.
- `npm run worker:tick`, `npm run tick -w @wtc/worker`, `npx tsx apps/worker/src/tick-once.ts`, `node scripts/safe-worker-tick.mjs` - not run; worker tick commands are outside this read-only lane.
- `npx vitest ...`, Playwright, browser probes, build, full `npm run ci:local` - not run due read-only audit scope.
- Env inspection, provider/exchange probes, live bot start/stop/apply-config, SSH, tmux, systemd, deploy - forbidden by prompt and not run.

Recommended proof commands for the next implementation phase:
- `npm run typecheck -w @wtc/worker`
- `npm run typecheck -w @wtc/web`
- `npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`
- `npx eslint apps/worker/src/index.ts apps/worker/src/jobs.ts apps/worker/src/legacy-live.ts apps/worker/src/tick-once.ts apps/web/src/features/bots/readiness.ts apps/web/src/features/bots/readiness-loader.ts apps/web/src/features/bots/data.tsx apps/web/src/features/admin/bot-health-loader.ts apps/web/src/app/admin/bots/page.tsx tests/integration/worker-health-mapping.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/admin-bot-health-loader.test.ts --max-warnings 0`
- `npm run secret:scan`
- Only after explicit authorization and a disposable DB is set: `npm run accept:worker:continuity`

Commands explicitly forbidden as Phase 4.26 continuity proof:
- `npm run worker:smoke` as proof, because it can run memory-demo without `DATABASE_URL`.
- Any live bot start/stop/apply-config command.
- Any provider/exchange connectivity probe or credential/env dump.
- Any SSH, tmux, systemd, deploy, or production service command.

## Next actions
1. Add a small server-side aggregate worker continuity projection: latest `target='worker'`, age seconds, stale after 180s, core status, `botContinuityStatus`, Tortila snapshot/readState, Legacy snapshot/readState.
2. Feed that projection into `loadBotReadinessForUser()` and `BotLaunchReadinessPanel` as a real aggregate `Worker heartbeat`/`Worker continuity` row; make missing/stale/error block or hold launch review in attention according to severity.
3. Update admin bot health DTO/page so `workerBotContinuity` includes freshness/stale state and `workerContinuityPill()` cannot render ok from an old row.
4. Add focused tests for missing aggregate worker row, stale aggregate worker row, product health ok but worker stale, worker attention/not_configured, and worker error.
5. Keep the acceptance run separate: use `npm run accept:worker:continuity` only against a throwaway DB and record the DB target/scope in that phase's handoff.
