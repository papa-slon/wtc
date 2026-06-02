# ecosystem-tests-runner handoff
## Scope
Phase 3.15 read-only tests-runner audit for LMS uploads and stored embed sanitizer at epoch 20260601-2142. Scope is test planning and gate sequencing only: inspect protocol, package scripts, gate runner, Vitest/Playwright configuration, current LMS upload/embed tests, LMS source surfaces, and blocker docs. No product code was edited, no live services were started, and no external calls were made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `packages/lms/package.json`
- `scripts/gates.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql`
- `packages/lms/src/types.ts`
- `packages/lms/src/urls.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-fixes.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - LMS file byte upload is not implemented, so acceptance must first preserve the locked/link-only boundary before any future file-upload success test is meaningful. Evidence: current blockers say "file byte storage" is not built (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`); the LMS plan says real object storage for `material_type='file'` is not built (`docs/EDUCATION_LMS_PLAN.md:24-25`) and file-meta is blocked on upload review (`docs/EDUCATION_LMS_PLAN.md:53-56`); current DB materials only have `label`, `url`, and `kind` (`packages/db/src/schema.ts:244-250`); the action schema only accepts `kind: 'link'` (`apps/web/src/features/lms/actions.ts:63-64`); the course editor exposes only a Link kind and states file upload is disabled (`apps/web/src/app/teacher/courses/[id]/page.tsx:201-219`). Recommendation: keep current locked-state tests green, then add upload acceptance only after object-storage adapter, file metadata columns, download route, entitlement checks, audit policy, and redaction tests exist. Target part: material file upload boundary.
2. HIGH - Stored embed sanitizer is not implemented; `embed` is currently only a forward-compatible content-type value with a safe placeholder. Evidence: the DB CHECK allows `embed` but schema comments say no write/render path exists until a server-side sanitizer lands (`packages/db/src/schema.ts:234-241`); LMS types keep `embed` in the union only for exhaustiveness and say it needs a sanitizer first (`packages/lms/src/types.ts:8-11`); server actions intentionally exclude `embed` from the write enum (`apps/web/src/features/lms/actions.ts:51-60`); the lesson page renders an "not yet available" placeholder instead of raw embed HTML (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:82-86`); the canonical sanitizer rules require allowlisting iframe attributes and stripping scripts, event handlers, style, data content, and non-https src values (`docs/EDUCATION_LMS_PLAN.md:809-817`). Recommendation: before enabling stored embeds, add a pure server-side `sanitizeEmbedHtml` utility, exhaustive unit tests, DB/repo tests proving sanitized storage only, render tests proving no unsanitized output, and security sign-off. Target part: stored embed sanitizer.
3. HIGH - Current LMS embed/upload coverage is mostly regression/locked-state coverage, not future implementation acceptance. Evidence: Vitest excludes `apps/web/**` (`vitest.config.ts:8-9`), so the established pattern reads app source statically (`tests/integration/lms-ph3-1-static.test.ts:5-10`); static tests assert no raw embed HTML and a placeholder (`tests/integration/lms-ph3-1-static.test.ts:56-67`) and that materials remain link-only (`tests/integration/lms-ph3-1-static.test.ts:105-115`); PGlite tests cover `content_type`, `external_url`, and link material parent scoping but no file columns or sanitizer (`tests/integration/db-lms-ph3-1.test.ts:57-100`); current e2e is navigation/mobile layout only and explicitly says teacher write paths and XSS guards are covered statically/PGlite, not through browser DB flows (`tests/e2e/education-ph3-1-mobile.spec.ts:5-11`). Recommendation: for local acceptance, add executable pure/package tests for sanitizer and upload policy, framework-neutral route/action tests where possible, and keep static tests as wiring guards rather than the only proof. Target part: focused test coverage.
4. MEDIUM - Future upload/embed schema acceptance needs a new migration-replay gate; migration 0005 does not add `embed_html` or file metadata columns. Evidence: migration 0005 adds only course level/tags and lesson content_type/external_url (`packages/db/migrations/0005_noisy_supreme_intelligence.sql:1-11`); current schema has no `lessons.embed_html` and no material `file_key`/`file_name`/`file_size_bytes`/`mime_type` fields (`packages/db/src/schema.ts:224-250`); the LMS plan lists those material file columns as target additive columns (`docs/EDUCATION_LMS_PLAN.md:1143-1155`). Recommendation: when implementation begins, add a PGlite migration replay suite using the real generated SQL and assert old link rows backfill safely, file-key metadata is nullable/hidden, `embed_html` is nullable and written only through sanitizer code, and no dead columns land without readers/writers. Target part: DB migration gate.
5. MEDIUM - E2E must stay a separate, late gate because it starts a local Next dev server, which violates this read-only/no-live-services audit constraint. Evidence: Playwright uses `webServer.command = npm run dev:e2e -w @wtc/web` on port 3100 (`playwright.config.ts:23-35`); `scripts/gates.mjs` documents e2e as its own plan because Playwright starts a server (`scripts/gates.mjs:43-46`) and keeps `full` separate from `e2e` (`scripts/gates.mjs:47-52`). Recommendation: run focused Vitest/PGlite/static gates first; run `node scripts/gates.mjs full` after implementation; run `node scripts/gates.mjs e2e` only after the no-live-service constraint is lifted and a browser surface is actually in scope. Target part: gate sequencing.
6. LOW - The current audit action name `education.material_upload` is used for link metadata, which can confuse future byte-upload acceptance unless tests distinguish link creation from real file upload. Evidence: repository comments call `createMaterial` "plain link metadata" while it audits `education.material_upload` (`packages/db/src/repositories.ts:630-640`); the server action attempted label is also `material_upload` while the schema only accepts link kind (`apps/web/src/features/lms/actions.ts:308-326`). Recommendation: future upload tests should assert byte-upload paths have explicit file metadata/storage evidence and should not treat the existing link-only audit action as proof that files were uploaded. Target part: audit semantics and acceptance evidence.

## Decisions
- Treat current LMS upload/embed status as blocked/locked by design: link materials and safe placeholders are acceptable current behavior; file-byte upload and stored embed rendering are not acceptable until their blockers clear.
- Split acceptance into two implementation slices if possible: stored embed sanitizer first, file upload/object-storage second. Each slice needs its own focused tests before broad gates.
- Use package-level pure tests and PGlite migration/repository tests as the primary local acceptance boundary; use static source tests for Next server-action/page wiring because the root Vitest config excludes `apps/web/**`.
- Keep Playwright out of read-only audit lanes and run it separately only after implementation because it starts a local web server.

## Risks
- Static source checks can prove absence of unsafe strings but cannot prove runtime sanitizer behavior; future embed acceptance needs executable sanitizer tests with malicious payload fixtures.
- Allowing `content_type='embed'` at the DB CHECK level is safe only while write/render paths remain blocked; a direct DB write can still create an embed-typed lesson that renders the placeholder.
- File-upload acceptance can be overstated if tests only assert `education.material_upload` audit rows or `kind='file'`; it must prove object storage isolation, signed download authorization, file-key redaction, MIME/size limits, and no public URL leaks.
- E2E in demo mode will not prove DB-backed teacher upload/embed writes unless a dedicated local DB-backed test mode is scoped.

## Verification/tests
Performed in this read-only lane:
- Inspected protocol, package scripts, gate runner, Vitest/Playwright configuration, LMS source, upload/embed blocker docs, and current LMS integration/e2e tests.
- No npm, Vitest, Playwright, db-generate, build, migration, live-service, or external-network gate was run.

Exact gates RUN:
- Source/file inspection only.

Exact gates NOT RUN:
- `npm test` - not run because this was a read-only audit lane and no implementation changed.
- `npm run typecheck` - not run because this was a read-only audit lane.
- `npm run typecheck -w @wtc/web` - not run because this was a read-only audit lane.
- `npm run db:generate -w @wtc/db` - not run because this was a read-only audit lane with no schema edits.
- `node scripts/gates.mjs full` - not run because it is a broad post-implementation gate and writes gate logs/build artifacts.
- `node scripts/gates.mjs e2e` / `npm run e2e` - not run because Playwright starts a local Next dev server and the scope forbids live services.
- Real object storage, signed-download, virus-scan, external endpoint, and real-Postgres upload/embed acceptance - not run because those implementations and/or credentials are not present in scope.

Planned focused gate sequence after implementation:
1. Current locked-state regression before edits: `npm test -- tests/integration/lms-ph3-1-static.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-community-static.test.ts tests/integration/lms-rbac-pipeline.test.ts tests/integration/lms-service.test.ts`
2. Stored embed sanitizer slice: add/run pure sanitizer tests in `packages/lms`, PGlite repo/migration tests for `lessons.embed_html`, static app wiring tests proving no unsanitized render, then `npm run typecheck` and `npm run typecheck -w @wtc/web`.
3. Upload slice: add/run upload policy tests, object-storage mock adapter tests, PGlite migration/repo tests for material file metadata, route/action tests for upload and signed download entitlement/redaction, then `npm run typecheck` and `npm run typecheck -w @wtc/web`.
4. Schema/doc gate: `npm run db:generate -w @wtc/db` and `npm run governance:check`.
5. Broad local gate: `node scripts/gates.mjs full`.
6. Browser gate only after implementation and no-live constraint is lifted: `node scripts/gates.mjs e2e`.
7. Final governance check: `npm run governance:check`.

## Next actions
1. Security/backend owners: design the server-side embed sanitizer API and file upload/object-storage contract before any UI unlock.
2. Tests runner: add focused sanitizer and upload acceptance suites alongside existing LMS static/PGlite tests, keeping current locked-state assertions until implementation lands.
3. Operator: keep `docs/PRODUCTION_BLOCKERS_CURRENT.md` blocker wording intact until both upload and stored embed acceptance gates are observed green in a later session.
