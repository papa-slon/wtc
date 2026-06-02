# ecosystem-security-auditor handoff
## Scope
Phase 3.18 read-only security audit for a DB-backed browser acceptance slice covering LMS upload/download path, e2e auth bypass, Playwright environment, secret/audit constraints, material scan/storage metadata, and docs blockers.

Goal: identify guardrails for local browser acceptance without secrets, raw bytes in audit, public storage keys, entitlement/download fail-open behavior, or live service contact.

No servers, Playwright, database mutations, psql, live endpoints, Stripe, Axioma, TradingView, bot/exchange services, SSH, tmux, systemd, preview-worker, or production endpoints were touched. Product code and docs were not edited beyond this required per-agent handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `docs/handoffs/20260601-2303-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-2303-ecosystem-tests-runner.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `.env.example`
- `playwright.config.ts`
- `scripts/gates.mjs`
- `apps/web/package.json`
- `apps/web/src/app/api/e2e/login/route.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/security-headers.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - DB-backed browser acceptance remains unproven and must not be inferred from the current default e2e suite. Evidence: Playwright starts a local dev server on port 3100 with `E2E_AUTH_BYPASS=1`, `APP_ENV=development`, mock bot mode, and live controls disabled, but no `DATABASE_URL` in `playwright.config.ts:23`-`playwright.config.ts:35`; the education e2e file states teacher editor and DB-backed detail are out of reach because the demo backend has no `DATABASE_URL` at `tests/e2e/education-ph3-1-mobile.spec.ts:7`-`tests/e2e/education-ph3-1-mobile.spec.ts:11`; smoke e2e asserts the in-memory demo label at `tests/e2e/smoke.spec.ts:59`-`tests/e2e/smoke.spec.ts:68` and `tests/e2e/smoke.spec.ts:85`-`tests/e2e/smoke.spec.ts:89`; Phase 3.17 aggregate says DB-backed browser acceptance was not run and should be a future Playwright project at `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:55` and `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:68`-`docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:71`. Recommendation: add a separate opt-in DB-backed Playwright project/spec using a throwaway local DB only, seeded teacher/student/education entitlement data, and the existing safety env (`BOT_ADAPTER_MODE=mock`, live controls false, TV automation false). It must prove teacher upload -> clean scan/status -> student download headers/bytes -> revoked/no-entitlement denial, and must be listed separately from default demo e2e. Target part: Playwright config, e2e seed/setup, `tests/e2e/lms-materials-db.spec.ts`.

2. High - The e2e auth bypass is properly fenced for non-production, but the DB-backed browser slice must keep that fence explicit and non-reusable for live/preview acceptance. Evidence: `/api/e2e/login` returns 404 when `NODE_ENV === 'production'` or `E2E_AUTH_BYPASS !== '1'` at `apps/web/src/app/api/e2e/login/route.ts:5`-`apps/web/src/app/api/e2e/login/route.ts:8`; it sets a non-secure local session cookie only after `verifyLogin()` succeeds at `apps/web/src/app/api/e2e/login/route.ts:13`-`apps/web/src/app/api/e2e/login/route.ts:24`; e2e helpers authenticate only through that endpoint at `tests/e2e/helpers/auth.ts:5`-`tests/e2e/helpers/auth.ts:17`. Recommendation: DB-backed browser acceptance may use `E2E_AUTH_BYPASS=1` only with `APP_ENV=development|test`, a local `localhost` base URL, and a throwaway DB. Add one negative test/static guard proving the endpoint stays 404 in production-mode configuration, and do not use it for raw-IP preview or production acceptance. Target part: e2e auth route guard, DB-backed Playwright project.

3. High - File upload size is enforced after reading the whole browser `File` into memory, so oversized uploads can consume memory before `LMS_MAX_FILE_BYTES` rejects them. Evidence: the action checks only missing/zero-size files before `arrayBuffer()` at `apps/web/src/features/lms/actions.ts:122`-`apps/web/src/features/lms/actions.ts:128`; the 5 MB limit lives in `normalizeLmsFileUpload()` after bytes are already loaded at `packages/lms/src/materials.ts:101`-`packages/lms/src/materials.ts:113`; tests cover oversize rejection at the pure package boundary at `packages/lms/src/materials.test.ts:26`-`packages/lms/src/materials.test.ts:29`, not the server-action preflight. Recommendation: before DB-backed browser acceptance, add server-action preflight `file.size > LMS_MAX_FILE_BYTES` before `arrayBuffer()`, keep the pure byte-size check as defense in depth, and add an action/static test that the action never reads oversized file bytes. Target part: `apps/web/src/features/lms/actions.ts`, LMS upload tests.

