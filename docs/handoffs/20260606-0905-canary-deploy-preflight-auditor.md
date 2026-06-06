# canary-deploy-preflight-auditor handoff
## Scope
Phase 4.74 read-only devops deploy preflight for an exact-main WTC canary/worker update to
`abe6784518abcbebe38368f3cef05039d55c520f`. Scope was limited to repo docs, local git state,
GitHub CI metadata, release diffs, and attempted server read-only metadata. No code was edited,
no server mutation was performed, and no Docker, systemd, firewall, env, DB, tmux, Legacy, Tortila,
or Axioma bot state was changed.

This is a single foreground auditor handoff. No background-agent or N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md`
- `package.json`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `packages/bot-adapters/src/index.ts`
- `scripts/legacy-closed-trade-source-audit.mjs`
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `apps/worker/package.json`
- `docker-compose.yml`
- `.claude/agents/ecosystem-devops-implementer.md`

Commands inspected local/GitHub state:
- `git status --short --branch`
- `git rev-parse HEAD`
- `git rev-parse origin/main`
- `git log --oneline 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f`
- `git diff --name-status 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f`
- `git diff --name-only 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f -- packages/db/migrations packages/db/src/schema.ts packages/db/migrations/meta/_journal.json package-lock.json`
- `gh pr view 14 --json number,title,mergeCommit,state,statusCheckRollup`
- `gh run list --commit abe6784518abcbebe38368f3cef05039d55c520f --limit 10 --json ...`

Attempted server read-only metadata:
- SSH authentication against operator-known/history targets with local keys failed before any remote metadata script ran.
  No remote command executed successfully and no raw target coordinate is retained here.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Local release target is exact and clean enough to plan from, but not enough to mutate the server without a fresh server baseline. Evidence: local `HEAD`, `main`, and `origin/main` all resolve to `abe6784518abcbebe38368f3cef05039d55c520f`; local pre-handoff status was clean; `docs/SESSION_PROTOCOL.md:54-57` forbids claiming green gates unless observed in this session; SSH auth failed before current live container/service metadata could be refreshed. Recommendation: before any deploy mutation, rerun read-only server baseline with valid operator SSH and stop if live canary/worker release, service state, or rollback path differs from docs. Target part: deploy entry gate.
2. Severity: P0. The documented current WTC canary/worker release is `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` at `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker`, and that path becomes the first rollback target for an `abe6784` update. Evidence: `docs/DEPLOYMENT.md:8-18` and `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:35-49`. Recommendation: create a new timestamped release for `abe6784`; do not mutate the `3aff273` directory; preserve `3aff273` as immediate web/worker rollback. Target part: release/rollback.
3. Severity: P0. The safest deploy boundary is WTC canary plus WTC worker only; do not restart Legacy tmux, `turtle-bot.service`, `journal-server.service`, or `turtle-journal.service` for this WTC exact-main update. Evidence: Phase 4.68 recreated only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` while bot services stayed unchanged in `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:42-46`; Phase 4.72 explicitly left WTC containers on `3aff273` and forbade bot/runtime restarts except the already-completed journal-only auth switch in `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:45-49`; AGENTS hard rules keep discovery read-only and live controls blocked in `AGENTS.md:74-82`. Recommendation: use a WTC-only container replacement plan; if any bot service is degraded, stop and open a separate recovery phase instead of bundling bot restarts into deploy. Target part: live bot continuity.
4. Severity: P1. The `3aff273` -> `abe6784` diff has no DB migration/schema/package-lock changes, so `db:migrate` should be a no-op safety check and `db:seed` should not run. Evidence: local diff check over `packages/db/migrations`, `packages/db/src/schema.ts`, migration journal, and `package-lock.json` returned no files; existing canary deploy had already checked migrations through `0021_complete_pepper_potts.sql` in `docs/DEPLOYMENT.md:27-31` and `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:63-65`; deployment rollback policy says DB backup is required before any prod migration in `docs/DEPLOYMENT.md:579-584`. Recommendation: run server `npm run db:migrate -w @wtc/db` only after backup/no-op expectation is recorded; if it reports pending migrations or tries to apply DDL, stop before applying or take an explicit `pg_dump` backup and get operator approval. Target part: DB migration/rollback.
5. Severity: P1. Exact-main CI is green for the target commit, but CI is still release evidence, not live deploy proof. Evidence: GitHub read-only metadata shows PR #14 merged to `abe6784518abcbebe38368f3cef05039d55c520f`; PR checks `gates` and `e2e` succeeded; post-merge `main` CI run `27049107863` succeeded; deployment docs require future release commits be watched before deployment in `docs/DEPLOYMENT.md:622-628`. Recommendation: record PR and post-merge CI as preflight passed, then still run server build, migrate check, smoke, and burn-in. Target part: release governance.
6. Severity: P1. Target runtime changes are mostly source-proof tooling and docs, with limited package-level runtime code in `@wtc/bot-adapters`; web/worker app files and DB files did not change in this diff. Evidence: `package.json:27-31` adds verifier scripts; `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:48-70`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:104-121`, and `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:205-255` add metadata-only Legacy source audit logic; Phase 4.73 keeps Legacy importer blocked in `docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md:45-49`. Recommendation: deploy both WTC web and worker for exact-tree parity, but do not enable importer/live-control behavior and do not claim new Legacy analytics. Target part: worker/source-proof boundary.
7. Severity: P1. Smoke and burn-in gates must prove WTC health plus bot continuity, not just container uptime. Evidence: Phase 4.68 used local/public `/api/health`, protected-route redirects, worker continuity, bot PID continuity, and three one-minute burn-in cycles in `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:67-79`; Phase 4.72 worker continuity required repeated `tortila-snapshot ok`, `legacy-snapshot ok`, `bot_continuity ok`, `tortila ok`, and `legacy ok` in `docs/DEPLOYMENT.md:53-63`. Recommendation: require pre-switch baseline, pre-switch temp-container smoke, post-switch public smoke, and at least three one-minute burn-in cycles with unchanged forbidden service PIDs/restarts. Target part: smoke/burn-in.
8. Severity: High. Live server metadata was not refreshed in this session because SSH authentication was unavailable locally. Evidence: attempted SSH authentication to operator-known/history targets failed before any remote read-only command could run; `docs/handoffs/20260606-0719-runtime-deploy-readiness-auditor.md:55-59` shows the kind of server baseline that must be re-collected when SSH works. Recommendation: treat this handoff as a deploy preflight plan, not deploy authorization; rerun server metadata collection immediately before mutation. Target part: current-runtime proof.

## Decisions
1. Do not deploy in this session. This phase is read-only preflight plus one required handoff artifact.
2. Proposed new WTC release path format: `/home/ubuntu/apps/wtc_ecosystem_platform_releases/<UTC timestamp>-abe6784-phase474-exact-main`.
3. Immediate rollback for a future `abe6784` WTC update should be the currently documented release `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker`; the older `72f21d5` path remains historical second-level context, not the first rollback after `abe6784`.
4. Build expectation: clone/fetch GitHub `main`, checkout exact SHA `abe6784518abcbebe38368f3cef05039d55c520f`, reuse existing server-side WTC canary env files without printing values, run `npm ci --no-audit --no-fund` and `npm run build -w @wtc/web` in a one-off `node:22-bookworm` container.
5. Migration expectation: run `npm run db:migrate -w @wtc/db` as a no-op/pending-check against the WTC canary DB after confirming no local DB migration diff; do not run `db:seed`. If any migration is pending, stop for explicit backup/approval before applying.
6. Switch expectation: recreate only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` on the new release. Do not restart nginx, PostgreSQL, Docker daemon, `journal-server.service`, `turtle-bot.service`, `turtle-journal.service`, Legacy tmux, or any exchange-facing process.
7. Secret handling: never print raw host/IP, env values, DSNs, tokens, cookies, bearer headers, exchange keys, DB rows, or full logs. Use boolean env-key presence and count/status evidence only.

