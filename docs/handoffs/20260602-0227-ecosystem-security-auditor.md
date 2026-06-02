# ecosystem-security-auditor handoff
## Scope
Phase 3.26 read-only security audit before edits. Inspected the LMS material success path for `x-lms-sha256`, filename/hash-derived leakage, audit payloads, storage-key shape, scanner/e2e expectations, and current docs. Goal: identify the exact edits needed to remove hash/filename-derived leakage from success paths while preserving fail-closed behavior and acceptance evidence. No product code, tests, migrations, server config, or docs were edited except this single handoff.

## Files inspected
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DATA_MODEL.md`

## Files changed
- `docs/handoffs/20260602-0227-ecosystem-security-auditor.md`

## Findings
1. Severity: High. Evidence: the current success response no longer emits `x-lms-sha256`; `downloadHeaders()` sets only cache/content/content-disposition/nosniff/referrer headers at `apps/web/src/features/lms/material-download.ts:33`-`41`, the route returns those headers at `apps/web/src/features/lms/material-download.ts:71`-`72`, the focused success test asserts `x-lms-sha256` is null at `tests/integration/lms-material-download-handler.test.ts:114`-`122`, and the DB browser spec asserts the same at `tests/e2e/lms-db-materials.spec.ts:209`-`217`. This part of the hash leak is already fixed in current source. Recommendation: preserve this invariant and keep both focused and DB-browser assertions. Target part: success download header contract.

2. Severity: High. Evidence: the successful download still exposes the original uploaded filename in `Content-Disposition` at `apps/web/src/features/lms/material-download.ts:38`; the focused success test expects `attachment; filename="plan.txt"` at `tests/integration/lms-material-download-handler.test.ts:117`-`122`; and the DB browser spec expects the success header to contain the dynamic uploaded filename at `tests/e2e/lms-db-materials.spec.ts:209`-`217`. This contradicts a strict no filename-derived success-path policy. Recommendation: replace the success attachment filename with an opaque/generated name that is not derived from `row.fileName`, for example `material-${row.materialId.slice(0, 8)}.<extensionFromMime(row.mimeType)>` or a fixed MIME-derived `lesson-material.<ext>`. Update the focused and DB-browser success tests to assert the original filename is absent from all success headers while keeping `content-type`, `content-length`, `no-store`, and byte integrity checks. Target part: `downloadHeaders()` and success-path tests.

3. Severity: High. Evidence: raw audit payloads no longer include the digest value and now use `hasContentHash`, which is good (`packages/db/src/repositories.ts:716`-`729` and `packages/db/src/repositories.ts:882`-`899`); however both upload and download success audits still include the original filename at `packages/db/src/repositories.ts:721` and `packages/db/src/repositories.ts:892`. Redaction only removes secret-looking keys/values at `packages/audit/src/audit.ts:163`-`180` and `packages/audit/src/redact.ts:45`-`62`, so ordinary filenames are persisted. Recommendation: remove `fileName` from `materialAuditAfter()` and `recordMaterialDownloadAudit()`, replacing it with `hasOriginalFilename: Boolean(...)` if needed. Add focused audit assertions that JSON audit rows do not contain the uploaded filename, uploaded bytes/base64, content hash, storage key, or signed URL. Target part: LMS material upload/download audit payload shape.

4. Severity: High. Evidence: the teacher course editor renders the uploaded filename in the successful course-material page at `apps/web/src/app/teacher/courses/[id]/page.tsx:39`-`44`; `toTeacherMaterialView()` projects `fileName` and `mimeType` at `apps/web/src/features/lms/queries.ts:78`-`83`; the type and static tests intentionally allow teacher filename metadata at `packages/lms/src/types.ts:72`-`76` and `tests/integration/lms-ph3-1-static.test.ts:157`-`183`; but the DB browser spec calls `expectNoMaterialMetadataLeak(page, fileSha256, fileName)` immediately after upload and later on student/admin views at `tests/e2e/lms-db-materials.spec.ts:155`-`158`, `tests/e2e/lms-db-materials.spec.ts:192`-`195`, and `tests/e2e/lms-db-materials.spec.ts:230`-`237`. Recommendation: if Phase 3.26 means strict no filename-derived leakage on all LMS success surfaces, remove `fileName` and `mimeType` from `TeacherMaterialView`, stop projecting them in `toTeacherMaterialView()`, and render only title, size, and scan status. If teacher-visible filename is deliberately allowed, narrow the e2e no-leak claim to student/admin/public surfaces; do not claim strict filename-free success paths. Target part: teacher material DTO and course editor success UI.

5. Severity: Medium. Evidence: storage keys are no longer content-hash or filename-derived by construction: `buildLmsStorageKey()` uses a random UUID/object id and returns `lms/materials/${objectId}` at `packages/lms/src/materials.ts:128`-`131`, `storeLmsUploadedFile()` calls it directly at `apps/web/src/features/lms/material-storage.ts:67`-`70`, and `packages/lms/src/materials.test.ts:40`-`46` asserts the key does not contain the content hash or filename. However `isLmsMaterialStorageKey()` accepts any prefixed nested path without `..` at `packages/lms/src/materials.ts:138`-`140`, and the test explicitly accepts `lms/materials/ab/hash/name` at `packages/lms/src/materials.test.ts:53`-`61`. Recommendation: tighten local storage-key validation to the current opaque-key shape, for example `^lms/materials/[A-Za-z0-9_-]{16,80}$`, and update tests to reject nested hash/name-like keys. If future object storage needs partitioning, define opaque partition segments explicitly and forbid raw filenames/digests in every segment. Target part: `isLmsMaterialStorageKey()` and storage boundary tests.

6. Severity: Medium. Evidence: the scanner/e2e evidence boundary covers many static markers: `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`45` forbids file/base64/storage/hash/internal/auth markers and uploaded body prefixes; `tests/integration/lms-db-e2e-artifact-scan.test.ts:34`-`60` tests those marker classes; and `tests/e2e/lms-db-materials.spec.ts:101`-`106` creates per-run dynamic filename/body/hash values. The scanner does not consume a per-run manifest for exact dynamic filenames, hashes, signed URL hosts, or signed URL query parameters; if HAR/network traces or stdout capture the success response, the static scanner may miss new dynamic values. Recommendation: before archiving signed-delivery or DB-browser success evidence, either keep HAR/traces disabled and discard raw network logs, or generate a per-run marker manifest from the e2e spec and make `scan-lms-db-e2e-artifacts.mjs` reject exact dynamic filename/hash/signed-url markers. Target part: e2e artifact scanner and archive policy.

