# ecosystem-tests-runner handoff
## Scope
Read-only test strategy review for Phase 3.32 LMS object-upload compensation.
## Files inspected
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `scripts/gates.mjs`
## Files changed
None - read-only audit.
## Findings
1. High - Storage helper tests alone would not prove `createMaterialAction` compensates after DB failure; evidence: the action can bypass a helper even if helper tests pass. Recommendation: extract/test the create-material compensation orchestrator and statically assert action wiring; target part: LMS integration/static tests.
2. Medium - Failed compensation must be covered because preserving the DB error is part of the observable contract; evidence: otherwise a delete failure could mask the material-creation failure. Recommendation: add an injected failing compensation test; target part: helper tests.
3. Medium - Non-file/link material failures should not trigger object delete; evidence: only a file upload can have produced an object. Recommendation: add a non-file no-op test; target part: helper tests.
## Decisions
- Require focused tests for the new helper plus existing storage and static guards before broad gates.
- Keep live S3/R2 and DB browser gates listed as not run until observed.
## Risks
- Local mocked fetch tests do not prove live object-store error shapes or retry windows.
- Duplicate object signing helpers between web and worker remain a regression surface until shared.
## Verification/tests
- Required local proof: focused helper/storage/static tests, broader LMS/config/worker/scanner focused tests, root/web typechecks, worker smoke, full, e2e, artifact scanner, secret scan, governance.
## Next actions
- Add durable retry/outbox tests when the production cleanup-debt design lands.
