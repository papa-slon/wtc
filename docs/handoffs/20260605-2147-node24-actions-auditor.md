# ecosystem-devops-implementer handoff
## Scope
Read-only audit of the active GitHub Actions workflow after Node.js 20 action-runtime deprecation warnings appeared on
green `main` CI. The audit checked whether the warning came from the project Node version or the JavaScript action runtime,
and identified the minimum repo-local migration.

## Files inspected
- `.github/workflows/ci.yml`
- `package.json`
- `scripts/gates.mjs`
- `docs/DEPLOYMENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `tests/integration/retained-visual-artifacts.test.ts`

## Files changed
None -- read-only audit.

## Findings
1. Severity P1 - The exact warning risk is the GitHub Actions JavaScript runtime, not WTC's project Node runtime. Evidence:
   GitHub's changelog says Node 20 reached EOL in April 2026, runners begin using Node 24 by default on June 16, 2026, and
   Node 20 can be removed later in fall 2026. Recommendation: migrate active workflow actions to Node 24-runtime majors.
   Target part: `.github/workflows/ci.yml`.
2. Severity P1 - The affected active actions were `actions/checkout@v4`, `actions/setup-node@v4`, and
   `actions/upload-artifact@v4`. Evidence: the previous green `main` CI annotations named those actions, and the workflow
   used those versions before this phase. Recommendation: update official action versions, then prove PR and post-merge CI.
   Target part: CI gates/e2e workflow.
3. Severity P2 - `node-version: 24` controls the project process used by `npm ci`, tests, and builds, but does not upgrade
   the runtime embedded in GitHub's JavaScript actions. Recommendation: keep project `node-version: 24`, and update action
   majors separately. Target part: CI setup.
4. Severity P2 - The minimum safe repo-local migration is `checkout@v4 -> checkout@v6`, `setup-node@v4 -> setup-node@v6`,
   and `upload-artifact@v4 -> upload-artifact@v7`. Evidence: current official action READMEs show these majors; checkout
   and setup-node document Node 24-runtime support in v5+ and current examples use v6; upload-artifact current examples
   use v7. Recommendation: prefer version migration over a temporary `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env-only probe.
   Target part: CI action pinning.

## Decisions
1. Keep historical handoffs that mention `actions/*@v4` unchanged, because they are past evidence, not active runtime
   configuration.
2. Do not add `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION`; it is an emergency opt-out back to deprecated Node 20, not a
   forward migration.
3. No repo-owned `.github/actions/*/action.yml` custom action exists, so there is no local `runs.using: node20` action to
   migrate.

## Risks
1. `actions/upload-artifact@v7` can differ from `v4`, but the current workflow uploads one named manifest artifact with one
   path and `if-no-files-found: ignore`, which remains supported by current docs.
2. This migration is not production deploy proof; it only hardens GitHub Actions execution for repository gates.
3. The exact changed workflow still requires PR CI and post-merge `main` CI before it can be reported as green.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/phase-463-node24-actions` with modified
   `.github/workflows/ci.yml`.
2. Read `.github/workflows/ci.yml` and confirmed project `node-version: 24` plus the action runtime version changes.
3. `git diff -- .github/workflows/ci.yml` - confirmed only the official action version pins changed.
4. `rg` searches found no active repo-owned `runs.using`, `node20`, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, or
   `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` references requiring migration.

NOT RUN:
1. `npm run ci:local` - read-only audit did not mutate or execute full gates.
2. GitHub Actions PR/main CI - implementation phase must run these after commit/push.

## Next actions
1. Preserve the active workflow migration.
2. Run local governance/secret/diff/lint/typecheck or `ci:local` as practical.
3. Push through PR, verify `gates` and `e2e`, merge, and verify post-merge `main` CI.