7. Severity: Medium. Evidence: fail-closed download sequencing is currently good: the handler rejects method, malformed ID, unauthenticated user, entitlement denial, missing DB, missing material, and unresolved storage before audit/stream at `apps/web/src/features/lms/material-download.ts:48`-`72`; the repository requires a clean, non-deleted file on a published lesson/course at `packages/db/src/repositories.ts:833`-`862`; unsupported providers fail closed through `resolveLmsMaterialFileBytes()` at `apps/web/src/features/lms/material-storage.ts:106`-`118`; focused tests cover no audit on unsupported provider at `tests/integration/lms-material-download-handler.test.ts:185`-`217`. Recommendation: preserve this order when removing filename leakage. Do not audit a download until storage resolution succeeds; do not issue any signed URL before session, entitlement, clean scan, non-deleted row, and published lesson/course checks pass. Target part: download handler control flow.

8. Severity: Medium. Evidence: typed config has `LMS_FILE_SCANNER_MODE` and a production public-upload fence at `packages/config/src/env.ts:61`-`64` and `packages/config/src/env.ts:96`-`102`, but upload storage always runs the local deterministic scanner at `apps/web/src/features/lms/material-storage.ts:65`-`71`; docs still mark real object storage, opaque keys, external malware scanning, signed redirects, object-store cleanup, and observed DB browser acceptance as open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:10`-`17` and `docs/DEPLOYMENT.md:54`-`59`. Recommendation: keep public uploads disabled until an actual scanner adapter exists. For `LMS_FILE_SCANNER_MODE=external`, the future upload path should create `pending` rows and fail closed for downloads until an external scanner marks clean; scanner failures/timeouts must remain non-downloadable and avoid filename/hash/key leakage in status/audit. Target part: scanner adapter state machine.

9. Severity: Low. Evidence: the active student DTO is narrow and excludes filename/hash/storage internals at `packages/lms/src/types.ts:60`-`70` and `apps/web/src/features/lms/queries.ts:65`-`75`, and static tests enforce that boundary at `tests/integration/lms-ph3-1-static.test.ts:148`-`173`. The older exported in-memory `Material` interface still exposes `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, quarantine, retention, and filename fields at `packages/lms/src/index.ts:41`-`60`. Recommendation: do not use the legacy `Material` interface for any production object-storage, signed-delivery, or client DTO work; split or mark it as internal/demo-only before broad LMS API expansion. Target part: LMS package public/internal type boundary.

