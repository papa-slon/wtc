# ecosystem-tests-runner handoff
## Scope
Phase 3.42 read-only tests audit for auth rate limiting. Inspected current auth unit tests, integration/static tests, Playwright auth flows, `scripts/gates.mjs`, `secret:scan`, and generated-artifact scanner impacts. No product code or test files were edited. This handoff recommends focused tests and final gates for a follow-up implementation session.

## Files inspected
- `apps/web/src/middleware.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/session.test.ts`
- `packages/auth/src/csrf.test.ts`
- `packages/auth/src/security-headers.test.ts`
- `packages/auth/src/__smoke__.ts`
- `packages/auth/package.json`
- `packages/auth/src/index.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/session.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `vitest.config.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `.secretlintignore`
- `package.json`
- `apps/web/package.json`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/SECURITY_MODEL.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260530-1815-ecosystem-tests-runner.md`
- `docs/handoffs/20260530-2100-ecosystem-tests-runner.md`

## Files changed
None - read-only audit. This handoff file is the required audit artifact; no product code, tests, scripts, or source docs were edited.

## Findings
1. Severity: High. The pure rate-limit algorithm is covered, but the middleware-to-HTTP 429 binding is not directly tested in the current suite. Evidence: `apps/web/src/middleware.ts:77`-`apps/web/src/middleware.ts:99` is the only code that turns a blocked verdict into HTTP 429 plus `Retry-After`; `packages/auth/src/rate-limit.test.ts:24`-`packages/auth/src/rate-limit.test.ts:47` covers pure block/retry timing only; `tests/e2e/security-headers.spec.ts:30`-`tests/e2e/security-headers.spec.ts:34` explicitly does not exercise the 429 breach path; `vitest.config.ts:8`-`vitest.config.ts:9` discovers package/integration tests but excludes `apps/web/**` test files, so middleware wiring has no normal unit lane. Recommendation: add a focused `tests/integration/auth-rate-limit-middleware.test.ts` that imports `middleware` and `config`, uses `next/experimental/testing/server` matcher utilities, and calls `middleware(new NextRequest(...))` with unique `x-forwarded-for` IPs. Assert `/login` and `/register` POSTs reach 429 on request 11, `Retry-After` is present and positive, response body is generic, `/api/billing/webhook` does not match, and normal GET document headers still work through the existing E2E header test. Target part: auth rate-limit middleware tests.

2. Severity: Medium. The acceptance matrix and the active E2E policy disagree on whether 429 must be proven by Playwright. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:205`-`docs/ACCEPTANCE_MATRIX_MASTER.md:209` still lists "middleware throttle unit test + e2e 429"; `tests/e2e/security-headers.spec.ts:30`-`tests/e2e/security-headers.spec.ts:34` says the 429 path is deliberately not exercised over E2E; prior tests-runner decisions also say "Do NOT add a 429 e2e test" at `docs/handoffs/20260530-1815-ecosystem-tests-runner.md:342`-`docs/handoffs/20260530-1815-ecosystem-tests-runner.md:436` and reaffirm no burst E2E at `docs/handoffs/20260530-2100-ecosystem-tests-runner.md:600`-`docs/handoffs/20260530-2100-ecosystem-tests-runner.md:605`. Recommendation: either update the acceptance matrix in a docs-owned follow-up to require middleware integration 429 instead of normal-suite E2E 429, or add a quarantined single-spec Playwright 429 test that is excluded from the normal smoke flow until stable. Target part: acceptance criteria / test policy.

3. Severity: Medium. Current Playwright auth flows intentionally bypass the real login/register action path, so they cannot detect regressions in auth rate-limit targeting. Evidence: `playwright.config.ts:8`-`playwright.config.ts:10` documents E2E login via `/api/e2e/login`; `playwright.config.ts:28`-`playwright.config.ts:29` enables `E2E_AUTH_BYPASS`; `tests/e2e/helpers/auth.ts:5`-`tests/e2e/helpers/auth.ts:12` posts to `/api/e2e/login`; the bypass route is local/dev-only at `apps/web/src/app/api/e2e/login/route.ts:7`-`apps/web/src/app/api/e2e/login/route.ts:10`. Recommendation: keep bypass auth for normal smoke stability, but add one focused middleware integration test for the real `/login` and `/register` POST path. If an E2E proof is required, use an isolated `tests/e2e/auth-rate-limit.spec.ts` with `test.use({ trace: 'off', screenshot: 'off', video: 'off' })`, unique `x-forwarded-for`, inert invalid credentials, and no saved storage state. Target part: Playwright auth coverage.

4. Severity: Medium. Generated auth artifacts are not covered by `secret:scan` unless the separate artifact scanner is run. Evidence: `package.json:17` runs `secretlint "**/*"`; `.secretlintignore:8`-`.secretlintignore:9` excludes `test-results` and `playwright-report`; Playwright keeps screenshots/traces on failure at `playwright.config.ts:16`-`playwright.config.ts:17`; the artifact scanner defaults include those roots at `scripts/scan-lms-db-e2e-artifacts.mjs:5`; scanner rules reject demo passwords, session cookie markers, cookie headers, and authorization headers at `scripts/scan-lms-db-e2e-artifacts.mjs:39` and `scripts/scan-lms-db-e2e-artifacts.mjs:86`-`scripts/scan-lms-db-e2e-artifacts.mjs:88`. Recommendation: any new auth-rate-limit browser/API test must avoid real/demo credentials, disable trace/screenshot/video for that spec, and run `node scripts/scan-lms-db-e2e-artifacts.mjs test-results playwright-report tests/e2e/screenshots logs/gates` before accepting retained evidence. Target part: secret and artifact retention gate.

