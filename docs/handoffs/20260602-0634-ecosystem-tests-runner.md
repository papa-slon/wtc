# ecosystem-tests-runner handoff
## Scope
Phase 3.37 read-only verification audit for LMS S3/R2 live acceptance preflight. Scope was limited to deterministic SigV4 coverage, live-preflight script syntax/dry-run expectations, generated-artifact scanner coverage, phase gates, and exact NOT RUN boundaries. No product code, tests, scripts, configs, gates, server processes, live object storage, scanner endpoints, databases, or deployment targets were changed or exercised.
## Files inspected
- `package.json`
- `.env.example`
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/safe-worker-tick.mjs`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md`
## Files changed
`docs/handoffs/20260602-0634-ecosystem-tests-runner.md` only.
## Findings
1. High - Current SigV4 tests verify shape and no-secret behavior, but they do not pin deterministic reference-vector signatures. Evidence: `packages/lms/src/object-storage.test.ts:26`-`packages/lms/src/object-storage.test.ts:50` asserts PUT/DELETE URL shape, signed-header names, and secret omission; `packages/lms/src/object-storage.test.ts:52`-`packages/lms/src/object-storage.test.ts:70` asserts read URL algorithm, bounded expiry, and a 64-hex signature pattern. The shared signer itself builds canonical requests and HMAC signatures at `packages/lms/src/object-storage.ts:93`-`packages/lms/src/object-storage.ts:107`, `packages/lms/src/object-storage.ts:112`-`packages/lms/src/object-storage.ts:150`, `packages/lms/src/object-storage.ts:152`-`packages/lms/src/object-storage.ts:186`, and `packages/lms/src/object-storage.ts:188`-`packages/lms/src/object-storage.ts:222`. Recommendation: before any live S3/R2 claim, add deterministic golden assertions for exact PUT Authorization, exact DELETE Authorization, exact read URL query ordering/signature, exact `x-amz-date`, exact payload hash, and encoded path-style bucket/key behavior using fixed env, fixed key, fixed payload, and fixed timestamp. Target part: `packages/lms/src/object-storage.test.ts`.
2. High - There is no current repo-native live S3/R2 preflight script or npm command to syntax-check or dry-run. Evidence: `package.json:28`-`package.json:29` defines only LMS DB e2e runners, while `package.json:22`-`package.json:23` defines worker/db helpers; the scripts directory contains gate, LMS DB, preview, worker, governance, and artifact scanner helpers, but no S3/R2 live-preflight command. `.env.example:33`-`.env.example:37` documents the required object-store env names. Recommendation: add a dedicated script such as `scripts/lms-s3-r2-live-preflight.mjs` with `--dry-run` and explicit `--live` modes; dry-run must validate env/config, build signed PUT/GET/DELETE/read requests, redact all secrets, and exit without network I/O. Required syntax/dry-run commands after the script exists: `node --check scripts/lms-s3-r2-live-preflight.mjs` and `node scripts/lms-s3-r2-live-preflight.mjs --dry-run`. Target part: preflight script and npm command boundary.
3. High - The artifact scanner blocks signed URL tokens, storage keys, auth headers, DB URLs, scanner env, and dynamic markers, but it does not yet block `LMS_OBJECT_STORAGE_*` assignments that live preflight logs could accidentally capture. Evidence: object storage credentials are named in `.env.example:33`-`.env.example:37`; scanner deny rules cover `DATABASE_URL`, `SESSION_SECRET`, `SECRET_VAULT_KEK`, `LMS_FILE_SCANNER_ENDPOINT`, `LMS_FILE_SCANNER_TOKEN`, and `LMS_DB_E2E_PREP_TOKEN` at `scripts/scan-lms-db-e2e-artifacts.mjs:41`-`scripts/scan-lms-db-e2e-artifacts.mjs:47`, but not the object-store endpoint, bucket, region, access key id, or secret access key names. It does block `X-Amz-*` signed URL tokens and authorization/cookie markers at `scripts/scan-lms-db-e2e-artifacts.mjs:27`-`scripts/scan-lms-db-e2e-artifacts.mjs:54`. Recommendation: before retaining live-preflight evidence, extend scanner fixtures to fail on `LMS_OBJECT_STORAGE_ENDPOINT=`, `LMS_OBJECT_STORAGE_BUCKET=`, `LMS_OBJECT_STORAGE_REGION=`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID=`, and `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY=` assignments, plus any provider-specific signed-query/header names introduced by the preflight script. Target part: `scripts/scan-lms-db-e2e-artifacts.mjs` and `tests/integration/lms-db-e2e-artifact-scan.test.ts`.
4. Medium - Scanner invocation can already target explicit evidence roots, so live-preflight evidence should be scanned separately rather than relying only on default LMS DB roots. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:5` defines default roots for DB/e2e artifacts, while `scripts/scan-lms-db-e2e-artifacts.mjs:122`-`scripts/scan-lms-db-e2e-artifacts.mjs:123` switches to CLI-supplied roots when provided. Recommendation: require the live preflight to write only redacted evidence under a dedicated path such as `logs/lms-s3-r2-preflight`, then run `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-s3-r2-preflight` before archiving any output. Target part: evidence retention and artifact scanner command.
5. Medium - Gate sequencing must keep Playwright e2e separate from the full gate, despite a stale usage comment. Evidence: `scripts/gates.mjs:13`-`scripts/gates.mjs:16` says `full = core + build + e2e`, but the executable plan excludes e2e from `full` at `scripts/gates.mjs:48`-`scripts/gates.mjs:52`, and the note at `scripts/gates.mjs:43`-`scripts/gates.mjs:46` says e2e is its own plan. Recommendation: Phase 3.37 final gates should run `node scripts/gates.mjs full` and then `node scripts/gates.mjs e2e` as two separate commands; optionally fix the stale usage comment in a later non-read-only edit. Target part: phase verification sequence.
6. Medium - The existing LMS DB browser runner and scanner are useful supporting evidence, but they are not live S3/R2 acceptance. Evidence: `scripts/run-lms-db-e2e.mjs:61`-`scripts/run-lms-db-e2e.mjs:77` prepares a throwaway DB, runs Playwright, and invokes the artifact scanner; `docs/DEPLOYMENT.md:137`-`docs/DEPLOYMENT.md:140` states this proves only local DB-byte browser acceptance, not live S3/R2 storage, live external scanning, cleanup/reconciliation, or public upload rollout. Recommendation: keep `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` as a separate optional DB-browser gate and do not use it to claim live object-store preflight success. Target part: NOT RUN boundaries and acceptance wording.
7. Low - Current docs correctly keep live S3/R2 and public rollout blocked, so the Phase 3.37 plan should preserve that boundary until a live throwaway bucket run is observed and scanned. Evidence: `docs/STATUS.md:20`-`docs/STATUS.md:21` keeps live S3/R2, live scanner, DB-browser acceptance, and public upload rollout open; `docs/DEPLOYMENT.md:82`-`docs/DEPLOYMENT.md:85` keeps `LMS_PUBLIC_UPLOADS_ENABLED=false` until live object-store/scanner/DB evidence lands; `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` keeps live S3/R2, live scanner, observed DB browser acceptance, and public upload rollout open. Recommendation: final Phase 3.37 docs should say "preflight-ready" only if the script/tests land and pass; they must not say "live accepted" unless an operator-approved throwaway bucket/scanner run actually completed. Target part: status and blocker docs.
## Decisions
- Treat deterministic SigV4 golden tests as required preflight evidence; existing regex/shape assertions are not enough for live compatibility.
- Treat a live S3/R2 preflight script as a separate guarded tool with `--dry-run` default behavior and explicit `--live` execution only under operator-approved throwaway credentials.
- Keep all retained evidence redacted and scanner-passed; do not archive raw Authorization headers, signed URLs, object keys, object-store env assignments, scanner tokens, DB URLs, cookies, provider responses, or request bodies.
- Keep `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separate.
- Keep DB-browser acceptance, live external scanner acceptance, public upload rollout, and production bucket use outside this read-only audit.
## Risks
- Without exact golden signatures, a canonicalization bug can pass local tests but fail against R2/S3.
- Without a dry-run preflight script, the first operator-supplied credentials would be tested through ad hoc commands, increasing leak and mutation risk.
- Without object-store env deny rules, retained logs could include bucket, endpoint, or key-id material even when signed URL tokens are blocked.
- Live preflight can create residual objects if it does not use a unique throwaway prefix, verify readback, delete, and confirm absence or delete idempotency.
- A broad `full` gate alone can be misreported as including Playwright e2e because of the stale usage comment.
## Verification/tests
RUN in this audit:
- Source/file inspection only.

NOT RUN in this audit:
- `npm test`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `npm run worker:smoke`
- `npm run db:generate -w @wtc/db`
- `npm run secret:scan`
- `npm run governance:check`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- `node scripts/scan-lms-db-e2e-artifacts.mjs`
- `npm run e2e:lms:db`
- `npm run e2e:lms:db:managed`
- Live S3/R2 upload/download/delete/reconcile/preflight
- Live external malware scanner acceptance
- Public LMS upload rollout
- Preview/production server mutation, SSH, tmux, systemd, deployment, or live bot/exchange actions

Recommended focused commands after Phase 3.37 implementation:
- `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-object-storage-shared-static.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts packages/config/src/env.test.ts`
- `node --check scripts/lms-s3-r2-live-preflight.mjs`
- `node scripts/lms-s3-r2-live-preflight.mjs --dry-run`
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-s3-r2-preflight`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `npm run worker:smoke`
- `npm run db:generate -w @wtc/db`
- `npm run secret:scan`
- `npm run governance:check`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`

Recommended live command boundary, only after operator-approved throwaway object-store credentials are supplied and dry-run/focused gates are green:
- `node scripts/lms-s3-r2-live-preflight.mjs --live --prefix wtc-preflight-20260602-0634/`

Optional DB-browser gate, only with a fresh throwaway Postgres URL or managed admin URL:
- `npm run e2e:lms:db`
- `npm run e2e:lms:db:managed`
## Next actions
1. Add deterministic SigV4 golden tests for PUT, DELETE, and signed read URL construction.
2. Add a guarded `scripts/lms-s3-r2-live-preflight.mjs` with `--dry-run` default behavior, explicit `--live`, unique throwaway prefix support, redacted output, readback verification, delete verification, and nonzero exit on cleanup uncertainty.
3. Extend the artifact scanner and scanner tests for object-store env assignment leaks and any new preflight evidence roots.
4. Run the focused command set, syntax check, dry-run, scanner, `full`, separate `e2e`, final secret scan, and final governance before writing any aggregate Phase 3.37 completion claim.
5. Keep live S3/R2, live scanner, DB-browser acceptance, and public upload rollout marked NOT RUN unless the exact credentialed gates are observed in this session and scanner-passed evidence is retained.
