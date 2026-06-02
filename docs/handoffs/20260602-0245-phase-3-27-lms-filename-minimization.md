# Phase 3.27 LMS filename minimization handoff
## Scope
Implement the next bounded LMS no-leak slice after Phase 3.26: remove original uploaded filenames from successful material download headers, LMS material upload/download audit payloads, teacher material DTOs, teacher rendered material surfaces, and generated artifact leak scanning.

This phase does not remove DB-private `materials.file_name` / `mime_type` columns because current storage and download internals still need them for file-row validation and MIME-specific response behavior. It does not implement S3/R2 object storage, signed-object redirects, external malware scanning, object-store delete/reconciliation, public upload rollout, dynamic marker scanning for retained HAR/network traces/signed URLs, or the not-yet-observed DB-backed browser acceptance run.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0245-ecosystem-education-implementer.md](20260602-0245-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0245-ecosystem-backend-implementer.md](20260602-0245-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0245-ecosystem-security-auditor.md](20260602-0245-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0245-ecosystem-tests-runner.md](20260602-0245-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.

## Files inspected
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `packages/lms/src/types.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md`

## Findings
1. Severity: High. Successful file downloads exposed the original uploaded filename through `Content-Disposition`. Recommendation implemented: attachment names are now MIME-derived generic names such as `lesson-material.txt`, and success tests assert the uploaded filename is absent.
2. Severity: High. LMS material upload/download audit payloads included raw filename and MIME field names. Recommendation implemented: those payloads now omit `fileName` and `mimeType`; focused DB tests assert upload/download audit JSON does not contain those keys or concrete filenames.
3. Severity: High. Teacher-authorized material management was still projecting/rendering filename metadata. Recommendation implemented: `TeacherMaterialView` is now the same filename-free view shape as `MaterialView`, `toTeacherMaterialView()` no longer reads `m.fileName` or `m.mimeType`, and the teacher course editor renders a generic file label plus size and scan state.
4. Severity: Medium. Generated artifacts needed a static guard against filename/MIME metadata markers. Recommendation implemented: `scripts/scan-lms-db-e2e-artifacts.mjs` now rejects `fileName` and `mimeType`, with scanner and harness tests updated.
5. Severity: Medium. DB-private file metadata is still needed for current storage internals. Decision preserved: no migration; `materials.file_name` and `mime_type` remain private DB/download-row fields for validation and MIME-specific headers, not DTO/audit/rendered output.

## Decisions
- Use generic attachment names by MIME type instead of preserving uploaded filenames in successful downloads.
- Keep original filename/MIME metadata inside private DB/storage rows for now; do not widen it into DTOs, audit payloads, generated artifacts, or rendered pages.
- Treat `TeacherMaterialView` as filename-free to avoid an authorized-but-unnecessary rendered filename surface.
- Keep production object storage, signed delivery, external scanner, object cleanup, dynamic per-run marker scanning, and real DB browser acceptance as separate phases.

## Risks
- Users no longer receive their original uploaded filename on download; this is intentional for the current strict no-leak policy.
- If future signed delivery emits object URLs, signed URLs, HAR traces, or network logs, the current static artifact scanner still needs per-run dynamic marker inputs before retaining that evidence.
- The workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status or commit evidence is available in this folder.

## Verification/tests
RUN:
1. `npm test -- tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-material-storage.test.ts` - PASS, 66 tests.
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `node scripts/gates.mjs full` - PASS, 9/9 gates (governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build).
5. `node scripts/gates.mjs e2e` - PASS, 44 Playwright tests.
6. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 image files, 0 blocked containers, 2 missing roots, 70 total artifact files.
7. Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
1. `npm run e2e:lms:db` - no `LMS_E2E_DATABASE_URL`.
2. `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
3. Real S3/R2 object storage, external malware scanner, signed redirects, object-store delete/reconciliation, dynamic retained-network-artifact marker scanning, public upload rollout, live Stripe/Axioma/TV/bot-control acceptance, and deployment actions - not in scope / no credentials.

## Next actions
1. When a fresh throwaway/admin DB URL is available, run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` and archive only scanner-passed, redacted evidence.
2. Add the production object-storage phase separately: S3/R2 adapter, signed redirects, external scanner state, object delete/reconciliation, dynamic marker manifest for retained network/signed-URL evidence, and live credentialed acceptance.
