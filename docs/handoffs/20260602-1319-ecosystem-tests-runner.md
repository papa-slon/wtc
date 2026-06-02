# ecosystem-tests-runner handoff
## Scope
Phase 3.52 read-only audit for tests around raw preview URL hygiene, retained artifact scanner coverage, and regression gaps.

## Files inspected
`package.json`, `vitest.config.ts`, `apps/web/next.config.ts`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, `tests/integration/audit-append-only-role-preflight.test.ts`, `scripts/billing-stripe-checkout-preflight.mjs`, `apps/web/src/features/billing/checkout.ts`, `packages/billing/src/stripe-checkout.ts`.

## Files changed
None - read-only audit.

## Findings
1. High. Raw preview IP was hardcoded as a dev origin and docs also published the raw preview URL. Recommendation: move dev origins to operator env and add static regression for active docs/config. Target part: artifact scanner and Next config guard.
2. High. Checkout request URL fields can be built from `APP_BASE_URL`, but scanner/tests did not forbid retained `success_url`/`cancel_url` or live app URL leakage. Recommendation: add scanner rules for raw redirect URL fields. Target part: checkout/preflight evidence.
3. Medium. Signed object URL tests were narrow. Recommendation: expand follow-up coverage for lower-case/encoded/base64 signed URL forms. Target part: artifact scanner suite.
4. Medium. Scanner lacked explicit admin DB URL/DSN assignment coverage for `REAL_POSTGRES_DATABASE_URL`, `LMS_E2E_ADMIN_DATABASE_URL`, `AUDIT_APPEND_ONLY_DATABASE_URL`, `DATABASE_DSN`, and `POSTGRES_DSN`. Recommendation: add generic DSN/admin URL rules and tests. Target part: artifact scanner forbidden markers.
5. Medium. Failure-output redaction tests covered DB URL value suppression but not all auth/header classes. Recommendation: add follow-up value-suppression tests for Authorization/Bearer/AWS/cookie classes. Target part: scanner confidentiality.
6. Medium. Scanner omitted `JOURNAL_READ_TOKEN` and generic token/API-key assignment coverage. Recommendation: add generic assignment rule with tests. Target part: scanner marker set.
7. Medium. Direct-node refusal tests can overstate npm script safety because npm may echo args before scripts redact. Recommendation: document that secret-bearing URLs must never be passed as CLI args and consider npm-path echo tests separately. Target part: preflight runner safety.

## Decisions
Source hardcoding and retained artifact leakage are separate risks: source/docs should use placeholders/env, while generated artifacts should fail closed.

## Risks
Generic scanner rules can false-positive if applied to source docs. Keep the generic rules scoped to generated artifacts and add static tests only for selected active docs/config.

## Verification/tests
No gates run by this auditor. Read-only inspection only.

## Next actions
1. Add raw-preview/live-URL hygiene scanner tests.
2. Extend scanner rules for raw preview URL, app URL fields, DB URL/DSN names, and generic token/API-key assignments.
3. Run focused Vitest after implementation, then full local gates if the phase closes.