4. High - Local DB byte storage is enabled whenever `DATABASE_URL` exists; there is no explicit LMS storage-mode fence that prevents `db-local` upload storage from being mistaken for staging/production readiness. Evidence: `getServerDb()` returns the real DB when `DATABASE_URL` is set and fails closed only when production lacks it at `apps/web/src/lib/backend.ts:37`-`apps/web/src/lib/backend.ts:47`; `createMaterialAction()` accepts `kind='file'` and persists a prepared DB-local file when a DB exists at `apps/web/src/features/lms/actions.ts:344`-`apps/web/src/features/lms/actions.ts:381`; schema stores `file_bytes_base64`, `storage_provider`, `storage_key`, scan state, retention, and delete state at `packages/db/src/schema.ts:248`-`packages/db/src/schema.ts:296`; the production blocker still says object storage, a real malware engine, DB-backed browser acceptance, and public upload rollout remain open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. Recommendation: the DB-backed browser slice should force `APP_ENV=development|test` and explicitly label storage as `db-local`; before any staging/production upload enablement, add typed config such as `LMS_FILE_STORAGE_MODE` and reject `db-local` for new uploads in real deployments. Target part: config/env, LMS action guard, deployment docs.

5. Medium - Download success audit is redacted, but denied/not-found/not-configured download attempts are not audited. Evidence: the handler returns 401, 403, 503, and 404 before `recordMaterialDownloadAudit()` at `apps/web/src/features/lms/material-download.ts:43`-`apps/web/src/features/lms/material-download.ts:61`; the success audit excludes file bytes and storage key at `packages/db/src/repositories.ts:833`-`packages/db/src/repositories.ts:851`; the integration test asserts one success audit omits base64/raw content at `tests/integration/lms-material-download-handler.test.ts:76`-`tests/integration/lms-material-download-handler.test.ts:89`, but denial tests only assert status codes at `tests/integration/lms-material-download-handler.test.ts:91`-`tests/integration/lms-material-download-handler.test.ts:100`. Recommendation: add redacted failure audit coverage for authenticated denied/not-found/quarantined/deleted cases with categorical reasons only, no raw bytes, no storage key, no signed URL, no request body, and no stack trace. Target part: LMS download handler, audit action payload tests.

