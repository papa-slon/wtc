# ecosystem-security-auditor handoff
## Scope
Phase 3.15 read-only security audit for LMS uploads and stored embed sanitizer, epoch 20260601-2142.

Focus areas:
- Auth, RBAC, entitlement, CSRF, and ownership gates around LMS teacher/admin/student flows.
- File upload safety for current and planned LMS materials.
- Stored embed sanitizer status and XSS exposure.
- Secret, PII, and audit-log requirements around LMS mutations.
- Existing tests and blocker documentation relevant to uploads and embeds.

No live services were started. No external calls were made. Product code was not edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/urls.ts`
- `packages/lms/src/lms.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Production blocker, active surface currently blocked: LMS file-byte uploads and stored embed sanitization are not implemented. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` states file byte storage and stored embed sanitizer are not built; `docs/EDUCATION_LMS_PLAN.md:53` through `docs/EDUCATION_LMS_PLAN.md:55` warns raw embed HTML storage would be stored-XSS; `docs/EDUCATION_LMS_PLAN.md:295` through `docs/EDUCATION_LMS_PLAN.md:299` requires size limits, MIME allowlist, virus scan/quarantine, signed URLs, and never returning `file_key`; `apps/web/src/app/teacher/courses/[id]/page.tsx:201` through `apps/web/src/app/teacher/courses/[id]/page.tsx:219` keeps materials link-only and labels file/embed as disabled. Recommendation: keep upload and embed write paths disabled until object storage, scanning/quarantine, signed access, retention, server-side embed sanitizer, and route/repo tests are implemented and reviewed. Target part: LMS uploads, stored embeds, teacher material/lesson authoring.

2. MEDIUM - Package and DB boundaries do not enforce the same link-only material constraint as the server action. Evidence: `apps/web/src/features/lms/actions.ts:51` through `apps/web/src/features/lms/actions.ts:64` restricts `materialSchema.kind` to `link`; however `packages/db/src/schema.ts:244` through `packages/db/src/schema.ts:249` defines `materials.kind` without a CHECK constraint, and `packages/db/src/repositories.ts:631` through `packages/db/src/repositories.ts:639` accepts and inserts arbitrary `kind: string`. Recommendation: add defense-in-depth validation in the repository and a migration-level CHECK for the currently enabled material kinds, preferably `kind = 'link'` until file/embed gates are built; add PGlite tests that direct repository calls reject `file`, `embed`, and unknown values before upload review is complete. Target part: `packages/db` LMS materials schema and repository.

3. MEDIUM - Lesson content type validation is caller-trusted at the repository boundary while the DB already permits `embed`. Evidence: `apps/web/src/features/lms/actions.ts:51` through `apps/web/src/features/lms/actions.ts:64` restricts lesson authoring to `video`, `article`, and `link`; `packages/db/migrations/0005_noisy_supreme_intelligence.sql:7` through `packages/db/migrations/0005_noisy_supreme_intelligence.sql:11` and `packages/db/src/schema.ts:224` through `packages/db/src/schema.ts:241` allow `embed`; `packages/db/src/repositories.ts:595` through `packages/db/src/repositories.ts:605` and `packages/db/src/repositories.ts:619` through `packages/db/src/repositories.ts:624` accept caller-provided `contentType?: string` directly. Recommendation: enforce the active safe content-type enum inside the package/repository boundary, or require a sanitizer-reviewed embed payload before accepting `embed`. Add a regression test proving repository/direct package calls cannot persist embed lessons until sanitizer storage is live. Target part: LMS lesson repository and future embed storage.

4. LOW - Audit action naming conflates current link-material creation with future real byte upload. Evidence: `apps/web/src/features/lms/actions.ts:314` through `apps/web/src/features/lms/actions.ts:326` routes link-only material creation through the attempted `material_upload` path; `packages/db/src/repositories.ts:631` through `packages/db/src/repositories.ts:639` records `education.material_upload`; `apps/web/src/app/teacher/materials/page.tsx:29` through `apps/web/src/app/teacher/materials/page.tsx:32` explicitly says upload bytes are not enabled. Recommendation: either split audit vocabulary into `education.material_link_create` and future `education.material_upload`, or document that `education.material_upload` currently means metadata-only material creation. Keep byte-storage identifiers, raw URLs containing secrets, and object keys out of audit payloads when real upload support lands. Target part: LMS audit taxonomy and material mutation observability.

## Decisions
- Current active LMS material write surface is link-only at the server action and UI level.
- Current active LMS lesson authoring does not expose stored raw embed HTML; render paths show an embed placeholder instead of evaluating HTML.
- Student LMS pages fail closed on entitlement before returning course or lesson detail.
- Teacher and admin LMS mutations use server-side auth/RBAC/ownership checks and CSRF before mutation.
- Existing LMS render paths guard outbound URLs with `safeHttpsUrl`, and lesson body text is rendered as escaped React text, not via `dangerouslySetInnerHTML`.
- No product code changes were made during this audit.

## Risks
- Future developers could bypass the web action schemas by calling `packages/db` repository functions directly, creating materials with unsupported kinds or lessons with `contentType = 'embed'` before upload/embed security gates are complete.
- The DB already contains forward-compatible `embed` lesson support, but the sanitizer and storage model are intentionally absent. That is acceptable only while UI/action/repository hardening keeps embed inactive.
- Real file uploads will introduce new secret and PII risks: object keys, original filenames, signed URL leakage, MIME spoofing, malware scanning state, retention/deletion behavior, and audit payload redaction.
- Audit consumers may misread `education.material_upload` as real byte upload even though the current flow only creates a link material.

## Verification/tests
- Ran read-only static inspection with `rg` and file reads only.
- No live services were started.
- No external calls were made.
- Tests inspected but not executed: `tests/integration/lms-ph3-1-static.test.ts`, `tests/integration/lms-rbac-pipeline.test.ts`, `tests/integration/lms-service.test.ts`, `tests/integration/lms-community-static.test.ts`, and `tests/e2e/education-ph3-1-mobile.spec.ts`.
- Gates run this session: source inspection, docs inspection, static test inspection.
- Gates not run: `node scripts/gates.mjs full`, Vitest, Playwright, database migration/seeding, local app server, live service checks. Reason: this was a read-only security audit with no live services and no product-code edits.

## Next actions
1. Before enabling LMS file uploads, implement object-storage adapter boundaries, size limits, MIME and content sniffing, malware scan/quarantine states, signed access, retention/deletion rules, filename normalization, and audit redaction rules.
2. Before enabling stored embeds, implement a server-side allowlist sanitizer before DB write, reject scripts, event handlers, `javascript:` URLs, `data:` URLs, unsafe iframe attributes, and add tests for hostile stored payloads.
3. Add repository and DB defense-in-depth for active LMS material and lesson constraints so direct package calls cannot bypass the current action schemas.
4. Decide whether to rename or split the current link-material audit action before real upload support lands.
5. Re-run the full repo gate suite in an implementation session after the hardening changes are made.
