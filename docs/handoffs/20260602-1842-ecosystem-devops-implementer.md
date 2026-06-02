# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.62 site-readiness audit for the local preview/build/e2e operational path. Scope included `scripts/safe-preview.mjs`, root and web package scripts, Playwright config, env/defaults, port state, retained log policy, retained artifact policy, and current status/blocker truth.

No services were started. No HTTP requests were sent to the already-running local listeners. No files were edited except this required handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `.gitignore`
- `.secretlintignore`
- `eslint.config.js`
- `.github/workflows/ci.yml`
- `package.json`
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `playwright.config.ts`
- `scripts/safe-preview.mjs`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `tests/e2e/**` inventory only
- `logs/**` and `test-results/**` metadata/scanner audit only

## Files changed
None - read-only audit. Required handoff written: `docs/handoffs/20260602-1842-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. Evidence: `scripts/safe-preview.mjs:85`, `playwright.config.ts:15`, `playwright.config.ts:23`, `playwright.config.ts:25`, `playwright.config.ts:27`. Static port policy is fixed at safe preview `0.0.0.0:3000` and Playwright `localhost:3100` with `reuseExistingServer:false`. Current read-only port inspection found existing Next listeners on `0.0.0.0:3000` (PID 26416) and `:::3100` (PID 34824), both `node ... next/dist/server/lib/start-server.js`; no service was stopped. Recommendation: before running `preview:safe` or default e2e, the operator must either confirm these listeners are the intended current preview/e2e servers or clean them up outside this read-only audit. Target part: port readiness.
2. Severity: Medium. Evidence: `scripts/safe-preview.mjs:12`, `scripts/safe-preview.mjs:13`, `scripts/safe-preview.mjs:14`, `scripts/safe-preview.mjs:15`, `scripts/safe-preview.mjs:16`, `scripts/safe-preview.mjs:88`, `scripts/safe-preview.mjs:89`, `scripts/safe-preview.mjs:90`, `scripts/safe-preview.mjs:93`, `scripts/safe-preview.mjs:94`, `docs/DEPLOYMENT.md:344`, `docs/DEPLOYMENT.md:347`. `preview:safe` is correctly forced to development/mock/no-live flags and pipes stdout/stderr through redaction, but it is still a long-running interactive stream and not itself archiveable proof. Recommendation: retain only a compact operator summary plus separately scanned/reviewed artifacts after an approved preview run. Target part: preview evidence.
3. Severity: High. Evidence: `docs/STATUS.md:16`, `docs/STATUS.md:17`, `docs/STATUS.md:18`, `docs/NEXT_ACTIONS.md:16`, `docs/NEXT_ACTIONS.md:18`, `package.json:26`, `package.json:27`, `apps/web/package.json:10`, `docs/ACCEPTANCE_MATRIX_MASTER.md:26`, `docs/ACCEPTANCE_MATRIX_MASTER.md:31`. Latest status after Phase 3.61 still marks root test, web build, default e2e, preview, and full gate runner as NOT RUN. The script path exists, but no current-session green can be claimed. Recommendation: treat Phase 3.62 as an execution-readiness audit only until build/e2e/preview gates are actually run in a separate approved execution step. Target part: gate truth.
4. Severity: Medium. Evidence: `scripts/gates.mjs:13`, `scripts/gates.mjs:16`, `scripts/gates.mjs:17`, `scripts/gates.mjs:44`, `scripts/gates.mjs:47`, `scripts/gates.mjs:51`, `scripts/gates.mjs:53`, `scripts/gates.mjs:94`, `scripts/gates.mjs:96`. The compact gate runner deliberately keeps e2e out of `full`; `full` is core plus build only. Recommendation: for site readiness, run `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` as separate gates; do not report `full` as covering Playwright. Target part: gate sequencing.
5. Severity: High. Evidence: `playwright.config.ts:16`, `playwright.config.ts:17`, `scripts/scan-lms-db-e2e-artifacts.mjs:11`, `scripts/scan-lms-db-e2e-artifacts.mjs:18`, `scripts/scan-lms-db-e2e-artifacts.mjs:20`, `docs/DEPLOYMENT.md:294`, `docs/DEPLOYMENT.md:315`, `docs/ACCEPTANCE_MATRIX_MASTER.md:30`, `docs/ACCEPTANCE_MATRIX_MASTER.md:32`. Current `test-results` is not archive-safe: the scanner reported 121 issues in Playwright trace/network artifacts, including demo-password and session-cookie marker classes. Current `logs/preview-safe.out.log` and `logs/preview-safe.err.log` are correctly refused as raw safe-preview log artifacts. Recommendation: do not archive raw Playwright traces, `test-results`, or preview logs; retain scanner-clean `logs/gates` summaries and screenshot artifacts only after visual review. Target part: retained evidence policy.
6. Severity: Medium. Evidence: `scripts/check-retained-visual-artifacts.mjs:11`, `scripts/check-retained-visual-artifacts.mjs:112`, `scripts/check-retained-visual-artifacts.mjs:162`, `scripts/check-retained-visual-artifacts.mjs:217`, `scripts/check-retained-visual-artifacts.mjs:323`, `docs/DEPLOYMENT.md:299`, `docs/DEPLOYMENT.md:302`, `docs/DEPLOYMENT.md:315`. Screenshot inventory is not acceptance. Current inventory found 69 retained screenshot images, but no acceptance review was run. Recommendation: if any screenshots are retained from the next e2e/preview run, create a `logs/retained-visual-artifacts/<run-id>/visual-review.json` manifest and run `npm run evidence:visual -- --manifest ...`. Target part: visual artifact readiness.
7. Severity: Medium. Evidence: `.env.example:9`, `.env.example:67`, `.env.example:71`, `.env.example:75`, `.env.example:76`, `.env.example:82`, `.env.example:129`, `.env.example:130`, `packages/config/src/env.ts:24`, `packages/config/src/env.ts:29`, `packages/config/src/env.ts:30`, `packages/config/src/env.ts:36`, `packages/config/src/env.ts:75`, `packages/config/src/env.ts:79`. Env defaults are safe for local mock preview only; real generated `SESSION_SECRET` and base64 32-byte `SECRET_VAULT_KEK` are still required for meaningful server boot/e2e checks. Recommendation: before running preview/e2e, ensure `.env` has generated non-placeholder secrets and keep `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Target part: env readiness.
8. Severity: Low. Evidence: `apps/web/next.config.ts:3`, `apps/web/next.config.ts:9`, `apps/web/next.config.ts:11`, `apps/web/next.config.ts:31`, `.gitignore:10`, `.gitignore:11`, `.gitignore:12`, `.gitignore:14`, `.secretlintignore:10`, `.secretlintignore:11`, `.secretlintignore:12`, `.secretlintignore:14`. Network dev origins are operator-configured through `WTC_DEV_ALLOWED_ORIGINS`, `.next-e2e*` and preview logs are ignored, and Next build ignores ESLint. Recommendation: run lint and secret/artifact scanners as explicit gates; do not rely on build or ignore rules as evidence safety. Target part: local build hygiene.

