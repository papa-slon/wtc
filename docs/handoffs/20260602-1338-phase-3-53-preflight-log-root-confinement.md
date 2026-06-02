# Preflight log-root confinement handoff
## Scope
This handoff closes the local evidence-root confinement slice after raw preview URL hygiene. The phase did not run live acceptance, deploy, SSH, nginx, systemd, preview/prod DB mutation, live server checks, bot services, Stripe network, Axioma network, LMS scanner/object-store live calls, screenshot OCR, child-output redaction, GitHub CI, or production monitoring.

## Files inspected
`scripts/preflight-log-root.mjs`, `scripts/preflight-log-root.mjs.d.ts`, `scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`, `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, `scripts/axioma-handoff-preflight.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, five preflight integration suites, scanner integration tests, `.env.example`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`.

## Files changed
- `scripts/preflight-log-root.mjs`
- `scripts/preflight-log-root.mjs.d.ts`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/billing-stripe-checkout-preflight.mjs`
- `scripts/axioma-handoff-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/preflight-log-root.test.ts`
- `tests/integration/preflight-log-root-wiring.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `tests/integration/lms-external-scanner-live-preflight.test.ts`
- `tests/integration/billing-stripe-checkout-preflight.test.ts`
- `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`
- `tests/integration/axioma-handoff-preflight.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-1338-*.md`

## Findings
1. High. All five summary-writing preflight scripts now use `resolvePreflightLogRoot()` and `writePreflightSummary()`, refusing absolute, UNC, URL-shaped, parent-traversal, and non-`logs/` roots before summary writes. Target part: preflight evidence roots.
2. High. Preflight summary output now returns normalized relative paths like `logs/.../summary-<runId>.json`, not raw absolute paths. Target part: retained evidence path disclosure.
3. High. Artifact scanner explicit roots now reject URL-shaped, traversal, and off-workspace paths; explicit missing roots refuse instead of silently counting missing roots. Dynamic marker manifests are workspace-confined. Target part: scanner CLI/env boundary.
4. Medium. Five preflight test suites now use repo-local `logs/test-*` success roots and clean them after assertions. Target part: test policy alignment.
5. Medium. New helper and wiring tests cover hostile roots and no raw-root echo. Scanner tests cover unsafe explicit roots, missing explicit roots, and unsafe dynamic marker paths. Target part: regression coverage.
6. Low. `.env.example` and `docs/DEPLOYMENT.md` now state the `*_PREFLIGHT_LOG_ROOT` policy: relative repo-local `logs/...` only. Target part: operator runbooks.

## Decisions
This is local evidence hygiene, not live acceptance. `scripts/gates.mjs` remains unchanged because its log path is fixed and not env-controlled. Symlink-hard `realpath` confinement, screenshot OCR, and child-process output redaction remain separate possible phases.

## Risks
The helper uses lexical path confinement. Repo-local symlinks could still require a future realpath check if operator evidence roots become security-sensitive rather than hygiene-sensitive.

## Verification/tests
RUN:
- `node --check scripts/preflight-log-root.mjs` PASS
- `node --check scripts/lms-s3-r2-live-preflight.mjs` PASS
- `node --check scripts/lms-external-scanner-live-preflight.mjs` PASS
- `node --check scripts/billing-stripe-webhook-replay-preflight.mjs` PASS
- `node --check scripts/billing-stripe-checkout-preflight.mjs` PASS
- `node --check scripts/axioma-handoff-preflight.mjs` PASS
- `node --check scripts/scan-lms-db-e2e-artifacts.mjs` PASS
- `npm test -- tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts tests/integration/lms-object-storage-live-preflight.test.ts tests/integration/lms-external-scanner-live-preflight.test.ts tests/integration/billing-stripe-checkout-preflight.test.ts tests/integration/billing-stripe-webhook-replay-preflight.test.ts tests/integration/axioma-handoff-preflight.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` PASS (`55` passed)
- `npm run governance:check` PASS (0 errors / 1 known historical warning; 4 cited per-agent handoffs all present)
- `npm run secret:scan` PASS
- `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift)
- `npm run typecheck` PASS after adding the `.d.mts` declaration for the `.mjs` helper import
- `node scripts/gates.mjs full` PASS (9/9)

NOT RUN:
- live object-store/scanner preflights
- live Stripe/Axioma acceptance
- active LMS DB browser acceptance
- active managed real-PG proof
- production/preview append-only audit DB-role proof
- preview/prod DB migration or seed
- SSH, nginx, systemd, tmux, server process checks
- screenshot OCR/manual review gate
- child-process stdout/stderr redaction phase
- production deploy, GitHub CI, production monitoring

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1338-ecosystem-security-auditor.md`](20260602-1338-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1338-ecosystem-devops-implementer.md`](20260602-1338-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1338-ecosystem-tests-runner.md`](20260602-1338-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1338-ecosystem-platform-architect.md`](20260602-1338-ecosystem-platform-architect.md)

All current-phase agents were collected and closed before reporting.

## Next actions
1. If credentials are available, run the blocked operator acceptance gates: LMS DB managed, real-PG managed, or audit append-only role preflight.
2. If credentials remain unavailable, the next local evidence-safety slices are screenshot retention/OCR guardrail, child-process output redaction, or symlink-hard preflight root confinement if needed.
