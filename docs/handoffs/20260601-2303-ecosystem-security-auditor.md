# ecosystem-security-auditor handoff
## Scope
Phase 3.17 read-only security audit of LMS file upload/download security after Phase 3.15.

Focus areas:
- Malware scanning and quarantine readiness.
- Object key and raw byte leakage.
- Download and embed-related headers.
- MIME and content policy.
- Raw bytes in DB and retention/deletion states.
- Audit redaction and failure observability.
- Fail-closed student access.
- A bounded local implementation slice that improves production readiness without external scanners or live object storage.

No live services were started. No Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoint was called. Product code was not edited.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-2142-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/SECURITY_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/security-headers.test.ts`
- `apps/web/src/middleware.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/e2e/security-headers.spec.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Malware scan/quarantine state is still absent, so an accepted file becomes downloadable as soon as it is attached to a published lesson. Evidence: `packages/lms/src/materials.ts:62`-`packages/lms/src/materials.ts:74` normalizes filename, declared MIME, size, SHA-256, and base64 bytes but has no scan verdict; `apps/web/src/features/lms/actions.ts:120`-`apps/web/src/features/lms/actions.ts:127` builds a file material directly from the browser `File`; `packages/db/src/repositories.ts:723`-`packages/db/src/repositories.ts:743` returns any `kind='file'` row for a published course/lesson after byte/hash integrity checks; `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still lists production object storage, malware scanning/quarantine, retention policy, and DB-backed browser acceptance as open. Recommendation: add local scan/quarantine lifecycle before production rollout: `scanStatus` (`pending`, `clean`, `rejected`, `quarantined`), `scanReason`, `scannedAt`, and fail-closed download filtering so only `clean` files can stream. The first implementation can use a deterministic local scanner interface with no external calls. Target part: `@wtc/lms` file policy, `packages/db` materials schema/repositories, LMS download route.

2. HIGH - MIME policy trusts the client-declared MIME type and does not sniff content. Evidence: the allowlist is declared in `packages/lms/src/materials.ts:5`-`packages/lms/src/materials.ts:10`; `normalizeLmsFileUpload` lowercases and allowlists `input.mimeType` at `packages/lms/src/materials.ts:62`-`packages/lms/src/materials.ts:67`; the action passes `file.type` from the browser at `apps/web/src/features/lms/actions.ts:120`-`apps/web/src/features/lms/actions.ts:126`; repository insertion only checks non-empty fields, positive size, a 64-hex hash, and base64 presence at `packages/db/src/repositories.ts:655`-`packages/db/src/repositories.ts:668`. Tests cover unsupported declared MIME but not spoofed content: `packages/lms/src/materials.test.ts:24`-`packages/lms/src/materials.test.ts:28`. Recommendation: add byte sniffing for the current allowlist (PDF header, PNG signature, JPEG SOI/EOI where practical, bounded UTF-8/text validation), reject MIME/content mismatches, and make the DB repository revalidate normalized file payloads instead of trusting callers. Target part: `@wtc/lms` upload normalization, `createMaterial`, upload tests.

3. HIGH - Raw file bytes are stored in the application DB with no material-level retention/deletion/quarantine lifecycle. Evidence: `materials.file_bytes_base64` is a schema column at `packages/db/src/schema.ts:256`-`packages/db/src/schema.ts:261`; the repository comment confirms local DB byte storage at `packages/db/src/repositories.ts:681`; `deleteMaterial` hard-deletes the row at `packages/db/src/repositories.ts:694`-`packages/db/src/repositories.ts:707`; the production blocker keeps retention policy open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. Recommendation: treat DB byte storage as local-only, then add explicit lifecycle fields (`storageBackend`, `deletedAt`, `deletedBy`, `deleteReason`, scan/quarantine fields) and change teacher delete to a soft-delete/tombstone path that removes student download eligibility immediately while preserving auditability. Target part: materials schema, delete repository/action, download lookup.

4. MEDIUM - Successful download audit is redacted, but failed download attempts are not audited. Evidence: `recordMaterialDownloadAudit` records safe metadata and excludes file bytes at `packages/db/src/repositories.ts:757`-`packages/db/src/repositories.ts:772`; redaction is applied by `auditRowValues` via `buildEvent` at `packages/db/src/repositories.ts:216`-`packages/db/src/repositories.ts:234`; the handler returns unauthenticated, denied, DB-not-configured, and not-found responses before the success audit call at `apps/web/src/features/lms/material-download.ts:43`-`apps/web/src/features/lms/material-download.ts:61`. Recommendation: record redacted `education.material_download` failure events for authenticated denied/not-found/quarantined/deleted cases, with categorical reasons only and without file bytes, object keys, signed URLs, raw request bodies, or stack traces. Target part: LMS download handler and audit schema/tests.

5. MEDIUM - Global CSP does not explicitly model the newly active sanitized embed allowlist. Evidence: sanitized embeds allow YouTube and Vimeo hosts at `packages/lms/src/materials.ts:32`-`packages/lms/src/materials.ts:36`; the student lesson page renders an iframe with sandbox and parsed sanitized props at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:10`-`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:23`; the CSP builder emits `default-src`, script/style/img/font/connect, `object-src`, and `frame-ancestors`, but no `frame-src` directive at `packages/auth/src/security-headers.ts:47`-`packages/auth/src/security-headers.ts:58`. Recommendation: add an explicit `frame-src` allowlist for the exact embed hosts already accepted by `@wtc/lms`, keep `frame-ancestors 'none'`, and add unit/e2e assertions so future provider additions update sanitizer and CSP together. Target part: `@wtc/auth/security-headers`, LMS embed tests.

