# Phase 3.56 safe-preview retained output policy handoff
## Scope
Close the local retained-evidence gap where `npm run preview:safe` was still a long-running raw stdout/stderr stream that could be copied or redirected into ignored local logs. This phase adds a redacted streaming output boundary and raw preview-log archive refusal without running live preview, Playwright, SSH, nginx, systemd, DB mutation, bot services, provider calls, CI, deploy, or production monitoring.

## Agents
- [`docs/handoffs/20260602-1531-ecosystem-security-auditor.md`](20260602-1531-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1531-ecosystem-tests-runner.md`](20260602-1531-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1531-ecosystem-devops-implementer.md`](20260602-1531-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1531-ecosystem-platform-architect.md`](20260602-1531-ecosystem-platform-architect.md)

All background agents were closed after their read-only results were collected.

## Files inspected
`AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`, `package.json`, `.gitignore`, `.secretlintignore`, `.github/workflows/ci.yml`, `scripts/safe-preview.mjs`, `scripts/redacted-child-process.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/gates.mjs`, `tests/integration/child-output-redaction.test.ts`, `tests/integration/db-seed-preview-hardening.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, current `dev-server.log`, and current `logs/preview-safe*.log`.

## Files changed
- `scripts/safe-preview.mjs`
- `scripts/safe-preview.d.mts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/safe-preview-retained-output.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_56_20260602.md`
- `docs/handoffs/20260602-1531-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1531-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1531-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1531-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md`

## Findings
1. Severity: High. `safe-preview.mjs` inherited raw stdout/stderr from a long-running Next process. Evidence: previous `scripts/safe-preview.mjs` used `stdio: 'inherit'`, while prior docs said raw preview stdout/stderr must not be archived. Fix: replaced inherited raw output with piped stdout/stderr and a streaming redactor before forwarding.
2. Severity: High. Existing preview logs are ignored by git and secretlint, but ignore status is not archive approval. Evidence: `.gitignore` and `.secretlintignore` ignore `dev-server.log` and `logs/preview-safe*.log`; current local files existed. Fix: `scripts/scan-lms-db-e2e-artifacts.mjs` now refuses raw `dev-server.log` and `preview-safe*.log` paths as retained evidence.
3. Severity: Medium. A naive stream redactor can leak sensitive text split across chunks or private-key block lines. Evidence: the first focused test run caught a private-key block boundary leak in the new fixture. Fix: the stream forwarder buffers incomplete lines and holds private-key blocks until a safe boundary or final flush before calling the redaction corpus.
4. Severity: Medium. Regression coverage guarded gates and worker smoke but not safe-preview retained output. Fix: added `tests/integration/safe-preview-retained-output.test.ts` and extended existing static/wiring tests.

## Decisions
- Keep the implementation script-local; do not add a new `@wtc/*` package.
- Reuse `redactProcessOutput()` for the redaction corpus but do not use the synchronous `runRedactedChildProcess()` wrapper for the long-running preview server.
- Preserve safe-preview behavior: direct Next CLI, `shell:false`, `--hostname 0.0.0.0`, `--port 3000`, `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
- Treat raw preview logs as local diagnostics only, not retained archive evidence.

## Risks
- Redaction is regex-based retained-output hygiene, not proof that live preview is safe or production-ready.
- `npm run preview:safe` was not run in this phase, so no preview smoke is claimed.
- Current raw preview logs remain on disk as local ignored diagnostics, but the scanner now refuses them as archive evidence.
- GitHub CI remains staged/inert because the workspace is not git-backed.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| safe-preview syntax | `node --check scripts/safe-preview.mjs` | PASS |
| artifact scanner syntax | `node --check scripts/scan-lms-db-e2e-artifacts.mjs` | PASS |
| focused safe-preview retained-output tests | `npx vitest run tests/integration/safe-preview-retained-output.test.ts tests/integration/child-output-redaction.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` | PASS (`32` passed) |
| raw preview log archive refusal | `node scripts/scan-lms-db-e2e-artifacts.mjs dev-server.log logs/preview-safe.out.log logs/preview-safe.err.log` | EXPECTED REFUSAL (`raw dev-server log artifact`, `raw safe-preview log artifact`) |
| secret scan | `npm run secret:scan` | PASS |
| root typecheck | `npm run typecheck` | PASS |
| full local gate runner | `node scripts/gates.mjs full` | PASS (9/9) |
| retained gate-log scanner | `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` | PASS (`15` text files, `0` images, `0` blocked containers) |
| final governance | `npm run governance:check` | PASS (0 errors, 1 known historical warning) |

Gates NOT RUN: `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live preflights, live Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production monitoring.

## Next actions
1. If credentials become available, prioritize the blocked live acceptance path; do not substitute this retained-output policy for live DB/provider/server proof.
2. If credentials remain unavailable, the next bounded local safety slice is symlink-hard preflight root confinement.
3. If preview evidence is needed, run preview in a separately scoped session and retain only a compact operator summary plus scanned/reviewed artifacts, not raw terminal buffers or `preview-safe*.log`.
