# ecosystem-backend-implementer handoff
## Scope
Phase 3.38 read-only backend/package audit for a live external scanner preflight script and deterministic local contract tests. Scope covered the current web-owned scanner implementation, `@wtc/lms` material scanner primitives, config validation, root/package scripts, local integration coverage, generated-artifact scanner rules, and the Phase 3.37 live object-store preflight pattern. No product code edits were allowed.
## Files inspected
- `apps/web/src/features/lms/material-storage.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/index.ts`
- `packages/lms/package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/config/package.json`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/gates.mjs`
- `package.json`
- `docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`
- `docs/handoffs/20260602-0634-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md`
## Files changed
- `docs/handoffs/20260602-0659-ecosystem-backend-implementer.md`
## Findings
1. Severity: High. Evidence: `apps/web/src/features/lms/material-storage.ts:38`, `apps/web/src/features/lms/material-storage.ts:78`, `apps/web/src/features/lms/material-storage.ts:84`, `apps/web/src/features/lms/material-storage.ts:100`, `apps/web/src/features/lms/material-storage.ts:114`, and `apps/web/src/features/lms/material-storage.ts:124` define the external scanner config, mode selection, response parsing, timeout, and fetch client inside the web feature file, while `packages/lms/src/materials.ts:115` only owns the local-signature scanner. Recommendation: move the reusable scanner contract into `@wtc/lms`, for example `packages/lms/src/scanner.ts`, exporting a lean `readLmsExternalScannerConfig`, `buildLmsExternalScannerRequest`, `parseLmsExternalScannerResponse`, and `scanLmsFileWithExternalService` surface. Keep web upload orchestration in the app, but make protocol validation and verdict parsing package-owned. Target part: backend/package boundary.
2. Severity: High. Evidence: `packages/config/src/env.ts:69`-`packages/config/src/env.ts:72` type the scanner env keys, `packages/config/src/env.ts:122`-`packages/config/src/env.ts:132` require endpoint/token and an HTTPS URL without credentials/query/fragment in external mode, and `packages/config/src/env.ts:141`-`packages/config/src/env.ts:142` require external scanning before public production uploads. There is no separate live-scanner acceptance command or live-run consent guard in `package.json:30`, which currently only exposes `accept:lms:object-storage`. Recommendation: add an opt-in root script such as `accept:lms:scanner` pointing at a new scanner preflight script, and have that script fail unless scanner mode is external, endpoint/token parse through the shared package helper, public uploads remain disabled, and explicit live scanner consent plus safe-corpus confirmation are present. Target part: live scanner preflight command safety.
3. Severity: High. Evidence: current deterministic scanner behavior is covered through web storage integration tests, not a package contract: `tests/integration/lms-material-storage.test.ts:239` checks scanner-before-object-storage and no filename/hash in the scanner envelope, `tests/integration/lms-material-storage.test.ts:284` checks normalized quarantine reason persistence, and `tests/integration/lms-material-storage.test.ts:339` checks non-2xx, malformed, and timeout failures. Recommendation: add package-level contract tests around the new `@wtc/lms` scanner module that use injected/mock fetch and fixed clocks/timeouts, assert exact method, headers, byte body forwarding, clean/quarantined verdict parsing, reason normalization, malformed response failure, non-2xx failure, network failure, and abort timeout behavior without requiring object storage or DB setup. Target part: deterministic local contract tests.
4. Severity: High. Evidence: `scripts/lms-s3-r2-live-preflight.mjs:13`-`scripts/lms-s3-r2-live-preflight.mjs:24` is dry-run-first and explicit-live, `scripts/lms-s3-r2-live-preflight.mjs:62`-`scripts/lms-s3-r2-live-preflight.mjs:65` requires live and throwaway confirmation, `scripts/lms-s3-r2-live-preflight.mjs:78`-`scripts/lms-s3-r2-live-preflight.mjs:86` builds a redacted summary base, and `tests/integration/lms-object-storage-live-preflight.test.ts:33`-`tests/integration/lms-object-storage-live-preflight.test.ts:37` proves the command stays out of default gates. Recommendation: mirror this shape for `scripts/lms-external-scanner-live-preflight.mjs`: default dry-run validates config and builds sanitized request plans without network I/O; live mode posts only an operator-approved safe corpus, records status classes, verdict counts, elapsed milliseconds, and sanitized reason labels, then exits nonzero for missing consent, unexpected verdicts, raw output risk, non-2xx, malformed JSON, or timeout. Target part: live scanner preflight semantics.
5. Severity: High. Evidence: generated-artifact rules reject scanner endpoint/token assignments at `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`scripts/scan-lms-db-e2e-artifacts.mjs:46`, auth material at `scripts/scan-lms-db-e2e-artifacts.mjs:60`-`scripts/scan-lms-db-e2e-artifacts.mjs:62`, and the integration test at `tests/integration/lms-db-e2e-artifact-scan.test.ts:66`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:69` asserts scanner env leakage fails the scan. Recommendation: scanner preflight stdout and summary files must not contain endpoint URLs, tokens, auth headers, request bodies, raw vendor response bodies, file names, hashes, or exact test payload markers. Evidence should stay count/status-only with corpus labels such as clean and quarantine-test. Target part: retained evidence and artifact no-leak policy.
6. Severity: Medium. Evidence: `package.json:11`-`package.json:33` centralizes root gate and acceptance scripts, and `scripts/gates.mjs:51`-`scripts/gates.mjs:65` defines `quick`, `core`, `full`, `build`, and `e2e` plans. The object-store live preflight has a static exclusion test at `tests/integration/lms-object-storage-live-preflight.test.ts:33`-`tests/integration/lms-object-storage-live-preflight.test.ts:37`. Recommendation: add the same static guard for the scanner script: root `package.json` has `accept:lms:scanner`, while `npm run e2e`, `npm run ci:local`, and `scripts/gates.mjs` do not reference the scanner preflight. Target part: gate honesty and default no-live-mutation safety.
7. Severity: Medium. Evidence: `packages/lms/src/index.ts:12`-`packages/lms/src/index.ts:13` already re-exports `materials.ts` and `object-storage.ts`, while `packages/lms/package.json` exposes the package root only. Recommendation: once a scanner module exists, export it through `packages/lms/src/index.ts` so web code, the preflight script, and package tests share one protocol implementation. Keep `@wtc/config` as full app boot validation; do not force the preflight through `loadEnv()` if the script only needs scanner-specific env, because `loadEnv()` also requires unrelated application secrets and database settings. Target part: package API design.
8. Severity: Medium. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:5` defines default generated-artifact roots, `scripts/scan-lms-db-e2e-artifacts.mjs:70`-`scripts/scan-lms-db-e2e-artifacts.mjs:89` supports dynamic marker manifests, and `scripts/run-lms-db-e2e.mjs:77` and `scripts/run-lms-db-e2e.mjs:89` run the artifact scan before exit. Recommendation: scanner preflight summaries should either live under their own log root and be scanned explicitly after live runs, or the artifact scanner should gain a scanner-preflight log root. If live output includes dynamic vendor labels, add them through the existing dynamic-marker mechanism or keep them out of retained artifacts. Target part: scanner artifact retention.
## Decisions
- Keep the current Phase 3.30 fail-closed external scanner behavior as the runtime baseline; do not claim live scanner acceptance from mocked fetch tests.
- Move scanner protocol helpers into `@wtc/lms` before adding a live scanner preflight, so local contract tests and live script use the same implementation.
- Add the live scanner preflight as an explicit operator acceptance command, not part of default gates, CI, default Playwright, or `node scripts/gates.mjs full`.
- Use dry-run by default and require explicit live consent plus safe-corpus confirmation before any network POST to an external scanner.
- Retain only redacted count/status evidence. Do not store endpoint URLs, tokens, auth headers, request bodies, raw scanner responses, filenames, hashes, or exact payload markers.
## Risks
- The scanner protocol currently lives in a web feature file, so a future live preflight would either duplicate logic or import app code unless the package boundary is corrected first.
- Current tests prove mocked external-scanner behavior in the upload path, but they do not prove a standalone scanner contract module or any live scanner endpoint behavior.
- Live scanner providers may return vendor-specific reason strings, latency patterns, or JSON shapes; the preflight must fail closed while preserving only sanitized labels.
- A live preflight can leak scanner secrets or test payload markers if stdout, summary JSON, traces, or debug logs include raw request or response details.
- This workspace is not git-backed from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so change detection must be done by explicit path inspection rather than git status.
## Verification/tests
- Not run; this was a read-only audit and handoff creation only.
- Recommended focused tests after implementation:
  - `npm test -- packages/lms/src/materials.test.ts packages/config/src/env.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-object-storage-live-preflight.test.ts`
  - Add and include new package scanner contract tests, for example `packages/lms/src/scanner.test.ts`.
  - Add and include a new scanner-preflight integration/static test, for example `tests/integration/lms-external-scanner-live-preflight.test.ts`.
- Recommended script checks after implementation:
  - `node --check scripts/lms-external-scanner-live-preflight.mjs`
  - `node scripts/lms-external-scanner-live-preflight.mjs --dry-run` with safe fixture env and no network I/O
  - `node scripts/scan-lms-db-e2e-artifacts.mjs <scanner-preflight-log-root>` after dry-run/live evidence is generated
- Live acceptance command should remain NOT RUN unless the operator supplies an approved scanner endpoint/token and confirms the safe corpus. Only then run the explicit scanner acceptance script and report the exact gates run/not run.
## Next actions
1. Add `packages/lms/src/scanner.ts` plus package tests for deterministic external scanner request/response/failure semantics.
2. Refactor `apps/web/src/features/lms/material-storage.ts` to call the package scanner helpers without changing upload ordering or fail-closed behavior.
3. Add `scripts/lms-external-scanner-live-preflight.mjs` and `accept:lms:scanner`, dry-run by default and live only with explicit consent.
4. Add static/integration tests proving the scanner preflight is opt-in, redacted, scanner-artifact-safe, and excluded from default gates.
5. Run focused tests, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, secret scan, governance, and artifact scan before claiming Phase 3.38 implementation green.
