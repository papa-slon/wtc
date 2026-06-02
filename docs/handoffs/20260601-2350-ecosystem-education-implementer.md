# ecosystem-education-implementer handoff
## Scope
Phase 3.18 read-only audit for the LMS education lane. Scope was to inspect AGENTS/session protocol, latest LMS status and handoffs, LMS actions/queries/pages, e2e auth helpers, seed/demo data, and material upload/download flows, then determine what DB-backed browser acceptance must seed or create for an honest teacher course/lesson/material -> student lesson/download proof.

No servers, Playwright, database mutation, `psql`, live endpoints, live services, Stripe, Axioma, TradingView, bot/exchange services, SSH, tmux, systemd, or preview-worker commands were run. This is a single requested per-agent handoff; no N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `docs/handoffs/20260601-2303-ecosystem-education-implementer.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `package.json`
- `apps/web/package.json`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/lms/src/materials.ts`
- `packages/audit/src/audit.ts`

## Files changed
None - read-only audit

## Findings
1. High - The DB-backed LMS browser acceptance path now has the right local-only scaffolding, but it is not accepted until a fresh throwaway DB run is observed green. Evidence: the root script exposes `e2e:lms:db` (`package.json:27-28`), the runner requires `LMS_E2E_DATABASE_URL` or `REAL_POSTGRES_DATABASE_URL`, sets `DATABASE_URL`, runs DB preparation, then runs `playwright.lms-db.config.ts` (`scripts/run-lms-db-e2e.mjs:5-33`), and the DB config targets only `lms-db-materials.spec.ts` on port 3101 (`playwright.lms-db.config.ts:5-24`). The prep script refuses non-`wtc_test*` database names, refuses non-empty schemas, applies all SQL migrations, and seeds demo data (`scripts/prepare-lms-db-e2e.ts:23-47`). Recommendation: treat `npm run e2e:lms:db` as the future gate, but mark it NOT RUN until an operator provides a fresh throwaway DB URL and the full command passes. Target part: LMS DB-backed browser gate.

2. High - The seed provides only foundation data, so honest acceptance must create the lesson and material through the teacher browser UI. Evidence: `seedDatabase()` creates roles/products/plans/demo users, grants the student active `education`, and creates only a published teacher course named `Risk Management Fundamentals` (`packages/db/src/seed.ts:14-63`); it does not seed lessons or materials. The teacher UI supports course creation (`apps/web/src/app/teacher/courses/page.tsx:37-45`), lesson creation/publishing (`apps/web/src/app/teacher/courses/[id]/page.tsx:114-124`, `apps/web/src/app/teacher/courses/[id]/page.tsx:181-186`), file/embed/link material creation (`apps/web/src/app/teacher/courses/[id]/page.tsx:232-253`), and the server actions enforce CSRF, teacher RBAC, ownership, Zod parsing, sanitized embed/file preparation, and repo writes (`apps/web/src/features/lms/actions.ts:135-147`, `apps/web/src/features/lms/actions.ts:279-292`, `apps/web/src/features/lms/actions.ts:344-380`). Recommendation: keep the browser spec creating a unique course, lesson, and clean file material via teacher forms instead of pre-seeding those rows directly, because that exercises CSRF/RBAC/ownership/action wiring. Target part: teacher setup and data creation.

