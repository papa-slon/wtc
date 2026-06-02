# Phase 3.59 existing-bot LMS DB acceptance handoff
## Scope
Run one credentialed acceptance gate: LMS DB browser managed acceptance using the operator-identified local existing-bot Postgres settings from `C:\Users\maxib\GTE BOT\bot\.env`, without printing credential values. This phase also fixed issues discovered by that live acceptance path: Windows `.cmd` child process spawning, Node 24 strip-only TypeScript syntax, Playwright selector strictness, false page-content leak assertions, incorrect retained screenshot target, mobile lesson-page overflow, and repo lint scope for generated `.next-e2e-db` output.

Out of scope: real-PG managed proof, audit append-only role proof, live S3/R2 object storage, live external scanner, Stripe, Axioma live acceptance, preview/live smoke, SSH/nginx/systemd, bot service control, deploy, GitHub CI, and production monitoring.

## Agents
- [`docs/handoffs/20260602-1714-ecosystem-security-auditor.md`](20260602-1714-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1714-ecosystem-tests-runner.md`](20260602-1714-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1714-ecosystem-devops-implementer.md`](20260602-1714-ecosystem-devops-implementer.md)

All spawned agents were closed before final reporting.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_58_20260602.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `package.json`, `eslint.config.js`, `playwright.lms-db.config.ts`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/prepare-lms-db-e2e.ts`, `scripts/redacted-child-process.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/check-retained-visual-artifacts.mjs`, `tests/e2e/lms-db-materials.spec.ts`, `tests/e2e/helpers/auth.ts`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`, `packages/lms/src/index.ts`, `packages/tradingview-access/src/index.ts`, and adjacent bot `.env` key names/status only.

## Files changed
- `scripts/redacted-child-process.mjs`
- `tests/integration/child-output-redaction.test.ts`
- `packages/lms/src/index.ts`
- `packages/tradingview-access/src/index.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `eslint.config.js`
- `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json`
- `docs/handoffs/20260602-1714-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1714-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1714-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`
- status docs updated for Phase 3.59

Retained artifact updated by the final passing run:
- `tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png`

## Findings
1. Severity: High. The existing `bot\.env` source had enough Postgres fields and the role could connect and create databases; values were never printed. Fix: the operator built `LMS_E2E_ADMIN_DATABASE_URL` only in-process and removed it after each run.
2. Severity: High. `spawnSync('npm.cmd', ..., shell:false)` fails with `EINVAL` on this Windows host. Fix: `scripts/redacted-child-process.mjs` now routes `.cmd`/`.bat` shims through `cmd.exe /d /s /c` while keeping output redacted and captured.
3. Severity: High. Node 24 strip-only mode refused TypeScript parameter properties in direct TS imports. Fix: `LmsService` and `TvAccessService` now use explicit private fields plus constructor assignment.
4. Severity: Medium. The LMS DB browser spec used a strict global text selector that matched both the lesson heading and the lesson `<option>`. Fix: the spec checks the visible lesson title in the `strong` lesson row.
5. Severity: Medium. The spec's leak helper inspected full `page.content()`, which includes Next dev RSC/source payload strings. Fix: UI leak checks now inspect visible body text, while HTTP response/header no-leak checks remain strict.
6. Severity: High. The retained screenshot path was named as a lesson screenshot but captured `/app` after a session-switching login helper. Fix: the spec saves the lesson URL, returns to it before the mobile screenshot, and proves the heading is visible.
7. Severity: High. The corrected lesson screenshot exposed a real mobile overflow bug caused by an embed iframe rendered as a `width:100%` flex sibling in `.wtc-spread`. Fix: the material row now stacks its embed below the title/action row, and the iframe has `display:block`, `maxWidth:100%`, and `minWidth:0`.
8. Severity: Medium. Root `npm run lint` inspected generated Next output under `apps/web/.next-e2e-db`, creating thousands of false lint errors from webpack artifacts. Fix: `eslint.config.js` now ignores `**/.next-e2e-db/**`, matching the generated e2e build output already ignored by `.gitignore`.

## Decisions
- Treat the LMS DB browser gate as RUN/PASS only from the final managed run after the screenshot/layout fix.
- Keep previous failed attempts as debugging, not acceptance evidence.
- Keep only the final retained screenshot plus its visual review manifest as reviewed image evidence.
- Continue reporting all other credentialed/live gates as NOT RUN.
- Do not claim git/branch/PR/GitHub CI readiness because `git rev-parse --show-toplevel` still reports this root is not git-backed.

## Risks
- The Postgres credential used here is powerful enough to create/drop databases; future phases must keep scope single-purpose and avoid broad DB inspection.
- Existing generated screenshot folders contain historical images; visual acceptance was run against the specific retained LMS DB screenshot file, not every historical image in `tests/e2e/screenshots`.
- This pass proves LMS DB browser upload/download/embed behavior in the local managed throwaway Postgres path; it does not prove live object storage, live external scanner, public upload rollout, production deploy, or CI.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| Required protocol/docs read | `Get-Content`/`rg` over protocol, blocker, and runbook files | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |
| Adjacent bot Postgres suitability | key-name-only parse + status-only connection/create-db probe | PASS; values not printed |
| Redacted child runner syntax/focused tests | `node --check scripts/redacted-child-process.mjs`; `npm test -- tests/integration/child-output-redaction.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/real-pg-managed-runner-safety.test.ts` | PASS (`29` passed) |
| Strip-only import smoke | `node --experimental-strip-types -e "await import('./packages/lms/src/index.ts'); await import('./packages/tradingview-access/src/index.ts')"` | PASS |
| LMS focused regression | `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/child-output-redaction.test.ts` | PASS (`21` passed) |
| Web typecheck | `npm run typecheck -w @wtc/web` | PASS |
| Root typecheck | `npm run typecheck` | PASS |
| Managed LMS DB browser acceptance | `npm run e2e:lms:db:managed` with in-process URL from `C:\Users\maxib\GTE BOT\bot\.env` | PASS; final run created `wtc_test_lms_20260602101117_cc7889`, Playwright `2 passed`, artifact scanner PASS, DB dropped |
| Retained visual review | `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png` | PASS (`1` image reviewed) |
| Root lint | `npm run lint` | PASS |
| Secret scan | `npm run secret:scan` | PASS |
| Governance check | `npm run governance:check` | PASS; `0` errors, `1` known historical warning |

Gates NOT RUN: `npm run preview:safe`, default `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, root `npm test`, `npm run build -w @wtc/web`, `npm run accept:real-pg:managed`, manual `REAL_POSTGRES_DATABASE_URL` harness, `npm run accept:audit:append-only-role`, live LMS object-store preflight, live LMS external-scanner preflight, real Stripe checkout/webhook replay, live Axioma endpoint/account-link/download acceptance, preview/prod DB migration or seed, SSH/nginx/systemd/server checks, bot services/control, GitHub CI execution, deploy, and production monitoring.

## Next actions
1. Next single-purpose credentialed phase should be one of: active real-PG managed proof, append-only audit DB-role proof, live LMS object-store, live LMS external scanner, Stripe, Axioma, preview smoke, GitHub CI, or deploy/server checks.
2. Do not rerun LMS DB browser acceptance unless the LMS DB path or lesson material rendering changes, or the operator explicitly requests fresh proof.