## Decisions
- Did not run `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, `npm run build -w @wtc/web`, or any command that starts a web server.
- Did not stop or probe the existing local Next listeners on ports 3000 and 3100.
- Ran only read-only syntax checks, port/process inspection, file inventories, and artifact scanners.
- Treated the existing 3000/3100 listeners as current external/session state, not as evidence that this audit ran preview or e2e.
- No background agents were spawned in this narrow single-agent audit; none were left running.
- No production, preview, bot, SSH, nginx, systemd, database mutation, provider, deploy, or CI command was run.

## Risks
- A future e2e run can fail or hang immediately if PID 34824 continues to own port 3100, because Playwright is configured with `reuseExistingServer:false`.
- A future safe-preview run can collide with PID 26416 on port 3000 or attach operator attention to the wrong already-running preview if port ownership is not resolved first.
- Raw `test-results` traces currently include sensitive marker classes and must not be archived as evidence.
- Safe preview stream redaction reduces leak risk but does not make raw terminal logs, `preview-safe*.log`, or screenshots of terminal output acceptable retained artifacts.
- Build alone is insufficient for site readiness because Next build ignores ESLint and does not exercise Playwright flows or screenshot evidence policy.

## Verification/tests
| Gate/check | Command/check | Result |
|---|---|---|
| Required protocol/docs read | Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, current status/blockers, deployment docs, acceptance matrix | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |
| Safe-preview syntax | `node --check scripts\safe-preview.mjs` | PASS |
| Gate runner syntax | `node --check scripts\gates.mjs` | PASS |
| Text artifact scanner syntax | `node --check scripts\scan-lms-db-e2e-artifacts.mjs` | PASS |
| Visual artifact checker syntax | `node --check scripts\check-retained-visual-artifacts.mjs` | PASS |
| Port state | `Get-NetTCPConnection -LocalPort 3000,3100,3101` plus `Get-Process`/`Get-CimInstance` | 3000 LISTEN by Node PID 26416; 3100 LISTEN by Node PID 34824; no service touched |
| Retained gate-log scan | `node scripts\scan-lms-db-e2e-artifacts.mjs logs\gates` | PASS; 15 text files, 0 images, 0 blocked containers |
| Visual inventory | `node scripts\check-retained-visual-artifacts.mjs --inventory tests\e2e\screenshots` | PASS inventory only; 69 images; NOT acceptance |
| Raw preview-log scan | `node scripts\scan-lms-db-e2e-artifacts.mjs logs\preview-safe.out.log logs\preview-safe.err.log` | FAIL as expected; raw safe-preview logs refused |
| Playwright result artifact scan | `node scripts\scan-lms-db-e2e-artifacts.mjs test-results` | FAIL; 121 issues in trace/network artifacts; not archive-safe |

Gates NOT RUN: `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, root `npm test`, `npm run build -w @wtc/web`, `npm run ci:local`, LMS DB browser acceptance, live LMS object-store/scanner, Stripe, Axioma, production/preview append-only audit-role proof, preview/prod DB rollout, SSH/nginx/systemd/server checks, bot services/control, GitHub CI, deploy, and production monitoring.

## Next actions
1. Before any execution phase, resolve or explicitly account for existing Next listeners on ports 3000 and 3100. Do not run Playwright while 3100 is owned by an unrelated process.
2. Ensure `.env` has generated non-placeholder `SESSION_SECRET` and base64 32-byte `SECRET_VAULT_KEK`; keep `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
3. For build/core readiness, run `node scripts/gates.mjs full`. This covers governance, core smokes, lint, root/web typecheck, secret scan, root test, db generate, and web build; it does not cover e2e.
4. For default e2e readiness, run `node scripts/gates.mjs e2e` or `CI=1 npm run e2e` only after port 3100 is clear. Treat any flaky count as failed per `scripts/gates.mjs`.
5. For manual preview, run `npm run preview:safe` only after port 3000 is clear and the operator has approved the scope. Do not archive raw preview logs.
6. Before retaining evidence, scan `logs/gates` with `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates`; do not archive `test-results`, raw traces, raw preview logs, or unreviewed screenshots.
7. If screenshots are retained, create and validate a visual review manifest with `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots`.
8. Final reporting for the execution phase must list gates RUN and gates NOT RUN with exact reasons; do not inherit old Phase 3.6 preview/e2e/build passes as current Phase 3.62 evidence.
