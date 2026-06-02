# ecosystem-backend-implementer handoff
## Scope
Phase 3.26 read-only backend/db audit before edits. Inspect LMS storage-key generation, material repository persistence/download behavior, migration 0013, DB-local cleanup predicate, and tests. Advise how to make new LMS storage keys opaque while preserving old cleanup/download compatibility and avoiding schema churn where possible.

## Files inspected
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`

## Files changed
- `docs/handoffs/20260602-0227-ecosystem-backend-implementer.md`

## Findings
1. Severity: High. Evidence: new key generation is already opaque on the active runtime path: `buildLmsStorageKey()` uses `globalThis.crypto.randomUUID()` when no `objectId` is supplied and returns only the `lms/materials/` namespace plus that opaque id (`packages/lms/src/materials.ts:128`-`131`); `prepareLmsFileMaterial()` calls it with no argument (`packages/lms/src/materials.ts:153`-`157`); the web storage boundary also calls it with no argument (`apps/web/src/features/lms/material-storage.ts:65`-`70`); repository fallback also calls it when a caller omits a key (`packages/db/src/repositories.ts:687`-`705`). Recommendation: keep new runtime writes on no-argument `buildLmsStorageKey()` and do not pass content hash, file name, lesson id, course id, or material id into key construction. Target part: `packages/lms/src/materials.ts`, `apps/web/src/features/lms/material-storage.ts`, `packages/db/src/repositories.ts`.

2. Severity: High. Evidence: old-key compatibility currently depends on broad prefix acceptance, not UUID-only validation: `isLmsMaterialStorageKey()` accepts any non-traversing value under `lms/materials/` (`packages/lms/src/materials.ts:138`-`140`); tests intentionally keep `lms/materials/ab/hash/name` valid (`packages/lms/src/materials.test.ts:53`-`61`); `fs-local` resolves any valid prefixed key through a rooted path jail (`apps/web/src/features/lms/material-storage.ts:50`-`55`, `apps/web/src/features/lms/material-storage.ts:111`-`115`); cleanup scopes by provider plus `LIKE 'lms/materials/%'` (`packages/db/src/repositories.ts:781`-`793`). Recommendation: do not tighten read, cleanup, or local object-path validation to UUID-only. If stricter semantics are wanted, add a separate `isNewOpaqueLmsMaterialStorageKey()` for new-write tests while leaving `isLmsMaterialStorageKey()` as the backward-compatible read/cleanup validator. Target part: LMS storage-key validators and DB cleanup/download compatibility.

3. Severity: Medium. Evidence: schema churn is not required for opaque keys because `materials.storage_key` is already text (`packages/db/src/schema.ts:260`-`263`), file lifecycle only requires provider/key/scan/retention presence (`packages/db/src/schema.ts:277`-`283`), and migration 0013 already relaxes payload storage so non-`db-local` file rows can omit inline bytes while retaining provider/key metadata (`packages/db/migrations/0013_young_martin_li.sql:5`-`9`). Recommendation: implement opacity as application-level key-generation policy plus tests, not another migration. Keep `content_sha256` as private integrity metadata and never derive the object key from it. Target part: LMS storage policy, not DB schema.

4. Severity: Medium. Evidence: `createMaterial()` can persist a caller-supplied `storageKey` without validating local prefix shape (`packages/db/src/repositories.ts:681`-`705`), while the active server action routes uploads through `storeLmsUploadedFile()` before calling `createMaterial()` (`apps/web/src/features/lms/actions.ts:123`-`130`, `apps/web/src/features/lms/actions.ts:346`-`383`). Recommendation: keep public/server write paths behind the storage adapter; if adding repository defense-in-depth, validate `db-local` and `fs-local` keys with `isLmsMaterialStorageKey()` but do not require that shape for future remote providers unless their adapter contract says so. This preserves old cleanup/download compatibility and avoids schema churn. Target part: repository input validation and adapter contract tests.

5. Severity: Medium. Evidence: cleanup is correctly limited to local DB payload lifecycle: it hard-deletes only file rows with `storage_provider = 'db-local'`, `storage_key LIKE 'lms/materials/%'`, expired `retained_until`, and either soft-delete or unsafe scan state (`packages/db/src/repositories.ts:774`-`812`); integration coverage proves active clean rows, future-retained rows, remote-provider rows, and unexpected-prefix rows survive while only local expired soft-deleted/unsafe rows are purged (`tests/integration/db-lms-ph3-1.test.ts:135`-`190`). Recommendation: keep this cleanup predicate prefix-compatible for old local rows and do not reuse it for object-store lifecycle. Future S3/R2 deletion should use a separate adapter/outbox/reconcile path so DB hard-delete cannot orphan external objects. Target part: worker/material cleanup boundary.

6. Severity: Medium. Evidence: successful downloads are provider-gated after authorization (`apps/web/src/features/lms/material-download.ts:48`-`72`); DB lookup returns clean, not-deleted, published file rows and validates DB-local bytes against the stored hash but does not constrain key shape for downloads (`packages/db/src/repositories.ts:833`-`879`); unsupported provider resolution fails closed with no audit in tests (`tests/integration/lms-material-download-handler.test.ts:185`-`217`). Recommendation: preserve this layering. Do not add key-shape checks to `getMaterialFileForPublishedLesson()` that would reject legacy rows; keep provider-specific key validation in the storage resolver. Target part: download repository versus storage resolver boundary.

7. Severity: Low. Evidence: upload/download audit payloads include summary fields such as `hasStorageKey`, `storageProvider`, and `hasContentHash`, but not `storageKey` or raw `contentSha256` (`packages/db/src/repositories.ts:716`-`745`, `packages/db/src/repositories.ts:882`-`900`); static tests keep storage keys and bytes out of student/admin DTOs and audit views (`tests/integration/lms-ph3-1-static.test.ts:144`-`198`); browser/artifact tests include key/hash markers as forbidden leakage markers (`tests/e2e/lms-db-materials.spec.ts:10`-`22`, `tests/integration/lms-db-e2e-artifact-scan.test.ts:34`-`59`). Recommendation: keep keys internal and never add `storageKey`, signed object URL, or raw hash to DTOs, audit views, rendered HTML, traces, or screenshots. Target part: DTO/audit/artifact boundaries.

8. Severity: Low. Evidence: the optional `objectId` argument on `buildLmsStorageKey()` can create deterministic keys if misused (`packages/lms/src/materials.ts:128`-`131`), although current runtime callers do not pass it (`packages/lms/src/materials.ts:156`, `apps/web/src/features/lms/material-storage.ts:69`, `packages/db/src/repositories.ts:704`), and tests use it only for an opaque fixture (`packages/lms/src/materials.test.ts:53`-`58`). Recommendation: consider narrowing that escape hatch to tests only or renaming it to make production misuse obvious. This is not schema work and should be a small code/test cleanup if desired. Target part: `packages/lms/src/materials.ts` API surface.

## Decisions
- New LMS storage keys should be opaque random ids under the existing `lms/materials/` namespace.
- The existing `storage_key` text column and migration 0013 are sufficient for opaque new keys; no DB migration is needed for this slice.
- Backward-compatible read and cleanup paths should continue to accept old prefixed keys, including segmented keys.
- DB-local cleanup must remain separate from future object-store deletion/reconciliation.
- Storage keys remain internal metadata only; DTOs, audit views, generated artifacts, and browser pages must not expose them.

## Risks
- If validators are tightened from "safe prefixed key" to "UUID-only key", old local `lms/materials/...` rows can stop resolving in `fs-local` or stop being cleaned up.
- If repository callers bypass `storeLmsUploadedFile()` and pass deterministic `storageKey` values, new rows could regress to non-opaque keys despite the current runtime path being safe.
- If object-store providers reuse DB-local cleanup, DB rows can be deleted without deleting external objects.
- If future signed delivery exposes storage keys or signed URLs through DTOs/audits/artifacts, opacity at key-generation time will not be enough.

## Verification/tests
- No gates run; forbidden by scope.
- No servers run; forbidden by scope.
- No DB commands, migrations/seeds, live endpoints, Playwright, object storage, malware scanner, or live services run; forbidden by scope.
- Read-only inspection only, plus this single handoff file.
- Suggested future focused tests before implementation acceptance:
  1. `packages/lms/src/materials.test.ts`: assert new generated keys match `^lms/materials/[A-Za-z0-9_-]{16,80}$` and do not contain file name or SHA-256.
  2. Repository test: `createMaterial()` fallback without `storageKey` produces an opaque key; supplied old prefixed keys remain accepted for compatibility.
  3. Cleanup test: both new opaque keys and old segmented prefixed keys are eligible for DB-local cleanup; non-local providers and non-prefixed local keys are not.
  4. Download/storage test: old prefixed `fs-local` keys still resolve through the path jail, while traversal and unsupported providers fail closed.
  5. Static/artifact tests: storage keys, raw hashes, signed URLs, and provider internals remain absent from DTOs, audit views, rendered HTML, traces, and generated artifacts.

## Next actions
1. Implement the no-schema-change code cleanup if needed: keep `buildLmsStorageKey()` opaque for runtime calls, restrict or clearly isolate the optional deterministic `objectId` path, and add the focused tests above.
2. Preserve `isLmsMaterialStorageKey()` as the broad legacy-compatible validator; add a separate new-key assertion helper only if tests need stricter opacity checks.
3. Leave migration 0013 unchanged for this goal.
4. Keep object-store deletion/reconciliation as a later adapter/outbox phase, not an extension of `purgeExpiredLmsMaterialFiles()`.
