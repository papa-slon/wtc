# phase-475-production-readiness handoff
## Scope
Phase 4.75 handled production-readiness follow-up after the Phase 4.74 exact-main canary deploy. Scope:
- audit what is still missing for branded-domain/full production;
- fix the deterministic release-build runbook gap found during Phase 4.74;
- add a static regression guard for the release-build command;
- run a bounded read-only longer burn-in of the current WTC canary and both bots.

No branded-domain cutover, provider-console mutation, nginx mutation, DB mutation, env-file mutation, bot restart, tmux
control, exchange call, live-control action, or credentialed provider acceptance was performed. No raw host/IP, secret,
DSN, env value, exchange key, raw DB row, or full raw log body is retained here.

Phase participants launched before edits and closed after handoff collection:
- [20260606-1000-production-domain-readiness-auditor.md](20260606-1000-production-domain-readiness-auditor.md)
- [20260606-1000-long-burnin-continuity-auditor.md](20260606-1000-long-burnin-continuity-auditor.md)
- [20260606-1000-release-build-determinism-auditor.md](20260606-1000-release-build-determinism-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md`
- `docs/handoffs/20260606-1000-production-domain-readiness-auditor.md`
- `docs/handoffs/20260606-1000-long-burnin-continuity-auditor.md`
- `docs/handoffs/20260606-1000-release-build-determinism-auditor.md`
- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- `tests/integration/deployment-release-build-static.test.ts`
- Read-only live monitor output for the existing WTC canary release `20260606-0213-abe6784-phase474-main`

## Files changed
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `tests/integration/deployment-release-build-static.test.ts`
- `docs/handoffs/20260606-1000-production-domain-readiness-auditor.md`
- `docs/handoffs/20260606-1000-long-burnin-continuity-auditor.md`
- `docs/handoffs/20260606-1000-release-build-determinism-auditor.md`
- `docs/handoffs/20260606-1000-phase-475-production-readiness.md`

## Findings
1. Severity: P0. Existing WTC canary app/worker is proven; branded-domain/full production is still not. Evidence:
   the production-domain auditor records DNS/TLS/nginx target, provider-console perimeter proof, production secret
   provisioning, DB backup/restore policy, alerting, and credentialed provider gates as NOT RUN. Recommendation: require
   an operator production-domain packet before any branded cutover or production claim. Target part: production readiness.
2. Severity: P0. Current canary longer burn-in is green. Evidence: the main thread ran 11 read-only cycles over roughly
   10 minutes against `20260606-0213-abe6784-phase474-main`; every cycle returned WTC health `200`, WTC canary/worker
   mounted on the expected release with `restartCount=0`, worker `bot_continuity ok`, `tortila ok`, and `legacy ok`,
   `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` active/running with `NRestarts=0`, and
   Legacy tmux session `bot` present. Recommendation: treat this as current-canary burn-in proof only, not branded
   production alerting proof. Target part: runtime continuity.
3. Severity: P1. Phase 4.74's Next.js TypeScript/yarn warning was a deterministic-build issue, not a bot/runtime blocker.
   Evidence: the release-build auditor found the build container inherited `NODE_ENV=production`, causing `npm ci` to omit
   dev/build tooling before `next build`; TypeScript remains correctly declared as dev/build tooling in the npm workspace
   model. Recommendation: future release builds must run `npm ci --include=dev --no-audit --no-fund` before web build.
   Target part: release-build determinism.
4. Severity: P1. Worker runtime still starts through `tsx src/index.ts`, so production-only pruning must not be introduced
   casually. Evidence: `apps/worker/package.json` uses `tsx` for `start`, and the release-build auditor flags worker
   compilation/runtime tooling as a separate devops phase. Recommendation: keep this phase bounded to build runbook/static
   guard; plan worker JS compilation or explicit runtime tooling separately. Target part: worker packaging.
5. Severity: P1. The long-burnin auditor lane itself is recorded as blocked, even though the main thread later ran the
   live burn-in. Evidence: `20260606-1000-long-burnin-continuity-auditor.md` marks its requested live SSH checks NOT RUN
   because that sub-agent did not have a safe invocable target; this aggregate separately records the main-thread burn-in
   evidence. Recommendation: do not rewrite the auditor's handoff; keep the distinction in the aggregate. Target part:
   evidence honesty.

## Decisions
1. Do not call the platform production-complete. Phase 4.75 clears deterministic build docs/static guard and current-canary
   longer burn-in only.
2. Keep the canary runtime unchanged. No bot service, Legacy tmux session, exchange-facing process, nginx, PostgreSQL,
   Docker daemon, firewall, env file, DB row, or live-control path was restarted or mutated.
3. Future server release build command must include `npm ci --include=dev --no-audit --no-fund` before `npm run build -w
   @wtc/web`.
4. Do not move TypeScript to production dependencies, add `yarn.lock`, switch package managers, or rewrite `package-lock`
   for this narrow fix.
5. Full branded production remains blocked on an operator packet: branded hostname, DNS/TLS plan, nginx target, rollback
   plan, DB migration/seed decision, secret provisioning method, smoke routes, perimeter probes, monitoring/alerting, and
   scoped credentialed provider gates.

## Risks
1. The burn-in is bounded and current-canary-only; it is not a substitute for production alerting or branded-domain smoke.
2. Provider-console/security-group proof remains separate from workstation/server HTTP health.
3. Future deploys can reintroduce nondeterministic builds if they omit `--include=dev` or if `next build` creates lockfile
   or package manifest deltas.
4. Worker runtime packaging remains not ideal while `tsx` is used at runtime.
5. Legacy realized analytics/import remains source-blocked until a valid source packet passes as `ready_for_mapper`.

## Verification/tests
RUN:
1. Agents-before-edits gate - PASS; three read-only handoffs exist and are cited above.
2. Agent cleanup - PASS; all listed participants were closed after result collection.
3. Focused static test - PASS: `npx vitest run tests/integration/deployment-release-build-static.test.ts --minWorkers=1 --maxWorkers=2`.
4. Documentation/governance pre-aggregate checks - PASS: `npm run governance:check` passed against the previous aggregate
   with one known historical warning; `npm run secret:scan` passed; `git diff --check` passed.
5. Main-thread current-canary long burn-in - PASS: 11 cycles over roughly 10 minutes; WTC health `200`; WTC canary/worker
   `restartCount=0` on `20260606-0213-abe6784-phase474-main`; worker continuity green; bot-related systemd units
   active/running with `NRestarts=0`; Legacy tmux `bot` present.

NOT RUN:
1. Branded-domain DNS/TLS/nginx cutover - NOT RUN; no operator production-domain packet supplied.
2. Provider-console/security-group/private-network proof - NOT RUN; requires operator/provider evidence.
3. Production DB migration, seed, backup, restore, or intended append-only role proof - NOT RUN; no DB-affecting release or
   approved production DB phase.
4. Stripe, Axioma, LMS object-store/scanner live provider gates - NOT RUN; separate credentialed phases required.
5. Live-control, exchange ping, test-connection, start/stop/apply-config, `/api/marks`, `/api/overview`, order close/cancel
   - NOT RUN and forbidden.
6. Full root `npm test`, lint, typecheck, web build, or Playwright after the Phase 4.75 local edit - NOT RUN because this
   phase changed docs plus a focused static test; PR/main CI should run broader gates if merged.

## Next actions
1. Run final local gates for this aggregate: governance, secret scan, diff check, and focused static test.
2. Open a PR for Phase 4.75, observe required GitHub checks, merge, and observe post-merge `main` checks before relying on
   the docs/static guard in `main`.
3. For the next real production step, do not start another canary-polish loop. Start only when the operator supplies the
   branded-production packet or a scoped credentialed provider packet.
4. For the next server release, execute the deterministic build command and fail the release if `next build` creates a
   `yarn.lock`, app-local lockfile, package manifest delta, or unexpected package-lock delta.
