# Next Session Prompt After Phase 3.57

Open this folder first:

`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`

This is a NEW session after Phase 3.57. Do not start from chat memory. Re-establish ground truth from repo files and current command output.

## Read First

Read these files before planning edits:

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- latest phase handoff in `docs/handoffs/` (currently `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md`)
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

Verify whether this folder is git-backed:

```powershell
git rev-parse --show-toplevel
```

Expected current truth: this folder has not been git-backed in recent sessions. Do not claim commits, branches, PRs, GitHub CI, or merge readiness unless this command proves that changed.

## Session Protocol

- Name exactly one phase at session start.
- Each new phase is a NEW session. Do not run two phases in one session.
- For a broad/major phase, launch read-only agents before any code or docs edit.
- If agent tooling is unavailable for a broad/major phase, stop and report BLOCKED rather than doing the phase solo.
- Every claimed agent must write one handoff at `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`.
- The operator aggregate handoff must cite every per-agent handoff by path.
- Close all agents before the final report.
- Final report and aggregate handoff must list exact gates RUN and exact gates NOT RUN with reasons.

## Required Read-Only Agents Before Edits

Use these agents for the next broad/major phase:

- `ecosystem-task-router` if the operator asks for prioritization instead of a named phase
- `ecosystem-security-auditor`
- `ecosystem-tests-runner`
- `ecosystem-devops-implementer`
- `ecosystem-platform-architect`

Add narrower domain agents only if the selected phase actually needs them, for example `ecosystem-db-architect` for DB schema/proof work, `ecosystem-billing-access-auditor` for Stripe/entitlements, `ecosystem-axioma-bridge-auditor` for Axioma, or `ecosystem-bot-integration-auditor` before any bot runtime control.

## Choose The Next Phase

First check whether operator credentials are available in the environment or have been explicitly provided for this session. Do not print or archive credential values.

If credentials are available, prioritize the blocked real acceptance path that matches the supplied credential:

1. LMS DB managed acceptance:

```powershell
npm run e2e:lms:db:managed
```

Requires `LMS_E2E_ADMIN_DATABASE_URL` pointing at an operator-approved non-throwaway maintenance DB. The runner creates and drops a fresh `wtc_test_lms_*` database.

2. Real-Postgres managed proof:

```powershell
npm run accept:real-pg:managed
```

Requires `REAL_POSTGRES_ADMIN_DATABASE_URL` pointing at an operator-approved non-throwaway maintenance DB. The runner creates and drops a fresh `wtc_test_realpg*` database.

3. Audit append-only role proof:

```powershell
npm run accept:audit:append-only-role
```

Requires the restricted `wtc_app_role` / append-only acceptance URL documented by the current preflight script and deployment docs.

4. Live provider preflight or acceptance:

Use only if the operator explicitly supplies scoped throwaway credentials and the matching consent flags for LMS object storage, external scanner, Stripe, or Axioma. Never substitute dry-run preflight for live provider acceptance.

If credentials are not available, do not invent another local acceptance substitute. Write or update a blocker/acceptance packet that lists the exact missing credential gates and the exact commands that remain NOT RUN.

## Current Evidence From Phase 3.57

Phase 3.57 is locally landed and verified:

- `scripts/workspace-path-guard.mjs` adds script-local realpath/lstat confinement helpers.
- `scripts/preflight-log-root.mjs` rejects symlink/junction/reparse components during log-root resolution and summary writes.
- Preflight summary files are created exclusively and are not overwritten.
- `scripts/gates.mjs` writes retained gate logs under a verified plain workspace directory.
- `scripts/scan-lms-db-e2e-artifacts.mjs` refuses linked artifact roots, nested linked descendants, linked dynamic marker manifests, and raw preview/dev-server logs as archive evidence.
- `scripts/check-retained-visual-artifacts.mjs` refuses linked visual roots, nested linked descendants, linked visual review manifests, linked dynamic marker manifests, and linked OCR sidecars.
- Focused integration tests create workspace-local directory links/junctions and assert fail-closed behavior.

Observed gates:

```powershell
node --check scripts/workspace-path-guard.mjs
node --check scripts/preflight-log-root.mjs
node --check scripts/scan-lms-db-e2e-artifacts.mjs
node --check scripts/check-retained-visual-artifacts.mjs
node --check scripts/gates.mjs
npx vitest run tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/retained-visual-artifacts.test.ts
npm run secret:scan
npm run typecheck
node scripts/gates.mjs full
node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates
npm run evidence:visual -- --inventory tests/e2e/screenshots
npm run governance:check
```

All were PASS. The visual command was inventory only and is not screenshot acceptance.

## Forbidden Unless Explicitly Scoped

- live bot start/stop/apply-config
- production deploy
- SSH/nginx/systemd mutation
- preview/prod DB migration or seed
- live Stripe/Axioma/LMS provider calls without operator credentials
- plaintext secrets in docs, logs, DB, fixtures, screenshots, or responses
- raw `dev-server.log`, `logs/preview-safe*.log`, copied terminal buffers, or screenshots of terminal output as acceptance evidence
- symlinked/junctioned/reparse retained evidence roots
- one-file prototype architecture
- fake integration claim
- two phases in one session

## Stop Conditions

Stop and write a handoff if:

- credentials are required but unavailable for the selected acceptance phase
- the selected phase grows beyond one bounded phase
- quality degrades or context is insufficient
- agent tooling is unavailable for a broad/major phase
- a serious runtime blocker appears

Before final report:

- close all agents
- write per-agent handoffs and aggregate handoff
- update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`
- list gates RUN and NOT RUN
- do not claim production readiness unless the relevant live gates were actually observed green in this session
