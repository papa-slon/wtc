# phase-4-14-admin-health-consumption handoff
## Scope
Close the Phase 4.13 web/admin consumption gap: admin bot surfaces must read persisted worker/product health honestly, must not over-green stale/missing/bad readState, and must keep admin bot pages read-only. This phase did not enable live bot start/stop/apply-config, exchange/provider calls, worker ticks, deploy, SSH, tmux, or systemd.

Per-agent handoffs linked:
- [docs/handoffs/20260604-1243-bot-admin-health-loader-auditor.md](20260604-1243-bot-admin-health-loader-auditor.md)
- [docs/handoffs/20260604-1243-bot-admin-user-drilldown-health-auditor.md](20260604-1243-bot-admin-user-drilldown-health-auditor.md)
- [docs/handoffs/20260604-1243-bot-admin-health-tests-security-auditor.md](20260604-1243-bot-admin-health-tests-security-auditor.md)

All three background agents were closed before this aggregate handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-health-detail.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts

## Files changed
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-health-detail.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- docs/handoffs/20260604-1243-bot-admin-health-loader-auditor.md
- docs/handoffs/20260604-1243-bot-admin-user-drilldown-health-auditor.md
- docs/handoffs/20260604-1243-bot-admin-health-tests-security-auditor.md
- docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md

## Findings
1. Severity P1 - evidence apps/web/src/features/admin/bot-health-loader.ts:228 and apps/web/src/app/admin/bots/page.tsx:67 - recommendation: consume Phase 4.13 worker `botContinuityStatus` detail in admin - target part: fleet bot health. Implemented `workerBotContinuity` DTO, safe sanitizer allowlist, and `Worker bot continuity` card/evidence row.
2. Severity P1 - evidence apps/web/src/features/admin/bot-health-loader.ts:363 and tests/integration/admin-bot-health-loader.test.ts:341 - recommendation: stop global latest-50 starvation - target part: admin bot health query. Implemented SQL target-filtered recent bot rows plus latest expected rows for `tortila-journal` and `legacy-bot`.
3. Severity P1 - evidence apps/web/src/app/admin/bots/page.tsx:18 and tests/integration/admin-bot-health-loader.test.ts:299 - recommendation: prioritize readState over status/last-ok - target part: `/admin/bots` status derivation. Implemented readState-first pills for stale/unreachable/malformed/not_configured and gated owner/provider rows through runtime health.
4. Severity P1 - evidence apps/web/src/features/admin/user-bot-detail-loader.ts:950 and apps/web/src/app/admin/users/[userId]/bots/page.tsx:100 - recommendation: split scope evidence from health evidence - target part: selected-user admin bot drilldown. Implemented `runtimeHealth` DTO, latest-per-target query, freshness/state/note derivation, runtime card pill, and evidence/statistics gating.
5. Severity P2 - evidence apps/web/src/features/admin/health-detail.ts:4 and tests/integration/admin-health-detail.test.ts:47 - recommendation: keep newly exposed worker detail safe - target part: health detail sanitizer. Added safe worker/bot summary keys while retaining redaction, scalar/array filtering, and raw warningCode dropping.
6. Severity P2 - evidence tests/e2e/admin-mobile-pg8.spec.ts:52 - recommendation: rendered admin bot surface should keep worker continuity visible - target part: mobile admin acceptance. Added explicit E2E assertion for `Worker bot continuity`.

## Decisions
- No DB migration was added; all data comes from existing append-only `integration_health_checks`.
- No live probes run during admin render. Admin pages show persisted worker/product health rows only.
- `status='ok'` is not enough for green if sanitized `detail.readState` is stale/unreachable/malformed/not_configured.
- Provider mappings and WTC bot ownership remain scope evidence only, not runtime health evidence.
- Demo/local Browser redirected to `/login`; rendered admin verification was completed via the existing local-only Playwright admin login helper instead.

## Risks
- `accept:worker:continuity` was not run because it requires explicit throwaway `DATABASE_URL` and writes DB rows.
- The checkout remains heavily dirty from earlier phases; this handoff lists files touched in this phase, but git status contains many pre-existing changes and untracked phase artifacts.
- The in-app Browser plugin could open the local server but login form automation hit a browser runtime clipboard/selector limitation; Playwright E2E covered the rendered admin page.

## Verification/tests
RUN:
- `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASSED, 4 files, 21 tests.
- `npm run typecheck -w @wtc/web` - PASSED.
- `npx eslint apps/web/src/features/admin/types.ts apps/web/src/features/admin/health-detail.ts apps/web/src/features/admin/bot-health-loader.ts apps/web/src/features/admin/user-bot-detail-loader.ts apps/web/src/app/admin/bots/page.tsx apps/web/src/app/admin/users/[userId]/bots/page.tsx tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-user-bot-detail-static.test.ts --max-warnings 0` - PASSED.
- `npm run typecheck` - PASSED.
- `git diff --check` - PASSED.
- `npm run secret:scan` - PASSED.
- `npm run governance:check` - PASSED before adding this handoff, with 0 errors and 1 known historical warning.
- In-app Browser opened `http://localhost:3420/admin/bots` and confirmed redirect to `/login`; login automation could not complete due Browser runtime limitation.
- `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASSED after adding the `Worker bot continuity` assertion.
- `npx eslint tests/e2e/admin-mobile-pg8.spec.ts --max-warnings 0` - PASSED.

NOT RUN:
- `npm run accept:worker:continuity` - NOT RUN because it requires explicit throwaway `DATABASE_URL` and mutates worker health/snapshot rows.
- DB-managed admin user bot detail E2E - NOT RUN because no throwaway admin Postgres URL was provided for this phase.
- Full `npm test`, full Playwright suite, production build, deploy/SSH/tmux/systemd - NOT RUN due phase scope.
- Live bot start/stop/apply-config, exchange/provider calls, env/secret value reads - NOT RUN by safety policy.

## Next actions
1. Run `accept:worker:continuity` only with an explicit throwaway WTC DATABASE_URL and record the DB mutation target.
2. Add DB-managed admin-user bot detail E2E when a disposable admin Postgres URL is available, to prove selected-user runtimeHealth against real Postgres.
3. Consider adding `accept:worker:continuity` to a documented local acceptance gate after the throwaway DB contract is agreed.

