# Phase 3.57 symlink-hard preflight root confinement handoff
## Scope
Close the local retained-evidence path confinement gap where repo-local-looking `logs/...` and artifact roots could still be symlinks, Windows junctions, or other reparse points. This phase hardens preflight summary roots, retained LMS text artifact scanning, retained visual artifact scanning, and fixed `logs/gates` writes without running preview, Playwright, live databases, live provider calls, SSH, nginx, systemd, deploy, GitHub CI, bot services, or production monitoring.

## Agents
- [`docs/handoffs/20260602-1557-ecosystem-security-auditor.md`](20260602-1557-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1557-ecosystem-tests-runner.md`](20260602-1557-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1557-ecosystem-devops-implementer.md`](20260602-1557-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1557-ecosystem-platform-architect.md`](20260602-1557-ecosystem-platform-architect.md)

All background agents were closed after their read-only results were collected.

## Files inspected
`AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `.env.example`, `package.json`, `.gitignore`, `.secretlintignore`, `.github/workflows/ci.yml`, `scripts/preflight-log-root.mjs`, `scripts/preflight-log-root.d.mts`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/check-retained-visual-artifacts.mjs`, `scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`, `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, `scripts/axioma-handoff-preflight.mjs`, `scripts/audit-append-only-role-preflight.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `tests/integration/preflight-log-root.test.ts`, `tests/integration/preflight-log-root-wiring.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and `tests/integration/retained-visual-artifacts.test.ts`.

## Files changed
- `scripts/workspace-path-guard.mjs`
- `scripts/workspace-path-guard.d.mts`
- `scripts/preflight-log-root.mjs`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `tests/integration/preflight-log-root.test.ts`
- `tests/integration/preflight-log-root-wiring.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `.env.example`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md`
- `docs/handoffs/20260602-1557-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1557-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1557-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1557-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md`

## Findings
1. Severity: High. The previous preflight log-root policy was lexical only. A value such as `logs/...` could pass string checks while an existing segment was a symlink, junction, or reparse point. Fix: `scripts/preflight-log-root.mjs` now calls a shared lstat/realpath guard during resolution and summary writes, and summary files are created exclusively through a verified plain workspace directory.
2. Severity: High. The retained LMS artifact scanner and retained visual artifact checker used lexical root checks plus recursive `statSync()` walks, which could follow symlinked descendants. Fix: both scanners now reject linked existing path segments before accepting roots, manifests, OCR sidecars, and walked entries, then fail closed with clean refusal messages.
3. Severity: Medium. `logs/gates` is a fixed retained-evidence directory and could also be redirected by a symlinked or junctioned `logs`/`logs/gates`. Fix: `scripts/gates.mjs` now resolves the fixed gate-log root through the same plain workspace directory guard before writing retained gate logs.
4. Severity: Medium. Scanner failure labels could echo secret-shaped path values if the path itself matched a forbidden marker. Fix: the LMS scanner now uses safe artifact labels for path-triggered failures while still matching raw display paths for raw `dev-server.log` and `preview-safe*.log` refusal.
5. Severity: Medium. Existing tests covered URL, absolute, traversal, and non-`logs/` roots, but not symlinks, junctions, nested linked descendants, linked dynamic marker manifests, linked visual manifests, or linked OCR sidecars. Fix: focused integration tests now create workspace-local directory links/junctions and assert fail-closed behavior.

## Decisions
- Reject linked/reparse path components even when the link target currently resolves inside the workspace. This is simpler to reason about and avoids treating a mutable link as trusted acceptance evidence.
- Keep the helper script-local in `scripts/workspace-path-guard.mjs`; do not add a new product package.
- Preserve accepted operator inputs as relative repo-local `logs/...` paths and preserve normalized relative `summary=logs/.../summary-*.json` output.
- Use exclusive create for preflight summaries so a retained summary cannot be silently overwritten.
- Restore explicit file artifact roots for scanners; raw preview/dev-server log files remain valid scanner inputs but are refused as archive evidence.

## Risks
- This phase hardens local filesystem evidence paths; it does not prove live DB, provider, server, or preview acceptance.
- Link creation tests are platform-sensitive. The focused tests use directory junctions on Windows and return early only if the OS refuses link creation with expected permission-related errors.
- The workspace is still not git-backed from the current root, so no commit, branch, PR, or GitHub CI status is claimed.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| workspace path guard syntax | `node --check scripts/workspace-path-guard.mjs` | PASS |
| preflight log-root syntax | `node --check scripts/preflight-log-root.mjs` | PASS |
| LMS retained-artifact scanner syntax | `node --check scripts/scan-lms-db-e2e-artifacts.mjs` | PASS |
| retained visual artifact checker syntax | `node --check scripts/check-retained-visual-artifacts.mjs` | PASS |
| gate runner syntax | `node --check scripts/gates.mjs` | PASS |
| focused symlink-hard integration tests | `npx vitest run tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/retained-visual-artifacts.test.ts` | PASS (`61` passed) |
| secret scan | `npm run secret:scan` | PASS |
| root typecheck | `npm run typecheck` | PASS |
| full local gate runner | `node scripts/gates.mjs full` | PASS (9/9) |
| retained gate-log scanner | `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` | PASS (`15` text files, `0` images, `0` blocked containers) |
| visual artifact inventory | `npm run evidence:visual -- --inventory tests/e2e/screenshots` | PASS inventory only (`68` image files; not acceptance) |
| final governance | `npm run governance:check` | PASS (0 errors, 1 known historical warning) |

Gates NOT RUN: `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live object-store/scanner/Stripe/Axioma preflights, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution, deploy, and production monitoring.

## Next actions
1. If operator credentials become available, move to the matching credentialed acceptance path rather than adding another local-only substitute.
2. If credentials remain unavailable, record the exact missing credential gates as blockers; do not claim live acceptance or production readiness from local evidence hardening alone.
3. Keep any future retained evidence roots plain local directories; remove and recreate symlinked/junctioned/reparse paths before rerunning preflights or scanners.
