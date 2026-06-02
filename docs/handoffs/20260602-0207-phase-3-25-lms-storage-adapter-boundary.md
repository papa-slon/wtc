# Phase 3.25 LMS storage adapter boundary handoff
## Scope
Implement the next LMS storage boundary slice after Phase 3.24: preserve DB-local behavior, add an explicit local object-style adapter, relax the material payload check for non-DB-local rows, fail closed for unsupported providers, add typed local storage config, update docs, and keep production object-storage claims blocked.

This phase does not implement S3/R2, signed-object redirects, opaque production object keys, an external malware scanner, object-store delete/reconciliation cleanup, public upload rollout, or the not-yet-observed DB-backed browser acceptance run.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0207-ecosystem-education-implementer.md](20260602-0207-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0207-ecosystem-backend-implementer.md](20260602-0207-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0207-ecosystem-security-auditor.md](20260602-0207-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0207-ecosystem-tests-runner.md](20260602-0207-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final report.

## Files inspected
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0013_snapshot.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0207-phase-3-25-lms-storage-adapter-boundary.md`

## Findings
1. Severity: High. The existing materials CHECK required inline DB bytes for every file row, blocking object-style metadata rows. Recommendation implemented: migration `0013_young_martin_li.sql` keeps inline bytes mandatory for `db-local` and requires non-`db-local` rows to omit `file_bytes_base64`. Target part: DB material schema.
2. Severity: High. Uploads prepared DB-local rows inline in the server action. Recommendation implemented: `storeLmsUploadedFile()` now owns provider selection, normalization, local scan, storage-key creation, and local adapter writes. Target part: LMS upload boundary.
3. Severity: High. Downloads decoded `fileBytesBase64` directly in the handler. Recommendation implemented: `resolveLmsMaterialFileBytes()` provider-gates byte resolution; unsupported providers fail closed before audit/streaming. Target part: LMS download route.
4. Severity: Medium. `fs-local` needs path/root safety if it exists at all. Recommendation implemented: `LMS_FILE_STORAGE_ROOT` is required for `fs-local`, storage keys must validate under `lms/materials/`, and filesystem reads/writes are rooted through a path jail. Target part: local object-style adapter.
5. Severity: Medium. Public production uploads must not be implied by local adapters. Recommendation implemented: `.env.example`, typed config, runtime upload guard, status docs, and acceptance docs keep `LMS_PUBLIC_UPLOADS_ENABLED=false` and reject local-only providers for production upload attempts. Target part: deployment/config boundary.

## Decisions
- `db-local` remains the default and keeps existing local DB-byte behavior.
- `fs-local` is a local object-style adapter for development/acceptance only, not production object storage.
- Unsupported providers such as future S3/R2 metadata rows are not streamed by this phase; they fail closed until a real adapter is implemented.
- Client DTOs remain unchanged: the student-facing pointer is still the app download route, not a storage key, object URL, or signed URL.
- Production object storage, signed redirects, external scanner, object cleanup, and real DB browser acceptance remain separate blocker-clearing phases.

## Risks
- `fs-local` is not durable production storage and must not be used as an S3/R2 substitute.
- Success downloads still expose `x-lms-sha256` for current local acceptance; the security audit flagged that strict no-hash-leak/signed-delivery readiness requires a later change.
- Object-storage cleanup remains DB-local only; non-local object delete/reconciliation still needs a separate design.
- The workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status or commit evidence is available in this folder.

## Verification/tests
RUN:
1. `npm run db:generate -w @wtc/db` - PASS, generated `0013_young_martin_li.sql`.
2. `npm test -- packages/lms/src/materials.test.ts packages/config/src/env.test.ts tests/integration/lms-material-storage.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts` - PASS, 80 tests.
3. `npm run typecheck` - PASS.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
6. `node scripts/gates.mjs full` - PASS, 9/9 gates (governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build).
7. `node scripts/gates.mjs e2e` - PASS, 44 Playwright tests.
8. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 image files, 0 blocked containers, 2 missing roots, 70 total artifact files.

NOT RUN:
1. `npm run e2e:lms:db` - no `LMS_E2E_DATABASE_URL`.
2. `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
3. Real S3/R2 object storage, external malware scanner, signed redirects, live Stripe/Axioma/TV/bot-control acceptance, and deployment actions - not in scope / no credentials.

## Next actions
1. Add a future production object-storage phase with opaque keys, signed redirects, external scanner state, object delete/reconciliation, and live credentialed acceptance.
2. When a fresh throwaway/admin DB URL is available, run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` and archive only scanner-passed, redacted evidence.
