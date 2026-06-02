# ecosystem-devops-implementer handoff
## Scope
Phase 3.35 read-only deployment/config audit for shared LMS object-store primitives after Phase 3.34. Scope covered env docs/config, web and worker object-store usage, package boundaries, deployment docs, and acceptance gates. No product code or deployment config was edited.

## Files inspected
- `.env.example`
- `package.json`
- `tsconfig.json`
- `apps/web/package.json`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/tick-once.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/lms/package.json`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/object-storage.ts`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Shared object-store primitives now exist in `@wtc/lms`, and the web LMS storage path is already partially migrated, but the worker still duplicates S3/R2 config parsing, URL construction, and SigV4 DELETE signing. Evidence: shared env/config and request builders live in `packages/lms/src/object-storage.ts:19-40`, `packages/lms/src/object-storage.ts:112-186`, and `packages/lms/src/object-storage.ts:188-223`; the package exports the module at `packages/lms/src/index.ts:18-19`; web imports those builders at `apps/web/src/features/lms/material-storage.ts:3-18`, uses them for PUT at `apps/web/src/features/lms/material-storage.ts:172-180`, DELETE at `apps/web/src/features/lms/material-storage.ts:189-203`, and signed read redirects at `apps/web/src/features/lms/material-storage.ts:300-311`. The worker still imports `createHmac` directly at `apps/worker/src/lms-object-cleanup.ts:1`, defines its own object-storage config shape at `apps/worker/src/lms-object-cleanup.ts:14-20`, reads the same env keys itself at `apps/worker/src/lms-object-cleanup.ts:40-61`, and builds DELETE authorization locally at `apps/worker/src/lms-object-cleanup.ts:95-145`. Recommendation: complete the extraction by migrating the worker to `readLmsObjectStorageConfig()` and `buildLmsObjectDeleteRequest()`, then delete the duplicate worker signer/config code. Target part: worker deployment/runtime parity.

