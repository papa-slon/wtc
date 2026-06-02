# Phase 3.21 LMS DB no-leak assertion hardening handoff

## Scope
Phase 3.21 tightened the local LMS DB browser acceptance source/spec layer after Phase 3.20, without touching live services,
servers, Postgres, `psql`, migrations, seeds, Stripe, Axioma, TradingView, bots, exchanges, object storage, or malware
scanner endpoints.

Per-agent handoffs cited:
- `ecosystem-tests-runner` - [`docs/handoffs/20260602-0047-ecosystem-tests-runner.md`](20260602-0047-ecosystem-tests-runner.md)
- `ecosystem-security-auditor` - [`docs/handoffs/20260602-0047-ecosystem-security-auditor.md`](20260602-0047-ecosystem-security-auditor.md)
- `ecosystem-backend-implementer` - [`docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`](20260602-0047-ecosystem-backend-implementer.md)
- `ecosystem-devops-implementer` - [`docs/handoffs/20260602-0047-ecosystem-devops-implementer.md`](20260602-0047-ecosystem-devops-implementer.md)

All four background agents were closed after their handoffs were collected.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`
- `docs/handoffs/20260602-0047-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0047-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0047-ecosystem-devops-implementer.md`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/db/src/repositories.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`

## Findings
1. Severity: High. The browser spec's failed-download paths needed stronger no-leak assertions. Resolution: added
   `expectNoDownloadResponseLeak()` and applied it to unauthenticated `401`, teacher-entitlement `403`, and invalid-ID
   `400` responses. The helper checks failed response body and headers for uploaded bytes/base64, concrete filename/hash,
   internal material metadata, success-only headers, `set-cookie`, and JSON content type.
2. Severity: Medium. Admin audit rendering and page HTML needed protection against internal material metadata regressions.
   Resolution: added `expectNoMaterialMetadataLeak()` and applied it to teacher/student/admin LMS browser surfaces.
3. Severity: Medium. Sanitized embed runtime assertions did not pin the full iframe contract. Resolution: added
   `expectSafeEmbedFrame()` to assert Vimeo `src`, sandbox, no-referrer policy, lazy loading, allowlist value, absent `srcdoc`,
   and fullscreen state.
4. Severity: Medium. The artifact scanner lagged the browser spec's expanded marker set. Resolution: scanner now rejects
   `contentSha256`, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, `deletedAt`, `hasStorageKey`,
   session cookie names, JSON/lowercase cookie or authorization headers, and session-token-shaped cookie values.
5. Severity: Medium. Handler-level failed paths needed direct no-leak and no-audit checks. Resolution:
   `tests/integration/lms-material-download-handler.test.ts` now asserts unauthenticated, denied, DB-null, quarantined, and
   malformed-ID failures do not leak file/body/hash/storage metadata or success-only headers, and do not audit failed
   download attempts.

## Decisions
- Keep this as a local source/test hardening phase; do not run or claim the mutating LMS DB browser acceptance gate.
- Keep `npm run e2e:lms:db` opt-in and out of `npm run e2e`, `npm run ci:local`, and `node scripts/gates.mjs full`.
- Keep screenshots as visual artifacts, not text-scanner proof.
- Keep successful `x-lms-sha256` allowed only on the successful clean download path; failure paths and generated artifacts
  must not expose internal hash/storage metadata.

## Risks
- `npm run e2e:lms:db` is still unobserved because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied.
- Student `MaterialView` still carries broader internal metadata than the visible UI currently needs; this phase adds
  regression assertions but does not split DTOs.
- Compressed Playwright trace artifacts still fail closed rather than being decompressed and scanned.

## Verification/tests
RUN:
1. Focused Vitest: `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-material-download-handler.test.ts packages/auth/src/security-headers.test.ts` -> PASS, 61 passed.
2. `npm run typecheck` -> PASS.
3. `npm run typecheck -w @wtc/web` -> PASS.
4. `node scripts/gates.mjs full` -> PASS, 9/9 gates.
5. Env-cleared `node scripts/gates.mjs e2e` -> PASS, 44 passed.
6. `node scripts/scan-lms-db-e2e-artifacts.mjs` against current generated roots -> PASS, 2 text files and 68 image files scanned/skipped by category, 0 blocked containers.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied, and this gate would start Playwright on a guarded local server and mutate a throwaway database.
2. Live Stripe, Axioma, TradingView, bot/exchange, preview/prod server, object storage, malware scanner, SSH, tmux, or systemd operations - out of scope and not touched.

## Next actions
1. In a later phase, split `MaterialView` into narrower student/teacher/admin projections and add object-key allowlist tests.
2. When an operator provides a fresh empty `wtc_test_lms_*` database URL, run `npm run e2e:lms:db`, confirm scanner pass on
   generated artifacts, archive only redacted evidence, visually review or discard screenshots, and drop the throwaway DB.
