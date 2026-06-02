# ecosystem-education-implementer handoff
## Scope
Phase 3.26 read-only education/LMS audit before edits. Inspected the current post-Phase-3.25 LMS file storage key generation, upload/download route, student and teacher material DTO projection, and relevant tests. Goal: advise the safest local implementation slice toward opaque production-style object keys and no success-path hash leakage without claiming S3/R2, signed delivery, or production malware scanning.

## Files inspected
- `packages/lms/src/materials.ts:3-20`, `packages/lms/src/materials.ts:98-139`, `packages/lms/src/materials.ts:142-161` - file constraints, scanner, storage-key builder, storage-key validator, and DB-local preparation path.
- `apps/web/src/features/lms/material-storage.ts:32-40`, `apps/web/src/features/lms/material-storage.ts:50-69`, `apps/web/src/features/lms/material-storage.ts:73-118` - provider selection, production fail-closed guard, key use, DB-local/fs-local storage, and byte resolution.
- `apps/web/src/features/lms/actions.ts:123-132`, `apps/web/src/features/lms/actions.ts:346-382` - teacher upload form handling and course/lesson ownership checks before material creation.
- `apps/web/src/features/lms/material-download.ts:33-42`, `apps/web/src/features/lms/material-download.ts:49-73` - download headers, entitlement gate, DB lookup, provider byte resolution, audit write, and streamed response.
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:1-17` - public API route wiring to the handler.
- `packages/db/src/schema.ts:248-297` - material columns and CHECK constraints for DB-local versus non-DB-local file payloads.
- `packages/db/src/repositories.ts:681-704`, `packages/db/src/repositories.ts:716-730`, `packages/db/src/repositories.ts:833-879`, `packages/db/src/repositories.ts:882-900` - material insert defaults, summary audit payloads, download row projection, and download audit.
- `packages/lms/src/types.ts:60-76` and `apps/web/src/features/lms/queries.ts:65-84` - student/teacher material DTO fields and mapper projections.
- `apps/web/src/lib/backend.ts:91-111` and `apps/web/src/app/admin/audit-log/page.tsx:22-40` - admin audit projection and UI payload exclusion.
- `packages/audit/src/audit.ts:163-180` and `packages/audit/src/redact.ts:45-78` - audit redaction path.
- `packages/lms/src/materials.test.ts:40-58`, `tests/integration/lms-material-storage.test.ts:49-96`, `tests/integration/lms-material-download-handler.test.ts:81-127`, `tests/e2e/lms-db-materials.spec.ts:58-73`, `tests/e2e/lms-db-materials.spec.ts:197-217`, `tests/integration/lms-ph3-1-static.test.ts:144-198`, `tests/integration/lms-db-e2e-harness.test.ts:76-90` - current static/unit/integration/browser expectations around object keys, DTO leakage, and download headers.

## Files changed
None - read-only audit. This handoff is the only file written: `docs/handoffs/20260602-0227-ecosystem-education-implementer.md`.

## Findings
1. P1 - Success-path file downloads still expose the content hash via response header.
   Evidence: `apps/web/src/features/lms/material-download.ts:33-42` sets `x-lms-sha256` from `row.contentSha256`; `tests/e2e/lms-db-materials.spec.ts:209-217` asserts the successful student download returns `x-lms-sha256` equal to the file hash. Failure-path leak tests already require this header to be absent on errors (`tests/e2e/lms-db-materials.spec.ts:58-73`, `tests/integration/lms-material-download-handler.test.ts:100-109`), but the success path is still an intentional leak. Recommendation: next local slice should remove this header from `downloadHeaders`, update the DB browser acceptance success assertion to require absence, and add a focused integration assertion that the 200 response body is the file bytes while headers do not include hash/storage internals. Target part: LMS download handler and LMS DB browser acceptance.

2. P1 - Current object-key generation is opaque on the upload path, so the next slice can be small and local.
   Evidence: `apps/web/src/features/lms/material-storage.ts:65-69` normalizes/scans the upload but calls `buildLmsStorageKey()` without file name or hash input; `packages/lms/src/materials.ts:128-131` defaults to `crypto.randomUUID()` under the `lms/materials/` prefix; `packages/lms/src/materials.test.ts:40-46` asserts prepared keys match the opaque pattern and do not contain the content hash or source file name. Recommendation: preserve this behavior and add a direct web-storage test that `storeLmsUploadedFile` produces different opaque keys for identical bytes/names, because that is the actual teacher upload path. Target part: LMS storage boundary tests.

3. P2 - The storage-key validator is path-safe, not opacity-safe.
   Evidence: `packages/lms/src/materials.ts:138-139` accepts any value with the `lms/materials/` prefix as long as it has no backslash or `..`; `packages/lms/src/materials.test.ts:53-58` currently treats `lms/materials/ab/hash/name` as valid. This is safe for local path traversal but does not prove production-style opaque object keys. Recommendation: for the next local slice, add a stricter generated-key invariant for new uploads, such as single opaque segment after `lms/materials/`, while keeping any legacy/path-safety validator separate if needed for existing rows. Do not claim S3/R2 readiness from this alone. Target part: `@wtc/lms` material key helpers and storage-boundary tests.

4. P2 - Student and teacher DTOs are already mostly aligned with no hash/key exposure; do not spend the next slice rewriting them.
   Evidence: `packages/lms/src/types.ts:60-70` exposes student `MaterialView` fields as id/lesson/title/type/externalUrl/downloadUrl/size/scan/embed only; `packages/lms/src/types.ts:72-76` limits teacher-only display metadata to fileName/mimeType; `apps/web/src/features/lms/queries.ts:65-84` maps file DTOs without content hash, storage provider, storage key, retainedUntil, deletedAt, or raw bytes; `tests/integration/lms-ph3-1-static.test.ts:148-184` guards those projections. Recommendation: leave DTO shape unchanged in the next local slice except for any test expectations tied to the removed success download hash header. Target part: LMS view DTOs and query mappers.

5. P2 - Audit/UI surfaces are already reduced to summaries, but raw DB rows still retain hashes for integrity.
   Evidence: upload/download audit payload construction uses `hasContentHash` rather than the raw digest (`packages/db/src/repositories.ts:716-730`, `packages/db/src/repositories.ts:882-900`); audit events are redacted before persistence (`packages/db/src/repositories.ts:224-241`, `packages/audit/src/audit.ts:163-180`), and the admin audit UI projects only summary columns (`apps/web/src/lib/backend.ts:91-111`, `apps/web/src/app/admin/audit-log/page.tsx:22-40`). The material DB schema still requires `content_sha256` for file rows (`packages/db/src/schema.ts:248-297`), which is appropriate for local byte integrity and not by itself a UI/response leak. Recommendation: keep DB integrity hash private, remove only response/UI exposure, and avoid a migration in this slice. Target part: audit/download boundary.

## Decisions
- Recommended Phase 3.26 implementation slice: "LMS no success-path hash leakage + generated-key invariant." This should remove `x-lms-sha256` from successful LMS material downloads, update success-path tests to assert absence, and add upload-path opaque-key regression tests.
- Do not implement S3/R2, signed redirects, production malware scanning, or public uploads in this slice. Current providers are `db-local` and `fs-local`, with production fail-closed guards for local providers.
- Do not change student/teacher material DTO contracts unless a test must be updated for the removed success header; current DTOs already avoid storage internals.
- Do not remove `content_sha256` from the DB schema in this slice. It remains useful for local integrity checks and can stay server-private.

## Risks
- If `x-lms-sha256` is removed without updating `tests/e2e/lms-db-materials.spec.ts:209-217`, the opt-in LMS DB browser acceptance gate will fail.
- If only failure-path tests are updated, a future regression could reintroduce success-path hash leakage because current success assertions do not forbid it.
- Tightening `isLmsMaterialStorageKey` directly may break existing tests and rows that rely on nested local paths; a separate "generated key" invariant or migration-aware path is safer.
- Removing DB hashes or byte integrity checks prematurely would weaken local DB/fs-local verification without delivering production object storage or signed delivery.

## Verification/tests
No gates, servers, DB commands, migrations/seeds, Playwright, worker commands, live endpoints, or external services were run, per read-only scope.

Read-only verification performed:
- Confirmed current worktree path is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`; `git status --short` returned `fatal: not a git repository`.
- Used source inspection only for the files listed above.

Recommended gates after the implementation slice:
- Focused: `npm test -- tests/integration/lms-material-download-handler.test.ts tests/integration/lms-material-storage.test.ts packages/lms/src/materials.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts`
- Full local: `node scripts/gates.mjs full`
- Browser default: `node scripts/gates.mjs e2e`
- LMS artifact scanner: `node scripts/scan-lms-db-e2e-artifacts.mjs`
- Opt-in DB browser gate only when configured: `npm run e2e:lms:db` or `npm run e2e:lms:db:managed`

## Next actions
1. Remove `x-lms-sha256` from successful LMS material download responses.
2. Add focused success-path assertions that the 200 download response has no `x-lms-sha256`, no storage key/provider, and no content hash in headers while still streaming the expected bytes.
3. Update the opt-in LMS DB browser spec to assert the successful download has no hash header.
4. Add an upload-path opaque-key regression for `storeLmsUploadedFile`: same file name and bytes should not produce a deterministic hash/name-derived key.
5. Add or split a generated-key validator so new LMS upload keys are `lms/materials/<opaque-id>` without reusing the broader path-safety predicate as proof of opacity.
