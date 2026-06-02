# Next-session prompt after Phase 3.62

Use this prompt only if the work moves to a new Codex/Cloud Code/Claude Code session.

```
You are continuing WTC Ecosystem Platform from:
C:\Users\maxib\GTE BOT\wtc_ecosystem_platform

Read first:
1. AGENTS.md
2. docs/SESSION_PROTOCOL.md
3. docs/handoffs/0000-orchestrator-seed.md
4. docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md
5. docs/STATUS.md
6. docs/NEXT_ACTIONS.md
7. docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md
8. docs/PRODUCTION_BLOCKERS_CURRENT.md

Current truth:
- Phase 3.59 cleared local managed LMS DB browser acceptance with `npm run e2e:lms:db:managed`.
- Phase 3.60 cleared local active managed real-PG proof with `npm run accept:real-pg:managed`.
- Phase 3.61 cleared local generated-role audit append-only proof with
  `npm run accept:audit:append-only-role:managed`.
- Phase 3.62 cleared local site-readiness: root `npm test`, web build, default `npm run e2e`,
  local preview HTTP smoke at `http://127.0.0.1:3000`, core smoke, DB generate, and visual inventory.
- The local preview is demo/mock and is checkable at `http://127.0.0.1:3000` if the existing `preview:safe`
  process is still running.
- This folder is not git-backed; do not claim branch/commit/PR/GitHub CI readiness.
- Production is not ready.

Agents:
- For any broad phase, launch read-only agents before edits as required by AGENTS.md.
- Write one per-agent handoff under `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`.
- Close every spawned agent before final reporting.
- The aggregate handoff must cite every per-agent handoff by exact path.

Do not touch:
- Live bot start/stop/apply-config.
- Exchange secrets.
- SSH/nginx/systemd/deploy targets unless the operator explicitly approves the scoped server run.
- Raw `test-results`, raw Playwright traces, raw preview logs, or unreviewed screenshots as archive evidence.

Next valid work:
Pick exactly one remaining credentialed/live gate with available prerequisites:
1. Direct production/preview intended audit role proof:
   `npm run accept:audit:append-only-role`
   Requires intended restricted `AUDIT_APPEND_ONLY_DATABASE_URL` and consent flags.
2. Live LMS object-store acceptance:
   `npm run accept:lms:object-storage -- --live`
   Requires approved throwaway S3/R2-compatible credentials and live consent flags.
3. Live LMS external scanner acceptance:
   `npm run accept:lms:external-scanner -- --live`
   Requires approved HTTPS scanner endpoint/token and live consent flags.
4. Stripe test checkout/webhook replay:
   follow `docs/DEPLOYMENT.md` and current blocker docs.
5. Axioma live bridge/handoff acceptance:
   follow `docs/DEPLOYMENT.md` and current blocker docs.
6. GitHub CI/deploy/server checks:
   only after the workspace is git-backed or a server target is explicitly approved.

Stop conditions:
- If no credentials/targets for a remaining gate are available, update the blocker packet only; do not invent fake acceptance.
- If a live run would print or retain secrets, stop and harden redaction/evidence policy first.
- If a phase grows beyond one objective, write a handoff and start a new phase.
```
