# admin-runtimehealth-loader-ui-matrix-auditor handoff
## Scope
Read-only Phase 4.17 background audit of selected admin user bot detail runtimeHealth loader and UI behavior. Focused on the expected DTO and rendered labels for fresh OK, stale, missing, and degraded health; where status/detail text is generated; which browser assertions should lock the behavior; and whether the next work should change source/UX or stay harness-only. No live bot start/stop/apply-config, exchange/provider call, raw env read, raw secret read, DB migration/seed, DB mutation, server start, deploy, SSH, tmux, or systemd action was performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1254-admin-user-runtimehealth-e2e-coverage-auditor.md`
- `docs/handoffs/20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence `apps/web/src/features/admin/types.ts:146`, `apps/web/src/features/admin/types.ts:153`, `apps/web/src/features/admin/user-bot-detail-loader.ts:275`, `apps/web/src/features/admin/user-bot-detail-loader.ts:288`, `apps/web/src/features/admin/user-bot-detail-loader.ts:331`, `tests/integration/admin-user-bot-detail-loader.test.ts:683` - recommendation: treat the fresh OK DTO contract as `status: "ok"` or `"healthy"`, `readState: "ok"` when present, `freshness: "fresh"`, and `state: "ok"`; target part: loader/browser matrix. Rendered labels are `runtime: <target>: ok`, overview `<scope> / <target>: ok`, Runtime health value `ok`, Runtime scope label `<target>: ok`, and, when scoped statistics exist, User-scoped statistics label `evidence present` from `page.tsx:120`. No source change is needed for this path; add a browser fixture/assertion if fresh-green acceptance is required.
2. Severity P1 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:285`, `apps/web/src/features/admin/user-bot-detail-loader.ts:287`, `apps/web/src/features/admin/user-bot-detail-loader.ts:300`, `apps/web/src/features/admin/user-bot-detail-loader.ts:303`, `apps/web/src/features/admin/user-bot-detail-loader.ts:306`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:107`, `tests/integration/admin-user-bot-detail-loader.test.ts:675` - recommendation: model stale browser coverage with a latest row whose `readState` is `"stale"` and a unique `readStateDetail`; target part: stale runtimeHealth matrix. DTO becomes `freshness: "stale"` and `state: "attention"`. With `readState: "stale"`, rendered labels are `runtime: <target>: stale`, Runtime health value `stale`, Runtime scope detail equal to `readStateDetail` or `<target> returned stale data in the latest worker health cycle.`, and statistics with evidence render `evidence stale or gated`. If the row is stale only by age while `readState` remains `"ok"`, the visible label stays `<target>: ok` and only the note/tone/statistics gate reveal staleness; the browser test should either avoid that fixture shape or assert the age-stale note.
3. Severity P1 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:316`, `apps/web/src/features/admin/user-bot-detail-loader.ts:325`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:109`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:142`, `tests/integration/admin-user-bot-detail-loader.test.ts:703` - recommendation: lock missing health with a dedicated latest-row-absent target state and scoped stats present; target part: missing runtimeHealth matrix. DTO is `status: null`, `readState: null`, `readStateDetail: null`, `checkedAt: null`, `freshness: "missing"`, `state: "missing"`, and note `No persisted <target> health row exists yet. Run the worker snapshot cycle.` Rendered labels are `runtime: <target>: missing`, Runtime health value `missing`, Runtime health subtext `<target>`, Runtime scope label `<target>: missing`, and statistics with otherwise-present evidence render `evidence stale or gated`.
4. Severity P1 - evidence `tests/integration/admin-user-bot-detail-loader.test.ts:500`, `tests/integration/admin-user-bot-detail-loader.test.ts:564`, `scripts/prepare-admin-user-bot-detail-e2e.ts:389`, `scripts/prepare-admin-user-bot-detail-e2e.ts:397`, `tests/e2e/admin-user-bot-detail-db.spec.ts:135`, `tests/e2e/admin-user-bot-detail-db.spec.ts:140` - recommendation: keep current degraded-but-readable assertions as a separate attention-state case, not as fresh-green proof; target part: existing DB E2E fixture. Current degraded fixture is `status: "degraded"`, `readState: "ok"`, `freshness: "fresh"`, `state: "attention"`. Because UI labels prefer `readState` over status, the rendered runtime pills are `runtime: tortila-journal: ok` and `runtime: legacy-bot: ok`, while User-scoped statistics shows `evidence stale or gated`; detail text comes from fixture `readStateDetail` when present, otherwise the loader fallback would be `<target> latest persisted health status is degraded.`
5. Severity P1 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:292`, `apps/web/src/features/admin/user-bot-detail-loader.ts:310`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:107`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:120`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:141`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:178`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:316` - recommendation: document the text ownership split in the test comments or harness naming; target part: browser assertion maintainability. Status/detail DTO text is generated in loader helpers `runtimeHealthSummary`, `runtimeHealthState`, and `runtimeHealthNote`; rendered pill/card labels are generated in page helpers `runtimeHealthLabel`, `statisticsStatusLabel`, `userBotEvidenceMetrics`, and `userBotEvidenceRows`. The UI does not create its own degraded/stale/missing detail copy except by selecting the DTO note.
6. Severity P1 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:950`, `apps/web/src/features/admin/user-bot-detail-loader.ts:960`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1072`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1076`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:42`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:54` - recommendation: design the browser matrix as separate fixture runs or carefully ordered latest-per-target data; target part: E2E harness. The loader takes one latest `integration_health_checks` row per target, so adding stale or missing users while a newer global same-target row exists can false-green the selected-user page.
7. Severity P2 - evidence `tests/e2e/admin-user-bot-detail-db.spec.ts:133`, `tests/e2e/admin-user-bot-detail-db.spec.ts:139`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:82`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:90` - recommendation: treat the next implementation as harness-only unless these assertions fail or product wants the degraded status visible in the primary label; target part: Phase 4.17 scope decision. Current source behavior is internally consistent and already covered at DTO/static/degraded-browser-contract level. A UX/source change would only be needed if the product decision is to render persisted `status: degraded` ahead of `readState: ok`.

