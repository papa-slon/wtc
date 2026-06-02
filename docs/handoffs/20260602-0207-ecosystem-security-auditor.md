# ecosystem-security-auditor handoff
## Scope
Phase 3.25 read-only security audit before edits. Inspected LMS upload, download, DB-local storage, audit, scanner, worker cleanup, e2e artifact, and production-claim boundaries for a future storage adapter and signed-delivery slice.

Forbidden by operator scope: product-code edits, test edits, docs edits other than this handoff, gates, servers, DB commands, migrations/seeds, Playwright, live services, and background agent spawning.

## Files inspected
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/worker/src/index.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `.gitignore`
- `.secretlintignore`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/ROADMAP_MASTER.md`

## Files changed
`docs/handoffs/20260602-0207-ecosystem-security-auditor.md` only.

## Findings
1. Severity: High. Evidence: file uploads are still converted to local DB payloads in `apps/web/src/features/lms/actions.ts:122`-`129` and persisted through `createMaterial()` at `apps/web/src/features/lms/actions.ts:381`; the schema still requires `file_bytes_base64` for file rows at `packages/db/src/schema.ts:248`-`296`; download retrieves `fileBytesBase64` from the row at `packages/db/src/repositories.ts:828`-`871` and streams bytes directly at `apps/web/src/features/lms/material-download.ts:62`-`66`; the route is an authenticated application stream, not a signed redirect, at `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:9`-`16`; production docs still list object storage and signed-object redirects as open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` and `docs/STATUS.md:13`-`14`. Recommendation: Phase 3.25 implementation should add an explicit storage adapter boundary before any production claim: `put`, `signRead`, `delete` or delete-outbox/reconcile, and a production fence that rejects `db-local` writes outside local/dev acceptance. Target part: LMS storage adapter and signed-delivery boundary.

2. Severity: High. Evidence: the successful download response exposes the raw content SHA-256 in `x-lms-sha256` at `apps/web/src/features/lms/material-download.ts:31`-`40`; the e2e spec intentionally asserts this hash on the success path at `tests/e2e/lms-db-materials.spec.ts:209`-`217`; failure assertions correctly require no `x-lms-sha256` at `tests/e2e/lms-db-materials.spec.ts:58`-`73` and `tests/integration/lms-material-download-handler.test.ts:99`-`109`. This is acceptable only as a local acceptance affordance if retained intentionally; it is not aligned with a strict "no hash leak" signed-delivery boundary. Recommendation: before public upload/signed delivery, remove the success-path hash header or replace it with an opaque response validator that does not reveal the stored content digest. If clients need integrity metadata, expose it only through an authenticated, purpose-built metadata API with explicit policy and artifact scanner coverage. Target part: `downloadHeaders()` and DB browser expectations.

3. Severity: High. Evidence: storage keys are deterministic and include the content hash plus a base64url filename fragment at `packages/lms/src/materials.ts:131`-`134`; DB-local cleanup correctly scopes to `storageProvider = 'db-local'` and `storageKey LIKE 'lms/materials/%'` at `packages/db/src/repositories.ts:773`-`807`, but future object-storage keys would become sensitive if they preserve this shape. Recommendation: production object storage keys should be opaque, random, tenant/material scoped identifiers, not hash or filename-derived paths; keep content hash as private metadata only, and never as a public URL path, redirect location component, audit payload value, or artifact marker. Target part: future object-storage key generation.

4. Severity: Medium. Evidence: `materialAuditAfter()` passes `contentSha256`, `storageProvider`, `hasStorageKey`, scan state, quarantine reason, and retention into `education.material_upload` at `packages/db/src/repositories.ts:711`-`725` and `packages/db/src/repositories.ts:740`; `recordMaterialDownloadAudit()` passes `contentSha256`, `storageProvider`, scan state, and retention at `packages/db/src/repositories.ts:874`-`893`; `auditRowValues()` goes through `buildEvent()` at `packages/db/src/repositories.ts:223`-`242`; `buildEvent()` redacts `before` and `after` at `packages/audit/src/audit.ts:163`-`180`; and `redact()` treats 64+ hex strings as secret-shaped at `packages/audit/src/redact.ts:45`-`62`. Recommendation: do not rely on value-pattern redaction as the primary policy for LMS file digests in future storage work. Change future audit shapes to omit `contentSha256` entirely or replace it with booleans/counts such as `hasContentHash`, especially once non-hex checksums, signed URLs, or object keys enter the payload surface. Target part: material upload/download audit payload shape.

