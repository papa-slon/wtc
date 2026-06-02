# ecosystem-backend-implementer handoff
## Scope
Phase 3.23 read-only backend inspection for the `npm run e2e:lms:db` gate. Scope was limited to backend/LMS DB setup, runner preparation behavior, authoritative DB URL wiring, LMS material download/auth/entitlement dependencies, and whether source hardening is needed before a guarded run.

No product code, tests, docs, servers, Playwright, database commands, migrations, seeds, live endpoints, external services, or runtime state were changed or executed. This handoff is the only write.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`
- `docs/handoffs/20260602-0125-ecosystem-devops-implementer.md`
- `package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `playwright.lms-db.config.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/migrations/*.sql`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/urls.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Evidence: `package.json:28`, `scripts/run-lms-db-e2e.mjs:55`, `scripts/run-lms-db-e2e.mjs:64`, `scripts/run-lms-db-e2e.mjs:71`, `scripts/prepare-lms-db-e2e.ts:44`, `scripts/prepare-lms-db-e2e.ts:48`, and `scripts/prepare-lms-db-e2e.ts:50`. The `npm run e2e:lms:db` gate is not just a Playwright wrapper: it invokes `scripts/prepare-lms-db-e2e.ts`, applies every committed SQL migration from `packages/db/migrations`, calls `seedDatabase(db)`, then runs the dedicated Playwright config and artifact scanner. Recommendation: use the root npm script as the single normal entry point; do not run direct Playwright config as a substitute. Target part: LMS DB acceptance runner.

2. Severity: High. Evidence: `scripts/prepare-lms-db-e2e.ts:27`, `scripts/prepare-lms-db-e2e.ts:32`, `scripts/prepare-lms-db-e2e.ts:37`, `scripts/prepare-lms-db-e2e.ts:39`, `scripts/run-lms-db-e2e.mjs:7`, `scripts/run-lms-db-e2e.mjs:10`, `scripts/run-lms-db-e2e.mjs:11`, and `playwright.lms-db.config.ts:21`-`24`. The runner expects an already-created fresh throwaway database, then refuses missing, non-throwaway, non-empty, or unprepared DBs before browser tests run. Recommendation: create/drop the database outside this backend agent, or use the separate managed runner only in an approved devops/runtime step. Target part: DB preparation safety boundary.

3. Severity: High. Evidence: `scripts/run-lms-db-e2e.mjs:21`, `scripts/run-lms-db-e2e.mjs:22`, `playwright.lms-db.config.ts:15`, `playwright.lms-db.config.ts:57`, `apps/web/src/lib/backend.ts:20`, `apps/web/src/lib/backend.ts:44`, `apps/web/src/lib/db-store.ts:47`-`49`, and `tests/integration/lms-db-e2e-harness.test.ts:23`-`26`. The externally authoritative URL for this browser gate is `LMS_E2E_DATABASE_URL`; the runner maps it into `DATABASE_URL` for the web app, while `REAL_POSTGRES_DATABASE_URL` is explicitly not accepted as a fallback. Recommendation: for this gate, set only `LMS_E2E_DATABASE_URL` to a fresh `wtc_test_lms_*`-style URL; let the runner inject `DATABASE_URL`. Target part: env/DB URL contract.

4. Severity: High. Evidence: `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:11`-`15`, `apps/web/src/features/lms/material-download.ts:47`-`65`, `apps/web/src/lib/session.ts:13`, `apps/web/src/lib/access.ts:6`, and `apps/web/src/features/lms/material-download.ts:24`. The material download route is a thin adapter that injects `getServerDb()`, `requireUser`, `accessFor`, and `reasonLabel`; the handler rejects non-GET, invalid UUID, unauthenticated, non-entitled, missing DB, and missing file paths with no-store JSON before returning bytes. Recommendation: no backend hardening is needed in this path before a guarded run; keep the injected handler boundary because it is testable and fail-closed. Target part: material download auth/entitlement route.

5. Severity: High. Evidence: `packages/db/src/repositories.ts:787`-`813`, `packages/db/src/repositories.ts:833`-`849`, `apps/web/src/features/lms/queries.ts:65`-`72`, `packages/lms/src/types.ts:60`-`75`, and `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:155`-`156`. Download eligibility is constrained to file materials that are clean, not soft-deleted, attached to published lessons and published courses, and whose stored bytes match `sizeBytes` and `contentSha256`; the student DTO exposes only coarse size/scan/download URL, while filename/MIME remain teacher-only. Recommendation: run the DB browser gate against this current boundary; do not broaden student DTOs or render audit payloads before the run. Target part: LMS material projection and file eligibility.

6. Severity: Medium. Evidence: `apps/web/src/features/lms/actions.ts:67`-`69`, `apps/web/src/features/lms/actions.ts:122`-`128`, `apps/web/src/features/lms/actions.ts:345`-`381`, `packages/lms/src/materials.ts:3`, `packages/lms/src/materials.ts:106`, `packages/lms/src/materials.ts:117`-`150`, `packages/lms/src/materials.ts:207`-`218`, and `packages/db/src/schema.ts:277`-`290`. Teacher material writes already have CSRF-first actions, teacher/ownership checks, HTTPS-only link validation, upload size preflight before `arrayBuffer()`, sanitizer-backed embeds, local scan/quarantine metadata, and DB CHECK constraints for material lifecycle/payload shape. Recommendation: no pre-run product-code hardening is required for the local gate; production object storage and production malware scanning remain separate work. Target part: teacher upload/write path.

