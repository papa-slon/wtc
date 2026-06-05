# Phase 4.61 main merge and CI truth handoff
## Scope
Phase 4.61 records the release/CI truth after the Phase 4.60 production-readiness hardening tree was committed, pushed,
merged through PR #1, and verified on `main`.

Agents launched before edits:
- [docs/handoffs/20260605-2005-release-merge-deploy-auditor.md](20260605-2005-release-merge-deploy-auditor.md)
- [docs/handoffs/20260605-2005-production-boundary-auditor.md](20260605-2005-production-boundary-auditor.md)
- [docs/handoffs/20260605-2005-ci-pr-auditor.md](20260605-2005-ci-pr-auditor.md)

Boundaries honored: no SSH, no systemd/tmux/process control, no production DB mutation, no production deploy, no canary
switch, no provider/exchange probes, no live bot start/stop/apply-config/test-connection, no `/api/marks`, no
`/api/overview`, no live journal probes, and no raw secret/DSN/token/password output.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `.github/workflows/ci.yml`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`
- The three release per-agent handoffs linked above
- GitHub PR #1 and GitHub Actions runs `27015532545` and `27016644974` via read-only `gh` commands

## Files changed
- `.github/workflows/ci.yml`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-2005-release-merge-deploy-auditor.md`
- `docs/handoffs/20260605-2005-production-boundary-auditor.md`
- `docs/handoffs/20260605-2005-ci-pr-auditor.md`
- `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md`

## Findings
1. Severity P0 - The Phase 4.60 exact tree has GitHub release proof now. Evidence: PR #1 is merged with merge commit
   `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`; PR CI run `27015532545` passed `gates` and `e2e`; post-merge `main`
   push CI run `27016644974` passed `gates` and `e2e`. Recommendation: active status docs must no longer say GitHub
   Actions for the committed exact tree are NOT RUN. Target part: release truth.

2. Severity P0 - CI success is not production deploy. Evidence: all three release agents kept deploy, production DB,
   production Tortila journal secret/firewall probes, canonical Tortila source landing, Legacy closed-trade source,
   live controls, and monitoring/burn-in outside the green CI proof. Recommendation: keep these as separate explicit
   gates. Target part: production boundary.

3. Severity P1 - GitHub `gates` was slightly weaker than local `ci:local` because it did not explicitly run
   `npm run typecheck -w @wtc/worker`. Evidence: release auditor finding 5 and Phase 4.60 local proof both name worker
   workspace typecheck as a local green gate. Resolution: `.github/workflows/ci.yml` now includes `Typecheck @wtc/worker`
   after the web workspace typecheck. Target part: CI parity.

4. Severity P1 - Active docs still contained stale "not git-backed / CI NOT RUN" wording. Resolution: current status,
   next-actions, deployment, credential-blocker, production-blocker, and implemented-file docs now distinguish the cleared
   GitHub CI gate from still-open production/live gates. Target part: operator handoff truth.

## Decisions
1. Treat PR #1 and `main` run `27016644974` as the green release/CI proof for the Phase 4.60 merge commit.
2. Do not relabel WTC as production complete from CI alone.
3. Future work starts from `main` at `ed31aaaf89ebc4920a13887542fa3bb0bbd99545` or later, on a fresh `codex/` branch.
4. Keep live-control, provider/exchange, production DB, SSH/systemd/tmux, canary, firewall, and monitoring work out of this
   phase.

## Risks
1. Docs can drift again if future PRs merge without watching the post-merge `main` run.
2. Branch protection/rulesets were absent when audited, so CI-required behavior is currently process-enforced.
3. Production operators might misread GitHub CI as deployment proof unless the RUN/NOT RUN table stays explicit.

## Verification/tests
RUN:
1. `git status --short --branch` - observed local checkout on `main...origin/main` at merge commit before this docs/CI
   parity branch was created.
2. `gh run view 27016644974 --json status,conclusion,updatedAt,url,jobs` - observed `status=completed`,
   `conclusion=success`, job `gates=success`, and job `e2e=success`.
3. Per-agent read-only GitHub checks recorded in `20260605-2005-ci-pr-auditor.md`: PR #1 `MERGED`, PR run `27015532545`
   green, post-merge `main` run `27016644974` green.
4. The three release agents were closed after their handoffs were collected. Closed IDs:
   `019e97e3-3525-7803-a3c1-5ac27016e3c2`, `019e97e3-6d9a-7001-942c-388fa697f0ad`,
   `019e97e3-a7de-7933-8d17-3e9f9b01b601`.
5. `npm run typecheck -w @wtc/worker` - PASS.
6. `npm run governance:check` - PASS with `0` errors and `1` known historical warning.
7. `npm run secret:scan` - PASS.
8. `git diff --check` - PASS.
9. `npm run lint` - PASS.
10. `npm run typecheck` - PASS.

NOT RUN:
1. Production DB migration/seed, production deploy, canary switch, nginx/TLS/firewall checks, and monitoring burn-in.
2. Production Tortila journal secret provisioning and authorized positive/negative network probes.
3. Canonical git-backed Tortila source landing.
4. Legacy closed-trade source proof/import implementation.
5. Live bot controls, exchange/provider probes, test-connection, `/api/marks`, and `/api/overview`.
6. Branch protection/ruleset mutation.

## Next actions
1. Run local docs/CI parity verification, then push this Phase 4.61 truth branch through PR/CI.
2. Continue only with non-looping remaining gates: production deploy/canary with explicit target approval, canonical Tortila
   source landing, production Tortila auth/firewall probes, Legacy closed-trade source proof, live-control security audit,
   or monitoring/burn-in.