2. Severity: High. The shared primitive extraction should not rename deployment variables or introduce a second object-store config source. Evidence: typed config defines the public storage/scanner variables at `packages/config/src/env.ts:62-73`, requires all five object-store keys when `LMS_FILE_STORAGE_PROVIDER=s3-r2` at `packages/config/src/env.ts:105-120`, and gates production/staging public uploads on `s3-r2` plus external scanner at `packages/config/src/env.ts:136-143`. `.env.example` documents the same object-store and scanner names at `.env.example:26-43`. Deployment docs also name the same required object-store envs at `docs/DEPLOYMENT.md:50-56` and scanner envs at `docs/DEPLOYMENT.md:58-63`. Recommendation: keep `LMS_OBJECT_STORAGE_ENDPOINT`, `LMS_OBJECT_STORAGE_BUCKET`, `LMS_OBJECT_STORAGE_REGION`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID`, and `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY` as the only object-store runtime contract for both web and worker; do not add app-specific aliases. Target part: deployment config contract.

3. Severity: Medium. The top-level production Environment section is stale/incomplete for this rollout boundary and can mislead operators even though the detailed LMS section is correct. Evidence: `docs/DEPLOYMENT.md:251-252` lists `DATABASE_URL`, session/vault keys, and `AXIOMA_HANDOFF_SIGNING_SECRET` as required in production, but does not include the conditional LMS object-store/scanner envs needed when public uploads are enabled; it also names the HS256 dev stub while `.env.example:81-89` says ES256 key material is required for `APP_ENV=staging|production`, and typed config enforces that at `packages/config/src/env.ts:89-95`. The detailed LMS boundary correctly keeps `LMS_PUBLIC_UPLOADS_ENABLED=false` until shared primitives, live object-store acceptance, live scanner acceptance, DB browser evidence, and retained artifact scanning are complete at `docs/DEPLOYMENT.md:80-83`. Recommendation: when Phase 3.35 is implemented, update the Environment section to separate always-required production envs from conditional LMS public-upload envs and replace the Axioma HS256 production wording with ES256 key wording. Target part: deployment documentation.

4. Severity: Medium. Shared primitive extraction is not enough to enable public uploads; live acceptance gates remain explicit blockers. Evidence: current status says shared object-store primitives, live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, observed DB-backed browser acceptance, and public rollout remain open at `docs/STATUS.md:20-22`. Production blockers repeat that the LMS path is locally gate-verified but still blocked on shared primitives, live S3/R2, live scanner, observed DB browser acceptance, and public rollout at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. The acceptance matrix says the S3/R2 boundary is local only and needs separate observed live gates at `docs/ACCEPTANCE_MATRIX_MASTER.md:91-97`, and the dead-letter ops boundary is not live object-store/scanner/DB-browser/public rollout at `docs/ACCEPTANCE_MATRIX_MASTER.md:129-135`. Recommendation: after worker migration, keep `LMS_PUBLIC_UPLOADS_ENABLED=false` until a live throwaway bucket/scanner/browser acceptance phase produces retained no-leak artifacts. Target part: rollout sequencing.

5. Severity: Medium. Current CI/gate scripts do not provide a dedicated worker typecheck, so worker migration must be covered by focused worker tests or a new worker typecheck gate. Evidence: root `tsconfig.json:8-13` includes packages and tests, not `apps/worker/src`; `apps/worker/package.json:6-10` has dev/start/tick scripts but no `typecheck`; root `ci:local` runs package/root typecheck, web typecheck, tests, and build at `package.json:31-32`. The worker one-shot path fails closed without `DATABASE_URL` unless explicitly using local memory demo at `apps/worker/src/tick-once.ts:4-20`, and DB tick output includes LMS object cleanup counters at `apps/worker/src/tick-once.ts:22-25`. Recommendation: require focused worker integration tests plus `npm run worker:smoke`; consider adding `typecheck -w @wtc/worker` before claiming the worker has migrated to shared primitives. Target part: release verification.

6. Severity: Medium. There is no dedicated package-level test for the shared object-storage module, even though it now centralizes signing logic used by web and intended for worker. Evidence: `packages/lms/src/object-storage.ts:112-186` builds PUT/DELETE Authorization headers and `packages/lms/src/object-storage.ts:188-223` builds signed read URLs, but `packages/lms/src` currently contains `materials.test.ts` and `lms.test.ts` only, with no `object-storage.test.ts`. Existing integration tests assert web/worker behavior and no secret leakage, e.g. storage Authorization and signed redirect assertions at `tests/integration/lms-material-storage.test.ts:162-183` and worker DELETE assertions at `tests/integration/worker-tortila-snapshot.test.ts:218-219`, but the worker still uses its duplicate signer. Recommendation: add deterministic package tests for config validation, path encoding, PUT/DELETE headers, signed read URL TTL, and secret non-disclosure before deleting the old worker code. Target part: shared primitive test coverage.

7. Severity: Low. The shared object-store module uses Node `crypto`, so it is suitable for the current Node server/worker runtime but should not be moved into an Edge/client boundary. Evidence: `packages/lms/src/object-storage.ts:1` imports `node:crypto`; web server-side storage code imports the helper in `apps/web/src/features/lms/material-storage.ts:3-18`; worker already depends on `@wtc/lms` at `apps/worker/package.json:11-18`. Recommendation: keep object-store calls server-only and document that any future route using these helpers must remain Node runtime. Target part: runtime placement.

## Decisions
- No env variable rename is needed for shared object-store primitives.
- The shared primitive home can remain `@wtc/lms` because both `@wtc/web` and `@wtc/worker` already depend on that package.
- Worker migration is the remaining implementation step for this boundary; web is already wired to the shared request builders in the current worktree.
- Public uploads stay disabled until shared worker wiring, live S3/R2, live scanner, DB browser, and retained no-leak artifact gates are observed.
- Deployment docs should treat object-store/scanner envs as conditional public-upload production requirements, not general local boot requirements.

## Risks
- Leaving the worker on duplicate SigV4 code can create web/worker drift for DELETE signing, endpoint validation, path encoding, and `404` handling.
- A future operator may read only the top-level Environment section and miss the conditional object-store/scanner envs required for public uploads.
- Without a dedicated worker typecheck or package-level object-storage tests, a refactor can appear green while worker runtime coverage depends on narrower integration tests.
- Enabling public uploads before live bucket/scanner/browser acceptance would convert a local mocked boundary into an unverified production path.
- Moving the Node crypto helper into any Edge/client path would break runtime assumptions and risk exposing signed material.

## Verification/tests
- Read-only audit only.
- Commands used: `rg` searches and line-numbered PowerShell `Get-Content` reads against the current repo.
- No test gates were run by this audit agent.
- No live server, database, object store, scanner, browser, deployment config, `.env`, nginx, systemd, or production host was touched.

## Next actions
1. Migrate `apps/worker/src/lms-object-cleanup.ts` to `readLmsObjectStorageConfig()` and `buildLmsObjectDeleteRequest()` from `@wtc/lms`; delete duplicate worker config/signing helpers.
2. Add `packages/lms/src/object-storage.test.ts` for deterministic config/signing/read-URL coverage and secret non-disclosure.
3. Run focused LMS storage/worker tests, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run worker:smoke`, `npm run secret:scan`, `node scripts/gates.mjs full`, and governance after the implementation handoff exists.
4. Update `docs/DEPLOYMENT.md` Environment wording to separate always-required production envs from conditional LMS public-upload envs and align Axioma production wording with ES256.
5. Keep live S3/R2 upload/download/delete/reconcile, live scanner, DB-backed browser acceptance, and public upload rollout as separate operator-approved gates.
