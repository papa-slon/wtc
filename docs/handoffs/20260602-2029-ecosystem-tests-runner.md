# ecosystem-tests-runner handoff
## Scope
Phase 3.64 read-only GitHub/CI and release audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Requested focus:
- Inspect local git, workflow, package, and release state.
- Inspect public GitHub remote state for `https://github.com/papa-slon/wtc`.
- Do not push, commit, deploy, or mutate live systems.
- Write only this handoff.

Process note: this tests-runner lane did not launch or claim background agents. The available toolset in this lane did not provide a subagent launcher. Separate untracked per-agent handoffs appeared during the audit; only `docs/handoffs/20260602-2029-ecosystem-security-auditor.md` was read as current workspace evidence by this lane, and this file makes no N-agent claim.

Important timing note: local and remote git state changed while this audit was running. The final observed state is authoritative for this handoff: local `main` and `origin/main` both point at `0b5d23314f52f9c92dca8dd43dd34c2e09346e2c`, and GitHub Actions run `26823528265` completed successfully.

## Files inspected
Local protocol and status:
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md` (untracked, created outside this lane)
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/RISK_REGISTER_MASTER.md`

Local CI/package/config:
- `.github/workflows/ci.yml`
- `.gitignore`
- `.secretlintignore`
- `.secretlintrc.json`
- `package.json`
- `package-lock.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `playwright.config.ts`
- `playwright.auth.config.ts`
- `playwright.auth-db.config.ts`
- `playwright.lms-db.config.ts`
- `packages/config/src/env.ts`
- `packages/backtester/src/derive.ts`
- `packages/backtester/runners/wtc-backtester-0.1.0.zip`
- `scripts/check-retained-visual-artifacts.mjs`
- `logs/gates/summary.txt`

Read-only commands/API checks:
- `git status --short --branch -uall`
- `git log --oneline --decorate --stat --max-count=3`
- `git branch -vv`
- `git remote -v`
- `git remote show origin`
- `git ls-remote origin`
- `git ls-tree -r --name-only HEAD`
- `git ls-tree -r -l HEAD`
- GitHub page/API checks for `papa-slon/wtc`
- `gh repo view papa-slon/wtc`
- `gh workflow list --repo papa-slon/wtc --all`
- `gh run list --repo papa-slon/wtc`
- `gh run view 26823528265 --repo papa-slon/wtc --json ...`
- `gh run view 26823528265 --repo papa-slon/wtc --log` with secret values not copied into this handoff
- `gh api repos/papa-slon/wtc/actions/runs/26823528265/artifacts`

## Files changed
Only this required handoff:
- `docs/handoffs/20260602-2029-ecosystem-tests-runner.md`

No code, config, package, workflow, git commit, push, deploy, live server, provider, bot, or database mutation was performed by this lane.

## Findings
1. Severity: CRITICAL. The first public GitHub Actions run succeeded but printed generated CI-only secret material into the Actions logs. Evidence: `.github/workflows/ci.yml:68-82` generates `SESSION_SECRET`, `SECRET_VAULT_KEK`, Stripe test values, `AXIOMA_HANDOFF_SIGNING_KEY`, and `CSRF_SECRET` into `$GITHUB_ENV` without masking; run `26823528265` logs later displayed those environment values, including an EC private key block, in step env output. This violates `AGENTS.md:77`, `AGENTS.md:88`, `docs/SESSION_PROTOCOL.md:83-85`, and `docs/SECRET_VAULT_DESIGN.md:24-26`. Recommendation: do not call this release path clean until the run logs are deleted or otherwise access-controlled, the workflow is changed to mask generated values with `::add-mask::` before they enter `$GITHUB_ENV` or to avoid global secret env values, and a replacement CI run passes without secret-shaped log output. Target part: GitHub Actions workflow/log hygiene.

2. Severity: HIGH. The initial pushed commit includes 69 generated screenshot PNGs under `tests/e2e/screenshots/`. Evidence: `git ls-tree -r --name-only HEAD` counted 69 `tests/e2e/screenshots/*.png` files; the largest tracked files are screenshot PNGs, e.g. `tests/e2e/screenshots/billing-desktop.png` at 1,647,280 bytes; `.gitignore:31-33` ignores only `tests/e2e/screenshots/*.tmp.png` and root `visual-*.png`, not generated screenshot PNGs. Repo policy says screenshot/image safety is separate from text secret scanning: `docs/ACCEPTANCE_MATRIX_MASTER.md:28`, `docs/ACCEPTANCE_MATRIX_MASTER.md:40`, `docs/DEPLOYMENT.md:294-317`, and `docs/RISK_REGISTER_MASTER.md:23`. Recommendation: remove generated screenshot PNGs from the tracked tree unless every retained image has an explicit reviewed visual manifest; keep only `tests/e2e/screenshots/.gitkeep` by default. Target part: release artifact hygiene.

3. Severity: HIGH. CI is green but does not enforce screenshot review when no manifest exists. Evidence: `.github/workflows/ci.yml:136-151` inventories `tests/e2e/screenshots` and validates manifests only when `logs/retained-visual-artifacts/**/visual-review*.json` exists; `.github/workflows/ci.yml:145-148` exits 0 when no manifest is present. The green run logged `69 image file(s)` and then `No reviewed visual evidence manifest present; skipping visual evidence upload.` Recommendation: make committed/retained screenshot policy fail closed, or remove generated screenshots from the repository and keep visual review as an explicit evidence-package gate only. Target part: e2e visual evidence gate.

4. Severity: HIGH. The public remote is no longer empty and the initial push has already happened outside this lane. Evidence: `git status --short --branch -uall` reports `## main...origin/main`; `git log --oneline --decorate --max-count=1` reports `0b5d233 (HEAD -> main, origin/main) Initial WTC ecosystem platform`; `git ls-remote --heads origin main` returns `0b5d23314f52f9c92dca8dd43dd34c2e09346e2c`; GitHub API reports branch `main` at the same SHA. Recommendation: treat cleanup as a follow-up public-history decision, not a pre-push amendment, unless the operator explicitly approves history rewrite. Target part: initial release process.

