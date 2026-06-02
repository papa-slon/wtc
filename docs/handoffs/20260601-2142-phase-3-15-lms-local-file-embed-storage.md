# Phase 3.15 LMS local file/embed storage handoff
## Scope
Implemented the local LMS upload/embed storage slice for epoch `20260601-2142` after dispatching the required read-only agents before edits.

Per-agent handoffs:
- [`docs/handoffs/20260601-2142-ecosystem-education-implementer.md`](20260601-2142-ecosystem-education-implementer.md)
- [`docs/handoffs/20260601-2142-ecosystem-security-auditor.md`](20260601-2142-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-2142-ecosystem-backend-implementer.md`](20260601-2142-ecosystem-backend-implementer.md)
- [`docs/handoffs/20260601-2142-ecosystem-tests-runner.md`](20260601-2142-ecosystem-tests-runner.md)

No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production service was touched.

## Files inspected
See the four per-agent handoffs above plus the implementation files listed below.

## Files changed
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/package.json`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/meta/0011_snapshot.json`
- `packages/db/migrations/meta/_journal.json`
- `packages/audit/src/audit.ts`
- `package-lock.json`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`

## Findings
1. High - The prior LMS material model had URL-only storage, link-only actions, and safe embed placeholders. Migration `0011` now adds local DB-backed file byte columns, material embed storage, and payload checks.
2. High - Stored embeds previously had no sanitizer. `@wtc/lms` now only accepts allowlisted YouTube/Vimeo iframe embeds, rejects scripts/event handlers/srcdoc/non-https/unapproved hosts, and emits canonical sanitized HTML.
3. Medium - Student file access needed an entitlement-checked server boundary. `GET /api/education/materials/[materialId]/download` now requires session, active education entitlement, published course/lesson visibility, strict response headers, and `education.material_download` audit.
4. Medium - Production upload rollout still needs object storage, malware scan/quarantine, retention/deletion policy, and DB-backed browser acceptance. This phase deliberately clears the local storage/sanitizer blocker, not the production object-storage program.

## Decisions
- Use local DB-backed base64 file bytes for this bounded acceptance slice, with a 5 MB limit and a narrow MIME allowlist: PDF, PNG, JPEG, and TXT.
- Keep sanitized embeds as canonical iframe HTML in the DB, but render by parsing iframe props; no `dangerouslySetInnerHTML` is introduced.
- Keep file downloads behind a server route rather than exposing storage keys or fake public URLs.
- Keep production object storage and malware scanning listed as remaining blockers.

## Risks
- DB-backed byte storage is acceptable for local acceptance and small educational files, but it is not a production object-storage design.
- The sanitizer is intentionally narrow. Providers beyond YouTube/Vimeo require an explicit allowlist expansion and tests.
- The browser e2e suite currently runs mostly demo-mode LMS flows; route/PGlite tests are the stronger acceptance evidence for this local slice.

## Verification/tests
RUN:
- `npm test -- packages/lms/src/materials.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-service.test.ts` - PASS, 5 files, 49 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes after generation.
- `node scripts/gates.mjs full` - PASS, 9/9 gates green (`governance`, `check:core`, `lint`, `typecheck`, `typecheck-web`, `secret:scan`, `test`, `db:generate`, `build`).
- env-cleared `node scripts/gates.mjs e2e` - PASS, 44 passed.
- final `npm run governance:check` - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- real production object storage, malware scanning, live Stripe, live Axioma, live TradingView automation, live bot/exchange control, and real-Postgres upload/embed acceptance. Reason: out of scope or unavailable credentials/contracts.

## Next actions
1. Run the remaining broad gates in this session and update this handoff with exact results.
2. Add production object-storage provider configuration, malware scan/quarantine state, retention policy, and deletion semantics before enabling public production upload rollout.
3. Add DB-backed browser acceptance for teacher file/embed creation and student download/render once a local test DB mode is scoped.
4. Continue the broader production blockers: live Stripe replay, live Axioma endpoint/key/download/account-link acceptance, TradingView automation, and worker deployment/monitoring.
