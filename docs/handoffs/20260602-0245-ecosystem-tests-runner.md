# ecosystem-tests-runner handoff
## Scope
Phase 3.27 read-only tests/devops audit before implementation for LMS filename minimization. Scope covered focused Vitest sources, the opt-in DB-backed Playwright LMS spec, static harness guards, generated-artifact scanner, docs/gate status, and post-implementation gate recommendations. No product code, test code, docs, gates, servers, DB commands, Playwright, or live services were run or changed outside this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `packages/lms/src/materials.ts`
- `packages/db/src/repositories.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`

## Files changed
None — read-only audit

## Findings
1. HIGH - Success-path download tests are stale for filename minimization. Evidence: current download code maps MIME types to generic attachment names at `apps/web/src/features/lms/material-download.ts:33` to `apps/web/src/features/lms/material-download.ts:47`, but the handler test still expects the original upload filename at `tests/integration/lms-material-download-handler.test.ts:114` to `tests/integration/lms-material-download-handler.test.ts:121`, and the DB-backed Playwright spec still expects the success `content-disposition` to contain `fileName` at `tests/e2e/lms-db-materials.spec.ts:210` to `tests/e2e/lms-db-materials.spec.ts:216`. Recommendation: update success-path assertions to allow a generic safe filename such as `lesson-material.txt` while explicitly asserting the original upload name is absent from success headers. Target part: focused Vitest and opt-in DB browser spec.
2. HIGH - The static DB-e2e harness does not yet pin filename-free success behavior. Evidence: the harness only checks that the spec contains `content-disposition`, `x-content-type-options`, and no old hash-header equality at `tests/integration/lms-db-e2e-harness.test.ts:76` to `tests/integration/lms-db-e2e-harness.test.ts:91`; it does not require a negative assertion against the original `fileName`. The Playwright spec already defines `fileName` and `leakMarkers` at `tests/e2e/lms-db-materials.spec.ts:101` to `tests/e2e/lms-db-materials.spec.ts:106`, but the success response does not run through the failure no-leak helper at `tests/e2e/lms-db-materials.spec.ts:58` to `tests/e2e/lms-db-materials.spec.ts:73`. Recommendation: add static checks that the DB spec asserts `content-disposition` does not contain `fileName` and that success headers are checked with the same marker discipline as failure headers. Target part: `tests/integration/lms-db-e2e-harness.test.ts`.
3. HIGH - Audit no-filename coverage is too indirect. Evidence: repository upload audit metadata omits `fileName` at `packages/db/src/repositories.ts:716` to `packages/db/src/repositories.ts:728`, and download audit metadata omits `fileName` at `packages/db/src/repositories.ts:880` to `packages/db/src/repositories.ts:895`. Existing handler assertions check no hash/base64/body marker in the download audit at `tests/integration/lms-material-download-handler.test.ts:124` to `tests/integration/lms-material-download-handler.test.ts:128`, but they do not assert `CLEAN_FILE_NAME` is absent. The DB browser admin page checks no material metadata on rendered audit UI at `tests/e2e/lms-db-materials.spec.ts:230` to `tests/e2e/lms-db-materials.spec.ts:236`, but that is not a raw audit-row assertion. Recommendation: add raw audit-row assertions for both `education.material_upload` and `education.material_download` that original filenames are absent while summary fields remain. Target part: DB/repository integration and download handler tests.
4. MEDIUM - Generated-artifact scanning does not yet deny the dynamic original LMS filename marker. Evidence: scanner forbidden markers include internal material fields, storage path, raw content markers, deprecated `x-lms-sha256`, auth headers, and DB URLs at `scripts/scan-lms-db-e2e-artifacts.mjs:12` to `scripts/scan-lms-db-e2e-artifacts.mjs:46`, but no rule covers the DB-e2e filename prefix created at `tests/e2e/lms-db-materials.spec.ts:101`. Scanner tests cover metadata and auth header leaks at `tests/integration/lms-db-e2e-artifact-scan.test.ts:45` to `tests/integration/lms-db-e2e-artifact-scan.test.ts:60`, but not filename leaks. Recommendation: add a deny rule and fixture for the DB-e2e original filename prefix, for text artifacts only; keep image screenshots skipped and rely on DOM/source assertions for visible UI filename policy. Target part: artifact scanner and scanner tests.
5. MEDIUM - Docs already treat filename-free delivery/audit as open, so post-implementation docs must be updated only after fresh gate evidence. Evidence: `docs/STATUS.md:14` to `docs/STATUS.md:16`, `docs/NEXT_ACTIONS.md:11` to `docs/NEXT_ACTIONS.md:13`, `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`, `docs/DEPLOYMENT.md:54` to `docs/DEPLOYMENT.md:59`, and `docs/ACCEPTANCE_MATRIX_MASTER.md:86` to `docs/ACCEPTANCE_MATRIX_MASTER.md:90` still keep filename-free download/audit policy in the open production-blocker bucket. Recommendation: after implementation and gates, update only current status/next-actions/implemented-files/blocker docs, not historical handoffs, and keep real S3/R2, signed redirects, external scanner, object-store cleanup, and DB browser acceptance separate. Target part: docs truth after tests.
6. MEDIUM - The opt-in DB browser acceptance gate remains outside default gates and cannot be claimed without supplied DB URLs. Evidence: root scripts define `e2e:lms:db` and `e2e:lms:db:managed` at `package.json:28` to `package.json:29`, while the static harness explicitly checks the DB browser gate stays out of default gates at `tests/integration/lms-db-e2e-harness.test.ts:119` to `tests/integration/lms-db-e2e-harness.test.ts:127`. Recommendation: run the opt-in DB browser gate only when a fresh `LMS_E2E_DATABASE_URL` or managed admin URL is available; otherwise list it as NOT RUN in the final report. Target part: phase verification and final reporting.

