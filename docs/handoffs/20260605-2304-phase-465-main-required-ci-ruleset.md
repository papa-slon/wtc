# Phase 4.65 main required CI ruleset handoff
## Scope
This phase closes the repo-level CI enforcement gap after the Node 24 Actions migration and CI-truth proof. It adds an
active GitHub repository ruleset for `main` and records the verification. It does not change application code, production
servers, production databases, provider connections, exchange keys, or bot controls.

Read-only auditors launched before the GitHub settings mutation:
- [docs/handoffs/20260605-2304-main-ruleset-auditor.md](20260605-2304-main-ruleset-auditor.md)
- [docs/handoffs/20260605-2304-main-ruleset-safety-auditor.md](20260605-2304-main-ruleset-safety-auditor.md)

Official references checked:
- https://docs.github.com/en/rest/repos/rules
- https://docs.github.com/en/rest/branches/branch-protection

## Files inspected
- `.github/workflows/ci.yml`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- GitHub repository rulesets, branch rules, branch protection, commit check-runs, commit legacy statuses

## Files changed
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-2304-main-ruleset-auditor.md`
- `docs/handoffs/20260605-2304-main-ruleset-safety-auditor.md`
- `docs/handoffs/20260605-2304-phase-465-main-required-ci-ruleset.md`

## Findings
1. Severity P1 - `main` was not protected before this phase. Evidence: `branches/main` returned `protected=false`;
   `branches/main/protection` returned `404 Branch not protected`; repository rulesets were empty. Recommendation:
   protect `main` with required CI. Target part: GitHub repository settings.
2. Severity P1 - The correct required checks are GitHub Actions `gates` and `e2e`, not all check suites and not legacy
   commit statuses. Evidence: latest `main` check-runs showed `gates` and `e2e` success from app `github-actions`, while
   legacy status contexts were empty and a Cursor suite was queued with no runs. Recommendation: require only `gates` and
   `e2e` pinned to integration `15368`. Target part: CI enforcement.
3. Severity P1 - Ruleset `17324564` is now active and applicable to `main`. Evidence: create response and follow-up API
   reads show `WTC main required CI`, `enforcement=active`, `include=["refs/heads/main"]`, no bypass actors, strict
   required status checks `gates` and `e2e` with `integration_id=15368`, plus `non_fast_forward` and `deletion`.
   Recommendation: keep this as the repo-level release gate. Target part: branch policy.
4. Severity P2 - Green CI is still commit-level repo proof only. Recommendation: do not treat this ruleset as production
   deployment, production database, provider, firewall, monitoring, or live-control proof. Target part: release boundaries.

## Decisions
1. Created GitHub repository ruleset `WTC main required CI` with ID `17324564`.
2. Used rulesets rather than classic branch protection.
3. Kept `bypass_actors=[]`.
4. Required only GitHub Actions checks `gates` and `e2e`, pinned to integration `15368`.
5. Added `non_fast_forward` and `deletion`; did not add linear history because this repository uses merge commits.

## Risks
1. Strict required checks can require PR branches to be updated after `main` changes.
2. Future workflow job-name collisions with `gates` or `e2e` could make required checks ambiguous.
3. Admins can still edit/delete settings; rollback is deleting ruleset `17324564`.
4. A future PR should verify the merge UI requires only `gates` and `e2e`, not Cursor or legacy statuses.

## Verification/tests
RUN:
1. `gh api .../repos/papa-slon/wtc/rulesets` before mutation - observed no rulesets.
2. `gh api .../repos/papa-slon/wtc/branches/main/protection` before mutation - observed `Branch not protected`.
3. `gh api -X POST .../repos/papa-slon/wtc/rulesets` - created ruleset `17324564`.
4. `gh api .../repos/papa-slon/wtc/rulesets/17324564` - confirmed name, target, active enforcement, no bypass actors,
   `refs/heads/main`, required checks `gates`/`e2e` integration `15368`, `non_fast_forward`, and `deletion`.
5. `gh ruleset check main -R papa-slon/wtc` - confirmed exactly three applicable rules: `deletion`, `non_fast_forward`,
   and `required_status_checks`.
6. `gh api .../branches/main` - confirmed `protected=true`.
7. `gh api .../commits/fcda2d.../check-runs` - confirmed Checks API has successful `gates` and `e2e`.
8. `gh api .../commits/fcda2d.../status` - confirmed legacy statuses remain empty/`pending`, so they are not the CI truth.
9. Both ruleset auditors were closed after handoff collection.

NOT RUN:
1. Branch protection fallback - not needed because ruleset creation succeeded.
2. Ruleset rollback - not run because verification succeeded.
3. PR merge-box enforcement trial - deferred to the next release PR.
4. Production deploy, SSH, systemd/tmux/process control, production DB mutation, live provider probes, live bot
   start/stop/apply-config/test-connection, `/api/marks`, and `/api/overview`.

## Next actions
1. For the next PR, verify GitHub requires only `gates` and `e2e` before merge.
2. If ruleset rollback is ever needed, delete ruleset ID `17324564`.
3. Continue only with a new evidence-backed gate: deploy target packet, canonical Tortila source packet, Legacy
   closed-trade source packet, or a separately approved live-control/security phase.
