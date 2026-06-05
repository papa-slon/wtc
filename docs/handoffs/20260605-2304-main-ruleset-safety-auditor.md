# ecosystem-security-auditor handoff
## Scope
Read-only safety audit for adding a GitHub repository ruleset to protect `main`. The audit checked official GitHub
ruleset/protection schemas, current repository state, safe payload shape, rollback, and false-positive CI risks.

## Files inspected
- `AGENTS.md`
- `.github/workflows/ci.yml`
- `package.json`
- `docs/handoffs/20260605-2005-release-merge-deploy-auditor.md`
- `docs/handoffs/20260605-2221-phase-464-node24-ci-truth.md`
- GitHub API: rulesets, branch rules, branch protection, latest check-runs, check-suites, legacy status
- Official GitHub REST docs for repository rulesets and branch protection

## Files changed
None -- read-only audit.

## Findings
1. Severity P1 - `main` had no protection before implementation. Evidence: no active rules, no classic protection, and
   `gh ruleset check main` reported zero rules. Recommendation: add one repository branch ruleset. Target part: GitHub
   `main` policy.
2. Severity P1 - Required checks should be `gates` and `e2e`, pinned to GitHub Actions integration `15368`. Evidence:
   latest green `main` Actions run exposed those names under GitHub Actions app `15368`. Recommendation: use
   `integration_id=15368`. Target part: required status checks.
3. Severity P1 - Do not require Cursor. Evidence: Cursor suite was queued with no check-runs. Recommendation: do not use an
   all-checks policy. Target part: false blocker avoidance.
4. Severity P2 - Rulesets are preferred over classic branch protection for this phase. Evidence: official GitHub docs
   support active repository rulesets with ref-name conditions and explicit rule lists. Recommendation: use rulesets first;
   classic protection only as fallback. Target part: implementation route.

## Decisions
1. Recommended payload: repository ruleset `WTC main required CI`, `target=branch`, `enforcement=active`, include
   `refs/heads/main`, no bypass actors, strict required status checks `gates` and `e2e` with `integration_id=15368`, plus
   `non_fast_forward` and `deletion`.
2. Do not add `required_linear_history`, because the repo uses merge commits.
3. Rollback is deleting ruleset `WTC main required CI`.

## Risks
1. Strict required checks can require PR branches to be updated after `main` changes.
2. Future job-name collisions with `gates` or `e2e` could make required checks ambiguous.
3. Admins can still edit or delete repository settings; record ruleset ID and history.

## Verification/tests
RUN:
1. Read-only local/git/GitHub state checks.
2. Official GitHub ruleset/protection docs reviewed.
3. Latest Actions check-runs and Cursor suite risk inspected.

NOT RUN:
1. No GitHub settings mutation in this audit.
2. No branch protection fallback.
3. No PR enforcement trial.
4. No local lint/typecheck/test/e2e.
5. No production/server/bot/provider commands.

## Next actions
1. Apply the repository ruleset.
2. Verify ruleset list, applicable rules for `main`, `main protected=true`, and Checks API.
3. On the next PR, verify merge UI requires only `gates` and `e2e`.
