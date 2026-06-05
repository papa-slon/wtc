# bot-continuity-gates-security-auditor handoff
## Scope
Read-only Phase 4.26 gates/security audit for adding worker-continuity requirements to launch readiness and the selected-user admin mirror. I inspected package scripts, `scripts/gates.mjs`, worker continuity/tick paths, bot-readiness tests, admin-user detail tests, Playwright DB coverage, and secret/governance safeguards. I did not edit code, tests, config, migrations, adapters, package scripts, or live systems. I did not run live bot start/stop/apply-config, provider/exchange probes, SSH, tmux, systemd, deploy, or live credential gates.

Start state observed: branch `codex/bot-analytics-settings-canary-20260603` at `e2d705f`; the worktree was already heavily dirty with many modified and untracked files before this audit lane. I treated those as pre-existing shared work and did not revert them.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md`
- `docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/handoffs/20260604-1724-phase-4-25-admin-launch-readiness-mirror.md`
- `package.json`
- `apps/worker/package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `.gitignore`
- `.secretlintignore`
- `.secretlintrc.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
None - read-only audit, except this handoff: `docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md`.

## Findings
1. Severity P1 - Evidence: `package.json:21`, `package.json:22`, `package.json:23`, `scripts/safe-worker-tick.mjs:11`, `scripts/safe-worker-tick.mjs:21`, `apps/worker/src/tick-once.ts:23`. Recommendation: treat `npm run accept:worker:continuity` as a controlled DB acceptance hook, not as a standalone green gate by exit code. It runs one worker tick and prints `worker_status=...; tortila=...; legacy=...`, but Phase 4.26 must explicitly require the observed status/output and/or DB `worker` health row to satisfy the new readiness requirement. Target part: worker continuity acceptance gate.
2. Severity P1 - Evidence: `apps/worker/src/index.ts:97`, `apps/worker/src/index.ts:104`, `apps/worker/src/index.ts:109`, `apps/worker/src/index.ts:291`, `apps/worker/src/index.ts:296`, `tests/integration/worker-health-mapping.test.ts:84`, `tests/integration/worker-health-mapping.test.ts:94`, `tests/integration/worker-tortila-snapshot.test.ts:171`, `tests/integration/worker-tortila-snapshot.test.ts:185`, `tests/integration/worker-tortila-snapshot.test.ts:200`. Recommendation: keep worker-continuity truth in the focused worker tests; skipped/not_configured must remain attention/not_configured, malformed/unreachable must be error, and token-shaped values must not leak into health detail. Target part: worker aggregate heartbeat and readiness DTO source.
3. Severity P1 - Evidence: `apps/web/src/features/bots/readiness.ts:114`, `apps/web/src/features/bots/readiness.ts:116`, `apps/web/src/features/bots/readiness.ts:155`, `apps/web/src/features/bots/readiness.ts:261`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:360`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:361`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:521`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:527`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:528`, `tests/integration/admin-user-bot-detail-static.test.ts:104`, `tests/integration/admin-user-bot-detail-static.test.ts:111`, `tests/e2e/admin-user-bot-detail-db.spec.ts:206`, `tests/e2e/admin-user-bot-detail-db.spec.ts:232`. Recommendation: if worker-continuity becomes launch-readiness/admin-mirror required data, update user and admin tests together while preserving the no-live-probe/no-start-stop-apply boundary. Target part: launch readiness UI and selected-user admin mirror.
4. Severity P1 - Evidence: `scripts/run-admin-user-bot-detail-e2e.mjs:10`, `scripts/run-admin-user-bot-detail-e2e.mjs:11`, `scripts/run-admin-user-bot-detail-e2e.mjs:35`, `scripts/run-admin-user-bot-detail-e2e.mjs:36`, `scripts/run-admin-user-bot-detail-e2e.mjs:37`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:20`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:24`, `playwright.admin-user-bots-db.config.ts:65`, `playwright.admin-user-bots-db.config.ts:67`, `playwright.admin-user-bots-db.config.ts:68`, `playwright.admin-user-bots-db.config.ts:69`, `tests/e2e/admin-user-bot-detail-db.spec.ts:118`, `tests/e2e/admin-user-bot-detail-db.spec.ts:158`, `tests/e2e/admin-user-bot-detail-db.spec.ts:174`. Recommendation: run the admin selected-user DB browser matrix only with a fresh throwaway Postgres DB/admin URL and redacted runner; use it to prove no cross-user provider/raw/secret leak and no edit/control buttons. Target part: DB-backed admin mirror acceptance.
5. Severity P2 - Evidence: `scripts/redacted-child-process.mjs:7`, `scripts/redacted-child-process.mjs:8`, `scripts/redacted-child-process.mjs:16`, `scripts/redacted-child-process.mjs:19`, `scripts/redacted-child-process.mjs:44`, `scripts/redacted-child-process.mjs:78`, `.secretlintignore:10`, `.secretlintignore:11`, `.secretlintignore:16`, `.gitignore:32`, `.gitignore:33`, `.gitignore:35`, `tests/e2e/admin-user-bot-detail-db.spec.ts:234`. Recommendation: keep `npm run secret:scan` in the gate set, but do not treat it as screenshot/log leak proof because test artifacts and PNGs are ignored; add artifact inventory plus explicit visual/text review before archiving any Playwright screenshots. Target part: secret/artifact governance.
6. Severity P2 - Evidence: `scripts/gates.mjs:13`, `scripts/gates.mjs:14`, `scripts/gates.mjs:15`, `scripts/gates.mjs:16`, `scripts/gates.mjs:17`, `scripts/gates.mjs:49`, `scripts/gates.mjs:50`, `scripts/gates.mjs:51`, `scripts/gates.mjs:53`, `scripts/check-governance.mjs:11`, `scripts/check-governance.mjs:14`, `docs/SESSION_PROTOCOL.md:54`, `docs/SESSION_PROTOCOL.md:56`. Recommendation: use `node scripts/gates.mjs full` as the baseline regression gate only; it does not include worker DB continuity acceptance or admin selected-user DB matrix. Run `npm run governance:check` after the Phase 4.26 aggregate cites this per-agent handoff and lists exact RUN/NOT RUN gates. Target part: phase closure/governance.