5. Severity: Medium. Evidence: current scan behavior is deterministic and in-process: allowed MIME plus magic checks at `packages/lms/src/materials.ts:82`-`115`, EICAR/text executable heuristics at `packages/lms/src/materials.ts:117`-`129`, and immediate `scanStatus` assignment in `prepareLmsFileMaterial()` at `packages/lms/src/materials.ts:136`-`155`; repository download requires `scan_status = 'clean'` at `packages/db/src/repositories.ts:828`-`854`; docs still list a real malware-scanning engine as open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. Recommendation: signed-delivery work must introduce a scanner adapter state machine that fails closed in production: upload creates `pending`, no download URL is issued until an external scanner marks clean, scanner failures or timeouts remain non-downloadable, and quarantine details stay out of user-facing/audit artifacts except aggregate status. Target part: upload scanner boundary.

6. Severity: Medium. Evidence: the download handler fails closed in the correct order for method, UUID, session, entitlement, DB presence, clean/published lookup, and audit-before-stream at `apps/web/src/features/lms/material-download.ts:47`-`66`; the repository lookup also requires clean scan, not deleted, published lesson, published course, byte length match, and SHA-256 match at `packages/db/src/repositories.ts:828`-`854`. However, the same function currently streams bytes from app memory; a future signed redirect must preserve all of these gates before issuing any URL. Recommendation: implement signed delivery as "authorize then sign", never as precomputed signed URLs on material DTOs. Signed URLs should be single-purpose, short TTL, no-store, and never cached or rendered into pages before the entitlement check. Target part: signed URL issue path.

7. Severity: Medium. Evidence: student material DTOs are narrowed to display/download/embed fields at `packages/lms/src/types.ts:60`-`76`; the mapper projects only `downloadUrl`, size, scan status, and sanitized embed for students at `apps/web/src/features/lms/queries.ts:65`-`84`; static tests reject storage/hash/quarantine/retention/delete fields from student and admin rendered boundaries at `tests/integration/lms-ph3-1-static.test.ts:144`-`198`. Recommendation: preserve this DTO shape during adapter work. Do not add `storageProvider`, `storageKey`, `signedUrl`, `contentSha256`, quarantine reason, retention, or object metadata to student/teacher material view objects. The only public material pointer should remain the opaque app route until it authorizes and signs on demand. Target part: LMS DTO projection.

