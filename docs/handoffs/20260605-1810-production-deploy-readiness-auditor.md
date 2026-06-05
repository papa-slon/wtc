# production-deploy-readiness-auditor handoff
## Scope
Read-only Phase 4.60 production/deploy readiness audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Task focus: production deployment, CI, env, Docker, hosting, scripts, canary, monitoring, and secret provisioning evidence for WTC bot settings/admin/Tortila integration work. Special focus areas were journal auth/firewall, env examples, deploy docs, CI commands, health checks, and no-live-control boundaries.

Constraints honored: no live deploy, no production DB mutation, no exchange/provider probes, no `/api/marks`, no live bot start/stop/apply-config, no raw secrets/DSNs/tokens/passwords printed, and no file writes except this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
- `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`
- `docs/handoffs/20260605-1730-phase-459-safety-gate-auditor.md`
- `docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md`
- `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`
- `.env.example`
- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `package.json`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/middleware.ts`
- `packages/auth/src/rate-limit.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `tests/integration/ci-production-env.test.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/tortila-real-read-managed-runner.test.ts`

## Files changed
- `docs/handoffs/20260605-1810-production-deploy-readiness-auditor.md` only.

## Findings
1. Severity P0 - Full production-ready status is still not claimable for this tree. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:12-16` keeps full production blocked by provider-side journal bearer-auth proof, live bot control, live provider/billing/Axioma/LMS gates, branded DNS/TLS, burn-in/alerting, GitHub CI for the exact tree, and intended production append-only audit-role proof; `docs/ACCEPTANCE_MATRIX_MASTER.md:241-244` says "production-ready" requires real-PG, git+CI, secrets, Stripe, Axioma, Legacy/auth gates, and all per-group gates; `docs/NEXT_ACTIONS.md:152-153` says deploy must be a dedicated git/CI/deploy phase with post-deploy smoke. Recommendation: open a dedicated release/deploy phase before any production claim. Target part: production gates and aggregate release handoff.

2. Severity P0 - Tortila journal production auth/firewall is locally improved but not production-proven. Evidence: Phase 4.59 says local read-token proof does not enable production DB mutation, production deploy, or production network/firewall changes at `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md:3-5`; it records production auth/firewall, deploy, CI, monitoring, and burn-in as NOT RUN at `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md:66-71`; it says production still needs real secret provisioning, service/env rollout, firewall/security-group proof, authorized probes, deploy/monitoring evidence, and artifact scans at `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md:74-77`. Recommendation: do not set production `BOT_ADAPTER_MODE=read-only` until token provisioning plus firewall/network proof are observed on the target. Target part: Tortila production readiness gate.

3. Severity P1 - WTC docs still contain stale journal-auth wording relative to the inspected adjacent Tortila source and Phase 4.59 result. Evidence: `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md:43` says `docs/CONTRACTS/tortila-adapter.md` still claims no auth middleware and tracks token auth as future, while local adjacent source had token middleware; `docs/handoffs/20260605-1730-phase-459-safety-gate-auditor.md:63` repeats that docs/status should be corrected before a release claim. Recommendation: safe local fix for main agent next: update `docs/CONTRACTS/tortila-adapter.md`, `docs/DEPLOYMENT.md`, and status docs to distinguish "local token middleware inspected/proven" from "production token provisioning/firewall not run". Target part: WTC contract/docs truth.

4. Severity P1 - Production-like env validation is strong for secrets, billing, Axioma, Legacy live-read, and journal token, but real Tortila read-only mode does not require an explicit production journal URL beyond the configured default. Evidence: `packages/config/src/env.ts:38-39` defines a default Tortila journal base URL and optional canonical URL; `packages/config/src/env.ts:116-120` requires `JOURNAL_READ_TOKEN` in production when adapter mode is not mock, but does not also require an explicitly supplied Tortila journal URL; `apps/worker/src/index.ts:266` selects `TORTILA_JOURNAL_URL` or the base URL and `apps/worker/src/index.ts:314-317` passes the URL and read token into the adapter. Recommendation: safe local fix for main agent next: add a production-like env guard and tests requiring explicit `TORTILA_JOURNAL_URL` or an explicitly supplied base URL when `BOT_ADAPTER_MODE` is not mock, so deploy cannot accidentally rely on an implicit default. Target part: `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, worker docs.