## Decisions
- Treat original filenames as sensitive success-response and audit metadata for this phase. A success `Content-Disposition` header may remain, but it should use a generic MIME-derived attachment name and must not contain the original upload filename.
- Keep the DB-backed browser LMS run opt-in; do not fold `npm run e2e:lms:db` into `scripts/gates.mjs full`.
- Do not use generated artifact scanning as the only filename guard because screenshots are image-skipped; pair scanner rules with DOM/header/static assertions.

## Risks
- Updating only the direct failing assertions would make the focused tests green while leaving a future regression path for original filenames in headers or raw audit payloads.
- If teacher material surfaces remain display-only filename/MIME by design, tests must distinguish teacher management UI from student/download/admin-audit surfaces to avoid false failures.
- Without a supplied throwaway DB URL, the Playwright DB-backed upload/download/browser flow remains source-inspected but not observed live.

## Verification/tests
- Not run by instruction: no npm, Vitest, Playwright, DB, server, scanner, or gate command was executed.
- `git status --short` was attempted for orientation and failed with `fatal: not a git repository (or any of the parent directories): .git`.
- Recommended focused Vitest after implementation:

```powershell
npm test -- tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-material-storage.test.ts
```

- Recommended full local gates after focused tests pass:

```powershell
npm run typecheck
npm run typecheck -w @wtc/web
node scripts/gates.mjs full
node scripts/gates.mjs e2e
node scripts/scan-lms-db-e2e-artifacts.mjs
npm run governance:check
```

- Recommended optional live DB browser gate only when a fresh throwaway DB/admin URL is supplied:

```powershell
npm run e2e:lms:db
npm run e2e:lms:db:managed
```

## Next actions
1. Update success-path handler and Playwright DB spec assertions to require generic attachment filenames and no original filename in success headers.
2. Extend raw audit-row tests for upload and download to assert original filenames are absent.
3. Extend the static harness and artifact scanner to catch filename regressions in generated text artifacts.
4. Run the focused Vitest command, then typecheck, full gate, e2e gate, artifact scanner, and final governance.
5. Update current docs and write the aggregate phase handoff only after implementation and gate results are observed.