8. Severity: Medium. Evidence: the artifact scanner covers generated text paths and content for file/base64/storage/hash/internal-field markers, DB/env assignments, cookie/auth headers, bearer/basic auth, and password hashes at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`45`; it fails closed on zip/gz/br/pdf and unrecognized binary artifacts at `scripts/scan-lms-db-e2e-artifacts.mjs:94`-`108`; it skips image bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:101`-`104`; and the successful e2e download still observes raw file text and the exact hash at `tests/e2e/lms-db-materials.spec.ts:209`-`217`. Recommendation: before archiving any signed-delivery acceptance evidence, either disable/avoid HAR, network traces, and container artifacts or add a per-run marker manifest scanner for dynamic filenames, hashes, signed URL hosts/query params, and raw response bodies. Screenshots require manual visual review or discard because the scanner does not OCR images. Target part: evidence artifact handling.

9. Severity: Medium. Evidence: `scripts/run-lms-db-e2e.mjs:19`-`33` injects an ephemeral prep token and secrets, then runs prep, Playwright, and the scanner at `scripts/run-lms-db-e2e.mjs:54`-`75`; it prints archive instructions but does not print the database URL or generated secrets at `scripts/run-lms-db-e2e.mjs:91`-`95`; the managed wrapper creates a generated throwaway DB and delegates to the existing runner at `scripts/run-lms-db-e2e-managed.mjs:61`-`89`. Recommendation: keep these as local acceptance harnesses only. Do not treat a scanner pass on stale roots or a focused unit gate as proof of production storage readiness; a production signed-delivery gate needs live object-store credentials, scanner adapter verification, delete/reconcile verification, and a fresh current-run evidence archive. Target part: acceptance reporting.

10. Severity: Low. Evidence: worker cleanup output is aggregate-only in health details and logs at `apps/worker/src/index.ts:107`-`119`, and cleanup audit is aggregate-only at `packages/db/src/repositories.ts:791`-`805`. Recommendation: preserve count-only logging for storage adapter delete/reconcile jobs; do not log material IDs, object keys, filenames, content hashes, base64, signed URLs, quarantine reasons, or provider-specific request IDs unless they are separately classified and redacted. Target part: worker observability.

## Decisions
- The current LMS file flow is local DB-backed acceptance infrastructure, not production object storage.
- The current app-stream download route is fail-closed enough for local acceptance, but it is not the signed-object redirect boundary described in LMS target docs.
- `db-local` cleanup from Phase 3.24 is correctly scoped to local provider/key prefix and should not be generalized to object storage.
- The next implementation should prioritize explicit storage-mode configuration, opaque object keys, scanner adapter states, and authorize-then-sign delivery over UI expansion.

## Risks
- If file uploads remain enabled anywhere a real `DATABASE_URL` exists, operators may mistake `db-local` byte storage for production readiness.
- If `x-lms-sha256` remains on successful downloads, a strict no-hash-leak policy cannot be claimed.
- If deterministic storage keys are reused for object storage, any key or signed URL leak also leaks content digest and filename-derived metadata.
- If future audit payloads keep relying on generic redaction for hashes or signed URLs, one checksum format or URL shape change can reintroduce plaintext metadata leakage.
- If Playwright traces/HARs are archived, the scanner's static denylist may miss dynamic success-path markers unless a per-run manifest is added.

## Verification/tests
RUN:
1. Read-only source inspection with `rg` and `Get-Content` for LMS upload/download/storage/audit/scanner/worker/docs surfaces.
2. Confirmed the requested handoff path did not exist before writing.

NOT RUN:
1. `npm test` - forbidden by scope.
2. `npm run e2e:lms:db` - forbidden by scope; would require DB mutation and Playwright.
3. `npm run e2e:lms:db:managed` - forbidden by scope; would create/drop a database.
4. `node scripts/gates.mjs full` or `node scripts/gates.mjs e2e` - forbidden by scope.
5. `node scripts/scan-lms-db-e2e-artifacts.mjs` - not run; scanner was source-reviewed only.
6. Servers, migrations, seeds, DB commands, live endpoints, object storage, malware scanners, Stripe/Axioma/TV/bot services, and deployment actions - forbidden by scope.

## Next actions
1. Add a production storage-mode fence such as `LMS_FILE_STORAGE_MODE`, and reject `db-local` file writes outside local/dev acceptance.
2. Define an LMS storage adapter interface with opaque object keys, `put`, `signRead`, and `delete` or delete-outbox/reconcile semantics.
3. Replace success-path `x-lms-sha256` exposure before claiming no hash leakage.
4. Change material upload/download audit payloads to omit `contentSha256` instead of relying on long-hex redaction.
5. Add a scanner adapter state machine: `pending` until external scan success, fail-closed on failed/quarantined/timeout.
6. Preserve the app route as the only public material pointer; issue signed URLs only after session, entitlement, clean scan, non-deleted row, and published lesson/course checks.
7. Extend acceptance evidence policy with per-run marker scanning if network traces/HARs or signed URL responses are retained.
