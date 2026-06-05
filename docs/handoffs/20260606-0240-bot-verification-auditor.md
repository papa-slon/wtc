# bot-verification-auditor handoff
## Scope
Read-only verification audit for WTC bot completion gates: package scripts, e2e/integration coverage, current handoffs, CI/gates docs, and smallest next gate set for bot settings/statistics/admin/liveness.

## Files inspected
- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `.github/workflows/ci.yml`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `playwright.config.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- bot e2e/integration tests

## Files changed
None - read-only audit.

## Findings
1. Severity: P1. Required GitHub CI is necessary but not sufficient for bot completion. Evidence: `.github/workflows/ci.yml`, `playwright.config.ts`, `package.json`. Recommendation: after bot settings/statistics/admin/worker changes, run managed or rendered bot gates explicitly. Target part: CI/completion gates.
2. Severity: P1. The canonical local bot/admin runner is mock/no-live by design. Evidence: `scripts/gates.mjs`. Recommendation: use `npm run accept:bots:rendered` for rendered UI regressions, paired with managed DB/source gates when loaders or worker liveness change. Target part: local rendered acceptance.
3. Severity: P1. Managed DB proof exists and is the smallest meaningful set after backend/loader changes. Evidence: package scripts and admin-user-bot detail specs. Recommendation: run managed user routes, managed matrix, and managed worker continuity for DB/loader/worker slices. Target part: admin drilldown, user bot routes, worker continuity.
4. Severity: P2. Bot settings have strong mock-browser and PGlite handler coverage, but no managed DB browser save/reload lane. Recommendation: add a guarded DB browser spec if settings persistence/export changes materially. Target part: bot settings.
5. Severity: P2. Statistics coverage is local/rendered and selected-user scoped, but post-deploy authenticated statistics smoke is not part of Phase 4.66. Recommendation: after future canary deploys, add authenticated smoke for bot statistics and selected-user admin drilldown. Target part: bot statistics/admin.
6. Severity: P1. Long canary burn-in/alert proof remains missing. Recommendation: deploy-monitor gate should include public health, protected-route redirects, worker rows, redacted logs, unchanged bot service PIDs, and timed burn-in. Target part: bot liveness/deploy monitor.

## Decisions
- Smallest UI-only slice gate: `npm run accept:bots:rendered` plus local code checks.
- Smallest backend/loader/DB/worker slice gate: `npm run ci:local`, managed admin-user bot routes/matrix, and managed worker continuity.
- Tortila source/worker auth slice must add `npm run accept:tortila:real-read:managed`.
- Deploy monitor stays server-approved and read-only; no live controls.

## Risks
- Default CI can be green while bot DB/browser/liveness gates are stale.
- Long rendered gates can expose dev-server flakes; rerun isolated failing tests before blaming code.
- Legacy realized analytics remains source-blocked.

## Verification/tests
Read-only inspection only. No tests or builds were run by this agent.

## Next actions
1. For this UI slice, run code checks plus `npm run accept:bots:rendered`.
2. If DB/admin/user/worker changes later, add managed DB/worker gates.
3. If Tortila source auth changes later, add Tortila real-read managed gate.
4. If deploying, monitor canary health and bot continuity before calling the slice complete.
