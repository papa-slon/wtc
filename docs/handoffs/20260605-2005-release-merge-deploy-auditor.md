# release-merge-deploy-auditor handoff
## Scope
Phase 4.61 read-only merge/deploy audit for PR #1 and the current release path.

Question answered: whether PR #1 can be merged safely, what `main` CI will prove after merge, what deploy remains NOT RUN,
and the exact next safe commands.

Boundaries honored: no SSH, no systemd/tmux/process control, no production DB mutation, no production deploy, no live bot
controls, no provider/exchange probes, no `/api/marks`, no live journal probes, and no secret/DSN/token output. This audit
only inspected repository files and GitHub metadata.

Current verdict: PR #1 is mergeable from an observed-checks/code-release perspective if the operator accepts the large
PR scope and rechecks CI immediately before merge. It is not a deploy approval and it is not final production proof.

## Files inspected
- GitHub PR #1 metadata and checks via `gh pr view 1` and `gh pr checks 1`.
- GitHub `main` branch protection and rulesets via `gh api repos/papa-slon/wtc/branches/main/protection` and
  `gh api repos/papa-slon/wtc/rulesets`.
- `.github/workflows/ci.yml`
- `package.json`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`

## Files changed
Only this handoff artifact: `docs/handoffs/20260605-2005-release-merge-deploy-auditor.md`.
No product, source, workflow, deployment, or runbook files were edited.

## Findings
1. Severity: P1. PR #1 has green GitHub checks and can be merged as a code release only after a final freshness check.
   Evidence: `gh pr view 1 --json ...` observed PR #1 open, non-draft, base `main`, head
   `codex/bot-analytics-settings-canary-20260603`, title `Complete bot settings and readiness gates`, head commit
   `d9356422e3de7c267862af6e3e81d3ff766624f3`, and status checks `CI / gates` SUCCESS plus `CI / e2e` SUCCESS.
   `gh pr checks 1` observed `gates pass` and `e2e pass`. Recommendation: before merging, rerun `gh pr checks 1 --watch`
   and merge with `--match-head-commit d9356422e3de7c267862af6e3e81d3ff766624f3` so a stale head cannot be merged.
   Target part: release merge.

2. Severity: P1. GitHub is not enforcing branch protection on `main`.
   Evidence: `gh api repos/papa-slon/wtc/branches/main/protection` returned `Branch not protected`; `gh api
   repos/papa-slon/wtc/rulesets` returned `[]`. Recommendation: treat `CI / gates` and `CI / e2e` as manual required
   checks for this merge, then add a branch ruleset requiring both jobs in a later policy-hardening phase. Target part:
   branch/main CI policy.

3. Severity: P1. Latest mergeability metadata is inconsistent enough to require a final requery.
   Evidence: an initial `gh pr view 1` returned `mergeStateStatus: CLEAN`; a later requery returned
   `mergeStateStatus: UNKNOWN` and `mergeable: UNKNOWN` while the same two check runs remained SUCCESS. Recommendation:
   do not merge from stale cached output; run the exact verification commands below immediately before merge. Target part:
   release merge.

4. Severity: P1. `main` CI will rerun a strong repository gate on merge, but it will not prove production deploy.
   Evidence: `.github/workflows/ci.yml:5-12` triggers on push and PR to `main` and defines `gates`; `.github/workflows/ci.yml:83-113`
   validates production-like env fences, runs DB migrations, seeds DB, runs tests, coverage, and web build;
   `.github/workflows/ci.yml:115-154` defines the Playwright `e2e` job plus visual evidence inventory/manifest validation.
   Recommendation: require the post-merge `main` push run to finish green before any deploy/canary work. Target part:
   branch/main CI policy.

5. Severity: P2. Workflow/local gate drift exists: local `ci:local` is slightly stronger than GitHub `gates`.
   Evidence: `package.json:56` includes `npm run typecheck -w @wtc/worker`; `.github/workflows/ci.yml:59-63` runs root
   typecheck and web typecheck but does not explicitly run `npm run typecheck -w @wtc/worker`. Phase 4.60 local proof did
   run worker typecheck, but future `main` CI alone will not show that exact workspace command. Recommendation: after merge
   or before next release, add an explicit `Typecheck @wtc/worker` workflow step. Target part: CI completeness.

6. Severity: P1. The release docs are stale relative to PR #1 CI and should not be read as current after this audit.
   Evidence: `docs/STATUS.md:37-38`, `docs/NEXT_ACTIONS.md:79`, and
   `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md:125-126` still classify GitHub Actions for
   the committed exact tree as NOT RUN; PR #1 now has `CI / gates` and `CI / e2e` green. `docs/DEPLOYMENT.md:442-450`
   still contains an older "CI status (staged - inert)" note. Recommendation: update status/deployment docs in a separate
   docs-truth patch after the merge outcome is known. Target part: release documentation.

7. Severity: P0. Deploy remains NOT RUN and must not be inferred from PR CI.
   Evidence: `docs/DEPLOYMENT.md:491-499` defines phased rollout and requires approval; `docs/DEPLOYMENT.md:543-554`
   keeps production DB migration/seed, production deployment, nginx/TLS cutover, production auth/proxy proof, and real bot
   adapter production proof NOT RUN; Phase 4.60 handoff lines `127-131` keep production DB deploy, canary switch,
   Tortila production secret/probes, canonical source, Legacy source, and live controls NOT RUN. Recommendation: open a
   separate approved deploy/canary phase after merge and `main` CI; do not run deploy commands from this audit. Target part:
   production deploy.

8. Severity: P0. Bot production blockers still stand after merge.
   Evidence: `docs/NEXT_ACTIONS.md:76-78` keeps Tortila production auth/firewall/deploy NOT RUN, Legacy closed-trade
   realized analytics blocked by source proof, and live control/test-connection/start-stop/apply-config intentionally
   disabled; `docs/DEPLOYMENT.md:520-522` requires explicit `TORTILA_JOURNAL_URL` and `JOURNAL_READ_TOKEN` for
   production-like non-mock adapter mode. Recommendation: keep bot production-readiness as a separate source/auth/firewall
   and security-audit phase. Target part: bot integration safety.

## Decisions
1. PR #1 may be merged only as a repository release after a fresh check requery. The safe merge command must pin the current
   head commit with `--match-head-commit`.
2. `main` CI success after merge is required before any deploy/canary step.
3. This audit does not authorize SSH, server mutation, production DB migration/seed, canary replacement, worker replacement,
   nginx/TLS changes, or bot/provider probes.
4. Because `main` is unprotected, merge safety is currently process-enforced, not GitHub-enforced.
5. Production completion remains false until deploy/canary, production secrets/firewall, canonical Tortila source, Legacy
   source proof, live-control audit, and monitoring/burn-in gates are run and green.

## Risks
1. Branch protection is absent, so a stale or failing PR could be merged manually unless the operator follows the final
   recheck commands.
2. PR #1 is broad: `gh pr view 1` observed `569` changed files, `94106` additions, and `1056` deletions. The checks are
   green, but the review blast radius is large.
3. The latest GitHub mergeability field returned `UNKNOWN`; this can be a temporary GitHub recalculation state, but it is
   still a reason to requery immediately before merge.
4. Documentation still contains pre-PR-CI statements that classify GitHub Actions as NOT RUN; if not updated after merge,
   the project status will look internally contradictory.
5. Main CI does not explicitly run the worker workspace typecheck step even though local `ci:local` does.
6. A merge can make the repository code current on `main`; it does not make the live WTC canary/current production server
   current.

## Verification/tests
RUN in this read-only audit:
1. `git status --short --branch` - observed branch
   `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with no working-tree
   changes before this handoff file.
