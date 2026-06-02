# ecosystem-tests-runner handoff
## Scope
Phase 3.21 read-only tests-runner audit of the current LMS DB-backed browser acceptance spec and integration tests after Phase 3.20.

Focus areas:
- failed-download no-leak assertions
- admin audit metadata no-leak assertions
- sanitized iframe attribute assertions
- default-gate isolation for the opt-in LMS DB browser gate

No product code, tests, scripts, servers, Playwright runs, database commands, migrations, seeds, live endpoints, or external services were touched. This handoff is the only file written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`
- `docs/handoffs/20260602-0023-ecosystem-tests-runner.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts:58`-`71` defines failed-download body/header no-leak checks, `tests/e2e/lms-db-materials.spec.ts:74`-`80` applies them to unauthenticated download, `tests/e2e/lms-db-materials.spec.ts:198`-`205` applies them to teacher entitlement denial, and `tests/e2e/lms-db-materials.spec.ts:218`-`221` applies them to malformed material ID. The lower-level quarantined direct-download integration path still only checks status/body shape at `tests/integration/lms-material-download-handler.test.ts:97`-`100`, without asserting headers/body omit uploaded bytes, base64, filename, sha256, storage keys, `content-disposition`, `x-lms-sha256`, or matching content length. Recommendation: extend the handler integration 404/quarantined and not-found download paths with the same no-leak expectations used by the browser spec. Target part: failed-download no-leak integration coverage.
2. Severity: Medium. Evidence: the browser spec expanded internal metadata markers at `tests/e2e/lms-db-materials.spec.ts:10`-`21` and checks admin audit UI at `tests/e2e/lms-db-materials.spec.ts:232`-`234`; the static harness now pins the browser helper/marker presence at `tests/integration/lms-db-e2e-harness.test.ts:63`-`64` and `tests/integration/lms-db-e2e-harness.test.ts:83`-`85`. However the artifact scanner forbidden list at `scripts/scan-lms-db-e2e-artifacts.mjs:13`-`34` still only covers the older marker set and does not include `contentSha256`, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, `deletedAt`, or `hasStorageKey`; the scanner test at `tests/integration/lms-db-e2e-artifact-scan.test.ts:34`-`41` likewise does not exercise those expanded metadata markers. Recommendation: mirror the browser spec's `INTERNAL_MATERIAL_MARKERS` into the artifact scanner and add a scanner fixture that fails on those metadata names in generated text artifacts. Target part: admin audit metadata artifact no-leak coverage.
3. Severity: Low. Evidence: runtime browser coverage for sanitized iframe attributes exists in `tests/e2e/lms-db-materials.spec.ts:82`-`89`, including `src`, `sandbox`, `referrerpolicy`, `loading`, `allow`, `srcdoc` absence, and `allowFullscreen`; the student lesson renderer emits those attributes at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:14`-`21`. The static default-gate harness only pins helper presence plus selected strings at `tests/integration/lms-db-e2e-harness.test.ts:79`-`82`, and does not explicitly pin `EXPECTED_IFRAME_ALLOW`, `loading`, or `allowFullscreen`. Recommendation: add static assertions for those exact attribute checks so default tests protect the browser spec while the DB Playwright gate remains opt-in. Target part: sanitized iframe default-gate coverage.
4. Severity: Low. Evidence: default-gate isolation is currently preserved: `package.json:27` keeps default `e2e` as `playwright test`, `package.json:28` keeps `e2e:lms:db` as a dedicated opt-in runner, `package.json:31` keeps `ci:local` free of `e2e:lms:db`, `scripts/gates.mjs:43`-`52` keeps full and e2e plans separate, and `tests/integration/lms-db-e2e-harness.test.ts:95`-`102` pins those expectations. Recommendation: keep future assertions in static Vitest and the opt-in runner; do not add `e2e:lms:db` to default `e2e`, `ci:local`, or `node scripts/gates.mjs full`. Target part: default-gate isolation.

## Decisions
- Treat the current on-disk files as source of truth for this audit; the workspace at this cwd is not git-backed, so no git diff baseline was available.
- Do not run any browser, server, database, migration, seed, or live-service gate.
- Do not edit product code, tests, scripts, or docs other than this one handoff.
- Keep `npm run e2e:lms:db` as an opt-in DB-backed browser acceptance gate only.

## Risks
- No runtime proof was collected in this session because Playwright, servers, DB, psql, migrations, seeds, and endpoints were forbidden.
- The artifact scanner can still pass generated text artifacts that contain the expanded admin/material metadata marker names listed in the current browser spec.
- Without git metadata in this cwd, this audit cannot distinguish Phase 3.20 baseline from concurrent local edits; findings are based on the current file contents inspected in this session.

## Verification/tests
RUN:
1. Static/source inspection only with `Get-Content`, `rg`, `Select-String`, and `Test-Path`.
2. Confirmed `docs/handoffs/20260602-0047-ecosystem-tests-runner.md` did not exist before writing.
3. Confirmed `git status --short` is unavailable from this cwd because it is not a git repository.

NOT RUN:
1. `npm run e2e:lms:db` - forbidden by scope; would start Playwright/web server flow and mutate a throwaway database.
2. `npx playwright test`, `npm run e2e`, or any browser/server-starting gate - forbidden by scope.
3. `psql`, migrations, seeds, DB create/drop, or any database mutation - forbidden by scope.
4. `npm test`, lint, typecheck, `node scripts/gates.mjs full`, or `node scripts/gates.mjs e2e` - not run because this was a read-only audit with no implementation.
5. Live Stripe, Axioma, TradingView, bot/exchange, object storage, malware scanner, preview/prod endpoint, SSH, tmux, systemd, or external service operations - out of scope and not touched.

## Next actions
1. Extend `tests/integration/lms-material-download-handler.test.ts` so quarantined/not-found download failures assert no leaked bytes/base64, filename, sha256, storage keys, success-only headers, or matching content length.
2. Extend `scripts/scan-lms-db-e2e-artifacts.mjs` and `tests/integration/lms-db-e2e-artifact-scan.test.ts` with the browser spec's expanded material metadata marker list.
3. Extend `tests/integration/lms-db-e2e-harness.test.ts` to statically pin `EXPECTED_IFRAME_ALLOW`, `loading`, and `allowFullscreen` checks while preserving default-gate isolation.
4. In a separate execution phase with a fresh throwaway `LMS_E2E_DATABASE_URL`, run `npm run e2e:lms:db`, confirm the scanner passes, archive only redacted evidence, and drop the throwaway DB.
