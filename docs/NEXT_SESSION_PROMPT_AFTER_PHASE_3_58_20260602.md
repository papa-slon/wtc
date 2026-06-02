# Next Session Prompt After Phase 3.58

Open this folder first:

`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`

This is a NEW session after Phase 3.58. Do not start from chat memory. Re-establish ground truth from repo files and current command output.

## Read First

Read these files before planning edits:

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- latest phase handoff in `docs/handoffs/` (currently `docs/handoffs/20260602-1626-phase-3-58-credentialed-acceptance-blocker-packet.md`)
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
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
- Final report and aggregate handoff must list exact gates RUN and NOT RUN with reasons.

## Choose The Next Phase

First check whether operator credentials are available in the environment or have been explicitly provided for this session. Do not print or archive credential values.

If credentials are available, run exactly the matching bounded acceptance gate:

```powershell
npm run e2e:lms:db:managed
npm run accept:real-pg:managed
npm run accept:audit:append-only-role
npm run accept:lms:object-storage -- --live
npm run accept:lms:external-scanner -- --live
```

For Stripe or Axioma, follow the exact scoped runbook in `docs/DEPLOYMENT.md` and the blocker packet. Do not treat local dry-run preflights as live provider acceptance.

If credentials are still unavailable, keep `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` current and do not invent another local acceptance substitute.

## Current Evidence From Phase 3.58

Phase 3.58 is docs-only and locally landed:

- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` lists every credentialed/live gate still blocked.
- Current env checks printed only `SET`/`NOT_SET`; all checked credential/consent vars were `NOT_SET` in that session.
- Current root was not git-backed.
- No preview, Playwright, DB mutation, provider calls, SSH/nginx/systemd, bot services, deploy, CI, or production monitoring were run.
- Agents were launched, wrote handoffs, and were closed.

## Forbidden Unless Explicitly Scoped

- live bot start/stop/apply-config
- production deploy
- SSH/nginx/systemd mutation
- preview/prod DB migration or seed
- live Stripe/Axioma/LMS provider calls without operator credentials and consent flags
- plaintext secrets in docs, logs, DB, fixtures, screenshots, or responses
- raw `dev-server.log`, `logs/preview-safe*.log`, copied terminal buffers, or screenshots of terminal output as acceptance evidence
- symlinked/junctioned/reparse retained evidence roots
- one-file prototype architecture
- fake integration claim
- two phases in one session

## Before Final Report

- close all agents
- write per-agent handoffs and aggregate handoff
- update status docs if truth changes
- run `npm run governance:check` after the aggregate exists
- run `npm run secret:scan` after docs/source edits
- list gates RUN and NOT RUN
- do not claim production readiness unless the relevant live gates were actually observed green in this session