## Risks
1. Server state may have drifted since the latest docs because live SSH metadata could not be refreshed here.
2. A WTC worker recreation may surface pre-existing bot-adapter/env issues even when web build and CI are green.
3. If `db:migrate` unexpectedly sees pending migrations, rollback becomes DB backup/restore plus release rollback, not only remounting the previous release.
4. Legacy tmux supervision remains weaker than systemd supervision; bot continuity evidence must include process metadata plus worker `legacy ok`, not just container status.
5. Docker containers have no formal `HEALTHCHECK`, so HTTP health and filtered worker logs are the actual deploy gates.
6. Restarting bot services to "fix" WTC deploy symptoms would widen scope and risk position/runtime impact.

## Verification/tests
RUN in this preflight:
1. `git status --short --branch` - PASS before handoff write; current branch `codex/phase-474-canary-deploy-abe6784`, clean.
2. `git rev-parse HEAD` and `git rev-parse origin/main` - PASS; both equal `abe6784518abcbebe38368f3cef05039d55c520f`.
3. `git diff --name-status 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f` - PASS; release delta inspected.
4. DB/package-lock diff check - PASS; no changed files under `packages/db/migrations`, `packages/db/src/schema.ts`, migration journal, or `package-lock.json`.
5. GitHub PR #14 read-only metadata - PASS; PR merged to target SHA and PR `gates`/`e2e` check runs succeeded.
6. GitHub post-merge `main` CI metadata - PASS; run `27049107863` completed successfully for target SHA.
7. Server SSH probe - ATTEMPTED/BLOCKED; local keys did not authenticate to operator-known/history targets, so no remote metadata command ran.

