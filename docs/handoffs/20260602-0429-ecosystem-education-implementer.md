# ecosystem-education-implementer handoff
## Scope
Read-only LMS review for Phase 3.32: object-upload compensation after a clean `s3-r2` PUT succeeds but material DB creation fails.
## Files inspected
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `tests/integration/lms-material-storage.test.ts`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/NEXT_ACTIONS.md`
## Files changed
None - read-only audit.
## Findings
1. High - A clean object PUT followed by `createMaterial` failure could leave an object with no DB row and no worker-visible retry state; evidence: `apps/web/src/features/lms/actions.ts` material creation flow. Recommendation: add request-local compensation for the already-prepared file input and keep durable retry as a production blocker; target part: LMS upload action/orchestrator.
2. Medium - Compensation must be executable and tested at action orchestration level, not only as a storage helper; evidence: helper-only storage tests would not prove the action delegates on DB failure. Recommendation: extract a small injectable material-create orchestrator and cover original-error preservation; target part: LMS action tests.
3. Medium - Documentation still described compensation/outbox as entirely open after Phase 3.31; evidence: `docs/EDUCATION_LMS_PLAN.md` and `docs/NEXT_ACTIONS.md`. Recommendation: document local best-effort compensation separately from durable outbox/live acceptance; target part: LMS status docs.
## Decisions
- Keep Phase 3.32 to local best-effort synchronous compensation for clean `s3-r2` file uploads.
- Leave durable pending-row/outbox/staging-key retry as explicit future production work.
## Risks
- A failed compensation DELETE can still orphan an object because no durable retry row exists when DB creation fails.
- Teacher-facing failure copy remains generic and does not distinguish DB failure from compensated upload cleanup.
## Verification/tests
- Recommended focused storage/action-orchestration tests plus final typecheck/full/e2e/scanner/secret/governance gates.
## Next actions
- Implement durable pending/outbox/staging-key retry before claiming production upload readiness.
- Revisit user-facing material-upload failure copy after durable retry design is selected.
