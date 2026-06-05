# ecosystem-tests-runner handoff
## Scope
Read-only audit to verify final GitHub CI truth for PR #4 and merge commit
`787443d8ca040cf94d001f79d1a28bbdc0d84bd3` after the Node 24 Actions migration.

## Files inspected
- `AGENTS.md`
- `.github/workflows/ci.yml`
- Git metadata for `787443d`, `main`, and `origin/main`
- GitHub PR #4
- GitHub Actions runs `27022463493` and `27023047118`

## Files changed
None -- read-only audit.

## Findings
1. Severity PASS - PR #4 is merged. Evidence: PR #4 state `MERGED`, merged at `2026-06-05T15:10:14Z`; head
   `ee9fd51ac6d035e6500869f0775359577fe5fce3`; merge commit
   `787443d8ca040cf94d001f79d1a28bbdc0d84bd3`; local `main` and `origin/main` pointed at `787443d`.
   Recommendation: treat `787443d` as the canonical post-merge CI target. Target part: PR/merge truth.
2. Severity PASS - Merge commit GitHub Actions CI is green. Evidence: run `27023047118`, event `push`, branch `main`,
   head SHA `787443d8ca040cf94d001f79d1a28bbdc0d84bd3`, status `completed`, conclusion `success`, updated at
   `2026-06-05T15:20:11Z`; `gates` job `79755794682` succeeded in about `5m33s`, and `e2e` job `79755794599`
   succeeded in about `9m50s`. Recommendation: record merge-commit CI as green. Target part: final main CI gate.
3. Severity PASS - PR pre-merge checks were green. Evidence: PR run `27022463493`, event `pull_request`, branch
   `codex/phase-463-node24-actions`, head SHA `ee9fd51ac6d035e6500869f0775359577fe5fce3`, conclusion `success`;
   `gates` job `79753729517` succeeded in about `4m10s`, and `e2e` job `79753729613` succeeded in about `9m39s`.
   Recommendation: keep this as PR evidence, while using run `27023047118` for merge-commit truth. Target part:
   PR check rollup.
4. Severity PASS - Node 24 Actions migration is visible and executed. Evidence: `.github/workflows/ci.yml` uses
   `actions/checkout@v6`, `actions/setup-node@v6`, project `node-version: 24`, and `actions/upload-artifact@v7`;
   merge-run logs resolved Node `v24.16.0` and npm `11.13.0`. Recommendation: no CI migration fix needed. Target part:
   Actions runtime.
5. Severity INFO - Legacy commit-status API has no status contexts. Evidence: commits `787443d` and `ee9fd51` returned
   empty legacy statuses while Checks/Actions had two successful check-runs. Recommendation: use Checks API or Actions
   runs as the source of truth; review branch protection only if it expects legacy statuses. Target part: GitHub status
   reporting.

## Decisions
1. Used local `git`, `gh pr view`, `gh run view`, and GitHub REST/Checks metadata.
2. Did not run local test suites because the scope was final GitHub CI truth, not local revalidation.
3. Did not download artifacts or inspect live servers.

## Risks
1. Tools that read only the legacy commit-status endpoint may incorrectly see `pending` despite green Actions checks.
2. Action tag versions are confirmed for this run via logs, but tags can move in future runs.

## Verification/tests
RUN:
1. PR #4 metadata check - green and merged.
2. PR #4 pre-merge Actions check-run audit - green.
3. Merge commit `787443d` Actions check-run audit - green.
4. Workflow/runtime inspection - Node 24 and action versions confirmed.
5. Read-only safety - no file edits by this audit; no secrets printed.

NOT RUN:
1. Local `npm run ci:local`, lint, typecheck, test, coverage, e2e - skipped because scope was GitHub CI truth.
2. Live deploy/browser smoke - skipped, out of scope.
3. Artifact download/visual review - skipped, out of scope.

## Next actions
1. Record Phase 4.64 as CI-green for merge commit `787443d`.
2. If automation depends on legacy commit statuses, update it to consume GitHub Checks/Actions instead.
