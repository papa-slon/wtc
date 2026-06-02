# ecosystem-devops-implementer handoff
## Scope
Phase 3.38 read-only audit for deployment/operator UX around an opt-in live external scanner acceptance preflight command and docs. No product code edits.

## Files inspected
- .env.example
- package.json
- docs/DEPLOYMENT.md
- docs/PRODUCTION_BLOCKERS_CURRENT.md
- scripts/run-lms-db-e2e.mjs
- scripts/scan-lms-db-e2e-artifacts.mjs

## Files changed
- docs/handoffs/20260602-0659-ecosystem-devops-implementer.md

## Findings
1. High - No operator command is wired for live external scanner acceptance. Evidence: package.json:27-package.json:30 exposes demo e2e, LMS DB e2e, managed LMS DB e2e, and object-store preflight, but no scanner acceptance command; docs/PRODUCTION_BLOCKERS_CURRENT.md:16 still lists "Live external malware-scanner acceptance" as open. Recommendation: add a dedicated opt-in script such as `accept:lms:external-scanner` that can be honestly reported RUN/PASS/FAIL/NOT RUN. Target part: package scripts plus a devops-owned preflight script.
2. High - The env template has runtime external scanner config but no acceptance-only consent, throwaway-target, or preflight log controls. Evidence: .env.example:42-.env.example:46 defines `LMS_FILE_SCANNER_MODE`, endpoint, token, and timeout; .env.example:38-.env.example:41 has object-store-only live acceptance and log-root flags. Recommendation: add scanner-specific live consent and evidence controls, for example `LMS_FILE_SCANNER_LIVE_ACCEPTANCE`, `LMS_FILE_SCANNER_LIVE_THROWAWAY`, and `LMS_FILE_SCANNER_PREFLIGHT_LOG_ROOT`, kept commented and clearly marked as preflight-only. Target part: .env.example and scanner preflight.
3. Medium - Deployment docs describe the scanner runtime contract but do not give operators a scanner acceptance runbook. Evidence: docs/DEPLOYMENT.md:58-docs/DEPLOYMENT.md:63 defines the external scanner request/response contract; docs/DEPLOYMENT.md:87-docs/DEPLOYMENT.md:115 gives a full object-store preflight runbook and explicitly says it does not prove live scanner behavior; docs/DEPLOYMENT.md:83-docs/DEPLOYMENT.md:85 blocks public uploads until live external malware-scanner acceptance exists. Recommendation: add an "LMS external scanner live preflight" section with dry-run and live commands, consent flags, expected clean/quarantined/fail-closed cases, redacted artifact location, and scanner-artifact scan step. Target part: docs/DEPLOYMENT.md.
4. Medium - Artifact scanning can support scanner preflight evidence, but the default roots do not include a scanner preflight log path. Evidence: scripts/scan-lms-db-e2e-artifacts.mjs:45-scripts/scan-lms-db-e2e-artifacts.mjs:46 already deny scanner endpoint/token assignments; scripts/scan-lms-db-e2e-artifacts.mjs:130-scripts/scan-lms-db-e2e-artifacts.mjs:131 accepts explicit roots; scripts/scan-lms-db-e2e-artifacts.mjs:5 defaults to DB/browser and object-style artifact roots only. Recommendation: either document `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight` in the new runbook or add the scanner preflight log root to scanner defaults after the log root exists. Target part: scanner preflight evidence workflow.
5. Low - The DB e2e runner is correctly guarded for browser acceptance but should not be reused as the scanner acceptance entry point. Evidence: scripts/run-lms-db-e2e.mjs:9-scripts/run-lms-db-e2e.mjs:16 requires a fresh `LMS_E2E_DATABASE_URL`; scripts/run-lms-db-e2e.mjs:68-scripts/run-lms-db-e2e.mjs:78 only runs Playwright then the generated-artifact scanner. Recommendation: keep external scanner acceptance as a separate preflight command, then optionally reference it from the broader production upload checklist. Target part: devops command surface and docs.

## Decisions
- Kept this phase read-only except for the required handoff file.
- Treated live external scanner acceptance as a separate operator gate from object-store preflight and DB-backed browser acceptance, matching the current deployment docs.
- Did not run live commands or mutate any server, database, bucket, scanner endpoint, env file, or product code.

## Risks
- Without a dedicated command and runbook, an operator may hand-run scanner checks and accidentally archive endpoint URLs, bearer tokens, provider bodies, or raw request evidence.
- Runtime scanner envs alone could be mistaken for acceptance evidence even though the blocker remains NOT RUN until a guarded live preflight exits cleanly and its artifacts pass scanning.
- Public LMS uploads should remain disabled until live object-store, live external scanner, observed DB-browser acceptance, and artifact checks are all observed green in an operator-approved phase.

## Verification/tests
- Ran targeted text inspection across the requested files.
- Confirmed the package script list does not expose a live external scanner acceptance entry point.
- Confirmed the generated-artifact scanner already blocks scanner endpoint/token assignment leaks and supports explicit scan roots.
- Not run: `npm run ci:local`, `npm run e2e`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, `npm run accept:lms:object-storage`, or any live scanner acceptance. Reason: read-only audit scope and no operator-approved live credentials/endpoints.

## Next actions
1. Add a devops-owned `scripts/lms-external-scanner-live-preflight.mjs` with dry-run and live modes.
2. Wire `package.json` script `accept:lms:external-scanner` to that preflight.
3. Add commented scanner acceptance envs to `.env.example`, separate from normal runtime scanner envs.
4. Add a deployment runbook section mirroring the object-store preflight style, including NOT RUN/PASS/FAIL reporting rules.
5. Ensure preflight output writes only count/status summaries and run `scripts/scan-lms-db-e2e-artifacts.mjs` over the scanner preflight artifact root before evidence is archived.