NOT RUN in this preflight:
1. No npm local gates, tests, lint, build, Playwright, or secret scan - not needed for read-only deploy preflight; latest target CI was read from GitHub instead.
2. No server Docker inspect/log read - skipped because SSH authentication failed.
3. No server build, `npm ci`, `db:migrate`, `db:seed`, backup, temp smoke container, or container switch - forbidden in read-only preflight.
4. No WTC canary/worker restart/recreate - forbidden in this preflight.
5. No nginx, PostgreSQL, Docker daemon, systemd, firewall, tmux, Legacy, Tortila, Axioma, exchange, or bot-control mutation - forbidden/out of scope.
6. No live bot restart/start/stop/apply-config/test-connection, order/position close/cancel, `/api/marks`, or `/api/overview` - forbidden/out of scope.

## Next actions
1. With valid operator SSH, rerun a read-only pre-switch baseline: WTC canary/worker release mounts and git SHAs, container status/restart counts, `journal-server.service`, `turtle-bot.service`, `turtle-journal.service` ActiveState/SubState/MainPID/NRestarts/start timestamp, Legacy tmux/process metadata without control commands, local WTC `/api/health`, and filtered worker continuity counts.
2. Stop if the current canary release is not `20260605-203900-3aff273-phase467-picker`, if rollback path is missing, if any forbidden service is degraded before deploy, or if SSH would require printing secrets/raw coordinates.
3. Stage new release at `/home/ubuntu/apps/wtc_ecosystem_platform_releases/<UTC timestamp>-abe6784-phase474-exact-main`, checkout exact SHA `abe6784518abcbebe38368f3cef05039d55c520f`, copy/reuse server-side canary env files without printing values, and build in `node:22-bookworm`.
4. Run a pre-switch temp-container smoke on an unused localhost port: `/api/health` `200`, `/`, `/login`, `/products` `200`, protected bot/admin routes redirect to login, and no secret/log leakage.
5. Run `npm run db:migrate -w @wtc/db` only after confirming no migration diff and backup/stop policy; expect no new migration beyond `0021_complete_pepper_potts.sql`; do not run `db:seed`.
6. Recreate only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` on the new release. Do not restart Legacy tmux, `turtle-bot.service`, `journal-server.service`, `turtle-journal.service`, nginx, PostgreSQL, Docker daemon, firewall, or exchange-facing bot processes.
7. Post-switch smoke: local and public `/api/health`, public `/`, `/login`, `/products`, protected-route redirects, WTC worker running with restart count acceptable for recreation, and no raw env/log output.
8. Burn-in: at least three one-minute cycles proving WTC health `200`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`, repeated `tortila-snapshot ok`/`legacy-snapshot ok`, unchanged forbidden service PIDs/start times/NRestarts, and zero recent warning/error count after redacted filtering.
9. Rollback if post-switch WTC health/worker continuity fails: remount/recreate only WTC canary/worker back to `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260605-203900-3aff273-phase467-picker`; do not touch bot services. If DB migration unexpectedly applied, follow backup/restore plan separately.
10. After deploy, write a separate aggregate phase handoff listing exact gates RUN/NOT RUN and the per-agent handoff(s) actually produced. Do not claim an N-agent audit unless those files exist and are cited.
