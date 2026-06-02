# ecosystem-education-implementer handoff
## Scope
Read-only Phase 3.30 LMS scanner audit for the external malware scanner adapter boundary after Phase 3.29. Covered upload sequencing, scan result mapping, DB material rows, config, tests, no-leak behavior, docs, and production/public-upload blockers.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/queries.ts`; `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`; `apps/web/instrumentation.ts`; `apps/web/src/lib/backend.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/lms/src/types.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `packages/audit/src/redact.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-ph3-1-static.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `.env.example`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/IMPLEMENTED_FILES.md`; `docs/EDUCATION_LMS_PLAN.md`.
## Files changed
None - read-only audit
## Findings
1. High - A first-cut external scanner runtime exists but is not production-accepted. Recommendation: treat it as adapter boundary only until focused runtime tests and live scanner acceptance exist. Target part: LMS upload scanner boundary.
2. High - Scanner failure has no durable material-row mapping even though the schema supports `failed`. Recommendation: explicitly define failure behavior. Target part: upload pipeline and material row lifecycle.
3. High - Quarantined external-scan results still flowed into object/local storage writes. Recommendation: choose and document quarantine storage policy before production. Target part: object-storage/quarantine lifecycle.
4. Medium - Runtime scanner endpoint/token config was not documented in `.env.example`. Target part: env and deployment docs.
5. Medium - External scanner reason text is sanitized but can still be persisted/audited. Recommendation: keep reasons as safe categorical codes and avoid raw reason text in audit. Target part: scanner parser and audit payload policy.
6. Medium - Focused storage tests needed external scanner runtime coverage. Target part: `tests/integration/lms-material-storage.test.ts`.
7. Medium - Public uploads can be locally configured with external scanner settings but live scanner acceptance remains NOT RUN. Target part: deployment gate and rollout.
8. Low - Shared `@wtc/lms` scanner helpers remain local-only and do not model external failed semantics. Target part: future shared scanner contract.
## Decisions
Treat scanner failures as no-row/no-storage failures for this phase, keep clean-row download guard, keep public uploads disabled, and keep live scanner/object-store/browser acceptance NOT RUN without credentials.
## Risks
Scanner outages disappear as upload no-ops unless a future UX/audit path is added. Quarantined objects need an explicit lifecycle policy. Vendor reason strings and bearer tokens must not leak through DB/audit/logs/artifacts. Mocked scanner tests do not prove live malware-engine behavior.
## Verification/tests
Read-only source inspection only. No tests, typechecks, gates, Playwright, DB commands, live scanner calls, live S3/R2 calls, or public-upload acceptance were run by this agent.
## Next actions
1. Define scanner clean/quarantined/failed behavior.
2. Add mocked external scanner runtime tests.
3. Decide quarantine object-storage policy.
4. Add scanner endpoint/token docs.
5. Keep public uploads NOT RUN until live scanner, live S3/R2, cleanup/reconciliation, DB browser, and artifact gates pass.
