# ecosystem-tests-runner handoff
## Scope
Phase 3.19 read-only tests-runner audit for DB-backed LMS browser acceptance hardening after Phase 3.18. The audit inspected the current protocol, status/blocker docs, Phase 3.18 aggregate, DB-backed LMS Playwright harness, runner/prep scripts, static harness test, and relevant LMS download/embed paths. It identifies the smallest remaining test/harness additions for unauthenticated and non-entitled download denial, quarantined file no-download, sanitized embed browser render, no-leak assertions, and direct-run safety. No product code was edited. No servers, Playwright runs, databases, `psql`, migrations, seeds, or live endpoints were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`
- `docs/handoffs/20260601-2350-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-2350-ecosystem-backend-implementer.md`
- `docs/handoffs/20260601-2350-ecosystem-education-implementer.md`
- `docs/handoffs/20260601-2350-ecosystem-db-architect.md`
- `tests/e2e/lms-db-materials.spec.ts`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/e2e/helpers/auth.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/repositories.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: Phase 3.18 docs still mark the actual DB-backed browser run as NOT RUN because no fresh `LMS_E2E_DATABASE_URL` was supplied (`docs/STATUS.md:14`, `docs/NEXT_ACTIONS.md:12`, `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`), and the Phase 3.18 aggregate also lists `npm run e2e:lms:db` as NOT RUN (`docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md:90`). The current spec has the requested hardening assertions, but they remain unobserved in a real Postgres-backed browser run. Recommendation: do not add more product code before the gate; run `npm run e2e:lms:db` only after creating a fresh empty `wtc_test_lms_<timestamp>` database, then archive artifacts and drop the database. Target part: LMS DB browser acceptance gate.
2. Severity: Medium. Evidence: unauthenticated and non-entitled browser download denial coverage is now present in `tests/e2e/lms-db-materials.spec.ts`: an isolated unauthenticated API request expects `401`, `no-store`, and `{ error: 'unauthenticated' }` (`tests/e2e/lms-db-materials.spec.ts:29` to `tests/e2e/lms-db-materials.spec.ts:34`), and the teacher account is used as the non-entitled user before expecting `403`, `no-store`, and `entitlement_denied` (`tests/e2e/lms-db-materials.spec.ts:138` to `tests/e2e/lms-db-materials.spec.ts:144`). `seedDatabase()` grants `education` only to the seeded regular user, not teacher/admin (`packages/db/src/seed.ts:43` to `packages/db/src/seed.ts:51`). Recommendation: no additional browser-denial scenario is required for the requested scope; the smallest strengthening is to assert the 401/403 response bodies do not contain the clean file text, base64, storage key field names, or `x-lms-sha256`. Target part: `tests/e2e/lms-db-materials.spec.ts`.
3. Severity: Medium. Evidence: quarantined file no-download coverage is now present in the DB browser spec: the teacher uploads an EICAR text fixture and expects a quarantined state without leaking the fixture text (`tests/e2e/lms-db-materials.spec.ts:100` to `tests/e2e/lms-db-materials.spec.ts:102`), and the student lesson page asserts the quarantined row is visible, says `download unavailable`, and has no `Download` link (`tests/e2e/lms-db-materials.spec.ts:121` to `tests/e2e/lms-db-materials.spec.ts:128`). Lower-level handler coverage already proves a quarantined material ID returns `404` without streaming (`tests/integration/lms-material-download-handler.test.ts:97` to `tests/integration/lms-material-download-handler.test.ts:100`). Recommendation: no new product-path harness is needed; if direct quarantined URL proof is desired, add a test-only DB lookup helper to the runner scope only, not a product route. Target part: quarantined material browser acceptance.
4. Severity: Medium. Evidence: sanitized embed browser render coverage is now present in the DB browser spec: it adds a Vimeo embed material (`tests/e2e/lms-db-materials.spec.ts:79` to `tests/e2e/lms-db-materials.spec.ts:88`), checks raw embed HTML is not rendered (`tests/e2e/lms-db-materials.spec.ts:23` to `tests/e2e/lms-db-materials.spec.ts:27`, `tests/e2e/lms-db-materials.spec.ts:105`), then checks the student iframe title and sanitized `src` (`tests/e2e/lms-db-materials.spec.ts:129` to `tests/e2e/lms-db-materials.spec.ts:130`). The page renders parsed iframe props with fixed sandbox/allow attributes (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:10` to `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:23`). Recommendation: the smallest remaining browser assertion is to add `loading`, `referrerpolicy`, `sandbox`, and no-`srcdoc` checks to the existing iframe block, then mirror those strings in `tests/integration/lms-db-e2e-harness.test.ts`. Target part: sanitized embed browser render.
5. Severity: Medium. Evidence: rendered no-leak assertions exist through `expectNoMaterialLeak`, which rejects plaintext, base64, `fileBytesBase64`, `storageKey`, and `lms/materials/` in page HTML (`tests/e2e/lms-db-materials.spec.ts:14` to `tests/e2e/lms-db-materials.spec.ts:21`), and it is called after teacher upload, on the student lesson, and in admin audit visibility (`tests/e2e/lms-db-materials.spec.ts:98`, `tests/e2e/lms-db-materials.spec.ts:102`, `tests/e2e/lms-db-materials.spec.ts:131` to `tests/e2e/lms-db-materials.spec.ts:133`, `tests/e2e/lms-db-materials.spec.ts:170` to `tests/e2e/lms-db-materials.spec.ts:171`). Recommendation: add a small helper for API denial responses, for example `expectNoDownloadLeak(response, fileText)`, and use it for 401/403/400 responses so no-leak coverage applies to both rendered HTML and failed download bodies. Target part: no-leak assertions.
6. Severity: Medium. Evidence: direct config invocation is guarded by `assertPreparedDatabaseUrl()`, the prep token, and HMAC marker checks (`playwright.lms-db.config.ts:13` to `playwright.lms-db.config.ts:25`), and the runner generates the prep token before invoking the dedicated config (`scripts/run-lms-db-e2e.mjs:12` to `scripts/run-lms-db-e2e.mjs:20`, `scripts/run-lms-db-e2e.mjs:38`). Static coverage asserts those guardrails (`tests/integration/lms-db-e2e-harness.test.ts:26` to `tests/integration/lms-db-e2e-harness.test.ts:34`). However, the default Playwright config still includes all files under `tests/e2e` (`playwright.config.ts:5`), and the DB spec only skips when `LMS_DB_E2E` is absent (`tests/e2e/lms-db-materials.spec.ts:5`), so a direct default-config run of the file can still produce an all-skipped success-like result. Recommendation: the smallest direct-run safety addition is to exclude `lms-db-materials.spec.ts` from the default `playwright.config.ts` and make the spec hard-fail outside the guarded runner, then update the static harness test to assert both facts. Target part: direct-run safety.

