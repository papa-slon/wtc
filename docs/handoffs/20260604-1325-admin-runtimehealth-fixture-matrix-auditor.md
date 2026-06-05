# admin-runtimehealth-fixture-matrix-auditor handoff
## Scope
Read-only Phase 4.17 audit of the DB-backed selected-user admin bot detail E2E fixture path and the safest strategy for extending runtimeHealth browser coverage across fresh-green, stale, missing, and existing degraded states. The audit focused on avoiding false greens from latest same-target global health rows, deciding whether scenario-per-run env is safer than multiple users in one DB, and recommending exact fixture/spec/harness changes plus gates. No live bot start/stop/apply-config, exchange/provider call, raw env read, raw secret read, DB mutation, migration/seed command, server start, deploy, SSH, tmux, or systemd action was performed.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- scripts/prepare-admin-user-bot-detail-e2e.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- playwright.admin-user-bots-db.config.ts
- scripts/run-admin-user-bot-detail-e2e.mjs
- scripts/run-admin-user-bot-detail-e2e-managed.mjs
- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
- docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md
- docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md
- docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/health-detail.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/db/src/seed.ts

## Files changed
- docs/handoffs/20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md (this handoff only)

## Findings
1. Severity P1 - evidence `packages/db/src/schema.ts:443`, `packages/db/src/schema.ts:445`, `packages/db/src/schema.ts:448`, `packages/db/src/repositories.ts:1789`, `packages/db/src/repositories.ts:1790`, `apps/web/src/features/admin/user-bot-detail-loader.ts:950`, `apps/web/src/features/admin/user-bot-detail-loader.ts:959`, `apps/web/src/features/admin/user-bot-detail-loader.ts:960`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1072`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1104` - recommendation: do not model fresh/stale/missing/degraded runtimeHealth as multiple selected users in one DB; target part: DB E2E fixture strategy. `integration_health_checks` is global by `target`, `recordHealthCheck()` inserts only `target/status/detail`, and the loader takes the latest row per target before applying it to every selected-user bot card for that product.
2. Severity P1 - evidence `scripts/prepare-admin-user-bot-detail-e2e.ts:389`, `scripts/prepare-admin-user-bot-detail-e2e.ts:392`, `scripts/prepare-admin-user-bot-detail-e2e.ts:397`, `scripts/prepare-admin-user-bot-detail-e2e.ts:400`, `apps/web/src/features/admin/user-bot-detail-loader.ts:275`, `apps/web/src/features/admin/user-bot-detail-loader.ts:286`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:107`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:122`, `tests/e2e/admin-user-bot-detail-db.spec.ts:135`, `tests/e2e/admin-user-bot-detail-db.spec.ts:139` - recommendation: preserve the current fixture as the existing degraded-readable scenario, not as fresh-green proof; target part: existing DB E2E scenario. The fixture writes `status: degraded` plus `readState: ok`, so rendered labels show `runtime: ... ok` while the runtime state remains attention and statistics correctly show `evidence stale or gated`.
3. Severity P1 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:950`, `apps/web/src/features/admin/user-bot-detail-loader.ts:959`, `apps/web/src/features/admin/user-bot-detail-loader.ts:960`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:54`, `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md:70` - recommendation: use scenario-per-run env with one fresh throwaway DB per scenario; target part: managed runner and acceptance plan. A newer same-target `ok` row will hide a stale row, and any same-target row makes a missing scenario non-missing. Separate users in the same DB cannot isolate these states under the current global health model.
4. Severity P2 - evidence `tests/integration/admin-user-bot-detail-loader.test.ts:640`, `tests/integration/admin-user-bot-detail-loader.test.ts:648`, `tests/integration/admin-user-bot-detail-loader.test.ts:653`, `tests/integration/admin-user-bot-detail-loader.test.ts:675`, `tests/integration/admin-user-bot-detail-loader.test.ts:693`, `tests/integration/admin-user-bot-detail-loader.test.ts:703`, `apps/web/src/features/admin/health-detail.ts:4`, `apps/web/src/features/admin/health-detail.ts:32`, `apps/web/src/features/admin/health-detail.ts:67` - recommendation: keep loader/static stale and missing tests, but add browser-level scenario assertions with unique safe detail text; target part: spec expectations. Loader tests already prove stale and missing DTO behavior, but the opt-in browser fixture needs exact visible text per scenario and continued redaction canaries.
5. Severity P2 - evidence `scripts/run-admin-user-bot-detail-e2e.mjs:25`, `scripts/run-admin-user-bot-detail-e2e.mjs:34`, `scripts/run-admin-user-bot-detail-e2e.mjs:35`, `playwright.admin-user-bots-db.config.ts:14`, `playwright.admin-user-bots-db.config.ts:20`, `playwright.admin-user-bots-db.config.ts:23`, `playwright.admin-user-bots-db.config.ts:29`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:51`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:64`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:104`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:114` - recommendation: extend the existing guarded runner pattern rather than adding an unguarded Playwright path; target part: harness safety. The current runner already forces mock/no-live-control env, requires a throwaway DB and HMAC marker, and the managed runner creates/drops a fresh DB. The matrix should reuse that shape.

