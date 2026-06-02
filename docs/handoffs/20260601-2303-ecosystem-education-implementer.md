# ecosystem-education-implementer handoff
## Scope
Read-only Phase 3.17 audit of LMS upload production-readiness after Phase 3.15. Focus areas: current file/embed storage, teacher/student flows, local DB byte storage limits, missing object-storage abstraction, malware/quarantine/retention states, and DB-backed browser acceptance gaps. No live services, servers, Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview-worker, or production endpoints were touched. This is a single per-agent audit handoff; no N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/urls.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/helpers/auth.ts`

## Files changed
None - read-only audit

## Findings
1. High - The current file storage path is local DB byte storage, not an object-storage abstraction. Evidence: the target plan models file materials with `file_key` and S3-compatible signed download semantics (`docs/EDUCATION_LMS_PLAN.md:284`, `docs/EDUCATION_LMS_PLAN.md:298`, `docs/EDUCATION_LMS_PLAN.md:1007`), but current schema stores `file_bytes_base64` on `materials` (`packages/db/src/schema.ts:256-261`), `createMaterial` accepts `fileBytesBase64` directly (`packages/db/src/repositories.ts:645-648`), and the download handler returns bytes decoded from the DB row (`apps/web/src/features/lms/material-download.ts:57-61`). Recommendation: add a `@wtc/lms` storage interface plus a local DB adapter, with provider/key/status metadata in `@wtc/db`, so S3/R2 can be swapped in later without changing teacher/student flows. Target part: LMS storage contract, material repositories, and download route.
2. High - File materials have no scan/quarantine/retention lifecycle, so a file becomes downloadable as soon as it is inserted. Evidence: production blockers still list malware scan/quarantine and retention as open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`), the current material schema constrains only kind/payload shape (`packages/db/src/schema.ts:248-273`), `createMaterial` inserts and audits the row immediately (`packages/db/src/repositories.ts:681-690`), and `getMaterialFileForPublishedLesson` gates only file kind plus published lesson/course before returning bytes (`packages/db/src/repositories.ts:723-740`). Recommendation: add local-only lifecycle fields such as `scan_status`, `scan_checked_at`, `quarantined_at`, `retention_expires_at`, `deleted_at`, and fail download closed unless the row is clean, not quarantined, and not expired/deleted. Target part: material schema/repositories, teacher status UI, download guard, and tests.
3. Medium - DB-backed browser acceptance is still missing for the upload/embed workflow. Evidence: Phase 3.15 explicitly says route/PGlite tests are stronger than browser evidence (`docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:60`), the dedicated education e2e states that teacher editor and DB-backed detail are out of e2e reach because no `DATABASE_URL` is present (`tests/e2e/education-ph3-1-mobile.spec.ts:7-11`), and smoke e2e covers memory-mode catalogue/teacher/course surfaces only (`tests/e2e/smoke.spec.ts:59-68`, `tests/e2e/smoke.spec.ts:77-89`). Recommendation: add a local DB-backed Playwright profile or script that seeds a throwaway DB, creates one file material and one embed, verifies teacher upload/status rendering, student sanitized embed rendering, and file download headers. Target part: e2e harness and LMS browser acceptance.
4. Medium - Oversized uploads are rejected only after the server action reads the entire uploaded file into memory. Evidence: the file action only pre-checks missing/zero-size files (`apps/web/src/features/lms/actions.ts:120-125`), while the 5 MB max is enforced inside `normalizeLmsFileUpload` after bytes are already provided (`packages/lms/src/materials.ts:62-68`). Recommendation: preflight `file.size > LMS_MAX_FILE_BYTES` before `arrayBuffer()`, return an audited/visible validation failure, and keep the pure byte-size check as a backstop. Target part: teacher material action and tests.
5. Low - Some current comments still describe embed as not selectable or not renderable even though Phase 3.15 enabled sanitized embed writes/renders. Evidence: `apps/web/src/features/lms/actions.ts:54` says embed is not selectable while the schema includes it at `apps/web/src/features/lms/actions.ts:60`, and schema/type comments still refer to embed as future-only (`packages/db/src/schema.ts:234-240`, `packages/lms/src/types.ts:8-11`). Recommendation: update comments in the implementation slice so future auditors do not mistake stale comments for product truth. Target part: source comments only.

## Decisions
- Treat Phase 3.15 as a real local acceptance slice: strict MIME/size policy, canonical iframe sanitization, local DB byte persistence, entitlement-checked download, and audit are present.
- Do not recommend live object storage or external malware services for the next slice; keep it local by adding interfaces, lifecycle fields, a local DB storage adapter, and deterministic local scan/quarantine behavior.
- Keep existing teacher/student routes as the consumer surface for the next slice rather than adding a parallel upload UI.

## Risks
- Without a storage interface, moving from DB bytes to object storage will likely touch schema, repositories, route handlers, and UI in one larger change.
- Without scan/quarantine/retention states, the product cannot honestly model production upload review or fail-closed download behavior.
- Without DB-backed browser acceptance, the path most likely to regress is the composed workflow: teacher form submission -> DB row/state -> student lesson render -> download headers.
- The local DB byte approach is acceptable for bounded small-file acceptance, but it should not be marketed as production object storage.

## Verification/tests
RUN:
- Read-only source/doc inspection with `Get-Content`, `rg --files`, and `rg -n`.
- `git status --short` was attempted and reported this workspace is not a git repo or git is unavailable here.

NOT RUN:
- `npm run governance:check`, `npm run check:core`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, `npm run secret:scan`, `npm run db:generate -w @wtc/db`, `npm run build -w @wtc/web`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e`. Reason: read-only audit phase with no implementation changes except this handoff.
- Real object storage, malware scanners, live Stripe, live Axioma, live TradingView automation, live bot/exchange control, SSH/tmux/systemd/preview-worker/prod checks, and server runs. Reason: explicitly forbidden or out of scope.

## Next actions
1. Implement a bounded local storage lifecycle slice: add an `@wtc/lms` material storage/scanner contract, keep a local DB adapter, add material lifecycle fields (`storage_provider`, `storage_key`, `scan_status`, `scan_checked_at`, `quarantined_at`, `retention_expires_at`, `deleted_at`), and fail download closed unless the file is clean and active.
2. Add teacher/student UI status for pending/clean/quarantined/expired file materials and keep public download links hidden or disabled for non-clean states.
3. Add PGlite tests for lifecycle constraints, quarantine/retention download denial, audit redaction, and local DB adapter behavior.
4. Add a DB-backed browser acceptance path for one teacher file upload, one sanitized embed lesson/material, and one student download/render flow. Keep it local-only and skip or mark NOT RUN unless a throwaway DB URL is provided.
5. Preflight upload size before `arrayBuffer()` and refresh stale embed comments in the same implementation slice.