## Decisions
- Treat the current DB-backed LMS browser spec as structurally covering the requested denial, quarantine, embed, and rendered no-leak paths, but not accepted until `npm run e2e:lms:db` is observed green against a fresh throwaway Postgres database.
- Do not broaden Phase 3.19 into object storage, real malware scanner, signed-object redirect, production worker, Stripe, Axioma, TradingView, bot, or live-service work.
- Keep direct DB browser acceptance separate from default `npm run e2e`; the default browser gate remains demo/in-memory smoke unless explicitly changed in a later implementation phase.

## Risks
- The actual DB-backed browser acceptance command remains unrun in this audit; static and typecheck evidence cannot prove runtime browser behavior against Postgres.
- A direct default-config invocation of the DB spec can still skip rather than fail, which can be misread by an operator unless the default config excludes the DB spec or the spec hard-fails outside the guarded runner.
- The current browser embed assertions prove title/src/no-raw-HTML but do not yet explicitly assert sandbox, referrer policy, loading, or absence of `srcdoc`.
- Current no-leak assertions focus on rendered pages and admin audit HTML; failed download response bodies should get the same explicit no-leak helper.
- Production object storage, production malware scanning, signed-object redirects, quarantine cleanup, and public upload rollout remain separate blockers.

## Verification/tests
RUN:
1. Static inspection with `rg` / `Get-Content` over the requested protocol docs, status docs, Phase 3.18 handoffs, LMS DB spec, runner/config/prep scripts, static harness test, download handler, seed, and relevant LMS render paths.
2. `npm run typecheck` - PASS.
3. `npm test -- tests/integration/lms-db-e2e-harness.test.ts` - PASS, 5 tests.
4. `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck tests/e2e/lms-db-materials.spec.ts` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `npx eslint tests/e2e/lms-db-materials.spec.ts tests/integration/lms-db-e2e-harness.test.ts --max-warnings 0` - PASS.

NOT RUN:
1. `npm run e2e:lms:db` - forbidden in this read-only audit and no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied; it would mutate a database and start Playwright.
2. `npm run e2e`, `npx playwright test`, and `node scripts/gates.mjs e2e` - forbidden by the no server/Playwright instruction.
3. `node scripts/gates.mjs full` - skipped because it includes broad gates outside this read-only audit and would not prove the unrun DB browser gate.
4. `psql`, `npm run db:migrate`, `npm run db:seed`, direct migrations, direct seeds, DB setup/drop, or any database mutation - forbidden by scope.
5. Live Stripe, Axioma, TradingView, bot/exchange, preview/production server, SSH, tmux, systemd, object storage, malware scanner, or worker deployment commands - forbidden/out of scope.

## Next actions
1. In the next implementation phase, add direct-run safety by excluding `lms-db-materials.spec.ts` from default `playwright.config.ts`, making the DB spec hard-fail outside the guarded runner, and extending `tests/integration/lms-db-e2e-harness.test.ts` to assert both safeguards.
2. Add the smallest browser assertions for sanitized iframe attributes: `loading="lazy"`, `referrerpolicy="no-referrer"`, expected `sandbox`, and no `srcdoc`.
3. Add a failed-download no-leak helper and apply it to the unauthenticated, non-entitled, and malformed-ID response bodies.
4. After those small harness/test edits, run focused static tests and typecheck, then run `npm run e2e:lms:db` only with a fresh empty `wtc_test_lms_<timestamp>` Postgres URL, archive artifacts, and drop the DB.