5. Severity: Low. `scripts/gates.mjs` implementation is correct for host stability, but its header comment still says `full = core + build + e2e` while the actual plan excludes E2E. Evidence: comment at `scripts/gates.mjs:13`-`scripts/gates.mjs:16`; implementation notes E2E is its own plan at `scripts/gates.mjs:43`-`scripts/gates.mjs:46`; actual `full` and `e2e` plans are separate at `scripts/gates.mjs:49`-`scripts/gates.mjs:52`. Recommendation: do not claim `node scripts/gates.mjs full` proves E2E; final acceptance must run and report `node scripts/gates.mjs e2e` separately. A later docs/script-comment cleanup can align the usage comment. Target part: gate reporting accuracy.

6. Severity: Low. The package export boundary is suitable for Edge middleware, but it should be locked by a focused regression test because importing the auth barrel would pull password hashing into the Edge bundle. Evidence: middleware imports `@wtc/auth/rate-limit` and `@wtc/auth/security-headers` at `apps/web/src/middleware.ts:31`-`apps/web/src/middleware.ts:34`; `packages/auth/package.json:8`-`packages/auth/package.json:12` exposes those subpaths; the auth barrel exports password hashing at `packages/auth/src/index.ts:15`-`packages/auth/src/index.ts:16`. Recommendation: add a static integration assertion that `apps/web/src/middleware.ts` does not import from `@wtc/auth` barrel and that the subpath exports remain present. Target part: middleware Edge-safety regression coverage.

## Decisions
1. Keep normal Playwright login helpers on `/api/e2e/login`; they are intentionally stability-first and do not prove rate limiting.
2. Prefer a deterministic integration test for middleware 429 behavior over a normal-suite burst E2E test.
3. If product sign-off still requires browser-level 429 proof, run it as a quarantined single spec with unique client IP, no real/demo credentials, traces disabled, and artifact scan after the run.
4. Treat `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` as separate final gates.
5. Do not claim "auth rate-limit live" unless the follow-up session observes a green middleware 429 test or a green isolated E2E 429 proof.