3. High - Student verification must prove DB mode and entitlement-backed access, not the old demo fallback. Evidence: backend selection switches to Postgres only when `DATABASE_URL` is present (`apps/web/src/lib/backend.ts:20-24`, `apps/web/src/lib/backend.ts:35-47`); the e2e helper logs in via `/api/e2e/login` (`tests/e2e/helpers/auth.ts:5-17`), and that route is dev-only behind `E2E_AUTH_BYPASS` before creating a real session cookie (`apps/web/src/app/api/e2e/login/route.ts:5-25`). The student seed has active `education` access (`packages/db/src/seed.ts:43-51`), while student course and lesson pages fail closed in demo or without access (`apps/web/src/app/(app)/app/education/[courseId]/page.tsx:13-35`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:36-60`). The current DB spec logs in as the student, asserts `storage: Postgres`, opens the created course/lesson, and sees the material (`tests/e2e/lms-db-materials.spec.ts:60-70`). Recommendation: keep explicit `storage: Postgres` assertions and do not accept any run that falls back to `storage: in-memory`. Target part: student access honesty.

4. High - The download proof must verify the server boundary from the entitled student session, not just the presence of a material row. Evidence: material DTOs expose `downloadUrl` only for clean file rows (`apps/web/src/features/lms/queries.ts:64-80`), the student lesson page shows `Download` only when that URL exists (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:141-157`), the route handler requires GET, session, active education entitlement, configured DB, published/clean file lookup, strict response headers, and download audit (`apps/web/src/features/lms/material-download.ts:43-61`), and the DB lookup returns a file only when kind is `file`, `scan_status = 'clean'`, `deleted_at IS NULL`, course and lesson are published, bytes match `size_bytes`, and SHA-256 matches (`packages/db/src/repositories.ts:787-813`). The current spec obtains the UI href through the student page and checks status, cache-control, content type, content disposition, and body bytes via the page request context (`tests/e2e/lms-db-materials.spec.ts:72-79`). Recommendation: strengthen this proof with assertions for `x-content-type-options`, `x-lms-sha256`, and absence of `storage_key`/`lms/materials/` in rendered DOM, and optionally add a real browser `download` click event assertion. Target part: student material download acceptance.

5. Medium - Negative browser coverage is still missing for quarantined files and sanitized embeds. Evidence: current browser coverage is one clean-file happy path (`tests/e2e/lms-db-materials.spec.ts:13-90`). Integration tests already prove repository/handler behavior for clean file, quarantined file denial, and sanitized embed material round-trip (`tests/integration/db-lms-ph3-1.test.ts:112-130`, `tests/integration/lms-material-download-handler.test.ts:75-100`), but those are not browser acceptance. The teacher UI can submit embed materials and file materials (`apps/web/src/app/teacher/courses/[id]/page.tsx:247-251`), and the student page renders sanitized embed frames and hides unavailable file downloads (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:106-110`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:155-157`). Recommendation: add either a second DB browser test or extend the current serial test to upload an EICAR text fixture and verify no Download link, plus add a sanitized YouTube/Vimeo embed material or lesson and verify iframe rendering without raw HTML. Target part: browser coverage gaps.

6. Medium - The DB-backed Playwright projects share one prepared database, so test data must remain project-unique and non-order-dependent. Evidence: the runner prepares the DB once before invoking Playwright (`scripts/run-lms-db-e2e.mjs:26-33`), the config runs desktop and mobile projects against the same `DATABASE_URL` (`playwright.lms-db.config.ts:18-37`), and the spec uses serial mode plus a project/timestamp suffix for course, lesson, material, and file names (`tests/e2e/lms-db-materials.spec.ts:4-19`). Recommendation: keep unique names per project/test and avoid assertions that assume the DB contains only one course, one lesson, or one audit event after the first project has run. If more tests are added, isolate by generated title/material text or reset the throwaway DB per project. Target part: LMS DB e2e isolation.

7. Medium - The teacher file action still reads the full upload into memory before the 5 MB size check in `@wtc/lms`, so browser acceptance should keep fixtures tiny and the next implementation should add a preflight size guard. Evidence: `fileMaterialFromForm()` checks only missing/zero-size file before `await file.arrayBuffer()` (`apps/web/src/features/lms/actions.ts:122-128`), while `normalizeLmsFileUpload()` enforces `LMS_MAX_FILE_BYTES` after bytes are already present (`packages/lms/src/materials.ts:101-107`). Recommendation: add `file.size > LMS_MAX_FILE_BYTES` preflight in the server action before reading the buffer, and keep the pure byte-size check as a backstop. Target part: LMS upload safety.

