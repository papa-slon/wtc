# ecosystem-tests-runner handoff
## Scope
Read-only tests/security audit for Phase 4.10 Tortila runtime/source evidence map.

Goal: identify focused test gates if the main implementation adds a user/admin Tortila runtime evidence and freshness map. The future implementation must prove no live control, no secret leakage, no exchange ping claims, no adapter network/live calls from UI/loaders, no provider/API/order/mark reads, and honest stale/missing/not-configured states.

Strictly out of scope for this auditor: product code edits, test edits, live server mutation, env/secret inspection, provider/API/exchange ping/order/mark reads, bot start/stop/apply/retest, worker tick, DB mutation, deploy/canary mutation, and claiming runtime freshness from anything not observed in this phase.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
8. `package.json`
9. `apps/web/package.json`
10. `tests/integration/bot-read-safety-static.test.ts`
11. `tests/integration/bot-statistics-static.test.ts`
12. `tests/integration/admin-bot-health-loader.test.ts`
13. `tests/integration/admin-responsive.test.ts`
14. `tests/e2e/bot-settings.spec.ts`
15. `tests/e2e/bot-readiness-map.spec.ts`
16. `tests/e2e/admin-user-bot-detail-db.spec.ts`
17. `tests/e2e/smoke.spec.ts`
18. `apps/web/src/features/bots/data.tsx`
19. `apps/web/src/features/bots/BotReadinessMap.tsx`
20. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
21. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
22. `apps/web/src/features/admin/bot-health-loader.ts`
23. `apps/web/src/app/admin/bots/page.tsx`
24. `apps/worker/src/jobs.ts`
25. `apps/worker/src/index.ts`
26. `packages/bot-adapters/src/types.ts`
27. `packages/bot-adapters/src/http.ts`
28. `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
29. `packages/db/src/repositories.ts`
## Files changed
None - read-only audit, except this handoff path:
1. `docs/handoffs/20260604-1025-tortila-runtime-source-tests-auditor.md`
## Findings
1. Severity: High. Evidence: `tests/integration/bot-read-safety-static.test.ts:284`, `apps/web/src/features/bots/data.tsx:339`, `apps/web/src/features/bots/data.tsx:363`, `apps/web/src/features/bots/data.tsx:535`. Current coverage proves production Tortila user reads are DB-snapshot backed and can derive stale/missing read states, but there is no focused runtime-evidence-map test asserting the exact future row model and copy. Recommendation: add a pure/static test for the new runtime evidence builder or component that covers `ok`, `stale`, `not_configured`, and missing user-scoped snapshot states, and asserts each state is labelled as persisted WTC DB/journal evidence rather than current exchange proof. Target part: user Tortila runtime evidence map DTO/component.
2. Severity: High. Evidence: `tests/integration/bot-read-safety-static.test.ts:216`, `tests/integration/bot-read-safety-static.test.ts:453`, `tests/integration/bot-read-safety-static.test.ts:476`, `packages/bot-adapters/src/http.ts:49`, `packages/bot-adapters/src/http.ts:85`. Existing static safety tests already ban `getBotAdapter`, `fetch(`, `vault.open`, control methods, secret fields, and "Connection verified" from readiness/settings surfaces, while the HTTP adapter is GET-only and explicitly excludes `/api/marks`. Recommendation: extend the static safety test to include the new runtime evidence map files and assert they contain no `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `apiKey`, `apiSecret`, `sealed`, `/api/marks`, `Connection verified`, or exchange-ping copy. Target part: runtime evidence map source boundary.
3. Severity: High. Evidence: `apps/web/src/app/admin/bots/page.tsx:17`, `apps/web/src/app/admin/bots/page.tsx:19`, `apps/web/src/app/admin/bots/page.tsx:21`, `apps/web/src/app/admin/bots/page.tsx:25`, `apps/web/src/app/admin/bots/page.tsx:28`, `apps/web/src/features/admin/bot-health-loader.ts:203`, `apps/web/src/features/admin/bot-health-loader.ts:217`, `apps/web/src/features/admin/bot-health-loader.ts:225`. Admin already maps Tortila journal health to setup-needed, unreachable, stale, last-check-ok, and no-checks states from persisted `integration_health_checks`. Future admin runtime evidence must test these labels directly and must not collapse missing or stale rows into a green state. Recommendation: add focused static or loader tests for the admin runtime evidence map using fixture `AdminBotHealthResult` objects for no checks, not_configured, stale, unreachable/error, and ok; assert missing/stale states are warn/bad/neutral, never "current" or "verified". Target part: admin Tortila runtime/freshness map.
4. Severity: High. Evidence: `tests/e2e/bot-readiness-map.spec.ts:17`, `tests/e2e/bot-readiness-map.spec.ts:23`, `tests/e2e/bot-settings.spec.ts:65`, `tests/e2e/bot-settings.spec.ts:189`, `tests/e2e/admin-user-bot-detail-db.spec.ts:134`. Rendered tests already prove readiness/settings/admin pages show disabled live-control boundaries and avoid test-connection controls. Recommendation: after implementation, add a focused Playwright check for user Tortila settings/dashboard and admin bots/admin selected-user detail that asserts the runtime evidence map is visible, shows stale/missing/no-check states when seeded or fixture-driven, has no `Start`, `Stop`, `Apply`, `Retest`, `Test connection`, `Connection verified`, or "exchange ping verified" affordance/copy, and has no horizontal scroll. Target part: rendered user/admin runtime evidence acceptance.
5. Severity: Medium. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:59`, `tests/e2e/admin-user-bot-detail-db.spec.ts:76`, `tests/e2e/admin-user-bot-detail-db.spec.ts:107`, `packages/db/src/repositories.ts:415`, `packages/db/src/repositories.ts:425`, `packages/db/src/repositories.ts:470`. Existing selected-user admin E2E includes secret leak markers and repository metadata checks select secret-row ids without ciphertext. Recommendation: if the runtime evidence map includes vault/key readiness or worker detail, add explicit sentinel assertions that raw secret markers, bearer/token text, DB URLs, sealed blobs, and provider error bodies do not render in user/admin pages or screenshots. Target part: secret-leak and artifact-safety coverage.
6. Severity: Medium. Evidence: `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:26`, `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:33`, `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:69`, `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:77`, `apps/worker/src/jobs.ts:61`, `apps/worker/src/jobs.ts:93`. Adapter health-state tests are already fully mocked and prove no token means no fetch; worker jobs map read states to persisted health rows. Recommendation: do not add live adapter/network tests for Phase 4.10. If adapter-level coverage is needed, use mocked `fetch` only and assert no network call in `not_configured`; otherwise keep Phase 4.10 gates at UI/loader/static level. Target part: adapter-network safety boundary.
7. Severity: Medium. Evidence: `tests/integration/bot-statistics-static.test.ts:29`, `tests/integration/bot-statistics-static.test.ts:39`, `tests/integration/bot-statistics-static.test.ts:91`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:115`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:116`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:226`. Existing operation/statistics map copy says runtime facts are read-only evidence and not live exchange control, but the future runtime evidence map can regress into stronger "current live runtime" language. Recommendation: add copy assertions that allow "latest persisted WTC DB snapshot", "read-only journal snapshot", "worker health", "snapshot stale/missing", and "no checks", while rejecting "live exchange verified", "current runtime enforced", "connection verified", "exchange ping passed", and "safe to trade". Target part: product copy truthfulness.
## Decisions
1. Phase 4.10 tests should be focused and source-backed; do not run live provider, exchange, worker, DB-mutation, SSH, deploy, or canary gates for this UI evidence-map slice.
2. The runtime evidence map should consume existing persisted WTC DB/read-model/admin-loader state, not call adapters or network from React components, page loaders, or tests.
3. Stale, missing, not_configured, and no-check states are first-class accepted states, not failures to hide and not green all-clear states.
4. Runtime evidence wording must remain read-only: latest persisted snapshot/worker health/journal read state, not live exchange proof or current enforcement proof.
5. Existing opt-in DB e2e should remain opt-in; only use it if implementation actually touches DB-backed admin selected-user fixtures.
## Risks
1. A runtime evidence map can easily overstate truth by showing WTC reference settings or old snapshots as current Tortila runtime enforcement.
2. Copy such as "verified", "connected", "current", or "healthy" can imply exchange ping/live safety unless tests explicitly ban it.
3. Admin health details are sanitized and truncated today, but new detail fields could leak provider/token/error material if not tested with sentinel strings.
4. Running worker ticks, provider calls, or DB-managed e2e in this phase would violate the requested read-only auditor scope; those remain implementation/acceptance decisions, not this audit.
5. The worktree was already heavily dirty/untracked before this audit; this handoff does not distinguish ownership of those existing changes beyond the current handoff file.
## Verification/tests
RUN:
1. Required docs/context read:
   - `AGENTS.md`
   - `docs/SESSION_PROTOCOL.md`
   - `docs/handoffs/0000-orchestrator-seed.md`
   - `docs/STATUS.md`
   - `docs/NEXT_ACTIONS.md`
   - `docs/IMPLEMENTED_FILES.md`
   - `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
2. Repository state inspection:
   - `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with extensive pre-existing dirty and untracked files.
3. Read-only source/test searches:
   - `rg` over the named integration/e2e tests for live-control, secret, adapter, exchange-ping, runtime, freshness, stale, missing, and Tortila terms.
   - `rg` over `apps/web/src/features/bots`, `apps/web/src/features/admin`, `apps/web/src/app/(app)/app/bots`, `apps/web/src/app/admin/bots`, `packages/bot-adapters`, `apps/worker/src`, and `packages/db/src/repositories.ts` for runtime/source/freshness and forbidden-call boundaries.
   - `rg --files tests | rg "(bot|admin).*\\.(test|spec)\\.ts$"` to locate likely focused gates.

RECOMMENDED IMPLEMENTATION-PHASE GATES:
1. Static/source safety:
   - `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/admin-responsive.test.ts`
   - Required new assertions: new runtime evidence map files contain safe source/freshness copy; no `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `/api/marks`, `apiKey`, `apiSecret`, `sealed`, `Connection verified`, or exchange-ping proof copy.
2. Loader/component unit coverage:
   - Add/run a focused test for the new runtime evidence builder/component, e.g. `npx vitest run tests/integration/bot-runtime-source-evidence.test.ts` if added.
   - Required assertions: `ok`, `stale`, `not_configured`, `unreachable/malformed`, no-checks, and missing user-scoped snapshot states render distinct labels and tones; stale/missing are not green; evidence source is WTC DB/worker/journal snapshot only.
3. Admin loader safety:
   - `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts`
   - Required assertions: admin runtime rows use sanitized/truncated health detail, source adapter, snapshot timestamps, owner scope; no raw `warningCodes`, bearer/token strings, secret markers, sealed blobs, DB URLs, or provider error bodies.
4. Rendered user/admin acceptance:
   - `$env:E2E_PORT='34xx'; npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile`
   - If admin selected-user DB fixture is updated: `npm run e2e:admin-user-bots:db`
   - Required assertions: runtime evidence map visible on user/admin surfaces; stale/missing/no-check states are visible; no live-control/test-connection buttons or exchange-ping proof copy; no horizontal scroll.
5. Standard focused hygiene after implementation:
   - `npx eslint -- <changed runtime evidence files> <changed tests>`
   - `npm run typecheck -w @wtc/web`
   - `npm run typecheck`
   - `npm run secret:scan`
   - `git diff --check`

NOT RUN:
1. No product or test gates were executed in this auditor lane; this handoff is recommendations only.
2. No Playwright/browser run - skipped because the implementation does not exist in this lane and no server should be started.
3. No DB migrations, seeds, managed DB e2e, worker tick, production/canary deploy, SSH/tmux/systemd - skipped by scope.
4. No live bot start/stop/apply/retest, live diagnostics, exchange ping, provider/API calls, order/position/mark reads - skipped by safety protocol.
5. No env value or secret inspection - skipped by scope.
6. No git commit, push, PR - not requested.
## Next actions
1. Main implementation should add the Tortila runtime/source evidence map behind existing read-model/admin-loader boundaries only.
2. Add focused static and rendered tests from the recommended gate list before claiming Phase 4.10 accepted.
3. Keep the aggregate Phase 4.10 handoff honest: list these auditor findings, exact gates run, exact gates not run, and do not claim live freshness/exchange proof unless a separate approved runtime acceptance phase actually observes it.