5. Severity P1 - CI is implemented, but current-session CI is not observed green for this dirty tree and deploy docs are partly stale. Evidence: `.github/workflows/ci.yml:1` names `npm run ci:local` as the local equivalent; `.github/workflows/ci.yml:47-110` runs install, core, governance, lint, typecheck, secret scan, ephemeral production-like env validation, migrations, seed, tests, coverage, and web build; `.github/workflows/ci.yml:112-159` runs Playwright plus visual-evidence inventory/upload; `package.json:56` defines `ci:local`. However, `docs/DEPLOYMENT.md:442-453` still describes CI as staged/inert because the repo had no git/remote in an older state, while this checkout now tracks an `origin` branch. Recommendation: safe local fix for main agent next: update CI status docs to "repo has remote, but Actions status for this exact dirty/uncommitted tree is NOT RUN"; do not claim CI green until a commit/PR or deploy branch actually runs. Target part: `docs/DEPLOYMENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, aggregate release handoff.

6. Severity P1 - Docker/hosting artifacts are not sufficient as production deployment artifacts. Evidence: `docker-compose.yml:1-4` says it is local development only and defines only a local Postgres service; no app Dockerfile, nginx template, or systemd unit file was found in the repo file inventory; `docs/DEPLOYMENT.md:491-500` describes phased server rollout, but production server deployment, nginx/domain/TLS cutover, and live control are separate approval gates; `docs/DEPLOYMENT.md:543-545` keeps production deployment, nginx/domain/TLS, and production auth proxy proof as NOT RUN. Recommendation: safe local fix for main agent next: add a sanitized production deployment checklist or templates for web/worker process shape, rollback, health smoke, and firewall assertions without committing secrets or touching servers. Target part: deploy docs/devops artifacts.

7. Severity P1 - Machine-readable health/readiness for hosting is incomplete inside the app repo. Evidence: the file inventory has an admin page at `apps/web/src/app/admin/system-health/page.tsx` but no `apps/web/src/app/api/health*` route; `apps/web/src/app/admin/system-health/page.tsx:52-77` shows a worker heartbeat card from persisted `integration_health_checks`; `apps/web/src/app/admin/system-health/page.tsx:276-303` lists health rows for an authenticated admin surface. Recommendation: safe local fix for main agent next: either add a non-secret internal liveness/readiness route with tests, or explicitly document the canary smoke path and why hosting health checks use it. It must not reveal DB URLs, tokens, adapter URLs, raw health details, or live provider state. Target part: web health route or deployment runbook.

8. Severity P1 - App-layer auth rate limiting exists, but production nginx/shared-store/trusted-proxy proof is still NOT RUN. Evidence: `apps/web/src/middleware.ts:38-40` rate-limits `/login` and `/register`; `apps/web/src/middleware.ts:80-89` uses proxy-derived client IP and fails closed in production when no client is identifiable; `packages/auth/src/rate-limit.ts:37-42` documents `x-forwarded-for` then `x-real-ip`; `tests/integration/auth-rate-limit-middleware.test.ts:47-66` pins 429 and `Retry-After`; `docs/DEPLOYMENT.md:545` keeps production auth `limit_req` and trusted proxy header verification NOT RUN. Recommendation: safe local fix for main agent next: add a production auth/firewall checklist for nginx/shared throttling, trusted proxy headers, and retained redacted evidence. Target part: `docs/SECURITY_MODEL.md`, `docs/DEPLOYMENT.md`, deploy handoff.

9. Severity P1 - Secret hygiene tooling is good locally, but production secret provisioning is still a deploy gate. Evidence: `.env.example:67-72` lists session/vault variables without values; `.env.example:96-98` documents the journal read-token variable without a real token; `scripts/redacted-child-process.mjs:6-20` covers DB/env secret assignments, provider URLs, auth headers, bearer values, cookies, JWTs, and provider tokens; `scripts/redacted-child-process.mjs:44-62` applies redaction; `package.json:17` exposes `secret:scan`; `.github/workflows/ci.yml:68-87` generates ephemeral CI-only env for production-like config validation. Recommendation: before production deploy, use a secret provisioning checklist with source-of-truth ownership, rotation plan, redacted smoke, artifact scan, and no raw terminal transcript retention. Target part: secret provisioning docs and deployment evidence.

10. Severity P0 positive control - No-live-control and no-`/api/marks` boundaries are strongly represented in WTC code and tests. Evidence: `packages/bot-adapters/src/http.ts:1-10` marks real HTTP adapters as read-only and forbids `/api/marks`, exchange calls, and SSH/tmux interactions; `packages/bot-adapters/src/http.ts:41-50` sends GET requests only and does not log the read token; `packages/bot-adapters/src/http.ts:75-88` lists only allowed Tortila read endpoints and keeps controls disabled; `packages/bot-adapters/src/control.ts:1-18` hard-disables bot control unless both flag and audit approval are true; `apps/worker/src/jobs.ts:97-112` records the worker collector as read-only and never calling `/api/marks`. Recommendation: preserve this boundary in all deploy-readiness fixes; do not add exchange ping, provider probe, start/stop/apply-config, `/api/overview`, or `/api/marks` work to a production-readiness phase. Target part: bot adapters, worker, admin/user bot surfaces.

## Decisions
1. Current verdict: not production-ready for full WTC. Local bot/admin/Tortila readiness is strong, but production deployment remains blocked by target-environment gates.
2. Locally completable now, without live server contact:
   - Reconcile WTC Tortila contract/deploy/status docs with Phase 4.59 local journal token proof while keeping production firewall/token provisioning NOT RUN.
   - Add production-like env guard/tests requiring an explicit Tortila journal endpoint when real adapter mode is enabled.
   - Add or document a non-secret health/readiness smoke suitable for canary/hosting checks.
   - Update CI/deploy docs to reflect this checkout is git-backed while CI for the exact dirty tree remains NOT RUN.
   - Add a sanitized deploy checklist for web/worker process manager, rollback, nginx/TLS, firewall, auth proxy, and monitoring evidence.
3. Not locally completable in this auditor lane: production secret provisioning, production DB migration/seed, production append-only audit-role proof, live nginx/firewall verification, live journal auth probes, GitHub Actions for the exact tree, canary switch, monitoring burn-in, and any provider/exchange/bot-control check.
4. No background agents were spawned by this auditor; none are left running.

## Risks
1. Treating Phase 4.59 loopback/local token proof as production auth would hide missing target secret provisioning, service env rollout, firewall restriction, and redacted live smoke.
2. Enabling real adapter mode with implicit/default journal endpoint config can make a deploy look configured while it is only accidentally pointing at a local default.
3. The broad pre-existing dirty worktree means any release/CI phase must intentionally stage and verify the exact tree; previous canary proof does not automatically cover the current uncommitted state.
4. Admin `/admin/system-health` is useful operational UI, but it is not a substitute for a minimal hosting liveness/readiness contract unless the deploy runbook says so explicitly.
5. CI workflow and local runners can produce sensitive-looking output if operators retain raw terminal buffers; only redacted summaries/scanned artifacts should be archived.

## Verification/tests
RUN this session:
1. `Get-Location` - confirmed cwd is `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
2. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` tracking `origin`, with a broad pre-existing dirty/untracked tree; this audit wrote only this handoff.
3. `git remote -v` - observed an `origin` remote exists; URL not reproduced here.
4. `Test-Path docs/handoffs/20260605-1810-production-deploy-readiness-auditor.md` before write - file did not exist.
5. Static file inventory and targeted line reads with `rg`, `Get-ChildItem`, and `Get-Content` over CI, env, deploy docs, Docker, scripts, worker, adapter, middleware, health UI, and Phase 4.59 handoffs.
6. `.env.example` was inspected by variable/comment shape only; no live `.env` files were opened.

Prior evidence inspected but not rerun:
1. Phase 4.59 local journal token and managed Tortila real-read proof, recorded in `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`.
2. Prior canary deploy and local gate records in `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md`.

NOT RUN this session:
1. `npm run ci:local`, GitHub Actions, `npm test`, lint, typecheck, build, coverage, Playwright, visual review, and secret scan - read-only auditor scope; no claim they are green for this session.
2. Docker compose, DB migration, DB seed, real-PG harness, managed DB runners, audit append-only role preflight - no DB/service mutation permitted.
3. `npm run accept:tortila:real-read:managed`, worker continuity managed runner, journal HTTP smoke - no local server/worker proof requested for this auditor lane.
4. Production deploy, canary switch, SSH, nginx/systemd/tmux/process control, production firewall checks, production DB mutation, provider/exchange probes, and monitoring burn-in - explicitly forbidden or separate approved phase.
5. `/api/marks`, `/api/overview`, exchange ping, provider probe, live bot start/stop/apply-config, test-connection, key-read checks - prohibited by scope and safety model.

## Next actions
1. Main agent should implement the safe local doc/config readiness fixes first: contract/status/deployment truth, explicit Tortila endpoint env guard, and health/readiness runbook or route.
2. Then run focused local gates for those changes only: config/env tests, worker/token static tests if touched, docs governance, secret scan, typecheck/lint as needed.
3. Open a separate dedicated release/deploy phase for staging/canary: stage the exact tree, run CI/local gate stack, verify GitHub Actions or release build, provision secrets without printing them, apply approved DB migration/seed only against approved targets, smoke web/worker health, verify journal auth/firewall from the target, and record gates RUN/NOT RUN.
4. Keep live bot controls, exchange/provider probes, `/api/marks`, `/api/overview`, production DB mutation, and server process changes out of any local production-readiness cleanup until a separate audited phase explicitly authorizes them.
