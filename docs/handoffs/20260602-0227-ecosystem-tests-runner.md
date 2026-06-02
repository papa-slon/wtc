# ecosystem-tests-runner handoff
## Scope
Phase 3.26 read-only tests/devops audit before edits for removing the success `x-lms-sha256` download header and switching new local LMS object keys to an opaque shape. Inspected focused LMS tests, LMS DB e2e spec/harness/scanner, gate runner, storage/download code, repository/schema boundaries, and current docs. No product code, tests, or docs were edited except this required handoff. No gates, servers, DB commands, migrations/seeds, Playwright, worker commands, live endpoints, or external services were run.

## Files inspected
- `package.json`
- `.env.example`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `playwright.lms-db.config.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
None - read-only audit. Administrative handoff written at `docs/handoffs/20260602-0227-ecosystem-tests-runner.md` only.

## Findings
1. High - The implementation already omits the success `x-lms-sha256` response header, but the DB browser spec still expects it on a successful download. Evidence: `apps/web/src/features/lms/material-download.ts:33`-`apps/web/src/features/lms/material-download.ts:41` sets cache-control, content-type, content-length, content-disposition, nosniff, and referrer-policy, with no `x-lms-sha256`; `tests/e2e/lms-db-materials.spec.ts:210`-`tests/e2e/lms-db-materials.spec.ts:217` still expects `res.headers()['x-lms-sha256']` to equal `fileSha256`. Recommendation: update the DB browser spec success assertion to require `x-lms-sha256` absent while preserving integrity proof through status 200, `content-type`, `content-length`, `content-disposition`, `x-content-type-options`, and exact body equality. Keep `fileSha256` only as an internal no-leak marker if still needed by page/admin assertions. Target part: `tests/e2e/lms-db-materials.spec.ts`.

2. High - The route-handler unit test does not yet pin success-path hash-header absence, so the already-removed header can regress without focused Vitest catching it. Evidence: `tests/integration/lms-material-download-handler.test.ts:114`-`tests/integration/lms-material-download-handler.test.ts:121` asserts the success status, cache/content headers, filename, nosniff, and bytes, but has no success assertion for `x-lms-sha256`; failure helpers assert the header is absent only on non-success paths at `tests/integration/lms-material-download-handler.test.ts:100`-`tests/integration/lms-material-download-handler.test.ts:109`. Recommendation: add `expect(res.headers.get('x-lms-sha256')).toBeNull()` to the success test and keep failure-path absence assertions. Target part: `tests/integration/lms-material-download-handler.test.ts`.

3. High - The current storage-key validator still accepts multi-segment paths, which conflicts with the requested opaque local object-key shape. Evidence: `packages/lms/src/materials.ts:128`-`packages/lms/src/materials.ts:131` builds new keys as `lms/materials/<opaque objectId>`, but `packages/lms/src/materials.ts:138`-`packages/lms/src/materials.ts:139` only checks prefix, backslash, and `..`; the current test explicitly treats `lms/materials/ab/hash/name` as valid at `packages/lms/src/materials.test.ts:57`-`packages/lms/src/materials.test.ts:61`. Recommendation: tighten `isLmsMaterialStorageKey()` to the same single-segment opaque shape produced by `buildLmsStorageKey`, for example `^lms/materials/[A-Za-z0-9_-]{16,80}$`; update the test to make `lms/materials/ab/hash/name`, filename/hash-derived examples, slash-containing ids, and traversal strings invalid. Target part: `packages/lms/src/materials.ts` and `packages/lms/src/materials.test.ts`.

4. High - Repository writes can still accept arbitrary local storage keys when a caller supplies `storageKey`, so local key shape enforcement should not live only in the web storage helper. Evidence: `packages/db/src/repositories.ts:687`-`packages/db/src/repositories.ts:704` trims or defaults `storageProvider` and `storageKey`, then inserts the provided key without calling `isLmsMaterialStorageKey`; the schema requires `storage_key` to be non-null but does not constrain its shape (`packages/db/src/schema.ts:277`-`packages/db/src/schema.ts:294`). Recommendation: for new `db-local` and `fs-local` material rows, reject non-opaque LMS storage keys in `createMaterial` or the shared material input validator; add DB integration coverage that rejects `lms/materials/ab/hash/name` and `unexpected/materials/...` for local providers, while preserving the existing remote-provider cleanup safety tests until real object providers are formally added. Target part: `packages/db/src/repositories.ts`, `tests/integration/db-lms-ph3-1.test.ts`.

5. Medium - The local filesystem storage test proves only the prefix, not opacity or non-derivation from filename/hash. Evidence: `tests/integration/lms-material-storage.test.ts:63`-`tests/integration/lms-material-storage.test.ts:76` verifies `fs-local` omits DB bytes, writes under root, and `stored.storageKey` starts with `lms/materials/`, but does not assert a single opaque segment or that the key excludes `stored.contentSha256` and `plan`. Recommendation: strengthen the test to match the full opaque pattern, assert exactly three slash-separated segments (`lms`, `materials`, `<opaque>`), and assert the key contains neither the filename stem nor the content hash. Target part: `tests/integration/lms-material-storage.test.ts`.

6. Medium - The LMS DB e2e artifact scanner blocks storage keys and internal metadata, but it does not currently forbid the deprecated `x-lms-sha256` header name in generated artifacts. Evidence: scanner deny rules include storage fields, `lms/materials/`, content hash DTO fields, auth/session markers, and secret-shaped values at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:45`, but there is no `x-lms-sha256` rule; scanner tests cover storage-key leaks and metadata leaks at `tests/integration/lms-db-e2e-artifact-scan.test.ts:34`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:60`. Recommendation: add a forbidden scanner rule for `x-lms-sha256`, update the scanner test to fail on that header in generated text artifacts, and update the harness static test to assert the rule exists. Target part: `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`.

7. Medium - The harness static assertions need to move from "failure paths have no hash header" to "no success hash header exists". Evidence: `tests/integration/lms-db-e2e-harness.test.ts:76`-`tests/integration/lms-db-e2e-harness.test.ts:90` checks the DB browser flow and currently asserts the spec contains the failure-path `headers()['x-lms-sha256']).toBeUndefined` text; it does not assert that the success-path `.toBe(fileSha256)` assertion is gone. Recommendation: update this static test to assert the DB spec contains a success-path absence assertion and does not contain `headers()['x-lms-sha256']).toBe(fileSha256)` or an equivalent success hash-header exposure. Target part: `tests/integration/lms-db-e2e-harness.test.ts`.

8. Low - Docs already separate local storage from production object storage, but the next implementation should update acceptance wording precisely after the tests land. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:84`-`docs/ACCEPTANCE_MATRIX_MASTER.md:87` currently says local storage keys are validated under `lms/materials/`, while opaque production object keys remain separate acceptance; `docs/STATUS.md:15`-`docs/STATUS.md:16` and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still list opaque production object keys as open. Recommendation: after implementation and gates, document that local `db-local`/`fs-local` keys are now single-segment opaque keys under `lms/materials/`, while production S3/R2 key policy, signed redirects, external scanning, and object-store cleanup remain separate NOT-RUN blockers. Target part: `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/IMPLEMENTED_FILES.md`.