## Decisions
- No app source or UX change is recommended by this audit for the current contract.
- The next Phase 4.17 work can be harness-only: add/extend DB E2E fixture coverage for fresh OK, stale, and missing states, while retaining the existing degraded-but-readable assertions.
- For stale coverage, prefer `readState: "stale"` over age-only staleness so the visible runtime labels are deterministic and do not read as `ok`.
- For missing coverage, use a dedicated DB state where the target health row is absent and scoped stats still exist; otherwise the statistics row can show `pending`, which does not prove runtime health gating.
- Keep current read-only boundaries and no-live-control assertions unchanged.

## Risks
- Age-stale rows with `readState: "ok"` can look visually green in the runtime label even though the DTO state is attention and statistics are gated. This is a known fixture-design hazard, not necessarily a source bug.
- Missing-health browser coverage cannot be mixed naively with global product health rows because the loader selects latest health by target, not by user.
- If the browser matrix is added without scoped statistics, `statisticsStatusLabel` returns `pending`, so the test would not prove stale/missing runtime health gates otherwise-present evidence.
- Current DB-backed browser E2E remains opt-in and was not run in this audit; real Postgres render acceptance still requires a disposable DB URL or approved managed admin URL.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/next-actions/implemented-files, latest Phase 4.16 aggregate, and relevant Phase 4.15 runtimeHealth handoffs.
- Static source inspection with `rg` and line-numbered `Get-Content` for the files listed above.
- `Test-Path docs/handoffs/20260604-1325-admin-runtimehealth-loader-ui-matrix-auditor.md` before writing - returned `False`.

NOT RUN:
- `npm run e2e:admin-user-bots:db` - no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- `npx playwright test -c playwright.admin-user-bots-db.config.ts` - requires the guarded runner-created env and prepared marker.
- Vitest, typecheck, eslint, full Playwright, build, secret scan, governance check - not run due read-only background audit scope.
- Live bot start/stop/apply-config, exchange/provider calls, raw env/secret reads, DB migrate/seed, DB mutation, deploy, SSH, tmux, systemd - not run by safety policy.

## Next actions
1. Add a DB browser matrix for fresh OK, stale, missing, and existing degraded attention states. Lock rendered labels, runtime notes, statistics labels, read-only controls, and secret-negative markers.
2. Fresh OK assertions should include `runtime: tortila-journal: ok`, `runtime: legacy-bot: ok`, overview labels with `: ok`, Runtime health count 2, Runtime scope count at least 2, and `evidence present` when scoped stats exist.
3. Stale assertions should use latest `readState: "stale"` rows and lock `runtime: <target>: stale`, Runtime health value `stale`, unique `readStateDetail`, and `evidence stale or gated`.
4. Missing assertions should lock `runtime: <target>: missing`, Runtime health value `missing`, missing-row note text, and `evidence stale or gated` with scoped stats present.
5. Keep the existing degraded fixture assertions for `runtime: tortila-journal: ok`, `runtime: legacy-bot: ok`, the two degraded readable detail strings, and `evidence stale or gated`; do not treat that fixture as fresh-green.
