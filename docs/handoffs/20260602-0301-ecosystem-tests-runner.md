# ecosystem-tests-runner handoff
## Scope
Phase 3.28 read-only tests-runner audit before implementation edits. Scope was limited to focused tests for the LMS DB e2e dynamic marker manifest: scanner behavior, scanner tests, static harness tests, Playwright DB spec source, runner wiring, and broad gate recommendations.

No product code, tests, non-handoff docs, migrations, servers, DB commands, Playwright runs, or gates were executed or edited by this lane.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/gates.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `playwright.lms-db.config.ts`
- `package.json`

## Files changed
None - read-only audit, except this handoff.

## Findings
1. Severity: Medium. Evidence: current source already contains dynamic marker manifest scanner plumbing: `scripts/scan-lms-db-e2e-artifacts.mjs:50`-`77` loads and validates `LMS_DB_E2E_MARKER_MANIFEST`, includes each marker's raw and base64 value, and fails closed on bad shape; `scripts/scan-lms-db-e2e-artifacts.mjs:102`-`110` applies those dynamic markers to scanned text; `scripts/scan-lms-db-e2e-artifacts.mjs:115`-`122` rejects malformed manifests before scanning; `scripts/scan-lms-db-e2e-artifacts.mjs:169`-`172` reports dynamic marker count. Recommendation: implementation acceptance should preserve this fail-closed scanner contract and run the focused scanner/harness tests before broader gates. Target part: artifact scanner.
2. Severity: Medium. Evidence: the guarded LMS DB runner now creates a short-lived manifest outside artifact scan roots at `.next-e2e-db/lms-db-e2e-dynamic-markers.json`, initializes it, passes it as `LMS_DB_E2E_MARKER_MANIFEST`, and deletes it in `finally` (`scripts/run-lms-db-e2e.mjs:8`, `scripts/run-lms-db-e2e.mjs:20`-`30`, `scripts/run-lms-db-e2e.mjs:96`-`101`). Recommendation: keep the manifest outside `test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e` so the scanner can consume sensitive markers without flagging its own input. Target part: DB e2e runner.
3. Severity: Medium. Evidence: the Playwright DB spec appends exact per-run leak markers for clean body, quarantined body, uploaded filename, content hash, and raw embed HTML (`tests/e2e/lms-db-materials.spec.ts:62`-`74`, `tests/e2e/lms-db-materials.spec.ts:113`-`131`) while still asserting response/header/rendered-page no-leak behavior (`tests/e2e/lms-db-materials.spec.ts:217`-`243`, `tests/e2e/lms-db-materials.spec.ts:260`-`262`). Recommendation: after implementation, keep any newly retained signed URL, redirect URL, HAR, or network-trace marker values in the same manifest before archiving evidence. Target part: Playwright DB spec and future signed-delivery acceptance.
4. Severity: Medium. Evidence: scanner functional tests now cover dynamic marker rejection without printing matched values and malformed-manifest fail-closed behavior (`tests/integration/lms-db-e2e-artifact-scan.test.ts:66`-`95`); static harness tests pin runner env wiring, manifest filename, spec append helper, and scanner dynamic-marker strings (`tests/integration/lms-db-e2e-harness.test.ts:20`-`36`, `tests/integration/lms-db-e2e-harness.test.ts:84`-`96`, `tests/integration/lms-db-e2e-harness.test.ts:136`-`156`). Recommendation: focused validation should include both scanner functional and harness static tests. Target part: Vitest coverage.
5. Severity: Low. Evidence: `package.json:28`-`29` exposes opt-in DB browser commands, while the static harness confirms default gates do not include the DB browser gate (`tests/integration/lms-db-e2e-harness.test.ts:125`-`133`). `scripts/gates.mjs:43`-`52` keeps `e2e` separate from `full`. Recommendation: broad local gates after implementation should still run `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separately, then run the opt-in `npm run e2e:lms:db` or managed variant only when a fresh throwaway/admin DB URL is available. Target part: gate plan.

## Decisions
- Treat current dynamic marker manifest work as source-present but unaccepted until tests and gates are run in the implementation/operator phase.
- Do not recommend adding `e2e:lms:db` to default gates; it remains an explicit credentialed acceptance gate because it mutates a throwaway Postgres DB.
- Preserve the existing generated-artifact scanner policy: scan generated text paths, skip image bytes, and fail closed on trace/container archives unless a safe extraction/redaction path is added later.

## Risks
- Current docs still identify dynamic per-run marker scanning as open in `docs/STATUS.md:16` and `docs/NEXT_ACTIONS.md:10`-`11`; implementation acceptance should reconcile docs if this source state is kept.
- The actual DB-backed browser acceptance gate is still unobserved without `LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL`.
- Future signed redirects/object storage can introduce dynamic URL hosts, object keys, and query tokens that are not represented in the current five-marker Playwright manifest.
- `git status --short` still fails here because `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform` is not a git repository.

## Verification/tests
RUN:
- None. Read-only source inspection only, per instruction.

NOT RUN:
- Focused Vitest - not run by instruction.
- `npm run typecheck` - not run by instruction.
- `npm run typecheck -w @wtc/web` - not run by instruction.
- `node scripts/gates.mjs full` - not run by instruction.
- `node scripts/gates.mjs e2e` - not run by instruction.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - not run by instruction.
- `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` - not run by instruction and no DB URL supplied.
- Servers, DB commands, Playwright, migrations/seeds, live services - not run by instruction.

Recommended focused test command after implementation:
```powershell
npm test -- tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts
```

Recommended broad gates after implementation:
```powershell
npm run typecheck
npm run typecheck -w @wtc/web
node scripts/gates.mjs full
node scripts/gates.mjs e2e
node scripts/scan-lms-db-e2e-artifacts.mjs
npm run governance:check
```

Credentialed acceptance when a fresh throwaway/admin DB URL is available:
```powershell
npm run e2e:lms:db
npm run e2e:lms:db:managed
```

## Next actions
1. Implementation/operator phase: run the focused Vitest command above and fix any scanner/harness assertion gaps.
2. Reconcile current docs if the dynamic manifest source state is accepted.
3. Run broad gates, then write the aggregate Phase 3.28 handoff with exact RUN/NOT RUN gates.
4. Run the real DB browser acceptance gate only with a fresh throwaway `LMS_E2E_DATABASE_URL` or an operator-supplied `LMS_E2E_ADMIN_DATABASE_URL`.