2. `git remote -v` - observed `origin` as `https://github.com/papa-slon/wtc.git`.
3. `git log --oneline --decorate -5` - observed HEAD `d935642 Complete bot settings and readiness gates`.
4. `gh pr view 1 --json number,title,state,isDraft,mergeStateStatus,reviewDecision,headRefName,baseRefName,commits,statusCheckRollup,url` -
   observed PR #1 open, non-draft, base `main`, head branch current, and both CI check runs SUCCESS.
5. `gh pr checks 1` - observed `gates pass` and `e2e pass`.
6. `gh api repos/papa-slon/wtc/branches/main/protection` - observed `Branch not protected`.
7. `gh api repos/papa-slon/wtc/rulesets` - observed no repository rulesets.
8. `gh api repos/papa-slon/wtc/branches/main --jq .commit.sha` - observed current `main` SHA
   `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`.
9. Read `.github/workflows/ci.yml`, `package.json`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and the
   deploy/canary handoffs listed above.

NOT RUN in this audit:
1. No local test suite, build, lint, secret scan, or governance command was rerun. This audit relied on already-green PR CI
   and Phase 4.60 recorded local gates.
2. No SSH, production server command, systemd/tmux/process control, production DB command, nginx command, deploy command,
   live bot command, provider probe, exchange probe, journal probe, `/api/marks`, or `/api/overview`.
3. No branch protection/ruleset mutation.
4. No merge was performed by this auditor.

## Next actions
Safe verification commands to run immediately before merge:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
gh pr view 1 --json number,state,isDraft,headRefName,baseRefName,mergeStateStatus,statusCheckRollup,url
gh pr checks 1 --watch
gh api repos/papa-slon/wtc/rulesets
gh api repos/papa-slon/wtc/branches/main/protection
```

If the PR is still open, non-draft, head is still `d9356422e3de7c267862af6e3e81d3ff766624f3`, and both checks are green,
the next safe merge command is:

```powershell
gh pr merge 1 --squash --match-head-commit d9356422e3de7c267862af6e3e81d3ff766624f3 --delete-branch=false
```

Safe post-merge CI watch commands:

```powershell
$runId = gh run list --workflow CI --branch main --event push --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch $runId --exit-status
gh run view $runId --json status,conclusion,headSha,url,displayTitle
```

Safe local post-merge verification commands, after `main` CI is green and before any deploy phase:

```powershell
git fetch origin main
git switch main
git pull --ff-only origin main
npm ci
npm run ci:local
npm run accept:bots:local
```

Deploy/canary remains NOT RUN from this audit. Do not run SSH/deploy/server commands until a separate explicitly approved
deploy phase names the target host, release branch/SHA, rollback target, server process boundaries, and post-deploy browser
and runtime smoke gates.
