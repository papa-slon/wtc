# Phase 3.17 LMS storage scan retention handoff
## Scope
Bounded local LMS upload/download hardening after Phase 3.15. This phase adds persisted file storage identity, scan/quarantine state, retention timestamps, soft-delete visibility, byte-level MIME sniffing, and fail-closed download gating. It does not call or configure live object storage, a real malware scanner, Stripe, Axioma, TradingView, bot/exchange services, SSH, tmux, systemd, preview workers, or production endpoints.

Per-agent handoffs:
- [ecosystem-education-implementer](20260601-2303-ecosystem-education-implementer.md)
- [ecosystem-db-architect](20260601-2303-ecosystem-db-architect.md)
- [ecosystem-security-auditor](20260601-2303-ecosystem-security-auditor.md)
- [ecosystem-backend-implementer](20260601-2303-ecosystem-backend-implementer.md)
- [ecosystem-tests-runner](20260601-2303-ecosystem-tests-runner.md)
- [ecosystem-devops-implementer](20260601-2303-ecosystem-devops-implementer.md)

## Files changed
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/db/migrations/meta/0012_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DEPLOYMENT.md`

## Findings
1. High - File downloads previously depended on published lesson/course and hash integrity only, not persisted scan state. The implementation adds `scan_status` and makes `getMaterialFileForPublishedLesson()` return a downloadable row only when `scan_status = 'clean'` and `deleted_at IS NULL`.
2. High - Material deletion previously hard-deleted rows, which blocked retention and future object cleanup reconciliation. The implementation changes `deleteMaterial()` to soft-delete via `deleted_at`, and list/download queries ignore deleted rows.
3. High - File rows had local bytes and hashes but no storage identity. The implementation adds `storage_provider` and non-public `storage_key`, backfills existing file rows as `db-local`, and keeps storage keys out of client view DTOs and audit payloads.
4. Medium - MIME policy previously trusted the browser-provided MIME type for binary files. The implementation adds byte sniffing for PDF, PNG, and JPEG before file normalization.
5. Medium - The local DB-byte implementation could be mistaken for production upload readiness. Docs now state that real object storage, a production malware engine, signed-object redirects, and DB-backed browser acceptance remain open.

## Decisions
- Keep `file_bytes_base64` as the local/dev acceptance backing for now; do not fake S3/R2, signed URLs, or a real malware scanner.
- Use `db-local` as the explicit local storage provider and deterministic `lms/materials/<hash-prefix>/<hash>/<filename-token>` keys for new uploads.
- Model local scan results synchronously in `@wtc/lms`: `clean` for ordinary files and `quarantined` for EICAR/test executable-looking text signatures.
- Backfill existing file rows as `clean` local rows before applying the new lifecycle check in migration `0012`.
- Expose file scan state to teacher/student surfaces, but expose download URLs only for clean files and never expose `storage_key`.

## Risks
- This still is not public production upload readiness. Real object storage, signed-object download redirects, a production malware engine, quarantine cleanup, and DB-backed browser acceptance are not run.
- The current scan is a local deterministic safety gate, not a substitute for a real malware scanner.
- Playwright default e2e remains demo/in-memory unless a separate DB-backed browser project is added.

## Verification/tests
RUN:
- `npm test -- packages/lms/src/materials.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-community-static.test.ts` - PASS, 55 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, generated migration `0012_old_maelstrom.sql` and 42-table snapshot.
- `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- Env-cleared `node scripts/gates.mjs e2e` - PASS, 44 passed.
- Final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN by design:
- Real object storage, production malware scanner, signed-object URL provider, DB-backed browser acceptance, real-Postgres race/browser acceptance, live Stripe, live Axioma, live TradingView, live bot/exchange, SSH, tmux, systemd, preview-worker, and production endpoints.

## Next actions
1. Add a future DB-backed Playwright project for teacher upload -> student download acceptance.
2. Add a future operator-approved object-storage and real malware-scanner phase before public production uploads.
