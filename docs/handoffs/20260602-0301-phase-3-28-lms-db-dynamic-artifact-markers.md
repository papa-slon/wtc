# Phase 3.28 LMS DB dynamic artifact markers handoff
## Scope
Implement the next bounded LMS evidence-hardening slice after Phase 3.27: add transient per-run dynamic marker coverage to the guarded LMS DB browser artifact scanner so exact uploaded bodies, filenames, hashes, and raw embed strings are scanned without printing or archiving those marker values.

This phase does not run the opt-in DB browser gate because no `LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL` is available. It does not implement S3/R2 object storage, signed-object redirects, external malware scanning, object-store delete/reconciliation, public upload rollout, or live credentialed acceptance.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0301-ecosystem-education-implementer.md](20260602-0301-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0301-ecosystem-devops-implementer.md](20260602-0301-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0301-ecosystem-security-auditor.md](20260602-0301-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0301-ecosystem-tests-runner.md](20260602-0301-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.

## Files inspected
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0301-phase-3-28-lms-db-dynamic-artifact-markers.md`

## Findings
1. Severity: High. Static artifact deny rules cannot catch per-run filenames, hashes, or raw payloads if those values appear in retained text traces. Recommendation implemented: the DB browser spec appends exact dynamic markers to a transient manifest.
2. Severity: High. The dynamic marker manifest contains sensitive evidence values and must not become an artifact. Recommendation implemented: `scripts/run-lms-db-e2e.mjs` creates `.next-e2e-db/lms-db-e2e-dynamic-markers.json`, passes it as `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, and deletes it in `finally`.
3. Severity: High. Scanner failures must not print matched marker values. Recommendation implemented: dynamic marker hits report only safe labels such as `dynamic LMS marker uploaded filename`.
4. Severity: Medium. Malformed marker manifests should fail closed. Recommendation implemented: configured manifests are required to exist, parse as JSON, use version `1`, contain a bounded marker array, and have safe labels and non-empty bounded values.
5. Severity: Medium. Base64 artifacts can leak marker values even when raw text is absent. Recommendation implemented: scanner checks each dynamic marker value and its UTF-8 base64 form.

## Decisions
- Use `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` as the explicit scanner/runner contract.
- Store the manifest under `.next-e2e-db`, outside the documented archive roots, and delete it before final archive instructions.
- Keep generated screenshots image-skipped; visual evidence still needs human review or discard.
- Keep the opt-in DB browser acceptance gate NOT RUN until a throwaway/admin Postgres URL is provided.

## Risks
- This phase strengthens evidence scanning but does not itself execute `npm run e2e:lms:db`; real DB browser acceptance remains unobserved.
- If future signed redirects add dynamic signed URL values, their specs must append those values to the same manifest before retaining network traces.
- The workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status or commit evidence is available in this folder.

## Verification/tests
RUN:
1. `npm test -- tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts` - PASS, 17 tests.
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `node scripts/gates.mjs full` - PASS, 9/9 gates (governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build).
5. `node scripts/gates.mjs e2e` - PASS, 44 Playwright tests.
6. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 image files, 0 blocked containers, 2 missing roots, 70 total artifact files, 0 dynamic markers because this standalone scan was not run through the opt-in DB runner.
7. Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
1. `npm run e2e:lms:db` - no `LMS_E2E_DATABASE_URL`.
2. `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
3. Real S3/R2 object storage, external malware scanner, signed redirects, object-store delete/reconciliation, public upload rollout, live Stripe/Axioma/TV/bot-control acceptance, and deployment actions - not in scope / no credentials.

## Next actions
1. Run the pending full/e2e/scanner/governance gates and update this aggregate plus current docs with observed results.
2. When a fresh throwaway/admin DB URL is available, run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` and archive only scanner-passed, redacted evidence.
3. Add the production object-storage phase separately: S3/R2 adapter, signed redirects, external scanner state, object delete/reconciliation, and live credentialed acceptance.
