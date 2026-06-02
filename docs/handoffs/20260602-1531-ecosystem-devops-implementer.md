# ecosystem-devops-implementer handoff
## Scope
Phase 3.56 read-only devops audit lane for the safe-preview retained-output policy. Scope covered ops/runbook gaps for long-running `npm run preview:safe` output, local preview log locations, ignore/archive boundaries, and a local-only guard that can be implemented without live SSH, nginx, systemd, server mutation, Playwright, DB mutation, provider calls, or bot control.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `README.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`
- `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`
- `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`
- `docs/handoffs/20260602-1531-ecosystem-tests-runner.md`
- `scripts/safe-preview.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/preflight-log-root.mjs`
- `package.json`
- `.gitignore`
- `.secretlintignore`
- `.github/workflows/ci.yml`
- current local generated logs: `dev-server.log`, `logs/preview-safe.out.log`, `logs/preview-safe.err.log`

## Files changed
None — read-only audit except this handoff file: `docs/handoffs/20260602-1531-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. `safe-preview.mjs` still streams raw long-running Next output to the invoking terminal, and current local preview logs show that operators have retained that stream via redirection. Evidence: `scripts/safe-preview.mjs:20` starts Next dev, `scripts/safe-preview.mjs:22` forwards the parent environment plus forced safety flags, and `scripts/safe-preview.mjs:24` sets `stdio: 'inherit'`; `logs/preview-safe.out.log:2`-`10` and `logs/preview-safe.out.log:17`-`28` contain retained Next startup/route output; `docs/DEPLOYMENT.md:337`-`339` says `npm run preview:safe` is excluded from the child-output policy and raw stdout/stderr must not be archived. Recommendation: implement a long-running preview output policy that either pipes stdout/stderr through a tested streaming redactor or keeps raw console output strictly local and writes only a compact redacted summary. Target part: `scripts/safe-preview.mjs` and preview runbook.

2. Severity: High. Ignore rules prevent common repo/secretlint exposure, but they are not an archive-safety guard. Evidence: `.gitignore:12` ignores `dev-server.log`, `.gitignore:14` ignores `logs/preview-safe*.log`, `.secretlintignore:12` and `.secretlintignore:14` also exclude those same logs, while `package.json:17` runs `secretlint "**/*"` and `package.json:26` maps `preview:safe` to `node scripts/safe-preview.mjs` without any preview-output evidence guard. Recommendation: add a local retained-output guard that fails if archive/evidence roots contain `dev-server.log` or `logs/preview-safe*.log`; do not rely on ignore files as proof that preview logs are safe to archive. Target part: local evidence tooling and operator archive procedure.

3. Severity: Medium. Existing text artifact scanning can pass current preview logs, so scanner-clean is not the same as archive-approved for raw dev-server streams. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:101`-`112` catches raw public-IP URLs and preview URL assignments, and `scripts/scan-lms-db-e2e-artifacts.mjs:261`-`262` scans text file content; current logs still contain raw Next stream lines at `dev-server.log:9`-`12` and `logs/preview-safe.out.log:5`-`10`. Audit check `node scripts/scan-lms-db-e2e-artifacts.mjs dev-server.log logs/preview-safe.out.log logs/preview-safe.err.log` passed, which proves the current scanner is useful but not a no-archive policy for these files. Recommendation: make the preview guard path/type based first, then scan only the allowed redacted summary artifact. Target part: retained preview evidence gate.

4. Severity: Medium. The runbook tells operators not to archive raw preview output, but the allowed summary shape and location are underspecified. Evidence: `docs/DEPLOYMENT.md:328`-`335` defines redacted retained output and scanned failing logs for one-shot processes, while `docs/DEPLOYMENT.md:337`-`339` only says to retain a separate operator summary for `preview:safe`; `docs/NEXT_ACTIONS.md:23`-`24` names long-running safe-preview retained-output policy as the next local slice. Recommendation: define a summary-only artifact such as `logs/preview-safe-summary/<run-id>/summary.json` with command name, started/stopped timestamps, exit code or signal, forced safety flags, hostname/port, readiness observed as a boolean/count, and `rawStreamArchived:false`; do not include route logs, stack traces, env dumps, cookies, DB URLs, preview URLs, or raw stdout/stderr lines. Target part: `docs/DEPLOYMENT.md`, acceptance docs, and local guard output contract.

5. Severity: Medium. A local-only implementation can reuse existing repo-local log-root discipline instead of touching live infrastructure. Evidence: `scripts/preflight-log-root.mjs:8`-`22` refuses empty, URL-shaped, absolute, UNC, traversal, and non-`logs/` roots; `docs/DEPLOYMENT.md:44`-`49` requires `*_PREFLIGHT_LOG_ROOT` overrides to stay relative repo-local `logs/...` paths; `docs/DEPLOYMENT.md:528`-`539` keeps preview/prod DB rollout, production nginx, trusted proxy proof, real adapters, and live systemd/process control NOT RUN until explicit approval. Recommendation: implement Phase 3.56 as script-only local tooling plus focused tests, with no SSH/nginx/systemd checks and no preview server start required for the guard tests. Target part: preview retained-output guard and devops phase boundary.

