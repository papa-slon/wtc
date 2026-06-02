# ecosystem-devops-implementer handoff
## Scope
Read-only deployment/operations review for Phase 3.32 LMS upload compensation.
## Files inspected
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `docs/DEPLOYMENT.md`
- `docs/NEXT_ACTIONS.md`
## Files changed
None - read-only audit.
## Findings
1. High - Worker-side reconciliation cannot repair an object when material DB creation never wrote a row; evidence: worker candidate selection is DB-row based. Recommendation: request-local compensation is the pragmatic local bridge, but durable outbox/pending-row remains required; target part: upload lifecycle/deployment docs.
2. Medium - Do not import worker cleanup code into the web app; evidence: worker code is a DB maintenance boundary and should not expand request-path dependencies. Recommendation: keep web compensation small and storage-boundary-local; target part: web LMS storage helper.
3. Medium - Live object-store acceptance remains not run; evidence: no operator-approved live S3/R2 credentials in session. Recommendation: keep `LMS_PUBLIC_UPLOADS_ENABLED=false` and list live S3/R2/scanner/DB browser/public rollout as not run; target part: deployment status.
## Decisions
- Keep Phase 3.32 deployable only as local mocked best-effort compensation.
- Keep `job_queue` and worker orchestration untouched because the current queue is reserved/unconsumed for this lifecycle gap.
## Risks
- Live R2/S3 delete behavior, IAM policy, endpoint latency, and retry behavior are unobserved.
- A future durable path needs explicit operational monitoring for pending cleanup debt.
## Verification/tests
- Recommended local gates: focused LMS tests, typechecks, worker smoke, full gate, e2e gate, artifact scanner, secret scan, governance.
## Next actions
- Design and operate a durable pending cleanup/outbox worker before production upload enablement.
- Run live S3/R2 upload/download/delete/reconcile acceptance with disposable credentials and redacted artifacts.
