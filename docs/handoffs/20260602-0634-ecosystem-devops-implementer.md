# ecosystem-devops-implementer handoff
## Scope
Phase 3.37 read-only audit for an operator-safe live S3/R2 acceptance harness and deployment documentation. Scope was limited to inspecting current deployment docs, environment examples, package scripts, LMS DB artifact scanning, and shared object-storage configuration/builders. No product code, scripts, env files, or deployment docs were edited.

## Files inspected
- `docs/DEPLOYMENT.md`
- `.env.example`
- `package.json`
- `apps/web/package.json`
- `packages/lms/src/object-storage.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
None — read-only audit

## Findings
1. P1 - Live S3/R2 acceptance has no dedicated operator-safe command yet. Evidence: `package.json:28-29` exposes only LMS DB browser acceptance scripts, while `docs/DEPLOYMENT.md:70-72` says no live bucket credentials were used and no live upload/download/delete/reconcile acceptance was run; `docs/DEPLOYMENT.md:139-140` explicitly states the DB browser harness is not live S3/R2 acceptance. Recommendation: add a future single entry point such as `npm run e2e:lms:s3-r2` plus optional `npm run e2e:lms:s3-r2:managed`; it should wrap the existing fresh throwaway DB flow, force `LMS_FILE_STORAGE_PROVIDER=s3-r2`, run upload/download/delete/worker-reconcile paths against a disposable private bucket, invoke the artifact scanner, and exit nonzero on any cleanup or scanner uncertainty. Target part: package scripts plus a new deployment-doc section.

2. P1 - The canonical env names already exist and should be reused, not aliased. Evidence: `.env.example:31-37` documents `LMS_FILE_STORAGE_PROVIDER=s3-r2` and the five `LMS_OBJECT_STORAGE_*` values; `docs/DEPLOYMENT.md:53-56` documents the same required variables; `packages/lms/src/object-storage.ts:19-40` validates only those names and enforces HTTPS endpoint, no embedded auth/search/hash, and bucket/region shape. Recommendation: the live harness should require the existing names exactly, add only an explicit consent guard such as `LMS_LIVE_OBJECT_ACCEPTANCE=1`, and reject ambiguous aliases like `S3_BUCKET`, `R2_SECRET`, or unscoped provider variables. Target part: command UX and deployment docs.

3. P1 - Public upload enablement must stay separate from live acceptance execution. Evidence: `.env.example:30` says public production uploads must stay disabled until live object-store and external scanner acceptance is observed; `.env.example:43` defaults `LMS_PUBLIC_UPLOADS_ENABLED=false`; `docs/DEPLOYMENT.md:82-85` repeats that public uploads stay disabled until live object-store acceptance, live scanner acceptance, DB browser evidence, and retained scanner-passing artifacts exist. Recommendation: the live S3/R2 harness should refuse to run with `LMS_PUBLIC_UPLOADS_ENABLED=true`; public rollout should be a later operator-approved step after both object-store and scanner gates are green. Target part: harness stop conditions and deployment checklist.

4. P1 - Existing artifact scanner is useful but DB-harness-specific and needs live object-store deny rules before reuse. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:5` scans `test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`; `scripts/scan-lms-db-e2e-artifacts.mjs:28-31` blocks signed object URL tokens; `scripts/scan-lms-db-e2e-artifacts.mjs:45-46` blocks scanner endpoint/token assignments, but there is no parallel deny rule for `LMS_OBJECT_STORAGE_ENDPOINT`, `LMS_OBJECT_STORAGE_BUCKET`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID`, or `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY`. Recommendation: extend or fork the scanner for live object-store evidence roots such as `logs/lms-s3-r2-e2e`, and deny object-store env assignments, access-key identifiers, authorization headers, raw provider responses, signed URLs, and object keys in text artifacts. Target part: artifact scanner and evidence retention docs.

5. P1 - Cleanup must be part of the pass condition, not an afterthought. Evidence: `packages/lms/src/object-storage.ts:112-123`, `packages/lms/src/object-storage.ts:152-160`, and `packages/lms/src/object-storage.ts:188-204` can build signed PUT, DELETE, and read URLs; `docs/DEPLOYMENT.md:75-80` describes durable pending cleanup and dead-letter retry state; `scripts/run-lms-db-e2e-managed.mjs:68-81` is a good model because it creates and drops a throwaway DB in `finally`. Recommendation: the future live harness should use a disposable bucket or dedicated acceptance account, track created object keys in memory only, run app/worker cleanup before DB drop, verify created clean objects are deleted or already absent, and fail with redacted counts if cleanup cannot be proven. Do not print raw object keys, signed URLs, provider bodies, or auth headers. Target part: live harness implementation and docs.

6. P2 - The current DB browser runner already has good NOT RUN semantics that should be copied. Evidence: `scripts/run-lms-db-e2e.mjs:9-16` refuses missing `LMS_E2E_DATABASE_URL`; `playwright.lms-db.config.ts:14-20` refuses direct Playwright usage without runner prep; `docs/DEPLOYMENT.md:137-138` says a skipped or unprovided URL is NOT RUN. Recommendation: live S3/R2 acceptance should be reported as RUN only when the dedicated live command exits 0 after upload, download/read redirect, delete/compensation, worker reconcile, cleanup verification, and artifact scanning. Missing credentials, missing `LMS_LIVE_OBJECT_ACCEPTANCE=1`, or operator refusal should be reported as NOT RUN, not PASS or skipped. A failed live attempt should be FAIL with cleanup status. Target part: final report template and docs.

## Decisions
- Do not mutate product code or existing deployment docs in this lane.
- Keep the canonical provider/env surface as `LMS_FILE_STORAGE_PROVIDER=s3-r2`, `LMS_OBJECT_STORAGE_ENDPOINT`, `LMS_OBJECT_STORAGE_BUCKET`, `LMS_OBJECT_STORAGE_REGION`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID`, and `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY`.
- Recommend one explicit live-acceptance consent variable, `LMS_LIVE_OBJECT_ACCEPTANCE=1`, so accidental local or CI runs cannot touch object storage.
- Recommend object-only live S3/R2 acceptance remain isolated from public upload rollout and from live external scanner acceptance. Public uploads stay off until all required acceptance gates are green.

