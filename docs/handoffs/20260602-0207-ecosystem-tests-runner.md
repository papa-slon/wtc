# ecosystem-tests-runner handoff
## Scope
Phase 3.25 read-only devops/tests audit before edits for the LMS storage adapter boundary. Inspected package scripts, gate runner, env/config docs, LMS DB browser harness/scanner, worker smoke path, current LMS file/storage/cleanup code, and relevant tests. No product code, tests, or docs were edited except this required handoff. No gates, servers, DB commands, migrations/seeds, Playwright, worker commands, live endpoints, or external services were run.

## Files inspected
- `package.json`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `playwright.lms-db.config.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/lms/package.json`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`

## Files changed
None - read-only audit. Administrative handoff written at `docs/handoffs/20260602-0207-ecosystem-tests-runner.md` only.

## Findings
1. High - The current LMS file implementation is still a DB-local material path, not an adapter boundary. Evidence: `packages/lms/src/materials.ts:5` hard-codes `LMS_LOCAL_STORAGE_PROVIDER = 'db-local'`; `packages/lms/src/materials.ts:23` includes `fileBytesBase64` in the normalized file shape; `packages/lms/src/materials.ts:27` makes `PreparedLmsFileMaterial.storageProvider` exactly `db-local`; `packages/lms/src/materials.ts:149`-`packages/lms/src/materials.ts:150` emits the local provider/key directly; `apps/web/src/features/lms/material-download.ts:64` decodes `row.fileBytesBase64`; `apps/web/src/features/lms/material-download.ts:66` streams the bytes in the response. Target docs require object-store keys and signed redirects instead (`docs/EDUCATION_LMS_PLAN.md:308`-`docs/EDUCATION_LMS_PLAN.md:309`, `docs/EDUCATION_LMS_PLAN.md:835`-`docs/EDUCATION_LMS_PLAN.md:838`). Recommendation: next implementation should introduce an explicit LMS storage port and adapter selection boundary before wiring any real object store: keep `db-local` as a local/dev adapter, add an object-store adapter interface/stub, and make route/repository code depend on the port rather than direct DB byte streaming. Target part: `packages/lms` storage module, `apps/web/src/features/lms/material-download.ts`, and repository call shape.

2. High - The DB material CHECK currently blocks metadata-only object storage rows. Evidence: `packages/db/src/schema.ts:290` requires every `kind = 'file'` row to have `fileBytesBase64 IS NOT NULL`; the generated migration has the same constraint (`packages/db/migrations/0011_late_madelyne_pryor.sql:16`). Phase 3.17 added `storage_provider`/`storage_key` fields (`packages/db/src/schema.ts:261`-`packages/db/src/schema.ts:262`) but did not relax the payload CHECK for non-DB-local providers. Recommendation: if Phase 3.25 implements an object-storage boundary, add a migration and PGlite tests that allow `file_bytes_base64` only for the local DB adapter while object-provider rows carry provider/key/hash/size metadata without inline bytes. Target part: `packages/db/src/schema.ts`, migrations, and `tests/integration/db-lms-ph3-1.test.ts` or a new storage-boundary integration test.

3. High - Typed env/config has no LMS storage/scanner settings or production fail-closed rule yet. Evidence: `.env.example:19`-`.env.example:24` documents only the opt-in LMS DB browser harness; `packages/config/src/env.ts:18`-`packages/config/src/env.ts:62` covers core app, DB, secrets, bot, Axioma, and billing fields, with no LMS storage provider, bucket/root, signed URL TTL, scanner mode, or retention setting. Current production blockers still list real object storage, production malware scanning, signed-object redirects, and object-store cleanup as open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`). Recommendation: add typed config and docs for `LMS_STORAGE_PROVIDER`, local root/bucket/endpoint/region/key secret references, signed URL TTL, max bytes, scanner mode, quarantine behavior, retention days, and an `APP_ENV=production` fail-closed rule that rejects public uploads with `db-local` or non-external scanner mode. Target part: `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, `.env.example`, and `docs/DEPLOYMENT.md`.

4. Medium - Existing tests cover DB-local safety, but not adapter selection or signed/object behavior. Evidence: `packages/lms/src/materials.test.ts:40`-`packages/lms/src/materials.test.ts:46` asserts prepared files are `db-local`; `tests/integration/db-lms-ph3-1.test.ts:112`-`tests/integration/db-lms-ph3-1.test.ts:128` covers local file/embed round-trip and quarantined no-download lookup; `tests/integration/lms-material-download-handler.test.ts:113`-`tests/integration/lms-material-download-handler.test.ts:125` covers strict headers and redacted audit for DB-backed bytes; `tests/integration/lms-ph3-1-static.test.ts:148`-`tests/integration/lms-ph3-1-static.test.ts:196` covers DTO/admin no-leak boundaries. Recommendation: add tests that prove the storage adapter contract returns opaque metadata, refuses unknown providers, never returns storage keys or signed URLs through DTOs/audits, chooses the correct adapter from typed config, and preserves DB-local behavior as local-only. Target part: `packages/lms/src/material-storage.test.ts`, `packages/config/src/env.test.ts`, `tests/integration/lms-material-download-handler.test.ts`, and `tests/integration/lms-ph3-1-static.test.ts`.

5. Medium - The LMS DB browser harness and scanner are correctly opt-in and should stay that way, but they need boundary-specific updates after adapter work. Evidence: root scripts expose `e2e:lms:db` and `e2e:lms:db:managed` as opt-in runners (`package.json:28`-`package.json:29`); `tests/integration/lms-db-e2e-harness.test.ts:118`-`tests/integration/lms-db-e2e-harness.test.ts:127` asserts the DB browser gate stays out of default gates; the scanner blocks storage keys, provider fields, raw bytes, DB URLs, auth headers, and unscanned containers (`scripts/scan-lms-db-e2e-artifacts.mjs:14`-`scripts/scan-lms-db-e2e-artifacts.mjs:44`, `scripts/scan-lms-db-e2e-artifacts.mjs:97`-`scripts/scan-lms-db-e2e-artifacts.mjs:126`). Recommendation: after adding signed/object behavior, update static harness assertions and the artifact scanner so generated evidence cannot contain raw storage keys, signed URL query secrets, object-store host/key paths, uploaded bytes/base64, scanner reasons, auth cookies, or DB URLs. Target part: `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and `scripts/scan-lms-db-e2e-artifacts.mjs`.

