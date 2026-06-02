# ecosystem-backend-implementer handoff
## Scope
Phase 3.25 read-only backend/db audit before edits. I inspected the current LMS material schema, repositories, download handler, migrations, storage metadata helpers, DTO boundaries, and existing tests to design a bounded storage adapter boundary for LMS file materials.

No product code, tests, migrations, live services, DB commands, servers, or gates were run. This handoff is the only file changed.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `.env.example`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
`docs/handoffs/20260602-0207-ecosystem-backend-implementer.md`

## Findings
1. HIGH - The current schema is DB-local-byte compatible but not metadata-only object-storage compatible. Evidence: `packages/db/src/schema.ts:260-266` defines `file_bytes_base64`, `storage_provider`, `storage_key`, scan, quarantine, and retention columns; `packages/db/src/schema.ts:288-292` requires every `kind = 'file'` row to have `file_bytes_base64 IS NOT NULL`. The same CHECK was introduced by `packages/db/migrations/0011_late_madelyne_pryor.sql:13-18`, before storage-provider metadata arrived in `packages/db/migrations/0012_old_maelstrom.sql:1-7`. Recommendation: do not claim production object storage until a later migration relaxes `materials_payload_check` so non-DB-local providers can store metadata without duplicating bytes in Postgres. Target part: DB schema and migration plan.

2. HIGH - The download repository is still a byte resolver, not a storage metadata repository. Evidence: `packages/db/src/repositories.ts:828-845` selects metadata plus `fileBytesBase64`; `packages/db/src/repositories.ts:852-854` rejects rows missing bytes and verifies size/hash inside the repository; `packages/db/src/repositories.ts:855-871` returns `fileBytesBase64` to the web handler. Recommendation: split the boundary into a repository function that returns a clean published material storage locator plus integrity metadata, and a separate storage adapter that resolves bytes or a signed redirect. Keep the existing DB-local byte verification in the default adapter. Target part: repository/download boundary.

3. HIGH - The current web download handler streams only inline bytes, so signed-object redirect support needs a handler-level result union before production object storage. Evidence: `apps/web/src/features/lms/material-download.ts:31-40` builds attachment headers from a `MaterialFileDownloadRow`; `apps/web/src/features/lms/material-download.ts:62-66` fetches the row, decodes `row.fileBytesBase64`, audits, and returns `new Response(bytes)`. The API route only injects auth/access/db at `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:9-16`. Recommendation: introduce an injectable `LmsMaterialStorageAdapter` whose result is either `{ kind: 'bytes', bytes }` for DB-local or `{ kind: 'redirect', url, headers }` for future signed object storage, with the default build supporting only DB-local and failing closed for unsupported providers. Target part: app-layer download handler.

4. MEDIUM - Useful storage metadata primitives already exist and can support a no-migration adapter boundary. Evidence: `packages/lms/src/materials.ts:5-9` defines `db-local`, `fs-local`, the `lms/materials/` key prefix, scan statuses, and provider list; `packages/lms/src/materials.ts:135-145` builds and validates LMS material storage keys; `packages/lms/src/materials.ts:148-167` still prepares uploads as DB-local rows. Recommendation: place pure adapter types/helpers in `@wtc/lms` or a small `apps/web` feature module and reuse `isLmsMaterialStorageKey()` for provider/key fail-closed checks. This can be implemented without a migration if it preserves DB-local behavior and treats non-DB-local providers as unsupported until configured. Target part: storage metadata helper layer.

5. MEDIUM - Upload currently reads the entire browser file into memory and stores bytes in the material row, so object-store upload cannot be implemented honestly as a small handler tweak. Evidence: `apps/web/src/features/lms/actions.ts:122-129` pulls `file.arrayBuffer()`, calls `prepareLmsFileMaterial`, and passes bytes plus metadata into `createMaterial`; `packages/db/src/repositories.ts:680-705` persists the file payload and defaults provider/key; `packages/lms/src/materials.ts:105-118` normalizes bytes and creates `fileBytesBase64`. Recommendation: Phase 3.25 can add a download/storage adapter boundary, but true object-store uploads need a separate phase with stream/upload adapter, external malware scanner handoff, and schema/migration support. Target part: upload pipeline.

6. MEDIUM - Cleanup is intentionally DB-local only and should not be expanded to object stores without a delete/reconcile design. Evidence: `packages/db/src/repositories.ts:769-807` hard-deletes only `storageProvider = db-local`, `storageKey LIKE lms/materials/%`, expired rows that are soft-deleted or unsafe, and emits a summary audit; `docs/ACCEPTANCE_MATRIX_MASTER.md:80-83` says this is not production object-storage cleanup. Recommendation: keep object-store delete/reconciliation out of the no-migration adapter phase; later object-storage cleanup should delete the object first or record a durable reconcile/tombstone before row deletion. Target part: worker/storage lifecycle.

