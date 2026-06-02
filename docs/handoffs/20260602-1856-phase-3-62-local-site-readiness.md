# Phase 3.62 local site-readiness handoff
## Scope
Execute and record the local site-readiness phase after Phase 3.61: root tests, web build, default Playwright e2e, local
safe preview reachability, core smoke, DB generate, visual artifact inventory, and final documentation gates.

This phase did not attempt production deployment or live provider acceptance. It used the already-running local
`npm run preview:safe` process on port `3000` after verifying that it belonged to this workspace and responded over
`127.0.0.1`.

Read-only agents launched before execution and were closed:
- `ecosystem-tests-runner`: `docs/handoffs/20260602-1842-ecosystem-tests-runner.md`
- `ecosystem-frontend-implementer`: `docs/handoffs/20260602-1842-ecosystem-frontend-implementer.md`
- `ecosystem-devops-implementer`: `docs/handoffs/20260602-1842-ecosystem-devops-implementer.md`

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`,
`docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`,
`docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `package.json`,
`apps/web/package.json`, `playwright.config.ts`, `scripts/gates.mjs`, `scripts/safe-preview.mjs`,
`scripts/check-retained-visual-artifacts.mjs`, and the three Phase 3.62 read-only agent handoffs.

## Files changed
- `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_62_20260602.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Findings
1. Severity: High. Evidence: `npm test` in this phase passed with `103` test files, `921` tests passed, and `10`
   skipped. Recommendation: treat root Vitest health as current local site-readiness evidence, not as CI or production
   evidence. Target part: local unit/integration readiness.
2. Severity: High. Evidence: `npm run build -w @wtc/web` in this phase compiled successfully under Next `15.5.18`,
   generated `35` static pages, reported First Load JS `103 kB`, and middleware `35.3 kB`. Recommendation: the local web app
   can be built from the current workspace state. Target part: local build readiness.
3. Severity: High. Evidence: default `npm run e2e` first exceeded the outer tool timeout without a useful failure signal,
   then passed on the rerun with `44` passed and `8` skipped in `6.3m`; no failed or flaky tests were reported.
   Recommendation: count only the final completed run as green and keep the timeout-only attempt as not green. Target part:
   browser readiness.
4. Severity: High. Evidence: `Invoke-WebRequest http://127.0.0.1:3000` returned status `200`, content length `66812`, and
   a title containing `WTC Ecosystem` and `World Trader Club`; port `3000` is owned by `npm run preview:safe` -> `scripts/safe-preview.mjs`
   -> `next dev --hostname 0.0.0.0 --port 3000` from this workspace. Recommendation: the user can manually check the local
   demo/mock preview at `http://127.0.0.1:3000`. Target part: local preview.
5. Severity: Medium. Evidence: `npm run check:core` passed all listed package smokes; `npm run db:generate -w @wtc/db`
   reported `43` tables and `No schema changes, nothing to migrate`; `npm run evidence:visual -- --inventory
   tests/e2e/screenshots` reported `69` image files, `0` blocked binary/container artifacts, and `0` missing roots.
   Recommendation: keep visual inventory marked as inventory only, not screenshot acceptance. Target part: supporting gates.
6. Severity: Medium. Evidence: `Get-NetTCPConnection -LocalPort 3100` after e2e returned no listener; `git rev-parse
   --show-toplevel` still fails with `fatal: not a git repository`. Recommendation: Playwright did not leave its server on
   port `3100`, but GitHub CI remains unavailable from this root. Target part: cleanup and CI boundary.

## Decisions
- Reused the already-running `preview:safe` chain on port `3000` because it was from this workspace, was reachable, and the
  user wanted a checkable local site.
- Did not stop the preview process because it is the local browser target the user needs.
- Did not archive raw Playwright traces, `test-results`, raw preview logs, or unreviewed screenshots as acceptance evidence.
- Treated local site-readiness as separate from production readiness, live provider acceptance, server deployment, and CI.

## Risks
- The local preview is demo/mock unless real runtime credentials are intentionally supplied and the matching acceptance gates
  are run.
- Screenshot inventory does not prove screenshot safety; retained screenshots still require a manifest/OCR/manual review
  before being used as archive evidence.
- The workspace is not git-backed, so no commit, branch, PR, or GitHub Actions result can be claimed from this folder.
- Production/live readiness is still blocked by provider/server/CI gates listed in current blocker docs.

## Verification/tests
RUN/PASS in this phase:
- `npm test` - PASS; `103` test files, `921` passed, `10` skipped.
- `npm run build -w @wtc/web` - PASS; Next `15.5.18`, `35` static pages, First Load JS `103 kB`, middleware `35.3 kB`.
- `npm run e2e` - first run hit outer command timeout only; rerun PASS with `44` passed, `8` skipped, no failures/flaky.
- `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000` - PASS; `200`, title contains `WTC Ecosystem` and
  `World Trader Club`.
- `npm run check:core` - PASS.
- `npm run db:generate -w @wtc/db` - PASS; `43` tables, no schema changes.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory only; `69` images, `0` blocked containers.
- `Get-NetTCPConnection -LocalPort 3100` - PASS as cleanup check; no listener after e2e.
- `git rev-parse --show-toplevel` - observed NOT GIT-BACKED.

NOT RUN in this phase:
- `node scripts/gates.mjs full` - not run because equivalent component gates were run directly plus default e2e separately.
- `npm run coverage` - not part of this site-readiness slice.
- `npm run e2e:lms:db:managed` - already passed in Phase 3.59; not rerun because no LMS DB code changed in Phase 3.62.
- `npm run accept:real-pg:managed` - already passed in Phase 3.60; not rerun because no real-PG code changed in Phase 3.62.
- `npm run accept:audit:append-only-role:managed` - already passed in Phase 3.61; not rerun because no audit-role code changed
  in Phase 3.62.
- Direct production/preview intended audit role proof - not run; intended restricted role URL and approval absent.
- Live LMS object-store/scanner, Stripe, Axioma, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and
  production monitoring - not run; credentials/targets/approval or git-backed CI are absent and these are outside local
  site-readiness.

## Next actions
1. User manual check: open `http://127.0.0.1:3000`.
2. Keep the preview labeled local demo/mock unless real DB/provider/live credentials are intentionally wired and accepted.
3. Next completion blockers are credentialed/live gates: production/preview intended audit-role proof, live LMS object-store,
   live LMS external scanner, Stripe test checkout/webhook replay, Axioma bridge/live endpoint checks, GitHub CI, and
   deployment/server checks.
4. Do not claim production readiness until those gates are observed green in their intended environments.
