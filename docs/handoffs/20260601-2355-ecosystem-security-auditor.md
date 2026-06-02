# ecosystem-security-auditor handoff
## Scope
Phase 3.19 read-only security audit for LMS DB browser acceptance negative coverage and no-leak/security assertions after Phase 3.18. Inspected CSP, embed sanitizer/rendering, upload policy, material download handler, e2e login fence, audit-log rendering, artifact/log leakage surfaces, and `tests/e2e/lms-db-materials.spec.ts`.

No product code was edited. No server, Playwright run, database, psql, migration, seed, live endpoint, Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview worker, object storage, or malware scanner was touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`
- `playwright.lms-db.config.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `packages/auth/src/security-headers.ts`
- `packages/auth/src/security-headers.test.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `logs/gates/summary.txt`
- `logs/gates/e2e.log`
- `logs/gates/test.log`
- `test-results/.last-run.json`
- `tests/e2e/screenshots/*` file listing

## Files changed
None - read-only audit

## Findings
1. Severity: High. The DB-backed browser negative coverage is present in source but remains unaccepted because the actual `npm run e2e:lms:db` gate has not been observed against a throwaway Postgres database. Evidence: `docs/STATUS.md:14-16` says the DB e2e command was not run; `tests/e2e/lms-db-materials.spec.ts:29-172` contains the unauthenticated, entitlement-denied, quarantined, embed, download, no-leak, and audit assertions; `logs/gates/e2e.log:11`, `logs/gates/e2e.log:37`, and `logs/gates/e2e.log:57-58` show the default e2e gate skipped the LMS DB spec. Recommendation: run `npm run e2e:lms:db` only with a fresh empty `wtc_test_lms_<timestamp>` URL, archive artifacts, then drop the DB. Target part: LMS DB browser acceptance.

2. Severity: Medium. Quarantined files are no-download, but they are not hidden from the student lesson surface. Evidence: `packages/db/src/repositories.ts:648-650` returns all non-deleted materials for a lesson; `apps/web/src/features/lms/queries.ts:64-80` maps file scan metadata into `MaterialView`; `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:149-157` renders material title/status and "download unavailable"; `tests/e2e/lms-db-materials.spec.ts:120-128` explicitly expects the quarantined material to be visible with no Download link. Recommendation: either filter quarantined/failed file materials out of student queries or record a product/security decision that visible quarantine status is intentional; if hidden is the target, add a DB/browser assertion that the blocked material title is absent. Target part: student LMS material visibility.

3. Severity: Medium. Sanitized iframe support is aligned at the pure-code level, but browser acceptance does not prove the full runtime security envelope. Evidence: `packages/lms/src/materials.ts:207-226` canonicalizes a single allowlisted iframe and strips unsafe attributes; `packages/auth/src/security-headers.ts:33-60` allows the same YouTube/Vimeo origins in `frame-src`; `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:14-22` renders parsed iframe props with `sandbox`, `referrerPolicy`, and `allow`; `tests/e2e/lms-db-materials.spec.ts:129-133` checks visibility, `src`, and no raw embed only. Recommendation: extend the DB browser spec to assert the document CSP contains the frame allowlist and that the rendered iframe has the expected `sandbox`, `referrerpolicy`, `loading`, and `allow` attributes. Target part: sanitized embed browser acceptance.

4. Severity: Medium. The e2e login bypass is fenced to non-production, opt-in, and local URL host, but it does not explicitly validate `Host`, `Forwarded`, or `X-Forwarded-Host` headers. Evidence: `apps/web/src/app/api/e2e/login/route.ts:5-10` checks `NODE_ENV`, `E2E_AUTH_BYPASS`, and `new URL(request.url).hostname`; `tests/e2e/helpers/auth.ts:3-9` sends the seeded demo password through this route for all browser tests. Recommendation: add defense-in-depth checks that forwarded host headers are absent or local, and add a static/handler test for spoofed forwarded host rejection. Target part: e2e auth bypass exposure.

5. Severity: Medium. The student material DTO carries metadata that the current page does not render, but future client-side use could widen the leak surface. Evidence: `packages/lms/src/types.ts:60-76` includes `contentSha256`, `storageProvider`, `quarantineReason`, `retainedUntil`, and `deletedAt`; `apps/web/src/features/lms/queries.ts:68-79` populates those fields for student material views; `tests/e2e/lms-db-materials.spec.ts:14-21` checks DOM HTML for file bytes/base64/storage-key strings but does not assert that these metadata fields are absent from any serialized RSC/network payload. Recommendation: create a narrower student material DTO that omits hash/storage/retention/quarantine internals unless a rendered field actually needs them, then add a response/body artifact scan in the DB e2e harness. Target part: no-leak data boundary.

6. Severity: Low. Upload policy has server-side and package-level controls, but DB browser acceptance does not exercise oversize or MIME-spoof browser negatives. Evidence: `apps/web/src/features/lms/actions.ts:122-128` preflights size before `arrayBuffer()` and delegates byte validation; `packages/lms/src/materials.ts:101-107` enforces MIME allowlist, non-empty/max size, and byte sniffing; `tests/integration/lms-ph3-1-static.test.ts:106-110` checks the source guard statically; `tests/e2e/lms-db-materials.spec.ts:96-105` covers clean, quarantined, and embed uploads but not oversize or mismatched file signatures. Recommendation: add one browser-level oversize upload and one MIME/signature mismatch assertion to the opt-in DB spec. Target part: LMS upload policy acceptance.

7. Severity: Low. Audit-log rendering is currently narrow and avoids payload leakage, but the DB browser spec only checks DOM content after navigation, not exported logs/traces/screenshots after the opt-in DB run. Evidence: `apps/web/src/app/admin/audit-log/page.tsx:26-34` renders only time, actor role, action, target prefix, and result; `packages/db/src/repositories.ts:833-850` writes download audit metadata without `fileBytesBase64` or `storageKey`; `tests/e2e/lms-db-materials.spec.ts:166-171` checks the admin DOM for action presence and material no-leak strings. Recommendation: after `npm run e2e:lms:db`, scan generated traces/screenshots/logs for uploaded bytes, base64, storage keys, demo passwords, and raw embed HTML before accepting the gate. Target part: audit-log/artifact no-leak verification.

## Decisions
- Treat Phase 3.19 as a single read-only `ecosystem-security-auditor` pass requested by the operator, not as an N-agent broad phase.
- Do not edit product code or docs other than this required per-agent handoff.
- Treat the current Phase 3.18 DB browser security coverage as source-present but not gate-accepted until the opt-in throwaway-DB Playwright run is observed green.
- Treat demo credentials (`wtc-demo-pass-123`) as test/demo material, not live secrets; still scan generated artifacts after DB e2e to prove they are not leaked into screenshots/traces/logs unexpectedly.

## Risks
- The strongest browser evidence remains missing until a fresh throwaway `LMS_E2E_DATABASE_URL` is provided and `npm run e2e:lms:db` is run.
- Student quarantine visibility may be a product decision or a security leak depending on the desired UX; the current code and spec choose visible/no-download, not hidden/no-download.
- The e2e login route is safe under the intended local dev harness, but accidental non-prod exposure with `E2E_AUTH_BYPASS=1` should be hardened defensively.
- DOM-only no-leak checks are weaker than response/trace/screenshot artifact scans.

## Verification/tests
RUN:
1. Static/source inspection of the files listed above.
2. `npm test -- tests/integration/lms-db-e2e-harness.test.ts` - PASS, 6 tests. This is a source-reading Vitest guard only; it did not start servers, Playwright, DB, psql, or live endpoints.
3. Text scan across `logs`, `test-results`, and `tests/e2e` for LMS byte/storage-key/secret markers. It found expected demo/test source strings, including `tests/e2e/helpers/auth.ts:3` and `packages/db/src/seed.ts:12`, and no accepted LMS DB run artifacts because the DB browser gate has not been run.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was provided, and the command would mutate a database.
2. Playwright, browser servers, Next dev/preview/production servers, DB setup/migration/seed, PGlite DB tests, `psql`, or live endpoints - forbidden by this read-only audit request.
3. Product code edits or documentation updates outside this handoff - forbidden by this read-only audit request.
4. Full gates such as `node scripts/gates.mjs full` or `node scripts/gates.mjs e2e` - outside scope for this read-only security audit and would not prove the opt-in DB browser gate.

## Next actions
1. Decide whether quarantined student materials must be hidden or may remain visible with no download. If hidden is required, filter student material queries and update the DB browser spec to assert absence.
2. Harden `/api/e2e/login` against forwarded-host exposure and add a spoofed-forwarded-host source/handler test.
3. Trim student material DTOs to rendered fields only, or add explicit serialization/artifact no-leak assertions that prove metadata is not exposed.
4. Extend `tests/e2e/lms-db-materials.spec.ts` with CSP/iframe attribute checks and oversize/MIME-spoof upload negatives.
5. Run `npm run e2e:lms:db` against a fresh empty `wtc_test_lms_<timestamp>` DB, then scan generated logs/traces/screenshots before accepting Phase 3.18/3.19 browser security coverage.
