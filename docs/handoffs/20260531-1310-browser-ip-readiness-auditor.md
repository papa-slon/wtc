## Scope
Read-only browser/IP readiness audit for the broad Phase 3.3 pass.

## Files inspected
- `apps/web/package.json`
- `playwright.config.ts`
- `apps/web/src/lib/backend.ts`
- `.env.example`
- `docs/DEPLOYMENT.md`

## Files changed
None by this read-only auditor.

## Findings
- The current site is browser-previewable as a safe local/LAN demo when `BOT_ADAPTER_MODE=mock` and live-control flags are false.
- Production readiness remains blocked by real Postgres acceptance, real secrets, Stripe, Axioma bridge, and CI/git.
- Next dev/build can poison `.next` if run concurrently, so build and e2e should not overlap with the local preview server.

## Decisions
- Stop only local WTC preview processes before `next build`; never touch live server/bots.
- Restart a local preview after verification if the user wants to inspect the browser state.

## Risks
- E2E has known dev-server Server Action login retry flakes; final result must be judged by Playwright exit code and final summary, not by first retry lines.

## Verification/tests
- Final build/e2e verification is recorded in the aggregate handoff for this epoch.

## Next actions
- Keep production blockers explicit in `STATUS.md` and `NEXT_ACTIONS.md`.