5. Severity: MEDIUM. GitHub Actions can run and did pass on the first pushed commit, but the result is not sufficient for production readiness because of findings 1-3 and remaining live gates. Evidence: run `26823528265` completed with conclusion `success`; `gates` and `e2e` jobs both completed successfully; `.github/workflows/ci.yml:5-9` triggers on push/PR to `main`; `.github/workflows/ci.yml:47-112` runs install, smoke, governance, lint, typecheck, secret scan, generated env, production-like env validation, DB migrate/seed, real-PG test DB creation, test, coverage, and build; `.github/workflows/ci.yml:125-160` runs Playwright and visual inventory/upload logic. Recommendation: report CI as RUN/PASS, but keep release acceptance blocked until log leakage and screenshot policy are fixed and production gates are run. Target part: CI/release reporting.

6. Severity: MEDIUM. Several repo docs are now stale because they still say the folder is not git-backed or GitHub CI is not run. Evidence: `docs/STATUS.md:20-22` says GitHub CI is still not run and the folder is not git-backed; `docs/DEPLOYMENT.md:442-456` says CI is staged but not run because there is no `.git` directory and no GitHub remote; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:95` says GitHub CI is NOT RUN because the current folder is not git-backed. Recommendation: update status/blocker/deployment docs after the workflow/log cleanup decision so source-of-truth docs reflect `origin/main`, run `26823528265`, and the remaining blockers. Target part: documentation truth.

7. Severity: MEDIUM. Production/deploy gates remain blocked even after green CI. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:35-37` says local acceptance does not replace intended audit-role proof, live provider preflights, server preview smoke, SSH/nginx/systemd checks, production deploy, GitHub CI, or monitoring; `docs/PRODUCTION_BLOCKERS_CURRENT.md:57-69` lists Stripe, legacy bot, Axioma, TradingView, LMS live object-store/scanner, and worker deployment blockers; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:87-96` keeps intended audit role, live LMS object store/scanner, Stripe, Axioma, live/server preview, and deploy/server checks as NOT RUN. Recommendation: do not deploy or tag production-ready from this commit; run each live/credentialed gate in a separate approved phase. Target part: production readiness.

8. Severity: MEDIUM. Current local working tree has unrelated uncommitted changes outside this lane. Evidence: final `git status --short --branch -uall` reports modifications to `.env.example`, `packages/config/src/env.test.ts`, and `packages/config/src/env.ts`, plus untracked `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md`, `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`, and `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`; the observed `packages/config/src/env.ts` diff changes Axioma env gating and was not created by this lane. Recommendation: preserve those changes for their owner; do not overwrite, stage, or commit them as part of the tests-runner handoff unless explicitly instructed. Target part: local workspace hygiene.

9. Severity: LOW. The backtester ZIP appears intentional and should not be treated like a generated test artifact. Evidence: `packages/backtester/src/derive.ts:19-35` points the runner release to `packages/backtester/runners/wtc-backtester-0.1.0.zip`; `docs/BACKTESTER_DISTRIBUTION_PLAN.md:4`, `docs/BACKTESTER_DISTRIBUTION_PLAN.md:646`, and `docs/BACKTESTER_DISTRIBUTION_PLAN.md:731` document the checked runner ZIP as the current download-only MVP; `tests/integration/backtester-pg10.test.ts:37` covers the download route boundary. Recommendation: keep the ZIP only if the release owner accepts checked binary runner artifacts; otherwise replace it with a reproducible build/download pipeline in a future backtester phase. Target part: release asset policy.

## Decisions
- Treated GitHub remote and Actions inspection as read-only.
- Did not push, commit, deploy, start/stop services, call providers, or mutate live systems from this lane.
- Did not run local `npm` gates because the user requested a read-only audit and no file mutation; GitHub Actions provided the first real CI result after the external push.
- Treated `gh run view --log` output as sensitive because it exposed generated CI-only secrets. This handoff deliberately does not reproduce the values.
- Treated CI as RUN/PASS but not release-acceptable until CI log leakage and screenshot artifact policy are fixed.
- Did not make a multi-agent claim. No background agents were launched or closed by this lane.
- Preserved unrelated local modifications and the untracked security-auditor handoff.

## Risks
- The public Actions log for run `26823528265` contains generated secret-like values and a generated private key. They are CI-only, but public plaintext secret-shaped logs violate repo policy and should be cleaned up.
- The public git history now contains 69 screenshot PNGs. If any screenshot contains sensitive data, a cleanup commit is insufficient; an operator-approved history rewrite plus any relevant credential rotation/revocation is required.
- Secret scanning passed in CI for text/source, but it does not prove screenshot pixel safety.
- CI green does not prove live provider acceptance, intended production/preview DB-role proof, production deploy, monitoring, or live bot safety.
- Docs now under-report GitHub readiness because the repo became git-backed and CI ran during this audit.
- Concurrent local changes may affect the next commit; the current working tree is not clean after this handoff.

## Verification/tests
Gates RUN/observed in this tests-runner lane:
- Local git status: `## main...origin/main` observed after the external push.
- Local HEAD: `0b5d23314f52f9c92dca8dd43dd34c2e09346e2c` with message `Initial WTC ecosystem platform`.
- Remote branch: `git ls-remote --heads origin main` returned the same SHA.
- Public repo state: `papa-slon/wtc` is public, default branch `main`, branch `main` exists and is unprotected.
- Workflow state: GitHub workflow `CI` is active.
- GitHub Actions run `26823528265`: RUN/PASS, conclusion `success`, created `2026-06-02T13:39:04Z`, updated `2026-06-02T13:43:38Z`.
- GitHub Actions `gates` job: PASS. Observed successful steps include install, check core, governance, lint, root typecheck, web typecheck, secret scan, generated CI env, production-like env validation, DB migrations, DB seed, `wtc_test` creation, test, coverage, and web build.
- GitHub Actions `e2e` job: PASS. Observed successful steps include install, Playwright browser install, e2e tests, visual inventory, manifest validation step, and artifact upload step.
- CI test summary from logs: `105` test files passed; `943` tests passed and `1` skipped in the `Test` step.
- Real-Postgres CI harness: `tests/integration/db-real-postgres.test.ts` ran in CI against `wtc_test` and passed `14` tests.
- Visual inventory in CI: `69 image file(s)`, `0 blocked binary/container artifact(s)`, `70 total artifact file(s)`.
- Reviewed visual evidence upload: no artifacts uploaded; GitHub API returned `total_count: 0`.
- Existing local retained gate summary inspected only as historical local evidence: `logs/gates/summary.txt` says 9 local gates previously passed, but those were not rerun in this lane.

