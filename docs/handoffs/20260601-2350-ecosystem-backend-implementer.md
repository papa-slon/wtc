# ecosystem-backend-implementer handoff
## Scope
Phase 3.18 read-only backend audit for DB-backed LMS browser acceptance. Inspected backend selection, DB client/store, LMS material download route/handler, e2e login route, session/CSRF helpers, seedDatabase, current DB-backed Playwright harness, and LMS routes/actions needed to prove teacher upload to student download without fake integrations or secret leakage. No servers, Playwright, psql, database mutation, migrations, seeds, live endpoints, or product-code edits were run.

## Files inspected
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-cli.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/urls.ts`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `package.json`
- `apps/web/package.json`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/db-real-postgres.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: the DB-backed LMS browser harness now exists as a dedicated opt-in path (`package.json:27` to `package.json:28`, `apps/web/package.json:8` to `apps/web/package.json:9`, `scripts/run-lms-db-e2e.mjs:5` to `scripts/run-lms-db-e2e.mjs:17`, `playwright.lms-db.config.ts:6` to `playwright.lms-db.config.ts:37`). However, the dedicated spec skips itself whenever `LMS_DB_E2E` is not set (`tests/e2e/lms-db-materials.spec.ts:4`), while the config can still be invoked directly with an empty `DATABASE_URL` (`playwright.lms-db.config.ts:3`, `playwright.lms-db.config.ts:31`). Recommendation: keep `npm run e2e:lms:db` as the only supported entry point, and make the dedicated config/spec fail closed instead of producing an all-skipped green run when called directly without `LMS_E2E_DATABASE_URL` and `LMS_DB_E2E=1`. Target part: `playwright.lms-db.config.ts`, `tests/e2e/lms-db-materials.spec.ts`, harness docs/scripts.

2. Severity: High. Evidence: the download handler enforces method, session, education entitlement, DB presence, clean-file lookup, and audit before streaming (`apps/web/src/features/lms/material-download.ts:43` to `apps/web/src/features/lms/material-download.ts:61`), and the seed gives the `education` entitlement only to the seeded regular user (`packages/db/src/seed.ts:43` to `packages/db/src/seed.ts:51`). The DB browser spec currently proves only the entitled happy path (`tests/e2e/lms-db-materials.spec.ts:60` to `tests/e2e/lms-db-materials.spec.ts:79`) and then audit visibility (`tests/e2e/lms-db-materials.spec.ts:86` to `tests/e2e/lms-db-materials.spec.ts:89`). Recommendation: add DB-backed browser negatives using the captured download href: unauthenticated request returns 401, teacher/admin or a revoked/no-education user returns 403, and the response remains `no-store` without bytes. Do not fake entitlement state in the route; use seeded non-entitled users or a real admin/repository transition in the throwaway DB setup. Target part: `tests/e2e/lms-db-materials.spec.ts` and, if needed, `scripts/prepare-lms-db-e2e.ts`.

3. Severity: Medium. Evidence: the material download route passes raw route params into the handler (`apps/web/src/app/api/education/materials/[materialId]/download/route.ts:9` to `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:16`), the handler passes that string directly to the repository (`apps/web/src/features/lms/material-download.ts:43` to `apps/web/src/features/lms/material-download.ts:58`), and the repository compares it against a UUID column (`packages/db/src/repositories.ts:787` to `packages/db/src/repositories.ts:810`). Recommendation: validate `materialId` as UUID at the route/handler boundary and return a no-store 400 or 404 body instead of letting malformed IDs reach Postgres and risk a 500. Add a handler test and a DB-backed browser/API assertion for an invalid material URL. Target part: LMS material download route/handler and tests.

4. Severity: Medium. Evidence: `/api/e2e/login` is fenced by `NODE_ENV !== production` and `E2E_AUTH_BYPASS=1` (`apps/web/src/app/api/e2e/login/route.ts:5` to `apps/web/src/app/api/e2e/login/route.ts:8`), then creates a local non-secure session cookie after `verifyLogin()` succeeds (`apps/web/src/app/api/e2e/login/route.ts:13` to `apps/web/src/app/api/e2e/login/route.ts:24`). The DB harness intentionally runs with `APP_ENV=development`, mock bot mode, and live controls disabled (`scripts/run-lms-db-e2e.mjs:15` to `scripts/run-lms-db-e2e.mjs:23`, `playwright.lms-db.config.ts:27` to `playwright.lms-db.config.ts:37`). Recommendation: add an `APP_ENV` and/or localhost-only fence so the e2e login bypass cannot be accidentally enabled on a raw-IP preview or staging-like dev server that points at a real database. Keep DB LMS acceptance local/throwaway only. Target part: `apps/web/src/app/api/e2e/login/route.ts` and static/integration guard.

5. Severity: Medium. Evidence: file material mapping deliberately exposes only safe metadata and download URL, not `fileBytesBase64` or `storageKey` (`apps/web/src/features/lms/queries.ts:64` to `apps/web/src/features/lms/queries.ts:80`); download audit records safe metadata, not bytes/storage keys (`packages/db/src/repositories.ts:833` to `packages/db/src/repositories.ts:850`); the admin audit page renders only time/actor/action/target/result (`apps/web/src/app/admin/audit-log/page.tsx:26` to `apps/web/src/app/admin/audit-log/page.tsx:34`). The browser spec checks headers/body and action visibility, but not absence of file body/base64/storage-key leakage in rendered pages (`tests/e2e/lms-db-materials.spec.ts:69` to `tests/e2e/lms-db-materials.spec.ts:89`). Recommendation: extend the DB browser spec with explicit negative assertions that teacher page, student page, and admin audit HTML do not contain the uploaded file body, its base64 form, `fileBytesBase64`, `storageKey`, or `lms/materials/`. Target part: `tests/e2e/lms-db-materials.spec.ts`.

6. Severity: Low. Evidence: current browser acceptance covers clean file upload/download only (`tests/e2e/lms-db-materials.spec.ts:13` to `tests/e2e/lms-db-materials.spec.ts:89`), while sanitized embed and quarantined-file behavior are proven in PGlite/handler tests (`tests/integration/db-lms-ph3-1.test.ts:112` to `tests/integration/db-lms-ph3-1.test.ts:129`, `tests/integration/lms-material-download-handler.test.ts:97` to `tests/integration/lms-material-download-handler.test.ts:100`). Recommendation: if Phase 3.18 acceptance is meant to cover the full LMS material browser surface, add one sanitized embed render check and one quarantined-file "download unavailable" check to the DB-backed browser spec. Keep fake object storage/scanner out of scope; use the current local DB row and deterministic scanner policy. Target part: `tests/e2e/lms-db-materials.spec.ts`.

## Decisions
- Treat the existing `scripts/run-lms-db-e2e.mjs` plus `playwright.lms-db.config.ts` path as the right direction for DB-backed browser acceptance because it uses a throwaway Postgres URL, migrations, `seedDatabase`, mock adapters, and disabled live controls rather than fake LMS integrations.
- Do not add LMS data to `seedDatabase` for browser acceptance. The current spec drives real teacher UI creation of course, lesson, publish state, file material, and student download; that is stronger than pre-baking a material row into generic seed data.
- Keep default `npm run e2e` as demo/in-memory navigation smoke. DB-backed LMS acceptance should remain a separate opt-in gate because it mutates a throwaway DB and starts a separate local Next dev server.

## Risks
- A direct all-skipped invocation of `playwright.lms-db.config.ts` could be mistaken for DB-backed LMS acceptance unless the harness fails closed outside the runner.
- Without browser-level denial checks, a future regression could keep the happy-path download green while weakening the entitlement fail-closed boundary.
- Without material ID validation, malformed route input can reach the database layer and may surface as a 500 instead of a controlled no-store response.
- The current local DB byte-storage path is honest for acceptance, but it is not proof of production object storage or a real malware scanner.

## Verification/tests
- Not run: `npm test`, focused Vitest, `npm run e2e`, `npm run e2e:lms:db`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run typecheck`, `npm run build`, `npm run db:migrate`, `npm run db:seed`, Playwright, psql, or any database-mutating harness. Reason: this lane was read-only except the required handoff file.
- Not touched: live endpoints, preview servers, production services, Stripe, Axioma, TradingView, bot/exchange integrations, SSH, tmux, systemd, object storage, malware scanners. Reason: explicitly forbidden by scope.
- Static inspection only. Current CWD is not a git repository, so no git status/diff evidence is available from this directory.

## Next actions
1. Harden the DB LMS Playwright entry point so direct config invocation cannot pass as an all-skipped green acceptance run.
2. Add DB-backed browser negative checks for unauthenticated and non-entitled material download attempts.
3. Add UUID validation for `materialId` before DB lookup and cover malformed IDs in handler/browser tests.
4. Add no-leak browser assertions for file body/base64/storage-key fields.
5. Optionally extend DB browser acceptance to sanitized embed rendering and quarantined-file download-unavailable behavior.
