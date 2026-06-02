# ecosystem-security-auditor handoff
## Scope
Read-only security audit for Phase 3.59: using an existing adjacent bot Postgres credential for the LMS DB managed browser acceptance gate without exposing plaintext secrets, touching live bot control, or retaining unsafe evidence.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `package.json`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `scripts/redacted-child-process.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- adjacent bot `.env` key names only; no values printed

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `scripts/run-lms-db-e2e-managed.mjs:9`, `scripts/run-lms-db-e2e-managed.mjs:23`, `scripts/run-lms-db-e2e-managed.mjs:103`, `docs/DEPLOYMENT.md:260`. Recommendation: use adjacent Postgres credentials only by mapping them to `LMS_E2E_ADMIN_DATABASE_URL` in-process, with a non-throwaway maintenance DB that can create/drop a disposable `wtc_test_lms_*` DB. Target part: credential admission.
2. Severity: High. Evidence: `AGENTS.md:76`, `docs/handoffs/0000-orchestrator-seed.md:20`, `docs/CONTRACTS/legacy-bot-adapter.md:376`. Recommendation: do not inspect or dump legacy bot DB data; the acceptance should create an isolated throwaway DB and retain only redacted/scanned evidence. Target part: live-bot and plaintext-secret boundary.
3. Severity: Medium. Evidence: `scripts/run-lms-db-e2e.mjs:29`, `playwright.lms-db.config.ts:48`. Recommendation: use the guarded runner, not direct Playwright, because it sets mock/no-live flags, prep-token markers, artifact scanning, and cleanup. Target part: acceptance runner safety.
4. Severity: Medium. Evidence: `scripts/redacted-child-process.mjs:6`, `scripts/scan-lms-db-e2e-artifacts.mjs:51`, `docs/DEPLOYMENT.md:321`. Recommendation: archive only scanner-clean text evidence and reviewed screenshots; no raw stdout/stderr, env dumps, traces, or full connection strings. Target part: retained evidence.

## Decisions
- Keep all credential values out of chat, docs, logs, fixtures, screenshots, and handoffs.
- Treat the adjacent credential as usable only for managed throwaway DB creation in this single phase.
- Keep all other live/credentialed gates out of scope.

## Risks
- An adjacent bot DB credential may be over-broad; a hard-kill could leave orphan `wtc_test_lms_*` databases.
- Scanner-clean text does not prove screenshot safety; retained images need a visual review manifest.
- This phase does not prove live object storage, live scanner, Stripe, Axioma, SSH, deploy, CI, or production monitoring.

## Verification/tests
RUN by this auditor: read-only file inspection and key-name-only credential suitability review; no secrets printed.

NOT RUN by this auditor: DB mutation, Playwright, provider calls, live bot control, SSH/nginx/systemd, deploy, CI.

## Next actions
Run only `npm run e2e:lms:db:managed` with an in-process `LMS_E2E_ADMIN_DATABASE_URL`, then confirm Playwright PASS, scanner PASS, visual review PASS for retained screenshots, and throwaway DB drop.

