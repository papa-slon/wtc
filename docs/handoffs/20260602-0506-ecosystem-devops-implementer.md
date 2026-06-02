# ecosystem-devops-implementer handoff
## Scope
Read-only devops/worker audit for Phase 3.33 durable LMS upload compensation retry.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `.env.example`
## Files changed
None - read-only audit.
## Findings
1. High - Existing compensation is request-local and not durable. Recommendation: add persisted pending compensation state before claiming production upload readiness. Target part: LMS upload lifecycle.
2. High - Existing worker cleanup cannot repair objects with no material row. Recommendation: add a dedicated pending/outbox/staging table or make `job_queue` real; do not reuse material cleanup. Target part: worker retry state.
3. High - Recommended flow is pending row before object PUT, resolve it in the same DB transaction that creates the material, and worker retry DELETE for remaining rows. Target part: DB package and web upload orchestrator.
4. Medium - Count-only observability should be extended with pending cleanup scanned/attempted/resolved/failed/dead-letter fields. Target part: worker health/admin ops.
## Decisions
- Do not use `job_queue` unless the phase implements a queue consumer.
- Prefer a dedicated LMS upload compensation table swept by cron-style worker.
- Treat DELETE `404` as resolved.
- Keep public uploads disabled until durable retry plus live acceptance and DB browser evidence are observed.
## Risks
- Multiple workers without claim semantics may duplicate idempotent DELETEs and skew counts.
- Live S3/R2 latency, IAM behavior, and error shapes remain unobserved.
## Verification/tests
Read-only audit only; no tests or gates run by this agent.
## Next actions
- Add durable state, worker sweep, focused tests, docs, and full gates.