6. LOW - No object-key leakage was observed in the current local DB-backed design, but the invariant is not yet locked by a direct test for the future object-storage path. Evidence: student material mapping emits a server download URL for files at `apps/web/src/features/lms/queries.ts:64`-`apps/web/src/features/lms/queries.ts:76`; the design contract says `file_key` must never be returned and downloads should go through an entitlement-checked endpoint at `docs/EDUCATION_LMS_PLAN.md:295`-`docs/EDUCATION_LMS_PLAN.md:299`. Recommendation: when object storage lands, add static and route tests that `file_key`, `object_key`, signed URLs, and `fileBytesBase64` never appear in `MaterialView`, JSON/API responses, audit rows, screenshots, or error bodies. Target part: object-storage adapter contract, LMS query mappers, route tests.

## Decisions
- Current LMS file support is a local acceptance slice, not production object storage.
- Current download access fails closed on session, education entitlement, DB availability, and published course/lesson visibility before bytes stream.
- Current download response headers are reasonably strict for local files: `private, no-store`, attachment disposition, `nosniff`, `no-referrer`, and explicit content length.
- Current student/teacher views do not expose DB file bytes or object keys; file materials expose a server route path only.
- Current audit success payloads avoid raw file bytes and raw embed HTML; the audit redaction layer also redacts 64+ hex values.
- Embed rendering avoids `dangerouslySetInnerHTML` and uses parsed sanitized iframe props.
- No production object-storage or external malware-scanner design should be implied from the Phase 3.15 local DB byte storage.

## Risks
- Without scan/quarantine states, a malicious but allowlisted upload can be served to every entitled student of a published course.
- Without content sniffing, MIME spoofing can bypass the current allowlist because the browser-provided `File.type` is trusted.
- DB byte storage expands database breach impact and has no material-specific soft delete or purge lifecycle yet.
- Failed download probing is invisible in audit logs, reducing incident visibility around material enumeration attempts.
- Sanitizer and CSP can drift unless the allowed iframe host list is enforced in both places.
- Future object-storage work can accidentally leak object keys or signed URLs unless tests lock the no-leak contract.

## Verification/tests
- Ran read-only static inspection with `rg`, `Get-Content`, and line-numbered file reads only.
- Checked that the required handoff path did not already exist before writing it.
- Checked git status read-only; this workspace is not a git repo in the current directory.
- No live services were started.
- No external calls were made.
- Tests inspected but not executed: `packages/lms/src/materials.test.ts`, `tests/integration/db-lms-ph3-1.test.ts`, `tests/integration/lms-material-download-handler.test.ts`, `tests/integration/lms-ph3-1-static.test.ts`, `packages/auth/src/security-headers.test.ts`, and `tests/e2e/security-headers.spec.ts`.
- Gates run this session: source inspection, docs inspection, static test inspection.
- Gates not run: `node scripts/gates.mjs full`, Vitest, Playwright, database migration/seeding, local app server, live service checks. Reason: this was a read-only security audit phase with no product-code edits, no servers, and no live endpoints.

## Next actions
1. Implement a bounded local LMS file-safety slice: add material lifecycle columns (`scanStatus`, `scanReason`, `scannedAt`, `deletedAt`, `deletedBy`, `deleteReason`, `storageBackend`) and make downloads require `scanStatus='clean'` and `deletedAt IS NULL`.
2. Add a deterministic local scanner interface in `@wtc/lms` with no external calls: MIME/content sniffing, EICAR/test-string rejection, archive rejection for now, and categorical verdicts. Keep external scanner and object storage as later adapters behind the same interface.
3. Revalidate file payloads in `packages/db` repository boundaries and add tests for spoofed PDF/PNG/JPEG/TXT content, mismatched MIME, over-size, empty, rejected, quarantined, pending, and deleted file states.
4. Add failure audit coverage for material download attempts and verify audit rows do not contain raw bytes, object keys, signed URLs, raw bodies, or stack traces.
5. Add `frame-src` CSP allowlisting for the same YouTube/Vimeo hosts accepted by the embed sanitizer, plus tests that sanitizer and CSP provider lists stay synchronized.
6. Before production object storage, add no-leak tests for `file_key`/`object_key`/signed URL/`fileBytesBase64` across views, route responses, audit rows, screenshots, and error payloads.