## Decisions
- Recommend treating success `x-lms-sha256` removal as a no-leak hardening change, not as a content-integrity removal. Tests should still verify downloaded bytes by exact body equality and server-side hash verification remains internal.
- Recommend defining "opaque local object key" as a single generated segment under `lms/materials/`, with no filename, hash, nested path, extension, provider name, or user/course/lesson/material identifier.
- Recommend enforcing opaque local keys at both the shared LMS helper layer and repository boundary, because repository tests create material rows directly and bypass web upload helpers.
- Recommend keeping the LMS DB browser gate opt-in and outside `scripts/gates.mjs full`; it requires a fresh throwaway DB or managed admin URL by design.

## Risks
- If only the Playwright DB spec is updated, route-level success header regressions may pass focused Vitest.
- If only `buildLmsStorageKey()` is considered, direct repository writes can still insert non-opaque local keys.
- If `isLmsMaterialStorageKey()` remains prefix-only, local filesystem path jailing still blocks traversal but does not enforce the promised opaque shape.
- If the artifact scanner does not forbid `x-lms-sha256`, trace/log artifacts may reintroduce the deprecated header name without failing the no-leak gate.
- If docs say "opaque keys complete" without distinguishing local opaque keys from production object-store policy, production readiness will be overstated.
- This workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`; `git status --short` returns `fatal: not a git repository`, so final state must be verified by direct file checks rather than git diff.

## Verification/tests
Gates run: none.

Gates not run:
- `npm test` - skipped by scope; gates/tests forbidden for this read-only audit.
- `npm run typecheck` - skipped by scope; gates forbidden.
- `npm run typecheck -w @wtc/web` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs quick` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs core` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs full` - skipped by scope; gates forbidden.
- `node scripts/gates.mjs e2e` - skipped by scope; Playwright/server runs forbidden.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - skipped by scope; scanner command forbidden.
- `npm run e2e:lms:db` - skipped by scope; DB/Playwright run forbidden and no `LMS_E2E_DATABASE_URL` supplied.
- `npm run e2e:lms:db:managed` - skipped by scope; DB create/drop and Playwright forbidden and no `LMS_E2E_ADMIN_DATABASE_URL` supplied.
- Live object storage, malware scanner, signed redirects, Postgres create/drop, Stripe, Axioma, TradingView, bot/exchange, SSH/tmux/systemd, preview/prod endpoints - skipped by scope and unavailable credentials/contracts.

Exact recommended focused verification plan after implementation:
- `npm test -- packages/lms/src/materials.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts`
- If repository storage-key validation touches schema or migrations: `npm run db:generate -w @wtc/db`
- If web download or upload route types change: `npm run typecheck -w @wtc/web`
- Phase-level local gates: `node scripts/gates.mjs full`
- Browser gate: run env-cleared `node scripts/gates.mjs e2e` separately from `full`
- LMS DB browser acceptance only when a throwaway DB is available: `npm run e2e:lms:db` with `LMS_E2E_DATABASE_URL`, or `npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`; archive evidence only after `scripts/scan-lms-db-e2e-artifacts.mjs` passes, then drop the throwaway DB.

## Next actions
1. Update focused unit/integration tests to assert success `x-lms-sha256` absence and opaque local key shape.
2. Tighten `isLmsMaterialStorageKey()` and repository local-provider storage-key validation to the single-segment opaque key policy.
3. Update LMS DB browser spec/static harness/scanner to remove success hash-header exposure and fail generated artifacts that contain the deprecated header name.
4. Run the focused verification plan, then `node scripts/gates.mjs full`, separate env-cleared `node scripts/gates.mjs e2e`, and the opt-in LMS DB browser gate only with a fresh throwaway DB/admin URL.
5. Update docs only after the implementation and observed gates, keeping local opaque keys separate from production S3/R2 key policy and signed-object delivery.