6. Medium - The worker smoke path is safe for local verification, but object-store cleanup must remain separate from DB-local cleanup. Evidence: `scripts/safe-worker-tick.mjs:9`-`scripts/safe-worker-tick.mjs:14` forces development/mock/no-live-control env; `scripts/safe-worker-tick.mjs:21`-`scripts/safe-worker-tick.mjs:23` falls back to `--memory-demo` when no `DATABASE_URL` is present; current DB cleanup is scoped to `db-local` and `lms/materials/` (`packages/db/src/repositories.ts:781`-`packages/db/src/repositories.ts:786`) and worker output includes `lms_materials_purged` (`apps/worker/src/tick-once.ts:24`). Recommendation: do not reuse `purgeExpiredLmsMaterialFiles` for object-store lifecycle. Add a separate object-store reconciliation/delete adapter contract later, and keep worker tests proving DB-local cleanup cannot delete `s3`/remote-provider rows. Target part: worker tests and storage adapter tests.

7. Low - The current gate topology is suitable for the next implementation, but `full` is not a browser gate. Evidence: `scripts/gates.mjs:47`-`scripts/gates.mjs:52` defines `full` without Playwright and `e2e` as its own plan; `scripts/gates.mjs:43`-`scripts/gates.mjs:46` documents why e2e is separate; `scripts/gates.mjs:85`-`scripts/gates.mjs:87` treats flaky e2e as failing. Recommendation: after focused tests pass, run `node scripts/gates.mjs full` and a separate env-cleared `node scripts/gates.mjs e2e`; run the LMS DB browser runner only when a fresh throwaway DB or admin URL is supplied. Target part: verification plan.