7. MEDIUM - Current tests already cover DB-local bytes, no-leak failure paths, DTO projection boundaries, and DB-local cleanup; the adapter phase needs focused tests around provider dispatch and unsupported-provider fail-closed behavior. Evidence: `tests/integration/db-lms-ph3-1.test.ts:112-130` covers local file/embed round-trip and quarantined no-download; `tests/integration/db-lms-ph3-1.test.ts:131-182` covers DB-local-only cleanup and audit redaction; `tests/integration/lms-material-download-handler.test.ts:113-126` checks successful streaming/audit redaction; `tests/integration/lms-material-download-handler.test.ts:128-166` checks fail-closed before DB lookup; `tests/integration/lms-ph3-1-static.test.ts:148-183` checks student/teacher DTOs do not leak storage internals. Recommendation: add adapter unit tests for DB-local bytes/hash mismatch, unsupported `fs-local`/object provider 404/no audit/no leak, and handler injection tests for bytes success plus synthetic signed-redirect shape without live object storage. Target part: focused test plan.

8. LOW - Environment/config currently has no LMS object-storage settings, so any production adapter must fail closed by default. Evidence: `.env.example:19-24` only documents LMS DB browser acceptance URLs; `rg` over `packages/config`, `apps/web`, and `packages` found no LMS bucket, object-store, scanner, or signed-url config keys beyond LMS material constants. `docs/DEPLOYMENT.md:46-51` also states there is no S3/R2 bucket, signed-object redirect, external malware scanner, or object-store cleanup. Recommendation: do not add production object adapter activation without explicit config schema, deployment docs, and secret scanning guardrails. Target part: config/deployment boundary.

## Decisions
1. Recommended no-migration Phase 3.25 scope:
   - Add a storage adapter interface and default DB-local adapter.
   - Keep `createMaterial` and the current schema unchanged.
   - Keep `file_bytes_base64` present for DB-local rows.
   - Move byte decode/size/hash checks from repository/handler into the DB-local adapter, or keep repository verification only as a compatibility wrapper while adding adapter tests.
   - Fail closed for non-DB-local providers unless an adapter is explicitly injected/configured.
   - Keep downloads audited only after storage resolution succeeds.

2. Recommended migration-required future scope:
   - Relax `materials_payload_check` so external providers can have `file_bytes_base64 IS NULL` while retaining file name, MIME, size, hash, provider, key, scan state, and retention.
   - Add explicit provider validation/checks once production providers are named.
   - Add object-store delete/reconciliation semantics before hard-deleting external rows.
   - Add deployment config for bucket/provider, signed URL TTL, malware scanner mode, and object cleanup credentials.

3. Adapter shape proposal:
   - `MaterialStorageLocator`: material id, file name, MIME, size, sha256, storage provider, storage key, optional DB-local base64 bytes.
   - `LmsMaterialStorageAdapter.resolve(locator): { kind: 'bytes'; bytes: Uint8Array } | { kind: 'redirect'; url: string; headers?: Record<string,string> } | null`.
   - Default adapter supports only `storageProvider === 'db-local'` and `isLmsMaterialStorageKey(storageKey)`.
   - Future object adapter signs a redirect and never returns storage keys or raw metadata to the client.

## Risks
1. If repository code continues to require `fileBytesBase64` for all providers, future object-provider rows will never reach an adapter.
2. If the first adapter phase returns storage keys or provider internals in errors, it would regress the no-leak contract already covered by handler/static/e2e tests.
3. If a signed-redirect result is added before auth, entitlement, published-course, scan-clean, and audit sequencing are preserved, the route can leak access to unpublished or non-entitled files.
4. If `fs-local` is treated as supported because the constant exists, without a path-root jail and path traversal tests, it creates an unsafe local-file read boundary.
5. If object cleanup is bolted onto the current hard-delete path, it may delete DB evidence before the external object is actually removed.

## Verification/tests
Read-only audit only. I ran source-inspection commands (`rg`, `Get-Content`, `Select-String`) and attempted `git status --short`, which returned `fatal: not a git repository`.

Gates run: none. The user explicitly forbade gates, servers, DB commands, migrations/seeds, live endpoints, and live services.

Gates not run:
- `npm test`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- `npm run e2e:lms:db`
- `npm run e2e:lms:db:managed`
- Playwright/browser runs
- DB migration/seed commands
- live Postgres, object storage, malware scanner, signed redirect, and external service checks

## Next actions
1. Implement the no-migration DB-local adapter boundary in a new bounded phase after required read-only agents are dispatched.
2. Add focused tests for DB-local adapter success, hash/size mismatch fail-closed, unsupported provider fail-closed/no leak/no audit, and handler injection.
3. Keep production object storage, signed redirects, external malware scanning, and object cleanup marked blocked until a migration/config/deployment phase is approved.
4. After implementation, run focused tests first, then `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, and only run LMS DB browser acceptance when a fresh guarded `LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL` is provided.
