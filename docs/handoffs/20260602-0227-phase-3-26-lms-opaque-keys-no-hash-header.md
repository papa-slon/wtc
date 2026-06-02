# Phase 3.26 LMS opaque keys and no hash header handoff
## Scope
Implement the next bounded LMS storage security slice after Phase 3.25: keep new local LMS material storage keys opaque and non-deterministic, remove/pin absence of the successful download `x-lms-sha256` header, keep raw content digests out of upload/download audit payloads, and strengthen generated-artifact scanning for the deprecated hash header.

This phase does not implement S3/R2 object storage, signed-object redirects, external malware scanning, object-store delete/reconciliation, public upload rollout, strict filename-free download/audit policy, or the not-yet-observed DB-backed browser acceptance run.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0227-ecosystem-education-implementer.md](20260602-0227-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0227-ecosystem-backend-implementer.md](20260602-0227-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0227-ecosystem-security-auditor.md](20260602-0227-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0227-ecosystem-tests-runner.md](20260602-0227-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.

## Files inspected
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0227-phase-3-26-lms-opaque-keys-no-hash-header.md`

## Findings
1. Severity: High. New runtime LMS storage keys must not include content hashes, filenames, course/lesson IDs, or material IDs. Recommendation implemented: new keys are generated as a single opaque segment under `lms/materials/` through `node:crypto.randomUUID()`, and upload/storage tests prove identical file names and bytes produce different keys.
2. Severity: High. Successful LMS material downloads must not expose the raw content digest in `x-lms-sha256`. Recommendation implemented: the success header is absent, focused handler tests and the opt-in DB browser spec assert absence, and the LMS DB artifact scanner now rejects the deprecated header name in generated text artifacts.
3. Severity: Medium. Server-side integrity still needs private digests for DB-local/fs-local byte validation. Decision preserved: `contentSha256` remains internal DB/storage metadata, but upload/download audit payloads use `hasContentHash` instead of the raw digest.
4. Severity: Medium. Backward-compatible reads and cleanup still need to tolerate older safe prefixed local keys. Decision preserved: this phase proves new-write opacity without tightening broad read/cleanup prefix compatibility in `isLmsMaterialStorageKey()`.
5. Severity: High. Strict filename-free success paths are still open. The security audit found original filenames remain in successful `Content-Disposition`, upload/download audit payloads, and teacher material surfaces. This phase records that as the next bounded security slice rather than mixing it into the hash/key scope.

## Decisions
- Treat "opaque local key" as a new-write invariant: `lms/materials/<opaque id>`, no filename/hash/nested generated path.
- Keep the broader local storage-key validator path-safe and legacy-compatible for existing local rows.
- Keep server-private content hashes for integrity checks, but keep raw hashes out of response headers, audit payloads, DTOs, generated artifacts, and current rendered surfaces.
- Add generated-artifact scanner coverage for the removed `x-lms-sha256` header.
- Keep production object storage, external scanner, signed redirects, object-store cleanup, public upload rollout, and filename-free success policy as separate not-run blockers.

## Risks
- Successful downloads still use the uploaded filename in `Content-Disposition`; strict no filename-derived leakage cannot be claimed until a later phase changes that policy and tests.
- Upload/download audit payloads still include original filenames; strict audit filename minimization remains open.
- Teacher material management still has display-only filename/MIME metadata by design; the strict filename policy needs a product decision before removal.
- `fs-local` remains local development storage, not durable production object storage.
- The workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status or commit evidence is available in this folder.

## Verification/tests
RUN:
1. `npm test -- packages/lms/src/materials.test.ts tests/integration/lms-material-storage.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-db-e2e-harness.test.ts` - PASS, 42 tests.
2. `npm test -- packages/lms/src/materials.test.ts tests/integration/lms-material-storage.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-db-e2e-harness.test.ts` after the `node:crypto.randomUUID()` portability patch - PASS, 42 tests.
3. `npm test -- packages/lms/src/materials.test.ts tests/integration/lms-material-storage.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS, 49 tests.
4. `npm run typecheck` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `node scripts/gates.mjs full` - PASS, 9/9 gates (governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build).
7. `node scripts/gates.mjs e2e` - PASS, 44 Playwright tests.
8. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 image files, 0 blocked containers, 2 missing roots, 70 total artifact files.
9. Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
1. `npm run e2e:lms:db` - no `LMS_E2E_DATABASE_URL`.
2. `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
3. Real S3/R2 object storage, external malware scanner, signed redirects, object-store delete/reconciliation, public upload rollout, live Stripe/Axioma/TV/bot-control acceptance, and deployment actions - not in scope / no credentials.

## Next actions
1. Run and record the pending typecheck/full/e2e/scanner/governance gates for this phase.
2. In the next bounded LMS security phase, decide and implement filename minimization for successful `Content-Disposition`, upload/download audit payloads, and teacher material surfaces if strict filename-free policy is required.
3. Add the production object-storage phase separately: S3/R2 adapter, signed redirects, external scanner state, object delete/reconciliation, and live credentialed acceptance.
4. When a fresh throwaway/admin DB URL is available, run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` and archive only scanner-passed, redacted evidence.
