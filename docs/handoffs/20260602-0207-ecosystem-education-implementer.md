# ecosystem-education-implementer handoff
## Scope
Phase 3.25 read-only education/LMS audit before edits. Inspected the current LMS upload, download, storage metadata, material DTO, blocker-doc, and test surfaces to propose the safest next storage-boundary implementation that moves from DB-local bytes toward production object storage without claiming live object storage. No product code, tests, migrations, seeds, servers, DB commands, gates, or live services were run.

## Files inspected
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/lib/lms-types.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/EDUCATION_LMS_PLAN.md`

## Files changed
- `docs/handoffs/20260602-0207-ecosystem-education-implementer.md`

## Findings
1. Severity: High. Evidence: `apps/web/src/features/lms/actions.ts:122`-`129` reads the uploaded `File` in the server action and immediately calls `prepareLmsFileMaterial()`, while `packages/lms/src/materials.ts:136`-`154` always returns `storageProvider: 'db-local'`, a deterministic local key, scan result, retention timestamp, and `fileBytesBase64`. Recommendation: add the next implementation as a storage boundary, not a live S3/R2 integration: define a package-level LMS material storage interface with a default `db-local` adapter preserving the current behavior, then have the action call that boundary instead of preparing DB-local rows inline. Target part: `packages/lms` storage boundary plus `apps/web/src/features/lms/actions.ts`.
2. Severity: High. Evidence: `packages/db/src/schema.ts:260` defines `file_bytes_base64`, and `packages/db/src/schema.ts:285`-`292` requires every `kind='file'` row to carry non-null `file_bytes_base64`; `packages/db/src/repositories.ts:653`-`669` and `packages/db/src/repositories.ts:685`-`699` likewise require and insert `fileBytesBase64` for file materials. Recommendation: do not attempt object-storage metadata-only rows in the next slice. First introduce the adapter seam and provider-gated download semantics; only later add a migration that permits `file_bytes_base64 IS NULL` for non-`db-local` providers with explicit tests. Target part: `packages/db` schema/repository migration planning.
3. Severity: High. Evidence: `packages/db/src/repositories.ts:828`-`855` returns any clean, active, published file row with non-null bytes and includes `storageProvider`/`storageKey`; `apps/web/src/features/lms/material-download.ts:62`-`66` ignores the provider and streams `Buffer.from(row.fileBytesBase64, 'base64')`. Recommendation: add a download delivery resolver before any non-local provider can be written: `db-local` streams local bytes exactly as today; every unsupported provider fails closed with no storage key or bytes in the response; future object storage may only return a signed redirect after a real adapter is configured and tested. Target part: `apps/web/src/features/lms/material-download.ts` and the new LMS storage/download interface.
4. Severity: High. Evidence: student DTOs are already constrained: `packages/lms/src/types.ts:60`-`70` exposes only display/download/embed fields, `apps/web/src/features/lms/queries.ts:65`-`75` maps file rows to `downloadUrl`, `sizeBytes`, and `scanStatus` only, and static tests at `tests/integration/lms-ph3-1-static.test.ts:148`-`183` forbid filename, storage key, hash, base64, quarantine, retention, and delete internals from student projections. Recommendation: keep DTOs unchanged for the storage-boundary slice; object storage must stay behind the existing `/api/education/materials/:id/download` route and must not add storage provider/key fields to client DTOs. Target part: material DTOs and student/teacher query mappers.
5. Severity: Medium. Evidence: teacher surfaces display file name, size, and scan state only (`apps/web/src/app/teacher/courses/[id]/page.tsx:34`-`45`, `apps/web/src/app/teacher/materials/page.tsx:46`-`50`), and the add-material form honestly labels current files as local DB rows with production object storage still separate (`apps/web/src/app/teacher/courses/[id]/page.tsx:232`-`254`). Recommendation: keep the UI copy honest in the next storage-boundary implementation; if a non-local adapter is only a stub or fail-closed path, show no production-object-storage availability in teacher or student UI. Target part: teacher material surfaces and rollout wording.
6. Severity: Medium. Evidence: local cleanup is deliberately `db-local` scoped in `packages/db/src/repositories.ts:773`-`807`, while deployment docs state there is no S3/R2 bucket, signed-object redirect, external malware scanner, or object-store delete/reconciliation cleanup (`docs/DEPLOYMENT.md:44`-`51`); current blockers repeat that production object storage and object-store cleanup remain open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:10`-`17`). Recommendation: the next storage-boundary slice should not extend cleanup to non-local providers. Add object deletion/reconciliation only after there is a real object adapter and an outbox or two-phase delete design that cannot orphan objects or lose keys. Target part: worker cleanup and object lifecycle design.
7. Severity: Medium. Evidence: raw repository download audit excludes bytes and storage key but records file metadata (`packages/db/src/repositories.ts:874`-`892`), while admin audit projection tests keep payload internals out of the rendered/admin surface (`tests/integration/lms-ph3-1-static.test.ts:186`-`198`). Recommendation: future signed-object redirects must never log the signed URL, object key, raw bytes, or provider credentials; keep audits summary/file-display-only and route all signed URL generation through a no-store route response. Target part: audit/event payloads and download delivery resolver.
8. Severity: Medium. Evidence: local tests cover normalization and scan policy (`packages/lms/src/materials.test.ts:13`-`55`), DB-local round trip/download lookup and cleanup provider scoping (`tests/integration/db-lms-ph3-1.test.ts:112`-`186`), fail-closed download responses (`tests/integration/lms-material-download-handler.test.ts:112`-`210`), and browser no-leak expectations in source (`tests/e2e/lms-db-materials.spec.ts:94`-`237`). The actual LMS DB browser gate remains not run unless a fresh `wtc_test_lms_*` DB is supplied (`docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`76`, `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`). Recommendation: next implementation tests should be local and explicit: adapter contract tests for `db-local`, a handler test proving unsupported non-local providers fail closed and do not audit downloads, and static DTO tests proving no provider/key leaks. Do not claim live object storage from those tests. Target part: `packages/lms/src/*`, `tests/integration/lms-material-download-handler.test.ts`, and `tests/integration/lms-ph3-1-static.test.ts`.
9. Severity: Low. Evidence: `packages/lms/src/index.ts:41`-`60` still exports a legacy in-memory `Material` shape containing `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, quarantine, retention, and delete fields, while the active DB-backed web DTO path uses `packages/lms/src/types.ts` and query mappers. Recommendation: do not reuse that legacy `Material` interface as the production object-storage API. The new storage boundary should have its own narrow internal types and should not be exported as a client DTO. Target part: LMS package public/internal type split.

## Decisions
- The safest next implementation is a storage-boundary slice, not a live object-storage rollout.
- Keep current `db-local` upload/download behavior as the only supported runtime provider until a real object-store adapter, schema migration, scanner, signed redirect, and cleanup/reconciliation path are implemented.
- Add fail-closed non-local provider handling before writing any non-local rows. This prevents accidental streaming of stale DB bytes or surfacing object keys if a future migration or seed introduces `storageProvider != 'db-local'`.
- Keep existing material DTOs unchanged: client-facing data remains route URL, size, scan state, and sanitized embed/link fields only.

## Risks
- Adding object-provider rows before relaxing the DB payload check would fail inserts or force fake DB byte retention, which would not prove production object storage.
- Leaving the download handler provider-agnostic while introducing non-local providers could stream DB bytes for rows that are supposed to be object-backed.
- Adding signed URLs directly to DTOs would bypass the current entitlement, published-content, no-store, and audit boundary.
- Extending cleanup to non-local providers without object deletion/reconciliation can orphan files or delete the only stored key needed to remove them.
- The actual Postgres browser LMS upload/download gate is still unobserved in this workspace, so no storage-boundary work should be marketed as production upload readiness.

## Verification/tests
- RUN: read-only source inspection of the files listed above.
- NOT RUN: `npm test`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `node scripts/scan-lms-db-e2e-artifacts.mjs`, `npm run worker:smoke`.
- NOT RUN: servers, Playwright, DB create/drop, migrations, seeds, live endpoints, external object storage, malware scanner, signed redirects, deployment actions, Stripe, Axioma, TradingView, or bot-control services.
- Git status could not be used as authoritative evidence because this workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

## Next actions
1. Implement `packages/lms/src/storage.ts` (or equivalent) with a narrow internal `LmsMaterialStorageAdapter` contract and a default `db-local` adapter that preserves current normalization, scan, local key, retention, and base64 behavior.
2. Route `createMaterialAction()` through that boundary while keeping the active provider fixed to `db-local` unless an explicit, disabled-by-default object-storage config is introduced.
3. Add a download delivery resolver that provider-gates `MaterialFileDownloadRow`: `db-local` streams bytes; unsupported providers return a fail-closed not-available response with no storage/provider/key/byte/hash leakage and no download audit.
4. Add focused tests for the adapter contract, action wiring, unsupported provider fail-closed download behavior, unchanged DTO no-leak boundaries, and no signed URL/object key in audit or generated artifacts.
5. Defer the schema migration for nullable `file_bytes_base64` on object-backed rows, signed redirects, real malware scanning, and object delete/reconciliation to a later operator-approved phase with its own agents and gates.
