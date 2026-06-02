# ecosystem-platform-architect handoff
## Scope
Phase 3.35 read-only audit for shared LMS object-store primitives after Phase 3.34. Inspect current web/worker S3/R2 signing, URL construction, PUT/DELETE/read redirect behavior, package boundaries, dependencies, and repo conventions. Recommend where shared primitives should live and how to keep boundaries clean. No product code, tests, migrations, or docs were edited outside this handoff.
## Files inspected
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/package.json`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/package.json`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `packages/lms/package.json`
- `packages/config/src/env.ts`
- `packages/config/package.json`
- `packages/shared/package.json`
- `package.json`
- `tsconfig.json`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
## Files changed
- `docs/handoffs/20260602-0548-ecosystem-platform-architect.md`
## Findings
1. High - Web and worker duplicate the same S3/R2 configuration, path encoding, SigV4 date/HMAC, and object URL logic, creating drift risk before live S3/R2 acceptance. Evidence: web defines `ObjectStorageConfig`, reads `LMS_OBJECT_STORAGE_*`, validates HTTPS endpoint/bucket/region, builds object paths/URLs, computes timestamp/HMAC/signing key, and signs canonical requests at `apps/web/src/features/lms/material-storage.ts:36-42`, `apps/web/src/features/lms/material-storage.ts:84-106`, and `apps/web/src/features/lms/material-storage.ts:202-267`; worker repeats the config/type/validation/path/HMAC flow at `apps/worker/src/lms-object-cleanup.ts:14-20`, `apps/worker/src/lms-object-cleanup.ts:40-62`, and `apps/worker/src/lms-object-cleanup.ts:64-128`. Recommendation: extract the shared LMS object-store primitives before live object-store acceptance. Target part: shared LMS object storage package surface.
2. High - The shared home should be `packages/lms/src/object-storage.ts`, exported through `@wtc/lms`, not app-local files and not `@wtc/config`. Evidence: both hosts already depend on `@wtc/lms` (`apps/web/package.json:29`, `apps/worker/package.json:17`); `@wtc/lms` already owns LMS storage provider constants, opaque key creation/validation, and byte hashing at `packages/lms/src/materials.ts:3-10`, `packages/lms/src/materials.ts:95-97`, and `packages/lms/src/materials.ts:129-145`; the package currently has no runtime package dependencies at `packages/lms/package.json:1-8`; repo convention keeps domain logic in `packages/*` at `docs/ARCHITECTURE_DECISIONS.md:16-19`; Phase 3.34 explicitly leaves shared object-store primitive extraction open at `docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md:70-73`. Recommendation: add an LMS-domain storage module under `packages/lms`, then make web/worker import request builders and small executor helpers from `@wtc/lms`. Target part: package placement.
3. High - The extracted package must stay pure: no `process.env`, no DB imports, no React/Next imports, no audit/log writes, and no `@wtc/config` import. Evidence: `@wtc/config` is server-only and owns typed env validation at `packages/config/src/env.ts:1-3`, `packages/config/src/env.ts:62-73`, and `packages/config/src/env.ts:105-121`; accepted architecture keeps pure packages env-free by passing resolved signer/config into package code instead of reading env directly at `docs/ARCHITECTURE_DECISIONS.md:136-154`; the cabinet ADR uses already-resolved primitive inputs to keep package dependencies clean at `docs/ARCHITECTURE_DECISIONS.md:221-225`. Recommendation: web/worker should resolve env into a typed `LmsObjectStorageConfig` at their server boundary, then pass it into `@wtc/lms` helpers. Target part: dependency direction.
4. Medium - The extracted API should centralize PUT/DELETE/GET signing while preserving host-owned lifecycle orchestration. Evidence: web currently signs PUT headers and performs object writes at `apps/web/src/features/lms/material-storage.ts:269-354`, signs compensation DELETE at `apps/web/src/features/lms/material-storage.ts:304-371`, and signs GET redirect URLs at `apps/web/src/features/lms/material-storage.ts:389-424`; worker signs DELETE and treats 404 as reconciled at `apps/worker/src/lms-object-cleanup.ts:95-145`; web lifecycle still needs the durable pre-PUT cleanup hook and DB atomic completion at `apps/web/src/features/lms/actions.ts:129-150` and `apps/web/src/features/lms/actions.ts:405-417`; worker lifecycle still needs DB candidate selection, retry, completion, and dead-letter accounting at `apps/worker/src/lms-object-cleanup.ts:147-218`. Recommendation: export pure builders such as `parseLmsObjectStorageConfig(source)`, `buildLmsObjectUrl(config, storageKey)`, `buildLmsObjectPutRequest(...)`, `buildLmsObjectDeleteRequest(...)`, `buildLmsObjectReadUrl(...)`, plus optional fetch-injected helpers `putLmsObject(...)` and `deleteLmsObject(...)`; keep DB transactions, audits, health, compensation orchestration, and worker retry loops in the hosts. Target part: API shape.
5. Medium - Tests already encode the required no-leak behavior and should move with the primitive extraction, not be weakened. Evidence: upload tests assert PUT uses path-style URL, AWS4 auth, no secret in authorization, no filename/hash in object URL, and read redirects include bounded `X-Amz-*` query fields without leaking filename/hash/secret at `tests/integration/lms-material-storage.test.ts:148-185`; compensation tests assert DELETE is signed, treats 404 as reconciled, and does not leak filename/hash at `tests/integration/lms-material-storage.test.ts:290-317`; worker tests assert pending cleanup DELETE handles 204/404/503, dead-letters failed tasks, and health/audit payloads omit cleanup IDs, key suffixes, and object-store secrets at `tests/integration/worker-tortila-snapshot.test.ts:288-353`; static tests assert durable cleanup wiring remains in the web action path at `tests/integration/lms-ph3-1-static.test.ts:146-157`. Recommendation: add focused `packages/lms/src/object-storage.test.ts` coverage for canonical request construction and URL/header no-leak rules, then keep existing integration tests as host-level lifecycle coverage. Target part: test plan.
6. Medium - Do not create a generic `@wtc/object-storage` package yet unless another bounded context starts using the same primitives. Evidence: current root workspaces allow new packages at `package.json:7-10`, but existing package list has no storage package; `@wtc/lms` is already shared by web and worker and contains the LMS-specific key prefix/validator at `packages/lms/src/materials.ts:7-8` and `packages/lms/src/materials.ts:129-145`; historical package convention cautions against premature package proliferation at `docs/ARCHITECTURE_DECISIONS.md:86-97`, while later pure logic extraction was justified only when it created real coverage and avoided app-local logic at `docs/ARCHITECTURE_DECISIONS.md:216-235`. Recommendation: keep Phase 3.35 scoped to `@wtc/lms`; if backtester artifacts later require the same S3/R2 signer, split the generic SigV4 core into `@wtc/object-storage` then, with LMS key validation remaining in `@wtc/lms`. Target part: package proliferation boundary.
7. Low - Env validation is strong in `@wtc/config`, but runtime web/worker currently duplicate a second validator. Evidence: config requires the five object-store variables and HTTPS endpoint for `LMS_FILE_STORAGE_PROVIDER=s3-r2` at `packages/config/src/env.ts:105-121`, while web and worker repeat runtime endpoint/bucket/region validation at `apps/web/src/features/lms/material-storage.ts:84-106` and `apps/worker/src/lms-object-cleanup.ts:40-62`. Recommendation: expose a single config-shape parser in `@wtc/lms` that can be called with values already validated by `@wtc/config` or raw env in tests; it should return redacted/generic errors only and never retain secrets beyond the signing config object. Target part: config adapter boundary.
## Decisions
- Put the shared LMS object-store implementation in `packages/lms/src/object-storage.ts`, exported from `packages/lms/src/index.ts`.
- Keep `@wtc/lms` pure and host-agnostic: no direct `process.env`, no DB/repository imports, no Next/React imports, no audit/log/health writes, and no dependency on `@wtc/config`.
- Web remains owner of upload scanner ordering, `beforeObjectPut`, material creation, compensation orchestration, and download auth/entitlement route behavior.
- Worker remains owner of cleanup candidate selection, retry/dead-letter accounting, worker health, and summary audit writes.
- Object-store primitives return signed URLs/headers/request descriptors and generic error codes only; they must never log or expose storage keys, secrets, authorization headers, signed query strings, filenames, hashes, scanner details, or provider bodies outside private host execution.
## Risks
- Leaving duplicated SigV4 code through live acceptance risks web and worker diverging on canonical URI/query/header behavior.
- Moving too much into `@wtc/lms` would blur host responsibilities and could accidentally import DB/env/audit concerns into a domain package.
- Moving too little would leave fetch/404/error semantics duplicated and preserve the current drift risk.
- A generic storage package now would add package/dependency churn before there is a second production consumer.
## Verification/tests
- Read-only audit only.
- Commands used: `rg` searches and line-numbered `Get-Content` reads.
- No product code, tests, migrations, live S3/R2 calls, scanner calls, browser runs, DB commands, or gate commands were executed.
## Next actions
1. Implement `packages/lms/src/object-storage.ts` with typed config parsing, path-style object URL construction, SigV4 request signing for `GET`/`PUT`/`DELETE`, read URL signing, and fetch-injected PUT/DELETE helpers.
2. Refactor `apps/web/src/features/lms/material-storage.ts` to delegate S3/R2 URL/signing/PUT/DELETE/redirect creation to `@wtc/lms` while retaining scanner, local/fs storage, durable cleanup hook, and download delivery orchestration.
3. Refactor `apps/worker/src/lms-object-cleanup.ts` to delegate DELETE signing/execution to `@wtc/lms` while retaining DB cleanup loops and health/audit counting.
4. Add package-level unit tests for canonical signing/path/query behavior and no-leak properties, then rerun existing LMS storage, worker cleanup, scanner-artifact, typecheck, lint, and full/e2e gates.
5. Keep live S3/R2 acceptance, live scanner acceptance, DB-backed browser acceptance, public upload rollout, and dead-letter acknowledgement/retry workflow as separate later gates.
