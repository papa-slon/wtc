# bot-admin-health-tests-security-auditor handoff
## Scope
Read-only Phase 4.14 audit of tests and safety gates for admin bot health/readState consumption. Focus: stale+status ok, malformed/unreachable detail, >50 newer non-bot health rows, health-detail secret redaction, and absence of live bot start/stop/apply-config in admin bot views.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/worker/src/jobs.ts
- packages/db/src/repositories.ts
- packages/db/src/schema.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-health-detail.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- tests/e2e/smoke.spec.ts
- tests/e2e/warning-summary-visual.spec.ts

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence apps/worker/src/jobs.ts:134 and apps/web/src/app/admin/bots/page.tsx:18 and tests/integration/admin-bot-health-loader.test.ts:263 - recommendation: add an admin loader regression for `status='ok'` plus `detail.readState='stale'` - target part: admin bot health loader and `/admin/bots` read-state pill.
2. Severity P1 - evidence apps/web/src/features/admin/bot-health-loader.ts:363 and apps/web/src/features/admin/bot-health-loader.ts:390 - recommendation: add a regression where >50 newer non-bot rows cannot hide older bot rows - target part: `loadAdminBotHealthFromDb` health-row query.
3. Severity P2 - evidence tests/integration/worker-health-mapping.test.ts:19 and apps/web/src/app/admin/bots/page.tsx:22 - recommendation: add admin DTO/detail tests for `status='down', readState='unreachable'` and `status='error', readState='malformed'` with hostile token-shaped strings - target part: admin bot health DTO and rendered detail copy.
4. Severity P3 - evidence tests/e2e/admin-mobile-pg8.spec.ts:52 and tests/e2e/admin-user-bot-detail-db.spec.ts:136 - recommendation: extend `/admin/bots` rendered coverage to assert the fleet page keeps read-only evidence visible and no live-control affordances are present - target part: admin fleet rendered safety gate.

## Decisions
- No finding against the sanitizer contract itself: `projectHealthDetail` redacts before allowlisting, allows only scalar/array keys, and drops raw `warningCodes`.
- Read-only only; no edits, reverts, live server probes, DB mutations, or bot-control actions were performed by this agent.

## Risks
- Existing worktree was heavily dirty before inspection.
- No tests were run by this read-only agent; recommendations are source-derived.

## Verification/tests
RUN:
- `git status --short --branch`
- Read-only `rg` and line-numbered source inspection.

NOT RUN:
- `npm test`, integration suites, Playwright/E2E, DB-backed E2E, migrations, dev server, live worker/bot probes.

## Next actions
1. Add stale+`status='ok'` admin loader/render regression first.
2. Add >50 newer non-bot row starvation regression and then adjust loader query.
3. Add malformed/unreachable admin DTO tests with hostile detail strings.
4. Add rendered `/admin/bots` coverage for worker continuity/read-only safety.

