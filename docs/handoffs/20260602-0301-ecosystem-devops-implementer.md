# ecosystem-devops-implementer handoff
## Scope
Phase 3.28 read-only backend/devops audit before edits for an LMS DB e2e dynamic marker manifest. Scope was runner/scanner implementation planning only: identify the safest manifest path, environment variable behavior, and cleanup policy for detecting per-run LMS material leak markers in DB-backed browser artifacts.

## Files inspected
- `AGENTS.md`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `playwright.lms-db.config.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `package.json`

## Files changed
None - read-only audit. This handoff was created at `docs/handoffs/20260602-0301-ecosystem-devops-implementer.md`.

## Findings
1. P1 - The scanner is currently static-only, so it cannot prove that suffix-bearing LMS markers from the DB browser run are absent from generated artifacts. Evidence: the spec creates per-run `suffix`, `fileName`, `fileText`, `quarantinedText`, and `fileSha256` values in `tests/e2e/lms-db-materials.spec.ts:96-108`; the scanner only has a static `FORBIDDEN` array in `scripts/scan-lms-db-e2e-artifacts.mjs:12-31` and chooses roots from CLI/defaults in `scripts/scan-lms-db-e2e-artifacts.mjs:79-85`. Recommendation: add a transient JSON manifest of dynamic markers and have the scanner append those values, plus base64 encodings, to its forbidden checks. Target part: scanner + DB e2e spec.
2. P1 - The safest manifest location is a sibling of the prepared DB marker under `.next-e2e-db`, not under default artifact roots. Evidence: the runner already owns `.next-e2e-db/lms-db-e2e-prepared.json` in `scripts/run-lms-db-e2e.mjs:6` and deletes it before/after the run in `scripts/run-lms-db-e2e.mjs:17` and `scripts/run-lms-db-e2e.mjs:90-94`; default scanner roots include `logs/lms-db-e2e` in `scripts/scan-lms-db-e2e-artifacts.mjs:5`, so putting the marker manifest there would cause the scanner to scan its own sensitive marker values. Recommendation: use `.next-e2e-db/lms-db-e2e-dynamic-markers.json` and exclude exactly that resolved file if custom roots include `.next-e2e-db`. Target part: runner + scanner.
3. P2 - Environment propagation should be runner-owned and optional outside the DB harness. Evidence: `scripts/run-lms-db-e2e.mjs:21-24` already creates guarded harness env values and `scripts/run-lms-db-e2e.mjs:71` runs the scanner from that env; standalone scanner use is currently supported by default roots and optional CLI roots in `scripts/scan-lms-db-e2e-artifacts.mjs:79-85`. Recommendation: set `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` only in `run-lms-db-e2e.mjs`; the scanner should require the manifest when that env var is set, but keep current static behavior when it is absent. Target part: runner + scanner.
4. P2 - Do not merge dynamic markers into the prepared DB marker. Evidence: Playwright config validates `.next-e2e-db/lms-db-e2e-prepared.json` before tests run in `playwright.lms-db.config.ts:13-24`, while the marker values only exist inside the spec after `info.project.name` and `Date.now()` are available in `tests/e2e/lms-db-materials.spec.ts:96-108`. Recommendation: keep the prepared DB marker for DB guard/HMAC only and create a separate dynamic marker manifest from the Playwright spec. Target part: Playwright spec + scanner.
5. P2 - Cleanup must be unconditional after scanner execution, including failure paths, and the managed runner should not grow separate cleanup logic. Evidence: the primary runner scans artifacts even after a Playwright failure in `scripts/run-lms-db-e2e.mjs:59-72` and always removes the prepared marker in `scripts/run-lms-db-e2e.mjs:90-94`; the managed runner delegates to `npm run e2e:lms:db` with only `LMS_E2E_DATABASE_URL` injected in `scripts/run-lms-db-e2e-managed.mjs:42-49` and handles only database drop in `scripts/run-lms-db-e2e-managed.mjs:80-81`. Recommendation: primary runner should remove stale dynamic manifests before prep and after scanner in `finally`; managed runner should continue delegating cleanup to the existing harness. Target part: runner cleanup.
6. P3 - Harness static tests should lock the new contract without requiring DB credentials. Evidence: current harness tests assert scanner static denylist entries in `tests/integration/lms-db-e2e-harness.test.ts:133-149` and assert DB e2e remains out of default gates in `tests/integration/lms-db-e2e-harness.test.ts:124-129`. Recommendation: add string-level assertions for `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, the `.next-e2e-db/lms-db-e2e-dynamic-markers.json` path, runner cleanup, scanner manifest loading, and no marker value logging. Target part: integration harness test.

## Decisions
- Recommended manifest path: `.next-e2e-db/lms-db-e2e-dynamic-markers.json`.
- Recommended env var: `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`.
- Recommended manifest schema: JSON object with `version: 1` and `markers: [{ "label": string, "value": string }]`.
- Recommended dynamic marker values: clean uploaded file body, quarantined uploaded file body, original uploaded filename, clean uploaded file SHA-256, and raw LMS iframe HTML. Do not include course/lesson/material titles that are intentionally visible UI text.
- Scanner should synthesize base64 checks for every dynamic `value`, report only marker labels, and never print marker values.
- Scanner should fail if `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` is set but missing, unreadable, invalid, or contains empty/oversized marker values; it should retain current static-only behavior when the env var is absent.
- Keep DB guard data in `.next-e2e-db/lms-db-e2e-prepared.json`; do not put dynamic browser leak markers in the prepared DB marker.
- Delete the dynamic marker manifest before each run and in the runner `finally` after the scanner attempt. Do not archive the manifest with `test-results`, `playwright-report`, screenshots, or logs.

## Risks
- If the manifest is placed under `logs/lms-db-e2e` or another default artifact root, the scanner will either fail on its own control file or require an unsafe broad exclusion.
- If the scanner treats the manifest as optional when the env var is set, a broken Playwright writer could produce a false green scan after a passing browser run.
- If scanner failure output includes marker values, the leak detector itself can disclose filenames, uploaded content markers, or hashes in logs.
- If dynamic marker checks are only added to Playwright assertions and not to the external scanner, screenshots, traces, HTML reports, and text logs remain weaker evidence.

## Verification/tests
- Gates run: none. Per instruction, this was read-only source inspection only.
- Gates not run: Vitest, typecheck, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, DB commands, servers, Playwright, migrations/seeds, and live services.
- No product code, tests, migrations, server processes, databases, browser runs, or live services were modified or executed.

## Next actions
1. In `scripts/run-lms-db-e2e.mjs`, define `.next-e2e-db/lms-db-e2e-dynamic-markers.json`, set `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, remove stale manifest before prep, and remove it in `finally` after scanner execution.
2. In `tests/e2e/lms-db-materials.spec.ts`, write the manifest immediately after dynamic values are created and before UI actions begin.
3. In `scripts/scan-lms-db-e2e-artifacts.mjs`, load the manifest only when `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` is set, add dynamic value/base64 forbidden checks, skip only the manifest file itself, and print labels only.
4. In `tests/integration/lms-db-e2e-harness.test.ts`, add static contract coverage for the env var, path, cleanup, scanner loading, and label-only failure behavior.
5. After implementation, run focused Vitest for the harness/scanner contract first, then the usual full/e2e/scanner/governance gates. Run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` only when throwaway Postgres credentials are available.