## Decisions
- Current source has already removed the success-path `x-lms-sha256` header. Keep it removed.
- Current source has already replaced raw content-hash audit values with `hasContentHash`. Keep raw digests out of audit payloads.
- The next edit slice should target original filename leakage first: success download headers, raw audit payloads, and teacher success surfaces if the strict policy applies there.
- Do not weaken fail-closed behavior while cleaning headers/audits: storage must resolve and validate before success audit or streaming.
- Do not treat `fs-local`, DB-local browser evidence, or scanner source review as production object-storage or malware-scanner acceptance.

## Risks
- If `Content-Disposition` continues to use the uploaded filename, strict no filename-derived leakage cannot be claimed even with `x-lms-sha256` removed.
- If raw audit payloads keep filenames, operators with audit DB access can still recover filename-derived metadata from success events.
- If teacher views continue showing filename while e2e asserts filename absence, the DB browser acceptance spec is internally inconsistent and may fail when actually run.
- If storage-key validation remains prefix-only, future code can persist hash/name-like nested keys that later become sensitive in filesystem/object-store paths.
- If HAR, trace, stdout, or object-store redirect artifacts are retained without per-run marker scanning, successful filename/hash/signed-url leaks can bypass the current static scanner.

## Verification/tests
- RUN: read-only source inspection with `rg` and `Get-Content`.
- RUN: `git status --short` attempted; result was `fatal: not a git repository (or any of the parent directories): .git`.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run build`, `npm run secret:scan`, `npm run governance:check`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `node scripts/scan-lms-db-e2e-artifacts.mjs`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, and `npm run worker:smoke`; forbidden by this read-only audit scope.
- NOT RUN: servers, Playwright, DB commands, migrations/seeds, live endpoints, external object storage, malware scanners, signed redirects, Stripe, Axioma, TradingView, bot-control services, deployment, SSH/tmux/systemd.

## Next actions
1. Change `apps/web/src/features/lms/material-download.ts` so `Content-Disposition` uses an opaque MIME-derived attachment name, not `row.fileName`.
2. Update `tests/integration/lms-material-download-handler.test.ts` and `tests/e2e/lms-db-materials.spec.ts` so success headers do not contain the uploaded filename or `x-lms-sha256`; keep failure no-leak assertions.
3. Remove `fileName` from `materialAuditAfter()` and `recordMaterialDownloadAudit()` in `packages/db/src/repositories.ts`; replace it with a boolean only if operationally needed, and add audit JSON assertions for filename/hash/base64/key absence.
4. Resolve the teacher filename policy: for strict no filename-derived success leakage, remove `fileName`/`mimeType` from `TeacherMaterialView`, query projection, and teacher course rendering; update static tests accordingly.
5. Tighten `isLmsMaterialStorageKey()` and tests to reject nested hash/name-like paths under `lms/materials/`.
6. Extend the LMS DB e2e scanner with a per-run dynamic marker manifest before retaining HAR/traces/network artifacts or signed-delivery evidence.
7. Keep production upload rollout blocked until real object storage, external scanner, signed redirect, object-store cleanup/reconcile, and fresh DB browser acceptance are observed in a separate phase.
