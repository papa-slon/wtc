# ecosystem-backend-implementer handoff
## Scope
Phase 3.19 read-only backend audit for LMS material download/auth/entitlement boundaries and DB-backed e2e setup after Phase 3.18. Inspected the material-download handler, route adapter, session/access/e2e login path, seedDatabase demo users/products/access, DB material repositories, student material mapping, and the LMS DB e2e harness. No product code was edited. No servers, Playwright, database commands, psql, migrations, seeds, or live endpoints were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`
- `docs/handoffs/20260601-2350-ecosystem-backend-implementer.md`
- `package.json`
- `apps/web/package.json`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `tests/e2e/lms-db-materials.spec.ts:164` closes the DB-backed browser test, but `tests/e2e/lms-db-materials.spec.ts:165` to `tests/e2e/lms-db-materials.spec.ts:216` contains orphaned duplicate top-level code from the older happy-path flow. Recommendation: remove the orphaned block, then run parser/type/e2e gates before accepting Phase 3.18's DB-backed browser harness. Target part: `tests/e2e/lms-db-materials.spec.ts`.

2. Severity: Medium. Evidence: the backend handler now has the intended fail-closed order: method check, UUID validation, session requirement, education entitlement check, DB presence, clean-file lookup, audit, then bytes (`apps/web/src/features/lms/material-download.ts:47` to `apps/web/src/features/lms/material-download.ts:66`); the route adapter passes `requireUser`, `accessFor`, and `reasonLabel` directly (`apps/web/src/app/api/education/materials/[materialId]/download/route.ts:9` to `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:16`). However the browser acceptance file cannot be trusted until Finding 1 is fixed, and the focused handler test only asserts status codes for unauthenticated/denied/null DB (`tests/integration/lms-material-download-handler.test.ts:91` to `tests/integration/lms-material-download-handler.test.ts:95`). Recommendation: after repairing the spec, keep explicit browser/API assertions for unauthenticated `401`, non-entitled `403`, `cache-control: no-store`, exact JSON bodies, and no response bytes. Target part: LMS material download tests.

3. Severity: Medium. Evidence: the DB repository excludes quarantined, failed, deleted, unpublished-lesson, and unpublished-course file rows from download by requiring `kind='file'`, `scanStatus='clean'`, `deletedAt IS NULL`, published lesson, and published course (`packages/db/src/repositories.ts:787` to `packages/db/src/repositories.ts:813`). The handler test asserts quarantined status returns `404` (`tests/integration/lms-material-download-handler.test.ts:97` to `tests/integration/lms-material-download-handler.test.ts:101`), and the browser spec asserts a quarantined material has no Download link (`tests/e2e/lms-db-materials.spec.ts:118` to `tests/e2e/lms-db-materials.spec.ts:121`). Recommendation: strengthen the handler test to prove quarantined/deleted misses write no `education.material_download` audit row and stream no body; if browser-level direct `404` is required, add a safe fixture or selector path that can obtain the quarantined material id without exposing storage keys or bytes. Target part: quarantined/deleted material download coverage.

4. Severity: Medium. Evidence: success audit records metadata only, not `fileBytesBase64` or `storageKey` (`packages/db/src/repositories.ts:833` to `packages/db/src/repositories.ts:850`), and the student material mapper exposes download URL and safe metadata but not DB byte/storage fields (`apps/web/src/features/lms/queries.ts:64` to `apps/web/src/features/lms/queries.ts:81`). The browser spec contains no-leak helpers and page/admin assertions (`tests/e2e/lms-db-materials.spec.ts:14` to `tests/e2e/lms-db-materials.spec.ts:21`, `tests/e2e/lms-db-materials.spec.ts:158` to `tests/e2e/lms-db-materials.spec.ts:163`), but those assertions remain unaccepted while the file is syntactically polluted. Recommendation: keep those no-leak assertions after fixing the spec and add focused failure-path no-leak assertions for 401/403/404/error JSON and audit rows. Target part: audit/no-leak coverage.

5. Severity: Low. Evidence: `seedDatabase` creates admin, teacher, and user accounts (`packages/db/src/seed.ts:27` to `packages/db/src/seed.ts:41`), and only the regular seeded user receives the `education` entitlement (`packages/db/src/seed.ts:43` to `packages/db/src/seed.ts:51`). The current browser negative uses teacher login for the `403` case (`tests/e2e/lms-db-materials.spec.ts:132` to `tests/e2e/lms-db-materials.spec.ts:136`), which proves non-entitlement but also changes role. Recommendation: for a cleaner entitlement-only regression, create or revoke a regular user without `education` in the throwaway setup and assert that user gets `403` for the captured download href. Target part: `scripts/prepare-lms-db-e2e.ts` and/or DB e2e spec setup.

6. Severity: Low. Evidence: the e2e login bypass is fenced to non-production, `E2E_AUTH_BYPASS=1`, and localhost/loopback hosts (`apps/web/src/app/api/e2e/login/route.ts:5` to `apps/web/src/app/api/e2e/login/route.ts:10`); the DB harness uses a random prep token and guarded throwaway URL (`scripts/run-lms-db-e2e.mjs:12` to `scripts/run-lms-db-e2e.mjs:28`), refuses non-`wtc_test*` and non-empty schemas (`scripts/prepare-lms-db-e2e.ts:17` to `scripts/prepare-lms-db-e2e.ts:42`), and the Playwright config validates the prep marker before starting (`playwright.lms-db.config.ts:13` to `playwright.lms-db.config.ts:25`). Recommendation: keep the harness local-only and do not accept direct Playwright invocation or any run against non-throwaway DB names. Target part: DB-backed e2e setup.

## Decisions
- Treat `apps/web/src/features/lms/material-download.ts` as the current backend boundary for LMS file downloads; no product-code change is required before the test cleanup in Finding 1.
- Keep `npm run e2e:lms:db` as the only acceptable DB-backed LMS browser entry point because it prepares a throwaway DB, seeds demo users, disables live controls, and starts an isolated local server.
- Do not add live object storage, malware scanner calls, psql setup, or Playwright execution in this read-only lane.
- Do not count Phase 3.18 DB-backed browser acceptance as accepted from this audit; the current spec file needs cleanup and a real throwaway-DB run.

## Risks
- Current tree evidence contradicts a clean DB-backed browser acceptance claim because `tests/e2e/lms-db-materials.spec.ts` has orphaned duplicate code after the test body.
- The handler appears fail-closed for 401/403/400/404 cases, but the browser harness is not authoritative until it parses and runs against a fresh DB.
- Failure-path audit/no-leak behavior is only partially asserted; future regressions could add bytes/storage keys to error paths or audit rows without the current focused tests catching every case.
- Local DB byte storage and deterministic scan behavior remain acceptance scaffolding, not production object storage or production malware scanning.

## Verification/tests
- Static inspection only.
- Not run: `npm test`, focused Vitest, `npm run typecheck`, `npm run build`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run e2e:lms:db`, Playwright, `psql`, migrations, seeds, DB setup/drop, or live endpoint checks. Reason: this lane was explicitly read-only and forbade servers, Playwright, DB/psql, and live endpoints.
- Not touched: product code, application docs outside this handoff, live Stripe/Axioma/TradingView/bot/exchange integrations, SSH, tmux, systemd, object storage, malware scanners, preview, or production services.

## Next actions
1. Remove the orphaned duplicate block from `tests/e2e/lms-db-materials.spec.ts:165` to `tests/e2e/lms-db-materials.spec.ts:216`.
2. Run focused parser/type checks and the standard gates after the spec cleanup.
3. Extend focused handler tests to assert exact 401/403/404 bodies, no-store headers, no bytes, and no success audit rows on denied/quarantined/deleted paths.
4. Add a regular non-entitled user path for the DB browser `403` assertion, or explicitly document that the teacher account is the non-entitled actor.
5. Run `npm run e2e:lms:db` only with a fresh empty `wtc_test_lms_<timestamp>` Postgres database, archive artifacts, and drop the database afterward.