## Risks
- Without a dedicated live command, operators may overclaim `npm run e2e:lms:db` as live S3/R2 proof even though current docs explicitly scope it to DB-byte browser acceptance.
- Reusing current artifact roots without live-specific deny rules could leak object-store endpoint names, access-key identifiers, signed query tokens, provider response text, or object keys.
- If cleanup verification is not a hard pass condition, a failed acceptance run can leave live objects in the bucket while still producing ambiguous evidence.
- Running against a production bucket or production DB would violate the repo's acceptance model. The command must require a fresh throwaway DB and a disposable private bucket/account or an operator-approved dedicated acceptance bucket with lifecycle cleanup.

## Verification/tests
- No npm gates, Playwright runs, DB commands, live bucket calls, or scanner runs were executed; this was a read-only source audit.
- Verified by inspection that the requested target handoff path did not exist before creation.
- `git status --short` was not used as authoritative evidence because this workspace is not a git repository.

## Next actions
1. Add a new operator-safe command UX in a later implementation phase:
   - `npm run e2e:lms:s3-r2`
   - optional managed DB wrapper: `npm run e2e:lms:s3-r2:managed`
2. Required env contract for that command:
   - `LMS_LIVE_OBJECT_ACCEPTANCE=1`
   - `LMS_E2E_DATABASE_URL` for an already-created fresh `wtc_test_lms_*` DB, or `LMS_E2E_ADMIN_DATABASE_URL` for managed creation/drop
   - `LMS_FILE_STORAGE_PROVIDER=s3-r2`
   - `LMS_OBJECT_STORAGE_ENDPOINT`
   - `LMS_OBJECT_STORAGE_BUCKET`
   - `LMS_OBJECT_STORAGE_REGION`
   - `LMS_OBJECT_STORAGE_ACCESS_KEY_ID`
   - `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY`
   - `LMS_PUBLIC_UPLOADS_ENABLED=false`
3. Required stop conditions:
   - refuse missing `LMS_LIVE_OBJECT_ACCEPTANCE=1`
   - refuse missing or invalid object-store config
   - refuse non-HTTPS endpoints or endpoints with embedded auth, path, query, or fragment
   - refuse non-throwaway DB names
   - refuse `LMS_PUBLIC_UPLOADS_ENABLED=true`
   - refuse production bucket/account unless the operator explicitly marks it as a disposable acceptance target
   - fail on any artifact scanner hit, leaked signed URL token, leaked auth header, raw object key, or provider response body
   - fail if object cleanup cannot be proven
4. Required cleanup behavior:
   - use a fresh throwaway DB and drop it in `finally`
   - use a disposable private bucket/account or a dedicated acceptance bucket with lifecycle cleanup
   - track created objects in memory only
   - run delete/worker-reconcile cleanup before DB drop
   - report only redacted counts and generic error codes
   - never retain raw object keys, signed URLs, authorization headers, object-store env assignments, or provider response bodies in artifacts
5. Required honest reporting:
   - `RUN/PASS` only if the dedicated live command exits 0 and proves upload, read/download, delete or compensation, worker reconcile, cleanup, and artifact scan
   - `NOT RUN` if credentials, consent env, fresh DB, disposable bucket, or operator approval were not supplied
   - `FAIL` if a live attempt started and any operation, scanner check, or cleanup verification failed