6. Severity: Low. Current CI artifact upload policy has been tightened for visual evidence, and it does not currently upload preview logs; preserve that boundary. Evidence: `.github/workflows/ci.yml:120`-`145` inventories visual artifacts, validates reviewed visual manifests, and uploads only `logs/retained-visual-artifacts/**/visual-review*.json` with 3-day retention; `package.json:40` keeps `ci:local` to non-e2e offline gates. Recommendation: do not introduce CI upload of `dev-server.log`, `logs/preview-safe*.log`, or redacted preview summaries unless a separate reviewed artifact policy and short retention are explicitly approved. Target part: CI artifact policy.

## Decisions
- Treat `dev-server.log` and `logs/preview-safe*.log` as local-only diagnostic buffers, not acceptance evidence and not archive artifacts.
- The safe-preview retained-output guard should be archive-facing and local-only: it should deny raw preview logs in evidence roots and allow only a compact redacted summary plus separately scanned artifacts.
- Do not run `npm run preview:safe` in focused guard tests. Use no-Next child fixtures/static tests for redaction and archive refusal, preserving the current preview behavior shape: direct Next CLI, `shell:false`, `--hostname 0.0.0.0`, `--port 3000`, and forced mock/no-live flags.
- Do not add a new `@wtc/*` package for this slice. A script and focused integration tests match the existing evidence-governance pattern.

## Risks
- Raw Next dev output can include route paths, raw local/network URLs, stack traces, request headers, cookies, env-shaped values, or operator-copied secrets if an error path logs them.
- Because `.secretlintignore` excludes preview logs, a green `npm run secret:scan` does not prove those logs are clean.
- Streaming redaction has chunk-boundary risk if implemented naively; credentials split across writes can leak unless the stream layer buffers safely before forwarding.
- The workspace is not git-backed in this session, so git diff/CI/branch verification is unavailable; verification must use direct filesystem checks until git is initialized.

## Verification/tests
Gates RUN in this read-only audit:

| Gate | Command | Result |
|---|---|---|
| repo backing check | `git status --short` | NOT A GIT REPOSITORY |
| scoped source/runbook inspection | `rg` and numbered `Get-Content` over scoped files | PASS |
| current preview log inventory | `Get-ChildItem` for `dev-server.log` and `logs/preview-safe*.log` | PASS; files exist locally |
| current preview log text scan | `node scripts/scan-lms-db-e2e-artifacts.mjs dev-server.log logs/preview-safe.out.log logs/preview-safe.err.log` | PASS; audit evidence only, not archive approval |

Gates NOT RUN:
- `npm run preview:safe` - skipped because it starts a long-running local dev server and this lane is read-only audit.
- `npm run e2e` / `node scripts/gates.mjs e2e` / Playwright - skipped because they start browser/server workflows and can create retained artifacts.
- `npm run secret:scan`, `node scripts/gates.mjs full`, `npm run governance:check` - skipped because this lane did not modify product/test/config/docs beyond the handoff.
- LMS DB browser acceptance, managed real-Postgres proof, append-only audit DB-role proof, live provider preflights, live Stripe/Axioma acceptance, preview/prod rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production monitoring - skipped by scope and missing explicit operator approval/credentials.

## Next actions
1. Add a local preview retained-output guard, either as `scripts/check-safe-preview-retained-output.mjs` or a dedicated mode in the retained-artifact scanner. It should refuse archive roots that include `dev-server.log`, `logs/preview-safe*.log`, absolute/UNC/URL/traversal roots, or non-`logs/` retained-output roots.
2. Add a compact preview summary contract and tests. Allowed summary should be count/status metadata only, under a repo-local `logs/...` root, with `rawStreamArchived:false`; raw stdout/stderr lines stay out.
3. Update `scripts/safe-preview.mjs` only if implementation chooses redacted streaming. Preserve direct Next execution, forced safe env flags, host/port, `shell:false`, and exit/signal behavior.
4. Update deployment/acceptance/status docs after implementation so operators know: do not archive `dev-server.log`, `logs/preview-safe*.log`, copied terminal buffers, or screenshots of raw terminal output; archive only the redacted summary and separately reviewed/scanned artifacts.
5. Run focused local gates after implementation: `node --check` for changed scripts, focused Vitest for preview retained-output and existing child-output/preview hardening tests, `npm run secret:scan`, `node scripts/gates.mjs full`, `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates`, and `npm run governance:check`. Keep live preview, e2e, SSH/nginx/systemd, DB/provider acceptance, CI, and production monitoring NOT RUN unless separately scoped.