7. Severity: Medium. Evidence: `packages/db/src/seed.ts:29`-`31`, `packages/db/src/seed.ts:46`-`51`, `packages/db/src/seed.ts:60`, `apps/web/src/app/api/e2e/login/route.ts:9`, `apps/web/src/app/api/e2e/login/route.ts:16`, `apps/web/src/app/api/e2e/login/route.ts:19`, and `tests/e2e/helpers/auth.ts:7`-`17`. The seed creates admin/teacher/user demo principals; only the demo user receives active `education`, while the browser login bypass is localhost-only, non-production, and opt-in via `E2E_AUTH_BYPASS`. This matches the spec's expected unauthenticated 401, teacher 403, and entitled student 200 paths. Recommendation: use the seeded users exactly as the spec does; do not add ad hoc grants before the run. Target part: seeded auth/entitlement fixtures.

8. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts:5`, `tests/e2e/lms-db-materials.spec.ts:94`, `tests/e2e/lms-db-materials.spec.ts:187`, `tests/e2e/lms-db-materials.spec.ts:200`-`216`, `tests/e2e/lms-db-materials.spec.ts:223`, `tests/e2e/lms-db-materials.spec.ts:233`, and `scripts/scan-lms-db-e2e-artifacts.mjs:13`-`44`. The browser spec and artifact scanner already cover the acceptance risks this run is meant to prove: DB-backed UI storage labels, teacher upload, quarantined no-download, unauthenticated and non-entitled denials, entitled download headers/body/hash, invalid IDs, admin audit visibility, and no generated-artifact leaks of file bytes, hashes, DB URLs, cookies, auth headers, or secret-like values. Recommendation: the remaining blocker is execution against a fresh throwaway DB, not source hardening. Target part: acceptance coverage.

## Decisions
- `npm run e2e:lms:db` is self-preparing once given an existing empty throwaway database: it applies migrations and seeds itself.
- `LMS_E2E_DATABASE_URL` is the operator-facing authoritative URL for this browser gate. `DATABASE_URL` is set internally for the web server. `REAL_POSTGRES_DATABASE_URL` remains reserved for the separate real-Postgres Vitest harness.
- Current source inspection found no backend/LMS code hardening blocker that should stop a guarded `npm run e2e:lms:db` attempt.
- The stricter operational convention should remain `wtc_test_lms_*` even though the low-level guard accepts `wtc_test` or `wtc_test_<suffix>`.
- The optional `npm run e2e:lms:db:managed` path exists in current package scripts (`package.json:29`) and delegates to `e2e:lms:db` after creating a `wtc_test_lms_*` database (`scripts/run-lms-db-e2e-managed.mjs:42`, `scripts/run-lms-db-e2e-managed.mjs:48`, `scripts/run-lms-db-e2e-managed.mjs:69`, `scripts/run-lms-db-e2e-managed.mjs:80`), but using it would be a runtime/devops action outside this read-only backend scope.

## Risks
- This was a source-level, read-only inspection. It does not prove the DB-backed browser gate green because no server, DB, migrations, seeds, Playwright, or artifact scanner execution was allowed.
- A wrong URL can still waste time even though the scripts guard database name, emptiness, and marker HMAC. The operator should create a fresh local throwaway DB and drop it after evidence capture.
- `db-local` byte storage, local signature scanning, and local retention metadata are acceptance scaffolding only. Production object storage, a production malware scanner, signed-object redirects, and cleanup policy remain outside this run.
- The artifact scanner skips image bytes by design, so any generated screenshots still need normal human visual review after the scanner passes.
- Running default `npm run e2e`, scanner-only checks, PGlite tests, or the separate real-PG Vitest harness would not count as this DB-backed LMS browser gate.

## Verification/tests
RUN:
1. Read-only inspection of the files listed above, including line-numbered evidence collection for the runner, DB prep, DB URL wiring, LMS material route, auth/session/access dependencies, repositories/schema, seed data, browser spec, and package scripts.

NOT RUN:
1. `npm run e2e:lms:db` - not run because this read-only agent was forbidden from starting servers, Playwright, DB migrations/seeds, or browser execution.
2. `npm run e2e:lms:db:managed` - not run because it would create/drop a database and delegate to the forbidden browser gate.
3. `scripts/prepare-lms-db-e2e.ts`, `npm run db:migrate`, `npm run db:seed`, direct Playwright config, Next dev/e2e servers, `psql`, Docker, DB create/drop, live endpoints, external services, object storage, malware scanning, SSH, tmux, systemd, deploy actions, and bot/exchange controls - not run by scope.

## Next actions
1. If the operator supplies a fresh empty local `postgres://.../wtc_test_lms_<timestamp>` URL, set `LMS_E2E_DATABASE_URL` and run only `npm run e2e:lms:db`.
2. After the run, require Playwright exit 0 plus artifact scanner exit 0 before archiving redacted stdout/reports/screenshots, then drop the throwaway DB.
3. Keep production LMS upload/storage rollout separate from this local gate: object storage adapter, production malware scanner, signed-object redirects, quarantine cleanup, and rollout approval are not cleared by `e2e:lms:db`.