## Decisions
- Recommended Phase 4.26 no-credential/local gate set:
  - `npm run typecheck -w @wtc/worker`
  - `npm run typecheck -w @wtc/web`
  - `npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
  - `npm run secret:scan`
- Recommended baseline regression gate after implementation:
  - `node scripts/gates.mjs full`
  - Run `node scripts/gates.mjs e2e` separately only if browser coverage is in scope; `scripts/gates.mjs` intentionally keeps e2e out of `full`.
- Recommended controlled worker-continuity DB acceptance, only against a fresh throwaway WTC test DB:
  - `$env:DATABASE_URL = '<fresh-wtc-test-db-url>'`
  - `$env:LEGACY_LIVE_READS_ENABLED = 'false'`
  - `$env:LEGACY_DATABASE_URL = ''`
  - `$env:TORTILA_JOURNAL_URL = ''`
  - `$env:TORTILA_JOURNAL_BASE_URL = ''`
  - `npm run db:migrate -w @wtc/db`
  - `npm run accept:worker:continuity`
  - Required evidence: record the redacted one-shot output and/or DB `integration_health_checks` worker detail; do not call it green unless the expected `worker_status`, `bot_continuity`, `tortila`, and `legacy` states match the Phase 4.26 requirement.
- Recommended controlled admin selected-user browser DB acceptance:
  - `$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = '<admin-url-that-creates-and-drops-only-wtc-test-dbs>'`
  - `npm run e2e:admin-user-bots:db:managed:matrix`
  - Follow with `npm run evidence:visual -- --inventory tests/e2e/screenshots` and an explicit screenshot/text artifact review before retaining evidence.
- `npm run worker:smoke` is useful as a local smoke only; it can run memory-demo when no `DATABASE_URL` exists and must not be accepted as worker-continuity proof.
- No background agents were spawned by this audit lane, so none were left open.

## Risks
- `accept:worker:continuity` currently proves that a tick ran, not that all required bot-continuity statuses are green; Phase 4.26 must define and assert the acceptable status tuple.
- The worker wrapper forces `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`, but inherited Legacy/Tortila provider env should still be cleared/overridden for no-provider-probe acceptance.
- The admin DB browser matrix writes screenshots and may retain Playwright traces on failure; secretlint ignores screenshots and test artifacts, so artifact review is mandatory.
- The worktree is already heavily dirty; this handoff certifies only the read-only audit and the single handoff file.

## Verification/tests
RUN in this audit lane:
- `git status --short --branch` - PASS/observed dirty branch state before and after audit.
- `git log -1 --oneline` - PASS/observed `e2d705f Upgrade Legacy bot settings and pub_id stats`.
- `npm run typecheck -w @wtc/worker` - PASS.
- `npx vitest run tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/db-seed-preview-hardening.test.ts` - PASS, 10 files / 65 tests.
- `npm run secret:scan` - PASS.

NOT RUN / NOT GREEN in this audit lane:
- `npm run accept:worker:continuity` - NOT RUN; requires explicit fresh throwaway `DATABASE_URL`, migrates/uses a DB, and writes worker health/snapshot rows.
- `npm run worker:smoke` - NOT RUN as continuity proof; it can fall back to memory-demo without `DATABASE_URL`.
- `npm run worker:tick`, `npm run dev:worker`, `npm run dev -w @wtc/worker` - NOT RUN; worker process/tick execution is outside this read-only audit lane.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; require throwaway/admin Postgres setup, DB mutation, dev server, and Playwright artifacts.
- `node scripts/gates.mjs quick`, `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e` - NOT RUN; these are implementation/closure gates and retained-log/browser gates, not necessary for this read-only auditor handoff.
- `npm run db:migrate`, `npm run db:seed`, `npm run accept:real-pg:managed`, `npm run accept:audit:append-only-role`, `npm run accept:audit:append-only-role:managed` - NOT RUN; DB-mutating gates requiring explicit throwaway/intended DB scope.
- `npm run accept:lms:object-storage`, `npm run accept:lms:external-scanner`, `npm run accept:billing:stripe-webhook`, `npm run accept:billing:stripe-checkout`, `npm run accept:axioma:handoff-preflight` - NOT RUN; credential/live-system gates outside this focused worker-continuity readiness audit.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probes, SSH, tmux, systemd, deploy, production monitoring, and live bot service mutation - NOT RUN by safety scope.
- `npm run governance:check` after this handoff - NOT RUN; the future Phase 4.26 aggregate should cite this handoff first, then run governance.

## Next actions
1. If Phase 4.26 implements worker-continuity as a launch-readiness/admin-mirror requirement, update both user and admin surfaces from safe worker/readiness DTOs only; no adapter calls, provider probes, exchange pings, secret opens, forms, or live-control actions.
2. Run the no-credential focused gate set first, then `node scripts/gates.mjs full` as the baseline regression gate.
3. Run `npm run accept:worker:continuity` only with a fresh throwaway `DATABASE_URL` and cleared provider env; assert the observed worker/bot continuity tuple, not just process exit 0.
4. Run `npm run e2e:admin-user-bots:db:managed:matrix` only with a throwaway-admin DB URL; review screenshot/text artifacts for secret/raw/provider leakage before retaining them.
5. Write the Phase 4.26 aggregate handoff citing this file and every participating per-agent handoff, then run `npm run governance:check`.
