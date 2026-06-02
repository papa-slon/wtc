# Next Session Prompt After Phase 3.54

> Historical prompt from 2026-06-02. For current continuation after Phase 3.55, use
> [`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`](NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md) instead.
> Keep this file as Phase 3.54 context only; do not treat it as the current restart packet without first
> re-checking `docs/STATUS.md` and the latest aggregate handoff.

Open this folder first:

`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`

This is a NEW session after Phase 3.54. Do not start from chat memory. Re-establish ground truth from the repo and current command output.

## Read First

Read these files before planning edits:

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- latest phase handoff in `docs/handoffs/` (currently `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`)
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

- `ecosystem-security-auditor`
- `ecosystem-tests-runner`
- `ecosystem-devops-implementer`
- `ecosystem-platform-architect`

Add narrower domain agents only if the selected phase actually needs them.

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

If credentials are not available, choose one bounded local safety slice:

- screenshot retention/OCR policy for visual artifacts
- long-running `safe-preview` retained-output policy
- symlink-hard preflight root confinement

Do not silently substitute a live acceptance claim with a mock/local proof.

## Current Evidence From Phase 3.54

Phase 3.54 is locally landed and verified:

- `scripts/redacted-child-process.mjs` added text-only child stdout/stderr redaction.
- LMS DB runner, LMS DB managed runner, real-PG managed runner, `safe-worker-tick`, and `scripts/gates.mjs` use the helper.
- Passing `logs/gates/*.log` files retain only compact summaries after metric extraction.
- Failing gate logs retain full redacted output for diagnostics and must be scanned before archiving.
- `safe-preview.mjs` remains out of scope as a long-running interactive dev-server stream.

Observed gates:

```powershell
node scripts/gates.mjs full
node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates
npm run governance:check
npm run secret:scan
```

All were PASS in the Phase 3.54 closeout. Re-run relevant gates in the new session after any edits.

## Forbidden Unless Explicitly Scoped

- live bot start/stop/apply-config
- production deploy
- SSH/nginx/systemd mutation
- preview/prod DB migration or seed
- live Stripe/Axioma/LMS provider calls without operator credentials
- plaintext secrets in docs, logs, DB, fixtures, screenshots, or responses
- one-file prototype architecture
- fake integration claim
- two phases in one session

## Stop Conditions

Stop and write a handoff if:

- credentials are required but unavailable
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
