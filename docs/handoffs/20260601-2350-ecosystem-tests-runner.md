# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.18 test-runner audit to identify the safest bounded implementation for DB-backed LMS browser acceptance proving teacher upload -> student download against Postgres without touching live services. Discovery inspected the current protocol, blocker/status docs, Playwright harness, e2e auth bypass, LMS browser specs, LMS server actions/routes, LMS query mappings, pure LMS material policy, DB material persistence/download gates, and focused LMS tests. No servers, Playwright runs, databases, psql, live endpoints, or live services were touched.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `docs/handoffs/20260601-2303-ecosystem-tests-runner.md`
- `playwright.config.ts`
- `scripts/gates.mjs`
- `package.json`
- `apps/web/package.json`
- `tests/e2e`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/lms.test.ts`
- `packages/lms/src/types.ts`
- `packages/db/package.json`
- `packages/db/src/seed.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-fixes.test.ts`
## Files changed
None - read-only audit
## Findings
1. Severity: P0 bounded-acceptance gap. Evidence: current blockers say LMS local DB-backed bytes, MIME sniffing, scan/quarantine metadata, retention timestamps, soft-delete visibility, entitlement-checked downloads, and stored iframe sanitizer are built and PGlite-tested, but DB-backed browser acceptance remains open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`). STATUS repeats that DB-backed browser upload/download acceptance is still not production-ready (`docs/STATUS.md:15`, `docs/STATUS.md:16`). Phase 3.17 explicitly lists future DB-backed Playwright acceptance as the next action (`docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:70`, `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:71`). Recommendation: implement only an opt-in DB-backed LMS Playwright harness and one spec proving teacher upload -> student download against a guarded throwaway Postgres database. Target part: `playwright.lms-db.config.ts`, a safe e2e DB bootstrap/server script, and `tests/e2e/lms-materials-db.spec.ts`.
2. Severity: P0 safety constraint. Evidence: protocol requires read-only discovery and says never stop/restart/modify live servers/bots/secrets; entitlements fail closed (`AGENTS.md:74`, `AGENTS.md:76`, `AGENTS.md:82`; `docs/SESSION_PROTOCOL.md:81`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:85`). The existing real-PG harness proves the right safety pattern: it refuses any DB name not matching `wtc_test` or `wtc_test_<suffix>` before connecting (`tests/integration/db-real-postgres.test.ts:41`, `tests/integration/db-real-postgres.test.ts:47`, `tests/integration/db-real-postgres.test.ts:54`, `tests/integration/db-real-postgres.test.ts:57`, `tests/integration/db-real-postgres.test.ts:71`). Recommendation: the DB-backed browser harness must require a dedicated env var such as `LMS_DB_E2E_DATABASE_URL`, validate the database name with the same guard before any connection, and never fall back to `DATABASE_URL` implicitly. Target part: e2e bootstrap script/helper.
3. Severity: P1 current default e2e cannot prove the goal. Evidence: Playwright runs one in-memory dev server on port 3100 with `E2E_AUTH_BYPASS=1`, mock bot mode, live bot control off, TV automation off, and no `DATABASE_URL` (`playwright.config.ts:23`, `playwright.config.ts:24`, `playwright.config.ts:28`, `playwright.config.ts:29`, `playwright.config.ts:30`, `playwright.config.ts:31`, `playwright.config.ts:32`, `playwright.config.ts:33`, `playwright.config.ts:34`, `playwright.config.ts:35`). The LMS mobile e2e states teacher editor and DB-backed detail are out of e2e reach because the demo backend has no `DATABASE_URL` (`tests/e2e/education-ph3-1-mobile.spec.ts:7`, `tests/e2e/education-ph3-1-mobile.spec.ts:8`, `tests/e2e/education-ph3-1-mobile.spec.ts:9`, `tests/e2e/education-ph3-1-mobile.spec.ts:10`, `tests/e2e/education-ph3-1-mobile.spec.ts:11`). Smoke coverage asserts the memory fallback label for education flows (`tests/e2e/smoke.spec.ts:59`, `tests/e2e/smoke.spec.ts:64`, `tests/e2e/smoke.spec.ts:85`, `tests/e2e/smoke.spec.ts:89`). Recommendation: do not modify the default e2e gate; add a separate opt-in config/project so normal `node scripts/gates.mjs e2e` remains memory-safe and fast. Target part: Playwright config, not production code.
4. Severity: P1 the browser path is already wired enough for a narrow end-to-end spec. Evidence: the e2e auth route is guarded out of production and requires `E2E_AUTH_BYPASS=1` (`apps/web/src/app/api/e2e/login/route.ts:5`, `apps/web/src/app/api/e2e/login/route.ts:6`, `apps/web/src/app/api/e2e/login/route.ts:7`), then creates a session cookie (`apps/web/src/app/api/e2e/login/route.ts:16`, `apps/web/src/app/api/e2e/login/route.ts:18`). The helper supports `loginTeacher` and `loginUser` (`tests/e2e/helpers/auth.ts:15`, `tests/e2e/helpers/auth.ts:17`). When `DATABASE_URL` is set, backend mode selects Postgres (`apps/web/src/lib/backend.ts:20`, `apps/web/src/lib/backend.ts:24`, `apps/web/src/lib/backend.ts:35`) and `getServerDb()` returns the real DB (`apps/web/src/lib/backend.ts:44`, `apps/web/src/lib/backend.ts:46`). Seed creates `teacher@wtc.local`, `user@wtc.local`, an active education entitlement for the user, and a published teacher-owned course (`packages/db/src/seed.ts:27`, `packages/db/src/seed.ts:30`, `packages/db/src/seed.ts:31`, `packages/db/src/seed.ts:46`, `packages/db/src/seed.ts:50`, `packages/db/src/seed.ts:53`, `packages/db/src/seed.ts:60`). Teacher UI exposes course links, add lesson, publish lesson, and multipart file material upload (`apps/web/src/app/teacher/courses/page.tsx:53`, `apps/web/src/app/teacher/courses/page.tsx:54`; `apps/web/src/app/teacher/courses/[id]/page.tsx:114`, `apps/web/src/app/teacher/courses/[id]/page.tsx:115`, `apps/web/src/app/teacher/courses/[id]/page.tsx:119`, `apps/web/src/app/teacher/courses/[id]/page.tsx:123`, `apps/web/src/app/teacher/courses/[id]/page.tsx:234`, `apps/web/src/app/teacher/courses/[id]/page.tsx:250`). Student lesson UI exposes the download link only when the material has a clean download URL (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:141`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:152`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:155`). Recommendation: the spec should drive real browser forms instead of calling repositories directly. Target part: `tests/e2e/lms-materials-db.spec.ts`.
5. Severity: P1 download correctness has lower-level coverage but no browser proof. Evidence: teacher file action reads a browser `File`, calls `prepareLmsFileMaterial`, and persists the material (`apps/web/src/features/lms/actions.ts:110`, `apps/web/src/features/lms/actions.ts:122`, `apps/web/src/features/lms/actions.ts:124`, `apps/web/src/features/lms/actions.ts:127`, `apps/web/src/features/lms/actions.ts:368`, `apps/web/src/features/lms/actions.ts:380`). The LMS material policy normalizes bytes, computes sha256/base64, scan status, storage key, and retention (`packages/lms/src/materials.ts:101`, `packages/lms/src/materials.ts:112`, `packages/lms/src/materials.ts:113`, `packages/lms/src/materials.ts:136`, `packages/lms/src/materials.ts:147`, `packages/lms/src/materials.ts:150`, `packages/lms/src/materials.ts:151`, `packages/lms/src/materials.ts:154`). The repository exposes a download row only for file materials with `scan_status='clean'`, not deleted, and published lesson/course, then validates byte length and hash (`packages/db/src/repositories.ts:787`, `packages/db/src/repositories.ts:809`, `packages/db/src/repositories.ts:811`, `packages/db/src/repositories.ts:812`, `packages/db/src/repositories.ts:813`). The handler returns strict download headers and records audit (`apps/web/src/features/lms/material-download.ts:31`, `apps/web/src/features/lms/material-download.ts:33`, `apps/web/src/features/lms/material-download.ts:36`, `apps/web/src/features/lms/material-download.ts:39`, `apps/web/src/features/lms/material-download.ts:57`, `apps/web/src/features/lms/material-download.ts:60`, `apps/web/src/features/lms/material-download.ts:61`). Existing PGlite tests verify clean stream, redacted audit, denial/no-DB fail-closed, quarantined 404, and non-GET rejection (`tests/integration/lms-material-download-handler.test.ts:75`, `tests/integration/lms-material-download-handler.test.ts:76`, `tests/integration/lms-material-download-handler.test.ts:83`, `tests/integration/lms-material-download-handler.test.ts:85`, `tests/integration/lms-material-download-handler.test.ts:91`, `tests/integration/lms-material-download-handler.test.ts:97`, `tests/integration/lms-material-download-handler.test.ts:103`). Recommendation: browser acceptance should assert the response body bytes and headers via Playwright `download` or `page.request.get(downloadHref)`, and optionally verify an `education.material_download` audit row through a test-only DB read after the browser action. Target part: e2e spec plus test-only DB helper.
6. Severity: P2 command hygiene. Evidence: `scripts/gates.mjs` intentionally keeps e2e as its own plan because Playwright starts a dev server (`scripts/gates.mjs:43`, `scripts/gates.mjs:44`, `scripts/gates.mjs:46`, `scripts/gates.mjs:47`, `scripts/gates.mjs:50`, `scripts/gates.mjs:52`), and the package script `e2e` is plain `playwright test` (`package.json:27`). Recommendation: add a new explicit command such as `npm run e2e:lms-db` that uses the separate config; do not fold it into `full`, `core`, or default `e2e` until CI can provision a throwaway DB. Target part: `package.json`, optional `scripts/gates.mjs` only if adding a separate named plan.
## Decisions
- Safest bounded implementation: add an opt-in, local-only DB-backed Playwright harness dedicated to LMS material upload/download, rather than changing default e2e or production code.
- The harness should require `LMS_DB_E2E_DATABASE_URL`, refuse non-`wtc_test*` database names before connecting, apply committed migrations and `seedDatabase()` with Node/postgres-js or existing DB package APIs, then start `npm run dev:e2e -w @wtc/web` with `DATABASE_URL` set to the same throwaway URL and safety flags `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `E2E_AUTH_BYPASS=1`.
- The spec should prove one happy path only first: teacher logs in, confirms `storage: Postgres`, opens seeded course, creates/publishes an article lesson, uploads a tiny `text/plain` material, student logs in, opens the course/lesson, downloads the file, and asserts body bytes plus `content-disposition`, `content-type`, `x-content-type-options`, and `x-lms-sha256`.
- Optional second assertion in the same spec: read the throwaway DB after download and assert one `education.material_upload` and one `education.material_download` audit row without raw bytes/base64.
## Risks
- A generic `DATABASE_URL` or `db:migrate` command without a DB-name guard could mutate a preview or production database. The implementation must validate the dedicated URL before any connection.
- Playwright server startup will mutate the throwaway DB by applying migrations and seeding; this is acceptable only for a fresh disposable `wtc_test*` database and must be documented as opt-in.
- UI selectors may be brittle because the teacher course link is currently rendered as the course title rather than a test id (`apps/web/src/app/teacher/courses/page.tsx:53`, `apps/web/src/app/teacher/courses/page.tsx:54`). Prefer role/text selectors first; add test ids only if selectors become unstable.
- The seeded course is published but has no lesson (`packages/db/src/seed.ts:53`, `packages/db/src/seed.ts:60`), so the spec must create and publish a lesson before expecting student download visibility.
- This browser proof does not clear production object storage, production malware scanner, signed-object redirects, public upload rollout, or live-service acceptance.
## Verification/tests
RUN:
- Read-only file inspection and targeted `rg`/line-number searches only.

NOT RUN:
- `npm test`, focused Vitest, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, Playwright, build, migrations, seed, psql, database mutation, server start, live endpoint calls, live service checks. Reason: user explicitly scoped discovery as read-only except this handoff and forbade servers, Playwright, DB mutation, psql, and live endpoints.

Concrete recommended implementation commands after the new harness exists:
```powershell
$env:LMS_DB_E2E_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test_lms_browser_20260601"
npm run e2e:lms-db
```

Concrete recommended focused verification after implementation:
```powershell
npm test -- packages/lms/src/materials.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts
npm run typecheck
npm run typecheck -w @wtc/web
$env:LMS_DB_E2E_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test_lms_browser_20260601"
npm run e2e:lms-db
```
## Next actions
1. Implement `playwright.lms-db.config.ts` with one project, one worker, no retries, baseURL `http://localhost:3100`, and a `webServer.command` that invokes a safe bootstrap script rather than raw `next dev`.
2. Implement `scripts/lms-db-e2e-server.mjs` or equivalent: require `LMS_DB_E2E_DATABASE_URL`, assert `wtc_test`/`wtc_test_<suffix>` before connecting, apply committed SQL migrations in order, call `seedDatabase()`, then spawn `npm run dev:e2e -w @wtc/web` with the throwaway URL as `DATABASE_URL` and all live-control flags disabled.
3. Add `tests/e2e/lms-materials-db.spec.ts` for the browser happy path: `loginTeacher`, confirm `storage: Postgres`, open seeded course, create a published article lesson, upload a tiny text file through the multipart form, `loginUser`, open the course/lesson, click/download or request the `Download` href, assert exact bytes and strict headers.
4. Add a small test-only DB helper for the e2e spec only if audit verification is included; keep it guarded by `LMS_DB_E2E_DATABASE_URL` and the same throwaway DB-name check.
5. Add `npm run e2e:lms-db` to package scripts and keep it separate from `node scripts/gates.mjs full` and default `node scripts/gates.mjs e2e` until CI has a disposable Postgres database.
