# ecosystem-frontend-implementer handoff
## Scope
Read-only frontend/UX site-readiness audit for WTC Phase 3.62. Scope was to determine whether the web app can be locally built, previewed, and checked by the user from the current repository state by inspecting `apps/web`, package scripts, Next config, Playwright config, route structure, retained e2e screenshots, and latest status/handoff truth.

No file edits were made except this required per-agent handoff. No build, preview, e2e, Playwright, server start/stop, DB mutation, provider call, SSH/nginx/systemd check, bot service/control, GitHub CI, deploy, or production monitoring command was run by this audit.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/DEPLOYMENT.md`, latest Phase 3.61 handoff, recent tests/devops handoffs, `package.json`, `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/instrumentation.ts`, `apps/web/src/app/**`, `apps/web/src/app/api/e2e/login/route.ts`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `tests/e2e/**`, `tests/e2e/screenshots/**`, `logs/gates/**`, `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json`, `.gitignore`, `.secretlintignore`, `eslint.config.js`, `README.md`, and current process/port state for `3000`, `3100`, and `3101`.

## Files changed
None - read-only audit. Required handoff written: `docs/handoffs/20260602-1842-ecosystem-frontend-implementer.md`.

## Findings
1. Severity: High. Evidence: `docs/STATUS.md:16`, `docs/STATUS.md:17`, `docs/STATUS.md:18`, `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md:62`, `docs/NEXT_ACTIONS.md:13`, `docs/NEXT_ACTIONS.md:18`. The latest authoritative phase truth says root `npm test`, web build, default e2e, preview, and full gate runner are still NOT RUN after Phase 3.61. Recommendation: do not tell the user the site is currently verified until a fresh local site-readiness phase runs the web build plus browser checks in-session. Target part: site-readiness gate truth.
2. Severity: High. Evidence: current process inspection at `2026-06-02 18:43 +07` found `node scripts/safe-preview.mjs` parent PID `32500`, Next dev on `0.0.0.0:3000` PID `26416`, `npm run e2e` PID `38840`, Playwright PID `17912`, Next dev on `3100` PID `34824`, and active `chrome-headless-shell` workers; `playwright.config.ts:23`, `playwright.config.ts:24`, `playwright.config.ts:25`, `playwright.config.ts:27`, `scripts/safe-preview.mjs:85`. Generated screenshots and `.next-e2e` artifacts were being updated during this audit even though this audit did not start anything. Recommendation: before a clean user-facing readiness check, explicitly account for or stop pre-existing preview/e2e processes, then rerun the desired gates from a known idle state. Target part: reproducible local preview/e2e state.
3. Severity: Medium. Evidence: `package.json:26`, `package.json:27`, `apps/web/package.json:8`, `playwright.config.ts:14`, `playwright.config.ts:15`, `playwright.config.ts:23`, `playwright.config.ts:24`, `playwright.config.ts:28`, `playwright.config.ts:35`. Default e2e is not passive browser inspection; it starts its own Next dev server on `3100`, forces mock/no-live flags, and writes `.next-e2e`/Playwright artifacts. Recommendation: treat `npm run e2e` as a controlled gate, not as a manual-preview substitute, and keep manual `3000` preview separate from the `3100` e2e server. Target part: local check workflow.
4. Severity: Medium. Evidence: `apps/web/next.config.ts:3`, `apps/web/next.config.ts:9`, `apps/web/next.config.ts:11`, `apps/web/next.config.ts:31`, `package.json:41`, `docs/DEPLOYMENT.md:34`, `docs/DEPLOYMENT.md:35`. Next is configured to transpile workspace packages and supports isolated dist dirs, but `next build` ignores ESLint during builds; `ci:local` compensates by running lint/typecheck/secret scan before build. Recommendation: a site-readiness pass should run at least `npm run lint`, root and web typecheck, `npm test`, and `npm run build -w @wtc/web`, not build alone. Target part: build confidence.
5. Severity: Medium. Evidence: `README.md:49`, `README.md:50`, `README.md:62`, `docs/DEPLOYMENT.md:8`, `docs/DEPLOYMENT.md:9`, `docs/DEPLOYMENT.md:24`, `docs/DEPLOYMENT.md:38`, `docs/DEPLOYMENT.md:41`, `packages/config/src/env.ts:81`, `packages/config/src/env.ts:82`, `packages/config/src/env.ts:99`. The app is designed to boot locally on an in-memory demo backend, while production fails closed for missing/unsafe real config. Recommendation: the user can check a local demo preview, but it must be described as demo/mock unless `DATABASE_URL` and live acceptance gates are deliberately provided and run. Target part: user preview semantics.
6. Severity: Medium. Evidence: route inventory found 47 `page.tsx` files and 12 `route.ts` files under `apps/web/src/app`; `tests/e2e/lms-db-materials.spec.ts:7`, `docs/DEPLOYMENT.md:238`, `docs/DEPLOYMENT.md:250`, `docs/NEXT_ACTIONS.md:46`, `docs/NEXT_ACTIONS.md:49`. Default smoke covers a broad route surface, but DB-backed LMS material acceptance is opt-in and separate; the latest LMS DB managed run passed, but default e2e in Phase 3.61 was still not rerun. Recommendation: keep default in-memory e2e, LMS DB browser acceptance, and live object-store/scanner acceptance as separate gates. Target part: route/e2e coverage boundaries.
7. Severity: Medium. Evidence: current screenshot inventory found 70 files in `tests/e2e/screenshots`; `docs/DEPLOYMENT.md:292`, `docs/DEPLOYMENT.md:303`, `docs/DEPLOYMENT.md:314`, `docs/DEPLOYMENT.md:315`, `docs/STATUS.md:45`, `docs/STATUS.md:46`, `docs/STATUS.md:89`, `docs/STATUS.md:120`, `docs/STATUS.md:129`. Only the retained LMS DB mobile lesson screenshot has a current reviewed manifest; screenshot inventory is explicitly not acceptance. Recommendation: do not archive or present the whole screenshot directory as clean visual proof without a manifest/OCR/manual-review pass for the exact images being retained. Target part: visual evidence hygiene.
8. Severity: Low. Evidence: `docs/STATUS.md:65`, `docs/STATUS.md:66`, `docs/IMPLEMENTED_FILES.md:1762`, `docs/IMPLEMENTED_FILES.md:1765`, plus current `git status --short --branch` returned "not a git repository". Local checks can be run, but branch/commit/PR/GitHub CI readiness is unavailable from this root. Recommendation: keep site readiness framed as local-only until the workspace is git-backed with a remote. Target part: CI/deploy readiness.

## Decisions
- Treated latest `docs/STATUS.md` and the Phase 3.61 aggregate handoff as the authoritative current phase truth.
- Treated retained `logs/gates` and screenshots as historical or externally/currently-mutating evidence, not as gates observed by this audit.
- Did not start or stop any server, even though active listeners on `3000` and `3100` were found.
- Did not run `npm run build -w @wtc/web`, `npm run e2e`, `npm run preview:safe`, or any command that would create fresh acceptance artifacts.
- No background agents were spawned in this single-agent audit; none were left running by this audit.

## Risks
- A user opening `http://localhost:3000` may see the already-running safe-preview process, not a preview started or verified by this audit.
- An already-running `npm run e2e` on `3100` can mutate `.next-e2e`, `test-results`, and screenshots while another readiness pass is being prepared.
- Current local generated artifacts are useful for orientation, but they are stale/contaminated for acceptance unless tied to a fresh, named gate run.
- Build can pass while lint is ignored by Next; readiness should depend on the repo gate stack, not build alone.
- Manual preview is demo/mock by default; production/live readiness remains blocked on the documented provider/server/CI gates.

## Verification/tests
Gates RUN in this auditor session:

| Gate | Command/evidence | Result |
|---|---|---|
| Required protocol/docs read | Read protocol, seed, status, latest handoff, implemented files, deployment docs | PASS |
| Git root truth | `git status --short --branch` | NOT GIT-BACKED |
| Web script/config inspection | Static read of root/app package scripts, Next config, Playwright configs | PASS |
| Route inventory | `rg --files apps/web/src/app -g page.tsx`, `rg --files apps/web/src/app -g route.ts` | PASS; 47 pages, 12 route handlers |
| Screenshot inventory | `Get-ChildItem tests/e2e/screenshots` | PASS; 70 screenshots present, only inventory |
| Process/port inspection | Read-only process and TCP checks for `3000`, `3100`, `3101` | PASS; active `3000` preview and `3100` e2e server found |

Gates NOT RUN by this audit: `npm run build -w @wtc/web`, root `npm test`, `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, `npm run preview:safe`, `npm run dev`, `npm run dev:e2e -w @wtc/web`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, visual manifest validation for all screenshots, live LMS object-store/scanner, Stripe, Axioma, preview/prod DB migration or seed, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and production monitoring.

## Next actions
1. Resolve existing local preview/e2e processes before a clean user-facing readiness run, or explicitly decide to reuse the active preview and document that choice.
2. In a new single-purpose site-readiness phase, run the local gates in this order from an idle state: `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, `npm run build -w @wtc/web`, `npm run e2e`.
3. For manual browser review, start only `npm run preview:safe` after the gate run is complete, then record that preview as demo/mock unless real DB/live credentials are intentionally supplied.
4. If screenshots are retained, create or validate a review manifest for the exact images retained; do not rely on folder inventory.