Gates NOT RUN by this tests-runner lane:
- Local `npm run ci:local`, `npm test`, `npm run coverage`, `npm run build -w @wtc/web`, `npm run e2e`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run check:core`, and `npm run governance:check` were not run locally.
- Local secret scan was not run by this lane; CI secret scan passed in GitHub Actions.
- Local visual manifest acceptance was not run; CI only inventoried screenshots and skipped because no manifest existed.
- Deploy/server checks, SSH/nginx/systemd mutations, live provider calls, live bot controls, production DB migrations/seeding, intended append-only audit role proof, live LMS object-store/scanner preflights, real Stripe checkout/webhook acceptance, and live Axioma acceptance were not run by this lane.
- No branch protection, release tag, deployment, rollback, or monitoring setup was performed.

## Next actions
1. Treat run `26823528265` as green CI but not clean release evidence. Decide whether to delete the public Actions run/logs because generated CI-only secrets were printed. Candidate command, only with operator approval: `gh run delete 26823528265 --repo papa-slon/wtc`.
2. Fix `.github/workflows/ci.yml` before the next run: add `::add-mask::` for every generated value before writing it to `$GITHUB_ENV`, or keep generated secret material step-local so later steps cannot echo it in env blocks. Rerun CI and inspect logs for zero secret-shaped output.
3. Remove generated screenshots from the tracked repository unless a full visual review manifest is intentionally committed. Preferred non-history-rewrite cleanup after the public push:
   - Add `.gitignore` rules: `tests/e2e/screenshots/*.png` and `!tests/e2e/screenshots/.gitkeep`.
   - Run `git rm --cached tests/e2e/screenshots/*.png`.
   - Commit and push the cleanup.
   - If any screenshot is sensitive, escalate to history rewrite and rotation rather than a normal cleanup commit.
4. Update docs after the cleanup decision: `docs/STATUS.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/NEXT_ACTIONS.md`, and a new aggregate Phase 3.64 handoff should record `origin/main`, run `26823528265`, CI PASS, CI log-leak blocker, screenshot artifact blocker, and remaining live gates.
5. Do not deploy or tag production-ready until the still-NOT-RUN production gates are run in approved scoped phases: intended append-only audit role, live LMS object-store/scanner, real Stripe checkout/webhook, live Axioma endpoint/account-link/download acceptance, server deploy/nginx/systemd/TLS/monitoring, and live bot safety.
6. Review the unrelated local changes now present (`.env.example`, `packages/config/src/env.test.ts`, `packages/config/src/env.ts`, and the other `20260602-2029-*` per-agent handoffs) before the next commit so they are either deliberately included or kept separate.