## Decisions
- Recommend scenario-per-run env as the safest strategy: `ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO` or similar, with allowed values `fresh-green`, `stale`, `missing`, and `degraded-readable`.
- Recommend one fresh DB per scenario, especially in the managed runner. Do not try to represent these four states as four users in one DB while runtime health remains target-global.
- Keep the current degraded fixture as `degraded-readable`; add new fresh/stale/missing scenarios without changing app runtime behavior.
- Do not change the schema or loader just for the E2E matrix. If WTC later needs user/provider-scoped runtime health, that is a separate product/data-model phase.
- Keep the direct runner as a one-scenario harness for an explicit fresh `ADMIN_USER_BOTS_E2E_DATABASE_URL`; add a managed matrix mode/script that loops scenarios sequentially and creates/drops one `wtc_test_admin_user_bots_<scenario>_*` database per scenario.

## Risks
- Multiple users in one DB will false-green stale and missing states because the latest health row is global by `target`.
- A stale scenario can silently become fresh-green if a later same-target `ok` row exists and the spec only checks generic runtime text.
- A missing scenario can only be honest when no `integration_health_checks` rows exist for the relevant targets after seeding; `packages/db/src/seed.ts` does not seed health rows today, but this should stay locked by the harness test.
- Parallel Playwright projects sharing one marker path or server env would reintroduce cross-scenario contamination. Prefer sequential managed runs unless marker paths, ports, and DB URLs are fully isolated per project.
- Fresh-green assertions should prove statistics show `evidence present` when scoped stats exist; otherwise the test may pass on a green health row while failing to prove the runtime gate changed user-visible evidence.

## Verification/tests
RUN:
- `git status --short --branch` - inspected branch and dirty state only; the checkout was already heavily modified/untracked before this audit.
- Read-only protocol/context inspection of AGENTS.md, docs/SESSION_PROTOCOL.md, docs/handoffs/0000-orchestrator-seed.md, docs/STATUS.md, docs/IMPLEMENTED_FILES.md, and docs/NEXT_ACTIONS.md.
- Static line-number inspection with `rg` and `Get-Content` for the files listed above.
- `Test-Path docs/handoffs/20260604-1325-admin-runtimehealth-fixture-matrix-auditor.md` - confirmed this handoff path did not already exist before writing.

NOT RUN:
- `npm run e2e:admin-user-bots:db` - no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- Vitest, eslint, typecheck, `node scripts/gates.mjs core`, full Playwright, build, secret scan, governance check - not run because this lane was a read-only background audit and no implementation files were changed.
- `npm run accept:worker:continuity`, `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, deploy, SSH/tmux/systemd, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads - skipped by scope and safety policy.

## Next actions
1. In `scripts/prepare-admin-user-bot-detail-e2e.ts`, add a strict scenario parser for `ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO` with default `degraded-readable`, return `scenario` in the prepared marker, and split health seeding into `seedRuntimeHealthScenario(db, scenario)`.
2. In the fixture, seed the base selected-user stats/config/provider data once, then seed health per scenario: `fresh-green` inserts latest `status: ok/readState: ok` rows for both targets; `stale` inserts latest `status: ok/readState: stale` rows with unique stale detail text; `missing` inserts no health rows for the two targets; `degraded-readable` keeps the current `status: degraded/readState: ok` rows and sanitized degraded detail text.
3. In `tests/e2e/admin-user-bot-detail-db.spec.ts`, read `marker.scenario` and drive assertions from an expectation table. Assert exact labels/notes per scenario: fresh-green expects `runtime: <target>: ok` plus `evidence present`; stale expects `runtime: <target>: stale` plus stale detail and `evidence stale or gated`; missing expects `runtime: <target>: missing` plus the missing-row note and `evidence stale or gated`; degraded-readable expects the current ok readState labels plus degraded notes and `evidence stale or gated`.
4. In `scripts/run-admin-user-bot-detail-e2e-managed.mjs`, add a matrix mode/script that loops the four scenarios sequentially, creates a new throwaway DB per scenario, passes `ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO`, delegates to the existing runner, always attempts drop cleanup, and exits nonzero if any scenario fails. Keep output redacted and do not archive full URLs or unreviewed traces.
5. In `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`, statically lock the scenario enum, marker scenario, spec expectation table, managed matrix loop, mock/no-live-control env, throwaway DB naming, and the fact that default `npm run e2e` / `ci:local` still exclude this opt-in DB browser gate.
6. Gates to run after implementation: focused harness Vitest; loader/static admin-user bot tests; eslint on the changed fixture/spec/runner/harness files; `npm run e2e:admin-user-bots:db:managed` or the new matrix script with an explicit disposable admin Postgres URL; retained artifact/visual review if screenshots are archived; then `node scripts/gates.mjs core`. Keep worker continuity, live provider calls, live bot control, deploy, raw env/secret reads, and DB migrate/seed NOT RUN unless a separate phase explicitly provides the required throwaway target and authorization.
