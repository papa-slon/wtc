# Next session prompt after Phase 3.63

Start in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Read first:
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`

Current truth:
- Phase 3.63 is landed locally.
- Six read-only agents were dispatched before edits and closed: security, bot-integration, devops, backend, frontend, tests.
- Local gates now green in Phase 3.63 scope: no-network Stripe/Axioma/LMS dry-runs, retained preflight evidence scan, root
  `npm test` (`934` passed, `10` skipped), web build, core smoke, root/web typecheck, lint, secret scan, default e2e
  (`44` passed, `6` skipped), auth production-profile e2e (`2` passed), and auth DB managed e2e (`2` passed) against a
  throwaway `wtc_test_auth_*` database created/dropped from the existing local bot Postgres source.
- Production is still NOT ready.
- The folder is still not git-backed; GitHub CI is NOT RUN.
- Do not claim production readiness until the intended-environment gates below are observed green.

Use agents:
- For any broad/major phase, launch read-only agents before edits, per `AGENTS.md`.
- At minimum use `ecosystem-task-router`, `ecosystem-security-auditor`, `ecosystem-devops-implementer`, and
  `ecosystem-tests-runner`.
- Add `ecosystem-backend-implementer` for DB/provider gates, `ecosystem-bot-integration-auditor` for bot integration, and
  `ecosystem-frontend-implementer` for browser/UI production acceptance.
- Every agent must write `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`; close agents before final report.

Pick exactly one next gate per phase:
1. Git-backed CI: initialize/restore the true git repo, add remote, push branch/PR, run GitHub Actions.
2. Intended audit role: run `npm run accept:audit:append-only-role` with the intended restricted role URL and explicit
   consent env.
3. LMS object-store live: run `npm run accept:lms:object-storage -- --live` with approved throwaway S3/R2 credentials and
   consent flags.
4. LMS scanner live: run `npm run accept:lms:external-scanner -- --live` with approved endpoint/token and quarantine corpus.
5. Stripe live/test: real test Checkout Session plus Stripe CLI/Dashboard webhook replay using approved `sk_test`, `whsec`,
   and `price_` values.
6. Axioma live: endpoint-shape confirmation, ES256 key/kid, bridge token, account-link/download/handoff acceptance.
7. Server/deploy: approved runbook for DB backup/migrate/seed, restricted-role proof, web/worker process management,
   nginx/TLS, smoke checks, monitoring, and rollback.

Forbidden without explicit scoped approval:
- Do not mutate a live server.
- Do not start/stop/apply-config to live bot services.
- Do not print secrets or DSNs.
- Do not treat local dry-runs, local preview, throwaway DB proof, or visual inventory as production readiness.
- Do not run two production phases in one session.

Final report must list exact gates RUN and exact gates NOT RUN with reasons.
