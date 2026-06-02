# phase-3-22-lms-material-dto-boundary handoff
## Scope
Local LMS DTO-boundary hardening for Phase 3.22. This phase narrows material projections after Phase 3.21's no-leak assertion hardening:
- keep student material DTOs free of filename/MIME and storage/hash/quarantine/retention/delete internals;
- allow teacher material DTOs to carry display-only filename/MIME;
- keep admin audit rendering summary-only and payload-free;
- preserve repository, download, and audit internals that need operational metadata.

No live services, live endpoints, bot/exchange actions, production storage, database migrations, database create/drop, or external integrations were touched. The opt-in `npm run e2e:lms:db` throwaway-Postgres browser run was not run because no fresh `LMS_E2E_DATABASE_URL` was supplied.

Per-agent handoffs:
- [`docs/handoffs/20260602-0106-ecosystem-tests-runner.md`](20260602-0106-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-0106-ecosystem-security-auditor.md`](20260602-0106-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-0106-ecosystem-backend-implementer.md`](20260602-0106-ecosystem-backend-implementer.md)
- [`docs/handoffs/20260602-0106-ecosystem-devops-implementer.md`](20260602-0106-ecosystem-devops-implementer.md)

All four background agents were collected and closed before this aggregate was finalized.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`
- `docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0106-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0106-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0106-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0106-ecosystem-devops-implementer.md`
- `packages/lms/src/types.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `packages/lms/src/types.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`

## Findings
1. Severity: High. Evidence: `packages/lms/src/types.ts:60` and `packages/lms/src/types.ts:72`. `MaterialView` is now student-safe and `TeacherMaterialView` is the only material view that adds display-only filename/MIME. Recommendation: keep storage/hash/quarantine/retention/delete fields out of LMS surface DTOs unless a future explicit admin moderation DTO is designed. Target part: LMS DTO contract.
2. Severity: High. Evidence: `apps/web/src/features/lms/queries.ts:65`, `apps/web/src/features/lms/queries.ts:78`, `apps/web/src/features/lms/queries.ts:279`, and `apps/web/src/features/lms/queries.ts:287`. Student lesson loading stays on the student-safe mapper, while teacher course/material list loading uses the teacher mapper. Recommendation: do not reintroduce a single broad row-to-view mapper for all audiences. Target part: LMS query projection boundary.
3. Severity: Medium. Evidence: `tests/integration/lms-ph3-1-static.test.ts:145`, `tests/integration/lms-ph3-1-static.test.ts:166`, `tests/integration/lms-ph3-1-static.test.ts:176`, and `tests/integration/lms-ph3-1-static.test.ts:186`. Static coverage now pins the DTO shape, mapper ownership, and admin audit summary projection. Recommendation: keep the static allowlist tests next to the existing LMS source guards so future DTO broadening fails before browser rendering hides it. Target part: regression coverage.
4. Severity: Medium. Evidence: `apps/web/src/lib/backend.ts:91` and `apps/web/src/app/admin/audit-log/page.tsx:10`. Admin audit rendering remains summary-only; DB audit persistence can still retain operational metadata internally. Recommendation: any future admin audit detail drawer or material moderation surface must introduce its own allowlisted DTO and tests. Target part: admin audit render boundary.
5. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts` and `scripts/scan-lms-db-e2e-artifacts.mjs`. Browser and artifact no-leak harnesses remain source-level and default-e2e verified, but the actual throwaway-Postgres LMS browser gate is still not observed. Recommendation: run `npm run e2e:lms:db` only with a fresh empty `wtc_test_lms_*` URL, scanner pass, redacted evidence archive, and DB drop. Target part: LMS DB browser acceptance.

## Decisions
- `MaterialView` is treated as the current student-safe material DTO for compatibility with existing student imports.
- `TeacherMaterialView` is the teacher/admin material-management extension and is the only surface DTO that may carry display-only `fileName` and `mimeType`.
- File download internals, DB material rows, and DB audit payloads remain internal operational models and were not narrowed in this phase.
- Student pages may continue to show coarse size/scan/download availability; the forbidden fields for the student DTO are filename, MIME, raw bytes/base64, storage keys/provider/path, content hash, quarantine reason, retention timestamps, deletion timestamps, and storage-key presence booleans.
- Default e2e remains separate from the opt-in LMS DB browser acceptance run.

## Risks
- This workspace is not git-backed from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`; git diff/status evidence is unavailable.
- The per-agent audit findings were produced while the implementation was mid-transition, so their "current state" line numbers may describe the pre-fix state. The final typecheck and focused tests verify the completed split.
- Static DTO/source guards can prove projection code shape, but they are not a substitute for the still-NOT-RUN throwaway-Postgres LMS browser acceptance gate.
- Production LMS upload remains blocked on real object storage, a production malware scanner, signed-object redirects, cleanup policy, observed DB browser acceptance, and public rollout approval.

## Verification/tests
RUN:
1. `npm test -- tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts packages/auth/src/security-headers.test.ts` - first attempt failed one brittle static assertion while the test expected an object-literal loader shape; after fixing the assertion, PASS (`66` passed).
2. `npm run typecheck` - PASS.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
5. Env-cleared `node scripts/gates.mjs e2e` with `LMS_E2E_DATABASE_URL` removed - PASS (`44 passed`).
6. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` image files, `0` blocked containers, `2` missing roots, `70` total artifact files).
7. `npm run governance:check` after this aggregate existed and linked all per-agent handoffs - PASS (0 errors, 1 known historical warning).

NOT RUN:
1. `npm run e2e:lms:db` - NOT RUN because no fresh empty throwaway `LMS_E2E_DATABASE_URL` was supplied; running it without the operator-provided throwaway database would violate the guarded DB acceptance protocol.
2. `psql`, DB create/drop, migrations/seeds outside the checked gate scripts, live endpoints, Stripe, Axioma, TradingView automation, bot/exchange controls, object storage, malware scanner, SSH, tmux, systemd, and external services - NOT RUN because this was a local DTO/projection phase.

## Next actions
1. When a fresh throwaway `wtc_test_lms_*` Postgres URL is available, run `npm run e2e:lms:db`, ensure the generated-artifact scanner passes, archive only redacted evidence, and drop the DB.
2. Keep production LMS work scoped separately: object storage adapter, production malware scanner, signed-object redirects, quarantine cleanup, and rollout approval.
3. If admin material moderation or audit payload details are added later, create a new explicit admin DTO with its own allowlist tests before rendering any payload details.
