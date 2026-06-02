# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.29 audit for config/env and deployment boundary to enable an S3/R2-compatible LMS material storage provider without live credentials. Focused on fail-closed production config, required envs, no plaintext secrets in logs/responses, no fake integration claims, and required gates.
## Files inspected
`packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `.env.example`; `scripts/gates.mjs`; `scripts/run-lms-db-e2e.mjs`; `scripts/run-lms-db-e2e-managed.mjs`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `package.json`; `apps/web/package.json`; `apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `packages/lms/src/materials.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `docs/DEPLOYMENT.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
## Files changed
None - read-only audit
## Findings
1. High - Typed config cannot select a production object-store adapter. Evidence: `packages/config/src/env.ts` allowed only `db-local` and `fs-local`; `packages/lms/src/materials.ts` exposed only those providers. Recommendation: add `s3-r2` and require object-store envs whenever selected. Target part: config schema and provider constants.
2. High - Public upload fencing needs a hard `s3-r2` credential fence to avoid fake readiness. Recommendation: require endpoint, bucket, region, access key id, secret access key, and production HTTPS endpoint; keep public production uploads blocked unless provider is `s3-r2` and scanner mode is external. Target part: config superRefine and env tests.
3. High - Runtime storage rejected object-store providers, so env alone would be fake integration. Recommendation: implement a real adapter path or leave provider unsupported. Target part: material storage adapter.
4. High - Signed object delivery needs a response-shape change. Recommendation: introduce bytes vs redirect delivery, audit only after successful resolution, return `302` with no-store/no-referrer, and keep signed URLs out of JSON/audit payloads. Target part: material download handler.
5. Medium - Config errors are value-redacted and should remain so. Recommendation: list invalid key names only, never endpoint query strings, keys, signed URLs, buckets, credentials, or request headers. Target part: config and adapter errors.
6. Medium - `.env.example` must add placeholders without real secret-shaped values. Target part: env template and deployment docs.
7. Medium - Gate orchestration is clear: full and e2e are separate, DB LMS/browser and live object-store acceptance are opt-in. Target part: verification plan and aggregate handoff.
## Decisions
Do not claim live S3/R2 acceptance without credentials and observed live run. Treat `s3-r2` as a private object-store boundary, keep public uploads disabled by default, and keep external malware scanning as a separate production requirement.
## Risks
Provider enum without adapter behavior would be fake integration. Signed redirects can leak through retained traces/logs. Credentials in fixtures/logs/tests would violate the no-plaintext-secrets rule. Object cleanup/reconciliation remains a separate lifecycle risk.
## Verification/tests
Read-only inspection only. No tests, gates, servers, DB commands, Playwright, live object-store calls, migrations, or deployment commands were run by this audit.
## Next actions
1. Add `s3-r2` provider constants and fail-closed config.
2. Update `.env.example` and deployment docs.
3. Implement S3/R2 adapter without logging request secrets or signed URLs.
4. Refactor download delivery.
5. Run focused tests, typechecks, full/e2e gates, scanner, and governance.