6. Medium - Sanitized iframe embeds are allowed in LMS code, but CSP still has no explicit `frame-src` allowlist, so browser acceptance can either fail embeds or drift into over-broad CSP later. Evidence: sanitizer allowlist permits YouTube/Vimeo hosts at `packages/lms/src/materials.ts:45`-`packages/lms/src/materials.ts:49`; student rendering uses `SafeEmbedFrame` for lesson/material embeds at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:106`-`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:109` and `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:157`; the CSP builder includes `object-src 'none'` and `frame-ancestors 'none'` but no `frame-src` at `packages/auth/src/security-headers.ts:51`-`packages/auth/src/security-headers.ts:58`; tests assert the existing directives but not embed-provider frame policy at `packages/auth/src/security-headers.test.ts:63`-`packages/auth/src/security-headers.test.ts:82`. Recommendation: add explicit `frame-src` for the same sanitizer-approved hosts and tests that sanitizer host list and CSP host list stay synchronized before DB-backed browser acceptance covers embeds. Target part: `@wtc/auth/security-headers`, LMS embed browser acceptance.

7. Medium - No public storage-key leak was observed in current UI/audit paths, but the no-leak invariant is not fully locked for the browser slice. Evidence: file material views expose a server download route only when scan status is clean and do not include `storageKey` at `apps/web/src/features/lms/queries.ts:64`-`apps/web/src/features/lms/queries.ts:80`; material upload audit records `hasStorageKey` rather than the key at `packages/db/src/repositories.ts:711`-`packages/db/src/repositories.ts:725`; download audit records storage provider and clean metadata, not `storageKey` or `fileBytesBase64`, at `packages/db/src/repositories.ts:833`-`packages/db/src/repositories.ts:851`; docs require `file_key` never be returned in API responses at `docs/EDUCATION_LMS_PLAN.md:308`-`docs/EDUCATION_LMS_PLAN.md:309`. Recommendation: DB-backed browser acceptance should assert the rendered teacher/student pages, route responses, screenshots, and audit rows do not contain `storage_key`, `storageKey`, `file_key`, signed URLs, or `fileBytesBase64`. Add a static guard for future object-storage paths. Target part: LMS query mappers, route tests, Playwright screenshot/audit checks.

8. Medium - Documentation still mixes target object-storage/signed-URL design with current DB-local implementation, which can block a clean acceptance verdict. Evidence: `docs/EDUCATION_LMS_PLAN.md:294` and `docs/EDUCATION_LMS_PLAN.md:308`-`docs/EDUCATION_LMS_PLAN.md:309` describe object-store `file_key` and signed URL redirects; current data-model reconciliation states the live schema stores local bytes plus lifecycle columns and downloads fail closed only for active, published, hash-valid, clean DB-local rows at `docs/DATA_MODEL.md:852`-`docs/DATA_MODEL.md:857`; production blockers clarify object storage, real malware scanner, DB-backed browser acceptance, and public rollout remain open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`. Recommendation: before closing the browser slice, update acceptance docs to separate "DB-local browser acceptance" from "production object storage/scanner readiness", and list object-store, signed URL, public upload rollout, and live-service checks as NOT RUN unless actually executed. Target part: `docs/EDUCATION_LMS_PLAN.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, next aggregate handoff.

## Decisions
- Treat the current LMS upload/download path as a local DB-backed acceptance path, not production upload readiness.
- Keep `file_bytes_base64` acceptable only for bounded local acceptance; do not call it object storage or signed URL readiness.
- Keep all DB-backed browser acceptance local-only: no live services, no live endpoints, no psql/manual DB mutation in the audit lane, no production preview reuse, and no live bot/TradingView/Axioma/Stripe contact.
- Preserve the existing fail-closed download order: require session, require education entitlement, require DB configured, require a published course/lesson, require `kind='file'`, require `scan_status='clean'`, require `deleted_at IS NULL`, and require hash/size integrity before bytes stream.
- Preserve audit minimization: audit metadata only; never audit raw bytes, base64 payloads, storage keys, signed URLs, raw request bodies, exception messages, or stack traces.
- The e2e auth bypass is acceptable only as a local Playwright helper while it remains 404 outside `E2E_AUTH_BYPASS=1` and always disabled in production.

## Risks
- A DB-backed browser test that simply adds `DATABASE_URL` to the existing default e2e project could be mistaken for full production readiness while still using DB-local bytes, dev auth bypass, mock adapters, and no object storage/scanner credentials.
- Oversized browser uploads can still allocate memory before pure validation rejects them.
- Download probing and entitlement-denied attempts remain less visible than successful downloads until failure audits exist.
- Sanitized embed acceptance can fail or invite CSP broadening unless `frame-src` is explicitly aligned with sanitizer hosts.
- Docs drift around object storage versus DB-local storage can produce false "done" claims.

## Verification/tests
RUN:
- Read-only source and docs inspection with targeted `rg`, `Get-Content`, `Select-String`, and `Test-Path`.
- Confirmed `docs/handoffs/20260601-2350-ecosystem-security-auditor.md` did not exist before writing.
- Checked `git status --short`; current cwd is not a Git repository, so no git-backed changed-file proof is available.

NOT RUN:
- `npm test`, focused Vitest, `npm run governance:check`, `npm run check:core`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run secret:scan`, `npm run db:generate -w @wtc/db`, `npm run build -w @wtc/web`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e`. Reason: read-only audit with no product-code edits; gate runs can write logs/generated artifacts and Playwright starts a server.
- Playwright/e2e, `npm run dev`, `npm run preview:safe`, local app server, worker smoke, DB migrations, DB seed, psql, and any database mutation. Reason: explicitly forbidden.
- Real object storage, production malware scanner, signed-object URLs, live Stripe, live Axioma, live TradingView, live bot/exchange, SSH, tmux, systemd, preview-worker, raw-IP preview, and production endpoints. Reason: explicitly forbidden or out of scope.

## Next actions
1. Add a separate local DB-backed Playwright acceptance project/spec for teacher file upload, teacher scan/status display, student clean-file download headers/bytes, entitlement-denied download, sanitized embed render, and no storage-key/base64 leak in UI/screenshots/responses/audit.
2. Add upload preflight in `createMaterialAction()` so files larger than `LMS_MAX_FILE_BYTES` are rejected before `arrayBuffer()`.
3. Add a local-only LMS storage-mode fence for DB-backed acceptance and a production/staging rule that rejects `db-local` new uploads until object storage and a real scanner are implemented.
4. Add failure audit events for authenticated LMS download denials/not-found/quarantined/deleted cases with categorical reasons only.
5. Add explicit CSP `frame-src` allowlist matching the LMS sanitizer's YouTube/Vimeo hosts, plus tests keeping sanitizer and CSP in sync.
6. Reconcile docs so DB-local browser acceptance, object-storage readiness, scanner readiness, signed URL readiness, and public rollout are separate gates with exact RUN/NOT RUN evidence.
