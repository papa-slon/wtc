# ecosystem-tests-runner handoff
## Scope
Read-only audit of GitHub `main` branch protection, repository rulesets, required CI contexts, and the correct CI truth
source after legacy commit-status APIs showed `pending` while GitHub Actions Checks were green.

## Files inspected
- `.github/workflows/ci.yml`
- GitHub API: repository rulesets, `branches/main`, `branches/main/protection`, `rules/branches/main`, commit legacy
  statuses, commit check-runs, commit check-suites, and Actions run list

## Files changed
None -- read-only audit.

## Findings
1. Severity P1 - `main` was not protected before implementation. Evidence: `branches/main` returned `protected=false`,
   `branches/main/protection` returned `404 Branch not protected`, and repository rulesets were empty. Recommendation:
   protect `main` before treating CI as an enforced release gate. Target part: GitHub repository settings.
2. Severity P1 - No required checks were configured for `main`. Evidence: both classic protection and rulesets were absent.
   Recommendation: require GitHub Actions checks `gates` and `e2e`, pinned to app/source `github-actions`. Target part:
   required checks.
3. Severity P2 - Legacy commit statuses are not a valid CI verdict for this repo. Evidence: legacy statuses were empty and
   combined status was `pending`, while Checks API showed successful `gates` and `e2e`. Recommendation: use Checks/Actions.
   Target part: CI status readers.
4. Severity P2 - A queued non-Actions Cursor suite exists and should not be required. Evidence: check-suites included
   Cursor with no check-runs while GitHub Actions was green. Recommendation: require only expected Actions jobs. Target
   part: ruleset required checks.

## Decisions
1. Use GitHub Actions Checks as CI source of truth.
2. Use required check names `gates` and `e2e`.
3. Do not require queued Cursor suites or legacy status contexts.

## Risks
1. Without a ruleset, `main` can be changed without enforced CI.
2. Tools that read only legacy status APIs can report false `pending`.
3. Requiring all suites would create false blockers from non-Actions integrations.

## Verification/tests
RUN:
1. Read-only GitHub API inspection for rulesets, branch protection, applicable branch rules, legacy statuses, check-runs,
   check-suites, and Actions runs.
2. Local workflow inspection confirmed jobs `gates` and `e2e`.

NOT RUN:
1. No GitHub settings mutation in this audit.
2. No local lint/typecheck/test/build.
3. No live server, provider, exchange, or bot-control commands.

## Next actions
1. Add a repository ruleset for `refs/heads/main`.
2. Require `gates` and `e2e` from GitHub Actions.
3. Verify applicable rules after mutation.