## Risks
1. Normal E2E currently proves the middleware is active for document security headers, not that auth POSTs are throttled.
2. The middleware store is module-scope and process-local. Tests must use unique IPs or reset modules to avoid cross-test contamination.
3. A Playwright 429 burst can leak request material into retained failure traces unless trace/video/screenshot are disabled for that spec and artifacts are scanned.
4. This directory is not a git worktree from the current path; no branch/commit isolation was available for this audit.
5. The SECURITY_MODEL still refers to aspirational `/api/auth/*` endpoints at `docs/SECURITY_MODEL.md:170`-`docs/SECURITY_MODEL.md:171`, while the current implementation rate-limits server-action page POSTs `/login` and `/register` at `apps/web/src/middleware.ts:5`-`apps/web/src/middleware.ts:7` and `apps/web/src/middleware.ts:38`-`apps/web/src/middleware.ts:40`. Test names and acceptance text must use current route truth.

## Verification/tests
Gates run this session:
- None. This was a read-only audit and handoff-writing pass. No live server, Playwright, Vitest, npm gate, or scanner command was run.

Gates not run this session:
- `npm test` - not run because no implementation was made and the request was an audit.
- `npm run secret:scan` - not run because no product/test source was changed; this handoff avoids secret-shaped values.
- `node scripts/gates.mjs full` - not run because this audit did not implement fixes and should not create logs as acceptance evidence.
- `node scripts/gates.mjs e2e` - not run because no browser implementation was made and normal E2E does not currently prove 429.
- `node scripts/scan-lms-db-e2e-artifacts.mjs test-results playwright-report tests/e2e/screenshots logs/gates` - not run because no new Playwright artifacts were generated.
- `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` - not relevant to auth rate limiting unless generated artifacts are reused for retention scanning.

Focused test plan for follow-up:
- Add `tests/integration/auth-rate-limit-middleware.test.ts`.
- Cover matcher: `/login` and `/register` match; `/api/billing/webhook`, static assets, and `.well-known` do not.
- Cover behavior: 10 POSTs from a unique `x-forwarded-for` are allowed; the 11th POST returns 429, `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, and a generic non-enumerating body.
- Cover dev/prod distinction: no-IP development request is not throttled; production/no-IP path falls into the `unknown` bucket. If production env mutation is needed, isolate with module reset.
- Cover Edge-safety: middleware imports only `next/server`, `@wtc/auth/rate-limit`, and `@wtc/auth/security-headers`, not `@wtc/auth`.
- Optional isolated E2E only if required: one spec, one project, unique IP, invalid inert form values, no trace/screenshot/video, and artifact scan after.

Recommended final gates after follow-up implementation:
1. `npm test -- packages/auth/src/rate-limit.test.ts tests/integration/auth-rate-limit-middleware.test.ts tests/integration/csrf-coverage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
2. `npm run secret:scan`
3. `npm run build -w @wtc/web`
4. `node scripts/gates.mjs full`
5. `node scripts/gates.mjs e2e`
6. If isolated E2E 429 is added outside the normal suite: run that spec separately, then run `node scripts/scan-lms-db-e2e-artifacts.mjs test-results playwright-report tests/e2e/screenshots logs/gates`

## Next actions
1. Implement the focused middleware integration test first; it gives the missing 429 proof without destabilizing the normal browser suite.
2. Decide whether acceptance should keep "E2E 429" as a hard requirement. If yes, add a quarantined isolated Playwright spec with artifact-retention controls. If no, update `docs/ACCEPTANCE_MATRIX_MASTER.md` in a docs-owned slice to replace normal-suite E2E 429 with middleware integration 429 plus E2E security-header smoke.
3. Update the `scripts/gates.mjs` usage comment in a separate small cleanup so `full` is not misread as including E2E.
4. Final report for the implementation session must list exact gates run and exact gates not run, with no green claims from inherited or memory evidence.