## Decisions
- DB-backed browser acceptance should run only through the local throwaway Postgres path, not default demo e2e. The intended command is `npm run e2e:lms:db` after setting `LMS_E2E_DATABASE_URL` to an empty database named `wtc_test` or `wtc_test_<suffix>`.
- Seed data should remain foundational: roles, product/plan catalog, demo users, active student education entitlement, and one sample course. The browser spec should create its own course/lesson/material through teacher pages so the acceptance covers UI, CSRF, RBAC, ownership, repository writes, and revalidation.
- The student half should use `user@wtc.local` because seed grants it active `education`; teacher/admin roles are not substitutes for student entitlement proof.
- A small clean `text/plain` file is the right first browser fixture because the current upload policy allows it and it avoids browser/MIME ambiguity. Future negative coverage should add an EICAR text fixture and a sanitized embed fixture.
- This remains local DB-byte acceptance only. It must not be presented as production object storage, production malware scanning, signed-object redirect, or public upload rollout readiness.

## Risks
- This audit did not execute the DB-backed e2e command, so current acceptance is a design/static-read verdict only.
- The current DB spec uses `page.request.get()` from the browser context after extracting the student-visible href. That is much stronger than a repository call, but a click/download event assertion would better prove browser download behavior.
- Action validation failures usually return silently, so the browser spec must assert each created entity and status after every submit; otherwise a bad MIME, invalid iframe, or missing lesson select can false-pass into later generic page assertions.
- Shared DB across desktop/mobile projects can pollute audit-log and list-order assumptions unless every assertion is scoped to the generated course/material text.
- Real object storage, production malware scanning, signed-object redirects, and real Postgres race/production acceptance remain separate gates.

## Verification/tests
RUN:
- Read-only source and documentation inspection using `rg`, `Get-Content`, and `Test-Path`.
- Confirmed current LMS DB browser scaffold exists: `package.json` has `e2e:lms:db`, `apps/web/package.json` has `dev:e2e:db`, `playwright.lms-db.config.ts` targets `lms-db-materials.spec.ts`, and the spec currently creates teacher course/lesson/material then verifies student download response.

NOT RUN:
- `npm run e2e:lms:db` - skipped by explicit request not to start servers, run Playwright, or mutate databases.
- `npm run e2e` - skipped by explicit request not to start servers or run Playwright.
- `npm run db:migrate`, `npm run db:seed`, `scripts/prepare-lms-db-e2e.ts`, and any `psql` command - skipped by explicit request not to mutate databases or call psql.
- Live endpoints/services - skipped by explicit request and phase safety rules.
- Background agents - none spawned; none left running.

## Next actions
1. Operator provides a fresh empty throwaway Postgres URL named `wtc_test` or `wtc_test_<suffix>`, sets `LMS_E2E_DATABASE_URL`, then runs `npm run e2e:lms:db`.
2. If the gate fails, fix only the LMS DB e2e harness/spec or product path responsible for the failure; do not broaden into object storage, real malware scanner, or signed-object redirects in the same slice.
3. Strengthen `tests/e2e/lms-db-materials.spec.ts` before calling the path fully accepted: assert `x-content-type-options`, `x-lms-sha256`, no rendered storage key, and preferably a Playwright download event in addition to `page.request.get()`.
4. Add DB-backed browser negative coverage for quarantined file upload/no-download and sanitized embed render, using generated per-project titles so desktop/mobile do not collide.
5. Add a preflight `file.size > LMS_MAX_FILE_BYTES` guard before `arrayBuffer()` in `createMaterialAction`.
6. The aggregate Phase 3.18 handoff should cite this per-agent file and list `npm run e2e:lms:db` as RUN only after an observed green run; otherwise it remains NOT RUN with the reason.
