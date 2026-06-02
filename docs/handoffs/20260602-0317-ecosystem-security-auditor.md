# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.29 security audit for the LMS production object-storage boundary: signed URLs, object keys, audit logs, responses, artifact scans, secrets, RBAC/entitlement sequencing, and no live S3/R2 acceptance claims.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`; `apps/web/src/features/lms/queries.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/types.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/repositories.ts`; `packages/audit/src/redact.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `scripts/run-lms-db-e2e.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-ph3-1-static.test.ts`; `.env.example`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/NEXT_ACTIONS.md`.
## Files changed
None - read-only audit
## Findings
1. High - S3/R2 was not implemented or configurable. Recommendation: add a named production provider only with fail-closed endpoint/bucket/region/credential validation and no public-upload enablement until external scanning is configured. Target part: config and storage boundary.
2. High - Upload stored the file before course ownership was checked. Recommendation: move DB lookup and ownership validation before external object writes or stage-and-delete on authorization failure. Target part: LMS upload action sequencing.
3. High - Download gating order is good today but only supports bytes. Recommendation: add bytes-or-redirect delivery, preserve auth/entitlement order, audit only after signed URL generation, return short-lived no-store redirect with no body. Target part: download handler and storage resolver.
4. Medium - Artifact scanner lacked signed-URL-specific deny rules. Recommendation: reject `X-Amz-Signature`, `X-Amz-Credential`, `AWSAccessKeyId`, and use dynamic markers for any retained signed URL evidence. Target part: scanner and harness.
5. Medium - S3/R2 must not add object URLs, storage keys, signatures, or credentials to audit payloads. Target part: repository audit payloads and admin audit surface.
6. Medium - External malware scanning is still a config gate, not an implementation. Target part: upload pipeline and scanner adapter.
7. Medium - Object-store cleanup/reconciliation is open. Target part: worker cleanup and object-store lifecycle.
8. Low - Storage-key validation should be tightened before signing URLs. Recommendation: enforce `lms/materials/<opaque-id>` for production object-store rows and percent-encode path segments. Target part: key validator and signer.
## Decisions
Do not claim live S3/R2 acceptance from current code. Signed redirects must be short-lived, entitlement-gated, no-store, server-generated, and audit logs must remain summary-only. Public uploads remain blocked until object storage and external scanner are both implemented and observed.
## Risks
External object writes before ownership checks can orphan objects or enable storage abuse. Signed URLs may leak through traces/logs/screenshots/admin surfaces. DB rows can outlive object-store state without cleanup/reconciliation.
## Verification/tests
Read-only audit only. No tests or gates were run by this agent.
## Next actions
1. Implement explicit `s3-r2` provider with fail-closed config.
2. Reorder upload authorization before external writes.
3. Refactor downloads to bytes-or-signed-redirect delivery.
4. Add signed URL leak tests and scanner rules.
5. Keep docs clear that local tests do not equal live S3/R2 acceptance.
6. Add external scanner and object cleanup before public rollout.