## Decisions
- Recommend a local-only adapter boundary first, not live object storage. The next slice can define the port, config, fail-closed rules, mock/local adapter behavior, schema compatibility, and tests without requiring S3/R2 credentials.
- Recommend treating DB-local byte streaming as a preserved dev/local mode, not a production substitute. Object-storage behavior should be proven through typed adapter tests and route-handler tests with a fake signed-URL provider before any live bucket run.
- Recommend keeping `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` outside default gates. The acceptance matrix already requires a fresh `wtc_test_lms_*` DB or admin URL (`docs/ACCEPTANCE_MATRIX_MASTER.md:21`, `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`docs/ACCEPTANCE_MATRIX_MASTER.md:76`).

## Risks
- If the schema CHECK is not changed, an object-storage adapter may be nominal only because file rows still need `file_bytes_base64`.
- If signed redirects are introduced without scanner updates, Playwright traces or failure artifacts may capture signed URL query parameters or object paths.
- If env config is added only to `.env.example` and not `packages/config/src/env.ts`, production can still boot with unsafe defaults.
- If `db-local` remains the default in production, the UI may appear to support production uploads while still storing file bytes in Postgres.
- This workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`; `git status --short` returns `fatal: not a git repository`, so final state must be verified by direct file checks rather than git diff.

## Verification/tests
Gates run: none.

Gates not run:
- `npm test` - skipped by scope; gates/tests forbidden for this read-only audit.
- `npm run worker:smoke` - skipped by scope; worker commands forbidden.
- `node scripts/gates.mjs quick` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs core` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs full` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs e2e` - skipped by scope; Playwright/server runs forbidden.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - skipped by scope; scanner command forbidden.
- `npm run e2e:lms:db` - skipped by scope; DB/Playwright run forbidden and no `LMS_E2E_DATABASE_URL` supplied.
- `npm run e2e:lms:db:managed` - skipped by scope; DB create/drop and Playwright forbidden and no `LMS_E2E_ADMIN_DATABASE_URL` supplied.
- Live object storage, malware scanner, signed redirects, Postgres create/drop, Stripe, Axioma, TradingView, bot/exchange, SSH/tmux/systemd, preview/prod endpoints - skipped by scope and unavailable credentials/contracts.

Exact recommended focused verification plan after implementation:
- `npm test -- packages/lms/src/materials.test.ts packages/lms/src/material-storage.test.ts packages/config/src/env.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
- If worker cleanup/config paths change: `npm test -- tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts`
- If a schema migration is added: `npm test -- tests/integration/db-lms-ph3-1.test.ts` plus `npm run db:generate -w @wtc/db`
- If route or DTO boundaries change: `npm test -- tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
- After focused tests pass: `npm run worker:smoke`
- Phase-level local gates: `node scripts/gates.mjs full`
- Browser gate: run env-cleared `node scripts/gates.mjs e2e` separately from `full`.
- LMS DB browser acceptance only when a throwaway DB is available: `npm run e2e:lms:db` with `LMS_E2E_DATABASE_URL`, or `npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`; archive evidence only after `scripts/scan-lms-db-e2e-artifacts.mjs` passes, then drop the throwaway DB.

Env/doc updates needed after implementation:
- `.env.example`: add LMS storage/scanner/retention variables with placeholders only, no live secrets.
- `packages/config/src/env.ts`: add typed LMS config and production fail-closed validation.
- `packages/config/src/env.test.ts`: prove production rejects unsafe `db-local`/missing scanner/object-store credentials where applicable.
- `docs/DEPLOYMENT.md`: document local/dev DB adapter, object-store adapter prerequisites, scanner prerequisites, signed URL TTL, NOT-RUN criteria, and rollback/cleanup expectations.
- `docs/ACCEPTANCE_MATRIX_MASTER.md`: add the storage adapter boundary gate and distinguish local DB-byte acceptance from object-store acceptance.
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`: update only after implementation/gates with exact RUN/NOT RUN evidence.

## Next actions
1. Define the `@wtc/lms` storage port and local DB/object-store adapter contract, with a fake object adapter for tests.
2. Add typed LMS storage/scanner env and production fail-closed validation.
3. Adjust the material file schema/migration if object-provider rows must not store `file_bytes_base64`.
4. Route uploads/downloads through the storage boundary while preserving current DB-local behavior for local/dev.
5. Extend static, route, repository, scanner, and config tests around no-leak, provider selection, signed URL handling, and production rejection.
6. Run the focused verification plan, then `node scripts/gates.mjs full`, separate `node scripts/gates.mjs e2e`, and the opt-in LMS DB browser gate only with a fresh throwaway DB/admin URL.
