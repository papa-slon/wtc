# ecosystem-devops-implementer handoff
## Scope
Read-only devops audit for operator evidence/log-root confinement. Covered env-controlled preflight log roots, repo log conventions, ignore rules, deployment/acceptance docs, and evidence paths that could escape repo-local `logs/` or print absolute paths.

## Files inspected
`.env.example`, `.gitignore`, `.secretlintignore`, `package.json`, `scripts/preflight-log-root.mjs`, `scripts/*-preflight.mjs`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, related `tests/integration/*preflight.test.ts`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and Phase 3.52 handoffs.

## Files changed
None - read-only audit.

## Findings
1. Info. The intended operator policy is safe repo-local log roots: helper-backed `logs/...`, normalized relative output. Recommendation: keep helper as the only accepted write path for preflight evidence. Target part: preflight artifact paths.
2. High. Several preflight tests still used OS temp absolute roots, conflicting with the intended helper behavior. Recommendation: switch success tests to repo-local `logs/test-*` roots. Target part: preflight tests.
3. Medium. Artifact scanner remained root-flexible and could inspect/display off-repo evidence paths. Recommendation: restrict or redact scanner root/display handling. Target part: artifact scanner CLI/env boundary.
4. Low. Deployment docs listed safe default roots but did not state override policy. Recommendation: document relative `logs/...` only; absolute, URL, UNC, traversal, and non-`logs/` roots refused. Target part: docs and env template.
5. Low. Ignored preview/runtime logs are not acceptance evidence. Recommendation: prefer redacted summaries under repo-local `logs/<phase-or-command>/`. Target part: logs directory convention.

## Decisions
Use `logs/*` as the only repo-local retained evidence root for operator preflight summaries. `logs/gates` remains acceptable and unchanged because it is fixed and not env-controlled.

## Risks
Scanner misuse can still recurse large repo-local trees; size/count caps remain a separate hardening option if needed.

## Verification/tests
No tests run by this auditor. Read-only inspection only.

## Next actions
1. Update stale preflight tests to repo-local success roots.
2. Add direct negative helper coverage.
3. Document the `logs/...` override rule.
4. Harden scanner root/display behavior.
