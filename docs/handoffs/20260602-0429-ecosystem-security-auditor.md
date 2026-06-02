# ecosystem-security-auditor handoff
## Scope
Read-only security review for Phase 3.32 LMS object-upload compensation and no-leak boundaries.
## Files inspected
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `packages/db/src/repositories.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
## Files changed
None - read-only audit.
## Findings
1. High - Best-effort request-local compensation is not durable if DELETE fails, times out, or the process exits; evidence: no DB row/outbox can exist when material insert fails. Recommendation: do not call this production-complete until a durable pending-row/outbox/staging-key retry path exists; target part: LMS upload lifecycle.
2. Medium - Compensation must only target clean `s3-r2` objects that were actually written; evidence: Phase 3.30 quarantined object rows are metadata-only. Recommendation: gate compensation by provider, storage key, and clean scan status; target part: material storage helper.
3. Medium - Failed compensation should not replace the original DB/material creation error; evidence: security/audit troubleshooting needs the first failing boundary preserved. Recommendation: swallow compensation failure locally and rethrow the original DB error; target part: material-create orchestrator.
## Decisions
- Treat Phase 3.32 as local security hardening only.
- Keep audit/log surfaces free of raw object keys, signed URLs, auth headers, filenames, hashes, scanner details, and secrets.
## Risks
- Web and worker both own SigV4 DELETE signing, so future drift is possible until object-store primitives are shared.
- No live S3/R2 or external scanner credentials were used, so cloud-side IAM/policy/error-shape behavior is unverified.
## Verification/tests
- Recommended tests: signed DELETE without secret leakage, 404-as-reconciled, quarantined no-op, original DB error preservation, failed compensation swallowing, artifact scanner, and secret scan.
## Next actions
- Add durable retry semantics and shared object-store primitives before live/public upload rollout.
