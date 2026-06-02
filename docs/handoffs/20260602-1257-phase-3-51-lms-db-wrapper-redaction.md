# LMS DB wrapper redaction handoff
## Scope
This handoff records the local safety hardening for LMS DB browser managed-runner output. The phase closed raw URL/password leak paths in CLI refusal and child/prep error paths without running the LMS DB browser acceptance gate, creating/dropping a database, or touching live services.

## Files changed
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-real-pg-harness-managed.mjs`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/real-pg-managed-runner-safety.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1257-*.md`

## Findings
1. High. Managed runner unknown-argument refusals no longer echo the unknown value, closing URL-shaped CLI leak paths in both LMS and real-PG managed wrappers. Target part: CLI refusal safety.
2. Medium. `scripts/run-lms-db-e2e.mjs` and `scripts/prepare-lms-db-e2e.ts` now redact raw Postgres URLs and `password=` fragments in catch paths. Target part: inherited child stderr.
3. Medium. `scripts/run-lms-db-e2e-managed.mjs` exports `safeMessage` behind a main guard, allowing a no-DB sanitizer canary test without starting the runner. Target part: testable redaction helper.
4. Medium. LMS managed-runner no-DB tests are split by failure mode and cover help, credential-present unknown args, URL-shaped unknown args, missing URL, invalid URL, throwaway admin URL, sanitizer redaction, and child/prep static redaction guards. Target part: regression coverage.
5. High. Actual LMS DB browser acceptance remains NOT RUN. These are no-DB safety checks only. Target part: acceptance claims.

## Decisions
The phase keeps help-first behavior consistent with existing preflight scripts. Operators should pass DB URLs through documented environment variables, not CLI arguments; the scripts now avoid echoing unexpected arg values anyway.

## Risks
`npm run <script> <secret-arg>` can still echo the command line before the script runs, depending on npm behavior. The supported path is environment-variable based and documented; URL-shaped positional args are invalid and should not be used as evidence commands.

## Verification/tests
RUN:
- `node --check scripts/run-lms-db-e2e-managed.mjs` PASS
- `node --check scripts/run-lms-db-e2e.mjs` PASS
- `node --check scripts/run-real-pg-harness-managed.mjs` PASS
- direct `node scripts/run-lms-db-e2e-managed.mjs <url-shaped-arg>` refusal PASS without raw value
- direct `node scripts/run-real-pg-harness-managed.mjs <url-shaped-arg>` refusal PASS without raw value
- `npm test -- tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/real-pg-managed-runner-safety.test.ts` PASS (`42` passed)
- `npm run governance:check` PASS (0 errors / 1 known historical warning; 3 cited per-agent handoffs all present)
- `npm run secret:scan` PASS
- `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift)
- `node scripts/gates.mjs full` PASS (9/9)

NOT RUN:
- `npm run e2e:lms:db`
- `npm run e2e:lms:db:managed`
- active managed real-PG proof
- production/preview append-only role proof
- production DB rollout/live deploy
- GitHub CI
- live server, live bot, Stripe, Axioma, LMS object-store/scanner, or production monitoring gates

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1257-ecosystem-security-auditor.md`](20260602-1257-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1257-ecosystem-tests-runner.md`](20260602-1257-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1257-ecosystem-devops-implementer.md`](20260602-1257-ecosystem-devops-implementer.md)

All current-phase agents were collected and closed before reporting.

## Next actions
1. Run `npm run e2e:lms:db:managed` only after `LMS_E2E_ADMIN_DATABASE_URL` is supplied for an operator-approved disposable target.
2. Run active managed real-PG and audit-role proofs when their credentials are available.
3. If credentials remain unavailable, the next local safety slice is raw preview URL hygiene.
